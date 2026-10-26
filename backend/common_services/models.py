import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class VerificationChallenge(models.Model):
    class Purpose(models.TextChoices):
        REGISTER = "REGISTER", "Đăng ký"
        PASSWORD_RESET = "PASSWORD_RESET", "Khôi phục mật khẩu"
        CHANGE_EMAIL = "CHANGE_EMAIL", "Đổi email"
        CHANGE_PHONE = "CHANGE_PHONE", "Đổi số điện thoại"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="verification_challenges")
    identifier = models.CharField(max_length=255)
    purpose = models.CharField(max_length=30, choices=Purpose.choices)
    code_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    requested_ip = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "com_verification_challenge"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("identifier", "purpose", "created_at"), name="ix_com_verify_lookup")]


class CoreCompanySetting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.OneToOneField("organization.Company", on_delete=models.CASCADE, related_name="core_setting")
    require_account_verification = models.BooleanField(default=True)
    notification_retention_days = models.PositiveIntegerField(default=365)
    minimum_search_length = models.PositiveSmallIntegerField(default=2)
    ai_enabled = models.BooleanField(default=False)
    configuration = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_company_setting"


class ModuleCategory(models.TextChoices):
    SYSTEM_REQUIRED = "SYSTEM_REQUIRED", "Nền tảng bắt buộc"
    CORE = "CORE", "Kế toán cốt lõi"
    OPTIONAL = "OPTIONAL", "Nghiệp vụ mở rộng"
    AI_ASSISTED = "AI_ASSISTED", "Hỗ trợ AI"
    INTEGRATION = "INTEGRATION", "Kết nối bên ngoài"


class ModuleStatus(models.TextChoices):
    NOT_CONFIGURED = "NOT_CONFIGURED", "Chưa cấu hình"
    ENABLING = "ENABLING", "Đang kích hoạt"
    ENABLED = "ENABLED", "Đang sử dụng"
    DISABLING = "DISABLING", "Đang ngừng sử dụng"
    DISABLED = "DISABLED", "Đã ngừng sử dụng"
    ERROR = "ERROR", "Lỗi cấu hình"


class ModuleCatalog(models.Model):
    code = models.CharField(max_length=40, primary_key=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=30, choices=ModuleCategory.choices, default=ModuleCategory.OPTIONAL)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=60, blank=True)
    dependencies = models.JSONField(default=list, blank=True)
    menu_group = models.CharField(max_length=60, blank=True)
    default_config = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_module_catalog"
        ordering = ("display_order", "code")

    def __str__(self):
        return f"{self.code} - {self.name}"


class CompanyModuleConfig(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="module_configs")
    module = models.ForeignKey(ModuleCatalog, on_delete=models.PROTECT, related_name="company_configs")
    status = models.CharField(max_length=30, choices=ModuleStatus.choices, default=ModuleStatus.NOT_CONFIGURED)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    configuration = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="updated_module_configs")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_company_module_config"
        ordering = ("module__display_order", "module__code")
        constraints = [
            models.UniqueConstraint(fields=("company", "module"), name="uq_com_company_module")
        ]


class CompanyJoinRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Chờ xử lý"
        APPROVED = "APPROVED", "Đã duyệt"
        REJECTED = "REJECTED", "Từ chối"
        CANCELLED = "CANCELLED", "Đã hủy"
        EXPIRED = "EXPIRED", "Đã hết hạn"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="join_requests")
    requester = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="company_join_requests")
    message = models.CharField(max_length=1000, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    decision_reason = models.CharField(max_length=1000, blank=True)
    internal_note = models.TextField(blank=True)
    decision_snapshot = models.JSONField(default=dict, blank=True)
    decided_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="company_join_requests_decided")
    decided_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_company_join_request"
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(fields=("company", "requester"), condition=models.Q(status="PENDING"), name="uq_com_pending_join_request")]


class CompanyInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="invitations")
    code_hash = models.CharField(max_length=255)
    code_hint = models.CharField(max_length=8, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    auto_approve = models.BooleanField(default=False)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    use_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "com_company_invitation"
        ordering = ("-created_at",)


class UserPreference(models.Model):
    user = models.OneToOneField("iam.UserAccount", on_delete=models.CASCADE, primary_key=True, related_name="preference")
    current_company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, null=True, blank=True, related_name="active_user_preferences")
    normalized_email = models.EmailField(null=True, blank=True, unique=True)
    current_branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="active_user_preferences")
    all_branches = models.BooleanField(default=False)
    avatar = models.FileField(upload_to="avatars/%Y/%m/", blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    terms_version = models.CharField(max_length=40, blank=True)
    privacy_version = models.CharField(max_length=40, blank=True)
    locale = models.CharField(max_length=20, default="vi-VN")
    timezone = models.CharField(max_length=80, default="Asia/Ho_Chi_Minh")
    settings = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_user_preference"


class UserSessionState(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True, related_name="common_session_state")
    valid_after_epoch = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_user_session_state"


class UserLoginSession(models.Model):
    """A revocable login session shared by one refresh/access token family."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="common_login_sessions")
    refresh_jti = models.CharField(max_length=255, blank=True)
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.TextField(blank=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=80, blank=True)
    password_check_failures = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_user_login_session"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("user", "revoked_at", "expires_at"), name="ix_com_login_session_user")]


class Notification(models.Model):
    class Level(models.TextChoices):
        INFO = "INFO", "Thông tin"
        SUCCESS = "SUCCESS", "Thành công"
        WARNING = "WARNING", "Cảnh báo"
        IMPORTANT = "IMPORTANT", "Quan trọng"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey("iam.UserAccount", on_delete=models.CASCADE, related_name="notifications")
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.CharField(max_length=2000)
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.INFO)
    source_module = models.CharField(max_length=30, blank=True)
    entity_type = models.CharField(max_length=100, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    permission_code = models.CharField(max_length=160, blank=True)
    link = models.CharField(max_length=500, blank=True)
    event_key = models.CharField(max_length=160, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    hidden_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "com_notification"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("recipient", "company", "read_at", "created_at"), name="ix_com_notification_user")]
        constraints = [
            models.UniqueConstraint(
                fields=("recipient", "event_key"),
                condition=~models.Q(event_key=""),
                name="uq_com_notification_event",
            )
        ]


class WorkItem(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Chờ xử lý"
        IN_PROGRESS = "IN_PROGRESS", "Đang xử lý"
        OVERDUE = "OVERDUE", "Quá hạn"
        COMPLETED = "COMPLETED", "Hoàn thành"
        CANCELLED = "CANCELLED", "Đã hủy"
        REASSIGNED = "REASSIGNED", "Đã phân công lại"

    class Priority(models.TextChoices):
        NORMAL = "NORMAL", "Bình thường"
        HIGH = "HIGH", "Cao"
        URGENT = "URGENT", "Khẩn cấp"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="work_items")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="work_items")
    assignee = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="assigned_work_items")
    assignee_role = models.ForeignKey("iam.Role", on_delete=models.PROTECT, null=True, blank=True, related_name="assigned_work_items")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="created_work_items")
    title = models.CharField(max_length=255)
    task_type = models.CharField(max_length=80)
    entity_type = models.CharField(max_length=100)
    entity_id = models.UUIDField()
    reference_code = models.CharField(max_length=120, blank=True)
    permission_code = models.CharField(max_length=160)
    action_code = models.CharField(max_length=80, blank=True)
    link = models.CharField(max_length=500, blank=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    due_at = models.DateTimeField(null=True, blank=True)
    dedupe_key = models.CharField(max_length=255, unique=True)
    metadata = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_work_item"
        ordering = ("status", "due_at", "-created_at")
        indexes = [
            models.Index(fields=("company", "assignee", "status", "due_at"), name="ix_com_task_assignee"),
            models.Index(fields=("company", "branch", "status"), name="ix_com_task_scope"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(assignee__isnull=False) | models.Q(assignee_role__isnull=False)),
                name="ck_com_task_has_assignee",
            )
        ]


class WorkItemHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    work_item = models.ForeignKey(WorkItem, on_delete=models.CASCADE, related_name="history")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    actor = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="work_item_history")
    reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "com_work_item_history"
        ordering = ("created_at",)


class AIConversation(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Đang hoạt động"
        CLOSED = "CLOSED", "Đã kết thúc"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="ai_conversations")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="ai_conversations")
    user = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ai_conversations")
    title = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_ai_conversation"
        ordering = ("-updated_at",)


class AIInteraction(models.Model):
    class Status(models.TextChoices):
        COMPLETED = "COMPLETED", "Hoàn thành"
        INSUFFICIENT_DATA = "INSUFFICIENT_DATA", "Không đủ dữ liệu"
        DENIED = "DENIED", "Không đủ quyền"
        UNAVAILABLE = "UNAVAILABLE", "Không khả dụng"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="ai_interactions")
    user = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ai_interactions")
    conversation = models.ForeignKey(AIConversation, on_delete=models.CASCADE, null=True, blank=True, related_name="interactions")
    parent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="follow_ups")
    question = models.TextField()
    context = models.JSONField(default=dict, blank=True)
    answer = models.TextField(blank=True)
    sources = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=30, choices=Status.choices)
    is_ai_generated = models.BooleanField(default=True)
    request_key = models.CharField(max_length=100, blank=True)
    request_type = models.CharField(max_length=40, default="ANALYSIS")
    scope_snapshot = models.JSONField(default=dict, blank=True)
    disclaimer = models.CharField(max_length=500, default="Kết quả AI cần được kiểm tra trước khi sử dụng cho nghiệp vụ kế toán hoặc thuế.")
    processing_ms = models.PositiveIntegerField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "com_ai_interaction"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("user", "request_key"), condition=~models.Q(request_key=""),
                name="uq_com_ai_request_key",
            )
        ]


class AIFeedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    interaction = models.OneToOneField(AIInteraction, on_delete=models.CASCADE, related_name="feedback")
    user = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ai_feedback")
    helpful = models.BooleanField()
    comment = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "com_ai_feedback"


class NumberingMode(models.TextChoices):
    AUTO = "AUTO", "Tự động"
    MANUAL = "MANUAL", "Thủ công"
    HYBRID = "HYBRID", "Kết hợp"


class SequenceScope(models.TextChoices):
    COMPANY = "COMPANY", "Toàn doanh nghiệp"
    BRANCH = "BRANCH", "Theo chi nhánh"
    DOCUMENT_TYPE = "DOCUMENT_TYPE", "Theo loại chứng từ"
    BRANCH_DOCUMENT_TYPE = "BRANCH_DOCUMENT_TYPE", "Theo chi nhánh và loại chứng từ"
    ACCOUNTING_BOOK = "ACCOUNTING_BOOK", "Theo sổ kế toán"
    CUSTOM_SCOPE = "CUSTOM_SCOPE", "Tùy chỉnh"


class GenerationEvent(models.TextChoices):
    ON_CREATE = "ON_CREATE", "Khi tạo mới"
    ON_SAVE = "ON_SAVE", "Khi lưu lần đầu"
    ON_SUBMIT = "ON_SUBMIT", "Khi gửi duyệt"
    ON_APPROVE = "ON_APPROVE", "Khi phê duyệt"
    ON_POST = "ON_POST", "Khi ghi sổ"


class ResetCycle(models.TextChoices):
    NEVER = "NEVER", "Không đặt lại"
    YEARLY = "YEARLY", "Hàng năm"
    MONTHLY = "MONTHLY", "Hàng tháng"
    ACCOUNTING_PERIOD = "ACCOUNTING_PERIOD", "Theo kỳ kế toán"


class DateSource(models.TextChoices):
    DOCUMENT_DATE = "DOCUMENT_DATE", "Ngày chứng từ"
    SYSTEM_DATE = "SYSTEM_DATE", "Ngày hệ thống"


class OverflowStrategy(models.TextChoices):
    AUTO_EXPAND = "AUTO_EXPAND", "Tự mở rộng độ dài"
    BLOCK = "BLOCK", "Dừng cấp số và thông báo"


class NumberingRuleStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    SCHEDULED = "SCHEDULED", "Chờ hiệu lực"
    ACTIVE = "ACTIVE", "Đang áp dụng"
    INACTIVE = "INACTIVE", "Ngừng áp dụng"
    ARCHIVED = "ARCHIVED", "Lưu trữ"


class DocumentNumberingRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="sys_numbering_rules")
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    document_type = models.ForeignKey("master_data.DocumentType", on_delete=models.PROTECT, related_name="sys_numbering_rules")
    numbering_mode = models.CharField(max_length=20, choices=NumberingMode.choices, default=NumberingMode.AUTO)
    sequence_scope = models.CharField(max_length=30, choices=SequenceScope.choices, default=SequenceScope.COMPANY)
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="sys_numbering_rules")
    accounting_book = models.CharField(max_length=50, blank=True)
    custom_scope_key = models.CharField(max_length=100, blank=True)
    pattern = models.CharField(max_length=150, default="{Prefix}-{Year}-{Sequence:6}")
    prefix = models.CharField(max_length=30, blank=True)
    suffix = models.CharField(max_length=30, blank=True)
    separator = models.CharField(max_length=10, default="-", blank=True)
    start_number = models.PositiveIntegerField(default=1)
    padding_length = models.PositiveSmallIntegerField(default=6)
    increment_by = models.PositiveSmallIntegerField(default=1)
    reset_cycle = models.CharField(max_length=30, choices=ResetCycle.choices, default=ResetCycle.YEARLY)
    date_source = models.CharField(max_length=20, choices=DateSource.choices, default=DateSource.DOCUMENT_DATE)
    generation_event = models.CharField(max_length=20, choices=GenerationEvent.choices, default=GenerationEvent.ON_CREATE)
    overflow_strategy = models.CharField(max_length=20, choices=OverflowStrategy.choices, default=OverflowStrategy.AUTO_EXPAND)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=NumberingRuleStatus.choices, default=NumberingRuleStatus.DRAFT)
    version = models.PositiveIntegerField(default=1)
    previous_version = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="next_versions")
    deactivation_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="created_sys_numbering_rules")
    updated_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="updated_sys_numbering_rules")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sys_numbering_rule"
        ordering = ("-created_at", "code")
        constraints = [
            models.UniqueConstraint(fields=("company", "code", "version"), name="uq_sys_num_rule_code_version"),
        ]

    def __str__(self):
        return f"{self.code} v{self.version} ({self.name})"


class NumberingSequenceTracker(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="numbering_trackers")
    rule = models.ForeignKey(DocumentNumberingRule, on_delete=models.CASCADE, related_name="trackers")
    scope_key = models.CharField(max_length=120)
    period_key = models.CharField(max_length=50)
    current_number = models.BigIntegerField(default=0)
    last_issued_number = models.CharField(max_length=120, blank=True)
    last_issued_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sys_numbering_tracker"
        constraints = [
            models.UniqueConstraint(fields=("rule", "scope_key", "period_key"), name="uq_sys_num_tracker_scope_period"),
        ]

    def __str__(self):
        return f"{self.rule.code} [{self.scope_key}/{self.period_key}]: {self.current_number}"


class DocumentNumberHistory(models.Model):
    class Status(models.TextChoices):
        ISSUED = "ISSUED", "Đã cấp"
        CANCELLED = "CANCELLED", "Đã hủy"
        SKIPPED = "SKIPPED", "Bỏ qua"
        RESERVED = "RESERVED", "Giữ chỗ"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="numbering_history")
    rule = models.ForeignKey(DocumentNumberingRule, on_delete=models.SET_NULL, null=True, blank=True, related_name="history")
    document_type = models.ForeignKey("master_data.DocumentType", on_delete=models.PROTECT, related_name="numbering_history")
    document_number = models.CharField(max_length=120)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ISSUED)
    sequence_number = models.BigIntegerField(null=True, blank=True)
    entity_type = models.CharField(max_length=100, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    branch = models.ForeignKey("organization.Branch", on_delete=models.SET_NULL, null=True, blank=True)
    is_manual = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    issued_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True)
    issued_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sys_numbering_history"
        ordering = ("-issued_at",)
        indexes = [
            models.Index(fields=("company", "document_type", "document_number"), name="idx_sys_num_hist_lookup"),
            models.Index(fields=("company", "status"), name="idx_sys_num_hist_status"),
        ]

    def __str__(self):
        return f"{self.document_number} ({self.status})"


class FiscalYearType(models.TextChoices):
    CALENDAR_YEAR = "CALENDAR_YEAR", "Năm dương lịch"
    NON_CALENDAR_YEAR = "NON_CALENDAR_YEAR", "Khác năm dương lịch"
    SHORT_YEAR = "SHORT_YEAR", "Năm tài chính ngắn"
    CUSTOM_YEAR = "CUSTOM_YEAR", "Năm tài chính tùy chỉnh"


class PeriodStructure(models.TextChoices):
    MONTHLY = "MONTHLY", "Theo tháng"
    QUARTERLY = "QUARTERLY", "Theo quý"
    CUSTOM = "CUSTOM", "Tùy chỉnh"


class FiscalYearStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    ACTIVE = "ACTIVE", "Đang áp dụng"
    CLOSED = "CLOSED", "Đã đóng"
    ARCHIVED = "ARCHIVED", "Lưu trữ"


class FiscalPeriodType(models.TextChoices):
    MONTH = "MONTH", "Tháng"
    QUARTER = "QUARTER", "Quý"
    CUSTOM = "CUSTOM", "Tùy chỉnh"
    ADJUSTMENT = "ADJUSTMENT", "Điều chỉnh cuối năm"


class FiscalPeriodStatus(models.TextChoices):
    FUTURE = "FUTURE", "Chưa mở"
    OPEN = "OPEN", "Đang mở"
    SOFT_CLOSED = "SOFT_CLOSED", "Đóng tạm thời"
    LOCKED = "LOCKED", "Đã khóa"
    ARCHIVED = "ARCHIVED", "Lưu trữ"


class FiscalYear(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="fiscal_years")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    year_type = models.CharField(max_length=30, choices=FiscalYearType.choices, default=FiscalYearType.CALENDAR_YEAR)
    start_date = models.DateField()
    end_date = models.DateField()
    period_structure = models.CharField(max_length=20, choices=PeriodStructure.choices, default=PeriodStructure.MONTHLY)
    has_adjustment_period = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=FiscalYearStatus.choices, default=FiscalYearStatus.DRAFT)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="created_fiscal_years")
    updated_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="updated_fiscal_years")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sys_fiscal_year"
        ordering = ("-start_date", "code")
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_sys_fiscal_year_code"),
            models.CheckConstraint(condition=models.Q(end_date__gte=models.F("start_date")), name="ck_sys_fiscal_year_dates"),
        ]

    def __str__(self):
        return f"{self.code} ({self.name}) - {self.status}"


class FiscalPeriod(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="fiscal_periods")
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name="periods")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    period_number = models.PositiveSmallIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    period_type = models.CharField(max_length=20, choices=FiscalPeriodType.choices, default=FiscalPeriodType.MONTH)
    status = models.CharField(max_length=20, choices=FiscalPeriodStatus.choices, default=FiscalPeriodStatus.FUTURE)
    allow_adjustment = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    closed_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="closed_fiscal_periods")
    closed_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="locked_fiscal_periods")
    locked_at = models.DateTimeField(null=True, blank=True)
    reopened_by = models.ForeignKey("iam.UserAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="reopened_fiscal_periods")
    reopened_at = models.DateTimeField(null=True, blank=True)
    reopen_reason = models.TextField(blank=True)
    gl_period = models.ForeignKey("general_ledger.AccountingPeriod", on_delete=models.SET_NULL, null=True, blank=True, related_name="sys_fiscal_periods")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sys_fiscal_period"
        ordering = ("fiscal_year", "period_number")
        constraints = [
            models.UniqueConstraint(fields=("fiscal_year", "code"), name="uq_sys_fiscal_period_code"),
            models.UniqueConstraint(fields=("fiscal_year", "period_number"), name="uq_sys_fiscal_period_number"),
            models.CheckConstraint(condition=models.Q(end_date__gte=models.F("start_date")), name="ck_sys_fiscal_period_dates"),
        ]

    def __str__(self):
        return f"{self.code} ({self.name}) [{self.start_date} - {self.end_date}] - {self.status}"


class AccountingRegime(models.TextChoices):
    CIRCULAR_99 = "CIRCULAR_99", "Thông tư 99/2025/TT-BTC (Chế độ kế toán Doanh nghiệp)"
    TT99 = "TT99", "Thông tư 99/2025/TT-BTC"
    CIRCULAR_200 = "CIRCULAR_200", "Thông tư 200/2014/TT-BTC (Doanh nghiệp lớn)"
    CIRCULAR_133 = "CIRCULAR_133", "Thông tư 133/2016/TT-BTC (Doanh nghiệp vừa và nhỏ)"
    CIRCULAR_88 = "CIRCULAR_88", "Thông tư 88/2021/TT-BTC (Hộ kinh doanh / một người)"
    IFRS = "IFRS", "Chuẩn mực Báo cáo Tài chính Quốc tế"


class AccountingBasis(models.TextChoices):
    ACCRUAL = "ACCRUAL", "Kế toán dồn tích (Accrual)"
    CASH = "CASH", "Kế toán tiền mặt (Cash)"


class InventoryMethod(models.TextChoices):
    PERPETUAL = "PERPETUAL", "Kê khai thường xuyên"
    PERIODIC = "PERIODIC", "Kiểm kê định kỳ"


class InventoryValuationMethod(models.TextChoices):
    WEIGHTED_AVERAGE = "WEIGHTED_AVERAGE", "Bình quân gia quyền"
    FIFO = "FIFO", "Nhập trước xuất trước (FIFO)"
    SPECIFIC_IDENTIFICATION = "SPECIFIC_IDENTIFICATION", "Thực tế đích danh"


class DepreciationMethod(models.TextChoices):
    STRAIGHT_LINE = "STRAIGHT_LINE", "Khấu hao đường thẳng"
    DECLINING_BALANCE = "DECLINING_BALANCE", "Khấu hao số dư giảm dần"
    UNITS_OF_PRODUCTION = "UNITS_OF_PRODUCTION", "Khấu hao theo sản lượng"


class AllocationMethod(models.TextChoices):
    BY_MONTHS = "BY_MONTHS", "Phân bổ theo số tháng/kỳ"
    PERCENTAGE = "PERCENTAGE", "Phân bổ theo tỷ lệ %"
    VALUE_BASED = "VALUE_BASED", "Phân bổ theo giá trị"


class ExchangeRateSource(models.TextChoices):
    MANUAL = "MANUAL", "Nhập thủ công"
    VIETCOMBANK = "VIETCOMBANK", "Tích hợp Ngân hàng Vietcombank"
    STATE_BANK = "STATE_BANK", "Ngân hàng Nhà nước"
    CUSTOM_INTEGRATION = "CUSTOM_INTEGRATION", "Tích hợp tùy chỉnh"


class PostingMode(models.TextChoices):
    MANUAL = "MANUAL", "Ghi sổ thủ công"
    AUTO_ON_APPROVE = "AUTO_ON_APPROVE", "Ghi sổ tự động sau phê duyệt"
    AUTO_ON_SAVE = "AUTO_ON_SAVE", "Ghi sổ tự động khi lưu chứng từ hợp lệ"


class RoundingMethod(models.TextChoices):
    HALF_UP = "HALF_UP", "Làm tròn chuẩn (Half-Up)"
    ROUND_UP = "ROUND_UP", "Làm tròn lên (Ceiling)"
    ROUND_DOWN = "ROUND_DOWN", "Làm tròn xuống (Floor)"


class TaxCalculationMethod(models.TextChoices):
    DEDUCTION = "DEDUCTION", "Phương pháp khấu trừ"
    DIRECT = "DIRECT", "Phương pháp trực tiếp trên doanh thu"


class DebtTrackingMethod(models.TextChoices):
    CUSTOMER_VENDOR = "CUSTOMER_VENDOR", "Theo dõi theo đối tượng"
    INVOICE = "INVOICE", "Theo dõi theo hóa đơn"
    DUE_DATE = "DUE_DATE", "Theo dõi theo hạn thanh toán"


class PolicyScope(models.TextChoices):
    COMPANY = "COMPANY", "Toàn doanh nghiệp"
    BRANCH_OVERRIDE = "BRANCH_OVERRIDE", "Ghi đè cấp chi nhánh"
    MODULE = "MODULE", "Theo phân hệ"


class PolicyStatus(models.TextChoices):
    DRAFT = "DRAFT", "Bản nháp"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Chờ phê duyệt"
    SCHEDULED = "SCHEDULED", "Đã lập lịch (chờ hiệu lực)"
    ACTIVE = "ACTIVE", "Đang áp dụng"
    INACTIVE = "INACTIVE", "Ngừng áp dụng (phiên bản cũ)"
    ARCHIVED = "ARCHIVED", "Lưu trữ tra cứu"


class AccountingPolicy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.CASCADE, related_name="accounting_policies")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    version = models.PositiveIntegerField(default=1)
    previous_version = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="next_versions")
    scope = models.CharField(max_length=20, choices=PolicyScope.choices, default=PolicyScope.COMPANY)
    branch = models.ForeignKey("organization.Branch", on_delete=models.CASCADE, null=True, blank=True, related_name="accounting_policies")
    effective_from_period = models.ForeignKey("common_services.FiscalPeriod", on_delete=models.PROTECT, related_name="starting_policies")
    effective_to_period = models.ForeignKey("common_services.FiscalPeriod", on_delete=models.SET_NULL, null=True, blank=True, related_name="ending_policies")

    # General & Basis
    accounting_regime = models.CharField(max_length=30, choices=AccountingRegime.choices, default=AccountingRegime.CIRCULAR_133)
    accounting_basis = models.CharField(max_length=20, choices=AccountingBasis.choices, default=AccountingBasis.ACCRUAL)
    accounting_currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT, null=True, blank=True, related_name="policies_as_accounting")
    allow_multi_currency = models.BooleanField(default=False)
    exchange_rate_source = models.CharField(max_length=30, choices=ExchangeRateSource.choices, default=ExchangeRateSource.MANUAL)

    # Sub-modules
    inventory_accounting = models.CharField(max_length=20, choices=InventoryMethod.choices, default=InventoryMethod.PERPETUAL)
    inventory_valuation = models.CharField(max_length=30, choices=InventoryValuationMethod.choices, default=InventoryValuationMethod.WEIGHTED_AVERAGE)
    depreciation_method = models.CharField(max_length=30, choices=DepreciationMethod.choices, default=DepreciationMethod.STRAIGHT_LINE)
    allocation_method = models.CharField(max_length=30, choices=AllocationMethod.choices, default=AllocationMethod.BY_MONTHS)

    # Posting, Tax & Debt
    posting_mode = models.CharField(max_length=30, choices=PostingMode.choices, default=PostingMode.MANUAL)
    tax_method = models.CharField(max_length=20, choices=TaxCalculationMethod.choices, default=TaxCalculationMethod.DEDUCTION)
    debt_tracking = models.CharField(max_length=30, choices=DebtTrackingMethod.choices, default=DebtTrackingMethod.INVOICE)

    # Decimals & Rounding
    amount_decimals = models.PositiveSmallIntegerField(default=0)
    unit_price_decimals = models.PositiveSmallIntegerField(default=2)
    quantity_decimals = models.PositiveSmallIntegerField(default=2)
    exchange_rate_decimals = models.PositiveSmallIntegerField(default=2)
    rounding_method = models.CharField(max_length=20, choices=RoundingMethod.choices, default=RoundingMethod.HALF_UP)

    # Snapshot & Governance
    config_snapshot = models.JSONField(default=dict, blank=True)
    change_reason = models.TextField(blank=True)
    legal_basis = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=PolicyStatus.choices, default=PolicyStatus.DRAFT)

    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="created_accounting_policies")
    updated_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="updated_accounting_policies")
    approved_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="approved_accounting_policies")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "sys_accounting_policy"
        ordering = ("-created_at", "code", "-version")
        constraints = [
            models.UniqueConstraint(fields=("company", "code", "version"), name="uq_sys_accounting_policy_version"),
        ]

    def __str__(self):
        return f"{self.code} v{self.version} ({self.name}) - {self.status}"



