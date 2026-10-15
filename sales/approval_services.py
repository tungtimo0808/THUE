from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from approval_workflows.execution import approval_progress
from approval_workflows.models import ApprovalRequest, ApprovalTask
from approval_workflows.submission import document_context
from approval_workflows.validation import eligible_approvers, resolve_approver
from iam.permissions import has_effective_permission

from . import models
from .services import audit, actor_for


DOC_MODELS = {
    "QUOTATION": models.SalesQuotation,
    "ORDER": models.SalesOrder,
    "CONTRACT": models.SalesContract,
    "GOODS_SALE": models.GoodsSale,
    "SERVICE_SALE": models.ServiceSale,
    "SALES_RETURN": models.SalesReturn,
    "SALES_ALLOWANCE": models.SalesAllowance,
    "SALES_INVOICE": models.SalesInvoice,
    "DISCOUNT_INVOICE": models.SalesDiscountInvoice,
    "COMMERCIAL_INVOICE": models.SalesCommercialInvoice,
}

DOC_TYPE_NAMES = {
    "QUOTATION": "Báo giá",
    "ORDER": "Đơn bán hàng",
    "CONTRACT": "Hợp đồng bán",
    "GOODS_SALE": "Chứng từ bán hàng hóa",
    "SERVICE_SALE": "Chứng từ bán dịch vụ",
    "SALES_RETURN": "Chứng từ hàng bán trả lại",
    "SALES_ALLOWANCE": "Chứng từ giảm giá hàng bán",
    "SALES_INVOICE": "Hóa đơn đầu ra",
    "DISCOUNT_INVOICE": "Hóa đơn chiết khấu",
    "COMMERCIAL_INVOICE": "Hóa đơn thương mại",
}

DOC_PERMISSIONS = {
    "QUOTATION": "SAL.QUOTATION.APPROVE",
    "ORDER": "SAL.ORDER.APPROVE",
    "CONTRACT": "SAL.CONTRACT.APPROVE",
    "GOODS_SALE": "SAL.GOODS_SALE.APPROVE",
    "SERVICE_SALE": "SAL.SERVICE_SALE.APPROVE",
    "SALES_RETURN": "SAL.SALES_RETURN.APPROVE",
    "SALES_ALLOWANCE": "SAL.SALES_ALLOWANCE.APPROVE",
    "SALES_INVOICE": "SAL.SALES_INVOICE.APPROVE",
    "DISCOUNT_INVOICE": "SAL.DISCOUNT_INVOICE.APPROVE",
    "COMMERCIAL_INVOICE": "SAL.COMMERCIAL_INVOICE.APPROVE",
}

DECISION_NAMES = {
    "SUBMITTED": "Đã gửi",
    "APPROVED": "Phê duyệt",
    "REJECTED": "Từ chối",
    "REVISION_REQUIRED": "Yêu cầu chỉnh sửa",
    "WITHDRAWN": "Đã thu hồi",
}


def check_approval_permission(user, company, document_type_code, branch_id=None):
    """Check whether user has approval rights for sales documents."""
    if user.is_superuser:
        return True
    actor = getattr(user, "iam_account", None)
    if not actor:
        return False
    if has_effective_permission(actor, company, "SAL.APPROVAL.APPROVE", branch_id=branch_id):
        return True
    perm = DOC_PERMISSIONS.get(document_type_code)
    if perm and has_effective_permission(actor, company, perm, branch_id=branch_id):
        return True
    return False


def get_document_model(document_type_code):
    model = DOC_MODELS.get(document_type_code)
    if not model:
        raise ValidationError(f"Loại chứng từ '{document_type_code}' không hợp lệ.")
    return model


def get_document(document_type_code, document_id, company_id=None):
    model = get_document_model(document_type_code)
    qs = model.objects.all()
    if company_id:
        qs = qs.filter(company_id=company_id)
    doc = qs.filter(pk=document_id).first()
    if not doc:
        raise NotFound("Chứng từ không tồn tại.")
    return doc


def get_document_total(doc):
    if hasattr(doc, "total_amount") and doc.total_amount is not None:
        return Decimal(str(doc.total_amount))
    if hasattr(doc, "maximum_value") and doc.maximum_value is not None:
        return Decimal(str(doc.maximum_value))
    return Decimal("0")


