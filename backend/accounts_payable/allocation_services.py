from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import connection, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from general_ledger.models import AccountingPeriod
from iam.permissions import has_effective_permission
from . import models, services


def _lock(queryset):
    return queryset.select_for_update() if connection.features.has_select_for_update else queryset


def _money(value, field="amount"):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({field: "Số tiền không hợp lệ."})
    if not amount.is_finite() or amount.as_tuple().exponent < -4:
        raise ValidationError({field: "Số tiền không hợp lệ."})
    return amount


def _remaining(payment):
    legacy = models.PaymentAllocation.objects.filter(payment=payment).aggregate(total=Sum("amount"))["total"] or Decimal(0)
    vouchers = models.PaymentAllocationVoucher.objects.filter(
        payment=payment, status=models.AllocationStatus.ALLOCATED
    ).aggregate(total=Sum("total_amount"))["total"] or Decimal(0)
    return payment.amount - legacy - vouchers


def _payable_number(payable):
    for source in (payable.document, payable.invoice, payable.goods_purchase, payable.purchase_cost):
        if source:
            return getattr(source, "number", None) or getattr(source, "invoice_number", "")
    return str(payable.pk)


def _invoice_number(payable):
    if payable.invoice_id:
        return payable.invoice.invoice_number
    if payable.document_id and payable.document.invoice_id:
        return payable.document.invoice.invoice_number
    return ""


def _posting_date(payable):
    if payable.document_id:
        return payable.document.posting_date or payable.document.document_date
    if payable.invoice_id:
        return payable.invoice.posting_date or payable.invoice.invoice_date
    if payable.goods_purchase_id:
        return payable.goods_purchase.posting_date or payable.goods_purchase.document_date
    if payable.purchase_cost_id:
        return payable.purchase_cost.posting_date or payable.purchase_cost.document_date
    return payable.created_at.date()


def eligible_payments(company, supplier_id):
    if not supplier_id:
        raise ValidationError({"supplier": "Vui lòng chọn Nhà cung cấp."})
    payments = models.Payment.objects.filter(
        company=company, supplier_id=supplier_id,
        status__in=(models.PaymentStatus.POSTED, models.PaymentStatus.CONFIRMED),
        canceled_at__isnull=True,
    ).exclude(status=models.PaymentStatus.CANCELED).select_related("currency").order_by("payment_date", "created_at")
    return [
        {"id": str(p.pk), "number": p.number, "payment_date": p.payment_date,
         "payment_method": p.payment_method, "currency": str(p.currency_id),
         "currency_code": p.currency.code,
         "amount": p.amount, "allocated_amount": p.amount - remaining,
         "unallocated_amount": remaining,
         "allocation_status": "UNALLOCATED" if remaining == p.amount else "PARTIALLY_ALLOCATED"}
        for p in payments if (remaining := _remaining(p)) > 0
    ]


def eligible_payables(payment):
    return [
        {"id": str(p.pk), "number": _payable_number(p),
         "voucher_number": _payable_number(p),
         "invoice_number": _invoice_number(p),
         "document_date": _posting_date(p), "voucher_date": _posting_date(p),
         "due_date": p.due_date,
         "original_amount": p.original_amount, "paid_amount": p.paid_amount,
         "balance": p.balance,
         "currency": str(p.currency_id), "currency_code": p.currency.code}
        for p in models.Payable.objects.filter(
            company=payment.company, supplier=payment.supplier, currency=payment.currency,
            balance__gt=0, status__in=(models.PayableStatus.OPEN, models.PayableStatus.PARTIALLY_PAID, models.PayableStatus.OVERDUE),
        ).select_related("document", "document__invoice", "invoice", "goods_purchase", "purchase_cost", "currency")
    ]


def auto_sort_key(payable, allocation_date):
    if payable.due_date is not None and payable.due_date < allocation_date:
        tier = 0
    elif payable.due_date is not None:
        tier = 1
    else:
        tier = 2
    due = payable.due_date or date.max
    p_dt = _posting_date(payable) or date.max
    return (tier, due, p_dt, payable.created_at, str(payable.pk))


