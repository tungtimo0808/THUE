from datetime import date
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP, ROUND_UP
import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.models import AuditChange, AuditLog
from audit_log.services import _json_value
from master_data.models import Currency

from .models import (
    AccountingBasis,
    AccountingPolicy,
    AccountingRegime,
    AllocationMethod,
    CompanyModuleConfig,
    DebtTrackingMethod,
    DepreciationMethod,
    ExchangeRateSource,
    FiscalPeriod,
    FiscalPeriodStatus,
    InventoryMethod,
    InventoryValuationMethod,
    ModuleStatus,
    PolicyScope,
    PolicyStatus,
    PostingMode,
    RoundingMethod,
    TaxCalculationMethod,
)
from .period_services import create_default_fiscal_year_for_company, determine_period_for_date


def _resolve_actor(actor):
    if not actor:
        return None
    from iam.models import UserAccount
    if isinstance(actor, UserAccount):
        return actor
    if hasattr(actor, "iam_account"):
        return actor.iam_account
    account, _ = UserAccount.objects.get_or_create(
        auth_user=actor,
        defaults={"display_name": getattr(actor, "username", "Admin")},
    )
    return account


def log_policy_audit(company, actor, action_code, entity_id, entity_type="AccountingPolicy", before_data=None, after_data=None, reason=""):
    """Record audit log for policy modifications (BR-POL-57, EF-22)."""
    try:
        actor_user = _resolve_actor(actor)
        log = AuditLog.objects.create(
            company=company,
            actor_user=actor_user,
            module_code="SYS",
            action_code=action_code,
            entity_type=entity_type,
            entity_id=entity_id,
            reason=reason or f"Thao tác {action_code} trên {entity_type}",
        )
        if before_data or after_data:
            before, after = before_data or {}, after_data or {}
            changes = []
            for field_name in sorted(set(before) | set(after)):
                old_val = _json_value(before.get(field_name))
                new_val = _json_value(after.get(field_name))
                if old_val != new_val:
                    changes.append(AuditChange(audit_log=log, field_name=field_name, old_value_json=old_val, new_value_json=new_val))
            if changes:
                AuditChange.objects.bulk_create(changes)
        return log
    except Exception as e:
        raise ValidationError(f"Không thể ghi Audit Log cho chính sách kế toán: {str(e)} (EF-22).")


def build_policy_snapshot(policy):
    """Serialize full policy configuration into a self-contained JSON snapshot (Step 23, BR-POL-13)."""
    return {
        "code": policy.code,
        "name": policy.name,
        "version": policy.version,
        "scope": policy.scope,
        "branch_id": str(policy.branch_id) if policy.branch_id else None,
        "effective_from_period_id": str(policy.effective_from_period_id),
        "effective_to_period_id": str(policy.effective_to_period_id) if policy.effective_to_period_id else None,
        "accounting_regime": policy.accounting_regime,
        "accounting_basis": policy.accounting_basis,
        "accounting_currency_id": str(policy.accounting_currency_id) if policy.accounting_currency_id else None,
        "allow_multi_currency": policy.allow_multi_currency,
        "exchange_rate_source": policy.exchange_rate_source,
        "inventory_accounting": policy.inventory_accounting,
        "inventory_valuation": policy.inventory_valuation,
        "depreciation_method": policy.depreciation_method,
        "allocation_method": policy.allocation_method,
        "posting_mode": policy.posting_mode,
        "tax_method": policy.tax_method,
        "debt_tracking": policy.debt_tracking,
        "amount_decimals": policy.amount_decimals,
        "unit_price_decimals": policy.unit_price_decimals,
        "quantity_decimals": policy.quantity_decimals,
        "exchange_rate_decimals": policy.exchange_rate_decimals,
        "rounding_method": policy.rounding_method,
        "legal_basis": policy.legal_basis,
    }


