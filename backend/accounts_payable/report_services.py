"""UC-AP-10 supplier-level payable movements and period balances."""
from datetime import date
from decimal import Decimal
from io import BytesIO
from uuid import UUID

from django.utils import timezone
from openpyxl import Workbook
from rest_framework.exceptions import ValidationError

from iam.permissions import has_effective_permission
from master_data.models import Currency, Party
from . import models, tracking_services
from .due_payables_services import _payables

ZERO = Decimal("0")
REPORT_TYPES = ("SUMMARY", "DETAIL")
REPORT_TYPE_MAP = {
    "SUMMARY": "SUMMARY",
    "DETAIL": "DETAIL",
    "Tổng hợp theo nhà cung cấp": "SUMMARY",
    "Tong hop theo nha cung cap": "SUMMARY",
    "TONG_HOP": "SUMMARY",
    "Chi tiết phát sinh": "DETAIL",
    "Chi tiet phat sinh": "DETAIL",
    "CHI_TIET": "DETAIL",
}
TRANSACTION_TYPE_NAMES = {
    "PURCHASE": "Mua hàng",
    "PURCHASE_COST": "Chi phí mua hàng",
    "PAYMENT": "Thanh toán",
    "PURCHASE_RETURN": "Trả lại hàng",
    "PURCHASE_DISCOUNT": "Giảm giá",
    "OFFSET": "Bù trừ",
    "ADJUSTMENT": "Điều chỉnh",
}
COLS = ("opening_balance", "period_increase", "period_decrease", "closing_balance")


def _uuid(value, field):
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({field: "Giá trị không hợp lệ."})


def validate_filters(company, params):
    today = timezone.localdate()
    report_type = params.get("report_type", "SUMMARY")
    if not report_type:
        raise ValidationError({"report_type": "Vui lòng chọn Mẫu báo cáo."})
    report_type = REPORT_TYPE_MAP.get(str(report_type).strip(), report_type)
    if report_type not in REPORT_TYPES:
        raise ValidationError({"report_type": "Mẫu báo cáo không hợp lệ."})
    dates = {}
    raw_start = params.get("start_date") if "start_date" in params else (params.get("from_date") if "from_date" in params else today.replace(day=1).isoformat())
    if not raw_start:
        raise ValidationError({"start_date": "Vui lòng nhập Ngày bắt đầu kỳ báo cáo."})
    try:
        dates["start_date"] = date.fromisoformat(str(raw_start))
    except ValueError:
        raise ValidationError({"start_date": "Ngày báo cáo không hợp lệ."})

    raw_end = params.get("end_date") if "end_date" in params else (params.get("to_date") if "to_date" in params else today.isoformat())
    if not raw_end:
        raise ValidationError({"end_date": "Vui lòng nhập Ngày kết thúc kỳ báo cáo."})
    try:
        dates["end_date"] = date.fromisoformat(str(raw_end))
    except ValueError:
        raise ValidationError({"end_date": "Ngày báo cáo không hợp lệ."})

    if dates["start_date"] > dates["end_date"]:
        raise ValidationError({"start_date": "Ngày bắt đầu kỳ báo cáo không được lớn hơn Ngày kết thúc kỳ báo cáo."})
    if dates["end_date"] > today:
        raise ValidationError({"end_date": "Ngày kết thúc kỳ báo cáo không được lớn hơn ngày hiện tại."})

    raw_currency = params.get("currency_id") if "currency_id" in params else (params.get("currency") if "currency" in params else "VND")
    if not raw_currency:
        raise ValidationError({"currency_id": "Vui lòng chọn Loại tiền."})
    currency = Currency.objects.filter(code__iexact=str(raw_currency), is_active=True).first()
    if currency is None:
        try:
            currency = Currency.objects.filter(pk=UUID(str(raw_currency)), is_active=True).first()
        except ValueError:
            pass
    if currency is None:
        raise ValidationError({"currency_id": "Loại tiền không hoạt động hoặc không tồn tại."})

    raw_suppliers = params.getlist("supplier_ids") if hasattr(params, "getlist") else params.get("supplier_ids", [])
    if isinstance(raw_suppliers, str):
        raw_suppliers = [raw_suppliers]
    if params.get("supplier_id"):
        raw_suppliers.append(params.get("supplier_id"))
    supplier_ids = [_uuid(part.strip(), "supplier_ids") for raw in raw_suppliers for part in str(raw).split(",") if part.strip()]
    if supplier_ids and Party.objects.filter(company=company, pk__in=supplier_ids).count() != len(set(supplier_ids)):
        raise ValidationError({"supplier_ids": "Nhà cung cấp không tồn tại."})

    raw_only = params.get("only_nonzero_closing")
    if raw_only is None:
        raw_only = params.get("has_balance_only")
    if raw_only is None:
        raw_only = params.get("only_remaining", "true")
    if isinstance(raw_only, bool):
        only_nonzero = raw_only
    elif str(raw_only).lower() in ("true", "1"):
        only_nonzero = True
    elif str(raw_only).lower() in ("false", "0"):
        only_nonzero = False
    else:
        raise ValidationError({"only_nonzero_closing": "Giá trị không hợp lệ."})

    try:
        page = int(params.get("page", 1))
        page_size = int(params.get("page_size", 20))
    except (TypeError, ValueError):
        raise ValidationError({"page": "Thông số phân trang không hợp lệ."})
    if page < 1 or page_size not in (20, 50, 100):
        raise ValidationError({"page": "Trang phải lớn hơn 0; page_size chỉ nhận 20, 50 hoặc 100."})
    return {**dates, "report_type": report_type, "currency": currency, "supplier_ids": supplier_ids,
            "only_nonzero_closing": only_nonzero, "page": page, "page_size": page_size}


