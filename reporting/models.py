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
