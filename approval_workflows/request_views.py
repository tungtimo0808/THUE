from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from iam.models import CompanyMembership, UserAccount
from iam.permissions import has_effective_permission
from master_data.models import DocumentType
from organization.models import Company

from .models import ApprovalDelegation, ApprovalEvent, ApprovalNotification, ApprovalRequest, ApprovalTask
from .requests import (
    _event,
    _notify,
    active_delegation,
    active_delegator_ids_for,
    document_fingerprint,
    forward_task,
    source_for_request,
)
from .submission import document_context


class DecisionInput(serializers.Serializer):
    action = serializers.ChoiceField(choices=("APPROVE", "REJECT", "REQUEST_CHANGES", "FORWARD", "COMMENT"))
    version = serializers.IntegerField(min_value=1)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=500)
    changes = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    target_user_id = serializers.UUIDField(required=False)
    auth_pin = serializers.CharField(required=False, allow_blank=True, max_length=20)


class BulkDecisionItemInput(serializers.Serializer):
    task_id = serializers.UUIDField()
    action = serializers.ChoiceField(choices=("APPROVE", "REJECT"))
    version = serializers.IntegerField(min_value=1)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=500)
    auth_pin = serializers.CharField(required=False, allow_blank=True, max_length=20)


class BulkDecisionInput(serializers.Serializer):
    decisions = serializers.ListField(child=BulkDecisionItemInput(), min_length=1)


class DelegationCreateSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    delegate = serializers.UUIDField()
    document_type = serializers.UUIDField(required=False, allow_null=True)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        if attrs.get("end_date") and attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": "Ngày kết thúc không được nhỏ hơn ngày bắt đầu."})
        return attrs


def _actor(request):
    actor = getattr(request.user, "iam_account", None)
    if actor is None:
        raise PermissionDenied("Tài khoản chưa liên kết với IAM.")
    return actor


def _authorized(task, actor, source):
    item = task.request
    delegated_from = None
    if task.assignee_id != actor.pk:
        delegation = active_delegation(item.company, task.assignee, actor, item.document_type)
        if not delegation:
            raise PermissionDenied("Không có quyền truy cập Approval Task.")
        delegated_from = task.assignee

    if not CompanyMembership.objects.filter(
            company=item.company, user=actor, membership_status="ACTIVE",
            user__auth_user__is_active=True).exists():
        raise PermissionDenied("Không có quyền truy cập Approval Task.")
    context = document_context(source)
    if not has_effective_permission(actor, item.company, f"{item.document_type.code}.APPROVE",
                                    branch_id=context.get("branch_id"), department_id=context.get("department_id")):
        raise PermissionDenied("Không còn Permission hoặc Data Scope phê duyệt.")
    if source.created_by_id == actor.pk and not item.snapshot.get("allow_self_approval", False):
        raise PermissionDenied("Không được tự phê duyệt chứng từ.")
    return delegated_from


def _source_summary(source):
    fields = ("number", "transaction_date", "posting_date", "document_date", "amount", "total_amount",
              "total_debit", "total_credit", "description", "reason", "purpose", "status", "transaction_type")
    res = {name: str(getattr(source, name)) for name in fields if getattr(source, name, None) is not None}
    if hasattr(source, "lines"):
        lines = []
        for line in source.lines.all().order_by("pk"):
            line_data = {}
            for f in ("line_no", "item_id", "uom_id", "quantity", "estimated_unit_price", "unit_price", "amount",
                      "debit_account_id", "credit_account_id", "description"):
                if hasattr(line, f) and getattr(line, f) is not None:
                    line_data[f] = str(getattr(line, f))
            if line_data:
                lines.append(line_data)
        if lines:
            res["lines"] = lines
    return res


def _task_data(task, actor=None):
    item = task.request
    is_delegated = bool(actor and task.assignee_id != actor.pk)
    return {
        "id": str(task.pk),
        "request_id": str(item.pk),
        "company": str(item.company_id),
        "document_type": item.document_type.code,
        "step": task.step_order,
        "cycle": task.cycle,
        "status": task.status,
        "version": task.version,
        "due_at": task.due_at,
        "submitted_at": item.submitted_at,
        "request_status": item.status,
        "source_id": str(item.source_id),
        "assignee_id": str(task.assignee_id),
        "is_delegated": is_delegated,
        "delegated_from": str(task.assignee_id) if is_delegated else (str(task.delegated_from_id) if task.delegated_from_id else None),
        "forwarded_to": str(task.forwarded_to_id) if task.forwarded_to_id else None,
    }


