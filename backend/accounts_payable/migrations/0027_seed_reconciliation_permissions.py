import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="AP.RECONCILIATION",
        defaults={"id": uuid.uuid4(), "module_code": "AP", "name": "Đối chiếu công nợ nhà cung cấp", "status": "ACTIVE"},
    )
    for code, name in (("VIEW", "Xem"), ("CREATE", "Lập biên bản"),
                       ("CONFIRM", "Ghi nhận xác nhận"), ("CANCEL", "Hủy")):
        action, _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name,
                                 "risk_level": "HIGH" if code == "CANCEL" else "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"AP.RECONCILIATION.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                      "description": f"{name} - Đối chiếu công nợ nhà cung cấp", "status": "ACTIVE"},
        )


class Migration(migrations.Migration):
    dependencies = [("accounts_payable", "0026_alter_debtoffsetpayableline_payable_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
