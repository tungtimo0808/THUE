from decimal import Decimal
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class AccountClass(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="account_classes")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=150)
    normal_balance = models.CharField(max_length=10, choices=(("DEBIT", "Nợ"), ("CREDIT", "Có")))

    class Meta:
        db_table = "gl_account_class"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_account_class")]


class ChartOfAccounts(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="charts_of_accounts")
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    accounting_regime = models.CharField(max_length=30, default="TT99")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default="ACTIVE")
    template_version = models.CharField(max_length=50, blank=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "gl_chart_of_accounts"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_chart_company_code"),
            models.CheckConstraint(condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")), name="ck_chart_validity"),
        ]


class AccountNature(models.TextChoices):
    ASSET = "ASSET", "Tài sản"
    LIABILITY = "LIABILITY", "Nợ phải trả"
    EQUITY = "EQUITY", "Vốn chủ sở hữu"
    REVENUE = "REVENUE", "Doanh thu, thu nhập"
    EXPENSE = "EXPENSE", "Chi phí"
    OTHER_INCOME = "OTHER_INCOME", "Thu nhập khác"
    OTHER_EXPENSE = "OTHER_EXPENSE", "Chi phí khác"
    OFF_BALANCE = "OFF_BALANCE", "Tài khoản ngoài bảng"


class NormalBalance(models.TextChoices):
    DEBIT = "DEBIT", "Dư Nợ"
    CREDIT = "CREDIT", "Dư Có"
    BOTH = "BOTH", "Lưỡng tính"
    NONE = "NONE", "Không áp dụng"


class AccountStatus(models.TextChoices):
    DRAFT = "DRAFT", "Dự thảo"
    ACTIVE = "ACTIVE", "Đang sử dụng"
    INACTIVE = "INACTIVE", "Ngừng sử dụng"
    ARCHIVED = "ARCHIVED", "Lưu trữ"


class AccountingDimension(models.TextChoices):
    CUSTOMER = "CUSTOMER", "Khách hàng"
    SUPPLIER = "SUPPLIER", "Nhà cung cấp"
    EMPLOYEE = "EMPLOYEE", "Nhân viên"
    ITEM = "ITEM", "Vật tư, hàng hóa"
    WAREHOUSE = "WAREHOUSE", "Kho"
    BANK_ACCOUNT = "BANK_ACCOUNT", "Tài khoản ngân hàng"
    PROJECT = "PROJECT", "Dự án"
    COST_CENTER = "COST_CENTER", "Trung tâm chi phí"
    CONTRACT = "CONTRACT", "Hợp đồng"
    DEPARTMENT = "DEPARTMENT", "Phòng ban"
    FIXED_ASSET = "FIXED_ASSET", "Tài sản cố định"
    CCDC = "CCDC", "Công cụ dụng cụ"
    STATISTICAL_CODE = "STATISTICAL_CODE", "Mã thống kê"
    EXPENSE_ITEM = "EXPENSE_ITEM", "Khoản mục chi phí"


class DimensionRequirementLevel(models.TextChoices):
    NOT_USED = "NOT_USED", "Không sử dụng"
    OPTIONAL = "OPTIONAL", "Tùy chọn"
    REQUIRED = "REQUIRED", "Bắt buộc"
    CONDITIONAL = "CONDITIONAL", "Bắt buộc có điều kiện"


class Account(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="accounts")
    chart_of_accounts = models.ForeignKey(ChartOfAccounts, on_delete=models.PROTECT, related_name="accounts")
    account_class = models.ForeignKey(AccountClass, on_delete=models.PROTECT, null=True, blank=True, related_name="accounts")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255, blank=True)
    account_level = models.PositiveSmallIntegerField(default=1)
    account_type = models.CharField(max_length=30, choices=AccountNature.choices, default=AccountNature.ASSET)
    normal_balance = models.CharField(max_length=10, choices=NormalBalance.choices, default=NormalBalance.DEBIT)
    statutory_account_code = models.CharField(max_length=50, blank=True)
    is_statutory_account = models.BooleanField(default=False)
    is_postable = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False)
    is_foreign_currency = models.BooleanField(default=False)
    default_currency = models.CharField(max_length=10, blank=True)
    dimension_requirements = models.JSONField(default=dict, blank=True)
    requires_party = models.BooleanField(default=False)
    requires_project = models.BooleanField(default=False)
    requires_cost_center = models.BooleanField(default=False)
    requires_warehouse = models.BooleanField(default=False)
    report_mapping = models.CharField(max_length=150, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=AccountStatus.choices, default=AccountStatus.ACTIVE)
    description = models.TextField(blank=True)
    inactive_reason = models.CharField(max_length=255, blank=True)
    replacement_account = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replaces")
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "gl_account"
        ordering = ("company_id", "code")
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_gl_account_company_code")]

    def clean(self):
        errors = {}
        if self.chart_of_accounts_id and self.chart_of_accounts.company_id != self.company_id:
            errors["chart_of_accounts"] = "Hệ thống tài khoản phải thuộc cùng doanh nghiệp."
        if self.account_class_id and self.account_class.company_id != self.company_id:
            errors["account_class"] = "Loại tài khoản phải thuộc cùng doanh nghiệp."

        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "Ngày ngừng sử dụng phải lớn hơn hoặc bằng ngày bắt đầu."

        if self.parent_id:
            if self.parent_id == self.id or self.parent.company_id != self.company_id:
                errors["parent"] = "Tài khoản cha không hợp lệ."
            elif self.parent.chart_of_accounts_id != self.chart_of_accounts_id:
                errors["parent"] = "Tài khoản cha phải thuộc cùng hệ thống tài khoản."
            elif self.parent.status not in (AccountStatus.ACTIVE, "ACTIVE"):
                errors["parent"] = "Tài khoản cha không ở trạng thái hoạt động."
            else:
                ancestor, visited = self.parent, {self.id}
                while ancestor:
                    if ancestor.id in visited:
                        errors["parent"] = "Cây tài khoản không được tạo chu trình."
                        break
                    visited.add(ancestor.id)
                    ancestor = ancestor.parent

                # BR-COA-12: Số hiệu tài khoản con phải bắt đầu bằng số hiệu tài khoản cha
                if self.code and not self.code.startswith(self.parent.code):
                    errors["code"] = f"Số hiệu tài khoản con ({self.code}) phải bắt đầu bằng số hiệu tài khoản cha ({self.parent.code})."

                # BR-COA-13: Bản chất tài khoản con phải tương thích với tài khoản cha
                if self.account_type and self.account_type != self.parent.account_type:
                    errors["account_type"] = f"Bản chất tài khoản con ({self.account_type}) phải tương thích với tài khoản cha ({self.parent.account_type})."

        # BR-COA-14: Tài khoản tổng hợp có tài khoản con ACTIVE không được dùng trực tiếp để ghi sổ
        if self.id and self.is_postable and self.children.filter(status__in=(AccountStatus.ACTIVE, "ACTIVE")).exists():
            errors["is_postable"] = "Tài khoản có tài khoản con đang hoạt động không được chọn làm tài khoản ghi sổ."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # Auto-compute account_level
        if self.parent_id:
            self.account_level = self.parent.account_level + 1
        else:
            self.account_level = 1

        # Auto-sync dimension boolean flags: only REQUIRED dimensions are enforced on journal lines;
        # OPTIONAL / CONDITIONAL ones may be filled but must not block posting.
        reqs = self.dimension_requirements or {}
        required = {key for key, level in reqs.items() if level in (DimensionRequirementLevel.REQUIRED, "REQUIRED")}
        if required & {"CUSTOMER", "SUPPLIER", "EMPLOYEE"}:
            self.requires_party = True
        if "PROJECT" in required:
            self.requires_project = True
        if "COST_CENTER" in required:
            self.requires_cost_center = True
        if "WAREHOUSE" in required:
            self.requires_warehouse = True

        # Auto-assign account_class if empty
        if not self.account_class_id and self.company_id and self.code:
            first_char = self.code[0] if self.code else "1"
            class_map = {
                "1": ("1", "Tài sản ngắn hạn", "DEBIT"),
                "2": ("2", "Tài sản dài hạn", "DEBIT"),
                "3": ("3", "Nợ phải trả", "CREDIT"),
                "4": ("4", "Vốn chủ sở hữu", "CREDIT"),
                "5": ("5", "Doanh thu", "CREDIT"),
                "6": ("6", "Chi phí sản xuất, kinh doanh", "DEBIT"),
                "7": ("7", "Thu nhập khác", "CREDIT"),
                "8": ("8", "Chi phí khác", "DEBIT"),
                "9": ("9", "Xác định kết quả kinh doanh", "DEBIT"),
                "0": ("0", "Tài khoản ngoài bảng", "DEBIT"),
            }
            c_code, c_name, c_nb = class_map.get(first_char, (first_char, f"Nhóm tài khoản {first_char}", "DEBIT"))
            ac, _ = AccountClass.objects.get_or_create(
                company_id=self.company_id, code=c_code,
                defaults={"name": c_name, "normal_balance": c_nb}
            )
            self.account_class = ac

        super().save(*args, **kwargs)


class AccountingPeriod(models.Model):
    """
    UC-GL-12 – Khóa / Bỏ khóa sổ kỳ kế toán (Section 1.1, 1.2, BR-GL-LOCK-01..96).
    """

    STATUS_CHOICES = (
        ("OPEN", "Đang mở"),
        ("PARTIALLY_LOCKED", "Khóa một phần"),
        ("CLOSED", "Đã khóa sổ"),
        ("CLOSING", "Đang khóa sổ"),
        ("REOPENING", "Đang mở lại kỳ"),
    )
    LOCK_SCOPE_CHOICES = (
        ("FULL_PERIOD", "Khóa toàn bộ kỳ"),
        ("DOCUMENT_TYPES", "Khóa theo loại chứng từ"),
        ("BRANCH", "Khóa theo đơn vị / chi nhánh"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="gl_periods")
    code = models.CharField(max_length=30)
    fiscal_year = models.PositiveIntegerField()
    period_number = models.PositiveSmallIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default="OPEN")
    lock_scope = models.CharField(max_length=30, choices=LOCK_SCOPE_CHOICES, default="FULL_PERIOD")
    lock_to_date = models.DateField(null=True, blank=True)
    locked_document_types = models.JSONField(default=list, blank=True)
    locked_branches = models.JSONField(default=list, blank=True)
    lock_policy = models.JSONField(default=dict, blank=True)
    closed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="gl_periods_closed")
    closed_at = models.DateTimeField(null=True, blank=True)
    reopened_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="gl_periods_reopened")
    reopened_at = models.DateTimeField(null=True, blank=True)
    reopen_reason = models.CharField(max_length=500, blank=True)
    reopen_workflow_status = models.CharField(max_length=30, blank=True, default="")
    reopen_requested_by = models.ForeignKey(
        "iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="gl_periods_reopen_requested"
    )
    reopen_requested_at = models.DateTimeField(null=True, blank=True)
    reopen_approved_by = models.ForeignKey(
        "iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="gl_periods_reopen_approved"
    )
    reopen_approved_at = models.DateTimeField(null=True, blank=True)
    last_checklist_watermark = models.CharField(max_length=64, blank=True, default="")
    last_closed_watermark = models.CharField(max_length=64, blank=True, default="")
    notes = models.CharField(max_length=500, blank=True, default="")
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "gl_accounting_period"
        ordering = ("fiscal_year", "period_number")
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_gl_period_code"),
            models.UniqueConstraint(fields=("company", "fiscal_year", "period_number"), name="uq_gl_period_number"),
            models.CheckConstraint(condition=Q(end_date__gte=models.F("start_date")), name="ck_gl_period_dates"),
            models.CheckConstraint(condition=Q(period_number__gte=1, period_number__lte=99), name="ck_gl_period_number_range"),
        ]


