import uuid
from django.db import models
from django.db.models import Q


class DocumentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ phê duyệt"
    APPROVED = "APPROVED", "Đã duyệt"
    REJECTED = "REJECTED", "Từ chối"
    POSTED = "POSTED", "Đã ghi sổ"
    REVERSED = "REVERSED", "Đã đảo"
    CANCELLED = "CANCELLED", "Đã hủy"


class PayableStatus(models.TextChoices):
    OPEN = "OPEN", "Chưa thanh toán"
    PARTIALLY_PAID = "PARTIALLY_PAID", "Thanh toán một phần"
    PAID = "PAID", "Đã thanh toán"
    OVERDUE = "OVERDUE", "Quá hạn"
    REVERSED = "REVERSED", "Đã đảo"
    CANCELLED = "CANCELLED", "Đã hủy"


class PaymentMethod(models.TextChoices):
    BANK = "BANK", "Ngân hàng"
    CASH = "CASH", "Tiền mặt"
    OTHER = "OTHER", "Khác"


class PaymentSource(models.TextChoices):
    PAYMENT_REQUEST = "PAYMENT_REQUEST", "Theo đề nghị thanh toán"
    DIRECT = "DIRECT", "Thanh toán trực tiếp"


class PaymentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    POSTED = "POSTED", "Đã ghi sổ"
    CONFIRMED = "CONFIRMED", "Có hiệu lực"
    CANCELED = "CANCELED", "Đã hủy"
    CANCELLED = "CANCELLED", "Đã hủy"


class PostingStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    POSTED = "POSTED", "Đã ghi sổ"
    REVERSED = "REVERSED", "Đã đảo"


class PaymentRequestType(models.TextChoices):
    DEBT_PAYMENT = "DEBT_PAYMENT", "Thanh toán công nợ"
    SUPPLIER_ADVANCE = "SUPPLIER_ADVANCE", "Tạm ứng nhà cung cấp"


class PaymentRequestMethod(models.TextChoices):
    CASH = "CASH", "Tiền mặt"
    BANK_TRANSFER = "BANK_TRANSFER", "Chuyển khoản"


class PaymentRequestStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ phê duyệt"
    REJECTED = "REJECTED", "Bị từ chối"
    APPROVED = "APPROVED", "Đã phê duyệt"
    PARTIALLY_PAID = "PARTIALLY_PAID", "Thanh toán một phần"
    PAID = "PAID", "Đã thanh toán"
    CANCELED = "CANCELED", "Đã hủy"


class SupplierInvoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="supplier_invoices")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="supplier_invoices")
    purchase_order = models.ForeignKey("purchases.PurchaseOrder", on_delete=models.PROTECT, null=True, blank=True, related_name="input_invoices")
    source = models.CharField(max_length=20, choices=(("MANUAL", "Thủ công"), ("IMPORT", "Import"), ("EINVOICE", "HĐĐT")), default="MANUAL")
    received_via_purchase = models.BooleanField(default=False)
    supplier_tax_code = models.CharField(max_length=30)
    invoice_series = models.CharField(max_length=50)
    invoice_template = models.CharField(max_length=50, blank=True)
    invoice_number = models.CharField(max_length=80)
    invoice_type = models.CharField(max_length=20, choices=(("ORIGINAL", "Gốc"), ("ADJUSTMENT", "Điều chỉnh"), ("REPLACEMENT", "Thay thế")), default="ORIGINAL")
    adjustment_effect = models.CharField(max_length=10, choices=(("INCREASE", "Tăng"), ("DECREASE", "Giảm")), blank=True)
    original_invoice = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="related_invoices")
    is_replaced = models.BooleanField(default=False)
    invoice_date = models.DateField()
    seller_name = models.CharField(max_length=255, blank=True)
    seller_address = models.CharField(max_length=500, blank=True)
    buyer_name = models.CharField(max_length=255, blank=True)
    buyer_tax_code = models.CharField(max_length=30, blank=True)
    buyer_address = models.CharField(max_length=500, blank=True)
    notes = models.CharField(max_length=500, blank=True)
    posting_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True, related_name="supplier_invoices")
    payment_method_config = models.ForeignKey("master_data.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True, related_name="supplier_invoices")
    payment_method_snapshot = models.JSONField(default=dict, blank=True)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    subtotal = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    adjustment_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    linked_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    validation_status = models.CharField(max_length=20, choices=(("PENDING_VALIDATION", "Chờ kiểm tra"), ("VALID", "Hợp lệ"), ("INVALID", "Không hợp lệ")), default="PENDING_VALIDATION")
    status = models.CharField(max_length=30, choices=DocumentStatus.choices, default=DocumentStatus.DRAFT)
    match_status = models.CharField(max_length=30, choices=(("UNMATCHED", "Chưa đối chiếu"), ("PARTIALLY_MATCHED", "Khớp một phần"), ("MATCHED", "Khớp"), ("VARIANCE", "Có sai lệch"), ("ACCEPTED_VARIANCE", "Đã chấp nhận sai lệch")), default="UNMATCHED")
    match_details = models.JSONField(default=dict, blank=True)
    original_file = models.JSONField(default=dict, blank=True)
    tax_eligible = models.BooleanField(default=True)
    approval_required = models.BooleanField(default=True)
    workflow_snapshot = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="supplier_invoices_created")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    posting_reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ap_supplier_invoice"
        ordering = ("-invoice_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "supplier_tax_code", "invoice_series", "invoice_number"), name="uq_ap_invoice_identity"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0), name="ck_ap_invoice_rate_positive"),
            models.CheckConstraint(condition=Q(subtotal__gte=0, tax_amount__gte=0, total_amount__gte=0), name="ck_ap_invoice_amounts_nonnegative"),
        ]

    @property
    def adjusted_total_amount(self):
        value = self.total_amount
        for child in self.related_invoices.filter(invoice_type="ADJUSTMENT", validation_status="VALID"):
            value += child.total_amount if child.adjustment_effect == "INCREASE" else -child.total_amount
        return value


class SupplierInvoiceLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, null=True, blank=True)
    description = models.CharField(max_length=500)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=4, default=1)
    tracks_quantity = models.BooleanField(default=True)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    taxable_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate_percent = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    purchase_order_line = models.ForeignKey("purchases.PurchaseOrderLine", on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines")
    receipt_line = models.ForeignKey("purchases.PurchaseReceiptLine", on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines")

    class Meta:
        db_table = "ap_supplier_invoice_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("invoice", "line_no"), name="uq_ap_invoice_line_no"),
            models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, tax_amount__gte=0), name="ck_ap_invoice_line_values"),
        ]


class ApprovalDecision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="ap_approval_decisions")
    document_type = models.CharField(max_length=30, choices=(("INVOICE", "Hóa đơn"), ("PAYMENT_REQUEST", "Đề nghị thanh toán"), ("DOCUMENT", "Chứng từ công nợ")))
    document_id = models.UUIDField()
    level = models.PositiveSmallIntegerField(default=1)
    decision = models.CharField(max_length=20, choices=(("SUBMITTED", "Gửi duyệt"), ("APPROVED", "Phê duyệt"), ("REJECTED", "Từ chối")))
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ap_approval_decisions")
    comment = models.CharField(max_length=1000, blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ap_approval_decision"
        ordering = ("decided_at",)
        indexes = [models.Index(fields=("document_type", "document_id"), name="ix_ap_approval_document")]


class PayableDocumentSourceType(models.TextChoices):
    PURCHASE = "PURCHASE", "Chứng từ mua hàng"
    OTHER = "OTHER", "Khoản phải trả khác"


class PayableDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="payable_documents")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True)
    number = models.CharField(max_length=80)
    document_date = models.DateField()
    posting_date = models.DateField()
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="payable_documents")
    source_type = models.CharField(max_length=20, choices=PayableDocumentSourceType.choices, default=PayableDocumentSourceType.OTHER)
    source_document_type = models.CharField(max_length=50, blank=True, default="")
    source_document_id = models.CharField(max_length=100, blank=True, default="")
    source_document_number = models.CharField(max_length=100, blank=True, default="")
    due_date = models.DateField()
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True, related_name="payable_documents")
    payable_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="payable_documents_credit")
    tax_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="payable_documents_tax")
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.PROTECT, null=True, blank=True, related_name="payable_documents")
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    subtotal = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    description = models.CharField(max_length=500, blank=True, default="")
    attachments = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=30, choices=DocumentStatus.choices, default=DocumentStatus.DRAFT)
    approval_required = models.BooleanField(default=True)
    workflow_snapshot = models.JSONField(default=dict, blank=True)
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="ap_payable_document")
    posting_reference = models.CharField(max_length=120, blank=True, default="")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="payable_documents_created")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True, default="")
    rejection_reason = models.CharField(max_length=500, blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ap_payable_document"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_ap_document_number"),
            models.CheckConstraint(condition=Q(subtotal__gte=0, tax_amount__gte=0, total_amount__gt=0, exchange_rate__gt=0), name="ck_ap_document_amounts"),
            models.CheckConstraint(condition=Q(due_date__gte=models.F("document_date")), name="ck_ap_document_due_date"),
        ]


class PayableDocumentLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(PayableDocument, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    description = models.CharField(max_length=500)
    debit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="payable_lines_debit")
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_rate_percent = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    cost_center = models.ForeignKey("master_data.CostCenter", on_delete=models.PROTECT, null=True, blank=True)
    expense_item = models.ForeignKey("master_data.ExpenseItem", on_delete=models.PROTECT, null=True, blank=True)
    statistical_code = models.ForeignKey("master_data.StatisticalCode", on_delete=models.PROTECT, null=True, blank=True)

    class Meta:
        db_table = "ap_payable_document_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("document", "line_no"), name="uq_ap_document_line_no"),
            models.CheckConstraint(condition=Q(amount__gt=0, tax_amount__gte=0, total_amount__gt=0), name="ck_ap_document_line_values"),
        ]


class Payable(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="payables")
    document = models.OneToOneField(PayableDocument, on_delete=models.PROTECT, related_name="payable", null=True, blank=True)
    invoice = models.OneToOneField(SupplierInvoice, on_delete=models.PROTECT, related_name="payable", null=True, blank=True)
    goods_purchase = models.OneToOneField("purchases.GoodsPurchase", on_delete=models.PROTECT, related_name="payable", null=True, blank=True)
    purchase_cost = models.OneToOneField("purchases.PurchaseCost", on_delete=models.PROTECT, related_name="payable", null=True, blank=True)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8)
    original_amount = models.DecimalField(max_digits=20, decimal_places=4)
    paid_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    netted_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    adjustment_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    balance = models.DecimalField(max_digits=20, decimal_places=4)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=PayableStatus.choices, default=PayableStatus.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ap_payable"
        ordering = ("due_date", "created_at")
        constraints = [
            models.CheckConstraint(condition=Q(original_amount__gte=0, paid_amount__gte=0, netted_amount__gte=0, balance__gte=0), name="ck_ap_payable_amounts"),
            models.CheckConstraint(condition=(
                Q(invoice__isnull=False, goods_purchase__isnull=True, purchase_cost__isnull=True, document__isnull=True) |
                Q(invoice__isnull=True, goods_purchase__isnull=False, purchase_cost__isnull=True, document__isnull=True) |
                Q(invoice__isnull=True, goods_purchase__isnull=True, purchase_cost__isnull=False, document__isnull=True) |
                Q(invoice__isnull=True, goods_purchase__isnull=True, purchase_cost__isnull=True, document__isnull=False)
            ), name="ck_ap_payable_one_source"),
        ]

    @property
    def is_overdue(self):
        from django.utils import timezone
        if self.balance <= 0 or self.status in {PayableStatus.PAID, PayableStatus.REVERSED, PayableStatus.CANCELLED}:
            return False
        return bool(self.due_date and self.due_date < timezone.localdate())


class PaymentRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True)
    number = models.CharField(max_length=80)
    request_type = models.CharField(max_length=30, choices=PaymentRequestType.choices, default=PaymentRequestType.DEBT_PAYMENT)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="payment_requests")
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    requested_date = models.DateField()
    planned_payment_date = models.DateField()
    payment_method = models.CharField(max_length=30, choices=PaymentRequestMethod.choices)

    # Chi tiết phương thức thanh toán
    cash_fund = models.ForeignKey("cash_management.CashFund", on_delete=models.PROTECT, null=True, blank=True, related_name="payment_requests")
    company_bank_account = models.ForeignKey("master_data.CompanyBankAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="payment_requests")
    beneficiary_name = models.CharField(max_length=255, default="", blank=True)
    beneficiary_account_number = models.CharField(max_length=50, default="", blank=True)
    beneficiary_bank_name = models.CharField(max_length=255, default="", blank=True)
    beneficiary_account = models.ForeignKey("master_data.PartyBankAccount", on_delete=models.PROTECT, null=True, blank=True)

    # Nội dung & người phê duyệt
    payment_content = models.CharField(max_length=500, default="", blank=True)
    notes = models.CharField(max_length=1000, default="", blank=True)
    description = models.CharField(max_length=500, default="", blank=True)
    approver = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="payment_requests_to_approve")
    attachments = models.JSONField(default=list, blank=True)

    # Tổng tiền & trạng thái
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    paid_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    status = models.CharField(max_length=30, choices=PaymentRequestStatus.choices, default=PaymentRequestStatus.DRAFT)
    approval_required = models.BooleanField(default=True)
    workflow_snapshot = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="payment_requests_created")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, default="", blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=500, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ap_payment_request"
        ordering = ("-requested_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_ap_payment_request_number"),
            models.CheckConstraint(condition=Q(planned_payment_date__gte=models.F("requested_date")), name="ck_ap_payment_request_dates"),
            models.CheckConstraint(condition=Q(total_amount__gte=0), name="ck_ap_payment_request_total_amount"),
        ]


class PaymentRequestLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(PaymentRequest, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField(default=1)
    payable = models.ForeignKey(Payable, on_delete=models.PROTECT, null=True, blank=True, related_name="payment_request_lines")
    purchase_order = models.ForeignKey("purchases.PurchaseOrder", on_delete=models.PROTECT, null=True, blank=True, related_name="payment_request_lines")
    purchase_contract = models.ForeignKey("purchases.PurchaseContract", on_delete=models.PROTECT, null=True, blank=True, related_name="payment_request_lines")
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    paid_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    note = models.CharField(max_length=500, default="", blank=True)

    class Meta:
        db_table = "ap_payment_request_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("request", "payable"), condition=Q(payable__isnull=False), name="uq_ap_payment_request_payable"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_ap_payment_request_amount"),
        ]


class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="payable_payments")
    number = models.CharField(max_length=80, blank=True, default="", db_index=True)
    payment_source = models.CharField(max_length=30, choices=PaymentSource.choices, default=PaymentSource.PAYMENT_REQUEST)
    payment_request = models.ForeignKey(PaymentRequest, on_delete=models.PROTECT, null=True, blank=True, related_name="payments")
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    payment_date = models.DateField()
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    allocated_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    payment_method = models.CharField(max_length=30, choices=PaymentRequestMethod.choices, default=PaymentRequestMethod.BANK_TRANSFER)
    payment_content = models.CharField(max_length=500, blank=True, default="")
    recipient_name = models.CharField(max_length=255, blank=True, default="")
    company_bank_account = models.ForeignKey("master_data.CompanyBankAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="payable_payments")
    cash_fund = models.ForeignKey("cash_management.CashFund", on_delete=models.PROTECT, null=True, blank=True, related_name="payable_payments")
    beneficiary_name = models.CharField(max_length=255, blank=True, default="")
    beneficiary_account_number = models.CharField(max_length=50, blank=True, default="")
    beneficiary_bank_name = models.CharField(max_length=255, blank=True, default="")
    bank_transaction_code = models.CharField(max_length=100, blank=True, default="")
    external_type = models.CharField(max_length=20, choices=PaymentMethod.choices, blank=True, default=PaymentMethod.OTHER)
    external_reference = models.CharField(max_length=120, blank=True, default="")
    payment_method_config = models.ForeignKey("master_data.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True, related_name="payable_payments")
    payment_method_snapshot = models.JSONField(default=dict, blank=True)
    journal_entry = models.ForeignKey("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="payable_payments")
    reversal_journal_entry = models.ForeignKey("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="reversed_payable_payments")
    attachments = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.DRAFT)
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="posted_payable_payments")
    canceled_at = models.DateTimeField(null=True, blank=True)
    canceled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="canceled_payable_payments")
    cancellation_reason = models.TextField(blank=True, default="")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ap_payment"
        ordering = ("-payment_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "external_type", "external_reference"), condition=Q(external_reference__gt=""), name="uq_ap_payment_external"),
            models.UniqueConstraint(fields=("company", "number"), condition=Q(number__gt=""), name="uq_ap_payment_number"),
            models.CheckConstraint(condition=Q(amount__gt=0, allocated_amount__gte=0), name="ck_ap_payment_amounts"),
        ]


class PaymentAllocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="allocations")
    payable = models.ForeignKey(Payable, on_delete=models.PROTECT, related_name="allocations")
    payment_request_line = models.ForeignKey(PaymentRequestLine, on_delete=models.PROTECT, null=True, blank=True, related_name="allocations")
    line_no = models.PositiveIntegerField(default=1)
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    note = models.CharField(max_length=500, default="", blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ap_payment_allocation"
        ordering = ("line_no",)
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0, exchange_rate__gt=0), name="ck_ap_allocation_values"),
        ]