def auto_suggest_allocation(company, payment, payable_ids=None, allocation_date_raw=None):
    """AF-AP-ALLOC-01: Calculate automated allocation suggestion according to BR-AP-ALLOC-09."""
    if not isinstance(payment, models.Payment):
        try:
            payment = models.Payment.objects.select_related("currency", "supplier").get(pk=payment, company=company)
        except (models.Payment.DoesNotExist, ValueError):
            raise ValidationError({"payment": "Chứng từ thanh toán không hợp lệ."})

    if payment.status not in (models.PaymentStatus.POSTED, models.PaymentStatus.CONFIRMED) or payment.status == models.PaymentStatus.CANCELED or payment.canceled_at is not None:
        raise ValidationError({"payment": "Chứng từ thanh toán phải ở trạng thái Đã ghi sổ và chưa bị hủy."})

    remaining = _remaining(payment)
    if remaining <= Decimal("0"):
        raise ValidationError({"payment": "Chứng từ thanh toán không còn số tiền chưa phân bổ."})

    if allocation_date_raw:
        try:
            alloc_date = date.fromisoformat(str(allocation_date_raw))
        except (ValueError, TypeError):
            alloc_date = timezone.localdate()
    else:
        alloc_date = timezone.localdate()

    qs = models.Payable.objects.filter(
        company=company, supplier=payment.supplier, currency=payment.currency,
        balance__gt=0, status__in=(models.PayableStatus.OPEN, models.PayableStatus.PARTIALLY_PAID, models.PayableStatus.OVERDUE),
    ).select_related("document", "document__invoice", "invoice", "goods_purchase", "purchase_cost")

    if payable_ids:
        qs = qs.filter(pk__in=payable_ids)

    payables = list(qs)
    if not payables:
        raise ValidationError({"payables": "Nhà cung cấp không có khoản công nợ phù hợp để phân bổ."})

    payables.sort(key=lambda p: auto_sort_key(p, alloc_date))

    suggestions = []
    avail = remaining
    for p in payables:
        amt = min(avail, p.balance)
        suggestions.append({
            "payable_id": str(p.pk),
            "voucher_number": _payable_number(p),
            "invoice_number": _invoice_number(p),
            "due_date": str(p.due_date) if p.due_date else "",
            "document_date": str(_posting_date(p)) if _posting_date(p) else "",
            "balance": float(p.balance),
            "suggested_amount": float(amt),
            "remaining_balance": float(p.balance - amt),
        })
        avail -= amt

    total_allocated = sum(s["suggested_amount"] for s in suggestions)
    return {
        "payment_id": str(payment.pk),
        "payment_number": payment.number,
        "unallocated_amount": float(remaining),
        "total_allocated": float(total_allocated),
        "remaining_unallocated": float(remaining - Decimal(str(total_allocated))),
        "lines": suggestions,
    }