class PeriodCloseChecklist(models.Model):
    """
    UC-GL-12 (Section 1.1.B, Main Flow Steps 8..21, BR-GL-LOCK-13..27, 72, 96):
    Lưu kết quả kiểm tra trước khóa sổ (Checklist trước khóa) phân loại BLOCKER / WARNING / INFO / PASSED
    và lưu source_watermark để phát hiện thay đổi dữ liệu giữa lúc kiểm tra và lúc xác nhận khóa.
    """

    STATUS_CHOICES = (
        ("READY", "Đủ điều kiện khóa sổ"),
        ("WARNING", "Có cảnh báo (cho phép khóa theo chính sách)"),
        ("BLOCKED", "Có lỗi chặn (không được phép khóa)"),
        ("STALE", "Dữ liệu nguồn đã thay đổi sau khi kiểm tra"),
        ("CONSUMED", "Đã sử dụng để khóa sổ kỳ"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="period_close_checklists",
    )
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.CASCADE,
        related_name="close_checklists",
    )
    lock_scope = models.CharField(max_length=30, default="FULL_PERIOD")
    lock_to_date = models.DateField()
    document_types = models.JSONField(default=list, blank=True)
    branch = models.ForeignKey(
        "organization.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="period_close_checklists",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="READY")
    can_confirm_close = models.BooleanField(default=True)
    blocker_count = models.PositiveIntegerField(default=0)
    warning_count = models.PositiveIntegerField(default=0)
    info_count = models.PositiveIntegerField(default=0)
    passed_count = models.PositiveIntegerField(default=0)
    source_watermark = models.CharField(max_length=64, blank=True, default="")
    period_version_snapshot = models.PositiveIntegerField(default=1)
    checks = models.JSONField(default=list, blank=True)
    blockers = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    infos = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="period_checklists_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gl_period_close_checklist"
        ordering = ("-created_at",)


class PeriodLockHistory(models.Model):
    """
    UC-GL-12 (Section 1.1.D, BR-GL-LOCK-60..64, 68, 88..96):
    Lưu đầy đủ lịch sử bất biến của mọi lần Khóa toàn kỳ, Khóa theo loại chứng từ,
    Yêu cầu mở lại, Phê duyệt/Từ chối mở lại, Bỏ khóa và Khóa tự động của kỳ kế toán.
    Không bao giờ bị xóa khi Bỏ khóa kỳ.
    """

    ACTION_CHOICES = (
        ("LOCK_PERIOD", "Khóa toàn bộ kỳ kế toán"),
        ("UNLOCK_PERIOD", "Bỏ khóa / Mở lại kỳ kế toán"),
        ("LOCK_DOCUMENT_TYPE", "Khóa sổ theo loại chứng từ"),
        ("UNLOCK_DOCUMENT_TYPE", "Bỏ khóa sổ theo loại chứng từ"),
        ("REQUEST_REOPEN", "Gửi yêu cầu phê duyệt mở lại kỳ"),
        ("APPROVE_REOPEN", "Phê duyệt mở lại kỳ kế toán"),
        ("REJECT_REOPEN", "Từ chối yêu cầu mở lại kỳ kế toán"),
        ("AUTO_LOCK_PERIOD", "Tự động khóa sổ kỳ kế toán theo lịch"),
        ("AUTO_LOCK_FAILED", "Tự động khóa sổ thất bại do còn lỗi chặn"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="period_lock_histories",
    )
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.CASCADE,
        related_name="lock_histories",
    )
    checklist = models.ForeignKey(
        PeriodCloseChecklist,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lock_histories",
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    lock_scope = models.CharField(max_length=30, default="FULL_PERIOD")
    lock_to_date = models.DateField(null=True, blank=True)
    document_types = models.JSONField(default=list, blank=True)
    status_before = models.CharField(max_length=30, blank=True, default="")
    status_after = models.CharField(max_length=30, blank=True, default="")
    reason = models.CharField(max_length=500, blank=True, default="")
    notes = models.CharField(max_length=500, blank=True, default="")
    warnings_at_lock = models.JSONField(default=list, blank=True)
    workflow_result = models.CharField(max_length=30, blank=True, default="")
    is_auto_lock = models.BooleanField(default=False)
    actor = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="period_lock_actions",
    )
    approved_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="period_lock_approvals",
    )
    snapshot = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gl_period_lock_history"
        ordering = ("-occurred_at", "-id")


class BudgetLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="gl_budgets")
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="budget_lines")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="budget_lines")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True)
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True)
    project = models.ForeignKey("master_data.Project", on_delete=models.PROTECT, null=True, blank=True)
    cost_center = models.ForeignKey("master_data.CostCenter", on_delete=models.PROTECT, null=True, blank=True)
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    allow_negative = models.BooleanField(default=False)
    notes = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_budget_line"
        constraints = [
            models.UniqueConstraint(fields=("period", "account", "branch", "department", "project", "cost_center"), nulls_distinct=False, name="uq_gl_budget_dimension"),
            models.CheckConstraint(condition=Q(amount__gte=0) | Q(allow_negative=True), name="ck_gl_budget_nonnegative"),
        ]


class JournalStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ duyệt"
    APPROVED = "APPROVED", "Đã duyệt"
    POSTED = "POSTED", "Đã ghi sổ"
    REJECTED = "REJECTED", "Từ chối"
    REVERSED = "REVERSED", "Đã đảo"
    CANCELLED = "CANCELLED", "Đã hủy"


class JournalEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="journal_entries")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="journal_entries")
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="journal_entries")
    number = models.CharField(max_length=80)
    entry_type = models.CharField(max_length=20, choices=(("MANUAL", "Trực tiếp"), ("SUBLEDGER", "Từ phân hệ"), ("ALLOCATION", "Phân bổ"), ("CLOSING", "Kết chuyển"), ("REVALUATION", "Đánh giá lại ngoại tệ"), ("ADJUSTMENT", "Điều chỉnh"), ("REVERSAL", "Đảo"), ("OPENING", "Số dư đầu kỳ")), default="MANUAL")
    posting_date = models.DateField()
    document_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500)
    source_module = models.CharField(max_length=20, blank=True)
    source_event_id = models.CharField(max_length=150, null=True, blank=True, unique=True)
    source_entity_type = models.CharField(max_length=80, blank=True)
    source_entity_id = models.UUIDField(null=True, blank=True)
    original_entry = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="related_entries")
    replacement_for_entry = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="replacement_entries")
    status = models.CharField(max_length=30, choices=JournalStatus.choices, default=JournalStatus.DRAFT)
    workflow_snapshot = models.JSONField(default=dict, blank=True)
    total_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="journal_entries_created")
    approved_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="journal_entries_approved")
    posted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="journal_entries_posted")
    unposted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="journal_entries_unposted")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    unposted_at = models.DateTimeField(null=True, blank=True)
    posting_reference = models.CharField(max_length=80, blank=True, default="")
    unpost_reference = models.CharField(max_length=80, blank=True, default="")
    unpost_reason = models.CharField(max_length=500, blank=True, default="")
    correction_reason = models.CharField(max_length=500, blank=True, default="")
    reversal_method = models.CharField(max_length=30, blank=True, default="")
    reversal_scope = models.CharField(max_length=20, blank=True, default="")
    is_adjusted = models.BooleanField(default=False)
    reversed_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    correction_idempotency_key = models.CharField(max_length=150, null=True, blank=True, unique=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_journal_entry"
        ordering = ("-posting_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_gl_journal_number"),
            models.CheckConstraint(condition=Q(total_debit__gte=0, total_credit__gte=0), name="ck_gl_journal_totals_nonnegative"),
        ]


