from decimal import Decimal

from rest_framework.exceptions import ValidationError

from master_data.models import DocumentType

from .services import preview_selection
from .validation import eligible_approvers, resolve_approver


def document_context(obj):
    context = {}
    for field in ("total_amount", "amount", "branch_id", "department_id", "transaction_type",
                  "payment_method", "party_id", "supplier_id", "customer_id", "project_id",
                  "cost_center_id", "currency_id"):
        value = getattr(obj, field, None)
        if value is not None:
            context[field] = str(value)
    if "total_amount" not in context and getattr(obj, "total_value", None) is not None:
        context["total_amount"] = str(obj.total_value)
    if "total_amount" not in context and getattr(obj, "total_debit", None) is not None:
        context["total_amount"] = str(obj.total_debit)
    if "total_amount" not in context and getattr(obj, "amount", None) is not None:
        context["total_amount"] = str(obj.amount)
    if "transaction_type" not in context and getattr(obj, "entry_type", None):
        context["transaction_type"] = str(obj.entry_type)
    if getattr(obj, "asset_id", None):
        context.setdefault("branch_id", str(obj.asset.branch_id))
        if obj.asset.department_id:
            context.setdefault("department_id", str(obj.asset.department_id))
    if "total_amount" not in context and hasattr(obj, "lines"):
        lines = obj.lines.all()
        if lines.exists() and all(hasattr(line, "estimated_unit_price") for line in lines):
            context["total_amount"] = str(sum(
                (Decimal(str(line.quantity)) * Decimal(str(line.estimated_unit_price)) for line in lines),
                Decimal("0"),
            ))
    if "supplier_id" not in context and getattr(obj, "proposed_supplier_id", None):
        context["supplier_id"] = str(obj.proposed_supplier_id)
    context["unit_id"] = str(getattr(obj, "organization_unit_id", "") or "")
    context["requester_user_id"] = str(getattr(obj, "created_by_id", "") or "")
    for field in ("owner_user_id", "manager_user_id"):
        value = getattr(obj, field, None)
        if value:
            context[field] = str(value)
    return context


def configured_snapshot(obj, document_type_code):
    """Return None for legacy document types without a configured policy."""
    if getattr(obj, "pk", None):
        from .models import ApprovalRequest
        previous = ApprovalRequest.objects.filter(source_model=obj._meta.label, source_id=obj.pk).order_by("-round_number").first()
        if previous and previous.status == "CHANGES_REQUESTED" and previous.snapshot.get("resume_step"):
            return dict(previous.snapshot)
    document_type = DocumentType.objects.filter(code=document_type_code, status="ACTIVE").first()
    if document_type is None:
        return None
    selection = preview_selection(company=obj.company, document_type=document_type,
                                  context=document_context(obj))
    policy = selection["policy"]
    if policy is None:
        return None
    if policy == "NOT_REQUIRED":
        return {"policy": policy, "approval_required": False, "version": "", "levels": 0,
                "allow_self_approval": False, "steps": []}
    version = selection["workflow"]
    if version is None:
        return {"policy": policy, "approval_required": False, "version": "", "levels": 0,
                "allow_self_approval": False, "steps": []}
    context = document_context(obj)
    first = version.steps[0] if version.steps else None
    approvers = set().union(*(resolve_approver(rule, obj.company, context)
                              for rule in first.get("approvers", []))) if first else set()
    approvers = eligible_approvers(approvers, obj.company, document_type, context)
    if not approvers and first and first.get("fallback"):
        approvers = eligible_approvers(resolve_approver(first["fallback"], obj.company, context),
                                       obj.company, document_type, context)
    if not approvers:
        raise ValidationError("Workflow không xác định được Approver cho bước đầu.")
    return {"policy": policy, "approval_required": True, "workflow_id": str(version.workflow_id),
            "document_type_code": document_type.code,
            "version_id": str(version.pk), "version": str(version.pk),
            "levels": len(version.steps), "allow_self_approval": version.allow_self_approval,
            "conditions": version.conditions, "steps": version.steps,
            "first_step_approvers": sorted(approvers)}
