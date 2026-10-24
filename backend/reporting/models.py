import uuid

from django.db import models


class ReportDefinition(models.Model):
    class Group(models.TextChoices):
        FINANCIAL = "FINANCIAL", "Báo cáo tài chính"
        LEDGER = "LEDGER", "Sổ kế toán"
        COMMERCE = "COMMERCE", "Mua hàng và bán hàng"
        DEBT = "DEBT", "Công nợ"
        MONEY = "MONEY", "Tiền mặt và ngân hàng"
        INVENTORY = "INVENTORY", "Kho"
        ASSET = "ASSET", "Tài sản và CCDC"
        TAX = "TAX", "Thuế và hóa đơn"
        MANAGEMENT = "MANAGEMENT", "Quản trị"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    group = models.CharField(max_length=20, choices=Group.choices)
    description = models.CharField(max_length=1000, blank=True)
    permission_code = models.CharField(max_length=100)
    source_modules = models.JSONField(default=list)
    parameter_schema = models.JSONField(default=dict, blank=True)
    supports_comparison = models.BooleanField(default=False)
    supports_drilldown = models.BooleanField(default=True)
    supports_excel = models.BooleanField(default=True)
    supports_pdf = models.BooleanField(default=True)
    is_sensitive = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sequence = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_report_definition"
        ordering = ("sequence", "code")

    def __str__(self):
        return f"{self.code} - {self.name}"


class ReportLineMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(ReportDefinition, on_delete=models.CASCADE, related_name="line_mappings")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    sequence = models.PositiveIntegerField(default=0)
    account_prefixes = models.JSONField(default=list, blank=True)
    calculation = models.CharField(
        max_length=30,
        choices=(("DEBIT_MINUS_CREDIT", "Nợ - Có"), ("CREDIT_MINUS_DEBIT", "Có - Nợ"), ("DEBIT", "Phát sinh Nợ"), ("CREDIT", "Phát sinh Có")),
        default="DEBIT_MINUS_CREDIT",
    )
    formula = models.JSONField(default=dict, blank=True)
    is_total = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "rpt_line_mapping"
        ordering = ("sequence", "code")
        constraints = [models.UniqueConstraint(fields=("report", "code"), name="uq_rpt_line_code")]


class ReportRun(models.Model):
    class Status(models.TextChoices):
        COMPLETED = "COMPLETED", "Hoàn thành"
        NO_DATA = "NO_DATA", "Không có dữ liệu"
        FAILED = "FAILED", "Lỗi"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="report_runs")
    report = models.ForeignKey(ReportDefinition, on_delete=models.PROTECT, related_name="runs")
    requested_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="report_runs")
    parameters = models.JSONField(default=dict)
    result = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=Status.choices)
    row_count = models.PositiveIntegerField(default=0)
    source_trace = models.JSONField(default=list, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_report_run"
        ordering = ("-generated_at",)
        indexes = [models.Index(fields=("company", "report", "generated_at"), name="ix_rpt_run_lookup")]


class ReportExport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(ReportRun, on_delete=models.PROTECT, related_name="exports")
    requested_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="report_exports")
    format = models.CharField(max_length=10, choices=(("XLSX", "Excel"), ("PDF", "PDF"), ("PRINT", "Bản in")))
    file_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_report_export"
        ordering = ("-created_at",)


class DashboardMetricCatalog(models.Model):
    class MetricGroup(models.TextChoices):
        OVERVIEW_KPI = "OVERVIEW_KPI", "Chỉ tiêu tổng quan"
        CASH_PROFIT = "CASH_PROFIT", "Dòng tiền và kết quả"
        DEBT_INV_TAX = "DEBT_INV_TAX", "Công nợ, tồn kho, thuế"
        OPERATIONS = "OPERATIONS", "Điều hành"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    metric_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    group = models.CharField(max_length=30, choices=MetricGroup.choices)
    version = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=1000, blank=True, default="")
    source_modules = models.JSONField(default=list, blank=True)
    calculation_rule = models.JSONField(default=dict, blank=True)
    default_account_prefixes = models.JSONField(default=list, blank=True)
    required_permission = models.CharField(max_length=100, default="RPT.DASHBOARD.VIEW")
    widget_permission = models.CharField(max_length=100, blank=True, default="")
    target_uc_code = models.CharField(max_length=50, blank=True, default="")
    target_report_code = models.CharField(max_length=50, blank=True, default="")
    target_report_permission = models.CharField(max_length=100, blank=True, default="")
    target_route = models.CharField(max_length=255, blank=True, default="")
    is_to_be = models.BooleanField(default=False)
    sequence = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_dashboard_metric_catalog"
        ordering = ("sequence", "metric_code")

    def __str__(self):
        return f"{self.metric_code} - {self.name}"


class DashboardMetricAccountMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="dashboard_account_mappings",
    )
    metric = models.ForeignKey(
        DashboardMetricCatalog,
        on_delete=models.CASCADE,
        related_name="account_mappings",
    )
    line_code = models.CharField(max_length=50)
    line_name = models.CharField(max_length=255)
    account_prefixes = models.JSONField(default=list, blank=True)
    calculation = models.CharField(
        max_length=30,
        choices=(
            ("DEBIT_MINUS_CREDIT", "Nợ - Có"),
            ("CREDIT_MINUS_DEBIT", "Có - Nợ"),
            ("DEBIT", "Phát sinh Nợ"),
            ("CREDIT", "Phát sinh Có"),
        ),
        default="CREDIT_MINUS_DEBIT",
    )
    exclude_closing_entries = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "rpt_dashboard_account_mapping"
        ordering = ("metric", "line_code")


class DashboardConfiguration(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="dashboard_configurations",
    )
    role = models.ForeignKey(
        "iam.Role",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="dashboard_configurations",
    )
    user = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="dashboard_configurations",
    )
    enabled_widgets = models.JSONField(default=list, blank=True)
    default_period_type = models.CharField(max_length=20, default="MONTH")
    default_comparison_mode = models.CharField(max_length=30, default="PREVIOUS_PERIOD")
    cash_flow_scope = models.CharField(max_length=20, default="EXTERNAL_ONLY")
    slow_moving_days = models.PositiveIntegerField(default=90)
    tasks_limit = models.PositiveIntegerField(default=3)
    recent_documents_limit = models.PositiveIntegerField(default=5)
    recent_documents_sort_by = models.CharField(max_length=30, default="created_at")
    cache_ttl_seconds = models.PositiveIntegerField(default=300)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_dashboard_configuration"


class DashboardCacheEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="dashboard_cache_entries",
    )
    cache_key = models.CharField(max_length=255, unique=True)
    widget_code = models.CharField(max_length=50, default="OVERVIEW")
    period_key = models.CharField(max_length=120)
    scope_hash = models.CharField(max_length=64)
    metric_version = models.PositiveIntegerField(default=1)
    payload = models.JSONField(default=dict)
    data_as_of = models.DateTimeField()
    generated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    is_stale = models.BooleanField(default=False)

    class Meta:
        db_table = "rpt_dashboard_cache"
        indexes = [models.Index(fields=("company", "widget_code", "period_key"), name="ix_rpt_dash_cache_lookup")]


class DashboardMetricSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="dashboard_snapshots",
    )
    metric = models.ForeignKey(
        DashboardMetricCatalog,
        on_delete=models.CASCADE,
        related_name="snapshots",
    )
    as_of_date = models.DateField()
    period_code = models.CharField(max_length=50, blank=True, default="")
    branch = models.ForeignKey("organization.Branch", on_delete=models.CASCADE, null=True, blank=True)
    value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_dashboard_snapshot"
        ordering = ("-as_of_date", "-created_at")


# ============================================================================
# UC-RPT-02 – Xem bộ báo cáo tài chính (Financial Statement Bundles)
# ============================================================================


class FinancialStatementTemplate(models.Model):
    class ComponentType(models.TextChoices):
        FINANCIAL_POSITION = "FINANCIAL_POSITION", "Báo cáo tình hình tài chính"
        BUSINESS_RESULT = "BUSINESS_RESULT", "Báo cáo kết quả hoạt động kinh doanh"
        CASH_FLOW = "CASH_FLOW", "Báo cáo lưu chuyển tiền tệ"
        FINANCIAL_NOTES = "FINANCIAL_NOTES", "Bản thuyết minh báo cáo tài chính"

    class PeriodGranularity(models.TextChoices):
        ANNUAL = "ANNUAL", "Năm"
        INTERIM = "INTERIM", "Giữa niên độ"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    internal_code = models.CharField(max_length=30, unique=True)  # FSR-01 .. FSR-15
    legal_form_code = models.CharField(max_length=40, unique=True)  # B01-DN, B01-DNKLT, B01a-DN, B01b-DN, ...
    name = models.CharField(max_length=255)
    component_type = models.CharField(max_length=30, choices=ComponentType.choices)
    applicable_bundle_types = models.JSONField(default=list)
    period_granularity = models.CharField(max_length=20, choices=PeriodGranularity.choices, default=PeriodGranularity.ANNUAL)
    supports_cash_flow_method = models.BooleanField(default=False)
    target_uc_code = models.CharField(max_length=30, default="UC-RPT-03")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_fs_template"
        ordering = ("internal_code",)

    def __str__(self):
        return f"{self.internal_code} ({self.legal_form_code}) - {self.name}"


class FinancialStatementTemplateVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(FinancialStatementTemplate, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField(default=1)
    accounting_regime = models.CharField(max_length=30, default="TT99")
    legal_circular = models.CharField(max_length=255, default="Thông tư 99/2025/TT-BTC")
    effective_from = models.DateField(default="2020-01-01")
    effective_to = models.DateField(null=True, blank=True)
    cash_flow_method = models.CharField(max_length=20, blank=True, default="")  # "", "DIRECT", "INDIRECT"
    column_schema = models.JSONField(default=list, blank=True)
    is_locked = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_fs_template_version"
        ordering = ("template", "-version_number")
        constraints = [
            models.UniqueConstraint(
                fields=("template", "version_number", "cash_flow_method"),
                name="uq_rpt_fs_template_ver_method",
            )
        ]


class FinancialStatementLine(models.Model):
    class LineType(models.TextChoices):
        DETAIL = "DETAIL", "Chi tiết"
        SUBTOTAL = "SUBTOTAL", "Tổng nhóm"
        TOTAL = "TOTAL", "Tổng cộng"
        FORMULA = "FORMULA", "Công thức tổng hợp"
        MEMO = "MEMO", "Thông tin chi tiết (Trong đó)"
        EPS = "EPS", "Lãi trên cổ phiếu"
        SECTION_HEADER = "SECTION_HEADER", "Tiêu đề phần"
        NOTE_TEXT = "NOTE_TEXT", "Thuyết minh văn bản"
        NOTE_TABLE = "NOTE_TABLE", "Thuyết minh bảng"
        NOTE_NUMBER = "NOTE_NUMBER", "Thuyết minh số liệu"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_version = models.ForeignKey(FinancialStatementTemplateVersion, on_delete=models.CASCADE, related_name="lines")
    indicator_code = models.CharField(max_length=40)
    indicator_name = models.CharField(max_length=500)
    section_code = models.CharField(max_length=40, blank=True, default="")
    section_name = models.CharField(max_length=255, blank=True, default="")
    note_reference = models.CharField(max_length=60, blank=True, default="")
    display_order = models.PositiveIntegerField(default=1)
    line_type = models.CharField(max_length=30, choices=LineType.choices, default=LineType.DETAIL)
    formula_expression = models.CharField(max_length=255, blank=True, default="")
    is_required = models.BooleanField(default=False)
    table_schema = models.JSONField(default=dict, blank=True)
    related_indicator_code = models.CharField(max_length=40, blank=True, default="")
    parent_line = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_lines",
    )
    parent_indicator_code = models.CharField(max_length=40, blank=True, default="")
    level = models.PositiveSmallIntegerField(default=1)
    is_negative_presentation = models.BooleanField(default=False)
    is_drilldown_available = models.BooleanField(default=True)

    class Meta:
        db_table = "rpt_fs_line"
        ordering = ("display_order", "indicator_code")
        constraints = [
            models.UniqueConstraint(
                fields=("template_version", "indicator_code"),
                name="uq_rpt_fs_line_indicator",
            )
        ]


class FinancialStatementAccountMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="fs_account_mappings",
    )
    statement_line = models.ForeignKey(FinancialStatementLine, on_delete=models.CASCADE, related_name="account_mappings")
    account_prefix = models.CharField(max_length=20)
    counterpart_prefix = models.CharField(max_length=20, blank=True, default="")
    balance_side = models.CharField(max_length=30, default="NET_DEBIT")
    sign = models.SmallIntegerField(default=1)
    condition_json = models.JSONField(default=dict, blank=True)
    effective_from = models.DateField(default="2020-01-01")
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "rpt_fs_account_mapping"
        ordering = ("statement_line", "account_prefix")


class FinancialStatementRun(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Nháp"
        GENERATED = "GENERATED", "Đã lập"
        VALIDATING = "VALIDATING", "Đang kiểm tra"
        REVIEW_REQUIRED = "REVIEW_REQUIRED", "Cần rà soát"
        READY_FOR_APPROVAL = "READY_FOR_APPROVAL", "Sẵn sàng trình duyệt"
        APPROVED = "APPROVED", "Đã duyệt"
        SUPERSEDED = "SUPERSEDED", "Đã bị thay thế"
        ARCHIVED = "ARCHIVED", "Lưu lịch sử"
        FAILED = "FAILED", "Lỗi"

    class ValidationStatus(models.TextChoices):
        NOT_CHECKED = "NOT_CHECKED", "Chưa kiểm tra"
        PASSED = "PASSED", "Đạt kiểm tra"
        PASSED_WITH_WARNING = "PASSED_WITH_WARNING", "Đạt kèm cảnh báo"
        FAILED = "FAILED", "Không đạt"
        STALE = "STALE", "Dữ liệu nguồn đã thay đổi"

    class SourceStatus(models.TextChoices):
        COMPLETE = "COMPLETE", "Nguồn đầy đủ theo Rule"
        PRELIMINARY = "PRELIMINARY", "Số liệu tạm tính"
        PARTIAL = "PARTIAL", "Nguồn chưa đầy đủ"
        STALE = "STALE", "Nguồn/Mapping thay đổi"
        UNAVAILABLE = "UNAVAILABLE", "Không tải được nguồn"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="fs_runs")
    template = models.ForeignKey(FinancialStatementTemplate, on_delete=models.PROTECT, related_name="runs")
    template_version = models.ForeignKey(FinancialStatementTemplateVersion, on_delete=models.PROTECT, related_name="runs")
    fiscal_year = models.PositiveIntegerField()
    fiscal_period = models.ForeignKey("general_ledger.AccountingPeriod", on_delete=models.PROTECT, related_name="fs_runs")
    comparison_period = models.ForeignKey(
        "general_ledger.AccountingPeriod",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fs_comparison_runs",
    )
    reporting_scope = models.CharField(max_length=20, default="COMPANY")  # COMPANY / BRANCH
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="fs_runs")
    reporting_currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT, null=True, blank=True)
    display_unit = models.CharField(max_length=30, default="VND")
    cash_flow_method = models.CharField(max_length=20, blank=True, default="")
    as_of_date = models.DateField()
    comparison_as_of_date = models.DateField(null=True, blank=True)
    period_start_date = models.DateField()
    period_end_date = models.DateField()
    comparison_start_date = models.DateField(null=True, blank=True)
    comparison_end_date = models.DateField(null=True, blank=True)
    period_type = models.CharField(max_length=20, default="YEAR")  # YEAR, QUARTER, MONTH, CUSTOM
    legal_or_management = models.CharField(max_length=20, default="LEGAL")  # LEGAL, MANAGEMENT
    calculation_method = models.CharField(max_length=30, default="ACTIVITY_BASED")  # ACTIVITY_BASED, CLOSING_BASED, SNAPSHOT_BASED
    source_status = models.CharField(max_length=30, choices=SourceStatus.choices, default=SourceStatus.COMPLETE)
    comparative_status = models.CharField(max_length=30, default="COMPARABLE")  # COMPARABLE, NON_COMPARABLE, RESTATED, UNAVAILABLE
    comparative_adjustment_reference = models.CharField(max_length=255, blank=True, default="")
    comparative_note = models.TextField(blank=True, default="")
    restatement_version = models.PositiveIntegerField(null=True, blank=True)
    eps_metadata_json = models.JSONField(default=dict, blank=True)
    run_version = models.PositiveIntegerField(default=1)
    run_status = models.CharField(max_length=30, choices=Status.choices, default=Status.GENERATED)
    validation_status = models.CharField(max_length=30, choices=ValidationStatus.choices, default=ValidationStatus.NOT_CHECKED)
    source_snapshot_hash = models.CharField(max_length=128, blank=True, default="")
    source_last_posted_at = models.DateTimeField(null=True, blank=True)
    simulate_load_error = models.BooleanField(default=False)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="created_fs_runs")
    created_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_fs_runs")
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rpt_fs_run"
        ordering = ("-created_at", "-run_version")

    @property
    def note_table_rows(self):
        return FinancialNoteTableRow.objects.filter(note_content__statement_run=self)


class FinancialStatementValue(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statement_run = models.ForeignKey(FinancialStatementRun, on_delete=models.CASCADE, related_name="values")
    statement_line = models.ForeignKey(FinancialStatementLine, on_delete=models.PROTECT, related_name="run_values")
    current_period_amount = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    comparative_period_amount = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    text_value = models.TextField(blank=True, default="")
    table_rows_json = models.JSONField(default=list, blank=True)
    content_status = models.CharField(max_length=30, default="COMPLETE")  # COMPLETE, MISSING, DRAFT
    calculation_detail_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "rpt_fs_value"
        constraints = [
            models.UniqueConstraint(
                fields=("statement_run", "statement_line"),
                name="uq_rpt_fs_run_line_value",
            )
        ]


class FinancialStatementValueSlot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statement_run = models.ForeignKey(FinancialStatementRun, on_delete=models.CASCADE, related_name="value_slots")
    statement_line = models.ForeignKey(FinancialStatementLine, on_delete=models.PROTECT, related_name="value_slots")
    slot_code = models.CharField(max_length=50)
    slot_label = models.CharField(max_length=255)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    text_value = models.TextField(blank=True, default="")
    calculation_detail_json = models.JSONField(default=dict, blank=True)
    display_order = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "rpt_fs_value_slot"
        ordering = ("display_order", "slot_code")
        constraints = [
            models.UniqueConstraint(
                fields=("statement_run", "statement_line", "slot_code"),
                name="uq_rpt_fs_value_slot",
            )
        ]


class FinancialStatementAdjustment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statement_run = models.ForeignKey(FinancialStatementRun, on_delete=models.CASCADE, related_name="adjustments")
    statement_line = models.ForeignKey(FinancialStatementLine, on_delete=models.PROTECT, related_name="adjustments")
    slot_code = models.CharField(max_length=50, default="CURRENT")
    delta_amount = models.DecimalField(max_digits=24, decimal_places=4)
    reason = models.CharField(max_length=500)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_fs_adjustment"
        ordering = ("-created_at",)


class FinancialStatementBundle(models.Model):
    class BundleType(models.TextChoices):
        ANNUAL_GOING_CONCERN = "ANNUAL_GOING_CONCERN", "BCTC năm – Hoạt động liên tục"
        ANNUAL_NON_GOING_CONCERN = "ANNUAL_NON_GOING_CONCERN", "BCTC năm – Không đáp ứng giả định hoạt động liên tục"
        INTERIM_FULL = "INTERIM_FULL", "BCTC giữa niên độ – Đầy đủ"
        INTERIM_CONDENSED = "INTERIM_CONDENSED", "BCTC giữa niên độ – Tóm lược"

    class BundleStatus(models.TextChoices):
        DRAFT = "DRAFT", "Đang chuẩn bị"
        INCOMPLETE = "INCOMPLETE", "Chưa đủ thành phần"
        GENERATED = "GENERATED", "Đã tạo đủ thành phần"
        VALIDATING = "VALIDATING", "Đang kiểm tra"
        REVIEW_REQUIRED = "REVIEW_REQUIRED", "Cần rà soát"
        READY_FOR_APPROVAL = "READY_FOR_APPROVAL", "Đủ điều kiện trình duyệt"
        APPROVED = "APPROVED", "Đã phê duyệt"
        SUPERSEDED = "SUPERSEDED", "Đã có phiên bản thay thế"
        ARCHIVED = "ARCHIVED", "Lưu lịch sử"

    class ValidationStatus(models.TextChoices):
        NOT_CHECKED = "NOT_CHECKED", "Chưa kiểm tra"
        PASSED = "PASSED", "Đạt kiểm tra"
        PASSED_WITH_WARNING = "PASSED_WITH_WARNING", "Đạt kèm cảnh báo"
        FAILED = "FAILED", "Không đạt"
        STALE = "STALE", "Dữ liệu nguồn đã thay đổi"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="fs_bundles")
    bundle_code = models.CharField(max_length=100)
    bundle_name = models.CharField(max_length=255)
    bundle_type = models.CharField(max_length=40, choices=BundleType.choices)
    legal_basis = models.CharField(max_length=255, default="Thông tư 99/2025/TT-BTC")
    fiscal_year = models.PositiveIntegerField()
    fiscal_period = models.ForeignKey("general_ledger.AccountingPeriod", on_delete=models.PROTECT, related_name="fs_bundles")
    comparison_period = models.ForeignKey(
        "general_ledger.AccountingPeriod",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fs_comparison_bundles",
    )
    reporting_scope = models.CharField(max_length=20, default="COMPANY")  # COMPANY / BRANCH
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="fs_bundles")
    reporting_currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT, null=True, blank=True)
    display_unit = models.CharField(max_length=30, default="VND")
    cash_flow_method = models.CharField(max_length=20, default="DIRECT")  # DIRECT / INDIRECT
    bundle_version = models.PositiveIntegerField(default=1)
    is_current_version = models.BooleanField(default=True)
    bundle_status = models.CharField(max_length=30, choices=BundleStatus.choices, default=BundleStatus.DRAFT)
    validation_status = models.CharField(max_length=30, choices=ValidationStatus.choices, default=ValidationStatus.NOT_CHECKED)
    source_snapshot_reference = models.CharField(max_length=128, blank=True, default="")
    source_last_posted_at = models.DateTimeField(null=True, blank=True)
    show_zero_lines = models.BooleanField(default=True)
    show_notes = models.BooleanField(default=True)
    include_supporting_reports = models.BooleanField(default=False)
    lock_version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="created_fs_bundles")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_fs_bundles")
    approved_at = models.DateTimeField(null=True, blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    supersedes_bundle = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="superseded_by_bundles",
    )

    class Meta:
        db_table = "rpt_fs_bundle"
        ordering = ("-fiscal_year", "-bundle_version", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("company", "bundle_code", "bundle_version"),
                name="uq_rpt_fs_bundle_code_version",
            )
        ]


