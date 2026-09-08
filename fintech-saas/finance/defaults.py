from finance.models import Category, PaymentMethod


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


# As 3 categorias padrão de despesa usadas pelo módulo de transporte (lançamentos de
# viagem). `system_key` identifica cada uma para o restante do código (ex.: mapear
# o lançamento de pagamento ao motorista para o bucket de agregação correto),
# independente do nome, que o usuário pode renomear livremente em Configurações.
DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "Combustível", "system_key": Category.SYSTEM_KEY_FUEL, "icon": "⛽", "color": "#F59E0B"},
    {"name": "Outros Gastos", "system_key": Category.SYSTEM_KEY_OTHER, "icon": "💰", "color": "#6B7280"},
    {"name": "Salário/Comissão", "system_key": Category.SYSTEM_KEY_SALARY, "icon": "🧑‍✈️", "color": "#10B981"},
]


def ensure_default_categories(tenant):
    """
    Garante que o tenant tenha as categorias padrão de despesa (Combustível,
    Outros Gastos, Salário/Comissão) usadas pelo módulo de transporte.
    Chamada tanto na criação do tenant quanto de forma defensiva sempre que o
    módulo de transporte precisa resolver uma dessas categorias, para tenants
    já existentes que ainda não as têm.
    """
    created = {}
    for item in DEFAULT_EXPENSE_CATEGORIES:
        category = Category.objects.filter(
            tenant=tenant,
            type='expense',
            system_key=item['system_key'],
        ).first()
        if not category:
            # Category tem unique_together (tenant, name, type): se o tenant já
            # tinha uma categoria com esse nome exato (criada manualmente antes
            # dessa funcionalidade existir, ex.: em tenants antigos), não dá pra
            # criar outra igual — adotamos a existente como a categoria padrão do
            # sistema em vez de duplicar/quebrar com erro de integridade.
            category = Category.objects.filter(
                tenant=tenant,
                type='expense',
                name=item['name'],
            ).first()
            if category:
                if not category.system_key:
                    category.system_key = item['system_key']
                    category.save(update_fields=['system_key'])
            else:
                category = Category.objects.create(
                    tenant=tenant,
                    name=item['name'],
                    type='expense',
                    icon=item['icon'],
                    color=item['color'],
                    system_key=item['system_key'],
                )
        created[item['system_key']] = category
    return created


def ensure_default_category(tenant, system_key):
    """Garante (e retorna) uma única categoria padrão pelo system_key, criando-a
    (e as demais categorias padrão) caso ainda não exista para o tenant."""
    category = Category.objects.filter(tenant=tenant, type='expense', system_key=system_key).first()
    if category:
        return category
    return ensure_default_categories(tenant)[system_key]
