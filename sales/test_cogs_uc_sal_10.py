from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from general_ledger.models import Account, AccountingPeriod, ChartOfAccounts, JournalEntry
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserAccount, UserRoleAssignment
from inventory.models import InventoryTransaction, InventoryTransactionLine, TransactionStatus, TransactionType
from master_data.models import Currency, Item, ItemCategory, UnitOfMeasure, Warehouse
from organization.models import Branch, Company
from sales import models


class CostOfGoodsSoldUcSal10Tests(TestCase):
    """
    Tập kiểm thử toàn diện cho Use Case UC-SAL-10: Ghi nhận giá vốn hàng bán.
    Bao quát Business Rules: BR-SAL-10-01 đến BR-SAL-10-13,
    Luồng hoạt động chính 1-9, Luồng thay thế AF-01..07, Luồng ngoại lệ EF-01..10.
    """

    def setUp(self):
        self.client = APIClient()
        self.unauth_client = APIClient()
        self.today = timezone.localdate()

        self.currency, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Việt Nam Đồng", "is_active": True}
        )

        # 1. Tổ chức & Doanh nghiệp
        self.company = Company.objects.create(
            code="CONGTY_COGS",
            name="Công Ty Giá Vốn Cổ Phần",
            tax_code="0109998888",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN_COGS",
            name="Chi Nhánh Giá Vốn",
        )
        self.warehouse = Warehouse.objects.create(
            company=self.company,
            branch=self.branch,
            code="KHO_COGS",
            name="Kho Hàng Hóa Giá Vốn",
            status="ACTIVE",
        )

        # 2. Người dùng & Quyền hạn
        auth_user = get_user_model().objects.create_user(username="cogs-specialist-usr", password="password")
        self.user_account = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.user_account, created_by=self.user_account
        )

        auth_unauth = get_user_model().objects.create_user(username="no-perm-usr", password="password")
        self.unauth_user = auth_unauth.iam_account
        self.unauth_membership = CompanyMembership.objects.create(
            company=self.company, user=self.unauth_user, created_by=self.unauth_user
        )

        self.role = Role.objects.create(
            company=self.company,
            code="ROLE_COGS_MANAGER",
            name="Quản lý Giá Vốn Bán Hàng",
            status="ACTIVE",
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership, role=self.role, assigned_by=self.user_account
        )
        self.guest_role = Role.objects.create(company=self.company, code="GUEST_ROLE", name="Khách")
        UserRoleAssignment.objects.create(
            company_membership=self.unauth_membership, role=self.guest_role, assigned_by=self.unauth_user
        )

        for code in ["VIEW", "CREATE", "EDIT", "DELETE", "POST", "CANCEL", "APPROVE"]:
            perm = Permission.objects.filter(code=f"SAL.COGS.{code}").first()
            if perm:
                RolePermission.objects.get_or_create(role=self.role, permission=perm, defaults={"effect": "ALLOW"})

        self.client.force_authenticate(user=auth_user)
        self.unauth_client.force_authenticate(user=auth_unauth)

        # 3. Hệ thống tài khoản & Kỳ kế toán
        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="COA_COGS",
            name="Hệ thống tài khoản COGS",
            effective_from=self.today,
        )
        self.acc_632 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            code="632",
            name="Giá vốn hàng bán",
            account_type="EXPENSE",
            is_postable=True,
            status="ACTIVE",
        )
        self.acc_156 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.chart,
            code="1561",
            name="Giá mua hàng hóa",
            account_type="ASSET",
            is_postable=True,
            status="ACTIVE",
        )
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="PERIOD_2026_10",
            fiscal_year=2026,
            period_number=10,
            start_date=self.today.replace(day=1),
            end_date=self.today.replace(day=28),
            status="OPEN",
        )

        # 4. Danh mục hàng hóa & ĐVT
        self.uom = UnitOfMeasure.objects.create(
            company=self.company,
            code="CAI",
            name="Cái",
            status="ACTIVE",
        )
        self.cat = ItemCategory.objects.create(
            company=self.company,
            code="CAT_GOODS",
            name="Nhóm hàng hóa",
            applicable_types=["GOODS"],
            status="ACTIVE",
        )
        self.item_a = Item.objects.create(
            company=self.company,
            code="SP_COGS_01",
            name="Sản Phẩm A Xuất Bán",
            item_type="GOODS",
            category=self.cat,
            base_uom=self.uom,
            track_inventory=True,
            cogs_account=self.acc_632,
            inventory_account=self.acc_156,
            status="ACTIVE",
        )
        self.item_b = Item.objects.create(
            company=self.company,
            code="SP_COGS_02",
            name="Sản Phẩm B Xuất Bán",
            item_type="GOODS",
            category=self.cat,
            base_uom=self.uom,
            track_inventory=True,
            cogs_account=self.acc_632,
            inventory_account=self.acc_156,
            status="ACTIVE",
        )

        self.cogs_list_url = f"/api/v1/sales/cogs/?company_id={self.company.pk}"
        self.eligible_lines_url = f"/api/v1/sales/cogs/eligible-lines/?company_id={self.company.pk}"

    def create_outward_transaction(self, number="PXK-2026-001", lines_info=None):
        """Helper tạo phiếu xuất kho nguồn và các dòng chi tiết."""
        trx = InventoryTransaction.objects.create(
            company=self.company,
            branch=self.branch,
            number=number,
            transaction_type=TransactionType.ISSUE,
            transaction_date=self.today,
            source_warehouse=self.warehouse,
            status=TransactionStatus.POSTED,
            created_by=self.user_account,
        )

        lines_info = lines_info or [
            {"item": self.item_a, "quantity": Decimal("10"), "unit_cost": Decimal("100000"), "line_value": Decimal("1000000")},
            {"item": self.item_b, "quantity": Decimal("5"), "unit_cost": Decimal("200000"), "line_value": Decimal("1000000")},
        ]

        lines = []
        for idx, l in enumerate(lines_info, start=1):
            line = InventoryTransactionLine.objects.create(
                transaction=trx,
                line_no=idx,
                item=l["item"],
                uom=self.uom,
                quantity=l["quantity"],
                unit_cost=l["unit_cost"],
                line_value=l["line_value"],
                movement_direction="OUT",
            )
            lines.append(line)

        return trx, lines

    # 1. Querying Eligible Outward Lines (BR-SAL-10-02, BR-SAL-10-03, EF-02..04)
    def test_01_eligible_outward_lines_query(self):
        """Kiểm tra truy vấn dòng xuất kho đủ điều kiện ghi nhận giá vốn."""
        trx, lines = self.create_outward_transaction(lines_info=[
            {"item": self.item_a, "quantity": Decimal("10"), "unit_cost": Decimal("100000"), "line_value": Decimal("1000000")},
            {"item": self.item_b, "quantity": Decimal("5"), "unit_cost": Decimal("0"), "line_value": Decimal("0")},  # Chưa tính giá (EF-02)
        ])

        # Phiếu điều chuyển (TRANSFER) không được chọn (EF-04)
        trx_transfer = InventoryTransaction.objects.create(
            company=self.company,
            number="PXK-TRANSFER-01",
            transaction_type=TransactionType.TRANSFER,
            transaction_date=self.today,
            source_warehouse=self.warehouse,
            destination_warehouse=self.warehouse,
            status=TransactionStatus.POSTED,
            created_by=self.user_account,
        )
        InventoryTransactionLine.objects.create(
            transaction=trx_transfer,
            line_no=1,
            item=self.item_a,
            uom=self.uom,
            quantity=Decimal("3"),
            unit_cost=Decimal("100000"),
            line_value=Decimal("300000"),
        )

        res = self.client.get(self.eligible_lines_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"]

        # Line 1 có giá > 0 -> is_eligible = True
        line1_res = next((r for r in results if r["line_id"] == str(lines[0].id)), None)
        self.assertIsNotNone(line1_res)
        self.assertTrue(line1_res["is_eligible"])
        self.assertEqual(line1_res["eligibility_status"], "ELIGIBLE")
        self.assertEqual(line1_res["cogs_account_code"], "632")
        self.assertEqual(line1_res["inventory_account_code"], "1561")

        # Line 2 đơn giá 0 -> is_eligible = False, WAITING_FOR_COSTING (EF-02)
        line2_res = next((r for r in results if r["line_id"] == str(lines[1].id)), None)
        self.assertIsNotNone(line2_res)
        self.assertFalse(line2_res["is_eligible"])
        self.assertEqual(line2_res["eligibility_status"], "WAITING_FOR_COSTING")

        # Line transfer không nằm trong danh sách
        transfer_res = [r for r in results if r["transaction_number"] == "PXK-TRANSFER-01"]
        self.assertEqual(len(transfer_res), 0)

    # 2. Create COGS Voucher Draft (Steps 2-6, BR-SAL-10-04, BR-SAL-10-05)
    def test_02_create_cogs_voucher_draft(self):
        """Tạo chứng từ giá vốn ở trạng thái Nháp, kiểm tra tính toán tổng giá vốn và sinh mã."""
        trx, lines = self.create_outward_transaction()

        payload = {
            "company": str(self.company.pk),
            "branch": str(self.branch.pk),
            "warehouse": str(self.warehouse.pk),
            "document_date": str(self.today),
            "posting_date": str(self.today),
            "costing_period": "2026-10",
            "description": "Ghi nhận giá vốn đợt 1",
            "lines": [
                {
                    "inventory_transaction_line": str(lines[0].id),
                    "cogs_account": str(self.acc_632.id),
                    "inventory_account": str(self.acc_156.id),
                },
                {
                    "inventory_transaction_line": str(lines[1].id),
                    "cogs_account": str(self.acc_632.id),
                    "inventory_account": str(self.acc_156.id),
                },
            ],
        }

        res = self.client.post("/api/v1/sales/cogs/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["number"].startswith("GV"))
        self.assertEqual(res.data["status"], "DRAFT")
        self.assertEqual(Decimal(res.data["total_cogs_amount"]), Decimal("2000000.0000"))
        self.assertEqual(len(res.data["lines"]), 2)
        self.assertEqual(res.data["lines"][0]["source_status"], "PROCESSING")

    # 3. Anti-duplication Locking (BR-SAL-10-05, EF-03)
    def test_03_anti_duplication_locking(self):
        """Không cho phép 1 dòng xuất kho nằm trong 2 chứng từ giá vốn đang xử lý hoặc đã ghi sổ (EF-03)."""
        trx, lines = self.create_outward_transaction()

        payload1 = {
            "company": str(self.company.pk),
            "branch": str(self.branch.pk),
            "warehouse": str(self.warehouse.pk),
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }
        res1 = self.client.post("/api/v1/sales/cogs/", payload1, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Cố gắng tạo voucher thứ 2 sử dụng cùng dòng 1 -> Chặn 400 (EF-03)
        payload2 = {
            "company": str(self.company.pk),
            "branch": str(self.branch.pk),
            "warehouse": str(self.warehouse.pk),
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }
        res2 = self.client.post("/api/v1/sales/cogs/", payload2, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đang được xử lý tại chứng từ", str(res2.data))

    # 4. Update COGS Voucher and Line Release (AF-04, BR-SAL-10-12, EF-08)
    def test_04_update_cogs_voucher_and_line_release(self):
        """Cập nhật chứng từ nháp, giải phóng dòng bỏ chọn về UNRECORDED (AF-04)."""
        trx, lines = self.create_outward_transaction()

        res_create = self.client.post("/api/v1/sales/cogs/", {
            "company": str(self.company.pk),
            "lines": [
                {"inventory_transaction_line": str(lines[0].id)},
                {"inventory_transaction_line": str(lines[1].id)},
            ],
        }, format="json")
        cogs_id = res_create.data["id"]

        # Cập nhật: chỉ giữ line 1, bỏ line 2
        res_update = self.client.put(f"/api/v1/sales/cogs/{cogs_id}/", {
            "company": str(self.company.pk),
            "version": 1,
            "description": "Cập nhật chỉ giữ dòng 1",
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }, format="json")
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(res_update.data["total_cogs_amount"]), Decimal("1000000.0000"))
        self.assertEqual(len(res_update.data["lines"]), 1)

        # Kiểm tra dòng 2 đã được giải phóng: gọi eligible-lines thì line 2 lại thành ELIGIBLE
        res_elig = self.client.get(self.eligible_lines_url)
        line2_res = next((r for r in res_elig.data["results"] if r["line_id"] == str(lines[1].id)), None)
        self.assertIsNotNone(line2_res)
        self.assertTrue(line2_res["is_eligible"])

        # Kiểm tra optimistic locking concurrency check (EF-08)
        res_conflict = self.client.put(f"/api/v1/sales/cogs/{cogs_id}/", {
            "company": str(self.company.pk),
            "version": 1,  # Version cũ
            "description": "Cập nhật version cũ",
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }, format="json")
        self.assertEqual(res_conflict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vừa được người khác cập nhật", str(res_conflict.data))

    # 5. Delete and Cancel Actions (AF-06, BR-SAL-10-12, EF-09)
    def test_05_delete_and_cancel_actions(self):
        """Xóa và hủy chứng từ, giải phóng toàn bộ dòng nguồn về UNRECORDED."""
        trx, lines = self.create_outward_transaction()

        # Tạo voucher 1 rồi xóa
        res1 = self.client.post("/api/v1/sales/cogs/", {
            "company": str(self.company.pk),
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }, format="json")
        cogs1_id = res1.data["id"]

        res_del = self.client.delete(f"/api/v1/sales/cogs/{cogs1_id}/")
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)

        # Dòng 0 lại tự do, tạo voucher 2 rồi hủy
        res2 = self.client.post("/api/v1/sales/cogs/", {
            "company": str(self.company.pk),
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }, format="json")
        cogs2_id = res2.data["id"]

        res_cancel = self.client.post(f"/api/v1/sales/cogs/{cogs2_id}/cancel/", {"reason": "Hủy để lập lại"}, format="json")
        self.assertEqual(res_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cancel.data["status"], "CANCELLED")

        # Sau khi hủy, dòng 0 lại thành ELIGIBLE
        res_elig = self.client.get(self.eligible_lines_url)
        line0_res = next((r for r in res_elig.data["results"] if r["line_id"] == str(lines[0].id)), None)
        self.assertTrue(line0_res["is_eligible"])

    # 6. Approval Workflow Actions (Step 7, AF-05, BR-SAL-10-06)
    def test_06_approval_workflow_lifecycle(self):
        """Kiểm tra toàn bộ chu trình phê duyệt: submit, withdraw, request-revision, reject, approve."""
        trx, lines = self.create_outward_transaction()

        res = self.client.post("/api/v1/sales/cogs/", {
            "company": str(self.company.pk),
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }, format="json")
        cogs_id = res.data["id"]

        # 6.1 Gửi duyệt -> PENDING_APPROVAL
        res_sub = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/submit/")
        self.assertEqual(res_sub.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sub.data["status"], "PENDING_APPROVAL")

        # Không cho sửa trực tiếp khi PENDING_APPROVAL (BR-SAL-10-12)
        res_edit_fail = self.client.put(f"/api/v1/sales/cogs/{cogs_id}/", {
            "company": str(self.company.pk),
            "version": 2,
            "description": "Sửa khi đang chờ duyệt",
        }, format="json")
        self.assertEqual(res_edit_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # 6.2 Thu hồi -> DRAFT
        res_with = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/withdraw/", {"comment": "Thu hồi sửa lại"}, format="json")
        self.assertEqual(res_with.status_code, status.HTTP_200_OK)
        self.assertEqual(res_with.data["status"], "DRAFT")

        # 6.3 Gửi duyệt lại rồi Yêu cầu chỉnh sửa
        self.client.post(f"/api/v1/sales/cogs/{cogs_id}/submit/")
        res_rev = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/request-revision/", {"comment": "Thiếu thông tin kho"}, format="json")
        self.assertEqual(res_rev.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rev.data["status"], "REVISION_REQUIRED")

        # 6.4 Từ chối duyệt
        self.client.post(f"/api/v1/sales/cogs/{cogs_id}/submit/")
        res_rej = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/reject/", {"comment": "Sai đối tượng"}, format="json")
        self.assertEqual(res_rej.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rej.data["status"], "REJECTED")

        # 6.5 Phê duyệt thành công -> APPROVED
        self.client.post(f"/api/v1/sales/cogs/{cogs_id}/submit/")
        res_app = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/approve/", {"comment": "Đồng ý"}, format="json")
        self.assertEqual(res_app.status_code, status.HTTP_200_OK)
        self.assertEqual(res_app.data["status"], "APPROVED")

    # 7. Post COGS Voucher with GL Journal Entry (Steps 8-9, BR-SAL-10-08..10, BR-SAL-10-13)
    def test_07_post_cogs_voucher_creates_journal_entry(self):
        """Ghi sổ chứng từ giá vốn: tạo bút toán Nợ 632 / Có 156, cập nhật nguồn RECORDED (BR-SAL-10-09)."""
        trx, lines = self.create_outward_transaction()

        res = self.client.post("/api/v1/sales/cogs/", {
            "company": str(self.company.pk),
            "lines": [
                {"inventory_transaction_line": str(lines[0].id)},
                {"inventory_transaction_line": str(lines[1].id)},
            ],
        }, format="json")
        cogs_id = res.data["id"]

        # Ghi sổ trực tiếp từ DRAFT (BR-SAL-10-06)
        res_post = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/post/")
        self.assertEqual(res_post.status_code, status.HTTP_200_OK)
        self.assertEqual(res_post.data["status"], "POSTED")
        self.assertIsNotNone(res_post.data["journal_entry"])
        self.assertEqual(res_post.data["lines"][0]["source_status"], "RECORDED")
        self.assertEqual(res_post.data["lines"][1]["source_status"], "RECORDED")

        # Kiểm tra JournalEntry trong database
        journal_id = res_post.data["journal_entry"]
        journal = JournalEntry.objects.get(pk=journal_id)
        self.assertEqual(journal.total_debit, Decimal("2000000.0000"))
        self.assertEqual(journal.total_credit, Decimal("2000000.0000"))
        self.assertEqual(journal.lines.count(), 4)  # 2 Nợ 632, 2 Có 156

        # Kiểm tra không cho phép sửa hoặc hủy sau khi đã ghi sổ (EF-09)
        res_cancel = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/cancel/", {"reason": "Hủy thử"}, format="json")
        self.assertEqual(res_cancel.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Không thể hủy trực tiếp chứng từ Đã ghi sổ", str(res_cancel.data))

    # 8. Closed Accounting Period Validation (BR-SAL-10-08, EF-06)
    def test_08_closed_accounting_period_validation(self):
        """Chặn ghi sổ nếu ngày hạch toán thuộc kỳ kế toán đã khóa (EF-06)."""
        trx, lines = self.create_outward_transaction()

        res = self.client.post("/api/v1/sales/cogs/", {
            "company": str(self.company.pk),
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }, format="json")
        cogs_id = res.data["id"]

        # Khóa kỳ kế toán
        self.period.status = "CLOSED"
        self.period.save()

        res_post = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/post/")
        self.assertEqual(res_post.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Kỳ kế toán chứa ngày hạch toán đã bị khóa", str(res_post.data))

    # 9. Costing Price Changed Before Posting (BR-SAL-10-07, EF-07)
    def test_09_costing_price_changed_before_posting(self):
        """Chặn ghi sổ nếu kết quả tính giá xuất kho đã thay đổi sau khi lập chứng từ (EF-07)."""
        trx, lines = self.create_outward_transaction()

        res = self.client.post("/api/v1/sales/cogs/", {
            "company": str(self.company.pk),
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }, format="json")
        cogs_id = res.data["id"]

        # Giả lập tính lại giá xuất kho: đơn giá tăng từ 100k lên 120k
        lines[0].unit_cost = Decimal("120000")
        lines[0].line_value = Decimal("1200000")
        lines[0].save()

        # Thử ghi sổ -> Chặn 400 (EF-07)
        res_post = self.client.post(f"/api/v1/sales/cogs/{cogs_id}/post/")
        self.assertEqual(res_post.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Kết quả tính giá xuất kho của mặt hàng SP_COGS_01 đã thay đổi", str(res_post.data))

    # 10. Check Difference After Posting (AF-07, BR-SAL-10-11)
    def test_10_check_difference_after_posting(self):
        """Sau khi ghi sổ, nếu giá xuất kho thay đổi, kiểm tra chênh lệch giá vốn (AF-07, BR-SAL-10-11)."""
        trx, lines = self.create_outward_transaction()

        res = self.client.post("/api/v1/sales/cogs/", {
            "company": str(self.company.pk),
            "lines": [{"inventory_transaction_line": str(lines[0].id)}],
        }, format="json")
        cogs_id = res.data["id"]

        # Ghi sổ thành công với giá 1tr
        self.client.post(f"/api/v1/sales/cogs/{cogs_id}/post/")

        # Thay đổi giá xuất kho sau khi ghi sổ (tính lại cuối tháng): giá trị mới 1.1tr
        lines[0].unit_cost = Decimal("110000")
        lines[0].line_value = Decimal("1100000")
        lines[0].save()

        # Kiểm tra chênh lệch
        res_diff = self.client.get(f"/api/v1/sales/cogs/{cogs_id}/check-difference/")
        self.assertEqual(res_diff.status_code, status.HTTP_200_OK)
        self.assertTrue(res_diff.data["has_difference"])
        self.assertEqual(Decimal(res_diff.data["total_difference"]), Decimal("100000.0000"))
        self.assertEqual(len(res_diff.data["differences"]), 1)
        self.assertEqual(Decimal(res_diff.data["differences"][0]["difference_amount"]), Decimal("100000.0000"))

    # 11. Security and Permissions (BR-SAL-10-01, EF-01)
    def test_11_security_and_permissions(self):
        """Kiểm tra quyền truy cập IAM và phân tách theo doanh nghiệp (EF-01)."""
        # User không có quyền -> 403 Forbidden
        res_unauth = self.unauth_client.get(self.cogs_list_url)
        self.assertEqual(res_unauth.status_code, status.HTTP_403_FORBIDDEN)

        # Thiếu company_id -> 403 Forbidden
        res_no_co = self.client.get("/api/v1/sales/cogs/")
        self.assertEqual(res_no_co.status_code, status.HTTP_403_FORBIDDEN)
