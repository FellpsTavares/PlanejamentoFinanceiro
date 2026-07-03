"""
Comando para marcar todas as viagens existentes como recebidas (is_received=True).
Correção pontual para viagens cadastradas antes/durante o ajuste do toggle
"Valor da viagem já recebido" na tela de gerenciamento de viagens.
"""
from django.core.management.base import BaseCommand
from transport.models import Trip


class Command(BaseCommand):
    help = 'Marca todas as viagens existentes (de todos os tenants) como recebidas (is_received=True)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Apenas mostra quantas viagens seriam afetadas, sem alterar nada',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run')

        total = Trip.objects.count()
        pending = Trip.objects.filter(is_received=False).count()

        self.stdout.write(f'Total de viagens no banco: {total}')
        self.stdout.write(f'Viagens ainda não marcadas como recebidas: {pending}')

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry-run: nenhuma alteração foi feita.'))
            return

        if pending == 0:
            self.stdout.write(self.style.SUCCESS('✓ Todas as viagens já estão marcadas como recebidas.'))
            return

        updated = Trip.objects.filter(is_received=False).update(is_received=True)

        self.stdout.write(
            self.style.SUCCESS(f'✓ {updated} viagens marcadas como recebidas (is_received=True).')
        )
