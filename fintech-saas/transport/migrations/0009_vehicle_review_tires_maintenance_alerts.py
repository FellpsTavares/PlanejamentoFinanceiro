from datetime import date

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_tenant_review_alert_settings'),
        ('transport', '0008_tripmovement_description_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicle',
            name='initial_km',
            field=models.PositiveIntegerField(default=0, verbose_name='KM inicial do cadastro'),
        ),
        migrations.AddField(
            model_name='vehicle',
            name='next_review_date',
            field=models.DateField(blank=True, null=True, verbose_name='Próxima revisão (data)'),
        ),
        migrations.AddField(
            model_name='vehicle',
            name='next_review_km',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Próxima revisão (km)'),
        ),
        migrations.AddField(
            model_name='vehicle',
            name='number_of_axles',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Número de eixos'),
        ),
        migrations.CreateModel(
            name='MaintenanceLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('odometer_at_maintenance', models.PositiveIntegerField()),
                ('description', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='maintenance_logs', to='accounts.tenant')),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='maintenance_logs', to='transport.vehicle')),
            ],
            options={
                'verbose_name': 'Manutenção',
                'verbose_name_plural': 'Histórico de Manutenções',
                'ordering': ['-date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='TireInventory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('brand', models.CharField(max_length=120)),
                ('serial_number', models.CharField(blank=True, max_length=120)),
                ('purchase_date', models.DateField()),
                ('status', models.CharField(choices=[('stock', 'Estoque'), ('in_use', 'Em Uso'), ('discarded', 'Descartado')], default='stock', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tire_inventory', to='accounts.tenant')),
            ],
            options={
                'verbose_name': 'Pneu',
                'verbose_name_plural': 'Inventário de Pneus',
                'ordering': ['-purchase_date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='VehicleTirePlacement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('installation_date', models.DateField()),
                ('removal_date', models.DateField(blank=True, null=True)),
                ('axle_number', models.PositiveIntegerField()),
                ('side', models.CharField(choices=[('left', 'Esquerdo'), ('right', 'Direito')], max_length=10)),
                ('current_km_at_installation', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vehicle_tire_placements', to='accounts.tenant')),
                ('tire', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='placements', to='transport.tireinventory')),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tire_placements', to='transport.vehicle')),
            ],
            options={
                'verbose_name': 'Instalação de Pneu',
                'verbose_name_plural': 'Histórico de Instalações de Pneus',
                'ordering': ['-installation_date', '-id'],
            },
        ),
        migrations.CreateModel(
            name='OilChangeLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('oil_brand', models.CharField(max_length=120)),
                ('quantity_liters', models.DecimalField(decimal_places=2, max_digits=8)),
                ('type', models.CharField(choices=[('full_change', 'Troca completa'), ('top_up', 'Completar nível')], default='full_change', max_length=20)),
                ('next_change_km_interval', models.PositiveIntegerField(blank=True, null=True)),
                ('next_change_date_interval', models.PositiveIntegerField(blank=True, help_text='Intervalo em dias para próxima troca', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('maintenance', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='oil_change', to='transport.maintenancelog')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='oil_change_logs', to='accounts.tenant')),
            ],
            options={
                'verbose_name': 'Troca de Óleo',
                'verbose_name_plural': 'Trocas de Óleo',
                'ordering': ['-id'],
            },
        ),
        migrations.CreateModel(
            name='MaintenanceAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('level', models.CharField(choices=[('warning', 'Aviso'), ('critical', 'Crítico')], default='warning', max_length=20)),
                ('title', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('is_read', models.BooleanField(default=False)),
                ('alert_date', models.DateField(default=date.today)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='maintenance_alerts', to='accounts.tenant')),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='maintenance_alerts', to='transport.vehicle')),
            ],
            options={
                'verbose_name': 'Alerta de Manutenção',
                'verbose_name_plural': 'Alertas de Manutenção',
                'ordering': ['is_read', '-alert_date', '-id'],
            },
        ),
    ]
