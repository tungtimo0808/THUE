from decimal import Decimal
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="gl_periods")
    code = models.CharField(max_length=30)
    fiscal_year = models.PositiveIntegerField()
    period_number = models.PositiveSmallIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=10, choices=(("OPEN", "Mở"), ("CLOSED", "Đóng")), default="OPEN")
    closed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="gl_periods_closed")
    closed_at = models.DateTimeField(null=True, blank=True)
    reopened_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="gl_periods_reopened")
    reopened_at = models.DateTimeField(null=True, blank=True)
    reopen_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "gl_accounting_period"
        ordering = ("fiscal_year", "period_number")
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_gl_period_code"),
            models.UniqueConstraint(fields=("company", "fiscal_year", "period_number"), name="uq_gl_period_number"),
            models.CheckConstraint(condition=Q(end_date__gte=models.F("start_date")), name="ck_gl_period_dates"),
            models.CheckConstraint(condition=Q(period_number__gte=1, period_number__lte=99), name="ck_gl_period_number_range"),
        ]


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
    entry_type = models.CharField(max_length=20, choices=(("MANUAL", "Trực tiếp"), ("SUBLEDGER", "Từ phân hệ"), ("ALLOCATION", "Phân bổ"), ("CLOSING", "Kết chuyển"), ("ADJUSTMENT", "Điều chỉnh"), ("REVERSAL", "Đảo"), ("OPENING", "Số dư đầu kỳ")), default="MANUAL")
    posting_date = models.DateField()
    document_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500)
    source_module = models.CharField(max_length=20, blank=True)
    source_event_id = models.CharField(max_length=150, null=True, blank=True, unique=True)
    source_entity_type = models.CharField(max_length=80, blank=True)
    source_entity_id = models.UUIDField(null=True, blank=True)
    original_entry = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="related_entries")
    status = models.CharField(max_length=30, choices=JournalStatus.choices, default=JournalStatus.DRAFT)
    workflow_snapshot = models.JSONField(default=dict, blank=True)
    total_debit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_credit = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="journal_entries_created")
    approved_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="journal_entries_approved")
    posted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="journal_entries_posted")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gl_journal_entry"
        ordering = ("-posting_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_gl_journal_number"),
            models.CheckConstraint(condition=Q(total_debit__gte=0, total_credit__gte=0), name="ck_gl_journal_totals_nonnegative"),
        ]


class JournalLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    source_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="allocation_rules_source")
    offset_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="allocation_rules_offset")
    method = models.CharField(max_length=20, choices=(("FIXED_PERCENT", "Tỷ lệ cố định"),), default="FIXED_PERCENT")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gl_allocation_rule"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_gl_allocation_rule")]


class AllocationDestination(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule = models.ForeignKey(AllocationRule, on_delete=models.CASCADE, related_name="destinations")
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True)
    project = models.ForeignKey("master_data.Project", on_delete=models.PROTECT, null=True, blank=True)
    cost_center = models.ForeignKey("master_data.CostCenter", on_delete=models.PROTECT, null=True, blank=True)
    percentage = models.DecimalField(max_digits=9, decimal_places=6)

    class Meta:
        db_table = "gl_allocation_destination"
        constraints = [models.CheckConstraint(condition=Q(percentage__gt=0, percentage__lte=100), name="ck_gl_allocation_percentage")]


class AllocationRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    rule = models.ForeignKey(AllocationRule, on_delete=models.PROTECT, related_name="runs")
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="allocation_runs")
    idempotency_key = models.CharField(max_length=150, unique=True)
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    entry = models.OneToOneField(JournalEntry, on_delete=models.PROTECT, related_name="allocation_run")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gl_allocation_run"


class ClosingRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    source_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="closing_rules_source")
    destination_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="closing_rules_destination")
    sequence = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "gl_closing_rule"
        ordering = ("sequence",)
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_gl_closing_rule")]


class ClosingRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    rule = models.ForeignKey(ClosingRule, on_delete=models.PROTECT, related_name="runs")
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="closing_runs")
    entry = models.OneToOneField(JournalEntry, on_delete=models.PROTECT, related_name="closing_run")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gl_closing_run"
        constraints = [models.UniqueConstraint(fields=("rule", "period"), name="uq_gl_closing_rule_period")]


class GlReconciliation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name="reconciliations")
    source_module = models.CharField(max_length=20)
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    subledger_amount = models.DecimalField(max_digits=24, decimal_places=4)
    gl_amount = models.DecimalField(max_digits=24, decimal_places=4)
    difference = models.DecimalField(max_digits=24, decimal_places=4)
    status = models.CharField(max_length=20, choices=(("MATCHED", "Khớp"), ("VARIANCE", "Chênh lệch")))
    details = models.JSONField(default=dict, blank=True)
    resolved = models.BooleanField(default=False)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gl_reconciliation"


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
