import csv
from datetime import date, datetime, timedelta
from decimal import Decimal
import io
import json
from uuid import UUID

from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import (
    ActorType,
    AuditChange,
    AuditLog,
    AuditResult,
    AuditSeverity,
    AuditSource,
    EventCategory,
)

SENSITIVE_FIELD_PATTERNS = {
    "password", "secret", "token", "access_token", "refresh_token",
    "secret_key", "code_hash", "otp", "pin", "card_number", "cvv",
    "credit_card", "api_key", "auth_token", "private_key",
}


def is_sensitive_field(field_name: str) -> bool:
    """Check if a field name indicates sensitive/secret information (BR-AUD-22, 23)."""
    fn = str(field_name).lower().strip()
    if fn in SENSITIVE_FIELD_PATTERNS:
        return True
    return any(p in fn for p in ["password", "secret", "token", "code_hash", "card_number", "cvv", "otp"])


def mask_sensitive_value(field_name: str, value):
    """Mask sensitive values with asterisks (BR-AUD-22, 23, EF-09)."""
    if is_sensitive_field(field_name):
        return "******"
    if isinstance(value, dict):
        return {k: mask_sensitive_value(k, v) for k, v in value.items()}
    if isinstance(value, list):
        return [mask_sensitive_value(field_name, item) for item in value]
    return value


def _json_value(value):
    if isinstance(value, (UUID, date, datetime, Decimal)):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return value


def infer_event_category(module_code: str, action_code: str, entity_type: str = "") -> str:
    """Infer event category from module and action code (Section 1.3)."""
    act = action_code.upper()
    mod = module_code.upper()
    if "LOGIN" in act or "AUTH" in act or "LOGOUT" in act:
        return EventCategory.AUTHENTICATION
    if "USER" in act or "MEMBERSHIP" in act or "INVITATION" in act:
        return EventCategory.USER_MANAGEMENT
    if "ROLE" in act or "PERMISSION" in act or "SCOPE" in act:
        return EventCategory.PERMISSION
    if "APPROVE" in act or "REJECT" in act:
        return EventCategory.APPROVAL
    if "POST" in act or "UNPOST" in act or "REVERSE" in act:
        return EventCategory.POSTING
    if "PERIOD" in act or "FISCAL" in act or "CLOSE" in act or "LOCK" in act:
        return EventCategory.PERIOD_CONTROL
    if "EXPORT" in act or "REPORT" in act or "PRINT" in act:
        return EventCategory.REPORT_EXPORT
    if "AI" in act or "AI" in mod:
        return EventCategory.AI_USAGE
    if "CONFIG" in act or "MODULE" in act or "SETTING" in act or "POLICY" in act or "NUMBERING" in act:
        return EventCategory.CONFIGURATION
    if "MASTER" in mod or "MDM" in mod or "PARTY" in act or "CUSTOMER" in act:
        return EventCategory.MASTER_DATA
    return EventCategory.DOCUMENT


