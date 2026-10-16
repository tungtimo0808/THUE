from django.contrib import admin

from . import models


class TransactionLineInline(admin.TabularInline):
    model = models.InventoryTransactionLine
    extra = 0


@admin.register(models.InventoryTransaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("number", "company", "transaction_type", "transaction_date", "status", "total_value", "gl_status")
    list_filter = ("transaction_type", "status", "gl_status")
    search_fields = ("number", "source_reference", "reason")
    inlines = (TransactionLineInline,)


class CountLineInline(admin.TabularInline):
    model = models.StockCountLine
    extra = 0


@admin.register(models.StockCount)
class StockCountAdmin(admin.ModelAdmin):
    list_display = ("number", "company", "warehouse", "count_date", "status")
    inlines = (CountLineInline,)


class AssemblyLineInline(admin.TabularInline):
    model = models.AssemblyLine
    extra = 0


@admin.register(models.AssemblyOrder)
class AssemblyAdmin(admin.ModelAdmin):
    list_display = ("number", "company", "warehouse", "assembly_date", "operation", "status")
    inlines = (AssemblyLineInline,)


for model in (
    models.InventoryPolicy, models.InventoryPeriod, models.LotSerial, models.StockBalance,
    models.StockMovement, models.ValuationRun, models.ApprovalDecision,
):
    admin.site.register(model)

