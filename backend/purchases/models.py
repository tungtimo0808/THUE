import uuid

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class DocumentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ phê duyệt"
    APPROVED = "APPROVED", "Đã phê duyệt"
    SENT = "SENT", "Đã gửi nhà cung cấp"
    IN_PROGRESS = "IN_PROGRESS", "Đang thực hiện"
    REJECTED = "REJECTED", "Bị từ chối"
    REVISION_REQUIRED = "REVISION_REQUIRED", "Yêu cầu chỉnh sửa"
    PARTIALLY_ORDERED = "PARTIALLY_ORDERED", "Đã đặt hàng một phần"
    ORDERED = "ORDERED", "Đã đặt hàng"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED", "Đã nhận một phần"
    FULLY_RECEIVED = "FULLY_RECEIVED", "Đã nhận đủ"
    COMPLETED = "COMPLETED", "Hoàn tất"
    EXPIRED = "EXPIRED", "Hết hiệu lực"
    CANCELLED = "CANCELLED", "Đã hủy"


class ReceivingProgressStatus(models.TextChoices):
    NOT_RECEIVED = "NOT_RECEIVED", "Chưa nhận hàng"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED", "Đã nhận một phần"
    FULLY_RECEIVED = "FULLY_RECEIVED", "Đã nhận đủ"


class InvoicingProgressStatus(models.TextChoices):
    NOT_INVOICED = "NOT_INVOICED", "Chưa ghi nhận hóa đơn"
    PARTIALLY_INVOICED = "PARTIALLY_INVOICED", "Đã ghi nhận một phần"
    FULLY_INVOICED = "FULLY_INVOICED", "Đã ghi nhận đầy đủ"


class ReceiptStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    CONFIRMED = "CONFIRMED", "Đã xác nhận"
    CANCELLED = "CANCELLED", "Đã hủy"


class PurchaseDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True)
    number = models.CharField(max_length=80)
    document_date = models.DateField()
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

    def clean(self):
        if self.branch_id and self.branch.company_id != self.company_id:
            raise ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})


class PurchaseRequest(PurchaseDocument):
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, related_name="purchase_requests")
    requester = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, related_name="purchase_requests")
    required_date = models.DateField()
    purpose = models.CharField(max_length=500)
    receiving_location = models.CharField(max_length=255, blank=True, default="")
    attachments = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    proposed_supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True, related_name="proposed_purchase_requests")
    cancelled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="cancelled_purchase_requests")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "pur_purchase_request"
        ordering = ("-document_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_pur_request_number")]

    @property
    def total_estimated_amount(self):
        return sum((line.estimated_amount for line in self.lines.all()), Decimal("0"))

    def clean(self):
        super().clean()
        errors = {}
        if not self.branch_id:
            errors["branch"] = "Chi nhánh là bắt buộc."
        elif self.branch.company_id != self.company_id:
            errors["branch"] = "Chi nhánh phải thuộc cùng doanh nghiệp."
        if not self.department_id:
            errors["department"] = "Phòng ban là bắt buộc."
        elif self.department.company_id != self.company_id:
            errors["department"] = "Đơn vị đề nghị phải thuộc cùng doanh nghiệp."
        if not self.requester_id:
            errors["requester"] = "Người đề nghị là bắt buộc."
        elif self.requester.company_id != self.company_id:
            errors["requester"] = "Người đề nghị phải thuộc cùng doanh nghiệp."
        if not self.purpose or not self.purpose.strip():
            errors["purpose"] = "Mục đích mua là bắt buộc."
        if self.notes and len(self.notes) > 500:
            errors["notes"] = "Ghi chú không được vượt quá 500 ký tự."
        if self.proposed_supplier_id and self.proposed_supplier.company_id != self.company_id:
            errors["proposed_supplier"] = "Nhà cung cấp đề xuất phải thuộc cùng doanh nghiệp."
        if self.document_date and self.required_date and self.required_date < self.document_date:
            errors["required_date"] = "Ngày cần hàng không được trước Ngày yêu cầu."
        if errors:
            raise ValidationError(errors)


class PurchaseRequestLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=20, decimal_places=6)
    required_date = models.DateField(null=True, blank=True)
    estimated_unit_price = models.DecimalField(max_digits=20, decimal_places=4, default=0, null=True, blank=True)
    ordered_quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    notes = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "pur_purchase_request_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("request", "line_no"), name="uq_pur_request_line_no"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_pur_request_qty_positive"),
            models.CheckConstraint(condition=Q(estimated_unit_price__isnull=True) | Q(estimated_unit_price__gte=0), name="ck_pur_request_price_nonnegative"),
            models.CheckConstraint(condition=Q(ordered_quantity__gte=0), name="ck_pur_request_ordered_nonnegative"),
        ]

    @property
    def remaining_quantity(self):
        return self.quantity - self.ordered_quantity

    @property
    def estimated_amount(self):
        price = self.estimated_unit_price or Decimal("0")
        return (self.quantity * price).quantize(Decimal("0.0001"))

    def clean(self):
        super().clean()
        errors = {}
        if self.quantity is not None and self.quantity <= 0:
            errors["quantity"] = "Số lượng yêu cầu phải lớn hơn 0."
        if self.estimated_unit_price is not None and self.estimated_unit_price < 0:
            errors["estimated_unit_price"] = "Đơn giá dự kiến phải lớn hơn hoặc bằng 0."
        if self.notes and len(self.notes) > 500:
            errors["notes"] = "Ghi chú không được vượt quá 500 ký tự."
        if self.description and len(self.description) > 500:
            errors["description"] = "Diễn giải không được vượt quá 500 ký tự."
        if errors:
            raise ValidationError(errors)


class PurchaseContract(PurchaseDocument):
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="purchase_contracts")
    title = models.CharField(max_length=255, blank=True, default="")
    signed_date = models.DateField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_contracts")
    assigned_to = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="assigned_purchase_contracts")
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_contracts")
    delivery_place = models.CharField(max_length=500, blank=True, default="")
    delivery_term = models.CharField(max_length=500, blank=True, default="")
    content = models.TextField(blank=True, default="")
    payment_schedules = models.JSONField(default=list, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    maximum_value = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    ordered_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    received_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    invoiced_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    paid_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    rejection_reason = models.CharField(max_length=500, blank=True, default="")
    cancellation_reason = models.CharField(max_length=500, blank=True, default="")
    completion_reason = models.CharField(max_length=500, blank=True, default="")
    terminated_at = models.DateTimeField(null=True, blank=True)
    termination_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "pur_purchase_contract"
        ordering = ("-document_date", "number")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_pur_contract_number"),
            models.CheckConstraint(condition=Q(end_date__gte=models.F("start_date")), name="ck_pur_contract_dates"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0), name="ck_pur_contract_rate_positive"),
            models.CheckConstraint(condition=Q(maximum_value__isnull=True) | Q(maximum_value__gte=0), name="ck_pur_contract_max_nonnegative"),
        ]

    def clean(self):
        super().clean()
        if self.supplier_id and self.supplier.company_id != self.company_id:
            raise ValidationError({"supplier": "Nhà cung cấp phải thuộc cùng doanh nghiệp."})


class PurchaseContractLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(PurchaseContract, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    pre_tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    expected_delivery_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True, default="")
    ordered_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    ordered_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    maximum_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)

    class Meta:
        db_table = "pur_purchase_contract_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("contract", "line_no"), name="uq_pur_contract_line_no"),
            models.CheckConstraint(condition=Q(maximum_quantity__isnull=True) | Q(maximum_quantity__gt=0), name="ck_pur_contract_qty_positive"),
            models.CheckConstraint(condition=Q(unit_price__isnull=True) | Q(unit_price__gte=0), name="ck_pur_contract_price_nonnegative"),
        ]


