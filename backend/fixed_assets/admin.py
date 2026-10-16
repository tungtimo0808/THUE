from django.contrib import admin

from . import models


@admin.register(models.AssetRecord)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "company", "asset_type", "category", "original_cost", "status")
    list_filter = ("asset_type", "status", "category")
    search_fields = ("code", "name", "serial_number", "source_reference")


@admin.register(models.AssetTransaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("number", "asset", "transaction_type", "transaction_date", "amount", "status", "gl_status")
    list_filter = ("transaction_type", "status", "gl_status")
    search_fields = ("number", "asset__code", "source_reference", "reason")


class CalculationLineInline(admin.TabularInline):
    model = models.CalculationLine
    extra = 0
    readonly_fields = ("asset", "opening_value", "amount", "closing_value", "transaction")


@admin.register(models.CalculationRun)
class CalculationRunAdmin(admin.ModelAdmin):
    list_display = ("number", "company", "calculation_type", "period_code", "total_amount", "status")
    inlines = (CalculationLineInline,)


for model in (models.AssetCategory, models.AssetPeriod, models.ApprovalDecision):
    admin.site.register(model)

