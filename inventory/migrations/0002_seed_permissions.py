import uuid

from django.db import migrations


RESOURCES = {
    "INV.POLICY": ("Cấu hình và hạn mức tồn kho", ("VIEW", "CREATE", "EDIT", "CONFIGURE")),
    "INV.LOT_SERIAL": ("Lot, Serial và hạn sử dụng", ("VIEW", "CREATE", "EDIT")),
    "INV.TRANSACTION": ("Giao dịch kho", ("VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "POST", "CANCEL", "TRANSFER", "ADJUST")),
    "INV.BALANCE": ("Số dư và lịch sử tồn kho", ("VIEW",)),
    "INV.COUNT": ("Kiểm kê kho", ("VIEW", "CREATE", "EDIT", "COUNT", "CANCEL")),
    "INV.ASSEMBLY": ("Lắp ráp và tháo dỡ", ("VIEW", "CREATE", "EDIT", "POST", "CANCEL")),
    "INV.VALUATION": ("Tính giá hàng tồn kho", ("VIEW", "RUN")),
    "INV.PERIOD": ("Kỳ tồn kho", ("VIEW", "CREATE", "EDIT", "CANCEL")),
    "INV.GL": ("Chuyển dữ liệu tồn kho sang GL", ("VIEW", "POST")),
    "INV.APPROVAL": ("Lịch sử phê duyệt tồn kho", ("VIEW",)),
}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    names = {
        "VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "CONFIGURE": "Cấu hình",
        "SUBMIT": "Gửi duyệt", "APPROVE": "Phê duyệt", "POST": "Ghi nhận",
        "CANCEL": "Hủy", "TRANSFER": "Điều chuyển", "ADJUST": "Điều chỉnh",
        "COUNT": "Kiểm kê", "RUN": "Chạy tính giá",
    }
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"APPROVE", "POST", "TRANSFER", "ADJUST"} else "NORMAL"},
        )
    for code, (name, action_codes) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "module_code": "INV", "name": name, "status": "ACTIVE"},
        )
        for action_code in action_codes:
            Permission.objects.get_or_create(
                code=f"{code}.{action_code}",
                defaults={
                    "id": uuid.uuid4(), "resource_id": resource.id, "action_id": actions[action_code].id,
                    "description": f"{names[action_code]} - {name}", "status": "ACTIVE",
                },
            )


class Migration(migrations.Migration):
    dependencies = [("inventory", "0001_initial"), ("iam", "0005_seed_uc_md")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]

