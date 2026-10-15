from datetime import timedelta
from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Item, Party, PartyRole, UnitOfMeasure, Warehouse
from organization.models import Branch, Company, Department, Employee
from purchases.models import DocumentStatus, PurchaseOrder, PurchaseRequest


class PurchaseRequestManagementTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency, _ = Currency.objects.get_or_create(
            code="VND",
            defaults={"name": "Đồng Việt Nam", "is_active": True},
        )
        self.company = Company.objects.create(
            code="COMP_PUR",
            name="Công ty Mua Hàng Test",
            legal_name="Công ty TNHH Mua Hàng Test",
            tax_code="0109998881",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="COMP_OTHER",
            name="Công ty Khác",
            legal_name="Công ty Cổ Phần Khác",
            tax_code="0109998882",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )

        self.branch = Branch.objects.create(company=self.company, code="CN_HN", name="Chi nhánh Hà Nội", status="ACTIVE")
        self.department = Department.objects.create(company=self.company, branch=self.branch, code="PB_MUA", name="Phòng Mua Hàng", status="ACTIVE")
        self.employee = Employee.objects.create(company=self.company, branch=self.branch, department=self.department, employee_code="NV01", full_name="Nguyễn Văn A")

        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái", status="ACTIVE")
        self.item = Item.objects.create(company=self.company, base_uom=self.uom, code="HH01", name="Hàng Hóa 01", item_type="GOODS", status="ACTIVE", allow_purchase=True)
        self.warehouse = Warehouse.objects.create(company=self.company, branch=self.branch, code="KHO01", name="Kho Tổng", status="ACTIVE")

        self.supplier = Party.objects.create(company=self.company, code="NCC01", name="Nhà Cung Cấp 01", default_currency=self.currency, status="ACTIVE")
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=self.today)

        # Users & IAM RBAC
        auth_creator = get_user_model().objects.create_user(username="creator-user", password="password")
        self.creator_account = auth_creator.iam_account
        self.creator_membership = CompanyMembership.objects.create(company=self.company, user=self.creator_account, created_by=self.creator_account)
        self.creator_role = Role.objects.create(company=self.company, code="PUR_CREATOR", name="Nhân viên Lập yêu cầu")
        UserRoleAssignment.objects.create(company_membership=self.creator_membership, role=self.creator_role, assigned_by=self.creator_account)

        auth_approver = get_user_model().objects.create_user(username="approver-user", password="password")
        self.approver_account = auth_approver.iam_account
        self.approver_membership = CompanyMembership.objects.create(company=self.company, user=self.approver_account, created_by=self.approver_account)
        self.approver_role = Role.objects.create(company=self.company, code="PUR_APPROVER", name="Người Phê Duyệt")
        UserRoleAssignment.objects.create(company_membership=self.approver_membership, role=self.approver_role, assigned_by=self.approver_account)

        self.client = APIClient()
        self.approver_client = APIClient()
        self.client.force_authenticate(auth_creator)
        self.approver_client.force_authenticate(auth_approver)

        # Grant full permissions by default to creator & approver roles
        self.grant_creator("VIEW", "CREATE", "EDIT", "DELETE", "SUBMIT", "CANCEL")
        self.grant_approver("VIEW", "APPROVE", "REJECT")

    def grant_creator(self, *actions):
        for act in actions:
            for prefix in ("PUR.REQUEST", "PUR.ORDER"):
                perm = Permission.objects.filter(code=f"{prefix}.{act}").first()
                if perm:
                    RolePermission.objects.get_or_create(role=self.creator_role, permission=perm, defaults={"effect": "ALLOW"})

    def grant_approver(self, *actions):
        for act in actions:
            perm = Permission.objects.filter(code=f"PUR.REQUEST.{act}").first()
            if perm:
                RolePermission.objects.get_or_create(role=self.approver_role, permission=perm, defaults={"effect": "ALLOW"})

    def request_payload(self, **overrides):
        data = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "department": str(self.department.id),
            "requester": str(self.employee.id),
            "document_date": str(self.today),
            "required_date": str(self.today + timedelta(days=5)),
            "purpose": "Mua sắm trang thiết bị văn phòng",
            "receiving_location": "Kho Hà Nội",
            "notes": "Đề xuất ưu tiên xử lý sớm",
            "attachments": [
                {"file_name": "bao_gia_ncc.pdf", "file_size": 1024 * 500}
            ],
            "lines": [
                {
                    "line_no": 1,
                    "item": str(self.item.id),
                    "uom": str(self.uom.id),
                    "quantity": "10.000000",
                    "estimated_unit_price": "250000.0000",
                    "required_date": str(self.today + timedelta(days=5)),
                    "notes": "Hàng mới 100%",
                }
            ],
        }
        data.update(overrides)
        return data

    def test_01_create_purchase_request_success_and_draft_status(self):
        """Tạo yêu cầu mua hàng thành công: trạng thái DRAFT, mã tự sinh, tính tiền dự kiến (BR-PUR-REQ-06, 12, 16, AF-01)."""
        payload = self.request_payload()
        res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        data = res.data
        self.assertEqual(data["status"], DocumentStatus.DRAFT)
        self.assertTrue(data["number"].startswith("PR"))
        self.assertEqual(Decimal(str(data["total_estimated_amount"])), Decimal("2500000.0000"))
        line = data["lines"][0]
        self.assertEqual(Decimal(str(line["estimated_amount"])), Decimal("2500000.0000"))
        self.assertEqual(Decimal(str(line["remaining_quantity"])), Decimal("10.000000"))

        # Verify audit log recorded
        audit = AuditLog.objects.filter(company=self.company, entity_id=data["id"], action_code="CREATE").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.module_code, "PUR")

    def test_02_submit_direct_approval_when_no_workflow(self):
        """Gửi phê duyệt khi không có workflow: chuyển trực tiếp sang APPROVED (AF-02, BR-PUR-REQ-25)."""
        create_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id = create_res.data["id"]

        # Submit with no workflow required
        submit_res = self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"approval_required": False}},
            format="json",
        )
        self.assertEqual(submit_res.status_code, 200, submit_res.data)
        self.assertEqual(submit_res.data["status"], DocumentStatus.APPROVED)
        self.assertEqual(submit_res.data.get("message"), "Gửi yêu cầu mua hàng phê duyệt thành công.")
        self.assertIsNotNone(submit_res.data["approved_at"])

        # Check Audit log
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=req_id, action_code="SUBMIT").exists())

    def test_03_submit_with_workflow_transitions_to_pending_approval(self):
        """Gửi phê duyệt có workflow: chuyển sang PENDING_APPROVAL (BR-PUR-REQ-24)."""
        create_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id = create_res.data["id"]

        submit_res = self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"version": "PR_WF_V1", "levels": 1}},
            format="json",
        )
        self.assertEqual(submit_res.status_code, 200, submit_res.data)
        self.assertEqual(submit_res.data["status"], DocumentStatus.PENDING_APPROVAL)
        self.assertEqual(submit_res.data.get("message"), "Gửi yêu cầu mua hàng phê duyệt thành công.")

    def test_04_approver_request_revision_and_user_resubmits(self):
        """Người phê duyệt yêu cầu chỉnh sửa và User cập nhật gửi lại (AF-03, AF-06, BR-PUR-REQ-17, 28)."""
        create_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id = create_res.data["id"]

        self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"version": "PR_WF_V1", "levels": 1}},
            format="json",
        )

        # Approver requests revision
        rev_res = self.approver_client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/request-revision/?company_id={self.company.id}",
            {"comment": "Vui lòng điều chỉnh lại số lượng và thêm giải trình."},
            format="json",
        )
        self.assertEqual(rev_res.status_code, 200, rev_res.data)
        self.assertEqual(rev_res.data["status"], DocumentStatus.REVISION_REQUIRED)

        # User updates request (BR-PUR-REQ-17 allows edit in REVISION_REQUIRED)
        update_payload = self.request_payload(
            purpose="Mua sắm bổ sung thiết bị sau khi điều chỉnh",
            notes="Đã chỉnh sửa theo yêu cầu",
            lines=[{
                "line_no": 1,
                "item": str(self.item.id),
                "uom": str(self.uom.id),
                "quantity": "8.000000",
                "estimated_unit_price": "250000.0000",
            }],
        )
        edit_res = self.client.put(
            f"/api/v1/purchases/purchase-requests/{req_id}/?company_id={self.company.id}",
            update_payload,
            format="json",
        )
        self.assertEqual(edit_res.status_code, 200, edit_res.data)
        self.assertEqual(edit_res.data["purpose"], "Mua sắm bổ sung thiết bị sau khi điều chỉnh")
        self.assertEqual(Decimal(str(edit_res.data["lines"][0]["quantity"])), Decimal("8.000000"))

        # User resubmits for approval
        resubmit_res = self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"version": "PR_WF_V1", "levels": 1}},
            format="json",
        )
        self.assertEqual(resubmit_res.status_code, 200, resubmit_res.data)
        self.assertEqual(resubmit_res.data["status"], DocumentStatus.PENDING_APPROVAL)

    def test_05_approver_approve_and_reject(self):
        """Phê duyệt thành công hoặc từ chối có lý do bắt buộc (AF-04, AF-05, BR-PUR-REQ-26, 27)."""
        create_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id = create_res.data["id"]

        self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"version": "PR_WF_V1", "levels": 1}},
            format="json",
        )

        # Reject without comment -> fails
        reject_no_comment = self.approver_client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/reject/?company_id={self.company.id}",
            {"comment": ""},
            format="json",
        )
        self.assertEqual(reject_no_comment.status_code, 400)
        self.assertIn("Lý do từ chối là bắt buộc", str(reject_no_comment.data))

        # Reject with comment -> succeeds
        reject_res = self.approver_client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/reject/?company_id={self.company.id}",
            {"comment": "Ngân sách tháng này đã hết, tạm hoãn mua sắm."},
            format="json",
        )
        self.assertEqual(reject_res.status_code, 200)
        self.assertEqual(reject_res.data["status"], DocumentStatus.REVISION_REQUIRED if False else DocumentStatus.REJECTED)

        # New request for approve
        create_res2 = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id2 = create_res2.data["id"]
        self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id2}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"version": "PR_WF_V1", "levels": 1}},
            format="json",
        )

        # Approve -> succeeds
        app_res = self.approver_client.post(
            f"/api/v1/purchases/purchase-requests/{req_id2}/approve/?company_id={self.company.id}",
            {"comment": "Đồng ý phê duyệt"},
            format="json",
        )
        self.assertEqual(app_res.status_code, 200, app_res.data)
        self.assertEqual(app_res.data["status"], DocumentStatus.APPROVED)
        self.assertIsNotNone(app_res.data["approved_at"])

    def test_06_edit_restrictions(self):
        """Chỉ cho phép sửa khi DRAFT hoặc REVISION_REQUIRED; không được sửa số yêu cầu (BR-PUR-REQ-06, 17)."""
        create_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id = create_res.data["id"]
        original_number = create_res.data["number"]

        # Attempt to modify number in DRAFT
        try_modify_num = self.client.put(
            f"/api/v1/purchases/purchase-requests/{req_id}/?company_id={self.company.id}",
            self.request_payload(number="NEW-NUMBER-999"),
            format="json",
        )
        self.assertEqual(try_modify_num.status_code, 400)
        self.assertIn("Không được tự sửa Số yêu cầu", str(try_modify_num.data))

        # Submit and approve
        self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"approval_required": False}},
            format="json",
        )

        # Attempt to edit when APPROVED -> must fail (BR-PUR-REQ-17)
        try_edit_approved = self.client.put(
            f"/api/v1/purchases/purchase-requests/{req_id}/?company_id={self.company.id}",
            self.request_payload(number=original_number, purpose="Thay đổi sau khi duyệt"),
            format="json",
        )
        self.assertEqual(try_edit_approved.status_code, 400)
        self.assertIn("Chỉ chứng từ DRAFT hoặc REVISION_REQUIRED được sửa", str(try_edit_approved.data))

    def test_07_delete_restrictions(self):
        """Chỉ yêu cầu DRAFT mới được xóa; ghi AuditLog (AF-07, BR-PUR-REQ-18, 19, 36)."""
        create_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id = create_res.data["id"]

        # Delete in DRAFT succeeds
        del_res = self.client.delete(f"/api/v1/purchases/purchase-requests/{req_id}/?company_id={self.company.id}")
        self.assertEqual(del_res.status_code, 204)
        self.assertFalse(PurchaseRequest.objects.filter(pk=req_id).exists())
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=req_id, action_code="DELETE").exists())

        # Create another and approve -> Delete fails
        create_res2 = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id2 = create_res2.data["id"]
        self.client.post(f"/api/v1/purchases/purchase-requests/{req_id2}/submit/?company_id={self.company.id}", {"workflow_snapshot": {"approval_required": False}}, format="json")

        del_approved = self.client.delete(f"/api/v1/purchases/purchase-requests/{req_id2}/?company_id={self.company.id}")
        self.assertEqual(del_approved.status_code, 400)
        self.assertIn("Chỉ yêu cầu ở DRAFT và chưa liên kết với dữ liệu khác mới được xóa", str(del_approved.data))

    def test_08_cancel_approved_request(self):
        """Hủy yêu cầu APPROVED khi chưa lập đơn mua; bắt buộc có lý do (AF-08, BR-PUR-REQ-20)."""
        create_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id = create_res.data["id"]
        self.client.post(f"/api/v1/purchases/purchase-requests/{req_id}/submit/?company_id={self.company.id}", {"workflow_snapshot": {"approval_required": False}}, format="json")

        # Cancel without reason -> fails
        cancel_no_reason = self.client.post(f"/api/v1/purchases/purchase-requests/{req_id}/cancel/?company_id={self.company.id}", {"reason": ""}, format="json")
        self.assertEqual(cancel_no_reason.status_code, 400)
        self.assertIn("Lý do hủy là bắt buộc", str(cancel_no_reason.data))

        # Cancel with reason -> succeeds
        cancel_res = self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/cancel/?company_id={self.company.id}",
            {"reason": "Dự án bị hủy nên không còn nhu cầu mua sắm."},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, 200, cancel_res.data)
        self.assertEqual(cancel_res.data["status"], DocumentStatus.CANCELLED)
        self.assertEqual(cancel_res.data["cancellation_reason"], "Dự án bị hủy nên không còn nhu cầu mua sắm.")
        self.assertIsNotNone(cancel_res.data["cancelled_at"])

        # Check Audit log
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=req_id, action_code="CANCEL").exists())

    def test_09_order_conversion_lifecycle(self):
        """Chuyển thành đơn mua hàng: PARTIALLY_ORDERED -> ORDERED và hoàn lại khi hủy PO (AF-09, 10, BR-PUR-REQ-29..33)."""
        create_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        req_id = create_res.data["id"]
        self.client.post(f"/api/v1/purchases/purchase-requests/{req_id}/submit/?company_id={self.company.id}", {"workflow_snapshot": {"approval_required": False}}, format="json")
        req_obj = PurchaseRequest.objects.get(pk=req_id)
        line_id = str(req_obj.lines.first().id)

        # 1. First PO: takes partial quantity 4/10 (BR-PUR-REQ-31)
        po1 = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "branch": str(self.branch.id), "number": "PO-TEST-01",
                "document_date": str(self.today), "supplier": str(self.supplier.id),
                "currency": str(self.currency.id), "exchange_rate": "1", "receiving_warehouse": str(self.warehouse.id),
                "delivery_date": str(self.today + timedelta(days=5)),
                "lines": [{
                    "line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id),
                    "quantity": "4.0000", "unit_price": "250000.0000", "warehouse": str(self.warehouse.id),
                    "request_links": [{"request_line": line_id, "quantity": "4.0000"}],
                }],
            }, format="json",
        )
        self.assertEqual(po1.status_code, 201, po1.data)

        # Verify PR status became PARTIALLY_ORDERED
        req_obj.refresh_from_db()
        self.assertEqual(req_obj.status, DocumentStatus.PARTIALLY_ORDERED)
        self.assertEqual(Decimal(str(req_obj.lines.first().ordered_quantity)), Decimal("4.000000"))
        self.assertEqual(Decimal(str(req_obj.lines.first().remaining_quantity)), Decimal("6.000000"))

        # Cannot cancel PR once partially ordered (BR-PUR-REQ-20)
        cancel_blocked = self.client.post(
            f"/api/v1/purchases/purchase-requests/{req_id}/cancel/?company_id={self.company.id}",
            {"reason": "Cố tình hủy khi đã lập PO"},
            format="json",
        )
        self.assertEqual(cancel_blocked.status_code, 400)
        self.assertIn("Yêu cầu đã dùng để lập đơn mua, không thể hủy", str(cancel_blocked.data))

        # 2. Cannot exceed remaining quantity (BR-PUR-REQ-30)
        po_overflow = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "branch": str(self.branch.id), "number": "PO-TEST-OVERFLOW",
                "document_date": str(self.today), "supplier": str(self.supplier.id),
                "currency": str(self.currency.id), "exchange_rate": "1", "receiving_warehouse": str(self.warehouse.id),
                "lines": [{
                    "line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id),
                    "quantity": "7.0000", "unit_price": "250000.0000", "warehouse": str(self.warehouse.id),
                    "request_links": [{"request_line": line_id, "quantity": "7.0000"}],
                }],
            }, format="json",
        )
        self.assertEqual(po_overflow.status_code, 400)
        self.assertIn("Số lượng đặt vượt", str(po_overflow.data))

        # 3. Second PO: takes remaining quantity 6/10 -> PR becomes ORDERED (BR-PUR-REQ-32)
        po2 = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "branch": str(self.branch.id), "number": "PO-TEST-02",
                "document_date": str(self.today), "supplier": str(self.supplier.id),
                "currency": str(self.currency.id), "exchange_rate": "1", "receiving_warehouse": str(self.warehouse.id),
                "lines": [{
                    "line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id),
                    "quantity": "6.0000", "unit_price": "250000.0000", "warehouse": str(self.warehouse.id),
                    "request_links": [{"request_line": line_id, "quantity": "6.0000"}],
                }],
            }, format="json",
        )
        self.assertEqual(po2.status_code, 201, po2.data)
        req_obj.refresh_from_db()
        self.assertEqual(req_obj.status, DocumentStatus.ORDERED)
        self.assertEqual(Decimal(str(req_obj.lines.first().remaining_quantity)), Decimal("0.000000"))

        # 4. Cancel PO2 -> Reverts ordered quantity and updates status to PARTIALLY_ORDERED (BR-PUR-REQ-33)
        po2_id = po2.data["id"]
        cancel_po_res = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po2_id}/cancel/?company_id={self.company.id}",
            {"reason": "Hủy đơn mua thứ 2 do thay đổi kế hoạch"},
            format="json",
        )
        self.assertEqual(cancel_po_res.status_code, 200, cancel_po_res.data)
        req_obj.refresh_from_db()
        self.assertEqual(req_obj.status, DocumentStatus.PARTIALLY_ORDERED)
        self.assertEqual(Decimal(str(req_obj.lines.first().remaining_quantity)), Decimal("6.000000"))

    def test_10_validation_exception_flows(self):
        """Kiểm tra các ngoại lệ validation EF-01..EF-06, EF-09."""
        # EF-01: Unauthorized user cannot create
        unauth_user = get_user_model().objects.create_user(username="no-perm-user", password="password")
        no_perm_client = APIClient()
        no_perm_client.force_authenticate(unauth_user)
        ef01_res = no_perm_client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json")
        self.assertEqual(ef01_res.status_code, 403)
        self.assertIn("Bạn không có quyền lập yêu cầu mua hàng", str(ef01_res.data))

        # EF-02: Missing required field (purpose)
        ef02_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(purpose=""), format="json")
        self.assertEqual(ef02_res.status_code, 400)
        self.assertIn("Vui lòng nhập đầy đủ các trường bắt buộc", str(ef02_res.data))

        # EF-03: Empty lines
        ef03_res = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(lines=[]), format="json")
        self.assertEqual(ef03_res.status_code, 400)
        self.assertIn("Yêu cầu mua hàng phải có ít nhất một dòng hàng", str(ef03_res.data))

        # EF-04: Quantity <= 0
        ef04_res = self.client.post(
            f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}",
            self.request_payload(lines=[{
                "line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id), "quantity": "0.0000",
            }]), format="json",
        )
        self.assertEqual(ef04_res.status_code, 400)
        self.assertIn("Số lượng yêu cầu phải lớn hơn 0", str(ef04_res.data))

        # EF-05: required_date < document_date
        ef05_res = self.client.post(
            f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}",
            self.request_payload(required_date=str(self.today - timedelta(days=1))),
            format="json",
        )
        self.assertEqual(ef05_res.status_code, 400)
        self.assertIn("Ngày cần hàng không được trước Ngày yêu cầu", str(ef05_res.data))

        # EF-06: Inactive branch / item
        inactive_item = Item.objects.create(company=self.company, base_uom=self.uom, code="HH_DIS", name="Hàng đã ngừng", item_type="GOODS", status="INACTIVE", allow_purchase=True)
        ef06_res = self.client.post(
            f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}",
            self.request_payload(lines=[{
                "line_no": 1, "item": str(inactive_item.id), "uom": str(self.uom.id), "quantity": "5.0000",
            }]), format="json",
        )
        self.assertEqual(ef06_res.status_code, 400)
        self.assertIn("Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại", str(ef06_res.data))

        # EF-09: Optimistic Concurrency version mismatch
        created = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json").data
        ef09_res = self.client.put(
            f"/api/v1/purchases/purchase-requests/{created['id']}/?company_id={self.company.id}",
            self.request_payload(version=999),
            format="json",
        )
        self.assertEqual(ef09_res.status_code, 400)
        self.assertIn("Dữ liệu đã được người khác cập nhật. Vui lòng tải lại trang", str(ef09_res.data))

    def test_11_attachments_and_notes_validation(self):
        """Kiểm tra ràng buộc tệp đính kèm và ghi chú (BR-PUR-REQ-14, 34)."""
        # Notes > 500 characters
        long_notes = "A" * 501
        res_notes = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(notes=long_notes), format="json")
        self.assertEqual(res_notes.status_code, 400)
        self.assertIn("Ghi chú không được vượt quá 500 ký tự", str(res_notes.data))

        # Attachment > 10MB
        res_att_size = self.client.post(
            f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}",
            self.request_payload(attachments=[{"file_name": "heavy.pdf", "file_size": 11 * 1024 * 1024}]),
            format="json",
        )
        self.assertEqual(res_att_size.status_code, 400)
        self.assertIn("vượt quá 10 MB", str(res_att_size.data))

        # Attachment invalid format
        res_att_ext = self.client.post(
            f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}",
            self.request_payload(attachments=[{"file_name": "danger.exe", "file_size": 1024}]),
            format="json",
        )
        self.assertEqual(res_att_ext.status_code, 400)
        self.assertIn("Định dạng cho phép gồm PDF, DOCX, XLSX, PNG, JPG và JPEG", str(res_att_ext.data))

    def test_12_cross_company_isolation(self):
        """Không cho phép xem hoặc thao tác với yêu cầu thuộc doanh nghiệp khác (BR-PUR-REQ-05)."""
        created = self.client.post(f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}", self.request_payload(), format="json").data
        req_id = created["id"]

        # Access with other company ID returns empty or forbidden
        res = self.client.get(f"/api/v1/purchases/purchase-requests/{req_id}/?company_id={self.other_company.id}")
        self.assertIn(res.status_code, (403, 404))
