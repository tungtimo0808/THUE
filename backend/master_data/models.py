import re
import uuid
from datetime import date
from decimal import Decimal
from django.utils import timezone

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class Currency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=100)
    numeric_code = models.CharField(max_length=3, blank=True)
    decimal_places = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mdm_currency"
        ordering = ("code",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(decimal_places__lte=8),
                name="ck_currency_decimal_places",
            )
        ]

    def save(self, *args, **kwargs):
        self.code = self.code.upper().strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.name}"


class CatalogStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Đang hoạt động"
    INACTIVE = "INACTIVE", "Ngừng hoạt động"


def default_item_category_types():
    return ["MATERIAL", "GOODS", "FINISHED_GOOD", "SERVICE"]


def item_category_max_depth(company_id):
    from common_services.models import CoreCompanySetting
    config = CoreCompanySetting.objects.filter(company_id=company_id).values_list("configuration", flat=True).first() or {}
    try:
        return min(32, max(1, int(config.get("item_category_max_depth", 8))))
    except (TypeError, ValueError):
        return 8


class CatalogImportBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="catalog_import_batches")
    target = models.CharField(max_length=50)
    file_name = models.CharField(max_length=255)
    source_file = models.BinaryField()
    template_version = models.PositiveIntegerField(default=1)
    duplicate_mode = models.CharField(max_length=20, default="ERROR")
    error_mode = models.CharField(max_length=20, default="ATOMIC")
    column_mapping = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default="UPLOADED")
    total_rows = models.PositiveIntegerField(default=0)
    valid_rows = models.PositiveIntegerField(default=0)
    error_rows = models.PositiveIntegerField(default=0)
    created_rows = models.PositiveIntegerField(default=0)
    updated_rows = models.PositiveIntegerField(default=0)
    skipped_rows = models.PositiveIntegerField(default=0)
    source_hash = models.CharField(max_length=64)
    preview_hash = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "mdm_catalog_import_batch"
        ordering = ("-started_at",)


class CatalogImportRow(models.Model):
    batch = models.ForeignKey(CatalogImportBatch, on_delete=models.CASCADE, related_name="rows")
    source_row = models.PositiveIntegerField()
    source_data = models.JSONField(default=dict)
    mapped_data = models.JSONField(default=dict)
    action = models.CharField(max_length=20, blank=True)
    result = models.CharField(max_length=20, default="PENDING")
    errors = models.JSONField(default=dict)
    record_id = models.CharField(max_length=64, blank=True)
    record_version = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "mdm_catalog_import_row"
        constraints = [models.UniqueConstraint(fields=("batch", "source_row"), name="uq_catalog_import_source_row")]
        ordering = ("source_row",)


class CatalogExportBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="catalog_export_batches")
    target = models.CharField(max_length=50)
    export_scope = models.CharField(max_length=20, default="ALL")
    filter_params = models.JSONField(default=dict, blank=True)
    selected_ids = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, default="PENDING")
    total_records = models.PositiveIntegerField(default=0)
    file_name = models.CharField(max_length=255, blank=True)
    file_data = models.BinaryField(null=True, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=100, default="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    error_message = models.TextField(blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "mdm_catalog_export_batch"
        ordering = ("-started_at",)


class ExchangeRateType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="exchange_rate_types")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_exchange_rate_type"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_exchange_rate_type")]


class Bank(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=255)
    swift_code = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_bank"
        ordering = ("code",)


class ExchangeRate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="exchange_rates")
    rate_type = models.ForeignKey(ExchangeRateType, on_delete=models.PROTECT, related_name="rates")
    from_currency = models.ForeignKey(Currency, on_delete=models.PROTECT, related_name="rates_from")
    to_currency = models.ForeignKey(Currency, on_delete=models.PROTECT, related_name="rates_to")
    effective_date = models.DateField()
    rate = models.DecimalField(max_digits=20, decimal_places=8)
    source_bank = models.ForeignKey(Bank, on_delete=models.PROTECT, null=True, blank=True, related_name="exchange_rates")
    source_description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "mdm_exchange_rate"
        constraints = [
            models.UniqueConstraint(fields=("company", "rate_type", "from_currency", "to_currency", "effective_date"), name="uq_exchange_rate"),
            models.CheckConstraint(condition=Q(rate__gt=0), name="ck_exchange_rate_positive"),
        ]

    def clean(self):
        if self.from_currency_id == self.to_currency_id:
            raise ValidationError({"to_currency": "Hai loại tiền phải khác nhau."})
        if self.rate_type_id and self.rate_type.company_id != self.company_id:
            raise ValidationError({"rate_type": "Loại tỷ giá phải thuộc cùng doanh nghiệp."})


class PaymentTerm(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="payment_terms")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=150)
    due_days = models.PositiveIntegerField(default=0)
    due_mode = models.CharField(max_length=10, choices=(("DAYS", "Days"), ("MONTHLY", "Monthly")), default="DAYS")
    due_day_of_month = models.PositiveSmallIntegerField(null=True, blank=True)
    due_after_months = models.PositiveSmallIntegerField(default=0)
    discount_days = models.PositiveIntegerField(null=True, blank=True)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    scope = models.CharField(max_length=10, choices=(("PURCHASE", "Purchase"), ("SALE", "Sale"), ("BOTH", "Both")), default="BOTH")
    due_base = models.CharField(max_length=20, choices=(("DOCUMENT", "Document date"), ("INVOICE", "Invoice date"), ("DELIVERY", "Delivery date"), ("ACCEPTANCE", "Acceptance date")), default="DOCUMENT")
    has_discount = models.BooleanField(default=False)
    default_purchase = models.BooleanField(default=False)
    default_sale = models.BooleanField(default=False)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mdm_payment_term"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_payment_term"),
            models.UniqueConstraint(models.functions.Upper("code"), "company", name="uq_payment_term_code_ci"),
            models.CheckConstraint(condition=Q(effective_to__isnull=True) | Q(effective_from__isnull=True) | Q(effective_to__gte=models.F("effective_from")), name="ck_payment_term_effective_dates"),
            models.CheckConstraint(condition=Q(discount_rate__isnull=True) | Q(discount_rate__gte=0, discount_rate__lte=100), name="ck_payment_term_discount_rate"),
        ]

    def clean(self):
        self.code = (self.code or "").strip().upper()
        self.name = (self.name or "").strip()
        errors = {}
        if not self.code:
            errors["code"] = "Code is required."
        if not self.name:
            errors["name"] = "Name is required."
        if not self.scope:
            errors["scope"] = "Scope is required."
        if not self.due_base:
            errors["due_base"] = "Due-date base is required."
        if self.due_days is None or self.due_days < 0:
            errors["due_days"] = "Credit days must be nonnegative."
        if self.due_mode == "MONTHLY":
            if not self.due_day_of_month or not 1 <= self.due_day_of_month <= 31:
                errors["due_day_of_month"] = "Monthly due day must be between 1 and 31."
        elif self.due_mode != "DAYS":
            errors["due_mode"] = "Invalid due-date mode."
        if self.has_discount:
            if self.discount_days is None or self.discount_days < 0:
                errors["discount_days"] = "Discount days must be nonnegative."
            elif self.due_mode == "DAYS" and self.due_days is not None and self.discount_days > self.due_days:
                errors["discount_days"] = "Discount days cannot exceed credit days."
            if self.discount_rate is None or not 0 <= self.discount_rate <= 100:
                errors["discount_rate"] = "Discount rate must be between 0 and 100."
        elif self.discount_days is not None or self.discount_rate is not None:
            errors["has_discount"] = "Clear discount fields when discount is disabled."
        if self.effective_from and self.effective_to and self.effective_to < self.effective_from:
            errors["effective_to"] = "End date must not precede start date."
        if self.default_purchase and self.scope == "SALE":
            errors["default_purchase"] = "Purchase default requires purchase scope."
        if self.default_sale and self.scope == "PURCHASE":
            errors["default_sale"] = "Sale default requires sale scope."
        if self.default_purchase or self.default_sale:
            today = timezone.localdate()
            if self.status != "ACTIVE" or (self.effective_from and self.effective_from > today) or (self.effective_to and self.effective_to < today):
                errors["status"] = "A default term must be active and effective today."
        if self.company_id and self.code:
            qs = PaymentTerm.objects.filter(company_id=self.company_id, code__iexact=self.code)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                errors["code"] = "Code already exists for this company."
        if errors:
            raise ValidationError(errors)

    def is_available(self, on_date, scope):
        return (self.status == "ACTIVE" and self.scope in (scope, "BOTH")
                and (self.effective_from is None or self.effective_from <= on_date)
                and (self.effective_to is None or self.effective_to >= on_date))


