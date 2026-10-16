import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")
    resource, _ = Resource.objects.get_or_create(code="PUR.SERVICE", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Mua dịch vụ", "status": "ACTIVE"})
    for code, name in (("VIEW", "Xem"), ("CREATE", "Tạo"), ("EDIT", "Sửa"),
                       ("SUBMIT", "Gửi duyệt"), ("APPROVE", "Phê duyệt"), ("POST", "Ghi sổ"),
                       ("UNPOST", "Bỏ ghi sổ"), ("CANCEL", "Hủy")):
        action, _ = Action.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"POST", "UNPOST", "APPROVE"} else "NORMAL"})
        Permission.objects.get_or_create(code=f"PUR.SERVICE.{code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": f"{name} - Mua dịch vụ", "status": "ACTIVE"})
    DocumentType.objects.get_or_create(code="PUR.SERVICE_PURCHASE", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Chứng từ mua dịch vụ",
        "document_class": "PURCHASE", "supports_workflow": True,
        "requires_posting": True, "creates_payable": True, "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("purchases", "0014_goodspurchase_acceptance_reference_and_more"),
                    ("master_data", "0024_item_requires_service_acceptance")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
