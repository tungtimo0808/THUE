import uuid

from django.db import migrations

RESOURCES = {
    "PAYROLL.SETTING": ("Thiết lập tiền lương", ("VIEW", "EDIT")),
    "PAYROLL.PROFILE": ("Hồ sơ lương nhân viên", ("VIEW", "CREATE", "EDIT")),
    "PAYROLL.ATTENDANCE": ("Bảng chấm công", ("VIEW", "CREATE")),
    "PAYROLL.SHEET": ("Bảng lương", ("VIEW", "CREATE", "POST", "PAY")),
}
NAMES = {"VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "POST": "Ghi sổ", "PAY": "Chi trả"}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    for code, (name, actions) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "module_code": "PAYROLL", "name": name, "status": "ACTIVE"})
        for action_code in actions:
            action, _ = Action.objects.get_or_create(code=action_code, defaults={
                "id": uuid.uuid4(), "name": NAMES[action_code], "risk_level": "HIGH" if action_code in ("POST", "PAY") else "NORMAL"})
            Permission.objects.get_or_create(code=f"{code}.{action_code}", defaults={
                "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                "description": f"{NAMES[action_code]} - {name}", "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("payroll", "0001_initial"), ("iam", "0030_seed_referenced_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
