from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.exceptions import ValidationError as ApiValidationError
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from common_services.models import CoreCompanySetting
from iam.models import CompanyMembership, DataScopeBranch, DataScopeSet, Permission, Role, RolePermission, UserRoleAssignment
from inventory.models import StockBalance
from organization.models import Branch, Company
from .models import Currency, InventoryLocation, Item, UnitOfMeasure, Warehouse


class WarehouseManagementTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(code="WH_A", name="A", legal_name="A", tax_code="0777000001", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.other = Company.objects.create(code="WH_B", name="B", legal_name="B", tax_code="0777000002", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội", status="ACTIVE")
        self.branch2 = Branch.objects.create(company=self.company, code="SG", name="Sài Gòn", status="ACTIVE")
        CoreCompanySetting.objects.create(company=self.company, configuration={"enabled_modules": ["MD", "INV"], "warehouse_physical_address_required": True})
        auth = get_user_model().objects.create_user(username="wh-editor", password="test")
        self.account = auth.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=self.account, created_by=self.account)
        self.role = Role.objects.create(company=self.company, code="WH_EDITOR", name="Quản lý kho")
        self.assignment = UserRoleAssignment.objects.create(company_membership=membership, role=self.role, assigned_by=self.account)
        self.client = APIClient()
        self.client.force_authenticate(auth)
        self.url = "/api/v1/master-data/warehouses/"
        self.locations_url = "/api/v1/master-data/inventory-locations/"

    def grant(self, *actions):
        for action in actions:
            RolePermission.objects.get_or_create(role=self.role, permission=Permission.objects.get(code=f"MD.WAREHOUSE.{action}"), defaults={"effect": "ALLOW"})

    def payload(self, **overrides):
        return {"company": str(self.company.pk), "branch": str(self.branch.pk), "code": "WH01", "name": "Kho Hà Nội", "warehouse_type": "PHYSICAL", "warehouse_scope": "BRANCH", "address": "Hà Nội", **overrides}

    def create_warehouse(self, **overrides):
        return Warehouse.objects.create(company=self.company, branch=self.branch, code="WH01", name="Kho Hà Nội", address="Hà Nội", **overrides)

    def test_create_permission_and_validations(self):
        self.assertEqual(self.client.post(self.url, self.payload(), format="json").status_code, 403)
        self.grant("CREATE")
        incomplete = self.payload()
        incomplete.pop("warehouse_type")
        self.assertEqual(self.client.post(self.url, incomplete, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(address=""), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(branch=str(self.branch2.pk), warehouse_scope="TEMPORARY"), format="json").status_code, 400)
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(AuditLog.objects.filter(entity_id=response.data["id"], action_code="WAREHOUSE_CREATE").exists())
        self.assertEqual(self.client.post(self.url, self.payload(), format="json").status_code, 400)

    def test_default_requires_confirmation_and_status_blocks_default(self):
        first = self.create_warehouse()
        second = Warehouse.objects.create(company=self.company, branch=self.branch, code="WH02", name="Kho hai", address="Hà Nội")
        self.grant("VIEW", "EDIT", "DEACTIVATE")
        endpoint = lambda row: f"{self.url}{row.pk}/set-default/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(endpoint(first), {"version": first.updated_at.isoformat()}, format="json").status_code, 200)
        self.assertEqual(self.client.post(endpoint(second), {"version": second.updated_at.isoformat()}, format="json").status_code, 400)
        self.assertEqual(self.client.post(endpoint(second), {"version": second.updated_at.isoformat(), "confirm_replace": True}, format="json").status_code, 200)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertFalse(first.is_default)
        self.assertTrue(second.is_default)
        self.assertEqual(self.client.post(f"{self.url}{second.pk}/change-status/?company_id={self.company.pk}", {"version": second.updated_at.isoformat(), "status": "INACTIVE", "reason": "Đóng kho"}, format="json").status_code, 400)

    def test_cannot_deactivate_or_delete_warehouse_with_stock(self):
        warehouse = self.create_warehouse()
        unit = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        item = Item.objects.create(company=self.company, code="HH01", name="Hàng", item_type="GOODS", base_uom=unit)
        StockBalance.objects.create(company=self.company, warehouse=warehouse, item=item, quantity=Decimal("2"))
        self.grant("VIEW", "DEACTIVATE", "DELETE")
        endpoint = f"{self.url}{warehouse.pk}/?company_id={self.company.pk}"
        self.assertEqual(self.client.delete(endpoint).status_code, 400)
        self.assertEqual(self.client.post(f"{self.url}{warehouse.pk}/change-status/?company_id={self.company.pk}", {"version": warehouse.updated_at.isoformat(), "status": "INACTIVE", "reason": "Đóng"}, format="json").status_code, 400)

    def test_location_tree_and_cross_warehouse_parent(self):
        first = self.create_warehouse()
        second = Warehouse.objects.create(company=self.company, branch=self.branch2, code="WH02", name="Kho hai", address="HCM")
        self.grant("CREATE", "VIEW", "EDIT")
        parent = self.client.post(f"{self.locations_url}?company_id={self.company.pk}", {"warehouse": str(first.pk), "code": "A", "name": "Khu A"}, format="json")
        self.assertEqual(parent.status_code, 201, parent.data)
        child = self.client.post(f"{self.locations_url}?company_id={self.company.pk}", {"warehouse": str(first.pk), "parent": parent.data["id"], "code": "A01", "name": "Dãy A01"}, format="json")
        self.assertEqual(child.status_code, 201, child.data)
        cross = self.client.post(f"{self.locations_url}?company_id={self.company.pk}", {"warehouse": str(second.pk), "parent": parent.data["id"], "code": "BAD", "name": "Sai"}, format="json")
        self.assertEqual(cross.status_code, 400)
        cycle = self.client.patch(f"{self.locations_url}{parent.data['id']}/?company_id={self.company.pk}", {"parent": child.data["id"]}, format="json")
        self.assertEqual(cycle.status_code, 400)

    def test_scope_filters_list_and_detail(self):
        first = self.create_warehouse()
        second = Warehouse.objects.create(company=self.company, branch=self.branch2, code="WH02", name="Kho hai", address="HCM")
        self.grant("VIEW")
        scope = DataScopeSet.objects.create(company=self.company, code="HN_ONLY", name="Hà Nội", created_by=self.account)
        DataScopeBranch.objects.create(data_scope_set=scope, branch=self.branch)
        self.assignment.data_scope_set = scope
        self.assignment.save(update_fields=("data_scope_set",))
        response = self.client.get(self.url, {"company_id": str(self.company.pk)})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row["id"] for row in response.data], [str(first.pk)])
        self.assertEqual(self.client.get(f"{self.url}{second.pk}/?company_id={self.company.pk}").status_code, 404)

    def test_import_export_and_company_isolation(self):
        self.grant("IMPORT", "EXPORT")
        file = SimpleUploadedFile("warehouses.csv", b"code,name,warehouse_type,warehouse_scope,branch,address\nWH01,Kho 1,PHYSICAL,BRANCH,HN,Ha Noi\nWH02,Kho 2,PHYSICAL,BRANCH,WRONG,Ha Noi\n", content_type="text/csv")
        response = self.client.post(f"{self.url}import-csv/", {"company": str(self.company.pk), "file": file}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["created"]), 1, response.data)
        self.assertEqual(response.data["errors"][0]["row"], 3)
        exported = self.client.get(f"{self.url}export-csv/", {"company_id": str(self.company.pk)})
        self.assertEqual(exported.status_code, 200)
        self.assertIn(b"WH01", exported.content)
        self.assertNotIn(b"WH02", exported.content)

    def test_module_disabled_blocks_catalog(self):
        self.grant("CREATE", "VIEW")
        setting = self.company.core_setting
        setting.configuration = {"enabled_modules": ["MD"]}
        setting.save(update_fields=("configuration",))
        self.assertEqual(self.client.post(self.url, self.payload(), format="json").status_code, 403)

    def test_negative_stock_override_follows_company_policy(self):
        self.grant("CREATE")
        self.assertEqual(self.client.post(self.url, self.payload(allow_negative=True), format="json").status_code, 400)
        setting = self.company.core_setting
        setting.configuration = {**setting.configuration, "allow_negative_inventory": True}
        setting.save(update_fields=("configuration",))
        created = self.client.post(self.url, self.payload(allow_negative=True), format="json")
        self.assertEqual(created.status_code, 201, created.data)

    def test_inventory_rejects_expired_or_disabled_warehouse_and_nonstorage_location(self):
        from inventory.serializers import TransactionSerializer

        warehouse = self.create_warehouse(allow_receipt=False, end_date="2025-12-31")
        unit = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        item = Item.objects.create(company=self.company, code="HH01", name="Hàng", item_type="GOODS", base_uom=unit)
        payload = {"company": str(self.company.pk), "number": "R1", "transaction_type": "RECEIPT", "transaction_date": "2026-01-01", "destination_warehouse": str(warehouse.pk), "lines": [{"line_no": 1, "item": str(item.pk), "uom": str(unit.pk), "quantity": "1"}]}
        self.assertFalse(TransactionSerializer(data=payload).is_valid())
        warehouse.allow_receipt = True
        warehouse.save(update_fields=("allow_receipt",))
        self.assertFalse(TransactionSerializer(data=payload).is_valid())
        warehouse.end_date = None
        warehouse.save(update_fields=("end_date",))
        location = InventoryLocation.objects.create(warehouse=warehouse, code="AREA", name="Khu vực", can_store=False)
        payload["lines"][0]["destination_location"] = str(location.pk)
        serializer = TransactionSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(ApiValidationError):
            serializer.save(created_by=self.account)
