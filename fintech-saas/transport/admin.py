from django.contrib import admin
from .models import Vehicle, TransportRevenue, TransportExpense, FuelLog, Driver


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date', 'is_owner', 'tenant')
    list_filter = ('is_owner', 'tenant')
    search_fields = ('name',)


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('plate', 'model', 'year', 'tenant')
    search_fields = ('plate', 'model')


@admin.register(TransportRevenue)
class TransportRevenueAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'amount', 'date', 'type')
    list_filter = ('type',)


@admin.register(TransportExpense)
class TransportExpenseAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'amount', 'date', 'category')
    list_filter = ('category',)


@admin.register(FuelLog)
class FuelLogAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'date', 'odometer_km', 'liters')
    ordering = ('-date',)
