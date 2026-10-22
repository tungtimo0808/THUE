from rest_framework.routers import DefaultRouter

from . import prepaid_views, views
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
router.register("prepaid-expenses", prepaid_views.PrepaidExpenseViewSet, basename="gl-prepaid-expense")
router.register("prepaid-allocations", prepaid_views.PrepaidAllocationViewSet, basename="gl-prepaid-allocation")
router.register("prepaid-decreases", prepaid_views.PrepaidDecreaseViewSet, basename="gl-prepaid-decrease")
router.register("closing-rules", views.ClosingRuleViewSet, basename="gl-closing-rule")
router.register("closing-runs", views.ClosingRunViewSet, basename="gl-closing-run")
router.register("reconciliations", views.ReconciliationViewSet, basename="gl-reconciliation")
router.register("approvals", views.ApprovalViewSet, basename="gl-approval")
router.register("opening-balances", views.OpeningBalanceViewSet, basename="gl-opening-balance")

urlpatterns = router.urls
