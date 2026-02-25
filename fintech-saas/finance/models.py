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


class Transaction(models.Model):
    """
    Modelo para transações financeiras.
    Cada transação pertence a um usuário e tenant específicos.
    """
    TRANSACTION_TYPE_CHOICES = [
        ('income', _('Receita')),
        ('expense', _('Despesa')),
    ]
    
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
