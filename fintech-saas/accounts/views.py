from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.db.models import Q
from django.utils.dateparse import parse_date
from django.contrib.auth import get_user_model
from .models import Tenant, TenantParameter, TenantAuditLog
from .audit import log_tenant_action
from .serializers import (
    UserSerializer, UserCreateSerializer, TenantSerializer,
    CustomTokenObtainPairSerializer, TenantAdminCreateSerializer,
    TenantAdminUserCreateSerializer, TenantAdminUserUpdateSerializer,
    TenantParameterSerializer, TenantAuditLogSerializer, AccountSelfSignupSerializer,
)
from .permissions import IsPlatformAdmin, IsTenantAdminOrManager, IsSuperUserOnly

User = get_user_model()


MODULE_AUDIT_ENTITY_TYPES = {
    TenantParameter.MODULE_GENERAL: ['tenant_parameters', 'user', 'tenant', 'module_installation'],
    TenantParameter.MODULE_FINANCE: ['category', 'transaction', 'recurring_transaction', 'payment_method', 'credit_card_invoice', 'module_installation'],
    TenantParameter.MODULE_TRANSPORT: ['trip', 'trip_movement', 'vehicle', 'transport_revenue', 'transport_expense', 'tire_inventory', 'vehicle_tire_placement', 'maintenance', 'oil_change', 'maintenance_alert', 'module_installation'],
    TenantParameter.MODULE_INVESTMENTS: ['investment', 'investment_recommendation', 'module_installation'],
}


