import csv
import io

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from iam.models import CompanyMembership, DataScopeBranch, DataScopeSet, Permission, Role, RolePermission, UserRoleAssignment
from common_services.models import Notification

from organization.models import Branch, Company, Employee
from .models import CatalogImportBatch, CostCenter, Currency, Item, Party, PaymentMethod, TaxRate, TaxType, UnitOfMeasure
from general_ledger.models import Account, ChartOfAccounts


class CatalogImportTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Vietnam dong"})
        self.company = Company.objects.create(code="IMPCO", name="Imports", legal_name="Imports Ltd", tax_code="88990001",
                                              accounting_currency=currency, legal_reporting_currency=currency)
        self.other = Company.objects.create(code="OTHERIMP", name="Other", legal_name="Other Ltd", tax_code="88990002",
                                            accounting_currency=currency, legal_reporting_currency=currency)
        self.user = get_user_model().objects.create_superuser(username="import-admin", password="password")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.base = f"/api/v1/master-data/catalog-imports/?company_id={self.company.pk}"

    def upload(self, target, content, **options):
        file = SimpleUploadedFile("input.csv", content.encode(), content_type="text/csv")
        response = self.client.post(self.base.replace("/?", "/upload/?"), {"target": target, "file": file, **options})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def endpoint(self, batch_id, action):
        return f"/api/v1/master-data/catalog-imports/{batch_id}/{action}/?company_id={self.company.pk}"

    def test_preview_confirm_parents_and_business_code(self):
        batch_id = self.upload("cost-centers", "code,name,parent\nCHILD,Child,PARENT\nPARENT,Parent,\n")
        preview = self.client.post(self.endpoint(batch_id, "preview"), {"mapping": {"code": "code", "name": "name", "parent": "parent"}}, format="json")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["status"], "READY")
        self.assertFalse(CostCenter.objects.filter(company=self.company).exists())
        confirmed = self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json")
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(confirmed.data["created_rows"], 2)
        self.assertEqual(CostCenter.objects.get(code="CHILD").parent.code, "PARENT")
        self.assertEqual(self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json").status_code, 400)

    def test_atomic_partial_duplicate_and_change_since_preview(self):
        batch_id = self.upload("payment-methods", "code,name,group,scope,requires_reference,requires_bank_account,supports_auto_reconcile\n"
            "A,First,CASH,BOTH,false,false,false\nB,Bad,BANK,WRONG,false,false,false\n", error_mode="ATOMIC")
        mapping = {name: name for name in ("code", "name", "group", "scope", "requires_reference", "requires_bank_account", "supports_auto_reconcile")}
        preview = self.client.post(self.endpoint(batch_id, "preview"), {"mapping": mapping}, format="json")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["status"], "ERROR")
        self.assertEqual(preview.data["error_rows"], 1)
        self.assertEqual(self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json").status_code, 400)
        self.assertEqual(PaymentMethod.objects.count(), 0)
        partial_id = self.upload("payment-methods", "code,name,group,scope,requires_reference,requires_bank_account,supports_auto_reconcile\n"
            "A,First,CASH,BOTH,false,false,false\nB,Bad,BANK,WRONG,false,false,false\n", error_mode="PARTIAL")
        self.client.post(self.endpoint(partial_id, "preview"), {"mapping": mapping}, format="json")
        result = self.client.post(self.endpoint(partial_id, "confirm"), {}, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["status"], "PARTIAL")
        self.assertEqual(result.data["created_rows"], 1)
        self.assertEqual(result.data["error_rows"], 1)
        self.assertEqual(PaymentMethod.objects.count(), 1)
        stale_id = self.upload("payment-methods", "code,name,group,scope,requires_reference,requires_bank_account,supports_auto_reconcile\n"
            "C,Third,CASH,BOTH,false,false,false\n")
        self.client.post(self.endpoint(stale_id, "preview"), {"mapping": mapping}, format="json")
        PaymentMethod.objects.create(company=self.company, code="C", name="Concurrent", group="CASH", scope="BOTH")
        self.assertEqual(self.client.post(self.endpoint(stale_id, "confirm"), {}, format="json").status_code, 400)
        self.assertEqual(CatalogImportBatch.objects.get(pk=stale_id).status, "READY")

    def test_reject_company_and_system_columns(self):
        file = SimpleUploadedFile("input.csv", b"company,code,name\nignored,A,Name\n", content_type="text/csv")
        result = self.client.post(self.base.replace("/?", "/upload/?"), {"target": "cost-centers", "file": file})
        self.assertEqual(result.status_code, 400)
        batch_id = self.upload("cost-centers", "code,name\nA,First\n")
        self.assertEqual(self.client.get(f"/api/v1/master-data/catalog-imports/{batch_id}/?company_id={self.other.pk}").status_code, 400)

    @override_settings(CATALOG_IMPORT_BACKGROUND_ROWS=1)
    def test_xlsx_queued_worker_and_result_download(self):
        from openpyxl import Workbook
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["code", "name"])
        sheet.append(["XLS", "From Excel"])
        data = io.BytesIO()
        workbook.save(data)
        upload = SimpleUploadedFile("input.xlsx", data.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response = self.client.post(self.base.replace("/?", "/upload/?"), {"target": "cost-centers", "file": upload})
        self.assertEqual(response.status_code, 201, response.data)
        batch_id = response.data["id"]
        self.assertEqual(self.client.post(self.endpoint(batch_id, "preview"), {}, format="json").data["status"], "READY")
        queued = self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json")
        self.assertEqual(queued.status_code, 202, queued.data)
        self.assertFalse(CostCenter.objects.filter(code="XLS").exists())
        call_command("process_catalog_imports", limit=1)
        self.assertEqual(CatalogImportBatch.objects.get(pk=batch_id).status, "COMPLETED")
        self.assertTrue(CostCenter.objects.filter(code="XLS").exists())
        self.assertTrue(Notification.objects.filter(recipient=self.user.iam_account, entity_id=batch_id).exists())
        result = self.client.get(self.endpoint(batch_id, "results.csv"))
        self.assertEqual(result.status_code, 200)
        self.assertIn(b"CREATED", result.content)

    def test_update_detects_unversioned_change_and_import_permission(self):
        existing = CostCenter.objects.create(company=self.company, code="C1", name="Old")
        batch_id = self.upload("cost-centers", "code,name\nC1,New\n", duplicate_mode="UPDATE")
        preview = self.client.post(self.endpoint(batch_id, "preview"), {}, format="json")
        self.assertEqual(preview.data["status"], "READY")
        existing.name = "Concurrent"
        existing.save(update_fields=("name",))
        self.assertEqual(self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json").status_code, 400)
        self.assertEqual(CostCenter.objects.get(pk=existing.pk).name, "Concurrent")
        self.client.post(self.endpoint(batch_id, "preview"), {}, format="json")
        confirmed = self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json")
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(CostCenter.objects.get(pk=existing.pk).name, "New")
        ordinary = get_user_model().objects.create_user(username="import-ordinary", password="password")
        CompanyMembership.objects.create(company=self.company, user=ordinary.iam_account, created_by=self.user.iam_account)
        self.client.force_authenticate(ordinary)
        self.assertEqual(self.client.get(self.base.replace("/?", "/targets/?")).data, [])
        file = SimpleUploadedFile("input.csv", b"code,name\nN,Name\n", content_type="text/csv")
        self.assertEqual(self.client.post(self.base.replace("/?", "/upload/?"), {"target": "cost-centers", "file": file}).status_code, 403)

    def test_party_employee_and_item_reference_codes(self):
        branch = Branch.objects.create(company=self.company, code="HQ", name="Head office")
        for target, content in (
            ("customers", "code,name\nCUS1,Customer one\n"),
            ("suppliers", "code,name\nSUP1,Supplier one\n"),
            ("employees", "employee_code,full_name,branch\nEMP1,Employee one,HQ\n"),
            ("units-of-measure", "code,name,symbol,measurement_type,decimal_places\nPCS,Piece,pcs,COUNT,0\n"),
            ("items", "code,name,item_type,base_uom,track_inventory\nSERV1,Service one,SERVICE,PCS,false\n"),
        ):
            batch_id = self.upload(target, content)
            preview = self.client.post(self.endpoint(batch_id, "preview"), {}, format="json")
            self.assertEqual(preview.data["status"], "READY", preview.data)
            confirmed = self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json")
            self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertTrue(Party.objects.get(code="CUS1").roles.filter(role_type="CUSTOMER").exists())
        self.assertTrue(Party.objects.get(code="SUP1").roles.filter(role_type="VENDOR").exists())
        self.assertEqual(Employee.objects.get(employee_code="EMP1").branch, branch)
        self.assertEqual(Item.objects.get(code="SERV1").base_uom, UnitOfMeasure.objects.get(code="PCS"))

    def test_account_and_tax_catalogues_resolve_reference_codes(self):
        ChartOfAccounts.objects.create(company=self.company, code="CHART", name="Main chart", effective_from="2026-01-01")
        cases = (
            ("accounts", "code,name,chart_of_accounts\n111,Cash,CHART\n"),
            ("tax-types", "code,name,scope,calculation_method\nVAT,Value added tax,BOTH,PERCENT\n"),
            ("tax-rates", "code,name,tax_type_ref,effective_from,rate_percent\nVAT10,Ten percent,VAT,2026-01-01,10\n"),
        )
        for target, content in cases:
            batch_id = self.upload(target, content)
            preview = self.client.post(self.endpoint(batch_id, "preview"), {}, format="json")
            self.assertEqual(preview.data["status"], "READY", preview.data)
            confirmed = self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json")
            self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(Account.objects.get(code="111").chart_of_accounts.code, "CHART")
        self.assertEqual(TaxType.objects.get(code="VAT").company, self.company)
        self.assertEqual(TaxRate.objects.get(code="VAT10").tax_type_ref.code, "VAT")

    def test_branch_scoped_import_only_accepts_allowed_rows(self):
        allowed = Branch.objects.create(company=self.company, code="A", name="Allowed")
        Branch.objects.create(company=self.company, code="B", name="Blocked")
        ordinary = get_user_model().objects.create_user(username="branch-importer", password="password")
        membership = CompanyMembership.objects.create(company=self.company, user=ordinary.iam_account, created_by=self.user.iam_account)
        role = Role.objects.create(company=self.company, code="EMP_IMPORT", name="Employee importer")
        RolePermission.objects.create(role=role, permission=Permission.objects.get(code="MD.EMPLOYEE.IMPORT"))
        scope = DataScopeSet.objects.create(company=self.company, code="A_SCOPE", name="A scope", created_by=self.user.iam_account)
        DataScopeBranch.objects.create(data_scope_set=scope, branch=allowed)
        UserRoleAssignment.objects.create(company_membership=membership, role=role, data_scope_set=scope,
            valid_from=timezone.now() - timedelta(minutes=1), assigned_by=self.user.iam_account)
        self.client.force_authenticate(ordinary)
        batch_id = self.upload("employees", "employee_code,full_name,branch\nE1,Allowed employee,A\nE2,Blocked employee,B\n", error_mode="PARTIAL")
        preview = self.client.post(self.endpoint(batch_id, "preview"), {}, format="json")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["error_rows"], 1)
        confirmed = self.client.post(self.endpoint(batch_id, "confirm"), {}, format="json")
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertTrue(Employee.objects.filter(employee_code="E1").exists())
        self.assertFalse(Employee.objects.filter(employee_code="E2").exists())
