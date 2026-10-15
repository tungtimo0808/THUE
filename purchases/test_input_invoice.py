from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from accounts_payable.models import Payable, SupplierInvoice
from purchases import test_goods_purchase
from purchases.models import GoodsPurchase, PurchaseInvoiceMatch


class InputInvoiceTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.supplier.tax_code = "9988776655"
        self.supplier.save(update_fields=("tax_code",))
        self.goods_url = self.url
        self.url = f"/api/v1/purchases/input-invoices/?company_id={self.company.pk}"

    def original(self):
        self.url = self.goods_url
        detail, draft = test_goods_purchase.GoodsPurchaseTests.create_and_approve(
            self, test_goods_purchase.GoodsPurchaseTests.payload(self))
        posted = self.client.post(detail.replace("/?", "/post/?"), {"version": 2}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.url = f"/api/v1/purchases/input-invoices/?company_id={self.company.pk}"
        return GoodsPurchase.objects.get(pk=draft["id"]), detail

    def payload(self, *, number="01", amount="180", lines=None, links=None, source="MANUAL"):
        return {"branch": str(self.branch.pk), "supplier": str(self.supplier.pk),
            "source": source, "invoice_type": "ORIGINAL", "invoice_template": "1", "invoice_series": "AA/26E",
            "invoice_number": number, "invoice_date": str(self.day), "seller_name": self.supplier.name,
            "supplier_tax_code": self.supplier.tax_code, "seller_address": "Hà Nội",
            "buyer_name": self.company.legal_name, "buyer_tax_code": self.company.tax_code,
            "subtotal": amount, "tax_amount": "0", "total_amount": amount,
            "lines": lines or [{"line_no": 1, "description": "Item", "quantity": "2", "unit_price": "90",
                "taxable_amount": amount, "tax_rate_percent": "0", "tax_amount": "0", "total_amount": amount}],
            "links": links or []}

    def test_manual_receipt_link_and_unlink_without_new_payable(self):
        purchase, _ = self.original()
        line = purchase.lines.first()
        data = self.payload(links=[{"invoice_line_no": 1, "purchase_line": str(line.pk),
            "amount": "180", "quantity": "2"}])
        created = self.client.post(self.url, data, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["validation_status"], "VALID")
        self.assertEqual(created.data["match_status"], "MATCHED")
        self.assertEqual(created.data["status"], "DRAFT")
        purchase.refresh_from_db()
        self.assertEqual(purchase.invoice_status, "INVOICED")
        self.assertEqual(Payable.objects.filter(goods_purchase=purchase).count(), 1)
        self.assertEqual(Payable.objects.filter(invoice_id=created.data["id"]).count(), 0)
        detail = f"/api/v1/purchases/input-invoices/{created.data['id']}/?company_id={self.company.pk}"
        blocked = self.client.post(self.goods_url.replace("goods-purchases/?", f"goods-purchases/{purchase.pk}/unpost/?"),
            {"version": 3, "reason": "Sửa"}, format="json")
        self.assertEqual(blocked.status_code, 400)
        match_id = created.data["links"][0]["id"]
        unlinked = self.client.delete(detail.replace("/?", f"/links/{match_id}/?"))
        self.assertEqual(unlinked.status_code, 200, unlinked.data)
        self.assertEqual(unlinked.data["match_status"], "UNMATCHED")
        purchase.refresh_from_db()
        self.assertEqual(purchase.invoice_status, "NOT_INVOICED")

    def test_duplicate_buyer_tax_and_total_validation(self):
        first = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(self.client.post(self.url, self.payload(), format="json").status_code, 400)
        bad_tax = self.payload(number="02")
        bad_tax["buyer_tax_code"] = "WRONG"
        self.assertEqual(self.client.post(self.url, bad_tax, format="json").status_code, 400)
        bad_total = self.payload(number="03")
        bad_total["total_amount"] = "200"
        self.assertEqual(self.client.post(self.url, bad_total, format="json").status_code, 400)
        self.assertEqual(SupplierInvoice.objects.filter(received_via_purchase=True).count(), 1)

    def test_partial_match_then_later_link(self):
        purchase, _ = self.original()
        line = purchase.lines.first()
        rows = [
            {"line_no": 1, "description": "Item A", "quantity": "1", "unit_price": "90",
             "taxable_amount": "90", "tax_rate_percent": "0", "tax_amount": "0", "total_amount": "90"},
            {"line_no": 2, "description": "Item B", "quantity": "1", "unit_price": "90",
             "taxable_amount": "90", "tax_rate_percent": "0", "tax_amount": "0", "total_amount": "90"}]
        created = self.client.post(self.url, self.payload(number="10", lines=rows,
            links=[{"invoice_line_no": 1, "purchase_line": str(line.pk), "amount": "90", "quantity": "1"}]), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["match_status"], "PARTIALLY_MATCHED")
        detail = f"/api/v1/purchases/input-invoices/{created.data['id']}/links/?company_id={self.company.pk}"
        linked = self.client.post(detail, {"links": [{"invoice_line_no": 2,
            "purchase_line": str(line.pk), "amount": "90", "quantity": "1"}]}, format="json")
        self.assertEqual(linked.status_code, 200, linked.data)
        self.assertEqual(linked.data["match_status"], "MATCHED")
        over = self.client.post(detail, {"links": [{"invoice_line_no": 2,
            "purchase_line": str(line.pk), "amount": "1"}]}, format="json")
        self.assertEqual(over.status_code, 400)
        self.assertEqual(PurchaseInvoiceMatch.objects.count(), 2)

    def test_xml_preview_receive_and_download(self):
        xml = b'''<?xml version="1.0" encoding="utf-8"?><HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>XML26</KHHDon><SHDon>5</SHDon><NLap>2026-10-06</NLap></TTChung><NDHDon><NBan><Ten>Supplier</Ten><MST>9988776655</MST><DChi>Ha Noi</DChi></NBan><NMua><Ten>Goods Ltd</Ten><MST>1234567890</MST></NMua><DSHHDVu><HHDVu><THHDVu>Item</THHDVu><SLuong>2</SLuong><DGia>90</DGia><ThTien>180</ThTien><TSuat>0%</TSuat><TThue>0</TThue></HHDVu></DSHHDVu><TToan><TgTCThue>180</TgTCThue><TgTThue>0</TgTThTBSo><TgTTTBSo>180</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>'''
        xml = xml.replace(b"</TgTThTBSo>", b"</TgTThue>")
        preview_url = f"/api/v1/purchases/input-invoices/preview-xml/?company_id={self.company.pk}"
        preview = self.client.post(preview_url, {"file": SimpleUploadedFile("invoice.xml", xml, content_type="application/xml")}, format="multipart")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["supplier"], str(self.supplier.pk))
        received = self.client.post(f"/api/v1/purchases/input-invoices/receive-xml/?company_id={self.company.pk}",
            {"branch": str(self.branch.pk), "file": SimpleUploadedFile("invoice.xml", xml, content_type="application/xml")},
            format="multipart")
        self.assertEqual(received.status_code, 201, received.data)
        response = self.client.get(f"/api/v1/purchases/input-invoices/{received.data['id']}/files/xml/?company_id={self.company.pk}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, xml)

    def test_replacement_and_adjustment_keep_original_data(self):
        original = self.client.post(self.url, self.payload(number="20"), format="json")
        self.assertEqual(original.status_code, 201, original.data)
        adjustment = self.payload(number="21", amount="20", lines=[{"line_no": 1,
            "description": "Giảm giá", "quantity": "1", "unit_price": "20", "taxable_amount": "20",
            "tax_rate_percent": "0", "tax_amount": "0", "total_amount": "20"}])
        adjustment.update(invoice_type="ADJUSTMENT", adjustment_effect="DECREASE", original_invoice=original.data["id"])
        adjusted = self.client.post(self.url, adjustment, format="json")
        self.assertEqual(adjusted.status_code, 201, adjusted.data)
        original_view = self.client.get(f"/api/v1/purchases/input-invoices/{original.data['id']}/?company_id={self.company.pk}")
        self.assertEqual(Decimal(original_view.data["adjusted_total_amount"]), Decimal("160"))
        replacement = self.payload(number="22")
        replacement.update(invoice_type="REPLACEMENT", original_invoice=original.data["id"])
        replaced = self.client.post(self.url, replacement, format="json")
        self.assertEqual(replaced.status_code, 201, replaced.data)
        self.assertTrue(SupplierInvoice.objects.get(pk=original.data["id"]).is_replaced)
