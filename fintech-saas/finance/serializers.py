from rest_framework import serializers
from .models import Category, Transaction, RecurringTransaction, Investment
from accounts.models import User


class CategorySerializer(serializers.ModelSerializer):
    """Serializer para Category"""
    
    class Meta:
        model = Category
        fields = [
            'id', 'name', 'description', 'type', 'color', 'icon',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        # tenant deve ser atribuído pela view (segurança)
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['tenant'] = request.user.tenant
        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    """Serializer para Transaction"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'description', 'amount', 'type', 'category', 'category_name',
            'transaction_date', 'due_date', 'status', 'notes', 'is_recurring',
            'recurrence_type', 'user_name', 'created_at', 'updated_at',
            'recurring', 'current_installment'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_amount(self, value):
        """Valida se o valor é positivo"""
        if value <= 0:
            raise serializers.ValidationError('O valor deve ser maior que zero.')
        return value
    
    def validate(self, data):
        """Valida dados da transação"""
        # Se é recorrente, deve ter um tipo de recorrência
        if data.get('is_recurring') and not data.get('recurrence_type'):
            raise serializers.ValidationError({
                'recurrence_type': 'Tipo de recorrência é obrigatório para transações recorrentes.'
            })
        
        return data


class TransactionListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de transações"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_color = serializers.CharField(source='category.color', read_only=True)
    category_icon = serializers.CharField(source='category.icon', read_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'description', 'amount', 'type', 'category', 'category_name',
            'category_color', 'category_icon', 'transaction_date', 'status',
            'created_at'
        ]


class TransactionCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criar/atualizar transações"""
    
    class Meta:
        model = Transaction
        fields = [
            'description', 'amount', 'type', 'category', 'transaction_date',
            'due_date', 'status', 'notes', 'is_recurring', 'recurrence_type',
            'recurring', 'current_installment'
        ]
    
    def validate_amount(self, value):
        """Valida se o valor é positivo"""
        if value <= 0:
            raise serializers.ValidationError('O valor deve ser maior que zero.')
        return value


class TransactionSummarySerializer(serializers.Serializer):
    """Serializer para resumo de transações (Dashboard)"""
    total_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=12, decimal_places=2)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    transaction_count = serializers.IntegerField()
    
    # Por categoria
    by_category = serializers.ListField(
        child=serializers.DictField()
    )
    
    # Por mês
    by_month = serializers.ListField(
        child=serializers.DictField()
    )


class RecurringTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringTransaction
        fields = ['id', 'description', 'amount', 'type', 'category', 'frequency', 'installments_count', 'start_date']


class InvestmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investment
        fields = ['id', 'ticker', 'buy_price', 'quantity', 'buy_date']
        read_only_fields = ['id']
