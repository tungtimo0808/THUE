"""Read-only UC-INV-08 stock summary from the posted inventory movement ledger."""

from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from django.db.models import Sum
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from iam.permissions import has_effective_permission
from master_data.models import Item, ItemCategory, Warehouse

from .models import StockBalance, StockMovement
from .services import actor


ZERO = Decimal("0")
VALUE_PRECISION = Decimal("0.0001")


def options(company, request):
    warehouses = [warehouse for warehouse in Warehouse.objects.filter(company=company).order_by("code")
                  if request.user.is_superuser or has_effective_permission(
                      actor(request), company, "INV.BALANCE.VIEW", warehouse_id=warehouse.pk,
                      branch_id=warehouse.branch_id)]
    categories = ItemCategory.objects.filter(company=company).order_by("code")
    return {
        "warehouses": [{"id": str(row.pk), "code": row.code, "name": row.name} for row in warehouses],
        "categories": [{"id": str(row.pk), "parent": str(row.parent_id) if row.parent_id else None,
                        "code": row.code, "name": row.name} for row in categories],
    }


def _selected_warehouses(company, request, available):
    raw = request.query_params.get("warehouse_ids", "")
    ids = [part.strip() for part in raw.split(",") if part.strip()]
    if not ids:
        if not available:
            raise PermissionDenied("Bạn không có quyền xem dữ liệu kho.")
        return [row["id"] for row in available]
    try:
        ids = [str(UUID(value)) for value in ids]
    except (ValueError, AttributeError):
        raise ValidationError({"warehouse_ids": "Kho được chọn không hợp lệ."})
    existing = set(Warehouse.objects.filter(company=company, pk__in=ids).values_list("id", flat=True))
    if len(existing) != len(set(ids)):
        raise ValidationError({"warehouse_ids": "Kho được chọn không hợp lệ."})
    allowed = {row["id"] for row in available}
    if any(value not in allowed for value in ids):
        raise PermissionDenied("Bạn không có quyền xem dữ liệu của kho đã chọn.")
    return list(dict.fromkeys(ids))


def _category_ids(company, category_id):
    if not category_id:
        return None
    try:
        wanted = UUID(category_id)
    except (ValueError, AttributeError):
        raise ValidationError({"category_id": "Nhóm vật tư/hàng hóa không hợp lệ."})
    parent_by_id = {row["id"]: row["parent_id"] for row in ItemCategory.objects.filter(company=company).values("id", "parent_id")}
    if wanted not in parent_by_id:
        raise ValidationError({"category_id": "Nhóm vật tư/hàng hóa không hợp lệ."})
    selected = {wanted}
    while True:
        children = {pk for pk, parent in parent_by_id.items() if parent in selected}
        if children <= selected:
            return selected
        selected |= children


