from decimal import Decimal

from django.test import TestCase

from accounts_payable.models import Payable, Payment, PaymentAllocation, SupplierInvoice
from general_ledger.models import AccountingPeriod, JournalEntry
from inventory.models import StockBalance
from master_data.models import TaxRate
from purchases import test_goods_purchase
from purchases.models import GoodsPurchase, PurchaseDiscount, PurchaseOrder, PurchaseOrderLine


class PurchaseDiscountTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.goods_url = self.url
        self.url = f"/api/v1/purchases/purchase-discounts/?company_id={self.company.pk}"

    def original(self, *, order=False, tax=False):
        purchase_order = order_line = None
        if order:
            purchase_order = PurchaseOrder.objects.create(company=self.company, branch=self.branch,
                number="PO-DIS", document_date=self.day, status="APPROVED", created_by=self.actor,
                supplier=self.supplier, currency=self.company.accounting_currency,
                delivery_date=self.day, receiving_warehouse=self.warehouse)
            order_line = PurchaseOrderLine.objects.create(order=purchase_order, line_no=1, item=self.item,
                uom=self.uom, quantity=Decimal("2"), unit_price=Decimal("100"))
        payload = test_goods_purchase.GoodsPurchaseTests.payload(self, order=purchase_order, order_line=order_line)
        if tax:
            rate = TaxRate.objects.create(company=self.company, code="VAT10DIS", tax_type="VAT",
                rate_percent=Decimal("10"), effective_from=self.day, status="ACTIVE")
            payload["lines"][0]["tax_rate"] = str(rate.pk)
        self.url = self.goods_url
        detail, draft = test_goods_purchase.GoodsPurchaseTests.create_and_approve(self, payload)
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.url = f"/api/v1/purchases/purchase-discounts/?company_id={self.company.pk}"
        return GoodsPurchase.objects.get(pk=draft["id"]), detail, purchase_order, order_line

    def payload(self, source, *, method="AMOUNT", value="50"):
        line = {"line_no": 1, "original_line": str(source.lines.first().pk)}
        line["rate_percent" if method == "PERCENT" else "pre_tax_amount"] = value
        return {"original_purchase": str(source.pk), "document_date": str(self.day),
            "posting_date": str(self.day), "method": method, "handling": "REDUCE_PAYABLE",
            "reason": "Nhà cung cấp giảm giá", "lines": [line]}

    def create_and_submit(self, payload):
        created = self.client.post(self.url, payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        detail = f"/api/v1/purchases/purchase-discounts/{created.data['id']}/?company_id={self.company.pk}"
        submitted = self.client.post(detail.replace("/?", "/submit/?"), {"version": 1}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["status"], "APPROVED")
        return detail, created.data

    def test_amount_post_unpost_keeps_quantities_and_stock(self):
        source, source_detail, order, order_line = self.original(order=True)
        detail, draft = self.create_and_submit(self.payload(source))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        order.refresh_from_db()
        order_line.refresh_from_db()
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("130"))
        self.assertEqual(order.realized_purchase_value, Decimal("130"))
        self.assertEqual(order_line.realized_purchase_value, Decimal("130"))
        self.assertEqual(order_line.received_quantity, Decimal("2"))
        self.assertEqual(StockBalance.objects.get(item=self.item).quantity, Decimal("2"))
        self.assertEqual(PurchaseDiscount.objects.get(pk=draft["id"]).pre_tax_amount, Decimal("50"))
        self.assertEqual(PurchaseDiscount.objects.get(pk=draft["id"]).adjustment_invoice_status, "NOT_REQUIRED")
        original_view = self.client.get(source_detail)
        self.assertEqual(original_view.status_code, 200, original_view.data)
        self.assertEqual(Decimal(original_view.data["lines"][0]["discounted_pre_tax_amount"]), Decimal("50"))
        self.assertEqual(Decimal(original_view.data["lines"][0]["remaining_discountable_amount"]), Decimal("130"))
        blocked = self.client.post(source_detail.replace("/?", "/unpost/?"), {"version": 3}, format="json")
        self.assertEqual(blocked.status_code, 400)
        gl_period = AccountingPeriod.objects.get(company=self.company)
        gl_period.status = "CLOSED"
        gl_period.save(update_fields=("status",))
        self.assertEqual(self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Sửa"}, format="json").status_code, 400)
        gl_period.status = "OPEN"
        gl_period.save(update_fields=("status",))
        undone = self.client.post(detail.replace("/?", "/unpost/?"), {"version": 3, "reason": "Sửa"}, format="json")
        self.assertEqual(undone.status_code, 200, undone.data)
        order.refresh_from_db()
        self.assertEqual(order.realized_purchase_value, Decimal("180"))
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("180"))
        self.assertEqual(StockBalance.objects.get(item=self.item).quantity, Decimal("2"))

    def test_percent_and_cumulative_limit(self):
        source, _, _, _ = self.original()
        eligible = self.client.get(f"/api/v1/purchases/purchase-discounts/eligible-purchases/?company_id={self.company.pk}")
        self.assertEqual(eligible.status_code, 200, eligible.data)
        self.assertEqual(Decimal(eligible.data[0]["remaining_pre_tax_amount"]), Decimal("180"))
        detail, draft = self.create_and_submit(self.payload(source, method="PERCENT", value="25"))
        self.assertEqual(Decimal(draft["pre_tax_amount"]), Decimal("45"))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        available = self.client.get(f"/api/v1/purchases/purchase-discounts/available-lines/?company_id={self.company.pk}&original_purchase_id={source.pk}")
        self.assertEqual(available.status_code, 200, available.data)
        self.assertEqual(Decimal(available.data[0]["remaining_pre_tax_amount"]), Decimal("135"))
        exceeded = self.client.post(self.url, self.payload(source, value="136"), format="json")
        self.assertEqual(exceeded.status_code, 400)
        second = self.client.post(self.url, self.payload(source, value="135"), format="json")
        self.assertEqual(second.status_code, 201, second.data)
        second_detail = f"/api/v1/purchases/purchase-discounts/{second.data['id']}/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(second_detail.replace("/?", "/submit/?"), {"version": 1}, format="json").status_code, 200)
        self.assertEqual(self.client.post(second_detail.replace("/?", "/post/?"), {"version": 2}, format="json").status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/purchases/purchase-discounts/available-lines/?company_id={self.company.pk}&original_purchase_id={source.pk}").status_code, 400)
        self.assertEqual(self.client.get(f"/api/v1/purchases/purchase-discounts/eligible-purchases/?company_id={self.company.pk}").data, [])

    def test_tax_adjustment_invoice_required_at_post(self):
        source, _, _, _ = self.original(tax=True)
        original_invoice = SupplierInvoice.objects.create(company=self.company, branch=self.branch,
            supplier=self.supplier, supplier_tax_code="123", invoice_series="AA", invoice_number="1",
            invoice_date=self.day, currency=self.company.accounting_currency, status="POSTED", created_by=self.actor)
        source.supplier_invoice = original_invoice
        source.save(update_fields=("supplier_invoice",))
        detail, draft = self.create_and_submit(self.payload(source, value="50"))
        blocked = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("198"))
        adjustment_invoice = SupplierInvoice.objects.create(company=self.company, branch=self.branch,
            supplier=self.supplier, supplier_tax_code="123", invoice_series="AA", invoice_number="2",
            invoice_date=self.day, currency=self.company.accounting_currency, status="POSTED", created_by=self.actor)
        # An approved document may attach the tax invoice without changing the approved amounts.
        linked = self.client.patch(detail, {"version": 2, "adjustment_invoice": str(adjustment_invoice.pk)}, format="json")
        self.assertEqual(linked.status_code, 200, linked.data)
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 3}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(Decimal(posted.data["tax_amount"]), Decimal("5"))
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("143"))

    def test_journal_failure_rolls_back(self):
        source, _, _, _ = self.original()
        detail, draft = self.create_and_submit(self.payload(source))
        self.credit.requires_project = True
        self.credit.save()
        failed = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(failed.status_code, 400, failed.data)
        self.assertEqual(PurchaseDiscount.objects.get(pk=draft["id"]).status, "APPROVED")
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, Decimal("180"))
        self.assertFalse(JournalEntry.objects.filter(source_entity_type="PurchaseDiscount").exists())

    def test_paid_purchase_creates_supplier_credit(self):
        source, _, _, _ = self.original()
        payable = Payable.objects.get(goods_purchase=source)
        payment = Payment.objects.create(company=self.company, supplier=self.supplier,
            currency=self.company.accounting_currency, payment_date=self.day,
            amount=payable.balance, external_type="BANK", external_reference="DIS-PAID", created_by=self.actor)
        PaymentAllocation.objects.create(payment=payment, payable=payable, amount=payable.balance, created_by=self.actor)
        payment.allocated_amount = payable.balance
        payment.save(update_fields=("allocated_amount",))
        payable.paid_amount = payable.original_amount
        payable.balance = 0
        payable.status = "PAID"
        payable.save(update_fields=("paid_amount", "balance", "status"))
        payload = self.payload(source)
        payload["handling"] = "REFUND"
        detail, _ = self.create_and_submit(payload)
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(PurchaseDiscount.objects.get(pk=posted.data["id"]).supplier_credit.amount, Decimal("50"))
        self.assertEqual(Payable.objects.get(goods_purchase=source).balance, 0)

    def test_returned_value_reduces_discount_limit(self):
        source, _, _, _ = self.original()
        return_url = f"/api/v1/purchases/purchase-returns/?company_id={self.company.pk}"
        returned = self.client.post(return_url, {"original_purchase": str(source.pk),
            "document_date": str(self.day), "posting_date": str(self.day), "warehouse": str(self.warehouse.pk),
            "reason": "Lỗi hàng", "handling": "REDUCE_PAYABLE",
            "lines": [{"line_no": 1, "original_line": str(source.lines.first().pk), "quantity": "1"}]}, format="json")
        self.assertEqual(returned.status_code, 201, returned.data)
        detail = f"/api/v1/purchases/purchase-returns/{returned.data['id']}/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(detail.replace("/?", "/submit/?"), {"version": 1}, format="json").status_code, 200)
        self.assertEqual(self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json").status_code, 200)
        blocked = self.client.post(self.url, self.payload(source, value="91"), format="json")
        self.assertEqual(blocked.status_code, 400)
        accepted = self.client.post(self.url, self.payload(source, value="90"), format="json")
        self.assertEqual(accepted.status_code, 201, accepted.data)