@transaction.atomic
def create_allocation(request, company, data):
    supplier_id = data.get("supplier")
    payment_id = data.get("payment")
    if not supplier_id:
        raise ValidationError({"supplier": "Vui lòng chọn Nhà cung cấp."})
    if not payment_id:
        raise ValidationError({"payment": "Vui lòng chọn Chứng từ thanh toán."})
    try:
        payment = _lock(models.Payment.objects).get(pk=payment_id, company=company)
    except (models.Payment.DoesNotExist, ValueError):
        raise ValidationError({"payment": "Chứng từ thanh toán không hợp lệ."})
    if str(payment.supplier_id) != str(supplier_id):
        raise ValidationError({"supplier": "Chứng từ thanh toán và công nợ phải thuộc cùng một nhà cung cấp."})
    if payment.status not in (models.PaymentStatus.POSTED, models.PaymentStatus.CONFIRMED):
        raise ValidationError({"payment": "Chứng từ thanh toán phải ở trạng thái Đã ghi sổ và chưa bị hủy."})

    raw_date = data.get("allocation_date")
    if not raw_date:
        raise ValidationError({"allocation_date": "Vui lòng nhập Ngày phân bổ."})
    try:
        from datetime import date
        allocation_date = date.fromisoformat(raw_date)
    except (TypeError, ValueError):
        raise ValidationError({"allocation_date": "Ngày phân bổ không hợp lệ."})
    description = data.get("description", f"Phân bổ thanh toán từ chứng từ {payment.number}")
    if not isinstance(description, str) or not description.strip():
        raise ValidationError({"description": "Vui lòng nhập Diễn giải."})
    description = description.strip()
    if len(description) > 500:
        raise ValidationError({"description": "Diễn giải không được vượt quá 500 ký tự."})
    if allocation_date < payment.payment_date:
        raise ValidationError({"allocation_date": "Ngày phân bổ không được nhỏ hơn Ngày thanh toán."})
    if allocation_date > timezone.localdate():
        raise ValidationError({"allocation_date": "Ngày phân bổ không được lớn hơn ngày hiện tại."})
    if not AccountingPeriod.objects.filter(company=company, start_date__lte=allocation_date,
                                           end_date__gte=allocation_date, status="OPEN").exists():
        raise ValidationError({"allocation_date": "Kỳ kế toán của ngày phân bổ đã bị khóa."})

    rows = data.get("lines")
    if not isinstance(rows, list) or not rows:
        raise ValidationError({"lines": "Vui lòng chọn ít nhất một khoản công nợ cần phân bổ."})
    ids = [str(row.get("payable")) for row in rows if isinstance(row, dict)]
    if len(ids) != len(rows) or len(ids) != len(set(ids)):
        raise ValidationError({"lines": "Khoản công nợ không hợp lệ hoặc bị chọn trùng."})
    payables = {str(p.pk): p for p in _lock(models.Payable.objects.filter(pk__in=ids).select_related(
        "document", "invoice", "goods_purchase", "purchase_cost")).order_by("pk")}
    if len(payables) != len(ids):
        raise ValidationError({"lines": "Khoản công nợ không tồn tại."})
    remaining = _remaining(payment)
    if "expected_unallocated_amount" in data and _money(data["expected_unallocated_amount"]) != remaining:
        raise ValidationError({"payment": "Số tiền chưa phân bổ đã thay đổi. Vui lòng tải lại dữ liệu."})
    for row in rows:
        p = payables[str(row["payable"])]
        if p.company_id != company.id or p.supplier_id != payment.supplier_id:
            raise ValidationError({"lines": "Chứng từ thanh toán và công nợ phải thuộc cùng một nhà cung cấp."})
        if p.currency_id != payment.currency_id:
            raise ValidationError({"lines": "Chứng từ thanh toán và công nợ phải sử dụng cùng loại tiền."})
        if p.balance <= 0 or p.status not in (models.PayableStatus.OPEN, models.PayableStatus.PARTIALLY_PAID, models.PayableStatus.OVERDUE):
            raise ValidationError({"lines": f"Công nợ của chứng từ {_payable_number(p)} không còn phù hợp."})
        if allocation_date < _posting_date(p):
            raise ValidationError({"allocation_date": f"Ngày phân bổ không được nhỏ hơn ngày hạch toán của chứng từ {_payable_number(p)}."})
        if "expected_balance" in row and _money(row["expected_balance"]) != p.balance:
            raise ValidationError({"lines": f"Số tiền còn phải trả của chứng từ {_payable_number(p)} đã thay đổi. Vui lòng tải lại dữ liệu."})

    if data.get("mode") == "AUTO":
        ordered = sorted(rows, key=lambda row: auto_sort_key(payables[str(row["payable"])], allocation_date))
        selected = []
        for row in ordered:
            p = payables[str(row["payable"])]
            amount = min(remaining, p.balance)
            if amount > 0:
                selected.append((p, amount))
                remaining -= amount
    elif data.get("mode", "MANUAL") == "MANUAL":
        selected = [(payables[str(row["payable"])], _money(row.get("amount"))) for row in rows]
        if not any(amt > 0 for _, amt in selected):
            raise ValidationError({"lines": "Vui lòng nhập số tiền phân bổ lớn hơn 0 cho ít nhất một khoản công nợ."})
    else:
        raise ValidationError({"mode": "Chế độ phân bổ không hợp lệ."})
    if not selected:
        raise ValidationError({"lines": "Vui lòng nhập số tiền phân bổ lớn hơn 0 cho ít nhất một khoản công nợ."})
    total = sum((amount for _, amount in selected), Decimal(0))
    if total > _remaining(payment):
        raise ValidationError({"lines": f"Tổng tiền phân bổ không được vượt quá số tiền chưa phân bổ là {_remaining(payment)}."})
    for p, amount in selected:
        if amount <= 0:
            raise ValidationError({"lines": f"Số tiền phân bổ cho chứng từ {_payable_number(p)} phải lớn hơn 0."})
        if amount > p.balance:
            raise ValidationError({"lines": f"Số tiền phân bổ cho chứng từ {_payable_number(p)} không được vượt quá số tiền còn phải trả là {p.balance}."})

    counter, _ = _lock(models.PaymentAllocationCounter.objects).get_or_create(
        company=company, year=allocation_date.year, defaults={"value": 0})
    counter.value += 1
    counter.save(update_fields=("value",))
    voucher = models.PaymentAllocationVoucher.objects.create(
        company=company, number=f"PBTT-{allocation_date.year}-{counter.value:06d}",
        payment=payment, allocation_date=allocation_date, description=description,
        total_amount=total, created_by=services.actor(request),
    )
    for index, (p, amount) in enumerate(selected, 1):
        models.PaymentAllocationVoucherLine.objects.create(voucher=voucher, payable=p, line_no=index, amount=amount)
        p.paid_amount += amount
        p.balance -= amount
        p.status = models.PayableStatus.PAID if p.balance == 0 else models.PayableStatus.PARTIALLY_PAID
        p.save(update_fields=("paid_amount", "balance", "status", "updated_at"))
    payment.allocated_amount = payment.amount - _remaining(payment)
    payment.save(update_fields=("allocated_amount",))
    services.audit(request, voucher, "ALLOCATE", after={"number": voucher.number, "payment": str(payment.pk),
                                                      "lines": [{"payable": str(p.pk), "amount": str(a)} for p, a in selected]})
    return voucher


