from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0009_vehicle_review_tires_maintenance_alerts'),
    ]

    operations = [
        migrations.AddField(
            model_name='tireinventory',
            name='condition',
            field=models.CharField(
                choices=[('good', 'Bom'), ('medium', 'Médio'), ('bad', 'Ruim')],
                default='good',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='vehicletireplacement',
            name='position',
            field=models.CharField(
                choices=[('inside', 'Dentro'), ('outside', 'Fora')],
                default='outside',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='vehicletireplacement',
            name='removal_km',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