def summary(company, request, date_from, date_to):
    available = options(company, request)
    warehouse_ids = _selected_warehouses(company, request, available["warehouses"])
    category_ids = _category_ids(company, request.query_params.get("category_id", ""))
    items = Item.objects.filter(company=company, track_inventory=True).select_related("base_uom")
    if category_ids is not None:
        items = items.filter(category_id__in=category_ids)
    item_by_id = {str(item.pk): item for item in items}
    warehouse_by_id = {row["id"]: row for row in available["warehouses"] if row["id"] in warehouse_ids}

    # Current balance is the source of truth. Subtract later posted movements to
    # reconstruct opening and closing balances, preserving any imported opening stock.
    current = defaultdict(lambda: [ZERO, ZERO])
    balances = StockBalance.objects.filter(company=company, warehouse_id__in=warehouse_ids, item_id__in=items.values("id"))
    for row in balances.values("warehouse_id", "item_id").annotate(quantity=Sum("quantity"), value=Sum("inventory_value")):
        key = (str(row["warehouse_id"]), str(row["item_id"]))
        current[key] = [row["quantity"] or ZERO, row["value"] or ZERO]

    periods = defaultdict(lambda: [ZERO, ZERO, ZERO, ZERO, ZERO, ZERO])
    movements = StockMovement.objects.filter(company=company, warehouse_id__in=warehouse_ids,
        item_id__in=items.values("id"), transaction__status__in=("POSTED", "REVERSED"))
    # All movements are required to back out transactions after the requested date.
    for movement in movements.values("warehouse_id", "item_id", "movement_date", "quantity_delta", "value_delta",
                                     "transaction__source_module", "line__line_value", "line__costing_status"):
        key = (str(movement["warehouse_id"]), str(movement["item_id"]))
        quantity, value = movement["quantity_delta"], movement["value_delta"]
        bucket = periods[key]
        if movement["movement_date"] >= date_from:
            bucket[0] += quantity
            bucket[1] += value
        if date_from <= movement["movement_date"] <= date_to:
            if quantity > 0 or quantity == 0 and value >= 0:
                bucket[2] += quantity
                bucket[3] += value
            else:
                bucket[4] -= quantity
                bucket[5] -= value
        if movement["movement_date"] <= date_to and quantity < 0 and (movement["line__costing_status"] == "PENDING" or movement["transaction__source_module"] == "INV_SALE_ISSUE" and not movement["line__costing_status"] and (movement["line__line_value"] or ZERO) <= 0):
            bucket.append(movement["movement_date"])

    rows = []
    for key in sorted(set(current) | set(periods), key=lambda pair: (warehouse_by_id[pair[0]]["code"], item_by_id[pair[1]].code)):
        warehouse_id, item_id = key
        item = item_by_id[item_id]
        balance_qty, balance_value = current[key]
        later_qty, later_value, in_qty, in_value, out_qty, out_value, *uncosted_dates = periods[key]
        opening_qty, opening_value = balance_qty - later_qty, balance_value - later_value
        closing_qty = opening_qty + in_qty - out_qty
        closing_value = opening_value + in_value - out_value
        opening_uncosted = any(date < date_from for date in uncosted_dates)
        period_uncosted = any(date_from <= date <= date_to for date in uncosted_dates)
        if not any((opening_qty, opening_value, in_qty, in_value, out_qty, out_value, closing_qty, closing_value)) and not uncosted_dates:
            continue
        rows.append({
            "warehouse_id": warehouse_id, "warehouse_name": warehouse_by_id[warehouse_id]["name"],
            "item_id": item_id, "item_code": item.code, "item_name": item.name,
            "uom": item.base_uom.symbol or item.base_uom.name if item.base_uom else "",
            "opening_quantity": opening_qty, "opening_value": None if opening_uncosted else opening_value.quantize(VALUE_PRECISION),
            "receipt_quantity": in_qty, "receipt_value": in_value.quantize(VALUE_PRECISION),
            "issue_quantity": out_qty, "issue_value": None if period_uncosted else out_value.quantize(VALUE_PRECISION),
            "closing_quantity": closing_qty, "closing_value": None if opening_uncosted or period_uncosted else closing_value.quantize(VALUE_PRECISION),
            "valuation_incomplete": opening_uncosted or period_uncosted,
        })

    value_fields = ("opening_value", "receipt_value", "issue_value", "closing_value")
    totals = {field: None if any(row[field] is None for row in rows) else sum((row[field] for row in rows), ZERO)
              for field in value_fields}
    return {"date_from": date_from, "date_to": date_to, "warehouse_ids": warehouse_ids,
            "category_id": request.query_params.get("category_id") or None, "rows": rows, "totals": totals,
            "warehouses": available["warehouses"], "categories": available["categories"]}