def validate_policy_configuration(data, company, scope=PolicyScope.COMPANY, branch=None):
    """Validate policy fields against catalogs, company constraints, and branch scope rules (Steps 5-13, EF-06..EF-16)."""
    # 1. Scope and branch validation (BR-POL-40, 41, 42)
    if scope == PolicyScope.BRANCH_OVERRIDE:
        if not branch:
            raise ValidationError({"branch": "Chính sách phạm vi BRANCH_OVERRIDE bắt buộc phải chọn chi nhánh áp dụng (BR-POL-41)."})
        if branch.company_id != company.id:
            raise ValidationError({"branch": "Chi nhánh được chọn không thuộc doanh nghiệp hiện tại."})

        # Foundation enterprise fields cannot be altered by branch (BR-POL-40, 41, 42)
        if "accounting_regime" in data and data["accounting_regime"]:
            comp_policy = AccountingPolicy.objects.filter(company=company, scope=PolicyScope.COMPANY).order_by("-version").first()
            if comp_policy and data["accounting_regime"] != comp_policy.accounting_regime:
                raise ValidationError({"accounting_regime": "Chính sách chi nhánh không được ghi đè Chế độ kế toán nền tảng của doanh nghiệp (BR-POL-40, 42)."})
            elif not comp_policy:
                raise ValidationError({"accounting_regime": "Chính sách chi nhánh không được ghi đè Chế độ kế toán (BR-POL-40, 42)."})

        if "accounting_basis" in data and data["accounting_basis"]:
            comp_policy = AccountingPolicy.objects.filter(company=company, scope=PolicyScope.COMPANY).order_by("-version").first()
            if comp_policy and data["accounting_basis"] != comp_policy.accounting_basis:
                raise ValidationError({"accounting_basis": "Chính sách chi nhánh không được ghi đè Cơ sở ghi nhận (BR-POL-40, 42)."})

        if "accounting_currency" in data and data["accounting_currency"]:
            curr = data["accounting_currency"]
            curr_id = getattr(curr, "id", curr)
            if company.accounting_currency and str(curr_id) != str(company.accounting_currency_id):
                raise ValidationError({"accounting_currency": "Chính sách chi nhánh không được ghi đè Đồng tiền kế toán của doanh nghiệp (BR-POL-40, 42)."})

    # 2. Currency validation (BR-POL-18, EF-06)
    currency = data.get("accounting_currency")
    if scope == PolicyScope.COMPANY and not currency and not company.accounting_currency:
        raise ValidationError({"accounting_currency": "Đồng tiền kế toán bắt buộc phải được thiết lập (BR-POL-18, EF-06)."})

    # 3. Decimals and rounding validation (EF-09)
    for field in ["amount_decimals", "unit_price_decimals", "quantity_decimals", "exchange_rate_decimals"]:
        val = data.get(field)
        if val is not None and (not isinstance(val, int) or val < 0 or val > 6):
            raise ValidationError({field: f"Số chữ số thập phân [{field}] phải là số nguyên từ 0 đến 6 (EF-09)."})

    # 4. Multi-currency and exchange rate source validation (EF-13)
    allow_multi = data.get("allow_multi_currency", False)
    xr_source = data.get("exchange_rate_source")
    if allow_multi and not xr_source:
        raise ValidationError({"exchange_rate_source": "Khi bật quản lý ngoại tệ, nguồn tỷ giá bắt buộc phải được cấu hình (EF-13)."})

    # 5. Effective period check (EF-03)
    eff_from = data.get("effective_from_period")
    if not eff_from:
        raise ValidationError({"effective_from_period": "Kỳ bắt đầu áp dụng chính sách là bắt buộc (EF-03)."})
    if eff_from.company_id != company.id:
        raise ValidationError({"effective_from_period": "Kỳ kế toán được chọn không thuộc doanh nghiệp hiện tại."})

    eff_to = data.get("effective_to_period")
    if eff_to:
        if eff_to.company_id != company.id:
            raise ValidationError({"effective_to_period": "Kỳ kết thúc được chọn không thuộc doanh nghiệp hiện tại."})
        if eff_to.start_date < eff_from.start_date:
            raise ValidationError({"effective_to_period": "Kỳ kết thúc không được trước kỳ bắt đầu áp dụng."})


