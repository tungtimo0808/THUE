from django.apps import AppConfig


class OrganizationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "organization"

    def ready(self):
        from . import signals  # noqa: F401
    verbose_name = "Cơ cấu tổ chức"
