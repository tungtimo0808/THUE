import csv
from decimal import Decimal
import io

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts_payable.models import SupplierInvoice
from . import models


RECEIVING_STATUS_LABELS = {
    "NOT_RECEIVED": "Chưa nhận",
    "PARTIALLY_RECEIVED": "Nhận một phần",
    "FULLY_RECEIVED": "Đã nhận đủ",
}

INVOICING_STATUS_LABELS = {
    "NOT_INVOICED": "Chưa nhận",
    "PARTIALLY_INVOICED": "Nhận một phần",
    "FULLY_INVOICED": "Đã nhận đủ",
    "OVER_INVOICED": "Nhận vượt",
}

ORDER_STATUS_LABELS = {
    "DRAFT": "Bản nháp",
    "PENDING_APPROVAL": "Chờ phê duyệt",
    "APPROVED": "Đã phê duyệt",
    "SENT": "Đã gửi nhà cung cấp",
    "IN_PROGRESS": "Đang thực hiện",
    "REJECTED": "Bị từ chối",
    "REVISION_REQUIRED": "Yêu cầu chỉnh sửa",
    "PARTIALLY_RECEIVED": "Đang thực hiện",
    "FULLY_RECEIVED": "Đang thực hiện",
    "COMPLETED": "Hoàn thành",
    "CANCELLED": "Đã hủy",
}


def validate_date_filters(params):
    """Validate date ranges according to EF-03."""
    order_date_from = params.get("order_date_from")
    order_date_to = params.get("order_date_to")
    if order_date_from and order_date_to:
        if str(order_date_from) > str(order_date_to):
            raise ValidationError("Ngày bắt đầu không được lớn hơn ngày kết thúc.")

    delivery_date_from = params.get("expected_delivery_date_from") or params.get("delivery_date_from")
    delivery_date_to = params.get("expected_delivery_date_to") or params.get("delivery_date_to")
    if delivery_date_from and delivery_date_to:
        if str(delivery_date_from) > str(delivery_date_to):
            raise ValidationError("Ngày bắt đầu không được lớn hơn ngày kết thúc.")


def get_order_tracking_queryset(company, params):
    """
    Build filtered queryset for purchase order tracking.
    Enforces BR-PUR-TRK-02, BR-PUR-TRK-04, BR-PUR-TRK-05.
    """
    validate_date_filters(params)

    # BR-PUR-TRK-04: Đơn mua ở trạng thái Nháp không được đưa vào danh sách theo dõi thực hiện.
    qs = models.PurchaseOrder.objects.filter(company=company).exclude(status=models.DocumentStatus.DRAFT)

    code = params.get("code") or params.get("number")
    if code:
        qs = qs.filter(number__icontains=code.strip())

    supplier_ids = params.getlist("supplier_id") if hasattr(params, "getlist") and params.getlist("supplier_id") else params.get("supplier_id") or params.get("supplier")
    if supplier_ids:
        if isinstance(supplier_ids, str):
            supplier_ids = [s.strip() for s in supplier_ids.split(",") if s.strip()]
        qs = qs.filter(supplier_id__in=supplier_ids)

    order_date_from = params.get("order_date_from")
    if order_date_from:
        qs = qs.filter(document_date__gte=order_date_from)

    order_date_to = params.get("order_date_to")
    if order_date_to:
        qs = qs.filter(document_date__lte=order_date_to)

    delivery_date_from = params.get("expected_delivery_date_from") or params.get("delivery_date_from")
    if delivery_date_from:
        qs = qs.filter(
            Q(delivery_date__gte=delivery_date_from) |
            Q(lines__expected_delivery_date__gte=delivery_date_from)
        ).distinct()

    delivery_date_to = params.get("expected_delivery_date_to") or params.get("delivery_date_to")
    if delivery_date_to:
        qs = qs.filter(
            Q(delivery_date__lte=delivery_date_to) |
            Q(lines__expected_delivery_date__lte=delivery_date_to)
        ).distinct()

    status_filter = params.get("status") or params.get("order_status")
    if status_filter:
        # BR-PUR-TRK-05: Đơn mua đã hủy vẫn có thể được hiển thị khi User chọn trạng thái Đã hủy
        qs = qs.filter(status=status_filter)

    buyer = params.get("buyer") or params.get("buyer_id") or params.get("assignee")
    if buyer:
        qs = qs.filter(buyer_id=buyer)

    branch_id = params.get("branch_id")
    if branch_id:
        qs = qs.filter(branch_id=branch_id)

    return qs.select_related(
        "company", "branch", "supplier", "currency", "buyer"
    ).prefetch_related(
        "lines__item",
        "lines__uom",
        "lines__tax_rate",
        "lines__warehouse",
    ).order_by("-document_date", "-created_at")


