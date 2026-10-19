from rest_framework.routers import DefaultRouter

from . import production_views, views

router = DefaultRouter()
router.register("policies", views.PolicyViewSet, basename="inventory-policy")
router.register("lot-serials", views.LotSerialViewSet, basename="inventory-lot-serial")
router.register("transactions", views.TransactionViewSet, basename="inventory-transaction")
router.register("balances", views.BalanceViewSet, basename="inventory-balance")
router.register("movements", views.MovementViewSet, basename="inventory-movement")
router.register("counts", views.StockCountViewSet, basename="inventory-count")
router.register("assemblies", views.AssemblyViewSet, basename="inventory-assembly")
router.register("production-orders", production_views.ProductionOrderViewSet, basename="inventory-production-order")
router.register("valuations", views.ValuationViewSet, basename="inventory-valuation")
router.register("periods", views.PeriodViewSet, basename="inventory-period")
router.register("approvals", views.ApprovalViewSet, basename="inventory-approval")

urlpatterns = router.urls
