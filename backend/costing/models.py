import uuid

from django.db import models

OBJECT_TYPES = (("COST_CENTER", "Phân xưởng / trung tâm chi phí"), ("PROJECT", "Công trình"), ("ORDER", "Đơn hàng"), ("CONTRACT", "Hợp đồng"))
METHODS = (
    ("SIMPLE", "Sản xuất liên tục - Giản đơn"), ("COEFFICIENT", "Sản xuất liên tục - Hệ số, tỷ lệ"),
    ("STEP", "Sản xuất liên tục - Phân bước"), ("PROJECT", "Công trình"), ("ORDER", "Đơn hàng"), ("CONTRACT", "Hợp đồng"),
)
ELEMENTS = ("material", "labor", "overhead")


class CostObjectSetting(models.Model):
    """Norms of one cost object: coefficient, planned cost, material norms, estimate and opening work in progress."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="cost_object_settings")
    object_type = models.CharField(max_length=20, choices=OBJECT_TYPES)
    object_id = models.UUIDField()
    object_code = models.CharField(max_length=80)
    object_name = models.CharField(max_length=255)
    coefficient = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    planned_cost = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    opening_wip = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    material_norms = models.JSONField(default=list, blank=True)
    estimate = models.JSONField(default=dict, blank=True)
    finished_item = models.ForeignKey("master_data.Item", on_delete=models.PROTECT, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cost_object_setting"
        constraints = [models.UniqueConstraint(fields=("company", "object_type", "object_id"), name="uq_cost_object_setting")]


class CostAllocationSetting(models.Model):
    """Company allocation bases for shared labor and overhead."""
    company = models.OneToOneField("organization.Company", on_delete=models.CASCADE, related_name="cost_allocation_setting")
    labor_basis = models.CharField(max_length=20, default="AUTO")
    overhead_basis = models.CharField(max_length=20, default="AUTO")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cost_allocation_setting"


class CostPeriod(models.Model):
    class Status(models.TextChoices):
        CALCULATED = "CALCULATED", "Đã tính giá thành"
        TRANSFERRED = "TRANSFERRED", "Đã kết chuyển chi phí"
        ACCEPTED = "ACCEPTED", "Đã nghiệm thu / nhập kho"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="cost_periods")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    method = models.CharField(max_length=20, choices=METHODS)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CALCULATED)
    pools = models.JSONField(default=dict, blank=True)
    transfer_entry = models.ForeignKey("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="cost_transfers")
    acceptance_entry = models.ForeignKey("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="cost_acceptances")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="cost_periods")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cost_period"
        ordering = ("-end_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_cost_period_code")]


class CostPeriodObject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period = models.ForeignKey(CostPeriod, on_delete=models.CASCADE, related_name="cost_objects")
    object_type = models.CharField(max_length=20, choices=OBJECT_TYPES)
    object_id = models.UUIDField()
    object_code = models.CharField(max_length=80)
    object_name = models.CharField(max_length=255)
    output_quantity = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    coefficient = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    planned_cost = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    opening_wip = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    closing_wip = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    direct_cost = models.JSONField(default=dict, blank=True)
    allocated_cost = models.JSONField(default=dict, blank=True)
    total_cost = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    unit_cost = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    accepted = models.BooleanField(default=False)

    class Meta:
        db_table = "cost_period_object"
