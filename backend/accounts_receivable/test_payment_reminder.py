import uuid
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from accounts_receivable.models import (
    CustomerPaymentReminder,
    CustomerPaymentReminderLine,
    CustomerPaymentReminderSendLog,
    Receivable,
    ReceivableSchedule,
    ReceivableStatus,
    ReminderPaymentMethod,
    ReminderSendChannel,
    ReminderStatus,
)
from general_ledger.models import (
    Account,
    AccountNature,
    AccountStatus,
    ChartOfAccounts,
    JournalEntry,
    NormalBalance,
)
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserAccount
from master_data.models import (
    Bank,
    CompanyBankAccount,
    Currency,
    DocumentType,
    Party,
    PartyAddress,
    PartyContact,
    PartyRole,
)
from organization.models import Branch, Company, Employee, Position


class CustomerPaymentReminderTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.prior_10d = self.today - timedelta(days=10)
        self.prior_5d = self.today - timedelta(days=5)
        self.future_10d = self.today + timedelta(days=10)
        self.future_20d = self.today + timedelta(days=20)

        # Currencies
        self.currency_vnd = Currency.objects.get(code="VND")
        self.currency_usd, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "US Dollar", "numeric_code": "840", "decimal_places": 2}
        )

        # Company & Branch
        self.company = Company.objects.create(
            code="COMP-REM", name="Công ty Đề Nghị Thanh Toán", legal_name="Công ty Đề Nghị Thanh Toán Ltd",
            tax_code="0309998888", accounting_currency=self.currency_vnd,
            legal_reporting_currency=self.currency_vnd, address="123 Lê Lợi, Q1, TP.HCM",
            phone="0281234567", email="contact@company-rem.vn",
        )
        self.branch = Branch.objects.create(
            company=self.company, code="BR-REM", name="Chi nhánh Trung Tâm",
        )

        # Accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA-REM", name="Reminder COA",
            effective_from=date(2026, 1, 1), is_default=True,
        )
        self.account_131 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="131",
            name="Phải thu của khách hàng", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )
        self.account_131_usd = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1312",
            name="Phải thu khách hàng USD", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )
        self.account_112 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1121",
            name="Tiền gửi ngân hàng", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )

        # Banks & Company Bank Accounts
        self.bank = Bank.objects.create(
            code="VCB", name="Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)", swift_code="BFTVVNVX"
        )
        self.bank_account_vnd = CompanyBankAccount.objects.create(
            company=self.company, code="BA-VND", account_number="0071001234567",
            account_name="CONG TY DE NGHI THANH TOAN", bank=self.bank,
            currency=self.currency_vnd, bank_branch="Chi nhánh Bến Thành",
            status="ACTIVE",
        )
        self.bank_account_usd = CompanyBankAccount.objects.create(
            company=self.company, code="BA-USD", account_number="0071007654321",
            account_name="CONG TY DE NGHI THANH TOAN", bank=self.bank,
            currency=self.currency_usd, bank_branch="Chi nhánh Bến Thành",
            status="ACTIVE",
        )
        self.bank_account_inactive = CompanyBankAccount.objects.create(
            company=self.company, code="BA-INACT", account_number="0071009999999",
            account_name="CONG TY DE NGHI THANH TOAN", bank=self.bank,
            currency=self.currency_vnd, bank_branch="Chi nhánh Tân Bình",
            status="INACTIVE",
        )

        # Customer 1 & 2
        self.customer1 = Party.objects.create(
            company=self.company, code="KH-ALPHA", name="Công ty TNHH Alpha",
            tax_code="0301112223", default_currency=self.currency_vnd, status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer1, role_type="CUSTOMER", active_from=self.today)
        self.contact1 = PartyContact.objects.create(
            party=self.customer1, contact_type="ACCOUNTING", contact_name="Nguyễn Văn A",
            email="nguyenvana@alpha.vn", phone="0901234567", is_default=True, status="ACTIVE",
        )
        self.address1 = PartyAddress.objects.create(
            party=self.customer1, address_type="BILLING", address_line="Tòa nhà Alpha, 456 Hai Bà Trưng, Q3",
            is_default=True, status="ACTIVE",
        )

        self.customer2 = Party.objects.create(
            company=self.company, code="KH-BETA", name="Công ty Cổ phần Beta",
            tax_code="0304445556", default_currency=self.currency_vnd, status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer2, role_type="CUSTOMER", active_from=self.today)

        # Employees & Positions
        self.pos_accountant = Position.objects.create(company=self.company, code="CHIEF_ACC", name="Kế toán trưởng")
        self.pos_director = Position.objects.create(company=self.company, code="DIR", name="Giám đốc tài chính")

        self.employee_signer = Employee.objects.create(
            company=self.company, employee_code="EMP-001", full_name="Trần Thị B",
            position=self.pos_accountant, status="ACTIVE", email="tranthib@company-rem.vn",
        )
        self.employee_inactive = Employee.objects.create(
            company=self.company, employee_code="EMP-002", full_name="Lê Văn C",
            position=self.pos_director, status="TERMINATED", email="levanc@company-rem.vn",
        )

        # Users & Permissions
        User = get_user_model()
        self.admin_user = User.objects.create_superuser(
            username="admin_rem", email="admin_rem@example.com", password="password"
        )
        CompanyMembership.objects.create(
            company=self.company, user=self.admin_user.iam_account, created_by=self.admin_user.iam_account,
        )

        self.regular_user = User.objects.create_user(
            username="staff_rem", email="staff_rem@example.com", password="password"
        )
        self.staff_iam = self.regular_user.iam_account
        self.staff_membership = CompanyMembership.objects.create(
            company=self.company, user=self.staff_iam, created_by=self.admin_user.iam_account,
        )

        # Role with permissions
        self.role_view = Role.objects.create(company=self.company, code="AR_VIEWER", name="AR Viewer")
        perm_view = Permission.objects.get(code="AR.PAYMENT_REMINDER.VIEW")
        RolePermission.objects.create(role=self.role_view, permission=perm_view)

        # Default client: Admin
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.base_url = f"/api/v1/accounts-receivable/payment-reminders/?company_id={self.company.id}"

        # Receivables for customer1
        # Rec 1: Overdue debt (single schedule / standard)
        self.rec1 = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-REC-001",
            customer=self.customer1, currency=self.currency_vnd,
            account=self.account_131, document_date=self.prior_10d, posting_date=self.prior_10d,
            due_date=self.prior_5d, original_amount=Decimal("10000000"),
            balance=Decimal("10000000"), source_document_number="HD-001",
            status=ReceivableStatus.OPEN,
        )

        # Rec 2: Debt with installments (ReceivableSchedule)
        self.rec2 = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-REC-002",
            customer=self.customer1, currency=self.currency_vnd,
            account=self.account_131, document_date=self.prior_10d, posting_date=self.prior_10d,
            due_date=self.future_20d, original_amount=Decimal("20000000"),
            balance=Decimal("20000000"), source_document_number="HD-002",
            status=ReceivableStatus.OPEN,
        )
        self.sch2_1 = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.rec2, installment_no=1,
            amount=Decimal("10000000"), due_date=self.prior_5d,
            balance=Decimal("10000000"),
        )
        self.sch2_2 = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.rec2, installment_no=2,
            amount=Decimal("10000000"), due_date=self.future_20d,
            balance=Decimal("10000000"),
        )

        # Rec 3: Not yet due debt
        self.rec3 = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-REC-003",
            customer=self.customer1, currency=self.currency_vnd,
            account=self.account_131, document_date=self.today, posting_date=self.today,
            due_date=self.future_10d, original_amount=Decimal("5000000"),
            balance=Decimal("5000000"), source_document_number="HD-003",
            status=ReceivableStatus.OPEN,
        )

        # Rec USD for customer1
        self.rec_usd = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-REC-USD",
            customer=self.customer1, currency=self.currency_usd,
            account=self.account_131_usd, document_date=self.prior_10d, posting_date=self.prior_10d,
            due_date=self.prior_5d, original_amount=Decimal("1000"),
            balance=Decimal("1000"), source_document_number="INV-USD-001",
            status=ReceivableStatus.OPEN,
        )

        # Rec for customer2
        self.rec_cust2 = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-REC-BETA",
            customer=self.customer2, currency=self.currency_vnd,
            account=self.account_131, document_date=self.prior_10d, posting_date=self.prior_10d,
            due_date=self.prior_5d, original_amount=Decimal("8000000"),
            balance=Decimal("8000000"), source_document_number="HD-BETA-01",
            status=ReceivableStatus.OPEN,
        )

    # =========================================================================
    # 1. ACTIVITY FLOW (STEPS 1 - 8)
    # =========================================================================

    def test_step1_and_step2_list_and_default_customer_info(self):
        """Step 1 & 2: Xem danh sách và lấy thông tin mặc định của khách hàng"""
        # Step 1: List reminders
        res_list = self.client.get(self.base_url)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        count = res_list.data.get("count") if isinstance(res_list.data, dict) else len(res_list.data)
        self.assertEqual(count, 0)

        # Step 2: Fetch default customer info
        info_url = f"/api/v1/accounts-receivable/payment-reminders/default-customer-info/?customer_id={self.customer1.id}&company_id={self.company.id}"
        res_info = self.client.get(info_url)
        self.assertEqual(res_info.status_code, status.HTTP_200_OK)
        self.assertEqual(res_info.data["recipient_name"], "Nguyễn Văn A")
        self.assertEqual(res_info.data["recipient_email"], "nguyenvana@alpha.vn")
        self.assertIn("456 Hai Bà Trưng", res_info.data["customer_address"])

    def test_step3_eligible_receivables_endpoint(self):
        """Step 3: Chọn khách hàng, loại tiền, tài khoản -> hiển thị danh sách công nợ đủ điều kiện"""
        url = (
            f"/api/v1/accounts-receivable/payment-reminders/eligible-receivables/?"
            f"company_id={self.company.id}&customer_id={self.customer1.id}&"
            f"currency_id={self.currency_vnd.id}&receivable_account_id={self.account_131.id}"
        )
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data["items"]
        # Should contain rec1, sch2_1, sch2_2, rec3 (4 eligible debt items for customer1 VND account 131)
        self.assertEqual(len(items), 4)

        # Verify items contain overdue days and balance
        rec1_item = next(it for it in items if it["receivable_id"] == str(self.rec1.id))
        self.assertEqual(Decimal(str(rec1_item["remaining_balance"])), Decimal("10000000"))
        self.assertGreater(rec1_item["days_overdue"], 0)

        # Check installment numbers
        sch2_1_item = next(it for it in items if it["receivable_schedule_id"] == str(self.sch2_1.id))
        self.assertEqual(sch2_1_item["installment_no"], 1)

    def test_step4_to_step6_create_draft_payment_reminder(self):
        """Step 4, 5, 6: Nhập liệu, tính tổng tiền, lưu thông báo ở trạng thái Nháp (DRAFT)"""
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer1.id),
            "currency": str(self.currency_vnd.id),
            "receivable_account": str(self.account_131.id),
            "notice_date": self.today.isoformat(),
            "requested_due_date": self.future_10d.isoformat(),
            "recipient_name": "Nguyễn Văn A",
            "recipient_email": "nguyenvana@alpha.vn",
            "payment_method": "BANK_TRANSFER",
            "company_bank_account": str(self.bank_account_vnd.id),
            "signer_employee": str(self.employee_signer.id),
            "lines": [
                {
                    "receivable": str(self.rec1.id),
                    "requested_amount": "10000000",
                    "line_note": "Khoản nợ đơn hàng 01",
                },
                {
                    "receivable": str(self.rec2.id),
                    "receivable_schedule": str(self.sch2_1.id),
                    "requested_amount": "8000000",  # AF02: Đề nghị một phần
                    "line_note": "Đợt 1 hợp đồng 02",
                },
            ],
        }

        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data

        # Check status and auto-generated number
        self.assertEqual(data["status"], "DRAFT")
        self.assertTrue(data["notice_number"].startswith(f"AR-REM-{self.today.year}-"))
        self.assertEqual(Decimal(str(data["total_requested_amount"])), Decimal("18000000"))

        # Check signer snapshot
        self.assertEqual(data["signer_name"], "Trần Thị B")
        self.assertEqual(data["signer_title"], "Kế toán trưởng")

        # Check bank snapshot
        self.assertEqual(data["bank_info_snapshot"]["account_number"], "0071001234567")

        # Check lines
        self.assertEqual(len(data["lines"]), 2)
        line1 = data["lines"][0]
        self.assertEqual(line1["line_no"], 1)
        self.assertEqual(Decimal(str(line1["requested_amount"])), Decimal("10000000"))
        self.assertGreater(line1["days_overdue"], 0)

        # BR06: Kiểm tra không phát sinh bút toán và không thay đổi số dư công nợ
        self.rec1.refresh_from_db()
        self.assertEqual(self.rec1.balance, Decimal("10000000"))
        self.assertEqual(JournalEntry.objects.filter(company=self.company, source_entity_type="CustomerPaymentReminder").count(), 0)

    def test_step7_export_pdf_payload(self):
        """Step 7: Xuất thông báo PDF tạo payload đầy đủ khi số dư đáp ứng"""
        reminder = self._create_test_reminder()
        export_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/export-pdf/?company_id={self.company.id}"
        res = self.client.get(export_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(data["notice_number"], reminder.notice_number)
        self.assertEqual(data["company"]["tax_code"], self.company.tax_code)
        self.assertEqual(data["customer"]["code"], self.customer1.code)
        self.assertEqual(data["bank_info"]["account_number"], self.bank_account_vnd.account_number)
        self.assertEqual(Decimal(str(data["total_requested_amount"])), Decimal("10000000"))
        self.assertIn("10,000,000 VND", data["total_in_words"])
        self.assertEqual(len(data["lines"]), 1)

    def test_step8_record_sent_transitions_to_sent_and_locks(self):
        """Step 8: Ghi nhận đã gửi lưu lịch sử gửi, chuyển trạng thái sang Đã gửi (SENT) và khóa nội dung"""
        reminder = self._create_test_reminder()
        self.assertEqual(reminder.status, ReminderStatus.DRAFT)

        send_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/record-sent/?company_id={self.company.id}"
        send_payload = {
            "sent_date": self.today.isoformat(),
            "sent_channel": "EMAIL",
            "actual_recipient": "nguyenvana@alpha.vn",
            "proof_documents": ["https://s3.example.com/proof-email.pdf"],
            "note": "Đã gửi email kèm biên bản đối chiếu",
        }
        res = self.client.post(send_url, send_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reminder.refresh_from_db()

        self.assertEqual(reminder.status, ReminderStatus.SENT)
        self.assertEqual(reminder.send_count, 1)
        self.assertEqual(reminder.last_sent_channel, "EMAIL")
        self.assertIsNotNone(reminder.last_sent_at)

        # Check send log record
        self.assertEqual(reminder.send_logs.count(), 1)
        log = reminder.send_logs.first()
        self.assertEqual(log.sent_channel, ReminderSendChannel.EMAIL)
        self.assertEqual(log.actual_recipient, "nguyenvana@alpha.vn")

        # EF08: Thử sửa trực tiếp thông báo đã gửi bị chặn
        update_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/?company_id={self.company.id}"
        res_update = self.client.patch(update_url, {"title": "Thay đổi tiêu đề"}, format="json")
        self.assertEqual(res_update.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Không thể sửa thông báo đã gửi", str(res_update.data))

    # =========================================================================
    # 2. ALTERNATIVE FLOWS (AF01 - AF08)
    # =========================================================================

    def test_af01_create_from_due_tracking(self):
        """AF01: Lập thông báo từ danh sách công nợ đến hạn (UC-AR-08)"""
        url = f"/api/v1/accounts-receivable/payment-reminders/create-from-due-tracking/?company_id={self.company.id}"
        payload = {
            "company_id": str(self.company.id),
            "items": [
                {"receivable_id": str(self.rec1.id), "requested_amount": "10000000"},
                {"receivable_id": str(self.rec2.id), "schedule_id": str(self.sch2_1.id), "requested_amount": "10000000"},
            ],
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(data["customer_id"], str(self.customer1.id))
        self.assertEqual(data["currency_id"], str(self.currency_vnd.id))
        self.assertEqual(len(data["lines"]), 2)
        self.assertEqual(data["recipient_name"], "Nguyễn Văn A")

    def test_af04_request_not_yet_due_items(self):
        """AF04: Đề nghị khoản chưa đến hạn: giữ nguyên hạn gốc, trình bày riêng hạn thanh toán đề nghị"""
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer1.id),
            "currency": str(self.currency_vnd.id),
            "receivable_account": str(self.account_131.id),
            "notice_date": self.today.isoformat(),
            "requested_due_date": self.future_10d.isoformat(),
            "recipient_name": "Nguyễn Văn A",
            "payment_method": "BANK_TRANSFER",
            "company_bank_account": str(self.bank_account_vnd.id),
            "signer_name": "Giám đốc duyệt",
            "lines": [
                {
                    "receivable": str(self.rec3.id),  # due_date is future_10d
                    "requested_amount": "5000000",
                }
            ],
        }
        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        line = res.data["lines"][0]

        # Original due date is preserved, days overdue is 0
        self.assertEqual(line["original_due_date"], self.future_10d.isoformat())
        self.assertEqual(line["days_overdue"], 0)

        # BR08: Check that original receivable due date was not changed
        self.rec3.refresh_from_db()
        self.assertEqual(self.rec3.due_date, self.future_10d)

    def test_af05_refresh_balances_detects_changes(self):
        """AF05: Cập nhật số dư khi còn nháp phát hiện nợ đã thanh toán một phần hoặc hết dư"""
        reminder = self._create_test_reminder()
        # Simulate external receipt reducing rec1 balance from 10,000,000 to 4,000,000
        self.rec1.balance = Decimal("4000000")
        self.rec1.save()

        refresh_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/refresh-balances/?company_id={self.company.id}"
        res = self.client.post(refresh_url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        discrepancies = res.data["discrepancies"]
        self.assertEqual(len(discrepancies), 1)
        self.assertEqual(discrepancies[0]["status"], "EXCEEDS_BALANCE")
        self.assertEqual(Decimal(discrepancies[0]["current_balance"]), Decimal("4000000"))

        # Line remaining_balance updated to 4,000,000
        reminder.refresh_from_db()
        line = reminder.lines.first()
        self.assertEqual(line.remaining_balance, Decimal("4000000"))

    def test_af06_resend_notice_appends_send_log(self):
        """AF06: Gửi lại thông báo giữ nguyên nội dung, bổ sung lịch sử gửi"""
        reminder = self._create_test_reminder()
        send_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/record-sent/?company_id={self.company.id}"

        # First send (Email)
        self.client.post(send_url, {
            "sent_date": self.today.isoformat(),
            "sent_channel": "EMAIL",
            "actual_recipient": "nguyenvana@alpha.vn",
        }, format="json")

        # Second send (Paper)
        res2 = self.client.post(send_url, {
            "sent_date": self.today.isoformat(),
            "sent_channel": "PAPER",
            "actual_recipient": "Phòng kế toán Alpha",
            "note": "Gửi bản giấy qua đường bưu điện",
        }, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        reminder.refresh_from_db()
        self.assertEqual(reminder.send_count, 2)
        self.assertEqual(reminder.send_logs.count(), 2)
        channels = list(reminder.send_logs.values_list("sent_channel", flat=True))
        self.assertIn("EMAIL", channels)
        self.assertIn("PAPER", channels)

    def test_af07_re_notice_creates_new_reminder_linked_to_previous(self):
        """AF07: Lập thông báo mới từ thông báo đã gửi, lấy số dư mới và liên kết thông báo cũ"""
        reminder = self._create_test_reminder()
        # Send first
        send_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/record-sent/?company_id={self.company.id}"
        self.client.post(send_url, {"sent_date": self.today.isoformat(), "sent_channel": "EMAIL"}, format="json")

        # Now re-notice
        re_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/re-notice/?company_id={self.company.id}"
        res = self.client.post(re_url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_data = res.data

        self.assertNotEqual(new_data["id"], str(reminder.id))
        self.assertNotEqual(new_data["notice_number"], reminder.notice_number)
        self.assertEqual(new_data["status"], "DRAFT")
        self.assertEqual(str(new_data["previous_notice"]), str(reminder.id))
        self.assertEqual(new_data["previous_notice_number"], reminder.notice_number)

    def test_af08_cancel_notice_records_reason_and_user(self):
        """AF08: Hủy thông báo đề nghị thanh toán lưu lý do và thời điểm hủy"""
        reminder = self._create_test_reminder()
        cancel_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/cancel/?company_id={self.company.id}"
        res = self.client.post(cancel_url, {"reason": "Khách hàng đã thanh toán trước khi gửi"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        reminder.refresh_from_db()
        self.assertEqual(reminder.status, ReminderStatus.CANCELLED)
        self.assertEqual(reminder.cancel_reason, "Khách hàng đã thanh toán trước khi gửi")
        self.assertIsNotNone(reminder.cancelled_at)
        self.assertEqual(reminder.cancelled_by, self.admin_user.iam_account)

    # =========================================================================
    # 3. EXCEPTION FLOWS (EF01 - EF10)
    # =========================================================================

    def test_ef01_permission_denied_for_unauthorized_user(self):
        """EF01: Không có quyền thao tác bị chặn 403 Forbidden"""
        user_client = APIClient()
        user_client.force_authenticate(self.regular_user)
        # Regular user has no permission
        res = user_client.post(self.base_url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_ef02_missing_required_fields_and_empty_lines(self):
        """EF02: Thiếu trường bắt buộc hoặc chưa có dòng công nợ bị chặn khi Lưu"""
        # Empty payload
        res = self.client.post(self.base_url, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing lines
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer1.id),
            "currency": str(self.currency_vnd.id),
            "receivable_account": str(self.account_131.id),
            "notice_date": self.today.isoformat(),
            "requested_due_date": self.future_10d.isoformat(),
            "recipient_name": "Nguyễn Văn A",
            "payment_method": "BANK_TRANSFER",
            "company_bank_account": str(self.bank_account_vnd.id),
            "signer_name": "Trần Thị B",
            "lines": [],
        }
        res_empty_lines = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res_empty_lines.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ít nhất một khoản công nợ", str(res_empty_lines.data))

    def test_ef03_requested_amount_zero_or_exceeding_balance(self):
        """EF03: Số tiền đề nghị <= 0 hoặc vượt quá số dư còn lại bị chặn"""
        # Amount <= 0
        payload_zero = self._valid_payload()
        payload_zero["lines"][0]["requested_amount"] = "0"
        res_zero = self.client.post(self.base_url, payload_zero, format="json")
        self.assertEqual(res_zero.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phải lớn hơn 0", str(res_zero.data))

        # Amount > remaining balance
        payload_excess = self._valid_payload()
        payload_excess["lines"][0]["requested_amount"] = "999999999"  # balance is 10,000,000
        res_excess = self.client.post(self.base_url, payload_excess, format="json")
        self.assertEqual(res_excess.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vượt quá số dư còn lại", str(res_excess.data))

    def test_ef04_mixed_customer_currency_or_account(self):
        """EF04: Công nợ khác khách hàng, loại tiền hoặc tài khoản không được lưu chung"""
        # Line from different customer
        payload_diff_cust = self._valid_payload()
        payload_diff_cust["lines"].append({
            "receivable": str(self.rec_cust2.id),  # belongs to customer2
            "requested_amount": "5000000",
        })
        res_diff_cust = self.client.post(self.base_url, payload_diff_cust, format="json")
        self.assertEqual(res_diff_cust.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không cùng khách hàng", str(res_diff_cust.data))

        # Line from different currency
        payload_diff_curr = self._valid_payload()
        payload_diff_curr["lines"].append({
            "receivable": str(self.rec_usd.id),  # USD
            "requested_amount": "100",
        })
        res_diff_curr = self.client.post(self.base_url, payload_diff_curr, format="json")
        self.assertEqual(res_diff_curr.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không cùng loại tiền", str(res_diff_curr.data))

    def test_ef05_export_pdf_fails_if_balance_dropped_below_requested(self):
        """EF05: Xuất PDF thất bại và yêu cầu cập nhật nếu số dư đã giảm xuống dưới số tiền đề nghị"""
        reminder = self._create_test_reminder()
        # Reduce debt balance in database to 2,000,000 while reminder requested 10,000,000
        self.rec1.balance = Decimal("2000000")
        self.rec1.save()

        export_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/export-pdf/?company_id={self.company.id}"
        res = self.client.get(export_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đã thay đổi", str(res.data))
        self.assertIn("cập nhật lại", str(res.data))

    def test_ef06_invalid_dates(self):
        """EF06: Hạn đề nghị trước ngày lập hoặc ngày gửi không hợp lệ bị chặn"""
        # Requested due date before notice date
        payload = self._valid_payload()
        payload["notice_date"] = self.today.isoformat()
        payload["requested_due_date"] = (self.today - timedelta(days=1)).isoformat()
        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không được trước ngày lập", str(res.data))

        # Sent date before notice date or in the future
        reminder = self._create_test_reminder()
        send_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/record-sent/?company_id={self.company.id}"

        res_past = self.client.post(send_url, {
            "sent_date": (self.today - timedelta(days=2)).isoformat(),
            "sent_channel": "EMAIL",
        }, format="json")
        self.assertEqual(res_past.status_code, status.HTTP_400_BAD_REQUEST)

        res_future = self.client.post(send_url, {
            "sent_date": (self.today + timedelta(days=2)).isoformat(),
            "sent_channel": "EMAIL",
        }, format="json")
        self.assertEqual(res_future.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ef07_bank_account_inactive_or_currency_mismatch_or_signer_inactive(self):
        """EF07: Tài khoản ngân hàng không hoạt động, sai loại tiền hoặc người ký không đủ điều kiện"""
        # Bank account inactive
        payload_inact_bank = self._valid_payload()
        payload_inact_bank["company_bank_account"] = str(self.bank_account_inactive.id)
        res1 = self.client.post(self.base_url, payload_inact_bank, format="json")
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đang không hoạt động", str(res1.data))

        # Bank account currency mismatch (USD bank account for VND reminder)
        payload_curr_bank = self._valid_payload()
        payload_curr_bank["company_bank_account"] = str(self.bank_account_usd.id)
        res2 = self.client.post(self.base_url, payload_curr_bank, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không cùng loại tiền", str(res2.data))

        # Signer employee inactive/terminated
        payload_inact_signer = self._valid_payload()
        payload_inact_signer["signer_employee"] = str(self.employee_inactive.id)
        res3 = self.client.post(self.base_url, payload_inact_signer, format="json")
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không còn đủ điều kiện", str(res3.data))

    def test_ef09_optimistic_lock_version_conflict(self):
        """EF09: Cảnh báo và chặn ghi đè khi có xung đột phiên bản (version conflict)"""
        reminder = self._create_test_reminder()
        self.assertEqual(reminder.version, 1)

        # Attempt to update with outdated version (e.g. 0)
        update_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/?company_id={self.company.id}"
        payload = self._valid_payload()
        payload["version"] = 0
        payload["title"] = "Cập nhật xung đột"

        res = self.client.put(update_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đã được người khác cập nhật", str(res.data))

    def test_ef10_destroy_sent_or_cancelled_reminder_blocked(self):
        """EF10: Chỉ cho phép xóa thông báo ở trạng thái Nháp; chặn xóa thông báo Đã gửi"""
        reminder = self._create_test_reminder()
        # Send
        send_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/record-sent/?company_id={self.company.id}"
        self.client.post(send_url, {"sent_date": self.today.isoformat(), "sent_channel": "EMAIL"}, format="json")

        del_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/?company_id={self.company.id}"
        res = self.client.delete(del_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Chỉ có thể xóa thông báo ở trạng thái Nháp", str(res.data))

    # =========================================================================
    # 4. BUSINESS RULES (BR01 - BR14)
    # =========================================================================

    def test_br04_no_duplicate_receivable_and_schedule_in_same_notice(self):
        """BR04: Không chọn trùng cùng khoản phải thu và đợt thanh toán trong một thông báo"""
        payload = self._valid_payload()
        # Add exact duplicate of first line
        payload["lines"].append({
            "receivable": str(self.rec1.id),
            "requested_amount": "5000000",
        })
        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Không được chọn trùng", str(res.data))

    def test_br09_prior_sent_reminder_alert_in_eligible_receivables(self):
        """BR09: Hiển thị thông báo và ngày gửi gần nhất nếu khoản nợ đã có trong thông báo Đã gửi chưa hủy"""
        # Create and send a reminder containing rec1
        reminder = self._create_test_reminder()
        send_url = f"/api/v1/accounts-receivable/payment-reminders/{reminder.id}/record-sent/?company_id={self.company.id}"
        self.client.post(send_url, {"sent_date": self.today.isoformat(), "sent_channel": "EMAIL"}, format="json")

        # Now query eligible receivables
        url = (
            f"/api/v1/accounts-receivable/payment-reminders/eligible-receivables/?"
            f"company_id={self.company.id}&customer_id={self.customer1.id}&"
            f"currency_id={self.currency_vnd.id}&receivable_account_id={self.account_131.id}"
        )
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rec1_item = next(it for it in res.data["items"] if it["receivable_id"] == str(self.rec1.id))

        self.assertIsNotNone(rec1_item["prior_sent_reminder"])
        self.assertEqual(rec1_item["prior_sent_reminder"]["notice_number"], reminder.notice_number)

    def test_cash_payment_method_requires_cash_location(self):
        """Kiểm tra phương thức Tiền mặt bắt buộc phải có địa điểm nhận tiền mặt"""
        payload = self._valid_payload()
        payload["payment_method"] = "CASH"
        payload["company_bank_account"] = None
        payload["cash_location"] = ""
        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Địa điểm nhận tiền mặt là bắt buộc", str(res.data))

        # Provide cash location -> succeed
        payload["cash_location"] = "Phòng Kế toán, Tầng 3, 123 Lê Lợi, Q1"
        res_ok = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_ok.data["payment_method"], "CASH")
        self.assertEqual(res_ok.data["cash_location"], "Phòng Kế toán, Tầng 3, 123 Lê Lợi, Q1")

    # =========================================================================
    # HELPERS
    # =========================================================================

    def _valid_payload(self):
        return {
            "company": str(self.company.id),
            "customer": str(self.customer1.id),
            "currency": str(self.currency_vnd.id),
            "receivable_account": str(self.account_131.id),
            "notice_date": self.today.isoformat(),
            "requested_due_date": self.future_10d.isoformat(),
            "recipient_name": "Nguyễn Văn A",
            "recipient_email": "nguyenvana@alpha.vn",
            "customer_address": "456 Hai Bà Trưng, Q3, TP.HCM",
            "title": "Thông báo đề nghị thanh toán công nợ",
            "payment_method": "BANK_TRANSFER",
            "company_bank_account": str(self.bank_account_vnd.id),
            "signer_employee": str(self.employee_signer.id),
            "lines": [
                {
                    "receivable": str(self.rec1.id),
                    "requested_amount": "10000000",
                    "line_note": "Khoản nợ 01",
                }
            ],
        }

    def _create_test_reminder(self):
        res = self.client.post(self.base_url, self._valid_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        return CustomerPaymentReminder.objects.get(pk=res.data["id"])
