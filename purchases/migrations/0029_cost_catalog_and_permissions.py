import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")

    resource, _ = Resource.objects.get_or_create(
        code="PUR.COST",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Chi phí mua hàng",
            "status": "ACTIVE",
        },
    )

    for code, name in (
        ("VIEW", "Xem"),
        ("CREATE", "Tạo"),
        ("EDIT", "Sửa"),
        ("SUBMIT", "Gửi duyệt"),
        ("APPROVE", "Phê duyệt"),
        ("POST", "Ghi sổ"),
        ("CANCEL", "Hủy"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={
                "id": uuid.uuid4(),
                "name": name,
                "risk_level": "HIGH" if code in {"POST", "APPROVE"} else "NORMAL",
            },
        )
        Permission.objects.get_or_create(
            code=f"PUR.COST.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": f"{name} - Chi phí mua hàng",
                "status": "ACTIVE",
            },
        )

    DocumentType.objects.get_or_create(
        code="PUR.COST",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Chứng từ chi phí mua hàng",
            "document_class": "PURCHASE",
            "supports_workflow": True,
            "requires_posting": True,
            "creates_inventory": False,
            "status": "ACTIVE",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("purchases", "0028_alter_approvaldecision_document_type_purchasecost_and_more"),
        ("iam", "0029_account_management_permissions"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
