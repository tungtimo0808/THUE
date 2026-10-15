import uuid
from django.db import migrations


def seed_receivable_permissions(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="AR.RECEIVABLE",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "AR",
            "name": "Công nợ khách hàng",
            "status": "ACTIVE",
        },
    )

    action_items = [
        ("VIEW", "Xem", "NORMAL"),
        ("CREATE", "Ghi nhận công nợ", "NORMAL"),
        ("EDIT", "Cập nhật lịch thanh toán", "NORMAL"),
        ("CANCEL", "Hủy / Vô hiệu", "HIGH"),
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
            code=f"AR.RECEIVABLE.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": f"{name} - Công nợ khách hàng",
                "status": "ACTIVE",
            },
        )


def rollback(apps, schema_editor):
    Permission = apps.get_model("iam", "Permission")
    Permission.objects.filter(
        code__in=[
            "AR.RECEIVABLE.CREATE",
            "AR.RECEIVABLE.EDIT",
            "AR.RECEIVABLE.CANCEL",
        ]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('accounts_receivable', '0008_receivableschedule_receivableschedulehistory_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_receivable_permissions, rollback),
    ]
