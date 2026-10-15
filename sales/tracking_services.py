import csv
from decimal import Decimal
import io
from datetime import date

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts_receivable.models import Receivable, ReceivableStatus
from . import models


ORDER_STATUS_LABELS = {
    "DRAFT": "Bản nháp",
    "PENDING_APPROVAL": "Chờ duyệt",
    "APPROVED": "Đã xác nhận",
    "CLOSED": "Đã đóng",
    "CANCELLED": "Đã hủy",
}

FULFILLMENT_STATUS_LABELS = {
    "NOT_STARTED": "Chưa thực hiện",
    "PARTIALLY_FULFILLED": "Thực hiện một phần",
    "FULFILLED": "Hoàn tất",
    "CLOSED_REMAINDER": "Kết thúc phần còn lại",
}

SALES_STATUS_LABELS = {
    "NOT_RECORDED": "Chưa ghi nhận",
    "PARTIALLY_RECORDED": "Ghi nhận một phần",
    "FULLY_RECORDED": "Đã ghi nhận đủ",
}

INVOICING_STATUS_LABELS = {
    "NOT_READY": "Chưa đến bước lập hóa đơn",
    "NOT_INVOICED": "Chưa lập",
    "PARTIALLY_INVOICED": "Lập một phần",
    "FULLY_INVOICED": "Đã lập đủ",
}

PAYMENT_STATUS_LABELS = {
    "NO_RECEIVABLE": "Chưa phát sinh phải thu",
    "UNPAID": "Chưa thanh toán",
    "PARTIALLY_PAID": "Thanh toán một phần",
    "PAID": "Đã thanh toán đủ",
    "SETTLED_BY_CREDIT": "Không còn phải thu",
}


def validate_date_filters(params):
    """Validate date ranges according to EF-03 / business rules."""
    order_date_from = params.get("order_date_from")
    order_date_to = params.get("order_date_to")
    if order_date_from and order_date_to and str(order_date_from) > str(order_date_to):
        raise ValidationError("Ngày bắt đầu không được lớn hơn ngày kết thúc.")

    delivery_date_from = params.get("delivery_date_from") or params.get("expected_delivery_date_from")
    delivery_date_to = params.get("delivery_date_to") or params.get("expected_delivery_date_to")
    if delivery_date_from and delivery_date_to and str(delivery_date_from) > str(delivery_date_to):
        raise ValidationError("Ngày bắt đầu không được lớn hơn ngày kết thúc.")


def get_order_tracking_queryset(company, params):
    """
    Build filtered queryset for sales order tracking.
    Pre-condition: Đơn bán đã được xác nhận (APPROVED, CLOSED, or CANCELLED after confirmation).
    Excludes unconfirmed DRAFT, PENDING_APPROVAL, and REJECTED orders.
    """
    validate_date_filters(params)

    qs = models.SalesOrder.objects.filter(company=company).exclude(
        status__in=[
            models.DocumentStatus.DRAFT,
            models.DocumentStatus.PENDING_APPROVAL,
            models.DocumentStatus.REJECTED,
        ]
    )

    code = params.get("code") or params.get("number")
    if code:
        qs = qs.filter(number__icontains=code.strip())

    customer_id = params.get("customer_id") or params.get("customer")
    if customer_id:
        qs = qs.filter(customer_id=customer_id)

    employee_id = (
        params.get("employee_id")
        or params.get("assigned_employee_id")
        or params.get("assigned_employee")
    )
    if employee_id:
        qs = qs.filter(assigned_employee_id=employee_id)

    branch_id = params.get("branch_id") or params.get("branch")
    if branch_id:
        qs = qs.filter(branch_id=branch_id)

    order_date_from = params.get("order_date_from")
    if order_date_from:
        qs = qs.filter(document_date__gte=order_date_from)

    order_date_to = params.get("order_date_to")
    if order_date_to:
        qs = qs.filter(document_date__lte=order_date_to)

    delivery_date_from = params.get("delivery_date_from") or params.get("expected_delivery_date_from")
    if delivery_date_from:
        qs = qs.filter(requested_delivery_date__gte=delivery_date_from)

    delivery_date_to = params.get("delivery_date_to") or params.get("expected_delivery_date_to")
    if delivery_date_to:
        qs = qs.filter(requested_delivery_date__lte=delivery_date_to)

    order_status = params.get("order_status") or params.get("status")
    if order_status:
        qs = qs.filter(status=order_status)

    return qs.select_related(
        "company", "branch", "customer", "currency", "assigned_employee", "payment_term"
    ).prefetch_related(
        "lines__item", "lines__uom", "lines__warehouse",
    ).order_by("-document_date", "-created_at")