class PurchaseOrder(PurchaseDocument):
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="purchase_orders")
    contact_person = models.CharField(max_length=255, blank=True, default="")
    buyer = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="buyer_purchase_orders")
    purchase_request = models.ForeignKey("purchases.PurchaseRequest", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_orders")
    contract = models.ForeignKey(PurchaseContract, on_delete=models.PROTECT, null=True, blank=True, related_name="orders")
    contract_or_quotation_no = models.CharField(max_length=100, blank=True, default="")
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    payment_term = models.ForeignKey("master_data.PaymentTerm", on_delete=models.PROTECT, null=True, blank=True)
    payment_method_config = models.ForeignKey("master_data.PaymentMethod", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_orders")
    payment_method_snapshot = models.JSONField(default=dict, blank=True)
    delivery_date = models.DateField(null=True, blank=True)
    receiving_warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_orders")
    receiving_location = models.CharField(max_length=255, blank=True, default="")
    delivery_address = models.CharField(max_length=500, blank=True, default="")
    attachments = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    receiving_status = models.CharField(max_length=30, choices=ReceivingProgressStatus.choices, default=ReceivingProgressStatus.NOT_RECEIVED)
    invoicing_status = models.CharField(max_length=30, choices=InvoicingProgressStatus.choices, default=InvoicingProgressStatus.NOT_INVOICED)
    sent_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="cancelled_purchase_orders")
    cancellation_reason = models.CharField(max_length=500, blank=True, default="")
    subtotal = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    fee_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    invoiced_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    realized_purchase_value = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    paid_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="closed_purchase_orders")
    close_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "pur_purchase_order"
        ordering = ("-document_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_pur_order_number"),
            models.CheckConstraint(condition=Q(exchange_rate__gt=0), name="ck_pur_order_rate_positive"),
            models.CheckConstraint(condition=Q(subtotal__gte=0, tax_amount__gte=0, discount_amount__gte=0, fee_amount__gte=0, total_amount__gte=0), name="ck_pur_order_amounts_nonnegative"),
        ]

    def clean(self):
        super().clean()
        errors = {}
        if not self.branch_id:
            errors["branch"] = "Chi nhánh là bắt buộc."
        elif self.branch.company_id != self.company_id:
            errors["branch"] = "Chi nhánh phải thuộc cùng doanh nghiệp."
        if not self.supplier_id:
            errors["supplier"] = "Nhà cung cấp là bắt buộc."
        elif self.supplier.company_id != self.company_id:
            errors["supplier"] = "Nhà cung cấp phải thuộc cùng doanh nghiệp."
        for field_name in ("contract", "payment_term", "receiving_warehouse", "purchase_request"):
            related = getattr(self, field_name, None)
            if related and related.company_id != self.company_id:
                errors[field_name] = "Dữ liệu liên kết phải thuộc cùng doanh nghiệp."
        if self.contract_id and self.contract.supplier_id != self.supplier_id:
            errors["contract"] = "Hợp đồng phải thuộc nhà cung cấp của đơn mua."
        if not self.delivery_date:
            errors["delivery_date"] = "Ngày giao dự kiến là bắt buộc."
        elif self.document_date and self.delivery_date < self.document_date:
            errors["delivery_date"] = "Ngày giao dự kiến không được trước Ngày đặt hàng."
        if not (self.receiving_warehouse_id or self.delivery_address or self.receiving_location):
            errors["receiving_location"] = "Địa điểm nhận là bắt buộc."
        if self.notes and len(self.notes) > 500:
            errors["notes"] = "Diễn giải không được vượt quá 500 ký tự."
        if errors:
            raise ValidationError(errors)


class PurchaseOrderLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    description = models.CharField(max_length=500, blank=True, default="")
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=20, decimal_places=6)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=500, blank=True, default="")
    received_quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    realized_purchase_value = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    invoiced_quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    cancelled_quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)

    class Meta:
        db_table = "pur_purchase_order_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("order", "line_no"), name="uq_pur_order_line_no"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_pur_order_qty_positive"),
            models.CheckConstraint(condition=Q(unit_price__gte=0), name="ck_pur_order_price_nonnegative"),
            models.CheckConstraint(condition=Q(discount_rate__gte=0, discount_rate__lte=100), name="ck_pur_order_discount_range"),
            models.CheckConstraint(condition=Q(received_quantity__gte=0, cancelled_quantity__gte=0, invoiced_quantity__gte=0), name="ck_pur_order_progress_nonnegative"),
        ]

    @property
    def remaining_quantity(self):
        return self.quantity - self.received_quantity - self.cancelled_quantity

    @property
    def pre_discount_amount(self):
        return (self.quantity * self.unit_price).quantize(Decimal("0.0001"))

    @property
    def discount_amount(self):
        return (self.pre_discount_amount * (self.discount_rate / Decimal("100"))).quantize(Decimal("0.0001"))

    @property
    def pre_tax_amount(self):
        return self.pre_discount_amount - self.discount_amount

    @property
    def tax_amount(self):
        if not self.tax_rate:
            return Decimal("0")
        rate = getattr(self.tax_rate, "rate_percent", None) or getattr(self.tax_rate, "rate", Decimal("0"))
        return (self.pre_tax_amount * rate / Decimal("100")).quantize(Decimal("0.0001"))

    @property
    def line_total(self):
        return self.pre_tax_amount + self.tax_amount

    def clean(self):
        super().clean()
        errors = {}
        if self.quantity is not None and self.quantity <= 0:
            errors["quantity"] = "Số lượng đặt phải lớn hơn 0."
        if self.unit_price is not None and self.unit_price < 0:
            errors["unit_price"] = "Đơn giá phải lớn hơn hoặc bằng 0."
        if self.discount_rate is not None and (self.discount_rate < 0 or self.discount_rate > 100):
            errors["discount_rate"] = "Tỷ lệ chiết khấu phải từ 0% đến 100."
        if hasattr(self, "item") and self.item:
            if getattr(self.item, "track_inventory", False) or getattr(self.item, "item_type", "") != "SERVICE":
                if not (self.warehouse_id or getattr(getattr(self, "order", None), "receiving_warehouse_id", None)):
                    errors["warehouse"] = "Kho nhận là bắt buộc đối với hàng hóa theo dõi qua kho."
        if self.notes and len(self.notes) > 500:
            errors["notes"] = "Ghi chú không được vượt quá 500 ký tự."
        if self.description and len(self.description) > 500:
            errors["description"] = "Diễn giải không được vượt quá 500 ký tự."
        if errors:
            raise ValidationError(errors)


