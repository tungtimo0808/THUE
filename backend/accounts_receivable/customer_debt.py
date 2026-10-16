"""Read-only, dated customer receivable projection for UC-AR-02."""
from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from iam.permissions import has_effective_permission
from organization.models import Branch
from . import models


ZERO = Decimal("0")


def parse_filters(params):
    today = timezone.localdate()
    def parsed(name, default):
        raw = params.get(name)
        if not raw:
            return default
        try:
            return date.fromisoformat(raw)
        except ValueError:
            raise ValidationError({name: "Ngày phải có dạng YYYY-MM-DD."})
    start = parsed("from_date", today.replace(day=1))
    end = parsed("to_date", today)
    if start > end:
        raise ValidationError({"from_date": "Từ ngày không được sau Đến ngày."})
    status = params.get("status", "")
    if status and status not in {"OPEN", "PARTIALLY_PAID", "PAID"}:
        raise ValidationError({"status": "Trạng thái thanh toán không hợp lệ."})
    def ids(name):
        values = [v for item in params.getlist(name) for v in item.split(",") if v]
        if name != "customer_group":
            try:
                for value in values:
                    UUID(value)
            except ValueError:
                raise ValidationError({name: "Mã lọc không hợp lệ."})
        return values
    return {
        "from_date": start, "to_date": end, "status": status,
        "branch_ids": ids("branch_id"), "customer_ids": ids("customer_id"),
        "customer_groups": ids("customer_group"), "account_ids": ids("account_id"),
        "currency_ids": ids("currency_id"),
        "overdue_only": params.get("overdue_only", "false").lower() == "true",
        "include_zero": params.get("include_zero", "false").lower() == "true",
    }


def allowed_branches(user, company, selected):
    branches = list(Branch.objects.filter(company=company).values_list("id", flat=True))
    if user.is_superuser:
        allowed = {str(value) for value in branches}
    else:
        allowed = {
            str(value) for value in branches
            if has_effective_permission(user.iam_account, company, "AR.RECEIVABLE.VIEW", branch_id=value)
        }
    if selected and not set(selected).issubset(allowed):
        raise PermissionDenied("Chi nhánh ngoài phạm vi được cấp.")
    return set(selected) if selected else allowed


def _event_date(value):
    return timezone.localtime(value).date() if value else None


def _schedule_at(rec, end):
    histories = sorted(rec.schedule_histories.all(), key=lambda h: h.changed_at)
    past = [h for h in histories if _event_date(h.changed_at) <= end]
    if past:
        return past[-1].new_schedule
    future = [h for h in histories if _event_date(h.changed_at) > end]
    if future:
        return future[0].old_schedule
    return [
        {"id": str(s.id), "installment_no": s.installment_no, "amount": s.amount, "due_date": s.due_date}
        for s in rec.schedules.all()
    ]


def _amount(value):
    return Decimal(str(value))


