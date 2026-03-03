from django.db import models
from django.utils.translation import gettext_lazy as _


class Vehicle(models.Model):
    tenant = models.ForeignKey('accounts.Tenant', on_delete=models.CASCADE, related_name='vehicles')
    plate = models.CharField(max_length=20, verbose_name=_('Placa'))
    model = models.CharField(max_length=255, verbose_name=_('Modelo'))
    year = models.PositiveSmallIntegerField(verbose_name=_('Ano'))
    capacity = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_('Capacidade'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Veículo')
        verbose_name_plural = _('Veículos')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.plate} - {self.model} ({self.year})"


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
    MODALITY_CHOICES = (
        ('per_ton', 'Por Tonelada'),
        ('lease', 'Arrendamento (diárias)'),
    )

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='trips')
    date = models.DateField()
    modality = models.CharField(max_length=32, choices=MODALITY_CHOICES)

    # fields for per_ton
    tons = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    rate_per_ton = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # fields for lease
    days = models.PositiveIntegerField(null=True, blank=True)
    daily_rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_received = models.BooleanField(default=False)
    expense_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Viagem')
        verbose_name_plural = _('Viagens')

    def __str__(self):
        return f"{self.vehicle} - {self.modality} - {self.total_value} ({self.date})"
