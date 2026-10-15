import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    action, _ = Action.objects.get_or_create(code="MANAGE_ORG_ASSIGNMENT", defaults={
        "id": uuid.uuid4(), "name": "Quản lý phân công đơn vị", "risk_level": "HIGH",
    })
    resource, _ = Resource.objects.get_or_create(code="SYS.ORG_ASSIGNMENT", defaults={
        "id": uuid.uuid4(), "module_code": "SYS", "name": "Phân công User vào đơn vị", "status": "ACTIVE",
    })
    permission, _ = Permission.objects.get_or_create(code="SYS.ORG_ASSIGNMENT.MANAGE", defaults={
        "id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
        "description": "Tạo, sửa, chuyển và kết thúc phân công User vào đơn vị", "status": "ACTIVE",
    })
    for role in Role.objects.filter(is_system_admin=True):
        RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0017_organizationassignment")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
