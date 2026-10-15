import uuid

from django.db import migrations


RESOURCES = {
    "FA.CATEGORY": ("Nhóm TSCĐ và CCDC", ("VIEW", "CREATE", "EDIT", "DELETE")),
    "FA.ASSET": ("Thẻ TSCĐ và hồ sơ CCDC", ("VIEW", "CREATE", "EDIT", "DELETE")),
    "FA.TRANSACTION": ("Giao dịch tài sản", ("VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "POST", "TRANSFER", "DISPOSE", "REVERSE", "CANCEL", "DELETE")),
    "FA.CALCULATION": ("Khấu hao và phân bổ", ("VIEW", "CREATE", "EDIT", "CALCULATE", "POST", "DELETE")),
    "FA.PERIOD": ("Kỳ tài sản", ("VIEW", "CREATE", "EDIT", "DELETE")),
    "FA.GL": ("Chuyển giao dịch tài sản sang GL", ("VIEW", "POST")),
    "FA.APPROVAL": ("Lịch sử phê duyệt tài sản", ("VIEW",)),
}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    names = {
        "VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "DELETE": "Xóa",
        "SUBMIT": "Gửi duyệt", "APPROVE": "Phê duyệt", "POST": "Ghi nhận",
        "TRANSFER": "Điều chuyển", "DISPOSE": "Ghi giảm", "REVERSE": "Đảo",
        "CANCEL": "Hủy", "CALCULATE": "Tính khấu hao/phân bổ",
    }
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"APPROVE", "POST", "TRANSFER", "DISPOSE", "REVERSE"} else "NORMAL"},
        )
    for code, (name, action_codes) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "module_code": "FA", "name": name, "status": "ACTIVE"},
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
    dependencies = [("fixed_assets", "0001_initial"), ("iam", "0005_seed_uc_md")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]

