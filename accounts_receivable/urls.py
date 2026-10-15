from rest_framework.routers import DefaultRouter
from . import views
router=DefaultRouter()
router.register("documents",views.DocumentViewSet,basename="ar-document")
router.register("receivables",views.ReceivableViewSet,basename="ar-receivable")
router.register("credit-policies",views.CreditPolicyViewSet,basename="ar-credit-policy")
router.register("collection-plans",views.CollectionPlanViewSet,basename="ar-collection-plan")
router.register("receipts",views.ReceiptViewSet,basename="ar-receipt")
router.register("customer-receipt-vouchers",views.CustomerReceiptVoucherViewSet,basename="ar-customer-receipt-voucher")
router.register("allocation-vouchers",views.ReceiptAllocationVoucherViewSet,basename="ar-allocation-voucher")
router.register("debt-netting-vouchers",views.DebtNettingVoucherViewSet,basename="ar-debt-netting-voucher")
router.register("debt-adjustment-vouchers",views.DebtAdjustmentVoucherViewSet,basename="ar-debt-adjustment-voucher")
router.register("debt-reconciliations",views.CustomerDebtReconciliationViewSet,basename="ar-debt-reconciliation")
router.register("customer-debt-reconciliations",views.CustomerDebtReconciliationViewSet,basename="ar-customer-debt-reconciliation")
router.register("nettings",views.NettingViewSet,basename="ar-netting")
router.register("confirmations",views.ConfirmationViewSet,basename="ar-confirmation")
router.register("adjustments",views.AdjustmentViewSet,basename="ar-adjustment")
router.register("approvals",views.ApprovalViewSet,basename="ar-approval")
router.register("due-tracking",views.DueTrackingViewSet,basename="ar-due-tracking")
router.register("customer-due-debts",views.DueTrackingViewSet,basename="ar-customer-due-debt")
router.register("payment-reminders",views.CustomerPaymentReminderViewSet,basename="ar-payment-reminder")
router.register("customer-payment-reminders",views.CustomerPaymentReminderViewSet,basename="ar-customer-payment-reminder")
urlpatterns=router.urls


