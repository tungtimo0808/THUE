from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import (
    CompanyMembership, DataScopeBranch, DataScopeSet, DataScopeWarehouse, Permission,
    Role, RolePermission, UserRoleAssignment,
)
from organization.models import Branch, Company

from .models import Currency, CustomerProfile, Party, PartyAddress, PartyContact, PartyRole, UnitOfMeasure, Warehouse


class CurrencyApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="admin", password="test-password", is_staff=True, is_superuser=True
        )

    def test_authentication_is_required(self):
        response = self.client.get("/api/v1/master-data/currencies/")
        self.assertEqual(response.status_code, 401)

    def test_create_currency_normalizes_code(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/v1/master-data/currencies/",
            {"code": "usd", "name": "Đô la Mỹ", "numeric_code": "840", "decimal_places": 2},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(Currency.objects.filter(code="USD").exists())


class MasterDataFixture(TestCase):
    def setUp(self):
        self.currency, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Đồng Việt Nam", "numeric_code": "704"}
        )
        self.company = Company.objects.create(
            code="MDCO", name="MD Company", legal_name="MD Company Ltd", tax_code="0100888888",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HCM", name="Hồ Chí Minh")
        self.admin_auth = get_user_model().objects.create_superuser(
            username="md-admin", email="md-admin@example.com", password="password-123"
        )
        self.admin = self.admin_auth.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.admin, created_by=self.admin
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin_auth)


