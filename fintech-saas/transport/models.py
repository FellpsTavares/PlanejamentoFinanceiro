from datetime import date

from django.db import models
from django.db.models import Sum, F, IntegerField, ExpressionWrapper
from django.utils.translation import gettext_lazy as _


class Vehicle(models.Model):
    tenant = models.ForeignKey('accounts.Tenant', on_delete=models.CASCADE, related_name='vehicles')
    plate = models.CharField(max_length=20, verbose_name=_('Placa'))
    model = models.CharField(max_length=255, verbose_name=_('Modelo'))
    year = models.PositiveSmallIntegerField(verbose_name=_('Ano'))
    capacity = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_('Capacidade'))
    initial_km = models.PositiveIntegerField(default=0, verbose_name=_('KM inicial do cadastro'))
    is_dual_wheel = models.BooleanField(default=False, verbose_name=_('Rodagem dupla'))
    number_of_axles = models.PositiveIntegerField(null=True, blank=True, verbose_name=_('Número de eixos'))
    next_review_date = models.DateField(null=True, blank=True, verbose_name=_('Próxima revisão (data)'))
    next_review_km = models.PositiveIntegerField(null=True, blank=True, verbose_name=_('Próxima revisão (km)'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Veículo')
        verbose_name_plural = _('Veículos')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.plate} - {self.model} ({self.year})"

    @property
    def current_km(self):
        distance_expr = ExpressionWrapper(F('final_km') - F('initial_km'), output_field=IntegerField())
        traveled_sum = (
            self.trips.exclude(initial_km__isnull=True)
            .exclude(final_km__isnull=True)
            .aggregate(total=Sum(distance_expr))
            .get('total')
        ) or 0
        km_by_distance = int(self.initial_km or 0) + int(traveled_sum)
        latest_completed_final_km = (
            self.trips.filter(status='completed', final_km__isnull=False)
            .order_by('-end_date', '-date', '-id')
            .values_list('final_km', flat=True)
            .first()
        )
        return max(km_by_distance, int(latest_completed_final_km or 0))


class TransportRevenue(models.Model):
    TYPE_CHOICES = (
        ('trip', 'Viagem'),
        ('contract', 'Contrato de Alocação'),
    )

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='revenues')
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Receita Transporte')
        verbose_name_plural = _('Receitas Transporte')

    def __str__(self):
        return f"{self.vehicle} - {self.amount} ({self.date})"


class TransportExpense(models.Model):
    CATEGORY_CHOICES = (
        ('fuel', 'Combustível'),
        ('driver', 'Motorista'),
        ('parts', 'Peças'),
        ('maintenance', 'Manutenção'),
        ('other', 'Outros'),
    )

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='expenses')
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Despesa Transporte')
        verbose_name_plural = _('Despesas Transporte')

    def __str__(self):
        return f"{self.vehicle} - {self.amount} ({self.category})"


class FuelLog(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='fuel_logs')
    date = models.DateField()
    odometer_km = models.PositiveIntegerField(verbose_name=_('Odômetro (KM)'))
    liters = models.DecimalField(max_digits=10, decimal_places=3)
    total_value = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Abastecimento')
        verbose_name_plural = _('Abastecimentos')
        ordering = ['-date', '-id']

    def __str__(self):
        return f"{self.vehicle} - {self.odometer_km}km - {self.liters}L ({self.date})"


class Trip(models.Model):
    STATUS_CHOICES = (
        ('in_progress', 'Em curso'),
        ('completed', 'Encerrada'),
    )

    MODALITY_CHOICES = (
        ('per_ton', 'Por Tonelada'),
        ('lease', 'Arrendamento (diárias)'),
    )

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='trips')
    date = models.DateField()
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    modality = models.CharField(max_length=32, choices=MODALITY_CHOICES)
    progress_type = models.CharField(max_length=100, blank=True, default='')

    # fields for per_ton
    tons = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    rate_per_ton = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # fields for lease
    days = models.PositiveIntegerField(null=True, blank=True)
    daily_rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_received = models.BooleanField(default=False)
    base_expense_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fuel_expense_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    initial_km = models.PositiveIntegerField(null=True, blank=True)
    final_km = models.PositiveIntegerField(null=True, blank=True)
    # litros abastecidos durante a viagem (pode ser informado manualmente)
    fuel_liters = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    # consumo médio calculado em km por litro (final_km - initial_km) / fuel_liters
    consumption_km_per_liter = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    # indicar se o motorista é o próprio dono (nenhum pagamento ao motorista)
    driver_is_owner = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    driver_payment = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expense_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Viagem')
        verbose_name_plural = _('Viagens')

    def __str__(self):
        return f"{self.vehicle} - {self.modality} - {self.total_value} ({self.date})"

    def recalculate_from_movements(self):
        revenue_sum = self.movements.filter(movement_type='revenue').aggregate(total=Sum('amount'))['total'] or 0
        other_expense_sum = self.movements.filter(movement_type='expense', expense_category='other').aggregate(total=Sum('amount'))['total'] or 0
        fuel_expense_sum = self.movements.filter(movement_type='expense', expense_category='fuel').aggregate(total=Sum('amount'))['total'] or 0

        self.is_received = bool(revenue_sum > 0)
        self.base_expense_value = other_expense_sum
        self.fuel_expense_value = fuel_expense_sum
        self.expense_value = (self.base_expense_value or 0) + (self.fuel_expense_value or 0) + (self.driver_payment or 0)
        self.save(update_fields=['is_received', 'base_expense_value', 'fuel_expense_value', 'expense_value'])


