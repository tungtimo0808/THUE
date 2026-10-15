import uuid
from django.db import models
from django.db.models import Q
from django.utils import timezone


class DocumentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ phê duyệt"
    APPROVED = "APPROVED", "Đã phê duyệt"
    REJECTED = "REJECTED", "Bị từ chối"
    REVISION_REQUIRED = "REVISION_REQUIRED", "Yêu cầu chỉnh sửa"
    SENT = "SENT", "Đã gửi khách hàng"
    ACCEPTED = "ACCEPTED", "Khách hàng chấp nhận"
    EXPIRED = "EXPIRED", "Hết hạn"
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED", "Đã giao một phần"
    FULLY_DELIVERED = "FULLY_DELIVERED", "Đã giao đủ"
    COMPLETED = "COMPLETED", "Hoàn tất"
    CLOSED = "CLOSED", "Đã đóng"
    CANCELLED = "CANCELLED", "Đã hủy"
    TERMINATED = "TERMINATED", "Đã chấm dứt"
    ISSUED = "ISSUED", "Đã phát hành"
    DECLINED = "DECLINED", "Khách hàng từ chối"
    ORDERED = "ORDERED", "Đã chuyển đơn hàng"
    POSTED = "POSTED", "Đã ghi sổ"
    SIGNED = "SIGNED", "Đã ký"
    LIQUIDATED = "LIQUIDATED", "Đã thanh lý"


class DeliveryStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    CONFIRMED = "CONFIRMED", "Đã xác nhận"
    CANCELLED = "CANCELLED", "Đã hủy"


class InvoiceRequestStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    SUBMITTED = "SUBMITTED", "Đã gửi xử lý"
    PROCESSED = "PROCESSED", "Đã xử lý"
    CANCELLED = "CANCELLED", "Đã hủy"


class SalesDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True)
    number = models.CharField(max_length=80)
    document_date = models.DateField()
    customer = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    subtotal = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    fee_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    status = models.CharField(max_length=30, choices=DocumentStatus.choices, default=DocumentStatus.DRAFT)
    approval_required = models.BooleanField(default=True)
    workflow_snapshot = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="%(class)s_created")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SalesQuotation(SalesDocument):
    title = models.CharField(max_length=255, blank=True, default="")
    payment_terms_text = models.CharField(max_length=500, blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    original_quotation = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="versions")
    response_date = models.DateField(null=True, blank=True)
    response_content = models.TextField(blank=True, default="")
    sent_at = models.DateTimeField(null=True, blank=True)
    pdf_content = models.BinaryField(null=True, blank=True, editable=False)
    valid_until = models.DateField()
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True)
    payment_method_config = models.ForeignKey("master_data.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_quotations")
    payment_method_snapshot = models.JSONField(default=dict, blank=True)
    delivery_terms = models.CharField(max_length=500, blank=True)
    sent_versions = models.JSONField(default=list, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    withdrawal_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_quotation"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_quotation_number"),
            models.UniqueConstraint(fields=("original_quotation", "version"), condition=Q(original_quotation__isnull=False), name="uq_sal_quotation_version"),
            models.CheckConstraint(condition=Q(valid_until__gte=models.F("document_date")), name="ck_sal_quotation_dates"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0, total_amount__gte=0), name="ck_sal_quotation_amounts"),
        ]


class SalesQuotationCounter(models.Model):
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_quotation_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_quotation_counter")]


class SalesQuotationSettings(models.Model):
    company = models.OneToOneField("organization.Company", on_delete=models.CASCADE, related_name="sales_quotation_settings")
    validity_days = models.PositiveIntegerField(default=15)

    class Meta:
        db_table = "sal_quotation_settings"
        constraints = [models.CheckConstraint(condition=Q(validity_days__gte=1, validity_days__lte=365), name="ck_sal_quotation_validity_days")]


class SalesQuotationLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quotation = models.ForeignKey(SalesQuotation, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.DecimalField(max_digits=22, decimal_places=6, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    ordered_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    class Meta:
        db_table = "sal_quotation_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("quotation", "line_no"), name="uq_sal_quotation_line"),
            models.CheckConstraint(condition=(Q(quantity__isnull=True) | Q(quantity__gt=0)) &
                                   (Q(unit_price__isnull=True) | Q(unit_price__gte=0)) &
                                   Q(ordered_quantity__gte=0), name="ck_sal_quotation_line_values"),
            models.CheckConstraint(condition=Q(discount_rate__gte=0, discount_rate__lte=100), name="ck_sal_quotation_discount"),
        ]


class SalesContractCounter(models.Model):
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_contract_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_contract_counter")]


class AnnexStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ phê duyệt"
    REVISION_REQUIRED = "REVISION_REQUIRED", "Yêu cầu chỉnh sửa"
    REJECTED = "REJECTED", "Bị từ chối"
    APPROVED = "APPROVED", "Đã phê duyệt"
    SIGNED = "SIGNED", "Đã ký"
    CANCELLED = "CANCELLED", "Đã hủy"


class ContractValueType(models.TextChoices):
    FIXED = "FIXED", "Giá trị cố định"
    LIMIT = "LIMIT", "Hạn mức hợp đồng"


class SalesContract(SalesDocument):
    contract_number = models.CharField(max_length=100, blank=True, default="")
    title = models.CharField(max_length=255, blank=True, default="")
    customer_representative = models.CharField(max_length=255, blank=True, default="")
    customer_representative_position = models.CharField(max_length=255, blank=True, default="")
    company_signer = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="signed_sales_contracts")
    company_signer_name = models.CharField(max_length=255, blank=True, default="")
    company_signer_position = models.CharField(max_length=255, blank=True, default="")
    assigned_employee = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="managed_sales_contracts")
    quotation = models.ForeignKey("sales.SalesQuotation", on_delete=models.PROTECT, null=True, blank=True, related_name="contracts")
    value_type = models.CharField(max_length=20, choices=ContractValueType.choices, default=ContractValueType.FIXED)
    contract_limit = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    payment_terms_text = models.TextField(blank=True, default="")
    signed_date = models.DateField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    maximum_value = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True)
    payment_method_config = models.ForeignKey("master_data.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_contracts")
    payment_method_snapshot = models.JSONField(default=dict, blank=True)
    delivery_terms = models.CharField(max_length=500, blank=True, default="")
    signed_file = models.JSONField(default=dict, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    cancellation_reason = models.CharField(max_length=500, blank=True, default="")
    termination_reason = models.CharField(max_length=500, blank=True, default="")
    terminated_at = models.DateTimeField(null=True, blank=True)
    liquidation_reason = models.CharField(max_length=500, blank=True, default="")
    liquidated_at = models.DateTimeField(null=True, blank=True)
    liquidation_file = models.JSONField(default=dict, blank=True)
    open_settlement_notes = models.TextField(blank=True, default="")
    withdrawal_reason = models.CharField(max_length=500, blank=True, default="")
    rejection_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "sal_contract"
        ordering = ("-document_date", "number")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_contract_number"),
            models.CheckConstraint(condition=Q(end_date__gte=models.F("start_date")), name="ck_sal_contract_dates"),
            models.CheckConstraint(condition=Q(maximum_value__isnull=True) | Q(maximum_value__gte=0), name="ck_sal_contract_limit"),
        ]

    def save(self, *args, **kwargs):
        if self.contract_limit is not None and self.maximum_value is None:
            self.maximum_value = self.contract_limit
        elif self.maximum_value is not None and self.contract_limit is None:
            self.contract_limit = self.maximum_value
        super().save(*args, **kwargs)


class SalesContractLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(SalesContract, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True, default="")
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=22, decimal_places=6, null=True, blank=True)
    maximum_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    expected_delivery_date = models.DateField(null=True, blank=True)
    quotation_line = models.ForeignKey("sales.SalesQuotationLine", on_delete=models.PROTECT, null=True, blank=True, related_name="contract_lines")

    class Meta:
        db_table = "sal_contract_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("contract", "line_no"), name="uq_sal_contract_line"),
            models.CheckConstraint(condition=Q(maximum_quantity__isnull=True) | Q(maximum_quantity__gt=0), name="ck_sal_contract_qty"),
            models.CheckConstraint(condition=Q(unit_price__isnull=True) | Q(unit_price__gte=0), name="ck_sal_contract_price"),
        ]

    def save(self, *args, **kwargs):
        if self.quantity is not None and self.maximum_quantity is None:
            self.maximum_quantity = self.quantity
        elif self.maximum_quantity is not None and self.quantity is None:
            self.quantity = self.maximum_quantity
        super().save(*args, **kwargs)


class SalesContractAnnex(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(SalesContract, on_delete=models.CASCADE, related_name="annexes")
    annex_number = models.CharField(max_length=100)
    annex_date = models.DateField(null=True, blank=True)
    effective_date = models.DateField(null=True, blank=True)
    change_content = models.TextField()
    status = models.CharField(max_length=30, choices=AnnexStatus.choices, default=AnnexStatus.DRAFT)
    signed_file = models.JSONField(default=dict, blank=True)
    new_end_date = models.DateField(null=True, blank=True)
    new_contract_limit = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    line_adjustments = models.JSONField(default=list, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="contract_annexes_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sal_contract_annex"
        ordering = ("annex_number", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("contract", "annex_number"), name="uq_sal_contract_annex_number"),
        ]


class SalesOrderCounter(models.Model):
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_order_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_order_counter")]


class SalesOrder(SalesDocument):
    quotation = models.OneToOneField(SalesQuotation, on_delete=models.PROTECT, null=True, blank=True, related_name="converted_order")
    contract = models.ForeignKey(SalesContract, on_delete=models.PROTECT, null=True, blank=True, related_name="orders")
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True)
    payment_method_config = models.ForeignKey("master_data.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_orders")
    payment_method_snapshot = models.JSONField(default=dict, blank=True)
    requested_delivery_date = models.DateField(null=True, blank=True)
    delivery_address = models.CharField(max_length=500, blank=True)
    customer_address = models.CharField(max_length=500, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    contact_phone = models.CharField(max_length=50, blank=True)
    contact_email = models.EmailField(blank=True)
    assigned_employee = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_orders")
    default_warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_orders")
    attachments = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    withdrawal_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    invoicing_policy = models.CharField(max_length=20, choices=(("ORDER", "Theo đơn hàng"), ("DELIVERY", "Theo giao hàng")), default="ORDER")
    credit_check = models.JSONField(default=dict, blank=True)
    inventory_check = models.JSONField(default=dict, blank=True)
    invoiced_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    collected_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="closed_sales_orders")
    close_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_order"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_order_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0, total_amount__gte=0, invoiced_amount__gte=0, collected_amount__gte=0), name="ck_sal_order_amounts"),
        ]


class SalesOrderLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=22, decimal_places=6)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_group = models.CharField(max_length=50, blank=True, default="")
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    quotation_line = models.ForeignKey(SalesQuotationLine, on_delete=models.PROTECT, null=True, blank=True, related_name="order_lines")
    contract_line = models.ForeignKey(SalesContractLine, on_delete=models.PROTECT, null=True, blank=True, related_name="order_lines")
    delivered_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    invoiced_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    cancelled_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    closed_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    class Meta:
        db_table = "sal_order_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("order", "line_no"), name="uq_sal_order_line"),
            models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, delivered_quantity__gte=0, invoiced_quantity__gte=0, cancelled_quantity__gte=0), name="ck_sal_order_line_values"),
            models.CheckConstraint(condition=Q(discount_rate__gte=0, discount_rate__lte=100), name="ck_sal_order_discount"),
        ]

    @property
    def remaining_quantity(self):
        closed = self.closed_quantity if self.closed_quantity > 0 else self.cancelled_quantity
        return self.quantity - self.delivered_quantity - closed


class SalesDelivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, related_name="deliveries")
    number = models.CharField(max_length=80)
    delivery_date = models.DateField()
    delivery_type = models.CharField(max_length=20, choices=(("GOODS", "Hàng hóa"), ("SERVICE", "Dịch vụ")))
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    delivery_address = models.CharField(max_length=500, blank=True)
    inventory_reference = models.CharField(max_length=120, blank=True)
    acceptance_reference = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=DeliveryStatus.choices, default=DeliveryStatus.DRAFT)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="sales_deliveries_created")
    confirmed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_deliveries_confirmed")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sal_delivery"
        ordering = ("-delivery_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_sal_delivery_number")]


class SalesDeliveryLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    delivery = models.ForeignKey(SalesDelivery, on_delete=models.CASCADE, related_name="lines")
    order_line = models.ForeignKey(SalesOrderLine, on_delete=models.PROTECT, related_name="delivery_lines")
    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    completion_percent = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    accepted_value = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    note = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_delivery_line"
        constraints = [
            models.UniqueConstraint(fields=("delivery", "order_line"), name="uq_sal_delivery_order_line"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_sal_delivery_qty"),
            models.CheckConstraint(condition=Q(completion_percent__isnull=True) | Q(completion_percent__gt=0, completion_percent__lte=100), name="ck_sal_delivery_percent"),
        ]


class InvoiceRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=80)
    order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, related_name="invoice_requests")
    customer = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    request_date = models.DateField()
    buyer_name = models.CharField(max_length=255)
    buyer_tax_code = models.CharField(max_length=30, blank=True)
    buyer_address = models.CharField(max_length=500, blank=True)
    buyer_email = models.EmailField(blank=True)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    status = models.CharField(max_length=20, choices=InvoiceRequestStatus.choices, default=InvoiceRequestStatus.DRAFT)
    external_reference = models.CharField(max_length=120, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sal_invoice_request"
        ordering = ("-request_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_sal_invoice_request_number")]


class InvoiceRequestLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(InvoiceRequest, on_delete=models.CASCADE, related_name="lines")
    order_line = models.ForeignKey(SalesOrderLine, on_delete=models.PROTECT, related_name="invoice_request_lines")
    delivery_line = models.ForeignKey(SalesDeliveryLine, on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_request_lines")
    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    class Meta:
        db_table = "sal_invoice_request_line"
        constraints = [
            models.UniqueConstraint(fields=("request", "order_line", "delivery_line"), name="uq_sal_invoice_request_source"),
            models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, tax_amount__gte=0), name="ck_sal_invoice_request_values"),
        ]


class ApprovalDecision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="sales_approval_decisions")
    document_type = models.CharField(
        max_length=20,
        choices=(
            ("QUOTATION", "Báo giá"),
            ("ORDER", "Đơn bán"),
            ("CONTRACT", "Hợp đồng"),
            ("GOODS_SALE", "Bán hàng hóa"),
            ("SERVICE_SALE", "Bán dịch vụ"),
            ("SALES_RETURN", "Hàng bán trả lại"),
            ("SALES_ALLOWANCE", "Giảm giá hàng bán"),
            ("SALES_INVOICE", "Hóa đơn đầu ra"),
            ("COGS", "Giá vốn hàng bán"),
            ("DISCOUNT_INVOICE", "Hóa đơn chiết khấu"),
            ("COMMERCIAL_INVOICE", "Hóa đơn thương mại"),
        ),
    )
    document_id = models.UUIDField()
    document_version = models.PositiveIntegerField(default=1)
    workflow_version = models.CharField(max_length=50, blank=True, default="")
    level = models.PositiveSmallIntegerField(default=1)
    decision = models.CharField(max_length=20, choices=(("SUBMITTED", "Đã gửi"), ("APPROVED", "Phê duyệt"), ("REJECTED", "Từ chối"), ("REVISION_REQUIRED", "Yêu cầu chỉnh sửa"), ("WITHDRAWN", "Thu hồi")))
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="sales_approval_decisions")
    comment = models.CharField(max_length=1000, blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sal_approval_decision"
        ordering = ("decided_at",)
        indexes = [models.Index(fields=("document_type", "document_id"), name="ix_sal_approval_document")]


class GoodsSaleCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_goods_sale_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_goods_sale_counter")]


class GoodsSale(SalesDocument):
    class PaymentType(models.TextChoices):
        UNPAID = "UNPAID", "Chưa thu tiền"
        CASH = "CASH", "Thu tiền mặt"
        BANK = "BANK", "Thu qua ngân hàng"

    class InventoryHandling(models.TextChoices):
        ATTACH_ISSUE = "ATTACH_ISSUE", "Lập phiếu xuất kho kèm theo"
        LINK_EXISTING = "LINK_EXISTING", "Liên kết phiếu xuất kho đã có"
        NO_INVENTORY = "NO_INVENTORY", "Không quản lý kho"

    posting_date = models.DateField()
    customer_address = models.CharField(max_length=500, blank=True)
    customer_tax_code = models.CharField(max_length=50, blank=True)
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sales")
    payment_type = models.CharField(max_length=20, choices=PaymentType.choices, default=PaymentType.UNPAID)
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    company_bank_account = models.ForeignKey("master_data.CompanyBankAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sales")
    inventory_handling = models.CharField(max_length=20, choices=InventoryHandling.choices, default=InventoryHandling.ATTACH_ISSUE)
    inventory_transaction = models.ForeignKey("inventory.InventoryTransaction", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sales")
    inventory_created = models.BooleanField(default=False)
    delivery = models.ForeignKey(SalesDelivery, on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sales")
    tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sales")
    invoice_link_notes = models.CharField(max_length=255, blank=True)
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale")
    receivable = models.OneToOneField("accounts_receivable.Receivable", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale")
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sales_posted")
    version = models.PositiveIntegerField(default=1)
    attachments = models.JSONField(default=list, blank=True)
    description = models.CharField(max_length=500, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    withdrawal_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_goods_sale"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_goods_sale_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0, total_amount__gte=0), name="ck_sal_goods_sale_amounts"),
        ]


class GoodsSaleLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale = models.ForeignKey(GoodsSale, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.DecimalField(max_digits=22, decimal_places=6)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    
    # GL Accounts
    receivable_or_payment_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale_receivable_lines")
    revenue_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale_revenue_lines")
    tax_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale_tax_lines")
    cogs_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale_cogs_lines")
    inventory_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale_inv_lines")
    
    # Cost of goods sold
    unit_cost = models.DecimalField(max_digits=26, decimal_places=10, default=0)
    cogs_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    # Source references
    order_line = models.ForeignKey(SalesOrderLine, on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale_lines")
    inventory_transaction_line = models.ForeignKey("inventory.InventoryTransactionLine", on_delete=models.PROTECT, null=True, blank=True, related_name="goods_sale_lines")

    class Meta:
        db_table = "sal_goods_sale_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("sale", "line_no"), name="uq_sal_goods_sale_line"),
            models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, discount_amount__gte=0, tax_amount__gte=0, line_total__gte=0), name="ck_sal_goods_sale_line_vals"),
            models.CheckConstraint(condition=Q(discount_rate__gte=0, discount_rate__lte=100), name="ck_sal_goods_sale_discount_rate"),
        ]


class ServiceSaleCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_service_sale_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_service_sale_counter")]


class ServiceSale(SalesDocument):
    class PaymentType(models.TextChoices):
        UNPAID = "UNPAID", "Chưa thu tiền"
        CASH = "CASH", "Thu tiền mặt"
        BANK = "BANK", "Thu qua ngân hàng"

    posting_date = models.DateField()
    customer_address = models.CharField(max_length=500, blank=True)
    customer_tax_code = models.CharField(max_length=50, blank=True)
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, null=True, blank=True, related_name="service_sales")
    payment_type = models.CharField(max_length=20, choices=PaymentType.choices, default=PaymentType.UNPAID)
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    company_bank_account = models.ForeignKey("master_data.CompanyBankAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="service_sales")
    service_acceptance_required = models.BooleanField(default=False)
    acceptance_document_number = models.CharField(max_length=100, blank=True)
    acceptance_date = models.DateField(null=True, blank=True)
    tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="service_sales")
    invoice_link_notes = models.CharField(max_length=255, blank=True)
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.SET_NULL, null=True, blank=True, related_name="service_sale")
    receivable = models.OneToOneField("accounts_receivable.Receivable", on_delete=models.SET_NULL, null=True, blank=True, related_name="service_sale")
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="service_sales_posted")
    version = models.PositiveIntegerField(default=1)
    attachments = models.JSONField(default=list, blank=True)
    description = models.CharField(max_length=500, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    withdrawal_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_service_sale"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_service_sale_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0, total_amount__gte=0), name="ck_sal_service_sale_amounts"),
        ]


class ServiceSaleLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale = models.ForeignKey(ServiceSale, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=22, decimal_places=6)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    service_from = models.DateField(null=True, blank=True)
    service_to = models.DateField(null=True, blank=True)
    
    # GL Accounts
    receivable_or_payment_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="service_sale_receivable_lines")
    revenue_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="service_sale_revenue_lines")
    tax_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="service_sale_tax_lines")

    # Source reference
    order_line = models.ForeignKey(SalesOrderLine, on_delete=models.PROTECT, null=True, blank=True, related_name="service_sale_lines")

    class Meta:
        db_table = "sal_service_sale_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("sale", "line_no"), name="uq_sal_service_sale_line"),
            models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, discount_amount__gte=0, tax_amount__gte=0, line_total__gte=0), name="ck_sal_service_sale_line_vals"),
            models.CheckConstraint(condition=Q(discount_rate__gte=0, discount_rate__lte=100), name="ck_sal_service_sale_discount_rate"),
        ]


class SalesReturnCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_sales_return_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_sales_return_counter")]


class SalesReturn(SalesDocument):
    class InventoryHandling(models.TextChoices):
        ATTACH_INWARD = "ATTACH_INWARD", "Lập phiếu nhập kho kèm theo"
        LINK_EXISTING = "LINK_EXISTING", "Liên kết phiếu nhập kho đã có"
        NO_INVENTORY = "NO_INVENTORY", "Không quản lý kho"

    posting_date = models.DateField()
    goods_sale = models.ForeignKey(GoodsSale, on_delete=models.PROTECT, related_name="sales_returns")
    return_reason = models.CharField(max_length=500)
    inventory_handling = models.CharField(max_length=20, choices=InventoryHandling.choices, default=InventoryHandling.ATTACH_INWARD)
    inventory_transaction = models.ForeignKey("inventory.InventoryTransaction", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_returns")
    inventory_created = models.BooleanField(default=False)
    original_tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_returns_original")
    tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_returns")
    invoice_link_notes = models.CharField(max_length=255, blank=True)
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.SET_NULL, null=True, blank=True, related_name="sales_return")
    refundable_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    refunded_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_returns_posted")
    version = models.PositiveIntegerField(default=1)
    attachments = models.JSONField(default=list, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    withdrawal_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_sales_return"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_sales_return_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0, total_amount__gte=0, refundable_amount__gte=0, refunded_amount__gte=0), name="ck_sal_sales_return_amounts"),
        ]


class SalesReturnLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale_return = models.ForeignKey(SalesReturn, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    goods_sale_line = models.ForeignKey(GoodsSaleLine, on_delete=models.PROTECT, related_name="return_lines")
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)

    # Quantities
    sold_quantity = models.DecimalField(max_digits=22, decimal_places=6)
    return_quantity = models.DecimalField(max_digits=22, decimal_places=6)

    # Financials
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    # Inventory & Cost
    unit_cost = models.DecimalField(max_digits=26, decimal_places=10, default=0)
    cogs_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    # GL Accounts
    revenue_deduction_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_return_rev_lines")
    tax_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_return_tax_lines")
    receivable_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_return_rec_lines")
    cogs_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_return_cogs_lines")
    inventory_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_return_inv_lines")

    class Meta:
        db_table = "sal_sales_return_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("sale_return", "line_no"), name="uq_sal_sales_return_line"),
            models.CheckConstraint(condition=Q(return_quantity__gt=0, unit_price__gte=0, discount_amount__gte=0, tax_amount__gte=0, line_total__gte=0), name="ck_sal_sales_return_line_vals"),
        ]


class SalesAllowanceCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_sales_allowance_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_sales_allowance_counter")]


