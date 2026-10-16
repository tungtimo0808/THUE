"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from common_services.views import LoginView, VerifyRegistrationView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Admin Panel
    path('admin/', admin.site.urls),

    # Friendly root auth aliases
    path('auth/verify-email/', VerifyRegistrationView.as_view(), name='root_verify_email'),
    path('auth/verify-registration/', VerifyRegistrationView.as_view(), name='root_verify_registration'),

    # JWT Authentication Endpoints
    path('api/token/', LoginView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/master-data/', include('master_data.urls')),
    path('api/v1/organization/', include('organization.urls')),
    path('api/v1/iam/', include('iam.urls')),
    path('api/v1/audit/', include('audit_log.urls')),
    path('api/v1/approval-workflows/', include('approval_workflows.urls')),
    path('api/v1/general-ledger/', include('general_ledger.urls')),
    path('api/v1/purchases/', include('purchases.urls')),
    path('api/v1/accounts-payable/', include('accounts_payable.urls')),
    path('api/v1/sales/', include('sales.urls')),
    path('api/v1/accounts-receivable/', include('accounts_receivable.urls')),
    path('api/v1/cash/', include('cash_management.urls')),
    path('api/v1/bank/', include('bank_management.urls')),
    path('api/v1/inventory/', include('inventory.urls')),
    path('api/v1/fixed-assets/', include('fixed_assets.urls')),
    path('api/v1/tax/', include('tax_management.urls')),
    path('api/v1/reports/', include('reporting.urls')),
    path('api/v1/common/', include('common_services.urls')),

    # OpenAPI / Swagger Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
