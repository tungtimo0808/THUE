import hashlib
import uuid

from django.core.exceptions import ValidationError
from django.db import models


class ActorType(models.TextChoices):
    USER = "USER", "Người dùng"
    SYSTEM = "SYSTEM", "Hệ thống"
    SERVICE = "SERVICE", "Dịch vụ nền"
    INTEGRATION = "INTEGRATION", "Hệ thống tích hợp"


class EventCategory(models.TextChoices):
    AUTHENTICATION = "AUTHENTICATION", "Xác thực"
    USER_MANAGEMENT = "USER_MANAGEMENT", "Quản lý người dùng"
    PERMISSION = "PERMISSION", "Phân quyền"
    CONFIGURATION = "CONFIGURATION", "Cấu hình hệ thống"
    MASTER_DATA = "MASTER_DATA", "Danh mục"
    DOCUMENT = "DOCUMENT", "Chứng từ"
    APPROVAL = "APPROVAL", "Phê duyệt"
    POSTING = "POSTING", "Ghi sổ"
    PERIOD_CONTROL = "PERIOD_CONTROL", "Kiểm soát kỳ"
    REPORT_EXPORT = "REPORT_EXPORT", "Báo cáo & Export"
    INTEGRATION = "INTEGRATION", "Tích hợp"
    AI_USAGE = "AI_USAGE", "Sử dụng AI"
    SECURITY = "SECURITY", "Bảo mật"


class AuditResult(models.TextChoices):
    SUCCESS = "SUCCESS", "Thành công"
    FAILURE = "FAILURE", "Thất bại"
    DENIED = "DENIED", "Bị từ chối"
    PARTIAL = "PARTIAL", "Thành công một phần"
    CANCELLED = "CANCELLED", "Đã hủy"


class AuditSeverity(models.TextChoices):
    INFO = "INFO", "Thông tin"
    WARNING = "WARNING", "Cảnh báo"
    HIGH = "HIGH", "Ảnh hưởng lớn"
    CRITICAL = "CRITICAL", "Nghiêm trọng"


class AuditSource(models.TextChoices):
    WEB = "WEB", "Giao diện Web"
    API = "API", "Giao diện API"
    IMPORT = "IMPORT", "Nhập khẩu dữ liệu"
    INTEGRATION = "INTEGRATION", "Hệ thống tích hợp"
    JOB = "JOB", "Tiến trình nền"
    AI = "AI", "Trợ lý AI"


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="audit_logs")
    branch = models.ForeignKey("organization.Branch", on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    actor_user = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="audit_logs")
    actor_type = models.CharField(max_length=20, choices=ActorType.choices, default=ActorType.USER)
    actor_name_snapshot = models.CharField(max_length=255, blank=True)
    role_assignment = models.ForeignKey("iam.UserRoleAssignment", on_delete=models.PROTECT, null=True, blank=True, related_name="audit_logs")

    module_code = models.CharField(max_length=30)
    event_category = models.CharField(max_length=30, choices=EventCategory.choices, default=EventCategory.DOCUMENT)
    action_code = models.CharField(max_length=50)

    entity_type = models.CharField(max_length=100)
    entity_id = models.UUIDField(null=True, blank=True)
    resource_code = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)

    result = models.CharField(max_length=20, choices=AuditResult.choices, default=AuditResult.SUCCESS)
    failure_reason = models.TextField(blank=True)
    severity = models.CharField(max_length=20, choices=AuditSeverity.choices, default=AuditSeverity.INFO)
    source = models.CharField(max_length=20, choices=AuditSource.choices, default=AuditSource.WEB)

    request_id = models.CharField(max_length=100, blank=True)
    correlation_id = models.CharField(max_length=100, blank=True)
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.TextField(blank=True)
    reason = models.TextField(blank=True)

    is_archived = models.BooleanField(default=False)
    integrity_hash = models.CharField(max_length=64, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_audit_log"
        ordering = ("-occurred_at",)
        indexes = [
            models.Index(fields=("company", "occurred_at"), name="idx_audit_company_time"),
            models.Index(fields=("entity_type", "entity_id", "occurred_at"), name="idx_audit_entity_time"),
            models.Index(fields=("company", "event_category", "occurred_at"), name="idx_audit_cat_time"),
            models.Index(fields=("company", "correlation_id"), name="idx_audit_correlation"),
            models.Index(fields=("company", "resource_code"), name="idx_audit_res_code"),
        ]

    def compute_integrity_hash(self):
        """Compute SHA256 integrity hash over key fields (BR-AUD-44)."""
        time_str = self.occurred_at.isoformat() if self.occurred_at else ""
        content = (
            f"{self.company_id}|{time_str}|{self.actor_user_id}|"
            f"{self.module_code}|{self.action_code}|{self.entity_type}|{self.entity_id}|"
            f"{self.result}|{self.reason}|{self.resource_code}"
        )
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def verify_integrity(self):
        """Validate stored hash against expected hash (BR-AUD-44, 45, EF-14)."""
        if not self.integrity_hash:
            return True, "Chưa tạo mã băm toàn vẹn"
        expected = self.compute_integrity_hash()
        is_valid = (expected == self.integrity_hash)
        msg = "Toàn vẹn dữ liệu hợp lệ" if is_valid else "Phát hiện sai lệch mã băm toàn vẹn (EF-14, BR-AUD-45)"
        return is_valid, msg

    def delete(self, *args, **kwargs):
        """Audit Log is strictly append-only and cannot be deleted via business operations (BR-AUD-07, 08)."""
        raise ValidationError("Audit Log là bản ghi kiểm toán bất biến (Append-only) và không được phép xóa (BR-AUD-07, 08).")

    def save(self, *args, **kwargs):
        if not self.actor_name_snapshot and self.actor_user_id:
            try:
                self.actor_name_snapshot = self.actor_user.display_name or str(self.actor_user)
            except Exception:
                pass
        super().save(*args, **kwargs)
        if not self.integrity_hash:
            self.integrity_hash = self.compute_integrity_hash()
            AuditLog.objects.filter(pk=self.pk).update(integrity_hash=self.integrity_hash)

    def __str__(self):
        return f"[{self.occurred_at}] {self.actor_name_snapshot or self.actor_user} - {self.action_code} on {self.entity_type} ({self.result})"


class AuditChange(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    audit_log = models.ForeignKey(AuditLog, on_delete=models.PROTECT, related_name="changes")
    field_name = models.CharField(max_length=150)
    old_value_json = models.JSONField(null=True, blank=True)
    new_value_json = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "audit_audit_change"
        ordering = ("field_name",)

    def delete(self, *args, **kwargs):
        raise ValidationError("Chi tiết thay đổi Audit Log không được phép xóa (BR-AUD-07, 08).")

    def __str__(self):
        return f"{self.field_name}: {self.old_value_json} -> {self.new_value_json}"


class LoginLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="login_logs")
    username_or_email = models.CharField(max_length=255, blank=True)
    login_result = models.CharField(max_length=20)
    failure_reason = models.CharField(max_length=255, blank=True)
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.TextField(blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_login_log"
        ordering = ("-occurred_at",)


class SecurityEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, null=True, blank=True, related_name="security_events")
    user = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="security_events")
    event_type = models.CharField(max_length=80)
    severity = models.CharField(max_length=20)
    event_detail_json = models.JSONField(null=True, blank=True)
    ip_address = models.CharField(max_length=64, blank=True)
    request_id = models.CharField(max_length=100, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_security_event"
        ordering = ("-occurred_at",)
