import uuid

from django.db import models
from django.db.models import Q


class InvoiceDirection(models.TextChoices):
    INPUT = "INPUT", "Hóa đơn đầu vào"
    OUTPUT = "OUTPUT", "Hóa đơn đầu ra"


class InvoiceStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    RECEIVED = "RECEIVED", "Đã tiếp nhận"
    VALIDATED = "VALIDATED", "Đã kiểm tra"
    BLOCKED = "BLOCKED", "Bị chặn"
    ISSUING = "ISSUING", "Đang phát hành"
    ISSUED = "ISSUED", "Đã phát hành"
    CANCELLED = "CANCELLED", "Đã hủy"
    REPLACED = "REPLACED", "Đã thay thế"
    ADJUSTED = "ADJUSTED", "Đã điều chỉnh"


class IntegrationStatus(models.TextChoices):
    PENDING = "PENDING", "Đang xử lý"
    SUCCESS = "SUCCESS", "Thành công"
    FAILED = "FAILED", "Thất bại"


class RunStatus(models.TextChoices):
    COMPLETED = "COMPLETED", "Hoàn tất"
    FAILED = "FAILED", "Lỗi"


class TaxPeriod(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="tax_periods")
    code = models.CharField(max_length=30)
    tax_type = models.CharField(max_length=30, default="VAT")
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=10, choices=(("OPEN", "Mở"), ("CLOSED", "Đóng")), default="OPEN")

    class Meta:
        db_table = "tax_period"
        constraints = [
            models.UniqueConstraint(fields=("company", "tax_type", "code"), name="uq_tax_period"),
            models.CheckConstraint(condition=Q(end_date__gte=models.F("start_date")), name="ck_tax_period_dates"),
        ]


class TaxInvoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="tax_invoices")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, related_name="tax_invoices")
    direction = models.CharField(max_length=10, choices=InvoiceDirection.choices)
    invoice_type = models.CharField(max_length=20, choices=(("ORIGINAL", "Gốc"), ("ADJUSTMENT", "Điều chỉnh"), ("REPLACEMENT", "Thay thế")), default="ORIGINAL")
    adjustment_effect = models.CharField(max_length=10, choices=(("INCREASE", "Điều chỉnh tăng"), ("DECREASE", "Điều chỉnh giảm")), blank=True)
    original_invoice = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="related_invoices")
    invoice_series = models.CharField(max_length=50)
    invoice_number = models.CharField(max_length=80)
    invoice_date = models.DateField()
    seller_name = models.CharField(max_length=255)
    seller_tax_code = models.CharField(max_length=30)
    buyer_name = models.CharField(max_length=255)
    buyer_tax_code = models.CharField(max_length=30, blank=True)
    party = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True, related_name="tax_invoices")
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    subtotal = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    source = models.CharField(max_length=20, choices=(("MANUAL", "Nhập tay"), ("FILE", "Tệp"), ("API", "API"), ("SALES", "Bán hàng")), default="MANUAL")
    source_reference = models.CharField(max_length=150, blank=True)
    external_status = models.CharField(max_length=50, blank=True)
    external_reference = models.CharField(max_length=150, blank=True)
    raw_data = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=InvoiceStatus.choices, default=InvoiceStatus.DRAFT)
    tax_eligible = models.BooleanField(default=False)
    duplicate_suspected = models.BooleanField(default=False)
    validation_summary = models.JSONField(default=dict, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="tax_invoices_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_invoice"
        ordering = ("-invoice_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "direction", "seller_tax_code", "invoice_series", "invoice_number"), name="uq_tax_invoice_identity"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0), name="ck_tax_invoice_rate_positive"),
            models.CheckConstraint(condition=Q(subtotal__gte=0, tax_amount__gte=0, total_amount__gte=0), name="ck_tax_invoice_amounts_nonnegative"),
        ]


class TaxInvoiceLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(TaxInvoice, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, null=True, blank=True)
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    taxable_amount = models.DecimalField(max_digits=24, decimal_places=4)
    tax_rate = models.DecimalField(max_digits=9, decimal_places=4)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4)

    class Meta:
        db_table = "tax_invoice_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("invoice", "line_no"), name="uq_tax_invoice_line_no"),
            models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, discount_amount__gte=0, taxable_amount__gte=0, tax_rate__gte=0, tax_amount__gte=0, total_amount__gte=0), name="ck_tax_line_values"),
        ]


class InvoiceValidation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(TaxInvoice, on_delete=models.CASCADE, related_name="validation_results")
    code = models.CharField(max_length=50)
    severity = models.CharField(max_length=10, choices=(("ERROR", "Lỗi chặn"), ("WARNING", "Cảnh báo"), ("INFO", "Thông tin")))
    message = models.CharField(max_length=1000)
    source = models.CharField(max_length=50, default="INTERNAL")
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tax_invoice_validation"


class InvoiceStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(TaxInvoice, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    reason = models.CharField(max_length=500, blank=True)
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tax_invoice_status_history"


class InvoiceDocumentLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    invoice = models.ForeignKey(TaxInvoice, on_delete=models.CASCADE, related_name="document_links")
    module_code = models.CharField(max_length=20)
    entity_type = models.CharField(max_length=80)
    entity_id = models.UUIDField()
    document_number = models.CharField(max_length=100, blank=True)
    linked_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    notes = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tax_invoice_document_link"
        constraints = [
            models.UniqueConstraint(fields=("invoice", "module_code", "entity_type", "entity_id"), name="uq_tax_invoice_document_link"),
            models.CheckConstraint(condition=Q(linked_amount__gte=0), name="ck_tax_link_amount_nonnegative"),
        ]


class TaxSummary(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    period = models.ForeignKey(TaxPeriod, on_delete=models.PROTECT, related_name="summaries")
    version = models.PositiveIntegerField(default=1)
    input_taxable_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    input_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    output_taxable_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    output_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_difference = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    exception_count = models.PositiveIntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tax_summary"
        constraints = [models.UniqueConstraint(fields=("period", "version"), name="uq_tax_summary_version")]


class TaxFiling(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    period = models.ForeignKey(TaxPeriod, on_delete=models.PROTECT, related_name="filings")
    summary = models.ForeignKey(TaxSummary, on_delete=models.PROTECT, related_name="filings")
    filing_type = models.CharField(max_length=50, default="VAT_RETURN")
    version = models.PositiveIntegerField(default=1)
    indicators = models.JSONField(default=dict)
    warnings = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=(("DRAFT", "Nháp"), ("SUBMITTED", "Đã nộp"), ("ACCEPTED", "Đã chấp nhận"), ("REJECTED", "Bị từ chối")), default="DRAFT")
    submission_reference = models.CharField(max_length=150, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_filing"
        constraints = [models.UniqueConstraint(fields=("period", "filing_type", "version"), name="uq_tax_filing_version")]


class TaxObligation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    period = models.ForeignKey(TaxPeriod, on_delete=models.PROTECT, related_name="obligations")
    filing = models.ForeignKey(TaxFiling, on_delete=models.PROTECT, null=True, blank=True, related_name="obligations")
    tax_type = models.CharField(max_length=30)
    due_date = models.DateField()
    assessed_amount = models.DecimalField(max_digits=24, decimal_places=4)
    adjustment_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    paid_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    reason = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=(("OPEN", "Còn phải nộp"), ("PARTIAL", "Nộp một phần"), ("PAID", "Đã nộp")), default="OPEN")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_obligation"
        constraints = [
            models.UniqueConstraint(fields=("period", "tax_type", "filing"), name="uq_tax_obligation_source"),
            models.CheckConstraint(condition=Q(assessed_amount__gte=0, paid_amount__gte=0), name="ck_tax_obligation_amounts_nonnegative"),
        ]

    @property
    def outstanding_amount(self):
        return self.assessed_amount + self.adjustment_amount - self.paid_amount


class TaxPaymentLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    obligation = models.ForeignKey(TaxObligation, on_delete=models.PROTECT, related_name="payment_links")
    source_module = models.CharField(max_length=10, choices=(("CASH", "Tiền mặt"), ("BANK", "Ngân hàng")))
    transaction_id = models.UUIDField()
    reference = models.CharField(max_length=100, blank=True)
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    payment_date = models.DateField()
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tax_payment_link"
        constraints = [
            models.UniqueConstraint(fields=("source_module", "transaction_id"), name="uq_tax_payment_transaction"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_tax_payment_amount_positive"),
        ]


class ReconciliationRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    period = models.ForeignKey(TaxPeriod, on_delete=models.PROTECT, related_name="reconciliations")
    status = models.CharField(max_length=20, choices=RunStatus.choices, default=RunStatus.COMPLETED)
    discrepancy_count = models.PositiveIntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tax_reconciliation_run"


class ConnectorConfig(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    code = models.CharField(max_length=50)
    provider = models.CharField(max_length=100)
    channel = models.CharField(max_length=30, choices=(("EINVOICE", "Hóa đơn điện tử"), ("TVAN", "T-VAN"), ("TAX_AUTHORITY", "Cơ quan thuế")))
    config = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_connector_config"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_tax_connector_code")]


class IntegrationRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="tax_integration_requests")
    connector = models.ForeignKey(ConnectorConfig, on_delete=models.PROTECT, related_name="requests")
    invoice = models.ForeignKey(TaxInvoice, on_delete=models.PROTECT, null=True, blank=True, related_name="integration_requests")
    filing = models.ForeignKey(TaxFiling, on_delete=models.PROTECT, null=True, blank=True, related_name="integration_requests")
    task_type = models.CharField(max_length=30)
    idempotency_key = models.CharField(max_length=150, unique=True)
    request_payload = models.JSONField(default=dict)
    response_payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=IntegrationStatus.choices, default=IntegrationStatus.PENDING)
    error_message = models.CharField(max_length=1000, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="tax_integration_requests")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_integration_request"


class TaxExport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    period = models.ForeignKey(TaxPeriod, on_delete=models.PROTECT, related_name="exports")
    filing = models.ForeignKey(TaxFiling, on_delete=models.PROTECT, null=True, blank=True, related_name="exports")
    format_code = models.CharField(max_length=30)
    format_version = models.CharField(max_length=30)
    data_snapshot = models.JSONField(default=dict)
    warnings = models.JSONField(default=list, blank=True)
    submission_status = models.CharField(max_length=20, choices=(("NOT_SUBMITTED", "Chưa nộp"), ("SUBMITTED", "Đã nộp"), ("ACCEPTED", "Đã nhận"), ("REJECTED", "Bị từ chối")), default="NOT_SUBMITTED")
    submission_reference = models.CharField(max_length=150, blank=True)
    exported_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    exported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tax_export"