def get_user_display_name(account):
    if not account:
        return ""
    if hasattr(account, "display_name") and account.display_name:
        return account.display_name
    if hasattr(account, "auth_user") and getattr(account.auth_user, "username", None):
        return account.auth_user.username
    if hasattr(account, "username"):
        return account.username
    return str(account)


def check_approver_assignment_and_limit(doc, user, document_type_code):
    """Verify if user is assigned at current approval step and within limit (BR-SAL-08-01, BR-SAL-08-07)."""
    actor = getattr(user, "iam_account", None)
    if not actor:
        raise PermissionDenied("Bạn không có tài khoản nhân viên hợp lệ.")

    # BR-SAL-08-07 / EF-06: Check self-approval
    allow_self = doc.workflow_snapshot.get("allow_self_approval", False) if doc.workflow_snapshot else False
    if doc.created_by_id == actor.id and not allow_self:
        raise ValidationError("Không được tự phê duyệt chứng từ do chính mình lập.")

    # Check workflow task in approval_workflows
    inbox_task = None
    if hasattr(doc, "_meta"):
        inbox = (
            ApprovalRequest.objects.filter(source_model=doc._meta.label, source_id=doc.pk)
            .order_by("-round_number")
            .first()
        )
        if inbox:
            inbox_task = (
                inbox.tasks.filter(step_order=inbox.current_step, cycle=inbox.cycle, status="PENDING")
                .filter(assignee_id=actor.id)
                .first()
            )

    snapshot = doc.workflow_snapshot or {}
    steps = snapshot.get("steps") or []

    # If steps configured in snapshot
    if steps:
        decisions = models.ApprovalDecision.objects.filter(company=doc.company, document_type=document_type_code, document_id=doc.pk)
        current_level = decisions.filter(decision="APPROVED").count() + 1
        if current_level <= len(steps):
            step = steps[current_level - 1]

            # Check limit
            step_limit = step.get("limit") or step.get("max_amount")
            if step_limit:
                total_val = get_document_total(doc)
                if total_val > Decimal(str(step_limit)):
                    raise ValidationError("Giá trị chứng từ vượt hạn mức phê duyệt của bạn.")

            # Check approvers in step
            context = document_context(doc)
            ordered = []
            for rule in step.get("approvers", []):
                r = dict(rule)
                if "id" not in r and "user_id" in r:
                    r["id"] = r["user_id"]
                rule_limit = r.get("limit") or r.get("max_amount")
                if rule_limit and get_document_total(doc) > Decimal(str(rule_limit)):
                    continue
                for u_id in sorted(resolve_approver(r, doc.company, context)):
                    if u_id not in ordered:
                        ordered.append(u_id)
                if r.get("type") == "USER" and r.get("id"):
                    uid = str(r["id"])
                    if uid not in ordered:
                        ordered.append(uid)

            if str(actor.pk) not in ordered and not inbox_task and not user.is_superuser:
                # Also check fallback
                if step.get("fallback"):
                    fallback_users = sorted(resolve_approver(step["fallback"], doc.company, context))
                    if str(actor.pk) not in fallback_users:
                        raise PermissionDenied("Bạn không được phân công phê duyệt chứng từ này.")
                else:
                    raise PermissionDenied("Bạn không được phân công phê duyệt chứng từ này.")

    return True


