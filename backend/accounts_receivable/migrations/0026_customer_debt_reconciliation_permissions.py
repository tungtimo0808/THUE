import uuid
from django.db import migrations


def forward(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")

    resource, _ = Resource.objects.get_or_create(
        code="AR.RECONCILIATION",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "AR",
            "name": "Đối chiếu công nợ khách hàng",
            "status": "ACTIVE",
        },
    )

    for code, name in (
        ("VIEW", "Xem biên bản đối chiếu"),
        ("CREATE", "Lập biên bản đối chiếu"),
        ("EDIT", "Sửa biên bản đối chiếu"),
        ("SEND", "Ghi nhận gửi biên bản"),
        ("RESPOND", "Ghi nhận phản hồi đối chiếu"),
        ("CANCEL", "Hủy biên bản đối chiếu"),
        ("EXPORT", "Xuất biên bản đối chiếu"),
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
            code=f"AR.RECONCILIATION.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )

    DocumentType.objects.get_or_create(
        code="AR.RECONCILIATION",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "AR",
            "name": "Biên bản đối chiếu công nợ",
            "document_class": "FINANCIAL",
            "requires_posting": False,
            "status": "ACTIVE",
        },
    )


def backward(apps, schema_editor):
    apps.get_model("iam", "Permission").objects.filter(
        code__startswith="AR.RECONCILIATION."
    ).delete()
    apps.get_model("iam", "PermissionResource").objects.filter(
        code="AR.RECONCILIATION"
    ).delete()
    apps.get_model("master_data", "DocumentType").objects.filter(
        code="AR.RECONCILIATION"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts_receivable", "0025_customer_debt_reconciliation")]
    operations = [migrations.RunPython(forward, backward)]
