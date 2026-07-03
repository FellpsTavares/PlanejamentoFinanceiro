# Estende FuelLog (Abastecimento) com tenant, tipo de combustível, preço por litro,
# desconto e renomeia total_value -> paid_value, para expor o modelo via API.

import django.db.models.deletion
import django.utils.timezone
from decimal import Decimal
from django.db import migrations, models


def backfill_tenant(apps, schema_editor):
    FuelLog = apps.get_model('transport', 'FuelLog')
    for log in FuelLog.objects.select_related('vehicle').filter(tenant__isnull=True):
        log.tenant_id = log.vehicle.tenant_id
        log.save(update_fields=['tenant'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_user_must_change_password'),
        ('transport', '0017_tripmovement_is_auto_generated'),
    ]

    operations = [
        migrations.AddField(
            model_name='fuellog',
            name='tenant',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='fuel_logs',
                to='accounts.tenant',
            ),
        ),
        migrations.RunPython(backfill_tenant, noop_reverse),
        migrations.AlterField(
            model_name='fuellog',
            name='tenant',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='fuel_logs',
                to='accounts.tenant',
            ),
        ),
        migrations.AddField(
            model_name='fuellog',
            name='fuel_type',
            field=models.CharField(
                choices=[('diesel', 'Diesel'), ('arla', 'Arla')],
                default='diesel',
                max_length=20,
                verbose_name='Tipo de combustível',
            ),
        ),
        migrations.AddField(
            model_name='fuellog',
            name='price_per_liter',
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=12, null=True, verbose_name='Valor por litro'),
        ),
        migrations.AddField(
            model_name='fuellog',
            name='discount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, verbose_name='Desconto'),
        ),
        migrations.RenameField(
            model_name='fuellog',
            old_name='total_value',
            new_name='paid_value',
        ),
        migrations.AlterField(
            model_name='fuellog',
            name='paid_value',
            field=models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Valor pago'),
        ),
        migrations.AddField(
            model_name='fuellog',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