class PurchaseOrderRequestLine(models.Model):
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.CASCADE, related_name="request_links")
    request_line = models.ForeignKey(PurchaseRequestLine, on_delete=models.PROTECT, related_name="order_links")
    quantity = models.DecimalField(max_digits=20, decimal_places=6)

    class Meta:
        db_table = "pur_order_request_line"
        constraints = [
            models.UniqueConstraint(fields=("order_line", "request_line"), name="uq_pur_order_request_link"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_pur_order_request_qty_positive"),
        ]


class PurchaseReceipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="receipts")
    number = models.CharField(max_length=80)
    receipt_date = models.DateField()
    status = models.CharField(max_length=20, choices=ReceiptStatus.choices, default=ReceiptStatus.DRAFT)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    delivery_reference = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="purchase_receipts_created")
    confirmed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_receipts_confirmed")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pur_purchase_receipt"
        ordering = ("-receipt_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_pur_receipt_number")]

    def clean(self):
        errors = {}
        if self.order_id and self.order.company_id != self.company_id:
            errors["order"] = "Đơn mua phải thuộc cùng doanh nghiệp."
        if self.warehouse_id and self.warehouse.company_id != self.company_id:
            errors["warehouse"] = "Kho nhận phải thuộc cùng doanh nghiệp."
        if errors:
            raise ValidationError(errors)


class PurchaseReceiptLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt = models.ForeignKey(PurchaseReceipt, on_delete=models.CASCADE, related_name="lines")
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, related_name="receipt_lines")
    quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    accepted_value = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    completion_percent = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    acceptance_note = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "pur_purchase_receipt_line"
        constraints = [
            models.UniqueConstraint(fields=("receipt", "order_line"), name="uq_pur_receipt_order_line"),
            models.CheckConstraint(condition=Q(quantity__isnull=True) | Q(quantity__gt=0), name="ck_pur_receipt_qty_positive"),
            models.CheckConstraint(condition=Q(accepted_value__isnull=True) | Q(accepted_value__gte=0), name="ck_pur_receipt_value_nonnegative"),
            models.CheckConstraint(condition=Q(completion_percent__isnull=True) | Q(completion_percent__gt=0, completion_percent__lte=100), name="ck_pur_receipt_percent_range"),
        ]


class ApprovalDecision(models.Model):
    class Decision(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Đã gửi"
        APPROVED = "APPROVED", "Đã phê duyệt"
        REJECTED = "REJECTED", "Đã từ chối"
        REVISION_REQUIRED = "REVISION_REQUIRED", "Yêu cầu chỉnh sửa"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    document_type = models.CharField(max_length=20, choices=(("REQUEST", "Yêu cầu mua"), ("ORDER", "Đơn mua"), ("CONTRACT", "Hợp đồng"), ("GOODS", "Mua hàng hóa"), ("SERVICE", "Mua dịch vụ"), ("RETURN", "Hàng mua trả lại"), ("DISCOUNT", "Giảm giá hàng mua"), ("COST", "Chi phí mua hàng")))
    document_id = models.UUIDField()
    document_version = models.PositiveIntegerField(default=1)
    workflow_version = models.CharField(max_length=80, blank=True)
    level = models.PositiveSmallIntegerField(default=1)
    decision = models.CharField(max_length=20, choices=Decision.choices)
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    comment = models.CharField(max_length=1000, blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pur_approval_decision"
        ordering = ("decided_at",)
        indexes = [models.Index(fields=("document_type", "document_id"), name="ix_pur_approval_document")]


class GoodsPurchase(PurchaseDocument):
    class PurchaseType(models.TextChoices):
        WAREHOUSE = "WAREHOUSE", "Qua kho"
        DIRECT = "DIRECT", "Không qua kho"
        SERVICE = "SERVICE", "Mua dịch vụ"

    class PaymentType(models.TextChoices):
        UNPAID = "UNPAID", "Chưa thanh toán"
        IMMEDIATE = "IMMEDIATE", "Thanh toán ngay"

    posting_date = models.DateField()
    purchase_type = models.CharField(max_length=12, choices=PurchaseType.choices)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, null=True, blank=True)
    receiving_warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    payment_type = models.CharField(max_length=12, choices=PaymentType.choices)
    payment_reference = models.CharField(max_length=100, blank=True)
    payment = models.OneToOneField("accounts_payable.Payment", on_delete=models.PROTECT, null=True, blank=True)
    supplier_invoice = models.ForeignKey("accounts_payable.SupplierInvoice", on_delete=models.PROTECT, null=True, blank=True)
    invoice_status = models.CharField(max_length=24, default="NOT_INVOICED")
    delivery_person = models.CharField(max_length=255, blank=True)
    contact_person = models.CharField(max_length=255, blank=True)
    supplier_address = models.CharField(max_length=500, blank=True)
    source_document_count = models.PositiveIntegerField(default=0)
    debt_days = models.PositiveIntegerField(null=True, blank=True)
    payment_due_date = models.DateField(null=True, blank=True)
    invoice_details = models.JSONField(default=dict, blank=True)
    acceptance_reference = models.CharField(max_length=150, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    subtotal = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    inventory_transaction = models.OneToOneField("inventory.InventoryTransaction", on_delete=models.PROTECT, null=True, blank=True)
    inventory_created = models.BooleanField(default=False)
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    order_status_before = models.CharField(max_length=30, blank=True)
    order_receiving_status_before = models.CharField(max_length=30, blank=True)

    class Meta:
        db_table = "pur_goods_purchase"
        ordering = ("-document_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_pur_goods_number")]


class GoodsPurchaseLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase = models.ForeignKey(GoodsPurchase, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=6)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    debit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="goods_purchase_debits")
    credit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="goods_purchase_credits")
    expense_item = models.ForeignKey("master_data.ExpenseItem", on_delete=models.PROTECT, null=True, blank=True)
    statistical_code = models.ForeignKey("master_data.StatisticalCode", on_delete=models.PROTECT, null=True, blank=True)
    notes = models.CharField(max_length=500, blank=True)
    description = models.CharField(max_length=500, blank=True)
    service_from = models.DateField(null=True, blank=True)
    service_to = models.DateField(null=True, blank=True)
    acceptance_date = models.DateField(null=True, blank=True)
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True)
    discount_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    class Meta:
        db_table = "pur_goods_purchase_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("purchase", "line_no"), name="uq_pur_goods_line_no"),
            models.CheckConstraint(condition=Q(quantity__gt=0, unit_price__gte=0, discount_rate__gte=0, discount_rate__lte=100), name="ck_pur_goods_line_values"),
        ]

    @property
    def returned_pre_tax_amount(self):
        return self.return_lines.filter(document__status="POSTED").aggregate(
            total=models.Sum("pre_tax_amount"))["total"] or Decimal("0")

    @property
    def discounted_pre_tax_amount(self):
        return self.discount_lines.filter(document__status="POSTED").aggregate(
            total=models.Sum("pre_tax_amount"))["total"] or Decimal("0")

    @property
    def remaining_discountable_amount(self):
        return self.pre_tax_amount - self.returned_pre_tax_amount - self.discounted_pre_tax_amount


