from datetime import date
from decimal import Decimal

from django.test import TestCase, override_settings

from common_services.test_company_setup import FounderCompanyMixin
from iam.models import Permission, Role, RolePermission, UserAccount
from tax_management.models import IntegrationRequest, TaxObligation, TaxPeriod


@override_settings(COMMON_REQUIRE_VERIFICATION=False)
class TaxAuthorityAndEPaymentTests(FounderCompanyMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        role = Role.objects.get(company=self.company, code="COMPANY_ADMIN")
        have = set(role.role_permissions.values_list("permission_id", flat=True))
        RolePermission.objects.bulk_create([RolePermission(role=role, permission=p) for p in Permission.objects.exclude(id__in=have)])
        self.q = f"?company_id={self.company.pk}"
        period = TaxPeriod.objects.create(company=self.company, code="2026-09", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30))
        self.obligation = TaxObligation.objects.create(
            company=self.company, period=period, tax_type="VAT", due_date=date(2026, 10, 20),
            assessed_amount=Decimal("5000000"), created_by=UserAccount.objects.get(auth_user__email="founder@example.test"),
        )
        self.pay_url = f"/api/v1/tax/obligations/{self.obligation.pk}/e-payment/{self.q}"

    def test_e_payment_requires_the_managing_tax_office(self):
        response = self.client.post(self.pay_url, {"company": str(self.company.pk)}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_settings_round_trip_and_e_payment_is_queued_for_the_portal(self):
        url = f"/api/v1/tax/authority-settings/{self.q}"
        saved = self.client.put(url, {
            "company": str(self.company.pk), "department": "101 - Cục Thuế Hà Nội", "branch_office": "10109 - Chi cục Thuế Cầu Giấy",
            "registered_forms": [{"code": "01/GTGT", "name": "Tờ khai thuế GTGT", "frequency": "MONTH"}],
        }, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(self.client.get(url).data["registered_forms"][0]["code"], "01/GTGT")
        queued = self.client.post(self.pay_url, {"company": str(self.company.pk), "amount": "2000000", "treasury": "KBNN Cầu Giấy"}, format="json")
        self.assertEqual(queued.status_code, 201, queued.data)
        request = IntegrationRequest.objects.get(pk=queued.data["id"])
        self.assertEqual((request.status, request.task_type, request.request_payload["amount"]), ("PENDING", "E_PAYMENT", "2000000"))
        duplicate = self.client.post(self.pay_url, {"company": str(self.company.pk)}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        too_much = IntegrationRequest.objects.filter(obligation=self.obligation).count()
        self.assertEqual(too_much, 1)
