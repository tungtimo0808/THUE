import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    resource, _ = Resource.objects.get_or_create(code="PUR.GOODS", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Mua hàng hóa", "status": "ACTIVE"})
    for code, name in (("VIEW", "Xem"), ("CREATE", "Tạo"), ("EDIT", "Sửa"),
                       ("SUBMIT", "Gửi duyệt"), ("APPROVE", "Phê duyệt"), ("POST", "Ghi sổ"),
                       ("UNPOST", "Bỏ ghi sổ"), ("CANCEL", "Hủy")):
        action, _ = Action.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"POST", "UNPOST", "APPROVE"} else "NORMAL"})
        Permission.objects.get_or_create(code=f"PUR.GOODS.{code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": f"{name} - Mua hàng hóa", "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("purchases", "0008_goodspurchase_goodspurchaseline_and_more"), ("iam", "0029_account_management_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
