import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    PaymentTerm = apps.get_model("master_data", "PaymentTerm")
    PaymentTerm.objects.filter(discount_days__isnull=False, discount_rate__isnull=False).update(has_discount=True)
    resource, _ = Resource.objects.get_or_create(code="MD.PAYMENT_TERM", defaults={"id": uuid.uuid4(), "module_code": "MD", "name": "Payment term", "status": "ACTIVE"})
    for code in ("VIEW", "CREATE", "EDIT", "DEACTIVATE", "IMPORT", "EXPORT"):
        action, _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": code.title(), "risk_level": "NORMAL"})
        permission, _ = Permission.objects.get_or_create(code=f"MD.PAYMENT_TERM.{code}", defaults={"id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk, "description": f"{code.title()} - Payment term", "status": "ACTIVE"})
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("master_data", "0016_paymentterm_created_at_paymentterm_default_purchase_and_more"), ("iam", "0029_account_management_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
