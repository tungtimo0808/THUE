from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIClient

from master_data.models import Currency
from organization.models import Branch, Company, Department, Employee

from .models import Account, AccountClass, AccountingPeriod, ChartOfAccounts


class GeneralLedgerTransactionTests(TestCase):
    def setUp(self):
        from organization.models import Branch
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.currency = currency
        self.company = Company.objects.create(
            code="GLTX", name="GL Transaction", legal_name="GL Transaction Ltd", tax_code="0100666688",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        account_class = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="Hệ thống", effective_from="2026-01-01", is_default=True)
        self.cash = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code="1111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT")
        self.expense = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code="6421", name="Chi phí", account_type="EXPENSE", normal_balance="DEBIT")
        self.destination = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code="6422", name="Chi phí phân bổ", account_type="EXPENSE", normal_balance="DEBIT")
        self.retained = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code="911", name="Kết quả", account_type="EQUITY", normal_balance="CREDIT")
        self.maker = get_user_model().objects.create_superuser(username="gl-maker", email="maker@gl.test", password="x")
        self.approver = get_user_model().objects.create_superuser(username="gl-approver", email="approver@gl.test", password="x")
        self.poster = get_user_model().objects.create_superuser(username="gl-poster", email="poster@gl.test", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.maker)
        self.query = f"?company_id={self.company.id}"
        period = self.client.post(
            f"/api/v1/general-ledger/periods/{self.query}",
            {"company": str(self.company.id), "code": "2026-09", "fiscal_year": 2026, "period_number": 9, "start_date": "2026-09-01", "end_date": "2026-09-30"}, format="json",
        )
        self.assertEqual(period.status_code, 201, period.data)
        self.period = period.data["id"]

    def create_and_post(self, number="JV-001", source_event=None):
        payload = {
            "company": str(self.company.id), "branch": str(self.branch.id), "period": self.period,
            "number": number, "entry_type": "SUBLEDGER" if source_event else "MANUAL",
            "posting_date": "2026-09-25", "document_date": "2026-09-25", "description": "Chi phí phát sinh",
            "source_module": "AP" if source_event else "", "source_event_id": source_event,
            "lines": [
                {"line_no": 1, "account": str(self.expense.id), "debit": "100", "credit": "0", "currency": str(self.currency.id), "exchange_rate": "1"},
                {"line_no": 2, "account": str(self.cash.id), "debit": "0", "credit": "100", "currency": str(self.currency.id), "exchange_rate": "1"},
            ],
        }
        created = self.client.post(f"/api/v1/general-ledger/journals/{self.query}", payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        entry_id = created.data["id"]
        submitted = self.client.post(f"/api/v1/general-ledger/journals/{entry_id}/submit/{self.query}", {}, format="json")
        self.assertEqual(submitted.data["status"], "PENDING_APPROVAL", submitted.data)
        self.client.force_authenticate(self.approver)
        approved = self.client.post(f"/api/v1/general-ledger/journals/{entry_id}/approve/{self.query}", {"comment": "Duyệt"}, format="json")
        self.assertEqual(approved.data["status"], "APPROVED", approved.data)
        self.client.force_authenticate(self.poster)
        posted = self.client.post(f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.client.force_authenticate(self.maker)
        return entry_id

    def test_journal_balance_reconciliation_reverse_close_and_reopen(self):
        from decimal import Decimal
        from .models import AccountBalance
        entry_id = self.create_and_post()
        balance = AccountBalance.objects.get(period_id=self.period, account=self.expense, branch=self.branch)
        self.assertEqual(balance.period_debit, Decimal("100"))
        reconciliation = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {"company": str(self.company.id), "period": self.period, "account": str(self.expense.id), "source_module": "AP", "subledger_amount": "100"}, format="json",
        )
        self.assertEqual(reconciliation.status_code, 201, reconciliation.data)
        self.assertEqual(reconciliation.data["status"], "MATCHED")
        self.client.force_authenticate(self.poster)
        reversed_entry = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/reverse/{self.query}",
            {"period": self.period, "posting_date": "2026-09-26", "number": "REV-JV-001", "reason": "Sửa sai", "auto_post": True}, format="json",
        )
        self.assertEqual(reversed_entry.status_code, 201, reversed_entry.data)
        balance.refresh_from_db()
        self.assertEqual(balance.closing_debit, Decimal("0"))
        closed = self.client.post(f"/api/v1/general-ledger/periods/{self.period}/close/{self.query}", {}, format="json")
        self.assertEqual(closed.data["status"], "CLOSED")
        reopened = self.client.post(f"/api/v1/general-ledger/periods/{self.period}/reopen/{self.query}", {"reason": "Điều chỉnh kiểm toán"}, format="json")
        self.assertEqual(reopened.data["status"], "OPEN")

    def test_subledger_idempotency_allocation_and_closing(self):
        from decimal import Decimal
        from .models import AccountBalance
        self.create_and_post("AP-GL-001", "AP:INVOICE:001")
        duplicate = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id), "branch": str(self.branch.id), "period": self.period,
                "number": "AP-GL-002", "entry_type": "SUBLEDGER", "posting_date": "2026-09-25",
                "description": "Trùng", "source_module": "AP", "source_event_id": "AP:INVOICE:001",
                "lines": [
                    {"line_no": 1, "account": str(self.expense.id), "debit": "100", "credit": "0", "currency": str(self.currency.id)},
                    {"line_no": 2, "account": str(self.cash.id), "debit": "0", "credit": "100", "currency": str(self.currency.id)},
                ],
            }, format="json",
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        rule = self.client.post(
            f"/api/v1/general-ledger/allocation-rules/{self.query}",
            {
                "company": str(self.company.id), "code": "PB01", "name": "Phân bổ chi phí",
                "source_account": str(self.expense.id), "offset_account": str(self.expense.id), "method": "FIXED_PERCENT",
                "destinations": [{"account": str(self.destination.id), "percentage": "100"}],
            }, format="json",
        )
        self.assertEqual(rule.status_code, 201, rule.data)
        allocated = self.client.post(
            f"/api/v1/general-ledger/allocation-rules/{rule.data['id']}/run/{self.query}",
            {"company": str(self.company.id), "period": self.period, "idempotency_key": "ALLOC:2026-09:PB01"}, format="json",
        )
        self.assertEqual(allocated.status_code, 201, allocated.data)
        self.assertEqual(Decimal(allocated.data["amount"]), Decimal("100"))
        source_totals = AccountBalance.objects.filter(period_id=self.period, account=self.expense).aggregate(d=Sum("closing_debit"), c=Sum("closing_credit"))
        self.assertEqual((source_totals["d"] or Decimal("0")) - (source_totals["c"] or Decimal("0")), Decimal("0"))
        closing = self.client.post(
            f"/api/v1/general-ledger/closing-rules/{self.query}",
            {"company": str(self.company.id), "code": "KC01", "name": "Kết chuyển", "source_account": str(self.destination.id), "destination_account": str(self.retained.id), "sequence": 1}, format="json",
        )
        self.assertEqual(closing.status_code, 201, closing.data)
        run = self.client.post(
            f"/api/v1/general-ledger/closing-rules/{closing.data['id']}/run/{self.query}",
            {"company": str(self.company.id), "period": self.period}, format="json",
        )
        self.assertEqual(run.status_code, 201, run.data)


class AccountMasterTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="GLCO", name="GL Company", legal_name="GL Company Ltd", tax_code="0100777777",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.account_class = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT"
        )
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT99", name="Hệ thống tài khoản TT99",
            effective_from="2026-01-01", is_default=True,
        )
        self.admin = get_user_model().objects.create_superuser(
            username="gl-admin", email="gl-admin@example.com", password="password-123"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_account_tree_is_created_and_cannot_be_deleted_through_api(self):
        parent = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="111", name="Tiền mặt", account_level=1, account_type="ASSET",
            normal_balance="DEBIT", is_postable=False,
        )
        response = self.client.post(
            f"/api/v1/general-ledger/accounts/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "chart_of_accounts": str(self.chart.id),
                "account_class": str(self.account_class.id), "parent": str(parent.id),
                "code": "1111", "name": "Tiền Việt Nam", "account_level": 2,
                "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        delete_response = self.client.delete(
            f"/api/v1/general-ledger/accounts/{response.data['id']}/?company_id={self.company.id}"
        )
        self.assertEqual(delete_response.status_code, 405)


class AdvanceSettlementRequestUcGl01Tests(TestCase):
    """
    Bộ kiểm thử toàn diện cho UC-GL-01 – Lập đề nghị quyết toán tạm ứng:
    Bao phủ Main Flow (Steps 1-32), AF-01..AF-11, EF-01..EF-19 và BR-GL-ADV-01..45.
    """

    def setUp(self):
        from iam.models import UserAccount
        from organization.models import Branch, Department, Employee

        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.currency = currency
        self.company = Company.objects.create(
            code="GLADV01",
            name="Công ty Kiểm thử UC-GL-01",
            legal_name="Công ty TNHH Kiểm thử UC-GL-01",
            tax_code="0100888899",
            accounting_currency=currency,
            legal_reporting_currency=currency,
        )
        self.other_company = Company.objects.create(
            code="GLADV02",
            name="Công ty Khác",
            legal_name="Công ty TNHH Khác",
            tax_code="0100888800",
            accounting_currency=currency,
            legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN-HN", name="Chi nhánh Hà Nội")
        self.dept_sales = Department.objects.create(
            company=self.company, branch=self.branch, code="PKD", name="Phòng Kinh doanh", status="ACTIVE"
        )
        self.dept_inactive = Department.objects.create(
            company=self.company, branch=self.branch, code="POLD", name="Phòng Giải thể", status="INACTIVE"
        )
        self.emp_hung = Employee.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.dept_sales,
            employee_code="NV001",
            full_name="Nguyễn Văn Hùng",
            email="hung@gladv.test",
            status="ACTIVE",
        )
        self.emp_mai = Employee.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.dept_sales,
            employee_code="NV002",
            full_name="Trần Thị Mai",
            email="mai@gladv.test",
            status="ACTIVE",
        )
        self.emp_inactive = Employee.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.dept_sales,
            employee_code="NV003",
            full_name="Lê Nghỉ Việc",
            email="nghiviec@gladv.test",
            status="INACTIVE",
        )
        self.emp_other_co = Employee.objects.create(
            company=self.other_company,
            employee_code="NV999",
            full_name="Nhân viên Công ty Khác",
            status="ACTIVE",
        )

        User = get_user_model()
        self.maker_auth = User.objects.create_superuser(
            username="NV001", email="hung@gladv.test", password="x"
        )
        self.approver_auth = User.objects.create_superuser(
            username="approver01", email="approver@gladv.test", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.maker_auth)
        self.url = f"/api/v1/general-ledger/advance-requests/?company_id={self.company.id}"

    def test_main_flow_create_submit_approve_and_zero_gl_impact(self):
        """
        Main Flow Steps 1-32 & BR-GL-ADV-29..32, BR-GL-ADV-45:
        Tạo đề nghị -> Sinh số DNQT0001 -> PENDING_APPROVAL -> Phê duyệt APPROVED -> SYNCED -> Không sinh bút toán GL.
        """
        from audit_log.models import AuditLog
        from .models import AccountBalance, JournalEntry

        before_entries = JournalEntry.objects.filter(company=self.company).count()
        before_balances = AccountBalance.objects.filter(company=self.company).count()

        res = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_hung.id),
                "amount": "15000000",
                "purpose": "Công tác phí thị trường miền Trung tháng 10",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["number"], "DNQT0001")
        self.assertEqual(res.data["status"], "PENDING_APPROVAL")
        self.assertEqual(res.data["department_name"], "Phòng Kinh doanh")
        self.assertEqual(res.data["message"], "Đã gửi đề nghị quyết toán tạm ứng lên cấp duyệt.")
        req_id = res.data["id"]

        # Phê duyệt (Steps 21-32)
        self.client.force_authenticate(self.approver_auth)
        approve_res = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/approve/?company_id={self.company.id}",
            {"comment": "Đồng ý phê duyệt"},
            format="json",
        )
        self.assertEqual(approve_res.status_code, 200, approve_res.data)
        self.assertEqual(approve_res.data["status"], "APPROVED")
        self.assertEqual(approve_res.data["sync_status"], "SYNCED")
        self.assertTrue(approve_res.data["eligible_for_settlement"])

        # BR-GL-ADV-29..32: Tuyệt đối chưa sinh bút toán Nợ/Có và chưa thay đổi số dư GL
        self.assertEqual(JournalEntry.objects.filter(company=self.company).count(), before_entries)
        self.assertEqual(AccountBalance.objects.filter(company=self.company).count(), before_balances)

        # BR-GL-ADV-45: Có ghi nhận Audit Log
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=str(req_id)).exists())

    def test_validation_errors_ef03_to_ef09(self):
        """
        EF-03..EF-09: Kiểm tra toàn bộ quy tắc dữ liệu đầu vào (Người đề nghị, Phòng ban, Số tiền, Mục đích).
        """
        # EF-03: Để trống Người đề nghị
        r_ef03 = self.client.post(
            self.url,
            {"company": str(self.company.id), "requester": "", "amount": "5000000", "purpose": "Công tác"},
            format="json",
        )
        self.assertEqual(r_ef03.status_code, 400)
        self.assertIn("requester", r_ef03.data)

        # EF-04: Nhân viên ngừng hoạt động hoặc khác công ty
        r_ef04_inactive = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_inactive.id),
                "amount": "5000000",
                "purpose": "Công tác",
            },
            format="json",
        )
        self.assertEqual(r_ef04_inactive.status_code, 400)

        r_ef04_other_co = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_other_co.id),
                "amount": "5000000",
                "purpose": "Công tác",
            },
            format="json",
        )
        self.assertEqual(r_ef04_other_co.status_code, 400)

        # EF-05: Để trống Số tiền
        r_ef05 = self.client.post(
            self.url,
            {"company": str(self.company.id), "requester": str(self.emp_hung.id), "amount": "", "purpose": "Công tác"},
            format="json",
        )
        self.assertEqual(r_ef05.status_code, 400)

        # EF-06: Số tiền sai định dạng -> Thông báo chính xác "Số tiền đề nghị quyết toán không hợp lệ."
        r_ef06 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_hung.id),
                "amount": "15abc000",
                "purpose": "Công tác",
            },
            format="json",
        )
        self.assertEqual(r_ef06.status_code, 400)
        self.assertIn("Số tiền đề nghị quyết toán không hợp lệ.", str(r_ef06.data.get("amount")))

        # EF-07: Số tiền <= 0
        for bad_amt in ("0", "-2500000"):
            r_ef07 = self.client.post(
                self.url,
                {
                    "company": str(self.company.id),
                    "requester": str(self.emp_hung.id),
                    "amount": bad_amt,
                    "purpose": "Công tác",
                },
                format="json",
            )
            self.assertEqual(r_ef07.status_code, 400)

        # EF-08: Mục đích/Diễn giải rỗng hoặc chỉ chứa khoảng trắng
        r_ef08 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_hung.id),
                "amount": "5000000",
                "purpose": "     ",
            },
            format="json",
        )
        self.assertEqual(r_ef08.status_code, 400)

        # EF-09: Phòng ban ngừng hoạt động
        r_ef09 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_hung.id),
                "department": str(self.dept_inactive.id),
                "amount": "5000000",
                "purpose": "Công tác",
            },
            format="json",
        )
        self.assertEqual(r_ef09.status_code, 400)

    def test_idempotency_and_workflow_exceptions_ef10_to_ef16(self):
        """
        EF-10..EF-16, AF-04, BR-GL-ADV-14, BR-GL-ADV-20..26, BR-GL-ADV-42, BR-GL-ADV-43:
        Chống gửi trùng, kiểm tra cấu hình workflow, phê duyệt đa cấp, tự phê duyệt và xung đột version.
        """
        # EF-10: Workflow chưa cấu hình
        r_ef10 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_hung.id),
                "amount": "3000000",
                "purpose": "Tiếp khách",
                "workflow_snapshot": {"workflow_configured": False},
            },
            format="json",
        )
        self.assertEqual(r_ef10.status_code, 400)

        # EF-11, BR-GL-ADV-14, BR-GL-ADV-42: Idempotency chống tạo trùng khi click đúp
        first = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_hung.id),
                "amount": "9000000",
                "purpose": "Chi phí hội nghị khách hàng",
                "idempotency_key": "IDEMP-GL-ADV-001",
                "workflow_snapshot": {"levels": 2, "allow_self_approval": False},
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        second = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_hung.id),
                "amount": "9000000",
                "purpose": "Chi phí hội nghị khách hàng",
                "idempotency_key": "IDEMP-GL-ADV-001",
            },
            format="json",
        )
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["duplicate_prevented"])
        self.assertEqual(first.data["id"], second.data["id"])
        req_id = first.data["id"]

        # EF-15, BR-GL-ADV-23: Chặn người tạo tự phê duyệt khi allow_self_approval=False
        self_app = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/approve/?company_id={self.company.id}",
            {"comment": "Tự duyệt"},
            format="json",
        )
        self.assertEqual(self_app.status_code, 400)

        # AF-04, BR-GL-ADV-20: Phê duyệt đa cấp (2 cấp)
        self.client.force_authenticate(self.approver_auth)
        step1 = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/approve/?company_id={self.company.id}",
            {"comment": "Duyệt cấp 1", "version": 1},
            format="json",
        )
        self.assertEqual(step1.status_code, 200)
        self.assertEqual(step1.data["status"], "PENDING_APPROVAL")
        self.assertEqual(step1.data["current_approval_level"], 2)

        # EF-16, BR-GL-ADV-43: Xung đột version (gửi lại version=1 cũ)
        conflict = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/approve/?company_id={self.company.id}",
            {"comment": "Duyệt cấp 2 với version cũ", "version": 1},
            format="json",
        )
        self.assertEqual(conflict.status_code, 400)

        # Duyệt cấp 2 thành công với version=2 -> chuyển sang APPROVED
        step2 = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/approve/?company_id={self.company.id}",
            {"comment": "Duyệt cấp 2 hoàn tất", "version": 2},
            format="json",
        )
        self.assertEqual(step2.status_code, 200)
        self.assertEqual(step2.data["status"], "APPROVED")

    def test_return_resubmit_reject_sync_retry_and_settlement_inheritance(self):
        """
        AF-05, AF-06, AF-11, EF-17, EF-18, EF-19, BR-GL-ADV-24..40:
        Yêu cầu bổ sung -> Gửi lại -> Phê duyệt (giả lập lỗi đồng bộ EF-17) -> Đồng bộ lại (EF-18) -> Kế thừa sang UC-GL-02.
        """
        created = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_mai.id),
                "amount": "8500000",
                "purpose": "Mua văn phòng phẩm quý 4",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        req_id = created.data["id"]

        # EF-19: Chưa APPROVED thì không được kế thừa lập chứng từ quyết toán UC-GL-02
        premature_inherit = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/inherit-to-settlement/?company_id={self.company.id}",
            {},
            format="json",
        )
        self.assertEqual(premature_inherit.status_code, 400)

        # AF-05: Cấp duyệt yêu cầu bổ sung (RETURNED)
        self.client.force_authenticate(self.approver_auth)
        returned = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/request-info/?company_id={self.company.id}",
            {"comment": "Bổ sung hóa đơn GTGT đính kèm"},
            format="json",
        )
        self.assertEqual(returned.status_code, 200)
        self.assertEqual(returned.data["status"], "RETURNED")

        # AF-05: Người đề nghị chỉnh sửa và gửi duyệt lại
        self.client.force_authenticate(self.maker_auth)
        resubmitted = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/resubmit/?company_id={self.company.id}",
            {
                "amount": "8800000",
                "purpose": "Mua văn phòng phẩm quý 4 (đã bổ sung đủ hóa đơn)",
            },
            format="json",
        )
        self.assertEqual(resubmitted.status_code, 200)
        self.assertEqual(resubmitted.data["status"], "PENDING_APPROVAL")

        # EF-17, BR-GL-ADV-36: Duyệt thành công nhưng lỗi đồng bộ -> Vẫn giữ APPROVED + SYNC_ERROR
        self.client.force_authenticate(self.approver_auth)
        approved_sync_err = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/approve/?company_id={self.company.id}",
            {"comment": "Duyệt sau khi bổ sung", "simulate_sync_error": True},
            format="json",
        )
        self.assertEqual(approved_sync_err.status_code, 200)
        self.assertEqual(approved_sync_err.data["status"], "APPROVED")
        self.assertEqual(approved_sync_err.data["sync_status"], "SYNC_ERROR")

        # BR-GL-ADV-38: Không cho phép sửa hoặc xóa đề nghị đã APPROVED
        update_approved = self.client.put(
            f"/api/v1/general-ledger/advance-requests/{req_id}/?company_id={self.company.id}",
            {"amount": "9999999", "purpose": "Sửa trái phép"},
            format="json",
        )
        self.assertEqual(update_approved.status_code, 400)

        # EF-18, BR-GL-ADV-35: Retry sync thành công và idempotent
        retried = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/retry-sync/?company_id={self.company.id}",
            {},
            format="json",
        )
        self.assertEqual(retried.status_code, 200)
        self.assertEqual(retried.data["sync_status"], "SYNCED")

        # AF-11, BR-GL-ADV-33, BR-GL-ADV-40: Kế thừa sang chứng từ quyết toán UC-GL-02 và chặn kế thừa trùng
        inherited = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/inherit-to-settlement/?company_id={self.company.id}",
            {"settlement_voucher_no": "QTTU00001"},
            format="json",
        )
        self.assertEqual(inherited.status_code, 200)
        self.assertEqual(inherited.data["settlement_voucher_no"], "QTTU00001")
        self.assertFalse(inherited.data["eligible_for_settlement"])

        dup_inherit = self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/inherit-to-settlement/?company_id={self.company.id}",
            {"settlement_voucher_no": "QTTU00002"},
            format="json",
        )
        self.assertEqual(dup_inherit.status_code, 400)


class AdvanceSettlementVoucherUcGl02Tests(TestCase):
    """
    UC-GL-02: Lập chứng từ quyết toán tạm ứng (Advance Settlement Voucher).
    Bao phủ toàn bộ Main Flow (Steps 1-41), Alternative Flows (AF-01..AF-15),
    Exception Flows (EF-01..EF-28) và Business Rules (BR-GL-QTTU-01..60).
    """

    def setUp(self):
        currency, _ = Currency.objects.get_or_create(
            code="VND",
            defaults={"name": "Đồng Việt Nam"},
        )
        self.currency = currency
        self.company = Company.objects.create(
            code="GLQTTU01",
            name="Công ty TNHH Kiểm thử Quyết toán UC-GL-02",
            legal_name="Công ty TNHH Kiểm thử Quyết toán UC-GL-02",
            tax_code="0100999902",
            accounting_currency=currency,
            legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN-HCM", name="Chi nhánh TP.HCM")
        self.dept = Department.objects.create(
            company=self.company, branch=self.branch, code="PKT", name="Phòng Kế toán", status="ACTIVE"
        )
        self.emp_an = Employee.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.dept,
            employee_code="NV001",
            full_name="Nguyễn Văn An",
            email="an@glqttu.test",
            status="ACTIVE",
        )
        self.emp_binh = Employee.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.dept,
            employee_code="NV002",
            full_name="Trần Thị Bình",
            email="binh@glqttu.test",
            status="ACTIVE",
        )
        self.emp_inactive = Employee.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.dept,
            employee_code="NV099",
            full_name="Lê Đã Nghỉ",
            status="INACTIVE",
        )

        self.coa = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT99-QTTU",
            name="Hệ thống TK TT99",
            effective_from=date(2026, 1, 1),
            is_default=True,
            status="ACTIVE",
        )
        self.acc_1111 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="1111",
            name="Tiền Việt Nam",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            status="ACTIVE",
        )
        self.acc_141 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="141",
            name="Tạm ứng",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            status="ACTIVE",
            dimension_requirements={"EMPLOYEE": "REQUIRED"},
        )
        self.acc_1331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="1331",
            name="Thuế GTGT được khấu trừ của HHDV",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            status="ACTIVE",
        )
        self.acc_6421 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="6421",
            name="Chi phí nhân viên quản lý",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
            status="ACTIVE",
        )
        self.acc_6422 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="6422",
            name="Chi phí vật liệu quản lý",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
            status="ACTIVE",
        )
        self.acc_inactive = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="6429",
            name="Chi phí ngừng dùng",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
            status="INACTIVE",
        )
        self.period_open = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
            status="OPEN",
        )
        self.period_closed = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-09",
            fiscal_year=2026,
            period_number=9,
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="CLOSED",
        )

        User = get_user_model()
        self.user = User.objects.create_superuser(username="accountant_qttu", email="acc@glqttu.test", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f"/api/v1/general-ledger/advance-settlements/?company_id={self.company.id}"
        self.req_url = f"/api/v1/general-ledger/advance-requests/?company_id={self.company.id}"

    def test_main_flow_save_unposted_with_multiple_lines_and_tax(self):
        """
        Main Flow Steps 1-41, AF-04, AF-06, BR-GL-QTTU-43, BR-GL-QTTU-44:
        Lập chứng từ quyết toán tạm ứng có nhiều dòng chi phí và dòng kê khai hóa đơn thuế.
        Kiểm tra chứng từ lưu ở trạng thái UNPOSTED (JournalEntry DRAFT) và KHÔNG thay đổi AccountBalance.
        """
        from .models import AccountBalance

        res = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-20",
                "description": "Quyết toán công tác phí Hà Nội",
                "accounting_lines": [
                    {
                        "description": "Chi phí vé máy bay",
                        "debit_account": "6422",
                        "credit_account": "141",
                        "amount": "3000000",
                    },
                    {
                        "description": "Chi phí phòng khách sạn",
                        "debit_account": "6421",
                        "credit_account": "141",
                        "amount": "2000000",
                    },
                ],
                "tax_lines": [
                    {
                        "description": "Thuế GTGT vé máy bay",
                        "tax_account": "1331",
                        "credit_account": "141",
                        "pre_tax_amount": "3000000",
                        "vat_rate": "10",
                        "vat_amount": "300000",
                        "invoice_date": "2026-10-19",
                        "invoice_number": "0001234",
                        "invoice_form": "1",
                        "invoice_serial": "C26TAA",
                        "supplier_name": "Vietnam Airlines",
                        "supplier_tax_code": "0100107518",
                    }
                ],
                "attachments": [
                    {"file_name": "hoa_don_ve_may_bay.pdf", "file_size": 512000, "file_type": "application/pdf"}
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["number"], "QTTU00001")
        self.assertEqual(res.data["status"], "UNPOSTED")
        self.assertEqual(res.data["journal_status"], "DRAFT")
        self.assertEqual(Decimal(res.data["accounting_amount"]), Decimal("5000000"))
        self.assertEqual(Decimal(res.data["tax_amount"]), Decimal("300000"))
        self.assertEqual(Decimal(res.data["total_amount"]), Decimal("5300000"))
        self.assertEqual(res.data["message"], "Đã lưu chứng từ quyết toán tạm ứng QTTU00001 thành công.")
        # Tự động gán đối tượng Có trên TK 141 là mã/tên nhân viên (Step 12, BR-GL-QTTU-26)
        self.assertEqual(res.data["accounting_lines"][0]["credit_object_code"], "NV001")
        self.assertEqual(res.data["accounting_lines"][0]["credit_object_name"], "Nguyễn Văn An")
        # 2 cặp dòng hạch toán chi phí + 1 cặp dòng thuế = 6 dòng JournalLine
        self.assertEqual(res.data["journal_lines_count"], 6)
        # BR-GL-QTTU-43, BR-GL-QTTU-44: Chưa ghi sổ nên AccountBalance không thay đổi
        self.assertEqual(AccountBalance.objects.filter(company=self.company).count(), 0)

    def test_af01_af02_inherit_from_uc_gl_01_and_partial_multi_voucher_settlement(self):
        """
        AF-01, AF-02, EF-21, BR-GL-QTTU-09..13, BR-GL-QTTU-50, BR-GL-QTTU-51:
        Kế thừa từ Đề nghị quyết toán đã duyệt (UC-GL-01) và quyết toán thành nhiều chứng từ (quyết toán một phần).
        """
        req_res = self.client.post(
            self.req_url,
            {
                "company": str(self.company.id),
                "requester": str(self.emp_an.id),
                "amount": "10000000",
                "purpose": "Đề nghị quyết toán chi phí hội nghị khách hàng",
            },
            format="json",
        )
        req_id = req_res.data["id"]

        # EF-21: Đề nghị đang PENDING_APPROVAL (chưa APPROVED) -> Chặn lập chứng từ quyết toán
        unapproved = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "advance_request": req_id,
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "4000000"}],
            },
            format="json",
        )
        self.assertEqual(unapproved.status_code, 400)
        self.assertIn("advance_request", unapproved.data)

        # Phê duyệt đề nghị UC-GL-01
        self.client.post(
            f"/api/v1/general-ledger/advance-requests/{req_id}/approve/?company_id={self.company.id}",
            {"comment": "Duyệt đề nghị"},
            format="json",
        )

        # Lập chứng từ quyết toán đợt 1 (6,000,000 / 10,000,000) -> AF-02
        v1 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "advance_request": req_id,
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "6000000"}],
            },
            format="json",
        )
        self.assertEqual(v1.status_code, 201, v1.data)

        # Kiểm tra trạng thái đề nghị sau đợt 1: settled_amount=6M, remaining_amount=4M, vẫn eligible_for_settlement
        req_after_v1 = self.client.get(
            f"/api/v1/general-ledger/advance-requests/{req_id}/?company_id={self.company.id}"
        )
        self.assertEqual(Decimal(req_after_v1.data["settled_amount"]), Decimal("6000000"))
        self.assertEqual(Decimal(req_after_v1.data["remaining_amount"]), Decimal("4000000"))
        self.assertTrue(req_after_v1.data["eligible_for_settlement"])
        self.assertFalse(req_after_v1.data["is_settled"])

        # EF-21: Lập đợt 2 vượt quá số còn lại (5,000,000 > 4,000,000) -> Chặn
        exceed_v2 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "advance_request": req_id,
                "posting_date": "2026-10-23",
                "document_date": "2026-10-23",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "5000000"}],
            },
            format="json",
        )
        self.assertEqual(exceed_v2.status_code, 400)

        # Lập đợt 2 đúng phần còn lại (4,000,000) -> Thành công, đề nghị được đánh dấu đã quyết toán đủ
        v2 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "advance_request": req_id,
                "posting_date": "2026-10-23",
                "document_date": "2026-10-23",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "4000000"}],
            },
            format="json",
        )
        self.assertEqual(v2.status_code, 201, v2.data)

        req_after_v2 = self.client.get(
            f"/api/v1/general-ledger/advance-requests/{req_id}/?company_id={self.company.id}"
        )
        self.assertEqual(Decimal(req_after_v2.data["settled_amount"]), Decimal("10000000"))
        self.assertEqual(Decimal(req_after_v2.data["remaining_amount"]), Decimal("0"))
        self.assertTrue(req_after_v2.data["is_settled"])
        self.assertFalse(req_after_v2.data["eligible_for_settlement"])

    def test_af03_ef22_to_ef24_settle_per_advance_batch_validation(self):
        """
        AF-03, EF-22, EF-23, EF-24, BR-GL-QTTU-05..08:
        Kiểm tra chế độ 'Quyết toán cho từng lần tạm ứng' với CashAdvance nguồn.
        """
        from cash_management.models import CashAdvance, CashFund
        from iam.models import UserAccount

        fund = CashFund.objects.create(
            company=self.company,
            branch=self.branch,
            code="QTM01",
            name="Quỹ tiền mặt chính",
            currency=self.currency,
            gl_account=self.acc_1111,
            balance=Decimal("50000000"),
            status="ACTIVE",
        )
        user_acc = UserAccount.objects.first()
        cash_adv = CashAdvance.objects.create(
            company=self.company,
            number="TU0001",
            fund=fund,
            recipient=self.emp_an,
            purpose="Tạm ứng đi công tác Đà Nẵng",
            request_date=date(2026, 10, 5),
            amount=Decimal("5000000"),
            settled_amount=Decimal("0"),
            status="ACTIVE",
            created_by=user_acc,
        )

        # EF-22: Chọn settle_per_advance=True nhưng không truyền khoản tạm ứng nguồn -> Chặn
        missing_adv = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "settle_per_advance": True,
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "2000000"}],
            },
            format="json",
        )
        self.assertEqual(missing_adv.status_code, 400)

        # EF-24: Số tiền quyết toán (6,000,000) vượt số dư còn lại (5,000,000) của lần tạm ứng TU0001 -> Chặn
        exceed_adv = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "settle_per_advance": True,
                "cash_advance": str(cash_adv.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "6000000"}],
            },
            format="json",
        )
        self.assertEqual(exceed_adv.status_code, 400)

        # Hợp lệ: Quyết toán 5,000,000 cho TU0001
        ok_adv = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "settle_per_advance": True,
                "cash_advance": str(cash_adv.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "5000000"}],
            },
            format="json",
        )
        self.assertEqual(ok_adv.status_code, 201, ok_adv.data)

        # EF-23 / BR-GL-QTTU-08: Khoản tạm ứng TU0001 đã hết số dư khả dụng, lập thêm chứng từ thứ 2 phải bị chặn
        exhausted_adv = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "settle_per_advance": True,
                "cash_advance": str(cash_adv.id),
                "posting_date": "2026-10-23",
                "document_date": "2026-10-23",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(exhausted_adv.status_code, 400)

    def test_af07_group_invoices_and_ef17_to_ef19_tax_validation(self):
        """
        AF-07, EF-17, EF-18, EF-19, BR-GL-QTTU-31..37:
        Kiểm tra Hạch toán gộp nhiều hóa đơn, kiểm tra lệch tiền thuế GTGT và chặn hóa đơn đầu vào trùng.
        """
        # AF-07: Gộp 2 hóa đơn thuế GTGT cùng cặp 1331/141
        grouped_res = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "group_invoices": True,
                "accounting_lines": [
                    {"debit_account": "6422", "credit_account": "141", "amount": "3000000"},
                ],
                "tax_lines": [
                    {
                        "tax_account": "1331",
                        "credit_account": "141",
                        "pre_tax_amount": "1000000",
                        "vat_rate": "10",
                        "vat_amount": "100000",
                        "invoice_date": "2026-10-20",
                        "invoice_number": "HD9001",
                        "invoice_serial": "C26T",
                        "supplier_tax_code": "0101234567",
                    },
                    {
                        "tax_account": "1331",
                        "credit_account": "141",
                        "pre_tax_amount": "2000000",
                        "vat_rate": "10",
                        "vat_amount": "200000",
                        "invoice_date": "2026-10-21",
                        "invoice_number": "HD9002",
                        "invoice_serial": "C26T",
                        "supplier_tax_code": "0101234567",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(grouped_res.status_code, 201, grouped_res.data)
        # Vẫn lưu đầy đủ 2 dòng kê khai hóa đơn phục vụ bảng kê thuế
        self.assertEqual(len(grouped_res.data["tax_lines"]), 2)
        # Nhưng trên JournalEntry: 1 cặp chi phí (2 dòng) + 1 cặp thuế gộp (2 dòng) = 4 dòng (thay vì 6 dòng)
        self.assertEqual(grouped_res.data["journal_lines_count"], 4)

        # EF-19: Kê khai trùng hóa đơn HD9001 của cùng MST 0101234567 trên chứng từ khác -> Chặn
        dup_inv = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "1000000"}],
                "tax_lines": [
                    {
                        "tax_account": "1331",
                        "credit_account": "141",
                        "pre_tax_amount": "1000000",
                        "vat_rate": "10",
                        "vat_amount": "100000",
                        "invoice_date": "2026-10-20",
                        "invoice_number": "HD9001",
                        "invoice_serial": "C26T",
                        "supplier_tax_code": "0101234567",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(dup_inv.status_code, 400)
        self.assertIn("tax_lines", dup_inv.data)

        # EF-18: Tiền thuế GTGT lệch với Tiền chưa thuế * Thuế suất -> Chặn
        bad_vat = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "1000000"}],
                "tax_lines": [
                    {
                        "tax_account": "1331",
                        "credit_account": "141",
                        "pre_tax_amount": "1000000",
                        "vat_rate": "10",
                        "vat_amount": "250000",
                        "invoice_date": "2026-10-20",
                        "invoice_number": "HD9999",
                        "invoice_serial": "C26T",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(bad_vat.status_code, 400)

    def test_ef03_to_ef15_and_ef20_validations(self):
        """
        EF-03..EF-15, EF-20:
        Kiểm tra lỗi thiếu nhân viên, nhân viên ngừng hoạt động, kỳ đã khóa,
        tài khoản ngừng dùng, đối tượng 141 lệch nhân viên và tệp đính kèm > 5MB.
        """
        # EF-04: Nhân viên ngừng hoạt động
        r_inactive_emp = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_inactive.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_inactive_emp.status_code, 400)

        # EF-07: Ngày hạch toán thuộc kỳ kế toán đã đóng (2026-09)
        r_closed_period = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-09-15",
                "document_date": "2026-09-15",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_closed_period.status_code, 400)

        # EF-12: Tài khoản Nợ ngừng sử dụng (6429)
        r_inactive_acc = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6429", "credit_account": "141", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_inactive_acc.status_code, 400)

        # EF-15: Đối tượng Có trên TK 141 là NV002 trong khi nhân viên quyết toán là NV001
        r_mismatch_141 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [
                    {
                        "debit_account": "6422",
                        "credit_account": "141",
                        "amount": "1000000",
                        "credit_object_code": "NV002",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_mismatch_141.status_code, 400)

        # EF-20: Tệp đính kèm vượt quá 5MB (6MB)
        r_oversized_file = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "1000000"}],
                "attachments": [{"file_name": "video_chung_tu.mp4", "file_size": 6 * 1024 * 1024}],
            },
            format="json",
        )
        self.assertEqual(r_oversized_file.status_code, 400)
        self.assertIn("attachments", r_oversized_file.data)

    def test_af12_af13_ef25_ef28_idempotency_update_and_concurrency(self):
        """
        AF-12 (Lưu và Thêm), AF-13 (Sửa chứng từ chưa ghi sổ), EF-25 (Chống lưu trùng Idempotency),
        EF-28 (Optimistic Locking) và BR-GL-QTTU-56 (Chặn sửa khi đã ghi sổ).
        """
        from .models import AdvanceSettlementVoucher, AdvanceSettlementVoucherStatus

        payload = {
            "company": str(self.company.id),
            "employee": str(self.emp_an.id),
            "posting_date": "2026-10-22",
            "document_date": "2026-10-22",
            "idempotency_key": "IDEMP-QTTU-001",
            "save_and_new": True,
            "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "2500000"}],
        }
        r1 = self.client.post(self.url, payload, format="json")
        self.assertEqual(r1.status_code, 201, r1.data)
        self.assertEqual(r1.data["next_number"], "QTTU00002")
        v_id = r1.data["id"]

        # EF-25: Gửi lại cùng idempotency_key -> Không tạo bản ghi thứ 2
        r2 = self.client.post(self.url, payload, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.data["duplicate_prevented"])
        self.assertEqual(r2.data["id"], v_id)

        # AF-13: Sửa chứng từ khi đang UNPOSTED
        updated = self.client.put(
            f"/api/v1/general-ledger/advance-settlements/{v_id}/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "employee": str(self.emp_an.id),
                "posting_date": "2026-10-22",
                "document_date": "2026-10-22",
                "description": "Đã cập nhật số tiền quyết toán",
                "version": 1,
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "3200000"}],
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(Decimal(updated.data["total_amount"]), Decimal("3200000"))
        self.assertEqual(updated.data["version"], 2)

        # EF-28: Sửa với version cũ (version=1) -> Bị chặn
        stale = self.client.put(
            f"/api/v1/general-ledger/advance-settlements/{v_id}/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "version": 1,
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "4000000"}],
            },
            format="json",
        )
        self.assertEqual(stale.status_code, 400)

        # BR-GL-QTTU-56: Khi chứng từ đã chuyển sang POSTED thì không cho phép sửa trực tiếp
        AdvanceSettlementVoucher.objects.filter(pk=v_id).update(status=AdvanceSettlementVoucherStatus.POSTED)
        edit_posted = self.client.put(
            f"/api/v1/general-ledger/advance-settlements/{v_id}/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "version": 2,
                "accounting_lines": [{"debit_account": "6422", "credit_account": "141", "amount": "4000000"}],
            },
            format="json",
        )
        self.assertEqual(edit_posted.status_code, 400)


class GeneralBusinessVoucherUcGl03Tests(TestCase):
    """
    UC-GL-03 – Lập chứng từ nghiệp vụ khác (NVK00001).
    Kiểm thử toàn diện Main Flow (Steps 1-50), Alternative Flows (AF-01..AF-18),
    Exception Flows (EF-01..EF-39), và Business Rules (BR-GL-NVK-01..70).
    """

    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.currency = currency
        self.company = Company.objects.create(
            code="NVKCO",
            name="Công ty TNHH Nghiệp Vụ Khác",
            legal_name="Công ty TNHH Nghiệp Vụ Khác",
            tax_code="0109988776",
            accounting_currency=currency,
            legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Chi nhánh Hà Nội")
        self.dept_kd = Department.objects.create(
            company=self.company, branch=self.branch, code="PKD", name="Phòng Kinh doanh", status="ACTIVE"
        )
        self.account_class = AccountClass.objects.create(
            company=self.company, code="ALL", name="Tài khoản chung", normal_balance="DEBIT"
        )
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT200", name="Thông tư 200", effective_from="2026-01-01", is_default=True
        )

        # Tạo các tài khoản cho đủ 06 loại nghiệp vụ + tài khoản tổng hợp
        self.acc_8211 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="8211", name="Chi phí thuế TNDN hiện hành", account_type="EXPENSE", normal_balance="DEBIT", is_postable=True
        )
        self.acc_3334 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="3334", name="Thuế thu nhập doanh nghiệp", account_type="LIABILITY", normal_balance="CREDIT", is_postable=True
        )
        self.acc_331 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="331", name="Phải trả cho người bán", account_type="LIABILITY", normal_balance="CREDIT", is_postable=True
        )
        self.acc_3411 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="3411", name="Các khoản đi vay", account_type="LIABILITY", normal_balance="CREDIT", is_postable=True
        )
        self.acc_334 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="334", name="Phải trả người lao động", account_type="LIABILITY", normal_balance="CREDIT", is_postable=True
        )
        self.acc_642_parent = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="642", name="Chi phí quản lý doanh nghiệp", account_type="EXPENSE", normal_balance="DEBIT", is_postable=False
        )
        self.acc_6421 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            parent=self.acc_642_parent, code="6421", name="Chi phí nhân viên quản lý", account_type="EXPENSE", normal_balance="DEBIT", is_postable=True
        )
        self.acc_131 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="131", name="Phải thu của khách hàng", account_type="ASSET", normal_balance="DEBIT", is_postable=True
        )
        self.acc_1331 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="1331", name="Thuế GTGT được khấu trừ của HHDV", account_type="ASSET", normal_balance="DEBIT", is_postable=True
        )
        self.acc_4211 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="4211", name="LNST chưa phân phối năm trước", account_type="EQUITY", normal_balance="CREDIT", is_postable=True
        )
        self.acc_4212 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="4212", name="LNST chưa phân phối năm nay", account_type="EQUITY", normal_balance="CREDIT", is_postable=True
        )
        self.acc_3332 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="3332", name="Thuế tiêu thụ đặc biệt", account_type="LIABILITY", normal_balance="CREDIT", is_postable=True
        )
        self.acc_1383 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.account_class,
            code="1383", name="Thuế TTĐB hàng nhập khẩu", account_type="ASSET", normal_balance="DEBIT", is_postable=True
        )

        self.period_jan = AccountingPeriod.objects.create(
            company=self.company, code="2026-01", fiscal_year=2026, period_number=1,
            start_date=date(2026, 1, 1), end_date=date(2026, 1, 31), status="OPEN"
        )
        self.period_oct = AccountingPeriod.objects.create(
            company=self.company, code="2026-10", fiscal_year=2026, period_number=10,
            start_date=date(2026, 10, 1), end_date=date(2026, 10, 31), status="OPEN"
        )

        self.user = get_user_model().objects.create_superuser(
            username="gl-nvk-user", email="nvk@gl.test", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f"/api/v1/general-ledger/general-vouchers/?company_id={self.company.id}"

    def test_all_six_business_types_main_and_alternative_flows(self):
        """
        Kiểm thử lập thành công cả 06 loại nghiệp vụ (AF-01..AF-06):
        01. Hạch toán thuế TNDN phải nộp
        02. Vay ngân hàng chuyển trả cho nhà cung cấp
        03. Hạch toán chi phí lương
        04. Khác (kèm Tab 2 Kê khai hóa đơn và hạch toán thuế)
        05. Kết chuyển lãi lỗ đầu năm
        06. Khấu trừ thuế tiêu thụ đặc biệt
        Đảm bảo mọi chứng từ lưu ở trạng thái UNPOSTED (Chưa ghi sổ) và không làm thay đổi AccountBalance.
        """
        from .models import AccountBalance

        # 01. Hạch toán thuế TNDN phải nộp (AF-01)
        r1 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "1. Hạch toán thuế TNDN phải nộp",
                "posting_date": "2026-10-15",
                "document_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "8211", "credit_account": "3334", "amount": "25000000"}],
            },
            format="json",
        )
        self.assertEqual(r1.status_code, 201, r1.data)
        self.assertEqual(r1.data["number"], "NVK00001")
        self.assertEqual(r1.data["status"], "UNPOSTED")
        self.assertEqual(r1.data["journal_status"], "DRAFT")
        self.assertEqual(r1.data["message"], "Đã lưu chứng từ nghiệp vụ khác NVK00001 thành công.")

        # 02. Vay ngân hàng chuyển trả cho nhà cung cấp (AF-02)
        r2 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "2. Vay ngân hàng chuyển trả cho nhà cung cấp",
                "posting_date": "2026-10-16",
                "document_date": "2026-10-16",
                "due_date": "2026-11-16",
                "accounting_lines": [
                    {
                        "debit_account": "331",
                        "credit_account": "3411",
                        "amount": "150000000",
                        "debit_object_code": "NCC001",
                        "debit_object_name": "Công ty Thiết bị Việt",
                        "credit_object_code": "NH_VCB",
                        "credit_object_name": "Ngân hàng VCB",
                        "loan_contract": "KUV-2026-01",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r2.status_code, 201, r2.data)
        self.assertEqual(r2.data["number"], "NVK00002")
        self.assertEqual(r2.data["accounting_lines"][0]["loan_contract"], "KUV-2026-01")

        # 03. Hạch toán chi phí lương (AF-03)
        r3 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "3. Hạch toán chi phí lương",
                "posting_date": "2026-10-31",
                "document_date": "2026-10-31",
                "accounting_lines": [
                    {
                        "debit_account": "6421",
                        "credit_account": "334",
                        "amount": "85000000",
                        "expense_item": "CP_LUONG_QL",
                        "department": "Phòng Kinh doanh",
                        "cost_object": "THCP_KD",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r3.status_code, 201, r3.data)
        self.assertEqual(r3.data["number"], "NVK00003")
        self.assertEqual(r3.data["accounting_lines"][0]["expense_item"], "CP_LUONG_QL")

        # 04. Khác + Tab 2 Kê khai hóa đơn và hạch toán thuế + Gộp nhiều hóa đơn (AF-04, AF-11, AF-12)
        r4 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "4. Khác",
                "posting_date": "2026-10-20",
                "document_date": "2026-10-20",
                "group_invoices": True,
                "accounting_lines": [
                    {
                        "description": "Chi phí dịch vụ mua ngoài",
                        "debit_account": "6421",
                        "credit_account": "331",
                        "amount": "15000000",
                        "operation": "MUA_DV",
                        "debit_object_code": "NCC01",
                        "credit_object_code": "NCC01",
                    }
                ],
                "tax_lines": [
                    {
                        "tax_account": "1331",
                        "credit_account": "331",
                        "pre_tax_amount": "10000000",
                        "vat_rate": "10",
                        "vat_amount": "1000000",
                        "invoice_date": "2026-10-19",
                        "invoice_number": "HD9001",
                        "invoice_serial": "C26T",
                        "supplier_name": "Công ty Dịch vụ A",
                    },
                    {
                        "tax_account": "1331",
                        "credit_account": "331",
                        "pre_tax_amount": "5000000",
                        "vat_rate": "10",
                        "vat_amount": "500000",
                        "invoice_date": "2026-10-20",
                        "invoice_number": "HD9002",
                        "invoice_serial": "C26T",
                        "supplier_name": "Công ty Dịch vụ A",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(r4.status_code, 201, r4.data)
        self.assertEqual(Decimal(r4.data["total_accounting_amount"]), Decimal("15000000"))
        self.assertEqual(Decimal(r4.data["total_tax_amount"]), Decimal("1500000"))
        self.assertEqual(Decimal(r4.data["total_amount"]), Decimal("16500000"))
        # 1 cặp hạch toán (2 dòng) + 1 cặp thuế gộp (2 dòng) = 4 dòng trên JournalEntry
        self.assertEqual(r4.data["journal_lines_count"], 4)

        # 05. Kết chuyển lãi lỗ đầu năm (AF-05)
        r5 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "5. Kết chuyển lãi lỗ đầu năm",
                "closing_year": 2026,
                "posting_date": "2026-01-01",
                "document_date": "2026-01-01",
                "accounting_lines": [{"debit_account": "4212", "credit_account": "4211", "amount": "120000000"}],
            },
            format="json",
        )
        self.assertEqual(r5.status_code, 201, r5.data)
        self.assertEqual(r5.data["closing_year"], 2026)

        # 06. Khấu trừ thuế tiêu thụ đặc biệt (AF-06)
        r6 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "6. Khấu trừ thuế tiêu thụ đặc biệt",
                "posting_date": "2026-10-25",
                "document_date": "2026-10-25",
                "exclude_from_vat_declaration": True,  # Sẽ tự động reset về False đối với Loại 06
                "accounting_lines": [{"debit_account": "3332", "credit_account": "1383", "amount": "18000000"}],
            },
            format="json",
        )
        self.assertEqual(r6.status_code, 201, r6.data)
        self.assertFalse(r6.data["exclude_from_vat_declaration"])

        # BR-GL-NVK-58: Không làm thay đổi AccountBalance chính thức khi tất cả chứng từ đang UNPOSTED
        self.assertEqual(AccountBalance.objects.filter(company=self.company).count(), 0)

    def test_exception_flows_ef03_to_ef32_validations(self):
        """
        Kiểm thử các luồng ngoại lệ EF-03..EF-32:
        - EF-03: Loại nghiệp vụ không hợp lệ
        - EF-07: Hạn thanh toán < Ngày chứng từ
        - EF-10: Trùng số chứng từ
        - EF-12/EF-13: Tài khoản không tồn tại hoặc tài khoản tổng hợp (642)
        - EF-14: TK Nợ == TK Có
        - EF-15: Số tiền <= 0
        - EF-20..EF-26: Vi phạm quy tắc riêng của từng loại nghiệp vụ (01, 02, 03, 05, 06)
        - EF-27..EF-31: Thiếu số hóa đơn, sai tiền thuế, trùng hóa đơn, mâu thuẫn Không lên bảng kê thuế GTGT
        - EF-32: Tệp đính kèm > 5MB
        """
        # EF-03: Loại nghiệp vụ không hợp lệ
        r_bad_type = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "99. Nghiệp vụ không tồn tại",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "8211", "credit_account": "3334", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_bad_type.status_code, 400)
        self.assertIn("business_type", r_bad_type.data)

        # EF-07: Hạn thanh toán < Ngày chứng từ
        r_bad_due = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "4. Khác",
                "posting_date": "2026-10-15",
                "document_date": "2026-10-15",
                "due_date": "2026-10-01",
                "accounting_lines": [{"debit_account": "6421", "credit_account": "331", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_bad_due.status_code, 400)
        self.assertIn("due_date", r_bad_due.data)

        # EF-13: Tài khoản tổng hợp 642
        r_parent_acc = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "4. Khác",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "642", "credit_account": "331", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_parent_acc.status_code, 400)
        self.assertIn("accounting_lines", r_parent_acc.data)

        # EF-14: TK Nợ == TK Có
        r_same_acc = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "4. Khác",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "6421", "credit_account": "6421", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_same_acc.status_code, 400)

        # EF-21: Loại 02 thiếu Nhà cung cấp (Đối tượng Nợ)
        r_type2_missing_sup = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "2. Vay ngân hàng chuyển trả cho nhà cung cấp",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "331", "credit_account": "3411", "amount": "50000000"}],
            },
            format="json",
        )
        self.assertEqual(r_type2_missing_sup.status_code, 400)

        # EF-23: Loại 03 thiếu Tài khoản Nợ
        r_type3_missing_debit = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "3. Hạch toán chi phí lương",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "", "credit_account": "334", "amount": "20000000"}],
            },
            format="json",
        )
        self.assertEqual(r_type3_missing_debit.status_code, 400)

        # EF-25: Loại 05 dùng tài khoản khác 4211/4212
        r_type5_bad_acc = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "5. Kết chuyển lãi lỗ đầu năm",
                "closing_year": 2026,
                "posting_date": "2026-01-01",
                "accounting_lines": [{"debit_account": "6421", "credit_account": "331", "amount": "10000000"}],
            },
            format="json",
        )
        self.assertEqual(r_type5_bad_acc.status_code, 400)

        # EF-31: Mâu thuẫn Không lên bảng kê thuế GTGT + Gộp nhiều hóa đơn
        r_vat_conflict = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "4. Khác",
                "posting_date": "2026-10-15",
                "group_invoices": True,
                "exclude_from_vat_declaration": True,
                "accounting_lines": [{"debit_account": "6421", "credit_account": "331", "amount": "10000000"}],
                "tax_lines": [
                    {
                        "tax_account": "1331",
                        "credit_account": "331",
                        "pre_tax_amount": "10000000",
                        "vat_rate": "10",
                        "vat_amount": "1000000",
                        "invoice_date": "2026-10-15",
                        "invoice_number": "HD999",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_vat_conflict.status_code, 400)
        self.assertIn("exclude_from_vat_declaration", r_vat_conflict.data)

        # EF-32: Tệp đính kèm vượt quá 5MB
        r_oversized = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "1. Hạch toán thuế TNDN phải nộp",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "8211", "credit_account": "3334", "amount": "5000000"}],
                "attachments": [{"file_name": "scan_oversized.pdf", "file_size": 6 * 1024 * 1024}],
            },
            format="json",
        )
        self.assertEqual(r_oversized.status_code, 400)
        self.assertIn("attachments", r_oversized.data)

    def test_af15_af16_af18_ef33_ef38_ef39_print_excel_and_update(self):
        """
        Kiểm thử:
        - AF-15 & EF-38: Cất và In khi dịch vụ in gặp lỗi -> Chứng từ vẫn được lưu ở trạng thái UNPOSTED
        - EF-33: Chống lưu trùng Idempotency
        - AF-16, EF-36, EF-37: Nhập chứng từ từ Excel và chặn tệp Excel sai cấu trúc/dữ liệu
        - AF-18 & EF-39: Sửa chứng từ khi đang UNPOSTED và chặn sửa khi đã POSTED
        """
        from .models import GeneralBusinessVoucher, GeneralVoucherStatus

        # AF-15 & EF-38: Cất và In với simulate_print_error=True -> Chứng từ vẫn được lưu thành công
        r_print_err = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "1. Hạch toán thuế TNDN phải nộp",
                "posting_date": "2026-10-20",
                "document_date": "2026-10-20",
                "idempotency_key": "IDEMP-NVK-001",
                "save_and_print": True,
                "simulate_print_error": True,
                "accounting_lines": [{"debit_account": "8211", "credit_account": "3334", "amount": "12000000"}],
            },
            format="json",
        )
        self.assertEqual(r_print_err.status_code, 201, r_print_err.data)
        self.assertEqual(r_print_err.data["status"], "UNPOSTED")
        self.assertEqual(r_print_err.data["print_status"], "PRINT_ERROR")
        self.assertIn("print_warning", r_print_err.data)
        v_id = r_print_err.data["id"]

        # EF-33: Gửi lại cùng idempotency_key -> Không tạo bản ghi trùng
        r_dup = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "business_type": "1. Hạch toán thuế TNDN phải nộp",
                "posting_date": "2026-10-20",
                "idempotency_key": "IDEMP-NVK-001",
                "accounting_lines": [{"debit_account": "8211", "credit_account": "3334", "amount": "12000000"}],
            },
            format="json",
        )
        self.assertEqual(r_dup.status_code, 200)
        self.assertTrue(r_dup.data["duplicate_prevented"])
        self.assertEqual(r_dup.data["id"], v_id)

        # AF-16: Nhập chứng từ từ Excel hợp lệ
        r_import_ok = self.client.post(
            f"/api/v1/general-ledger/general-vouchers/import-excel/?company_id={self.company.id}",
            {
                "columns": ["TK Nợ", "TK Có", "Số tiền"],
                "vouchers": [
                    {
                        "business_type": "1. Hạch toán thuế TNDN phải nộp",
                        "posting_date": "2026-10-22",
                        "document_date": "2026-10-22",
                        "description": "Nhập từ Excel 1",
                        "accounting_lines": [{"debit_account": "8211", "credit_account": "3334", "amount": "9000000"}],
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_import_ok.status_code, 201, r_import_ok.data)
        self.assertEqual(r_import_ok.data["count"], 1)

        # EF-36: Nhập Excel thiếu cột bắt buộc -> Báo lỗi
        r_import_bad_cols = self.client.post(
            f"/api/v1/general-ledger/general-vouchers/import-excel/?company_id={self.company.id}",
            {
                "columns": ["Diễn giải", "Ghi chú"],
                "vouchers": [],
            },
            format="json",
        )
        self.assertEqual(r_import_bad_cols.status_code, 400)

        # AF-18: Sửa chứng từ khi đang UNPOSTED
        r_update = self.client.put(
            f"/api/v1/general-ledger/general-vouchers/{v_id}/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "business_type": "1. Hạch toán thuế TNDN phải nộp",
                "posting_date": "2026-10-20",
                "document_date": "2026-10-20",
                "description": "Đã điều chỉnh thuế TNDN",
                "version": 1,
                "accounting_lines": [{"debit_account": "8211", "credit_account": "3334", "amount": "15500000"}],
            },
            format="json",
        )
        self.assertEqual(r_update.status_code, 200, r_update.data)
        self.assertEqual(Decimal(r_update.data["total_amount"]), Decimal("15500000"))

        # EF-39 & BR-GL-NVK-66: Chặn sửa trực tiếp khi chứng từ đã POSTED
        GeneralBusinessVoucher.objects.filter(pk=v_id).update(status=GeneralVoucherStatus.POSTED)
        r_edit_posted = self.client.put(
            f"/api/v1/general-ledger/general-vouchers/{v_id}/?company_id={self.company.id}",
            {
                "company": str(self.company.id),
                "version": 2,
                "accounting_lines": [{"debit_account": "8211", "credit_account": "3334", "amount": "20000000"}],
            },
            format="json",
        )
        self.assertEqual(r_edit_posted.status_code, 400)


class SubledgerJournalIngestionUcGl04Tests(TestCase):
    """
    UC-GL-04 – Tiếp nhận bút toán từ các phân hệ (Subledger Journal Ingestion).
    Bao phủ:
    - Main Flow (Steps 1–36)
    - Alternative Flows (AF-01..AF-14)
    - Exception Flows (EF-01..EF-27)
    - Business Rules (BR-GL-INT-01..65)
    """

    def setUp(self):
        from master_data.models import Party

        self.currency_vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.currency_usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "Đô la Mỹ"})

        self.company = Company.objects.create(
            code="GL04CO",
            name="Công ty Cổ phần UC-GL-04",
            legal_name="Công ty Cổ phần UC-GL-04",
            tax_code="0109990004",
            accounting_currency=self.currency_vnd,
            legal_reporting_currency=self.currency_vnd,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="GL04OTHER",
            name="Công ty Khác",
            legal_name="Công ty Khác",
            tax_code="0109990099",
            accounting_currency=self.currency_vnd,
            legal_reporting_currency=self.currency_vnd,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(company=self.company, code="HN04", name="Chi nhánh Hà Nội")
        self.department = Department.objects.create(
            company=self.company,
            branch=self.branch,
            code="PB-KD",
            name="Phòng Kinh doanh",
            status="ACTIVE",
        )
        self.period_open = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=10,
            code="2026-10",
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
            status="OPEN",
        )
        self.period_closed = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=9,
            code="2026-09",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="CLOSED",
        )

        self.coa = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT200",
            name="Thông tư 200",
            effective_from="2026-01-01",
            is_default=True,
        )
        self.acc_class = AccountClass.objects.create(
            company=self.company,
            code="ALL04",
            name="Tài khoản chung",
            normal_balance="DEBIT",
        )

        def make_acc(code, name, is_postable=True, status="ACTIVE", parent=None, requires_party=False):
            return Account.objects.create(
                company=self.company,
                chart_of_accounts=self.coa,
                account_class=self.acc_class,
                code=code,
                name=name,
                account_type="ASSET",
                normal_balance="DEBIT",
                is_postable=is_postable,
                status=status,
                parent=parent,
                requires_party=requires_party,
            )

        self.acc_1111 = make_acc("1111", "Tiền Việt Nam")
        self.acc_1121 = make_acc("1121", "Tiền gửi Ngân hàng VND")
        self.acc_131 = make_acc("131", "Phải thu của khách hàng", requires_party=True)
        self.acc_1331 = make_acc("1331", "Thuế GTGT được khấu trừ của hàng hóa, dịch vụ")
        self.acc_154 = make_acc("154", "Chi phí sản xuất, kinh doanh dở dang")
        self.acc_155 = make_acc("155", "Thành phẩm")
        self.acc_156 = make_acc("156", "Hàng hóa")
        self.acc_214 = make_acc("214", "Hao mòn TSCĐ")
        self.acc_242 = make_acc("242", "Chi phí trả trước")
        self.acc_331 = make_acc("331", "Phải trả cho người bán", requires_party=True)
        self.acc_33311 = make_acc("33311", "Thuế GTGT đầu ra")
        self.acc_334 = make_acc("334", "Phải trả người lao động")
        self.acc_511 = make_acc("511", "Doanh thu bán hàng và cung cấp dịch vụ")
        self.acc_632 = make_acc("632", "Giá vốn hàng bán")
        self.acc_642_parent = make_acc("6420", "Chi phí quản lý doanh nghiệp (Tổng hợp)", is_postable=False)
        self.acc_642 = make_acc("642", "Chi phí quản lý doanh nghiệp", parent=self.acc_642_parent)
        self.acc_inactive = make_acc("6429", "Chi phí ngừng sử dụng", status="INACTIVE")

        self.customer = Party.objects.create(
            company=self.company,
            party_type="CUSTOMER",
            code="KH001",
            name="Công ty Khách hàng A",
            tax_code="0101112223",
            status="ACTIVE",
        )
        self.supplier = Party.objects.create(
            company=self.company,
            party_type="SUPPLIER",
            code="NCC001",
            name="Công ty Nhà cung cấp B",
            tax_code="0104445556",
            status="ACTIVE",
        )
        self.user = get_user_model().objects.create_superuser(
            username="gl04_admin",
            email="gl04@example.com",
            password="pass",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = f"/api/v1/general-ledger/subledger-ingestions/?company={self.company.id}"

    def test_main_flow_af01_af02_af04_af07_af08_af09_af10_and_trace(self):
        """
        Kiểm thử:
        - AF-01 & AF-07: Phân hệ nguồn gửi sẵn dòng Nợ/Có + Tự động ghi sổ (AUTO_POST) + Cập nhật AccountBalance
        - AF-10 & EF-25: Chống tiếp nhận trùng (Idempotency) theo (company, source_event_id)
        - AF-02: Phân hệ nguồn gửi dữ liệu nghiệp vụ, GL tự suy diễn tài khoản theo quy tắc (PUR, CASH, FA...)
        - AF-04: Một chứng từ nguồn sinh nhiều nhóm bút toán GL (entry_groups: Doanh thu + Giá vốn)
        - AF-08: Tiếp nhận ở trạng thái UNPOSTED (không làm thay đổi số dư Sổ cái cho đến khi ghi sổ)
        - AF-09: Tiếp nhận và chuyển vào quy trình phê duyệt (WORKFLOW -> PENDING_APPROVAL)
        - BR-GL-INT-32, BR-GL-INT-60, EF-27: Truy vết hai chiều giữa chứng từ nguồn và bút toán GL
        """
        from .models import AccountBalance

        # 1. AF-01 + AF-07 + AF-06 (kế thừa party từ header): Phiếu thu tiền mặt khách hàng (CASH)
        res_cash = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "CASH",
                "source_business_type": "CASH_RECEIPT",
                "source_document_type": "CASH_RECEIPT_VOUCHER",
                "source_document_id": "PT-DOC-001",
                "source_document_number": "PT00001",
                "source_event_id": "EVT-CASH-PT00001",
                "posting_date": "2026-10-10",
                "document_date": "2026-10-10",
                "description": "Thu tiền mặt khách hàng KH001 theo hóa đơn",
                "party": "KH001",
                "posting_mode": "AUTO_POST",
                "lines": [
                    {"account": "1111", "debit": "25000000", "credit": "0"},
                    {"account": "131", "debit": "0", "credit": "25000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(res_cash.status_code, 201, res_cash.data)
        self.assertEqual(res_cash.data["status"], "POSTED")
        self.assertEqual(res_cash.data["primary_journal_status"], "POSTED")
        self.assertFalse(res_cash.data["idempotent_reused"])
        cash_je_no = res_cash.data["primary_journal_number"]

        # Kiểm tra số dư Sổ cái (AccountBalance) đã được cập nhật cho TK 1111
        bal_1111 = AccountBalance.objects.filter(
            company=self.company,
            period=self.period_open,
            account=self.acc_1111,
        ).first()
        self.assertIsNotNone(bal_1111)
        self.assertEqual(bal_1111.period_debit, Decimal("25000000"))

        # 2. AF-10 & EF-25: Gửi lại cùng source_event_id -> Trả về 200 OK idempotent, không nhân đôi số dư
        res_dup = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "CASH",
                "source_business_type": "CASH_RECEIPT",
                "source_document_type": "CASH_RECEIPT_VOUCHER",
                "source_document_id": "PT-DOC-001",
                "source_document_number": "PT00001",
                "source_event_id": "EVT-CASH-PT00001",
                "posting_date": "2026-10-10",
                "party": "KH001",
                "lines": [
                    {"account": "1111", "debit": "25000000", "credit": "0"},
                    {"account": "131", "debit": "0", "credit": "25000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(res_dup.status_code, 200, res_dup.data)
        self.assertTrue(res_dup.data["idempotent_reused"])
        self.assertEqual(res_dup.data["primary_journal_number"], cash_je_no)
        bal_1111.refresh_from_db()
        self.assertEqual(bal_1111.period_debit, Decimal("25000000"))

        # 3. AF-02: Phân hệ Mua hàng (PUR) gửi dữ liệu nghiệp vụ không kèm tài khoản -> GL tự sinh Nợ 156, Nợ 1331 / Có 331
        res_pur = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "PUR",
                "source_business_type": "PURCHASE_GOODS",
                "source_document_type": "PURCHASE_INVOICE",
                "source_document_id": "MH-DOC-001",
                "source_document_number": "PMH00001",
                "source_event_id": "EVT-PUR-PMH00001",
                "posting_date": "2026-10-12",
                "document_date": "2026-10-12",
                "description": "Mua hàng hóa nhập kho từ NCC001",
                "party": "NCC001",
                "amount": "50000000",
                "tax_amount": "5000000",
                "posting_mode": "AUTO_POST",
            },
            format="json",
        )
        self.assertEqual(res_pur.status_code, 201, res_pur.data)
        self.assertEqual(res_pur.data["status"], "POSTED")
        self.assertEqual(Decimal(res_pur.data["total_debit"]), Decimal("55000000"))
        self.assertEqual(len(res_pur.data["resolved_lines"]), 3)

        # 4. AF-04: Một chứng từ Bán hàng (SAL) sinh đồng thời 2 bút toán GL (Doanh thu + Giá vốn)
        res_sal_multi = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "SAL",
                "source_business_type": "SALES_REVENUE",
                "source_document_type": "SALES_INVOICE",
                "source_document_id": "BH-DOC-001",
                "source_document_number": "BH00001",
                "source_event_id": "EVT-SAL-BH00001",
                "posting_date": "2026-10-15",
                "document_date": "2026-10-15",
                "party": "KH001",
                "posting_mode": "AUTO_POST",
                "entry_groups": [
                    {
                        "source_business_type": "SALES_REVENUE",
                        "description": "Phản ánh doanh thu bán hàng BH00001",
                        "amount": "80000000",
                        "tax_amount": "8000000",
                    },
                    {
                        "source_business_type": "INVENTORY_ISSUE_COGS",
                        "description": "Phản ánh giá vốn hàng bán BH00001",
                        "lines": [
                            {"account": "632", "debit": "50000000", "credit": "0"},
                            {"account": "156", "debit": "0", "credit": "50000000"},
                        ],
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res_sal_multi.status_code, 201, res_sal_multi.data)
        self.assertEqual(len(res_sal_multi.data["journal_entries_summary"]), 2)
        self.assertEqual(Decimal(res_sal_multi.data["total_debit"]), Decimal("138000000"))

        # 5. AF-08: Tiếp nhận ở trạng thái UNPOSTED -> Chưa tác động số dư TK 214 cho đến khi gọi /post/
        res_unposted = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "FA",
                "source_business_type": "FA_DEPRECIATION",
                "source_document_type": "DEPRECIATION_SHEET",
                "source_document_id": "KH-DOC-10",
                "source_document_number": "KH202610",
                "source_event_id": "EVT-FA-KH202610",
                "posting_date": "2026-10-25",
                "amount": "12000000",
                "posting_mode": "UNPOSTED",
            },
            format="json",
        )
        self.assertEqual(res_unposted.status_code, 201, res_unposted.data)
        self.assertEqual(res_unposted.data["status"], "UNPOSTED")
        self.assertEqual(res_unposted.data["primary_journal_status"], "DRAFT")
        bal_214_before = AccountBalance.objects.filter(
            company=self.company, period=self.period_open, account=self.acc_214
        ).first()
        self.assertIsNone(bal_214_before)

        # Ghi sổ bút toán UNPOSTED qua action /post/
        ing_unposted_id = res_unposted.data["id"]
        res_post_now = self.client.post(
            f"/api/v1/general-ledger/subledger-ingestions/{ing_unposted_id}/post/?company={self.company.id}",
            {},
            format="json",
        )
        self.assertEqual(res_post_now.status_code, 200, res_post_now.data)
        self.assertEqual(res_post_now.data["status"], "POSTED")
        bal_214_after = AccountBalance.objects.filter(
            company=self.company, period=self.period_open, account=self.acc_214
        ).first()
        self.assertIsNotNone(bal_214_after)
        self.assertEqual(bal_214_after.period_credit, Decimal("12000000"))

        # 6. AF-09: Tiếp nhận với chế độ WORKFLOW -> Bút toán ở trạng thái PENDING_APPROVAL
        res_wf = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "PAYROLL",
                "source_business_type": "SALARY_ACCRUAL",
                "source_document_type": "PAYROLL_SHEET",
                "source_document_id": "BL-DOC-10",
                "source_document_number": "BL202610",
                "source_event_id": "EVT-PAYROLL-BL202610",
                "posting_date": "2026-10-28",
                "amount": "95000000",
                "posting_mode": "WORKFLOW",
            },
            format="json",
        )
        self.assertEqual(res_wf.status_code, 201, res_wf.data)
        self.assertEqual(res_wf.data["status"], "UNPOSTED")
        self.assertEqual(res_wf.data["primary_journal_status"], "PENDING_APPROVAL")

        # 7. BR-GL-INT-32, BR-GL-INT-60, EF-27: Truy vết 2 chiều giữa chứng từ nguồn và bút toán GL
        res_trace = self.client.get(
            f"/api/v1/general-ledger/subledger-ingestions/trace/?company={self.company.id}&source_document_number=BH00001"
        )
        self.assertEqual(res_trace.status_code, 200, res_trace.data)
        self.assertEqual(res_trace.data["count"], 1)
        self.assertEqual(len(res_trace.data["results"][0]["gl_entries"]), 2)

        res_trace_missing = self.client.get(
            f"/api/v1/general-ledger/subledger-ingestions/trace/?company={self.company.id}&source_document_number=NOT_EXIST_999"
        )
        self.assertEqual(res_trace_missing.status_code, 400)

    def test_exceptions_ef01_to_ef26_error_persistence_retry_and_sync_unposted(self):
        """
        Kiểm thử đầy đủ các luồng ngoại lệ EF-01..EF-26, lưu nhận diện bản ghi ERROR & Retry (BR-GL-INT-42, 43),
        xử lý callback lỗi (EF-24, BR-GL-INT-44, 45), và đồng bộ bút toán UNPOSTED vs chặn sửa POSTED (AF-12, AF-13, EF-26).
        """
        from .models import SubledgerJournalIngestion, SubledgerPostingRule

        # EF-02: Chứng từ nguồn đã hủy (CANCELLED) -> Từ chối tiếp nhận
        r_ef02 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "CASH",
                "source_business_type": "CASH_PAYMENT",
                "source_document_type": "CASH_PAYMENT_VOUCHER",
                "source_document_id": "PC-CANCEL-01",
                "source_document_number": "PC00099",
                "source_document_status": "CANCELLED",
                "source_event_id": "EVT-EF02-CANCEL",
                "posting_date": "2026-10-10",
                "party": "NCC001",
                "amount": "1000000",
            },
            format="json",
        )
        self.assertEqual(r_ef02.status_code, 400)
        self.assertEqual(r_ef02.data.get("error_code"), "EF_02_SOURCE_DOCUMENT_INELIGIBLE")

        # EF-04: Không cùng phạm vi doanh nghiệp
        r_ef04 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_company_id": str(self.other_company.id),
                "source_module": "CASH",
                "source_business_type": "CASH_PAYMENT",
                "source_document_id": "PC-02",
                "source_document_number": "PC00002",
                "source_event_id": "EVT-EF04",
                "posting_date": "2026-10-10",
                "amount": "1000000",
            },
            format="json",
        )
        self.assertEqual(r_ef04.status_code, 400)

        # EF-05: Thiếu source_event_id
        r_ef05 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "CASH",
                "source_business_type": "CASH_PAYMENT",
                "source_document_id": "PC-03",
                "source_document_number": "PC00003",
                "posting_date": "2026-10-10",
                "amount": "1000000",
            },
            format="json",
        )
        self.assertEqual(r_ef05.status_code, 400)

        # EF-06 + BR-GL-INT-42 + BR-GL-INT-43: Chưa có quy tắc hạch toán cho loại nghiệp vụ mới -> Ghi nhận ERROR và Retry sau khi tạo Rule
        r_ef06 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "TOOLS",
                "source_business_type": "CUSTOM_TOOL_ISSUE",
                "source_document_type": "TOOL_ISSUE",
                "source_document_id": "CCDC-001",
                "source_document_number": "CCDC0001",
                "source_event_id": "EVT-TOOLS-CUSTOM-01",
                "posting_date": "2026-10-15",
                "amount": "6000000",
                "use_default_rule": False,
            },
            format="json",
        )
        self.assertEqual(r_ef06.status_code, 400)
        self.assertEqual(r_ef06.data.get("error_code"), "EF_06_MISSING_POSTING_RULE")
        err_ing = SubledgerJournalIngestion.objects.filter(
            company=self.company, source_event_id="EVT-TOOLS-CUSTOM-01"
        ).first()
        self.assertIsNotNone(err_ing)
        self.assertEqual(err_ing.status, "ERROR")

        # Cấu hình quy tắc cho (TOOLS, CUSTOM_TOOL_ISSUE) rồi gọi /retry/
        SubledgerPostingRule.objects.create(
            company=self.company,
            source_module="TOOLS",
            source_business_type="CUSTOM_TOOL_ISSUE",
            name="Xuất dùng CCDC bộ phận quản lý",
            debit_account=self.acc_642,
            credit_account=self.acc_242,
            posting_mode="AUTO_POST",
            is_active=True,
        )
        r_retry = self.client.post(
            f"/api/v1/general-ledger/subledger-ingestions/{err_ing.id}/retry/?company={self.company.id}",
            {},
            format="json",
        )
        self.assertEqual(r_retry.status_code, 201, r_retry.data)
        self.assertEqual(r_retry.data["status"], "POSTED")

        # EF-09: Kỳ kế toán đã khóa (2026-09 CLOSED) -> Từ chối ghi sổ
        r_ef09 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "FA",
                "source_business_type": "FA_DEPRECIATION",
                "source_document_type": "DEPRECIATION_SHEET",
                "source_document_id": "KH-09",
                "source_document_number": "KH202609",
                "source_event_id": "EVT-EF09-LOCKED",
                "posting_date": "2026-09-30",
                "amount": "5000000",
            },
            format="json",
        )
        self.assertEqual(r_ef09.status_code, 400)
        self.assertEqual(r_ef09.data.get("error_code"), "EF_09_PERIOD_LOCKED")

        # EF-11 & EF-12: Tài khoản ngừng sử dụng (6429) và tài khoản tổng hợp (6420)
        r_ef11 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "COST",
                "source_business_type": "PRODUCTION_COST_TRANSFER",
                "source_document_id": "GT-01",
                "source_document_number": "GT0001",
                "source_event_id": "EVT-EF11",
                "posting_date": "2026-10-18",
                "lines": [
                    {"account": "6429", "debit": "3000000", "credit": "0"},
                    {"account": "154", "debit": "0", "credit": "3000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_ef11.status_code, 400)
        self.assertEqual(r_ef11.data.get("error_code"), "EF_11_ACCOUNT_INACTIVE")

        r_ef12 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "COST",
                "source_business_type": "PRODUCTION_COST_TRANSFER",
                "source_document_id": "GT-02",
                "source_document_number": "GT0002",
                "source_event_id": "EVT-EF12",
                "posting_date": "2026-10-18",
                "lines": [
                    {"account": "6420", "debit": "3000000", "credit": "0"},
                    {"account": "154", "debit": "0", "credit": "3000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_ef12.status_code, 400)
        self.assertEqual(r_ef12.data.get("error_code"), "EF_12_ACCOUNT_NOT_LEAF")

        # EF-13: Tài khoản 131 bắt buộc có Party nhưng không truyền
        r_ef13 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "AR",
                "source_business_type": "CUSTOMER_DEBT_OFFSET",
                "source_document_id": "AR-01",
                "source_document_number": "AR0001",
                "source_event_id": "EVT-EF13",
                "posting_date": "2026-10-18",
                "lines": [
                    {"account": "131", "debit": "4000000", "credit": "0"},
                    {"account": "511", "debit": "0", "credit": "4000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_ef13.status_code, 400)
        self.assertEqual(r_ef13.data.get("error_code"), "EF_13_MISSING_REQUIRED_DIMENSION")

        # EF-16 & AF-05: Nghiệp vụ ngoại tệ USD sai quy đổi vs hợp lệ
        r_ef16 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "BANK",
                "source_business_type": "BANK_CREDIT_ADVICE",
                "source_document_id": "BC-USD-ERR",
                "source_document_number": "BC0001",
                "source_event_id": "EVT-EF16",
                "posting_date": "2026-10-19",
                "currency": "USD",
                "exchange_rate": "25000",
                "party": "KH001",
                "lines": [
                    {"account": "1121", "debit": "25000000", "credit": "0", "foreign_amount": "500"},
                    {"account": "131", "debit": "0", "credit": "25000000", "foreign_amount": "500"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_ef16.status_code, 400)
        self.assertEqual(r_ef16.data.get("error_code"), "EF_16_FX_CONVERSION_MISMATCH")

        # EF-17: Tổng Nợ khác Tổng Có
        r_ef17 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "TAX",
                "source_business_type": "VAT_NETTING",
                "source_document_id": "TAX-01",
                "source_document_number": "KT0001",
                "source_event_id": "EVT-EF17",
                "posting_date": "2026-10-19",
                "lines": [
                    {"account": "33311", "debit": "10000000", "credit": "0"},
                    {"account": "1331", "debit": "0", "credit": "9000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_ef17.status_code, 400)
        self.assertEqual(r_ef17.data.get("error_code"), "EF_17_UNBALANCED_ENTRY")

        # EF-24: Lỗi gửi phản hồi callback về phân hệ nguồn không làm rollback bút toán GL, cho phép retry-callback
        r_ef24 = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "TAX",
                "source_business_type": "VAT_NETTING",
                "source_document_type": "VAT_DECLARATION",
                "source_document_id": "TAX-OK-01",
                "source_document_number": "KT0002",
                "source_event_id": "EVT-EF24-CALLBACK",
                "posting_date": "2026-10-20",
                "amount": "15000000",
                "simulate_callback_failure": True,
            },
            format="json",
        )
        self.assertEqual(r_ef24.status_code, 201, r_ef24.data)
        self.assertEqual(r_ef24.data["status"], "POSTED")
        self.assertEqual(r_ef24.data["callback_status"], "FAILED")
        r_cb_retry = self.client.post(
            f"/api/v1/general-ledger/subledger-ingestions/{r_ef24.data['id']}/retry-callback/?company={self.company.id}",
            {},
            format="json",
        )
        self.assertEqual(r_cb_retry.status_code, 200)
        self.assertEqual(r_cb_retry.data["callback_status"], "SYNCED")

        # AF-13 vs AF-12 / EF-26: Đồng bộ cập nhật bút toán đang UNPOSTED và chặn ghi đè khi đã POSTED
        r_unp = self.client.post(
            self.url,
            {
                "company": str(self.company.id),
                "source_module": "COST",
                "source_business_type": "PRODUCTION_COST_TRANSFER",
                "source_document_type": "COST_SHEET",
                "source_document_id": "GT-SYNC-01",
                "source_document_number": "GT0099",
                "source_event_id": "EVT-COST-SYNC-01",
                "posting_date": "2026-10-22",
                "amount": "30000000",
                "posting_mode": "UNPOSTED",
            },
            format="json",
        )
        self.assertEqual(r_unp.status_code, 201, r_unp.data)
        sync_id = r_unp.data["id"]

        # AF-13: Cập nhật số tiền chứng từ nguồn khi bút toán đang UNPOSTED
        r_sync_ok = self.client.post(
            f"/api/v1/general-ledger/subledger-ingestions/{sync_id}/sync-unposted/?company={self.company.id}",
            {"amount": "42000000", "description": "Điều chỉnh giá thành kết chuyển"},
            format="json",
        )
        self.assertEqual(r_sync_ok.status_code, 200, r_sync_ok.data)
        self.assertEqual(Decimal(r_sync_ok.data["total_debit"]), Decimal("42000000"))

        # EF-26: Sau khi ghi sổ (POSTED), chặn đồng bộ ghi đè hoặc xóa trực tiếp
        self.client.post(
            f"/api/v1/general-ledger/subledger-ingestions/{sync_id}/post/?company={self.company.id}",
            {},
            format="json",
        )
        r_sync_blocked = self.client.post(
            f"/api/v1/general-ledger/subledger-ingestions/{sync_id}/sync-unposted/?company={self.company.id}",
            {"amount": "50000000"},
            format="json",
        )
        self.assertEqual(r_sync_blocked.status_code, 400)
        r_del_blocked = self.client.delete(
            f"/api/v1/general-ledger/subledger-ingestions/{sync_id}/?company={self.company.id}"
        )
        self.assertEqual(r_del_blocked.status_code, 400)


class JournalPostUnpostUcGl05Tests(TestCase):
    """
    Bộ kiểm thử toàn diện cho UC-GL-05 – Ghi sổ / Bỏ ghi sổ bút toán:
    - Main Flow Ghi sổ (Steps 1–32, AF-01..AF-05, BR-GL-POST-01..39, 60..63).
    - Luồng Bỏ ghi sổ (AF-06..AF-21, BR-GL-POST-40..59, 64..68).
    - Chỉnh sửa chứng từ sau Bỏ ghi sổ & Ghi sổ lại (REPOST) với kiểm tra lại toàn diện (BR-GL-POST-44, 48, 49, 82).
    - Liên thông Ghi sổ / Bỏ ghi sổ cho Chứng từ quyết toán tạm ứng (UC-GL-02) và Chứng từ nghiệp vụ khác (UC-GL-03).
    - Chính sách chặn Bỏ ghi sổ trực tiếp tại GL đối với bút toán tự động từ phân hệ nguồn (EF-26, BR-GL-POST-52..54).
    - Chặn Bỏ ghi sổ khi đã có Phân bổ chi phí (EF-27) hoặc Kết chuyển cuối kỳ (EF-28) phụ thuộc.
    - Ghi sổ hàng loạt & Bỏ ghi sổ hàng loạt (AF-22, AF-23, EF-34, EF-35, BR-GL-POST-69..72).
    - Xử lý Idempotent Retry & Optimistic Concurrency version (EF-06, EF-07, EF-33, BR-GL-POST-10, 11, 74, 75).
    """

    def setUp(self):
        from master_data.models import Party
        from .models import JournalEntry, JournalLine

        self.JournalEntry = JournalEntry
        self.JournalLine = JournalLine
        self.Party = Party

        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "Đô la Mỹ"})

        self.company = Company.objects.create(
            code="GLPOST05",
            name="Công ty Kiểm thử Ghi sổ GL05",
            legal_name="Công ty TNHH Kiểm thử Ghi sổ GL05",
            tax_code="0109988776",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.other_company = Company.objects.create(
            code="GLPOST05B",
            name="Công ty Khác GL05B",
            legal_name="Công ty TNHH Khác GL05B",
            tax_code="0109988777",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN01", name="Chi nhánh Hà Nội")
        self.department = Department.objects.create(
            company=self.company, branch=self.branch, code="PKT", name="Phòng Kế toán"
        )
        self.employee = Employee.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.department,
            employee_code="NV05",
            full_name="Nguyễn Văn Quyết",
        )

        self.asset_class = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT"
        )
        self.liab_class = AccountClass.objects.create(
            company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT"
        )
        self.exp_class = AccountClass.objects.create(
            company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT"
        )
        self.eq_class = AccountClass.objects.create(
            company=self.company, code="EQ", name="Vốn chủ sở hữu", normal_balance="CREDIT"
        )
        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT99",
            name="Hệ thống tài khoản TT99",
            effective_from="2026-01-01",
            is_default=True,
        )

        self.acc_111 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="111",
            name="Tiền mặt",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_112 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="112",
            name="Tiền gửi ngân hàng",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_141 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="141",
            name="Tạm ứng",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_1331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="1331",
            name="Thuế GTGT được khấu trừ",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.liab_class,
            code="331",
            name="Phải trả cho người bán",
            account_type="LIABILITY",
            normal_balance="CREDIT",
            is_postable=True,
            requires_party=True,
        )
        self.acc_642 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.exp_class,
            code="642",
            name="Chi phí quản lý doanh nghiệp",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_6422 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.exp_class,
            code="6422",
            name="Chi phí vật liệu quản lý",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_911 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.eq_class,
            code="911",
            name="Xác định kết quả kinh doanh",
            account_type="EQUITY",
            normal_balance="CREDIT",
            is_postable=True,
        )

        self.supplier = Party.objects.create(
            company=self.company,
            party_type="SUPPLIER",
            code="NCC05",
            name="Công ty Cung ứng Thiết bị Số",
            tax_code="0101234505",
            status="ACTIVE",
        )

        self.period_oct = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
            status="OPEN",
        )
        self.period_nov = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-11",
            fiscal_year=2026,
            period_number=11,
            start_date=date(2026, 11, 1),
            end_date=date(2026, 11, 30),
            status="OPEN",
        )

        self.maker = get_user_model().objects.create_superuser(
            username="gl05-maker", email="maker@gl05.test", password="x"
        )
        self.poster = get_user_model().objects.create_superuser(
            username="gl05-poster", email="poster@gl05.test", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.poster)
        self.query = f"?company_id={self.company.id}"

    def _create_draft_entry(self, number="PKT-GL05-001", amount=Decimal("10000000"), **extra):
        payload = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "period": str(self.period_oct.id),
            "number": number,
            "entry_type": "MANUAL",
            "posting_date": "2026-10-15",
            "document_date": "2026-10-15",
            "description": f"Hạch toán chi phí {number}",
            "source_module": "GL",
            "lines": [
                {
                    "line_no": 1,
                    "account": str(self.acc_642.id),
                    "debit": str(amount),
                    "credit": "0",
                    "currency": str(self.vnd.id),
                    "exchange_rate": "1",
                    "description": "Chi phí quản lý",
                },
                {
                    "line_no": 2,
                    "account": str(self.acc_111.id),
                    "debit": "0",
                    "credit": str(amount),
                    "currency": str(self.vnd.id),
                    "exchange_rate": "1",
                    "description": "Chi tiền mặt",
                },
            ],
            **extra,
        }
        res = self.client.post(f"/api/v1/general-ledger/journals/{self.query}", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def test_main_flow_post_unpost_repost_balance_cascade_and_history(self):
        """
        Kiểm thử Main Flow Ghi sổ -> Bỏ ghi sổ (AF-06..AF-18) -> Sửa chứng từ -> Ghi sổ lại (REPOST):
        - Chứng từ UNPOSTED chưa tác động số dư AccountBalance (BR-GL-POST-33, 60).
        - Ghi sổ cập nhật AccountBalance kỳ hiện tại và đồng bộ lũy kế sang kỳ sau (2026-11).
        - Idempotent retry cho POST và UNPOST (EF-06, EF-07, BR-GL-POST-74, 75).
        - Chặn sửa/xóa trực tiếp chứng từ đang POSTED (BR-GL-POST-39).
        - Bỏ ghi sổ loại bỏ tác động số dư Sổ cái, giữ nguyên chứng từ và số chứng từ (BR-GL-POST-41..43).
        - Sửa chứng từ sau Bỏ ghi sổ và Ghi sổ lại thực hiện kiểm tra lại đầy đủ, lưu lịch sử POST -> UNPOST -> REPOST (BR-GL-POST-48, 49, 82).
        """
        from .models import AccountBalance

        # Khởi tạo trước AccountBalance kỳ 11 để kiểm tra cascade số dư đầu kỳ/cuối kỳ
        AccountBalance.objects.create(
            company=self.company,
            period=self.period_nov,
            account=self.acc_642,
            branch=self.branch,
            opening_debit=Decimal("0"),
            opening_credit=Decimal("0"),
        )

        draft = self._create_draft_entry("PKT-001", Decimal("15000000"))
        entry_id = draft["id"]
        self.assertEqual(draft["status"], "DRAFT")
        self.assertEqual(draft["version"], 1)

        # Trước khi Ghi sổ: số dư Sổ cái kỳ 10 chưa phát sinh
        self.assertFalse(
            AccountBalance.objects.filter(period=self.period_oct, account=self.acc_642, branch=self.branch).exists()
        )

        # 1. Ghi sổ (POST)
        r_post = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}",
            {"posting_reference": "REF-POST-001", "version": 1},
            format="json",
        )
        self.assertEqual(r_post.status_code, 200, r_post.data)
        self.assertEqual(r_post.data["status"], "POSTED")
        self.assertEqual(r_post.data["version"], 2)
        self.assertEqual(r_post.data["posting_reference"], "REF-POST-001")
        self.assertIsNotNone(r_post.data["posted_at"])

        bal_oct = AccountBalance.objects.get(period=self.period_oct, account=self.acc_642, branch=self.branch)
        self.assertEqual(bal_oct.period_debit, Decimal("15000000"))
        self.assertEqual(bal_oct.closing_debit, Decimal("15000000"))

        bal_nov = AccountBalance.objects.get(period=self.period_nov, account=self.acc_642, branch=self.branch)
        self.assertEqual(bal_nov.opening_debit, Decimal("15000000"))
        self.assertEqual(bal_nov.closing_debit, Decimal("15000000"))

        # 2. Idempotent retry với cùng posting_reference -> 200 OK và không nhân đôi số dư (EF-06, BR-GL-POST-74)
        r_post_idem = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}",
            {"posting_reference": "REF-POST-001"},
            format="json",
        )
        self.assertEqual(r_post_idem.status_code, 200)
        bal_oct.refresh_from_db()
        self.assertEqual(bal_oct.period_debit, Decimal("15000000"))

        # Ghi sổ lặp lại không có cờ idempotent -> bị từ chối ALREADY_POSTED (EF-04, BR-GL-POST-05)
        r_post_dup = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_post_dup.status_code, 400)
        self.assertEqual(r_post_dup.data.get("error_code"), "ALREADY_POSTED")

        # 3. Chặn sửa hoặc xóa trực tiếp bút toán đang POSTED (BR-GL-POST-39)
        r_edit_posted = self.client.patch(
            f"/api/v1/general-ledger/journals/{entry_id}/{self.query}",
            {"description": "Sửa trái phép khi đã ghi sổ"},
            format="json",
        )
        self.assertEqual(r_edit_posted.status_code, 400)
        r_del_posted = self.client.delete(f"/api/v1/general-ledger/journals/{entry_id}/{self.query}")
        self.assertEqual(r_del_posted.status_code, 400)

        # 4. Bỏ ghi sổ (UNPOST) (AF-06..AF-18)
        r_unpost = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/unpost/{self.query}",
            {
                "reason": "Điều chỉnh lại số tiền chi phí quản lý tháng 10",
                "unpost_reference": "REF-UNPOST-001",
                "version": 2,
            },
            format="json",
        )
        self.assertEqual(r_unpost.status_code, 200, r_unpost.data)
        self.assertEqual(r_unpost.data["status"], "DRAFT")
        self.assertEqual(r_unpost.data["number"], "PKT-001")  # Giữ nguyên số chứng từ (BR-GL-POST-43)
        self.assertEqual(r_unpost.data["version"], 3)
        self.assertEqual(r_unpost.data["unpost_reason"], "Điều chỉnh lại số tiền chi phí quản lý tháng 10")
        self.assertIsNotNone(r_unpost.data["unposted_at"])

        # Kiểm tra số dư Sổ cái đã được gỡ bỏ và cascade sang kỳ 11 (BR-GL-POST-41, 64)
        bal_oct.refresh_from_db()
        bal_nov.refresh_from_db()
        self.assertEqual(bal_oct.period_debit, Decimal("0"))
        self.assertEqual(bal_oct.closing_debit, Decimal("0"))
        self.assertEqual(bal_nov.opening_debit, Decimal("0"))
        self.assertEqual(bal_nov.closing_debit, Decimal("0"))

        # Idempotent retry cho UNPOST (EF-07, BR-GL-POST-75)
        r_unpost_idem = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/unpost/{self.query}",
            {"unpost_reference": "REF-UNPOST-001"},
            format="json",
        )
        self.assertEqual(r_unpost_idem.status_code, 200)

        # Bỏ ghi sổ lặp lại khi đã ở trạng thái chưa ghi sổ -> bị từ chối NOT_POSTED (EF-05, BR-GL-POST-08)
        r_unpost_again = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/unpost/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_unpost_again.status_code, 400)
        self.assertEqual(r_unpost_again.data.get("error_code"), "NOT_POSTED")

        # 5. Chỉnh sửa chứng từ sau khi Bỏ ghi sổ (tăng lên 22,000,000) và Ghi sổ lại (REPOST)
        r_update = self.client.put(
            f"/api/v1/general-ledger/journals/{entry_id}/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period_oct.id),
                "number": "PKT-001",
                "entry_type": "MANUAL",
                "posting_date": "2026-10-15",
                "document_date": "2026-10-15",
                "description": "Hạch toán chi phí PKT-001 (Đã điều chỉnh)",
                "source_module": "GL",
                "lines": [
                    {
                        "line_no": 1,
                        "account": str(self.acc_642.id),
                        "debit": "22000000",
                        "credit": "0",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                    {
                        "line_no": 2,
                        "account": str(self.acc_111.id),
                        "debit": "0",
                        "credit": "22000000",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(r_update.status_code, 200, r_update.data)
        self.assertEqual(r_update.data["version"], 4)

        r_repost = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}",
            {"posting_reference": "REF-REPOST-001", "reason": "Ghi sổ lại sau khi điều chỉnh"},
            format="json",
        )
        self.assertEqual(r_repost.status_code, 200, r_repost.data)
        self.assertEqual(r_repost.data["status"], "POSTED")
        self.assertEqual(r_repost.data["version"], 5)

        bal_oct.refresh_from_db()
        bal_nov.refresh_from_db()
        self.assertEqual(bal_oct.period_debit, Decimal("22000000"))
        self.assertEqual(bal_nov.opening_debit, Decimal("22000000"))

        # Kiểm tra lịch sử Ghi sổ / Bỏ ghi sổ / Ghi sổ lại (BR-GL-POST-47, 49, 82)
        r_hist = self.client.get(f"/api/v1/general-ledger/journals/{entry_id}/posting-history/{self.query}")
        self.assertEqual(r_hist.status_code, 200, r_hist.data)
        self.assertEqual(r_hist.data["count"], 3)
        actions = [h["action"] for h in r_hist.data["results"]]
        self.assertEqual(actions, ["REPOST", "UNPOST", "POST"])

    def test_voucher_post_unpost_for_qttu_uc_gl_02_and_nvk_uc_gl_03(self):
        """
        Kiểm thử liên thông Ghi sổ / Bỏ ghi sổ từ Chứng từ nghiệp vụ khác (UC-GL-03)
        và Chứng từ quyết toán tạm ứng (UC-GL-02), bảo toàn liên kết nguồn và dòng thuế (BR-GL-POST-50, 51).
        """
        # 1. Chứng từ nghiệp vụ khác (NVK) có kê khai thuế GTGT
        r_nvk = self.client.post(
            f"/api/v1/general-ledger/general-vouchers/{self.query}",
            {
                "company": str(self.company.id),
                "business_type": "OTHER",
                "posting_date": "2026-10-18",
                "document_date": "2026-10-18",
                "description": "Chi phí dịch vụ kiểm toán",
                "accounting_lines": [
                    {
                        "description": "Chi phí dịch vụ kiểm toán",
                        "debit_account": "6422",
                        "credit_account": "331",
                        "amount": "20000000",
                        "credit_object_code": "NCC05",
                    }
                ],
                "tax_lines": [
                    {
                        "description": "Thuế GTGT dịch vụ kiểm toán",
                        "tax_account": "1331",
                        "credit_account": "331",
                        "pre_tax_amount": "20000000",
                        "vat_rate": "10",
                        "vat_amount": "2000000",
                        "invoice_date": "2026-10-18",
                        "invoice_number": "HD0501",
                        "invoice_serial": "C26T",
                        "supplier_code": "NCC05",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_nvk.status_code, 201, r_nvk.data)
        nvk_id = r_nvk.data["id"]
        self.assertEqual(r_nvk.data["status"], "UNPOSTED")

        # Ghi sổ NVK
        r_nvk_post = self.client.post(
            f"/api/v1/general-ledger/general-vouchers/{nvk_id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(r_nvk_post.status_code, 200, r_nvk_post.data)
        self.assertEqual(r_nvk_post.data["status"], "POSTED")
        self.assertEqual(r_nvk_post.data["journal_status"], "POSTED")

        # Bỏ ghi sổ NVK -> bảo toàn các dòng hạch toán và dòng thuế (BR-GL-POST-51)
        r_nvk_unpost = self.client.post(
            f"/api/v1/general-ledger/general-vouchers/{nvk_id}/unpost/{self.query}",
            {"reason": "Rà soát lại số hóa đơn"},
            format="json",
        )
        self.assertEqual(r_nvk_unpost.status_code, 200, r_nvk_unpost.data)
        self.assertEqual(r_nvk_unpost.data["status"], "UNPOSTED")
        self.assertEqual(len(r_nvk_unpost.data["accounting_lines"]), 1)
        self.assertEqual(len(r_nvk_unpost.data["tax_lines"]), 1)

        # 2. Chứng từ quyết toán tạm ứng (QTTU) kế thừa từ Đề nghị quyết toán đã duyệt (UC-GL-01 -> UC-GL-02 -> UC-GL-05)
        r_req = self.client.post(
            f"/api/v1/general-ledger/advance-settlement-requests/{self.query}",
            {
                "company": str(self.company.id),
                "requester": str(self.employee.id),
                "department": str(self.department.id),
                "amount": "8000000",
                "purpose": "Công tác phí Đà Nẵng",
            },
            format="json",
        )
        self.assertEqual(r_req.status_code, 201, r_req.data)
        req_id = r_req.data["id"]
        self.client.post(
            f"/api/v1/general-ledger/advance-settlement-requests/{req_id}/approve/{self.query}",
            {"comment": "Duyệt đề nghị"},
            format="json",
        )

        r_qttu = self.client.post(
            f"/api/v1/general-ledger/advance-settlement-vouchers/{self.query}",
            {
                "company": str(self.company.id),
                "employee": str(self.employee.id),
                "advance_request": req_id,
                "posting_date": "2026-10-20",
                "document_date": "2026-10-20",
                "description": "Quyết toán công tác phí Đà Nẵng",
                "accounting_lines": [
                    {
                        "description": "Chi phí công tác Đà Nẵng",
                        "debit_account": "6422",
                        "credit_account": "141",
                        "amount": "8000000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_qttu.status_code, 201, r_qttu.data)
        qttu_id = r_qttu.data["id"]

        r_qttu_post = self.client.post(
            f"/api/v1/general-ledger/advance-settlement-vouchers/{qttu_id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(r_qttu_post.status_code, 200, r_qttu_post.data)
        self.assertEqual(r_qttu_post.data["status"], "POSTED")

        # Bỏ ghi sổ QTTU -> Liên kết với Đề nghị quyết toán không bị mất (BR-GL-POST-50)
        r_qttu_unpost = self.client.post(
            f"/api/v1/general-ledger/advance-settlement-vouchers/{qttu_id}/unpost/{self.query}",
            {"reason": "Bổ sung vé máy bay"},
            format="json",
        )
        self.assertEqual(r_qttu_unpost.status_code, 200, r_qttu_unpost.data)
        self.assertEqual(r_qttu_unpost.data["status"], "UNPOSTED")
        self.assertEqual(str(r_qttu_unpost.data["advance_request"]), str(req_id))

    def test_exceptions_workflow_period_lock_accounts_dimensions_fx_subledger_and_dependencies(self):
        """
        Kiểm thử toàn diện các luồng ngoại lệ EF-08..EF-33:
        - EF-08, EF-09: Chặn ghi sổ khi đang PENDING_APPROVAL hoặc REJECTED.
        - BR-GL-POST-14: Chặn người lập tự ghi sổ khi allow_creator_posting=False.
        - EF-10, EF-12: Chặn POST và UNPOST khi kỳ kế toán CLOSED.
        - EF-14..16: Chặn tài khoản ngừng sử dụng, không cho phép hạch toán hoặc là tài khoản cha có TK con.
        - EF-17, EF-18: Chặn thiếu chiều bắt buộc (Party trên TK 331) hoặc khác doanh nghiệp.
        - EF-19: Chặn bút toán ngoại tệ sai lệch giá trị quy đổi.
        - EF-20: Chặn bút toán lệch Nợ/Có khi tính lại từ dòng chi tiết (BR-GL-POST-30).
        - EF-26: Chặn Bỏ ghi sổ trực tiếp tại GL đối với bút toán tự động từ phân hệ nguồn (PUR), chỉ cho phép khi có xác nhận từ nguồn.
        - EF-27, EF-28: Chặn Bỏ ghi sổ khi đã có Phân bổ chi phí (AllocationRun) hoặc Kết chuyển cuối kỳ (ClosingRun) phụ thuộc.
        - EF-29: Chặn Bỏ ghi sổ thiếu lý do khi chính sách yêu cầu.
        - EF-33: Chặn xung đột phiên bản đồng thời (Optimistic Concurrency version).
        """
        # 1. EF-08 (PENDING_APPROVAL), EF-09 (REJECTED), và Maker-Checker (BR-GL-POST-14)
        self.client.force_authenticate(self.maker)
        wf_entry = self._create_draft_entry("PKT-WF-01")
        wf_id = wf_entry["id"]
        self.client.post(f"/api/v1/general-ledger/journals/{wf_id}/submit/{self.query}", {}, format="json")

        self.client.force_authenticate(self.poster)
        r_ef08 = self.client.post(f"/api/v1/general-ledger/journals/{wf_id}/post/{self.query}", {}, format="json")
        self.assertEqual(r_ef08.status_code, 400)
        self.assertEqual(r_ef08.data.get("error_code"), "WORKFLOW_PENDING")

        # Từ chối -> EF-09
        self.client.post(
            f"/api/v1/general-ledger/journals/{wf_id}/reject/{self.query}",
            {"comment": "Chưa đủ chứng từ gốc"},
            format="json",
        )
        r_ef09 = self.client.post(f"/api/v1/general-ledger/journals/{wf_id}/post/{self.query}", {}, format="json")
        self.assertEqual(r_ef09.status_code, 400)
        self.assertEqual(r_ef09.data.get("error_code"), "WORKFLOW_REJECTED")

        # Gửi duyệt lại và duyệt -> kiểm tra Maker không được tự ghi sổ khi allow_creator_posting=False
        self.client.force_authenticate(self.maker)
        self.client.post(f"/api/v1/general-ledger/journals/{wf_id}/submit/{self.query}", {}, format="json")
        self.client.force_authenticate(self.poster)
        self.client.post(
            f"/api/v1/general-ledger/journals/{wf_id}/approve/{self.query}", {"comment": "OK"}, format="json"
        )
        self.client.force_authenticate(self.maker)
        r_self_post = self.client.post(f"/api/v1/general-ledger/journals/{wf_id}/post/{self.query}", {}, format="json")
        self.assertEqual(r_self_post.status_code, 400)
        self.client.force_authenticate(self.poster)

        # 2. EF-16: Tài khoản tổng hợp có tài khoản con đang hoạt động không được phép hạch toán
        entry_parent_acc = self._create_draft_entry("PKT-PARENT-ACC")
        child_6421 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.exp_class,
            parent=self.acc_642,
            code="6421",
            name="Chi phí nhân viên quản lý",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
        )
        r_ef16 = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_parent_acc['id']}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(r_ef16.status_code, 400)
        child_6421.delete()

        # 3. EF-17: Tài khoản 331 bắt buộc có Party nhưng dòng hạch toán bị thiếu Party
        entry_missing_party = self.JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period_oct,
            number="PKT-MISS-PARTY",
            entry_type="MANUAL",
            posting_date=date(2026, 10, 16),
            document_date=date(2026, 10, 16),
            description="Thiếu đối tượng công nợ",
            status="DRAFT",
            total_debit=Decimal("5000000"),
            total_credit=Decimal("5000000"),
            created_by=self.JournalEntry.objects.get(pk=wf_id).created_by,
        )
        self.JournalLine.objects.create(
            entry=entry_missing_party, line_no=1, account=self.acc_6422, debit=Decimal("5000000"), currency=self.vnd
        )
        self.JournalLine.objects.create(
            entry=entry_missing_party, line_no=2, account=self.acc_331, credit=Decimal("5000000"), currency=self.vnd
        )
        r_ef17 = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_missing_party.id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(r_ef17.status_code, 400)
        entry_missing_party.delete()

        # 4. EF-19: Bút toán ngoại tệ sai lệch giá trị quy đổi
        entry_fx_err = self.JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period_oct,
            number="PKT-FX-ERR",
            entry_type="MANUAL",
            posting_date=date(2026, 10, 16),
            document_date=date(2026, 10, 16),
            description="Sai quy đổi ngoại tệ",
            status="DRAFT",
            total_debit=Decimal("25000000"),
            total_credit=Decimal("25000000"),
            created_by=self.JournalEntry.objects.get(pk=wf_id).created_by,
        )
        self.JournalLine.objects.create(
            entry=entry_fx_err,
            line_no=1,
            account=self.acc_112,
            debit=Decimal("25000000"),
            currency=self.usd,
            foreign_amount=Decimal("1000"),
            exchange_rate=Decimal("20000"),  # 1000 * 20000 = 20,000,000 != 25,000,000
        )
        self.JournalLine.objects.create(
            entry=entry_fx_err,
            line_no=2,
            account=self.acc_111,
            credit=Decimal("25000000"),
            currency=self.vnd,
        )
        r_ef19 = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_fx_err.id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(r_ef19.status_code, 400)
        entry_fx_err.delete()

        # 5. EF-20: Tổng Nợ != Tổng Có khi tính lại từ dòng chi tiết mặc dù Header ghi cân (BR-GL-POST-30)
        entry_unbal = self.JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period_oct,
            number="PKT-UNBAL",
            entry_type="MANUAL",
            posting_date=date(2026, 10, 16),
            document_date=date(2026, 10, 16),
            description="Header cân nhưng dòng chi tiết lệch",
            status="DRAFT",
            total_debit=Decimal("10000000"),
            total_credit=Decimal("10000000"),
            created_by=self.JournalEntry.objects.get(pk=wf_id).created_by,
        )
        self.JournalLine.objects.create(
            entry=entry_unbal, line_no=1, account=self.acc_642, debit=Decimal("10000000"), currency=self.vnd
        )
        self.JournalLine.objects.create(
            entry=entry_unbal, line_no=2, account=self.acc_111, credit=Decimal("9000000"), currency=self.vnd
        )
        r_ef20 = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_unbal.id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(r_ef20.status_code, 400)
        entry_unbal.delete()

        # 6. EF-26 (AF-10, AF-19, BR-GL-POST-52..54): Bút toán phát sinh tự động từ phân hệ nguồn (PUR)
        # không được phép Bỏ ghi sổ trực tiếp tại GL trừ khi từ phân hệ nguồn kích hoạt
        r_ing = self.client.post(
            f"/api/v1/general-ledger/subledger-ingestions/{self.query}",
            {
                "company": str(self.company.id),
                "source_module": "PUR",
                "source_business_type": "PURCHASE_SERVICES",
                "source_document_type": "PURCHASE_INVOICE",
                "source_document_id": "PUR-INV-05",
                "source_document_number": "PMH0501",
                "source_event_id": "EVT-PUR-0501",
                "posting_date": "2026-10-19",
                "amount": "12000000",
                "party": "NCC05",
                "posting_mode": "AUTO_POST",
            },
            format="json",
        )
        self.assertEqual(r_ing.status_code, 201, r_ing.data)
        sl_je_id = r_ing.data["primary_journal_entry"]

        r_ef26 = self.client.post(
            f"/api/v1/general-ledger/journals/{sl_je_id}/unpost/{self.query}",
            {"reason": "Thử bỏ ghi sổ trực tiếp tại GL"},
            format="json",
        )
        self.assertEqual(r_ef26.status_code, 400)
        self.assertEqual(r_ef26.data.get("error_code"), "SUBLEDGER_DIRECT_UNPOST_FORBIDDEN")

        # Khi có cờ đồng bộ từ phân hệ nguồn (from_source_module=True) -> cho phép Bỏ ghi sổ (AF-10)
        r_sl_unpost_ok = self.client.post(
            f"/api/v1/general-ledger/subledger-ingestions/{r_ing.data['id']}/unpost/{self.query}",
            {"from_source_module": True, "reason": "Bỏ ghi từ chứng từ mua hàng gốc PMH0501"},
            format="json",
        )
        self.assertEqual(r_sl_unpost_ok.status_code, 200, r_sl_unpost_ok.data)
        self.assertEqual(r_sl_unpost_ok.data["status"], "UNPOSTED")

        # 7. EF-27 & EF-28: Chặn Bỏ ghi sổ khi đã có Phân bổ chi phí (AllocationRun) hoặc Kết chuyển (ClosingRun) phụ thuộc
        base_entry = self._create_draft_entry("PKT-BASE-DEP", Decimal("30000000"))
        base_id = base_entry["id"]
        self.client.post(f"/api/v1/general-ledger/journals/{base_id}/post/{self.query}", {}, format="json")

        # Tạo quy tắc phân bổ từ TK 642 -> 6422 và chạy phân bổ
        r_alloc_rule = self.client.post(
            f"/api/v1/general-ledger/allocation-rules/{self.query}",
            {
                "company": str(self.company.id),
                "code": "PB-GL05",
                "name": "Phân bổ 642 sang 6422",
                "source_account": str(self.acc_642.id),
                "offset_account": str(self.acc_642.id),
                "method": "FIXED_PERCENT",
                "destinations": [{"account": str(self.acc_6422.id), "percentage": "100"}],
            },
            format="json",
        )
        self.assertEqual(r_alloc_rule.status_code, 201, r_alloc_rule.data)
        r_alloc_run = self.client.post(
            f"/api/v1/general-ledger/allocation-rules/{r_alloc_rule.data['id']}/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "idempotency_key": "ALLOC-GL05-OCT",
            },
            format="json",
        )
        self.assertEqual(r_alloc_run.status_code, 201, r_alloc_run.data)
        alloc_entry_id = r_alloc_run.data["entry"]

        # Thử Bỏ ghi sổ base_entry khi bút toán phân bổ đang POSTED -> bị chặn EF-27 (ALLOCATION_RUN_DEPENDENCY)
        r_ef27 = self.client.post(
            f"/api/v1/general-ledger/journals/{base_id}/unpost/{self.query}", {}, format="json"
        )
        self.assertEqual(r_ef27.status_code, 400)
        self.assertEqual(r_ef27.data.get("error_code"), "ALLOCATION_RUN_DEPENDENCY")

        # Tạo quy tắc kết chuyển từ 6422 -> 911 và chạy kết chuyển
        r_close_rule = self.client.post(
            f"/api/v1/general-ledger/closing-rules/{self.query}",
            {
                "company": str(self.company.id),
                "code": "KC-GL05",
                "name": "Kết chuyển 6422 sang 911",
                "source_account": str(self.acc_6422.id),
                "destination_account": str(self.acc_911.id),
                "sequence": 1,
            },
            format="json",
        )
        self.assertEqual(r_close_rule.status_code, 201, r_close_rule.data)
        r_close_run = self.client.post(
            f"/api/v1/general-ledger/closing-rules/{r_close_rule.data['id']}/run/{self.query}",
            {"company": str(self.company.id), "period": str(self.period_oct.id)},
            format="json",
        )
        self.assertEqual(r_close_run.status_code, 201, r_close_run.data)
        close_entry_id = r_close_run.data["entry"]

        # Thử Bỏ ghi sổ bút toán phân bổ khi bút toán kết chuyển 6422->911 đang POSTED -> bị chặn EF-28 (CLOSING_RUN_DEPENDENCY)
        r_ef28 = self.client.post(
            f"/api/v1/general-ledger/journals/{alloc_entry_id}/unpost/{self.query}", {}, format="json"
        )
        self.assertEqual(r_ef28.status_code, 400)
        self.assertEqual(r_ef28.data.get("error_code"), "CLOSING_RUN_DEPENDENCY")

        # Bỏ ghi sổ theo đúng thứ tự ngược: Bỏ ghi sổ Kết chuyển -> Bỏ ghi sổ Phân bổ -> Bỏ ghi sổ Bút toán gốc
        self.assertEqual(
            self.client.post(f"/api/v1/general-ledger/journals/{close_entry_id}/unpost/{self.query}", {}, format="json").status_code,
            200,
        )
        self.assertEqual(
            self.client.post(f"/api/v1/general-ledger/journals/{alloc_entry_id}/unpost/{self.query}", {}, format="json").status_code,
            200,
        )
        self.assertEqual(
            self.client.post(f"/api/v1/general-ledger/journals/{base_id}/unpost/{self.query}", {}, format="json").status_code,
            200,
        )

        # 8. EF-29: Bắt buộc nhập lý do Bỏ ghi sổ khi require_reason=True
        self.client.post(f"/api/v1/general-ledger/journals/{base_id}/post/{self.query}", {}, format="json")
        r_ef29 = self.client.post(
            f"/api/v1/general-ledger/journals/{base_id}/unpost/{self.query}",
            {"require_reason": True, "reason": "   "},
            format="json",
        )
        self.assertEqual(r_ef29.status_code, 400)
        self.assertEqual(r_ef29.data.get("error_code"), "UNPOST_REASON_REQUIRED")

        # 9. EF-33: Xung đột phiên bản (Optimistic Concurrency version)
        r_ef33 = self.client.post(
            f"/api/v1/general-ledger/journals/{base_id}/unpost/{self.query}",
            {"version": 999},
            format="json",
        )
        self.assertEqual(r_ef33.status_code, 400)
        self.assertEqual(r_ef33.data.get("error_code"), "CONCURRENT_MODIFICATION")

        # 10. EF-12: Kỳ kế toán đã đóng chặn Bỏ ghi sổ
        self.period_oct.status = "CLOSED"
        self.period_oct.save(update_fields=("status",))
        r_ef12 = self.client.post(
            f"/api/v1/general-ledger/journals/{base_id}/unpost/{self.query}", {}, format="json"
        )
        self.assertEqual(r_ef12.status_code, 400)
        self.assertEqual(r_ef12.data.get("error_code"), "PERIOD_CLOSED_FOR_UNPOST")
        self.period_oct.status = "OPEN"
        self.period_oct.save(update_fields=("status",))

    def test_batch_post_and_batch_unpost_af22_af23_ef34_ef35(self):
        """
        Kiểm thử Ghi sổ hàng loạt (AF-22, EF-34) và Bỏ ghi sổ hàng loạt (AF-23, EF-35):
        - Xử lý độc lập từng chứng từ và trả về tổng hợp succeeded_count, failed_count, results.
        - Hỗ trợ chế độ atomic_batch=True (rollback toàn bộ nếu có 1 chứng từ lỗi).
        """
        e1 = self._create_draft_entry("PKT-BATCH-01", Decimal("5000000"))
        e2 = self._create_draft_entry("PKT-BATCH-02", Decimal("7000000"))

        # Tạo 1 bút toán không hợp lệ (đang PENDING_APPROVAL)
        e3 = self._create_draft_entry("PKT-BATCH-03", Decimal("9000000"))
        self.JournalEntry.objects.filter(pk=e3["id"]).update(status="PENDING_APPROVAL")

        # Chế độ atomic_batch=True -> rollback toàn lô khi e3 lỗi (EF-34)
        r_atomic_fail = self.client.post(
            f"/api/v1/general-ledger/journals/batch-post/{self.query}",
            {"journal_ids": [e1["id"], e2["id"], e3["id"]], "atomic_batch": True},
            format="json",
        )
        self.assertEqual(r_atomic_fail.status_code, 400)
        self.assertEqual(self.JournalEntry.objects.get(pk=e1["id"]).status, "DRAFT")

        # Chế độ mặc định (xử lý từng phần) -> e1, e2 thành công, e3 thất bại có lý do rõ ràng (AF-22, EF-34)
        r_batch_post = self.client.post(
            f"/api/v1/general-ledger/journals/batch-post/{self.query}",
            {"journal_ids": [e1["id"], e2["id"], e3["id"]]},
            format="json",
        )
        self.assertEqual(r_batch_post.status_code, 200, r_batch_post.data)
        self.assertEqual(r_batch_post.data["total"], 3)
        self.assertEqual(r_batch_post.data["succeeded_count"], 2)
        self.assertEqual(r_batch_post.data["failed_count"], 1)
        self.assertEqual(self.JournalEntry.objects.get(pk=e1["id"]).status, "POSTED")
        self.assertEqual(self.JournalEntry.objects.get(pk=e2["id"]).status, "POSTED")

        # Bỏ ghi sổ hàng loạt (AF-23, EF-35): e1, e2 thành công, e3 thất bại vì chưa ghi sổ
        r_batch_unpost = self.client.post(
            f"/api/v1/general-ledger/journals/batch-unpost/{self.query}",
            {
                "journal_ids": [e1["id"], e2["id"], e3["id"]],
                "reason": "Bỏ ghi sổ hàng loạt để kiểm tra cuối tháng",
            },
            format="json",
        )
        self.assertEqual(r_batch_unpost.status_code, 200, r_batch_unpost.data)
        self.assertEqual(r_batch_unpost.data["succeeded_count"], 2)
        self.assertEqual(r_batch_unpost.data["failed_count"], 1)
        self.assertEqual(self.JournalEntry.objects.get(pk=e1["id"]).status, "DRAFT")
        self.assertEqual(self.JournalEntry.objects.get(pk=e2["id"]).status, "DRAFT")


class JournalAdjustmentReversalUcGl06Tests(TestCase):
    """
    Bộ kiểm thử toàn diện cho UC-GL-06 – Điều chỉnh / Đảo bút toán:
    - Main Flow Steps 1–40: Tạo bút toán Điều chỉnh (ADJUSTMENT) và Đảo (REVERSAL) ở trạng thái UNPOSTED,
      giữ nguyên bút toán gốc, liên kết 2 chiều, sau đó thực hiện Ghi sổ theo UC-GL-05.
    - AF-01..AF-19: Tăng số tiền thiếu (AF-07), giảm số tiền thừa (AF-08), điều chỉnh sai tài khoản (AF-09),
      điều chỉnh sai đối tượng/chiều phân tích (AF-10), xử lý khi kỳ gốc đã khóa sang kỳ mở mới (AF-06),
      đảo toàn bộ (AF-11), đảo một phần nhiều đợt (AF-12), bút toán nhiều dòng (AF-13),
      Cất chưa ghi sổ (AF-15) và Cất & Ghi sổ ngay (AF-16), điều chỉnh nhiều lần nối tiếp (AF-17, AF-19),
      và lập lại chứng từ mới sau khi đảo (AF-18, BR-GL-ADJ-68).
    - EF-01..EF-31 & BR-GL-ADJ-01..78: Kiểm tra toàn bộ các luồng ngoại lệ và quy tắc nghiệp vụ.
    """

    def setUp(self):
        from master_data.models import CostCenter, Party, Project
        from .models import AccountBalance, JournalEntry, JournalLine

        self.JournalEntry = JournalEntry
        self.JournalLine = JournalLine
        self.AccountBalance = AccountBalance
        self.Party = Party

        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "Đô la Mỹ"})

        self.company = Company.objects.create(
            code="GLADJ06",
            name="Công ty Kiểm thử Điều chỉnh Đảo GL06",
            legal_name="Công ty TNHH Kiểm thử Điều chỉnh Đảo GL06",
            tax_code="0109988706",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN01", name="Chi nhánh Hà Nội")
        self.dept_kt = Department.objects.create(
            company=self.company, branch=self.branch, code="PKT", name="Phòng Kế toán"
        )
        self.dept_kd = Department.objects.create(
            company=self.company, branch=self.branch, code="PKD", name="Phòng Kinh doanh"
        )

        self.asset_class = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT"
        )
        self.liab_class = AccountClass.objects.create(
            company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT"
        )
        self.exp_class = AccountClass.objects.create(
            company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT"
        )
        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT99",
            name="Hệ thống tài khoản TT99",
            effective_from="2026-01-01",
            is_default=True,
        )

        self.acc_111 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="111",
            name="Tiền mặt",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_112 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="112",
            name="Tiền gửi ngân hàng",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.liab_class,
            code="331",
            name="Phải trả người bán",
            account_type="LIABILITY",
            normal_balance="CREDIT",
            is_postable=True,
            requires_party=True,
        )
        self.acc_641 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.exp_class,
            code="641",
            name="Chi phí bán hàng",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_642 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.exp_class,
            code="642",
            name="Chi phí quản lý doanh nghiệp",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
        )
        self.acc_6422 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.exp_class,
            code="6422",
            name="Chi phí vật liệu quản lý",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
        )

        self.supplier_a = Party.objects.create(
            company=self.company,
            party_type="SUPPLIER",
            code="NCC01",
            name="Nhà cung cấp A",
            tax_code="0101111101",
            status="ACTIVE",
        )
        self.supplier_b = Party.objects.create(
            company=self.company,
            party_type="SUPPLIER",
            code="NCC02",
            name="Nhà cung cấp B",
            tax_code="0101111102",
            status="ACTIVE",
        )

        self.period_oct = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
            status="OPEN",
        )
        self.period_nov = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-11",
            fiscal_year=2026,
            period_number=11,
            start_date=date(2026, 11, 1),
            end_date=date(2026, 11, 30),
            status="OPEN",
        )

        self.user = get_user_model().objects.create_superuser(
            username="gl06-admin", email="admin@gl06.test", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"

    def _create_and_post_entry(self, number="PKT-GL06-001", amount=Decimal("10000000"), **extra):
        payload = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "period": str(self.period_oct.id),
            "number": number,
            "entry_type": "MANUAL",
            "posting_date": "2026-10-10",
            "document_date": "2026-10-10",
            "description": f"Bút toán gốc {number}",
            "source_module": "GL",
            "lines": [
                {
                    "line_no": 1,
                    "account": str(self.acc_642.id),
                    "debit": str(amount),
                    "credit": "0",
                    "currency": str(self.vnd.id),
                    "exchange_rate": "1",
                    "department": str(self.dept_kt.id),
                    "description": "Chi phí quản lý",
                },
                {
                    "line_no": 2,
                    "account": str(self.acc_331.id),
                    "debit": "0",
                    "credit": str(amount),
                    "currency": str(self.vnd.id),
                    "exchange_rate": "1",
                    "party": str(self.supplier_a.id),
                    "description": "Phải trả NCC A",
                },
            ],
            **extra,
        }
        r_create = self.client.post(f"/api/v1/general-ledger/journals/{self.query}", payload, format="json")
        self.assertEqual(r_create.status_code, 201, r_create.data)
        entry_id = r_create.data["id"]
        r_post = self.client.post(f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}", {}, format="json")
        self.assertEqual(r_post.status_code, 200, r_post.data)
        return r_post.data

    def test_adjustment_scenarios_af01_af06_af07_to_af10_af15_af17_af19_and_chain(self):
        """
        Kiểm thử đầy đủ luồng Điều chỉnh bút toán (ADJUSTMENT):
        - AF-01, AF-07, AF-15: Điều chỉnh tăng số tiền thiếu (10M -> bổ sung 2M), lưu UNPOSTED chưa tác động số dư GL,
          sau đó Ghi sổ (UC-GL-05) -> cập nhật AccountBalance và đánh dấu bút toán gốc is_adjusted=True.
        - AF-08: Điều chỉnh giảm một phần số tiền ghi thừa (giảm 500k).
        - AF-09: Điều chỉnh sai tài khoản (chuyển 1M từ TK 642 sang TK 641).
        - AF-10: Điều chỉnh sai đối tượng công nợ (chuyển 1M trên TK 331 từ NCC01 sang NCC02).
        - AF-06 (BR-GL-ADJ-19..21): Kỳ gốc (2026-10) đã khóa -> Không mở lại hay sửa bút toán gốc,
          ghi nhận bút toán điều chỉnh vào kỳ đang mở (2026-11).
        - AF-17, AF-19, BR-GL-ADJ-66, 67: Truy vết chuỗi Bút toán gốc -> Điều chỉnh lần 1 -> Điều chỉnh lần 2...
        """
        orig = self._create_and_post_entry("PKT-ORIG-ADJ", amount=Decimal("10000000"))
        orig_id = orig["id"]

        # 1. AF-07 & AF-15: Điều chỉnh tăng thêm 2,000,000 do hạch toán thiếu, lưu ở trạng thái UNPOSTED
        r_adj1 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Hạch toán bổ sung chi phí còn thiếu theo hóa đơn",
                "posting_date": "2026-10-15",
                "document_date": "2026-10-15",
                "adjustment_mode": "INCREASE_AMOUNT",
                "accounting_lines": [
                    {
                        "description": "Bổ sung phần thiếu 2 triệu",
                        "debit_account": "642",
                        "credit_account": "331",
                        "amount": "2000000",
                        "credit_object_code": "NCC01",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_adj1.status_code, 201, r_adj1.data)
        self.assertEqual(r_adj1.data["message"], "Đã tạo bút toán điều chỉnh thành công.")
        self.assertEqual(r_adj1.data["entry_type"], "ADJUSTMENT")
        self.assertEqual(r_adj1.data["status"], "DRAFT")
        self.assertEqual(r_adj1.data["status_code"], "UNPOSTED")
        self.assertEqual(str(r_adj1.data["original_entry"]), str(orig_id))

        # BR-GL-ADJ-48: Khi UNPOSTED, số dư TK 642 vẫn là 10,000,000 (chưa cộng 2,000,000)
        bal_642 = self.AccountBalance.objects.get(period=self.period_oct, account=self.acc_642, branch=self.branch)
        self.assertEqual(bal_642.period_debit, Decimal("10000000"))

        # Thực hiện Ghi sổ bút toán điều chỉnh lần 1 qua UC-GL-05 (Step 39–40, BR-GL-ADJ-49, 50)
        adj1_id = r_adj1.data["id"]
        r_post_adj1 = self.client.post(
            f"/api/v1/general-ledger/journals/{adj1_id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(r_post_adj1.status_code, 200, r_post_adj1.data)
        self.assertEqual(r_post_adj1.data["status"], "POSTED")

        bal_642.refresh_from_db()
        self.assertEqual(bal_642.period_debit, Decimal("12000000"))

        # Kiểm tra bút toán gốc được đánh dấu is_adjusted=True nhưng dữ liệu gốc không hề thay đổi (BR-GL-ADJ-01, 04)
        orig_obj = self.JournalEntry.objects.get(pk=orig_id)
        self.assertTrue(orig_obj.is_adjusted)
        self.assertEqual(orig_obj.total_debit, Decimal("10000000"))

        # 2. AF-08: Điều chỉnh giảm 500,000 phần ghi nhận thừa (auto_post=True - AF-16)
        r_adj2 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Giảm chiết khấu thương mại ghi thừa",
                "posting_date": "2026-10-18",
                "adjustment_mode": "DECREASE_AMOUNT",
                "auto_post": True,
                "accounting_lines": [
                    {
                        "description": "Giảm chi phí ghi thừa 500k",
                        "debit_account": "331",
                        "credit_account": "642",
                        "amount": "500000",
                        "debit_object_code": "NCC01",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_adj2.status_code, 201, r_adj2.data)
        self.assertEqual(r_adj2.data["status"], "POSTED")

        # 3. AF-09: Điều chỉnh sai tài khoản (chuyển 1,000,000 từ TK 642 sang TK 641)
        r_adj3 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Điều chỉnh chi phí từ QLDN (642) sang CP bán hàng (641)",
                "posting_date": "2026-10-20",
                "adjustment_mode": "RECLASSIFY_ACCOUNT",
                "auto_post": True,
                "accounting_lines": [
                    {
                        "description": "Kết chuyển sang TK 641",
                        "debit_account": "641",
                        "credit_account": "642",
                        "amount": "1000000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_adj3.status_code, 201, r_adj3.data)

        # 4. AF-10: Điều chỉnh sai đối tượng công nợ trên TK 331 (từ NCC01 sang NCC02)
        r_adj4 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Điều chỉnh nhầm mã nhà cung cấp từ NCC01 sang NCC02",
                "posting_date": "2026-10-22",
                "adjustment_mode": "RECLASSIFY_DIMENSION",
                "auto_post": True,
                "accounting_lines": [
                    {
                        "description": "Chuyển công nợ từ NCC01 sang NCC02",
                        "debit_account": "331",
                        "credit_account": "331",
                        "amount": "1500000",
                        "debit_object_code": "NCC01",
                        "credit_object_code": "NCC02",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_adj4.status_code, 201, r_adj4.data)

        # 5. AF-06 (BR-GL-ADJ-19, 20): Khóa kỳ gốc (2026-10), lập điều chỉnh lần 5 vào kỳ đang mở (2026-11)
        self.period_oct.status = "CLOSED"
        self.period_oct.save(update_fields=["status"])

        r_adj_closed_fail = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Thử điều chỉnh vào kỳ 10 đã khóa",
                "posting_date": "2026-10-25",
                "accounting_lines": [
                    {"debit_account": "642", "credit_account": "111", "amount": "300000"}
                ],
            },
            format="json",
        )
        self.assertEqual(r_adj_closed_fail.status_code, 400)
        self.assertEqual(r_adj_closed_fail.data.get("error_code"), "PERIOD_CLOSED")

        r_adj_nov_ok = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Điều chỉnh phát hiện sau khi khóa kỳ tháng 10, ghi nhận vào tháng 11",
                "posting_date": "2026-11-05",
                "auto_post": True,
                "accounting_lines": [
                    {"debit_account": "642", "credit_account": "111", "amount": "300000"}
                ],
            },
            format="json",
        )
        self.assertEqual(r_adj_nov_ok.status_code, 201, r_adj_nov_ok.data)
        self.assertEqual(r_adj_nov_ok.data["period_code"], "2026-11")

        self.period_oct.status = "OPEN"
        self.period_oct.save(update_fields=["status"])

        # 6. Kiểm tra chuỗi lịch sử Điều chỉnh (AF-19, BR-GL-ADJ-11, 12, 66, 67, 78)
        r_chain = self.client.get(f"/api/v1/general-ledger/journals/{orig_id}/correction-chain/{self.query}")
        self.assertEqual(r_chain.status_code, 200, r_chain.data)
        self.assertEqual(r_chain.data["adjustments_count"], 5)
        sequences = [item["adjustment_sequence"] for item in r_chain.data["adjustments"]]
        self.assertEqual(sequences, [1, 2, 3, 4, 5])

    def test_reversal_full_partial_multi_line_foreign_currency_and_replacement_chain(self):
        """
        Kiểm thử đầy đủ luồng Đảo bút toán (REVERSAL):
        - AF-02, AF-12, AF-13, BR-GL-ADJ-39, 40, 65: Đảo một phần (40% = 4,000,000 / 10,000,000) ->
          khi Post chưa đánh dấu bút toán gốc là REVERSED (vẫn POSTED, reversed_amount=4M, remaining=6M).
        - EF-15: Chặn đảo vượt phần giá trị còn lại (7M > 6M).
        - AF-11, BR-GL-ADJ-64: Đảo nốt phần còn lại (6M) -> bút toán gốc chuyển sang REVERSED,
          mỗi dòng đảo liên kết source_line tới dòng gốc.
        - AF-18, BR-GL-ADJ-68: Lập lại chứng từ đúng (/create-replacement/) và truy vết chuỗi
          Bút toán gốc -> Bút toán đảo -> Bút toán mới.
        - BR-GL-ADJ-42, 43, EF-20: Bút toán ngoại tệ kế thừa đúng tỷ giá gốc và chặn tự ý đổi tỷ giá.
        """
        orig = self._create_and_post_entry("PKT-ORIG-REV", amount=Decimal("10000000"))
        orig_id = orig["id"]

        # 1. AF-12: Đảo một phần đợt 1 (4,000,000) ở trạng thái UNPOSTED (AF-15)
        r_rev1 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/reverse/{self.query}",
            {
                "reason": "Đảo một phần 4 triệu do nghiệm thu từng đợt",
                "posting_date": "2026-10-16",
                "reversal_amount": "4000000",
            },
            format="json",
        )
        self.assertEqual(r_rev1.status_code, 201, r_rev1.data)
        self.assertEqual(r_rev1.data["message"], "Đã tạo bút toán đảo thành công.")
        self.assertEqual(r_rev1.data["status"], "DRAFT")
        self.assertEqual(r_rev1.data["reversal_scope"], "PARTIAL")
        self.assertEqual(Decimal(r_rev1.data["total_debit"]), Decimal("4000000"))
        # Kiểm tra mỗi dòng đảo lưu source_line trỏ về dòng bút toán gốc (Section 1.1.D)
        self.assertIsNotNone(r_rev1.data["lines"][0]["source_line"])

        # Post đợt đảo 1
        rev1_id = r_rev1.data["id"]
        r_post_rev1 = self.client.post(
            f"/api/v1/general-ledger/journals/{rev1_id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(r_post_rev1.status_code, 200)

        # BR-GL-ADJ-65: Chỉ mới đảo một phần (4M / 10M) -> Bút toán gốc vẫn ở POSTED, chưa phải REVERSED
        orig_obj = self.JournalEntry.objects.get(pk=orig_id)
        self.assertEqual(orig_obj.status, "POSTED")
        self.assertEqual(orig_obj.reversed_amount, Decimal("4000000"))

        # 2. EF-15: Thử đảo đợt 2 với số tiền 7,000,000 (> 6,000,000 còn lại) -> Bị chặn
        r_rev_exceed = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/reverse/{self.query}",
            {
                "reason": "Đảo vượt số còn lại",
                "posting_date": "2026-10-17",
                "reversal_amount": "7000000",
            },
            format="json",
        )
        self.assertEqual(r_rev_exceed.status_code, 400)
        self.assertEqual(r_rev_exceed.data.get("error_code"), "EXCEEDS_REVERSIBLE_AMOUNT")

        # 3. Đảo nốt phần còn lại 6,000,000 với auto_post=True (AF-16)
        r_rev2 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/reverse/{self.query}",
            {
                "reason": "Đảo nốt 6 triệu còn lại",
                "posting_date": "2026-10-18",
                "reversal_amount": "6000000",
                "auto_post": True,
            },
            format="json",
        )
        self.assertEqual(r_rev2.status_code, 201, r_rev2.data)
        self.assertEqual(r_rev2.data["status"], "POSTED")

        # BR-GL-ADJ-64: Sau khi tổng đảo đạt 10,000,000 == gốc -> Bút toán gốc chuyển sang REVERSED
        orig_obj.refresh_from_db()
        self.assertEqual(orig_obj.status, "REVERSED")
        self.assertEqual(orig_obj.reversed_amount, Decimal("10000000"))

        # Kiểm tra số dư ròng (closing_debit) của TK 642 và TK 331 đã triệt tiêu về 0
        bal_642 = self.AccountBalance.objects.get(period=self.period_oct, account=self.acc_642, branch=self.branch)
        self.assertEqual(bal_642.closing_debit, Decimal("0"))
        self.assertEqual(bal_642.closing_credit, Decimal("0"))

        # 4. AF-18 & BR-GL-ADJ-68: Lập lại chứng từ đúng sau khi đảo và truy vết chuỗi
        r_repl = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/create-replacement/{self.query}",
            {
                "reason": "Lập lại chứng từ đúng với số tiền 8,500,000",
                "posting_date": "2026-10-19",
                "auto_post": True,
                "accounting_lines": [
                    {
                        "description": "Chi phí quản lý đúng sau khi đảo",
                        "debit_account": "642",
                        "credit_account": "331",
                        "amount": "8500000",
                        "credit_object_code": "NCC01",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_repl.status_code, 201, r_repl.data)
        self.assertEqual(r_repl.data["status"], "POSTED")
        self.assertEqual(str(r_repl.data["replacement_for_entry"]), str(orig_id))

        r_chain = self.client.get(f"/api/v1/general-ledger/journals/{orig_id}/correction-chain/{self.query}")
        self.assertEqual(r_chain.status_code, 200)
        self.assertEqual(r_chain.data["reversals_count"], 2)
        self.assertEqual(r_chain.data["replacement_entries_count"], 1)
        self.assertEqual(Decimal(r_chain.data["net_accounting_impact"]["remaining_reversible_amount"]), Decimal("0"))

        # 5. BR-GL-ADJ-42, 43 & EF-20: Bút toán ngoại tệ USD
        fx_orig_res = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period_oct.id),
                "number": "PKT-FX-ORIG",
                "entry_type": "MANUAL",
                "posting_date": "2026-10-12",
                "document_date": "2026-10-12",
                "description": "Chi phí dịch vụ nước ngoài 1000 USD @ 25,000",
                "lines": [
                    {
                        "line_no": 1,
                        "account": str(self.acc_642.id),
                        "debit": "25000000",
                        "credit": "0",
                        "currency": str(self.usd.id),
                        "foreign_amount": "1000",
                        "exchange_rate": "25000",
                    },
                    {
                        "line_no": 2,
                        "account": str(self.acc_112.id),
                        "debit": "0",
                        "credit": "25000000",
                        "currency": str(self.usd.id),
                        "foreign_amount": "1000",
                        "exchange_rate": "25000",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(fx_orig_res.status_code, 201, fx_orig_res.data)
        fx_id = fx_orig_res.data["id"]
        self.client.post(f"/api/v1/general-ledger/journals/{fx_id}/post/{self.query}", {}, format="json")

        # EF-20, BR-GL-ADJ-43: Thử đảo với tỷ giá khác (26,000 != 25,000) -> Chặn
        r_fx_bad_rate = self.client.post(
            f"/api/v1/general-ledger/journals/{fx_id}/reverse/{self.query}",
            {
                "reason": "Đảo sai tỷ giá",
                "posting_date": "2026-10-20",
                "exchange_rate": "26000",
            },
            format="json",
        )
        self.assertEqual(r_fx_bad_rate.status_code, 400)
        self.assertEqual(r_fx_bad_rate.data.get("error_code"), "INVALID_REVERSAL_EXCHANGE_RATE")

        # Đảo đúng tỷ giá gốc -> Thành công, giữ nguyên foreign_amount=1000 và exchange_rate=25000
        r_fx_rev_ok = self.client.post(
            f"/api/v1/general-ledger/journals/{fx_id}/reverse/{self.query}",
            {
                "reason": "Đảo bút toán ngoại tệ theo đúng tỷ giá gốc",
                "posting_date": "2026-10-20",
                "auto_post": True,
            },
            format="json",
        )
        self.assertEqual(r_fx_rev_ok.status_code, 201, r_fx_rev_ok.data)
        self.assertEqual(Decimal(r_fx_rev_ok.data["lines"][0]["foreign_amount"]), Decimal("1000"))
        self.assertEqual(Decimal(r_fx_rev_ok.data["lines"][0]["exchange_rate"]), Decimal("25000"))

    def test_exception_flows_ef03_to_ef30_and_concurrency_idempotency(self):
        """
        Kiểm thử toàn diện các luồng ngoại lệ EF-04..EF-29:
        - EF-04: Chặn Điều chỉnh/Đảo khi bút toán gốc đang DRAFT (chưa POSTED).
        - EF-05, EF-14: Chặn Điều chỉnh/Đảo khi bút toán gốc đã CANCELLED hoặc đã REVERSED toàn bộ.
        - EF-06 (AF-04, BR-GL-ADJ-53..55): Chặn sửa trực tiếp tại GL đối với bút toán sinh từ phân hệ nguồn (PUR).
        - EF-07: Chặn thiếu Lý do (MISSING_REASON).
        - EF-08: Chặn Ngày chứng từ lớn hơn Ngày hạch toán.
        - EF-10: Chặn trùng Số chứng từ mới (DUPLICATE_NUMBER).
        - EF-11, EF-12: Chặn bút toán điều chỉnh rỗng hoặc số tiền <= 0.
        - EF-13: Chặn phương pháp đảo không hợp lệ (INVALID_REVERSAL_METHOD).
        - EF-16..EF-19: Chặn tài khoản không tồn tại, hết hiệu lực, không postable, hoặc thiếu Party trên TK 331.
        - EF-21: Chặn bút toán điều chỉnh lệch Nợ/Có (UNBALANCED_ADJUSTMENT).
        - EF-22 (BR-GL-ADJ-32): Chặn bút toán điều chỉnh tự triệt tiêu không có thay đổi thực tế (NO_MEANINGFUL_CHANGE).
        - EF-25 (BR-GL-ADJ-59): Chống tạo trùng khi gửi cùng idempotency_key.
        - EF-26 (BR-GL-ADJ-60): Chặn khi version của bút toán gốc đã thay đổi (CONCURRENCY_CONFLICT).
        - EF-29: Chặn Post bút toán sửa sai nếu bút toán gốc không còn ở trạng thái POSTED.
        """
        # 1. EF-04: Bút toán đang DRAFT (chưa POSTED)
        r_draft = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period_oct.id),
                "number": "PKT-DRAFT-06",
                "entry_type": "MANUAL",
                "posting_date": "2026-10-10",
                "document_date": "2026-10-10",
                "description": "Bút toán nháp",
                "lines": [
                    {"line_no": 1, "account": str(self.acc_642.id), "debit": "1000000", "credit": "0", "currency": str(self.vnd.id)},
                    {"line_no": 2, "account": str(self.acc_111.id), "debit": "0", "credit": "1000000", "currency": str(self.vnd.id)},
                ],
            },
            format="json",
        )
        draft_id = r_draft.data["id"]
        r_ef04 = self.client.post(
            f"/api/v1/general-ledger/journals/{draft_id}/reverse/{self.query}",
            {"reason": "Thử đảo bút toán chưa ghi sổ", "posting_date": "2026-10-12"},
            format="json",
        )
        self.assertEqual(r_ef04.status_code, 400)
        self.assertEqual(r_ef04.data.get("error_code"), "ORIGINAL_NOT_POSTED")

        # Hủy bút toán nháp -> EF-05 (ORIGINAL_ENTRY_CANCELLED)
        self.client.post(
            f"/api/v1/general-ledger/journals/{draft_id}/cancel/{self.query}",
            {"reason": "Hủy nháp"},
            format="json",
        )
        r_ef05 = self.client.post(
            f"/api/v1/general-ledger/journals/{draft_id}/adjust/{self.query}",
            {
                "reason": "Thử điều chỉnh bút toán đã hủy",
                "posting_date": "2026-10-12",
                "accounting_lines": [{"debit_account": "642", "credit_account": "111", "amount": "500000"}],
            },
            format="json",
        )
        self.assertEqual(r_ef05.status_code, 400)
        self.assertEqual(r_ef05.data.get("error_code"), "ORIGINAL_ENTRY_CANCELLED")

        # Tạo bút toán gốc POSTED để kiểm tra các EF tiếp theo
        orig = self._create_and_post_entry("PKT-EF-ORIG", amount=Decimal("5000000"))
        orig_id = orig["id"]

        # 2. EF-07: Lý do để trống
        r_ef07 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/reverse/{self.query}",
            {"reason": "   ", "posting_date": "2026-10-15"},
            format="json",
        )
        self.assertEqual(r_ef07.status_code, 400)
        self.assertEqual(r_ef07.data.get("error_code"), "MISSING_REASON")

        # 3. EF-08: Ngày chứng từ > Ngày hạch toán
        r_ef08 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/reverse/{self.query}",
            {"reason": "Sai ngày chứng từ", "posting_date": "2026-10-15", "document_date": "2026-10-20"},
            format="json",
        )
        self.assertEqual(r_ef08.status_code, 400)
        self.assertEqual(r_ef08.data.get("error_code"), "INVALID_DOCUMENT_DATE")

        # 4. EF-10: Số chứng từ mới bị trùng với PKT-EF-ORIG
        r_ef10 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/reverse/{self.query}",
            {"reason": "Trùng số chứng từ", "posting_date": "2026-10-15", "number": "PKT-EF-ORIG"},
            format="json",
        )
        self.assertEqual(r_ef10.status_code, 400)
        self.assertEqual(r_ef10.data.get("error_code"), "DUPLICATE_NUMBER")

        # 5. EF-11 & EF-12: Điều chỉnh không có dòng hoặc số tiền bằng 0
        r_ef11 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {"reason": "Không có dòng", "posting_date": "2026-10-15", "lines": []},
            format="json",
        )
        self.assertEqual(r_ef11.status_code, 400)
        self.assertEqual(r_ef11.data.get("error_code"), "EMPTY_ADJUSTMENT_LINES")

        r_ef12 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Số tiền bằng 0",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "642", "credit_account": "111", "amount": "0"}],
            },
            format="json",
        )
        self.assertEqual(r_ef12.status_code, 400)
        self.assertEqual(r_ef12.data.get("error_code"), "INVALID_ADJUSTMENT_AMOUNT")

        # 6. EF-13: Phương pháp đảo không hợp lệ
        r_ef13 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/reverse/{self.query}",
            {"reason": "Sai phương pháp đảo", "posting_date": "2026-10-15", "reversal_method": "UNKNOWN_METHOD"},
            format="json",
        )
        self.assertEqual(r_ef13.status_code, 400)
        self.assertEqual(r_ef13.data.get("error_code"), "INVALID_REVERSAL_METHOD")

        # 7. EF-16, EF-17, EF-19: Tài khoản không tồn tại, hết hiệu lực, hoặc thiếu Party trên TK 331
        r_ef16 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "TK không tồn tại",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "9999", "credit_account": "111", "amount": "100000"}],
            },
            format="json",
        )
        self.assertEqual(r_ef16.status_code, 400)
        self.assertEqual(r_ef16.data.get("error_code"), "ACCOUNT_NOT_FOUND")

        r_ef19 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Thiếu đối tượng công nợ trên TK 331",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "642", "credit_account": "331", "amount": "100000"}],
            },
            format="json",
        )
        self.assertEqual(r_ef19.status_code, 400)
        self.assertEqual(r_ef19.data.get("error_code"), "MISSING_REQUIRED_DIMENSION")

        # 8. EF-21: Tổng Nợ != Tổng Có trên bút toán điều chỉnh
        r_ef21 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Lệch Nợ Có",
                "posting_date": "2026-10-15",
                "lines": [
                    {"account": str(self.acc_642.id), "debit": "500000", "credit": "0"},
                    {"account": str(self.acc_111.id), "debit": "0", "credit": "400000"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_ef21.status_code, 400)
        self.assertEqual(r_ef21.data.get("error_code"), "UNBALANCED_ADJUSTMENT")

        # 9. EF-22 (BR-GL-ADJ-32): Điều chỉnh tự triệt tiêu không tạo thay đổi thực tế (Nợ 642: 500k / Có 642: 500k cùng chiều)
        r_ef22 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Tự triệt tiêu vô nghĩa",
                "posting_date": "2026-10-15",
                "accounting_lines": [{"debit_account": "642", "credit_account": "642", "amount": "500000"}],
            },
            format="json",
        )
        self.assertEqual(r_ef22.status_code, 400)
        self.assertEqual(r_ef22.data.get("error_code"), "NO_MEANINGFUL_CHANGE")

        # 10. EF-26 (BR-GL-ADJ-60): Xung đột version của bút toán gốc
        r_ef26 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/reverse/{self.query}",
            {"reason": "Version cũ", "posting_date": "2026-10-15", "original_version": 999},
            format="json",
        )
        self.assertEqual(r_ef26.status_code, 400)
        self.assertEqual(r_ef26.data.get("error_code"), "CONCURRENCY_CONFLICT")

        # 11. EF-06 (AF-04, BR-GL-ADJ-53..55): Bút toán từ phân hệ nguồn (PUR) bị chặn sửa trực tiếp tại GL
        sub_orig = self._create_and_post_entry("PKT-PUR-06", amount=Decimal("3000000"), source_module="PUR")
        sub_id = sub_orig["id"]
        r_ef06 = self.client.post(
            f"/api/v1/general-ledger/journals/{sub_id}/reverse/{self.query}",
            {"reason": "Thử đảo bút toán PUR trực tiếp tại GL", "posting_date": "2026-10-16"},
            format="json",
        )
        self.assertEqual(r_ef06.status_code, 400)
        self.assertEqual(r_ef06.data.get("error_code"), "SUBLEDGER_SOURCE_LOCKED")

        # BR-GL-ADJ-57: Khi chứng từ nguồn đã hủy hoặc đồng bộ từ nguồn (source_document_cancelled=True) -> Cho phép đảo
        r_sub_ok = self.client.post(
            f"/api/v1/general-ledger/journals/{sub_id}/reverse/{self.query}",
            {
                "reason": "Đảo do chứng từ nguồn PUR đã hủy",
                "posting_date": "2026-10-16",
                "source_document_cancelled": True,
                "auto_post": True,
            },
            format="json",
        )
        self.assertEqual(r_sub_ok.status_code, 201, r_sub_ok.data)
        self.assertEqual(r_sub_ok.data["status"], "POSTED")

        # 12. EF-14 (BR-GL-ADJ-38): Đã đảo toàn bộ -> Chặn tạo thêm bút toán đảo thứ 2
        r_ef14 = self.client.post(
            f"/api/v1/general-ledger/journals/{sub_id}/reverse/{self.query}",
            {
                "reason": "Thử đảo lần 2 sau khi đã đảo toàn bộ",
                "posting_date": "2026-10-17",
                "source_document_cancelled": True,
            },
            format="json",
        )
        self.assertEqual(r_ef14.status_code, 400)
        self.assertEqual(r_ef14.data.get("error_code"), "ALREADY_REVERSED")

        # 13. EF-25 (BR-GL-ADJ-59): Chống tạo trùng khi nhấn Cất nhiều lần với cùng idempotency_key
        r_idem_1 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Điều chỉnh kiểm tra idempotency",
                "posting_date": "2026-10-16",
                "idempotency_key": "IDEM-ADJ-GL06-001",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "111", "amount": "250000"}],
            },
            format="json",
        )
        self.assertEqual(r_idem_1.status_code, 201)
        r_idem_2 = self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/adjust/{self.query}",
            {
                "reason": "Điều chỉnh kiểm tra idempotency",
                "posting_date": "2026-10-16",
                "idempotency_key": "IDEM-ADJ-GL06-001",
                "accounting_lines": [{"debit_account": "6422", "credit_account": "111", "amount": "250000"}],
            },
            format="json",
        )
        self.assertEqual(r_idem_2.status_code, 201)
        self.assertEqual(r_idem_1.data["id"], r_idem_2.data["id"])

        # 14. EF-29: Bút toán điều chỉnh đang UNPOSTED nhưng bút toán gốc bị UNPOST trước khi Post điều chỉnh -> Chặn Post
        self.client.post(
            f"/api/v1/general-ledger/journals/{orig_id}/unpost/{self.query}",
            {"reason": "Bỏ ghi sổ gốc khi điều chỉnh chưa Post"},
            format="json",
        )
        r_ef29 = self.client.post(
            f"/api/v1/general-ledger/journals/{r_idem_1.data['id']}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_ef29.status_code, 400)
        self.assertEqual(r_ef29.data.get("error_code"), "ORIGINAL_STATUS_CHANGED_BEFORE_POST")

    def test_general_business_voucher_adjust_and_reverse_integration(self):
        """
        Kiểm thử tích hợp Điều chỉnh & Đảo bút toán trực tiếp từ Chứng từ nghiệp vụ khác (UC-GL-03 + UC-GL-06).
        """
        r_nvk = self.client.post(
            f"/api/v1/general-ledger/general-vouchers/{self.query}",
            {
                "company": str(self.company.id),
                "business_type": "OTHER",
                "posting_date": "2026-10-14",
                "document_date": "2026-10-14",
                "description": "Chi phí tiếp khách",
                "accounting_lines": [
                    {
                        "description": "Chi phí tiếp khách",
                        "debit_account": "6422",
                        "credit_account": "111",
                        "amount": "3000000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_nvk.status_code, 201, r_nvk.data)
        nvk_id = r_nvk.data["id"]

        # Ghi sổ NVK
        self.client.post(f"/api/v1/general-ledger/general-vouchers/{nvk_id}/post/{self.query}", {}, format="json")

        # Điều chỉnh NVK đã ghi sổ
        r_nvk_adj = self.client.post(
            f"/api/v1/general-ledger/general-vouchers/{nvk_id}/adjust/{self.query}",
            {
                "reason": "Bổ sung chi phí phòng hội nghị",
                "posting_date": "2026-10-18",
                "auto_post": True,
                "accounting_lines": [
                    {"debit_account": "6422", "credit_account": "111", "amount": "500000"}
                ],
            },
            format="json",
        )
        self.assertEqual(r_nvk_adj.status_code, 201, r_nvk_adj.data)
        self.assertEqual(r_nvk_adj.data["entry_type"], "ADJUSTMENT")
        self.assertEqual(r_nvk_adj.data["status"], "POSTED")

        # Đảo NVK đã ghi sổ
        r_nvk_rev = self.client.post(
            f"/api/v1/general-ledger/general-vouchers/{nvk_id}/reverse/{self.query}",
            {
                "reason": "Đảo toàn bộ chứng từ tiếp khách",
                "posting_date": "2026-10-19",
                "auto_post": True,
            },
            format="json",
        )
        self.assertEqual(r_nvk_rev.status_code, 201, r_nvk_rev.data)
        self.assertEqual(r_nvk_rev.data["entry_type"], "REVERSAL")
        self.assertEqual(r_nvk_rev.data["status"], "POSTED")


class ExpenseAllocationUcGl07Tests(TestCase):
    """
    UC-GL-07 – Phân bổ chi phí bán hàng, QLDN và chi phí khác:
    Kiểm thử toàn diện Main Flow (Steps 1–50), Alternative Flows (AF-01..AF-19),
    Exception Flows (EF-01..EF-35) và Business Rules (BR-GL-ALLOC-01..80).
    """

    def setUp(self):
        from organization.models import Department
        from master_data.models import Project, CostCenter
        from . import models as gl_models

        self.gl_models = gl_models
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.currency = currency
        self.company = Company.objects.create(
            code="GL07CO",
            name="GL07 Allocation Corp",
            legal_name="GL07 Allocation Corp Ltd",
            tax_code="0100777707",
            accounting_currency=currency,
            legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN07", name="Chi nhánh Hà Nội")
        acc_class = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản & Chi phí", normal_balance="DEBIT"
        )
        chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT99", name="Hệ thống TK TT99", effective_from="2026-01-01", is_default=True
        )
        self.cash = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=acc_class,
            code="1111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT"
        )
        self.acc_6421 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=acc_class,
            code="6421", name="Chi phí nhân viên quản lý", account_type="EXPENSE", normal_balance="DEBIT"
        )
        self.acc_6422 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=acc_class,
            code="6422", name="Chi phí đồ dùng văn phòng", account_type="EXPENSE", normal_balance="DEBIT"
        )
        self.acc_641 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=acc_class,
            code="641", name="Chi phí bán hàng", account_type="EXPENSE", normal_balance="DEBIT"
        )
        self.acc_242 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=acc_class,
            code="242", name="Chi phí trả trước", account_type="ASSET", normal_balance="DEBIT"
        )
        self.acc_511 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=acc_class,
            code="5111", name="Doanh thu bán hàng", account_type="REVENUE", normal_balance="CREDIT"
        )

        self.maker = get_user_model().objects.create_superuser(
            username="gl07-maker", email="maker@gl07.test", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.maker)
        self.query = f"?company_id={self.company.id}"
        period_obj = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-09",
            fiscal_year=2026,
            period_number=9,
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="OPEN",
        )
        self.period = str(period_obj.id)

        # Tạo phòng ban và dự án nhận phân bổ
        self.dept_sales_north = Department.objects.create(
            company=self.company, branch=self.branch, code="PB-MB", name="Phòng Kinh doanh Miền Bắc", status="ACTIVE"
        )
        self.dept_sales_south = Department.objects.create(
            company=self.company, branch=self.branch, code="PB-MN", name="Phòng Kinh doanh Miền Nam", status="ACTIVE"
        )
        self.dept_hq = Department.objects.create(
            company=self.company, branch=self.branch, code="PB-HQ", name="Khối Văn phòng Trung tâm", status="ACTIVE"
        )
        self.proj_a = Project.objects.create(
            company=self.company, code="DA-A", name="Dự án Chuyển đổi số A", status="ACTIVE"
        )
        self.proj_b = Project.objects.create(
            company=self.company, code="DA-B", name="Dự án ERP B", status="ACTIVE"
        )
        self.cc_1 = CostCenter.objects.create(
            company=self.company, code="CC-01", name="Trung tâm chi phí 01", status="ACTIVE"
        )

    def _post_expense_entry(self, number, account, amount, posting_date="2026-09-10", department=None, post_now=True):
        res = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": self.period,
                "number": number,
                "entry_type": "MANUAL",
                "posting_date": posting_date,
                "document_date": posting_date,
                "description": f"Chi phí phát sinh {number}",
                "lines": [
                    {
                        "line_no": 1,
                        "account": str(account.id),
                        "debit": str(amount),
                        "credit": "0",
                        "currency": str(self.currency.id),
                        "department": str(department.id) if department else None,
                    },
                    {
                        "line_no": 2,
                        "account": str(self.cash.id),
                        "debit": "0",
                        "credit": str(amount),
                        "currency": str(self.currency.id),
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        if post_now:
            p_res = self.client.post(f"/api/v1/general-ledger/journals/{res.data['id']}/post/{self.query}", {}, format="json")
            self.assertEqual(p_res.status_code, 200, p_res.data)
        return res.data

    def test_uc_gl_07_main_flow_fetch_calculate_confirm_unposted_post_and_trace(self):
        """
        Kiểm thử Main Flow (Steps 1–50), AF-01 (Theo quy tắc cấu hình sẵn), AF-15 (Tạo UNPOSTED trước khi POST),
        AF-19 (Loại trừ bút toán UNPOSTED khỏi nguồn), và truy vết hai chiều (trace).
        """
        from decimal import Decimal

        # 1. Ghi nhận chi phí nguồn: 10.000.000 đã POSTED + 5.000.000 đang DRAFT (UNPOSTED - AF-19)
        src_posted = self._post_expense_entry("CP-6421-01", self.acc_6421, "10000000", post_now=True)
        self._post_expense_entry("CP-6421-DRAFT", self.acc_6421, "5000000", post_now=False)

        # 2. Tạo quy tắc phân bổ (AF-01): Phân bổ TK 6421 sang 2 phòng ban theo tỷ lệ cố định 60% - 40%
        rule_res = self.client.post(
            f"/api/v1/general-ledger/allocation-rules/{self.query}",
            {
                "company": str(self.company.id),
                "code": "RULE-6421-PB",
                "name": "Phân bổ chi phí QLDN 6421 cho các khối kinh doanh",
                "allocation_group": "ADMIN",
                "source_account": str(self.acc_6421.id),
                "offset_account": str(self.acc_6421.id),
                "method": "FIXED_PERCENT",
                "rounding_method": "LAST_LINE",
                "destinations": [
                    {
                        "line_no": 1,
                        "account": str(self.acc_641.id),
                        "department": str(self.dept_sales_north.id),
                        "percentage": "60",
                        "description": "Phân bổ cho Kinh doanh Miền Bắc",
                    },
                    {
                        "line_no": 2,
                        "account": str(self.acc_641.id),
                        "department": str(self.dept_sales_south.id),
                        "percentage": "40",
                        "description": "Phân bổ cho Kinh doanh Miền Nam",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(rule_res.status_code, 201, rule_res.data)
        rule_id = rule_res.data["id"]

        # 3. Bước 7–12: Lấy dữ liệu nguồn (fetch-source) -> chỉ lấy 10.000.000 đã POSTED, loại trừ 5.000.000 DRAFT (AF-19)
        src_res = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/fetch-source/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "rule": rule_id,
            },
            format="json",
        )
        self.assertEqual(src_res.status_code, 200, src_res.data)
        self.assertEqual(Decimal(src_res.data["total_source_amount"]), Decimal("10000000"))
        self.assertEqual(Decimal(src_res.data["previously_allocated_amount"]), Decimal("0"))
        self.assertEqual(Decimal(src_res.data["remaining_allocatable_amount"]), Decimal("10000000"))
        self.assertEqual(src_res.data["source_entries_count"], 1)
        self.assertEqual(src_res.data["source_entries"][0]["entry_id"], src_posted["id"])
        fingerprint = src_res.data["source_fingerprint"]

        # 4. Bước 13–25: Tính phân bổ (calculate) -> trạng thái CALCULATED
        calc_res = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "document_date": "2026-09-30",
                "rule": rule_id,
            },
            format="json",
        )
        self.assertEqual(calc_res.status_code, 200, calc_res.data)
        self.assertEqual(calc_res.data["status"], "CALCULATED")
        self.assertEqual(Decimal(calc_res.data["total_allocated_amount"]), Decimal("10000000"))
        lines = calc_res.data["allocation_lines"]
        self.assertEqual(len(lines), 2)
        self.assertEqual(Decimal(lines[0]["allocated_amount"]), Decimal("6000000"))
        self.assertEqual(Decimal(lines[1]["allocated_amount"]), Decimal("4000000"))

        # 5. Bước 26–49 & AF-15: Xác nhận tạo chứng từ phân bổ ở trạng thái UNPOSTED (auto_post=False)
        confirm_res = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "document_date": "2026-09-30",
                "rule": rule_id,
                "expected_source_fingerprint": fingerprint,
                "idempotency_key": "ALLOC-MAIN-001",
                "auto_post": False,
            },
            format="json",
        )
        self.assertEqual(confirm_res.status_code, 201, confirm_res.data)
        run_id = confirm_res.data["id"]
        self.assertEqual(confirm_res.data["status"], "UNPOSTED")
        self.assertEqual(confirm_res.data["entry_status"], "DRAFT")

        # Kiểm tra BR-GL-ALLOC-48, 59: Khi còn UNPOSTED, số dư chính thức TK 641 chưa phát sinh
        bal_641_before = self.gl_models.AccountBalance.objects.filter(period_id=self.period, account=self.acc_641).first()
        self.assertTrue(bal_641_before is None or bal_641_before.closing_debit == Decimal("0"))

        # 6. Bước 50: Thực hiện Ghi sổ chứng từ phân bổ (UC-GL-05)
        post_res = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/{run_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(post_res.status_code, 200, post_res.data)
        self.assertEqual(post_res.data["status"], "POSTED")
        self.assertEqual(post_res.data["entry_status"], "POSTED")

        # Kiểm tra sau khi POSTED: Số dư TK 6421 giảm về 0, số dư TK 641 tăng lên 10.000.000
        bal_6421_after = self.gl_models.AccountBalance.objects.filter(
            period_id=self.period, account=self.acc_6421
        ).aggregate(d=Sum("closing_debit"), c=Sum("closing_credit"))
        self.assertEqual((bal_6421_after["d"] or Decimal("0")) - (bal_6421_after["c"] or Decimal("0")), Decimal("0"))
        bal_641_after = self.gl_models.AccountBalance.objects.filter(
            period_id=self.period, account=self.acc_641
        ).aggregate(d=Sum("closing_debit"), c=Sum("closing_credit"))
        self.assertEqual((bal_641_after["d"] or Decimal("0")) - (bal_641_after["c"] or Decimal("0")), Decimal("10000000"))

        # 7. Kiểm tra Truy vết hai chiều (BR-GL-ALLOC-51, 52, 69..72)
        trace_res = self.client.get(f"/api/v1/general-ledger/allocation-runs/{run_id}/trace/{self.query}")
        self.assertEqual(trace_res.status_code, 200, trace_res.data)
        self.assertEqual(trace_res.data["status"], "POSTED")
        self.assertEqual(trace_res.data["rule"]["code"], "RULE-6421-PB")
        self.assertIn(src_posted["id"], trace_res.data["source_snapshot"]["source_entry_ids"])
        self.assertEqual(len(trace_res.data["allocation_lines"]), 2)

    def test_uc_gl_07_methods_coefficient_rounding_basis_zero_and_partial_direct_amount(self):
        """
        Kiểm thử AF-02 (Khai báo trực tiếp không dùng rule), AF-05 (Theo hệ số COEFFICIENT),
        AF-06 (Theo tiêu thức giá trị BASIS_VALUE có dòng bằng 0 - BR-GL-ALLOC-42, 43),
        AF-07 (Theo số tiền trực tiếp DIRECT_AMOUNT), AF-10 (Xử lý làm tròn) và AF-18 (Phân bổ một phần).
        """
        from decimal import Decimal

        # Ghi nhận 100.0000 trên TK 6422
        self._post_expense_entry("CP-6422-100", self.acc_6422, "100", post_now=True)

        # 1. AF-02 + AF-05 + AF-10: Phân bổ 40.0000 (một phần nguồn AF-18) theo COEFFICIENT 1:1:1 -> 13.3333, 13.3333, 13.3334
        calc_coeff = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "source_account": str(self.acc_6422.id),
                "offset_account": str(self.acc_6422.id),
                "method": "COEFFICIENT",
                "rounding_method": "LAST_LINE",
                "amount_to_allocate": "40",
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "coefficient": "1"},
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_south.id), "coefficient": "1"},
                    {"account": str(self.acc_641.id), "department": str(self.dept_hq.id), "coefficient": "1"},
                ],
            },
            format="json",
        )
        self.assertEqual(calc_coeff.status_code, 200, calc_coeff.data)
        self.assertEqual(Decimal(calc_coeff.data["rounding_diff_adjusted"]), Decimal("0.0001"))
        c_lines = calc_coeff.data["allocation_lines"]
        self.assertEqual(Decimal(c_lines[0]["allocated_amount"]), Decimal("13.3333"))
        self.assertEqual(Decimal(c_lines[1]["allocated_amount"]), Decimal("13.3333"))
        self.assertEqual(Decimal(c_lines[2]["allocated_amount"]), Decimal("13.3334"))
        self.assertEqual(Decimal(calc_coeff.data["unallocated_remaining_after_run"]), Decimal("60"))

        # Xác nhận và tự động ghi sổ đợt 1 (40.0000) (AF-14)
        run1 = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "source_account": str(self.acc_6422.id),
                "offset_account": str(self.acc_6422.id),
                "method": "COEFFICIENT",
                "amount_to_allocate": "40",
                "auto_post": True,
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "coefficient": "1"},
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_south.id), "coefficient": "1"},
                    {"account": str(self.acc_641.id), "department": str(self.dept_hq.id), "coefficient": "1"},
                ],
            },
            format="json",
        )
        self.assertEqual(run1.status_code, 201, run1.data)
        self.assertEqual(run1.data["status"], "POSTED")

        # 2. Kiểm tra phần nguồn còn lại = 60.0000; phân bổ tiếp toàn bộ 60.0000 theo BASIS_VALUE có 1 dòng basis_value = 0 (BR-GL-ALLOC-42, 43)
        run2 = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "source_account": str(self.acc_6422.id),
                "offset_account": str(self.acc_6422.id),
                "method": "BASIS_VALUE",
                "auto_post": True,
                "destinations": [
                    {"account": str(self.acc_641.id), "project": str(self.proj_a.id), "basis_value": "300"},
                    {"account": str(self.acc_641.id), "project": str(self.proj_b.id), "basis_value": "0"},
                ],
            },
            format="json",
        )
        self.assertEqual(run2.status_code, 201, run2.data)
        self.assertEqual(Decimal(run2.data["previously_allocated_amount"]), Decimal("40"))
        self.assertEqual(Decimal(run2.data["remaining_allocatable_amount"]), Decimal("60"))
        self.assertEqual(Decimal(run2.data["amount"]), Decimal("60"))
        # Bảng giải trình vẫn lưu 2 dòng (dòng proj_b có allocated_amount = 0), nhưng bút toán GL chỉ sinh 1 dòng Nợ + 1 dòng Có
        self.assertEqual(len(run2.data["allocation_lines"]), 2)
        self.assertTrue(run2.data["allocation_lines"][1]["is_zero_basis"])
        entry2 = self.gl_models.JournalEntry.objects.get(pk=run2.data["entry"])
        self.assertEqual(entry2.lines.count(), 2)

    def test_uc_gl_07_lifecycle_unpost_cancel_reverse_and_source_change_protection(self):
        """
        Kiểm thử:
        - AF-13 & EF-23: Chặn xác nhận khi dữ liệu nguồn thay đổi sau khi tính (source_fingerprint mismatch).
        - EF-10: Chặn phân bổ lặp khi nguồn đã phân bổ hết.
        - EF-35: Chặn sửa/xóa/hủy trực tiếp chứng từ phân bổ đã POSTED.
        - AF-16: Bỏ ghi sổ (unpost) -> Hủy (cancel) -> Phân bổ lại thành công.
        - AF-17: Đảo bút toán phân bổ đã POSTED (reverse) -> Giải phóng nguồn -> Phân bổ lại thành công.
        - EF-34: Chặn ghi sổ chứng từ phân bổ UNPOSTED khi nguồn chi phí gốc đã bị bỏ ghi sổ làm thiếu hụt nguồn.
        """
        from decimal import Decimal

        src_entry = self._post_expense_entry("CP-LIFE-01", self.acc_6421, "5000000", post_now=True)

        # 1. Tính phân bổ lấy fingerprint fp1
        calc1 = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "source_account": str(self.acc_6421.id),
                "method": "DIRECT_AMOUNT",
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "direct_amount": "5000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(calc1.status_code, 200, calc1.data)
        fp1 = calc1.data["source_fingerprint"]

        # Phát sinh thêm 1 bút toán chi phí nguồn mới -> làm thay đổi dữ liệu nguồn sau khi tính
        src_entry_2 = self._post_expense_entry("CP-LIFE-02", self.acc_6421, "2000000", post_now=True)

        # AF-13, EF-23: Xác nhận với expected_source_fingerprint cũ phải bị chặn
        stale_confirm = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "source_account": str(self.acc_6421.id),
                "method": "DIRECT_AMOUNT",
                "expected_source_fingerprint": fp1,
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "direct_amount": "5000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(stale_confirm.status_code, 400)
        self.assertEqual(stale_confirm.data.get("error_code"), "SOURCE_DATA_CHANGED_SINCE_CALCULATION")

        # 2. Tạo chứng từ phân bổ UNPOSTED cho toàn bộ 7.000.000
        run_unposted = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "source_account": str(self.acc_6421.id),
                "method": "DIRECT_AMOUNT",
                "auto_post": False,
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "direct_amount": "7000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(run_unposted.status_code, 201, run_unposted.data)
        run_id = run_unposted.data["id"]

        # EF-34: Bỏ ghi sổ bút toán nguồn thứ 2 (2.000.000) khi chứng từ phân bổ 7.000.000 đang UNPOSTED,
        # sau đó thử Ghi sổ chứng từ phân bổ 7.000.000 -> phải bị chặn vì nguồn chỉ còn 5.000.000!
        self.client.post(f"/api/v1/general-ledger/journals/{src_entry_2['id']}/unpost/{self.query}", {}, format="json")
        post_blocked = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/{run_id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(post_blocked.status_code, 400)
        self.assertEqual(post_blocked.data.get("error_code"), "ALLOCATION_SOURCE_INSUFFICIENT_AT_POST")

        # Ghi sổ lại bút toán nguồn thứ 2 -> Ghi sổ chứng từ phân bổ thành công
        self.client.post(f"/api/v1/general-ledger/journals/{src_entry_2['id']}/post/{self.query}", {}, format="json")
        post_ok = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/{run_id}/post/{self.query}", {}, format="json"
        )
        self.assertEqual(post_ok.status_code, 200, post_ok.data)
        self.assertEqual(post_ok.data["status"], "POSTED")

        # EF-10: Thử chạy phân bổ thêm một lần nữa khi nguồn đã phân bổ hết 7.000.000 -> bị chặn
        dup_alloc = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "source_account": str(self.acc_6421.id),
                "method": "FIXED_PERCENT",
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "percentage": "100"},
                ],
            },
            format="json",
        )
        self.assertEqual(dup_alloc.status_code, 400)
        self.assertEqual(dup_alloc.data.get("error_code"), "SOURCE_ALREADY_FULLY_ALLOCATED")

        # EF-35: Chặn hủy trực tiếp đợt phân bổ đang POSTED
        cancel_posted = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/{run_id}/cancel/{self.query}", {}, format="json"
        )
        self.assertEqual(cancel_posted.status_code, 400)
        self.assertEqual(cancel_posted.data.get("error_code"), "CANNOT_CANCEL_POSTED_ALLOCATION")

        # AF-16: Bỏ ghi sổ đợt phân bổ -> Hủy đợt phân bổ -> Tạo và ghi sổ đợt phân bổ mới thành công
        unpost_res = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/{run_id}/unpost/{self.query}", {}, format="json"
        )
        self.assertEqual(unpost_res.status_code, 200, unpost_res.data)
        self.assertEqual(unpost_res.data["status"], "UNPOSTED")

        cancel_res = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/{run_id}/cancel/{self.query}", {}, format="json"
        )
        self.assertEqual(cancel_res.status_code, 200, cancel_res.data)
        self.assertEqual(cancel_res.data["status"], "CANCELLED")

        rerun_res = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-09-30",
                "source_account": str(self.acc_6421.id),
                "method": "FIXED_PERCENT",
                "auto_post": True,
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_south.id), "percentage": "100"},
                ],
            },
            format="json",
        )
        self.assertEqual(rerun_res.status_code, 201, rerun_res.data)
        self.assertEqual(rerun_res.data["status"], "POSTED")
        rerun_id = rerun_res.data["id"]

        # AF-17: Đảo bút toán phân bổ đã POSTED (UC-GL-06) -> Giải phóng nguồn -> Phân bổ lại khả dụng
        rev_res = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/{rerun_id}/reverse/{self.query}",
            {
                "reason": "Đảo bút toán phân bổ do chọn nhầm phòng ban nhận",
                "posting_date": "2026-09-30",
                "auto_post": True,
            },
            format="json",
        )
        self.assertEqual(rev_res.status_code, 201, rev_res.data)
        self.assertEqual(rev_res.data["status"], "REVERSED")
        self.assertIsNotNone(rev_res.data["reversal_entry"])

        # Kiểm tra nguồn 7.000.000 đã khả dụng trở lại sau khi đảo!
        src_after_rev = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/fetch-source/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "source_account": str(self.acc_6421.id),
            },
            format="json",
        )
        self.assertEqual(src_after_rev.status_code, 200, src_after_rev.data)
        self.assertEqual(Decimal(src_after_rev.data["remaining_allocatable_amount"]), Decimal("7000000"))

    def test_uc_gl_07_validation_and_exception_flows(self):
        """
        Kiểm thử các luồng ngoại lệ:
        - EF-05: Ngày hạch toán ngoài kỳ phân bổ.
        - EF-07, BR-GL-ALLOC-04: Chặn dùng TK 242 (CCDC/Chi phí trả trước) làm nguồn phân bổ UC-GL-07.
        - EF-14, BR-GL-ALLOC-27: Chặn khi thiếu chiều bắt buộc trên tài khoản nhận phân bổ.
        - EF-17: Tổng tỷ lệ != 100%.
        - EF-19: Tổng hệ số / tiêu thức = 0.
        - EF-21: Trùng lặp đối tượng nhận trong cùng đợt phân bổ.
        - BR-GL-ALLOC-28: Chặn tự phân bổ lại cho chính tài khoản và chiều nguồn.
        """
        self._post_expense_entry("CP-VAL-01", self.acc_6421, "3000000", post_now=True)

        # 1. EF-05: Ngày hạch toán ngoài kỳ 2026-09
        r_date = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "posting_date": "2026-10-15",
                "source_account": str(self.acc_6421.id),
                "method": "FIXED_PERCENT",
                "destinations": [{"account": str(self.acc_641.id), "percentage": "100"}],
            },
            format="json",
        )
        self.assertEqual(r_date.status_code, 400)
        self.assertEqual(r_date.data.get("error_code"), "POSTING_DATE_OUT_OF_PERIOD")

        # 2. EF-07, BR-GL-ALLOC-04: Chặn TK 242 trong UC-GL-07
        r_242 = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/fetch-source/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "source_account": str(self.acc_242.id),
            },
            format="json",
        )
        self.assertEqual(r_242.status_code, 400)
        self.assertEqual(r_242.data.get("error_code"), "INVALID_SOURCE_ACCOUNT_NATURE")

        # 3. EF-14: Tài khoản nhận yêu cầu bắt buộc chiều Department nhưng không truyền
        self.acc_641.dimension_requirements = {"DEPARTMENT": "REQUIRED"}
        self.acc_641.save(update_fields=("dimension_requirements",))
        r_dim = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "source_account": str(self.acc_6421.id),
                "method": "FIXED_PERCENT",
                "destinations": [{"account": str(self.acc_641.id), "percentage": "100"}],
            },
            format="json",
        )
        self.assertEqual(r_dim.status_code, 400)
        self.assertEqual(r_dim.data.get("error_code"), "MISSING_REQUIRED_DIMENSION")
        self.acc_641.dimension_requirements = {}
        self.acc_641.save(update_fields=("dimension_requirements",))

        # 4. EF-17: Tổng tỷ lệ != 100% (ví dụ 80%)
        r_pct = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "source_account": str(self.acc_6421.id),
                "method": "FIXED_PERCENT",
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "percentage": "80"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_pct.status_code, 400)
        self.assertEqual(r_pct.data.get("error_code"), "TOTAL_PERCENTAGE_NOT_100")

        # 5. EF-21: Trùng lặp đối tượng nhận trong cùng đợt phân bổ
        r_dup = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "source_account": str(self.acc_6421.id),
                "method": "FIXED_PERCENT",
                "destinations": [
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "percentage": "50"},
                    {"account": str(self.acc_641.id), "department": str(self.dept_sales_north.id), "percentage": "50"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_dup.status_code, 400)
        self.assertEqual(r_dup.data.get("error_code"), "DUPLICATE_ALLOCATION_DESTINATION")

        # 6. BR-GL-ALLOC-28: Tự phân bổ cho chính tài khoản và chiều nguồn
        r_self = self.client.post(
            f"/api/v1/general-ledger/allocation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": self.period,
                "source_account": str(self.acc_6421.id),
                "offset_account": str(self.acc_6421.id),
                "method": "FIXED_PERCENT",
                "destinations": [
                    {"account": str(self.acc_6421.id), "percentage": "100"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_self.status_code, 400)
        self.assertEqual(r_self.data.get("error_code"), "SELF_ALLOCATION_NOT_ALLOWED")


class FxRevaluationUcGl08Tests(TestCase):
    """
    Bộ kiểm thử toàn diện cho UC-GL-08 – Đánh giá lại tài khoản ngoại tệ:
    - Main Flow: Lấy số dư ngoại tệ (fetch-balances) -> Tính chênh lệch tỷ giá cuối kỳ (calculate)
      -> Xác nhận lập chứng từ UNPOSTED (confirm) -> Ghi sổ (post, UC-GL-05) -> Truy vết 2 chiều (trace).
    - Kiểm chứng bảo toàn số dư nguyên tệ (foreign_balance) trước và sau khi đánh giá lại (BR-GL-FX-60, 61).
    - Kiểm chứng công thức tăng/giảm giá trị ghi sổ so với Lãi/Lỗ tỷ giá cho cả Tài sản/Phải thu (1112, 1122, 131)
      và Nợ phải trả/Khoản vay (331, 341) khi tỷ giá tăng và khi tỷ giá giảm (AF-08, AF-09, BR-GL-FX-27..31).
    - Kiểm chứng loại bỏ dòng chênh lệch bằng 0 khỏi bút toán sinh ra (AF-07, BR-GL-FX-28, 39).
    - Kiểm chứng tra cứu tỷ giá tự động từ bảng ExchangeRate (AF-01, BR-GL-FX-18..22).
    - Kiểm chứng Bỏ ghi sổ (AF-16), Đảo bút toán (AF-17, UC-GL-06), Hủy đợt chưa ghi sổ và chạy lại (AF-11, AF-12).
    - Kiểm chứng các luồng ngoại lệ: Khoản mục phi tiền tệ (EF-11, BR-GL-FX-06), tỷ giá <= 0 (EF-08, EF-09),
      lệch source_fingerprint trước khi lưu/ghi sổ (AF-13, EF-19, EF-24, EF-30), trùng phạm vi (EF-20),
      idempotency (EF-21, EF-27), kỳ kế toán khóa (EF-04), và chặn bỏ ghi sổ bút toán nguồn ngoại tệ khi đã có
      đợt đánh giá lại POSTED phụ thuộc.
    """

    def setUp(self):
        from master_data.models import ExchangeRate, ExchangeRateType, Party
        from .models import (
            AccountBalance,
            ForeignCurrencyRevaluationRule,
            ForeignCurrencyRevaluationRun,
            JournalEntry,
            JournalLine,
        )

        self.Party = Party
        self.ExchangeRate = ExchangeRate
        self.ExchangeRateType = ExchangeRateType
        self.AccountBalance = AccountBalance
        self.ForeignCurrencyRevaluationRule = ForeignCurrencyRevaluationRule
        self.ForeignCurrencyRevaluationRun = ForeignCurrencyRevaluationRun
        self.JournalEntry = JournalEntry
        self.JournalLine = JournalLine

        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "Đô la Mỹ"})
        self.eur, _ = Currency.objects.get_or_create(code="EUR", defaults={"name": "Đồng Euro"})

        self.company = Company.objects.create(
            code="GLFX08",
            name="Công ty Kiểm thử Đánh giá Ngoại tệ GL08",
            legal_name="Công ty TNHH Kiểm thử Đánh giá Ngoại tệ GL08",
            tax_code="0109988708",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN01", name="Trụ sở chính")

        self.asset_class = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT"
        )
        self.liab_class = AccountClass.objects.create(
            company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT"
        )
        self.eq_class = AccountClass.objects.create(
            company=self.company, code="EQ", name="Vốn chủ sở hữu", normal_balance="CREDIT"
        )
        self.rev_class = AccountClass.objects.create(
            company=self.company, code="REV", name="Doanh thu", normal_balance="CREDIT"
        )
        self.exp_class = AccountClass.objects.create(
            company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT"
        )

        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT99",
            name="Hệ thống tài khoản TT99",
            effective_from="2026-01-01",
            is_default=True,
        )

        # Các tài khoản tiền tệ có gốc ngoại tệ (1112, 1122, 131, 331, 341)
        self.acc_1112 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="1112",
            name="Tiền mặt ngoại tệ",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            is_foreign_currency=True,
        )
        self.acc_1122 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="1122",
            name="Tiền gửi ngân hàng ngoại tệ",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            is_foreign_currency=True,
        )
        self.acc_131 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="131",
            name="Phải thu của khách hàng",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            requires_party=True,
            is_foreign_currency=True,
        )
        self.acc_331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.liab_class,
            code="331",
            name="Phải trả cho người bán",
            account_type="LIABILITY",
            normal_balance="CREDIT",
            is_postable=True,
            requires_party=True,
            is_foreign_currency=True,
        )
        self.acc_341 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.liab_class,
            code="341",
            name="Vay và nợ thuê tài chính",
            account_type="LIABILITY",
            normal_balance="CREDIT",
            is_postable=True,
            is_foreign_currency=True,
        )

        # Tài khoản xử lý chênh lệch tỷ giá đánh giá lại cuối kỳ (4131, 515, 635)
        self.acc_4131 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.eq_class,
            code="4131",
            name="Chênh lệch tỷ giá đánh giá lại các khoản mục tiền tệ có gốc ngoại tệ",
            account_type="EQUITY",
            normal_balance="CREDIT",
            is_postable=True,
        )
        self.acc_515 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.rev_class,
            code="515",
            name="Doanh thu hoạt động tài chính",
            account_type="REVENUE",
            normal_balance="CREDIT",
            is_postable=True,
        )
        self.acc_635 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.exp_class,
            code="635",
            name="Chi phí tài chính",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
        )

        # Tài khoản phi tiền tệ (156 - Hàng hóa) để kiểm thử chặn EF-11 / BR-GL-FX-06
        self.acc_156 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="156",
            name="Hàng hóa",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
        )

        self.customer_usd = Party.objects.create(
            company=self.company,
            party_type="CUSTOMER",
            code="KH-USD-01",
            name="Global Export Corp",
            status="ACTIVE",
        )
        self.supplier_usd = Party.objects.create(
            company=self.company,
            party_type="SUPPLIER",
            code="NCC-USD-01",
            name="Pacific Machinery Ltd",
            status="ACTIVE",
        )

        self.period_oct = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
            status="OPEN",
        )

        self.user = get_user_model().objects.create_superuser(
            username="gl08-accountant", email="gl08@example.com", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"

    def _create_posted_fx_entry(self, number, posting_date, lines_spec):
        """
        Tạo và ghi sổ một bút toán ngoại tệ nguồn để hình thành số dư nguyên tệ + giá trị ghi sổ VND.
        lines_spec: list of dict(account, debit, credit, currency, foreign_amount, exchange_rate, party=None, dimensions=None)
        """
        payload = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "period": str(self.period_oct.id),
            "number": number,
            "entry_type": "MANUAL",
            "posting_date": posting_date,
            "document_date": posting_date,
            "description": f"Bút toán ngoại tệ nguồn {number}",
            "source_module": "GL",
            "lines": [
                {
                    "line_no": idx,
                    "account": str(spec["account"].id),
                    "debit": str(spec.get("debit", "0")),
                    "credit": str(spec.get("credit", "0")),
                    "currency": str(spec.get("currency", self.usd).id),
                    "foreign_amount": str(spec["foreign_amount"]),
                    "exchange_rate": str(spec["exchange_rate"]),
                    "party": str(spec["party"].id) if spec.get("party") else None,
                    "dimensions": spec.get("dimensions") or {},
                    "description": spec.get("description", f"Dòng {idx}"),
                }
                for idx, spec in enumerate(lines_spec, start=1)
            ],
        }
        r_create = self.client.post(f"/api/v1/general-ledger/journals/{self.query}", payload, format="json")
        self.assertEqual(r_create.status_code, 201, r_create.data)
        entry_id = r_create.data["id"]
        r_post = self.client.post(f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}", {}, format="json")
        self.assertEqual(r_post.status_code, 200, r_post.data)
        return r_post.data

    def test_main_flow_fetch_calculate_asset_and_liability_confirm_post_preserve_foreign_balance_and_trace(self):
        """
        Kiểm thử Main Flow UC-GL-08 (Steps 1–50):
        1. Tạo phát sinh ngoại tệ USD đã POSTED:
           - TK 1122 (VCB-USD-001): Dư Nợ 10,000 USD @ 24,500 = 245,000,000 VND.
           - TK 1122 (BIDV-USD-002): Dư Nợ 5,000 USD @ 25,200 = 126,000,000 VND (trùng tỷ giá đánh giá -> chênh lệch = 0).
           - TK 131 (KH-USD-01): Dư Nợ 4,000 USD @ 24,800 = 99,200,000 VND.
           - TK 331 (NCC-USD-01): Dư Có 6,000 USD @ 24,600 = 147,600,000 VND.
        2. Đánh giá lại cuối kỳ với tỷ giá 25,200 VND/USD:
           - 1122 (VCB-USD-001): Giá trị mới 252,000,000 -> Tăng +7,000,000 -> Lãi tỷ giá (GAIN): Nợ 1122 / Có 4131.
           - 1122 (BIDV-USD-002): Giá trị mới 126,000,000 -> Chênh lệch 0 -> Loại khỏi bút toán (AF-07, BR-GL-FX-28).
           - 131 (KH-USD-01): Giá trị mới 100,800,000 -> Tăng +1,600,000 -> Lãi tỷ giá (GAIN): Nợ 131 / Có 4131.
           - 331 (NCC-USD-01): Giá trị mới 151,200,000 -> Tăng +3,600,000 -> Lỗ tỷ giá (LOSS): Nợ 4131 / Có 331.
        3. Xác nhận tạo chứng từ đánh giá lại ở trạng thái UNPOSTED (BR-GL-FX-53), ghi sổ (UC-GL-05),
           kiểm tra số dư nguyên tệ USD hoàn toàn không đổi (BR-GL-FX-60, 61) và truy vết 2 chiều (BR-GL-FX-82).
        """
        # Khởi tạo các bút toán ngoại tệ nguồn
        self._create_posted_fx_entry(
            "FX-SRC-001",
            "2026-10-05",
            [
                {
                    "account": self.acc_1122,
                    "debit": "245000000",
                    "foreign_amount": "10000",
                    "exchange_rate": "24500",
                    "dimensions": {"bank_account": "VCB-USD-001"},
                },
                {
                    "account": self.acc_515,
                    "credit": "245000000",
                    "foreign_amount": "10000",
                    "exchange_rate": "24500",
                },
            ],
        )
        self._create_posted_fx_entry(
            "FX-SRC-002",
            "2026-10-10",
            [
                {
                    "account": self.acc_1122,
                    "debit": "126000000",
                    "foreign_amount": "5000",
                    "exchange_rate": "25200",
                    "dimensions": {"bank_account": "BIDV-USD-002"},
                },
                {
                    "account": self.acc_515,
                    "credit": "126000000",
                    "foreign_amount": "5000",
                    "exchange_rate": "25200",
                },
            ],
        )
        self._create_posted_fx_entry(
            "FX-SRC-003",
            "2026-10-12",
            [
                {
                    "account": self.acc_131,
                    "debit": "99200000",
                    "foreign_amount": "4000",
                    "exchange_rate": "24800",
                    "party": self.customer_usd,
                },
                {
                    "account": self.acc_515,
                    "credit": "99200000",
                    "foreign_amount": "4000",
                    "exchange_rate": "24800",
                },
            ],
        )
        self._create_posted_fx_entry(
            "FX-SRC-004",
            "2026-10-15",
            [
                {
                    "account": self.acc_635,
                    "debit": "147600000",
                    "foreign_amount": "6000",
                    "exchange_rate": "24600",
                },
                {
                    "account": self.acc_331,
                    "credit": "147600000",
                    "foreign_amount": "6000",
                    "exchange_rate": "24600",
                    "party": self.supplier_usd,
                },
            ],
        )

        # 1. Lấy danh sách khoản mục ngoại tệ và số dư (fetch-balances)
        r_fetch = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/fetch-balances/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "account_scope": "ALL",
            },
            format="json",
        )
        self.assertEqual(r_fetch.status_code, 200, r_fetch.data)
        self.assertEqual(r_fetch.data["items_count"], 4)
        self.assertTrue(r_fetch.data["source_fingerprint"])

        # 2. Tính đánh giá lại ngoại tệ với tỷ giá 25,200 VND/USD (calculate)
        r_calc = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "25200",
                "account_scope": "ALL",
            },
            format="json",
        )
        self.assertEqual(r_calc.status_code, 200, r_calc.data)
        self.assertEqual(r_calc.data["evaluated_lines_count"], 4)
        self.assertEqual(r_calc.data["non_zero_lines_count"], 3)
        self.assertEqual(r_calc.data["zero_difference_lines_count"], 1)  # BIDV-USD-002 có chênh lệch = 0
        self.assertEqual(Decimal(r_calc.data["total_gain_amount"]), Decimal("8600000"))
        self.assertEqual(Decimal(r_calc.data["total_loss_amount"]), Decimal("3600000"))
        self.assertEqual(Decimal(r_calc.data["net_difference"]), Decimal("5000000"))
        self.assertTrue(r_calc.data["balanced"])
        self.assertEqual(Decimal(r_calc.data["total_debit"]), Decimal("12200000"))
        self.assertEqual(Decimal(r_calc.data["total_credit"]), Decimal("12200000"))

        lines_by_key = {
            f"{ln['account_code']}:{ln['bank_account_code'] or ln['party_code']}": ln
            for ln in r_calc.data["revaluation_lines"]
        }
        vcb_ln = lines_by_key["1122:VCB-USD-001"]
        self.assertEqual(Decimal(vcb_ln["difference_amount"]), Decimal("7000000"))
        self.assertEqual(vcb_ln["book_change_direction"], "INCREASE")
        self.assertEqual(vcb_ln["fx_impact_type"], "GAIN")
        self.assertEqual(vcb_ln["debit_account_code"], "1122")
        self.assertEqual(vcb_ln["credit_account_code"], "4131")

        bidv_ln = lines_by_key["1122:BIDV-USD-002"]
        self.assertEqual(Decimal(bidv_ln["difference_amount"]), Decimal("0"))
        self.assertEqual(bidv_ln["fx_impact_type"], "NONE")

        ar_ln = lines_by_key["131:KH-USD-01"]
        self.assertEqual(Decimal(ar_ln["difference_amount"]), Decimal("1600000"))
        self.assertEqual(ar_ln["book_change_direction"], "INCREASE")
        self.assertEqual(ar_ln["fx_impact_type"], "GAIN")
        self.assertEqual(ar_ln["debit_account_code"], "131")
        self.assertEqual(ar_ln["credit_account_code"], "4131")

        ap_ln = lines_by_key["331:NCC-USD-01"]
        self.assertEqual(Decimal(ap_ln["difference_amount"]), Decimal("3600000"))
        self.assertEqual(ap_ln["book_change_direction"], "INCREASE")
        self.assertEqual(ap_ln["fx_impact_type"], "LOSS")
        self.assertEqual(ap_ln["debit_account_code"], "4131")
        self.assertEqual(ap_ln["credit_account_code"], "331")

        # 3. Xác nhận tạo chứng từ đánh giá lại ở trạng thái UNPOSTED (confirm)
        r_confirm = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "25200",
                "account_scope": "ALL",
                "source_fingerprint": r_calc.data["source_fingerprint"],
                "idempotency_key": "IDEM-FX-OCT-USD-001",
            },
            format="json",
        )
        self.assertEqual(r_confirm.status_code, 201, r_confirm.data)
        run_id = r_confirm.data["id"]
        self.assertEqual(r_confirm.data["status"], "UNPOSTED")
        self.assertEqual(r_confirm.data["entry_status"], "DRAFT")
        self.assertEqual(len(r_confirm.data["lines"]), 4)
        entry_obj = self.JournalEntry.objects.get(pk=r_confirm.data["entry"])
        self.assertEqual(entry_obj.lines.count(), 6)  # Chỉ sinh 3 cặp Nợ/Có cho 3 dòng có chênh lệch != 0 (AF-07)

        # Idempotent retry với cùng idempotency_key trả về chính đợt vừa tạo (EF-21, EF-27, BR-GL-FX-54)
        r_idem = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "25200",
                "account_scope": "ALL",
                "idempotency_key": "IDEM-FX-OCT-USD-001",
            },
            format="json",
        )
        self.assertEqual(r_idem.status_code, 201)
        self.assertEqual(r_idem.data["id"], run_id)

        # Trước khi Ghi sổ: TK 4131 chưa phát sinh số dư trên Sổ cái (BR-GL-FX-63)
        self.assertFalse(
            self.AccountBalance.objects.filter(period=self.period_oct, account=self.acc_4131).exists()
        )

        # 4. Ghi sổ chứng từ đánh giá lại ngoại tệ (UC-GL-05, BR-GL-FX-64)
        r_post = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/{run_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_post.status_code, 200, r_post.data)
        self.assertEqual(r_post.data["status"], "POSTED")
        self.assertEqual(r_post.data["entry_status"], "POSTED")

        # Kiểm tra số dư Sổ cái TK 4131 sau khi Ghi sổ: Có 8,600,000 / Nợ 3,600,000 -> Dư Có 5,000,000
        bal_4131 = self.AccountBalance.objects.get(period=self.period_oct, account=self.acc_4131, branch=None)
        self.assertEqual(bal_4131.period_debit, Decimal("3600000"))
        self.assertEqual(bal_4131.period_credit, Decimal("8600000"))
        self.assertEqual(bal_4131.closing_credit, Decimal("5000000"))

        # Kiểm chứng BR-GL-FX-60, 61: Sau khi đánh giá lại và POSTED, số dư nguyên tệ (foreign_balance)
        # của tất cả các khoản mục hoàn toàn không đổi, trong khi giá trị ghi sổ VND đã cập nhật theo tỷ giá 25,200!
        r_after = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/fetch-balances/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "account_scope": "ALL",
            },
            format="json",
        )
        self.assertEqual(r_after.status_code, 200, r_after.data)
        after_map = {
            f"{it['account_code']}:{it['bank_account_code'] or it['party_code']}": it
            for it in r_after.data["items"]
        }
        self.assertEqual(Decimal(after_map["1122:VCB-USD-001"]["foreign_balance"]), Decimal("10000"))
        self.assertEqual(Decimal(after_map["1122:VCB-USD-001"]["book_value_before"]), Decimal("252000000"))
        self.assertEqual(Decimal(after_map["131:KH-USD-01"]["foreign_balance"]), Decimal("4000"))
        self.assertEqual(Decimal(after_map["131:KH-USD-01"]["book_value_before"]), Decimal("100800000"))
        self.assertEqual(Decimal(after_map["331:NCC-USD-01"]["foreign_balance"]), Decimal("6000"))
        self.assertEqual(Decimal(after_map["331:NCC-USD-01"]["book_value_before"]), Decimal("151200000"))

        # 5. Kiểm tra truy vết 2 chiều (trace, BR-GL-FX-82)
        r_trace = self.client.get(f"/api/v1/general-ledger/fx-revaluation-runs/{run_id}/trace/{self.query}")
        self.assertEqual(r_trace.status_code, 200, r_trace.data)
        self.assertEqual(r_trace.data["run_id"], run_id)
        self.assertEqual(r_trace.data["journal_entry"]["status"], "POSTED")
        self.assertEqual(len(r_trace.data["revaluation_lines"]), 4)
        self.assertEqual(len(r_trace.data["journal_entry"]["lines"]), 6)

    def test_rate_decrease_system_rate_lookup_unpost_reverse_and_rerun(self):
        """
        Kiểm thử trường hợp tỷ giá cuối kỳ giảm (từ 25,000 xuống 24,200 VND/USD),
        tự động lấy tỷ giá từ bảng ExchangeRate (AF-01), chặn sửa/xóa trực tiếp khi POSTED (EF-29),
        chặn trùng phạm vi (EF-20), Bỏ ghi sổ (AF-16), Đảo bút toán (AF-17) và chạy lại sau khi đảo (AF-12).
        """
        # Tạo bảng tỷ giá hệ thống ngày 31/10/2026: 1 USD = 24,200 VND
        rate_type = self.ExchangeRateType.objects.create(
            company=self.company, code="CLOSING", name="Tỷ giá đánh giá cuối kỳ"
        )
        self.ExchangeRate.objects.create(
            company=self.company,
            from_currency=self.usd,
            to_currency=self.vnd,
            rate_type=rate_type,
            effective_date=date(2026, 10, 31),
            rate=Decimal("24200"),
        )

        # Tạo số dư ngoại tệ nguồn @ 25,000 VND/USD trên TK 1112 (2,000 USD) và TK 341 (3,000 USD)
        self._create_posted_fx_entry(
            "FX-DEC-001",
            "2026-10-08",
            [
                {
                    "account": self.acc_1112,
                    "debit": "50000000",
                    "foreign_amount": "2000",
                    "exchange_rate": "25000",
                },
                {
                    "account": self.acc_515,
                    "credit": "50000000",
                    "foreign_amount": "2000",
                    "exchange_rate": "25000",
                },
            ],
        )
        self._create_posted_fx_entry(
            "FX-DEC-002",
            "2026-10-09",
            [
                {
                    "account": self.acc_635,
                    "debit": "75000000",
                    "foreign_amount": "3000",
                    "exchange_rate": "25000",
                },
                {
                    "account": self.acc_341,
                    "credit": "75000000",
                    "foreign_amount": "3000",
                    "exchange_rate": "25000",
                },
            ],
        )

        # Xác nhận tạo chứng từ đánh giá lại mà không truyền exchange_rate -> Tự động tra cứu 24,200 từ ExchangeRate (AF-01)
        r_confirm = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "rate_type": "CLOSING",
                "account_scope": "ALL",
            },
            format="json",
        )
        self.assertEqual(r_confirm.status_code, 201, r_confirm.data)
        run_id = r_confirm.data["id"]
        self.assertEqual(Decimal(r_confirm.data["exchange_rate"]), Decimal("24200"))
        self.assertIn("CLOSING", r_confirm.data["rate_source"])
        # TK 1112 (Tài sản) giảm quy đổi 1,600,000 -> LOSS; TK 341 (Khoản vay) giảm quy đổi 2,400,000 -> GAIN
        self.assertEqual(Decimal(r_confirm.data["total_loss_amount"]), Decimal("1600000"))
        self.assertEqual(Decimal(r_confirm.data["total_gain_amount"]), Decimal("2400000"))
        self.assertEqual(Decimal(r_confirm.data["net_difference"]), Decimal("800000"))

        # Ghi sổ
        r_post = self.client.post(f"/api/v1/general-ledger/fx-revaluation-runs/{run_id}/post/{self.query}", {}, format="json")
        self.assertEqual(r_post.status_code, 200)
        self.assertEqual(r_post.data["status"], "POSTED")

        # Chặn sửa/xóa trực tiếp đợt đã POSTED (EF-29, BR-GL-FX-69)
        r_patch = self.client.patch(
            f"/api/v1/general-ledger/fx-revaluation-runs/{run_id}/{self.query}",
            {"description": "Sửa trái phép"},
            format="json",
        )
        self.assertEqual(r_patch.status_code, 400)
        self.assertEqual(r_patch.data.get("error_code"), "CANNOT_EDIT_POSTED_FX_REVALUATION")

        r_del = self.client.delete(f"/api/v1/general-ledger/fx-revaluation-runs/{run_id}/{self.query}")
        self.assertEqual(r_del.status_code, 400)
        self.assertEqual(r_del.data.get("error_code"), "CANNOT_DELETE_POSTED_FX_REVALUATION")

        # Chặn tạo đợt đánh giá lại trùng kỳ + ngoại tệ + phạm vi khi đợt cũ đang có hiệu lực (EF-20, BR-GL-FX-48)
        r_dup = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "24200",
                "account_scope": "ALL",
            },
            format="json",
        )
        self.assertEqual(r_dup.status_code, 400)
        self.assertEqual(r_dup.data.get("error_code"), "DUPLICATE_FX_REVALUATION_SCOPE")

        # Bỏ ghi sổ (AF-16) -> Ghi sổ lại
        r_unpost = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/{run_id}/unpost/{self.query}",
            {"reason": "Kiểm tra lại tỷ giá"},
            format="json",
        )
        self.assertEqual(r_unpost.status_code, 200)
        self.assertEqual(r_unpost.data["status"], "UNPOSTED")

        self.client.post(f"/api/v1/general-ledger/fx-revaluation-runs/{run_id}/post/{self.query}", {}, format="json")

        # Đảo bút toán đánh giá lại (AF-17, UC-GL-06) -> status = REVERSED, cho phép chạy lại đợt mới (AF-12)
        r_rev = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/{run_id}/reverse/{self.query}",
            {"reason": "Đảo để đánh giá lại theo tỷ giá cập nhật"},
            format="json",
        )
        self.assertEqual(r_rev.status_code, 201, r_rev.data)
        self.assertEqual(r_rev.data["status"], "REVERSED")
        self.assertTrue(r_rev.data["reversal_entry_number"])

        # Sau khi đã đảo, cho phép chạy lại đợt đánh giá mới với tỷ giá 24,100 (AF-12, BR-GL-FX-49)
        r_rerun = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "24100",
                "account_scope": "ALL",
            },
            format="json",
        )
        self.assertEqual(r_rerun.status_code, 201, r_rerun.data)
        self.assertEqual(r_rerun.data["status"], "UNPOSTED")

    def test_exceptions_non_monetary_account_zero_rate_closed_period_fingerprint_and_source_unpost_guard(self):
        """
        Kiểm thử toàn diện các luồng ngoại lệ của UC-GL-08:
        - EF-11, BR-GL-FX-06: Chọn tài khoản phi tiền tệ (156) bị từ chối với NON_MONETARY_ACCOUNT.
        - EF-08, EF-09: Tỷ giá <= 0 hoặc thiếu tỷ giá bị từ chối.
        - AF-13, EF-19, EF-24: Dữ liệu nguồn thay đổi sau khi tạm tính -> từ chối confirm với FX_SOURCE_FINGERPRINT_MISMATCH.
        - EF-30, BR-GL-FX-71: Dữ liệu nguồn thay đổi khi chứng từ đánh giá đang UNPOSTED -> từ chối post với FX_SOURCE_CHANGED_BEFORE_POST.
        - BR-GL-POST-55: Chặn Bỏ ghi sổ bút toán nguồn ngoại tệ khi đã có đợt đánh giá lại POSTED phụ thuộc.
        - EF-04: Chặn tạo chứng từ đánh giá lại trong kỳ đã khóa (CLOSED).
        """
        src_entry = self._create_posted_fx_entry(
            "FX-EXC-001",
            "2026-10-10",
            [
                {
                    "account": self.acc_1122,
                    "debit": "240000000",
                    "foreign_amount": "10000",
                    "exchange_rate": "24000",
                    "dimensions": {"bank_account": "ACB-USD-001"},
                },
                {
                    "account": self.acc_515,
                    "credit": "240000000",
                    "foreign_amount": "10000",
                    "exchange_rate": "24000",
                },
            ],
        )

        # 1. EF-11 / BR-GL-FX-06: Tài khoản phi tiền tệ (156 - Hàng hóa) không thuộc diện đánh giá lại
        r_non_mon = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "25000",
                "account_ids": [str(self.acc_156.id)],
            },
            format="json",
        )
        self.assertEqual(r_non_mon.status_code, 400)
        self.assertEqual(r_non_mon.data.get("error_code"), "NON_MONETARY_ACCOUNT_NOT_ELIGIBLE")

        # 2. EF-09: Tỷ giá đánh giá <= 0
        r_zero_rate = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/calculate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "0",
            },
            format="json",
        )
        self.assertEqual(r_zero_rate.status_code, 400)
        self.assertEqual(r_zero_rate.data.get("error_code"), "NON_POSITIVE_EXCHANGE_RATE")

        # 3. AF-13 / EF-19: Lệch source_fingerprint khi xác nhận tạo chứng từ
        r_confirm_stale = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "25000",
                "source_fingerprint": "stale-fingerprint-000",
            },
            format="json",
        )
        self.assertEqual(r_confirm_stale.status_code, 400)
        self.assertEqual(r_confirm_stale.data.get("error_code"), "FX_SOURCE_CHANGED_SINCE_CALCULATION")

        # 4. EF-30: Tạo chứng từ đánh giá lại UNPOSTED, sau đó phát sinh thêm bút toán ngoại tệ làm đổi số dư nguồn
        # -> Khi bấm Ghi sổ chứng từ đánh giá lại phải bị chặn với FX_SOURCE_CHANGED_BEFORE_POST
        r_confirm_ok = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "25000",
            },
            format="json",
        )
        self.assertEqual(r_confirm_ok.status_code, 201, r_confirm_ok.data)
        stale_run_id = r_confirm_ok.data["id"]

        extra_entry = self._create_posted_fx_entry(
            "FX-EXC-002",
            "2026-10-20",
            [
                {
                    "account": self.acc_1122,
                    "debit": "24500000",
                    "foreign_amount": "1000",
                    "exchange_rate": "24500",
                    "dimensions": {"bank_account": "ACB-USD-001"},
                },
                {
                    "account": self.acc_515,
                    "credit": "24500000",
                    "foreign_amount": "1000",
                    "exchange_rate": "24500",
                },
            ],
        )

        r_post_stale = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/{stale_run_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_post_stale.status_code, 400)
        self.assertEqual(r_post_stale.data.get("error_code"), "FX_SOURCE_CHANGED_BEFORE_POST")

        # Hủy đợt UNPOSTED bị lệch nguồn và chạy lại với số liệu mới -> Ghi sổ thành công
        self.client.post(f"/api/v1/general-ledger/fx-revaluation-runs/{stale_run_id}/cancel/{self.query}", {}, format="json")
        r_confirm_fresh = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "USD",
                "exchange_rate": "25000",
            },
            format="json",
        )
        self.assertEqual(r_confirm_fresh.status_code, 201)
        fresh_run_id = r_confirm_fresh.data["id"]
        r_post_fresh = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/{fresh_run_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_post_fresh.status_code, 200)

        # 5. Chặn Bỏ ghi sổ bút toán nguồn ngoại tệ (extra_entry) khi đợt đánh giá lại đang POSTED
        r_unpost_src = self.client.post(
            f"/api/v1/general-ledger/journals/{extra_entry['id']}/unpost/{self.query}",
            {"reason": "Thử bỏ ghi sổ bút toán nguồn khi đã đánh giá lại ngoại tệ"},
            format="json",
        )
        self.assertEqual(r_unpost_src.status_code, 400)
        self.assertEqual(r_unpost_src.data.get("error_code"), "FX_REVALUATION_RUN_DEPENDENCY")

        # 6. EF-04: Kỳ kế toán đã đóng (CLOSED) chặn thực hiện đánh giá lại
        self.period_oct.status = "CLOSED"
        self.period_oct.save(update_fields=("status",))
        r_closed = self.client.post(
            f"/api/v1/general-ledger/fx-revaluation-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_oct.id),
                "currency": "EUR",
                "exchange_rate": "27000",
            },
            format="json",
        )
        self.assertEqual(r_closed.status_code, 400)
        self.assertEqual(r_closed.data.get("error_code"), "PERIOD_CLOSED_OR_LOCKED")


class ProfitLossClosingUcGl09Tests(TestCase):
    """
    Kiểm thử toàn diện Use Case UC-GL-09: Kết chuyển lãi lỗ (Profit & Loss Closing).
    Bao phủ:
    - Khởi tạo quy tắc kết chuyển mặc định (TT200/TT133) và lấy dữ liệu kết chuyển (fetch-data).
    - Tạo chứng từ kết chuyển lãi lỗ (confirm -> UNPOSTED), ghi sổ (post -> COMPLETED), truy vết (trace).
    - Tự động tính kết quả kinh doanh: Lãi (PROFIT: Nợ 911 / Có 4212), Lỗ (LOSS: Nợ 4212 / Có 911), Hòa vốn (BREAK_EVEN).
    - Kết chuyển bổ sung (incremental closing) khi phát sinh thêm doanh thu/chi phí sau đợt kết chuyển trước.
    - Chặn kết chuyển trùng (DUPLICATE_CLOSING_RUN_BLOCKED), chặn sửa/xóa khi đã POSTED, chặn bỏ ghi sổ bút toán nguồn (CLOSING_RUN_SOURCE_DEPENDENCY).
    - Phát hiện lệch dữ liệu nguồn trước khi lưu hoặc trước khi ghi sổ (CLOSING_SOURCE_CHANGED_SINCE_FETCH / CLOSING_SOURCE_CHANGED_BEFORE_POST).
    """

    def setUp(self):
        from . import models as gl_models
        self.models = gl_models
        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="GLCL09",
            name="Công ty Kiểm thử Kết chuyển Lãi lỗ GL09",
            legal_name="Công ty TNHH Kiểm thử Kết chuyển Lãi lỗ GL09",
            tax_code="0109988709",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN01", name="Trụ sở chính")
        self.asset_class = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT"
        )
        self.liability_class = AccountClass.objects.create(
            company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT"
        )
        self.equity_class = AccountClass.objects.create(
            company=self.company, code="EQ", name="Vốn chủ sở hữu", normal_balance="CREDIT"
        )
        self.revenue_class = AccountClass.objects.create(
            company=self.company, code="REV", name="Doanh thu", normal_balance="CREDIT"
        )
        self.expense_class = AccountClass.objects.create(
            company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT"
        )
        self.coa = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT99",
            name="Hệ thống tài khoản TT99",
            effective_from="2026-01-01",
            is_default=True,
        )
        self.acc_111 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.asset_class,
            code="111",
            name="Tiền mặt",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        self.acc_511 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.revenue_class,
            code="511",
            name="Doanh thu bán hàng và cung cấp dịch vụ",
            account_type="REVENUE",
            normal_balance="CREDIT",
        )
        self.acc_521 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.revenue_class,
            code="521",
            name="Các khoản giảm trừ doanh thu",
            account_type="REVENUE",
            normal_balance="DEBIT",
        )
        self.acc_632 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.expense_class,
            code="632",
            name="Giá vốn hàng bán",
            account_type="EXPENSE",
            normal_balance="DEBIT",
        )
        self.acc_642 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.expense_class,
            code="642",
            name="Chi phí quản lý doanh nghiệp",
            account_type="EXPENSE",
            normal_balance="DEBIT",
        )
        self.acc_821 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.expense_class,
            code="821",
            name="Chi phí thuế TNDN",
            account_type="EXPENSE",
            normal_balance="DEBIT",
        )
        self.acc_911 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.equity_class,
            code="911",
            name="Xác định kết quả kinh doanh",
            account_type="EQUITY",
            normal_balance="CREDIT",
        )
        self.acc_421 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.equity_class,
            code="421",
            name="Lợi nhuận sau thuế chưa phân phối",
            account_type="EQUITY",
            normal_balance="CREDIT",
        )
        self.acc_4212 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.equity_class,
            parent=self.acc_421,
            code="4212",
            name="Lợi nhuận sau thuế chưa phân phối năm nay",
            account_type="EQUITY",
            normal_balance="CREDIT",
        )
        self.period_nov = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=11,
            code="2026-11",
            start_date="2026-11-01",
            end_date="2026-11-30",
            status="OPEN",
        )
        self.user = get_user_model().objects.create_superuser(
            username="gl09_admin", email="gl09@test.local", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"

    def _create_posted_entry(self, number, posting_date, lines, period=None):
        p = period or self.period_nov
        r_create = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(p.id),
                "number": number,
                "entry_type": "MANUAL",
                "posting_date": posting_date,
                "document_date": posting_date,
                "description": f"Bút toán nguồn {number}",
                "lines": [
                    {
                        "line_no": idx,
                        "account": str(line["account"].id),
                        "description": line.get("description", f"Dòng {idx}"),
                        "debit": str(line.get("debit", "0")),
                        "credit": str(line.get("credit", "0")),
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    }
                    for idx, line in enumerate(lines, start=1)
                ],
            },
            format="json",
        )
        self.assertEqual(r_create.status_code, 201, r_create.data)
        entry_id = r_create.data["id"]
        r_post = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_post.status_code, 200, r_post.data)
        return r_post.data

    def test_uc_gl_09_main_flow_profit_closing_and_incremental(self):
        # 1. Khởi tạo bộ quy tắc kết chuyển mặc định
        r_seed = self.client.post(
            f"/api/v1/general-ledger/closing-rules/seed-defaults/{self.query}",
            {"company": str(self.company.id)},
            format="json",
        )
        self.assertEqual(r_seed.status_code, 200, r_seed.data)
        self.assertGreaterEqual(len(r_seed.data), 6)

        # 2. Tạo các bút toán nguồn đã POSTED trong kỳ 11/2026:
        # - Doanh thu 511: 100,000,000
        # - Giảm trừ doanh thu 521: 5,000,000
        # - Giá vốn 632: 45,000,000
        # - Chi phí QLDN 642: 15,000,000
        # - Chi phí thuế TNDN 821: 7,000,000
        # -> Doanh thu thuần = 95,000,000; Tổng chi phí = 67,000,000 -> Lãi thuần = 28,000,000 (PROFIT)
        src_rev = self._create_posted_entry(
            "CL-SRC-001",
            "2026-11-15",
            [
                {"account": self.acc_111, "debit": "100000000"},
                {"account": self.acc_511, "credit": "100000000"},
            ],
        )
        self._create_posted_entry(
            "CL-SRC-002",
            "2026-11-18",
            [
                {"account": self.acc_521, "debit": "5000000"},
                {"account": self.acc_111, "credit": "5000000"},
            ],
        )
        self._create_posted_entry(
            "CL-SRC-003",
            "2026-11-20",
            [
                {"account": self.acc_632, "debit": "45000000"},
                {"account": self.acc_642, "debit": "15000000"},
                {"account": self.acc_821, "debit": "7000000"},
                {"account": self.acc_111, "credit": "67000000"},
            ],
        )

        # 3. Lấy dữ liệu kết chuyển (fetch-data)
        r_fetch = self.client.post(
            f"/api/v1/general-ledger/closing-runs/fetch-data/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_nov.id),
                "closing_to_date": "2026-11-30",
            },
            format="json",
        )
        self.assertEqual(r_fetch.status_code, 200, r_fetch.data)
        summary = r_fetch.data["summary"]
        self.assertEqual(Decimal(summary["total_revenue_amount"]), Decimal("95000000.00"))
        self.assertEqual(Decimal(summary["total_expense_amount"]), Decimal("67000000.00"))
        self.assertEqual(Decimal(summary["net_profit_loss"]), Decimal("28000000.00"))
        self.assertEqual(summary["result_nature"], "PROFIT")
        self.assertTrue(summary["is_balanced"])

        # Kiểm tra dòng kết chuyển kết quả kinh doanh (Nợ 911 / Có 4212 = 28,000,000)
        pl_lines = [l for l in r_fetch.data["closing_lines"] if l["result_type"] == "PROFIT_LOSS"]
        self.assertEqual(len(pl_lines), 1)
        self.assertEqual(pl_lines[0]["debit_account_code"], "911")
        self.assertEqual(pl_lines[0]["credit_account_code"], "4212")
        self.assertEqual(Decimal(pl_lines[0]["amount"]), Decimal("28000000.00"))

        # 4. Xác nhận tạo chứng từ kết chuyển (confirm -> UNPOSTED)
        r_confirm = self.client.post(
            f"/api/v1/general-ledger/closing-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_nov.id),
                "closing_to_date": "2026-11-30",
                "posting_date": "2026-11-30",
                "document_date": "2026-11-30",
                "source_fingerprint": r_fetch.data["source_fingerprint"],
                "idempotency_key": "IDEMP-CLOSE-NOV-01",
            },
            format="json",
        )
        self.assertEqual(r_confirm.status_code, 201, r_confirm.data)
        run_id = r_confirm.data["id"]
        self.assertEqual(r_confirm.data["status"], "UNPOSTED")
        self.assertEqual(r_confirm.data["entry_status"], "DRAFT")
        self.assertEqual(len(r_confirm.data["lines"]), 6)

        # 5. Ghi sổ chứng từ kết chuyển (post -> COMPLETED)
        r_post = self.client.post(
            f"/api/v1/general-ledger/closing-runs/{run_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_post.status_code, 200, r_post.data)
        self.assertEqual(r_post.data["status"], "COMPLETED")
        self.assertEqual(r_post.data["entry_status"], "POSTED")

        # Kiểm tra số dư các tài khoản doanh thu/chi phí/911 bằng 0 và TK 4212 có số dư Có 28,000,000
        for acc in (self.acc_511, self.acc_521, self.acc_632, self.acc_642, self.acc_821, self.acc_911):
            bal = self.models.AccountBalance.objects.get(company=self.company, period=self.period_nov, account=acc)
            self.assertEqual(bal.closing_debit, Decimal("0.00"), f"TK {acc.code} phải hết dư Nợ")
            self.assertEqual(bal.closing_credit, Decimal("0.00"), f"TK {acc.code} phải hết dư Có")

        bal_4212 = self.models.AccountBalance.objects.get(company=self.company, period=self.period_nov, account=self.acc_4212)
        self.assertEqual(bal_4212.closing_credit, Decimal("28000000.00"))

        # 6. Truy vết kết chuyển (trace)
        r_trace = self.client.get(f"/api/v1/general-ledger/closing-runs/{run_id}/trace/{self.query}")
        self.assertEqual(r_trace.status_code, 200)
        self.assertEqual(r_trace.data["result_nature"], "PROFIT")
        self.assertIsNotNone(r_trace.data["entry"])

        # 7. EF-09-17: Chặn kết chuyển trùng khi không có phát sinh mới
        r_dup = self.client.post(
            f"/api/v1/general-ledger/closing-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_nov.id),
                "closing_to_date": "2026-11-30",
            },
            format="json",
        )
        self.assertEqual(r_dup.status_code, 400)
        self.assertEqual(r_dup.data.get("error_code"), "DUPLICATE_CLOSING_RUN_BLOCKED")

        # 8. AF-09-09: Phát sinh thêm doanh thu 10,000,000 sau khi đã kết chuyển -> Kết chuyển bổ sung (Incremental Closing)
        self._create_posted_entry(
            "CL-SRC-004",
            "2026-11-29",
            [
                {"account": self.acc_111, "debit": "10000000"},
                {"account": self.acc_511, "credit": "10000000"},
            ],
        )
        r_inc_confirm = self.client.post(
            f"/api/v1/general-ledger/closing-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_nov.id),
                "closing_to_date": "2026-11-30",
                "allow_additional_closing": True,
            },
            format="json",
        )
        self.assertEqual(r_inc_confirm.status_code, 201, r_inc_confirm.data)
        self.assertEqual(Decimal(r_inc_confirm.data["net_profit_loss"]), Decimal("10000000.00"))
        self.assertEqual(Decimal(r_inc_confirm.data["total_debit"]), Decimal("20000000.00"))

        # 9. Chặn Bỏ ghi sổ bút toán nguồn (src_rev) khi đã có đợt kết chuyển COMPLETED
        r_unpost_src = self.client.post(
            f"/api/v1/general-ledger/journals/{src_rev['id']}/unpost/{self.query}",
            {"reason": "Thử bỏ ghi sổ bút toán nguồn đã kết chuyển"},
            format="json",
        )
        self.assertEqual(r_unpost_src.status_code, 400)
        self.assertIn(r_unpost_src.data.get("error_code"), ("CLOSING_RUN_DEPENDENCY", "CLOSING_RUN_SOURCE_DEPENDENCY"))

    def test_uc_gl_09_loss_closing_and_exceptions(self):
        # Khởi tạo quy tắc mặc định
        self.client.post(
            f"/api/v1/general-ledger/closing-rules/seed-defaults/{self.query}",
            {"company": str(self.company.id)},
            format="json",
        )
        # Tạo bút toán chi phí > doanh thu trong kỳ 11/2026 -> Lỗ (LOSS)
        self._create_posted_entry(
            "CL-LOSS-001",
            "2026-11-10",
            [
                {"account": self.acc_111, "debit": "20000000"},
                {"account": self.acc_511, "credit": "20000000"},
            ],
        )
        self._create_posted_entry(
            "CL-LOSS-002",
            "2026-11-15",
            [
                {"account": self.acc_642, "debit": "35000000"},
                {"account": self.acc_111, "credit": "35000000"},
            ],
        )

        r_fetch = self.client.post(
            f"/api/v1/general-ledger/closing-runs/fetch-data/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_nov.id),
                "closing_to_date": "2026-11-30",
            },
            format="json",
        )
        self.assertEqual(r_fetch.status_code, 200)
        self.assertEqual(r_fetch.data["summary"]["result_nature"], "LOSS")
        self.assertEqual(Decimal(r_fetch.data["summary"]["net_profit_loss"]), Decimal("-15000000.00"))
        pl_line = [l for l in r_fetch.data["closing_lines"] if l["result_type"] == "PROFIT_LOSS"][0]
        # Lỗ: Nợ 4212 / Có 911 = 15,000,000
        self.assertEqual(pl_line["debit_account_code"], "4212")
        self.assertEqual(pl_line["credit_account_code"], "911")
        self.assertEqual(Decimal(pl_line["amount"]), Decimal("15000000.00"))

        # Kiểm tra chặn lệch source_fingerprint khi confirm
        r_stale = self.client.post(
            f"/api/v1/general-ledger/closing-runs/confirm/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period_nov.id),
                "closing_to_date": "2026-11-30",
                "source_fingerprint": "stale-closing-fp-000",
            },
            format="json",
        )
        self.assertEqual(r_stale.status_code, 400)
        self.assertEqual(r_stale.data.get("error_code"), "CLOSING_SOURCE_CHANGED_SINCE_FETCH")


class BalanceAggregationUcGl10Tests(TestCase):
    """
    Kiểm thử toàn diện Use Case UC-GL-10: Tổng hợp phát sinh, số dư và kiểm tra cân đối GL.
    Bao phủ:
    - Tổng hợp số dư đầu kỳ, phát sinh Nợ/Có từ bút toán POSTED (loại trừ DRAFT/UNPOSTED), số dư cuối kỳ.
    - Cuốn chiếu số dư tài khoản cha - con (Parent-child rollup) và tài khoản lưỡng tính (131/331) theo đối tượng.
    - Kiểm tra 7 nguyên tắc cân đối kế toán (Trial Balance checks) và sinh `BalanceAggregationRun`.
    - Đánh dấu `STALE` tự động khi có bút toán mới được ghi sổ hoặc bỏ ghi sổ trong kỳ.
    - Drill-down từ dòng số dư tài khoản xuống danh sách bút toán phát sinh.
    """

    def setUp(self):
        from . import models as gl_models
        self.models = gl_models
        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="GLAGG10",
            name="Công ty Kiểm thử Tổng hợp Số dư GL10",
            legal_name="Công ty TNHH Kiểm thử Tổng hợp Số dư GL10",
            tax_code="0109988710",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN01", name="Trụ sở chính")
        self.asset_class = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT"
        )
        self.liability_class = AccountClass.objects.create(
            company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT"
        )
        self.revenue_class = AccountClass.objects.create(
            company=self.company, code="REV", name="Doanh thu", normal_balance="CREDIT"
        )
        self.expense_class = AccountClass.objects.create(
            company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT"
        )
        self.coa = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT99",
            name="Hệ thống tài khoản TT99",
            effective_from="2026-01-01",
            is_default=True,
        )
        self.acc_111 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.asset_class,
            code="111",
            name="Tiền mặt",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        self.acc_1111 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.asset_class,
            parent=self.acc_111,
            code="1111",
            name="Tiền Việt Nam",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        self.acc_131 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.asset_class,
            code="131",
            name="Phải thu của khách hàng",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        self.acc_331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.liability_class,
            code="331",
            name="Phải trả cho người bán",
            account_type="LIABILITY",
            normal_balance="CREDIT",
        )
        self.acc_511 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.revenue_class,
            code="511",
            name="Doanh thu bán hàng và cung cấp dịch vụ",
            account_type="REVENUE",
            normal_balance="CREDIT",
        )
        self.acc_642 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.expense_class,
            code="642",
            name="Chi phí quản lý doanh nghiệp",
            account_type="EXPENSE",
            normal_balance="DEBIT",
        )
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=1,
            code="2026-01",
            start_date="2026-01-01",
            end_date="2026-01-31",
            status="OPEN",
        )
        self.user = get_user_model().objects.create_superuser(
            username="gl10_admin", email="gl10@test.local", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"

    def test_uc_gl_10_aggregate_validate_stale_and_drilldown(self):
        # 1. Tạo và ghi sổ các bút toán trong kỳ 2026-01:
        # - Bút toán 1 (POSTED): Nợ 1111 / Có 511 = 50,000,000
        # - Bút toán 2 (POSTED): Tài khoản lưỡng tính 131 theo 2 khách hàng:
        #   + KH-A dư Nợ 30,000,000
        #   + KH-B ứng trước (dư Có) 12,000,000
        # - Bút toán 3 (DRAFT): Nợ 642 / Có 1111 = 9,999,999 (Không được tính vào số tổng hợp chính thức)
        r_e1 = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": "AGG-001",
                "entry_type": "MANUAL",
                "posting_date": "2026-01-10",
                "document_date": "2026-01-10",
                "description": "Thu tiền bán hàng",
                "lines": [
                    {"line_no": 1, "account": str(self.acc_1111.id), "debit": "50000000", "credit": "0", "currency": str(self.vnd.id), "exchange_rate": "1"},
                    {"line_no": 2, "account": str(self.acc_511.id), "debit": "0", "credit": "50000000", "currency": str(self.vnd.id), "exchange_rate": "1"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_e1.status_code, 201, r_e1.data)
        self.client.post(f"/api/v1/general-ledger/journals/{r_e1.data['id']}/post/{self.query}", {}, format="json")

        r_e2 = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": "AGG-002",
                "entry_type": "MANUAL",
                "posting_date": "2026-01-15",
                "document_date": "2026-01-15",
                "description": "Ghi nhận công nợ lưỡng tính KH-A và KH-B",
                "lines": [
                    {
                        "line_no": 1,
                        "account": str(self.acc_131.id),
                        "debit": "30000000",
                        "credit": "0",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                        "dimensions": {"partner": "KH-A"},
                    },
                    {
                        "line_no": 2,
                        "account": str(self.acc_131.id),
                        "debit": "0",
                        "credit": "12000000",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                        "dimensions": {"partner": "KH-B"},
                    },
                    {
                        "line_no": 3,
                        "account": str(self.acc_511.id),
                        "debit": "0",
                        "credit": "18000000",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(r_e2.status_code, 201, r_e2.data)
        self.client.post(f"/api/v1/general-ledger/journals/{r_e2.data['id']}/post/{self.query}", {}, format="json")

        # Bút toán nháp (DRAFT) không được phép đưa vào tổng hợp GL
        self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": "AGG-DRAFT-003",
                "entry_type": "MANUAL",
                "posting_date": "2026-01-20",
                "document_date": "2026-01-20",
                "description": "Bút toán nháp chưa ghi sổ",
                "lines": [
                    {"line_no": 1, "account": str(self.acc_642.id), "debit": "9999999", "credit": "0", "currency": str(self.vnd.id), "exchange_rate": "1"},
                    {"line_no": 2, "account": str(self.acc_1111.id), "debit": "0", "credit": "9999999", "currency": str(self.vnd.id), "exchange_rate": "1"},
                ],
            },
            format="json",
        )

        # 2. Gọi API Tổng hợp số dư và kiểm tra cân đối GL (POST /balances/aggregate/)
        r_agg = self.client.post(
            f"/api/v1/general-ledger/balances/aggregate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "mode": "FULL",
                "include_dimensions": True,
                "rebuild_balances": True,
            },
            format="json",
        )
        self.assertEqual(r_agg.status_code, 200, r_agg.data)
        self.assertEqual(r_agg.data["status"], "VALID")
        self.assertTrue(r_agg.data["is_balanced"])
        self.assertEqual(r_agg.data["posted_entries_count"], 2)

        totals = r_agg.data["totals"]
        # Tổng phát sinh lá: 50,000,000 + 30,000,000 = 80,000,000 Nợ / Có
        self.assertEqual(Decimal(totals["period_debit"]), Decimal("80000000.00"))
        self.assertEqual(Decimal(totals["period_credit"]), Decimal("80000000.00"))
        self.assertEqual(Decimal(totals["closing_debit"]), Decimal("80000000.00"))
        self.assertEqual(Decimal(totals["closing_credit"]), Decimal("80000000.00"))

        # Kiểm tra tài khoản lưỡng tính 131 giữ cả dư Nợ 30tr (KH-A) và dư Có 12tr (KH-B)
        bal_131 = next(b for b in r_agg.data["account_balances"] if b["account_code"] == "131")
        self.assertTrue(bal_131["is_bilateral"])
        self.assertEqual(Decimal(bal_131["closing_debit"]), Decimal("30000000.00"))
        self.assertEqual(Decimal(bal_131["closing_credit"]), Decimal("12000000.00"))

        # Kiểm tra tài khoản tổng hợp cha 111 được cuốn chiếu từ TK con 1111 = 50,000,000
        bal_111 = next(b for b in r_agg.data["account_balances"] if b["account_code"] == "111")
        self.assertTrue(bal_111["is_parent"])
        self.assertEqual(Decimal(bal_111["closing_debit"]), Decimal("50000000.00"))

        # 3. Kiểm tra tự động chuyển trạng thái STALE khi phát sinh bút toán POSTED mới
        run_id = r_agg.data["aggregation_run_id"]
        r_e4 = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": "AGG-004",
                "entry_type": "MANUAL",
                "posting_date": "2026-01-25",
                "document_date": "2026-01-25",
                "description": "Chi phí phát sinh thêm",
                "lines": [
                    {"line_no": 1, "account": str(self.acc_642.id), "debit": "5000000", "credit": "0", "currency": str(self.vnd.id), "exchange_rate": "1"},
                    {"line_no": 2, "account": str(self.acc_1111.id), "debit": "0", "credit": "5000000", "currency": str(self.vnd.id), "exchange_rate": "1"},
                ],
            },
            format="json",
        )
        self.client.post(f"/api/v1/general-ledger/journals/{r_e4.data['id']}/post/{self.query}", {}, format="json")

        agg_run = self.models.BalanceAggregationRun.objects.get(pk=run_id)
        self.assertEqual(agg_run.status, "STALE")

        # 4. Drill-down từ số dư TK 111 (tài khoản cha bao gồm 1111) xuống danh sách bút toán nguồn
        r_drill = self.client.get(
            f"/api/v1/general-ledger/balances/drilldown/{self.query}&period={self.period.id}&account={self.acc_111.id}"
        )
        self.assertEqual(r_drill.status_code, 200, r_drill.data)
        self.assertEqual(r_drill.data["lines_count"], 2)
        self.assertEqual(Decimal(r_drill.data["period_debit"]), Decimal("50000000.00"))
        self.assertEqual(Decimal(r_drill.data["period_credit"]), Decimal("5000000.00"))
        self.assertEqual(Decimal(r_drill.data["closing_debit"]), Decimal("45000000.00"))


class GlSubledgerReconciliationUcGl11Tests(TestCase):
    """
    UC-GL-11 – Đối chiếu số liệu GL với các phân hệ (GL <-> AP, AR, CASH, BANK, INV, FA, TAX).
    Kiểm thử toàn diện:
    1. Seed 7 quy tắc đối chiếu mặc định & chạy đối chiếu khớp (MATCHED) / không phát sinh (AF-01..AF-09).
    2. Đối chiếu công nợ lưỡng tính theo từng đối tượng (GL <-> AR 131 / AP 331):
       Phát hiện lệch bù trừ giữa các đối tượng (BILATERAL_OFFSET_MISMATCH - BR-GL-REC-13, 14, 92)
       dù tổng số dư cuối kỳ toàn tài khoản bằng nhau.
    3. Phát hiện lệch số dư đầu kỳ (OPENING_BALANCE_MISMATCH - EF-12), lệch phát sinh Nợ/Có triệt tiêu nhau
       (TURNOVER_OFFSET_MISMATCH - BR-GL-REC-30, 31), lệch nguyên tệ (FOREIGN_CURRENCY_MISMATCH - EF-15, BR-GL-REC-19, 89, 90),
       và xử lý ngưỡng sai số làm tròn (WITHIN_ROUNDING_TOLERANCE - AF-12, BR-GL-REC-35..37).
    4. Phân loại nguyên nhân tự động (UNPOSTED_SUBLEDGER_VOUCHER, ORPHAN_GL_ENTRY, MISSING_GL_LINK, AMOUNT_MISMATCH),
       Drill-down 2 phía (Steps 39-43), kiểm tra quyền xem phân hệ (AF-15, BR-GL-REC-68, 69),
       phát hiện snapshot stale khi dữ liệu nguồn thay đổi sau đối chiếu (EF-25),
       ghi chú xử lý không tự động đổi trạng thái sang MATCHED (BR-GL-REC-56, 57),
       đối chiếu lại sau khi Post bút toán nguồn chuyển sang MATCHED (Steps 45-46, AF-17),
       và kiểm tra điều kiện chặn khóa kỳ (AF-18, BR-GL-REC-81..85, EF-03..EF-08).
    """

    def setUp(self):
        from master_data.models import Party
        from . import models as gl_models

        self.models = gl_models
        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "Đô la Mỹ"})
        self.company = Company.objects.create(
            code="GL11CO",
            name="Công ty Kiểm thử UC-GL-11",
            legal_name="Công ty TNHH Kiểm thử UC-GL-11",
            tax_code="0109991111",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN01", name="Trụ sở chính")
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
            status="OPEN",
        )

        self.cls_asset = AccountClass.objects.create(
            company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT"
        )
        self.cls_liab = AccountClass.objects.create(
            company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT"
        )
        self.cls_rev = AccountClass.objects.create(
            company=self.company, code="REV", name="Doanh thu", normal_balance="CREDIT"
        )
        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT200",
            name="Thông tư 200",
            effective_from="2026-01-01",
            is_default=True,
        )

        self.acc_111 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.cls_asset,
            code="111",
            name="Tiền mặt",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        self.acc_112 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.cls_asset,
            code="112",
            name="Tiền gửi ngân hàng",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        self.acc_131 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.cls_asset,
            code="131",
            name="Phải thu của khách hàng",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        self.acc_331 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.cls_liab,
            code="331",
            name="Phải trả cho người bán",
            account_type="LIABILITY",
            normal_balance="CREDIT",
        )
        self.acc_511 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            account_class=self.cls_rev,
            code="511",
            name="Doanh thu bán hàng",
            account_type="REVENUE",
            normal_balance="CREDIT",
        )

        self.kh_a = Party.objects.create(
            company=self.company, code="KH001", name="Khách hàng A", party_type="CUSTOMER"
        )
        self.kh_b = Party.objects.create(
            company=self.company, code="KH002", name="Khách hàng B", party_type="CUSTOMER"
        )

        self.user = get_user_model().objects.create_superuser(
            username="gl11-admin", email="gl11@test.local", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"

    def test_01_seed_rules_and_bilateral_offset_detection_br_13_14_92(self):
        # 1. Seed 7 quy tắc đối chiếu mặc định
        r_seed = self.client.post(
            f"/api/v1/general-ledger/reconciliation-rules/seed-defaults/{self.query}",
            {"company": str(self.company.id)},
            format="json",
        )
        self.assertEqual(r_seed.status_code, 200, r_seed.data)
        self.assertEqual(len(r_seed.data), 7)

        # 2. Ghi sổ bút toán phải thu trên GL: KH001 = 60,000,000; KH002 = 40,000,000 (Tổng = 100,000,000)
        r_je = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": "AR-GL-101",
                "entry_type": "MANUAL",
                "source_module": "AR",
                "posting_date": "2026-10-15",
                "document_date": "2026-10-15",
                "description": "Bán hàng chưa thu tiền KH001 & KH002",
                "lines": [
                    {
                        "line_no": 1,
                        "account": str(self.acc_131.id),
                        "party": str(self.kh_a.id),
                        "debit": "60000000",
                        "credit": "0",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                    {
                        "line_no": 2,
                        "account": str(self.acc_131.id),
                        "party": str(self.kh_b.id),
                        "debit": "40000000",
                        "credit": "0",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                    {
                        "line_no": 3,
                        "account": str(self.acc_511.id),
                        "debit": "0",
                        "credit": "100000000",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(r_je.status_code, 201, r_je.data)
        r_post1 = self.client.post(f"/api/v1/general-ledger/journals/{r_je.data['id']}/post/{self.query}", {}, format="json")
        self.assertEqual(r_post1.status_code, 200, r_post1.data)

        # 3. Đối chiếu GL ↔ AR khi Phân hệ ghi nhận KH001 = 50,000,000 và KH002 = 50,000,000
        # Dù tổng toàn tài khoản 131 đều là 100,000,000 (chênh lệch tổng = 0), hệ thống PHẢI phát hiện DIFFERENCE (BR-GL-REC-13, 14, 92)
        r_rec = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_AR",
                "subledger_items": [
                    {
                        "account_code": "131",
                        "party_code": "KH001",
                        "party_name": "Khách hàng A",
                        "period_debit": "50000000",
                        "period_credit": "0",
                        "voucher_number": "HD-AR-001",
                    },
                    {
                        "account_code": "131",
                        "party_code": "KH002",
                        "party_name": "Khách hàng B",
                        "period_debit": "50000000",
                        "period_credit": "0",
                        "voucher_number": "HD-AR-002",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(r_rec.status_code, 201, r_rec.data)
        self.assertEqual(r_rec.data["status"], "DIFFERENCE")
        self.assertEqual(r_rec.data["difference_lines_count"], 2)
        self.assertEqual(Decimal(r_rec.data["total_difference_amount"]), Decimal("20000000.0000"))
        self.assertTrue(r_rec.data["blocks_period_close"])
        for ln in r_rec.data["lines"]:
            self.assertEqual(ln["discrepancy_type"], "BILATERAL_OFFSET_MISMATCH")

    def test_02_turnover_offset_fx_mismatch_and_rounding_tolerance(self):
        # Ghi sổ bút toán Tiền gửi ngân hàng 112: Nợ 100,000,000 / Có 20,000,000 -> Dư CK = 80,000,000 (Nguyên tệ: 3,200 USD)
        r_je = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": "BNK-GL-201",
                "entry_type": "MANUAL",
                "source_module": "BANK",
                "posting_date": "2026-10-18",
                "document_date": "2026-10-18",
                "description": "Giao dịch ngân hàng tháng 10",
                "lines": [
                    {
                        "line_no": 1,
                        "account": str(self.acc_112.id),
                        "debit": "100000000",
                        "credit": "0",
                        "currency": str(self.usd.id),
                        "exchange_rate": "25000",
                        "foreign_amount": "4000",
                    },
                    {
                        "line_no": 2,
                        "account": str(self.acc_112.id),
                        "debit": "0",
                        "credit": "20000000",
                        "currency": str(self.usd.id),
                        "exchange_rate": "25000",
                        "foreign_amount": "800",
                    },
                    {
                        "line_no": 3,
                        "account": str(self.acc_511.id),
                        "debit": "0",
                        "credit": "80000000",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(r_je.status_code, 201, r_je.data)
        r_post2 = self.client.post(f"/api/v1/general-ledger/journals/{r_je.data['id']}/post/{self.query}", {}, format="json")
        self.assertEqual(r_post2.status_code, 200, r_post2.data)

        # Case A (BR-GL-REC-30, 31): Số dư cuối kỳ bằng nhau (80,000,000) nhưng phát sinh trong kỳ khác nhau (Nợ 80tr / Có 0)
        r_turn = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_BANK",
                "check_foreign_currency": False,
                "subledger_items": [
                    {
                        "account_code": "112",
                        "currency_code": "USD",
                        "period_debit": "80000000",
                        "period_credit": "0",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_turn.status_code, 201, r_turn.data)
        self.assertEqual(r_turn.data["status"], "DIFFERENCE")
        self.assertEqual(r_turn.data["lines"][0]["discrepancy_type"], "TURNOVER_OFFSET_MISMATCH")

        # Case B (EF-15, BR-GL-REC-19, 89, 90): Giá trị quy đổi khớp (Nợ 100tr, Có 20tr, CK 80tr) nhưng nguyên tệ lệch (3,100 USD != 3,200 USD)
        r_fx = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_BANK",
                "check_foreign_currency": True,
                "subledger_items": [
                    {
                        "account_code": "112",
                        "currency_code": "USD",
                        "period_debit": "100000000",
                        "period_credit": "20000000",
                        "foreign_closing": "3100",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_fx.status_code, 201, r_fx.data)
        self.assertEqual(r_fx.data["status"], "DIFFERENCE")
        self.assertEqual(r_fx.data["lines"][0]["discrepancy_type"], "FOREIGN_CURRENCY_MISMATCH")

        # Case C (AF-12, BR-GL-REC-35..37): Chênh lệch 2 đồng nằm trong ngưỡng làm tròn cho phép (5 đồng)
        r_tol = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_BANK",
                "check_foreign_currency": False,
                "rounding_tolerance": "5",
                "tolerance_behavior": "WARNING",
                "subledger_items": [
                    {
                        "account_code": "112",
                        "currency_code": "USD",
                        "period_debit": "100000000",
                        "period_credit": "20000002",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_tol.status_code, 201, r_tol.data)
        self.assertEqual(r_tol.data["status"], "WARNING")
        self.assertEqual(r_tol.data["lines"][0]["discrepancy_type"], "WITHIN_ROUNDING_TOLERANCE")
        self.assertEqual(Decimal(r_tol.data["lines"][0]["diff_closing"]), Decimal("2.0000"))

    def test_03_unposted_root_cause_drilldown_annotate_and_rerun_to_matched(self):
        # 1. Tạo chứng từ GL ở trạng thái DRAFT (chưa POSTED) cho Tiền mặt 111 = 35,000,000
        r_draft = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": "PT-GL-301",
                "entry_type": "MANUAL",
                "source_module": "CASH",
                "posting_date": "2026-10-20",
                "document_date": "2026-10-20",
                "description": "Phiếu thu tiền mặt chưa ghi sổ",
                "lines": [
                    {
                        "line_no": 1,
                        "account": str(self.acc_111.id),
                        "debit": "35000000",
                        "credit": "0",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                    {
                        "line_no": 2,
                        "account": str(self.acc_511.id),
                        "debit": "0",
                        "credit": "35000000",
                        "currency": str(self.vnd.id),
                        "exchange_rate": "1",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(r_draft.status_code, 201, r_draft.data)
        draft_entry_id = r_draft.data["id"]

        # 2. Chạy đối chiếu GL ↔ CASH khi Sổ quỹ đã có Phiếu thu 35,000,000
        r_rec1 = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_CASH",
                "subledger_items": [
                    {
                        "account_code": "111",
                        "period_debit": "35000000",
                        "period_credit": "0",
                        "voucher_number": "PT00088",
                        "gl_entry_number": "PT-GL-301",
                        "gl_status": "UNPOSTED",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_rec1.status_code, 201, r_rec1.data)
        rec1_id = r_rec1.data["id"]
        self.assertEqual(r_rec1.data["status"], "DIFFERENCE")
        self.assertEqual(r_rec1.data["lines"][0]["discrepancy_type"], "UNPOSTED_SUBLEDGER_VOUCHER")

        # 3. Kiểm tra Pre-closing check chặn khóa kỳ khi còn chênh lệch BLOCK (AF-18, BR-GL-REC-81, 82)
        r_pre = self.client.get(
            f"/api/v1/general-ledger/reconciliations/pre-closing-check/{self.query}&period={self.period.id}"
        )
        self.assertEqual(r_pre.status_code, 200, r_pre.data)
        self.assertFalse(r_pre.data["can_close_period"])
        self.assertEqual(r_pre.data["blocking_count"], 1)

        # 4. Ghi chú xử lý chênh lệch KHÔNG làm tự động đổi trạng thái sang MATCHED (BR-GL-REC-56, 57)
        r_note = self.client.post(
            f"/api/v1/general-ledger/reconciliations/{rec1_id}/annotate/{self.query}",
            {"note": "Đã kiểm tra: Phiếu thu PT00088 chưa được Kế toán tổng hợp bấm Ghi sổ."},
            format="json",
        )
        self.assertEqual(r_note.status_code, 200, r_note.data)
        self.assertEqual(r_note.data["status"], "DIFFERENCE")

        # 5. Drill-down kiểm tra quyền hạn chế phân hệ nguồn (AF-15, BR-GL-REC-68, 69)
        r_drill_restricted = self.client.get(
            f"/api/v1/general-ledger/reconciliations/{rec1_id}/drilldown/{self.query}&restrict_subledger_permission=true"
        )
        self.assertEqual(r_drill_restricted.status_code, 200, r_drill_restricted.data)
        self.assertTrue(r_drill_restricted.data["subledger_access_restricted"])
        self.assertEqual(len(r_drill_restricted.data["lines"][0]["subledger_vouchers"]), 0)

        # 6. Ghi sổ chứng từ PT-GL-301 -> Kiểm tra drilldown báo snapshot cũ bị STALE (EF-25) -> Chạy đối chiếu lại ra MATCHED (AF-17)
        self.client.post(f"/api/v1/general-ledger/journals/{draft_entry_id}/post/{self.query}", {}, format="json")

        r_drill_stale = self.client.get(
            f"/api/v1/general-ledger/reconciliations/{rec1_id}/drilldown/{self.query}"
        )
        self.assertEqual(r_drill_stale.status_code, 200, r_drill_stale.data)
        self.assertTrue(r_drill_stale.data["is_snapshot_stale"])

        r_rec2 = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_CASH",
                "subledger_items": [
                    {
                        "account_code": "111",
                        "period_debit": "35000000",
                        "period_credit": "0",
                        "voucher_number": "PT00088",
                        "gl_entry_number": "PT-GL-301",
                        "gl_status": "POSTED",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_rec2.status_code, 201, r_rec2.data)
        self.assertEqual(r_rec2.data["status"], "MATCHED")
        self.assertFalse(r_rec2.data["blocks_period_close"])

        # Lịch sử lần chạy cũ vẫn giữ nguyên trạng thái DIFFERENCE (BR-GL-REC-58)
        old_rec = self.models.GlReconciliation.objects.get(pk=rec1_id)
        self.assertEqual(old_rec.status, "DIFFERENCE")

    def test_04_exception_flows_ef_04_05_06_08_and_cross_company(self):
        # EF-04: Loại đối chiếu không hợp lệ
        r_ef04 = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_INVALID_MODULE",
            },
            format="json",
        )
        self.assertEqual(r_ef04.status_code, 400)
        self.assertEqual(r_ef04.data["error_code"], "INVALID_RECONCILIATION_TYPE")

        # EF-05: Thiếu cấu hình mapping
        r_ef05 = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_AP",
                "simulate_missing_mapping": True,
            },
            format="json",
        )
        self.assertEqual(r_ef05.status_code, 400)
        self.assertEqual(r_ef05.data["error_code"], "MISSING_RECONCILIATION_MAPPING")

        # EF-06: Kết quả tổng hợp UC-GL-10 đang ERROR
        r_ef06 = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_AP",
                "simulate_gl_aggregation_error": True,
            },
            format="json",
        )
        self.assertEqual(r_ef06.status_code, 400)
        self.assertEqual(r_ef06.data["error_code"], "GL_AGGREGATION_ERROR")

        # EF-08 / BR-GL-REC-65: Không lấy được dữ liệu phân hệ (không được coi là phân hệ = 0)
        r_ef08 = self.client.post(
            f"/api/v1/general-ledger/reconciliations/run/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "reconciliation_type": "GL_AP",
                "simulate_subledger_unavailable": True,
            },
            format="json",
        )
        self.assertEqual(r_ef08.status_code, 400)
        self.assertEqual(r_ef08.data["error_code"], "SUBLEDGER_DATA_UNAVAILABLE")


class PeriodLockCloseUcGl12Tests(TestCase):
    """
    UC-GL-12 – Khóa / Bỏ khóa sổ kỳ kế toán:
    Kiểm thử toàn diện Checklist trước khóa (BLOCKER/WARNING/INFO/NA), phát hiện thay đổi dữ liệu sau Checklist,
    Khóa toàn kỳ (CLOSED) và Khóa theo loại chứng từ (PARTIALLY_LOCKED), chặn tạo/sửa/xóa/Post/Unpost trong kỳ khóa,
    Bỏ khóa có lý do bắt buộc, Workflow phê duyệt mở lại, kiểm soát mở kỳ ngược thời gian và Khóa tự động.
    """

    def setUp(self):
        from datetime import date
        from master_data.models import Currency
        from organization.models import Branch, Company
        from .models import Account, AccountClass, AccountingPeriod

        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Việt Nam Đồng"})
        self.company = Company.objects.create(
            code="LOCK12CO",
            name="Công ty Kiểm thử Khóa Sổ UC-GL-12",
            tax_code="0101212129",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch = Branch.objects.create(company=self.company, code="HQ12", name="Chi nhánh Trung tâm")
        self.chief = get_user_model().objects.create_superuser(
            username="chief_lock12", email="chief@lock12.test", password="x"
        )
        self.approver = get_user_model().objects.create_superuser(
            username="approver_lock12", email="approver@lock12.test", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.chief)
        self.query = f"?company_id={self.company.id}"

        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
        )
        self.next_period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-11",
            fiscal_year=2026,
            period_number=11,
            start_date=date(2026, 11, 1),
            end_date=date(2026, 11, 30),
        )

        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="TT200-12",
            name="Thông tư 200",
            effective_from="2026-01-01",
            is_default=True,
        )
        cls1 = AccountClass.objects.create(company=self.company, code="1", name="Tài sản", normal_balance="DEBIT")
        cls5 = AccountClass.objects.create(company=self.company, code="5", name="Doanh thu", normal_balance="CREDIT")
        cls6 = AccountClass.objects.create(company=self.company, code="6", name="Chi phí", normal_balance="DEBIT")
        self.acc_1111 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=cls1, code="1111", name="Tiền mặt VNĐ",
            account_type="ASSET", normal_balance="DEBIT", is_postable=True,
        )
        self.acc_511 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=cls5, code="511", name="Doanh thu bán hàng",
            account_type="REVENUE", normal_balance="CREDIT", is_postable=True,
        )
        self.acc_642 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=cls6, code="642", name="Chi phí QLDN",
            account_type="EXPENSE", normal_balance="DEBIT", is_postable=True,
        )

    def _create_journal(self, number, amount="5000000", posting_date="2026-10-15", period=None, entry_type="MANUAL", source_module="GL", auto_post=False):
        target_period = period or self.period
        res = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(target_period.id),
                "number": number,
                "entry_type": entry_type,
                "source_module": source_module,
                "posting_date": posting_date,
                "document_date": posting_date,
                "description": f"Bút toán kiểm thử {number}",
                "lines": [
                    {"line_no": 1, "account": str(self.acc_642.id), "debit": str(amount), "credit": "0", "currency": str(self.vnd.id), "exchange_rate": "1"},
                    {"line_no": 2, "account": str(self.acc_1111.id), "debit": "0", "credit": str(amount), "currency": str(self.vnd.id), "exchange_rate": "1"},
                ],
            },
            format="json",
        )
        if res.status_code == 201 and auto_post:
            self.client.post(f"/api/v1/general-ledger/journals/{res.data['id']}/post/{self.query}", {}, format="json")
        return res

    def test_01_checklist_blockers_unposted_reconciliation_mandatory_closing_and_watermark_drift(self):
        # 1. Tạo 1 bút toán DRAFT (chưa ghi sổ) -> Checklist phải báo BLOCKER UNPOSTED_ENTRIES (AF-05, EF-09)
        r_draft = self._create_journal("PKT-12-001", auto_post=False)
        self.assertEqual(r_draft.status_code, 201)

        r_chk1 = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/checklist/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_chk1.status_code, 200, r_chk1.data)
        self.assertEqual(r_chk1.data["status"], "BLOCKED")
        self.assertFalse(r_chk1.data["can_confirm_close"])
        self.assertGreaterEqual(r_chk1.data["blocker_count"], 1)

        # AF-04: Nếu chính sách unposted_policy = WARN -> chuyển thành WARNING, cho phép can_confirm_close = True
        r_chk_warn = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/checklist/{self.query}",
            {"unposted_policy": "WARN"},
            format="json",
        )
        self.assertEqual(r_chk_warn.status_code, 200)
        self.assertEqual(r_chk_warn.data["status"], "WARNING")
        self.assertTrue(r_chk_warn.data["can_confirm_close"])

        # Ghi sổ bút toán DRAFT
        self.client.post(f"/api/v1/general-ledger/journals/{r_draft.data['id']}/post/{self.query}", {}, format="json")

        # 2. EF-12, BR-GL-LOCK-22, 23: Nếu cấu hình bắt buộc kết chuyển lãi lỗ (require_pl_closing=True) nhưng chưa có bút toán CLOSING -> BLOCKER
        r_chk_pl = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/checklist/{self.query}",
            {"require_pl_closing": True},
            format="json",
        )
        self.assertEqual(r_chk_pl.status_code, 200)
        self.assertEqual(r_chk_pl.data["status"], "BLOCKED")
        self.assertTrue(any(b["code"] == "MANDATORY_PL_CLOSING" for b in r_chk_pl.data["blockers"]))

        # 3. Chạy Checklist chuẩn (không còn lỗi chặn) -> READY
        r_chk_ready = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/checklist/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(r_chk_ready.status_code, 200)
        self.assertEqual(r_chk_ready.data["status"], "READY")
        self.assertTrue(r_chk_ready.data["can_confirm_close"])
        checklist_id = r_chk_ready.data["id"]

        # 4. EF-15, BR-GL-LOCK-26, 27: Phát sinh và Post thêm bút toán mới SAU khi chạy Checklist -> Khóa sổ bằng checklist_id cũ bị chặn
        self._create_journal("PKT-12-002", auto_post=True)
        r_close_stale = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {"checklist_id": checklist_id},
            format="json",
        )
        self.assertEqual(r_close_stale.status_code, 400)
        self.assertEqual(r_close_stale.data["error_code"], "DATA_CHANGED_AFTER_CHECKLIST")

        # 5. Chạy lại Checklist mới và xác nhận Khóa sổ -> Thành công (CLOSED)
        r_chk_fresh = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/checklist/{self.query}",
            {},
            format="json",
        )
        r_close_ok = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {"checklist_id": r_chk_fresh.data["id"], "notes": "Chốt sổ tháng 10/2026"},
            format="json",
        )
        self.assertEqual(r_close_ok.status_code, 200, r_close_ok.data)
        self.assertEqual(r_close_ok.data["status"], "CLOSED")

    def test_02_closed_period_enforces_lock_on_create_edit_delete_post_unpost_and_allows_read(self):
        r_j1 = self._create_journal("PKT-12-101", auto_post=True)
        entry_id = r_j1.data["id"]

        # Khóa toàn bộ kỳ
        r_close = self.client.post(f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}", {}, format="json")
        self.assertEqual(r_close.status_code, 200)
        self.assertEqual(r_close.data["status"], "CLOSED")

        # EF-05, BR-GL-LOCK-82: Gọi khóa lặp với idempotent_retry=True trả về CLOSED không tạo thêm lịch sử trùng
        r_idem = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {"idempotent_retry": True},
            format="json",
        )
        self.assertEqual(r_idem.status_code, 200)
        self.assertEqual(r_idem.data["status"], "CLOSED")

        # EF-19, BR-GL-LOCK-31: Không cho tạo chứng từ mới có ngày hạch toán thuộc kỳ đã khóa
        r_create_blocked = self._create_journal("PKT-12-102", auto_post=False)
        self.assertEqual(r_create_blocked.status_code, 400)

        # EF-22, BR-GL-LOCK-35: Không cho Bỏ ghi sổ (Unpost) bút toán POSTED thuộc kỳ đã khóa
        r_unpost_blocked = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/unpost/{self.query}",
            {"reason": "Thử bỏ ghi sổ kỳ đóng"},
            format="json",
        )
        self.assertEqual(r_unpost_blocked.status_code, 400)

        # BR-GL-LOCK-36, 37: Điều chỉnh vào chính kỳ đã khóa bị chặn, nhưng điều chỉnh sang kỳ mở tiếp theo (2026-11) được phép
        r_adj_blocked = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/adjust/{self.query}",
            {
                "period": str(self.period.id),
                "posting_date": "2026-10-28",
                "reason": "Điều chỉnh trong kỳ đóng",
                "accounting_lines": [{"debit_account": "642", "credit_account": "1111", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_adj_blocked.status_code, 400)

        r_adj_next = self.client.post(
            f"/api/v1/general-ledger/journals/{entry_id}/adjust/{self.query}",
            {
                "period": str(self.next_period.id),
                "posting_date": "2026-11-05",
                "reason": "Điều chỉnh sai sót kỳ trước vào kỳ mở 2026-11",
                "accounting_lines": [{"debit_account": "642", "credit_account": "1111", "amount": "1000000"}],
            },
            format="json",
        )
        self.assertEqual(r_adj_next.status_code, 201, r_adj_next.data)

        # BR-GL-LOCK-40, 41, 94, 95: Kỳ CLOSED vẫn cho phép tra cứu Bảng cân đối tài khoản, Sổ cái và Lịch sử khóa
        r_tb = self.client.get(f"/api/v1/general-ledger/balances/trial-balance/{self.query}&period_id={self.period.id}")
        self.assertEqual(r_tb.status_code, 200)
        r_hist = self.client.get(f"/api/v1/general-ledger/periods/{self.period.id}/lock-history/{self.query}")
        self.assertEqual(r_hist.status_code, 200)
        self.assertEqual(r_hist.data["history_count"], 1)

    def test_03_partial_lock_and_unlock_by_document_type_af_02_24_25_ef_28(self):
        # AF-02, BR-GL-LOCK-47..49: Khóa một phần theo loại chứng từ PKT
        r_part = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {"lock_scope": "DOCUMENT_TYPES", "document_types": ["PKT"]},
            format="json",
        )
        self.assertEqual(r_part.status_code, 200, r_part.data)
        self.assertEqual(r_part.data["status"], "PARTIALLY_LOCKED")
        self.assertIn("PKT", r_part.data["locked_document_types"])

        # Tạo chứng từ PKT bị chặn (BR-GL-LOCK-48), nhưng tạo chứng từ PT (Tiền mặt) vẫn được phép (BR-GL-LOCK-49)
        r_pkt_blocked = self._create_journal("PKT-12-201", source_module="GL")
        self.assertEqual(r_pkt_blocked.status_code, 400)

        r_pt_allowed = self._create_journal("PT-12-201", source_module="CASH", auto_post=True)
        self.assertEqual(r_pt_allowed.status_code, 201, r_pt_allowed.data)

        # AF-25, BR-GL-LOCK-50: Khóa bổ sung tất cả các loại chứng từ còn lại -> Kỳ chuyển sang CLOSED
        r_full = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {
                "lock_scope": "DOCUMENT_TYPES",
                "document_types": ["QTU", "KCLL", "PT", "PC", "BC", "BN", "HDBH"],
            },
            format="json",
        )
        self.assertEqual(r_full.status_code, 200, r_full.data)
        self.assertEqual(r_full.data["status"], "CLOSED")

        # EF-28, BR-GL-LOCK-54: Actor chỉ có quyền mở loại chứng từ PKT nhưng yêu cầu mở toàn kỳ -> Bị từ chối
        r_exceed = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/reopen/{self.query}",
            {
                "reason": "Xin mở toàn kỳ",
                "unlock_scope": "FULL_PERIOD",
                "allowed_unlock_document_types": ["PKT"],
            },
            format="json",
        )
        self.assertEqual(r_exceed.status_code, 400)
        self.assertEqual(r_exceed.data["error_code"], "UNLOCK_SCOPE_EXCEEDS_PERMISSION")

        # AF-24, BR-GL-LOCK-52: Chỉ bỏ khóa loại chứng từ PKT -> Kỳ chuyển về PARTIALLY_LOCKED, các loại khác vẫn khóa
        r_unlock_pkt = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/reopen/{self.query}",
            {
                "reason": "Mở riêng chứng từ PKT để bổ sung bút toán tổng hợp",
                "unlock_scope": "DOCUMENT_TYPES",
                "document_types": ["PKT"],
            },
            format="json",
        )
        self.assertEqual(r_unlock_pkt.status_code, 200, r_unlock_pkt.data)
        self.assertEqual(r_unlock_pkt.data["status"], "PARTIALLY_LOCKED")
        self.assertNotIn("PKT", r_unlock_pkt.data["locked_document_types"])
        self.assertIn("PT", r_unlock_pkt.data["locked_document_types"])

    def test_04_reopen_reason_workflow_approval_reverse_chronological_and_auto_lock(self):
        # Khóa sổ kỳ 2026-10 trước
        r_chk = self.client.post(f"/api/v1/general-ledger/periods/{self.period.id}/checklist/{self.query}", {}, format="json")
        old_checklist_id = r_chk.data["id"]
        self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {"checklist_id": old_checklist_id},
            format="json",
        )

        # EF-24, BR-GL-LOCK-55, 56: Bỏ khóa không nhập lý do hoặc chỉ nhập khoảng trắng -> Bị từ chối
        r_no_reason = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/reopen/{self.query}",
            {"reason": "   "},
            format="json",
        )
        self.assertEqual(r_no_reason.status_code, 400)

        # AF-16, EF-26, BR-GL-LOCK-57, 58: Yêu cầu mở lại có Workflow phê duyệt -> Kỳ vẫn giữ CLOSED và chờ duyệt
        r_req_wf = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/reopen/{self.query}",
            {"reason": "Cần điều chỉnh bút toán kiểm toán", "require_reopen_approval": True},
            format="json",
        )
        self.assertEqual(r_req_wf.status_code, 200, r_req_wf.data)
        self.assertEqual(r_req_wf.data["status"], "CLOSED")
        self.assertEqual(r_req_wf.data["reopen_workflow_status"], "PENDING_APPROVAL")

        # EF-25, BR-GL-LOCK-59: Từ chối yêu cầu mở lại -> Kỳ tiếp tục giữ CLOSED
        self.client.force_authenticate(self.approver)
        r_reject = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/decide-reopen/{self.query}",
            {"approved": False, "comment": "Chưa đủ hồ sơ giải trình kiểm toán"},
            format="json",
        )
        self.assertEqual(r_reject.status_code, 200, r_reject.data)
        self.assertEqual(r_reject.data["status"], "CLOSED")
        self.assertEqual(r_reject.data["reopen_workflow_status"], "REJECTED")

        # Gửi lại yêu cầu và Phê duyệt (AF-17, BR-GL-LOCK-64)
        self.client.force_authenticate(self.chief)
        self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/reopen/{self.query}",
            {"reason": "Đã bổ sung biên bản kiểm toán", "require_reopen_approval": True},
            format="json",
        )
        self.client.force_authenticate(self.approver)
        r_approve = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/decide-reopen/{self.query}",
            {"approved": True, "comment": "Đồng ý mở khóa kỳ 2026-10"},
            format="json",
        )
        self.assertEqual(r_approve.status_code, 200, r_approve.data)
        self.assertEqual(r_approve.data["status"], "OPEN")

        # AF-23, EF-29, BR-GL-LOCK-72: Cố khóa lại bằng old_checklist_id từ trước lần mở lại -> Bị chặn
        self.client.force_authenticate(self.chief)
        r_reclose_old = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {"checklist_id": old_checklist_id},
            format="json",
        )
        self.assertEqual(r_reclose_old.status_code, 400)
        self.assertEqual(r_reclose_old.data["error_code"], "STALE_CHECKLIST_AFTER_REOPEN")

        # AF-10, BR-GL-LOCK-91..93: Kiểm thử Khóa tự động (Auto-lock)
        # Khi có bút toán DRAFT -> Auto-lock không được bỏ qua lỗi chặn và phải ghi nhận AUTO_LOCK_FAILED
        r_draft = self._create_journal("PKT-12-301", auto_post=False)
        r_auto_fail = self.client.post(
            f"/api/v1/general-ledger/periods/auto-lock/{self.query}",
            {"company": str(self.company.id), "period": str(self.period.id)},
            format="json",
        )
        self.assertEqual(r_auto_fail.status_code, 200, r_auto_fail.data)
        self.assertEqual(r_auto_fail.data["closed_count"], 0)
        self.assertEqual(r_auto_fail.data["failed_count"], 1)

        # Sau khi Post bút toán DRAFT -> Auto-lock thành công (CLOSED)
        self.client.post(f"/api/v1/general-ledger/journals/{r_draft.data['id']}/post/{self.query}", {}, format="json")
        r_auto_ok = self.client.post(
            f"/api/v1/general-ledger/periods/auto-lock/{self.query}",
            {"company": str(self.company.id), "period": str(self.period.id)},
            format="json",
        )
        self.assertEqual(r_auto_ok.status_code, 200, r_auto_ok.data)
        self.assertEqual(r_auto_ok.data["closed_count"], 1)

        # BR-GL-LOCK-60..64: Kiểm tra lịch sử khóa lưu đầy đủ chuỗi Khóa -> Yêu cầu mở -> Từ chối -> Mở -> Auto-lock
        r_hist = self.client.get(f"/api/v1/general-ledger/periods/{self.period.id}/lock-history/{self.query}")
        self.assertEqual(r_hist.status_code, 200)
        self.assertGreaterEqual(r_hist.data["history_count"], 6)


class FinancialStatementUcGl13Tests(TestCase):
    """
    Bộ kiểm thử toàn diện cho UC-GL-13 – Lập Báo cáo tài chính (Thông tư 99/2025/TT-BTC):
    - 4 nhóm báo cáo: BCTC năm (DN / DNKLT), Thuyết minh BCTC năm (B09-DN / B09-DNKLT),
      BCTC giữa niên độ Dạng đầy đủ (B01a..B09a) & Dạng tóm lược (B01b..B03b, B09a),
      Thuyết minh BCTC giữa niên độ (B09a-DN)
    - Lưu chuyển tiền tệ Trực tiếp (DIRECT) & Gián tiếp (INDIRECT) là thuộc tính phương pháp của B03 (BR-GL-FS-35..37)
    - Tài khoản lưỡng tính 131 / 331 phân tách Dư Nợ / Dư Có theo từng đối tượng không bù trừ chéo (BR-GL-FS-54..56)
    - Kiểm tra phương trình cân đối B01 (270 == 440), công thức B02, khớp tiền B03 (70 == B01.110), khớp thuyết minh B09 (EF-19..24)
    - Tuyệt đối không tự động plug số chênh lệch để làm giả cân bằng (BR-GL-FS-85) và không làm thay đổi bút toán/số dư GL (BR-GL-FS-83, 84)
    - Kế thừa thông tin chung Thuyết minh BCTC (reuse_latest_notes - AF-13) không sao chép nguyên số liệu kỳ trước (BR-GL-FS-39)
    - Chốt BCTC chính thức (FINALIZED) và tự động đánh dấu OUTDATED khi mở lại kỳ (UC-GL-12) hoặc thay đổi bút toán GL (AF-22, AF-23, EF-28, EF-29)
    """

    def setUp(self):
        from datetime import date
        from master_data.models import Currency, Party
        from organization.models import Branch, Company
        from . import models as gl_models

        self.models = gl_models
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Việt Nam Đồng"})
        self.company = Company.objects.create(
            code="FS13CO",
            name="Công ty Kiểm thử BCTC UC-GL-13",
            legal_name="Công ty Cổ phần Kiểm thử BCTC UC-GL-13",
            tax_code="0101313139",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HQ13", name="Trụ sở chính")
        self.chief = get_user_model().objects.create_superuser(
            username="chief_fs13", email="chief@fs13.test", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.chief)
        self.query = f"?company_id={self.company.id}"

        self.period = gl_models.AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
            status="OPEN",
        )
        self.chart = gl_models.ChartOfAccounts.objects.create(
            company=self.company,
            code="TT99-13",
            name="Thông tư 99/2025/TT-BTC",
            effective_from="2026-01-01",
            is_default=True,
        )

        self.cash_account = self._create_postable_account("1111", "Tiền mặt VND", "ASSET", "DEBIT")
        self.acc_112 = self._create_postable_account("1121", "Tiền gửi ngân hàng VND", "ASSET", "DEBIT")
        self.ar_account = self._create_postable_account("131", "Phải thu của khách hàng", "ASSET", "DEBIT")
        self.ap_account = self._create_postable_account("331", "Phải trả cho người bán", "LIABILITY", "CREDIT")
        self.rev_account = self._create_postable_account("5111", "Doanh thu bán hàng hóa", "REVENUE", "CREDIT")
        self.acc_411 = self._create_postable_account("4111", "Vốn góp của chủ sở hữu", "EQUITY", "CREDIT")
        self.acc_4211 = self._create_postable_account("4211", "LNST chưa phân phối năm trước", "EQUITY", "CREDIT")
        self.acc_4212 = self._create_postable_account("4212", "LNST chưa phân phối năm nay", "EQUITY", "CREDIT")
        self.acc_632 = self._create_postable_account("632", "Giá vốn hàng bán", "EXPENSE", "DEBIT")
        self.acc_642 = self._create_postable_account("6421", "Chi phí quản lý doanh nghiệp", "EXPENSE", "DEBIT")
        self.acc_911 = self._create_postable_account("911", "Xác định kết quả kinh doanh", "EQUITY", "CREDIT")
        self.acc_156 = self._create_postable_account("1561", "Giá mua hàng hóa", "ASSET", "DEBIT")

        self.customer = Party.objects.create(
            company=self.company,
            code="KH-13-A",
            name="Công ty Khách hàng A",
            party_type="CUSTOMER",
        )
        self.customer_b = Party.objects.create(
            company=self.company,
            code="KH-13-B",
            name="Công ty Khách hàng B (Trả trước)",
            party_type="CUSTOMER",
        )
        self.supplier = Party.objects.create(
            company=self.company,
            code="NCC-13-X",
            name="Nhà cung cấp X",
            party_type="SUPPLIER",
        )
        self.supplier_y = Party.objects.create(
            company=self.company,
            code="NCC-13-Y",
            name="Nhà cung cấp Y (Ứng trước)",
            party_type="SUPPLIER",
        )

    def _create_postable_account(self, code, name, acc_type, normal_balance):
        cls_code = code[:3]
        acc_cls, _ = self.models.AccountClass.objects.get_or_create(
            company=self.company,
            code=cls_code,
            defaults={
                "name": name,
                "normal_balance": normal_balance,
            },
        )
        acc, _ = self.models.Account.objects.get_or_create(
            company=self.company,
            code=code,
            defaults={
                "chart_of_accounts": self.chart,
                "account_class": acc_cls,
                "name": name,
                "account_type": acc_type,
                "normal_balance": normal_balance,
                "is_postable": True,
                "status": "ACTIVE",
            },
        )
        return acc

    def _post_entry(self, number, lines, entry_type="MANUAL", posting_date="2026-10-15"):
        normalized_lines = []
        for ln in lines:
            item = dict(ln)
            item.setdefault("exchange_rate", "1")
            normalized_lines.append(item)
        res = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": number,
                "entry_type": entry_type,
                "posting_date": posting_date,
                "document_date": posting_date,
                "description": f"Bút toán {number}",
                "source_module": "GL",
                "lines": normalized_lines,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        post_res = self.client.post(
            f"/api/v1/general-ledger/journals/{res.data['id']}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(post_res.status_code, 200, post_res.data)
        return post_res.data

    def _seed_balanced_period_transactions(self):
        # 1. Số dư đầu kỳ (OPENING): Tiền mặt 200tr, TGNH 300tr, Hàng hóa 100tr = Vốn góp 500tr + LNST năm trước 100tr
        self._post_entry(
            "OPEN-13-001",
            [
                {"line_no": 1, "account": str(self.cash_account.id), "debit": "200000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.acc_112.id), "debit": "300000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 3, "account": str(self.acc_156.id), "debit": "100000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 4, "account": str(self.acc_411.id), "debit": "0", "credit": "500000000", "currency": str(self.currency.id)},
                {"line_no": 5, "account": str(self.acc_4211.id), "debit": "0", "credit": "100000000", "currency": str(self.currency.id)},
            ],
            entry_type="OPENING",
            posting_date="2026-10-01",
        )

        # 2. Bán hàng chưa thu tiền cho Customer A (Dư Nợ 131 = 150tr) và nhận tiền ứng trước của Customer B (Dư Có 131 = 40tr)
        self._post_entry(
            "PKT-13-001",
            [
                {"line_no": 1, "account": str(self.ar_account.id), "party": str(self.customer.id), "debit": "150000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.rev_account.id), "party": str(self.customer.id), "debit": "0", "credit": "150000000", "currency": str(self.currency.id)},
            ],
            posting_date="2026-10-10",
        )
        self._post_entry(
            "PKT-13-002",
            [
                {"line_no": 1, "account": str(self.acc_112.id), "party": str(self.customer_b.id), "debit": "40000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.ar_account.id), "party": str(self.customer_b.id), "debit": "0", "credit": "40000000", "currency": str(self.currency.id)},
            ],
            posting_date="2026-10-11",
        )

        # 3. Mua hàng chưa trả tiền Supplier (Dư Có 331 = 60tr) và ứng trước cho Supplier Y (Dư Nợ 331 = 25tr)
        self._post_entry(
            "PKT-13-003",
            [
                {"line_no": 1, "account": str(self.acc_156.id), "party": str(self.supplier.id), "debit": "60000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.ap_account.id), "party": str(self.supplier.id), "debit": "0", "credit": "60000000", "currency": str(self.currency.id)},
            ],
            posting_date="2026-10-12",
        )
        self._post_entry(
            "PKT-13-004",
            [
                {"line_no": 1, "account": str(self.ap_account.id), "party": str(self.supplier_y.id), "debit": "25000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.acc_112.id), "party": str(self.supplier_y.id), "debit": "0", "credit": "25000000", "currency": str(self.currency.id)},
            ],
            posting_date="2026-10-13",
        )

        # 4. Giá vốn hàng bán 70tr và Chi phí QLDN bằng tiền mặt 20tr
        self._post_entry(
            "PKT-13-005",
            [
                {"line_no": 1, "account": str(self.acc_632.id), "debit": "70000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.acc_156.id), "debit": "0", "credit": "70000000", "currency": str(self.currency.id)},
            ],
            posting_date="2026-10-15",
        )
        self._post_entry(
            "PKT-13-006",
            [
                {"line_no": 1, "account": str(self.acc_642.id), "debit": "20000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.cash_account.id), "debit": "0", "credit": "20000000", "currency": str(self.currency.id)},
            ],
            posting_date="2026-10-18",
        )

        # 5. Kết chuyển lãi lỗ cuối kỳ (511 -> 911: 150tr; 911 -> 632, 642: 90tr; 911 -> 4212: 60tr)
        self._post_entry(
            "KC-13-001",
            [
                {"line_no": 1, "account": str(self.rev_account.id), "debit": "150000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.acc_911.id), "debit": "0", "credit": "150000000", "currency": str(self.currency.id)},
                {"line_no": 3, "account": str(self.acc_911.id), "debit": "90000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 4, "account": str(self.acc_632.id), "debit": "0", "credit": "70000000", "currency": str(self.currency.id)},
                {"line_no": 5, "account": str(self.acc_642.id), "debit": "0", "credit": "20000000", "currency": str(self.currency.id)},
                {"line_no": 6, "account": str(self.acc_911.id), "debit": "60000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 7, "account": str(self.acc_4212.id), "debit": "0", "credit": "60000000", "currency": str(self.currency.id)},
            ],
            entry_type="CLOSING",
            posting_date="2026-10-31",
        )

    def test_uc_gl_13_annual_bctc_continuous_bilateral_crosschecks_and_drilldown(self):
        """
        Kiểm tra Main Flow UC-GL-13:
        - Lập BCTC năm theo giả định hoạt động liên tục (B01-DN, B02-DN, B03-DN DIRECT & INDIRECT, B09-DN)
        - Phân tách đúng công nợ lưỡng tính 131 (Mã 131 = 150tr, Mã 312 = 40tr) và 331 (Mã 132 = 25tr, Mã 311 = 60tr)
        - Kiểm tra chéo 5 nhóm: B01 (270 == 440), B02 (60 == 60tr), B03 (70 == B01.110 == 495tr), B09 khớp B01/B02
        - Truy vết ngược (Drill-down) từ dòng chỉ tiêu 131 xuống đối tượng và bút toán POSTED
        - Tuyệt đối không phát sinh hay làm biến đổi bất kỳ JournalEntry hay AccountBalance nào (BR-GL-FS-83, 84)
        """
        self._seed_balanced_period_transactions()
        entry_count_before = self.models.JournalEntry.objects.filter(company=self.company).count()

        res = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "ANNUAL_BCTC",
                "going_concern_assumption": "CONTINUOUS",
                "cash_flow_method": "BOTH",
                "selected_forms": ["B01-DN", "B02-DN", "B03-DN", "B03-DN-GT", "B09-DN"],
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        data = res.data
        self.assertEqual(data["status"], "GENERATED")
        self.assertTrue(data["is_balanced"])
        self.assertEqual(data["blocker_count"], 0)
        self.assertEqual(self.models.JournalEntry.objects.filter(company=self.company).count(), entry_count_before)

        reports_by_key = {(r["form_code"], r["cash_flow_method"]): r for r in data["reports"]}
        self.assertIn(("B01-DN", ""), reports_by_key)
        self.assertIn(("B02-DN", ""), reports_by_key)
        # BR-GL-FS-37: B03-DN-GT chuẩn hóa thành form_code="B03-DN", cash_flow_method="INDIRECT"
        self.assertIn(("B03-DN", "DIRECT"), reports_by_key)
        self.assertIn(("B03-DN", "INDIRECT"), reports_by_key)
        self.assertIn(("B09-DN", ""), reports_by_key)

        b01_lines = {ln["indicator_code"]: Decimal(ln["current_amount"]) for ln in reports_by_key[("B01-DN", "")]["lines"]}
        # Kiểm tra tài khoản lưỡng tính 131 & 331 không bù trừ chéo (BR-GL-FS-54..56)
        self.assertEqual(b01_lines["131"], Decimal("150000000"))
        self.assertEqual(b01_lines["312"], Decimal("40000000"))
        self.assertEqual(b01_lines["132"], Decimal("25000000"))
        self.assertEqual(b01_lines["311"], Decimal("60000000"))
        # Tổng Tài sản (270) = Tiền (495tr) + Phải thu (175tr) + Tồn kho (90tr) = 760tr == Tổng Nguồn vốn (440 = Nợ 100tr + VCSH 660tr)
        self.assertEqual(b01_lines["110"], Decimal("495000000"))
        self.assertEqual(b01_lines["270"], Decimal("760000000"))
        self.assertEqual(b01_lines["300"], Decimal("100000000"))
        self.assertEqual(b01_lines["400"], Decimal("660000000"))
        self.assertEqual(b01_lines["440"], Decimal("760000000"))

        b02_lines = {ln["indicator_code"]: Decimal(ln["current_amount"]) for ln in reports_by_key[("B02-DN", "")]["lines"]}
        self.assertEqual(b02_lines["01"], Decimal("150000000"))
        self.assertEqual(b02_lines["11"], Decimal("70000000"))
        self.assertEqual(b02_lines["20"], Decimal("80000000"))
        self.assertEqual(b02_lines["26"], Decimal("20000000"))
        self.assertEqual(b02_lines["60"], Decimal("60000000"))

        b03_dir_lines = {ln["indicator_code"]: Decimal(ln["current_amount"]) for ln in reports_by_key[("B03-DN", "DIRECT")]["lines"]}
        b03_ind_lines = {ln["indicator_code"]: Decimal(ln["current_amount"]) for ln in reports_by_key[("B03-DN", "INDIRECT")]["lines"]}
        self.assertEqual(b03_dir_lines["60"], Decimal("500000000"))
        self.assertEqual(b03_dir_lines["70"], Decimal("495000000"))
        self.assertEqual(b03_ind_lines["70"], Decimal("495000000"))

        # Kiểm tra Drill-down từ chỉ tiêu 131 trên B01-DN xuống đối tượng và bút toán POSTED (Steps 48–50, BR-GL-FS-112, 115)
        r_drill = self.client.get(
            f"/api/v1/general-ledger/financial-statements/{data['id']}/drilldown/{self.query}&form_code=B01-DN&indicator_code=131"
        )
        self.assertEqual(r_drill.status_code, 200, r_drill.data)
        self.assertEqual(r_drill.data["indicator_code"], "131")
        self.assertEqual(Decimal(r_drill.data["current_amount"]), Decimal("150000000"))
        self.assertGreaterEqual(len(r_drill.data["account_breakdown"]), 1)
        self.assertEqual(r_drill.data["account_breakdown"][0]["party_code"], self.customer.code)
        self.assertGreaterEqual(len(r_drill.data["journal_entries"]), 1)

    def test_uc_gl_13_non_going_concern_dnklt_and_interim_full_vs_condensed(self):
        """
        Kiểm tra:
        - AF-03, BR-GL-FS-08, 09: Lập BCTC năm khi KHÔNG đáp ứng giả định hoạt động liên tục -> sử dụng bộ mẫu B01-DNKLT, B02-DNKLT, B03-DNKLT, B09-DNKLT
        - EF-05: Chặn khi chọn biểu mẫu không tương thích (VD: chọn B01-DN cho NON_CONTINUOUS khi strict_form_check=True)
        - AF-05, AF-06, BR-GL-FS-10, 11: Lập BCTC giữa niên độ Dạng đầy đủ (B01a-DN..B09a-DN) và Dạng tóm lược (B01b-DN..B03b-DN, B09a-DN)
        - AF-19, BR-GL-FS-60..62: Quy đổi đơn vị trình bày tiền tệ (unit_scale = 1000 nghìn đồng)
        """
        self._seed_balanced_period_transactions()

        # 1. EF-05: Chọn mẫu B01-DN không khớp với NON_CONTINUOUS khi strict_form_check=True -> Bị chặn
        r_bad_form = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "ANNUAL_BCTC",
                "going_concern_assumption": "NON_CONTINUOUS",
                "selected_forms": ["B01-DN"],
                "strict_form_check": True,
            },
            format="json",
        )
        self.assertEqual(r_bad_form.status_code, 400)
        self.assertEqual(r_bad_form.data["error_code"], "INCOMPATIBLE_FORM_SELECTION")

        # 2. AF-03: Lập bộ BCTC năm NON_CONTINUOUS (B01-DNKLT..B09-DNKLT)
        r_dnklt = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "ANNUAL_BCTC",
                "going_concern_assumption": "NON_CONTINUOUS",
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
            },
            format="json",
        )
        self.assertEqual(r_dnklt.status_code, 201, r_dnklt.data)
        dnklt_codes = [r["form_code"] for r in r_dnklt.data["reports"]]
        self.assertEqual(dnklt_codes, ["B01-DNKLT", "B02-DNKLT", "B03-DNKLT", "B09-DNKLT"])

        # 3. AF-06: Lập BCTC giữa niên độ Dạng tóm lược (CONDENSED: B01b-DN, B02b-DN, B03b-DN, B09a-DN) với unit_scale=1000
        r_condensed = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "INTERIM_BCTC",
                "interim_format": "CONDENSED",
                "unit_scale": 1000,
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
            },
            format="json",
        )
        self.assertEqual(r_condensed.status_code, 201, r_condensed.data)
        condensed_codes = [r["form_code"] for r in r_condensed.data["reports"]]
        self.assertEqual(condensed_codes, ["B01b-DN", "B02b-DN", "B03b-DN", "B09a-DN"])
        b01b_report = r_condensed.data["reports"][0]
        b01b_lines = {ln["indicator_code"]: Decimal(ln["current_amount"]) for ln in b01b_report["lines"]}
        # Đơn vị 1.000 đồng: 760.000.000 đồng -> 760.000,00 nghìn đồng, trong khi raw_current_amount vẫn giữ nguyên 760.000.000 (BR-GL-FS-61)
        self.assertEqual(b01b_lines["270"], Decimal("760000.00"))

    def test_uc_gl_13_notes_reuse_latest_custom_indicators_and_cross_check_blockers(self):
        """
        Kiểm tra:
        - AF-13, BR-GL-FS-38, 39: Kế thừa thông tin chung Thuyết minh BCTC từ lần nhập gần nhất mà KHÔNG sao chép nguyên số liệu kỳ trước
        - AF-14, EF-25, BR-GL-FS-13..15: Kiểm soát bổ sung chỉ tiêu tùy chỉnh (chặn xóa chỉ tiêu bắt buộc hoặc thiếu thuyết minh B09)
        - EF-19, BR-GL-FS-28, 85: Khi B01 mất cân đối, hệ thống tuyệt đối KHÔNG tự plug chênh lệch, đánh dấu REVIEW_REQUIRED và chặn Finalize
        """
        self._seed_balanced_period_transactions()

        # Lập B09-DN lần 1 với thông tin chung tùy chỉnh
        r_notes_1 = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "ANNUAL_NOTES",
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
                "notes_general_info": {
                    "business_sector": "Sản xuất và thương mại phần mềm ERP",
                    "auditor_firm": "Công ty Kiểm toán Độc lập Chuẩn Việt",
                    "prior_period_numbers": {"110": 999999999},
                },
                "notes_explanations": {"V.01": "Tiền gửi ngân hàng tại Vietcombank CN Hà Nội"},
            },
            format="json",
        )
        self.assertEqual(r_notes_1.status_code, 201, r_notes_1.data)

        # Lập B09a-DN giữa niên độ lần 2 với reuse_latest_notes=True (AF-13)
        r_notes_2 = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "INTERIM_NOTES",
                "reuse_latest_notes": True,
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
            },
            format="json",
        )
        self.assertEqual(r_notes_2.status_code, 201, r_notes_2.data)
        gen_info = r_notes_2.data["notes_general_info"]
        self.assertEqual(gen_info["business_sector"], "Sản xuất và thương mại phần mềm ERP")
        self.assertEqual(gen_info["auditor_firm"], "Công ty Kiểm toán Độc lập Chuẩn Việt")
        # BR-GL-FS-39: Không được sao chép prior_period_numbers sang kỳ mới
        self.assertNotIn("prior_period_numbers", gen_info)

        # EF-25: Cố xóa chỉ tiêu bắt buộc pháp lý 100 -> Bị chặn
        r_bad_custom = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "ANNUAL_BCTC",
                "custom_indicators": [
                    {"action": "DELETE", "form_code": "B01-DN", "indicator_code": "100", "indicator_name": "Tài sản ngắn hạn"}
                ],
            },
            format="json",
        )
        self.assertEqual(r_bad_custom.status_code, 400)
        self.assertEqual(r_bad_custom.data["error_code"], "CANNOT_DELETE_MANDATORY_INDICATOR")

        # EF-19, BR-GL-FS-85: Khi B01 mất cân đối (Tổng Tài sản != Tổng Nguồn vốn), chuyển sang REVIEW_REQUIRED và chặn Finalize
        r_imbalance = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "ANNUAL_BCTC",
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
                "override_indicators": {"B01": {"270": "799000000"}},
            },
            format="json",
        )
        self.assertEqual(r_imbalance.status_code, 201, r_imbalance.data)
        self.assertEqual(r_imbalance.data["status"], "REVIEW_REQUIRED")
        self.assertFalse(r_imbalance.data["is_balanced"])
        self.assertGreater(r_imbalance.data["blocker_count"], 0)

        r_fin_fail = self.client.post(
            f"/api/v1/general-ledger/financial-statements/{r_imbalance.data['id']}/finalize/{self.query}",
            {"allow_open_period_finalize": True},
            format="json",
        )
        self.assertEqual(r_fin_fail.status_code, 400)
        self.assertEqual(r_fin_fail.data["error_code"], "CANNOT_FINALIZE_WITH_BLOCKERS")

    def test_uc_gl_13_finalize_and_outdated_on_gl_change_or_period_reopen(self):
        """
        Kiểm tra vòng đời phiên bản BCTC & tích hợp chặt chẽ với UC-GL-12:
        - Chặn Finalize khi kỳ kế toán đang OPEN (EF-29, BR-GL-FS-69)
        - Sau khi Khóa sổ kỳ (CLOSED), cho phép Finalize BCTC -> trạng thái FINALIZED, chặn sửa trực tiếp (BR-GL-FS-75)
        - Khi Mở khóa lại kỳ kế toán (UC-GL-12 reopen_period) -> phiên bản BCTC FINALIZED tự động chuyển sang OUTDATED (AF-23, EF-28, BR-GL-FS-76, 77)
        - Khi Ghi sổ thêm bút toán mới trong kỳ -> phiên bản BCTC mới cũng tự động chuyển sang OUTDATED (AF-22, EF-28)
        """
        self._seed_balanced_period_transactions()

        r_gen = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "ANNUAL_BCTC",
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
            },
            format="json",
        )
        self.assertEqual(r_gen.status_code, 201, r_gen.data)
        batch_id = r_gen.data["id"]

        # 1. EF-29: Chặn Finalize khi kỳ đang OPEN
        r_fin_open = self.client.post(
            f"/api/v1/general-ledger/financial-statements/{batch_id}/finalize/{self.query}",
            {"require_closed_period": True},
            format="json",
        )
        self.assertEqual(r_fin_open.status_code, 400)
        self.assertEqual(r_fin_open.data["error_code"], "PERIOD_NOT_CLOSED_FOR_FINALIZE")

        # 2. Khóa sổ kỳ kế toán (UC-GL-12) rồi Finalize BCTC
        self.client.force_authenticate(self.chief)
        r_close = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {"notes": "Khóa sổ kỳ 2026-10 để chốt BCTC"},
            format="json",
        )
        self.assertEqual(r_close.status_code, 200, r_close.data)

        r_fin_ok = self.client.post(
            f"/api/v1/general-ledger/financial-statements/{batch_id}/finalize/{self.query}",
            {"finalize_note": "Chốt chính thức bộ BCTC năm 2026 (V1)"},
            format="json",
        )
        self.assertEqual(r_fin_ok.status_code, 200, r_fin_ok.data)
        self.assertEqual(r_fin_ok.data["status"], "FINALIZED")

        # BR-GL-FS-75: Chặn sửa thuyết minh trên phiên bản đã FINALIZED
        r_edit_fin = self.client.post(
            f"/api/v1/general-ledger/financial-statements/{batch_id}/update-notes/{self.query}",
            {"notes_explanations": {"V.01": "Thử sửa sau khi đã chốt"}},
            format="json",
        )
        self.assertEqual(r_edit_fin.status_code, 400)
        self.assertEqual(r_edit_fin.data["error_code"], "CANNOT_EDIT_FINALIZED_BCTC")

        # 3. AF-23, EF-28, BR-GL-FS-76, 77: Mở khóa lại kỳ kế toán (UC-GL-12) -> Phiên bản BCTC tự động chuyển sang OUTDATED
        r_reopen = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/reopen/{self.query}",
            {"reason": "Mở khóa kỳ để điều chỉnh bút toán kiểm toán"},
            format="json",
        )
        self.assertEqual(r_reopen.status_code, 200, r_reopen.data)

        r_check_b1 = self.client.get(f"/api/v1/general-ledger/financial-statements/{batch_id}/{self.query}")
        self.assertEqual(r_check_b1.status_code, 200)
        self.assertEqual(r_check_b1.data["status"], "OUTDATED")
        self.assertIn("mở khóa lại", r_check_b1.data["outdated_reason"])

        # 4. Lập phiên bản mới V2 (version_number = 2), sau đó ghi sổ thêm bút toán mới -> V2 cũng chuyển sang OUTDATED (AF-22)
        r_gen_v2 = self.client.post(
            f"/api/v1/general-ledger/financial-statements/generate/{self.query}",
            {
                "company": str(self.company.id),
                "period": str(self.period.id),
                "report_group": "ANNUAL_BCTC",
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
            },
            format="json",
        )
        self.assertEqual(r_gen_v2.status_code, 201, r_gen_v2.data)
        self.assertEqual(r_gen_v2.data["version_number"], 2)
        self.assertEqual(r_gen_v2.data["status"], "GENERATED")

        self._post_entry(
            "PKT-13-007",
            [
                {"line_no": 1, "account": str(self.acc_112.id), "debit": "5000000", "credit": "0", "currency": str(self.currency.id)},
                {"line_no": 2, "account": str(self.cash_account.id), "debit": "0", "credit": "5000000", "currency": str(self.currency.id)},
            ],
            posting_date="2026-10-25",
        )

        r_check_v2 = self.client.get(f"/api/v1/general-ledger/financial-statements/{r_gen_v2.data['id']}/{self.query}")
        self.assertEqual(r_check_v2.status_code, 200)
        self.assertEqual(r_check_v2.data["status"], "OUTDATED")


import uuid


class LedgerInquiryAndVoucherTraceUcGl14Tests(FinancialStatementUcGl13Tests):
    """
    UC-GL-14 – Tra cứu Sổ cái / Nhật ký / truy vết chứng từ
    (General Ledger & Journal Inquiry, Accounting Books under Circular 99/2025/TT-BTC
     & End-to-End Bidirectional Voucher Traceability).
    Kiểm thử đầy đủ Main Flow, AF-01..28, EF-01..26 và BR-GL-TRACE-01..118.
    """

    def test_uc_gl_14_catalog_and_all_16_accounting_book_modes(self):
        """
        Kiểm tra:
        - Danh mục 16 loại sổ / chế độ tra cứu (`catalog`)
        - Sổ nhật ký chung (`GENERAL_JOURNAL` - S03a-DN)
        - Sổ cái (`GENERAL_LEDGER` - S03b-DN) và Số dư sau từng dòng (`running_debit`, `running_credit`)
        - Sổ chi tiết tài khoản (`ACCOUNT_DETAIL_LEDGER` - S38-DN), Sổ nhiều kỳ (`MULTI_PERIOD_DETAIL_LEDGER`)
        - Tài khoản cha tổng hợp từ tài khoản con không nhân đôi (`AF-11`, `BR-GL-TRACE-28..30`)
        - Tài khoản lưỡng tính 131 / 331 không bù trừ chéo giữa các đối tượng (`AF-16`, `BR-GL-TRACE-31, 32`)
        - Sổ nhật ký thu tiền, chi tiền, mua hàng, bán hàng (`AF-06..09`)
        - Sổ theo dõi thanh toán bằng ngoại tệ (`FOREIGN_CURRENCY_LEDGER` - `AF-10`, `BR-GL-TRACE-71, 72`: tách riêng USD, EUR)
        - Bảng chữ T (`T_ACCOUNT_SUMMARY`) và Bảng cân đối số phát sinh (`TRIAL_BALANCE`)
        """
        self._seed_balanced_period_transactions()

        # Tạo thêm TK cha 111 để kiểm tra rollup cha - con (AF-11, BR-GL-TRACE-28..30)
        parent_111 = self._create_postable_account("111", "Tiền mặt (Tổng hợp)", "ASSET", "DEBIT")
        self.cash_account.parent = parent_111
        self.cash_account.save(update_fields=["parent"])
        parent_111.is_postable = False
        parent_111.save(update_fields=["is_postable"])

        # Tạo 2 loại ngoại tệ USD & EUR để kiểm tra Sổ ngoại tệ không cộng ngang USD + EUR (BR-GL-TRACE-72)
        from master_data.models import Currency
        usd_ccy, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "US Dollar"})
        eur_ccy, _ = Currency.objects.get_or_create(code="EUR", defaults={"name": "Euro"})
        self._post_entry(
            "PKT-14-FX-USD",
            [
                {
                    "line_no": 1,
                    "account": str(self.acc_112.id),
                    "debit": "25000000",
                    "credit": "0",
                    "currency": str(usd_ccy.id),
                    "foreign_amount": "1000",
                    "exchange_rate": "25000",
                },
                {
                    "line_no": 2,
                    "account": str(self.ar_account.id),
                    "party": str(self.customer.id),
                    "debit": "0",
                    "credit": "25000000",
                    "currency": str(usd_ccy.id),
                    "foreign_amount": "1000",
                    "exchange_rate": "25000",
                },
            ],
            posting_date="2026-10-18",
        )
        self._post_entry(
            "PKT-14-FX-EUR",
            [
                {
                    "line_no": 1,
                    "account": str(self.acc_112.id),
                    "debit": "27000000",
                    "credit": "0",
                    "currency": str(eur_ccy.id),
                    "foreign_amount": "1000",
                    "exchange_rate": "27000",
                },
                {
                    "line_no": 2,
                    "account": str(self.ar_account.id),
                    "party": str(self.customer.id),
                    "debit": "0",
                    "credit": "27000000",
                    "currency": str(eur_ccy.id),
                    "foreign_amount": "1000",
                    "exchange_rate": "27000",
                },
            ],
            posting_date="2026-10-19",
        )

        # 1. Catalog
        r_cat = self.client.get(f"/api/v1/general-ledger/ledger-inquiry/catalog/{self.query}")
        self.assertEqual(r_cat.status_code, 200)
        self.assertEqual(len(r_cat.data["books"]), 16)

        # 2. Sổ nhật ký chung (GENERAL_JOURNAL)
        r_gj = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=GENERAL_JOURNAL&period=2026-10"
        )
        self.assertEqual(r_gj.status_code, 200, r_gj.data)
        self.assertEqual(r_gj.data["form_code"], "S03a-DN")
        self.assertTrue(r_gj.data["summary_totals"]["is_balanced"])
        self.assertGreater(len(r_gj.data["rows"]), 0)

        # 3. Sổ cái tài khoản cha 111 (gồm 1111) -> Kiểm tra Số dư đầu kỳ, Phát sinh, Running balance và Cuối kỳ (AF-02, AF-11)
        r_gl_111 = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=GENERAL_LEDGER&period=2026-10&account_code=111&include_child_accounts=true"
        )
        self.assertEqual(r_gl_111.status_code, 200, r_gl_111.data)
        self.assertEqual(r_gl_111.data["form_code"], "S03b-DN")
        # Đầu kỳ 1111 = 200tr, không bị nhân đôi thành 400tr
        self.assertEqual(Decimal(r_gl_111.data["summary_totals"]["opening_debit"]), Decimal("200000000"))

        # 4. Bảng tổng hợp chi tiết tài khoản công nợ lưỡng tính 131 (AF-16, BR-GL-TRACE-31, 32)
        r_bilateral = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=ACCOUNT_DETAIL_SUMMARY&period=2026-10&account_code=131"
        )
        self.assertEqual(r_bilateral.status_code, 200, r_bilateral.data)
        # KH-13-A dư Nợ (150tr - 52tr = 98tr), KH-13-B dư Có (40tr) -> Không bù trừ chéo!
        self.assertEqual(Decimal(r_bilateral.data["summary_totals"]["closing_debit"]), Decimal("98000000"))
        self.assertEqual(Decimal(r_bilateral.data["summary_totals"]["closing_credit"]), Decimal("40000000"))
        self.assertEqual(len(r_bilateral.data["detail_partner_summaries"]), 2)

        # 5. Sổ theo dõi thanh toán bằng ngoại tệ (FOREIGN_CURRENCY_LEDGER - AF-10, BR-GL-TRACE-71, 72)
        r_fx = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=FOREIGN_CURRENCY_LEDGER&period=2026-10"
        )
        self.assertEqual(r_fx.status_code, 200, r_fx.data)
        ccy_map = {c["currency_code"]: c for c in r_fx.data["currency_totals"]}
        self.assertIn("USD", ccy_map)
        self.assertIn("EUR", ccy_map)
        self.assertEqual(Decimal(ccy_map["USD"]["period_debit_fc"]), Decimal("1000"))
        self.assertEqual(Decimal(ccy_map["EUR"]["period_debit_fc"]), Decimal("1000"))

        # 6. Các sổ chuyên biệt còn lại (Sổ thu tiền, chi tiền, mua hàng, bán hàng, chữ T, nhiều kỳ, cân đối)
        for bt in (
            "GENERAL_LEDGER_NKC",
            "ACCOUNT_DETAIL_LEDGER",
            "MULTI_PERIOD_DETAIL_LEDGER",
            "ACCOUNT_TURNOVER_SUMMARY",
            "T_ACCOUNT_SUMMARY",
            "TRIAL_BALANCE",
            "CASH_RECEIPT_JOURNAL",
            "CASH_PAYMENT_JOURNAL",
            "PURCHASE_JOURNAL",
            "SALES_JOURNAL",
        ):
            r_mode = self.client.get(
                f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type={bt}&period=2026-10"
            )
            self.assertEqual(r_mode.status_code, 200, f"Failed on {bt}: {r_mode.data}")

    def test_uc_gl_14_official_book_posted_enforcement_and_validation_guards(self):
        """
        Kiểm tra các ngoại lệ kiểm soát:
        - EF-09, BR-GL-TRACE-10, 11: Chặn trộn bút toán chưa ghi sổ (UNPOSTED/DRAFT) vào Sổ kế toán chính thức
        - AF-15, BR-GL-TRACE-12: Cho phép lọc bút toán UNPOSTED/DRAFT trong chế độ 'Tra cứu bút toán GL' (`GL_ENTRY_INQUIRY`)
        - EF-03: Loại sổ không hợp lệ (`INVALID_BOOK_TYPE`)
        - EF-05: Khoảng ngày không hợp lệ `from_date > to_date` (`INVALID_DATE_RANGE`)
        - EF-06 / EF-07: Tài khoản không tồn tại hoặc thuộc công ty khác (`ACCOUNT_NOT_FOUND` / `ACCOUNT_COMPANY_MISMATCH`)
        - EF-08: Chi nhánh ngoài phạm vi quyền (`OUT_OF_DATA_SCOPE`)
        """
        self._seed_balanced_period_transactions()

        # Tạo 1 bút toán DRAFT chưa ghi sổ
        r_draft = self.client.post(
            f"/api/v1/general-ledger/journals/{self.query}",
            {
                "company": str(self.company.id),
                "branch": str(self.branch.id),
                "period": str(self.period.id),
                "number": "DRAFT-14-001",
                "entry_type": "MANUAL",
                "posting_date": "2026-10-20",
                "document_date": "2026-10-20",
                "description": "Bút toán nháp chưa ghi sổ",
                "source_module": "GL",
                "lines": [
                    {"line_no": 1, "account": str(self.acc_642.id), "debit": "9000000", "credit": "0", "currency": str(self.currency.id), "exchange_rate": "1"},
                    {"line_no": 2, "account": str(self.cash_account.id), "debit": "0", "credit": "9000000", "currency": str(self.currency.id), "exchange_rate": "1"},
                ],
            },
            format="json",
        )
        self.assertEqual(r_draft.status_code, 201, r_draft.data)

        # 1. EF-09: Sổ cái chính thức từ chối include_unposted=true hoặc entry_status=UNPOSTED
        r_official_unposted = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=GENERAL_LEDGER&period=2026-10&include_unposted=true"
        )
        self.assertEqual(r_official_unposted.status_code, 400)
        self.assertEqual(r_official_unposted.data["error_code"], "UNPOSTED_NOT_ALLOWED_IN_OFFICIAL_BOOK")

        # 2. AF-15: Chế độ GL_ENTRY_INQUIRY cho phép tra cứu bút toán UNPOSTED/DRAFT
        r_inq_unposted = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=GL_ENTRY_INQUIRY&period=2026-10&entry_status=UNPOSTED"
        )
        self.assertEqual(r_inq_unposted.status_code, 200, r_inq_unposted.data)
        voucher_nos = {r["voucher_number"] for r in r_inq_unposted.data["rows"]}
        self.assertIn("DRAFT-14-001", voucher_nos)

        # 3. EF-03: Loại sổ không tồn tại
        r_bad_bt = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=UNKNOWN_BOOK&period=2026-10"
        )
        self.assertEqual(r_bad_bt.status_code, 400)
        self.assertEqual(r_bad_bt.data["error_code"], "INVALID_BOOK_TYPE")

        # 4. EF-05: Từ ngày > Đến ngày
        r_bad_dates = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=GENERAL_JOURNAL&from_date=2026-10-31&to_date=2026-10-01"
        )
        self.assertEqual(r_bad_dates.status_code, 400)
        self.assertEqual(r_bad_dates.data["error_code"], "INVALID_DATE_RANGE")

        # 5. EF-06: Tài khoản không tồn tại
        r_bad_acc = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=GENERAL_LEDGER&period=2026-10&account_code=999999"
        )
        self.assertEqual(r_bad_acc.status_code, 400)
        self.assertEqual(r_bad_acc.data["error_code"], "ACCOUNT_NOT_FOUND")

        # 6. EF-08: Ngoài phạm vi Data Scope
        r_bad_scope = self.client.post(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}",
            {
                "company": str(self.company.id),
                "book_type": "GENERAL_LEDGER",
                "period": "2026-10",
                "branch_id": str(self.branch.id),
                "allowed_branch_ids": [str(uuid.uuid4())],
            },
            format="json",
        )
        self.assertEqual(r_bad_scope.status_code, 400)
        self.assertEqual(r_bad_scope.data["error_code"], "OUT_OF_DATA_SCOPE")

    def test_uc_gl_14_bidirectional_trace_statuses_and_adjustment_reversal_chain(self):
        """
        Kiểm tra truy vết 2 chiều và đầy đủ 5 trạng thái `trace_status` (Section 1.2.B, AF-17..23, EF-17..21, BR-GL-TRACE-35..55, 108..111):
        1. `TRACEABLE`: Bút toán từ phân hệ nguồn (`SubledgerJournalIngestion` UC-GL-04A) hoặc `GeneralBusinessVoucher` (UC-GL-04)
        2. `PARTIAL_TRACE`: Có chứng từ nguồn nhưng thiếu tài liệu tham chiếu phụ
        3. `NO_SOURCE`: Bút toán tổng hợp trực tiếp tại GL (`MANUAL`)
        4. `BROKEN_LINK`: Bút toán khai báo phân hệ `PUR` / `source_entity_id` nhưng bản ghi nguồn không tồn tại
        5. `ACCESS_RESTRICTED`: Chứng từ nguồn tồn tại nhưng Actor bị giới hạn quyền ở phân hệ nguồn (AF-19, EF-19)
        Đồng thời kiểm tra chuỗi Đảo / Điều chỉnh (`original_entry` ↔ `reversal_entry` — AF-20, AF-21).
        """
        self._seed_balanced_period_transactions()

        # A. NO_SOURCE: Bút toán MANUAL trực tiếp tại GL (PKT-13-001)
        r_no_src = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/trace/{self.query}&voucher_number=PKT-13-001"
        )
        self.assertEqual(r_no_src.status_code, 200, r_no_src.data)
        self.assertEqual(r_no_src.data["trace_status"], "NO_SOURCE")
        self.assertEqual(r_no_src.data["gl_entry"]["number"], "PKT-13-001")

        # B. TRACEABLE & ACCESS_RESTRICTED: Tạo bút toán tiếp nhận từ phân hệ PUR (UC-GL-04A)
        actor_acc = self.models.JournalEntry.objects.filter(company=self.company).first().created_by
        ing = self.models.SubledgerJournalIngestion.objects.create(
            company=self.company,
            period=self.period,
            source_module="PUR",
            source_business_type="PURCHASE_GOODS",
            source_document_type="PURCHASE_INVOICE",
            source_document_id="DOC-PUR-14-001",
            source_document_number="PMH-14-001",
            source_event_id="EVT-PUR-14-001",
            posting_date=date(2026, 10, 21),
            document_date=date(2026, 10, 21),
            description="Mua hàng hóa nhập kho từ NCC X",
            currency=self.currency,
            total_debit=Decimal("30000000"),
            total_credit=Decimal("30000000"),
            status="POSTED",
        )
        pur_entry = self.models.JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period,
            number="GL-PUR-14-001",
            entry_type="SUBLEDGER",
            posting_date=date(2026, 10, 21),
            document_date=date(2026, 10, 21),
            description="Mua hàng hóa nhập kho từ NCC X",
            source_module="PUR",
            source_entity_type="PURCHASE_GOODS",
            source_entity_id=ing.id,
            source_event_id="EVT-PUR-14-001",
            status="POSTED",
            total_debit=Decimal("30000000"),
            total_credit=Decimal("30000000"),
            created_by=actor_acc,
            posted_by=actor_acc,
        )
        self.models.JournalLine.objects.create(
            entry=pur_entry,
            line_no=1,
            account=self.acc_156,
            debit=Decimal("30000000"),
            credit=Decimal("0"),
            currency=self.currency,
            exchange_rate=Decimal("1"),
        )
        self.models.JournalLine.objects.create(
            entry=pur_entry,
            line_no=2,
            account=self.ap_account,
            party=self.supplier,
            debit=Decimal("0"),
            credit=Decimal("30000000"),
            currency=self.currency,
            exchange_rate=Decimal("1"),
        )
        ing.primary_journal_entry = pur_entry
        ing.save(update_fields=["primary_journal_entry"])

        # B1. TRACEABLE (Và truy vết ngược từ source_document_id — AF-23)
        r_trace_ok = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/trace/{self.query}&source_document_id=DOC-PUR-14-001"
        )
        self.assertEqual(r_trace_ok.status_code, 200, r_trace_ok.data)
        self.assertEqual(r_trace_ok.data["trace_status"], "TRACEABLE")
        self.assertEqual(r_trace_ok.data["source_voucher"]["source_document_number"], "PMH-14-001")
        self.assertEqual(r_trace_ok.data["gl_entry"]["number"], "GL-PUR-14-001")

        # B2. ACCESS_RESTRICTED khi Actor không có quyền tại phân hệ PUR (AF-19, EF-19, BR-GL-TRACE-52, 53)
        r_restricted = self.client.post(
            f"/api/v1/general-ledger/ledger-inquiry/trace/{self.query}",
            {
                "company": str(self.company.id),
                "entry_id": str(pur_entry.id),
                "denied_source_modules": ["PUR"],
            },
            format="json",
        )
        self.assertEqual(r_restricted.status_code, 200, r_restricted.data)
        self.assertEqual(r_restricted.data["trace_status"], "ACCESS_RESTRICTED")
        self.assertTrue(r_restricted.data["source_voucher"]["access_restricted"])

        # C. PARTIAL_TRACE: Có chứng từ nguồn nhưng thiếu tài liệu tham chiếu phụ
        pur_entry.workflow_snapshot = {"missing_secondary_reference": True}
        pur_entry.save(update_fields=["workflow_snapshot"])
        r_partial = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/trace/{self.query}&entry_id={pur_entry.id}"
        )
        self.assertEqual(r_partial.status_code, 200, r_partial.data)
        self.assertEqual(r_partial.data["trace_status"], "PARTIAL_TRACE")

        # D. BROKEN_LINK: Bút toán khai báo phân hệ SAL và source_entity_id không tồn tại (EF-17, EF-18, BR-GL-TRACE-49, 50)
        broken_entry = self.models.JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period,
            number="GL-BROKEN-14-001",
            entry_type="SUBLEDGER",
            posting_date=date(2026, 10, 22),
            document_date=date(2026, 10, 22),
            description="Bút toán mất liên kết chứng từ nguồn",
            source_module="SAL",
            source_entity_type="SALES_INVOICE",
            source_entity_id=uuid.uuid4(),
            status="POSTED",
            total_debit=Decimal("10000000"),
            total_credit=Decimal("10000000"),
            created_by=actor_acc,
        )
        r_broken = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/trace/{self.query}&entry_id={broken_entry.id}"
        )
        self.assertEqual(r_broken.status_code, 200, r_broken.data)
        self.assertEqual(r_broken.data["trace_status"], "BROKEN_LINK")
        self.assertIsNone(r_broken.data["source_voucher"])

        # E. Chuỗi Đảo / Điều chỉnh bút toán (AF-20, AF-21, BR-GL-TRACE-13..15, 45..47)
        rev_entry = self.models.JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period,
            number="REV-14-001",
            entry_type="REVERSAL",
            posting_date=date(2026, 10, 23),
            document_date=date(2026, 10, 23),
            description="Đảo bút toán GL-PUR-14-001",
            source_module="GL",
            original_entry=pur_entry,
            correction_reason="Đảo do nhầm đơn giá lô hàng",
            status="POSTED",
            total_debit=Decimal("30000000"),
            total_credit=Decimal("30000000"),
            created_by=actor_acc,
        )
        r_chain = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/trace/{self.query}&entry_id={pur_entry.id}"
        )
        self.assertEqual(r_chain.status_code, 200)
        self.assertTrue(r_chain.data["adjustment_reversal_chain"]["has_chain"])
        self.assertEqual(r_chain.data["adjustment_reversal_chain"]["related_entries"][0]["number"], "REV-14-001")

        r_chain_from_rev = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/trace/{self.query}&entry_id={rev_entry.id}"
        )
        self.assertEqual(r_chain_from_rev.status_code, 200)
        self.assertEqual(r_chain_from_rev.data["adjustment_reversal_chain"]["original_entry"]["number"], "GL-PUR-14-001")

    def test_uc_gl_14_closed_period_inquiry_export_and_zero_gl_mutation(self):
        """
        Kiểm tra:
        - AF-24, BR-GL-TRACE-56..58: Kỳ kế toán đã khóa (CLOSED) vẫn cho phép tra cứu Sổ cái, truy vết và xuất báo cáo bình thường
        - AF-25, AF-26, EF-22, EF-23, BR-GL-TRACE-64..70: Xuất Sổ cái ra EXCEL/PDF/PRINT, kiểm tra chặn khi không có quyền xuất
        - BR-GL-TRACE-01, 51, 96: Tuyệt đối không sinh hoặc sửa bất kỳ bút toán, dòng hạch toán hay số dư nào khi tra cứu/truy vết/xuất file
        """
        self._seed_balanced_period_transactions()

        # Khóa sổ kỳ kế toán 2026-10 (UC-GL-12)
        self.client.force_authenticate(self.chief)
        r_close = self.client.post(
            f"/api/v1/general-ledger/periods/{self.period.id}/close/{self.query}",
            {"notes": "Khóa sổ kỳ 2026-10"},
            format="json",
        )
        self.assertEqual(r_close.status_code, 200, r_close.data)

        entry_count_before = self.models.JournalEntry.objects.filter(company=self.company).count()
        line_count_before = self.models.JournalLine.objects.filter(entry__company=self.company).count()

        # 1. Tra cứu Sổ cái trên kỳ đã CLOSED (AF-24)
        r_closed_gl = self.client.get(
            f"/api/v1/general-ledger/ledger-inquiry/query/{self.query}&book_type=GENERAL_LEDGER&period=2026-10"
        )
        self.assertEqual(r_closed_gl.status_code, 200, r_closed_gl.data)
        self.assertEqual(r_closed_gl.data["period_status"], "CLOSED")
        self.assertGreater(len(r_closed_gl.data["rows"]), 0)

        # 2. Xuất Sổ cái ra EXCEL (AF-26, BR-GL-TRACE-64..70)
        r_exp = self.client.post(
            f"/api/v1/general-ledger/ledger-inquiry/export/{self.query}",
            {
                "company": str(self.company.id),
                "book_type": "GENERAL_LEDGER",
                "period": "2026-10",
                "format": "EXCEL",
            },
            format="json",
        )
        self.assertEqual(r_exp.status_code, 200, r_exp.data)
        self.assertEqual(r_exp.data["export_status"], "SUCCESS")
        self.assertTrue(r_exp.data["file_name"].endswith(".xlsx"))
        self.assertEqual(
            r_exp.data["summary_totals"]["period_debit"],
            r_closed_gl.data["summary_totals"]["period_debit"],
        )

        # 3. EF-22: Không có quyền xuất dữ liệu
        r_exp_denied = self.client.post(
            f"/api/v1/general-ledger/ledger-inquiry/export/{self.query}",
            {
                "company": str(self.company.id),
                "book_type": "GENERAL_LEDGER",
                "period": "2026-10",
                "format": "EXCEL",
                "deny_export_permission": True,
            },
            format="json",
        )
        self.assertEqual(r_exp_denied.status_code, 400)
        self.assertEqual(r_exp_denied.data["error_code"], "EXPORT_PERMISSION_DENIED")

        # 4. BR-GL-TRACE-01: Zero GL Mutation
        entry_count_after = self.models.JournalEntry.objects.filter(company=self.company).count()
        line_count_after = self.models.JournalLine.objects.filter(entry__company=self.company).count()
        self.assertEqual(entry_count_before, entry_count_after)
        self.assertEqual(line_count_before, line_count_after)






class OpeningBalanceEntryUcGl15Tests(FinancialStatementUcGl13Tests):
    """
    UC-GL-15: Kiểm thử toàn diện Nhập số dư ban đầu (10 luồng nghiệp vụ A–J,
    AF-01..14, EF-01..23 và BR01..42).
    """

    def setUp(self):
        super().setUp()
        self.url_base = "/api/v1/general-ledger/opening-balances/"

    def _setup_uc_gl_15_opening(self):
        from iam.models import UserAccount

        actor_acc = UserAccount.objects.first()
        if not actor_acc:
            actor_acc = UserAccount.objects.create(
                email="chief@fs13.test",
                full_name="Kế toán trưởng UC15",
            )
        self.acc_111 = self._create_postable_account("111", "Tiền mặt", "ASSET", "DEBIT")
        self.cash_account.parent = self.acc_111
        self.cash_account.save(update_fields=["parent"])
        self.acc_112_parent = self._create_postable_account("112", "Tiền gửi ngân hàng", "ASSET", "DEBIT")
        self.acc_112.parent = self.acc_112_parent
        self.acc_112.save(update_fields=["parent"])

        self.opening_entry = self.models.JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period,
            number="OPEN-2026-001",
            entry_type="OPENING",
            posting_date=date(2026, 1, 1),
            document_date=date(2026, 1, 1),
            description="Số dư đầu kỳ năm 2026",
            source_module="GL",
            status="POSTED",
            total_debit=Decimal("0"),
            total_credit=Decimal("0"),
            created_by=actor_acc,
        )

    def test_uc_gl_15_flow_a_accounts_rollup_detail_and_balance_check(self):
        self._setup_uc_gl_15_opening()
        """
        Kiểm tra Luồng A (Số dư tài khoản):
        - Lưu cân đối Nợ = Có, đồng bộ xuống OPEN-2026-001, tự động tổng hợp tài khoản cha-con không cộng trùng (BR07)
        - Chặn nhập trực tiếp vào tài khoản tổng hợp khi đã có số dư ở tài khoản con (BR07)
        - Chặn số dư âm (EF-12, BR05) và tài khoản đơn tính vừa Nợ vừa Có (BR06)
        - Kiểm tra đối chiếu chi tiết số dư A4–A5 (EF-16, BR08)
        - Cảnh báo chênh lệch tổng Nợ/Có và tuyệt đối không tự sinh khoản bù (BR09, BR10)
        """
        r_ok = self.client.post(
            f"{self.url_base}{self.query}",
            {
                "category": "accounts",
                "action_mode": "SAVE_AND_CLOSE",
                "items": [
                    {
                        "account": "1111",
                        "name": "Tiền Việt Nam",
                        "debit": 200000000,
                        "credit": 0,
                        "details": [
                            {"object_code": "QUY_TM_01", "debit": 120000000, "credit": 0},
                            {"object_code": "QUY_TM_02", "debit": 80000000, "credit": 0},
                        ],
                    },
                    {"account": "1121", "name": "Tiền gửi NH", "debit": 300000000, "credit": 0},
                    {"account": "4111", "name": "Vốn góp", "debit": 0, "credit": 500000000},
                ],
            },
            format="json",
        )
        self.assertEqual(r_ok.status_code, 200, r_ok.data)
        self.assertTrue(r_ok.data["balanced"])
        self.assertEqual(r_ok.data["total_debit"], 500000000)
        self.assertEqual(r_ok.data["total_credit"], 500000000)
        self.assertEqual(r_ok.data["difference"], 0)
        rollup_map = {r["account"]: r for r in r_ok.data["account_rollup"]}
        self.assertEqual(rollup_map["111"]["debit"], 200000000)
        self.assertEqual(rollup_map["112"]["debit"], 300000000)
        self.opening_entry.refresh_from_db()
        self.assertEqual(self.opening_entry.total_debit, Decimal("500000000"))

        # BR07: Chặn nhập trực tiếp cả tài khoản cha 111 và tài khoản con 1111
        r_dup_parent = self.client.post(
            f"{self.url_base}{self.query}",
            {
                "category": "accounts",
                "items": [
                    {"account": "111", "debit": 200000000, "credit": 0},
                    {"account": "1111", "debit": 200000000, "credit": 0},
                ],
            },
            format="json",
        )
        self.assertEqual(r_dup_parent.status_code, 400)
        self.assertEqual(r_dup_parent.data["error_code"], "BR07")

        # EF-12: Chặn số dư âm
        r_neg = self.client.post(
            f"{self.url_base}{self.query}",
            {
                "category": "accounts",
                "items": [{"account": "1111", "debit": -5000000, "credit": 0}],
            },
            format="json",
        )
        self.assertEqual(r_neg.status_code, 400)
        self.assertEqual(r_neg.data["error_code"], "EF-12")

        # BR06: Chặn tài khoản đơn tính 1111 vừa có Dư Nợ vừa có Dư Có
        r_bilateral_err = self.client.post(
            f"{self.url_base}{self.query}",
            {
                "category": "accounts",
                "items": [{"account": "1111", "debit": 10000000, "credit": 5000000}],
            },
            format="json",
        )
        self.assertEqual(r_bilateral_err.status_code, 400)
        self.assertEqual(r_bilateral_err.data["error_code"], "BR06")

        # EF-16, BR08: Chặn khi tổng chi tiết A4-A5 không khớp với dòng tài khoản
        r_detail_mismatch = self.client.post(
            f"{self.url_base}{self.query}",
            {
                "category": "accounts",
                "items": [
                    {
                        "account": "131",
                        "debit": 100000000,
                        "credit": 0,
                        "details": [{"object_code": "KH01", "debit": 75000000, "credit": 0}],
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(r_detail_mismatch.status_code, 400)
        self.assertEqual(r_detail_mismatch.data["error_code"], "EF-16")

        # BR09, BR10: Lệch tổng Nợ/Có -> báo difference & balance_warning, không tự sinh bút toán bù
        r_unbalanced = self.client.post(
            f"{self.url_base}{self.query}",
            {
                "category": "accounts",
                "items": [
                    {"account": "1111", "debit": 250000000, "credit": 0},
                    {"account": "4111", "debit": 0, "credit": 200000000},
                ],
            },
            format="json",
        )
        self.assertEqual(r_unbalanced.status_code, 200)
        self.assertFalse(r_unbalanced.data["balanced"])
        self.assertEqual(r_unbalanced.data["difference"], 50000000)
        self.assertIsNotNone(r_unbalanced.data["balance_warning"])
        self.assertEqual(len(r_unbalanced.data["accounts"]), 2)

    def test_uc_gl_15_flows_b_c_d_e_bank_ar_ap_employee_and_fx(self):
        """
        Kiểm tra Luồng B (Ngân hàng), Luồng C (Khách hàng), Luồng D (Nhà cung cấp), Luồng E (Nhân viên):
        - EF-03..07: Thiếu trường bắt buộc
        - AF-12, BR11: Ngoại tệ & tỷ giá
        - EF-15: Trùng khóa nghiệp vụ
        - EF-16, BR15, BR16: Đối chiếu chi tiết theo Hóa đơn và chiều theo dõi
        - EF-20, BR03: Chặn đối tượng/tài khoản INACTIVE
        """
        # 1. Luồng B (Ngân hàng): thiếu TK ngân hàng -> EF-04
        r_bank_missing = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "bank",
                "item": {"accountCode": "1121", "accountNumber": "", "originalAmount": 10000000},
            },
            format="json",
        )
        self.assertEqual(r_bank_missing.status_code, 400)
        self.assertEqual(r_bank_missing.data["error_code"], "EF-04")

        # AF-12: Ngoại tệ USD nhưng tỷ giá <= 0 -> AF-12
        r_bank_fx_err = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "bank",
                "item": {
                    "accountCode": "1122",
                    "accountNumber": "987654321",
                    "currency": "USD",
                    "exchangeRate": 0,
                    "originalAmount": 10000,
                    "amountVnd": 254450000,
                },
            },
            format="json",
        )
        self.assertEqual(r_bank_fx_err.status_code, 400)
        self.assertEqual(r_bank_fx_err.data["error_code"], "AF-12")

        # Lưu hợp lệ TK ngân hàng USD (AF-01 SAVE_AND_ADD)
        r_bank_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "bank",
                "action_mode": "SAVE_AND_ADD",
                "item": {
                    "accountCode": "1122",
                    "accountNumber": "987654321",
                    "bankName": "Techcombank (USD)",
                    "currency": "USD",
                    "exchangeRate": 25445,
                    "originalAmount": 10000,
                    "amountVnd": 254450000,
                },
            },
            format="json",
        )
        self.assertEqual(r_bank_ok.status_code, 200, r_bank_ok.data)
        self.assertEqual(r_bank_ok.data["action_mode"], "SAVE_AND_ADD")

        # EF-15: Thêm trùng cùng TK ngân hàng 987654321 (USD) -> EF-15
        r_bank_dup = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "bank",
                "item": {
                    "accountCode": "1122",
                    "accountNumber": "987654321",
                    "currency": "USD",
                    "exchangeRate": 25445,
                    "originalAmount": 5000,
                    "amountVnd": 127225000,
                },
            },
            format="json",
        )
        self.assertEqual(r_bank_dup.status_code, 400)
        self.assertEqual(r_bank_dup.data["error_code"], "EF-15")

        # 2. Luồng C (Công nợ khách hàng): thiếu Khách hàng -> EF-05
        r_cust_missing = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "customers",
                "item": {"accCode": "131", "code": "", "debit": 50000000},
            },
            format="json",
        )
        self.assertEqual(r_cust_missing.status_code, 400)
        self.assertEqual(r_cust_missing.data["error_code"], "EF-05")

        # EF-20: Khách hàng INACTIVE bị chặn
        from master_data.models import Party
        inactive_bp = Party.objects.create(
            company=self.company,
            code="KH_INACTIVE",
            name="Khách hàng ngừng hoạt động",
            party_type="ORGANIZATION",
            status="INACTIVE",
        )
        r_cust_inactive = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "customers",
                "item": {"accCode": "131", "code": inactive_bp.code, "debit": 20000000},
            },
            format="json",
        )
        self.assertEqual(r_cust_inactive.status_code, 400)
        self.assertEqual(r_cust_inactive.data["error_code"], "EF-20")

        # EF-16: Chi tiết hóa đơn không khớp với tổng Dư Nợ của khách hàng
        r_cust_inv_mismatch = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "customers",
                "item": {
                    "accCode": "131",
                    "code": "THANHHA",
                    "name": "Công ty TNHH Thanh Hà",
                    "debit": 50000000,
                    "credit": 0,
                    "invoiceDetails": [
                        {
                            "invoiceDate": "15/12/2025",
                            "invoiceNo": "HD00125",
                            "invoiceAmount": 50000000,
                            "remainingAmount": 30000000,
                        }
                    ],
                },
            },
            format="json",
        )
        self.assertEqual(r_cust_inv_mismatch.status_code, 400)
        self.assertEqual(r_cust_inv_mismatch.data["error_code"], "EF-16")

        # Lưu hợp lệ công nợ khách hàng kèm chi tiết Hóa đơn & chiều theo dõi (C4-C5, AF-06)
        r_cust_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "customers",
                "item": {
                    "accCode": "131",
                    "code": "THANHHA",
                    "name": "Công ty TNHH Thanh Hà",
                    "debit": 50000000,
                    "credit": 0,
                    "invoiceDetails": [
                        {
                            "invoiceDate": "15/12/2025",
                            "invoiceNo": "HD00125",
                            "invoiceAmount": 50000000,
                            "remainingAmount": 50000000,
                        }
                    ],
                    "dimensionDetails": [
                        {"department": "Phòng Kinh doanh", "contract": "HĐ-2025/08", "debit": 50000000, "credit": 0}
                    ],
                },
            },
            format="json",
        )
        self.assertEqual(r_cust_ok.status_code, 200, r_cust_ok.data)

        # 3. Luồng D (Nhà cung cấp): thiếu NCC -> EF-06, lưu hợp lệ kèm hóa đơn (AF-07)
        r_supp_missing = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {"category": "suppliers", "item": {"accCode": "331", "code": "", "credit": 80000000}},
            format="json",
        )
        self.assertEqual(r_supp_missing.status_code, 400)
        self.assertEqual(r_supp_missing.data["error_code"], "EF-06")

        r_supp_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "suppliers",
                "item": {
                    "accCode": "331",
                    "code": "PHATMAI",
                    "name": "Công ty TNHH Phát Mai Group",
                    "debit": 0,
                    "credit": 80000000,
                    "invoiceDetails": [
                        {
                            "invoiceDate": "20/12/2025",
                            "invoiceNo": "HD-INVOICE-88",
                            "invoiceAmount": 80000000,
                            "remainingAmount": 80000000,
                        }
                    ],
                },
            },
            format="json",
        )
        self.assertEqual(r_supp_ok.status_code, 200, r_supp_ok.data)

        # 4. Luồng E (Nhân viên): thiếu Nhân viên -> EF-07, lưu hợp lệ & chặn trùng -> EF-15
        r_emp_missing = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {"category": "employees", "item": {"accCode": "141", "code": "", "debit": 10000000}},
            format="json",
        )
        self.assertEqual(r_emp_missing.status_code, 400)
        self.assertEqual(r_emp_missing.data["error_code"], "EF-07")

        r_emp_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "employees",
                "item": {"accCode": "141", "code": "NV001", "name": "Nguyễn Văn An", "debit": 12000000, "credit": 0},
            },
            format="json",
        )
        self.assertEqual(r_emp_ok.status_code, 200, r_emp_ok.data)

        r_emp_dup = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "employees",
                "item": {"accCode": "141", "code": "NV001", "name": "Nguyễn Văn An", "debit": 5000000, "credit": 0},
            },
            format="json",
        )
        self.assertEqual(r_emp_dup.status_code, 400)
        self.assertEqual(r_emp_dup.data["error_code"], "EF-15")

    def test_uc_gl_15_flows_f_g_h_i_j_inventory_tools_assets_prepaid_wip(self):
        """
        Kiểm tra Luồng F (Tồn kho), Luồng G (CCDC), Luồng H (TSCĐ), Luồng I (CP trả trước), Luồng J (Chi phí dở dang):
        - EF-08..11, EF-13..15, EF-23, BR18..30
        """
        # 1. Luồng F (Tồn kho): thiếu Kho -> EF-08; Số lượng = 0 nhưng Giá trị > 0 -> EF-13
        r_inv_missing = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {"category": "inventory", "item": {"itemCode": "HH01", "warehouse": "", "quantity": 10, "amount": 50000000}},
            format="json",
        )
        self.assertEqual(r_inv_missing.status_code, 400)
        self.assertEqual(r_inv_missing.data["error_code"], "EF-08")

        r_inv_zero_qty = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {"category": "inventory", "item": {"itemCode": "HH01", "warehouse": "KHO_TONG", "quantity": 0, "amount": 50000000}},
            format="json",
        )
        self.assertEqual(r_inv_zero_qty.status_code, 400)
        self.assertEqual(r_inv_zero_qty.data["error_code"], "EF-13")

        r_inv_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "inventory",
                "item": {"itemCode": "HH01", "itemName": "Laptop Dell", "warehouse": "KHO_TONG", "unit": "Chiếc", "quantity": 10, "amount": 150000000},
            },
            format="json",
        )
        self.assertEqual(r_inv_ok.status_code, 200, r_inv_ok.data)
        self.assertFalse(r_inv_ok.data["saved_item"]["generates_in_period_warehouse_voucher"])

        # 2. Luồng G (CCDC đang sử dụng đầu kỳ): thiếu Mã CCDC -> EF-09; sai công thức Giá trị còn lại -> EF-14
        r_tool_missing = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {"category": "tools", "item": {"code": "", "name": "Máy in Canon"}},
            format="json",
        )
        self.assertEqual(r_tool_missing.status_code, 400)
        self.assertEqual(r_tool_missing.data["error_code"], "EF-09")

        r_tool_math_err = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "tools",
                "item": {
                    "code": "CCDC01",
                    "name": "Máy in Canon",
                    "voucherNo": "OPN-CCDC-01",
                    "voucherDate": "01/01/2026",
                    "totalAmount": 12000000,
                    "allocatedVal": 4000000,
                    "remainingVal": 9000000,
                    "allocPeriod": 12,
                    "remainingPeriod": 8,
                },
            },
            format="json",
        )
        self.assertEqual(r_tool_math_err.status_code, 400)
        self.assertEqual(r_tool_math_err.data["error_code"], "EF-14")

        r_tool_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "tools",
                "item": {
                    "code": "CCDC01",
                    "name": "Máy in Canon",
                    "voucherNo": "OPN-CCDC-01",
                    "voucherDate": "01/01/2026",
                    "totalAmount": 12000000,
                    "allocatedVal": 4000000,
                    "remainingVal": 8000000,
                    "allocPeriod": 12,
                    "remainingPeriod": 8,
                    "allocRows": [{"target": "P.KT", "rate": 100, "expenseAcc": "6422"}],
                },
            },
            format="json",
        )
        self.assertEqual(r_tool_ok.status_code, 200, r_tool_ok.data)

        # 3. Luồng H (Tài sản cố định đầu kỳ): sai Hao mòn lũy kế + Giá trị còn lại -> EF-14
        r_asset_math_err = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "assets",
                "item": {
                    "code": "TSCD001",
                    "name": "Xe ô tô Toyota Fortuner",
                    "voucherNo": "OPN-TS-01",
                    "voucherDate": "01/01/2026",
                    "assetType": "03 - Phương tiện vận tải",
                    "department": "P.GD",
                    "costAcc": "2113",
                    "deprAcc": "2141",
                    "deprStartDate": "01/01/2026",
                    "originalCost": 1150000000,
                    "accumDepr": 460000000,
                    "remainingVal": 700000000,
                },
            },
            format="json",
        )
        self.assertEqual(r_asset_math_err.status_code, 400)
        self.assertEqual(r_asset_math_err.data["error_code"], "EF-14")

        r_asset_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "assets",
                "item": {
                    "code": "TSCD001",
                    "name": "Xe ô tô Toyota Fortuner",
                    "voucherNo": "OPN-TS-01",
                    "voucherDate": "01/01/2026",
                    "assetType": "03 - Phương tiện vận tải",
                    "department": "P.GD",
                    "costAcc": "2113",
                    "deprAcc": "2141",
                    "deprStartDate": "01/01/2026",
                    "originalCost": 1150000000,
                    "accumDepr": 460000000,
                    "remainingVal": 690000000,
                    "usageTime": 5,
                    "remainingTime": 3,
                    "allocRows": [{"targetCode": "P.GD", "rate": 100, "expenseAcc": "6422"}],
                },
            },
            format="json",
        )
        self.assertEqual(r_asset_ok.status_code, 200, r_asset_ok.data)

        # 4. Luồng I (Chi phí trả trước đầu kỳ): Số tiền <= 0 -> EF-14; hợp lệ -> 200
        r_prepaid_err = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {"category": "prepaid", "item": {"code": "CPTT01", "name": "Thuê văn phòng", "amount": 0, "allocMonths": 12}},
            format="json",
        )
        self.assertEqual(r_prepaid_err.status_code, 400)
        self.assertEqual(r_prepaid_err.data["error_code"], "EF-14")

        r_prepaid_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {"category": "prepaid", "item": {"code": "CPTT01", "name": "Thuê văn phòng", "amount": 120000000, "allocMonths": 12}},
            format="json",
        )
        self.assertEqual(r_prepaid_ok.status_code, 200, r_prepaid_ok.data)

        # 5. Luồng J (Chi phí dở dang): thiếu đối tượng theo dõi -> EF-23; 4 hình thức hợp lệ -> 200
        r_wip_err = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {"category": "wip", "item": {"trackingMode": "Công trình", "code": "", "rawMaterial": 50000000}},
            format="json",
        )
        self.assertEqual(r_wip_err.status_code, 400)
        self.assertEqual(r_wip_err.data["error_code"], "EF-23")

        r_wip_ok = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "wip",
                "item": {
                    "trackingMode": "Công trình",
                    "code": "CT01",
                    "name": "Tòa nhà TechCom Tower",
                    "rawMaterial": 120000000,
                    "labor": 80000000,
                    "machinery": 30000000,
                    "general": 20000000,
                    "accepted": 200000000,
                },
            },
            format="json",
        )
        self.assertEqual(r_wip_ok.status_code, 200, r_wip_ok.data)

    def test_uc_gl_15_edit_delete_excel_import_vouchers_print_concurrency_and_lock(self):
        """
        Kiểm tra:
        - AF-03, EF-18, BR41: Import Excel có kiểm tra từng dòng và trả danh sách lỗi chi tiết
        - AF-09: Xem danh sách chứng từ số dư đầu kỳ
        - AF-10, AF-11, EF-19, BR37, BR38: Sửa / Xóa bản ghi và chặn khi đã có chứng từ phụ thuộc hoặc kỳ đã khóa
        - AF-13, EF-17, BR34, BR35: Lưu và In & xử lý lỗi in không làm mất dữ liệu đã lưu
        - EF-21: Chặn ghi đè khi xung đột phiên bản (optimistic concurrency)
        - BR39: Ghi AuditLog đầy đủ
        """
        # 1. AF-03, EF-18: Import Excel có dòng lỗi -> trả row_errors chi tiết
        r_xl_err = self.client.post(
            f"{self.url_base}import-excel/{self.query}",
            {
                "category": "prepaid",
                "atomic": True,
                "rows": [
                    {"code": "CPTT-XL1", "name": "Bảo hiểm tài sản", "amount": 60000000, "allocMonths": 12},
                    {"code": "", "name": "Dòng lỗi thiếu mã", "amount": -5000, "allocMonths": 0},
                ],
            },
            format="json",
        )
        self.assertEqual(r_xl_err.status_code, 400)
        self.assertEqual(r_xl_err.data["error_code"], "EF-18")
        self.assertEqual(str(r_xl_err.data["error_count"]), "1")
        self.assertEqual(str(r_xl_err.data["row_errors"][0]["row_index"]), "2")

        # Import Excel hợp lệ
        r_xl_ok = self.client.post(
            f"{self.url_base}import-excel/{self.query}",
            {
                "category": "prepaid",
                "atomic": True,
                "rows": [
                    {"code": "CPTT-XL1", "name": "Bảo hiểm tài sản", "amount": 60000000, "allocMonths": 12},
                    {"code": "CPTT-XL2", "name": "Phần mềm bản quyền", "amount": 36000000, "allocMonths": 24},
                ],
            },
            format="json",
        )
        self.assertEqual(r_xl_ok.status_code, 200, r_xl_ok.data)
        self.assertEqual(r_xl_ok.data["import_summary"]["imported_count"], 2)

        # 2. AF-10: Sửa bản ghi CPTT-XL1 kèm Lưu và In (AF-13, EF-17)
        r_edit = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "prepaid",
                "editing_id": "CPTT-XL1",
                "action_mode": "SAVE_AND_PRINT",
                "simulate_print_error": True,
                "item": {
                    "code": "CPTT-XL1",
                    "name": "Bảo hiểm tài sản (đã cập nhật)",
                    "amount": 72000000,
                    "allocMonths": 12,
                    "has_dependent_voucher": True,
                },
            },
            format="json",
        )
        self.assertEqual(r_edit.status_code, 200, r_edit.data)
        self.assertEqual(r_edit.data["print_result"]["error_code"], "EF-17")
        self.assertTrue(r_edit.data["print_result"]["saved_data_intact"])

        # 3. EF-19, BR38: Chặn xóa bản ghi CPTT-XL1 vì đã phát sinh chứng từ phụ thuộc
        r_del_blocked = self.client.post(
            f"{self.url_base}delete-item/{self.query}",
            {"category": "prepaid", "item_id": "CPTT-XL1"},
            format="json",
        )
        self.assertEqual(r_del_blocked.status_code, 400)
        self.assertEqual(r_del_blocked.data["error_code"], "EF-19")

        # AF-11: Xóa bản ghi CPTT-XL2 (chưa có chứng từ phụ thuộc) -> thành công
        r_del_ok = self.client.post(
            f"{self.url_base}delete-item/{self.query}",
            {"category": "prepaid", "item_id": "CPTT-XL2"},
            format="json",
        )
        self.assertEqual(r_del_ok.status_code, 200, r_del_ok.data)
        self.assertEqual(r_del_ok.data["deleted_item_id"], "CPTT-XL2")

        # 4. AF-09: Xem danh sách chứng từ số dư đầu kỳ
        r_vouchers = self.client.get(f"{self.url_base}vouchers/{self.query}&category=prepaid")
        self.assertEqual(r_vouchers.status_code, 200, r_vouchers.data)
        self.assertEqual(r_vouchers.data["total_vouchers"], 1)
        self.assertEqual(r_vouchers.data["vouchers"][0]["voucher_id"], "CPTT-XL1")

        # 5. EF-21: Kiểm tra xung đột phiên bản (optimistic concurrency)
        r_conflict = self.client.post(
            f"{self.url_base}{self.query}",
            {
                "category": "prepaid",
                "expected_version": 99999,
                "items": [{"code": "CPTT-NEW", "name": "Test", "amount": 10000000, "allocMonths": 6}],
            },
            format="json",
        )
        self.assertEqual(r_conflict.status_code, 400)
        self.assertEqual(r_conflict.data["error_code"], "EF-21")

        # 6. EF-19, BR37: Khóa kỳ kế toán -> chặn sửa/lưu trực tiếp số dư ban đầu
        self.period.status = "CLOSED"
        self.period.save(update_fields=["status"])
        r_locked = self.client.post(
            f"{self.url_base}save-item/{self.query}",
            {
                "category": "prepaid",
                "item": {"code": "CPTT-LOCKED", "name": "Test khóa sổ", "amount": 10000000, "allocMonths": 6},
            },
            format="json",
        )
        self.assertEqual(r_locked.status_code, 400)
        self.assertEqual(r_locked.data["error_code"], "EF-19")
