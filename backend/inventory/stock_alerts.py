"""Read-only stock alerts from the same balances used by inventory reports."""

from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from master_data.models import Item, Warehouse

from .models import InventoryPolicy, StockBalance
from .stock_summary import options


@transaction.atomic
def alerts(company, request):
    allowed = options(company, request)["warehouses"]
    if not allowed:
        raise PermissionDenied("Bạn chưa được cấp quyền xem dữ liệu kho.")
    allowed_ids = {row["id"] for row in allowed}
    warehouses = {str(row.pk): row for row in Warehouse.objects.filter(
        company=company, pk__in=allowed_ids, status="ACTIVE")}
    items = {str(row.pk): row for row in Item.objects.filter(
        company=company, status="ACTIVE", track_inventory=True).select_related("base_uom")}

    # A balance or an active policy establishes that this item is managed at
    # this warehouse. Do not manufacture zero-stock alerts for every item × warehouse.
    quantities = defaultdict(lambda: Decimal("0"))
    for row in StockBalance.objects.filter(company=company, warehouse_id__in=warehouses,
            item_id__in=items).values("warehouse_id", "item_id").annotate(quantity=Sum("quantity")):
        quantities[(str(row["warehouse_id"]), str(row["item_id"]))] = row["quantity"] or Decimal("0")
    for warehouse_id, item_id in InventoryPolicy.objects.filter(company=company, is_active=True,
            warehouse_id__in=warehouses, item_id__in=items).values_list("warehouse_id", "item_id"):
        quantities[(str(warehouse_id), str(item_id))] += Decimal("0")

    low_rows, out_rows = [], []
    for (warehouse_id, item_id), quantity in sorted(quantities.items(),
            key=lambda pair: (warehouses[pair[0][0]].code, items[pair[0][1]].code)):
        item, warehouse = items[item_id], warehouses[warehouse_id]
        if not item.base_uom_id:
            continue
        minimum = item.min_stock or Decimal("0")
        status = "OUT" if quantity <= 0 else "LOW" if minimum > 0 and quantity <= minimum else "OK"
        if status == "OK":
            continue
        row = {"item_id": item_id, "item_code": item.code, "item_name": item.name,
            "warehouse_id": warehouse_id, "warehouse_code": warehouse.code, "warehouse_name": warehouse.name,
            "uom": item.base_uom.symbol or item.base_uom.name,
            "quantity": quantity, "minimum_quantity": minimum,
            "shortage_quantity": max(minimum - quantity, Decimal("0")),
            "negative_stock": quantity < 0, "status": status}
        (out_rows if status == "OUT" else low_rows).append(row)
    return {"company_id": str(company.pk), "warehouse_ids": sorted(allowed_ids),
        "low_count": len({row["item_id"] for row in low_rows}),
        "out_count": len({row["item_id"] for row in out_rows}),
        "low_rows": low_rows, "out_rows": out_rows,
        "updated_at": timezone.now().isoformat()}
