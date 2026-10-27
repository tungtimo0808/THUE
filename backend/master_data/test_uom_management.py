from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from organization.models import Company
from .models import Currency, Item, UnitOfMeasure, fixed_uom_factor, validate_uom_quantity


class UnitOfMeasureManagementTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(code="UOM_A", name="A", legal_name="A", tax_code="0666000001", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.other = Company.objects.create(code="UOM_B", name="B", legal_name="B", tax_code="0666000002", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        auth = get_user_model().objects.create_user(username="uom-editor", password="test")
        self.account = auth.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=self.account, created_by=self.account)
        self.role = Role.objects.create(company=self.company, code="UOM_EDITOR", name="Quản lý đơn vị tính")
        UserRoleAssignment.objects.create(company_membership=membership, role=self.role, assigned_by=self.account)
        self.client = APIClient()
        self.client.force_authenticate(auth)
        self.url = "/api/v1/master-data/units-of-measure/"

    def grant(self, *actions):
        for action in actions:
            RolePermission.objects.get_or_create(role=self.role, permission=Permission.objects.get(code=f"MD.UOM.{action}"), defaults={"effect": "ALLOW"})

    def payload(self, **overrides):
        return {"company": str(self.company.pk), "code": "KG", "name": "Kilôgam", "symbol": "kg", "measurement_type": "WEIGHT", "decimal_places": 3, **overrides}

    def test_create_requires_permission_and_explicit_fields(self):
        self.assertEqual(self.client.post(self.url, self.payload(), format="json").status_code, 403)
        self.grant("CREATE")
        self.assertEqual(self.client.post(self.url, {"company": str(self.company.pk), "code": "KG", "name": "Kilôgam"}, format="json").status_code, 400)
        created = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(AuditLog.objects.filter(entity_id=created.data["id"], action_code="UOM_CREATE").exists())

    def test_fixed_conversion_requires_same_group_and_one_reference(self):
        self.grant("CREATE")
        gram = self.client.post(self.url, self.payload(code="G", name="Gam", symbol="g", is_reference=True, factor_to_reference="1"), format="json")
        self.assertEqual(gram.status_code, 201, gram.data)
        kilogram = self.client.post(self.url, self.payload(reference_uom=gram.data["id"], factor_to_reference="1000"), format="json")
        self.assertEqual(kilogram.status_code, 201, kilogram.data)
        self.assertEqual(fixed_uom_factor(UnitOfMeasure.objects.get(pk=kilogram.data["id"]), UnitOfMeasure.objects.get(pk=gram.data["id"])), Decimal("1000"))
        duplicate = self.client.post(self.url, self.payload(code="G2", name="Gam 2", symbol="g2", is_reference=True, factor_to_reference="1"), format="json")
        self.assertEqual(duplicate.status_code, 400)
        cross = self.client.post(self.url, self.payload(code="M", name="Mét", symbol="m", measurement_type="LENGTH", reference_uom=gram.data["id"], factor_to_reference="2"), format="json")
        self.assertEqual(cross.status_code, 400)

    def test_integer_only_and_decimal_precision(self):
        unit = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái", symbol="cái", measurement_type="COUNT", decimal_places=0, integer_only=True)
        validate_uom_quantity(unit, Decimal("2"))
        with self.assertRaises(ValidationError):
            validate_uom_quantity(unit, Decimal("2.5"))

    def test_inventory_uses_fixed_physical_conversion(self):
        from inventory.serializers import TransactionSerializer

        gram = UnitOfMeasure.objects.create(company=self.company, code="G", name="Gam", symbol="g", measurement_type="WEIGHT", decimal_places=0, is_reference=True, factor_to_reference=1)
        kilogram = UnitOfMeasure.objects.create(company=self.company, code="KG", name="Kilôgam", symbol="kg", measurement_type="WEIGHT", decimal_places=3, reference_uom=gram, factor_to_reference=1000)
        item = Item.objects.create(company=self.company, code="HH001", name="A", item_type="GOODS", base_uom=gram)
        prepared = TransactionSerializer()._prepare_line(self.company, {"item": item, "uom": kilogram, "quantity": Decimal("1.25")})
        self.assertEqual(prepared["conversion_factor"], Decimal("1000"))
        self.assertEqual(prepared["base_quantity"], Decimal("1250"))

    def test_status_and_delete_protect_used_unit(self):
        unit = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái", symbol="cái", measurement_type="COUNT", decimal_places=0, integer_only=True)
        Item.objects.create(company=self.company, code="HH001", name="A", item_type="GOODS", base_uom=unit)
        self.grant("VIEW", "DEACTIVATE", "DELETE")
        endpoint = f"{self.url}{unit.pk}/change-status/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(endpoint, {"status": "INACTIVE", "version": unit.updated_at.isoformat()}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(f"{self.url}{unit.pk}/?company_id={self.company.pk}").status_code, 400)
        empty = UnitOfMeasure.objects.create(company=self.company, code="HOP", name="Hộp", symbol="hộp", measurement_type="COUNT")
        self.assertEqual(self.client.delete(f"{self.url}{empty.pk}/?company_id={self.company.pk}").status_code, 204)

    def test_update_requires_current_version_and_keeps_company(self):
        unit = UnitOfMeasure.objects.create(company=self.company, code="KG", name="Kilôgam", symbol="kg", measurement_type="WEIGHT")
        self.grant("VIEW", "EDIT")
        endpoint = f"{self.url}{unit.pk}/?company_id={self.company.pk}"
        self.assertEqual(self.client.patch(endpoint, {"name": "Kg mới", "version": "2020-01-01T00:00:00Z"}, format="json").status_code, 409)
        self.assertIn(self.client.patch(endpoint, {"company": str(self.other.pk), "version": unit.updated_at.isoformat()}, format="json").status_code, (400, 403))
        updated = self.client.patch(endpoint, {"name": "Kg mới", "version": unit.updated_at.isoformat()}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)

    def test_import_reference_first_and_export_factor(self):
        self.grant("IMPORT", "EXPORT")
        file = SimpleUploadedFile("uom.csv", b"code,name,symbol,measurement_type,decimal_places,is_reference,reference_code,factor_to_reference\nG,Gam,g,WEIGHT,0,true,,1\nKG,Kilogram,kg,WEIGHT,3,false,G,1000\nBAD,Bad,bad,LENGTH,2,false,G,2\n", content_type="text/csv")
        imported = self.client.post(f"{self.url}import-csv/", {"company": str(self.company.pk), "file": file}, format="multipart")
        self.assertEqual(imported.status_code, 200, imported.data)
        self.assertEqual(len(imported.data["created"]), 2)
        self.assertEqual(imported.data["errors"][0]["row"], 4)
        exported = self.client.get(f"{self.url}export-csv/", {"company_id": str(self.company.pk)})
        self.assertEqual(exported.status_code, 200)
        self.assertIn(b"KG", exported.content)
        self.assertIn(b"1000", exported.content)

    def test_import_cannot_use_permission_from_another_company(self):
        self.grant("IMPORT")
        file = SimpleUploadedFile("uom.csv", b"code,name,symbol,measurement_type,decimal_places\nM,Met,m,LENGTH,2\n", content_type="text/csv")
        response = self.client.post(f"{self.url}import-csv/?company_id={self.company.pk}", {"company": str(self.other.pk), "file": file}, format="multipart")
        self.assertIn(response.status_code, (400, 403), response.data)
        self.assertFalse(UnitOfMeasure.objects.filter(company=self.other, code="M").exists())
