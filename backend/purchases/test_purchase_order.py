from datetime import timedelta
from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Item, Party, PartyRole, TaxRate, UnitOfMeasure, Warehouse
from organization.models import Branch, Company, Department, Employee
from purchases.models import (
    DocumentStatus,
    InvoicingProgressStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReceipt,
    PurchaseReceiptLine,
    PurchaseRequest,
    PurchaseRequestLine,
    ReceiptStatus,
    ReceivingProgressStatus,
)


class PurchaseOrderManagementTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency, _ = Currency.objects.get_or_create(
            code="VND",
            defaults={"name": "Đồng Việt Nam", "is_active": True},
        )
        self.company = Company.objects.create(
            code="COMP_PO",
            name="Công ty Đơn Mua Test",
            legal_name="Công ty TNHH Đơn Mua Test",
            tax_code="0109998883",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="COMP_OTHER_PO",
            name="Công ty Khác Test",
            legal_name="Công ty Cổ Phần Khác Test",
            tax_code="0109998884",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )

        self.branch = Branch.objects.create(company=self.company, code="CN_HCM", name="Chi nhánh TP.HCM", status="ACTIVE")
        self.other_branch = Branch.objects.create(company=self.company, code="CN_DN", name="Chi nhánh Đà Nẵng", status="ACTIVE")
        self.department = Department.objects.create(company=self.company, branch=self.branch, code="PB_VT", name="Phòng Vật Tư", status="ACTIVE")
        self.employee = Employee.objects.create(company=self.company, branch=self.branch, department=self.department, employee_code="NV02", full_name="Trần Văn B")

        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái", status="ACTIVE")
        self.item_goods = Item.objects.create(company=self.company, base_uom=self.uom, code="VT01", name="Vật Tư 01", item_type="GOODS", status="ACTIVE", allow_purchase=True, track_inventory=True)
        self.item_service = Item.objects.create(company=self.company, base_uom=self.uom, code="DV01", name="Dịch Vụ Vận Chuyển", item_type="SERVICE", status="ACTIVE", allow_purchase=True, track_inventory=False)
        self.warehouse = Warehouse.objects.create(company=self.company, branch=self.branch, code="KHO_TONG", name="Kho Tổng HCM", status="ACTIVE")

        self.supplier = Party.objects.create(company=self.company, code="NCC_A", name="Nhà Cung Cấp A", default_currency=self.currency, status="ACTIVE")
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=self.today)

        self.tax_rate_10 = TaxRate.objects.create(
            company=self.company,
            code="VAT10",
            tax_type="VAT",
            rate_percent=Decimal("10.0000"),
            effective_from=self.today,
            status="ACTIVE",
        )

        # IAM Users
        auth_creator = get_user_model().objects.create_user(username="po-creator", password="password")
        self.creator_account = auth_creator.iam_account
        self.creator_membership = CompanyMembership.objects.create(company=self.company, user=self.creator_account, created_by=self.creator_account)
        self.creator_role = Role.objects.create(company=self.company, code="PO_CREATOR_ROLE", name="Nhân viên Lập Đơn Mua")
        UserRoleAssignment.objects.create(company_membership=self.creator_membership, role=self.creator_role, assigned_by=self.creator_account)

        auth_approver = get_user_model().objects.create_user(username="po-approver", password="password")
        self.approver_account = auth_approver.iam_account
        self.approver_membership = CompanyMembership.objects.create(company=self.company, user=self.approver_account, created_by=self.approver_account)
        self.approver_role = Role.objects.create(company=self.company, code="PO_APPROVER_ROLE", name="Cấp Phê Duyệt Đơn Mua")
        UserRoleAssignment.objects.create(company_membership=self.approver_membership, role=self.approver_role, assigned_by=self.approver_account)

        self.client = APIClient()
        self.approver_client = APIClient()
        self.client.force_authenticate(auth_creator)
        self.approver_client.force_authenticate(auth_approver)

        # Grant Creator & Approver permissions
        self.grant_creator("VIEW", "CREATE", "EDIT", "DELETE", "SUBMIT", "CANCEL", "CLOSE", "SEND", "CONFIRM")
        self.grant_approver("VIEW", "APPROVE", "REJECT")

    def grant_creator(self, *actions):
        for act in actions:
            for prefix in ("PUR.ORDER", "PUR.REQUEST", "PUR.RECEIPT"):
                perm = Permission.objects.filter(code=f"{prefix}.{act}").first()
                if perm:
                    RolePermission.objects.get_or_create(role=self.creator_role, permission=perm, defaults={"effect": "ALLOW"})

    def grant_approver(self, *actions):
        for act in actions:
            for prefix in ("PUR.ORDER", "PUR.REQUEST"):
                perm = Permission.objects.filter(code=f"{prefix}.{act}").first()
                if perm:
                    RolePermission.objects.get_or_create(role=self.approver_role, permission=perm, defaults={"effect": "ALLOW"})

    def order_payload(self, **overrides):
        data = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "currency": str(self.currency.id),
            "exchange_rate": "1",
            "document_date": str(self.today),
            "delivery_date": str(self.today + timedelta(days=7)),
            "supplier": str(self.supplier.id),
            "contact_person": "Nguyễn Văn Đại Diện",
            "receiving_location": "Kho Tổng HCM, Số 1 Đường ABC",
            "receiving_warehouse": str(self.warehouse.id),
            "notes": "Đơn hàng phục vụ sản xuất Quý 4",
            "lines": [
                {
                    "line_no": 1,
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "10.000000",
                    "unit_price": "100000.0000",
                    "discount_rate": "10.0000",
                    "tax_rate": str(self.tax_rate_10.id),
                    "notes": "Hàng tiêu chuẩn loại 1",
                }
            ],
        }
        data.update(overrides)
        return data

    def create_approved_purchase_request(self, quantity="10.000000"):
        req = PurchaseRequest.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.department,
            requester=self.employee,
            number=f"PR-TEST-{uuid.uuid4().hex[:6]}",
            document_date=self.today,
            required_date=self.today + timedelta(days=7),
            purpose="Mua vật tư dự án",
            status=DocumentStatus.APPROVED,
            approval_required=False,
            created_by=self.creator_account,
        )
        line = PurchaseRequestLine.objects.create(
            request=req,
            line_no=1,
            item=self.item_goods,
            uom=self.uom,
            quantity=Decimal(quantity),
            ordered_quantity=Decimal("0"),
            estimated_unit_price=Decimal("100000.0000"),
            required_date=self.today + timedelta(days=7),
        )
        return req, line

    # --------------------------------------------------------------------------
    # 1. Preconditions & Permissions (BR-PUR-PO-01..04, EF-01, EF-09, EF-13)
    # --------------------------------------------------------------------------
    def test_01_permissions_and_preconditions(self):
        """Kiểm tra quyền truy cập: unauthenticated, thiếu quyền CREATE, VIEW, sai Scope (BR-PUR-PO-01..04, EF-01, EF-09, EF-13)."""
        # EF-13: Unauthenticated access
        anon_client = APIClient()
        res_anon = anon_client.get(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}")
        self.assertEqual(res_anon.status_code, 401)

        # EF-01: Without PUR.ORDER.CREATE permission
        RolePermission.objects.filter(role=self.creator_role, permission__code="PUR.ORDER.CREATE").delete()
        res_no_create = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(),
            format="json",
        )
        self.assertEqual(res_no_create.status_code, 403)
        self.assertIn("Bạn không có quyền lập đơn mua hàng", str(res_no_create.data))
        # Re-grant
        self.grant_creator("CREATE")

        # BR-PUR-PO-01: Without PUR.ORDER.VIEW permission
        RolePermission.objects.filter(role=self.creator_role, permission__code="PUR.ORDER.VIEW").delete()
        res_no_view = self.client.get(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}")
        self.assertEqual(res_no_view.status_code, 403)
        self.assertIn("Bạn không có quyền xem đơn mua hàng", str(res_no_view.data))
        self.grant_creator("VIEW")

        # EF-09, BR-PUR-PO-04: Cross-company scope check
        res_diff_company = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.other_company.id}",
            self.order_payload(company=str(self.other_company.id)),
            format="json",
        )
        self.assertIn(res_diff_company.status_code, (403, 404))

        # EF-09: Permission revoked during submit
        res_po = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po_id = res_po.data["id"]
        RolePermission.objects.filter(role=self.creator_role, permission__code="PUR.ORDER.SUBMIT").delete()
        res_revoked = self.client.post(f"/api/v1/purchases/purchase-orders/{po_id}/submit/?company_id={self.company.id}", format="json")
        self.assertEqual(res_revoked.status_code, 403)
        self.assertIn("Quyền truy cập của bạn đã thay đổi", str(res_revoked.data))
        self.grant_creator("SUBMIT")

    # --------------------------------------------------------------------------
    # 2. Header Field Validation (BR-PUR-PO-05..07, 12, 13, EF-03, EF-07, EF-08)
    # --------------------------------------------------------------------------
    def test_02_header_field_validation(self):
        """Xác thực trường thông tin chung: tự sinh mã, bắt buộc, ngày giao, diễn giải, catalog ngừng hoạt động."""
        # BR-PUR-PO-05: Auto-generated PO number
        res_create = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(),
            format="json",
        )
        self.assertEqual(res_create.status_code, 201, res_create.data)
        po_id = res_create.data["id"]
        po_num = res_create.data["number"]
        self.assertTrue(po_num.startswith("PO"))
        self.assertEqual(res_create.data["status"], DocumentStatus.DRAFT)

        # Cannot modify PO number directly
        res_edit_num = self.client.patch(
            f"/api/v1/purchases/purchase-orders/{po_id}/?company_id={self.company.id}",
            {"number": "PO-CUSTOM-FAIL"},
            format="json",
        )
        self.assertEqual(res_edit_num.status_code, 400)
        self.assertIn("Không được tự sửa Số đơn mua", str(res_edit_num.data))

        # EF-03, BR-PUR-PO-06: Missing required header fields
        for field in ("supplier", "branch", "document_date"):
            payload = self.order_payload()
            payload.pop(field)
            res_missing = self.client.post(
                f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
                payload,
                format="json",
            )
            self.assertEqual(res_missing.status_code, 400)
            self.assertIn("Vui lòng nhập đầy đủ các trường bắt buộc", str(res_missing.data))

        # EF-07, BR-PUR-PO-12: delivery_date before document_date
        res_date_err = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(delivery_date=str(self.today - timedelta(days=1))),
            format="json",
        )
        self.assertEqual(res_date_err.status_code, 400)
        self.assertIn("Ngày giao dự kiến không được trước Ngày đặt hàng", str(res_date_err.data))

        # BR-PUR-PO-13: Description > 500 chars
        res_note_err = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(notes="N" * 501),
            format="json",
        )
        self.assertEqual(res_note_err.status_code, 400)
        self.assertIn("Diễn giải không được vượt quá 500 ký tự", str(res_note_err.data))

        # EF-08, BR-PUR-PO-07: Inactive vendor
        inactive_vendor = Party.objects.create(company=self.company, code="NCC_INACT", name="NCC Ngừng", status="INACTIVE")
        res_inact_vendor = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(supplier=str(inactive_vendor.id)),
            format="json",
        )
        self.assertEqual(res_inact_vendor.status_code, 400)
        self.assertIn("Dữ liệu được chọn đã ngừng sử dụng", str(res_inact_vendor.data))

    # --------------------------------------------------------------------------
    # 3. Line Field Validation (BR-PUR-PO-08..11, 13, EF-04, EF-05, EF-08)
    # --------------------------------------------------------------------------
    def test_03_line_field_validation(self):
        """Xác thực chi tiết hàng hóa dịch vụ: dòng rỗng, số lượng, kho nhận, đơn giá, chiết khấu, ghi chú."""
        # EF-04, BR-PUR-PO-08: No lines
        res_no_lines = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(lines=[]),
            format="json",
        )
        self.assertEqual(res_no_lines.status_code, 400)
        self.assertIn("Đơn mua hàng phải có ít nhất một dòng hàng", str(res_no_lines.data))

        # EF-05, BR-PUR-PO-10: Quantity <= 0
        payload_qty_0 = self.order_payload()
        payload_qty_0["lines"][0]["quantity"] = "0"
        res_qty_0 = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_qty_0, format="json")
        self.assertEqual(res_qty_0.status_code, 400)
        self.assertIn("Số lượng đặt phải lớn hơn 0", str(res_qty_0.data))

        # BR-PUR-PO-10: Max 6 decimal places
        payload_qty_dec = self.order_payload()
        payload_qty_dec["lines"][0]["quantity"] = "1.1234567"
        res_qty_dec = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_qty_dec, format="json")
        self.assertEqual(res_qty_dec.status_code, 400)
        self.assertIn("Số lượng đặt tối đa 6 chữ số thập phân", str(res_qty_dec.data))

        # BR-PUR-PO-09: Inventory tracked item requires warehouse
        payload_no_wh = self.order_payload(receiving_warehouse=None)
        payload_no_wh["lines"][0]["warehouse"] = None
        res_no_wh = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_no_wh, format="json")
        self.assertEqual(res_no_wh.status_code, 400)
        self.assertIn("Kho nhận là bắt buộc đối với hàng hóa theo dõi qua kho", str(res_no_wh.data))

        # BR-PUR-PO-09: Service item does NOT require warehouse
        payload_svc = self.order_payload(receiving_warehouse=None)
        payload_svc["lines"] = [{
            "line_no": 1,
            "item": str(self.item_service.id),
            "uom": str(self.uom.id),
            "quantity": "2.000000",
            "unit_price": "500000.0000",
        }]
        res_svc = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_svc, format="json")
        self.assertEqual(res_svc.status_code, 201, res_svc.data)

        # BR-PUR-PO-11: Unit price < 0
        payload_price_neg = self.order_payload()
        payload_price_neg["lines"][0]["unit_price"] = "-1000"
        res_price_neg = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_price_neg, format="json")
        self.assertEqual(res_price_neg.status_code, 400)
        self.assertIn("Đơn giá phải lớn hơn hoặc bằng 0", str(res_price_neg.data))

        # BR-PUR-PO-11: Discount rate > 100% or < 0
        payload_disc_err = self.order_payload()
        payload_disc_err["lines"][0]["discount_rate"] = "105.00"
        res_disc_err = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_disc_err, format="json")
        self.assertEqual(res_disc_err.status_code, 400)
        self.assertIn("Tỷ lệ chiết khấu phải từ 0% đến 100%", str(res_disc_err.data))

        # BR-PUR-PO-13: Line notes > 500 chars
        payload_line_note = self.order_payload()
        payload_line_note["lines"][0]["notes"] = "G" * 501
        res_line_note = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_line_note, format="json")
        self.assertEqual(res_line_note.status_code, 400)
        self.assertIn("Ghi chú không được vượt quá 500 ký tự", str(res_line_note.data))

        # EF-08: Inactive Item / UOM
        inactive_item = Item.objects.create(company=self.company, base_uom=self.uom, code="HH_INACT", name="HH Ngừng", status="INACTIVE")
        payload_inact_item = self.order_payload()
        payload_inact_item["lines"][0]["item"] = str(inactive_item.id)
        res_inact_item = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_inact_item, format="json")
        self.assertEqual(res_inact_item.status_code, 400)
        self.assertIn("Dữ liệu được chọn đã ngừng sử dụng", str(res_inact_item.data))

    # --------------------------------------------------------------------------
    # 4. Calculation Rules (BR-PUR-PO-14..19)
    # --------------------------------------------------------------------------
    def test_04_amount_calculations(self):
        """Tính toán giá trị trước chiết khấu, tiền chiết khấu, trước thuế, tiền thuế, thành tiền (BR-PUR-PO-14..19)."""
        # Line 1: qty = 10, price = 200,000. Disc = 10%. Tax = 10%
        # base = 10 * 200,000 = 2,000,000
        # disc = 2,000,000 * 10% = 200,000
        # pre_tax = 1,800,000
        # tax = 1,800,000 * 10% = 180,000
        # line_total = 1,980,000
        #
        # Line 2: qty = 5, price = 100,000. Disc = 0. Tax = 0 (no tax rate)
        # pre_tax = 500,000, tax = 0, line_total = 500,000
        #
        # Header:
        # Subtotal = 1,800,000 + 500,000 = 2,300,000
        # Discount = 200,000
        # Tax = 180,000
        # Total = 2,480,000
        payload = self.order_payload(
            lines=[
                {
                    "line_no": 1,
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "10.000000",
                    "unit_price": "200000.0000",
                    "discount_rate": "10.0000",
                    "tax_rate": str(self.tax_rate_10.id),
                },
                {
                    "line_no": 2,
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "5.000000",
                    "unit_price": "100000.0000",
                    "discount_rate": "0.0000",
                },
            ]
        )
        res = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        data = res.data

        self.assertEqual(Decimal(data["subtotal"]), Decimal("2300000.0000"))
        self.assertEqual(Decimal(data["discount_amount"]), Decimal("200000.0000"))
        self.assertEqual(Decimal(data["tax_amount"]), Decimal("180000.0000"))
        self.assertEqual(Decimal(data["total_amount"]), Decimal("2480000.0000"))

        line1 = data["lines"][0]
        self.assertEqual(Decimal(line1["pre_discount_amount"]), Decimal("2000000.0000"))
        self.assertEqual(Decimal(line1["discount_amount"]), Decimal("200000.0000"))
        self.assertEqual(Decimal(line1["pre_tax_amount"]), Decimal("1800000.0000"))
        self.assertEqual(Decimal(line1["tax_amount"]), Decimal("180000.0000"))
        self.assertEqual(Decimal(line1["line_total"]), Decimal("1980000.0000"))

    # --------------------------------------------------------------------------
    # 5. Direct PO Creation (AF-01, BR-PUR-PO-26, 27, 43)
    # --------------------------------------------------------------------------
    def test_05_create_direct_po_without_pr(self):
        """Lập đơn mua trực tiếp không qua yêu cầu mua hàng (AF-01, BR-PUR-PO-26, 27) và kiểm tra Audit Log."""
        res = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(),
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        po_id = res.data["id"]
        po = PurchaseOrder.objects.get(pk=po_id)
        self.assertIsNone(po.purchase_request)
        self.assertEqual(po.status, DocumentStatus.DRAFT)
        self.assertEqual(po.receiving_status, ReceivingProgressStatus.NOT_RECEIVED)
        self.assertEqual(po.invoicing_status, InvoicingProgressStatus.NOT_INVOICED)

        # Audit log CREATE
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=po_id, action_code="CREATE").exists())

    # --------------------------------------------------------------------------
    # 6. Create PO from PR (BR-PUR-PO-20..25, EF-02, EF-06, AF-02)
    # --------------------------------------------------------------------------
    def test_06_create_po_from_pr_auto_populate_and_quantities(self):
        """Lập đơn từ PR: auto populate, kiểm tra trạng thái PR, vượt số lượng duyệt, chia tách số lượng (AF-02)."""
        # EF-02, BR-PUR-PO-20: Unapproved PR cannot be used
        draft_pr = PurchaseRequest.objects.create(
            company=self.company, branch=self.branch, department=self.department, requester=self.employee,
            number="PR-DRAFT-01", document_date=self.today, required_date=self.today + timedelta(days=5),
            status=DocumentStatus.DRAFT, created_by=self.creator_account,
        )
        PurchaseRequestLine.objects.create(
            request=draft_pr, line_no=1, item=self.item_goods, uom=self.uom, quantity=Decimal("10.000000"),
        )
        res_draft_pr = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(purchase_request=str(draft_pr.id)),
            format="json",
        )
        self.assertEqual(res_draft_pr.status_code, 400)
        self.assertIn("Yêu cầu mua hàng không còn số lượng có thể đặt mua", str(res_draft_pr.data))

        # Approved PR: Auto-populate lines when lines is omitted
        pr, pr_line = self.create_approved_purchase_request(quantity="10.000000")
        payload_auto = self.order_payload(purchase_request=str(pr.id))
        payload_auto.pop("lines")  # let serializer auto populate
        res_auto = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", payload_auto, format="json")
        self.assertEqual(res_auto.status_code, 201, res_auto.data)
        po_auto = PurchaseOrder.objects.get(pk=res_auto.data["id"])
        self.assertEqual(po_auto.lines.count(), 1)
        self.assertEqual(Decimal(po_auto.lines.first().quantity), Decimal("10.000000"))

        # Verify PR updated to ORDERED (all 10 taken)
        pr.refresh_from_db()
        self.assertEqual(pr.status, DocumentStatus.ORDERED)
        self.assertEqual(Decimal(pr.lines.first().remaining_quantity), Decimal("0"))

        # Now attempting to create another PO with same PR returns EF-02
        res_depleted = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(purchase_request=str(pr.id)),
            format="json",
        )
        self.assertEqual(res_depleted.status_code, 400)
        self.assertIn("Yêu cầu mua hàng không còn số lượng có thể đặt mua", str(res_depleted.data))

        # Test Partial Ordering (AF-02) and Exceeding Remaining Quantity (EF-06, BR-PUR-PO-21)
        pr2, pr2_line = self.create_approved_purchase_request(quantity="10.000000")

        # EF-06: Exceed remaining quantity
        res_exceed = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(
                purchase_request=str(pr2.id),
                lines=[{
                    "line_no": 1,
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "15.000000",
                    "unit_price": "100000.0000",
                    "request_links": [{"request_line": str(pr2_line.id), "quantity": "15.000000"}],
                }]
            ),
            format="json",
        )
        self.assertEqual(res_exceed.status_code, 400)
        self.assertIn("Số lượng đặt vượt quá số lượng còn lại của yêu cầu mua hàng", str(res_exceed.data))

        # AF-02: Partial ordering (4/10)
        res_partial = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(
                purchase_request=str(pr2.id),
                lines=[{
                    "line_no": 1,
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "4.000000",
                    "unit_price": "100000.0000",
                    "request_links": [{"request_line": str(pr2_line.id), "quantity": "4.000000"}],
                }]
            ),
            format="json",
        )
        self.assertEqual(res_partial.status_code, 201)
        pr2.refresh_from_db()
        self.assertEqual(pr2.status, DocumentStatus.PARTIALLY_ORDERED)
        self.assertEqual(Decimal(pr2.lines.first().remaining_quantity), Decimal("6.000000"))

    # --------------------------------------------------------------------------
    # 7. Workflow & Approval Lifecycle (AF-04, AF-06, BR-PUR-PO-30..32)
    # --------------------------------------------------------------------------
    def test_07_approval_lifecycle_no_workflow_vs_with_workflow(self):
        """Submit không workflow -> APPROVED trực tiếp (AF-04). Submit có workflow -> PENDING_APPROVAL -> APPROVE (AF-06)."""
        # AF-04, BR-PUR-PO-31: Submit with approval_required=False -> APPROVED directly
        res_po1 = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po1_id = res_po1.data["id"]
        res_submit1 = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po1_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"approval_required": False}},
            format="json",
        )
        self.assertEqual(res_submit1.status_code, 200, res_submit1.data)
        self.assertEqual(res_submit1.data["status"], DocumentStatus.APPROVED)
        self.assertIn("Gửi đơn mua hàng phê duyệt thành công", res_submit1.data["message"])

        # Decision logged for auto-approve
        from purchases.models import ApprovalDecision
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=po1_id, action_code="SUBMIT").exists())
        self.assertTrue(ApprovalDecision.objects.filter(company=self.company, document_id=po1_id, decision=ApprovalDecision.Decision.APPROVED).exists())

        # BR-PUR-PO-30, 32: Submit with approval_required=True -> PENDING_APPROVAL
        res_po2 = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po2_id = res_po2.data["id"]
        res_submit2 = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po2_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"approval_required": True, "levels": 1}},
            format="json",
        )
        self.assertEqual(res_submit2.status_code, 200)
        self.assertEqual(res_submit2.data["status"], DocumentStatus.PENDING_APPROVAL)
        self.assertIn("Gửi đơn mua hàng phê duyệt thành công", res_submit2.data["message"])

        # Creator cannot approve own order if allow_self_approval is False (BR-PUR-REQ-26)
        self.grant_creator("APPROVE")
        res_self_app = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po2_id}/approve/?company_id={self.company.id}",
            format="json",
        )
        self.assertEqual(res_self_app.status_code, 400)
        self.assertIn("Không được tự phê duyệt", str(res_self_app.data))

        # Approver approves (AF-06)
        res_app = self.approver_client.post(
            f"/api/v1/purchases/purchase-orders/{po2_id}/approve/?company_id={self.company.id}",
            {"comment": "Đồng ý phê duyệt đơn mua"},
            format="json",
        )
        self.assertEqual(res_app.status_code, 200)
        self.assertEqual(res_app.data["status"], DocumentStatus.APPROVED)
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=po2_id, action_code="APPROVE").exists())

    # --------------------------------------------------------------------------
    # 8. Revision & Resubmit Flow (AF-05, AF-08, BR-PUR-PO-28)
    # --------------------------------------------------------------------------
    def test_08_revision_flow_and_editing_in_draft_vs_approved(self):
        """Yêu cầu chỉnh sửa (AF-05), sửa đơn ở REVISION_REQUIRED (AF-08), cấm sửa khi APPROVED (BR-PUR-PO-28)."""
        res_po = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po_id = res_po.data["id"]
        self.client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"approval_required": True, "levels": 1}},
            format="json",
        )

        # Approver requests revision (AF-05)
        res_rev = self.approver_client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/request-revision/?company_id={self.company.id}",
            {"comment": "Đề nghị đàm phán giảm giá thêm 5%"},
            format="json",
        )
        self.assertEqual(res_rev.status_code, 200)
        self.assertEqual(res_rev.data["status"], DocumentStatus.REVISION_REQUIRED)
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=po_id, action_code="REQUEST_REVISION").exists())

        # Creator can edit order while in REVISION_REQUIRED (AF-08, BR-PUR-PO-28)
        res_edit = self.client.put(
            f"/api/v1/purchases/purchase-orders/{po_id}/?company_id={self.company.id}",
            self.order_payload(
                notes="Đã đàm phán giảm giá thành công",
                lines=[{
                    "line_no": 1,
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "10.000000",
                    "unit_price": "95000.0000",
                    "discount_rate": "10.0000",
                }],
            ),
            format="json",
        )
        self.assertEqual(res_edit.status_code, 200, res_edit.data)
        self.assertEqual(Decimal(res_edit.data["lines"][0]["unit_price"]), Decimal("95000.0000"))

        # Resubmit after revision
        res_resubmit = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"approval_required": False}},
            format="json",
        )
        self.assertEqual(res_resubmit.status_code, 200)
        self.assertEqual(res_resubmit.data["status"], DocumentStatus.APPROVED)

        # BR-PUR-PO-28: Once APPROVED, editing fields is strictly blocked
        res_edit_blocked = self.client.put(
            f"/api/v1/purchases/purchase-orders/{po_id}/?company_id={self.company.id}",
            self.order_payload(version=res_resubmit.data["version"]),
            format="json",
        )
        self.assertEqual(res_edit_blocked.status_code, 400)
        self.assertIn("Chỉ đơn ở DRAFT hoặc REVISION_REQUIRED mới được sửa", str(res_edit_blocked.data))

    # --------------------------------------------------------------------------
    # 9. Rejection Flow (AF-07)
    # --------------------------------------------------------------------------
    def test_09_rejection_flow(self):
        """Từ chối phê duyệt đơn mua hàng (AF-07), bắt buộc lý do từ chối."""
        res_po = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po_id = res_po.data["id"]
        self.client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"approval_required": True, "levels": 1}},
            format="json",
        )

        # Reject without comment -> 400
        res_rej_no_comm = self.approver_client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/reject/?company_id={self.company.id}",
            format="json",
        )
        self.assertEqual(res_rej_no_comm.status_code, 400)
        self.assertIn("Lý do từ chối là bắt buộc", str(res_rej_no_comm.data))

        # Reject with comment -> REJECTED
        res_rej = self.approver_client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/reject/?company_id={self.company.id}",
            {"comment": "Giá mua quá cao so với ngân sách dự kiến"},
            format="json",
        )
        self.assertEqual(res_rej.status_code, 200)
        self.assertEqual(res_rej.data["status"], DocumentStatus.REJECTED)
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=po_id, action_code="REJECT").exists())

    # --------------------------------------------------------------------------
    # 10. Deletion in DRAFT & Quantity Reversal (AF-09, BR-PUR-PO-24, 29)
    # --------------------------------------------------------------------------
    def test_10_delete_draft_po_and_pr_quantity_reversal(self):
        """Xóa đơn ở DRAFT hoàn lại số lượng PR (AF-09, BR-PUR-PO-24, 29). Cấm xóa đơn ngoài DRAFT."""
        pr, pr_line = self.create_approved_purchase_request(quantity="10.000000")
        res_po = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(
                purchase_request=str(pr.id),
                lines=[{
                    "line_no": 1,
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "6.000000",
                    "unit_price": "100000.0000",
                    "request_links": [{"request_line": str(pr_line.id), "quantity": "6.000000"}],
                }]
            ),
            format="json",
        )
        po_id = res_po.data["id"]
        pr.refresh_from_db()
        self.assertEqual(pr.status, DocumentStatus.PARTIALLY_ORDERED)
        self.assertEqual(Decimal(pr.lines.first().remaining_quantity), Decimal("4.000000"))

        # Delete PO in DRAFT
        res_del = self.client.delete(f"/api/v1/purchases/purchase-orders/{po_id}/?company_id={self.company.id}")
        self.assertEqual(res_del.status_code, 204)
        self.assertFalse(PurchaseOrder.objects.filter(pk=po_id).exists())

        # Verify PR reverted to APPROVED and remaining_quantity restored
        pr.refresh_from_db()
        self.assertEqual(pr.status, DocumentStatus.APPROVED)
        self.assertEqual(Decimal(pr.lines.first().remaining_quantity), Decimal("10.000000"))

        # Verify Audit Log DELETE
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=po_id, action_code="DELETE").exists())

        # Cannot delete approved PO
        res_po_app = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po_app_id = res_po_app.data["id"]
        self.client.post(f"/api/v1/purchases/purchase-orders/{po_app_id}/submit/?company_id={self.company.id}", {"workflow_snapshot": {"approval_required": False}}, format="json")
        res_del_app = self.client.delete(f"/api/v1/purchases/purchase-orders/{po_app_id}/?company_id={self.company.id}")
        self.assertEqual(res_del_app.status_code, 400)
        self.assertIn("Chỉ đơn ở DRAFT và chưa phát sinh dữ liệu liên quan mới được xóa", str(res_del_app.data))

    # --------------------------------------------------------------------------
    # 11. Send Order to Vendor (AF-10, BR-PUR-PO-43)
    # --------------------------------------------------------------------------
    def test_11_send_order_to_vendor(self):
        """Gửi đơn mua hàng cho nhà cung cấp: chỉ đơn APPROVED mới được gửi (AF-10)."""
        res_po = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po_id = res_po.data["id"]

        # Attempt to send in DRAFT -> 400
        res_send_draft = self.client.post(f"/api/v1/purchases/purchase-orders/{po_id}/send/?company_id={self.company.id}", format="json")
        self.assertEqual(res_send_draft.status_code, 400)
        self.assertIn("Chỉ đơn ở trạng thái APPROVED mới được gửi cho nhà cung cấp", str(res_send_draft.data))

        # Approve order
        self.client.post(f"/api/v1/purchases/purchase-orders/{po_id}/submit/?company_id={self.company.id}", {"workflow_snapshot": {"approval_required": False}}, format="json")

        # Send order -> SENT
        res_send = self.client.post(f"/api/v1/purchases/purchase-orders/{po_id}/send/?company_id={self.company.id}", format="json")
        self.assertEqual(res_send.status_code, 200)
        self.assertEqual(res_send.data["status"], DocumentStatus.SENT)
        self.assertIsNotNone(res_send.data["sent_at"])
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=po_id, action_code="SEND").exists())

    # --------------------------------------------------------------------------
    # 12. Cancellation & Execution Blocking (AF-13, BR-PUR-PO-24, 33, 34, EF-12)
    # --------------------------------------------------------------------------
    def test_12_cancel_order_and_execution_blocking(self):
        """Hủy đơn mua: hoàn lại số lượng PR (AF-13), chặn khi đã phát sinh nhận hàng (EF-12, BR-PUR-PO-33)."""
        pr, pr_line = self.create_approved_purchase_request(quantity="10.000000")
        res_po = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(
                purchase_request=str(pr.id),
                lines=[{
                    "line_no": 1,
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "5.000000",
                    "unit_price": "100000.0000",
                    "request_links": [{"request_line": str(pr_line.id), "quantity": "5.000000"}],
                }]
            ),
            format="json",
        )
        po_id = res_po.data["id"]
        self.client.post(f"/api/v1/purchases/purchase-orders/{po_id}/submit/?company_id={self.company.id}", {"workflow_snapshot": {"approval_required": False}}, format="json")

        # Cancel without reason -> 400
        res_cancel_no_reason = self.client.post(f"/api/v1/purchases/purchase-orders/{po_id}/cancel/?company_id={self.company.id}", {"reason": ""}, format="json")
        self.assertEqual(res_cancel_no_reason.status_code, 400)
        self.assertIn("Lý do là bắt buộc", str(res_cancel_no_reason.data))

        # Cancel with reason > 500 chars -> 400
        res_cancel_long_reason = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/cancel/?company_id={self.company.id}",
            {"reason": "C" * 501},
            format="json",
        )
        self.assertEqual(res_cancel_long_reason.status_code, 400)
        self.assertIn("Lý do hủy tối đa 500 ký tự", str(res_cancel_long_reason.data))

        # Cancel successfully -> CANCELLED & PR reverted (AF-13, BR-PUR-PO-24, 34)
        res_cancel = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/cancel/?company_id={self.company.id}",
            {"reason": "Nhà cung cấp hết hàng không thể giao"},
            format="json",
        )
        self.assertEqual(res_cancel.status_code, 200)
        self.assertEqual(res_cancel.data["status"], DocumentStatus.CANCELLED)
        self.assertEqual(res_cancel.data["cancellation_reason"], "Nhà cung cấp hết hàng không thể giao")

        pr.refresh_from_db()
        self.assertEqual(pr.status, DocumentStatus.APPROVED)
        self.assertEqual(Decimal(pr.lines.first().remaining_quantity), Decimal("10.000000"))

        # Cannot cancel already cancelled order
        res_cancel_again = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/cancel/?company_id={self.company.id}",
            {"reason": "Cố tình hủy lần 2"},
            format="json",
        )
        self.assertEqual(res_cancel_again.status_code, 400)
        self.assertIn("Đơn mua đã kết thúc", str(res_cancel_again.data))

        # EF-12, BR-PUR-PO-33: Order with execution (received goods) CANNOT be cancelled
        res_po2 = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po2_id = res_po2.data["id"]
        self.client.post(f"/api/v1/purchases/purchase-orders/{po2_id}/submit/?company_id={self.company.id}", {"workflow_snapshot": {"approval_required": False}}, format="json")
        po2_obj = PurchaseOrder.objects.get(pk=po2_id)
        po2_line = po2_obj.lines.first()

        # Simulate receipt confirmation
        receipt = PurchaseReceipt.objects.create(
            company=self.company, order=po2_obj, warehouse=self.warehouse, number="REC-001",
            receipt_date=self.today, status=ReceiptStatus.DRAFT, created_by=self.creator_account,
        )
        PurchaseReceiptLine.objects.create(receipt=receipt, order_line=po2_line, quantity=Decimal("2.000000"))
        res_rec = self.client.post(f"/api/v1/purchases/receipts/{receipt.id}/confirm/?company_id={self.company.id}", format="json")
        self.assertEqual(res_rec.status_code, 200, res_rec.data)

        # Now attempting to cancel PO2 -> 400 EF-12
        res_cancel_executed = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po2_id}/cancel/?company_id={self.company.id}",
            {"reason": "Hủy khi đã nhận hàng một phần"},
            format="json",
        )
        self.assertEqual(res_cancel_executed.status_code, 400)
        self.assertIn("Đơn mua hàng đã phát sinh dữ liệu liên quan và không thể hủy", str(res_cancel_executed.data))

    # --------------------------------------------------------------------------
    # 13. Progress Tracking & Receipts (BR-PUR-PO-35..40, AF-11, AF-12)
    # --------------------------------------------------------------------------
    def test_13_tracking_endpoint_and_receipts_progress(self):
        """Theo dõi tiến độ nhận hàng và đóng đơn hoàn thành (BR-PUR-PO-35..40, AF-11, AF-12)."""
        res_po = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po_id = res_po.data["id"]
        self.client.post(f"/api/v1/purchases/purchase-orders/{po_id}/submit/?company_id={self.company.id}", {"workflow_snapshot": {"approval_required": False}}, format="json")

        # BR-PUR-PO-35, 40: Tracking endpoint
        res_track = self.client.get(f"/api/v1/purchases/purchase-orders/{po_id}/tracking/?company_id={self.company.id}")
        self.assertEqual(res_track.status_code, 200)
        track_data = res_track.data
        self.assertEqual(track_data["receiving_status"], ReceivingProgressStatus.NOT_RECEIVED)
        self.assertEqual(track_data["invoicing_status"], InvoicingProgressStatus.NOT_INVOICED)
        self.assertEqual(len(track_data["lines"]), 1)
        self.assertEqual(Decimal(str(track_data["lines"][0]["remaining_quantity"])), Decimal("10.000000"))

        # Receive partial goods (4/10) (AF-11, BR-PUR-PO-36, 38)
        po_obj = PurchaseOrder.objects.get(pk=po_id)
        line_obj = po_obj.lines.first()
        receipt = PurchaseReceipt.objects.create(
            company=self.company, order=po_obj, warehouse=self.warehouse, number="REC-002",
            receipt_date=self.today, status=ReceiptStatus.DRAFT, created_by=self.creator_account,
        )
        PurchaseReceiptLine.objects.create(receipt=receipt, order_line=line_obj, quantity=Decimal("4.000000"))
        res_conf = self.client.post(f"/api/v1/purchases/receipts/{receipt.id}/confirm/?company_id={self.company.id}", format="json")
        self.assertEqual(res_conf.status_code, 200, res_conf.data)

        # Check tracking after partial receipt
        res_track2 = self.client.get(f"/api/v1/purchases/purchase-orders/{po_id}/tracking/?company_id={self.company.id}")
        self.assertEqual(res_track2.data["receiving_status"], ReceivingProgressStatus.PARTIALLY_RECEIVED)
        self.assertEqual(Decimal(str(res_track2.data["lines"][0]["received_quantity"])), Decimal("4.000000"))
        self.assertEqual(Decimal(str(res_track2.data["lines"][0]["remaining_quantity"])), Decimal("6.000000"))

        # Close order (AF-12, BR-PUR-PO-39)
        res_close = self.client.post(
            f"/api/v1/purchases/purchase-orders/{po_id}/close/?company_id={self.company.id}",
            {"reason": "Hoàn tất các hạng mục của đơn mua"},
            format="json",
        )
        self.assertEqual(res_close.status_code, 200)
        self.assertEqual(res_close.data["status"], DocumentStatus.COMPLETED)
        po_obj.refresh_from_db()
        self.assertEqual(po_obj.status, DocumentStatus.COMPLETED)

    # --------------------------------------------------------------------------
    # 14. Attachments Validation (BR-PUR-PO-41)
    # --------------------------------------------------------------------------
    def test_14_attachments_validation(self):
        """Xác thực tệp đính kèm: dung lượng <= 10MB, định dạng PDF, DOCX, XLSX, PNG, JPG, JPEG (BR-PUR-PO-41)."""
        # Valid attachments
        valid_atts = [
            {"name": "bao_gia_ncc.pdf", "size": 1024 * 500, "url": "https://example.com/bg.pdf"},
            {"name": "hop_dong.docx", "size": 1024 * 300, "url": "https://example.com/hd.docx"},
            {"name": "bang_tinh.xlsx", "size": 1024 * 200, "url": "https://example.com/bt.xlsx"},
            {"name": "anh_mau.png", "size": 1024 * 100, "url": "https://example.com/am.png"},
            {"name": "hinh_anh.jpg", "size": 1024 * 150, "url": "https://example.com/ha.jpg"},
            {"name": "chung_tu.jpeg", "size": 1024 * 120, "url": "https://example.com/ct.jpeg"},
        ]
        res_valid = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(attachments=valid_atts),
            format="json",
        )
        self.assertEqual(res_valid.status_code, 201, res_valid.data)

        # Invalid extension (.zip, .exe)
        invalid_ext = [{"name": "file_virus.exe", "size": 1024, "url": "https://example.com/file.exe"}]
        res_ext_err = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(attachments=invalid_ext),
            format="json",
        )
        self.assertEqual(res_ext_err.status_code, 400)
        self.assertIn("Định dạng tệp không được hỗ trợ", str(res_ext_err.data))

        # Size > 10MB
        oversized = [{"name": "catalogue_nang.pdf", "size": 10 * 1024 * 1024 + 1, "url": "https://example.com/cat.pdf"}]
        res_size_err = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            self.order_payload(attachments=oversized),
            format="json",
        )
        self.assertEqual(res_size_err.status_code, 400)
        self.assertIn("Dung lượng tệp đính kèm không được vượt quá 10 MB", str(res_size_err.data))

    # --------------------------------------------------------------------------
    # 15. Optimistic Locking & Audit Log (EF-11, BR-PUR-PO-43, 44)
    # --------------------------------------------------------------------------
    def test_15_optimistic_locking_and_audit_trail(self):
        """Khóa lạc quan concurrency control (EF-11) và kiểm tra đầy đủ Audit Log (BR-PUR-PO-43, 44)."""
        res_po = self.client.post(f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}", self.order_payload(), format="json")
        po_id = res_po.data["id"]
        v1 = res_po.data["version"]

        # First update succeeds, increments version
        res_up1 = self.client.put(
            f"/api/v1/purchases/purchase-orders/{po_id}/?company_id={self.company.id}",
            self.order_payload(version=v1, notes="Cập nhật lần 1"),
            format="json",
        )
        self.assertEqual(res_up1.status_code, 200)
        self.assertEqual(res_up1.data["version"], v1 + 1)

        # Stale update with old version returns EF-11
        res_stale = self.client.put(
            f"/api/v1/purchases/purchase-orders/{po_id}/?company_id={self.company.id}",
            self.order_payload(version=v1, notes="Cập nhật bị đè"),
            format="json",
        )
        self.assertEqual(res_stale.status_code, 400)
        self.assertIn("Dữ liệu đã được người khác cập nhật", str(res_stale.data))

        # Verify Audit Log content (BR-PUR-PO-44: Số đơn mua, User, hành động, thời điểm, kết quả)
        logs = AuditLog.objects.filter(company=self.company, entity_id=po_id)
        self.assertTrue(logs.filter(action_code="CREATE").exists())
        self.assertTrue(logs.filter(action_code="EDIT").exists())
        edit_log = logs.filter(action_code="EDIT").first()
        self.assertEqual(edit_log.actor_user_id, self.creator_account.id)
        self.assertEqual(edit_log.module_code, "PUR")
