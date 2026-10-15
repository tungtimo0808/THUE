from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from master_data.models import Currency, Item, ItemCategory, UnitOfMeasure, Warehouse
from organization.models import Branch, Company
from .models import InventoryTransaction, StockBalance, StockMovement


class InventoryApiTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="INVCO", name="Inventory Co", legal_name="Inventory Company", tax_code="0100998877",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        self.source = Warehouse.objects.create(company=self.company, branch=self.branch, code="K1", name="Kho 1")
        self.destination = Warehouse.objects.create(company=self.company, branch=self.branch, code="K2", name="Kho 2")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        category = ItemCategory.objects.create(company=self.company, code="HH", name="Hàng hóa")
        self.item = Item.objects.create(
            company=self.company, category=category, base_uom=self.uom, code="SP01", name="Sản phẩm 01",
            item_type="GOODS", track_inventory=True, valuation_method="MOVING_AVERAGE",
        )
        self.maker = get_user_model().objects.create_superuser(username="inv-maker", email="maker@inv.test", password="x")
        self.approver = get_user_model().objects.create_superuser(username="inv-approver", email="approver@inv.test", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.maker)
        self.query = f"?company_id={self.company.id}"
        response = self.client.post(
            f"/api/v1/inventory/policies/{self.query}",
            {
                "company": str(self.company.id), "warehouse": str(self.source.id), "item": str(self.item.id),
                "base_uom": str(self.uom.id), "minimum_quantity": "2", "maximum_quantity": "100",
                "valuation_method": "MOVING_AVERAGE",
            }, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def create_and_post(self, number, kind, quantity, source=None, destination=None, cost="10"):
        response = self.client.post(
            f"/api/v1/inventory/transactions/{self.query}",
            {
                "company": str(self.company.id), "number": number, "transaction_type": kind,
                "transaction_date": str(self.today),
                "source_warehouse": str(source.id) if source else None,
                "destination_warehouse": str(destination.id) if destination else None,
                "source_module": "TEST", "source_reference": number, "idempotency_key": f"key-{number}",
                "lines": [{"line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id), "quantity": str(quantity), "unit_cost": cost}],
            }, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        transaction_id = response.data["id"]
        submitted = self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/submit/{self.query}", {}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.client.force_authenticate(self.approver)
        approved = self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/approve/{self.query}", {"comment": "Đồng ý"}, format="json")
        self.assertEqual(approved.data["status"], "APPROVED", approved.data)
        posted = self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.client.force_authenticate(self.maker)
        return transaction_id

    def test_receipt_issue_transfer_history_and_gl(self):
        receipt_id = self.create_and_post("NK-001", "RECEIPT", 10, destination=self.source, cost="50")
        balance = StockBalance.objects.get(warehouse=self.source, item=self.item)
        self.assertEqual(balance.quantity, Decimal("10"))
        self.assertEqual(balance.inventory_value, Decimal("500"))
        issue_id = self.create_and_post("XK-001", "ISSUE", 3, source=self.source, cost="0")
        balance.refresh_from_db()
        self.assertEqual(balance.quantity, Decimal("7"))
        self.assertEqual(InventoryTransaction.objects.get(pk=issue_id).total_value, Decimal("150"))
        transfer_id = self.create_and_post("DC-001", "TRANSFER", 2, source=self.source, destination=self.destination, cost="0")
        balance.refresh_from_db()
        self.assertEqual(balance.quantity, Decimal("5"))
        self.assertEqual(StockBalance.objects.get(warehouse=self.destination, item=self.item).quantity, Decimal("2"))
        self.assertEqual(StockMovement.objects.filter(transaction_id=transfer_id).count(), 2)
        gl = self.client.post(
            f"/api/v1/inventory/transactions/{receipt_id}/post-gl/{self.query}",
            {"gl_reference": "GL-INV-001", "total_debit": "500", "total_credit": "500"}, format="json",
        )
        self.assertEqual(gl.status_code, 200, gl.data)
        self.assertEqual(gl.data["gl_status"], "POSTED")
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="INV").exists())

    def test_negative_stock_idempotency_and_count_adjustment(self):
        response = self.client.post(
            f"/api/v1/inventory/transactions/{self.query}",
            {
                "company": str(self.company.id), "number": "XK-AM", "transaction_type": "ISSUE",
                "transaction_date": str(self.today), "source_warehouse": str(self.source.id),
                "idempotency_key": "duplicate-event",
                "lines": [{"line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id), "quantity": "1", "unit_cost": "0"}],
            }, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        duplicate = self.client.post(
            f"/api/v1/inventory/transactions/{self.query}",
            {
                "company": str(self.company.id), "number": "XK-AM-2", "transaction_type": "ISSUE",
                "transaction_date": str(self.today), "source_warehouse": str(self.source.id),
                "idempotency_key": "duplicate-event",
                "lines": [{"line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id), "quantity": "1", "unit_cost": "0"}],
            }, format="json",
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        transaction_id = response.data["id"]
        self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/submit/{self.query}", {}, format="json")
        self.client.force_authenticate(self.approver)
        self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/approve/{self.query}", {"comment": "Duyệt"}, format="json")
        blocked = self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/post/{self.query}", {}, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.client.force_authenticate(self.maker)
        self.create_and_post("NK-COUNT", "RECEIPT", 10, destination=self.source, cost="20")
        count = self.client.post(
            f"/api/v1/inventory/counts/{self.query}",
            {
                "company": str(self.company.id), "number": "KK-001", "warehouse": str(self.source.id),
                "count_date": str(self.today), "snapshot_at": timezone.now().isoformat(),
                "lines": [{"item": str(self.item.id), "actual_quantity": "8"}],
            }, format="json",
        )
        self.assertEqual(count.status_code, 201, count.data)
        adjustment = self.client.post(f"/api/v1/inventory/counts/{count.data['id']}/create-adjustment/{self.query}", {}, format="json")
        self.assertEqual(adjustment.status_code, 201, adjustment.data)
        self.assertEqual(adjustment.data["lines"][0]["movement_direction"], "OUT")
