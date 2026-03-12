from django.core.management.base import BaseCommand

from transport.tasks import generate_review_alerts_for_all_tenants


class Command(BaseCommand):
    help = 'Gera alertas de revisão por data/KM para todos os tenants.'

    def handle(self, *args, **options):
        created = generate_review_alerts_for_all_tenants()
        self.stdout.write(self.style.SUCCESS(f'Alertas processados. Novos alertas: {created}'))
