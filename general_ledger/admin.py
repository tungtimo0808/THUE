from django.contrib import admin

from . import models
from .models import Account, AccountClass, ChartOfAccounts

admin.site.register(AccountClass)
admin.site.register(ChartOfAccounts)
admin.site.register(Account)


class JournalLineInline(admin.TabularInline):
    model = models.JournalLine
    extra = 0


@admin.register(models.JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ("number", "company", "period", "posting_date", "entry_type", "total_debit", "total_credit", "status")
    list_filter = ("entry_type", "status", "period")
    search_fields = ("number", "description", "source_event_id")
    inlines = (JournalLineInline,)


for model in (
    models.AccountingPeriod, models.BudgetLine, models.JournalApproval, models.AccountBalance,
    models.AllocationRule, models.AllocationDestination, models.AllocationRun,
    models.ClosingRule, models.ClosingRun, models.GlReconciliation,
):
    admin.site.register(model)
