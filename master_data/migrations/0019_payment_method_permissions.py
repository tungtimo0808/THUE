import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    resource, _ = Resource.objects.get_or_create(code="MD.PAYMENT_METHOD", defaults={"id": uuid.uuid4(), "module_code": "MD", "name": "Payment method", "status": "ACTIVE"})
    for code in ("VIEW", "CREATE", "EDIT", "DEACTIVATE", "IMPORT", "EXPORT"):
        action, _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": code.title(), "risk_level": "NORMAL"})
        permission, _ = Permission.objects.get_or_create(code=f"MD.PAYMENT_METHOD.{code}", defaults={"id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk, "description": f"{code.title()} - Payment method", "status": "ACTIVE"})
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("master_data", "0018_paymentmethod"), ("iam", "0029_account_management_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
