import uuid
from django.db import migrations


def forward(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")

    resource, _ = Resource.objects.get_or_create(
        code="AR.PAYMENT_REMINDER",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "AR",
            "name": "Lập thông báo đề nghị thanh toán",
            "status": "ACTIVE",
        },
    )

    for code, name in (
        ("VIEW", "Xem thông báo đề nghị thanh toán"),
        ("CREATE", "Lập thông báo đề nghị thanh toán"),
        ("EDIT", "Sửa thông báo đề nghị thanh toán"),
        ("SEND", "Ghi nhận gửi thông báo"),
        ("CANCEL", "Hủy thông báo đề nghị thanh toán"),
        ("EXPORT", "Xuất thông báo đề nghị thanh toán"),
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
            code=f"AR.PAYMENT_REMINDER.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )

    DocumentType.objects.get_or_create(
        code="AR.PAYMENT_REMINDER",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "AR",
            "name": "Thông báo đề nghị thanh toán công nợ",
            "document_class": "FINANCIAL",
            "requires_posting": False,
            "status": "ACTIVE",
        },
    )


def backward(apps, schema_editor):
    apps.get_model("iam", "Permission").objects.filter(
        code__startswith="AR.PAYMENT_REMINDER."
    ).delete()
    apps.get_model("iam", "PermissionResource").objects.filter(
        code="AR.PAYMENT_REMINDER"
    ).delete()
    apps.get_model("master_data", "DocumentType").objects.filter(
        code="AR.PAYMENT_REMINDER"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts_receivable", "0029_customer_payment_reminder")]
    operations = [migrations.RunPython(forward, backward)]
