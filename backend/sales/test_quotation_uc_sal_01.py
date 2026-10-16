from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from master_data.models import Currency, Item, Party, PartyContact, PartyRole, TaxRate, UnitOfMeasure, Warehouse
from general_ledger.models import JournalEntry
from accounts_receivable.models import Receivable
from organization.models import Company
from .models import SalesOrder, SalesQuotation


class QuotationUcSal01Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(code="SAL01", name="Sales 01", legal_name="Sales 01",
                                              tax_code="0100000101", accounting_currency=self.currency,
                                              legal_reporting_currency=self.currency)
        self.user = get_user_model().objects.create_superuser(username="sal01", email="sal01@example.com", password="test")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.customer = Party.objects.create(company=self.company, code="KH01", name="Khách 01")
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)
        PartyContact.objects.create(party=self.customer, contact_type="SALES", contact_name="Buyer", email="buyer@example.com")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái", decimal_places=6)
        self.tax = TaxRate.objects.create(company=self.company, code="VAT10", tax_type="VAT",
                                          rate_percent=10, effective_from=self.today - timedelta(days=1),
                                          business_scope="OUTPUT")
        self.item = Item.objects.create(company=self.company, code="SP01", name="Sản phẩm 01",
                                        item_type="GOODS", base_uom=self.uom, sales_uom=self.uom,
                                        sales_price="100", sales_tax_rate=self.tax, track_inventory=False)
        self.url = f"/api/v1/sales/quotations/?company_id={self.company.id}"

    def payload(self, **changes):
        data = {"company": str(self.company.id), "customer": str(self.customer.id),
                "lines": [{"item": str(self.item.id), "uom": str(self.uom.id), "quantity": "2.000001",
                           "unit_price": "100", "discount_rate": "10", "tax_rate": str(self.tax.id)}]}
        data.update(changes)
        return data

    def test_draft_issue_pdf_response_and_order_prefill(self):
        draft = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(draft.status_code, 201, draft.data)
        self.assertEqual(draft.data["number"], f"BG-{self.today.year}-000001")
        self.assertEqual(draft.data["status"], "DRAFT")
        self.assertEqual(draft.data["valid_until"], str(self.today + timedelta(days=15)))
        quote_id = draft.data["id"]
        before_accounting = (JournalEntry.objects.count(), Receivable.objects.count())
        issued = self.client.post(self.url.replace("?", f"{quote_id}/issue/?"), {}, format="json")
        self.assertEqual(issued.status_code, 200, issued.data)
        self.assertEqual(issued.data["status"], "ISSUED")
        self.assertEqual(Decimal(issued.data["total_amount"]), Decimal("198"))
        self.assertEqual(Decimal(issued.data["lines"][0]["total_amount"]), Decimal("198"))
        self.assertEqual((JournalEntry.objects.count(), Receivable.objects.count()), before_accounting)
        pdf = self.client.get(self.url.replace("?", f"{quote_id}/pdf/?"))
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        self.assertEqual(self.client.patch(self.url.replace("?", f"{quote_id}/?"), {"notes": "edit"}, format="json").status_code, 400)
        sent = self.client.post(self.url.replace("?", f"{quote_id}/email/?"), {}, format="json")
        self.assertEqual(sent.status_code, 200, sent.data)
        self.assertEqual(len(mail.outbox), 1)
        accepted = self.client.post(self.url.replace("?", f"{quote_id}/accept-response/?"),
                                    {"response_date": str(self.today), "response_content": "Đồng ý"}, format="json")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        prefill = self.client.get(self.url.replace("?", f"{quote_id}/prepare-order/?"))
        self.assertEqual(prefill.status_code, 200, prefill.data)
        self.assertEqual(prefill.data["quotation"], quote_id)
        order_payload = {**prefill.data, "number": "SO-SAL01-1", "document_date": str(self.today)}
        order = self.client.post(f"/api/v1/sales/orders/?company_id={self.company.id}", order_payload, format="json")
        self.assertEqual(order.status_code, 201, order.data)
        self.assertEqual(SalesOrder.objects.filter(quotation_id=quote_id).count(), 1)
        self.assertEqual(self.client.get(self.url.replace("?", f"{quote_id}/prepare-order/?")).status_code, 400)
        self.assertEqual(self.client.post(f"/api/v1/sales/orders/?company_id={self.company.id}",
                                          {**order_payload, "number": "SO-SAL01-2"}, format="json").status_code, 400)

    def test_issue_new_numbering_validation_duplicate_version_and_cancel(self):
        bad = self.client.post(self.url.replace("?", "issue/?"), self.payload(lines=[]), format="json")
        self.assertEqual(bad.status_code, 400)
        self.assertFalse(SalesQuotation.objects.exists())
        first = self.client.post(self.url.replace("?", "issue/?"), self.payload(), format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["number"], f"BG-{self.today.year}-000001")
        quote_id = first.data["id"]
        duplicate = self.client.get(self.url.replace("?", f"{quote_id}/duplicate/?"))
        self.assertEqual(duplicate.status_code, 200)
        self.assertNotIn("number", duplicate.data)
        self.assertEqual(SalesQuotation.objects.count(), 1)
        version = self.client.post(self.url.replace("?", f"{quote_id}/new-version/?"), {}, format="json")
        self.assertEqual(version.status_code, 201, version.data)
        self.assertEqual(version.data["version"], 2)
        self.assertEqual(version.data["number"], f"BG-{self.today.year}-000002")
        self.assertEqual(str(version.data["original_quotation"]), quote_id)
        third = self.client.post(self.url.replace("?", f"{quote_id}/new-version/?"), {}, format="json")
        self.assertEqual(third.status_code, 201, third.data)
        self.assertEqual(third.data["version"], 3)
        cancelled = self.client.post(self.url.replace("?", f"{version.data['id']}/cancel/?"), {"reason": "Sai giá"}, format="json")
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(cancelled.data["status"], "CANCELLED")
        next_draft = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(next_draft.data["number"], f"BG-{self.today.year}-000004")

    def test_decline_and_invalid_values(self):
        invalid = self.client.post(self.url.replace("?", "issue/?"), self.payload(lines=[{
            "item": str(self.item.id), "uom": str(self.uom.id), "quantity": "0", "unit_price": "10",
            "tax_rate": str(self.tax.id)}]), format="json")
        self.assertEqual(invalid.status_code, 400)
        issued = self.client.post(self.url.replace("?", "issue/?"), self.payload(), format="json")
        quote_id = issued.data["id"]
        self.assertEqual(self.client.post(self.url.replace("?", f"{quote_id}/decline-response/?"),
                                          {"response_date": str(self.today)}, format="json").status_code, 400)
        declined = self.client.post(self.url.replace("?", f"{quote_id}/decline-response/?"),
                                    {"response_date": str(self.today), "reason": "Không phù hợp"}, format="json")
        self.assertEqual(declined.status_code, 200, declined.data)
        self.assertEqual(declined.data["status"], "DECLINED")
        self.assertEqual(self.client.get(self.url.replace("?", f"{quote_id}/prepare-order/?")).status_code, 400)

    def test_minimal_draft_can_be_completed_before_issue(self):
        draft = self.client.post(self.url, self.payload(lines=[{"item": str(self.item.id),
                                                               "unit_price": None}]), format="json")
        self.assertEqual(draft.status_code, 201, draft.data)
        quote_id = draft.data["id"]
        self.assertEqual(self.client.post(self.url.replace("?", f"{quote_id}/issue/?"), {}, format="json").status_code, 400)
        updated = self.client.patch(self.url.replace("?", f"{quote_id}/?"),
                                    {"lines": self.payload()["lines"]}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        issued = self.client.post(self.url.replace("?", f"{quote_id}/issue/?"), {}, format="json")
        self.assertEqual(issued.status_code, 200, issued.data)

    def test_validity_setting_and_inactive_tax_rejected(self):
        settings_url = self.url.replace("?", "settings/?")
        self.assertEqual(self.client.get(settings_url).data["validity_days"], 15)
        self.assertEqual(self.client.patch(settings_url, {"validity_days": 21}, format="json").status_code, 200)
        defaults = self.client.get(self.url.replace("?", "defaults/?") +
                                   f"&customer_id={self.customer.id}&item_id={self.item.id}")
        self.assertEqual(defaults.status_code, 200, defaults.data)
        self.assertEqual(defaults.data["item"]["tax_rate_id"], str(self.tax.id))
        self.assertEqual(defaults.data["customer"]["email"], "buyer@example.com")
        draft = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(draft.status_code, 201, draft.data)
        self.assertEqual(draft.data["valid_until"], str(self.today + timedelta(days=21)))
        self.tax.status = "INACTIVE"
        self.tax.save()
        rejected = self.client.post(self.url.replace("?", f"{draft.data['id']}/issue/?"), {}, format="json")
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(SalesQuotation.objects.get(pk=draft.data["id"]).status, "DRAFT")

    def test_issued_quote_expires_on_read(self):
        issued = self.client.post(self.url.replace("?", "issue/?"), self.payload(), format="json")
        self.assertEqual(issued.status_code, 201, issued.data)
        SalesQuotation.objects.filter(pk=issued.data["id"]).update(
            document_date=self.today - timedelta(days=20), valid_until=self.today - timedelta(days=1))
        detail = self.client.get(self.url.replace("?", f"{issued.data['id']}/?"))
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["status"], "EXPIRED")
        self.assertEqual(len(self.client.get(self.url + "&status=EXPIRED").data), 1)

    def test_pdf_failure_rolls_back_issue_and_number(self):
        with patch("sales.quotation_services.render_quotation_pdf", side_effect=RuntimeError("PDF failed")):
            failed = self.client.post(self.url.replace("?", "issue/?"), self.payload(), format="json")
        self.assertEqual(failed.status_code, 500, failed.data)
        self.assertFalse(SalesQuotation.objects.exists())
        issued = self.client.post(self.url.replace("?", "issue/?"), self.payload(), format="json")
        self.assertEqual(issued.status_code, 201, issued.data)
        self.assertEqual(issued.data["number"], f"BG-{self.today.year}-000001")