def project_receivable(rec, start, end):
    if not rec.posting_date or rec.posting_date > end:
        return None
    # Source reversals currently lack a dated event; never present a reversed
    # source as an active receivable.
    if rec.status == models.ReceivableStatus.REVERSED and (
        not rec.reversed_at or _event_date(rec.reversed_at) <= end
    ):
        return None
    events = [(rec.posting_date, "increase", rec.original_amount, str(rec.source_document_id))]
    for allocation in rec.allocations.all():
        effective = allocation.effective_date or _event_date(allocation.created_at)
        if allocation.receipt.status == models.ReceiptStatus.CONFIRMED and effective and (
            not allocation.reversed_at or _event_date(allocation.reversed_at) > end
        ):
            events.append((effective, "payment", allocation.amount, str(allocation.receipt_id)))
    for netting in rec.nettings.all():
        posted = _event_date(netting.posted_at) or _event_date(netting.created_at)
        if netting.status in {models.PostingStatus.POSTED, models.PostingStatus.REVERSED} and posted:
            events.append((max(netting.netting_date, posted), "netting", netting.amount, str(netting.id)))
        reversed_date = _event_date(netting.reversed_at)
        if reversed_date:
            events.append((reversed_date, "increase", netting.amount, str(netting.id)))
    for adjustment in rec.adjustments.all():
        posted = _event_date(adjustment.posted_at) or _event_date(adjustment.created_at)
        if adjustment.status in {models.PostingStatus.POSTED, models.PostingStatus.REVERSED} and posted:
            kind = "increase" if adjustment.amount > 0 else "reduction"
            events.append((max(adjustment.adjustment_date, posted), kind, abs(adjustment.amount), str(adjustment.id)))
    movements = [event for event in events if event[0] <= end]
    opening = sum((v if k == "increase" else -v for d, k, v, _ in movements if d < start), ZERO)
    period = {
        kind: sum((v for d, k, v, _ in movements if start <= d <= end and k == kind), ZERO)
        for kind in ("increase", "reduction", "payment", "netting")
    }
    total = sum((v if k == "increase" else -v for _, k, v, _ in movements), ZERO)
    reductions = sum((v for _, k, v, _ in movements if k == "reduction"), ZERO)
    payments = sum((v for _, k, v, _ in movements if k == "payment"), ZERO)
    nettings = sum((v for _, k, v, _ in movements if k == "netting"), ZERO)
    schedule = _schedule_at(rec, end)
    installments = []
    targeted = defaultdict(lambda: ZERO)
    for allocation in rec.allocations.all():
        effective = allocation.effective_date or _event_date(allocation.created_at)
        if allocation.installment_no and allocation.receipt.status == models.ReceiptStatus.CONFIRMED and effective and effective <= end and (
            not allocation.reversed_at or _event_date(allocation.reversed_at) > end
        ):
            targeted[allocation.installment_no] += allocation.amount
    known_installments = {int(row["installment_no"]) for row in schedule}
    targeted_total = sum((value for key, value in targeted.items() if key in known_installments), ZERO)
    remaining_applied = reductions + payments + nettings - targeted_total
    overdue = ZERO
    age = defaultdict(lambda: ZERO)
    warnings = []
    if not rec.source_document_id or not rec.source_document_number:
        warnings.append("Khoản phải thu thiếu liên kết chứng từ nguồn.")
    if total < 0:
        warnings.append("Phân bổ vượt nghĩa vụ; cần đối chiếu chứng từ nguồn.")
    if not schedule:
        schedule = [{"installment_no": 1, "amount": rec.original_amount, "due_date": rec.due_date}]
        warnings.append("Không có lịch thanh toán; dùng hạn thanh toán của khoản phải thu.")
    schedule_total = sum((_amount(row["amount"]) for row in schedule), ZERO)
    adjustment_delta = sum((v if k == "increase" else -v for _, k, v, _ in movements if k in {"increase", "reduction"}), ZERO) - rec.original_amount
    if schedule_total != rec.original_amount:
        warnings.append("Tổng lịch thanh toán khác nghĩa vụ gốc.")
    for index, row in enumerate(sorted(schedule, key=lambda r: int(r["installment_no"]))):
        obligation = _amount(row["amount"])
        if index == len(schedule) - 1:
            obligation += adjustment_delta
        targeted_here = targeted.get(int(row["installment_no"]), ZERO)
        applied = targeted_here + min(max(remaining_applied, ZERO), max(obligation - targeted_here, ZERO))
        remaining_applied -= applied - targeted_here
        balance = obligation - applied
        raw_due = row.get("due_date")
        try:
            due = raw_due if isinstance(raw_due, date) else date.fromisoformat(raw_due)
        except (TypeError, ValueError):
            due = None
        days = max((end - due).days, 0) if due and balance > 0 else 0
        bucket = (
            "UNDETERMINED" if due is None else
            "SETTLED" if balance <= 0 else
            "NOT_DUE" if due > end else
            "DUE_TODAY" if due == end else
            "OVER_1_30" if days <= 30 else
            "OVER_31_60" if days <= 60 else
            "OVER_61_90" if days <= 90 else "OVER_90"
        )
        if days:
            overdue += balance
        if balance > 0:
            age[bucket] += balance
        installments.append({
            "installment_no": row["installment_no"], "amount": obligation,
            "due_date": due, "balance": balance, "overdue_days": days,
            "age_bucket": bucket,
        })
    if sum((row["balance"] for row in installments), ZERO) != total:
        warnings.append("Lịch thanh toán không khớp số còn phải thu.")
    status = "PAID" if total == 0 else "PARTIALLY_PAID" if payments + nettings > 0 else "OPEN"
    return {
        "id": str(rec.id), "code": rec.code, "customer_id": str(rec.customer_id),
        "branch_id": str(rec.branch_id) if rec.branch_id else None,
        "account_id": str(rec.account_id) if rec.account_id else None,
        "currency_id": str(rec.currency_id), "source_document_type": rec.source_document_type,
        "source_document_id": rec.source_document_id, "source_document_number": rec.source_document_number,
        "posting_date": rec.posting_date, "sales_order_id": str(rec.sales_order_id) if rec.sales_order_id else None,
        "sales_contract_id": str(rec.sales_contract_id) if rec.sales_contract_id else None,
        "invoice_request_id": str(rec.document.invoice_request_id) if rec.document_id and rec.document.invoice_request_id else None,
        "opening": opening, "increase": period["increase"],
        "reduction": period["reduction"], "payment": period["payment"],
        "netting": period["netting"], "closing": total,
        "paid_to_date": payments, "reduced_to_date": reductions, "netted_to_date": nettings,
        "overdue": overdue, "status": status, "installments": installments,
        "age": dict(age), "warnings": warnings,
        "movements": [
            {"date": d, "kind": k, "amount": v, "document_id": document_id}
            for d, k, v, document_id in sorted(movements, key=lambda x: x[0])
        ],
    }


