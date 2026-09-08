from django.db import migrations


DEFAULT_EXPENSE_CATEGORIES = [
    {'name': 'Combustível', 'system_key': 'fuel', 'icon': '⛽', 'color': '#F59E0B'},
    {'name': 'Outros Gastos', 'system_key': 'other', 'icon': '💰', 'color': '#6B7280'},
    {'name': 'Salário/Comissão', 'system_key': 'salary', 'icon': '🧑‍✈️', 'color': '#10B981'},
]


def create_default_categories(apps, schema_editor):
    """
    Backfill para tenants criados antes da funcionalidade de categorias padrão do
    módulo de transporte existir (a semeadura automática só roda na criação de um
    tenant novo, via signal). Sem isso, a tela "Gerenciar Viagens" desses tenants
    fica sem categoria nenhuma para lançar movimentações.
    """
    Tenant = apps.get_model('accounts', 'Tenant')
    Category = apps.get_model('finance', 'Category')

    for tenant in Tenant.objects.all():
        for item in DEFAULT_EXPENSE_CATEGORIES:
            if Category.objects.filter(tenant=tenant, type='expense', system_key=item['system_key']).exists():
                continue

            # unique_together (tenant, name, type): se o tenant já tem uma
            # categoria com esse nome exato (criada manualmente antes dessa
            # funcionalidade existir), adota-a em vez de tentar duplicar.
            existing = Category.objects.filter(tenant=tenant, type='expense', name=item['name']).first()
            if existing:
                if not existing.system_key:
                    existing.system_key = item['system_key']
                    existing.save(update_fields=['system_key'])
                continue

            Category.objects.create(
                tenant=tenant,
                name=item['name'],
                type='expense',
                icon=item['icon'],
                color=item['color'],
                system_key=item['system_key'],
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_category_default_amount_and_more'),
    ]

    operations = [
        migrations.RunPython(create_default_categories, noop_reverse),
    ]