class JournalPostingHistory(models.Model):
    """
    UC-GL-05 (BR-GL-POST-47, BR-GL-POST-82):
    Lưu lịch sử mọi lần Ghi sổ (POST), Bỏ ghi sổ (UNPOST), Ghi sổ lại (REPOST) và các lần thất bại
    để phục vụ kiểm toán và truy vết trạng thái mà không bị mất khi chứng từ được ghi sổ lại.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="journal_posting_histories",
    )
    entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.CASCADE,
        related_name="posting_histories",
    )
    action = models.CharField(max_length=25)
    reference = models.CharField(max_length=80, blank=True, default="")
    status_before = models.CharField(max_length=30, blank=True, default="")
    status_after = models.CharField(max_length=30, blank=True, default="")
    reason = models.CharField(max_length=500, blank=True, default="")
    error_code = models.CharField(max_length=80, blank=True, default="")
    actor = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journal_posting_actions",
    )
    occurred_at = models.DateTimeField(auto_now_add=True)
    snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "gl_journal_posting_history"
        ordering = ("-occurred_at",)
        indexes = [
            models.Index(fields=("company", "entry", "occurred_at"), name="ix_gl_jph_co_entry_time"),
        ]


class JournalLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    source_line = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="derived_lines")
    line_no = models.PositiveIntegerField()
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="journal_lines")
    description = models.CharField(max_length=500, blank=True)
    debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    foreign_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    party = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True)
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True)
    project = models.ForeignKey("master_data.Project", on_delete=models.PROTECT, null=True, blank=True)
    cost_center = models.ForeignKey("master_data.CostCenter", on_delete=models.PROTECT, null=True, blank=True)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    dimensions = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "gl_journal_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("entry", "line_no"), name="uq_gl_journal_line_no"),
            models.CheckConstraint(condition=(Q(debit__gt=0, credit=0) | Q(credit__gt=0, debit=0)), name="ck_gl_line_one_side"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0), name="ck_gl_line_rate_positive"),
        ]


class JournalApproval(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="journal_approvals")
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="approval_decisions")
    level = models.PositiveSmallIntegerField(default=0)
    decision = models.CharField(max_length=20, choices=(("SUBMITTED", "Gửi duyệt"), ("APPROVED", "Duyệt"), ("REJECTED", "Từ chối")))
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="journal_approvals")
    comment = models.CharField(max_length=500, blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gl_journal_approval"


class AccountBalance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="account_balances")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="balances")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True)
    opening_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    opening_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    period_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    period_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    closing_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    closing_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_account_balance"
        constraints = [models.UniqueConstraint(fields=("period", "account", "branch"), nulls_distinct=False, name="uq_gl_balance_dimension")]


class AllocationRule(models.Model):
    ALLOCATION_GROUP_CHOICES = (
        ("SELLING", "Chi phí bán hàng (641)"),
        ("ADMIN", "Chi phí quản lý doanh nghiệp (642)"),
        ("OTHER", "Chi phí khác"),
        ("SHARED", "Chi phí dùng chung"),
    )
    METHOD_CHOICES = (
        ("FIXED_PERCENT", "Tỷ lệ cố định"),
        ("COEFFICIENT", "Hệ số phân bổ"),
        ("BASIS_VALUE", "Tiêu thức giá trị"),
        ("REVENUE", "Theo doanh thu"),
        ("DIRECT_COST", "Theo chi phí trực tiếp"),
        ("QUANTITY", "Theo sản lượng / số lượng"),
        ("HEADCOUNT", "Theo nhân sự / ngày công"),
        ("DIRECT_AMOUNT", "Số tiền trực tiếp"),
    )
    ROUNDING_METHOD_CHOICES = (
        ("LAST_LINE", "Dồn chênh lệch vào dòng cuối hợp lệ"),
        ("LARGEST_LINE", "Dồn chênh lệch vào dòng có giá trị lớn nhất"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    allocation_group = models.CharField(max_length=30, choices=ALLOCATION_GROUP_CHOICES, default="ADMIN")
    source_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="allocation_rules_source", null=True, blank=True)
    offset_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="allocation_rules_offset", null=True, blank=True)
    source_filter = models.JSONField(default=dict, blank=True)
    method = models.CharField(max_length=30, choices=METHOD_CHOICES, default="FIXED_PERCENT")
    rounding_method = models.CharField(max_length=30, choices=ROUNDING_METHOD_CHOICES, default="LAST_LINE")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_allocation_rule"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_gl_allocation_rule")]


class AllocationDestination(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule = models.ForeignKey(AllocationRule, on_delete=models.CASCADE, related_name="destinations")
    line_no = models.PositiveIntegerField(default=1)
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    offset_account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True, related_name="allocation_destinations_offset")
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True)
    project = models.ForeignKey("master_data.Project", on_delete=models.PROTECT, null=True, blank=True)
    cost_center = models.ForeignKey("master_data.CostCenter", on_delete=models.PROTECT, null=True, blank=True)
    party = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True)
    percentage = models.DecimalField(max_digits=9, decimal_places=6, default=0)
    coefficient = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    basis_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    direct_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    expense_item_code = models.CharField(max_length=50, blank=True, default="")
    cost_object_code = models.CharField(max_length=50, blank=True, default="")
    contract_code = models.CharField(max_length=50, blank=True, default="")
    dimensions = models.JSONField(default=dict, blank=True)
    description = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "gl_allocation_destination"
        ordering = ("line_no", "id")
        constraints = [models.CheckConstraint(condition=Q(percentage__gte=0, percentage__lte=100), name="ck_gl_allocation_percentage")]


class AllocationRun(models.Model):
    STATUS_CHOICES = (
        ("CALCULATED", "Đã tính phân bổ (Tạm tính)"),
        ("UNPOSTED", "Đã tạo chứng từ (Chưa ghi sổ)"),
        ("POSTED", "Đã ghi sổ"),
        ("REVERSED", "Đã đảo bút toán"),
        ("CANCELLED", "Đã hủy"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    rule = models.ForeignKey(AllocationRule, on_delete=models.PROTECT, related_name="runs", null=True, blank=True)
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="allocation_runs")
    number = models.CharField(max_length=50, blank=True, default="")
    posting_date = models.DateField(null=True, blank=True)
    document_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True, default="")
    allocation_group = models.CharField(max_length=30, default="ADMIN")
    method = models.CharField(max_length=30, default="FIXED_PERCENT")
    rounding_method = models.CharField(max_length=30, default="LAST_LINE")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="POSTED")
    idempotency_key = models.CharField(max_length=150, unique=True)
    total_source_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    previously_allocated_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    remaining_allocatable_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    rounding_diff_adjusted = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    source_fingerprint = models.CharField(max_length=128, blank=True, default="")
    source_filter = models.JSONField(default=dict, blank=True)
    source_snapshot = models.JSONField(default=dict, blank=True)
    allocation_lines = models.JSONField(default=list, blank=True)
    entry = models.OneToOneField(JournalEntry, on_delete=models.PROTECT, related_name="allocation_run", null=True, blank=True)
    reversal_entry = models.ForeignKey(JournalEntry, on_delete=models.PROTECT, related_name="reversed_allocation_runs", null=True, blank=True)
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_allocation_run"


class ForeignCurrencyRevaluationRule(models.Model):
    """
    UC-GL-08 (BR-GL-FX-04, 05, 19..23, 29..33):
    Cấu hình quy tắc đánh giá lại tài khoản ngoại tệ và tài khoản xử lý chênh lệch tỷ giá
    theo nhóm khoản mục tiền tệ hoặc theo số hiệu tài khoản.
    """

    ITEM_GROUP_CHOICES = (
        ("CASH", "Tiền mặt ngoại tệ (1112)"),
        ("BANK", "Tiền gửi ngân hàng ngoại tệ (1122)"),
        ("RECEIVABLE", "Phải thu có gốc ngoại tệ (131, 136, 138)"),
        ("PAYABLE", "Phải trả có gốc ngoại tệ (331, 336, 338)"),
        ("LOAN", "Khoản vay/nợ có gốc ngoại tệ (341)"),
        ("OTHER_MONETARY", "Khoản mục tiền tệ khác"),
        ("ALL", "Tất cả khoản mục tiền tệ"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.PROTECT,
        related_name="fx_revaluation_rules",
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    item_group = models.CharField(
        max_length=40,
        choices=ITEM_GROUP_CHOICES,
        default="ALL",
    )
    account_prefix = models.CharField(max_length=30, blank=True, default="")
    target_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_rules_target",
    )
    fx_difference_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_rules_diff",
    )
    fx_gain_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_rules_gain",
    )
    fx_loss_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_rules_loss",
    )
    rate_type = models.ForeignKey(
        "master_data.ExchangeRateType",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_rules",
    )
    sequence = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_fx_revaluation_rule"
        ordering = ("sequence", "code")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "code"),
                name="uq_gl_fx_revaluation_rule",
            )
        ]


class ForeignCurrencyRevaluationRun(models.Model):
    """
    UC-GL-08 – Đánh giá lại tài khoản ngoại tệ cuối kỳ.
    Lưu thông tin chung, tỷ giá đánh giá, nguồn tỷ giá, phạm vi tài khoản, tổng hợp kết quả,
    liên kết chứng từ chênh lệch tỷ giá (JournalEntry) và bút toán đảo (nếu có).
    """

    STATUS_CHOICES = (
        ("CALCULATED", "Đã tính đánh giá (Tạm tính)"),
        ("UNPOSTED", "Đã tạo chứng từ (Chưa ghi sổ)"),
        ("POSTED", "Đã ghi sổ"),
        ("REVERSED", "Đã đảo bút toán"),
        ("CANCELLED", "Đã hủy"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.PROTECT,
        related_name="fx_revaluation_runs",
    )
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.PROTECT,
        related_name="fx_revaluation_runs",
    )
    currency = models.ForeignKey(
        "master_data.Currency",
        on_delete=models.PROTECT,
        related_name="fx_revaluation_runs",
    )
    number = models.CharField(max_length=80, blank=True, default="")
    revaluation_date = models.DateField()
    posting_date = models.DateField()
    document_date = models.DateField()
    description = models.CharField(max_length=500, blank=True, default="")
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8)
    rate_source = models.CharField(max_length=150, blank=True, default="MANUAL")
    rate_effective_date = models.DateField(null=True, blank=True)
    account_scope = models.CharField(max_length=30, default="ALL")
    scope_filter = models.JSONField(default=dict, blank=True)
    fx_difference_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_runs_diff",
    )
    fx_gain_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_runs_gain",
    )
    fx_loss_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_runs_loss",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="UNPOSTED",
    )
    idempotency_key = models.CharField(max_length=150, unique=True)
    total_foreign_balance = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_book_value_before = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_revalued_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_increase_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_decrease_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_gain_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_loss_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    net_difference = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    evaluated_lines_count = models.PositiveIntegerField(default=0)
    source_fingerprint = models.CharField(max_length=128, blank=True, default="")
    source_snapshot = models.JSONField(default=dict, blank=True)
    revaluation_lines = models.JSONField(default=list, blank=True)
    entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        related_name="fx_revaluation_run",
        null=True,
        blank=True,
    )
    reversal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.PROTECT,
        related_name="reversed_fx_revaluation_runs",
        null=True,
        blank=True,
    )
    calculated_at = models.DateTimeField(default=timezone.now)
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.PROTECT,
        related_name="created_fx_revaluation_runs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_fx_revaluation_run"
        ordering = ("-posting_date", "-created_at")


class ForeignCurrencyRevaluationLine(models.Model):
    """
    UC-GL-08 (Steps 42, BR-GL-FX-57, 58, 73..75):
    Chi tiết từng tài khoản/đối tượng/tài khoản ngân hàng trong một lần đánh giá lại ngoại tệ.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        ForeignCurrencyRevaluationRun,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_no = models.PositiveIntegerField(default=1)
    line_key = models.CharField(max_length=200, blank=True, default="")
    item_group = models.CharField(max_length=40, default="OTHER_MONETARY")
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="fx_revaluation_lines",
    )
    fx_difference_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_diff_lines",
    )
    debit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_debit_lines",
    )
    credit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fx_revaluation_credit_lines",
    )
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    party = models.ForeignKey(
        "master_data.Party",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        "master_data.Project",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    cost_center = models.ForeignKey(
        "master_data.CostCenter",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    bank_account_code = models.CharField(max_length=80, blank=True, default="")
    contract_code = models.CharField(max_length=80, blank=True, default="")
    dimensions = models.JSONField(default=dict, blank=True)
    normal_side = models.CharField(max_length=10, default="DEBIT")
    foreign_balance = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    book_value_before = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    current_book_rate = models.DecimalField(max_digits=20, decimal_places=8, default=0)
    revaluation_rate = models.DecimalField(max_digits=20, decimal_places=8, default=0)
    rate_source = models.CharField(max_length=150, blank=True, default="")
    revalued_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    difference_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    book_change_direction = models.CharField(max_length=20, default="NONE")
    fx_impact_type = models.CharField(max_length=20, default="NONE")
    is_selected = models.BooleanField(default=True)
    description = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "gl_fx_revaluation_line"
        ordering = ("line_no", "id")


class ClosingRule(models.Model):
    """
    UC-GL-09 (Section 1.1.C, BR-GL-PL-14..18, 32..36):
    Quy tắc kết chuyển doanh thu, thu nhập, chi phí và kết quả kinh doanh (Lãi/Lỗ).
    """

    RESULT_TYPE_CHOICES = (
        ("REVENUE", "Doanh thu / Thu nhập kết chuyển sang KQKD (VD: 511, 515, 711 -> 911)"),
        ("REVENUE_DEDUCTION", "Khoản giảm trừ doanh thu kết chuyển sang Doanh thu (VD: 521 -> 511)"),
        ("EXPENSE", "Chi phí kết chuyển sang KQKD (VD: 911 -> 632, 635, 641, 642, 811, 821)"),
        ("PROFIT", "Kết chuyển Lãi kết quả kinh doanh (VD: Nợ 911 / Có 4212)"),
        ("LOSS", "Kết chuyển Lỗ kết quả kinh doanh (VD: Nợ 4212 / Có 911)"),
        ("OTHER", "Kết chuyển khác"),
    )

    DIRECTION_CHOICES = (
        ("AUTO", "Tự động theo bản chất tài khoản / số phát sinh"),
        ("DEBIT_SOURCE_CREDIT_DEST", "Nợ TK nguồn / Có TK đích (VD: Nợ 511 / Có 911)"),
        ("DEBIT_DEST_CREDIT_SOURCE", "Nợ TK đích / Có TK nguồn (VD: Nợ 911 / Có 632)"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    source_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="closing_rules_source", null=True, blank=True
    )
    source_account_prefix = models.CharField(max_length=30, blank=True, default="")
    destination_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="closing_rules_destination"
    )
    result_type = models.CharField(max_length=30, choices=RESULT_TYPE_CHOICES, default="EXPENSE")
    direction = models.CharField(max_length=30, choices=DIRECTION_CHOICES, default="AUTO")
    include_subaccounts = models.BooleanField(default=True)
    skip_zero_amount = models.BooleanField(default=True)
    sequence = models.PositiveIntegerField(default=1)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "gl_closing_rule"
        ordering = ("sequence", "code")
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_gl_closing_rule")]


class ClosingRun(models.Model):
    """
    UC-GL-09 – Kết chuyển lãi lỗ (Profit & Loss Closing Run).
    Lưu thông tin đợt kết chuyển, ngày kết chuyển đến, tổng doanh thu/chi phí/kết quả lãi lỗ,
    trạng thái vòng đời (DRAFT -> CALCULATED -> READY -> UNPOSTED -> COMPLETED/POSTED -> REVERSED/CANCELLED),
    fingerprint dữ liệu nguồn và liên kết tới JournalEntry kết chuyển.
    """

    STATUS_CHOICES = (
        ("DRAFT", "Nháp"),
        ("CALCULATING", "Đang tính dữ liệu"),
        ("CALCULATED", "Đã tạo các dòng kết chuyển"),
        ("REVIEW_REQUIRED", "Có cảnh báo cần kiểm tra"),
        ("READY", "Đủ điều kiện tạo/lưu chứng từ"),
        ("UNPOSTED", "Đã cất chứng từ (Chưa ghi sổ)"),
        ("POSTED", "Đã ghi sổ"),
        ("COMPLETED", "Hoàn tất kết chuyển"),
        ("REVERSED", "Đã đảo bút toán"),
        ("STALE", "Dữ liệu nguồn thay đổi sau lần tính"),
        ("ERROR", "Lỗi tính toán"),
        ("CANCELLED", "Đã hủy"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    rule = models.ForeignKey(
        ClosingRule, on_delete=models.PROTECT, related_name="runs", null=True, blank=True
    )
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="closing_runs")
    run_type = models.CharField(max_length=40, default="PROFIT_LOSS_CLOSING")
    number = models.CharField(max_length=50, blank=True, default="")
    closing_to_date = models.DateField(null=True, blank=True)
    posting_date = models.DateField(null=True, blank=True)
    document_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True, default="")
    reference = models.CharField(max_length=255, blank=True, default="")
    attachments = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default="DRAFT")
    idempotency_key = models.CharField(max_length=150, null=True, blank=True, unique=True)
    total_revenue_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_expense_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    net_profit_loss = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    result_nature = models.CharField(max_length=20, default="ZERO")
    total_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    source_fingerprint = models.CharField(max_length=128, blank=True, default="")
    source_snapshot = models.JSONField(default=dict, blank=True)
    closing_lines_snapshot = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    entry = models.OneToOneField(
        JournalEntry, on_delete=models.PROTECT, related_name="closing_run", null=True, blank=True
    )
    reversal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.PROTECT,
        related_name="reversed_closing_runs",
        null=True,
        blank=True,
    )
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "gl_closing_run"
        ordering = ("-posting_date", "-created_at")


