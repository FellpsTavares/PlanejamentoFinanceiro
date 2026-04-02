"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import UserViewSet, TenantViewSet, CustomTokenObtainPairView
from finance.views import (
    CategoryViewSet,
    TransactionViewSet,
    RecurringTransactionViewSet,
    InvestmentViewSet,
    ReportViewSet,
    PaymentMethodViewSet,
    CreditCardInvoiceViewSet,
)

# Criar router para ViewSets
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'recurrings', RecurringTransactionViewSet, basename='recurring')
router.register(r'investments', InvestmentViewSet, basename='investment')
router.register(r'reports', ReportViewSet, basename='report')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'credit-card-invoices', CreditCardInvoiceViewSet, basename='credit-card-invoice')
from django.urls import re_path

urlpatterns = [
    path('healthz/', lambda request: JsonResponse({'status': 'ok'}), name='healthz'),
    # Admin
    path('admin/', admin.site.urls),
    
    # API
    path('api/', include(router.urls)),
    
    # Autenticação JWT
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # API Auth
    path('api/auth/', include('rest_framework.urls')),
    # Transporte (módulo separado)
    path('api/transport/', include('transport.urls')),
    # Assistente operacional (chat)
    path('api/assistant/', include('finance.assistant_urls')),
]

# Aliases (backwards-compatible, não removem rotas originais)
# Esses aliases usam nomes amigáveis/pt-br e basenames distintos para evitar colisões de nomes de URL.
router.register(r'usuarios', UserViewSet, basename='user_alias')
router.register(r'contas', TenantViewSet, basename='tenant_alias')
router.register(r'categorias', CategoryViewSet, basename='category_alias')
router.register(r'transacoes', TransactionViewSet, basename='transaction_alias')
router.register(r'recorrentes', RecurringTransactionViewSet, basename='recurring_alias')
router.register(r'investimentos', InvestmentViewSet, basename='investment_alias')
router.register(r'relatorios', ReportViewSet, basename='report_alias')
router.register(r'formas-pagamento', PaymentMethodViewSet, basename='payment-method_alias')
router.register(r'faturas-cartao', CreditCardInvoiceViewSet, basename='credit-card-invoice_alias')
