import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    action, _ = Action.objects.get_or_create(
        code="VIEW", defaults={"id": uuid.uuid4(), "name": "Xem", "risk_level": "NORMAL"})
    resource, _ = Resource.objects.get_or_create(
        code="AP.REPORT", defaults={"id": uuid.uuid4(), "module_code": "AP",
                                    "name": "Báo cáo công nợ phải trả", "status": "ACTIVE"})
    Permission.objects.get_or_create(
        code="AP.REPORT.VIEW", defaults={"id": uuid.uuid4(), "resource_id": resource.id,
                                        "action_id": action.id, "description": "Xem báo cáo công nợ phải trả",
                                        "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("accounts_payable", "0027_seed_reconciliation_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
