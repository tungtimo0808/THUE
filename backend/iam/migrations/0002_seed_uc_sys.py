import uuid

from django.conf import settings
from django.db import migrations


ACTIONS = {
    "VIEW": "Xem",
    "CREATE": "Tạo",
    "EDIT": "Cập nhật",
    "DELETE": "Xóa",
    "SUBMIT": "Gửi duyệt",
    "APPROVE": "Phê duyệt",
    "REJECT": "Từ chối",
    "POST": "Ghi sổ",
    "UNPOST": "Bỏ ghi sổ",
    "CANCEL": "Hủy",
    "REVERSE": "Đảo",
    "CONFIRM": "Xác nhận",
    "PRINT": "In",
    "IMPORT": "Nhập khẩu dữ liệu",
    "EXPORT": "Xuất dữ liệu",
    "CONFIGURE": "Cấu hình",
}

RESOURCES = {
    "SYS.USER": ("Quản lý User", ("VIEW", "CREATE", "EDIT")),
    "SYS.ROLE": ("Quản lý Role", ("VIEW", "CREATE", "EDIT", "CONFIGURE")),
    "SYS.PERMISSION": ("Cấu hình Permission", ("VIEW", "CONFIGURE")),
    "SYS.ROLE_ASSIGNMENT": ("Gán Role và Data Scope", ("VIEW", "CONFIGURE")),
    "SYS.AUDIT": ("Tra cứu Audit Log", ("VIEW", "EXPORT")),
}


def seed_uc_sys(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    UserAccount = apps.get_model("iam", "UserAccount")
    PermissionAction = apps.get_model("iam", "PermissionAction")
    PermissionResource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    for user in User.objects.all():
        UserAccount.objects.get_or_create(
            auth_user_id=user.pk,
            defaults={
                "id": uuid.uuid4(),
                "display_name": f"{user.first_name} {user.last_name}".strip() or user.username,
            },
        )

    actions = {}
    for code, name in ACTIONS.items():
        actions[code], _ = PermissionAction.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"DELETE", "POST", "UNPOST", "REVERSE", "CONFIGURE"} else "NORMAL"},
        )

    for resource_code, (name, action_codes) in RESOURCES.items():
        resource, _ = PermissionResource.objects.get_or_create(
            code=resource_code,
            defaults={"id": uuid.uuid4(), "module_code": "SYS", "name": name, "status": "ACTIVE"},
        )
        for action_code in action_codes:
            Permission.objects.get_or_create(
                code=f"{resource_code}.{action_code}",
                defaults={
                    "id": uuid.uuid4(),
                    "resource_id": resource.id,
                    "action_id": actions[action_code].id,
                    "description": f"{ACTIONS[action_code]} - {name}",
                    "status": "ACTIVE",
                },
            )


class Migration(migrations.Migration):
    dependencies = [("iam", "0001_initial")]
    operations = [migrations.RunPython(seed_uc_sys, migrations.RunPython.noop)]
