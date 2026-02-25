from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from .models import Tenant
from .serializers import (
    UserSerializer, UserCreateSerializer, TenantSerializer,
    CustomTokenObtainPairSerializer
)

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
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def current(self, request):
        """Retorna informações do tenant atual do usuário"""
        tenant = request.user.tenant
        serializer = self.get_serializer(tenant)
        return Response(serializer.data)