@transaction.atomic
def record_audit(
    *,
    company,
    actor_user,
    module_code,
    action_code,
    entity=None,
    before=None,
    after=None,
    request=None,
    reason="",
    event_category=None,
    resource_code="",
    description="",
    result=AuditResult.SUCCESS,
    failure_reason="",
    severity=AuditSeverity.INFO,
    source=AuditSource.WEB,
    correlation_id="",
    actor_type=ActorType.USER,
    branch=None,
):
    """
    Standardized Audit Log recording service (BR-AUD-07, 10..24).
    Guarantees backward compatibility while capturing full audit telemetry.
    """
    # 1. Resolve entity type, ID and resource code
    entity_type = ""
    entity_id = None
    if entity is not None:
        entity_type = getattr(getattr(entity, "_meta", None), "label", type(entity).__name__)
        entity_id = getattr(entity, "pk", getattr(entity, "id", None))
        if not resource_code:
            resource_code = str(getattr(entity, "code", getattr(entity, "number", "")))
        if not branch and (hasattr(entity, "branch") or hasattr(entity, "branch_id")):
            branch = getattr(entity, "branch", None)

    # 2. Resolve request metadata
    req_id = ""
    ip_addr = ""
    ua = ""
    if request:
        req_id = request.headers.get("X-Request-ID", "")[:100]
        if not correlation_id:
            correlation_id = request.headers.get("X-Correlation-ID", "")[:100]
        ip_addr = request.META.get("REMOTE_ADDR", "")[:64]
        ua = request.META.get("HTTP_USER_AGENT", "")

    # 3. Resolve category and description
    if not event_category:
        event_category = infer_event_category(module_code, action_code, entity_type)
    if not description:
        description = reason or f"Thực hiện {action_code} trên {entity_type or module_code}"

    # 4. Resolve Actor name snapshot
    actor_name = ""
    if actor_user:
        actor_name = getattr(actor_user, "display_name", str(actor_user))

    # 5. Create AuditLog entry
    log = AuditLog.objects.create(
        company=company,
        branch=branch,
        actor_user=actor_user,
        actor_type=actor_type,
        actor_name_snapshot=actor_name,
        module_code=module_code,
        event_category=event_category,
        action_code=action_code,
        entity_type=entity_type,
        entity_id=entity_id,
        resource_code=resource_code,
        description=description,
        result=result,
        failure_reason=failure_reason,
        severity=severity,
        source=source,
        request_id=req_id,
        correlation_id=correlation_id,
        ip_address=ip_addr,
        user_agent=ua,
        reason=reason,
    )

    # 6. Record field changes with sensitive data masking (BR-AUD-20, 22, 23)
    before, after = before or {}, after or {}
    changes = []
    for field_name in sorted(set(before) | set(after)):
        raw_old = before.get(field_name)
        raw_new = after.get(field_name)
        if raw_old != raw_new:
            masked_old = mask_sensitive_value(field_name, _json_value(raw_old))
            masked_new = mask_sensitive_value(field_name, _json_value(raw_new))
            changes.append(
                AuditChange(
                    audit_log=log,
                    field_name=field_name,
                    old_value_json=masked_old,
                    new_value_json=masked_new,
                )
            )
    if changes:
        AuditChange.objects.bulk_create(changes)

    return log