def list_pending_approvals(company, user, document_type_filter=None):
    """Aggregate pending approvals across all sales document models (BR-SAL-08-01, BR-SAL-08-02)."""
    results = []
    types_to_check = [document_type_filter] if document_type_filter else list(DOC_MODELS.keys())

    for dt_code in types_to_check:
        if dt_code not in DOC_MODELS:
            continue
        model = DOC_MODELS[dt_code]
        qs = model.objects.filter(company=company, status=models.DocumentStatus.PENDING_APPROVAL)
        qs = qs.select_related("created_by", "branch", "customer", "currency")

        for doc in qs:
            # Check permission
            if not check_approval_permission(user, company, dt_code, branch_id=doc.branch_id):
                continue
            # Check assignment
            try:
                check_approver_assignment_and_limit(doc, user, dt_code)
            except (PermissionDenied, ValidationError):
                continue

            decisions = models.ApprovalDecision.objects.filter(
                company=company, document_type=dt_code, document_id=doc.pk
            )
            current_level = decisions.filter(decision="APPROVED").count() + 1
            total_levels = int(doc.workflow_snapshot.get("levels", 1)) if doc.workflow_snapshot else 1

            results.append(
                {
                    "document_type": dt_code,
                    "document_type_name": DOC_TYPE_NAMES.get(dt_code, dt_code),
                    "document_id": str(doc.pk),
                    "number": doc.number,
                    "document_date": str(doc.document_date) if hasattr(doc, "document_date") else str(getattr(doc, "invoice_date", "")),
                    "creator_id": str(doc.created_by_id) if doc.created_by_id else None,
                    "creator_name": get_user_display_name(doc.created_by),
                    "customer_id": str(doc.customer_id) if getattr(doc, "customer_id", None) else None,
                    "customer_name": doc.customer.name if getattr(doc, "customer", None) else getattr(doc, "buyer_name", ""),
                    "customer_code": getattr(doc.customer, "code", "") if getattr(doc, "customer", None) else "",
                    "branch_id": str(doc.branch_id) if doc.branch_id else None,
                    "branch_name": doc.branch.name if doc.branch else "",
                    "currency_code": getattr(doc.currency, "code", "VND") if getattr(doc, "currency", None) else "VND",
                    "total_amount": str(get_document_total(doc)),
                    "current_level": current_level,
                    "total_levels": total_levels,
                    "submitted_at": str(doc.submitted_at or doc.created_at),
                    "version": getattr(doc, "version", 1),
                    "status": doc.status,
                    "due_date": str(getattr(doc, "due_date", "")) if getattr(doc, "due_date", None) else None,
                    "notes": getattr(doc, "notes", ""),
                }
            )

    results.sort(key=lambda x: x["submitted_at"], reverse=True)
    return results


