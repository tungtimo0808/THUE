import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")
    resource, _ = Resource.objects.get_or_create(code="PUR.INPUT_INVOICE", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Hóa đơn đầu vào", "status": "ACTIVE"})
    for code, name in (("VIEW", "Xem"), ("RECEIVE", "Tiếp nhận"),
                       ("LINK", "Liên kết"), ("UNLINK", "Hủy liên kết")):
        action, _ = Action.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"})
        Permission.objects.get_or_create(code=f"PUR.INPUT_INVOICE.{code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": f"{name} - Hóa đơn đầu vào", "status": "ACTIVE"})
    DocumentType.objects.get_or_create(code="PUR.INPUT_INVOICE", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Hóa đơn đầu vào",
        "document_class": "PURCHASE", "supports_workflow": False,
        "requires_posting": False, "creates_inventory": False, "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("purchases", "0020_purchaseinvoicefile_purchaseinvoicematch")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
