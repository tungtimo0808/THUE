"""
Django settings for config project.
"""

from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / '.env')

# Quick-start development settings - unsuitable for production
SECRET_KEY = os.getenv('SECRET_KEY', 'development-only-change-me')

DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = [host.strip() for host in os.getenv('ALLOWED_HOSTS', '*').split(',') if host.strip()]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',

    # Business modules
    'master_data',
    'organization',
    'iam',
    'audit_log',
    'approval_workflows',
    'general_ledger',
    'purchases',
    'accounts_payable',
    'sales',
    'accounts_receivable',
    'cash_management',
    'bank_management',
    'inventory',
    'fixed_assets',
    'tax_management',
    'reporting',
    'common_services',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # CorsMiddleware must be at the top
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/6.1/ref/settings/#databases

if os.getenv('DB_ENGINE', 'sqlite').lower() in {'postgres', 'postgresql'}:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'thue_erp'),
            'USER': os.getenv('DB_USER', 'thue_erp'),
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST': os.getenv('DB_HOST', '127.0.0.1'),
            'PORT': os.getenv('DB_PORT', '5432'),
            'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', '60')),
            'CONN_HEALTH_CHECKS': True,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'OPTIONS': {
                'timeout': 60,
            },
            'TEST': {
                'NAME': BASE_DIR / 'test_db.sqlite3',
            },
        }
    }


# Password validation
# https://docs.djangoproject.com/en/6.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.1/topics/i18n/

LANGUAGE_CODE = 'vi'

TIME_ZONE = 'Asia/Ho_Chi_Minh'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.1/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

COMPANY_LOGO_MAX_BYTES = int(os.getenv('COMPANY_LOGO_MAX_BYTES', str(5 * 1024 * 1024)))
COMPANY_LOGO_ALLOWED_EXTENSIONS = tuple(
    item.strip().lower()
    for item in os.getenv('COMPANY_LOGO_ALLOWED_EXTENSIONS', 'jpg,jpeg,png').split(',')
    if item.strip()
)
COMPANY_LOGO_MAX_WIDTH = int(os.getenv('COMPANY_LOGO_MAX_WIDTH', '2048'))
COMPANY_LOGO_MAX_HEIGHT = int(os.getenv('COMPANY_LOGO_MAX_HEIGHT', '2048'))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Django REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'common_services.authentication.RevocableJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'common_services.schema.ResourceGroupedAutoSchema',
}

EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.locmem.EmailBackend')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'no-reply@example.local')
COMMON_REQUIRE_VERIFICATION = os.getenv('COMMON_REQUIRE_VERIFICATION', 'True') == 'True'
COMMON_VERIFICATION_MINUTES = int(os.getenv('COMMON_VERIFICATION_MINUTES', '5'))
COMMON_OTP_RESEND_SECONDS = int(os.getenv('COMMON_OTP_RESEND_SECONDS', '60'))
COMMON_MAX_LOGIN_ATTEMPTS = int(os.getenv('COMMON_MAX_LOGIN_ATTEMPTS', '5'))
COMMON_LOCK_MINUTES = int(os.getenv('COMMON_LOCK_MINUTES', '15'))
COMMON_AI_PROVIDER_URL = os.getenv('COMMON_AI_PROVIDER_URL', '')
COMMON_AI_PROVIDER_API_KEY = os.getenv('COMMON_AI_PROVIDER_API_KEY', '')
COMMON_AI_TIMEOUT_SECONDS = int(os.getenv('COMMON_AI_TIMEOUT_SECONDS', '20'))

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'TOKEN_REFRESH_SERIALIZER': 'common_services.authentication.RevocableTokenRefreshSerializer',
}


