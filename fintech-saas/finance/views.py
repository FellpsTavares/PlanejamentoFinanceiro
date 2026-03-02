from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Q
from datetime import datetime, timedelta
from .models import Category, Transaction, RecurringTransaction, Investment
from .services.brapi_service import get_current_price
from .serializers import (
    CategorySerializer, TransactionSerializer,
    TransactionListSerializer, TransactionCreateUpdateSerializer,
    TransactionSummarySerializer, RecurringTransactionSerializer, InvestmentSerializer
)


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar categorias de transações.
    """
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Retorna apenas categorias do tenant atual"""
        return Category.objects.filter(
            tenant=self.request.user.tenant,
            is_active=True
        )
    
    def perform_create(self, serializer):
        """Cria categoria associada ao tenant atual"""
        serializer.save(tenant=self.request.user.tenant)
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Retorna categorias agrupadas por tipo"""
        income_categories = Category.objects.filter(
            tenant=request.user.tenant,
            type='income',
            is_active=True
        )
        expense_categories = Category.objects.filter(
            tenant=request.user.tenant,
            type='expense',
            is_active=True
        )
        
        return Response({
            'income': CategorySerializer(income_categories, many=True).data,
            'expense': CategorySerializer(expense_categories, many=True).data,
        })


class TransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar transações financeiras.
    Suporta filtros por data, categoria, tipo e status.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['type', 'status', 'category', 'transaction_date']
    ordering_fields = ['transaction_date', 'amount', 'created_at']
    ordering = ['-transaction_date']
    
    def get_queryset(self):
        """Retorna apenas transações do usuário no tenant atual"""
        return Transaction.objects.filter(
            tenant=self.request.user.tenant,
            user=self.request.user
        ).select_related('category', 'user')
    
    def get_serializer_class(self):
        """Usa serializer diferente para cada ação"""
        if self.action == 'list':
            return TransactionListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return TransactionCreateUpdateSerializer
        return TransactionSerializer
    
    def perform_create(self, serializer):
        """Cria transação associada ao usuário e tenant atual"""
        serializer.save(
            tenant=self.request.user.tenant,
            user=self.request.user
        )
    
    def perform_update(self, serializer):
        """Atualiza transação"""
        serializer.save(
            tenant=self.request.user.tenant,
            user=self.request.user
        )
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Retorna resumo das transações do usuário.
        Query params:
        - start_date: Data inicial (YYYY-MM-DD)
        - end_date: Data final (YYYY-MM-DD)
        """
        queryset = self.get_queryset()
        
        # Filtrar por datas se fornecidas
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(transaction_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transaction_date__lte=end_date)
        
        # Calcular totais
        income = queryset.filter(type='income').aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        expense = queryset.filter(type='expense').aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        balance = income - expense
        
        # Agrupar por categoria
        by_category = []
        categories = Category.objects.filter(
            tenant=request.user.tenant,
            is_active=True
        )
        
        for category in categories:
            category_total = queryset.filter(
                category=category
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            if category_total > 0:
                by_category.append({
                    'id': str(category.id),
                    'name': category.name,
                    'type': category.type,
                    'total': float(category_total),
                    'color': category.color,
                    'icon': category.icon,
                })
        
        # Agrupar por mês
        by_month = []
        months = queryset.values('transaction_date__year', 'transaction_date__month').distinct()
        
        for month_data in months:
            year = month_data['transaction_date__year']
            month = month_data['transaction_date__month']
            
            month_queryset = queryset.filter(
                transaction_date__year=year,
                transaction_date__month=month
            )
            
            month_income = month_queryset.filter(type='income').aggregate(
                total=Sum('amount')
            )['total'] or 0
            
            month_expense = month_queryset.filter(type='expense').aggregate(
                total=Sum('amount')
            )['total'] or 0
            
            by_month.append({
                'year': year,
                'month': month,
                'income': float(month_income),
                'expense': float(month_expense),
                'balance': float(month_income - month_expense),
            })
        
        data = {
            'total_income': float(income),
            'total_expense': float(expense),
            'balance': float(balance),
            'transaction_count': queryset.count(),
            'by_category': by_category,
            'by_month': sorted(by_month, key=lambda x: (x['year'], x['month'])),
        }
        
        # serializer espera um dict com os campos
        serializer = TransactionSummarySerializer(data)
        return Response(serializer.data)


class RecurringTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RecurringTransaction.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)


class InvestmentViewSet(viewsets.ModelViewSet):
    serializer_class = InvestmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Investment.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        data = []
        for inv in queryset:
            current = get_current_price(inv.ticker)
            pnl = None
            if current is not None:
                pnl = (float(current) - float(inv.buy_price)) * float(inv.quantity)
            data.append({
                'id': str(inv.id),
                'ticker': inv.ticker,
                'buy_price': float(inv.buy_price),
                'quantity': float(inv.quantity),
                'buy_date': inv.buy_date,
                'current_price': current,
                'pnl': pnl,
            })
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def by_date_range(self, request):
        """
        Retorna transações filtradas por intervalo de datas.
        Query params:
        - start_date: Data inicial (YYYY-MM-DD)
        - end_date: Data final (YYYY-MM-DD)
        - type: Tipo (income/expense)
        - category_id: ID da categoria
        """
        queryset = self.get_queryset()
        
        # Filtrar por datas
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(transaction_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transaction_date__lte=end_date)
        
        # Filtrar por tipo
        transaction_type = request.query_params.get('type')
        if transaction_type:
            queryset = queryset.filter(type=transaction_type)
        
        # Filtrar por categoria
        category_id = request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = TransactionListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = TransactionListSerializer(queryset, many=True)
        return Response(serializer.data)
