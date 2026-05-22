"""
Comando para sincronizar gastos de viagens existentes como lançamentos (TripMovement).

Uso:
    python manage.py sync_trip_movements
    
    ou para um tenant específico:
    python manage.py sync_trip_movements --tenant-id 1
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from transport.models import Trip


class Command(BaseCommand):
    help = 'Sincroniza gastos de viagens existentes criando TripMovement automaticamente'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-id',
            type=int,
            help='ID do tenant específico para sincronizar (opcional)',
        )

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        
        # Filtrar viagens
        trips_qs = Trip.objects.all()
        if tenant_id:
            trips_qs = trips_qs.filter(vehicle__tenant_id=tenant_id)
            self.stdout.write(f'Sincronizando viagens do tenant {tenant_id}...')
        else:
            self.stdout.write('Sincronizando TODAS as viagens...')
        
        # Contar viagens com gastos
        trips_with_expenses = trips_qs.filter(
            Q(base_expense_value__gt=0) | Q(fuel_expense_value__gt=0)
        )
        total = trips_with_expenses.count()
        
        if total == 0:
            self.stdout.write(self.style.WARNING('Nenhuma viagem com gastos encontrada.'))
            return
        
        self.stdout.write(f'Encontradas {total} viagens com gastos. Sincronizando...')
        
        synced = 0
        for trip in trips_with_expenses:
            trip.sync_expense_movements()
            synced += 1
            
            if synced % 100 == 0:
                self.stdout.write(f'  Progresso: {synced}/{total}')
        
        self.stdout.write(
            self.style.SUCCESS(f'✓ Sincronização concluída! {synced} viagens processadas.')
        )
