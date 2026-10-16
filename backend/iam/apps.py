from django.apps import AppConfig


class IamConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "iam"
    verbose_name = "Định danh và phân quyền"

    def ready(self):
        from . import signals  # noqa: F401
