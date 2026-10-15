from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from common_services.models import CoreCompanySetting
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from organization.models import Company
from .models import Currency, Item, ItemCategory, UnitOfMeasure


class ItemCategoryManagementTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(code="GRP_A", name="A", legal_name="A", tax_code="0777000001", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.other = Company.objects.create(code="GRP_B", name="B", legal_name="B", tax_code="0777000002", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        auth = get_user_model().objects.create_user(username="group-editor", password="test")
        self.account = auth.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=self.account, created_by=self.account)
        self.role = Role.objects.create(company=self.company, code="GRP_EDITOR", name="Quản lý nhóm")
        UserRoleAssignment.objects.create(company_membership=membership, role=self.role, assigned_by=self.account)
        self.client = APIClient()
        self.client.force_authenticate(auth)
        self.url = "/api/v1/master-data/item-categories/"

    def grant(self, resource, *actions):
        for action in actions:
            RolePermission.objects.get_or_create(role=self.role, permission=Permission.objects.get(code=f"MD.{resource}.{action}"), defaults={"effect": "ALLOW"})

    def group(self, code="ROOT", parent=None, **fields):
        return ItemCategory.objects.create(company=self.company, code=code, name=code, parent=parent, applicable_types=["MATERIAL", "GOODS", "SERVICE"], **fields)

    def test_create_checks_permission_parent_company_and_types(self):
        payload = {"company": str(self.company.pk), "code": "ROOT", "name": "Hàng hóa", "applicable_types": ["GOODS"]}
        self.assertEqual(self.client.post(self.url, payload, format="json").status_code, 403)
        self.grant("ITEM_GROUP", "CREATE", "VIEW")
        root = self.client.post(self.url, payload, format="json")
        self.assertEqual(root.status_code, 201, root.data)
        self.assertEqual(root.data["path"], "ROOT")
        child = self.client.post(self.url, {**payload, "code": "CHILD", "name": "Con", "parent": root.data["id"], "applicable_types": ["SERVICE"]}, format="json")
        self.assertEqual(child.status_code, 400)
        foreign = ItemCategory.objects.create(company=self.other, code="FOREIGN", name="Foreign")
        self.assertEqual(self.client.post(self.url, {**payload, "code": "OTHER", "parent": str(foreign.pk)}, format="json").status_code, 400)
        self.assertTrue(AuditLog.objects.filter(entity_id=root.data["id"], action_code="ITEM_GROUP_CREATE").exists())

    def test_move_updates_descendant_paths_and_rejects_cycle(self):
        root = self.group()
        child = self.group("CHILD", parent=root)
        grandchild = self.group("LEAF", parent=child)
        destination = self.group("NEW")
        self.grant("ITEM_GROUP", "VIEW", "MOVE")
        endpoint = f"{self.url}{child.pk}/move/?company_id={self.company.pk}"
        response = self.client.post(endpoint, {"parent": str(destination.pk), "version": child.updated_at.isoformat()}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        grandchild.refresh_from_db()
        self.assertEqual(grandchild.path, "NEW/CHILD/LEAF")
        cycle = self.client.post(f"{self.url}{destination.pk}/move/?company_id={self.company.pk}", {"parent": str(grandchild.pk), "version": destination.updated_at.isoformat()}, format="json")
        self.assertEqual(cycle.status_code, 400)

    def test_deactivate_blocks_active_items_and_delete_requires_empty_group(self):
        category = self.group()
        item = Item.objects.create(company=self.company, code="HH001", name="Hàng A", item_type="GOODS", base_uom=self.uom, category=category)
        self.grant("ITEM_GROUP", "VIEW", "DEACTIVATE", "DELETE")
        endpoint = f"{self.url}{category.pk}/change-status/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(endpoint, {"status": "INACTIVE", "version": category.updated_at.isoformat()}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(f"{self.url}{category.pk}/?company_id={self.company.pk}").status_code, 400)
        self.assertEqual(Item.objects.get(pk=item.pk).status, "ACTIVE")
        empty = self.group("EMPTY")
        self.assertEqual(self.client.delete(f"{self.url}{empty.pk}/?company_id={self.company.pk}").status_code, 204)

    def test_item_inherits_nearest_group_default_only_when_not_explicit(self):
        parent = self.group(default_track_inventory=False)
        child = self.group("CHILD", parent=parent)
        self.grant("ITEM", "CREATE")
        response = self.client.post("/api/v1/master-data/items/", {"company": str(self.company.pk), "code": "HH001", "name": "Hàng A", "item_type": "GOODS", "base_uom": str(self.uom.pk), "category": str(child.pk)}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(response.data["track_inventory"])
        explicit = self.client.post("/api/v1/master-data/items/", {"company": str(self.company.pk), "code": "HH002", "name": "Hàng B", "item_type": "GOODS", "base_uom": str(self.uom.pk), "category": str(child.pk), "track_inventory": True}, format="json")
        self.assertEqual(explicit.status_code, 201, explicit.data)
        self.assertTrue(explicit.data["track_inventory"])

    def test_import_parent_first_and_export_paths(self):
        self.grant("ITEM_GROUP", "VIEW", "IMPORT", "EXPORT")
        file = SimpleUploadedFile("groups.csv", b"code,name,applicable_types,parent_code\nROOT,Root,GOODS,\nCHILD,Child,GOODS,ROOT\nBAD,Bad,SERVICE,MISSING\n", content_type="text/csv")
        imported = self.client.post(f"{self.url}import-csv/", {"company": str(self.company.pk), "file": file}, format="multipart")
        self.assertEqual(imported.status_code, 200, imported.data)
        self.assertEqual(len(imported.data["created"]), 2)
        self.assertEqual(imported.data["errors"][0]["row"], 4)
        exported = self.client.get(f"{self.url}export-csv/", {"company_id": str(self.company.pk)})
        self.assertEqual(exported.status_code, 200)
        self.assertIn(b"ROOT/CHILD", exported.content)

    def test_bulk_assign_previews_then_updates_valid_items(self):
        target = self.group()
        valid = Item.objects.create(company=self.company, code="HH001", name="Hàng A", item_type="GOODS", base_uom=self.uom)
        invalid = Item.objects.create(company=self.company, code="HH002", name="Hàng B", item_type="FINISHED_GOOD", base_uom=self.uom)
        self.grant("ITEM_GROUP", "VIEW", "BULK")
        self.grant("ITEM", "EDIT")
        endpoint = f"{self.url}{target.pk}/bulk-assign/?company_id={self.company.pk}"
        preview = self.client.post(endpoint, {"item_ids": [str(valid.pk), str(invalid.pk)]}, format="json")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(len(preview.data["proposed"]), 1)
        valid.refresh_from_db()
        self.assertIsNone(valid.category_id)
        applied = self.client.post(endpoint, {"item_ids": [str(valid.pk), str(invalid.pk)], "dry_run": False}, format="json")
        self.assertEqual(applied.status_code, 200, applied.data)
        self.assertEqual(applied.data["updated"], [str(valid.pk)])
        self.assertEqual(len(applied.data["errors"]), 1)
        valid.refresh_from_db()
        self.assertEqual(valid.category_id, target.pk)

    def test_configured_depth_limit_rejects_new_level(self):
        CoreCompanySetting.objects.create(company=self.company, configuration={"item_category_max_depth": 2})
        root = self.group()
        child = self.group("CHILD", parent=root)
        self.grant("ITEM_GROUP", "CREATE", "VIEW")
        payload = {"company": str(self.company.pk), "code": "LEAF", "name": "Lá", "parent": str(child.pk), "applicable_types": ["GOODS"]}
        self.assertEqual(self.client.post(self.url, payload, format="json").status_code, 400)
