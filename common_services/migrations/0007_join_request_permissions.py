import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    resource = Resource.objects.get(code="COM.JOIN_REQUEST")
    for code, name in (
        ("REJECT", "Từ chối"),
        ("ASSIGN_ROLE", "Gán Role"),
        ("ASSIGN_UNIT", "Phân công đơn vị"),
        ("ASSIGN_SCOPE", "Gán Data Scope"),
        ("VIEW_HISTORY", "Xem lịch sử"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code != "VIEW_HISTORY" else "NORMAL"},
        )
        permission, _ = Permission.objects.get_or_create(
            code=f"COM.JOIN_REQUEST.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
                      "description": f"{name} yêu cầu tham gia", "status": "ACTIVE"},
        )
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(
                role=role, permission=permission, defaults={"effect": "ALLOW"},
            )


class Migration(migrations.Migration):
    dependencies = [("common_services", "0006_companyjoinrequest_decision_snapshot_and_more"), ("iam", "0009_companymembership_organization_unit")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
