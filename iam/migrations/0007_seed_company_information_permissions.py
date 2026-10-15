import uuid
from django.db import migrations


def seed_permissions(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")

    actions = {}
    for code, name, risk in (
        ("VIEW", "Xem", "NORMAL"),
        ("EDIT", "Cập nhật", "NORMAL"),
        ("EDIT_SUSPENDED", "Cập nhật doanh nghiệp tạm ngừng", "HIGH"),
    ):
        actions[code], _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": risk}
        )
    resource, _ = Resource.objects.get_or_create(
        code="SYS.COMPANY_PROFILE",
        defaults={"id": uuid.uuid4(), "module_code": "SYS", "name": "Thông tin doanh nghiệp", "status": "ACTIVE"},
    )
    permissions = {}
    for code in actions:
        permissions[code], _ = Permission.objects.get_or_create(
            code=f"SYS.COMPANY_PROFILE.{code}",
            defaults={
                "id": uuid.uuid4(), "resource_id": resource.id, "action_id": actions[code].id,
                "description": f"{actions[code].name} - Thông tin doanh nghiệp", "status": "ACTIVE",
            },
        )
    for role in Role.objects.filter(is_system_admin=True):
        for code in ("VIEW", "EDIT"):
            RolePermission.objects.get_or_create(role_id=role.id, permission_id=permissions[code].id, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0006_useraccount_can_create_company")]
    operations = [migrations.RunPython(seed_permissions, migrations.RunPython.noop)]