def report(company, user, filters):
    branches = allowed_branches(user, company, filters["branch_ids"])
    qs = models.Receivable.objects.filter(company=company, posting_date__lte=filters["to_date"])
    if not filters["branch_ids"] and (
        user.is_superuser or has_effective_permission(user.iam_account, company, "AR.RECEIVABLE.VIEW")
    ):
        qs = qs.filter(Q(branch_id__in=branches) | Q(branch__isnull=True))
    else:
        qs = qs.filter(branch_id__in=branches)
    if filters["customer_ids"]:
        qs = qs.filter(customer_id__in=filters["customer_ids"])
    if filters["customer_groups"]:
        qs = qs.filter(customer__customer_group__in=filters["customer_groups"])
    if filters["account_ids"]:
        qs = qs.filter(account_id__in=filters["account_ids"])
    if filters["currency_ids"]:
        qs = qs.filter(currency_id__in=filters["currency_ids"])
    qs = qs.select_related("customer", "currency", "document", "account").prefetch_related(
        "schedules", "schedule_histories",
        Prefetch("allocations", queryset=models.ReceiptAllocation.objects.select_related("receipt")),
        "nettings", "adjustments",
    )
    grouped = {}
    for rec in qs:
        item = project_receivable(rec, filters["from_date"], filters["to_date"])
        if item is None or filters["status"] and item["status"] != filters["status"]:
            continue
        if filters["overdue_only"] and item["overdue"] <= 0:
            continue
        key = (rec.customer_id, rec.branch_id, rec.account_id, rec.currency_id)
        if key not in grouped:
            grouped[key] = {
                "customer_id": str(rec.customer_id), "customer_code": rec.customer.code,
                "customer_name": rec.customer.name,
                "branch_id": item["branch_id"], "account_id": item["account_id"],
                "currency_id": item["currency_id"], "currency_code": rec.currency.code,
                "opening": ZERO, "increase": ZERO, "reduction": ZERO, "payment": ZERO,
                "netting": ZERO, "closing": ZERO, "overdue": ZERO, "advance": ZERO,
                "refund_due": None, "age": defaultdict(lambda: ZERO), "receivables": [],
                "advances": [],
            }
        group = grouped[key]
        for field in ("opening", "increase", "reduction", "payment", "netting", "closing", "overdue"):
            group[field] += item[field]
        for bucket, amount in item["age"].items():
            group["age"][bucket] += amount
        group["receivables"].append(item)
    # Unallocated receipts are shown separately, grouped by customer and currency.
    receipts = models.Receipt.objects.filter(company=company, receipt_date__lte=filters["to_date"], status=models.ReceiptStatus.CONFIRMED)
    if filters["customer_ids"]:
        receipts = receipts.filter(customer_id__in=filters["customer_ids"])
    if filters["currency_ids"]:
        receipts = receipts.filter(currency_id__in=filters["currency_ids"])
    for receipt in receipts.select_related("customer", "currency").prefetch_related("allocations"):
        allocated = sum((
            allocation.amount for allocation in receipt.allocations.all()
            if (allocation.effective_date or _event_date(allocation.created_at)) <= filters["to_date"]
            and (not allocation.reversed_at or _event_date(allocation.reversed_at) > filters["to_date"])
        ), ZERO)
        advance = receipt.amount - allocated
        if advance <= 0:
            continue
        matches = [g for g in grouped.values() if g["customer_id"] == str(receipt.customer_id) and g["currency_id"] == str(receipt.currency_id)]
        if not matches and user.is_superuser:
            key = (receipt.customer_id, None, None, receipt.currency_id)
            if key not in grouped:
                grouped[key] = {
                    "customer_id": str(receipt.customer_id), "customer_code": receipt.customer.code,
                    "customer_name": receipt.customer.name,
                    "branch_id": None, "account_id": None,
                    "currency_id": str(receipt.currency_id), "currency_code": receipt.currency.code,
                    "opening": ZERO, "increase": ZERO, "reduction": ZERO, "payment": ZERO,
                    "netting": ZERO, "closing": ZERO, "overdue": ZERO, "advance": ZERO,
                    "refund_due": None, "age": defaultdict(lambda: ZERO),
                    "receivables": [], "advances": [],
                }
            matches = [grouped[key]]
        if len(matches) == 1:
            matches[0]["advance"] += advance
            matches[0]["advances"].append({
                "receipt_id": str(receipt.id), "reference": receipt.external_reference,
                "receipt_date": receipt.receipt_date, "amount": receipt.amount,
                "unallocated": advance,
            })
    rows = []
    for group in grouped.values():
        if not filters["include_zero"] and group["closing"] == 0 and group["advance"] == 0:
            continue
        group["age"] = dict(group["age"])
        rows.append(group)
    return sorted(rows, key=lambda g: (g["customer_code"], g["currency_code"], g["branch_id"] or ""))