def _events(company, filters):
    """Build supplier-wide signed events. Payments enter once, on disbursement."""
    end = filters["end_date"]
    events = []

    def add(supplier, day, timestamp, kind, number, description, amount, source_type, source_id, key):
        if day and day <= end:
            events.append({"supplier_id": str(supplier.id), "supplier_code": supplier.code,
                           "supplier_name": supplier.name, "posting_date": day.isoformat(),
                           "posted_at": timestamp.isoformat() if timestamp else "", "document_number": number or "",
                           "transaction_type": kind,
                           "transaction_type_display": TRANSACTION_TYPE_NAMES.get(kind, kind),
                           "description": description or "",
                           "increase": amount if amount > 0 else ZERO,
                           "decrease": -amount if amount < 0 else ZERO,
                           "source_type": source_type, "source_id": str(source_id),
                           "transaction_id": key})

    for p in _payables(company, filters["currency"], filters["supplier_ids"]):
        if not tracking_services.is_payable_posted(p):
            continue
        source_date = tracking_services.get_payable_posting_date(p)
        if source_date > end:
            continue
        source = tracking_services.get_payable_source_info(p)
        source_type = {"DOCUMENT": "AP.DOCUMENT", "INVOICE": "AP.INVOICE",
                       "GOODS_PURCHASE": "PURCHASE.GOODS", "PURCHASE_COST": "PURCHASE.COST"}.get(source["source_type"], "AP.DOCUMENT")
        doc = p.document or p.invoice or p.goods_purchase or p.purchase_cost
        timestamp = getattr(doc, "posted_at", None) or p.created_at
        kind = "PURCHASE_COST" if source["source_type"] == "PURCHASE_COST" else "PURCHASE"
        add(p.supplier, source_date, timestamp, kind, source["document_number"],
            f"Ghi nhận công nợ {source['document_number']}", p.original_amount,
            source_type, source["source_document_id"], f"payable:{p.id}")
        for adj in p.adjustments.all():
            if adj.amount < 0 and adj.reason.startswith("Trả hàng "):
                kind, doc_type = "PURCHASE_RETURN", "PURCHASE.RETURN"
            elif adj.amount < 0 and adj.reason.startswith("Giảm giá hàng mua "):
                kind, doc_type = "PURCHASE_DISCOUNT", "PURCHASE.DISCOUNT"
            else:
                kind, doc_type = "ADJUSTMENT", "AP.ADJUSTMENT"
            add(p.supplier, adj.adjustment_date, adj.created_at, kind,
                adj.posting_reference or str(adj.id)[:8], adj.reason, adj.amount,
                doc_type, adj.id, f"legacy-adjustment:{adj.id}")
        for adj in p.adjustment_vouchers.all():
            if adj.status != "POSTED":
                continue
            amount = adj.amount if adj.kind == "INCREASE" else -adj.amount
            add(p.supplier, adj.adjustment_date, adj.created_at, "ADJUSTMENT", adj.number,
                adj.description, amount, "AP.ADJUSTMENT_VOUCHER", adj.id, f"adjustment:{adj.id}")
        for net in p.nettings.all():
            add(p.supplier, net.netting_date, net.created_at, "OFFSET", net.number, net.reason,
                -net.amount, "AP.NETTING", net.id, f"netting:{net.id}")
        for line in p.offset_payable_lines.all():
            voucher = line.voucher
            if voucher.status == "POSTED":
                add(p.supplier, voucher.offset_date, voucher.created_at, "OFFSET", voucher.number,
                    voucher.description, -line.amount, "AP.OFFSET", voucher.id, f"offset:{line.id}")
        for net in p.ar_nettings.all():
            add(p.supplier, net.netting_date, net.created_at, "OFFSET", net.number, net.reason,
                -net.amount, "AR.NETTING", net.id, f"ar-netting:{net.id}")
    payments = models.Payment.objects.filter(company=company, currency=filters["currency"], payment_date__lte=end,
                                              status__in=("POSTED", "CONFIRMED")).select_related("supplier")
    if filters["supplier_ids"]:
        payments = payments.filter(supplier_id__in=filters["supplier_ids"])
    for payment in payments:
        add(payment.supplier, payment.payment_date, payment.posted_at or payment.created_at,
            "PAYMENT", payment.number or payment.external_reference or str(payment.id)[:8],
            payment.payment_content or "Thanh toán nhà cung cấp", -payment.amount,
            "AP.PAYMENT", payment.id, f"payment:{payment.id}")
    events.sort(key=lambda e: (e["posting_date"], e["posted_at"], e["document_number"], e["transaction_id"]))
    return events