def compute_order_line_tracking(line, today=None):
    """
    Compute tracking metrics for an individual PurchaseOrderLine.
    Handles both goods (BR-PUR-TRK-07, 08, 09, 10, 11) and services (BR-PUR-TRK-13, 14, 15, 16).
    """
    if today is None:
        today = timezone.localdate()

    is_service = bool(line.item.item_type == "SERVICE")
    ordered_qty = line.quantity
    unit_price = line.unit_price
    ordered_pre_tax = line.pre_tax_amount

    # Posted goods purchase lines linked to this order line
    posted_gp_lines = list(
        models.GoodsPurchaseLine.objects.filter(
            order_line=line,
            purchase__status="POSTED",
        ).select_related("purchase")
    )
    received_qty = sum((gl.quantity for gl in posted_gp_lines), Decimal("0"))
    received_pre_tax = sum((gl.pre_tax_amount for gl in posted_gp_lines), Decimal("0"))

    # Posted returns linked to this line's goods purchases
    posted_return_lines = list(
        models.PurchaseReturnLine.objects.filter(
            original_line__order_line=line,
            document__status="POSTED",
        ).select_related("document")
    )
    returned_qty = sum((rl.quantity for rl in posted_return_lines), Decimal("0"))
    returned_pre_tax = sum((rl.pre_tax_amount for rl in posted_return_lines), Decimal("0"))

    # Posted discounts linked to this line's goods purchases
    posted_discount_lines = list(
        models.PurchaseDiscountLine.objects.filter(
            original_line__order_line=line,
            document__status="POSTED",
        ).select_related("document")
    )
    discounted_pre_tax = sum((dl.pre_tax_amount for dl in posted_discount_lines), Decimal("0"))

    # Net fulfillment
    # BR-PUR-TRK-09: Số lượng thực nhận = Số lượng đã nhận − Số lượng đã trả lại
    net_received_qty = received_qty - returned_qty
    # BR-PUR-TRK-10: Số lượng còn phải nhận = Max(Số lượng đặt mua − Số lượng thực nhận, 0)
    remaining_qty = max(ordered_qty - net_received_qty, Decimal("0"))
    # AF-03, BR-PUR-TRK-11: Cảnh báo Nhận vượt khi thực nhận > đặt mua
    is_over_received = net_received_qty > ordered_qty
    over_received_qty = max(net_received_qty - ordered_qty, Decimal("0"))

    # Service tracking (BR-PUR-TRK-13, 14, 16)
    accepted_value = received_pre_tax
    remaining_service_value = max(ordered_pre_tax - accepted_value - discounted_pre_tax, Decimal("0"))
    is_over_accepted_value = accepted_value > ordered_pre_tax

    # Progress and receiving status
    if is_service and not getattr(line.item, "track_inventory", False) and line.quantity <= 1:
        # Amount-based service tracking
        realized_pre_tax = accepted_value
        if ordered_pre_tax > 0:
            progress_ratio = (accepted_value + discounted_pre_tax) / ordered_pre_tax * 100
            progress_percent = min(Decimal("100"), progress_ratio.quantize(Decimal("0.01")))
        else:
            progress_percent = Decimal("100") if accepted_value > 0 else Decimal("0")

        if accepted_value <= 0:
            receiving_status = "NOT_RECEIVED"
        elif (accepted_value + discounted_pre_tax) < ordered_pre_tax:
            receiving_status = "PARTIALLY_RECEIVED"
        else:
            receiving_status = "FULLY_RECEIVED"
    else:
        # Quantity-based tracking (goods or quantity-managed service)
        realized_pre_tax = net_received_qty * unit_price
        if ordered_qty > 0:
            progress_ratio = (net_received_qty / ordered_qty) * 100
            # BR-PUR-TRK-21: Tỷ lệ thực hiện hiển thị tối đa 100%
            progress_percent = min(Decimal("100"), progress_ratio.quantize(Decimal("0.01")))
        else:
            progress_percent = Decimal("100") if net_received_qty > 0 else Decimal("0")

        if net_received_qty <= 0:
            receiving_status = "NOT_RECEIVED"
        elif net_received_qty < ordered_qty:
            # BR-PUR-TRK-22: Hàng mua trả lại có thể làm trạng thái từ Đã nhận đủ chuyển thành Nhận một phần
            receiving_status = "PARTIALLY_RECEIVED"
        else:
            receiving_status = "FULLY_RECEIVED"

    # Overdue calculation (BR-PUR-TRK-30, 31)
    expected_delivery_date = line.expected_delivery_date or line.order.delivery_date
    is_completed = (receiving_status == "FULLY_RECEIVED")
    if not is_completed and expected_delivery_date and today > expected_delivery_date:
        is_overdue = True
        overdue_days = (today - expected_delivery_date).days
    else:
        is_overdue = False
        overdue_days = 0

    # Latest execution date
    execution_dates = [
        gl.purchase.document_date for gl in posted_gp_lines if gl.purchase.document_date
    ] + [
        rl.document.document_date for rl in posted_return_lines if rl.document.document_date
    ]
    latest_execution_date = max(execution_dates) if execution_dates else None

    return {
        "id": line.id,
        "line_no": line.line_no,
        "item": {
            "id": line.item_id,
            "code": line.item.code,
            "name": line.item.name,
            "item_type": line.item.item_type,
        },
        "uom": {
            "id": line.uom_id,
            "code": line.uom.code,
            "name": getattr(line.uom, "name", line.uom.code),
        } if line.uom else None,
        "description": line.description,
        "is_service": is_service,
        "unit_price": unit_price,
        "ordered_quantity": ordered_qty,
        "received_quantity": received_qty,
        "returned_quantity": returned_qty,
        "net_received_quantity": net_received_qty,
        "remaining_quantity": remaining_qty,
        "is_over_received": is_over_received,
        "over_received_quantity": over_received_qty,
        # Service specifics
        "accepted_value": accepted_value,
        "discounted_value": discounted_pre_tax,
        "remaining_service_value": remaining_service_value,
        "is_over_accepted_value": is_over_accepted_value,
        # General amounts
        "pre_tax_amount": ordered_pre_tax,
        "realized_pre_tax": realized_pre_tax,
        "progress_percent": progress_percent,
        "receiving_status": receiving_status,
        "receiving_status_display": RECEIVING_STATUS_LABELS.get(receiving_status, receiving_status),
        "expected_delivery_date": expected_delivery_date,
        "latest_execution_date": latest_execution_date,
        "is_overdue": is_overdue,
        "overdue_days": overdue_days,
    }


