from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django.utils.dateparse import parse_date

from .models import Vehicle, TransportRevenue, TransportExpense
from .models import Trip
from .serializers import VehicleSerializer, TransportRevenueSerializer, TransportExpenseSerializer, TripSerializer, TripMovementSerializer
from .permissions import HasTransportModule


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

        revenues = rev_qs.aggregate(total=Sum('amount'))['total'] or 0
        expenses = exp_qs.aggregate(total=Sum('amount'))['total'] or 0

        # Viagem entra na soma: receita apenas quando recebida, despesas sempre por gasto informado
        trip_revenues = trip_qs.filter(is_received=True).aggregate(total=Sum('total_value'))['total'] or 0
        trip_expenses = trip_qs.aggregate(total=Sum('expense_value'))['total'] or 0

        revenues = revenues + trip_revenues
        expenses = expenses + trip_expenses
        profit = revenues - expenses

        data = {
            'vehicle_id': str(vehicle.id),
            'revenues_total': float(revenues),
            'expenses_total': float(expenses),
            'net_profit': float(profit),
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
