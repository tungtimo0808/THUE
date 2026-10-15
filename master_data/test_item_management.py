from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from organization.models import Branch, Company
from .models import Currency, Item, ItemBarcode, UnitOfMeasure


class ItemManagementTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(code="ITEM_A", name="A", legal_name="A", tax_code="0888000001", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.other = Company.objects.create(code="ITEM_B", name="B", legal_name="B", tax_code="0888000002", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        self.foreign_uom = UnitOfMeasure.objects.create(company=self.other, code="CAI", name="Cái")
        auth = get_user_model().objects.create_user(username="item-editor", password="test")
        self.account = auth.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=self.account, created_by=self.account)
        self.role = Role.objects.create(company=self.company, code="ITEM_EDITOR", name="Quản lý hàng hóa")
        UserRoleAssignment.objects.create(company_membership=membership, role=self.role, assigned_by=self.account)
        self.client = APIClient()
        self.client.force_authenticate(auth)
        self.url = "/api/v1/master-data/items/"

    def grant(self, *actions):
        for action in actions:
            RolePermission.objects.get_or_create(role=self.role, permission=Permission.objects.get(code=f"MD.ITEM.{action}"), defaults={"effect": "ALLOW"})

    def payload(self, **overrides):
        return {"company": str(self.company.pk), "code": "HH001", "name": "Hàng hóa A", "item_type": "GOODS", "base_uom": str(self.uom.pk), "track_inventory": True, **overrides}

    def test_create_requires_permission_and_valid_references(self):
        self.assertEqual(self.client.post(self.url, self.payload(), format="json").status_code, 403)
        self.grant("CREATE")
        self.assertEqual(self.client.post(self.url, self.payload(base_uom=str(self.foreign_uom.pk)), format="json").status_code, 400)
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(AuditLog.objects.filter(entity_id=response.data["id"], action_code="ITEM_CREATE").exists())

    def test_service_cannot_track_inventory_and_stock_bounds_are_validated(self):
        self.grant("CREATE")
        self.assertEqual(self.client.post(self.url, self.payload(item_type="SERVICE"), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(min_stock="10", max_stock="5"), format="json").status_code, 400)
        response = self.client.post(self.url, self.payload(item_type="SERVICE", track_inventory=False), format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def test_status_change_uses_version_and_history_is_kept(self):
        item = Item.objects.create(company=self.company, code="HH001", name="Hàng hóa A", item_type="GOODS", base_uom=self.uom)
        self.grant("VIEW", "DEACTIVATE")
        endpoint = f"{self.url}{item.pk}/change-status/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(endpoint, {"status": "INACTIVE"}, format="json").status_code, 400)
        response = self.client.post(endpoint, {"status": "INACTIVE", "version": item.updated_at.isoformat()}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.post(endpoint, {"status": "ACTIVE", "version": item.updated_at.isoformat()}, format="json").status_code, 409)
        history = self.client.get(f"{self.url}{item.pk}/history/?company_id={self.company.pk}")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data[0]["action_code"], "ITEM_STATUS")

    def test_barcode_is_unique_for_active_items(self):
        first = Item.objects.create(company=self.company, code="HH001", name="A", item_type="GOODS", base_uom=self.uom)
        second = Item.objects.create(company=self.company, code="HH002", name="B", item_type="GOODS", base_uom=self.uom)
        self.grant("VIEW", "EDIT")
        one = self.client.post(f"{self.url}{first.pk}/barcodes/?company_id={self.company.pk}", {"code": "893123", "uom": str(self.uom.pk)}, format="json")
        self.assertEqual(one.status_code, 201, one.data)
        two = self.client.post(f"{self.url}{second.pk}/barcodes/?company_id={self.company.pk}", {"code": "893123", "uom": str(self.uom.pk)}, format="json")
        self.assertEqual(two.status_code, 400)
        self.assertEqual(ItemBarcode.objects.count(), 1)

    def test_import_reports_bad_row_and_export_filters_company(self):
        self.grant("VIEW", "IMPORT", "EXPORT")
        file = SimpleUploadedFile("items.csv", f"code,name,item_type,base_uom_id\nHH001,Hàng A,GOODS,{self.uom.pk}\nHH002,Hàng B,GOODS,{self.foreign_uom.pk}\n".encode("utf-8"), content_type="text/csv")
        response = self.client.post(f"{self.url}import-csv/", {"company": str(self.company.pk), "file": file}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["created"]), 1)
        self.assertEqual(response.data["errors"][0]["row"], 3)
        exported = self.client.get(f"{self.url}export-csv/", {"company_id": str(self.company.pk)})
        self.assertEqual(exported.status_code, 200)
        self.assertIn(b"HH001", exported.content)

    def test_conversion_must_target_base_uom(self):
        item = Item.objects.create(company=self.company, code="HH001", name="A", item_type="GOODS", base_uom=self.uom)
        box = UnitOfMeasure.objects.create(company=self.company, code="HOP", name="Hộp")
        other = UnitOfMeasure.objects.create(company=self.company, code="THUNG", name="Thùng")
        self.grant("VIEW", "CREATE", "EDIT")
        endpoint = f"/api/v1/master-data/item-uom-conversions/?company_id={self.company.pk}"
        payload = {"item": str(item.pk), "from_uom": str(box.pk), "to_uom": str(other.pk), "factor": "10"}
        self.assertEqual(self.client.post(endpoint, payload, format="json").status_code, 400)
        payload["to_uom"] = str(self.uom.pk)
        self.assertEqual(self.client.post(endpoint, payload, format="json").status_code, 201)

    def test_nested_create_rolls_back_on_invalid_barcode(self):
        self.grant("CREATE")
        payload = self.payload(barcodes=[{"code": "893123", "uom": str(self.foreign_uom.pk)}])
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Item.objects.filter(company=self.company, code="HH001").exists())
