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
router.register("reconciliation-rules", views.ReconciliationRuleViewSet, basename="gl-reconciliation-rule")
router.register("reconciliations", views.ReconciliationViewSet, basename="gl-reconciliation")
router.register("approvals", views.ApprovalViewSet, basename="gl-approval")
router.register("opening-balances", views.OpeningBalanceViewSet, basename="gl-opening-balance")
router.register("advance-requests", views.AdvanceSettlementRequestViewSet, basename="gl-advance-request")
router.register("advance-settlement-requests", views.AdvanceSettlementRequestViewSet, basename="gl-advance-settlement-request")
router.register("advance-settlements", views.AdvanceSettlementVoucherViewSet, basename="gl-advance-settlement")
router.register("advance-settlement-vouchers", views.AdvanceSettlementVoucherViewSet, basename="gl-advance-settlement-voucher")
router.register("general-vouchers", views.GeneralBusinessVoucherViewSet, basename="gl-general-voucher")
router.register("subledger-rules", views.SubledgerPostingRuleViewSet, basename="gl-subledger-rule")
router.register("subledger-ingestions", views.SubledgerJournalIngestionViewSet, basename="gl-subledger-ingestion")
router.register("fx-revaluation-rules", views.ForeignCurrencyRevaluationRuleViewSet, basename="gl-fx-revaluation-rule")
router.register("fx-revaluation-runs", views.ForeignCurrencyRevaluationRunViewSet, basename="gl-fx-revaluation-run")
router.register("balance-aggregations", views.BalanceAggregationRunViewSet, basename="gl-balance-aggregation")
router.register("financial-statement-mappings", views.FinancialStatementMappingRuleViewSet, basename="gl-financial-statement-mapping")
router.register("financial-statements", views.FinancialStatementBatchViewSet, basename="gl-financial-statement")
router.register("ledger-inquiry", views.LedgerInquiryAndTraceViewSet, basename="gl-ledger-inquiry")

urlpatterns = router.urls
