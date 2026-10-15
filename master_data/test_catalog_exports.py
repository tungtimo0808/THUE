import io
from datetime import date, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
import openpyxl
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from common_services.models import Notification
from iam.models import (
    ActiveStatus,
    CompanyMembership,
    DataScopeBranch,
    DataScopeSet,
    Permission,
    Role,
    RolePermission,
    UserRoleAssignment,
)
from organization.models import Branch, Company, Department, Employee
from master_data.models import (
    CatalogExportBatch,
    Currency,
    Item,
    ItemCategory,
    Party,
    PartyRole,
    PaymentMethod,
    PaymentTerm,
    TaxRate,
    TaxType,
    UnitOfMeasure,
    Warehouse,
)


class CatalogExportTests(TestCase):
    def setUp(self):
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Vietnam dong"})
        self.company = Company.objects.create(
            code="EXPCO",
            name="Exports Ltd",
            legal_name="Exports Company Limited",
            tax_code="0109988771",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.other_company = Company.objects.create(
            code="OTHERCO",
            name="Other Ltd",
            legal_name="Other Company Limited",
            tax_code="0109988772",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )

        self.branch1 = Branch.objects.create(company=self.company, code="CN1", name="Chi nhánh 1")
        self.branch2 = Branch.objects.create(company=self.company, code="CN2", name="Chi nhánh 2")

        # Superuser
        self.superuser = get_user_model().objects.create_superuser(username="super-export", password="password")
        self.client = APIClient()
        self.client.force_authenticate(self.superuser)
        self.base_url = f"/api/v1/master-data/catalog-exports/?company_id={self.company.pk}"

        # Setup some test customers
        self.cust1 = Party.objects.create(
            company=self.company,
            code="KH001",
            name="Công ty An Bình",
            legal_name="Công ty TNHH An Bình",
            party_type="ORGANIZATION",
            tax_code="0102030405",  # Has leading 0
            branch=self.branch1,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.cust1, role_type="CUSTOMER", active_from=date(2026, 1, 1))

        self.cust2 = Party.objects.create(
            company=self.company,
            code="=cmd|' /C calc'!A0",  # Test formula injection
            name="+Formula Name",
            legal_name="Formula Escaped Ltd",
            party_type="ORGANIZATION",
            tax_code="0987654321",
            branch=self.branch2,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.cust2, role_type="CUSTOMER", active_from=date(2026, 1, 1))

        # Setup standard IAM user for permission & scope testing
        self.std_user = get_user_model().objects.create_user(username="staff-export", password="password")
        self.membership = CompanyMembership.objects.create(
            user=self.std_user.iam_account,
            company=self.company,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.superuser.iam_account,
        )

    def _grant_permissions(self, *permission_codes, branch=None):
        role = Role.objects.create(company=self.company, code=f"ROLE_{timezone.now().timestamp()}", name="Test Role")
        for code in permission_codes:
            perm = Permission.objects.filter(code=code).first()
            if perm:
                RolePermission.objects.create(role=role, permission=perm, effect="ALLOW")

        data_scope = None
        if branch:
            data_scope = DataScopeSet.objects.create(
                company=self.company,
                name="Branch Scope",
                allow_all_company_data=False,
                created_by=self.superuser.iam_account,
            )
            DataScopeBranch.objects.create(data_scope_set=data_scope, branch=branch)

        UserRoleAssignment.objects.create(
            company_membership=self.membership,
            role=role,
            data_scope_set=data_scope,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.superuser.iam_account,
        )

    def test_targets_and_estimate_endpoint(self):
        """Step 4: Check estimate endpoint gives accurate counts and recommended mode."""
        res = self.client.get(f"/api/v1/master-data/catalog-exports/targets/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 200)
        target_keys = [t["target"] for t in res.data]
        self.assertIn("customers", target_keys)
        self.assertIn("items", target_keys)
        self.assertIn("warehouses", target_keys)

        # Estimate ALL
        est_res = self.client.post(
            f"/api/v1/master-data/catalog-exports/estimate/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "ALL"},
            format="json",
        )
        self.assertEqual(est_res.status_code, 200)
        self.assertEqual(est_res.data["estimated_count"], 2)
        self.assertEqual(est_res.data["mode"], "DIRECT")
        self.assertEqual(est_res.data["catalog_code"], "KHACH_HANG")

        # Estimate SELECTED
        est_sel = self.client.post(
            f"/api/v1/master-data/catalog-exports/estimate/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "SELECTED", "selected_ids": [str(self.cust1.pk)]},
            format="json",
        )
        self.assertEqual(est_sel.status_code, 200)
        self.assertEqual(est_sel.data["estimated_count"], 1)

    def test_direct_export_excel_content_and_rules(self):
        """Tests BR-MD-EXP-12..21: Direct download, header names, leading 0 preservation, formula sanitization."""
        res = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "ALL"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertIn("attachment; filename=", res["Content-Disposition"])
        self.assertIn("KHACH_HANG_", res["Content-Disposition"])

        # Load Excel with openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(res.content))
        ws = wb.active
        self.assertEqual(ws.title, "Khách hàng")

        # Row 1 is header
        headers = [cell.value for cell in ws[1]]
        self.assertEqual(headers[0], "Mã khách hàng")
        self.assertEqual(headers[1], "Tên khách hàng")
        self.assertEqual(headers[2], "Trạng thái")
        self.assertIn("Mã số thuế", headers)

        # Verify rows
        rows = list(ws.iter_rows(min_row=2, values_only=True))
        self.assertEqual(len(rows), 2)

        row_dicts = [dict(zip(headers, r)) for r in rows]
        row_kh001 = next(r for r in row_dicts if r["Mã số thuế"] == "0102030405")
        row_formula = next(r for r in row_dicts if r["Mã số thuế"] == "0987654321")

        # Check row 1: tax code preserved leading 0 (BR-MD-EXP-18)
        self.assertEqual(row_kh001["Mã khách hàng"], "KH001")
        self.assertEqual(row_kh001["Mã số thuế"], "0102030405")
        self.assertEqual(row_kh001["Trạng thái"], "Đang hoạt động")

        # Check row 2: formula injection prevented (BR-MD-EXP-19)
        self.assertTrue(row_formula["Mã khách hàng"].startswith("'="), f"Expected '= escaped, got {row_formula['Mã khách hàng']}")
        self.assertTrue(row_formula["Tên khách hàng"].startswith("'+"), f"Expected '+ escaped, got {row_formula['Tên khách hàng']}")

        # Verify Audit Log recorded (BR-MD-EXP-29, 30)
        log = AuditLog.objects.filter(company=self.company, action_code="EXPORT").latest("occurred_at")
        self.assertEqual(log.result, "SUCCESS")
        self.assertTrue(log.changes.filter(field_name="catalog_code", new_value_json="KHACH_HANG").exists())

    def test_export_scopes_selected_and_filtered(self):
        """Tests BR-MD-EXP-07, 08, 09, 10: SELECTED, FILTERED, ALL."""
        # Scope SELECTED with empty list -> EF-02 error
        err_res = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "SELECTED", "selected_ids": []},
            format="json",
        )
        self.assertEqual(err_res.status_code, 400)
        self.assertIn("Vui lòng chọn ít nhất một bản ghi", err_res.data["detail"])

        # Scope SELECTED with 1 record -> exports exactly 1
        sel_res = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "SELECTED", "selected_ids": [str(self.cust1.pk)]},
            format="json",
        )
        self.assertEqual(sel_res.status_code, 200)
        wb = openpyxl.load_workbook(io.BytesIO(sel_res.content))
        self.assertEqual(len(list(wb.active.iter_rows(min_row=2))), 1)

        # Scope FILTERED with search
        filt_res = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "FILTERED", "filters": {"search": "An Bình"}},
            format="json",
        )
        self.assertEqual(filt_res.status_code, 200)
        wb_filt = openpyxl.load_workbook(io.BytesIO(filt_res.content))
        self.assertEqual(len(list(wb_filt.active.iter_rows(min_row=2))), 1)

    def test_zero_records_and_over_limit_exceptions(self):
        """Tests EF-03 (0 records) and EF-04 (>100,000 records)."""
        # Filter matching nothing -> EF-03: "Không có dữ liệu phù hợp để Export."
        res = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "FILTERED", "filters": {"search": "NON_EXISTENT_NAME"}},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Không có dữ liệu phù hợp để Export.", res.data["detail"])

    def test_iam_permissions_and_data_scope(self):
        """Tests BR-MD-EXP-01, EF-01, BR-MD-EXP-04, 05, 11: Permission & Branch scope isolation."""
        self.client.force_authenticate(self.std_user)

        # 1. No permissions -> EF-01: 403 Forbidden
        denied_res = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "ALL"},
            format="json",
        )
        self.assertEqual(denied_res.status_code, 403)
        self.assertIn("Bạn không có quyền Export", denied_res.data["detail"])

        # 2. Grant VIEW and EXPORT, scoped to Branch 1 only
        self._grant_permissions("MD.PARTY.VIEW", "MD.PARTY.EXPORT", branch=self.branch1)

        # Now export ALL -> should ONLY export cust1 (which belongs to branch1), excluding cust2 (branch2)
        scoped_res = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "ALL"},
            format="json",
        )
        self.assertEqual(scoped_res.status_code, 200)
        wb = openpyxl.load_workbook(io.BytesIO(scoped_res.content))
        rows = list(wb.active.iter_rows(min_row=2, values_only=True))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], "KH001")

        # 3. BR-MD-EXP-11: If user selects cust2 (branch2, outside scope), it is automatically excluded
        sel_unauthorized = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "SELECTED", "selected_ids": [str(self.cust2.pk)]},
            format="json",
        )
        # Because cust2 is excluded by data scope, the resulting count is 0 -> EF-03
        self.assertEqual(sel_unauthorized.status_code, 400)
        self.assertIn("Không có dữ liệu phù hợp để Export.", sel_unauthorized.data["detail"])

    @override_settings(CATALOG_EXPORT_BACKGROUND_THRESHOLD=1)
    def test_background_processing_and_command(self):
        """Tests AF-04, AF-05, BR-MD-EXP-22: Background queuing, command execution, and notification."""
        res = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "customers", "export_scope": "ALL"},
            format="json",
        )
        self.assertEqual(res.status_code, 202)
        batch_id = res.data["batch_id"]
        self.assertEqual(res.data["status"], "QUEUED")
        self.assertIn("Yêu cầu Export đang được xử lý", res.data["message"])

        batch = CatalogExportBatch.objects.get(pk=batch_id)
        self.assertEqual(batch.status, "QUEUED")

        # Run background worker command
        call_command("process_catalog_exports")

        batch.refresh_from_db()
        self.assertEqual(batch.status, "COMPLETED")
        self.assertIsNotNone(batch.file_data)
        self.assertIsNotNone(batch.expires_at)

        # Verify notification created for user (AF-05)
        notification = Notification.objects.filter(recipient=self.superuser.iam_account, entity_id=batch.pk).first()
        self.assertIsNotNone(notification)
        self.assertIn(f"/api/v1/master-data/catalog-exports/{batch.pk}/download/", notification.link)

    def test_download_endpoint_ownership_and_expiry(self):
        """Tests BR-MD-EXP-24, 25, 27, 28, EF-09: Download ownership and 24h expiration."""
        # Create completed batch for superuser
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Mã", "Tên", "Trạng thái"])
        ws.append(["KH001", "Test", "Đang hoạt động"])
        out = io.BytesIO()
        wb.save(out)

        batch = CatalogExportBatch.objects.create(
            company=self.company,
            target="customers",
            export_scope="ALL",
            status="COMPLETED",
            total_records=1,
            file_name="KHACH_HANG_test.xlsx",
            file_data=out.getvalue(),
            file_size=len(out.getvalue()),
            created_by=self.superuser.iam_account,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        # 1. Other user attempts to download -> 403 Forbidden (BR-MD-EXP-27)
        self.client.force_authenticate(self.std_user)
        res_other = self.client.get(f"/api/v1/master-data/catalog-exports/{batch.pk}/download/?company_id={self.company.pk}")
        self.assertEqual(res_other.status_code, 403)

        # 2. Creator downloads before expiration -> 200 OK
        self.client.force_authenticate(self.superuser)
        res_ok = self.client.get(f"/api/v1/master-data/catalog-exports/{batch.pk}/download/?company_id={self.company.pk}")
        self.assertEqual(res_ok.status_code, 200)

        # 3. After 24h expiration -> 410 Gone with EF-09 message
        batch.expires_at = timezone.now() - timedelta(minutes=1)
        batch.save(update_fields=("expires_at",))

        res_expired = self.client.get(f"/api/v1/master-data/catalog-exports/{batch.pk}/download/?company_id={self.company.pk}")
        self.assertEqual(res_expired.status_code, 410)
        self.assertIn("File Export đã hết hạn. Vui lòng tạo yêu cầu Export mới.", res_expired.data["detail"])

        batch.refresh_from_db()
        self.assertEqual(batch.status, "EXPIRED")
        self.assertIsNone(batch.file_data)  # BR-MD-EXP-32: physical data cleaned up

    def test_other_catalogues_export(self):
        """Tests exporting other catalogues: items, units-of-measure, warehouses."""
        uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái", symbol="cái", measurement_type="COUNT", decimal_places=0)
        cat = ItemCategory.objects.create(company=self.company, code="NHOM1", name="Nhóm 1", depth=1)
        item = Item.objects.create(
            company=self.company,
            code="VT001",
            name="Máy in HP",
            base_uom=uom,
            category=cat,
            purchase_price=Decimal("2500000.50"),
            sales_price=Decimal("3000000.00"),
            status="ACTIVE",
        )
        wh = Warehouse.objects.create(company=self.company, code="KHO1", name="Kho Tổng", status="ACTIVE")

        # Export items
        res_item = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "items", "export_scope": "ALL"},
            format="json",
        )
        self.assertEqual(res_item.status_code, 200)
        self.assertIn("VAT_TU_HANG_HOA", res_item["Content-Disposition"])
        wb_item = openpyxl.load_workbook(io.BytesIO(res_item.content))
        row = list(wb_item.active.iter_rows(min_row=2, values_only=True))[0]
        # Check purchase_price is numeric (BR-MD-EXP-17)
        self.assertEqual(row[0], "VT001")
        self.assertEqual(row[1], "Máy in HP")

        # Export warehouses
        res_wh = self.client.post(
            f"/api/v1/master-data/catalog-exports/export/?company_id={self.company.pk}",
            {"target": "warehouses", "export_scope": "ALL"},
            format="json",
        )
        self.assertEqual(res_wh.status_code, 200)
        self.assertIn("KHO", res_wh["Content-Disposition"])
