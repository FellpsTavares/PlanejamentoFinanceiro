import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from accounts.models import Tenant


def _to_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class Command(BaseCommand):
    help = 'Garante criação/atualização de superusuário da plataforma com base em variáveis de ambiente.'

    def handle(self, *args, **options):
        enabled = _to_bool(os.getenv('SUPERUSER_ENABLED', 'false'))
        if not enabled:
            self.stdout.write(self.style.WARNING('SUPERUSER_ENABLED=false. Criação automática de superusuário ignorada.'))
            return

        force_password_update = _to_bool(os.getenv('SUPERUSER_FORCE_PASSWORD_UPDATE', 'false'))

        username = (os.getenv('SUPERUSER_USERNAME') or 'superusuario').strip()
        email = (os.getenv('SUPERUSER_EMAIL') or '').strip().lower()
        password = os.getenv('SUPERUSER_PASSWORD') or ''

        tenant_slug = (os.getenv('SUPERUSER_TENANT_SLUG') or 'platform').strip()
        tenant_name = (os.getenv('SUPERUSER_TENANT_NAME') or 'Platform Admin').strip()
        tenant_email = (os.getenv('SUPERUSER_TENANT_EMAIL') or email or 'platform@local.invalid').strip().lower()

        if not email:
            raise CommandError('SUPERUSER_EMAIL não definido.')
        if not password:
            raise CommandError('SUPERUSER_PASSWORD não definido.')
        if len(password) < 8:
            raise CommandError('SUPERUSER_PASSWORD deve ter no mínimo 8 caracteres.')

        tenant, tenant_created = Tenant.objects.get_or_create(
            slug=tenant_slug,
            defaults={
                'name': tenant_name,
                'description': 'Tenant técnico para administração da plataforma',
                'email': tenant_email,
                'phone': '',
                'is_active': True,
            },
        )

        User = get_user_model()
        existing_with_username = User.objects.filter(username=username).first()
        if existing_with_username and existing_with_username.tenant_id != tenant.id:
            raise CommandError(
                f'Já existe usuário com username "{username}" em outro tenant ({existing_with_username.tenant.slug}). '
                'Defina SUPERUSER_USERNAME único para este tenant.'
            )

        user = existing_with_username or User.objects.filter(email=email, tenant=tenant).first()

        if user is None:
            user = User(
                tenant=tenant,
                username=username,
                email=email,
            )
            is_new_user = True
        else:
            is_new_user = False

        user.first_name = user.first_name or 'Super'
        user.last_name = user.last_name or 'Usuário'
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.is_platform_admin = True
        user.is_verified = True
        user.role = User.ROLE_ADMIN
        if is_new_user or force_password_update:
            user.set_password(password)
        user.save()

        if tenant_created:
            self.stdout.write(self.style.SUCCESS(f'Tenant técnico criado: {tenant.slug}'))

        if is_new_user:
            self.stdout.write(self.style.SUCCESS('Senha do superusuário definida (usuário novo).'))
        elif force_password_update:
            self.stdout.write(self.style.SUCCESS('Senha do superusuário atualizada (SUPERUSER_FORCE_PASSWORD_UPDATE=true).'))
        else:
            self.stdout.write(self.style.WARNING('Senha do superusuário preservada (SUPERUSER_FORCE_PASSWORD_UPDATE=false).'))

        self.stdout.write(self.style.SUCCESS(f'Superusuário garantido com sucesso: {user.username} ({user.email})'))