from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
import uuid


class Tenant(models.Model):
    """
    Modelo para representar um Tenant (Empresa/Organização).
    Cada tenant é um isolamento lógico de dados no sistema.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name=_('Nome do Tenant'))
    slug = models.SlugField(unique=True, verbose_name=_('Slug'))
    description = models.TextField(blank=True, verbose_name=_('Descrição'))
    
    # Informações da empresa
    cnpj = models.CharField(max_length=18, blank=True, verbose_name=_('CNPJ'))
    email = models.EmailField(verbose_name=_('Email'))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Telefone'))
    
    # Configurações
    is_active = models.BooleanField(default=True, verbose_name=_('Ativo'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Criado em'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Atualizado em'))
    # Módulos ativados para este tenant (feature flags)
    has_module_investments = models.BooleanField(default=False, verbose_name=_('Módulo Investimentos'))
    has_module_transport = models.BooleanField(default=False, verbose_name=_('Módulo Transportadora'))
    
    class Meta:
        verbose_name = _('Tenant')
        verbose_name_plural = _('Tenants')
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name


class User(AbstractUser):
    """
    Modelo customizado de usuário estendendo AbstractUser.
    Cada usuário pertence a um tenant específico.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='users',
        verbose_name=_('Tenant')
    )
    
    # Informações adicionais
    ROLE_ADMIN = 'admin'
    ROLE_MANAGER = 'manager'
    ROLE_OPERATOR = 'operator'
    ROLE_CHOICES = (
        (ROLE_ADMIN, _('Admin')),
        (ROLE_MANAGER, _('Gerente')),
        (ROLE_OPERATOR, _('Operador')),
    )

    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Telefone'))
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name=_('Avatar'))
    bio = models.TextField(blank=True, verbose_name=_('Biografia'))
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_OPERATOR, verbose_name=_('Papel'))
    
    # Configurações
    is_verified = models.BooleanField(default=False, verbose_name=_('Email Verificado'))
    is_platform_admin = models.BooleanField(default=False, verbose_name=_('Admin da Plataforma'))
    preferred_currency = models.CharField(
        max_length=3,
        default='BRL',
        verbose_name=_('Moeda Preferida')
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Criado em'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Atualizado em'))
    
    class Meta:
        verbose_name = _('Usuário')
        verbose_name_plural = _('Usuários')
        ordering = ['-created_at']
        unique_together = ('email', 'tenant')
    
    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.tenant.name})"
    
    def save(self, *args, **kwargs):
        """Garante que o username seja único por tenant"""
        if not self.username:
            self.username = self.email.split('@')[0]
        super().save(*args, **kwargs)

    @property
    def is_tenant_admin(self):
        return self.role == self.ROLE_ADMIN


class TenantParameter(models.Model):
    MODULE_GENERAL = 'general'
    MODULE_FINANCE = 'finance'
    MODULE_TRANSPORT = 'transport'
    MODULE_INVESTMENTS = 'investments'
    MODULE_CHOICES = (
        (MODULE_GENERAL, _('Geral')),
        (MODULE_FINANCE, _('Finanças')),
        (MODULE_TRANSPORT, _('Transportadora')),
        (MODULE_INVESTMENTS, _('Investimentos')),
    )

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='parameters')
    module = models.CharField(max_length=32, choices=MODULE_CHOICES)
    key = models.CharField(max_length=100)
    value = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Parâmetro do Tenant')
        verbose_name_plural = _('Parâmetros do Tenant')
        unique_together = ('tenant', 'module', 'key')
        ordering = ['module', 'key']

    def __str__(self):
        return f"{self.tenant.slug} | {self.module} | {self.key}={self.value}"


class TenantAuditLog(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=100, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Log de Auditoria')
        verbose_name_plural = _('Logs de Auditoria')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.tenant.slug} | {self.action} | {self.entity_type}:{self.entity_id}"
