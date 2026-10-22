import uuid

from django.db import migrations

ACTIONS = {"VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "POST": "Ghi nhận", "REVERSE": "Bỏ ghi sổ", "DELETE": "Xóa"}


def seed(apps, schema_editor):
    """UC-FA-06 BR01: revaluing fixed assets is a right of its own."""
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="FA.REVALUATION", defaults={"id": uuid.uuid4(), "module_code": "FA", "name": "Đánh giá lại tài sản cố định", "status": "ACTIVE"},
    )
    for code, name in ACTIONS.items():
        action, _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"POST", "REVERSE"} else "NORMAL"})
        Permission.objects.get_or_create(code=f"FA.REVALUATION.{code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": f"{name} - Đánh giá lại tài sản cố định", "status": "ACTIVE",
        })


class Migration(migrations.Migration):
    dependencies = [("fixed_assets", "0006_asset_revaluation"), ("iam", "0005_seed_uc_md")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
