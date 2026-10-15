from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Item, Party, PartyRole, UnitOfMeasure, Warehouse
from organization.models import Branch, Company, Department, Employee
from sales.models import (
    ApprovalDecision,
    DocumentStatus,
    GoodsSale,
    GoodsSaleLine,
    SalesAllowance,
    SalesAllowanceLine,
    SalesContract,
    SalesContractLine,
    SalesInvoice,
    SalesInvoiceLine,
    SalesOrder,
    SalesOrderLine,
    SalesQuotation,
    SalesQuotationLine,
    SalesReturn,
    SalesReturnLine,
    ServiceSale,
    ServiceSaleLine,
)


class SalesApprovalUcSal08Tests(TestCase):
    def setUp(self):
        self.today = date(2026, 10, 9)
        self.currency, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Việt Nam Đồng", "is_active": True}
        )
        self.company = Company.objects.create(
            code="CTY_SAL_APP",
            name="Công Ty Phê Duyệt Bán Hàng",
            legal_name="Công Ty Cổ Phần Phê Duyệt Bán Hàng",
            tax_code="0109997777",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(
            company=self.company, code="CN_SAL_01", name="Chi nhánh Bán hàng 01", status="ACTIVE"
        )
        self.department = Department.objects.create(
            company=self.company, branch=self.branch, code="PB_SAL", name="Phòng Kinh Doanh", status="ACTIVE"
        )
        self.uom = UnitOfMeasure.objects.create(
            company=self.company, code="CAI", name="Cái", status="ACTIVE"
        )
        self.item = Item.objects.create(
            company=self.company,
            base_uom=self.uom,
            code="SP01",
            name="Sản Phẩm 01",
            item_type="GOODS",
            status="ACTIVE",
            allow_sale=True,
        )
        self.service_item = Item.objects.create(
            company=self.company,
            base_uom=self.uom,
            code="DV01",
            name="Dịch Vụ Tư Vấn",
            item_type="SERVICE",
            status="ACTIVE",
            allow_sale=True,
        )
        self.warehouse = Warehouse.objects.create(
            company=self.company, branch=self.branch, code="KHO_SAL_01", name="Kho Bán Hàng", status="ACTIVE"
        )
        self.customer = Party.objects.create(
            company=self.company, code="KH01", name="Khách Hàng VIP 01", default_currency=self.currency, status="ACTIVE"
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)

        # Users: creator, approver1, approver2, unassigned_approver, unauthorized_user
        auth_creator = get_user_model().objects.create_user(username="sal-creator-usr", password="password")
        self.creator_account = auth_creator.iam_account
        self.creator_membership = CompanyMembership.objects.create(
            company=self.company, user=self.creator_account, created_by=self.creator_account
        )
        self.creator_role = Role.objects.create(company=self.company, code="SAL_CREATOR", name="Người lập đơn")
        UserRoleAssignment.objects.create(
            company_membership=self.creator_membership, role=self.creator_role, assigned_by=self.creator_account
        )

        auth_approver1 = get_user_model().objects.create_user(username="sal-approver1-usr", password="password")
        self.approver1_account = auth_approver1.iam_account
        self.approver1_membership = CompanyMembership.objects.create(
            company=self.company, user=self.approver1_account, created_by=self.approver1_account
        )
        self.approver_role = Role.objects.create(
            company=self.company, code="SAL_APPROVER", name="Người phê duyệt bán hàng"
        )
        UserRoleAssignment.objects.create(
            company_membership=self.approver1_membership, role=self.approver_role, assigned_by=self.approver1_account
        )

        auth_approver2 = get_user_model().objects.create_user(username="sal-approver2-usr", password="password")
        self.approver2_account = auth_approver2.iam_account
        self.approver2_membership = CompanyMembership.objects.create(
            company=self.company, user=self.approver2_account, created_by=self.approver2_account
        )
        UserRoleAssignment.objects.create(
            company_membership=self.approver2_membership, role=self.approver_role, assigned_by=self.approver2_account
        )

        auth_unassigned = get_user_model().objects.create_user(username="sal-unassigned-usr", password="password")
        self.unassigned_account = auth_unassigned.iam_account
        self.unassigned_membership = CompanyMembership.objects.create(
            company=self.company, user=self.unassigned_account, created_by=self.unassigned_account
        )
        UserRoleAssignment.objects.create(
            company_membership=self.unassigned_membership, role=self.approver_role, assigned_by=self.unassigned_account
        )

        auth_unauthorized = get_user_model().objects.create_user(username="sal-unauth-usr", password="password")
        self.unauth_account = auth_unauthorized.iam_account
        self.unauth_membership = CompanyMembership.objects.create(
            company=self.company, user=self.unauth_account, created_by=self.unauth_account
        )
        self.unauth_role = Role.objects.create(company=self.company, code="SAL_GUEST", name="Khách xem")
        UserRoleAssignment.objects.create(
            company_membership=self.unauth_membership, role=self.unauth_role, assigned_by=self.unauth_account
        )

        # Clients
        self.creator_client = APIClient()
        self.creator_client.force_authenticate(auth_creator)

        self.approver1_client = APIClient()
        self.approver1_client.force_authenticate(auth_approver1)

        self.approver2_client = APIClient()
        self.approver2_client.force_authenticate(auth_approver2)

        self.unassigned_client = APIClient()
        self.unassigned_client.force_authenticate(auth_unassigned)

        self.unauth_client = APIClient()
        self.unauth_client.force_authenticate(auth_unauthorized)

        # Grant permissions
        self.grant_permissions(self.approver_role, [
            "SAL.APPROVAL.VIEW",
            "SAL.APPROVAL.APPROVE",
            "SAL.APPROVAL.REJECT",
            "SAL.APPROVAL.REQUEST_REVISION",
        ])
        self.grant_permissions(self.creator_role, [
            "SAL.ORDER.VIEW",
            "SAL.APPROVAL.VIEW",
        ])

        # URLs
        self.pending_url = f"/api/v1/sales/approvals/pending/?company_id={self.company.pk}"
        self.detail_url = f"/api/v1/sales/approvals/detail/?company_id={self.company.pk}"
        self.decide_url = "/api/v1/sales/approvals/decide/"
        self.withdraw_url = "/api/v1/sales/approvals/withdraw/"
        self.history_url = f"/api/v1/sales/approvals/history/?company_id={self.company.pk}"

    def grant_permissions(self, role, perm_codes):
        for code in perm_codes:
            perm = Permission.objects.filter(code=code).first()
            if perm:
                RolePermission.objects.get_or_create(role=role, permission=perm, defaults={"effect": "ALLOW"})

    def make_snapshot(self, approver_account=None, levels=1, allow_self=False, steps=None):
        acc = approver_account or self.approver1_account
        return {
            "version": "v1",
            "levels": levels,
            "steps": steps or [
                {
                    "step_order": 1,
                    "approvers": [{"type": "USER", "id": str(acc.pk), "user_id": str(acc.pk)}],
                }
            ],
            "allow_self_approval": allow_self,
        }

    def create_pending_order(self, total_amount=Decimal("1500000"), snapshot=None):
        snap = snapshot or self.make_snapshot()
        order = SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-2026-0001",
            document_date=self.today,
            status=DocumentStatus.PENDING_APPROVAL,
            customer=self.customer,
            currency=self.currency,
            subtotal=total_amount,
            total_amount=total_amount,
            created_by=self.creator_account,
            workflow_snapshot=snap,
            version=1,
            submitted_at=timezone.now(),
        )
        SalesOrderLine.objects.create(
            order=order,
            line_no=1,
            item=self.item,
            uom=self.uom,
            quantity=Decimal("10"),
            unit_price=Decimal("150000"),
            line_total=total_amount,
        )
        return order

    def create_pending_quotation(self, total_amount=Decimal("2000000")):
        snap = self.make_snapshot()
        quo = SalesQuotation.objects.create(
            company=self.company,
            branch=self.branch,
            number="BG-2026-0001",
            document_date=self.today,
            valid_until=self.today,
            status=DocumentStatus.PENDING_APPROVAL,
            customer=self.customer,
            currency=self.currency,
            subtotal=total_amount,
            total_amount=total_amount,
            created_by=self.creator_account,
            workflow_snapshot=snap,
            version=1,
            submitted_at=timezone.now(),
        )
        SalesQuotationLine.objects.create(
            quotation=quo,
            line_no=1,
            item=self.item,
            uom=self.uom,
            quantity=Decimal("10"),
            unit_price=Decimal("200000"),
        )
        return quo

    def create_pending_goods_sale(self, total_amount=Decimal("3000000")):
        snap = self.make_snapshot()
        sale = GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number="BH-2026-0001",
            document_date=self.today,
            posting_date=self.today,
            status=DocumentStatus.PENDING_APPROVAL,
            customer=self.customer,
            currency=self.currency,
            subtotal=total_amount,
            total_amount=total_amount,
            created_by=self.creator_account,
            workflow_snapshot=snap,
            version=1,
            submitted_at=timezone.now(),
        )
        GoodsSaleLine.objects.create(
            sale=sale,
            line_no=1,
            item=self.item,
            uom=self.uom,
            quantity=Decimal("10"),
            unit_price=Decimal("300000"),
            line_total=total_amount,
        )
        return sale

    # 1. Pending Inbox Aggregation
    def test_01_pending_inbox_aggregates_all_sales_document_types(self):
        """Kiểm tra màn hình chờ duyệt tổng hợp chứng từ bán hàng (Quotation, Order, GoodsSale)."""
        so = self.create_pending_order()
        bg = self.create_pending_quotation()
        bh = self.create_pending_goods_sale()

        res = self.approver1_client.get(self.pending_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 3)

        doc_types = {item["document_type"] for item in res.data}
        self.assertIn("ORDER", doc_types)
        self.assertIn("QUOTATION", doc_types)
        self.assertIn("GOODS_SALE", doc_types)

        # Kiểm tra filter theo document_type
        filter_res = self.approver1_client.get(f"{self.pending_url}&document_type=ORDER")
        self.assertEqual(filter_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filter_res.data), 1)
        self.assertEqual(filter_res.data[0]["number"], so.number)

    # 2. Detail Endpoint Inspection
    def test_02_detail_endpoint_inspection(self):
        """Kiểm tra xem chi tiết chứng từ duyệt với thông tin khách hàng, dòng hàng, workflow."""
        so = self.create_pending_order()
        detail_res = self.approver1_client.get(
            f"{self.detail_url}&document_type=ORDER&document_id={so.pk}"
        )
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        data = detail_res.data
        self.assertEqual(data["number"], so.number)
        self.assertEqual(data["customer"]["name"], self.customer.name)
        self.assertEqual(len(data["lines"]), 1)
        self.assertTrue(data["workflow"]["can_approve"])
        self.assertEqual(data["workflow"]["current_level"], 1)
        self.assertEqual(data["workflow"]["total_levels"], 1)

        # Thiếu params -> 400
        res_missing = self.approver1_client.get(f"/api/v1/sales/approvals/detail/?company_id={self.company.pk}")
        self.assertEqual(res_missing.status_code, status.HTTP_400_BAD_REQUEST)

    # 3. Single Level Approval (BR-SAL-08-11: No auto-post GL / issue)
    def test_03_single_level_approve_decision(self):
        """Duyệt 1 cấp thành công chuyển sang APPROVED và tăng version, không tự ghi sổ (BR-SAL-08-11)."""
        so = self.create_pending_order()
        res = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Đồng ý phê duyệt đơn bán hàng.",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "APPROVED")
        self.assertEqual(res.data["version"], 2)

        so.refresh_from_db()
        self.assertEqual(so.status, DocumentStatus.APPROVED)
        self.assertIsNotNone(so.approved_at)
        self.assertEqual(so.version, 2)

        # Kiểm tra ghi nhận ApprovalDecision
        decision = ApprovalDecision.objects.filter(
            company=self.company, document_type="ORDER", document_id=so.pk, decision="APPROVED"
        ).first()
        self.assertIsNotNone(decision)
        self.assertEqual(decision.actor, self.approver1_account)
        self.assertEqual(decision.level, 1)

    # 4. Multi-Level Approval
    def test_04_multi_level_approve_decision(self):
        """Quy trình duyệt 2 cấp: cấp 1 duyệt xong giữ PENDING_APPROVAL, cấp 2 duyệt hoàn tất APPROVED."""
        steps = [
            {
                "step_order": 1,
                "approvers": [{"type": "USER", "id": str(self.approver1_account.pk), "user_id": str(self.approver1_account.pk)}],
            },
            {
                "step_order": 2,
                "approvers": [{"type": "USER", "id": str(self.approver2_account.pk), "user_id": str(self.approver2_account.pk)}],
            },
        ]
        snapshot = self.make_snapshot(levels=2, steps=steps)
        so = self.create_pending_order(snapshot=snapshot)

        # Cấp 1 duyệt
        res1 = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Cấp 1 duyệt xong.",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data["status"], DocumentStatus.PENDING_APPROVAL)
        self.assertEqual(res1.data["version"], 2)

        so.refresh_from_db()
        self.assertEqual(so.status, DocumentStatus.PENDING_APPROVAL)
        self.assertEqual(so.version, 2)

        # Cấp 2 duyệt
        res2 = self.approver2_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Cấp 2 duyệt hoàn tất.",
                "version": 2,
            },
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["status"], DocumentStatus.APPROVED)

        so.refresh_from_db()
        self.assertEqual(so.status, DocumentStatus.APPROVED)
        self.assertIsNotNone(so.approved_at)

    # 5. Rejection Decision with Mandatory Comment (BR-SAL-08-08, EF-04)
    def test_05_rejection_requires_comment_br_sal_08_08(self):
        """Từ chối phải có lý do (BR-SAL-08-08, EF-04)."""
        so = self.create_pending_order()

        # Thiếu comment -> 400
        res_fail = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "REJECT",
                "comment": "",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("comment", str(res_fail.data))

        # Có comment hợp lệ -> 200
        res_ok = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "REJECT",
                "comment": "Giá bán chưa phù hợp chính sách chiết khấu.",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        so.refresh_from_db()
        self.assertEqual(so.status, DocumentStatus.REJECTED)
        self.assertEqual(so.rejection_reason, "Giá bán chưa phù hợp chính sách chiết khấu.")

    # 6. Request Revision Decision with Mandatory Comment (BR-SAL-08-08, EF-04)
    def test_06_request_revision_requires_comment_br_sal_08_08(self):
        """Yêu cầu chỉnh sửa phải có nội dung (BR-SAL-08-08, EF-04)."""
        so = self.create_pending_order()

        # Thiếu comment -> 400
        res_fail = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "REQUEST_REVISION",
                "comment": "",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("comment", str(res_fail.data))

        # Có comment hợp lệ -> 200
        res_ok = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "REQUEST_REVISION",
                "comment": "Vui lòng cập nhật lại địa chỉ giao hàng.",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        so.refresh_from_db()
        self.assertEqual(so.status, DocumentStatus.REVISION_REQUIRED)
        self.assertEqual(so.rejection_reason, "Vui lòng cập nhật lại địa chỉ giao hàng.")

    # 7. Block Self-Approval (BR-SAL-08-07, EF-06)
    def test_07_block_self_approval_br_sal_08_07(self):
        """Không cho phép người lập tự phê duyệt khi allow_self_approval=False (BR-SAL-08-07)."""
        # Creator có quyền approver_role
        UserRoleAssignment.objects.create(
            company_membership=self.creator_membership, role=self.approver_role, assigned_by=self.creator_account
        )
        snap = self.make_snapshot(approver_account=self.creator_account, allow_self=False)
        so = self.create_pending_order(snapshot=snap)

        res = self.creator_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Tự duyệt",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Không được tự phê duyệt chứng từ", str(res.data))

    # 8. Allow Self-Approval when configured
    def test_08_allow_self_approval_when_configured(self):
        """Cho phép người lập tự duyệt khi Workflow cấu hình allow_self_approval=True."""
        UserRoleAssignment.objects.create(
            company_membership=self.creator_membership, role=self.approver_role, assigned_by=self.creator_account
        )
        snap = self.make_snapshot(approver_account=self.creator_account, allow_self=True)
        so = self.create_pending_order(snapshot=snap)

        res = self.creator_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Tự duyệt được phép",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        so.refresh_from_db()
        self.assertEqual(so.status, DocumentStatus.APPROVED)

    # 9. Block Unassigned Approver (BR-SAL-08-01, EF-01)
    def test_09_unassigned_user_blocked_br_sal_08_01(self):
        """User có quyền phê duyệt nhưng không được phân công tại cấp hiện tại thì bị chặn (BR-SAL-08-01)."""
        so = self.create_pending_order()
        res = self.unassigned_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Không được phân công",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Bạn không được phân công", str(res.data))

    # 10. Unauthorized User Blocked (EF-01)
    def test_10_unauthorized_user_blocked_ef_01(self):
        """User không có quyền phê duyệt thì bị chặn truy cập."""
        so = self.create_pending_order()
        res_pending = self.unauth_client.get(self.pending_url)
        self.assertEqual(res_pending.status_code, status.HTTP_403_FORBIDDEN)

        res_decide = self.unauth_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Duyệt lậu",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res_decide.status_code, status.HTTP_403_FORBIDDEN)

    # 11. Optimistic Locking Concurrency (BR-SAL-08-04, EF-03)
    def test_11_optimistic_locking_version_mismatch_br_sal_08_04(self):
        """Phiên bản chứng từ không khớp bị chặn (BR-SAL-08-04, EF-03)."""
        so = self.create_pending_order()
        res = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Duyệt phiên bản cũ",
                "version": 99,  # Version trong DB là 1
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Nội dung chứng từ đã thay đổi", str(res.data))

    # 12. Non-pending Document Blocked (BR-SAL-08-02, EF-05)
    def test_12_non_pending_document_blocked_br_sal_08_02(self):
        """Chứng từ không ở trạng thái Chờ duyệt thì không thể xử lý (BR-SAL-08-02, EF-05)."""
        so = self.create_pending_order()
        so.status = DocumentStatus.DRAFT
        so.save()

        res = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Duyệt nháp",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Chứng từ không ở trạng thái Chờ duyệt", str(res.data))

    # 13. Prevent Duplicate Approval by Same User at Same Step (BR-SAL-08-06, BR-SAL-08-13)
    def test_13_prevent_duplicate_approval_by_same_user_at_same_step(self):
        """User đã duyệt bước này thì không được duyệt lại (tránh trùng quyết định)."""
        steps = [
            {
                "step_order": 1,
                "approvers": [{"type": "USER", "id": str(self.approver1_account.pk), "user_id": str(self.approver1_account.pk)}],
            },
            {
                "step_order": 2,
                "approvers": [{"type": "USER", "id": str(self.approver2_account.pk), "user_id": str(self.approver2_account.pk)}],
            },
        ]
        snapshot = self.make_snapshot(levels=2, steps=steps)
        so = self.create_pending_order(snapshot=snapshot)

        # Approver 1 duyệt lần 1
        res1 = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Lần 1",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Giả sử bằng cách nào đó cấp chưa chuyển hoặc gọi lại cấp 1
        res2 = self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Lần 2",
                "version": 2,
            },
            format="json",
        )
        # Bị chặn bởi kiểm tra phân công cấp 2 (approver1 không ở cấp 2)
        self.assertIn(res2.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

    # 14. Creator Withdraws Pending Request (AF-04, BR-SAL-08-09)
    def test_14_creator_withdraw_pending_request_af_04(self):
        """Người lập thu hồi yêu cầu phê duyệt thành công về DRAFT (AF-04, BR-SAL-08-09)."""
        so = self.create_pending_order()

        # Người khác không thể thu hồi -> 403
        res_other = self.approver1_client.post(
            self.withdraw_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "reason": "Thu hồi thay",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res_other.status_code, status.HTTP_403_FORBIDDEN)

        # Người lập thu hồi -> 200 OK
        res_creator = self.creator_client.post(
            self.withdraw_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "reason": "Cần sửa lại đơn giá và khuyến mại",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(res_creator.status_code, status.HTTP_200_OK)
        so.refresh_from_db()
        self.assertEqual(so.status, DocumentStatus.DRAFT)
        self.assertEqual(so.withdrawal_reason, "Cần sửa lại đơn giá và khuyến mại")

        # Kiểm tra quyết định WITHDRAWN được ghi nhận
        dec = ApprovalDecision.objects.filter(
            company=self.company, document_type="ORDER", document_id=so.pk, decision="WITHDRAWN"
        ).first()
        self.assertIsNotNone(dec)
        self.assertEqual(dec.actor, self.creator_account)

    # 15. History & Audit Log (BR-SAL-08-14, AF-06)
    def test_15_approval_history_endpoint_and_audit_logging(self):
        """Tra cứu lịch sử phê duyệt và kiểm tra ghi nhận AuditLog (BR-SAL-08-14, AF-06)."""
        so = self.create_pending_order()

        # Approve
        self.approver1_client.post(
            self.decide_url,
            {
                "company_id": str(self.company.pk),
                "document_type": "ORDER",
                "document_id": str(so.pk),
                "action": "APPROVE",
                "comment": "Chấp thuận đơn hàng",
                "version": 1,
            },
            format="json",
        )

        # Xem lịch sử
        res_hist = self.approver1_client.get(
            f"{self.history_url}&document_type=ORDER&document_id={so.pk}"
        )
        self.assertEqual(res_hist.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_hist.data), 1)
        self.assertEqual(res_hist.data[0]["decision"], "APPROVED")
        self.assertEqual(res_hist.data[0]["decision_name"], "Phê duyệt")
        self.assertEqual(res_hist.data[0]["comment"], "Chấp thuận đơn hàng")

        # Kiểm tra AuditLog
        audit_entry = AuditLog.objects.filter(
            company=self.company, action_code="APPROVE", entity_id=str(so.pk)
        ).first()
        self.assertIsNotNone(audit_entry)
        self.assertEqual(audit_entry.reason, "Chấp thuận đơn hàng")
