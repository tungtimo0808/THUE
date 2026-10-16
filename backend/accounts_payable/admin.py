from django.contrib import admin
from . import models

for model in (models.SupplierInvoice, models.SupplierInvoiceLine, models.ApprovalDecision, models.Payable, models.PaymentRequest, models.PaymentRequestLine, models.Payment, models.PaymentAllocation, models.PaymentAllocationVoucher, models.PaymentAllocationVoucherLine, models.PaymentAllocationCounter, models.DebtOffsetVoucher, models.DebtOffsetPayableLine, models.DebtOffsetReceivableLine, models.DebtOffsetCounter, models.Netting, models.PayableAdjustment, models.PayableAdjustmentVoucher, models.PayableAdjustmentCounter, models.SupplierReconciliation, models.SupplierReconciliationCounter):
    admin.site.register(model)
