from decimal import Decimal
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class AssetType(models.TextChoices):
    FIXED_ASSET = "FIXED_ASSET", "Tài sản cố định"
    TOOL = "TOOL", "Công cụ dụng cụ"


class AssetStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    ACTIVE = "ACTIVE", "Đang sử dụng"
    SUSPENDED = "SUSPENDED", "Ngừng sử dụng"
    DISPOSED = "DISPOSED", "Đã ghi giảm"


class UsefulLifeUnit(models.TextChoices):
    YEAR = "YEAR", "Năm"
    MONTH = "MONTH", "Tháng"


class AccountingReconciliationStatus(models.TextChoices):
    UNRECONCILED = "UNRECONCILED", "Chưa đối chiếu hạch toán"
    RECONCILED = "RECONCILED", "Đã đối chiếu"
    DISCREPANCY = "DISCREPANCY", "Có chênh lệch"


class TransactionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ duyệt"
    APPROVED = "APPROVED", "Đã duyệt"
    POSTED = "POSTED", "Đã ghi nhận"
    REJECTED = "REJECTED", "Từ chối"
    REVERSED = "REVERSED", "Đã đảo"
    CANCELLED = "CANCELLED", "Đã hủy"


class TransactionType(models.TextChoices):
    ACQUISITION = "ACQUISITION", "Ghi tăng"
    DEPRECIATION = "DEPRECIATION", "Khấu hao TSCĐ"
    ALLOCATION = "ALLOCATION", "Phân bổ CCDC"
    TRANSFER = "TRANSFER", "Điều chuyển"
    RECLASSIFICATION = "RECLASSIFICATION", "Chuyển nhóm"
    VALUE_INCREASE = "VALUE_INCREASE", "Tăng nguyên giá"
    VALUE_DECREASE = "VALUE_DECREASE", "Giảm nguyên giá"
    DISPOSAL = "DISPOSAL", "Ghi giảm/Thanh lý"
    LIFE_CHANGE = "LIFE_CHANGE", "Điều chỉnh số kỳ khấu hao/phân bổ"
    REVALUATION = "REVALUATION", "Đánh giá lại TSCĐ"
    REVERSAL = "REVERSAL", "Đảo giao dịch"


class DepreciationMethod(models.TextChoices):
    STRAIGHT_LINE = "STRAIGHT_LINE", "Đường thẳng"
    OTHER = "OTHER", "Khác"


class GlStatus(models.TextChoices):
    PENDING = "PENDING", "Chờ hạch toán"
    POSTED = "POSTED", "Đã hạch toán"
    ERROR = "ERROR", "Lỗi"
    NOT_REQUIRED = "NOT_REQUIRED", "Không yêu cầu"


class ApprovalDecisionType(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Gửi duyệt"
    APPROVED = "APPROVED", "Duyệt"
    REJECTED = "REJECTED", "Từ chối"


class PeriodStatus(models.TextChoices):
    OPEN = "OPEN", "Mở"
    CLOSED = "CLOSED", "Đóng"


class AssetCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="asset_categories")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    asset_type = models.CharField(max_length=20, choices=AssetType.choices)
    default_method = models.CharField(max_length=30, choices=DepreciationMethod.choices, default=DepreciationMethod.STRAIGHT_LINE)
    default_periods = models.PositiveIntegerField(default=1)
    asset_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="asset_categories")
    accumulated_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="asset_accumulated_categories")
    expense_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="asset_expense_categories")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fa_asset_category"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_fa_category_code"),
            models.CheckConstraint(condition=Q(default_periods__gt=0), name="ck_fa_category_periods_positive"),
        ]

    def clean(self):
        errors = {}
        if self.parent_id and (self.parent_id == self.id or self.parent.company_id != self.company_id or self.parent.asset_type != self.asset_type):
            errors["parent"] = "Nhóm cha không hợp lệ."
        for field in ("asset_account", "accumulated_account", "expense_account"):
            account = getattr(self, field, None)
            if account and account.company_id != self.company_id:
                errors[field] = "Tài khoản phải thuộc cùng doanh nghiệp."
        if errors:
            raise ValidationError(errors)


class AssetPeriod(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="asset_periods")
    code = models.CharField(max_length=30)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=10, choices=PeriodStatus.choices, default=PeriodStatus.OPEN)

    class Meta:
        db_table = "fa_period"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_fa_period_code"),
            models.CheckConstraint(condition=Q(end_date__gte=models.F("start_date")), name="ck_fa_period_dates"),
        ]


class AssetRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="asset_records")
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    asset_type = models.CharField(max_length=20, choices=AssetType.choices)
    category = models.ForeignKey(AssetCategory, on_delete=models.PROTECT, related_name="assets")
    description = models.TextField(blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=4, default=1)
    acquisition_date = models.DateField()
    in_service_date = models.DateField()
    original_cost = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    salvage_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    accumulated_depreciation = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    allocated_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    method = models.CharField(max_length=30, choices=DepreciationMethod.choices, default=DepreciationMethod.STRAIGHT_LINE)
    useful_life_periods = models.PositiveIntegerField(default=1)
    periods_processed = models.PositiveIntegerField(default=0)
    # UC-FA-06 BR19: monthly depreciation tracked for tax purposes when it differs from the accounting one.
    tax_monthly_depreciation = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, related_name="assets")
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True, related_name="assets")
    custodian = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="assets_in_custody")
    acquisition_voucher_no = models.CharField(max_length=80, blank=True, default="")
    is_depreciable = models.BooleanField(default=True)
    asset_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="fixed_assets_cost")
    accumulated_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="fixed_assets_accumulated")
    depreciable_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    useful_life_value = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    useful_life_unit = models.CharField(max_length=10, choices=UsefulLifeUnit.choices, default=UsefulLifeUnit.YEAR)
    monthly_depreciation_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    annual_depreciation_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    monthly_depreciation_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    annual_depreciation_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    cit_cap_enabled = models.BooleanField(default=False)
    cit_depreciable_cap = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    cit_monthly_cap = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    allocations = models.JSONField(default=list, blank=True)
    origins = models.JSONField(default=list, blank=True)
    components = models.JSONField(default=list, blank=True)
    accessories = models.JSONField(default=list, blank=True)
    country_of_origin = models.CharField(max_length=120, blank=True, default="")
    manufacture_year = models.PositiveIntegerField(null=True, blank=True)
    accounting_reconciliation_status = models.CharField(
        max_length=25, choices=AccountingReconciliationStatus.choices, default=AccountingReconciliationStatus.UNRECONCILED
    )
    source_module = models.CharField(max_length=20, blank=True)
    source_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=AssetStatus.choices, default=AssetStatus.DRAFT)
    disposed_at = models.DateField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)
    last_update_reason = models.CharField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="assets_created")
    updated_by = models.ForeignKey(
        "iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="assets_updated"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fa_asset_record"
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_fa_asset_code"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_fa_asset_quantity_positive"),
            models.CheckConstraint(condition=Q(original_cost__gte=0, salvage_value__gte=0, accumulated_depreciation__gte=0, allocated_value__gte=0), name="ck_fa_asset_values_nonnegative"),
            models.CheckConstraint(condition=Q(useful_life_periods__gt=0) | Q(is_depreciable=False), name="ck_fa_asset_life_positive"),
        ]

    @property
    def processed_value(self):
        return self.accumulated_depreciation if self.asset_type == AssetType.FIXED_ASSET else self.allocated_value

    @property
    def remaining_value(self):
        base_rem = self.original_cost - self.processed_value
        if self.asset_type == AssetType.TOOL and isinstance(self.accessories, list) and self.accessories:
            meta = self.accessories[0] if isinstance(self.accessories[0], dict) else {}
            disp_val = meta.get("disposed_unallocated_value")
            if disp_val is not None:
                try:
                    return max(Decimal("0"), base_rem - Decimal(str(disp_val)))
                except Exception:
                    pass
        return base_rem

    def clean(self):
        errors = {}
        if self.category_id and (self.category.company_id != self.company_id or self.category.asset_type != self.asset_type):
            errors["category"] = "Nhóm không phù hợp loại tài sản hoặc doanh nghiệp."
        for field in ("branch", "department", "custodian"):
            value = getattr(self, field, None)
            if value and value.company_id != self.company_id:
                errors[field] = "Đơn vị/người sử dụng phải thuộc cùng doanh nghiệp."
        if self.salvage_value > self.original_cost:
            errors["salvage_value"] = "Giá trị thu hồi không được vượt nguyên giá."
        if errors:
            raise ValidationError(errors)


class AssetTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="asset_transactions")
    asset = models.ForeignKey(AssetRecord, on_delete=models.PROTECT, related_name="transactions")
    number = models.CharField(max_length=80)
    transaction_type = models.CharField(max_length=30, choices=TransactionType.choices)
    transaction_date = models.DateField()
    amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    period_code = models.CharField(max_length=30, blank=True, default="")
    reason = models.CharField(max_length=500, blank=True)
    source_module = models.CharField(max_length=20, blank=True)
    source_reference = models.CharField(max_length=100, blank=True)
    idempotency_key = models.CharField(max_length=150, null=True, blank=True, unique=True)
    original_transaction = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversals")
    target_category = models.ForeignKey(AssetCategory, on_delete=models.PROTECT, null=True, blank=True, related_name="target_transactions")
    target_branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="target_asset_transactions")
    target_department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True, related_name="target_asset_transactions")
    target_custodian = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="target_asset_transactions")
    # Transfer/disposal of part of the quantity: that part is split off into split_asset first.
    quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    split_asset = models.ForeignKey(AssetRecord, on_delete=models.PROTECT, null=True, blank=True, related_name="split_from_transactions")
    target_useful_life_periods = models.PositiveIntegerField(null=True, blank=True)
    before_snapshot = models.JSONField(default=dict, blank=True)
    after_snapshot = models.JSONField(default=dict, blank=True)
    workflow_snapshot = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=30, choices=TransactionStatus.choices, default=TransactionStatus.DRAFT)
    asset_applied = models.BooleanField(default=False)
    gl_status = models.CharField(max_length=20, choices=GlStatus.choices, default=GlStatus.PENDING)
    gl_reference = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="asset_transactions_created")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fa_asset_transaction"
        ordering = ("-transaction_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_fa_transaction_number"),
            models.CheckConstraint(condition=Q(amount__gte=0), name="ck_fa_transaction_amount_nonnegative"),
            models.UniqueConstraint(fields=("asset", "transaction_type", "period_code"), condition=~Q(period_code="") & Q(status="POSTED"), name="uq_fa_posted_period_operation"),
        ]

    def clean(self):
        if self.asset_id and self.asset.company_id != self.company_id:
            raise ValidationError({"asset": "Tài sản phải thuộc cùng doanh nghiệp."})


class CalculationRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=80)
    calculation_type = models.CharField(max_length=20, choices=(("DEPRECIATION", "Khấu hao"), ("ALLOCATION", "Phân bổ")))
    period_code = models.CharField(max_length=30)
    period_start = models.DateField()
    period_end = models.DateField()
    # UC-FA-03: Thông tin chứng từ và kỳ tính khấu hao
    period_month = models.PositiveSmallIntegerField(null=True, blank=True)
    period_year = models.PositiveSmallIntegerField(null=True, blank=True)
    voucher_date = models.DateField(null=True, blank=True)
    posting_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True, default="")
    reference = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=(
            ("DRAFT", "Chưa ghi sổ"),
            ("CALCULATED", "Chưa ghi sổ"),
            ("POSTED", "Đã ghi sổ"),
            ("CANCELLED", "Đã hủy"),
        ),
        default="DRAFT",
    )
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_deductible_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_non_deductible_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    allocations_snapshot = models.JSONField(default=list, blank=True)
    accounting_entries = models.JSONField(default=list, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    gl_entry_id = models.UUIDField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=150, null=True, blank=True, unique=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    posted_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="calculation_runs_posted",
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fa_calculation_run"
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_fa_run_number")]


class CalculationLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(CalculationRun, on_delete=models.CASCADE, related_name="lines")
    asset = models.ForeignKey(AssetRecord, on_delete=models.PROTECT, related_name="calculation_lines")
    opening_value = models.DecimalField(max_digits=24, decimal_places=4)
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    closing_value = models.DecimalField(max_digits=24, decimal_places=4)
    # UC-FA-03: Cơ sở tính KH, phân loại thuế TNDN, phân bổ và hạch toán chi tiết từng tài sản
    original_cost = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    depreciable_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    opening_accumulated_depreciation = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    closing_accumulated_depreciation = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    deductible_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    non_deductible_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    eligible_days = models.PositiveSmallIntegerField(default=30)
    total_days_in_period = models.PositiveSmallIntegerField(default=30)
    department_name = models.CharField(max_length=255, blank=True, default="")
    category_name = models.CharField(max_length=255, blank=True, default="")
    allocations = models.JSONField(default=list, blank=True)
    accounting_lines = models.JSONField(default=list, blank=True)
    asset_version = models.PositiveIntegerField(default=1)
    transaction = models.OneToOneField(AssetTransaction, on_delete=models.PROTECT, null=True, blank=True, related_name="calculation_line")

    class Meta:
        db_table = "fa_calculation_line"
        constraints = [models.UniqueConstraint(fields=("run", "asset"), name="uq_fa_run_asset")]


class ApprovalDecision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="asset_approval_decisions")
    transaction = models.ForeignKey(AssetTransaction, on_delete=models.CASCADE, related_name="approval_decisions")
    level = models.PositiveSmallIntegerField(default=0)
    decision = models.CharField(max_length=20, choices=ApprovalDecisionType.choices)
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="asset_approval_decisions")
    comment = models.CharField(max_length=500, blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fa_approval_decision"


class AssetCount(models.Model):
    """Biên bản kiểm kê TSCĐ/CCDC: book vs counted quantity; differences are settled by increase/disposal vouchers."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="asset_counts")
    asset_type = models.CharField(max_length=20, choices=AssetType.choices)
    number = models.CharField(max_length=80)
    count_date = models.DateField()
    purpose = models.CharField(max_length=500, blank=True)
    conclusion = models.TextField(blank=True)
    committee = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="asset_counts_created")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fa_asset_count"
        ordering = ("-count_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_fa_asset_count_number")]


class AssetCountLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    count = models.ForeignKey(AssetCount, on_delete=models.CASCADE, related_name="lines")
    asset = models.ForeignKey(AssetRecord, on_delete=models.PROTECT, related_name="count_lines")
    book_quantity = models.DecimalField(max_digits=20, decimal_places=4)
    actual_quantity = models.DecimalField(max_digits=20, decimal_places=4)
    book_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    condition = models.CharField(max_length=255, blank=True)
    recommendation = models.CharField(max_length=255, blank=True)
    note = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "fa_asset_count_line"
        constraints = [models.CheckConstraint(condition=Q(actual_quantity__gte=0), name="ck_fa_count_actual_nonnegative")]


class RevaluationReason(models.TextChoices):
    UPGRADE = "UPGRADE", "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản"
    STATE_DECISION = "STATE_DECISION", "Đánh giá lại theo quyết định của cơ quan nhà nước"
    RESTRUCTURE = "RESTRUCTURE", "Đánh giá lại khi chia tách, hợp nhất, sáp nhập doanh nghiệp"
    CONVERSION = "CONVERSION", "Đánh giá lại khi chuyển đổi loại hình doanh nghiệp"
    OTHER = "OTHER", "Lý do khác"


class RevaluationStatus(models.TextChoices):
    DRAFT = "DRAFT", "Chưa ghi sổ"
    POSTED = "POSTED", "Đã ghi sổ"
    REVERSED = "REVERSED", "Đã bỏ ghi sổ"


class AssetRevaluation(models.Model):
    """UC-FA-06: one revaluation/upgrade document covering one or more fixed assets."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="asset_revaluations")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="asset_revaluations")
    number = models.CharField(max_length=80)
    record_number = models.CharField(max_length=80, blank=True)
    record_date = models.DateField(null=True, blank=True)
    reason = models.CharField(max_length=30, choices=RevaluationReason.choices)
    effective_date = models.DateField()
    document_date = models.DateField()
    posting_date = models.DateField()
    conclusion = models.TextField(blank=True)
    references = models.JSONField(default=list, blank=True)
    # AF29/BR25: the cost increase was already booked by the source document (e.g. Nợ 211/Có 241).
    cost_booked_at_source = models.BooleanField(default=False)
    source_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=RevaluationStatus.choices, default=RevaluationStatus.DRAFT)
    idempotency_key = models.CharField(max_length=150, null=True, blank=True, unique=True)
    journal_entry = models.ForeignKey("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="asset_revaluations")
    attachments = models.JSONField(default=list, blank=True)
    reversal_reason = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="asset_revaluations_created")
    posted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="asset_revaluations_posted")
    posted_at = models.DateTimeField(null=True, blank=True)
    reversed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fa_revaluation"
        ordering = ("-posting_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_fa_revaluation_number")]