class SalesAllowance(SalesDocument):
    posting_date = models.DateField()
    goods_sale = models.ForeignKey(GoodsSale, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_allowances")
    service_sale = models.ForeignKey(ServiceSale, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_allowances")
    allowance_reason = models.CharField(max_length=500)
    original_tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_allowances_original")
    tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_allowances")
    invoice_link_notes = models.CharField(max_length=255, blank=True)
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.SET_NULL, null=True, blank=True, related_name="sales_allowance")
    refundable_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    refunded_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_allowances_posted")
    version = models.PositiveIntegerField(default=1)
    attachments = models.JSONField(default=list, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    withdrawal_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_sales_allowance"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_sales_allowance_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0, total_amount__gte=0, refundable_amount__gte=0, refunded_amount__gte=0), name="ck_sal_sales_allowance_amounts"),
        ]


class SalesAllowanceLine(models.Model):
    class EntryMethod(models.TextChoices):
        BY_AMOUNT = "BY_AMOUNT", "Theo số tiền"
        BY_PERCENT = "BY_PERCENT", "Theo tỷ lệ"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    allowance = models.ForeignKey(SalesAllowance, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True)

    # Source line references
    goods_sale_line = models.ForeignKey(GoodsSaleLine, on_delete=models.PROTECT, null=True, blank=True, related_name="allowance_lines")
    service_sale_line = models.ForeignKey(ServiceSaleLine, on_delete=models.PROTECT, null=True, blank=True, related_name="allowance_lines")

    # Values for allowance calculation
    net_sales_value = models.DecimalField(max_digits=20, decimal_places=4)
    returned_value = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    already_reduced_value = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    remaining_value = models.DecimalField(max_digits=20, decimal_places=4)

    # Reduction input
    entry_method = models.CharField(max_length=20, choices=EntryMethod.choices, default=EntryMethod.BY_AMOUNT)
    allowance_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    allowance_amount = models.DecimalField(max_digits=20, decimal_places=4)

    # Taxes
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    # GL Accounts
    revenue_deduction_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_allowance_rev_lines")
    tax_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_allowance_tax_lines")
    receivable_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_allowance_rec_lines")

    class Meta:
        db_table = "sal_sales_allowance_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("allowance", "line_no"), name="uq_sal_sales_allowance_line"),
            models.CheckConstraint(condition=Q(allowance_amount__gt=0, tax_amount__gte=0, line_total__gte=0), name="ck_sal_sales_allowance_line_vals"),
            models.CheckConstraint(condition=Q(allowance_rate__gte=0, allowance_rate__lte=100), name="ck_sal_sales_allowance_rate"),
        ]


class SalesInvoiceCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_sales_invoice_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_sales_invoice_counter")]


