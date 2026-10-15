"""UC-AP-08: supplier debt reconciliation from posted AP movements."""
import hashlib
import json
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from master_data.models import Currency, Party
from . import models, services, tracking_services


def _lock(qs):
    return qs.select_for_update() if connection.features.has_select_for_update else qs


def _balance_amount(value):
    if value is None or str(value).strip() == "":
        raise ValidationError({"supplier_balance": "Vui lòng nhập Số dư nhà cung cấp xác nhận."})
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"supplier_balance": "Số dư nhà cung cấp xác nhận không hợp lệ."})
    if not result.is_finite() or result.as_tuple().exponent < -4:
        raise ValidationError({"supplier_balance": "Số dư nhà cung cấp xác nhận không hợp lệ."})
    return result


def _attachments(raw, field="confirmation_attachments"):
    if raw is None:
        return []
    if not isinstance(raw, list) or len(raw) > 20:
        raise ValidationError({field: "Chỉ được đính kèm tối đa 20 tệp."})
    for item in raw:
        name = item.get("name", "") if isinstance(item, dict) else ""
        size = item.get("size") if isinstance(item, dict) else None
        if not isinstance(name, str) or not name.lower().endswith((".pdf", ".png", ".jpg", ".jpeg")) or not isinstance(size, int) or size < 0 or size > 10 * 1024 * 1024:
            raise ValidationError({field: f"Tệp {name} không đúng định dạng hoặc vượt quá dung lượng 10 MB."})
    return raw


def _inputs(company, data):
    supplier_id = data.get("supplier")
    if not supplier_id:
        raise ValidationError({"supplier": "Vui lòng chọn Nhà cung cấp."})
    try:
        supplier = Party.objects.get(pk=supplier_id, company=company)
    except (Party.DoesNotExist, ValueError):
        raise ValidationError({"supplier": "Nhà cung cấp không hợp lệ."})
    currency_id = data.get("currency")
    if not currency_id:
        raise ValidationError({"currency": "Vui lòng chọn Loại tiền đối chiếu."})
    try:
        currency = Currency.objects.get(pk=currency_id)
    except (Currency.DoesNotExist, ValueError):
        raise ValidationError({"currency": "Loại tiền đối chiếu không hợp lệ."})
    if not data.get("period_start"):
        raise ValidationError({"period_start": "Vui lòng nhập Ngày bắt đầu kỳ đối chiếu."})
    if not data.get("period_end"):
        raise ValidationError({"period_end": "Vui lòng nhập Ngày kết thúc kỳ đối chiếu."})
    try:
        start = date.fromisoformat(str(data["period_start"]))
        end = date.fromisoformat(str(data["period_end"]))
    except ValueError:
        raise ValidationError({"period": "Ngày kỳ đối chiếu không hợp lệ."})
    if start > end:
        raise ValidationError({"period_start": "Ngày bắt đầu kỳ đối chiếu không được lớn hơn Ngày kết thúc kỳ đối chiếu."})
    if end > timezone.localdate():
        raise ValidationError({"period_end": "Ngày kết thúc kỳ đối chiếu không được lớn hơn ngày hiện tại."})
    return supplier, currency, start, end


def _event(day, created_at, key, number, kind, description, increase=0, decrease=0):
    return {
        "date": str(day), "created_at": created_at.isoformat() if created_at else "",
        "key": key, "number": number or key, "kind": kind, "description": description or "",
        "increase": str(increase), "decrease": str(decrease),
    }


