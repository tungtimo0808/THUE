import uuid

from django.conf import settings
from django.db import migrations


RESOURCES = {
    "COM.JOIN_REQUEST": ("Yêu cầu tham gia doanh nghiệp", ("VIEW", "APPROVE")),
    "COM.NOTIFICATION": ("Thông báo cá nhân", ("VIEW",)),
    "COM.SEARCH": ("Tìm kiếm toàn cục", ("USE",)),
    "COM.DASHBOARD": ("Dashboard và việc cần làm", ("VIEW",)),
    "COM.AI": ("AI Assistant", ("USE", "CONFIGURE")),
    "COM.SETTING": ("Cấu hình dùng chung", ("VIEW", "CONFIGURE")),
}


def seed(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    UserAccount = apps.get_model("iam", "UserAccount")
    Company = apps.get_model("organization", "Company")
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    RolePermission = apps.get_model("iam", "RolePermission")
    Role = apps.get_model("iam", "Role")
    Preference = apps.get_model("common_services", "UserPreference")
    SessionState = apps.get_model("common_services", "UserSessionState")
    Setting = apps.get_model("common_services", "CoreCompanySetting")
    names = {"VIEW": "Xem", "APPROVE": "Phê duyệt", "USE": "Sử dụng", "CONFIGURE": "Cấu hình"}
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"APPROVE", "CONFIGURE"} else "NORMAL"})
    permissions = []
    for code, (name, action_codes) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "module_code": "COM", "name": name, "status": "ACTIVE"})
        for action_code in action_codes:
            permission, _ = Permission.objects.get_or_create(code=f"{code}.{action_code}", defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": actions[action_code].id, "description": f"{names[action_code]} - {name}", "status": "ACTIVE"})
            permissions.append(permission)
    for role in Role.objects.filter(is_system_admin=True):
        for permission in permissions:
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})
    for user in User.objects.all():
        account = UserAccount.objects.filter(auth_user_id=user.pk).first()
        if account:
            Preference.objects.get_or_create(user_id=account.pk)
        SessionState.objects.get_or_create(user_id=user.pk)
    for company in Company.objects.all():
        Setting.objects.get_or_create(company_id=company.pk)


class Migration(migrations.Migration):
    dependencies = [("common_services", "0001_initial"), ("iam", "0005_seed_uc_md"), ("organization", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