class MasterDataApiTests(MasterDataFixture):
    def test_party_can_be_customer_and_vendor_without_duplicate_master(self):
        response = self.client.post(
            f"/api/v1/master-data/parties/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "code": "DT001", "name": "Đối tác Một",
                "party_type": "ORGANIZATION", "tax_code": "0312345678",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        party = Party.objects.get(pk=response.data["id"])
        PartyRole.objects.create(party=party, role_type="CUSTOMER", active_from=timezone.localdate())
        PartyRole.objects.create(party=party, role_type="VENDOR", active_from=timezone.localdate())
        self.assertEqual(party.roles.count(), 2)
        self.assertTrue(AuditLog.objects.filter(company=self.company, entity_id=party.id).exists())

    def test_duplicate_party_tax_code_is_rejected(self):
        Party.objects.create(company=self.company, code="DT001", name="Đối tác Một", tax_code="0312345678")
        response = self.client.post(
            f"/api/v1/master-data/parties/?company_id={self.company.id}",
            {"company": str(self.company.id), "code": "DT002", "name": "Đối tác Hai", "tax_code": "0312345678"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_service_cannot_track_inventory(self):
        uom = UnitOfMeasure.objects.create(company=self.company, code="LAN", name="Lần")
        response = self.client.post(
            f"/api/v1/master-data/items/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "base_uom": str(uom.id),
                "code": "DV001", "name": "Dịch vụ", "item_type": "SERVICE",
                "track_inventory": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_master_data_cannot_be_deleted_through_api(self):
        party = Party.objects.create(company=self.company, code="DT001", name="Đối tác Một")
        response = self.client.delete(
            f"/api/v1/master-data/parties/{party.id}/?company_id={self.company.id}"
        )
        self.assertEqual(response.status_code, 405)


class CustomerApiTests(MasterDataFixture):
    def url(self, suffix=""):
        return f"/api/v1/master-data/customers/{suffix}?company_id={self.company.id}"

    def payload(self, **changes):
        data = {
            "company": str(self.company.id), "code": "KH001", "name": "Customer One",
            "party_type": "ORGANIZATION", "legal_name": "Customer One Ltd",
            "tax_code": " 0312345678 ", "branch": str(self.branch.id),
            "addresses": [{"address_type": "REGISTERED", "address_line": "1 Main Street", "country_code": "VN", "is_default": True}],
            "contacts": [{"contact_type": "ACCOUNTING", "contact_name": "An", "email": "an@example.com", "is_default": True}],
            "profile": {"credit_limit": "0.0000", "credit_days": 0},
        }
        data.update(changes)
        return data

    def test_create_customer_saves_aggregate_and_audit(self):
        response = self.client.post(self.url(), self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        party = Party.objects.get(pk=response.data["id"])
        self.assertEqual(party.tax_code, "0312345678")
        self.assertTrue(PartyRole.objects.filter(party=party, role_type="CUSTOMER").exists())
        self.assertEqual(PartyAddress.objects.filter(party=party).count(), 1)
        self.assertEqual(PartyContact.objects.filter(party=party).count(), 1)
        self.assertEqual(CustomerProfile.objects.get(party=party).credit_limit, 0)
        self.assertTrue(AuditLog.objects.filter(entity_id=party.id, action_code="CREATE").exists())

    def test_invalid_child_rolls_back_entire_customer(self):
        response = self.client.post(self.url(), self.payload(contacts=[{"contact_type": "ACCOUNTING", "contact_name": "An", "email": "invalid"}]), format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Party.objects.filter(company=self.company, code="KH001").exists())

    def test_invalid_credit_and_multiple_default_addresses_are_rejected(self):
        negative = self.client.post(self.url(), self.payload(profile={"credit_limit": "-1"}), format="json")
        self.assertEqual(negative.status_code, 400)
        duplicated = self.client.post(self.url(), self.payload(addresses=[
            {"address_type": "REGISTERED", "address_line": "One", "is_default": True},
            {"address_type": "REGISTERED", "address_line": "Two", "is_default": True},
        ]), format="json")
        self.assertEqual(duplicated.status_code, 400)
        self.assertFalse(Party.objects.filter(company=self.company, code="KH001").exists())

    def test_duplicate_lookup_finds_tax_and_contact_only_within_company(self):
        created = self.client.post(self.url(), self.payload(), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        match = self.client.get(self.url("duplicates/") + "&email=an@example.com")
        self.assertEqual(match.status_code, 200, match.data)
        self.assertEqual([item["id"] for item in match.data], [created.data["id"]])
        other = Company.objects.create(code="OTHER", name="Other", legal_name="Other", tax_code="0100999999", accounting_currency=self.currency, legal_reporting_currency=self.currency)
        self.assertEqual(self.client.get(f"/api/v1/master-data/customers/duplicates/?company_id={other.id}&tax_code=0312345678").data, [])

    def test_update_requires_current_version_and_preserves_other_company(self):
        created = self.client.post(self.url(), self.payload(), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        pk = created.data["id"]
        changed = self.client.patch(self.url(f"{pk}/"), {"name": "Updated", "version": 1}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["version"], 2)
        stale = self.client.patch(self.url(f"{pk}/"), {"name": "Stale", "version": 1}, format="json")
        self.assertEqual(stale.status_code, 400)
        self.assertEqual(Party.objects.get(pk=pk).name, "Updated")
        other = Company.objects.create(code="OTHER", name="Other", legal_name="Other", tax_code="0100999999", accounting_currency=self.currency, legal_reporting_currency=self.currency)
        self.assertEqual(self.client.get(f"/api/v1/master-data/customers/{pk}/?company_id={other.id}").status_code, 404)

    def test_status_requires_reason_and_keeps_customer_history(self):
        created = self.client.post(self.url(), self.payload(), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        pk = created.data["id"]
        endpoint = self.url(f"{pk}/set-status/")
        self.assertEqual(self.client.post(endpoint, {"status": "INACTIVE", "version": 1}, format="json").status_code, 400)
        response = self.client.post(endpoint, {"status": "INACTIVE", "version": 1, "reason": "Contract ended"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "INACTIVE")
        self.assertEqual(PartyAddress.objects.filter(party_id=pk).count(), 1)
        self.assertTrue(AuditLog.objects.filter(entity_id=pk, action_code="INACTIVE", reason="Contract ended").exists())

    def test_import_reports_invalid_rows_and_export_contains_saved_customers(self):
        content = f"code,name,party_type,legal_name,tax_code,branch\nKH101,Imported One,ORGANIZATION,Imported One Ltd,0312345678,{self.branch.id}\nKH102,,ORGANIZATION,Imported Two Ltd,0312345679,{self.branch.id}\n".encode()
        upload = SimpleUploadedFile("customers.csv", content, content_type="text/csv")
        response = self.client.post(self.url("import/"), {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["results"][0]["status"], "CREATED")
        self.assertIn("error", response.data["results"][1])
        self.assertEqual(Party.objects.filter(company=self.company, roles__role_type="CUSTOMER").count(), 1)
        exported = self.client.get(self.url("export/"))
        self.assertEqual(exported.status_code, 200)
        self.assertIn(b"KH101", exported.content)
        self.assertNotIn(b"KH102", exported.content)

    def test_branch_scope_limits_list_detail_create_and_update(self):
        other_branch = Branch.objects.create(company=self.company, code="HN", name="Ha Noi")
        allowed = self.client.post(self.url(), self.payload(), format="json")
        self.assertEqual(allowed.status_code, 201, allowed.data)
        hidden = self.client.post(self.url(), self.payload(code="KH002", tax_code="0312345679", branch=str(other_branch.id)), format="json")
        self.assertEqual(hidden.status_code, 201, hidden.data)
        viewer_auth = get_user_model().objects.create_user(username="customer-clerk", password="password-123")
        viewer = viewer_auth.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=viewer, created_by=self.admin)
        role = Role.objects.create(company=self.company, code="CUSTOMER_CLERK", name="Customer clerk")
        for action_code in ("VIEW", "CREATE", "EDIT"):
            RolePermission.objects.create(role=role, permission=Permission.objects.get(code=f"MD.PARTY.{action_code}"))
        scope = DataScopeSet.objects.create(company=self.company, code="CUSTOMER_HCM", name="HCM", created_by=self.admin)
        DataScopeBranch.objects.create(data_scope_set=scope, branch=self.branch)
        UserRoleAssignment.objects.create(company_membership=membership, role=role, data_scope_set=scope, valid_from=timezone.now(), assigned_by=self.admin)
        self.client.force_authenticate(viewer_auth)
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row["id"] for row in response.data], [allowed.data["id"]])
        self.assertEqual(self.client.get(self.url(f'{hidden.data["id"]}/')).status_code, 404)
        legacy_url = f"/api/v1/master-data/parties/{hidden.data['id']}/?company_id={self.company.id}&branch_id={self.branch.id}"
        self.assertEqual(self.client.get(legacy_url).status_code, 404)
        denied = self.client.post(self.url(), self.payload(code="KH003", tax_code="0312345680", branch=str(other_branch.id)), format="json")
        self.assertEqual(denied.status_code, 403)
        self.assertFalse(Party.objects.filter(company=self.company, code="KH003").exists())
        moved = self.client.patch(self.url(f'{allowed.data["id"]}/'), {"version": 1, "branch": str(other_branch.id)}, format="json")
        self.assertEqual(moved.status_code, 403)


class WarehouseScopeTests(MasterDataFixture):
    def test_warehouse_scope_filters_and_authorizes_each_warehouse(self):
        warehouse_a = Warehouse.objects.create(company=self.company, branch=self.branch, code="A", name="Kho A")
        warehouse_b = Warehouse.objects.create(company=self.company, branch=self.branch, code="B", name="Kho B")
        viewer_auth = get_user_model().objects.create_user(username="store-viewer", password="password-123")
        viewer = viewer_auth.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=viewer, created_by=self.admin)
        role = Role.objects.create(company=self.company, code="STORE_VIEWER", name="Xem kho")
        RolePermission.objects.create(role=role, permission=Permission.objects.get(code="MD.WAREHOUSE.VIEW"))
        scope = DataScopeSet.objects.create(company=self.company, code="WAREHOUSE_A", name="Kho A", created_by=self.admin)
        DataScopeWarehouse.objects.create(data_scope_set=scope, warehouse=warehouse_a)
        UserRoleAssignment.objects.create(
            company_membership=membership, role=role, data_scope_set=scope,
            valid_from=timezone.now(), assigned_by=self.admin,
        )
        self.client.force_authenticate(viewer_auth)
        allowed = self.client.get(
            f"/api/v1/master-data/warehouses/?company_id={self.company.id}&warehouse_id={warehouse_a.id}"
        )
        denied = self.client.get(
            f"/api/v1/master-data/warehouses/?company_id={self.company.id}&warehouse_id={warehouse_b.id}"
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(len(allowed.data), 1)
        self.assertEqual(denied.status_code, 403)