class PaymentMethod(models.Model):
    GROUPS = (("CASH", "Cash"), ("BANK", "Bank transfer"), ("CARD", "Card"),
              ("WALLET", "Wallet or gateway"), ("CHEQUE", "Cheque"),
              ("NETTING", "Debt netting"), ("OTHER", "Other"))
    SCOPES = (("RECEIPT", "Receipt"), ("PAYMENT", "Payment"), ("BOTH", "Both"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="payment_methods")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=150)
    group = models.CharField(max_length=15, choices=GROUPS)
    scope = models.CharField(max_length=10, choices=SCOPES)
    default_cash_fund = models.ForeignKey("cash_management.CashFund", on_delete=models.PROTECT, null=True, blank=True, related_name="payment_methods")
    default_bank_account = models.ForeignKey("master_data.CompanyBankAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="payment_methods")
    requires_reference = models.BooleanField(default=False)
    requires_bank_account = models.BooleanField(default=False)
    supports_auto_reconcile = models.BooleanField(default=False)
    integration_channel = models.CharField(max_length=100, blank=True)
    default_receipt = models.BooleanField(default=False)
    default_payment = models.BooleanField(default=False)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mdm_payment_method"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_payment_method_code"),
            models.UniqueConstraint(models.functions.Upper("code"), "company", name="uq_payment_method_code_ci"),
            models.CheckConstraint(condition=Q(effective_to__isnull=True) | Q(effective_from__isnull=True) | Q(effective_to__gte=models.F("effective_from")), name="ck_payment_method_dates"),
        ]

    def clean(self):
        self.code = (self.code or "").strip().upper()
        self.name = (self.name or "").strip()
        errors = {}
        if not self.code:
            errors["code"] = "Code is required."
        if not self.name:
            errors["name"] = "Name is required."
        if not self.group:
            errors["group"] = "Group is required."
        if not self.scope:
            errors["scope"] = "Scope is required."
        if self.company_id and self.code:
            existing = PaymentMethod.objects.filter(company_id=self.company_id, code__iexact=self.code)
            if self.pk:
                existing = existing.exclude(pk=self.pk)
            if existing.exists():
                errors["code"] = "Code already exists for this company."
        if self.effective_from and self.effective_to and self.effective_to < self.effective_from:
            errors["effective_to"] = "End date must not precede start date."
        if self.default_receipt and self.scope == "PAYMENT":
            errors["default_receipt"] = "Receipt default requires receipt scope."
        if self.default_payment and self.scope == "RECEIPT":
            errors["default_payment"] = "Payment default requires payment scope."
        if self.default_receipt or self.default_payment:
            today = timezone.localdate()
            if self.status != "ACTIVE" or (self.effective_from and self.effective_from > today) or (self.effective_to and self.effective_to < today):
                errors["status"] = "A default method must be active and effective today."
        if self.group == "CASH":
            if self.default_bank_account_id or self.requires_bank_account or self.integration_channel or self.supports_auto_reconcile:
                errors["group"] = "Cash methods cannot use bank or integration settings."
        elif self.default_cash_fund_id:
            errors["default_cash_fund"] = "Cash fund is only valid for cash methods."
        if self.group == "NETTING" and (self.default_bank_account_id or self.requires_bank_account or self.integration_channel or self.supports_auto_reconcile or self.requires_reference):
            errors["group"] = "Netting cannot require cash, bank or transaction references."
        if self.default_cash_fund_id:
            fund = self.default_cash_fund
            if fund.company_id != self.company_id or fund.status != "ACTIVE":
                errors["default_cash_fund"] = "Cash fund must be active and belong to the company."
        if self.default_bank_account_id:
            account = self.default_bank_account
            if account.company_id != self.company_id or account.status != "ACTIVE":
                errors["default_bank_account"] = "Bank account must be active and belong to the company."
            elif (self.scope in ("RECEIPT", "BOTH") and not account.allow_receipt) or (self.scope in ("PAYMENT", "BOTH") and not account.allow_payment):
                errors["default_bank_account"] = "Bank account does not allow this payment direction."
        if self.integration_channel:
            account = self.default_bank_account if self.default_bank_account_id else None
            if self.group != "BANK" or not account or account.connection_status != "CONNECTED" or account.connection_provider != self.integration_channel or (account.auth_expires_at and account.auth_expires_at <= timezone.now()):
                errors["integration_channel"] = "A connected bank account with the matching provider is required."
        if self.supports_auto_reconcile and not self.integration_channel:
            errors["supports_auto_reconcile"] = "Automatic reconciliation requires a connected channel."
        if errors:
            raise ValidationError(errors)

    def is_available(self, on_date, scope):
        return (self.status == "ACTIVE" and self.scope in (scope, "BOTH")
                and (self.effective_from is None or self.effective_from <= on_date)
                and (self.effective_to is None or self.effective_to >= on_date))


class TaxType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, null=True, blank=True, related_name="catalog_tax_types")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, blank=True)
    scope = models.CharField(max_length=30)
    calculation_method = models.CharField(max_length=50)
    price_basis = models.CharField(max_length=20, blank=True)
    input_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="input_tax_types")
    output_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="output_tax_types")
    declaration_code = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=20, choices=(("SYSTEM", "System"), ("COMPANY", "Company"), ("POLICY", "Policy")), default="COMPANY")
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mdm_tax_type"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), condition=Q(company__isnull=False), name="uq_company_tax_type_code"),
            models.UniqueConstraint(fields=("code",), condition=Q(company__isnull=True), name="uq_system_tax_type_code"),
        ]

    def clean(self):
        errors = {}
        self.code = (self.code or "").strip().upper()
        self.name = (self.name or "").strip()
        if self.source == "COMPANY" and not self.company_id:
            errors["company"] = "Company tax types require a company."
        if self.source != "COMPANY" and self.company_id:
            errors["company"] = "System tax types must be global."
        if not self.code:
            errors["code"] = "Code is required."
        if not self.name:
            errors["name"] = "Name is required."
        if not self.scope:
            errors["scope"] = "Scope is required."
        if not self.calculation_method:
            errors["calculation_method"] = "Calculation method is required."
        for field in ("input_account", "output_account"):
            account = getattr(self, field)
            if account and (account.company_id != self.company_id or account.status != "ACTIVE" or not account.is_postable):
                errors[field] = "Account must be active, postable and belong to the company."
        if errors:
            raise ValidationError(errors)


