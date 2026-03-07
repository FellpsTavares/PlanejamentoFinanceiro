from django.db import migrations


def create_default_payment_methods(apps, schema_editor):
    Tenant = apps.get_model('accounts', 'Tenant')
    PaymentMethod = apps.get_model('finance', 'PaymentMethod')

    defaults = [
        {'name': 'Dinheiro', 'type': 'cash'},
        {'name': 'PIX', 'type': 'pix'},
    ]

    for tenant in Tenant.objects.all():
        for item in defaults:
            exists = PaymentMethod.objects.filter(
                tenant=tenant,
                type=item['type'],
            ).exists()
            if exists:
                continue

            PaymentMethod.objects.create(
                tenant=tenant,
                name=item['name'],
                type=item['type'],
                is_active=True,
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0003_recurringtransaction_due_day_and_more'),
    ]

    operations = [
        migrations.RunPython(create_default_payment_methods, noop_reverse),
    ]
