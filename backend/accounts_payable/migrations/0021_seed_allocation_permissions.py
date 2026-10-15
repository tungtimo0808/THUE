import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="AP.ALLOCATION",
        defaults={"id": uuid.uuid4(), "module_code": "AP", "name": "Phân bổ thanh toán", "status": "ACTIVE"},
    )
    for code, name in (("VIEW", "Xem"), ("CREATE", "Tạo"), ("REVERSE", "Đảo phân bổ")):
        action, _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code == "REVERSE" else "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"AP.ALLOCATION.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                      "description": f"{name} - Phân bổ thanh toán", "status": "ACTIVE"},
        )


class Migration(migrations.Migration):
    dependencies = [("accounts_payable", "0020_paymentallocationvoucher_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