class RevaluationMember(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revaluation = models.ForeignKey(AssetRevaluation, on_delete=models.CASCADE, related_name="members")
    line_no = models.PositiveIntegerField()
    full_name = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True)
    representing = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "fa_revaluation_member"
        ordering = ("line_no",)


class RevaluationLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revaluation = models.ForeignKey(AssetRevaluation, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    asset = models.ForeignKey(AssetRecord, on_delete=models.PROTECT, related_name="revaluation_lines")
    before_original_cost = models.DecimalField(max_digits=24, decimal_places=4)
    after_original_cost = models.DecimalField(max_digits=24, decimal_places=4)
    before_remaining_periods = models.PositiveIntegerField()
    after_remaining_periods = models.PositiveIntegerField()
    before_accumulated_depreciation = models.DecimalField(max_digits=24, decimal_places=4)
    after_accumulated_depreciation = models.DecimalField(max_digits=24, decimal_places=4)
    before_depreciable_value = models.DecimalField(max_digits=24, decimal_places=4)
    after_depreciable_value = models.DecimalField(max_digits=24, decimal_places=4)
    monthly_depreciation_after = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_monthly_depreciation_after = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    expense_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    revaluation_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    before_snapshot = models.JSONField(default=dict, blank=True)
    asset_transaction = models.ForeignKey(AssetTransaction, on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "fa_revaluation_line"
        ordering = ("line_no",)
        constraints = [models.UniqueConstraint(fields=("revaluation", "asset"), name="uq_fa_revaluation_asset")]


class RevaluationEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revaluation = models.ForeignKey(AssetRevaluation, on_delete=models.CASCADE, related_name="entries")
    line_no = models.PositiveIntegerField()
    description = models.CharField(max_length=500, blank=True)
    debit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="+")
    credit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="+")
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    party = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    expense_item = models.ForeignKey("master_data.ExpenseItem", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "fa_revaluation_entry"
        ordering = ("line_no",)
