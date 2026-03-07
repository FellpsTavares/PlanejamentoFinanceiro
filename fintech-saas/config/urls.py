"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include
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
