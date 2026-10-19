from rest_framework.routers import DefaultRouter

from . import count_views, views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="fixed-asset-category")
router.register("assets", views.AssetViewSet, basename="fixed-asset")
router.register("transactions", views.TransactionViewSet, basename="fixed-asset-transaction")
router.register("calculations", views.CalculationRunViewSet, basename="fixed-asset-calculation")
router.register("periods", views.PeriodViewSet, basename="fixed-asset-period")
router.register("approvals", views.ApprovalViewSet, basename="fixed-asset-approval")
router.register("counts", count_views.AssetCountViewSet, basename="fixed-asset-count")

urlpatterns = router.urls