def multi_warehouse_summary(company, request, date_from, date_to):
    """UC-INV-09: combine UC-INV-08 warehouse rows only after base-UOM normalization."""
    detail = summary(company, request, date_from, date_to)
    quantities = ("opening_quantity", "receipt_quantity", "issue_quantity", "closing_quantity")
    values = ("opening_value", "receipt_value", "issue_value", "closing_value")
    grouped = {}
    for source in detail["rows"]:
        key = source["item_id"]
        if key not in grouped:
            grouped[key] = {"item_id": key, "item_code": source["item_code"], "item_name": source["item_name"],
                            "uom": source["uom"], "warehouse_count": 0, "valuation_incomplete": False,
                            **{field: ZERO for field in quantities + values}}
        target = grouped[key]
        if target["uom"] != source["uom"]:
            raise ValidationError("Đơn vị tính của mặt hàng không đồng nhất. Vui lòng kiểm tra quy đổi.")
        target["warehouse_count"] += 1
        target["valuation_incomplete"] |= source["valuation_incomplete"]
        for field in quantities:
            target[field] += source[field]
        for field in values:
            if source[field] is None:
                target[field] = None
            elif target[field] is not None:
                target[field] += source[field]
    rows = sorted(grouped.values(), key=lambda row: row["item_code"])
    totals = {field: None if any(row[field] is None for row in rows)
              else sum((row[field] for row in rows), ZERO) for field in values}
    return {"date_from": date_from, "date_to": date_to, "warehouse_ids": detail["warehouse_ids"],
            "category_id": detail["category_id"], "currency": company.accounting_currency.code,
            "warehouses": detail["warehouses"], "categories": detail["categories"], "rows": rows, "totals": totals}


def movement_detail(company, request, date_from, date_to):
    report = summary(company, request, date_from, date_to)
    raw_item_id = request.query_params.get("item_id", "")
    try:
        item_id = UUID(raw_item_id)
    except (ValueError, AttributeError):
        raise ValidationError({"item_id": "Mặt hàng không hợp lệ."})
    item = Item.objects.filter(company=company, pk=item_id, track_inventory=True).first()
    if not item:
        raise ValidationError({"item_id": "Mặt hàng không hợp lệ."})
    if report["category_id"] and item.category_id not in _category_ids(company, report["category_id"]):
        raise ValidationError({"item_id": "Mặt hàng không thuộc nhóm đã chọn."})
    opening = {row["warehouse_id"]: {"quantity": row["opening_quantity"], "value": row["opening_value"]}
               for row in report["rows"] if row["item_id"] == str(item_id)}
    warehouse_names = {row["id"]: row["name"] for row in report["warehouses"]}
    running = {warehouse_id: {"quantity": data["quantity"], "value": data["value"]}
               for warehouse_id, data in opening.items()}
    movements = StockMovement.objects.filter(company=company, warehouse_id__in=report["warehouse_ids"],
        item_id=item_id, movement_date__range=(date_from, date_to), transaction__status__in=("POSTED", "REVERSED"))
    result = []
    for movement in movements.select_related("transaction", "line").order_by("movement_date", "created_at", "pk"):
        warehouse_id = str(movement.warehouse_id)
        balance = running.setdefault(warehouse_id, {"quantity": ZERO, "value": ZERO})
        balance["quantity"] += movement.quantity_delta
        uncosted = (movement.quantity_delta < 0 and (movement.line.costing_status == "PENDING" or
                    movement.transaction.source_module == "INV_SALE_ISSUE" and not movement.line.costing_status and movement.line.line_value <= 0))
        balance["value"] = None if balance["value"] is None or uncosted else balance["value"] + movement.value_delta
        result.append({"movement_id": str(movement.pk), "date": movement.movement_date,
                       "transaction_number": movement.transaction.number, "warehouse_id": warehouse_id,
                       "warehouse_name": warehouse_names[warehouse_id], "quantity_delta": movement.quantity_delta,
                       "value_delta": None if uncosted else movement.value_delta,
                       "balance_quantity": balance["quantity"], "balance_value": balance["value"]})
    return {"date_from": date_from, "date_to": date_to, "item_id": str(item_id), "item_code": item.code,
            "item_name": item.name, "uom": item.base_uom.symbol or item.base_uom.name if item.base_uom else "",
            "opening": opening, "movements": result}


