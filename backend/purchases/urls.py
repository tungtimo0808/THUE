from rest_framework.routers import DefaultRouter

from . import views
from .goods_views import GoodsPurchaseViewSet
from .service_views import ServicePurchaseViewSet
from .return_views import PurchaseReturnViewSet
from .discount_views import PurchaseDiscountViewSet
from .input_invoice_views import InputInvoiceViewSet
from .reconciliation_views import PurchaseReconciliationViewSet
from .tracking_views import OrderTrackingViewSet
from .cost_views import PurchaseCostViewSet
from .contract_views import PurchaseContractViewSet
from .risk_views import SupplierRiskViewSet

router = DefaultRouter()
router.register("purchase-requests", views.PurchaseRequestViewSet, basename="purchase-request")
router.register("purchase-contracts", PurchaseContractViewSet, basename="purchase-contract")
router.register("purchase-orders", views.PurchaseOrderViewSet, basename="purchase-order")
router.register("receipts", views.PurchaseReceiptViewSet, basename="purchase-receipt")
router.register("approvals", views.ApprovalDecisionViewSet, basename="purchase-approval")
router.register("goods-purchases", GoodsPurchaseViewSet, basename="goods-purchase")
router.register("service-purchases", ServicePurchaseViewSet, basename="service-purchase")
router.register("purchase-returns", PurchaseReturnViewSet, basename="purchase-return")
router.register("purchase-discounts", PurchaseDiscountViewSet, basename="purchase-discount")
router.register("input-invoices", InputInvoiceViewSet, basename="input-invoice")
router.register("reconciliations", PurchaseReconciliationViewSet, basename="purchase-reconciliation")
router.register("tracking", OrderTrackingViewSet, basename="purchase-tracking")
router.register("purchase-costs", PurchaseCostViewSet, basename="purchase-cost")
router.register("supplier-risk", SupplierRiskViewSet, basename="supplier-risk")

urlpatterns = router.urls

