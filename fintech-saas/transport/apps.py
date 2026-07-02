from django.apps import AppConfig


class TransportConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'transport'
    verbose_name = 'Transport'

    def ready(self):
        # Importar signals para registrá-los
        import transport.signals