class TaxRate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="tax_rates")
    code = models.CharField(max_length=30)
    tax_type = models.CharField(max_length=30)
    rate_percent = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    deductible = models.BooleanField(default=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    tax_type_ref = models.ForeignKey(TaxType, on_delete=models.PROTECT, null=True, blank=True, related_name="rates")
    name = models.CharField(max_length=255, blank=True)
    application_form = models.CharField(max_length=30, choices=(("PERCENT", "Percent"), ("NON_TAXABLE", "Non taxable"), ("NON_DECLARABLE", "Non declarable"), ("EXEMPT", "Exempt"), ("UNDETERMINED", "Undetermined")), default="PERCENT")
    business_scope = models.CharField(max_length=10, choices=(("INPUT", "Input"), ("OUTPUT", "Output"), ("BOTH", "Both")), default="BOTH")
    invoice_code = models.CharField(max_length=50, blank=True)
    declaration_code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mdm_tax_rate"
        constraints = [
            models.UniqueConstraint(fields=("company", "code", "effective_from"), name="uq_tax_rate_version"),
            models.CheckConstraint(condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")), name="ck_tax_rate_validity"),
        ]

    def clean(self):
        if not self.tax_type_ref_id:
            return
        errors = {}
        self.code = (self.code or "").strip().upper()
        self.name = (self.name or "").strip()
        tax_type = self.tax_type_ref
        if tax_type.company_id not in (None, self.company_id):
            errors["tax_type_ref"] = "Tax type belongs to another company."
        if not self.code:
            errors["code"] = "Code is required."
        if not self.name:
            errors["name"] = "Name is required."
        if self.application_form == "PERCENT":
            if self.rate_percent is None or not 0 <= self.rate_percent <= 100:
                errors["rate_percent"] = "Percent must be between 0 and 100."
        elif self.rate_percent is not None:
            errors["rate_percent"] = "Percent is only valid for the PERCENT form."
        if self.effective_to and self.effective_to < self.effective_from:
            errors["effective_to"] = "End date must not precede start date."
        if self.status == "ACTIVE" and self.effective_from:
            scopes = ("INPUT", "OUTPUT", "BOTH") if self.business_scope == "BOTH" else (self.business_scope, "BOTH")
            candidates = TaxRate.objects.filter(company_id=self.company_id, tax_type_ref_id=self.tax_type_ref_id, status="ACTIVE", business_scope__in=scopes)
            if self.pk:
                candidates = candidates.exclude(pk=self.pk)
            if candidates.filter(effective_from__lte=self.effective_to or date.max).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=self.effective_from)).exists():
                errors["effective_from"] = "Effective period overlaps another active rate for this scope."
        if errors:
            raise ValidationError(errors)


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="projects")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_project"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_project"),
            models.CheckConstraint(condition=Q(end_date__isnull=True) | Q(end_date__gte=models.F("start_date")), name="ck_project_dates"),
        ]


class CostCenter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="cost_centers")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_cost_center"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_cost_center")]

    def clean(self):
        _validate_tree(self, self.parent, self.company_id, "Trung tâm chi phí")


class ExpenseItemType(models.TextChoices):
    MATERIAL = "MATERIAL", "Chi phí nguyên vật liệu"
    LABOR = "LABOR", "Chi phí nhân công"
    GENERAL_PRODUCTION = "GENERAL_PRODUCTION", "Chi phí sản xuất chung"
    SELLING = "SELLING", "Chi phí bán hàng"
    ADMIN = "ADMIN", "Chi phí quản lý doanh nghiệp"
    FINANCIAL = "FINANCIAL", "Chi phí tài chính"
    OTHER = "OTHER", "Chi phí khác"


class ExpenseItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="expense_items")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    expense_type = models.CharField(max_length=50, blank=True, default="", choices=ExpenseItemType.choices)
    default_account = models.ForeignKey(
        "general_ledger.Account",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="default_expense_items",
    )
    applicable_scope = models.CharField(max_length=100, blank=True, default="")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="expense_items_created")
    updated_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="expense_items_updated")

    class Meta:
        db_table = "mdm_expense_item"
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_expense_item_company_code"),
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(start_date__isnull=True) | Q(end_date__gte=models.F("start_date")),
                name="ck_expense_item_dates",
            ),
        ]

    def clean(self):
        errors = {}
        if self.code:
            self.code = self.code.strip().upper()
            qs = ExpenseItem.objects.filter(company_id=self.company_id, code__iexact=self.code)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                errors["code"] = "Mã khoản mục chi phí đã tồn tại trong doanh nghiệp."
        else:
            errors["code"] = "Mã khoản mục chi phí là bắt buộc."

        if not self.name or not self.name.strip():
            errors["name"] = "Tên khoản mục chi phí là bắt buộc."
        else:
            self.name = self.name.strip()

        if self.parent_id:
            try:
                _validate_tree(self, self.parent, self.company_id, "Khoản mục chi phí")
            except ValidationError as exc:
                errors.update(exc.message_dict)
            if self.parent.status != CatalogStatus.ACTIVE:
                errors["parent"] = "Khoản mục cha không tồn tại hoặc đã ngừng sử dụng."

        if self.default_account_id:
            account = self.default_account
            if account.company_id != self.company_id:
                errors["default_account"] = "Tài khoản kế toán phải thuộc cùng doanh nghiệp."
            elif account.status != "ACTIVE":
                errors["default_account"] = "Tài khoản kế toán mặc định đã ngừng sử dụng."
            elif not account.is_postable:
                errors["default_account"] = "Tài khoản kế toán mặc định phải là tài khoản chi tiết cho phép hạch toán trực tiếp."

        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "Ngày kết thúc hiệu lực phải lớn hơn hoặc bằng ngày bắt đầu."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        if self.name:
            self.name = self.name.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.name}"


class StatisticalCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="statistical_codes")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    category = models.CharField(max_length=100, blank=True, default="")
    allow_voucher_selection = models.BooleanField(default=True)
    applicable_scope = models.CharField(max_length=100, blank=True, default="")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="statistical_codes_created")
    updated_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="statistical_codes_updated")

    class Meta:
        db_table = "mdm_statistical_code"
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_statistical_code_company_code"),
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(start_date__isnull=True) | Q(end_date__gte=models.F("start_date")),
                name="ck_statistical_code_dates",
            ),
        ]

    def clean(self):
        errors = {}
        if self.code:
            self.code = self.code.strip().upper()
            qs = StatisticalCode.objects.filter(company_id=self.company_id, code__iexact=self.code)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                errors["code"] = "Mã thống kê đã tồn tại trong doanh nghiệp."
        else:
            errors["code"] = "Mã thống kê là bắt buộc."

        if not self.name or not self.name.strip():
            errors["name"] = "Tên mã thống kê là bắt buộc."
        else:
            self.name = self.name.strip()

        if self.parent_id:
            try:
                _validate_tree(self, self.parent, self.company_id, "Mã thống kê")
            except ValidationError as exc:
                errors.update(exc.message_dict)
            if self.parent.status != CatalogStatus.ACTIVE:
                errors["parent"] = "Mã thống kê cha không tồn tại hoặc đã ngừng sử dụng."

        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "Ngày kết thúc hiệu lực phải lớn hơn hoặc bằng ngày bắt đầu."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        if self.name:
            self.name = self.name.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.name}"



