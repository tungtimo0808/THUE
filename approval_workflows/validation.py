from decimal import Decimal, InvalidOperation
from datetime import date
from uuid import UUID

from django.db import models
from django.apps import apps
from django.utils import timezone

from iam.models import CompanyMembership, Role, UserAccount
from iam.permissions import has_effective_permission
from organization.models import Branch, Department, OrganizationUnit, Position


CONDITION_FIELDS = {
    "total_amount": "number", "amount": "number", "branch_id": "uuid",
    "department_id": "uuid", "transaction_type": "text", "payment_method": "text",
    "party_id": "uuid", "supplier_id": "uuid", "customer_id": "uuid",
    "project_id": "uuid", "cost_center_id": "uuid", "currency_id": "uuid",
}
OPERATORS = {"eq", "ne", "gt", "gte", "lt", "lte", "in"}
MODES = {"ANY_ONE", "ALL", "MINIMUM", "SEQUENTIAL", "PARALLEL"}
APPROVERS = {"USER", "ROLE", "POSITION", "UNIT_MANAGER", "DOCUMENT_FIELD", "PREVIOUS_STEP_RESULT", "DYNAMIC_RULE"}


def _uuid(value):
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _value_valid(kind, value):
    if kind == "number":
        try:
            Decimal(str(value))
            return True
        except (InvalidOperation, TypeError, ValueError):
            return False
    if kind == "uuid":
        return _uuid(value) is not None
    return isinstance(value, str) and bool(value.strip())


def allowed_fields(document_type):
    code = document_type.code
    mapping = {
        "PUR.REQUEST": ("purchases", "PurchaseRequest"),
        "PUR.ORDER": ("purchases", "PurchaseOrder"),
        "PUR.CONTRACT": ("purchases", "PurchaseContract"),
        "AP.INVOICE": ("accounts_payable", "SupplierInvoice"),
        "AP.PAYMENT_REQUEST": ("accounts_payable", "PaymentRequest"),
        "SAL.QUOTATION": ("sales", "SalesQuotation"),
        "SAL.ORDER": ("sales", "SalesOrder"),
        "SAL.CONTRACT": ("sales", "SalesContract"),
        "SAL.GOODS_SALE": ("sales", "GoodsSale"),
        "SAL.SERVICE_SALE": ("sales", "ServiceSale"),
        "SAL.SALES_RETURN": ("sales", "SalesReturn"),
        "SAL.SALES_ALLOWANCE": ("sales", "SalesAllowance"),
        "SAL.SALES_INVOICE": ("sales", "SalesInvoice"),
    }
    if code.startswith("AR."):
        model = apps.get_model("accounts_receivable", "ReceivableDocument")
    elif code.startswith("INV."):
        model = apps.get_model("inventory", "InventoryTransaction")
    elif code.startswith("CASH."):
        model = apps.get_model("cash_management", "CashTransaction")
    elif code.startswith("BANK."):
        model = apps.get_model("bank_management", "BankTransaction")
    elif code.startswith("FA."):
        model = apps.get_model("fixed_assets", "AssetTransaction")
    elif code == "GL.JOURNAL_ENTRY":
        model = apps.get_model("general_ledger", "JournalEntry")
    elif code in mapping:
        model = apps.get_model(*mapping[code])
    else:
        return set(CONDITION_FIELDS)
    fields = {item.name for item in model._meta.fields}
    fields |= {item.attname for item in model._meta.fields if hasattr(item, "attname")}
    if code == "PUR.REQUEST":
        fields.add("total_amount")  # Sum of quantity * estimated_unit_price on request lines.
        fields.add("supplier_id")  # proposed_supplier_id alias
    if code.startswith("INV."):
        fields.add("total_amount")  # total_value alias
    if code.startswith("FA.") or code == "GL.JOURNAL_ENTRY":
        fields.add("total_amount")  # amount or total_debit alias
    if code.startswith("FA."):
        fields.update(("branch_id", "department_id"))  # asset organization aliases
    if code == "GL.JOURNAL_ENTRY":
        fields.add("transaction_type")  # entry_type alias
    return set(CONDITION_FIELDS) & fields


