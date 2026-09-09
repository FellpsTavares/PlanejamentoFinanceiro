import io
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Tenant, User
from finance.defaults import ensure_default_categories, ensure_default_category
from finance.models import Category
from transport.models import Driver, Trip, TripMovement, Vehicle
from transport.serializers import TripMovementSerializer, TripSerializer


def make_tenant(slug='tenant-teste'):
    return Tenant.objects.create(name='Tenant Teste', slug=slug, email='teste@example.com')


def make_vehicle(tenant, plate='ABC1D23'):
    return Vehicle.objects.create(
        tenant=tenant,
        plate=plate,
        model='Volvo FH 540',
        year=2020,
        capacity=Decimal('30.000'),
    )


class TripIsReceivedNotResetByExpenseMovementsTests(TestCase):
    """
    Regra: "Valor da viagem já recebido" é um campo de controle manual. Editar um
    gasto da viagem (o que recria os lançamentos automáticos e, por sinal, chama
    recalculate_from_movements()) não pode apagar essa marcação silenciosamente.
    """

    def setUp(self):
        self.tenant = make_tenant()
        self.vehicle = make_vehicle(self.tenant)
        self.trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
            is_received=True,
        )

    def test_recalculate_from_movements_preserves_manually_set_is_received(self):
        self.trip.recalculate_from_movements()
        self.trip.refresh_from_db()
        self.assertTrue(self.trip.is_received)

    def test_editing_expense_fields_does_not_unmark_is_received(self):
        # Simula o que acontece de verdade quando o usuário edita um gasto da
        # viagem: sync_expense_movements() recria os lançamentos automáticos,
        # o que dispara recalculate_from_movements() via sinal a cada
        # criação/exclusão de TripMovement.
        self.trip.base_expense_value = Decimal('50')
        self.trip.fuel_expense_value = Decimal('30')
        self.trip.save()
        self.trip.sync_expense_movements()
        self.trip.refresh_from_db()
        self.assertTrue(self.trip.is_received)

    def test_revenue_movement_still_promotes_is_received_to_true(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-06',
            start_date='2026-09-06',
            modality='per_ton',
            tons=Decimal('5'),
            rate_per_ton=Decimal('100'),
            is_received=False,
        )
        TripMovement.objects.create(
            trip=trip, date='2026-09-06', movement_type='revenue', amount=Decimal('500'),
        )
        trip.recalculate_from_movements()
        trip.refresh_from_db()
        self.assertTrue(trip.is_received)


class TripEndDateDefaultTests(TestCase):
    """
    Regra: se a viagem não tiver data final informada, ela deve assumir a
    mesma data de início automaticamente ao salvar.
    """

    def setUp(self):
        self.tenant = make_tenant()
        self.vehicle = make_vehicle(self.tenant)

    def test_end_date_falls_back_to_start_date_when_missing(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            end_date=None,
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
        )
        self.assertEqual(str(trip.end_date), '2026-09-05')

    def test_explicit_end_date_is_preserved(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            end_date='2026-09-10',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
        )
        self.assertEqual(str(trip.end_date), '2026-09-10')

    def test_end_date_updates_when_start_date_changes_and_end_date_still_missing(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            end_date=None,
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
        )
        self.assertEqual(str(trip.end_date), '2026-09-05')
        trip.start_date = '2026-09-07'
        trip.end_date = None
        trip.save()
        self.assertEqual(str(trip.end_date), '2026-09-07')


class TripSerializerVehicleInfoTests(TestCase):
    """
    Regra: a tela de Gerenciar Viagens precisa exibir placa e modelo do veículo
    em destaque, então o serializer precisa devolver esses dois campos.
    """

    def test_serializer_exposes_vehicle_plate_and_model(self):
        tenant = make_tenant()
        vehicle = make_vehicle(tenant, plate='XYZ9A87')
        trip = Trip.objects.create(
            vehicle=vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('12.5'),
            rate_per_ton=Decimal('150'),
        )
        data = TripSerializer(trip).data
        self.assertEqual(data['vehicle_plate'], 'XYZ9A87')
        self.assertEqual(data['vehicle_model'], 'Volvo FH 540')


class DefaultCategoriesTests(TestCase):
    """
    Regra: todo tenant deve ter as 3 categorias padrão (Combustível, Outros Gastos,
    Salário/Comissão), criadas automaticamente ao criar o tenant e, defensivamente,
    sob demanda caso estejam faltando (tenants antigos).
    """

    def test_tenant_creation_seeds_the_three_default_categories(self):
        tenant = make_tenant()
        keys = set(
            Category.objects.filter(tenant=tenant, type='expense').values_list('system_key', flat=True)
        )
        self.assertEqual(keys, {'fuel', 'other', 'salary'})

    def test_ensure_default_categories_is_idempotent(self):
        tenant = make_tenant()
        ensure_default_categories(tenant)
        ensure_default_categories(tenant)
        self.assertEqual(
            Category.objects.filter(tenant=tenant, type='expense', system_key='salary').count(), 1
        )

    def test_ensure_default_categories_adopts_preexisting_category_with_same_name(self):
        # Simula um tenant antigo que já tinha uma categoria "Combustível" criada
        # manualmente (em Transações) antes dessa funcionalidade existir — sem essa
        # proteção, ensure_default_categories tentaria criar outra igual e
        # quebraria por causa do unique_together (tenant, name, type).
        tenant = make_tenant()
        Category.objects.filter(tenant=tenant, system_key='fuel').delete()
        preexisting = Category.objects.create(tenant=tenant, name='Combustível', type='expense')
        self.assertEqual(preexisting.system_key, '')

        result = ensure_default_categories(tenant)

        self.assertEqual(Category.objects.filter(tenant=tenant, type='expense', name='Combustível').count(), 1)
        preexisting.refresh_from_db()
        self.assertEqual(preexisting.system_key, 'fuel')
        self.assertEqual(result['fuel'].id, preexisting.id)

    def test_ensure_default_category_recreates_missing_one(self):
        tenant = make_tenant()
        Category.objects.filter(tenant=tenant, system_key='salary').delete()
        self.assertFalse(Category.objects.filter(tenant=tenant, system_key='salary').exists())
        category = ensure_default_category(tenant, Category.SYSTEM_KEY_SALARY)
        self.assertEqual(category.name, 'Salário/Comissão')
        self.assertTrue(Category.objects.filter(tenant=tenant, system_key='salary').exists())