class Party(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="parties")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    party_type = models.CharField(max_length=20, choices=(("ORGANIZATION", "Tổ chức"), ("INDIVIDUAL", "Cá nhân"), ("HOUSEHOLD_BUSINESS", "Hộ kinh doanh")), default="ORGANIZATION")
    legal_name = models.CharField(max_length=255, blank=True)
    short_name = models.CharField(max_length=100, blank=True)
    representative = models.CharField(max_length=255, blank=True)
    customer_group = models.CharField(max_length=100, blank=True)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="parties")
    owner = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="owned_parties")
    notes = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    tax_code = models.CharField(max_length=30, null=True, blank=True)
    identity_no = models.CharField(max_length=50, blank=True)
    default_currency = models.ForeignKey(Currency, on_delete=models.PROTECT, null=True, blank=True, related_name="parties")
    payment_term = models.ForeignKey(PaymentTerm, on_delete=models.PROTECT, null=True, blank=True, related_name="parties")
    status = models.CharField(
        max_length=20,
        choices=(
            ("DRAFT", "Nháp"),
            ("ACTIVE", "Đang hoạt động"),
            ("INACTIVE", "Ngừng sử dụng"),
            ("BLOCKED", "Khóa giao dịch"),
            ("MERGED", "Đã hợp nhất"),
        ),
        default="ACTIVE",
    )
    merged_into = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="merged_sources")
    merged_at = models.DateTimeField(null=True, blank=True)
    merged_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="merges_performed")
    lookup_source = models.CharField(max_length=50, blank=True)
    lookup_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mdm_party"
        ordering = ("company_id", "code")
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_party_company_code"),
            models.UniqueConstraint(fields=("company", "tax_code"), name="uq_party_company_tax_code"),
        ]

    def clean(self):
        if self.payment_term_id and self.payment_term.company_id != self.company_id:
            raise ValidationError({"payment_term": "Điều khoản thanh toán phải thuộc cùng doanh nghiệp."})
        if self.branch_id and self.branch.company_id != self.company_id:
            raise ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})
        if self.owner_id and not self.owner.memberships.filter(company_id=self.company_id, membership_status="ACTIVE").exists():
            raise ValidationError({"owner": "Người phụ trách phải là thành viên đang hoạt động của doanh nghiệp."})


class PartyRole(models.Model):
    party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="roles")
    role_type = models.CharField(max_length=30, choices=(("CUSTOMER", "Khách hàng"), ("VENDOR", "Nhà cung cấp")))
    active_from = models.DateField()
    active_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "mdm_party_role"
        constraints = [
            models.UniqueConstraint(fields=("party", "role_type"), name="pk_party_role"),
            models.CheckConstraint(condition=Q(active_to__isnull=True) | Q(active_to__gte=models.F("active_from")), name="ck_party_role_dates"),
        ]


class PartyAddress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="addresses")
    address_type = models.CharField(max_length=30)
    address_line = models.CharField(max_length=500)
    country_code = models.CharField(max_length=2, default="VN")
    province_code = models.CharField(max_length=20, blank=True)
    district_code = models.CharField(max_length=20, blank=True)
    ward_code = models.CharField(max_length=20, blank=True)
    is_default = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_party_address"
        constraints = [models.UniqueConstraint(fields=("party", "address_type"), condition=Q(is_default=True, status="ACTIVE"), name="uq_party_default_address_type")]


class PartyBankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="bank_accounts")
    bank = models.ForeignKey(Bank, on_delete=models.PROTECT, related_name="party_accounts")
    account_number = models.CharField(max_length=100)
    account_name = models.CharField(max_length=255)
    branch_name = models.CharField(max_length=255, blank=True)
    is_default = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_party_bank_account"
        constraints = [models.UniqueConstraint(fields=("party", "account_number"), name="uq_party_bank_account")]


class PartyContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="contacts")
    contact_type = models.CharField(max_length=30)
    contact_name = models.CharField(max_length=255)
    job_title = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_default = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_party_contact"
        constraints = [models.UniqueConstraint(fields=("party", "contact_type"), condition=Q(is_default=True, status="ACTIVE"), name="uq_party_default_contact_type")]


class ItemCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="item_categories")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="item_categories")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    applicable_types = models.JSONField(default=default_item_category_types)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    depth = models.PositiveSmallIntegerField(default=0)
    path = models.CharField(max_length=1000, blank=True)
    default_track_inventory = models.BooleanField(null=True, blank=True)
    default_revenue_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="revenue_item_categories")
    default_expense_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="expense_item_categories")
    default_inventory_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_item_categories")
    default_cogs_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="cogs_item_categories")
    default_purchase_tax_rate = models.ForeignKey(TaxRate, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_item_categories")
    default_sales_tax_rate = models.ForeignKey(TaxRate, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_item_categories")
    status = models.CharField(max_length=20, choices=(("ACTIVE", "Đang sử dụng"), ("INACTIVE", "Ngừng sử dụng"), ("ARCHIVED", "Lưu trữ")), default="ACTIVE")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "mdm_item_category"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_item_category")]

    def clean(self):
        _validate_tree(self, self.parent, self.company_id, "Nhóm hàng hóa")
        errors = {}
        allowed = {"MATERIAL", "GOODS", "FINISHED_GOOD", "SERVICE"}
        types = set(self.applicable_types) if isinstance(self.applicable_types, list) else set()
        if not isinstance(self.applicable_types, list) or not self.applicable_types or types - allowed or len(self.applicable_types) != len(types):
            errors["applicable_types"] = "Cần chọn ít nhất một loại hợp lệ."
        if self.branch_id and self.branch.company_id != self.company_id:
            errors["branch"] = "Chi nhánh phải thuộc cùng doanh nghiệp."
        if self.parent_id:
            if self.status == "ACTIVE" and self.parent.status != "ACTIVE":
                errors["parent"] = "Nhóm cha phải đang hoạt động."
            if types - set(self.parent.applicable_types):
                errors["applicable_types"] = "Loại áp dụng phải nằm trong phạm vi của nhóm cha."
            if self.parent.branch_id and self.branch_id != self.parent.branch_id:
                errors["branch"] = "Nhóm con phải thuộc cùng chi nhánh với nhóm cha."
        if types == {"SERVICE"} and self.default_track_inventory:
            errors["default_track_inventory"] = "Nhóm chỉ chứa dịch vụ không được theo dõi tồn kho."
        for field in ("default_revenue_account", "default_expense_account", "default_inventory_account", "default_cogs_account", "default_purchase_tax_rate", "default_sales_tax_rate"):
            related = getattr(self, field)
            if related and related.company_id != self.company_id:
                errors[field] = "Danh mục mặc định phải thuộc cùng doanh nghiệp."
            if related and related.status != "ACTIVE":
                errors[field] = "Danh mục mặc định đã ngừng sử dụng."
            if related and hasattr(related, "is_postable") and not related.is_postable:
                errors[field] = "Tài khoản phải được phép hạch toán."
            if isinstance(related, TaxRate):
                today = timezone.localdate()
                if related.effective_from > today or (related.effective_to and related.effective_to < today):
                    errors[field] = "Mã thuế không còn hiệu lực."
        level = 0
        ancestor = self.parent
        while ancestor:
            level += 1
            ancestor = ancestor.parent
            if level >= item_category_max_depth(self.company_id):
                errors["parent"] = "Cây nhóm vượt quá độ sâu tối đa được cấu hình."
                break
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.depth = self.parent.depth + 1 if self.parent_id else 0
        self.path = f"{self.parent.path}/{self.code}" if self.parent_id else self.code
        self.updated_at = timezone.now()
        if kwargs.get("update_fields") is not None:
            kwargs["update_fields"] = set(kwargs["update_fields"]) | {"depth", "path", "updated_at"}
        super().save(*args, **kwargs)


class UnitOfMeasure(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="units_of_measure")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=30, blank=True)
    measurement_type = models.CharField(max_length=20, choices=(("COUNT", "Đếm"), ("WEIGHT", "Khối lượng"), ("LENGTH", "Chiều dài"), ("AREA", "Diện tích"), ("VOLUME", "Thể tích"), ("TIME", "Thời gian"), ("SERVICE", "Dịch vụ"), ("CUSTOM", "Khác")), default="CUSTOM")
    decimal_places = models.PositiveSmallIntegerField(default=4)
    integer_only = models.BooleanField(default=False)
    is_reference = models.BooleanField(default=False)
    reference_uom = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="fixed_conversions")
    factor_to_reference = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=(("ACTIVE", "Đang sử dụng"), ("INACTIVE", "Ngừng sử dụng"), ("ARCHIVED", "Lưu trữ")), default="ACTIVE")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "mdm_unit_of_measure"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_uom"),
            models.UniqueConstraint(fields=("company", "measurement_type"), condition=Q(is_reference=True, status="ACTIVE"), name="uq_active_uom_reference_type"),
            models.UniqueConstraint(fields=("company", "measurement_type", "symbol"), condition=~Q(symbol="") & Q(status="ACTIVE"), name="uq_active_uom_symbol_type"),
        ]

    def clean(self):
        errors = {}
        from common_services.models import CoreCompanySetting
        config = CoreCompanySetting.objects.filter(company_id=self.company_id).values_list("configuration", flat=True).first() or {}
        try:
            max_decimals = min(8, max(0, int(config.get("uom_max_decimal_places", 4))))
        except (TypeError, ValueError):
            max_decimals = 4
        if self.decimal_places > max_decimals:
            errors["decimal_places"] = "Số chữ số thập phân vượt giới hạn cấu hình."
        if self.integer_only and self.decimal_places != 0:
            errors["decimal_places"] = "Đơn vị chỉ cho số nguyên phải có 0 chữ số thập phân."
        if self.is_reference:
            if self.reference_uom_id:
                errors["reference_uom"] = "Đơn vị tham chiếu không được quy đổi tiếp."
            if self.factor_to_reference != 1:
                errors["factor_to_reference"] = "Hệ số của đơn vị tham chiếu phải bằng 1."
        elif self.reference_uom_id or self.factor_to_reference is not None:
            if not self.reference_uom_id or self.factor_to_reference is None or self.factor_to_reference <= 0:
                errors["factor_to_reference"] = "Cần đơn vị tham chiếu và hệ số lớn hơn 0."
            elif self.reference_uom_id == self.pk or self.reference_uom.company_id != self.company_id or self.reference_uom.measurement_type != self.measurement_type or not self.reference_uom.is_reference or self.reference_uom.status != "ACTIVE":
                errors["reference_uom"] = "Đơn vị tham chiếu phải ACTIVE, cùng doanh nghiệp và nhóm đo lường."
        if self.status == "ACTIVE" and self.symbol and type(self).objects.filter(company_id=self.company_id, measurement_type=self.measurement_type, symbol__iexact=self.symbol, status="ACTIVE").exclude(pk=self.pk).exists():
            errors["symbol"] = "Ký hiệu đã được sử dụng trong nhóm đo lường."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        if kwargs.get("update_fields") is not None:
            kwargs["update_fields"] = set(kwargs["update_fields"]) | {"updated_at"}
        super().save(*args, **kwargs)


