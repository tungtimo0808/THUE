import uuid

from django.db import migrations


def seed(apps, schema_editor):
    # UC-FA-09 BR01 & BR03: the fixed-asset reports have their own right, separate from the asset register.
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="FA.REPORT", defaults={"id": uuid.uuid4(), "module_code": "FA", "name": "Sổ và báo cáo tài sản", "status": "ACTIVE"},
    )
    action, _ = Action.objects.get_or_create(code="VIEW", defaults={"id": uuid.uuid4(), "name": "Xem", "risk_level": "NORMAL"})
    Permission.objects.get_or_create(code="FA.REPORT.VIEW", defaults={
        "id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
        "description": "Xem sổ và báo cáo tài sản cố định", "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0032_fixed_asset_count_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
