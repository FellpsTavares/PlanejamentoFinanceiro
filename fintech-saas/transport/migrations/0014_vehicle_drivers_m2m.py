import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0013_driver_and_links'),
    ]

    operations = [
        # Remove o FK current_driver do Vehicle
        migrations.RemoveField(
            model_name='vehicle',
            name='current_driver',
        ),
        # Cria relação ManyToMany entre Vehicle e Driver
        migrations.AddField(
            model_name='vehicle',
            name='drivers',
            field=models.ManyToManyField(
                blank=True,
                related_name='vehicles',
                to='transport.driver',
                verbose_name='Motoristas vinculados',
            ),
        ),
    ]