def validate_conditions(node, path="conditions", depth=0, allowed=None):
    errors = []
    if not node:
        return errors
    if depth > 5 or not isinstance(node, dict):
        return [f"{path}: nhóm điều kiện không hợp lệ."]
    if "rules" in node:
        rules = node.get("rules")
        if node.get("op") not in ("AND", "OR") or not isinstance(rules, list) or not rules:
            return [f"{path}: cần AND/OR và danh sách điều kiện."]
        for index, rule in enumerate(rules):
            errors += validate_conditions(rule, f"{path}.rules[{index}]", depth + 1, allowed)
        return errors
    field = node.get("field")
    operator = node.get("operator")
    kind = CONDITION_FIELDS.get(field)
    if kind is None or operator not in OPERATORS:
        return [f"{path}: trường hoặc toán tử không được hỗ trợ."]
    if allowed is not None and field not in allowed:
        return [f"{path}: trường không tồn tại trên loại chứng từ."]
    value = node.get("value")
    if operator == "in":
        if not isinstance(value, list) or not value or not all(_value_valid(kind, item) for item in value):
            errors.append(f"{path}: danh sách giá trị không hợp lệ.")
    elif not _value_valid(kind, value):
        errors.append(f"{path}: giá trị không đúng kiểu {kind}.")
    if kind in ("text", "uuid") and operator not in ("eq", "ne", "in"):
        errors.append(f"{path}: kiểu dữ liệu chỉ hỗ trợ eq/ne/in.")
    return errors


def _normalize(kind, value):
    if value is None:
        return None
    if kind == "number":
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return None
    return str(value)


def matches_conditions(node, context):
    if not node:
        return True
    if "rules" in node:
        values = [matches_conditions(rule, context) for rule in node["rules"]]
        return all(values) if node["op"] == "AND" else any(values)
    field, operator = node["field"], node["operator"]
    actual = _normalize(CONDITION_FIELDS[field], context.get(field))
    if actual is None:
        return False
    expected = node["value"]
    if operator == "in":
        return actual in {_normalize(CONDITION_FIELDS[field], item) for item in expected}
    expected = _normalize(CONDITION_FIELDS[field], expected)
    return {"eq": lambda: actual == expected, "ne": lambda: actual != expected,
            "gt": lambda: actual > expected, "gte": lambda: actual >= expected,
            "lt": lambda: actual < expected, "lte": lambda: actual <= expected}[operator]()


def condition_specificity(node):
    if not node:
        return 0
    if "rules" in node:
        return sum(condition_specificity(item) for item in node["rules"])
    return 1


def condition_signature(node):
    if not node:
        return ()
    if "rules" in node:
        return (node["op"], tuple(sorted((condition_signature(item) for item in node["rules"]), key=repr)))
    value = node["value"]
    if node["operator"] == "in":
        value = tuple(sorted((str(item) for item in value)))
    else:
        value = str(value)
    return (node["field"], node["operator"], value)


def resolve_approver(rule, company, context=None, previous=None):
    supplied_context = context is not None
    context = context or {}
    kind = rule.get("type")
    value = rule.get("id")
    today = timezone.localdate()
    try:
        if rule.get("valid_from") and today < date.fromisoformat(rule["valid_from"]):
            return set()
        if rule.get("valid_to") and today > date.fromisoformat(rule["valid_to"]):
            return set()
    except (TypeError, ValueError):
        return set()
    if supplied_context and isinstance(rule.get("scope"), dict):
        if any(str(context.get(key)) != str(value) for key, value in rule["scope"].items()):
            return set()
    if kind == "USER":
        user = UserAccount.objects.filter(pk=_uuid(value), auth_user__is_active=True,
                                          memberships__company=company, memberships__membership_status="ACTIVE").first()
        return {str(user.pk)} if user else set()
    if kind == "ROLE":
        role = Role.objects.filter(pk=_uuid(value), company=company, status="ACTIVE").first()
        if not role:
            return set()
        return set(str(pk) for pk in CompanyMembership.objects.filter(
            company=company, membership_status="ACTIVE", user__auth_user__is_active=True,
            role_assignments__role=role, role_assignments__status="ACTIVE",
            role_assignments__valid_from__lte=timezone.now(),
        ).filter(models.Q(role_assignments__valid_to__isnull=True) | models.Q(role_assignments__valid_to__gte=timezone.now())).values_list("user_id", flat=True).distinct())
    if kind == "POSITION":
        position = Position.objects.filter(pk=_uuid(value), company=company, status="ACTIVE").first()
        if not position:
            return set()
        from iam.models import OrganizationAssignment
        return set(str(pk) for pk in OrganizationAssignment.objects.filter(
            membership__company=company, membership__membership_status="ACTIVE",
            membership__user__auth_user__is_active=True, position=position,
            status__in=("ACTIVE", "SCHEDULED"), start_date__lte=today,
        ).filter(models.Q(end_date__isnull=True) | models.Q(end_date__gte=today)).values_list("membership__user_id", flat=True))
    if kind == "UNIT_MANAGER":
        unit_id = _uuid(value or context.get("unit_id"))
        unit = OrganizationUnit.objects.filter(pk=unit_id, company=company, status="ACTIVE").select_related("manager_membership__user__auth_user").first()
        manager = unit.manager_membership if unit else None
        return {str(manager.user_id)} if manager and manager.membership_status == "ACTIVE" and manager.user.auth_user.is_active else set()
    if kind == "DOCUMENT_FIELD":
        user_id = _uuid(context.get(rule.get("field")))
        return resolve_approver({"type": "USER", "id": user_id}, company) if user_id else set()
    if kind == "PREVIOUS_STEP_RESULT":
        return set(previous or [])
    if kind == "DYNAMIC_RULE" and rule.get("strategy") == "UNIT_MANAGER":
        return resolve_approver({"type": "UNIT_MANAGER"}, company, context)
    return set()


