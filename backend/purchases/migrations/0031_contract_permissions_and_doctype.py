import uuid

from django.db import migrations


def seed_contract_permissions_and_doctype(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")

    resource, _ = Resource.objects.get_or_create(
        code="PUR.CONTRACT",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Hợp đồng mua hàng",
            "status": "ACTIVE",
        },
    )

    action_items = [
        ("VIEW", "Xem", "NORMAL"),
        ("CREATE", "Tạo", "NORMAL"),
        ("EDIT", "Sửa", "NORMAL"),
        ("DELETE", "Xóa", "HIGH"),
        ("SUBMIT", "Gửi duyệt", "NORMAL"),
        ("APPROVE", "Phê duyệt", "HIGH"),
        ("REJECT", "Từ chối", "NORMAL"),
        ("CONFIRM", "Xác nhận", "HIGH"),
        ("CANCEL", "Hủy", "HIGH"),
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
            code=f"PUR.CONTRACT.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": f"{name} - Hợp đồng mua hàng",
                "status": "ACTIVE",
            },
        )

    DocumentType.objects.get_or_create(
        code="PUR.CONTRACT",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Hợp đồng mua hàng",
            "document_class": "PURCHASE",
            "supports_workflow": True,
            "requires_posting": False,
            "creates_inventory": False,
            "status": "ACTIVE",
        },
    )


def rollback(apps, schema_editor):
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")

    Permission.objects.filter(code__in=[
        "PUR.CONTRACT.DELETE",
        "PUR.CONTRACT.CONFIRM",
    ]).delete()
    DocumentType.objects.filter(code="PUR.CONTRACT").delete()


class Migration(migrations.Migration):

    dependencies = [
        ('purchases', '0030_purchasecontract_assigned_to_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_contract_permissions_and_doctype, rollback),
    ]
