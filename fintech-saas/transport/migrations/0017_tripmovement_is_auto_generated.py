# Generated manually to fix sync_expense_movements bug

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0016_trip_expense_items'),
    ]

    operations = [
        migrations.AddField(
            model_name='tripmovement',
            name='is_auto_generated',
            field=models.BooleanField(default=False, help_text='Indica se esta movimentação foi criada automaticamente pelo sistema'),
        ),
    ]