def preview(company, data):
    supplier, currency, start, end = _inputs(company, data)
    events = []
    state = []
    payables = models.Payable.objects.filter(
        company=company, supplier=supplier, currency=currency
    ).select_related("document", "invoice", "goods_purchase", "purchase_cost").prefetch_related(
        "adjustments", "nettings", "adjustment_vouchers", "offset_payable_lines__voucher", "ar_nettings__receivable"
    )
    for payable in payables:
        if not tracking_services.is_payable_posted(payable):
            continue
        posted_date = tracking_services.get_payable_posting_date(payable)
        if posted_date > end:
            continue
        source = tracking_services.get_payable_source_info(payable)
        state.append({"type": "payable", "id": str(payable.pk), "balance": str(payable.balance),
                      "updated_at": payable.updated_at.isoformat()})
        events.append(_event(posted_date, payable.created_at, f"payable:{payable.pk}",
                             source["document_number"], source["source_type_display"],
                             f"Ghi nhận công nợ {source['document_number']}", increase=payable.original_amount))
        for adjustment in payable.adjustments.all():
            if adjustment.status != "POSTED" or adjustment.reverses_id or adjustment.adjustment_date > end:
                continue
            amount = adjustment.amount
            events.append(_event(adjustment.adjustment_date, adjustment.created_at,
                                 f"legacy-adjustment:{adjustment.pk}", adjustment.posting_reference or str(adjustment.pk),
                                 "ADJUSTMENT", adjustment.reason,
                                 increase=amount if amount > 0 else 0,
                                 decrease=-amount if amount < 0 else 0))
        for adjustment in payable.adjustment_vouchers.all():
            if adjustment.status == "POSTED" and adjustment.adjustment_date <= end:
                events.append(_event(adjustment.adjustment_date, adjustment.created_at,
                                     f"adjustment:{adjustment.pk}", adjustment.number,
                                     "ADJUSTMENT_INCREASE" if adjustment.kind == "INCREASE" else "ADJUSTMENT_DECREASE",
                                     adjustment.description,
                                     increase=adjustment.amount if adjustment.kind == "INCREASE" else 0,
                                     decrease=adjustment.amount if adjustment.kind == "DECREASE" else 0))
        for netting in payable.nettings.all():
            if netting.status == "POSTED" and netting.netting_date <= end:
                events.append(_event(netting.netting_date, netting.created_at, f"netting:{netting.pk}",
                                     netting.number, "NETTING", netting.reason, decrease=netting.amount))
        for line in payable.offset_payable_lines.all():
            voucher = line.voucher
            if voucher.status == "POSTED" and voucher.offset_date <= end:
                events.append(_event(voucher.offset_date, voucher.created_at, f"offset:{line.pk}",
                                     voucher.number, "OFFSET", voucher.description, decrease=line.amount))
        for netting in payable.ar_nettings.all():
            if netting.status == "POSTED" and netting.netting_date <= end:
                events.append(_event(netting.netting_date, netting.created_at, f"ar-netting:{netting.pk}",
                                     netting.number, "NETTING", netting.reason, decrease=netting.amount))
    payments = models.Payment.objects.filter(
        company=company, supplier=supplier, currency=currency, payment_date__lte=end,
        status__in=(models.PaymentStatus.POSTED, models.PaymentStatus.CONFIRMED),
    )
    for payment in payments:
        state.append({"type": "payment", "id": str(payment.pk), "amount": str(payment.amount),
                      "allocated": str(payment.allocated_amount), "updated_at": payment.updated_at.isoformat()})
        events.append(_event(payment.payment_date, payment.created_at, f"payment:{payment.pk}",
                             payment.number or payment.external_reference or str(payment.pk), "PAYMENT",
                             payment.payment_content or "Thanh toán nhà cung cấp", decrease=payment.amount))
    events.sort(key=lambda row: (row["date"], row["created_at"], row["key"]))
    opening = Decimal(0)
    increase = Decimal(0)
    decrease = Decimal(0)
    rows = []
    for event in events:
        inc = Decimal(event["increase"])
        dec = Decimal(event["decrease"])
        if event["date"] < str(start):
            opening += inc - dec
        else:
            increase += inc
            decrease += dec
            rows.append({k: value for k, value in event.items() if k not in ("created_at", "key")} | {
                "balance_after": str(opening + increase - decrease)
            })
    closing = opening + increase - decrease
    address = supplier.addresses.order_by("id").values_list("address_line", flat=True).first() or ""
    snapshot = {
        "supplier": {"id": str(supplier.pk), "code": supplier.code, "name": supplier.name,
                     "tax_code": supplier.tax_code or "", "address": address},
        "currency": {"id": str(currency.pk), "code": currency.code},
        "period_start": str(start), "period_end": str(end),
        "opening_balance": str(opening), "period_increase": str(increase),
        "period_decrease": str(decrease), "closing_balance": str(closing),
        "transactions": rows,
    }
    signature = hashlib.sha256(json.dumps(
        {"events": events, "state": sorted(state, key=lambda item: (item["type"], item["id"]))},
        ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")).hexdigest()
    return {"snapshot": snapshot, "snapshot_token": signature}


@transaction.atomic
def create_reconciliation(request, company, data):
    supplier, currency, start, end = _inputs(company, data)
    raw_content = data.get("content")
    if raw_content is not None and not str(raw_content).strip():
        raise ValidationError({"content": "Vui lòng nhập Nội dung đối chiếu."})
    default_content = f"Đối chiếu công nợ từ ngày {start} đến ngày {end}"
    content = str(raw_content or default_content).strip()
    if not content:
        raise ValidationError({"content": "Vui lòng nhập Nội dung đối chiếu."})
    if len(content) > 500:
        raise ValidationError({"content": "Nội dung đối chiếu không được vượt quá 500 ký tự."})
    # Existing balances and payments are locked while the preview is checked and saved.
    list(_lock(models.Payable.objects.filter(company=company, supplier=supplier, currency=currency)).order_by("pk"))
    list(_lock(models.Payment.objects.filter(company=company, supplier=supplier, currency=currency)).order_by("pk"))
    current = preview(company, data)
    if not data.get("snapshot_token") or data["snapshot_token"] != current["snapshot_token"]:
        raise ValidationError({"snapshot_token": "Dữ liệu công nợ đã thay đổi. Vui lòng chọn Lấy dữ liệu trước khi lập biên bản."})
    counter, _ = _lock(models.SupplierReconciliationCounter.objects).get_or_create(
        company=company, year=end.year, defaults={"value": 0})
    counter.value += 1
    counter.save(update_fields=("value",))
    snapshot = current["snapshot"]
    record = models.SupplierReconciliation.objects.create(
        company=company, number=f"DCNCC-{end.year}-{counter.value:06d}", supplier=supplier,
        currency=currency, period_start=start, period_end=end, content=content,
        opening_balance=Decimal(snapshot["opening_balance"]),
        period_increase=Decimal(snapshot["period_increase"]),
        period_decrease=Decimal(snapshot["period_decrease"]),
        closing_balance=Decimal(snapshot["closing_balance"]),
        snapshot=snapshot, snapshot_token=current["snapshot_token"],
        created_by=services.actor(request),
    )
    services.audit(request, record, "RECONCILIATION_CREATE", after={
        "number": record.number, "period_start": str(start), "period_end": str(end),
        "closing_balance": snapshot["closing_balance"], "transaction_count": len(snapshot["transactions"]),
    })
    return record


@transaction.atomic
def complete_reconciliation(request, record, data):
    record = _lock(models.SupplierReconciliation.objects).get(pk=record.pk)
    if record.status != models.SupplierReconciliation.Status.PENDING:
        raise ValidationError({"status": "Biên bản không còn chờ nhà cung cấp xác nhận."})
    raw_date = data.get("confirmation_date")
    if not raw_date:
        raise ValidationError({"confirmation_date": "Vui lòng nhập Ngày xác nhận."})
    try:
        day = date.fromisoformat(str(raw_date))
    except ValueError:
        raise ValidationError({"confirmation_date": "Ngày xác nhận không hợp lệ."})
    if day < record.period_end:
        raise ValidationError({"confirmation_date": "Ngày xác nhận không được nhỏ hơn Ngày kết thúc kỳ đối chiếu."})
    if day > timezone.localdate():
        raise ValidationError({"confirmation_date": "Ngày xác nhận không được lớn hơn ngày hiện tại."})
    name = str(data.get("confirmed_by_name") or "").strip()
    if not name:
        raise ValidationError({"confirmed_by_name": "Vui lòng nhập Người xác nhận phía nhà cung cấp."})
    if len(name) > 255:
        raise ValidationError({"confirmed_by_name": "Người xác nhận không được vượt quá 255 ký tự."})
    if data.get("supplier_balance") is None or str(data.get("supplier_balance")).strip() == "":
        raise ValidationError({"supplier_balance": "Vui lòng nhập Số dư nhà cung cấp xác nhận."})
    supplier_balance = _balance_amount(data["supplier_balance"])
    attachments = data.get("confirmation_attachments")
    if not attachments:
        raise ValidationError({"confirmation_attachments": "Vui lòng đính kèm tài liệu xác nhận của nhà cung cấp."})
    attachments = _attachments(attachments)
    difference = supplier_balance - record.closing_balance
    reason = str(data.get("difference_reason") or "").strip()
    resolution = str(data.get("resolution") or "").strip()
    if difference and not reason:
        raise ValidationError({"difference_reason": "Vui lòng nhập Nguyên nhân chênh lệch."})
    if difference and not resolution:
        raise ValidationError({"resolution": "Vui lòng nhập Hướng xử lý chênh lệch."})
    if len(reason) > 500:
        raise ValidationError({"difference_reason": "Nguyên nhân chênh lệch không được vượt quá 500 ký tự."})
    if len(resolution) > 500:
        raise ValidationError({"resolution": "Hướng xử lý chênh lệch không được vượt quá 500 ký tự."})
    record.confirmation_date = day
    record.confirmed_by_name = name
    record.supplier_balance = supplier_balance
    record.difference = difference
    record.confirmation_attachments = attachments
    record.difference_reason = reason
    record.resolution = resolution
    record.status = (models.SupplierReconciliation.Status.DIFFERENT if difference
                     else models.SupplierReconciliation.Status.MATCHED)
    record.completed_by = services.actor(request)
    record.completed_at = timezone.now()
    record.save(update_fields=("confirmation_date", "confirmed_by_name", "supplier_balance", "difference",
                               "confirmation_attachments", "difference_reason", "resolution", "status",
                               "completed_by", "completed_at"))
    services.audit(request, record, "RECONCILIATION_COMPLETE", after={
        "number": record.number, "system_balance": str(record.closing_balance),
        "supplier_balance": str(supplier_balance), "difference": str(difference), "status": record.status,
    })
    return record


@transaction.atomic
def cancel_reconciliation(request, record, reason):
    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập Lý do hủy."})
    if len(reason) > 500:
        raise ValidationError({"reason": "Lý do hủy không được vượt quá 500 ký tự."})
    record = _lock(models.SupplierReconciliation.objects).get(pk=record.pk)
    if record.status != models.SupplierReconciliation.Status.PENDING:
        raise ValidationError({"status": "Chỉ biên bản chờ xác nhận mới được hủy."})
    record.status = models.SupplierReconciliation.Status.CANCELLED
    record.cancel_reason = reason
    record.cancelled_by = services.actor(request)
    record.cancelled_at = timezone.now()
    record.save(update_fields=("status", "cancel_reason", "cancelled_by", "cancelled_at"))
    services.audit(request, record, "RECONCILIATION_CANCEL", after={"number": record.number,
                                                                      "status": record.status}, reason=reason)
    return record
