"""UC-AP-09: read-only, as-of-date payable aging."""
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO
from uuid import UUID

from django.db.models import Prefetch, Sum
from django.utils import timezone
from openpyxl import Workbook
from rest_framework.exceptions import ValidationError

from accounts_receivable.models import Netting as ReceivableNetting
from master_data.models import Currency, Party
from . import models, tracking_services

ZERO = Decimal("0")
GROUPS = ("OVERDUE", "DUE_TODAY", "DUE_SOON", "NOT_DUE", "NO_DUE_DATE")
GROUP_NAMES = dict(zip(GROUPS, ("Quá hạn", "Đến hạn hôm nay", "Sắp đến hạn", "Chưa đến hạn", "Chưa xác định hạn")))
PAYMENT_STATES = ("ALL", "OPEN", "PARTIALLY_PAID")


def _uuid(value, field):
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({field: "Giá trị không hợp lệ."})


def validate_filters(company, params):
    raw_date = params.get("as_of_date", timezone.localdate().isoformat())
    if not raw_date:
        raise ValidationError({"as_of_date": "Vui lòng nhập Ngày xác định công nợ."})
    try:
        as_of = date.fromisoformat(str(raw_date))
    except ValueError:
        raise ValidationError({"as_of_date": "Ngày xác định công nợ không hợp lệ."})
    if as_of > timezone.localdate():
        raise ValidationError({"as_of_date": "Ngày xác định công nợ không được lớn hơn ngày hiện tại."})

    currency_raw = params.get("currency_id") if "currency_id" in params else (params.get("currency") if "currency" in params else "VND")
    if not currency_raw:
        raise ValidationError({"currency_id": "Vui lòng chọn Loại tiền."})
    currency = Currency.objects.filter(code__iexact=str(currency_raw), is_active=True).first()
    if not currency:
        currency = Currency.objects.filter(pk=_uuid(currency_raw, "currency_id"), is_active=True).first() if len(str(currency_raw)) == 36 else None
    if not currency:
        raise ValidationError({"currency_id": "Loại tiền không hoạt động hoặc không tồn tại."})

    GROUP_INPUT_MAP = {
        "ALL": "ALL",
        "Tất cả": "ALL",
        "TAT_CA": "ALL",
        "OVERDUE": "OVERDUE",
        "Quá hạn": "OVERDUE",
        "QUA_HAN": "OVERDUE",
        "DUE_TODAY": "DUE_TODAY",
        "Đến hạn hôm nay": "DUE_TODAY",
        "DEN_HAN_HOM_NAY": "DUE_TODAY",
        "DUE_SOON": "DUE_SOON",
        "Sắp đến hạn": "DUE_SOON",
        "SAP_DEN_HAN": "DUE_SOON",
        "NOT_DUE": "NOT_DUE",
        "Chưa đến hạn": "NOT_DUE",
        "CHUA_DEN_HAN": "NOT_DUE",
        "UNDETERMINED": "NO_DUE_DATE",
        "NO_DUE_DATE": "NO_DUE_DATE",
        "Chưa xác định hạn": "NO_DUE_DATE",
        "CHUA_XAC_DINH_HAN": "NO_DUE_DATE",
    }
    PAYMENT_STATUS_INPUT_MAP = {
        "ALL": "ALL",
        "Tất cả": "ALL",
        "TAT_CA": "ALL",
        "OPEN": "OPEN",
        "UNPAID": "OPEN",
        "Chưa thanh toán": "OPEN",
        "CHUA_THANH_TOAN": "OPEN",
        "PARTIALLY_PAID": "PARTIALLY_PAID",
        "Đã thanh toán một phần": "PARTIALLY_PAID",
        "DA_THANH_TOAN_MOT_PHAN": "PARTIALLY_PAID",
    }

    group = params.get("due_group", "ALL")
    if not group:
        raise ValidationError({"due_group": "Vui lòng chọn Nhóm thời hạn."})
    group = GROUP_INPUT_MAP.get(str(group).strip(), group)
    if group not in ("ALL", *GROUPS):
        raise ValidationError({"due_group": "Nhóm thời hạn không hợp lệ."})
    warning_raw = params.get("warning_days", 7)
    if warning_raw in (None, ""):
        raise ValidationError({"warning_days": "Vui lòng nhập Số ngày cảnh báo trước hạn."})
    try:
        warning = int(str(warning_raw))
        if str(warning) != str(warning_raw).strip() or not 1 <= warning <= 365:
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError({"warning_days": "Số ngày cảnh báo trước hạn phải là số nguyên từ 1 đến 365."})
    payment_state = params.get("payment_status", "ALL")
    if not payment_state:
        raise ValidationError({"payment_status": "Vui lòng chọn Trạng thái thanh toán."})
    payment_state = PAYMENT_STATUS_INPUT_MAP.get(str(payment_state).strip(), payment_state)
    if payment_state not in PAYMENT_STATES:
        raise ValidationError({"payment_status": "Trạng thái thanh toán không hợp lệ."})

    raw_suppliers = params.getlist("supplier_ids") if hasattr(params, "getlist") else params.get("supplier_ids", [])
    if isinstance(raw_suppliers, str):
        raw_suppliers = [raw_suppliers]
    supplier_ids = [_uuid(part.strip(), "supplier_ids") for raw in raw_suppliers for part in str(raw).split(",") if part.strip()]
    if supplier_ids and Party.objects.filter(pk__in=supplier_ids, company=company).count() != len(set(supplier_ids)):
        raise ValidationError({"supplier_ids": "Nhà cung cấp không tồn tại."})
    return {"as_of_date": as_of, "currency": currency, "due_group": group,
            "warning_days": warning, "payment_status": payment_state, "supplier_ids": supplier_ids}


