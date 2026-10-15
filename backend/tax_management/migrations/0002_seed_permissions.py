import uuid

from django.db import migrations


RESOURCES = {
    "TAX.INVOICE": ("Hóa đơn thuế", ("VIEW", "CREATE", "EDIT", "DELETE", "VALIDATE", "ISSUE", "ADJUST", "REPLACE", "CANCEL")),
    "TAX.LINK": ("Liên kết hóa đơn và chứng từ", ("VIEW", "CREATE", "EDIT", "DELETE")),
    "TAX.PERIOD": ("Kỳ thuế", ("VIEW", "CREATE", "EDIT", "DELETE")),
    "TAX.SUMMARY": ("Tổng hợp thuế", ("VIEW", "CREATE")),
    "TAX.FILING": ("Hồ sơ kê khai thuế", ("VIEW", "CREATE", "EDIT", "DELETE", "SUBMIT")),
    "TAX.OBLIGATION": ("Nghĩa vụ thuế", ("VIEW", "CREATE", "EDIT", "DELETE", "PAYMENT")),
    "TAX.RECONCILIATION": ("Đối chiếu thuế", ("VIEW", "RUN")),
    "TAX.CONNECTOR": ("Kết nối hóa đơn và CQT", ("VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE", "SYNC")),
    "TAX.EXPORT": ("Xuất dữ liệu thuế", ("VIEW", "EXPORT", "SUBMIT")),
}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    names = {
        "VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "DELETE": "Xóa",
        "VALIDATE": "Kiểm tra", "ISSUE": "Phát hành", "ADJUST": "Điều chỉnh",
        "REPLACE": "Thay thế", "CANCEL": "Hủy", "SUBMIT": "Nộp",
        "PAYMENT": "Liên kết thanh toán", "RUN": "Chạy đối chiếu", "CONFIGURE": "Cấu hình",
        "SYNC": "Đồng bộ", "EXPORT": "Xuất dữ liệu",
    }
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"ISSUE", "ADJUST", "REPLACE", "CANCEL", "SUBMIT"} else "NORMAL"},
        )
    for code, (name, action_codes) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(
            code=code, defaults={"id": uuid.uuid4(), "module_code": "TAX", "name": name, "status": "ACTIVE"},
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
    dependencies = [("tax_management", "0001_initial"), ("iam", "0005_seed_uc_md")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]