class DriverPaymentAutoExpenseTests(TestCase):
    """
    Regra: o valor pago ao motorista deve virar automaticamente um lançamento de
    despesa na categoria Salário/Comissão da viagem, sem duplicar o valor já
    contabilizado em Trip.expense_value (que soma driver_payment diretamente).
    """

    def setUp(self):
        self.tenant = make_tenant()
        self.vehicle = make_vehicle(self.tenant)

    def _make_trip(self, driver_payment, driver=None):
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
            driver_payment=Decimal(str(driver_payment)),
            driver=driver,
        )
        trip.sync_expense_movements()
        return trip

    def test_driver_payment_generates_auto_movement_in_salary_category(self):
        trip = self._make_trip(150)
        movement = trip.movements.get(expense_category='driver')
        self.assertTrue(movement.is_auto_generated)
        self.assertEqual(movement.amount, Decimal('150'))
        self.assertEqual(movement.category.system_key, Category.SYSTEM_KEY_SALARY)
        self.assertEqual(movement.category.name, 'Salário/Comissão')

    def test_zero_driver_payment_does_not_generate_movement(self):
        trip = self._make_trip(0)
        self.assertFalse(trip.movements.filter(expense_category='driver').exists())

    def test_driver_payment_movement_does_not_double_count_expense_value(self):
        trip = self._make_trip(150)
        trip.recalculate_from_movements()
        trip.refresh_from_db()
        # base_expense_value só deve refletir gastos 'other' (nenhum aqui) — o
        # pagamento do motorista não deve ser somado a partir do bucket 'other'.
        self.assertEqual(trip.base_expense_value, Decimal('0'))
        self.assertEqual(trip.expense_value, Decimal('150'))

    def test_missing_salary_category_is_recreated_automatically(self):
        # Simula um tenant antigo, sem a categoria Salário/Comissão.
        Category.objects.filter(tenant=self.tenant, system_key='salary').delete()
        trip = self._make_trip(200)
        movement = trip.movements.get(expense_category='driver')
        self.assertEqual(movement.category.system_key, 'salary')

    def test_driver_name_is_included_in_auto_movement_description(self):
        driver = Driver.objects.create(tenant=self.tenant, name='João da Silva', start_date='2020-01-01')
        trip = self._make_trip(150, driver=driver)
        movement = trip.movements.get(expense_category='driver')
        self.assertIn('João da Silva', movement.description)

    def test_updating_driver_payment_replaces_the_auto_movement(self):
        trip = self._make_trip(150)
        self.assertEqual(trip.movements.get(expense_category='driver').amount, Decimal('150'))
        trip.driver_payment = Decimal('300')
        trip.save()
        trip.sync_expense_movements()
        driver_movements = trip.movements.filter(expense_category='driver')
        self.assertEqual(driver_movements.count(), 1)
        self.assertEqual(driver_movements.first().amount, Decimal('300'))


class TripMovementSerializerCategoryTests(TestCase):
    """
    Regra: o lançamento manual de gasto/receita na viagem agora usa a categoria
    configurável (finance.Category) em vez do enum fixo fuel/other. O bucket de
    agregação (expense_category) é derivado da categoria escolhida, a descrição
    padrão da categoria preenche o lançamento quando o usuário não digitar nada,
    e a categoria precisa pertencer ao mesmo tenant da viagem.
    """

    def setUp(self):
        self.tenant = make_tenant()
        self.other_tenant = make_tenant(slug='outro-tenant')
        self.vehicle = make_vehicle(self.tenant)
        self.trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
        )
        self.fuel_category = Category.objects.get(tenant=self.tenant, system_key='fuel')
        self.other_category = Category.objects.get(tenant=self.tenant, system_key='other')

    def test_expense_category_bucket_is_derived_from_chosen_category(self):
        data = {
            'movement_type': 'expense',
            'category': self.fuel_category.id,
            'date': '2026-09-05',
            'amount': '100',
            'description': 'Diesel',
        }
        serializer = TripMovementSerializer(data=data, context={'tenant': self.tenant})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['expense_category'], 'fuel')

    def test_category_from_another_tenant_is_rejected(self):
        foreign_category = Category.objects.create(
            tenant=self.other_tenant, name='Pedágio', type='expense',
        )
        data = {
            'movement_type': 'expense',
            'category': foreign_category.id,
            'date': '2026-09-05',
            'amount': '10',
            'description': 'Pedágio',
        }
        serializer = TripMovementSerializer(data=data, context={'tenant': self.tenant})
        self.assertFalse(serializer.is_valid())
        self.assertIn('category', serializer.errors)

    def test_missing_description_is_filled_from_category_default(self):
        toll_category = Category.objects.create(
            tenant=self.tenant, name='Pedágio', type='expense',
            default_amount=Decimal('12.50'), default_entry_description='Pedágio da rota padrão',
        )
        data = {
            'movement_type': 'expense',
            'category': toll_category.id,
            'date': '2026-09-05',
            'amount': '12.50',
            'description': '',
        }
        serializer = TripMovementSerializer(data=data, context={'tenant': self.tenant})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['description'], 'Pedágio da rota padrão')

    def test_missing_description_without_category_default_is_required(self):
        data = {
            'movement_type': 'expense',
            'category': self.other_category.id,
            'date': '2026-09-05',
            'amount': '50',
            'description': '',
        }
        serializer = TripMovementSerializer(data=data, context={'tenant': self.tenant})
        self.assertFalse(serializer.is_valid())
        self.assertIn('description', serializer.errors)

    def test_category_is_required_for_expense_movements(self):
        data = {
            'movement_type': 'expense',
            'date': '2026-09-05',
            'amount': '50',
            'description': 'Algo',
        }
        serializer = TripMovementSerializer(data=data, context={'tenant': self.tenant})
        self.assertFalse(serializer.is_valid())
        self.assertIn('category', serializer.errors)