def get_approval_detail(company, user, document_type_code, document_id):
    """Retrieve complete review view: document details, lines, customer, workflow progress & history."""
    doc = get_document(document_type_code, document_id, company_id=company.pk)
    if not check_approval_permission(user, company, document_type_code, branch_id=doc.branch_id):
        raise PermissionDenied("Bạn không có quyền phê duyệt chứng từ bán hàng.")

    # Customer info
    customer_info = None
    if getattr(doc, "customer", None):
        customer_info = {
            "id": str(doc.customer.id),
            "code": getattr(doc.customer, "code", ""),
            "name": doc.customer.name,
            "tax_code": getattr(doc.customer, "tax_code", getattr(doc, "customer_tax_code", "")),
            "address": getattr(doc.customer, "address", getattr(doc, "customer_address", "")),
        }
    elif hasattr(doc, "buyer_name"):
        customer_info = {
            "id": None,
            "code": "",
            "name": getattr(doc, "buyer_name", ""),
            "tax_code": getattr(doc, "buyer_tax_code", ""),
            "address": getattr(doc, "buyer_address", ""),
        }

    # Branch info
    branch_info = None
    if doc.branch:
        branch_info = {
            "id": str(doc.branch.id),
            "name": doc.branch.name,
            "code": getattr(doc.branch, "code", ""),
        }

    # Lines
    lines_data = []
    if hasattr(doc, "lines"):
        for line in doc.lines.all().order_by("line_no"):
            line_dict = {
                "id": str(line.id),
                "line_no": getattr(line, "line_no", 1),
                "item_id": str(line.item_id) if getattr(line, "item_id", None) else None,
                "item_code": getattr(line.item, "code", "") if getattr(line, "item", None) else "",
                "item_name": getattr(line, "item_name", getattr(line.item, "name", getattr(line, "description", ""))) if getattr(line, "item", None) else getattr(line, "item_name", getattr(line, "description", "")),
                "uom_id": str(line.uom_id) if getattr(line, "uom_id", None) else None,
                "uom_name": getattr(line.uom, "name", "") if getattr(line, "uom", None) else "",
                "quantity": str(getattr(line, "quantity", getattr(line, "return_quantity", getattr(line, "maximum_quantity", Decimal("1"))))),
                "unit_price": str(getattr(line, "unit_price", Decimal("0"))),
                "total_amount": str(getattr(line, "total_amount", getattr(line, "line_total", getattr(line, "amount", getattr(line, "net_sales_value", Decimal("0")))))),
                "description": getattr(line, "description", ""),
            }
            if hasattr(line, "discount_rate"):
                line_dict["discount_rate"] = str(line.discount_rate)
            if hasattr(line, "discount_amount"):
                line_dict["discount_amount"] = str(line.discount_amount)
            if hasattr(line, "tax_amount"):
                line_dict["tax_amount"] = str(line.tax_amount)
            lines_data.append(line_dict)

    # Workflow & History
    decisions = (
        models.ApprovalDecision.objects.filter(
            company=company, document_type=document_type_code, document_id=doc.pk
        )
        .select_related("actor")
        .order_by("decided_at")
    )

    history_data = [
        {
            "id": str(dec.id),
            "level": dec.level,
            "decision": dec.decision,
            "decision_name": DECISION_NAMES.get(dec.decision, dec.decision),
            "actor_id": str(dec.actor_id),
            "actor_name": get_user_display_name(dec.actor),
            "comment": dec.comment,
            "decided_at": dec.decided_at.isoformat(),
            "document_version": dec.document_version,
            "workflow_version": dec.workflow_version,
        }
        for dec in decisions
    ]

    current_level = decisions.filter(decision="APPROVED").count() + 1
    total_levels = int(doc.workflow_snapshot.get("levels", 1)) if doc.workflow_snapshot else 1

    can_approve = False
    if doc.status == models.DocumentStatus.PENDING_APPROVAL:
        try:
            check_approver_assignment_and_limit(doc, user, document_type_code)
            can_approve = True
        except (PermissionDenied, ValidationError):
            can_approve = False

    return {
        "document_type": document_type_code,
        "document_type_name": DOC_TYPE_NAMES.get(document_type_code, document_type_code),
        "document_id": str(doc.pk),
        "number": doc.number,
        "document_date": str(getattr(doc, "document_date", getattr(doc, "invoice_date", ""))),
        "posting_date": str(getattr(doc, "posting_date", getattr(doc, "document_date", getattr(doc, "invoice_date", "")))),
        "status": doc.status,
        "version": getattr(doc, "version", 1),
        "currency_code": getattr(doc.currency, "code", "VND") if getattr(doc, "currency", None) else "VND",
        "total_amount": str(get_document_total(doc)),
        "notes": getattr(doc, "notes", ""),
        "attachments": getattr(doc, "attachments", []),
        "creator": {
            "id": str(doc.created_by_id) if doc.created_by_id else None,
            "name": get_user_display_name(doc.created_by),
            "submitted_at": str(doc.submitted_at or doc.created_at),
        },
        "customer": customer_info,
        "branch": branch_info,
        "lines": lines_data,
        "workflow": {
            "current_level": current_level,
            "total_levels": total_levels,
            "is_final_level": current_level >= total_levels,
            "allow_self_approval": doc.workflow_snapshot.get("allow_self_approval", False) if doc.workflow_snapshot else False,
            "can_approve": can_approve,
        },
        "history": history_data,
    }


