from __future__ import annotations

import calendar
import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Callable

from django.db.models import F, Max, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from iam.models import ActiveStatus, CompanyMembership, Permission, UserPermissionOverride
from iam.permissions import assignment_permission_codes, effective_assignments, has_effective_permission
from organization.models import Branch, Company

from .models import (
    DashboardCacheEntry,
    DashboardConfiguration,
    DashboardMetricAccountMapping,
    DashboardMetricCatalog,
    DashboardMetricSnapshot,
)

ZERO = Decimal("0.0000")
HUNDRED = Decimal("100.00")


class WidgetCalculationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class DashboardContext:
    request: Any
    user: Any
    iam_account: Any
    company: Company
    period_type: str
    fiscal_period: AccountingPeriod | None
    from_date: date
    to_date: date
    as_of_date: date
    comparison_mode: str
    comparison_from_date: date | None
    comparison_to_date: date | None
    requested_branch_ids: list[str]
    effective_branch_ids: list[str] | None  # None means all branches in company
    allowed_warehouse_ids: list[str] | None
    allowed_bank_account_ids: list[str] | None
    refresh_mode: str
    cash_flow_scope: str
    config: DashboardConfiguration | None
    warnings: list[dict[str, Any]] = field(default_factory=list)
    fail_widgets: set[str] = field(default_factory=set)
    is_before_start_date: bool = False


def _to_decimal(val: Any) -> Decimal:
    if val is None:
        return ZERO
    if isinstance(val, Decimal):
        return val
    return Decimal(str(val))


