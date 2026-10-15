import uuid
from django.db import migrations


def forward(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="AR.RECEIPT_VOUCHER",
        defaults={"id": uuid.uuid4(), "module_code": "AR",
                  "name": "Phiếu thu tiền khách hàng", "status": "ACTIVE"},
    )
    for code, name in (
        ("VIEW", "Xem"), ("CREATE", "Lập"), ("EDIT", "Sửa"),
        ("SUBMIT", "Gửi duyệt"), ("APPROVE", "Phê duyệt"),
        ("POST", "Ghi sổ"), ("CANCEL", "Hủy"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name,
                      "risk_level": "HIGH" if code in {"APPROVE", "POST"} else "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"AR.RECEIPT_VOUCHER.{code}",
            defaults={"id": uuid.uuid4(), "resource_id": resource.id,
                      "action_id": action.id, "description": name, "status": "ACTIVE"},
        )


def backward(apps, schema_editor):
    apps.get_model("iam", "Permission").objects.filter(
        code__startswith="AR.RECEIPT_VOUCHER."
    ).delete()
    apps.get_model("iam", "PermissionResource").objects.filter(
        code="AR.RECEIPT_VOUCHER"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts_receivable", "0014_receiptallocation_schedule_customerreceiptvoucher_and_more")]
    operations = [migrations.RunPython(forward, backward)]
