from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts_payable.models import Payable, Payment
from common_services.models import FiscalPeriod, FiscalYear
from general_ledger.models import Account, AccountingPeriod, ChartOfAccounts, JournalEntry
from inventory.models import InventoryTransaction, InventoryTransactionLine, StockBalance
from master_data.models import Currency, Item, Party, UnitOfMeasure, Warehouse
from organization.models import Branch, Company
from purchases.models import GoodsPurchase, PurchaseOrder, PurchaseOrderLine


class GoodsPurchaseTests(TestCase):
    def setUp(self):
        self.day = date(2026, 10, 6)
        self.user = get_user_model().objects.create_superuser(username="goods-admin", email="goods@example.test", password="password")
        self.actor = self.user.iam_account
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "VND", "is_active": True})
        self.company = Company.objects.create(code="GOODSCO", name="Goods", legal_name="Goods Ltd",
            tax_code="1234567890", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.branch = Branch.objects.create(company=self.company, code="B1", name="B1", status="ACTIVE")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="PCS", name="Piece", status="ACTIVE")
        self.item = Item.objects.create(company=self.company, base_uom=self.uom, code="I1", name="Item",
            item_type="GOODS", status="ACTIVE", allow_purchase=True, track_inventory=True)
        self.warehouse = Warehouse.objects.create(company=self.company, branch=self.branch, code="W1", name="W1", status="ACTIVE")
        self.supplier = Party.objects.create(company=self.company, code="S1", name="Supplier", status="ACTIVE")
        chart = ChartOfAccounts.objects.create(company=self.company, code="CH", name="Chart", effective_from=self.day)
        self.debit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Inventory", account_type="ASSET")
        self.credit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="331", name="Payable", account_type="LIABILITY")
        self.vat_input = Account.objects.create(company=self.company, chart_of_accounts=chart, code="1331", name="Deductible input VAT", account_type="ASSET")
        AccountingPeriod.objects.create(company=self.company, code="2026-10", fiscal_year=2026, period_number=10,
            start_date=date(2026, 10, 1), end_date=date(2026, 10, 31), status="OPEN")
        year = FiscalYear.objects.create(company=self.company, code="FY2026", name="2026", start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31), status="ACTIVE", created_by=self.actor)
        self.fiscal_period = FiscalPeriod.objects.create(company=self.company, fiscal_year=year, code="P10", name="October",
            period_number=10, start_date=date(2026, 10, 1), end_date=date(2026, 10, 31), status="OPEN")
        self.url = f"/api/v1/purchases/goods-purchases/?company_id={self.company.pk}"

    def payload(self, kind="WAREHOUSE", order=None, order_line=None, quantity="2.000000"):
        line = {"line_no": 1, "item": str(self.item.pk), "uom": str(self.uom.pk), "quantity": quantity,
                "unit_price": "100.0000", "discount_rate": "10.0000", "debit_account": str(self.debit.pk),
                "credit_account": str(self.credit.pk)}
        if order_line:
            line["order_line"] = str(order_line.pk)
        return {"company": str(self.company.pk), "branch": str(self.branch.pk), "document_date": str(self.day),
                "posting_date": str(self.day), "purchase_type": kind, "supplier": str(self.supplier.pk),
                "receiving_warehouse": str(self.warehouse.pk) if kind == "WAREHOUSE" else None,
                "purchase_order": str(order.pk) if order else None, "payment_type": "UNPAID", "lines": [line]}

    def create_and_approve(self, payload):
        created = self.client.post(self.url, payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        detail = f"/api/v1/purchases/goods-purchases/{created.data['id']}/?company_id={self.company.pk}"
        submitted = self.client.post(detail.replace("/?", "/submit/?"), {"version": 1}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["status"], "APPROVED")
        return detail, created.data

    def test_warehouse_post_and_unpost_are_atomic(self):
        detail, draft = self.create_and_approve(self.payload())
        self.assertEqual(Decimal(draft["total_amount"]), Decimal("180"))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        purchase = GoodsPurchase.objects.get(pk=draft["id"])
        self.assertEqual(purchase.status, "POSTED")
        self.assertEqual(InventoryTransaction.objects.filter(source_reference=purchase.number, status="POSTED").count(), 1)
        self.assertEqual(StockBalance.objects.get(item=self.item, warehouse=self.warehouse).quantity, Decimal("2"))
        self.assertEqual(Payable.objects.get(goods_purchase=purchase).balance, Decimal("180"))
        payable_response = self.client.get(f"/api/v1/accounts-payable/payables/?company_id={self.company.pk}")
        self.assertEqual(payable_response.status_code, 200, payable_response.data)
        self.assertEqual(JournalEntry.objects.get(pk=purchase.journal_entry_id).status, "POSTED")
        reversed_result = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correct"}, format="json")
        self.assertEqual(reversed_result.status_code, 200, reversed_result.data)
        self.assertEqual(StockBalance.objects.get(item=self.item, warehouse=self.warehouse).quantity, Decimal("0"))
        self.assertFalse(Payable.objects.filter(goods_purchase=purchase).exists())
        reposted = self.client.post(detail.replace("/?", "/post/?"), {"version": 4}, format="json")
        self.assertEqual(reposted.status_code, 200, reposted.data)
        self.assertEqual(StockBalance.objects.get(item=self.item, warehouse=self.warehouse).quantity, Decimal("2"))

    def test_receipt_draft_invoice_terms_and_posting(self):
        payload = self.payload()
        payload.update(number="NK-INV-TEST", supplier_address="12 Nguyen Trai", source_document_count=2,
            debt_days=30, invoice_details={"received": True, "template": "1", "series": "AA/26E",
                "number": "123", "date": "2026-10-06"})
        created = self.client.post(self.url, payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["number"], "NK-INV-TEST")
        self.assertEqual(created.data["invoice_details"]["number"], "123")
        self.assertEqual(created.data["payment_due_date"], "2026-11-05")
        self.assertFalse(StockBalance.objects.exists())
        self.assertFalse(JournalEntry.objects.exists())
        self.assertFalse(Payable.objects.exists())
        duplicate = self.client.post(self.url, payload, format="json")
        self.assertEqual(duplicate.status_code, 400)
        detail = f"/api/v1/purchases/goods-purchases/{created.data['id']}/?company_id={self.company.pk}"
        submitted = self.client.post(detail.replace("/?", "/submit/?"), {"version": 1}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(StockBalance.objects.get(item=self.item, warehouse=self.warehouse).quantity, Decimal("2"))
        self.assertEqual(Payable.objects.get(goods_purchase_id=created.data["id"]).due_date, date(2026, 11, 5))

    def test_receipt_rejects_invalid_stock_and_invoice_data(self):
        no_stock_item = Item.objects.create(company=self.company, base_uom=self.uom, code="NO-STOCK", name="No stock",
            item_type="GOODS", status="ACTIVE", allow_purchase=True, track_inventory=False)
        payload = self.payload()
        payload["lines"][0]["item"] = str(no_stock_item.pk)
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 400)
        payload = self.payload()
        payload["lines"][0]["unit_price"] = "0"
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 400)
        payload = self.payload()
        payload["invoice_details"] = {"received": True, "series": "AA", "date": "2026-10-06"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(GoodsPurchase.objects.exists())

    def test_deductible_input_vat_is_posted_to_1331(self):
        from master_data.models import TaxRate
        rate = TaxRate.objects.create(company=self.company, code="VAT10", tax_type="VAT", rate_percent=Decimal("10"),
            effective_from=self.day, status="ACTIVE")
        payload = self.payload()
        payload["lines"][0]["tax_rate"] = str(rate.pk)
        detail, draft = self.create_and_approve(payload)
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        journal = JournalEntry.objects.get(pk=GoodsPurchase.objects.get(pk=draft["id"]).journal_entry_id)
        debits = {line.account.code: line.debit for line in journal.lines.filter(debit__gt=0)}
        self.assertEqual(debits, {"156": Decimal("180"), "1331": Decimal("18")})
        self.assertEqual(journal.lines.get(credit__gt=0).credit, Decimal("198"))

    def test_direct_purchase_does_not_change_stock(self):
        detail, draft = self.create_and_approve(self.payload(kind="DIRECT"))
        result = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertFalse(InventoryTransaction.objects.exists())
        self.assertFalse(StockBalance.objects.exists())

    def test_order_limit_and_closed_period_prevent_posting(self):
        order = PurchaseOrder.objects.create(company=self.company, branch=self.branch, number="PO1", document_date=self.day,
            status="APPROVED", created_by=self.actor, supplier=self.supplier, currency=self.company.accounting_currency,
            delivery_date=self.day, receiving_warehouse=self.warehouse)
        line = PurchaseOrderLine.objects.create(order=order, line_no=1, item=self.item, uom=self.uom,
            quantity=Decimal("1"), unit_price=Decimal("100"))
        detail, draft = self.create_and_approve(self.payload(order=order, order_line=line, quantity="1"))
        self.fiscal_period.status = "LOCKED"
        self.fiscal_period.save()
        blocked = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(blocked.status_code, 400)
        self.assertFalse(JournalEntry.objects.exists())
        line.refresh_from_db()
        self.assertEqual(line.received_quantity, 0)
        self.fiscal_period.status = "OPEN"
        self.fiscal_period.save()
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        line.refresh_from_db()
        self.assertEqual(line.received_quantity, 1)
        over = self.client.post(self.url, self.payload(order=order, order_line=line, quantity="1"), format="json")
        self.assertEqual(over.status_code, 201, over.data)
        over_detail = f"/api/v1/purchases/goods-purchases/{over.data['id']}/submit/?company_id={self.company.pk}"
        refused = self.client.post(over_detail, {"version": 1}, format="json")
        self.assertEqual(refused.status_code, 400)
        undone = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correction"}, format="json")
        self.assertEqual(undone.status_code, 200, undone.data)
        line.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(line.received_quantity, 0)
        self.assertEqual(order.status, "APPROVED")

    def test_post_failure_rolls_back_stock_and_journal(self):
        detail, draft = self.create_and_approve(self.payload())
        self.debit.requires_project = True
        self.debit.save()
        failed = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(failed.status_code, 400, failed.data)
        self.assertEqual(GoodsPurchase.objects.get(pk=draft["id"]).status, "APPROVED")
        self.assertFalse(InventoryTransaction.objects.exists())
        self.assertFalse(StockBalance.objects.exists())
        self.assertFalse(JournalEntry.objects.exists())
        self.assertFalse(Payable.objects.exists())

    def test_immediate_payment_requires_confirmed_sufficient_payment(self):
        payment = Payment.objects.create(company=self.company, supplier=self.supplier,
            currency=self.company.accounting_currency, payment_date=self.day,
            amount=Decimal("180"), external_type="BANK", external_reference="PAY-1", status="CONFIRMED", created_by=self.actor)
        payload = self.payload(kind="DIRECT")
        payload.update(payment_type="IMMEDIATE", payment=str(payment.pk))
        detail, draft = self.create_and_approve(payload)
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertFalse(Payable.objects.exists())
        payment.refresh_from_db()
        self.assertEqual(payment.allocated_amount, Decimal("180"))
        unposted = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correction"}, format="json")
        self.assertEqual(unposted.status_code, 200, unposted.data)
        payment.refresh_from_db()
        self.assertEqual(payment.allocated_amount, Decimal("0"))

    def test_six_decimal_quantity_reaches_inventory_without_truncation(self):
        detail, draft = self.create_and_approve(self.payload(quantity="1.123456"))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(StockBalance.objects.get(item=self.item, warehouse=self.warehouse).quantity, Decimal("1.123456"))

    def test_anonymous_user_cannot_read_or_create(self):
        client = APIClient()
        self.assertIn(client.get(self.url).status_code, (401, 403))
        self.assertIn(client.post(self.url, self.payload(), format="json").status_code, (401, 403))

    def test_linked_receipt_is_not_applied_twice_or_reversed(self):
        receipt = InventoryTransaction.objects.create(company=self.company, branch=self.branch, supplier=self.supplier,
            number="RECEIPT-1", transaction_type="RECEIPT", transaction_date=self.day,
            destination_warehouse=self.warehouse, status="POSTED", inventory_applied=True, created_by=self.actor)
        InventoryTransactionLine.objects.create(transaction=receipt, line_no=1, item=self.item, uom=self.uom,
            quantity=Decimal("2"), base_quantity=Decimal("2"), unit_cost=Decimal("90"), line_value=Decimal("180"))
        StockBalance.objects.create(company=self.company, warehouse=self.warehouse, item=self.item,
            quantity=Decimal("2"), inventory_value=Decimal("180"), average_cost=Decimal("90"))
        payload = self.payload()
        payload["inventory_transaction"] = str(receipt.pk)
        detail, _ = self.create_and_approve(payload)
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(StockBalance.objects.get(item=self.item).quantity, Decimal("2"))
        undone = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Correction"}, format="json")
        self.assertEqual(undone.status_code, 200, undone.data)
        receipt.refresh_from_db()
        self.assertEqual(receipt.status, "POSTED")
        self.assertEqual(StockBalance.objects.get(item=self.item).quantity, Decimal("2"))
