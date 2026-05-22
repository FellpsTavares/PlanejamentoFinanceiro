# Generated manually for production safety
# This migration adds expense_items field to Trip model
# SAFE: Does not modify existing data, only adds new nullable field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0015_maintenance_fleet'),
    ]

    operations = [
        # Add expense_items field as JSONField
        # This field stores multiple expense items as array of objects:
        # [{"valor": 28.0, "descricao": "Balsa"}, {"valor": 149.0, "descricao": "concerto da lona"}]
        # 
        # COMPATIBILITY: 
        # - Old trips will continue using base_expense_value (single total)
        # - New trips from chat will use expense_items (individual items)
        # - sync_expense_movements() handles both cases
        migrations.AddField(
            model_name='trip',
            name='expense_items',
            field=models.JSONField(
                blank=True,
                null=True,
                default=list,
                help_text='Lista de gastos individuais: [{"valor": float, "descricao": str}, ...]'
            ),
        ),
    ]
