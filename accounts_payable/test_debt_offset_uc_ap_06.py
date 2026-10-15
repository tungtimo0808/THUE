from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts_receivable.models import Receivable, ReceivableSchedule, ReceivableStatus
from general_ledger.models import Account, AccountNature, AccountingPeriod, ChartOfAccounts, JournalEntry, JournalLine
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Party, PartyRole
from organization.models import Company
from .allocation_services import _payable_number
from .models import DebtOffsetVoucher, Payable, PayableStatus, SupplierInvoice
from .offset_services import _receivable_number


class DebtOffsetUcAp06Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="AP06", name="AP06", legal_name="AP06", tax_code="0100000006",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.user = get_user_model().objects.create_superuser(
            username="ap06-user", email="ap06@example.com", password="test")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.partner = Party.objects.create(company=self.company, code="BOTH06", name="Dual role")
        for role in ("VENDOR", "CUSTOMER"):
            PartyRole.objects.create(party=self.partner, role_type=role, active_from=self.today - timedelta(days=30))
        self.period = AccountingPeriod.objects.create(
            company=self.company, code="AP06-OPEN", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1),
            end_date=self.today + timedelta(days=28), status="OPEN",
        )
        chart = ChartOfAccounts.objects.create(company=self.company, code="AP06COA", name="AP06 COA",
                                               effective_from=self.today, is_default=True)
        Account.objects.create(company=self.company, chart_of_accounts=chart, code="331", name="Payable",
                               account_type=AccountNature.LIABILITY, requires_party=True)
        Account.objects.create(company=self.company, chart_of_accounts=chart, code="131", name="Receivable",
                               account_type=AccountNature.ASSET, requires_party=True)
        invoice = SupplierInvoice.objects.create(
            company=self.company, supplier=self.partner, supplier_tax_code="0100000006",
            invoice_series="AA", invoice_number="AP06-001", invoice_date=self.today,
            posting_date=self.today, currency=self.currency, created_by=self.user.iam_account,
        )
        self.payable = Payable.objects.create(
            company=self.company, supplier=self.partner, invoice=invoice, currency=self.currency,
            exchange_rate=1, original_amount="100", balance="100", due_date=self.today,
        )
        self.receivable = Receivable.objects.create(
            company=self.company, customer=self.partner, currency=self.currency,
            exchange_rate=1, original_amount="120", balance="120", due_date=self.today,
            posting_date=self.today, source_document_number="AR06-001",
        )
        self.schedule = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.receivable, installment_no=1,
            amount="120", balance="120", due_date=self.today,
        )

    @property
    def url(self):
        return f"/api/v1/accounts-payable/debt-offsets/?company_id={self.company.pk}"

    def payload(self, **changes):
        data = {
            "company": str(self.company.pk), "partner": str(self.partner.pk),
            "offset_date": str(self.today), "basis": "Biên bản 01",
            "payable_lines": [{"payable": str(self.payable.pk), "amount": "60", "expected_balance": "100"}],
            "receivable_lines": [{"receivable": str(self.receivable.pk), "amount": "60", "expected_balance": "120"}],
        }
        data.update(changes)
        return data

    def test_post_and_cancel_balanced_journals_and_restore_debts(self):
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["number"], f"BTCN-{self.today.year}-000001")
        self.assertIn("Ghi sổ chứng từ bù trừ thành công", response.data["message"])
        voucher = DebtOffsetVoucher.objects.get(pk=response.data["id"])
        self.assertEqual(voucher.status, "POSTED")
        lines = list(JournalLine.objects.filter(entry=voucher.journal_entry).order_by("line_no"))
        self.assertEqual([(line.account.code, line.debit, line.credit) for line in lines],
                         [("331", Decimal("60"), Decimal("0")), ("131", Decimal("0"), Decimal("60"))])
        self.payable.refresh_from_db()
        self.receivable.refresh_from_db()
        self.schedule.refresh_from_db()
        self.assertEqual((self.payable.balance, self.receivable.balance, self.schedule.balance),
                         (Decimal("40"), Decimal("60"), Decimal("60")))
        self.assertEqual(self.payable.status, PayableStatus.PARTIALLY_PAID)
        self.assertEqual(self.receivable.status, ReceivableStatus.PARTIALLY_PAID)

        cancel_url = f"/api/v1/accounts-payable/debt-offsets/{voucher.pk}/cancel/?company_id={self.company.pk}"
        cancelled = self.client.post(cancel_url, {"reason": "Sai biên bản"}, format="json")
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        voucher.refresh_from_db()
        self.assertEqual(voucher.status, "CANCELLED")
        self.assertEqual(voucher.reversal_journal_entry.status, "POSTED")
        self.assertEqual(voucher.journal_entry.status, "REVERSED")
        reverse_lines = list(JournalLine.objects.filter(entry=voucher.reversal_journal_entry).order_by("line_no"))
        self.assertEqual([(line.account.code, line.debit, line.credit) for line in reverse_lines],
                         [("131", Decimal("60"), Decimal("0")), ("331", Decimal("0"), Decimal("60"))])
        self.payable.refresh_from_db()
        self.receivable.refresh_from_db()
        self.schedule.refresh_from_db()
        self.assertEqual((self.payable.balance, self.receivable.balance, self.schedule.balance),
                         (Decimal("100"), Decimal("120"), Decimal("120")))
        self.assertEqual(self.client.post(cancel_url, {"reason": "Again"}, format="json").status_code, 400)

    def test_all_validation_exceptions_ex01_to_ex22(self):
        """Test exact exception flow validation codes and messages from EX-02 to EX-21."""
        other_partner = Party.objects.create(company=self.company, code="OTHER06", name="Other Partner")
        other_debt = Receivable.objects.create(
            company=self.company, customer=other_partner, currency=self.currency, exchange_rate=1,
            original_amount="60", balance="60", due_date=self.today, posting_date=self.today,
        )
        usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "US Dollar", "decimal_places": 2})
        diff_curr_receivable = Receivable.objects.create(
            company=self.company, customer=self.partner, currency=usd, exchange_rate=1,
            original_amount="60", balance="60", due_date=self.today, posting_date=self.today,
        )

        cases = [
            # EX-02: Chưa chọn đối tác
            ({"partner": ""}, "Vui lòng chọn Đối tác bù trừ."),
            # EX-06: Chưa nhập Ngày bù trừ
            ({"offset_date": ""}, "Vui lòng nhập Ngày bù trừ."),
            # EX-07: Chưa nhập Căn cứ bù trừ
            ({"basis": ""}, "Vui lòng nhập Căn cứ bù trừ."),
            ({"basis": "B" * 256}, "Căn cứ bù trừ không được vượt quá 255 ký tự."),
            # EX-08: Chưa nhập Diễn giải
            ({"description": "   "}, "Vui lòng nhập Diễn giải."),
            ({"description": "D" * 501}, "Diễn giải không được vượt quá 500 ký tự."),
            # EX-09: Chưa chọn khoản phải trả
            ({"payable_lines": []}, "Vui lòng chọn ít nhất một khoản công nợ phải trả."),
            # EX-10: Chưa chọn khoản phải thu
            ({"receivable_lines": []}, "Vui lòng chọn ít nhất một khoản công nợ phải thu."),
            # EX-11: Có dòng không nhập tiền hoặc tiền <= 0
            ({"payable_lines": [{"payable": str(self.payable.pk), "amount": "0"}]}, "Số tiền bù trừ của các dòng được chọn phải lớn hơn 0."),
            # EX-12: Ngày bù trừ nhỏ hơn ngày hạch toán công nợ
            ({"offset_date": str(self.today - timedelta(days=5))}, f"Ngày bù trừ không được nhỏ hơn ngày hạch toán của chứng từ {_payable_number(self.payable)}."),
            # EX-13: Ngày bù trừ lớn hơn hiện tại
            ({"offset_date": str(self.today + timedelta(days=1))}, "Ngày bù trừ không được lớn hơn ngày hiện tại."),
            # EX-15: Công nợ khác đối tác
            ({"receivable_lines": [{"receivable": str(other_debt.pk), "amount": "60"}]}, "Các khoản công nợ được chọn phải thuộc cùng một đối tác."),
            # EX-16: Công nợ khác loại tiền
            ({"receivable_lines": [{"receivable": str(diff_curr_receivable.pk), "amount": "60"}]}, "Các khoản công nợ được chọn phải sử dụng cùng một loại tiền."),
            # EX-17: Tổng hai bên không bằng nhau
            ({"receivable_lines": [{"receivable": str(self.receivable.pk), "amount": "59"}]}, "Tổng bù trừ phải trả phải bằng Tổng bù trừ phải thu. Chênh lệch hiện tại: 1."),
            # EX-18: Công nợ vừa được cập nhật
            ({"payable_lines": [{"payable": str(self.payable.pk), "amount": "60", "expected_balance": "90"}]}, f"Số tiền công nợ của chứng từ {_payable_number(self.payable)} đã thay đổi. Vui lòng tải lại dữ liệu."),
            # EX-19: Số tiền vượt công nợ phải trả
            ({"payable_lines": [{"payable": str(self.payable.pk), "amount": "101"}], "receivable_lines": [{"receivable": str(self.receivable.pk), "amount": "101"}]}, f"Số tiền bù trừ của chứng từ phải trả {_payable_number(self.payable)} vượt số tiền còn phải trả là 100."),
            # EX-20: Số tiền vượt công nợ phải thu
            ({"payable_lines": [{"payable": str(self.payable.pk), "amount": "50"}], "receivable_lines": [{"receivable": str(self.receivable.pk), "amount": "125"}]}, f"Số tiền bù trừ của chứng từ phải thu {_receivable_number(self.receivable)} vượt số tiền còn phải thu là 120."),
            # EX-21: Tệp không hợp lệ
            ({"attachments": [{"name": "bad.exe", "size": 100}]}, "Tệp bad.exe không đúng định dạng hoặc vượt quá dung lượng 10 MB."),
        ]

        for changes, expected_msg in cases:
            res = self.client.post(self.url, self.payload(**changes), format="json")
            self.assertEqual(res.status_code, 400, f"Payload {changes} did not return 400: {res.data}")
            self.assertIn(expected_msg, str(res.data), f"Expected '{expected_msg}' in {res.data}")

        # EX-14: Closed accounting period
        self.period.status = "CLOSED"
        self.period.save(update_fields=("status",))
        closed_res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(closed_res.status_code, 400)
        self.assertIn("Kỳ kế toán của ngày bù trừ đã bị khóa.", str(closed_res.data))

    def test_partner_dual_role_requirement_ex03(self):
        """EX-AP-OFFSET-03: Đối tác chưa được liên kết đồng thời với khách hàng và nhà cung cấp."""
        single_role_partner = Party.objects.create(company=self.company, code="VENDOR_ONLY", name="Vendor Only")
        PartyRole.objects.create(party=single_role_partner, role_type="VENDOR", active_from=self.today - timedelta(days=30))
        res = self.client.post(self.url, self.payload(partner=str(single_role_partner.pk)), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Đối tác chưa được liên kết đồng thời với khách hàng và nhà cung cấp.", str(res.data))

    def test_eligible_debts_empty_checks_ex04_ex05(self):
        """EX-AP-OFFSET-04 & EX-AP-OFFSET-05: Kiểm tra đối tác không có công nợ phải trả hoặc phải thu."""
        dual_no_debt = Party.objects.create(company=self.company, code="DUAL_NO_DEBT", name="Dual No Debt")
        for role in ("VENDOR", "CUSTOMER"):
            PartyRole.objects.create(party=dual_no_debt, role_type=role, active_from=self.today - timedelta(days=30))

        # 1. Không có công nợ phải trả
        err_res = self.client.get(f"/api/v1/accounts-payable/debt-offsets/eligible-debts/?company_id={self.company.pk}&partner_id={dual_no_debt.pk}")
        self.assertEqual(err_res.status_code, 400)
        self.assertIn("Đối tác không có khoản công nợ phải trả chưa thanh toán.", str(err_res.data))

        # 2. Tạo payable nhưng chưa có receivable
        invoice = SupplierInvoice.objects.create(
            company=self.company, supplier=dual_no_debt, supplier_tax_code="0100000006",
            invoice_series="AA", invoice_number="AP06-009", invoice_date=self.today,
            posting_date=self.today, currency=self.currency, created_by=self.user.iam_account,
        )
        Payable.objects.create(
            company=self.company, supplier=dual_no_debt, invoice=invoice, currency=self.currency,
            exchange_rate=1, original_amount="50", balance="50", due_date=self.today,
        )
        err_res2 = self.client.get(f"/api/v1/accounts-payable/debt-offsets/eligible-debts/?company_id={self.company.pk}&partner_id={dual_no_debt.pk}")
        self.assertEqual(err_res2.status_code, 400)
        self.assertIn("Đối tác không có khoản công nợ phải thu chưa thu.", str(err_res2.data))

    def test_cancel_validation_and_idempotency(self):
        """AF-AP-OFFSET-04: Test cancellation reason validation and prevent duplicate cancel."""
        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 201)
        voucher_id = res.data["id"]
        cancel_url = f"/api/v1/accounts-payable/debt-offsets/{voucher_id}/cancel/?company_id={self.company.pk}"

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

        # 4. Duplicate cancel
        err3 = self.client.post(cancel_url, {"reason": "Hủy lần hai"}, format="json")
        self.assertEqual(err3.status_code, 400)
        self.assertIn("Chứng từ bù trừ đã được hủy trước đó.", str(err3.data))

    def test_eligibility_and_number_never_reused(self):
        partners = self.client.get(self.url.replace("?", "eligible-partners/?"))
        self.assertEqual(partners.status_code, 200, partners.data)
        self.assertEqual(len(partners.data), 1)
        debts = self.client.get(self.url.replace("?", "eligible-debts/?") + f"&partner_id={self.partner.pk}")
        self.assertEqual(debts.status_code, 200, debts.data)
        self.assertEqual((len(debts.data["payables"]), len(debts.data["receivables"])), (1, 1))
        self.assertEqual(debts.data["payables"][0]["currency_code"], "VND")
        self.assertEqual(debts.data["receivables"][0]["currency_code"], "VND")

        first = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.client.post(f"/api/v1/accounts-payable/debt-offsets/{first.data['id']}/cancel/?company_id={self.company.pk}",
                         {"reason": "Retry"}, format="json")
        second = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(second.data["number"], f"BTCN-{self.today.year}-000002")

    def test_multiple_documents_and_full_settlement(self):
        invoice = SupplierInvoice.objects.create(
            company=self.company, supplier=self.partner, supplier_tax_code="0100000006",
            invoice_series="AA", invoice_number="AP06-002", invoice_date=self.today,
            posting_date=self.today, currency=self.currency, created_by=self.user.iam_account,
        )
        second_payable = Payable.objects.create(
            company=self.company, supplier=self.partner, invoice=invoice, currency=self.currency,
            exchange_rate=1, original_amount="20", balance="20", due_date=self.today,
        )
        second_receivable = Receivable.objects.create(
            company=self.company, customer=self.partner, currency=self.currency,
            exchange_rate=1, original_amount="10", balance="10", due_date=self.today,
            posting_date=self.today, source_document_number="AR06-002",
        )
        response = self.client.post(self.url, self.payload(
            payable_lines=[{"payable": str(self.payable.pk), "amount": "100"},
                           {"payable": str(second_payable.pk), "amount": "20"}],
            receivable_lines=[{"receivable": str(self.receivable.pk), "amount": "110"},
                              {"receivable": str(second_receivable.pk), "amount": "10"}],
        ), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["amount"], "120.0000")
        self.payable.refresh_from_db()
        second_payable.refresh_from_db()
        second_receivable.refresh_from_db()
        self.assertEqual(self.payable.status, PayableStatus.PAID)
        self.assertEqual(second_payable.status, PayableStatus.PAID)
        self.assertEqual(second_receivable.status, ReceivableStatus.PAID)

    def test_rbac_permissions_ex01(self):
        """EX-AP-OFFSET-01: Test IAM RBAC permissions on offset endpoints."""
        staff = get_user_model().objects.create_user(username="ap06-staff", email="staff@example.com", password="pass")
        CompanyMembership.objects.create(company=self.company, user=staff.iam_account, created_by=self.user.iam_account, membership_status="ACTIVE")

        staff_client = APIClient()
        staff_client.force_authenticate(staff)

        # 1. Without permission, cannot view list
        list_res = staff_client.get(self.url)
        self.assertEqual(list_res.status_code, 403)
        self.assertIn("Bạn không có quyền xem chứng từ bù trừ công nợ.", str(list_res.data))

        # 2. Without permission, cannot create
        create_res = staff_client.post(self.url, self.payload(), format="json")
        self.assertEqual(create_res.status_code, 403)
        self.assertIn("Bạn không có quyền thực hiện bù trừ công nợ.", str(create_res.data))

        # 3. Grant AP.OFFSET.VIEW and AP.OFFSET.CREATE
        role = Role.objects.create(company=self.company, code="OFFSET_ROLE", name="Offset Role")
        perm_view = Permission.objects.filter(code="AP.OFFSET.VIEW").first()
        perm_create = Permission.objects.filter(code="AP.OFFSET.CREATE").first()
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

        # Cancel without AP.OFFSET.CANCEL fails
        cancel_url = f"/api/v1/accounts-payable/debt-offsets/{ok_create.data['id']}/cancel/?company_id={self.company.pk}"
        cancel_res = staff_client.post(cancel_url, {"reason": "Hủy"}, format="json")
        self.assertEqual(cancel_res.status_code, 403)
        self.assertIn("Bạn không có quyền hủy chứng từ bù trừ công nợ.", str(cancel_res.data))
