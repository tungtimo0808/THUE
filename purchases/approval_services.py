from decimal import Decimal
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from approval_workflows.execution import approval_progress
from approval_workflows.models import ApprovalRequest, ApprovalTask
from approval_workflows.submission import document_context
from approval_workflows.validation import eligible_approvers, resolve_approver
from iam.permissions import has_effective_permission

from .models import (
    ApprovalDecision,
    GoodsPurchase,
    PurchaseContract,
    PurchaseCost,
    PurchaseDiscount,
    PurchaseOrder,
    PurchaseRequest,
    PurchaseReturn,
)
from .services import audit


DOC_MODELS = {
    "REQUEST": PurchaseRequest,
    "ORDER": PurchaseOrder,
    "GOODS": GoodsPurchase,
    "SERVICE": GoodsPurchase,
    "RETURN": PurchaseReturn,
    "DISCOUNT": PurchaseDiscount,
    "COST": PurchaseCost,
    "CONTRACT": PurchaseContract,
}

DOC_TYPE_NAMES = {
    "REQUEST": "Yêu cầu mua hàng",
    "ORDER": "Đơn mua hàng",
    "GOODS": "Chứng từ mua hàng hóa",
    "SERVICE": "Chứng từ mua dịch vụ",
    "RETURN": "Chứng từ hàng mua trả lại",
    "DISCOUNT": "Chứng từ giảm giá hàng mua",
    "COST": "Chứng từ chi phí mua hàng",
    "CONTRACT": "Hợp đồng mua hàng",
}

DOC_PERMISSIONS = {
    "REQUEST": "PUR.REQUEST.APPROVE",
    "ORDER": "PUR.ORDER.APPROVE",
    "GOODS": "PUR.GOODS.APPROVE",
    "SERVICE": "PUR.SERVICE.APPROVE",
    "RETURN": "PUR.RETURN.APPROVE",
    "DISCOUNT": "PUR.DISCOUNT.APPROVE",
    "COST": "PUR.COST.APPROVE",
    "CONTRACT": "PUR.CONTRACT.APPROVE",
}


def check_approval_permission(user, company, document_type_code, branch_id=None):
    if user.is_superuser:
        return True
    actor = getattr(user, "iam_account", None)
    if not actor:
        return False
    if has_effective_permission(actor, company, "PUR.APPROVAL.APPROVE", branch_id=branch_id):
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
    if document_type_code == "SERVICE":
        qs = qs.filter(purchase_type="SERVICE")
    elif document_type_code == "GOODS":
        qs = qs.exclude(purchase_type="SERVICE")
    if company_id:
        qs = qs.filter(company_id=company_id)
    doc = qs.filter(pk=document_id).first()
    if not doc:
        raise NotFound("Chứng từ không tồn tại.")
    return doc


def get_document_total(doc):
    if hasattr(doc, "total_amount") and doc.total_amount is not None:
        return Decimal(str(doc.total_amount))
    if hasattr(doc, "lines"):
        lines = doc.lines.all()
        if lines.exists() and all(hasattr(line, "estimated_unit_price") for line in lines):
            return sum(
                (Decimal(str(line.quantity)) * Decimal(str(line.estimated_unit_price or 0)) for line in lines),
                Decimal("0"),
            )
    return Decimal("0")


def check_approver_assignment_and_limit(doc, user, document_type_code):
    """Verify if user is assigned at current approval step and check approval limit."""
    actor = user.iam_account if hasattr(user, "iam_account") else None
    if not actor:
        raise PermissionDenied("Bạn không có tài khoản nhân viên hợp lệ.")

    # BR-PUR-APR-05: Check self-approval
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
        decisions = ApprovalDecision.objects.filter(document_type=document_type_code, document_id=doc.pk)
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


