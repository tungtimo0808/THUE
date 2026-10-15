from django.contrib import admin

from . import models

for model in (
    models.PurchaseRequest,
    models.PurchaseRequestLine,
    models.PurchaseContract,
    models.PurchaseContractLine,
    models.PurchaseOrder,
    models.PurchaseOrderLine,
    models.PurchaseOrderRequestLine,
    models.PurchaseReceipt,
    models.PurchaseReceiptLine,
    models.ApprovalDecision,
    models.PurchaseReconciliation,
    models.PurchaseReconciliationLine,
):
    admin.site.register(model)
