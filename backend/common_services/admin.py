from django.contrib import admin

from .models import (
    AccountingPolicy,
    AIFeedback, AIConversation, AIInteraction, CompanyInvitation, CompanyJoinRequest,
    CompanyModuleConfig, CoreCompanySetting, DocumentNumberHistory, DocumentNumberingRule,
    FiscalPeriod, FiscalYear,
    ModuleCatalog, Notification, NumberingSequenceTracker, UserLoginSession, UserPreference, UserSessionState,
    VerificationChallenge, WorkItem, WorkItemHistory,
)


admin.site.register(AccountingPolicy)
admin.site.register(CoreCompanySetting)
admin.site.register(ModuleCatalog)
admin.site.register(CompanyModuleConfig)
admin.site.register(DocumentNumberingRule)
admin.site.register(NumberingSequenceTracker)
admin.site.register(DocumentNumberHistory)
admin.site.register(FiscalYear)
admin.site.register(FiscalPeriod)
admin.site.register(CompanyJoinRequest)
admin.site.register(CompanyInvitation)
admin.site.register(UserPreference)
admin.site.register(UserSessionState)
admin.site.register(UserLoginSession)
admin.site.register(Notification)
admin.site.register(AIInteraction)
admin.site.register(AIConversation)
admin.site.register(AIFeedback)
admin.site.register(WorkItem)
admin.site.register(WorkItemHistory)


@admin.register(VerificationChallenge)
class VerificationChallengeAdmin(admin.ModelAdmin):
    list_display = ("identifier", "purpose", "expires_at", "consumed_at", "attempts", "created_at")
    readonly_fields = ("code_hash",)
