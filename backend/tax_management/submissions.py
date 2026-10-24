"""Manual external filing record; no provider delivery or legal verification is implied."""
import hashlib
import json
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError

from . import declarations, models, services


def _submission_time(value):
    parsed = parse_datetime(str(value)) if value else None
    if not parsed:
        raise ValidationError({"submitted_at": "Nhập ngày giờ nộp hợp lệ."})
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    if parsed > timezone.now() + timedelta(minutes=5):
        raise ValidationError({"submitted_at": "Thời gian nộp không được ở tương lai."})
    return parsed


def _snapshot(declaration):
    return {"declaration_id": str(declaration.id), "company_id": str(declaration.company_id),
            "period_id": str(declaration.period_id), "period_code": declaration.period.code,
            "form_code": declaration.form_code, "form_version": declaration.form_version,
            "version": declaration.version, "source_calculation_id": str(declaration.source_calculation_id),
            "source_snapshot_hash": declaration.source_snapshot_hash, "indicators": declaration.indicators}


@transaction.atomic
def record_manual(declaration, data, request):
    declaration = models.TaxDeclaration.objects.select_for_update().select_related("period", "source_calculation").get(pk=declaration.pk)
    if declaration.preparation_status != "READY_TO_SUBMIT" or not declaration.confirmed_at or not declaration.confirmed_by_id:
        raise ValidationError("Hồ sơ chưa được xác nhận sẵn sàng nộp.")
    if not declarations.source_current(declaration):
        raise ValidationError("Nguồn của hồ sơ đã thay đổi; cần rà soát lại trước khi ghi nhận nộp.")
    if data.get("declaration_version") != declaration.version:
        raise ValidationError({"declaration_version": "Phiên bản hồ sơ đã thay đổi; hãy tải lại."})
    reference = str(data.get("external_reference", "")).strip()
    if len(reference) < 4 or len(reference) > 150:
        raise ValidationError({"external_reference": "Mã tham chiếu ngoài hệ thống cần từ 4 đến 150 ký tự."})
    submitted_at = _submission_time(data.get("submitted_at"))
    existing = models.TaxSubmission.objects.filter(company=declaration.company, declaration=declaration,
        external_reference=reference).first()
    if existing:
        first_event = existing.events.first()
        if existing.submitted_at != submitted_at or (first_event and first_event.evidence_reference != str(data.get("evidence_reference", "")).strip()):
            raise ValidationError("Mã tham chiếu đã được dùng cho lần nộp khác dữ liệu.")
        return existing, False
    if models.TaxSubmission.objects.filter(declaration=declaration,
        status__in=("SUBMITTED_EXTERNALLY", "UNKNOWN", "ACCEPTED")).exists():
        raise ValidationError("Hồ sơ đã có lần nộp chưa kết thúc hoặc đã được ghi nhận chấp nhận; hãy xem lịch sử.")
    snapshot = _snapshot(declaration)
    fingerprint = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    obj = models.TaxSubmission.objects.create(company=declaration.company, declaration=declaration,
        declaration_version=declaration.version, declaration_snapshot=snapshot, snapshot_hash=fingerprint,
        external_reference=reference, submitted_at=submitted_at,
        evidence_reference=str(data.get("evidence_reference", "")).strip()[:500],
        note=str(data.get("note", "")).strip()[:2000], created_by=services.actor(request))
    models.TaxSubmissionEvent.objects.create(submission=obj, to_status=obj.status,
        evidence_reference=obj.evidence_reference, note=obj.note, actor=services.actor(request))
    services.audit(request, obj, "MANUAL_SUBMISSION", after={"declaration": str(declaration.id),
        "version": declaration.version, "reference": reference, "status": obj.status})
    return obj, True


@transaction.atomic
def update_manual_status(submission, data, request):
    submission = models.TaxSubmission.objects.select_for_update().get(pk=submission.pk)
    if submission.channel != "MANUAL_EXTERNAL" or submission.verification_source != "MANUAL":
        raise ValidationError("Chỉ cập nhật thủ công bản ghi có nguồn MANUAL.")
    target = data.get("status")
    if submission.status not in {"SUBMITTED_EXTERNALLY", "UNKNOWN"} or target not in {"UNKNOWN", "ACCEPTED", "REJECTED"}:
        raise ValidationError("Chuyển trạng thái không hợp lệ; bản ghi đã kết thúc không thể sửa.")
    if target == submission.status:
        raise ValidationError("Trạng thái mới phải khác trạng thái hiện tại.")
    evidence = str(data.get("evidence_reference", "")).strip()
    note = str(data.get("note", "")).strip()
    if target in {"ACCEPTED", "REJECTED"} and (len(evidence) < 5 or len(note) < 10):
        raise ValidationError("Kết quả thủ công cần mã/chỗ lưu bằng chứng và ghi chú từ 10 ký tự.")
    if len(evidence) > 500 or len(note) > 2000:
        raise ValidationError("Thông tin bằng chứng hoặc ghi chú quá dài.")
    previous = submission.status
    submission.status = target
    submission.evidence_reference = evidence or submission.evidence_reference
    submission.note = note
    submission.save(update_fields=("status", "evidence_reference", "note", "updated_at"))
    models.TaxSubmissionEvent.objects.create(submission=submission, from_status=previous, to_status=target,
        evidence_reference=evidence, note=note, actor=services.actor(request))
    services.audit(request, submission, "MANUAL_SUBMISSION_STATUS", before={"status": previous},
        after={"status": target, "evidence_reference": evidence, "note": note})
    return submission