class FinancialStatementBundleComponent(models.Model):
    class ComponentType(models.TextChoices):
        FINANCIAL_POSITION = "FINANCIAL_POSITION", "Báo cáo tình hình tài chính"
        BUSINESS_RESULT = "BUSINESS_RESULT", "Báo cáo kết quả hoạt động kinh doanh"
        CASH_FLOW = "CASH_FLOW", "Báo cáo lưu chuyển tiền tệ"
        FINANCIAL_NOTES = "FINANCIAL_NOTES", "Bản thuyết minh báo cáo tài chính"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bundle = models.ForeignKey(FinancialStatementBundle, on_delete=models.CASCADE, related_name="components")
    component_type = models.CharField(max_length=40, choices=ComponentType.choices)
    statement_run = models.ForeignKey(
        FinancialStatementRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bundle_components",
    )
    required_legal_form_code = models.CharField(max_length=40)
    template_version = models.ForeignKey(
        FinancialStatementTemplateVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    is_required = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=1)
    component_status = models.CharField(max_length=30, default="MISSING")
    validation_status = models.CharField(max_length=30, default="NOT_CHECKED")

    class Meta:
        db_table = "rpt_fs_bundle_component"
        ordering = ("display_order",)
        constraints = [
            models.UniqueConstraint(
                fields=("bundle", "component_type"),
                name="uq_rpt_fs_bundle_comp_type",
            )
        ]


class FinancialStatementBundleValidation(models.Model):
    class Severity(models.TextChoices):
        WARNING = "WARNING", "Cảnh báo"
        BLOCKER = "BLOCKER", "Lỗi chặn"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bundle = models.ForeignKey(FinancialStatementBundle, on_delete=models.CASCADE, related_name="validations")
    validation_run_id = models.UUIDField(default=uuid.uuid4)
    rule_code = models.CharField(max_length=50)
    severity = models.CharField(max_length=20, choices=Severity.choices)
    component_type = models.CharField(max_length=40, blank=True, default="")
    statement_line = models.ForeignKey(
        FinancialStatementLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    indicator_code = models.CharField(max_length=40, blank=True, default="")
    source_reference = models.CharField(max_length=255, blank=True, default="")
    message = models.CharField(max_length=1000)
    validation_status = models.CharField(max_length=30, default="FAILED")
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_fs_bundle_validation"
        ordering = ("-checked_at", "severity", "rule_code")


class FinancialStatementRunValidation(models.Model):
    class Severity(models.TextChoices):
        WARNING = "WARNING", "Cảnh báo"
        BLOCKER = "BLOCKER", "Lỗi chặn"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    validation_run_id = models.UUIDField(default=uuid.uuid4)
    statement_run = models.ForeignKey(FinancialStatementRun, on_delete=models.CASCADE, related_name="validations")
    statement_line = models.ForeignKey(
        FinancialStatementLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="run_validations",
    )
    rule_code = models.CharField(max_length=50)
    column_code = models.CharField(max_length=20, default="CLOSING")  # CLOSING, OPENING, BOTH
    slot_code = models.CharField(max_length=50, blank=True, default="")
    indicator_code = models.CharField(max_length=40, blank=True, default="")
    expected_amount = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    actual_amount = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    difference_amount = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.BLOCKER)
    status = models.CharField(max_length=30, default="PASSED")  # PASSED, PASSED_WITH_WARNING, FAILED
    message = models.CharField(max_length=1000)
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_fs_run_validation"
        ordering = ("-checked_at", "rule_code", "column_code")


# ============================================================================
# UC-RPT-05 – Xem báo cáo lưu chuyển tiền tệ (DR-RPT-B03-01 .. DR-RPT-B03-03)
# ============================================================================


class CashFlowEvent(models.Model):
    class EventType(models.TextChoices):
        RECEIPT = "RECEIPT", "Thu tiền"
        PAYMENT = "PAYMENT", "Chi tiền"
        SPECIAL_PRESENTATION = "SPECIAL_PRESENTATION", "Trình bày đặc biệt (Vay trả thẳng NCC)"
        FX_EFFECT = "FX_EFFECT", "Ảnh hưởng tỷ giá tiền & tương đương tiền"
        RECLASSIFICATION = "RECLASSIFICATION", "Tái phân loại tương đương tiền"

    class EventStatus(models.TextChoices):
        POSTED = "POSTED", "Có hiệu lực"
        DRAFT = "DRAFT", "Bản nháp"
        REVERSED = "REVERSED", "Đã đảo"
        CANCELLED = "CANCELLED", "Đã hủy"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="cash_flow_events")
    branch = models.ForeignKey(
        "organization.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cash_flow_events",
    )
    source_system = models.CharField(max_length=30, default="GL")  # CASH, BANK, GL, BANK_STATEMENT, LOAN_DIRECT, RECLASSIFICATION
    source_document_id = models.CharField(max_length=150, blank=True, default="")
    source_line_id = models.CharField(max_length=150, blank=True, default="")
    journal_entry = models.ForeignKey(
        "general_ledger.JournalEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cash_flow_events",
    )
    journal_line = models.ForeignKey(
        "general_ledger.JournalLine",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cash_flow_events",
    )
    event_type = models.CharField(max_length=40, choices=EventType.choices, default=EventType.RECEIPT)
    transaction_date = models.DateField()
    posting_date = models.DateField()
    amount_base = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    amount_foreign = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.SET_NULL, null=True, blank=True)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    party = models.ForeignKey("master_data.Party", on_delete=models.SET_NULL, null=True, blank=True)
    internal_transfer_group_id = models.CharField(max_length=120, blank=True, default="")
    is_internal_transfer = models.BooleanField(default=False)
    is_non_cash_transaction = models.BooleanField(default=False)
    is_loan_direct_payment = models.BooleanField(default=False)
    is_split_unseparated = models.BooleanField(default=False)
    is_duplicate_source = models.BooleanField(default=False)
    special_presentation_rule = models.CharField(max_length=100, blank=True, default="")
    source_reference = models.CharField(max_length=255, blank=True, default="")
    source_version = models.PositiveIntegerField(default=1)
    event_status = models.CharField(max_length=30, choices=EventStatus.choices, default=EventStatus.POSTED)
    dedupe_key = models.CharField(max_length=180, blank=True, default="")
    description = models.CharField(max_length=500, blank=True, default="")
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_cash_flow_event"
        ordering = ("posting_date", "created_at")


class CashFlowClassification(models.Model):
    class MethodScope(models.TextChoices):
        BOTH = "BOTH", "Cả hai phương pháp"
        DIRECT = "DIRECT", "Trực tiếp"
        INDIRECT = "INDIRECT", "Gián tiếp"

    class Section(models.TextChoices):
        OPERATING = "OPERATING", "Hoạt động kinh doanh"
        INVESTING = "INVESTING", "Hoạt động đầu tư"
        FINANCING = "FINANCING", "Hoạt động tài chính"
        RECONCILIATION = "RECONCILIATION", "Đối chiếu & Tổng kết"

    class ClassificationSource(models.TextChoices):
        RULE = "RULE", "Theo quy tắc"
        MANUAL = "MANUAL", "Phân loại thủ công"
        SYSTEM = "SYSTEM", "Hệ thống tự động"

    class ClassificationStatus(models.TextChoices):
        DRAFT = "DRAFT", "Nháp"
        VALIDATED = "VALIDATED", "Đã kiểm tra"
        APPROVED = "APPROVED", "Đã duyệt"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="cash_flow_classifications")
    source_event = models.ForeignKey(CashFlowEvent, on_delete=models.CASCADE, related_name="classifications")
    source_document_id = models.CharField(max_length=150, blank=True, default="")
    source_journal_line = models.ForeignKey(
        "general_ledger.JournalLine",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cash_flow_classifications",
    )
    cash_flow_method_scope = models.CharField(max_length=20, choices=MethodScope.choices, default=MethodScope.BOTH)
    cash_flow_section = models.CharField(max_length=30, choices=Section.choices, default=Section.OPERATING)
    indicator_code = models.CharField(max_length=40)
    allocated_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sign = models.SmallIntegerField(default=1)
    classification_source = models.CharField(
        max_length=20,
        choices=ClassificationSource.choices,
        default=ClassificationSource.RULE,
    )
    classification_rule_code = models.CharField(max_length=80, blank=True, default="")
    rule_version = models.PositiveIntegerField(default=1)
    effective_from = models.DateField(default="2000-01-01")
    effective_to = models.DateField(null=True, blank=True)
    classification_status = models.CharField(
        max_length=20,
        choices=ClassificationStatus.choices,
        default=ClassificationStatus.VALIDATED,
    )
    reason = models.CharField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_cash_flow_classification"
        ordering = ("indicator_code", "created_at")


class CashEquivalentInstrument(models.Model):
    class EquivalentStatus(models.TextChoices):
        ELIGIBLE = "ELIGIBLE", "Đủ điều kiện tương đương tiền"
        INELIGIBLE = "INELIGIBLE", "Không đủ điều kiện tương đương tiền"
        RECLASSIFIED_IN = "RECLASSIFIED_IN", "Tái phân loại thành tương đương tiền"
        RECLASSIFIED_OUT = "RECLASSIFIED_OUT", "Tái phân loại khỏi tương đương tiền"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company",
        on_delete=models.CASCADE,
        related_name="cash_equivalent_instruments",
    )
    branch = models.ForeignKey("organization.Branch", on_delete=models.SET_NULL, null=True, blank=True)
    instrument_code = models.CharField(max_length=80)
    instrument_name = models.CharField(max_length=255)
    account = models.ForeignKey("general_ledger.Account", on_delete=models.SET_NULL, null=True, blank=True)
    acquisition_date = models.DateField()
    original_maturity_date = models.DateField()
    current_maturity_date = models.DateField(null=True, blank=True)
    principal_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    is_readily_convertible = models.BooleanField(default=True)
    amount_determinable = models.BooleanField(default=True)
    value_change_risk_assessment = models.CharField(max_length=20, default="LOW")  # LOW, HIGH
    is_restricted = models.BooleanField(default=False)
    cash_equivalent_status = models.CharField(
        max_length=30,
        choices=EquivalentStatus.choices,
        default=EquivalentStatus.ELIGIBLE,
    )
    opening_classification = models.CharField(max_length=40, blank=True, default="")
    closing_classification = models.CharField(max_length=40, blank=True, default="")
    reclassification_effective_date = models.DateField(null=True, blank=True)
    reclassification_impact_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    reclassification_reason = models.CharField(max_length=500, blank=True, default="")
    source_reference = models.CharField(max_length=150, blank=True, default="")
    is_cash_flow_transaction = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_cash_equivalent_instrument"
        ordering = ("instrument_code", "acquisition_date")


# ============================================================================
# UC-RPT-06 – Xem thuyết minh báo cáo tài chính (Data Requirements 5.1 .. 5.7)
# ============================================================================


class FinancialNoteSection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_version = models.ForeignKey(
        FinancialStatementTemplateVersion,
        on_delete=models.CASCADE,
        related_name="note_sections",
    )
    section_code = models.CharField(max_length=30)
    section_title = models.CharField(max_length=300)
    parent_section = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_sections",
    )
    display_order = models.PositiveIntegerField(default=0)
    is_required = models.BooleanField(default=True)
    applicability_rule_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=30, default="ACTIVE")

    class Meta:
        db_table = "rpt_financial_note_section"
        ordering = ("display_order", "section_code")
        unique_together = (("template_version", "section_code"),)

    @property
    def section_name(self) -> str:
        return self.section_title

    @property
    def section_level(self) -> int:
        return 2 if self.parent_section_id else 1

    @property
    def applicable_to_interim(self) -> bool:
        return True

    @property
    def applicable_to_non_going_concern(self) -> bool:
        return True


