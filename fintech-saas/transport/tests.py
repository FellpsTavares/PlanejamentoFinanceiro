from decimal import Decimal
from unittest.mock import patch

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
