from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from cash_management.models import CashTransaction
from cash_management.models import CashFund
from general_ledger.models import Account, AccountNature, AccountStatus, JournalEntry, NormalBalance
from master_data.models import Currency
from iam.models import CompanyMembership, DataScopeBranch, DataScopeSet, Permission, Role, RolePermission, UserRoleAssignment
from .models import Receipt, ReceiptAllocation, ReceiptAllocationVoucher, Receivable, ReceivableSchedule
from . import test_receipt_voucher as receipt_tests


class AllocationVoucherTests(TestCase):
    def setUp(self):
        receipt_tests.CustomerReceiptVoucherTests.setUp(self)
        self.receipt = self._posted_advance()
        self.allocation_url = f"/api/v1/accounts-receivable/allocation-vouchers/?company_id={self.company.id}"

    payload = receipt_tests.CustomerReceiptVoucherTests.payload
    create_voucher = receipt_tests.CustomerReceiptVoucherTests.create_voucher

    def _posted_advance(self):
        voucher = self.create_voucher(purpose="ADVANCE", lines=[])
        posted = self.client.post(
            f"/api/v1/accounts-receivable/customer-receipt-vouchers/{voucher['id']}/post/?company_id={self.company.id}",
            {}, format="json",
        )
        self.assertEqual(posted.status_code, 200, posted.data)
        return Receipt.objects.get()

    def allocation_payload(self, **extra):
        data = {
            "company": str(self.company.id), "branch": str(self.branch.id),
            "customer": str(self.customer.id), "receipt": str(self.receipt.id),
            "allocation_date": "2026-01-16",
            "description": "Allocate advance",
            "lines": [{"receivable": str(self.debt.id),
                       "schedule": str(self.schedule.id), "amount": "70"}],
        }
        data.update(extra)
        return data

    def create_allocation(self, **extra):
        response = self.client.post(self.allocation_url, self.allocation_payload(**extra), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_draft_post_unpost_and_repost(self):
        created = self.create_allocation()
        self.assertEqual(created["status"], "DRAFT")
        self.assertEqual(created["allocated_amount"], Decimal("70"))
        self.debt.refresh_from_db()
        self.receipt.refresh_from_db()
        self.assertEqual(self.debt.balance, Decimal("100"))
        self.assertEqual(self.receipt.allocated_amount, Decimal("0"))
        base = f"/api/v1/accounts-receivable/allocation-vouchers/{created['id']}"
        posted = self.client.post(f"{base}/post/?company_id={self.company.id}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.debt.refresh_from_db()
        self.receipt.refresh_from_db()
        self.assertEqual(self.debt.balance, Decimal("30"))
        self.assertEqual(self.receipt.allocated_amount, Decimal("70"))
        self.assertEqual(CashTransaction.objects.count(), 1)
        self.assertEqual(JournalEntry.objects.count(), 1)
        again = self.client.post(f"{base}/post/?company_id={self.company.id}", {}, format="json")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(ReceiptAllocation.objects.filter(reversed_at__isnull=True).count(), 1)
        undone = self.client.post(
            f"{base}/unpost/?company_id={self.company.id}",
            {"reason": "Wrong allocation"}, format="json",
        )
        self.assertEqual(undone.status_code, 200, undone.data)
        self.assertEqual(undone.data["status"], "DRAFT")
        self.debt.refresh_from_db()
        self.receipt.refresh_from_db()
        self.assertEqual(self.debt.balance, Decimal("100"))
        self.assertEqual(self.receipt.allocated_amount, Decimal("0"))
        self.assertEqual(ReceiptAllocation.objects.filter(reversed_at__isnull=True).count(), 0)
        repost = self.client.post(f"{base}/post/?company_id={self.company.id}", {}, format="json")
        self.assertEqual(repost.status_code, 200, repost.data)
        self.assertEqual(ReceiptAllocation.objects.count(), 2)

    def test_cancel_and_closed_period(self):
        created = self.create_allocation()
        base = f"/api/v1/accounts-receivable/allocation-vouchers/{created['id']}"
        self.period.status = "CLOSED"
        self.period.save(update_fields=("status",))
        blocked = self.client.post(f"{base}/post/?company_id={self.company.id}", {}, format="json")
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(ReceiptAllocation.objects.count(), 0)
        cancelled = self.client.post(
            f"{base}/cancel/?company_id={self.company.id}",
            {"reason": "Not needed"}, format="json",
        )
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(cancelled.data["status"], "CANCELLED")
        self.assertEqual(self.client.post(f"{base}/post/?company_id={self.company.id}", {}, format="json").status_code, 400)

    def test_default_date_and_description(self):
        payload = self.allocation_payload()
        del payload["allocation_date"]
        del payload["description"]
        response = self.client.post(self.allocation_url, payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["allocation_date"], str(timezone.localdate()))
        self.assertIn(self.customer.name, response.data["description"])

    def test_exceeding_available_or_debt_is_rejected(self):
        early = self.client.post(
            self.allocation_url, self.allocation_payload(allocation_date="2026-01-14"),
            format="json",
        )
        self.assertEqual(early.status_code, 400)
        response = self.client.post(
            self.allocation_url, self.allocation_payload(lines=[
                {"receivable": str(self.debt.id), "schedule": str(self.schedule.id), "amount": "101"}
            ]), format="json",
        )
        self.assertEqual(response.status_code, 400)
        duplicate = self.client.post(
            self.allocation_url, self.allocation_payload(lines=[
                {"receivable": str(self.debt.id), "schedule": str(self.schedule.id), "amount": "30"},
                {"receivable": str(self.debt.id), "schedule": str(self.schedule.id), "amount": "20"},
            ]), format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        created = self.create_allocation()
        self.debt.balance = Decimal("50")
        self.debt.save(update_fields=("balance",))
        blocked = self.client.post(
            f"/api/v1/accounts-receivable/allocation-vouchers/{created['id']}/post/?company_id={self.company.id}",
            {}, format="json",
        )
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(ReceiptAllocation.objects.count(), 0)
        self.assertEqual(ReceiptAllocationVoucher.objects.get(pk=created["id"]).status, "DRAFT")

    def test_fx_journal_and_unpost_reversal(self):
        usd, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "US Dollar", "decimal_places": 2},
        )
        usd_fund = CashFund.objects.create(
            company=self.company, branch=self.branch, code="FUSD",
            name="USD fund", currency=usd, gl_account=self.cash_account,
        )
        Account.objects.create(
            company=self.company, chart_of_accounts=self.cash_account.chart_of_accounts,
            code="515", name="FX gain", account_type=AccountNature.OTHER_INCOME,
            normal_balance=NormalBalance.CREDIT, status=AccountStatus.ACTIVE,
        )
        self.debt = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-USD",
            customer=self.customer, source_document_type="JOURNAL_ENTRY",
            source_document_id="usd-src", source_document_number="USD-SRC",
            posting_date=date(2026, 1, 1), currency=usd,
            original_amount=Decimal("100"), balance=Decimal("100"),
            exchange_rate=Decimal("25000"), account=self.ar_account,
            due_date=date(2026, 1, 20),
        )
        self.schedule = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.debt, installment_no=1,
            amount=Decimal("100"), balance=Decimal("100"), due_date=date(2026, 1, 20),
        )
        foreign_receipt = self.create_voucher(
            purpose="ADVANCE", lines=[], cash_fund=str(usd_fund.id),
            exchange_rate="26000",
        )
        posted_receipt = self.client.post(
            f"/api/v1/accounts-receivable/customer-receipt-vouchers/{foreign_receipt['id']}/post/?company_id={self.company.id}",
            {}, format="json",
        )
        self.assertEqual(posted_receipt.status_code, 200, posted_receipt.data)
        self.receipt = Receipt.objects.get(currency=usd)
        allocation = self.create_allocation()
        base = f"/api/v1/accounts-receivable/allocation-vouchers/{allocation['id']}"
        posted = self.client.post(f"{base}/post/?company_id={self.company.id}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(Decimal(posted.data["lines"][0]["fx_difference"]), Decimal("70000"))
        journal = ReceiptAllocationVoucher.objects.get(pk=allocation["id"]).journal_entry
        self.assertIsNotNone(journal)
        self.assertEqual(journal.total_debit, Decimal("70000"))
        self.assertEqual(journal.total_credit, Decimal("70000"))
        undone = self.client.post(
            f"{base}/unpost/?company_id={self.company.id}",
            {"reason": "Recheck FX"}, format="json",
        )
        self.assertEqual(undone.status_code, 200, undone.data)
        journal.refresh_from_db()
        self.assertEqual(journal.status, "REVERSED")

    def test_unpost_requires_open_period_and_no_later_allocation(self):
        created=self.create_allocation()
        base=f"/api/v1/accounts-receivable/allocation-vouchers/{created['id']}"
        self.assertEqual(
            self.client.post(f"{base}/post/?company_id={self.company.id}",{},format="json").status_code,
            200,
        )
        self.period.status="CLOSED"
        self.period.save(update_fields=("status",))
        self.assertEqual(
            self.client.post(f"{base}/unpost/?company_id={self.company.id}",
                             {"reason":"Wrong"},format="json").status_code,
            400,
        )
        self.period.status="OPEN"
        self.period.save(update_fields=("status",))
        later=self.client.post(
            f"/api/v1/accounts-receivable/receipts/{self.receipt.id}/allocate/?company_id={self.company.id}",
            {"allocations":[{"receivable":str(self.debt.id),"schedule":str(self.schedule.id),"amount":"10"}]},
            format="json",
        )
        self.assertEqual(later.status_code,200,later.data)
        blocked=self.client.post(
            f"{base}/unpost/?company_id={self.company.id}",
            {"reason":"Wrong"},format="json",
        )
        self.assertEqual(blocked.status_code,400)
        self.assertEqual(ReceiptAllocationVoucher.objects.get(pk=created["id"]).status,"POSTED")

    def test_scoped_view_without_post_permission(self):
        created=self.create_allocation()
        staff=get_user_model().objects.create_user(
            username="allocation_staff",email="allocation_staff@example.com",password="pass",
        )
        membership=CompanyMembership.objects.create(
            company=self.company,user=staff.iam_account,created_by=self.user.iam_account,
        )
        role=Role.objects.create(company=self.company,name="Allocation viewer",code="ALLOC_VIEW",status="ACTIVE")
        RolePermission.objects.create(
            role=role,permission=Permission.objects.get(code="AR.ALLOCATION_VOUCHER.VIEW"),
        )
        scope=DataScopeSet.objects.create(
            company=self.company,code="ALLOC_B1",name="Allocation B1",
            created_by=self.user.iam_account,
        )
        DataScopeBranch.objects.create(data_scope_set=scope,branch=self.branch)
        UserRoleAssignment.objects.create(
            company_membership=membership,role=role,data_scope_set=scope,
            assigned_by=self.user.iam_account,valid_from=timezone.now()-timedelta(minutes=1),
        )
        self.client.force_authenticate(staff)
        listed=self.client.get(self.allocation_url)
        self.assertEqual(listed.status_code,200,listed.data)
        self.assertEqual(len(listed.data),1)
        denied=self.client.post(
            f"/api/v1/accounts-receivable/allocation-vouchers/{created['id']}/post/?company_id={self.company.id}",
            {},format="json",
        )
        self.assertEqual(denied.status_code,403)