def get_order_linked_invoices(order):
    """
    Find all valid input invoices linked to the order directly, via GoodsPurchase, or via match.
    Enforces BR-PUR-TRK-23, BR-PUR-TRK-29.
    """
    invoices_map = {}

    # Direct PO link
    for inv in SupplierInvoice.objects.filter(
        purchase_order=order,
        validation_status="VALID",
    ).exclude(status=models.DocumentStatus.CANCELLED):
        invoices_map[inv.pk] = inv

    # Linked via GoodsPurchase of this PO
    for inv in SupplierInvoice.objects.filter(
        goodspurchase__purchase_order=order,
        validation_status="VALID",
    ).exclude(status=models.DocumentStatus.CANCELLED):
        invoices_map[inv.pk] = inv

    # Linked via PurchaseInvoiceMatch on lines of this PO
    for inv in SupplierInvoice.objects.filter(
        lines__purchase_matches__purchase_line__purchase__purchase_order=order,
        validation_status="VALID",
    ).exclude(status=models.DocumentStatus.CANCELLED):
        invoices_map[inv.pk] = inv

    return list(invoices_map.values())


def compute_order_tracking_summary(order, today=None):
    """
    Calculate high-level tracking summary for list and detail views.
    Pure read-only aggregation (BR-PUR-TRK-35).
    """
    if today is None:
        today = timezone.localdate()

    lines = list(order.lines.all())
    lines_tracking = [compute_order_line_tracking(l, today=today) for l in lines]

    # Pre-tax order value after discount (1.2)
    order_total_pre_tax = sum((lt["pre_tax_amount"] for lt in lines_tracking), Decimal("0"))
    if not order_total_pre_tax and order.total_amount:
        order_total_pre_tax = max(order.subtotal - order.discount_amount, Decimal("0"))

    # Overall receiving status and progress (BR-PUR-TRK-17, 18, 19, 20)
    if not lines_tracking:
        receiving_status = "NOT_RECEIVED"
        progress_percent = Decimal("0")
    elif all(lt["receiving_status"] == "FULLY_RECEIVED" for lt in lines_tracking):
        receiving_status = "FULLY_RECEIVED"
        progress_percent = Decimal("100.00")
    elif all(lt["receiving_status"] == "NOT_RECEIVED" for lt in lines_tracking):
        receiving_status = "NOT_RECEIVED"
        progress_percent = Decimal("0")
    else:
        receiving_status = "PARTIALLY_RECEIVED"
        total_realized = sum((min(lt["realized_pre_tax"], lt["pre_tax_amount"]) for lt in lines_tracking), Decimal("0"))
        if order_total_pre_tax > 0:
            progress_percent = min(Decimal("100"), ((total_realized / order_total_pre_tax) * 100).quantize(Decimal("0.01")))
        else:
            progress_percent = Decimal("0")

    # Invoicing status & metrics (BR-PUR-TRK-23 to 29)
    invoices = get_order_linked_invoices(order)
    invoiced_pre_tax = sum((max(inv.subtotal - inv.discount_amount, Decimal("0")) for inv in invoices), Decimal("0"))
    order_value_to_invoice = order_total_pre_tax

    if invoiced_pre_tax <= 0:
        invoicing_status = "NOT_INVOICED"
        difference_invoice_amount = Decimal("0")
    elif invoiced_pre_tax < order_value_to_invoice:
        invoicing_status = "PARTIALLY_INVOICED"
        difference_invoice_amount = order_value_to_invoice - invoiced_pre_tax
    elif invoiced_pre_tax == order_value_to_invoice:
        invoicing_status = "FULLY_INVOICED"
        difference_invoice_amount = Decimal("0")
    else:
        # AF-05, BR-PUR-TRK-28: Nhận vượt
        invoicing_status = "OVER_INVOICED"
        difference_invoice_amount = invoiced_pre_tax - order_value_to_invoice

    # Overdue evaluation (BR-PUR-TRK-30 to 33)
    uncompleted_lines = [lt for lt in lines_tracking if lt["receiving_status"] != "FULLY_RECEIVED"]
    uncompleted_dates = [lt["expected_delivery_date"] for lt in uncompleted_lines if lt["expected_delivery_date"]]

    if uncompleted_dates:
        nearest_uncompleted_delivery_date = min(uncompleted_dates)
    else:
        nearest_uncompleted_delivery_date = order.delivery_date

    if order.status == models.DocumentStatus.COMPLETED:
        # BR-PUR-TRK-33: Đơn mua đã hoàn thành không bị tính quá hạn
        is_overdue = False
        overdue_days = 0
        completed_late = bool(
            order.delivery_date and order.closed_at and order.closed_at.date() > order.delivery_date
        )
    else:
        # BR-PUR-TRK-32: Gắn cờ Quá hạn nếu có ít nhất một dòng còn hiệu lực bị quá hạn
        overdue_lines = [lt for lt in uncompleted_lines if lt["is_overdue"]]
        is_overdue = len(overdue_lines) > 0
        if is_overdue and nearest_uncompleted_delivery_date and today > nearest_uncompleted_delivery_date:
            overdue_days = (today - nearest_uncompleted_delivery_date).days
        else:
            overdue_days = 0
        completed_late = False

    return {
        "id": order.id,
        "number": order.number,
        "document_date": order.document_date,
        "status": order.status,
        "status_display": ORDER_STATUS_LABELS.get(order.status, order.status),
        "supplier": {
            "id": order.supplier_id,
            "code": order.supplier.code,
            "name": order.supplier.name,
        } if order.supplier else None,
        "buyer": {
            "id": order.buyer_id,
            "name": getattr(order.buyer, "full_name", str(order.buyer)),
            "email": getattr(order.buyer, "email", ""),
        } if order.buyer else None,
        "currency": {
            "id": order.currency_id,
            "code": order.currency.code,
        } if order.currency else None,
        "delivery_date": nearest_uncompleted_delivery_date,
        "initial_delivery_date": order.delivery_date,
        "total_pre_tax_amount": order_total_pre_tax,
        "progress_percent": progress_percent,
        "receiving_status": receiving_status,
        "receiving_status_display": RECEIVING_STATUS_LABELS.get(receiving_status, receiving_status),
        "invoicing_status": invoicing_status,
        "invoicing_status_display": INVOICING_STATUS_LABELS.get(invoicing_status, invoicing_status),
        "invoiced_pre_tax_amount": invoiced_pre_tax,
        "order_value_to_invoice": order_value_to_invoice,
        "difference_invoice_amount": difference_invoice_amount,
        "is_overdue": is_overdue,
        "overdue_days": overdue_days,
        "completed_late": completed_late,
        "lines_count": len(lines),
        "lines_tracking": lines_tracking,
    }


