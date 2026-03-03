from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    message = 'Você não tem permissão de administrador da plataforma.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(
            user
            and user.is_authenticated
            and (
                getattr(user, 'is_platform_admin', False)
                or getattr(user, 'is_superuser', False)
            )
        )


class IsTenantAdminOrManager(BasePermission):
    message = 'Você não tem permissão para alterar configurações deste tenant.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(
            user
            and user.is_authenticated
            and getattr(user, 'role', None) in ['admin', 'manager']
        )