class ClosingRunLine(models.Model):
    """
    UC-GL-09 (Section 1.1.E, BR-GL-PL-26..28, 48..52, 82):
    Dòng hạch toán chi tiết của đợt kết chuyển lãi lỗ (TK Nợ, TK Có, Số tiền, Rule nguồn,
    Số tiền nguồn, Cờ tự sinh bởi hệ thống và Cờ chỉnh sửa thủ công).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    closing_run = models.ForeignKey(
        ClosingRun, on_delete=models.CASCADE, related_name="lines"
    )
    line_no = models.PositiveIntegerField(default=1)
    rule = models.ForeignKey(
        ClosingRule, on_delete=models.PROTECT, null=True, blank=True, related_name="run_lines"
    )
    rule_code = models.CharField(max_length=50, blank=True, default="")
    result_type = models.CharField(max_length=30, default="EXPENSE")
    description = models.CharField(max_length=500, blank=True, default="")
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="closing_run_account_lines",
    )
    debit_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="closing_run_debit_lines"
    )
    credit_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="closing_run_credit_lines"
    )
    debit_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    credit_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    source_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    already_closed_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    is_system_generated = models.BooleanField(default=True)
    manual_modified = models.BooleanField(default=False)
    sequence = models.PositiveIntegerField(default=1)
    source_details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "gl_closing_run_line"
        ordering = ("line_no", "sequence")


class BalanceAggregationRun(models.Model):
    """
    UC-GL-10 – Tổng hợp phát sinh, số dư và kiểm tra cân đối GL.
    Lưu trạng thái dữ liệu tổng hợp (PROCESSING, UP_TO_DATE, STALE, WARNING, ERROR),
    watermark phiên bản dữ liệu nguồn, tổng hợp số dư đầu kỳ / phát sinh / cuối kỳ,
    tổng hợp theo tài khoản (bao gồm lưỡng tính & tài khoản tổng hợp cha),
    tổng hợp theo các chiều hạch toán, ngoại tệ và kết quả các phép kiểm tra cân đối.
    """

    STATUS_CHOICES = (
        ("PROCESSING", "Đang tổng hợp dữ liệu"),
        ("UP_TO_DATE", "Đã cập nhật mới nhất (Đạt kiểm tra cân đối)"),
        ("STALE", "Có thay đổi bút toán mới chưa tổng hợp"),
        ("WARNING", "Hoàn tất tổng hợp nhưng có cảnh báo cần kiểm tra"),
        ("ERROR", "Lỗi tổng hợp hoặc mất cân đối nghiêm trọng"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.PROTECT,
        related_name="balance_aggregation_runs",
    )
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.PROTECT,
        related_name="balance_aggregation_runs",
    )
    mode = models.CharField(max_length=30, default="FULL_RECALCULATION")
    account_scope = models.CharField(max_length=50, default="ALL")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="UP_TO_DATE")
    watermark = models.CharField(max_length=128, blank=True, default="")
    posted_entries_count = models.PositiveIntegerField(default=0)
    total_opening_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_opening_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_period_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_period_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_closing_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_closing_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    is_balanced = models.BooleanField(default=True)
    checks_summary = models.JSONField(default=dict, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    errors = models.JSONField(default=list, blank=True)
    account_balances_snapshot = models.JSONField(default=list, blank=True)
    dimension_balances_snapshot = models.JSONField(default=list, blank=True)
    fx_balances_snapshot = models.JSONField(default=list, blank=True)
    triggered_by_event = models.CharField(max_length=80, blank=True, default="MANUAL")
    created_by = models.ForeignKey(
        "iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "gl_balance_aggregation_run"
        ordering = ("-started_at",)


class GlReconciliationRule(models.Model):
    """
    UC-GL-11 (Section 1.1.B, BR-GL-REC-05..28, 35..40, 81..82):
    Cấu hình quy tắc mapping và đối chiếu giữa Sổ cái (GL) và các phân hệ chi tiết
    (GL <-> AP, AR, CASH, BANK, INV, FA, TAX, TOOLS, PAYROLL, COST).
    """

    RECONCILIATION_TYPE_CHOICES = (
        ("GL_AP", "GL ↔ AP (Công nợ phải trả nhà cung cấp)"),
        ("GL_AR", "GL ↔ AR (Công nợ phải thu khách hàng)"),
        ("GL_CASH", "GL ↔ CASH (Tiền mặt / Sổ quỹ)"),
        ("GL_BANK", "GL ↔ BANK (Tiền gửi ngân hàng)"),
        ("GL_INV", "GL ↔ INV (Hàng tồn kho)"),
        ("GL_FA", "GL ↔ FA (Tài sản cố định & Khấu hao)"),
        ("GL_TAX", "GL ↔ TAX (Thuế GTGT / TNDN / Khác)"),
        ("GL_TOOLS", "GL ↔ TOOLS (Công cụ dụng cụ / Chi phí trả trước)"),
        ("GL_PAYROLL", "GL ↔ PAYROLL (Tiền lương & Bảo hiểm)"),
        ("GL_COST", "GL ↔ COST (Giá thành sản xuất)"),
    )

    TOLERANCE_BEHAVIOR_CHOICES = (
        ("MATCHED", "Đánh dấu MATCHED kèm ghi nhận chênh lệch làm tròn thực tế"),
        ("WARNING", "Đánh dấu WARNING khi có chênh lệch trong ngưỡng làm tròn"),
    )

    SEVERITY_ON_CLOSE_CHOICES = (
        ("BLOCK", "Chặn khóa kỳ kế toán nếu còn chênh lệch (BR-GL-REC-81, 82)"),
        ("WARN", "Cảnh báo trước khi khóa kỳ kế toán (BR-GL-REC-81, 82)"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.PROTECT,
        related_name="gl_reconciliation_rules",
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    reconciliation_type = models.CharField(
        max_length=30, choices=RECONCILIATION_TYPE_CHOICES, default="GL_AP"
    )
    source_module = models.CharField(max_length=30, default="AP")
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reconciliation_rules",
    )
    account_prefixes = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Danh sách đầu tài khoản GL cách nhau bởi dấu phẩy (VD: '331' hoặc '211,213,214')",
    )
    include_subaccounts = models.BooleanField(default=True)
    matching_keys = models.JSONField(
        default=list,
        blank=True,
        help_text="Khóa đối chiếu chuẩn hóa (VD: ['ACCOUNT', 'PARTY'] hoặc ['ACCOUNT', 'BANK_ACCOUNT', 'CURRENCY'])",
    )
    is_bilateral = models.BooleanField(
        default=False,
        help_text="Giữ riêng số dư Nợ/Có theo từng đối tượng trước khi tổng hợp (BR-GL-REC-13, 14)",
    )
    check_opening_balance = models.BooleanField(default=True)
    check_period_turnover = models.BooleanField(default=True)
    check_closing_balance = models.BooleanField(default=True)
    check_foreign_currency = models.BooleanField(default=False)
    rounding_tolerance = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    tolerance_behavior = models.CharField(
        max_length=20, choices=TOLERANCE_BEHAVIOR_CHOICES, default="MATCHED"
    )
    severity_on_period_close = models.CharField(
        max_length=20, choices=SEVERITY_ON_CLOSE_CHOICES, default="BLOCK"
    )
    is_mandatory_before_close = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_reconciliation_rule"
        ordering = ("reconciliation_type", "code")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "code"),
                name="uq_gl_reconciliation_rule_co_code",
            ),
        ]


class GlReconciliation(models.Model):
    """
    UC-GL-11 – Đối chiếu số liệu GL với các phân hệ (Reconciliation Run / Header).
    Hỗ trợ cả chế độ đối chiếu toàn diện theo Loại đối chiếu (GL <-> AP/AR/CASH/BANK/INV/FA/TAX)
    và tương thích ngược với API đối chiếu đơn lẻ theo tài khoản.
    """

    STATUS_CHOICES = (
        ("NOT_RUN", "Chưa thực hiện đối chiếu"),
        ("PROCESSING", "Đang lấy và so sánh dữ liệu"),
        ("MATCHED", "Khớp số liệu"),
        ("DIFFERENCE", "Có chênh lệch"),
        ("VARIANCE", "Có chênh lệch (Variance)"),
        ("WARNING", "Có cảnh báo cần chú ý"),
        ("ERROR", "Lỗi dữ liệu / cấu hình / hệ thống"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="reconciliations")
    rule = models.ForeignKey(
        GlReconciliationRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reconciliation_runs",
    )
    reconciliation_type = models.CharField(max_length=30, blank=True, default="GL_AP")
    source_module = models.CharField(max_length=30)
    account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True)
    branch = models.ForeignKey("organization.Branch", on_delete=models.SET_NULL, null=True, blank=True)
    party = models.ForeignKey("master_data.Party", on_delete=models.SET_NULL, null=True, blank=True)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.SET_NULL, null=True, blank=True)
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    scope_filter = models.JSONField(default=dict, blank=True)

    # Tương thích ngược và tổng hợp nhanh
    subledger_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    difference = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    # Tổng hợp chi tiết Đầu kỳ - Phát sinh - Cuối kỳ (BR-GL-REC-29..34)
    gl_opening_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_opening_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_period_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_period_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_closing_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_closing_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    sub_opening_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_opening_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_period_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_period_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_closing_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_closing_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    diff_opening = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    diff_period_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    diff_period_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    diff_closing = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_difference_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    matched_lines_count = models.PositiveIntegerField(default=0)
    difference_lines_count = models.PositiveIntegerField(default=0)
    warning_lines_count = models.PositiveIntegerField(default=0)
    error_lines_count = models.PositiveIntegerField(default=0)

    gl_aggregation_status = models.CharField(max_length=25, blank=True, default="VALID")
    snapshot_watermark = models.CharField(max_length=128, blank=True, default="")
    blocks_period_close = models.BooleanField(default=False)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="MATCHED")
    details = models.JSONField(default=dict, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    errors = models.JSONField(default=list, blank=True)
    reconciliation_lines_snapshot = models.JSONField(default=list, blank=True)
    resolved = models.BooleanField(default=False)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "gl_reconciliation"
        ordering = ("-created_at",)


class GlReconciliationLine(models.Model):
    """
    UC-GL-11 (Section 1.1.E, Steps 16-38, BR-GL-REC-38..49, 77..78, 93):
    Dòng kết quả đối chiếu chi tiết theo Khóa đối chiếu (Tài khoản + Đối tượng/Ngân hàng/Kho/Tài sản + Loại tiền).
    """

    STATUS_CHOICES = (
        ("MATCHED", "Khớp"),
        ("DIFFERENCE", "Chênh lệch"),
        ("WARNING", "Cảnh báo"),
        ("ERROR", "Lỗi dữ liệu / Mapping"),
    )

    DISCREPANCY_TYPE_CHOICES = (
        ("NONE", "Không có chênh lệch"),
        ("WITHIN_ROUNDING_TOLERANCE", "Chênh lệch làm tròn trong ngưỡng cho phép (AF-12)"),
        ("UNPOSTED_SUBLEDGER_VOUCHER", "Chưa ghi sổ - Có bút toán/chứng từ UNPOSTED (BR-GL-REC-04, 46)"),
        ("MISSING_GL_LINK", "Thiếu liên kết / Chứng từ phân hệ chưa sinh bút toán GL (EF-17, BR-GL-REC-43, 46)"),
        ("ORPHAN_GL_ENTRY", "Thiếu chứng từ nguồn / Có số liệu GL nhưng không có chi tiết phân hệ (AF-10, EF-18, BR-GL-REC-44)"),
        ("SUBLEDGER_ONLY_NO_GL", "Có dữ liệu phân hệ nhưng chưa có số liệu GL (AF-11)"),
        ("DUPLICATE_GL_POSTING", "Trùng bút toán - Một chứng từ nguồn sinh nhiều bút toán ngoài quy tắc (EF-19, BR-GL-REC-45, 46)"),
        ("WRONG_ACCOUNT_MAPPING", "Sai tài khoản mapping (EF-20, BR-GL-REC-46)"),
        ("WRONG_OBJECT_DIMENSION", "Sai đối tượng / chiều phân tích (EF-11, EF-21, BR-GL-REC-46)"),
        ("PERIOD_CUTOFF_MISMATCH", "Sai kỳ - Ngày hạch toán nằm ở hai kỳ khác nhau (EF-22, BR-GL-REC-46)"),
        ("AMOUNT_MISMATCH", "Sai số tiền giữa GL và phân hệ (EF-23, BR-GL-REC-46)"),
        ("OPENING_BALANCE_MISMATCH", "Chênh lệch số dư đầu kỳ (EF-12, BR-GL-REC-32, 33)"),
        ("TURNOVER_OFFSET_MISMATCH", "Số dư cuối kỳ khớp nhưng phát sinh Nợ/Có trong kỳ lệch (BR-GL-REC-30, 31)"),
        ("FOREIGN_CURRENCY_MISMATCH", "Giá trị quy đổi khớp nhưng nguyên tệ không khớp (EF-15, BR-GL-REC-19, 89, 90)"),
        ("BILATERAL_OFFSET_MISMATCH", "Lệch bù trừ công nợ lưỡng tính giữa các đối tượng (BR-GL-REC-13, 14, 92)"),
        ("MAPPING_KEY_MISSING", "Không xác định được khóa mapping của dữ liệu (EF-10)"),
        ("UNDETERMINED", "Chưa xác định nguyên nhân tự động (AF-13, BR-GL-REC-46, 47)"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reconciliation = models.ForeignKey(
        GlReconciliation,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_no = models.PositiveIntegerField(default=1)
    reconciliation_key = models.CharField(max_length=255)
    account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True)
    account_code = models.CharField(max_length=30, blank=True, default="")
    account_name = models.CharField(max_length=255, blank=True, default="")
    party = models.ForeignKey("master_data.Party", on_delete=models.SET_NULL, null=True, blank=True)
    object_code = models.CharField(max_length=100, blank=True, default="")
    object_name = models.CharField(max_length=255, blank=True, default="")
    object_type = models.CharField(max_length=40, blank=True, default="")
    currency_code = models.CharField(max_length=10, blank=True, default="VND")

    gl_opening_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_opening_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_period_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_period_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_closing_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_closing_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_net_closing = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    gl_foreign_closing = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    sub_opening_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_opening_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_period_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_period_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_closing_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_closing_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_net_closing = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sub_foreign_closing = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    diff_opening = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    diff_period_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    diff_period_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    diff_closing = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    diff_foreign = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="MATCHED")
    discrepancy_type = models.CharField(
        max_length=60, choices=DISCREPANCY_TYPE_CHOICES, default="NONE"
    )
    discrepancy_reason = models.CharField(max_length=500, blank=True, default="")
    discrepancy_vouchers_count = models.PositiveIntegerField(default=0)
    gl_entries_refs = models.JSONField(default=list, blank=True)
    subledger_vouchers_refs = models.JSONField(default=list, blank=True)
    note = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "gl_reconciliation_line"
        ordering = ("line_no", "account_code", "object_code")


class PrepaidExpense(models.Model):
    """A prepaid cost (TK 242) allocated to expense accounts over a number of periods."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Đang phân bổ"
        COMPLETED = "COMPLETED", "Đã phân bổ hết"
        STOPPED = "STOPPED", "Ngừng phân bổ"
        DECREASED = "DECREASED", "Đã ghi giảm"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    record_date = models.DateField()
    start_date = models.DateField()
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    allocation_periods = models.PositiveIntegerField()
    prepaid_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="prepaid_expenses")
    is_opening = models.BooleanField(default=False)
    opening_allocated_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    opening_allocated_periods = models.PositiveIntegerField(default=0)
    allocated_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    allocated_periods = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_prepaid_expense"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_gl_prepaid_expense_code"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_gl_prepaid_amount_positive"),
            models.CheckConstraint(condition=Q(allocation_periods__gt=0), name="ck_gl_prepaid_periods_positive"),
        ]

    @property
    def remaining_amount(self):
        base_rem = self.amount - self.opening_allocated_amount - self.allocated_amount
        if hasattr(self, "_decreased_amount_cache"):
            return max(Decimal("0"), base_rem - self._decreased_amount_cache)
        try:
            from fixed_assets.models import AssetRecord
            comp = (
                AssetRecord.objects.filter(
                    company_id=self.company_id,
                    source_module="PREPAID_EXPENSE",
                    code__iexact=self.code,
                )
                .only("accessories")
                .first()
            )
            if comp and isinstance(comp.accessories, list) and comp.accessories:
                meta = comp.accessories[0] if isinstance(comp.accessories[0], dict) else {}
                dec_val = meta.get("decreased_amount")
                if dec_val is not None:
                    return max(Decimal("0"), base_rem - Decimal(str(dec_val)))
        except Exception:
            pass
        return max(Decimal("0"), base_rem)

    @property
    def remaining_periods(self):
        return max(self.allocation_periods - self.opening_allocated_periods - self.allocated_periods, 0)