def generate_ai_assistance(item, source):
    doc_number = getattr(source, "number", "N/A")
    total_val = getattr(source, "total_amount", getattr(source, "amount", 0)) or 0
    try:
        val_float = float(total_val)
    except (ValueError, TypeError):
        val_float = 0.0

    lines_count = source.lines.count() if hasattr(source, "lines") else 0
    warnings = []
    if item.document_fingerprint != document_fingerprint(source):
        warnings.append("Cảnh báo: Dữ liệu chứng từ đã thay đổi sau thời điểm nộp phê duyệt.")
    if val_float >= 100_000_000:
        warnings.append(f"Cảnh báo giá trị lớn: Chứng từ có giá trị {val_float:,.0f} VND vượt hạn mức kiểm soát thường quy.")
    has_attachments = False
    if hasattr(source, "attachments"):
        att = source.attachments
        if hasattr(att, "exists") and callable(att.exists):
            has_attachments = att.exists()
        elif isinstance(att, (list, tuple, dict, set)):
            has_attachments = bool(att)
        elif att is not None:
            has_attachments = bool(att)
    if not has_attachments:
        warnings.append("Lưu ý: Không tìm thấy tệp đính kèm đi kèm chứng từ.")

    summary = (
        f"Chứng từ số {doc_number} ({item.document_type.name if hasattr(item.document_type, 'name') else item.document_type.code}) "
        f"với {lines_count} dòng chi tiết, tổng giá trị {val_float:,.0f} VND. "
        f"Người lập: {getattr(source.created_by, 'display_name', str(getattr(source, 'created_by_id', 'Hệ thống')))}."
    )
    checkpoints = [
        "Kiểm tra tính hợp lệ của người đề xuất và thẩm quyền phê duyệt theo hạn mức.",
        "Đối chiếu đơn giá và số lượng các dòng chi tiết với hợp đồng hoặc báo giá.",
        "Xác nhận sự phù hợp với kế hoạch ngân sách và phân bổ chi phí của bộ phận.",
    ]
    return {
        "summary": summary,
        "warnings": warnings,
        "checkpoints": checkpoints,
        "disclaimer": "AI chỉ hỗ trợ tóm tắt và cảnh báo tham khảo, không tự động đưa ra quyết định thay cho Approver (BR-APR-39, BR-APR-41)."
    }


class TaskListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        actor = _actor(request)
        delegator_ids = active_delegator_ids_for(actor, company=request.query_params.get("company_id"))
        status_filter = request.query_params.get("status", "PENDING")

        tasks = ApprovalTask.objects.filter(
            Q(assignee=actor) | Q(assignee_id__in=delegator_ids)
        ).select_related("request__company", "request__document_type", "assignee").order_by("due_at", "created_at")

        if status_filter != "ALL":
            tasks = tasks.filter(status=status_filter)

        if request.query_params.get("company_id"):
            tasks = tasks.filter(request__company_id=request.query_params["company_id"])

        if request.query_params.get("document_type"):
            tasks = tasks.filter(request__document_type__code=request.query_params["document_type"])

        if request.query_params.get("overdue") == "true":
            tasks = tasks.filter(due_at__lt=timezone.now())

        result = []
        for task in tasks:
            source = source_for_request(task.request)
            if not source:
                continue
            if status_filter == "PENDING" and task.request.status not in ("PENDING_APPROVAL", "IN_PROGRESS"):
                continue
            try:
                _authorized(task, actor, source)
            except PermissionDenied:
                continue

            summary = _source_summary(source)
            search_query = request.query_params.get("search", "").strip().lower()
            if search_query:
                number_match = search_query in summary.get("number", "").lower()
                desc_match = search_query in summary.get("description", "").lower() or search_query in summary.get("purpose", "").lower()
                if not (number_match or desc_match):
                    continue

            result.append({**_task_data(task, actor), "source": summary})
        return Response(result)