def fixed_uom_factor(from_uom, to_uom):
    """Return a stable physical conversion factor, never infer packaging COUNT ratios."""
    if from_uom.company_id != to_uom.company_id or from_uom.measurement_type != to_uom.measurement_type:
        return None
    if from_uom.measurement_type in {"COUNT", "SERVICE", "CUSTOM"}:
        return None
    from_ref = from_uom if from_uom.is_reference else from_uom.reference_uom
    to_ref = to_uom if to_uom.is_reference else to_uom.reference_uom
    if not from_ref or not to_ref or from_ref.pk != to_ref.pk:
        return None
    numerator = Decimal("1") if from_uom.is_reference else from_uom.factor_to_reference
    denominator = Decimal("1") if to_uom.is_reference else to_uom.factor_to_reference
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator


def validate_uom_quantity(uom, quantity):
    value = Decimal(str(quantity))
    if uom.status != "ACTIVE":
        raise ValidationError("Đơn vị tính đã ngừng sử dụng.")
    if uom.integer_only and value != value.to_integral_value():
        raise ValidationError("Đơn vị tính chỉ cho phép số lượng nguyên.")
    quantum = Decimal("1").scaleb(-uom.decimal_places)
    if value != value.quantize(quantum):
        raise ValidationError("Số lượng vượt độ chính xác của đơn vị tính.")


class Item(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="items")
    category = models.ForeignKey(ItemCategory, on_delete=models.PROTECT, null=True, blank=True, related_name="items")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="catalog_items")
    base_uom = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, null=True, blank=True, related_name="items")
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    alternate_name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    item_type = models.CharField(max_length=30, choices=(("MATERIAL", "Vật tư"), ("GOODS", "Hàng hóa"), ("FINISHED_GOOD", "Thành phẩm"), ("SERVICE", "Dịch vụ")))
    track_inventory = models.BooleanField(default=True)
    track_by_warehouse = models.BooleanField(default=True)
    track_lot = models.BooleanField(default=False)
    track_serial = models.BooleanField(default=False)
    track_expiry = models.BooleanField(default=False)
    expiry_warning_days = models.PositiveIntegerField(null=True, blank=True)
    min_stock = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    max_stock = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    valuation_method = models.CharField(max_length=30, blank=True)
    purchase_uom = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_items")
    sales_uom = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_items")
    allow_purchase = models.BooleanField(default=True)
    requires_service_acceptance = models.BooleanField(default=False)
    allow_sale = models.BooleanField(default=True)
    default_supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True, related_name="supplied_items")
    purchase_price = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    sales_price = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    purchase_tax_rate = models.ForeignKey(TaxRate, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_items")
    sales_tax_rate = models.ForeignKey(TaxRate, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_items")
    allow_discount = models.BooleanField(default=True)
    inventory_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_items")
    cogs_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="cogs_items")
    revenue_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="revenue_items")
    expense_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="expense_items")
    default_tax_rate = models.ForeignKey(TaxRate, on_delete=models.PROTECT, null=True, blank=True, related_name="items")
    status = models.CharField(max_length=20, choices=(("DRAFT", "Nháp"), ("ACTIVE", "Đang sử dụng"), ("INACTIVE", "Ngừng sử dụng"), ("ARCHIVED", "Lưu trữ")), default="ACTIVE")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mdm_item"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_item")]

    def clean(self):
        errors = {}
        from django.utils import timezone
        today = timezone.localdate()
        for field_name in ("category", "branch", "base_uom", "purchase_uom", "sales_uom", "default_tax_rate", "purchase_tax_rate", "sales_tax_rate", "default_supplier", "inventory_account", "cogs_account", "revenue_account", "expense_account"):
            related = getattr(self, field_name, None)
            if related and related.company_id != self.company_id:
                errors[field_name] = "Danh mục liên kết phải thuộc cùng doanh nghiệp."
            existing_category_id = type(self).objects.filter(pk=self.pk).values_list("category_id", flat=True).first() if self.pk and not self._state.adding and field_name == "category" else None
            grandfathered_category = field_name == "category" and existing_category_id == self.category_id and existing_category_id is not None
            if related and hasattr(related, "status") and related.status != "ACTIVE" and self.status == "ACTIVE" and not grandfathered_category:
                errors[field_name] = "Danh mục liên kết đã ngừng sử dụng."
            if related and isinstance(related, TaxRate) and self.status == "ACTIVE" and (related.effective_from > today or (related.effective_to and related.effective_to < today)):
                errors[field_name] = "Mã thuế chưa hoặc không còn hiệu lực."
        if self.category_id and self.item_type not in self.category.applicable_types:
            errors["category"] = "Nhóm không hỗ trợ loại đối tượng này."
        if self.category_id and self.category.branch_id and self.category.branch_id != self.branch_id:
            errors["category"] = "Nhóm không áp dụng cho chi nhánh của đối tượng."
        for field_name in ("purchase_price", "sales_price", "min_stock", "max_stock"):
            value = getattr(self, field_name)
            if value is not None and value < 0:
                errors[field_name] = "Giá trị không được âm."
        if self.min_stock is not None and self.max_stock is not None and self.max_stock < self.min_stock:
            errors["max_stock"] = "Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu."
        for field_name in ("inventory_account", "cogs_account", "revenue_account", "expense_account"):
            account = getattr(self, field_name, None)
            if account and not account.is_postable:
                errors[field_name] = "Tài khoản phải được phép hạch toán."
        if self.item_type == "SERVICE" and self.track_inventory:
            errors["track_inventory"] = "Dịch vụ không được theo dõi tồn kho."
        if not self.track_inventory and (self.track_lot or self.track_serial or self.track_expiry):
            errors["track_inventory"] = "Chỉ hàng theo dõi tồn kho mới được theo dõi lô/serial."
        if self.track_expiry and not self.track_lot:
            errors["track_expiry"] = "Theo dõi hạn sử dụng cần theo dõi lô."
        if self.status == "ACTIVE" and not self.base_uom_id:
            errors["base_uom"] = "Đơn vị cơ sở là bắt buộc."
        if errors:
            raise ValidationError(errors)