def _payables(company, currency, supplier_ids=None):
    qs = models.Payable.objects.filter(company=company, currency=currency).exclude(status__in=[models.PayableStatus.CANCELLED, models.PayableStatus.REVERSED])
    if supplier_ids:
        qs = qs.filter(supplier_id__in=supplier_ids)
    return qs.select_related("supplier", "currency", "document__invoice", "invoice", "goods_purchase", "purchase_cost").prefetch_related(
        # Reversal entries are signed events: keep both sides so past dates remain reproducible.
        Prefetch("adjustments", queryset=models.PayableAdjustment.objects.filter(status=models.PostingStatus.POSTED)),
        Prefetch("adjustment_vouchers", queryset=models.PayableAdjustmentVoucher.objects.all()),
        Prefetch("nettings", queryset=models.Netting.objects.filter(status=models.PostingStatus.POSTED)),
        Prefetch("offset_payable_lines", queryset=models.DebtOffsetPayableLine.objects.select_related("voucher")),
        Prefetch("ar_nettings", queryset=ReceivableNetting.objects.filter(status="POSTED")),
        Prefetch("allocations", queryset=models.PaymentAllocation.objects.select_related("payment")),
        Prefetch("paymentallocationvoucherline_set", queryset=models.PaymentAllocationVoucherLine.objects.select_related("voucher__payment")),
    )


def _events(payable, as_of):
    events = []

    def add(kind, when, amount, number, source_id, note=""):
        if when and when <= as_of:
            events.append({"type": kind, "posting_date": when.isoformat(), "amount": Decimal(amount),
                           "document_number": number or "", "source_id": str(source_id), "note": note or ""})

    def active_at(status, active, ended_at):
        return status == active or bool(ended_at and ended_at.date() > as_of)

    source = tracking_services.get_payable_source_info(payable)
    add("ORIGINAL", tracking_services.get_payable_posting_date(payable), payable.original_amount,
        source["document_number"], source["source_document_id"])
    for obj in payable.adjustments.all():
        kind = "INCREASE" if obj.amount > 0 else ("RETURN" if obj.reason.startswith("Trả hàng ") else
               "DISCOUNT" if obj.reason.startswith("Giảm giá hàng mua ") else "ADJUSTMENT_DECREASE")
        add(kind, obj.adjustment_date, abs(obj.amount), obj.posting_reference, obj.id, obj.reason)
    for obj in payable.adjustment_vouchers.all():
        if not active_at(obj.status, "POSTED", obj.cancelled_at):
            continue
        kind = "INCREASE" if obj.kind == "INCREASE" else "ADJUSTMENT_DECREASE"
        add(kind, obj.adjustment_date, obj.amount, obj.number, obj.id, obj.description)
    for obj in payable.nettings.all():
        add("OFFSET", obj.netting_date, obj.amount, obj.number, obj.id, obj.reason)
    for line in payable.offset_payable_lines.all():
        if not active_at(line.voucher.status, "POSTED", line.voucher.cancelled_at):
            continue
        add("OFFSET", line.voucher.offset_date, line.amount, line.voucher.number, line.voucher_id)
    for obj in payable.ar_nettings.all():
        add("OFFSET", obj.netting_date, obj.amount, obj.number, obj.id, obj.reason)
    for line in payable.allocations.all():
        if line.payment.status not in ("POSTED", "CONFIRMED") and not active_at(line.payment.status, "POSTED", line.payment.canceled_at):
            continue
        add("PAYMENT", line.payment.payment_date, line.amount, line.payment.number or line.payment.external_reference, line.payment_id, line.note)
    for line in payable.paymentallocationvoucherline_set.all():
        voucher = line.voucher
        if not active_at(voucher.status, "ALLOCATED", voucher.reversed_at) or (voucher.payment.status not in ("POSTED", "CONFIRMED") and not active_at(voucher.payment.status, "POSTED", voucher.payment.canceled_at)):
            continue
        add("PAYMENT", voucher.allocation_date, line.amount, voucher.number, voucher.id, voucher.description)
    return sorted(events, key=lambda e: (e["posting_date"], e["type"], e["source_id"]))


