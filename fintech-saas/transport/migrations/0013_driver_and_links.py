import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_tenant_review_alert_settings'),
        ('transport', '0012_add_trip_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='Driver',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Nome')),
                ('start_date', models.DateField(verbose_name='Data de início')),
                ('end_date', models.DateField(blank=True, null=True, verbose_name='Data de saída')),
                ('age', models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Idade')),
                ('is_owner', models.BooleanField(default=False, verbose_name='É o dono')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='drivers',
                    to='accounts.tenant',
                )),
            ],
            options={
                'verbose_name': 'Motorista',
                'verbose_name_plural': 'Motoristas',
                'ordering': ['-start_date'],
            },
        ),
        migrations.AddField(
            model_name='vehicle',
            name='current_driver',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='vehicles',
                to='transport.driver',
                verbose_name='Motorista atual',
            ),
        ),
        migrations.AddField(
            model_name='trip',
            name='driver',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='trips',
                to='transport.driver',
                verbose_name='Motorista da viagem',
            ),
        ),
    ]
