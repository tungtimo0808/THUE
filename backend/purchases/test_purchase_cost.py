from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts_payable.models import Payable, SupplierInvoice
from common_services.models import FiscalPeriod, FiscalYear
from general_ledger.models import Account, AccountingPeriod, ChartOfAccounts, JournalEntry
from master_data.models import Currency, Item, Party, TaxRate, UnitOfMeasure, Warehouse
from organization.models import Branch, Company
from purchases import test_goods_purchase
from purchases.models import (
    CostAllocationStatus,
    CostType,
    DocumentStatus,
    GoodsPurchase,
    GoodsPurchaseLine,
    PurchaseCost,
    PurchaseCostLine,
    PurchaseOrder,
    PurchaseOrderLine,
)


class PurchaseCostTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.url = f"/api/v1/purchases/purchase-costs/?company_id={self.company.pk}"

        # Tax rate 10%
        self.tax_rate = TaxRate.objects.create(
            company=self.company,
            code="VAT10",
            name="10%",
            tax_type="VAT",
            rate_percent=Decimal("10.0000"),
            effective_from=self.day,
            status="ACTIVE",
        )

        # Cost account (e.g. 1562 - Landed cost awaiting allocation)
        chart = ChartOfAccounts.objects.filter(company=self.company).first()
        self.cost_acc = Account.objects.create(
            company=self.company,
            chart_of_accounts=chart,
            code="1562",
            name="Chi phí mua hàng",
            account_type="ASSET",
            status="ACTIVE",
        )
        # Direct cost account (e.g. 641 - Selling expense)
        self.direct_acc = Account.objects.create(
            company=self.company,
            chart_of_accounts=chart,
            code="641",
            name="Chi phí bán hàng",
            account_type="EXPENSE",
            status="ACTIVE",
        )
        # Input VAT account 1331 (created by the shared goods purchase fixture)
        self.vat_acc = self.vat_input
        # Cash account 1111
        self.cash_acc = Account.objects.create(
            company=self.company,
            chart_of_accounts=chart,
            code="1111",
            name="Tiền mặt VND",
            account_type="ASSET",
            status="ACTIVE",
        )
        # Bank account 1121
        self.bank_acc = Account.objects.create(
            company=self.company,
            chart_of_accounts=chart,
            code="1121",
            name="Tiền gửi ngân hàng VND",
            account_type="ASSET",
            status="ACTIVE",
        )

        # Approved Purchase Order
        self.po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            currency=self.company.accounting_currency,
            number="PO-COST-001",
            document_date=self.day,
            status=DocumentStatus.APPROVED,
            subtotal=Decimal("1000"),
            total_amount=Decimal("1000"),
            created_by=self.actor,
        )

        # Transport supplier (different from goods supplier per BR-PUR-CST-10)
        self.transport_supplier = Party.objects.create(
            company=self.company,
            code="TRANS-01",
            name="Cong Ty Van Tai 247",
            status="ACTIVE",
        )

    def payload(self, **overrides):
        line = {
            "line_no": 1,
            "cost_type": CostType.TRANSPORT,
            "description": "Cước vận chuyển hàng về kho",
            "pre_tax_amount": "500.0000",
            "tax_rate": str(self.tax_rate.pk),
            "tax_amount": "50.0000",
            "total_amount": "550.0000",
            "requires_allocation": True,
            "account": str(self.cost_acc.pk),
        }
        data = {
            "company": str(self.company.pk),
            "branch": str(self.branch.pk),
            "document_date": str(self.day),
            "posting_date": str(self.day),
            "supplier": str(self.transport_supplier.pk),
            "payment_type": "UNPAID",
            "payment_account": str(self.credit.pk),
            "notes": "Chi phí vận chuyển đơn PO-COST-001",
            "related_orders": [str(self.po.pk)],
            "lines": [line],
        }
        data.update(overrides)
        return data

    def test_create_cost_draft_success(self):
        """Steps 1-33, AF-08: Create purchase cost in DRAFT status."""
        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], "DRAFT")
        self.assertEqual(Decimal(res.data["subtotal"]), Decimal("500.0000"))
        self.assertEqual(Decimal(res.data["tax_amount"]), Decimal("50.0000"))
        self.assertEqual(Decimal(res.data["total_amount"]), Decimal("550.0000"))
        self.assertEqual(res.data["allocation_status"], "UNALLOCATED")
        self.assertEqual(len(res.data["lines"]), 1)

    def test_pre_tax_amount_must_be_positive_ef_06(self):
        """EF-06, BR-PUR-CST-13: Số tiền trước thuế phải lớn hơn 0."""
        p = self.payload()
        p["lines"][0]["pre_tax_amount"] = "0"
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Số tiền trước thuế phải lớn hơn 0.", str(res.data))

        p["lines"][0]["pre_tax_amount"] = "-100"
        res2 = self.client.post(self.url, p, format="json")
        self.assertEqual(res2.status_code, 400)
        self.assertIn("Số tiền trước thuế phải lớn hơn 0.", str(res2.data))

    def test_inactive_supplier_ef_03(self):
        """EF-03: Nhà cung cấp chi phí không còn hoạt động."""
        self.transport_supplier.status = "INACTIVE"
        self.transport_supplier.save()

        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Nhà cung cấp chi phí không còn hoạt động.", str(res.data))

    def test_inactive_account_ef_07(self):
        """EF-07, BR-PUR-CST-30: Tài khoản kế toán đã ngừng sử dụng."""
        self.cost_acc.status = "INACTIVE"
        self.cost_acc.save()

        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác.", str(res.data))

    def test_missing_related_purchase_br_07(self):
        """BR-PUR-CST-07: Chứng từ chi phí phải liên kết với ít nhất một đơn mua hoặc chứng từ mua hàng hóa."""
        p = self.payload()
        p["related_orders"] = []
        p["related_goods_purchases"] = []
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Chứng từ chi phí phải liên kết với ít nhất một đơn mua hoặc chứng từ mua hàng hóa.", str(res.data))

    def test_invalid_or_draft_related_purchase_ef_04(self):
        """EF-04, BR-PUR-CST-08: Chứng từ mua được chọn không còn đủ điều kiện liên kết (e.g. DRAFT or CANCELLED)."""
        draft_po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            currency=self.company.accounting_currency,
            number="PO-DRAFT-99",
            document_date=self.day,
            status=DocumentStatus.DRAFT,
            created_by=self.actor,
        )
        p = self.payload(related_orders=[str(draft_po.pk)])
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Chứng từ mua được chọn không còn đủ điều kiện liên kết.", str(res.data))

    def test_invoice_reused_ef_05(self):
        """EF-05, BR-PUR-CST-18: Hóa đơn đầu vào đã được sử dụng cho chứng từ khác."""
        inv = SupplierInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.transport_supplier,
            supplier_tax_code="0101010101",
            invoice_series="AA/26E",
            invoice_number="999001",
            invoice_date=self.day,
            currency=self.company.accounting_currency,
            subtotal=Decimal("500"),
            total_amount=Decimal("550"),
            validation_status="VALID",
            status="POSTED",
            created_by=self.actor,
        )

        # First cost uses invoice -> OK
        p1 = self.payload(supplier_invoice=str(inv.pk))
        res1 = self.client.post(self.url, p1, format="json")
        self.assertEqual(res1.status_code, 201)

        # Second cost tries to reuse same invoice -> EF-05 Error
        p2 = self.payload(supplier_invoice=str(inv.pk))
        res2 = self.client.post(self.url, p2, format="json")
        self.assertEqual(res2.status_code, 400)
        self.assertIn("Hóa đơn đầu vào đã được sử dụng cho chứng từ khác.", str(res2.data))

    def test_closed_accounting_period_ef_09(self):
        """EF-09, BR-PUR-CST-31: Ngày hạch toán thuộc kỳ kế toán đã khóa."""
        past_date = self.day - timedelta(days=90)
        p = self.payload(posting_date=str(past_date))
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ngày hạch toán thuộc kỳ kế toán đã khóa.", str(res.data))

    def test_submit_approve_and_post_unpaid_flow(self):
        """
        Complete flow:
        DRAFT -> SUBMIT -> PENDING_APPROVAL -> APPROVE -> POSTED.
        Verifies JournalEntry, Payable creation, allocation status.
        """
        # Create draft
        res = self.client.post(self.url, self.payload(), format="json")
        cost_id = res.data["id"]
        detail_url = f"/api/v1/purchases/purchase-costs/{cost_id}/?company_id={self.company.pk}"

        # Submit
        sub_res = self.client.post(detail_url.replace("/?", "/submit/?"), format="json")
        self.assertEqual(sub_res.status_code, 200)
        cost = PurchaseCost.objects.get(pk=cost_id)
        # If direct creator posting in snapshot -> APPROVED, else PENDING_APPROVAL
        if cost.status == DocumentStatus.PENDING_APPROVAL:
            # Approve
            app_res = self.client.post(detail_url.replace("/?", "/approve/?"), {"comment": "Approved"}, format="json")
            self.assertEqual(app_res.status_code, 200)
            cost.refresh_from_db()
            self.assertEqual(cost.status, DocumentStatus.APPROVED)

        # Post
        post_res = self.client.post(detail_url.replace("/?", "/post/?"), format="json")
        self.assertEqual(post_res.status_code, 200, post_res.data)
        self.assertEqual(post_res.data["detail"], "Ghi sổ chứng từ chi phí mua hàng thành công.")

        cost.refresh_from_db()
        self.assertEqual(cost.status, "POSTED")
        self.assertEqual(cost.allocation_status, CostAllocationStatus.UNALLOCATED)
        self.assertEqual(cost.lines.first().allocation_status, CostAllocationStatus.UNALLOCATED)

        # Journal Entry verified (BR-PUR-CST-34, Steps 50-52)
        self.assertIsNotNone(cost.journal_entry)
        journal = cost.journal_entry
        self.assertEqual(journal.status, "POSTED")
        self.assertEqual(journal.total_debit, Decimal("550.0000"))
        self.assertEqual(journal.total_credit, Decimal("550.0000"))

        # Payable verified for UNPAID (BR-PUR-CST-27)
        self.assertTrue(Payable.objects.filter(purchase_cost=cost, balance=Decimal("550.0000")).exists())

        # Cannot edit or delete directly when POSTED (BR-PUR-CST-05)
        del_res = self.client.delete(detail_url)
        self.assertEqual(del_res.status_code, 400)
        self.assertIn("Chứng từ Đã ghi sổ không được xóa trực tiếp.", str(del_res.data))

        edit_res = self.client.put(detail_url, self.payload(), format="json")
        self.assertEqual(edit_res.status_code, 400)
        self.assertIn("Chỉ chứng từ Nháp hoặc Bị từ chối mới được sửa nội dung nghiệp vụ.", str(edit_res.data))

    def test_direct_expense_not_requiring_allocation_af_04(self):
        """AF-04, BR-PUR-CST-20, 21: Chi phí không cần phân bổ -> NOT_REQUIRED."""
        p = self.payload()
        p["lines"][0]["requires_allocation"] = False
        p["lines"][0]["account"] = str(self.direct_acc.pk)

        res = self.client.post(self.url, p, format="json")
        cost_id = res.data["id"]
        detail_url = f"/api/v1/purchases/purchase-costs/{cost_id}/?company_id={self.company.pk}"

        # Submit and approve
        self.client.post(detail_url.replace("/?", "/submit/?"), format="json")
        cost = PurchaseCost.objects.get(pk=cost_id)
        if cost.status == DocumentStatus.PENDING_APPROVAL:
            self.client.post(detail_url.replace("/?", "/approve/?"), format="json")

        # Post
        self.client.post(detail_url.replace("/?", "/post/?"), format="json")
        cost.refresh_from_db()
        self.assertEqual(cost.status, "POSTED")
        self.assertEqual(cost.allocation_status, CostAllocationStatus.NOT_REQUIRED)
        self.assertEqual(cost.lines.first().allocation_status, CostAllocationStatus.NOT_REQUIRED)

    def test_reject_flow_and_revision_af_10_and_af_11(self):
        """
        AF-10, AF-11, BR-PUR-CST-37, 39:
        Reject requires reason -> REJECTED -> update increments version -> re-submit.
        """
        res = self.client.post(self.url, self.payload(), format="json")
        cost_id = res.data["id"]
        detail_url = f"/api/v1/purchases/purchase-costs/{cost_id}/?company_id={self.company.pk}"

        cost = PurchaseCost.objects.get(pk=cost_id)
        cost.status = DocumentStatus.PENDING_APPROVAL
        cost.save()

        # Reject without reason -> error BR-PUR-CST-37
        rej_no_reason = self.client.post(detail_url.replace("/?", "/reject/?"), {"reason": ""}, format="json")
        self.assertEqual(rej_no_reason.status_code, 400)
        self.assertIn("Vui lòng nhập lý do từ chối.", str(rej_no_reason.data))

        # Reject with reason -> REJECTED
        rej_res = self.client.post(detail_url.replace("/?", "/reject/?"), {"reason": "Đơn giá vận chuyển quá cao"}, format="json")
        self.assertEqual(rej_res.status_code, 200)
        cost.refresh_from_db()
        self.assertEqual(cost.status, DocumentStatus.REJECTED)
        self.assertEqual(cost.rejection_reason, "Đơn giá vận chuyển quá cao")

        # AF-11: User edits rejected document -> version increments
        updated_payload = self.payload()
        updated_payload["lines"][0]["pre_tax_amount"] = "400.0000"
        up_res = self.client.put(detail_url, updated_payload, format="json")
        self.assertEqual(up_res.status_code, 200)
        cost.refresh_from_db()
        self.assertEqual(cost.status, DocumentStatus.DRAFT)
        self.assertEqual(cost.version, 2)
        self.assertEqual(Decimal(cost.subtotal), Decimal("400.0000"))

    def test_cancellation_flow_af_12(self):
        """AF-12: Hủy chứng từ trước khi ghi sổ yêu cầu lý do."""
        res = self.client.post(self.url, self.payload(), format="json")
        cost_id = res.data["id"]
        detail_url = f"/api/v1/purchases/purchase-costs/{cost_id}/?company_id={self.company.pk}"

        # Cancel without reason -> error
        c_no_reason = self.client.post(detail_url.replace("/?", "/cancel/?"), {"reason": ""}, format="json")
        self.assertEqual(c_no_reason.status_code, 400)
        self.assertIn("Vui lòng nhập lý do hủy chứng từ.", str(c_no_reason.data))

        # Cancel with reason -> CANCELLED
        c_res = self.client.post(detail_url.replace("/?", "/cancel/?"), {"reason": "Hủy giao dịch vận chuyển"}, format="json")
        self.assertEqual(c_res.status_code, 200)
        cost = PurchaseCost.objects.get(pk=cost_id)
        self.assertEqual(cost.status, DocumentStatus.CANCELLED)
        self.assertEqual(cost.cancellation_reason, "Hủy giao dịch vận chuyển")

    def test_eligible_purchases_endpoint(self):
        """Steps 12-16: eligible_purchases returns valid POs and GPs."""
        url = f"/api/v1/purchases/purchase-costs/eligible-purchases/?company_id={self.company.pk}"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertTrue("orders" in res.data)
        self.assertTrue("goods_purchases" in res.data)
        order_numbers = [o["number"] for o in res.data["orders"]]
        self.assertIn("PO-COST-001", order_numbers)

    def test_iam_permissions_ef_01_and_ef_02(self):
        """EF-01, EF-02: Check permission enforcement."""
        unauth_client = APIClient()
        res_unauth = unauth_client.get(self.url)
        self.assertEqual(res_unauth.status_code, 401)

        normal_user = get_user_model().objects.create_user(username="viewer-cost", email="viewer-cost@example.test", password="password")
        normal_client = APIClient()
        normal_client.force_authenticate(normal_user)

        res_noperm = normal_client.get(self.url)
        self.assertEqual(res_noperm.status_code, 403)
        self.assertEqual(res_noperm.data["detail"], "Bạn không có quyền xem chứng từ chi phí mua hàng.")

        res_noperm_create = normal_client.post(self.url, self.payload(), format="json")
        self.assertEqual(res_noperm_create.status_code, 403)
        self.assertEqual(res_noperm_create.data["detail"], "Bạn không có quyền lập chứng từ chi phí mua hàng.")

    def test_cash_and_bank_payment_flows_af_06_af_07(self):
        """AF-06, AF-07, BR-PUR-CST-28, 29: Thanh toán tiền mặt và chuyển khoản."""
        # 1. CASH
        cash_data = self.payload(
            payment_type="CASH",
            payment_account=str(self.cash_acc.pk),
        )
        res_cash = self.client.post(self.url, cash_data, format="json")
        self.assertEqual(res_cash.status_code, 201)
        cash_id = res_cash.data["id"]
        detail_cash = f"/api/v1/purchases/purchase-costs/{cash_id}/?company_id={self.company.pk}"

        self.client.post(detail_cash.replace("/?", "/submit/?"), format="json")
        cost_cash = PurchaseCost.objects.get(pk=cash_id)
        if cost_cash.status == DocumentStatus.PENDING_APPROVAL:
            self.client.post(detail_cash.replace("/?", "/approve/?"), format="json")
        post_cash = self.client.post(detail_cash.replace("/?", "/post/?"), format="json")
        self.assertEqual(post_cash.status_code, 200)

        cost_cash.refresh_from_db()
        self.assertEqual(cost_cash.status, "POSTED")
        # No Payable created for CASH (BR-PUR-CST-27)
        self.assertFalse(Payable.objects.filter(purchase_cost=cost_cash).exists())
        # Cash account credited in journal
        self.assertTrue(cost_cash.journal_entry.lines.filter(account=self.cash_acc, credit=cost_cash.total_amount).exists())

        # 2. BANK
        bank_data = self.payload(
            payment_type="BANK",
            payment_account=str(self.bank_acc.pk),
        )
        res_bank = self.client.post(self.url, bank_data, format="json")
        self.assertEqual(res_bank.status_code, 201)
        bank_id = res_bank.data["id"]
        detail_bank = f"/api/v1/purchases/purchase-costs/{bank_id}/?company_id={self.company.pk}"

        self.client.post(detail_bank.replace("/?", "/submit/?"), format="json")
        cost_bank = PurchaseCost.objects.get(pk=bank_id)
        if cost_bank.status == DocumentStatus.PENDING_APPROVAL:
            self.client.post(detail_bank.replace("/?", "/approve/?"), format="json")
        post_bank = self.client.post(detail_bank.replace("/?", "/post/?"), format="json")
        self.assertEqual(post_bank.status_code, 200)

        cost_bank.refresh_from_db()
        self.assertEqual(cost_bank.status, "POSTED")
        self.assertFalse(Payable.objects.filter(purchase_cost=cost_bank).exists())
        self.assertTrue(cost_bank.journal_entry.lines.filter(account=self.bank_acc, credit=cost_bank.total_amount).exists())

    def test_multiple_related_purchases_af_01(self):
        """AF-01, BR-PUR-CST-09: Chi phí liên quan đến nhiều đơn mua và chứng từ mua."""
        po2 = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            currency=self.company.accounting_currency,
            number="PO-COST-002",
            document_date=self.day,
            status=DocumentStatus.APPROVED,
            subtotal=Decimal("2000"),
            total_amount=Decimal("2000"),
            created_by=self.actor,
        )
        gp = GoodsPurchase.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            number="GP-COST-001",
            document_date=self.day,
            posting_date=self.day,
            purchase_type="DIRECT",
            status="POSTED",
            subtotal=Decimal("3000"),
            total_amount=Decimal("3000"),
            created_by=self.actor,
        )

        p = self.payload(
            related_orders=[str(self.po.pk), str(po2.pk)],
            related_goods_purchases=[str(gp.pk)],
        )
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 201)
        cost = PurchaseCost.objects.get(pk=res.data["id"])
        self.assertEqual(cost.related_orders.count(), 2)
        self.assertEqual(cost.related_goods_purchases.count(), 1)

    def test_no_tax_cost_af_03(self):
        """AF-03: Chi phí không có thuế GTGT (thuế suất = 0, tiền thuế = 0)."""
        p = self.payload()
        p["lines"][0]["tax_rate"] = None
        p["lines"][0]["tax_amount"] = "0"
        p["lines"][0]["total_amount"] = "500.0000"

        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data["tax_amount"]), Decimal("0"))
        self.assertEqual(Decimal(res.data["total_amount"]), Decimal("500.0000"))

    def test_concurrency_or_already_processed_ef_12(self):
        """EF-12: Chứng từ đã được xử lý bởi người dùng khác."""
        res = self.client.post(self.url, self.payload(), format="json")
        cost_id = res.data["id"]
        detail_url = f"/api/v1/purchases/purchase-costs/{cost_id}/?company_id={self.company.pk}"

        cost = PurchaseCost.objects.get(pk=cost_id)
        cost.status = DocumentStatus.APPROVED
        cost.save()

        # Attempt to approve already approved document -> EF-12
        res_app = self.client.post(detail_url.replace("/?", "/approve/?"), format="json")
        self.assertEqual(res_app.status_code, 400)
        self.assertIn("Chứng từ đã được xử lý bởi người dùng khác.", str(res_app.data))

    def test_related_data_changed_after_approval_ef_14(self):
        """EF-14: Dữ liệu liên quan thay đổi sau khi phê duyệt."""
        res = self.client.post(self.url, self.payload(), format="json")
        cost_id = res.data["id"]
        detail_url = f"/api/v1/purchases/purchase-costs/{cost_id}/?company_id={self.company.pk}"

        cost = PurchaseCost.objects.get(pk=cost_id)
        cost.status = DocumentStatus.APPROVED
        cost.save()

        # Simulate related PO cancelled after approval
        self.po.status = DocumentStatus.CANCELLED
        self.po.save()

        # Attempt to post -> EF-14 error
        res_post = self.client.post(detail_url.replace("/?", "/post/?"), format="json")
        self.assertEqual(res_post.status_code, 400)
        self.assertIn("Dữ liệu liên quan đã thay đổi. Vui lòng kiểm tra và phê duyệt lại chứng từ.", str(res_post.data))
