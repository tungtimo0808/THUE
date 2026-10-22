import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class TransactionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ duyệt"
    APPROVED = "APPROVED", "Đã duyệt"
    POSTED = "POSTED", "Đã ghi nhận"
    REVERSED = "REVERSED", "Đã đảo"
    CANCELLED = "CANCELLED", "Đã hủy"
    REJECTED = "REJECTED", "Từ chối"


class TransactionType(models.TextChoices):
    RECEIPT = "RECEIPT", "Nhập kho"
    ISSUE = "ISSUE", "Xuất kho"
    RETURN = "RETURN", "Nhập lại hàng đã xuất"
    TRANSFER = "TRANSFER", "Điều chuyển"
    ADJUSTMENT_IN = "ADJUSTMENT_IN", "Điều chỉnh tăng"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT", "Điều chỉnh giảm"
    ADJUSTMENT = "ADJUSTMENT", "Điều chỉnh hỗn hợp"
    ASSEMBLY = "ASSEMBLY", "Lắp ráp/Tháo dỡ"


class ValuationMethod(models.TextChoices):
    PERIODIC_AVERAGE = "PERIODIC_AVERAGE", "Bình quân gia quyền cuối kỳ"
    MOVING_AVERAGE = "MOVING_AVERAGE", "Bình quân liên hoàn"
    FIFO = "FIFO", "Nhập trước xuất trước"
    SPECIFIC = "SPECIFIC", "Đích danh"


class InventoryPolicy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="inventory_policies")
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, related_name="inventory_policies")
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, related_name="inventory_policies")
    base_uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    track_lot = models.BooleanField(default=False)
    track_serial = models.BooleanField(default=False)
    track_expiry = models.BooleanField(default=False)
    allow_negative = models.BooleanField(default=False)
    valuation_method = models.CharField(max_length=30, choices=ValuationMethod.choices, default=ValuationMethod.MOVING_AVERAGE)
    minimum_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    maximum_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    threshold_action = models.CharField(max_length=10, choices=(("WARN", "Cảnh báo"), ("BLOCK", "Chặn")), default="WARN")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_policy"
        constraints = [
            models.UniqueConstraint(fields=("warehouse", "item"), condition=Q(is_active=True), name="uq_inv_active_policy"),
            models.CheckConstraint(condition=Q(minimum_quantity__gte=0), name="ck_inv_policy_min_nonnegative"),
            models.CheckConstraint(condition=Q(maximum_quantity__isnull=True) | Q(maximum_quantity__gte=models.F("minimum_quantity")), name="ck_inv_policy_thresholds"),
        ]

    def clean(self):
        errors = {}
        if self.warehouse_id and self.warehouse.company_id != self.company_id:
            errors["warehouse"] = "Kho phải thuộc cùng doanh nghiệp."
        if self.item_id and (self.item.company_id != self.company_id or not self.item.track_inventory or self.item.status != "ACTIVE"):
            errors["item"] = "Hàng hóa không hợp lệ hoặc không theo dõi tồn kho."
        if self.base_uom_id and self.item_id and self.base_uom_id != self.item.base_uom_id:
            errors["base_uom"] = "Đơn vị tồn kho phải là đơn vị cơ sở của hàng hóa."
        if errors:
            raise ValidationError(errors)


class LotSerial(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, related_name="inventory_lots")
    code = models.CharField(max_length=100)
    tracking_type = models.CharField(max_length=10, choices=(("LOT", "Lô"), ("SERIAL", "Serial")))
    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=(("ACTIVE", "Hoạt động"), ("BLOCKED", "Đã khóa"), ("EXPIRED", "Hết hạn")), default="ACTIVE")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_lot_serial"
        constraints = [models.UniqueConstraint(fields=("company", "item", "code"), name="uq_inv_lot_serial")]

    def clean(self):
        if self.item_id and self.item.company_id != self.company_id:
            raise ValidationError({"item": "Hàng hóa phải thuộc cùng doanh nghiệp."})
        if self.expiry_date and self.manufacture_date and self.expiry_date < self.manufacture_date:
            raise ValidationError({"expiry_date": "Hạn sử dụng không được trước ngày sản xuất."})