def check_policy_conflicts(company, scope, branch=None, effective_from_period=None, effective_to_period=None, exclude_policy_ids=None):
    """Ensure no two ACTIVE or SCHEDULED policies overlap in same scope and period range (BR-POL-05, EF-04)."""
    qs = AccountingPolicy.objects.filter(
        company=company,
        scope=scope,
        status__in=(PolicyStatus.ACTIVE, PolicyStatus.SCHEDULED),
    )
    if branch:
        qs = qs.filter(branch=branch)
    else:
        qs = qs.filter(branch__isnull=True)

    if exclude_policy_ids:
        qs = qs.exclude(pk__in=exclude_policy_ids)

    from_date = effective_from_period.start_date if effective_from_period else timezone.localdate()
    to_date = effective_to_period.end_date if effective_to_period else date(9999, 12, 31)

    for other in qs:
        o_from = other.effective_from_period.start_date
        o_to = other.effective_to_period.end_date if other.effective_to_period else date(9999, 12, 31)
        if max(from_date, o_from) <= min(to_date, o_to):
            raise ValidationError({
                "effective_from_period": f"Xung đột chính sách kế toán: Đã có chính sách [{other.code}] phiên bản v{other.version} đang {other.get_status_display().upper()} trong cùng phạm vi và khoảng thời gian ({o_from} -> {o_to}) (BR-POL-05, EF-04)."
            })


def analyze_policy_impact(policy, proposed_data=None):
    """Analyze and generate impact report before activation or modification (Steps 16-18, BR-POL-53, EF-07, EF-11)."""
    company = policy.company
    data = proposed_data or {}
    changes = []
    warnings = []
    blocked_reasons = []

    # 1. Check Accounting Currency change (BR-POL-19, EF-07)
    proposed_currency = data.get("accounting_currency")
    if proposed_currency:
        if isinstance(proposed_currency, (str, uuid.UUID)):
            from master_data.models import Currency
            try:
                proposed_currency = Currency.objects.get(pk=proposed_currency)
            except Exception:
                proposed_currency = Currency.objects.filter(code=str(proposed_currency)).first()

    if proposed_currency and policy.accounting_currency and proposed_currency != policy.accounting_currency:
        changes.append({
            "field": "accounting_currency",
            "from": policy.accounting_currency.code,
            "to": proposed_currency.code,
            "description": "Thay đổi đồng tiền hạch toán chính của doanh nghiệp",
        })
        # Check if General Ledger already has posted journal entries
        has_postings = False
        try:
            from general_ledger.models import JournalEntry
            has_postings = JournalEntry.objects.filter(company=company).exists()
        except Exception:
            pass

        if has_postings:
            blocked_reasons.append(
                "Doanh nghiệp đã phát sinh bút toán ghi sổ kế toán. Không được phép thay đổi trực tiếp đồng tiền kế toán (đồng tiền hạch toán) (BR-POL-19, EF-07)."
            )

    # 2. Check Inventory Valuation method change (BR-POL-25, 26, EF-11)
    proposed_val = data.get("inventory_valuation")
    if proposed_val and proposed_val != policy.inventory_valuation:
        changes.append({
            "field": "inventory_valuation",
            "from": policy.inventory_valuation,
            "to": proposed_val,
            "description": f"Chuyển phương pháp tính giá xuất kho từ {policy.get_inventory_valuation_display()} sang {proposed_val}",
        })
        warnings.append(
            "Thay đổi phương pháp tính giá xuất kho chỉ được áp dụng từ đầu kỳ kế toán mới, không thay đổi số liệu các kỳ đã phát sinh (BR-POL-25, EF-11)."
        )

    # 3. Check Decimals / Rounding changes (BR-POL-21, 22)
    for field in ["amount_decimals", "unit_price_decimals", "quantity_decimals"]:
        if field in data and getattr(policy, field) != data[field]:
            changes.append({
                "field": field,
                "from": getattr(policy, field),
                "to": data[field],
                "description": f"Thay đổi quy tắc làm tròn [{field}]",
            })
            warnings.append(
                f"Thay đổi {field} chỉ áp dụng cho chứng từ mới, không tính lại số liệu đã báo cáo (BR-POL-22)."
            )

    # 4. Check Posting Mode change
    proposed_pm = data.get("posting_mode")
    if proposed_pm and proposed_pm != policy.posting_mode:
        changes.append({
            "field": "posting_mode",
            "from": policy.posting_mode,
            "to": proposed_pm,
            "description": f"Chuyển chế độ ghi sổ sang {proposed_pm}",
        })

    # 5. Identify affected modules
    affected_modules = ["GL"]
    if data.get("inventory_valuation") or data.get("inventory_accounting"):
        affected_modules.extend(["INV", "PUR", "SALES"])
    if data.get("depreciation_method"):
        affected_modules.append("AST")
    if data.get("tax_method"):
        affected_modules.append("TAX")

    return {
        "can_activate": len(blocked_reasons) == 0,
        "blocked_reasons": blocked_reasons,
        "warnings": warnings,
        "changes": changes,
        "affected_modules": sorted(list(set(affected_modules))),
        "effective_from_period": policy.effective_from_period.code,
        "summary": "Chính sách hợp lệ và sẵn sàng kích hoạt" if not blocked_reasons else "Chính sách có vi phạm chặn kích hoạt",
    }