class AllocationStatus(models.TextChoices):
    ALLOCATED = "ALLOCATED", "Đã phân bổ"
    REVERSED = "REVERSED", "Đã đảo phân bổ"


class PaymentAllocationCounter(models.Model):
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ap_payment_allocation_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_ap_allocation_counter")]


class PaymentAllocationVoucher(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=30)
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="allocation_vouchers")
    allocation_date = models.DateField()
    description = models.CharField(max_length=500)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4)
    status = models.CharField(max_length=20, choices=AllocationStatus.choices, default=AllocationStatus.ALLOCATED)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ap_allocations_created")
    created_at = models.DateTimeField(auto_now_add=True)
    reversed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ap_allocations_reversed")
    reversed_at = models.DateTimeField(null=True, blank=True)
    reversal_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "ap_payment_allocation_voucher"
        ordering = ("-allocation_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_ap_allocation_voucher_number"),
            models.CheckConstraint(condition=Q(total_amount__gt=0), name="ck_ap_allocation_voucher_amount"),
        ]


class PaymentAllocationVoucherLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voucher = models.ForeignKey(PaymentAllocationVoucher, on_delete=models.PROTECT, related_name="lines")
    payable = models.ForeignKey(Payable, on_delete=models.PROTECT)
    line_no = models.PositiveIntegerField()
    amount = models.DecimalField(max_digits=20, decimal_places=4)

    class Meta:
        db_table = "ap_payment_allocation_voucher_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("voucher", "payable"), name="uq_ap_allocation_voucher_payable"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_ap_allocation_voucher_line_amount"),
        ]


class Netting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=80)
    payable = models.ForeignKey(Payable, on_delete=models.PROTECT, related_name="nettings")
    counterparty_reference = models.CharField(max_length=150)
    netting_date = models.DateField()
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    reason = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=PostingStatus.choices, default=PostingStatus.DRAFT)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ap_netting"
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_ap_netting_number"), models.CheckConstraint(condition=Q(amount__gt=0), name="ck_ap_netting_amount")]


class DebtOffsetCounter(models.Model):
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ap_debt_offset_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_ap_offset_counter")]


class DebtOffsetVoucher(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=30)
    partner = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    offset_date = models.DateField()
    basis = models.CharField(max_length=255)
    description = models.CharField(max_length=500)
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    attachments = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=(("POSTED", "Đã ghi sổ"), ("CANCELLED", "Đã hủy")), default="POSTED")
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, related_name="ap_offset_voucher")
    reversal_journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="ap_offset_reversal")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ap_offsets_created")
    created_at = models.DateTimeField(auto_now_add=True)
    cancelled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ap_offsets_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "ap_debt_offset_voucher"
        ordering = ("-offset_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_ap_offset_voucher_number"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_ap_offset_voucher_amount"),
        ]


class DebtOffsetPayableLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voucher = models.ForeignKey(DebtOffsetVoucher, on_delete=models.PROTECT, related_name="payable_lines")
    payable = models.ForeignKey(Payable, on_delete=models.PROTECT, related_name="offset_payable_lines")
    line_no = models.PositiveIntegerField()
    amount = models.DecimalField(max_digits=20, decimal_places=4)

    class Meta:
        db_table = "ap_debt_offset_payable_line"
        constraints = [models.UniqueConstraint(fields=("voucher", "payable"), name="uq_ap_offset_payable_line"),
                       models.CheckConstraint(condition=Q(amount__gt=0), name="ck_ap_offset_payable_amount")]


class DebtOffsetReceivableLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voucher = models.ForeignKey(DebtOffsetVoucher, on_delete=models.PROTECT, related_name="receivable_lines")
    receivable = models.ForeignKey("accounts_receivable.Receivable", on_delete=models.PROTECT)
    line_no = models.PositiveIntegerField()
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    schedule_allocations = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "ap_debt_offset_receivable_line"
        constraints = [models.UniqueConstraint(fields=("voucher", "receivable"), name="uq_ap_offset_receivable_line"),
                       models.CheckConstraint(condition=Q(amount__gt=0), name="ck_ap_offset_receivable_amount")]


