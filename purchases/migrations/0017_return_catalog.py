import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")
    resource, _ = Resource.objects.get_or_create(code="PUR.RETURN", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Hàng mua trả lại", "status": "ACTIVE"})
    for code, name in (("VIEW", "Xem"), ("CREATE", "Tạo"), ("EDIT", "Sửa"),
                       ("SUBMIT", "Gửi duyệt"), ("APPROVE", "Phê duyệt"), ("POST", "Ghi sổ"),
                       ("UNPOST", "Bỏ ghi sổ"), ("CANCEL", "Hủy")):
        action, _ = Action.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"POST", "UNPOST", "APPROVE"} else "NORMAL"})
        Permission.objects.get_or_create(code=f"PUR.RETURN.{code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": f"{name} - Hàng mua trả lại", "status": "ACTIVE"})
    DocumentType.objects.get_or_create(code="PUR.RETURN", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Chứng từ hàng mua trả lại",
        "document_class": "PURCHASE", "supports_workflow": True,
        "requires_posting": True, "creates_inventory": True, "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("purchases", "0016_alter_approvaldecision_document_type_purchasereturn_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
