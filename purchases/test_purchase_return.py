from decimal import Decimal

from django.test import TestCase

from accounts_payable.models import Payable, Payment, PaymentAllocation
from general_ledger.models import JournalEntry
from inventory.models import InventoryTransaction, StockBalance
from master_data.models import TaxRate
from purchases import test_goods_purchase
from purchases.models import GoodsPurchase, PurchaseReturn, PurchaseReturnCredit


class PurchaseReturnTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.goods_url = self.url
        self.tax = TaxRate.objects.create(company=self.company, code="VAT10RET", tax_type="VAT",
            rate_percent=Decimal("10"), effective_from=self.day, status="ACTIVE")
        self.url = f"/api/v1/purchases/purchase-returns/?company_id={self.company.pk}"

    def original(self, kind="WAREHOUSE", quantity="5.000000"):
        payload = test_goods_purchase.GoodsPurchaseTests.payload(self, kind=kind, quantity=quantity)
        payload["lines"][0]["tax_rate"] = str(self.tax.pk)
        self.url = self.goods_url
        detail, draft = test_goods_purchase.GoodsPurchaseTests.create_and_approve(self, payload)
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.url = f"/api/v1/purchases/purchase-returns/?company_id={self.company.pk}"
        source = GoodsPurchase.objects.get(pk=draft["id"])
        return source, detail

    def payload(self, source, quantity="2.000000"):
        return {"original_purchase": str(source.pk), "document_date": str(self.day),
                "posting_date": str(self.day), "warehouse": str(self.warehouse.pk) if source.purchase_type == "WAREHOUSE" else None,
                "reason": "Sai quy cách", "handling": "REDUCE_PAYABLE",
                "lines": [{"line_no": 1, "original_line": str(source.lines.first().pk), "quantity": quantity}]}

    def create_and_submit(self, payload):
        created = self.client.post(self.url, payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        detail = f"/api/v1/purchases/purchase-returns/{created.data['id']}/?company_id={self.company.pk}"
        submitted = self.client.post(detail.replace("/?", "/submit/?"), {"version": 1}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["status"], "APPROVED")
        return detail, created.data

    def test_warehouse_partial_return_and_unpost(self):
        source, source_detail = self.original()
        detail, draft = self.create_and_submit(self.payload(source))
        self.assertEqual(Decimal(draft["total_amount"]), Decimal("198"))
        self.assertEqual(Decimal(draft["tax_amount"]), Decimal("18"))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        document = PurchaseReturn.objects.get(pk=draft["id"])
        self.assertEqual(document.status, "POSTED")
        self.assertEqual(StockBalance.objects.get(item=self.item).quantity, Decimal("3"))
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("297"))
        self.assertTrue(InventoryTransaction.objects.filter(pk=document.issue_transaction_id, status="POSTED").exists())
        self.assertTrue(JournalEntry.objects.filter(pk=document.journal_entry_id, status="POSTED").exists())
        available = self.client.get(f"/api/v1/purchases/purchase-returns/available-lines/?company_id={self.company.pk}&original_purchase_id={source.pk}")
        self.assertEqual(available.status_code, 200, available.data)
        self.assertEqual(Decimal(available.data[0]["remaining_quantity"]), Decimal("3"))
        blocked_source = self.client.post(source_detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correction"}, format="json")
        self.assertEqual(blocked_source.status_code, 400)
        undone = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correction"}, format="json")
        self.assertEqual(undone.status_code, 200, undone.data)
        self.assertEqual(StockBalance.objects.get(item=self.item).quantity, Decimal("5"))
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("495"))
        edited_payload = self.payload(source, quantity="1")
        edited_payload["version"] = 4
        edited = self.client.put(detail, edited_payload, format="json")
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(Decimal(edited.data["total_amount"]), Decimal("99"))
        reposted = self.client.post(detail.replace("/?", "/post/?"), {"version": 5}, format="json")
        self.assertEqual(reposted.status_code, 200, reposted.data)
        self.assertEqual(StockBalance.objects.get(item=self.item).quantity, Decimal("4"))
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("396"))

    def test_over_return_and_stock_shortage(self):
        source, _ = self.original()
        detail, draft = self.create_and_submit(self.payload(source, quantity="3"))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        over = self.client.post(self.url, self.payload(source, quantity="3"), format="json")
        self.assertEqual(over.status_code, 201, over.data)
        over_submit = f"/api/v1/purchases/purchase-returns/{over.data['id']}/submit/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(over_submit, {"version": 1}, format="json").status_code, 400)
        shortage = self.client.post(self.url, self.payload(source, quantity="2"), format="json")
        self.assertEqual(shortage.status_code, 201, shortage.data)
        balance = StockBalance.objects.get(item=self.item)
        balance.quantity = Decimal("1")
        balance.save(update_fields=("quantity",))
        shortage_submit = f"/api/v1/purchases/purchase-returns/{shortage.data['id']}/submit/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(shortage_submit, {"version": 1}, format="json").status_code, 400)

    def test_post_failure_rolls_back_stock_and_payable(self):
        source, _ = self.original()
        detail, draft = self.create_and_submit(self.payload(source))
        self.credit.requires_project = True
        self.credit.save()
        failed = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(failed.status_code, 400, failed.data)
        self.assertEqual(PurchaseReturn.objects.get(pk=draft["id"]).status, "APPROVED")
        self.assertEqual(StockBalance.objects.get(item=self.item).quantity, Decimal("5"))
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("495"))
        self.assertFalse(InventoryTransaction.objects.filter(source_reference=draft["number"]).exists())

    def test_paid_direct_purchase_creates_supplier_credit(self):
        source, _ = self.original(kind="DIRECT")
        payable = Payable.objects.get(goods_purchase=source)
        payment = Payment.objects.create(company=self.company, supplier=self.supplier,
            currency=self.company.accounting_currency, payment_date=self.day,
            amount=payable.balance, external_type="BANK", external_reference="RETURN-PAID", created_by=self.actor)
        PaymentAllocation.objects.create(payment=payment, payable=payable, amount=payable.balance, created_by=self.actor)
        payment.allocated_amount = payable.balance
        payment.save(update_fields=("allocated_amount",))
        payable.paid_amount = payable.original_amount
        payable.balance = 0
        payable.status = "PAID"
        payable.save(update_fields=("paid_amount", "balance", "status"))
        detail, draft = self.create_and_submit(self.payload(source))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        credit = PurchaseReturnCredit.objects.get(document_id=draft["id"])
        self.assertEqual(credit.amount, Decimal("198"))
        self.assertFalse(InventoryTransaction.objects.exists())
        credit.settled_amount = Decimal("1")
        credit.save(update_fields=("settled_amount",))
        blocked = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correction"}, format="json")
        self.assertEqual(blocked.status_code, 400)