@transaction.atomic
def detail_ledger(company, request, date_from, date_to):
    """UC-INV-13: posted movements with independent running balances per item/warehouse."""
    raw_ids = [part.strip() for part in request.query_params.get("item_ids", "").split(",") if part.strip()]
    if not raw_ids or len(raw_ids) > 200:
        raise ValidationError({"item_ids": "Vui lòng chọn từ 1 đến 200 vật tư, hàng hóa."})
    try:
        item_ids = list(dict.fromkeys(UUID(value) for value in raw_ids))
    except ValueError:
        raise ValidationError({"item_ids": "Mặt hàng không hợp lệ."})
    items = {str(item.pk): item for item in Item.objects.filter(
        company=company, pk__in=item_ids, track_inventory=True, status="ACTIVE").select_related("base_uom")}
    if len(items) != len(item_ids):
        raise ValidationError({"item_ids": "Mặt hàng không hợp lệ hoặc không thuộc doanh nghiệp."})
    report = summary(company, request, date_from, date_to)
    allowed = set(report["warehouse_ids"])
    selected = set(items)
    opening_rows = [row for row in report["rows"] if row["item_id"] in selected]
    groups = {}
    for row in opening_rows:
        key = (row["warehouse_id"], row["item_id"])
        groups[key] = {"warehouse_id": key[0], "warehouse_name": row["warehouse_name"],
            "item_id": key[1], "item_code": row["item_code"], "item_name": row["item_name"],
            "item_description": items[key[1]].description, "uom": row["uom"],
            "opening_quantity": row["opening_quantity"], "opening_value": row["opening_value"],
            "closing_quantity": row["closing_quantity"], "closing_value": row["closing_value"],
            "valuation_incomplete": row["valuation_incomplete"], "reconciled": True, "movements": []}
    running = {key: [value["opening_quantity"], value["opening_value"]] for key, value in groups.items()}
    movements = StockMovement.objects.filter(company=company, warehouse_id__in=allowed,
        item_id__in=item_ids, movement_date__range=(date_from, date_to),
        transaction__status__in=("POSTED", "REVERSED")).select_related("transaction", "line")
    for movement in movements.order_by("movement_date", "transaction__created_at", "line__line_no", "created_at", "pk"):
        key = (str(movement.warehouse_id), str(movement.item_id))
        if key not in groups:
            continue
        quantity, value = movement.quantity_delta, movement.value_delta
        uncosted = quantity < 0 and (movement.line.costing_status == "PENDING" or
            movement.transaction.source_module == "INV_SALE_ISSUE" and not movement.line.costing_status
            and movement.line.line_value <= 0)
        balance = running[key]
        balance[0] += quantity
        balance[1] = None if balance[1] is None or uncosted else balance[1] + value
        groups[key]["movements"].append({
            "movement_id": str(movement.pk), "source_type": movement.transaction.transaction_type,
            "transaction_id": str(movement.transaction_id), "line_id": str(movement.line_id),
            "posting_date": movement.movement_date,
            "document_date": movement.transaction.document_date or movement.transaction.transaction_date,
            "transaction_number": movement.transaction.number,
            "description": movement.line.notes or movement.transaction.reason,
            "unit_price": None if uncosted or not quantity else (abs(value / quantity)).quantize(VALUE_PRECISION),
            "receipt_quantity": max(quantity, ZERO), "receipt_value": value if quantity > 0 else max(value, ZERO),
            "issue_quantity": max(-quantity, ZERO),
            "issue_value": None if uncosted else (-value if quantity < 0 else max(-value, ZERO)),
            "balance_quantity": balance[0], "balance_value": balance[1],
            "negative_stock": balance[0] < 0, "valuation_incomplete": uncosted or balance[1] is None,
        })
    for key, group in groups.items():
        quantity, value = running[key]
        group["reconciled"] = quantity == group["closing_quantity"] and (
            value is None and group["closing_value"] is None or
            value is not None and group["closing_value"] is not None and
            value.quantize(VALUE_PRECISION) == group["closing_value"])
    return {"company_id": str(company.pk), "date_from": date_from, "date_to": date_to,
        "warehouse_ids": report["warehouse_ids"], "item_ids": [str(value) for value in item_ids],
        "currency": company.accounting_currency.code,
        "groups": sorted(groups.values(), key=lambda row: (row["warehouse_name"], row["item_code"]))}