class PrepaidExpenseTarget(models.Model):
    """Where each period's allocation goes: an expense account and its share."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prepaid = models.ForeignKey(PrepaidExpense, on_delete=models.CASCADE, related_name="targets")
    line_no = models.PositiveIntegerField()
    expense_account = models.ForeignKey(Account, on_delete=models.PROTECT)
    rate = models.DecimalField(max_digits=9, decimal_places=4)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "gl_prepaid_expense_target"
        ordering = ("line_no",)


class PrepaidAllocation(models.Model):
    """One period's allocation voucher (Nợ TK chi phí / Có 242), or a write-off of the remainder."""

    class Kind(models.TextChoices):
        ALLOCATION = "ALLOCATION", "Phân bổ"
        DECREASE = "DECREASE", "Ghi giảm"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    number = models.CharField(max_length=80)
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="prepaid_allocations")
    document_date = models.DateField()
    posting_date = models.DateField()
    description = models.CharField(max_length=500, blank=True)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4)
    entry = models.OneToOneField(JournalEntry, on_delete=models.PROTECT, related_name="prepaid_allocation")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gl_prepaid_allocation"
        ordering = ("-posting_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_gl_prepaid_allocation_number")]


class PrepaidAllocationLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    allocation = models.ForeignKey(PrepaidAllocation, on_delete=models.CASCADE, related_name="lines")
    prepaid = models.ForeignKey(PrepaidExpense, on_delete=models.PROTECT, related_name="allocation_lines")
    expense_account = models.ForeignKey(Account, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=24, decimal_places=4)

    class Meta:
        db_table = "gl_prepaid_allocation_line"


class AdvanceRequestStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ duyệt"
    RETURNED = "RETURNED", "Yêu cầu bổ sung"
    APPROVED = "APPROVED", "Đã duyệt"
    REJECTED = "REJECTED", "Từ chối"
    CANCELLED = "CANCELLED", "Đã hủy"


class AdvanceRequestSyncStatus(models.TextChoices):
    NOT_SYNCED = "NOT_SYNCED", "Chưa đồng bộ"
    SYNC_PENDING = "SYNC_PENDING", "Chờ đồng bộ"
    SYNCED = "SYNCED", "Đã đồng bộ"
    SYNC_ERROR = "SYNC_ERROR", "Lỗi đồng bộ"


