"""
Comando para corrigir lançamentos (TripMovement) que ficaram com a data padrão de
hoje por causa de um bug de frontend já corrigido: o campo de data do formulário de
lançamento vinha preenchido automaticamente com a data atual em vez de vazio, e quem
não alterava esse campo salvava o lançamento com a data errada.

Corrige movimentações datadas em 02/07/2026 ou 03/07/2026 (janela em que o bug estava
ativo), trocando a data para a data de abertura da viagem à qual pertencem
(`trip.start_date`, ou `trip.date` como fallback caso `start_date` esteja vazio).

Uso:
    # 1) Listar os lançamentos afetados, sem alterar nada
    python manage.py fix_movement_default_dates

    # 2) Aplicar a correção de fato
    python manage.py fix_movement_default_dates --apply
"""
from django.core.management.base import BaseCommand
from transport.models import TripMovement

BUGGY_DATES = ['2026-07-02', '2026-07-03']


class Command(BaseCommand):
    help = 'Corrige lançamentos com data padrão de hoje (bug já corrigido) para a data de abertura da viagem'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Aplica a correção. Sem esta flag, apenas lista o que seria alterado.',
        )

    def handle(self, *args, **options):
        apply_changes = options.get('apply')

        movements = (
            TripMovement.objects.filter(date__in=BUGGY_DATES)
            .select_related('trip', 'trip__vehicle')
            .order_by('trip__vehicle__plate', 'trip_id', 'date')
        )

        if not movements.exists():
            self.stdout.write(self.style.SUCCESS('Nenhum lançamento encontrado nas datas 02/07/2026 ou 03/07/2026.'))
            return

        skipped = 0
        fixed = 0

        for m in movements:
            trip = m.trip
            target_date = trip.start_date or trip.date
            if not target_date:
                skipped += 1
                self.stdout.write(self.style.WARNING(
                    f'  [PULADO] Lançamento {m.id} (viagem {trip.id}, {trip.vehicle.plate}) — '
                    f'viagem sem data de início/abertura definida.'
                ))
                continue

            if str(target_date) == str(m.date):
                continue  # já está correto (data do lançamento coincide com a de abertura)

            action = 'Alterando' if apply_changes else 'Alteraria'
            self.stdout.write(
                f'  [{action}] Lançamento {m.id} (viagem {trip.id}, {trip.vehicle.plate}, '
                f'{m.movement_type}/{m.expense_category or "receita"}, R$ {m.amount}): '
                f'{m.date} → {target_date}'
            )

            if apply_changes:
                m.date = target_date
                m.save(update_fields=['date'])
                fixed += 1

        if apply_changes:
            self.stdout.write(self.style.SUCCESS(f'\n✓ {fixed} lançamento(s) corrigido(s).'))
            if skipped:
                self.stdout.write(self.style.WARNING(f'{skipped} lançamento(s) pulado(s) (viagem sem data de abertura).'))
        else:
            self.stdout.write(self.style.WARNING(
                '\nDry-run: nenhuma alteração foi feita. Rode com --apply para aplicar a correção.'
            ))
