import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="PUR.TRACKING",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Theo dõi thực hiện đơn mua",
            "status": "ACTIVE",
        },
    )
    for code, name in (
        ("VIEW", "Xem tiến độ thực hiện đơn mua"),
        ("EXPORT", "Xuất dữ liệu theo dõi thực hiện đơn mua"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"PUR.TRACKING.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )

    # Also seed PUR.ORDER.TRACK
    order_resource = Resource.objects.filter(code="PUR.ORDER").first()
    if order_resource:
        track_action, _ = Action.objects.get_or_create(
            code="TRACK",
            defaults={"id": uuid.uuid4(), "name": "Theo dõi tiến độ đơn mua", "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code="PUR.ORDER.TRACK",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": order_resource.id,
                "action_id": track_action.id,
                "description": "Theo dõi tiến độ đơn mua hàng",
                "status": "ACTIVE",
            },
        )


class Migration(migrations.Migration):
    dependencies = [("purchases", "0026_seed_approval_action_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