def list_pending_approvals(company, user, document_type_filter=None):
    results = []
    types_to_check = [document_type_filter] if document_type_filter else list(DOC_MODELS.keys())

    for dt_code in types_to_check:
        if dt_code not in DOC_MODELS:
            continue
        model = DOC_MODELS[dt_code]
        qs = model.objects.filter(company=company, status="PENDING_APPROVAL")
        if dt_code == "SERVICE":
            qs = qs.filter(purchase_type="SERVICE")
        elif dt_code == "GOODS":
            qs = qs.exclude(purchase_type="SERVICE")

        qs = qs.select_related("created_by", "branch")
        if hasattr(model, "supplier"):
            qs = qs.select_related("supplier")

        for doc in qs:
            # Check permission
            if not check_approval_permission(user, company, dt_code, branch_id=doc.branch_id):
                continue
            # Check assignment
            try:
                check_approver_assignment_and_limit(doc, user, dt_code)
            except (PermissionDenied, ValidationError):
                continue

            decisions = ApprovalDecision.objects.filter(document_type=dt_code, document_id=doc.pk)
            current_level = decisions.filter(decision="APPROVED").count() + 1
            total_levels = int(doc.workflow_snapshot.get("levels", 1)) if doc.workflow_snapshot else 1

            results.append(
                {
                    "document_type": dt_code,
                    "document_type_name": DOC_TYPE_NAMES.get(dt_code, dt_code),
                    "document_id": str(doc.pk),
                    "number": doc.number,
                    "document_date": str(doc.document_date),
                    "creator_id": str(doc.created_by_id) if doc.created_by_id else None,
                    "creator_name": get_user_display_name(doc.created_by),
                    "supplier_id": str(doc.supplier_id) if getattr(doc, "supplier_id", None) else None,
                    "supplier_name": doc.supplier.name if getattr(doc, "supplier", None) else "",
                    "branch_id": str(doc.branch_id) if doc.branch_id else None,
                    "branch_name": doc.branch.name if doc.branch else "",
                    "total_amount": str(get_document_total(doc)),
                    "current_level": current_level,
                    "total_levels": total_levels,
                    "submitted_at": str(doc.submitted_at or doc.created_at),
                    "version": doc.version,
                    "notes": getattr(doc, "notes", ""),
                }
            )

    results.sort(key=lambda x: x["submitted_at"], reverse=True)
    return results


