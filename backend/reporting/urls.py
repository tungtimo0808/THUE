from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from .views import (
    BusinessResultViewSet,
    CashFlowViewSet,
    DashboardViewSet,
    FinancialBundleViewSet,
    FinancialNotesViewSet,
    FinancialPositionViewSet,
    FinancialStatementRunViewSet,
    FinancialStatementTT99ViewSet,
    ReportDefinitionViewSet,
    ReportEngineViewSet,
    ReportExportViewSet,
    ReportLineMappingViewSet,
    ReportRunViewSet,
    TaxReportViewSet,
    PurchaseReportViewSet,
    SalesReportViewSet,
    DebtReportViewSet,
    MoneyReportViewSet,
    InventoryReportViewSet,
    AssetReportViewSet,
    UnifiedExportViewSet,
    DrilldownViewSet,
)


router = DefaultRouter(trailing_slash=True)
router.register("definitions", ReportDefinitionViewSet, basename="report-definition")
router.register("line-mappings", ReportLineMappingViewSet, basename="report-line-mapping")
router.register("engine", ReportEngineViewSet, basename="report-engine")
router.register("runs", ReportRunViewSet, basename="report-run")
router.register("exports", ReportExportViewSet, basename="report-export")
router.register("tt99-financial-statements", FinancialStatementTT99ViewSet, basename="report-tt99-financial-statements")
router.register("dashboard", DashboardViewSet, basename="report-dashboard")
router.register("financial-bundles", FinancialBundleViewSet, basename="report-financial-bundles")
router.register("financial-statements", FinancialStatementRunViewSet, basename="report-financial-statements")

