from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone

from common_services.test_company_setup import FounderCompanyMixin
from general_ledger.models import Account, JournalEntry, PrepaidExpense
from iam.models import Permission, Role, RolePermission


@override_settings(COMMON_REQUIRE_VERIFICATION=False)
class PrepaidExpenseTests(FounderCompanyMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        role = Role.objects.get(company=self.company, code="COMPANY_ADMIN")
        have = set(role.role_permissions.values_list("permission_id", flat=True))
        RolePermission.objects.bulk_create([RolePermission(role=role, permission=p) for p in Permission.objects.exclude(id__in=have)])
        self.q = f"?company_id={self.company.pk}"
        self.today = timezone.localdate().isoformat()
        account = lambda code: str(Account.objects.filter(company=self.company, code__startswith=code, is_postable=True).order_by("code").first().pk)
        self.created = self.client.post(f"/api/v1/general-ledger/prepaid-expenses/{self.q}", {
            "company": str(self.company.pk), "code": "CPTT01", "name": "Thuê văn phòng", "record_date": self.today,
            "amount": "3000000", "allocation_periods": 3, "prepaid_account": account("242"),
            "targets": [{"expense_account": account("6422"), "rate": "100"}],
        }, format="json")

    def test_allocation_posts_one_instalment_per_period(self):
        self.assertEqual(self.created.status_code, 201, self.created.data)
        url = f"/api/v1/general-ledger/prepaid-allocations/{self.q}"
        preview = self.client.get(f"/api/v1/general-ledger/prepaid-allocations/preview/{self.q}&posting_date={self.today}")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(Decimal(preview.data[0]["amount"]), Decimal("1000000"))
        done = self.client.post(url, {"company": str(self.company.pk), "posting_date": self.today}, format="json")
        self.assertEqual(done.status_code, 201, done.data)
        entry = JournalEntry.objects.get(pk=done.data["entry"])
        self.assertEqual(entry.status, "POSTED")
        self.assertEqual({line.account.code[:3]: (line.debit, line.credit) for line in entry.lines.all()},
                         {"642": (Decimal("1000000"), Decimal("0")), "242": (Decimal("0"), Decimal("1000000"))})
        again = self.client.post(url, {"company": str(self.company.pk), "posting_date": self.today}, format="json")
        self.assertEqual(again.status_code, 400)
        prepaid = PrepaidExpense.objects.get(code="CPTT01")
        self.assertEqual((prepaid.allocated_periods, prepaid.remaining_amount), (1, Decimal("2000000")))

    def test_decrease_writes_off_the_remainder_and_stops_allocation(self):
        prepaid = PrepaidExpense.objects.get(code="CPTT01")
        done = self.client.post(f"/api/v1/general-ledger/prepaid-decreases/{self.q}", {
            "company": str(self.company.pk), "document_date": self.today, "reason": "Chấm dứt hợp đồng",
            "lines": [{"prepaid": str(prepaid.pk)}],
        }, format="json")
        self.assertEqual(done.status_code, 201, done.data)
        self.assertEqual(Decimal(done.data["total_amount"]), Decimal("3000000"))
        prepaid.refresh_from_db()
        self.assertEqual((prepaid.status, prepaid.remaining_amount), ("DECREASED", Decimal("0")))
        preview = self.client.get(f"/api/v1/general-ledger/prepaid-allocations/preview/{self.q}&posting_date={self.today}")
        self.assertEqual(preview.data, [])

    def test_rates_must_total_100_percent(self):
        response = self.client.post(f"/api/v1/general-ledger/prepaid-expenses/{self.q}", {
            "company": str(self.company.pk), "code": "CPTT02", "name": "Sai tỷ lệ", "record_date": self.today,
            "amount": "100", "allocation_periods": 1,
            "prepaid_account": str(Account.objects.filter(company=self.company, code__startswith="242", is_postable=True).first().pk),
            "targets": [{"expense_account": str(Account.objects.filter(company=self.company, code__startswith="642", is_postable=True).first().pk), "rate": "50"}],
        }, format="json")
        self.assertEqual(response.status_code, 400)
