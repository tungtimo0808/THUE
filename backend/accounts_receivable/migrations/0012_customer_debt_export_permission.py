import uuid
from django.db import migrations


def forward(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource = Resource.objects.get(code="AR.RECEIVABLE")
    for code, name in (("EXPORT", "Xuất"), ("PRINT", "In")):
        action, _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"}
        )
        Permission.objects.get_or_create(
            code=f"AR.RECEIVABLE.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                      "description": f"{name} công nợ khách hàng", "status": "ACTIVE"},
        )


def backward(apps, schema_editor):
    apps.get_model("iam", "Permission").objects.filter(
        code__in=("AR.RECEIVABLE.EXPORT", "AR.RECEIVABLE.PRINT")
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts_receivable", "0011_netting_reversed_at")]
    operations = [migrations.RunPython(forward, backward)]
