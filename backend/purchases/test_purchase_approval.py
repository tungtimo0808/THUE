from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Item, Party, PartyRole, UnitOfMeasure, Warehouse
from organization.models import Branch, Company, Department, Employee
from purchases.models import (
    ApprovalDecision,
    GoodsPurchase,
    PurchaseDiscount,
    PurchaseDiscountLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    PurchaseReturn,
    PurchaseReturnLine,
)


class PurchaseApprovalTests(TestCase):
    def setUp(self):
        self.today = date(2026, 10, 6)
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Việt Nam Đồng", "is_active": True})
        self.company = Company.objects.create(
            code="CTY_APPROVAL",
            name="Công Ty Phê Duyệt",
            legal_name="Công Ty Cổ Phần Phê Duyệt",
            tax_code="0109998888",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(company=self.company, code="CN01", name="Chi nhánh Chính", status="ACTIVE")
        self.department = Department.objects.create(company=self.company, branch=self.branch, code="PB_MUA", name="Phòng Mua Hàng", status="ACTIVE")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái", status="ACTIVE")
        self.item = Item.objects.create(company=self.company, base_uom=self.uom, code="HH01", name="Hàng Hóa 01", item_type="GOODS", status="ACTIVE", allow_purchase=True)
        self.service_item = Item.objects.create(company=self.company, base_uom=self.uom, code="DV01", name="Dịch Vụ 01", item_type="SERVICE", status="ACTIVE", allow_purchase=True)
        self.warehouse = Warehouse.objects.create(company=self.company, branch=self.branch, code="KHO01", name="Kho Tổng", status="ACTIVE")
        self.supplier = Party.objects.create(company=self.company, code="NCC01", name="Nhà Cung Cấp 01", default_currency=self.currency, status="ACTIVE")
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=self.today)
        self.employee = Employee.objects.create(company=self.company, branch=self.branch, department=self.department, employee_code="NV01", full_name="Nguyễn Văn A")

        # Users: creator, approver1, approver2, unassigned_approver, unauthorized_user
        auth_creator = get_user_model().objects.create_user(username="creator-usr", password="password")
        self.creator_account = auth_creator.iam_account
        self.creator_membership = CompanyMembership.objects.create(company=self.company, user=self.creator_account, created_by=self.creator_account)
        self.creator_role = Role.objects.create(company=self.company, code="PUR_CREATOR", name="Người lập")
        UserRoleAssignment.objects.create(company_membership=self.creator_membership, role=self.creator_role, assigned_by=self.creator_account)

        auth_approver1 = get_user_model().objects.create_user(username="approver1-usr", password="password")
        self.approver1_account = auth_approver1.iam_account
        self.approver1_membership = CompanyMembership.objects.create(company=self.company, user=self.approver1_account, created_by=self.approver1_account)
        self.approver_role = Role.objects.create(company=self.company, code="PUR_APPROVER", name="Người phê duyệt")
        UserRoleAssignment.objects.create(company_membership=self.approver1_membership, role=self.approver_role, assigned_by=self.approver1_account)

        auth_approver2 = get_user_model().objects.create_user(username="approver2-usr", password="password")
        self.approver2_account = auth_approver2.iam_account
        self.approver2_membership = CompanyMembership.objects.create(company=self.company, user=self.approver2_account, created_by=self.approver2_account)
        UserRoleAssignment.objects.create(company_membership=self.approver2_membership, role=self.approver_role, assigned_by=self.approver2_account)

        auth_unassigned = get_user_model().objects.create_user(username="unassigned-usr", password="password")
        self.unassigned_account = auth_unassigned.iam_account
        self.unassigned_membership = CompanyMembership.objects.create(company=self.company, user=self.unassigned_account, created_by=self.unassigned_account)
        UserRoleAssignment.objects.create(company_membership=self.unassigned_membership, role=self.approver_role, assigned_by=self.unassigned_account)

        auth_unauthorized = get_user_model().objects.create_user(username="unauth-usr", password="password")
        self.unauth_account = auth_unauthorized.iam_account
        self.unauth_membership = CompanyMembership.objects.create(company=self.company, user=self.unauth_account, created_by=self.unauth_account)
        self.unauth_role = Role.objects.create(company=self.company, code="GUEST", name="Khách")
        UserRoleAssignment.objects.create(company_membership=self.unauth_membership, role=self.unauth_role, assigned_by=self.unauth_account)

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
            "PUR.APPROVAL.VIEW",
            "PUR.APPROVAL.APPROVE",
            "PUR.APPROVAL.REJECT",
            "PUR.APPROVAL.REQUEST_REVISION",
        ])

        # URLs
        self.pending_url = f"/api/v1/purchases/approvals/pending/?company_id={self.company.pk}"
        self.detail_url = f"/api/v1/purchases/approvals/detail/?company_id={self.company.pk}"
        self.decide_url = "/api/v1/purchases/approvals/decide/"

    def grant_permissions(self, role, perm_codes):
        for code in perm_codes:
            perm = Permission.objects.filter(code=code).first()
            if perm:
                RolePermission.objects.get_or_create(role=role, permission=perm, defaults={"effect": "ALLOW"})

    def create_pending_po(self, total_amount=Decimal("1000000"), steps=None):
        snapshot = {
            "version": "v1",
            "levels": len(steps) if steps else 1,
            "steps": steps or [
                {
                    "step_order": 1,
                    "approvers": [{"type": "USER", "id": str(self.approver1_account.pk), "user_id": str(self.approver1_account.pk)}],
                }
            ],
            "allow_self_approval": False,
        }
        po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="PO-2026-0001",
            document_date=self.today,
            status="PENDING_APPROVAL",
            supplier=self.supplier,
            currency=self.currency,
            subtotal=total_amount,
            total_amount=total_amount,
            created_by=self.creator_account,
            workflow_snapshot=snapshot,
            version=1,
        )
        PurchaseOrderLine.objects.create(
            order=po,
            line_no=1,
            item=self.item,
            uom=self.uom,
            warehouse=self.warehouse,
            quantity=Decimal("10.000000"),
            unit_price=Decimal("100000.0000"),
        )
        return po

    def test_pending_list_and_detail(self):
        po = self.create_pending_po()

        # Approver 1 views pending approvals (BR-PUR-APR-34, Activity Flow step 3)
        res = self.approver1_client.get(self.pending_url)
        self.assertEqual(res.status_code, 200)
        items = res.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["document_type"], "ORDER")
        self.assertEqual(items[0]["document_id"], str(po.pk))
        self.assertEqual(items[0]["number"], po.number)
        self.assertEqual(items[0]["current_level"], 1)

        # Approver 1 views detail (Activity Flow step 7-10)
        detail_res = self.approver1_client.get(
            f"{self.detail_url}&document_type=ORDER&document_id={po.pk}"
        )
        self.assertEqual(detail_res.status_code, 200)
        detail = detail_res.data
        self.assertEqual(detail["document_id"], str(po.pk))
        self.assertEqual(detail["status"], "PENDING_APPROVAL")
        self.assertEqual(len(detail["lines"]), 1)
        self.assertEqual(detail["workflow"]["current_level"], 1)
        self.assertEqual(detail["workflow"]["is_final_level"], True)

    def test_approve_single_level_success(self):
        po = self.create_pending_po()

        # Approver 1 approves (Activity Flow step 19-31)
        payload = {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "comment": "Đồng ý phê duyệt",
            "version": 1,
        }
        res = self.approver1_client.post(self.decide_url, payload, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["message"], "Phê duyệt chứng từ thành công.")
        self.assertEqual(res.data["status"], "APPROVED")

        # Verify DB state
        po.refresh_from_db()
        self.assertEqual(po.status, "APPROVED")
        self.assertIsNotNone(po.approved_at)
        self.assertEqual(po.version, 2)

        # Verify ApprovalDecision recorded (BR-PUR-APR-20, 21)
        decision = ApprovalDecision.objects.filter(document_type="ORDER", document_id=po.pk).first()
        self.assertIsNotNone(decision)
        self.assertEqual(decision.decision, "APPROVED")
        self.assertEqual(decision.level, 1)
        self.assertEqual(decision.actor, self.approver1_account)
        self.assertEqual(decision.comment, "Đồng ý phê duyệt")

    def test_multi_level_approval_flow(self):
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
        po = self.create_pending_po(steps=steps)

        # Level 1 approval (AF-01: status remains PENDING_APPROVAL)
        res1 = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "comment": "Cấp 1 đồng ý",
            "version": 1,
        }, format="json")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.data["status"], "PENDING_APPROVAL")

        po.refresh_from_db()
        self.assertEqual(po.status, "PENDING_APPROVAL")
        self.assertEqual(po.version, 2)

        # Level 2 approval (BR-PUR-APR-28: final level transitions to APPROVED)
        res2 = self.approver2_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "comment": "Cấp 2 đồng ý",
            "version": 2,
        }, format="json")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["status"], "APPROVED")

        po.refresh_from_db()
        self.assertEqual(po.status, "APPROVED")
        self.assertEqual(ApprovalDecision.objects.filter(document_type="ORDER", document_id=po.pk).count(), 2)

    def test_request_revision_flow(self):
        po = self.create_pending_po()

        # AF-02, AF-03: Request revision
        res = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "REQUEST_REVISION",
            "comment": "Vui lòng đàm phán lại đơn giá giảm 5%",
            "version": 1,
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "REVISION_REQUIRED")

        po.refresh_from_db()
        self.assertEqual(po.status, "REVISION_REQUIRED")

        decision = ApprovalDecision.objects.filter(document_type="ORDER", document_id=po.pk).first()
        self.assertEqual(decision.decision, "REVISION_REQUIRED")
        self.assertEqual(decision.comment, "Vui lòng đàm phán lại đơn giá giảm 5%")

    def test_reject_flow(self):
        po = self.create_pending_po()

        # AF-04, AF-05: Reject
        res = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "REJECT",
            "comment": "Không đồng ý mua hàng này vì vượt ngân sách quý",
            "version": 1,
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "REJECTED")

        po.refresh_from_db()
        self.assertEqual(po.status, "REJECTED")

        decision = ApprovalDecision.objects.filter(document_type="ORDER", document_id=po.pk).first()
        self.assertEqual(decision.decision, "REJECTED")
        self.assertEqual(decision.comment, "Không đồng ý mua hàng này vì vượt ngân sách quý")

    def test_validation_empty_comments(self):
        po = self.create_pending_po()

        # EF-05: REQUEST_REVISION without comment
        res_rev = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "REQUEST_REVISION",
            "comment": "",
            "version": 1,
        }, format="json")
        self.assertEqual(res_rev.status_code, 400)
        self.assertIn("Vui lòng nhập nội dung yêu cầu chỉnh sửa.", str(res_rev.data))

        # EF-06: REJECT without reason
        res_rej = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "REJECT",
            "comment": "   ",
            "version": 1,
        }, format="json")
        self.assertEqual(res_rej.status_code, 400)
        self.assertIn("Vui lòng nhập lý do từ chối.", str(res_rej.data))

        # AF-06: APPROVE without comment is allowed
        res_app = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "comment": "",
            "version": 1,
        }, format="json")
        self.assertEqual(res_app.status_code, 200)

    def test_self_approval_blocked(self):
        # BR-PUR-APR-05: User cannot approve document created by self
        snapshot = {
            "version": "v1",
            "levels": 1,
            "steps": [{"step_order": 1, "approvers": [{"type": "USER", "id": str(self.creator_account.pk), "user_id": str(self.creator_account.pk)}]}],
            "allow_self_approval": False,
        }
        po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="PO-SELF-01",
            document_date=self.today,
            status="PENDING_APPROVAL",
            supplier=self.supplier,
            currency=self.currency,
            subtotal=Decimal("100000"),
            total_amount=Decimal("100000"),
            created_by=self.creator_account,
            workflow_snapshot=snapshot,
            version=1,
        )
        self.grant_permissions(self.creator_role, ["PUR.APPROVAL.APPROVE", "PUR.APPROVAL.VIEW"])

        res = self.creator_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Không được tự phê duyệt chứng từ do chính mình lập.", str(res.data))

    def test_approval_limit_exceeded(self):
        # BR-PUR-APR-12, EF-08: Amount exceeds approver's step limit
        steps = [
            {
                "step_order": 1,
                "limit": "500000",  # Limit is 500k, document total is 1000k
                "approvers": [{"type": "USER", "user_id": str(self.approver1_account.pk)}],
            }
        ]
        po = self.create_pending_po(total_amount=Decimal("1000000"), steps=steps)

        res = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Giá trị chứng từ vượt hạn mức phê duyệt của bạn.", str(res.data))

    def test_concurrency_optimistic_locking(self):
        # EF-07: Version mismatch
        po = self.create_pending_po()

        res = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "version": 999,  # Mismatched version
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Nội dung chứng từ đã thay đổi. Vui lòng tải lại để kiểm tra.", str(res.data))

    def test_unassigned_approver_blocked(self):
        # EF-03: User not assigned to step
        po = self.create_pending_po()

        res = self.unassigned_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertIn("Bạn không được phân công phê duyệt chứng từ này.", str(res.data))

    def test_no_permission_blocked(self):
        # EF-01: User without approval permission
        po = self.create_pending_po()

        # View pending inbox blocked
        res_list = self.unauth_client.get(self.pending_url)
        self.assertEqual(res_list.status_code, 403)
        self.assertIn("Bạn không có quyền phê duyệt chứng từ mua hàng.", str(res_list.data))

        # Decide blocked
        res_decide = self.unauth_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "ORDER",
            "document_id": str(po.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res_decide.status_code, 403)
        self.assertIn("Bạn không có quyền phê duyệt chứng từ mua hàng.", str(res_decide.data))

    def test_all_document_types_approval(self):
        # Test UC-PUR-01: PurchaseRequest
        req = PurchaseRequest.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.department,
            requester=self.employee,
            required_date=self.today,
            purpose="Mua hàng phục vụ sản xuất",
            number="PR-2026-0001",
            document_date=self.today,
            status="PENDING_APPROVAL",
            created_by=self.creator_account,
            workflow_snapshot={"levels": 1, "steps": [{"step_order": 1, "approvers": [{"type": "USER", "id": str(self.approver1_account.pk), "user_id": str(self.approver1_account.pk)}]}]},
            version=1,
        )
        PurchaseRequestLine.objects.create(
            request=req,
            line_no=1,
            item=self.item,
            uom=self.uom,
            quantity=Decimal("5"),
            estimated_unit_price=Decimal("50000"),
        )
        res_req = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "REQUEST",
            "document_id": str(req.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res_req.status_code, 200)
        req.refresh_from_db()
        self.assertEqual(req.status, "APPROVED")

        # Test UC-PUR-03: GoodsPurchase (GOODS)
        goods = GoodsPurchase.objects.create(
            company=self.company,
            branch=self.branch,
            number="GP-2026-0001",
            document_date=self.today,
            posting_date=self.today,
            status="PENDING_APPROVAL",
            purchase_type="WAREHOUSE",
            supplier=self.supplier,
            receiving_warehouse=self.warehouse,
            created_by=self.creator_account,
            workflow_snapshot={"levels": 1, "steps": [{"step_order": 1, "approvers": [{"type": "USER", "id": str(self.approver1_account.pk), "user_id": str(self.approver1_account.pk)}]}]},
            total_amount=Decimal("300000"),
            version=1,
        )
        res_goods = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "GOODS",
            "document_id": str(goods.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res_goods.status_code, 200)
        goods.refresh_from_db()
        self.assertEqual(goods.status, "APPROVED")
        # BR-PUR-APR-31: Phê duyệt không được tự động ghi sổ chứng từ
        self.assertNotEqual(goods.status, "POSTED")

        # Test UC-PUR-04: GoodsPurchase (SERVICE)
        service = GoodsPurchase.objects.create(
            company=self.company,
            branch=self.branch,
            number="SVC-2026-0001",
            document_date=self.today,
            posting_date=self.today,
            status="PENDING_APPROVAL",
            purchase_type="SERVICE",
            supplier=self.supplier,
            created_by=self.creator_account,
            workflow_snapshot={"levels": 1, "steps": [{"step_order": 1, "approvers": [{"type": "USER", "id": str(self.approver1_account.pk), "user_id": str(self.approver1_account.pk)}]}]},
            total_amount=Decimal("150000"),
            version=1,
        )
        res_svc = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "SERVICE",
            "document_id": str(service.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res_svc.status_code, 200)
        service.refresh_from_db()
        self.assertEqual(service.status, "APPROVED")
        self.assertNotEqual(service.status, "POSTED")

        # Test UC-PUR-05: PurchaseReturn (RETURN)
        ret = PurchaseReturn.objects.create(
            company=self.company,
            branch=self.branch,
            number="PRTN-2026-0001",
            document_date=self.today,
            posting_date=self.today,
            original_purchase=goods,
            status="PENDING_APPROVAL",
            supplier=self.supplier,
            total_amount=Decimal("50000"),
            subtotal=Decimal("50000"),
            reason="Hàng lỗi",
            handling="REDUCE_PAYABLE",
            created_by=self.creator_account,
            workflow_snapshot={"levels": 1, "steps": [{"step_order": 1, "approvers": [{"type": "USER", "id": str(self.approver1_account.pk), "user_id": str(self.approver1_account.pk)}]}]},
            version=1,
        )
        res_ret = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "RETURN",
            "document_id": str(ret.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res_ret.status_code, 200)
        ret.refresh_from_db()
        self.assertEqual(ret.status, "APPROVED")
        self.assertNotEqual(ret.status, "POSTED")

        # Test UC-PUR-06: PurchaseDiscount (DISCOUNT)
        disc = PurchaseDiscount.objects.create(
            company=self.company,
            branch=self.branch,
            number="PDIS-2026-0001",
            document_date=self.today,
            posting_date=self.today,
            original_purchase=goods,
            status="PENDING_APPROVAL",
            supplier=self.supplier,
            total_amount=Decimal("20000"),
            method="AMOUNT",
            handling="REDUCE_PAYABLE",
            reason="Giảm giá sản lượng",
            created_by=self.creator_account,
            workflow_snapshot={"levels": 1, "steps": [{"step_order": 1, "approvers": [{"type": "USER", "id": str(self.approver1_account.pk), "user_id": str(self.approver1_account.pk)}]}]},
            version=1,
        )
        res_disc = self.approver1_client.post(self.decide_url, {
            "company_id": str(self.company.pk),
            "document_type": "DISCOUNT",
            "document_id": str(disc.pk),
            "action": "APPROVE",
            "version": 1,
        }, format="json")
        self.assertEqual(res_disc.status_code, 200)
        disc.refresh_from_db()
        self.assertEqual(disc.status, "APPROVED")
        self.assertNotEqual(disc.status, "POSTED")
