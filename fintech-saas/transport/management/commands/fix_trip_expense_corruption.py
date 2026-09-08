"""
Corrige, em produção, o efeito do bug de Trip.sync_expense_movements() que zerava
base_expense_value/fuel_expense_value (e apagava os lançamentos de combustível e
outros gastos sem recriá-los) sempre que uma viagem já sincronizada anteriormente
era editada de novo. Ver o fix em transport/models.py (Trip.sync_expense_movements).

O bug tem duas faces:
  1) Daqui para frente: já corrigido no código — este comando não precisa rodar
     de novo para viagens criadas/editadas depois do deploy da correção.
  2) Viagens já criadas/editadas ANTES da correção: podem estar com
     base_expense_value e/ou fuel_expense_value zerados incorretamente, e os
     lançamentos automáticos dessas categorias podem ter sido apagados sem volta.
     Não existe log de auditoria guardando o valor antigo, então esse valor
     específico (quanto era o gasto de combustível/outros gastos daquela viagem)
     NÃO pode ser recuperado automaticamente — precisa ser conferido e, se for o
     caso, relançado manualmente pelo usuário via edição da viagem.

O que este comando faz:
  - FASE 1 (diagnóstico): varre todas as viagens e lista as que têm a "assinatura"
    da corrupção — têm um lançamento automático de Salário/Comissão (prova que
    sync_expense_movements já rodou com pagamento ao motorista) mas
    base_expense_value e fuel_expense_value estão zerados e não existe nenhum
    lançamento automático de combustível/outros gastos. É uma lista de suspeitas
    para revisão manual, não uma correção automática de valores perdidos.
  - FASE 2 (resync seguro): roda sync_expense_movements() — já usando o método
    corrigido — em todas as viagens, garantindo que os lançamentos automáticos
    fiquem consistentes com os valores que existem HOJE em cada viagem (não
    resolve os já perdidos da fase 1, mas conserta qualquer inconsistência
    parcial e evita que o problema volte a aparecer).

Uso:
    python manage.py fix_trip_expense_corruption --dry-run
    python manage.py fix_trip_expense_corruption
    python manage.py fix_trip_expense_corruption --tenant-id <uuid>
"""
from django.core.management.base import BaseCommand
from django.db.models import Q

from transport.models import Trip


class Command(BaseCommand):
    help = 'Diagnostica e corrige a corrupção de base_expense_value/fuel_expense_value causada pelo bug de sync_expense_movements()'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-id',
            type=str,
            help='UUID de um tenant específico (opcional; sem isso, roda em todos os tenants).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Só lista as viagens suspeitas de corrupção, sem executar o resync (fase 2).',
        )

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        dry_run = options.get('dry_run')

        trips_qs = Trip.objects.select_related('vehicle', 'vehicle__tenant').all()
        if tenant_id:
            trips_qs = trips_qs.filter(vehicle__tenant_id=tenant_id)

        # ---- FASE 1: diagnóstico ----
        self.stdout.write('Fase 1/2 — procurando viagens com a assinatura da corrupção...')
        suspicious = []
        for trip in trips_qs:
            has_driver_movement = trip.movements.filter(
                expense_category='driver', is_auto_generated=True,
            ).exists()
            has_fuel_or_other_movement = trip.movements.filter(
                expense_category__in=['fuel', 'other'], is_auto_generated=True,
            ).exists()
            zeroed = (trip.base_expense_value or 0) == 0 and (trip.fuel_expense_value or 0) == 0

            if has_driver_movement and zeroed and not has_fuel_or_other_movement:
                suspicious.append(trip)

        if suspicious:
            self.stdout.write(self.style.WARNING(
                f'{len(suspicious)} viagem(ns) com sinais de terem perdido o valor de '
                f'combustível/outros gastos. O valor original NÃO pode ser recuperado '
                f'automaticamente — revise manualmente e relance se necessário:'
            ))
            for trip in suspicious:
                tenant_slug = trip.vehicle.tenant.slug if trip.vehicle_id else '?'
                plate = trip.vehicle.plate if trip.vehicle_id else '?'
                trip_date = trip.start_date or trip.date
                self.stdout.write(
                    f'  - viagem #{trip.id} | tenant={tenant_slug} | placa={plate} | '
                    f'data={trip_date} | driver_payment={trip.driver_payment}'
                )
        else:
            self.stdout.write(self.style.SUCCESS('Nenhuma viagem com a assinatura da corrupção encontrada.'))

        # ---- FASE 2: resync seguro (idempotente, usa o método já corrigido) ----
        if dry_run:
            self.stdout.write(self.style.WARNING('--dry-run: pulando a fase 2 (resync).'))
            return

        self.stdout.write('Fase 2/2 — resincronizando lançamentos automáticos de todas as viagens...')
        total = trips_qs.count()
        fixed = 0
        for trip in trips_qs.iterator():
            trip.sync_expense_movements()
            fixed += 1
            if fixed % 200 == 0:
                self.stdout.write(f'  Progresso: {fixed}/{total}')

        self.stdout.write(self.style.SUCCESS(
            f'Concluído. {fixed} viagem(ns) resincronizada(s). '
            f'{len(suspicious)} precisam de revisão manual (listadas acima).'
        ))
