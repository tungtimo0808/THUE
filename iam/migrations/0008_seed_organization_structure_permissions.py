import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction"); Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission"); Role = apps.get_model("iam", "Role"); RolePermission = apps.get_model("iam", "RolePermission")
    definitions = (("VIEW", "Xem"), ("CREATE", "Tạo"), ("EDIT", "Cập nhật"), ("MOVE", "Di chuyển"), ("DEACTIVATE", "Ngừng sử dụng"), ("REACTIVATE", "Kích hoạt lại"), ("VIEW_HISTORY", "Xem lịch sử"))
    actions = {}
    for code, name in definitions:
        actions[code], _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"MOVE", "DEACTIVATE"} else "NORMAL"})
    resource, _ = Resource.objects.get_or_create(code="SYS.ORG_STRUCTURE", defaults={"id": uuid.uuid4(), "module_code": "SYS", "name": "Cơ cấu tổ chức", "status": "ACTIVE"})
    permissions = []
    for code, _ in definitions:
        permission, _ = Permission.objects.get_or_create(code=f"SYS.ORG_STRUCTURE.{code}", defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": actions[code].id, "description": f"{actions[code].name} - Cơ cấu tổ chức", "status": "ACTIVE"})
        permissions.append(permission)
    for role in Role.objects.filter(is_system_admin=True):
        for permission in permissions:
            RolePermission.objects.get_or_create(role_id=role.id, permission_id=permission.id, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0007_seed_company_information_permissions"), ("organization", "0004_organization_structure")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
