from rest_framework.routers import DefaultRouter

from . import views
from .views import AccountClassViewSet, AccountViewSet, ChartOfAccountsViewSet

router = DefaultRouter()
router.register("account-classes", AccountClassViewSet, basename="account-class")
router.register("charts-of-accounts", ChartOfAccountsViewSet, basename="chart-of-accounts")
router.register("accounts", AccountViewSet, basename="account")
router.register("periods", views.PeriodViewSet, basename="gl-period")
router.register("budgets", views.BudgetViewSet, basename="gl-budget")
router.register("journals", views.JournalViewSet, basename="gl-journal")
router.register("balances", views.BalanceViewSet, basename="gl-balance")
router.register("allocation-rules", views.AllocationRuleViewSet, basename="gl-allocation-rule")
router.register("allocation-runs", views.AllocationRunViewSet, basename="gl-allocation-run")
router.register("closing-rules", views.ClosingRuleViewSet, basename="gl-closing-rule")
router.register("closing-runs", views.ClosingRunViewSet, basename="gl-closing-run")
router.register("reconciliations", views.ReconciliationViewSet, basename="gl-reconciliation")
router.register("approvals", views.ApprovalViewSet, basename="gl-approval")

urlpatterns = router.urls
