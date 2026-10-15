import calendar
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from common_services.models import FiscalPeriod, FiscalPeriodStatus, FiscalYear, FiscalYearStatus
from general_ledger.models import (
    Account, AccountNature, AccountStatus, AccountingPeriod,
    ChartOfAccounts, JournalEntry, NormalBalance,
)
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Party, PartyRole, PaymentTerm, TaxRate
from organization.models import Branch, Company
from accounts_payable.models import (
    DocumentStatus, Payable, PayableDocument, PayableDocumentLine,
    PayableStatus, SupplierInvoice, SupplierInvoiceLine
)
from accounts_payable.services import auto_recognize_payable_from_purchase


class PayableRecognitionTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="AP_CO_TEST",
            name="AP Company Test",
            legal_name="AP Company Test Ltd",
            tax_code="0109999111",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="B_HN", name="Chi nhánh Hà Nội")

        # Master data
        self.supplier = Party.objects.create(
            company=self.company,
            code="NCC_TEST_01",
            name="Công ty TNHH Cung Cấp Test",
            tax_code="0107777888",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=self.today)

        self.payment_term = PaymentTerm.objects.create(
            company=self.company,
            code="NET30",
            name="Thanh toán 30 ngày",
            due_days=30,
            scope="PURCHASE",
            due_base="DOCUMENT",
            status="ACTIVE",
        )
        self.supplier.payment_term = self.payment_term
        self.supplier.save(update_fields=("payment_term",))

        self.tax_rate_10 = TaxRate.objects.create(
            company=self.company,
            code="VAT10",
            name="Thuế 10%",
            tax_type="VAT",
            rate_percent=Decimal("10.0000"),
            effective_from=self.today,
            status="ACTIVE",
        )

        # Chart of accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="COA_AP_TEST",
            name="Hệ thống tài khoản AP",
            effective_from=self.today,
            is_default=True,
        )
        self.account_331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            code="331",
            name="Phải trả cho người bán",
            account_type=AccountNature.LIABILITY,
            normal_balance=NormalBalance.CREDIT,
            status=AccountStatus.ACTIVE,
            requires_party=True,
        )
        self.account_642 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            code="642",
            name="Chi phí quản lý doanh nghiệp",
            account_type=AccountNature.EXPENSE,
            normal_balance=NormalBalance.DEBIT,
            status=AccountStatus.ACTIVE,
        )
        self.account_1331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            code="1331",
            name="Thuế GTGT đầu vào được khấu trừ",
            account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT,
            status=AccountStatus.ACTIVE,
        )
        self.account_1111 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            code="1111",
            name="Tiền mặt VND",
            account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT,
            status=AccountStatus.ACTIVE,
            requires_party=False,
        )

        # Users
        self.maker_user = get_user_model().objects.create_superuser(
            username="ap_maker", email="ap_maker@example.com", password="pass"
        )
        self.approver_user = get_user_model().objects.create_superuser(
            username="ap_approver", email="ap_approver@example.com", password="pass"
        )
        self.staff_user = get_user_model().objects.create_user(
            username="ap_staff", email="ap_staff@example.com", password="pass"
        )
        self.staff_account = self.staff_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.staff_account, created_by=self.maker_user.iam_account
        )

        # Fiscal & GL periods
        fy = FiscalYear.objects.create(
            company=self.company,
            code=f"FY_{self.today.year}",
            name=f"Năm {self.today.year}",
            start_date=date(self.today.year, 1, 1),
            end_date=date(self.today.year, 12, 31),
            status=FiscalYearStatus.ACTIVE,
            created_by=self.maker_user.iam_account,
        )
        for m in range(1, 13):
            last_day = calendar.monthrange(self.today.year, m)[1]
            p = FiscalPeriod.objects.create(
                company=self.company,
                fiscal_year=fy,
                code=f"FP_{self.today.year}_{m:02d}",
                name=f"Kỳ {m}",
                period_number=m,
                start_date=date(self.today.year, m, 1),
                end_date=date(self.today.year, m, last_day),
                status=FiscalPeriodStatus.OPEN,
            )
            gl_p = AccountingPeriod.objects.create(
                company=self.company,
                code=f"GL_{self.today.year}_{m:02d}",
                fiscal_year=self.today.year,
                period_number=m,
                start_date=date(self.today.year, m, 1),
                end_date=date(self.today.year, m, last_day),
                status="OPEN",
            )
            if m == self.today.month:
                self.fiscal_period = p
                self.gl_period = gl_p

        self.client = APIClient()
        self.client.force_authenticate(self.maker_user)
        self.query = f"?company_id={self.company.id}"

    def build_document_payload(self, **kwargs):
        payload = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "document_date": str(self.today),
            "posting_date": str(self.today),
            "due_date": str(self.today + timedelta(days=30)),
            "supplier": str(self.supplier.id),
            "payment_term": str(self.payment_term.id),
            "payable_account": str(self.account_331.id),
            "tax_account": str(self.account_1331.id),
            "currency": str(self.currency.id),
            "exchange_rate": "1",
            "source_type": "OTHER",
            "description": "Chi phí thuê văn phòng tháng 10/2026",
            "action": "SAVE_DRAFT",
            "lines": [
                {
                    "line_no": 1,
                    "description": "Tiền thuê văn phòng",
                    "debit_account": str(self.account_642.id),
                    "amount": "10000000.0000",
                    "tax_rate": str(self.tax_rate_10.id),
                    "tax_rate_percent": "10.0000",
                    "tax_amount": "1000000.0000",
                }
            ],
            "attachments": [
                {
                    "file_name": "hop_dong.pdf",
                    "file_size": 1024,
                    "content_type": "application/pdf",
                    "url": "/media/hop_dong.pdf",
                }
            ],
        }
        payload.update(kwargs)
        return payload

    def test_main_flow_step1_to_56_full_lifecycle(self):
        """
        Kiểm thử toàn diện Luồng chính Bước 1 đến 56:
        - Bước 1-4: Xem danh sách
        - Bước 7-8: Lấy số chứng từ dự kiến (preview) không lưu DB (BR-AP-REC-01, 05)
        - Bước 9-11: Tra cứu thông tin NCC và số dư nợ hiện tại
        - Bước 12-27: Nhập liệu và Lưu nháp (AF-06, BR-02, 04, 19, 22, 25)
        - Bước 28-37: Gửi phê duyệt (BR-03, 11)
        - Bước 38-42: Phê duyệt chứng từ (BR-41)
        - Bước 43-55: Ghi sổ (BR-18, 20, 27, 32, 33, 34, 35, 36, 37, 38, 39, 42)
        """
        # 1. Danh sách chứng từ công nợ
        list_res = self.client.get(f"/api/v1/accounts-payable/documents/{self.query}")
        self.assertEqual(list_res.status_code, 200)

        # 2. Preview số chứng từ dự kiến (Bước 7-8)
        prev_res = self.client.get(f"/api/v1/accounts-payable/documents/preview-number/{self.query}")
        self.assertEqual(prev_res.status_code, 200)
        self.assertTrue(prev_res.data["preview_number"].startswith(f"CNPT-{self.today.year}-"))
        # BR-01: Không sinh chứng từ trong CSDL
        self.assertEqual(PayableDocument.objects.count(), 0)

        # 3. Tra cứu NCC (Bước 9-11)
        supp_res = self.client.get(f"/api/v1/accounts-payable/documents/supplier-info/{self.query}&supplier_id={self.supplier.id}")
        self.assertEqual(supp_res.status_code, 200)
        self.assertEqual(supp_res.data["tax_code"], self.supplier.tax_code)
        self.assertEqual(supp_res.data["payment_term_code"], "NET30")
        self.assertEqual(Decimal(supp_res.data["current_balance"]), Decimal("0"))

        # 4. Lưu nháp (AF-06, Bước 12-27)
        payload = self.build_document_payload(action="SAVE_DRAFT")
        create_res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(create_res.status_code, 201, create_res.data)
        doc_id = create_res.data["id"]
        doc_num = create_res.data["number"]
        self.assertEqual(create_res.data["status"], DocumentStatus.DRAFT)
        self.assertEqual(Decimal(create_res.data["subtotal"]), Decimal("10000000"))
        self.assertEqual(Decimal(create_res.data["tax_amount"]), Decimal("1000000"))
        self.assertEqual(Decimal(create_res.data["total_amount"]), Decimal("11000000"))
        # Chưa ghi sổ: chưa có Payable hay Journal
        self.assertEqual(Payable.objects.count(), 0)
        self.assertEqual(JournalEntry.objects.count(), 0)

        # 5. Gửi phê duyệt (Bước 28-37)
        submit_res = self.client.post(f"/api/v1/accounts-payable/documents/{doc_id}/submit/{self.query}", {}, format="json")
        self.assertEqual(submit_res.status_code, 200, submit_res.data)
        self.assertEqual(submit_res.data["status"], DocumentStatus.PENDING_APPROVAL)
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="AP", action_code="SUBMIT").exists())

        # 6. Người duyệt thực hiện Phê duyệt (Bước 38-42)
        self.client.force_authenticate(self.approver_user)
        approve_res = self.client.post(f"/api/v1/accounts-payable/documents/{doc_id}/approve/{self.query}", {"comment": "Đồng ý phê duyệt"}, format="json")
        self.assertEqual(approve_res.status_code, 200, approve_res.data)
        self.assertEqual(approve_res.data["status"], DocumentStatus.APPROVED)
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="AP", action_code="APPROVE").exists())

        # 7. Ghi sổ (Bước 43-55)
        post_res = self.client.post(f"/api/v1/accounts-payable/documents/{doc_id}/post/{self.query}", {"posting_reference": "GL-AUTO-01"}, format="json")
        self.assertEqual(post_res.status_code, 200, post_res.data)
        self.assertEqual(post_res.data["status"], DocumentStatus.POSTED)

        # Kiểm tra hạch toán Sổ cái GL (BR-32, 33, 37)
        doc = PayableDocument.objects.get(pk=doc_id)
        self.assertIsNotNone(doc.journal_entry)
        je = doc.journal_entry
        self.assertEqual(je.status, "POSTED")
        self.assertEqual(je.total_debit, Decimal("11000000"))
        self.assertEqual(je.total_credit, Decimal("11000000"))

        # Bút toán cân bằng: Nợ 642: 10,000,000; Nợ 1331: 1,000,000; Có 331: 11,000,000
        lines = list(je.lines.all().order_by("line_no"))
        self.assertEqual(len(lines), 3)
        self.assertEqual(lines[0].account, self.account_642)
        self.assertEqual(lines[0].debit, Decimal("10000000"))
        self.assertEqual(lines[1].account, self.account_1331)
        self.assertEqual(lines[1].debit, Decimal("1000000"))
        self.assertEqual(lines[2].account, self.account_331)
        self.assertEqual(lines[2].credit, Decimal("11000000"))

        # Kiểm tra khoản công nợ Payable (BR-18, 20, 27)
        payable = Payable.objects.get(document=doc)
        self.assertEqual(payable.original_amount, Decimal("11000000"))
        self.assertEqual(payable.balance, Decimal("11000000"))
        self.assertEqual(payable.paid_amount, Decimal("0"))
        self.assertEqual(payable.status, PayableStatus.OPEN)
        self.assertFalse(payable.is_overdue)

        # Kiểm tra số dư công nợ của NCC cập nhật
        supp_check = self.client.get(f"/api/v1/accounts-payable/documents/supplier-info/{self.query}&supplier_id={self.supplier.id}")
        self.assertEqual(Decimal(supp_check.data["current_balance"]), Decimal("11000000"))

        # BR-42: Khóa không cho sửa khi đã ghi sổ
        edit_res = self.client.put(f"/api/v1/accounts-payable/documents/{doc_id}/{self.query}", payload, format="json")
        self.assertEqual(edit_res.status_code, 400)

        # Tra cứu công nợ theo số chứng từ
        payables_res = self.client.get(f"/api/v1/accounts-payable/payables/{self.query}&search={doc_num}")
        self.assertEqual(payables_res.status_code, 200)
        p_list = payables_res.data["results"] if isinstance(payables_res.data, dict) else payables_res.data
        self.assertEqual(len(p_list), 1)

    def test_direct_submit_on_create_step28(self):
        """Tạo chứng từ trực tiếp với action=SUBMIT đặt trạng thái Chờ phê duyệt (BR-AP-REC-03)."""
        payload = self.build_document_payload(action="SUBMIT")
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], DocumentStatus.PENDING_APPROVAL)
        self.assertIsNotNone(res.data["submitted_at"])

    def test_auto_approval_when_no_workflow_af08(self):
        """Doanh nghiệp không áp dụng phê duyệt: tạo chứng từ trực tiếp ở trạng thái Đã phê duyệt (AF-08)."""
        payload = self.build_document_payload(action="SUBMIT", workflow_snapshot={"approval_required": False})
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], DocumentStatus.APPROVED)
        self.assertIsNotNone(res.data["approved_at"])

    def test_rejection_and_editing_af09_af10(self):
        """
        AF-09: Từ chối chứng từ bắt buộc có lý do (BR-45).
        AF-10: Sửa chứng từ bị từ chối và gửi phê duyệt lại (BR-47).
        """
        payload = self.build_document_payload(action="SUBMIT")
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        doc_id = res.data["id"]

        self.client.force_authenticate(self.approver_user)
        # Thiếu lý do -> lỗi (BR-45)
        rej_err = self.client.post(f"/api/v1/accounts-payable/documents/{doc_id}/reject/{self.query}", {"reason": ""}, format="json")
        self.assertEqual(rej_err.status_code, 400)

        # Có lý do -> Bị từ chối
        rej_ok = self.client.post(f"/api/v1/accounts-payable/documents/{doc_id}/reject/{self.query}", {"reason": "Sai số tiền dịch vụ"}, format="json")
        self.assertEqual(rej_ok.status_code, 200)
        self.assertEqual(rej_ok.data["status"], DocumentStatus.REJECTED)

        # Creator sửa chứng từ và gửi duyệt lại
        self.client.force_authenticate(self.maker_user)
        payload["description"] = "Đã cập nhật lại tiền thuê"
        payload["action"] = "SUBMIT"
        update_res = self.client.put(f"/api/v1/accounts-payable/documents/{doc_id}/{self.query}", payload, format="json")
        self.assertEqual(update_res.status_code, 200, update_res.data)
        self.assertEqual(update_res.data["status"], DocumentStatus.PENDING_APPROVAL)

    def test_cancel_document_before_posting_af12(self):
        """Hủy chứng từ chưa ghi sổ yêu cầu lý do (AF-12)."""
        payload = self.build_document_payload(action="SAVE_DRAFT")
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        doc_id = res.data["id"]

        # Hủy không lý do -> lỗi
        cancel_err = self.client.post(f"/api/v1/accounts-payable/documents/{doc_id}/cancel/{self.query}", {"reason": ""}, format="json")
        self.assertEqual(cancel_err.status_code, 400)

        # Hủy có lý do -> CANCELLED
        cancel_ok = self.client.post(f"/api/v1/accounts-payable/documents/{doc_id}/cancel/{self.query}", {"reason": "Hủy hợp đồng"}, format="json")
        self.assertEqual(cancel_ok.status_code, 200)
        self.assertEqual(cancel_ok.data["status"], DocumentStatus.CANCELLED)

    def test_overdue_payable_status_af11_br30(self):
        """Hạn thanh toán nhỏ hơn ngày hiện tại -> Công nợ ở trạng thái Quá hạn (AF-11, BR-30, 31)."""
        past_date = self.today - timedelta(days=5)
        payload = self.build_document_payload(
            document_date=str(past_date),
            posting_date=str(past_date),
            due_date=str(past_date),
            action="SUBMIT",
            workflow_snapshot={"approval_required": False},
        )
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        doc_id = res.data["id"]
        post_res = self.client.post(f"/api/v1/accounts-payable/documents/{doc_id}/post/{self.query}", {}, format="json")
        self.assertEqual(post_res.status_code, 200, post_res.data)

        doc = PayableDocument.objects.get(pk=doc_id)
        payable = Payable.objects.get(document=doc)
        self.assertEqual(payable.status, PayableStatus.OVERDUE)
        self.assertTrue(payable.is_overdue)

        # Tra cứu theo overdue=true
        od_res = self.client.get(f"/api/v1/accounts-payable/payables/{self.query}&overdue=true")
        self.assertEqual(od_res.status_code, 200)
        od_list = od_res.data["results"] if isinstance(od_res.data, dict) else od_res.data
        self.assertTrue(any(x["id"] == str(payable.id) for x in od_list))

    def test_auto_recognition_from_purchase_af01_af02(self):
        """Tự động ghi nhận công nợ khi ghi sổ chứng từ mua hàng (AF-01, AF-02)."""
        inv = SupplierInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            supplier_tax_code=self.supplier.tax_code,
            invoice_series="1C26TAA",
            invoice_number="999888",
            invoice_date=self.today,
            posting_date=self.today,
            due_date=self.today + timedelta(days=30),
            currency=self.currency,
            subtotal=Decimal("5000000"),
            tax_amount=Decimal("500000"),
            total_amount=Decimal("5500000"),
            created_by=self.maker_user.iam_account,
        )
        # AF-01: Chưa thanh toán
        p1 = auto_recognize_payable_from_purchase(inv, paid_amount=Decimal("0"))
        self.assertIsNotNone(p1)
        self.assertEqual(p1.original_amount, Decimal("5500000"))
        self.assertEqual(p1.balance, Decimal("5500000"))
        self.assertEqual(p1.status, PayableStatus.OPEN)

        # AF-02: Đã thanh toán một phần
        p1.delete()
        p2 = auto_recognize_payable_from_purchase(inv, paid_amount=Decimal("2000000"))
        self.assertEqual(p2.original_amount, Decimal("5500000"))
        self.assertEqual(p2.paid_amount, Decimal("2000000"))
        self.assertEqual(p2.balance, Decimal("3500000"))
        self.assertEqual(p2.status, PayableStatus.PARTIALLY_PAID)

    def test_due_date_calculation_from_payment_term_af03(self):
        """Hạn thanh toán tự động tính từ điều khoản thanh toán (AF-03, BR-25)."""
        info = self.client.get(f"/api/v1/accounts-payable/documents/supplier-info/{self.query}&supplier_id={self.supplier.id}")
        self.assertEqual(info.data["due_days"], 30)

    def test_non_taxable_and_zero_vat_af05(self):
        """Khoản chi phí không thuế GTGT có tiền thuế = 0 (AF-05)."""
        payload = self.build_document_payload(action="SAVE_DRAFT")
        payload["lines"][0]["tax_rate"] = None
        payload["lines"][0]["tax_rate_percent"] = None
        payload["lines"][0]["tax_amount"] = "0"
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data["tax_amount"]), Decimal("0"))
        self.assertEqual(Decimal(res.data["total_amount"]), Decimal("10000000"))

    def test_permission_checks_ef01_ef02_br10(self):
        """
        EF-01: Chặn xem khi không có quyền.
        EF-02: Chặn tạo khi không có quyền.
        BR-10: Admin không mặc nhiên có quyền nếu strict mode được kích hoạt.
        """
        self.client.force_authenticate(self.staff_user)
        # Không có quyền -> 403 Forbidden
        view_res = self.client.get(f"/api/v1/accounts-payable/documents/{self.query}")
        self.assertEqual(view_res.status_code, 403)

        payload = self.build_document_payload()
        create_res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(create_res.status_code, 403)

    def test_inactive_supplier_rejected_ef03(self):
        """EF-03: Nhà cung cấp đã ngừng hoạt động bị từ chối."""
        self.supplier.status = "INACTIVE"
        self.supplier.save(update_fields=("status",))
        payload = self.build_document_payload()
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Nhà cung cấp không còn hoạt động", str(res.data))

    def test_invoice_validation_and_duplicate_rejection_ef04_ef05_ef12(self):
        """
        EF-04: Hóa đơn không thuộc NCC của chứng từ.
        EF-05, EF-12: Hóa đơn đã dùng ghi nhận công nợ.
        """
        other_supplier = Party.objects.create(
            company=self.company, code="NCC_OTHER", name="NCC Khác", status="ACTIVE"
        )
        inv = SupplierInvoice.objects.create(
            company=self.company, branch=self.branch, supplier=other_supplier,
            supplier_tax_code="0109999999", invoice_series="1C26TAA", invoice_number="INV01",
            invoice_date=self.today, currency=self.currency, subtotal=100, total_amount=100,
            created_by=self.maker_user.iam_account,
        )
        # EF-04: Chọn hóa đơn của NCC khác
        payload = self.build_document_payload(invoice=str(inv.id))
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Hóa đơn được chọn không thuộc nhà cung cấp", str(res.data))

        # EF-05/12: Hóa đơn đúng NCC nhưng đã dùng
        inv.supplier = self.supplier
        inv.save(update_fields=("supplier",))
        ok_res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(ok_res.status_code, 201)

        # Dùng lại hóa đơn trên chứng từ khác
        dup_res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(dup_res.status_code, 400)
        self.assertIn("Hóa đơn đã được sử dụng", str(dup_res.data))

    def test_pre_tax_amount_validation_ef06(self):
        """EF-06: Số tiền trước thuế nhỏ hơn hoặc bằng 0."""
        payload = self.build_document_payload()
        payload["lines"][0]["amount"] = "0"
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Số tiền trước thuế phải lớn hơn 0", str(res.data))

    def test_payable_account_tracking_supplier_ef07(self):
        """EF-07: Tài khoản không theo dõi công nợ NCC (ví dụ 1111)."""
        payload = self.build_document_payload(payable_account=str(self.account_1111.id))
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Tài khoản được chọn không theo dõi công nợ", str(res.data))

    def test_missing_required_fields_ef08(self):
        """EF-08: Thiếu trường bắt buộc."""
        payload = self.build_document_payload(document_date="")
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Vui lòng nhập đầy đủ các trường bắt buộc", str(res.data))

    def test_due_date_before_document_date_ef10(self):
        """EF-10: Hạn thanh toán nhỏ hơn ngày chứng từ."""
        payload = self.build_document_payload(
            document_date=str(self.today),
            due_date=str(self.today - timedelta(days=1)),
        )
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Hạn thanh toán không được nhỏ hơn ngày chứng từ", str(res.data))

    def test_empty_lines_ef11(self):
        """EF-11: Không có dòng chi tiết khi gửi duyệt."""
        payload = self.build_document_payload(action="SUBMIT", lines=[])
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Chứng từ phải có ít nhất một dòng chi tiết hợp lệ", str(res.data))

    def test_optimistic_concurrency_control_ef14_ef16(self):
        """EF-14, EF-16: Xung đột phiên bản dữ liệu."""
        payload = self.build_document_payload(action="SAVE_DRAFT")
        res = self.client.post(f"/api/v1/accounts-payable/documents/{self.query}", payload, format="json")
        doc_id = res.data["id"]

        # Cập nhật với version sai
        payload["version"] = 99
        up_res = self.client.put(f"/api/v1/accounts-payable/documents/{doc_id}/{self.query}", payload, format="json")
        self.assertEqual(up_res.status_code, 400)
        self.assertIn("Dữ liệu chứng từ đã thay đổi", str(up_res.data))
