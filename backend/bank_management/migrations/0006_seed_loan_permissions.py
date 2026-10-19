import uuid

from django.db import migrations

ACTIONS = {"VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật"}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(code="BANK.LOAN", defaults={
        "id": uuid.uuid4(), "module_code": "BANK", "name": "Khế ước vay và hợp đồng tín dụng", "status": "ACTIVE"})
    for code, name in ACTIONS.items():
        action, _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"})
        Permission.objects.get_or_create(code=f"BANK.LOAN.{code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": f"{name} - Khế ước vay và hợp đồng tín dụng", "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("bank_management", "0005_loans_and_credit_contracts"), ("iam", "0030_seed_referenced_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
