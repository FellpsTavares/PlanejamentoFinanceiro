from rest_framework.permissions import BasePermission


class HasTransportModule(BasePermission):
    """Permissão customizada: permite acesso somente se o Tenant tiver o módulo Transport ativado."""

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        # Permite superusers/Staff
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_superuser', False):
            return True
        tenant = getattr(user, 'tenant', None)
        if not tenant:
            return False
        return getattr(tenant, 'has_module_transport', False)
