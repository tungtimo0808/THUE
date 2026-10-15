import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")

    resource, _ = Resource.objects.get_or_create(
        code="PUR.RECONCILIATION",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Đối chiếu chứng từ mua hàng",
            "status": "ACTIVE",
        },
    )
    for code, name in (
        ("VIEW", "Xem đối chiếu chứng từ mua hàng"),
        ("MATCH", "Thực hiện và xác nhận đối chiếu"),
        ("CREATE", "Lập đối chiếu chứng từ mua hàng"),
        ("APPROVE", "Phê duyệt chấp nhận chênh lệch"),
        ("CANCEL", "Hủy kết quả đối chiếu"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"PUR.RECONCILIATION.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )
    DocumentType.objects.get_or_create(
        code="PUR.RECONCILIATION",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Đối chiếu chứng từ mua hàng",
            "document_class": "PURCHASE",
            "supports_workflow": False,
            "requires_posting": False,
            "creates_inventory": False,
            "status": "ACTIVE",
        },
    )


class Migration(migrations.Migration):
    dependencies = [("purchases", "0023_purchasereconciliation_purchasereconciliationline_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
