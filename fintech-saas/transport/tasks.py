from datetime import timedelta

from django.utils import timezone

from accounts.models import Tenant
from transport.models import MaintenanceAlert, Vehicle

try:
    from celery import shared_task
except Exception:  # pragma: no cover
    def shared_task(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


def generate_review_alerts_for_all_tenants() -> int:
    today = timezone.localdate()
    created_count = 0

    tenants = Tenant.objects.filter(is_active=True)
    for tenant in tenants:
        days_before = int(tenant.days_before_review_alert or 30)
        km_before = int(tenant.km_before_review_alert or 1000)

        vehicles = Vehicle.objects.filter(tenant=tenant)
        for vehicle in vehicles:
            if vehicle.next_review_date:
                days_to_review = (vehicle.next_review_date - today).days
                if days_to_review <= days_before:
                    level = MaintenanceAlert.LEVEL_CRITICAL if days_to_review <= 0 else MaintenanceAlert.LEVEL_WARNING
                    title = f'Revisão por data - {vehicle.plate}'
                    message = (
                        f'Veículo {vehicle.plate} com revisão prevista para {vehicle.next_review_date:%d/%m/%Y} '
                        f'(faltam {days_to_review} dias).'
                    )
                    _, created = MaintenanceAlert.objects.get_or_create(
                        tenant=tenant,
                        vehicle=vehicle,
                        title=title,
                        alert_date=today,
                        defaults={'level': level, 'message': message},
                    )
                    if created:
                        created_count += 1

            if vehicle.next_review_km is not None:
                current_km = int(vehicle.current_km or 0)
                km_to_review = int(vehicle.next_review_km) - current_km
                if km_to_review <= km_before:
                    level = MaintenanceAlert.LEVEL_CRITICAL if km_to_review <= 0 else MaintenanceAlert.LEVEL_WARNING
                    title = f'Revisão por KM - {vehicle.plate}'
                    message = (
                        f'Veículo {vehicle.plate} está a {km_to_review} km da revisão '
                        f'(revisão prevista em {vehicle.next_review_km} km; atual {current_km} km).'
                    )
                    _, created = MaintenanceAlert.objects.get_or_create(
                        tenant=tenant,
                        vehicle=vehicle,
                        title=title,
                        alert_date=today,
                        defaults={'level': level, 'message': message},
                    )
                    if created:
                        created_count += 1

        cutoff = today - timedelta(days=30)
        MaintenanceAlert.objects.filter(tenant=tenant, alert_date__lt=cutoff, is_read=True).delete()

    return created_count


@shared_task
def generate_review_alerts_for_all_tenants_task():
    return generate_review_alerts_for_all_tenants()