class AdvanceSettlementRequest(models.Model):
    """
    UC-GL-01: Đề nghị quyết toán tạm ứng.
    Ghi nhận đề nghị quyết toán của nhân viên, theo dõi quy trình phê duyệt đa cấp,
    đồng bộ cho kế toán kế thừa tại UC-GL-02 mà không làm phát sinh bút toán Nợ/Có.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.PROTECT,
        related_name="advance_settlement_requests",
    )
    branch = models.ForeignKey(
        "organization.Branch",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="advance_settlement_requests",
    )
    number = models.CharField(max_length=80)
    request_date = models.DateField(default=timezone.localdate)
    requester = models.ForeignKey(
        "organization.Employee",
        on_delete=models.PROTECT,
        related_name="advance_settlement_requests",
    )
    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="advance_settlement_requests",
    )
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    purpose = models.TextField()
    status = models.CharField(
        max_length=32,
        choices=AdvanceRequestStatus.choices,
        default=AdvanceRequestStatus.PENDING_APPROVAL,
    )
    sync_status = models.CharField(
        max_length=32,
        choices=AdvanceRequestSyncStatus.choices,
        default=AdvanceRequestSyncStatus.NOT_SYNCED,
    )
    sync_error_message = models.TextField(blank=True, default="")
    synced_at = models.DateTimeField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=120, blank=True, default="")
    workflow_snapshot = models.JSONField(default=dict, blank=True)
    current_approval_level = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.PROTECT,
        related_name="created_advance_requests",
    )
    approved_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_advance_requests",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")
    settlement_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inherited_advance_requests",
    )
    settlement_voucher_no = models.CharField(max_length=80, blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_advance_settlement_request"
        ordering = ("-request_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "number"),
                name="uq_gl_adv_settlement_req_number",
            ),
        ]
        indexes = [
            models.Index(fields=("company", "status"), name="ix_gl_adv_req_comp_status"),
            models.Index(fields=("company", "requester"), name="ix_gl_adv_req_comp_requester"),
            models.Index(fields=("company", "idempotency_key"), name="ix_gl_adv_req_comp_idemp"),
        ]


class AdvanceSettlementVoucherStatus(models.TextChoices):
    UNPOSTED = "UNPOSTED", "Chưa ghi sổ"
    POSTED = "POSTED", "Đã ghi sổ"
    CANCELLED = "CANCELLED", "Đã hủy"


class AdvanceSettlementVoucher(models.Model):
    """
    UC-GL-02: Chứng từ quyết toán tạm ứng.
    Lưu thông tin chung, các dòng hạch toán Nợ/Có, kê khai hóa đơn & thuế GTGT,
    liên kết đề nghị quyết toán (UC-GL-01) và khoản tạm ứng nguồn, đồng thời giữ
    trạng thái Chưa ghi sổ (UNPOSTED) cho tới khi thực hiện Ghi sổ (UC-GL-05).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.PROTECT,
        related_name="advance_settlement_vouchers",
    )
    branch = models.ForeignKey(
        "organization.Branch",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="advance_settlement_vouchers",
    )
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.PROTECT,
        related_name="advance_settlement_vouchers",
    )
    number = models.CharField(max_length=80)
    posting_date = models.DateField(default=timezone.localdate)
    document_date = models.DateField(default=timezone.localdate)
    employee = models.ForeignKey(
        "organization.Employee",
        on_delete=models.PROTECT,
        related_name="advance_settlement_vouchers",
    )
    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="advance_settlement_vouchers",
    )
    description = models.CharField(max_length=500, default="Quyết toán tạm ứng")
    settle_per_advance = models.BooleanField(default=False)
    group_invoices = models.BooleanField(default=False)
    advance_request = models.ForeignKey(
        AdvanceSettlementRequest,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="settlement_vouchers",
    )
    cash_advance = models.ForeignKey(
        "cash_management.CashAdvance",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="gl_settlement_vouchers",
    )
    source_advance_ref = models.CharField(max_length=120, blank=True, default="")
    source_advance_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    references = models.JSONField(default=list, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    accounting_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    status = models.CharField(
        max_length=20,
        choices=AdvanceSettlementVoucherStatus.choices,
        default=AdvanceSettlementVoucherStatus.UNPOSTED,
    )
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        related_name="advance_settlement_voucher",
    )
    idempotency_key = models.CharField(max_length=120, blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.PROTECT,
        related_name="created_advance_settlement_vouchers",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_advance_settlement_voucher"
        ordering = ("-posting_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "number"),
                name="uq_gl_adv_settlement_voucher_number",
            ),
        ]
        indexes = [
            models.Index(fields=("company", "status"), name="ix_gl_adv_vch_comp_status"),
            models.Index(fields=("company", "employee"), name="ix_gl_adv_vch_comp_emp"),
            models.Index(fields=("company", "idempotency_key"), name="ix_gl_adv_vch_comp_idemp"),
        ]


class AdvanceSettlementLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voucher = models.ForeignKey(
        AdvanceSettlementVoucher,
        on_delete=models.CASCADE,
        related_name="accounting_lines",
    )
    line_no = models.PositiveIntegerField()
    description = models.CharField(max_length=500, blank=True, default="")
    debit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="advance_settlement_debit_lines",
    )
    credit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="advance_settlement_credit_lines",
    )
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    debit_object_code = models.CharField(max_length=80, blank=True, default="")
    debit_object_name = models.CharField(max_length=255, blank=True, default="")
    credit_object_code = models.CharField(max_length=80, blank=True, default="")
    credit_object_name = models.CharField(max_length=255, blank=True, default="")
    party = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True)
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True)
    project = models.ForeignKey("master_data.Project", on_delete=models.PROTECT, null=True, blank=True)
    cost_center = models.ForeignKey("master_data.CostCenter", on_delete=models.PROTECT, null=True, blank=True)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    dimensions = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "gl_advance_settlement_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("voucher", "line_no"), name="uq_gl_adv_settlement_line_no"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_gl_adv_settlement_line_amt_pos"),
        ]


class AdvanceSettlementTaxLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voucher = models.ForeignKey(
        AdvanceSettlementVoucher,
        on_delete=models.CASCADE,
        related_name="tax_lines",
    )
    line_no = models.PositiveIntegerField()
    description = models.CharField(max_length=500, blank=True, default="Thuế GTGT đầu vào")
    tax_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="advance_settlement_tax_debit_lines",
    )
    credit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="advance_settlement_tax_credit_lines",
    )
    goods_group = models.CharField(max_length=50, blank=True, default="1")
    pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    vat_rate = models.CharField(max_length=20, blank=True, default="10")
    vat_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    invoice_date = models.DateField(null=True, blank=True)
    invoice_number = models.CharField(max_length=80, blank=True, default="")
    invoice_form = models.CharField(max_length=50, blank=True, default="")
    invoice_serial = models.CharField(max_length=50, blank=True, default="")
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True)
    supplier_code = models.CharField(max_length=80, blank=True, default="")
    supplier_name = models.CharField(max_length=255, blank=True, default="")
    supplier_tax_code = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        db_table = "gl_advance_settlement_tax_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("voucher", "line_no"), name="uq_gl_adv_settlement_tax_line_no"),
            models.CheckConstraint(
                condition=Q(pre_tax_amount__gte=0, vat_amount__gte=0),
                name="ck_gl_adv_settlement_tax_nonneg",
            ),
        ]


class GeneralBusinessType(models.TextChoices):
    CIT_PAYABLE = "CIT_PAYABLE", "1. Hạch toán thuế TNDN phải nộp"
    BANK_LOAN_TO_SUPPLIER = "BANK_LOAN_TO_SUPPLIER", "2. Vay ngân hàng chuyển trả cho nhà cung cấp"
    SALARY_EXPENSE = "SALARY_EXPENSE", "3. Hạch toán chi phí lương"
    OTHER = "OTHER", "4. Khác"
    OPENING_PROFIT_LOSS_TRANSFER = "OPENING_PROFIT_LOSS_TRANSFER", "5. Kết chuyển lãi lỗ đầu năm"
    SCT_DEDUCTION = "SCT_DEDUCTION", "6. Khấu trừ thuế tiêu thụ đặc biệt"


class GeneralVoucherStatus(models.TextChoices):
    UNPOSTED = "UNPOSTED", "Chưa ghi sổ"
    POSTED = "POSTED", "Đã ghi sổ"
    REVERSED = "REVERSED", "Đã đảo"


class GeneralBusinessVoucher(models.Model):
    """
    UC-GL-03 – Chứng từ nghiệp vụ khác (NVK00001).
    Sau khi lập tại UC-GL-03, chứng từ ở trạng thái UNPOSTED (Chưa ghi sổ)
    và chỉ ghi nhận vào Sổ cái chính thức khi thực hiện Ghi sổ (UC-GL-05).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="general_business_vouchers",
    )
    number = models.CharField(max_length=50)
    business_type = models.CharField(
        max_length=40,
        choices=GeneralBusinessType.choices,
        default=GeneralBusinessType.CIT_PAYABLE,
    )
    business_type_label = models.CharField(max_length=150, blank=True, default="")
    closing_year = models.PositiveIntegerField(null=True, blank=True)
    posting_date = models.DateField(default=timezone.localdate)
    document_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(null=True, blank=True)
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.PROTECT,
        related_name="general_business_vouchers",
    )
    description = models.CharField(max_length=500, blank=True, default="")
    references = models.CharField(max_length=500, blank=True, default="")
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=24, decimal_places=8, default=1)
    group_invoices = models.BooleanField(default=False)
    exclude_from_vat_declaration = models.BooleanField(default=False)
    total_accounting_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    attachments = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20,
        choices=GeneralVoucherStatus.choices,
        default=GeneralVoucherStatus.UNPOSTED,
    )
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="general_business_voucher",
    )
    idempotency_key = models.CharField(max_length=120, blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_general_business_vouchers",
    )
    updated_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_general_business_vouchers",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_general_business_voucher"
        ordering = ("-posting_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "number"),
                name="uq_gl_gen_business_voucher_company_no",
            ),
            models.CheckConstraint(
                condition=Q(total_amount__gt=0),
                name="ck_gl_gen_business_voucher_total_pos",
            ),
        ]
        indexes = [
            models.Index(fields=("company", "status", "posting_date"), name="ix_gl_gbv_co_st_date"),
            models.Index(fields=("company", "business_type"), name="ix_gl_gbv_co_btype"),
        ]


class GeneralBusinessVoucherLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voucher = models.ForeignKey(
        GeneralBusinessVoucher,
        on_delete=models.CASCADE,
        related_name="accounting_lines",
    )
    line_no = models.PositiveIntegerField()
    description = models.CharField(max_length=500, blank=True, default="")
    debit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="general_voucher_debit_lines",
    )
    credit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="general_voucher_credit_lines",
    )
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    operation = models.CharField(max_length=120, blank=True, default="")
    debit_object_code = models.CharField(max_length=80, blank=True, default="")
    debit_object_name = models.CharField(max_length=255, blank=True, default="")
    credit_object_code = models.CharField(max_length=80, blank=True, default="")
    credit_object_name = models.CharField(max_length=255, blank=True, default="")
    loan_contract = models.CharField(max_length=120, blank=True, default="")
    expense_item = models.CharField(max_length=120, blank=True, default="")
    department_name = models.CharField(max_length=255, blank=True, default="")
    cost_object = models.CharField(max_length=120, blank=True, default="")
    party = models.ForeignKey(
        "master_data.Party",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="general_voucher_debit_parties",
    )
    credit_party = models.ForeignKey(
        "master_data.Party",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="general_voucher_credit_parties",
    )
    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        "master_data.Project",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    cost_center = models.ForeignKey(
        "master_data.CostCenter",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    dimensions = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "gl_general_business_voucher_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("voucher", "line_no"), name="uq_gl_gbv_line_no"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_gl_gbv_line_amt_pos"),
        ]


class GeneralBusinessVoucherTaxLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voucher = models.ForeignKey(
        GeneralBusinessVoucher,
        on_delete=models.CASCADE,
        related_name="tax_lines",
    )
    line_no = models.PositiveIntegerField()
    description = models.CharField(max_length=500, blank=True, default="Thuế GTGT đầu vào")
    tax_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="general_voucher_tax_debit_lines",
    )
    credit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="general_voucher_tax_credit_lines",
    )
    goods_group = models.CharField(max_length=50, blank=True, default="1")
    pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    vat_rate = models.CharField(max_length=20, blank=True, default="10")
    vat_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    invoice_date = models.DateField(null=True, blank=True)
    invoice_number = models.CharField(max_length=80, blank=True, default="")
    invoice_form = models.CharField(max_length=50, blank=True, default="")
    invoice_serial = models.CharField(max_length=50, blank=True, default="")
    supplier = models.ForeignKey(
        "master_data.Party",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    supplier_code = models.CharField(max_length=80, blank=True, default="")
    supplier_name = models.CharField(max_length=255, blank=True, default="")
    supplier_tax_code = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        db_table = "gl_general_business_voucher_tax_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("voucher", "line_no"), name="uq_gl_gbv_tax_line_no"),
            models.CheckConstraint(
                condition=Q(pre_tax_amount__gte=0, vat_amount__gte=0),
                name="ck_gl_gbv_tax_nonneg",
            ),
        ]


class SubledgerSourceModule(models.TextChoices):
    PUR = "PUR", "Mua hàng"
    AP = "AP", "Công nợ phải trả"
    SAL = "SAL", "Bán hàng"
    AR = "AR", "Công nợ phải thu"
    CASH = "CASH", "Tiền mặt / Quỹ"
    BANK = "BANK", "Tiền gửi ngân hàng"
    INV = "INV", "Kho"
    FA = "FA", "Tài sản cố định"
    TOOLS = "TOOLS", "Công cụ dụng cụ / Chi phí trả trước"
    PAYROLL = "PAYROLL", "Tiền lương"
    TAX = "TAX", "Thuế"
    COST = "COST", "Giá thành"
    GL = "GL", "Tổng hợp / Nội bộ GL"


class SubledgerIngestionStatus(models.TextChoices):
    RECEIVED = "RECEIVED", "Đã tiếp nhận yêu cầu hạch toán"
    UNPOSTED = "UNPOSTED", "Đã tạo bút toán GL chưa ghi sổ"
    POSTED = "POSTED", "Đã tạo và ghi sổ vào Sổ cái"
    ERROR = "ERROR", "Tiếp nhận hoặc ghi sổ thất bại"
    REVERSED = "REVERSED", "Bút toán đã bị đảo hoặc hủy hiệu lực"


class SubledgerPostingMode(models.TextChoices):
    AUTO_POST = "AUTO_POST", "Tự động ghi sổ khi tiếp nhận"
    UNPOSTED = "UNPOSTED", "Tiếp nhận ở trạng thái chưa ghi sổ"
    WORKFLOW = "WORKFLOW", "Chuyển vào quy trình phê duyệt trước khi ghi sổ"


class SubledgerCallbackStatus(models.TextChoices):
    SYNCED = "SYNCED", "Đã phản hồi trạng thái về phân hệ nguồn"
    FAILED = "FAILED", "Phản hồi phân hệ nguồn thất bại (cần đồng bộ lại)"
    NOT_REQUIRED = "NOT_REQUIRED", "Không yêu cầu phản hồi"


class SubledgerPostingRule(models.Model):
    """
    UC-GL-04 (AF-02, BR-GL-INT-11..13) – Cấu hình quy tắc định khoản cho bút toán
    từ các phân hệ nguồn (PUR, AP, SAL, AR, CASH, BANK, INV, FA, TOOLS, PAYROLL, TAX, COST).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="subledger_posting_rules",
    )
    source_module = models.CharField(
        max_length=30,
        choices=SubledgerSourceModule.choices,
    )
    source_business_type = models.CharField(max_length=80)
    source_document_type = models.CharField(max_length=80, blank=True, default="")
    name = models.CharField(max_length=255)
    debit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="subledger_rule_debit_accounts",
    )
    credit_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="subledger_rule_credit_accounts",
    )
    tax_account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="subledger_rule_tax_accounts",
    )
    posting_mode = models.CharField(
        max_length=20,
        choices=SubledgerPostingMode.choices,
        default=SubledgerPostingMode.AUTO_POST,
    )
    description_template = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_subledger_posting_rule"
        ordering = ("source_module", "source_business_type")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "source_module", "source_business_type"),
                name="uq_gl_subledger_rule_co_mod_btype",
            ),
        ]
        indexes = [
            models.Index(
                fields=("company", "source_module", "is_active"),
                name="ix_gl_sub_rule_co_mod_act",
            ),
        ]


