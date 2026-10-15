import uuid
from decimal import Decimal

from django.db import migrations
from django.db.models import Sum


def seed_and_backfill(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    DocumentType = apps.get_model("master_data", "DocumentType")
    PurchaseOrder = apps.get_model("purchases", "PurchaseOrder")
    PurchaseOrderLine = apps.get_model("purchases", "PurchaseOrderLine")
    GoodsPurchaseLine = apps.get_model("purchases", "GoodsPurchaseLine")
    PurchaseReturnLine = apps.get_model("purchases", "PurchaseReturnLine")

    resource, _ = Resource.objects.get_or_create(code="PUR.DISCOUNT", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Giảm giá hàng mua", "status": "ACTIVE"})
    for code, name in (("VIEW", "Xem"), ("CREATE", "Tạo"), ("EDIT", "Sửa"),
                       ("SUBMIT", "Gửi duyệt"), ("APPROVE", "Phê duyệt"), ("POST", "Ghi sổ"),
                       ("UNPOST", "Bỏ ghi sổ"), ("CANCEL", "Hủy")):
        action, _ = Action.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"POST", "UNPOST", "APPROVE"} else "NORMAL"})
        Permission.objects.get_or_create(code=f"PUR.DISCOUNT.{code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": f"{name} - Giảm giá hàng mua", "status": "ACTIVE"})
    DocumentType.objects.get_or_create(code="PUR.DISCOUNT", defaults={
        "id": uuid.uuid4(), "module_code": "PUR", "name": "Chứng từ giảm giá hàng mua",
        "document_class": "PURCHASE", "supports_workflow": True,
        "requires_posting": True, "creates_inventory": False, "status": "ACTIVE"})

    for order_line in PurchaseOrderLine.objects.all().iterator():
        bought = GoodsPurchaseLine.objects.filter(order_line_id=order_line.pk, purchase__status="POSTED").aggregate(
            total=Sum("pre_tax_amount"))["total"] or Decimal("0")
        returned = PurchaseReturnLine.objects.filter(original_line__order_line_id=order_line.pk,
            document__status="POSTED").aggregate(total=Sum("pre_tax_amount"))["total"] or Decimal("0")
        order_line.realized_purchase_value = bought - returned
        order_line.save(update_fields=("realized_purchase_value",))
    for order in PurchaseOrder.objects.all().iterator():
        order.realized_purchase_value = PurchaseOrderLine.objects.filter(order=order).aggregate(
            total=Sum("realized_purchase_value"))["total"] or Decimal("0")
        order.save(update_fields=("realized_purchase_value",))


class Migration(migrations.Migration):
    dependencies = [("purchases", "0018_purchaseorder_realized_purchase_value_and_more")]
    operations = [migrations.RunPython(seed_and_backfill, migrations.RunPython.noop)]