class PurchaseReturn(PurchaseDocument):
    class Handling(models.TextChoices):
        REDUCE_PAYABLE = "REDUCE_PAYABLE", "Giảm công nợ"
        OFFSET_FUTURE = "OFFSET_FUTURE", "Bù trừ kỳ sau"
        REFUND = "REFUND", "Chờ hoàn tiền"

    posting_date = models.DateField()
    original_purchase = models.ForeignKey(GoodsPurchase, on_delete=models.PROTECT, related_name="returns")
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    supplier_invoice = models.ForeignKey("accounts_payable.SupplierInvoice", on_delete=models.PROTECT, null=True, blank=True)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    recipient = models.CharField(max_length=255, blank=True)
    reason = models.CharField(max_length=500)
    handling = models.CharField(max_length=20, choices=Handling.choices)
    adjustment_invoice_status = models.CharField(max_length=32, default="PENDING_ADJUSTMENT_INVOICE")
    attachments = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    subtotal = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    issue_transaction = models.OneToOneField("inventory.InventoryTransaction", on_delete=models.PROTECT, null=True, blank=True)
    issue_created = models.BooleanField(default=False)
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True)
    payable_adjustment = models.OneToOneField("accounts_payable.PayableAdjustment", on_delete=models.PROTECT, null=True, blank=True)
    payable_paid_before = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    payable_netted_before = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "pur_purchase_return"
        ordering = ("-document_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_pur_return_number")]


class PurchaseReturnLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    original_line = models.ForeignKey(GoodsPurchaseLine, on_delete=models.PROTECT, related_name="return_lines")
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=6)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    discount_rate = models.DecimalField(max_digits=9, decimal_places=4)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    debit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="purchase_return_debits")
    credit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="purchase_return_credits")
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    notes = models.CharField(max_length=500, blank=True)
    discount_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    class Meta:
        db_table = "pur_purchase_return_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("document", "line_no"), name="uq_pur_return_line_no"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_pur_return_qty_positive"),
        ]


class PurchaseReturnCredit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.OneToOneField(PurchaseReturn, on_delete=models.PROTECT, related_name="supplier_credit")
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    settled_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    handling = models.CharField(max_length=20, choices=PurchaseReturn.Handling.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pur_return_credit"
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0, settled_amount__gte=0), name="ck_pur_return_credit_values")]


