import uuid

from django.db import migrations


def seed(apps, schema_editor):
    """UC-INV-05 BR02: confirming receipt of goods in transit is a right of its own."""
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    action, _ = Action.objects.get_or_create(code="RECEIVE", defaults={"id": uuid.uuid4(), "name": "Xác nhận nhận hàng", "risk_level": "HIGH"})
    resource = Resource.objects.filter(code="INV.TRANSACTION").first()
    if resource:
        Permission.objects.get_or_create(code="INV.TRANSACTION.RECEIVE", defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": "Xác nhận nhận hàng chuyển kho - Giao dịch kho", "status": "ACTIVE",
        })


class Migration(migrations.Migration):
    dependencies = [("inventory", "0012_inventorytransactionline_destination_warehouse"), ("iam", "0005_seed_uc_md")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
