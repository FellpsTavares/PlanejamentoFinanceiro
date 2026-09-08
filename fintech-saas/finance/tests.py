from decimal import Decimal

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Tenant, User
from finance.models import Category


@override_settings(SECURE_SSL_REDIRECT=False)
class CategoryDefaultFieldsApiTests(APITestCase):
    """
    Regra: em Configurações > Categorias agora é possível definir um valor e uma
    descrição padrão por categoria (pensado para categorias de preço fixo, como
    pedágio ou marcação de placa). Testa a API real (/api/categories/) usada pela
    tela de Configurações.
    """

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name='Tenant Categorias', slug='tenant-categorias', email='cat@example.com',
        )
        self.user = User.objects.create_user(
            username='user-categorias', email='user-categorias@example.com', password='SenhaForte123!',
            tenant=self.tenant, role=User.ROLE_ADMIN,
        )
        self.client.force_authenticate(user=self.user)

    def test_create_category_with_default_amount_and_description(self):
        resp = self.client.post('/api/categories/', {
            'name': 'Pedágio',
            'type': 'expense',
            'default_amount': '12.50',
            'default_entry_description': 'Pedágio da rota padrão',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(Decimal(resp.data['default_amount']), Decimal('12.50'))
        self.assertEqual(resp.data['default_entry_description'], 'Pedágio da rota padrão')
        # system_key é somente leitura: não deve ser possível setar via API
        self.assertEqual(resp.data['system_key'], '')

    def test_create_category_without_default_amount_leaves_it_null(self):
        resp = self.client.post('/api/categories/', {
            'name': 'Diversos',
            'type': 'expense',
            'default_amount': None,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertIsNone(resp.data['default_amount'])

    def test_client_cannot_set_system_key_via_api(self):
        resp = self.client.post('/api/categories/', {
            'name': 'Falso Combustível',
            'type': 'expense',
            'system_key': 'fuel',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(resp.data['system_key'], '')
        # a categoria "Combustível" de verdade (semeada na criação do tenant)
        # continua sendo a única com system_key='fuel'
        self.assertEqual(Category.objects.filter(tenant=self.tenant, system_key='fuel').count(), 1)

    def test_update_category_default_amount(self):
        category = Category.objects.create(tenant=self.tenant, name='Balsa', type='expense')
        resp = self.client.patch(f'/api/categories/{category.id}/', {
            'default_amount': '28.00',
            'default_entry_description': 'Travessia de balsa',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        category.refresh_from_db()
        self.assertEqual(category.default_amount, Decimal('28.00'))
        self.assertEqual(category.default_entry_description, 'Travessia de balsa')
