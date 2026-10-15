import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from io import BytesIO

from rest_framework.exceptions import ValidationError
from django.db.models import Q, Sum
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from master_data.models import Currency, Party
from organization.models import Branch, Company
from . import models

ZERO = Decimal("0")
ROUND_DIGITS = 4


def _to_decimal(val, default=ZERO):
    if val is None:
        return default
    try:
        return Decimal(str(val))
    except Exception:
        return default


def parse_date_param(val, default=None):
    if not val:
        return default
    if isinstance(val, (date, datetime)):
        return val.date() if isinstance(val, datetime) else val
    try:
        return datetime.strptime(str(val).strip(), "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError({"date": f"Định dạng ngày không hợp lệ: {val}. Yêu cầu định dạng YYYY-MM-DD."})


def validate_due_tracking_filters(params, today=None):
    """
    Validates and normalizes query parameters for UC-AR-08.
    Ensures BR01, BR05, BR06, EF02, EF03 compliance.
    """
    if today is None:
        today = timezone.localdate()

    # 1. as_of_date (Ngày theo dõi) - EF02: Không được lớn hơn ngày hiện tại
    as_of_raw = params.get("as_of_date")
    as_of_date = parse_date_param(as_of_raw, default=today)
    if as_of_date > today:
        raise ValidationError({"as_of_date": "Ngày theo dõi không được sau ngày hiện tại."})

    # 2. upcoming_days (Số ngày sắp đến hạn) - EF03: Số nguyên > 0
    upcoming_raw = params.get("upcoming_days", 7)
    try:
        upcoming_days = int(upcoming_raw)
        if upcoming_days <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        raise ValidationError({"upcoming_days": "Số ngày sắp đến hạn phải là số nguyên lớn hơn 0."})

    # 3. overdue_days_min & overdue_days_max - EF03: >= 0 và min <= max
    overdue_min_raw = params.get("overdue_days_min")
    overdue_max_raw = params.get("overdue_days_max")
    overdue_days_min = None
    overdue_days_max = None

    if overdue_min_raw not in (None, ""):
        try:
            overdue_days_min = int(overdue_min_raw)
            if overdue_days_min < 0:
                raise ValueError()
        except (TypeError, ValueError):
            raise ValidationError({"overdue_days_min": "Số ngày quá hạn từ phải là số nguyên không âm."})

    if overdue_max_raw not in (None, ""):
        try:
            overdue_days_max = int(overdue_max_raw)
            if overdue_days_max < 0:
                raise ValueError()
        except (TypeError, ValueError):
            raise ValidationError({"overdue_days_max": "Số ngày quá hạn đến phải là số nguyên không âm."})

    if overdue_days_min is not None and overdue_days_max is not None:
        if overdue_days_min > overdue_days_max:
            raise ValidationError({
                "overdue_days": "Khoảng ngày quá hạn không hợp lệ: số ngày bắt đầu không được lớn hơn số ngày kết thúc."
            })

    # 4. due_category (Nhóm hạn thanh toán) - Mặc định OVERDUE
    valid_categories = {"OVERDUE", "DUE_TODAY", "UPCOMING", "NOT_DUE", "NO_DUE_DATE", "ALL"}
    due_category = (params.get("due_category") or "OVERDUE").upper().strip()
    if due_category not in valid_categories:
        due_category = "OVERDUE"

    # 5. Customer IDs, Group, Account, Currency, Assigned Staff, Branch IDs, Search
    customer_ids = params.getlist("customer_id") if hasattr(params, "getlist") else []
    if not customer_ids and params.get("customer"):
        customer_ids = [params.get("customer")]

    branch_ids = params.getlist("branch_id") if hasattr(params, "getlist") else []
    if not branch_ids and params.get("branch"):
        branch_ids = [params.get("branch")]

    return {
        "as_of_date": as_of_date,
        "due_category": due_category,
        "upcoming_days": upcoming_days,
        "overdue_days_min": overdue_days_min,
        "overdue_days_max": overdue_days_max,
        "customer_ids": [str(c) for c in customer_ids if c],
        "customer_group": (params.get("customer_group") or "").strip(),
        "receivable_account_id": params.get("receivable_account_id") or params.get("receivable_account"),
        "currency_id": params.get("currency_id") or params.get("currency"),
        "assigned_staff_id": params.get("assigned_staff_id") or params.get("assigned_staff"),
        "branch_ids": [str(b) for b in branch_ids if b],
        "search": (params.get("search") or "").strip(),
    }


def classify_due_item(due_date, as_of_date, upcoming_days):
    """
    Classifies a debt item into one of the 5 mutually exclusive categories.
    Rules:
      - NO_DUE_DATE: due_date is None (BR07)
      - OVERDUE: due_date < as_of_date (BR05)
      - DUE_TODAY: due_date == as_of_date (BR05: chưa quá hạn)
      - UPCOMING: as_of_date < due_date <= as_of_date + upcoming_days (BR06)
      - NOT_DUE: due_date > as_of_date + upcoming_days
    """
    if due_date is None:
        return {
            "due_category": "NO_DUE_DATE",
            "due_category_label": "Chưa có hạn thanh toán",
            "days_due": None,
            "days_overdue": None,
        }

    if due_date < as_of_date:
        days_overdue = (as_of_date - due_date).days
        return {
            "due_category": "OVERDUE",
            "due_category_label": "Quá hạn",
            "days_due": -days_overdue,
            "days_overdue": days_overdue,
        }

    if due_date == as_of_date:
        return {
            "due_category": "DUE_TODAY",
            "due_category_label": "Đến hạn hôm nay",
            "days_due": 0,
            "days_overdue": 0,
        }

    if due_date <= as_of_date + timedelta(days=upcoming_days):
        days_due = (due_date - as_of_date).days
        return {
            "due_category": "UPCOMING",
            "due_category_label": "Sắp đến hạn",
            "days_due": days_due,
            "days_overdue": 0,
        }

    days_due = (due_date - as_of_date).days
    return {
        "due_category": "NOT_DUE",
        "due_category_label": "Chưa đến hạn",
        "days_due": days_due,
        "days_overdue": 0,
    }


def get_due_tracking_report(company, user, filters):
    """
    Core calculation and aggregation engine for UC-AR-08.
    Extracts eligible posted receivables up to as_of_date (BR02, BR04, BR08).
    Evaluates schedules individually (BR03).
    Calculates remaining balances and due categories.
    Computes per-currency and base currency aggregates (Mục 2.3, BR09).
    Applies filters and sorts (BR10).
    """
    as_of_date = filters["as_of_date"]
    due_category = filters["due_category"]
    upcoming_days = filters["upcoming_days"]
    overdue_days_min = filters["overdue_days_min"]
    overdue_days_max = filters["overdue_days_max"]

    # 1. Base Query: Posted Receivables effective on or before as_of_date (BR02, BR04)
    rec_qs = models.Receivable.objects.filter(
        company=company,
        posting_date__lte=as_of_date,
    ).exclude(
        status=models.ReceivableStatus.REVERSED
    ).select_related(
        "customer", "customer__owner", "customer__owner__auth_user",
        "currency", "account", "branch"
    ).prefetch_related(
        "schedules",
        "allocations", "allocations__receipt",
        "netting_voucher_lines", "netting_voucher_lines__voucher",
        "adjustment_voucher_lines", "adjustment_voucher_lines__voucher",
    )

    # 2. Filters
    if filters["branch_ids"]:
        rec_qs = rec_qs.filter(branch_id__in=filters["branch_ids"])

    if filters["customer_ids"]:
        rec_qs = rec_qs.filter(customer_id__in=filters["customer_ids"])

    if filters["customer_group"]:
        rec_qs = rec_qs.filter(customer__customer_group__iexact=filters["customer_group"])

    if filters["receivable_account_id"]:
        rec_qs = rec_qs.filter(account_id=filters["receivable_account_id"])

    if filters["currency_id"]:
        rec_qs = rec_qs.filter(currency_id=filters["currency_id"])

    # Assigned staff filter (AF02)
    assigned_staff = filters["assigned_staff_id"]
    if assigned_staff:
        if str(assigned_staff).upper() in ("UNASSIGNED", "NONE", "NULL"):
            rec_qs = rec_qs.filter(customer__owner__isnull=True)
        else:
            rec_qs = rec_qs.filter(customer__owner_id=assigned_staff)

    # Search filter
    search = filters["search"]
    if search:
        rec_qs = rec_qs.filter(
            Q(customer__code__icontains=search) |
            Q(customer__name__icontains=search) |
            Q(source_document_number__icontains=search) |
            Q(code__icontains=search)
        )

    # 3. Process items & calculate remaining balance as of as_of_date (BR03, BR04, BR08)
    all_eligible_items = []

    for rec in rec_qs:
        exchange_rate = rec.exchange_rate or Decimal("1")
        customer = rec.customer
        owner = customer.owner
        assigned_staff_name = "Chưa phân công"
        assigned_staff_id = None
        if owner:
            assigned_staff_id = str(owner.id)
            assigned_staff_name = owner.display_name or (owner.auth_user.get_full_name() if owner.auth_user else "") or owner.auth_user.username

        schedules = list(rec.schedules.all())

        if schedules:
            # BR03: Track each installment schedule individually; do not add total line to avoid double-counting
            for sch in schedules:
                # Sum reductions for this schedule up to as_of_date
                # A. Allocations
                alloc_sum = sch.receipt_allocations.filter(
                    reversed_at__isnull=True,
                ).filter(
                    Q(effective_date__lte=as_of_date) |
                    Q(effective_date__isnull=True, receipt__receipt_date__lte=as_of_date)
                ).aggregate(tot=Sum("amount"))["tot"] or ZERO

                # B. Nettings
                net_sum = sch.netting_voucher_lines.filter(
                    voucher__status=models.DebtNettingVoucher.Status.POSTED,
                    voucher__posting_date__lte=as_of_date,
                ).aggregate(tot=Sum("amount"))["tot"] or ZERO

                # C. Decrease Adjustments
                adj_sum = sch.adjustment_voucher_lines.filter(
                    voucher__status=models.DebtAdjustmentVoucher.Status.POSTED,
                    voucher__adjustment_type=models.DebtAdjustmentVoucher.AdjustmentType.DECREASE,
                    voucher__posting_date__lte=as_of_date,
                ).aggregate(tot=Sum("amount"))["tot"] or ZERO

                total_reduced = alloc_sum + net_sum + adj_sum
                remaining = sch.amount - total_reduced

                # Section 3: Only track items with remaining balance > 0
                if remaining <= ZERO:
                    continue

                classification = classify_due_item(sch.due_date, as_of_date, upcoming_days)
                base_remaining = (remaining * exchange_rate).quantize(Decimal("0.0001"))

                item = {
                    "receivable_id": str(rec.id),
                    "receivable_code": rec.code,
                    "schedule_id": str(sch.id),
                    "installment_no": sch.installment_no,
                    "schedule_code": f"Đợt {sch.installment_no}",
                    "customer_id": str(customer.id),
                    "customer_code": customer.code,
                    "customer_name": customer.name,
                    "customer_group": customer.customer_group or "",
                    "assigned_staff_id": assigned_staff_id,
                    "assigned_staff_name": assigned_staff_name,
                    "branch_id": str(rec.branch.id) if rec.branch else None,
                    "branch_name": rec.branch.name if rec.branch else "",
                    "document_number": rec.source_document_number or rec.code,
                    "document_date": rec.document_date.isoformat() if rec.document_date else None,
                    "posting_date": rec.posting_date.isoformat() if rec.posting_date else None,
                    "receivable_account_id": str(rec.account.id) if rec.account else None,
                    "receivable_account_code": rec.account.code if rec.account else "",
                    "receivable_account_name": rec.account.name if rec.account else "",
                    "currency_id": str(rec.currency.id),
                    "currency_code": rec.currency.code,
                    "exchange_rate": str(exchange_rate),
                    "original_amount": sch.amount,
                    "reduced_amount": total_reduced,
                    "remaining_balance": remaining,
                    "base_remaining_balance": base_remaining,
                    "due_date": sch.due_date,
                    **classification,
                }
                all_eligible_items.append(item)

        else:
            # Single installment / No schedules
            alloc_sum = rec.allocations.filter(
                reversed_at__isnull=True,
            ).filter(
                Q(effective_date__lte=as_of_date) |
                Q(effective_date__isnull=True, receipt__receipt_date__lte=as_of_date)
            ).aggregate(tot=Sum("amount"))["tot"] or ZERO

            net_sum = rec.netting_voucher_lines.filter(
                voucher__status=models.DebtNettingVoucher.Status.POSTED,
                voucher__posting_date__lte=as_of_date,
            ).aggregate(tot=Sum("amount"))["tot"] or ZERO

            adj_sum = rec.adjustment_voucher_lines.filter(
                voucher__status=models.DebtAdjustmentVoucher.Status.POSTED,
                voucher__adjustment_type=models.DebtAdjustmentVoucher.AdjustmentType.DECREASE,
                voucher__posting_date__lte=as_of_date,
            ).aggregate(tot=Sum("amount"))["tot"] or ZERO

            total_reduced = alloc_sum + net_sum + adj_sum
            remaining = rec.original_amount - total_reduced

            if remaining <= ZERO:
                continue

            classification = classify_due_item(rec.due_date, as_of_date, upcoming_days)
            base_remaining = (remaining * exchange_rate).quantize(Decimal("0.0001"))

            item = {
                "receivable_id": str(rec.id),
                "receivable_code": rec.code,
                "schedule_id": None,
                "installment_no": None,
                "schedule_code": "",
                "customer_id": str(customer.id),
                "customer_code": customer.code,
                "customer_name": customer.name,
                "customer_group": customer.customer_group or "",
                "assigned_staff_id": assigned_staff_id,
                "assigned_staff_name": assigned_staff_name,
                "branch_id": str(rec.branch.id) if rec.branch else None,
                "branch_name": rec.branch.name if rec.branch else "",
                "document_number": rec.source_document_number or rec.code,
                "document_date": rec.document_date.isoformat() if rec.document_date else None,
                "posting_date": rec.posting_date.isoformat() if rec.posting_date else None,
                "receivable_account_id": str(rec.account.id) if rec.account else None,
                "receivable_account_code": rec.account.code if rec.account else "",
                "receivable_account_name": rec.account.name if rec.account else "",
                "currency_id": str(rec.currency.id),
                "currency_code": rec.currency.code,
                "exchange_rate": str(exchange_rate),
                "original_amount": rec.original_amount,
                "reduced_amount": total_reduced,
                "remaining_balance": remaining,
                "base_remaining_balance": base_remaining,
                "due_date": rec.due_date,
                **classification,
            }
            all_eligible_items.append(item)

    # 4. Compute Totals & Summaries grouped by Currency (Mục 2.3, BR09)
    # The summary captures the full distribution of active debt across categories for the filtered population
    currency_summaries = {}
    base_summary = {
        "base_total_remaining_balance": ZERO,
        "base_overdue_balance": ZERO,
        "base_due_today_balance": ZERO,
        "base_upcoming_balance": ZERO,
        "base_not_due_balance": ZERO,
        "base_no_due_date_balance": ZERO,
        "total_count": 0,
        "overdue_count": 0,
        "due_today_count": 0,
        "upcoming_count": 0,
        "not_due_count": 0,
        "no_due_date_count": 0,
    }

    for item in all_eligible_items:
        cur_code = item["currency_code"]
        if cur_code not in currency_summaries:
            currency_summaries[cur_code] = {
                "currency_id": item["currency_id"],
                "currency_code": cur_code,
                "total_remaining_balance": ZERO,
                "overdue_balance": ZERO,
                "due_today_balance": ZERO,
                "upcoming_balance": ZERO,
                "not_due_balance": ZERO,
                "no_due_date_balance": ZERO,
                "total_count": 0,
                "overdue_count": 0,
                "due_today_count": 0,
                "upcoming_count": 0,
                "not_due_count": 0,
                "no_due_date_count": 0,
            }

        c_sum = currency_summaries[cur_code]
        bal = item["remaining_balance"]
        base_bal = item["base_remaining_balance"]
        cat = item["due_category"]

        c_sum["total_remaining_balance"] += bal
        c_sum["total_count"] += 1
        base_summary["base_total_remaining_balance"] += base_bal
        base_summary["total_count"] += 1

        if cat == "OVERDUE":
            c_sum["overdue_balance"] += bal
            c_sum["overdue_count"] += 1
            base_summary["base_overdue_balance"] += base_bal
            base_summary["overdue_count"] += 1
        elif cat == "DUE_TODAY":
            c_sum["due_today_balance"] += bal
            c_sum["due_today_count"] += 1
            base_summary["base_due_today_balance"] += base_bal
            base_summary["due_today_count"] += 1
        elif cat == "UPCOMING":
            c_sum["upcoming_balance"] += bal
            c_sum["upcoming_count"] += 1
            base_summary["base_upcoming_balance"] += base_bal
            base_summary["upcoming_count"] += 1
        elif cat == "NOT_DUE":
            c_sum["not_due_balance"] += bal
            c_sum["not_due_count"] += 1
            base_summary["base_not_due_balance"] += base_bal
            base_summary["not_due_count"] += 1
        elif cat == "NO_DUE_DATE":
            c_sum["no_due_date_balance"] += bal
            c_sum["no_due_date_count"] += 1
            base_summary["base_no_due_date_balance"] += base_bal
            base_summary["no_due_date_count"] += 1

    # 5. Filter List Items by Selected due_category & Overdue days range
    filtered_items = []
    for item in all_eligible_items:
        # Category filter
        if due_category != "ALL" and item["due_category"] != due_category:
            continue

        # Overdue days filter
        if item["due_category"] == "OVERDUE":
            if overdue_days_min is not None and (item["days_overdue"] is None or item["days_overdue"] < overdue_days_min):
                continue
            if overdue_days_max is not None and (item["days_overdue"] is None or item["days_overdue"] > overdue_days_max):
                continue

        filtered_items.append(item)

    # 6. Sorting (BR10)
    # Default for OVERDUE: days_overdue DESC, remaining_balance DESC
    category_order = {"OVERDUE": 0, "DUE_TODAY": 1, "UPCOMING": 2, "NOT_DUE": 3, "NO_DUE_DATE": 4}

    def sort_key(it):
        if due_category == "OVERDUE":
            return (-(it["days_overdue"] or 0), -it["remaining_balance"])
        if due_category in ("UPCOMING", "NOT_DUE"):
            return (it["due_date"] or date.max, -it["remaining_balance"])
        if due_category == "DUE_TODAY":
            return (-it["remaining_balance"],)
        if due_category == "NO_DUE_DATE":
            return (it["posting_date"] or "", -it["remaining_balance"])
        # ALL
        return (
            category_order.get(it["due_category"], 99),
            -(it["days_overdue"] or 0) if it["due_category"] == "OVERDUE" else (it["due_date"] or date.max),
            -it["remaining_balance"]
        )

    filtered_items.sort(key=sort_key)

    # Format values for serialization
    serialized_items = []
    for it in filtered_items:
        item_copy = dict(it)
        item_copy["original_amount"] = f"{item_copy['original_amount']:.4f}"
        item_copy["reduced_amount"] = f"{item_copy['reduced_amount']:.4f}"
        item_copy["remaining_balance"] = f"{item_copy['remaining_balance']:.4f}"
        item_copy["base_remaining_balance"] = f"{item_copy['base_remaining_balance']:.4f}"
        item_copy["due_date"] = item_copy["due_date"].isoformat() if item_copy["due_date"] else None
        serialized_items.append(item_copy)

    # Format summaries
    serialized_summaries = []
    for cur_code, s in currency_summaries.items():
        serialized_summaries.append({
            "currency_id": s["currency_id"],
            "currency_code": s["currency_code"],
            "total_remaining_balance": f"{s['total_remaining_balance']:.4f}",
            "overdue_balance": f"{s['overdue_balance']:.4f}",
            "due_today_balance": f"{s['due_today_balance']:.4f}",
            "upcoming_balance": f"{s['upcoming_balance']:.4f}",
            "not_due_balance": f"{s['not_due_balance']:.4f}",
            "no_due_date_balance": f"{s['no_due_date_balance']:.4f}",
            "total_count": s["total_count"],
            "overdue_count": s["overdue_count"],
            "due_today_count": s["due_today_count"],
            "upcoming_count": s["upcoming_count"],
            "not_due_count": s["not_due_count"],
            "no_due_date_count": s["no_due_date_count"],
        })

    formatted_base_summary = {
        "accounting_currency_code": company.accounting_currency.code if company.accounting_currency else "VND",
        "base_total_remaining_balance": f"{base_summary['base_total_remaining_balance']:.4f}",
        "base_overdue_balance": f"{base_summary['base_overdue_balance']:.4f}",
        "base_due_today_balance": f"{base_summary['base_due_today_balance']:.4f}",
        "base_upcoming_balance": f"{base_summary['base_upcoming_balance']:.4f}",
        "base_not_due_balance": f"{base_summary['base_not_due_balance']:.4f}",
        "base_no_due_date_balance": f"{base_summary['base_no_due_date_balance']:.4f}",
        "total_count": base_summary["total_count"],
        "overdue_count": base_summary["overdue_count"],
        "due_today_count": base_summary["due_today_count"],
        "upcoming_count": base_summary["upcoming_count"],
        "not_due_count": base_summary["not_due_count"],
        "no_due_date_count": base_summary["no_due_date_count"],
    }

    return {
        "as_of_date": as_of_date.isoformat(),
        "filters": {
            "due_category": due_category,
            "upcoming_days": upcoming_days,
            "overdue_days_min": overdue_days_min,
            "overdue_days_max": overdue_days_max,
            "customer_ids": filters["customer_ids"],
            "customer_group": filters["customer_group"],
            "receivable_account_id": filters["receivable_account_id"],
            "currency_id": filters["currency_id"],
            "assigned_staff_id": filters["assigned_staff_id"],
            "branch_ids": filters["branch_ids"],
            "search": filters["search"],
        },
        "assigned_staff_note": "Bộ lọc và hiển thị nhân viên phụ trách sử dụng phân công khách hàng hiện tại.",
        "data_extracted_at": timezone.now().isoformat(),
        "items": serialized_items,
        "total_filtered_items": len(serialized_items),
        "summaries": serialized_summaries,
        "base_summary": formatted_base_summary,
    }


def get_due_item_detail(receivable_id, schedule_id=None, as_of_date=None, company=None):
    """
    Step 3-4: Retrieves detailed audit trail of a debt item, including source voucher,
    payment schedules, allocations, nettings, and adjustment reductions.
    """
    if as_of_date is None:
        as_of_date = timezone.localdate()

    rec_qs = models.Receivable.objects.select_related(
        "customer", "customer__owner", "currency", "account", "branch", "payment_term"
    ).prefetch_related(
        "schedules",
        "allocations", "allocations__receipt",
        "netting_voucher_lines", "netting_voucher_lines__voucher",
        "adjustment_voucher_lines", "adjustment_voucher_lines__voucher",
    )
    if company:
        rec_qs = rec_qs.filter(company=company)

    try:
        rec = rec_qs.get(pk=receivable_id)
    except models.Receivable.DoesNotExist:
        raise ValidationError({"receivable_id": "Không tìm thấy khoản phải thu."})

    target_sch = None
    if schedule_id:
        target_sch = rec.schedules.filter(pk=schedule_id).first()

    # Schedules breakdown
    schedules_data = []
    for s in rec.schedules.all():
        schedules_data.append({
            "schedule_id": str(s.id),
            "installment_no": s.installment_no,
            "due_date": s.due_date.isoformat(),
            "amount": f"{s.amount:.4f}",
            "collected_amount": f"{s.collected_amount:.4f}",
            "current_balance": f"{s.balance:.4f}",
            "status": s.status,
            "is_target": str(s.id) == str(schedule_id) if schedule_id else False,
        })

    # Allocations up to as_of_date
    allocations_data = []
    alloc_qs = rec.allocations.filter(reversed_at__isnull=True).select_related("receipt")
    if target_sch:
        alloc_qs = alloc_qs.filter(schedule=target_sch)
    for a in alloc_qs:
        alloc_dt = a.effective_date or a.receipt.receipt_date
        allocations_data.append({
            "allocation_id": str(a.id),
            "receipt_id": str(a.receipt.id),
            "receipt_number": getattr(a.receipt, "number", None) or getattr(a.receipt, "external_reference", "RECEIPT"),
            "receipt_date": a.receipt.receipt_date.isoformat(),
            "effective_date": alloc_dt.isoformat(),
            "amount": f"{a.amount:.4f}",
            "schedule_id": str(a.schedule.id) if a.schedule else None,
            "in_period_as_of": alloc_dt <= as_of_date,
        })

    # Nettings up to as_of_date
    nettings_data = []
    net_qs = rec.netting_voucher_lines.select_related("voucher")
    if target_sch:
        net_qs = net_qs.filter(receivable_schedule=target_sch)
    for n in net_qs:
        nettings_data.append({
            "netting_line_id": str(n.id),
            "voucher_id": str(n.voucher.id),
            "voucher_number": n.voucher.number,
            "posting_date": n.voucher.posting_date.isoformat(),
            "amount": f"{n.amount:.4f}",
            "schedule_id": str(n.receivable_schedule.id) if n.receivable_schedule else None,
            "status": n.voucher.status,
            "in_period_as_of": n.voucher.posting_date <= as_of_date,
        })

    # Adjustments up to as_of_date
    adjustments_data = []
    adj_qs = rec.adjustment_voucher_lines.select_related("voucher")
    if target_sch:
        adj_qs = adj_qs.filter(receivable_schedule=target_sch)
    for adj in adj_qs:
        adjustments_data.append({
            "adjustment_line_id": str(adj.id),
            "voucher_id": str(adj.voucher.id),
            "voucher_number": adj.voucher.number,
            "posting_date": adj.voucher.posting_date.isoformat(),
            "adjustment_type": adj.voucher.adjustment_type,
            "amount": f"{adj.amount:.4f}",
            "schedule_id": str(adj.receivable_schedule.id) if adj.receivable_schedule else None,
            "status": adj.voucher.status,
            "in_period_as_of": adj.voucher.posting_date <= as_of_date,
        })

    classification = classify_due_item(target_sch.due_date if target_sch else rec.due_date, as_of_date, 7)

    return {
        "receivable_id": str(rec.id),
        "code": rec.code,
        "source_document_type": rec.source_document_type,
        "source_document_number": rec.source_document_number,
        "source_document_id": rec.source_document_id,
        "document_date": rec.document_date.isoformat() if rec.document_date else None,
        "posting_date": rec.posting_date.isoformat() if rec.posting_date else None,
        "due_date": (target_sch.due_date if target_sch else rec.due_date).isoformat() if (target_sch.due_date if target_sch else rec.due_date) else None,
        "customer": {
            "id": str(rec.customer.id),
            "code": rec.customer.code,
            "name": rec.customer.name,
        },
        "currency": {
            "id": str(rec.currency.id),
            "code": rec.currency.code,
        },
        "account": {
            "id": str(rec.account.id) if rec.account else None,
            "code": rec.account.code if rec.account else "",
            "name": rec.account.name if rec.account else "",
        },
        "original_amount": f"{rec.original_amount:.4f}",
        "current_balance": f"{rec.balance:.4f}",
        "selected_schedule": {
            "id": str(target_sch.id),
            "installment_no": target_sch.installment_no,
            "amount": f"{target_sch.amount:.4f}",
            "current_balance": f"{target_sch.balance:.4f}",
            "due_date": target_sch.due_date.isoformat(),
        } if target_sch else None,
        "classification_as_of": classification,
        "schedules": schedules_data,
        "allocations": allocations_data,
        "nettings": nettings_data,
        "adjustments": adjustments_data,
    }


def prepare_collection_payload(selected_items, company, user):
    """
    Step 5 / AF07 / BR12 / EF05 / EF06:
    Validates selected receivable items for transitioning to UC-AR-03 (Ghi nhận thu tiền).
    Ensures:
      - At least 1 item is selected.
      - All items belong to the same Customer (EF05).
      - All items belong to the same Currency (EF05).
      - All items belong to the same Receivable Account (EF05).
      - Current balance in DB is strictly > 0 (EF06).
    Returns structured data for customer receipt creation.
    """
    if not selected_items or not isinstance(selected_items, list):
        raise ValidationError({"selected_items": "Vui lòng chọn ít nhất một khoản phải thu để thu tiền."})

    verified_allocations = []
    customer_ids = set()
    currency_ids = set()
    account_ids = set()
    total_suggested_amount = ZERO

    for idx, item in enumerate(selected_items):
        rec_id = item.get("receivable_id")
        sch_id = item.get("schedule_id")

        if not rec_id:
            raise ValidationError({"selected_items": f"Dòng {idx + 1}: Thiếu mã khoản phải thu (receivable_id)."})

        try:
            rec = models.Receivable.objects.select_related("customer", "currency", "account").get(
                pk=rec_id, company=company
            )
        except models.Receivable.DoesNotExist:
            raise ValidationError({"selected_items": f"Khoản phải thu {rec_id} không tồn tại hoặc ngoài phạm vi."})

        customer_ids.add(rec.customer_id)
        currency_ids.add(rec.currency_id)
        if rec.account_id:
            account_ids.add(rec.account_id)

        target_balance = ZERO
        installment_no = None
        due_dt = rec.due_date

        if sch_id:
            try:
                sch = rec.schedules.get(pk=sch_id)
                target_balance = sch.balance
                installment_no = sch.installment_no
                due_dt = sch.due_date
            except models.ReceivableSchedule.DoesNotExist:
                raise ValidationError({"selected_items": f"Đợt thanh toán {sch_id} không thuộc khoản phải thu {rec.code}."})
        else:
            target_balance = rec.balance

        # EF06: Check current active balance
        if target_balance <= ZERO:
            desc = f"{rec.code} (đợt {installment_no})" if installment_no else rec.code
            raise ValidationError({
                "selected_items": f"Khoản phải thu {desc} đã được thanh toán hết hoặc không còn số dư cần thu."
            })

        total_suggested_amount += target_balance
        verified_allocations.append({
            "receivable_id": str(rec.id),
            "receivable_code": rec.code,
            "schedule_id": str(sch_id) if sch_id else None,
            "installment_no": installment_no,
            "due_date": due_dt.isoformat() if due_dt else None,
            "document_number": rec.source_document_number or rec.code,
            "current_balance": f"{target_balance:.4f}",
            "suggested_allocation_amount": f"{target_balance:.4f}",
        })

    # EF05: Validation of homogeneous Customer, Currency, Account
    if len(customer_ids) > 1:
        raise ValidationError({"customer": "Các khoản được chọn phải cùng một khách hàng để lập chứng từ thu tiền."})

    if len(currency_ids) > 1:
        raise ValidationError({"currency": "Các khoản được chọn phải cùng một loại tiền để lập chứng từ thu tiền."})

    if len(account_ids) > 1:
        raise ValidationError({"account": "Các khoản được chọn phải cùng một tài khoản phải thu để lập chứng từ thu tiền."})

    first_rec = models.Receivable.objects.select_related("customer", "currency", "account").get(
        pk=selected_items[0]["receivable_id"]
    )

    return {
        "target_use_case": "UC-AR-03",
        "customer_id": str(first_rec.customer.id),
        "customer_code": first_rec.customer.code,
        "customer_name": first_rec.customer.name,
        "currency_id": str(first_rec.currency.id),
        "currency_code": first_rec.currency.code,
        "receivable_account_id": str(first_rec.account.id) if first_rec.account else None,
        "receivable_account_code": first_rec.account.code if first_rec.account else "",
        "suggested_total_amount": f"{total_suggested_amount:.4f}",
        "allocations": verified_allocations,
        "selected_count": len(verified_allocations),
    }


def export_due_tracking_excel(company, user, filters):
    """
    AF05 / BR08 / BR14 / EF08:
    Exports due tracking report to an Excel spreadsheet with metadata,
    multi-currency summaries, and full item-level detail lines.
    """
    data = get_due_tracking_report(company, user, filters)

    wb = Workbook()
    ws = wb.active
    ws.title = "Cong No Den Han"

    # Styles
    title_font = Font(name="Arial", size=14, bold=True, color="1F497D")
    header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    section_font = Font(name="Arial", size=11, bold=True, color="1F497D")
    meta_font = Font(name="Arial", size=9, italic=True)
    normal_font = Font(name="Arial", size=9)
    bold_font = Font(name="Arial", size=9, bold=True)

    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    summary_fill = PatternFill(start_color="DCE6F1", end_color="DCE6F1", fill_type="solid")
    overdue_fill = PatternFill(start_color="F2DCDB", end_color="F2DCDB", fill_type="solid")

    thin_border = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9"),
    )

    # 1. Title Block
    ws.append(["BÁO CÁO THEO DÕI CÔNG NỢ ĐẾN HẠN"])
    ws.cell(1, 1).font = title_font
    ws.append([f"Doanh nghiệp: {company.name} (Mã: {company.code})"])
    ws.cell(2, 1).font = bold_font
    ws.append([f"Ngày theo dõi (As-of Date): {data['as_of_date']} | Thời điểm xuất: {data['data_extracted_at']}"])
    ws.cell(3, 1).font = meta_font
    ws.append([f"Nhóm hạn lọc: {data['filters']['due_category']} | Sắp đến hạn: {data['filters']['upcoming_days']} ngày"])
    ws.cell(4, 1).font = meta_font
    ws.append([data["assigned_staff_note"]])
    ws.cell(5, 1).font = meta_font
    ws.append([])

    # 2. Section 1: Summary Table by Currency
    ws.append(["I. TỔNG HỢP CÔNG NỢ THEO LOẠI TIỀN"])
    ws.cell(7, 1).font = section_font

    summary_headers = [
        "Loại tiền", "Tổng còn phải thu", "Quá hạn", "Đến hạn hôm nay",
        "Sắp đến hạn", "Chưa đến hạn", "Chưa có hạn", "Số khoản nợ"
    ]
    ws.append(summary_headers)
    hdr_row = ws.max_row
    for col_idx in range(1, len(summary_headers) + 1):
        cell = ws.cell(hdr_row, col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for s in data["summaries"]:
        ws.append([
            s["currency_code"],
            float(s["total_remaining_balance"]),
            float(s["overdue_balance"]),
            float(s["due_today_balance"]),
            float(s["upcoming_balance"]),
            float(s["not_due_balance"]),
            float(s["no_due_date_balance"]),
            s["total_count"],
        ])
        curr_row = ws.max_row
        for col_idx in range(1, len(summary_headers) + 1):
            cell = ws.cell(curr_row, col_idx)
            cell.font = normal_font
            cell.border = thin_border
            if col_idx in range(2, 8):
                cell.number_format = "#,##0.00"
                cell.alignment = Alignment(horizontal="right")

    # Base currency row
    bs = data["base_summary"]
    ws.append([
        f"Quy đổi ({bs['accounting_currency_code']})",
        float(bs["base_total_remaining_balance"]),
        float(bs["base_overdue_balance"]),
        float(bs["base_due_today_balance"]),
        float(bs["base_upcoming_balance"]),
        float(bs["base_not_due_balance"]),
        float(bs["base_no_due_date_balance"]),
        bs["total_count"],
    ])
    base_row = ws.max_row
    for col_idx in range(1, len(summary_headers) + 1):
        cell = ws.cell(base_row, col_idx)
        cell.font = bold_font
        cell.fill = summary_fill
        cell.border = thin_border
        if col_idx in range(2, 8):
            cell.number_format = "#,##0.00"
            cell.alignment = Alignment(horizontal="right")

    ws.append([])

    # 3. Section 2: Detailed Line Items
    ws.append(["II. CHI TIẾT DANH SÁCH CÔNG NỢ"])
    ws.cell(ws.max_row, 1).font = section_font

    detail_headers = [
        "STT", "Mã KH", "Tên khách hàng", "Nhân viên phụ trách", "Số chứng từ",
        "Ngày hạch toán", "TK phải thu", "Đợt thanh toán", "Hạn thanh toán", "Loại tiền",
        "Phải thu", "Đã giảm", "Còn phải thu", "Số ngày quá hạn", "Số ngày đến hạn",
        "Nhóm hạn thanh toán", "Còn phải thu quy đổi"
    ]
    ws.append(detail_headers)
    dtl_hdr_row = ws.max_row
    for col_idx in range(1, len(detail_headers) + 1):
        cell = ws.cell(dtl_hdr_row, col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for idx, it in enumerate(data["items"], start=1):
        ws.append([
            idx,
            it["customer_code"],
            it["customer_name"],
            it["assigned_staff_name"],
            it["document_number"],
            it["posting_date"],
            it["receivable_account_code"],
            it["schedule_code"],
            it["due_date"] or "Chưa khai báo",
            it["currency_code"],
            float(it["original_amount"]),
            float(it["reduced_amount"]),
            float(it["remaining_balance"]),
            it["days_overdue"] if it["days_overdue"] is not None else "",
            it["days_due"] if it["days_due"] is not None else "",
            it["due_category_label"],
            float(it["base_remaining_balance"]),
        ])
        row_num = ws.max_row
        is_overdue = it["due_category"] == "OVERDUE"
        for col_idx in range(1, len(detail_headers) + 1):
            cell = ws.cell(row_num, col_idx)
            cell.font = normal_font
            cell.border = thin_border
            if is_overdue and col_idx in (13, 14, 16):
                cell.fill = overdue_fill
            if col_idx in (11, 12, 13, 17):
                cell.number_format = "#,##0.00"
                cell.alignment = Alignment(horizontal="right")
            elif col_idx in (1, 14, 15):
                cell.alignment = Alignment(horizontal="center")

    # Column auto-width adjustment
    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len and len(val_str) < 50:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    out = BytesIO()
    wb.save(out)
    return out.getvalue()