def validate_and_filter_audit_logs(company, user_account, params):
    """
    Validate search query parameters and filter Audit Logs by Permission and Data Scope (BR-AUD-04, 33, 34, EF-03).
    """
    qs = AuditLog.objects.filter(company=company).select_related(
        "actor_user", "branch"
    ).prefetch_related("changes")

    # 1. Date Range Validation (BR-AUD-34, EF-03: Max 366 days)
    from_date_str = params.get("from_date")
    to_date_str = params.get("to_date")
    from_dt, to_dt = None, None

    if from_date_str:
        try:
            from_dt = datetime.fromisoformat(from_date_str)
            if timezone.is_naive(from_dt):
                from_dt = timezone.make_aware(from_dt)
        except ValueError:
            raise ValidationError({"from_date": "Định dạng from_date không hợp lệ (cần YYYY-MM-DD hoặc ISO)."})

    if to_date_str:
        try:
            to_dt = datetime.fromisoformat(to_date_str)
            if timezone.is_naive(to_dt):
                to_dt = timezone.make_aware(to_dt)
            # If date only, extend to end of day
            if len(to_date_str) == 10:
                to_dt = to_dt + timedelta(days=1) - timedelta(microseconds=1)
        except ValueError:
            raise ValidationError({"to_date": "Định dạng to_date không hợp lệ (cần YYYY-MM-DD hoặc ISO)."})

    if from_dt and to_dt:
        if to_dt < from_dt:
            raise ValidationError({"time_range": "Ngày kết thúc không được nhỏ hơn ngày bắt đầu."})
        if (to_dt - from_dt).days > 366:
            raise ValidationError({
                "time_range": "Khoảng thời gian tìm kiếm trực tiếp vượt quá giới hạn 366 ngày (EF-03, BR-AUD-34). Vui lòng thu hẹp khoảng thời gian để bảo đảm hiệu năng."
            })

    if from_dt:
        qs = qs.filter(occurred_at__gte=from_dt)
    if to_dt:
        qs = qs.filter(occurred_at__lte=to_dt)

    # 2. Filters
    if mod := params.get("module_code"):
        qs = qs.filter(module_code=mod)
    if cat := params.get("event_category"):
        qs = qs.filter(event_category=cat)
    if act := params.get("action_code"):
        qs = qs.filter(action_code__icontains=act)
    if res := params.get("result"):
        qs = qs.filter(result=res)
    if sev := params.get("severity"):
        qs = qs.filter(severity=sev)
    if src := params.get("source"):
        qs = qs.filter(source=src)
    if actor_id := params.get("actor_user_id"):
        qs = qs.filter(actor_user_id=actor_id)
    if br_id := params.get("branch_id"):
        qs = qs.filter(branch_id=br_id)
    if res_code := params.get("resource_code"):
        qs = qs.filter(resource_code__icontains=res_code)
    if ent_type := params.get("entity_type"):
        qs = qs.filter(entity_type__icontains=ent_type)
    if ent_id := params.get("entity_id"):
        qs = qs.filter(entity_id=ent_id)
    if corr_id := params.get("correlation_id"):
        qs = qs.filter(correlation_id=corr_id)
    if req_id := params.get("request_id"):
        qs = qs.filter(request_id=req_id)
    if "is_archived" in params:
        is_arch = str(params.get("is_archived")).lower() in ("true", "1")
        qs = qs.filter(is_archived=is_arch)

    # Free text search across multiple dimensions (AF-01, AF-02)
    if q := params.get("q"):
        qs = qs.filter(
            Q(resource_code__icontains=q)
            | Q(action_code__icontains=q)
            | Q(actor_name_snapshot__icontains=q)
            | Q(description__icontains=q)
            | Q(reason__icontains=q)
            | Q(entity_type__icontains=q)
        )

    # 3. Data Scope Application (BR-AUD-04)
    # If user has specific branch scope restrictions in assignments, apply them
    from iam.permissions import has_effective_permission
    has_global_view = has_effective_permission(user_account, company, "SYS.AUDIT.VIEW")
    if not has_global_view:
        # Check user's assigned branches
        from iam.models import CompanyMembership
        membership = CompanyMembership.objects.filter(company=company, user=user_account).first()
        if membership:
            from iam.permissions import effective_assignments
            permitted_branches = set()
            is_unrestricted = False
            for asg in effective_assignments(user_account, company):
                if asg.data_scope_set:
                    if asg.data_scope_set.allow_all_company_data:
                        is_unrestricted = True
                        break
                    permitted_branches.update(asg.data_scope_set.branch_scopes.values_list("branch_id", flat=True))
                else:
                    is_unrestricted = True
                    break
            if not is_unrestricted:
                qs = qs.filter(Q(branch_id__in=permitted_branches) | Q(branch__isnull=True, actor_user=user_account))

    # 4. Sorting
    ordering = params.get("ordering", "-occurred_at")
    allowed_order_fields = {"occurred_at", "-occurred_at", "module_code", "-module_code", "action_code", "-action_code", "severity", "-severity"}
    if ordering in allowed_order_fields:
        qs = qs.order_by(ordering)
    else:
        qs = qs.order_by("-occurred_at")

    return qs


