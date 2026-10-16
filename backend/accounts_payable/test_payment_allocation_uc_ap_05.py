from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import AccountingPeriod, JournalEntry
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Party
from organization.models import Company
from .allocation_services import _payable_number
from .models import (
    AllocationStatus, Payable, PayableStatus, Payment, PaymentAllocationVoucher,
    PaymentMethod, PaymentStatus, SupplierInvoice,
)


class PaymentAllocationUcAp05Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="AP05", name="AP05", legal_name="AP05", tax_code="0100000005",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.supplier = Party.objects.create(company=self.company, code="NCC05", name="Supplier")
        self.other_supplier = Party.objects.create(company=self.company, code="NCC06", name="Other")
        self.other_currency, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "US Dollar", "decimal_places": 2})
        self.user = get_user_model().objects.create_superuser(
            username="ap05-user", email="ap05@example.com", password="test")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.period = AccountingPeriod.objects.create(
            company=self.company, code="AP05-OPEN", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1),
            end_date=self.today + timedelta(days=28), status="OPEN",
        )
        self.payment = Payment.objects.create(
            company=self.company, supplier=self.supplier, currency=self.currency,
            payment_date=self.today - timedelta(days=5), amount=Decimal("100"),
            status=PaymentStatus.POSTED, external_type=PaymentMethod.OTHER,
            created_by=self.user.iam_account, number="PAY-05",
        )
        self.p1 = self.make_payable("001", "70", self.today - timedelta(days=2), self.today - timedelta(days=1))
        self.p2 = self.make_payable("002", "80", self.today - timedelta(days=1), self.today + timedelta(days=10))

    def make_payable(self, number, amount, posting_date, due_date, supplier=None, currency=None):
        supplier = supplier or self.supplier
        currency = currency or self.currency
        invoice = SupplierInvoice.objects.create(
            company=self.company, supplier=supplier, supplier_tax_code="0101234567",
            invoice_series="AA", invoice_number=number, invoice_date=posting_date,
            posting_date=posting_date, currency=currency, created_by=self.user.iam_account,
        )
        return Payable.objects.create(
            company=self.company, supplier=supplier, invoice=invoice, currency=currency,
            exchange_rate=1, original_amount=amount, balance=amount, due_date=due_date,
        )

    @property
    def url(self):
        return f"/api/v1/accounts-payable/payment-allocations/?company_id={self.company.pk}"

    def payload(self, **changes):
        data = {
            "company": str(self.company.pk), "supplier": str(self.supplier.pk),
            "payment": str(self.payment.pk), "allocation_date": str(self.today),
            "expected_unallocated_amount": "100",
            "lines": [{"payable": str(self.p1.pk), "amount": "30", "expected_balance": "70"}],
        }
        data.update(changes)
        return data

    def test_manual_allocation_and_reversal_do_not_create_journal(self):
        before_journals = JournalEntry.objects.count()
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["number"], f"PBTT-{self.today.year}-000001")
        self.assertEqual(response.data["total_amount"], "30.0000")
        self.assertIn("Phân bổ thanh toán thành công", response.data["message"])
        self.payment.refresh_from_db()
        self.p1.refresh_from_db()
        self.assertEqual(self.payment.allocated_amount, Decimal("30"))
        self.assertEqual(self.p1.balance, Decimal("40"))
        self.assertEqual(self.p1.status, PayableStatus.PARTIALLY_PAID)
        self.assertEqual(JournalEntry.objects.count(), before_journals)
        self.assertEqual(AuditLog.objects.filter(company=self.company, action_code="ALLOCATE").count(), 1)

        reversed_response = self.client.post(
            f"/api/v1/accounts-payable/payment-allocations/{response.data['id']}/reverse/?company_id={self.company.pk}",
            {"reason": "Nhầm công nợ"}, format="json",
        )
        self.assertEqual(reversed_response.status_code, 200, reversed_response.data)
        self.payment.refresh_from_db()
        self.p1.refresh_from_db()
        self.assertEqual(self.payment.allocated_amount, Decimal("0"))
        self.assertEqual(self.p1.balance, Decimal("70"))
        self.assertEqual(self.p1.status, PayableStatus.OPEN)
        self.assertEqual(JournalEntry.objects.count(), before_journals)
        self.assertEqual(PaymentAllocationVoucher.objects.get(pk=response.data["id"]).status, AllocationStatus.REVERSED)

    def test_auto_allocation_order_and_number_not_reused(self):
        data = self.payload(mode="AUTO", lines=[{"payable": str(self.p2.pk)}, {"payable": str(self.p1.pk)}])
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([(str(line["payable"]), line["amount"]) for line in response.data["lines"]],
                         [(str(self.p1.pk), "70.0000"), (str(self.p2.pk), "30.0000")])
        self.client.post(
            f"/api/v1/accounts-payable/payment-allocations/{response.data['id']}/reverse/?company_id={self.company.pk}",
            {"reason": "Retry"}, format="json",
        )
        second = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(second.data["number"], f"PBTT-{self.today.year}-000002")

    def test_auto_suggest_api_5_tier_sorting(self):
        """AF-AP-ALLOC-01 & BR-AP-ALLOC-09: Test auto-suggest endpoint and 5-tier sorting."""
        p_overdue = self.make_payable("OD1", "30", self.today - timedelta(days=10), self.today - timedelta(days=3))
        p_due_soon = self.make_payable("DS1", "40", self.today - timedelta(days=4), self.today + timedelta(days=2))
        p_due_late = self.make_payable("DL1", "50", self.today - timedelta(days=2), self.today + timedelta(days=15))
        p_no_due = self.make_payable("ND1", "20", self.today - timedelta(days=3), None)

        suggest_url = f"/api/v1/accounts-payable/payment-allocations/auto-suggest/?company_id={self.company.pk}"
        res = self.client.post(suggest_url, {
            "payment": str(self.payment.pk),
            "allocation_date": str(self.today),
            "payable_ids": [str(p_no_due.pk), str(p_due_late.pk), str(p_overdue.pk), str(p_due_soon.pk)],
        }, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["unallocated_amount"], 100.0)
        self.assertEqual(res.data["total_allocated"], 100.0)
        self.assertEqual(res.data["remaining_unallocated"], 0.0)

        lines = res.data["lines"]
        self.assertEqual(len(lines), 4)
        # Order must be: 1. Overdue (p_overdue: 30) -> 2. Due soon (p_due_soon: 40) -> 3. Due late (p_due_late: 30 out of 50) -> 4. No due (p_no_due: 0 out of 20)
        self.assertEqual(lines[0]["payable_id"], str(p_overdue.pk))
        self.assertEqual(lines[0]["suggested_amount"], 30.0)
        self.assertEqual(lines[0]["remaining_balance"], 0.0)

        self.assertEqual(lines[1]["payable_id"], str(p_due_soon.pk))
        self.assertEqual(lines[1]["suggested_amount"], 40.0)
        self.assertEqual(lines[1]["remaining_balance"], 0.0)

        self.assertEqual(lines[2]["payable_id"], str(p_due_late.pk))
        self.assertEqual(lines[2]["suggested_amount"], 30.0)
        self.assertEqual(lines[2]["remaining_balance"], 20.0)

        self.assertEqual(lines[3]["payable_id"], str(p_no_due.pk))
        self.assertEqual(lines[3]["suggested_amount"], 0.0)
        self.assertEqual(lines[3]["remaining_balance"], 20.0)

    def test_auto_allocation_execution_with_5_tiers(self):
        """BR-AP-ALLOC-09: Verify POST allocation in AUTO mode applies the 5-tier priority ordering."""
        p_overdue = self.make_payable("OD2", "40", self.today - timedelta(days=10), self.today - timedelta(days=2))
        p_due_soon = self.make_payable("DS2", "50", self.today - timedelta(days=4), self.today + timedelta(days=3))
        p_no_due = self.make_payable("ND2", "30", self.today - timedelta(days=3), None)

        data = self.payload(
            mode="AUTO",
            lines=[{"payable": str(p_no_due.pk)}, {"payable": str(p_due_soon.pk)}, {"payable": str(p_overdue.pk)}],
        )
        res = self.client.post(self.url, data, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        # Total unallocated = 100. Overdue takes 40, Due soon takes 50, No due takes remaining 10.
        allocated_lines = [(str(line["payable"]), line["amount"]) for line in res.data["lines"]]
        self.assertEqual(allocated_lines, [
            (str(p_overdue.pk), "40.0000"),
            (str(p_due_soon.pk), "50.0000"),
            (str(p_no_due.pk), "10.0000"),
        ])

    def test_validation_exception_messages_ex03_to_ex22(self):
        """Test exact exception flow validation codes and messages from EX-03 to EX-22."""
        other_party_payable = self.make_payable("OPP", "20", self.today, self.today, self.other_supplier)
        diff_currency_payable = self.make_payable("DCP", "20", self.today, self.today, supplier=self.supplier, currency=self.other_currency)

        cases = [
            # EX-03: Chưa chọn Nhà cung cấp
            ({"supplier": ""}, "Vui lòng chọn Nhà cung cấp."),
            # EX-05: Chưa chọn Chứng từ thanh toán
            ({"payment": ""}, "Vui lòng chọn Chứng từ thanh toán."),
            # EX-07: Chưa nhập Ngày phân bổ
            ({"allocation_date": ""}, "Vui lòng nhập Ngày phân bổ."),
            # EX-08: Diễn giải để trống
            ({"description": "   "}, "Vui lòng nhập Diễn giải."),
            # EX-09: Diễn giải vượt 500 ký tự
            ({"description": "D" * 501}, "Diễn giải không được vượt quá 500 ký tự."),
            # EX-10: Chưa chọn công nợ
            ({"lines": []}, "Vui lòng chọn ít nhất một khoản công nợ cần phân bổ."),
            # EX-11: Không có dòng nào có tiền lớn hơn 0
            ({"lines": [{"payable": str(self.p1.pk), "amount": "0"}]}, "Vui lòng nhập số tiền phân bổ lớn hơn 0 cho ít nhất một khoản công nợ."),
            # EX-12: Ngày phân bổ nhỏ hơn Ngày thanh toán (payment_date is today - 5)
            ({"allocation_date": str(self.today - timedelta(days=6))}, "Ngày phân bổ không được nhỏ hơn Ngày thanh toán."),
            # EX-13: Ngày phân bổ nhỏ hơn ngày hạch toán công nợ (p1 posting_date is today - 2)
            ({"allocation_date": str(self.today - timedelta(days=3))}, f"Ngày phân bổ không được nhỏ hơn ngày hạch toán của chứng từ {_payable_number(self.p1)}."),
            # EX-14: Ngày phân bổ lớn hơn ngày hiện tại
            ({"allocation_date": str(self.today + timedelta(days=1))}, "Ngày phân bổ không được lớn hơn ngày hiện tại."),
            # EX-16: Khác nhà cung cấp
            ({"lines": [{"payable": str(other_party_payable.pk), "amount": "10"}]}, "Chứng từ thanh toán và công nợ phải thuộc cùng một nhà cung cấp."),
            # EX-17: Khác loại tiền
            ({"lines": [{"payable": str(diff_currency_payable.pk), "amount": "10"}]}, "Chứng từ thanh toán và công nợ phải sử dụng cùng loại tiền."),
            # EX-18: Số tiền chưa phân bổ đã thay đổi
            ({"expected_unallocated_amount": "99"}, "Số tiền chưa phân bổ đã thay đổi. Vui lòng tải lại dữ liệu."),
            # EX-19: Công nợ đã thay đổi
            ({"lines": [{"payable": str(self.p1.pk), "amount": "10", "expected_balance": "65"}]}, f"Số tiền còn phải trả của chứng từ {_payable_number(self.p1)} đã thay đổi. Vui lòng tải lại dữ liệu."),
            # EX-20: Tổng tiền phân bổ vượt số tiền nguồn (remaining is 100)
            ({"lines": [{"payable": str(self.p1.pk), "amount": "60"}, {"payable": str(self.p2.pk), "amount": "50"}]}, "Tổng tiền phân bổ không được vượt quá số tiền chưa phân bổ là 100."),
            # EX-21: Một dòng có số tiền nhỏ hơn hoặc bằng 0
            ({"lines": [{"payable": str(self.p1.pk), "amount": "10"}, {"payable": str(self.p2.pk), "amount": "-5"}]}, f"Số tiền phân bổ cho chứng từ {_payable_number(self.p2)} phải lớn hơn 0."),
            # EX-22: Một dòng vượt số tiền còn phải trả (p1 balance is 70)
            ({"lines": [{"payable": str(self.p1.pk), "amount": "75"}]}, f"Số tiền phân bổ cho chứng từ {_payable_number(self.p1)} không được vượt quá số tiền còn phải trả là 70."),
        ]

        for payload_changes, expected_msg in cases:
            res = self.client.post(self.url, self.payload(**payload_changes), format="json")
            self.assertEqual(res.status_code, 400, f"Payload {payload_changes} did not return 400: {res.data}")
            self.assertIn(expected_msg, str(res.data), f"Expected '{expected_msg}' in {res.data}")

    def test_reversal_validations_and_idempotency(self):
        """AF-AP-ALLOC-04: Validate reversal reason requirement and prevent duplicate reversal."""
        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 201)
        voucher_id = res.data["id"]
        rev_url = f"/api/v1/accounts-payable/payment-allocations/{voucher_id}/reverse/?company_id={self.company.pk}"

        # 1. Missing reason
        err1 = self.client.post(rev_url, {"reason": ""}, format="json")
        self.assertEqual(err1.status_code, 400)
        self.assertIn("Vui lòng nhập Lý do đảo phân bổ.", str(err1.data))

        # 2. Successful reversal
        ok_res = self.client.post(rev_url, {"reason": "Huỷ theo yêu cầu"}, format="json")
        self.assertEqual(ok_res.status_code, 200)

        # 3. Duplicate reversal rejected
        err2 = self.client.post(rev_url, {"reason": "Đảo lại lần nữa"}, format="json")
        self.assertEqual(err2.status_code, 400)
        self.assertIn("Phiếu phân bổ đã được đảo trước đó.", str(err2.data))

    def test_eligibility_and_closed_period(self):
        payments = self.client.get(f"{self.url.replace('?', 'eligible-payments/?')}&supplier_id={self.supplier.pk}")
        self.assertEqual(payments.status_code, 200, payments.data)
        self.assertEqual(len(payments.data), 1)
        self.assertEqual(payments.data[0]["allocation_status"], "UNALLOCATED")
        self.assertEqual(payments.data[0]["currency_code"], "VND")

        payables = self.client.get(f"{self.url.replace('?', 'eligible-payables/?')}&payment_id={self.payment.pk}")
        self.assertEqual(payables.status_code, 200, payables.data)
        self.assertEqual(len(payables.data), 2)
        self.assertEqual(payables.data[0]["currency_code"], "VND")
        self.assertIn("invoice_number", payables.data[0])

        # EX-15: Closed accounting period
        self.period.status = "CLOSED"
        self.period.save(update_fields=("status",))
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("Kỳ kế toán của ngày phân bổ đã bị khóa.", str(response.data))

    def test_full_allocation_excludes_payment_and_cannot_reverse_twice(self):
        response = self.client.post(self.url, self.payload(
            lines=[{"payable": str(self.p1.pk), "amount": "70"},
                   {"payable": str(self.p2.pk), "amount": "30"}],
        ), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        # BR-AP-ALLOC-19: Fully allocated payment must not appear in eligible payments
        payments = self.client.get(f"{self.url.replace('?', 'eligible-payments/?')}&supplier_id={self.supplier.pk}")
        self.assertEqual(payments.data, [])
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.status, PayableStatus.PAID)

    def test_cancel_source_requires_reversal_first(self):
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        cancel = self.client.post(
            f"/api/v1/accounts-payable/payments/{self.payment.pk}/cancel/?company_id={self.company.pk}",
            {"reason": "Mistake"}, format="json",
        )
        self.assertEqual(cancel.status_code, 400, cancel.data)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentStatus.POSTED)

    def test_rbac_permissions_ex01_ex02(self):
        """EX-AP-ALLOC-01 & EX-AP-ALLOC-02: Test IAM RBAC permissions on allocation endpoints."""
        staff = get_user_model().objects.create_user(username="ap05-staff", email="staff@example.com", password="pass")
        CompanyMembership.objects.create(company=self.company, user=staff.iam_account, created_by=self.user.iam_account, membership_status="ACTIVE")

        staff_client = APIClient()
        staff_client.force_authenticate(staff)

        # 1. Without permission, cannot view list
        list_res = staff_client.get(self.url)
        self.assertEqual(list_res.status_code, 403)
        self.assertIn("Bạn không có quyền xem phân bổ thanh toán.", str(list_res.data))

        # 2. Without permission, cannot create
        create_res = staff_client.post(self.url, self.payload(), format="json")
        self.assertEqual(create_res.status_code, 403)
        self.assertIn("Bạn không có quyền thực hiện phân bổ thanh toán.", str(create_res.data))

        # 3. Without permission, cannot auto-suggest
        suggest_res = staff_client.post(
            f"/api/v1/accounts-payable/payment-allocations/auto-suggest/?company_id={self.company.pk}",
            {"payment": str(self.payment.pk)}, format="json"
        )
        self.assertEqual(suggest_res.status_code, 403)
        self.assertIn("Bạn không có quyền thực hiện phân bổ thanh toán.", str(suggest_res.data))

        # 4. Grant AP.ALLOCATION.VIEW and AP.ALLOCATION.CREATE
        role = Role.objects.create(company=self.company, code="ALLOC_ROLE", name="Alloc Role")
        perm_view = Permission.objects.filter(code="AP.ALLOCATION.VIEW").first()
        perm_create = Permission.objects.filter(code="AP.ALLOCATION.CREATE").first()
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
