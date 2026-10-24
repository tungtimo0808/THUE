from decimal import Decimal

from django.test import TestCase

from audit_log.models import AuditChange, AuditLog
from inventory.models import StockBalance
from master_data.models import Item, Warehouse
from purchases import test_goods_purchase


class StockAlertTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.url = f"/api/v1/inventory/balances/alerts/?company_id={self.company.pk}"
        self.item.min_stock = Decimal("5")
        self.item.save(update_fields=("min_stock",))
        self.second = Item.objects.create(company=self.company, base_uom=self.uom,
            code="I2", name="No managed stock", item_type="GOODS", status="ACTIVE", track_inventory=True)
        self.other_warehouse = Warehouse.objects.create(company=self.company, branch=self.branch,
            code="W2", name="W2", status="ACTIVE")
        StockBalance.objects.create(company=self.company, warehouse=self.warehouse,
            item=self.item, quantity=Decimal("5"), inventory_value=Decimal("50"))
        StockBalance.objects.create(company=self.company, warehouse=self.other_warehouse,
            item=self.item, quantity=Decimal("0"), inventory_value=0)

    def test_low_and_out_are_per_warehouse_with_distinct_item_counts(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["low_count"], 1)
        self.assertEqual(response.data["out_count"], 1)
        self.assertEqual(len(response.data["low_rows"]), 1)
        self.assertEqual(len(response.data["out_rows"]), 1)
        self.assertEqual(Decimal(response.data["low_rows"][0]["quantity"]), Decimal("5"))
        self.assertEqual(response.data["low_rows"][0]["warehouse_code"], "W1")
        self.assertEqual(response.data["out_rows"][0]["warehouse_code"], "W2")
        self.assertFalse(any(row["item_code"] == "I2" for row in
            response.data["low_rows"] + response.data["out_rows"]))
        self.assertTrue(response.data["updated_at"])

        StockBalance.objects.filter(warehouse=self.warehouse, item=self.item).update(quantity=Decimal("-1"))
        changed = self.client.get(self.url)
        self.assertEqual(changed.data["low_count"], 0)
        self.assertEqual(changed.data["out_count"], 1)
        self.assertEqual(len(changed.data["out_rows"]), 2)
        self.assertTrue(any(row["negative_stock"] for row in changed.data["out_rows"]))

    def test_item_threshold_update_changes_alerts_and_invalid_value_is_rejected(self):
        detail = f"/api/v1/master-data/items/{self.item.pk}/?company_id={self.company.pk}"
        updated = self.client.patch(detail, {"version": self.item.updated_at.isoformat(),
            "min_stock": "2"}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(self.client.get(self.url).data["low_count"], 0)
        audit = AuditLog.objects.get(company=self.company, entity_id=self.item.pk, action_code="ITEM_UPDATE")
        change = AuditChange.objects.filter(audit_log=audit, field_name="min_stock").first()
        self.assertIsNotNone(change, list(AuditChange.objects.filter(audit_log=audit).values("field_name", "old_value_json", "new_value_json")))
        self.assertEqual(Decimal(change.old_value_json), Decimal("5"))
        self.assertEqual(Decimal(change.new_value_json), Decimal("2"))
        self.assertEqual(audit.actor_user_id, self.actor.pk)
        invalid = self.client.patch(detail, {"version": updated.data["version"],
            "min_stock": "-1"}, format="json")
        self.assertEqual(invalid.status_code, 400, invalid.data)
        self.item.refresh_from_db()
        self.assertEqual(self.item.min_stock, Decimal("2"))