@transaction.atomic
def create_accounting_policy(company, data, actor):
    """Create a new policy in DRAFT status (Main Flow 2.1 steps 1-15)."""
    actor = _resolve_actor(actor)
    code = data.get("code")
    if not code:
        raise ValidationError({"code": "Mã chính sách kế toán là bắt buộc."})

    if AccountingPolicy.objects.filter(company=company, code=code).exists():
        raise ValidationError({"code": f"Mã chính sách [{code}] đã tồn tại trong doanh nghiệp (BR-POL-03, EF-02)."})

    scope = data.get("scope", PolicyScope.COMPANY)
    branch = data.get("branch")
    eff_from = data.get("effective_from_period")

    # If currency not provided, inherit company currency
    currency = data.get("accounting_currency") or company.accounting_currency

    validate_policy_configuration(
        data={**data, "accounting_currency": currency},
        company=company,
        scope=scope,
        branch=branch,
    )

    policy = AccountingPolicy.objects.create(
        company=company,
        code=code,
        name=data.get("name", code),
        version=1,
        scope=scope,
        branch=branch,
        effective_from_period=eff_from,
        effective_to_period=data.get("effective_to_period"),
        accounting_regime=data.get("accounting_regime", AccountingRegime.CIRCULAR_133),
        accounting_basis=data.get("accounting_basis", AccountingBasis.ACCRUAL),
        accounting_currency=currency,
        allow_multi_currency=bool(data.get("allow_multi_currency", False)),
        exchange_rate_source=data.get("exchange_rate_source", ExchangeRateSource.MANUAL),
        inventory_accounting=data.get("inventory_accounting", InventoryMethod.PERPETUAL),
        inventory_valuation=data.get("inventory_valuation", InventoryValuationMethod.WEIGHTED_AVERAGE),
        depreciation_method=data.get("depreciation_method", DepreciationMethod.STRAIGHT_LINE),
        allocation_method=data.get("allocation_method", AllocationMethod.BY_MONTHS),
        posting_mode=data.get("posting_mode", PostingMode.MANUAL),
        tax_method=data.get("tax_method", TaxCalculationMethod.DEDUCTION),
        debt_tracking=data.get("debt_tracking", DebtTrackingMethod.INVOICE),
        amount_decimals=int(data.get("amount_decimals", 0)),
        unit_price_decimals=int(data.get("unit_price_decimals", 2)),
        quantity_decimals=int(data.get("quantity_decimals", 2)),
        exchange_rate_decimals=int(data.get("exchange_rate_decimals", 2)),
        rounding_method=data.get("rounding_method", RoundingMethod.HALF_UP),
        legal_basis=data.get("legal_basis", ""),
        change_reason=data.get("change_reason", ""),
        status=PolicyStatus.DRAFT,
        created_by=actor,
        updated_by=actor,
    )

    policy.config_snapshot = build_policy_snapshot(policy)
    policy.save(update_fields=("config_snapshot",))

    log_policy_audit(
        company=company,
        actor=actor,
        action_code="POLICY_CREATE",
        entity_id=policy.id,
        after_data={"code": code, "version": 1, "scope": scope},
    )
    return policy


