from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0011_vehicle_is_dual_wheel'),
    ]

    operations = [
        migrations.AddField(
            model_name='trip',
            name='fuel_liters',
            field=models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='consumption_km_per_liter',
            field=models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='driver_is_owner',
            field=models.BooleanField(default=False),
        ),
    ]
