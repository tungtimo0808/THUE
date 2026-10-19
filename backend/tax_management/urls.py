from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("invoices", views.InvoiceViewSet, basename="tax-invoice")
router.register("document-links", views.DocumentLinkViewSet, basename="tax-document-link")
router.register("periods", views.PeriodViewSet, basename="tax-period")
router.register("summaries", views.SummaryViewSet, basename="tax-summary")
router.register("filings", views.FilingViewSet, basename="tax-filing")
router.register("obligations", views.ObligationViewSet, basename="tax-obligation")
router.register("reconciliations", views.ReconciliationViewSet, basename="tax-reconciliation")
router.register("connectors", views.ConnectorViewSet, basename="tax-connector")
router.register("integrations", views.IntegrationViewSet, basename="tax-integration")
router.register("exports", views.ExportViewSet, basename="tax-export")

urlpatterns = [path("authority-settings/", views.TaxAuthoritySettingView.as_view(), name="tax-authority-settings")] + router.urls