def _process_task_decision(task_ref, actor, validated_data, request):
    action = validated_data["action"]
    comment = validated_data.get("comment", "").strip()
    changes = validated_data.get("changes", "").strip()
    auth_pin = validated_data.get("auth_pin", "").strip()

    if action == "REJECT" and not comment:
        raise ValidationError({"comment": "Lý do từ chối là bắt buộc."})
    if action == "REQUEST_CHANGES" and (not comment or not changes):
        raise ValidationError({"changes": "Cần nhập lý do và nội dung chỉnh sửa."})

    source = source_for_request(task_ref.request)
    if source is None:
        raise ValidationError("Chứng từ nguồn không còn khả dụng.")
    source = type(source).objects.select_for_update().get(pk=source.pk)
    item = ApprovalRequest.objects.select_for_update().select_related("company", "document_type").get(pk=task_ref.request_id)
    task = ApprovalTask.objects.select_for_update().get(pk=task_ref.pk)

    delegated_from = _authorized(task, actor, source)

    if task.version != validated_data["version"]:
        raise ValidationError({"version": "Task đã thay đổi; hãy tải lại."})
    if task.status != "PENDING" or item.status not in ("PENDING_APPROVAL", "IN_PROGRESS") or source.status != "PENDING_APPROVAL":
        raise ValidationError("Task không còn chờ xử lý.")
    if item.document_fingerprint != document_fingerprint(source):
        raise ValidationError("Chứng từ đã thay đổi; cần gửi lại phê duyệt.")

    step = item.snapshot["steps"][task.step_order - 1]

    # Security check: Auth PIN (AF-21, EF-16)
    if step.get("require_auth_pin"):
        expected_pin = str(step.get("auth_pin", "123456"))
        if auth_pin != expected_pin:
            raise ValidationError({"auth_pin": "Mã xác thực bảo mật không chính xác."})

    if action == "FORWARD":
        target_user_id = validated_data.get("target_user_id")
        if not target_user_id:
            raise ValidationError({"target_user_id": "Cần chọn người nhận chuyển xử lý."})
        new_task = forward_task(task.pk, actor, target_user_id, comment=comment)
        return _task_data(new_task, actor)

    if action == "COMMENT":
        if not comment:
            raise ValidationError({"comment": "Ý kiến không được để trống."})
        _event(item, task, actor, "COMMENT", comment, {"step": task.step_order}, delegated_from=delegated_from)
        return _task_data(task, actor)

    if action == "REJECT" and step.get("allow_reject") is False:
        raise ValidationError("Bước này không cho phép từ chối.")

    if action == "REQUEST_CHANGES" and (step.get("allow_request_changes") is False or step.get("on_changes") == "NONE"):
        raise ValidationError("Bước này không cho phép yêu cầu chỉnh sửa.")

    if action == "APPROVE" and step.get("require_comment") and not comment:
        raise ValidationError({"comment": "Bước này yêu cầu ý kiến phê duyệt."})

    if action in ("APPROVE", "REJECT"):
        service_names = {"purchases": ("purchases.services", "decide_document")}
        module_name, function_name = service_names.get(source._meta.app_label,
            (f"{source._meta.app_label}.services", "decide"))
        from importlib import import_module
        getattr(import_module(module_name), function_name)(source, request, action == "APPROVE")
    else:
        source.status = "REJECTED"
        update_fields = ["status"]
        if hasattr(source, "approved_at"):
            source.approved_at = None
            update_fields.append("approved_at")
        source.save(update_fields=update_fields)
        item.tasks.filter(cycle=item.cycle, status="PENDING").exclude(pk=task.pk).update(
            status="CANCELLED", completed_at=timezone.now())
        task.status = "CHANGES_REQUESTED"
        task.version += 1
        task.completed_at = timezone.now()
        if delegated_from:
            task.delegated_from = delegated_from
        task.save(update_fields=("status", "version", "completed_at", "delegated_from"))
        item.status = "CHANGES_REQUESTED"
        item.completed_at = timezone.now()
        item.snapshot = {**item.snapshot, "resume_step": max(1, task.step_order - 1)
                         if step.get("on_changes") == "PREVIOUS" else 1}
        item.save(update_fields=("status", "completed_at", "snapshot", "updated_at"))
        _event(item, task, actor, "REQUEST_CHANGES", comment,
               {"step": task.step_order, "changes": changes}, delegated_from=delegated_from)
        _notify(item, item.submitted_by_id, "CHANGES_REQUESTED")

    task.refresh_from_db()
    return _task_data(task, actor)


class TaskDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, pk):
        task = get_object_or_404(ApprovalTask.objects.select_related("request__company", "request__document_type", "assignee"), pk=pk)
        source = source_for_request(task.request)
        if not source:
            raise ValidationError("Chứng từ nguồn không còn khả dụng.")
        actor = _actor(request)
        _authorized(task, actor, source)
        item = task.request
        step = item.snapshot["steps"][task.step_order - 1] if 0 <= task.step_order - 1 < len(item.snapshot.get("steps", [])) else {}

        allowed_actions = ["APPROVE", "COMMENT", "VIEW_HISTORY"]
        if step.get("allow_reject") is not False:
            allowed_actions.append("REJECT")
        if step.get("allow_request_changes") is not False and step.get("on_changes") != "NONE":
            allowed_actions.append("REQUEST_CHANGES")
        if step.get("allow_forward") is not False:
            allowed_actions.append("FORWARD")

        history = [{"action": event.action, "actor": str(event.actor_id),
                    "actor_name": getattr(event.actor, "display_name", str(event.actor_id)) if event.actor else str(event.actor_id),
                    "delegated_from": str(event.delegated_from_id) if event.delegated_from_id else None,
                    "step": event.metadata.get("step"),
                    "comment": event.comment, "metadata": event.metadata, "at": event.created_at}
                   for event in item.events.select_related("actor", "delegated_from").all()]

        return Response({
            **_task_data(task, actor),
            "source": _source_summary(source),
            "workflow": {
                "version_id": str(item.workflow_version_id),
                "steps": item.snapshot["steps"],
                "current_step": task.step_order,
                "allowed_actions": allowed_actions,
            },
            "history": history,
            "fingerprint_valid": item.document_fingerprint == document_fingerprint(source),
            "ai_assistance": generate_ai_assistance(item, source),
            "attachments": [],
        })

    @transaction.atomic
    def post(self, request, pk):
        data = DecisionInput(data=request.data)
        data.is_valid(raise_exception=True)
        task_ref = get_object_or_404(ApprovalTask.objects.select_related("request"), pk=pk)
        actor = _actor(request)
        result = _process_task_decision(task_ref, actor, data.validated_data, request)
        return Response(result)