def eligible_approvers(user_ids, company, document_type, context=None):
    context = context or {}
    code = f"{document_type.code}.APPROVE"
    allowed = set()
    for user_id in user_ids:
        user = UserAccount.objects.filter(pk=_uuid(user_id)).first()
        if user and has_effective_permission(user, company, code,
                                             branch_id=context.get("branch_id"),
                                             department_id=context.get("department_id")):
            allowed.add(str(user.pk))
    return allowed


def validate_steps(steps, company, *, allow_empty=False):
    errors, warnings = [], []
    if not isinstance(steps, list) or len(steps) > 20 or (not steps and not allow_empty):
        return ["steps: cần từ 1 đến 20 bước phê duyệt."], warnings
    orders = [step.get("order") for step in steps if isinstance(step, dict)]
    if orders != list(range(1, len(steps) + 1)):
        errors.append("steps: thứ tự phải liên tiếp từ 1, không trùng hoặc thiếu.")
    for index, step in enumerate(steps):
        path = f"steps[{index}]"
        if not isinstance(step, dict):
            errors.append(f"{path}: bước không hợp lệ.")
            continue
        if not str(step.get("name", "")).strip():
            errors.append(f"{path}.name: bắt buộc.")
        approvers = step.get("approvers")
        if not isinstance(approvers, list) or not approvers:
            errors.append(f"{path}.approvers: cần ít nhất một quy tắc.")
            continue
        mode = step.get("mode")
        if mode not in MODES:
            errors.append(f"{path}.mode: không hợp lệ.")
        fallback_rule = step.get("fallback")
        if fallback_rule is not None:
            if not isinstance(fallback_rule, dict):
                errors.append(f"{path}.fallback: quy tắc không hợp lệ.")
            else:
                try:
                    valid_from = date.fromisoformat(fallback_rule["valid_from"])
                    valid_to = date.fromisoformat(fallback_rule["valid_to"])
                    if valid_to < valid_from:
                        raise ValueError
                except (KeyError, TypeError, ValueError):
                    errors.append(f"{path}.fallback: cần thời gian hiệu lực hợp lệ.")
                scope = fallback_rule.get("scope", {})
                if not isinstance(scope, dict) or any(key not in ("branch_id", "department_id") or not _uuid(value)
                                                      for key, value in scope.items()):
                    errors.append(f"{path}.fallback: phạm vi đơn vị không hợp lệ.")
                elif (scope.get("branch_id") and not Branch.objects.filter(pk=_uuid(scope["branch_id"]), company=company, status="ACTIVE").exists()) or \
                     (scope.get("department_id") and not Department.objects.filter(pk=_uuid(scope["department_id"]), company=company, status="ACTIVE").exists()):
                    errors.append(f"{path}.fallback: phạm vi nằm ngoài doanh nghiệp.")
        for rule in approvers + ([step["fallback"]] if isinstance(step.get("fallback"), dict) else []):
            if not isinstance(rule, dict) or rule.get("type") not in APPROVERS:
                errors.append(f"{path}.approvers: loại Approver không hợp lệ.")
                continue
            kind = rule["type"]
            if kind in ("USER", "ROLE", "POSITION") and not _uuid(rule.get("id")):
                errors.append(f"{path}.approvers: thiếu ID hợp lệ.")
            if kind == "USER" and _uuid(rule.get("id")) and not CompanyMembership.objects.filter(
                company=company, user_id=_uuid(rule["id"]), membership_status="ACTIVE",
                user__auth_user__is_active=True).exists():
                errors.append(f"{path}.approvers: User không thuộc doanh nghiệp hoặc đã ngừng.")
            if kind == "ROLE" and _uuid(rule.get("id")) and not Role.objects.filter(
                pk=_uuid(rule["id"]), company=company, status="ACTIVE").exists():
                errors.append(f"{path}.approvers: Role không thuộc doanh nghiệp hoặc đã ngừng.")
            if kind == "POSITION" and _uuid(rule.get("id")) and not Position.objects.filter(
                pk=_uuid(rule["id"]), company=company, status="ACTIVE").exists():
                errors.append(f"{path}.approvers: Chức vụ không thuộc doanh nghiệp hoặc đã ngừng.")
            if kind == "UNIT_MANAGER" and rule.get("id") and not _uuid(rule["id"]):
                errors.append(f"{path}.approvers: đơn vị không hợp lệ.")
            if kind == "UNIT_MANAGER" and _uuid(rule.get("id")) and not OrganizationUnit.objects.filter(
                pk=_uuid(rule["id"]), company=company, status="ACTIVE").exists():
                errors.append(f"{path}.approvers: đơn vị không thuộc doanh nghiệp hoặc đã ngừng.")
            if kind == "DOCUMENT_FIELD" and rule.get("field") not in ("requester_user_id", "owner_user_id", "manager_user_id"):
                errors.append(f"{path}.approvers: trường User không được hỗ trợ.")
            if kind == "PREVIOUS_STEP_RESULT" and index == 0:
                errors.append(f"{path}.approvers: bước đầu không có kết quả bước trước.")
            if kind == "DYNAMIC_RULE" and rule.get("strategy") != "UNIT_MANAGER":
                errors.append(f"{path}.approvers: quy tắc động không được hỗ trợ.")
        static = set().union(*(resolve_approver(rule, company) for rule in approvers if isinstance(rule, dict)))
        fallback = resolve_approver({key: value for key, value in step["fallback"].items()
                                     if key not in ("valid_from", "valid_to", "scope")}, company) \
            if isinstance(step.get("fallback"), dict) else set()
        if mode == "MINIMUM" and (not isinstance(step.get("minimum"), int) or
                                   not 0 < step["minimum"] <= max(len(static), len(approvers))):
            errors.append(f"{path}.minimum: phải từ 1 đến số Approver.")
        if not static and not fallback:
            dynamic = any(isinstance(rule, dict) and rule.get("type") in ("UNIT_MANAGER", "DOCUMENT_FIELD", "PREVIOUS_STEP_RESULT", "DYNAMIC_RULE") for rule in approvers)
            if index > 0 and any(isinstance(rule, dict) and rule.get("type") == "PREVIOUS_STEP_RESULT" for rule in approvers):
                pass
            elif dynamic:
                errors.append(f"{path}: Approver động cần Fallback hợp lệ trước khi kích hoạt.")
            else:
                errors.append(f"{path}: không tìm được Approver hoặc Fallback hợp lệ.")
        target = step.get("on_approve", "NEXT")
        if target == "NEXT":
            if index == len(steps) - 1:
                errors.append(f"{path}.on_approve: bước cuối cần COMPLETE.")
        elif target != "COMPLETE" and (not isinstance(target, int) or target <= (step.get("order") if isinstance(step.get("order"), int) else index + 1) or target > len(steps)):
            errors.append(f"{path}.on_approve: đích phải là bước phía sau hoặc COMPLETE.")
        reject = step.get("on_reject", "REJECT")
        if reject not in ("REJECT", "RETURN_CREATOR", "PREVIOUS") or reject == "PREVIOUS" and index == 0:
            errors.append(f"{path}.on_reject: nhánh từ chối không hợp lệ.")
        changes = step.get("on_changes", "RETURN_CREATOR")
        if changes not in ("RETURN_CREATOR", "PREVIOUS") or changes == "PREVIOUS" and index == 0:
            errors.append(f"{path}.on_changes: nhánh yêu cầu chỉnh sửa không hợp lệ.")
        for key in ("deadline_hours", "reminder_hours"):
            if key in step and (not isinstance(step[key], int) or step[key] <= 0):
                errors.append(f"{path}.{key}: phải là số nguyên dương.")
        if step.get("reminder_hours") and step.get("deadline_hours") and step["reminder_hours"] >= step["deadline_hours"]:
            errors.append(f"{path}: thời gian nhắc phải trước hạn xử lý.")
    return errors, warnings