class ItemUomConversion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="uom_conversions")
    from_uom = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, related_name="conversions_from")
    to_uom = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, related_name="conversions_to")
    factor = models.DecimalField(max_digits=20, decimal_places=8)

    class Meta:
        db_table = "mdm_item_uom_conversion"
        constraints = [
            models.UniqueConstraint(fields=("item", "from_uom", "to_uom"), name="uq_item_uom_conversion"),
            models.CheckConstraint(condition=Q(factor__gt=0), name="ck_item_uom_factor"),
            models.CheckConstraint(condition=~Q(from_uom=models.F("to_uom")), name="ck_item_uom_distinct"),
        ]

    def clean(self):
        errors = {}
        if self.from_uom_id and self.from_uom.company_id != self.item.company_id:
            errors["from_uom"] = "Đơn vị tính phải thuộc cùng doanh nghiệp."
        if self.to_uom_id and self.to_uom.company_id != self.item.company_id:
            errors["to_uom"] = "Đơn vị tính phải thuộc cùng doanh nghiệp."
        if self.to_uom_id and self.item.base_uom_id and self.to_uom_id != self.item.base_uom_id:
            errors["to_uom"] = "Đơn vị quy đổi phải về đơn vị cơ sở."
        if self.from_uom_id and self.from_uom.status != "ACTIVE":
            errors["from_uom"] = "Đơn vị tính đã ngừng sử dụng."
        if self.to_uom_id and self.to_uom.status != "ACTIVE":
            errors["to_uom"] = "Đơn vị tính đã ngừng sử dụng."
        if errors:
            raise ValidationError(errors)


class ItemBarcode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="item_barcodes")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="barcodes")
    uom = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, related_name="item_barcodes")
    code = models.CharField(max_length=100)

    class Meta:
        db_table = "mdm_item_barcode"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_item_barcode_company_code")]

    def clean(self):
        errors = {}
        if self.uom_id and self.item_id:
            if self.company_id != self.item.company_id:
                errors["company"] = "Mã vạch phải thuộc doanh nghiệp của đối tượng."
            if self.uom.company_id != self.item.company_id or self.uom.status != "ACTIVE":
                errors["uom"] = "Đơn vị tính không hợp lệ."
            elif self.uom_id != self.item.base_uom_id and not self.item.uom_conversions.filter(from_uom_id=self.uom_id, to_uom_id=self.item.base_uom_id).exists():
                errors["uom"] = "Chưa có quy đổi về đơn vị cơ sở."
        if self.item_id and type(self).objects.filter(company=self.item.company, code=self.code).exclude(pk=self.pk).exists():
            errors["code"] = "Mã vạch đã được sử dụng trong doanh nghiệp."
        if errors:
            raise ValidationError(errors)


class Warehouse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="warehouses")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="warehouses")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=500, blank=True)
    keeper_employee = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="managed_warehouses")
    warehouse_type = models.CharField(max_length=20, choices=(("PHYSICAL", "Vật lý"), ("TRANSIT", "Trung chuyển"), ("CONSIGNMENT", "Ký gửi"), ("RETURN", "Hàng trả"), ("DAMAGED", "Hàng hỏng"), ("VIRTUAL", "Kho logic"), ("OTHER", "Khác"), ("LOGICAL", "Logic (cũ)")), default="PHYSICAL")
    warehouse_scope = models.CharField(max_length=20, choices=(("BRANCH", "Chi nhánh"), ("COMPANY_SHARED", "Dùng chung"), ("PROJECT", "Dự án"), ("TEMPORARY", "Tạm thời")), default="BRANCH")
    project = models.ForeignKey(Project, on_delete=models.PROTECT, null=True, blank=True, related_name="warehouses")
    keeper_user = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="managed_warehouses")
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    is_default = models.BooleanField(default=False)
    allow_receipt = models.BooleanField(default=True)
    allow_issue = models.BooleanField(default=True)
    allow_transfer = models.BooleanField(default=True)
    allow_negative = models.BooleanField(default=False)
    cost_center = models.ForeignKey(CostCenter, on_delete=models.PROTECT, null=True, blank=True, related_name="warehouses")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=(("DRAFT", "Nháp"), ("ACTIVE", "Hoạt động"), ("INACTIVE", "Ngừng"), ("ARCHIVED", "Lưu trữ")), default="ACTIVE")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "mdm_warehouse"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_warehouse")]

    def clean(self):
        errors = {}
        if self.warehouse_scope == "BRANCH" and not self.branch_id:
            errors["branch"] = "Kho chi nhánh phải chọn chi nhánh quản lý."
        if self.branch_id and self.branch.company_id != self.company_id:
            errors["branch"] = "Chi nhánh phải thuộc cùng doanh nghiệp."
        elif self.branch_id and self.status == "ACTIVE" and self.branch.status != "ACTIVE":
            errors["branch"] = "Chi nhánh quản lý phải đang hoạt động."
        if self.keeper_employee_id and self.keeper_employee.company_id != self.company_id:
            errors["keeper_employee"] = "Thủ kho phải thuộc cùng doanh nghiệp."
        elif self.keeper_employee_id and self.status == "ACTIVE" and self.keeper_employee.status != "ACTIVE":
            errors["keeper_employee"] = "Thủ kho phải đang hoạt động."
        if self.keeper_user_id and not self.keeper_user.memberships.filter(company_id=self.company_id, membership_status="ACTIVE").exists():
            errors["keeper_user"] = "User phụ trách phải là thành viên đang hoạt động của doanh nghiệp."
        if self.project_id and (self.project.company_id != self.company_id or self.project.status != "ACTIVE"):
            errors["project"] = "Dự án phải đang hoạt động và thuộc doanh nghiệp."
        if self.warehouse_scope == "PROJECT" and not self.project_id:
            errors["project"] = "Kho dự án phải chọn dự án."
        if self.warehouse_scope == "TEMPORARY" and not self.end_date:
            errors["end_date"] = "Kho tạm phải có ngày kết thúc."
        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "Ngày kết thúc phải từ ngày bắt đầu trở đi."
        if self.cost_center_id and (self.cost_center.company_id != self.company_id or self.cost_center.status != "ACTIVE"):
            errors["cost_center"] = "Trung tâm chi phí không hợp lệ hoặc đã ngừng."
        if self.status == "ACTIVE" and not (self.allow_receipt or self.allow_issue or self.allow_transfer):
            errors["status"] = "Kho hoạt động phải cho phép ít nhất một nghiệp vụ."
        if self.warehouse_type == "PHYSICAL":
            from common_services.models import CoreCompanySetting
            setting = CoreCompanySetting.objects.filter(company_id=self.company_id).first()
            if setting and setting.configuration.get("warehouse_physical_address_required", False) and not self.address.strip():
                errors["address"] = "Kho vật lý phải có địa chỉ."
        if self.is_default and self.status != "ACTIVE":
            errors["is_default"] = "Chỉ kho ACTIVE mới được đặt mặc định."
        if self.allow_negative:
            from common_services.models import CoreCompanySetting
            setting = CoreCompanySetting.objects.filter(company_id=self.company_id).first()
            if not (setting and setting.configuration.get("allow_negative_inventory", False)):
                errors["allow_negative"] = "Chính sách doanh nghiệp chưa cho phép tồn âm."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        if kwargs.get("update_fields") is not None:
            kwargs["update_fields"] = set(kwargs["update_fields"]) | {"updated_at"}
        super().save(*args, **kwargs)


class InventoryLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="locations")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    location_type = models.CharField(max_length=20, choices=(("AREA", "Khu vực"), ("ROW", "Dãy"), ("RACK", "Kệ"), ("BIN", "Ô"), ("OTHER", "Khác")), default="OTHER")
    can_store = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_inventory_location"
        constraints = [models.UniqueConstraint(fields=("warehouse", "code"), name="uq_inventory_location")]

    def clean(self):
        if self.parent_id:
            _validate_tree(self, self.parent, self.warehouse.company_id, "Vị trí kho", company_attr="warehouse.company_id")
            if self.parent.warehouse_id != self.warehouse_id:
                raise ValidationError({"parent": "Vị trí cha phải cùng kho."})


class BankAccountType(models.TextChoices):
    PAYMENT = "PAYMENT", "Tài khoản thanh toán"
    SAVINGS = "SAVINGS", "Tài khoản tiền gửi/tiết kiệm"
    LOAN = "LOAN", "Tài khoản vay"
    CREDIT = "CREDIT", "Tài khoản tín dụng"
    ESCROW = "ESCROW", "Tài khoản phong tỏa/bảo đảm"
    OTHER = "OTHER", "Loại khác"


class BankAccountScope(models.TextChoices):
    COMPANY_SHARED = "COMPANY_SHARED", "Dùng chung toàn doanh nghiệp"
    BRANCH = "BRANCH", "Chi nhánh"
    PURPOSE_SPECIFIC = "PURPOSE_SPECIFIC", "Mục đích riêng"
    PROJECT = "PROJECT", "Dự án"


class BankAccountStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    ACTIVE = "ACTIVE", "Đang hoạt động"
    INACTIVE = "INACTIVE", "Ngừng sử dụng"
    BLOCKED = "BLOCKED", "Tạm khóa"
    CLOSED = "CLOSED", "Đã đóng"
    ARCHIVED = "ARCHIVED", "Lưu trữ"


class BankConnectionStatus(models.TextChoices):
    NOT_CONNECTED = "NOT_CONNECTED", "Chưa kết nối"
    PENDING = "PENDING", "Đang thiết lập / chờ xác nhận"
    CONNECTED = "CONNECTED", "Kết nối đang hoạt động"
    EXPIRED = "EXPIRED", "Thông tin xác thực đã hết hạn"
    ERROR = "ERROR", "Kết nối đang có lỗi"
    DISCONNECTED = "DISCONNECTED", "Đã ngắt kết nối"


class CompanyBankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="bank_accounts")
    code = models.CharField(max_length=50, blank=True)
    account_number = models.CharField(max_length=100)
    account_name = models.CharField(max_length=255)
    bank = models.ForeignKey(Bank, on_delete=models.PROTECT, related_name="company_accounts")
    bank_branch = models.CharField(max_length=255, blank=True)
    account_type = models.CharField(max_length=30, choices=BankAccountType.choices, default=BankAccountType.PAYMENT)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, related_name="company_bank_accounts")
    swift_bic = models.CharField(max_length=30, blank=True)
    iban_routing_code = models.CharField(max_length=50, blank=True)
    account_scope = models.CharField(max_length=30, choices=BankAccountScope.choices, default=BankAccountScope.COMPANY_SHARED)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="company_bank_accounts")
    project = models.ForeignKey("master_data.Project", on_delete=models.PROTECT, null=True, blank=True, related_name="company_bank_accounts")
    gl_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="bank_accounts")
    cost_center = models.ForeignKey("master_data.CostCenter", on_delete=models.PROTECT, null=True, blank=True, related_name="company_bank_accounts")
    is_default = models.BooleanField(default=False)
    allow_receipt = models.BooleanField(default=True)
    allow_payment = models.BooleanField(default=True)
    opened_date = models.DateField(null=True, blank=True)
    closed_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=BankAccountStatus.choices, default=BankAccountStatus.ACTIVE)
    notes = models.TextField(blank=True)

    # Integration / Connection fields
    connection_provider = models.CharField(max_length=100, blank=True)
    connection_id = models.CharField(max_length=100, blank=True)
    connection_status = models.CharField(max_length=20, choices=BankConnectionStatus.choices, default=BankConnectionStatus.NOT_CONNECTED)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    sync_scope = models.CharField(max_length=100, blank=True, default="STATEMENT")
    auth_expires_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "mdm_company_bank_account"
        ordering = ("code", "account_number")
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_company_bank_account_code"),
            models.UniqueConstraint(fields=("company", "bank", "account_number", "currency"), name="uq_company_bank_account_num"),
        ]

    def clean(self):
        errors = {}
        if self.account_number:
            self.account_number = re.sub(r"\s+", "", str(self.account_number)).upper()
        if not self.code and self.account_number:
            self.code = f"TK-{self.account_number}"

        # BR-BANK-ACC-02, EF-04: Code unique within company
        if self.code and self.company_id:
            duplicate_code = CompanyBankAccount.objects.filter(company_id=self.company_id, code=self.code)
            if self.pk:
                duplicate_code = duplicate_code.exclude(pk=self.pk)
            if duplicate_code.exists():
                errors["code"] = "Mã tài khoản nội bộ đã tồn tại trong doanh nghiệp."

        # BR-BANK-ACC-04, BR-BANK-ACC-05, EF-05: Unique combination of (bank, account_number, currency) per company
        if self.company_id and self.bank_id and self.account_number and self.currency_id:
            duplicate_acc = CompanyBankAccount.objects.filter(
                company_id=self.company_id,
                bank_id=self.bank_id,
                account_number=self.account_number,
                currency_id=self.currency_id,
            )
            if self.pk:
                duplicate_acc = duplicate_acc.exclude(pk=self.pk)
            if duplicate_acc.exists():
                errors["account_number"] = "Số tài khoản đã tồn tại với cùng ngân hàng và đồng tiền trong doanh nghiệp."

        # BR-BANK-ACC-07, EF-06: Bank active
        if self.bank_id:
            bank_obj = getattr(self, "bank", None)
            if bank_obj and hasattr(bank_obj, "status") and bank_obj.status != "ACTIVE":
                errors["bank"] = "Ngân hàng không tồn tại hoặc đã ngừng sử dụng."

        # BR-BANK-ACC-08, EF-07: Currency active
        if self.currency_id:
            curr_obj = getattr(self, "currency", None)
            if curr_obj and hasattr(curr_obj, "is_active") and not curr_obj.is_active:
                errors["currency"] = "Đồng tiền không tồn tại hoặc bị ngừng."

        # BR-BANK-ACC-09, EF-08: Branch validation
        if self.account_scope == BankAccountScope.BRANCH:
            if not self.branch_id:
                errors["branch"] = "Tài khoản chi nhánh phải chọn chi nhánh quản lý."
            else:
                branch_obj = getattr(self, "branch", None)
                if branch_obj:
                    if branch_obj.company_id != self.company_id:
                        errors["branch"] = "Chi nhánh không thuộc doanh nghiệp."
                    elif hasattr(branch_obj, "status") and branch_obj.status != "ACTIVE":
                        errors["branch"] = "Chi nhánh phải đang hoạt động."
        elif self.branch_id:
            branch_obj = getattr(self, "branch", None)
            if branch_obj and branch_obj.company_id != self.company_id:
                errors["branch"] = "Chi nhánh không thuộc doanh nghiệp."

        # Project validation
        if self.project_id:
            proj_obj = getattr(self, "project", None)
            if proj_obj and proj_obj.company_id != self.company_id:
                errors["project"] = "Dự án không thuộc doanh nghiệp."

        # Cost center validation
        if self.cost_center_id:
            cc_obj = getattr(self, "cost_center", None)
            if cc_obj and cc_obj.company_id != self.company_id:
                errors["cost_center"] = "Trung tâm chi phí không thuộc doanh nghiệp."

        # BR-BANK-ACC-13, EF-10: ACTIVE account must allow at least receipt or payment
        if self.status == BankAccountStatus.ACTIVE and not (self.allow_receipt or self.allow_payment):
            errors["allow_receipt"] = "Tài khoản ACTIVE phải cho phép ít nhất một mục đích thu hoặc chi, hoặc lưu DRAFT."

        # BR-BANK-ACC-16, EF-09: GL account validation
        if self.status == BankAccountStatus.ACTIVE and not self.gl_account_id:
            errors["gl_account"] = "Tài khoản ACTIVE bắt buộc phải chọn tài khoản kế toán liên kết."
        if self.gl_account_id:
            gl_obj = getattr(self, "gl_account", None)
            if gl_obj:
                if gl_obj.company_id != self.company_id or not gl_obj.is_postable or getattr(gl_obj, "status", None) != "ACTIVE":
                    errors["gl_account"] = "Tài khoản kế toán phải đang hoạt động, cho phép hạch toán và thuộc cùng doanh nghiệp."

        # BR-BANK-ACC-32: Closed date validation
        if self.status == BankAccountStatus.CLOSED:
            if not self.closed_date:
                errors["closed_date"] = "Ngày đóng tài khoản là bắt buộc khi tài khoản đã đóng."
            elif self.opened_date and self.closed_date < self.opened_date:
                errors["closed_date"] = "Ngày đóng tài khoản không được nhỏ hơn ngày mở tài khoản."

        # EF-11: SWIFT / BIC format (8 or 11 alphanumeric characters)
        if self.swift_bic:
            swift = self.swift_bic.strip().upper()
            if not re.match(r"^[A-Z0-9]{8}([A-Z0-9]{3})?$", swift):
                errors["swift_bic"] = "SWIFT/BIC phải gồm đúng 8 hoặc 11 ký tự chữ hoặc số."
            self.swift_bic = swift

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.account_number:
            self.account_number = re.sub(r"\s+", "", str(self.account_number)).upper()
        if not self.code and self.account_number:
            self.code = f"TK-{self.account_number}"
        super().save(*args, **kwargs)


