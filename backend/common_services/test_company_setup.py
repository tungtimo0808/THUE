from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from common_services.module_services import check_module_active
from general_ledger.models import Account, AccountingPeriod
from master_data.models import PaymentTerm, TaxRate, UnitOfMeasure, Warehouse
from organization.models import Company, CompanyStatus


class FounderCompanyMixin:
    """Registers a founder and creates their (PENDING_SETUP) company through the public API."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.post("/api/v1/common/auth/register/", {
            "display_name": "Founder", "email": "founder@example.test", "phone": "0901234500",
            "password": "Founder@12345", "confirm_password": "Founder@12345", "terms_accepted": True,
        }, format="json")
        token = self.client.post("/api/token/", {"email": "founder@example.test", "password": "Founder@12345"}, format="json").data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        created = self.client.post("/api/v1/common/companies/create/", {
            "name": "Setup Co", "legal_name": "Setup Co", "tax_code": "0101112223", "business_type": "LLC_ONE_MEMBER",
            "address": "Hà Nội", "province": "Hà Nội", "legal_representative": "Founder",
            "confirmed_authority": True, "fiscal_year_start_month": 1,
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.company = Company.objects.get(pk=created.data["id"])
        self.url = f"/api/v1/common/companies/complete-setup/?company_id={self.company.pk}"


@override_settings(COMMON_REQUIRE_VERIFICATION=False)
class CompanySetupTests(FounderCompanyMixin, TestCase):
    """A newly created company starts PENDING_SETUP; complete-setup gives it the posting foundations."""

    def test_new_company_is_pending_until_setup_completes(self):
        self.assertEqual(self.company.status, CompanyStatus.PENDING_SETUP)
        response = self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.status, CompanyStatus.ACTIVE)
        self.assertTrue(Account.objects.filter(company=self.company, code="1331").exists())
        self.assertEqual(AccountingPeriod.objects.filter(company=self.company).count(), 12)
        self.assertEqual(TaxRate.objects.filter(company=self.company).count(), 4)
        self.assertTrue(UnitOfMeasure.objects.filter(company=self.company).exists())
        self.assertTrue(PaymentTerm.objects.filter(company=self.company, default_purchase=True).exists())
        self.assertTrue(Warehouse.objects.filter(company=self.company).exists())
        for module in ("GL", "PUR", "SAL", "INV", "FA", "CASH", "BANK", "TAX"):
            self.assertTrue(check_module_active(self.company, module), module)

    def test_setup_is_idempotent(self):
        self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        accounts = Account.objects.filter(company=self.company).count()
        again = self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        self.assertEqual(again.status_code, 200, again.data)
        self.assertEqual(Account.objects.filter(company=self.company).count(), accounts)
        self.assertEqual(TaxRate.objects.filter(company=self.company).count(), 4)

    def test_outsider_cannot_complete_setup(self):
        outsider = APIClient()
        response = outsider.post(self.url, {"company": str(self.company.pk)}, format="json")
        self.assertIn(response.status_code, (401, 403))
        self.company.refresh_from_db()
        self.assertEqual(self.company.status, CompanyStatus.PENDING_SETUP)
