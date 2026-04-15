import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_user_must_change_password'),
        ('transport', '0014_vehicle_drivers_m2m'),
    ]

    operations = [
        # --- PreventivePlan ---
        migrations.CreateModel(
            name='PreventivePlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='preventive_plans',
                    to='accounts.tenant',
                    verbose_name='Empresa',
                )),
                ('vehicle', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='preventive_plans',
                    to='transport.vehicle',
                    verbose_name='Veículo',
                )),
                ('component_type', models.CharField(
                    choices=[
                        ('engine', 'Motor'),
                        ('cooling', 'Arrefecimento'),
                        ('transmission', 'Transmissão'),
                        ('lubrication', 'Lubrificação'),
                    ],
                    max_length=30,
                    verbose_name='Tipo de componente',
                )),
                ('intervention_type', models.CharField(
                    choices=[
                        ('oil_change', 'Troca de óleo'),
                        ('filter_change', 'Troca de filtro'),
                        ('belt_inspection', 'Inspeção de correia'),
                        ('coolant_change', 'Troca de fluido de arrefecimento'),
                        ('transmission_oil', 'Óleo de transmissão'),
                        ('differential_oil', 'Óleo de diferencial'),
                        ('greasing', 'Lubrificação/graxamento'),
                        ('injection_check', 'Verificação de injeção'),
                        ('timing_belt', 'Correia dentada'),
                        ('air_filter', 'Filtro de ar'),
                        ('fuel_filter', 'Filtro de combustível'),
                        ('spark_plug', 'Velas de ignição'),
                    ],
                    max_length=30,
                    verbose_name='Tipo de intervenção',
                )),
                ('trigger', models.CharField(
                    choices=[
                        ('km', 'Quilometragem'),
                        ('date', 'Data'),
                        ('both', 'Ambos'),
                    ],
                    default='both',
                    max_length=10,
                    verbose_name='Gatilho',
                )),
                ('trigger_km_interval', models.PositiveIntegerField(
                    blank=True,
                    null=True,
                    verbose_name='Intervalo (km)',
                )),
                ('trigger_date_interval', models.PositiveIntegerField(
                    blank=True,
                    null=True,
                    verbose_name='Intervalo (dias)',
                )),
                ('last_done_km', models.PositiveIntegerField(
                    blank=True,
                    null=True,
                    verbose_name='Última realização (km)',
                )),
                ('last_done_date', models.DateField(
                    blank=True,
                    null=True,
                    verbose_name='Última realização (data)',
                )),
                ('next_due_km', models.PositiveIntegerField(
                    blank=True,
                    null=True,
                    verbose_name='Próxima (km)',
                )),
                ('next_due_date', models.DateField(
                    blank=True,
                    null=True,
                    verbose_name='Próxima (data)',
                )),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pendente'),
                        ('done', 'Realizado'),
                        ('overdue', 'Vencido'),
                    ],
                    default='pending',
                    max_length=10,
                    verbose_name='Status',
                )),
                ('notes', models.TextField(blank=True, verbose_name='Observações')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Criado em')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
            ],
            options={
                'verbose_name': 'Plano preventivo',
                'verbose_name_plural': 'Planos preventivos',
                'ordering': ['next_due_date', 'next_due_km'],
            },
        ),

        # --- PredictiveReading ---
        migrations.CreateModel(
            name='PredictiveReading',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='predictive_readings',
                    to='accounts.tenant',
                    verbose_name='Empresa',
                )),
                ('vehicle', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='predictive_readings',
                    to='transport.vehicle',
                    verbose_name='Veículo',
                )),
                ('component_type', models.CharField(
                    choices=[
                        ('tires', 'Pneus'),
                        ('oil_analysis', 'Análise de óleo'),
                        ('brakes', 'Freios'),
                        ('battery', 'Bateria'),
                    ],
                    max_length=20,
                    verbose_name='Componente',
                )),
                ('metric_name', models.CharField(max_length=100, verbose_name='Métrica')),
                ('value', models.DecimalField(decimal_places=3, max_digits=12, verbose_name='Valor')),
                ('unit', models.CharField(max_length=30, verbose_name='Unidade')),
                ('read_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Leitura em')),
                ('alert_level', models.CharField(
                    choices=[
                        ('ok', 'OK'),
                        ('warning', 'Atenção'),
                        ('critical', 'Crítico'),
                    ],
                    default='ok',
                    max_length=10,
                    verbose_name='Nível de alerta',
                )),
                ('notes', models.TextField(blank=True, verbose_name='Observações')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Criado em')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
            ],
            options={
                'verbose_name': 'Leitura preditiva',
                'verbose_name_plural': 'Leituras preditivas',
                'ordering': ['-read_at'],
            },
        ),

        # --- CorrectiveMaintenance ---
        migrations.CreateModel(
            name='CorrectiveMaintenance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='corrective_maintenances',
                    to='accounts.tenant',
                    verbose_name='Empresa',
                )),
                ('vehicle', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='corrective_maintenances',
                    to='transport.vehicle',
                    verbose_name='Veículo',
                )),
                ('type', models.CharField(
                    choices=[
                        ('emergency', 'Emergencial'),
                        ('palliative', 'Paliativo'),
                    ],
                    default='emergency',
                    max_length=15,
                    verbose_name='Tipo',
                )),
                ('description', models.TextField(verbose_name='Descrição da falha')),
                ('occurred_at', models.DateTimeField(verbose_name='Ocorreu em')),
                ('repaired_at', models.DateTimeField(
                    blank=True,
                    null=True,
                    verbose_name='Reparado em',
                )),
                ('repair_cost', models.DecimalField(
                    decimal_places=2,
                    default=0,
                    max_digits=12,
                    verbose_name='Custo do reparo (R$)',
                )),
                ('supplier', models.CharField(blank=True, max_length=200, verbose_name='Fornecedor / Oficina')),
                ('notes', models.TextField(blank=True, verbose_name='Observações')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Criado em')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
            ],
            options={
                'verbose_name': 'Manutenção corretiva',
                'verbose_name_plural': 'Manutenções corretivas',
                'ordering': ['-occurred_at'],
            },
        ),

        # --- SafetyChecklist ---
        migrations.CreateModel(
            name='SafetyChecklist',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='safety_checklists',
                    to='accounts.tenant',
                    verbose_name='Empresa',
                )),
                ('vehicle', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='safety_checklists',
                    to='transport.vehicle',
                    verbose_name='Veículo',
                )),
                ('checklist_type', models.CharField(
                    choices=[
                        ('tachograph', 'Tacógrafo'),
                        ('lighting', 'Sistema de iluminação'),
                        ('extinguisher', 'Extintor'),
                        ('equipment', 'Equipamentos obrigatórios'),
                    ],
                    max_length=20,
                    verbose_name='Item verificado',
                )),
                ('checked_at', models.DateField(verbose_name='Data da verificação')),
                ('next_due_date', models.DateField(verbose_name='Próxima verificação')),
                ('status', models.CharField(
                    choices=[
                        ('ok', 'OK'),
                        ('pending', 'Pendente'),
                        ('expired', 'Vencido'),
                    ],
                    default='ok',
                    max_length=10,
                    verbose_name='Status',
                )),
                ('notes', models.TextField(blank=True, verbose_name='Observações')),
                ('checked_by', models.CharField(blank=True, max_length=200, verbose_name='Verificado por')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Criado em')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
            ],
            options={
                'verbose_name': 'Checklist de segurança',
                'verbose_name_plural': 'Checklists de segurança',
                'ordering': ['next_due_date'],
            },
        ),
    ]
