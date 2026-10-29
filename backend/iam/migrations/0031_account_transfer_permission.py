import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    action, _ = Action.objects.get_or_create(
        code="TRANSFER", defaults={"id": uuid.uuid4(), "name": "Chuyển tài khoản hạch toán", "risk_level": "HIGH"},
    )
    resource = Resource.objects.get(code="MD.ACCOUNT")
    Permission.objects.get_or_create(
        code="MD.ACCOUNT.TRANSFER",
        defaults={"id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
                  "description": "Chuyển tài khoản hạch toán", "status": "ACTIVE"},
    )


class Migration(migrations.Migration):
    dependencies = [("iam", "0030_seed_referenced_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