def _row(payable, as_of, warning, with_history=False):
    if not tracking_services.is_payable_posted(payable) or tracking_services.get_payable_posting_date(payable) > as_of:
        return None
    events = _events(payable, as_of)
    original = sum((e["amount"] for e in events if e["type"] == "ORIGINAL"), ZERO)
    increases = sum((e["amount"] for e in events if e["type"] == "INCREASE"), ZERO)
    decreases = sum((e["amount"] for e in events if e["type"] in ("ADJUSTMENT_DECREASE", "RETURN", "DISCOUNT", "OFFSET")), ZERO)
    paid = sum((e["amount"] for e in events if e["type"] == "PAYMENT"), ZERO)
    total_debt = original + increases - decreases
    balance = total_debt - paid
    if balance <= ZERO:
        return None
    due = payable.due_date
    if due is None:
        group, days = "NO_DUE_DATE", None
    elif due < as_of:
        group, days = "OVERDUE", (as_of - due).days
    elif due == as_of:
        group, days = "DUE_TODAY", 0
    elif due <= as_of + timedelta(days=warning):
        group, days = "DUE_SOON", (due - as_of).days
    else:
        group, days = "NOT_DUE", (due - as_of).days
    source = tracking_services.get_payable_source_info(payable)
    row = {"payable_id": str(payable.id), "supplier_id": str(payable.supplier_id),
           "supplier_name": payable.supplier.name,
           "supplier_code": payable.supplier.code if payable.supplier else "",
           "document_number": source["document_number"], "invoice_number": source["invoice_number"],
           "document_date": source["document_date"].isoformat(), "due_date": due.isoformat() if due else None,
           "currency_code": payable.currency.code, "total_debt": total_debt, "paid_amount": paid,
           "remaining_amount": balance, "due_group": group, "due_group_name": GROUP_NAMES[group],
           "days": days, "payment_status": "PARTIALLY_PAID" if paid > 0 else "OPEN",
           "payment_status_display": "Đã thanh toán một phần" if paid > 0 else "Chưa thanh toán",
           "source_type": source["source_type"], "source_document_id": source["source_document_id"]}
    if with_history:
        row.update({"original_amount": original, "increase_amount": increases, "nonpayment_decrease": decreases, "history": events})
    return row


def get_due_payables(company, filters):
    rows = []
    for payable in _payables(company, filters["currency"], filters["supplier_ids"]):
        row = _row(payable, filters["as_of_date"], filters["warning_days"])
        if row and (filters["due_group"] == "ALL" or row["due_group"] == filters["due_group"]) and (filters["payment_status"] == "ALL" or row["payment_status"] == filters["payment_status"]):
            rows.append(row)
    rows.sort(key=lambda r: (GROUPS.index(r["due_group"]), r["due_date"] or "9999-12-31", r["document_date"], r["document_number"], r["payable_id"]))
    totals = {group.lower(): sum((r["remaining_amount"] for r in rows if r["due_group"] == group), ZERO) for group in GROUPS}
    totals["remaining_amount"] = sum((r["remaining_amount"] for r in rows), ZERO)
    totals["total_remaining"] = totals["remaining_amount"]
    totals["total_overdue"] = totals["overdue"]
    totals["total_due_today"] = totals["due_today"]
    totals["total_due_soon"] = totals["due_soon"]
    totals["total_not_due"] = totals["not_due"]
    totals["total_undetermined"] = totals["no_due_date"]
    return {"filters": {"as_of_date": filters["as_of_date"].isoformat(), "currency_id": str(filters["currency"].id),
                        "currency_code": filters["currency"].code, "due_group": filters["due_group"],
                        "warning_days": filters["warning_days"], "payment_status": filters["payment_status"],
                        "supplier_ids": [str(i) for i in filters["supplier_ids"]]},
            "rows": rows, "totals": totals, "count": len(rows),
            "message": "Không có khoản công nợ phù hợp với điều kiện tìm kiếm." if not rows else ""}


