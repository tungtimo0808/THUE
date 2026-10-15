import uuid
from django.db import migrations


def forward(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")
    resource, _ = Resource.objects.get_or_create(
        code="AR.ADJUSTMENT_VOUCHER",
        defaults={"id": uuid.uuid4(), "module_code": "AR",
                  "name": "Chứng từ điều chỉnh công nợ", "status": "ACTIVE"},
    )
    for code, name in (
        ("VIEW", "Xem"), ("CREATE", "Lập"), ("EDIT", "Sửa"),
        ("SUBMIT", "Gửi duyệt"), ("APPROVE", "Phê duyệt"),
        ("POST", "Ghi sổ"), ("UNPOST", "Bỏ ghi sổ"), ("CANCEL", "Hủy"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "name": name,
                                 "risk_level": "HIGH" if code in {"POST", "UNPOST", "APPROVE"} else "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"AR.ADJUSTMENT_VOUCHER.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.id,
                      "action_id": action.id, "description": name, "status": "ACTIVE"},
        )
    DocumentType.objects.get_or_create(
        code="AR.ADJUSTMENT_VOUCHER",
        defaults={"id": uuid.uuid4(), "module_code": "AR", "name": "Chứng từ điều chỉnh công nợ",
                  "document_class": "FINANCIAL", "requires_posting": True, "status": "ACTIVE"},
    )


def backward(apps, schema_editor):
    apps.get_model("iam", "Permission").objects.filter(
        code__startswith="AR.ADJUSTMENT_VOUCHER."
    ).delete()
    apps.get_model("iam", "PermissionResource").objects.filter(
        code="AR.ADJUSTMENT_VOUCHER"
    ).delete()
    apps.get_model("master_data", "DocumentType").objects.filter(
        code="AR.ADJUSTMENT_VOUCHER"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts_receivable", "0023_debtadjustmentvoucher_debtadjustmentapproval_and_more")]
    operations = [migrations.RunPython(forward, backward)]