@transaction.atomic
def execute_approval_decision(
    company,
    user,
    document_type_code,
    document_id,
    action,
    comment="",
    version=None,
    request=None,
):
    """Execute approval decision: APPROVE, REQUEST_REVISION, REJECT (BR-SAL-08-01..14)."""
    model = get_document_model(document_type_code)
    qs = model.objects.select_for_update()
    doc = qs.filter(pk=document_id, company=company).first()
    if not doc:
        raise NotFound("Chứng từ không tồn tại.")

    # 1. Check permission (EF-01, BR-SAL-08-01)
    if not check_approval_permission(user, company, document_type_code, branch_id=doc.branch_id):
        raise PermissionDenied("Bạn không có quyền phê duyệt chứng từ bán hàng.")

    # 2. Check document status (EF-02, EF-05, BR-SAL-08-02)
    if doc.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ không ở trạng thái Chờ duyệt.")

    # 3. Check optimistic concurrency (EF-03, BR-SAL-08-04)
    if version is not None and int(version) != getattr(doc, "version", 1):
        raise ValidationError("Nội dung chứng từ đã thay đổi. Vui lòng tải lại để kiểm tra.")

    # 4. Check user assignment, limit & self-approval (BR-SAL-08-01, BR-SAL-08-07, EF-06)
    check_approver_assignment_and_limit(doc, user, document_type_code)

    # 5. Validate comment length & requirements (EF-04, BR-SAL-08-08)
    comment_clean = (comment or "").strip()
    if action == "REQUEST_REVISION":
        if not comment_clean:
            raise ValidationError("Vui lòng nhập nội dung yêu cầu chỉnh sửa.")
        if len(comment_clean) > 500:
            raise ValidationError("Nội dung yêu cầu chỉnh sửa tối đa 500 ký tự.")
    elif action == "REJECT":
        if not comment_clean:
            raise ValidationError("Vui lòng nhập lý do từ chối.")
        if len(comment_clean) > 500:
            raise ValidationError("Lý do từ chối tối đa 500 ký tự.")
    elif action == "APPROVE":
        if comment_clean and len(comment_clean) > 500:
            raise ValidationError("Ý kiến phê duyệt tối đa 500 ký tự.")
    else:
        raise ValidationError(f"Hành động '{action}' không hợp lệ.")

    # 6. Check duplicate decision by same user at same level and version (BR-SAL-08-06, BR-SAL-08-13)
    actor = getattr(user, "iam_account", None)
    decisions = models.ApprovalDecision.objects.filter(
        company=company, document_type=document_type_code, document_id=doc.pk
    )
    current_level = decisions.filter(decision="APPROVED").count() + 1

    if actor and decisions.filter(actor=actor, level=current_level, document_version=getattr(doc, "version", 1)).exists():
        raise ValidationError("User đã phê duyệt bước này.")

    # 7. Compute next status (BR-SAL-08-05, BR-SAL-08-06, BR-SAL-08-11)
    previous_status = doc.status
    final_approval = False

    if action == "APPROVE":
        if doc.workflow_snapshot and doc.workflow_snapshot.get("version_id"):
            progress = approval_progress(doc, actor, True, decisions)
            if progress:
                current_level = progress["level"]
                final_approval = progress["final"]
            else:
                total_levels = int(doc.workflow_snapshot.get("levels", 1))
                final_approval = current_level >= total_levels
        else:
            total_levels = int(doc.workflow_snapshot.get("levels", 1)) if doc.workflow_snapshot else 1
            final_approval = current_level >= total_levels

        if final_approval:
            # BR-SAL-08-11: Duyệt đủ cấp chỉ cập nhật trạng thái tương ứng của chứng từ; không tự ghi sổ/phát hành
            if document_type_code == "CONTRACT" and hasattr(doc, "start_date") and doc.start_date:
                today = timezone.localdate()
                doc.status = "IN_PROGRESS" if today >= doc.start_date else models.DocumentStatus.APPROVED
            else:
                doc.status = models.DocumentStatus.APPROVED
            doc.approved_at = timezone.now()
        else:
            doc.status = models.DocumentStatus.PENDING_APPROVAL

    elif action == "REQUEST_REVISION":
        doc.status = models.DocumentStatus.REVISION_REQUIRED
        if hasattr(doc, "rejection_reason"):
            doc.rejection_reason = comment_clean

    elif action == "REJECT":
        doc.status = models.DocumentStatus.REJECTED
        if hasattr(doc, "rejection_reason"):
            doc.rejection_reason = comment_clean

    # Increment version
    if hasattr(doc, "version"):
        doc.version += 1

    update_fields = ["status", "updated_at"]
    if hasattr(doc, "version"):
        update_fields.append("version")
    if hasattr(doc, "approved_at"):
        update_fields.append("approved_at")
    if hasattr(doc, "rejection_reason"):
        update_fields.append("rejection_reason")
    doc.save(update_fields=tuple(update_fields))

    # 8. Record ApprovalDecision
    dec_type = "APPROVED" if action == "APPROVE" else "REVISION_REQUIRED" if action == "REQUEST_REVISION" else "REJECTED"

    models.ApprovalDecision.objects.create(
        company=company,
        document_type=document_type_code,
        document_id=doc.pk,
        document_version=getattr(doc, "version", 1) - 1,
        workflow_version=str(doc.workflow_snapshot.get("version", "")) if doc.workflow_snapshot else "",
        level=current_level,
        decision=dec_type,
        actor=actor,
        comment=comment_clean,
    )

    # 9. Update ApprovalRequest & ApprovalTask if exists
    if hasattr(doc, "_meta"):
        inbox = ApprovalRequest.objects.filter(source_model=doc._meta.label, source_id=doc.pk).order_by("-round_number").first()
        if inbox:
            task = inbox.tasks.filter(step_order=current_level, cycle=inbox.cycle, status="PENDING").filter(assignee_id=actor.id).first()
            if task:
                task.status = "COMPLETED" if action == "APPROVE" else "CHANGES_REQUESTED" if action == "REQUEST_REVISION" else "REJECTED"
                task.completed_at = timezone.now()
                task.save(update_fields=("status", "completed_at"))
            if final_approval:
                inbox.status = "APPROVED"
                inbox.completed_at = timezone.now()
                inbox.save(update_fields=("status", "completed_at"))
            elif action == "REQUEST_REVISION":
                inbox.status = "CHANGES_REQUESTED"
                inbox.save(update_fields=("status",))
            elif action == "REJECT":
                inbox.status = "REJECTED"
                inbox.save(update_fields=("status",))

    # 10. Audit log (BR-SAL-08-14)
    audit(
        request,
        doc,
        action,
        before={"status": previous_status, "version": getattr(doc, "version", 1) - 1},
        after={"status": doc.status, "level": current_level, "version": getattr(doc, "version", 1)},
        reason=comment_clean,
    )

    msg_map = {
        "APPROVE": "Phê duyệt chứng từ thành công.",
        "REQUEST_REVISION": "Yêu cầu chỉnh sửa chứng từ thành công.",
        "REJECT": "Từ chối chứng từ thành công.",
    }
    return {
        "message": msg_map.get(action, "Xử lý thành công."),
        "status": doc.status,
        "document_id": str(doc.pk),
        "document_type": document_type_code,
        "version": getattr(doc, "version", 1),
    }


