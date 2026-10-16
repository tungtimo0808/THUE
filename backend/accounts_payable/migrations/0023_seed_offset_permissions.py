import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="AP.OFFSET", defaults={"id": uuid.uuid4(), "module_code": "AP",
                                    "name": "Bù trừ công nợ phải trả", "status": "ACTIVE"},
    )
    for code, name in (("VIEW", "Xem"), ("CREATE", "Ghi sổ"), ("CANCEL", "Hủy")):
        action, _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name,
                                 "risk_level": "HIGH" if code in ("CREATE", "CANCEL") else "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"AP.OFFSET.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                      "description": f"{name} - Bù trừ công nợ phải trả", "status": "ACTIVE"},
        )


class Migration(migrations.Migration):
    dependencies = [("accounts_payable", "0022_debtoffsetvoucher_debtoffsetreceivableline_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
