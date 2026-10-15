from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from master_data.models import Currency, Item, ItemCategory, Party, UnitOfMeasure
from organization.models import Branch, Company
from .models import TaxInvoice, TaxSummary


class TaxApiTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="TAXCO", name="Tax Co", legal_name="Tax Company", tax_code="0100554433",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        self.party = Party.objects.create(company=self.company, code="DT01", name="Đối tác", tax_code="0101234567", default_currency=self.currency)
        uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        category = ItemCategory.objects.create(company=self.company, code="HH", name="Hàng hóa")
        self.item = Item.objects.create(company=self.company, category=category, base_uom=uom, code="SP01", name="Sản phẩm", item_type="GOODS")
        self.user = get_user_model().objects.create_superuser(username="tax-admin", email="tax@test.local", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"
        connector = self.client.post(
            f"/api/v1/tax/connectors/{self.query}",
            {"company": str(self.company.id), "code": "MOCK", "provider": "Mock E-Invoice", "channel": "EINVOICE", "config": {}}, format="json",
        )
        self.assertEqual(connector.status_code, 201, connector.data)
        self.connector = connector.data["id"]
        period = self.client.post(
            f"/api/v1/tax/periods/{self.query}",
            {"company": str(self.company.id), "code": "2026-09", "tax_type": "VAT", "start_date": str(self.today.replace(day=1)), "end_date": str(self.today)}, format="json",
        )
        self.assertEqual(period.status_code, 201, period.data)
        self.period = period.data["id"]

    def create_invoice(self, number, direction="OUTPUT", invoice_type="ORIGINAL", original=None, effect=""):
        seller_tax = self.company.tax_code if direction == "OUTPUT" else self.party.tax_code
        payload = {
            "company": str(self.company.id), "branch": str(self.branch.id), "direction": direction,
            "invoice_type": invoice_type, "adjustment_effect": effect, "original_invoice": original,
            "invoice_series": "C26TAA", "invoice_number": number, "invoice_date": str(self.today),
            "seller_name": self.company.name if direction == "OUTPUT" else self.party.name,
            "seller_tax_code": seller_tax, "buyer_name": self.party.name if direction == "OUTPUT" else self.company.name,
            "buyer_tax_code": self.party.tax_code if direction == "OUTPUT" else self.company.tax_code,
            "party": str(self.party.id), "currency": str(self.currency.id), "exchange_rate": "1",
            "source": "MANUAL", "lines": [{
                "line_no": 1, "item": str(self.item.id), "description": "Hàng hóa",
                "quantity": "1", "unit_price": "1000", "discount_amount": "0", "tax_rate": "10",
            }],
        }
        response = self.client.post(f"/api/v1/tax/invoices/{self.query}", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def validate_and_issue(self, invoice_id, key):
        checked = self.client.post(f"/api/v1/tax/invoices/{invoice_id}/validate/{self.query}", {}, format="json")
        self.assertEqual(checked.status_code, 200, checked.data)
        self.assertEqual(checked.data["status"], "VALIDATED")
        issued = self.client.post(
            f"/api/v1/tax/invoices/{invoice_id}/issue/{self.query}",
            {"connector": self.connector, "idempotency_key": key, "payload": {"invoice": invoice_id}}, format="json",
        )
        self.assertEqual(issued.status_code, 201, issued.data)
        result = self.client.post(
            f"/api/v1/tax/integrations/{issued.data['id']}/result/{self.query}",
            {"status": "SUCCESS", "external_reference": f"EXT-{key}", "response": {"accepted": True}}, format="json",
        )
        self.assertEqual(result.status_code, 200, result.data)

    def test_output_issue_adjustment_chain_and_idempotency(self):
        original = self.create_invoice("000001")
        self.validate_and_issue(original, "ISSUE-001")
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ISSUED")
        adjustment = self.create_invoice("000002", invoice_type="ADJUSTMENT", original=original, effect="DECREASE")
        self.validate_and_issue(adjustment, "ISSUE-002")
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ADJUSTED")
        duplicate_request = self.client.post(
            f"/api/v1/tax/invoices/{adjustment}/issue/{self.query}",
            {"connector": self.connector, "idempotency_key": "ISSUE-002"}, format="json",
        )
        self.assertEqual(duplicate_request.status_code, 400, duplicate_request.data)
        summary = self.client.post(
            f"/api/v1/tax/summaries/build/{self.query}", {"company": str(self.company.id), "period": self.period}, format="json",
        )
        self.assertEqual(Decimal(summary.data["output_tax_amount"]), Decimal("0"))
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="TAX").exists())

    def test_input_link_summary_filing_export_and_reconciliation(self):
        invoice_id = self.create_invoice("000010", direction="INPUT")
        checked = self.client.post(f"/api/v1/tax/invoices/{invoice_id}/validate/{self.query}", {"tax_eligible": True}, format="json")
        self.assertEqual(checked.data["status"], "VALIDATED")
        link = self.client.post(
            f"/api/v1/tax/document-links/{self.query}",
            {
                "company": str(self.company.id), "invoice": invoice_id, "module_code": "AP",
                "entity_type": "SupplierInvoice", "entity_id": "11111111-1111-1111-1111-111111111111",
                "document_number": "AP-001", "linked_amount": "1100",
            }, format="json",
        )
        self.assertEqual(link.status_code, 201, link.data)
        summary = self.client.post(
            f"/api/v1/tax/summaries/build/{self.query}", {"company": str(self.company.id), "period": self.period}, format="json",
        )
        self.assertEqual(summary.status_code, 201, summary.data)
        self.assertEqual(Decimal(summary.data["input_tax_amount"]), Decimal("100"))
        filing = self.client.post(
            f"/api/v1/tax/filings/{self.query}",
            {"company": str(self.company.id), "period": self.period, "summary": summary.data["id"], "filing_type": "VAT_RETURN", "version": 1, "indicators": {}}, format="json",
        )
        self.assertEqual(filing.status_code, 201, filing.data)
        exported = self.client.post(
            f"/api/v1/tax/exports/{self.query}",
            {"company": str(self.company.id), "period": self.period, "filing": filing.data["id"], "format_code": "XML", "format_version": "2.1"}, format="json",
        )
        self.assertEqual(exported.status_code, 201, exported.data)
        self.assertEqual(exported.data["submission_status"], "NOT_SUBMITTED")
        reconciled = self.client.post(
            f"/api/v1/tax/reconciliations/run/{self.query}", {"company": str(self.company.id), "period": self.period}, format="json",
        )
        self.assertEqual(reconciled.status_code, 201, reconciled.data)
        self.assertEqual(reconciled.data["discrepancy_count"], 0)
        self.assertEqual(TaxSummary.objects.filter(period_id=self.period).count(), 1)