def compute_order_line_tracking(line, today=None):
    """Calculate granular tracking indicators for a single SalesOrderLine."""
    if today is None:
        today = timezone.localdate()

    order = line.order
    ordered_qty = Decimal(str(line.quantity or 0))
    unit_price = Decimal(str(line.unit_price or 0))
    closed_qty = Decimal(str(line.closed_quantity if line.closed_quantity > 0 else line.cancelled_quantity or 0))
    effective_ordered_qty = max(ordered_qty - closed_qty, Decimal("0"))

    # 1. Delivery / Fulfillment tracking (BR-SAL-09-03)
    delivery_lines = models.SalesDeliveryLine.objects.filter(
        order_line=line, delivery__status=models.DeliveryStatus.CONFIRMED
    )
    delivery_sum = sum((Decimal(str(dl.quantity or 0)) for dl in delivery_lines), Decimal("0"))
    delivered_quantity = max(delivery_sum, Decimal(str(line.delivered_quantity or 0)))
    remaining_quantity = max(ordered_qty - delivered_quantity - closed_qty, Decimal("0"))

    # Fulfillment status
    if delivered_quantity == Decimal("0") and closed_qty == Decimal("0"):
        fulfillment_status = "NOT_STARTED"
    elif delivered_quantity > Decimal("0") and remaining_quantity > Decimal("0"):
        fulfillment_status = "PARTIALLY_FULFILLED"
    elif remaining_quantity <= Decimal("0") and closed_qty == Decimal("0") and delivered_quantity >= ordered_qty:
        fulfillment_status = "FULFILLED"
    elif closed_qty > Decimal("0") and remaining_quantity <= Decimal("0"):
        fulfillment_status = "CLOSED_REMAINDER"
    elif delivered_quantity == Decimal("0") and closed_qty >= ordered_qty:
        fulfillment_status = "CLOSED_REMAINDER"
    else:
        fulfillment_status = "PARTIALLY_FULFILLED"

    # 2. Sales Recording (BR-SAL-09-05: Only POSTED documents)
    goods_lines = models.GoodsSaleLine.objects.filter(
        order_line=line, sale__status=models.DocumentStatus.POSTED
    )
    goods_qty = sum((Decimal(str(gl.quantity or 0)) for gl in goods_lines), Decimal("0"))

    service_lines = models.ServiceSaleLine.objects.filter(
        order_line=line, sale__status=models.DocumentStatus.POSTED
    )
    service_qty = sum((Decimal(str(sl.quantity or 0)) for sl in service_lines), Decimal("0"))

    recorded_sales_quantity = goods_qty + service_qty

    if recorded_sales_quantity == Decimal("0"):
        sales_status = "NOT_RECORDED"
    elif Decimal("0") < recorded_sales_quantity < effective_ordered_qty:
        sales_status = "PARTIALLY_RECORDED"
    elif recorded_sales_quantity >= effective_ordered_qty and effective_ordered_qty > Decimal("0"):
        sales_status = "FULLY_RECORDED"
    elif effective_ordered_qty == Decimal("0") and recorded_sales_quantity == Decimal("0"):
        sales_status = "NOT_RECORDED"
    else:
        sales_status = "FULLY_RECORDED"

    # 3. Invoicing (BR-SAL-09-05, BR-SAL-09-06)
    # Direct order_line links or indirect via goods/service lines
    inv_lines_issued = models.SalesInvoiceLine.objects.filter(
        Q(order_line=line) | Q(goods_sale_line__order_line=line) | Q(service_sale_line__order_line=line),
        invoice__status=models.SalesInvoice.Status.ISSUED,
    ).distinct()
    invoiced_quantity = max(
        sum((Decimal(str(il.quantity or 0)) for il in inv_lines_issued), Decimal("0")),
        Decimal(str(line.invoiced_quantity or 0)),
    )

    inv_lines_pending = models.SalesInvoiceLine.objects.filter(
        Q(order_line=line) | Q(goods_sale_line__order_line=line) | Q(service_sale_line__order_line=line),
        invoice__status__in=[
            models.DocumentStatus.DRAFT,
            models.DocumentStatus.PENDING_APPROVAL,
            models.DocumentStatus.APPROVED,
            models.SalesInvoice.Status.ISSUING,
        ],
    ).distinct()
    pending_invoice_quantity = sum((Decimal(str(il.quantity or 0)) for il in inv_lines_pending), Decimal("0"))

    # Required invoice qty based on policy (BR-SAL-09-06)
    invoicing_policy = getattr(order, "invoicing_policy", "ORDER")
    if invoicing_policy == "DELIVERY":
        required_invoice_qty = delivered_quantity
        if delivered_quantity == Decimal("0"):
            invoicing_status = "NOT_READY"
        elif invoiced_quantity == Decimal("0"):
            invoicing_status = "NOT_INVOICED"
        elif Decimal("0") < invoiced_quantity < required_invoice_qty:
            invoicing_status = "PARTIALLY_INVOICED"
        elif invoiced_quantity >= required_invoice_qty and required_invoice_qty > Decimal("0"):
            invoicing_status = "FULLY_INVOICED"
        else:
            invoicing_status = "NOT_INVOICED"
    else:
        required_invoice_qty = effective_ordered_qty
        if invoiced_quantity == Decimal("0"):
            invoicing_status = "NOT_INVOICED"
        elif Decimal("0") < invoiced_quantity < required_invoice_qty:
            invoicing_status = "PARTIALLY_INVOICED"
        elif invoiced_quantity >= required_invoice_qty and required_invoice_qty > Decimal("0"):
            invoicing_status = "FULLY_INVOICED"
        elif required_invoice_qty == Decimal("0") and invoiced_quantity == Decimal("0"):
            invoicing_status = "NOT_INVOICED"
        else:
            invoicing_status = "NOT_INVOICED"

    # 4. Returns & Allowances
    return_lines = models.SalesReturnLine.objects.filter(
        goods_sale_line__order_line=line,
        sale_return__status=models.DocumentStatus.POSTED,
    )
    returned_quantity = sum((Decimal(str(rl.return_quantity or 0)) for rl in return_lines), Decimal("0"))

    allowance_lines = models.SalesAllowanceLine.objects.filter(
        Q(goods_sale_line__order_line=line) | Q(service_sale_line__order_line=line),
        allowance__status=models.DocumentStatus.POSTED,
    )
    allowance_amount = sum(
        (Decimal(str(getattr(al, "allowance_amount", getattr(al, "net_sales_value", 0)) or 0)) for al in allowance_lines),
        Decimal("0"),
    )

    # Overdue delivery check (BR-SAL-09-10)
    line_delivery_date = getattr(line, "delivery_date", None) or order.requested_delivery_date
    is_delivery_overdue = False
    if line_delivery_date and today > line_delivery_date and remaining_quantity > Decimal("0"):
        is_delivery_overdue = True

    # Related documents ids for quick deep-linking
    related_docs = {
        "deliveries": list(delivery_lines.values_list("delivery_id", flat=True).distinct()),
        "goods_sales": list(goods_lines.values_list("sale_id", flat=True).distinct()),
        "service_sales": list(service_lines.values_list("sale_id", flat=True).distinct()),
        "sales_invoices": list(inv_lines_issued.values_list("invoice_id", flat=True).distinct()),
        "sales_returns": list(return_lines.values_list("sale_return_id", flat=True).distinct()),
        "sales_allowances": list(allowance_lines.values_list("allowance_id", flat=True).distinct()),
    }

    return {
        "line_id": str(line.id),
        "line_no": line.line_no,
        "item_id": str(line.item_id) if line.item_id else None,
        "item_code": line.item.code if line.item else "",
        "item_name": line.item.name if line.item else line.description,
        "item_type": getattr(line.item, "item_type", "GOODS") if line.item else "GOODS",
        "uom_id": str(line.uom_id) if line.uom_id else None,
        "uom_name": line.uom.name if line.uom else "",
        "warehouse_id": str(line.warehouse_id) if line.warehouse_id else None,
        "warehouse_name": line.warehouse.name if line.warehouse else "",
        "quantity": str(ordered_qty),
        "unit_price": str(unit_price),
        "discount_amount": str(line.discount_amount or Decimal("0")),
        "tax_amount": str(line.tax_amount or Decimal("0")),
        "line_total": str(line.line_total or Decimal("0")),
        "delivered_quantity": str(delivered_quantity),
        "closed_quantity": str(closed_qty),
        "remaining_quantity": str(remaining_quantity),
        "recorded_sales_quantity": str(recorded_sales_quantity),
        "invoiced_quantity": str(invoiced_quantity),
        "pending_invoice_quantity": str(pending_invoice_quantity),
        "returned_quantity": str(returned_quantity),
        "allowance_amount": str(allowance_amount),
        "delivery_date": str(line_delivery_date) if line_delivery_date else None,
        "fulfillment_status": fulfillment_status,
        "fulfillment_label": FULFILLMENT_STATUS_LABELS.get(fulfillment_status, fulfillment_status),
        "sales_status": sales_status,
        "sales_label": SALES_STATUS_LABELS.get(sales_status, sales_status),
        "invoicing_status": invoicing_status,
        "invoicing_label": INVOICING_STATUS_LABELS.get(invoicing_status, invoicing_status),
        "is_delivery_overdue": is_delivery_overdue,
        "related_documents": {k: [str(x) for x in v] for k, v in related_docs.items()},
    }