def make_authenticated_tenant_user(test_case, slug='api-tenant'):
    """Cria tenant + usuário autenticado, para testes de integração via API HTTP real."""
    tenant = Tenant.objects.create(
        name='Tenant API Teste', slug=slug, email='api@example.com', has_module_transport=True,
    )
    user = User.objects.create_user(
        username=f'user-{slug}', email=f'user-{slug}@example.com', password='SenhaForte123!',
        tenant=tenant, role=User.ROLE_ADMIN,
    )
    test_case.client.force_authenticate(user=user)
    return tenant, user


@override_settings(SECURE_SSL_REDIRECT=False)
class TripMovementApiFlowTests(APITestCase):
    """
    Testes de integração via API HTTP real (endpoints DRF), simulando o fluxo que
    o frontend (TransportTrips.jsx) usa após a reforma de categorias configuráveis:
    criar viagem com pagamento ao motorista, lançar uma movimentação manual
    escolhendo uma categoria, e ler as categorias por tipo.

    SECURE_SSL_REDIRECT é desativado aqui porque o .env local do projeto tem essa
    flag ligada (reflete produção); sem isso, o SecurityMiddleware devolve 301 para
    toda requisição HTTP feita pelo test client (que usa http://testserver/).
    """

    def setUp(self):
        self.tenant, self.user = make_authenticated_tenant_user(self, slug='api-tenant-1')
        self.vehicle = Vehicle.objects.create(
            tenant=self.tenant, plate='API1A23', model='Scania R450', year=2021, capacity=Decimal('28'),
        )

    def test_categories_by_type_lists_the_three_default_expense_categories(self):
        resp = self.client.get('/api/categories/by_type/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        expense_names = {c['name'] for c in resp.data['expense']}
        self.assertEqual(expense_names, {'Combustível', 'Outros Gastos', 'Salário/Comissão'})

    def test_create_trip_with_driver_payment_creates_salary_movement_visible_via_api(self):
        resp = self.client.post('/api/transport/trips/', {
            'vehicle': str(self.vehicle.id),
            'date': '2026-09-05',
            'start_date': '2026-09-05',
            'modality': 'per_ton',
            'tons': '10',
            'rate_per_ton': '100',
            'driver_payment': '150',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        trip_id = resp.data['id']
        self.assertEqual(resp.data['vehicle_plate'], 'API1A23')

        movements_resp = self.client.get(f'/api/transport/trips/{trip_id}/movements/')
        self.assertEqual(movements_resp.status_code, status.HTTP_200_OK)
        driver_movements = [m for m in movements_resp.data if m['expense_category'] == 'driver']
        self.assertEqual(len(driver_movements), 1)
        self.assertEqual(driver_movements[0]['category_name'], 'Salário/Comissão')
        self.assertEqual(Decimal(driver_movements[0]['amount']), Decimal('150.00'))

    def test_manual_movement_with_category_via_api(self):
        trip_resp = self.client.post('/api/transport/trips/', {
            'vehicle': str(self.vehicle.id),
            'date': '2026-09-05',
            'start_date': '2026-09-05',
            'modality': 'per_ton',
            'tons': '10',
            'rate_per_ton': '100',
        }, format='json')
        self.assertEqual(trip_resp.status_code, status.HTTP_201_CREATED, trip_resp.data)
        trip_id = trip_resp.data['id']

        other_category = Category.objects.get(tenant=self.tenant, system_key='other')
        movement_resp = self.client.post(f'/api/transport/trips/{trip_id}/movements/', {
            'date': '2026-09-05',
            'movement_type': 'expense',
            'category': str(other_category.id),
            'amount': '45.90',
            'description': 'Balsa',
        }, format='json')
        self.assertEqual(movement_resp.status_code, status.HTTP_201_CREATED, movement_resp.data)
        self.assertEqual(movement_resp.data['expense_category'], 'other')
        self.assertEqual(movement_resp.data['category_name'], 'Outros Gastos')

    def test_manual_movement_rejects_category_from_another_tenant(self):
        trip_resp = self.client.post('/api/transport/trips/', {
            'vehicle': str(self.vehicle.id),
            'date': '2026-09-05',
            'start_date': '2026-09-05',
            'modality': 'per_ton',
            'tons': '10',
            'rate_per_ton': '100',
        }, format='json')
        trip_id = trip_resp.data['id']

        other_tenant, _ = make_authenticated_tenant_user(self, slug='api-tenant-2')
        # volta a autenticar como o usuário original para fazer a chamada
        self.client.force_authenticate(user=self.user)
        foreign_category = Category.objects.get(tenant=other_tenant, system_key='other')

        movement_resp = self.client.post(f'/api/transport/trips/{trip_id}/movements/', {
            'date': '2026-09-05',
            'movement_type': 'expense',
            'category': str(foreign_category.id),
            'amount': '10',
            'description': 'Teste',
        }, format='json')
        self.assertEqual(movement_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_trip_without_end_date_gets_it_from_start_date_via_api(self):
        resp = self.client.post('/api/transport/trips/', {
            'vehicle': str(self.vehicle.id),
            'date': '2026-09-05',
            'start_date': '2026-09-05',
            'modality': 'per_ton',
            'tons': '10',
            'rate_per_ton': '100',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(resp.data['end_date'], '2026-09-05')


@override_settings(SECURE_SSL_REDIRECT=False)
class MonthlyClosingReportDriverPaymentTests(APITestCase):
    """
    Regra: o relatório de fechamento mensal não pode contar o pagamento ao
    motorista duas vezes. Antes da correção, o lançamento automático gerado na
    categoria Salário/Comissão (criado por Trip.sync_expense_movements) entrava
    na soma "despesas lançadas no período" (que deveria ser só combustível +
    outros gastos) e o mesmo valor era somado de novo via total_driver_payment
    (Trip.driver_payment), inflando a despesa e reduzindo o resultado do período
    a mais do que deveria.
    """

    def setUp(self):
        self.tenant, self.user = make_authenticated_tenant_user(self, slug='fechamento-tenant')
        self.vehicle = make_vehicle(self.tenant, plate='FEC1H01')
        self.trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            end_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('1000'),
            # total_value normalmente é calculado por TripSerializer._compute_values()
            # (não pelo model); como este teste cria a viagem direto via ORM, setamos
            # à mão para refletir tons * rate_per_ton = 10000.
            total_value=Decimal('10000'),
            base_expense_value=Decimal('200'),
            fuel_expense_value=Decimal('300'),
            driver_payment=Decimal('400'),
        )
        self.trip.sync_expense_movements()  # gera os lançamentos automáticos, incluindo o de salário

    def _get_financial_summary(self):
        with patch('transport.report_views.TransportReportView._build_monthly_closing_pdf', return_value=b'%PDF-fake') as mocked:
            resp = self.client.get('/api/transport/reports/', {
                'report_type': 'monthly_closing',
                'vehicle_id': str(self.vehicle.id),
                'start_date': '2026-09-01',
                'end_date': '2026-09-30',
            })
        self.assertEqual(resp.status_code, status.HTTP_200_OK, getattr(resp, 'data', resp.content))
        self.assertEqual(mocked.call_count, 1)
        return dict(mocked.call_args.kwargs['financial_summary'])

    def test_driver_payment_movement_is_excluded_from_general_expenses_total(self):
        summary = self._get_financial_summary()
        # base_expense_value (200) + fuel_expense_value (300) = 500, SEM o salário
        self.assertEqual(summary['Despesas lançadas no período (combustível + outros gastos)'], 'R$ 500,00')

    def test_driver_payment_is_reported_once_in_its_own_line(self):
        summary = self._get_financial_summary()
        self.assertEqual(summary['Pagamento ao motorista (viagens do período)'], 'R$ 400,00')

    def test_period_result_does_not_double_count_driver_payment(self):
        summary = self._get_financial_summary()
        # total_value (10000) - despesas gerais (500) - motorista (400) = 9100.
        # Antes da correção, o resultado saía 8700 (motorista descontado 2x).
        self.assertEqual(summary['Resultado do período'], 'R$ 9.100,00')


@override_settings(SECURE_SSL_REDIRECT=False)
class ReportCustomCategoryLabelTests(APITestCase):
    """
    Regra: os relatórios devem mostrar o nome real da categoria escolhida no
    lançamento (finance.Category), não o bucket interno de agregação
    (expense_category: fuel/other/driver). Antes da correção, qualquer categoria
    personalizada — que cai no bucket 'other' — aparecia como "Outros Gastos" em
    vez do próprio nome, e o "Resumo de despesas por categoria" somava todas as
    categorias personalizadas juntas numa única linha "Outros Gastos".
    """

    def setUp(self):
        self.tenant, self.user = make_authenticated_tenant_user(self, slug='relatorio-categoria')
        self.vehicle = make_vehicle(self.tenant, plate='CAT1E02')
        self.toll_category = Category.objects.create(
            tenant=self.tenant, name='Pedágio', type='expense',
        )
        self.tire_category = Category.objects.create(
            tenant=self.tenant, name='Borracharia', type='expense',
        )
        self.trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            end_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
            total_value=Decimal('1000'),
        )
        TripMovement.objects.create(
            trip=self.trip, date='2026-09-05', movement_type='expense',
            expense_category='other', category=self.toll_category,
            amount=Decimal('25'), description='Pedágio BR-101',
        )
        TripMovement.objects.create(
            trip=self.trip, date='2026-09-05', movement_type='expense',
            expense_category='other', category=self.tire_category,
            amount=Decimal('180'), description='Troca de pneu',
        )

    def test_movements_report_shows_real_category_name(self):
        resp = self.client.get('/api/transport/reports/', {'report_type': 'movements'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        labels = {row['expense_category_label'] for row in resp.data['rows']}
        self.assertEqual(labels, {'Pedágio', 'Borracharia'})
        self.assertNotIn('Outros gastos', labels)

    def test_summary_report_keeps_custom_categories_separate(self):
        resp = self.client.get('/api/transport/reports/', {'report_type': 'summary'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        by_label = {row['expense_category_label']: row for row in resp.data['rows']}
        self.assertIn('Pedágio', by_label)
        self.assertIn('Borracharia', by_label)
        self.assertNotIn('Outros gastos', by_label)
        self.assertEqual(by_label['Pedágio']['total'], '25.00')
        self.assertEqual(by_label['Borracharia']['total'], '180.00')


class SyncExpenseMovementsResyncTests(TestCase):
    """
    Regra: rodar sync_expense_movements() numa viagem que JÁ tem lançamentos
    automáticos de uma sincronização anterior (o caso real de editar uma viagem
    existente) não pode zerar base_expense_value/fuel_expense_value nem deixar de
    recriar os lançamentos de combustível e outros gastos.

    Causa raiz do bug: `self.movements` é o related manager reverso da FK, então o
    Django cacheia `self` como o `.trip` dos objetos retornados por ele. O sinal
    post_delete disparado por `existing_auto_movements.delete()` roda
    `instance.trip.recalculate_from_movements()` — como `instance.trip is self`,
    isso zera os campos no MESMO objeto que o método ainda está usando, antes de
    recriar os lançamentos novos.
    """

    def setUp(self):
        self.tenant = make_tenant()
        self.vehicle = make_vehicle(self.tenant)
        self.trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
            total_value=Decimal('1000'),
            base_expense_value=Decimal('50'),
            fuel_expense_value=Decimal('80'),
            driver_payment=Decimal('120'),
            expense_value=Decimal('250'),
        )
        self.trip.sync_expense_movements()

    def test_resync_after_edit_preserves_base_and_fuel_expense(self):
        trip = Trip.objects.get(pk=self.trip.pk)
        trip.driver_payment = Decimal('200')
        trip.expense_value = trip.base_expense_value + trip.fuel_expense_value + trip.driver_payment
        trip.save()
        trip.sync_expense_movements()

        fresh = Trip.objects.get(pk=self.trip.pk)
        self.assertEqual(fresh.base_expense_value, Decimal('50.00'))
        self.assertEqual(fresh.fuel_expense_value, Decimal('80.00'))
        self.assertEqual(fresh.driver_payment, Decimal('200.00'))
        self.assertEqual(fresh.expense_value, Decimal('330.00'))

    def test_resync_after_edit_recreates_fuel_and_other_movements(self):
        trip = Trip.objects.get(pk=self.trip.pk)
        trip.driver_payment = Decimal('200')
        trip.save()
        trip.sync_expense_movements()

        categories = sorted(trip.movements.filter(is_auto_generated=True).values_list('expense_category', flat=True))
        self.assertEqual(categories, ['driver', 'fuel', 'other'])

    def test_third_resync_still_keeps_values_correct(self):
        # Garante que o bug não reaparece depois de múltiplas edições seguidas.
        trip = Trip.objects.get(pk=self.trip.pk)
        for driver_payment in (Decimal('150'), Decimal('175'), Decimal('220')):
            trip = Trip.objects.get(pk=self.trip.pk)
            trip.driver_payment = driver_payment
            trip.save()
            trip.sync_expense_movements()

        fresh = Trip.objects.get(pk=self.trip.pk)
        self.assertEqual(fresh.base_expense_value, Decimal('50.00'))
        self.assertEqual(fresh.fuel_expense_value, Decimal('80.00'))
        self.assertEqual(fresh.expense_value, Decimal('350.00'))  # 50 + 80 + 220


class FixTripExpenseCorruptionCommandTests(TestCase):
    """
    Testa o comando de correção retroativa (fix_trip_expense_corruption) usado
    para produção: precisa apontar viagens com a assinatura do bug antigo (para
    revisão manual, já que o valor original está perdido) e rodar a fase de
    resync sem erro sobre viagens normais e já corrompidas.
    """

    def setUp(self):
        self.tenant = make_tenant()
        self.vehicle = make_vehicle(self.tenant)

    def _make_corrupted_trip(self):
        """Recria à mão o estado exato que o bug antigo deixava: só o lançamento
        de driver sobrevive, base/fuel zerados na viagem e sem lançamentos."""
        salary_category = ensure_default_category(self.tenant, Category.SYSTEM_KEY_SALARY)
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-08-01',
            start_date='2026-08-01',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
            total_value=Decimal('1000'),
            base_expense_value=Decimal('0'),
            fuel_expense_value=Decimal('0'),
            driver_payment=Decimal('150'),
            expense_value=Decimal('150'),
        )
        TripMovement.objects.create(
            trip=trip, date='2026-08-01', movement_type='expense', expense_category='driver',
            category=salary_category, amount=Decimal('150'), description='Pagamento ao motorista',
            is_auto_generated=True,
        )
        return trip

    def _make_healthy_trip(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-08-02',
            start_date='2026-08-02',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
            total_value=Decimal('1000'),
            base_expense_value=Decimal('30'),
            fuel_expense_value=Decimal('40'),
            driver_payment=Decimal('0'),
        )
        trip.sync_expense_movements()
        return trip

    def test_dry_run_flags_corrupted_trip_without_changing_it(self):
        corrupted = self._make_corrupted_trip()
        healthy = self._make_healthy_trip()

        out = io.StringIO()
        call_command('fix_trip_expense_corruption', '--dry-run', stdout=out)
        output = out.getvalue()

        self.assertIn(f'viagem #{corrupted.id}', output)
        self.assertNotIn(f'viagem #{healthy.id}', output)
        self.assertIn('pulando as fases 2 e 3', output)

        # --dry-run não deve ter alterado nada
        corrupted.refresh_from_db()
        self.assertEqual(corrupted.base_expense_value, Decimal('0.00'))

    def test_full_run_resyncs_without_crashing_and_lists_corrupted_trip(self):
        corrupted = self._make_corrupted_trip()
        self._make_healthy_trip()

        out = io.StringIO()
        call_command('fix_trip_expense_corruption', stdout=out)
        output = out.getvalue()

        self.assertIn(f'viagem #{corrupted.id}', output)
        self.assertIn('resincronizada', output)

    def test_tenant_id_filter_only_checks_that_tenant(self):
        other_tenant = make_tenant(slug='outro-tenant-fix')
        other_vehicle = make_vehicle(other_tenant, plate='OUT9Z99')
        other_trip = Trip.objects.create(
            vehicle=other_vehicle, date='2026-08-01', start_date='2026-08-01', modality='per_ton',
            tons=Decimal('1'), rate_per_ton=Decimal('1'), total_value=Decimal('1'),
            base_expense_value=Decimal('0'), fuel_expense_value=Decimal('0'), driver_payment=Decimal('50'),
        )
        salary_category = ensure_default_category(other_tenant, Category.SYSTEM_KEY_SALARY)
        TripMovement.objects.create(
            trip=other_trip, date='2026-08-01', movement_type='expense', expense_category='driver',
            category=salary_category, amount=Decimal('50'), is_auto_generated=True,
        )
        corrupted = self._make_corrupted_trip()

        out = io.StringIO()
        call_command('fix_trip_expense_corruption', '--dry-run', '--tenant-id', str(self.tenant.id), stdout=out)
        output = out.getvalue()

        self.assertIn(f'viagem #{corrupted.id}', output)
        self.assertNotIn(f'viagem #{other_trip.id}', output)

    def test_backfills_category_on_legacy_movements_without_touching_others(self):
        # Lançamento manual antigo, de antes da FK category existir: expense_category
        # preenchido, mas category em branco.
        legacy_trip = Trip.objects.create(
            vehicle=self.vehicle, date='2026-08-03', start_date='2026-08-03', modality='per_ton',
            tons=Decimal('1'), rate_per_ton=Decimal('1'), total_value=Decimal('1'),
        )
        legacy_fuel = TripMovement.objects.create(
            trip=legacy_trip, date='2026-08-03', movement_type='expense',
            expense_category='fuel', category=None, amount=Decimal('90'),
            description='Diesel', is_auto_generated=False,
        )
        legacy_other = TripMovement.objects.create(
            trip=legacy_trip, date='2026-08-03', movement_type='expense',
            expense_category='other', category=None, amount=Decimal('15'),
            description='Balsa antiga', is_auto_generated=False,
        )
        # Já tinha uma categoria própria vinculada (Pedágio) — não pode ser
        # substituída pela categoria genérica "Outros Gastos" do bucket.
        toll_category = Category.objects.create(tenant=self.tenant, name='Pedágio', type='expense')
        already_linked = TripMovement.objects.create(
            trip=legacy_trip, date='2026-08-03', movement_type='expense',
            expense_category='other', category=toll_category, amount=Decimal('20'),
            description='Já linkado', is_auto_generated=False,
        )

        out = io.StringIO()
        call_command('fix_trip_expense_corruption', stdout=out)
        output = out.getvalue()

        self.assertIn('lançamento(s) com categoria vinculada retroativamente', output)
        legacy_fuel.refresh_from_db()
        legacy_other.refresh_from_db()
        already_linked.refresh_from_db()
        self.assertEqual(legacy_fuel.category.system_key, Category.SYSTEM_KEY_FUEL)
        self.assertEqual(legacy_other.category.system_key, Category.SYSTEM_KEY_OTHER)
        self.assertEqual(already_linked.category_id, toll_category.id)


@override_settings(SECURE_SSL_REDIRECT=False)
class AutoGeneratedMovementsHaveCategoryLinkedTests(APITestCase):
    """
    Regra: os lançamentos automáticos de combustível e outros gastos (criados a
    partir de Trip.fuel_expense_value / base_expense_value) precisam ficar
    vinculados à categoria real (finance.Category), não só ao bucket interno
    (expense_category). Sem isso, esses lançamentos ficam com category_id em
    branco e caem numa linha separada dos lançamentos manuais da mesma categoria
    nos relatórios — ex.: "Combustível" aparecendo duas vezes no Resumo por
    Categoria, uma para os automáticos (sem categoria vinculada) e outra para os
    manuais, cada uma com seu próprio total, dando a impressão de duplicidade.
    """

    def setUp(self):
        self.tenant = make_tenant()
        self.vehicle = make_vehicle(self.tenant)

    def test_auto_generated_fuel_and_other_movements_get_real_category(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
            base_expense_value=Decimal('50'),
            fuel_expense_value=Decimal('80'),
        )
        trip.sync_expense_movements()

        fuel_movement = trip.movements.get(expense_category='fuel')
        other_movement = trip.movements.get(expense_category='other')
        self.assertIsNotNone(fuel_movement.category_id)
        self.assertIsNotNone(other_movement.category_id)
        self.assertEqual(fuel_movement.category.system_key, Category.SYSTEM_KEY_FUEL)
        self.assertEqual(other_movement.category.system_key, Category.SYSTEM_KEY_OTHER)

    def test_expense_items_movements_also_get_real_category(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle,
            date='2026-09-05',
            start_date='2026-09-05',
            modality='per_ton',
            tons=Decimal('10'),
            rate_per_ton=Decimal('100'),
            expense_items=[{'valor': '30', 'descricao': 'Balsa'}],
        )
        trip.sync_expense_movements()

        movement = trip.movements.get(expense_category='other')
        self.assertIsNotNone(movement.category_id)
        self.assertEqual(movement.category.system_key, Category.SYSTEM_KEY_OTHER)

    def test_summary_report_no_longer_splits_auto_and_manual_fuel_into_two_rows(self):
        tenant, user = make_authenticated_tenant_user(self, slug='resumo-sem-duplicata')
        vehicle = make_vehicle(tenant, plate='NDU1P23')
        auto_trip = Trip.objects.create(
            vehicle=vehicle, date='2026-09-05', start_date='2026-09-05', modality='per_ton',
            tons=Decimal('10'), rate_per_ton=Decimal('100'), fuel_expense_value=Decimal('100'),
        )
        auto_trip.sync_expense_movements()

        fuel_category = Category.objects.get(tenant=tenant, system_key='fuel')
        manual_trip = Trip.objects.create(
            vehicle=vehicle, date='2026-09-06', start_date='2026-09-06', modality='per_ton',
            tons=Decimal('5'), rate_per_ton=Decimal('100'),
        )
        TripMovement.objects.create(
            trip=manual_trip, date='2026-09-06', movement_type='expense',
            expense_category='fuel', category=fuel_category, amount=Decimal('60'),
            description='Diesel', is_auto_generated=False,
        )

        resp = self.client.get('/api/transport/reports/', {'report_type': 'summary'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        fuel_rows = [row for row in resp.data['rows'] if row['expense_category_label'] == 'Combustível']
        self.assertEqual(len(fuel_rows), 1)
        self.assertEqual(fuel_rows[0]['total'], '160.00')
        self.assertEqual(fuel_rows[0]['count'], 2)


class RecalculateFromMovementsDoesNotDoubleCountTests(TestCase):
    """
    Regra: recalculate_from_movements() precisa somar só os lançamentos MANUAIS
    (is_auto_generated=False). Os automáticos são um espelho gerado por
    sync_expense_movements() a partir de base_expense_value/fuel_expense_value —
    somá-los de volta cria uma referência circular: o espelho conta a si mesmo
    junto com os lançamentos manuais que ele resume, dobrando o valor sempre que
    algo dispara um recálculo depois do espelho já existir (ex.: vincular a
    categoria de um lançamento automático antigo, como o comando
    fix_trip_expense_corruption faz retroativamente em produção).

    Causa raiz real encontrada em produção: uma viagem tinha 10 lançamentos
    manuais somando R$ 4.889,37 (outros gastos) e R$ 9.963,76 (combustível), mais
    um lançamento automático antigo (sem categoria vinculada, de antes da FK
    category existir) espelhando esses mesmos totais. Vincular a categoria desse
    lançamento automático antigo disparava o sinal post_save, que recalculava
    somando manual + espelho = o dobro.
    """

    def setUp(self):
        self.tenant = make_tenant()
        self.vehicle = make_vehicle(self.tenant)

    def test_recalculating_after_touching_a_stale_auto_movement_does_not_double(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle, date='2026-08-25', start_date='2026-08-25', modality='per_ton',
            tons=Decimal('56.31'), rate_per_ton=Decimal('270'), total_value=Decimal('15203.70'),
            base_expense_value=Decimal('4889.37'), fuel_expense_value=Decimal('9963.76'),
            driver_payment=Decimal('1672.41'), expense_value=Decimal('16525.54'),
        )
        manual = [
            ('other', Decimal('50.00')), ('other', Decimal('104.00')), ('other', Decimal('104.00')),
            ('other', Decimal('104.40')), ('fuel', Decimal('1340.00')), ('fuel', Decimal('4737.50')),
            ('other', Decimal('3980.00')), ('other', Decimal('247.00')), ('other', Decimal('299.97')),
            ('fuel', Decimal('3886.26')),
        ]
        for cat, amount in manual:
            TripMovement.objects.create(
                trip=trip, date='2026-08-25', movement_type='expense', expense_category=cat,
                category=None, amount=amount, is_auto_generated=False,
            )
        # Lançamento automático antigo, sem categoria (o "espelho" de uma sincronização anterior)
        stale_other = TripMovement.objects.create(
            trip=trip, date='2026-08-25', movement_type='expense', expense_category='other',
            category=None, amount=Decimal('4889.37'), is_auto_generated=True,
        )
        stale_fuel = TripMovement.objects.create(
            trip=trip, date='2026-08-25', movement_type='expense', expense_category='fuel',
            category=None, amount=Decimal('9963.76'), is_auto_generated=True,
        )

        # Simula o backfill de categoria (fix_trip_expense_corruption Fase 2) tocando
        # os lançamentos automáticos antigos — isso dispara recalculate_from_movements().
        other_category = ensure_default_category(self.tenant, Category.SYSTEM_KEY_OTHER)
        fuel_category = ensure_default_category(self.tenant, Category.SYSTEM_KEY_FUEL)
        stale_other.category = other_category
        stale_other.save(update_fields=['category'])
        stale_fuel.category = fuel_category
        stale_fuel.save(update_fields=['category'])

        trip.refresh_from_db()
        self.assertEqual(trip.base_expense_value, Decimal('4889.37'))
        self.assertEqual(trip.fuel_expense_value, Decimal('9963.76'))

    def test_form_only_trip_without_manual_movements_is_not_zeroed(self):
        # Viagem preenchida só pelo formulário completo (Outros gastos/Combustível
        # direto na viagem), sem nenhum lançamento manual em "Lançar movimentação".
        trip = Trip.objects.create(
            vehicle=self.vehicle, date='2026-08-01', start_date='2026-08-01', modality='per_ton',
            tons=Decimal('5'), rate_per_ton=Decimal('100'),
            base_expense_value=Decimal('500'), fuel_expense_value=Decimal('300'),
        )
        trip.sync_expense_movements()  # cria só o espelho automático, sem nenhum manual

        auto_movement = trip.movements.get(expense_category='other', is_auto_generated=True)
        auto_movement.category = ensure_default_category(self.tenant, Category.SYSTEM_KEY_OTHER)
        auto_movement.save(update_fields=['category'])  # dispara recalculate_from_movements()

        trip.refresh_from_db()
        self.assertEqual(trip.base_expense_value, Decimal('500'))
        self.assertEqual(trip.fuel_expense_value, Decimal('300'))

    def test_recalculate_still_sums_manual_movements_correctly(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle, date='2026-08-01', start_date='2026-08-01', modality='per_ton',
            tons=Decimal('5'), rate_per_ton=Decimal('100'),
        )
        TripMovement.objects.create(
            trip=trip, date='2026-08-01', movement_type='expense', expense_category='other',
            amount=Decimal('30'), is_auto_generated=False,
        )
        TripMovement.objects.create(
            trip=trip, date='2026-08-01', movement_type='expense', expense_category='other',
            amount=Decimal('20'), is_auto_generated=False,
        )
        trip.recalculate_from_movements()
        trip.refresh_from_db()
        self.assertEqual(trip.base_expense_value, Decimal('50'))

    def test_fix_command_repairs_a_trip_already_doubled_by_the_old_bug(self):
        # Estado exatamente igual ao encontrado em produção/na cópia de teste local:
        # a viagem já ficou com o valor dobrado por uma execução anterior do
        # comando, antes desta correção existir.
        trip = Trip.objects.create(
            vehicle=self.vehicle, date='2026-08-25', start_date='2026-08-25', modality='per_ton',
            tons=Decimal('56.31'), rate_per_ton=Decimal('270'), total_value=Decimal('15203.70'),
            base_expense_value=Decimal('9778.74'), fuel_expense_value=Decimal('19927.52'),
            driver_payment=Decimal('1672.41'), expense_value=Decimal('31378.67'),
        )
        manual = [
            ('other', Decimal('50.00')), ('other', Decimal('104.00')), ('other', Decimal('104.00')),
            ('other', Decimal('104.40')), ('fuel', Decimal('1340.00')), ('fuel', Decimal('4737.50')),
            ('other', Decimal('3980.00')), ('other', Decimal('247.00')), ('other', Decimal('299.97')),
            ('fuel', Decimal('3886.26')),
        ]
        for cat, amount in manual:
            TripMovement.objects.create(
                trip=trip, date='2026-08-25', movement_type='expense', expense_category=cat,
                category=None, amount=amount, is_auto_generated=False,
            )
        TripMovement.objects.create(
            trip=trip, date='2026-08-25', movement_type='expense', expense_category='other',
            category=None, amount=Decimal('9778.74'), is_auto_generated=True,
        )
        TripMovement.objects.create(
            trip=trip, date='2026-08-25', movement_type='expense', expense_category='fuel',
            category=None, amount=Decimal('19927.52'), is_auto_generated=True,
        )

        call_command('fix_trip_expense_corruption')

        trip.refresh_from_db()
        self.assertEqual(trip.base_expense_value, Decimal('4889.37'))
        self.assertEqual(trip.fuel_expense_value, Decimal('9963.76'))
        self.assertEqual(trip.expense_value, Decimal('16525.54'))


@override_settings(SECURE_SSL_REDIRECT=False)
class SyncExpenseMovementsSkipsRedundantMirrorTests(APITestCase):
    """
    Quando a viagem já tem lançamento MANUAL de uma categoria (fuel/other/driver),
    sync_expense_movements() não deve criar o espelho automático dessa mesma
    categoria: o total já está inteiramente representado pelos lançamentos
    manuais. Criar o espelho mesmo assim tinha dois efeitos ruins observados em
    produção numa viagem real (#261, GIT2I16): 1) o Resumo por Categoria de
    Despesa soma TripMovement.amount por categoria sem excluir automáticos, então
    a categoria aparecia com o dobro do valor real; 2) a lista de lançamentos da
    viagem mostrava um item extra "Sem descrição"/"Combustível" que o usuário não
    reconhecia, porque ele nunca criou esse lançamento — o sistema que criou.
    """

    def setUp(self):
        self.tenant, self.user = make_authenticated_tenant_user(self, slug='sem-espelho-redundante')
        self.vehicle = make_vehicle(self.tenant, plate='GIT2I16')

    def test_sync_does_not_create_auto_mirror_when_manual_movements_cover_the_category(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle, date='2026-08-25', start_date='2026-08-25', modality='per_ton',
            tons=Decimal('56.31'), rate_per_ton=Decimal('270'), total_value=Decimal('15203.70'),
            driver_payment=Decimal('1672.41'),
        )
        manual = [
            ('other', Decimal('50.00')), ('other', Decimal('104.00')), ('other', Decimal('104.00')),
            ('other', Decimal('104.40')), ('fuel', Decimal('1340.00')), ('fuel', Decimal('4737.50')),
            ('other', Decimal('3980.00')), ('other', Decimal('247.00')), ('other', Decimal('299.97')),
            ('fuel', Decimal('3886.26')),
        ]
        for cat, amount in manual:
            TripMovement.objects.create(
                trip=trip, date='2026-08-25', movement_type='expense', expense_category=cat,
                category=None, amount=amount, is_auto_generated=False,
            )

        trip.recalculate_from_movements()
        trip.sync_expense_movements()

        trip.refresh_from_db()
        self.assertEqual(trip.base_expense_value, Decimal('4889.37'))
        self.assertEqual(trip.fuel_expense_value, Decimal('9963.76'))
        self.assertEqual(trip.expense_value, Decimal('16525.54'))

        auto_movements = trip.movements.filter(is_auto_generated=True)
        self.assertEqual(auto_movements.filter(expense_category='other').count(), 0)
        self.assertEqual(auto_movements.filter(expense_category='fuel').count(), 0)
        # O motorista não tem lançamento manual equivalente nesta viagem, então o
        # espelho de driver continua sendo criado normalmente.
        self.assertEqual(auto_movements.filter(expense_category='driver').count(), 1)
        self.assertEqual(trip.movements.count(), 11)

    def test_summary_report_does_not_double_a_category_that_has_manual_and_would_be_mirror(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle, date='2026-08-25', start_date='2026-08-25', modality='per_ton',
            tons=Decimal('56.31'), rate_per_ton=Decimal('270'), total_value=Decimal('15203.70'),
        )
        fuel_category = Category.objects.get(tenant=self.tenant, system_key='fuel')
        TripMovement.objects.create(
            trip=trip, date='2026-08-25', movement_type='expense', expense_category='fuel',
            category=fuel_category, amount=Decimal('300'), is_auto_generated=False,
        )
        trip.recalculate_from_movements()
        trip.sync_expense_movements()

        resp = self.client.get('/api/transport/reports/', {'report_type': 'summary'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        fuel_rows = [row for row in resp.data['rows'] if row['expense_category_label'] == 'Combustível']
        self.assertEqual(len(fuel_rows), 1)
        self.assertEqual(fuel_rows[0]['total'], '300.00')
        self.assertEqual(fuel_rows[0]['count'], 1)

    def test_deleting_all_manual_movements_lets_the_mirror_come_back(self):
        trip = Trip.objects.create(
            vehicle=self.vehicle, date='2026-08-25', start_date='2026-08-25', modality='per_ton',
            tons=Decimal('56.31'), rate_per_ton=Decimal('270'), total_value=Decimal('15203.70'),
        )
        manual = TripMovement.objects.create(
            trip=trip, date='2026-08-25', movement_type='expense', expense_category='fuel',
            category=None, amount=Decimal('300'), is_auto_generated=False,
        )
        trip.recalculate_from_movements()
        trip.sync_expense_movements()
        self.assertEqual(trip.movements.filter(is_auto_generated=True, expense_category='fuel').count(), 0)

        manual.delete()
        trip.refresh_from_db()
        trip.sync_expense_movements()

        auto_fuel = trip.movements.filter(is_auto_generated=True, expense_category='fuel')
        self.assertEqual(auto_fuel.count(), 1)
        self.assertEqual(auto_fuel.first().amount, Decimal('300'))