def filter_summaries_by_computed_fields(summaries, params):
    """Filter in-memory summaries by calculated receiving, invoicing, or overdue statuses."""
    receiving_status = params.get("receiving_status")
    if receiving_status:
        summaries = [s for s in summaries if s["receiving_status"] == receiving_status]

    invoicing_status = params.get("invoicing_status")
    if invoicing_status:
        summaries = [s for s in summaries if s["invoicing_status"] == invoicing_status]

    overdue_status = params.get("overdue_status")
    if overdue_status == "OVERDUE":
        summaries = [s for s in summaries if s["is_overdue"]]
    elif overdue_status == "NOT_OVERDUE":
        summaries = [s for s in summaries if not s["is_overdue"]]

    return summaries


def compute_order_tracking_detail(order, today=None):
    """
    Build complete tracking detail payload according to Steps 23-31.
    Includes lines, related posted documents, and chronological timeline.
    """
    if today is None:
        today = timezone.localdate()

    summary = compute_order_tracking_summary(order, today=today)

    # 1. Related Posted Goods Purchases (excluding pure services)
    goods_purchases = list(
        models.GoodsPurchase.objects.filter(
            Q(purchase_order=order) | Q(lines__order_line__order=order),
            status="POSTED",
        ).exclude(purchase_type=models.GoodsPurchase.PurchaseType.SERVICE).distinct()
    )
    goods_receipts_data = [
        {
            "id": gp.id,
            "document_type": "GOODS_PURCHASE",
            "document_type_display": "Mua hàng hóa",
            "number": gp.number,
            "document_date": gp.document_date,
            "status": gp.status,
            "pre_tax_amount": gp.subtotal - gp.discount_amount,
            "total_amount": gp.total_amount,
            "notes": gp.notes,
        }
        for gp in goods_purchases
    ]

    # 2. Related Posted Service Purchases
    service_purchases = list(
        models.GoodsPurchase.objects.filter(
            Q(purchase_order=order) | Q(lines__order_line__order=order),
            status="POSTED",
            purchase_type=models.GoodsPurchase.PurchaseType.SERVICE,
        ).distinct()
    )
    service_receipts_data = [
        {
            "id": sp.id,
            "document_type": "SERVICE_PURCHASE",
            "document_type_display": "Mua dịch vụ",
            "number": sp.number,
            "document_date": sp.document_date,
            "status": sp.status,
            "pre_tax_amount": sp.subtotal - sp.discount_amount,
            "total_amount": sp.total_amount,
            "notes": sp.notes,
        }
        for sp in service_purchases
    ]

    # 3. Related Posted Returns
    returns = list(
        models.PurchaseReturn.objects.filter(
            Q(original_purchase__purchase_order=order) | Q(lines__original_line__order_line__order=order),
            status="POSTED",
        ).distinct()
    )
    returns_data = [
        {
            "id": ret.id,
            "document_type": "PURCHASE_RETURN",
            "document_type_display": "Hàng mua trả lại",
            "number": ret.number,
            "document_date": ret.document_date,
            "status": ret.status,
            "pre_tax_amount": ret.subtotal - ret.discount_amount,
            "total_amount": ret.total_amount,
            "reason": ret.reason,
        }
        for ret in returns
    ]

    # 4. Related Posted Discounts
    discounts = list(
        models.PurchaseDiscount.objects.filter(
            Q(original_purchase__purchase_order=order) | Q(lines__original_line__order_line__order=order),
            status="POSTED",
        ).distinct()
    )
    discounts_data = [
        {
            "id": disc.id,
            "document_type": "PURCHASE_DISCOUNT",
            "document_type_display": "Giảm giá hàng mua",
            "number": disc.number,
            "document_date": disc.document_date,
            "status": disc.status,
            "pre_tax_amount": disc.pre_tax_amount,
            "total_amount": disc.total_amount,
            "reason": disc.reason,
        }
        for disc in discounts
    ]

    # 5. Related Valid Input Invoices
    invoices = get_order_linked_invoices(order)
    invoices_data = [
        {
            "id": inv.id,
            "document_type": "SUPPLIER_INVOICE",
            "document_type_display": "Hóa đơn đầu vào",
            "series": inv.invoice_series,
            "number": inv.invoice_number,
            "document_date": inv.invoice_date,
            "status": inv.status,
            "validation_status": inv.validation_status,
            "pre_tax_amount": inv.subtotal - inv.discount_amount,
            "total_amount": inv.total_amount,
            "notes": inv.notes,
        }
        for inv in invoices
    ]

    has_execution_documents = bool(goods_purchases or service_purchases or returns or discounts)
    execution_message = "" if has_execution_documents else "Đơn mua chưa phát sinh chứng từ thực hiện."

    # 6. Chronological Progress History / Timeline (Step 31)
    timeline = []

    # PO Event
    timeline.append({
        "document_date": order.document_date,
        "created_at": order.created_at,
        "document_type": "PURCHASE_ORDER",
        "document_type_display": "Đơn mua",
        "document_number": order.number,
        "document_id": str(order.id),
        "description": order.notes or f"Lập đơn mua hàng {order.number}",
        "pre_tax_amount": summary["total_pre_tax_amount"],
        "amount": order.total_amount,
    })

    # Goods Purchase Events
    for gp in goods_purchases:
        timeline.append({
            "document_date": gp.document_date,
            "created_at": gp.created_at,
            "document_type": "GOODS_PURCHASE",
            "document_type_display": "Mua hàng hóa",
            "document_number": gp.number,
            "document_id": str(gp.id),
            "description": gp.notes or f"Ghi nhận mua hàng hóa theo đơn {order.number}",
            "pre_tax_amount": gp.subtotal - gp.discount_amount,
            "amount": gp.total_amount,
        })

    # Service Purchase Events
    for sp in service_purchases:
        timeline.append({
            "document_date": sp.document_date,
            "created_at": sp.created_at,
            "document_type": "SERVICE_PURCHASE",
            "document_type_display": "Mua dịch vụ",
            "document_number": sp.number,
            "document_id": str(sp.id),
            "description": sp.notes or f"Nghiệm thu mua dịch vụ theo đơn {order.number}",
            "pre_tax_amount": sp.subtotal - sp.discount_amount,
            "amount": sp.total_amount,
        })

    # Return Events
    for ret in returns:
        timeline.append({
            "document_date": ret.document_date,
            "created_at": ret.created_at,
            "document_type": "PURCHASE_RETURN",
            "document_type_display": "Hàng mua trả lại",
            "document_number": ret.number,
            "document_id": str(ret.id),
            "description": ret.reason or f"Trả lại hàng mua đơn {order.number}",
            "pre_tax_amount": -(ret.subtotal - ret.discount_amount),
            "amount": -ret.total_amount,
        })

    # Discount Events
    for disc in discounts:
        timeline.append({
            "document_date": disc.document_date,
            "created_at": disc.created_at,
            "document_type": "PURCHASE_DISCOUNT",
            "document_type_display": "Giảm giá hàng mua",
            "document_number": disc.number,
            "document_id": str(disc.id),
            "description": disc.reason or f"Giảm giá hàng mua đơn {order.number}",
            "pre_tax_amount": -disc.pre_tax_amount,
            "amount": -disc.total_amount,
        })

    # Invoice Events
    for inv in invoices:
        timeline.append({
            "document_date": inv.invoice_date,
            "created_at": inv.created_at,
            "document_type": "SUPPLIER_INVOICE",
            "document_type_display": "Hóa đơn đầu vào",
            "document_number": f"{inv.invoice_series}/{inv.invoice_number}",
            "document_id": str(inv.id),
            "description": inv.notes or f"Tiếp nhận hóa đơn {inv.invoice_number}",
            "pre_tax_amount": inv.subtotal - inv.discount_amount,
            "amount": inv.total_amount,
        })

    # Sort timeline chronologically
    timeline.sort(key=lambda item: (item["document_date"], item.get("created_at") or timezone.now()))

    return {
        "order": {
            "id": order.id,
            "number": order.number,
            "document_date": order.document_date,
            "delivery_date": order.delivery_date,
            "status": order.status,
            "status_display": summary["status_display"],
            "supplier": summary["supplier"],
            "buyer": summary["buyer"],
            "currency": summary["currency"],
            "subtotal": order.subtotal,
            "discount_amount": order.discount_amount,
            "total_pre_tax_amount": summary["total_pre_tax_amount"],
            "total_amount": order.total_amount,
            "notes": order.notes,
        },
        "summary": summary,
        "lines": summary["lines_tracking"],
        "has_execution_documents": has_execution_documents,
        "execution_message": execution_message,
        "related_documents": {
            "goods_receipts": goods_receipts_data,
            "service_receipts": service_receipts_data,
            "returns": returns_data,
            "discounts": discounts_data,
            "invoices": invoices_data,
        },
        "timeline": timeline,
    }


