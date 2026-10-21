from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership
from organization.models import Company
from sales.models import SalesQuotation
from .models import Currency, Party, PaymentTerm


class PaymentTermApiTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Vietnam dong"})
        self.company = Company.objects.create(code="PTCO", name="Terms", legal_name="Terms Ltd", tax_code="9911001", accounting_currency=currency, legal_reporting_currency=currency)
        self.other = Company.objects.create(code="PTOTHER", name="Other", legal_name="Other Ltd", tax_code="9911002", accounting_currency=currency, legal_reporting_currency=currency)
        self.user = get_user_model().objects.create_superuser(username="pt-admin", email="pt@example.com", password="password")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f"/api/v1/master-data/payment-terms/?company_id={self.company.pk}"

    def payload(self, **overrides):
        data = {"company": str(self.company.pk), "code": "NET30", "name": "Net 30", "scope": "BOTH", "due_base": "DOCUMENT", "due_days": 30, "has_discount": True, "discount_days": 10, "discount_rate": "2.000000"}
        data.update(overrides)
        return data

    def create(self, **overrides):
        response = self.client.post(self.url, self.payload(**overrides), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def detail(self, term):
        return f"/api/v1/master-data/payment-terms/{term['id']}/?company_id={self.company.pk}"

    def test_validation_uniqueness_and_company_scope(self):
        term = self.create()
        self.assertEqual(self.client.post(self.url, self.payload(code="net30"), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(due_days=-1, code="NEG"), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(discount_days=31, code="LATE"), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(discount_rate="101", code="HIGH"), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(effective_from="2027-01-01", effective_to="2026-01-01", code="BADDATE"), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(company=str(self.other.pk), code="OTHER"), format="json").status_code, 400)
        missing = self.payload(code="MISSING")
        missing.pop("due_base")
        self.assertEqual(self.client.post(self.url, missing, format="json").status_code, 400)
        self.assertEqual(self.client.get(f"/api/v1/master-data/payment-terms/{term['id']}/?company_id={self.other.pk}").status_code, 404)
        self.assertTrue(AuditLog.objects.filter(entity_id=term["id"], action_code="CREATE").exists())

    def test_defaults_suggestion_and_dates(self):
        first = self.create()
        second = self.create(code="NET0", name="Immediate", due_days=0, has_discount=False, discount_days=None, discount_rate=None)
        set_default = self.client.post(self.detail(first).replace("/?", "/set-default/?"), {"scope": "SALE", "version": 1}, format="json")
        self.assertEqual(set_default.status_code, 200, set_default.data)
        move_default = self.client.post(self.detail(second).replace("/?", "/set-default/?"), {"scope": "SALE", "version": 1}, format="json")
        self.assertEqual(move_default.status_code, 200, move_default.data)
        self.assertFalse(PaymentTerm.objects.get(pk=first["id"]).default_sale)
        self.assertTrue(PaymentTerm.objects.get(pk=second["id"]).default_sale)
        party = Party.objects.create(company=self.company, code="C1", name="Customer", payment_term_id=first["id"])
        suggested = self.client.get(f"/api/v1/master-data/payment-terms/suggest/?company_id={self.company.pk}&scope=SALE&on_date=2026-06-01&party_id={party.pk}")
        self.assertEqual(suggested.data["id"], first["id"])
        calculated = self.client.get(self.detail(first).replace("/?", "/calculate/?") + "&document_date=2026-06-01&actual_payment_date=2026-06-08")
        self.assertEqual(calculated.status_code, 200, calculated.data)
        self.assertEqual(calculated.data["due_date"], date(2026, 7, 1))
        self.assertTrue(calculated.data["discount_eligible"])
        missing = self.client.get(self.detail(first).replace("/?", "/calculate/?"))
        self.assertEqual(missing.status_code, 400)

    def test_monthly_due_day_clamps_to_last_day(self):
        term = self.create(code="MONTH31", name="Monthly 31", due_mode="MONTHLY",
                           due_day_of_month=31, due_after_months=1,
                           has_discount=False, discount_days=None, discount_rate=None)
        response = self.client.get(self.detail(term).replace("/?", "/calculate/?") + "&document_date=2026-01-10")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["due_date"], date(2026, 2, 28))
        invalid = self.client.post(self.url, self.payload(code="MONTHBAD", due_mode="MONTHLY",
            due_day_of_month=32, has_discount=False, discount_days=None, discount_rate=None), format="json")
        self.assertEqual(invalid.status_code, 400)

    def test_copy_version_and_deactivate_default(self):
        first = self.create()
        copied = self.client.post(self.detail(first).replace("/?", "/copy/?"), {"code": "NET45", "name": "Net 45", "due_days": 45}, format="json")
        self.assertEqual(copied.status_code, 201, copied.data)
        self.assertEqual(copied.data["due_days"], 45)
        stale = self.client.patch(self.detail(first), {"version": 99, "name": "Changed"}, format="json")
        self.assertEqual(stale.status_code, 400)
        updated = self.client.patch(self.detail(first), {"version": 1, "name": "Changed"}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["version"], 2)
        self.client.post(self.detail(first).replace("/?", "/set-default/?"), {"version": 2, "scope": "PURCHASE"}, format="json")
        blocked = self.client.post(self.detail(first).replace("/?", "/deactivate/?"), {"version": 3}, format="json")
        self.assertEqual(blocked.status_code, 400)
        stopped = self.client.post(self.detail(first).replace("/?", "/deactivate/?"), {"version": 3, "clear_default": True}, format="json")
        self.assertEqual(stopped.status_code, 200, stopped.data)
        self.assertFalse(stopped.data["default_purchase"])

    def test_code_is_locked_after_document_use(self):
        term = self.create()
        customer = Party.objects.create(company=self.company, code="C2", name="Customer")
        currency = self.company.accounting_currency
        SalesQuotation.objects.create(company=self.company, number="Q-TERM", document_date=date(2026, 6, 1),
                                      valid_until=date(2026, 7, 1), customer=customer, currency=currency,
                                      payment_term_id=term["id"], created_by=self.user.iam_account)
        response = self.client.patch(self.detail(term), {"version": 1, "code": "NEWCODE"}, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(PaymentTerm.objects.get(pk=term["id"]).code, "NET30")

    def test_import_atomic_and_permissions(self):
        rows = [self.payload(code="A"), self.payload(code="B", discount_days=40)]
        preview_url = f"/api/v1/master-data/payment-terms/import-preview/?company_id={self.company.pk}"
        preview = self.client.post(preview_url, {"rows": rows}, format="json")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(len(preview.data["errors"]), 1)
        apply = self.client.post(preview_url.replace("preview", "apply"), {"rows": rows}, format="json")
        self.assertEqual(apply.status_code, 400)
        self.assertEqual(PaymentTerm.objects.count(), 0)
        rows[1]["discount_days"] = 8
        apply = self.client.post(preview_url.replace("preview", "apply"), {"rows": rows}, format="json")
        self.assertEqual(apply.status_code, 201, apply.data)
        self.assertEqual(PaymentTerm.objects.count(), 2)
        regular = get_user_model().objects.create_user(username="pt-user", password="password")
        CompanyMembership.objects.create(company=self.company, user=regular.iam_account, created_by=self.user.iam_account)
        self.client.force_authenticate(regular)
        self.assertEqual(self.client.get(self.url).status_code, 403)