class FinancialNoteItem(models.Model):
    class ContentType(models.TextChoices):
        TEXT = "TEXT", "Văn bản giải trình"
        NUMBER = "NUMBER", "Giá trị số"
        DATE = "DATE", "Ngày"
        BOOLEAN = "BOOLEAN", "Có/Không"
        ENUM = "ENUM", "Chọn phân loại"
        TABLE = "TABLE", "Bảng dữ liệu"
        MOVEMENT_TABLE = "MOVEMENT_TABLE", "Bảng biến động"
        MULTI_LEVEL_TABLE = "MULTI_LEVEL_TABLE", "Bảng nhiều tầng cột"
        REPEATABLE_GROUP = "REPEATABLE_GROUP", "Nhóm lặp"
        REFERENCE = "REFERENCE", "Liên kết nguồn"
        MIXED = "MIXED", "Văn bản + bảng + số tiền"

    class DataOrigin(models.TextChoices):
        AUTO = "AUTO", "Tự động từ GL/BCTC"
        MANUAL = "MANUAL", "Nhập/xác nhận thủ công"
        MIXED = "MIXED", "Kết hợp tự động và thủ công"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(
        FinancialNoteSection,
        on_delete=models.CASCADE,
        related_name="items",
    )
    note_code = models.CharField(max_length=50)
    note_title = models.CharField(max_length=350)
    content_type = models.CharField(max_length=30, choices=ContentType.choices, default=ContentType.TEXT)
    parent_note_item = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_items",
    )
    display_order = models.PositiveIntegerField(default=0)
    content_schema_json = models.JSONField(default=dict, blank=True)
    schema_version = models.PositiveIntegerField(default=1)
    data_origin = models.CharField(max_length=20, choices=DataOrigin.choices, default=DataOrigin.MANUAL)
    source_module = models.CharField(max_length=50, blank=True, default="")
    related_report_code = models.CharField(max_length=30, blank=True, default="")  # B01, B02, B03
    related_indicator_codes = models.JSONField(default=list, blank=True)
    is_required = models.BooleanField(default=False)
    applicability_rule_json = models.JSONField(default=dict, blank=True)
    validation_rule_json = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=30, default="ACTIVE")

    class Meta:
        db_table = "rpt_financial_note_item"
        ordering = ("display_order", "note_code")
        unique_together = (("section", "note_code"),)

    @property
    def note_section(self):
        return self.section

    @property
    def note_type(self) -> str:
        return self.content_type

    @property
    def is_required_by_default(self) -> bool:
        return self.is_required

    @property
    def allow_not_applicable(self) -> bool:
        return True


