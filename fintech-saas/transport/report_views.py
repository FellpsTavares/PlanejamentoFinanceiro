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

from django.db.models import Sum, Count, Min, Max, Q
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status
import logging

logger = logging.getLogger(__name__)

from .models import Trip, TripMovement, Vehicle, FuelLog
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
        ('driver_name', 'Motorista'),
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
        ('driver_name', 'Motorista'),
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
    'fuel_consumption': [
        ('plate', 'Placa'),
        ('model', 'Modelo'),
        ('refuel_count', 'Abastecimentos'),
        ('total_liters_diesel', 'Litros Diesel'),
        ('total_liters_arla', 'Litros Arla'),
        ('distance_km', 'KM Percorrido'),
        ('avg_consumption', 'Consumo (km/l)'),
        ('first_date', 'Primeiro Abastecimento'),
        ('last_date', 'Último Abastecimento'),
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
    'total_distance_km': 'Distância Total',
    'total_liters_diesel': 'Litros de Diesel (Total)',
    'fleet_avg_consumption': 'Consumo Médio da Frota',
}

# Nome (em português) usado no arquivo PDF exportado — `report_type` continua em
# inglês, é o valor aceito pela API via query param.
_REPORT_TYPE_FILE_NAMES = {
    'movements': 'lancamentos',
    'trips': 'viagens_detalhadas',
    'driver_payments': 'pagamentos_motorista',
    'by_vehicle': 'resumo_por_veiculo',
    'summary': 'resumo_por_categoria',
    'fuel_consumption': 'consumo_combustivel',
    'monthly_closing': 'fechamento_mensal',
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


def _fmt_date(value):
    if not value:
        return '—'
    try:
        return value.strftime('%d/%m/%Y')
    except AttributeError:
        return str(value)


def _fmt_money(value):
    if value is None:
        return '—'
    value = Decimal(value)
    text = f'{value:,.2f}'.replace(',', '_').replace('.', ',').replace('_', '.')
    return f'R$ {text}'


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

        # Fechamento Mensal é um relatório composto (várias seções) por veículo,
        # disponível apenas em PDF — não segue o formato genérico rows/meta usado
        # pelos demais tipos, então tem despacho próprio.
        if report_type == 'monthly_closing':
            return self._handle_monthly_closing(request, tenant)

        handlers = {
            'movements': self._report_movements,
            'trips': self._report_trips,
            'driver_payments': self._report_driver_payments,
            'by_vehicle': self._report_by_vehicle,
            'summary': self._report_summary,
            'fuel_consumption': self._report_fuel_consumption,
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
            'fuel_consumption': 'Consumo de Combustível',
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

        filename = f"relatorio_transporte_{_REPORT_TYPE_FILE_NAMES.get(report_type, report_type)}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @staticmethod
    def _build_pdf(title, subtitle, summary_items, columns, rows):
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import mm

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=landscape(A4),  # ✅ Mudado para horizontal
            leftMargin=15 * mm, rightMargin=15 * mm,  # ✅ Margens reduzidas
            topMargin=15 * mm, bottomMargin=15 * mm,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=14, spaceAfter=4)  # ✅ Fonte menor
        subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=8, textColor=colors.grey, spaceAfter=8)
        small_bold = ParagraphStyle('SmallBold', parent=styles['Heading4'], fontName='Helvetica-Bold', fontSize=9)
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
            ('FONTSIZE', (0, 0), (-1, -1), 7),  # ✅ Fonte reduzida para caber mais colunas
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4),  # ✅ Padding reduzido
            ('TOPPADDING', (0, 0), (-1, 0), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E5E7EB')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FAFAFB')]),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 8))  # ✅ Espaçamento reduzido

        generated_at = datetime.utcnow().strftime('%d/%m/%Y %H:%M UTC')
        story.append(Paragraph(
            f'Relatório gerado em: {generated_at}',
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7, textColor=colors.grey)  # ✅ Fonte menor
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
        ).select_related('vehicle', 'driver')

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
                'driver_name': t.driver.name if t.driver_id else '—',
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
        ).select_related('vehicle', 'driver')

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
                'driver_name': t.driver.name if t.driver_id else '—',
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

    # ------------------------------------------------------------------
    # Relatório: Consumo de combustível por veículo (baseado em abastecimentos)
    # ------------------------------------------------------------------
    def _report_fuel_consumption(self, request, tenant):
        params = request.query_params
        start, end = self._get_dates(params)
        vehicle_ids = self._vehicle_ids(params, tenant)

        qs = FuelLog.objects.filter(vehicle__tenant=tenant)
        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        if vehicle_ids is not None:
            qs = qs.filter(vehicle_id__in=vehicle_ids)

        # Consumo médio (km/l) é calculado só com abastecimentos de Diesel — Arla é
        # aditivo de escapamento, não combustível de propulsão. Distância = maior menos
        # menor odômetro registrado no período; litros = soma de todos os abastecimentos
        # de Diesel no período (aproximação padrão: o primeiro abastecimento do período
        # também entra na soma, então o consumo tende a ficar levemente subestimado em
        # períodos com poucos abastecimentos).
        diesel_agg = (
            qs.filter(fuel_type=FuelLog.FUEL_DIESEL)
            .values('vehicle__id', 'vehicle__plate', 'vehicle__model', 'vehicle__year')
            .annotate(
                refuel_count=Count('id'),
                total_liters=Sum('liters'),
                min_odometer=Min('odometer_km'),
                max_odometer=Max('odometer_km'),
                first_date=Min('date'),
                last_date=Max('date'),
            )
            .order_by('vehicle__plate')
        )

        arla_totals = dict(
            qs.filter(fuel_type=FuelLog.FUEL_ARLA)
            .values('vehicle_id')
            .annotate(total=Sum('liters'))
            .values_list('vehicle_id', 'total')
        )

        rows = []
        grand_distance = 0
        grand_liters = Decimal('0')
        diesel_vehicle_ids = set()

        for row in diesel_agg:
            vid = row['vehicle__id']
            diesel_vehicle_ids.add(vid)
            distance = max((row['max_odometer'] or 0) - (row['min_odometer'] or 0), 0)
            liters = row['total_liters'] or Decimal('0')
            avg_consumption = None
            if distance > 0 and liters > 0 and row['refuel_count'] >= 2:
                avg_consumption = round(distance / float(liters), 3)

            grand_distance += distance
            grand_liters += liters

            rows.append({
                'vehicle_id': vid,
                'vehicle': f"{row['vehicle__plate']} - {row['vehicle__model']} ({row['vehicle__year']})",
                'plate': row['vehicle__plate'],
                'model': row['vehicle__model'],
                'refuel_count': row['refuel_count'],
                'total_liters_diesel': str(liters),
                'total_liters_arla': str(arla_totals.get(vid) or Decimal('0')),
                'distance_km': distance,
                'avg_consumption': avg_consumption,
                'first_date': str(row['first_date']) if row['first_date'] else None,
                'last_date': str(row['last_date']) if row['last_date'] else None,
            })

        # Veículos com abastecimento só de Arla no período (sem Diesel) ainda entram
        # no relatório, com as colunas de consumo/distância vazias.
        only_arla = (
            qs.filter(fuel_type=FuelLog.FUEL_ARLA)
            .exclude(vehicle_id__in=diesel_vehicle_ids)
            .values('vehicle__id', 'vehicle__plate', 'vehicle__model', 'vehicle__year')
            .annotate(total=Sum('liters'))
        )
        for row in only_arla:
            rows.append({
                'vehicle_id': row['vehicle__id'],
                'vehicle': f"{row['vehicle__plate']} - {row['vehicle__model']} ({row['vehicle__year']})",
                'plate': row['vehicle__plate'],
                'model': row['vehicle__model'],
                'refuel_count': 0,
                'total_liters_diesel': '0',
                'total_liters_arla': str(row['total'] or Decimal('0')),
                'distance_km': 0,
                'avg_consumption': None,
                'first_date': None,
                'last_date': None,
            })

        rows.sort(key=lambda r: r['plate'] or '')

        fleet_avg_consumption = (
            round(grand_distance / float(grand_liters), 3) if grand_liters > 0 else None
        )

        return Response({
            'rows': rows,
            'meta': {
                'total': len(rows),
                'aggregates': {
                    'total_distance_km': grand_distance,
                    'total_liters_diesel': str(grand_liters),
                    'fleet_avg_consumption': fleet_avg_consumption,
                },
            },
        })

    # ------------------------------------------------------------------
    # Relatório: Fechamento Mensal (composto, por veículo — apenas PDF)
    # ------------------------------------------------------------------
    def _handle_monthly_closing(self, request, tenant):
        params = request.query_params

        vehicle_id_raw = params.get('vehicle_id') or params.get('vehicle')
        if not vehicle_id_raw:
            return Response(
                {'detail': 'Selecione um veículo para gerar o fechamento mensal.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            vehicle_id = int(vehicle_id_raw)
        except (TypeError, ValueError):
            return Response({'detail': 'Veículo inválido.'}, status=http_status.HTTP_400_BAD_REQUEST)

        vehicle = Vehicle.objects.filter(id=vehicle_id, tenant=tenant).first()
        if not vehicle:
            return Response({'detail': 'Veículo não encontrado.'}, status=http_status.HTTP_404_NOT_FOUND)

        start, end = self._get_dates(params)
        if not start or not end:
            return Response(
                {'detail': 'Informe a data de início e fim do período para o fechamento mensal.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # ---- Viagens do período (por data de início/abertura da viagem) ----
        trips_qs = (
            Trip.objects.filter(vehicle=vehicle)
            .filter(Q(start_date__gte=start, start_date__lte=end) | Q(start_date__isnull=True, date__gte=start, date__lte=end))
            .select_related('driver')
            .order_by('start_date', 'date', 'id')
        )

        trip_rows = []
        driver_payment_rows = []
        total_gross = Decimal('0')
        total_trip_expense = Decimal('0')
        total_driver_payment = Decimal('0')

        for t in trips_qs:
            tv = t.total_value or Decimal('0')
            ev = t.expense_value or Decimal('0')
            dp = t.driver_payment or Decimal('0')
            net = tv - ev - dp
            total_gross += tv
            total_trip_expense += ev
            total_driver_payment += dp

            trip_rows.append([
                _fmt_date(t.start_date or t.date),
                _fmt_date(t.end_date),
                MODALITY_LABELS.get(t.modality, t.modality),
                STATUS_LABELS.get(t.status, t.status),
                _fmt_money(tv),
                _fmt_money(ev),
                _fmt_money(dp),
                _fmt_money(net),
            ])

            if t.driver_id and not t.driver_is_owner:
                driver_payment_rows.append([
                    t.driver.name,
                    _fmt_date(t.start_date or t.date),
                    _fmt_date(t.end_date),
                    _fmt_money(tv),
                    _fmt_money(dp),
                ])

        # ---- Lançamentos (gastos/receitas) do período, por data do lançamento ----
        movements_qs = (
            TripMovement.objects.filter(trip__vehicle=vehicle, date__gte=start, date__lte=end)
            .order_by('date', 'id')
        )

        movement_rows = []
        total_movement_expense = Decimal('0')
        total_movement_revenue = Decimal('0')
        category_totals = {}

        for m in movements_qs:
            amount = m.amount or Decimal('0')
            if m.movement_type == 'expense':
                total_movement_expense += amount
                cat = category_totals.setdefault(m.expense_category, {'total': Decimal('0'), 'count': 0})
                cat['total'] += amount
                cat['count'] += 1
            else:
                total_movement_revenue += amount

            movement_rows.append([
                _fmt_date(m.date),
                MOVEMENT_TYPE_LABELS.get(m.movement_type, m.movement_type),
                MOVEMENT_CATEGORY_LABELS.get(m.expense_category, m.expense_category) if m.movement_type == 'expense' else '—',
                _fmt_money(amount),
                m.description or '—',
            ])

        category_rows = [
            [MOVEMENT_CATEGORY_LABELS.get(cat, cat), str(info['count']), _fmt_money(info['total'])]
            for cat, info in sorted(category_totals.items(), key=lambda kv: kv[1]['total'], reverse=True)
        ]

        # ---- Consumo de combustível do período ----
        fuel_qs = FuelLog.objects.filter(vehicle=vehicle, date__gte=start, date__lte=end).order_by('date', 'id')
        fuel_rows = []
        for f in fuel_qs:
            fuel_rows.append([
                _fmt_date(f.date),
                f.get_fuel_type_display(),
                f'{f.liters:.3f} L'.replace('.', ','),
                _fmt_money(f.price_per_liter) if f.price_per_liter is not None else '—',
                _fmt_money(f.discount) if f.discount else '—',
                _fmt_money(f.paid_value),
                f'{f.odometer_km} km',
            ])

        diesel_qs = fuel_qs.filter(fuel_type=FuelLog.FUEL_DIESEL)
        diesel_agg = diesel_qs.aggregate(total_liters=Sum('liters'), min_km=Min('odometer_km'), max_km=Max('odometer_km'), count=Count('id'))
        arla_total = fuel_qs.filter(fuel_type=FuelLog.FUEL_ARLA).aggregate(total=Sum('liters'))['total'] or Decimal('0')
        diesel_liters = diesel_agg['total_liters'] or Decimal('0')
        distance_km = max((diesel_agg['max_km'] or 0) - (diesel_agg['min_km'] or 0), 0)
        avg_consumption = None
        if distance_km > 0 and diesel_liters > 0 and (diesel_agg['count'] or 0) >= 2:
            avg_consumption = round(distance_km / float(diesel_liters), 3)

        fuel_summary = [
            f'Abastecimentos no período: {fuel_qs.count()}',
            f"Litros de Diesel: {str(diesel_liters).replace('.', ',')} L",
            f"Litros de Arla: {str(arla_total).replace('.', ',')} L",
            f'Distância percorrida (base Diesel): {distance_km} km',
            f"Consumo médio: {str(avg_consumption).replace('.', ',') + ' km/l' if avg_consumption is not None else '—'}",
        ]

        # ---- Resumo financeiro do fechamento ----
        net_result = total_gross + total_movement_revenue - total_movement_expense - total_driver_payment
        financial_summary = [
            ('Receita bruta das viagens no período', _fmt_money(total_gross)),
            ('Receitas extras lançadas (fora do valor da viagem)', _fmt_money(total_movement_revenue)),
            ('Despesas lançadas no período (combustível + outros gastos)', _fmt_money(total_movement_expense)),
            ('Pagamento ao motorista (viagens do período)', _fmt_money(total_driver_payment)),
            ('Resultado do período', _fmt_money(net_result)),
        ]

        pdf_bytes = self._build_monthly_closing_pdf(
            tenant=tenant,
            vehicle=vehicle,
            start=start,
            end=end,
            financial_summary=financial_summary,
            trip_rows=trip_rows,
            movement_rows=movement_rows,
            driver_payment_rows=driver_payment_rows,
            category_rows=category_rows,
            fuel_summary=fuel_summary,
            fuel_rows=fuel_rows,
        )

        period_slug = f"{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}"
        filename = f"fechamento_mensal_{vehicle.plate}_{period_slug}.pdf".replace(' ', '_')
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @staticmethod
    def _build_monthly_closing_pdf(tenant, vehicle, start, end, financial_summary, trip_rows,
                                    movement_rows, driver_payment_rows, category_rows,
                                    fuel_summary, fuel_rows):
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
        from reportlab.lib.units import mm

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=landscape(A4),
            leftMargin=15 * mm, rightMargin=15 * mm,
            topMargin=15 * mm, bottomMargin=15 * mm,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=15, spaceAfter=4)
        subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=9, textColor=colors.grey, spaceAfter=10)
        section_style = ParagraphStyle('Section', parent=styles['Heading3'], fontName='Helvetica-Bold', fontSize=11,
                                        textColor=colors.HexColor('#1E3A8A'), spaceBefore=14, spaceAfter=3)
        section_note_style = ParagraphStyle('SectionNote', parent=styles['Normal'], fontSize=7.5, textColor=colors.grey, spaceAfter=6)
        normal = styles['Normal']
        empty_style = ParagraphStyle('Empty', parent=styles['Normal'], fontSize=8, textColor=colors.grey, spaceAfter=6)

        def section_header(title, note):
            """Título + legenda mantidos juntos para não 'sobrar' sozinhos no fim da página."""
            return KeepTogether([Paragraph(title, section_style), Paragraph(note, section_note_style)])

        def make_table(headers, rows, col_widths=None):
            data = [headers] + rows
            tbl = Table(data, repeatRows=1, hAlign='LEFT', colWidths=col_widths)
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#111827')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 7.5),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
                ('TOPPADDING', (0, 0), (-1, 0), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 3),
                ('RIGHTPADDING', (0, 0), (-1, -1), 3),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E5E7EB')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FAFAFB')]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            return tbl

        story = []
        story.append(Paragraph('Fechamento Mensal — Transportadora', title_style))
        story.append(Paragraph(
            f"Veículo: <b>{vehicle.plate}</b> — {vehicle.model or ''} ({vehicle.year or '—'}) &nbsp;|&nbsp; "
            f"Período: <b>{_fmt_date(start)}</b> até <b>{_fmt_date(end)}</b> &nbsp;|&nbsp; Tenant: {tenant.name}",
            subtitle_style,
        ))

        # ---- Resumo financeiro ----
        story.append(section_header(
            'Resumo Financeiro do Fechamento',
            'Consolidado do período: receita das viagens, lançamentos de despesa/receita e pagamento ao motorista.',
        ))
        summary_tbl = Table(
            [[label, value] for label, value in financial_summary],
            colWidths=[130 * mm, 40 * mm], hAlign='LEFT',
        )
        summary_style = [
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (0, 0), (-1, -2), 0.25, colors.HexColor('#E5E7EB')),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('LINEABOVE', (0, -1), (-1, -1), 0.75, colors.HexColor('#111827')),
            ('TOPPADDING', (0, -1), (-1, -1), 6),
        ]
        summary_tbl.setStyle(TableStyle(summary_style))
        story.append(summary_tbl)

        # ---- Viagens do período ----
        story.append(section_header(
            'Viagens do Período',
            'Todas as viagens deste veículo cujo início ocorreu dentro do período selecionado.',
        ))
        if trip_rows:
            story.append(make_table(
                ['Início', 'Fim', 'Modalidade', 'Status', 'Bruto (R$)', 'Despesas (R$)', 'Motorista (R$)', 'Líquido (R$)'],
                trip_rows,
            ))
        else:
            story.append(Paragraph('Nenhuma viagem iniciada neste período.', empty_style))

        # ---- Lançamentos (gastos/receitas) ----
        story.append(section_header(
            'Lançamentos (Gastos/Receitas)',
            'Movimentações financeiras lançadas nas viagens deste veículo, pela data do próprio lançamento.',
        ))
        if movement_rows:
            story.append(make_table(
                ['Data', 'Tipo', 'Categoria', 'Valor (R$)', 'Descrição'],
                movement_rows,
            ))
        else:
            story.append(Paragraph('Nenhum lançamento neste período.', empty_style))

        # ---- Pagamento ao motorista ----
        story.append(section_header(
            'Pagamento ao Motorista',
            'Viagens do período com motorista vinculado (exclui viagens em que o motorista é o proprietário).',
        ))
        if driver_payment_rows:
            story.append(make_table(
                ['Motorista', 'Início', 'Fim', 'Valor da Viagem (R$)', 'Pagamento (R$)'],
                driver_payment_rows,
            ))
        else:
            story.append(Paragraph('Nenhum pagamento a motorista neste período.', empty_style))

        # ---- Resumo por categoria ----
        story.append(section_header(
            'Resumo por Categoria de Despesa',
            'Total de despesas lançadas no período, agrupado por categoria.',
        ))
        if category_rows:
            story.append(make_table(['Categoria', 'Lançamentos', 'Total (R$)'], category_rows))
        else:
            story.append(Paragraph('Nenhuma despesa lançada neste período.', empty_style))

        # ---- Consumo de combustível ----
        story.append(section_header(
            'Consumo de Combustível',
            'Abastecimentos registrados no período. O consumo médio (km/l) considera apenas Diesel.',
        ))
        for line in fuel_summary:
            story.append(Paragraph(f'• {line}', normal))
        story.append(Spacer(1, 4))
        if fuel_rows:
            story.append(make_table(
                ['Data', 'Tipo', 'Litros', 'Valor/Litro (R$)', 'Desconto (R$)', 'Valor Pago (R$)', 'KM'],
                fuel_rows,
            ))
        else:
            story.append(Paragraph('Nenhum abastecimento registrado neste período.', empty_style))

        story.append(Spacer(1, 10))
        generated_at = datetime.utcnow().strftime('%d/%m/%Y %H:%M UTC')
        story.append(Paragraph(
            f'Relatório gerado em: {generated_at}',
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7, textColor=colors.grey)
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
