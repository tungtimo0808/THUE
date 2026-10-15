import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="SAL.CONTRACT",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "SAL",
            "name": "Hợp đồng bán hàng",
            "status": "ACTIVE",
        },
    )
    for code, name, risk in (
        ("SIGN", "Ghi nhận ký kết hợp đồng", "HIGH"),
        ("ANNEX", "Quản lý phụ lục hợp đồng", "NORMAL"),
        ("LIQUIDATE", "Thanh lý hợp đồng", "HIGH"),
        ("CANCEL", "Hủy hợp đồng", "HIGH"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": risk},
        )
        Permission.objects.get_or_create(
            code=f"SAL.CONTRACT.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0027_salescontract_assigned_employee_and_more"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
