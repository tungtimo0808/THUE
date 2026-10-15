from django.contrib import admin

from . import models


class InvoiceLineInline(admin.TabularInline):
    model = models.TaxInvoiceLine
    extra = 0


class ValidationInline(admin.TabularInline):
    model = models.InvoiceValidation
    extra = 0
    readonly_fields = ("code", "severity", "message", "source", "checked_at")


@admin.register(models.TaxInvoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "invoice_series", "direction", "invoice_date", "seller_tax_code", "total_amount", "status")
    list_filter = ("direction", "invoice_type", "status", "source", "tax_eligible")
    search_fields = ("invoice_number", "invoice_series", "seller_tax_code", "buyer_tax_code", "seller_name", "buyer_name")
    inlines = (InvoiceLineInline, ValidationInline)


@admin.register(models.TaxFiling)
class FilingAdmin(admin.ModelAdmin):
    list_display = ("filing_type", "period", "version", "status", "submission_reference")
    list_filter = ("filing_type", "status")


@admin.register(models.TaxObligation)
class ObligationAdmin(admin.ModelAdmin):
    list_display = ("tax_type", "period", "assessed_amount", "paid_amount", "status", "due_date")
    list_filter = ("tax_type", "status")


for model in (
    models.TaxPeriod, models.InvoiceStatusHistory, models.InvoiceDocumentLink, models.TaxSummary,
    models.TaxPaymentLink, models.ReconciliationRun, models.ConnectorConfig,
    models.IntegrationRequest, models.TaxExport,
):
    admin.site.register(model)

