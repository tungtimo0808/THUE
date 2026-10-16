import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="SAL.DISCOUNT_INVOICE",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "SAL",
            "name": "Hóa đơn chiết khấu",
            "status": "ACTIVE",
        },
    )
    for code, name, risk in (
        ("VIEW", "Xem hóa đơn chiết khấu", "LOW"),
        ("CREATE", "Lập hóa đơn chiết khấu", "NORMAL"),
        ("EDIT", "Sửa hóa đơn chiết khấu", "NORMAL"),
        ("DELETE", "Xóa hóa đơn chiết khấu", "HIGH"),
        ("APPROVE", "Phê duyệt hóa đơn chiết khấu", "HIGH"),
        ("ISSUE", "Phát hành hóa đơn chiết khấu", "HIGH"),
        ("CANCEL", "Hủy hóa đơn chiết khấu", "HIGH"),
        ("RETRY", "Thử lại phát hành hóa đơn chiết khấu", "HIGH"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": risk},
        )
        Permission.objects.get_or_create(
            code=f"SAL.DISCOUNT_INVOICE.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0029_alter_approvaldecision_document_type_and_more"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
