from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts_payable.models import Payable, PayableStatus, SupplierInvoice
from general_ledger.models import (
    Account, AccountNature, AccountStatus, AccountingPeriod,
    ChartOfAccounts, JournalEntry, NormalBalance,
)
from master_data.models import Currency, DocumentType, Party, PartyRole, CustomerProfile, VendorProfile
from organization.models import Branch, Company
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from .models import (
    DebtNettingVoucher, DebtNettingVoucherLine, Netting,
    Receivable, ReceivableSchedule, ReceivableStatus,
)


class DebtNettingVoucherTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency_vnd = Currency.objects.get(code="VND")
        self.currency_usd, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "US Dollar", "numeric_code": "840", "decimal_places": 2}
        )
        self.company = Company.objects.create(
            code="CO_NETTING", name="Netting Company", legal_name="Netting Company Ltd",
            tax_code="0309999888", accounting_currency=self.currency_vnd,
            legal_reporting_currency=self.currency_vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="B1", name="Chi nhánh 1")

        # Entity who is both Customer and Vendor
        self.partner = Party.objects.create(
            company=self.company, code="DOITUONG_01", name="Công ty Đối tác Toàn Cầu",
            tax_code="0301112223", default_currency=self.currency_vnd, status="ACTIVE",
        )
        PartyRole.objects.create(party=self.partner, role_type="CUSTOMER", active_from=self.today)
        PartyRole.objects.create(party=self.partner, role_type="VENDOR", active_from=self.today)

        # Accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA-NET", name="Netting COA",
            effective_from=date(2026, 1, 1), is_default=True,
        )
        self.account_131 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="131",
            name="Phải thu của khách hàng", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )
        self.account_331 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="331",
            name="Phải trả cho người bán", account_type=AccountNature.LIABILITY,
            normal_balance=NormalBalance.CREDIT, status=AccountStatus.ACTIVE,
        )
        self.account_515 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="515",
            name="Doanh thu tài chính", account_type=AccountNature.REVENUE,
            normal_balance=NormalBalance.CREDIT, status=AccountStatus.ACTIVE,
        )
        self.account_635 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="635",
            name="Chi phí tài chính", account_type=AccountNature.EXPENSE,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )

        # Profiles
        CustomerProfile.objects.create(party=self.partner, receivable_account=self.account_131)
        VendorProfile.objects.create(party=self.partner, payable_account=self.account_331)

        # Accounting Period
        self.period = AccountingPeriod.objects.create(
            company=self.company, code="2026-01", fiscal_year=2026, period_number=1,
            start_date=date(2026, 1, 1), end_date=date(2026, 1, 31), status="OPEN",
        )

        # Users
        self.admin_user = get_user_model().objects.create_superuser(
            username="net_admin", email="net_admin@example.com", password="pass"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.url = f"/api/v1/accounts-receivable/debt-netting-vouchers/?company_id={self.company.id}"

        # Receivable
        self.receivable = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-2026-0001",
            customer=self.partner, currency=self.currency_vnd,
            account=self.account_131, exchange_rate=Decimal("1"),
            original_amount=Decimal("1000000"), balance=Decimal("1000000"),
            due_date=date(2026, 1, 25), status=ReceivableStatus.OPEN,
        )
        self.schedule1 = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.receivable, installment_no=1, amount=Decimal("600000"),
            balance=Decimal("600000"), due_date=date(2026, 1, 20), status=ReceivableStatus.OPEN,
        )
        self.schedule2 = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.receivable, installment_no=2, amount=Decimal("400000"),
            balance=Decimal("400000"), due_date=date(2026, 1, 30), status=ReceivableStatus.OPEN,
        )

        # Supplier Invoice & Payable
        self.invoice = SupplierInvoice.objects.create(
            company=self.company, branch=self.branch, supplier=self.partner,
            supplier_tax_code="0301112223", invoice_series="AA/26E", invoice_number="INV-001",
            invoice_date=date(2026, 1, 5), currency=self.currency_vnd, exchange_rate=Decimal("1"),
            total_amount=Decimal("800000"), status="POSTED", created_by=self.admin_user.iam_account,
        )
        self.payable = Payable.objects.create(
            company=self.company, branch=self.branch, supplier=self.partner,
            invoice=self.invoice, currency=self.currency_vnd, exchange_rate=Decimal("1"),
            original_amount=Decimal("800000"), balance=Decimal("800000"),
            due_date=date(2026, 1, 28), status=PayableStatus.OPEN,
        )

    def voucher_payload(self, **extra):
        data = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "document_date": "2026-01-15",
            "posting_date": "2026-01-15",
            "customer": str(self.partner.id),
            "currency": str(self.currency_vnd.id),
            "receivable_account": str(self.account_131.id),
            "payable_account": str(self.account_331.id),
            "description": "Bù trừ công nợ đối tác",
            "lines": [
                {
                    "receivable": str(self.receivable.id),
                    "payable": str(self.payable.id),
                    "receivable_schedule": str(self.schedule1.id),
                    "amount": "500000",
                }
            ],
        }
        data.update(extra)
        return data

    def test_main_flow_draft_post_success(self):
        """Main flow: Create draft -> Post voucher -> Debts & GL updated (BR01-BR10, BR14)."""
        response = self.client.post(self.url, self.voucher_payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        voucher_id = response.data["id"]
        self.assertEqual(response.data["status"], "DRAFT")
        self.assertEqual(Decimal(response.data["total_amount"]), Decimal("500000"))

        # Verify debts remain UNCHANGED while in DRAFT (BR07)
        self.receivable.refresh_from_db()
        self.payable.refresh_from_db()
        self.assertEqual(self.receivable.balance, Decimal("1000000"))
        self.assertEqual(self.payable.balance, Decimal("800000"))

        # Post voucher
        post_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{voucher_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {}, format="json")
        self.assertEqual(post_res.status_code, 200, post_res.data)
        self.assertEqual(post_res.data["status"], "POSTED")

        # Verify Receivable updated
        self.receivable.refresh_from_db()
        self.assertEqual(self.receivable.balance, Decimal("500000"))
        self.assertEqual(self.receivable.netted_amount, Decimal("500000"))
        self.assertEqual(self.receivable.status, ReceivableStatus.PARTIALLY_PAID)

        # Verify Schedule updated
        self.schedule1.refresh_from_db()
        self.assertEqual(self.schedule1.balance, Decimal("100000"))
        self.assertEqual(self.schedule1.collected_amount, Decimal("500000"))
        self.assertEqual(self.schedule1.status, ReceivableStatus.PARTIALLY_PAID)

        # Verify Payable updated
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("300000"))
        self.assertEqual(self.payable.netted_amount, Decimal("500000"))
        self.assertEqual(self.payable.status, PayableStatus.PARTIALLY_PAID)

        # Verify GL Journal Entry (BR09)
        voucher = DebtNettingVoucher.objects.get(pk=voucher_id)
        self.assertIsNotNone(voucher.journal_entry)
        journal = voucher.journal_entry
        self.assertEqual(journal.status, "POSTED")
        self.assertEqual(journal.lines.count(), 2)
        debit_line = journal.lines.get(account=self.account_331)
        credit_line = journal.lines.get(account=self.account_131)
        self.assertEqual(debit_line.debit, Decimal("500000"))
        self.assertEqual(credit_line.credit, Decimal("500000"))

        # Verify Netting record created
        line = voucher.lines.first()
        self.assertIsNotNone(line.netting_record)
        self.assertEqual(line.netting_record.amount, Decimal("500000"))
        self.assertEqual(line.netting_record.status, "POSTED")

    def test_af01_partial_netting_and_paid_completion(self):
        """AF01: Netting partially, then netting remaining to reach PAID."""
        # Netting 800,000 on payable (pays it off)
        payload = self.voucher_payload(lines=[
            {
                "receivable": str(self.receivable.id),
                "payable": str(self.payable.id),
                "amount": "800000",
            }
        ])
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        v_id = res.data["id"]

        post_res = self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})
        self.assertEqual(post_res.status_code, 200)

        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("0"))
        self.assertEqual(self.payable.status, PayableStatus.PAID)

        self.receivable.refresh_from_db()
        self.assertEqual(self.receivable.balance, Decimal("200000"))
        self.assertEqual(self.receivable.status, ReceivableStatus.PARTIALLY_PAID)

    def test_af02_af03_multiple_lines_and_one_to_many_debts(self):
        """AF02 & AF03: One receivable netted against two different payables in multiple lines."""
        invoice2 = SupplierInvoice.objects.create(
            company=self.company, branch=self.branch, supplier=self.partner,
            supplier_tax_code="0301112223", invoice_series="AA/26E", invoice_number="INV-002",
            invoice_date=date(2026, 1, 6), currency=self.currency_vnd, exchange_rate=Decimal("1"),
            total_amount=Decimal("400000"), status="POSTED", created_by=self.admin_user.iam_account,
        )
        payable2 = Payable.objects.create(
            company=self.company, branch=self.branch, supplier=self.partner,
            invoice=invoice2, currency=self.currency_vnd, exchange_rate=Decimal("1"),
            original_amount=Decimal("400000"), balance=Decimal("400000"),
            due_date=date(2026, 1, 29), status=PayableStatus.OPEN,
        )

        payload = self.voucher_payload(lines=[
            {
                "receivable": str(self.receivable.id),
                "payable": str(self.payable.id),
                "amount": "600000",
            },
            {
                "receivable": str(self.receivable.id),
                "payable": str(payable2.id),
                "amount": "400000",
            },
        ])
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        v_id = res.data["id"]

        post_res = self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})
        self.assertEqual(post_res.status_code, 200)

        self.receivable.refresh_from_db()
        self.assertEqual(self.receivable.balance, Decimal("0"))
        self.assertEqual(self.receivable.status, ReceivableStatus.PAID)

        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("200000"))

        payable2.refresh_from_db()
        self.assertEqual(payable2.balance, Decimal("0"))
        self.assertEqual(payable2.status, PayableStatus.PAID)

    def test_af04_eligible_debts_endpoint(self):
        """AF04: Eligible debts querying endpoint for pre-filling form."""
        url = f"/api/v1/accounts-receivable/debt-netting-vouchers/eligible-debts/?company_id={self.company.id}&customer_id={self.partner.id}"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["can_net"])
        self.assertEqual(res.data["customer"]["id"], str(self.partner.id))
        self.assertEqual(res.data["supplier"]["id"], str(self.partner.id))
        self.assertEqual(len(res.data["receivables"]), 1)
        self.assertEqual(len(res.data["payables"]), 1)
        self.assertEqual(res.data["receivables"][0]["code"], "AR-2026-0001")
        self.assertEqual(len(res.data["receivables"][0]["schedules"]), 2)

    def test_approval_workflow_lifecycle(self):
        """Test approval lifecycle: submit, recall, request revision, reject, approve, post."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]

        # Submit (auto-approves if no workflow configured)
        submit_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/submit/?company_id={self.company.id}"
        sub_res = self.client.post(submit_url, {})
        self.assertEqual(sub_res.status_code, 200)
        self.assertEqual(sub_res.data["status"], "APPROVED")

    def test_af05_cancel_draft_with_reason(self):
        """AF05: Cancel draft voucher with reason."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]

        cancel_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/cancel/?company_id={self.company.id}"
        # Missing reason fails
        fail = self.client.post(cancel_url, {})
        self.assertEqual(fail.status_code, 400)

        # With reason succeeds
        ok = self.client.post(cancel_url, {"reason": "Đối tác thỏa thuận lại hình thức thanh toán"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data["status"], "CANCELLED")

    def test_af06_unpost_and_restore_balances_and_gl(self):
        """AF06: Unpost restores receivable, payable, GL journal entry and allows re-posting."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        # Unpost
        unpost_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/unpost/?company_id={self.company.id}"
        unpost_res = self.client.post(unpost_url, {"reason": "Bù trừ nhầm số tiền"})
        self.assertEqual(unpost_res.status_code, 200)
        self.assertEqual(unpost_res.data["status"], "DRAFT")

        # Balances restored
        self.receivable.refresh_from_db()
        self.payable.refresh_from_db()
        self.assertEqual(self.receivable.balance, Decimal("1000000"))
        self.assertEqual(self.receivable.netted_amount, Decimal("0"))
        self.assertEqual(self.payable.balance, Decimal("800000"))
        self.assertEqual(self.payable.netted_amount, Decimal("0"))

        voucher = DebtNettingVoucher.objects.get(pk=v_id)
        self.assertIsNone(voucher.journal_entry)

        # Netting record marked REVERSED
        line = voucher.lines.first()
        self.assertEqual(line.netting_record.status, "REVERSED")

    def test_ef01_permission_checks(self):
        """EF01: Unauthorized user blocked with 403."""
        staff = get_user_model().objects.create_user(username="net_staff", password="pass")
        self.client.force_authenticate(staff)
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        self.assertEqual(res.status_code, 403)

    def test_ef02_customer_not_linked_to_vendor(self):
        """EF02: Customer without vendor role cannot create netting voucher."""
        cust_only = Party.objects.create(
            company=self.company, code="CUST_ONLY", name="Khách hàng đơn thuần",
            default_currency=self.currency_vnd, status="ACTIVE",
        )
        PartyRole.objects.create(party=cust_only, role_type="CUSTOMER", active_from=self.today)
        payload = self.voucher_payload(customer=str(cust_only.id))
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("nhà cung cấp", str(res.data))

    def test_ef03_invalid_line_amount_zero_or_negative(self):
        """EF03: Line amount <= 0 rejected."""
        payload = self.voucher_payload(lines=[
            {
                "receivable": str(self.receivable.id),
                "payable": str(self.payable.id),
                "amount": "0",
            }
        ])
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)

    def test_ef04_mismatched_currency_rejected(self):
        """EF04: Mismatched currency between receivable/payable and voucher rejected (BR04)."""
        rec_usd = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-USD-01",
            customer=self.partner, currency=self.currency_usd,
            account=self.account_131, exchange_rate=Decimal("25000"),
            original_amount=Decimal("100"), balance=Decimal("100"),
            due_date=date(2026, 1, 25), status=ReceivableStatus.OPEN,
        )
        payload = self.voucher_payload(lines=[
            {
                "receivable": str(rec_usd.id),
                "payable": str(self.payable.id),
                "amount": "50",
            }
        ])
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)

    def test_ef05_amount_exceeds_balance(self):
        """EF05: Line amount exceeds debt balance rejected (BR06, EF05)."""
        payload = self.voucher_payload(lines=[
            {
                "receivable": str(self.receivable.id),
                "payable": str(self.payable.id),
                "amount": "999999999",
            }
        ])
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)

    def test_ef06_concurrency_balance_changed_at_post_time(self):
        """EF06: Balance reduced by other operation before posting is blocked at post time."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]

        # Simulate concurrent transaction reducing balance
        self.receivable.balance = Decimal("100000")
        self.receivable.save(update_fields=("balance",))

        post_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {})
        self.assertEqual(post_res.status_code, 400)
        self.assertIn("không đủ", str(post_res.data))

    def test_ef07_closed_accounting_period_blocks_post(self):
        """EF07: Posting date in closed period is blocked."""
        self.period.status = "CLOSED"
        self.period.save(update_fields=("status",))

        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]

        post_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {})
        self.assertEqual(post_res.status_code, 400)
        self.assertIn("Kỳ kế toán", str(post_res.data))

    def test_fx_difference_gain_and_loss_gl(self):
        """BR10: Exchange rate differences between receivable and payable recorded to 515/635."""
        # Create USD Receivable with rate 25,000 and USD Payable with rate 26,000
        rec_usd = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-USD-GAIN",
            customer=self.partner, currency=self.currency_usd,
            account=self.account_131, exchange_rate=Decimal("25000"),
            original_amount=Decimal("100"), balance=Decimal("100"),
            due_date=date(2026, 1, 25), status=ReceivableStatus.OPEN,
        )
        inv_usd = SupplierInvoice.objects.create(
            company=self.company, branch=self.branch, supplier=self.partner,
            supplier_tax_code="0301112223", invoice_series="AA/26E", invoice_number="INV-USD",
            invoice_date=date(2026, 1, 5), currency=self.currency_usd, exchange_rate=Decimal("26000"),
            total_amount=Decimal("100"), status="POSTED", created_by=self.admin_user.iam_account,
        )
        pay_usd = Payable.objects.create(
            company=self.company, branch=self.branch, supplier=self.partner,
            invoice=inv_usd, currency=self.currency_usd, exchange_rate=Decimal("26000"),
            original_amount=Decimal("100"), balance=Decimal("100"),
            due_date=date(2026, 1, 28), status=PayableStatus.OPEN,
        )

        payload = self.voucher_payload(
            currency=str(self.currency_usd.id),
            lines=[
                {
                    "receivable": str(rec_usd.id),
                    "payable": str(pay_usd.id),
                    "amount": "100",
                }
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        v_id = res.data["id"]

        post_res = self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})
        self.assertEqual(post_res.status_code, 200)

        voucher = DebtNettingVoucher.objects.get(pk=v_id)
        journal = voucher.journal_entry
        # Converted payable: 100 * 26,000 = 2,600,000
        # Converted receivable: 100 * 25,000 = 2,500,000
        # Difference = 100,000 (FX gain -> Có 515)
        fx_line = journal.lines.filter(account=self.account_515).first()
        self.assertIsNotNone(fx_line)
        self.assertEqual(fx_line.credit, Decimal("100000"))

    def test_idempotent_post_br13(self):
        """BR13: Repeated post requests are idempotent and do not create duplicate netting/GL."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        post_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}"

        # First post
        p1 = self.client.post(post_url, {})
        self.assertEqual(p1.status_code, 200)

        # Second post
        p2 = self.client.post(post_url, {})
        self.assertEqual(p2.status_code, 200)

        voucher = DebtNettingVoucher.objects.get(pk=v_id)
        self.assertEqual(JournalEntry.objects.filter(source_entity_id=voucher.id).count(), 1)
        self.assertEqual(Netting.objects.filter(number__startswith=voucher.number).count(), 1)

    def test_ef08_block_direct_edit_posted_voucher(self):
        """EF08: Directly updating a posted voucher is blocked."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        patch_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/?company_id={self.company.id}"
        patch_res = self.client.patch(patch_url, {"description": "Sửa mô tả sau ghi sổ"}, format="json")
        self.assertEqual(patch_res.status_code, 400)

    def test_fx_difference_loss_recorded_to_635(self):
        """BR10: Exchange rate loss (payable rate < receivable rate) recorded to 635 debit."""
        rec_usd = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-USD-LOSS",
            customer=self.partner, currency=self.currency_usd,
            account=self.account_131, exchange_rate=Decimal("26000"),
            original_amount=Decimal("100"), balance=Decimal("100"),
            due_date=date(2026, 1, 25), status=ReceivableStatus.OPEN,
        )
        inv_usd = SupplierInvoice.objects.create(
            company=self.company, branch=self.branch, supplier=self.partner,
            supplier_tax_code="0301112223", invoice_series="AA/26E", invoice_number="INV-USD-LOSS",
            invoice_date=date(2026, 1, 5), currency=self.currency_usd, exchange_rate=Decimal("25000"),
            total_amount=Decimal("100"), status="POSTED", created_by=self.admin_user.iam_account,
        )
        pay_usd = Payable.objects.create(
            company=self.company, branch=self.branch, supplier=self.partner,
            invoice=inv_usd, currency=self.currency_usd, exchange_rate=Decimal("25000"),
            original_amount=Decimal("100"), balance=Decimal("100"),
            due_date=date(2026, 1, 28), status=PayableStatus.OPEN,
        )

        payload = self.voucher_payload(
            currency=str(self.currency_usd.id),
            lines=[
                {
                    "receivable": str(rec_usd.id),
                    "payable": str(pay_usd.id),
                    "amount": "100",
                }
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        v_id = res.data["id"]

        post_res = self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})
        self.assertEqual(post_res.status_code, 200)

        voucher = DebtNettingVoucher.objects.get(pk=v_id)
        journal = voucher.journal_entry
        # Converted payable: 100 * 25,000 = 2,500,000
        # Converted receivable: 100 * 26,000 = 2,600,000
        # Difference = -100,000 (FX loss -> Nợ 635)
        fx_line = journal.lines.filter(account=self.account_635).first()
        self.assertIsNotNone(fx_line)
        self.assertEqual(fx_line.debit, Decimal("100000"))

    def test_ef09_unpost_blocked_when_dependent_transaction_exists(self):
        """EF09: Unposting blocked when dependent transactions occurred after netting."""
        from accounts_payable.models import Payment, PaymentAllocation, PaymentMethod
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        voucher = DebtNettingVoucher.objects.get(pk=v_id)

        # Simulate subsequent payment allocation on the payable after netting
        payment = Payment.objects.create(
            company=self.company, supplier=self.partner, currency=self.currency_vnd,
            payment_date=date(2026, 1, 20), amount=Decimal("300000"),
            external_type=PaymentMethod.BANK, external_reference="PAY-DEP-01",
            created_by=self.admin_user.iam_account,
        )
        PaymentAllocation.objects.create(
            payment=payment, payable=self.payable, amount=Decimal("300000"),
            exchange_rate=Decimal("1"), created_by=self.admin_user.iam_account,
        )

        unpost_url = f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/unpost/?company_id={self.company.id}"
        unpost_res = self.client.post(unpost_url, {"reason": "Muốn hủy bù trừ"})
        self.assertEqual(unpost_res.status_code, 400)
        self.assertIn("thanh toán phát sinh sau", str(unpost_res.data))

    def test_br12_block_reverse_source_when_active_netting_exists(self):
        """BR12: Source receivable and source payable cannot be reversed while active netting exists."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        # Try to reverse receivable -> blocked by BR12
        rev_url = f"/api/v1/accounts-receivable/receivables/{self.receivable.id}/reverse/?company_id={self.company.id}"
        rev_res = self.client.post(rev_url, {"reason": "Hủy công nợ phải thu"}, format="json")
        self.assertEqual(rev_res.status_code, 400)
        self.assertIn("đối trừ", str(rev_res.data))

        # Try to reverse supplier invoice -> blocked by BR12
        inv_rev_url = f"/api/v1/accounts-payable/invoices/{self.invoice.id}/reverse/?company_id={self.company.id}"
        inv_rev_res = self.client.post(inv_rev_url, {"reason": "Hủy hóa đơn đầu vào"}, format="json")
        self.assertEqual(inv_rev_res.status_code, 400)
        self.assertIn("đối trừ", str(inv_rev_res.data))

    def test_fifo_schedules_allocation_and_unpost_restoration(self):
        """Test automatic FIFO schedule allocation and restoration when receivable_schedule is omitted."""
        # Netting 700,000 without specific schedule -> consumes schedule1 (600,000) and part of schedule2 (100,000)
        payload = self.voucher_payload(lines=[
            {
                "receivable": str(self.receivable.id),
                "payable": str(self.payable.id),
                "amount": "700000",
            }
        ])
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        v_id = res.data["id"]

        post_res = self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})
        self.assertEqual(post_res.status_code, 200)

        self.schedule1.refresh_from_db()
        self.schedule2.refresh_from_db()
        self.assertEqual(self.schedule1.balance, Decimal("0"))
        self.assertEqual(self.schedule1.status, ReceivableStatus.PAID)
        self.assertEqual(self.schedule2.balance, Decimal("300000"))
        self.assertEqual(self.schedule2.status, ReceivableStatus.PARTIALLY_PAID)

        # Unpost restores schedules
        unpost_res = self.client.post(
            f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/unpost/?company_id={self.company.id}",
            {"reason": "Khôi phục lịch thanh toán"},
        )
        self.assertEqual(unpost_res.status_code, 200)

        self.schedule1.refresh_from_db()
        self.schedule2.refresh_from_db()
        self.assertEqual(self.schedule1.balance, Decimal("600000"))
        self.assertEqual(self.schedule1.status, ReceivableStatus.OPEN)
        self.assertEqual(self.schedule2.balance, Decimal("400000"))
        self.assertEqual(self.schedule2.status, ReceivableStatus.OPEN)

    def test_ap_netting_synchronized_on_post_and_unpost(self):
        """Section 9: Netting records are synchronized to Accounts Payable module on post and unpost."""
        from accounts_payable.models import Netting as ApNetting
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        voucher = DebtNettingVoucher.objects.get(pk=v_id)
        ap_net = ApNetting.objects.filter(company=self.company, counterparty_reference=voucher.number).first()
        self.assertIsNotNone(ap_net)
        self.assertEqual(ap_net.amount, Decimal("500000"))
        self.assertEqual(ap_net.status, "POSTED")

        # Unpost updates AP Netting status to REVERSED
        self.client.post(
            f"/api/v1/accounts-receivable/debt-netting-vouchers/{v_id}/unpost/?company_id={self.company.id}",
            {"reason": "Bỏ ghi sổ kiểm tra AP netting"},
        )
        ap_net.refresh_from_db()
        self.assertEqual(ap_net.status, "REVERSED")

    def test_serializer_detail_line_fields(self):
        """Section 2.2: Line serializer exposes source document and schedule details."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        self.assertEqual(res.status_code, 201)
        line = res.data["lines"][0]
        self.assertEqual(line["receivable_code"], "AR-2026-0001")
        self.assertEqual(line["payable_source_document_number"], "INV-001")
        self.assertEqual(line["receivable_schedule_installment_no"], 1)
        self.assertEqual(Decimal(line["receivable_schedule_balance"]), Decimal("600000"))