class SubledgerJournalIngestion(models.Model):
    """
    UC-GL-04 – Tiếp nhận bút toán từ các phân hệ.
    Lưu nhật ký tiếp nhận, liên kết chứng từ nguồn <-> bút toán GL, trạng thái xử lý
    (RECEIVED / UNPOSTED / POSTED / ERROR / REVERSED) và trạng thái callback phân hệ nguồn.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="subledger_journal_ingestions",
    )
    source_module = models.CharField(
        max_length=30,
        choices=SubledgerSourceModule.choices,
    )
    source_business_type = models.CharField(max_length=80)
    source_document_type = models.CharField(max_length=80)
    source_document_id = models.CharField(max_length=120)
    source_document_number = models.CharField(max_length=80)
    source_document_status = models.CharField(max_length=40, default="ELIGIBLE")
    source_event_id = models.CharField(max_length=120)
    document_date = models.DateField(default=timezone.localdate)
    posting_date = models.DateField(default=timezone.localdate)
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subledger_journal_ingestions",
    )
    description = models.CharField(max_length=500, blank=True, default="")
    currency = models.ForeignKey(
        "master_data.Currency",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    exchange_rate = models.DecimalField(max_digits=24, decimal_places=8, default=1)
    total_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    posting_mode = models.CharField(
        max_length=20,
        choices=SubledgerPostingMode.choices,
        default=SubledgerPostingMode.AUTO_POST,
    )
    status = models.CharField(
        max_length=20,
        choices=SubledgerIngestionStatus.choices,
        default=SubledgerIngestionStatus.RECEIVED,
    )
    callback_status = models.CharField(
        max_length=20,
        choices=SubledgerCallbackStatus.choices,
        default=SubledgerCallbackStatus.SYNCED,
    )
    callback_error = models.CharField(max_length=500, blank=True, default="")
    error_code = models.CharField(max_length=80, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    retry_count = models.PositiveIntegerField(default=0)
    primary_journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="primary_subledger_ingestions",
    )
    journal_entries = models.ManyToManyField(
        JournalEntry,
        blank=True,
        related_name="subledger_ingestions",
    )
    posting_rule = models.ForeignKey(
        SubledgerPostingRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ingestions",
    )
    raw_payload = models.JSONField(default=dict, blank=True)
    resolved_lines = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_subledger_ingestions",
    )
    updated_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_subledger_ingestions",
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_subledger_journal_ingestion"
        ordering = ("-posting_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "source_event_id"),
                name="uq_gl_subledger_ingestion_co_event",
            ),
        ]
        indexes = [
            models.Index(
                fields=("company", "status", "posting_date"),
                name="ix_gl_sub_ing_co_st_date",
            ),
            models.Index(
                fields=("company", "source_module", "source_document_id"),
                name="ix_gl_sub_ing_co_mod_doc",
            ),
            models.Index(
                fields=("company", "source_document_number"),
                name="ix_gl_sub_ing_co_doc_no",
            ),
        ]


# ==============================================================================
# UC-GL-13 – LẬP BÁO CÁO TÀI CHÍNH (FINANCIAL STATEMENTS - TT99/2025/TT-BTC)
# ==============================================================================


class FinancialStatementMappingRule(models.Model):
    """
    UC-GL-13 (Section 1.1.E, Steps 22–38, AF-14, BR-GL-FS-07..15, 53..59):
    Cấu hình quy tắc ánh xạ (Mapping) từ hệ thống tài khoản / chỉ tiêu kế toán
    sang chỉ tiêu Báo cáo tài chính theo Thông tư 99/2025/TT-BTC (hỗ trợ quản lý phiên bản mapping).
    """

    FORM_CODE_CHOICES = (
        ("B01-DN", "B01-DN – Báo cáo tình hình tài chính (Hoạt động liên tục)"),
        ("B02-DN", "B02-DN – Báo cáo kết quả hoạt động kinh doanh (Hoạt động liên tục)"),
        ("B03-DN", "B03-DN – Báo cáo lưu chuyển tiền tệ (Hoạt động liên tục)"),
        ("B09-DN", "B09-DN – Bản thuyết minh Báo cáo tài chính (Hoạt động liên tục)"),
        ("B01-DNKLT", "B01-DNKLT – Báo cáo tình hình tài chính (Không đáp ứng giả định hoạt động liên tục)"),
        ("B02-DNKLT", "B02-DNKLT – Báo cáo kết quả hoạt động kinh doanh (Không đáp ứng giả định hoạt động liên tục)"),
        ("B03-DNKLT", "B03-DNKLT – Báo cáo lưu chuyển tiền tệ (Không đáp ứng giả định hoạt động liên tục)"),
        ("B09-DNKLT", "B09-DNKLT – Bản thuyết minh Báo cáo tài chính (Không đáp ứng giả định hoạt động liên tục)"),
        ("B01a-DN", "B01a-DN – Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)"),
        ("B02a-DN", "B02a-DN – Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)"),
        ("B03a-DN", "B03a-DN – Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ)"),
        ("B09a-DN", "B09a-DN – Bản thuyết minh Báo cáo tài chính chọn lọc (Giữa niên độ)"),
        ("B01b-DN", "B01b-DN – Báo cáo tình hình tài chính giữa niên độ (Dạng tóm lược)"),
        ("B02b-DN", "B02b-DN – Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng tóm lược)"),
        ("B03b-DN", "B03b-DN – Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng tóm lược)"),
    )

    CASH_FLOW_METHOD_CHOICES = (
        ("", "Không áp dụng"),
        ("DIRECT", "Phương pháp trực tiếp"),
        ("INDIRECT", "Phương pháp gián tiếp"),
    )

    SOURCE_TYPE_CHOICES = (
        ("ACCOUNT_BALANCE", "Số dư tài khoản Sổ cái"),
        ("BILATERAL_PARTNER_BALANCE", "Số dư tài khoản lưỡng tính theo từng đối tượng chi tiết (BR-GL-FS-54..56)"),
        ("PERIOD_TURNOVER", "Phát sinh lũy kế trong kỳ báo cáo (trước kết chuyển 911)"),
        ("CASHFLOW_COUNTERPART", "Luồng tiền phát sinh theo cặp đối ứng tài khoản tiền (111, 112, 113)"),
        ("FORMULA", "Công thức tổng hợp từ các mã số chỉ tiêu khác"),
        ("MANUAL_NOTE", "Chỉ tiêu thuyết minh / nhập liệu bổ sung"),
    )

    BALANCE_SIDE_CHOICES = (
        ("NET_DEBIT", "Dư Nợ thuần (Nợ - Có)"),
        ("NET_CREDIT", "Dư Có thuần (Có - Nợ)"),
        ("DEBIT_ONLY", "Chỉ lấy Dư Nợ dương"),
        ("CREDIT_ONLY", "Chỉ lấy Dư Có dương"),
        ("PARTNER_DEBIT", "Tổng Dư Nợ chi tiết theo từng đối tượng (Không bù trừ chéo)"),
        ("PARTNER_CREDIT", "Tổng Dư Có chi tiết theo từng đối tượng (Không bù trừ chéo)"),
        ("TURNOVER_DEBIT", "Phát sinh Nợ trong kỳ"),
        ("TURNOVER_CREDIT", "Phát sinh Có trong kỳ"),
        ("NET_TURNOVER_DEBIT", "Phát sinh Nợ thuần (PS Nợ - PS Có)"),
        ("NET_TURNOVER_CREDIT", "Phát sinh Có thuần (PS Có - PS Nợ)"),
        ("FORMULA", "Tính theo biểu thức công thức"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="financial_statement_mapping_rules",
    )
    mapping_version = models.CharField(max_length=40, default="TT99-2025-V1")
    form_code = models.CharField(max_length=30, choices=FORM_CODE_CHOICES, default="B01-DN")
    cash_flow_method = models.CharField(
        max_length=20, choices=CASH_FLOW_METHOD_CHOICES, blank=True, default=""
    )
    section_code = models.CharField(max_length=50, blank=True, default="ASSETS")
    indicator_code = models.CharField(max_length=30)
    indicator_name = models.CharField(max_length=500)
    note_ref = models.CharField(max_length=50, blank=True, default="")
    sequence = models.PositiveIntegerField(default=10)
    level = models.PositiveSmallIntegerField(default=1)
    is_total_line = models.BooleanField(default=False)
    is_mandatory = models.BooleanField(default=True)
    is_custom_indicator = models.BooleanField(
        default=False,
        help_text="Chỉ tiêu bổ sung/tùy chỉnh theo quyền hạn doanh nghiệp tại TT99 (AF-14, BR-GL-FS-13..15)",
    )
    parent_indicator_code = models.CharField(max_length=30, blank=True, default="")
    source_type = models.CharField(
        max_length=40, choices=SOURCE_TYPE_CHOICES, default="ACCOUNT_BALANCE"
    )
    account_prefixes = models.JSONField(default=list, blank=True)
    counterpart_prefixes = models.JSONField(default=list, blank=True)
    balance_side = models.CharField(
        max_length=30, choices=BALANCE_SIDE_CHOICES, default="NET_DEBIT"
    )
    sign = models.SmallIntegerField(
        default=1,
        help_text="Hệ số dấu (+1 hoặc -1, ví dụ -1 cho Hao mòn TSCĐ 214 hoặc Dự phòng 229)",
    )
    formula_expression = models.CharField(max_length=500, blank=True, default="")
    disclosure_note = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Thuyết minh nguyên tắc trình bày / bổ sung chỉ tiêu tùy chỉnh trên B09 (BR-GL-FS-14)",
    )
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_financial_statement_mapping_rule"
        ordering = ("form_code", "cash_flow_method", "sequence", "indicator_code")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "mapping_version", "form_code", "cash_flow_method", "indicator_code"),
                name="uq_gl_fs_map_rule_co_ver_form_ind",
            ),
        ]


class FinancialStatementBatch(models.Model):
    """
    UC-GL-13 – Phiên bản bộ Báo cáo tài chính (Financial Statement Version / Batch).
    Quản lý vòng đời phiên bản BCTC (DRAFT, GENERATED, REVIEW_REQUIRED, FINALIZED, OUTDATED, CANCELLED),
    tham số kỳ báo cáo, giả định hoạt động liên tục (CONTINUOUS / NON_CONTINUOUS),
    dạng báo cáo giữa niên độ (FULL / CONDENSED), phương pháp lưu chuyển tiền tệ (DIRECT / INDIRECT),
    đơn vị trình bày tiền tệ, kết quả kiểm tra điều kiện nguồn & kiểm tra chéo giữa các báo cáo,
    nội dung Thuyết minh BCTC và dấu vết dữ liệu nguồn (source_watermark).
    """

    REPORT_GROUP_CHOICES = (
        ("ANNUAL_BCTC", "Báo cáo tài chính năm"),
        ("ANNUAL_NOTES", "Thuyết minh Báo cáo tài chính năm"),
        ("INTERIM_BCTC", "Báo cáo tài chính giữa niên độ"),
        ("INTERIM_NOTES", "Thuyết minh Báo cáo tài chính giữa niên độ"),
    )

    GOING_CONCERN_CHOICES = (
        ("CONTINUOUS", "Doanh nghiệp đáp ứng giả định hoạt động liên tục (B01-DN, B02-DN, B03-DN, B09-DN)"),
        ("NON_CONTINUOUS", "Doanh nghiệp không đáp ứng giả định hoạt động liên tục (B01-DNKLT, B02-DNKLT, B03-DNKLT, B09-DNKLT)"),
    )

    INTERIM_FORMAT_CHOICES = (
        ("NONE", "Không áp dụng (BCTC năm)"),
        ("FULL", "Dạng đầy đủ (B01a-DN, B02a-DN, B03a-DN, B09a-DN)"),
        ("CONDENSED", "Dạng tóm lược (B01b-DN, B02b-DN, B03b-DN, B09a-DN)"),
    )

    CASH_FLOW_METHOD_CHOICES = (
        ("DIRECT", "Phương pháp trực tiếp"),
        ("INDIRECT", "Phương pháp gián tiếp"),
        ("BOTH", "Đồng thời Trực tiếp & Gián tiếp"),
    )

    STATUS_CHOICES = (
        ("DRAFT", "Bản nháp"),
        ("GENERATED", "Đã lập (Đạt kiểm tra cơ bản)"),
        ("REVIEW_REQUIRED", "Cần kiểm tra (Có cảnh báo hoặc chênh lệch logic)"),
        ("FINALIZED", "Đã chốt BCTC chính thức"),
        ("OUTDATED", "Cần lập lại (Dữ liệu nguồn thay đổi / Kỳ đã mở lại)"),
        ("CANCELLED", "Đã hủy"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.PROTECT,
        related_name="financial_statement_batches",
    )
    branch = models.ForeignKey(
        "organization.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_statement_batches",
    )
    period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="financial_statement_batches",
    )
    comparison_period = models.ForeignKey(
        AccountingPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comparison_financial_statement_batches",
    )
    batch_number = models.CharField(max_length=80)
    report_group = models.CharField(
        max_length=30, choices=REPORT_GROUP_CHOICES, default="ANNUAL_BCTC"
    )
    period_type = models.CharField(max_length=30, default="YEAR")
    period_label = models.CharField(max_length=120, blank=True, default="Năm 2026")
    fiscal_year = models.PositiveIntegerField(default=2026)
    from_date = models.DateField()
    to_date = models.DateField()
    comparison_from_date = models.DateField(null=True, blank=True)
    comparison_to_date = models.DateField(null=True, blank=True)
    going_concern_assumption = models.CharField(
        max_length=25, choices=GOING_CONCERN_CHOICES, default="CONTINUOUS"
    )
    interim_format = models.CharField(
        max_length=20, choices=INTERIM_FORMAT_CHOICES, default="NONE"
    )
    cash_flow_method = models.CharField(
        max_length=20, choices=CASH_FLOW_METHOD_CHOICES, default="DIRECT"
    )
    selected_forms = models.JSONField(default=list, blank=True)
    presentation_currency = models.ForeignKey(
        "master_data.Currency",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_statement_batches",
    )
    unit_scale = models.PositiveIntegerField(
        default=1,
        help_text="Đơn vị trình bày số liệu: 1 (đồng), 1000 (nghìn đồng), 1000000 (triệu đồng) (AF-19, BR-GL-FS-60..62)",
    )
    reuse_latest_notes = models.BooleanField(default=False)
    inherited_from_batch = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="derived_batches",
    )
    mapping_version = models.CharField(max_length=40, default="TT99-2025-V1")
    version_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default="GENERATED")
    source_watermark = models.CharField(max_length=128, blank=True, default="")
    gl_aggregation_status = models.CharField(max_length=25, blank=True, default="VALID")
    period_lock_status_snapshot = models.CharField(max_length=25, blank=True, default="OPEN")
    is_balanced = models.BooleanField(default=True)
    blocker_count = models.PositiveIntegerField(default=0)
    warning_count = models.PositiveIntegerField(default=0)
    info_count = models.PositiveIntegerField(default=0)
    precheck_results = models.JSONField(default=list, blank=True)
    cross_check_results = models.JSONField(default=list, blank=True)
    notes_general_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="Thông tin chung doanh nghiệp, kỳ kế toán, tuyên bố tuân thủ TT99, chính sách kế toán áp dụng (AF-13, BR-GL-FS-38..39)",
    )
    notes_explanations = models.JSONField(
        default=dict,
        blank=True,
        help_text="Nội dung thuyết minh bổ sung theo từng mục/chỉ tiêu của kỳ hiện tại (BR-GL-FS-41..42)",
    )
    custom_indicators = models.JSONField(default=list, blank=True)
    idempotency_key = models.CharField(max_length=150, null=True, blank=True, unique=True)
    outdated_reason = models.CharField(max_length=500, blank=True, default="")
    outdated_at = models.DateTimeField(null=True, blank=True)
    finalized_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="finalized_financial_statement_batches",
    )
    finalized_at = models.DateTimeField(null=True, blank=True)
    finalize_note = models.CharField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="created_financial_statement_batches",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_financial_statement_batch"
        ordering = ("-fiscal_year", "-version_number", "-created_at")
        indexes = [
            models.Index(
                fields=("company", "fiscal_year", "report_group", "status"),
                name="ix_gl_fs_batch_co_yr_grp_st",
            ),
            models.Index(
                fields=("company", "period", "status"),
                name="ix_gl_fs_batch_co_per_st",
            ),
        ]


class FinancialStatementReport(models.Model):
    """
    UC-GL-13 – Biểu mẫu Báo cáo tài chính cụ thể thuộc một phiên bản bộ BCTC (`FinancialStatementBatch`).
    Lưu mã biểu mẫu pháp lý chuẩn theo TT99 (`B01-DN`, `B02-DN`, `B03-DN`, `B09-DN`, `B01-DNKLT`..`B09-DNKLT`,
    `B01a-DN`..`B09a-DN`, `B01b-DN`..`B03b-DN`) và phương pháp lập LCTT (`cash_flow_method`: `DIRECT`/`INDIRECT`).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(
        FinancialStatementBatch,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.PROTECT,
        related_name="financial_statement_reports",
    )
    form_code = models.CharField(
        max_length=30, choices=FinancialStatementMappingRule.FORM_CODE_CHOICES
    )
    form_name = models.CharField(max_length=255)
    cash_flow_method = models.CharField(
        max_length=20,
        choices=FinancialStatementMappingRule.CASH_FLOW_METHOD_CHOICES,
        blank=True,
        default="",
    )
    going_concern_assumption = models.CharField(
        max_length=25,
        choices=FinancialStatementBatch.GOING_CONCERN_CHOICES,
        default="CONTINUOUS",
    )
    interim_format = models.CharField(
        max_length=20,
        choices=FinancialStatementBatch.INTERIM_FORMAT_CHOICES,
        default="NONE",
    )
    status = models.CharField(
        max_length=25,
        choices=FinancialStatementBatch.STATUS_CHOICES,
        default="GENERATED",
    )
    summary_metrics = models.JSONField(default=dict, blank=True)
    notes_sections = models.JSONField(default=dict, blank=True)
    validation_errors = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_financial_statement_report"
        ordering = ("form_code", "cash_flow_method")


