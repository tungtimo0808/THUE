import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="SAL.COMMERCIAL_INVOICE",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "SAL",
            "name": "Hóa đơn thương mại",
            "status": "ACTIVE",
        },
    )
    for code, name, risk in (
        ("VIEW", "Xem hóa đơn thương mại", "LOW"),
        ("CREATE", "Lập hóa đơn thương mại", "NORMAL"),
        ("EDIT", "Sửa hóa đơn thương mại", "NORMAL"),
        ("DELETE", "Xóa hóa đơn thương mại", "HIGH"),
        ("APPROVE", "Phê duyệt hóa đơn thương mại", "HIGH"),
        ("PUBLISH", "Xuất bản Commercial Invoice", "HIGH"),
        ("ISSUE", "Phát hành hóa đơn thương mại điện tử", "HIGH"),
        ("CANCEL", "Hủy hóa đơn thương mại", "HIGH"),
        ("RETRY", "Thử lại phát hành hóa đơn thương mại", "HIGH"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": risk},
        )
        Permission.objects.get_or_create(
            code=f"SAL.COMMERCIAL_INVOICE.{code}",
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
        ("sales", "0031_alter_approvaldecision_document_type_and_more"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