class FinancialNoteContent(models.Model):
    class ContentStatus(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Chưa chuẩn bị"
        AUTO_POPULATED = "AUTO_POPULATED", "Đã lấy dữ liệu tự động, chưa xác nhận"
        MANUAL_REQUIRED = "MANUAL_REQUIRED", "Cần bổ sung nội dung"
        REVIEW_REQUIRED = "REVIEW_REQUIRED", "Cần rà soát"
        COMPLETED = "COMPLETED", "Đã đủ dữ liệu theo quy tắc"
        VALIDATED = "VALIDATED", "Đã đạt kiểm tra"
        APPROVED = "APPROVED", "Đã được duyệt theo Workflow"
        NOT_APPLICABLE = "NOT_APPLICABLE", "Không áp dụng, có căn cứ"
        STALE = "STALE", "Nội dung/nguồn liên quan đã thay đổi"
        ERROR = "ERROR", "Không thể xác định dữ liệu"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statement_run = models.ForeignKey(
        FinancialStatementRun,
        on_delete=models.CASCADE,
        related_name="note_contents",
    )
    note_item = models.ForeignKey(
        FinancialNoteItem,
        on_delete=models.CASCADE,
        related_name="run_contents",
    )
    content_version = models.PositiveIntegerField(default=1)
    text_content = models.TextField(null=True, blank=True)
    structured_content_json = models.JSONField(default=dict, blank=True)
    content_status = models.CharField(
        max_length=30,
        choices=ContentStatus.choices,
        default=ContentStatus.NOT_STARTED,
    )
    is_applicable = models.BooleanField(default=True)
    not_applicable_reason = models.TextField(null=True, blank=True)
    applicability_evidence = models.CharField(max_length=255, blank=True, default="")
    data_origin = models.CharField(max_length=20, default="AUTO")
    source_snapshot_reference = models.CharField(max_length=120, blank=True, default="")
    created_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_note_contents",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_note_contents",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_note_contents",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rpt_financial_note_content"
        ordering = ("note_item__display_order", "-content_version")


class FinancialNoteTable(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    note_item = models.ForeignKey(
        FinancialNoteItem,
        on_delete=models.CASCADE,
        related_name="tables",
    )
    table_code = models.CharField(max_length=60)
    table_title = models.CharField(max_length=300)
    schema_version = models.PositiveIntegerField(default=1)
    column_schema_json = models.JSONField(default=list, blank=True)
    row_schema_json = models.JSONField(default=list, blank=True)
    calculation_policy_json = models.JSONField(default=dict, blank=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "rpt_financial_note_table"
        ordering = ("display_order", "table_code")
        unique_together = (("note_item", "table_code"),)

    @property
    def table_schema_json(self) -> dict:
        return {"columns": self.column_schema_json}


class FinancialNoteTableRow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    note_content = models.ForeignKey(
        FinancialNoteContent,
        on_delete=models.CASCADE,
        related_name="table_rows",
    )
    table = models.ForeignKey(
        FinancialNoteTable,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_code = models.CharField(max_length=60)
    row_label = models.CharField(max_length=350)
    parent_row = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_rows",
    )
    dimension_reference_json = models.JSONField(default=dict, blank=True)
    display_order = models.PositiveIntegerField(default=0)
    row_values_json = models.JSONField(default=dict, blank=True)
    source_reference_json = models.JSONField(default=dict, blank=True)
    calculation_detail_json = models.JSONField(default=dict, blank=True)
    content_status = models.CharField(max_length=30, default="AUTO_POPULATED")

    class Meta:
        db_table = "rpt_financial_note_table_row"
        ordering = ("display_order", "row_code")

    def __init__(self, *args, **kwargs):
        if not args:
            stmt_run = kwargs.pop("statement_run", None)
            if "note_table" in kwargs and "table" not in kwargs:
                kwargs["table"] = kwargs.pop("note_table")
            if "column_values_json" in kwargs and "row_values_json" not in kwargs:
                kwargs["row_values_json"] = kwargs.pop("column_values_json")
            if "drilldown_reference_json" in kwargs and "source_reference_json" not in kwargs:
                kwargs["source_reference_json"] = kwargs.pop("drilldown_reference_json")
            row_lvl = kwargs.pop("row_level", 1)
            is_tot = kwargs.pop("is_total_row", False)
            val_flags = kwargs.pop("validation_flags_json", None) or {}
            if "calculation_detail_json" not in kwargs:
                kwargs["calculation_detail_json"] = {
                    "row_level": row_lvl,
                    "is_total_row": is_tot,
                    **val_flags,
                }
            if "note_content" not in kwargs and "note_content_id" not in kwargs and stmt_run is not None and kwargs.get("table") is not None:
                tbl_obj = kwargs["table"]
                nc = FinancialNoteContent.objects.filter(statement_run=stmt_run, note_item_id=tbl_obj.note_item_id).first()
                if nc is not None:
                    kwargs["note_content"] = nc
        super().__init__(*args, **kwargs)

    @property
    def note_table(self):
        return self.table

    @property
    def note_table_id(self):
        return self.table_id

    @property
    def column_values_json(self) -> dict:
        return self.row_values_json

    @property
    def drilldown_reference_json(self) -> dict:
        return self.source_reference_json

    @property
    def validation_flags_json(self) -> dict:
        return self.calculation_detail_json

    @property
    def is_total_row(self) -> bool:
        return bool((self.calculation_detail_json or {}).get("is_total_row", self.row_code == "TOTAL"))

    @property
    def row_level(self) -> int:
        return int((self.calculation_detail_json or {}).get("row_level", 1))


class FinancialNoteReference(models.Model):
    class ReferenceType(models.TextChoices):
        FINANCIAL_STATEMENT = "FINANCIAL_STATEMENT", "Chỉ tiêu B01/B02/B03"
        GL = "GL", "Tài khoản / Sổ cái"
        DOCUMENT = "DOCUMENT", "Chứng từ / Hồ sơ nguồn"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statement_run = models.ForeignKey(
        FinancialStatementRun,
        on_delete=models.CASCADE,
        related_name="note_references",
    )
    note_item = models.ForeignKey(
        FinancialNoteItem,
        on_delete=models.CASCADE,
        related_name="references",
    )
    source_statement_run = models.ForeignKey(
        FinancialStatementRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="referenced_by_notes",
    )
    source_statement_line = models.ForeignKey(
        FinancialStatementLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="referenced_by_notes",
    )
    reference_type = models.CharField(
        max_length=30,
        choices=ReferenceType.choices,
        default=ReferenceType.FINANCIAL_STATEMENT,
    )
    mapping_rule_code = models.CharField(max_length=80, blank=True, default="")
    source_reference_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "rpt_financial_note_reference"
        ordering = ("note_item__display_order", "mapping_rule_code")


class FinancialNoteValidationResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statement_run = models.ForeignKey(
        FinancialStatementRun,
        on_delete=models.CASCADE,
        related_name="note_validation_results",
    )
    note_item = models.ForeignKey(
        FinancialNoteItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validation_results",
    )
    table = models.ForeignKey(
        FinancialNoteTable,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validation_results",
    )
    row = models.ForeignKey(
        FinancialNoteTableRow,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validation_results",
    )
    column_code = models.CharField(max_length=60, blank=True, default="")
    rule_code = models.CharField(max_length=60)
    severity = models.CharField(max_length=20, default="WARNING")  # WARNING, BLOCKER
    expected_value = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    actual_value = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    difference_amount = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    status = models.CharField(max_length=30, default="PASSED")  # PASSED, PASSED_WITH_WARNING, FAILED, STALE
    message = models.TextField()
    details_json = models.JSONField(default=dict, blank=True)
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_financial_note_validation_result"
        ordering = ("-checked_at", "rule_code")

    def __init__(self, *args, **kwargs):
        if not args:
            if "check_code" in kwargs and "rule_code" not in kwargs:
                kwargs["rule_code"] = kwargs.pop("check_code")
            if "validation_status" in kwargs and "status" not in kwargs:
                kwargs["status"] = kwargs.pop("validation_status")
            if "difference_value" in kwargs and "difference_amount" not in kwargs:
                kwargs["difference_amount"] = kwargs.pop("difference_value")
            if "note_table" in kwargs and "table" not in kwargs:
                kwargs["table"] = kwargs.pop("note_table")
            chk_name = kwargs.pop("check_name", None)
            v_type = kwargs.pop("validation_type", None)
            n_sec = kwargs.pop("note_section", None)
            if chk_name or v_type or n_sec:
                det = dict(kwargs.get("details_json") or {})
                if chk_name:
                    det["check_name"] = chk_name
                if v_type:
                    det["validation_type"] = v_type
                if n_sec:
                    det["section_code"] = n_sec.section_code
                kwargs["details_json"] = det
        super().__init__(*args, **kwargs)

    @property
    def check_code(self) -> str:
        return self.rule_code

    @property
    def check_name(self) -> str:
        return str((self.details_json or {}).get("check_name") or self.rule_code)

    @property
    def validation_type(self) -> str:
        return str((self.details_json or {}).get("validation_type") or "GENERAL")

    @property
    def validation_status(self) -> str:
        return self.status

    @property
    def difference_value(self):
        return self.difference_amount

    @property
    def note_section(self):
        return self.note_item.section if self.note_item else None

    @property
    def note_table(self):
        return self.table


# ============================================================================
# UC-RPT-07 – Xem báo cáo thuế (Data Requirements 4.1 .. 5.4)
# ============================================================================


class TaxFormDefinition(models.Model):
    form_code = models.CharField(max_length=80, unique=True)  # 01/GTGT, 02/TNDN, 03/TNDN, 05/KK-TNCN, ...
    form_name = models.CharField(max_length=255)
    tax_type = models.CharField(max_length=30, default="VAT")  # VAT, CIT, PIT, OTHER_STATE_OBLIGATION, ALL
    category_type = models.CharField(max_length=40, default="LEGAL_FORM_VIEW")
    legal_basis = models.CharField(max_length=255, blank=True, default="")
    filing_frequency = models.CharField(max_length=30, blank=True, default="MONTH_OR_QUARTER")
    status = models.CharField(max_length=20, default="ACTIVE")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "rpt_tax_form_definition"
        ordering = ("tax_type", "form_code")

    def __str__(self) -> str:
        return f"{self.form_code} - {self.form_name}"


class TaxFormVersion(models.Model):
    form = models.ForeignKey(
        TaxFormDefinition,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version_code = models.CharField(max_length=80)  # TT80_2021_V1, TT89_2026_V2, TT20_2026_V2, ...
    version_no = models.PositiveIntegerField(default=1)
    legal_basis = models.CharField(max_length=255, default="Thông tư 80/2021/TT-BTC")
    correction_reference = models.CharField(max_length=255, blank=True, default="")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, default="ACTIVE")  # ACTIVE, SUPERSEDED, DEPRECATED
    schema_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_tax_form_version"
        ordering = ("form", "effective_from")
        unique_together = (("form", "version_code"),)


class TaxFormIndicator(models.Model):
    form_version = models.ForeignKey(
        TaxFormVersion,
        on_delete=models.CASCADE,
        related_name="indicators",
    )
    parent_indicator = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_indicators",
    )
    indicator_code = models.CharField(max_length=50)  # [21] .. [43], [32a], [32b], [34a], ...
    indicator_name = models.CharField(max_length=500)
    display_order = models.PositiveIntegerField(default=0)
    data_type = models.CharField(max_length=30, default="NUMBER")  # NUMBER, BOOLEAN, TEXT
    source_type = models.CharField(max_length=80, blank=True, default="VAT_LEDGER")
    formula_expression = models.CharField(max_length=300, blank=True, default="")
    is_required = models.BooleanField(default=False)

    class Meta:
        db_table = "rpt_tax_form_indicator"
        ordering = ("display_order", "indicator_code")
        unique_together = (("form_version", "indicator_code"),)


class TaxCalculationRule(models.Model):
    rule_code = models.CharField(max_length=100, unique=True)
    rule_name = models.CharField(max_length=255)
    tax_type = models.CharField(max_length=30, default="VAT")
    rule_type = models.CharField(max_length=80, blank=True, default="RATE_RULE")
    legal_basis = models.CharField(max_length=255, blank=True, default="")
    applicable_rate = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    condition_payload = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "rpt_tax_calculation_rule"
        ordering = ("tax_type", "rule_code")


class VatLedgerEntry(models.Model):
    company_id = models.CharField(max_length=100, default="DEFAULT-COMPANY", db_index=True)
    branch_id = models.CharField(max_length=100, null=True, blank=True)
    tax_period_code = models.CharField(max_length=40, blank=True, default="")
    direction = models.CharField(max_length=15, default="INPUT")  # INPUT / OUTPUT
    tax_invoice = models.ForeignKey(
        "tax_management.TaxInvoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vat_ledger_entries",
    )
    invoice_number = models.CharField(max_length=80, blank=True, default="")
    invoice_symbol = models.CharField(max_length=50, blank=True, default="")
    invoice_form_symbol = models.CharField(max_length=50, blank=True, default="1")
    invoice_date = models.DateField(null=True, blank=True)
    posting_date = models.DateField(null=True, blank=True)
    voucher_id = models.CharField(max_length=100, blank=True, default="")
    voucher_number = models.CharField(max_length=100, blank=True, default="")
    counterparty_name = models.CharField(max_length=255, blank=True, default="")
    counterparty_tax_code = models.CharField(max_length=50, blank=True, default="")
    item_name = models.CharField(max_length=500, blank=True, default="")
    amount_before_tax = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_rate_percent = models.DecimalField(max_digits=9, decimal_places=4, default=10)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    deductible_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    non_deductible_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_account_code = models.CharField(max_length=30, blank=True, default="1331")
    revenue_account_code = models.CharField(max_length=30, blank=True, default="5111")
    item_tax_group = models.CharField(max_length=80, blank=True, default="1")
    revenue_tax_group = models.CharField(max_length=80, blank=True, default="RATE_10")
    deductibility_status = models.CharField(max_length=30, default="ELIGIBLE")  # ELIGIBLE, INELIGIBLE, PARTIAL, PENDING_REVIEW
    invoice_status = models.CharField(max_length=30, default="ACTIVE")  # ACTIVE, CANCELLED, REPLACED, ADJUSTED
    original_invoice_id = models.CharField(max_length=100, blank=True, default="")
    adjustment_type = models.CharField(max_length=40, blank=True, default="NONE")
    payment_evidence_status = models.CharField(max_length=40, blank=True, default="NON_CASH_VERIFIED")
    gl_reconciliation_status = models.CharField(max_length=40, blank=True, default="MATCHED")
    is_duplicate_flagged = models.BooleanField(default=False)
    note = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_tax_vat_ledger"
        ordering = ("invoice_date", "invoice_number", "id")


class TaxUninvoicedPurchaseItem(models.Model):
    """
    Dữ liệu thu mua hàng hóa, dịch vụ không có hóa đơn phục vụ Bảng kê 02/TNDN (RPT-0177).
    """

    company_id = models.CharField(max_length=100, default="DEFAULT-COMPANY", db_index=True)
    branch_id = models.CharField(max_length=100, null=True, blank=True)
    tax_period_code = models.CharField(max_length=40, blank=True, default="")
    purchase_date = models.DateField()
    seller_name = models.CharField(max_length=255, blank=True, default="")
    seller_address = models.CharField(max_length=500, blank=True, default="")
    seller_identity_number = models.CharField(max_length=50, blank=True, default="")
    seller_phone = models.CharField(max_length=50, blank=True, default="")
    item_name = models.CharField(max_length=500)
    unit_of_measure = models.CharField(max_length=80, blank=True, default="kg")
    quantity_or_weight = models.DecimalField(max_digits=20, decimal_places=4, default=1)
    unit_price = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_payment_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    voucher_id = models.CharField(max_length=100, blank=True, default="")
    voucher_number = models.CharField(max_length=100, blank=True, default="")
    payment_voucher_id = models.CharField(max_length=100, blank=True, default="")
    payment_method = models.CharField(max_length=30, default="CASH")
    purchase_category_type = models.CharField(max_length=80, blank=True, default="AGRICULTURAL_SEAFOOD")
    expense_or_inventory_account = models.CharField(max_length=30, blank=True, default="1561")
    cit_deductibility_status = models.CharField(max_length=30, default="ELIGIBLE")
    supporting_document_status = models.CharField(max_length=30, default="COMPLETE")
    form_version = models.CharField(max_length=50, default="TT20_2026_V2")
    note = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_tax_uninvoiced_purchase"
        ordering = ("purchase_date", "id")


class TaxReportRun(models.Model):
    run_number = models.CharField(max_length=140, unique=True)
    report_definition = models.ForeignKey(
        ReportDefinition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tax_report_runs",
    )
    report_code = models.CharField(max_length=50, db_index=True)
    report_name = models.CharField(max_length=255, blank=True, default="")
    report_category_type = models.CharField(max_length=40, default="MANAGEMENT_REPORT")
    company_id = models.CharField(max_length=100, default="DEFAULT-COMPANY", db_index=True)
    branch_id = models.CharField(max_length=100, null=True, blank=True)
    tax_type = models.CharField(max_length=40, default="VAT")
    period_type = models.CharField(max_length=30, default="MONTH")
    tax_period_code = models.CharField(max_length=40, blank=True, default="")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    fiscal_year = models.PositiveIntegerField(default=2026)
    form_code = models.CharField(max_length=80, blank=True, default="")
    form_version = models.CharField(max_length=80, blank=True, default="")
    rule_version = models.CharField(max_length=80, blank=True, default="RULE_2026_V1")
    data_mode = models.CharField(max_length=40, default="DYNAMIC_QUERY")
    status = models.CharField(max_length=40, default="SAVED_SNAPSHOT")
    validation_status = models.CharField(max_length=40, default="VALID")
    is_stale = models.BooleanField(default=False)
    parameters = models.JSONField(default=dict, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)
    source_snapshot_meta = models.JSONField(default=dict, blank=True)
    row_count = models.PositiveIntegerField(default=0)
    warning_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    generated_by = models.CharField(max_length=150, blank=True, default="system")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_tax_report_run"
        ordering = ("-generated_at", "-id")


class TaxReportRow(models.Model):
    run = models.ForeignKey(
        TaxReportRun,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_order = models.PositiveIntegerField(default=1)
    row_type = models.CharField(max_length=30, default="DETAIL")
    group_code = models.CharField(max_length=80, blank=True, default="")
    indicator_code = models.CharField(max_length=100, blank=True, default="")
    indicator_name = models.CharField(max_length=500, blank=True, default="")
    invoice_id = models.CharField(max_length=100, blank=True, default="")
    voucher_id = models.CharField(max_length=100, blank=True, default="")
    tax_account_code = models.CharField(max_length=30, blank=True, default="")
    columns_payload = models.JSONField(default=dict, blank=True)
    detail_payload = models.JSONField(default=dict, blank=True)
    source_refs = models.JSONField(default=list, blank=True)
    warning_codes = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "rpt_tax_report_row"
        ordering = ("row_order", "id")


class TaxReportValidationResult(models.Model):
    run = models.ForeignKey(
        TaxReportRun,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    check_code = models.CharField(max_length=100)
    check_name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, default="WARNING")  # INFO, WARNING, ERROR
    status = models.CharField(max_length=20, default="PASSED")  # PASSED, WARNING, FAILED
    message = models.TextField()
    affected_rows = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_tax_report_validation"
        ordering = ("id",)


# ============================================================================
# UC-RPT-08 – BÁO CÁO MUA HÀNG (11 BÁO CÁO)
# RPT-0047, RPT-0048, RPT-0049, RPT-0050, RPT-0051,
# RPT-0061, RPT-0064, RPT-0068, RPT-0070, RPT-0074, RPT-0075
# ============================================================================

class PurchaseReportRun(models.Model):
    run_number = models.CharField(max_length=100, unique=True, db_index=True)
    report_definition = models.ForeignKey(
        ReportDefinition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_runs",
    )
    report_code = models.CharField(max_length=50, db_index=True)
    report_name = models.CharField(max_length=255)
    report_category_type = models.CharField(
        max_length=50,
        default="PURCHASE_REPORT",
    )  # PURCHASE_LEDGER, PURCHASE_SUMMARY, PURCHASE_JOURNAL, PURCHASE_FULFILLMENT, PURCHASE_RECONCILIATION
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    branch_id = models.CharField(max_length=100, null=True, blank=True)
    period_type = models.CharField(max_length=30, default="MONTH")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    fiscal_year = models.IntegerField(null=True, blank=True)
    schema_version = models.CharField(max_length=30, default="1.0")
    data_mode = models.CharField(max_length=30, default="DYNAMIC_QUERY")
    status = models.CharField(max_length=30, default="SAVED_SNAPSHOT")
    validation_status = models.CharField(max_length=30, default="VALID")
    is_stale = models.BooleanField(default=False)
    parameters = models.JSONField(default=dict, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)
    source_snapshot_meta = models.JSONField(default=dict, blank=True)
    row_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    generated_by = models.CharField(max_length=100, default="system")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_purchase_report_run"
        ordering = ("-generated_at", "-id")


class PurchaseReportRow(models.Model):
    run = models.ForeignKey(
        PurchaseReportRun,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_order = models.PositiveIntegerField()
    row_type = models.CharField(max_length=30, default="DETAIL")  # DETAIL, GROUP_HEADER, SUBTOTAL, GRAND_TOTAL, RECONCILIATION
    group_code = models.CharField(max_length=100, blank=True, default="")
    item_id = models.CharField(max_length=100, blank=True, default="")
    item_code = models.CharField(max_length=100, blank=True, default="")
    vendor_id = models.CharField(max_length=100, blank=True, default="")
    vendor_code = models.CharField(max_length=100, blank=True, default="")
    employee_id = models.CharField(max_length=100, blank=True, default="")
    project_id = models.CharField(max_length=100, blank=True, default="")
    document_id = models.CharField(max_length=100, blank=True, default="")
    columns_payload = models.JSONField(default=dict, blank=True)
    detail_payload = models.JSONField(default=dict, blank=True)
    source_refs = models.JSONField(default=list, blank=True)
    warning_codes = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "rpt_purchase_report_row"
        ordering = ("row_order", "id")


class PurchaseReportValidationResult(models.Model):
    run = models.ForeignKey(
        PurchaseReportRun,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    check_code = models.CharField(max_length=100)
    check_name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, default="WARNING")  # INFO, WARNING, ERROR
    status = models.CharField(max_length=20, default="PASSED")  # PASSED, WARNING, FAILED
    message = models.TextField()
    affected_rows = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_purchase_report_validation"
        ordering = ("id",)


class PurchaseSavedFilter(models.Model):
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    user_id = models.CharField(max_length=100, blank=True, default="")
    report_code = models.CharField(max_length=50, db_index=True)
    filter_name = models.CharField(max_length=255)
    parameters = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_purchase_saved_filter"
        ordering = ("-updated_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("company_id", "user_id", "report_code", "filter_name"),
                name="uq_rpt_purchase_saved_filter_name",
            )
        ]


# ============================================================================
# UC-RPT-09 – BÁO CÁO BÁN HÀNG (36 BÁO CÁO)
# RPT-0076..RPT-0091, RPT-0108..RPT-0110, RPT-0113..RPT-0114,
# RPT-0117..RPT-0118, RPT-0121..RPT-0126, RPT-0128..RPT-0129,
# RPT-0132..RPT-0137
# ============================================================================

class SalesReportRun(models.Model):
    run_number = models.CharField(max_length=100, unique=True, db_index=True)
    report_definition = models.ForeignKey(
        ReportDefinition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_runs",
    )
    report_code = models.CharField(max_length=50, db_index=True)
    report_name = models.CharField(max_length=255)
    report_category_type = models.CharField(
        max_length=50,
        default="SALES_REPORT",
    )  # MANAGEMENT_REPORT, RECONCILIATION_REPORT, LEDGER, SUMMARY, ORDER, CONTRACT, WARRANTY
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    branch_id = models.CharField(max_length=100, null=True, blank=True)
    period_type = models.CharField(max_length=30, default="MONTH")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    as_of_date = models.DateField(null=True, blank=True)
    fiscal_year = models.IntegerField(null=True, blank=True)
    schema_version = models.CharField(max_length=30, default="1.0")
    data_mode = models.CharField(max_length=30, default="DYNAMIC_QUERY")
    status = models.CharField(max_length=30, default="SAVED_SNAPSHOT")
    validation_status = models.CharField(max_length=30, default="VALID")
    is_stale = models.BooleanField(default=False)
    parameters = models.JSONField(default=dict, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)
    dynamic_columns = models.JSONField(default=list, blank=True)
    source_snapshot_meta = models.JSONField(default=dict, blank=True)
    row_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    generated_by = models.CharField(max_length=100, default="system")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_sales_report_run"
        ordering = ("-generated_at", "-id")


class SalesReportRow(models.Model):
    run = models.ForeignKey(
        SalesReportRun,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_order = models.PositiveIntegerField()
    row_type = models.CharField(max_length=30, default="DETAIL")  # DETAIL, GROUP_HEADER, SUBTOTAL, GRAND_TOTAL, RECONCILIATION
    group_code = models.CharField(max_length=100, blank=True, default="")
    customer_id = models.CharField(max_length=100, blank=True, default="")
    customer_code = models.CharField(max_length=100, blank=True, default="")
    customer_name = models.CharField(max_length=255, blank=True, default="")
    item_id = models.CharField(max_length=100, blank=True, default="")
    item_code = models.CharField(max_length=100, blank=True, default="")
    item_name = models.CharField(max_length=255, blank=True, default="")
    employee_id = models.CharField(max_length=100, blank=True, default="")
    employee_code = models.CharField(max_length=100, blank=True, default="")
    employee_name = models.CharField(max_length=255, blank=True, default="")
    branch_id = models.CharField(max_length=100, blank=True, default="")
    branch_code = models.CharField(max_length=100, blank=True, default="")
    branch_name = models.CharField(max_length=255, blank=True, default="")
    order_id = models.CharField(max_length=100, blank=True, default="")
    contract_id = models.CharField(max_length=100, blank=True, default="")
    project_id = models.CharField(max_length=100, blank=True, default="")
    document_id = models.CharField(max_length=100, blank=True, default="")
    columns_payload = models.JSONField(default=dict, blank=True)
    detail_payload = models.JSONField(default=dict, blank=True)
    source_refs = models.JSONField(default=list, blank=True)
    warning_codes = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "rpt_sales_report_row"
        ordering = ("row_order", "id")


class SalesReportValidationResult(models.Model):
    run = models.ForeignKey(
        SalesReportRun,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    check_code = models.CharField(max_length=100)
    check_name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, default="WARNING")  # INFO, WARNING, ERROR
    status = models.CharField(max_length=20, default="PASSED")  # PASSED, WARNING, FAILED
    message = models.TextField()
    affected_rows = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_sales_report_validation"
        ordering = ("id",)


class SalesSavedFilter(models.Model):
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    user_id = models.CharField(max_length=100, blank=True, default="")
    report_code = models.CharField(max_length=50, db_index=True)
    filter_name = models.CharField(max_length=255)
    parameters = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_sales_saved_filter"
        ordering = ("-updated_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("company_id", "user_id", "report_code", "filter_name"),
                name="uq_rpt_sales_saved_filter_name",
            )
        ]


class DebtReportRun(models.Model):
    run_number = models.CharField(max_length=100, unique=True, db_index=True)
    report_definition = models.ForeignKey(
        ReportDefinition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="debt_runs",
    )
    report_code = models.CharField(max_length=50, db_index=True)
    report_name = models.CharField(max_length=255)
    report_direction = models.CharField(
        max_length=20,
        default="AR",
    )  # AR, AP, COMBINED
    report_category_type = models.CharField(
        max_length=50,
        default="DEBT_REPORT",
    )  # SUMMARY, DETAIL, AGING, CONFIRMATION, NOTICE, RECONCILIATION, ORDER, CONTRACT, PROJECT, COMBINED
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    branch_id = models.CharField(max_length=100, null=True, blank=True)
    period_type = models.CharField(max_length=30, default="CUSTOM")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    as_of_date = models.DateField(null=True, blank=True)
    fiscal_year = models.IntegerField(null=True, blank=True)
    schema_version = models.CharField(max_length=30, default="1.0")
    data_mode = models.CharField(max_length=30, default="DYNAMIC_QUERY")
    status = models.CharField(max_length=30, default="SAVED_SNAPSHOT")
    validation_status = models.CharField(max_length=30, default="VALID")
    is_stale = models.BooleanField(default=False)
    parameters = models.JSONField(default=dict, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)
    dynamic_columns = models.JSONField(default=list, blank=True)
    source_snapshot_meta = models.JSONField(default=dict, blank=True)
    row_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    generated_by = models.CharField(max_length=100, default="system")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_debt_report_run"
        ordering = ("-generated_at", "-id")


class DebtReportRow(models.Model):
    run = models.ForeignKey(
        DebtReportRun,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_order = models.PositiveIntegerField()
    row_type = models.CharField(max_length=30, default="DETAIL")  # DETAIL, GROUP_HEADER, SUBTOTAL, GRAND_TOTAL, RECONCILIATION
    group_code = models.CharField(max_length=100, blank=True, default="")
    partner_type = models.CharField(max_length=20, blank=True, default="")  # CUSTOMER, VENDOR, EMPLOYEE
    partner_id = models.CharField(max_length=100, blank=True, default="")
    partner_code = models.CharField(max_length=100, blank=True, default="")
    partner_name = models.CharField(max_length=255, blank=True, default="")
    item_id = models.CharField(max_length=100, blank=True, default="")
    item_code = models.CharField(max_length=100, blank=True, default="")
    item_name = models.CharField(max_length=255, blank=True, default="")
    employee_id = models.CharField(max_length=100, blank=True, default="")
    employee_code = models.CharField(max_length=100, blank=True, default="")
    employee_name = models.CharField(max_length=255, blank=True, default="")
    branch_id = models.CharField(max_length=100, blank=True, default="")
    branch_code = models.CharField(max_length=100, blank=True, default="")
    branch_name = models.CharField(max_length=255, blank=True, default="")
    order_id = models.CharField(max_length=100, blank=True, default="")
    contract_id = models.CharField(max_length=100, blank=True, default="")
    project_id = models.CharField(max_length=100, blank=True, default="")
    document_id = models.CharField(max_length=100, blank=True, default="")
    invoice_number = models.CharField(max_length=100, blank=True, default="")
    account_number = models.CharField(max_length=50, blank=True, default="")
    columns_payload = models.JSONField(default=dict, blank=True)
    detail_payload = models.JSONField(default=dict, blank=True)
    source_refs = models.JSONField(default=list, blank=True)
    warning_codes = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "rpt_debt_report_row"
        ordering = ("row_order", "id")


class DebtReportValidationResult(models.Model):
    run = models.ForeignKey(
        DebtReportRun,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    check_code = models.CharField(max_length=100)
    check_name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, default="WARNING")  # INFO, WARNING, ERROR
    status = models.CharField(max_length=20, default="PASSED")  # PASSED, WARNING, FAILED
    message = models.TextField()
    affected_rows = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_debt_report_validation"
        ordering = ("id",)


class DebtSavedFilter(models.Model):
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    user_id = models.CharField(max_length=100, blank=True, default="")
    report_code = models.CharField(max_length=50, db_index=True)
    filter_name = models.CharField(max_length=255)
    parameters = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_debt_saved_filter"
        ordering = ("-updated_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("company_id", "user_id", "report_code", "filter_name"),
                name="uq_rpt_debt_saved_filter_name",
            )
        ]


# ============================================================================
# UC-RPT-11 – Xem báo cáo tiền (Cash, Bank, Transfers & Loan Reports)
# ============================================================================


class MoneyReportRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_number = models.CharField(max_length=80, unique=True)
    report_code = models.CharField(max_length=50, db_index=True)  # RPT-0030 .. RPT-0046
    report_name = models.CharField(max_length=255)
    money_source_type = models.CharField(max_length=30, default="CASH")  # CASH, BANK, COMBINED, LOAN
    report_category_type = models.CharField(max_length=50, default="MONEY_REPORT")
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    branch_id = models.CharField(max_length=100, blank=True, default="")
    cash_fund_id = models.CharField(max_length=100, blank=True, default="")
    bank_account_id = models.CharField(max_length=100, blank=True, default="")
    period_type = models.CharField(max_length=30, default="CUSTOM")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    as_of_date = models.DateField(null=True, blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)
    dynamic_columns = models.JSONField(default=list, blank=True)
    source_snapshot_meta = models.JSONField(default=dict, blank=True)
    row_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    generated_by = models.CharField(max_length=100, default="system")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_money_report_run"
        ordering = ("-generated_at", "-id")


class MoneyReportRow(models.Model):
    run = models.ForeignKey(
        MoneyReportRun,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_order = models.PositiveIntegerField()
    row_type = models.CharField(max_length=30, default="DETAIL")  # DETAIL, GROUP_HEADER, SUBTOTAL, GRAND_TOTAL, TREE_NODE
    node_id = models.CharField(max_length=100, blank=True, default="")
    parent_node_id = models.CharField(max_length=100, blank=True, default="")
    node_type = models.CharField(max_length=50, blank=True, default="")  # BRANCH, ACCOUNT, CASH_FUND, BANK_ACCOUNT
    fund_id = models.CharField(max_length=100, blank=True, default="")
    bank_account_id = models.CharField(max_length=100, blank=True, default="")
    gl_account_code = models.CharField(max_length=50, blank=True, default="")
    counterparty_name = models.CharField(max_length=255, blank=True, default="")
    loan_agreement_id = models.CharField(max_length=100, blank=True, default="")
    transfer_id = models.CharField(max_length=100, blank=True, default="")
    document_id = models.CharField(max_length=100, blank=True, default="")
    document_no = models.CharField(max_length=100, blank=True, default="")
    columns_payload = models.JSONField(default=dict, blank=True)
    detail_payload = models.JSONField(default=dict, blank=True)
    source_refs = models.JSONField(default=list, blank=True)
    warning_codes = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "rpt_money_report_row"
        ordering = ("row_order", "id")


class MoneyReportValidationResult(models.Model):
    run = models.ForeignKey(
        MoneyReportRun,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    check_code = models.CharField(max_length=100)
    check_name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, default="WARNING")  # INFO, WARNING, ERROR
    status = models.CharField(max_length=20, default="PASSED")  # PASSED, WARNING, FAILED
    message = models.TextField()
    affected_rows = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_money_report_validation"
        ordering = ("id",)


class MoneySavedFilter(models.Model):
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    user_id = models.CharField(max_length=100, blank=True, default="")
    report_code = models.CharField(max_length=50, db_index=True)
    filter_name = models.CharField(max_length=255)
    parameters = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_money_saved_filter"
        ordering = ("-updated_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("company_id", "user_id", "report_code", "filter_name"),
                name="uq_rpt_money_saved_filter_name",
            )
        ]


# ============================================================================
# UC-RPT-12 – Xem báo cáo kho (15 Báo cáo kho)
# ============================================================================


class InventoryReportRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_number = models.CharField(max_length=80, unique=True)
    report_code = models.CharField(max_length=50, db_index=True)  # RPT-0143 .. RPT-0157
    report_name = models.CharField(max_length=255)
    inventory_source_type = models.CharField(max_length=30, default="STOCK")  # STOCK, RECONCILIATION, PRODUCTION, ASSEMBLY
    report_category_type = models.CharField(max_length=50, default="INVENTORY_REPORT")
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    branch_id = models.CharField(max_length=100, blank=True, default="")
    warehouse_id = models.CharField(max_length=100, blank=True, default="")
    period_type = models.CharField(max_length=30, default="CUSTOM")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    as_of_date = models.DateField(null=True, blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)
    dynamic_columns = models.JSONField(default=list, blank=True)
    source_snapshot_meta = models.JSONField(default=dict, blank=True)
    row_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    is_stale = models.BooleanField(default=False)
    generated_by = models.CharField(max_length=100, default="system")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_inventory_report_run"
        ordering = ("-generated_at", "-id")


class InventoryReportRow(models.Model):
    run = models.ForeignKey(
        InventoryReportRun,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_order = models.PositiveIntegerField()
    row_type = models.CharField(max_length=30, default="DETAIL")  # DETAIL, GROUP_HEADER, SUBTOTAL, GRAND_TOTAL, TREE_NODE
    node_id = models.CharField(max_length=100, blank=True, default="")
    parent_node_id = models.CharField(max_length=100, blank=True, default="")
    warehouse_id = models.CharField(max_length=100, blank=True, default="")
    warehouse_name = models.CharField(max_length=255, blank=True, default="")
    item_id = models.CharField(max_length=100, blank=True, default="")
    item_code = models.CharField(max_length=100, blank=True, default="")
    item_name = models.CharField(max_length=255, blank=True, default="")
    category_id = models.CharField(max_length=100, blank=True, default="")
    category_name = models.CharField(max_length=255, blank=True, default="")
    category_level = models.IntegerField(default=0)
    uom_id = models.CharField(max_length=100, blank=True, default="")
    uom_name = models.CharField(max_length=50, blank=True, default="")
    lot_id = models.CharField(max_length=100, blank=True, default="")
    lot_code = models.CharField(max_length=100, blank=True, default="")
    location_id = models.CharField(max_length=100, blank=True, default="")
    location_name = models.CharField(max_length=100, blank=True, default="")
    document_id = models.CharField(max_length=100, blank=True, default="")
    document_no = models.CharField(max_length=100, blank=True, default="")
    production_order_id = models.CharField(max_length=100, blank=True, default="")
    assembly_order_id = models.CharField(max_length=100, blank=True, default="")
    gl_account_code = models.CharField(max_length=50, blank=True, default="")
    columns_payload = models.JSONField(default=dict, blank=True)
    detail_payload = models.JSONField(default=dict, blank=True)
    source_refs = models.JSONField(default=list, blank=True)
    warning_codes = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "rpt_inventory_report_row"
        ordering = ("row_order", "id")


class InventoryReportValidationResult(models.Model):
    run = models.ForeignKey(
        InventoryReportRun,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    check_code = models.CharField(max_length=100)
    check_name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, default="WARNING")  # INFO, WARNING, ERROR
    status = models.CharField(max_length=20, default="PASSED")  # PASSED, WARNING, FAILED
    message = models.TextField()
    affected_rows = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_inventory_report_validation"
        ordering = ("id",)


class InventorySavedFilter(models.Model):
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    user_id = models.CharField(max_length=100, blank=True, default="")
    report_code = models.CharField(max_length=50, db_index=True)
    filter_name = models.CharField(max_length=255)
    parameters = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_inventory_saved_filter"
        ordering = ("-updated_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("company_id", "user_id", "report_code", "filter_name"),
                name="uq_rpt_inventory_saved_filter_name",
            )
        ]


# ============================================================================
# UC-RPT-13 – Xem báo cáo tài sản và công cụ dụng cụ (14 Báo cáo TSCĐ, CCDC & CPTT)
# ============================================================================


class AssetReportRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_number = models.CharField(max_length=80, unique=True)
    report_code = models.CharField(max_length=50, db_index=True)  # RPT-0158 .. RPT-0171
    report_name = models.CharField(max_length=255)
    asset_report_type = models.CharField(max_length=30, default="FIXED_ASSET")  # FIXED_ASSET, CCDC, PREPAID, RECONCILIATION
    report_category_type = models.CharField(max_length=50, default="ASSET_REPORT")
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    branch_id = models.CharField(max_length=100, blank=True, default="")
    department_id = models.CharField(max_length=100, blank=True, default="")
    asset_category_id = models.CharField(max_length=100, blank=True, default="")
    fiscal_year = models.PositiveSmallIntegerField(null=True, blank=True)
    period_type = models.CharField(max_length=30, default="CUSTOM")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    as_of_date = models.DateField(null=True, blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)
    dynamic_columns = models.JSONField(default=list, blank=True)
    source_snapshot_meta = models.JSONField(default=dict, blank=True)
    row_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    is_stale = models.BooleanField(default=False)
    generated_by = models.CharField(max_length=100, default="system")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_asset_report_run"
        ordering = ("-generated_at", "-id")


class AssetReportRow(models.Model):
    run = models.ForeignKey(
        AssetReportRun,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_order = models.PositiveIntegerField()
    row_type = models.CharField(max_length=30, default="DETAIL")  # DETAIL, GROUP_HEADER, SUBTOTAL, GRAND_TOTAL, CARD_SECTION
    node_id = models.CharField(max_length=100, blank=True, default="")
    parent_node_id = models.CharField(max_length=100, blank=True, default="")
    asset_id = models.CharField(max_length=100, blank=True, default="")
    asset_code = models.CharField(max_length=100, blank=True, default="")
    asset_name = models.CharField(max_length=255, blank=True, default="")
    asset_type = models.CharField(max_length=30, blank=True, default="")  # FIXED_ASSET, TOOL, PREPAID
    category_id = models.CharField(max_length=100, blank=True, default="")
    category_name = models.CharField(max_length=255, blank=True, default="")
    department_id = models.CharField(max_length=100, blank=True, default="")
    department_name = models.CharField(max_length=255, blank=True, default="")
    custodian_id = models.CharField(max_length=100, blank=True, default="")
    custodian_name = models.CharField(max_length=255, blank=True, default="")
    document_id = models.CharField(max_length=100, blank=True, default="")
    document_no = models.CharField(max_length=100, blank=True, default="")
    gl_account_code = models.CharField(max_length=50, blank=True, default="")
    columns_payload = models.JSONField(default=dict, blank=True)
    detail_payload = models.JSONField(default=dict, blank=True)
    source_refs = models.JSONField(default=list, blank=True)
    warning_codes = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "rpt_asset_report_row"
        ordering = ("row_order", "id")


class AssetReportValidationResult(models.Model):
    run = models.ForeignKey(
        AssetReportRun,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    check_code = models.CharField(max_length=100)
    check_name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, default="WARNING")  # INFO, WARNING, ERROR
    status = models.CharField(max_length=20, default="PASSED")  # PASSED, WARNING, FAILED
    message = models.TextField()
    affected_rows = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_asset_report_validation"
        ordering = ("id",)


class AssetSavedFilter(models.Model):
    company_id = models.CharField(max_length=100, db_index=True, default="DEFAULT-COMPANY")
    user_id = models.CharField(max_length=100, blank=True, default="")
    report_code = models.CharField(max_length=50, db_index=True)
    filter_name = models.CharField(max_length=255)
    parameters = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rpt_asset_saved_filter"
        ordering = ("-updated_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("company_id", "user_id", "report_code", "filter_name"),
                name="uq_rpt_asset_saved_filter_name",
            )
        ]


class ReportExportJob(models.Model):
    """
    UC-RPT-15 TO-BE: Quản lý Export Job đồng bộ & bất đồng bộ.
    State Machine: QUEUED -> RUNNING -> COMPLETED / FAILED / CANCELLED / EXPIRED
    """
    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Đang chờ xử lý"
        RUNNING = "RUNNING", "Đang kết xuất"
        COMPLETED = "COMPLETED", "Hoàn thành"
        FAILED = "FAILED", "Thất bại"
        CANCELLED = "CANCELLED", "Đã hủy"
        EXPIRED = "EXPIRED", "Hết hạn"

    class Scope(models.TextChoices):
        ALL_MATCHING_FILTERS = "ALL_MATCHING_FILTERS", "Tất cả dòng thỏa mãn bộ lọc"
        CURRENT_VIEW = "CURRENT_VIEW", "Dữ liệu góc nhìn hiện tại"
        CURRENT_PAGE = "CURRENT_PAGE", "Trang hiện tại"
        SELECTED_ROWS = "SELECTED_ROWS", "Các dòng được chọn"
        DRILLDOWN_NODE = "DRILLDOWN_NODE", "Nút phân tích Drilldown"
        APPROVED_SNAPSHOT = "APPROVED_SNAPSHOT", "Snapshot đã phê duyệt"

    class Format(models.TextChoices):
        XLSX = "XLSX", "Excel (.xlsx)"
        PDF = "PDF", "PDF (.pdf)"
        CSV = "CSV", "CSV (.csv)"
        DOCX = "DOCX", "Word (.docx)"
        PRINT = "PRINT", "Bản in (HTML Print Preview)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_id = models.CharField(max_length=100, db_index=True)
    requested_by_user_id = models.CharField(max_length=100, blank=True, default="")
    report_code = models.CharField(max_length=100, db_index=True)
    report_definition = models.ForeignKey(
        "ReportDefinition", on_delete=models.SET_NULL, null=True, blank=True, related_name="export_jobs"
    )
    report_run = models.ForeignKey(
        "ReportRun", on_delete=models.SET_NULL, null=True, blank=True, related_name="unified_export_jobs"
    )
    report_context_reference = models.CharField(max_length=255, blank=True, default="")
    parameters_snapshot_json = models.JSONField(default=dict, blank=True)
    columns_snapshot_json = models.JSONField(default=list, blank=True)
    export_options_json = models.JSONField(default=dict, blank=True)
    export_scope = models.CharField(max_length=50, choices=Scope.choices, default=Scope.ALL_MATCHING_FILTERS)
    output_format = models.CharField(max_length=20, choices=Format.choices, default=Format.XLSX)
    template_version_reference = models.CharField(max_length=100, blank=True, default="STANDARD_V1")
    schema_version = models.CharField(max_length=50, default="1.0")
    calculation_rule_version = models.CharField(max_length=50, default="1.0")
    source_snapshot_reference = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.QUEUED, db_index=True)
    idempotency_key = models.CharField(max_length=255, blank=True, default="", db_index=True)
    row_count_expected = models.BigIntegerField(default=0)
    row_count_actual = models.BigIntegerField(default=0)
    error_code = models.CharField(max_length=100, null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    attempt_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rpt_report_export_job"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("company_id", "status"), name="ix_rpt_exp_job_co_st"),
            models.Index(fields=("company_id", "report_code"), name="ix_rpt_exp_job_co_rc"),
            models.Index(fields=("company_id", "idempotency_key"), name="ix_rpt_exp_job_co_idem"),
        ]


class ReportExportArtifact(models.Model):
    """
    UC-RPT-15 TO-BE: Quản lý File kết quả xuất (PDF, XLSX, CSV, DOCX, PRINT).
    Lưu trữ Checksum SHA256, dung lượng, số dòng, cột, token tải và thời hạn.
    """
    class FileStatus(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Khả dụng"
        EXPIRED = "EXPIRED", "Hết hạn"
        DELETED = "DELETED", "Đã xóa"
        QUARANTINED = "QUARANTINED", "Cách ly"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    export_job = models.ForeignKey(
        ReportExportJob, on_delete=models.CASCADE, related_name="artifacts"
    )
    company_id = models.CharField(max_length=100, db_index=True)
    file_name = models.CharField(max_length=255)
    storage_key = models.CharField(max_length=500)
    mime_type = models.CharField(max_length=150)
    file_extension = models.CharField(max_length=20)
    file_size_bytes = models.BigIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64, blank=True, default="")
    page_count = models.IntegerField(default=1)
    sheet_count = models.IntegerField(default=1)
    row_count = models.BigIntegerField(default=0)
    column_count = models.IntegerField(default=0)
    download_token = models.CharField(max_length=255, blank=True, default="", db_index=True)
    file_status = models.CharField(
        max_length=30, choices=FileStatus.choices, default=FileStatus.AVAILABLE, db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rpt_report_export_artifact"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("company_id", "file_status"), name="ix_rpt_exp_art_co_st"),
            models.Index(fields=("download_token",), name="ix_rpt_exp_art_token"),
        ]


class ReportExportTemplate(models.Model):
    """
    UC-RPT-15 TO-BE: Quản lý Template mẫu in/xuất chuẩn pháp lý (TT200, TT99, TT133) và quản trị.
    """
    class TemplateType(models.TextChoices):
        LEGAL = "LEGAL", "Mẫu chuẩn pháp lý"
        MANAGEMENT = "MANAGEMENT", "Mẫu quản trị nội bộ"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Dự thảo"
        PUBLISHED = "PUBLISHED", "Đang áp dụng"
        RETIRED = "RETIRED", "Hết hiệu lực"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_code = models.CharField(max_length=100, db_index=True)
    template_code = models.CharField(max_length=100, db_index=True)
    template_name = models.CharField(max_length=255, default="")
    output_format = models.CharField(max_length=20, default="XLSX")
    template_type = models.CharField(
        max_length=30, choices=TemplateType.choices, default=TemplateType.LEGAL
    )
    legal_form_code = models.CharField(max_length=100, blank=True, default="")
    legal_basis = models.CharField(max_length=255, blank=True, default="")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PUBLISHED)
    layout_definition_json = models.JSONField(default=dict, blank=True)
    required_columns_json = models.JSONField(default=list, blank=True)
    supported_options_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_report_export_template"
        ordering = ("template_code",)
        constraints = [
            models.UniqueConstraint(
                fields=("report_code", "template_code", "output_format"),
                name="uq_rpt_export_template_code_format",
            )
        ]


class ReportExportDownloadEvent(models.Model):
    """
    UC-RPT-15 TO-BE: Truy vết lượt tải Artifact.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    artifact = models.ForeignKey(
        ReportExportArtifact, on_delete=models.CASCADE, related_name="download_events"
    )
    company_id = models.CharField(max_length=100, db_index=True)
    user_id = models.CharField(max_length=100, blank=True, default="")
    download_time = models.DateTimeField(auto_now_add=True)
    client_ip = models.CharField(max_length=50, blank=True, default="")
    user_agent = models.CharField(max_length=255, blank=True, default="")
    download_status = models.CharField(max_length=30, default="SUCCESS")
    request_id = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        db_table = "rpt_report_export_download_event"
        ordering = ("-download_time",)


class ReportDrilldownDefinition(models.Model):
    """
    UC-RPT-14: Cấu hình quy tắc và khả năng xem chi tiết số liệu báo cáo (Drill-down Definition).
    """
    class DrilldownType(models.TextChoices):
        FORMULA = "FORMULA", "Chỉ tiêu công thức"
        AGGREGATE = "AGGREGATE", "Chỉ tiêu tổng hợp"
        TRANSACTION = "TRANSACTION", "Số liệu phát sinh"
        BALANCE = "BALANCE", "Số dư"
        INVENTORY_COST = "INVENTORY_COST", "Giá trị nhập/xuất kho"
        SETTLEMENT = "SETTLEMENT", "Công nợ và thanh toán"
        TAX_INDICATOR = "TAX_INDICATOR", "Chỉ tiêu thuế"
        ALLOCATION = "ALLOCATION", "Khấu hao và phân bổ"
        RATIO = "RATIO", "Tỷ số / Chỉ số bình quân"
        MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT", "Giá trị điều chỉnh"
        NON_DRILLABLE = "NON_DRILLABLE", "Giá trị không truy được"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_code = models.CharField(max_length=100, db_index=True)
    template_version_id = models.CharField(max_length=100, blank=True, default="")
    row_selector = models.CharField(max_length=100, blank=True, default="")
    measure_code = models.CharField(max_length=100, blank=True, default="")
    drilldown_type = models.CharField(max_length=50, choices=DrilldownType.choices, default=DrilldownType.AGGREGATE)
    source_resolver_code = models.CharField(max_length=100, default="DEFAULT_RESOLVER")
    grouping_definition_json = models.JSONField(default=list, blank=True)
    allowed_source_types_json = models.JSONField(default=list, blank=True)
    target_report_code = models.CharField(max_length=100, blank=True, default="")
    permission_code = models.CharField(max_length=100, default="RPT_DRILLDOWN_VIEW")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, default="ACTIVE")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rpt_drilldown_definition"
        ordering = ("report_code", "row_selector")


class ReportCellContext(models.Model):
    """
    UC-RPT-14: Định danh và lưu trữ ngữ cảnh ô số liệu được chọn để xem chi tiết.
    Xác định chính xác theo: Report Context + Row Key + Column Key + Value Slot.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_id = models.CharField(max_length=100, db_index=True)
    report_code = models.CharField(max_length=100, db_index=True)
    report_run_id = models.CharField(max_length=100, blank=True, default="")
    row_key = models.CharField(max_length=100, db_index=True)
    column_key = models.CharField(max_length=100, db_index=True)
    value_slot = models.CharField(max_length=50, default="CURRENT_PERIOD")
    indicator_code = models.CharField(max_length=100, blank=True, default="")
    indicator_name = models.CharField(max_length=255, blank=True, default="")
    measure_code = models.CharField(max_length=100, blank=True, default="")
    parameters_hash = models.CharField(max_length=64, blank=True, default="")
    parameters_snapshot_json = models.JSONField(default=dict, blank=True)
    drilldown_type = models.CharField(max_length=50, default="AGGREGATE")
    formula_expression = models.CharField(max_length=500, blank=True, default="")
    currency_code = models.CharField(max_length=20, default="VND")
    display_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    value_type = models.CharField(max_length=30, default="AMOUNT")
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    as_of_date = models.DateField(null=True, blank=True)
    is_additive = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rpt_report_cell_context"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("company_id", "report_code"), name="ix_rpt_cell_co_rc"),
            models.Index(fields=("row_key", "column_key", "value_slot"), name="ix_rpt_cell_lookup"),
        ]


