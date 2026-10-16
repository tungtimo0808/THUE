from django.apps import AppConfig


class CommonServicesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "common_services"
    verbose_name = "Chức năng dùng chung"

    def ready(self):
        from . import schema  # noqa: F401
