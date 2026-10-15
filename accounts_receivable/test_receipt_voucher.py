from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from cash_management.models import CashFund, CashTransaction
from bank_management.models import AccountProfile, BankTransaction
from general_ledger.models import (
    Account, AccountBalance, AccountNature, AccountStatus, AccountingPeriod,
    ChartOfAccounts, JournalEntry, NormalBalance,
)
from master_data.models import Bank, CompanyBankAccount, Currency, DocumentNumberingRule, DocumentType, Party
from organization.models import Branch, Company
from .models import CustomerReceiptVoucher, Receipt, Receivable, ReceivableSchedule


class CustomerReceiptVoucherTests(TestCase):
    def setUp(self):
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="AR_RCV", name="Receipt Company", legal_name="Receipt Company",
            tax_code="0309999666", accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="B1", name="Branch 1")
        self.customer = Party.objects.create(
            company=self.company, code="C001", name="Customer", default_currency=self.currency,
        )
        chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA-AR-RCV", name="AR receipt COA",
            effective_from=date(2026, 1, 1), is_default=True,
        )
        self.cash_account = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="111",
            name="Cash", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )
        self.ar_account = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="131",
            name="AR", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )
        self.fund = CashFund.objects.create(
            company=self.company, branch=self.branch, code="F1", name="Main",
            currency=self.currency, gl_account=self.cash_account,
        )
        self.period = AccountingPeriod.objects.create(
            company=self.company, code="2026-01", fiscal_year=2026, period_number=1,
            start_date=date(2026, 1, 1), end_date=date(2026, 1, 31),
        )
        self.user = get_user_model().objects.create_superuser(
            username="voucher_admin", email="voucher_admin@example.com", password="pass",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f"/api/v1/accounts-receivable/customer-receipt-vouchers/?company_id={self.company.id}"
        self.debt = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-01",
            customer=self.customer, source_document_type="JOURNAL_ENTRY",
            source_document_id="src-1", source_document_number="SRC-1",
            posting_date=date(2026, 1, 1), currency=self.currency,
            original_amount=Decimal("100"), balance=Decimal("100"),
            account=self.ar_account, due_date=date(2026, 1, 20),
        )
        self.schedule = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.debt, installment_no=1,
            amount=Decimal("100"), balance=Decimal("100"), due_date=date(2026, 1, 20),
        )

    def payload(self, **extra):
        data = {
            "company": str(self.company.id), "branch": str(self.branch.id),
            "customer": str(self.customer.id), "cash_fund": str(self.fund.id),
            "credit_account": str(self.ar_account.id),
            "document_date": "2026-01-15", "posting_date": "2026-01-15",
            "amount": "120", "description": "Customer payment",
            "lines": [{"receivable": str(self.debt.id), "schedule": str(self.schedule.id), "amount": "70"}],
        }
        data.update(extra)
        return data

    def create_voucher(self, **extra):
        response = self.client.post(self.url, self.payload(**extra), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_save_then_post_is_atomic_and_idempotent(self):
        created = self.create_voucher()
        self.assertEqual(created["status"], "DRAFT")
        self.assertEqual(created["unallocated_amount"], Decimal("50"))
        self.assertEqual(Receipt.objects.count(), 0)
        self.assertEqual(JournalEntry.objects.count(), 0)
        self.debt.refresh_from_db()
        self.assertEqual(self.debt.balance, Decimal("100"))
        url = f"/api/v1/accounts-receivable/customer-receipt-vouchers/{created['id']}/post/?company_id={self.company.id}"
        posted = self.client.post(url, {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(posted.data["status"], "POSTED")
        self.debt.refresh_from_db()
        self.fund.refresh_from_db()
        self.assertEqual(self.debt.balance, Decimal("30"))
        self.assertEqual(self.fund.balance, Decimal("120"))
        self.assertEqual(Receipt.objects.get().allocated_amount, Decimal("70"))
        self.assertEqual(CashTransaction.objects.count(), 1)
        self.assertEqual(JournalEntry.objects.count(), 1)
        self.assertEqual(
            AccountBalance.objects.get(period=self.period,account=self.cash_account,branch=self.branch).period_debit,
            Decimal("120"),
        )
        changed_schedule = self.client.post(
            f"/api/v1/accounts-receivable/receivables/{self.debt.id}/update-schedule/?company_id={self.company.id}",
            {"reason": "Extend due date", "schedules": [
                {"installment_no": 1, "amount": "100", "due_date": "2026-02-01"}
            ]},
            format="json",
        )
        self.assertEqual(changed_schedule.status_code, 200, changed_schedule.data)
        again = self.client.post(url, {}, format="json")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(Receipt.objects.count(), 1)
        blocked_edit = self.client.patch(
            f"/api/v1/accounts-receivable/customer-receipt-vouchers/{created['id']}/?company_id={self.company.id}",
            {"amount": "130"}, format="json",
        )
        self.assertEqual(blocked_edit.status_code, 400)

    def test_changed_debt_blocks_post_and_rolls_back(self):
        created = self.create_voucher()
        self.debt.balance = Decimal("50")
        self.debt.save(update_fields=("balance",))
        post = self.client.post(
            f"/api/v1/accounts-receivable/customer-receipt-vouchers/{created['id']}/post/?company_id={self.company.id}",
            {}, format="json",
        )
        self.assertEqual(post.status_code, 400)
        self.assertEqual(Receipt.objects.count(), 0)
        self.assertEqual(CashTransaction.objects.count(), 0)
        self.assertEqual(JournalEntry.objects.count(), 0)
        self.assertEqual(CustomerReceiptVoucher.objects.get(pk=created["id"]).status, "DRAFT")

    def test_advance_and_closed_period(self):
        created = self.create_voucher(purpose="ADVANCE", lines=[])
        self.period.status = "CLOSED"
        self.period.save(update_fields=("status",))
        url = f"/api/v1/accounts-receivable/customer-receipt-vouchers/{created['id']}/post/?company_id={self.company.id}"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
        self.period.status = "OPEN"
        self.period.save(update_fields=("status",))
        posted = self.client.post(url, {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(Receipt.objects.get().allocated_amount, Decimal("0"))
        self.debt.refresh_from_db()
        self.assertEqual(self.debt.balance, Decimal("100"))
        receipt=Receipt.objects.get()
        allocation=self.client.post(
            f"/api/v1/accounts-receivable/receipts/{receipt.id}/allocate/?company_id={self.company.id}",
            {"allocations":[{"receivable":str(self.debt.id),"schedule":str(self.schedule.id),"amount":"30"}]},
            format="json",
        )
        self.assertEqual(allocation.status_code,200,allocation.data)
        self.debt.refresh_from_db()
        self.assertEqual(self.debt.balance,Decimal("70"))
        self.assertEqual(CashTransaction.objects.count(),1)
        self.assertEqual(JournalEntry.objects.count(),1)

    def test_rejects_invalid_lines_and_suggests_due_first(self):
        bad = self.client.post(self.url, self.payload(lines=[
            {"receivable": str(self.debt.id), "amount": "121"}
        ]), format="json")
        self.assertEqual(bad.status_code, 400)
        query = (
            f"/api/v1/accounts-receivable/customer-receipt-vouchers/suggest-allocations/"
            f"?company_id={self.company.id}&branch_id={self.branch.id}"
            f"&customer_id={self.customer.id}&currency_id={self.currency.id}"
            f"&account_id={self.ar_account.id}&amount=50"
        )
        response = self.client.get(query)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data[0]["amount"], Decimal("50"))

    def test_bank_receipt_and_duplicate_reference(self):
        bank = Bank.objects.create(code="ARTESTBANK", name="Test bank")
        bank_gl = Account.objects.create(
            company=self.company, chart_of_accounts=self.cash_account.chart_of_accounts,
            code="112", name="Bank", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )
        bank_account = CompanyBankAccount.objects.create(
            company=self.company, code="BA1", account_number="12345678",
            account_name="Receipt Company", bank=bank, currency=self.currency,
            gl_account=bank_gl,
        )
        profile = AccountProfile.objects.create(company=self.company, account=bank_account)
        first = self.create_voucher(
            method="BANK", cash_fund=None, bank_account=str(bank_account.id),
            bank_reference="BANK-REF-1", lines=[],
        )
        url = f"/api/v1/accounts-receivable/customer-receipt-vouchers/{first['id']}/post/?company_id={self.company.id}"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 200)
        profile.refresh_from_db()
        self.assertEqual(profile.balance, Decimal("120"))
        self.assertEqual(BankTransaction.objects.count(), 1)
        second = self.create_voucher(
            method="BANK", cash_fund=None, bank_account=str(bank_account.id),
            bank_reference="BANK-REF-1", lines=[],
        )
        second_url = f"/api/v1/accounts-receivable/customer-receipt-vouchers/{second['id']}/post/?company_id={self.company.id}"
        self.assertEqual(self.client.post(second_url, {}, format="json").status_code, 400)
        self.assertEqual(BankTransaction.objects.count(), 1)

    def test_required_approval_blocks_draft_post(self):
        created = self.create_voucher(approval_required=True, lines=[])
        base = f"/api/v1/accounts-receivable/customer-receipt-vouchers/{created['id']}"
        self.assertEqual(
            self.client.post(f"{base}/post/?company_id={self.company.id}", {}, format="json").status_code,
            400,
        )
        submitted = self.client.post(f"{base}/submit/?company_id={self.company.id}", {}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["status"], "PENDING_APPROVAL")
        approver = get_user_model().objects.create_superuser(
            username="voucher_approver", email="voucher_approver@example.com", password="pass",
        )
        self.client.force_authenticate(approver)
        approved = self.client.post(f"{base}/approve/?company_id={self.company.id}", {}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["status"], "APPROVED")
        self.assertEqual(self.client.post(f"{base}/post/?company_id={self.company.id}", {}, format="json").status_code, 200)

    def test_company_numbering_rule(self):
        DocumentNumberingRule.objects.create(
            company=self.company, branch=self.branch,
            document_type=DocumentType.objects.get(code="AR.RECEIPT_VOUCHER"),
            code="AR_RCV_B1", prefix="PT", separator="-", padding_length=3,
            include_branch_code=True, include_fiscal_year=True,
            effective_from=date(2026, 1, 1),
        )
        first=self.create_voucher(lines=[])
        second=self.create_voucher(lines=[])
        self.assertEqual(first["number"],"PT-B1-2026-001")
        self.assertEqual(second["number"],"PT-B1-2026-002")

    def test_existing_cash_receipt_can_be_allocated_without_second_posting(self):
        tx=CashTransaction.objects.create(
            company=self.company,fund=self.fund,number="CASH-AR-1",
            transaction_type="RECEIPT",business_type="AR_CUSTOMER_RECEIPT",
            transaction_date=date(2026,1,15),party=self.customer,
            payer_payee="Customer",currency=self.currency,amount=Decimal("60"),
            base_amount=Decimal("60"),description="Cash collection",
            status="APPROVED",workflow_snapshot={"separate_cashier":False},
            source_module="AR",created_by=self.user.iam_account,
        )
        confirmed=self.client.post(
            f"/api/v1/cash/transactions/{tx.id}/confirm/?company_id={self.company.id}",
            {},format="json",
        )
        self.assertEqual(confirmed.status_code,200,confirmed.data)
        receipt=Receipt.objects.get()
        self.assertEqual(receipt.allocated_amount,Decimal("0"))
        allocated=self.client.post(
            f"/api/v1/accounts-receivable/receipts/{receipt.id}/allocate/?company_id={self.company.id}",
            {"allocations":[{"receivable":str(self.debt.id),"amount":"40"}]},
            format="json",
        )
        self.assertEqual(allocated.status_code,200,allocated.data)
        self.assertEqual(CashTransaction.objects.count(),1)
        self.debt.refresh_from_db()
        self.assertEqual(self.debt.balance,Decimal("60"))
