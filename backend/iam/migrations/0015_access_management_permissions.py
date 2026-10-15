import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    resource = Resource.objects.get(code="SYS.PERMISSION")
    for code, name in (
        ("ASSIGN_ROLE", "Gán Role cho User"),
        ("REVOKE_ROLE", "Thu hồi Role của User"),
        ("DIRECT_PERMISSION", "Quản lý quyền trực tiếp"),
        ("CHECK_EFFECTIVE", "Xem quyền hiệu lực"),
        ("VIEW_IMPACT", "Xem ảnh hưởng phân quyền"),
        ("VIEW_HISTORY", "Xem lịch sử phân quyền"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name,
                                 "risk_level": "NORMAL" if code.startswith(("VIEW", "CHECK")) else "HIGH"},
        )
        permission, _ = Permission.objects.get_or_create(
            code=f"SYS.PERMISSION.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
                      "description": name, "status": "ACTIVE"},
        )
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0014_userroleassignment_assign_reason_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
