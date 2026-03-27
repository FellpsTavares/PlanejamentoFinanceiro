from rest_framework import serializers
from decimal import Decimal
from .models import Vehicle, FuelLog, TransportRevenue, TransportExpense
from .models import Trip, TripMovement, TireInventory, VehicleTirePlacement, MaintenanceLog, OilChangeLog, MaintenanceAlert
from accounts.models import TenantParameter


class FuelLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelLog
        fields = ['id', 'vehicle', 'date', 'odometer_km', 'liters', 'total_value']


class TransportRevenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransportRevenue
        fields = ['id', 'vehicle', 'date', 'amount', 'type', 'description']


class TransportExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransportExpense
        fields = ['id', 'vehicle', 'date', 'amount', 'category', 'description']


class VehicleSerializer(serializers.ModelSerializer):
    avg_consumption = serializers.SerializerMethodField(read_only=True)
    current_km = serializers.IntegerField(read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            'id', 'tenant', 'plate', 'model', 'year', 'capacity',
            'initial_km', 'is_dual_wheel', 'number_of_axles', 'next_review_date', 'next_review_km',
            'avg_consumption', 'current_km'
        ]
        read_only_fields = ['avg_consumption', 'current_km', 'tenant']

    def get_avg_consumption(self, obj):
        # Busca os dois últimos registros de FuelLog do veículo
        logs = FuelLog.objects.filter(vehicle=obj).order_by('-date', '-id')[:2]
        if len(logs) < 2:
            return None
        current = logs[0]
        previous = logs[1]
        try:
            distance = current.odometer_km - previous.odometer_km
            liters = float(current.liters)
            if liters <= 0 or distance <= 0:
                return None
            avg = distance / liters
            return round(avg, 3)
        except Exception:
            return None


