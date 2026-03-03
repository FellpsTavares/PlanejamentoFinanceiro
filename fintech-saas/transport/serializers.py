from rest_framework import serializers
from .models import Vehicle, FuelLog, TransportRevenue, TransportExpense
from .models import Trip


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
        fields = ['id', 'vehicle', 'date', 'modality', 'tons', 'rate_per_ton', 'days', 'daily_rate', 'total_value', 'is_received', 'expense_value', 'description']
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
        return data

    def create(self, validated_data):
        # calcular total_value conforme modalidade
        modality = validated_data.get('modality')
        if modality == 'per_ton':
            tons = validated_data.get('tons')
            rate = validated_data.get('rate_per_ton')
            validated_data['total_value'] = float(tons) * float(rate)
        else:
            days = validated_data.get('days')
            daily = validated_data.get('daily_rate')
            validated_data['total_value'] = int(days) * float(daily)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        modality = validated_data.get('modality', instance.modality)
        if modality == 'per_ton':
            tons = validated_data.get('tons', instance.tons)
            rate = validated_data.get('rate_per_ton', instance.rate_per_ton)
            validated_data['total_value'] = float(tons) * float(rate)
        else:
            days = validated_data.get('days', instance.days)
            daily = validated_data.get('daily_rate', instance.daily_rate)
            validated_data['total_value'] = int(days) * float(daily)
        return super().update(instance, validated_data)