def compute_order_tracking_summary(order, today=None):
    """
    Compute comprehensive order-level tracking indicators for lists and summaries.
    Enforces BR-SAL-09-02..14.
    """
    if today is None:
        today = timezone.localdate()

    lines = list(order.lines.all().order_by("line_no"))
    lines_metrics = [compute_order_line_tracking(l, today=today) for l in lines]

    # Sum quantities
    total_ordered_qty = sum((Decimal(lm["quantity"]) for lm in lines_metrics), Decimal("0"))
    total_delivered_qty = sum((Decimal(lm["delivered_quantity"]) for lm in lines_metrics), Decimal("0"))
    total_closed_qty = sum((Decimal(lm["closed_quantity"]) for lm in lines_metrics), Decimal("0"))
    total_remaining_qty = sum((Decimal(lm["remaining_quantity"]) for lm in lines_metrics), Decimal("0"))
    total_recorded_sales_qty = sum((Decimal(lm["recorded_sales_quantity"]) for lm in lines_metrics), Decimal("0"))
    total_invoiced_qty = sum((Decimal(lm["invoiced_quantity"]) for lm in lines_metrics), Decimal("0"))
    total_pending_inv_qty = sum((Decimal(lm["pending_invoice_quantity"]) for lm in lines_metrics), Decimal("0"))
    total_returned_qty = sum((Decimal(lm["returned_quantity"]) for lm in lines_metrics), Decimal("0"))
    total_allowance_amt = sum((Decimal(lm["allowance_amount"]) for lm in lines_metrics), Decimal("0"))

    # 1. Fulfillment status & rate
    effective_ordered_qty = max(total_ordered_qty - total_closed_qty, Decimal("0"))
    if not lines_metrics or (total_delivered_qty == Decimal("0") and total_closed_qty == Decimal("0")):
        fulfillment_status = "NOT_STARTED"
        fulfillment_rate = Decimal("0.00")
    elif total_closed_qty > Decimal("0") and total_remaining_qty <= Decimal("0"):
        fulfillment_status = "CLOSED_REMAINDER"
        fulfillment_rate = Decimal("100.00")
    elif all(lm["fulfillment_status"] == "FULFILLED" for lm in lines_metrics):
        fulfillment_status = "FULFILLED"
        fulfillment_rate = Decimal("100.00")
    else:
        fulfillment_status = "PARTIALLY_FULFILLED"
        fulfillment_rate = (
            min(Decimal("100.00"), round((total_delivered_qty / effective_ordered_qty) * Decimal("100"), 2))
            if effective_ordered_qty > Decimal("0")
            else Decimal("100.00")
        )

    # 2. Sales Recording status & rate
    if not lines_metrics or total_recorded_sales_qty == Decimal("0"):
        sales_status = "NOT_RECORDED"
        sales_rate = Decimal("0.00")
    elif all(lm["sales_status"] == "FULLY_RECORDED" for lm in lines_metrics):
        sales_status = "FULLY_RECORDED"
        sales_rate = Decimal("100.00")
    else:
        sales_status = "PARTIALLY_RECORDED"
        sales_rate = (
            min(Decimal("100.00"), round((total_recorded_sales_qty / effective_ordered_qty) * Decimal("100"), 2))
            if effective_ordered_qty > Decimal("0")
            else Decimal("100.00")
        )

    # 3. Invoicing status & rate
    invoicing_policy = getattr(order, "invoicing_policy", "ORDER")
    if invoicing_policy == "DELIVERY" and total_delivered_qty == Decimal("0"):
        invoicing_status = "NOT_READY"
        invoicing_rate = Decimal("0.00")
    elif not lines_metrics or total_invoiced_qty == Decimal("0"):
        invoicing_status = "NOT_INVOICED"
        invoicing_rate = Decimal("0.00")
    elif all(lm["invoicing_status"] == "FULLY_INVOICED" for lm in lines_metrics):
        invoicing_status = "FULLY_INVOICED"
        invoicing_rate = Decimal("100.00")
    else:
        invoicing_status = "PARTIALLY_INVOICED"
        base_inv_qty = total_delivered_qty if invoicing_policy == "DELIVERY" else effective_ordered_qty
        invoicing_rate = (
            min(Decimal("100.00"), round((total_invoiced_qty / base_inv_qty) * Decimal("100"), 2))
            if base_inv_qty > Decimal("0")
            else Decimal("100.00")
        )

    # 4. Receivables & Payment status (BR-SAL-09-07, BR-SAL-09-08, BR-SAL-09-09)
    posted_goods_sales = models.GoodsSale.objects.filter(sales_order=order, status=models.DocumentStatus.POSTED)
    posted_service_sales = models.ServiceSale.objects.filter(
        lines__order_line__order=order, status=models.DocumentStatus.POSTED
    ).distinct()

    total_receivable_incurred = sum(
        (Decimal(str(gs.total_amount or 0)) for gs in posted_goods_sales), Decimal("0")
    ) + sum((Decimal(str(ss.total_amount or 0)) for ss in posted_service_sales), Decimal("0"))

    # Deductions from returns & allowances
    posted_returns = models.SalesReturn.objects.filter(
        goods_sale__sales_order=order, status=models.DocumentStatus.POSTED
    )
    return_reduction = sum((Decimal(str(r.total_amount or 0)) for r in posted_returns), Decimal("0"))

    posted_allowances = models.SalesAllowance.objects.filter(
        Q(goods_sale__sales_order=order) | Q(service_sale__lines__order_line__order=order),
        status=models.DocumentStatus.POSTED,
    ).distinct()
    allowance_reduction = sum((Decimal(str(a.total_amount or 0)) for a in posted_allowances), Decimal("0"))
    total_deductions = return_reduction + allowance_reduction

    # Allocated / collected amounts
    direct_cash_collections = sum(
        (Decimal(str(gs.total_amount or 0)) for gs in posted_goods_sales if gs.payment_type in ["CASH", "BANK"]),
        Decimal("0"),
    ) + sum(
        (Decimal(str(ss.total_amount or 0)) for ss in posted_service_sales if ss.payment_type in ["CASH", "BANK"]),
        Decimal("0"),
    )

    receivable_collections = Decimal("0")
    for gs in posted_goods_sales:
        if getattr(gs, "receivable", None):
            receivable_collections += Decimal(str(gs.receivable.collected_amount or 0))
    for ss in posted_service_sales:
        if getattr(ss, "receivable", None):
            receivable_collections += Decimal(str(ss.receivable.collected_amount or 0))

    total_collected_amount = max(
        direct_cash_collections + receivable_collections,
        Decimal(str(order.collected_amount or 0)),
    )
    net_receivable = max(total_receivable_incurred - total_deductions, Decimal("0"))
    remaining_receivable_amount = max(net_receivable - total_collected_amount, Decimal("0"))

    # Payment Status Determination
    if total_receivable_incurred == Decimal("0") and total_collected_amount == Decimal("0"):
        payment_status = "NO_RECEIVABLE"
        payment_rate = Decimal("0.00")
    elif remaining_receivable_amount <= Decimal("0"):
        if total_collected_amount >= total_receivable_incurred and total_receivable_incurred > Decimal("0"):
            payment_status = "PAID"
        else:
            payment_status = "SETTLED_BY_CREDIT"
        payment_rate = Decimal("100.00")
    elif total_collected_amount == Decimal("0"):
        payment_status = "UNPAID"
        payment_rate = Decimal("0.00")
    else:
        payment_status = "PARTIALLY_PAID"
        payment_rate = (
            min(Decimal("100.00"), round((total_collected_amount / net_receivable) * Decimal("100"), 2))
            if net_receivable > Decimal("0")
            else Decimal("100.00")
        )

    # 5. Overdue and Warning Checks (BR-SAL-09-10)
    delivery_overdue = False
    if order.requested_delivery_date and today > order.requested_delivery_date and total_remaining_qty > Decimal("0"):
        delivery_overdue = True

    # Check payment overdue
    payment_due_date = None
    if getattr(order, "payment_term", None) and getattr(order.payment_term, "due_days", None):
        payment_due_date = order.document_date + timezone.timedelta(days=int(order.payment_term.due_days))

    # Also check receivable due_date
    for gs in posted_goods_sales:
        if getattr(gs, "due_date", None):
            payment_due_date = gs.due_date
            break
        if getattr(gs, "receivable", None) and getattr(gs.receivable, "due_date", None):
            payment_due_date = gs.receivable.due_date
            break

    payment_overdue = False
    if payment_due_date and today > payment_due_date and remaining_receivable_amount > Decimal("0"):
        payment_overdue = True

    warning_messages = []
    if delivery_overdue:
        warning_messages.append("Quá hạn giao hàng/hoàn thành dịch vụ.")
    if payment_overdue:
        warning_messages.append("Quá hạn thanh toán công nợ.")
    if total_delivered_qty > total_ordered_qty:
        warning_messages.append("Số lượng giao hàng vượt quá số lượng đặt.")

    return {
        "order_id": str(order.id),
        "number": order.number,
        "document_date": str(order.document_date),
        "requested_delivery_date": str(order.requested_delivery_date) if order.requested_delivery_date else None,
        "customer_id": str(order.customer_id) if order.customer_id else None,
        "customer_code": getattr(order.customer, "code", "") if order.customer else "",
        "customer_name": order.customer.name if order.customer else "",
        "branch_id": str(order.branch_id) if order.branch_id else None,
        "branch_name": order.branch.name if order.branch else "",
        "assigned_employee_id": str(order.assigned_employee_id) if order.assigned_employee_id else None,
        "assigned_employee_name": getattr(order.assigned_employee, "full_name", "") if order.assigned_employee else "",
        "currency_code": getattr(order.currency, "code", "VND") if order.currency else "VND",
        "total_amount": str(order.total_amount or Decimal("0")),
        "order_status": order.status,
        "order_status_label": ORDER_STATUS_LABELS.get(order.status, order.status),
        "invoicing_policy": invoicing_policy,
        "fulfillment_status": fulfillment_status,
        "fulfillment_label": FULFILLMENT_STATUS_LABELS.get(fulfillment_status, fulfillment_status),
        "fulfillment_rate": fulfillment_rate,
        "sales_status": sales_status,
        "sales_label": SALES_STATUS_LABELS.get(sales_status, sales_status),
        "sales_rate": sales_rate,
        "invoicing_status": invoicing_status,
        "invoicing_label": INVOICING_STATUS_LABELS.get(invoicing_status, invoicing_status),
        "invoicing_rate": invoicing_rate,
        "payment_status": payment_status,
        "payment_label": PAYMENT_STATUS_LABELS.get(payment_status, payment_status),
        "payment_rate": payment_rate,
        "total_ordered_quantity": str(total_ordered_qty),
        "total_delivered_quantity": str(total_delivered_qty),
        "total_closed_quantity": str(total_closed_qty),
        "total_remaining_quantity": str(total_remaining_qty),
        "total_recorded_sales_quantity": str(total_recorded_sales_qty),
        "total_invoiced_quantity": str(total_invoiced_qty),
        "total_pending_invoice_quantity": str(total_pending_inv_qty),
        "total_returned_quantity": str(total_returned_qty),
        "total_allowance_amount": str(total_allowance_amt),
        "total_receivable_incurred": str(total_receivable_incurred),
        "total_collected_amount": str(total_collected_amount),
        "remaining_receivable_amount": str(remaining_receivable_amount),
        "delivery_overdue": delivery_overdue,
        "payment_overdue": payment_overdue,
        "has_warning": bool(warning_messages),
        "warning_messages": warning_messages,
        "_lines_metrics": lines_metrics,
        "_payment_due_date": payment_due_date,
        "_posted_goods_sales": posted_goods_sales,
        "_posted_service_sales": posted_service_sales,
        "_posted_returns": posted_returns,
        "_posted_allowances": posted_allowances,
        "_total_deductions": total_deductions,
    }