class TripSerializer(serializers.ModelSerializer):
    net_value = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Trip
        fields = [
            'id', 'vehicle', 'date', 'start_date', 'end_date', 'modality', 'progress_type', 'tons', 'rate_per_ton',
            'days', 'daily_rate', 'total_value', 'is_received',
            'base_expense_value', 'fuel_expense_value', 'initial_km', 'final_km',
            # novo: litros abastecidos e consumo calculado
            'fuel_liters', 'consumption_km_per_liter', 'driver_is_owner',
            'status', 'driver_payment', 'expense_value', 'net_value', 'description'
        ]
        read_only_fields = ['total_value', 'consumption_km_per_liter']

    def get_net_value(self, obj):
        # Incluir receitas adicionais do tipo 'trip' vinculadas ao veículo no período da viagem
        try:
            total_value = (obj.total_value or Decimal('0'))
            expense_value = (obj.expense_value or Decimal('0'))

            # determinar período da viagem
            start = obj.start_date or obj.date
            end = obj.end_date or obj.date
            rev_extra = Decimal('0')
            if obj.vehicle_id and start and end:
                from django.db.models import Sum
                rev_qs = TransportRevenue.objects.filter(vehicle=obj.vehicle, type='trip', date__gte=start, date__lte=end)
                rev_sum = rev_qs.aggregate(total=Sum('amount'))['total'] or 0
                rev_extra = Decimal(str(rev_sum))

            # incluir receitas lançadas como movimentos da própria viagem
            try:
                mov_rev_sum = TripMovement.objects.filter(trip=obj, movement_type='revenue').aggregate(total=Sum('amount'))['total'] or 0
                rev_extra = rev_extra + Decimal(str(mov_rev_sum))
            except Exception:
                # se TripMovement não estiver disponível por algum motivo, ignore
                pass

            net = total_value + rev_extra - expense_value
            # Retornar string com valor exato (evita perdas de precisão ao converter para float)
            return str(net)
        except Exception:
            return str((obj.total_value or Decimal('0')) - (obj.expense_value or Decimal('0')))

    def validate(self, data):
        modality = data.get('modality', getattr(self.instance, 'modality', None))
        if modality == 'per_ton':
            tons = data.get('tons', getattr(self.instance, 'tons', None))
            rate_per_ton = data.get('rate_per_ton', getattr(self.instance, 'rate_per_ton', None))
            if tons is None or rate_per_ton is None:
                raise serializers.ValidationError('Para modalidade por tonelada, informe "tons" e "rate_per_ton".')
        elif modality == 'lease':
            days = data.get('days', getattr(self.instance, 'days', None))
            daily_rate = data.get('daily_rate', getattr(self.instance, 'daily_rate', None))
            if days is None or daily_rate is None:
                raise serializers.ValidationError('Para modalidade arrendamento, informe "days" e "daily_rate".')
        else:
            raise serializers.ValidationError('Modalidade inválida.')

        expense_value = data.get('expense_value')
        if expense_value is not None and float(expense_value) < 0:
            raise serializers.ValidationError('O valor de gastos não pode ser negativo.')

        base_expense_value = data.get('base_expense_value')
        if base_expense_value is not None and float(base_expense_value) < 0:
            raise serializers.ValidationError('O valor base de gastos não pode ser negativo.')

        fuel_expense_value = data.get('fuel_expense_value')
        if fuel_expense_value is not None and float(fuel_expense_value) < 0:
            raise serializers.ValidationError('O valor de combustível não pode ser negativo.')

        initial_km = data.get('initial_km', getattr(self.instance, 'initial_km', None))
        final_km = data.get('final_km', getattr(self.instance, 'final_km', None))
        if initial_km is not None and int(initial_km) < 0:
            raise serializers.ValidationError('A quilometragem inicial não pode ser negativa.')
        if final_km is not None and int(final_km) < 0:
            raise serializers.ValidationError('A quilometragem final não pode ser negativa.')
        if initial_km is not None and final_km is not None and int(final_km) < int(initial_km):
            raise serializers.ValidationError('A quilometragem final deve ser maior ou igual à inicial.')

        status = data.get('status', getattr(self.instance, 'status', None))
        final_km_for_status = data.get('final_km', getattr(self.instance, 'final_km', None))
        if status == 'completed' and final_km_for_status is None:
            raise serializers.ValidationError('Para encerrar a viagem, informe a quilometragem final.')

        start_date = data.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = data.get('end_date', getattr(self.instance, 'end_date', None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError('A data final deve ser maior ou igual à data inicial.')
        return data

    def _get_transport_settings(self, tenant):
        defaults = {
            'TIPO_RECEBIMENTO_MOTORISTA': '1',
            'PORCENTAGEM_MOTORISTA': '10',
            'TIPO_PORCENTAGEM': 'bruta',
        }
        values = {
            p.key: p.value
            for p in TenantParameter.objects.filter(
                tenant=tenant,
                module=TenantParameter.MODULE_TRANSPORT,
                key__in=list(defaults.keys())
            )
        }
        defaults.update(values)
        return defaults

    def _to_decimal(self, value):
        if value is None or value == '':
            return Decimal('0')
        # aceitar vírgula como separador decimal vindo do frontend (ex: '4,5')
        try:
            s = str(value).strip()
            s = s.replace(',', '.')
            return Decimal(s)
        except Exception:
            return Decimal('0')

    def _compute_values(self, validated_data, instance=None):
        modality = validated_data.get('modality', getattr(instance, 'modality', None))
        if modality == 'per_ton':
            tons = self._to_decimal(validated_data.get('tons', getattr(instance, 'tons', 0)))
            rate = self._to_decimal(validated_data.get('rate_per_ton', getattr(instance, 'rate_per_ton', 0)))
            total_value = tons * rate
        else:
            days = self._to_decimal(validated_data.get('days', getattr(instance, 'days', 0)))
            daily = self._to_decimal(validated_data.get('daily_rate', getattr(instance, 'daily_rate', 0)))
            total_value = days * daily

        vehicle = validated_data.get('vehicle') or getattr(instance, 'vehicle', None)
        tenant = getattr(vehicle, 'tenant', None)
        settings = self._get_transport_settings(tenant)

        tipo_receb = str(settings.get('TIPO_RECEBIMENTO_MOTORISTA', '1'))
        base_expense = self._to_decimal(
            validated_data.get(
                'base_expense_value',
                validated_data.get('expense_value', getattr(instance, 'base_expense_value', 0))
            )
        )
        fuel_expense = self._to_decimal(
            validated_data.get('fuel_expense_value', getattr(instance, 'fuel_expense_value', 0))
        )

        if tipo_receb == '1':
            driver_payment = self._to_decimal(
                validated_data.get('driver_payment', getattr(instance, 'driver_payment', 0))
            )
        else:
            pct = self._to_decimal(settings.get('PORCENTAGEM_MOTORISTA', '0'))
            tipo_pct = str(settings.get('TIPO_PORCENTAGEM', 'bruta')).lower()
            if tipo_pct == 'liquida':
                base_calc = total_value - (base_expense + fuel_expense)
                if base_calc < 0:
                    base_calc = Decimal('0')
            else:
                base_calc = total_value
            driver_payment = (base_calc * pct) / Decimal('100')

        # se motorista é dono, zera pagamento ao motorista
        driver_is_owner = bool(validated_data.get('driver_is_owner', getattr(instance, 'driver_is_owner', False)))
        if driver_is_owner:
            driver_payment = Decimal('0')

        expense_total = base_expense + fuel_expense + driver_payment

        # calcular consumo se informado litros e km
        try:
            initial_km = validated_data.get('initial_km', getattr(instance, 'initial_km', None))
            final_km = validated_data.get('final_km', getattr(instance, 'final_km', None))
            fuel_liters = self._to_decimal(validated_data.get('fuel_liters', getattr(instance, 'fuel_liters', None)))
            if initial_km is not None and final_km is not None and fuel_liters and fuel_liters > 0:
                distance = Decimal(int(final_km) - int(initial_km))
                consumption = distance / fuel_liters
                validated_data['consumption_km_per_liter'] = consumption
            else:
                # não sobrescrever se não há dados completos
                validated_data['consumption_km_per_liter'] = getattr(instance, 'consumption_km_per_liter', None)
        except Exception:
            validated_data['consumption_km_per_liter'] = getattr(instance, 'consumption_km_per_liter', None)

        validated_data['total_value'] = total_value
        validated_data['base_expense_value'] = base_expense
        validated_data['fuel_expense_value'] = fuel_expense
        validated_data['driver_payment'] = driver_payment
        validated_data['expense_value'] = expense_total

    def create(self, validated_data):
        if validated_data.get('start_date') and not validated_data.get('date'):
            validated_data['date'] = validated_data['start_date']
        if validated_data.get('date') and not validated_data.get('start_date'):
            validated_data['start_date'] = validated_data['date']
        self._compute_values(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get('start_date') and not validated_data.get('date'):
            validated_data['date'] = validated_data['start_date']
        self._compute_values(validated_data, instance=instance)
        return super().update(instance, validated_data)


class TripMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripMovement
        fields = ['id', 'trip', 'date', 'movement_type', 'expense_category', 'amount', 'description', 'created_at']
        read_only_fields = ['id', 'created_at', 'trip']

    def validate(self, data):
        movement_type = data.get('movement_type', getattr(self.instance, 'movement_type', None))
        expense_category = data.get('expense_category', getattr(self.instance, 'expense_category', ''))
        description = data.get('description', getattr(self.instance, 'description', ''))

        if movement_type == 'expense' and not expense_category:
            raise serializers.ValidationError({'expense_category': 'Informe a categoria do gasto.'})

        if movement_type == 'revenue':
            data['expense_category'] = ''

        if movement_type == 'expense' and expense_category == 'fuel':
            data['description'] = (description or '').strip()
        elif not (description or '').strip():
            raise serializers.ValidationError({'description': 'Informe a descrição deste lançamento.'})

        return data


class TireInventorySerializer(serializers.ModelSerializer):
    total_km_run = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TireInventory
        fields = [
            'id', 'tenant', 'brand', 'serial_number', 'purchase_date', 'status', 'condition',
            'total_km_run', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

    def get_total_km_run(self, obj):
        placements = obj.placements.select_related('vehicle').all()
        total = 0
        for placement in placements:
            start = int(placement.current_km_at_installation or 0)
            if placement.removal_km is not None:
                end = int(placement.removal_km)
            else:
                end = int(placement.vehicle.current_km or start)
            total += max(0, end - start)
        return total


class VehicleTirePlacementSerializer(serializers.ModelSerializer):
    tire_brand = serializers.CharField(source='tire.brand', read_only=True)
    tire_serial_number = serializers.CharField(source='tire.serial_number', read_only=True)

    class Meta:
        model = VehicleTirePlacement
        fields = [
            'id', 'tenant', 'vehicle', 'tire', 'tire_brand', 'tire_serial_number',
            'installation_date', 'removal_date', 'removal_km', 'axle_number', 'side', 'position',
            'current_km_at_installation', 'created_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_at']

    def validate(self, attrs):
        side = attrs.get('side', getattr(self.instance, 'side', None))
        position = attrs.get('position', getattr(self.instance, 'position', None))
        if side not in {VehicleTirePlacement.SIDE_LEFT, VehicleTirePlacement.SIDE_RIGHT}:
            raise serializers.ValidationError({'side': 'Lado inválido.'})
        if position not in {VehicleTirePlacement.POSITION_INSIDE, VehicleTirePlacement.POSITION_OUTSIDE}:
            raise serializers.ValidationError({'position': 'Posição inválida.'})
        return attrs


class OilChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = OilChangeLog
        fields = [
            'id', 'tenant', 'maintenance', 'oil_brand', 'quantity_liters', 'type',
            'next_change_km_interval', 'next_change_date_interval', 'created_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_at']


class MaintenanceLogSerializer(serializers.ModelSerializer):
    oil_change = OilChangeLogSerializer(required=False, allow_null=True)

    class Meta:
        model = MaintenanceLog
        fields = [
            'id', 'tenant', 'vehicle', 'date', 'odometer_at_maintenance',
            'description', 'created_at', 'oil_change'
        ]
        read_only_fields = ['id', 'tenant', 'created_at']

    def create(self, validated_data):
        oil_payload = validated_data.pop('oil_change', None)
        maintenance = super().create(validated_data)
        if oil_payload:
            OilChangeLog.objects.create(tenant=maintenance.tenant, maintenance=maintenance, **oil_payload)
        return maintenance

    def update(self, instance, validated_data):
        oil_payload = validated_data.pop('oil_change', None)
        maintenance = super().update(instance, validated_data)
        if oil_payload is not None:
            if hasattr(maintenance, 'oil_change'):
                for key, value in oil_payload.items():
                    setattr(maintenance.oil_change, key, value)
                maintenance.oil_change.save()
            else:
                OilChangeLog.objects.create(tenant=maintenance.tenant, maintenance=maintenance, **oil_payload)
        return maintenance


class MaintenanceAlertSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source='vehicle.plate', read_only=True)
    vehicle_model = serializers.CharField(source='vehicle.model', read_only=True)

    class Meta:
        model = MaintenanceAlert
        fields = [
            'id', 'tenant', 'vehicle', 'vehicle_plate', 'vehicle_model', 'level',
            'title', 'message', 'is_read', 'alert_date', 'created_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_at']
