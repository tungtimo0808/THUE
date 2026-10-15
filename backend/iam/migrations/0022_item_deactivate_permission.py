import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    action, _ = Action.objects.get_or_create(code="DEACTIVATE", defaults={"id": uuid.uuid4(), "name": "Ngừng sử dụng", "risk_level": "HIGH"})
    resource = Resource.objects.get(code="MD.ITEM")
    permission, _ = Permission.objects.get_or_create(code="MD.ITEM.DEACTIVATE", defaults={
        "id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
        "description": "Ngừng sử dụng vật tư, hàng hóa và dịch vụ", "status": "ACTIVE",
    })
    for role in Role.objects.filter(is_system_admin=True):
        RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0021_employee_permissions"), ("master_data", "0007_item_allow_discount_item_allow_purchase_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
