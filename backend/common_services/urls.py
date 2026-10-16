from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .module_views import (
    ModuleCatalogListView,
    ModuleConfigUpdateView,
    ModuleDetailView,
    ModuleDisableView,
    ModuleEnableView,
    ModuleImpactView,
)
from .numbering_views import (
    GenerateDocumentNumberView,
    NumberingHistoryListView,
    NumberingRuleActivateView,
    NumberingRuleCopyView,
    NumberingRuleCountersView,
    NumberingRuleDeactivateView,
    NumberingRuleDetailView,
    NumberingRuleListView,
    NumberingRuleNewVersionView,
    NumberingRulePreviewView,
    ValidateManualNumberView,
)
from .period_views import (
    DeterminePeriodView,
    FiscalPeriodChangeStatusView,
    FiscalPeriodDetailView,
    FiscalPeriodListView,
    FiscalYearActivateView,
    FiscalYearCloseView,
    FiscalYearCopyView,
    FiscalYearDetailView,
    FiscalYearListView,
    FiscalYearPreviewPeriodsView,
)
from .policy_views import (
    AccountingPolicyActivateView,
    AccountingPolicyApproveView,
    AccountingPolicyCopyView,
    AccountingPolicyDetailView,
    AccountingPolicyImpactView,
    AccountingPolicyListView,
    AccountingPolicyNewVersionView,
    ResolveEffectivePolicyView,
)
from .views import (
    AIConversationViewSet, AIInteractionViewSet, ChangePasswordView, CompanyBootstrapView, CompanyDiscoveryView, CompanyJoinRequestAdminViewSet,
    CompanySettingView, CompanySetupCompleteView, ConfirmEmailView, DashboardView, GlobalSearchView, LoginView, LogoutView,
    MyCompaniesView, MyJoinRequestViewSet, NotificationViewSet, PasswordResetConfirmView, PasswordResetVerifyOTPView,
    GlobalSearchOpenView, PasswordResetRequestView, ProfileView, RegisterView, RegistrationEmailChangeView,
    ResendVerificationView, ScopeOptionsView, SwitchCompanyView, VerifyRegistrationView, WorkItemViewSet,
)


