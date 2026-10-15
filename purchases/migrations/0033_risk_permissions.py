import uuid

from django.db import migrations


def seed_risk_permissions(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="PUR.SUPPLIER_RISK",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Kiểm tra rủi ro nhà cung cấp",
            "status": "ACTIVE",
        },
    )

    action_items = [
        ("VIEW", "Xem rủi ro nhà cung cấp", "NORMAL"),
        ("CHECK", "Kiểm tra rủi ro", "NORMAL"),
        ("OVERRIDE", "Cho phép tiếp tục với rủi ro", "HIGH"),
        ("CONFIG", "Cấu hình quy tắc rủi ro", "HIGH"),
        ("INCIDENT", "Quản lý sự cố nhà cung cấp", "NORMAL"),
    ]

    for code, name, risk in action_items:
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={
                "id": uuid.uuid4(),
                "name": name,
                "risk_level": risk,
            },
        )
        Permission.objects.get_or_create(
            code=f"PUR.SUPPLIER_RISK.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": f"{name} - Rủi ro nhà cung cấp",
                "status": "ACTIVE",
            },
        )


def rollback_risk_permissions(apps, schema_editor):
    Permission = apps.get_model("iam", "Permission")
    Resource = apps.get_model("iam", "PermissionResource")

    Permission.objects.filter(code__startswith="PUR.SUPPLIER_RISK.").delete()
    Resource.objects.filter(code="PUR.SUPPLIER_RISK").delete()


class Migration(migrations.Migration):

    dependencies = [
        ('purchases', '0032_supplierincident_supplierriskassessment_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_risk_permissions, rollback_risk_permissions),
    ]
