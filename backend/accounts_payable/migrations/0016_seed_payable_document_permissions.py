import uuid
from django.db import migrations

RESOURCES = {
    "AP.DOCUMENT": ("Chứng từ công nợ phải trả", ("VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "REJECT", "POST", "CANCEL")),
}

def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    names = {"VIEW": "Xem", "CREATE": "Tạo", "EDIT": "Cập nhật", "SUBMIT": "Gửi duyệt", "APPROVE": "Phê duyệt", "REJECT": "Từ chối", "POST": "Ghi sổ", "CANCEL": "Hủy"}
    actions = {}
    for code, name in names.items():
        actions[code], _ = Action.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"POST", "APPROVE"} else "NORMAL"})
    for code, (name, codes) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "module_code": "AP", "name": name, "status": "ACTIVE"})
        for action in codes:
            Permission.objects.get_or_create(code=f"{code}.{action}", defaults={"id": uuid.uuid4(), "resource_id": resource.id, "action_id": actions[action].id, "description": f"{names[action]} - {name}", "status": "ACTIVE"})

class Migration(migrations.Migration):
    dependencies = [("accounts_payable", "0015_payabledocument_payabledocumentline_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
