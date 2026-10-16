import uuid

from django.db import models
from django.db.models import Q


class ApprovalPolicy(models.TextChoices):
    NOT_REQUIRED = "NOT_REQUIRED", "Không cần duyệt"
    OPTIONAL = "OPTIONAL", "Tùy chọn"
    REQUIRED = "REQUIRED", "Bắt buộc"


class DocumentApprovalPolicy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="approval_policies")
    document_type = models.ForeignKey("master_data.DocumentType", on_delete=models.PROTECT)
    policy = models.CharField(max_length=20, choices=ApprovalPolicy.choices)
    updated_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wf_document_policy"
        constraints = [models.UniqueConstraint(fields=("company", "document_type"), name="uq_wf_policy_company_doc")]


class Workflow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="approval_workflows")
    document_type = models.ForeignKey("master_data.DocumentType", on_delete=models.PROTECT)
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.IntegerField(default=0)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="created_workflows")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wf_workflow"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_wf_company_code")]


class WorkflowVersion(models.Model):
    class State(models.TextChoices):
        DRAFT = "DRAFT", "Bản nháp"
        SCHEDULED = "SCHEDULED", "Chờ hiệu lực"
        ACTIVE = "ACTIVE", "Đang áp dụng"
        INACTIVE = "INACTIVE", "Ngừng áp dụng"
        ARCHIVED = "ARCHIVED", "Lưu trữ"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(Workflow, on_delete=models.PROTECT, related_name="versions")
    number = models.PositiveIntegerField()
    name = models.CharField(max_length=255, default="")
    description = models.TextField(blank=True)
    priority = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=State.choices, default=State.DRAFT)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    conditions = models.JSONField(default=dict, blank=True)
    steps = models.JSONField(default=list, blank=True)
    allow_self_approval = models.BooleanField(default=False)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="created_workflow_versions")
    activated_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="activated_workflow_versions")
    activated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wf_workflow_version"
        ordering = ("workflow_id", "-number")
        constraints = [
            models.UniqueConstraint(fields=("workflow", "number"), name="uq_wf_version_number"),
            models.CheckConstraint(condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")), name="ck_wf_version_dates"),
        ]


class ApprovalRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT)
    document_type = models.ForeignKey("master_data.DocumentType", on_delete=models.PROTECT)
    source_model = models.CharField(max_length=100)
    source_id = models.UUIDField()
    round_number = models.PositiveIntegerField()
    workflow_version = models.ForeignKey(WorkflowVersion, on_delete=models.PROTECT)
    snapshot = models.JSONField(default=dict)
    document_fingerprint = models.CharField(max_length=64, blank=True)
    submitted_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    status = models.CharField(max_length=30, default="PENDING_APPROVAL")
    current_step = models.PositiveSmallIntegerField(default=1)
    cycle = models.PositiveIntegerField(default=1)
    submitted_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wf_approval_request"
        constraints = [models.UniqueConstraint(fields=("source_model", "source_id", "round_number"), name="uq_wf_request_round")]
        indexes = [models.Index(fields=("company", "status", "submitted_at"), name="ix_wf_request_inbox")]


class ApprovalTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(ApprovalRequest, on_delete=models.PROTECT, related_name="tasks")
    step_order = models.PositiveSmallIntegerField()
    cycle = models.PositiveIntegerField(default=1)
    assignee = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="approval_tasks", null=True, blank=True)
    status = models.CharField(max_length=24, default="PENDING")
    version = models.PositiveIntegerField(default=1)
    due_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    delegated_from = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="delegated_tasks")
    forwarded_to = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="forwarded_tasks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wf_approval_task"
        constraints = [models.UniqueConstraint(fields=("request", "step_order", "cycle", "assignee"), name="uq_wf_task_assignment")]
        indexes = [models.Index(fields=("assignee", "status", "due_at"), name="ix_wf_task_inbox")]


class ApprovalEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(ApprovalRequest, on_delete=models.PROTECT, related_name="events")
    task = models.ForeignKey(ApprovalTask, on_delete=models.PROTECT, null=True, blank=True)
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    delegated_from = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="delegated_events")
    action = models.CharField(max_length=30)
    comment = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wf_approval_event"
        ordering = ("created_at", "pk")


class ApprovalNotification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(ApprovalRequest, on_delete=models.PROTECT)
    recipient = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT)
    event = models.CharField(max_length=30)
    status = models.CharField(max_length=20, default="PENDING")
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "wf_approval_notification"


class ApprovalDelegation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="approval_delegations")
    delegator = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="granted_delegations")
    delegate = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="received_delegations")
    document_type = models.ForeignKey("master_data.DocumentType", on_delete=models.PROTECT, null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wf_approval_delegation"
        ordering = ("-created_at",)
