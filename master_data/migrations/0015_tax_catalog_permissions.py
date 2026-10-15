import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    for resource_code, label in (("MD.TAX_TYPE", "Tax type"), ("MD.TAX_RATE", "Tax rate")):
        resource, _ = Resource.objects.get_or_create(code=resource_code, defaults={"id": uuid.uuid4(), "module_code": "MD", "name": label, "status": "ACTIVE"})
        for code in ("VIEW", "CREATE", "EDIT", "DEACTIVATE", "IMPORT", "EXPORT"):
            action, _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": code.title(), "risk_level": "NORMAL"})
            permission, _ = Permission.objects.get_or_create(code=f"{resource_code}.{code}", defaults={"id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk, "description": f"{code.title()} - {label}", "status": "ACTIVE"})
            for role in Role.objects.filter(is_system_admin=True):
                RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("master_data", "0014_taxrate_application_form_taxrate_business_scope_and_more"), ("iam", "0029_account_management_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