@transaction.atomic
def execute_approval_withdrawal(
    company,
    user,
    document_type_code,
    document_id,
    reason="",
    version=None,
    request=None,
):
    """Sender/creator withdraws pending request back to DRAFT (AF-04, BR-SAL-08-09)."""
    model = get_document_model(document_type_code)
    qs = model.objects.select_for_update()
    doc = qs.filter(pk=document_id, company=company).first()
    if not doc:
        raise NotFound("Chứng từ không tồn tại.")

    # Check status
    if doc.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ không ở trạng thái Chờ duyệt để thu hồi.")

    actor = getattr(user, "iam_account", None)
    if not actor:
        raise PermissionDenied("Bạn không có tài khoản nhân viên hợp lệ.")

    # Check actor is creator or superuser (BR-SAL-08-09)
    if doc.created_by_id != actor.id and not user.is_superuser:
        raise PermissionDenied("Chỉ người tạo/người gửi mới có quyền thu hồi yêu cầu phê duyệt.")

    # Concurrency check
    if version is not None and int(version) != getattr(doc, "version", 1):
        raise ValidationError("Nội dung chứng từ đã thay đổi. Vui lòng tải lại để kiểm tra.")

    previous_status = doc.status
    doc.status = models.DocumentStatus.DRAFT
    if hasattr(doc, "withdrawal_reason"):
        doc.withdrawal_reason = reason
    if hasattr(doc, "version"):
        doc.version += 1

    update_fields = ["status", "updated_at"]
    if hasattr(doc, "version"):
        update_fields.append("version")
    if hasattr(doc, "withdrawal_reason"):
        update_fields.append("withdrawal_reason")
    doc.save(update_fields=tuple(update_fields))

    # Record ApprovalDecision
    models.ApprovalDecision.objects.create(
        company=company,
        document_type=document_type_code,
        document_id=doc.pk,
        document_version=getattr(doc, "version", 1) - 1,
        workflow_version=str(doc.workflow_snapshot.get("version", "")) if doc.workflow_snapshot else "",
        level=1,
        decision="WITHDRAWN",
        actor=actor,
        comment=reason,
    )

    # Update ApprovalRequest if exists
    if hasattr(doc, "_meta"):
        inbox = ApprovalRequest.objects.filter(source_model=doc._meta.label, source_id=doc.pk).order_by("-round_number").first()
        if inbox:
            inbox.status = "CANCELLED"
            inbox.save(update_fields=("status",))

    # Audit log
    audit(
        request,
        doc,
        "WITHDRAW",
        before={"status": previous_status, "version": getattr(doc, "version", 1) - 1},
        after={"status": doc.status, "version": getattr(doc, "version", 1)},
        reason=reason,
    )

    return {
        "message": "Thu hồi yêu cầu phê duyệt thành công.",
        "status": doc.status,
        "document_id": str(doc.pk),
        "document_type": document_type_code,
        "version": getattr(doc, "version", 1),
    }
