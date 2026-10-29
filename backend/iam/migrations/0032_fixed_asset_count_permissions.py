import uuid

from django.db import migrations

# UC-FA-08 BR01: the stocktake views and services check FA.COUNT.*, but no migration created them,
# so only superusers could count assets. EF26 & BR62 add the right to adjust a confirmed voucher.
PERMISSIONS = {
    "VIEW": ("Xem", "NORMAL", "Xem biên bản kiểm kê TSCĐ"),
    "CREATE": ("Tạo", "NORMAL", "Lập biên bản kiểm kê TSCĐ"),
    "EDIT": ("Cập nhật", "NORMAL", "Cập nhật biên bản kiểm kê và xử lý kiến nghị"),
    "ADJUST_CONFIRMED": ("Hiệu chỉnh chứng từ đã xác nhận", "HIGH", "Hiệu chỉnh biên bản kiểm kê TSCĐ đã ghi nhận"),
}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(
        code="FA.COUNT", defaults={"id": uuid.uuid4(), "module_code": "FA", "name": "Kiểm kê tài sản", "status": "ACTIVE"},
    )
    for action_code, (name, risk, description) in PERMISSIONS.items():
        action, _ = Action.objects.get_or_create(code=action_code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": risk})
        Permission.objects.get_or_create(code=f"FA.COUNT.{action_code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
            "description": description, "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0031_account_transfer_permission")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
