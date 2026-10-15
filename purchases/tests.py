from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from master_data.models import Currency, Item, Party, PartyRole, UnitOfMeasure, Warehouse
from organization.models import Branch, Company, Department, Employee

from .models import DocumentStatus, PurchaseOrder, PurchaseRequest, ReceiptStatus


class PurchaseApiFixture(TestCase):
    def setUp(self):
        today = timezone.localdate()
        self.today = today
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="PURCO", name="Purchase Company", legal_name="Purchase Company Ltd",
            tax_code="0100999911", accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        self.department = Department.objects.create(company=self.company, branch=self.branch, code="MUA", name="Phòng mua hàng")
        self.employee = Employee.objects.create(company=self.company, branch=self.branch, department=self.department, employee_code="NV01", full_name="Nguyễn An")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        self.item = Item.objects.create(company=self.company, base_uom=self.uom, code="HH01", name="Hàng hóa 01", item_type="GOODS", track_inventory=True)
        self.warehouse = Warehouse.objects.create(company=self.company, branch=self.branch, code="KHO01", name="Kho chính")
        self.supplier = Party.objects.create(company=self.company, code="NCC01", name="Nhà cung cấp Một", default_currency=self.currency)
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=today)
        self.creator_auth = get_user_model().objects.create_superuser(username="pur-creator", email="creator@example.com", password="password-123")
        self.approver_auth = get_user_model().objects.create_superuser(username="pur-approver", email="approver@example.com", password="password-123")
        self.client = APIClient()
        self.client.force_authenticate(self.creator_auth)

    def create_request(self):
        response = self.client.post(
            f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "branch": str(self.branch.id),
                "number": "PR-001", "document_date": str(self.today),
                "department": str(self.department.id), "requester": str(self.employee.id),
                "required_date": str(self.today + timedelta(days=7)), "purpose": "Bổ sung vật tư",
                "lines": [{
                    "line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id),
                    "quantity": "10.0000", "required_date": str(self.today + timedelta(days=7)),
                    "estimated_unit_price": "100000.0000",
                }],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response


class PurchaseRequestApiTests(PurchaseApiFixture):
    def test_request_submit_approve_and_audit(self):
        created = self.create_request()
        request_id = created.data["id"]
        submitted = self.client.post(
            f"/api/v1/purchases/purchase-requests/{request_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"version": "PUR-2-LEVEL"}}, format="json",
        )
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["status"], DocumentStatus.PENDING_APPROVAL)

        self.client.force_authenticate(self.approver_auth)
        approved = self.client.post(
            f"/api/v1/purchases/purchase-requests/{request_id}/approve/?company_id={self.company.id}",
            {"comment": "Đồng ý"}, format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["status"], DocumentStatus.APPROVED)
        self.assertEqual(
            AuditLog.objects.filter(company=self.company, entity_id=request_id).values_list("action_code", flat=True).count(),
            3,
        )

    def test_reject_requires_comment(self):
        request_id = self.create_request().data["id"]
        self.client.post(f"/api/v1/purchases/purchase-requests/{request_id}/submit/?company_id={self.company.id}", {}, format="json")
        self.client.force_authenticate(self.approver_auth)
        rejected = self.client.post(
            f"/api/v1/purchases/purchase-requests/{request_id}/reject/?company_id={self.company.id}", {}, format="json"
        )
        self.assertEqual(rejected.status_code, 400)


class PurchaseOrderReceiptApiTests(PurchaseApiFixture):
    def test_order_receives_multiple_times_and_tracks_remaining(self):
        request_id = self.create_request().data["id"]
        self.client.post(f"/api/v1/purchases/purchase-requests/{request_id}/submit/?company_id={self.company.id}", {}, format="json")
        self.client.force_authenticate(self.approver_auth)
        self.client.post(
            f"/api/v1/purchases/purchase-requests/{request_id}/approve/?company_id={self.company.id}",
            {"comment": "Duyệt"}, format="json",
        )
        request_line_id = PurchaseRequest.objects.get(pk=request_id).lines.get().id
        self.client.force_authenticate(self.creator_auth)
        order = self.client.post(
            f"/api/v1/purchases/purchase-orders/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "branch": str(self.branch.id), "number": "PO-001",
                "document_date": str(self.today), "supplier": str(self.supplier.id),
                "currency": str(self.currency.id), "exchange_rate": "1", "receiving_warehouse": str(self.warehouse.id),
                "delivery_date": str(self.today + timedelta(days=10)),
                "lines": [{
                    "line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id),
                    "quantity": "10.0000", "unit_price": "100000.0000", "warehouse": str(self.warehouse.id),
                    "request_links": [{"request_line": str(request_line_id), "quantity": "10.0000"}],
                }],
            }, format="json",
        )
        self.assertEqual(order.status_code, 201, order.data)
        order_id = order.data["id"]
        order_line_id = order.data["lines"][0]["id"]
        sub_res = self.client.post(
            f"/api/v1/purchases/purchase-orders/{order_id}/submit/?company_id={self.company.id}",
            {"workflow_snapshot": {"version": "PUR-2-LEVEL", "approval_required": True}},
            format="json",
        )
        self.assertEqual(sub_res.status_code, 200, sub_res.data)
        self.client.force_authenticate(self.approver_auth)
        approved = self.client.post(
            f"/api/v1/purchases/purchase-orders/{order_id}/approve/?company_id={self.company.id}",
            {"comment": "Duyệt"}, format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)

        self.client.force_authenticate(self.creator_auth)
        receipt = self.client.post(
            f"/api/v1/purchases/receipts/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "order": order_id, "number": "GR-001",
                "receipt_date": str(self.today), "warehouse": str(self.warehouse.id),
                "lines": [{"order_line": order_line_id, "quantity": "4.0000"}],
            }, format="json",
        )
        self.assertEqual(receipt.status_code, 201, receipt.data)
        confirmed = self.client.post(
            f"/api/v1/purchases/receipts/{receipt.data['id']}/confirm/?company_id={self.company.id}", {}, format="json"
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(confirmed.data["status"], ReceiptStatus.CONFIRMED)
        tracking = self.client.get(f"/api/v1/purchases/purchase-orders/{order_id}/tracking/?company_id={self.company.id}")
        self.assertEqual(tracking.status_code, 200, tracking.data)
        self.assertEqual(tracking.data["lines"][0]["remaining_quantity"], Decimal("6.0000"))
        self.assertEqual(PurchaseOrder.objects.get(pk=order_id).status, DocumentStatus.PARTIALLY_RECEIVED)
        excessive = self.client.post(
            f"/api/v1/purchases/receipts/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "order": order_id, "number": "GR-002",
                "receipt_date": str(self.today), "warehouse": str(self.warehouse.id),
                "lines": [{"order_line": order_line_id, "quantity": "7.0000"}],
            }, format="json",
        )
        self.assertEqual(excessive.status_code, 201, excessive.data)
        rejected = self.client.post(
            f"/api/v1/purchases/receipts/{excessive.data['id']}/confirm/?company_id={self.company.id}", {}, format="json"
        )
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(PurchaseOrder.objects.get(pk=order_id).lines.get().received_quantity, Decimal("4.0000"))
