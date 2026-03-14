from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.models import Tenant
from finance.models import Category, Transaction
from datetime import datetime, timedelta
from decimal import Decimal
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Popula o banco de dados com dados iniciais para testes'
    
    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Iniciando seed data...'))
        
        # 1. Criar Tenant
        tenant, created = Tenant.objects.get_or_create(
            slug='demo',
            defaults={
                'name': 'Demo Company',
                'description': 'Empresa de demonstração',
                'email': 'demo@example.com',
                'phone': '(11) 9999-9999',
                'is_active': True,
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'v Tenant criado: {tenant.name}'))
        else:
            self.stdout.write(self.style.WARNING(f'v Tenant já existe: {tenant.name}'))
        
        # 2. Criar usuário administrador padrão
        admin_email = 'fellipetavares@outlook.com'
        admin_password = 'demo123456'

        user, created = User.objects.update_or_create(
            email=admin_email,
            tenant=tenant,
            defaults={
                'username': 'administrador',
                'first_name': 'Administrador',
                'last_name': '',
                'is_verified': True,
                'preferred_currency': 'BRL',
                'role': User.ROLE_ADMIN,
                'is_active': True,
            }
        )

        if created or not user.check_password(admin_password):
            user.set_password(admin_password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'v Usuário administrador configurado: {user.email}'))
        else:
            self.stdout.write(self.style.WARNING(f'v Usuário administrador já existe: {user.email}'))
        
        # 3. Criar categorias de receita
        income_categories = [
            {'name': 'Salário', 'icon': '💰', 'color': '#10B981'},
            {'name': 'Freelance', 'icon': '💻', 'color': '#3B82F6'},
            {'name': 'Investimentos', 'icon': '📈', 'color': '#8B5CF6'},
            {'name': 'Outros', 'icon': '🎁', 'color': '#F59E0B'},
        ]
        
        tenants = Tenant.objects.all()
        for current_tenant in tenants:
            for cat_data in income_categories:
                category, created = Category.objects.get_or_create(
                    tenant=current_tenant,
                    name=cat_data['name'],
                    type='income',
                    defaults={
                        'icon': cat_data['icon'],
                        'color': cat_data['color'],
                        'is_active': True,
                    }
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f'v Categoria (receita) criada: {category.name} | tenant={current_tenant.slug}'))
        
        # 4. Criar categorias de despesa
        expense_categories = [
            {'name': 'Alimentação', 'icon': '🍔', 'color': '#EF4444'},
            {'name': 'Transporte', 'icon': '🚗', 'color': '#F97316'},
            {'name': 'Moradia', 'icon': '🏠', 'color': '#EC4899'},
            {'name': 'Saúde', 'icon': '🏥', 'color': '#06B6D4'},
            {'name': 'Educação', 'icon': '📚', 'color': '#6366F1'},
            {'name': 'Entretenimento', 'icon': '🎬', 'color': '#A855F7'},
            {'name': 'Utilidades', 'icon': '💡', 'color': '#14B8A6'},
            {'name': 'Outros', 'icon': '❓', 'color': '#64748B'},
        ]
        
        for current_tenant in tenants:
            for cat_data in expense_categories:
                category, created = Category.objects.get_or_create(
                    tenant=current_tenant,
                    name=cat_data['name'],
                    type='expense',
                    defaults={
                        'icon': cat_data['icon'],
                        'color': cat_data['color'],
                        'is_active': True,
                    }
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f'v Categoria (despesa) criada: {category.name} | tenant={current_tenant.slug}'))
        
        # 5. Criar transações de exemplo
        today = datetime.now().date()
        
        # Receitas
        income_cat = Category.objects.get(tenant=tenant, name='Salário', type='income')
        Transaction.objects.get_or_create(
            tenant=tenant,
            user=user,
            description='Salário mensal',
            defaults={
                'amount': Decimal('5000.00'),
                'type': 'income',
                'category': income_cat,
                'transaction_date': today,
                'status': 'completed',
            }
        )
        
        # Despesas
        expense_transactions = [
            {'desc': 'Supermercado', 'amount': '250.50', 'cat': 'Alimentação'},
            {'desc': 'Uber', 'amount': '45.00', 'cat': 'Transporte'},
            {'desc': 'Aluguel', 'amount': '1500.00', 'cat': 'Moradia'},
            {'desc': 'Netflix', 'amount': '39.90', 'cat': 'Entretenimento'},
            {'desc': 'Farmácia', 'amount': '120.00', 'cat': 'Saúde'},
            {'desc': 'Combustível', 'amount': '200.00', 'cat': 'Transporte'},
            {'desc': 'Restaurante', 'amount': '85.50', 'cat': 'Alimentação'},
        ]
        
        for trans in expense_transactions:
            expense_cat = Category.objects.get(
                tenant=tenant,
                name=trans['cat'],
                type='expense'
            )
            
            # Criar transações em dias diferentes
            days_ago = random.randint(0, 30)
            trans_date = today - timedelta(days=days_ago)
            
            Transaction.objects.get_or_create(
                tenant=tenant,
                user=user,
                description=trans['desc'],
                transaction_date=trans_date,
                defaults={
                    'amount': Decimal(trans['amount']),
                    'type': 'expense',
                    'category': expense_cat,
                    'status': 'completed',
                }
            )
        
        self.stdout.write(self.style.SUCCESS('\nv Seed data concluído com sucesso!'))
        self.stdout.write(self.style.WARNING(f'\nCredenciais de teste:'))
        self.stdout.write(f'Email: {admin_email}')
        self.stdout.write(f'Senha: {admin_password}')
        self.stdout.write('Nome: Administrador')
        self.stdout.write(f'Tenant: demo')
