import uuid
from django.db import migrations


def seed_order_permissions(apps, schema_editor):
    PermissionAction = apps.get_model("iam", "PermissionAction")
    PermissionResource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    del_action, _ = PermissionAction.objects.get_or_create(
        code="DELETE",
        defaults={"id": uuid.uuid4(), "name": "Xóa", "risk_level": "HIGH"},
    )
    send_action, _ = PermissionAction.objects.get_or_create(
        code="SEND",
        defaults={"id": uuid.uuid4(), "name": "Gửi nhà cung cấp", "risk_level": "MEDIUM"},
    )
    resource = PermissionResource.objects.filter(code="PUR.ORDER").first()
    if resource:
        Permission.objects.get_or_create(
            code="PUR.ORDER.DELETE",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": del_action.id,
                "description": "Xóa - Đơn mua hàng",
                "status": "ACTIVE",
            },
        )
        Permission.objects.get_or_create(
            code="PUR.ORDER.SEND",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": send_action.id,
                "description": "Gửi nhà cung cấp - Đơn mua hàng",
                "status": "ACTIVE",
            },
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("purchases", "0006_remove_purchaseorderline_ck_pur_order_progress_nonnegative_and_more"),
        ("iam", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_order_permissions, noop),
    ]