class PayableAdjustment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    payable = models.ForeignKey(Payable, on_delete=models.PROTECT, related_name="adjustments")
    adjustment_date = models.DateField()
    amount = models.DecimalField(max_digits=20, decimal_places=4, help_text="Dương: tăng nợ; âm: giảm nợ")
    reason = models.CharField(max_length=500)
    posting_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=PostingStatus.choices, default=PostingStatus.DRAFT)
    reverses = models.OneToOneField("self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversal")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ap_payable_adjustment"
        constraints = [models.CheckConstraint(condition=~Q(amount=0), name="ck_ap_adjustment_nonzero")]


class PayableAdjustmentCounter(models.Model):
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ap_payable_adjustment_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_ap_adjustment_counter")]


class PayableAdjustmentVoucher(models.Model):
    class Kind(models.TextChoices):
        INCREASE = "INCREASE", "Điều chỉnh tăng"
        DECREASE = "DECREASE", "Điều chỉnh giảm"

    class Reason(models.TextChoices):
        RECONCILIATION = "RECONCILIATION", "Chênh lệch đối chiếu"
        OPENING_BALANCE = "OPENING_BALANCE", "Điều chỉnh số dư đầu kỳ"
        ROUNDING = "ROUNDING", "Chênh lệch làm tròn"
        OTHER = "OTHER", "Lý do khác"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=30)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    payable = models.ForeignKey(Payable, on_delete=models.PROTECT, related_name="adjustment_vouchers")
    adjustment_date = models.DateField()
    kind = models.CharField(max_length=10, choices=Kind.choices)
    reason = models.CharField(max_length=30, choices=Reason.choices)
    reason_detail = models.CharField(max_length=500, blank=True, default="")
    basis = models.CharField(max_length=255)
    description = models.CharField(max_length=500)
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    counter_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT)
    attachments = models.JSONField(default=list, blank=True)
    balance_before = models.DecimalField(max_digits=20, decimal_places=4)
    balance_after = models.DecimalField(max_digits=20, decimal_places=4)
    status = models.CharField(max_length=20, choices=(("POSTED", "Đã ghi sổ"), ("CANCELLED", "Đã hủy")), default="POSTED")
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, related_name="ap_payable_adjustment_voucher")
    reversal_journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="ap_payable_adjustment_reversal")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ap_adjustment_vouchers_created")
    created_at = models.DateTimeField(auto_now_add=True)
    cancelled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ap_adjustment_vouchers_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "ap_payable_adjustment_voucher"
        ordering = ("-adjustment_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_ap_adjustment_voucher_number"),
            models.CheckConstraint(condition=Q(amount__gt=0, balance_before__gte=0, balance_after__gte=0), name="ck_ap_adjustment_voucher_values"),
        ]


class SupplierReconciliationCounter(models.Model):
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ap_supplier_reconciliation_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_ap_reconciliation_counter")]


class SupplierReconciliation(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Chờ nhà cung cấp xác nhận"
        MATCHED = "MATCHED", "Khớp"
        DIFFERENT = "DIFFERENT", "Có chênh lệch"
        CANCELLED = "CANCELLED", "Đã hủy"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=35)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    period_start = models.DateField()
    period_end = models.DateField()
    content = models.CharField(max_length=500)
    opening_balance = models.DecimalField(max_digits=24, decimal_places=4)
    period_increase = models.DecimalField(max_digits=24, decimal_places=4)
    period_decrease = models.DecimalField(max_digits=24, decimal_places=4)
    closing_balance = models.DecimalField(max_digits=24, decimal_places=4)
    snapshot = models.JSONField(default=dict)
    snapshot_token = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    confirmation_date = models.DateField(null=True, blank=True)
    confirmed_by_name = models.CharField(max_length=255, blank=True, default="")
    supplier_balance = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    difference = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    confirmation_attachments = models.JSONField(default=list, blank=True)
    difference_reason = models.CharField(max_length=500, blank=True, default="")
    resolution = models.CharField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ap_reconciliations_created")
    created_at = models.DateTimeField(auto_now_add=True)
    completed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ap_reconciliations_completed")
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ap_reconciliations_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "ap_supplier_reconciliation"
        ordering = ("-period_end", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_ap_reconciliation_number"),
            models.CheckConstraint(condition=Q(period_end__gte=models.F("period_start")), name="ck_ap_reconciliation_period"),
        ]
