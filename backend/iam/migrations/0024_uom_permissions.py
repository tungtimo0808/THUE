import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    resource, _ = Resource.objects.get_or_create(code="MD.UOM", defaults={"id": uuid.uuid4(), "module_code": "MD", "name": "Đơn vị tính", "status": "ACTIVE"})
    for code, name in (("VIEW", "Xem"), ("CREATE", "Tạo"), ("EDIT", "Sửa"), ("DEACTIVATE", "Ngừng sử dụng"), ("DELETE", "Xóa"), ("IMPORT", "Nhập"), ("EXPORT", "Xuất")):
        action, _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"DEACTIVATE", "DELETE"} else "NORMAL"})
        permission, _ = Permission.objects.get_or_create(code=f"MD.UOM.{code}", defaults={"id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk, "description": f"{name} - Đơn vị tính", "status": "ACTIVE"})
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0023_item_category_permissions"), ("master_data", "0009_unitofmeasure_created_at_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