class FinancialStatementLine(models.Model):
    """
    UC-GL-13 (Steps 25–38, 48–50, BR-GL-FS-26..64, 112..116):
    Từng dòng chỉ tiêu của một biểu mẫu BCTC (`FinancialStatementReport`),
    lưu cả số nguyên gốc (`raw_*`) và số quy đổi theo đơn vị trình bày (`current_amount`, `prior_amount`),
    công thức / quy tắc mapping và dữ liệu truy vết ngược xuống tài khoản / bút toán `POSTED`.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(
        FinancialStatementReport,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_no = models.PositiveIntegerField(default=1)
    section_code = models.CharField(max_length=50, blank=True, default="ASSETS")
    indicator_code = models.CharField(max_length=30)
    indicator_name = models.CharField(max_length=500)
    note_ref = models.CharField(max_length=50, blank=True, default="")
    level = models.PositiveSmallIntegerField(default=1)
    is_total_line = models.BooleanField(default=False)
    is_custom_indicator = models.BooleanField(default=False)
    source_type = models.CharField(max_length=40, default="ACCOUNT_BALANCE")
    formula_or_mapping = models.CharField(max_length=500, blank=True, default="")
    raw_current_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    raw_prior_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    raw_ytd_current_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    raw_ytd_prior_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    current_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    prior_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    ytd_current_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    ytd_prior_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    manual_explanation = models.TextField(blank=True, default="")
    account_breakdown = models.JSONField(default=list, blank=True)
    entry_ids_trace = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "gl_financial_statement_line"
        ordering = ("line_no", "indicator_code")