class StockBalance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, related_name="stock_balances")
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, related_name="stock_balances")
    location = models.ForeignKey("master_data.InventoryLocation", on_delete=models.PROTECT, null=True, blank=True)
    lot_serial = models.ForeignKey(LotSerial, on_delete=models.PROTECT, null=True, blank=True, related_name="balances")
    quantity = models.DecimalField(max_digits=22, decimal_places=6, default=0)
    reserved_quantity = models.DecimalField(max_digits=22, decimal_places=6, default=0)
    inventory_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    average_cost = models.DecimalField(max_digits=26, decimal_places=10, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_stock_balance"
        constraints = [
            models.UniqueConstraint(fields=("warehouse", "item", "location", "lot_serial"), name="uq_inv_stock_dimension"),
            models.CheckConstraint(condition=Q(reserved_quantity__gte=0), name="ck_inv_reserved_nonnegative"),
        ]

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity


class InventoryTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="inventory_transactions")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_transactions")
    supplier = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_receipts")
    number = models.CharField(max_length=80)
    transaction_type = models.CharField(max_length=30, choices=TransactionType.choices)
    transaction_date = models.DateField()
    document_date = models.DateField(null=True, blank=True)
    delivery_person = models.CharField(max_length=255, blank=True)
    source_warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_transactions_out")
    destination_warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_transactions_in")
    original_transaction = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="follow_up_transactions")
    source_module = models.CharField(max_length=20, blank=True)
    source_reference = models.CharField(max_length=100, blank=True)
    idempotency_key = models.CharField(max_length=150, null=True, blank=True, unique=True)
    reason = models.CharField(max_length=500, blank=True)
    document_metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=30, choices=TransactionStatus.choices, default=TransactionStatus.DRAFT)
    workflow_snapshot = models.JSONField(default=dict, blank=True)
    inventory_applied = models.BooleanField(default=False)
    total_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    warnings = models.JSONField(default=list, blank=True)
    gl_status = models.CharField(max_length=20, choices=(("NOT_REQUIRED", "Không yêu cầu"), ("PENDING", "Chờ hạch toán"), ("POSTED", "Đã hạch toán"), ("ERROR", "Lỗi")), default="PENDING")
    gl_reference = models.CharField(max_length=100, blank=True)
    journal_entry = models.ForeignKey("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="other_inventory_receipts")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="inventory_transactions_created")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    reversed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_transaction"
        ordering = ("-transaction_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_inv_transaction_number")]

    def clean(self):
        incoming = self.transaction_type in {TransactionType.RECEIPT, TransactionType.RETURN, TransactionType.ADJUSTMENT_IN}
        outgoing = self.transaction_type in {TransactionType.ISSUE, TransactionType.ADJUSTMENT_OUT}
        if incoming and not self.destination_warehouse_id:
            raise ValidationError({"destination_warehouse": "Giao dịch nhập phải có kho đích."})
        if outgoing and not self.source_warehouse_id:
            raise ValidationError({"source_warehouse": "Giao dịch xuất phải có kho nguồn."})
        if self.transaction_type == TransactionType.TRANSFER and (not self.source_warehouse_id or not self.destination_warehouse_id or self.source_warehouse_id == self.destination_warehouse_id):
            raise ValidationError("Điều chuyển phải có hai kho nguồn/đích khác nhau.")
        if self.transaction_type == TransactionType.RETURN and not self.original_transaction_id:
            raise ValidationError({"original_transaction": "Nhập lại phải tham chiếu giao dịch xuất."})


class InventoryTransactionLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = models.ForeignKey(InventoryTransaction, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    source_warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_issue_lines")
    destination_warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_transfer_in_lines")
    sale_line = models.ForeignKey("sales.GoodsSaleLine", on_delete=models.PROTECT, null=True, blank=True, related_name="separate_issue_lines")
    uom = models.ForeignKey("master_data.UnitOfMeasure", on_delete=models.PROTECT)
    debit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_receipt_debits")
    credit_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_receipt_credits")
    location = models.ForeignKey("master_data.InventoryLocation", on_delete=models.PROTECT, null=True, blank=True)
    destination_location = models.ForeignKey("master_data.InventoryLocation", on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_destination_lines")
    lot_serial = models.ForeignKey(LotSerial, on_delete=models.PROTECT, null=True, blank=True)
    movement_direction = models.CharField(max_length=3, choices=(("IN", "Nhập"), ("OUT", "Xuất")), blank=True)
    quantity = models.DecimalField(max_digits=22, decimal_places=6)
    conversion_factor = models.DecimalField(max_digits=20, decimal_places=8, default=1)
    base_quantity = models.DecimalField(max_digits=22, decimal_places=6, default=0)
    unit_cost = models.DecimalField(max_digits=26, decimal_places=10, default=0)
    line_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    costing_status = models.CharField(max_length=12, choices=(("PENDING", "Chưa tính giá"),
        ("COMPLETED", "Đã tính giá")), blank=True, default="")
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "inv_transaction_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("transaction", "line_no"), name="uq_inv_transaction_line_no"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_inv_line_quantity_positive"),
            models.CheckConstraint(condition=Q(conversion_factor__gt=0), name="ck_inv_line_factor_positive"),
            models.CheckConstraint(condition=Q(unit_cost__gte=0), name="ck_inv_line_cost_nonnegative"),
        ]


class StockMovement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    transaction = models.ForeignKey(InventoryTransaction, on_delete=models.PROTECT, related_name="movements")
    line = models.ForeignKey(InventoryTransactionLine, on_delete=models.PROTECT, related_name="movements")
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, related_name="stock_movements")
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    location = models.ForeignKey("master_data.InventoryLocation", on_delete=models.PROTECT, null=True, blank=True)
    lot_serial = models.ForeignKey(LotSerial, on_delete=models.PROTECT, null=True, blank=True)
    movement_date = models.DateField()
    quantity_delta = models.DecimalField(max_digits=22, decimal_places=6)
    value_delta = models.DecimalField(max_digits=24, decimal_places=4)
    balance_quantity = models.DecimalField(max_digits=22, decimal_places=6)
    balance_value = models.DecimalField(max_digits=24, decimal_places=4)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_stock_movement"
        ordering = ("movement_date", "created_at")


class StockCount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=80)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, related_name="stock_counts")
    count_date = models.DateField()
    snapshot_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=(("DRAFT", "Nháp"), ("COUNTED", "Đã kiểm kê"), ("ADJUSTED", "Đã điều chỉnh"), ("CANCELLED", "Đã hủy")), default="DRAFT")
    notes = models.TextField(blank=True)
    adjustment_transaction = models.OneToOneField(InventoryTransaction, on_delete=models.PROTECT, null=True, blank=True, related_name="stock_count")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_stock_count"
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_inv_stock_count_number")]


class InventoryPeriod(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="inventory_periods")
    code = models.CharField(max_length=30)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=10, choices=(("OPEN", "Mở"), ("CLOSED", "Đóng")), default="OPEN")

    class Meta:
        db_table = "inv_period"
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_inv_period_code"),
            models.CheckConstraint(condition=Q(end_date__gte=models.F("start_date")), name="ck_inv_period_dates"),
        ]


class StockCountLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stock_count = models.ForeignKey(StockCount, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    location = models.ForeignKey("master_data.InventoryLocation", on_delete=models.PROTECT, null=True, blank=True)
    lot_serial = models.ForeignKey(LotSerial, on_delete=models.PROTECT, null=True, blank=True)
    system_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    actual_quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    variance_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "inv_stock_count_line"


class CountResolution(models.Model):
    """A separately approved treatment of part of one confirmed count variance."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    count_line = models.ForeignKey(StockCountLine, on_delete=models.PROTECT, related_name="resolutions")
    reason_code = models.CharField(max_length=32)
    explanation = models.TextField()
    method = models.CharField(max_length=20, choices=(("INCREASE", "Tăng tồn"), ("DECREASE", "Giảm tồn"), ("WAIT", "Chờ xử lý")))
    quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    proposed_unit_cost = models.DecimalField(max_digits=26, decimal_places=10, default=0)
    valuation_basis = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=(("DRAFT", "Nháp"), ("PENDING", "Chờ duyệt"),
        ("NEEDS_INFO", "Cần bổ sung"), ("APPROVED", "Đã duyệt"), ("REJECTED", "Từ chối"),
        ("COMPLETED", "Đã xử lý")), default="DRAFT")
    decision_note = models.TextField(blank=True)
    adjustment_transaction = models.OneToOneField(InventoryTransaction, on_delete=models.PROTECT,
        null=True, blank=True, related_name="count_resolution")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="count_resolutions_created")
    approved_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True,
        related_name="count_resolutions_approved")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_count_resolution"


class AssemblyOrder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=80)
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT)
    assembly_date = models.DateField()
    operation = models.CharField(max_length=20, choices=(("ASSEMBLE", "Lắp ráp"), ("DISASSEMBLE", "Tháo dỡ")), default="ASSEMBLE")
    status = models.CharField(max_length=20, choices=(("DRAFT", "Nháp"), ("POSTED", "Đã ghi nhận"), ("CANCELLED", "Đã hủy")), default="DRAFT")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_assembly_order"
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_inv_assembly_number")]


class AssemblyLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assembly = models.ForeignKey(AssemblyOrder, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    role = models.CharField(max_length=20, choices=(("COMPONENT", "Thành phần"), ("OUTPUT", "Thành phẩm")))
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    lot_serial = models.ForeignKey(LotSerial, on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=4)
    unit_cost = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    class Meta:
        db_table = "inv_assembly_line"
        constraints = [
            models.UniqueConstraint(fields=("assembly", "line_no"), name="uq_inv_assembly_line_no"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="ck_inv_assembly_qty_positive"),
        ]


class ValuationRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    valuation_date = models.DateField()
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, null=True, blank=True)
    method = models.CharField(max_length=30, choices=ValuationMethod.choices)
    total_quantity = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    total_value = models.DecimalField(max_digits=24, decimal_places=4, default=0)
    status = models.CharField(max_length=20, choices=(("COMPLETED", "Hoàn tất"), ("FAILED", "Lỗi")), default="COMPLETED")
    details = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_valuation_run"


class ApprovalDecision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="inventory_approval_decisions")
    transaction = models.ForeignKey(InventoryTransaction, on_delete=models.CASCADE, related_name="approval_decisions")
    level = models.PositiveSmallIntegerField(default=0)
    decision = models.CharField(max_length=20, choices=(("SUBMITTED", "Gửi duyệt"), ("APPROVED", "Duyệt"), ("REJECTED", "Từ chối")))
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="inventory_approval_decisions")
    comment = models.CharField(max_length=500, blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_approval_decision"


class ProductionOrder(models.Model):
    """Lệnh sản xuất: finished goods to make and the materials they use; stock moves via issue/receipt vouchers."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="production_orders")
    number = models.CharField(max_length=80)
    document_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=(
        ("PLANNED", "Chưa thực hiện"), ("IN_PROGRESS", "Đang thực hiện"), ("COMPLETED", "Hoàn thành"), ("CANCELLED", "Đã hủy"),
    ), default="IN_PROGRESS")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="production_orders")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inv_production_order"
        ordering = ("-document_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "number"), name="uq_inv_production_order_number")]


class ProductionOrderLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name="lines")
    role = models.CharField(max_length=10, choices=(("PRODUCT", "Thành phẩm"), ("MATERIAL", "Nguyên vật liệu")))
    line_no = models.PositiveIntegerField()
    item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "inv_production_order_line"
        ordering = ("role", "line_no")
