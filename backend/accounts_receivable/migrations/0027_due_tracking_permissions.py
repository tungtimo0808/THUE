import uuid
from django.db import migrations


def forward(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="AR.DUE_TRACKING",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "AR",
            "name": "Theo dõi công nợ đến hạn",
            "status": "ACTIVE",
        },
    )

    for code, name in (
        ("VIEW", "Xem công nợ đến hạn"),
        ("EXPORT", "Xuất danh sách công nợ đến hạn"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={
                "id": uuid.uuid4(),
                "name": name,
                "risk_level": "NORMAL",
            },
        )
        Permission.objects.get_or_create(
            code=f"AR.DUE_TRACKING.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )


def backward(apps, schema_editor):
    apps.get_model("iam", "Permission").objects.filter(
        code__startswith="AR.DUE_TRACKING."
    ).delete()
    apps.get_model("iam", "PermissionResource").objects.filter(
        code="AR.DUE_TRACKING"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts_receivable", "0026_customer_debt_reconciliation_permissions")]

    operations = [
        migrations.RunPython(forward, backward),
    ]
