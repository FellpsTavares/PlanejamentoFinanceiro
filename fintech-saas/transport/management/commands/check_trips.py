"""
Comando para verificar descrições de viagens.
"""
from django.core.management.base import BaseCommand
from transport.models import Trip


class Command(BaseCommand):
    help = 'Verifica descrições de viagens'

    def handle(self, *args, **options):
        trips = Trip.objects.filter(base_expense_value__gt=0).order_by('date')
        
        self.stdout.write(f'\nViagens com gastos gerais:')
        self.stdout.write('=' * 80)
        
        for trip in trips:
            self.stdout.write(f'\n[ID: {trip.id}] Data: {trip.start_date or trip.date}')
            self.stdout.write(f'  Veículo: {trip.vehicle.plate}')
            self.stdout.write(f'  Gastos gerais: R$ {trip.base_expense_value}')
            self.stdout.write(f'  Combustível: R$ {trip.fuel_expense_value}')
            self.stdout.write(f'  Descrição: "{trip.description}"')
            
            # Verificar movements
            movements = trip.movements.filter(expense_category='other')
            if movements.exists():
                for m in movements:
                    self.stdout.write(f'  → Movement descrição: "{m.description}"')
            else:
                self.stdout.write(f'  → Sem movements de "outros gastos"')
        
        self.stdout.write('\n' + '=' * 80)