def _log_module_installations(*, tenant, user, source='unknown'):
    installed_modules = [TenantParameter.MODULE_GENERAL, TenantParameter.MODULE_FINANCE]
    if getattr(tenant, 'has_module_transport', False):
        installed_modules.append(TenantParameter.MODULE_TRANSPORT)
    if getattr(tenant, 'has_module_investments', False):
        installed_modules.append(TenantParameter.MODULE_INVESTMENTS)

    for module in installed_modules:
        log_tenant_action(
            tenant=tenant,
            user=user,
            action='module_installed',
            entity_type='module_installation',
            entity_id=module,
            details={
                'module': module,
                'source': source,
                'installed_modules': installed_modules,
            },
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    View customizada para obter tokens JWT.
    Retorna access token, refresh token e informações do usuário.
    """
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar usuários.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Retorna apenas usuários do tenant atual"""
        if hasattr(self.request, 'tenant') and self.request.tenant:
            return User.objects.filter(tenant=self.request.tenant)
        return User.objects.filter(tenant=self.request.user.tenant)
    
    def get_serializer_class(self):
        """Usa serializer diferente para criar usuários"""
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Retorna informações do usuário atual"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def register(self, request):
        """Cria novo usuário"""
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                UserSerializer(user).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny], url_path='register-account')
    def register_account(self, request):
        """Auto cadastro: cria tenant e usuário admin do próprio cliente."""
        serializer = AccountSelfSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_tenant_action(
            tenant=user.tenant,
            user=user,
            action='tenant_created',
            entity_type='tenant',
            entity_id=str(user.tenant.id),
            details={
                'module': TenantParameter.MODULE_GENERAL,
                'source': 'self_signup',
                'tenant_slug': user.tenant.slug,
            },
        )
        _log_module_installations(tenant=user.tenant, user=user, source='self_signup')
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['put'], permission_classes=[IsAuthenticated])
    def update_profile(self, request, pk=None):
        """Atualiza perfil do usuário"""
        user = self.get_object()
        
        # Verificar permissão
        if user != request.user and not request.user.is_staff:
            return Response(
                {'detail': 'Você não tem permissão para atualizar este usuário.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(
        detail=False,
        methods=['get', 'post'],
        permission_classes=[IsAuthenticated, IsTenantAdminOrManager],
        url_path='current-tenant-users'
    )
    def current_tenant_users(self, request):
        """Lista/cria usuários do tenant atual (somente admin/manager do tenant)."""
        tenant = getattr(request.user, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant do usuário não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.method.lower() == 'get':
            users = User.objects.filter(tenant=tenant).order_by('username')
            return Response(UserSerializer(users, many=True).data)

        serializer = TenantAdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        username = validated.get('username')
        email = validated.get('email')
        password = validated.pop('password')
        validated.pop('password_confirm', None)

        if User.objects.filter(username=username).exists():
            return Response({'username': ['Username já em uso.']}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email, tenant=tenant).exists():
            return Response({'email': ['Email já em uso neste tenant.']}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(tenant=tenant, password=password, **validated)
        log_tenant_action(
            tenant=tenant,
            user=request.user,
            action='user_created',
            entity_type='user',
            entity_id=str(user.id),
            details={'email': user.email, 'role': user.role},
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=['patch'],
        permission_classes=[IsAuthenticated, IsTenantAdminOrManager],
        url_path=r'current-tenant-users/(?P<user_id>[^/.]+)'
    )
    def current_tenant_user_update(self, request, user_id=None):
        """Atualiza dados/papel/ativo de usuário do tenant atual (somente admin/manager)."""
        tenant = getattr(request.user, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant do usuário não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id, tenant=tenant)
        except User.DoesNotExist:
            return Response({'detail': 'Usuário não encontrado neste tenant.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = TenantAdminUserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_tenant_action(
            tenant=tenant,
            user=request.user,
            action='user_updated',
            entity_type='user',
            entity_id=str(user.id),
            details={'email': user.email, 'role': user.role, 'is_active': user.is_active},
        )
        return Response(UserSerializer(user).data)


class TenantViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para visualizar informações do Tenant.
    """
    queryset = Tenant.objects.filter(is_active=True)
    serializer_class = TenantSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated and getattr(user, 'is_superuser', False):
            return Tenant.objects.all()
        return Tenant.objects.filter(is_active=True)

    def get_serializer_class(self):
        if self.action == 'create_tenant':
            return TenantAdminCreateSerializer
        return TenantSerializer
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def current(self, request):
        """Retorna informações do tenant atual do usuário"""
        tenant = request.user.tenant
        serializer = self.get_serializer(tenant)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsPlatformAdmin],
        url_path='create'
    )
    def create_tenant(self, request):
        """Cria novo tenant (somente admin de plataforma)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = serializer.save()
        log_tenant_action(
            tenant=tenant,
            user=request.user,
            action='tenant_created',
            entity_type='tenant',
            entity_id=str(tenant.id),
            details={
                'module': TenantParameter.MODULE_GENERAL,
                'source': 'platform_admin',
                'tenant_slug': tenant.slug,
            },
        )
        _log_module_installations(tenant=tenant, user=request.user, source='platform_admin')
        return Response(TenantSerializer(tenant).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['get', 'post'],
        permission_classes=[IsAuthenticated, IsPlatformAdmin],
        url_path='users'
    )
    def users(self, request, slug=None):
        """Lista ou cria usuários de um tenant (somente admin de plataforma)."""
        tenant = self.get_object()

        if request.method.lower() == 'get':
            users = User.objects.filter(tenant=tenant).order_by('username')
            data = UserSerializer(users, many=True).data
            return Response(data)

        serializer = TenantAdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = serializer.validated_data
        username = validated.get('username')
        email = validated.get('email')
        password = validated.pop('password')
        validated.pop('password_confirm', None)

        if User.objects.filter(username=username).exists():
            return Response({'username': ['Username já em uso.']}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email, tenant=tenant).exists():
            return Response({'email': ['Email já em uso neste tenant.']}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(tenant=tenant, password=password, **validated)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['patch'],
        permission_classes=[IsAuthenticated, IsPlatformAdmin],
        url_path=r'users/(?P<user_id>[^/.]+)'
    )
    def update_user(self, request, slug=None, user_id=None):
        """Atualiza dados/papel/ativo de usuário do tenant (somente admin de plataforma)."""
        tenant = self.get_object()
        try:
            user = User.objects.get(id=user_id, tenant=tenant)
        except User.DoesNotExist:
            return Response({'detail': 'Usuário não encontrado neste tenant.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = TenantAdminUserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(user).data)

    @action(
        detail=False,
        methods=['get', 'put'],
        permission_classes=[IsAuthenticated],
        url_path='current/parameters'
    )
    def current_parameters(self, request):
        """Lista ou atualiza parâmetros de módulo do tenant atual."""
        tenant = getattr(request.user, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant do usuário não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        module = (request.query_params.get('module') or request.data.get('module') or '').strip().lower()
        if module not in [
            TenantParameter.MODULE_GENERAL,
            TenantParameter.MODULE_FINANCE,
            TenantParameter.MODULE_TRANSPORT,
            TenantParameter.MODULE_INVESTMENTS,
        ]:
            return Response({'module': ['Módulo inválido.']}, status=status.HTTP_400_BAD_REQUEST)

        if module == TenantParameter.MODULE_TRANSPORT and not tenant.has_module_transport:
            return Response({'detail': 'Módulo transport não habilitado para este tenant.'}, status=status.HTTP_403_FORBIDDEN)
        if module == TenantParameter.MODULE_INVESTMENTS and not tenant.has_module_investments:
            return Response({'detail': 'Módulo investments não habilitado para este tenant.'}, status=status.HTTP_403_FORBIDDEN)

        defaults = {}
        if module == TenantParameter.MODULE_TRANSPORT:
            defaults = {
                'TIPO_RECEBIMENTO_MOTORISTA': '1',
                'PORCENTAGEM_MOTORISTA': '10',
                'TIPO_PORCENTAGEM': 'bruta',
                'TRIP_PROGRESS_TYPES': 'Coleta,Em trânsito,Descarga,Retorno',
            }
        elif module == TenantParameter.MODULE_GENERAL:
            defaults = {
                'PASSWORD_MIN_LENGTH': '8',
                'SESSION_TIMEOUT_MINUTES': '60',
                'DEFAULT_CURRENCY': 'BRL',
                'TIMEZONE': 'America/Sao_Paulo',
                'DATE_FORMAT': 'DD/MM/YYYY',
                'REQUIRE_APPROVAL_FOR_HIGH_EXPENSE': 'false',
                'APPROVAL_THRESHOLD_AMOUNT': '1000',
            }

        existing = {
            p.key: p
            for p in TenantParameter.objects.filter(tenant=tenant, module=module)
        }

        if request.method.lower() == 'get':
            keys = set(defaults.keys()) | set(existing.keys())
            data = []
            for key in sorted(keys):
                p = existing.get(key)
                data.append({
                    'id': str(p.id) if p else None,
                    'module': module,
                    'key': key,
                    'value': p.value if p else defaults.get(key, ''),
                    'description': p.description if p else '',
                    'created_at': p.created_at if p else None,
                    'updated_at': p.updated_at if p else None,
                })
            return Response(data)

        if not IsTenantAdminOrManager().has_permission(request, self):
            return Response({'detail': IsTenantAdminOrManager.message}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data.get('parameters', request.data)
        if isinstance(payload, dict):
            payload = [
                {'key': k, 'value': str(v), 'module': module}
                for k, v in payload.items()
                if k != 'module'
            ]

        if not isinstance(payload, list):
            return Response({'parameters': ['Formato inválido.']}, status=status.HTTP_400_BAD_REQUEST)

        updated = []
        for item in payload:
            key = str(item.get('key', '')).strip()
            if not key:
                continue
            value = str(item.get('value', '')).strip()
            description = str(item.get('description', '')).strip()
            obj, _ = TenantParameter.objects.update_or_create(
                tenant=tenant,
                module=module,
                key=key,
                defaults={'value': value, 'description': description},
            )
            updated.append(obj)

        log_tenant_action(
            tenant=tenant,
            user=request.user,
            action='parameters_updated',
            entity_type='tenant_parameters',
            entity_id=module,
            details={'module': module, 'keys': [item.key for item in updated]},
        )

        return Response(TenantParameterSerializer(updated, many=True).data)

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[IsAuthenticated, IsTenantAdminOrManager],
        url_path='current/audit-logs'
    )
    def current_audit_logs(self, request):
        tenant = getattr(request.user, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant do usuário não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        limit = request.query_params.get('limit')
        try:
            limit = int(limit) if limit is not None else 50
        except (ValueError, TypeError):
            limit = 50
        limit = min(max(limit, 1), 200)

        module = str(request.query_params.get('module') or '').strip().lower()
        action_filter = str(request.query_params.get('action') or '').strip()
        entity_type_filter = str(request.query_params.get('entity_type') or '').strip()
        user_email_filter = str(request.query_params.get('user_email') or '').strip()
        query = str(request.query_params.get('q') or '').strip()
        start_date_str = str(request.query_params.get('start_date') or '').strip()
        end_date_str = str(request.query_params.get('end_date') or '').strip()

        logs_qs = TenantAuditLog.objects.filter(tenant=tenant).select_related('user')

        if module:
            if module not in MODULE_AUDIT_ENTITY_TYPES:
                return Response({'module': ['Módulo inválido.']}, status=status.HTTP_400_BAD_REQUEST)

            module_entity_types = MODULE_AUDIT_ENTITY_TYPES.get(module, [])
            module_q = Q(details__module=module) | Q(entity_id=module, entity_type='module_installation')
            if module_entity_types:
                module_q = module_q | Q(entity_type__in=module_entity_types)
            logs_qs = logs_qs.filter(module_q)

        if action_filter:
            logs_qs = logs_qs.filter(action__icontains=action_filter)

        if entity_type_filter:
            logs_qs = logs_qs.filter(entity_type__icontains=entity_type_filter)

        if user_email_filter:
            logs_qs = logs_qs.filter(user__email__icontains=user_email_filter)

        if query:
            logs_qs = logs_qs.filter(
                Q(action__icontains=query)
                | Q(entity_type__icontains=query)
                | Q(entity_id__icontains=query)
                | Q(user__email__icontains=query)
            )

        start_date = parse_date(start_date_str) if start_date_str else None
        if start_date:
            logs_qs = logs_qs.filter(created_at__date__gte=start_date)

        end_date = parse_date(end_date_str) if end_date_str else None
        if end_date:
            logs_qs = logs_qs.filter(created_at__date__lte=end_date)

        logs = logs_qs[:limit]
        return Response(TenantAuditLogSerializer(logs, many=True).data)

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[IsAuthenticated, IsSuperUserOnly],
        url_path='accounts'
    )
    def accounts(self, request):
        """Lista contas (tenants) para gestão financeira por superusuário."""
        tenants = Tenant.objects.all().order_by('-created_at')
        return Response(TenantSerializer(tenants, many=True).data)

    @action(
        detail=True,
        methods=['patch'],
        permission_classes=[IsAuthenticated, IsSuperUserOnly],
        url_path='account-status'
    )
    def account_status(self, request, slug=None):
        """Atualiza status de conta e vencimento do tenant (somente superusuário)."""
        tenant = self.get_object()

        allowed_status = {
            Tenant.ACCOUNT_STATUS_ACTIVE,
            Tenant.ACCOUNT_STATUS_PAST_DUE,
            Tenant.ACCOUNT_STATUS_SUSPENDED,
            Tenant.ACCOUNT_STATUS_CANCELLED,
        }

        payload_status = request.data.get('account_status', tenant.account_status)
        if payload_status not in allowed_status:
            return Response({'account_status': ['Status inválido.']}, status=status.HTTP_400_BAD_REQUEST)

        tenant.account_status = payload_status
        if 'billing_due_date' in request.data:
            tenant.billing_due_date = request.data.get('billing_due_date') or None
        if 'is_active' in request.data:
            raw_active = request.data.get('is_active')
            if isinstance(raw_active, bool):
                tenant.is_active = raw_active
            else:
                tenant.is_active = str(raw_active).strip().lower() in {'1', 'true', 'yes', 'on'}
        if 'account_notes' in request.data:
            tenant.account_notes = str(request.data.get('account_notes') or '')
        tenant.save(update_fields=['account_status', 'billing_due_date', 'is_active', 'account_notes', 'updated_at'])

        return Response(TenantSerializer(tenant).data)
