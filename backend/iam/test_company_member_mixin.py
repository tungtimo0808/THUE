from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from master_data.models import Currency
from organization.models import Company

from .models import CompanyMembership

# One endpoint from each viewset that resolves its company through CompanyMemberMixin.
ENDPOINTS = (
    "/api/v1/reports/tt99-financial-statements/",
    "/api/v1/reports/export/history/",
    "/api/v1/bank/rules/",
    "/api/v1/cash/forecasts/",
)


class CompanyMemberMixinTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company, self.other = (
            Company.objects.create(code=code, name=code, legal_name=code, tax_code=tax_code,
                                   accounting_currency=currency, legal_reporting_currency=currency)
            for code, tax_code in (("OWN", "0100111111"), ("OTHER", "0100222222"))
        )
        admin = get_user_model().objects.create_superuser(username="mixin-admin", password="password-123")
        self.member = get_user_model().objects.create_user(username="mixin-member", password="password-123")
        CompanyMembership.objects.create(company=self.company, user=self.member.iam_account, created_by=admin.iam_account)
        self.client = APIClient()

    def get(self, path, company=None):
        return self.client.get(f"{path}?company_id={company.pk}" if company else path)

    def test_anonymous_requests_are_rejected(self):
        for path in ENDPOINTS:
            with self.subTest(path=path):
                self.assertEqual(self.get(path, self.company).status_code, 401)

    def test_company_is_required_instead_of_defaulting_to_the_first_one(self):
        self.client.force_authenticate(self.member)
        for path in ENDPOINTS:
            with self.subTest(path=path):
                self.assertEqual(self.get(path).status_code, 400)

    def test_member_reads_own_company_but_not_another(self):
        self.client.force_authenticate(self.member)
        for path in ENDPOINTS:
            with self.subTest(path=path):
                self.assertEqual(self.get(path, self.company).status_code, 200)
                self.assertEqual(self.get(path, self.other).status_code, 403)