@transaction.atomic
def reverse_allocation(request, voucher, reason):
    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập Lý do đảo phân bổ."})
    voucher = _lock(models.PaymentAllocationVoucher.objects).get(pk=voucher.pk)
    if voucher.status != models.AllocationStatus.ALLOCATED:
        raise ValidationError({"status": "Phiếu phân bổ đã được đảo trước đó."})
    payment = _lock(models.Payment.objects).get(pk=voucher.payment_id)
    lines = list(_lock(models.PaymentAllocationVoucherLine.objects.filter(voucher=voucher).select_related("payable")).order_by("payable_id"))
    for line in lines:
        payable = _lock(models.Payable.objects).get(pk=line.payable_id)
        payable.paid_amount -= line.amount
        payable.balance += line.amount
        payable.status = (models.PayableStatus.PAID if payable.balance == 0 else
                          models.PayableStatus.PARTIALLY_PAID
                          if payable.balance < payable.original_amount + payable.adjustment_amount
                          else models.PayableStatus.OPEN)
        payable.save(update_fields=("paid_amount", "balance", "status", "updated_at"))
    voucher.status = models.AllocationStatus.REVERSED
    voucher.reversed_by = services.actor(request)
    voucher.reversed_at = timezone.now()
    voucher.reversal_reason = reason
    voucher.save(update_fields=("status", "reversed_by", "reversed_at", "reversal_reason"))
    payment.allocated_amount = payment.amount - _remaining(payment)
    payment.save(update_fields=("allocated_amount",))
    services.audit(request, voucher, "REVERSE_ALLOCATION", before={"status": models.AllocationStatus.ALLOCATED},
                   after={"status": voucher.status, "payment": str(payment.pk)}, reason=reason)
    return voucher
