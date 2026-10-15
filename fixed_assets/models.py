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
    SUSPENDED = "SUSPENDED", "Tạm ngừng"
    DISPOSED = "DISPOSED", "Đã ghi giảm"


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
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, related_name="assets")
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True, related_name="assets")
    custodian = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="assets_in_custody")
    source_module = models.CharField(max_length=20, blank=True)
    source_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=AssetStatus.choices, default=AssetStatus.DRAFT)
    disposed_at = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="assets_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fa_asset_record"
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_fa_asset_code"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_fa_asset_quantity_positive"),
            models.CheckConstraint(condition=Q(original_cost__gte=0, salvage_value__gte=0, accumulated_depreciation__gte=0, allocated_value__gte=0), name="ck_fa_asset_values_nonnegative"),
            models.CheckConstraint(condition=Q(useful_life_periods__gt=0), name="ck_fa_asset_life_positive"),
        ]

    @property
    def processed_value(self):
        return self.accumulated_depreciation if self.asset_type == AssetType.FIXED_ASSET else self.allocated_value

    @property
    def remaining_value(self):
        return self.original_cost - self.processed_value

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
    status = models.CharField(max_length=20, choices=(("DRAFT", "Nháp"), ("CALCULATED", "Đã tính"), ("POSTED", "Đã ghi nhận"), ("CANCELLED", "Đã hủy")), default="DRAFT")
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

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