def generate_tracking_export_csv(summaries):
    """
    Generate CSV file in UTF-8-sig format matching table 1.2 and BR-PUR-TRK-36.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Headers according to section 1.2
    writer.writerow([
        "Mã đơn mua",
        "Ngày đặt hàng",
        "Nhà cung cấp",
        "Người phụ trách",
        "Tổng giá trị đơn",
        "Ngày dự kiến nhận",
        "Tiến độ thực hiện (%)",
        "Trạng thái nhận hàng",
        "Trạng thái hóa đơn",
        "Quá hạn",
        "Số ngày quá hạn",
        "Trạng thái đơn",
    ])

    for s in summaries:
        supplier_name = s["supplier"]["name"] if s.get("supplier") else ""
        buyer_name = s["buyer"]["name"] if s.get("buyer") else ""
        writer.writerow([
            s["number"],
            str(s["document_date"]),
            supplier_name,
            buyer_name,
            str(s["total_pre_tax_amount"]),
            str(s["delivery_date"]) if s["delivery_date"] else "",
            str(s["progress_percent"]),
            s["receiving_status_display"],
            s["invoicing_status_display"],
            "Có" if s["is_overdue"] else "Không",
            s["overdue_days"],
            s["status_display"],
        ])

    return output.getvalue().encode("utf-8-sig")
