import json
import re
from datetime import date, datetime, timedelta
from decimal import Decimal

import requests
from django.conf import settings
from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from finance.models import Category, Transaction
from transport.models import Vehicle, Trip, TripMovement
from transport.serializers import TripSerializer, TripMovementSerializer

PLATE_REGEX = re.compile(r'\b[A-Z]{3}[0-9][A-Z0-9][0-9]{2}\b')
AMOUNT_REGEX = re.compile(r'(?<!\d)(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{1,2})|\d+(?:[\.,]\d{1,2})?)')


class AssistantParser:
    @staticmethod
    def _normalize_text(text: str) -> str:
        return (text or '').strip()

    @staticmethod
    def _extract_amount(text: str):
        matches = AMOUNT_REGEX.findall(text)
        if not matches:
            return None
        raw = matches[-1].replace('.', '').replace(',', '.')
        try:
            value = Decimal(raw)
            return value if value > 0 else None
        except Exception:
            return None

    @staticmethod
    def _extract_date(text: str):
        lowered = text.lower()
        if 'hoje' in lowered:
            return date.today()
        if 'ontem' in lowered:
            return date.today() - timedelta(days=1)

        for pattern, parser in [
            (r'\b(\d{4}-\d{2}-\d{2})\b', lambda s: datetime.strptime(s, '%Y-%m-%d').date()),
            (r'\b(\d{2}/\d{2}/\d{4})\b', lambda s: datetime.strptime(s, '%d/%m/%Y').date()),
            (r'\b(\d{2}-\d{2}-\d{4})\b', lambda s: datetime.strptime(s, '%d-%m-%Y').date()),
        ]:
            m = re.search(pattern, text)
            if m:
                try:
                    return parser(m.group(1))
                except Exception:
                    pass

        return date.today()

    @staticmethod
    def _extract_plate(text: str):
        m = PLATE_REGEX.search(text.upper())
        return m.group(0).upper() if m else None

    @staticmethod
    def _extract_trip_modality(text: str):
        lowered = text.lower()
        if any(token in lowered for token in ['ton', 'tonelada', 'toneladas']):
            return 'per_ton'
        if any(token in lowered for token in ['diaria', 'diárias', 'diarias', 'arrendamento', 'alocacao']):
            return 'lease'
        return None

    @staticmethod
    def _extract_number_after_keyword(text: str, keywords):
        lowered = text.lower()
        for keyword in keywords:
            idx = lowered.find(keyword)
            if idx == -1:
                continue
            snippet = text[idx: idx + 40]
            amount = AssistantParser._extract_amount(snippet)
            if amount is not None:
                return amount
        return None

    @staticmethod
    def _guess_transaction_type(text: str):
        lowered = text.lower()
        if any(token in lowered for token in ['receita', 'entrada', 'recebi', 'ganho', 'faturei']):
            return 'income'
        if any(token in lowered for token in ['despesa', 'gasto', 'paguei', 'saida', 'saída']):
            return 'expense'
        return None

    @staticmethod
    def _parse_with_gemini_if_configured(message: str):
        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not api_key:
            return None

        prompt = (
            'Você é um parser de comandos de ERP. Retorne APENAS JSON válido sem markdown. '\
            'Estrutura: {"intent":"finance_transaction|trip_create|trip_movement|unknown", "draft":{...}}. '\
            'Se for financeiro: draft contém type(income|expense), amount, description, transaction_date(YYYY-MM-DD). '\
            'Se for trip_create: draft contém plate, modality(per_ton|lease), tons/rate_per_ton ou days/daily_rate, start_date, description. '\
            'Se for trip_movement: draft contém plate, movement_type(expense|revenue), expense_category(fuel|other opcional), amount, date, description. '\
            f'Mensagem: {message}'
        )

        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}'
        payload = {
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 400},
        }

        try:
            response = requests.post(url, json=payload, timeout=8)
            response.raise_for_status()
            data = response.json()
            text = data['candidates'][0]['content']['parts'][0]['text']
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None

    @staticmethod
    def parse(message: str):
        text = AssistantParser._normalize_text(message)
        if not text:
            return {'intent': 'unknown', 'draft': {}, 'missing_fields': ['message'], 'provider': 'rule-based'}

        ai_result = AssistantParser._parse_with_gemini_if_configured(text)
        if ai_result:
            ai_result.setdefault('provider', 'gemini')
            ai_result.setdefault('draft', {})
            return ai_result

        lowered = text.lower()
        amount = AssistantParser._extract_amount(text)
        parsed_date = AssistantParser._extract_date(text)
        plate = AssistantParser._extract_plate(text)

        if 'viagem' in lowered and any(token in lowered for token in ['criar', 'nova', 'abrir', 'iniciar']):
            modality = AssistantParser._extract_trip_modality(text)
            tons = AssistantParser._extract_number_after_keyword(text, ['ton', 'tonelada'])
            rate = AssistantParser._extract_number_after_keyword(text, ['valor tonelada', 'rate', 'tarifa'])
            days = AssistantParser._extract_number_after_keyword(text, ['dias', 'diarias'])
            daily_rate = AssistantParser._extract_number_after_keyword(text, ['diaria', 'diárias', 'valor diaria'])
            draft = {
                'plate': plate,
                'modality': modality,
                'tons': float(tons) if tons is not None else None,
                'rate_per_ton': float(rate) if rate is not None else None,
                'days': int(days) if days is not None else None,
                'daily_rate': float(daily_rate) if daily_rate is not None else None,
                'start_date': parsed_date.isoformat(),
                'description': text,
                'status': 'in_progress',
            }
            missing = []
            if not plate:
                missing.append('plate')
            if not modality:
                missing.append('modality')
            if modality == 'per_ton' and (draft['tons'] is None or draft['rate_per_ton'] is None):
                missing.extend(['tons', 'rate_per_ton'])
            if modality == 'lease' and (draft['days'] is None or draft['daily_rate'] is None):
                missing.extend(['days', 'daily_rate'])
            return {'intent': 'trip_create', 'draft': draft, 'missing_fields': sorted(set(missing)), 'provider': 'rule-based'}

        if any(token in lowered for token in ['lancamento', 'lançamento', 'lancar', 'lançar']) and 'viagem' in lowered:
            movement_type = 'revenue' if any(token in lowered for token in ['receita', 'recebi', 'entrada']) else 'expense'
            expense_category = ''
            if movement_type == 'expense':
                expense_category = 'fuel' if any(token in lowered for token in ['combustivel', 'diesel', 'gasolina']) else 'other'
            draft = {
                'plate': plate,
                'movement_type': movement_type,
                'expense_category': expense_category,
                'amount': float(amount) if amount is not None else None,
                'date': parsed_date.isoformat(),
                'description': text,
            }
            missing = []
            if not plate:
                missing.append('plate')
            if amount is None:
                missing.append('amount')
            return {'intent': 'trip_movement', 'draft': draft, 'missing_fields': missing, 'provider': 'rule-based'}

        tx_type = AssistantParser._guess_transaction_type(text)
        if tx_type or 'finance' in lowered or 'financas' in lowered:
            draft = {
                'type': tx_type,
                'amount': float(amount) if amount is not None else None,
                'description': text,
                'transaction_date': parsed_date.isoformat(),
            }
            missing = []
            if not tx_type:
                missing.append('type')
            if amount is None:
                missing.append('amount')
            return {'intent': 'finance_transaction', 'draft': draft, 'missing_fields': missing, 'provider': 'rule-based'}

        return {'intent': 'unknown', 'draft': {'description': text}, 'missing_fields': ['intent'], 'provider': 'rule-based'}


class AssistantParseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '')
        parsed = AssistantParser.parse(message)
        return Response(parsed)


class AssistantExecuteView(APIView):
    permission_classes = [IsAuthenticated]

    def _find_vehicle(self, tenant, plate):
        if not plate:
            return None
        return Vehicle.objects.filter(tenant=tenant, plate__iexact=plate).first()

    @transaction.atomic
    def post(self, request):
        intent = (request.data.get('intent') or '').strip()
        draft = request.data.get('draft') or {}
        confirm = bool(request.data.get('confirm'))

        if not confirm:
            return Response({'detail': 'Confirmação obrigatória para executar ação.'}, status=status.HTTP_400_BAD_REQUEST)

        tenant = request.user.tenant

        if intent == 'finance_transaction':
            tx_type = draft.get('type')
            amount = draft.get('amount')
            description = draft.get('description') or 'Lançamento via Assistente'
            tx_date = draft.get('transaction_date') or date.today().isoformat()

            if tx_type not in {'income', 'expense'} or amount in (None, ''):
                return Response({'detail': 'Dados insuficientes para lançamento financeiro.'}, status=status.HTTP_400_BAD_REQUEST)

            category = Category.objects.filter(tenant=tenant, type=tx_type, is_active=True).first()
            tx = Transaction.objects.create(
                tenant=tenant,
                user=request.user,
                description=description,
                amount=Decimal(str(amount)),
                type=tx_type,
                category=category,
                transaction_date=tx_date,
                status='completed',
            )
            return Response({'detail': 'Lançamento financeiro criado.', 'id': str(tx.id), 'entity': 'transaction'})

        if intent == 'trip_create':
            vehicle = self._find_vehicle(tenant, draft.get('plate'))
            if not vehicle:
                return Response({'detail': 'Veículo não encontrado para o tenant.'}, status=status.HTTP_400_BAD_REQUEST)

            payload = {
                'vehicle': vehicle.id,
                'modality': draft.get('modality'),
                'date': draft.get('start_date') or date.today().isoformat(),
                'start_date': draft.get('start_date') or date.today().isoformat(),
                'status': draft.get('status') or 'in_progress',
                'description': draft.get('description') or 'Viagem criada via Assistente',
                'tons': draft.get('tons'),
                'rate_per_ton': draft.get('rate_per_ton'),
                'days': draft.get('days'),
                'daily_rate': draft.get('daily_rate'),
                'is_received': False,
                'base_expense_value': 0,
                'fuel_expense_value': 0,
                'driver_payment': 0,
            }

            serializer = TripSerializer(data=payload, context={'request': request})
            serializer.is_valid(raise_exception=True)
            trip = serializer.save()
            return Response({'detail': 'Viagem criada com sucesso.', 'id': trip.id, 'entity': 'trip'})

        if intent == 'trip_movement':
            vehicle = self._find_vehicle(tenant, draft.get('plate'))
            if not vehicle:
                return Response({'detail': 'Veículo não encontrado para o tenant.'}, status=status.HTTP_400_BAD_REQUEST)

            trip = Trip.objects.filter(vehicle=vehicle, status='in_progress').order_by('-start_date', '-created_at').first()
            if not trip:
                return Response({'detail': 'Nenhuma viagem em curso encontrada para este veículo.'}, status=status.HTTP_400_BAD_REQUEST)

            payload = {
                'date': draft.get('date') or date.today().isoformat(),
                'movement_type': draft.get('movement_type') or 'expense',
                'expense_category': draft.get('expense_category') or '',
                'amount': draft.get('amount'),
                'description': draft.get('description') or 'Lançamento via Assistente',
            }
            serializer = TripMovementSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            movement = serializer.save(trip=trip)
            trip.recalculate_from_movements()
            return Response({'detail': 'Lançamento da viagem criado.', 'id': movement.id, 'entity': 'trip_movement', 'trip_id': trip.id})

        return Response({'detail': 'Intent não suportado para execução.'}, status=status.HTTP_400_BAD_REQUEST)