def get_detail(company, payable_id, filters):
    payable = _payables(company, filters["currency"], filters["supplier_ids"]).filter(pk=_uuid(payable_id, "payable_id")).first()
    if payable:
        row = _row(payable, filters["as_of_date"], filters["warning_days"], with_history=True)
        if row and (filters["due_group"] == "ALL" or row["due_group"] == filters["due_group"]) and (filters["payment_status"] == "ALL" or row["payment_status"] == filters["payment_status"]):
            return row
    raise ValidationError({"payable_id": "Khoản công nợ không thuộc kết quả tra cứu."})


def prepare_payment_request(company, payable_ids, currency):
    if not payable_ids:
        raise ValidationError({"payable_ids": "Vui lòng chọn ít nhất một khoản công nợ."})
    ids = [_uuid(value, "payable_ids") for value in payable_ids]
    if len(set(ids)) != len(ids):
        raise ValidationError({"payable_ids": "Khoản công nợ bị chọn trùng."})
    payables = {p.id: p for p in _payables(company, currency).filter(pk__in=ids)}
    if len(payables) != len(ids):
        raise ValidationError({"payable_ids": "Khoản công nợ không hợp lệ."})
    suppliers = {p.supplier_id for p in payables.values()}
    if len(suppliers) != 1:
        raise ValidationError({"payable_ids": "Các khoản công nợ được chọn phải thuộc cùng một nhà cung cấp."})
    lines = []
    for payable_id in ids:
        p = payables[payable_id]
        source = tracking_services.get_payable_source_info(p)
        reserved = models.PaymentRequestLine.objects.filter(payable=p, request__status__in=["PENDING_APPROVAL", "APPROVED", "PARTIALLY_PAID"]).aggregate(total=Sum("amount"))["total"] or ZERO
        available = max(ZERO, p.balance - reserved)
        if not tracking_services.is_payable_posted(p) or available <= ZERO:
            raise ValidationError({"payable_ids": f"Chứng từ {source['document_number']} không còn số tiền có thể lập đề nghị thanh toán."})
        lines.append({"payable": str(p.id), "document_number": source["document_number"], "available_amount": available, "amount": available})
    supplier = next(iter(payables.values())).supplier
    return {"supplier_id": str(supplier.id), "supplier_name": supplier.name,
            "currency_id": str(currency.id), "currency_code": currency.code,
            "request_type": "DEBT_PAYMENT", "lines": lines,
            "total_amount": sum((line["amount"] for line in lines), ZERO)}


def export_excel(data):
    wb = Workbook()
    ws = wb.active
    ws.title = "Cong no den han"
    ws.append(["Công nợ đến hạn", data["filters"]["as_of_date"], data["filters"]["currency_code"]])
    ws.append(["Nhà cung cấp", "Số chứng từ", "Số hóa đơn", "Ngày chứng từ", "Hạn thanh toán", "Tổng công nợ", "Đã thanh toán", "Còn phải trả", "Nhóm thời hạn", "Số ngày"])
    for row in data["rows"]:
        ws.append([row["supplier_name"], row["document_number"], row["invoice_number"], row["document_date"], row["due_date"],
                   float(row["total_debt"]), float(row["paid_amount"]), float(row["remaining_amount"]), row["due_group_name"], row["days"]])
    for label, key in (("Tổng còn phải trả", "remaining_amount"), ("Tổng quá hạn", "overdue"),
                       ("Tổng đến hạn hôm nay", "due_today"), ("Tổng sắp đến hạn", "due_soon"),
                       ("Tổng chưa đến hạn", "not_due"), ("Tổng chưa xác định hạn", "no_due_date")):
        ws.append([label, "", "", "", "", "", "", float(data["totals"][key])])
    for column in ("F", "G", "H"):
        for cell in ws[column][2:]:
            cell.number_format = '#,##0.0000'
    for col, width in {"A": 28, "B": 20, "C": 18, "D": 16, "E": 16, "F": 20, "G": 20, "H": 20, "I": 22, "J": 12}.items():
        ws.column_dimensions[col].width = width
    output = BytesIO()
    wb.save(output)
    return output.getvalue()
