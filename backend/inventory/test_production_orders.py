from django.test import TestCase, override_settings

from common_services.test_company_setup import FounderCompanyMixin
from iam.models import Permission, Role, RolePermission
from master_data.models import Item, UnitOfMeasure


@override_settings(COMMON_REQUIRE_VERIFICATION=False)
class ProductionOrderTests(FounderCompanyMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        role = Role.objects.get(company=self.company, code="COMPANY_ADMIN")
        have = set(role.role_permissions.values_list("permission_id", flat=True))
        RolePermission.objects.bulk_create([RolePermission(role=role, permission=p) for p in Permission.objects.exclude(id__in=have)])
        unit = UnitOfMeasure.objects.filter(company=self.company).first()
        self.product = Item.objects.create(company=self.company, code="TP01", name="Tủ điện", item_type="FINISHED_GOOD", base_uom=unit, status="ACTIVE")
        self.material = Item.objects.create(company=self.company, code="NVL01", name="Thép tấm", item_type="MATERIAL", base_uom=unit, status="ACTIVE")
        self.q = f"?company_id={self.company.pk}"

    def test_order_with_products_and_materials_and_status_change(self):
        created = self.client.post(f"/api/v1/inventory/production-orders/{self.q}", {
            "company": str(self.company.pk), "number": "LSX01", "document_date": "2026-10-01",
            "products": [{"item": str(self.product.pk), "quantity": "10"}], "materials": [{"item": str(self.material.pk)}],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual([line["role"] for line in created.data["lines"]], ["MATERIAL", "PRODUCT"])
        done = self.client.post(f"/api/v1/inventory/production-orders/{created.data['id']}/set-status/{self.q}", {"status": "COMPLETED"}, format="json")
        self.assertEqual(done.data["status"], "COMPLETED")
        again = self.client.post(f"/api/v1/inventory/production-orders/{created.data['id']}/set-status/{self.q}", {"status": "IN_PROGRESS"}, format="json")
        self.assertEqual(again.status_code, 400)

    def test_product_quantity_is_required(self):
        response = self.client.post(f"/api/v1/inventory/production-orders/{self.q}", {
            "company": str(self.company.pk), "number": "LSX02", "document_date": "2026-10-01",
            "products": [{"item": str(self.product.pk)}],
        }, format="json")
        self.assertEqual(response.status_code, 400)
