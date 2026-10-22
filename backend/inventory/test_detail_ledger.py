from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.test import TestCase

from inventory.models import InventoryTransaction, InventoryTransactionLine, StockBalance, StockMovement
from master_data.models import Warehouse
from purchases import test_goods_purchase


class DetailLedgerTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.url = (f"/api/v1/inventory/balances/detail-ledger/?company_id={self.company.pk}"
            f"&date_from=2026-10-01&date_to=2026-10-31&item_ids={self.item.pk}")
        self.other_warehouse = Warehouse.objects.create(company=self.company, branch=self.branch,
            code="W2", name="W2", status="ACTIVE")
        StockBalance.objects.create(company=self.company, warehouse=self.warehouse, item=self.item,
            quantity=Decimal("7"), inventory_value=Decimal("75"))
        StockBalance.objects.create(company=self.company, warehouse=self.other_warehouse, item=self.item,
            quantity=Decimal("4"), inventory_value=Decimal("40"))

    def movement(self, number, quantity, value, day, pending=False):
        incoming = quantity >= 0
        transaction = InventoryTransaction.objects.create(company=self.company, number=number,
            transaction_type="RECEIPT" if incoming else "ISSUE", transaction_date=day,
            document_date=day, destination_warehouse=self.warehouse if incoming else None,
            source_warehouse=self.warehouse if not incoming else None,
            status="POSTED", created_by=self.actor)
        line = InventoryTransactionLine.objects.create(transaction=transaction, line_no=1, item=self.item,
            uom=self.uom, quantity=abs(quantity) or 1, base_quantity=abs(quantity),
            line_value=abs(value), costing_status="PENDING" if pending else "COMPLETED")
        return StockMovement.objects.create(company=self.company, transaction=transaction, line=line,
            warehouse=self.warehouse, item=self.item, movement_date=day,
            quantity_delta=quantity, value_delta=value, balance_quantity=0, balance_value=0)

    def test_opening_running_and_closing_are_separate_by_warehouse(self):
        self.movement("IN-01", Decimal("3"), Decimal("30"), date(2026, 10, 6))
        self.movement("OUT-01", Decimal("-2"), Decimal("-20"), date(2026, 10, 8))
        self.movement("VALUE-01", Decimal("0"), Decimal("5"), date(2026, 10, 9))
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.data)
        by_warehouse = {group["warehouse_name"]: group for group in response.data["groups"]}
        self.assertEqual(set(by_warehouse), {"W1", "W2"})
        group = by_warehouse["W1"]
        self.assertEqual(Decimal(group["opening_quantity"]), Decimal("6"))
        self.assertEqual(Decimal(group["opening_value"]), Decimal("60"))
        self.assertEqual([row["transaction_number"] for row in group["movements"]],
            ["IN-01", "OUT-01", "VALUE-01"])
        self.assertEqual([Decimal(row["balance_quantity"]) for row in group["movements"]],
            [Decimal("9"), Decimal("7"), Decimal("7")])
        self.assertEqual(Decimal(group["movements"][-1]["receipt_value"]), Decimal("5"))
        self.assertEqual(Decimal(group["closing_value"]), Decimal("75"))
        self.assertTrue(group["reconciled"])
        self.assertEqual(by_warehouse["W2"]["movements"], [])
        self.assertEqual(Decimal(by_warehouse["W2"]["opening_quantity"]), Decimal("4"))

    def test_uncosted_issue_and_invalid_selection(self):
        self.movement("OUT-PENDING", Decimal("-2"), Decimal("0"), date(2026, 10, 8), pending=True)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.data)
        group = next(row for row in response.data["groups"] if row["warehouse_name"] == "W1")
        self.assertIsNone(group["movements"][0]["issue_value"])
        self.assertIsNone(group["movements"][0]["balance_value"])
        self.assertIsNone(group["closing_value"])
        invalid = self.client.get(self.url.replace(str(self.item.pk), str(uuid4())))
        self.assertEqual(invalid.status_code, 400)
