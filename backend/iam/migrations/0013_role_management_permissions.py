import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    resource = Resource.objects.get(code="SYS.ROLE")
    for code, name in (
        ("CLONE", "Sao chép Role"),
        ("DEACTIVATE", "Ngừng sử dụng Role"),
        ("REACTIVATE", "Kích hoạt lại Role"),
        ("VIEW_USERS", "Xem User sử dụng Role"),
        ("VIEW_HISTORY", "Xem lịch sử Role"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name,
                      "risk_level": "NORMAL" if code.startswith("VIEW") else "HIGH"},
        )
        permission, _ = Permission.objects.get_or_create(
            code=f"SYS.ROLE.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.pk,
                      "action_id": action.pk, "description": name, "status": "ACTIVE"},
        )
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(
                role=role, permission=permission, defaults={"effect": "ALLOW"},
            )


class Migration(migrations.Migration):
    dependencies = [("iam", "0012_role_created_by_role_source_role_role_updated_by")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
