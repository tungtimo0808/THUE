import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="SAL.LINK",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "SAL",
            "name": "Liên kết chứng từ bán hàng",
            "status": "ACTIVE",
        },
    )
    for code, name in (
        ("VIEW", "Xem liên kết chứng từ bán hàng"),
        ("CREATE", "Lập liên kết chứng từ bán hàng"),
        ("UNLINK", "Gỡ liên kết chứng từ bán hàng"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"SAL.LINK.{code}",
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
        ("sales", "0025_salesdocumentlink_salesdocumentlinkcounter_and_more"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
