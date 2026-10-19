from django.test import TestCase, override_settings

from common_services.test_company_setup import FounderCompanyMixin
from general_ledger.models import Account
from iam.models import Permission, Role, RolePermission


@override_settings(COMMON_REQUIRE_VERIFICATION=False)
class LoanAgreementTests(FounderCompanyMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        role = Role.objects.get(company=self.company, code="COMPANY_ADMIN")
        have = set(role.role_permissions.values_list("permission_id", flat=True))
        RolePermission.objects.bulk_create([RolePermission(role=role, permission=p) for p in Permission.objects.exclude(id__in=have)])
        self.q = f"?company_id={self.company.pk}"
        self.account = lambda code: str(Account.objects.filter(company=self.company, code__startswith=code, is_postable=True).order_by("code").first().pk)

    def test_credit_contract_and_borrowing_agreement(self):
        contract = self.client.post(f"/api/v1/bank/credit-contracts/{self.q}", {
            "company": str(self.company.pk), "direction": "BORROWING", "number": "HDTD-01", "sign_date": "2026-09-29",
            "partner_name": "BIDV", "credit_limit": "5000000000", "start_date": "2026-10-01", "end_date": "2027-09-30",
        }, format="json")
        self.assertEqual(contract.status_code, 201, contract.data)
        loan = self.client.post(f"/api/v1/bank/loans/{self.q}", {
            "company": str(self.company.pk), "direction": "BORROWING", "number": "KUV-01", "counterparty_name": "BIDV",
            "credit_contract": contract.data["id"], "principal_account": self.account("341"), "interest_account": self.account("635"),
            "amount": "1200000000", "term": 6, "term_unit": "MONTH", "disbursement_date": "2026-10-01", "due_date": "2027-04-01",
            "interest_rates": [{"rate": 8.5, "effective_date": "2026-10-01"}],
        }, format="json")
        self.assertEqual(loan.status_code, 201, loan.data)
        self.assertEqual(loan.data["credit_contract_number"], "HDTD-01")
        listed = self.client.get(f"/api/v1/bank/loans/{self.q}&direction=BORROWING")
        self.assertEqual(len(listed.data["results"] if isinstance(listed.data, dict) else listed.data), 1)

    def test_due_date_before_disbursement_is_rejected(self):
        loan = self.client.post(f"/api/v1/bank/loans/{self.q}", {
            "company": str(self.company.pk), "direction": "LENDING", "number": "KUCV-01", "counterparty_name": "Sao Mai",
            "principal_account": self.account("128"), "interest_account": self.account("515"), "amount": "100",
            "term": 1, "disbursement_date": "2026-10-01", "due_date": "2026-09-01",
        }, format="json")
        self.assertEqual(loan.status_code, 400)