router = DefaultRouter(trailing_slash=True)
router.register("join-requests", MyJoinRequestViewSet, basename="my-join-request")
router.register("company-join-requests", CompanyJoinRequestAdminViewSet, basename="company-join-request")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("work-items", WorkItemViewSet, basename="work-item")
router.register("ai", AIInteractionViewSet, basename="ai-interaction")
router.register("ai-conversations", AIConversationViewSet, basename="ai-conversation")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="common-register"),
    path("auth/verify-registration/", VerifyRegistrationView.as_view(), name="common-verify-registration"),
    path("auth/verify-email/", VerifyRegistrationView.as_view(), name="common-verify-email"),
    path("auth/resend-verification/", ResendVerificationView.as_view(), name="common-resend-verification"),
    path("auth/change-registration-email/", RegistrationEmailChangeView.as_view(), name="common-change-registration-email"),
    path("auth/login/", LoginView.as_view(), name="common-login"),
    path("auth/logout/", LogoutView.as_view(), name="common-logout"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="common-change-password"),
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="common-password-reset-request"),
    path("auth/password-reset/verify-otp/", PasswordResetVerifyOTPView.as_view(), name="common-password-reset-verify-otp"),
    path("auth/password-reset/resend/", ResendVerificationView.as_view(), name="common-password-reset-resend"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="common-password-reset-confirm"),
    # Friendly aliases for clients using forgot/reset-password terminology.
    path("auth/forgot-password/", PasswordResetRequestView.as_view(), name="common-forgot-password"),
    path("auth/reset-password/", PasswordResetConfirmView.as_view(), name="common-reset-password"),
    path("profile/", ProfileView.as_view(), name="common-profile"),
    path("profile/confirm-email/", ConfirmEmailView.as_view(), name="common-confirm-email"),
    path("companies/create/", CompanyBootstrapView.as_view(), name="common-company-create"),
    path("companies/mine/", MyCompaniesView.as_view(), name="common-company-list"),
    path("companies/complete-setup/", CompanySetupCompleteView.as_view(), name="common-company-complete-setup"),
    path("companies/search/", CompanyDiscoveryView.as_view(), name="common-company-search"),
    path("companies/switch/", SwitchCompanyView.as_view(), name="common-company-switch"),
    path("scopes/switch/", SwitchCompanyView.as_view(), name="common-scope-switch"),
    path("scopes/", ScopeOptionsView.as_view(), name="common-scope-options"),
    path("settings/", CompanySettingView.as_view(), name="common-company-setting"),
    path("search/", GlobalSearchView.as_view(), name="common-global-search"),
    path("search/open/", GlobalSearchOpenView.as_view(), name="common-global-search-open"),
    path("dashboard/", DashboardView.as_view(), name="common-dashboard"),
    path("modules/", ModuleCatalogListView.as_view(), name="common-module-list"),
    path("modules/<str:module_code>/", ModuleDetailView.as_view(), name="common-module-detail"),
    path("modules/<str:module_code>/impact/", ModuleImpactView.as_view(), name="common-module-impact"),
    path("modules/<str:module_code>/enable/", ModuleEnableView.as_view(), name="common-module-enable"),
    path("modules/<str:module_code>/disable/", ModuleDisableView.as_view(), name="common-module-disable"),
    path("modules/<str:module_code>/config/", ModuleConfigUpdateView.as_view(), name="common-module-config-update"),
    path("numbering-rules/", NumberingRuleListView.as_view(), name="common-numbering-rule-list"),
    path("numbering-rules/preview/", NumberingRulePreviewView.as_view(), name="common-numbering-rule-preview"),
    path("numbering-rules/<uuid:pk>/", NumberingRuleDetailView.as_view(), name="common-numbering-rule-detail"),
    path("numbering-rules/<uuid:pk>/activate/", NumberingRuleActivateView.as_view(), name="common-numbering-rule-activate"),
    path("numbering-rules/<uuid:pk>/deactivate/", NumberingRuleDeactivateView.as_view(), name="common-numbering-rule-deactivate"),
    path("numbering-rules/<uuid:pk>/new-version/", NumberingRuleNewVersionView.as_view(), name="common-numbering-rule-new-version"),
    path("numbering-rules/<uuid:pk>/copy/", NumberingRuleCopyView.as_view(), name="common-numbering-rule-copy"),
    path("numbering-rules/<uuid:pk>/counters/", NumberingRuleCountersView.as_view(), name="common-numbering-rule-counters"),
    path("numbering-history/", NumberingHistoryListView.as_view(), name="common-numbering-history-list"),
    path("numbering/generate/", GenerateDocumentNumberView.as_view(), name="common-numbering-generate"),
    path("numbering/validate-manual/", ValidateManualNumberView.as_view(), name="common-numbering-validate-manual"),
    path("fiscal-years/", FiscalYearListView.as_view(), name="common-fiscal-year-list"),
    path("fiscal-years/preview-periods/", FiscalYearPreviewPeriodsView.as_view(), name="common-fiscal-year-preview-periods"),
    path("fiscal-years/<uuid:pk>/", FiscalYearDetailView.as_view(), name="common-fiscal-year-detail"),
    path("fiscal-years/<uuid:pk>/activate/", FiscalYearActivateView.as_view(), name="common-fiscal-year-activate"),
    path("fiscal-years/<uuid:pk>/close/", FiscalYearCloseView.as_view(), name="common-fiscal-year-close"),
    path("fiscal-years/<uuid:pk>/copy/", FiscalYearCopyView.as_view(), name="common-fiscal-year-copy"),
    path("fiscal-periods/", FiscalPeriodListView.as_view(), name="common-fiscal-period-list"),
    path("fiscal-periods/determine/", DeterminePeriodView.as_view(), name="common-fiscal-period-determine"),
    path("fiscal-periods/<uuid:pk>/", FiscalPeriodDetailView.as_view(), name="common-fiscal-period-detail"),
    path("fiscal-periods/<uuid:pk>/change-status/", FiscalPeriodChangeStatusView.as_view(), name="common-fiscal-period-change-status"),
    path("accounting-policies/", AccountingPolicyListView.as_view(), name="common-accounting-policy-list"),
    path("accounting-policies/resolve/", ResolveEffectivePolicyView.as_view(), name="common-accounting-policy-resolve"),
    path("accounting-policies/<uuid:pk>/", AccountingPolicyDetailView.as_view(), name="common-accounting-policy-detail"),
    path("accounting-policies/<uuid:pk>/impact/", AccountingPolicyImpactView.as_view(), name="common-accounting-policy-impact"),
    path("accounting-policies/<uuid:pk>/activate/", AccountingPolicyActivateView.as_view(), name="common-accounting-policy-activate"),
    path("accounting-policies/<uuid:pk>/approve/", AccountingPolicyApproveView.as_view(), name="common-accounting-policy-approve"),
    path("accounting-policies/<uuid:pk>/new-version/", AccountingPolicyNewVersionView.as_view(), name="common-accounting-policy-new-version"),
    path("accounting-policies/<uuid:pk>/copy/", AccountingPolicyCopyView.as_view(), name="common-accounting-policy-copy"),
    path("", include(router.urls)),
]
