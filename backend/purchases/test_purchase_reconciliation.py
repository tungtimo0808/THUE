from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts_payable.models import SupplierInvoice, SupplierInvoiceLine
from master_data.models import Currency, Item, Party, UnitOfMeasure, Warehouse
from organization.models import Branch, Company
from purchases import test_goods_purchase
from purchases.models import (
    GoodsPurchase,
    MatchingMethod,
    PurchaseInvoiceMatch,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReceipt,
    PurchaseReceiptLine,
    PurchaseReconciliation,
    PurchaseReconciliationLine,
    ReceiptStatus,
    ReconciliationStatus,
)


class PurchaseReconciliationTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.supplier.tax_code = "9988776655"
        self.supplier.save(update_fields=("tax_code",))
        self.goods_url = self.url
        self.rec_url = f"/api/v1/purchases/reconciliations/?company_id={self.company.pk}"

    def create_po(self, quantity="2.000000", unit_price="100.0000"):
        po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"PO-{self.company.pk.hex[:6]}",
            document_date=self.day,
            status="APPROVED",
            supplier=self.supplier,
            currency=self.company.accounting_currency,
            subtotal=Decimal(quantity) * Decimal(unit_price),
            total_amount=Decimal(quantity) * Decimal(unit_price),
            created_by=self.actor,
        )
        po_line = PurchaseOrderLine.objects.create(
            order=po,
            line_no=1,
            item=self.item,
            uom=self.uom,
            warehouse=self.warehouse,
            quantity=Decimal(quantity),
            unit_price=Decimal(unit_price),
        )
        return po, po_line

    def create_receipt(self, po, po_line, quantity="2.000000"):
        receipt = PurchaseReceipt.objects.create(
            company=self.company,
            order=po,
            warehouse=self.warehouse,
            number=f"REC-IN-{self.company.pk.hex[:6]}",
            receipt_date=self.day,
            status=ReceiptStatus.CONFIRMED,
            created_by=self.actor,
            confirmed_by=self.actor,
        )
        rcpt_line = PurchaseReceiptLine.objects.create(
            receipt=receipt,
            order_line=po_line,
            quantity=Decimal(quantity),
        )
        return receipt, rcpt_line

    def create_invoice(self, quantity="2.0000", unit_price="100.0000", number="INV-01", validation="VALID"):
        subtotal = (Decimal(quantity) * Decimal(unit_price)).quantize(Decimal("0.0001"))
        invoice = SupplierInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            supplier_tax_code=self.supplier.tax_code,
            invoice_series="AA/26E",
            invoice_number=number,
            invoice_date=self.day,
            seller_name=self.supplier.name,
            buyer_name=self.company.legal_name,
            buyer_tax_code=self.company.tax_code,
            currency=self.company.accounting_currency,
            subtotal=subtotal,
            tax_amount=Decimal("0"),
            total_amount=subtotal,
            validation_status=validation,
            status="DRAFT",
            created_by=self.actor,
        )
        inv_line = SupplierInvoiceLine.objects.create(
            invoice=invoice,
            line_no=1,
            item=self.item,
            uom=self.uom,
            description="Item",
            quantity=Decimal(quantity),
            unit_price=Decimal(unit_price),
            taxable_amount=subtotal,
            tax_amount=Decimal("0"),
            tax_rate_percent=Decimal("0"),
            total_amount=subtotal,
        )
        return invoice, inv_line

    def test_three_way_reconciliation_matched(self):
        po, po_line = self.create_po(quantity="2", unit_price="100")
        rcpt, rcpt_line = self.create_receipt(po, po_line, quantity="2")
        invoice, inv_line = self.create_invoice(quantity="2", unit_price="100", number="INV-3W-01")

        # 1. Candidate lines
        candidate_res = self.client.get(
            f"/api/v1/purchases/reconciliations/candidate-lines/?company_id={self.company.pk}&invoice_id={invoice.pk}&purchase_order_id={po.pk}&purchase_receipt_id={rcpt.pk}&method=THREE_WAY"
        )
        self.assertEqual(candidate_res.status_code, 200)
        self.assertEqual(len(candidate_res.data), 1)
        self.assertTrue(candidate_res.data[0]["auto_matched"])

        # 2. Preview
        payload = {
            "invoice": str(invoice.pk),
            "matching_method": MatchingMethod.THREE_WAY,
            "purchase_order": str(po.pk),
            "purchase_receipt": str(rcpt.pk),
            "lines": [
                {
                    "invoice_line": str(inv_line.pk),
                    "receipt_line": str(rcpt_line.pk),
                    "order_line": str(po_line.pk),
                    "matched_quantity": "2",
                }
            ],
        }
        preview_res = self.client.post(
            f"/api/v1/purchases/reconciliations/preview/?company_id={self.company.pk}", payload, format="json"
        )
        self.assertEqual(preview_res.status_code, 200, preview_res.data)
        self.assertEqual(preview_res.data["status"], "MATCHED")
        self.assertEqual(Decimal(preview_res.data["total_matched_amount"]), Decimal("200"))
        self.assertEqual(Decimal(preview_res.data["total_difference_amount"]), Decimal("0"))

        # 3. Confirm create
        create_res = self.client.post(self.rec_url, payload, format="json")
        self.assertEqual(create_res.status_code, 201, create_res.data)
        self.assertEqual(create_res.data["message"], "Đối chiếu chứng từ mua hàng thành công.")
        rec_data = create_res.data["data"]
        self.assertEqual(rec_data["status"], "MATCHED")

        # Verify source documents
        po_line.refresh_from_db()
        self.assertEqual(po_line.invoiced_quantity, Decimal("2"))
        po.refresh_from_db()
        self.assertEqual(po.invoiced_amount, Decimal("200"))
        self.assertEqual(po.invoicing_status, "FULLY_INVOICED")

        invoice.refresh_from_db()
        self.assertEqual(invoice.match_status, "MATCHED")
        self.assertEqual(invoice.linked_amount, Decimal("200"))
        inv_line.refresh_from_db()
        self.assertEqual(inv_line.purchase_order_line_id, po_line.id)
        self.assertEqual(inv_line.receipt_line_id, rcpt_line.id)

    def test_two_way_reconciliation_matched(self):
        po, po_line = self.create_po(quantity="3", unit_price="50")
        invoice, inv_line = self.create_invoice(quantity="3", unit_price="50", number="INV-2W-01")

        payload = {
            "invoice": str(invoice.pk),
            "matching_method": MatchingMethod.TWO_WAY,
            "purchase_order": str(po.pk),
            "lines": [
                {
                    "invoice_line": str(inv_line.pk),
                    "order_line": str(po_line.pk),
                    "matched_quantity": "3",
                }
            ],
        }
        create_res = self.client.post(self.rec_url, payload, format="json")
        self.assertEqual(create_res.status_code, 201, create_res.data)
        self.assertEqual(create_res.data["data"]["status"], "MATCHED")

        po_line.refresh_from_db()
        self.assertEqual(po_line.invoiced_quantity, Decimal("3"))
        invoice.refresh_from_db()
        self.assertEqual(invoice.match_status, "MATCHED")

    def test_direct_reconciliation_matched(self):
        # Create posted goods purchase
        self.url = self.goods_url
        detail, draft = test_goods_purchase.GoodsPurchaseTests.create_and_approve(
            self, test_goods_purchase.GoodsPurchaseTests.payload(self, quantity="2.000000")
        )
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200)
        gp = GoodsPurchase.objects.get(pk=draft["id"])
        gp_line = gp.lines.first()

        invoice, inv_line = self.create_invoice(quantity="2", unit_price="90", number="INV-DIR-01")

        payload = {
            "invoice": str(invoice.pk),
            "matching_method": MatchingMethod.DIRECT,
            "goods_purchase": str(gp.pk),
            "lines": [
                {
                    "invoice_line": str(inv_line.pk),
                    "purchase_line": str(gp_line.pk),
                    "matched_quantity": "2",
                }
            ],
        }
        create_res = self.client.post(self.rec_url, payload, format="json")
        self.assertEqual(create_res.status_code, 201, create_res.data)
        self.assertEqual(create_res.data["data"]["status"], "MATCHED")

        gp.refresh_from_db()
        self.assertEqual(gp.invoice_status, "INVOICED")
        self.assertEqual(PurchaseInvoiceMatch.objects.filter(purchase_line=gp_line).count(), 1)

    def test_partial_reconciliation(self):
        po, po_line = self.create_po(quantity="5", unit_price="100")
        rcpt, rcpt_line = self.create_receipt(po, po_line, quantity="5")
        invoice, inv_line = self.create_invoice(quantity="2", unit_price="100", number="INV-PART-01")

        payload = {
            "invoice": str(invoice.pk),
            "matching_method": MatchingMethod.THREE_WAY,
            "purchase_order": str(po.pk),
            "purchase_receipt": str(rcpt.pk),
            "lines": [
                {
                    "invoice_line": str(inv_line.pk),
                    "receipt_line": str(rcpt_line.pk),
                    "order_line": str(po_line.pk),
                    "matched_quantity": "2",
                }
            ],
        }
        create_res = self.client.post(self.rec_url, payload, format="json")
        self.assertEqual(create_res.status_code, 201, create_res.data)
        # In this case, matched_quantity is 2 out of 5 from receipt -> partially matched
        self.assertEqual(create_res.data["data"]["status"], "PARTIALLY_MATCHED")

        po.refresh_from_db()
        self.assertEqual(po.invoicing_status, "PARTIALLY_INVOICED")

    def test_mismatch_quantity_exceeds(self):
        po, po_line = self.create_po(quantity="2", unit_price="100")
        rcpt, rcpt_line = self.create_receipt(po, po_line, quantity="2")
        invoice, inv_line = self.create_invoice(quantity="5", unit_price="100", number="INV-OVER-01")

        payload = {
            "invoice": str(invoice.pk),
            "matching_method": MatchingMethod.THREE_WAY,
            "purchase_order": str(po.pk),
            "purchase_receipt": str(rcpt.pk),
            "lines": [
                {
                    "invoice_line": str(inv_line.pk),
                    "receipt_line": str(rcpt_line.pk),
                    "order_line": str(po_line.pk),
                    "matched_quantity": "5",
                }
            ],
        }
        create_res = self.client.post(self.rec_url, payload, format="json")
        self.assertEqual(create_res.status_code, 201)
        self.assertEqual(create_res.data["data"]["status"], "MISMATCH")
        self.assertIn("Số lượng hóa đơn vượt số lượng đã nhận còn lại", create_res.data["data"]["lines"][0]["difference_reason"])

    def test_mismatch_price_and_resolution_flow(self):
        po, po_line = self.create_po(quantity="2", unit_price="100")
        rcpt, rcpt_line = self.create_receipt(po, po_line, quantity="2")
        # Supplier invoiced with price 120 instead of 100
        invoice, inv_line = self.create_invoice(quantity="2", unit_price="120", number="INV-DIFF-01")

        payload = {
            "invoice": str(invoice.pk),
            "matching_method": MatchingMethod.THREE_WAY,
            "purchase_order": str(po.pk),
            "purchase_receipt": str(rcpt.pk),
            "lines": [
                {
                    "invoice_line": str(inv_line.pk),
                    "receipt_line": str(rcpt_line.pk),
                    "order_line": str(po_line.pk),
                    "matched_quantity": "2",
                }
            ],
        }
        create_res = self.client.post(self.rec_url, payload, format="json")
        self.assertEqual(create_res.status_code, 201)
        rec_id = create_res.data["data"]["id"]
        self.assertEqual(create_res.data["data"]["status"], "MISMATCH")

        # Step AF-08: Request resolve
        req_res = self.client.post(
            f"/api/v1/purchases/reconciliations/{rec_id}/request-resolve/?company_id={self.company.pk}",
            {"reason": "Nhà cung cấp điều chỉnh giá phát sinh phí vận chuyển."},
            format="json",
        )
        self.assertEqual(req_res.status_code, 200, req_res.data)
        self.assertEqual(req_res.data["difference_reason"], "Nhà cung cấp điều chỉnh giá phát sinh phí vận chuyển.")

        # Step AF-08: Approve resolution
        resolve_res = self.client.post(
            f"/api/v1/purchases/reconciliations/{rec_id}/resolve/?company_id={self.company.pk}",
            {"note": "Chấp thuận thanh toán theo đơn giá mới."},
            format="json",
        )
        self.assertEqual(resolve_res.status_code, 200, resolve_res.data)
        self.assertEqual(resolve_res.data["status"], "RESOLVED")

        invoice.refresh_from_db()
        self.assertEqual(invoice.match_status, "ACCEPTED_VARIANCE")

    def test_recalculate_after_price_updated(self):
        po, po_line = self.create_po(quantity="2", unit_price="100")
        rcpt, rcpt_line = self.create_receipt(po, po_line, quantity="2")
        invoice, inv_line = self.create_invoice(quantity="2", unit_price="120", number="INV-RECALC-01")

        payload = {
            "invoice": str(invoice.pk),
            "matching_method": MatchingMethod.THREE_WAY,
            "purchase_order": str(po.pk),
            "purchase_receipt": str(rcpt.pk),
            "lines": [
                {
                    "invoice_line": str(inv_line.pk),
                    "receipt_line": str(rcpt_line.pk),
                    "order_line": str(po_line.pk),
                    "matched_quantity": "2",
                }
            ],
        }
        create_res = self.client.post(self.rec_url, payload, format="json")
        rec_id = create_res.data["data"]["id"]
        self.assertEqual(create_res.data["data"]["status"], "MISMATCH")

        # AF-07: PO is updated to 120
        po_line.unit_price = Decimal("120")
        po_line.save(update_fields=("unit_price",))

        # Recalculate
        recalc_res = self.client.post(
            f"/api/v1/purchases/reconciliations/{rec_id}/recalculate/?company_id={self.company.pk}",
            {"version": 1},
            format="json",
        )
        self.assertEqual(recalc_res.status_code, 200, recalc_res.data)
        self.assertEqual(recalc_res.data["status"], "MATCHED")

    def test_cancel_reconciliation(self):
        po, po_line = self.create_po(quantity="2", unit_price="100")
        rcpt, rcpt_line = self.create_receipt(po, po_line, quantity="2")
        invoice, inv_line = self.create_invoice(quantity="2", unit_price="100", number="INV-CANCEL-01")

        payload = {
            "invoice": str(invoice.pk),
            "matching_method": MatchingMethod.THREE_WAY,
            "purchase_order": str(po.pk),
            "purchase_receipt": str(rcpt.pk),
            "lines": [
                {
                    "invoice_line": str(inv_line.pk),
                    "receipt_line": str(rcpt_line.pk),
                    "order_line": str(po_line.pk),
                    "matched_quantity": "2",
                }
            ],
        }
        create_res = self.client.post(self.rec_url, payload, format="json")
        rec_id = create_res.data["data"]["id"]

        po_line.refresh_from_db()
        self.assertEqual(po_line.invoiced_quantity, Decimal("2"))

        # Cancel
        cancel_res = self.client.post(
            f"/api/v1/purchases/reconciliations/{rec_id}/cancel/?company_id={self.company.pk}",
            {"reason": "Hủy do đối chiếu nhầm", "version": 1},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, 200, cancel_res.data)
        self.assertEqual(cancel_res.data["status"], "CANCELLED")

        # Rolled back
        po_line.refresh_from_db()
        self.assertEqual(po_line.invoiced_quantity, Decimal("0"))
        invoice.refresh_from_db()
        self.assertEqual(invoice.match_status, "UNMATCHED")

    def test_validation_errors(self):
        po, po_line = self.create_po(quantity="2", unit_price="100")
        rcpt, rcpt_line = self.create_receipt(po, po_line, quantity="2")

        # EF-02: Invoice not VALID
        invalid_inv, inv_line = self.create_invoice(number="INV-INVALID", validation="INVALID")
        payload = {
            "invoice": str(invalid_inv.pk),
            "matching_method": MatchingMethod.THREE_WAY,
            "purchase_order": str(po.pk),
            "purchase_receipt": str(rcpt.pk),
            "lines": [{"invoice_line": str(inv_line.pk), "receipt_line": str(rcpt_line.pk), "order_line": str(po_line.pk)}],
        }
        res_ef02 = self.client.post(self.rec_url, payload, format="json")
        self.assertEqual(res_ef02.status_code, 400)
        self.assertIn("Hóa đơn không còn đủ điều kiện đối chiếu", str(res_ef02.data))

        # EF-04: Supplier mismatch
        other_supplier = Party.objects.create(company=self.company, code="S2", name="Other Supplier", status="ACTIVE")
        other_po = PurchaseOrder.objects.create(
            company=self.company, branch=self.branch, number="PO-OTHER", document_date=self.day,
            status="APPROVED", supplier=other_supplier, currency=self.company.accounting_currency,
            subtotal=Decimal("200"), total_amount=Decimal("200"), created_by=self.actor,
        )
        valid_inv, v_line = self.create_invoice(number="INV-VALID-01")
        payload["invoice"] = str(valid_inv.pk)
        payload["purchase_order"] = str(other_po.pk)
        res_ef04 = self.client.post(self.rec_url, payload, format="json")
        self.assertEqual(res_ef04.status_code, 400)
        self.assertIn("Nhà cung cấp trên các chứng từ không khớp", str(res_ef04.data))

    def test_eligible_endpoints(self):
        po, po_line = self.create_po(quantity="2", unit_price="100")
        invoice, _ = self.create_invoice(quantity="2", unit_price="100", number="INV-EL-01")

        inv_res = self.client.get(f"/api/v1/purchases/reconciliations/eligible-invoices/?company_id={self.company.pk}")
        self.assertEqual(inv_res.status_code, 200)
        self.assertTrue(any(i["id"] == str(invoice.pk) for i in inv_res.data))

        doc_res = self.client.get(
            f"/api/v1/purchases/reconciliations/eligible-documents/?company_id={self.company.pk}&invoice_id={invoice.pk}"
        )
        self.assertEqual(doc_res.status_code, 200)
        self.assertTrue(any(o["id"] == str(po.pk) for o in doc_res.data["purchase_orders"]))
