import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="AP.ADJUSTMENT_VOUCHER",
        defaults={"id": uuid.uuid4(), "module_code": "AP",
                  "name": "Điều chỉnh công nợ phải trả", "status": "ACTIVE"},
    )
    for code, name in (("VIEW", "Xem"), ("CREATE", "Ghi sổ"), ("CANCEL", "Hủy")):
        action, _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name,
                                 "risk_level": "HIGH" if code in ("CREATE", "CANCEL") else "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"AP.ADJUSTMENT_VOUCHER.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                      "description": f"{name} - Điều chỉnh công nợ phải trả", "status": "ACTIVE"},
        )


class Migration(migrations.Migration):
    dependencies = [("accounts_payable", "0024_payableadjustmentcounter_payableadjustmentvoucher")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
