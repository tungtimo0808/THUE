import uuid

from django.db import migrations


RESOURCES = {
    "GL.PERIOD": ("Kỳ kế toán", ("VIEW", "CREATE", "EDIT", "DELETE", "CLOSE_PERIOD", "REOPEN_PERIOD")),
    "GL.BUDGET": ("Ngân sách", ("VIEW", "CREATE", "EDIT", "DELETE")),
    "GL.JOURNAL": ("Bút toán kế toán", ("VIEW", "CREATE", "EDIT", "DELETE", "SUBMIT", "APPROVE", "POST", "REVERSE", "CANCEL")),
    "GL.BALANCE": ("Số dư tài khoản", ("VIEW", "AGGREGATE")),
    "GL.LEDGER": ("Sổ cái và nhật ký", ("VIEW",)),
    "GL.ALLOCATION": ("Phân bổ kế toán", ("VIEW", "CREATE", "EDIT", "DELETE", "RUN")),
    "GL.CLOSING": ("Kết chuyển cuối kỳ", ("VIEW", "CREATE", "EDIT", "DELETE", "RUN")),
    "GL.RECONCILIATION": ("Đối chiếu GL", ("VIEW", "RUN", "RESOLVE")),
    "GL.APPROVAL": ("Lịch sử phê duyệt GL", ("VIEW",)),
}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    names = {
        "VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "DELETE": "Xóa",
        "SUBMIT": "Gửi duyệt", "APPROVE": "Phê duyệt", "POST": "Ghi sổ",
        "REVERSE": "Đảo", "CANCEL": "Hủy", "AGGREGATE": "Tổng hợp",
        "CLOSE_PERIOD": "Đóng kỳ", "REOPEN_PERIOD": "Mở lại kỳ",
        "RUN": "Thực hiện", "RESOLVE": "Xử lý chênh lệch",
    }
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"APPROVE", "POST", "REVERSE", "CLOSE_PERIOD", "REOPEN_PERIOD"} else "NORMAL"},
        )
    for code, (name, action_codes) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "module_code": "GL", "name": name, "status": "ACTIVE"},
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
    dependencies = [("general_ledger", "0002_accountingperiod_accountbalance_allocationrule_and_more"), ("iam", "0005_seed_uc_md")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
