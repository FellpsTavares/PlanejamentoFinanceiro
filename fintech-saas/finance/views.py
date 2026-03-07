from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Q
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from calendar import monthrange
from io import BytesIO
from decimal import Decimal
from datetime import datetime, timedelta, date
from accounts.audit import log_tenant_action
from .models import Category, Transaction, RecurringTransaction, Investment, PaymentMethod, CreditCardInvoice
from .defaults import ensure_default_payment_methods
from .services.yfinance_service import get_current_price, get_current_prices_bulk, get_asset_quote, search_assets, get_recommended_assets
from transport.models import Vehicle, Trip, TransportRevenue, TransportExpense
from .serializers import (
    CategorySerializer, TransactionSerializer,
    TransactionListSerializer, TransactionCreateUpdateSerializer,
    TransactionSummarySerializer, RecurringTransactionSerializer, InvestmentSerializer,
    PaymentMethodSerializer, CreditCardInvoiceSerializer
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
        category = serializer.save(tenant=self.request.user.tenant)
        log_tenant_action(
            tenant=self.request.user.tenant,
            user=self.request.user,
            action='category_created',
            entity_type='category',
            entity_id=str(category.id),
            details={'name': category.name, 'type': category.type},
        )

    def perform_update(self, serializer):
        category = serializer.save()
        log_tenant_action(
            tenant=self.request.user.tenant,
            user=self.request.user,
            action='category_updated',
            entity_type='category',
            entity_id=str(category.id),
            details={'name': category.name, 'type': category.type, 'is_active': category.is_active},
        )

    def perform_destroy(self, instance):
        category_id = str(instance.id)
        category_name = instance.name
        category_type = instance.type
        super().perform_destroy(instance)
        log_tenant_action(
            tenant=self.request.user.tenant,
            user=self.request.user,
            action='category_deleted',
            entity_type='category',
            entity_id=category_id,
            details={'name': category_name, 'type': category_type},
        )
    
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
        ).select_related('category', 'user', 'payment_method', 'credit_card_invoice')

    def _get_credit_card_invoice(self, transaction_obj):
        payment_method = transaction_obj.payment_method
        if not payment_method or payment_method.type != 'credit_card':
            return None

        tx_date = transaction_obj.transaction_date or date.today()
        reference_month = tx_date.replace(day=1)

        due_day = int(payment_method.due_day or 10)
        last_day = monthrange(reference_month.year, reference_month.month)[1]
        due_day = min(max(due_day, 1), last_day)
        due_date = reference_month.replace(day=due_day)

        invoice, _ = CreditCardInvoice.objects.get_or_create(
            tenant=transaction_obj.tenant,
            payment_method=payment_method,
            reference_month=reference_month,
            defaults={
                'due_date': due_date,
                'status': 'open',
            },
        )
        return invoice

    def _recalculate_invoice_total(self, invoice):
        if not invoice:
            return
        total = invoice.transactions.filter(type='expense').aggregate(total=Sum('amount'))['total'] or Decimal('0')
        invoice.total_amount = total
        invoice.save(update_fields=['total_amount', 'updated_at'])

    def _process_credit_card_transaction(self, transaction_obj):
        payment_method = transaction_obj.payment_method
        if not payment_method or payment_method.type != 'credit_card' or transaction_obj.type != 'expense':
            if transaction_obj.credit_card_invoice_id:
                old_invoice = transaction_obj.credit_card_invoice
                transaction_obj.credit_card_invoice = None
                transaction_obj.affects_balance = True
                transaction_obj.save(update_fields=['credit_card_invoice', 'affects_balance', 'updated_at'])
                self._recalculate_invoice_total(old_invoice)
            return

        invoice = self._get_credit_card_invoice(transaction_obj)
        transaction_obj.credit_card_invoice = invoice
        transaction_obj.affects_balance = False
        transaction_obj.status = 'pending'
        transaction_obj.due_date = invoice.due_date
        transaction_obj.save(update_fields=['credit_card_invoice', 'affects_balance', 'status', 'due_date', 'updated_at'])
        self._recalculate_invoice_total(invoice)
    
    def get_serializer_class(self):
        """Usa serializer diferente para cada ação"""
        if self.action == 'list':
            return TransactionListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return TransactionCreateUpdateSerializer
        return TransactionSerializer
    
    def perform_create(self, serializer):
        """Cria transação associada ao usuário e tenant atual"""
        tx = serializer.save(
            tenant=self.request.user.tenant,
            user=self.request.user
        )
        self._process_credit_card_transaction(tx)
    
    def perform_update(self, serializer):
        """Atualiza transação"""
        tx = serializer.save(
            tenant=self.request.user.tenant,
            user=self.request.user
        )
        self._process_credit_card_transaction(tx)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Retorna resumo das transações do usuário.
        Query params:
        - start_date: Data inicial (YYYY-MM-DD)
        - end_date: Data final (YYYY-MM-DD)
        """
        queryset = self.get_queryset().filter(affects_balance=True)
        
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

    def _monthly_dates(self, start_date, end_date, due_day):
        current = start_date.replace(day=1)
        end_month = end_date.replace(day=1)
        while current <= end_month:
            last_day = monthrange(current.year, current.month)[1]
            day = min(max(int(due_day), 1), last_day)
            yield current.replace(day=day)
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)

    def _generate_fixed_monthly_transactions(self, recurring):
        if not recurring.is_fixed_monthly or not recurring.end_date or recurring.due_day is None:
            return

        for due in self._monthly_dates(recurring.start_date, recurring.end_date, recurring.due_day):
            exists = Transaction.objects.filter(
                tenant=recurring.tenant,
                recurring=recurring,
                due_date=due,
            ).exists()
            if exists:
                continue

            Transaction.objects.create(
                tenant=recurring.tenant,
                user=recurring.user,
                description=recurring.description,
                amount=recurring.amount,
                type=recurring.type,
                category=recurring.category,
                transaction_date=due,
                due_date=due,
                status='pending',
                affects_balance=True,
                is_recurring=True,
                recurrence_type='monthly',
                recurring=recurring,
            )

    def perform_create(self, serializer):
        recurring = serializer.save(tenant=self.request.user.tenant, user=self.request.user)
        self._generate_fixed_monthly_transactions(recurring)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Garante métodos básicos para tenants antigos e novos sem duplicar registros.
        ensure_default_payment_methods(self.request.user.tenant)
        return PaymentMethod.objects.filter(tenant=self.request.user.tenant).order_by('name')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class CreditCardInvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CreditCardInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CreditCardInvoice.objects.filter(tenant=self.request.user.tenant).select_related('payment_method')

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == 'paid':
            return Response({'detail': 'Fatura já está marcada como paga.'})

        paid_date = parse_date(request.data.get('paid_at') or '') or date.today()
        invoice.status = 'paid'
        invoice.paid_at = paid_date
        invoice.save(update_fields=['status', 'paid_at', 'updated_at'])

        invoice.transactions.filter(type='expense').update(
            affects_balance=True,
            status='completed',
            due_date=paid_date,
        )

        return Response({'detail': 'Fatura marcada como paga com sucesso.'})


class InvestmentViewSet(viewsets.ModelViewSet):
    serializer_class = InvestmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Investment.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        include_live = str(request.query_params.get('include_live') or '0').lower() in {'1', 'true', 'yes'}
        tickers = [inv.ticker for inv in queryset]
        prices = get_current_prices_bulk(tickers) if include_live else {}
        data = []
        for inv in queryset:
            current = prices.get(inv.ticker) if include_live else None
            pnl = None
            if current is not None:
                pnl = (float(current) - float(inv.buy_price)) * float(inv.quantity)
            data.append({
                'id': str(inv.id),
                'ticker': inv.ticker,
                'asset_name': inv.ticker,
                'buy_price': float(inv.buy_price),
                'quantity': float(inv.quantity),
                'buy_date': inv.buy_date,
                'current_price': current,
                'pnl': pnl,
                'pnl_percent': ((float(current) / float(inv.buy_price) - 1) * 100.0) if current is not None and float(inv.buy_price) else None,
                'currency': None,
                'as_of': None,
            })
        return Response(data)

    @action(detail=False, methods=['get'], url_path='live-prices')
    def live_prices(self, request):
        tickers_param = (request.query_params.get('tickers') or '').strip()
        if tickers_param:
            tickers = [t.strip().upper() for t in tickers_param.split(',') if t.strip()]
        else:
            tickers = list(self.get_queryset().values_list('ticker', flat=True))

        prices = get_current_prices_bulk(tickers)
        return Response([
            {'ticker': ticker, 'current_price': prices.get(ticker)}
            for ticker in tickers
        ])

    @action(detail=False, methods=['get'], url_path='asset-search')
    def asset_search(self, request):
        query = (request.query_params.get('q') or '').strip()
        if len(query) < 2:
            return Response([])

        suggestions = search_assets(query=query, limit=10)
        return Response(suggestions)

    @action(detail=False, methods=['get'], url_path='quote')
    def quote(self, request):
        ticker = (request.query_params.get('ticker') or '').strip()
        if not ticker:
            return Response({'detail': 'Parâmetro ticker é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

        quote_data = get_asset_quote(ticker)
        if not quote_data or quote_data.get('price') is None:
            return Response({'detail': 'Cotação indisponível para o ativo informado.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(quote_data)

    @action(detail=False, methods=['get'], url_path='recommended-assets')
    def recommended_assets(self, request):
        limit_param = request.query_params.get('limit') or '8'
        try:
            limit = max(1, min(int(limit_param), 20))
        except (TypeError, ValueError):
            limit = 8

        items = get_recommended_assets(limit=limit)
        return Response(items)
    
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


class ReportViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _build_pdf(self, title, subtitle, summary_items, columns, rows):
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 50

        pdf.setFont('Helvetica-Bold', 16)
        pdf.drawString(40, y, title)
        y -= 20

        pdf.setFont('Helvetica', 9)
        pdf.drawString(40, y, subtitle)
        y -= 24

        pdf.setFont('Helvetica-Bold', 11)
        pdf.drawString(40, y, 'Resumo Executivo')
        y -= 16

        pdf.setFont('Helvetica', 9)
        for item in summary_items:
            pdf.drawString(48, y, f"• {item}")
            y -= 14

        y -= 6
        pdf.setFont('Helvetica-Bold', 11)
        pdf.drawString(40, y, 'Detalhamento')
        y -= 16

        col_width = (width - 80) / max(1, len(columns))
        pdf.setFont('Helvetica-Bold', 8)
        for idx, col in enumerate(columns):
            pdf.drawString(40 + idx * col_width, y, str(col)[:28])
        y -= 12
        pdf.line(40, y, width - 40, y)
        y -= 12

        pdf.setFont('Helvetica', 8)
        for row in rows:
            if y < 60:
                pdf.showPage()
                y = height - 50
                pdf.setFont('Helvetica-Bold', 8)
                for idx, col in enumerate(columns):
                    pdf.drawString(40 + idx * col_width, y, str(col)[:28])
                y -= 12
                pdf.line(40, y, width - 40, y)
                y -= 12
                pdf.setFont('Helvetica', 8)

            for idx, col in enumerate(row):
                pdf.drawString(40 + idx * col_width, y, str(col)[:28])
            y -= 12

        pdf.save()
        buffer.seek(0)
        return buffer.getvalue()

    @action(detail=False, methods=['get'], url_path='finance-pdf')
    def finance_pdf(self, request):
        tenant = request.user.tenant
        user = request.user
        qs = Transaction.objects.filter(tenant=tenant, user=user)

        start_date = parse_date(request.query_params.get('start_date') or '')
        end_date = parse_date(request.query_params.get('end_date') or '')
        if start_date:
            qs = qs.filter(transaction_date__gte=start_date)
        if end_date:
            qs = qs.filter(transaction_date__lte=end_date)

        order_by = (request.query_params.get('order_by') or '').strip()
        order_dir = (request.query_params.get('order_dir') or 'desc').strip().lower()
        allowed_order = {'transaction_date', 'amount', 'created_at', 'status', 'type'}
        if order_by in allowed_order:
            prefix = '-' if order_dir == 'desc' else ''
            qs = qs.order_by(f'{prefix}{order_by}')
        else:
            qs = qs.order_by('-transaction_date', '-created_at')

        fields_param = (request.query_params.get('fields') or '').strip()
        field_specs = {
            'transaction_date': ('Data', lambda tx: tx.transaction_date.strftime('%d/%m/%Y') if tx.transaction_date else ''),
            'description': ('Descrição', lambda tx: tx.description),
            'category': ('Categoria', lambda tx: tx.category.name if tx.category else 'Sem categoria'),
            'type': ('Tipo', lambda tx: 'Receita' if tx.type == 'income' else 'Despesa'),
            'amount': ('Valor', lambda tx: f"R$ {float(tx.amount):.2f}"),
            'status': ('Status', lambda tx: tx.status),
        }
        selected_fields = [f for f in fields_param.split(',') if f in field_specs] if fields_param else []
        if not selected_fields:
            selected_fields = ['transaction_date', 'description', 'category', 'type', 'amount', 'status']

        income = qs.filter(type='income').aggregate(total=Sum('amount'))['total'] or Decimal('0')
        expense = qs.filter(type='expense').aggregate(total=Sum('amount'))['total'] or Decimal('0')
        balance = income - expense

        by_category = (
            qs.values('category__name', 'type')
            .annotate(total=Sum('amount'))
            .order_by('-total')[:8]
        )

        category_lines = [
            f"{item['category__name'] or 'Sem categoria'} ({'Receita' if item['type'] == 'income' else 'Despesa'}): R$ {float(item['total']):.2f}"
            for item in by_category
        ]

        recent = qs.select_related('category')[:25]
        rows = [
            [field_specs[field][1](tx) for field in selected_fields]
            for tx in recent
        ]

        summary = [
            f"Total de receitas: R$ {float(income):.2f}",
            f"Total de despesas: R$ {float(expense):.2f}",
            f"Saldo: R$ {float(balance):.2f}",
            f"Transações no período: {qs.count()}",
        ] + category_lines[:4]

        pdf_bytes = self._build_pdf(
            title='Relatório Financeiro',
            subtitle=f"Tenant: {tenant.name} | Usuário: {user.email} | Período: {start_date or '-'} até {end_date or '-'}",
            summary_items=summary,
            columns=[field_specs[field][0] for field in selected_fields],
            rows=rows,
        )

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="relatorio_financeiro.pdf"'
        return response

    @action(detail=False, methods=['get'], url_path='transport-pdf')
    def transport_pdf(self, request):
        tenant = request.user.tenant
        if not getattr(tenant, 'has_module_transport', False):
            return Response({'detail': 'Módulo transport não habilitado para este tenant.'}, status=status.HTTP_403_FORBIDDEN)

        start_date = parse_date(request.query_params.get('start_date') or '')
        end_date = parse_date(request.query_params.get('end_date') or '')
        vehicle_id = (request.query_params.get('vehicle_id') or '').strip()
        status_param = (request.query_params.get('status') or '').strip()

        vehicles_count = Vehicle.objects.filter(tenant=tenant).count()
        trips = Trip.objects.filter(vehicle__tenant=tenant).select_related('vehicle').order_by('-start_date', '-date', '-id')

        if vehicle_id:
            trips = trips.filter(vehicle_id=vehicle_id)
        if status_param in ['in_progress', 'completed']:
            trips = trips.filter(status=status_param)
        if start_date:
            trips = trips.filter(Q(start_date__gte=start_date) | Q(start_date__isnull=True, date__gte=start_date))
        if end_date:
            trips = trips.filter(Q(start_date__lte=end_date) | Q(start_date__isnull=True, date__lte=end_date))

        order_by = (request.query_params.get('order_by') or '').strip()
        order_dir = (request.query_params.get('order_dir') or 'desc').strip().lower()
        allowed_order = {'start_date', 'end_date', 'status', 'total_value', 'expense_value'}
        if order_by in allowed_order:
            if order_by == 'start_date':
                if order_dir == 'desc':
                    trips = trips.order_by('-start_date', '-date', '-id')
                else:
                    trips = trips.order_by('start_date', 'date', 'id')
            else:
                prefix = '-' if order_dir == 'desc' else ''
                trips = trips.order_by(f'{prefix}{order_by}', '-id')
        else:
            trips = trips.order_by('-start_date', '-date', '-id')

        fields_param = (request.query_params.get('fields') or '').strip()
        field_specs = {
            'vehicle': ('Veículo', lambda t: t.vehicle.plate if t.vehicle else ''),
            'start_date': ('Início', lambda t: t.start_date.strftime('%d/%m/%Y') if t.start_date else (t.date.strftime('%d/%m/%Y') if t.date else '')),
            'end_date': ('Fim', lambda t: t.end_date.strftime('%d/%m/%Y') if t.end_date else '-'),
            'progress_type': ('Andamento', lambda t: t.progress_type or '-'),
            'status': ('Status', lambda t: 'Em curso' if t.status == 'in_progress' else 'Encerrada'),
            'total_value': ('Receita', lambda t: f"R$ {float(t.total_value or 0):.2f}"),
            'expense_value': ('Despesa', lambda t: f"R$ {float(t.expense_value or 0):.2f}"),
            'net_value': ('Líquido', lambda t: f"R$ {float((t.total_value or 0) - (t.expense_value or 0)):.2f}"),
            'is_received': ('Recebida', lambda t: 'Sim' if t.is_received else 'Não'),
        }
        selected_fields = [f for f in fields_param.split(',') if f in field_specs] if fields_param else []
        if not selected_fields:
            selected_fields = ['vehicle', 'start_date', 'end_date', 'progress_type', 'status', 'net_value']

        in_progress = trips.filter(status='in_progress').count()
        completed = trips.filter(status='completed').count()

        rev_manual_qs = TransportRevenue.objects.filter(vehicle__tenant=tenant)
        exp_manual_qs = TransportExpense.objects.filter(vehicle__tenant=tenant)
        if vehicle_id:
            rev_manual_qs = rev_manual_qs.filter(vehicle_id=vehicle_id)
            exp_manual_qs = exp_manual_qs.filter(vehicle_id=vehicle_id)
        if start_date:
            rev_manual_qs = rev_manual_qs.filter(date__gte=start_date)
            exp_manual_qs = exp_manual_qs.filter(date__gte=start_date)
        if end_date:
            rev_manual_qs = rev_manual_qs.filter(date__lte=end_date)
            exp_manual_qs = exp_manual_qs.filter(date__lte=end_date)

        rev_manual = rev_manual_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        exp_manual = exp_manual_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        rev_trip = trips.filter(is_received=True).aggregate(total=Sum('total_value'))['total'] or Decimal('0')
        exp_trip = trips.aggregate(total=Sum('expense_value'))['total'] or Decimal('0')

        total_revenue = rev_manual + rev_trip
        total_expense = exp_manual + exp_trip
        net = total_revenue - total_expense

        rows = [[field_specs[field][1](t) for field in selected_fields] for t in trips[:30]]

        summary = [
            f"Veículos cadastrados: {vehicles_count}",
            f"Viagens em curso: {in_progress}",
            f"Viagens encerradas: {completed}",
            f"Receita total: R$ {float(total_revenue):.2f}",
            f"Despesa total: R$ {float(total_expense):.2f}",
            f"Resultado líquido: R$ {float(net):.2f}",
        ]

        pdf_bytes = self._build_pdf(
            title='Relatório da Transportadora',
            subtitle=f"Tenant: {tenant.name} | Período: {start_date or '-'} até {end_date or '-'}",
            summary_items=summary,
            columns=[field_specs[field][0] for field in selected_fields],
            rows=rows,
        )

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="relatorio_transportadora.pdf"'
        return response

    @action(detail=False, methods=['get'], url_path='investments-pdf')
    def investments_pdf(self, request):
        tenant = request.user.tenant
        if not getattr(tenant, 'has_module_investments', False):
            return Response({'detail': 'Módulo investments não habilitado para este tenant.'}, status=status.HTTP_403_FORBIDDEN)

        investments = Investment.objects.filter(tenant=tenant).order_by('-buy_date', '-created_at')
        start_date = parse_date(request.query_params.get('start_date') or '')
        end_date = parse_date(request.query_params.get('end_date') or '')
        ticker = (request.query_params.get('ticker') or '').strip().upper()

        if start_date:
            investments = investments.filter(buy_date__gte=start_date)
        if end_date:
            investments = investments.filter(buy_date__lte=end_date)
        if ticker:
            investments = investments.filter(ticker__iexact=ticker)

        order_by = (request.query_params.get('order_by') or '').strip()
        order_dir = (request.query_params.get('order_dir') or 'desc').strip().lower()
        allowed_order = {'buy_date', 'ticker', 'buy_price', 'quantity'}
        if order_by in allowed_order:
            prefix = '-' if order_dir == 'desc' else ''
            investments = investments.order_by(f'{prefix}{order_by}')
        else:
            investments = investments.order_by('-buy_date', '-created_at')

        fields_param = (request.query_params.get('fields') or '').strip()
        selected_fields = [f for f in fields_param.split(',') if f in {'ticker', 'quantity', 'buy_price', 'current_price', 'pnl', 'buy_date'}] if fields_param else []
        if not selected_fields:
            selected_fields = ['ticker', 'quantity', 'buy_price', 'current_price', 'pnl', 'buy_date']

        total_invested = Decimal('0')
        total_current = Decimal('0')
        rows = []

        investment_rows = list(investments[:40])
        prices = get_current_prices_bulk([inv.ticker for inv in investment_rows])

        for inv in investment_rows:
            buy_total = (inv.buy_price or Decimal('0')) * (inv.quantity or Decimal('0'))
            total_invested += buy_total
            current_price = prices.get(inv.ticker)
            current_total = (Decimal(str(current_price)) * (inv.quantity or Decimal('0'))) if current_price is not None else buy_total
            total_current += current_total
            pnl = current_total - buy_total

            computed = {
                'ticker': inv.ticker,
                'quantity': f"{float(inv.quantity):.4f}",
                'buy_price': f"R$ {float(inv.buy_price):.2f}",
                'current_price': f"R$ {float(current_price):.2f}" if current_price is not None else '-',
                'pnl': f"R$ {float(pnl):.2f}",
                'buy_date': inv.buy_date.strftime('%d/%m/%Y') if inv.buy_date else '',
            }
            rows.append([computed[field] for field in selected_fields])

        pnl_total = total_current - total_invested
        summary = [
            f"Ativos cadastrados: {investments.count()}",
            f"Valor investido: R$ {float(total_invested):.2f}",
            f"Valor atual estimado: R$ {float(total_current):.2f}",
            f"PnL total: R$ {float(pnl_total):.2f}",
        ]

        label_map = {
            'ticker': 'Ticker',
            'quantity': 'Qtd',
            'buy_price': 'Preço Compra',
            'current_price': 'Preço Atual',
            'pnl': 'PnL',
            'buy_date': 'Data Compra',
        }

        pdf_bytes = self._build_pdf(
            title='Relatório de Investimentos',
            subtitle=f"Tenant: {tenant.name} | Período: {start_date or '-'} até {end_date or '-'} | Ticker: {ticker or 'Todos'}",
            summary_items=summary,
            columns=[label_map[field] for field in selected_fields],
            rows=rows,
        )

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="relatorio_investimentos.pdf"'
        return response
