import uuid

from django.db import migrations


RESOURCES = {
    "PUR.REQUEST": ("Yêu cầu mua hàng", ("VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "REJECT", "CANCEL")),
    "PUR.ORDER": ("Đơn mua hàng", ("VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "REJECT", "CLOSE", "CANCEL")),
    "PUR.CONTRACT": ("Hợp đồng mua", ("VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "REJECT", "CANCEL")),
    "PUR.RECEIPT": ("Nhận hàng và dịch vụ", ("VIEW", "CREATE", "EDIT", "CONFIRM", "CANCEL")),
    "PUR.APPROVAL": ("Lịch sử phê duyệt mua hàng", ("VIEW",)),
}


def seed_permissions(apps, schema_editor):
    PermissionAction = apps.get_model("iam", "PermissionAction")
    PermissionResource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    action_names = {
        "VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "SUBMIT": "Gửi duyệt",
        "APPROVE": "Phê duyệt", "REJECT": "Từ chối", "CONFIRM": "Xác nhận",
        "CANCEL": "Hủy", "CLOSE": "Đóng",
    }
    actions = {}
    for code, name in action_names.items():
        actions[code], _ = PermissionAction.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"APPROVE", "CANCEL", "CLOSE"} else "NORMAL"},
        )
    for code, (name, action_codes) in RESOURCES.items():
        resource, _ = PermissionResource.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "module_code": "PUR", "name": name, "status": "ACTIVE"},
        )
        for action_code in action_codes:
            Permission.objects.get_or_create(
                code=f"{code}.{action_code}",
                defaults={
                    "id": uuid.uuid4(), "resource_id": resource.id, "action_id": actions[action_code].id,
                    "description": f"{action_names[action_code]} - {name}", "status": "ACTIVE",
                },
            )


class Migration(migrations.Migration):
    dependencies = [("purchases", "0001_initial"), ("iam", "0005_seed_uc_md")]
    operations = [migrations.RunPython(seed_permissions, migrations.RunPython.noop)]
