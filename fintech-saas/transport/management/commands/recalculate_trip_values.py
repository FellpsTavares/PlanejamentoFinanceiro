"""
Comando para recalcular valores de viagens baseado nas movimentações.
Útil quando movimentações são deletadas manualmente via SQL.
"""
from django.core.management.base import BaseCommand
from transport.models import Trip


class Command(BaseCommand):
    help = 'Recalcula valores de viagens baseado nas movimentações existentes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--trip-id',
            type=int,
            help='ID da viagem específica para recalcular (opcional)',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Recalcular todas as viagens',
        )

    def handle(self, *args, **options):
        trip_id = options.get('trip_id')
        recalculate_all = options.get('all')

        if trip_id:
            # Recalcular viagem específica
            try:
                trip = Trip.objects.get(id=trip_id)
                self.stdout.write(f'Recalculando viagem ID {trip_id}...')
                
                old_base = trip.base_expense_value
                old_fuel = trip.fuel_expense_value
                old_expense = trip.expense_value
                
                trip.recalculate_from_movements()
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Viagem {trip_id} recalculada:\n'
                        f'  Base: {old_base} → {trip.base_expense_value}\n'
                        f'  Fuel: {old_fuel} → {trip.fuel_expense_value}\n'
                        f'  Total: {old_expense} → {trip.expense_value}'
                    )
                )
            except Trip.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'✗ Viagem ID {trip_id} não encontrada'))
                return

        elif recalculate_all:
            # Recalcular todas as viagens
            self.stdout.write('Recalculando todas as viagens...')
            trips = Trip.objects.all()
            count = 0
            
            for trip in trips:
                trip.recalculate_from_movements()
                count += 1
            
            self.stdout.write(
                self.style.SUCCESS(f'✓ {count} viagens recalculadas com sucesso')
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    'Use --trip-id=<ID> para recalcular uma viagem específica\n'
                    'ou --all para recalcular todas as viagens'
                )
            )