class SalesInvoice(SalesDocument):
    class InvoiceCategory(models.TextChoices):
        VAT = "VAT", "Hóa đơn giá trị gia tăng"
        SALES = "SALES", "Hóa đơn bán hàng"
        EXPORT = "EXPORT", "Hóa đơn xuất khẩu"
        OTHER = "OTHER", "Hóa đơn khác"

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Tiền mặt"
        BANK = "BANK", "Chuyển khoản"
        CASH_OR_BANK = "CASH_OR_BANK", "Tiền mặt/Chuyển khoản"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Bản nháp"
        PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ phê duyệt"
        REVISION_REQUIRED = "REVISION_REQUIRED", "Yêu cầu chỉnh sửa"
        REJECTED = "REJECTED", "Bị từ chối"
        APPROVED = "APPROVED", "Đã phê duyệt"
        ISSUING = "ISSUING", "Đang phát hành"
        ISSUE_FAILED = "ISSUE_FAILED", "Phát hành lỗi"
        ISSUED = "ISSUED", "Đã phát hành"
        CANCELLED = "CANCELLED", "Đã hủy"

    # Category & Series / Template
    invoice_category = models.CharField(max_length=20, choices=InvoiceCategory.choices, default=InvoiceCategory.VAT)
    invoice_series = models.CharField(max_length=50)
    template_code = models.CharField(max_length=50, blank=True)
    invoice_number = models.CharField(max_length=50, blank=True)
    invoice_date = models.DateField()

    # Seller snapshot
    seller_name = models.CharField(max_length=255)
    seller_tax_code = models.CharField(max_length=50)
    seller_address = models.CharField(max_length=500, blank=True)

    # Buyer snapshot
    buyer_name = models.CharField(max_length=255)
    buyer_legal_name = models.CharField(max_length=255, blank=True)
    buyer_tax_code = models.CharField(max_length=50, blank=True)
    buyer_address = models.CharField(max_length=500, blank=True)
    buyer_email = models.EmailField(blank=True)

    # Source documents
    goods_sale = models.ForeignKey(GoodsSale, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_invoices")
    service_sale = models.ForeignKey(ServiceSale, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_invoices")
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_invoices")

    # Payment method & E-Invoice Integration
    payment_method = models.CharField(max_length=30, choices=PaymentMethod.choices, default=PaymentMethod.CASH_OR_BANK)
    connector = models.ForeignKey("tax_management.ConnectorConfig", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_invoices")
    transaction_code = models.CharField(max_length=150, blank=True)
    issue_control_code = models.CharField(max_length=150, blank=True)
    tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_invoices")
    xml_file_url = models.CharField(max_length=500, blank=True)
    pdf_file_url = models.CharField(max_length=500, blank=True)
    lookup_url = models.CharField(max_length=500, blank=True)
    lookup_code = models.CharField(max_length=100, blank=True)
    issue_error_message = models.TextField(blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_invoices_issued")

    version = models.PositiveIntegerField(default=1)
    attachments = models.JSONField(default=list, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    withdrawal_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_sales_invoice"
        ordering = ("-invoice_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_sales_invoice_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0, total_amount__gte=0), name="ck_sal_sales_invoice_amounts"),
        ]


class SalesInvoiceLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, null=True, blank=True)
    item_name = models.CharField(max_length=255)
    description = models.CharField(max_length=500, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True)

    # Quantities & Pricing
    quantity = models.DecimalField(max_digits=22, decimal_places=6)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    # Source line links
    goods_sale_line = models.ForeignKey(GoodsSaleLine, on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines")
    service_sale_line = models.ForeignKey(ServiceSaleLine, on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines")
    order_line = models.ForeignKey(SalesOrderLine, on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines")

    class Meta:
        db_table = "sal_sales_invoice_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("invoice", "line_no"), name="uq_sal_sales_invoice_line"),
            models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, discount_amount__gte=0, tax_amount__gte=0, line_total__gte=0), name="ck_sal_sales_invoice_line_vals"),
        ]


class CostOfGoodsSoldCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_cogs_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_cogs_counter")]


class CostOfGoodsSold(SalesDocument):
    customer = models.ForeignKey(
        "master_data.Party",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    posting_date = models.DateField()
    costing_period = models.CharField(max_length=50, blank=True)
    inventory_transaction = models.ForeignKey(
        "inventory.InventoryTransaction",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cogs_vouchers",
    )
    goods_sale = models.ForeignKey(
        GoodsSale,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cogs_vouchers",
    )
    warehouse = models.ForeignKey(
        "master_data.Warehouse",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cogs_vouchers",
    )
    description = models.CharField(max_length=500, default="Ghi nhận giá vốn hàng bán")
    total_cogs_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    journal_entry = models.OneToOneField(
        "general_ledger.JournalEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cogs_voucher",
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey(
        "iam.UserAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cogs_vouchers_posted",
    )
    version = models.PositiveIntegerField(default=1)
    attachments = models.JSONField(default=list, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    withdrawal_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_cogs"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_cogs_number"),
            models.CheckConstraint(
                condition=Q(exchange_rate__gt=0, total_cogs_amount__gte=0),
                name="ck_sal_cogs_amounts",
            ),
        ]


class CostOfGoodsSoldLine(models.Model):
    class SourceStatus(models.TextChoices):
        UNRECORDED = "UNRECORDED", "Chưa ghi nhận"
        PROCESSING = "PROCESSING", "Đang xử lý"
        RECORDED = "RECORDED", "Đã ghi nhận giá vốn"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cogs = models.ForeignKey(CostOfGoodsSold, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    inventory_transaction_line = models.ForeignKey(
        "inventory.InventoryTransactionLine",
        on_delete=models.PROTECT,
        related_name="cogs_lines",
    )
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=22, decimal_places=6)
    costing_method = models.CharField(max_length=30, blank=True, default="MOVING_AVERAGE")
    unit_cost = models.DecimalField(max_digits=26, decimal_places=10, default=0)
    cogs_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    cogs_account = models.ForeignKey(
        "general_ledger.Account",
        on_delete=models.PROTECT,
        related_name="cogs_voucher_debit_lines",
    )
    inventory_account = models.ForeignKey(
        "general_ledger.Account",
        on_delete=models.PROTECT,
        related_name="cogs_voucher_credit_lines",
    )
    costing_version = models.PositiveIntegerField(default=1)
    source_status = models.CharField(
        max_length=20,
        choices=SourceStatus.choices,
        default=SourceStatus.PROCESSING,
    )

    class Meta:
        db_table = "sal_cogs_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("cogs", "line_no"), name="uq_sal_cogs_line"),
            models.CheckConstraint(
                condition=Q(quantity__gt=0, unit_cost__gte=0, cogs_amount__gte=0),
                name="ck_sal_cogs_line_values",
            ),
        ]


class LinkRelationType(models.TextChoices):
    DATA_INHERITANCE = "DATA_INHERITANCE", "Kế thừa dữ liệu"
    FULFILLMENT = "FULFILLMENT", "Thực hiện giao hàng/dịch vụ"
    INVOICING = "INVOICING", "Lập hóa đơn"
    RETURN = "RETURN", "Trả lại"
    ALLOWANCE = "ALLOWANCE", "Giảm giá"
    REFERENCE = "REFERENCE", "Tham chiếu"


class LinkStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Đang hiệu lực"
    UNLINKED = "UNLINKED", "Đã gỡ"


class LinkMode(models.TextChoices):
    AUTO = "AUTO", "Tự động"
    MANUAL = "MANUAL", "Thủ công"


class SalesDocumentLinkCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_link_counter"
        constraints = [
            models.UniqueConstraint(fields=("company", "year"), name="uq_sal_link_counter")
        ]


class SalesDocumentLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="sales_document_links")
    link_number = models.CharField(max_length=80)

    # Source document
    source_document_type = models.CharField(max_length=30)
    source_document_id = models.UUIDField(db_index=True)
    source_document_number = models.CharField(max_length=80)

    # Target document
    target_document_type = models.CharField(max_length=30)
    target_document_id = models.UUIDField(db_index=True)
    target_document_number = models.CharField(max_length=80)

    relation_type = models.CharField(max_length=30, choices=LinkRelationType.choices)
    customer = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True, related_name="sales_document_links")
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT, null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=LinkStatus.choices, default=LinkStatus.ACTIVE)
    link_mode = models.CharField(max_length=20, choices=LinkMode.choices, default=LinkMode.MANUAL)

    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="sal_links_created")
    created_at = models.DateTimeField(auto_now_add=True)

    unlinked_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="sal_links_unlinked")
    unlinked_at = models.DateTimeField(null=True, blank=True)
    unlinked_reason = models.TextField(blank=True)

    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "sal_document_link"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(fields=("company", "link_number"), name="uq_sal_link_number"),
        ]


class SalesDocumentLinkLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    link = models.ForeignKey(SalesDocumentLink, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    source_line_id = models.UUIDField(null=True, blank=True, db_index=True)
    target_line_id = models.UUIDField(null=True, blank=True, db_index=True)
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, null=True, blank=True)
    source_uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    target_uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    conversion_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    linked_quantity = models.DecimalField(max_digits=22, decimal_places=6, null=True, blank=True)
    linked_amount = models.DecimalField(max_digits=24, decimal_places=4, null=True, blank=True)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "sal_document_link_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("link", "line_no"), name="uq_sal_link_line_no"),
        ]


class SalesDiscountInvoiceCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="+")
    year = models.PositiveIntegerField()
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_discount_invoice_counter"
        constraints = [models.UniqueConstraint(fields=("company", "year"), name="uq_sal_discount_invoice_counter")]