@transaction.atomic
def update_draft_policy(policy, data, actor):
    """Update a policy in DRAFT status (AF-13, BR-POL-07)."""
    actor = _resolve_actor(actor)
    if policy.status != PolicyStatus.DRAFT:
        raise ValidationError("Chính sách đang ACTIVE hoặc đã xác nhận không được sửa trực tiếp. Vui lòng tạo phiên bản mới (BR-POL-07, AF-13).")

    company = policy.company
    scope = data.get("scope", policy.scope)
    branch = data.get("branch", policy.branch)

    currency = data.get("accounting_currency", policy.accounting_currency)
    eff_from = data.get("effective_from_period", policy.effective_from_period)

    validate_policy_configuration(
        data={**data, "accounting_currency": currency, "effective_from_period": eff_from},
        company=company,
        scope=scope,
        branch=branch,
    )

    for field in [
        "name", "accounting_regime", "accounting_basis", "allow_multi_currency",
        "exchange_rate_source", "inventory_accounting", "inventory_valuation",
        "depreciation_method", "allocation_method", "posting_mode", "tax_method",
        "debt_tracking", "amount_decimals", "unit_price_decimals", "quantity_decimals",
        "exchange_rate_decimals", "rounding_method", "legal_basis", "change_reason",
    ]:
        if field in data:
            setattr(policy, field, data[field])

    if "accounting_currency" in data:
        policy.accounting_currency = currency
    if "effective_from_period" in data:
        policy.effective_from_period = eff_from
    if "effective_to_period" in data:
        policy.effective_to_period = data["effective_to_period"]
    if "branch" in data:
        policy.branch = branch

    policy.updated_by = actor
    policy.config_snapshot = build_policy_snapshot(policy)
    policy.save()

    log_policy_audit(
        company=company,
        actor=actor,
        action_code="POLICY_UPDATE_DRAFT",
        entity_id=policy.id,
        after_data={"code": policy.code, "version": policy.version},
    )
    return policy


@transaction.atomic
def create_new_policy_version(base_policy, actor, change_reason=""):
    """Create a new version (v+1) from an existing policy in DRAFT status (BR-POL-06, 07, AF-13)."""
    actor = _resolve_actor(actor)
    company = base_policy.company
    next_ver = base_policy.version + 1

    new_policy = AccountingPolicy.objects.create(
        company=company,
        code=base_policy.code,
        name=base_policy.name,
        version=next_ver,
        previous_version=base_policy,
        scope=base_policy.scope,
        branch=base_policy.branch,
        effective_from_period=base_policy.effective_from_period,
        effective_to_period=base_policy.effective_to_period,
        accounting_regime=base_policy.accounting_regime,
        accounting_basis=base_policy.accounting_basis,
        accounting_currency=base_policy.accounting_currency,
        allow_multi_currency=base_policy.allow_multi_currency,
        exchange_rate_source=base_policy.exchange_rate_source,
        inventory_accounting=base_policy.inventory_accounting,
        inventory_valuation=base_policy.inventory_valuation,
        depreciation_method=base_policy.depreciation_method,
        allocation_method=base_policy.allocation_method,
        posting_mode=base_policy.posting_mode,
        tax_method=base_policy.tax_method,
        debt_tracking=base_policy.debt_tracking,
        amount_decimals=base_policy.amount_decimals,
        unit_price_decimals=base_policy.unit_price_decimals,
        quantity_decimals=base_policy.quantity_decimals,
        exchange_rate_decimals=base_policy.exchange_rate_decimals,
        rounding_method=base_policy.rounding_method,
        legal_basis=base_policy.legal_basis,
        change_reason=change_reason or f"Nâng cấp từ phiên bản v{base_policy.version}",
        status=PolicyStatus.DRAFT,
        created_by=actor,
        updated_by=actor,
    )

    new_policy.config_snapshot = build_policy_snapshot(new_policy)
    new_policy.save(update_fields=("config_snapshot",))

    log_policy_audit(
        company=company,
        actor=actor,
        action_code="POLICY_CREATE_VERSION",
        entity_id=new_policy.id,
        before_data={"base_version": base_policy.version},
        after_data={"new_version": next_ver},
        reason=change_reason,
    )
    return new_policy


