from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from general_ledger.models import Account, AccountNature, AccountingPeriod, ChartOfAccounts, JournalEntry, JournalLine
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Party
from organization.models import Company
from .models import (
    DocumentStatus, Payable, PayableAdjustmentVoucher, PayableStatus, SupplierInvoice,
)


class PayableAdjustmentUcAp07Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="AP07", name="AP07", legal_name="AP07", tax_code="0100000007",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.user = get_user_model().objects.create_superuser(
            username="ap07-user", email="ap07@example.com", password="test")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.supplier = Party.objects.create(company=self.company, code="NCC07", name="Supplier")
        self.period = AccountingPeriod.objects.create(
            company=self.company, code="AP07-OPEN", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today,
        )
        chart = ChartOfAccounts.objects.create(company=self.company, code="AP07COA", name="AP07 COA",
                                               effective_from=self.today, is_default=True)
        self.ap_account = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="331", name="Payable",
            account_type=AccountNature.LIABILITY, requires_party=True,
        )
        self.counter_account = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="642", name="Expense",
            account_type=AccountNature.EXPENSE,
        )
        self.invoice = SupplierInvoice.objects.create(
            company=self.company, supplier=self.supplier, supplier_tax_code="0100000007",
            invoice_series="AA", invoice_number="AP07-001", invoice_date=self.today,
            posting_date=self.today, currency=self.currency, created_by=self.user.iam_account,
            status=DocumentStatus.POSTED,
        )
        self.payable = Payable.objects.create(
            company=self.company, supplier=self.supplier, invoice=self.invoice, currency=self.currency,
            exchange_rate=1, original_amount="100", balance="100", due_date=self.today,
        )

    @property
    def url(self):
        return f"/api/v1/accounts-payable/adjustment-vouchers/?company_id={self.company.pk}"

    def payload(self, **changes):
        data = {
            "company": str(self.company.pk), "supplier": str(self.supplier.pk),
            "payable": str(self.payable.pk), "kind": "INCREASE",
            "adjustment_date": str(self.today), "reason": "RECONCILIATION",
            "basis": "Biên bản đối chiếu 01", "amount": "25",
            "counter_account": str(self.counter_account.pk), "expected_balance": "100",
        }
        data.update(changes)
        return data

    def test_increase_and_cancel_post_reverse_journal(self):
        """AF-AP-ADJ-01 & AF-AP-ADJ-05: Post increase adjustment and cancel reversal."""
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["number"], f"DCPT-{self.today.year}-000001")
        self.assertIn("Ghi sổ điều chỉnh công nợ thành công", response.data["message"])

        voucher = PayableAdjustmentVoucher.objects.get(pk=response.data["id"])
        self.assertEqual(voucher.balance_before, Decimal("100"))
        self.assertEqual(voucher.balance_after, Decimal("125"))
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.adjustment_amount, Decimal("25"))
        self.assertEqual(self.payable.balance, Decimal("125"))

        # GL Lines: Nợ 642 / Có 331
        lines = list(JournalLine.objects.filter(entry=voucher.journal_entry).order_by("line_no"))
        self.assertEqual([(x.account.code, x.debit, x.credit) for x in lines],
                         [("642", Decimal("25"), Decimal("0")), ("331", Decimal("0"), Decimal("25"))])

        # Cancel voucher
        cancel_url = f"/api/v1/accounts-payable/adjustment-vouchers/{voucher.pk}/cancel/?company_id={self.company.pk}"
        cancelled = self.client.post(cancel_url, {"reason": "Sai số"}, format="json")
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        voucher.refresh_from_db()
        self.payable.refresh_from_db()
        self.assertEqual(voucher.status, "CANCELLED")
        self.assertEqual(self.payable.balance, Decimal("100"))
        self.assertEqual(self.payable.adjustment_amount, Decimal("0"))

        # GL Reversal lines: Nợ 331 / Có 642
        reversal = list(JournalLine.objects.filter(entry=voucher.reversal_journal_entry).order_by("line_no"))
        self.assertEqual([(x.account.code, x.debit, x.credit) for x in reversal],
                         [("331", Decimal("25"), Decimal("0")), ("642", Decimal("0"), Decimal("25"))])
        self.assertEqual(self.client.post(cancel_url, {"reason": "Again"}, format="json").status_code, 400)

    def test_decrease_full_then_increase_reopens_paid_debt(self):
        """AF-AP-ADJ-03 & AF-AP-ADJ-04: Full decrease marks PAID; subsequent increase reopens."""
        decrease = self.client.post(self.url, self.payload(kind="DECREASE", amount="100"), format="json")
        self.assertEqual(decrease.status_code, 201, decrease.data)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("0"))
        self.assertEqual(self.payable.status, PayableStatus.PAID)

        # GL Lines: Nợ 331 / Có 642
        lines = list(JournalLine.objects.filter(entry_id=decrease.data["journal_entry"]).order_by("line_no"))
        self.assertEqual([(x.account.code, x.debit, x.credit) for x in lines],
                         [("331", Decimal("100"), Decimal("0")), ("642", Decimal("0"), Decimal("100"))])

        # Eligible payables for INCREASE includes paid payable
        eligible = self.client.get(self.url.replace("?", "eligible-payables/?") + f"&supplier_id={self.supplier.pk}&kind=INCREASE")
        self.assertEqual(eligible.status_code, 200, eligible.data)
        self.assertEqual(len(eligible.data), 1)
        self.assertEqual(eligible.data[0]["decrease_amount"], Decimal("100"))

        # Reopen with increase
        increase = self.client.post(self.url, self.payload(amount="10", expected_balance="0"), format="json")
        self.assertEqual(increase.status_code, 201, increase.data)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("10"))
        self.assertEqual(self.payable.status, PayableStatus.OPEN)
        self.assertEqual(increase.data["number"], f"DCPT-{self.today.year}-000002")

    def test_partial_decrease_and_partially_paid_status(self):
        """AF-AP-ADJ-02: Partial decrease updates status appropriately."""
        # 1. Partial decrease when unpaid (paid_amount=0) -> remains OPEN
        res1 = self.client.post(self.url, self.payload(kind="DECREASE", amount="30"), format="json")
        self.assertEqual(res1.status_code, 201)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("70"))
        self.assertEqual(self.payable.status, PayableStatus.OPEN)

        # 2. Simulate paid_amount > 0, then partial decrease -> PARTIALLY_PAID
        self.payable.paid_amount = Decimal("20")
        self.payable.balance = Decimal("50")
        self.payable.save(update_fields=("paid_amount", "balance"))

        res2 = self.client.post(self.url, self.payload(kind="DECREASE", amount="10", expected_balance="50"), format="json")
        self.assertEqual(res2.status_code, 201)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("40"))
        self.assertEqual(self.payable.status, PayableStatus.PARTIALLY_PAID)

    def test_increase_reopens_paid_payment_and_cancel_keeps_number_used(self):
        """AF-AP-ADJ-04 & BR-AP-ADJ-22: Increase paid debt; cancelling keeps sequence moving forward."""
        self.payable.paid_amount = Decimal("100")
        self.payable.balance = Decimal("0")
        self.payable.status = PayableStatus.PAID
        self.payable.save(update_fields=("paid_amount", "balance", "status"))

        first = self.client.post(self.url, self.payload(expected_balance="0", amount="15"), format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("15"))
        self.assertEqual(self.payable.status, PayableStatus.PARTIALLY_PAID)

        cancel_url = f"/api/v1/accounts-payable/adjustment-vouchers/{first.data['id']}/cancel/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(cancel_url, {"reason": "Retry"}, format="json").status_code, 200)
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.status, PayableStatus.PAID)

        # Counter sequence never reused
        second = self.client.post(self.url, self.payload(expected_balance="0", amount="10"), format="json")
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(second.data["number"], f"DCPT-{self.today.year}-000002")

    def test_all_validation_exceptions_ex02_to_ex19(self):
        """Verify exact Vietnamese error messages for EX-AP-ADJ-02 to EX-AP-ADJ-19."""
        # EX-02: Chưa chọn Nhà cung cấp
        res = self.client.post(self.url, self.payload(supplier=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng chọn Nhà cung cấp.", str(res.data))

        # EX-03: Chưa chọn Loại điều chỉnh
        res = self.client.post(self.url, self.payload(kind=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng chọn Loại điều chỉnh.", str(res.data))

        # EX-04: Chưa chọn chứng từ công nợ
        res = self.client.post(self.url, self.payload(payable=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng chọn Chứng từ công nợ cần điều chỉnh.", str(res.data))

        # EX-05: Chưa nhập Ngày điều chỉnh
        res = self.client.post(self.url, self.payload(adjustment_date=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Ngày điều chỉnh.", str(res.data))

        # EX-06: Chưa chọn Lý do điều chỉnh
        res = self.client.post(self.url, self.payload(reason=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng chọn Lý do điều chỉnh.", str(res.data))

        # EX-07: Chọn Lý do khác nhưng chưa nhập chi tiết
        res = self.client.post(self.url, self.payload(reason="OTHER", reason_detail=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Chi tiết lý do điều chỉnh.", str(res.data))

        # EX-08: Chưa nhập Căn cứ điều chỉnh
        res = self.client.post(self.url, self.payload(basis=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Căn cứ điều chỉnh.", str(res.data))

        # EX-09: Chưa nhập hoặc nhập số tiền không hợp lệ
        for invalid_amount in ("0", "-10", "", "abc"):
            res = self.client.post(self.url, self.payload(amount=invalid_amount), format="json")
            self.assertEqual(res.status_code, 400)
            self.assertIn("Số tiền điều chỉnh phải lớn hơn 0.", str(res.data))

        # EX-10: Chưa chọn tài khoản đối ứng
        res = self.client.post(self.url, self.payload(counter_account=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng chọn Tài khoản đối ứng.", str(res.data))

        # EX-11: Chọn tài khoản 331 làm tài khoản đối ứng
        res = self.client.post(self.url, self.payload(counter_account=str(self.ap_account.pk)), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Tài khoản đối ứng phải khác tài khoản công nợ 331.", str(res.data))

        # EX-12: Chưa nhập Diễn giải
        res = self.client.post(self.url, self.payload(description=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Diễn giải.", str(res.data))

        # EX-13: Ngày điều chỉnh nhỏ hơn ngày hạch toán công nợ
        res = self.client.post(self.url, self.payload(adjustment_date=str(self.today - timedelta(days=5))), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ngày điều chỉnh không được nhỏ hơn ngày hạch toán của chứng từ công nợ.", str(res.data))

        # EX-14: Ngày điều chỉnh lớn hơn hiện tại
        res = self.client.post(self.url, self.payload(adjustment_date=str(self.today + timedelta(days=1))), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ngày điều chỉnh không được lớn hơn ngày hiện tại.", str(res.data))

        # EX-15: Kỳ kế toán đã khóa
        self.period.status = "CLOSED"
        self.period.save(update_fields=("status",))
        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Kỳ kế toán của ngày điều chỉnh đã bị khóa.", str(res.data))
        self.period.status = "OPEN"
        self.period.save(update_fields=("status",))

        # EX-16: Điều chỉnh giảm vượt công nợ
        res = self.client.post(self.url, self.payload(kind="DECREASE", amount="150"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Số tiền điều chỉnh giảm không được vượt số tiền còn phải trả là 100", str(res.data))

        # EX-17: Tài khoản đối ứng ngừng hoạt động
        inactive_account = Account.objects.create(
            company=self.company, chart_of_accounts=self.ap_account.chart_of_accounts,
            code="811_INACT", name="Inactive", status="INACTIVE", account_type=AccountNature.EXPENSE,
        )
        res = self.client.post(self.url, self.payload(counter_account=str(inactive_account.pk)), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Tài khoản đối ứng đã ngừng hoạt động hoặc không cho phép hạch toán.", str(res.data))

        # EX-18: Công nợ đã được cập nhật
        res = self.client.post(self.url, self.payload(expected_balance="90"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Số tiền công nợ đã thay đổi. Vui lòng tải lại dữ liệu.", str(res.data))

        # EX-19: Tệp không hợp lệ
        res = self.client.post(self.url, self.payload(attachments=[{"name": "bad.exe", "size": 100}]), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Tệp bad.exe không đúng định dạng hoặc vượt quá dung lượng 10 MB.", str(res.data))

        # Ensure atomicity: no vouchers or journal entries created during errors
        self.assertFalse(PayableAdjustmentVoucher.objects.exists())
        self.assertFalse(JournalEntry.objects.exists())

    def test_cancel_validation_and_idempotency(self):
        """AF-AP-ADJ-05: Test cancellation reason validation, duplicate check, and balance limit."""
        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 201)
        voucher_id = res.data["id"]
        cancel_url = f"/api/v1/accounts-payable/adjustment-vouchers/{voucher_id}/cancel/?company_id={self.company.pk}"

        # 1. Missing reason
        err1 = self.client.post(cancel_url, {"reason": ""}, format="json")
        self.assertEqual(err1.status_code, 400)
        self.assertIn("Vui lòng nhập Lý do hủy.", str(err1.data))

        # 2. Reason > 500 chars
        err2 = self.client.post(cancel_url, {"reason": "R" * 501}, format="json")
        self.assertEqual(err2.status_code, 400)
        self.assertIn("Lý do hủy không được vượt quá 500 ký tự.", str(err2.data))

        # 3. Successful cancel
        ok_res = self.client.post(cancel_url, {"reason": "Hủy hợp lệ"}, format="json")
        self.assertEqual(ok_res.status_code, 200)
        self.assertIn("Hủy chứng từ điều chỉnh công nợ thành công", ok_res.data["message"])

        # 4. Duplicate cancel
        err3 = self.client.post(cancel_url, {"reason": "Hủy lần hai"}, format="json")
        self.assertEqual(err3.status_code, 400)
        self.assertIn("Chứng từ điều chỉnh đã được hủy trước đó.", str(err3.data))

    def test_cancel_blocked_when_balance_insufficient(self):
        """Cannot cancel increase if debt balance was subsequently depleted below adjustment amount."""
        res = self.client.post(self.url, self.payload(amount="50"), format="json")
        self.assertEqual(res.status_code, 201)
        voucher_id = res.data["id"]

        # Simulate payments reducing balance to 10
        self.payable.refresh_from_db()
        self.payable.balance = Decimal("10")
        self.payable.save(update_fields=("balance",))

        cancel_url = f"/api/v1/accounts-payable/adjustment-vouchers/{voucher_id}/cancel/?company_id={self.company.pk}"
        err = self.client.post(cancel_url, {"reason": "Hủy"}, format="json")
        self.assertEqual(err.status_code, 400)
        self.assertIn("Không thể hủy vì số dư công nợ hiện tại không đủ để hoàn tác điều chỉnh.", str(err.data))

    def test_eligible_payables_and_accounts_endpoints(self):
        """Bước 3, 4, 5, 12: Check eligible payables filtering and eligible counter accounts."""
        # Eligible accounts excludes 331
        acc_res = self.client.get(self.url.replace("?", "eligible-accounts/?"))
        self.assertEqual(acc_res.status_code, 200)
        codes = [a["code"] for a in acc_res.data]
        self.assertIn("642", codes)
        self.assertNotIn("331", codes)

        # Decrease: shows only payables with balance > 0
        dec_res = self.client.get(self.url.replace("?", "eligible-payables/?") + f"&supplier_id={self.supplier.pk}&kind=DECREASE")
        self.assertEqual(dec_res.status_code, 200)
        self.assertEqual(len(dec_res.data), 1)
        self.assertEqual(dec_res.data[0]["supplier_name"], self.supplier.name)

        # When balance = 0, Decrease excludes it, Increase includes it
        self.payable.balance = Decimal("0")
        self.payable.save(update_fields=("balance",))

        dec_empty = self.client.get(self.url.replace("?", "eligible-payables/?") + f"&supplier_id={self.supplier.pk}&kind=DECREASE")
        self.assertEqual(dec_empty.status_code, 200)
        self.assertEqual(len(dec_empty.data), 0)

        inc_res = self.client.get(self.url.replace("?", "eligible-payables/?") + f"&supplier_id={self.supplier.pk}&kind=INCREASE")
        self.assertEqual(inc_res.status_code, 200)
        self.assertEqual(len(inc_res.data), 1)

    def test_unposted_source_is_not_eligible(self):
        """Payables from unposted invoices cannot be adjusted."""
        self.invoice.status = DocumentStatus.DRAFT
        self.invoice.save(update_fields=("status",))
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 400, response.data)
        eligible = self.client.get(self.url.replace("?", "eligible-payables/?") + f"&supplier_id={self.supplier.pk}&kind=INCREASE")
        self.assertEqual(eligible.data, [])

    def test_rbac_permissions_ex01(self):
        """EX-AP-ADJ-01: Test IAM RBAC permissions on adjustment endpoints."""
        staff = get_user_model().objects.create_user(username="ap07-staff", email="staff07@example.com", password="pass")
        CompanyMembership.objects.create(
            company=self.company, user=staff.iam_account, created_by=self.user.iam_account, membership_status="ACTIVE")

        staff_client = APIClient()
        staff_client.force_authenticate(staff)

        # 1. Without permission, cannot view list
        list_res = staff_client.get(self.url)
        self.assertEqual(list_res.status_code, 403)
        self.assertIn("Bạn không có quyền xem điều chỉnh công nợ phải trả.", str(list_res.data))

        # 2. Without permission, cannot create (EX-01)
        create_res = staff_client.post(self.url, self.payload(), format="json")
        self.assertEqual(create_res.status_code, 403)
        self.assertIn("Bạn không có quyền điều chỉnh công nợ phải trả.", str(create_res.data))

        # 3. Grant AP.ADJUSTMENT_VOUCHER.VIEW and AP.ADJUSTMENT_VOUCHER.CREATE
        role = Role.objects.create(company=self.company, code="ADJ_ROLE", name="Adjustment Role")
        perm_view = Permission.objects.filter(code="AP.ADJUSTMENT_VOUCHER.VIEW").first()
        perm_create = Permission.objects.filter(code="AP.ADJUSTMENT_VOUCHER.CREATE").first()
        if perm_view:
            RolePermission.objects.create(role=role, permission=perm_view)
        if perm_create:
            RolePermission.objects.create(role=role, permission=perm_create)
        membership = CompanyMembership.objects.get(company=self.company, user=staff.iam_account)
        UserRoleAssignment.objects.create(company_membership=membership, role=role, assigned_by=self.user.iam_account)

        # Now view and create should succeed
        ok_list = staff_client.get(self.url)
        self.assertEqual(ok_list.status_code, 200)

        ok_create = staff_client.post(self.url, self.payload(), format="json")
        self.assertEqual(ok_create.status_code, 201)

        # Cancel without AP.ADJUSTMENT_VOUCHER.CANCEL fails
        cancel_url = f"/api/v1/accounts-payable/adjustment-vouchers/{ok_create.data['id']}/cancel/?company_id={self.company.pk}"
        cancel_res = staff_client.post(cancel_url, {"reason": "Hủy"}, format="json")
        self.assertEqual(cancel_res.status_code, 403)
        self.assertIn("Bạn không có quyền hủy điều chỉnh công nợ phải trả.", str(cancel_res.data))
