from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0010_tire_condition_and_placement_position'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicle',
            name='is_dual_wheel',
            field=models.BooleanField(default=False, verbose_name='Rodagem dupla'),
        ),
    ]
