from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from general_ledger.models import JournalEntry
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Party
from organization.models import Company
from .models import (
    DocumentStatus, Payable, PayableAdjustment, Payment, PaymentMethod,
    PaymentStatus, SupplierInvoice, SupplierReconciliation,
)


class SupplierReconciliationUcAp08Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="AP08", name="AP08", legal_name="AP08", tax_code="0100000008",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.user = get_user_model().objects.create_superuser(
            username="ap08-user", email="ap08@example.com", password="test")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.supplier = Party.objects.create(company=self.company, code="NCC08", name="Supplier")
        self.invoice = SupplierInvoice.objects.create(
            company=self.company, supplier=self.supplier, supplier_tax_code="0100000008",
            invoice_series="AA", invoice_number="AP08-001",
            invoice_date=self.today - timedelta(days=2), posting_date=self.today - timedelta(days=2),
            currency=self.currency, created_by=self.user.iam_account, status=DocumentStatus.POSTED,
        )
        self.payable = Payable.objects.create(
            company=self.company, supplier=self.supplier, invoice=self.invoice, currency=self.currency,
            exchange_rate=1, original_amount="100", balance="60", paid_amount="40", due_date=self.today,
        )
        self.payment = Payment.objects.create(
            company=self.company, supplier=self.supplier, currency=self.currency,
            payment_date=self.today, amount="40", allocated_amount="40",
            status=PaymentStatus.POSTED, external_type=PaymentMethod.OTHER,
            created_by=self.user.iam_account, number="PAY-08",
        )

    @property
    def url(self):
        return f"/api/v1/accounts-payable/supplier-reconciliations/?company_id={self.company.pk}"

    def params(self, **changes):
        data = {"company": str(self.company.pk), "company_id": str(self.company.pk),
                "supplier": str(self.supplier.pk),
                "currency": str(self.currency.pk),
                "period_start": str(self.today - timedelta(days=1)), "period_end": str(self.today)}
        data.update(changes)
        return data

    def preview(self, **changes):
        return self.client.get(self.url.replace("?", "preview/?"), self.params(**changes))

    def create(self, **changes):
        preview = self.preview()
        self.assertEqual(preview.status_code, 200, preview.data)
        return self.client.post(self.url, self.params(snapshot_token=preview.data["snapshot_token"], **changes), format="json")

    def test_preview_snapshot_pdf_and_matching_confirmation(self):
        """Full lifecycle: preview, create DCNCC voucher, render PDF, confirm MATCHED."""
        preview = self.preview()
        self.assertEqual(preview.status_code, 200, preview.data)
        snapshot = preview.data["snapshot"]
        self.assertEqual(Decimal(snapshot["opening_balance"]), Decimal("100"))
        self.assertEqual(Decimal(snapshot["period_increase"]), Decimal("0"))
        self.assertEqual(Decimal(snapshot["period_decrease"]), Decimal("40"))
        self.assertEqual(Decimal(snapshot["closing_balance"]), Decimal("60"))
        self.assertEqual(len(snapshot["transactions"]), 1)
        self.assertIn("supplier", snapshot)
        self.assertEqual(snapshot["supplier"]["code"], "NCC08")

        before_journals = JournalEntry.objects.count()
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["number"], f"DCNCC-{self.today.year}-000001")
        self.assertEqual(response.data["status"], "PENDING")
        self.assertIn("Lập biên bản đối chiếu công nợ thành công", response.data["message"])

        # Test PDF rendering (Bước 21)
        pdf = self.client.get(f"/api/v1/accounts-payable/supplier-reconciliations/{response.data['id']}/pdf/?company_id={self.company.pk}")
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        self.assertGreater(len(pdf.content), 1000)

        # Confirm matching result (difference = 0)
        completed = self.client.post(
            f"/api/v1/accounts-payable/supplier-reconciliations/{response.data['id']}/complete/?company_id={self.company.pk}",
            {"confirmation_date": str(self.today), "confirmed_by_name": "Supplier CFO",
             "supplier_balance": "60", "confirmation_attachments": [{"name": "signed.pdf", "size": 1000}]},
            format="json",
        )
        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertEqual(completed.data["status"], "MATCHED")
        self.assertEqual(Decimal(completed.data["difference"]), Decimal("0"))
        self.assertIn("Hoàn thành đối chiếu công nợ. Kết quả: Khớp.", completed.data["message"])

        # Non-monetary check (BR-AP-REC-16): no journal entries created, payable balance unchanged
        self.payable.refresh_from_db()
        self.assertEqual(self.payable.balance, Decimal("60"))
        self.assertEqual(JournalEntry.objects.count(), before_journals)

    def test_difference_requires_reason_and_resolution(self):
        """AF-AP-REC-02: Supplier confirms difference != 0, requiring reason and resolution."""
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        complete_url = f"/api/v1/accounts-payable/supplier-reconciliations/{response.data['id']}/complete/?company_id={self.company.pk}"

        payload = {"confirmation_date": str(self.today), "confirmed_by_name": "Supplier CFO",
                   "supplier_balance": "-5", "confirmation_attachments": [{"name": "signed.png", "size": 1000}]}

        # Missing reason (EX-16)
        err1 = self.client.post(complete_url, payload, format="json")
        self.assertEqual(err1.status_code, 400)
        self.assertIn("Vui lòng nhập Nguyên nhân chênh lệch.", str(err1.data))

        # Missing resolution (EX-17)
        payload["difference_reason"] = "Sai hóa đơn"
        err2 = self.client.post(complete_url, payload, format="json")
        self.assertEqual(err2.status_code, 400)
        self.assertIn("Vui lòng nhập Hướng xử lý chênh lệch.", str(err2.data))

        # Complete with both fields
        payload["resolution"] = "Kiểm tra và lập chứng từ điều chỉnh"
        completed = self.client.post(complete_url, payload, format="json")
        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertEqual(completed.data["status"], "DIFFERENT")
        self.assertEqual(Decimal(completed.data["difference"]), Decimal("-65"))
        self.assertIn("Hoàn thành đối chiếu công nợ. Kết quả: Có chênh lệch.", completed.data["message"])

        # Cannot complete again
        self.assertEqual(self.client.post(complete_url, payload, format="json").status_code, 400)

    def test_stale_preview_rejected_and_cancel_only_pending(self):
        """AF-AP-REC-03, AF-AP-REC-04 & BR-AP-REC-11: Detect stale data, cancel pending, sequence not reused."""
        preview = self.preview()
        self.payment.amount = Decimal("41")
        self.payment.save(update_fields=("amount", "updated_at"))

        # Stale token rejected (EX-09)
        stale = self.client.post(self.url, self.params(snapshot_token=preview.data["snapshot_token"]), format="json")
        self.assertEqual(stale.status_code, 400, stale.data)
        self.assertIn("Dữ liệu công nợ đã thay đổi. Vui lòng chọn Lấy dữ liệu trước khi lập biên bản.", str(stale.data))
        self.assertFalse(SupplierReconciliation.objects.exists())

        # Create valid record
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        cancel_url = f"/api/v1/accounts-payable/supplier-reconciliations/{response.data['id']}/cancel/?company_id={self.company.pk}"

        # Cancel without reason
        self.assertEqual(self.client.post(cancel_url, {"reason": ""}, format="json").status_code, 400)

        # Cancel successfully
        cancel_ok = self.client.post(cancel_url, {"reason": "Sai kỳ"}, format="json")
        self.assertEqual(cancel_ok.status_code, 200)
        self.assertIn("Hủy biên bản đối chiếu công nợ thành công", cancel_ok.data["message"])

        # Duplicate cancel rejected
        self.assertEqual(self.client.post(cancel_url, {"reason": "Again"}, format="json").status_code, 400)

        # Number not reused
        new_record = self.create()
        self.assertEqual(new_record.status_code, 201, new_record.data)
        self.assertEqual(new_record.data["number"], f"DCNCC-{self.today.year}-000002")

    def test_zero_activity_and_advance_balance(self):
        """AF-AP-REC-01 & BR-AP-REC-07: Negative opening balance (advance payment) and zero transactions."""
        self.payment.payment_date = self.today - timedelta(days=2)
        self.payment.amount = Decimal("120")
        self.payment.save(update_fields=("payment_date", "amount", "updated_at"))
        preview = self.preview(period_start=str(self.today - timedelta(days=1)))
        self.assertEqual(preview.status_code, 200, preview.data)
        snapshot = preview.data["snapshot"]
        self.assertEqual(Decimal(snapshot["opening_balance"]), Decimal("-20"))
        self.assertEqual(Decimal(snapshot["period_increase"]), Decimal("0"))
        self.assertEqual(Decimal(snapshot["period_decrease"]), Decimal("0"))
        self.assertEqual(snapshot["transactions"], [])

    def test_posted_adjustment_and_validation(self):
        """Adjustment movements are included in preview calculations."""
        PayableAdjustment.objects.create(
            company=self.company, payable=self.payable, adjustment_date=self.today,
            amount=Decimal("-10"), reason="Giảm giá", status="POSTED",
            created_by=self.user.iam_account,
        )
        preview = self.preview()
        self.assertEqual(Decimal(preview.data["snapshot"]["period_decrease"]), Decimal("50"))
        self.assertEqual(Decimal(preview.data["snapshot"]["closing_balance"]), Decimal("50"))

    def test_all_validation_exceptions_ex02_to_ex18(self):
        """Verify exact Vietnamese error messages for EX-AP-REC-02 to EX-AP-REC-18."""
        # EX-02: Chưa chọn Nhà cung cấp
        res = self.client.get(self.url.replace("?", "preview/?"), self.params(supplier=""))
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng chọn Nhà cung cấp.", str(res.data))

        # EX-03: Chưa chọn Loại tiền
        res = self.client.get(self.url.replace("?", "preview/?"), self.params(currency=""))
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng chọn Loại tiền đối chiếu.", str(res.data))

        # EX-04: Chưa nhập Ngày bắt đầu
        res = self.client.get(self.url.replace("?", "preview/?"), self.params(period_start=""))
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Ngày bắt đầu kỳ đối chiếu.", str(res.data))

        # EX-05: Chưa nhập Ngày kết thúc
        res = self.client.get(self.url.replace("?", "preview/?"), self.params(period_end=""))
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Ngày kết thúc kỳ đối chiếu.", str(res.data))

        # EX-06: Ngày bắt đầu > Ngày kết thúc
        res = self.client.get(self.url.replace("?", "preview/?"), self.params(period_start=str(self.today), period_end=str(self.today - timedelta(days=1))))
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ngày bắt đầu kỳ đối chiếu không được lớn hơn Ngày kết thúc kỳ đối chiếu.", str(res.data))

        # EX-07: Ngày kết thúc > Hiện tại
        res = self.client.get(self.url.replace("?", "preview/?"), self.params(period_end=str(self.today + timedelta(days=1))))
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ngày kết thúc kỳ đối chiếu không được lớn hơn ngày hiện tại.", str(res.data))

        # EX-08: Nội dung đối chiếu trống
        preview = self.preview()
        res = self.client.post(self.url, self.params(snapshot_token=preview.data["snapshot_token"], content=""), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Nội dung đối chiếu.", str(res.data))

        # Create record for completion validations
        record_res = self.create()
        rec_id = record_res.data["id"]
        complete_url = f"/api/v1/accounts-payable/supplier-reconciliations/{rec_id}/complete/?company_id={self.company.pk}"

        # EX-10: Chưa nhập Ngày xác nhận
        res = self.client.post(complete_url, {"confirmation_date": ""}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Ngày xác nhận.", str(res.data))

        # EX-14: Ngày xác nhận nhỏ hơn Ngày kết thúc kỳ
        res = self.client.post(complete_url, {"confirmation_date": str(self.today - timedelta(days=5))}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ngày xác nhận không được nhỏ hơn Ngày kết thúc kỳ đối chiếu.", str(res.data))

        # EX-15: Ngày xác nhận lớn hơn ngày hiện tại
        res = self.client.post(complete_url, {"confirmation_date": str(self.today + timedelta(days=1))}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ngày xác nhận không được lớn hơn ngày hiện tại.", str(res.data))

        # EX-11: Chưa nhập Người xác nhận
        res = self.client.post(complete_url, {"confirmation_date": str(self.today), "confirmed_by_name": ""}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Người xác nhận phía nhà cung cấp.", str(res.data))

        # EX-12: Chưa nhập Số dư xác nhận
        res = self.client.post(complete_url, {"confirmation_date": str(self.today), "confirmed_by_name": "Mr X", "supplier_balance": ""}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập Số dư nhà cung cấp xác nhận.", str(res.data))

        # EX-13: Chưa đính kèm tài liệu
        res = self.client.post(complete_url, {"confirmation_date": str(self.today), "confirmed_by_name": "Mr X", "supplier_balance": "60", "confirmation_attachments": []}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng đính kèm tài liệu xác nhận của nhà cung cấp.", str(res.data))

        # EX-18: Tệp không hợp lệ
        res = self.client.post(complete_url, {"confirmation_date": str(self.today), "confirmed_by_name": "Mr X", "supplier_balance": "60",
                                              "confirmation_attachments": [{"name": "bad.exe", "size": 100}]}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Tệp bad.exe không đúng định dạng hoặc vượt quá dung lượng 10 MB.", str(res.data))

    def test_saved_snapshot_does_not_follow_later_payment_change(self):
        """BR-AP-REC-15: Snapshot remains immutable even when underlying payments change."""
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        self.payment.amount = Decimal("50")
        self.payment.save(update_fields=("amount", "updated_at"))
        detail = self.client.get(
            f"/api/v1/accounts-payable/supplier-reconciliations/{response.data['id']}/?company_id={self.company.pk}"
        )
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(Decimal(detail.data["closing_balance"]), Decimal("60"))
        self.assertEqual(Decimal(detail.data["snapshot"]["transactions"][0]["decrease"]), Decimal("40"))
        current = self.preview()
        self.assertEqual(Decimal(current.data["snapshot"]["closing_balance"]), Decimal("50"))

    def test_rbac_permissions_ex01(self):
        """EX-AP-REC-01: Test IAM RBAC permissions on reconciliation endpoints."""
        staff = get_user_model().objects.create_user(username="ap08-staff", email="staff08@example.com", password="pass")
        CompanyMembership.objects.create(
            company=self.company, user=staff.iam_account, created_by=self.user.iam_account, membership_status="ACTIVE")

        staff_client = APIClient()
        staff_client.force_authenticate(staff)

        # 1. Without permission, cannot view list
        list_res = staff_client.get(self.url)
        self.assertEqual(list_res.status_code, 403)
        self.assertIn("Bạn không có quyền xem đối chiếu công nợ nhà cung cấp.", str(list_res.data))

        # 2. Without permission, cannot create (EX-01)
        create_res = staff_client.post(self.url, self.params(snapshot_token="any"), format="json")
        self.assertEqual(create_res.status_code, 403)
        self.assertIn("Bạn không có quyền thực hiện đối chiếu công nợ nhà cung cấp.", str(create_res.data))

        # 3. Grant AP.RECONCILIATION.VIEW and AP.RECONCILIATION.CREATE
        role = Role.objects.create(company=self.company, code="REC_ROLE", name="Reconciliation Role")
        perm_view = Permission.objects.filter(code="AP.RECONCILIATION.VIEW").first()
        perm_create = Permission.objects.filter(code="AP.RECONCILIATION.CREATE").first()
        perm_confirm = Permission.objects.filter(code="AP.RECONCILIATION.CONFIRM").first()
        if perm_view:
            RolePermission.objects.create(role=role, permission=perm_view)
        if perm_create:
            RolePermission.objects.create(role=role, permission=perm_create)
        membership = CompanyMembership.objects.get(company=self.company, user=staff.iam_account)
        UserRoleAssignment.objects.create(company_membership=membership, role=role, assigned_by=self.user.iam_account)

        # Now view and create should succeed
        ok_preview = staff_client.get(self.url.replace("?", "preview/?"), self.params())
        self.assertEqual(ok_preview.status_code, 200)

        ok_create = staff_client.post(self.url, self.params(snapshot_token=ok_preview.data["snapshot_token"]), format="json")
        self.assertEqual(ok_create.status_code, 201)

        # Cancel without AP.RECONCILIATION.CANCEL fails
        cancel_url = f"/api/v1/accounts-payable/supplier-reconciliations/{ok_create.data['id']}/cancel/?company_id={self.company.pk}"
        cancel_res = staff_client.post(cancel_url, {"reason": "Hủy"}, format="json")
        self.assertEqual(cancel_res.status_code, 403)
        self.assertIn("Bạn không có quyền hủy đối chiếu công nợ nhà cung cấp.", str(cancel_res.data))

        # Complete without AP.RECONCILIATION.CONFIRM fails
        complete_url = f"/api/v1/accounts-payable/supplier-reconciliations/{ok_create.data['id']}/complete/?company_id={self.company.pk}"
        complete_res = staff_client.post(complete_url, {"confirmation_date": str(self.today), "confirmed_by_name": "Supplier",
                                                        "supplier_balance": "60", "confirmation_attachments": [{"name": "file.pdf", "size": 100}]}, format="json")
        self.assertEqual(complete_res.status_code, 403)
        self.assertIn("Bạn không có quyền ghi nhận xác nhận đối chiếu công nợ.", str(complete_res.data))
