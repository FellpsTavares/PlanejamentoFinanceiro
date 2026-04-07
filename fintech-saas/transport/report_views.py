"""
Endpoints de relatórios da Transportadora.

GET /api/transport/reports/?report_type=<tipo>&<filtros>

Tipos suportados:
    movements       — Lançamentos (gastos/receitas) das viagens
    trips           — Viagens detalhadas (todas as colunas)
    driver_payments — Pagamentos ao motorista por viagem
    by_vehicle      — Resumo agrupado por veículo
    summary         — Totais agrupados por categoria de despesa
"""

from decimal import Decimal
from io import BytesIO
from datetime import datetime

from django.db.models import Sum, Count, Q
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status
import logging

logger = logging.getLogger(__name__)

from .models import Trip, TripMovement, Vehicle
from .permissions import HasTransportModule

# Mapeamento de colunas para PDF por tipo de relatório: (chave_row, label_cabecalho)
_PDF_COLUMNS = {
    'movements': [
        ('date', 'Data'),
        ('vehicle', 'Veículo'),
        ('movement_type_label', 'Tipo'),
        ('expense_category_label', 'Categoria'),
        ('amount', 'Valor (R$)'),
        ('description', 'Descrição'),
    ],
    'trips': [
        ('plate', 'Placa'),
        ('start_date', 'Início'),
        ('end_date', 'Fim'),
        ('modality_label', 'Modalidade'),
        ('status_label', 'Status'),
        ('total_value', 'Bruto (R$)'),
        ('expense_value', 'Despesas (R$)'),
        ('driver_payment', 'Motorista (R$)'),
        ('net_value', 'Líquido (R$)'),
        ('description', 'Descrição'),
    ],
    'driver_payments': [
        ('plate', 'Placa'),
        ('start_date', 'Início'),
        ('end_date', 'Fim'),
        ('status_label', 'Status'),
        ('total_value', 'Valor Viagem (R$)'),
        ('driver_payment', 'Pag. Motorista (R$)'),
        ('description', 'Descrição'),
    ],
    'by_vehicle': [
        ('vehicle', 'Veículo'),
        ('trip_count', 'Viagens'),
        ('total_value', 'Bruto (R$)'),
        ('expense_value', 'Despesas (R$)'),
        ('driver_payment', 'Motorista (R$)'),
        ('net_value', 'Líquido (R$)'),
    ],
    'summary': [
        ('expense_category_label', 'Categoria'),
        ('count', 'Lançamentos'),
        ('total', 'Total (R$)'),
    ],
}

_AGGREGATE_LABELS_PT = {
    'total_expense': 'Total Despesas',
    'total_revenue': 'Total Receitas',
    'balance': 'Saldo',
    'total_value': 'Valor Bruto',
    'total_driver': 'Total Motorista',
    'total_net': 'Líquido',
    'total_driver_payments': 'Total Pagamentos ao Motorista',
    'grand_total_value': 'Valor Bruto Total',
    'grand_expense_value': 'Despesas Total',
    'grand_net_value': 'Líquido Total',
    'grand_total': 'Total Geral',
}


# campos e rótulos para whitelist de ordenação
_MOVEMENT_ORDER_FIELDS = {'date', 'amount', 'movement_type', 'expense_category', 'created_at'}
_TRIP_ORDER_FIELDS = {'start_date', 'end_date', 'date', 'total_value', 'expense_value', 'driver_payment', 'created_at'}
_VEHICLE_ORDER_FIELDS = {'plate', 'model', 'year'}

MOVEMENT_CATEGORY_LABELS = {
    'fuel': 'Combustível',
    'other': 'Outros gastos',
    '': 'Receita',
}
MOVEMENT_TYPE_LABELS = {
    'expense': 'Gasto',
    'revenue': 'Receita',
}
MODALITY_LABELS = {
    'per_ton': 'Por Tonelada',
    'lease': 'Arrendamento',
}
STATUS_LABELS = {
    'in_progress': 'Em curso',
    'completed': 'Encerrada',
}