@transaction.atomic
def activate_accounting_policy(policy, actor, require_approval=False, skip_approval=False):
    """Activate accounting policy and manage predecessor lifecycle (Steps 19-30, BR-POL-07, 08, 09, 10)."""
    actor = _resolve_actor(actor)
    if policy.status in (PolicyStatus.ACTIVE, PolicyStatus.ARCHIVED):
        raise ValidationError(f"Chính sách đang ở trạng thái {policy.get_status_display()}, không thể kích hoạt lại.")

    company = policy.company

    # 1. Check impact and blocked conditions (EF-07, EF-11, BR-POL-53)
    impact = analyze_policy_impact(policy)
    if not impact["can_activate"]:
        raise ValidationError({"impact": impact["blocked_reasons"]})

    # 2. Check conflicts excluding self and immediate predecessor
    exclude_ids = {policy.pk}
    if policy.previous_version_id:
        exclude_ids.add(policy.previous_version_id)

    check_policy_conflicts(
        company=company,
        scope=policy.scope,
        branch=policy.branch,
        effective_from_period=policy.effective_from_period,
        effective_to_period=policy.effective_to_period,
        exclude_policy_ids=exclude_ids,
    )

    # 3. Check workflow approval condition (Step 24, AF-12, BR-POL-54)
    if require_approval and not skip_approval:
        policy.status = PolicyStatus.PENDING_APPROVAL
        policy.updated_by = actor
        policy.save(update_fields=("status", "updated_by", "updated_at"))
        log_policy_audit(
            company=company,
            actor=actor,
            action_code="POLICY_SUBMIT_APPROVAL",
            entity_id=policy.id,
            after_data={"status": policy.status},
        )
        return policy

    # 4. Determine status: SCHEDULED vs ACTIVE (Step 25, BR-POL-08, AF-04)
    today = timezone.localdate()
    target_status = PolicyStatus.ACTIVE if policy.effective_from_period.start_date <= today else PolicyStatus.SCHEDULED

    policy.status = target_status
    policy.updated_by = actor
    policy.approved_by = actor
    policy.approved_at = timezone.now()
    policy.config_snapshot = build_policy_snapshot(policy)
    policy.save(update_fields=("status", "updated_by", "approved_by", "approved_at", "config_snapshot", "updated_at"))

    # 5. If replacing previous version, transition previous to INACTIVE (Step 26, BR-POL-09)
    if policy.previous_version:
        prev = policy.previous_version
        if prev.status == PolicyStatus.ACTIVE:
            prev.status = PolicyStatus.INACTIVE
            # Attempt to set previous effective_to_period to preceding period
            prev.save(update_fields=("status", "updated_at"))

    log_policy_audit(
        company=company,
        actor=actor,
        action_code="POLICY_ACTIVATE",
        entity_id=policy.id,
        after_data={"status": target_status, "version": policy.version},
    )
    return policy


@transaction.atomic
def approve_accounting_policy(policy, actor, approved=True, notes=""):
    """Approve or reject a policy in PENDING_APPROVAL status (UC-SYS-11, AF-12)."""
    actor = _resolve_actor(actor)
    if policy.status != PolicyStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể phê duyệt chính sách đang ở trạng thái PENDING_APPROVAL.")

    company = policy.company
    if approved:
        today = timezone.localdate()
        target_status = PolicyStatus.ACTIVE if policy.effective_from_period.start_date <= today else PolicyStatus.SCHEDULED
        policy.status = target_status
        policy.approved_by = actor
        policy.approved_at = timezone.now()
        policy.config_snapshot = build_policy_snapshot(policy)
        policy.save(update_fields=("status", "approved_by", "approved_at", "config_snapshot", "updated_at"))

        if policy.previous_version:
            prev = policy.previous_version
            if prev.status == PolicyStatus.ACTIVE:
                prev.status = PolicyStatus.INACTIVE
                prev.save(update_fields=("status", "updated_at"))

        log_policy_audit(
            company=company,
            actor=actor,
            action_code="POLICY_APPROVE",
            entity_id=policy.id,
            after_data={"status": target_status},
            reason=notes,
        )
    else:
        policy.status = PolicyStatus.DRAFT
        policy.save(update_fields=("status", "updated_at"))
        log_policy_audit(
            company=company,
            actor=actor,
            action_code="POLICY_REJECT",
            entity_id=policy.id,
            after_data={"status": policy.status},
            reason=notes,
        )
    return policy


