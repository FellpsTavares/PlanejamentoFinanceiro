from finance.models import PaymentMethod


DEFAULT_PAYMENT_METHODS = [
    {"name": "Dinheiro", "type": "cash"},
    {"name": "PIX", "type": "pix"},
]


def ensure_default_payment_methods(tenant):
    """Create default payment methods for a tenant when missing."""
    for item in DEFAULT_PAYMENT_METHODS:
        exists = PaymentMethod.objects.filter(
            tenant=tenant,
            type=item["type"],
        ).exists()
        if exists:
            continue

        PaymentMethod.objects.create(
            tenant=tenant,
            name=item["name"],
            type=item["type"],
            is_active=True,
        )
