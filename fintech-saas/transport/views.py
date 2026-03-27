from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django.db import transaction
from django.utils.dateparse import parse_date
from django.utils import timezone
from decimal import Decimal

from .models import Vehicle, TransportRevenue, TransportExpense
from .models import Trip, TripMovement, TireInventory, VehicleTirePlacement, MaintenanceLog, OilChangeLog, MaintenanceAlert
from .serializers import (
    VehicleSerializer,
    TransportRevenueSerializer,
    TransportExpenseSerializer,
    TripSerializer,
    TripMovementSerializer,
    TireInventorySerializer,
    VehicleTirePlacementSerializer,
    MaintenanceLogSerializer,
    OilChangeLogSerializer,
    MaintenanceAlertSerializer,
)
from .permissions import HasTransportModule


def _refresh_tire_status(tire):
    active_exists = VehicleTirePlacement.objects.filter(tire=tire, removal_date__isnull=True).exists()
    if active_exists:
        tire.status = TireInventory.STATUS_IN_USE
    elif tire.status != TireInventory.STATUS_DISCARDED:
        tire.status = TireInventory.STATUS_STOCK
    tire.save(update_fields=['status'])


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated, HasTransportModule]

    def get_queryset(self):
        user = self.request.user
        # Multi-tenant: filtrar pelo tenant do usuário
        tenant = getattr(user, 'tenant', None)
        if tenant:
            return Vehicle.objects.filter(tenant=tenant)
        return Vehicle.objects.none()

    def perform_create(self, serializer):
        tenant = getattr(self.request.user, 'tenant', None)
        serializer.save(tenant=tenant)

    @action(detail=True, methods=['post'], url_path='set-current-tires')
    def set_current_tires(self, request, pk=None):
        vehicle = self.get_object()
        tenant = getattr(request.user, 'tenant', None)
        placements = request.data.get('placements', [])
        installation_date = parse_date(request.data.get('installation_date')) or timezone.localdate()

        if not isinstance(placements, list) or not placements:
            return Response({'detail': 'Informe a lista de pneus atuais do veículo.'}, status=status.HTTP_400_BAD_REQUEST)

        tire_ids = [str(entry.get('tire')) for entry in placements if entry.get('tire')]
        if len(tire_ids) != len(set(tire_ids)):
            return Response({'detail': 'O mesmo pneu não pode ser vinculado em duas posições ao mesmo tempo.'}, status=status.HTTP_400_BAD_REQUEST)

        slot_keys = [
            f"{entry.get('axle_number')}-{entry.get('side')}-{entry.get('position', VehicleTirePlacement.POSITION_OUTSIDE)}"
            for entry in placements
        ]
        if len(slot_keys) != len(set(slot_keys)):
            return Response({'detail': 'Há posições duplicadas no mapeamento de pneus.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for entry in placements:
                tire_id = entry.get('tire')
                axle_number = entry.get('axle_number')
                side = entry.get('side')
                position = entry.get('position', VehicleTirePlacement.POSITION_OUTSIDE)

                if not tire_id or not axle_number:
                    return Response({'detail': 'Cada item deve conter tire e axle_number.'}, status=status.HTTP_400_BAD_REQUEST)
                if side not in {VehicleTirePlacement.SIDE_LEFT, VehicleTirePlacement.SIDE_RIGHT}:
                    return Response({'detail': 'Campo side inválido.'}, status=status.HTTP_400_BAD_REQUEST)
                if position not in {VehicleTirePlacement.POSITION_INSIDE, VehicleTirePlacement.POSITION_OUTSIDE}:
                    return Response({'detail': 'Campo position inválido.'}, status=status.HTTP_400_BAD_REQUEST)
                if not vehicle.is_dual_wheel and position == VehicleTirePlacement.POSITION_INSIDE:
                    return Response({'detail': 'Posição "dentro" só é permitida para veículos com rodagem dupla.'}, status=status.HTTP_400_BAD_REQUEST)

                tire = TireInventory.objects.filter(id=tire_id, tenant=tenant).first()
                if not tire:
                    return Response({'detail': f'Pneu {tire_id} não pertence ao tenant.'}, status=status.HTTP_400_BAD_REQUEST)

                slot_active = VehicleTirePlacement.objects.filter(
                    tenant=tenant,
                    vehicle=vehicle,
                    axle_number=int(axle_number),
                    side=side,
                    position=position,
                    removal_date__isnull=True,
                ).first()
                if slot_active:
                    removed_tire = slot_active.tire
                    slot_active.removal_date = installation_date
                    slot_active.removal_km = vehicle.current_km
                    slot_active.save(update_fields=['removal_date', 'removal_km'])
                    _refresh_tire_status(removed_tire)

                tire_active = VehicleTirePlacement.objects.filter(tenant=tenant, tire=tire, removal_date__isnull=True).first()
                if tire_active:
                    tire_active.removal_date = installation_date
                    tire_active.removal_km = tire_active.vehicle.current_km
                    tire_active.save(update_fields=['removal_date', 'removal_km'])
                    _refresh_tire_status(tire)

                VehicleTirePlacement.objects.create(
                    tenant=tenant,
                    vehicle=vehicle,
                    tire=tire,
                    installation_date=installation_date,
                    axle_number=int(axle_number),
                    side=side,
                    position=position,
                    current_km_at_installation=vehicle.current_km,
                )
                tire.status = TireInventory.STATUS_IN_USE
                tire.save(update_fields=['status'])

        current = VehicleTirePlacement.objects.filter(tenant=tenant, vehicle=vehicle).order_by('-installation_date', '-id')
        return Response(VehicleTirePlacementSerializer(current, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='rotate_tires')
    def rotate_tires(self, request, pk=None):
        vehicle = self.get_object()
        tenant = getattr(request.user, 'tenant', None)
        rotation_date = parse_date(request.data.get('rotation_date')) or timezone.localdate()
        source = request.data.get('source') or {}
        target = request.data.get('target') or {}

        def _load_active_slot(slot):
            axle_number = slot.get('axle_number')
            side = slot.get('side')
            position = slot.get('position', VehicleTirePlacement.POSITION_OUTSIDE)
            if not axle_number or side not in {VehicleTirePlacement.SIDE_LEFT, VehicleTirePlacement.SIDE_RIGHT}:
                return None
            if position not in {VehicleTirePlacement.POSITION_INSIDE, VehicleTirePlacement.POSITION_OUTSIDE}:
                return None
            if not vehicle.is_dual_wheel and position == VehicleTirePlacement.POSITION_INSIDE:
                return None
            return VehicleTirePlacement.objects.filter(
                tenant=tenant,
                vehicle=vehicle,
                axle_number=int(axle_number),
                side=side,
                position=position,
                removal_date__isnull=True,
            ).first()

        source_slot = _load_active_slot(source)
        target_slot = _load_active_slot(target)

        if not source_slot or not target_slot:
            return Response({'detail': 'Posições de origem/destino inválidas para rodízio.'}, status=status.HTTP_400_BAD_REQUEST)

        if source_slot.id == target_slot.id:
            return Response({'detail': 'Selecione duas posições diferentes para rodízio.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            source_tire = source_slot.tire
            target_tire = target_slot.tire

            source_slot.removal_date = rotation_date
            source_slot.removal_km = vehicle.current_km
            source_slot.save(update_fields=['removal_date', 'removal_km'])

            target_slot.removal_date = rotation_date
            target_slot.removal_km = vehicle.current_km
            target_slot.save(update_fields=['removal_date', 'removal_km'])

            VehicleTirePlacement.objects.create(
                tenant=tenant,
                vehicle=vehicle,
                tire=source_tire,
                installation_date=rotation_date,
                axle_number=target_slot.axle_number,
                side=target_slot.side,
                position=target_slot.position,
                current_km_at_installation=vehicle.current_km,
            )
            VehicleTirePlacement.objects.create(
                tenant=tenant,
                vehicle=vehicle,
                tire=target_tire,
                installation_date=rotation_date,
                axle_number=source_slot.axle_number,
                side=source_slot.side,
                position=source_slot.position,
                current_km_at_installation=vehicle.current_km,
            )

            source_tire.status = TireInventory.STATUS_IN_USE
            source_tire.save(update_fields=['status'])
            target_tire.status = TireInventory.STATUS_IN_USE
            target_tire.save(update_fields=['status'])

        active_placements = VehicleTirePlacement.objects.filter(tenant=tenant, vehicle=vehicle, removal_date__isnull=True)
        return Response(VehicleTirePlacementSerializer(active_placements, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, pk=None):
        """Retorna resumo financeiro (receitas, despesas, lucro líquido) do veículo em um intervalo opcional de datas."""
        vehicle = self.get_object()
        start = request.query_params.get('start')
        end = request.query_params.get('end')

        rev_qs = TransportRevenue.objects.filter(vehicle=vehicle)
        exp_qs = TransportExpense.objects.filter(vehicle=vehicle)
        trip_qs = Trip.objects.filter(vehicle=vehicle)

        if start:
            s = parse_date(start)
            if s:
                rev_qs = rev_qs.filter(date__gte=s)
                exp_qs = exp_qs.filter(date__gte=s)
                trip_qs = trip_qs.filter(date__gte=s)
        if end:
            e = parse_date(end)
            if e:
                rev_qs = rev_qs.filter(date__lte=e)
                exp_qs = exp_qs.filter(date__lte=e)
                trip_qs = trip_qs.filter(date__lte=e)

        revenues = rev_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        expenses = exp_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Viagem entra na soma: receita adicional pode vir de TransportRevenue (tipo 'trip')
        # e também de lançamentos (TripMovement) do tipo 'revenue'. Despesas consideram expense_value das viagens.
        trip_revenues = trip_qs.filter(is_received=True).aggregate(total=Sum('total_value'))['total'] or Decimal('0')
        trip_expenses = trip_qs.aggregate(total=Sum('expense_value'))['total'] or Decimal('0')

        # receitas vindas de movimentos ligados a viagens
        movements_rev = TripMovement.objects.filter(trip__vehicle=vehicle, movement_type='revenue')
        if start:
            s = parse_date(start)
            if s:
                movements_rev = movements_rev.filter(date__gte=s)
        if end:
            e = parse_date(end)
            if e:
                movements_rev = movements_rev.filter(date__lte=e)
        movements_rev_sum = movements_rev.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        revenues = Decimal(str(revenues)) + Decimal(str(trip_revenues)) + Decimal(str(movements_rev_sum))
        expenses = Decimal(str(expenses)) + Decimal(str(trip_expenses))
        profit = revenues - expenses

        data = {
            'vehicle_id': str(vehicle.id),
            'revenues_total': str(revenues),
            'expenses_total': str(expenses),
            'net_profit': str(profit),
        }
        return Response(data, status=status.HTTP_200_OK)


class TransportRevenueViewSet(viewsets.ModelViewSet):
    queryset = TransportRevenue.objects.all()
    serializer_class = TransportRevenueSerializer
    permission_classes = [IsAuthenticated, HasTransportModule]
    filterset_fields = ['vehicle']

    def get_queryset(self):
        user = self.request.user
        tenant = getattr(user, 'tenant', None)
        if tenant:
            return TransportRevenue.objects.filter(vehicle__tenant=tenant)
        return TransportRevenue.objects.none()

    def perform_create(self, serializer):
        # Verificar que o veículo pertence ao tenant do usuário
        vehicle = serializer.validated_data.get('vehicle')
        user_tenant = getattr(self.request.user, 'tenant', None)
        if not vehicle or vehicle.tenant != user_tenant:
            raise serializers.ValidationError({'vehicle': 'Veículo inválido ou não pertence ao tenant do usuário.'})
        serializer.save()


class TransportExpenseViewSet(viewsets.ModelViewSet):
    queryset = TransportExpense.objects.all()
    serializer_class = TransportExpenseSerializer
    permission_classes = [IsAuthenticated, HasTransportModule]
    filterset_fields = ['vehicle']

    def get_queryset(self):
        user = self.request.user
        tenant = getattr(user, 'tenant', None)
        if tenant:
            return TransportExpense.objects.filter(vehicle__tenant=tenant)
        return TransportExpense.objects.none()

    def perform_create(self, serializer):
        vehicle = serializer.validated_data.get('vehicle')
        user_tenant = getattr(self.request.user, 'tenant', None)
        if not vehicle or vehicle.tenant != user_tenant:
            raise serializers.ValidationError({'vehicle': 'Veículo inválido ou não pertence ao tenant do usuário.'})
        serializer.save()


class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated, HasTransportModule]
    filterset_fields = ['vehicle', 'modality', 'date', 'status', 'is_received']

    def get_queryset(self):
        user = self.request.user
        tenant = getattr(user, 'tenant', None)
        if tenant:
            return Trip.objects.filter(vehicle__tenant=tenant).order_by('-date', '-id')
        return Trip.objects.none()

    def perform_create(self, serializer):
        # validar veículo pertence ao tenant
        vehicle = serializer.validated_data.get('vehicle')
        user_tenant = getattr(self.request.user, 'tenant', None)
        if not vehicle or vehicle.tenant != user_tenant:
            raise serializers.ValidationError({'vehicle': 'Veículo inválido ou não pertence ao tenant do usuário.'})
        serializer.save()

    @action(detail=True, methods=['get', 'post'], url_path='movements')
    def movements(self, request, pk=None):
        trip = self.get_object()

        if request.method.lower() == 'get':
            serializer = TripMovementSerializer(trip.movements.all(), many=True)
            return Response(serializer.data)

        serializer = TripMovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(trip=trip)
        trip.recalculate_from_movements()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'movements/(?P<movement_id>[^/.]+)')
    def movement_detail(self, request, pk=None, movement_id=None):
        trip = self.get_object()
        movement = trip.movements.filter(id=movement_id).first()
        if not movement:
            return Response({'detail': 'Lançamento não encontrado para esta viagem.'}, status=status.HTTP_404_NOT_FOUND)

        if request.method.lower() == 'delete':
            movement.delete()
            trip.recalculate_from_movements()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = TripMovementSerializer(movement, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        trip.recalculate_from_movements()
        return Response(serializer.data)


class TireInventoryViewSet(viewsets.ModelViewSet):
    queryset = TireInventory.objects.all()
    serializer_class = TireInventorySerializer
    permission_classes = [IsAuthenticated, HasTransportModule]
    filterset_fields = ['status']

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        if tenant:
            return TireInventory.objects.filter(tenant=tenant).order_by('-purchase_date', '-id')
        return TireInventory.objects.none()

    def perform_create(self, serializer):
        serializer.save(tenant=getattr(self.request.user, 'tenant', None))


class VehicleTirePlacementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VehicleTirePlacement.objects.all()
    serializer_class = VehicleTirePlacementSerializer
    permission_classes = [IsAuthenticated, HasTransportModule]
    filterset_fields = ['vehicle', 'tire', 'removal_date']

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        if tenant:
            return VehicleTirePlacement.objects.filter(tenant=tenant)
        return VehicleTirePlacement.objects.none()


class MaintenanceLogViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceLog.objects.all()
    serializer_class = MaintenanceLogSerializer
    permission_classes = [IsAuthenticated, HasTransportModule]
    filterset_fields = ['vehicle', 'date']

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        if tenant:
            return MaintenanceLog.objects.filter(tenant=tenant).select_related('oil_change', 'vehicle')
        return MaintenanceLog.objects.none()

    def perform_create(self, serializer):
        vehicle = serializer.validated_data.get('vehicle')
        tenant = getattr(self.request.user, 'tenant', None)
        if not vehicle or vehicle.tenant != tenant:
            raise serializers.ValidationError({'vehicle': 'Veículo inválido ou não pertence ao tenant do usuário.'})
        serializer.save(tenant=tenant)


class OilChangeLogViewSet(viewsets.ModelViewSet):
    queryset = OilChangeLog.objects.all()
    serializer_class = OilChangeLogSerializer
    permission_classes = [IsAuthenticated, HasTransportModule]
    filterset_fields = ['maintenance', 'type']

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        if tenant:
            return OilChangeLog.objects.filter(tenant=tenant).select_related('maintenance')
        return OilChangeLog.objects.none()

    def perform_create(self, serializer):
        maintenance = serializer.validated_data.get('maintenance')
        tenant = getattr(self.request.user, 'tenant', None)
        if not maintenance or maintenance.tenant != tenant:
            raise serializers.ValidationError({'maintenance': 'Manutenção inválida para este tenant.'})
        serializer.save(tenant=tenant)


class MaintenanceAlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MaintenanceAlert.objects.all()
    serializer_class = MaintenanceAlertSerializer
    permission_classes = [IsAuthenticated, HasTransportModule]
    filterset_fields = ['level', 'is_read', 'vehicle']

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        if tenant:
            return MaintenanceAlert.objects.filter(tenant=tenant)
        return MaintenanceAlert.objects.none()

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        alert = self.get_object()
        if not alert.is_read:
            alert.is_read = True
            alert.save(update_fields=['is_read'])
        return Response(self.get_serializer(alert).data)
