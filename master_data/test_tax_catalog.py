from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from iam.models import CompanyMembership
from organization.models import Company
from .models import Currency, TaxRate, TaxType


class TaxCatalogApiTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Vietnam dong"})
        self.company = Company.objects.create(code="TAXCO", name="Tax Co", legal_name="Tax Co", tax_code="9991001", accounting_currency=currency, legal_reporting_currency=currency)
        self.other = Company.objects.create(code="OTHER", name="Other", legal_name="Other", tax_code="9991002", accounting_currency=currency, legal_reporting_currency=currency)
        self.user = get_user_model().objects.create_superuser(username="tax-admin", email="tax@example.com", password="password")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.types = f"/api/v1/master-data/tax-types/?company_id={self.company.pk}"
        self.rates = f"/api/v1/master-data/tax-rate-configs/?company_id={self.company.pk}"

    def create_type(self):
        response = self.client.post(self.types, {"company": str(self.company.pk), "code": "VAT", "name": "Value added tax", "scope": "SALES", "calculation_method": "PERCENT"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def rate_data(self, tax_type, **overrides):
        data = {"company": str(self.company.pk), "tax_type_ref": tax_type["id"], "code": "VAT10", "name": "VAT 10%", "application_form": "PERCENT", "rate_percent": "10.0000", "business_scope": "OUTPUT", "effective_from": "2026-01-01"}
        data.update(overrides)
        return data

    def test_creation_validation_overlap_and_scope(self):
        tax_type = self.create_type()
        duplicate = self.client.post(self.types, {"company": str(self.company.pk), "code": "vat", "name": "Duplicate", "scope": "SALES", "calculation_method": "PERCENT"}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        wrong_company = self.client.post(self.rates, self.rate_data(tax_type, company=str(self.other.pk)), format="json")
        self.assertEqual(wrong_company.status_code, 400)
        rate = self.client.post(self.rates, self.rate_data(tax_type), format="json")
        self.assertEqual(rate.status_code, 201, rate.data)
        overlap = self.client.post(self.rates, self.rate_data(tax_type, code="VAT8", effective_from="2026-02-01"), format="json")
        self.assertEqual(overlap.status_code, 400)
        other_scope = self.client.post(self.rates, self.rate_data(tax_type, code="VAT_INPUT", business_scope="INPUT"), format="json")
        self.assertEqual(other_scope.status_code, 201, other_scope.data)
        resolved = self.client.get(f"/api/v1/master-data/tax-rate-configs/resolve/?company_id={self.company.pk}&on_date=2026-06-01&business_scope=OUTPUT")
        self.assertEqual(resolved.status_code, 200, resolved.data)
        self.assertEqual([item["code"] for item in resolved.data], ["VAT10"])

    def test_forms_dates_versions_and_deactivation(self):
        tax_type = self.create_type()
        invalid = self.client.post(self.rates, self.rate_data(tax_type, rate_percent="101", effective_to="2025-01-01"), format="json")
        self.assertEqual(invalid.status_code, 400)
        special = self.client.post(self.rates, self.rate_data(tax_type, code="EXEMPT", application_form="EXEMPT", rate_percent=None, business_scope="INPUT"), format="json")
        self.assertEqual(special.status_code, 201, special.data)
        rate = self.client.post(self.rates, self.rate_data(tax_type), format="json")
        self.assertEqual(rate.status_code, 201, rate.data)
        new = self.client.post(f"/api/v1/master-data/tax-rate-configs/{rate.data['id']}/new-version/?company_id={self.company.pk}", {"version": 1, "effective_from": "2027-01-01", "rate_percent": "8.0000"}, format="json")
        self.assertEqual(new.status_code, 201, new.data)
        self.assertEqual(TaxRate.objects.get(pk=rate.data["id"]).effective_to.isoformat(), "2026-12-31")
        stale = self.client.post(f"/api/v1/master-data/tax-rate-configs/{rate.data['id']}/deactivate/?company_id={self.company.pk}", {"version": 1}, format="json")
        self.assertEqual(stale.status_code, 400)
        blocked = self.client.post(f"/api/v1/master-data/tax-types/{tax_type['id']}/deactivate/?company_id={self.company.pk}", {"version": 1}, format="json")
        self.assertEqual(blocked.status_code, 400)

    def test_company_isolation_and_authentication(self):
        tax_type = self.create_type()
        response = self.client.get(f"/api/v1/master-data/tax-types/{tax_type['id']}/?company_id={self.other.pk}")
        self.assertEqual(response.status_code, 404)
        self.client.force_authenticate(user=None)
        response = self.client.get(self.types)
        self.assertEqual(response.status_code, 401)
        regular = get_user_model().objects.create_user(username="tax-reader", password="password")
        CompanyMembership.objects.create(company=self.company, user=regular.iam_account, created_by=self.user.iam_account)
        self.client.force_authenticate(regular)
        self.assertEqual(self.client.get(self.types).status_code, 403)

    def test_import_preview_and_atomic_apply(self):
        tax_type = self.create_type()
        url = f"/api/v1/master-data/tax-rate-configs/import-preview/?company_id={self.company.pk}"
        rows = [self.rate_data(tax_type), self.rate_data(tax_type, code="VAT8", effective_from="2026-02-01")]
        preview = self.client.post(url, {"rows": rows}, format="json")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(len(preview.data["errors"]), 1)
        apply = self.client.post(url.replace("preview", "apply"), {"rows": rows}, format="json")
        self.assertEqual(apply.status_code, 400)
        self.assertEqual(TaxRate.objects.count(), 0)
        rows[1]["business_scope"] = "INPUT"
        apply = self.client.post(url.replace("preview", "apply"), {"rows": rows}, format="json")
        self.assertEqual(apply.status_code, 201, apply.data)
        self.assertEqual(TaxRate.objects.count(), 2)

    def test_csv_preview(self):
        tax_type = self.create_type()
        data = f"company,tax_type_ref,code,name,application_form,rate_percent,business_scope,effective_from\n{self.company.pk},{tax_type['id']},VAT5,VAT 5%,PERCENT,5,OUTPUT,2026-01-01\n"
        upload = SimpleUploadedFile("rates.csv", data.encode("utf-8"), content_type="text/csv")
        response = self.client.post(f"/api/v1/master-data/tax-rate-configs/import-preview/?company_id={self.company.pk}", {"file": upload})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["valid_count"], 1)
