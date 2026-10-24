"""UC-INV-03: quantities still to be issued for sale documents whose stock leaves through separate issue vouchers."""
from decimal import Decimal

from django.db.models import Q, Sum

from . import models

ISSUE_STATUS_LABELS = {"NOT_ISSUED": "Chưa xuất", "PARTIAL": "Xuất một phần", "ISSUED": "Đã xuất đủ"}


def issued_by_line(sale_line_ids):
    """Quantity (in the sale line's unit) already issued by posted issue vouchers, keyed by sale line id."""
    rows = models.InventoryTransactionLine.objects.filter(
        sale_line_id__in=list(sale_line_ids), transaction__status="POSTED",
    ).values("sale_line_id").annotate(total=Sum("quantity"))
    return {row["sale_line_id"]: row["total"] or Decimal("0") for row in rows}


def issue_status(lines, issued):
    ordered = sum((line.quantity for line in lines), Decimal("0"))
    done = sum((min(issued.get(line.id, Decimal("0")), line.quantity) for line in lines), Decimal("0"))
    if done <= 0:
        return "NOT_ISSUED"
    return "ISSUED" if done >= ordered else "PARTIAL"


def sale_issue_status(sale):
    """Issue progress shown on a goods sale; None when the sale does not move stock."""
    if sale.status != "POSTED":
        return None
    if sale.inventory_handling == "ATTACH_ISSUE":
        return "ISSUED"
    if sale.inventory_handling != "SEPARATE_ISSUE":
        return None
    lines = list(sale.lines.all())
    return issue_status(lines, issued_by_line(line.id for line in lines))


def sale_sources(company, *, search="", customer="", date_from=None, date_to=None, include_completed=False):
    """Posted sale documents that can still be issued from stock, with sold / issued / remaining per line."""
    from sales.models import GoodsSale

    sales = GoodsSale.objects.filter(company=company, status="POSTED", inventory_handling="SEPARATE_ISSUE").select_related(
        "customer").prefetch_related("lines__item", "lines__uom", "lines__warehouse", "lines__cogs_account", "lines__inventory_account",
    ).order_by("-posting_date", "-number")
    if search:
        sales = sales.filter(number__icontains=search)
    if customer:
        sales = sales.filter(Q(customer__code__icontains=customer) | Q(customer__name__icontains=customer))
    if date_from:
        sales = sales.filter(posting_date__gte=date_from)
    if date_to:
        sales = sales.filter(posting_date__lte=date_to)
    sales = list(sales)
    issued = issued_by_line(line.id for sale in sales for line in sale.lines.all())
    result = []
    for sale in sales:
        lines = list(sale.lines.all())
        status = issue_status(lines, issued)
        if status == "ISSUED" and not include_completed:
            continue
        result.append({
            "id": str(sale.id), "number": sale.number, "document_date": sale.document_date, "posting_date": sale.posting_date,
            "customer": str(sale.customer_id), "customer_code": sale.customer.code, "customer_name": sale.customer.name,
            "customer_address": sale.customer_address, "description": sale.description,
            "issue_status": status, "issue_status_label": ISSUE_STATUS_LABELS[status],
            "lines": [{
                "id": str(line.id), "line_no": line.line_no, "item": str(line.item_id), "item_code": line.item.code,
                "item_name": line.item.name, "uom": str(line.uom_id), "uom_name": line.uom.name,
                "warehouse": str(line.warehouse_id) if line.warehouse_id else None,
                "quantity": line.quantity, "issued_quantity": issued.get(line.id, Decimal("0")),
                "remaining_quantity": max(line.quantity - issued.get(line.id, Decimal("0")), Decimal("0")),
                "cogs_account": str(line.cogs_account_id) if line.cogs_account_id else None,
                "cogs_account_code": line.cogs_account.code if line.cogs_account_id else "",
                "inventory_account": str(line.inventory_account_id) if line.inventory_account_id else None,
                "inventory_account_code": line.inventory_account.code if line.inventory_account_id else "",
            } for line in lines],
        })
    return result