class BulkDecisionView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        input_data = BulkDecisionInput(data=request.data)
        input_data.is_valid(raise_exception=True)
        actor = _actor(request)
        results = []

        for item_data in input_data.validated_data["decisions"]:
            task_id = item_data["task_id"]
            try:
                task_ref = ApprovalTask.objects.select_related("request").filter(pk=task_id).first()
                if not task_ref:
                    raise ValidationError("Approval Task không tồn tại.")

                with transaction.atomic():
                    res = _process_task_decision(task_ref, actor, item_data, request)
                results.append({"task_id": str(task_id), "success": True, "action": item_data["action"], "result": res})
            except Exception as e:
                err_msg = str(e.detail if hasattr(e, "detail") else e)
                results.append({"task_id": str(task_id), "success": False, "action": item_data["action"], "error": err_msg})

        return Response({"results": results})


class DelegationView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        actor = _actor(request)
        items = ApprovalDelegation.objects.filter(
            Q(delegator=actor) | Q(delegate=actor)
        ).select_related("company", "delegator", "delegate", "document_type").order_by("-created_at")

        if request.query_params.get("company_id"):
            items = items.filter(company_id=request.query_params["company_id"])

        res = []
        for item in items:
            res.append({
                "id": str(item.pk),
                "company_id": str(item.company_id),
                "delegator_id": str(item.delegator_id),
                "delegator_name": getattr(item.delegator, "display_name", str(item.delegator_id)),
                "delegate_id": str(item.delegate_id),
                "delegate_name": getattr(item.delegate, "display_name", str(item.delegate_id)),
                "document_type": item.document_type.code if item.document_type else None,
                "start_date": item.start_date.isoformat(),
                "end_date": item.end_date.isoformat() if item.end_date else None,
                "is_active": item.is_active,
                "reason": item.reason,
                "created_at": item.created_at,
            })
        return Response(res)

    @transaction.atomic
    def post(self, request):
        serializer = DelegationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        actor = _actor(request)
        data = serializer.validated_data

        company = get_object_or_404(Company, pk=data["company"])
        delegate = get_object_or_404(UserAccount, pk=data["delegate"])

        if delegate.pk == actor.pk:
            raise ValidationError({"delegate": "Không thể ủy quyền cho chính mình."})

        if not CompanyMembership.objects.filter(company=company, user=delegate, membership_status="ACTIVE", user__auth_user__is_active=True).exists():
            raise ValidationError({"delegate": "Người được ủy quyền không có Membership hợp lệ trong doanh nghiệp."})

        doc_type = None
        if data.get("document_type"):
            doc_type = get_object_or_404(DocumentType, pk=data["document_type"])

        delegation = ApprovalDelegation.objects.create(
            company=company,
            delegator=actor,
            delegate=delegate,
            document_type=doc_type,
            start_date=data["start_date"],
            end_date=data.get("end_date"),
            reason=data.get("reason", ""),
            is_active=True,
        )
        return Response({
            "id": str(delegation.pk),
            "delegator_id": str(delegation.delegator_id),
            "delegate_id": str(delegation.delegate_id),
            "start_date": delegation.start_date.isoformat(),
            "end_date": delegation.end_date.isoformat() if delegation.end_date else None,
            "is_active": delegation.is_active,
        }, status=status.HTTP_201_CREATED)


class DelegationDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def delete(self, request, pk):
        actor = _actor(request)
        delegation = get_object_or_404(ApprovalDelegation, pk=pk)
        if delegation.delegator_id != actor.pk:
            raise PermissionDenied("Chỉ người ủy quyền mới có thể hủy ủy quyền.")
        delegation.is_active = False
        delegation.save(update_fields=("is_active", "updated_at"))
        return Response({"status": "cancelled", "is_active": False})


class NotificationListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        items = ApprovalNotification.objects.filter(recipient=_actor(request)).order_by("-created_at")[:100]
        return Response([{"id": str(item.pk), "request_id": str(item.request_id), "event": item.event,
                          "status": item.status, "at": item.created_at} for item in items])
