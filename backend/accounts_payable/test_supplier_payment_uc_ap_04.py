from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from bank_management.models import AccountProfile, BankTransaction
from cash_management.models import CashFund, CashTransaction
from general_ledger.models import (
    Account, AccountNature, AccountStatus, AccountingPeriod,
    ChartOfAccounts, JournalEntry,
)
from iam.models import CompanyMembership, Permission, PermissionAction, PermissionResource, Role, RolePermission, UserRoleAssignment
from master_data.models import (
    Bank, CompanyBankAccount, Currency, Party, PartyBankAccount, PartyRole,
)
from organization.models import Branch, Company
from accounts_payable.models import (
    Payable, PayableDocument, PayableDocumentLine, PayableStatus,
    Payment, PaymentAllocation, PaymentMethod, PaymentRequestMethod,
    PaymentRequest, PaymentRequestLine, PaymentRequestStatus,
    PaymentRequestType, PaymentSource, PaymentStatus,
)


class SupplierPaymentUcAp04Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="CO_AP_04",
            name="Doanh nghiệp AP04 Test",
            legal_name="Công ty TNHH AP04 Test",
            tax_code="0109999444",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="B_HCM", name="Chi nhánh HCM")

        # Open Accounting Period
        period_start = self.today.replace(day=1)
        next_month = (period_start + timedelta(days=32)).replace(day=1)
        period_end = next_month - timedelta(days=1)
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code=f"{self.today.year}-{self.today.month:02d}",
            start_date=period_start,
            end_date=period_end,
            fiscal_year=self.today.year,
            period_number=self.today.month,
            status="OPEN",
        )

        # Bank and Bank Accounts
        self.bank = Bank.objects.create(code="VCB", name="Ngân hàng TMCP Ngoại thương Việt Nam")
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA_AP04", name="COA AP04", effective_from=self.today, is_default=True
        )

        # GL Accounts
        self.acc_1111 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền mặt VND",
            account_type=AccountNature.ASSET, status=AccountStatus.ACTIVE
        )
        self.acc_1121 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1121", name="Tiền gửi VND",
            account_type=AccountNature.ASSET, status=AccountStatus.ACTIVE
        )
        self.acc_331 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="331", name="Phải trả nhà cung cấp",
            account_type=AccountNature.LIABILITY, status=AccountStatus.ACTIVE, requires_party=True
        )
        self.acc_642 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="642", name="Chi phí quản lý DN",
            account_type=AccountNature.EXPENSE, status=AccountStatus.ACTIVE
        )

        # Company Bank Account & Bank Profile
        self.company_bank_acc = CompanyBankAccount.objects.create(
            company=self.company,
            bank=self.bank,
            account_number="0011009988776",
            account_name="CTY TNHH AP04 TEST",
            currency=self.currency,
            gl_account=self.acc_1121,
            status="ACTIVE",
            allow_payment=True,
        )
        self.bank_profile = AccountProfile.objects.create(
            company=self.company,
            account=self.company_bank_acc,
            balance=Decimal("500000000"),
        )

        # Cash Fund
        self.cash_fund = CashFund.objects.create(
            company=self.company,
            branch=self.branch,
            code="QUY_VND_04",
            name="Quỹ tiền mặt VND",
            currency=self.currency,
            gl_account=self.acc_1111,
            balance=Decimal("200000000"),
            status="ACTIVE",
        )

        # Supplier
        self.supplier = Party.objects.create(
            company=self.company,
            code="NCC_BETA",
            name="Công ty Cổ phần Beta Thiết Bị",
            tax_code="0107777666",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=self.today)
        self.supplier_bank_acc = PartyBankAccount.objects.create(
            party=self.supplier,
            bank=self.bank,
            account_number="0987654321",
            account_name="CTY CP BETA THIET BI",
            is_default=True,
            status="ACTIVE",
        )

        # Users and Permissions
        User = get_user_model()
        self.payment_user = User.objects.create_user(
            username="ap_cashier", email="cashier@example.com", password="password123"
        )
        self.approver_user = User.objects.create_user(
            username="ap_approver04", email="approver04@example.com", password="password123"
        )

        m_user = CompanyMembership.objects.create(
            user=self.payment_user.iam_account, company=self.company, created_by=self.payment_user.iam_account
        )
        role_cashier = Role.objects.create(company=self.company, code="R_AP_CASHIER", name="Thủ quỹ / Kế toán thanh toán")

        perms_to_assign = [
            "AP.PAYMENT.VIEW",
            "AP.PAYMENT.CREATE",
            "AP.PAYMENT.EDIT",
            "AP.PAYMENT.POST",
            "AP.PAYMENT.POST_DIRECT",
            "AP.PAYMENT.CANCEL",
            "AP.PAYMENT.CANCEL_POSTED",
            "AP.PAYMENT.ALLOCATE",
        ]
        resource, _ = PermissionResource.objects.get_or_create(
            code="AP.PAYMENT", defaults={"module_code": "AP", "name": "AP Payment", "status": "ACTIVE"}
        )
        for p_code in perms_to_assign:
            act_code = p_code.replace("AP.PAYMENT.", "").replace(".", "_")
            action, _ = PermissionAction.objects.get_or_create(code=f"ACT_PAY_{act_code}", defaults={"name": act_code})
            perm, _ = Permission.objects.get_or_create(
                code=p_code,
                defaults={"resource": resource, "action": action, "description": p_code, "status": "ACTIVE"}
            )
            RolePermission.objects.get_or_create(role=role_cashier, permission=perm, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(company_membership=m_user, role=role_cashier, assigned_by=self.payment_user.iam_account)

        self.client = APIClient()
        self.client.force_authenticate(user=self.payment_user)

    def _create_sample_payable(self, original_amount=Decimal("50000000"), balance=Decimal("50000000")):
        """Creates posted PayableDocument and Payable."""
        doc = PayableDocument.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"CNPT-04-{Payable.objects.count() + 1:04d}",
            document_date=self.today - timedelta(days=5),
            posting_date=self.today - timedelta(days=5),
            supplier=self.supplier,
            due_date=self.today + timedelta(days=25),
            payable_account=self.acc_331,
            currency=self.currency,
            subtotal=original_amount,
            tax_amount=Decimal("0"),
            total_amount=original_amount,
            status="POSTED",
            created_by=self.payment_user.iam_account,
        )
        PayableDocumentLine.objects.create(
            document=doc,
            line_no=1,
            description="Chi phí thiết bị",
            debit_account=self.acc_642,
            amount=original_amount,
            total_amount=original_amount,
        )
        payable = Payable.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            document=doc,
            currency=self.currency,
            exchange_rate=Decimal("1"),
            original_amount=original_amount,
            paid_amount=original_amount - balance,
            balance=balance,
            due_date=self.today + timedelta(days=25),
            status=PayableStatus.OPEN if balance == original_amount else PayableStatus.PARTIALLY_PAID,
        )
        return payable

    def _create_approved_payment_request(self, payable, request_amount=Decimal("50000000"), method=PaymentRequestMethod.BANK_TRANSFER):
        """Creates an APPROVED PaymentRequest linked to the payable."""
        req = PaymentRequest.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"DNTT-{self.today.year}{self.today.month:02d}-{PaymentRequest.objects.count() + 1:06d}",
            request_type=PaymentRequestType.DEBT_PAYMENT,
            supplier=self.supplier,
            currency=self.currency,
            requested_date=self.today,
            planned_payment_date=self.today + timedelta(days=2),
            payment_method=method,
            company_bank_account=self.company_bank_acc if method == PaymentRequestMethod.BANK_TRANSFER else None,
            cash_fund=self.cash_fund if method == PaymentRequestMethod.CASH else None,
            beneficiary_name="Công ty Cổ phần Beta Thiết Bị",
            beneficiary_account_number="0987654321",
            beneficiary_bank_name="Vietcombank",
            payment_content="Thanh toán tiền thiết bị đợt 1",
            approver=self.approver_user.iam_account,
            total_amount=request_amount,
            paid_amount=Decimal("0"),
            status=PaymentRequestStatus.APPROVED,
            created_by=self.payment_user.iam_account,
            approved_at=timezone.now(),
        )
        req_line = PaymentRequestLine.objects.create(
            request=req,
            line_no=1,
            payable=payable,
            amount=request_amount,
            paid_amount=Decimal("0"),
        )
        return req, req_line

    def test_number_generation_pc_and_unc_yearly_reset(self):
        """BR-AP-PAY-11..15: Numbering PC-YYYY-NNNNNN for cash and UNC-YYYY-NNNNNN for bank, yearly reset."""
        # Cash preview
        resp_cash = self.client.get(
            f"/api/v1/accounts-payable/payments/preview-number/?company_id={self.company.id}&payment_method=CASH&payment_date={self.today}"
        )
        self.assertEqual(resp_cash.status_code, 200)
        self.assertEqual(resp_cash.data["preview_number"], f"PC-{self.today.year}-000001")

        # Bank preview
        resp_bank = self.client.get(
            f"/api/v1/accounts-payable/payments/preview-number/?company_id={self.company.id}&payment_method=BANK_TRANSFER&payment_date={self.today}"
        )
        self.assertEqual(resp_bank.status_code, 200)
        self.assertEqual(resp_bank.data["preview_number"], f"UNC-{self.today.year}-000001")

        # Next year reset to 000001
        next_year_date = date(self.today.year + 1, 1, 15)
        resp_next_year = self.client.get(
            f"/api/v1/accounts-payable/payments/preview-number/?company_id={self.company.id}&payment_method=CASH&payment_date={next_year_date}"
        )
        self.assertEqual(resp_next_year.data["preview_number"], f"PC-{next_year_date.year}-000001")

    def test_eligible_payment_requests_and_request_detail(self):
        """Steps 3-8: Filter eligible approved payment requests and load detail with suggested amounts."""
        p = self._create_sample_payable(original_amount=Decimal("40000000"), balance=Decimal("40000000"))
        req, req_line = self._create_approved_payment_request(p, request_amount=Decimal("40000000"))

        # 1. Query eligible requests
        resp_list = self.client.get(
            f"/api/v1/accounts-payable/payments/eligible-requests/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        self.assertEqual(resp_list.status_code, 200)
        self.assertEqual(len(resp_list.data["items"]), 1)
        item = resp_list.data["items"][0]
        self.assertEqual(item["number"], req.number)
        self.assertEqual(item["total_available_amount"], 40000000.0)

        # 2. Query request detail
        resp_detail = self.client.get(
            f"/api/v1/accounts-payable/payments/request-detail/?company_id={self.company.id}&request_id={req.id}"
        )
        self.assertEqual(resp_detail.status_code, 200)
        self.assertEqual(resp_detail.data["request"]["number"], req.number)
        self.assertEqual(len(resp_detail.data["lines"]), 1)
        line_item = resp_detail.data["lines"][0]
        self.assertEqual(line_item["available_to_pay"], 40000000.0)
        self.assertEqual(line_item["suggested_amount"], 40000000.0)

    def test_post_payment_by_request_bank_transfer_full(self):
        """Steps 17-33: Post full payment by request via Bank Transfer. Verifies GL, debt reduction, request status."""
        p = self._create_sample_payable(original_amount=Decimal("60000000"), balance=Decimal("60000000"))
        req, req_line = self._create_approved_payment_request(p, request_amount=Decimal("60000000"), method=PaymentRequestMethod.BANK_TRANSFER)

        initial_bank_balance = self.bank_profile.balance

        resp = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "BANK_TRANSFER",
                "company_bank_account": str(self.company_bank_acc.id),
                "beneficiary_name": "Công ty Cổ phần Beta Thiết Bị",
                "beneficiary_account_number": "0987654321",
                "beneficiary_bank_name": "Vietcombank",
                "bank_transaction_code": "TX-VCB-202610-01",
                "payment_content": "Thanh toán toàn bộ hợp đồng theo đề nghị",
                "attachments": [{"file_name": "uy_nhiem_chi.pdf", "file_size": 2048}],
                "lines": [
                    {
                        "payable": str(p.id),
                        "payment_request_line": str(req_line.id),
                        "amount": 60000000,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], PaymentStatus.POSTED)
        self.assertTrue(resp.data["number"].startswith(f"UNC-{self.today.year}-"))
        self.assertIn("Ghi sổ chứng từ thanh toán thành công", resp.data["message"])

        # 1. GL Journal Entry: Debit 331 (60M) / Credit 1121 (60M)
        je = JournalEntry.objects.filter(source_event_id=f"AP.PAYMENT:{resp.data['id']}").first()
        self.assertIsNotNone(je)
        self.assertEqual(je.status, "POSTED")
        self.assertEqual(je.total_debit, Decimal("60000000"))
        self.assertEqual(je.total_credit, Decimal("60000000"))
        lines = list(je.lines.all())
        self.assertEqual(len(lines), 2)
        debit_line = je.lines.filter(debit__gt=0).first()
        credit_line = je.lines.filter(credit__gt=0).first()
        self.assertEqual(debit_line.account.code, "331")
        self.assertEqual(credit_line.account.code, "1121")

        # 2. Debt reduced: balance = 0, status = PAID
        p.refresh_from_db()
        self.assertEqual(p.balance, Decimal("0"))
        self.assertEqual(p.paid_amount, Decimal("60000000"))
        self.assertEqual(p.status, PayableStatus.PAID)

        # 3. Request updated: paid_amount = 60M, status = PAID (BR-AP-PAY-10)
        req.refresh_from_db()
        self.assertEqual(req.paid_amount, Decimal("60000000"))
        self.assertEqual(req.status, PaymentRequestStatus.PAID)

        # 4. Bank ledger updated
        self.bank_profile.refresh_from_db()
        self.assertEqual(self.bank_profile.balance, initial_bank_balance - Decimal("60000000"))
        self.assertTrue(
            BankTransaction.objects.filter(source_module="AP", source_reference=str(resp.data["id"])).exists()
        )

        # 5. Audit Log recorded
        self.assertTrue(
            AuditLog.objects.filter(company=self.company, module_code="AP", action_code="POST").exists()
        )

    def test_post_payment_cash_partial_payment_af02(self):
        """AF-AP-PAY-02: Partial cash payment. Verifies partial debt deduction and PARTIALLY_PAID status."""
        p = self._create_sample_payable(original_amount=Decimal("50000000"), balance=Decimal("50000000"))
        req, req_line = self._create_approved_payment_request(p, request_amount=Decimal("50000000"), method=PaymentRequestMethod.CASH)

        initial_cash_balance = self.cash_fund.balance

        resp = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "recipient_name": "Nguyễn Văn Giao Hàng",
                "payment_content": "Thanh toán đợt 1 tiền mặt 20 triệu",
                "lines": [
                    {
                        "payable": str(p.id),
                        "payment_request_line": str(req_line.id),
                        "amount": 20000000,  # Partial payment!
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["number"].startswith(f"PC-{self.today.year}-"))

        # GL Journal Entry: Debit 331 / Credit 1111 (20M)
        je = JournalEntry.objects.filter(source_event_id=f"AP.PAYMENT:{resp.data['id']}").first()
        self.assertIsNotNone(je)
        self.assertEqual(je.total_debit, Decimal("20000000"))
        debit_line = je.lines.filter(debit__gt=0).first()
        credit_line = je.lines.filter(credit__gt=0).first()
        self.assertEqual(debit_line.account.code, "331")
        self.assertEqual(credit_line.account.code, "1111")

        # Debt reduced partially
        p.refresh_from_db()
        self.assertEqual(p.balance, Decimal("30000000"))
        self.assertEqual(p.paid_amount, Decimal("20000000"))
        self.assertEqual(p.status, PayableStatus.PARTIALLY_PAID)

        # Request becomes PARTIALLY_PAID
        req.refresh_from_db()
        self.assertEqual(req.paid_amount, Decimal("20000000"))
        self.assertEqual(req.status, PaymentRequestStatus.PARTIALLY_PAID)

        # Cash fund reduced
        self.cash_fund.refresh_from_db()
        self.assertEqual(self.cash_fund.balance, initial_cash_balance - Decimal("20000000"))
        self.assertTrue(
            CashTransaction.objects.filter(source_module="AP", source_reference=str(resp.data["id"])).exists()
        )

    def test_omit_line_with_zero_amount_af03(self):
        """AF-AP-PAY-03: Line with amount 0 is omitted from payment allocations."""
        p1 = self._create_sample_payable(original_amount=Decimal("15000000"), balance=Decimal("15000000"))
        p2 = self._create_sample_payable(original_amount=Decimal("25000000"), balance=Decimal("25000000"))

        req = PaymentRequest.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"DNTT-{self.today.year}{self.today.month:02d}-000088",
            request_type=PaymentRequestType.DEBT_PAYMENT,
            supplier=self.supplier,
            currency=self.currency,
            requested_date=self.today,
            planned_payment_date=self.today,
            payment_method=PaymentRequestMethod.CASH,
            cash_fund=self.cash_fund,
            payment_content="Đề nghị 2 dòng",
            approver=self.approver_user.iam_account,
            total_amount=Decimal("40000000"),
            status=PaymentRequestStatus.APPROVED,
            created_by=self.payment_user.iam_account,
        )
        rl1 = PaymentRequestLine.objects.create(request=req, line_no=1, payable=p1, amount=Decimal("15000000"))
        rl2 = PaymentRequestLine.objects.create(request=req, line_no=2, payable=p2, amount=Decimal("25000000"))

        resp = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "recipient_name": "Người nhận",
                "payment_content": "Bỏ dòng 1 (0đ), chỉ trả dòng 2",
                "lines": [
                    {"payable": str(p1.id), "payment_request_line": str(rl1.id), "amount": 0},  # Omitted!
                    {"payable": str(p2.id), "payment_request_line": str(rl2.id), "amount": 25000000},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["amount"], "25000000.0000")
        self.assertEqual(len(resp.data["allocations"]), 1)

        # p1 remains untouched
        p1.refresh_from_db()
        self.assertEqual(p1.balance, Decimal("15000000"))
        self.assertEqual(p1.paid_amount, Decimal("0"))

        # p2 paid in full
        p2.refresh_from_db()
        self.assertEqual(p2.balance, Decimal("0"))

    def test_save_draft_and_post_draft_af01_af05(self):
        """AF-AP-PAY-01 & AF-AP-PAY-05: Save draft, edit draft, and post draft."""
        p = self._create_sample_payable()
        req, req_line = self._create_approved_payment_request(p, request_amount=Decimal("50000000"), method=PaymentRequestMethod.CASH)
        gl_count_before = JournalEntry.objects.count()

        # 1. Save Draft (AF-01)
        draft_resp = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SAVE_DRAFT",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "recipient_name": "Người nhận nháp",
                "payment_content": "Chứng từ nháp",
                "lines": [{"payable": str(p.id), "payment_request_line": str(req_line.id), "amount": 10000000}],
            },
            format="json",
        )
        self.assertEqual(draft_resp.status_code, 201)
        self.assertEqual(draft_resp.data["status"], PaymentStatus.DRAFT)
        payment_id = draft_resp.data["id"]

        # Invariant: No GL and no debt reduction on DRAFT
        self.assertEqual(JournalEntry.objects.count(), gl_count_before)
        p.refresh_from_db()
        self.assertEqual(p.balance, Decimal("50000000"))
        req.refresh_from_db()
        self.assertEqual(req.paid_amount, Decimal("0"))

        # 2. Edit draft and Post (AF-05)
        post_resp = self.client.post(
            f"/api/v1/accounts-payable/payments/{payment_id}/post/?company_id={self.company.id}",
            {
                "payment_content": "Đã sửa và ghi sổ",
            },
            format="json",
        )
        self.assertEqual(post_resp.status_code, 200)
        self.assertEqual(post_resp.data["status"], PaymentStatus.POSTED)

        # GL entry created now
        self.assertEqual(JournalEntry.objects.count(), gl_count_before + 1)
        p.refresh_from_db()
        self.assertEqual(p.balance, Decimal("40000000"))

    def test_cancel_draft_voucher_af06(self):
        """AF-AP-PAY-06: Cancel draft voucher transitions to CANCELED without debt impact."""
        p = self._create_sample_payable()
        req, req_line = self._create_approved_payment_request(p, method=PaymentRequestMethod.CASH)

        draft_resp = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SAVE_DRAFT",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "recipient_name": "Người nhận",
                "payment_content": "Nháp để hủy",
                "lines": [{"payable": str(p.id), "amount": 5000000}],
            },
            format="json",
        )
        payment_id = draft_resp.data["id"]

        cancel_resp = self.client.post(
            f"/api/v1/accounts-payable/payments/{payment_id}/cancel/?company_id={self.company.id}",
            {"reason": "Không chi tiền nữa"},
            format="json",
        )
        self.assertEqual(cancel_resp.status_code, 200)
        self.assertEqual(cancel_resp.data["status"], PaymentStatus.CANCELED)

    def test_cancel_posted_voucher_with_reversal_gl_af07(self):
        """AF-AP-PAY-07: Cancel posted voucher creates reversal GL entry and restores debt."""
        p = self._create_sample_payable(original_amount=Decimal("30000000"), balance=Decimal("30000000"))
        req, req_line = self._create_approved_payment_request(p, request_amount=Decimal("30000000"))

        # Post voucher
        post_resp = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "BANK_TRANSFER",
                "company_bank_account": str(self.company_bank_acc.id),
                "beneficiary_name": "Beta",
                "beneficiary_account_number": "0987654321",
                "beneficiary_bank_name": "VCB",
                "bank_transaction_code": "TX-REV-01",
                "payment_content": "Chi trả sẽ hủy",
                "lines": [{"payable": str(p.id), "payment_request_line": str(req_line.id), "amount": 30000000}],
            },
            format="json",
        )
        self.assertEqual(post_resp.status_code, 201)
        payment_id = post_resp.data["id"]

        # Cancel posted voucher
        cancel_resp = self.client.post(
            f"/api/v1/accounts-payable/payments/{payment_id}/cancel/?company_id={self.company.id}",
            {"reason": "Chuyển nhầm tài khoản đối tác"},
            format="json",
        )
        self.assertEqual(cancel_resp.status_code, 200)
        self.assertEqual(cancel_resp.data["status"], PaymentStatus.CANCELED)

        # 1. Reversal Journal Entry created
        rev_je = JournalEntry.objects.filter(source_event_id=f"AP.PAYMENT.CANCEL:{payment_id}").first()
        self.assertIsNotNone(rev_je)
        self.assertEqual(rev_je.status, "POSTED")
        self.assertEqual(rev_je.entry_type, "REVERSAL")

        # 2. Debt restored
        p.refresh_from_db()
        self.assertEqual(p.balance, Decimal("30000000"))
        self.assertEqual(p.paid_amount, Decimal("0"))
        self.assertEqual(p.status, PayableStatus.OPEN)

        # 3. Request restored to APPROVED
        req.refresh_from_db()
        self.assertEqual(req.paid_amount, Decimal("0"))
        self.assertEqual(req.status, PaymentRequestStatus.APPROVED)

    def test_direct_payment_without_request_af04(self):
        """AF-AP-PAY-04: Direct payment without payment request."""
        p = self._create_sample_payable(original_amount=Decimal("25000000"), balance=Decimal("25000000"))

        resp = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "DIRECT",
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "recipient_name": "Người nhận trực tiếp",
                "payment_content": "Chi tiền trực tiếp không qua đề nghị",
                "lines": [{"payable": str(p.id), "amount": 25000000}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["payment_source"], "DIRECT")

        # Debt reduced
        p.refresh_from_db()
        self.assertEqual(p.balance, Decimal("0"))
        self.assertEqual(p.status, PayableStatus.PAID)

    def test_validations_ex02_to_ex17(self):
        """Exception flow testing: EX-02 through EX-18."""
        p = self._create_sample_payable(original_amount=Decimal("10000000"), balance=Decimal("10000000"))
        req, req_line = self._create_approved_payment_request(p, request_amount=Decimal("10000000"), method=PaymentRequestMethod.CASH)

        # 1. Future payment date (EX-03)
        resp_future = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today + timedelta(days=5)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "recipient_name": "Người nhận",
                "payment_content": "Tương lai",
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_future.status_code, 400)
        self.assertIn("không được lớn hơn ngày hiện tại", str(resp_future.data))

        # 2. Empty payment content (EX-05)
        resp_empty_content = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "recipient_name": "Người nhận",
                "payment_content": "   ",
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_empty_content.status_code, 400)
        self.assertIn("Nội dung thanh toán", str(resp_empty_content.data))

        # 3. CASH missing cash fund (EX-06)
        resp_no_fund = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "DIRECT",
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "CASH",
                "recipient_name": "Người nhận",
                "payment_content": "Thiếu quỹ",
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_no_fund.status_code, 400)
        self.assertIn("Quỹ tiền mặt chi", str(resp_no_fund.data))

        # 4. CASH missing recipient name (EX-07)
        resp_no_recipient = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "DIRECT",
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "payment_content": "Thiếu người nhận",
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_no_recipient.status_code, 400)
        self.assertIn("Người nhận tiền", str(resp_no_recipient.data))

        # 5. BANK_TRANSFER missing transaction code (EX-10)
        resp_no_tx = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "BANK_TRANSFER",
                "company_bank_account": str(self.company_bank_acc.id),
                "beneficiary_name": "Beta",
                "beneficiary_account_number": "0987654321",
                "beneficiary_bank_name": "VCB",
                "bank_transaction_code": "",
                "payment_content": "Thiếu mã giao dịch",
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_no_tx.status_code, 400)
        self.assertIn("Mã giao dịch ngân hàng", str(resp_no_tx.data))

        # 6. Exceeding available amount (EX-13)
        resp_exceed = self.client.post(
            f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "POST",
                "payment_source": "PAYMENT_REQUEST",
                "payment_request": str(req.id),
                "supplier": str(self.supplier.id),
                "payment_date": str(self.today),
                "payment_method": "BANK_TRANSFER",
                "company_bank_account": str(self.company_bank_acc.id),
                "beneficiary_name": "Beta",
                "beneficiary_account_number": "0987654321",
                "beneficiary_bank_name": "VCB",
                "bank_transaction_code": "TX-EXCEED-01",
                "payment_content": "Vượt số tiền",
                "lines": [{"payable": str(p.id), "payment_request_line": str(req_line.id), "amount": 15000000}],  # Exceeds 10M
            },
            format="json",
        )
        self.assertEqual(resp_exceed.status_code, 400)
        self.assertIn("vượt quá số tiền còn được thanh toán", str(resp_exceed.data))
