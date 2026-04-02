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
            'is_active', 'has_module_investments', 'has_module_transport',
            'days_before_review_alert', 'km_before_review_alert',
            'account_status', 'billing_due_date', 'account_notes',
            'created_at'
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
            'is_superuser', 'is_active', 'must_change_password',
            'tenant', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AccountSelfSignupSerializer(serializers.Serializer):
    tenant_name = serializers.CharField(max_length=255)
    tenant_slug = serializers.SlugField(max_length=255)
    tenant_email = serializers.EmailField()
    tenant_phone = serializers.CharField(required=False, allow_blank=True)

    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({'password_confirm': 'As senhas não coincidem.'})

        tenant_slug = attrs.get('tenant_slug')
        if Tenant.objects.filter(slug=tenant_slug).exists():
            raise serializers.ValidationError({'tenant_slug': 'Este slug já está em uso.'})

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('password_confirm', None)

        tenant = Tenant.objects.create(
            name=validated_data['tenant_name'],
            slug=validated_data['tenant_slug'],
            email=validated_data['tenant_email'],
            phone=validated_data.get('tenant_phone', ''),
            is_active=True,
            account_status=Tenant.ACCOUNT_STATUS_ACTIVE,
            has_module_transport=True,
            has_module_investments=False,
        )

        base_username = validated_data['email'].split('@')[0]
        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f'{base_username}{suffix}'

        user = User.objects.create_user(
            tenant=tenant,
            username=username,
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=User.ROLE_ADMIN,
            password=password,
        )

        return user





class TenantAdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'password', 'password_confirm', 'role', 'is_active', 'must_change_password'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({'password': 'As senhas não coincidem.'})
        return attrs


class TenantAdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'role', 'is_active', 'phone', 'must_change_password']


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
        token['is_superuser'] = bool(getattr(user, 'is_superuser', False))
        token['role'] = getattr(user, 'role', User.ROLE_OPERATOR)
        # Expor flags de módulos no token para o frontend
        token['has_module_investments'] = bool(getattr(user.tenant, 'has_module_investments', False))
        token['has_module_transport'] = bool(getattr(user.tenant, 'has_module_transport', False))
        token['tenant_account_status'] = getattr(user.tenant, 'account_status', Tenant.ACCOUNT_STATUS_ACTIVE)
        token['tenant_billing_due_date'] = str(getattr(user.tenant, 'billing_due_date', '') or '')
        token['must_change_password'] = bool(getattr(user, 'must_change_password', False))
        
        return token
    
    def validate(self, attrs):
        """Valida o login"""
        # Primeiro, validar com o serializer pai
        data = super().validate(attrs)

        tenant = getattr(self.user, 'tenant', None)
        if tenant and not getattr(self.user, 'is_superuser', False):
            if tenant.is_account_blocked():
                if tenant.account_status == Tenant.ACCOUNT_STATUS_CANCELLED:
                    raise serializers.ValidationError({'detail': 'Conta desativada por desistência/cancelamento.'})
                if tenant.account_status == Tenant.ACCOUNT_STATUS_SUSPENDED:
                    raise serializers.ValidationError({'detail': 'Conta suspensa. Entre em contato com o suporte.'})
                if tenant.billing_due_date:
                    raise serializers.ValidationError({'detail': 'Conta bloqueada por falta de pagamento (vencida).'})
                raise serializers.ValidationError({'detail': 'Conta indisponível para login.'})
        
        # Adicionar informações do usuário na resposta
        user = self.user
        data['user'] = UserSerializer(user).data
        data['must_change_password'] = bool(getattr(user, 'must_change_password', False))
        
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
