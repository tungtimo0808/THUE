import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    resource, _ = Resource.objects.get_or_create(
        code="MD.STATISTICAL_CODE",
        defaults={"id": uuid.uuid4(), "module_code": "MD", "name": "Mã thống kê", "status": "ACTIVE"},
    )
    actions_info = (
        ("VIEW", "Xem", "NORMAL"),
        ("CREATE", "Tạo", "NORMAL"),
        ("EDIT", "Sửa", "NORMAL"),
        ("DEACTIVATE", "Ngừng sử dụng / Kích hoạt lại", "HIGH"),
        ("DELETE", "Xóa", "HIGH"),
        ("IMPORT", "Nhập", "NORMAL"),
        ("EXPORT", "Xuất", "NORMAL"),
    )
    for code, name, risk in actions_info:
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": risk},
        )
        permission, _ = Permission.objects.get_or_create(
            code=f"MD.STATISTICAL_CODE.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.pk,
                "action_id": action.pk,
                "description": f"{name} - Mã thống kê",
                "status": "ACTIVE",
            },
        )
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0027_expense_item_permissions"), ("master_data", "0013_statisticalcode")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