def build_report(company, filters, paginate=True):
    events = _events(company, filters)
    supplier_rows = {}
    for event in events:
        sid = event["supplier_id"]
        row = supplier_rows.setdefault(sid, {"supplier_id": sid, "supplier_code": event["supplier_code"],
                                             "supplier_name": event["supplier_name"],
                                             **{key: ZERO for key in COLS}})
        if event["posting_date"] < filters["start_date"].isoformat():
            row["opening_balance"] += event["increase"] - event["decrease"]
        else:
            row["period_increase"] += event["increase"]
            row["period_decrease"] += event["decrease"]
    for row in supplier_rows.values():
        row["closing_balance"] = row["opening_balance"] + row["period_increase"] - row["period_decrease"]
    suppliers = sorted((row for row in supplier_rows.values()
                        if (not filters["only_nonzero_closing"] or row["closing_balance"] != 0)
                        and (row["opening_balance"] != 0 or row["period_increase"] != 0 or row["period_decrease"] != 0)),
                       key=lambda row: (row["supplier_code"], row["supplier_name"], row["supplier_id"]))
    included = {row["supplier_id"] for row in suppliers}
    totals = {key: sum((row[key] for row in suppliers), ZERO) for key in COLS}
    totals["total_opening"] = totals["opening_balance"]
    totals["total_increase"] = totals["period_increase"]
    totals["total_decrease"] = totals["period_decrease"]
    totals["total_closing"] = totals["closing_balance"]
    detail_rows = []
    if filters["report_type"] == "DETAIL":
        balances = {row["supplier_id"]: row["opening_balance"] for row in suppliers}
        for event in events:
            sid = event["supplier_id"]
            if sid not in included or event["posting_date"] < filters["start_date"].isoformat():
                continue
            balances[sid] += event["increase"] - event["decrease"]
            detail_rows.append({key: value for key, value in event.items() if key != "posted_at"} |
                               {"balance_after": balances[sid]})
    rows = suppliers if filters["report_type"] == "SUMMARY" else detail_rows
    count = len(rows)
    page_rows = rows[(filters["page"] - 1)*filters["page_size"]:filters["page"]*filters["page_size"]] if paginate else rows
    selected_names = (list(Party.objects.filter(company=company, pk__in=filters["supplier_ids"])
                           .order_by("code").values_list("name", flat=True)) if filters["supplier_ids"] else [])
    return {"company_name": company.name,
            "filters": {"report_type": filters["report_type"], "start_date": filters["start_date"].isoformat(),
                        "end_date": filters["end_date"].isoformat(), "currency_id": str(filters["currency"].id),
                        "currency_code": filters["currency"].code, "supplier_ids": [str(i) for i in filters["supplier_ids"]],
                        "only_nonzero_closing": filters["only_nonzero_closing"]},
            "supplier_filter": ", ".join(selected_names) if selected_names else "Tất cả nhà cung cấp",
            "suppliers": suppliers if filters["report_type"] == "DETAIL" else None,
            "rows": page_rows, "totals": totals, "count": count,
            "page": filters["page"] if paginate else None, "page_size": filters["page_size"] if paginate else None,
            "total_pages": (count + filters["page_size"] - 1)//filters["page_size"] if paginate else None,
            "message": "Không có dữ liệu công nợ phù hợp với điều kiện báo cáo." if not suppliers else ""}


