import uuid
from django.db import migrations


def seed_delete_permission(apps, schema_editor):
    PermissionAction = apps.get_model("iam", "PermissionAction")
    PermissionResource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    action, _ = PermissionAction.objects.get_or_create(
        code="DELETE",
        defaults={"id": uuid.uuid4(), "name": "Xóa", "risk_level": "HIGH"},
    )
    resource = PermissionResource.objects.filter(code="PUR.REQUEST").first()
    if resource:
        Permission.objects.get_or_create(
            code="PUR.REQUEST.DELETE",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": "Xóa - Yêu cầu mua hàng",
                "status": "ACTIVE",
            },
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("purchases", "0004_remove_purchaserequestline_ck_pur_request_price_nonnegative_and_more"),
        ("iam", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_delete_permission, noop),
    ]
