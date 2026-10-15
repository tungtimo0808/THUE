from django.contrib import admin
from . import models
@admin.register(models.CashFund)
class FundAdmin(admin.ModelAdmin):list_display=("code","name","company","branch","currency","balance","status");list_filter=("status","company","currency");search_fields=("code","name")
@admin.register(models.CashTransaction)
class TransactionAdmin(admin.ModelAdmin):list_display=("number","fund","transaction_type","transaction_date","amount","status","gl_status");list_filter=("status","transaction_type","gl_status","company");search_fields=("number","payer_payee","description")
@admin.register(models.CashTransfer)
class TransferAdmin(admin.ModelAdmin):list_display=("number","transfer_type","source_fund","destination_fund","amount","status");list_filter=("status","transfer_type","company")
@admin.register(models.CashAdvance)
class AdvanceAdmin(admin.ModelAdmin):list_display=("number","recipient","fund","amount","settled_amount","status");list_filter=("status","company")
@admin.register(models.CashCount)
class CountAdmin(admin.ModelAdmin):list_display=("number","fund","counted_at","book_balance","actual_balance","difference","status");list_filter=("status","company")
admin.site.register(models.AdvanceSettlement);admin.site.register(models.FxRevaluation);admin.site.register(models.ApprovalDecision)
