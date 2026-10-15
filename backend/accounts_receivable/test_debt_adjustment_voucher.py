from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from accounts_receivable.models import (
    DebtAdjustmentVoucher, DebtAdjustmentVoucherLine, DebtAdjustmentApproval,
    Receivable, ReceivableSchedule, ReceivableStatus, ReceivableAdjustment,
    Receipt, ReceiptAllocation,
)
from general_ledger.models import (
    Account, AccountNature, AccountStatus, AccountingPeriod,
    ChartOfAccounts, JournalEntry, NormalBalance,
)
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, DocumentType, Party, PartyRole
from organization.models import Company, Branch


class DebtAdjustmentVoucherTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()

        # Currencies
        self.currency_vnd = Currency.objects.get(code="VND")
        self.currency_usd, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "US Dollar", "numeric_code": "840", "decimal_places": 2}
        )

        # Company & Branch
        self.company = Company.objects.create(
            code="COMP-ADJ", name="Công ty Điều Chỉnh", legal_name="Công ty Điều Chỉnh Ltd",
            tax_code="0309998888", accounting_currency=self.currency_vnd,
            legal_reporting_currency=self.currency_vnd,
        )
        self.branch = Branch.objects.create(
            company=self.company, code="BR-ADJ", name="Chi nhánh Chính",
        )

        # Accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA-ADJ", name="Adjustment COA",
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
        self.account_811 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="811",
            name="Chi phí khác", account_type=AccountNature.EXPENSE,
            normal_balance=NormalBalance.DEBIT, status=AccountStatus.ACTIVE,
        )

        # Accounting Period
        self.period = AccountingPeriod.objects.create(
            company=self.company, code="2026-01", fiscal_year=2026, period_number=1,
            start_date=date(2026, 1, 1), end_date=date(2026, 1, 31), status="OPEN",
        )

        # Partner (Customer)
        self.customer = Party.objects.create(
            company=self.company, code="KH-ADJ-01", name="Khách hàng Alpha",
            tax_code="0301112223", default_currency=self.currency_vnd, status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)

        # Document Type
        DocumentType.objects.get_or_create(
            code="AR.ADJUSTMENT_VOUCHER",
            defaults={"module_code": "AR", "name": "Chứng từ điều chỉnh công nợ", "status": "ACTIVE"},
        )

        # Admin User with Full Permissions
        User = get_user_model()
        self.admin_user = User.objects.create_superuser(
            username="ar_admin_adj", email="admin_adj@example.com", password="password"
        )
        CompanyMembership.objects.create(
            company=self.company, user=self.admin_user.iam_account, created_by=self.admin_user.iam_account,
        )

        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/?company_id={self.company.id}"

        # Receivable with Schedules for testing decrease
        self.receivable = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-REC-001",
            customer=self.customer, currency=self.currency_vnd,
            account=self.account_131, exchange_rate=Decimal("1"),
            original_amount=Decimal("1000000"), balance=Decimal("1000000"),
            due_date=date(2026, 1, 25), status=ReceivableStatus.OPEN,
        )
        self.schedule1 = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.receivable, installment_no=1, amount=Decimal("600000"),
            balance=Decimal("600000"), due_date=date(2026, 1, 20), status=ReceivableStatus.OPEN,
        )
        self.schedule2 = ReceivableSchedule.objects.create(
            company=self.company, receivable=self.receivable, installment_no=2, amount=Decimal("400000"),
            balance=Decimal("400000"), due_date=date(2026, 1, 30), status=ReceivableStatus.OPEN,
        )

    def voucher_payload(self, **extra):
        data = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "document_date": "2026-01-15",
            "posting_date": "2026-01-15",
            "customer": str(self.customer.id),
            "adjustment_type": "INCREASE",
            "currency": str(self.currency_vnd.id),
            "receivable_account": str(self.account_131.id),
            "adjustment_reason": "Điều chỉnh tăng do phát sinh phí bổ sung",
            "document_basis": "Biên bản thỏa thuận số 01/2026",
            "description": "Tăng công nợ Khách hàng Alpha",
            "lines": [
                {
                    "offset_account": str(self.account_511.id),
                    "amount": "300000",
                    "exchange_rate": "1",
                    "new_due_date": "2026-02-15",
                    "description": "Phí dịch vụ phát sinh thêm",
                }
            ],
        }
        data.update(extra)
        return data

    def test_main_flow_increase_adjustment(self):
        """Main flow: Create INCREASE voucher -> Post -> GL Nợ 131 / Có 511, new Receivable created (BR01-BR10)."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        v_id = res.data["id"]
        self.assertEqual(res.data["status"], "DRAFT")
        self.assertEqual(Decimal(res.data["total_amount"]), Decimal("300000"))
        self.assertEqual(Decimal(res.data["total_converted_amount"]), Decimal("300000"))

        # In DRAFT: no GL entry and no new receivable yet (BR07)
        self.assertEqual(Receivable.objects.filter(source_document_id=v_id).count(), 0)

        # Post voucher
        post_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {}, format="json")
        self.assertEqual(post_res.status_code, 200, post_res.data)
        self.assertEqual(post_res.data["status"], "POSTED")

        # Verify new Receivable created (AF01, BR04)
        new_rec = Receivable.objects.filter(source_document_id=v_id).first()
        self.assertIsNotNone(new_rec)
        self.assertEqual(new_rec.balance, Decimal("300000"))
        self.assertEqual(new_rec.original_amount, Decimal("300000"))
        self.assertEqual(new_rec.due_date, date(2026, 2, 15))
        self.assertEqual(new_rec.status, ReceivableStatus.OPEN)

        # Verify GL Journal Entry (BR09)
        voucher = DebtAdjustmentVoucher.objects.get(pk=v_id)
        self.assertIsNotNone(voucher.journal_entry)
        gl = voucher.journal_entry
        self.assertEqual(gl.status, "POSTED")
        debit_line = gl.lines.get(account=self.account_131)
        credit_line = gl.lines.get(account=self.account_511)
        self.assertEqual(debit_line.debit, Decimal("300000"))
        self.assertEqual(credit_line.credit, Decimal("300000"))

    def test_main_flow_decrease_adjustment(self):
        """Main flow: Create DECREASE voucher -> Post -> GL Nợ 811 / Có 131, existing debt decreased (BR01-BR10)."""
        payload = self.voucher_payload(
            adjustment_type="DECREASE",
            adjustment_reason="Giảm công nợ do chiết khấu thương mại đặc biệt",
            description="Giảm công nợ Khách hàng Alpha",
            lines=[
                {
                    "receivable": str(self.receivable.id),
                    "receivable_schedule": str(self.schedule1.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "400000",
                    "description": "Chiết khấu thương mại",
                }
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        v_id = res.data["id"]

        # Post voucher
        post_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {}, format="json")
        self.assertEqual(post_res.status_code, 200, post_res.data)

        # Verify Receivable updated
        self.receivable.refresh_from_db()
        self.assertEqual(self.receivable.balance, Decimal("600000"))
        self.assertEqual(self.receivable.adjustment_amount, Decimal("400000"))
        self.assertEqual(self.receivable.status, ReceivableStatus.PARTIALLY_PAID)

        # Verify Schedule updated
        self.schedule1.refresh_from_db()
        self.assertEqual(self.schedule1.balance, Decimal("200000"))
        self.assertEqual(self.schedule1.status, ReceivableStatus.PARTIALLY_PAID)

        # Verify GL Journal Entry (BR09: Nợ 811 / Có 131)
        voucher = DebtAdjustmentVoucher.objects.get(pk=v_id)
        gl = voucher.journal_entry
        debit_line = gl.lines.get(account=self.account_811)
        credit_line = gl.lines.get(account=self.account_131)
        self.assertEqual(debit_line.debit, Decimal("400000"))
        self.assertEqual(credit_line.credit, Decimal("400000"))

        # Verify legacy adjustment record created
        line = voucher.lines.first()
        self.assertIsNotNone(line.legacy_adjustment)
        self.assertEqual(line.legacy_adjustment.amount, Decimal("-400000"))

    def test_af02_decrease_to_fully_paid(self):
        """AF02: Decreasing total remaining debt marks receivable as PAID."""
        payload = self.voucher_payload(
            adjustment_type="DECREASE",
            lines=[
                {
                    "receivable": str(self.receivable.id),
                    "receivable_schedule": str(self.schedule1.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "600000",
                },
                {
                    "receivable": str(self.receivable.id),
                    "receivable_schedule": str(self.schedule2.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "400000",
                },
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        v_id = res.data["id"]

        post_res = self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}", {})
        self.assertEqual(post_res.status_code, 200)

        self.receivable.refresh_from_db()
        self.assertEqual(self.receivable.balance, Decimal("0"))
        self.assertEqual(self.receivable.status, ReceivableStatus.PAID)

    def test_af04_eligible_receivables_endpoint(self):
        """AF04: Eligible receivables query endpoint for decrease pre-filling."""
        url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/eligible-receivables/?company_id={self.company.id}&customer_id={self.customer.id}"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["receivables"]), 1)
        rec = res.data["receivables"][0]
        self.assertEqual(rec["code"], "AR-REC-001")
        self.assertEqual(len(rec["schedules"]), 2)

    def test_approval_workflow_lifecycle(self):
        """Approval lifecycle: submit, recall, request revision, reject, approve."""
        # 1. Without approval_required: auto approves
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        sub_res = self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/submit/?company_id={self.company.id}", {})
        self.assertEqual(sub_res.status_code, 200)
        self.assertEqual(sub_res.data["status"], "APPROVED")

        # 2. With approval_required=True
        v = DebtAdjustmentVoucher.objects.get(pk=v_id)
        v.status = "DRAFT"
        v.approval_required = True
        v.save()

        # Submit
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/submit/?company_id={self.company.id}", {})
        v.refresh_from_db()
        self.assertEqual(v.status, "PENDING_APPROVAL")

        # Recall
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/recall/?company_id={self.company.id}", {"reason": "Thu hồi để kiểm tra"})
        v.refresh_from_db()
        self.assertEqual(v.status, "DRAFT")

        # Submit again
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/submit/?company_id={self.company.id}", {})

        # Request revision
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/request-revision/?company_id={self.company.id}", {"reason": "Cần bổ sung chứng từ"})
        v.refresh_from_db()
        self.assertEqual(v.status, "REVISION_REQUESTED")

        # Submit again
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/submit/?company_id={self.company.id}", {})

        # Approve
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/approve/?company_id={self.company.id}", {"reason": "Đồng ý phê duyệt"})
        v.refresh_from_db()
        self.assertEqual(v.status, "APPROVED")

    def test_af05_cancel_draft_with_reason(self):
        """AF05: Cancel draft voucher with reason."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]

        cancel_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/cancel/?company_id={self.company.id}"
        # Missing reason fails
        fail = self.client.post(cancel_url, {})
        self.assertEqual(fail.status_code, 400)

        # With reason succeeds
        ok = self.client.post(cancel_url, {"reason": "Hủy do thay đổi phương án"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data["status"], "CANCELLED")

    def test_af06_unpost_increase_adjustment(self):
        """AF06: Unpost increase adjustment removes created receivable and restores to DRAFT."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        # Unpost
        unpost_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/unpost/?company_id={self.company.id}"
        unpost_res = self.client.post(unpost_url, {"reason": "Bỏ ghi sổ để sửa số tiền"})
        self.assertEqual(unpost_res.status_code, 200)
        self.assertEqual(unpost_res.data["status"], "DRAFT")

        # Created receivable deleted
        self.assertEqual(Receivable.objects.filter(source_document_id=v_id).count(), 0)

        # GL entry reversed/removed
        voucher = DebtAdjustmentVoucher.objects.get(pk=v_id)
        self.assertIsNone(voucher.journal_entry)

    def test_af06_unpost_decrease_adjustment(self):
        """AF06: Unpost decrease adjustment restores receivable balances and marks legacy record reversed."""
        payload = self.voucher_payload(
            adjustment_type="DECREASE",
            lines=[
                {
                    "receivable": str(self.receivable.id),
                    "receivable_schedule": str(self.schedule1.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "300000",
                }
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        # Unpost
        unpost_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/unpost/?company_id={self.company.id}"
        unpost_res = self.client.post(unpost_url, {"reason": "Bỏ ghi sổ điều chỉnh giảm"})
        self.assertEqual(unpost_res.status_code, 200)
        self.assertEqual(unpost_res.data["status"], "DRAFT")

        # Balances restored
        self.receivable.refresh_from_db()
        self.schedule1.refresh_from_db()
        self.assertEqual(self.receivable.balance, Decimal("1000000"))
        self.assertEqual(self.receivable.adjustment_amount, Decimal("0"))
        self.assertEqual(self.schedule1.balance, Decimal("600000"))

        voucher = DebtAdjustmentVoucher.objects.get(pk=v_id)
        line = voucher.lines.first()
        self.assertEqual(line.legacy_adjustment.status, "REVERSED")

    def test_ef01_permission_checks(self):
        """EF01: Unauthorized user blocked with 403."""
        staff = get_user_model().objects.create_user(username="adj_staff", password="password")
        self.client.force_authenticate(staff)
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        self.assertEqual(res.status_code, 403)

    def test_ef02_missing_required_fields(self):
        """EF02: Missing adjustment_type, reason, or document_basis rejected with 400."""
        # Missing adjustment_type
        p1 = self.voucher_payload()
        del p1["adjustment_type"]
        self.assertEqual(self.client.post(self.url, p1, format="json").status_code, 400)

        # Missing adjustment_reason
        p2 = self.voucher_payload(adjustment_reason="")
        self.assertEqual(self.client.post(self.url, p2, format="json").status_code, 400)

        # Missing document_basis
        p3 = self.voucher_payload(document_basis="")
        self.assertEqual(self.client.post(self.url, p3, format="json").status_code, 400)

    def test_ef03_invalid_line_amount(self):
        """EF03: Amount <= 0 rejected with 400."""
        p = self.voucher_payload(lines=[
            {
                "offset_account": str(self.account_511.id),
                "amount": "0",
            }
        ])
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

    def test_ef04_decrease_missing_receivable(self):
        """EF04: Decrease adjustment missing receivable rejected (BR04, EF04)."""
        p = self.voucher_payload(
            adjustment_type="DECREASE",
            lines=[
                {
                    "offset_account": str(self.account_811.id),
                    "amount": "100000",
                }
            ],
        )
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

    def test_ef05_decrease_amount_exceeds_balance(self):
        """EF05: Decrease amount exceeding balance rejected with 400."""
        p = self.voucher_payload(
            adjustment_type="DECREASE",
            lines=[
                {
                    "receivable": str(self.receivable.id),
                    "receivable_schedule": str(self.schedule1.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "999999999",
                }
            ],
        )
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

    def test_ef06_offset_account_same_as_receivable_account(self):
        """EF06: Offset account identical to receivable account rejected (EF06)."""
        p = self.voucher_payload(
            lines=[
                {
                    "offset_account": str(self.account_131.id),
                    "amount": "100000",
                }
            ],
        )
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("trùng", str(res.data))

    def test_ef07_concurrency_balance_changed_at_post_time(self):
        """EF07: Balance changed by concurrent operation blocks posting."""
        payload = self.voucher_payload(
            adjustment_type="DECREASE",
            lines=[
                {
                    "receivable": str(self.receivable.id),
                    "receivable_schedule": str(self.schedule1.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "500000",
                }
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        v_id = res.data["id"]

        # Reduce balance externally
        self.schedule1.balance = Decimal("100000")
        self.schedule1.save(update_fields=("balance",))

        post_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {})
        self.assertEqual(post_res.status_code, 400)
        self.assertIn("không đủ", str(post_res.data))

    def test_ef08_closed_accounting_period_blocks_post(self):
        """EF08: Closed period blocks posting."""
        self.period.status = "CLOSED"
        self.period.save(update_fields=("status",))

        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]

        post_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {})
        self.assertEqual(post_res.status_code, 400)
        self.assertIn("Kỳ kế toán", str(post_res.data))

    def test_ef09_unpost_blocked_when_dependent_collection_exists(self):
        """EF09 / BR13: Unposting increase adjustment blocked if new receivable has collections."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        new_rec = Receivable.objects.filter(source_document_id=v_id).first()
        new_rec.collected_amount = Decimal("50000")
        new_rec.balance = Decimal("250000")
        new_rec.save(update_fields=("collected_amount", "balance"))

        unpost_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/unpost/?company_id={self.company.id}"
        unpost_res = self.client.post(unpost_url, {"reason": "Bỏ ghi sổ"})
        self.assertEqual(unpost_res.status_code, 400)
        self.assertIn("thu tiền", str(unpost_res.data))

    def test_idempotent_post_br14(self):
        """BR14: Repeated post requests are idempotent and do not create duplicate GL or receivables."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        post_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}"

        p1 = self.client.post(post_url, {})
        self.assertEqual(p1.status_code, 200)

        p2 = self.client.post(post_url, {})
        self.assertEqual(p2.status_code, 200)

        self.assertEqual(JournalEntry.objects.filter(source_entity_id=v_id).count(), 1)
        self.assertEqual(Receivable.objects.filter(source_document_id=v_id).count(), 1)

    def test_ef08_block_direct_edit_posted_voucher(self):
        """EF08: Modifying a posted voucher is blocked."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        patch_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/?company_id={self.company.id}"
        patch_res = self.client.patch(patch_url, {"description": "Sửa mô tả"}, format="json")
        self.assertEqual(patch_res.status_code, 400)

    def test_af03_multi_line_decrease_adjustment(self):
        """AF03: Multiple lines adjustment across multiple schedules of the same receivable."""
        payload = self.voucher_payload(
            adjustment_type="DECREASE",
            adjustment_reason="Giảm công nợ theo nhiều đợt",
            lines=[
                {
                    "receivable": str(self.receivable.id),
                    "receivable_schedule": str(self.schedule1.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "200000",
                    "description": "Giảm đợt 1",
                },
                {
                    "receivable": str(self.receivable.id),
                    "receivable_schedule": str(self.schedule2.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "150000",
                    "description": "Giảm đợt 2",
                },
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        v_id = res.data["id"]

        post_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {})
        self.assertEqual(post_res.status_code, 200)

        self.schedule1.refresh_from_db()
        self.schedule2.refresh_from_db()
        self.receivable.refresh_from_db()

        self.assertEqual(self.schedule1.balance, Decimal("400000"))
        self.assertEqual(self.schedule2.balance, Decimal("250000"))
        self.assertEqual(self.receivable.balance, Decimal("650000"))
        self.assertEqual(self.receivable.adjustment_amount, Decimal("350000"))

    def test_ef04_mismatch_customer_currency_or_account(self):
        """EF04: Selecting receivable from different customer, currency or account is blocked."""
        other_customer = Party.objects.create(
            company=self.company, code="KH-OTHER", name="Khách hàng khác",
            tax_code="0309999999", status="ACTIVE",
        )
        PartyRole.objects.create(party=other_customer, role_type="CUSTOMER", active_from=self.today)
        other_rec = Receivable.objects.create(
            company=self.company, branch=self.branch, code="AR-OTHER-001",
            customer=other_customer, currency=self.currency_vnd,
            account=self.account_131, exchange_rate=Decimal("1"),
            original_amount=Decimal("500000"), balance=Decimal("500000"),
            due_date=date(2026, 1, 25), status=ReceivableStatus.OPEN,
        )

        payload = self.voucher_payload(
            adjustment_type="DECREASE",
            lines=[
                {
                    "receivable": str(other_rec.id),
                    "offset_account": str(self.account_811.id),
                    "amount": "100000",
                }
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("không thuộc khách hàng", str(res.data))

    def test_ef09_unpost_blocked_when_dependent_netting_exists(self):
        """EF09 / BR13: Unposting increase adjustment blocked if new receivable has netting lines."""
        from accounts_receivable.models import DebtNettingVoucher, DebtNettingVoucherLine
        from accounts_payable.models import SupplierInvoice, Payable

        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        new_rec = Receivable.objects.filter(source_document_id=v_id).first()

        # Add active netting voucher referencing this new receivable
        PartyRole.objects.create(party=self.customer, role_type="VENDOR", active_from=self.today)
        account_331 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="331",
            name="Phải trả người bán", account_type=AccountNature.LIABILITY,
            normal_balance=NormalBalance.CREDIT, status=AccountStatus.ACTIVE,
        )
        invoice = SupplierInvoice.objects.create(
            company=self.company, branch=self.branch, supplier=self.customer,
            invoice_series="BB/26E", invoice_number="INV-NET-01", invoice_date=date(2026, 1, 10),
            currency=self.currency_vnd, exchange_rate=Decimal("1"), total_amount=Decimal("300000"),
            status="POSTED", created_by=self.admin_user.iam_account,
        )
        payable = Payable.objects.create(
            company=self.company, branch=self.branch, supplier=self.customer, invoice=invoice,
            currency=self.currency_vnd, exchange_rate=Decimal("1"), original_amount=Decimal("300000"),
            balance=Decimal("300000"), due_date=date(2026, 1, 30), status="OPEN",
        )
        netting_voucher = DebtNettingVoucher.objects.create(
            company=self.company, branch=self.branch, number="AR-NT-2026-9999",
            document_date=date(2026, 1, 16), posting_date=date(2026, 1, 16),
            customer=self.customer, supplier=self.customer, currency=self.currency_vnd,
            receivable_account=self.account_131, payable_account=account_331,
            total_amount=Decimal("100000"), status=DebtNettingVoucher.Status.POSTED,
            created_by=self.admin_user.iam_account,
        )
        DebtNettingVoucherLine.objects.create(
            voucher=netting_voucher, line_no=1, receivable=new_rec, payable=payable,
            amount=Decimal("100000"),
        )
        new_rec.netted_amount = Decimal("100000")
        new_rec.balance = Decimal("200000")
        new_rec.save(update_fields=("netted_amount", "balance"))

        unpost_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/unpost/?company_id={self.company.id}"
        unpost_res = self.client.post(unpost_url, {"reason": "Bỏ ghi sổ"})
        self.assertEqual(unpost_res.status_code, 400)
        self.assertIn("bù trừ", str(unpost_res.data))

    def test_foreign_currency_exchange_rate_and_conversion(self):
        """BR09, BR10, Sec 2.2: Foreign currency increase adjustment computes converted amount and GL correctly."""
        payload = self.voucher_payload(
            currency=str(self.currency_usd.id),
            lines=[
                {
                    "offset_account": str(self.account_511.id),
                    "amount": "1000",
                    "exchange_rate": "25000",
                    "new_due_date": "2026-02-28",
                    "description": "Doanh thu xuất khẩu dịch vụ",
                }
            ],
        )
        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        v_id = res.data["id"]
        self.assertEqual(Decimal(res.data["total_amount"]), Decimal("1000"))
        self.assertEqual(Decimal(res.data["total_converted_amount"]), Decimal("25000000"))

        post_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}"
        post_res = self.client.post(post_url, {})
        self.assertEqual(post_res.status_code, 200)

        new_rec = Receivable.objects.filter(source_document_id=v_id).first()
        self.assertIsNotNone(new_rec)
        self.assertEqual(new_rec.currency, self.currency_usd)
        self.assertEqual(new_rec.original_amount, Decimal("1000"))
        self.assertEqual(new_rec.exchange_rate, Decimal("25000"))

        voucher = DebtAdjustmentVoucher.objects.get(pk=v_id)
        gl = voucher.journal_entry
        debit_line = gl.lines.get(account=self.account_131)
        credit_line = gl.lines.get(account=self.account_511)
        self.assertEqual(debit_line.debit, Decimal("25000000"))
        self.assertEqual(credit_line.credit, Decimal("25000000"))

    def test_cannot_cancel_posted_voucher(self):
        """AF05: Cannot cancel a posted voucher."""
        res = self.client.post(self.url, self.voucher_payload(), format="json")
        v_id = res.data["id"]
        self.client.post(f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/post/?company_id={self.company.id}", {})

        cancel_url = f"/api/v1/accounts-receivable/debt-adjustment-vouchers/{v_id}/cancel/?company_id={self.company.id}"
        cancel_res = self.client.post(cancel_url, {"reason": "Thử hủy chứng từ đã ghi sổ"})
        self.assertEqual(cancel_res.status_code, 400)
        self.assertIn("Không thể hủy", str(cancel_res.data))