class TripMovement(models.Model):
    MOVEMENT_TYPE_CHOICES = (
        ('expense', 'Gasto'),
        ('revenue', 'Recebimento'),
    )

    EXPENSE_CATEGORY_CHOICES = (
        ('fuel', 'Combustível'),
        ('other', 'Outros gastos'),
    )

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='movements')
    date = models.DateField()
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPE_CHOICES)
    expense_category = models.CharField(max_length=20, choices=EXPENSE_CATEGORY_CHOICES, blank=True, default='')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Lançamento da Viagem')
        verbose_name_plural = _('Lançamentos da Viagem')
        ordering = ['-date', '-id']

    def __str__(self):
        return f"{self.trip_id} | {self.movement_type} | {self.amount}"


class TireInventory(models.Model):
    STATUS_STOCK = 'stock'
    STATUS_IN_USE = 'in_use'
    STATUS_DISCARDED = 'discarded'
    STATUS_CHOICES = (
        (STATUS_STOCK, 'Estoque'),
        (STATUS_IN_USE, 'Em Uso'),
        (STATUS_DISCARDED, 'Descartado'),
    )

    CONDITION_GOOD = 'good'
    CONDITION_MEDIUM = 'medium'
    CONDITION_BAD = 'bad'
    CONDITION_CHOICES = (
        (CONDITION_GOOD, 'Bom'),
        (CONDITION_MEDIUM, 'Médio'),
        (CONDITION_BAD, 'Ruim'),
    )

    tenant = models.ForeignKey('accounts.Tenant', on_delete=models.CASCADE, related_name='tire_inventory')
    brand = models.CharField(max_length=120)
    serial_number = models.CharField(max_length=120, blank=True)
    purchase_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_STOCK)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default=CONDITION_GOOD)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Pneu')
        verbose_name_plural = _('Inventário de Pneus')
        ordering = ['-purchase_date', '-id']

    def __str__(self):
        return f"{self.brand} ({self.serial_number or 'sem série'})"


class VehicleTirePlacement(models.Model):
    SIDE_LEFT = 'left'
    SIDE_RIGHT = 'right'
    SIDE_CHOICES = (
        (SIDE_LEFT, 'Esquerdo'),
        (SIDE_RIGHT, 'Direito'),
    )

    POSITION_INSIDE = 'inside'
    POSITION_OUTSIDE = 'outside'
    POSITION_CHOICES = (
        (POSITION_INSIDE, 'Dentro'),
        (POSITION_OUTSIDE, 'Fora'),
    )

    tenant = models.ForeignKey('accounts.Tenant', on_delete=models.CASCADE, related_name='vehicle_tire_placements')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='tire_placements')
    tire = models.ForeignKey(TireInventory, on_delete=models.CASCADE, related_name='placements')
    installation_date = models.DateField()
    removal_date = models.DateField(null=True, blank=True)
    removal_km = models.PositiveIntegerField(null=True, blank=True)
    axle_number = models.PositiveIntegerField()
    side = models.CharField(max_length=10, choices=SIDE_CHOICES)
    position = models.CharField(max_length=10, choices=POSITION_CHOICES, default=POSITION_OUTSIDE)
    current_km_at_installation = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Instalação de Pneu')
        verbose_name_plural = _('Histórico de Instalações de Pneus')
        ordering = ['-installation_date', '-id']

    def __str__(self):
        return f"{self.vehicle.plate} Eixo {self.axle_number} {self.get_side_display()}"


class MaintenanceLog(models.Model):
    tenant = models.ForeignKey('accounts.Tenant', on_delete=models.CASCADE, related_name='maintenance_logs')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='maintenance_logs')
    date = models.DateField()
    odometer_at_maintenance = models.PositiveIntegerField()
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Manutenção')
        verbose_name_plural = _('Histórico de Manutenções')
        ordering = ['-date', '-id']

    def __str__(self):
        return f"{self.vehicle.plate} | {self.date}"


class OilChangeLog(models.Model):
    TYPE_FULL_CHANGE = 'full_change'
    TYPE_TOP_UP = 'top_up'
    TYPE_CHOICES = (
        (TYPE_FULL_CHANGE, 'Troca completa'),
        (TYPE_TOP_UP, 'Completar nível'),
    )

    tenant = models.ForeignKey('accounts.Tenant', on_delete=models.CASCADE, related_name='oil_change_logs')
    maintenance = models.OneToOneField(MaintenanceLog, on_delete=models.CASCADE, related_name='oil_change')
    oil_brand = models.CharField(max_length=120)
    quantity_liters = models.DecimalField(max_digits=8, decimal_places=2)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_FULL_CHANGE)
    next_change_km_interval = models.PositiveIntegerField(null=True, blank=True)
    next_change_date_interval = models.PositiveIntegerField(null=True, blank=True, help_text='Intervalo em dias para próxima troca')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Troca de Óleo')
        verbose_name_plural = _('Trocas de Óleo')
        ordering = ['-id']

    def __str__(self):
        return f"{self.maintenance.vehicle.plate} | {self.oil_brand}"


class MaintenanceAlert(models.Model):
    LEVEL_WARNING = 'warning'
    LEVEL_CRITICAL = 'critical'
    LEVEL_CHOICES = (
        (LEVEL_WARNING, 'Aviso'),
        (LEVEL_CRITICAL, 'Crítico'),
    )

    tenant = models.ForeignKey('accounts.Tenant', on_delete=models.CASCADE, related_name='maintenance_alerts')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='maintenance_alerts')
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default=LEVEL_WARNING)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    alert_date = models.DateField(default=date.today)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Alerta de Manutenção')
        verbose_name_plural = _('Alertas de Manutenção')
        ordering = ['is_read', '-alert_date', '-id']

    def __str__(self):
        return f"{self.vehicle.plate} | {self.level}"
