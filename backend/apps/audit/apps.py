from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit"

    def ready(self):
        # Conecta signals para registro automático en acciones sensibles
        from . import signals  # noqa: F401