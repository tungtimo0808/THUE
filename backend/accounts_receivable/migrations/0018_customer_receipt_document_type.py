import uuid
from django.db import migrations


def forward(apps, schema_editor):
    apps.get_model("master_data", "DocumentType").objects.get_or_create(
        code="AR.RECEIPT_VOUCHER",
        defaults={
            "id": uuid.uuid4(), "module_code": "AR",
            "name": "Phiếu thu tiền khách hàng",
            "document_class": "FINANCIAL",
            "supports_workflow": True,
            "requires_posting": True,
            "status": "ACTIVE",
        },
    )


def backward(apps, schema_editor):
    apps.get_model("master_data", "DocumentType").objects.filter(
        code="AR.RECEIPT_VOUCHER"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts_receivable", "0017_receiptallocation_installment_no_and_more")]
    operations = [migrations.RunPython(forward, backward)]
