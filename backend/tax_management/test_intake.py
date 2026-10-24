from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from iam.models import UserAccount
from master_data.models import Currency
from master_data.models import Party
from organization.models import Branch, Company
from purchases.models import GoodsPurchase
from .models import InvoiceDocumentLink, InvoiceValidationRun, TaxInvoice, TaxInvoiceSourceFile


XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26TAA</KHHDon>
<SHDon>000123</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><NBan><Ten>Real Seller</Ten><MST>0101234567</MST></NBan>
<NMua><Ten>Buyer Co</Ten><MST>0100554433</MST></NMua>
<DSHHDVu><HHDVu><THHDVu>Service</THHDVu><SLuong>1</SLuong><DGia>1000</DGia>
<ThTien>1000</ThTien><TSuat>10%</TSuat><TThue>100</TThue></HHDVu></DSHHDVu>
<TToan><TgTCThue>1000</TgTCThue><TgTThue>100</TgTThue><TgTTTBSo>1100</TgTTTBSo></TToan>
</NDHDon></DLHDon></HDon>"""


class InputInvoiceIntakeTests(TestCase):
    def setUp(self):
        currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(code="INTAKE", name="Buyer Co", legal_name="Buyer Co",
                                              tax_code="0100554433", accounting_currency=currency,
                                              legal_reporting_currency=currency)
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Head Office")
        user = get_user_model().objects.create_superuser(username="intake-admin", email="intake@test.local", password="x")
        self.user = user
        self.client = APIClient()
        self.client.force_authenticate(user)
        self.url = "/api/v1/tax/invoices/receive-input-xml/"

    def send(self, content=XML, filename="seller.xml"):
        return self.client.post(self.url, {"company": str(self.company.id), "branch": str(self.branch.id),
                                           "file": SimpleUploadedFile(filename, content, content_type="application/xml")})

    def test_receive_and_reupload_are_safe(self):
        first = self.send()
        self.assertEqual(first.status_code, 201, first.data)
        invoice = TaxInvoice.objects.get(pk=first.data["invoice"]["id"])
        self.assertEqual(invoice.status, "RECEIVED")
        self.assertFalse(invoice.tax_eligible)
        self.assertIsNone(invoice.party)
        self.assertEqual(invoice.validation_summary["processing_status"], "MANUAL_REVIEW")
        self.assertEqual(InvoiceValidationRun.objects.get(invoice=invoice).trigger_type, "AFTER_INTAKE")
        self.assertEqual(invoice.lines.count(), 1)
        self.assertEqual(TaxInvoiceSourceFile.objects.get(invoice=invoice).content, XML)
        source = self.client.get(f"/api/v1/tax/invoices/{invoice.pk}/source-xml/?company_id={self.company.pk}")
        self.assertEqual(source.status_code, 200)
        self.assertEqual(source.content, XML)
        second = self.send()
        self.assertEqual(second.status_code, 200, second.data)
        self.assertTrue(second.data["duplicate"])
        self.assertEqual(TaxInvoice.objects.count(), 1)

    def test_invalid_file_does_not_create_invoice(self):
        response = self.send(b"<broken", "bad.xml")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(TaxInvoice.objects.exists())
        missing_total = self.send(XML.replace(b"<TgTTTBSo>1100</TgTTTBSo>", b""))
        self.assertEqual(missing_total.status_code, 400)
        self.assertFalse(TaxInvoice.objects.exists())

    def test_validation_keeps_runs_and_does_not_claim_unverified_signature(self):
        invoice_id = self.send().data["invoice"]["id"]
        url = f"/api/v1/tax/invoices/{invoice_id}/validate/?company_id={self.company.pk}"
        first = self.client.post(url, {}, format="json")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["validation_summary"]["processing_status"], "MANUAL_REVIEW")
        self.assertFalse(first.data["tax_eligible"])
        history_url = f"/api/v1/tax/invoices/{invoice_id}/history/?company_id={self.company.pk}"
        history = self.client.get(history_url)
        self.assertEqual(history.status_code, 200, history.data)
        self.assertTrue(history.data["runs"][0]["is_current"])
        signature = next(row for row in history.data["runs"][0]["results"] if row["code"] == "SIGN-01")
        self.assertEqual(signature["result"], "NOT_CHECKED")
        self.client.post(url, {}, format="json")
        self.assertEqual(InvoiceValidationRun.objects.filter(invoice_id=invoice_id).count(), 3)
        TaxInvoice.objects.filter(pk=invoice_id).update(buyer_name="Changed")
        history = self.client.get(history_url)
        self.assertFalse(history.data["runs"][0]["is_current"])

    def test_buyer_mismatch_is_failed_without_tax_eligibility(self):
        content = XML.replace(b"0100554433", b"9999999999")
        invoice_id = self.send(content).data["invoice"]["id"]
        checked = self.client.post(f"/api/v1/tax/invoices/{invoice_id}/validate/?company_id={self.company.pk}", {}, format="json")
        self.assertEqual(checked.status_code, 200, checked.data)
        self.assertEqual(checked.data["validation_summary"]["processing_status"], "FAILED")
        self.assertEqual(checked.data["status"], "BLOCKED")
        self.assertFalse(checked.data["tax_eligible"])

    def test_purchase_link_requires_real_document_and_tracks_remaining(self):
        invoice_id = self.send().data["invoice"]["id"]
        supplier = Party.objects.create(company=self.company, code="SUP", name="Real Seller",
                                        tax_code="0101234567", default_currency=self.company.accounting_currency)
        purchase = GoodsPurchase.objects.create(
            company=self.company, branch=self.branch, number="PUR-001", document_date="2026-10-20",
            posting_date="2026-10-20", status="POSTED", purchase_type="DIRECT", payment_type="UNPAID",
            supplier=supplier, subtotal="1000", tax_amount="100", total_amount="1100",
            created_by=UserAccount.objects.first(),
        )
        base = f"/api/v1/tax/invoices/{invoice_id}/"
        candidates = self.client.get(base + f"link-candidates/?company_id={self.company.pk}")
        self.assertEqual(candidates.status_code, 200, candidates.data)
        self.assertEqual(candidates.data["candidates"][0]["id"], str(purchase.pk))
        payload = {"purchase_id": str(purchase.pk), "version": purchase.version,
                   "allocated_amount_before_tax": "1000", "allocated_tax_amount": "100"}
        self.assertEqual(self.client.post(base + f"link-purchase/?company_id={self.company.pk}", payload, format="json").status_code, 400)
        payload["notes"] = "Đã đối chiếu thủ công XML và chứng từ mua."
        linked = self.client.post(base + f"link-purchase/?company_id={self.company.pk}", payload, format="json")
        self.assertEqual(linked.status_code, 201, linked.data)
        self.assertEqual(linked.data["status"], "LINKED")
        self.assertEqual(linked.data["remaining_amount"], "0")
        self.assertEqual(self.client.post(base + f"link-purchase/?company_id={self.company.pk}", payload, format="json").status_code, 400)
        self.assertEqual(InvoiceDocumentLink.objects.filter(invoice_id=invoice_id, status="ACTIVE").count(), 1)
        second_xml = XML.replace(b"000123", b"000124")
        second_id = self.send(second_xml).data["invoice"]["id"]
        second_base = f"/api/v1/tax/invoices/{second_id}/"
        self.assertEqual(self.client.get(second_base + f"link-candidates/?company_id={self.company.pk}").data["candidates"], [])
        self.assertEqual(self.client.post(second_base + f"link-purchase/?company_id={self.company.pk}", payload, format="json").status_code, 400)
        removed = self.client.post(base + f"unlink-purchase/?company_id={self.company.pk}", {
            "link_id": linked.data["links"][0]["id"], "reason": "Gỡ liên kết để sửa phân bổ."}, format="json")
        self.assertEqual(removed.status_code, 200, removed.data)
        self.assertEqual(removed.data["status"], "UNLINKED")
        self.assertEqual(InvoiceDocumentLink.objects.get(invoice_id=invoice_id).status, "REMOVED")
        self.assertEqual(self.client.post(second_base + f"link-purchase/?company_id={self.company.pk}", payload, format="json").status_code, 201)
