from django.contrib import admin
from . import models
@admin.register(models.AccountProfile)
class ProfileAdmin(admin.ModelAdmin):list_display=("account","company","balance","integration_enabled");list_filter=("company","integration_enabled")
@admin.register(models.BankTransaction)
class TransactionAdmin(admin.ModelAdmin):list_display=("number","account","transaction_type","transaction_date","amount","status","integration_status","gl_status");list_filter=("status","transaction_type","integration_status","gl_status","company");search_fields=("number","bank_reference","counterparty_name")
@admin.register(models.BankTransfer)
class TransferAdmin(admin.ModelAdmin):list_display=("number","source_account","destination_account","source_amount","destination_amount","status");list_filter=("status","company")
@admin.register(models.StatementImport)
class StatementAdmin(admin.ModelAdmin):list_display=("account","source","source_reference","period_from","period_to","created_at");list_filter=("source","company")
@admin.register(models.StatementLine)
class LineAdmin(admin.ModelAdmin):list_display=("statement","transaction_date","direction","amount","reference","match_status");list_filter=("direction","match_status")
admin.site.register(models.Reconciliation);admin.site.register(models.IntegrationRequest);admin.site.register(models.FxRevaluation);admin.site.register(models.ApprovalDecision)