class DocumentType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module_code = models.CharField(max_length=30)
    code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=255)
    document_class = models.CharField(max_length=30)
    legal_form_code = models.CharField(max_length=50, blank=True)
    legal_basis = models.CharField(max_length=255, blank=True)
    supports_workflow = models.BooleanField(default=True)
    requires_posting = models.BooleanField(default=False)
    creates_inventory = models.BooleanField(default=False)
    creates_receivable = models.BooleanField(default=False)
    creates_payable = models.BooleanField(default=False)
    creates_tax_record = models.BooleanField(default=False)
    allows_manual_number = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_document_type"


class DocumentNumberingRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="numbering_rules")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="numbering_rules")
    document_type = models.ForeignKey(DocumentType, on_delete=models.PROTECT, related_name="numbering_rules")
    code = models.CharField(max_length=80)
    prefix = models.CharField(max_length=30, blank=True)
    suffix = models.CharField(max_length=30, blank=True)
    separator = models.CharField(max_length=10, blank=True)
    padding_length = models.PositiveSmallIntegerField(default=6)
    reset_policy = models.CharField(max_length=20, default="YEARLY")
    include_branch_code = models.BooleanField(default=False)
    include_fiscal_year = models.BooleanField(default=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_document_numbering_rule"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_numbering_rule_code"),
            models.CheckConstraint(condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")), name="ck_numbering_rule_validity"),
            models.CheckConstraint(condition=Q(padding_length__gt=0), name="ck_numbering_rule_padding"),
        ]

    def clean(self):
        if self.branch_id and self.branch.company_id != self.company_id:
            raise ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})


class CustomerProfile(models.Model):
    party = models.OneToOneField(Party, primary_key=True, on_delete=models.PROTECT, related_name="customer_profile")
    receivable_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="customer_receivable_profiles")
    revenue_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="customer_revenue_profiles")
    credit_limit = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    credit_days = models.PositiveIntegerField(null=True, blank=True)
    payment_method = models.CharField(max_length=30, blank=True)
    allow_over_limit = models.BooleanField(default=False)
    warn_overdue = models.BooleanField(default=True)
    price_list_code = models.CharField(max_length=80, blank=True)
    invoice_email = models.EmailField(blank=True)
    bank_account = models.ForeignKey("master_data.PartyBankAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="customer_profiles")
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_customer_profile"

    def clean(self):
        _validate_profile_accounts(self, ("receivable_account", "revenue_account"))
        if self.credit_limit is not None and self.credit_limit < 0:
            raise ValidationError({"credit_limit": "Hạn mức công nợ không được âm."})
        if self.credit_days is not None and self.credit_days < 0:
            raise ValidationError({"credit_days": "Số ngày thanh toán không được nhỏ hơn 0."})


class VendorProfile(models.Model):
    party = models.OneToOneField(Party, primary_key=True, on_delete=models.PROTECT, related_name="vendor_profile")
    payable_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="vendor_payable_profiles")
    expense_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="vendor_expense_profiles")
    purchase_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="vendor_purchase_profiles")
    payment_priority = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, choices=CatalogStatus.choices, default=CatalogStatus.ACTIVE)

    class Meta:
        db_table = "mdm_vendor_profile"

    def clean(self):
        _validate_profile_accounts(self, ("payable_account", "expense_account", "purchase_account"))


def _validate_tree(instance, parent, company_id, label, company_attr="company_id"):
    if not parent:
        return
    if parent.pk == instance.pk:
        raise ValidationError({"parent": f"{label} không thể là cha của chính nó."})
    related_company_id = parent
    for part in company_attr.split("."):
        related_company_id = getattr(related_company_id, part)
    if related_company_id != company_id:
        raise ValidationError({"parent": f"{label} cha phải thuộc cùng doanh nghiệp."})
    ancestor, visited = parent, {instance.pk}
    while ancestor:
        if ancestor.pk in visited:
            raise ValidationError({"parent": f"Cây {label.lower()} không được tạo chu trình."})
        visited.add(ancestor.pk)
        ancestor = ancestor.parent


def _validate_profile_accounts(instance, field_names):
    errors = {}
    for field_name in field_names:
        account = getattr(instance, field_name, None)
        if account and (
            account.company_id != instance.party.company_id
            or account.status != "ACTIVE"
            or not account.is_postable
        ):
            errors[field_name] = "Tài khoản phải đang hoạt động, cho phép hạch toán và thuộc cùng doanh nghiệp."
    if errors:
        raise ValidationError(errors)
