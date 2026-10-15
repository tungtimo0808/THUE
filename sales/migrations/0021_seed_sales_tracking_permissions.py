import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="SAL.TRACKING",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "SAL",
            "name": "Theo dõi thực hiện đơn bán",
            "status": "ACTIVE",
        },
    )
    for code, name in (
        ("VIEW", "Xem tiến độ thực hiện đơn bán"),
        ("EXPORT", "Xuất dữ liệu theo dõi thực hiện đơn bán"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"SAL.TRACKING.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )

    # Seed SAL.ORDER.TRACK
    order_resource = Resource.objects.filter(code="SAL.ORDER").first()
    if order_resource:
        track_action, _ = Action.objects.get_or_create(
            code="TRACK",
            defaults={"id": uuid.uuid4(), "name": "Theo dõi tiến độ đơn bán hàng", "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code="SAL.ORDER.TRACK",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": order_resource.id,
                "action_id": track_action.id,
                "description": "Theo dõi tiến độ đơn bán hàng",
                "status": "ACTIVE",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0020_seed_sales_approval_permissions"),
    ]
    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
