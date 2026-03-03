from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from .models import Tenant, TenantParameter
from .serializers import (
    UserSerializer, UserCreateSerializer, TenantSerializer,
    CustomTokenObtainPairSerializer, TenantAdminCreateSerializer,
    TenantAdminUserCreateSerializer, TenantAdminUserUpdateSerializer,
    TenantParameterSerializer,
)
from .permissions import IsPlatformAdmin, IsTenantAdminOrManager

User = get_user_model()


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


class TenantViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para visualizar informações do Tenant.
    """
    queryset = Tenant.objects.filter(is_active=True)
    serializer_class = TenantSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

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
        if module not in [TenantParameter.MODULE_TRANSPORT, TenantParameter.MODULE_INVESTMENTS]:
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

        return Response(TenantParameterSerializer(updated, many=True).data)