class PurchaseDiscount(PurchaseDocument):
    class Method(models.TextChoices):
        AMOUNT = "AMOUNT", "Theo số tiền"
        PERCENT = "PERCENT", "Theo tỷ lệ"

    class Handling(models.TextChoices):
        REDUCE_PAYABLE = "REDUCE_PAYABLE", "Giảm công nợ"
        OFFSET_FUTURE = "OFFSET_FUTURE", "Bù trừ kỳ sau"
        REFUND = "REFUND", "Chờ hoàn tiền"

    posting_date = models.DateField()
    original_purchase = models.ForeignKey(GoodsPurchase, on_delete=models.PROTECT, related_name="purchase_discounts")
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    supplier_invoice = models.ForeignKey("accounts_payable.SupplierInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_discounts")
    adjustment_invoice = models.OneToOneField("accounts_payable.SupplierInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_discount_adjustment")
    method = models.CharField(max_length=10, choices=Method.choices)
    handling = models.CharField(max_length=20, choices=Handling.choices)
    reason = models.CharField(max_length=500)
    attachments = models.JSONField(default=list, blank=True)
    version = models.PositiveIntegerField(default=1)
    pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    adjustment_invoice_status = models.CharField(max_length=32, default="PENDING_ADJUSTMENT_INVOICE")
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True)
    payable_adjustment = models.OneToOneField("accounts_payable.PayableAdjustment", on_delete=models.PROTECT, null=True, blank=True)
    payable_paid_before = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    payable_netted_before = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "pur_purchase_discount"
        ordering = ("-document_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_pur_discount_number")]


class PurchaseDiscountLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(PurchaseDiscount, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    original_line = models.ForeignKey(GoodsPurchaseLine, on_delete=models.PROTECT, related_name="discount_lines")
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    rate_percent = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    debit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="purchase_discount_debits")
    credit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="purchase_discount_credits")
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "pur_purchase_discount_line"
        ordering = ("line_no",)
        constraints = [models.UniqueConstraint(fields=("document", "line_no"), name="uq_pur_discount_line_no"),
                       models.CheckConstraint(condition=Q(pre_tax_amount__gt=0), name="ck_pur_discount_amount_positive")]


class PurchaseDiscountCredit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.OneToOneField(PurchaseDiscount, on_delete=models.PROTECT, related_name="supplier_credit")
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    settled_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    handling = models.CharField(max_length=20, choices=PurchaseDiscount.Handling.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pur_discount_credit"
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0, settled_amount__gte=0), name="ck_pur_discount_credit_values")]


class PurchaseInvoiceFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey("accounts_payable.SupplierInvoice", on_delete=models.CASCADE, related_name="purchase_files")
    kind = models.CharField(max_length=10, choices=(("XML", "XML"), ("PREVIEW", "PDF hoặc hình ảnh")))
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    content = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pur_invoice_file"
        constraints = [models.UniqueConstraint(fields=("invoice", "kind"), name="uq_pur_invoice_file_kind")]


class PurchaseInvoiceMatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_line = models.ForeignKey("accounts_payable.SupplierInvoiceLine", on_delete=models.CASCADE, related_name="purchase_matches")
    purchase_line = models.ForeignKey(GoodsPurchaseLine, on_delete=models.PROTECT, related_name="invoice_matches")
    quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    amount = models.DecimalField(max_digits=24, decimal_places=4)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pur_invoice_match"
        constraints = [models.UniqueConstraint(fields=("invoice_line", "purchase_line"), name="uq_pur_invoice_match_pair"),
                       models.CheckConstraint(condition=Q(amount__gt=0, quantity__gte=0), name="ck_pur_invoice_match_positive")]


class PurchaseInvoiceDraft(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default="PENDING_VALIDATION")
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pur_invoice_draft"
        ordering = ("-created_at",)


class MatchingMethod(models.TextChoices):
    THREE_WAY = "THREE_WAY", "Đối chiếu ba bên"
    TWO_WAY = "TWO_WAY", "Đối chiếu hai bên"
    DIRECT = "DIRECT", "Đối chiếu trực tiếp"


class ReconciliationStatus(models.TextChoices):
    PENDING = "PENDING", "Chưa thực hiện hoặc chưa hoàn tất đối chiếu"
    MATCHED = "MATCHED", "Toàn bộ dữ liệu trong phạm vi đối chiếu khớp"
    PARTIALLY_MATCHED = "PARTIALLY_MATCHED", "Chỉ một phần hóa đơn hoặc chứng từ được đối chiếu"
    MISMATCH = "MISMATCH", "Có ít nhất một chỉ tiêu không khớp"
    RESOLVED = "RESOLVED", "Chênh lệch đã được xử lý hoặc chấp thuận"
    CANCELLED = "CANCELLED", "Kết quả đối chiếu đã bị hủy"