@transaction.atomic
def copy_policy_template(source_policy, new_code, new_name, effective_from_period, actor):
    """Copy an existing policy into a new policy draft (Step 2, AF-03)."""
    actor = _resolve_actor(actor)
    company = source_policy.company
    if AccountingPolicy.objects.filter(company=company, code=new_code).exists():
        raise ValidationError({"code": f"Mã chính sách [{new_code}] đã tồn tại trong doanh nghiệp (BR-POL-03, EF-02)."})

    copied = AccountingPolicy.objects.create(
        company=company,
        code=new_code,
        name=new_name,
        version=1,
        scope=source_policy.scope,
        branch=source_policy.branch,
        effective_from_period=effective_from_period,
        accounting_regime=source_policy.accounting_regime,
        accounting_basis=source_policy.accounting_basis,
        accounting_currency=source_policy.accounting_currency,
        allow_multi_currency=source_policy.allow_multi_currency,
        exchange_rate_source=source_policy.exchange_rate_source,
        inventory_accounting=source_policy.inventory_accounting,
        inventory_valuation=source_policy.inventory_valuation,
        depreciation_method=source_policy.depreciation_method,
        allocation_method=source_policy.allocation_method,
        posting_mode=source_policy.posting_mode,
        tax_method=source_policy.tax_method,
        debt_tracking=source_policy.debt_tracking,
        amount_decimals=source_policy.amount_decimals,
        unit_price_decimals=source_policy.unit_price_decimals,
        quantity_decimals=source_policy.quantity_decimals,
        exchange_rate_decimals=source_policy.exchange_rate_decimals,
        rounding_method=source_policy.rounding_method,
        legal_basis=source_policy.legal_basis,
        change_reason=f"Sao chép từ mẫu chính sách [{source_policy.code}]",
        status=PolicyStatus.DRAFT,
        created_by=actor,
        updated_by=actor,
    )
    copied.config_snapshot = build_policy_snapshot(copied)
    copied.save(update_fields=("config_snapshot",))

    log_policy_audit(
        company=company,
        actor=actor,
        action_code="POLICY_COPY",
        entity_id=copied.id,
        before_data={"source_code": source_policy.code},
        after_data={"new_code": new_code},
    )
    return copied


class ResolvedPolicyContext:
    """Helper wrapper holding resolved accounting policy values with math/rounding utilities (Section 2.2)."""
    def __init__(self, policy, branch_policy=None):
        self.policy = policy
        self.branch_policy = branch_policy

        # Base company values
        self.accounting_regime = policy.accounting_regime
        self.accounting_basis = policy.accounting_basis
        self.accounting_currency = policy.accounting_currency
        self.allow_multi_currency = policy.allow_multi_currency

        # Potentially branch-overridden fields (BR-POL-40, 41, 42)
        target = branch_policy or policy
        self.inventory_accounting = target.inventory_accounting
        self.inventory_valuation = target.inventory_valuation
        self.depreciation_method = target.depreciation_method
        self.allocation_method = target.allocation_method
        self.posting_mode = target.posting_mode
        self.tax_method = target.tax_method
        self.debt_tracking = target.debt_tracking
        self.amount_decimals = target.amount_decimals
        self.unit_price_decimals = target.unit_price_decimals
        self.quantity_decimals = target.quantity_decimals
        self.exchange_rate_decimals = target.exchange_rate_decimals
        self.rounding_method = target.rounding_method

    def _get_rounding_mode(self):
        if self.rounding_method == RoundingMethod.ROUND_UP:
            return ROUND_UP
        if self.rounding_method == RoundingMethod.ROUND_DOWN:
            return ROUND_DOWN
        return ROUND_HALF_UP

    def round_amount(self, value):
        if value is None:
            return Decimal("0")
        dec = Decimal(str(value))
        exp = Decimal(10) ** -self.amount_decimals
        return dec.quantize(exp, rounding=self._get_rounding_mode())

    def round_unit_price(self, value):
        if value is None:
            return Decimal("0")
        dec = Decimal(str(value))
        exp = Decimal(10) ** -self.unit_price_decimals
        return dec.quantize(exp, rounding=self._get_rounding_mode())

    def round_quantity(self, value):
        if value is None:
            return Decimal("0")
        dec = Decimal(str(value))
        exp = Decimal(10) ** -self.quantity_decimals
        return dec.quantize(exp, rounding=self._get_rounding_mode())


