import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    action, _ = Action.objects.get_or_create(code="CONFIGURE_WORKFLOW", defaults={
        "id": uuid.uuid4(), "name": "Cấu hình Workflow", "risk_level": "HIGH",
    })
    resource, _ = Resource.objects.get_or_create(code="SYS.WORKFLOW", defaults={
        "id": uuid.uuid4(), "module_code": "SYS", "name": "Workflow phê duyệt", "status": "ACTIVE",
    })
    permission, _ = Permission.objects.get_or_create(code="SYS.WORKFLOW.CONFIGURE", defaults={
        "id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
        "description": "Tạo và kích hoạt Workflow phê duyệt", "status": "ACTIVE",
    })
    for role in Role.objects.filter(is_system_admin=True):
        RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("approval_workflows", "0001_initial"), ("iam", "0018_organization_assignment_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