def filter_summaries_by_computed_fields(summaries, params):
    """Filter in-memory computed summaries by calculated metrics (fulfillment, sales, invoice, payment, overdue)."""
    res = summaries

    ff = params.get("fulfillment_status")
    if ff:
        res = [s for s in res if s["fulfillment_status"] == ff]

    sf = params.get("sales_status")
    if sf:
        res = [s for s in res if s["sales_status"] == sf]

    inf = params.get("invoicing_status")
    if inf:
        res = [s for s in res if s["invoicing_status"] == inf]

    pf = params.get("payment_status")
    if pf:
        res = [s for s in res if s["payment_status"] == pf]

    overdue_type = params.get("overdue_type")
    if overdue_type == "DELIVERY_OVERDUE":
        res = [s for s in res if s["delivery_overdue"]]
    elif overdue_type == "PAYMENT_OVERDUE":
        res = [s for s in res if s["payment_overdue"]]
    elif overdue_type == "ANY_OVERDUE":
        res = [s for s in res if s["delivery_overdue"] or s["payment_overdue"]]

    is_overdue = params.get("is_overdue")
    if is_overdue in ["true", "1", True]:
        res = [s for s in res if s["delivery_overdue"] or s["payment_overdue"]]

    return res


def compute_order_tracking_detail(order, today=None):
    """
    Build complete tracking detail payload according to 3 Tab UI structure (Steps 3-6).
    Tab 1: Giao hàng/Dịch vụ
    Tab 2: Bán hàng & Hóa đơn
    Tab 3: Thanh toán
    """
    summary = compute_order_tracking_summary(order, today=today)
    lines_metrics = summary["_lines_metrics"]

    # 1. Tab Delivery
    deliveries_qs = models.SalesDelivery.objects.filter(order=order).select_related(
        "warehouse", "confirmed_by"
    ).order_by("-delivery_date", "-created_at")
    deliveries_list = [
        {
            "id": str(d.id),
            "number": d.number,
            "delivery_date": str(d.delivery_date),
            "delivery_type": d.delivery_type,
            "delivery_type_name": "Hàng hóa" if d.delivery_type == "GOODS" else "Dịch vụ",
            "warehouse_name": d.warehouse.name if d.warehouse else "",
            "delivery_address": d.delivery_address,
            "status": d.status,
            "confirmed_at": d.confirmed_at.isoformat() if d.confirmed_at else None,
            "confirmed_by_name": getattr(d.confirmed_by, "display_name", str(d.confirmed_by)) if d.confirmed_by else "",
            "inventory_reference": d.inventory_reference,
            "acceptance_reference": d.acceptance_reference,
        }
        for d in deliveries_qs
    ]

    delivery_tab = {
        "lines": lines_metrics,
        "deliveries": deliveries_list,
        "summary": {
            "total_ordered_quantity": summary["total_ordered_quantity"],
            "total_delivered_quantity": summary["total_delivered_quantity"],
            "total_closed_quantity": summary["total_closed_quantity"],
            "total_remaining_quantity": summary["total_remaining_quantity"],
            "fulfillment_rate": summary["fulfillment_rate"],
            "fulfillment_status": summary["fulfillment_status"],
            "fulfillment_label": summary["fulfillment_label"],
            "delivery_overdue": summary["delivery_overdue"],
        },
    }

    # 2. Tab Sales & Invoice
    goods_sales_qs = models.GoodsSale.objects.filter(sales_order=order).order_by("-document_date")
    goods_sales_list = [
        {
            "id": str(gs.id),
            "number": gs.number,
            "document_date": str(gs.document_date),
            "status": gs.status,
            "total_amount": str(gs.total_amount),
            "payment_type": gs.payment_type,
            "inventory_handling": gs.inventory_handling,
        }
        for gs in goods_sales_qs
    ]

    service_sales_qs = models.ServiceSale.objects.filter(
        lines__order_line__order=order
    ).distinct().order_by("-document_date")
    service_sales_list = [
        {
            "id": str(ss.id),
            "number": ss.number,
            "document_date": str(ss.document_date),
            "status": ss.status,
            "total_amount": str(ss.total_amount),
            "payment_type": ss.payment_type,
        }
        for ss in service_sales_qs
    ]

    invoices_qs = models.SalesInvoice.objects.filter(
        Q(sales_order=order) | Q(lines__order_line__order=order)
    ).distinct().order_by("-invoice_date")
    invoices_list = [
        {
            "id": str(inv.id),
            "number": inv.number,
            "invoice_number": inv.invoice_number,
            "invoice_series": inv.invoice_series,
            "invoice_date": str(inv.invoice_date),
            "status": inv.status,
            "total_amount": str(inv.total_amount),
            "issued_at": inv.issued_at.isoformat() if inv.issued_at else None,
            "lookup_code": inv.lookup_code,
        }
        for inv in invoices_qs
    ]

    returns_list = [
        {
            "id": str(r.id),
            "number": r.number,
            "document_date": str(r.document_date),
            "status": r.status,
            "total_amount": str(r.total_amount),
            "return_reason": r.return_reason,
        }
        for r in summary["_posted_returns"]
    ]

    allowances_list = [
        {
            "id": str(a.id),
            "number": a.number,
            "document_date": str(a.document_date),
            "status": a.status,
            "total_amount": str(a.total_amount),
            "allowance_reason": a.allowance_reason,
        }
        for a in summary["_posted_allowances"]
    ]

    sales_invoice_tab = {
        "lines": lines_metrics,
        "goods_sales": goods_sales_list,
        "service_sales": service_sales_list,
        "sales_invoices": invoices_list,
        "sales_returns": returns_list,
        "sales_allowances": allowances_list,
        "summary": {
            "total_recorded_sales_quantity": summary["total_recorded_sales_quantity"],
            "total_invoiced_quantity": summary["total_invoiced_quantity"],
            "total_pending_invoice_quantity": summary["total_pending_invoice_quantity"],
            "total_returned_quantity": summary["total_returned_quantity"],
            "total_allowance_amount": summary["total_allowance_amount"],
            "sales_status": summary["sales_status"],
            "sales_label": summary["sales_label"],
            "invoicing_status": summary["invoicing_status"],
            "invoicing_label": summary["invoicing_label"],
        },
    }

    # 3. Tab Payment
    receivables_list = []
    for gs in summary["_posted_goods_sales"]:
        if getattr(gs, "receivable", None):
            rec = gs.receivable
            receivables_list.append({
                "id": str(rec.id),
                "code": rec.code,
                "document_date": str(rec.document_date) if rec.document_date else None,
                "due_date": str(rec.due_date) if getattr(rec, "due_date", None) else None,
                "original_amount": str(rec.original_amount),
                "collected_amount": str(rec.collected_amount),
                "balance": str(rec.balance),
                "status": rec.status,
                "source_number": gs.number,
            })
    for ss in summary["_posted_service_sales"]:
        if getattr(ss, "receivable", None):
            rec = ss.receivable
            receivables_list.append({
                "id": str(rec.id),
                "code": rec.code,
                "document_date": str(rec.document_date) if rec.document_date else None,
                "due_date": str(rec.due_date) if getattr(rec, "due_date", None) else None,
                "original_amount": str(rec.original_amount),
                "collected_amount": str(rec.collected_amount),
                "balance": str(rec.balance),
                "status": rec.status,
                "source_number": ss.number,
            })

    direct_collections_list = []
    for gs in summary["_posted_goods_sales"]:
        if gs.payment_type in ["CASH", "BANK"]:
            direct_collections_list.append({
                "source_type": "GOODS_SALE",
                "source_number": gs.number,
                "document_date": str(gs.document_date),
                "payment_type": gs.payment_type,
                "amount": str(gs.total_amount),
            })
    for ss in summary["_posted_service_sales"]:
        if ss.payment_type in ["CASH", "BANK"]:
            direct_collections_list.append({
                "source_type": "SERVICE_SALE",
                "source_number": ss.number,
                "document_date": str(ss.document_date),
                "payment_type": ss.payment_type,
                "amount": str(ss.total_amount),
            })

    payment_term_info = None
    if getattr(order, "payment_term", None):
        payment_term_info = {
            "id": str(order.payment_term.id),
            "code": getattr(order.payment_term, "code", ""),
            "name": getattr(order.payment_term, "name", ""),
            "due_days": getattr(order.payment_term, "due_days", 0),
        }

    payment_tab = {
        "incurred_receivable": summary["total_receivable_incurred"],
        "deductions": str(summary["_total_deductions"]),
        "allocated_collections": summary["total_collected_amount"],
        "remaining_receivable": summary["remaining_receivable_amount"],
        "payment_term": payment_term_info,
        "due_date": str(summary["_payment_due_date"]) if summary["_payment_due_date"] else None,
        "is_payment_overdue": summary["payment_overdue"],
        "payment_status": summary["payment_status"],
        "payment_label": summary["payment_label"],
        "receivables": receivables_list,
        "direct_collections": direct_collections_list,
    }

    # Clean internal keys from summary
    clean_summary = {k: v for k, v in summary.items() if not k.startswith("_")}

    return {
        "summary": clean_summary,
        "delivery_tab": delivery_tab,
        "sales_invoice_tab": sales_invoice_tab,
        "payment_tab": payment_tab,
        "lines": lines_metrics,
        "related_document_counts": {
            "deliveries": len(deliveries_list),
            "goods_sales": len(goods_sales_list),
            "service_sales": len(service_sales_list),
            "sales_invoices": len(invoices_list),
            "sales_returns": len(returns_list),
            "sales_allowances": len(allowances_list),
            "receivables": len(receivables_list),
        },
    }


