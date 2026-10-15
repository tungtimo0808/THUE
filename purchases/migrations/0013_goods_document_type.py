import uuid

from django.db import migrations


def seed(apps, schema_editor):
    DocumentType = apps.get_model("master_data", "DocumentType")
    DocumentType.objects.get_or_create(code="PUR.GOODS_PURCHASE", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Chứng từ mua hàng hóa",
        "document_class": "PURCHASE", "supports_workflow": True,
        "requires_posting": True, "creates_inventory": True, "creates_payable": True,
        "status": "ACTIVE",
    })


class Migration(migrations.Migration):
    dependencies = [("purchases", "0012_goodspurchase_order_receiving_status_before_and_more"),
                    ("master_data", "0023_catalogexportbatch")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
