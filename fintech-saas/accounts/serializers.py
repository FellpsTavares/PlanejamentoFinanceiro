from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Tenant, TenantParameter, TenantAuditLog

User = get_user_model()


class TenantSerializer(serializers.ModelSerializer):
    """Serializer para Tenant"""
    
    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'slug', 'description', 'email', 'phone',
            'is_active', 'has_module_investments', 'has_module_transport', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    """Serializer para User"""
    tenant = TenantSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'bio', 'is_verified', 'is_platform_admin', 'role', 'preferred_currency',
            'tenant', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class TenantAdminCreateSerializer(serializers.ModelSerializer):
    admin_username = serializers.CharField(write_only=True)
    admin_email = serializers.EmailField(write_only=True)
    admin_password = serializers.CharField(write_only=True, min_length=8)
    admin_password_confirm = serializers.CharField(write_only=True, min_length=8)
    admin_first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    admin_last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    admin_role = serializers.ChoiceField(
        write_only=True,
        choices=[User.ROLE_ADMIN, User.ROLE_MANAGER, User.ROLE_OPERATOR],
        default=User.ROLE_ADMIN
    )

    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'slug', 'description', 'cnpj', 'email', 'phone',
            'is_active', 'has_module_investments', 'has_module_transport', 'created_at',
            'admin_username', 'admin_email', 'admin_password', 'admin_password_confirm',
            'admin_first_name', 'admin_last_name', 'admin_role'
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        if attrs.get('admin_password') != attrs.get('admin_password_confirm'):
            raise serializers.ValidationError({'admin_password': 'As senhas não coincidem.'})

        admin_username = attrs.get('admin_username')
        admin_email = attrs.get('admin_email')

        if User.objects.filter(username=admin_username).exists():
            raise serializers.ValidationError({'admin_username': 'Username já em uso.'})

        # no mesmo tenant ainda não existe, mas mantemos check semântico
        if User.objects.filter(email=admin_email, tenant__slug=attrs.get('slug')).exists():
            raise serializers.ValidationError({'admin_email': 'Email já em uso neste tenant.'})

        return attrs

    def create(self, validated_data):
        admin_username = validated_data.pop('admin_username')
        admin_email = validated_data.pop('admin_email')
        admin_password = validated_data.pop('admin_password')
        validated_data.pop('admin_password_confirm', None)
        admin_first_name = validated_data.pop('admin_first_name', '')
        admin_last_name = validated_data.pop('admin_last_name', '')
        admin_role = validated_data.pop('admin_role', User.ROLE_ADMIN)

        with transaction.atomic():
            tenant = Tenant.objects.create(**validated_data)

            User.objects.create_user(
                tenant=tenant,
                username=admin_username,
                email=admin_email,
                first_name=admin_first_name,
                last_name=admin_last_name,
                role=admin_role,
                password=admin_password,
            )

        return tenant


class TenantAdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'password', 'password_confirm', 'role', 'is_active'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({'password': 'As senhas não coincidem.'})
        return attrs


class TenantAdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'role', 'is_active', 'phone']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer para criar novo usuário"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    tenant_slug = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(
        choices=[User.ROLE_ADMIN, User.ROLE_MANAGER, User.ROLE_OPERATOR],
        default=User.ROLE_OPERATOR,
        required=False
    )
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'tenant_slug', 'role'
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
        token['is_platform_admin'] = bool(getattr(user, 'is_platform_admin', False))
        token['role'] = getattr(user, 'role', User.ROLE_OPERATOR)
        # Expor flags de módulos no token para o frontend
        token['has_module_investments'] = bool(getattr(user.tenant, 'has_module_investments', False))
        token['has_module_transport'] = bool(getattr(user.tenant, 'has_module_transport', False))
        
        return token
    
    def validate(self, attrs):
        """Valida o login"""
        # Primeiro, validar com o serializer pai
        data = super().validate(attrs)
        
        # Adicionar informações do usuário na resposta
        user = self.user
        data['user'] = UserSerializer(user).data
        
        return data


class TenantParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantParameter
        fields = ['id', 'module', 'key', 'value', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TenantAuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = TenantAuditLog
        fields = ['id', 'action', 'entity_type', 'entity_id', 'details', 'user_email', 'created_at']
