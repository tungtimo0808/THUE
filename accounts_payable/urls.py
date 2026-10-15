from rest_framework.routers import DefaultRouter
from . import views
router=DefaultRouter()
router.register("documents", views.PayableDocumentViewSet, basename="ap-document")
router.register("invoices", views.InvoiceViewSet, basename="ap-invoice")
router.register("payables", views.PayableViewSet, basename="ap-payable")
router.register("payment-requests", views.PaymentRequestViewSet, basename="ap-payment-request")
router.register("payments", views.PaymentViewSet, basename="ap-payment")
router.register("payment-allocations", views.PaymentAllocationVoucherViewSet, basename="ap-payment-allocation")
router.register("debt-offsets", views.DebtOffsetVoucherViewSet, basename="ap-debt-offset")
router.register("adjustment-vouchers", views.PayableAdjustmentVoucherViewSet, basename="ap-adjustment-voucher")
router.register("supplier-reconciliations", views.SupplierReconciliationViewSet, basename="ap-supplier-reconciliation")
router.register("nettings", views.NettingViewSet, basename="ap-netting")
router.register("adjustments", views.AdjustmentViewSet, basename="ap-adjustment")
router.register("approvals", views.ApprovalViewSet, basename="ap-approval")
router.register("tracking", views.SupplierDebtTrackingViewSet, basename="ap-tracking")
router.register("due-payables", views.DuePayableViewSet, basename="ap-due-payable")
router.register("reports", views.PayableReportViewSet, basename="ap-report")
urlpatterns=router.urls
