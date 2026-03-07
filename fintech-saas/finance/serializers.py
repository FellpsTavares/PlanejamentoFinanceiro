from rest_framework import serializers
from .models import Category, Transaction, RecurringTransaction, Investment, PaymentMethod, CreditCardInvoice
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
    payment_method_name = serializers.CharField(source='payment_method.name', read_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'description', 'amount', 'type', 'category', 'category_name',
            'payment_method', 'payment_method_name', 'credit_card_invoice',
            'transaction_date', 'due_date', 'status', 'affects_balance', 'notes', 'is_recurring',
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
    payment_method_name = serializers.CharField(source='payment_method.name', read_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'description', 'amount', 'type', 'category', 'category_name',
            'category_color', 'category_icon', 'payment_method', 'payment_method_name',
            'credit_card_invoice', 'transaction_date', 'status', 'affects_balance',
            'created_at'
        ]


class TransactionCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criar/atualizar transações"""
    
    class Meta:
        model = Transaction
        fields = [
            'description', 'amount', 'type', 'category', 'transaction_date',
            'due_date', 'status', 'payment_method', 'affects_balance', 'notes', 'is_recurring', 'recurrence_type',
            'recurring', 'current_installment'
        ]
    
    def validate_amount(self, value):
        """Valida se o valor é positivo"""
        if value <= 0:
            raise serializers.ValidationError('O valor deve ser maior que zero.')
        return value


class TransactionSummarySerializer(serializers.Serializer):
    """Serializer para resumo de transações (Painel)"""
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
        fields = [
            'id', 'description', 'amount', 'type', 'category', 'frequency',
            'installments_count', 'start_date', 'end_date', 'due_day', 'is_fixed_monthly'
        ]

    def validate(self, attrs):
        is_fixed = attrs.get('is_fixed_monthly', False)
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        due_day = attrs.get('due_day')

        if is_fixed:
            if not end_date:
                raise serializers.ValidationError({'end_date': 'Informe a data final da dívida fixa mensal.'})
            if due_day is None:
                raise serializers.ValidationError({'due_day': 'Informe o dia de vencimento.'})
            if int(due_day) < 1 or int(due_day) > 31:
                raise serializers.ValidationError({'due_day': 'O dia de vencimento deve ser entre 1 e 31.'})
            if start_date and end_date and end_date < start_date:
                raise serializers.ValidationError({'end_date': 'A data final deve ser maior ou igual à inicial.'})
            attrs['frequency'] = 'monthly'

        return attrs


class InvestmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investment
        fields = ['id', 'ticker', 'buy_price', 'quantity', 'buy_date']
        read_only_fields = ['id']


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'name', 'type', 'due_day', 'closing_day', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        method_type = attrs.get('type', getattr(self.instance, 'type', None))
        due_day = attrs.get('due_day', getattr(self.instance, 'due_day', None))
        closing_day = attrs.get('closing_day', getattr(self.instance, 'closing_day', None))

        if method_type == 'credit_card' and due_day is None:
            raise serializers.ValidationError({'due_day': 'Informe o dia de vencimento do cartão.'})

        if due_day is not None and (int(due_day) < 1 or int(due_day) > 31):
            raise serializers.ValidationError({'due_day': 'O dia de vencimento deve ser entre 1 e 31.'})
        if closing_day is not None and (int(closing_day) < 1 or int(closing_day) > 31):
            raise serializers.ValidationError({'closing_day': 'O dia de fechamento deve ser entre 1 e 31.'})

        return attrs


class CreditCardInvoiceSerializer(serializers.ModelSerializer):
    payment_method_name = serializers.CharField(source='payment_method.name', read_only=True)

    class Meta:
        model = CreditCardInvoice
        fields = [
            'id', 'payment_method', 'payment_method_name', 'reference_month',
            'due_date', 'total_amount', 'status', 'paid_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_amount', 'created_at', 'updated_at']
