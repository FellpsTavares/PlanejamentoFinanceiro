"""
Comando para marcar movimentações existentes como manuais (is_auto_generated=False).
Isso preserva os dados existentes antes da implementação do novo campo.
"""
from django.core.management.base import BaseCommand
from transport.models import TripMovement


class Command(BaseCommand):
    help = 'Marca todas as movimentações existentes como manuais (is_auto_generated=False)'

    def handle(self, *args, **options):
        self.stdout.write('Iniciando marcação de movimentações existentes...')
        
        # Marcar todas as movimentações existentes como manuais
        # (antes da implementação do campo is_auto_generated)
        count = TripMovement.objects.filter(is_auto_generated=True).update(is_auto_generated=False)
        
        self.stdout.write(
            self.style.SUCCESS(f'✓ {count} movimentações marcadas como manuais.')
        )
        
        self.stdout.write(
            self.style.WARNING(
                '\nIMPORTANTE: A partir de agora, apenas movimentações criadas automaticamente\n'
                'pelo sistema serão marcadas com is_auto_generated=True.'
            )
        )