def get_approval_detail(company, user, document_type_code, document_id):
    doc = get_document(document_type_code, document_id, company_id=company.pk)
    if not check_approval_permission(user, company, document_type_code, branch_id=doc.branch_id):
        raise PermissionDenied("Bạn không có quyền phê duyệt chứng từ mua hàng.")

    # Document details
    supplier_info = None
    if getattr(doc, "supplier", None):
        supplier_info = {
            "id": str(doc.supplier.id),
            "code": getattr(doc.supplier, "code", ""),
            "name": doc.supplier.name,
        }

    branch_info = None
    if doc.branch:
        branch_info = {"id": str(doc.branch.id), "name": doc.branch.name, "code": getattr(doc.branch, "code", "")}

    # Lines
    lines_data = []
    if hasattr(doc, "lines"):
        for line in doc.lines.select_related("item", "uom").all().order_by("line_no"):
            line_dict = {
                "id": str(line.id),
                "line_no": getattr(line, "line_no", 1),
                "item_id": str(line.item_id) if getattr(line, "item_id", None) else None,
                "item_code": getattr(line.item, "code", "") if getattr(line, "item", None) else "",
                "item_name": getattr(line.item, "name", "") if getattr(line, "item", None) else getattr(line, "description", ""),
                "uom_id": str(line.uom_id) if getattr(line, "uom_id", None) else None,
                "uom_name": getattr(line.uom, "name", "") if getattr(line, "uom", None) else "",
                "quantity": str(getattr(line, "quantity", Decimal("1"))),
                "unit_price": str(getattr(line, "unit_price", getattr(line, "estimated_unit_price", Decimal("0")))),
                "total_amount": str(getattr(line, "total_amount", getattr(line, "pre_tax_amount", Decimal("0")))),
            }
            if hasattr(line, "discount_rate"):
                line_dict["discount_rate"] = str(line.discount_rate)
            if hasattr(line, "tax_amount"):
                line_dict["tax_amount"] = str(line.tax_amount)
            lines_data.append(line_dict)

    # Workflow & History
    decisions = ApprovalDecision.objects.filter(
        document_type=document_type_code, document_id=doc.pk
    ).select_related("actor").order_by("decided_at")

    history_data = [
        {
            "id": str(dec.id),
            "level": dec.level,
            "decision": dec.decision,
            "actor_id": str(dec.actor_id),
            "actor_name": get_user_display_name(dec.actor),
            "comment": dec.comment,
            "decided_at": str(dec.decided_at),
            "document_version": dec.document_version,
        }
        for dec in decisions
    ]

    current_level = decisions.filter(decision="APPROVED").count() + 1
    total_levels = int(doc.workflow_snapshot.get("levels", 1)) if doc.workflow_snapshot else 1

    return {
        "document_type": document_type_code,
        "document_type_name": DOC_TYPE_NAMES.get(document_type_code, document_type_code),
        "document_id": str(doc.pk),
        "number": doc.number,
        "document_date": str(doc.document_date),
        "posting_date": str(getattr(doc, "posting_date", doc.document_date)),
        "status": doc.status,
        "version": doc.version,
        "total_amount": str(get_document_total(doc)),
        "notes": getattr(doc, "notes", ""),
        "creator": {
            "id": str(doc.created_by_id) if doc.created_by_id else None,
            "name": get_user_display_name(doc.created_by),
            "submitted_at": str(doc.submitted_at or doc.created_at),
        },
        "supplier": supplier_info,
        "branch": branch_info,
        "lines": lines_data,
        "workflow": {
            "current_level": current_level,
            "total_levels": total_levels,
            "is_final_level": current_level >= total_levels,
            "allow_self_approval": doc.workflow_snapshot.get("allow_self_approval", False) if doc.workflow_snapshot else False,
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
    model = get_document_model(document_type_code)
    qs = model.objects.select_for_update()
    if document_type_code == "SERVICE":
        qs = qs.filter(purchase_type="SERVICE")
    elif document_type_code == "GOODS":
        qs = qs.exclude(purchase_type="SERVICE")
    doc = qs.filter(pk=document_id, company=company).first()
    if not doc:
        raise NotFound("Chứng từ không tồn tại.")

    # 1. Check permission EF-01
    if not check_approval_permission(user, company, document_type_code, branch_id=doc.branch_id):
        raise PermissionDenied("Bạn không có quyền phê duyệt chứng từ mua hàng.")

    # 2. Check document status EF-02
    if doc.status != "PENDING_APPROVAL":
        raise ValidationError("Chứng từ đã được xử lý hoặc thay đổi trạng thái.")

    # 3. Check optimistic concurrency EF-07
    if version is not None and int(version) != doc.version:
        raise ValidationError("Nội dung chứng từ đã thay đổi. Vui lòng tải lại để kiểm tra.")

    # 4. Check user assignment and limit EF-03, EF-08, BR-PUR-APR-05
    check_approver_assignment_and_limit(doc, user, document_type_code)

    # 5. Validate comment length & requirements EF-05, EF-06
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

    # 6. Check duplicate decision by same user at same level and version BR-PUR-APR-20
    actor = user.iam_account
    decisions = ApprovalDecision.objects.filter(document_type=document_type_code, document_id=doc.pk)
    current_level = decisions.filter(decision="APPROVED").count() + 1

    if decisions.filter(actor=actor, level=current_level, document_version=doc.version).exists():
        raise ValidationError("User đã phê duyệt bước này.")

    # 7. Compute next status
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
            if document_type_code == "CONTRACT" and hasattr(doc, "start_date") and doc.start_date:
                today = timezone.now().date()
                doc.status = "IN_PROGRESS" if today >= doc.start_date else "APPROVED"
            else:
                doc.status = "APPROVED"
            doc.approved_at = timezone.now()
        else:
            doc.status = "PENDING_APPROVAL"

    elif action == "REQUEST_REVISION":
        doc.status = "REVISION_REQUIRED"
    elif action == "REJECT":
        doc.status = "REJECTED"
    else:
        raise ValidationError(f"Hành động '{action}' không hợp lệ.")

    doc.version += 1
    doc.save(update_fields=("status", "version", "approved_at", "updated_at") if hasattr(doc, "approved_at") else ("status", "version", "updated_at"))

    # 8. Record ApprovalDecision
    dec_type = "APPROVED" if (action == "APPROVE" and final_approval) else "APPROVED" if action == "APPROVE" else "REVISION_REQUIRED" if action == "REQUEST_REVISION" else "REJECTED"

    ApprovalDecision.objects.create(
        company=company,
        document_type=document_type_code,
        document_id=doc.pk,
        document_version=doc.version - 1,  # Version at time of review
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

    # 10. Audit log
    audit(
        request,
        doc,
        action,
        before={"status": previous_status, "version": doc.version - 1},
        after={"status": doc.status, "level": current_level, "version": doc.version},
        reason=comment_clean,
    )

    return {
        "message": "Phê duyệt chứng từ thành công." if action == "APPROVE" else "Yêu cầu chỉnh sửa chứng từ thành công." if action == "REQUEST_REVISION" else "Từ chối chứng từ thành công.",
        "status": doc.status,
        "document_id": str(doc.pk),
        "document_type": document_type_code,
        "version": doc.version,
    }
