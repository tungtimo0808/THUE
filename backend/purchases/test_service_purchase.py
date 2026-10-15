from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts_payable.models import Payable
from general_ledger.models import JournalEntry
from inventory.models import InventoryTransaction, StockBalance
from master_data.models import Item
from purchases.models import GoodsPurchase, PurchaseOrder, PurchaseOrderLine
from purchases import test_goods_purchase


class ServicePurchaseTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.service = Item.objects.create(company=self.company, base_uom=self.uom,
            code="SVC1", name="Consulting", item_type="SERVICE", status="ACTIVE",
            allow_purchase=True, track_inventory=False)
        self.url = f"/api/v1/purchases/service-purchases/?company_id={self.company.pk}"

    def payload(self, order=None, order_line=None, quantity="2.000000", **line_overrides):
        line = {"line_no": 1, "item": str(self.service.pk), "uom": str(self.uom.pk),
                "quantity": quantity, "unit_price": "100.0000", "discount_rate": "10.0000",
                "debit_account": str(self.debit.pk), "credit_account": str(self.credit.pk),
                "service_from": str(self.day), "service_to": str(self.day)}
        if order_line:
            line["order_line"] = str(order_line.pk)
        line.update(line_overrides)
        return {"company": str(self.company.pk), "branch": str(self.branch.pk),
                "document_date": str(self.day), "posting_date": str(self.day),
                "supplier": str(self.supplier.pk), "purchase_order": str(order.pk) if order else None,
                "payment_type": "UNPAID", "lines": [line]}

    def create_and_submit(self, payload):
        created = self.client.post(self.url, payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        detail = f"/api/v1/purchases/service-purchases/{created.data['id']}/?company_id={self.company.pk}"
        submitted = self.client.post(detail.replace("/?", "/submit/?"), {"version": 1}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["status"], "APPROVED")
        return detail, created.data

    def test_post_and_unpost_service_without_inventory(self):
        detail, draft = self.create_and_submit(self.payload())
        self.assertEqual(draft["purchase_type"], "SERVICE")
        self.assertEqual(Decimal(draft["total_amount"]), Decimal("180"))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        purchase = GoodsPurchase.objects.get(pk=draft["id"])
        self.assertEqual(purchase.status, "POSTED")
        self.assertTrue(Payable.objects.filter(goods_purchase=purchase, balance=Decimal("180")).exists())
        self.assertTrue(JournalEntry.objects.filter(pk=purchase.journal_entry_id, status="POSTED").exists())
        self.assertFalse(InventoryTransaction.objects.exists())
        self.assertFalse(StockBalance.objects.exists())
        undone = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correction"}, format="json")
        self.assertEqual(undone.status_code, 200, undone.data)
        self.assertFalse(Payable.objects.filter(goods_purchase=purchase).exists())

    def test_acceptance_and_date_validation(self):
        invalid = self.payload(service_to="2026-10-05")
        self.assertEqual(self.client.post(self.url, invalid, format="json").status_code, 400)
        self.service.requires_service_acceptance = True
        self.service.save(update_fields=("requires_service_acceptance",))
        created = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        detail = f"/api/v1/purchases/service-purchases/{created.data['id']}/?company_id={self.company.pk}"
        refused = self.client.post(detail.replace("/?", "/submit/?"), {"version": 1}, format="json")
        self.assertEqual(refused.status_code, 400)
        changed = self.client.patch(detail, {"version": 1, "lines": [self.payload(acceptance_date=str(self.day))["lines"][0]]}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        accepted = self.client.post(detail.replace("/?", "/submit/?"), {"version": 2}, format="json")
        self.assertEqual(accepted.status_code, 200, accepted.data)

    def test_order_limit_and_rollback(self):
        order = PurchaseOrder.objects.create(company=self.company, branch=self.branch, number="SPO1",
            document_date=self.day, status="APPROVED", created_by=self.actor, supplier=self.supplier,
            currency=self.company.accounting_currency, delivery_date=self.day,
            delivery_address="Main office")
        line = PurchaseOrderLine.objects.create(order=order, line_no=1, item=self.service,
            uom=self.uom, quantity=Decimal("1"), unit_price=Decimal("100"))
        over_value = self.payload(order=order, order_line=line, quantity="1", unit_price="200.0000")
        over_created = self.client.post(self.url, over_value, format="json")
        self.assertEqual(over_created.status_code, 201, over_created.data)
        over_submit = f"/api/v1/purchases/service-purchases/{over_created.data['id']}/submit/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(over_submit, {"version": 1}, format="json").status_code, 400)
        detail, draft = self.create_and_submit(self.payload(order=order, order_line=line, quantity="1"))
        self.debit.requires_project = True
        self.debit.save()
        failed = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(failed.status_code, 400)
        line.refresh_from_db()
        self.assertEqual(line.received_quantity, 0)
        self.assertFalse(JournalEntry.objects.exists())
        self.debit.requires_project = False
        self.debit.save()
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        line.refresh_from_db()
        self.assertEqual(line.received_quantity, 1)
        another = self.client.post(self.url, self.payload(order=order, order_line=line, quantity="1"), format="json")
        self.assertEqual(another.status_code, 201, another.data)
        another_detail = f"/api/v1/purchases/service-purchases/{another.data['id']}/submit/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(another_detail, {"version": 1}, format="json").status_code, 400)
        undone = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correction"}, format="json")
        self.assertEqual(undone.status_code, 200, undone.data)
        line.refresh_from_db()
        self.assertEqual(line.received_quantity, 0)

    def test_goods_endpoint_cannot_read_service(self):
        _, draft = self.create_and_submit(self.payload())
        url = f"/api/v1/purchases/goods-purchases/{draft['id']}/?company_id={self.company.pk}"
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_permission_is_enforced_by_backend(self):
        user = get_user_model().objects.create_user(username="service-no-access", password="password")
        client = APIClient()
        client.force_authenticate(user)
        denied = client.post(self.url, self.payload(), format="json")
        self.assertEqual(denied.status_code, 403)
        self.assertIn("mua dịch vụ", str(denied.data))
