import uuid
from django.db import migrations


RESOURCES = {
    "SAL.SALES_INVOICE": ("Hóa đơn đầu ra", (
        "VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "REJECT", "ISSUE", "RETRY_ISSUE", "CANCEL", "SEND_EMAIL"
    )),
}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    names = {
        "VIEW": "Xem",
        "CREATE": "Tạo",
        "EDIT": "Cập nhật",
        "SUBMIT": "Gửi xử lý",
        "APPROVE": "Phê duyệt",
        "REJECT": "Từ chối",
        "ISSUE": "Phát hành",
        "RETRY_ISSUE": "Thử lại phát hành",
        "CANCEL": "Hủy",
        "SEND_EMAIL": "Gửi email",
    }
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(
            code=code,
            defaults={
                "id": uuid.uuid4(),
                "name": name,
                "risk_level": "HIGH" if code in {"APPROVE", "CANCEL", "ISSUE"} else "NORMAL"
            }
        )
    for code, (name, codes) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "module_code": "SAL", "name": name, "status": "ACTIVE"}
        )
        for action in codes:
            Permission.objects.get_or_create(
                code=f"{code}.{action}",
                defaults={
                    "id": uuid.uuid4(),
                    "resource_id": resource.id,
                    "action_id": actions[action].id,
                    "description": f"{names[action]} - {name}",
                    "status": "ACTIVE",
                }
            )


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0017_alter_approvaldecision_document_type_salesinvoice_and_more"),
    ]
    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