class ReconciliationLineResult(models.TextChoices):
    MATCHED = "MATCHED", "Khớp"
    PARTIALLY_MATCHED = "PARTIALLY_MATCHED", "Khớp một phần"
    MISMATCH = "MISMATCH", "Chênh lệch"


class PurchaseReconciliation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT)
    number = models.CharField(max_length=80)
    reconciliation_date = models.DateField()
    matching_method = models.CharField(max_length=20, choices=MatchingMethod.choices)
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT)
    invoice = models.ForeignKey("accounts_payable.SupplierInvoice", on_delete=models.PROTECT, related_name="reconciliations")
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, null=True, blank=True, related_name="reconciliations")
    purchase_receipt = models.ForeignKey(PurchaseReceipt, on_delete=models.PROTECT, null=True, blank=True, related_name="reconciliations")
    goods_purchase = models.ForeignKey(GoodsPurchase, on_delete=models.PROTECT, null=True, blank=True, related_name="reconciliations")
    status = models.CharField(max_length=30, choices=ReconciliationStatus.choices, default=ReconciliationStatus.PENDING)
    notes = models.CharField(max_length=500, blank=True, default="")
    total_invoice_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_matched_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_difference_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    difference_reason = models.CharField(max_length=500, blank=True, default="")
    resolved_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="reconciliations_resolved")
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.CharField(max_length=500, blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="reconciliations_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pur_reconciliation"
        ordering = ("-reconciliation_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_pur_reconciliation_number"),
        ]


class PurchaseReconciliationLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reconciliation = models.ForeignKey(PurchaseReconciliation, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, null=True, blank=True)
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT, null=True, blank=True)
    description = models.CharField(max_length=500, blank=True, default="")
    invoice_line = models.ForeignKey("accounts_payable.SupplierInvoiceLine", on_delete=models.PROTECT, related_name="reconciliation_lines")
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, null=True, blank=True, related_name="reconciliation_lines")
    receipt_line = models.ForeignKey(PurchaseReceiptLine, on_delete=models.PROTECT, null=True, blank=True, related_name="reconciliation_lines")
    purchase_line = models.ForeignKey(GoodsPurchaseLine, on_delete=models.PROTECT, null=True, blank=True, related_name="reconciliation_lines")
    order_quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    received_quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    invoice_quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    matched_quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    order_unit_price = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    invoice_unit_price = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    expected_tax_rate = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    invoice_tax_rate = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    document_pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    invoice_pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_difference = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_difference = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    line_result = models.CharField(max_length=20, choices=ReconciliationLineResult.choices, default=ReconciliationLineResult.MATCHED)
    difference_reason = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "pur_reconciliation_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("reconciliation", "line_no"), name="uq_pur_reconciliation_line_no"),
        ]


class CostType(models.TextChoices):
    TRANSPORT = "TRANSPORT", "Vận chuyển"
    LOADING = "LOADING", "Bốc xếp"
    INSURANCE = "INSURANCE", "Bảo hiểm"
    INSPECTION = "INSPECTION", "Kiểm định"
    STORAGE = "STORAGE", "Lưu kho"
    CUSTOMS = "CUSTOMS", "Hải quan"
    NON_REFUNDABLE_TAX = "NON_REFUNDABLE_TAX", "Thuế, phí không hoàn lại"
    OTHER = "OTHER", "Khác"


class CostAllocationStatus(models.TextChoices):
    NOT_REQUIRED = "NOT_REQUIRED", "Không yêu cầu phân bổ"
    UNALLOCATED = "UNALLOCATED", "Chưa phân bổ"
    PARTIALLY_ALLOCATED = "PARTIALLY_ALLOCATED", "Phân bổ một phần"
    ALLOCATED = "ALLOCATED", "Đã phân bổ"


