from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from cash_management.models import CashFund
from common_services.models import Notification
from general_ledger.models import Account, AccountNature, AccountStatus, ChartOfAccounts, JournalEntry
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Bank, CompanyBankAccount, Currency, Party, PartyBankAccount, PartyRole, PaymentTerm
from organization.models import Branch, Company
from purchases.models import PurchaseOrder
from accounts_payable.models import (
    Payable, PayableDocument, PayableDocumentLine, PayableStatus,
    PaymentRequest, PaymentRequestLine, PaymentRequestMethod,
    PaymentRequestStatus, PaymentRequestType,
)


class PaymentRequestUcAp03Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="CO_AP_03",
            name="Doanh nghiệp AP03 Test",
            legal_name="Công ty TNHH AP03 Test",
            tax_code="0109999333",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="B_HN", name="Chi nhánh HN")

        # Bank and Bank Accounts
        self.bank = Bank.objects.create(code="VCB", name="Ngân hàng TMCP Ngoại thương Việt Nam")
        self.company_bank_acc = CompanyBankAccount.objects.create(
            company=self.company,
            bank=self.bank,
            account_number="0011004455667",
            account_name="CTY TNHH AP03 TEST",
            currency=self.currency,
            status="ACTIVE",
            allow_payment=True,
        )

        # Cash Fund
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA_AP03", name="COA AP03", effective_from=self.today, is_default=True
        )
        self.acc_111 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền mặt VND",
            account_type=AccountNature.ASSET, status=AccountStatus.ACTIVE
        )
        self.cash_fund = CashFund.objects.create(
            company=self.company,
            branch=self.branch,
            code="QUY_VND_01",
            name="Quỹ tiền mặt VND Văn phòng",
            currency=self.currency,
            gl_account=self.acc_111,
            status="ACTIVE",
        )

        # Supplier and Supplier Bank Account
        self.supplier = Party.objects.create(
            company=self.company,
            code="NCC_ALPHA",
            name="Công ty Cổ phần Alpha Cung Ứng",
            tax_code="0108888777",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=self.today)
        self.supplier_bank_acc = PartyBankAccount.objects.create(
            party=self.supplier,
            bank=self.bank,
            account_number="0123456789",
            account_name="CTY CP ALPHA CUNG UNG",
            is_default=True,
            status="ACTIVE",
        )

        # Users and Permissions
        User = get_user_model()
        self.maker_user = User.objects.create_user(
            username="ap_maker", email="maker@example.com", password="password123"
        )
        self.approver_user = User.objects.create_user(
            username="ap_approver", email="approver@example.com", password="password123"
        )

        m_maker = CompanyMembership.objects.create(user=self.maker_user.iam_account, company=self.company, created_by=self.maker_user.iam_account)
        m_approver = CompanyMembership.objects.create(user=self.approver_user.iam_account, company=self.company, created_by=self.maker_user.iam_account)

        # Setup IAM roles & permissions
        role_maker = Role.objects.create(company=self.company, code="R_AP_MAKER", name="Kế toán công nợ")
        role_approver = Role.objects.create(company=self.company, code="R_AP_APPROVER", name="Trưởng phòng duyệt chi")

        perms_to_assign = [
            "AP.PAYMENT_REQUEST.VIEW",
            "AP.PAYMENT_REQUEST.CREATE",
            "AP.PAYMENT_REQUEST.EDIT",
            "AP.PAYMENT_REQUEST.SUBMIT",
            "AP.PAYMENT_REQUEST.CANCEL",
        ]
        for p_code in perms_to_assign:
            perm, _ = Permission.objects.get_or_create(code=p_code, defaults={"name": p_code, "module_code": "AP"})
            RolePermission.objects.get_or_create(role=role_maker, permission=perm)

        appr_perms = ["AP.PAYMENT_REQUEST.VIEW", "AP.PAYMENT_REQUEST.APPROVE", "AP.PAYMENT_REQUEST.REJECT"]
        for p_code in appr_perms:
            perm, _ = Permission.objects.get_or_create(code=p_code, defaults={"name": p_code, "module_code": "AP"})
            RolePermission.objects.get_or_create(role=role_approver, permission=perm)

        UserRoleAssignment.objects.create(company_membership=m_maker, role=role_maker, assigned_by=self.maker_user.iam_account)
        UserRoleAssignment.objects.create(company_membership=m_approver, role=role_approver, assigned_by=self.maker_user.iam_account)

        self.client = APIClient()
        self.client.force_authenticate(user=self.maker_user)

    def _create_sample_payable(self, original_amount=Decimal("50000000"), balance=Decimal("50000000")):
        """Helper to create a posted PayableDocument and associated Payable."""
        acc_331 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code=f"331_{Payable.objects.count()}",
            name="Phải trả NCC", account_type=AccountNature.LIABILITY, status=AccountStatus.ACTIVE,
            requires_party=True
        )
        acc_642 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code=f"642_{Payable.objects.count()}",
            name="Chi phí QLDN", account_type=AccountNature.EXPENSE, status=AccountStatus.ACTIVE
        )
        doc = PayableDocument.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"CNPT-2026-{Payable.objects.count() + 1:05d}",
            document_date=self.today - timedelta(days=5),
            posting_date=self.today - timedelta(days=5),
            supplier=self.supplier,
            due_date=self.today + timedelta(days=25),
            payable_account=acc_331,
            currency=self.currency,
            subtotal=original_amount,
            tax_amount=Decimal("0"),
            total_amount=original_amount,
            status="POSTED",
            created_by=self.maker_user.iam_account,
        )
        PayableDocumentLine.objects.create(
            document=doc,
            line_no=1,
            description="Chi phí dịch vụ",
            debit_account=acc_642,
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

    def test_model_has_no_priority_field(self):
        """CRITICAL: User requirement explicitly states Mức độ ưu tiên was completely dropped."""
        self.assertFalse(hasattr(PaymentRequest, "priority"))
        self.assertFalse(hasattr(PaymentRequest, "priority_level"))
        self.assertFalse(hasattr(PaymentRequestLine, "priority"))

    def test_preview_number_and_monthly_counter_reset(self):
        """BR-03, BR-04: Number pattern DNTT-YYYYMM-NNNNNN with monthly reset."""
        resp = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/preview-number/?company_id={self.company.id}&requested_date={self.today}"
        )
        self.assertEqual(resp.status_code, 200)
        expected_prefix = f"DNTT-{self.today.year}{self.today.month:02d}-"
        self.assertTrue(resp.data["preview_number"].startswith(expected_prefix))
        self.assertEqual(len(resp.data["preview_number"]), len(expected_prefix) + 6)
        self.assertEqual(resp.data["preview_number"][-6:], "000001")

        # Create one request in current month
        p = self._create_sample_payable()
        draft_resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SAVE_DRAFT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=2)),
                "payment_method": "BANK_TRANSFER",
                "company_bank_account": str(self.company_bank_acc.id),
                "beneficiary_name": "Công ty Cổ phần Alpha Cung Ứng",
                "beneficiary_account_number": "0123456789",
                "beneficiary_bank_name": "Vietcombank",
                "payment_content": "Thanh toán đợt 1",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "hop_dong.pdf", "file_size": 1024}],
                "lines": [{"payable": str(p.id), "amount": 10000000}],
            },
            format="json",
        )
        self.assertEqual(draft_resp.status_code, 201)
        self.assertEqual(draft_resp.data["number"], f"{expected_prefix}000001")

        # Next preview in current month should be 000002
        resp2 = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/preview-number/?company_id={self.company.id}&requested_date={self.today}"
        )
        self.assertEqual(resp2.data["preview_number"][-6:], "000002")

        # Preview in next month should reset to 000001 (BR-04)
        next_month_date = (self.today.replace(day=1) + timedelta(days=32)).replace(day=5)
        next_month_prefix = f"DNTT-{next_month_date.year}{next_month_date.month:02d}-"
        resp_next_month = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/preview-number/?company_id={self.company.id}&requested_date={next_month_date}"
        )
        self.assertEqual(resp_next_month.data["preview_number"], f"{next_month_prefix}000001")

    def test_eligible_payables_retrieval_and_holding_calculation(self):
        """Steps 14-21, BR-17..24: Calculation of remaining, pending, and available amounts."""
        p1 = self._create_sample_payable(original_amount=Decimal("50000000"), balance=Decimal("50000000"))

        # 1. Check eligible payables endpoint
        resp = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/eligible-payables/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["items"]), 1)
        item = resp.data["items"][0]
        self.assertEqual(item["remaining_amount"], 50000000.0)
        self.assertEqual(item["pending_amount"], 0.0)
        self.assertEqual(item["available_amount"], 50000000.0)
        self.assertEqual(item["suggested_amount"], 50000000.0)

        # 2. Submit a request for 20,000,000 VND (PENDING_APPROVAL)
        submit_resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SUBMIT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=2)),
                "payment_method": "BANK_TRANSFER",
                "company_bank_account": str(self.company_bank_acc.id),
                "beneficiary_name": "Công ty Cổ phần Alpha Cung Ứng",
                "beneficiary_account_number": "0123456789",
                "beneficiary_bank_name": "Vietcombank",
                "payment_content": "Thanh toán đợt 1",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "hoa_don.pdf", "file_size": 2048}],
                "lines": [{"payable": str(p1.id), "amount": 20000000}],
            },
            format="json",
        )
        self.assertEqual(submit_resp.status_code, 201)
        self.assertEqual(submit_resp.data["status"], PaymentRequestStatus.PENDING_APPROVAL)
        self.assertEqual(submit_resp.data["message"], "Gửi đề nghị thanh toán thành công.")

        # 3. Check eligible payables again: pending should be 20,000,000 and available should be 30,000,000
        resp_after = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/eligible-payables/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        item_after = resp_after.data["items"][0]
        self.assertEqual(item_after["remaining_amount"], 50000000.0)
        self.assertEqual(item_after["pending_amount"], 20000000.0)
        self.assertEqual(item_after["available_amount"], 30000000.0)

    def test_financial_invariants_no_gl_entry_and_no_balance_deduction(self):
        """BR-33, BR-34: Creating/submitting payment request does NOT create GL entry and does NOT reduce payable balance."""
        p = self._create_sample_payable(original_amount=Decimal("40000000"), balance=Decimal("40000000"))
        gl_count_before = JournalEntry.objects.count()

        resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SUBMIT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=1)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Công ty Cổ phần Alpha Cung Ứng",
                "payment_content": "Chi tiền mặt cho Alpha",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "phieu_yeu_cau.pdf", "file_size": 1000}],
                "lines": [{"payable": str(p.id), "amount": 40000000}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)

        # Invariant 1: GL count must be unchanged (BR-33)
        self.assertEqual(JournalEntry.objects.count(), gl_count_before)

        # Invariant 2: Payable balance remains unchanged (BR-34)
        p.refresh_from_db()
        self.assertEqual(p.balance, Decimal("40000000"))
        self.assertEqual(p.paid_amount, Decimal("0"))

    def test_self_approval_prohibited(self):
        """BR-29: Requester cannot choose themselves as approver."""
        p = self._create_sample_payable()
        resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SUBMIT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=2)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Tự duyệt",
                "approver": str(self.maker_user.id),  # Same as requester!
                "attachments": [{"file_name": "doc.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("approver", resp.data)
        self.assertIn("Người lập không được chọn chính mình", str(resp.data["approver"]))

    def test_payment_method_validation_cash_vs_bank(self):
        """BR-10, BR-11, EF-10, EF-11: Cash requires cash_fund; Bank requires company_bank_account and receiver info."""
        p = self._create_sample_payable()

        # 1. CASH without cash_fund -> EF-10 error
        resp_cash_fail = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SAVE_DRAFT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today),
                "payment_method": "CASH",
                "beneficiary_name": "Alpha",
                "payment_content": "Chi tiền mặt thiếu quỹ",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "doc.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_cash_fail.status_code, 400)
        self.assertIn("cash_fund", resp_cash_fail.data)
        self.assertIn("Vui lòng chọn quỹ tiền mặt dự kiến chi", str(resp_cash_fail.data["cash_fund"]))

        # 2. BANK_TRANSFER missing bank details -> EF-11 error
        resp_bank_fail = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SAVE_DRAFT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today),
                "payment_method": "BANK_TRANSFER",
                "beneficiary_name": "Alpha",
                "payment_content": "Chuyển khoản thiếu thông tin ngân hàng",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "doc.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_bank_fail.status_code, 400)
        self.assertIn("bank_transfer", resp_bank_fail.data)
        self.assertIn("Vui lòng nhập đầy đủ tài khoản ngân hàng chi", str(resp_bank_fail.data["bank_transfer"]))

    def test_date_validations_ef13_and_ef14(self):
        """EF-13: requested_date <= today; EF-14: planned_payment_date >= requested_date."""
        p = self._create_sample_payable()

        # Future requested_date (EF-13)
        future_date = self.today + timedelta(days=2)
        resp_future = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(future_date),
                "planned_payment_date": str(future_date + timedelta(days=1)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Ngày đề nghị tương lai",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "doc.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_future.status_code, 400)
        self.assertIn("requested_date", resp_future.data)
        self.assertIn("không được lớn hơn ngày hiện tại", str(resp_future.data["requested_date"]))

        # Planned date before requested date (EF-14)
        resp_planned_earlier = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today - timedelta(days=1)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Ngày dự kiến trước ngày đề nghị",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "doc.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_planned_earlier.status_code, 400)
        self.assertIn("planned_payment_date", resp_planned_earlier.data)
        self.assertIn("không được nhỏ hơn ngày đề nghị", str(resp_planned_earlier.data["planned_payment_date"]))

    def test_attachment_validations_ef12_ef21_ef22_ef23(self):
        """Hồ sơ thanh toán: required, allowed formats, max 10MB, max 20 files."""
        p = self._create_sample_payable()

        # Missing attachments (EF-12)
        resp_no_att = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Không có hồ sơ",
                "approver": str(self.approver_user.id),
                "attachments": [],
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_no_att.status_code, 400)
        self.assertIn("attachments", resp_no_att.data)
        self.assertIn("Vui lòng liên kết hoặc tải lên", str(resp_no_att.data["attachments"]))

        # Invalid format e.g. .exe (EF-21)
        resp_bad_ext = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "File exe độc hại",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "virus.exe", "file_size": 1000}],
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_bad_ext.status_code, 400)
        self.assertIn("Định dạng tệp không được hỗ trợ", str(resp_bad_ext.data["attachments"]))

        # Over 10 MB (EF-22)
        resp_large_file = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "File quá lớn",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "video_hd.mp4.pdf", "file_size": 11 * 1024 * 1024}],
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_large_file.status_code, 400)
        self.assertIn("Dung lượng mỗi tệp không được vượt quá 10 MB", str(resp_large_file.data["attachments"]))

        # More than 20 files (EF-23)
        files_21 = [{"file_name": f"doc_{i}.pdf", "file_size": 1000} for i in range(21)]
        resp_21_files = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Quá 20 tệp",
                "approver": str(self.approver_user.id),
                "attachments": files_21,
                "lines": [{"payable": str(p.id), "amount": 1000000}],
            },
            format="json",
        )
        self.assertEqual(resp_21_files.status_code, 400)
        self.assertIn("tối đa 20 tệp", str(resp_21_files.data["attachments"]))

    def test_amount_exceeding_available_is_rejected(self):
        """EF-06: Amount cannot exceed available amount."""
        p = self._create_sample_payable(original_amount=Decimal("10000000"), balance=Decimal("10000000"))

        resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SUBMIT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=1)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Đề nghị vượt số dư",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "doc.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 15000000}],  # Exceeds 10M!
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Số dư công nợ đã thay đổi", str(resp.data))

    def test_supplier_advance_flow(self):
        """AF-01, AF-02, AF-03: Supplier advance creation and eligible orders query."""
        po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="PO-2026-0001",
            document_date=self.today - timedelta(days=2),
            supplier=self.supplier,
            currency=self.currency,
            total_amount=Decimal("100000000"),
            paid_amount=Decimal("0"),
            invoiced_amount=Decimal("0"),
            status="APPROVED",
            created_by=self.maker_user.iam_account,
        )

        # 1. Query eligible orders
        resp_orders = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/eligible-orders/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        self.assertEqual(resp_orders.status_code, 200)
        self.assertEqual(len(resp_orders.data["items"]), 1)
        self.assertEqual(resp_orders.data["items"][0]["available_advance_amount"], 100000000.0)

        # 2. Submit advance request for 30M
        resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SUBMIT",
                "request_type": "SUPPLIER_ADVANCE",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=3)),
                "payment_method": "BANK_TRANSFER",
                "company_bank_account": str(self.company_bank_acc.id),
                "beneficiary_name": "Công ty Cổ phần Alpha Cung Ứng",
                "beneficiary_account_number": "0123456789",
                "beneficiary_bank_name": "Vietcombank",
                "payment_content": "Tạm ứng 30% hợp đồng đơn hàng PO-2026-0001",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "don_mua_hang.pdf", "file_size": 2048}],
                "lines": [{"purchase_order": str(po.id), "amount": 30000000}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["request_type"], "SUPPLIER_ADVANCE")
        self.assertEqual(resp.data["status"], PaymentRequestStatus.PENDING_APPROVAL)

        # 3. Query eligible orders again: remaining advance should be 70M
        resp_orders2 = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/eligible-orders/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        self.assertEqual(resp_orders2.data["items"][0]["available_advance_amount"], 70000000.0)

    def test_notification_and_audit_log_created_on_submit(self):
        """Step 60, Step 61, BR-42: Notification sent to approver and Audit log recorded."""
        p = self._create_sample_payable()
        Notification.objects.all().delete()
        AuditLog.objects.filter(company=self.company).delete()

        resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SUBMIT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=2)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Chi trả nhà cung cấp",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "ho_so.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 5000000}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)

        # Check notification for approver
        notif = Notification.objects.filter(recipient=self.approver_user.iam_account).first()
        self.assertIsNotNone(notif)
        self.assertIn("Đề nghị thanh toán cần phê duyệt", notif.title)
        self.assertIn(resp.data["number"], notif.message)

        # Check audit log
        self.assertTrue(
            AuditLog.objects.filter(company=self.company, module_code="AP", action_code="SUBMIT").exists()
        )

    def test_lifecycle_submit_recall_approve_reject_cancel(self):
        """Lifecycle testing: recall (BR-39), approve, reject, cancel and hold release (BR-36)."""
        p = self._create_sample_payable(original_amount=Decimal("20000000"), balance=Decimal("20000000"))

        # 1. Create and Submit -> PENDING_APPROVAL
        resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SUBMIT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=1)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Thử nghiệm vòng đời",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "chung_tu.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 20000000}],
            },
            format="json",
        )
        req_id = resp.data["id"]

        # Holding should now be 20M, available 0
        resp_check1 = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/eligible-payables/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        self.assertEqual(len(resp_check1.data["items"]), 0)  # Available amount is 0, so excluded per Step 20

        # 2. Recall request back to DRAFT (BR-39) -> Holding released!
        recall_resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/{req_id}/recall/?company_id={self.company.id}"
        )
        self.assertEqual(recall_resp.status_code, 200)
        self.assertEqual(recall_resp.data["status"], PaymentRequestStatus.DRAFT)

        # Check holding released
        resp_check2 = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/eligible-payables/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        self.assertEqual(resp_check2.data["items"][0]["available_amount"], 20000000.0)

        # 3. Submit again
        sub_resp2 = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/{req_id}/submit/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=1)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Thử nghiệm vòng đời gửi lại",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "chung_tu.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 20000000}],
            },
            format="json",
        )
        self.assertEqual(sub_resp2.status_code, 200)
        self.assertEqual(sub_resp2.data["status"], PaymentRequestStatus.PENDING_APPROVAL)

        # 4. Approver rejects request
        self.client.force_authenticate(user=self.approver_user)
        rej_resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/{req_id}/reject/?company_id={self.company.id}",
            {"reason": "Chưa đủ chứng từ đính kèm"},
            format="json",
        )
        self.assertEqual(rej_resp.status_code, 200)
        self.assertEqual(rej_resp.data["status"], PaymentRequestStatus.REJECTED)

        # Check holding released on REJECTED (BR-36)
        resp_check3 = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/eligible-payables/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        self.assertEqual(resp_check3.data["items"][0]["available_amount"], 20000000.0)

        # 5. Maker edits rejected request and submits again (BR-38, BR-41)
        self.client.force_authenticate(user=self.maker_user)
        edit_resp = self.client.put(
            f"/api/v1/accounts-payable/payment-requests/{req_id}/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "action": "SUBMIT",
                "request_type": "DEBT_PAYMENT",
                "supplier": str(self.supplier.id),
                "requested_date": str(self.today),
                "planned_payment_date": str(self.today + timedelta(days=2)),
                "payment_method": "CASH",
                "cash_fund": str(self.cash_fund.id),
                "beneficiary_name": "Alpha",
                "payment_content": "Đã bổ sung chứng từ",
                "approver": str(self.approver_user.id),
                "attachments": [{"file_name": "chung_tu_bo_sung.pdf"}],
                "lines": [{"payable": str(p.id), "amount": 20000000}],
            },
            format="json",
        )
        self.assertEqual(edit_resp.status_code, 200)
        self.assertEqual(edit_resp.data["status"], PaymentRequestStatus.PENDING_APPROVAL)

        # 6. Approver approves request
        self.client.force_authenticate(user=self.approver_user)
        app_resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/{req_id}/approve/?company_id={self.company.id}"
        )
        self.assertEqual(app_resp.status_code, 200)
        self.assertEqual(app_resp.data["status"], PaymentRequestStatus.APPROVED)

        # 7. Cancel request (releases holding)
        self.client.force_authenticate(user=self.maker_user)
        cancel_resp = self.client.post(
            f"/api/v1/accounts-payable/payment-requests/{req_id}/cancel/?company_id={self.company.id}",
            {"reason": "Hủy do đối tác thay đổi điều khoản"},
            format="json",
        )
        self.assertEqual(cancel_resp.status_code, 200)
        self.assertEqual(cancel_resp.data["status"], PaymentRequestStatus.CANCELED)

        # Check holding released on CANCELED (BR-36)
        resp_check4 = self.client.get(
            f"/api/v1/accounts-payable/payment-requests/eligible-payables/?company_id={self.company.id}&supplier_id={self.supplier.id}"
        )
        self.assertEqual(resp_check4.data["items"][0]["available_amount"], 20000000.0)