class DiscountInvoiceCalculationMethod(models.TextChoices):
    AMOUNT = "AMOUNT", "Theo số tiền"
    PERCENTAGE = "PERCENTAGE", "Theo tỷ lệ"


class DiscountInvoiceStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ phê duyệt"
    REVISION_REQUIRED = "REVISION_REQUIRED", "Yêu cầu chỉnh sửa"
    REJECTED = "REJECTED", "Bị từ chối"
    APPROVED = "APPROVED", "Đã phê duyệt"
    ISSUING = "ISSUING", "Đang phát hành"
    ISSUE_FAILED = "ISSUE_FAILED", "Phát hành lỗi"
    ISSUED = "ISSUED", "Đã phát hành"
    CANCELLED = "CANCELLED", "Đã hủy"


class SalesDiscountInvoice(SalesDocument):
    code = models.CharField(max_length=50, blank=True, default="")
    invoice_series = models.CharField(max_length=50)
    template_code = models.CharField(max_length=50, blank=True, default="")
    invoice_number = models.CharField(max_length=50, blank=True, default="")
    invoice_date = models.DateField()

    # Seller snapshot
    seller_name = models.CharField(max_length=255, blank=True, default="")
    seller_tax_code = models.CharField(max_length=50, blank=True, default="")
    seller_address = models.CharField(max_length=500, blank=True, default="")

    # Buyer snapshot
    buyer_name = models.CharField(max_length=255, blank=True, default="")
    buyer_legal_name = models.CharField(max_length=255, blank=True, default="")
    buyer_tax_code = models.CharField(max_length=50, blank=True, default="")
    buyer_address = models.CharField(max_length=500, blank=True, default="")
    buyer_email = models.EmailField(blank=True, default="")

    # Discount basis & period
    discount_basis = models.CharField(max_length=255)
    contract = models.ForeignKey("sales.SalesContract", on_delete=models.SET_NULL, null=True, blank=True, related_name="discount_invoices")
    period_start = models.DateField()
    period_end = models.DateField()

    # Calculation method & amounts
    calculation_method = models.CharField(max_length=20, choices=DiscountInvoiceCalculationMethod.choices, default=DiscountInvoiceCalculationMethod.AMOUNT)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    eligible_revenue = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_discount_before_tax = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_adjusted_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    # Content & Accounting
    description = models.TextField(blank=True, default="")
    accounting_document_ref = models.CharField(max_length=100, blank=True, default="")

    # Status overriding
    status = models.CharField(max_length=30, choices=DiscountInvoiceStatus.choices, default=DiscountInvoiceStatus.DRAFT)

    # E-invoice Integration
    connector = models.ForeignKey("tax_management.ConnectorConfig", on_delete=models.PROTECT, null=True, blank=True, related_name="discount_invoices")
    transaction_code = models.CharField(max_length=150, blank=True, default="")
    issue_control_code = models.CharField(max_length=150, blank=True, default="")
    tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="discount_invoices")
    xml_file_url = models.CharField(max_length=500, blank=True, default="")
    pdf_file_url = models.CharField(max_length=500, blank=True, default="")
    lookup_url = models.CharField(max_length=500, blank=True, default="")
    lookup_code = models.CharField(max_length=100, blank=True, default="")
    issue_error_message = models.TextField(blank=True, default="")
    issued_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="discount_invoices_issued")

    version = models.PositiveIntegerField(default=1)
    attachments = models.JSONField(default=list, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True, default="")
    rejection_reason = models.CharField(max_length=500, blank=True, default="")
    withdrawal_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "sal_discount_invoice"
        ordering = ("-invoice_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_discount_invoice_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0), name="ck_sal_discount_invoice_rate"),
            models.CheckConstraint(condition=Q(period_end__gte=models.F("period_start")), name="ck_sal_discount_invoice_period"),
        ]


class SalesDiscountInvoiceLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(SalesDiscountInvoice, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    original_invoice = models.ForeignKey("sales.SalesInvoice", on_delete=models.PROTECT, related_name="discount_allocations")
    original_invoice_series = models.CharField(max_length=50, blank=True, default="")
    original_invoice_number = models.CharField(max_length=50, blank=True, default="")
    original_invoice_date = models.DateField()
    original_invoice_line = models.ForeignKey("sales.SalesInvoiceLine", on_delete=models.PROTECT, related_name="discount_allocations")
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, null=True, blank=True)
    item_name = models.CharField(max_length=255, blank=True, default="")
    description = models.CharField(max_length=500, blank=True, default="")
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True)

    eligible_revenue = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    used_discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    held_discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    allocated_discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_rate_percentage = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    adjusted_tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    class Meta:
        db_table = "sal_discount_invoice_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("invoice", "line_no"), name="uq_sal_discount_invoice_line_no"),
            models.CheckConstraint(
                condition=Q(allocated_discount_amount__gte=0, adjusted_tax_amount__gte=0, line_total__gte=0),
                name="ck_sal_discount_invoice_line_amounts"
            ),
        ]


# ==============================================================================
# UC-SAL-14: HÓA ĐƠN THƯƠNG MẠI (COMMERCIAL INVOICE)
# ==============================================================================

class CommercialInvoiceForm(models.TextChoices):
    DOCUMENT = "DOCUMENT", "Commercial Invoice dạng tài liệu"
    ELECTRONIC = "ELECTRONIC", "Hóa đơn thương mại điện tử"


class CommercialInvoiceStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ duyệt"
    REVISION_REQUIRED = "REVISION_REQUIRED", "Yêu cầu chỉnh sửa"
    REJECTED = "REJECTED", "Từ chối"
    APPROVED = "APPROVED", "Đã duyệt"
    PUBLISHED = "PUBLISHED", "Đã xuất bản"
    ISSUING = "ISSUING", "Đang phát hành"
    ISSUE_FAILED = "ISSUE_FAILED", "Phát hành lỗi"
    ISSUED = "ISSUED", "Đã phát hành"
    CANCELLED = "CANCELLED", "Đã hủy"


class SalesCommercialInvoiceCounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="commercial_invoice_counters")
    year = models.PositiveIntegerField()
    counter_type = models.CharField(max_length=20, default="INTERNAL")
    value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sal_commercial_invoice_counter"
        unique_together = [("company", "year", "counter_type")]


class SalesCommercialInvoice(SalesDocument):
    code = models.CharField(max_length=50, blank=True, default="")
    invoice_form = models.CharField(max_length=20, choices=CommercialInvoiceForm.choices, default=CommercialInvoiceForm.DOCUMENT)
    template_code = models.CharField(max_length=50, default="COMM_INV_EN")
    invoice_series = models.CharField(max_length=50, blank=True, default="")
    invoice_number = models.CharField(max_length=50, blank=True, default="")
    invoice_date = models.DateField(default=timezone.now)

    # Seller Information
    seller_name = models.CharField(max_length=255, blank=True, default="")
    seller_address = models.CharField(max_length=500, blank=True, default="")
    seller_tax_code = models.CharField(max_length=50, blank=True, default="")
    seller_contact = models.CharField(max_length=255, blank=True, default="")

    # Buyer / Customer Information
    buyer_name = models.CharField(max_length=255)
    buyer_address = models.CharField(max_length=500)
    buyer_country = models.CharField(max_length=100)
    buyer_tax_code = models.CharField(max_length=50, blank=True, default="")
    buyer_email = models.EmailField(blank=True, default="")

    # Consignee
    consignee_name = models.CharField(max_length=255, blank=True, default="")
    consignee_address = models.CharField(max_length=500, blank=True, default="")
    consignee_country = models.CharField(max_length=100, blank=True, default="")

    # Linked Sources
    sales_contract = models.ForeignKey("sales.SalesContract", on_delete=models.SET_NULL, null=True, blank=True, related_name="commercial_invoices")
    sales_order = models.ForeignKey("sales.SalesOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="commercial_invoices")
    source_sales_document_type = models.CharField(max_length=50, blank=True, default="")
    source_sales_document_id = models.UUIDField(null=True, blank=True)

    # Delivery & Incoterms
    incoterms_term = models.CharField(max_length=20, blank=True, default="")
    incoterms_version = models.CharField(max_length=20, blank=True, default="2020")
    incoterms_location = models.CharField(max_length=255, blank=True, default="")
    incoterms = models.CharField(max_length=255, blank=True, default="")

    # Payment & Banking
    payment_terms = models.CharField(max_length=255)
    beneficiary_bank = models.ForeignKey("master_data.Bank", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    beneficiary_bank_account = models.ForeignKey("master_data.CompanyBankAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    beneficiary_bank_info = models.TextField(blank=True, default="")

    # Transportation & Shipment
    transport_method = models.CharField(max_length=30, blank=True, default="SEA")
    port_of_loading = models.CharField(max_length=255, blank=True, default="")
    port_of_discharge = models.CharField(max_length=255, blank=True, default="")
    vessel_flight_no = models.CharField(max_length=100, blank=True, default="")
    bill_of_lading_number = models.CharField(max_length=100, blank=True, default="")
    bill_of_lading_date = models.DateField(null=True, blank=True)

    # Customs clearance
    customs_declaration_number = models.CharField(max_length=100, blank=True, default="")
    customs_clearance_date = models.DateField(null=True, blank=True)

    # Additional Charges & Amounts
    freight_charge = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    insurance_charge = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    other_charges = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_lines_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_charges = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    # Document Publish fields (DOCUMENT form)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="commercial_invoices_published")

    # E-invoice fields (ELECTRONIC form)
    connector = models.ForeignKey("tax_management.ConnectorConfig", on_delete=models.PROTECT, null=True, blank=True, related_name="commercial_invoices")
    transaction_code = models.CharField(max_length=150, blank=True, default="")
    issue_control_code = models.CharField(max_length=150, blank=True, default="")
    tax_invoice = models.ForeignKey("tax_management.TaxInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="commercial_invoices")
    xml_file_url = models.CharField(max_length=500, blank=True, default="")
    pdf_file_url = models.CharField(max_length=500, blank=True, default="")
    lookup_url = models.CharField(max_length=500, blank=True, default="")
    lookup_code = models.CharField(max_length=100, blank=True, default="")
    issue_error_message = models.TextField(blank=True, default="")
    issued_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="commercial_invoices_issued")

    # Document Versioning (AF-06, BR-SAL-14-12)
    document_version = models.PositiveIntegerField(default=1)
    is_current_version = models.BooleanField(default=True)
    parent_invoice = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="revisions")

    status = models.CharField(max_length=30, choices=CommercialInvoiceStatus.choices, default=CommercialInvoiceStatus.DRAFT)
    version = models.PositiveIntegerField(default=1)
    attachments = models.JSONField(default=list, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True, default="")
    rejection_reason = models.CharField(max_length=500, blank=True, default="")
    withdrawal_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "sal_commercial_invoice"
        ordering = ("-invoice_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_sal_commercial_invoice_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0), name="ck_sal_commercial_invoice_rate"),
        ]


class SalesCommercialInvoiceLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(SalesCommercialInvoice, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField(default=1)

    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, null=True, blank=True)
    item_name = models.CharField(max_length=255, blank=True, default="")
    description = models.CharField(max_length=500)
    hs_code = models.CharField(max_length=50, blank=True, default="")
    origin_country = models.CharField(max_length=100, blank=True, default="")
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True)
    uom_name = models.CharField(max_length=50, blank=True, default="")

    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    package_quantity = models.PositiveIntegerField(null=True, blank=True)
    net_weight = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    gross_weight = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)

    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_rate_percentage = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    line_total = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    # Source references
    source_order_line = models.ForeignKey("sales.SalesOrderLine", on_delete=models.PROTECT, null=True, blank=True, related_name="commercial_invoice_lines")
    source_contract_line = models.ForeignKey("sales.SalesContractLine", on_delete=models.PROTECT, null=True, blank=True, related_name="commercial_invoice_lines")
    source_sales_line_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = "sal_commercial_invoice_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("invoice", "line_no"), name="uq_sal_commercial_invoice_line_no"),
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name="ck_sal_commercial_invoice_line_qty"
            ),
        ]