class ReportCalculationContribution(models.Model):
    """
    UC-RPT-14: Thành phần đóng góp cấu thành nên chỉ tiêu (Level 1 / Level 2).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cell_context = models.ForeignKey(
        ReportCellContext, on_delete=models.CASCADE, related_name="contributions"
    )
    parent_node_id = models.CharField(max_length=100, blank=True, default="")
    component_key = models.CharField(max_length=100, db_index=True)
    component_name = models.CharField(max_length=255, default="")
    component_type = models.CharField(max_length=50, default="ACCOUNT")
    raw_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    sign_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=1)
    contribution_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    is_additive = models.BooleanField(default=True)
    has_children = models.BooleanField(default=False)
    details_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "rpt_report_calculation_contribution"
        ordering = ("component_key",)


class ReportSourceReference(models.Model):
    """
    UC-RPT-14: Tham chiếu dòng phát sinh sổ cái hoặc chứng từ nguồn (Level 3 / Level 4).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cell_context = models.ForeignKey(
        ReportCellContext, on_delete=models.CASCADE, related_name="source_references"
    )
    company_id = models.CharField(max_length=100, db_index=True)
    source_module = models.CharField(max_length=50, default="GL")
    source_type = models.CharField(max_length=100, default="JOURNAL_ENTRY")
    source_id = models.CharField(max_length=100, db_index=True)
    source_line_id = models.CharField(max_length=100, blank=True, default="")
    document_no = models.CharField(max_length=100, default="")
    document_date = models.DateField(null=True, blank=True)
    posting_date = models.DateField(null=True, blank=True)
    document_type_name = models.CharField(max_length=100, default="")
    party_name = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    account_code = models.CharField(max_length=50, blank=True, default="")
    counter_account_code = models.CharField(max_length=50, blank=True, default="")
    debit_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    credit_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    document_total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    attributed_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    currency_code = models.CharField(max_length=20, default="VND")
    evidence_status = models.CharField(max_length=30, default="AVAILABLE")
    navigation_url = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "rpt_report_source_reference"
        ordering = ("-posting_date", "-document_no")
        indexes = [
            models.Index(fields=("company_id", "source_module"), name="ix_rpt_src_co_mod"),
            models.Index(fields=("source_id", "source_type"), name="ix_rpt_src_lookup"),
        ]