def _parse_bool_param(value):
    return str(value).lower() in ('1', 'true', 'yes')


class TransportReportView(APIView):
    permission_classes = [IsAuthenticated, HasTransportModule]

    def get(self, request):
        tenant = getattr(request.user, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant não identificado.'}, status=http_status.HTTP_403_FORBIDDEN)

        report_type = (request.query_params.get('report_type') or 'movements').strip()

        fmt = (request.query_params.get('format') or 'json').strip().lower()
        # Se a rota for /reports/pdf/ ou similar, forçar PDF mesmo sem query param
        try:
            if request.path.endswith('/pdf/') or '/reports/pdf' in request.path:
                fmt = 'pdf'
        except Exception:
            pass
        logger.warning("TransportReportView GET called: user=%s report_type=%s format=%s path=%s", getattr(request.user, 'email', request.user), report_type, fmt, request.path)

        handlers = {
            'movements': self._report_movements,
            'trips': self._report_trips,
            'driver_payments': self._report_driver_payments,
            'by_vehicle': self._report_by_vehicle,
            'summary': self._report_summary,
        }

        handler = handlers.get(report_type)
        if not handler:
            return Response(
                {'detail': f"Tipo de relatório inválido. Opções: {', '.join(handlers)}."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        json_response = handler(request, tenant)

        if fmt == 'pdf':
            logger.warning("Preparing PDF response for user=%s report=%s rows=%s", getattr(request.user, 'email', request.user), report_type, len(json_response.data.get('rows', [])))
            return self._to_pdf_response(json_response.data, report_type, tenant, request)

        return json_response

    # ------------------------------------------------------------------
    # PDF
    # ------------------------------------------------------------------
    def _to_pdf_response(self, data, report_type, tenant, request):
        rows_data = data.get('rows', [])
        meta = data.get('meta', {})
        aggregates = meta.get('aggregates', {})

        col_specs = _PDF_COLUMNS.get(report_type, [])
        headers = [label for _, label in col_specs]
        keys = [key for key, _ in col_specs]

        rows = []
        for row in rows_data:
            cells = []
            for key in keys:
                val = row.get(key)
                if val is None or val == '':
                    val = '—'
                cells.append(str(val))
            rows.append(cells)

        report_labels = {
            'movements': 'Lançamentos (Gastos/Receitas)',
            'trips': 'Viagens Detalhadas',
            'driver_payments': 'Pagamentos ao Motorista',
            'by_vehicle': 'Resumo por Veículo',
            'summary': 'Resumo por Categoria de Despesa',
        }
        title = f"Relatório de Transportadora — {report_labels.get(report_type, report_type)}"

        start = request.query_params.get('start_date') or '—'
        end = request.query_params.get('end_date') or '—'
        subtitle = f"Tenant: {tenant.name} | Período: {start} até {end} | {len(rows_data)} registro(s)"

        summary_items = [
            f"{_AGGREGATE_LABELS_PT.get(k, k)}: {v}"
            for k, v in aggregates.items()
        ]

        pdf_bytes = self._build_pdf(
            title=title,
            subtitle=subtitle,
            summary_items=summary_items,
            columns=headers,
            rows=rows,
        )

        filename = f"relatorio_transporte_{report_type}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @staticmethod
    def _build_pdf(title, subtitle, summary_items, columns, rows):
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import mm

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=18 * mm, rightMargin=18 * mm,
            topMargin=20 * mm, bottomMargin=18 * mm,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=16, spaceAfter=6)
        subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=9, textColor=colors.grey, spaceAfter=10)
        small_bold = ParagraphStyle('SmallBold', parent=styles['Heading4'], fontName='Helvetica-Bold', fontSize=10)
        normal = styles['Normal']

        story = []
        story.append(Paragraph(title, title_style))
        story.append(Paragraph(subtitle, subtitle_style))

        if summary_items:
            story.append(Paragraph('Resumo', small_bold))
            for item in summary_items:
                story.append(Paragraph(f'• {item}', normal))
            story.append(Spacer(1, 8))

        story.append(Paragraph('Detalhamento', small_bold))

        table_data = [columns] + [
            [str(cell) if cell is not None else '' for cell in row]
            for row in rows
        ]

        tbl = Table(table_data, repeatRows=1, hAlign='LEFT')
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#111827')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E5E7EB')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FAFAFB')]),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 12))

        generated_at = datetime.utcnow().strftime('%d/%m/%Y %H:%M UTC')
        story.append(Paragraph(
            f'Relatório gerado em: {generated_at}',
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey)
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _get_dates(self, params):
        start = parse_date(params.get('start_date') or '') or None
        end = parse_date(params.get('end_date') or '') or None
        return start, end

    def _vehicle_ids(self, params, tenant):
        """Retorna lista de vehicle_ids válidos para o tenant, ou None se não filtrado."""
        vid = params.get('vehicle_id') or params.get('vehicle')
        if not vid:
            return None
        try:
            vid = int(vid)
        except (ValueError, TypeError):
            return []
        if not Vehicle.objects.filter(id=vid, tenant=tenant).exists():
            return []
        return [vid]

    # ------------------------------------------------------------------
    # Relatório: Lançamentos (movimentações)
    # ------------------------------------------------------------------
    def _report_movements(self, request, tenant):
        params = request.query_params
        start, end = self._get_dates(params)
        vehicle_ids = self._vehicle_ids(params, tenant)
        category = params.get('category') or None        # fuel | other
        movement_type = params.get('movement_type') or None  # expense | revenue
        order_by = params.get('order_by') or 'date'
        order_dir = params.get('order_dir') or 'desc'

        if order_by not in _MOVEMENT_ORDER_FIELDS:
            order_by = 'date'
        order_prefix = '' if order_dir == 'asc' else '-'

        qs = TripMovement.objects.filter(
            trip__vehicle__tenant=tenant
        ).select_related('trip__vehicle')

        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        if vehicle_ids is not None:
            qs = qs.filter(trip__vehicle_id__in=vehicle_ids)
        if category:
            qs = qs.filter(expense_category=category)
        if movement_type:
            qs = qs.filter(movement_type=movement_type)

        qs = qs.order_by(f'{order_prefix}{order_by}')

        rows = []
        total_expense = Decimal('0')
        total_revenue = Decimal('0')

        for m in qs:
            amount = m.amount or Decimal('0')
            if m.movement_type == 'expense':
                total_expense += amount
            else:
                total_revenue += amount

            rows.append({
                'id': m.id,
                'date': str(m.date),
                'trip_id': m.trip_id,
                'vehicle': str(m.trip.vehicle),
                'vehicle_id': m.trip.vehicle_id,
                'movement_type': m.movement_type,
                'movement_type_label': MOVEMENT_TYPE_LABELS.get(m.movement_type, m.movement_type),
                'expense_category': m.expense_category,
                'expense_category_label': MOVEMENT_CATEGORY_LABELS.get(m.expense_category, m.expense_category),
                'amount': str(amount),
                'description': m.description,
            })

        return Response({
            'rows': rows,
            'meta': {
                'total': len(rows),
                'aggregates': {
                    'total_expense': str(total_expense),
                    'total_revenue': str(total_revenue),
                    'balance': str(total_revenue - total_expense),
                },
            },
        })

    # ------------------------------------------------------------------
    # Relatório: Viagens detalhadas
    # ------------------------------------------------------------------
    def _report_trips(self, request, tenant):
        params = request.query_params
        start, end = self._get_dates(params)
        vehicle_ids = self._vehicle_ids(params, tenant)
        trip_status = params.get('status') or None
        modality = params.get('modality') or None
        order_by = params.get('order_by') or 'start_date'
        order_dir = params.get('order_dir') or 'desc'

        if order_by not in _TRIP_ORDER_FIELDS:
            order_by = 'start_date'
        order_prefix = '' if order_dir == 'asc' else '-'

        qs = Trip.objects.filter(
            vehicle__tenant=tenant
        ).select_related('vehicle')

        if start:
            qs = qs.filter(Q(start_date__gte=start) | Q(date__gte=start))
        if end:
            qs = qs.filter(Q(end_date__lte=end) | Q(date__lte=end))
        if vehicle_ids is not None:
            qs = qs.filter(vehicle_id__in=vehicle_ids)
        if trip_status:
            qs = qs.filter(status=trip_status)
        if modality:
            qs = qs.filter(modality=modality)

        qs = qs.order_by(f'{order_prefix}{order_by}', '-id')

        rows = []
        total_value = Decimal('0')
        total_expense = Decimal('0')
        total_driver = Decimal('0')
        total_net = Decimal('0')

        for t in qs:
            tv = t.total_value or Decimal('0')
            ev = t.expense_value or Decimal('0')
            dp = t.driver_payment or Decimal('0')
            net = tv - ev

            total_value += tv
            total_expense += ev
            total_driver += dp
            total_net += net

            rows.append({
                'id': t.id,
                'vehicle': str(t.vehicle),
                'vehicle_id': t.vehicle_id,
                'plate': t.vehicle.plate,
                'date': str(t.date) if t.date else None,
                'start_date': str(t.start_date) if t.start_date else None,
                'end_date': str(t.end_date) if t.end_date else None,
                'modality': t.modality,
                'modality_label': MODALITY_LABELS.get(t.modality, t.modality),
                'status': t.status,
                'status_label': STATUS_LABELS.get(t.status, t.status),
                'tons': str(t.tons) if t.tons is not None else None,
                'rate_per_ton': str(t.rate_per_ton) if t.rate_per_ton is not None else None,
                'days': t.days,
                'daily_rate': str(t.daily_rate) if t.daily_rate is not None else None,
                'total_value': str(tv),
                'expense_value': str(ev),
                'driver_payment': str(dp),
                'net_value': str(net),
                'driver_is_owner': t.driver_is_owner,
                'initial_km': t.initial_km,
                'final_km': t.final_km,
                'fuel_liters': str(t.fuel_liters) if t.fuel_liters is not None else None,
                'progress_type': t.progress_type,
                'description': t.description,
                'is_received': t.is_received,
            })

        return Response({
            'rows': rows,
            'meta': {
                'total': len(rows),
                'aggregates': {
                    'total_value': str(total_value),
                    'total_expense': str(total_expense),
                    'total_driver': str(total_driver),
                    'total_net': str(total_net),
                },
            },
        })

    # ------------------------------------------------------------------
    # Relatório: Pagamentos ao motorista
    # ------------------------------------------------------------------
    def _report_driver_payments(self, request, tenant):
        params = request.query_params
        start, end = self._get_dates(params)
        vehicle_ids = self._vehicle_ids(params, tenant)
        order_by = params.get('order_by') or 'start_date'
        order_dir = params.get('order_dir') or 'desc'

        if order_by not in _TRIP_ORDER_FIELDS:
            order_by = 'start_date'
        order_prefix = '' if order_dir == 'asc' else '-'

        qs = Trip.objects.filter(
            vehicle__tenant=tenant,
            driver_is_owner=False,
        ).select_related('vehicle')

        if start:
            qs = qs.filter(Q(start_date__gte=start) | Q(date__gte=start))
        if end:
            qs = qs.filter(Q(end_date__lte=end) | Q(date__lte=end))
        if vehicle_ids is not None:
            qs = qs.filter(vehicle_id__in=vehicle_ids)

        qs = qs.order_by(f'{order_prefix}{order_by}', '-id')

        rows = []
        total_driver = Decimal('0')

        for t in qs:
            dp = t.driver_payment or Decimal('0')
            total_driver += dp
            rows.append({
                'id': t.id,
                'vehicle': str(t.vehicle),
                'plate': t.vehicle.plate,
                'start_date': str(t.start_date) if t.start_date else None,
                'end_date': str(t.end_date) if t.end_date else None,
                'status': t.status,
                'status_label': STATUS_LABELS.get(t.status, t.status),
                'total_value': str(t.total_value or 0),
                'driver_payment': str(dp),
                'description': t.description,
            })

        return Response({
            'rows': rows,
            'meta': {
                'total': len(rows),
                'aggregates': {
                    'total_driver_payments': str(total_driver),
                },
            },
        })

    # ------------------------------------------------------------------
    # Relatório: Por veículo (resumo agrupado)
    # ------------------------------------------------------------------
    def _report_by_vehicle(self, request, tenant):
        params = request.query_params
        start, end = self._get_dates(params)
        trip_status = params.get('status') or None

        qs = Trip.objects.filter(vehicle__tenant=tenant).select_related('vehicle')

        if start:
            qs = qs.filter(Q(start_date__gte=start) | Q(date__gte=start))
        if end:
            qs = qs.filter(Q(end_date__lte=end) | Q(date__lte=end))
        if trip_status:
            qs = qs.filter(status=trip_status)

        agg = (
            qs.values('vehicle__id', 'vehicle__plate', 'vehicle__model', 'vehicle__year')
            .annotate(
                trip_count=Count('id'),
                total_value=Sum('total_value'),
                expense_value=Sum('expense_value'),
                driver_payment=Sum('driver_payment'),
            )
            .order_by('-total_value')
        )

        rows = []
        grand_total = Decimal('0')
        grand_expense = Decimal('0')

        for row in agg:
            tv = row['total_value'] or Decimal('0')
            ev = row['expense_value'] or Decimal('0')
            dp = row['driver_payment'] or Decimal('0')
            net = tv - ev
            grand_total += tv
            grand_expense += ev
            rows.append({
                'vehicle_id': row['vehicle__id'],
                'vehicle': f"{row['vehicle__plate']} - {row['vehicle__model']} ({row['vehicle__year']})",
                'plate': row['vehicle__plate'],
                'model': row['vehicle__model'],
                'year': row['vehicle__year'],
                'trip_count': row['trip_count'],
                'total_value': str(tv),
                'expense_value': str(ev),
                'driver_payment': str(dp),
                'net_value': str(net),
            })

        return Response({
            'rows': rows,
            'meta': {
                'total': len(rows),
                'aggregates': {
                    'grand_total_value': str(grand_total),
                    'grand_expense_value': str(grand_expense),
                    'grand_net_value': str(grand_total - grand_expense),
                },
            },
        })

    # ------------------------------------------------------------------
    # Relatório: Resumo de despesas por categoria
    # ------------------------------------------------------------------
    def _report_summary(self, request, tenant):
        params = request.query_params
        start, end = self._get_dates(params)
        vehicle_ids = self._vehicle_ids(params, tenant)

        qs = TripMovement.objects.filter(
            trip__vehicle__tenant=tenant,
            movement_type='expense',
        )

        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        if vehicle_ids is not None:
            qs = qs.filter(trip__vehicle_id__in=vehicle_ids)

        agg = (
            qs.values('expense_category')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('-total')
        )

        rows = []
        grand_total = Decimal('0')

        for row in agg:
            t = row['total'] or Decimal('0')
            grand_total += t
            rows.append({
                'expense_category': row['expense_category'],
                'expense_category_label': MOVEMENT_CATEGORY_LABELS.get(row['expense_category'], row['expense_category']),
                'total': str(t),
                'count': row['count'],
            })

        return Response({
            'rows': rows,
            'meta': {
                'total': len(rows),
                'aggregates': {
                    'grand_total': str(grand_total),
                },
            },
        })
