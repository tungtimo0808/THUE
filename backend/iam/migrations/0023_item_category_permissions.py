import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    resource, _ = Resource.objects.get_or_create(code="MD.ITEM_GROUP", defaults={"id": uuid.uuid4(), "module_code": "MD", "name": "Nhóm hàng hóa, dịch vụ", "status": "ACTIVE"})
    for code, name in (("VIEW", "Xem"), ("CREATE", "Tạo"), ("EDIT", "Sửa"), ("MOVE", "Di chuyển"), ("DEACTIVATE", "Ngừng sử dụng"), ("DELETE", "Xóa"), ("IMPORT", "Nhập"), ("EXPORT", "Xuất"), ("BULK", "Chuyển nhóm hàng loạt")):
        action, _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"MOVE", "DEACTIVATE", "DELETE", "BULK"} else "NORMAL"})
        permission, _ = Permission.objects.get_or_create(code=f"MD.ITEM_GROUP.{code}", defaults={"id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk, "description": f"{name} - Nhóm hàng hóa, dịch vụ", "status": "ACTIVE"})
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0022_item_deactivate_permission"), ("master_data", "0008_itemcategory_applicable_types_itemcategory_branch_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
