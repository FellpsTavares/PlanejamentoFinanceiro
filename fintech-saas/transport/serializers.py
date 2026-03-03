from rest_framework import serializers
from decimal import Decimal
from .models import Vehicle, FuelLog, TransportRevenue, TransportExpense
from .models import Trip
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

    class Meta:
        model = Vehicle
        fields = ['id', 'tenant', 'plate', 'model', 'year', 'capacity', 'avg_consumption']
        read_only_fields = ['avg_consumption', 'tenant']

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
    class Meta:
        model = Trip
        fields = [
            'id', 'vehicle', 'date', 'modality', 'tons', 'rate_per_ton',
            'days', 'daily_rate', 'total_value', 'is_received',
            'base_expense_value', 'fuel_expense_value', 'initial_km', 'final_km',
            'driver_payment', 'expense_value', 'description'
        ]
        read_only_fields = ['total_value']

    def validate(self, data):
        modality = data.get('modality')
        if modality == 'per_ton':
            if data.get('tons') is None or data.get('rate_per_ton') is None:
                raise serializers.ValidationError('Para modalidade por tonelada, informe "tons" e "rate_per_ton".')
        elif modality == 'lease':
            if data.get('days') is None or data.get('daily_rate') is None:
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

        initial_km = data.get('initial_km')
        final_km = data.get('final_km')
        if initial_km is not None and int(initial_km) < 0:
            raise serializers.ValidationError('A quilometragem inicial não pode ser negativa.')
        if final_km is not None and int(final_km) < 0:
            raise serializers.ValidationError('A quilometragem final não pode ser negativa.')
        if initial_km is not None and final_km is not None and int(final_km) < int(initial_km):
            raise serializers.ValidationError('A quilometragem final deve ser maior ou igual à inicial.')
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
        return Decimal(str(value))

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

        expense_total = base_expense + fuel_expense + driver_payment

        validated_data['total_value'] = total_value
        validated_data['base_expense_value'] = base_expense
        validated_data['fuel_expense_value'] = fuel_expense
        validated_data['driver_payment'] = driver_payment
        validated_data['expense_value'] = expense_total

    def create(self, validated_data):
        self._compute_values(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._compute_values(validated_data, instance=instance)
        return super().update(instance, validated_data)
