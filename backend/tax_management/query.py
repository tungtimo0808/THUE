from datetime import date
from decimal import Decimal

from django.db.models import Prefetch, Q
from rest_framework.exceptions import ValidationError

from . import models
from .linking import link_summary


def _date(value, field):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({field: "Ngày phải theo định dạng YYYY-MM-DD."})


def _positive_int(value, field, maximum):
    try:
        result = int(value)
    except (TypeError, ValueError):
        raise ValidationError({field: "Giá trị phải là số nguyên dương."})
    if result < 1 or result > maximum:
        raise ValidationError({field: f"Giá trị phải từ 1 đến {maximum}."})
    return result


def _row(invoice):
    validation = (invoice.validation_summary or {}).get("processing_status") or "NOT_CHECKED"
    link = link_summary(invoice)["status"] if invoice.direction == "INPUT" else "NOT_APPLICABLE"
    latest = next(iter(invoice.integration_requests.all()), None)
    reasons = []
    if invoice.direction == "INPUT":
        if validation in {"NOT_CHECKED", "PENDING_CHECK", "MANUAL_REVIEW", "NEEDS_REVIEW", "FAILED", "CHECK_ERROR"}:
            reasons.append("Kiểm tra hóa đơn")
        if invoice.duplicate_suspected:
            reasons.append("Nghi trùng")
        if link in {"UNLINKED", "PARTIALLY_LINKED", "CONFLICT", "REVIEW_REQUIRED"}:
            reasons.append("Liên kết chứng từ")
    elif invoice.status in {"ISSUING", "ISSUE_FAILED", "BLOCKED"}:
        reasons.append("Phát hành hóa đơn")
    if latest and latest.task_type == "CANCEL" and latest.status in {"PENDING", "FAILED"}:
        reasons.append("Yêu cầu hủy")
    return {
        "id": str(invoice.pk), "direction": invoice.direction, "invoice_type": invoice.invoice_type,
        "invoice_series": invoice.invoice_series, "invoice_number": invoice.invoice_number,
        "invoice_date": str(invoice.invoice_date), "seller_name": invoice.seller_name,
        "seller_tax_code": invoice.seller_tax_code, "buyer_name": invoice.buyer_name,
        "buyer_tax_code": invoice.buyer_tax_code, "subtotal": str(invoice.subtotal),
        "tax_amount": str(invoice.tax_amount), "total_amount": str(invoice.total_amount),
        "status": invoice.status, "validation_status": validation, "link_status": link,
        "accounting_status": "UNKNOWN", "pending_reasons": reasons,
        "original_invoice_id": str(invoice.original_invoice_id) if invoice.original_invoice_id else None,
        "provider_reference": invoice.external_reference,
        "lookup_code": (invoice.raw_data or {}).get("lookup_code", ""),
        "integration_status": latest.status if latest else "",
        "integration_task": latest.task_type if latest else "",
        "integration_error": latest.error_message if latest else "",
    }


def query_invoices(queryset, params):
    direction = params.get("direction", "")
    if direction and direction not in {"INPUT", "OUTPUT"}:
        raise ValidationError({"direction": "Chiều hóa đơn không hợp lệ."})
    if direction:
        queryset = queryset.filter(direction=direction)
    status = params.get("status", "")
    if status:
        queryset = queryset.filter(status=status)
    invoice_type = params.get("invoice_type", "")
    if invoice_type:
        queryset = queryset.filter(invoice_type=invoice_type)
    number = params.get("number", "").strip()
    series = params.get("series", "").strip()
    tax_code = params.get("tax_code", "").strip()
    party = params.get("party", "").strip()
    keyword = params.get("q", "").strip()
    if any(len(value) > 150 for value in (number, series, tax_code, party, keyword)):
        raise ValidationError({"q": "Từ khóa tìm kiếm quá dài."})
    start, end = _date(params.get("date_from"), "date_from"), _date(params.get("date_to"), "date_to")
    if start and end and start > end:
        raise ValidationError({"date_to": "Đến ngày phải bằng hoặc sau Từ ngày."})
    if start:
        queryset = queryset.filter(invoice_date__gte=start)
    if end:
        queryset = queryset.filter(invoice_date__lte=end)
    if number:
        queryset = queryset.filter(invoice_number__icontains=number)
    if series:
        queryset = queryset.filter(invoice_series__icontains=series)
    if tax_code:
        queryset = queryset.filter(Q(seller_tax_code__icontains=tax_code) | Q(buyer_tax_code__icontains=tax_code))
    if party:
        queryset = queryset.filter(Q(seller_name__icontains=party) | Q(buyer_name__icontains=party))
    if keyword:
        queryset = queryset.filter(Q(invoice_number__icontains=keyword) | Q(invoice_series__icontains=keyword) |
            Q(seller_name__icontains=keyword) | Q(buyer_name__icontains=keyword) |
            Q(seller_tax_code__icontains=keyword) | Q(buyer_tax_code__icontains=keyword))
    mode = params.get("mode", "lookup")
    if mode not in {"lookup", "outgoing", "pending", "issuance", "errors", "unposted"}:
        raise ValidationError({"mode": "Khu vực tra cứu không hợp lệ."})
    if mode in {"outgoing", "issuance"}:
        queryset = queryset.filter(direction="OUTPUT")
    queryset = queryset.prefetch_related("document_links", Prefetch("integration_requests",
        queryset=models.IntegrationRequest.objects.order_by("-created_at"))).order_by("-invoice_date", "-created_at", "-id")
    page = _positive_int(params.get("page", "1"), "page", 1000000)
    page_size = _positive_int(params.get("page_size", "20"), "page_size", 100)
    if mode == "unposted":
        return {"count": 0, "page": page, "page_size": page_size, "total_amount": "0",
                "accounting_status_available": False, "results": []}
    rows = [_row(invoice) for invoice in queryset]
    if mode == "pending":
        rows = [row for row in rows if row["pending_reasons"]]
    elif mode == "errors":
        rows = [row for row in rows if row["invoice_type"] != "ORIGINAL" or
            row["status"] in {"ADJUSTED", "REPLACED", "CANCELLED"} or row["integration_task"] == "CANCEL"]
    count = len(rows)
    offset = (page - 1) * page_size
    return {"count": count, "page": page, "page_size": page_size,
            "total_amount": str(sum((Decimal(row["total_amount"]) for row in rows), Decimal("0"))),
            "accounting_status_available": False,
            "results": rows[offset:offset + page_size]}
