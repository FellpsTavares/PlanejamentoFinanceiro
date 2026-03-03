from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Promove (ou remove) um usuário como admin da plataforma para gerenciar tenants.'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username do usuário a ser alterado.')
        parser.add_argument(
            '--remove',
            action='store_true',
            help='Remove permissão de admin da plataforma em vez de promover.'
        )

    def handle(self, *args, **options):
        User = get_user_model()
        username = options['username']
        remove = options['remove']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as exc:
            raise CommandError(f'Usuário "{username}" não encontrado.') from exc

        user.is_platform_admin = not remove
        user.save(update_fields=['is_platform_admin'])

        if remove:
            self.stdout.write(self.style.WARNING(f'Permissão removida para: {user.username}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Usuário promovido a admin da plataforma: {user.username}'))
