from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import Tenant

User = get_user_model()


class TenantSerializer(serializers.ModelSerializer):
    """Serializer para Tenant"""
    
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'description', 'email', 'phone', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    """Serializer para User"""
    tenant = TenantSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'bio', 'is_verified', 'preferred_currency',
            'tenant', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer para criar novo usuário"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    tenant_slug = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'tenant_slug'
        ]
    
    def validate(self, data):
        """Valida se as senhas coincidem"""
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password': 'As senhas não coincidem.'
            })
        return data
    
    def create(self, validated_data):
        """Cria novo usuário"""
        tenant_slug = validated_data.pop('tenant_slug')
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        # Buscar tenant
        try:
            tenant = Tenant.objects.get(slug=tenant_slug, is_active=True)
        except Tenant.DoesNotExist:
            raise serializers.ValidationError({
                'tenant_slug': 'Tenant não encontrado.'
            })
        
        # Verificar se email já existe neste tenant
        if User.objects.filter(email=validated_data['email'], tenant=tenant).exists():
            raise serializers.ValidationError({
                'email': 'Este email já está registrado neste tenant.'
            })
        
        # Criar usuário
        user = User.objects.create_user(
            tenant=tenant,
            **validated_data,
            password=password
        )
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Serializer customizado para obter tokens JWT"""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Adicionar informações customizadas ao token
        token['user_id'] = str(user.id)
        token['email'] = user.email
        token['tenant_id'] = str(user.tenant.id)
        token['tenant_slug'] = user.tenant.slug
        
        return token
    
    def validate(self, attrs):
        """Valida o login"""
        # Primeiro, validar com o serializer pai
        data = super().validate(attrs)
        
        # Adicionar informações do usuário na resposta
        user = self.user
        data['user'] = UserSerializer(user).data
        
        return data