def resolve_effective_policy(company, target_date=None, period=None, branch=None):
    """Determine effective policy for transaction date or period with branch overrides (Mục 2.2, BR-POL-12, 14, 40, 41)."""
    if not target_date and not period:
        target_date = timezone.localdate()

    if not period and target_date:
        period_info = determine_period_for_date(company, target_date)
        period = period_info["period"]

    # 1. Find ACTIVE COMPANY policy covering period
    p_start = period.start_date
    company_policy = AccountingPolicy.objects.filter(
        company=company,
        scope=PolicyScope.COMPANY,
        status=PolicyStatus.ACTIVE,
        effective_from_period__start_date__lte=p_start,
    ).filter(
        effective_to_period__isnull=True
    ).order_by("-effective_from_period__start_date", "-version").first()

    if not company_policy:
        # Also check with effective_to_period
        company_policy = AccountingPolicy.objects.filter(
            company=company,
            scope=PolicyScope.COMPANY,
            status=PolicyStatus.ACTIVE,
            effective_from_period__start_date__lte=p_start,
            effective_to_period__end_date__gte=p_start,
        ).order_by("-effective_from_period__start_date", "-version").first()

    if not company_policy:
        raise ValidationError("Không tìm thấy chính sách kế toán có hiệu lực cho ngày/kỳ kế toán tương ứng (BR-POL-14).")

    # 2. Check Branch override if applicable (BR-POL-41)
    branch_policy = None
    if branch:
        branch_policy = AccountingPolicy.objects.filter(
            company=company,
            scope=PolicyScope.BRANCH_OVERRIDE,
            branch=branch,
            status=PolicyStatus.ACTIVE,
            effective_from_period__start_date__lte=p_start,
        ).order_by("-effective_from_period__start_date", "-version").first()

    return ResolvedPolicyContext(policy=company_policy, branch_policy=branch_policy)


@transaction.atomic
def create_default_accounting_policy_for_company(company, actor, period=None):
    """Initialize default accounting policy for single-member / simple enterprises (AF-02, BR-POL-46, 47, 48)."""
    actor = _resolve_actor(actor)
    code = "POL_DEFAULT"
    existing = AccountingPolicy.objects.filter(company=company, code=code).first()
    if existing:
        return existing

    if not period:
        fy = create_default_fiscal_year_for_company(company, actor)
        period = fy.periods.first()

    currency = company.accounting_currency
    if not currency:
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})

    # Determine regime based on business_type
    regime = AccountingRegime.CIRCULAR_133
    if getattr(company, "business_type", None) == "LLC_ONE_MEMBER":
        regime = AccountingRegime.CIRCULAR_88

    policy = create_accounting_policy(
        company=company,
        data={
            "code": code,
            "name": "Chính sách kế toán mặc định",
            "scope": PolicyScope.COMPANY,
            "effective_from_period": period,
            "accounting_regime": regime,
            "accounting_basis": AccountingBasis.ACCRUAL,
            "accounting_currency": currency,
            "allow_multi_currency": False,
            "exchange_rate_source": ExchangeRateSource.MANUAL,
            "inventory_accounting": InventoryMethod.PERPETUAL,
            "inventory_valuation": InventoryValuationMethod.WEIGHTED_AVERAGE,
            "depreciation_method": DepreciationMethod.STRAIGHT_LINE,
            "allocation_method": AllocationMethod.BY_MONTHS,
            "posting_mode": PostingMode.AUTO_ON_APPROVE,
            "tax_method": TaxCalculationMethod.DEDUCTION,
            "debt_tracking": DebtTrackingMethod.INVOICE,
            "amount_decimals": 0,
            "unit_price_decimals": 2,
            "quantity_decimals": 2,
            "exchange_rate_decimals": 2,
            "rounding_method": RoundingMethod.HALF_UP,
            "legal_basis": "Chính sách ban đầu",
            "change_reason": "Thiết lập hệ thống ban đầu",
        },
        actor=actor,
    )
    activate_accounting_policy(policy, actor, skip_approval=True)
    return policy
