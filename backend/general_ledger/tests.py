from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIClient

from master_data.models import Currency
from organization.models import Company

from .models import Account, AccountClass, ChartOfAccounts


class GeneralLedgerTransactionTests(TestCase):
    def setUp(self):
        from organization.models import Branch
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.currency = currency
        self.company = Company.objects.create(
            code="GLTX", name="GL Transaction", legal_name="GL Transaction Ltd", tax_code="0100666688",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        account_class = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="Hệ thống", effective_from="2026-01-01", is_default=True)
        self.cash = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code="1111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT")
        self.expense = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code="6421", name="Chi phí", account_type="EXPENSE", normal_balance="DEBIT")
        self.destination = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code="6422", name="Chi phí phân bổ", account_type="EXPENSE", normal_balance="DEBIT")
        self.retained = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code="911", name="Kết quả", account_type="EQUITY", normal_balance="CREDIT")
        self.maker = get_user_model().objects.create_superuser(username="gl-maker", email="maker@gl.test", password="x")
        self.approver = get_user_model().objects.create_superuser(username="gl-approver", email="approver@gl.test", password="x")
        self.poster = get_user_model().objects.create_superuser(username="gl-poster", email="poster@gl.test", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.maker)
        self.query = f"?company_id={self.company.id}"
        period = self.client.post(
            f"/api/v1/general-ledger/periods/{self.query}",
            {"company": str(self.company.id), "code": "2026-09", "fiscal_year": 2026, "period_number": 9, "start_date": "2026-09-01", "end_date": "2026-09-30"}, format="json",
        )
        self.assertEqual(period.status_code, 201, period.data)
        self.period = period.data["id"]

    def create_and_post(self, number="JV-001", source_event=None):
        payload = {
            "company": str(self.company.id), "branch": str(self.branch.id), "period": self.period,
            "number": number, "entry_type": "SUBLEDGER" if source_event else "MANUAL",
            "posting_date": "2026-09-25", "document_date": "2026-09-25", "description": "Chi phí phát sinh",
            "source_module": "AP" if source_event else "", "source_event_id": source_event,
            "lines": [
                {"line_no": 1, "account": str(self.expense.id), "debit": "100", "credit": "0", "currency": str(self.currency.id), "exchange_rate": "1"},
                {"line_no": 2, "account": str(self.cash.id), "debit": "0", "credit": "100", "currency": str(self.currency.id), "exchange_rate": "1"},
            ],
        }
        created = self.client.post(f"/api/v1/general-ledger/journals/{self.query}", payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        entry_id = created.data["id"]
        submitted = self.client.post(f"/api/v1/general-ledger/journals/{entry_id}/submit/{self.query}", {}, format="json")
        self.assertEqual(submitted.data["status"], "PENDING_APPROVAL", submitted.data)
        self.client.force_authenticate(self.approver)
        approved = self.client.post(f"/api/v1/general-ledger/journals/{entry_id}/approve/{self.query}", {"comment": "Duyệt"}, format="json")
        self.assertEqual(approved.data["status"], "APPROVED", approved.data)
        self.client.force_authenticate(self.poster)
        posted = self.client.post(f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.client.force_authenticate(self.maker)
        return entry_id

    def test_journal_balance_reconciliation_reverse_close_and_reopen(self):
        from decimal import Decimal
        from .models import AccountBalance
        entry_id = self.create_and_post()
        balance = AccountBalance.objects.get(period_id=self.period, account=self.expense, branch=self.branch)
        self.assertEqual(balance.period_debit, Decimal("100"))
        reconciliation = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {"company": str(self.company.id), "period": self.period, "account": str(self.expense.id), "source_module": "AP", "subledger_amount": "100"}, format="json",
        )
        self.assertEqual(reconciliation.status_code, 201, reconciliation.data)
        self.assertEqual(reconciliation.data["status"], "MATCHED")
        self.client.force_authenticate(self.poster)
        reversed_entry = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/reverse/{self.query}",
            {"period": self.period, "posting_date": "2026-09-26", "number": "REV-JV-001", "reason": "Sửa sai"}, format="json",
        )
        self.assertEqual(reversed_entry.status_code, 201, reversed_entry.data)
        balance.refresh_from_db()
        self.assertEqual(balance.closing_debit, Decimal("0"))
        closed = self.client.post(f"/api/v1/general-ledger/periods/{self.period}/close/{self.query}", {}, format="json")
        self.assertEqual(closed.data["status"], "CLOSED")
        reopened = self.client.post(f"/api/v1/general-ledger/periods/{self.period}/reopen/{self.query}", {"reason": "Điều chỉnh kiểm toán"}, format="json")
        self.assertEqual(reopened.data["status"], "OPEN")

    def test_subledger_idempotency_allocation_and_closing(self):
        from decimal import Decimal
        from .models import AccountBalance
        self.create_and_post("AP-GL-001", "AP:INVOICE:001")
        duplicate = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id), "branch": str(self.branch.id), "period": self.period,
                "number": "AP-GL-002", "entry_type": "SUBLEDGER", "posting_date": "2026-09-25",
                "description": "Trùng", "source_module": "AP", "source_event_id": "AP:INVOICE:001",
                "lines": [
                    {"line_no": 1, "account": str(self.expense.id), "debit": "100", "credit": "0", "currency": str(self.currency.id)},
                    {"line_no": 2, "account": str(self.cash.id), "debit": "0", "credit": "100", "currency": str(self.currency.id)},
                ],
            }, format="json",
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        rule = self.client.post(
            f"/api/v1/general-ledger/allocation-rules/{self.query}",
            {
                "company": str(self.company.id), "code": "PB01", "name": "Phân bổ chi phí",
                "source_account": str(self.expense.id), "offset_account": str(self.expense.id), "method": "FIXED_PERCENT",
                "destinations": [{"account": str(self.destination.id), "percentage": "100"}],
            }, format="json",
        )
        self.assertEqual(rule.status_code, 201, rule.data)
        allocated = self.client.post(
            f"/api/v1/general-ledger/allocation-rules/{rule.data['id']}/run/{self.query}",
            {"company": str(self.company.id), "period": self.period, "idempotency_key": "ALLOC:2026-09:PB01"}, format="json",
        )
        self.assertEqual(allocated.status_code, 201, allocated.data)
        self.assertEqual(Decimal(allocated.data["amount"]), Decimal("100"))
        source_totals = AccountBalance.objects.filter(period_id=self.period, account=self.expense).aggregate(d=Sum("closing_debit"), c=Sum("closing_credit"))
        self.assertEqual((source_totals["d"] or Decimal("0")) - (source_totals["c"] or Decimal("0")), Decimal("0"))
        closing = self.client.post(
            f"/api/v1/general-ledger/closing-rules/{self.query}",
            {"company": str(self.company.id), "code": "KC01", "name": "Kết chuyển", "source_account": str(self.destination.id), "destination_account": str(self.retained.id), "sequence": 1}, format="json",
        )
        self.assertEqual(closing.status_code, 201, closing.data)
        run = self.client.post(
            f"/api/v1/general-ledger/closing-rules/{closing.data['id']}/run/{self.query}",
            {"company": str(self.company.id), "period": self.period}, format="json",
        )
        self.assertEqual(run.status_code, 201, run.data)


class AccountMasterTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="GLCO", name="GL Company", legal_name="GL Company Ltd", tax_code="0100777777",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.account_class = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT"
        )
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT99", name="Hệ thống tài khoản TT99",
            effective_from="2026-01-01", is_default=True,
        )
        self.admin = get_user_model().objects.create_superuser(
            username="gl-admin", email="gl-admin@example.com", password="password-123"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_account_tree_is_created_and_cannot_be_deleted_through_api(self):
        parent = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="111", name="Tiền mặt", account_level=1, account_type="ASSET",
            normal_balance="DEBIT", is_postable=False,
        )
        response = self.client.post(
            f"/api/v1/general-ledger/accounts/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "chart_of_accounts": str(self.chart.id),
                "account_class": str(self.account_class.id), "parent": str(parent.id),
                "code": "1111", "name": "Tiền Việt Nam", "account_level": 2,
                "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        delete_response = self.client.delete(
            f"/api/v1/general-ledger/accounts/{response.data['id']}/?company_id={self.company.id}"
        )
        self.assertEqual(delete_response.status_code, 405)