# Swagger / OpenAPI Settings (drf-spectacular)
SPECTACULAR_SETTINGS = {
    'TITLE': 'Django Backend API',
    'DESCRIPTION': 'Tài liệu API dự án Django Backend',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'ENUM_NAME_OVERRIDES': {
        'CompanyStatusEnum': 'organization.models.CompanyStatus.choices',
        'ActiveStatusEnum': 'iam.models.ActiveStatus.choices',
        'RoleStatusEnum': 'iam.models.RoleStatus.choices',
        'RoleTypeEnum': 'iam.models.RoleType.choices',
        'PurchaseDocumentStatusEnum': 'purchases.models.DocumentStatus.choices',
        'PurchaseReceiptStatusEnum': 'purchases.models.ReceiptStatus.choices',
        'ApDocumentStatusEnum': 'accounts_payable.models.DocumentStatus.choices',
        'PayableStatusEnum': 'accounts_payable.models.PayableStatus.choices',
        'ApPaymentMethodEnum': 'accounts_payable.models.PaymentMethod.choices',
        'ApPaymentStatusEnum': 'accounts_payable.models.PaymentStatus.choices',
        'ApPostingStatusEnum': 'accounts_payable.models.PostingStatus.choices',
        'SalesDocumentStatusEnum': 'sales.models.DocumentStatus.choices',
        'SalesInvoiceRequestStatusEnum': 'sales.models.InvoiceRequestStatus.choices',
        'ReceivableStatusEnum': 'accounts_receivable.models.ReceivableStatus.choices',
        'ArCreditControlModeEnum': 'accounts_receivable.models.CreditControlMode.choices',
        'ArApprovalDecisionEnum': 'accounts_receivable.models.ApprovalDecisionType.choices',
        'CashTransactionStatusEnum': 'cash_management.models.TransactionStatus.choices',
        'CashGlStatusEnum': 'cash_management.models.GlStatus.choices',
        'CashTransferStatusEnum': 'cash_management.models.TransferStatus.choices',
        'CashAdvanceStatusEnum': 'cash_management.models.AdvanceStatus.choices',
        'CashCountStatusEnum': 'cash_management.models.CountStatus.choices',
        'CashFundStatusEnum': 'cash_management.models.FundStatus.choices',
        'BankTransactionStatusEnum': 'bank_management.models.TransactionStatus.choices',
        'BankMatchStatusEnum': 'bank_management.models.MatchStatus.choices',
        'InventoryTransactionStatusEnum': 'inventory.models.TransactionStatus.choices',
        'InventoryTransactionTypeEnum': 'inventory.models.TransactionType.choices',
        'InventoryValuationMethodEnum': 'inventory.models.ValuationMethod.choices',
        'FixedAssetTypeEnum': 'fixed_assets.models.AssetType.choices',
        'FixedAssetStatusEnum': 'fixed_assets.models.AssetStatus.choices',
        'FixedAssetTransactionTypeEnum': 'fixed_assets.models.TransactionType.choices',
        'FixedAssetDepreciationMethodEnum': 'fixed_assets.models.DepreciationMethod.choices',
        'FixedAssetGlStatusEnum': 'fixed_assets.models.GlStatus.choices',
        'FixedAssetApprovalDecisionEnum': 'fixed_assets.models.ApprovalDecisionType.choices',
        'AccountingPeriodStatusEnum': 'fixed_assets.models.PeriodStatus.choices',
        'TaxInvoiceDirectionEnum': 'tax_management.models.InvoiceDirection.choices',
        'TaxInvoiceStatusEnum': 'tax_management.models.InvoiceStatus.choices',
        'ExternalIntegrationStatusEnum': 'tax_management.models.IntegrationStatus.choices',
        'ProcessingRunStatusEnum': 'tax_management.models.RunStatus.choices',
    },
}


# CORS Settings
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True') == 'True'

CATALOG_IMPORT_MAX_BYTES = int(os.getenv('CATALOG_IMPORT_MAX_BYTES', str(5 * 1024 * 1024)))
CATALOG_IMPORT_MAX_ROWS = int(os.getenv('CATALOG_IMPORT_MAX_ROWS', '5000'))
CATALOG_IMPORT_BACKGROUND_ROWS = int(os.getenv('CATALOG_IMPORT_BACKGROUND_ROWS', '1000'))
