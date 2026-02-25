from django.utils.deprecation import MiddlewareMixin
from accounts.models import Tenant
import threading

# Thread-local storage para armazenar o tenant atual
_thread_locals = threading.local()


def get_current_tenant():
    """Retorna o tenant atual da thread"""
    return getattr(_thread_locals, 'tenant', None)


def set_current_tenant(tenant):
    """Define o tenant atual da thread"""
    _thread_locals.tenant = tenant


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware para capturar e definir o tenant atual baseado no header ou domínio.
    Garante o isolamento de dados entre tenants.
    """
    
    def process_request(self, request):
        """
        Processa a requisição e define o tenant atual.
        
        Estratégias:
        1. Header 'X-Tenant-ID' (para APIs)
        2. Subdomínio (ex: tenant1.example.com)
        3. Usuário autenticado (se existir)
        """
        tenant = None
        
        # 1. Verificar header X-Tenant-ID
        tenant_id = request.META.get('HTTP_X_TENANT_ID')
        if tenant_id:
            try:
                tenant = Tenant.objects.get(id=tenant_id, is_active=True)
            except Tenant.DoesNotExist:
                pass
        
        # 2. Verificar subdomínio
        if not tenant:
            host = request.get_host().split(':')[0]  # Remove porta se existir
            parts = host.split('.')
            if len(parts) > 2:  # Tem subdomínio
                subdomain = parts[0]
                try:
                    tenant = Tenant.objects.get(slug=subdomain, is_active=True)
                except Tenant.DoesNotExist:
                    pass
        
        # 3. Verificar usuário autenticado
        if not tenant and request.user.is_authenticated:
            tenant = request.user.tenant
        
        # Definir o tenant na thread
        set_current_tenant(tenant)
        request.tenant = tenant
        
        return None
    
    def process_response(self, request, response):
        """Limpa o tenant após a resposta"""
        set_current_tenant(None)
        return response
