from .models import TenantAuditLog


def log_tenant_action(*, tenant, user, action, entity_type, entity_id='', details=None):
    if not tenant:
        return None
    return TenantAuditLog.objects.create(
        tenant=tenant,
        user=user if getattr(user, 'is_authenticated', False) else None,
        action=str(action or '').strip()[:100],
        entity_type=str(entity_type or '').strip()[:50],
        entity_id=str(entity_id or '').strip()[:100],
        details=details or {},
    )