class PurchaseCost(PurchaseDocument):
    class PaymentType(models.TextChoices):
        UNPAID = "UNPAID", "Chưa thanh toán"
        CASH = "CASH", "Tiền mặt"
        BANK = "BANK", "Chuyển khoản"

    posting_date = models.DateField()
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="purchase_costs")
    payment_type = models.CharField(max_length=12, choices=PaymentType.choices, default=PaymentType.UNPAID)
    payment_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="purchase_cost_payments", null=True, blank=True)
    supplier_invoice = models.ForeignKey("accounts_payable.SupplierInvoice", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_costs")
    related_orders = models.ManyToManyField(PurchaseOrder, blank=True, related_name="purchase_costs")
    related_goods_purchases = models.ManyToManyField(GoodsPurchase, blank=True, related_name="purchase_costs")
    version = models.PositiveIntegerField(default=1)
    subtotal = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    allocation_status = models.CharField(max_length=30, choices=CostAllocationStatus.choices, default=CostAllocationStatus.UNALLOCATED)
    journal_entry = models.OneToOneField("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="cancelled_purchase_costs")
    cancellation_reason = models.CharField(max_length=500, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "pur_purchase_cost"
        ordering = ("-document_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_pur_cost_number")]


class PurchaseCostLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cost = models.ForeignKey(PurchaseCost, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    cost_type = models.CharField(max_length=30, choices=CostType.choices)
    description = models.CharField(max_length=500)
    pre_tax_amount = models.DecimalField(max_digits=24, decimal_places=4)
    tax_rate = models.ForeignKey("master_data.TaxRate", on_delete=models.PROTECT, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    requires_allocation = models.BooleanField(default=True)
    account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="purchase_cost_lines")
    cost_center = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True)
    expense_item = models.ForeignKey("master_data.ExpenseItem", on_delete=models.PROTECT, null=True, blank=True)
    allocation_status = models.CharField(max_length=30, choices=CostAllocationStatus.choices, default=CostAllocationStatus.UNALLOCATED)
    allocated_amount = models.DecimalField(max_digits=24, decimal_places=4, default=0)

    class Meta:
        db_table = "pur_purchase_cost_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("cost", "line_no"), name="uq_pur_cost_line_no"),
            models.CheckConstraint(condition=Q(pre_tax_amount__gt=0), name="ck_pur_cost_amount_positive"),
        ]


class RiskLevel(models.TextChoices):
    LOW = "LOW", "Thấp"
    MEDIUM = "MEDIUM", "Trung bình"
    HIGH = "HIGH", "Cao"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA", "Chưa đủ dữ liệu"


class SupplierRiskConfig(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.OneToOneField("organization.Company", on_delete=models.CASCADE, related_name="supplier_risk_config")
    validity_days = models.PositiveIntegerField(default=30)
    low_threshold = models.PositiveIntegerField(default=19)
    medium_threshold = models.PositiveIntegerField(default=39)
    invalid_invoice_points = models.PositiveIntegerField(default=40)
    duplicate_invoice_points = models.PositiveIntegerField(default=30)
    late_delivery_tier1_points = models.PositiveIntegerField(default=10)
    late_delivery_tier2_points = models.PositiveIntegerField(default=20)
    return_ratio_tier1_points = models.PositiveIntegerField(default=10)
    return_ratio_tier2_points = models.PositiveIntegerField(default=20)
    incident_points = models.PositiveIntegerField(default=20)
    require_high_risk_workflow = models.BooleanField(default=False)
    custom_rules = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pur_supplier_risk_config"


class SupplierIncident(models.Model):
    class IncidentType(models.TextChoices):
        COMPLAINT = "COMPLAINT", "Khiếu nại"
        CONTRACT_BREACH = "CONTRACT_BREACH", "Vi phạm hợp đồng"
        QUALITY_ISSUE = "QUALITY_ISSUE", "Sự cố chất lượng"
        OTHER = "OTHER", "Khác"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Chưa xử lý"
        RESOLVED = "RESOLVED", "Đã xử lý"
        CANCELLED = "CANCELLED", "Đã hủy"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="supplier_incidents")
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="supplier_incidents")
    incident_type = models.CharField(max_length=30, choices=IncidentType.choices, default=IncidentType.COMPLAINT)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    related_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="incidents")
    related_contract = models.ForeignKey(PurchaseContract, on_delete=models.SET_NULL, null=True, blank=True, related_name="incidents")
    reported_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="reported_supplier_incidents")
    resolved_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_supplier_incidents")
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pur_supplier_incident"
        ordering = ("-created_at",)


class SupplierRiskAssessment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="supplier_risk_assessments")
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="risk_assessments")
    assessment_date = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField()
    score = models.IntegerField(default=0)
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices)
    is_blocked = models.BooleanField(default=False)
    tax_status = models.CharField(max_length=50, blank=True, default="ACTIVE")
    tax_code_status_verified = models.BooleanField(default=False)
    criteria_breakdown = models.JSONField(default=list)
    data_summary = models.JSONField(default=dict)
    assessed_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="supplier_risk_assessments_done")
    notes = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pur_supplier_risk_assessment"
        ordering = ("-version", "-created_at")


class SupplierRiskOverrideLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="supplier_risk_overrides")
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="risk_overrides")
    assessment = models.ForeignKey(SupplierRiskAssessment, on_delete=models.PROTECT, null=True, blank=True, related_name="overrides")
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices)
    document_type = models.CharField(max_length=50)
    document_id = models.CharField(max_length=100, blank=True)
    reason = models.TextField()
    override_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="risk_overrides_granted")
    override_at = models.DateTimeField(auto_now_add=True)
    is_exception_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="risk_exceptions_approved")
    approval_notes = models.TextField(blank=True)

    class Meta:
        db_table = "pur_supplier_risk_override_log"
        ordering = ("-override_at",)



