"""
Corrige, em produção, dois efeitos colaterais dos bugs em Trip.sync_expense_movements()
já corrigidos no código (ver transport/models.py):

  1) Zeragem de base_expense_value/fuel_expense_value: editar uma viagem que já
     tinha lançamentos automáticos de uma sincronização anterior podia zerar
     esses dois campos e apagar os lançamentos de combustível/outros gastos sem
     recriá-los. Não existe log de auditoria guardando o valor antigo, então esse
     valor específico (quanto era o gasto daquela viagem) NÃO pode ser
     recuperado automaticamente — precisa ser conferido e relançado manualmente
     pelo usuário nas viagens listadas pela Fase 1.

  2) Lançamentos sem categoria vinculada: os lançamentos automáticos de
     combustível e outros gastos eram criados sem preencher a FK `category`
     (só o bucket interno `expense_category`). Isso faz esses lançamentos
     caírem numa linha separada dos lançamentos manuais da mesma categoria nos
     relatórios — ex.: "Combustível" aparecendo duas vezes no Resumo por
     Categoria, cada linha com uma parte do total, dando a falsa impressão de
     duplicidade. A Fase 2 corrige isso retroativamente (é uma correção segura:
     a categoria correta é 1:1 com o bucket, então não há ambiguidade).

O que este comando faz:
  - FASE 1 (diagnóstico): lista viagens com a "assinatura" do bug de zeragem —
    têm lançamento automático de Salário/Comissão (prova que a viagem já foi
    sincronizada com pagamento ao motorista) mas base_expense_value e
    fuel_expense_value estão zerados e não existe nenhum lançamento automático
    de combustível/outros gastos. É uma lista para revisão manual, não uma
    correção automática de valores perdidos.
  - FASE 2 (backfill de categoria): vincula a categoria correta (Combustível /
    Outros Gastos) em todo lançamento de despesa existente — automático ou
    manual — que estiver com a FK `category` em branco, com base no bucket
    `expense_category` dele. Não mexe em valores, só na vinculação da categoria.
  - FASE 3 (resync seguro): roda sync_expense_movements() — já com o método
    corrigido — em todas as viagens, garantindo que os lançamentos automáticos
    fiquem consistentes com os valores que existem HOJE em cada viagem.

Uso:
    python manage.py fix_trip_expense_corruption --dry-run
    python manage.py fix_trip_expense_corruption
    python manage.py fix_trip_expense_corruption --tenant-id <uuid>
"""
from django.core.management.base import BaseCommand

from finance.defaults import ensure_default_category
from finance.models import Category
from transport.models import Trip, TripMovement


class Command(BaseCommand):
    help = 'Diagnostica/corrige a corrupção de valores e a falta de categoria vinculada causadas por bugs já corrigidos em sync_expense_movements()'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-id',
            type=str,
            help='UUID de um tenant específico (opcional; sem isso, roda em todos os tenants).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Só lista as viagens suspeitas de corrupção, sem executar as fases 2 e 3.',
        )

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        dry_run = options.get('dry_run')

        trips_qs = Trip.objects.select_related('vehicle', 'vehicle__tenant').all()
        if tenant_id:
            trips_qs = trips_qs.filter(vehicle__tenant_id=tenant_id)

        # ---- FASE 1: diagnóstico da zeragem de valores ----
        self.stdout.write('Fase 1/3 — procurando viagens com a assinatura da corrupção de valores...')
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
            self.stdout.write(self.style.SUCCESS('Nenhuma viagem com a assinatura da corrupção de valores encontrada.'))

        if dry_run:
            self.stdout.write(self.style.WARNING('--dry-run: pulando as fases 2 e 3.'))
            return

        # ---- FASE 2: backfill de categoria em lançamentos sem category_id ----
        self.stdout.write('Fase 2/3 — vinculando categoria nos lançamentos de combustível/outros gastos sem categoria...')
        movements_qs = TripMovement.objects.filter(
            movement_type='expense',
            expense_category__in=['fuel', 'other'],
            category__isnull=True,
            trip__vehicle__isnull=False,
        ).select_related('trip__vehicle__tenant')
        if tenant_id:
            movements_qs = movements_qs.filter(trip__vehicle__tenant_id=tenant_id)

        # Resolve a categoria padrão por tenant uma única vez (evita repetir a
        # consulta/criação para cada lançamento do mesmo tenant).
        category_cache = {}
        linked = 0
        for movement in movements_qs.iterator():
            tenant = movement.trip.vehicle.tenant
            system_key = Category.SYSTEM_KEY_FUEL if movement.expense_category == 'fuel' else Category.SYSTEM_KEY_OTHER
            cache_key = (tenant.id, system_key)
            if cache_key not in category_cache:
                category_cache[cache_key] = ensure_default_category(tenant, system_key)
            movement.category = category_cache[cache_key]
            movement.save(update_fields=['category'])
            linked += 1

        self.stdout.write(self.style.SUCCESS(f'{linked} lançamento(s) com categoria vinculada retroativamente.'))

        # ---- FASE 3: resync seguro (idempotente, usa o método já corrigido) ----
        # Antes de ressincronizar, recalcula a partir dos lançamentos MANUAIS
        # (recalculate_from_movements, já corrigido para nunca somar os
        # automáticos de volta). Isso desfaz qualquer duplicação que a própria
        # Fase 2 acima possa ter causado em execuções anteriores deste comando —
        # antes da correção, vincular a categoria de um lançamento automático
        # antigo (sem categoria, de antes da FK category existir) disparava um
        # recálculo que somava esse automático junto com os manuais que ele
        # espelhava, dobrando base_expense_value/fuel_expense_value.
        self.stdout.write('Fase 3/3 — recalculando a partir dos lançamentos manuais e resincronizando...')
        total = trips_qs.count()
        fixed = 0
        for trip in trips_qs.iterator():
            trip.recalculate_from_movements()
            trip.sync_expense_movements()
            fixed += 1
            if fixed % 200 == 0:
                self.stdout.write(f'  Progresso: {fixed}/{total}')

        self.stdout.write(self.style.SUCCESS(
            f'Concluído. {fixed} viagem(ns) resincronizada(s), {linked} lançamento(s) com categoria corrigida. '
            f'{len(suspicious)} viagem(ns) precisam de revisão manual (listadas acima).'
        ))