def export_audit_logs_data(queryset, export_format="json", actor_user=None, request=None, company=None):
    """
    Export audit logs with masking and audit logging of the export action (Section 2.3, BR-AUD-28, 37..40).
    """
    logs = list(queryset[:5000])  # Cap at 5000 records for direct export

    # Record Audit Log for the export itself (BR-AUD-28, 40)
    if company and actor_user:
        record_audit(
            company=company,
            actor_user=actor_user,
            module_code="SYS",
            action_code="EXPORT",
            event_category=EventCategory.REPORT_EXPORT,
            description=f"Xuất {len(logs)} bản ghi Audit Log định dạng {export_format.upper()}",
            resource_code="AUDIT_EXPORT",
            severity=AuditSeverity.HIGH,
            source=AuditSource.WEB if request else AuditSource.API,
            request=request,
            reason="Xuất dữ liệu Audit Log phục vụ đối soát/kiểm toán",
        )

    if export_format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Audit ID",
            "Thời điểm",
            "Actor Type",
            "Actor ID",
            "Actor Name",
            "Phân hệ",
            "Loại sự kiện",
            "Hành động",
            "Resource Type",
            "Resource ID",
            "Resource Code",
            "Mô tả",
            "Kết quả",
            "Mức độ",
            "Nguồn",
            "IP Address",
            "Request ID",
            "Correlation ID",
            "Lý do",
        ])
        for log in logs:
            writer.writerow([
                str(log.id),
                log.occurred_at.isoformat() if log.occurred_at else "",
                log.actor_type,
                str(log.actor_user_id),
                log.actor_name_snapshot,
                log.module_code,
                log.event_category,
                log.action_code,
                log.entity_type,
                str(log.entity_id) if log.entity_id else "",
                log.resource_code,
                log.description,
                log.result,
                log.severity,
                log.source,
                log.ip_address,
                log.request_id,
                log.correlation_id,
                log.reason,
            ])
        return output.getvalue(), "text/csv"

    # Default to JSON
    data = []
    for log in logs:
        changes_data = []
        for ch in log.changes.all():
            changes_data.append({
                "field_name": ch.field_name,
                "old_value": ch.old_value_json,
                "new_value": ch.new_value_json,
            })
        data.append({
            "id": str(log.id),
            "occurred_at": log.occurred_at.isoformat() if log.occurred_at else "",
            "actor_type": log.actor_type,
            "actor_user_id": str(log.actor_user_id),
            "actor_name": log.actor_name_snapshot,
            "branch_id": str(log.branch_id) if log.branch_id else None,
            "module_code": log.module_code,
            "event_category": log.event_category,
            "action_code": log.action_code,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id) if log.entity_id else None,
            "resource_code": log.resource_code,
            "description": log.description,
            "result": log.result,
            "failure_reason": log.failure_reason,
            "severity": log.severity,
            "source": log.source,
            "ip_address": log.ip_address,
            "request_id": log.request_id,
            "correlation_id": log.correlation_id,
            "reason": log.reason,
            "changes": changes_data,
        })
    return json.dumps(data, ensure_ascii=False, indent=2), "application/json"


def generate_audit_ai_summary(queryset):
    """
    Summarize audit events and detect anomalies with mandatory AI disclaimer (AF-13, BR-AUD-50..52).
    """
    total = queryset.count()
    if total == 0:
        return {
            "summary": "Không có sự kiện nào trong phạm vi được chọn.",
            "total_events": 0,
            "anomalies": [],
            "disclaimer": "Kết quả phân tích AI là nhận định hỗ trợ tham khảo, không thay thế bằng chứng Audit Log gốc (BR-AUD-52).",
        }

    # Group counts
    from django.db.models import Count
    category_counts = dict(queryset.values("event_category").annotate(cnt=Count("id")).values_list("event_category", "cnt"))
    result_counts = dict(queryset.values("result").annotate(cnt=Count("id")).values_list("result", "cnt"))

    anomalies = []
    denied_count = result_counts.get(AuditResult.DENIED, 0)
    if denied_count > 0:
        anomalies.append({
            "type": "ACCESS_DENIED_SPIKE",
            "message": f"Phát hiện {denied_count} hành động bị hệ thống từ chối truy cập (DENIED). Cần kiểm tra dấu hiệu truy cập trái phép hoặc cấu hình quyền chưa chính xác.",
            "severity": "WARNING",
        })

    perm_count = category_counts.get(EventCategory.PERMISSION, 0)
    if perm_count > 0:
        anomalies.append({
            "type": "PERMISSION_CHANGES",
            "message": f"Có {perm_count} sự kiện thay đổi phân quyền hoặc Role trong giai đoạn này.",
            "severity": "HIGH",
        })

    critical_count = queryset.filter(severity=AuditSeverity.CRITICAL).count()
    if critical_count > 0:
        anomalies.append({
            "type": "CRITICAL_SEVERITY_DETECTED",
            "message": f"Phát hiện {critical_count} sự kiện mức độ CRITICAL cần được kiểm tra bảo mật ngay.",
            "severity": "CRITICAL",
        })

    summary_text = (
        f"Tổng cộng {total} sự kiện đã được ghi nhận. "
        f"Trong đó có {result_counts.get(AuditResult.SUCCESS, 0)} sự kiện thành công, "
        f"{denied_count} sự kiện bị từ chối và {result_counts.get(AuditResult.FAILURE, 0)} sự kiện lỗi."
    )

    return {
        "summary": summary_text,
        "total_events": total,
        "category_breakdown": category_counts,
        "result_breakdown": result_counts,
        "anomalies": anomalies,
        "disclaimer": "Kết quả phân tích AI là nhận định hỗ trợ tham khảo, không thay thế bằng chứng Audit Log gốc (BR-AUD-52).",
    }