def _quantize_money(val: Decimal | None) -> str | None:
    if val is None:
        return None
    return str(_to_decimal(val).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


def _parse_date(val: Any, field_name: str) -> date | None:
    if not val:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(str(val).strip()[:10])
    except ValueError:
        raise ValidationError({field_name: f"Định dạng ngày '{val}' không hợp lệ (YYYY-MM-DD).", "code": "INVALID_DATE_FORMAT"})


def _shift_year(d: date, years: int) -> date:
    target_year = d.year + years
    max_day = calendar.monthrange(target_year, d.month)[1]
    return date(target_year, d.month, min(d.day, max_day))


def _previous_period_dates(period_type: str, from_date: date, to_date: date) -> tuple[date, date]:
    if period_type == "MONTH" and from_date.day == 1:
        prev_end = from_date - timedelta(days=1)
        prev_start = date(prev_end.year, prev_end.month, 1)
        return prev_start, prev_end
    if period_type == "QUARTER" and from_date.day == 1 and from_date.month in (1, 4, 7, 10):
        prev_end = from_date - timedelta(days=1)
        prev_q_start_month = ((prev_end.month - 1) // 3) * 3 + 1
        prev_start = date(prev_end.year, prev_q_start_month, 1)
        return prev_start, prev_end
    if period_type == "YEAR" and from_date.month == 1 and from_date.day == 1 and to_date.month == 12 and to_date.day == 31:
        return date(from_date.year - 1, 1, 1), date(from_date.year - 1, 12, 31)
    span_days = (to_date - from_date).days + 1
    prev_end = from_date - timedelta(days=1)
    prev_start = prev_end - timedelta(days=span_days - 1)
    return prev_start, prev_end


def compute_comparison_delta(current_val: Decimal | None, comparison_val: Decimal | None, comparison_mode: str = "PREVIOUS_PERIOD") -> dict[str, Any]:
    if comparison_mode == "NONE" or current_val is None or comparison_val is None:
        return {
            "current_value": _quantize_money(current_val),
            "comparison_value": _quantize_money(comparison_val) if comparison_mode != "NONE" else None,
            "delta_amount": None,
            "delta_percent": None,
            "comparison_status": "NONE",
        }
    curr = _to_decimal(current_val)
    comp = _to_decimal(comparison_val)
    delta_amt = curr - comp
    if comp == ZERO:
        delta_pct = None
        status_str = "NO_BASELINE" if curr != ZERO else "UNCHANGED"
    else:
        pct = ((curr - comp) / abs(comp)) * HUNDRED
        delta_pct = float(pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        if delta_amt > ZERO:
            status_str = "UP"
        elif delta_amt < ZERO:
            status_str = "DOWN"
        else:
            status_str = "UNCHANGED"
    return {
        "current_value": _quantize_money(curr),
        "comparison_value": _quantize_money(comp),
        "delta_amount": _quantize_money(delta_amt),
        "delta_percent": delta_pct,
        "comparison_status": status_str,
    }


def _user_permission_codes(iam_account, company: Company) -> set[str]:
    if not iam_account:
        return set()
    codes: set[str] = set()
    for assignment in effective_assignments(iam_account, company):
        codes |= assignment_permission_codes(assignment)
    now = timezone.now()
    overrides = UserPermissionOverride.objects.filter(
        company_membership__user=iam_account,
        company_membership__company=company,
        revoked_at__isnull=True,
        valid_from__lte=now,
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).select_related("permission")
    for ov in overrides:
        if ov.effect == "GRANT":
            codes.add(ov.permission.code)
        elif ov.effect == "DENY":
            codes.discard(ov.permission.code)
    return codes


def _resolve_user_data_scope(user, iam_account, company: Company) -> tuple[list[str] | None, list[str] | None, list[str] | None]:
    if user.is_superuser:
        return None, None, None
    assignments = list(effective_assignments(iam_account, company))
    dashboard_assignments = [
        a for a in assignments
        if bool({"RPT.DASHBOARD.VIEW", "RPT.CENTER.VIEW", "VIEW_DASHBOARD"} & assignment_permission_codes(a))
    ]
    target_assignments = dashboard_assignments or assignments
    if not target_assignments:
        now = timezone.now()
        overrides = list(
            UserPermissionOverride.objects.filter(
                company_membership__user=iam_account,
                company_membership__company=company,
                effect="GRANT",
                revoked_at__isnull=True,
                valid_from__lte=now,
            ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).select_related("data_scope_set")
        )
        if not overrides:
            return [], [], []
        if any(o.data_scope_set is None or o.data_scope_set.allow_all_company_data for o in overrides):
            return None, None, None
        branch_ids, warehouse_ids, bank_ids = set(), set(), set()
        for o in overrides:
            scope = o.data_scope_set
            branch_ids.update(str(x) for x in scope.branch_scopes.values_list("branch_id", flat=True))
            warehouse_ids.update(str(x) for x in scope.warehouse_scopes.values_list("warehouse_id", flat=True))
            bank_ids.update(str(x) for x in scope.bank_account_scopes.values_list("company_bank_account_id", flat=True))
        return (
            sorted(branch_ids) if branch_ids else None,
            sorted(warehouse_ids) if warehouse_ids else None,
            sorted(bank_ids) if bank_ids else None,
        )

    if any(a.data_scope_set is None or a.data_scope_set.allow_all_company_data for a in target_assignments):
        return None, None, None

    branch_ids = set()
    warehouse_ids = set()
    bank_ids = set()
    has_branch_restriction = False
    has_warehouse_restriction = False
    has_bank_restriction = False

    for a in target_assignments:
        scope = a.data_scope_set
        b_list = [str(x) for x in scope.branch_scopes.values_list("branch_id", flat=True)]
        w_list = [str(x) for x in scope.warehouse_scopes.values_list("warehouse_id", flat=True)]
        bk_list = [str(x) for x in scope.bank_account_scopes.values_list("company_bank_account_id", flat=True)]
        if b_list:
            has_branch_restriction = True
            branch_ids.update(b_list)
        if w_list:
            has_warehouse_restriction = True
            warehouse_ids.update(w_list)
        if bk_list:
            has_bank_restriction = True
            bank_ids.update(bk_list)

    resolved_branches = sorted(branch_ids) if has_branch_restriction else (
        [] if (not branch_ids and not has_warehouse_restriction and not has_bank_restriction) else None
    )
    return (
        resolved_branches,
        sorted(warehouse_ids) if has_warehouse_restriction else None,
        sorted(bank_ids) if has_bank_restriction else None,
    )


def resolve_dashboard_context(request, *, require_refresh_perm: bool = False) -> DashboardContext:
    user = request.user
    if not user or not user.is_authenticated:
        raise PermissionDenied({"detail": "Chưa đăng nhập.", "code": "UNAUTHENTICATED"})

    params = request.query_params if request.method == "GET" else {**request.query_params.dict(), **(request.data if isinstance(request.data, dict) else {})}
    company_id = params.get("company_id") or params.get("company")
    if not company_id:
        raise ValidationError({"company_id": "Phải xác định doanh nghiệp làm việc (company_id).", "code": "COMPANY_REQUIRED"})
    try:
        company = Company.objects.select_related("accounting_currency").get(pk=company_id)
    except (Company.DoesNotExist, ValueError, TypeError):
        raise ValidationError({"company_id": "Doanh nghiệp không tồn tại hoặc không hợp lệ.", "code": "INVALID_COMPANY"})

    iam_account = getattr(user, "iam_account", None)
    if not user.is_superuser:
        if not iam_account or not CompanyMembership.objects.filter(
            user=iam_account,
            company=company,
            membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
        ).exists():
            raise PermissionDenied({"detail": "Người dùng không thuộc doanh nghiệp này.", "code": "COMPANY_ACCESS_DENIED"})

        perm_codes = _user_permission_codes(iam_account, company)
        has_dash_view = bool({"RPT.DASHBOARD.VIEW", "RPT.CENTER.VIEW", "VIEW_DASHBOARD"} & perm_codes)
        if not has_dash_view:
            raise PermissionDenied({"detail": "Bạn không có quyền xem Dashboard tổng quan.", "code": "DASHBOARD_PERMISSION_DENIED"})
        if require_refresh_perm and not bool({"RPT.DASHBOARD.REFRESH", "RPT.DASHBOARD.VIEW", "RPT.CENTER.VIEW"} & perm_codes):
            raise PermissionDenied({"detail": "Bạn không có quyền làm mới Dashboard.", "code": "DASHBOARD_REFRESH_DENIED"})

    allowed_branch_ids, allowed_warehouse_ids, allowed_bank_account_ids = _resolve_user_data_scope(user, iam_account, company)

    raw_branches = params.get("branch_ids") or params.get("branch_id") or params.get("branch")
    requested_branch_ids: list[str] = []
    if raw_branches:
        if isinstance(raw_branches, (list, tuple)):
            requested_branch_ids = [str(b).strip() for b in raw_branches if str(b).strip() and str(b).strip().upper() != "ALL"]
        else:
            requested_branch_ids = [b.strip() for b in str(raw_branches).split(",") if b.strip() and b.strip().upper() != "ALL"]

    if requested_branch_ids:
        valid_branches = set(
            str(x) for x in Branch.objects.filter(company=company, id__in=requested_branch_ids).values_list("id", flat=True)
        )
        for bid in requested_branch_ids:
            if bid not in valid_branches:
                raise ValidationError({"branch_ids": f"Chi nhánh '{bid}' không thuộc doanh nghiệp.", "code": "INVALID_BRANCH"})
            if allowed_branch_ids is not None and bid not in allowed_branch_ids:
                raise PermissionDenied({"detail": "Bạn không có quyền xem dữ liệu của chi nhánh đã chọn.", "code": "BRANCH_OUT_OF_SCOPE"})
        effective_branch_ids = sorted(set(requested_branch_ids))
    else:
        effective_branch_ids = allowed_branch_ids  # None if full company allowed, or list of allowed branch IDs

    config = (
        DashboardConfiguration.objects.filter(company=company, user=iam_account).first()
        or DashboardConfiguration.objects.filter(company=company, user__isnull=True).first()
    )

    period_type = str(params.get("period_type") or (config.default_period_type if config else "MONTH")).upper()
    if period_type not in {"MONTH", "QUARTER", "YEAR", "CUSTOM", "YTD"}:
        raise ValidationError({"period_type": "Loại kỳ báo cáo không hợp lệ.", "code": "INVALID_PERIOD_TYPE"})

    fiscal_period_id = params.get("fiscal_period_id") or params.get("period_id") or params.get("period")
    from_date = _parse_date(params.get("from_date") or params.get("date_from"), "from_date")
    to_date = _parse_date(params.get("to_date") or params.get("date_to"), "to_date")
    fiscal_period: AccountingPeriod | None = None
    warnings: list[dict[str, Any]] = []

    if fiscal_period_id:
        fiscal_period = AccountingPeriod.objects.filter(company=company).filter(
            Q(id=fiscal_period_id) if len(str(fiscal_period_id)) == 36 else Q(code=str(fiscal_period_id))
        ).first()
        if not fiscal_period:
            raise ValidationError({"fiscal_period_id": "Kỳ kế toán không tồn tại.", "code": "FISCAL_PERIOD_NOT_FOUND"})
        from_date = fiscal_period.start_date
        to_date = fiscal_period.end_date
    elif period_type == "CUSTOM":
        if not from_date or not to_date:
            raise ValidationError({"from_date": "Chế độ tùy chọn ngày (CUSTOM) yêu cầu đầy đủ from_date và to_date.", "code": "CUSTOM_DATES_REQUIRED"})
        if from_date > to_date:
            raise ValidationError({"from_date": "Từ ngày không được lớn hơn đến ngày.", "code": "INVALID_DATE_RANGE"})
        if (to_date - from_date).days > 1850:
            raise ValidationError({"to_date": "Khoảng thời gian tra cứu vượt quá giới hạn tối đa (5 năm).", "code": "DATE_RANGE_TOO_LARGE"})
    elif from_date and to_date:
        if from_date > to_date:
            raise ValidationError({"from_date": "Từ ngày không được lớn hơn đến ngày.", "code": "INVALID_DATE_RANGE"})
        fiscal_period = AccountingPeriod.objects.filter(company=company, start_date=from_date, end_date=to_date).first()
    else:
        today = timezone.localdate()
        fiscal_period = (
            AccountingPeriod.objects.filter(company=company, start_date__lte=today, end_date__gte=today).first()
            or AccountingPeriod.objects.filter(company=company, status="OPEN").order_by("-start_date").first()
            or AccountingPeriod.objects.filter(company=company).order_by("-start_date").first()
        )
        if fiscal_period:
            if period_type == "MONTH":
                from_date, to_date = fiscal_period.start_date, fiscal_period.end_date
            elif period_type == "QUARTER":
                ref = fiscal_period.start_date
                q_start_month = ((ref.month - 1) // 3) * 3 + 1
                q_end_month = q_start_month + 2
                from_date = date(ref.year, q_start_month, 1)
                to_date = date(ref.year, q_end_month, calendar.monthrange(ref.year, q_end_month)[1])
            elif period_type == "YEAR":
                from_date = date(fiscal_period.fiscal_year, 1, 1)
                to_date = date(fiscal_period.fiscal_year, 12, 31)
            elif period_type == "YTD":
                from_date = date(fiscal_period.fiscal_year, 1, 1)
                to_date = fiscal_period.end_date
        else:
            if params.get("require_fiscal_period") in ("1", "true", "True", True):
                raise ValidationError({"fiscal_period_id": "Doanh nghiệp chưa thiết lập kỳ kế toán.", "code": "NO_FISCAL_PERIOD_CONFIGURED"})
            from_date = date(today.year, today.month, 1)
            to_date = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])
            warnings.append({
                "code": "NO_FISCAL_PERIOD_CONFIGURED",
                "message": "Doanh nghiệp chưa khai báo kỳ kế toán; đang sử dụng tháng hiện tại theo lịch.",
            })

    # Check accounting start date (EF-07 / AF-19)
    earliest_period = AccountingPeriod.objects.filter(company=company).order_by("start_date").first()
    start_date_bound = getattr(company, "start_date", None) or (earliest_period.start_date if earliest_period else None)
    is_before_start_date = False
    if start_date_bound and to_date < start_date_bound:
        is_before_start_date = True
        warnings.append({
            "code": "BEFORE_ACCOUNTING_START_DATE",
            "message": f"Kỳ được chọn ({from_date} đến {to_date}) nằm trước ngày bắt đầu hạch toán ({start_date_bound}).",
        })

    as_of_date = _parse_date(params.get("as_of_date"), "as_of_date") or to_date

    comparison_mode = str(params.get("comparison_mode") or (config.default_comparison_mode if config else "PREVIOUS_PERIOD")).upper()
    if comparison_mode == "YOY":
        comparison_mode = "SAME_PERIOD_LAST_YEAR"
    if comparison_mode not in {"PREVIOUS_PERIOD", "SAME_PERIOD_LAST_YEAR", "NONE"}:
        comparison_mode = "PREVIOUS_PERIOD"

    if comparison_mode == "PREVIOUS_PERIOD":
        comp_from, comp_to = _previous_period_dates(period_type, from_date, to_date)
    elif comparison_mode == "SAME_PERIOD_LAST_YEAR":
        comp_from, comp_to = _shift_year(from_date, -1), _shift_year(to_date, -1)
    else:
        comp_from, comp_to = None, None

    refresh_mode = str(params.get("refresh_mode") or "CACHE_FIRST").upper()
    if refresh_mode not in {"CACHE_FIRST", "FORCE_REFRESH"}:
        refresh_mode = "CACHE_FIRST"

    cash_flow_scope = str(params.get("cash_flow_scope") or (config.cash_flow_scope if config else "EXTERNAL_ONLY")).upper()
    if cash_flow_scope not in {"EXTERNAL_ONLY", "ALL_INCLUDING_INTERNAL"}:
        cash_flow_scope = "EXTERNAL_ONLY"

    raw_fail = params.get("simulate_error_widgets") or params.get("fail_widgets") or ""
    fail_widgets = {w.strip().upper() for w in str(raw_fail).split(",") if w.strip()}

    return DashboardContext(
        request=request,
        user=user,
        iam_account=iam_account,
        company=company,
        period_type=period_type,
        fiscal_period=fiscal_period,
        from_date=from_date,
        to_date=to_date,
        as_of_date=as_of_date,
        comparison_mode=comparison_mode,
        comparison_from_date=comp_from,
        comparison_to_date=comp_to,
        requested_branch_ids=requested_branch_ids,
        effective_branch_ids=effective_branch_ids,
        allowed_warehouse_ids=allowed_warehouse_ids,
        allowed_bank_account_ids=allowed_bank_account_ids,
        refresh_mode=refresh_mode,
        cash_flow_scope=cash_flow_scope,
        config=config,
        warnings=warnings,
        fail_widgets=fail_widgets,
        is_before_start_date=is_before_start_date,
    )


WIDGET_PERMISSION_ALIASES: dict[str, set[str]] = {
    "DASH-01": {"SAL.ORDER.VIEW", "RPT.COMMERCE.VIEW", "VIEW_DASH_REVENUE", "DASH-01"},
    "DASH-02": {"PUR.ORDER.VIEW", "RPT.COMMERCE.VIEW", "VIEW_DASH_PURCHASE", "DASH-02"},
    "DASH-03": {"CASH.TRANSACTION.VIEW", "BANK.TRANSACTION.VIEW", "RPT.MONEY.VIEW", "VIEW_DASH_CASH", "DASH-03"},
    "DASH-04": {"WF.TASK.VIEW", "GL.JOURNAL.VIEW", "VIEW_DASH_WORKFLOW", "DASH-04"},
    "DASH-05": {"CASH.TRANSACTION.VIEW", "BANK.TRANSACTION.VIEW", "RPT.MONEY.VIEW", "VIEW_DASH_CASHFLOW", "DASH-05"},
    "DASH-06": {"GL.JOURNAL.VIEW", "RPT.FINANCIAL.VIEW", "RPT.MANAGEMENT.VIEW", "VIEW_DASH_PNL", "DASH-06"},
    "DASH-07": {"AR.RECEIVABLE.VIEW", "RPT.DEBT.VIEW", "VIEW_DASH_AR", "DASH-07"},
    "DASH-08": {"AP.PAYABLE.VIEW", "RPT.DEBT.VIEW", "VIEW_DASH_AP", "DASH-08"},
    "DASH-09": {"INV.BALANCE.VIEW", "RPT.INVENTORY.VIEW", "VIEW_DASH_INVENTORY", "DASH-09"},
    "DASH-10": {"TAX.INVOICE.VIEW", "RPT.TAX.VIEW", "VIEW_DASH_TAX", "DASH-10"},
    "DASH-11": {"WF.TASK.VIEW", "GL.JOURNAL.VIEW", "VIEW_DASH_TASKS", "DASH-11"},
    "DASH-12": {"VIEW_DASH_RECENT_DOCS", "DASH-12"},
}

ALL_WIDGET_SPECIFIC_CODES: set[str] = set().union(*WIDGET_PERMISSION_ALIASES.values())


def is_widget_permitted(ctx: DashboardContext, metric_code: str) -> bool:
    if ctx.config and ctx.config.enabled_widgets:
        if metric_code not in ctx.config.enabled_widgets:
            return False
    if ctx.user.is_superuser:
        return True
    if not ctx.iam_account:
        return False

    now = timezone.now()
    alias_codes = WIDGET_PERMISSION_ALIASES.get(metric_code, {metric_code})
    # Check explicit DENY override on any alias
    if UserPermissionOverride.objects.filter(
        company_membership__user=ctx.iam_account,
        company_membership__company=ctx.company,
        permission__code__in=alias_codes,
        effect="DENY",
        revoked_at__isnull=True,
        valid_from__lte=now,
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).exists():
        return False

    if metric_code == "DASH-12":
        return True

    perm_codes = _user_permission_codes(ctx.iam_account, ctx.company)
    # If the user has been granted specific module/widget permissions beyond general dashboard view,
    # enforce granular widget permissions so partial-permission roles only see their allowed widgets (TC-RPT-01-06).
    non_dashboard_perms = perm_codes - {"RPT.DASHBOARD.VIEW", "RPT.DASHBOARD.REFRESH", "RPT.DASHBOARD.CONFIG", "RPT.CENTER.VIEW", "VIEW_DASHBOARD"}
    if non_dashboard_perms & ALL_WIDGET_SPECIFIC_CODES:
        return bool(perm_codes & alias_codes)
    return True


def build_drilldown_meta(ctx: DashboardContext, metric_code: str, extra_filters: dict[str, Any] | None = None) -> dict[str, Any]:
    catalog = DashboardMetricCatalog.objects.filter(metric_code=metric_code).first()
    target_uc = catalog.target_uc_code if catalog else "UC-RPT-02"
    target_report = catalog.target_report_code if catalog else ""
    target_perm = catalog.target_report_permission if catalog else ""
    target_route = catalog.target_route if catalog else "/reports"

    can_drill = True
    if not ctx.user.is_superuser:
        perm_codes = _user_permission_codes(ctx.iam_account, ctx.company)
        alias_codes = WIDGET_PERMISSION_ALIASES.get(metric_code, set())
        check_codes = ({target_perm} if target_perm else set()) | (alias_codes - {"DASH-01", "DASH-02", "DASH-03", "DASH-04", "DASH-05", "DASH-06", "DASH-07", "DASH-08", "DASH-09", "DASH-10", "DASH-11", "DASH-12"})
        if check_codes:
            can_drill = bool(perm_codes & check_codes)

    filters = {
        "company_id": str(ctx.company.id),
        "period_type": ctx.period_type,
        "fiscal_period_id": str(ctx.fiscal_period.id) if ctx.fiscal_period else None,
        "from_date": ctx.from_date.isoformat(),
        "to_date": ctx.to_date.isoformat(),
        "as_of_date": ctx.as_of_date.isoformat(),
        "branch_ids": ctx.effective_branch_ids if ctx.effective_branch_ids is not None else "ALL",
    }
    if extra_filters:
        filters.update(extra_filters)

    return {
        "target_uc_code": target_uc,
        "target_report_code": target_report,
        "target_route": target_route,
        "required_permission": target_perm,
        "can_drilldown": can_drill,
        "filters": filters,
    }


def execute_widget_safely(
    ctx: DashboardContext,
    metric_code: str,
    calculator: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    if not is_widget_permitted(ctx, metric_code):
        return {
            "metric_code": metric_code,
            "status": "FORBIDDEN",
            "has_permission": False,
            "value": None,
            "data": None,
            "warnings": [{"code": "WIDGET_PERMISSION_DENIED", "message": f"Không có quyền xem thành phần {metric_code}."}],
            "drilldown": None,
        }
    if metric_code in ctx.fail_widgets:
        return {
            "metric_code": metric_code,
            "status": "ERROR",
            "has_permission": True,
            "value": None,
            "data": None,
            "warnings": [{"code": "WIDGET_CALCULATION_ERROR", "message": f"Lỗi tính toán thành phần {metric_code}."}],
            "drilldown": build_drilldown_meta(ctx, metric_code),
        }
    try:
        res = calculator()
        res.setdefault("metric_code", metric_code)
        res.setdefault("has_permission", True)
        res.setdefault("drilldown", build_drilldown_meta(ctx, metric_code))
        return res
    except WidgetCalculationError as exc:
        return {
            "metric_code": metric_code,
            "status": "ERROR",
            "has_permission": True,
            "value": None,
            "data": None,
            "warnings": [{"code": exc.code, "message": exc.message}],
            "drilldown": build_drilldown_meta(ctx, metric_code),
        }
    except Exception as exc:
        return {
            "metric_code": metric_code,
            "status": "ERROR",
            "has_permission": True,
            "value": None,
            "data": None,
            "warnings": [{"code": "WIDGET_CALCULATION_ERROR", "message": str(exc)}],
            "drilldown": build_drilldown_meta(ctx, metric_code),
        }


def _filter_branches(qs, branch_field: str, branch_ids: list[str] | None):
    if branch_ids is None:
        return qs
    if not branch_ids:
        return qs.none()
    return qs.filter(**{f"{branch_field}__in": branch_ids})


# ==============================================================================
# DASH-01: Doanh thu bán hàng (Pre-VAT Net Revenue)
# ==============================================================================

def _calculate_revenue_for_range(ctx: DashboardContext, start_date: date, end_date: date) -> dict[str, Any]:
    from sales.models import GoodsSale, SalesAllowance, SalesReturn, ServiceSale

    if ctx.is_before_start_date and end_date <= ctx.to_date:
        return {
            "gross_revenue": ZERO,
            "revenue_deduction": ZERO,
            "net_revenue": ZERO,
            "tax_excluded_amount": ZERO,
            "document_count": 0,
            "documents": [],
        }

    # Verify account mapping exists for DASH-01 (EF-08)
    mappings = list(
        DashboardMetricAccountMapping.objects.filter(
            metric__metric_code="DASH-01",
            is_active=True,
        ).filter(Q(company=ctx.company) | Q(company__isnull=True))
    )
    if not mappings:
        raise WidgetCalculationError("MISSING_ACCOUNT_MAPPING", "Chưa cấu hình tài khoản doanh thu cho DASH-01.")

    rev_prefixes = tuple(
        p for m in mappings if m.line_code == "GROSS_REVENUE" for p in (m.account_prefixes or ["511"])
    ) or ("511",)
    ded_prefixes = tuple(
        p for m in mappings if m.line_code == "REVENUE_DEDUCTIONS" for p in (m.account_prefixes or ["521"])
    ) or ("521",)

    goods_qs = _filter_branches(
        GoodsSale.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("customer", "currency", "branch")
    service_qs = _filter_branches(
        ServiceSale.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("customer", "currency", "branch")
    return_qs = _filter_branches(
        SalesReturn.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("customer", "currency", "branch")
    allowance_qs = _filter_branches(
        SalesAllowance.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("customer", "currency", "branch")

    gross_rev = ZERO
    deduction = ZERO
    tax_excluded = ZERO
    linked_je_ids: set[Any] = set()
    linked_doc_ids: set[str] = set()
    docs: list[dict[str, Any]] = []

    for sale in goods_qs:
        rate = _to_decimal(sale.exchange_rate or 1)
        net_pre_tax = (_to_decimal(sale.subtotal) - _to_decimal(sale.discount_amount)) * rate
        vat_amt = _to_decimal(sale.tax_amount) * rate
        gross_rev += net_pre_tax
        tax_excluded += vat_amt
        if sale.journal_entry_id:
            linked_je_ids.add(sale.journal_entry_id)
        linked_doc_ids.add(str(sale.id))
        docs.append({
            "module": "SAL",
            "document_type": "GOODS_SALE",
            "document_id": str(sale.id),
            "document_number": sale.number,
            "posting_date": sale.posting_date.isoformat(),
            "party_name": sale.customer.name if sale.customer_id else "",
            "pre_tax_amount": _quantize_money(net_pre_tax),
            "tax_amount": _quantize_money(vat_amt),
            "total_amount": _quantize_money(_to_decimal(sale.total_amount) * rate),
            "direction": "REVENUE",
        })

    for sale in service_qs:
        rate = _to_decimal(sale.exchange_rate or 1)
        net_pre_tax = (_to_decimal(sale.subtotal) - _to_decimal(sale.discount_amount)) * rate
        vat_amt = _to_decimal(sale.tax_amount) * rate
        gross_rev += net_pre_tax
        tax_excluded += vat_amt
        if sale.journal_entry_id:
            linked_je_ids.add(sale.journal_entry_id)
        linked_doc_ids.add(str(sale.id))
        docs.append({
            "module": "SAL",
            "document_type": "SERVICE_SALE",
            "document_id": str(sale.id),
            "document_number": sale.number,
            "posting_date": sale.posting_date.isoformat(),
            "party_name": sale.customer.name if sale.customer_id else "",
            "pre_tax_amount": _quantize_money(net_pre_tax),
            "tax_amount": _quantize_money(vat_amt),
            "total_amount": _quantize_money(_to_decimal(sale.total_amount) * rate),
            "direction": "REVENUE",
        })

    for ret in return_qs:
        rate = _to_decimal(ret.exchange_rate or 1)
        ded_amt = (_to_decimal(ret.subtotal) - _to_decimal(ret.discount_amount)) * rate
        vat_amt = _to_decimal(ret.tax_amount) * rate
        deduction += ded_amt
        if ret.journal_entry_id:
            linked_je_ids.add(ret.journal_entry_id)
        linked_doc_ids.add(str(ret.id))
        docs.append({
            "module": "SAL",
            "document_type": "SALES_RETURN",
            "document_id": str(ret.id),
            "document_number": ret.number,
            "posting_date": ret.posting_date.isoformat(),
            "party_name": ret.customer.name if ret.customer_id else "",
            "pre_tax_amount": _quantize_money(-ded_amt),
            "tax_amount": _quantize_money(-vat_amt),
            "total_amount": _quantize_money(-_to_decimal(ret.total_amount) * rate),
            "direction": "DEDUCTION",
        })

    for allow in allowance_qs:
        rate = _to_decimal(allow.exchange_rate or 1)
        ded_amt = (_to_decimal(allow.subtotal) - _to_decimal(allow.discount_amount)) * rate
        vat_amt = _to_decimal(allow.tax_amount) * rate
        deduction += ded_amt
        if allow.journal_entry_id:
            linked_je_ids.add(allow.journal_entry_id)
        linked_doc_ids.add(str(allow.id))
        docs.append({
            "module": "SAL",
            "document_type": "SALES_ALLOWANCE",
            "document_id": str(allow.id),
            "document_number": allow.number,
            "posting_date": allow.posting_date.isoformat(),
            "party_name": allow.customer.name if allow.customer_id else "",
            "pre_tax_amount": _quantize_money(-ded_amt),
            "tax_amount": _quantize_money(-vat_amt),
            "total_amount": _quantize_money(-_to_decimal(allow.total_amount) * rate),
            "direction": "DEDUCTION",
        })

    # Include standalone GL JournalEntries on 511 / 521 not already linked to GoodsSale/ServiceSale/SalesReturn/SalesAllowance
    period_lines = _filter_branches(
        JournalLine.objects.filter(
            entry__company=ctx.company,
            entry__status="POSTED",
            entry__posting_date__range=(start_date, end_date),
        ).exclude(entry__entry_type="OPENING"),
        "entry__branch_id",
        ctx.effective_branch_ids,
    )
    if linked_je_ids:
        period_lines = period_lines.exclude(entry_id__in=linked_je_ids)
    if linked_doc_ids:
        period_lines = period_lines.exclude(entry__source_entity_id__in=linked_doc_ids)

    closing_entry_ids = set(
        period_lines.filter(account__code__startswith="911").values_list("entry_id", flat=True)
    )
    if closing_entry_ids:
        period_lines = period_lines.exclude(entry_id__in=closing_entry_ids)

    rev_q = Q()
    for p in rev_prefixes:
        rev_q |= Q(account__code__startswith=p)
    ded_q = Q()
    for p in ded_prefixes:
        ded_q |= Q(account__code__startswith=p)

    for line in period_lines.filter(rev_q | ded_q).select_related("entry", "account", "party"):
        code = line.account.code
        d = _to_decimal(line.debit)
        c = _to_decimal(line.credit)
        if any(code.startswith(p) for p in rev_prefixes):
            amt = c - d
            gross_rev += amt
            docs.append({
                "module": "GL",
                "document_type": "JOURNAL_ENTRY",
                "document_id": str(line.entry_id),
                "document_number": line.entry.number,
                "posting_date": line.entry.posting_date.isoformat(),
                "party_name": line.party.name if line.party_id else "",
                "pre_tax_amount": _quantize_money(amt),
                "tax_amount": _quantize_money(ZERO),
                "total_amount": _quantize_money(amt),
                "direction": "REVENUE",
            })
        elif any(code.startswith(p) for p in ded_prefixes):
            amt = d - c
            deduction += amt
            docs.append({
                "module": "GL",
                "document_type": "JOURNAL_ENTRY",
                "document_id": str(line.entry_id),
                "document_number": line.entry.number,
                "posting_date": line.entry.posting_date.isoformat(),
                "party_name": line.party.name if line.party_id else "",
                "pre_tax_amount": _quantize_money(-amt),
                "tax_amount": _quantize_money(ZERO),
                "total_amount": _quantize_money(-amt),
                "direction": "DEDUCTION",
            })

    net_rev = gross_rev - deduction
    return {
        "gross_revenue": gross_rev,
        "revenue_deduction": deduction,
        "net_revenue": net_rev,
        "tax_excluded_amount": tax_excluded,
        "document_count": len(docs),
        "documents": docs,
    }


def compute_dash_01_revenue(ctx: DashboardContext) -> dict[str, Any]:
    curr = _calculate_revenue_for_range(ctx, ctx.from_date, ctx.to_date)
    comp_val = None
    if ctx.comparison_mode != "NONE" and ctx.comparison_from_date and ctx.comparison_to_date:
        comp = _calculate_revenue_for_range(ctx, ctx.comparison_from_date, ctx.comparison_to_date)
        comp_val = comp["net_revenue"]

    cmp_info = compute_comparison_delta(curr["net_revenue"], comp_val, ctx.comparison_mode)
    has_data = curr["document_count"] > 0 or curr["net_revenue"] != ZERO
    return {
        "metric_code": "DASH-01",
        "name": "Doanh thu bán hàng",
        "status": "OK" if has_data else "NO_DATA",
        "value": _quantize_money(curr["net_revenue"]),
        "currency": ctx.company.accounting_currency.code,
        "comparison": cmp_info,
        "data": {
            "revenue_gross": _quantize_money(curr["gross_revenue"]),
            "revenue_deduction": _quantize_money(curr["revenue_deduction"]),
            "revenue_net": _quantize_money(curr["net_revenue"]),
            "vat_excluded": _quantize_money(curr["tax_excluded_amount"]),
            "document_count": curr["document_count"],
        },
        "warnings": [],
    }


# ==============================================================================
# DASH-02: Giá trị mua hàng (Pre-VAT Net Purchase Value)
# ==============================================================================

def _calculate_purchase_for_range(ctx: DashboardContext, start_date: date, end_date: date) -> dict[str, Any]:
    from accounts_payable.models import PayableDocument, SupplierInvoice
    from purchases.models import GoodsPurchase, PurchaseCost, PurchaseDiscount, PurchaseReturn

    if ctx.is_before_start_date and end_date <= ctx.to_date:
        return {
            "purchase_goods_service_amount": ZERO,
            "purchase_fixed_asset_amount": ZERO,
            "purchase_cost_amount": ZERO,
            "purchase_return_discount_amount": ZERO,
            "purchase_net_amount": ZERO,
            "document_count": 0,
            "documents": [],
        }

    gp_qs = _filter_branches(
        GoodsPurchase.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("supplier")
    pc_qs = _filter_branches(
        PurchaseCost.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("supplier")
    pr_qs = _filter_branches(
        PurchaseReturn.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("supplier")
    pd_qs = _filter_branches(
        PurchaseDiscount.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("supplier")

    goods_service_amt = ZERO
    fixed_asset_amt = ZERO
    cost_amt = ZERO
    deduction_amt = ZERO
    linked_je_ids: set[Any] = set()
    linked_invoice_ids: set[Any] = set()
    linked_doc_ids: set[str] = set()
    docs: list[dict[str, Any]] = []

    for gp in gp_qs:
        net_amt = _to_decimal(gp.subtotal) - _to_decimal(gp.discount_amount)
        goods_service_amt += net_amt
        if gp.journal_entry_id:
            linked_je_ids.add(gp.journal_entry_id)
        if gp.supplier_invoice_id:
            linked_invoice_ids.add(gp.supplier_invoice_id)
        linked_doc_ids.add(str(gp.id))
        docs.append({
            "module": "PUR",
            "document_type": "GOODS_PURCHASE",
            "document_id": str(gp.id),
            "document_number": gp.number,
            "posting_date": gp.posting_date.isoformat(),
            "party_name": gp.supplier.name if gp.supplier_id else "",
            "pre_tax_amount": _quantize_money(net_amt),
            "tax_amount": _quantize_money(gp.tax_amount),
            "total_amount": _quantize_money(gp.total_amount),
        })

    for pc in pc_qs:
        amt = _to_decimal(pc.subtotal)
        cost_amt += amt
        if pc.journal_entry_id:
            linked_je_ids.add(pc.journal_entry_id)
        if pc.supplier_invoice_id:
            linked_invoice_ids.add(pc.supplier_invoice_id)
        linked_doc_ids.add(str(pc.id))
        docs.append({
            "module": "PUR",
            "document_type": "PURCHASE_COST",
            "document_id": str(pc.id),
            "document_number": pc.number,
            "posting_date": pc.posting_date.isoformat(),
            "party_name": pc.supplier.name if pc.supplier_id else "",
            "pre_tax_amount": _quantize_money(amt),
            "tax_amount": _quantize_money(pc.tax_amount),
            "total_amount": _quantize_money(pc.total_amount),
        })

    for pr in pr_qs:
        amt = _to_decimal(pr.subtotal) - _to_decimal(pr.discount_amount)
        deduction_amt += amt
        if pr.journal_entry_id:
            linked_je_ids.add(pr.journal_entry_id)
        linked_doc_ids.add(str(pr.id))
        docs.append({
            "module": "PUR",
            "document_type": "PURCHASE_RETURN",
            "document_id": str(pr.id),
            "document_number": pr.number,
            "posting_date": pr.posting_date.isoformat(),
            "party_name": pr.supplier.name if pr.supplier_id else "",
            "pre_tax_amount": _quantize_money(-amt),
            "tax_amount": _quantize_money(-_to_decimal(pr.tax_amount)),
            "total_amount": _quantize_money(-_to_decimal(pr.total_amount)),
        })

    for pd in pd_qs:
        amt = _to_decimal(pd.pre_tax_amount)
        deduction_amt += amt
        if pd.journal_entry_id:
            linked_je_ids.add(pd.journal_entry_id)
        linked_doc_ids.add(str(pd.id))
        docs.append({
            "module": "PUR",
            "document_type": "PURCHASE_DISCOUNT",
            "document_id": str(pd.id),
            "document_number": pd.number,
            "posting_date": pd.posting_date.isoformat(),
            "party_name": pd.supplier.name if pd.supplier_id else "",
            "pre_tax_amount": _quantize_money(-amt),
            "tax_amount": _quantize_money(-_to_decimal(pd.tax_amount)),
            "total_amount": _quantize_money(-_to_decimal(pd.total_amount)),
        })

    # Direct SupplierInvoices (POSTED) not linked to GoodsPurchase / PurchaseCost
    inv_qs = _filter_branches(
        SupplierInvoice.objects.filter(
            company=ctx.company,
            status="POSTED",
            received_via_purchase=False,
        ).filter(
            Q(posting_date__range=(start_date, end_date))
            | (Q(posting_date__isnull=True) & Q(invoice_date__range=(start_date, end_date)))
        ),
        "branch_id",
        ctx.effective_branch_ids,
    ).exclude(id__in=linked_invoice_ids).select_related("supplier")

    for inv in inv_qs:
        rate = _to_decimal(inv.exchange_rate or 1)
        amt = (_to_decimal(inv.subtotal) - _to_decimal(inv.discount_amount)) * rate
        goods_service_amt += amt
        linked_doc_ids.add(str(inv.id))
        docs.append({
            "module": "AP",
            "document_type": "SUPPLIER_INVOICE",
            "document_id": str(inv.id),
            "document_number": inv.invoice_number,
            "posting_date": (inv.posting_date or inv.invoice_date).isoformat(),
            "party_name": inv.supplier.name if inv.supplier_id else inv.seller_name,
            "pre_tax_amount": _quantize_money(amt),
            "tax_amount": _quantize_money(_to_decimal(inv.tax_amount) * rate),
            "total_amount": _quantize_money(_to_decimal(inv.total_amount) * rate),
        })

    # PayableDocument (POSTED) not already linked to a counted SupplierInvoice
    ap_doc_qs = _filter_branches(
        PayableDocument.objects.filter(
            company=ctx.company,
            status="POSTED",
            posting_date__range=(start_date, end_date),
        ).exclude(invoice_id__in=linked_invoice_ids | {inv.id for inv in inv_qs}),
        "branch_id",
        ctx.effective_branch_ids,
    ).select_related("supplier")
    for ap_doc in ap_doc_qs:
        if ap_doc.source_document_id and ap_doc.source_document_id in linked_doc_ids:
            continue
        rate = _to_decimal(ap_doc.exchange_rate or 1)
        amt = _to_decimal(ap_doc.subtotal) * rate
        goods_service_amt += amt
        if ap_doc.journal_entry_id:
            linked_je_ids.add(ap_doc.journal_entry_id)
        linked_doc_ids.add(str(ap_doc.id))
        docs.append({
            "module": "AP",
            "document_type": "PAYABLE_DOCUMENT",
            "document_id": str(ap_doc.id),
            "document_number": ap_doc.number,
            "posting_date": ap_doc.posting_date.isoformat(),
            "party_name": ap_doc.supplier.name if ap_doc.supplier_id else "",
            "pre_tax_amount": _quantize_money(amt),
            "tax_amount": _quantize_money(_to_decimal(ap_doc.tax_amount) * rate),
            "total_amount": _quantize_money(_to_decimal(ap_doc.total_amount) * rate),
        })

    # Also check unlinked GL JournalEntries that record purchases (debiting 151/152/153/156/211/213/241/242/641/642 against 331 or with source_module in PUR/AP)
    je_qs = _filter_branches(
        JournalEntry.objects.filter(
            company=ctx.company,
            status="POSTED",
            posting_date__range=(start_date, end_date),
        ).exclude(entry_type="OPENING").exclude(id__in=linked_je_ids),
        "branch_id",
        ctx.effective_branch_ids,
    ).prefetch_related("lines__account")

    purchase_debit_prefixes = ("151", "152", "153", "156", "211", "213", "241", "242", "621", "622", "627", "641", "642")
    asset_prefixes = ("211", "213", "241")

    for entry in je_qs:
        if entry.source_entity_id and str(entry.source_entity_id) in linked_doc_ids:
            continue
        lines = list(entry.lines.all())
        has_331_credit = any(l.account.code.startswith("331") and _to_decimal(l.credit) > ZERO for l in lines)
        is_pur_module = entry.source_module in ("PUR", "AP")
        if not (has_331_credit or is_pur_module):
            continue
        entry_goods_amt = ZERO
        entry_asset_amt = ZERO
        for l in lines:
            code = l.account.code
            if code.startswith("133"):
                continue  # Exclude input VAT (DASH-PUR-03)
            deb = _to_decimal(l.debit)
            if deb > ZERO and any(code.startswith(p) for p in purchase_debit_prefixes):
                if any(code.startswith(ap) for ap in asset_prefixes):
                    entry_asset_amt += deb
                else:
                    entry_goods_amt += deb
        if entry_goods_amt > ZERO or entry_asset_amt > ZERO:
            goods_service_amt += entry_goods_amt
            fixed_asset_amt += entry_asset_amt
            docs.append({
                "module": entry.source_module or "GL",
                "document_type": "JOURNAL_ENTRY",
                "document_id": str(entry.id),
                "document_number": entry.number,
                "posting_date": entry.posting_date.isoformat(),
                "party_name": "",
                "pre_tax_amount": _quantize_money(entry_goods_amt + entry_asset_amt),
                "tax_amount": _quantize_money(ZERO),
                "total_amount": _quantize_money(entry_goods_amt + entry_asset_amt),
            })

    net_purchase = goods_service_amt + fixed_asset_amt + cost_amt - deduction_amt
    return {
        "purchase_goods_service_amount": goods_service_amt,
        "purchase_fixed_asset_amount": fixed_asset_amt,
        "purchase_cost_amount": cost_amt,
        "purchase_return_discount_amount": deduction_amt,
        "purchase_net_amount": net_purchase,
        "document_count": len(docs),
        "documents": docs,
    }


def compute_dash_02_purchase(ctx: DashboardContext) -> dict[str, Any]:
    curr = _calculate_purchase_for_range(ctx, ctx.from_date, ctx.to_date)
    comp_val = None
    if ctx.comparison_mode != "NONE" and ctx.comparison_from_date and ctx.comparison_to_date:
        comp = _calculate_purchase_for_range(ctx, ctx.comparison_from_date, ctx.comparison_to_date)
        comp_val = comp["purchase_net_amount"]

    cmp_info = compute_comparison_delta(curr["purchase_net_amount"], comp_val, ctx.comparison_mode)
    has_data = curr["document_count"] > 0 or curr["purchase_net_amount"] != ZERO
    return {
        "metric_code": "DASH-02",
        "name": "Giá trị mua hàng",
        "status": "OK" if has_data else "NO_DATA",
        "value": _quantize_money(curr["purchase_net_amount"]),
        "currency": ctx.company.accounting_currency.code,
        "comparison": cmp_info,
        "data": {
            "purchase_goods_service_amount": _quantize_money(curr["purchase_goods_service_amount"]),
            "purchase_fixed_asset_amount": _quantize_money(curr["purchase_fixed_asset_amount"]),
            "purchase_cost_amount": _quantize_money(curr["purchase_cost_amount"]),
            "purchase_return_discount_amount": _quantize_money(curr["purchase_return_discount_amount"]),
            "purchase_net_amount": _quantize_money(curr["purchase_net_amount"]),
            "document_count": curr["document_count"],
        },
        "warnings": [],
    }


# ==============================================================================
# DASH-03: Tổng tiền đã thu (Cash & Bank Receipts)
# ==============================================================================

INTERNAL_TRANSFER_BUSINESS_TYPES = {
    "INTERNAL_TRANSFER",
    "CASH_TRANSFER",
    "BANK_TRANSFER",
    "DEPOSIT_TO_BANK",
    "WITHDRAW_FROM_BANK",
    "FUND_TO_FUND",
    "CASH_TO_BANK",
    "BANK_TO_CASH",
}
INTERNAL_TRANSFER_MODULES = {"CASH_TRANSFER", "BANK_TRANSFER"}


def _is_internal_transfer_tx(tx) -> bool:
    btype = (getattr(tx, "business_type", "") or "").upper()
    smod = (getattr(tx, "source_module", "") or "").upper()
    desc = (getattr(tx, "description", "") or "").lower()
    if btype in INTERNAL_TRANSFER_BUSINESS_TYPES or smod in INTERNAL_TRANSFER_MODULES:
        return True
    if "chuyển quỹ" in desc or "nộp tiền vào ngân hàng" in desc or "rút tiền gửi" in desc or "chuyển tiền nội bộ" in desc:
        return True
    return False


def _calculate_cash_collected_for_range(ctx: DashboardContext, start_date: date, end_date: date) -> dict[str, Any]:
    from bank_management.models import BankTransaction, BankTransfer
    from cash_management.models import CashTransaction, CashTransfer

    if ctx.is_before_start_date and end_date <= ctx.to_date:
        return {
            "cash_receipt_amount": ZERO,
            "bank_receipt_amount": ZERO,
            "internal_transfer_in_amount": ZERO,
            "receipt_total_gross": ZERO,
            "receipt_total_external": ZERO,
            "selected_value": ZERO,
            "document_count": 0,
            "documents": [],
        }

    cash_qs = _filter_branches(
        CashTransaction.objects.filter(
            company=ctx.company,
            status="POSTED",
            transaction_date__range=(start_date, end_date),
            transaction_type__in=("RECEIPT", "ADVANCE_RETURN", "ADJUSTMENT_IN"),
        ),
        "fund__branch_id",
        ctx.effective_branch_ids,
    ).select_related("fund", "currency", "party")

    bank_qs = BankTransaction.objects.filter(
        company=ctx.company,
        status="POSTED",
        transaction_date__range=(start_date, end_date),
        transaction_type__in=("RECEIPT", "INTEREST", "OTHER_IN"),
    ).select_related("account__account", "currency", "party")
    if ctx.effective_branch_ids is not None:
        bank_qs = bank_qs.filter(
            Q(account__account__branch_id__in=ctx.effective_branch_ids) | Q(account__account__branch_id__isnull=True)
        )
    if ctx.allowed_bank_account_ids is not None:
        bank_qs = bank_qs.filter(account__account_id__in=ctx.allowed_bank_account_ids)

    cash_external = ZERO
    bank_external = ZERO
    internal_in = ZERO
    docs: list[dict[str, Any]] = []
    counted_transfer_refs: set[str] = set()

    for tx in cash_qs:
        amt = _to_decimal(tx.base_amount or (_to_decimal(tx.amount) * _to_decimal(tx.exchange_rate or 1)))
        is_internal = _is_internal_transfer_tx(tx)
        if is_internal:
            internal_in += amt
            if tx.source_reference:
                counted_transfer_refs.add(tx.source_reference)
        else:
            cash_external += amt
        docs.append({
            "module": "CASH",
            "document_type": tx.transaction_type,
            "document_id": str(tx.id),
            "document_number": tx.number,
            "posting_date": tx.transaction_date.isoformat(),
            "party_name": tx.party.name if tx.party_id else tx.payer_payee,
            "amount": _quantize_money(amt),
            "is_internal_transfer": is_internal,
        })

    for tx in bank_qs:
        amt = _to_decimal(tx.base_amount or (_to_decimal(tx.amount) * _to_decimal(tx.exchange_rate or 1)))
        is_internal = _is_internal_transfer_tx(tx)
        if is_internal:
            internal_in += amt
            if tx.source_reference:
                counted_transfer_refs.add(tx.source_reference)
        else:
            bank_external += amt
        docs.append({
            "module": "BANK",
            "document_type": tx.transaction_type,
            "document_id": str(tx.id),
            "document_number": tx.number,
            "posting_date": tx.transaction_date.isoformat(),
            "party_name": tx.party.name if tx.party_id else tx.counterparty_name,
            "amount": _quantize_money(amt),
            "is_internal_transfer": is_internal,
        })

    # Also check CashTransfer (CONFIRMED) & BankTransfer (CONFIRMED) not already represented as CashTransaction/BankTransaction
    ct_qs = CashTransfer.objects.filter(
        company=ctx.company,
        status="CONFIRMED",
        transfer_date__range=(start_date, end_date),
    )
    for ct in ct_qs:
        if ct.number in counted_transfer_refs or str(ct.id) in counted_transfer_refs:
            continue
        amt = _to_decimal(ct.amount) * _to_decimal(ct.exchange_rate or 1)
        internal_in += amt

    bt_qs = BankTransfer.objects.filter(
        company=ctx.company,
        status="CONFIRMED",
        transfer_date__range=(start_date, end_date),
    )
    for bt in bt_qs:
        if bt.number in counted_transfer_refs or str(bt.id) in counted_transfer_refs:
            continue
        amt = _to_decimal(bt.destination_amount) * _to_decimal(bt.exchange_rate or 1)
        internal_in += amt

    external_total = cash_external + bank_external
    gross_total = external_total + internal_in
    selected = external_total if ctx.cash_flow_scope == "EXTERNAL_ONLY" else gross_total

    return {
        "cash_receipt_amount": cash_external,
        "bank_receipt_amount": bank_external,
        "internal_transfer_in_amount": internal_in,
        "receipt_total_gross": gross_total,
        "receipt_total_external": external_total,
        "selected_value": selected,
        "document_count": len(docs),
        "documents": docs,
    }


def compute_dash_03_cash_collected(ctx: DashboardContext) -> dict[str, Any]:
    curr = _calculate_cash_collected_for_range(ctx, ctx.from_date, ctx.to_date)
    comp_val = None
    if ctx.comparison_mode != "NONE" and ctx.comparison_from_date and ctx.comparison_to_date:
        comp = _calculate_cash_collected_for_range(ctx, ctx.comparison_from_date, ctx.comparison_to_date)
        comp_val = comp["selected_value"]

    cmp_info = compute_comparison_delta(curr["selected_value"], comp_val, ctx.comparison_mode)
    has_data = curr["document_count"] > 0 or curr["receipt_total_gross"] != ZERO
    return {
        "metric_code": "DASH-03",
        "name": "Tổng tiền đã thu",
        "status": "OK" if has_data else "NO_DATA",
        "value": _quantize_money(curr["selected_value"]),
        "currency": ctx.company.accounting_currency.code,
        "comparison": cmp_info,
        "data": {
            "cash_flow_scope": ctx.cash_flow_scope,
            "cash_receipt_amount": _quantize_money(curr["cash_receipt_amount"]),
            "bank_receipt_amount": _quantize_money(curr["bank_receipt_amount"]),
            "internal_transfer_in_amount": _quantize_money(curr["internal_transfer_in_amount"]),
            "receipt_total_gross": _quantize_money(curr["receipt_total_gross"]),
            "receipt_total_external": _quantize_money(curr["receipt_total_external"]),
            "document_count": curr["document_count"],
        },
        "warnings": [],
    }


# ==============================================================================
# DASH-04: Chứng từ chờ xử lý & DASH-11: Danh sách công việc cần xử lý
# ==============================================================================

def _collect_workflow_and_action_items(ctx: DashboardContext) -> dict[str, Any]:
    from accounts_payable.models import PayableDocument, PaymentRequest, SupplierInvoice
    from accounts_receivable.models import CustomerReceiptVoucher, ReceivableDocument
    from approval_workflows.models import ApprovalDelegation, ApprovalTask
    from bank_management.models import BankTransaction
    from cash_management.models import CashTransaction
    from inventory.models import InventoryTransaction, ValuationRun
    from purchases.models import GoodsPurchase, PurchaseOrder, PurchaseRequest
    from sales.models import GoodsSale, SalesOrder, ServiceSale
    from tax_management.models import TaxInvoice

    now = timezone.now()
    today = ctx.as_of_date

    # Active delegations to current user
    delegator_ids: set[Any] = set()
    if ctx.iam_account:
        delegator_ids = set(
            ApprovalDelegation.objects.filter(
                company=ctx.company,
                delegate=ctx.iam_account,
                is_active=True,
                start_date__lte=today,
            )
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
            .values_list("delegator_id", flat=True)
        )

    # 1. ApprovalTask (Workflow Engine) - deduplicated by ApprovalTask.id (TC-RPT-01-36)
    task_qs = (
        ApprovalTask.objects.filter(
            request__company=ctx.company,
            request__status="PENDING_APPROVAL",
            status="PENDING",
        )
        .select_related("request__document_type", "request__submitted_by", "assignee")
        .distinct()
    )

    my_tasks: list[dict[str, Any]] = []
    company_pending_keys: set[str] = set()
    seen_task_ids: set[Any] = set()

    for task in task_qs:
        if task.id in seen_task_ids:
            continue
        seen_task_ids.add(task.id)
        req = task.request
        snap = req.snapshot or {}
        branch_id = snap.get("branch_id") or snap.get("branch")
        if ctx.effective_branch_ids is not None and branch_id and str(branch_id) not in ctx.effective_branch_ids:
            continue

        doc_key = f"{req.source_model}:{req.source_id}"
        company_pending_keys.add(doc_key)

        is_mine = bool(
            ctx.user.is_superuser
            or (ctx.iam_account and (task.assignee_id == ctx.iam_account.id or task.assignee_id in delegator_ids))
        )
        due_date = task.due_at.date() if task.due_at else None
        is_overdue = bool(due_date and due_date < today)
        days_waiting = max((today - req.submitted_at.date()).days, 0) if req.submitted_at else 0

        item_payload = {
            "task_id": str(task.id),
            "task_type": "APPROVAL",
            "priority": "HIGH" if is_overdue else ("MEDIUM" if days_waiting >= 3 else "NORMAL"),
            "is_overdue": is_overdue,
            "module": req.document_type.module_code if req.document_type_id else "WF",
            "document_type": req.document_type.code if req.document_type_id else req.source_model,
            "document_id": str(req.source_id),
            "document_number": snap.get("number") or snap.get("document_number") or str(req.source_id)[:8],
            "title": f"Duyệt chứng từ {snap.get('number') or req.source_model}",
            "amount": _quantize_money(snap.get("total_amount") or snap.get("amount")) if (snap.get("total_amount") or snap.get("amount")) is not None else None,
            "submitted_at": req.submitted_at.isoformat() if req.submitted_at else None,
            "due_at": task.due_at.isoformat() if task.due_at else None,
            "days_waiting": days_waiting,
            "Assigned_to_me": is_mine,
            "status": "PENDING_APPROVAL",
            "sort_tuple": (0 if is_overdue else 1, task.due_at.timestamp() if task.due_at else float("inf"), req.submitted_at.timestamp() if req.submitted_at else float("inf")),
        }
        if is_mine:
            my_tasks.append(item_payload)

    # 2. Subledger & GL documents in PENDING_APPROVAL (not DRAFT! TC-RPT-01-35)
    doc_models = [
        ("GL", "JOURNAL_ENTRY", JournalEntry, "branch_id", "number", "total_debit", "posting_date"),
        ("SAL", "SALES_ORDER", SalesOrder, "branch_id", "number", "total_amount", "document_date"),
        ("SAL", "GOODS_SALE", GoodsSale, "branch_id", "number", "total_amount", "posting_date"),
        ("SAL", "SERVICE_SALE", ServiceSale, "branch_id", "number", "total_amount", "posting_date"),
        ("PUR", "PURCHASE_REQUEST", PurchaseRequest, "branch_id", "number", None, "document_date"),
        ("PUR", "PURCHASE_ORDER", PurchaseOrder, "branch_id", "number", "total_amount", "document_date"),
        ("PUR", "GOODS_PURCHASE", GoodsPurchase, "branch_id", "number", "total_amount", "posting_date"),
        ("AP", "SUPPLIER_INVOICE", SupplierInvoice, "branch_id", "invoice_number", "total_amount", "invoice_date"),
        ("AP", "PAYABLE_DOCUMENT", PayableDocument, "branch_id", "number", "total_amount", "posting_date"),
        ("AP", "PAYMENT_REQUEST", PaymentRequest, "branch_id", "number", "total_amount", "requested_date"),
        ("AR", "RECEIVABLE_DOCUMENT", ReceivableDocument, "branch_id", "number", "amount", "posting_date"),
        ("AR", "CUSTOMER_RECEIPT", CustomerReceiptVoucher, "branch_id", "number", "amount", "posting_date"),
        ("CASH", "CASH_TRANSACTION", CashTransaction, "fund__branch_id", "number", "base_amount", "transaction_date"),
        ("BANK", "BANK_TRANSACTION", BankTransaction, None, "number", "base_amount", "transaction_date"),
        ("INV", "INVENTORY_TRANSACTION", InventoryTransaction, "branch_id", "number", "total_value", "transaction_date"),
    ]

    accounting_actions: list[dict[str, Any]] = []

    for mod_code, doc_type, model_cls, branch_field, num_field, amt_field, date_field in doc_models:
        qs_pending = model_cls.objects.filter(company=ctx.company, status="PENDING_APPROVAL")
        if branch_field:
            qs_pending = _filter_branches(qs_pending, branch_field, ctx.effective_branch_ids)
        for doc in qs_pending:
            doc_key = f"{model_cls.__name__}:{doc.id}"
            if doc_key not in company_pending_keys:
                company_pending_keys.add(doc_key)
                doc_num = getattr(doc, num_field, str(doc.id)[:8])
                amt_val = getattr(doc, amt_field, None) if amt_field else None
                sub_at = getattr(doc, "submitted_at", None) or getattr(doc, "created_at", now)
                days_waiting = max((today - sub_at.date()).days, 0) if sub_at else 0
                # If PaymentRequest has approver == iam_account or user has approve perm
                approver_id = getattr(doc, "approver_id", None)
                is_mine = bool(
                    ctx.user.is_superuser
                    or (ctx.iam_account and approver_id == ctx.iam_account.id)
                    or (approver_id is None and len(my_tasks) == 0)
                )
                task_item = {
                    "task_id": f"DOC-{doc.id}",
                    "task_type": "APPROVAL",
                    "priority": "MEDIUM" if days_waiting >= 3 else "NORMAL",
                    "is_overdue": days_waiting > 5,
                    "module": mod_code,
                    "document_type": doc_type,
                    "document_id": str(doc.id),
                    "document_number": doc_num,
                    "title": f"Chờ phê duyệt {doc_num}",
                    "amount": _quantize_money(amt_val) if amt_val is not None else None,
                    "submitted_at": sub_at.isoformat() if sub_at else None,
                    "due_at": None,
                    "days_waiting": days_waiting,
                    "assigned_to_me": is_mine,
                    "status": "PENDING_APPROVAL",
                    "sort_tuple": (1, float("inf"), sub_at.timestamp() if sub_at else float("inf")),
                }
                if is_mine:
                    my_tasks.append(task_item)

        # Check APPROVED documents waiting to be POSTED (needs_accounting_action_count)
        if doc_type not in ("SALES_ORDER", "PURCHASE_REQUEST", "PURCHASE_ORDER", "PAYMENT_REQUEST"):
            qs_approved = model_cls.objects.filter(company=ctx.company, status="APPROVED")
            if branch_field:
                qs_approved = _filter_branches(qs_approved, branch_field, ctx.effective_branch_ids)
            for doc in qs_approved:
                doc_num = getattr(doc, num_field, str(doc.id)[:8])
                amt_val = getattr(doc, amt_field, None) if amt_field else None
                upd_at = getattr(doc, "approved_at", None) or getattr(doc, "updated_at", now)
                accounting_actions.append({
                    "task_id": f"POST-{doc.id}",
                    "task_type": "NEEDS_POSTING",
                    "priority": "NORMAL",
                    "is_overdue": False,
                    "module": mod_code,
                    "document_type": doc_type,
                    "document_id": str(doc.id),
                    "document_number": doc_num,
                    "title": f"Chờ ghi sổ chứng từ {doc_num}",
                    "amount": _quantize_money(amt_val) if amt_val is not None else None,
                    "submitted_at": upd_at.isoformat() if upd_at else None,
                    "due_at": None,
                    "days_waiting": 0,
                    "assigned_to_me": True,
                    "status": "APPROVED",
                    "sort_tuple": (2, float("inf"), upd_at.timestamp() if upd_at else float("inf")),
                })

    # Check unlinked TaxInvoices
    unlinked_tax_qs = _filter_branches(
        TaxInvoice.objects.filter(company=ctx.company, status__in=("RECEIVED", "VALIDATED"), document_links__isnull=True),
        "branch_id",
        ctx.effective_branch_ids,
    )
    for tinv in unlinked_tax_qs:
        accounting_actions.append({
            "task_id": f"TAX-{tinv.id}",
            "task_type": "UNLINKED_TAX_INVOICE",
            "priority": "NORMAL",
            "is_overdue": False,
            "module": "TAX",
            "document_type": "TAX_INVOICE",
            "document_id": str(tinv.id),
            "document_number": tinv.invoice_number,
            "title": f"Hóa đơn {tinv.invoice_number} chưa gắn chứng từ hạch toán",
            "amount": _quantize_money(tinv.total_amount),
            "submitted_at": tinv.created_at.isoformat() if tinv.created_at else None,
            "due_at": None,
            "days_waiting": 0,
            "assigned_to_me": True,
            "status": tinv.status,
            "sort_tuple": (2, float("inf"), tinv.created_at.timestamp() if tinv.created_at else float("inf")),
        })

    # Check failed ValuationRun
    failed_vals = ValuationRun.objects.filter(company=ctx.company, status="FAILED")
    for fv in failed_vals:
        accounting_actions.append({
            "task_id": f"VAL-{fv.id}",
            "task_type": "VALUATION_FAILED",
            "priority": "HIGH",
            "is_overdue": True,
            "module": "INV",
            "document_type": "VALUATION_RUN",
            "document_id": str(fv.id),
            "document_number": f"VAL-{fv.valuation_date.isoformat()}",
            "title": f"Tính giá xuất kho ngày {fv.valuation_date.isoformat()} bị lỗi",
            "amount": None,
            "submitted_at": fv.created_at.isoformat() if fv.created_at else None,
            "due_at": None,
            "days_waiting": 0,
            "assigned_to_me": True,
            "status": "FAILED",
            "sort_tuple": (0, 0.0, fv.created_at.timestamp() if fv.created_at else float("inf")),
        })

    all_tasks = my_tasks + accounting_actions
    all_tasks.sort(key=lambda x: x["sort_tuple"])
    clean_tasks = [{k: v for k, v in item.items() if k != "sort_tuple"} for item in all_tasks]

    return {
        "pending_my_approval_count": len(my_tasks),
        "pending_company_approval_count": len(company_pending_keys),
        "needs_accounting_action_count": len(accounting_actions),
        "total_actionable_count": len(my_tasks) + len(accounting_actions),
        "tasks": clean_tasks,
    }


def compute_dash_04_pending_documents(ctx: DashboardContext) -> dict[str, Any]:
    summary = _collect_workflow_and_action_items(ctx)
    primary_count = summary["pending_my_approval_count"] or summary["pending_company_approval_count"]
    has_data = (
        summary["pending_my_approval_count"] > 0
        or summary["pending_company_approval_count"] > 0
        or summary["needs_accounting_action_count"] > 0
    )
    return {
        "metric_code": "DASH-04",
        "name": "Chứng từ chờ xử lý",
        "status": "OK" if has_data else "NO_DATA",
        "value": primary_count,
        "data": {
            "pending_my_approval_count": summary["pending_my_approval_count"],
            "pending_company_approval_count": summary["pending_company_approval_count"],
            "needs_accounting_action_count": summary["needs_accounting_action_count"],
            "total_actionable_count": summary["total_actionable_count"],
        },
        "warnings": [],
    }


def compute_dash_11_tasks(ctx: DashboardContext, limit: int | None = None) -> dict[str, Any]:
    summary = _collect_workflow_and_action_items(ctx)
    max_items = limit or (ctx.config.tasks_limit if ctx.config else 3)
    items = summary["tasks"][:max_items]
    return {
        "metric_code": "DASH-11",
        "name": "Danh sách công việc cần xử lý",
        "status": "OK" if summary["tasks"] else "NO_DATA",
        "value": len(summary["tasks"]),
        "data": {
            "total_count": len(summary["tasks"]),
            "displayed_count": len(items),
            "pending_my_approval_count": summary["pending_my_approval_count"],
            "pending_company_approval_count": summary["pending_company_approval_count"],
            "needs_accounting_action_count": summary["needs_accounting_action_count"],
            "items": items,
        },
        "warnings": [],
    }


# ==============================================================================
# DASH-05: Biểu đồ dòng tiền thu – chi (Cash Flow Time-Series)
# ==============================================================================

def _calculate_opening_cash_balance(ctx: DashboardContext, before_date: date) -> Decimal:
    from bank_management.models import BankTransaction
    from cash_management.models import CashTransaction

    if ctx.is_before_start_date:
        return ZERO

    # 1. Sum GL Opening & prior period POSTED lines on 111*, 112*, 113*
    gl_qs = _filter_branches(
        JournalLine.objects.filter(
            entry__company=ctx.company,
            entry__status="POSTED",
        ).filter(
            Q(account__code__startswith="111")
            | Q(account__code__startswith="112")
            | Q(account__code__startswith="113")
        ).filter(
            Q(entry__entry_type="OPENING", entry__posting_date__lte=before_date)
            | Q(entry__posting_date__lt=before_date)
        ),
        "entry__branch_id",
        ctx.effective_branch_ids,
    )
    agg = gl_qs.aggregate(d=Sum("debit"), c=Sum("credit"))
    gl_opening = _to_decimal(agg["d"]) - _to_decimal(agg["c"])
    linked_je_refs = set(
        gl_qs.exclude(entry__number="").values_list("entry__number", flat=True)
    ) | set(str(x) for x in gl_qs.values_list("entry_id", flat=True))

    # 2. Include prior POSTED CashTransaction / BankTransaction not already in GL
    cash_prior = _filter_branches(
        CashTransaction.objects.filter(company=ctx.company, status="POSTED", transaction_date__lt=before_date),
        "fund__branch_id",
        ctx.effective_branch_ids,
    )
    sub_delta = ZERO
    for tx in cash_prior:
        if tx.gl_reference and tx.gl_reference in linked_je_refs:
            continue
        amt = _to_decimal(tx.base_amount or (_to_decimal(tx.amount) * _to_decimal(tx.exchange_rate or 1)))
        if tx.transaction_type in ("RECEIPT", "ADVANCE_RETURN", "ADJUSTMENT_IN"):
            sub_delta += amt
        else:
            sub_delta -= amt

    bank_prior = BankTransaction.objects.filter(company=ctx.company, status="POSTED", transaction_date__lt=before_date)
    if ctx.effective_branch_ids is not None:
        bank_prior = bank_prior.filter(
            Q(account__account__branch_id__in=ctx.effective_branch_ids) | Q(account__account__branch_id__isnull=True)
        )
    if ctx.allowed_bank_account_ids is not None:
        bank_prior = bank_prior.filter(account__account_id__in=ctx.allowed_bank_account_ids)
    for tx in bank_prior:
        if tx.gl_reference and tx.gl_reference in linked_je_refs:
            continue
        amt = _to_decimal(tx.base_amount or (_to_decimal(tx.amount) * _to_decimal(tx.exchange_rate or 1)))
        if tx.transaction_type in ("RECEIPT", "INTEREST", "OTHER_IN"):
            sub_delta += amt
        else:
            sub_delta -= amt

    return gl_opening + sub_delta


def compute_dash_05_cash_flow(ctx: DashboardContext, bucket_override: str | None = None) -> dict[str, Any]:
    from bank_management.models import BankTransaction
    from cash_management.models import CashTransaction

    span_days = (ctx.to_date - ctx.from_date).days + 1
    bucket_mode = (bucket_override or ("DAY" if span_days <= 31 else "MONTH")).upper()

    opening_balance = _calculate_opening_cash_balance(ctx, ctx.from_date)

    # Build time buckets
    buckets: dict[str, dict[str, Any]] = {}
    if bucket_mode == "DAY":
        cur = ctx.from_date
        while cur <= ctx.to_date:
            key = cur.isoformat()
            buckets[key] = {
                "bucket_key": key,
                "label": cur.strftime("%d/%m"),
                "start_date": cur.isoformat(),
                "end_date": cur.isoformat(),
                "inflow": ZERO,
                "outflow": ZERO,
                "internal_in": ZERO,
                "internal_out": ZERO,
            }
            cur += timedelta(days=1)
    else:
        cur = date(ctx.from_date.year, ctx.from_date.month, 1)
        while cur <= ctx.to_date:
            m_end = date(cur.year, cur.month, calendar.monthrange(cur.year, cur.month)[1])
            b_start = max(cur, ctx.from_date)
            b_end = min(m_end, ctx.to_date)
            key = f"{cur.year:04d}-{cur.month:02d}"
            buckets[key] = {
                "bucket_key": key,
                "label": f"T{cur.month:02d}/{cur.year}",
                "start_date": b_start.isoformat(),
                "end_date": b_end.isoformat(),
                "inflow": ZERO,
                "outflow": ZERO,
                "internal_in": ZERO,
                "internal_out": ZERO,
            }
            cur = m_end + timedelta(days=1)

    def _bucket_key_for(d: date) -> str:
        return d.isoformat() if bucket_mode == "DAY" else f"{d.year:04d}-{d.month:02d}"

    cash_qs = _filter_branches(
        CashTransaction.objects.filter(
            company=ctx.company,
            status="POSTED",
            transaction_date__range=(ctx.from_date, ctx.to_date),
        ),
        "fund__branch_id",
        ctx.effective_branch_ids,
    )
    bank_qs = BankTransaction.objects.filter(
        company=ctx.company,
        status="POSTED",
        transaction_date__range=(ctx.from_date, ctx.to_date),
    )
    if ctx.effective_branch_ids is not None:
        bank_qs = bank_qs.filter(
            Q(account__account__branch_id__in=ctx.effective_branch_ids) | Q(account__account__branch_id__isnull=True)
        )
    if ctx.allowed_bank_account_ids is not None:
        bank_qs = bank_qs.filter(account__account_id__in=ctx.allowed_bank_account_ids)

    tx_count = 0
    if not ctx.is_before_start_date:
        for tx in cash_qs:
            bkey = _bucket_key_for(tx.transaction_date)
            if bkey not in buckets:
                continue
            tx_count += 1
            amt = _to_decimal(tx.base_amount or (_to_decimal(tx.amount) * _to_decimal(tx.exchange_rate or 1)))
            is_in = tx.transaction_type in ("RECEIPT", "ADVANCE_RETURN", "ADJUSTMENT_IN")
            is_internal = _is_internal_transfer_tx(tx)
            if is_internal:
                if is_in:
                    buckets[bkey]["internal_in"] += amt
                else:
                    buckets[bkey]["internal_out"] += amt
            else:
                if is_in:
                    buckets[bkey]["inflow"] += amt
                else:
                    buckets[bkey]["outflow"] += amt

        for tx in bank_qs:
            bkey = _bucket_key_for(tx.transaction_date)
            if bkey not in buckets:
                continue
            tx_count += 1
            amt = _to_decimal(tx.base_amount or (_to_decimal(tx.amount) * _to_decimal(tx.exchange_rate or 1)))
            is_in = tx.transaction_type in ("RECEIPT", "INTEREST", "OTHER_IN")
            is_internal = _is_internal_transfer_tx(tx)
            if is_internal:
                if is_in:
                    buckets[bkey]["internal_in"] += amt
                else:
                    buckets[bkey]["internal_out"] += amt
            else:
                if is_in:
                    buckets[bkey]["inflow"] += amt
                else:
                    buckets[bkey]["outflow"] += amt

    running = opening_balance
    total_in = ZERO
    total_out = ZERO
    total_internal_in = ZERO
    total_internal_out = ZERO
    series: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for b in buckets.values():
        in_amt = b["inflow"] if ctx.cash_flow_scope == "EXTERNAL_ONLY" else (b["inflow"] + b["internal_in"])
        out_amt = b["outflow"] if ctx.cash_flow_scope == "EXTERNAL_ONLY" else (b["outflow"] + b["internal_out"])
        net = in_amt - out_amt
        open_b = running
        close_b = open_b + net
        running = close_b

        total_in += in_amt
        total_out += out_amt
        total_internal_in += b["internal_in"]
        total_internal_out += b["internal_out"]

        series.append({
            "bucket_key": b["bucket_key"],
            "label": b["label"],
            "start_date": b["start_date"],
            "end_date": b["end_date"],
            "opening_balance": _quantize_money(open_b),
            "inflow_amount": _quantize_money(in_amt),
            "outflow_amount": _quantize_money(out_amt),
            "internal_transfer_in_amount": _quantize_money(b["internal_in"]),
            "internal_transfer_out_amount": _quantize_money(b["internal_out"]),
            "net_cash_flow": _quantize_money(net),
            "closing_balance": _quantize_money(close_b),
        })

    closing_balance = opening_balance + total_in - total_out
    if closing_balance < ZERO:
        warnings.append({
            "code": "NEGATIVE_CASH_BALANCE",
            "message": "Số dư tiền cuối kỳ đang âm; cần kiểm tra lại chứng từ thu chi hoặc số dư đầu kỳ.",
        })

    has_data = tx_count > 0 or opening_balance != ZERO or total_in != ZERO or total_out != ZERO
    return {
        "metric_code": "DASH-05",
        "name": "Biểu đồ dòng tiền thu – chi",
        "status": "OK" if has_data else "NO_DATA",
        "value": _quantize_money(total_in - total_out),
        "currency": ctx.company.accounting_currency.code,
        "data": {
            "bucket_type": bucket_mode,
            "cash_flow_scope": ctx.cash_flow_scope,
            "opening_cash_balance": _quantize_money(opening_balance),
            "cash_inflow_total": _quantize_money(total_in),
            "cash_outflow_total": _quantize_money(total_out),
            "internal_transfer_in_total": _quantize_money(total_internal_in),
            "internal_transfer_out_total": _quantize_money(total_internal_out),
            "net_cash_flow": _quantize_money(total_in - total_out),
            "closing_cash_balance": _quantize_money(closing_balance),
            "reconciled": (opening_balance + total_in - total_out) == closing_balance,
            "series": series,
        },
        "warnings": warnings,
    }


# ==============================================================================
# DASH-06: Doanh thu, chi phí và lợi nhuận (Profitability P&L Summary)
# ==============================================================================

def _calculate_pnl_for_range(ctx: DashboardContext, start_date: date, end_date: date) -> dict[str, Any]:
    from sales.models import CostOfGoodsSold, GoodsSale

    if ctx.is_before_start_date and end_date <= ctx.to_date:
        return {
            "gross_revenue": ZERO,
            "revenue_deduction": ZERO,
            "net_revenue": ZERO,
            "cogs": ZERO,
            "gross_profit": ZERO,
            "financial_income": ZERO,
            "financial_expense": ZERO,
            "selling_expense": ZERO,
            "admin_expense": ZERO,
            "operating_profit": ZERO,
            "other_income": ZERO,
            "other_expense": ZERO,
            "profit_before_tax": ZERO,
            "cit_expense": ZERO,
            "profit_after_tax": ZERO,
            "total_expense": ZERO,
            "net_profit": ZERO,
            "has_activity": False,
            "warnings": [],
        }

    # Ensure revenue matches DASH-01 exactly
    rev_info = _calculate_revenue_for_range(ctx, start_date, end_date)
    gross_rev = rev_info["gross_revenue"]
    rev_ded = rev_info["revenue_deduction"]
    net_rev = rev_info["net_revenue"]

    # Query GL operational lines (excluding OPENING and 911 closing entries - TC-RPT-01-22)
    period_lines = _filter_branches(
        JournalLine.objects.filter(
            entry__company=ctx.company,
            entry__status="POSTED",
            entry__posting_date__range=(start_date, end_date),
        ).exclude(entry__entry_type="OPENING"),
        "entry__branch_id",
        ctx.effective_branch_ids,
    )
    closing_entry_ids = set(
        period_lines.filter(account__code__startswith="911").values_list("entry_id", flat=True)
    )
    operational_lines = period_lines.exclude(entry_id__in=closing_entry_ids) if closing_entry_ids else period_lines

    def _net_account_prefix(*prefixes: str, mode: str = "debit_minus_credit") -> Decimal:
        q = Q()
        for p in prefixes:
            q |= Q(account__code__startswith=p)
        agg = operational_lines.filter(q).aggregate(d=Sum("debit"), c=Sum("credit"))
        d = _to_decimal(agg["d"])
        c = _to_decimal(agg["c"])
        return (d - c) if mode == "debit_minus_credit" else (c - d)

    cogs = _net_account_prefix("632", mode="debit_minus_credit")
    # Also include POSTED CostOfGoodsSold or GoodsSale.lines.cogs_amount if not yet in GL 632
    cogs_je_ids = set(
        operational_lines.filter(account__code__startswith="632").values_list("entry_id", flat=True)
    )
    cogs_vouchers = _filter_branches(
        CostOfGoodsSold.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(start_date, end_date)),
        "branch_id",
        ctx.effective_branch_ids,
    )
    for cv in cogs_vouchers:
        if not cv.journal_entry_id or cv.journal_entry_id not in cogs_je_ids:
            cogs += _to_decimal(cv.total_cogs_amount)

    fin_inc = _net_account_prefix("515", mode="credit_minus_debit")
    fin_exp = _net_account_prefix("635", mode="debit_minus_credit")
    sell_exp = _net_account_prefix("641", mode="debit_minus_credit")
    adm_exp = _net_account_prefix("642", mode="debit_minus_credit")
    oth_inc = _net_account_prefix("711", mode="credit_minus_debit")
    oth_exp = _net_account_prefix("811", mode="debit_minus_credit")
    cit_exp = _net_account_prefix("821", mode="debit_minus_credit")

    gross_profit = net_rev - cogs
    operating_profit = gross_profit + fin_inc - (fin_exp + sell_exp + adm_exp)
    other_profit = oth_inc - oth_exp
    pbt = operating_profit + other_profit
    pat = pbt - cit_exp
    total_expense = cogs + fin_exp + sell_exp + adm_exp + oth_exp + cit_exp

    warnings: list[dict[str, Any]] = []
    # Check if GoodsSale exists without COGS (EF-10 / TC-RPT-01-24)
    has_inventory_goods_sale = _filter_branches(
        GoodsSale.objects.filter(
            company=ctx.company,
            status="POSTED",
            posting_date__range=(start_date, end_date),
        ).exclude(inventory_handling="NO_INVENTORY"),
        "branch_id",
        ctx.effective_branch_ids,
    ).exists()
    if (has_inventory_goods_sale or (gross_rev > ZERO and cogs == ZERO and operational_lines.filter(account__code__startswith="5111").exists())) and cogs == ZERO:
        warnings.append({
            "code": "COGS_NOT_RECORDED",
            "message": "Đã phát sinh doanh thu bán hàng hóa nhưng chưa ghi nhận giá vốn hàng bán (TK 632).",
        })

    has_activity = bool(
        rev_info["document_count"] > 0
        or net_rev != ZERO
        or total_expense != ZERO
        or fin_inc != ZERO
        or oth_inc != ZERO
    )
    return {
        "gross_revenue": gross_rev,
        "revenue_deduction": rev_ded,
        "net_revenue": net_rev,
        "cogs": cogs,
        "gross_profit": gross_profit,
        "financial_income": fin_inc,
        "financial_expense": fin_exp,
        "selling_expense": sell_exp,
        "admin_expense": adm_exp,
        "operating_profit": operating_profit,
        "other_income": oth_inc,
        "other_expense": oth_exp,
        "profit_before_tax": pbt,
        "cit_expense": cit_exp,
        "profit_after_tax": pat,
        "total_expense": total_expense,
        "net_profit": pat,
        "has_activity": has_activity,
        "warnings": warnings,
    }


def compute_dash_06_profitability(ctx: DashboardContext) -> dict[str, Any]:
    curr = _calculate_pnl_for_range(ctx, ctx.from_date, ctx.to_date)
    comp_val = None
    if ctx.comparison_mode != "NONE" and ctx.comparison_from_date and ctx.comparison_to_date:
        comp = _calculate_pnl_for_range(ctx, ctx.comparison_from_date, ctx.comparison_to_date)
        comp_val = comp["net_profit"]

    cmp_info = compute_comparison_delta(curr["net_profit"], comp_val, ctx.comparison_mode)

    # Monthly series within [from_date, to_date]
    series: list[dict[str, Any]] = []
    cur = date(ctx.from_date.year, ctx.from_date.month, 1)
    while cur <= ctx.to_date:
        m_end = date(cur.year, cur.month, calendar.monthrange(cur.year, cur.month)[1])
        b_start = max(cur, ctx.from_date)
        b_end = min(m_end, ctx.to_date)
        m_pnl = _calculate_pnl_for_range(ctx, b_start, b_end) if (b_start != ctx.from_date or b_end != ctx.to_date) else curr
        series.append({
            "period_key": f"{cur.year:04d}-{cur.month:02d}",
            "label": f"T{cur.month:02d}/{cur.year}",
            "net_revenue": _quantize_money(m_pnl["net_revenue"]),
            "total_expense": _quantize_money(m_pnl["total_expense"]),
            "gross_profit": _quantize_money(m_pnl["gross_profit"]),
            "operating_profit": _quantize_money(m_pnl["operating_profit"]),
            "profit_before_tax": _quantize_money(m_pnl["profit_before_tax"]),
            "profit_after_tax": _quantize_money(m_pnl["profit_after_tax"]),
        })
        cur = m_end + timedelta(days=1)

    return {
        "metric_code": "DASH-06",
        "name": "Doanh thu, chi phí và lợi nhuận",
        "status": "OK" if curr["has_activity"] else "NO_DATA",
        "value": _quantize_money(curr["net_profit"]),
        "currency": ctx.company.accounting_currency.code,
        "comparison": cmp_info,
        "data": {
            "gross_revenue": _quantize_money(curr["gross_revenue"]),
            "revenue_deduction": _quantize_money(curr["revenue_deduction"]),
            "net_revenue": _quantize_money(curr["net_revenue"]),
            "cogs": _quantize_money(curr["cogs"]),
            "gross_profit": _quantize_money(curr["gross_profit"]),
            "financial_income": _quantize_money(curr["financial_income"]),
            "financial_expense": _quantize_money(curr["financial_expense"]),
            "selling_expense": _quantize_money(curr["selling_expense"]),
            "admin_expense": _quantize_money(curr["admin_expense"]),
            "operating_profit": _quantize_money(curr["operating_profit"]),
            "other_income": _quantize_money(curr["other_income"]),
            "other_expense": _quantize_money(curr["other_expense"]),
            "profit_before_tax": _quantize_money(curr["profit_before_tax"]),
            "cit_expense": _quantize_money(curr["cit_expense"]),
            "profit_after_tax": _quantize_money(curr["profit_after_tax"]),
            "total_expense": _quantize_money(curr["total_expense"]),
            "net_profit": _quantize_money(curr["net_profit"]),
            "series": series,
        },
        "warnings": curr["warnings"],
    }


# ==============================================================================
# DASH-07: Công nợ phải thu (Accounts Receivable Summary & Aging)
# ==============================================================================

def _aging_bucket_key(as_of_date: date, due_date: date | None) -> tuple[str, int]:
    if not due_date:
        return "not_due", 0
    days_overdue = (as_of_date - due_date).days
    if days_overdue <= 0:
        return "not_due", 0
    if days_overdue <= 30:
        return "overdue_1_30", days_overdue
    if days_overdue <= 60:
        return "overdue_31_60", days_overdue
    if days_overdue <= 90:
        return "overdue_61_90", days_overdue
    return "overdue_over_90", days_overdue


def compute_dash_07_receivables(ctx: DashboardContext, top_n: int = 5) -> dict[str, Any]:
    from accounts_receivable.models import Receipt, Receivable

    as_of = ctx.as_of_date
    if ctx.is_before_start_date:
        return {
            "metric_code": "DASH-07",
            "name": "Công nợ phải thu",
            "status": "NO_DATA",
            "value": _quantize_money(ZERO),
            "currency": ctx.company.accounting_currency.code,
            "data": {
                "as_of_date": as_of.isoformat(),
                "ar_total_receivable": _quantize_money(ZERO),
                "ar_not_due_amount": _quantize_money(ZERO),
                "ar_overdue_amount": _quantize_money(ZERO),
                "ar_customer_advance_amount": _quantize_money(ZERO),
                "overdue_customer_count": 0,
                "aging_buckets": {
                    "not_due": _quantize_money(ZERO),
                    "overdue_1_30": _quantize_money(ZERO),
                    "overdue_31_60": _quantize_money(ZERO),
                    "overdue_61_90": _quantize_money(ZERO),
                    "overdue_over_90": _quantize_money(ZERO),
                },
                "top_debtors": [],
            },
            "warnings": [],
        }

    rec_qs = _filter_branches(
        Receivable.objects.filter(company=ctx.company)
        .filter(
            Q(posting_date__lte=as_of)
            | (Q(posting_date__isnull=True) & Q(document_date__lte=as_of))
            | (Q(posting_date__isnull=True, document_date__isnull=True) & Q(document__posting_date__lte=as_of))
            | (Q(posting_date__isnull=True, document_date__isnull=True, document__isnull=True))
        )
        .select_related("customer", "document", "currency")
        .prefetch_related("schedules", "allocations__receipt", "nettings", "adjustments"),
        "branch_id",
        ctx.effective_branch_ids,
    )

    aging = {
        "not_due": ZERO,
        "overdue_1_30": ZERO,
        "overdue_31_60": ZERO,
        "overdue_61_90": ZERO,
        "overdue_over_90": ZERO,
    }
    customer_totals: dict[str, dict[str, Any]] = {}
    overdue_customers: set[str] = set()
    items_detail: list[dict[str, Any]] = []

    for rec in rec_qs:
        if rec.status == "REVERSED" and (not rec.reversed_at or rec.reversed_at.date() <= as_of):
            continue
        eff_date = rec.posting_date or rec.document_date or (rec.document.posting_date if rec.document_id else None)
        if eff_date and eff_date > as_of:
            continue

        rate = _to_decimal(rec.exchange_rate or 1)
        orig = _to_decimal(rec.original_amount)

        # Historical reconstruction of collected_amount at as_of_date (TC-RPT-01-28)
        active_allocs = [
            a for a in rec.allocations.all()
            if a.reversed_at is None and a.receipt.status == "CONFIRMED"
        ]
        if active_allocs:
            alloc_total_all = sum((_to_decimal(a.amount) for a in active_allocs), ZERO)
            alloc_up_to = sum(
                (_to_decimal(a.amount) for a in active_allocs if (a.effective_date or a.receipt.receipt_date) <= as_of),
                ZERO,
            )
            untracked_collected = max(_to_decimal(rec.collected_amount) - alloc_total_all, ZERO)
            collected_as_of = alloc_up_to + untracked_collected
        else:
            collected_as_of = _to_decimal(rec.collected_amount)

        # Historical reconstruction of netted_amount at as_of_date
        posted_nettings = [
            n for n in rec.nettings.all()
            if n.status == "POSTED" and (n.reversed_at is None or n.reversed_at.date() > as_of)
        ]
        if posted_nettings:
            net_total_all = sum((_to_decimal(n.amount) for n in posted_nettings), ZERO)
            net_up_to = sum((_to_decimal(n.amount) for n in posted_nettings if n.netting_date <= as_of), ZERO)
            untracked_net = max(_to_decimal(rec.netted_amount) - net_total_all, ZERO)
            netted_as_of = net_up_to + untracked_net
        else:
            netted_as_of = _to_decimal(rec.netted_amount)

        # Historical reconstruction of adjustment_amount at as_of_date
        posted_adjs = [a for a in rec.adjustments.all() if a.status == "POSTED"]
        if posted_adjs:
            adj_up_to = sum((_to_decimal(a.amount) for a in posted_adjs if a.adjustment_date <= as_of), ZERO)
        else:
            adj_up_to = _to_decimal(rec.adjustment_amount)

        open_fc = max(orig + adj_up_to - collected_as_of - netted_as_of, ZERO)
        open_base = open_fc * rate
        if open_base <= ZERO:
            continue

        cust_id = str(rec.customer_id)
        if cust_id not in customer_totals:
            customer_totals[cust_id] = {
                "party_id": cust_id,
                "party_code": rec.customer.code,
                "party_name": rec.customer.name,
                "total_balance": ZERO,
                "not_due_amount": ZERO,
                "overdue_amount": ZERO,
                "max_days_overdue": 0,
            }

        schedules = list(rec.schedules.all())
        if schedules:
            remaining_settled = collected_as_of + netted_as_of - min(adj_up_to, ZERO)
            for sch in schedules:
                sch_amt = _to_decimal(sch.amount)
                settled_for_sch = min(sch_amt, max(remaining_settled, ZERO))
                remaining_settled = max(remaining_settled - settled_for_sch, ZERO)
                sch_open_base = max(sch_amt - settled_for_sch, ZERO) * rate
                if sch_open_base <= ZERO:
                    continue
                b_key, days_over = _aging_bucket_key(as_of, sch.due_date)
                aging[b_key] += sch_open_base
                customer_totals[cust_id]["total_balance"] += sch_open_base
                if b_key == "not_due":
                    customer_totals[cust_id]["not_due_amount"] += sch_open_base
                else:
                    customer_totals[cust_id]["overdue_amount"] += sch_open_base
                    customer_totals[cust_id]["max_days_overdue"] = max(customer_totals[cust_id]["max_days_overdue"], days_over)
                    overdue_customers.add(cust_id)
        else:
            b_key, days_over = _aging_bucket_key(as_of, rec.due_date)
            aging[b_key] += open_base
            customer_totals[cust_id]["total_balance"] += open_base
            if b_key == "not_due":
                customer_totals[cust_id]["not_due_amount"] += open_base
            else:
                customer_totals[cust_id]["overdue_amount"] += open_base
                customer_totals[cust_id]["max_days_overdue"] = max(customer_totals[cust_id]["max_days_overdue"], days_over)
                overdue_customers.add(cust_id)

            items_detail.append({
                "receivable_id": str(rec.id),
                "document_number": rec.source_document_number or (rec.document.number if rec.document_id else rec.code),
                "party_name": rec.customer.name,
                "due_date": rec.due_date.isoformat() if rec.due_date else None,
                "days_overdue": days_over,
                "aging_bucket": b_key,
                "open_balance": _quantize_money(open_base),
            })

    # Customer advances (unallocated receipts as of as_of_date)
    receipt_qs = _filter_branches(
        Receipt.objects.filter(company=ctx.company, status="CONFIRMED", receipt_date__lte=as_of).prefetch_related("allocations"),
        "branch_id",
        ctx.effective_branch_ids,
    )
    customer_advance = ZERO
    for rcp in receipt_qs:
        rate = _to_decimal(rcp.exchange_rate or 1)
        alloc_up_to = sum(
            (
                _to_decimal(a.amount)
                for a in rcp.allocations.all()
                if a.reversed_at is None and (a.effective_date or rcp.receipt_date) <= as_of
            ),
            ZERO,
        )
        unalloc = max(_to_decimal(rcp.amount) - alloc_up_to, ZERO) * rate
        customer_advance += unalloc

    total_rec = sum(aging.values(), ZERO)
    not_due_total = aging["not_due"]
    overdue_total = total_rec - not_due_total

    # Check GL 131 reconciliation (EF-11)
    warnings: list[dict[str, Any]] = []
    gl_131_qs = _filter_branches(
        JournalLine.objects.filter(
            entry__company=ctx.company,
            entry__status="POSTED",
            entry__posting_date__lte=as_of,
            account__code__startswith="131",
        ),
        "entry__branch_id",
        ctx.effective_branch_ids,
    )
    if gl_131_qs.exists():
        agg = gl_131_qs.aggregate(d=Sum("debit"), c=Sum("credit"))
        gl_net = _to_decimal(agg["d"]) - _to_decimal(agg["c"])
        sub_net = total_rec - customer_advance
        if total_rec > ZERO and abs(gl_net - sub_net) > Decimal("1"):
            warnings.append({
                "code": "SUBLEDGER_GL_MISMATCH",
                "message": f"Sổ phụ phải thu ({_quantize_money(sub_net)}) lệch với Sổ cái TK 131 ({_quantize_money(gl_net)}).",
            })

    sorted_debtors = sorted(
        customer_totals.values(),
        key=lambda x: (x["total_balance"], x["overdue_amount"]),
        reverse=True,
    )[:top_n]
    top_debtors = [
        {
            "party_id": d["party_id"],
            "party_code": d["party_code"],
            "party_name": d["party_name"],
            "total_balance": _quantize_money(d["total_balance"]),
            "not_due_amount": _quantize_money(d["not_due_amount"]),
            "overdue_amount": _quantize_money(d["overdue_amount"]),
            "max_days_overdue": d["max_days_overdue"],
        }
        for d in sorted_debtors
    ]

    has_data = total_rec > ZERO or customer_advance > ZERO
    return {
        "metric_code": "DASH-07",
        "name": "Công nợ phải thu",
        "status": "OK" if has_data else "NO_DATA",
        "value": _quantize_money(total_rec),
        "currency": ctx.company.accounting_currency.code,
        "data": {
            "as_of_date": as_of.isoformat(),
            "ar_total_receivable": _quantize_money(total_rec),
            "ar_not_due_amount": _quantize_money(not_due_total),
            "ar_overdue_amount": _quantize_money(overdue_total),
            "ar_customer_advance_amount": _quantize_money(customer_advance),
            "overdue_customer_count": len(overdue_customers),
            "aging_buckets": {k: _quantize_money(v) for k, v in aging.items()},
            "top_debtors": top_debtors,
            "items": items_detail,
        },
        "warnings": warnings,
    }


# ==============================================================================
# DASH-08: Công nợ phải trả (Accounts Payable Summary & Aging)
# ==============================================================================

def compute_dash_08_payables(ctx: DashboardContext, top_n: int = 5) -> dict[str, Any]:
    from accounts_payable.models import Payable, Payment

    as_of = ctx.as_of_date
    if ctx.is_before_start_date:
        return {
            "metric_code": "DASH-08",
            "name": "Công nợ phải trả",
            "status": "NO_DATA",
            "value": _quantize_money(ZERO),
            "currency": ctx.company.accounting_currency.code,
            "data": {
                "as_of_date": as_of.isoformat(),
                "ap_total_payable": _quantize_money(ZERO),
                "ap_not_due_amount": _quantize_money(ZERO),
                "ap_overdue_amount": _quantize_money(ZERO),
                "ap_supplier_advance_amount": _quantize_money(ZERO),
                "overdue_supplier_count": 0,
                "aging_buckets": {
                    "not_due": _quantize_money(ZERO),
                    "overdue_1_30": _quantize_money(ZERO),
                    "overdue_31_60": _quantize_money(ZERO),
                    "overdue_61_90": _quantize_money(ZERO),
                    "overdue_over_90": _quantize_money(ZERO),
                },
                "top_creditors": [],
            },
            "warnings": [],
        }

    pay_qs = _filter_branches(
        Payable.objects.filter(company=ctx.company)
        .exclude(status__in=("REVERSED", "CANCELLED"))
        .select_related("supplier", "invoice", "goods_purchase", "purchase_cost", "document", "currency")
        .prefetch_related("allocations__payment", "nettings", "adjustments", "offset_payable_lines__voucher"),
        "branch_id",
        ctx.effective_branch_ids,
    )

    aging = {
        "not_due": ZERO,
        "overdue_1_30": ZERO,
        "overdue_31_60": ZERO,
        "overdue_61_90": ZERO,
        "overdue_over_90": ZERO,
    }
    supplier_totals: dict[str, dict[str, Any]] = {}
    overdue_suppliers: set[str] = set()
    items_detail: list[dict[str, Any]] = []

    for pay in pay_qs:
        eff_date = (
            (pay.invoice.posting_date or pay.invoice.invoice_date) if pay.invoice_id
            else (pay.goods_purchase.posting_date if pay.goods_purchase_id
                  else (pay.purchase_cost.posting_date if pay.purchase_cost_id
                        else (pay.document.posting_date if pay.document_id else None)))
        )
        if eff_date and eff_date > as_of:
            continue

        rate = _to_decimal(pay.exchange_rate or 1)
        orig = _to_decimal(pay.original_amount)

        # Historical reconstruction of paid_amount at as_of_date
        valid_allocs = [
            a for a in pay.allocations.all()
            if a.payment.status in ("POSTED", "CONFIRMED")
        ]
        if valid_allocs:
            alloc_all = sum((_to_decimal(a.amount) for a in valid_allocs), ZERO)
            alloc_up_to = sum((_to_decimal(a.amount) for a in valid_allocs if a.payment.payment_date <= as_of), ZERO)
            untracked_paid = max(_to_decimal(pay.paid_amount) - alloc_all, ZERO)
            paid_as_of = alloc_up_to + untracked_paid
        else:
            paid_as_of = _to_decimal(pay.paid_amount)

        # Historical reconstruction of netted_amount at as_of_date
        posted_nets = [n for n in pay.nettings.all() if n.status == "POSTED"]
        posted_offsets = [ol for ol in pay.offset_payable_lines.all() if ol.voucher.status == "POSTED"]
        if posted_nets or posted_offsets:
            net_all = sum((_to_decimal(n.amount) for n in posted_nets), ZERO) + sum((_to_decimal(ol.amount) for ol in posted_offsets), ZERO)
            net_up_to = (
                sum((_to_decimal(n.amount) for n in posted_nets if n.netting_date <= as_of), ZERO)
                + sum((_to_decimal(ol.amount) for ol in posted_offsets if ol.voucher.offset_date <= as_of), ZERO)
            )
            untracked_net = max(_to_decimal(pay.netted_amount) - net_all, ZERO)
            netted_as_of = net_up_to + untracked_net
        else:
            netted_as_of = _to_decimal(pay.netted_amount)

        # Historical reconstruction of adjustment_amount at as_of_date
        posted_adjs = [a for a in pay.adjustments.all() if a.status == "POSTED"]
        if posted_adjs:
            adj_up_to = sum((_to_decimal(a.amount) for a in posted_adjs if a.adjustment_date <= as_of), ZERO)
        else:
            adj_up_to = _to_decimal(pay.adjustment_amount)

        open_fc = max(orig + adj_up_to - paid_as_of - netted_as_of, ZERO)
        open_base = open_fc * rate
        if open_base <= ZERO:
            continue

        sup_id = str(pay.supplier_id)
        if sup_id not in supplier_totals:
            supplier_totals[sup_id] = {
                "party_id": sup_id,
                "party_code": pay.supplier.code,
                "party_name": pay.supplier.name,
                "total_balance": ZERO,
                "not_due_amount": ZERO,
                "overdue_amount": ZERO,
                "max_days_overdue": 0,
            }

        b_key, days_over = _aging_bucket_key(as_of, pay.due_date)
        aging[b_key] += open_base
        supplier_totals[sup_id]["total_balance"] += open_base
        if b_key == "not_due":
            supplier_totals[sup_id]["not_due_amount"] += open_base
        else:
            supplier_totals[sup_id]["overdue_amount"] += open_base
            supplier_totals[sup_id]["max_days_overdue"] = max(supplier_totals[sup_id]["max_days_overdue"], days_over)
            overdue_suppliers.add(sup_id)

        doc_num = (
            pay.invoice.invoice_number if pay.invoice_id
            else (pay.goods_purchase.number if pay.goods_purchase_id
                  else (pay.purchase_cost.number if pay.purchase_cost_id
                        else (pay.document.number if pay.document_id else str(pay.id)[:8])))
        )
        items_detail.append({
            "payable_id": str(pay.id),
            "document_number": doc_num,
            "party_name": pay.supplier.name,
            "due_date": pay.due_date.isoformat() if pay.due_date else None,
            "days_overdue": days_over,
            "aging_bucket": b_key,
            "open_balance": _quantize_money(open_base),
        })

    # Supplier advances (unallocated payments as of as_of_date)
    pmt_qs = _filter_branches(
        Payment.objects.filter(
            company=ctx.company,
            status__in=("POSTED", "CONFIRMED"),
            payment_date__lte=as_of,
        ).prefetch_related("allocations"),
        "branch_id",
        ctx.effective_branch_ids,
    )
    supplier_advance = ZERO
    for pmt in pmt_qs:
        rate = _to_decimal(pmt.exchange_rate or 1)
        alloc_up_to = sum((_to_decimal(a.amount) for a in pmt.allocations.all()), ZERO)
        unalloc = max(_to_decimal(pmt.amount) - alloc_up_to, ZERO) * rate
        supplier_advance += unalloc

    total_pay = sum(aging.values(), ZERO)
    not_due_total = aging["not_due"]
    overdue_total = total_pay - not_due_total

    warnings: list[dict[str, Any]] = []
    gl_331_qs = _filter_branches(
        JournalLine.objects.filter(
            entry__company=ctx.company,
            entry__status="POSTED",
            entry__posting_date__lte=as_of,
            account__code__startswith="331",
        ),
        "entry__branch_id",
        ctx.effective_branch_ids,
    )
    if gl_331_qs.exists():
        agg = gl_331_qs.aggregate(d=Sum("debit"), c=Sum("credit"))
        gl_net = _to_decimal(agg["c"]) - _to_decimal(agg["d"])
        sub_net = total_pay - supplier_advance
        if total_pay > ZERO and abs(gl_net - sub_net) > Decimal("1"):
            warnings.append({
                "code": "SUBLEDGER_GL_MISMATCH",
                "message": f"Sổ phụ phải trả ({_quantize_money(sub_net)}) lệch với Sổ cái TK 331 ({_quantize_money(gl_net)}).",
            })

    sorted_creditors = sorted(
        supplier_totals.values(),
        key=lambda x: (x["total_balance"], x["overdue_amount"]),
        reverse=True,
    )[:top_n]
    top_creditors = [
        {
            "party_id": c["party_id"],
            "party_code": c["party_code"],
            "party_name": c["party_name"],
            "total_balance": _quantize_money(c["total_balance"]),
            "not_due_amount": _quantize_money(c["not_due_amount"]),
            "overdue_amount": _quantize_money(c["overdue_amount"]),
            "max_days_overdue": c["max_days_overdue"],
        }
        for c in sorted_creditors
    ]

    has_data = total_pay > ZERO or supplier_advance > ZERO
    return {
        "metric_code": "DASH-08",
        "name": "Công nợ phải trả",
        "status": "OK" if has_data else "NO_DATA",
        "value": _quantize_money(total_pay),
        "currency": ctx.company.accounting_currency.code,
        "data": {
            "as_of_date": as_of.isoformat(),
            "ap_total_payable": _quantize_money(total_pay),
            "ap_not_due_amount": _quantize_money(not_due_total),
            "ap_overdue_amount": _quantize_money(overdue_total),
            "ap_supplier_advance_amount": _quantize_money(supplier_advance),
            "overdue_supplier_count": len(overdue_suppliers),
            "aging_buckets": {k: _quantize_money(v) for k, v in aging.items()},
            "top_creditors": top_creditors,
            "items": items_detail,
        },
        "warnings": warnings,
    }


# ==============================================================================
# DASH-09: Tổng quan tồn kho (Inventory Summary & Alerts)
# ==============================================================================

def compute_dash_09_inventory(ctx: DashboardContext, top_n: int = 5) -> dict[str, Any]:
    from inventory.models import InventoryPolicy, InventoryTransaction, InventoryTransactionLine, StockBalance, StockMovement, ValuationRun

    as_of = ctx.as_of_date
    if ctx.is_before_start_date:
        return {
            "metric_code": "DASH-09",
            "name": "Tổng quan tồn kho",
            "status": "NO_DATA",
            "value": _quantize_money(ZERO),
            "currency": ctx.company.accounting_currency.code,
            "data": {
                "as_of_date": as_of.isoformat(),
                "inventory_total_value": _quantize_money(ZERO),
                "inventory_total_quantity": _quantize_money(ZERO),
                "inventory_cost_status": "UPDATED",
                "active_item_count": 0,
                "below_minimum_stock_count": 0,
                "negative_stock_item_count": 0,
                "slow_moving_item_count": 0,
                "expired_or_near_expiry_lot_count": 0,
                "by_warehouse": [],
                "top_items": [],
                "below_minimum_items": [],
            },
            "warnings": [],
        }

    bal_qs = StockBalance.objects.filter(company=ctx.company).select_related(
        "warehouse", "item__base_uom", "location", "lot_serial"
    )
    if ctx.effective_branch_ids is not None:
        bal_qs = bal_qs.filter(
            Q(warehouse__branch_id__in=ctx.effective_branch_ids) | Q(warehouse__branch_id__isnull=True)
        )
    if ctx.allowed_warehouse_ids is not None:
        bal_qs = bal_qs.filter(warehouse_id__in=ctx.allowed_warehouse_ids)

    # Subtract movements after as_of_date if querying historical as_of_date
    future_movs = StockMovement.objects.filter(company=ctx.company, movement_date__gt=as_of)
    if ctx.effective_branch_ids is not None:
        future_movs = future_movs.filter(
            Q(warehouse__branch_id__in=ctx.effective_branch_ids) | Q(warehouse__branch_id__isnull=True)
        )
    if ctx.allowed_warehouse_ids is not None:
        future_movs = future_movs.filter(warehouse_id__in=ctx.allowed_warehouse_ids)

    future_deltas: dict[tuple[str, str], tuple[Decimal, Decimal]] = {}
    for fm in future_movs.values("warehouse_id", "item_id").annotate(dq=Sum("quantity_delta"), dv=Sum("value_delta")):
        key = (str(fm["warehouse_id"]), str(fm["item_id"]))
        future_deltas[key] = (_to_decimal(fm["dq"]), _to_decimal(fm["dv"]))

    wh_item_balances: dict[tuple[str, str], dict[str, Any]] = {}
    lot_expiry_alerts = 0

    for bal in bal_qs:
        key = (str(bal.warehouse_id), str(bal.item_id))
        if key not in wh_item_balances:
            wh_item_balances[key] = {
                "warehouse_id": str(bal.warehouse_id),
                "warehouse_code": bal.warehouse.code,
                "warehouse_name": bal.warehouse.name,
                "item_id": str(bal.item_id),
                "item_code": bal.item.code,
                "item_name": bal.item.name,
                "uom_id": str(bal.item.base_uom_id),
                "uom_code": bal.item.base_uom.code if bal.item.base_uom_id else "",
                "quantity": ZERO,
                "reserved_quantity": ZERO,
                "inventory_value": ZERO,
                "created_at": bal.item.created_at.date() if getattr(bal.item, "created_at", None) else as_of,
            }
        wh_item_balances[key]["quantity"] += _to_decimal(bal.quantity)
        wh_item_balances[key]["reserved_quantity"] += _to_decimal(bal.reserved_quantity)
        wh_item_balances[key]["inventory_value"] += _to_decimal(bal.inventory_value)

        if bal.lot_serial_id and bal.lot_serial.expiry_date and _to_decimal(bal.quantity) > ZERO:
            if bal.lot_serial.expiry_date <= (as_of + timedelta(days=30)):
                lot_expiry_alerts += 1

    for key, (dq, dv) in future_deltas.items():
        if key in wh_item_balances:
            wh_item_balances[key]["quantity"] -= dq
            wh_item_balances[key]["inventory_value"] -= dv

    total_value = ZERO
    total_qty = ZERO
    uom_ids: set[str] = set()
    active_items: set[str] = set()
    negative_items: set[str] = set()
    wh_summary: dict[str, dict[str, Any]] = {}
    item_summary: dict[str, dict[str, Any]] = {}

    for entry in wh_item_balances.values():
        q = entry["quantity"]
        v = entry["inventory_value"]
        if q == ZERO and v == ZERO:
            continue
        total_value += v
        total_qty += q
        uom_ids.add(entry["uom_id"])
        if q > ZERO:
            active_items.add(entry["item_id"])
        elif q < ZERO:
            negative_items.add(entry["item_id"])

        wid = entry["warehouse_id"]
        if wid not in wh_summary:
            wh_summary[wid] = {
                "warehouse_id": wid,
                "warehouse_code": entry["warehouse_code"],
                "warehouse_name": entry["warehouse_name"],
                "total_value": ZERO,
                "item_count": 0,
            }
        wh_summary[wid]["total_value"] += v
        wh_summary[wid]["item_count"] += 1

        iid = entry["item_id"]
        if iid not in item_summary:
            item_summary[iid] = {
                "item_id": iid,
                "item_code": entry["item_code"],
                "item_name": entry["item_name"],
                "uom_code": entry["uom_code"],
                "quantity": ZERO,
                "inventory_value": ZERO,
            }
        item_summary[iid]["quantity"] += q
        item_summary[iid]["inventory_value"] += v

    warnings: list[dict[str, Any]] = []
    # Multi-UOM check (TC-RPT-01-29 / EF-13)
    if len(uom_ids) > 1:
        qty_display = None
        warnings.append({
            "code": "MULTI_UOM_NOT_SUMMABLE",
            "message": "Hàng tồn kho có nhiều đơn vị tính cơ sở khác nhau; không cộng gộp tổng số lượng.",
        })
    else:
        qty_display = _quantize_money(total_qty)

    # Minimum stock policy check (TC-RPT-01-31)
    policies = InventoryPolicy.objects.filter(company=ctx.company, is_active=True, minimum_quantity__gt=0).select_related("warehouse", "item")
    if ctx.effective_branch_ids is not None:
        policies = policies.filter(
            Q(warehouse__branch_id__in=ctx.effective_branch_ids) | Q(warehouse__branch_id__isnull=True)
        )
    if ctx.allowed_warehouse_ids is not None:
        policies = policies.filter(warehouse_id__in=ctx.allowed_warehouse_ids)

    below_min_items: list[dict[str, Any]] = []
    for pol in policies:
        key = (str(pol.warehouse_id), str(pol.item_id))
        cur_q = wh_item_balances.get(key, {}).get("quantity", ZERO)
        min_q = _to_decimal(pol.minimum_quantity)
        if cur_q < min_q:
            below_min_items.append({
                "warehouse_id": str(pol.warehouse_id),
                "warehouse_code": pol.warehouse.code,
                "item_id": str(pol.item_id),
                "item_code": pol.item.code,
                "item_name": pol.item.name,
                "current_quantity": _quantize_money(cur_q),
                "minimum_quantity": _quantize_money(min_q),
                "shortfall_quantity": _quantize_money(min_q - cur_q),
            })

    # Slow-moving check
    slow_days = ctx.config.slow_moving_days if ctx.config else 90
    cutoff_date = as_of - timedelta(days=slow_days)
    recent_out_item_ids = set(
        str(x)
        for x in StockMovement.objects.filter(
            company=ctx.company,
            movement_date__range=(cutoff_date, as_of),
            quantity_delta__lt=0,
        ).values_list("item_id", flat=True)
    )
    earliest_mov = StockMovement.objects.filter(company=ctx.company).aggregate(m=Max("movement_date"))["m"]
    slow_moving_count = 0
    if earliest_mov:
        for iid, isum in item_summary.items():
            if isum["quantity"] > ZERO and iid not in recent_out_item_ids:
                has_old_mov = StockMovement.objects.filter(
                    company=ctx.company, item_id=iid, movement_date__lt=cutoff_date
                ).exists()
                if has_old_mov:
                    slow_moving_count += 1

    # Valuation / Costing status (TC-RPT-01-30 / EF-12)
    val_runs = ValuationRun.objects.filter(company=ctx.company, valuation_date__lte=as_of).order_by("-valuation_date", "-created_at")
    latest_val = val_runs.first()
    uncosted_out_exists = InventoryTransactionLine.objects.filter(
        transaction__company=ctx.company,
        transaction__status="POSTED",
        transaction__transaction_date__range=(ctx.from_date, as_of),
        transaction__transaction_type__in=("ISSUE", "ADJUSTMENT_OUT"),
        unit_cost=0,
        line_value=0,
    ).exists()

    if latest_val and latest_val.status == "FAILED":
        cost_status = "FAILED"
        warnings.append({
            "code": "COSTING_FAILED",
            "message": "Lần tính giá xuất kho gần nhất bị lỗi; giá trị tồn kho có thể chưa chính xác.",
        })
    elif uncosted_out_exists:
        cost_status = "PENDING"
        warnings.append({
            "code": "COSTING_NOT_COMPLETED",
            "message": "Có phiếu xuất kho trong kỳ chưa được tính giá xuất kho.",
        })
    else:
        cost_status = "UPDATED"

    top_items_sorted = sorted(item_summary.values(), key=lambda x: x["inventory_value"], reverse=True)[:top_n]
    by_wh_sorted = sorted(wh_summary.values(), key=lambda x: x["total_value"], reverse=True)

    has_data = bool(wh_item_balances) or bool(below_min_items)
    return {
        "metric_code": "DASH-09",
        "name": "Tổng quan tồn kho",
        "status": "OK" if has_data else "NO_DATA",
        "value": _quantize_money(total_value),
        "currency": ctx.company.accounting_currency.code,
        "data": {
            "as_of_date": as_of.isoformat(),
            "inventory_total_value": _quantize_money(total_value),
            "inventory_total_quantity": qty_display,
            "inventory_cost_status": cost_status,
            "active_item_count": len(active_items),
            "below_minimum_stock_count": len(below_min_items),
            "negative_stock_item_count": len(negative_items),
            "slow_moving_item_count": slow_moving_count,
            "expired_or_near_expiry_lot_count": lot_expiry_alerts,
            "by_warehouse": [
                {
                    "warehouse_id": w["warehouse_id"],
                    "warehouse_code": w["warehouse_code"],
                    "warehouse_name": w["warehouse_name"],
                    "total_value": _quantize_money(w["total_value"]),
                    "item_count": w["item_count"],
                }
                for w in by_wh_sorted
            ],
            "top_items": [
                {
                    "item_id": i["item_id"],
                    "item_code": i["item_code"],
                    "item_name": i["item_name"],
                    "uom_code": i["uom_code"],
                    "quantity": _quantize_money(i["quantity"]),
                    "inventory_value": _quantize_money(i["inventory_value"]),
                }
                for i in top_items_sorted
            ],
            "below_minimum_items": below_min_items[:top_n],
        },
        "warnings": warnings,
    }


# ==============================================================================
# DASH-10: Tổng quan nghĩa vụ thuế (Tax Obligations & VAT Summary)
# ==============================================================================

def compute_dash_10_tax(ctx: DashboardContext) -> dict[str, Any]:
    from accounts_payable.models import SupplierInvoice
    from bank_management.models import BankTransaction
    from cash_management.models import CashTransaction
    from purchases.models import GoodsPurchase, PurchaseCost, PurchaseDiscount, PurchaseReturn
    from sales.models import GoodsSale, SalesAllowance, SalesReturn, ServiceSale
    from tax_management.models import TaxInvoice, TaxObligation

    as_of = ctx.as_of_date
    if ctx.is_before_start_date:
        return {
            "metric_code": "DASH-10",
            "name": "Tổng quan nghĩa vụ thuế",
            "status": "NO_DATA",
            "value": _quantize_money(ZERO),
            "currency": ctx.company.accounting_currency.code,
            "data": {
                "as_of_date": as_of.isoformat(),
                "vat_input_deductible_amount": _quantize_money(ZERO),
                "vat_output_amount": _quantize_money(ZERO),
                "net_vat_payable": _quantize_money(ZERO),
                "net_vat_deductible_carryforward": _quantize_money(ZERO),
                "tax_payable_total": _quantize_money(ZERO),
                "tax_paid_in_period": _quantize_money(ZERO),
                "overdue_obligation_count": 0,
                "due_soon_obligation_count": 0,
                "by_tax_type": {},
                "obligations": [],
            },
            "warnings": [],
        }

    warnings: list[dict[str, Any]] = []

    # 1. VAT Input (133 / TaxInvoice INPUT / Purchases) & VAT Output (3331 / TaxInvoice OUTPUT / Sales)
    tax_inv_qs = _filter_branches(
        TaxInvoice.objects.filter(
            company=ctx.company,
            invoice_date__range=(ctx.from_date, ctx.to_date),
        ).exclude(status__in=("DRAFT", "CANCELLED", "REJECTED", "REPLACED")),
        "branch_id",
        ctx.effective_branch_ids,
    )

    vat_in = ZERO
    vat_out = ZERO
    counted_tax_inv_ids: set[Any] = set()
    linked_je_ids: set[Any] = set()

    for tinv in tax_inv_qs:
        rate = _to_decimal(tinv.exchange_rate or 1)
        t_amt = _to_decimal(tinv.tax_amount) * rate
        if tinv.invoice_type == "ADJUSTMENT" and tinv.adjustment_effect == "DECREASE":
            t_amt = -t_amt
        if tinv.direction == "INPUT":
            if tinv.tax_eligible or tinv.status in ("RECEIVED", "VALIDATED", "ISSUED"):
                vat_in += t_amt
                counted_tax_inv_ids.add(tinv.id)
        elif tinv.direction == "OUTPUT":
            if tinv.status == "ISSUED":
                vat_out += t_amt
                counted_tax_inv_ids.add(tinv.id)

    # Also include POSTED Sales/Purchases VAT not already represented in TaxInvoice
    for gs in _filter_branches(
        GoodsSale.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(ctx.from_date, ctx.to_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ):
        if gs.journal_entry_id:
            linked_je_ids.add(gs.journal_entry_id)
        if not gs.tax_invoice_id or gs.tax_invoice_id not in counted_tax_inv_ids:
            vat_out += _to_decimal(gs.tax_amount) * _to_decimal(gs.exchange_rate or 1)

    for ss in _filter_branches(
        ServiceSale.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(ctx.from_date, ctx.to_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ):
        if ss.journal_entry_id:
            linked_je_ids.add(ss.journal_entry_id)
        if not ss.tax_invoice_id or ss.tax_invoice_id not in counted_tax_inv_ids:
            vat_out += _to_decimal(ss.tax_amount) * _to_decimal(ss.exchange_rate or 1)

    for sr in _filter_branches(
        SalesReturn.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(ctx.from_date, ctx.to_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ):
        if sr.journal_entry_id:
            linked_je_ids.add(sr.journal_entry_id)
        if not sr.tax_invoice_id or sr.tax_invoice_id not in counted_tax_inv_ids:
            vat_out -= _to_decimal(sr.tax_amount) * _to_decimal(sr.exchange_rate or 1)

    for sa in _filter_branches(
        SalesAllowance.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(ctx.from_date, ctx.to_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ):
        if sa.journal_entry_id:
            linked_je_ids.add(sa.journal_entry_id)
        if not sa.tax_invoice_id or sa.tax_invoice_id not in counted_tax_inv_ids:
            vat_out -= _to_decimal(sa.tax_amount) * _to_decimal(sa.exchange_rate or 1)

    for gp in _filter_branches(
        GoodsPurchase.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(ctx.from_date, ctx.to_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ):
        if gp.journal_entry_id:
            linked_je_ids.add(gp.journal_entry_id)
        vat_in += _to_decimal(gp.tax_amount)

    for pc in _filter_branches(
        PurchaseCost.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(ctx.from_date, ctx.to_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ):
        if pc.journal_entry_id:
            linked_je_ids.add(pc.journal_entry_id)
        vat_in += _to_decimal(pc.tax_amount)

    for pr in _filter_branches(
        PurchaseReturn.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(ctx.from_date, ctx.to_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ):
        if pr.journal_entry_id:
            linked_je_ids.add(pr.journal_entry_id)
        vat_in -= _to_decimal(pr.tax_amount)

    for pd in _filter_branches(
        PurchaseDiscount.objects.filter(company=ctx.company, status="POSTED", posting_date__range=(ctx.from_date, ctx.to_date)),
        "branch_id",
        ctx.effective_branch_ids,
    ):
        if pd.journal_entry_id:
            linked_je_ids.add(pd.journal_entry_id)
        vat_in -= _to_decimal(pd.tax_amount)

    # Also check standalone GL 133 and 3331 lines in period
    if vat_in == ZERO and vat_out == ZERO:
        gl_vat_qs = _filter_branches(
            JournalLine.objects.filter(
                entry__company=ctx.company,
                entry__status="POSTED",
                entry__posting_date__range=(ctx.from_date, ctx.to_date),
            ).exclude(entry__entry_type="OPENING").exclude(entry_id__in=linked_je_ids),
            "entry__branch_id",
            ctx.effective_branch_ids,
        )
        agg_133 = gl_vat_qs.filter(account__code__startswith="133").aggregate(d=Sum("debit"), c=Sum("credit"))
        agg_3331 = gl_vat_qs.filter(account__code__startswith="3331").aggregate(d=Sum("debit"), c=Sum("credit"))
        vat_in += max(_to_decimal(agg_133["d"]) - _to_decimal(agg_133["c"]), ZERO)
        vat_out += max(_to_decimal(agg_3331["c"]) - _to_decimal(agg_3331["d"]), ZERO)

    net_vat_payable = max(vat_out - vat_in, ZERO)
    net_vat_deductible = max(vat_in - vat_out, ZERO)

    # 2. Tax Obligations & Verified Payments (TC-RPT-01-33, TC-RPT-01-34, EF-14)
    obligations_qs = TaxObligation.objects.filter(company=ctx.company).select_related("period", "filing").prefetch_related("payment_links")
    by_tax_type: dict[str, dict[str, Decimal]] = {}
    obligations_list: list[dict[str, Any]] = []
    tax_paid_in_period = ZERO
    total_obligation_outstanding = ZERO
    overdue_count = 0
    due_soon_count = 0

    for ob in obligations_qs:
        assessed = _to_decimal(ob.assessed_amount) + _to_decimal(ob.adjustment_amount)
        links = list(ob.payment_links.all())
        if links:
            verified_paid = ZERO
            for lk in links:
                if lk.payment_date > as_of:
                    continue
                is_valid_tx = False
                if lk.source_module == "CASH":
                    tx = CashTransaction.objects.filter(id=lk.transaction_id, company=ctx.company).first()
                    if tx and tx.status == "POSTED" and tx.transaction_date <= as_of:
                        is_valid_tx = True
                elif lk.source_module == "BANK":
                    tx = BankTransaction.objects.filter(id=lk.transaction_id, company=ctx.company).first()
                    if tx and tx.status == "POSTED" and tx.transaction_date <= as_of:
                        is_valid_tx = True
                if is_valid_tx:
                    verified_paid += _to_decimal(lk.amount)
                    if ctx.from_date <= lk.payment_date <= ctx.to_date:
                        tax_paid_in_period += _to_decimal(lk.amount)
                else:
                    warnings.append({
                        "code": "UNPOSTED_TAX_PAYMENT_IGNORED",
                        "message": f"Khoản nộp thuế tham chiếu {lk.reference or lk.transaction_id} chưa ghi sổ hoặc đã đảo; không trừ vào nghĩa vụ thuế.",
                    })
        else:
            verified_paid = _to_decimal(ob.paid_amount)
            if ctx.from_date <= ob.updated_at.date() <= ctx.to_date and verified_paid > ZERO:
                tax_paid_in_period += verified_paid

        outstanding = max(assessed - verified_paid, ZERO)
        total_obligation_outstanding += outstanding

        ttype = ob.tax_type or "OTHER"
        if ttype not in by_tax_type:
            by_tax_type[ttype] = {"assessed": ZERO, "paid": ZERO, "outstanding": ZERO}
        by_tax_type[ttype]["assessed"] += assessed
        by_tax_type[ttype]["paid"] += verified_paid
        by_tax_type[ttype]["outstanding"] += outstanding

        days_rem = (ob.due_date - as_of).days if ob.due_date else 999
        if outstanding <= ZERO:
            dl_status = "PAID"
        elif days_rem < 0:
            dl_status = "OVERDUE"
            overdue_count += 1
        elif days_rem <= 7:
            dl_status = "DUE_SOON"
            due_soon_count += 1
        else:
            dl_status = "UPCOMING"

        obligations_list.append({
            "obligation_id": str(ob.id),
            "period_code": ob.period.code if ob.period_id else "",
            "tax_type": ttype,
            "due_date": ob.due_date.isoformat() if ob.due_date else None,
            "days_remaining": days_rem,
            "deadline_status": dl_status,
            "assessed_amount": _quantize_money(assessed),
            "paid_amount": _quantize_money(verified_paid),
            "outstanding_amount": _quantize_money(outstanding),
        })

    # If no TaxObligation rows exist yet, total payable falls back to net_vat_payable + GL 333 credit balance
    if not obligations_list:
        total_payable = net_vat_payable
    else:
        # Include net_vat_payable if VAT obligation wasn't separately created yet
        has_vat_ob = "VAT" in by_tax_type
        total_payable = total_obligation_outstanding + (ZERO if has_vat_ob else net_vat_payable)

    has_data = bool(obligations_list) or vat_in > ZERO or vat_out > ZERO or total_payable > ZERO
    return {
        "metric_code": "DASH-10",
        "name": "Tổng quan nghĩa vụ thuế",
        "status": "OK" if has_data else "NO_DATA",
        "value": _quantize_money(total_payable),
        "currency": ctx.company.accounting_currency.code,
        "data": {
            "as_of_date": as_of.isoformat(),
            "vat_input_deductible_amount": _quantize_money(vat_in),
            "vat_output_amount": _quantize_money(vat_out),
            "net_vat_payable": _quantize_money(net_vat_payable),
            "net_vat_deductible_carryforward": _quantize_money(net_vat_deductible),
            "tax_payable_total": _quantize_money(total_payable),
            "tax_paid_in_period": _quantize_money(tax_paid_in_period),
            "overdue_obligation_count": overdue_count,
            "due_soon_obligation_count": due_soon_count,
            "by_tax_type": {
                k: {
                    "assessed": _quantize_money(v["assessed"]),
                    "paid": _quantize_money(v["paid"]),
                    "outstanding": _quantize_money(v["outstanding"]),
                }
                for k, v in by_tax_type.items()
            },
            "obligations": obligations_list,
        },
        "warnings": warnings,
    }


# ==============================================================================
# DASH-12: Danh sách chứng từ gần đây (Recent Documents)
# ==============================================================================

MODULE_VIEW_PERMISSIONS = {
    "GL": {"GL.JOURNAL.VIEW", "RPT.LEDGER.VIEW", "RPT.FINANCIAL.VIEW"},
    "SAL": {"SAL.ORDER.VIEW", "RPT.COMMERCE.VIEW"},
    "PUR": {"PUR.ORDER.VIEW", "RPT.COMMERCE.VIEW"},
    "AR": {"AR.RECEIVABLE.VIEW", "RPT.DEBT.VIEW"},
    "AP": {"AP.PAYABLE.VIEW", "RPT.DEBT.VIEW"},
    "CASH": {"CASH.TRANSACTION.VIEW", "RPT.MONEY.VIEW"},
    "BANK": {"BANK.TRANSACTION.VIEW", "RPT.MONEY.VIEW"},
    "INV": {"INV.BALANCE.VIEW", "RPT.INVENTORY.VIEW"},
    "TAX": {"TAX.INVOICE.VIEW", "RPT.TAX.VIEW"},
}


def compute_dash_12_recent_documents(
    ctx: DashboardContext,
    limit: int | None = None,
    sort_by: str | None = None,
) -> dict[str, Any]:
    from accounts_payable.models import PayableDocument, SupplierInvoice
    from accounts_receivable.models import CustomerReceiptVoucher, ReceivableDocument
    from bank_management.models import BankTransaction
    from cash_management.models import CashTransaction
    from inventory.models import InventoryTransaction
    from purchases.models import GoodsPurchase, PurchaseOrder
    from sales.models import GoodsSale, SalesOrder, ServiceSale
    from tax_management.models import TaxInvoice

    max_items = min(limit or (ctx.config.recent_documents_limit if ctx.config else 5), 50)
    sort_field = (sort_by or (ctx.config.recent_documents_sort_by if ctx.config else "created_at")).lower()
    if sort_field not in {"created_at", "posted_at", "document_date"}:
        sort_field = "created_at"

    perm_codes = _user_permission_codes(ctx.iam_account, ctx.company) if not ctx.user.is_superuser else set()
    non_dash_perms = perm_codes - {"RPT.DASHBOARD.VIEW", "RPT.DASHBOARD.REFRESH", "RPT.DASHBOARD.CONFIG", "RPT.CENTER.VIEW", "VIEW_DASHBOARD"}
    enforce_module_masking = (not ctx.user.is_superuser) and bool(non_dash_perms)

    def _can_view_module(mod: str) -> bool:
        if ctx.user.is_superuser:
            return True
        now = timezone.now()
        mod_perms = MODULE_VIEW_PERMISSIONS.get(mod, set())
        if UserPermissionOverride.objects.filter(
            company_membership__user=ctx.iam_account,
            company_membership__company=ctx.company,
            permission__code__in=mod_perms,
            effect="DENY",
            revoked_at__isnull=True,
            valid_from__lte=now,
        ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).exists():
            return False
        if enforce_module_masking:
            return bool(perm_codes & mod_perms)
        return True

    sources = [
        ("GL", "JOURNAL_ENTRY", "Chứng từ nghiệp vụ khác", JournalEntry, "branch_id", "number", "total_debit", "posting_date", "description"),
        ("SAL", "GOODS_SALE", "Bán hàng hóa", GoodsSale, "branch_id", "number", "total_amount", "posting_date", "description"),
        ("SAL", "SERVICE_SALE", "Bán dịch vụ", ServiceSale, "branch_id", "number", "total_amount", "posting_date", "description"),
        ("SAL", "SALES_ORDER", "Đơn đặt hàng bán", SalesOrder, "branch_id", "number", "total_amount", "document_date", "notes"),
        ("PUR", "GOODS_PURCHASE", "Mua hàng hóa", GoodsPurchase, "branch_id", "number", "total_amount", "posting_date", "notes"),
        ("PUR", "PURCHASE_ORDER", "Đơn mua hàng", PurchaseOrder, "branch_id", "number", "total_amount", "document_date", "notes"),
        ("AP", "SUPPLIER_INVOICE", "Hóa đơn mua vào", SupplierInvoice, "branch_id", "invoice_number", "total_amount", "invoice_date", "notes"),
        ("AP", "PAYABLE_DOCUMENT", "Chứng từ công nợ phải trả", PayableDocument, "branch_id", "number", "total_amount", "posting_date", "description"),
        ("AR", "RECEIVABLE_DOCUMENT", "Chứng từ công nợ phải thu", ReceivableDocument, "branch_id", "number", "amount", "posting_date", "description"),
        ("AR", "CUSTOMER_RECEIPT", "Thu tiền khách hàng", CustomerReceiptVoucher, "branch_id", "number", "amount", "posting_date", "description"),
        ("CASH", "CASH_TRANSACTION", "Phiếu thu/chi tiền mặt", CashTransaction, "fund__branch_id", "number", "base_amount", "transaction_date", "description"),
        ("BANK", "BANK_TRANSACTION", "Thu/chi tiền gửi", BankTransaction, None, "number", "base_amount", "transaction_date", "description"),
        ("INV", "INVENTORY_TRANSACTION", "Phiếu nhập/xuất kho", InventoryTransaction, "branch_id", "number", "total_value", "transaction_date", "reason"),
        ("TAX", "TAX_INVOICE", "Hóa đơn thuế", TaxInvoice, "branch_id", "invoice_number", "total_amount", "invoice_date", "seller_name"),
    ]

    collected: list[dict[str, Any]] = []
    for mod, dtype, label, model_cls, branch_field, num_field, amt_field, date_field, desc_field in sources:
        qs = model_cls.objects.filter(company=ctx.company)
        if branch_field:
            qs = _filter_branches(qs, branch_field, ctx.effective_branch_ids)
        elif mod == "BANK" and ctx.effective_branch_ids is not None:
            qs = qs.filter(
                Q(account__account__branch_id__in=ctx.effective_branch_ids) | Q(account__account__branch_id__isnull=True)
            )
        # Filter within period or up to to_date
        qs = qs.filter(**{f"{date_field}__range": (ctx.from_date, ctx.to_date)})
        qs = qs.order_by(f"-{date_field}", "-created_at")[: max_items * 2]

        can_view = _can_view_module(mod)
        for doc in qs:
            doc_date = getattr(doc, date_field, None)
            created_at = getattr(doc, "created_at", None)
            posted_at = getattr(doc, "posted_at", None) or created_at
            raw_amt = getattr(doc, amt_field, ZERO)
            desc = getattr(doc, desc_field, "") or label

            if sort_field == "posted_at":
                sort_ts = posted_at.timestamp() if posted_at else 0.0
            elif sort_field == "document_date":
                sort_ts = datetime.combine(doc_date, datetime.min.time()).timestamp() if doc_date else 0.0
            else:
                sort_ts = created_at.timestamp() if created_at else 0.0

            collected.append({
                "module": mod,
                "document_type": dtype,
                "document_type_label": label,
                "document_id": str(doc.id),
                "document_number": getattr(doc, num_field, str(doc.id)[:8]),
                "document_date": doc_date.isoformat() if doc_date else None,
                "created_at": created_at.isoformat() if created_at else None,
                "posted_at": posted_at.isoformat() if posted_at else None,
                "description": str(desc)[:255],
                "amount": _quantize_money(raw_amt) if can_view else None,
                "amount_masked": not can_view,
                "can_open_detail": can_view,
                "status": getattr(doc, "status", "POSTED"),
                "_sort_ts": sort_ts,
            })

    collected.sort(key=lambda x: x["_sort_ts"], reverse=True)
    items = [{k: v for k, v in row.items() if k != "_sort_ts"} for row in collected[:max_items]]

    return {
        "metric_code": "DASH-12",
        "name": "Danh sách chứng từ gần đây",
        "status": "OK" if items else "NO_DATA",
        "value": len(items),
        "data": {
            "sort_by": sort_field,
            "limit": max_items,
            "total_found": len(collected),
            "items": items,
        },
        "warnings": [],
    }


# ==============================================================================
# Cache Management, Overview, Config & Drill-down Services
# ==============================================================================

def invalidate_dashboard_cache(company: Company, widget_codes: list[str] | None = None) -> int:
    qs = DashboardCacheEntry.objects.filter(company=company, is_stale=False)
    if widget_codes:
        qs = qs.filter(widget_code__in=widget_codes)
    return qs.update(is_stale=True)


def _latest_company_activity_ts(company: Company) -> datetime | None:
    from accounts_payable.models import Payable
    from accounts_receivable.models import Receivable
    from approval_workflows.models import ApprovalTask
    from bank_management.models import BankTransaction
    from cash_management.models import CashTransaction
    from inventory.models import StockBalance
    from purchases.models import GoodsPurchase
    from sales.models import GoodsSale, ServiceSale
    from tax_management.models import TaxObligation

    candidates: list[datetime] = []
    for qs, field_name in (
        (JournalEntry.objects.filter(company=company), "updated_at"),
        (GoodsSale.objects.filter(company=company), "updated_at"),
        (ServiceSale.objects.filter(company=company), "updated_at"),
        (GoodsPurchase.objects.filter(company=company), "updated_at"),
        (CashTransaction.objects.filter(company=company), "updated_at"),
        (BankTransaction.objects.filter(company=company), "updated_at"),
        (Receivable.objects.filter(company=company), "updated_at"),
        (Payable.objects.filter(company=company), "updated_at"),
        (StockBalance.objects.filter(company=company), "updated_at"),
        (TaxObligation.objects.filter(company=company), "updated_at"),
        (ApprovalTask.objects.filter(request__company=company), "created_at"),
    ):
        val = qs.aggregate(m=Max(field_name))["m"]
        if val:
            candidates.append(val)
    return max(candidates) if candidates else None


def _build_cache_key(ctx: DashboardContext, widget_code: str) -> tuple[str, str, str]:
    period_key = f"{ctx.period_type}:{ctx.from_date.isoformat()}:{ctx.to_date.isoformat()}:{ctx.as_of_date.isoformat()}:{ctx.comparison_mode}:{ctx.cash_flow_scope}"
    perm_sig = sorted(
        code for code in WIDGET_PERMISSION_ALIASES
        if is_widget_permitted(ctx, code)
    )
    scope_raw = json.dumps({
        "user": str(ctx.user.id) if not ctx.user.is_superuser else "SUPERUSER",
        "branches": ctx.effective_branch_ids if ctx.effective_branch_ids is not None else "ALL",
        "warehouses": ctx.allowed_warehouse_ids if ctx.allowed_warehouse_ids is not None else "ALL",
        "banks": ctx.allowed_bank_account_ids if ctx.allowed_bank_account_ids is not None else "ALL",
        "widgets": perm_sig,
    }, sort_keys=True)
    scope_hash = hashlib.sha256(scope_raw.encode("utf-8")).hexdigest()[:32]
    full_hash = hashlib.sha256(f"{ctx.company.id}:{widget_code}:{period_key}:{scope_hash}".encode("utf-8")).hexdigest()
    cache_key = f"RPT_DASH_{widget_code}_{full_hash[:40]}"
    return cache_key, period_key, scope_hash


def get_dashboard_config_payload(ctx: DashboardContext) -> dict[str, Any]:
    periods = list(
        AccountingPeriod.objects.filter(company=ctx.company)
        .order_by("-fiscal_year", "-period_number")
        .values("id", "code", "fiscal_year", "period_number", "start_date", "end_date", "status")
    )
    branches_qs = Branch.objects.filter(company=ctx.company).order_by("code")
    if ctx.effective_branch_ids is not None and not ctx.requested_branch_ids:
        branches_qs = branches_qs.filter(id__in=ctx.effective_branch_ids)
    branches = [
        {"id": str(b.id), "code": b.code, "name": b.name}
        for b in branches_qs
    ]

    catalog_items = list(DashboardMetricCatalog.objects.filter(is_active=True).order_by("sequence", "metric_code"))
    widgets_meta = []
    for item in catalog_items:
        permitted = is_widget_permitted(ctx, item.metric_code)
        widgets_meta.append({
            "metric_code": item.metric_code,
            "name": item.name,
            "group": item.group,
            "version": item.version,
            "description": item.description,
            "source_modules": item.source_modules,
            "is_to_be": item.is_to_be,
            "sequence": item.sequence,
            "has_permission": permitted,
            "drilldown": build_drilldown_meta(ctx, item.metric_code) if permitted else None,
        })

    return {
        "company": {
            "id": str(ctx.company.id),
            "code": ctx.company.code,
            "name": ctx.company.name,
            "currency": ctx.company.accounting_currency.code,
        },
        "default_filters": {
            "period_type": ctx.period_type,
            "fiscal_period_id": str(ctx.fiscal_period.id) if ctx.fiscal_period else None,
            "from_date": ctx.from_date.isoformat(),
            "to_date": ctx.to_date.isoformat(),
            "as_of_date": ctx.as_of_date.isoformat(),
            "comparison_mode": ctx.comparison_mode,
            "cash_flow_scope": ctx.cash_flow_scope,
            "branch_ids": ctx.effective_branch_ids if ctx.effective_branch_ids is not None else "ALL",
        },
        "available_periods": [
            {
                "id": str(p["id"]),
                "code": p["code"],
                "fiscal_year": p["fiscal_year"],
                "period_number": p["period_number"],
                "start_date": p["start_date"].isoformat(),
                "end_date": p["end_date"].isoformat(),
                "status": p["status"],
            }
            for p in periods
        ],
        "available_branches": branches,
        "widgets": widgets_meta,
        "warnings": ctx.warnings,
    }


def get_dashboard_overview_payload(ctx: DashboardContext) -> dict[str, Any]:
    cache_key, period_key, scope_hash = _build_cache_key(ctx, "OVERVIEW")
    now = timezone.now()
    latest_activity = _latest_company_activity_ts(ctx.company)

    if ctx.refresh_mode == "CACHE_FIRST" and not ctx.fail_widgets:
        cached = DashboardCacheEntry.objects.filter(
            company=ctx.company,
            cache_key=cache_key,
            is_stale=False,
            expires_at__gt=now,
        ).first()
        if cached:
            if latest_activity is None or cached.data_as_of >= latest_activity:
                payload = dict(cached.payload)
                payload["cache_hit"] = True
                payload["refresh_mode"] = ctx.refresh_mode
                payload["data_as_of"] = cached.data_as_of.isoformat()
                return payload
            else:
                cached.is_stale = True
                cached.save(update_fields=["is_stale"])

    widget_calculators: list[tuple[str, Callable[[], dict[str, Any]]]] = [
        ("DASH-01", lambda: compute_dash_01_revenue(ctx)),
        ("DASH-02", lambda: compute_dash_02_purchase(ctx)),
        ("DASH-03", lambda: compute_dash_03_cash_collected(ctx)),
        ("DASH-04", lambda: compute_dash_04_pending_documents(ctx)),
        ("DASH-05", lambda: compute_dash_05_cash_flow(ctx)),
        ("DASH-06", lambda: compute_dash_06_profitability(ctx)),
        ("DASH-07", lambda: compute_dash_07_receivables(ctx)),
        ("DASH-08", lambda: compute_dash_08_payables(ctx)),
        ("DASH-09", lambda: compute_dash_09_inventory(ctx)),
        ("DASH-10", lambda: compute_dash_10_tax(ctx)),
        ("DASH-11", lambda: compute_dash_11_tasks(ctx)),
        ("DASH-12", lambda: compute_dash_12_recent_documents(ctx)),
    ]

    widgets: dict[str, dict[str, Any]] = {}
    all_warnings = list(ctx.warnings)
    has_error = False
    has_ok_data = False

    for code, calc in widget_calculators:
        w_res = execute_widget_safely(ctx, code, calc)
        widgets[code] = w_res
        if w_res["status"] == "ERROR":
            has_error = True
        elif w_res["status"] == "OK":
            has_ok_data = True
        for w in w_res.get("warnings") or []:
            all_warnings.append({"metric_code": code, **w})

    overall_status = "PARTIAL_ERROR" if has_error else ("OK" if has_ok_data else "NO_DATA")
    ttl_seconds = ctx.config.cache_ttl_seconds if ctx.config else 300
    data_as_of = now

    payload = {
        "company_id": str(ctx.company.id),
        "company_name": ctx.company.name,
        "currency": ctx.company.accounting_currency.code,
        "status": overall_status,
        "cache_hit": False,
        "refresh_mode": ctx.refresh_mode,
        "data_as_of": data_as_of.isoformat(),
        "filters": {
            "period_type": ctx.period_type,
            "fiscal_period_id": str(ctx.fiscal_period.id) if ctx.fiscal_period else None,
            "fiscal_period_code": ctx.fiscal_period.code if ctx.fiscal_period else None,
            "from_date": ctx.from_date.isoformat(),
            "to_date": ctx.to_date.isoformat(),
            "as_of_date": ctx.as_of_date.isoformat(),
            "comparison_mode": ctx.comparison_mode,
            "comparison_from_date": ctx.comparison_from_date.isoformat() if ctx.comparison_from_date else None,
            "comparison_to_date": ctx.comparison_to_date.isoformat() if ctx.comparison_to_date else None,
            "cash_flow_scope": ctx.cash_flow_scope,
            "branch_ids": ctx.effective_branch_ids if ctx.effective_branch_ids is not None else "ALL",
        },
        "kpis": {
            "DASH-01": widgets["DASH-01"],
            "DASH-02": widgets["DASH-02"],
            "DASH-03": widgets["DASH-03"],
            "DASH-04": widgets["DASH-04"],
        },
        "widgets": widgets,
        "warnings": all_warnings,
    }

    if not has_error:
        DashboardCacheEntry.objects.update_or_create(
            cache_key=cache_key,
            defaults={
                "company": ctx.company,
                "widget_code": "OVERVIEW",
                "period_key": period_key,
                "scope_hash": scope_hash,
                "metric_version": 1,
                "payload": payload,
                "data_as_of": data_as_of,
                "expires_at": data_as_of + timedelta(seconds=ttl_seconds),
                "is_stale": False,
            },
        )

    if ctx.refresh_mode == "FORCE_REFRESH" and ctx.iam_account:
        try:
            record_audit(
                company=ctx.company,
                actor_user=ctx.iam_account,
                module_code="RPT",
                action_code="REFRESH_DASHBOARD",
                entity=ctx.company,
                after={"period_key": period_key, "status": overall_status},
                request=ctx.request,
            )
        except Exception:
            pass

    return payload


def get_metric_drilldown_details(ctx: DashboardContext, metric_code: str) -> dict[str, Any]:
    code = metric_code.upper().strip()
    catalog = DashboardMetricCatalog.objects.filter(metric_code=code, is_active=True).first()
    if not catalog:
        raise ValidationError({"metric_code": f"Chỉ tiêu Dashboard '{code}' không tồn tại.", "code": "INVALID_METRIC_CODE"})

    if not is_widget_permitted(ctx, code):
        raise PermissionDenied({"detail": f"Bạn không có quyền xem chỉ tiêu {code}.", "code": "WIDGET_PERMISSION_DENIED"})

    drill_meta = build_drilldown_meta(ctx, code)
    if not drill_meta["can_drilldown"]:
        raise PermissionDenied({
            "detail": f"Bạn không có quyền truy cập báo cáo đích hoặc chứng từ nguồn của {code} ({drill_meta['required_permission']}).",
            "code": "DRILLDOWN_PERMISSION_DENIED",
        })

    if code == "DASH-01":
        res = _calculate_revenue_for_range(ctx, ctx.from_date, ctx.to_date)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": _quantize_money(res["net_revenue"]),
            "document_count": res["document_count"],
            "items": res["documents"],
            "drilldown": drill_meta,
        }
    if code == "DASH-02":
        res = _calculate_purchase_for_range(ctx, ctx.from_date, ctx.to_date)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": _quantize_money(res["purchase_net_amount"]),
            "document_count": res["document_count"],
            "items": res["documents"],
            "drilldown": drill_meta,
        }
    if code == "DASH-03":
        res = _calculate_cash_collected_for_range(ctx, ctx.from_date, ctx.to_date)
        items = [d for d in res["documents"] if ctx.cash_flow_scope != "EXTERNAL_ONLY" or not d["is_internal_transfer"]]
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": _quantize_money(res["selected_value"]),
            "document_count": len(items),
            "items": items,
            "drilldown": drill_meta,
        }
    if code in ("DASH-04", "DASH-11"):
        res = _collect_workflow_and_action_items(ctx)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": res["pending_my_approval_count"] or res["pending_company_approval_count"],
            "document_count": len(res["tasks"]),
            "items": res["tasks"],
            "drilldown": drill_meta,
        }
    if code == "DASH-05":
        res = compute_dash_05_cash_flow(ctx)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": res["value"],
            "data": res["data"],
            "items": res["data"]["series"],
            "drilldown": drill_meta,
        }
    if code == "DASH-06":
        res = compute_dash_06_profitability(ctx)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": res["value"],
            "data": res["data"],
            "items": res["data"]["series"],
            "drilldown": drill_meta,
        }
    if code == "DASH-07":
        res = compute_dash_07_receivables(ctx, top_n=50)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": res["value"],
            "data": res["data"],
            "items": res["data"]["items"],
            "drilldown": drill_meta,
        }
    if code == "DASH-08":
        res = compute_dash_08_payables(ctx, top_n=50)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": res["value"],
            "data": res["data"],
            "items": res["data"]["items"],
            "drilldown": drill_meta,
        }
    if code == "DASH-09":
        res = compute_dash_09_inventory(ctx, top_n=50)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": res["value"],
            "data": res["data"],
            "items": res["data"]["top_items"],
            "drilldown": drill_meta,
        }
    if code == "DASH-10":
        res = compute_dash_10_tax(ctx)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": res["value"],
            "data": res["data"],
            "items": res["data"]["obligations"],
            "drilldown": drill_meta,
        }
    if code == "DASH-12":
        res = compute_dash_12_recent_documents(ctx, limit=50)
        return {
            "metric_code": code,
            "name": catalog.name,
            "total_value": res["value"],
            "data": res["data"],
            "items": res["data"]["items"],
            "drilldown": drill_meta,
        }

    raise ValidationError({"metric_code": f"Không hỗ trợ drill-down cho {code}."})
