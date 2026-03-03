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
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Telefone'))
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name=_('Avatar'))
    bio = models.TextField(blank=True, verbose_name=_('Biografia'))
    
    # Configurações
    is_verified = models.BooleanField(default=False, verbose_name=_('Email Verificado'))
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