def source_for_transaction(company, filters, transaction_id, user):
    detail_filters = {**filters, "report_type": "DETAIL"}
    report = build_report(company, detail_filters, paginate=False)
    event = next((row for row in report["rows"] if row["transaction_id"] == transaction_id), None)
    if event is None:
        raise ValidationError({"transaction_id": "Không tìm thấy chứng từ nguồn của giao dịch đã chọn."})
    source_type = event["source_type"]
    model_map = {"AP.DOCUMENT": models.PayableDocument, "AP.INVOICE": models.SupplierInvoice,
                 "AP.PAYMENT": models.Payment, "AP.NETTING": models.Netting,
                 "AP.ADJUSTMENT": models.PayableAdjustment, "AP.OFFSET": models.DebtOffsetVoucher,
                 "AP.ADJUSTMENT_VOUCHER": models.PayableAdjustmentVoucher}
    if source_type.startswith("PURCHASE."):
        from purchases.models import GoodsPurchase, PurchaseCost, PurchaseReturn, PurchaseDiscount
        model_map.update({"PURCHASE.GOODS": GoodsPurchase, "PURCHASE.COST": PurchaseCost,
                          "PURCHASE.RETURN": PurchaseReturn, "PURCHASE.DISCOUNT": PurchaseDiscount})
    if source_type == "AR.NETTING":
        from accounts_receivable.models import Netting
        model_map[source_type] = Netting
    model = model_map.get(source_type)
    source_id = event["source_id"]
    if model is not None and source_type in ("PURCHASE.RETURN", "PURCHASE.DISCOUNT"):
        purchase_document = model.objects.filter(company=company, payable_adjustment_id=source_id).first()
        if purchase_document:
            source_id = str(purchase_document.pk)
        else:
            # A legacy manual adjustment can share the same description prefix.
            model = models.PayableAdjustment
            source_type = "AP.ADJUSTMENT"
    if model is None or not model.objects.filter(pk=source_id, company=company).exists():
        raise ValidationError({"transaction_id": "Không tìm thấy chứng từ nguồn của giao dịch đã chọn."})
    permission = {"PURCHASE.GOODS": "PURCHASE.GOODS.VIEW", "PURCHASE.COST": "PURCHASE.COST.VIEW",
                  "PURCHASE.RETURN": "PURCHASE.RETURN.VIEW", "PURCHASE.DISCOUNT": "PURCHASE.DISCOUNT.VIEW",
                  "AP.OFFSET": "AP.OFFSET.VIEW", "AP.ADJUSTMENT_VOUCHER": "AP.ADJUSTMENT_VOUCHER.VIEW",
                  "AR.NETTING": "AR.NETTING.VIEW"}.get(source_type, f"{source_type}.VIEW")
    if not (user.is_superuser or (hasattr(user, "iam_account") and has_effective_permission(user.iam_account, company, permission))):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Bạn không có quyền xem chứng từ nguồn này.")
    return {"source_type": source_type, "source_id": source_id,
            "document_number": event["document_number"], "mode": "READ_ONLY"}


def export_excel(report):
    wb = Workbook()
    ws = wb.active
    ws.title = "Bao cao cong no"
    f = report["filters"]
    ws.append([report["company_name"]])
    ws.append(["Báo cáo công nợ phải trả", f["start_date"], f["end_date"], f["currency_code"]])
    ws.append(["Nhà cung cấp:", report["supplier_filter"]])
    if f["report_type"] == "SUMMARY":
        ws.append(["Mã NCC", "Tên nhà cung cấp", "Số dư đầu kỳ", "Phát sinh tăng", "Phát sinh giảm", "Số dư cuối kỳ"])
        for row in report["rows"]:
            ws.append([row["supplier_code"], row["supplier_name"], *[float(row[key]) for key in COLS]])
        ws.append(["Tổng cộng", "", *[float(report["totals"][key]) for key in COLS]])
    else:
        ws.append(["Tổng số dư đầu kỳ", float(report["totals"]["opening_balance"])])
        ws.append(["Mã NCC", "Tên nhà cung cấp", "Ngày hạch toán", "Số chứng từ", "Loại nghiệp vụ",
                   "Diễn giải", "Phát sinh tăng", "Phát sinh giảm", "Số dư sau giao dịch"])
        for row in report["rows"]:
            ws.append([row["supplier_code"], row["supplier_name"], row["posting_date"], row["document_number"],
                       row.get("transaction_type_display", row["transaction_type"]), row["description"], float(row["increase"]),
                       float(row["decrease"]), float(row["balance_after"])])
        ws.append(["Tổng cộng", "", "", "", "", "", float(report["totals"]["period_increase"]),
                   float(report["totals"]["period_decrease"]), float(report["totals"]["closing_balance"])])
    for col in ws.columns:
        letter = col[0].column_letter
        ws.column_dimensions[letter].width = min(45, max(17, max(len(str(cell.value or "")) for cell in col) + 2))
    output = BytesIO()
    wb.save(output)
    return output.getvalue()
