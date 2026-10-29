import uuid

from django.db import migrations


def seed_permissions(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="GL.OPENING_BALANCE",
        defaults={"id": uuid.uuid4(), "module_code": "GL", "name": "Số dư ban đầu", "status": "ACTIVE"},
    )
    for action_code, name in (
        ("VIEW", "Xem"), ("CREATE", "Thêm"), ("EDIT", "Sửa"),
        ("DELETE", "Xóa"), ("IMPORT", "Nhập Excel"), ("PRINT", "In"),
    ):
        action, _ = Action.objects.get_or_create(
            code=action_code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"OPENING_BALANCE_{action_code}",
            defaults={
                "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                "description": f"{name} số dư ban đầu", "status": "ACTIVE",
            },
        )


class Migration(migrations.Migration):
    dependencies = [("general_ledger", "0020_reconciliation_split_sources")]
    operations = [migrations.RunPython(seed_permissions, migrations.RunPython.noop)]