def generate_tracking_export_csv(summaries):
    """
    Generate UTF-8 with BOM CSV export for Sales Order Tracking (AF-06).
    """
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM
    writer = csv.writer(output)

    writer.writerow([
        "Mã đơn bán",
        "Ngày lập",
        "Khách hàng",
        "Mã khách hàng",
        "Chi nhánh",
        "Nhân viên phụ trách",
        "Ngày giao dự kiến",
        "Loại tiền",
        "Tổng giá trị đơn",
        "Trạng thái đơn",
        "Tiến độ giao/dịch vụ",
        "Tỷ lệ giao (%)",
        "Tiến độ ghi nhận bán",
        "Tỷ lệ bán (%)",
        "Tiến độ hóa đơn",
        "Tỷ lệ hóa đơn (%)",
        "Tiến độ thanh toán",
        "Tỷ lệ thanh toán (%)",
        "Số lượng đặt",
        "Số lượng đã giao",
        "Số lượng đã đóng",
        "Số lượng còn lại",
        "Số lượng đã bán",
        "Số lượng đã lập HĐ",
        "Số lượng chờ lập HĐ",
        "Số lượng trả lại",
        "Phải thu phát sinh",
        "Đã thanh toán",
        "Còn phải thu",
        "Quá hạn giao",
        "Quá hạn thanh toán",
    ])

    for s in summaries:
        writer.writerow([
            s["number"],
            s["document_date"],
            s["customer_name"],
            s["customer_code"],
            s["branch_name"],
            s["assigned_employee_name"],
            s["requested_delivery_date"] or "",
            s["currency_code"],
            s["total_amount"],
            s["order_status_label"],
            s["fulfillment_label"],
            s["fulfillment_rate"],
            s["sales_label"],
            s["sales_rate"],
            s["invoicing_label"],
            s["invoicing_rate"],
            s["payment_label"],
            s["payment_rate"],
            s["total_ordered_quantity"],
            s["total_delivered_quantity"],
            s["total_closed_quantity"],
            s["total_remaining_quantity"],
            s["total_recorded_sales_quantity"],
            s["total_invoiced_quantity"],
            s["total_pending_invoice_quantity"],
            s["total_returned_quantity"],
            s["total_receivable_incurred"],
            s["total_collected_amount"],
            s["remaining_receivable_amount"],
            "Có" if s["delivery_overdue"] else "Không",
            "Có" if s["payment_overdue"] else "Không",
        ])

    return output.getvalue()