urlpatterns = [
    path(
        "dashboard/metrics/<str:metric_code>/details/",
        DashboardViewSet.as_view({"get": "metric_details"}),
        name="report-dashboard-metric-details",
    ),
    re_path(
        r"^financial-statements/(?P<run_id>[^/.]+)/line/(?P<line_id>[^/.]+)/sources/?$",
        FinancialStatementRunViewSet.as_view({"get": "line_sources"}),
        name="report-financial-statement-line-sources",
    ),
    path(
        "financial-position/templates/",
        FinancialPositionViewSet.as_view({"get": "templates"}),
        name="report-financial-position-templates",
    ),
    path(
        "financial-position/templates/<str:template_id>/versions/",
        FinancialPositionViewSet.as_view({"get": "template_versions"}),
        name="report-financial-position-template-versions",
    ),
    path(
        "financial-position/parameters/",
        FinancialPositionViewSet.as_view({"get": "parameters"}),
        name="report-financial-position-parameters",
    ),
    path(
        "financial-position/runs/",
        FinancialPositionViewSet.as_view({"get": "runs", "post": "runs"}),
        name="report-financial-position-runs",
    ),
    path(
        "financial-position/runs/<str:run_id>/",
        FinancialPositionViewSet.as_view({"get": "run_detail"}),
        name="report-financial-position-run-detail",
    ),
    path(
        "financial-position/runs/<str:run_id>/lines/",
        FinancialPositionViewSet.as_view({"get": "run_lines"}),
        name="report-financial-position-run-lines",
    ),
    path(
        "financial-position/runs/<str:run_id>/validation/",
        FinancialPositionViewSet.as_view({"get": "run_validation"}),
        name="report-financial-position-run-validation",
    ),
    path(
        "financial-position/runs/<str:run_id>/validate/",
        FinancialPositionViewSet.as_view({"post": "run_validate"}),
        name="report-financial-position-run-validate",
    ),
    path(
        "financial-position/runs/<str:run_id>/lines/<str:line_id>/calculation/",
        FinancialPositionViewSet.as_view({"get": "line_calculation"}),
        name="report-financial-position-line-calculation",
    ),
    path(
        "financial-position/runs/<str:run_id>/lines/<str:line_id>/drilldown/",
        FinancialPositionViewSet.as_view({"get": "line_drilldown"}),
        name="report-financial-position-line-drilldown",
    ),
    path(
        "financial-position/runs/<str:run_id>/history/",
        FinancialPositionViewSet.as_view({"get": "run_history"}),
        name="report-financial-position-run-history",
    ),
    path(
        "financial-position/runs/<str:run_id>/submit-review/",
        FinancialPositionViewSet.as_view({"post": "run_submit_review"}),
        name="report-financial-position-run-submit-review",
    ),
    path(
        "financial-position/runs/<str:run_id>/approve/",
        FinancialPositionViewSet.as_view({"post": "run_approve"}),
        name="report-financial-position-run-approve",
    ),
    path(
        "financial-position/runs/<str:run_id>/export/",
        FinancialPositionViewSet.as_view({"post": "run_export"}),
        name="report-financial-position-run-export",
    ),
    re_path(
        r"^business-result/templates/?$",
        BusinessResultViewSet.as_view({"get": "templates"}),
        name="report-business-result-templates",
    ),
    re_path(
        r"^business-result/template-versions/?$",
        BusinessResultViewSet.as_view({"get": "template_versions"}),
        name="report-business-result-template-versions",
    ),
    re_path(
        r"^business-result/templates/(?P<template_id>[^/.]+)/versions/?$",
        BusinessResultViewSet.as_view({"get": "template_versions"}),
        name="report-business-result-template-id-versions",
    ),
    re_path(
        r"^business-result/parameters/?$",
        BusinessResultViewSet.as_view({"get": "parameters"}),
        name="report-business-result-parameters",
    ),
    re_path(
        r"^business-result/runs/?$",
        BusinessResultViewSet.as_view({"get": "runs", "post": "runs"}),
        name="report-business-result-runs",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/?$",
        BusinessResultViewSet.as_view({"get": "run_detail"}),
        name="report-business-result-run-detail",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/lines/?$",
        BusinessResultViewSet.as_view({"get": "run_lines"}),
        name="report-business-result-run-lines",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/values/?$",
        BusinessResultViewSet.as_view({"get": "run_values"}),
        name="report-business-result-run-values",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/validation/?$",
        BusinessResultViewSet.as_view({"get": "run_validation"}),
        name="report-business-result-run-validation",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/validate/?$",
        BusinessResultViewSet.as_view({"post": "run_validate"}),
        name="report-business-result-run-validate",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/lines/(?P<indicator_code>[^/.]+)/calculation/?$",
        BusinessResultViewSet.as_view({"get": "line_calculation"}),
        name="report-business-result-line-calculation",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/lines/(?P<indicator_code>[^/.]+)/drilldown/?$",
        BusinessResultViewSet.as_view({"get": "line_drilldown"}),
        name="report-business-result-line-drilldown",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/history/?$",
        BusinessResultViewSet.as_view({"get": "run_history"}),
        name="report-business-result-run-history",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/submit-review/?$",
        BusinessResultViewSet.as_view({"post": "run_submit_review"}),
        name="report-business-result-run-submit-review",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/approve/?$",
        BusinessResultViewSet.as_view({"post": "run_approve"}),
        name="report-business-result-run-approve",
    ),
    re_path(
        r"^business-result/runs/(?P<run_id>[^/.]+)/export/?$",
        BusinessResultViewSet.as_view({"post": "run_export"}),
        name="report-business-result-run-export",
    ),
    re_path(
        r"^cash-flow/templates/?$",
        CashFlowViewSet.as_view({"get": "templates"}),
        name="report-cash-flow-templates",
    ),
    re_path(
        r"^cash-flow/template-versions/?$",
        CashFlowViewSet.as_view({"get": "template_versions"}),
        name="report-cash-flow-template-versions",
    ),
    re_path(
        r"^cash-flow/templates/(?P<template_id>[^/.]+)/versions/?$",
        CashFlowViewSet.as_view({"get": "template_versions"}),
        name="report-cash-flow-template-id-versions",
    ),
    re_path(
        r"^cash-flow/parameters/?$",
        CashFlowViewSet.as_view({"get": "parameters"}),
        name="report-cash-flow-parameters",
    ),
    re_path(
        r"^cash-flow/runs/?$",
        CashFlowViewSet.as_view({"get": "runs", "post": "runs"}),
        name="report-cash-flow-runs",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/?$",
        CashFlowViewSet.as_view({"get": "run_detail"}),
        name="report-cash-flow-run-detail",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/lines/?$",
        CashFlowViewSet.as_view({"get": "run_lines"}),
        name="report-cash-flow-run-lines",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/values/?$",
        CashFlowViewSet.as_view({"get": "run_values"}),
        name="report-cash-flow-run-values",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/validation/?$",
        CashFlowViewSet.as_view({"get": "run_validation"}),
        name="report-cash-flow-run-validation",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/validate/?$",
        CashFlowViewSet.as_view({"post": "run_validate"}),
        name="report-cash-flow-run-validate",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/lines/(?P<indicator_code>[^/.]+)/calculation/?$",
        CashFlowViewSet.as_view({"get": "line_calculation"}),
        name="report-cash-flow-line-calculation",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/lines/(?P<indicator_code>[^/.]+)/drilldown/?$",
        CashFlowViewSet.as_view({"get": "line_drilldown"}),
        name="report-cash-flow-line-drilldown",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/unclassified-transactions/?$",
        CashFlowViewSet.as_view({"get": "unclassified_transactions"}),
        name="report-cash-flow-unclassified-transactions",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/reconciliation/?$",
        CashFlowViewSet.as_view({"get": "reconciliation"}),
        name="report-cash-flow-reconciliation",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/history/?$",
        CashFlowViewSet.as_view({"get": "run_history"}),
        name="report-cash-flow-run-history",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/submit-review/?$",
        CashFlowViewSet.as_view({"post": "run_submit_review"}),
        name="report-cash-flow-run-submit-review",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/approve/?$",
        CashFlowViewSet.as_view({"post": "run_approve"}),
        name="report-cash-flow-run-approve",
    ),
    re_path(
        r"^cash-flow/runs/(?P<run_id>[^/.]+)/export/?$",
        CashFlowViewSet.as_view({"post": "run_export"}),
        name="report-cash-flow-run-export",
    ),
    re_path(
        r"^financial-notes/templates/?$",
        FinancialNotesViewSet.as_view({"get": "templates"}),
        name="report-financial-notes-templates",
    ),
    re_path(
        r"^financial-notes/template-versions/?$",
        FinancialNotesViewSet.as_view({"get": "template_versions"}),
        name="report-financial-notes-template-versions",
    ),
    re_path(
        r"^financial-notes/templates/(?P<template_id>[^/]+)/versions/?$",
        FinancialNotesViewSet.as_view({"get": "template_versions"}),
        name="report-financial-notes-template-id-versions",
    ),
    re_path(
        r"^financial-notes/runs/?$",
        FinancialNotesViewSet.as_view({"get": "runs", "post": "runs"}),
        name="report-financial-notes-runs",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/?$",
        FinancialNotesViewSet.as_view({"get": "run_detail"}),
        name="report-financial-notes-run-detail",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/sections/?$",
        FinancialNotesViewSet.as_view({"get": "run_sections"}),
        name="report-financial-notes-run-sections",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/sections/(?P<section_code>[^/]+)/?$",
        FinancialNotesViewSet.as_view({"get": "section_detail"}),
        name="report-financial-notes-section-detail",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/items/(?P<note_code>[^/]+)/tables/?$",
        FinancialNotesViewSet.as_view({"get": "item_tables"}),
        name="report-financial-notes-item-tables",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/items/(?P<note_code>[^/]+)/sources/?$",
        FinancialNotesViewSet.as_view({"get": "item_sources"}),
        name="report-financial-notes-item-sources",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/items/(?P<note_code>[^/]+)/?$",
        FinancialNotesViewSet.as_view({"get": "item_detail", "put": "item_detail", "patch": "item_detail", "post": "item_detail"}),
        name="report-financial-notes-item-detail",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/tables/(?P<table_id>[^/]+)/rows/?$",
        FinancialNotesViewSet.as_view({"get": "table_rows"}),
        name="report-financial-notes-table-rows",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/validation/?$",
        FinancialNotesViewSet.as_view({"get": "run_validation"}),
        name="report-financial-notes-run-validation",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/completeness/?$",
        FinancialNotesViewSet.as_view({"get": "run_completeness"}),
        name="report-financial-notes-run-completeness",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/history/?$",
        FinancialNotesViewSet.as_view({"get": "run_history"}),
        name="report-financial-notes-run-history",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/search/?$",
        FinancialNotesViewSet.as_view({"get": "run_search"}),
        name="report-financial-notes-run-search",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/validate/?$",
        FinancialNotesViewSet.as_view({"post": "run_validate"}),
        name="report-financial-notes-run-validate",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/submit-review/?$",
        FinancialNotesViewSet.as_view({"post": "run_submit_review"}),
        name="report-financial-notes-run-submit-review",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/approve/?$",
        FinancialNotesViewSet.as_view({"post": "run_approve"}),
        name="report-financial-notes-run-approve",
    ),
    re_path(
        r"^financial-notes/runs/(?P<run_id>[^/]+)/export/?$",
        FinancialNotesViewSet.as_view({"post": "run_export"}),
        name="report-financial-notes-run-export",
    ),
    re_path(
        r"^tax/catalogue/?$",
        TaxReportViewSet.as_view({"get": "catalogue"}),
        name="report-tax-catalogue",
    ),
    re_path(
        r"^tax/forms/?$",
        TaxReportViewSet.as_view({"get": "forms"}),
        name="report-tax-forms",
    ),
    re_path(
        r"^tax/forms/(?P<form_code>.+)/versions/?$",
        TaxReportViewSet.as_view({"get": "form_versions"}),
        name="report-tax-form-versions",
    ),
    re_path(
        r"^tax/runs/(?P<run_id>[^/]+)/rows/(?P<row_id>[^/]+)/sources/?$",
        TaxReportViewSet.as_view({"get": "row_sources"}),
        name="report-tax-row-sources",
    ),
    re_path(
        r"^tax/runs/(?P<run_id>[^/]+)/rows/?$",
        TaxReportViewSet.as_view({"get": "run_rows"}),
        name="report-tax-run-rows",
    ),
    re_path(
        r"^tax/runs/(?P<run_id>[^/]+)/summary/?$",
        TaxReportViewSet.as_view({"get": "run_summary"}),
        name="report-tax-run-summary",
    ),
    re_path(
        r"^tax/runs/(?P<run_id>[^/]+)/validation/?$",
        TaxReportViewSet.as_view({"get": "run_validation"}),
        name="report-tax-run-validation",
    ),
    re_path(
        r"^tax/runs/(?P<run_id>[^/]+)/history/?$",
        TaxReportViewSet.as_view({"get": "run_history"}),
        name="report-tax-run-history",
    ),
    re_path(
        r"^tax/runs/(?P<run_id>[^/]+)/export/?$",
        TaxReportViewSet.as_view({"post": "run_export"}),
        name="report-tax-run-export",
    ),
    re_path(
        r"^tax/runs/(?P<run_id>[^/]+)/?$",
        TaxReportViewSet.as_view({"get": "run_detail"}),
        name="report-tax-run-detail",
    ),
    re_path(
        r"^tax/declarations/(?P<declaration_id>[^/]+)/indicators/?$",
        TaxReportViewSet.as_view({"get": "declaration_indicators"}),
        name="report-tax-declaration-indicators",
    ),
    re_path(
        r"^tax/reconciliation-runs/(?P<reconciliation_run_id>[^/]+)/differences/?$",
        TaxReportViewSet.as_view({"get": "reconciliation_differences"}),
        name="report-tax-reconciliation-differences",
    ),
    re_path(
        r"^tax/submissions/(?P<submission_id>[^/]+)/responses/?$",
        TaxReportViewSet.as_view({"get": "submission_responses"}),
        name="report-tax-submission-responses",
    ),
    re_path(
        r"^tax/(?P<report_code>[^/]+)/parameters/?$",
        TaxReportViewSet.as_view({"get": "parameters"}),
        name="report-tax-parameters",
    ),
    re_path(
        r"^tax/(?P<report_code>[^/]+)/schema/?$",
        TaxReportViewSet.as_view({"get": "schema"}),
        name="report-tax-schema",
    ),
    re_path(
        r"^tax/(?P<report_code>[^/]+)/runs/?$",
        TaxReportViewSet.as_view({"get": "runs"}),
        name="report-tax-runs",
    ),
    re_path(
        r"^tax/(?P<report_code>[^/]+)/query/?$",
        TaxReportViewSet.as_view({"post": "query_report"}),
        name="report-tax-query",
    ),
    # UC-RPT-08: Báo cáo mua hàng (11 báo cáo)
    re_path(
        r"^purchase/catalogue/?$",
        PurchaseReportViewSet.as_view({"get": "catalogue"}),
        name="report-purchase-catalogue",
    ),
    re_path(
        r"^purchase/saved/?$",
        PurchaseReportViewSet.as_view({"get": "saved_filters", "post": "save_filter"}),
        name="report-purchase-saved-filters",
    ),
    re_path(
        r"^purchase/runs/(?P<run_id>[^/]+)/rows/(?P<row_id>[^/]+)/sources/?$",
        PurchaseReportViewSet.as_view({"get": "row_sources"}),
        name="report-purchase-row-sources",
    ),
    re_path(
        r"^purchase/runs/(?P<run_id>[^/]+)/rows/?$",
        PurchaseReportViewSet.as_view({"get": "run_rows"}),
        name="report-purchase-run-rows",
    ),
    re_path(
        r"^purchase/runs/(?P<run_id>[^/]+)/summary/?$",
        PurchaseReportViewSet.as_view({"get": "run_summary"}),
        name="report-purchase-run-summary",
    ),
    re_path(
        r"^purchase/runs/(?P<run_id>[^/]+)/validation/?$",
        PurchaseReportViewSet.as_view({"get": "run_validation"}),
        name="report-purchase-run-validation",
    ),
    re_path(
        r"^purchase/runs/(?P<run_id>[^/]+)/history/?$",
        PurchaseReportViewSet.as_view({"get": "run_history"}),
        name="report-purchase-run-history",
    ),
    re_path(
        r"^purchase/runs/(?P<run_id>[^/]+)/export/?$",
        PurchaseReportViewSet.as_view({"post": "run_export"}),
        name="report-purchase-run-export",
    ),
    re_path(
        r"^purchase/runs/(?P<run_id>[^/]+)/?$",
        PurchaseReportViewSet.as_view({"get": "run_detail"}),
        name="report-purchase-run-detail",
    ),
    re_path(
        r"^purchase/reconciliation/(?P<run_id>[^/]+)/differences/?$",
        PurchaseReportViewSet.as_view({"get": "reconciliation_differences"}),
        name="report-purchase-reconciliation-differences",
    ),
    re_path(
        r"^purchase/(?P<report_code>[^/]+)/schema/?$",
        PurchaseReportViewSet.as_view({"get": "schema"}),
        name="report-purchase-schema",
    ),
    re_path(
        r"^purchase/(?P<report_code>[^/]+)/parameters/?$",
        PurchaseReportViewSet.as_view({"get": "parameters"}),
        name="report-purchase-parameters",
    ),
    re_path(
        r"^purchase/(?P<report_code>[^/]+)/query/?$",
        PurchaseReportViewSet.as_view({"post": "query_report"}),
        name="report-purchase-query",
    ),
    # UC-RPT-09: Báo cáo bán hàng (36 báo cáo)
    re_path(
        r"^sales/catalogue/?$",
        SalesReportViewSet.as_view({"get": "catalogue"}),
        name="report-sales-catalogue",
    ),
    re_path(
        r"^sales/saved/?$",
        SalesReportViewSet.as_view({"get": "saved_filters", "post": "save_filter"}),
        name="report-sales-saved-filters",
    ),
    re_path(
        r"^sales/order-fulfillment/(?P<order_id>[^/]+)/?$",
        SalesReportViewSet.as_view({"get": "order_fulfillment"}),
        name="report-sales-order-fulfillment",
    ),
    re_path(
        r"^sales/contract-fulfillment/(?P<contract_id>[^/]+)/?$",
        SalesReportViewSet.as_view({"get": "contract_fulfillment"}),
        name="report-sales-contract-fulfillment",
    ),
    re_path(
        r"^sales/profitability/(?P<target_type>[^/]+)/(?P<target_id>[^/]+)/?$",
        SalesReportViewSet.as_view({"get": "profitability"}),
        name="report-sales-profitability",
    ),
    re_path(
        r"^sales/runs/(?P<run_id>[^/]+)/rows/(?P<row_id>[^/]+)/sources/?$",
        SalesReportViewSet.as_view({"get": "row_sources"}),
        name="report-sales-row-sources",
    ),
    re_path(
        r"^sales/runs/(?P<run_id>[^/]+)/rows/?$",
        SalesReportViewSet.as_view({"get": "run_rows"}),
        name="report-sales-run-rows",
    ),
    re_path(
        r"^sales/runs/(?P<run_id>[^/]+)/summary/?$",
        SalesReportViewSet.as_view({"get": "run_summary"}),
        name="report-sales-run-summary",
    ),
    re_path(
        r"^sales/runs/(?P<run_id>[^/]+)/validation/?$",
        SalesReportViewSet.as_view({"get": "run_validation"}),
        name="report-sales-run-validation",
    ),
    re_path(
        r"^sales/runs/(?P<run_id>[^/]+)/history/?$",
        SalesReportViewSet.as_view({"get": "run_history"}),
        name="report-sales-run-history",
    ),
    re_path(
        r"^sales/runs/(?P<run_id>[^/]+)/export/?$",
        SalesReportViewSet.as_view({"post": "run_export"}),
        name="report-sales-run-export",
    ),
    re_path(
        r"^sales/runs/(?P<run_id>[^/]+)/?$",
        SalesReportViewSet.as_view({"get": "run_detail"}),
        name="report-sales-run-detail",
    ),
    re_path(
        r"^sales/(?P<report_code>[^/]+)/schema/?$",
        SalesReportViewSet.as_view({"get": "schema"}),
        name="report-sales-schema",
    ),
    re_path(
        r"^sales/(?P<report_code>[^/]+)/parameters/?$",
        SalesReportViewSet.as_view({"get": "parameters"}),
        name="report-sales-parameters",
    ),
    re_path(
        r"^sales/(?P<report_code>[^/]+)/query/?$",
        SalesReportViewSet.as_view({"post": "query_report"}),
        name="report-sales-query",
    ),
    # UC-RPT-10: Báo cáo công nợ (49 báo cáo: 18 AP + 31 AR / Combined)
    re_path(
        r"^debt/catalogue/?$",
        DebtReportViewSet.as_view({"get": "catalogue"}),
        name="report-debt-catalogue",
    ),
    re_path(
        r"^debt/saved/?$",
        DebtReportViewSet.as_view({"get": "saved_filters", "post": "save_filter"}),
        name="report-debt-saved-filters",
    ),
    re_path(
        r"^debt/aging-analysis/?$",
        DebtReportViewSet.as_view({"get": "aging_analysis", "post": "aging_analysis"}),
        name="report-debt-aging-analysis",
    ),
    re_path(
        r"^debt/confirmation-document/?$",
        DebtReportViewSet.as_view({"get": "confirmation_document", "post": "confirmation_document"}),
        name="report-debt-confirmation-document",
    ),
    re_path(
        r"^debt/contract-combined/(?P<contract_id>[^/]+)/?$",
        DebtReportViewSet.as_view({"get": "contract_combined"}),
        name="report-debt-contract-combined",
    ),
    re_path(
        r"^debt/runs/(?P<run_id>[^/]+)/rows/(?P<row_id>[^/]+)/sources/?$",
        DebtReportViewSet.as_view({"get": "row_sources"}),
        name="report-debt-row-sources",
    ),
    re_path(
        r"^debt/runs/(?P<run_id>[^/]+)/rows/?$",
        DebtReportViewSet.as_view({"get": "run_rows"}),
        name="report-debt-run-rows",
    ),
    re_path(
        r"^debt/runs/(?P<run_id>[^/]+)/summary/?$",
        DebtReportViewSet.as_view({"get": "run_summary"}),
        name="report-debt-run-summary",
    ),
    re_path(
        r"^debt/runs/(?P<run_id>[^/]+)/validation/?$",
        DebtReportViewSet.as_view({"get": "run_validation"}),
        name="report-debt-run-validation",
    ),
    re_path(
        r"^debt/runs/(?P<run_id>[^/]+)/history/?$",
        DebtReportViewSet.as_view({"get": "run_history"}),
        name="report-debt-run-history",
    ),
    re_path(
        r"^debt/runs/(?P<run_id>[^/]+)/export/?$",
        DebtReportViewSet.as_view({"post": "run_export"}),
        name="report-debt-run-export",
    ),
    re_path(
        r"^debt/runs/(?P<run_id>[^/]+)/?$",
        DebtReportViewSet.as_view({"get": "run_detail"}),
        name="report-debt-run-detail",
    ),
    re_path(
        r"^debt/reconciliation/(?P<run_id>[^/]+)/differences/?$",
        DebtReportViewSet.as_view({"get": "reconciliation_differences"}),
        name="report-debt-reconciliation-differences",
    ),
    re_path(
        r"^debt/(?P<report_code>[^/]+)/schema/?$",
        DebtReportViewSet.as_view({"get": "schema"}),
        name="report-debt-schema",
    ),
    re_path(
        r"^debt/(?P<report_code>[^/]+)/parameters/?$",
        DebtReportViewSet.as_view({"get": "parameters"}),
        name="report-debt-parameters",
    ),
    re_path(
        r"^debt/(?P<report_code>[^/]+)/query/?$",
        DebtReportViewSet.as_view({"post": "query_report"}),
        name="report-debt-query",
    ),
    # UC-RPT-11: Báo cáo tiền
    re_path(
        r"^money/catalogue/?$",
        MoneyReportViewSet.as_view({"get": "catalogue"}),
        name="report-money-catalogue",
    ),
    re_path(
        r"^money/saved/?$",
        MoneyReportViewSet.as_view({"get": "list_saved_filters", "post": "save_filter"}),
        name="report-money-saved-filters",
    ),
    re_path(
        r"^money/balances/as-of/?$",
        MoneyReportViewSet.as_view({"get": "balances_as_of"}),
        name="report-money-balances-as-of",
    ),
    re_path(
        r"^money/cash-funds/?$",
        MoneyReportViewSet.as_view({"get": "cash_funds"}),
        name="report-money-cash-funds",
    ),
    re_path(
        r"^money/bank-accounts/?$",
        MoneyReportViewSet.as_view({"get": "bank_accounts"}),
        name="report-money-bank-accounts",
    ),
    re_path(
        r"^money/transfers/(?P<transfer_id>[^/]+)/trace/?$",
        MoneyReportViewSet.as_view({"get": "transfer_trace"}),
        name="report-money-transfer-trace",
    ),
    re_path(
        r"^money/loans/(?P<loan_id>[^/]+)/summary/?$",
        MoneyReportViewSet.as_view({"get": "loan_summary"}),
        name="report-money-loan-summary",
    ),
    re_path(
        r"^money/reconciliation/differences/?$",
        MoneyReportViewSet.as_view({"get": "reconciliation_differences"}),
        name="report-money-reconciliation-differences",
    ),
    re_path(
        r"^money/runs/(?P<run_id>[^/]+)/rows/(?P<row_id>[^/]+)/sources/?$",
        MoneyReportViewSet.as_view({"get": "row_sources"}),
        name="report-money-row-sources",
    ),
    re_path(
        r"^money/runs/(?P<run_id>[^/]+)/rows/?$",
        MoneyReportViewSet.as_view({"get": "run_rows"}),
        name="report-money-run-rows",
    ),
    re_path(
        r"^money/runs/(?P<run_id>[^/]+)/summary/?$",
        MoneyReportViewSet.as_view({"get": "run_summary"}),
        name="report-money-run-summary",
    ),
    re_path(
        r"^money/runs/(?P<run_id>[^/]+)/validation/?$",
        MoneyReportViewSet.as_view({"get": "run_validation"}),
        name="report-money-run-validation",
    ),
    re_path(
        r"^money/runs/(?P<run_id>[^/]+)/history/?$",
        MoneyReportViewSet.as_view({"get": "run_history"}),
        name="report-money-run-history",
    ),
    re_path(
        r"^money/runs/(?P<run_id>[^/]+)/export/?$",
        MoneyReportViewSet.as_view({"post": "run_export"}),
        name="report-money-run-export",
    ),
    re_path(
        r"^money/runs/(?P<run_id>[^/]+)/?$",
        MoneyReportViewSet.as_view({"get": "run_details"}),
        name="report-money-run-detail",
    ),
    re_path(
        r"^money/(?P<report_code>[^/]+)/schema/?$",
        MoneyReportViewSet.as_view({"get": "schema"}),
        name="report-money-schema",
    ),
    re_path(
        r"^money/(?P<report_code>[^/]+)/parameters/?$",
        MoneyReportViewSet.as_view({"get": "parameters"}),
        name="report-money-parameters",
    ),
    re_path(
        r"^money/(?P<report_code>[^/]+)/query/?$",
        MoneyReportViewSet.as_view({"post": "query_report"}),
        name="report-money-query",
    ),
    # UC-RPT-12: Báo cáo kho (15 Báo cáo)
    re_path(
        r"^inventory/catalogue/?$",
        InventoryReportViewSet.as_view({"get": "catalogue"}),
        name="report-inventory-catalogue",
    ),
    re_path(
        r"^inventory/saved/?$",
        InventoryReportViewSet.as_view({"get": "list_saved_filters", "post": "save_filter"}),
        name="report-inventory-saved-filters",
    ),
    re_path(
        r"^inventory/balances/as-of/?$",
        InventoryReportViewSet.as_view({"get": "balances_as_of"}),
        name="report-inventory-balances-as-of",
    ),
    re_path(
        r"^inventory/runs/(?P<run_id>[^/]+)/rows/(?P<row_id>[^/]+)/sources/?$",
        InventoryReportViewSet.as_view({"get": "row_sources"}),
        name="report-inventory-row-sources",
    ),
    re_path(
        r"^inventory/runs/(?P<run_id>[^/]+)/rows/?$",
        InventoryReportViewSet.as_view({"get": "run_rows"}),
        name="report-inventory-run-rows",
    ),
    re_path(
        r"^inventory/runs/(?P<run_id>[^/]+)/summary/?$",
        InventoryReportViewSet.as_view({"get": "run_summary"}),
        name="report-inventory-run-summary",
    ),
    re_path(
        r"^inventory/runs/(?P<run_id>[^/]+)/validation/?$",
        InventoryReportViewSet.as_view({"get": "run_validation"}),
        name="report-inventory-run-validation",
    ),
    re_path(
        r"^inventory/runs/(?P<run_id>[^/]+)/history/?$",
        InventoryReportViewSet.as_view({"get": "run_history"}),
        name="report-inventory-run-history",
    ),
    re_path(
        r"^inventory/runs/(?P<run_id>[^/]+)/export/?$",
        InventoryReportViewSet.as_view({"post": "run_export"}),
        name="report-inventory-run-export",
    ),
    re_path(
        r"^inventory/runs/(?P<run_id>[^/]+)/?$",
        InventoryReportViewSet.as_view({"get": "run_details"}),
        name="report-inventory-run-detail",
    ),
    re_path(
        r"^inventory/(?P<report_code>[^/]+)/schema/?$",
        InventoryReportViewSet.as_view({"get": "schema"}),
        name="report-inventory-schema",
    ),
    re_path(
        r"^inventory/(?P<report_code>[^/]+)/parameters/?$",
        InventoryReportViewSet.as_view({"get": "parameters"}),
        name="report-inventory-parameters",
    ),
    re_path(
        r"^inventory/(?P<report_code>[^/]+)/query/?$",
        InventoryReportViewSet.as_view({"post": "query_report"}),
        name="report-inventory-query",
    ),
    # UC-RPT-13: Báo cáo tài sản và công cụ dụng cụ (14 Báo cáo)
    re_path(
        r"^assets/catalogue/?$",
        AssetReportViewSet.as_view({"get": "catalogue"}),
        name="report-asset-catalogue",
    ),
    re_path(
        r"^assets/saved/?$",
        AssetReportViewSet.as_view({"get": "list_saved_filters", "post": "save_filter"}),
        name="report-asset-saved-filters",
    ),
    re_path(
        r"^assets/balances/as-of/?$",
        AssetReportViewSet.as_view({"get": "balances_as_of"}),
        name="report-asset-balances-as-of",
    ),
    re_path(
        r"^assets/runs/(?P<run_id>[^/]+)/rows/(?P<row_id>[^/]+)/sources/?$",
        AssetReportViewSet.as_view({"get": "row_sources"}),
        name="report-asset-row-sources",
    ),
    re_path(
        r"^assets/runs/(?P<run_id>[^/]+)/rows/?$",
        AssetReportViewSet.as_view({"get": "run_rows"}),
        name="report-asset-run-rows",
    ),
    re_path(
        r"^assets/runs/(?P<run_id>[^/]+)/summary/?$",
        AssetReportViewSet.as_view({"get": "run_summary"}),
        name="report-asset-run-summary",
    ),
    re_path(
        r"^assets/runs/(?P<run_id>[^/]+)/validation/?$",
        AssetReportViewSet.as_view({"get": "run_validation"}),
        name="report-asset-run-validation",
    ),
    re_path(
        r"^assets/runs/(?P<run_id>[^/]+)/history/?$",
        AssetReportViewSet.as_view({"get": "run_history"}),
        name="report-asset-run-history",
    ),
    re_path(
        r"^assets/runs/(?P<run_id>[^/]+)/export/?$",
        AssetReportViewSet.as_view({"post": "run_export"}),
        name="report-asset-run-export",
    ),
    re_path(
        r"^assets/runs/(?P<run_id>[^/]+)/?$",
        AssetReportViewSet.as_view({"get": "run_details"}),
        name="report-asset-run-detail",
    ),
    re_path(
        r"^assets/(?P<report_code>[^/]+)/schema/?$",
        AssetReportViewSet.as_view({"get": "schema"}),
        name="report-asset-schema",
    ),
    re_path(
        r"^assets/(?P<report_code>[^/]+)/parameters/?$",
        AssetReportViewSet.as_view({"get": "parameters"}),
        name="report-asset-parameters",
    ),
    re_path(
        r"^assets/(?P<report_code>[^/]+)/query/?$",
        AssetReportViewSet.as_view({"post": "query_report"}),
        name="report-asset-query",
    ),
    # UC-RPT-15: Unified Print & Export Engine
    re_path(
        r"^export/preview/?$",
        UnifiedExportViewSet.as_view({"post": "preview"}),
        name="report-export-preview",
    ),
    re_path(
        r"^export/jobs/(?P<id>[^/]+)/artifacts/?$",
        UnifiedExportViewSet.as_view({"get": "job_artifacts"}),
        name="report-export-job-artifacts",
    ),
    re_path(
        r"^export/jobs/(?P<id>[^/]+)/cancel/?$",
        UnifiedExportViewSet.as_view({"post": "job_cancel"}),
        name="report-export-job-cancel",
    ),
    re_path(
        r"^export/jobs/(?P<id>[^/]+)/retry/?$",
        UnifiedExportViewSet.as_view({"post": "job_retry"}),
        name="report-export-job-retry",
    ),
    re_path(
        r"^export/jobs/(?P<id>[^/]+)/?$",
        UnifiedExportViewSet.as_view({"get": "job_detail"}),
        name="report-export-job-detail",
    ),
    re_path(
        r"^export/jobs/?$",
        UnifiedExportViewSet.as_view({"post": "create_job", "get": "list_jobs"}),
        name="report-export-jobs",
    ),
    re_path(
        r"^export/artifacts/(?P<id>[^/]+)/download-access/?$",
        UnifiedExportViewSet.as_view({"post": "download_access"}),
        name="report-export-download-access",
    ),
    re_path(
        r"^export/artifacts/(?P<id>[^/]+)/download/?$",
        UnifiedExportViewSet.as_view({"get": "download_artifact"}),
        name="report-export-download-artifact",
    ),
    re_path(
        r"^export/history/?$",
        UnifiedExportViewSet.as_view({"get": "history"}),
        name="report-export-history",
    ),
    re_path(
        r"^export/detail/?$",
        UnifiedExportViewSet.as_view({"post": "export_detail"}),
        name="report-export-detail",
    ),
    re_path(
        r"^(?P<report_code>[^/]+)/export-capabilities/?$",
        UnifiedExportViewSet.as_view({"get": "capabilities"}),
        name="report-export-capabilities",
    ),
    re_path(
        r"^(?P<report_code>[^/]+)/export-templates/?$",
        UnifiedExportViewSet.as_view({"get": "templates"}),
        name="report-export-templates",
    ),
    # UC-RPT-14: Universal Report Data Drill-Down & Lineage Engine
    re_path(
        r"^drilldown/open/?$",
        DrilldownViewSet.as_view({"post": "open_context"}),
        name="report-drilldown-open",
    ),
    re_path(
        r"^drilldown/nodes/query/?$",
        DrilldownViewSet.as_view({"post": "query_node"}),
        name="report-drilldown-node-query",
    ),
    re_path(
        r"^drilldown/(?P<context_id>[^/]+)/formula/?$",
        DrilldownViewSet.as_view({"get": "cell_formula"}),
        name="report-drilldown-formula",
    ),
    re_path(
        r"^drilldown/(?P<context_id>[^/]+)/summary/?$",
        DrilldownViewSet.as_view({"get": "cell_summary"}),
        name="report-drilldown-summary",
    ),
    re_path(
        r"^drilldown/(?P<context_id>[^/]+)/transactions/?$",
        DrilldownViewSet.as_view({"get": "cell_transactions"}),
        name="report-drilldown-transactions",
    ),
    re_path(
        r"^drilldown/(?P<context_id>[^/]+)/sources/(?P<source_id>[^/]+)/open/?$",
        DrilldownViewSet.as_view({"get": "open_source"}),
        name="report-drilldown-open-source",
    ),
    re_path(
        r"^drilldown/(?P<context_id>[^/]+)/sources/?$",
        DrilldownViewSet.as_view({"get": "cell_sources"}),
        name="report-drilldown-sources",
    ),
    re_path(
        r"^drilldown/(?P<context_id>[^/]+)/adjustments/?$",
        DrilldownViewSet.as_view({"get": "cell_adjustments"}),
        name="report-drilldown-adjustments",
    ),
    re_path(
        r"^drilldown/(?P<context_id>[^/]+)/validation/?$",
        DrilldownViewSet.as_view({"get": "cell_validation"}),
        name="report-drilldown-validation",
    ),
    re_path(
        r"^drilldown/(?P<context_id>[^/]+)/breadcrumbs/?$",
        DrilldownViewSet.as_view({"get": "cell_breadcrumbs"}),
        name="report-drilldown-breadcrumbs",
    ),
    re_path(
        r"^drilldown/through/?$",
        DrilldownViewSet.as_view({"post": "drill_through"}),
        name="report-drilldown-through",
    ),
    re_path(
        r"^(?P<report_code>[^/]+)/drilldown-capabilities/?$",
        DrilldownViewSet.as_view({"get": "capabilities"}),
        name="report-drilldown-capabilities",
    ),
    path("", include(router.urls)),
]
