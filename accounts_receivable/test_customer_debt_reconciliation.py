from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from accounts_receivable.models import (
    CustomerDebtReconciliation, CustomerDebtReconciliationLine,
    Receivable, ReceivableSchedule, ReceivableStatus,
    Receipt, ReceiptStatus, ReceiptAllocation, DebtNettingVoucher, DebtNettingVoucherLine,
    DebtAdjustmentVoucher, DebtAdjustmentVoucherLine,
)
from general_ledger.models import (
    Account, AccountNature, AccountStatus, AccountingPeriod,
    ChartOfAccounts, NormalBalance,
)
from iam.models import CompanyMembership, Permission, Role, RolePermission
from master_data.models import Currency, DocumentType, Party, PartyRole
from organization.models import Company, Branch


class CustomerDebtReconciliationTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.first_of_month = self.today.replace(day=1)
        self.prior_date = self.first_of_month - timedelta(days=10)

        # Currencies
        self.currency_vnd = Currency.objects.get(code="VND")
        self.currency_usd, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "US Dollar", "numeric_code": "840", "decimal_places": 2}
        )

        # Company & Branch
        self.company = Company.objects.create(
            code="COMP-REC", name="Công ty Đối Chiếu", legal_name="Công ty Đối Chiếu Ltd",
            tax_code="0308889999", accounting_currency=self.currency_vnd,
            legal_reporting_currency=self.currency_vnd,
        )
        self.branch = Branch.objects.create(
            company=self.company, code="BR-REC", name="Chi nhánh Đối Chiếu",
        )

        # Accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA-REC", name="Reconciliation COA",
            effective_from=date(2026, 1, 1), is_default=True,
        )
        self.account_131 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="131",
            name="Phải thu của khách hàng", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )
        self.account_511 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="511",
            name="Doanh thu bán hàng", account_type=AccountNature.REVENUE,
            normal_balance=NormalBalance.CREDIT, status=AccountStatus.ACTIVE,
        )
        self.account_112 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="112",
            name="Tiền gửi ngân hàng", account_type=AccountNature.ASSET,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )

        # Accounting Period
        self.period = AccountingPeriod.objects.create(
            company=self.company, code="2026-REC", fiscal_year=2026, period_number=1,
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), status="OPEN",
        )

        # Customer
        self.customer = Party.objects.create(
            company=self.company, code="KH-REC-01", name="Khách hàng Beta",
            tax_code="0302223334", default_currency=self.currency_vnd, status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)

        # Document Type
        DocumentType.objects.get_or_create(
            code="AR.RECONCILIATION",
            defaults={"module_code": "AR", "name": "Biên bản đối chiếu công nợ", "status": "ACTIVE"},
        )

        # Admin User
        User = get_user_model()
        self.admin_user = User.objects.create_superuser(
            username="ar_admin_recon", email="admin_recon@example.com", password="password"
        )
        CompanyMembership.objects.create(
            company=self.company, user=self.admin_user.iam_account, created_by=self.admin_user.iam_account,
        )

        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/?company_id={self.company.id}"

        # 1. Prior Receivable (before first of month -> opening balance)
        self.prior_receivable = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-REC-PRIOR",
            customer=self.customer, currency=self.currency_vnd,
            account=self.account_131, exchange_rate=Decimal("1"),
            original_amount=Decimal("1000000"), balance=Decimal("1000000"),
            posting_date=self.prior_date, document_date=self.prior_date,
            due_date=self.prior_date + timedelta(days=30), status=ReceivableStatus.OPEN,
        )

        # 2. In-period Receivable (increase)
        self.in_period_date = self.first_of_month + timedelta(days=2)
        self.period_receivable = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-REC-PERIOD",
            customer=self.customer, currency=self.currency_vnd,
            account=self.account_131, exchange_rate=Decimal("1"),
            original_amount=Decimal("500000"), balance=Decimal("500000"),
            posting_date=self.in_period_date, document_date=self.in_period_date,
            due_date=self.in_period_date + timedelta(days=30), status=ReceivableStatus.OPEN,
        )

        # 3. In-period Collection & Allocation (decrease)
        self.receipt = Receipt.objects.create(
            company=self.company,
            branch=self.branch,
            customer=self.customer,
            currency=self.currency_vnd,
            amount=Decimal("400000"),
            allocated_amount=Decimal("300000"),
            receipt_date=self.in_period_date + timedelta(days=1),
            external_type="BANK",
            external_reference="REC-001",
            status=ReceiptStatus.CONFIRMED,
            created_by=self.admin_user.iam_account,
        )
        self.allocation = ReceiptAllocation.objects.create(
            receipt=self.receipt,
            receivable=self.prior_receivable,
            amount=Decimal("300000"),
            created_by=self.admin_user.iam_account,
            effective_date=self.in_period_date + timedelta(days=1),
        )
        self.prior_receivable.balance = Decimal("700000")
        self.prior_receivable.save(update_fields=("balance",))

    def reconciliation_payload(self, **extra):
        data = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "customer": str(self.customer.id),
            "currency": str(self.currency_vnd.id),
            "receivable_account": str(self.account_131.id),
            "statement_date": str(self.today),
            "from_date": str(self.first_of_month),
            "to_date": str(self.today),
            "contact_person": "Nguyễn Văn A",
            "contact_email": "nguyenvana@customer.com",
            "note": "Đối chiếu công nợ tháng",
        }
        data.update(extra)
        return data

    def test_01_extract_data_endpoint(self):
        """Bước 3 / BR03-BR05: extract-data endpoint computes opening balance, increases, decreases, unallocated."""
        extract_url = (
            f"/api/v1/accounts-receivable/customer-debt-reconciliations/extract-data/?"
            f"company_id={self.company.id}&customer_id={self.customer.id}&"
            f"currency_id={self.currency_vnd.id}&receivable_account_id={self.account_131.id}&"
            f"from_date={self.first_of_month}&to_date={self.today}&branch_id={self.branch.id}"
        )
        res = self.client.get(extract_url)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(Decimal(res.data["opening_balance"]), Decimal("1000000"))
        self.assertEqual(Decimal(res.data["period_increase"]), Decimal("500000"))
        self.assertEqual(Decimal(res.data["period_decrease"]), Decimal("300000"))
        self.assertEqual(Decimal(res.data["closing_balance"]), Decimal("1200000"))
        # Unallocated receipt: 400000 - 300000 = 100000 (BR04)
        self.assertEqual(Decimal(res.data["unallocated_receipts"]), Decimal("100000"))
        self.assertEqual(len(res.data["lines"]), 2)

    def test_02_create_draft_reconciliation_stores_snapshot_and_does_not_affect_gl_or_balances(self):
        """Bước 4 / BR06, BR11: Creating reconciliation saves snapshot without GL entries or balance updates."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        recon_id = res.data["id"]
        self.assertEqual(res.data["status"], "DRAFT")
        self.assertEqual(Decimal(res.data["opening_balance"]), Decimal("1000000"))
        self.assertEqual(Decimal(res.data["closing_balance"]), Decimal("1200000"))
        self.assertEqual(Decimal(res.data["unallocated_receipts"]), Decimal("100000"))

        recon = CustomerDebtReconciliation.objects.get(pk=recon_id)
        self.assertEqual(recon.lines.count(), 2)

        # Balances on receivables untouched (BR11)
        self.prior_receivable.refresh_from_db()
        self.assertEqual(self.prior_receivable.balance, Decimal("700000"))

    def test_03_record_sent_transitions_to_pending_response_and_locks_data(self):
        """Bước 6 / BR08, EF07: record-sent transitions to PENDING_RESPONSE and locks data against editing."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]

        sent_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/record-sent/?company_id={self.company.id}"
        # Missing channel fails
        fail = self.client.post(sent_url, {}, format="json")
        self.assertEqual(fail.status_code, 400)

        # Success with channel
        sent_res = self.client.post(sent_url, {
            "sent_channel": "EMAIL",
            "sent_note": "Đã gửi qua email kế toán trưởng",
        }, format="json")
        self.assertEqual(sent_res.status_code, 200)
        self.assertEqual(sent_res.data["status"], "PENDING_RESPONSE")
        self.assertEqual(sent_res.data["sent_channel"], "EMAIL")

        # Modifying after sent is blocked (EF07)
        patch_res = self.client.patch(
            f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/?company_id={self.company.id}",
            {"note": "Thử sửa sau khi gửi"}, format="json"
        )
        self.assertEqual(patch_res.status_code, 400)

    def test_04_record_response_matched_when_both_differences_are_zero(self):
        """Bước 7-8 / BR09: record-response matches when confirmed balance and unallocated match exactly."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]

        self.client.post(
            f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/record-sent/?company_id={self.company.id}",
            {"sent_channel": "EMAIL"}
        )

        resp_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/record-response/?company_id={self.company.id}"
        resp_data = {
            "response_date": str(self.today),
            "customer_confirmer_name": "Trần Thị B (Kế toán công nợ Beta)",
            "customer_confirmed_balance": "1200000",
            "customer_confirmed_unallocated": "100000",
            "response_comment": "Xác nhận khớp toàn bộ số liệu",
            "confirmation_documents": [{"name": "bien_ban_doi_chieu_ky_dong_dau.pdf", "url": "https://storage/doc1.pdf"}],
        }
        resp_res = self.client.post(resp_url, resp_data, format="json")
        self.assertEqual(resp_res.status_code, 200, resp_res.data)
        self.assertEqual(resp_res.data["status"], "MATCHED")
        self.assertEqual(Decimal(resp_res.data["balance_difference"]), Decimal("0"))
        self.assertEqual(Decimal(resp_res.data["unallocated_difference"]), Decimal("0"))

    def test_05_record_response_discrepancy_when_balance_or_unallocated_differs(self):
        """Bước 7-8 / BR10, EF06: Discrepancy detected and difference_reason required."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]
        self.client.post(
            f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/record-sent/?company_id={self.company.id}",
            {"sent_channel": "POST"}
        )

        resp_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/record-response/?company_id={self.company.id}"
        # Missing difference_reason when diff != 0 fails (EF06)
        fail_data = {
            "response_date": str(self.today),
            "customer_confirmer_name": "Trần Thị B",
            "customer_confirmed_balance": "1000000",  # differs from 1200000
            "customer_confirmed_unallocated": "100000",
            "confirmation_documents": [{"name": "file.pdf"}],
        }
        fail_res = self.client.post(resp_url, fail_data, format="json")
        self.assertEqual(fail_res.status_code, 400)
        self.assertIn("chênh lệch", str(fail_res.data))

        # With difference_reason succeeds and transitions to DISCREPANCY
        ok_data = dict(fail_data)
        ok_data["difference_reason"] = "Khách hàng chưa nhận được hóa đơn phát sinh ngày trong kỳ"
        ok_res = self.client.post(resp_url, ok_data, format="json")
        self.assertEqual(ok_res.status_code, 200)
        self.assertEqual(ok_res.data["status"], "DISCREPANCY")
        self.assertEqual(Decimal(ok_res.data["balance_difference"]), Decimal("-200000"))
        self.assertEqual(Decimal(ok_res.data["unallocated_difference"]), Decimal("0"))

    def test_06_af01_zero_activity_in_period_still_allows_reconciliation(self):
        """AF01: Zero in-period activity carries opening balance forward."""
        other_customer = Party.objects.create(
            company=self.company, code="KH-INACTIVE", name="Khách hàng Inactive",
            tax_code="0303334445", status="ACTIVE",
        )
        PartyRole.objects.create(party=other_customer, role_type="CUSTOMER", active_from=self.today)
        Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-INACTIVE-01",
            customer=other_customer, currency=self.currency_vnd,
            account=self.account_131, original_amount=Decimal("200000"), balance=Decimal("200000"),
            posting_date=self.prior_date, due_date=self.prior_date + timedelta(days=30),
            status=ReceivableStatus.OPEN,
        )

        payload = self.reconciliation_payload(customer=str(other_customer.id))
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data["opening_balance"]), Decimal("200000"))
        self.assertEqual(Decimal(res.data["period_increase"]), Decimal("0"))
        self.assertEqual(Decimal(res.data["period_decrease"]), Decimal("0"))
        self.assertEqual(Decimal(res.data["closing_balance"]), Decimal("200000"))
        self.assertEqual(len(res.data["lines"]), 0)

    def test_07_af02_refresh_data_in_draft_updates_snapshot(self):
        """AF02 / BR07: refresh-data updates DRAFT statement after new in-period transactions are posted."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]
        self.assertEqual(Decimal(res.data["period_increase"]), Decimal("500000"))

        # Add another receivable in-period
        Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-EXTRA-01",
            customer=self.customer, currency=self.currency_vnd,
            account=self.account_131, original_amount=Decimal("150000"), balance=Decimal("150000"),
            posting_date=self.in_period_date, due_date=self.in_period_date + timedelta(days=30),
            status=ReceivableStatus.OPEN,
        )

        refresh_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/refresh-data/?company_id={self.company.id}"
        ref_res = self.client.post(refresh_url, {})
        self.assertEqual(ref_res.status_code, 200)
        self.assertEqual(Decimal(ref_res.data["period_increase"]), Decimal("650000"))
        self.assertEqual(Decimal(ref_res.data["closing_balance"]), Decimal("1350000"))

    def test_08_af04_record_response_directly_from_draft(self):
        """AF04: Record customer response directly from DRAFT when customer confirmed on paper."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]

        resp_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/record-response/?company_id={self.company.id}"
        resp_res = self.client.post(resp_url, {
            "response_date": str(self.today),
            "customer_confirmer_name": "Giám đốc Beta",
            "customer_confirmed_balance": "1200000",
            "customer_confirmed_unallocated": "100000",
            "confirmation_documents": [{"name": "bien_ban_giay_scan.pdf"}],
        }, format="json")
        self.assertEqual(resp_res.status_code, 200)
        self.assertEqual(resp_res.data["status"], "MATCHED")

    def test_09_af06_re_reconcile_creates_new_statement_linking_predecessor(self):
        """AF06 / BR12: re-reconcile creates a new statement copying scope and referencing old statement."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]

        re_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/re-reconcile/?company_id={self.company.id}"
        re_res = self.client.post(re_url, {})
        self.assertEqual(re_res.status_code, 201)
        new_id = re_res.data["id"]
        self.assertNotEqual(new_id, recon_id)
        self.assertEqual(re_res.data["status"], "DRAFT")
        self.assertEqual(str(re_res.data["previous_reconciliation"]), str(recon_id))

    def test_10_af07_cancel_reconciliation_with_reason(self):
        """AF07 / BR14: Cancelling statement records cancel reason and user."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]

        cancel_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/cancel/?company_id={self.company.id}"
        # Missing reason fails
        fail = self.client.post(cancel_url, {})
        self.assertEqual(fail.status_code, 400)

        ok = self.client.post(cancel_url, {"reason": "Hủy biên bản do chọn sai kỳ đối chiếu"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data["status"], "CANCELLED")
        self.assertEqual(ok.data["cancel_reason"], "Hủy biên bản do chọn sai kỳ đối chiếu")

    def test_11_export_pdf_endpoint_returns_structured_payload(self):
        """Bước 5 / EF08: export-pdf endpoint returns full company, customer, balance, lines and confirmation data."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]

        pdf_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/export-pdf/?company_id={self.company.id}"
        pdf_res = self.client.get(pdf_url)
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res.data["company"]["name"], self.company.name)
        self.assertEqual(pdf_res.data["customer"]["name"], self.customer.name)
        self.assertEqual(pdf_res.data["closing_balance"], "1200000.0000")
        self.assertEqual(len(pdf_res.data["lines"]), 2)

    def test_12_ef01_permission_checks(self):
        """EF01: Unauthorized staff without permissions receives 403 Forbidden."""
        staff = get_user_model().objects.create_user(username="recon_staff", password="password")
        self.client.force_authenticate(staff)
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        self.assertEqual(res.status_code, 403)

    def test_13_ef02_invalid_date_range_or_missing_fields(self):
        """EF02: from_date > to_date or to_date in future rejected with 400."""
        # from_date > to_date
        p1 = self.reconciliation_payload(from_date=str(self.today), to_date=str(self.first_of_month))
        self.assertEqual(self.client.post(self.url, p1, format="json").status_code, 400)

        # to_date in the future
        future_date = self.today + timedelta(days=10)
        p2 = self.reconciliation_payload(to_date=str(future_date))
        self.assertEqual(self.client.post(self.url, p2, format="json").status_code, 400)

    def test_14_ef05_missing_response_required_fields(self):
        """EF05: Recording response without confirmer name or confirmation document fails."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]
        resp_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/record-response/?company_id={self.company.id}"

        # Missing confirmation_documents
        bad_data = {
            "response_date": str(self.today),
            "customer_confirmer_name": "Trần Thị B",
            "customer_confirmed_balance": "1200000",
        }
        self.assertEqual(self.client.post(resp_url, bad_data, format="json").status_code, 400)

    def test_15_br03_unposted_and_cancelled_documents_excluded_from_calculation(self):
        """BR03: Draft or cancelled receivables are excluded from balance calculation."""
        Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-CANCELLED",
            customer=self.customer, currency=self.currency_vnd,
            account=self.account_131, original_amount=Decimal("9999999"), balance=Decimal("9999999"),
            posting_date=self.in_period_date, due_date=self.in_period_date + timedelta(days=30),
            status=ReceivableStatus.REVERSED,
        )
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        self.assertEqual(res.status_code, 201)
        # Period increase still 500000, not affected by cancelled 9999999
        self.assertEqual(Decimal(res.data["period_increase"]), Decimal("500000"))

    def test_16_br04_unallocated_receipts_presented_separately_and_not_deducted_from_closing_balance(self):
        """BR04, BR10: Unallocated receipts are displayed separately and not subtracted from closing_balance."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        self.assertEqual(res.status_code, 201)
        # Closing balance: 1000000 + 500000 - 300000 = 1200000
        # If unallocated was subtracted, it would be 1100000. It must stay 1200000!
        self.assertEqual(Decimal(res.data["closing_balance"]), Decimal("1200000"))
        self.assertEqual(Decimal(res.data["unallocated_receipts"]), Decimal("100000"))

    def test_17_br05_multi_type_decreases_counted_accurately(self):
        """BR05: Decreases from netting vouchers and debt adjustments are accurately included in period decrease."""
        # Add a posted debt adjustment decrease in period
        adj_voucher = DebtAdjustmentVoucher.objects.create(
            company=self.company, branch=self.branch, number="AR-ADJ-2026-0001",
            document_date=self.in_period_date, posting_date=self.in_period_date,
            customer=self.customer, adjustment_type="DECREASE", currency=self.currency_vnd,
            receivable_account=self.account_131, adjustment_reason="Chiết khấu",
            document_basis="Thỏa thuận", total_amount=Decimal("50000"),
            status=DebtAdjustmentVoucher.Status.POSTED, created_by=self.admin_user.iam_account,
        )
        DebtAdjustmentVoucherLine.objects.create(
            voucher=adj_voucher, line_no=1, receivable=self.prior_receivable,
            offset_account=self.account_511, amount=Decimal("50000"),
        )

        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        self.assertEqual(res.status_code, 201)
        # Decrease: 300000 (allocation) + 50000 (adjustment) = 350000
        self.assertEqual(Decimal(res.data["period_decrease"]), Decimal("350000"))
        # Closing balance: 1000000 + 500000 - 350000 = 1150000
        self.assertEqual(Decimal(res.data["closing_balance"]), Decimal("1150000"))

    def test_18_cannot_cancel_already_cancelled_reconciliation(self):
        """AF07: Cancelling an already cancelled statement fails."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]
        cancel_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/cancel/?company_id={self.company.id}"

        self.client.post(cancel_url, {"reason": "Hủy lần 1"})
        res2 = self.client.post(cancel_url, {"reason": "Hủy lần 2"})
        self.assertEqual(res2.status_code, 400)

    def test_19_delete_draft_allowed_but_blocked_when_sent(self):
        """Deleting DRAFT reconciliation is allowed, but blocked once sent."""
        res = self.client.post(self.url, self.reconciliation_payload(), format="json")
        recon_id = res.data["id"]

        detail_url = f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/?company_id={self.company.id}"
        # Record sent
        self.client.post(
            f"/api/v1/accounts-receivable/customer-debt-reconciliations/{recon_id}/record-sent/?company_id={self.company.id}",
            {"sent_channel": "EMAIL"}
        )
        del_fail = self.client.delete(detail_url)
        self.assertEqual(del_fail.status_code, 400)
