from django.db import models
from django.utils.translation import gettext_lazy as _
from accounts.models import Tenant, User
import uuid


class Category(models.Model):
    """
    Modelo para categorias de transações.
    Cada categoria pertence a um tenant específico.
    """
    TRANSACTION_TYPE_CHOICES = [
        ('income', _('Receita')),
        ('expense', _('Despesa')),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='categories',
        verbose_name=_('Tenant')
    )
    
    name = models.CharField(max_length=100, verbose_name=_('Nome'))
    description = models.TextField(blank=True, verbose_name=_('Descrição'))
    type = models.CharField(
        max_length=10,
        choices=TRANSACTION_TYPE_CHOICES,
        verbose_name=_('Tipo')
    )
    
    # Cor para visualização (hex)
    color = models.CharField(
        max_length=7,
        default='#3B82F6',
        verbose_name=_('Cor')
    )
    
    # Ícone (emoji ou nome do ícone)
    icon = models.CharField(
        max_length=50,
        default='💰',
        verbose_name=_('Ícone')
    )
    
    # Configurações
    is_active = models.BooleanField(default=True, verbose_name=_('Ativo'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Criado em'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Atualizado em'))
    
    class Meta:
        verbose_name = _('Categoria')
        verbose_name_plural = _('Categorias')
        ordering = ['name']
        unique_together = ('tenant', 'name', 'type')
    
    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"

# Choices globais para tipo de transação (reutilizado por Transaction e RecurringTransaction)
TRANSACTION_TYPE_CHOICES = [
    ('income', _('Receita')),
    ('expense', _('Despesa')),
]


class RecurringTransaction(models.Model):
    FREQUENCY_CHOICES = [
        ('monthly', _('Mensal')),
        ('biweekly', _('Quinzenal')),
        ('weekly', _('Semanal')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='recurrings')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recurrings')
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPE_CHOICES)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES)
    installments_count = models.PositiveIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    due_day = models.PositiveSmallIntegerField(null=True, blank=True)
    is_fixed_monthly = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Recurring Transaction')
        verbose_name_plural = _('Recurring Transactions')

    def __str__(self):
        return f"{self.description} ({self.frequency})"


class Investment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='investments')
    ticker = models.CharField(max_length=20)
    buy_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.DecimalField(max_digits=20, decimal_places=6)
    buy_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Investment')
        verbose_name_plural = _('Investments')

    def __str__(self):
        return f"{self.ticker} - {self.quantity}"


class PaymentMethod(models.Model):
    TYPE_CHOICES = [
        ('cash', _('Dinheiro')),
        ('pix', _('PIX')),
        ('debit_card', _('Cartão de Débito')),
        ('credit_card', _('Cartão de Crédito')),
        ('bank_transfer', _('Transferência')),
        ('other', _('Outros')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='payment_methods')
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='other')
    due_day = models.PositiveSmallIntegerField(null=True, blank=True)
    closing_day = models.PositiveSmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Forma de pagamento')
        verbose_name_plural = _('Formas de pagamento')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class CreditCardInvoice(models.Model):
    STATUS_CHOICES = [
        ('open', _('Aberta')),
        ('paid', _('Paga')),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='credit_card_invoices')
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.CASCADE, related_name='invoices')
    reference_month = models.DateField(verbose_name=_('Mês de referência'))
    due_date = models.DateField(verbose_name=_('Vencimento'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    paid_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Fatura de cartão')
        verbose_name_plural = _('Faturas de cartão')
        ordering = ['-reference_month', '-created_at']
        unique_together = ('tenant', 'payment_method', 'reference_month')

    def __str__(self):
        return f"{self.payment_method.name} - {self.reference_month.strftime('%m/%Y')}"


class Transaction(models.Model):
    """Modelo para transações financeiras. Cada transação pertence a um usuário e tenant específicos."""
    
    STATUS_CHOICES = [
        ('pending', _('Pendente')),
        ('completed', _('Concluída')),
        ('cancelled', _('Cancelada')),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name=_('Tenant')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name=_('Usuário')
    )
    
    # Informações da transação
    description = models.CharField(max_length=255, verbose_name=_('Descrição'))
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name=_('Valor')
    )
    type = models.CharField(
        max_length=10,
        choices=TRANSACTION_TYPE_CHOICES,
        verbose_name=_('Tipo')
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions',
        verbose_name=_('Categoria')
    )
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions',
        verbose_name=_('Forma de Pagamento')
    )
    credit_card_invoice = models.ForeignKey(
        CreditCardInvoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions',
        verbose_name=_('Fatura de Cartão')
    )
    
    # Datas
    transaction_date = models.DateField(verbose_name=_('Data da Transação'))
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('Data de Vencimento')
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='completed',
        verbose_name=_('Status')
    )
    affects_balance = models.BooleanField(default=True, verbose_name=_('Impacta Saldo'))
    
    # Notas
    notes = models.TextField(blank=True, verbose_name=_('Notas'))
    
    # Configurações
    is_recurring = models.BooleanField(default=False, verbose_name=_('Recorrente'))
    recurrence_type = models.CharField(
        max_length=20,
        choices=[
            ('daily', _('Diária')),
            ('weekly', _('Semanal')),
            ('monthly', _('Mensal')),
            ('yearly', _('Anual')),
        ],
        blank=True,
        verbose_name=_('Tipo de Recorrência')
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Criado em'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Atualizado em'))
    
    # Link para recorrência/parcelamento
    recurring = models.ForeignKey(RecurringTransaction, null=True, blank=True, on_delete=models.SET_NULL, related_name='transactions')
    current_installment = models.PositiveIntegerField(null=True, blank=True)
    
    class Meta:
        verbose_name = _('Transação')
        verbose_name_plural = _('Transações')
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['tenant', 'user', 'transaction_date']),
            models.Index(fields=['tenant', 'type', 'transaction_date']),
        ]
    
    def __str__(self):
        return f"{self.description} - R$ {self.amount} ({self.get_type_display()})"
