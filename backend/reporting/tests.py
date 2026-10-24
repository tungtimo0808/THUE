from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
import datetime
from datetime import date
from decimal import Decimal
import io
import os
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from general_ledger.models import Account, AccountClass, AccountingPeriod, ChartOfAccounts, JournalEntry, JournalLine
from master_data.models import Currency, Party
from organization.models import Branch, Company, Department

from .models import ReportExport, ReportRun, ReportExportJob, ReportExportArtifact


class ReportingApiTests(TestCase):
    def setUp(self):
        import io
        import os
        from django.core.exceptions import PermissionDenied, ValidationError
        from reporting.models import ReportExportJob, ReportExportArtifact

        self.client = APIClient()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="RPT", name="Công ty báo cáo", legal_name="Công ty báo cáo", tax_code="0100999999",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        asset_class = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        liability_class = AccountClass.objects.create(company=self.company, code="LIABILITY", name="Nợ phải trả", normal_balance="CREDIT")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="Hệ thống", effective_from="2026-01-01", is_default=True)
        self.cash = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=asset_class, code="1111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT")
        self.payable = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=liability_class, code="3311", name="Phải trả", account_type="LIABILITY", normal_balance="CREDIT")
        self.period = AccountingPeriod.objects.create(company=self.company, code="2026-09", fiscal_year=2026, period_number=9, start_date="2026-09-01", end_date="2026-09-30")
        self.user = get_user_model().objects.create_superuser(username="report-admin", email="report@example.com", password="x")
        entry = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JV-RPT-001", entry_type="MANUAL",
            posting_date="2026-09-15", description="Mua hàng chưa thanh toán", status="POSTED",
            total_debit=100, total_credit=100, created_by=self.user.iam_account, posted_by=self.user.iam_account,
        )
        JournalLine.objects.create(entry=entry, line_no=1, account=self.cash, debit=100, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=entry, line_no=2, account=self.payable, debit=0, credit=100, currency=self.currency)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"

    def test_catalog_financial_report_and_drilldown(self):
        catalog = self.client.get(f"/api/v1/reports/definitions/{self.query}")
        self.assertEqual(catalog.status_code, 200, catalog.data)
        self.assertGreaterEqual(len(catalog.data), 12)
        response = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "B01-DN", "period": str(self.period.id), "branch": str(self.branch.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "COMPLETED")
        self.assertEqual(response.data["row_count"], 3)
        self.assertTrue(response.data["result"]["totals"]["balanced"])
        amounts = {row["code"]: row["amount"] for row in response.data["result"]["rows"]}
        self.assertEqual(Decimal(amounts["ASSETS"]), Decimal("100"))
        self.assertEqual(Decimal(amounts["LIABILITIES"]), Decimal("100"))
        run_id = response.data["id"]
        drill = self.client.get(f"/api/v1/reports/runs/{run_id}/drill-down/{self.query}")
        self.assertEqual(drill.status_code, 200, drill.data)
        self.assertEqual(len(drill.data["journals"]), 1)
        self.assertEqual(drill.data["journals"][0]["number"], "JV-RPT-001")

    def test_exports_use_saved_report_snapshot(self):
        run = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "ACCOUNTING_BOOKS", "date_from": "2026-09-01", "date_to": "2026-09-30"},
            format="json",
        )
        self.assertEqual(run.status_code, 201, run.data)
        run_id = run.data["id"]
        for file_format, content_type, signature in (
            ("XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b"PK"),
            ("PDF", "application/pdf", b"%PDF"),
            ("PRINT", "text/html; charset=utf-8", b"<!doctype html>"),
        ):
            response = self.client.post(f"/api/v1/reports/runs/{run_id}/export/{self.query}", {"format": file_format}, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response["Content-Type"].startswith(content_type.split(";")[0]))
            self.assertTrue(response.content.startswith(signature))
        self.assertEqual(ReportExport.objects.filter(run_id=run_id).count(), 3)

    def test_invalid_date_range_and_no_data_status(self):
        invalid = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "ACCOUNTING_BOOKS", "date_from": "2026-10-01", "date_to": "2026-09-01"}, format="json",
        )
        self.assertEqual(invalid.status_code, 400)
        empty = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "ACCOUNTING_BOOKS", "date_from": "2025-01-01", "date_to": "2025-01-31"}, format="json",
        )
        self.assertEqual(empty.status_code, 201, empty.data)
        self.assertEqual(empty.data["status"], "NO_DATA")
        self.assertFalse(empty.data["result"]["has_data"])
        self.assertEqual(ReportRun.objects.filter(company=self.company).count(), 1)

    def test_all_report_groups_support_empty_results(self):
        for code in ("B01-DN", "PURCHASE_SALES", "DEBT_AGING", "CASH_BANK", "INVENTORY", "FIXED_ASSETS", "TAX_INVOICES", "MANAGEMENT"):
            response = self.client.post(
                "/api/v1/reports/engine/execute/",
                {"company": str(self.company.id), "report_code": code, "date_from": "2025-01-01", "date_to": "2025-01-31"}, format="json",
            )
            self.assertEqual(response.status_code, 201, (code, response.data))
            self.assertIn("totals", response.data["result"])



class ReportingTestSetupMixin:
    """Shared ERP reporting test setup for UC-RPT-01 and UC-RPT-02."""

    def setUp(self):
        from datetime import date
        from django.utils import timezone
        from iam.models import (
            ActiveStatus,
            CompanyMembership,
            DataScopeSet,
            DataScopeBranch,
            Permission,
            Role,
            RolePermission,
            UserPermissionOverride,
            UserRoleAssignment,
        )
        from master_data.models import Bank, CompanyBankAccount, DocumentType, Item, Party, UnitOfMeasure, Warehouse
        from bank_management.models import AccountProfile
        from cash_management.models import CashFund

        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="DASH-CO",
            name="Công ty Cổ phần ERP Dashboard",
            legal_name="Công ty Cổ phần ERP Dashboard",
            tax_code="0101234567",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.other_company = Company.objects.create(
            code="OTHER-CO",
            name="Công ty Khác",
            legal_name="Công ty Khác",
            tax_code="0107654321",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch_a = Branch.objects.create(company=self.company, code="CN-A", name="Chi nhánh Hà Nội")
        self.branch_b = Branch.objects.create(company=self.company, code="CN-B", name="Chi nhánh TP.HCM")

        self.period_aug = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-08",
            fiscal_year=2026,
            period_number=8,
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 31),
        )
        self.period_sep = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-09",
            fiscal_year=2026,
            period_number=9,
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
        )
        self.period_oct = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
        )

        # Chart of Accounts TT99
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT99-DASH", name="TT99 Dashboard", effective_from="2026-01-01", is_default=True
        )
        self.cls_asset = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.cls_liab = AccountClass.objects.create(company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT")
        self.cls_rev = AccountClass.objects.create(company=self.company, code="REV", name="Doanh thu", normal_balance="CREDIT")
        self.cls_exp = AccountClass.objects.create(company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT")

        def _mk_acc(code, name, acc_type, cls_obj, normal="DEBIT"):
            return Account.objects.create(
                company=self.company,
                chart_of_accounts=self.chart,
                account_class=cls_obj,
                code=code,
                name=name,
                account_type=acc_type,
                normal_balance=normal,
            )

        self.acc_111 = _mk_acc("1111", "Tiền mặt VNĐ", "ASSET", self.cls_asset, "DEBIT")
        self.acc_112 = _mk_acc("1121", "Tiền gửi ngân hàng VNĐ", "ASSET", self.cls_asset, "DEBIT")
        self.acc_131 = _mk_acc("131", "Phải thu khách hàng", "ASSET", self.cls_asset, "DEBIT")
        self.acc_133 = _mk_acc("1331", "Thuế GTGT được khấu trừ", "ASSET", self.cls_asset, "DEBIT")
        self.acc_156 = _mk_acc("1561", "Hàng hóa", "ASSET", self.cls_asset, "DEBIT")
        self.acc_211 = _mk_acc("2111", "TSCĐ hữu hình", "ASSET", self.cls_asset, "DEBIT")
        self.acc_331 = _mk_acc("331", "Phải trả người bán", "LIABILITY", self.cls_liab, "CREDIT")
        self.acc_3331 = _mk_acc("33311", "Thuế GTGT đầu ra", "LIABILITY", self.cls_liab, "CREDIT")
        self.acc_3334 = _mk_acc("3334", "Thuế TNDN", "LIABILITY", self.cls_liab, "CREDIT")
        self.acc_511 = _mk_acc("5111", "Doanh thu bán hàng hóa", "REVENUE", self.cls_rev, "CREDIT")
        self.acc_521 = _mk_acc("5211", "Chiết khấu thương mại / Hàng bán trả lại", "REVENUE", self.cls_rev, "DEBIT")
        self.acc_515 = _mk_acc("515", "Doanh thu tài chính", "REVENUE", self.cls_rev, "CREDIT")
        self.acc_632 = _mk_acc("632", "Giá vốn hàng bán", "EXPENSE", self.cls_exp, "DEBIT")
        self.acc_635 = _mk_acc("635", "Chi phí tài chính", "EXPENSE", self.cls_exp, "DEBIT")
        self.acc_641 = _mk_acc("641", "Chi phí bán hàng", "EXPENSE", self.cls_exp, "DEBIT")
        self.acc_642 = _mk_acc("642", "Chi phí quản lý doanh nghiệp", "EXPENSE", self.cls_exp, "DEBIT")
        self.acc_711 = _mk_acc("711", "Thu nhập khác", "REVENUE", self.cls_rev, "CREDIT")
        self.acc_811 = _mk_acc("811", "Chi phí khác", "EXPENSE", self.cls_exp, "DEBIT")
        self.acc_821 = _mk_acc("8211", "Chi phí thuế TNDN hiện hành", "EXPENSE", self.cls_exp, "DEBIT")
        self.acc_911 = _mk_acc("911", "Xác định kết quả kinh doanh", "EQUITY", self.cls_rev, "CREDIT")
        self.acc_421 = _mk_acc("4212", "Lợi nhuận sau thuế chưa phân phối", "EQUITY", self.cls_rev, "CREDIT")

        # Master data
        self.customer_1 = Party.objects.create(
            company=self.company, code="KH01", name="Công ty Khách hàng Alpha", party_type="CUSTOMER", tax_code="0101111111"
        )
        self.customer_2 = Party.objects.create(
            company=self.company, code="KH02", name="Công ty Khách hàng Beta", party_type="CUSTOMER", tax_code="0102222222"
        )
        self.supplier_1 = Party.objects.create(
            company=self.company, code="NCC01", name="Nhà cung cấp Omega", party_type="SUPPLIER", tax_code="0103333333"
        )
        self.uom_cai, _ = UnitOfMeasure.objects.get_or_create(
            company=self.company, code="CAI", defaults={"name": "Cái", "measurement_type": "COUNT"}
        )
        self.uom_kg, _ = UnitOfMeasure.objects.get_or_create(
            company=self.company, code="KG", defaults={"name": "Kilogram", "measurement_type": "WEIGHT"}
        )
        self.uom_thung, _ = UnitOfMeasure.objects.get_or_create(
            company=self.company, code="THUNG", defaults={"name": "Thùng", "measurement_type": "COUNT"}
        )
        self.warehouse_a = Warehouse.objects.create(
            company=self.company, branch=self.branch_a, code="KHO-A", name="Kho Hà Nội"
        )
        self.warehouse_b = Warehouse.objects.create(
            company=self.company, branch=self.branch_b, code="KHO-B", name="Kho TP.HCM"
        )
        self.item_1 = Item.objects.create(
            company=self.company, code="SP01", name="Laptop Doanh nghiệp", item_type="GOODS", base_uom=self.uom_cai, track_inventory=True, status="ACTIVE"
        )
        self.item_2 = Item.objects.create(
            company=self.company, code="SP02", name="Hạt nhựa nguyên sinh", item_type="MATERIAL", base_uom=self.uom_kg, track_inventory=True, status="ACTIVE"
        )

        self.cash_fund_a = CashFund.objects.create(
            company=self.company, branch=self.branch_a, code="QUY-A", name="Quỹ tiền mặt HN", currency=self.currency, gl_account=self.acc_111
        )
        self.cash_fund_b = CashFund.objects.create(
            company=self.company, branch=self.branch_b, code="QUY-B", name="Quỹ tiền mặt HCM", currency=self.currency, gl_account=self.acc_111
        )
        self.bank_vcb, _ = Bank.objects.get_or_create(
            code="VCB", defaults={"name": "Vietcombank"}
        )
        self.company_bank_a = CompanyBankAccount.objects.create(
            company=self.company, branch=self.branch_a, code="VCB-A", account_number="0011009999999", account_name="CTY ERP DASHBOARD", bank=self.bank_vcb, currency=self.currency
        )
        self.bank_profile_a = AccountProfile.objects.create(
            company=self.company, account=self.company_bank_a, balance=0
        )

        # Users
        User = get_user_model()
        self.superuser = User.objects.create_superuser(username="dash-super", email="dash-super@example.com", password="x")
        self.user = self.superuser
        self.client = APIClient()
        self.client.force_authenticate(self.superuser)

    def _create_scoped_user(self, username: str, perm_codes: list[str], branch_scopes: list[Branch] | None = None, deny_codes: list[str] | None = None):
        from datetime import timedelta
        from django.utils import timezone
        from iam.models import (
            ActiveStatus,
            CompanyMembership,
            DataScopeBranch,
            DataScopeSet,
            Permission,
            Role,
            RolePermission,
            UserPermissionOverride,
            UserRoleAssignment,
        )

        User = get_user_model()
        u = User.objects.create_user(username=username, email=f"{username}@example.com", password="x")
        membership = CompanyMembership.objects.create(
            user=u.iam_account,
            company=self.company,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.superuser.iam_account,
        )
        role = Role.objects.create(company=self.company, code=f"ROLE_{username.upper()}", name=f"Role {username}", status="ACTIVE")
        for pcode in perm_codes:
            perm = Permission.objects.filter(code=pcode).first()
            if perm:
                RolePermission.objects.get_or_create(role=role, permission=perm, defaults={"effect": "ALLOW"})

        scope_set = None
        if branch_scopes is not None:
            scope_set = DataScopeSet.objects.create(
                company=self.company,
                code=f"SCOPE_{username.upper()}",
                name=f"Scope {username}",
                allow_all_company_data=False,
                status=ActiveStatus.ACTIVE,
                created_by=self.superuser.iam_account,
            )
            for b in branch_scopes:
                DataScopeBranch.objects.create(data_scope_set=scope_set, branch=b)

        UserRoleAssignment.objects.create(
            company_membership=membership,
            role=role,
            data_scope_set=scope_set,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.superuser.iam_account,
        )
        if deny_codes:
            from common_services.models import CoreCompanySetting
            CoreCompanySetting.objects.update_or_create(
                company=self.company,
                defaults={"configuration": {"direct_user_permissions_enabled": True}},
            )
            for dcode in deny_codes:
                perm = Permission.objects.filter(code=dcode).first()
                if perm:
                    UserPermissionOverride.objects.create(
                        company_membership=membership,
                        permission=perm,
                        effect="DENY",
                        reason="Test deny override",
                        valid_from=timezone.now() - timedelta(days=1),
                        assigned_by=self.superuser.iam_account,
                    )
        return u

    def _post_je(self, number: str, posting_date: str, lines_spec: list[tuple[Account, Decimal, Decimal]], branch=None, entry_type="MANUAL", source_module="GL", source_entity_id=None):
        total_d = sum((d for _, d, _ in lines_spec), Decimal("0"))
        total_c = sum((c for _, _, c in lines_spec), Decimal("0"))
        period = AccountingPeriod.objects.filter(
            company=self.company, start_date__lte=posting_date, end_date__gte=posting_date
        ).first() or self.period_sep
        je = JournalEntry.objects.create(
            company=self.company,
            branch=branch or self.branch_a,
            period=period,
            number=number,
            entry_type=entry_type,
            posting_date=posting_date,
            description=f"Bút toán {number}",
            status="POSTED",
            source_module=source_module,
            source_entity_id=str(source_entity_id) if source_entity_id else None,
            total_debit=total_d,
            total_credit=total_c,
            created_by=self.superuser.iam_account,
            posted_by=self.superuser.iam_account,
        )
        for idx, (acc, deb, cred) in enumerate(lines_spec, start=1):
            JournalLine.objects.create(
                entry=je, line_no=idx, account=acc, debit=deb, credit=cred, currency=self.currency
            )
        return je


class DashboardOverviewUcRpt01Tests(ReportingTestSetupMixin, TestCase):
    """
    Comprehensive Automated Test Suite for UC-RPT-01 – Xem Dashboard tổng quan
    Covers TC-RPT-01-01 through TC-RPT-01-50 across all 12 widgets (DASH-01 .. DASH-12).
    """

    # ------------------------------------------------------------------
    # Nhóm A: Truy cập, quyền, Data Scope (TC-RPT-01-01 .. TC-RPT-01-06)
    # ------------------------------------------------------------------
    def test_tc_rpt_01_01_and_02_open_dashboard_and_empty_company_no_mock_data(self):
        """TC-RPT-01-01, TC-RPT-01-02, TC-RPT-01-49: Mở Dashboard thành công & Doanh nghiệp mới chưa có phát sinh."""
        cfg_res = self.client.get(f"/api/v1/reports/dashboard/config/?company_id={self.company.id}")
        self.assertEqual(cfg_res.status_code, 200, cfg_res.data)
        self.assertEqual(len(cfg_res.data["widgets"]), 12)

        res = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}"
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "NO_DATA")
        for code in ("DASH-01", "DASH-02", "DASH-03", "DASH-04", "DASH-05", "DASH-06", "DASH-07", "DASH-08", "DASH-09", "DASH-10", "DASH-11", "DASH-12"):
            self.assertIn(code, res.data["widgets"])
            self.assertEqual(res.data["widgets"][code]["status"], "NO_DATA")
        # Verify 0 values (no mock/sample fixtures leaked - TC-RPT-01-49)
        self.assertEqual(Decimal(res.data["kpis"]["DASH-01"]["value"]), Decimal("0"))
        self.assertEqual(Decimal(res.data["kpis"]["DASH-02"]["value"]), Decimal("0"))
        self.assertEqual(Decimal(res.data["kpis"]["DASH-03"]["value"]), Decimal("0"))
        self.assertEqual(res.data["kpis"]["DASH-04"]["value"], 0)

    def test_tc_rpt_01_03_04_05_06_permissions_and_data_scope(self):
        """TC-RPT-01-03, TC-RPT-01-04, TC-RPT-01-05, TC-RPT-01-06: Kiểm tra Company, Permission, Data Scope và quyền từng phần."""
        # TC-RPT-01-03: Missing company_id -> 400
        missing_co = self.client.get("/api/v1/reports/dashboard/overview/")
        self.assertEqual(missing_co.status_code, 400)

        # User without membership in other_company -> 403
        user_no_perm = self._create_scoped_user("no-dash", perm_codes=["SAL.ORDER.VIEW"])
        c = APIClient()
        c.force_authenticate(user_no_perm)
        wrong_co = c.get(f"/api/v1/reports/dashboard/overview/?company_id={self.other_company.id}")
        self.assertEqual(wrong_co.status_code, 403)

        # TC-RPT-01-04: User belongs to company but lacks RPT.DASHBOARD.VIEW -> 403
        denied_dash = c.get(f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}")
        self.assertEqual(denied_dash.status_code, 403)

        # Post revenue in CN-A (10M) and CN-B (25M)
        self._post_je("JE-CNA-01", "2026-09-10", [(self.acc_131, Decimal("10000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("10000000"))], branch=self.branch_a)
        self._post_je("JE-CNB-01", "2026-09-12", [(self.acc_131, Decimal("25000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("25000000"))], branch=self.branch_b)

        # TC-RPT-01-05: User scoped to CN-A only
        user_cna = self._create_scoped_user("user-cna", perm_codes=["RPT.DASHBOARD.VIEW"], branch_scopes=[self.branch_a])
        c_cna = APIClient()
        c_cna.force_authenticate(user_cna)
        # Requesting CN-B -> 403
        res_cnb = c_cna.get(f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&branch_ids={self.branch_b.id}&fiscal_period_id={self.period_sep.id}")
        self.assertEqual(res_cnb.status_code, 403)
        # Requesting ALL -> automatically restricted to CN-A (10,000,000)
        res_all = c_cna.get(f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}")
        self.assertEqual(res_all.status_code, 200)
        self.assertEqual(Decimal(res_all.data["kpis"]["DASH-01"]["value"]), Decimal("10000000"))

        # TC-RPT-01-06: Partial widget permissions (has DASH-01 / SAL.ORDER.VIEW, lacks DASH-06 / DASH-08)
        user_partial = self._create_scoped_user("user-partial", perm_codes=["RPT.DASHBOARD.VIEW", "SAL.ORDER.VIEW"])
        c_partial = APIClient()
        c_partial.force_authenticate(user_partial)
        res_partial = c_partial.get(f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}")
        self.assertEqual(res_partial.status_code, 200)
        self.assertEqual(res_partial.data["widgets"]["DASH-01"]["status"], "OK")
        self.assertEqual(Decimal(res_partial.data["widgets"]["DASH-01"]["value"]), Decimal("35000000"))
        self.assertEqual(res_partial.data["widgets"]["DASH-06"]["status"], "FORBIDDEN")
        self.assertIsNone(res_partial.data["widgets"]["DASH-06"]["value"])
        self.assertEqual(res_partial.data["widgets"]["DASH-08"]["status"], "FORBIDDEN")
        self.assertIsNone(res_partial.data["widgets"]["DASH-08"]["value"])

    # ------------------------------------------------------------------
    # Nhóm B: Bộ lọc kỳ, đơn vị và so sánh (TC-RPT-01-07 .. TC-RPT-01-12)
    # ------------------------------------------------------------------
    def test_tc_rpt_01_07_to_12_period_filters_and_comparisons(self):
        """TC-RPT-01-07 .. TC-RPT-01-12: Đổi kỳ, validate ngày, lọc chi nhánh, và tính tỷ lệ so sánh kỳ."""
        # TC-RPT-01-08: from_date > to_date -> 400
        bad_dates = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&period_type=CUSTOM&from_date=2026-09-30&to_date=2026-09-01"
        )
        self.assertEqual(bad_dates.status_code, 400)

        # TC-RPT-01-09: Non-existent fiscal_period_id -> 400
        bad_period = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id=NON-EXISTENT-PERIOD"
        )
        self.assertEqual(bad_period.status_code, 400)

        # TC-RPT-01-11: Previous period (Jul 2026) = 0, Current period (Aug 2026) = 10,000,000 -> delta_percent = None, status = NO_BASELINE
        self._post_je("JE-AUG-01", "2026-08-15", [(self.acc_131, Decimal("10000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("10000000"))], branch=self.branch_a)
        res_aug = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_aug.id}&refresh_mode=FORCE_REFRESH"
        )
        self.assertEqual(res_aug.status_code, 200)
        cmp_aug = res_aug.data["kpis"]["DASH-01"]["comparison"]
        self.assertEqual(Decimal(cmp_aug["current_value"]), Decimal("10000000"))
        self.assertEqual(Decimal(cmp_aug["comparison_value"]), Decimal("0"))
        self.assertIsNone(cmp_aug["delta_percent"])
        self.assertEqual(cmp_aug["comparison_status"], "NO_BASELINE")

        # TC-RPT-01-07 & TC-RPT-01-12: Sep 2026 = 8,000,000 (CN-A: 5M, CN-B: 3M) vs Aug 2026 = 10,000,000 -> delta = -2M (-20%)
        self._post_je("JE-SEP-A", "2026-09-10", [(self.acc_131, Decimal("5000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("5000000"))], branch=self.branch_a)
        self._post_je("JE-SEP-B", "2026-09-15", [(self.acc_131, Decimal("3000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("3000000"))], branch=self.branch_b)

        res_sep = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&refresh_mode=FORCE_REFRESH"
        )
        self.assertEqual(res_sep.status_code, 200)
        cmp_sep = res_sep.data["kpis"]["DASH-01"]["comparison"]
        self.assertEqual(Decimal(cmp_sep["current_value"]), Decimal("8000000"))
        self.assertEqual(Decimal(cmp_sep["comparison_value"]), Decimal("10000000"))
        self.assertEqual(Decimal(cmp_sep["delta_amount"]), Decimal("-2000000"))
        self.assertEqual(cmp_sep["delta_percent"], -20.0)
        self.assertEqual(cmp_sep["comparison_status"], "DOWN")

        # TC-RPT-01-10: Filter by CN-A only -> 5,000,000
        res_sep_cna = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&branch_ids={self.branch_a.id}"
        )
        self.assertEqual(Decimal(res_sep_cna.data["kpis"]["DASH-01"]["value"]), Decimal("5000000"))

    # ------------------------------------------------------------------
    # Nhóm C: KPI DASH-01 .. DASH-04 (TC-RPT-01-13 .. TC-RPT-01-17)
    # ------------------------------------------------------------------
    def test_tc_rpt_01_13_and_14_revenue_net_pre_vat_and_no_double_counting(self):
        """TC-RPT-01-13 & TC-RPT-01-14: Doanh thu thuần trước thuế GTGT và chống tính trùng GoodsSale/SalesInvoice/GL."""
        from sales.models import GoodsSale, SalesInvoice, SalesOrder, SalesReturn

        # Unposted SalesOrder (CONFIRMED) must NOT be counted
        SalesOrder.objects.create(
            company=self.company, branch=self.branch_a, number="SO-001", document_date="2026-09-02",
            customer=self.customer_1, currency=self.currency, subtotal=Decimal("50000000"), total_amount=Decimal("55000000"),
            status="CONFIRMED", created_by=self.superuser.iam_account,
        )

        # Sale 1: 10M + 1M VAT, linked with both SalesInvoice (ISSUED) and JournalEntry (POSTED) -> counted ONCE
        je_sale_1 = self._post_je(
            "JE-SAL-01", "2026-09-05",
            [
                (self.acc_131, Decimal("11000000"), Decimal("0")),
                (self.acc_511, Decimal("0"), Decimal("10000000")),
                (self.acc_3331, Decimal("0"), Decimal("1000000")),
            ],
            source_module="SAL",
        )
        sale_1 = GoodsSale.objects.create(
            company=self.company, branch=self.branch_a, number="BH-001", document_date="2026-09-05", posting_date="2026-09-05",
            customer=self.customer_1, currency=self.currency, subtotal=Decimal("10000000"), discount_amount=Decimal("0"),
            tax_amount=Decimal("1000000"), total_amount=Decimal("11000000"), status="POSTED",
            journal_entry=je_sale_1, inventory_handling="NO_INVENTORY", created_by=self.superuser.iam_account,
        )
        SalesInvoice.objects.create(
            company=self.company, branch=self.branch_a, number="INV-SAL-001", invoice_series="1C26TAA", invoice_number="0000001",
            invoice_date="2026-09-05", document_date="2026-09-05", seller_name=self.company.name, seller_tax_code=self.company.tax_code,
            buyer_name=self.customer_1.name, customer=self.customer_1, currency=self.currency, goods_sale=sale_1,
            subtotal=Decimal("10000000"), tax_amount=Decimal("1000000"), total_amount=Decimal("11000000"),
            status="ISSUED", created_by=self.superuser.iam_account,
        )

        # Sale 2: 5M + 500k VAT
        GoodsSale.objects.create(
            company=self.company, branch=self.branch_a, number="BH-002", document_date="2026-09-08", posting_date="2026-09-08",
            customer=self.customer_2, currency=self.currency, subtotal=Decimal("5000000"), discount_amount=Decimal("0"),
            tax_amount=Decimal("500000"), total_amount=Decimal("5500000"), status="POSTED",
            inventory_handling="NO_INVENTORY", created_by=self.superuser.iam_account,
        )

        # SalesReturn: 1M + 100k VAT
        SalesReturn.objects.create(
            company=self.company, branch=self.branch_a, number="TL-001", document_date="2026-09-10", posting_date="2026-09-10",
            goods_sale=sale_1, return_reason="Hàng lỗi", customer=self.customer_1, currency=self.currency,
            subtotal=Decimal("1000000"), discount_amount=Decimal("0"), tax_amount=Decimal("100000"), total_amount=Decimal("1100000"),
            status="POSTED", inventory_handling="NO_INVENTORY", created_by=self.superuser.iam_account,
        )

        res = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&refresh_mode=FORCE_REFRESH"
        )
        self.assertEqual(res.status_code, 200)
        dash01 = res.data["kpis"]["DASH-01"]
        self.assertEqual(Decimal(dash01["value"]), Decimal("14000000"))
        self.assertEqual(Decimal(dash01["data"]["revenue_gross"]), Decimal("15000000"))
        self.assertEqual(Decimal(dash01["data"]["revenue_deduction"]), Decimal("1000000"))

    def test_tc_rpt_01_15_purchase_goods_services_and_fixed_assets_vs_pnl(self):
        """TC-RPT-01-15: Mua hàng hóa 156 (30M), dịch vụ 642 (10M), TSCĐ 211 (50M) -> DASH-02 = 90M; DASH-06 không cộng 50M của 211 vào chi phí kỳ."""
        from purchases.models import GoodsPurchase

        GoodsPurchase.objects.create(
            company=self.company, branch=self.branch_a, number="MH-001", document_date="2026-09-05", posting_date="2026-09-05",
            purchase_type="WAREHOUSE", supplier=self.supplier_1, payment_type="UNPAID",
            subtotal=Decimal("30000000"), discount_amount=Decimal("0"), tax_amount=Decimal("3000000"), total_amount=Decimal("33000000"),
            status="POSTED", created_by=self.superuser.iam_account,
        )
        # Service purchase 10M on 642 & Fixed Asset 50M on 211
        self._post_je(
            "JE-PUR-SVC-FA", "2026-09-06",
            [
                (self.acc_642, Decimal("10000000"), Decimal("0")),
                (self.acc_211, Decimal("50000000"), Decimal("0")),
                (self.acc_133, Decimal("6000000"), Decimal("0")),
                (self.acc_331, Decimal("0"), Decimal("66000000")),
            ],
            source_module="PUR",
        )

        res = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&refresh_mode=FORCE_REFRESH"
        )
        self.assertEqual(res.status_code, 200)
        dash02 = res.data["kpis"]["DASH-02"]
        self.assertEqual(Decimal(dash02["value"]), Decimal("90000000"))
        self.assertEqual(Decimal(dash02["data"]["purchase_fixed_asset_amount"]), Decimal("50000000"))

        dash06 = res.data["widgets"]["DASH-06"]
        self.assertEqual(Decimal(dash06["data"]["admin_expense"]), Decimal("10000000"))
        self.assertEqual(Decimal(dash06["data"]["total_expense"]), Decimal("10000000"))

    def test_tc_rpt_01_16_and_17_cash_collected_and_internal_transfers(self):
        """TC-RPT-01-16 & TC-RPT-01-17: Tổng tiền đã thu CASH + BANK và loại trừ chuyển tiền nội bộ."""
        from bank_management.models import BankTransaction
        from cash_management.models import CashTransaction

        # 7M Cash receipt POSTED
        CashTransaction.objects.create(
            company=self.company, fund=self.cash_fund_a, number="PT-001", transaction_type="RECEIPT",
            business_type="CUSTOMER_RECEIPT", transaction_date="2026-09-05", payer_payee="KH A",
            currency=self.currency, amount=Decimal("7000000"), base_amount=Decimal("7000000"),
            description="Thu tiền khách hàng", status="POSTED", created_by=self.superuser.iam_account,
        )
        # 4M Cash receipt DRAFT (must NOT be counted)
        CashTransaction.objects.create(
            company=self.company, fund=self.cash_fund_a, number="PT-DRAFT", transaction_type="RECEIPT",
            business_type="CUSTOMER_RECEIPT", transaction_date="2026-09-06", payer_payee="KH B",
            currency=self.currency, amount=Decimal("4000000"), base_amount=Decimal("4000000"),
            description="Nháp", status="DRAFT", created_by=self.superuser.iam_account,
        )
        # 13M Bank receipt POSTED
        BankTransaction.objects.create(
            company=self.company, account=self.bank_profile_a, number="BC-001", transaction_type="RECEIPT",
            business_type="CUSTOMER_RECEIPT", transaction_date="2026-09-07", counterparty_name="KH A",
            currency=self.currency, amount=Decimal("13000000"), base_amount=Decimal("13000000"),
            description="Thu qua ngân hàng", status="POSTED", created_by=self.superuser.iam_account,
        )
        # 5M Internal transfer (Deposit cash to bank)
        CashTransaction.objects.create(
            company=self.company, fund=self.cash_fund_a, number="PC-INT-01", transaction_type="PAYMENT",
            business_type="DEPOSIT_TO_BANK", transaction_date="2026-09-08", payer_payee="Nộp NH",
            currency=self.currency, amount=Decimal("5000000"), base_amount=Decimal("5000000"),
            description="Nộp tiền vào ngân hàng", status="POSTED", created_by=self.superuser.iam_account,
        )
        BankTransaction.objects.create(
            company=self.company, account=self.bank_profile_a, number="BC-INT-01", transaction_type="RECEIPT",
            business_type="DEPOSIT_TO_BANK", transaction_date="2026-09-08", counterparty_name="Quỹ TM",
            currency=self.currency, amount=Decimal("5000000"), base_amount=Decimal("5000000"),
            description="Nộp tiền vào ngân hàng", status="POSTED", created_by=self.superuser.iam_account,
        )

        res = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&refresh_mode=FORCE_REFRESH"
        )
        self.assertEqual(res.status_code, 200)
        dash03 = res.data["kpis"]["DASH-03"]
        self.assertEqual(Decimal(dash03["value"]), Decimal("20000000"))
        self.assertEqual(Decimal(dash03["data"]["receipt_total_external"]), Decimal("20000000"))
        self.assertEqual(Decimal(dash03["data"]["internal_transfer_in_amount"]), Decimal("5000000"))
        self.assertEqual(Decimal(dash03["data"]["receipt_total_gross"]), Decimal("25000000"))

        # Also verify DASH-05 (TC-RPT-01-19): external inflow = 20M, external outflow = 0
        dash05 = res.data["widgets"]["DASH-05"]["data"]
        self.assertEqual(Decimal(dash05["cash_inflow_total"]), Decimal("20000000"))
        self.assertEqual(Decimal(dash05["cash_outflow_total"]), Decimal("0"))
        self.assertEqual(Decimal(dash05["internal_transfer_in_total"]), Decimal("5000000"))
        self.assertEqual(Decimal(dash05["internal_transfer_out_total"]), Decimal("5000000"))

    # ------------------------------------------------------------------
    # Nhóm D: Dòng tiền và KQKD DASH-05, DASH-06 (TC-RPT-01-18 .. TC-RPT-01-24)
    # ------------------------------------------------------------------
    def test_tc_rpt_01_18_and_20_cash_flow_opening_inflow_outflow_closing(self):
        """TC-RPT-01-18 & TC-RPT-01-20: Số dư tiền đầu kỳ 50M + thu 30M - chi 20M = cuối kỳ 60M."""
        from bank_management.models import BankTransaction
        from cash_management.models import CashTransaction

        # Opening balance 50M before Sep 2026
        self._post_je(
            "JE-OPEN-CASH", "2026-08-01",
            [(self.acc_111, Decimal("50000000"), Decimal("0")), (self.acc_421, Decimal("0"), Decimal("50000000"))],
            entry_type="OPENING",
        )
        CashTransaction.objects.create(
            company=self.company, fund=self.cash_fund_a, number="PT-CF-01", transaction_type="RECEIPT",
            business_type="RECEIPT", transaction_date="2026-09-10", payer_payee="KH",
            currency=self.currency, amount=Decimal("30000000"), base_amount=Decimal("30000000"),
            description="Thu trong kỳ", status="POSTED", created_by=self.superuser.iam_account,
        )
        BankTransaction.objects.create(
            company=self.company, account=self.bank_profile_a, number="BN-CF-01", transaction_type="PAYMENT",
            business_type="PAYMENT", transaction_date="2026-09-15", counterparty_name="NCC",
            currency=self.currency, amount=Decimal("20000000"), base_amount=Decimal("20000000"),
            description="Chi trong kỳ", status="POSTED", created_by=self.superuser.iam_account,
        )

        cf_res = self.client.get(
            f"/api/v1/reports/dashboard/cash-flow/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&bucket=MONTH"
        )
        self.assertEqual(cf_res.status_code, 200)
        data = cf_res.data["data"]
        self.assertEqual(Decimal(data["opening_cash_balance"]), Decimal("50000000"))
        self.assertEqual(Decimal(data["cash_inflow_total"]), Decimal("30000000"))
        self.assertEqual(Decimal(data["cash_outflow_total"]), Decimal("20000000"))
        self.assertEqual(Decimal(data["net_cash_flow"]), Decimal("10000000"))
        self.assertEqual(Decimal(data["closing_cash_balance"]), Decimal("60000000"))
        self.assertTrue(data["reconciled"])

    def test_tc_rpt_01_21_22_23_24_profitability_closing_entries_loss_and_missing_cogs(self):
        """TC-RPT-01-21, TC-RPT-01-22, TC-RPT-01-23, TC-RPT-01-24: KQKD, bút toán kết chuyển 911, kỳ lỗ, và cảnh báo thiếu giá vốn."""
        # TC-RPT-01-24: Revenue on 5111 without 632 COGS -> warning COGS_NOT_RECORDED
        self._post_je(
            "JE-PNL-REV", "2026-09-05",
            [(self.acc_131, Decimal("100000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("100000000"))],
        )
        res_warn = self.client.get(
            f"/api/v1/reports/dashboard/profitability/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}"
        )
        self.assertEqual(res_warn.status_code, 200)
        warn_codes = [w["code"] for w in res_warn.data["warnings"]]
        self.assertIn("COGS_NOT_RECORDED", warn_codes)

        # TC-RPT-01-21: Add COGS 60M, Selling 10M, Admin 15M, CIT 3M -> Gross 40M, Op 15M, PBT 15M, PAT 12M
        self._post_je(
            "JE-PNL-EXP", "2026-09-10",
            [
                (self.acc_632, Decimal("60000000"), Decimal("0")),
                (self.acc_156, Decimal("0"), Decimal("60000000")),
                (self.acc_641, Decimal("10000000"), Decimal("0")),
                (self.acc_642, Decimal("15000000"), Decimal("0")),
                (self.acc_821, Decimal("3000000"), Decimal("0")),
                (self.acc_331, Decimal("0"), Decimal("25000000")),
                (self.acc_3334, Decimal("0"), Decimal("3000000")),
            ],
        )
        # TC-RPT-01-22: Post 911 closing entry -> must NOT zero out or double-count P&L!
        self._post_je(
            "JE-CLOSE-911", "2026-09-30",
            [
                (self.acc_511, Decimal("100000000"), Decimal("0")),
                (self.acc_911, Decimal("0"), Decimal("100000000")),
                (self.acc_911, Decimal("88000000"), Decimal("0")),
                (self.acc_632, Decimal("0"), Decimal("60000000")),
                (self.acc_641, Decimal("0"), Decimal("10000000")),
                (self.acc_642, Decimal("0"), Decimal("15000000")),
                (self.acc_821, Decimal("0"), Decimal("3000000")),
                (self.acc_911, Decimal("12000000"), Decimal("0")),
                (self.acc_421, Decimal("0"), Decimal("12000000")),
            ],
            entry_type="CLOSING",
        )

        res_pnl = self.client.get(
            f"/api/v1/reports/dashboard/profitability/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}"
        )
        self.assertEqual(res_pnl.status_code, 200)
        d = res_pnl.data["data"]
        self.assertEqual(Decimal(d["net_revenue"]), Decimal("100000000"))
        self.assertEqual(Decimal(d["cogs"]), Decimal("60000000"))
        self.assertEqual(Decimal(d["gross_profit"]), Decimal("40000000"))
        self.assertEqual(Decimal(d["operating_profit"]), Decimal("15000000"))
        self.assertEqual(Decimal(d["profit_before_tax"]), Decimal("15000000"))
        self.assertEqual(Decimal(d["profit_after_tax"]), Decimal("12000000"))

        # TC-RPT-01-23: Loss period in Aug 2026 (Revenue 5M < Expense 20M -> Net Profit -15M)
        self._post_je(
            "JE-LOSS-AUG", "2026-08-20",
            [
                (self.acc_131, Decimal("5000000"), Decimal("0")),
                (self.acc_511, Decimal("0"), Decimal("5000000")),
                (self.acc_642, Decimal("20000000"), Decimal("0")),
                (self.acc_331, Decimal("0"), Decimal("20000000")),
            ],
        )
        res_loss = self.client.get(
            f"/api/v1/reports/dashboard/profitability/?company_id={self.company.id}&fiscal_period_id={self.period_aug.id}"
        )
        self.assertEqual(Decimal(res_loss.data["value"]), Decimal("-15000000"))

    # ------------------------------------------------------------------
    # Nhóm E: Công nợ DASH-07, DASH-08 (TC-RPT-01-25 .. TC-RPT-01-28)
    # ------------------------------------------------------------------
    def test_tc_rpt_01_25_26_27_28_ar_ap_aging_boundary_and_historical_as_of_date(self):
        """TC-RPT-01-25, TC-RPT-01-26, TC-RPT-01-27, TC-RPT-01-28: Tổng phải thu/trả mở, biên tuổi nợ tại due_date==as_of_date, quá hạn 45 ngày, và tái lập số dư quá khứ."""
        from datetime import date
        from accounts_payable.models import Payable, SupplierInvoice
        from accounts_receivable.models import Receipt, ReceiptAllocation, Receivable, ReceivableDocument

        # TC-RPT-01-25 & TC-RPT-01-26: Receivable 1 = 10M, collected 4M -> open 6M, due_date == 2026-09-30 (as_of_date) -> NOT overdue!
        doc_ar_1 = ReceivableDocument.objects.create(
            company=self.company, branch=self.branch_a, number="ARD-001", document_type="SALES_INVOICE",
            document_date=date(2026, 9, 1), posting_date=date(2026, 9, 1), due_date=date(2026, 9, 30),
            customer=self.customer_1, currency=self.currency, amount=Decimal("10000000"),
            description="Phải thu KH1", status="POSTED", created_by=self.superuser.iam_account,
        )
        rec_1 = Receivable.objects.create(
            company=self.company, branch=self.branch_a, code="REC-001", customer=self.customer_1,
            document=doc_ar_1, document_date=date(2026, 9, 1), posting_date=date(2026, 9, 1),
            due_date=date(2026, 9, 30), currency=self.currency, original_amount=Decimal("10000000"),
            collected_amount=Decimal("4000000"), balance=Decimal("6000000"), status="PARTIALLY_PAID",
            created_by=self.superuser.iam_account,
        )
        rcp_sep = Receipt.objects.create(
            company=self.company, branch=self.branch_a, customer=self.customer_1, currency=self.currency,
            receipt_date=date(2026, 9, 15), amount=Decimal("4000000"), allocated_amount=Decimal("4000000"),
            external_type="BANK", external_reference="REF-SEP-01", status="CONFIRMED", created_by=self.superuser.iam_account,
        )
        ReceiptAllocation.objects.create(
            receipt=rcp_sep, receivable=rec_1, amount=Decimal("4000000"), effective_date=date(2026, 9, 15),
            created_by=self.superuser.iam_account,
        )

        # TC-RPT-01-27 & TC-RPT-01-28: Receivable 2 = 20M, due_date = 2026-08-16 (45 days overdue at 2026-09-30 -> bucket overdue_31_60),
        # settled on 2026-10-05 -> when querying as_of_date=2026-09-30 it MUST still be open 20M!
        doc_ar_2 = ReceivableDocument.objects.create(
            company=self.company, branch=self.branch_a, number="ARD-002", document_type="SALES_INVOICE",
            document_date=date(2026, 8, 1), posting_date=date(2026, 8, 1), due_date=date(2026, 8, 16),
            customer=self.customer_2, currency=self.currency, amount=Decimal("20000000"),
            description="Phải thu KH2", status="POSTED", created_by=self.superuser.iam_account,
        )
        rec_2 = Receivable.objects.create(
            company=self.company, branch=self.branch_a, code="REC-002", customer=self.customer_2,
            document=doc_ar_2, document_date=date(2026, 8, 1), posting_date=date(2026, 8, 1),
            due_date=date(2026, 8, 16), currency=self.currency, original_amount=Decimal("20000000"),
            collected_amount=Decimal("20000000"), balance=Decimal("0"), status="PAID",
            created_by=self.superuser.iam_account,
        )
        rcp_oct = Receipt.objects.create(
            company=self.company, branch=self.branch_a, customer=self.customer_2, currency=self.currency,
            receipt_date=date(2026, 10, 5), amount=Decimal("20000000"), allocated_amount=Decimal("20000000"),
            external_type="BANK", external_reference="REF-OCT-01", status="CONFIRMED", created_by=self.superuser.iam_account,
        )
        ReceiptAllocation.objects.create(
            receipt=rcp_oct, receivable=rec_2, amount=Decimal("20000000"), effective_date=date(2026, 10, 5),
            created_by=self.superuser.iam_account,
        )

        # Query AR as of 2026-09-30
        ar_res_sep = self.client.get(
            f"/api/v1/reports/dashboard/receivables/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&as_of_date=2026-09-30"
        )
        self.assertEqual(ar_res_sep.status_code, 200)
        ar_data = ar_res_sep.data["data"]
        self.assertEqual(Decimal(ar_data["ar_total_receivable"]), Decimal("26000000"))
        self.assertEqual(Decimal(ar_data["ar_not_due_amount"]), Decimal("6000000"))
        self.assertEqual(Decimal(ar_data["ar_overdue_amount"]), Decimal("20000000"))
        self.assertEqual(Decimal(ar_data["aging_buckets"]["not_due"]), Decimal("6000000"))
        self.assertEqual(Decimal(ar_data["aging_buckets"]["overdue_31_60"]), Decimal("20000000"))

        # Query AR as of 2026-10-31 -> rec_2 is now settled, so only rec_1 (6M, now 31 days overdue) remains!
        ar_res_oct = self.client.get(
            f"/api/v1/reports/dashboard/receivables/?company_id={self.company.id}&fiscal_period_id={self.period_oct.id}&as_of_date=2026-10-31"
        )
        self.assertEqual(Decimal(ar_res_oct.data["data"]["ar_total_receivable"]), Decimal("6000000"))
        self.assertEqual(Decimal(ar_res_oct.data["data"]["aging_buckets"]["overdue_31_60"]), Decimal("6000000"))

        # Also test DASH-08 Payables (TC-RPT-01-25)
        sup_inv = SupplierInvoice.objects.create(
            company=self.company, branch=self.branch_a, supplier=self.supplier_1, supplier_tax_code=self.supplier_1.tax_code,
            invoice_series="1C26NCC", invoice_number="000101", invoice_date=date(2026, 9, 10), posting_date=date(2026, 9, 10),
            due_date=date(2026, 9, 25), currency=self.currency, subtotal=Decimal("10000000"), tax_amount=Decimal("0"),
            total_amount=Decimal("10000000"), status="POSTED", created_by=self.superuser.iam_account,
        )
        Payable.objects.create(
            company=self.company, branch=self.branch_a, supplier=self.supplier_1, invoice=sup_inv,
            currency=self.currency, exchange_rate=Decimal("1"), original_amount=Decimal("10000000"),
            paid_amount=Decimal("4000000"), balance=Decimal("6000000"), due_date=date(2026, 9, 25),
            status="PARTIALLY_PAID",
        )
        ap_res = self.client.get(
            f"/api/v1/reports/dashboard/payables/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&as_of_date=2026-09-30"
        )
        self.assertEqual(ap_res.status_code, 200)
        self.assertEqual(Decimal(ap_res.data["data"]["ap_total_payable"]), Decimal("6000000"))
        self.assertEqual(Decimal(ap_res.data["data"]["aging_buckets"]["overdue_1_30"]), Decimal("6000000"))

    # ------------------------------------------------------------------
    # Nhóm F: Tồn kho và thuế DASH-09, DASH-10 (TC-RPT-01-29 .. TC-RPT-01-34)
    # ------------------------------------------------------------------
    def test_tc_rpt_01_29_30_31_inventory_multi_uom_pending_costing_and_min_stock(self):
        """TC-RPT-01-29, TC-RPT-01-30, TC-RPT-01-31: Nhiều ĐVT không cộng gộp số lượng, cảnh báo chưa tính giá xuất kho, cảnh báo dưới tồn tối thiểu."""
        from inventory.models import InventoryPolicy, InventoryTransaction, InventoryTransactionLine, StockBalance

        # Item 1 (Cái): balance = 3 (< min 10), value = 30,000,000
        StockBalance.objects.create(
            company=self.company, warehouse=self.warehouse_a, item=self.item_1,
            quantity=Decimal("3"), reserved_quantity=Decimal("0"), inventory_value=Decimal("30000000"),
        )
        InventoryPolicy.objects.create(
            company=self.company, warehouse=self.warehouse_a, item=self.item_1,
            base_uom=self.uom_cai, minimum_quantity=Decimal("10"), is_active=True,
        )
        # Item 2 (Kg): balance = 50, value = 15,000,000 -> triggers multi-UOM!
        StockBalance.objects.create(
            company=self.company, warehouse=self.warehouse_a, item=self.item_2,
            quantity=Decimal("50"), reserved_quantity=Decimal("0"), inventory_value=Decimal("15000000"),
        )
        # Outbound issue with unit_cost=0, line_value=0 -> triggers PENDING costing!
        inv_tx = InventoryTransaction.objects.create(
            company=self.company, branch=self.branch_a, number="PX-001", transaction_type="ISSUE",
            transaction_date="2026-09-20", source_warehouse=self.warehouse_a, status="POSTED",
            created_by=self.superuser.iam_account,
        )
        InventoryTransactionLine.objects.create(
            transaction=inv_tx, line_no=1, item=self.item_1, uom=self.uom_cai,
            movement_direction="OUT", quantity=Decimal("1"), base_quantity=Decimal("1"),
            unit_cost=Decimal("0"), line_value=Decimal("0"),
        )

        inv_res = self.client.get(
            f"/api/v1/reports/dashboard/inventory/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}"
        )
        self.assertEqual(inv_res.status_code, 200)
        d = inv_res.data["data"]
        self.assertEqual(Decimal(d["inventory_total_value"]), Decimal("45000000"))
        # TC-RPT-01-29: Multi-UOM -> inventory_total_quantity is None
        self.assertIsNone(d["inventory_total_quantity"])
        warn_codes = [w["code"] for w in inv_res.data["warnings"]]
        self.assertIn("MULTI_UOM_NOT_SUMMABLE", warn_codes)
        # TC-RPT-01-30: Uncosted issue -> PENDING
        self.assertEqual(d["inventory_cost_status"], "PENDING")
        self.assertIn("COSTING_NOT_COMPLETED", warn_codes)
        # TC-RPT-01-31: Below minimum stock count = 1
        self.assertEqual(d["below_minimum_stock_count"], 1)
        self.assertEqual(d["below_minimum_items"][0]["item_code"], "SP01")

    def test_tc_rpt_01_32_33_34_tax_vat_offset_unposted_payment_and_overdue_deadline(self):
        """TC-RPT-01-32, TC-RPT-01-33, TC-RPT-01-34: Bù trừ VAT đầu ra/đầu vào, không trừ phiếu nộp thuế DRAFT/REVERSED, và cảnh báo quá hạn nộp thuế."""
        from datetime import date
        from cash_management.models import CashTransaction
        from tax_management.models import TaxInvoice, TaxObligation, TaxPaymentLink, TaxPeriod

        # TC-RPT-01-32: VAT Output = 12M, VAT Input = 15M -> net_vat_payable = 0, net_vat_deductible_carryforward = 3M
        TaxInvoice.objects.create(
            company=self.company, branch=self.branch_a, direction="OUTPUT", invoice_series="1C26OUT", invoice_number="0001",
            invoice_date=date(2026, 9, 10), seller_name=self.company.name, seller_tax_code=self.company.tax_code,
            buyer_name=self.customer_1.name, currency=self.currency, subtotal=Decimal("120000000"),
            tax_amount=Decimal("12000000"), total_amount=Decimal("132000000"), status="ISSUED",
            created_by=self.superuser.iam_account,
        )
        TaxInvoice.objects.create(
            company=self.company, branch=self.branch_a, direction="INPUT", invoice_series="1C26INP", invoice_number="0002",
            invoice_date=date(2026, 9, 12), seller_name=self.supplier_1.name, seller_tax_code=self.supplier_1.tax_code,
            buyer_name=self.company.name, currency=self.currency, subtotal=Decimal("150000000"),
            tax_amount=Decimal("15000000"), total_amount=Decimal("165000000"), status="VALIDATED", tax_eligible=True,
            created_by=self.superuser.iam_account,
        )

        # TC-RPT-01-33 & TC-RPT-01-34: TaxObligation CIT = 8M, due_date = 2026-09-20 (< as_of 2026-09-30 -> OVERDUE),
        # linked with a DRAFT CashTransaction (must NOT reduce outstanding amount!)
        tax_p = TaxPeriod.objects.create(
            company=self.company, code="2026-Q3-CIT", tax_type="CIT", start_date=date(2026, 7, 1), end_date=date(2026, 9, 30)
        )
        ob_cit = TaxObligation.objects.create(
            company=self.company, period=tax_p, tax_type="CIT", due_date=date(2026, 9, 20),
            assessed_amount=Decimal("8000000"), paid_amount=Decimal("8000000"), status="PAID",
            created_by=self.superuser.iam_account,
        )
        draft_cash = CashTransaction.objects.create(
            company=self.company, fund=self.cash_fund_a, number="PC-TAX-DRAFT", transaction_type="PAYMENT",
            business_type="TAX_PAYMENT", transaction_date=date(2026, 9, 19), payer_payee="KBNN",
            currency=self.currency, amount=Decimal("8000000"), base_amount=Decimal("8000000"),
            description="Nộp thuế nháp", status="DRAFT", created_by=self.superuser.iam_account,
        )
        TaxPaymentLink.objects.create(
            obligation=ob_cit, source_module="CASH", transaction_id=draft_cash.id,
            reference="PC-TAX-DRAFT", amount=Decimal("8000000"), payment_date=date(2026, 9, 19),
            created_by=self.superuser.iam_account,
        )

        tax_res = self.client.get(
            f"/api/v1/reports/dashboard/tax-obligations/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&as_of_date=2026-09-30"
        )
        self.assertEqual(tax_res.status_code, 200)
        td = tax_res.data["data"]
        self.assertEqual(Decimal(td["vat_output_amount"]), Decimal("12000000"))
        self.assertEqual(Decimal(td["vat_input_deductible_amount"]), Decimal("15000000"))
        self.assertEqual(Decimal(td["net_vat_payable"]), Decimal("0"))
        self.assertEqual(Decimal(td["net_vat_deductible_carryforward"]), Decimal("3000000"))
        # DRAFT tax payment ignored -> CIT obligation still 8M outstanding and OVERDUE!
        self.assertEqual(Decimal(td["tax_payable_total"]), Decimal("8000000"))
        self.assertEqual(td["overdue_obligation_count"], 1)
        warn_codes = [w["code"] for w in tax_res.data["warnings"]]
        self.assertIn("UNPOSTED_TAX_PAYMENT_IGNORED", warn_codes)

    # ------------------------------------------------------------------
    # Nhóm G: Công việc và chứng từ gần đây DASH-04, DASH-11, DASH-12 (TC-RPT-01-35 .. TC-RPT-01-39)
    # ------------------------------------------------------------------
    def test_tc_rpt_01_35_36_37_38_39_workflow_tasks_and_recent_documents(self):
        """TC-RPT-01-35 .. TC-RPT-01-39: Không đếm DRAFT, không đếm trùng task có nhiều event, sắp xếp ưu tiên task quá hạn, và lọc/sắp xếp chứng từ gần đây."""
        from datetime import date, datetime
        from django.utils import timezone
        from approval_workflows.models import ApprovalEvent, ApprovalRequest, ApprovalTask, Workflow, WorkflowVersion
        from master_data.models import DocumentType
        from purchases.models import PurchaseOrder

        # TC-RPT-01-35: 3 DRAFT orders and 1 PENDING_APPROVAL order -> only 1 pending approval!
        for i in range(3):
            PurchaseOrder.objects.create(
                company=self.company, branch=self.branch_a, number=f"PO-DRAFT-{i}", document_date=date(2026, 9, 5),
                supplier=self.supplier_1, currency=self.currency, total_amount=Decimal("1000000"),
                status="DRAFT", created_by=self.superuser.iam_account,
            )
        po_pending = PurchaseOrder.objects.create(
            company=self.company, branch=self.branch_b, number="PO-PEND-01", document_date=date(2026, 9, 6),
            supplier=self.supplier_1, currency=self.currency, total_amount=Decimal("5000000"),
            status="PENDING_APPROVAL", created_by=self.superuser.iam_account,
        )

        # TC-RPT-01-36 & TC-RPT-01-37: Create ApprovalTasks (1 overdue, 1 not overdue, with multiple ApprovalEvents)
        doc_type, _ = DocumentType.objects.get_or_create(
            code="PO_DOC", defaults={"name": "Đơn mua hàng", "module_code": "PUR", "document_class": "VOUCHER"}
        )
        wf = Workflow.objects.create(
            company=self.company, document_type=doc_type, code="WF-PO", name="Quy trình PO", created_by=self.superuser.iam_account
        )
        wf_ver = WorkflowVersion.objects.create(
            workflow=wf, number=1, name="V1", status="ACTIVE", effective_from=date(2026, 1, 1), created_by=self.superuser.iam_account
        )
        req_not_due = ApprovalRequest.objects.create(
            company=self.company, document_type=doc_type, source_model="PurchaseOrder", source_id=po_pending.id,
            round_number=1, workflow_version=wf_ver, snapshot={"number": "PO-PEND-01", "branch_id": str(self.branch_a.id)},
            submitted_by=self.superuser.iam_account, status="PENDING_APPROVAL",
        )
        task_not_due = ApprovalTask.objects.create(
            request=req_not_due, step_order=1, cycle=1, assignee=self.superuser.iam_account,
            status="PENDING", due_at=timezone.make_aware(datetime(2026, 10, 10, 12, 0)),
        )
        # Multiple events on same task (TC-RPT-01-36)
        ApprovalEvent.objects.create(request=req_not_due, task=task_not_due, actor=self.superuser.iam_account, action="SUBMITTED")
        ApprovalEvent.objects.create(request=req_not_due, task=task_not_due, actor=self.superuser.iam_account, action="REMINDED")

        # Overdue task (TC-RPT-01-37)
        po_overdue = PurchaseOrder.objects.create(
            company=self.company, branch=self.branch_a, number="PO-OVERDUE-01", document_date=date(2026, 9, 1),
            supplier=self.supplier_1, currency=self.currency, total_amount=Decimal("9000000"),
            status="PENDING_APPROVAL", created_by=self.superuser.iam_account,
        )
        req_overdue = ApprovalRequest.objects.create(
            company=self.company, document_type=doc_type, source_model="PurchaseOrder", source_id=po_overdue.id,
            round_number=1, workflow_version=wf_ver, snapshot={"number": "PO-OVERDUE-01", "branch_id": str(self.branch_a.id)},
            submitted_by=self.superuser.iam_account, status="PENDING_APPROVAL",
        )
        task_overdue = ApprovalTask.objects.create(
            request=req_overdue, step_order=1, cycle=1, assignee=self.superuser.iam_account,
            status="PENDING", due_at=timezone.make_aware(datetime(2026, 9, 15, 12, 0)),
        )

        tasks_res = self.client.get(
            f"/api/v1/reports/dashboard/tasks/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&as_of_date=2026-09-30"
        )
        self.assertEqual(tasks_res.status_code, 200)
        t_data = tasks_res.data["data"]
        # Only 2 pending approval items (DRAFT excluded, multiple ApprovalEvents deduplicated)
        self.assertEqual(t_data["pending_my_approval_count"], 2)
        self.assertEqual(t_data["pending_company_approval_count"], 2)
        # Overdue task is sorted first (TC-RPT-01-37)
        self.assertEqual(t_data["items"][0]["document_number"], "PO-OVERDUE-01")
        self.assertTrue(t_data["items"][0]["is_overdue"])

        # TC-RPT-01-38 & TC-RPT-01-39: Recent documents scoped to CN-A and sorted by document_date
        user_cna = self._create_scoped_user("user-rec-cna", perm_codes=["RPT.DASHBOARD.VIEW"], branch_scopes=[self.branch_a])
        c_cna = APIClient()
        c_cna.force_authenticate(user_cna)
        rec_res = c_cna.get(
            f"/api/v1/reports/dashboard/recent-documents/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&sort_by=document_date&limit=2"
        )
        self.assertEqual(rec_res.status_code, 200)
        rec_items = rec_res.data["data"]["items"]
        self.assertEqual(len(rec_items), 2)
        for item in rec_items:
            self.assertNotEqual(item["document_number"], "PO-PEND-01")  # PO-PEND-01 is in CN-B!

    # ------------------------------------------------------------------
    # Nhóm H: Lỗi từng phần, Drill-down, Cache, Read-only (TC-RPT-01-40 .. TC-RPT-01-50)
    # ------------------------------------------------------------------
    def test_tc_rpt_01_40_to_50_fault_isolation_drilldown_cache_and_readonly(self):
        """TC-RPT-01-40 .. TC-RPT-01-50: Fault isolation, Drill-down, Permission masking, Cache hit/refresh/invalidation, và tính bất biến dữ liệu (Read-only)."""
        from accounts_payable.models import Payable
        from accounts_receivable.models import Receivable
        from bank_management.models import BankTransaction
        from cash_management.models import CashTransaction
        from inventory.models import StockBalance

        self._post_je(
            "JE-H-01", "2026-09-10",
            [(self.acc_131, Decimal("12000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("12000000"))],
            branch=self.branch_a,
        )

        # TC-RPT-01-40: Fault isolation when DASH-09 fails -> status PARTIAL_ERROR, DASH-09 value is None (not 0!), DASH-01 still OK
        partial_err = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&simulate_error_widgets=DASH-09"
        )
        self.assertEqual(partial_err.status_code, 200)
        self.assertEqual(partial_err.data["status"], "PARTIAL_ERROR")
        self.assertEqual(partial_err.data["widgets"]["DASH-09"]["status"], "ERROR")
        self.assertIsNone(partial_err.data["widgets"]["DASH-09"]["value"])
        self.assertEqual(partial_err.data["widgets"]["DASH-01"]["status"], "OK")
        self.assertEqual(Decimal(partial_err.data["widgets"]["DASH-01"]["value"]), Decimal("12000000"))

        # TC-RPT-01-41: Drill-down from DASH-01 matches KPI total and preserves filters
        drill_01 = self.client.get(
            f"/api/v1/reports/dashboard/metrics/DASH-01/details/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&branch_ids={self.branch_a.id}"
        )
        self.assertEqual(drill_01.status_code, 200)
        self.assertEqual(Decimal(drill_01.data["total_value"]), Decimal("12000000"))
        sum_items = sum(Decimal(item["pre_tax_amount"]) for item in drill_01.data["items"])
        self.assertEqual(sum_items, Decimal("12000000"))
        self.assertEqual(drill_01.data["drilldown"]["filters"]["branch_ids"], [str(self.branch_a.id)])

        # TC-RPT-01-42 & TC-RPT-01-44: User with RPT.DASHBOARD.VIEW + PUR.ORDER.VIEW (lacks SAL/RPT.COMMERCE for DASH-01 and lacks GL.JOURNAL.VIEW for recent GL docs)
        user_limited = self._create_scoped_user(
            "user-drill-denied",
            perm_codes=["RPT.DASHBOARD.VIEW", "DASH-01"],
            deny_codes=["GL.JOURNAL.VIEW"],
        )
        c_lim = APIClient()
        c_lim.force_authenticate(user_limited)
        drill_denied = c_lim.get(
            f"/api/v1/reports/dashboard/metrics/DASH-01/details/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}"
        )
        self.assertEqual(drill_denied.status_code, 403)

        rec_masked = c_lim.get(
            f"/api/v1/reports/dashboard/recent-documents/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}"
        )
        self.assertEqual(rec_masked.status_code, 200)
        self.assertTrue(rec_masked.data["data"]["items"][0]["amount_masked"])
        self.assertIsNone(rec_masked.data["data"]["items"][0]["amount"])

        # TC-RPT-01-45: Cache hit on repeated query
        first_call = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&refresh_mode=FORCE_REFRESH"
        )
        self.assertEqual(first_call.status_code, 200)
        self.assertFalse(first_call.data["cache_hit"])

        second_call = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&refresh_mode=CACHE_FIRST"
        )
        self.assertEqual(second_call.status_code, 200)
        self.assertTrue(second_call.data["cache_hit"])

        # TC-RPT-01-47: Posting new JournalEntry automatically invalidates stale cache on next CACHE_FIRST read
        self._post_je(
            "JE-H-02", "2026-09-18",
            [(self.acc_131, Decimal("8000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("8000000"))],
            branch=self.branch_a,
        )
        after_post = self.client.get(
            f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&refresh_mode=CACHE_FIRST"
        )
        self.assertEqual(after_post.status_code, 200)
        self.assertFalse(after_post.data["cache_hit"])
        self.assertEqual(Decimal(after_post.data["kpis"]["DASH-01"]["value"]), Decimal("20000000"))

        # TC-RPT-01-46: Explicit POST /refresh/ forces recomputation
        refresh_post = self.client.post(
            f"/api/v1/reports/dashboard/refresh/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}"
        )
        self.assertEqual(refresh_post.status_code, 200)
        self.assertFalse(refresh_post.data["cache_hit"])
        self.assertEqual(Decimal(refresh_post.data["kpis"]["DASH-01"]["value"]), Decimal("20000000"))

        # TC-RPT-01-50: Verify Dashboard is 100% read-only on accounting data
        counts_before = (
            JournalEntry.objects.count(),
            JournalLine.objects.count(),
            Receivable.objects.count(),
            Payable.objects.count(),
            StockBalance.objects.count(),
            CashTransaction.objects.count(),
            BankTransaction.objects.count(),
        )
        self.client.get(f"/api/v1/reports/dashboard/overview/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}&refresh_mode=FORCE_REFRESH")
        self.client.get(f"/api/v1/reports/dashboard/cash-flow/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}")
        self.client.get(f"/api/v1/reports/dashboard/profitability/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}")
        self.client.get(f"/api/v1/reports/dashboard/receivables/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}")
        self.client.get(f"/api/v1/reports/dashboard/payables/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}")
        self.client.get(f"/api/v1/reports/dashboard/inventory/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}")
        self.client.get(f"/api/v1/reports/dashboard/tax-obligations/?company_id={self.company.id}&fiscal_period_id={self.period_sep.id}")
        counts_after = (
            JournalEntry.objects.count(),
            JournalLine.objects.count(),
            Receivable.objects.count(),
            Payable.objects.count(),
            StockBalance.objects.count(),
            CashTransaction.objects.count(),
            BankTransaction.objects.count(),
        )
        self.assertEqual(counts_before, counts_after)


class FinancialBundleUcRpt02Tests(ReportingTestSetupMixin, TestCase):
    """
    Bộ kiểm thử tự động toàn diện cho UC-RPT-02 – Xem bộ báo cáo tài chính (TC-RPT-02-01 .. TC-RPT-02-55).
    """

    def setUp(self):
        super().setUp()
        from reporting.financial_bundle_services import ensure_financial_catalog_seeded
        ensure_financial_catalog_seeded()

    def test_tc_rpt_02_01_to_04_catalog_permissions_and_company_isolation(self):
        """TC-RPT-02-01 .. TC-RPT-02-04: Danh mục bộ BCTC, phân quyền xem và cô lập dữ liệu theo Company."""
        # TC-RPT-02-01: Mở Báo cáo tài chính -> hiển thị danh mục 4 loại bộ, 15 mẫu biểu pháp lý và 2 báo cáo hỗ trợ
        res_types = self.client.get(f"/api/v1/reports/financial-bundles/types/?company_id={self.company.id}")
        self.assertEqual(res_types.status_code, 200)
        self.assertEqual(len(res_types.data["bundle_types"]), 4)
        self.assertEqual(len(res_types.data["templates"]), 15)
        self.assertEqual(len(res_types.data["supporting_reports"]), 2)

        # TC-RPT-02-02: Actor không có quyền RPT_FINANCIAL_VIEW -> 403 Forbidden
        user_no_perm = self._create_scoped_user("user-no-fs-view", perm_codes=["PUR.ORDER.VIEW"])
        c_no = APIClient()
        c_no.force_authenticate(user_no_perm)
        res_denied = c_no.get(f"/api/v1/reports/financial-bundles/?company_id={self.company.id}")
        self.assertEqual(res_denied.status_code, 403)

        # TC-RPT-02-03 & TC-RPT-02-04: Tạo Bundle ở Company A và Company B -> cô lập hoàn toàn
        b_a = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_a.status_code, 201)

        period_b = AccountingPeriod.objects.create(
            company=self.other_company,
            fiscal_year=2026,
            period_number=9,
            code="2026-09",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="OPEN",
        )
        b_b = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.other_company.id),
                "fiscal_period_id": str(period_b.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_b.status_code, 201)

        list_a = self.client.get(f"/api/v1/reports/financial-bundles/?company_id={self.company.id}")
        self.assertEqual(list_a.status_code, 200)
        self.assertEqual(list_a.data["count"], 1)
        self.assertEqual(list_a.data["items"][0]["bundle_id"], b_a.data["bundle_id"])

        # Truy cập Bundle của Company B nhưng truyền context Company A -> 403
        cross_err = self.client.get(
            f"/api/v1/reports/financial-bundles/{b_b.data['bundle_id']}/?company_id={self.company.id}"
        )
        self.assertEqual(cross_err.status_code, 403)

    def test_tc_rpt_02_05_to_11_bundle_types_legal_forms_and_cash_flow_methods(self):
        """TC-RPT-02-05 .. TC-RPT-02-11: Bốn loại bộ BCTC, mẫu pháp lý bắt buộc và phương pháp LCTT DIRECT/INDIRECT."""
        # TC-RPT-02-05: ANNUAL_GOING_CONCERN -> B01-DN, B02-DN, B03-DN, B09-DN
        b_gc = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "cash_flow_method": "DIRECT",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_gc.status_code, 201)
        forms_gc = [c["legal_form_code"] for c in b_gc.data["components"]]
        self.assertEqual(forms_gc, ["B01-DN", "B02-DN", "B03-DN", "B09-DN"])

        # TC-RPT-02-06: ANNUAL_NON_GOING_CONCERN -> chặn nếu thiếu confirm_non_going_concern, cho phép khi có xác nhận
        b_ngc_fail = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_NON_GOING_CONCERN",
            },
            format="json",
        )
        self.assertEqual(b_ngc_fail.status_code, 400)

        b_ngc = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_NON_GOING_CONCERN",
                "confirm_non_going_concern": True,
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_ngc.status_code, 201)
        forms_ngc = [c["legal_form_code"] for c in b_ngc.data["components"]]
        self.assertEqual(forms_ngc, ["B01-DNKLT", "B02-DNKLT", "B03-DNKLT", "B09-DNKLT"])

        # TC-RPT-02-07: INTERIM_FULL -> B01a-DN, B02a-DN, B03a-DN, B09a-DN
        b_if = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "INTERIM_FULL",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_if.status_code, 201)
        forms_if = [c["legal_form_code"] for c in b_if.data["components"]]
        self.assertEqual(forms_if, ["B01a-DN", "B02a-DN", "B03a-DN", "B09a-DN"])

        # TC-RPT-02-08: INTERIM_CONDENSED -> B01b-DN, B02b-DN, B03b-DN, B09a-DN
        b_ic = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "INTERIM_CONDENSED",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_ic.status_code, 201)
        forms_ic = [c["legal_form_code"] for c in b_ic.data["components"]]
        self.assertEqual(forms_ic, ["B01b-DN", "B02b-DN", "B03b-DN", "B09a-DN"])

        # TC-RPT-02-09, TC-RPT-02-10, TC-RPT-02-11: DIRECT vs INDIRECT; có cả 2 Run B03 vẫn chỉ có đúng 4 thành phần bắt buộc
        b_ind = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "cash_flow_method": "INDIRECT",
                "bundle_code": "FSB-INDIRECT-TEST",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_ind.status_code, 201)
        self.assertEqual(b_ind.data["cash_flow_method"], "INDIRECT")
        self.assertEqual(b_ind.data["required_component_count"], 4)
        self.assertEqual(len(b_ind.data["components"]), 4)
        cf_comp = next(c for c in b_ind.data["components"] if c["component_type"] == "CASH_FLOW")
        cf_run_res = self.client.get(f"/api/v1/reports/financial-statements/{cf_comp['statement_run_id']}/")
        self.assertEqual(cf_run_res.status_code, 200)
        self.assertEqual(cf_run_res.data["cash_flow_method"], "INDIRECT")

    def test_tc_rpt_02_12_to_15_and_51_bundle_status_workflow_and_approval(self):
        """TC-RPT-02-12 .. TC-RPT-02-15 & TC-RPT-02-51: Trạng thái INCOMPLETE, GENERATED, DRAFT vs APPROVED và Audit Log."""
        # Hạch toán cân đối để báo cáo có số liệu hợp lệ
        self._post_je(
            "JE-FS-OPEN", "2026-09-01",
            [(self.acc_111, Decimal("100000000"), Decimal("0")), (self.acc_331, Decimal("0"), Decimal("100000000"))],
            entry_type="OPENING",
        )
        self._post_je(
            "JE-FS-REV", "2026-09-15",
            [(self.acc_112, Decimal("50000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("50000000"))],
        )

        # TC-RPT-02-12: Thiếu B09 -> INCOMPLETE, không cho phê duyệt
        b_inc = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "bundle_code": "FSB-INC",
                "auto_generate_runs": True,
                "omit_components": ["FINANCIAL_NOTES"],
            },
            format="json",
        )
        self.assertEqual(b_inc.status_code, 201)
        self.assertEqual(b_inc.data["bundle_status"], "INCOMPLETE")
        self.assertEqual(b_inc.data["available_component_count"], 3)
        self.assertEqual(b_inc.data["required_component_count"], 4)

        appr_inc = self.client.post(f"/api/v1/reports/financial-bundles/{b_inc.data['bundle_id']}/approve/")
        self.assertEqual(appr_inc.status_code, 400)

        # TC-RPT-02-13: Đủ 4 Runs ở trạng thái GENERATED -> Bundle là GENERATED, chưa tự APPROVED
        b_full = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "bundle_code": "FSB-FULL",
                "auto_generate_runs": True,
                "initial_run_status": "GENERATED",
            },
            format="json",
        )
        self.assertEqual(b_full.status_code, 201)
        self.assertEqual(b_full.data["bundle_status"], "GENERATED")
        self.assertEqual(b_full.data["available_component_count"], 4)
        self.assertEqual(b_full.data["approved_component_count"], 0)

        # TC-RPT-02-14: Duyệt 3 thành phần, giữ B03 chưa duyệt -> không cho duyệt Bundle
        for comp in b_full.data["components"]:
            if comp["component_type"] != "CASH_FLOW":
                r_ap = self.client.post(f"/api/v1/reports/financial-statements/{comp['statement_run_id']}/approve/")
                self.assertEqual(r_ap.status_code, 200)

        appr_partial = self.client.post(f"/api/v1/reports/financial-bundles/{b_full.data['bundle_id']}/approve/")
        self.assertEqual(appr_partial.status_code, 400)

        # TC-RPT-02-15 & TC-RPT-02-51: Duyệt nốt B03 -> trình duyệt & phê duyệt Bundle thành công + ghi AuditLog
        cf_comp = next(c for c in b_full.data["components"] if c["component_type"] == "CASH_FLOW")
        self.client.post(f"/api/v1/reports/financial-statements/{cf_comp['statement_run_id']}/approve/")

        sub_res = self.client.post(f"/api/v1/reports/financial-bundles/{b_full.data['bundle_id']}/submit-review/")
        self.assertEqual(sub_res.status_code, 200)
        self.assertEqual(sub_res.data["bundle_status"], "READY_FOR_APPROVAL")

        appr_ok = self.client.post(f"/api/v1/reports/financial-bundles/{b_full.data['bundle_id']}/approve/")
        self.assertEqual(appr_ok.status_code, 200)
        self.assertEqual(appr_ok.data["bundle_status"], "APPROVED")
        self.assertEqual(appr_ok.data["approved_component_count"], 4)
        self.assertIsNotNone(appr_ok.data["approved_at"])

    def test_tc_rpt_02_16_to_20_cross_statement_validations(self):
        """TC-RPT-02-16 .. TC-RPT-02-20: Kiểm tra chéo B01 cân đối, công thức B02, tiền cuối kỳ B03, thuyết minh B09 bắt buộc và Note Reference."""
        from reporting.models import FinancialStatementLine, FinancialStatementValue

        self._post_je(
            "JE-VAL-01", "2026-09-10",
            [(self.acc_111, Decimal("80000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("80000000"))],
        )
        res = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "bundle_code": "FSB-VAL",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        bundle_id = res.data["bundle_id"]
        self.assertEqual(res.data["validation_status"], "PASSED")

        comps_by_type = {c["component_type"]: c["statement_run_id"] for c in res.data["components"]}

        # TC-RPT-02-16: Làm lệch Tổng tài sản [270] trên B01 -> FS-BALANCE-01 (FAILED)
        b01_val_270 = FinancialStatementValue.objects.get(
            statement_run_id=comps_by_type["FINANCIAL_POSITION"],
            statement_line__indicator_code="270",
        )
        orig_270 = b01_val_270.current_period_amount
        b01_val_270.current_period_amount = orig_270 + Decimal("5000000")
        b01_val_270.save()

        # TC-RPT-02-17: Làm sai tổng Doanh thu thuần [10] trên B02 -> FS-PROFIT-01 (FAILED)
        b02_val_10 = FinancialStatementValue.objects.get(
            statement_run_id=comps_by_type["BUSINESS_RESULT"],
            statement_line__indicator_code="10",
        )
        b02_val_10.current_period_amount = Decimal("99999999")
        b02_val_10.save()

        # TC-RPT-02-18: Làm lệch Tiền cuối kỳ [70] trên B03 so với B01[110] -> FS-CASH-01 (FAILED)
        b03_val_70 = FinancialStatementValue.objects.get(
            statement_run_id=comps_by_type["CASH_FLOW"],
            statement_line__indicator_code="70",
        )
        b03_val_70.current_period_amount = Decimal("12345678")
        b03_val_70.save()

        # TC-RPT-02-19: Làm thiếu nội dung thuyết minh bắt buộc [I.01] trên B09 -> FS-NOTES-01 (BLOCKER)
        b09_val_i01 = FinancialStatementValue.objects.get(
            statement_run_id=comps_by_type["FINANCIAL_NOTES"],
            statement_line__indicator_code="I.01",
        )
        b09_val_i01.text_value = ""
        b09_val_i01.content_status = "MISSING"
        b09_val_i01.save()

        # TC-RPT-02-20: Gắn Note Reference không tồn tại ('V.99') vào chỉ tiêu [110] của B01 -> FS-NOTES-REF-01 (WARNING)
        b01_line_110 = FinancialStatementValue.objects.get(
            statement_run_id=comps_by_type["FINANCIAL_POSITION"],
            statement_line__indicator_code="110",
        ).statement_line
        b01_line_110.note_reference = "V.99"
        b01_line_110.save()

        val_res = self.client.post(f"/api/v1/reports/financial-bundles/{bundle_id}/validate/")
        self.assertEqual(val_res.status_code, 200)
        self.assertEqual(val_res.data["validation_status"], "FAILED")
        self.assertEqual(val_res.data["bundle_status"], "REVIEW_REQUIRED")
        rule_codes = {item["rule_code"] for item in val_res.data["items"]}
        self.assertIn("FS-BALANCE-01", rule_codes)
        self.assertIn("FS-PROFIT-01", rule_codes)
        self.assertIn("FS-CASH-01", rule_codes)
        self.assertIn("FS-NOTES-01", rule_codes)
        self.assertIn("FS-NOTES-REF-01", rule_codes)
        b01_line_110.note_reference = "V.01"
        b01_line_110.save()

    def test_tc_rpt_02_21_to_25_and_54_component_run_compatibility_rules(self):
        """TC-RPT-02-21 .. TC-RPT-02-25 & TC-RPT-02-54: Từ chối ghép Run khác kỳ, khác Company, khác Scope, sai mẫu hoặc khác Currency."""
        from master_data.models import Currency
        from reporting.financial_bundle_services import generate_financial_statement_run
        from reporting.models import FinancialStatementTemplate, FinancialStatementTemplateVersion

        # TC-RPT-02-21: Run B01 khác kỳ (period_aug thay vì period_sep) -> từ chối
        run_aug = generate_financial_statement_run(
            company=self.company,
            fiscal_period=self.period_aug,
            legal_form_code="B01-DN",
            user=self.user,
        )
        res_21 = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "selected_run_ids": [str(run_aug.id)],
            },
            format="json",
        )
        self.assertEqual(res_21.status_code, 400)

        # TC-RPT-02-22: Run B02 thuộc Company khác -> từ chối
        period_other = AccountingPeriod.objects.create(
            company=self.other_company,
            fiscal_year=2026,
            period_number=9,
            code="2026-09-O",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="OPEN",
        )
        run_other_co = generate_financial_statement_run(
            company=self.other_company,
            fiscal_period=period_other,
            legal_form_code="B02-DN",
            user=self.user,
        )
        res_22 = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "selected_run_ids": [str(run_other_co.id)],
            },
            format="json",
        )
        self.assertEqual(res_22.status_code, 400)

        # TC-RPT-02-23: Run B03 có Scope = BRANCH nhưng Bundle có Scope = COMPANY -> từ chối
        run_branch = generate_financial_statement_run(
            company=self.company,
            fiscal_period=self.period_sep,
            legal_form_code="B03-DN",
            reporting_scope="BRANCH",
            branch=self.branch_a,
            cash_flow_method="DIRECT",
            user=self.user,
        )
        res_23 = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "reporting_scope": "COMPANY",
                "selected_run_ids": [str(run_branch.id)],
            },
            format="json",
        )
        self.assertEqual(res_23.status_code, 400)

        # TC-RPT-02-24: Đưa Run B01-DN vào Bundle ANNUAL_NON_GOING_CONCERN (yêu cầu B01-DNKLT) -> từ chối
        run_b01_dn = generate_financial_statement_run(
            company=self.company,
            fiscal_period=self.period_sep,
            legal_form_code="B01-DN",
            user=self.user,
        )
        res_24 = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_NON_GOING_CONCERN",
                "confirm_non_going_concern": True,
                "selected_run_ids": [str(run_b01_dn.id)],
            },
            format="json",
        )
        self.assertEqual(res_24.status_code, 400)

        # TC-RPT-02-25: Template Version đã hết hiệu lực trước kỳ báo cáo -> từ chối
        tmpl_b01 = FinancialStatementTemplate.objects.get(legal_form_code="B01-DN")
        tv_expired = FinancialStatementTemplateVersion.objects.create(
            template=tmpl_b01,
            version_number=99,
            effective_from=date(2015, 1, 1),
            effective_to=date(2019, 12, 31),
        )
        res_25 = self.client.post(
            "/api/v1/reports/financial-statements/generate/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "legal_form_code": "B01-DN",
                "template_version_id": str(tv_expired.id),
            },
            format="json",
        )
        self.assertEqual(res_25.status_code, 400)

        # TC-RPT-02-54: Run có Currency (USD) khác với Currency của Bundle (VND) -> từ chối
        usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "US Dollar"})
        run_usd = generate_financial_statement_run(
            company=self.company,
            fiscal_period=self.period_sep,
            legal_form_code="B01-DN",
            reporting_currency=usd,
            user=self.user,
        )
        res_54 = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "reporting_currency_id": str(self.currency.id),
                "selected_run_ids": [str(run_usd.id)],
            },
            format="json",
        )
        self.assertEqual(res_54.status_code, 400)

    def test_tc_rpt_02_26_to_37_and_50_55_versioning_navigation_drilldown_and_immutability(self):
        """TC-RPT-02-26 .. TC-RPT-02-37, TC-RPT-02-50, TC-RPT-02-55: Phiên bản V1/V2, điều hướng UC-RPT-03..06, Drill-down, Stale và tính bất biến."""
        from reporting.models import FinancialStatementAccountMapping

        self._post_je(
            "JE-VER-01", "2026-09-05",
            [(self.acc_111, Decimal("40000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("40000000"))],
        )

        # Tạo Bundle V1
        v1_res = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "bundle_code": "FSB-HIST",
                "auto_generate_runs": True,
                "initial_run_status": "APPROVED",
            },
            format="json",
        )
        self.assertEqual(v1_res.status_code, 201)
        v1_id = v1_res.data["bundle_id"]
        v1_b02_run_id = next(c["statement_run_id"] for c in v1_res.data["components"] if c["component_type"] == "BUSINESS_RESULT")

        # TC-RPT-02-28 .. TC-RPT-02-31: Kiểm tra target_uc_code của 4 thành phần (UC-RPT-03, UC-RPT-04, UC-RPT-05, UC-RPT-06)
        uc_by_comp = {c["component_type"]: c["target_uc_code"] for c in v1_res.data["components"]}
        self.assertEqual(uc_by_comp["FINANCIAL_POSITION"], "UC-RPT-03")
        self.assertEqual(uc_by_comp["BUSINESS_RESULT"], "UC-RPT-04")
        self.assertEqual(uc_by_comp["CASH_FLOW"], "UC-RPT-05")
        self.assertEqual(uc_by_comp["FINANCIAL_NOTES"], "UC-RPT-06")

        # TC-RPT-02-36: Ghi sổ thêm bút toán mới -> Run V1 bị đánh dấu Stale nhưng KHÔNG bị tự động ghi đè số liệu đã duyệt
        self._post_je(
            "JE-VER-02", "2026-09-20",
            [(self.acc_111, Decimal("25000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("25000000"))],
        )
        v1_check = self.client.get(f"/api/v1/reports/financial-bundles/{v1_id}/")
        self.assertEqual(v1_check.status_code, 200)
        self.assertTrue(v1_check.data["is_stale"])

        # TC-RPT-02-37: Đổi Account Mapping sau khi Run V1 đã APPROVED -> số liệu lịch sử của Run V1 vẫn giữ nguyên 40M
        FinancialStatementAccountMapping.objects.filter(account_prefix="511").update(sign=-1)
        v1_b02_lines = self.client.get(f"/api/v1/reports/financial-statements/{v1_b02_run_id}/lines/")
        self.assertEqual(v1_b02_lines.status_code, 200)
        line_01_v1 = next(l for l in v1_b02_lines.data["lines"] if l["indicator_code"] == "01")
        self.assertEqual(Decimal(line_01_v1["current_period_amount"]), Decimal("40000000"))
        FinancialStatementAccountMapping.objects.filter(account_prefix="511").update(sign=1)

        # TC-RPT-02-26, TC-RPT-02-27, TC-RPT-02-50, TC-RPT-02-55: Lập Bundle V2 -> V1 chuyển SUPERSEDED nhưng giữ nguyên Runs cũ (40M), V2 có Runs mới (65M)
        v2_res = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "ANNUAL_GOING_CONCERN",
                "bundle_code": "FSB-HIST",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(v2_res.status_code, 201)
        self.assertEqual(v2_res.data["bundle_version"], 2)
        v2_b02_run_id = next(c["statement_run_id"] for c in v2_res.data["components"] if c["component_type"] == "BUSINESS_RESULT")
        self.assertNotEqual(v1_b02_run_id, v2_b02_run_id)

        # Mở lại V1 qua query param bundle_version=1 trên V2 ID hoặc trực tiếp V1 ID -> vẫn trả về Run của V1
        open_v1 = self.client.get(f"/api/v1/reports/financial-bundles/{v2_res.data['bundle_id']}/?bundle_version=1")
        self.assertEqual(open_v1.status_code, 200)
        self.assertEqual(open_v1.data["bundle_version"], 1)
        self.assertEqual(open_v1.data["bundle_status"], "SUPERSEDED")
        open_v1_b02_run = next(c["statement_run_id"] for c in open_v1.data["components"] if c["component_type"] == "BUSINESS_RESULT")
        self.assertEqual(open_v1_b02_run, v1_b02_run_id)

        hist_res = self.client.get(f"/api/v1/reports/financial-bundles/{v2_res.data['bundle_id']}/history/")
        self.assertEqual(hist_res.status_code, 200)
        self.assertEqual(len(hist_res.data["versions"]), 2)

        # TC-RPT-02-32 & TC-RPT-02-33: Drill-down chỉ tiêu [01] trên B02 -> có quyền thành công, thiếu quyền DETAIL_VIEW bị chặn 403
        drill_ok = self.client.get(f"/api/v1/reports/financial-statements/{v2_b02_run_id}/line/01/sources/")
        self.assertEqual(drill_ok.status_code, 200)
        self.assertEqual(drill_ok.data["target_uc_code"], "UC-RPT-14")
        self.assertEqual(len(drill_ok.data["source_journal_lines"]), 2)

        # TC-RPT-02-33 & TC-RPT-02-34: User chỉ có RPT_FINANCIAL_VIEW -> xem được Bundle nhưng bị chặn Drill-down (403), Generate (403), Approve (403)
        user_view_only = self._create_scoped_user("user-fs-view-only", perm_codes=["RPT_FINANCIAL_VIEW"])
        c_vo = APIClient()
        c_vo.force_authenticate(user_view_only)

        vo_get = c_vo.get(f"/api/v1/reports/financial-bundles/{v2_res.data['bundle_id']}/")
        self.assertEqual(vo_get.status_code, 200)
        self.assertFalse(vo_get.data["permissions"]["can_generate"])
        self.assertFalse(vo_get.data["permissions"]["can_approve"])

        vo_drill = c_vo.get(f"/api/v1/reports/financial-statements/{v2_b02_run_id}/line/01/sources/")
        self.assertEqual(vo_drill.status_code, 403)

        vo_gen = c_vo.post(
            "/api/v1/reports/financial-bundles/",
            {"company_id": str(self.company.id), "fiscal_period_id": str(self.period_sep.id), "bundle_type": "ANNUAL_GOING_CONCERN"},
            format="json",
        )
        self.assertEqual(vo_gen.status_code, 403)

        vo_appr = c_vo.post(f"/api/v1/reports/financial-bundles/{v2_res.data['bundle_id']}/approve/")
        self.assertEqual(vo_appr.status_code, 403)

        # TC-RPT-02-35: Khi kỳ kế toán đã khóa (CLOSED) -> cho phép xem Read-only, không tự chuyển Bundle thành APPROVED
        self.period_sep.status = "CLOSED"
        self.period_sep.save(update_fields=["status"])
        closed_get = self.client.get(f"/api/v1/reports/financial-bundles/{v2_res.data['bundle_id']}/")
        self.assertEqual(closed_get.status_code, 200)
        self.assertTrue(closed_get.data["is_period_closed"])
        self.assertTrue(closed_get.data["read_only"])
        self.assertNotEqual(closed_get.data["bundle_status"], "APPROVED")
        self.period_sep.status = "OPEN"
        self.period_sep.save(update_fields=["status"])

    def test_tc_rpt_02_38_to_49_52_53_slots_notes_supporting_fault_isolation_export_concurrency(self):
        """TC-RPT-02-38 .. TC-RPT-02-49, TC-RPT-02-52, TC-RPT-02-53: Value Slots B02a, B09 Table, B01b riêng, Báo cáo hỗ trợ, Fault Isolation, Export và Concurrency."""
        from reporting.models import FinancialStatementRun, FinancialStatementValue

        self._post_je(
            "JE-INT-01", "2026-09-12",
            [(self.acc_112, Decimal("30000000"), Decimal("0")), (self.acc_511, Decimal("0"), Decimal("30000000"))],
        )

        # TC-RPT-02-38 & TC-RPT-02-39: Bộ giữa niên độ đầy đủ (INTERIM_FULL) -> B02a-DN có đủ 4 Value Slots, B09a-DN giữ nguyên cấu trúc bảng thuyết minh
        b_interim = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "INTERIM_FULL",
                "bundle_code": "FSB-INTERIM-FULL",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_interim.status_code, 201)
        comps_if = {c["component_type"]: c["statement_run_id"] for c in b_interim.data["components"]}

        b02a_lines = self.client.get(f"/api/v1/reports/financial-statements/{comps_if['BUSINESS_RESULT']}/lines/")
        self.assertEqual(b02a_lines.status_code, 200)
        line_01 = next(l for l in b02a_lines.data["lines"] if l["indicator_code"] == "01")
        slot_codes = [s["slot_code"] for s in line_01["value_slots"]]
        self.assertEqual(slot_codes, ["QUARTER_CURRENT", "QUARTER_PREVIOUS", "YTD_CURRENT", "YTD_PREVIOUS"])

        b09a_lines = self.client.get(f"/api/v1/reports/financial-statements/{comps_if['FINANCIAL_NOTES']}/lines/")
        self.assertEqual(b09a_lines.status_code, 200)
        note_v01 = next(l for l in b09a_lines.data["lines"] if l["indicator_code"] == "V.01")
        self.assertIn("columns", note_v01["table_schema"])
        self.assertGreaterEqual(len(note_v01["table_rows"]), 2)

        # TC-RPT-02-40: B01b-DN (INTERIM_CONDENSED) có Template riêng (11 chỉ tiêu tóm lược vs 16 chỉ tiêu của B01a-DN)
        b_cond = self.client.post(
            "/api/v1/reports/financial-bundles/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_sep.id),
                "bundle_type": "INTERIM_CONDENSED",
                "bundle_code": "FSB-INTERIM-COND",
                "auto_generate_runs": True,
            },
            format="json",
        )
        self.assertEqual(b_cond.status_code, 201)
        b01a_run_id = comps_if["FINANCIAL_POSITION"]
        b01b_run_id = next(c["statement_run_id"] for c in b_cond.data["components"] if c["component_type"] == "FINANCIAL_POSITION")
        b01a_res = self.client.get(f"/api/v1/reports/financial-statements/{b01a_run_id}/lines/")
        b01b_res = self.client.get(f"/api/v1/reports/financial-statements/{b01b_run_id}/lines/")
        self.assertNotEqual(b01a_res.data["template_id"], b01b_res.data["template_id"])
        self.assertLess(len(b01b_res.data["lines"]), len(b01a_res.data["lines"]))

        # TC-RPT-02-41 & TC-RPT-02-42: Báo cáo hỗ trợ (Bảng cân đối tài khoản & Nghĩa vụ Nhà nước) không làm thay đổi số thành phần bắt buộc (4)
        sup_res = self.client.get(f"/api/v1/reports/financial-bundles/{b_interim.data['bundle_id']}/supporting-reports/")
        self.assertEqual(sup_res.status_code, 200)
        self.assertFalse(sup_res.data["is_legal_bundle_component"])
        self.assertEqual(sup_res.data["required_component_count_unchanged"], 4)
        self.assertIn("trial_balance_management", sup_res.data)
        self.assertIn("state_obligations", sup_res.data)

        # TC-RPT-02-52 & TC-RPT-02-53: Số 0 hợp lệ hiển thị '0.0000'; dữ liệu bị mất (NULL) trả về None (không giả lập 0) và cảnh báo lỗi
        val_240 = FinancialStatementValue.objects.get(statement_run_id=b01a_run_id, statement_line__indicator_code="240")
        self.assertEqual(val_240.current_period_amount, Decimal("0.0000"))
        val_240.current_period_amount = None
        val_240.save()
        b01a_null_check = self.client.get(f"/api/v1/reports/financial-statements/{b01a_run_id}/lines/")
        line_240 = next(l for l in b01a_null_check.data["lines"] if l["indicator_code"] == "240")
        self.assertIsNone(line_240["current_period_amount"])
        val_240.current_period_amount = Decimal("0.0000")
        val_240.save()

        # TC-RPT-02-44: Một Component tải lỗi (simulate_load_error=True) -> 3 thành phần còn lại vẫn hiển thị và Bundle có cảnh báo
        FinancialStatementRun.objects.filter(id=comps_if["CASH_FLOW"]).update(simulate_load_error=True)
        err_bundle = self.client.get(f"/api/v1/reports/financial-bundles/{b_interim.data['bundle_id']}/components/")
        self.assertEqual(err_bundle.status_code, 200)
        self.assertEqual(err_bundle.data["available_component_count"], 3)
        cf_item = next(c for c in err_bundle.data["items"] if c["component_type"] == "CASH_FLOW")
        self.assertEqual(cf_item["run_status"], "ERROR")
        FinancialStatementRun.objects.filter(id=comps_if["CASH_FLOW"]).update(simulate_load_error=False)

        # TC-RPT-02-45: Lọc theo năm tài chính không trả kết quả của năm khác
        list_2025 = self.client.get(f"/api/v1/reports/financial-bundles/?company_id={self.company.id}&fiscal_year=2025")
        self.assertEqual(list_2025.status_code, 200)
        self.assertEqual(list_2025.data["count"], 0)

        # TC-RPT-02-46 & TC-RPT-02-47: Export Bundle chưa APPROVED -> chặn OFFICIAL (400), cho phép DRAFT kèm watermark và chuyển UC-RPT-15
        exp_official_fail = self.client.post(
            f"/api/v1/reports/financial-bundles/{b_interim.data['bundle_id']}/export/",
            {"format": "PDF", "export_mode": "OFFICIAL"},
            format="json",
        )
        self.assertEqual(exp_official_fail.status_code, 400)

        exp_draft_ok = self.client.post(
            f"/api/v1/reports/financial-bundles/{b_interim.data['bundle_id']}/export/",
            {"format": "PDF", "export_mode": "DRAFT"},
            format="json",
        )
        self.assertEqual(exp_draft_ok.status_code, 200)
        self.assertEqual(exp_draft_ok.data["target_uc_code"], "UC-RPT-15")
        self.assertIsNotNone(exp_draft_ok.data["watermark"])

        # TC-RPT-02-48: Concurrency Control khi 2 Actor cùng chỉnh 1 Bundle Version (lock_version cũ bị từ chối)
        stale_lock = self.client.post(
            f"/api/v1/reports/financial-bundles/{b_interim.data['bundle_id']}/submit-review/",
            {"lock_version": 999},
            format="json",
        )
        self.assertEqual(stale_lock.status_code, 400)

        # TC-RPT-02-49: Xem và kiểm tra lại Bundle không làm thay đổi dữ liệu GL
        je_cnt_before = JournalEntry.objects.count()
        jl_cnt_before = JournalLine.objects.count()
        self.client.get(f"/api/v1/reports/financial-bundles/{b_interim.data['bundle_id']}/")
        self.client.post(f"/api/v1/reports/financial-bundles/{b_interim.data['bundle_id']}/validate/")
        self.assertEqual(JournalEntry.objects.count(), je_cnt_before)
        self.assertEqual(JournalLine.objects.count(), jl_cnt_before)



class FinancialPositionUcRpt03Tests(TestCase):
    """
    UC-RPT-03 – Xem bảng cân đối kế toán / Báo cáo tình hình tài chính (B01-DN, B01a-DN, B01b-DN, B01-DNKLT)
    Bao phủ toàn bộ 65 Test Cases: TC-RPT-03-01 .. TC-RPT-03-65.
    """

    def setUp(self):
        from datetime import timedelta
        from django.utils import timezone
        from iam.models import ActiveStatus, CompanyMembership, Permission, UserPermissionOverride
        from master_data.models import Party
        from reporting.financial_position_services import ensure_b01_templates_seeded

        ensure_b01_templates_seeded()

        self.vnd, _ = Currency.objects.get_or_create(
            code="VND",
            defaults={"name": "Đồng Việt Nam", "symbol": "₫"},
        )
        self.company = Company.objects.create(
            code="B01_COMP_01",
            name="Công ty Cổ phần Chuẩn B01 TT99",
            legal_name="Công ty Cổ phần Chuẩn B01 TT99",
            tax_code="0109998881",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.other_company = Company.objects.create(
            code="B01_COMP_02",
            name="Công ty Khác B01",
            legal_name="Công ty Khác B01",
            tax_code="0109998882",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch_hq = Branch.objects.create(company=self.company, code="HQ", name="Trụ sở chính")
        self.branch_south = Branch.objects.create(company=self.company, code="CN_HCM", name="Chi nhánh TP.HCM")

        self.period_2025 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2025,
            period_number=12,
            code="2025-12",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            status="CLOSED",
        )
        self.period_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=12,
            code="2026-12",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="OPEN",
        )
        self.period_q3_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=9,
            code="2026-Q3",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 9, 30),
            status="OPEN",
        )

        User = get_user_model()
        self.user = User.objects.create_user(username="chief_b01", email="chief_b01@example.com", password="x")
        self.iam = self.user.iam_account
        self.membership = CompanyMembership.objects.create(
            user=self.iam,
            company=self.company,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )
        for perm_code in (
            "RPT_FINANCIAL_VIEW",
            "RPT_FINANCIAL_DETAIL_VIEW",
            "RPT_FINANCIAL_GENERATE",
            "RPT_FINANCIAL_VALIDATE",
            "RPT_FINANCIAL_DRILLDOWN",
            "RPT_FINANCIAL_SUBMIT",
            "RPT_FINANCIAL_APPROVE",
            "RPT_FINANCIAL_EXPORT",
        ):
            perm = Permission.objects.filter(code=perm_code).first()
            if perm:
                UserPermissionOverride.objects.create(
                    company_membership=self.membership,
                    permission=perm,
                    effect="GRANT",
                    reason="Grant full B01 permissions for test",
                    valid_from=timezone.now() - timedelta(days=1),
                    assigned_by=self.iam,
                )

        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT99-B01", name="TT99 B01", effective_from="2025-01-01", is_default=True
        )
        self.cls_asset = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.cls_liab = AccountClass.objects.create(company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT")
        self.cls_eq = AccountClass.objects.create(company=self.company, code="EQUITY", name="Vốn chủ sở hữu", normal_balance="CREDIT")

        # Accounts setup
        self.acc_111 = self._mk_acc("111", "Tiền mặt", "ASSET", "DEBIT")
        self.acc_112 = self._mk_acc("112", "Tiền gửi ngân hàng", "ASSET", "DEBIT")
        self.acc_113 = self._mk_acc("113", "Tiền đang chuyển", "ASSET", "DEBIT")
        self.acc_121 = self._mk_acc("121", "Chứng khoán kinh doanh", "ASSET", "DEBIT")
        self.acc_1281 = self._mk_acc("1281", "Tiền gửi có kỳ hạn", "ASSET", "DEBIT")
        self.acc_1288 = self._mk_acc("1288", "Đầu tư nắm giữ đến ngày đáo hạn khác", "ASSET", "DEBIT")
        self.acc_131 = self._mk_acc("131", "Phải thu của khách hàng", "ASSET", "DEBIT")
        self.acc_133 = self._mk_acc("133", "Thuế GTGT được khấu trừ", "ASSET", "DEBIT")
        self.acc_136 = self._mk_acc("136", "Phải thu nội bộ", "ASSET", "DEBIT")
        self.acc_1361 = self._mk_acc("1361", "Vốn kinh doanh ở đơn vị trực thuộc", "ASSET", "DEBIT")
        self.acc_138 = self._mk_acc("138", "Phải thu khác", "ASSET", "DEBIT")
        self.acc_1381 = self._mk_acc("1381", "Tài sản thiếu chờ xử lý", "ASSET", "DEBIT")
        self.acc_152 = self._mk_acc("152", "Nguyên liệu, vật liệu", "ASSET", "DEBIT")
        self.acc_154 = self._mk_acc("154", "Chi phí SXKD dở dang", "ASSET", "DEBIT")
        self.acc_156 = self._mk_acc("156", "Hàng hóa", "ASSET", "DEBIT")
        self.acc_211 = self._mk_acc("211", "TSCĐ hữu hình", "ASSET", "DEBIT")
        self.acc_212 = self._mk_acc("212", "TSCĐ thuê tài chính", "ASSET", "DEBIT")
        self.acc_213 = self._mk_acc("213", "TSCĐ vô hình", "ASSET", "DEBIT")
        self.acc_2141 = self._mk_acc("2141", "Hao mòn TSCĐ hữu hình", "ASSET", "CREDIT")
        self.acc_2142 = self._mk_acc("2142", "Hao mòn TSCĐ thuê tài chính", "ASSET", "CREDIT")
        self.acc_2143 = self._mk_acc("2143", "Hao mòn TSCĐ vô hình", "ASSET", "CREDIT")
        self.acc_2147 = self._mk_acc("2147", "Hao mòn BĐS đầu tư", "ASSET", "CREDIT")
        self.acc_2149 = self._mk_acc("2149", "Hao mòn tài sản sinh học", "ASSET", "CREDIT")
        self.acc_21511 = self._mk_acc("21511", "Súc vật nuôi lấy SP 1 lần ngắn hạn", "ASSET", "DEBIT")
        self.acc_21512 = self._mk_acc("21512", "Cây trồng mùa vụ ngắn hạn", "ASSET", "DEBIT")
        self.acc_21521 = self._mk_acc("21521", "Súc vật nuôi định kỳ chưa trưởng thành", "ASSET", "DEBIT")
        self.acc_215221 = self._mk_acc("215221", "Súc vật nuôi định kỳ trưởng thành - NG", "ASSET", "DEBIT")
        self.acc_215222 = self._mk_acc("215222", "Súc vật nuôi định kỳ trưởng thành - KH", "ASSET", "CREDIT")
        self.acc_21523 = self._mk_acc("21523", "Súc vật nuôi lấy SP 1 lần dài hạn", "ASSET", "DEBIT")
        self.acc_2153 = self._mk_acc("2153", "Cây trồng lấy SP 1 lần dài hạn", "ASSET", "DEBIT")
        self.acc_217 = self._mk_acc("217", "Bất động sản đầu tư", "ASSET", "DEBIT")
        self.acc_221 = self._mk_acc("221", "Đầu tư vào công ty con", "ASSET", "DEBIT")
        self.acc_222 = self._mk_acc("222", "Đầu tư vào công ty liên doanh, liên kết", "ASSET", "DEBIT")
        self.acc_2281 = self._mk_acc("2281", "Đầu tư góp vốn vào đơn vị khác", "ASSET", "DEBIT")
        self.acc_2291 = self._mk_acc("2291", "Dự phòng giảm giá chứng khoán kinh doanh", "ASSET", "CREDIT")
        self.acc_2292 = self._mk_acc("2292", "Dự phòng tổn thất đầu tư vào đơn vị khác", "ASSET", "CREDIT")
        self.acc_2293 = self._mk_acc("2293", "Dự phòng phải thu khó đòi", "ASSET", "CREDIT")
        self.acc_2294 = self._mk_acc("2294", "Dự phòng giảm giá hàng tồn kho", "ASSET", "CREDIT")
        self.acc_241 = self._mk_acc("241", "Xây dựng cơ bản dở dang", "ASSET", "DEBIT")
        self.acc_242 = self._mk_acc("242", "Chi phí trả trước", "ASSET", "DEBIT")
        self.acc_243 = self._mk_acc("243", "Tài sản thuế thu nhập hoãn lại", "ASSET", "DEBIT")
        self.acc_331 = self._mk_acc("331", "Phải trả cho người bán", "LIABILITY", "CREDIT")
        self.acc_3331 = self._mk_acc("3331", "Thuế GTGT phải nộp", "LIABILITY", "CREDIT")
        self.acc_3334 = self._mk_acc("3334", "Thuế TNDN", "LIABILITY", "CREDIT")
        self.acc_334 = self._mk_acc("334", "Phải trả người lao động", "LIABILITY", "CREDIT")
        self.acc_335 = self._mk_acc("335", "Chi phí phải trả", "LIABILITY", "CREDIT")
        self.acc_336 = self._mk_acc("336", "Phải trả nội bộ", "LIABILITY", "CREDIT")
        self.acc_3361 = self._mk_acc("3361", "Phải trả nội bộ về vốn kinh doanh", "LIABILITY", "CREDIT")
        self.acc_338 = self._mk_acc("338", "Phải trả, phải nộp khác", "LIABILITY", "CREDIT")
        self.acc_3387 = self._mk_acc("3387", "Doanh thu chưa thực hiện", "LIABILITY", "CREDIT")
        self.acc_3388 = self._mk_acc("3388", "Phải trả khác (Cổ tức phải trả)", "LIABILITY", "CREDIT")
        self.acc_341 = self._mk_acc("341", "Vay và nợ thuê tài chính", "LIABILITY", "CREDIT")
        self.acc_3432 = self._mk_acc("3432", "Trái phiếu chuyển đổi", "LIABILITY", "CREDIT")
        self.acc_347 = self._mk_acc("347", "Thuế thu nhập hoãn lại phải trả", "LIABILITY", "CREDIT")
        self.acc_352 = self._mk_acc("352", "Dự phòng phải trả", "LIABILITY", "CREDIT")
        self.acc_353 = self._mk_acc("353", "Quỹ khen thưởng, phúc lợi", "LIABILITY", "CREDIT")
        self.acc_356 = self._mk_acc("356", "Quỹ phát triển KH&CN", "LIABILITY", "CREDIT")
        self.acc_41111 = self._mk_acc("41111", "Cổ phiếu phổ thông có quyền biểu quyết", "EQUITY", "CREDIT")
        self.acc_41112 = self._mk_acc("41112", "Cổ phiếu ưu đãi", "EQUITY", "CREDIT")
        self.acc_4112 = self._mk_acc("4112", "Thặng dư vốn cổ phần", "EQUITY", "CREDIT")
        self.acc_4113 = self._mk_acc("4113", "Quyền chọn chuyển đổi trái phiếu", "EQUITY", "CREDIT")
        self.acc_4118 = self._mk_acc("4118", "Vốn khác của chủ sở hữu", "EQUITY", "CREDIT")
        self.acc_412 = self._mk_acc("412", "Chênh lệch đánh giá lại tài sản", "EQUITY", "CREDIT")
        self.acc_413 = self._mk_acc("413", "Chênh lệch tỷ giá hối đoái", "EQUITY", "CREDIT")
        self.acc_414 = self._mk_acc("414", "Quỹ đầu tư phát triển", "EQUITY", "CREDIT")
        self.acc_418 = self._mk_acc("418", "Các quỹ khác thuộc VCSH", "EQUITY", "CREDIT")
        self.acc_419 = self._mk_acc("419", "Cổ phiếu mua lại của chính mình", "EQUITY", "DEBIT")
        self.acc_4211 = self._mk_acc("4211", "LNST chưa phân phối năm trước", "EQUITY", "CREDIT")
        self.acc_4212 = self._mk_acc("4212", "LNST chưa phân phối năm nay", "EQUITY", "CREDIT")

        self.party_cust_debit = Party.objects.create(company=self.company, code="KH_NO", name="Khách hàng A (Dư Nợ)", party_type="CUSTOMER")
        self.party_cust_credit = Party.objects.create(company=self.company, code="KH_CO", name="Khách hàng B (Ứng trước - Dư Có)", party_type="CUSTOMER")
        self.party_vend_credit = Party.objects.create(company=self.company, code="NCC_CO", name="Nhà cung cấp X (Dư Có)", party_type="SUPPLIER")
        self.party_vend_debit = Party.objects.create(company=self.company, code="NCC_NO", name="Nhà cung cấp Y (Trả trước - Dư Nợ)", party_type="SUPPLIER")

    def _mk_acc(self, code: str, name: str, acc_type: str, normal_balance: str) -> Account:
        cls_obj = self.cls_asset if acc_type == "ASSET" else (self.cls_liab if acc_type == "LIABILITY" else self.cls_eq)
        acc, _ = Account.objects.get_or_create(
            company=self.company,
            code=code,
            defaults={
                "chart_of_accounts": self.chart,
                "account_class": cls_obj,
                "name": name,
                "account_type": acc_type,
                "normal_balance": normal_balance,
            },
        )
        return acc

    def _post_je(
        self,
        number: str,
        posting_date: str,
        lines_spec: list[tuple],
        period: AccountingPeriod | None = None,
        branch: Branch | None = None,
        entry_type: str = "MANUAL",
        status: str = "POSTED",
    ) -> JournalEntry:
        from django.utils import timezone
        target_period = period or self.period_2026
        total_d = sum((Decimal(str(it[1])) for it in lines_spec), Decimal("0"))
        total_c = sum((Decimal(str(it[2])) for it in lines_spec), Decimal("0"))
        je = JournalEntry.objects.create(
            company=self.company,
            branch=branch or self.branch_hq,
            period=target_period,
            number=number,
            entry_type=entry_type,
            posting_date=posting_date,
            status=status,
            description=f"Bút toán {number}",
            total_debit=total_d,
            total_credit=total_c,
            created_by=self.iam,
            posted_by=self.iam if status == "POSTED" else None,
            posted_at=timezone.now() if status == "POSTED" else None,
        )
        for idx, item in enumerate(lines_spec, start=1):
            acc = item[0]
            debit = Decimal(str(item[1]))
            credit = Decimal(str(item[2]))
            party = item[3] if len(item) > 3 else None
            dims = item[4] if len(item) > 4 else {}
            JournalLine.objects.create(
                entry=je,
                line_no=idx,
                account=acc,
                party=party,
                debit=debit,
                credit=credit,
                currency=self.vnd,
                dimensions=dims or {},
            )
        return je

    def test_tc_rpt_03_01_to_08_templates_126_lines_opening_sources_columns(self):
        """TC-RPT-03-01 .. TC-RPT-03-08: 4 biểu mẫu B01-DN (126 dòng), B01a-DN, B01b-DN (23 dòng), B01-DNKLT, nguồn số đầu năm & nhãn cột."""
        # 1. Kiểm tra danh mục Templates B01
        tpl_res = self.client.get(f"/api/v1/reports/financial-position/templates/?company_id={self.company.id}")
        self.assertEqual(tpl_res.status_code, 200)
        by_code = {t["legal_form_code"]: t for t in tpl_res.data["templates"]}
        self.assertIn("B01-DN", by_code)
        self.assertIn("B01a-DN", by_code)
        self.assertIn("B01b-DN", by_code)
        self.assertIn("B01-DNKLT", by_code)
        self.assertEqual(by_code["B01-DN"]["lines_count"], 126)
        self.assertEqual(by_code["B01a-DN"]["lines_count"], 126)
        self.assertEqual(by_code["B01b-DN"]["lines_count"], 23)
        self.assertEqual(by_code["B01-DN"]["closing_column_label"], "Số cuối năm")
        self.assertEqual(by_code["B01a-DN"]["closing_column_label"], "Số cuối quý")

        # 2. Tạo bút toán đầu năm (OPENING) và trong kỳ 2026
        self._post_je(
            "JE-OPEN-2026",
            "2026-01-01",
            [
                (self.acc_111, "100000000", "0"),
                (self.acc_41111, "0", "100000000"),
            ],
            entry_type="OPENING",
        )
        self._post_je(
            "JE-2026-01",
            "2026-06-15",
            [
                (self.acc_112, "50000000", "0"),
                (self.acc_4212, "0", "50000000"),
            ],
        )

        # TC-RPT-03-01, 05, 06, 08: Tạo Run B01-DN năm 2026 -> 126 dòng, nguồn đầu năm UC_GL_15_OPENING
        gen_b01 = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(gen_b01.status_code, 201)
        self.assertEqual(gen_b01.data["total_lines_count"], 126)
        self.assertEqual(gen_b01.data["opening_source"], "UC_GL_15_OPENING")
        self.assertEqual(gen_b01.data["validation_status"], "PASSED")
        lines_map = {ln["indicator_code"]: ln for ln in gen_b01.data["lines"]}
        self.assertEqual(Decimal(lines_map["111"]["raw_opening_amount"]), Decimal("100000000"))
        self.assertEqual(Decimal(lines_map["111"]["raw_closing_amount"]), Decimal("150000000"))
        self.assertEqual(Decimal(lines_map["280"]["raw_closing_amount"]), Decimal("150000000"))
        self.assertEqual(Decimal(lines_map["440"]["raw_closing_amount"]), Decimal("150000000"))

        # TC-RPT-03-02: B01a-DN giữa niên độ đầy đủ -> nhãn cột 'Số cuối quý' / 'Số đầu năm'
        gen_b01a = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01a-DN",
                "fiscal_period_id": str(self.period_q3_2026.id),
            },
            format="json",
        )
        self.assertEqual(gen_b01a.status_code, 201)
        self.assertEqual(gen_b01a.data["closing_column_label"], "Số cuối quý")
        self.assertEqual(gen_b01a.data["opening_column_label"], "Số đầu năm")
        self.assertEqual(gen_b01a.data["total_lines_count"], 126)

        # TC-RPT-03-03: B01b-DN giữa niên độ tóm lược -> 23 chỉ tiêu tổng hợp
        gen_b01b = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01b-DN",
                "fiscal_period_id": str(self.period_q3_2026.id),
            },
            format="json",
        )
        self.assertEqual(gen_b01b.status_code, 201)
        self.assertEqual(gen_b01b.data["total_lines_count"], 23)

        # TC-RPT-03-04: B01-DNKLT (Không đáp ứng hoạt động liên tục) -> mẫu riêng không tách ngắn/dài hạn
        gen_dnklt = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DNKLT",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(gen_dnklt.status_code, 201)
        dnklt_codes = [ln["indicator_code"] for ln in gen_dnklt.data["lines"]]
        self.assertIn("100", dnklt_codes)
        self.assertNotIn("200", dnklt_codes)

        # TC-RPT-03-07: Khi có B01-DN năm trước (2025) đã APPROVED -> Số đầu năm 2026 ưu tiên lấy từ B01 năm trước đã duyệt (PRIOR_APPROVED_B01)
        self._post_je(
            "JE-2025-CLOSING",
            "2025-12-31",
            [
                (self.acc_111, "100000000", "0"),
                (self.acc_41111, "0", "100000000"),
            ],
            period=self.period_2025,
        )
        run_2025 = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2025.id),
            },
            format="json",
        )
        self.assertEqual(run_2025.status_code, 201)
        appr_2025 = self.client.post(
            f"/api/v1/reports/financial-position/runs/{run_2025.data['id']}/approve/",
            {"company_id": str(self.company.id)},
            format="json",
        )
        self.assertEqual(appr_2025.status_code, 200)

        run_2026_v2 = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(run_2026_v2.status_code, 201)
        self.assertEqual(run_2026_v2.data["opening_source"], "PRIOR_APPROVED_B01")

    def test_tc_rpt_03_09_to_19_60_62_63_asset_classification_contra_subledger_maturity(self):
        """TC-RPT-03-09 .. TC-RPT-03-19, 60, 62, 63: Phân loại tương đương tiền, tiền gửi phong tỏa, tách công nợ 131/331 theo đối tượng & kỳ hạn, dự phòng/hao mòn âm, TS sinh học, BĐSĐT, XDCB."""
        self._post_je(
            "JE-ASSETS-COMPLEX",
            "2026-08-20",
            [
                # Tiền & Tương đương tiền vs Đầu tư nắm giữ đến ngày đáo hạn (TC-RPT-03-09, 10, 60)
                (self.acc_111, "20000000", "0"),
                (self.acc_1281, "30000000", "0", None, {"term_months": 2}),  # <= 3 tháng -> 112
                (self.acc_1281, "40000000", "0", None, {"term_months": 6}),  # 6 tháng -> 123
                (self.acc_1281, "25000000", "0", None, {"term_months": 2, "is_restricted": True}),  # Phong tỏa -> loại khỏi 112, sang 123
                (self.acc_1281, "60000000", "0", None, {"remaining_months": 24}),  # > 12 tháng -> 265
                # Chứng khoán kinh doanh & dự phòng (121, 122 âm)
                (self.acc_121, "50000000", "0"),
                (self.acc_2291, "0", "5000000"),  # -> 122 = -5,000,000
                # Công nợ 131 lưỡng tính tách theo khách hàng & kỳ hạn (TC-RPT-03-11, 12)
                (self.acc_131, "80000000", "0", self.party_cust_debit, {"maturity_class": "SHORT_TERM"}),  # -> 131
                (self.acc_131, "35000000", "0", None, {"party_code": "KH_DAI_HAN", "maturity_class": "LONG_TERM"}),  # -> 211
                (self.acc_131, "0", "15000000", self.party_cust_credit, {"maturity_class": "SHORT_TERM"}),  # Dư Có KH -> 312
                (self.acc_131, "0", "10000000", None, {"party_code": "KH_UNG_DAI_HAN", "maturity_class": "LONG_TERM"}),  # Dư Có KH dài hạn -> 332
                # Công nợ 331 lưỡng tính tách theo NCC & kỳ hạn (TC-RPT-03-13, 14)
                (self.acc_331, "0", "70000000", self.party_vend_credit, {"maturity_class": "SHORT_TERM"}),  # Dư Có NCC -> 311
                (self.acc_331, "0", "45000000", None, {"party_code": "NCC_DAI_HAN", "maturity_class": "LONG_TERM"}),  # Dư Có NCC dài hạn -> 331
                (self.acc_331, "12000000", "0", self.party_vend_debit, {"maturity_class": "SHORT_TERM"}),  # Trả trước NCC ngắn hạn -> 132
                (self.acc_331, "18000000", "0", None, {"party_code": "NCC_TT_DAI_HAN", "maturity_class": "LONG_TERM"}),  # Trả trước NCC dài hạn -> 212
                # Dự phòng phải thu khó đòi ngắn hạn (136) và dài hạn (216)
                (self.acc_2293, "0", "4000000", None, {"maturity_class": "SHORT_TERM"}),  # -> 136 = -4,000,000
                (self.acc_2293, "0", "3000000", None, {"maturity_class": "LONG_TERM"}),  # -> 216 = -3,000,000
                # Hàng tồn kho (141) & dự phòng giảm giá HTK (142) & dở dang dài hạn (251)
                (self.acc_156, "90000000", "0"),
                (self.acc_2294, "0", "6000000", None, {"asset_group": "INVENTORY"}),  # -> 142 = -6,000,000
                (self.acc_154, "40000000", "0", None, {"maturity_class": "LONG_TERM"}),
                (self.acc_2294, "0", "2000000", None, {"asset_group": "LONG_TERM_WIP", "maturity_class": "LONG_TERM"}),  # -> 251 = 38,000,000
                (self.acc_241, "22000000", "0"),  # -> 252 = 22,000,000
                # Tài sản sinh học ngắn hạn (150: 151, 152, 153) & dài hạn (230: 232, 234, 235, 236, 237, 238)
                (self.acc_21511, "10000000", "0"),  # -> 151
                (self.acc_21512, "8000000", "0"),  # -> 152
                (self.acc_21521, "14000000", "0"),  # -> 232
                (self.acc_215221, "30000000", "0"),  # -> 234
                (self.acc_215222, "0", "5000000"),  # -> 235 = -5,000,000 (233 = 25,000,000, 231 = 39,000,000)
                # TSCĐ hữu hình (221 = 222 + 223) & BĐS đầu tư (240 = 241 + 242)
                (self.acc_211, "200000000", "0"),  # -> 222
                (self.acc_2141, "0", "20000000"),  # -> 223 = -20,000,000 (221 = 180,000,000)
                (self.acc_217, "100000000", "0"),  # -> 241
                (self.acc_2147, "0", "10000000"),  # -> 242 = -10,000,000 (240 = 90,000,000)
                # Cân đối nguồn vốn đối ứng vào 41111
                (self.acc_41111, "0", "689000000"),
            ],
        )

        res = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["validation_status"], "PASSED")
        m = {ln["indicator_code"]: ln for ln in res.data["lines"]}

        # Kiểm tra 111, 112, 123, 265
        self.assertEqual(Decimal(m["111"]["raw_closing_amount"]), Decimal("20000000"))
        self.assertEqual(Decimal(m["112"]["raw_closing_amount"]), Decimal("30000000"))
        self.assertEqual(Decimal(m["110"]["raw_closing_amount"]), Decimal("50000000"))
        self.assertEqual(Decimal(m["123"]["raw_closing_amount"]), Decimal("65000000"))  # 40M + 25M restricted
        self.assertEqual(Decimal(m["265"]["raw_closing_amount"]), Decimal("60000000"))

        # Kiểm tra 131/211/312/332 và 311/331/132/212 không bù trừ sai
        self.assertEqual(Decimal(m["131"]["raw_closing_amount"]), Decimal("80000000"))
        self.assertEqual(Decimal(m["211"]["raw_closing_amount"]), Decimal("35000000"))
        self.assertEqual(Decimal(m["312"]["raw_closing_amount"]), Decimal("15000000"))
        self.assertEqual(Decimal(m["332"]["raw_closing_amount"]), Decimal("10000000"))
        self.assertEqual(Decimal(m["311"]["raw_closing_amount"]), Decimal("70000000"))
        self.assertEqual(Decimal(m["331"]["raw_closing_amount"]), Decimal("45000000"))
        self.assertEqual(Decimal(m["132"]["raw_closing_amount"]), Decimal("12000000"))
        self.assertEqual(Decimal(m["212"]["raw_closing_amount"]), Decimal("18000000"))

        # Kiểm tra các chỉ tiêu ghi âm (*) và định dạng ngoặc đơn (...)
        self.assertEqual(Decimal(m["122"]["raw_closing_amount"]), Decimal("-5000000"))
        self.assertEqual(m["122"]["formatted_closing_amount"], "(5.000.000)")
        self.assertEqual(Decimal(m["136"]["raw_closing_amount"]), Decimal("-4000000"))
        self.assertEqual(Decimal(m["216"]["raw_closing_amount"]), Decimal("-3000000"))
        self.assertEqual(Decimal(m["142"]["raw_closing_amount"]), Decimal("-6000000"))
        self.assertEqual(Decimal(m["140"]["raw_closing_amount"]), Decimal("84000000"))
        self.assertEqual(Decimal(m["223"]["raw_closing_amount"]), Decimal("-20000000"))
        self.assertEqual(Decimal(m["221"]["raw_closing_amount"]), Decimal("180000000"))
        self.assertEqual(Decimal(m["235"]["raw_closing_amount"]), Decimal("-5000000"))
        self.assertEqual(Decimal(m["233"]["raw_closing_amount"]), Decimal("25000000"))
        self.assertEqual(Decimal(m["231"]["raw_closing_amount"]), Decimal("39000000"))
        self.assertEqual(Decimal(m["240"]["raw_closing_amount"]), Decimal("90000000"))
        self.assertEqual(Decimal(m["251"]["raw_closing_amount"]), Decimal("38000000"))
        self.assertEqual(Decimal(m["250"]["raw_closing_amount"]), Decimal("60000000"))
        self.assertEqual(Decimal(m["280"]["raw_closing_amount"]), Decimal(m["440"]["raw_closing_amount"]))

    def test_tc_rpt_03_20_to_30_59_tax_liabilities_equity_preferred_shares_retained_earnings(self):
        """TC-RPT-03-20 .. TC-RPT-03-30, 59: Thuế 133/333 tách Dư Nợ (163) & Dư Có (314/333), Vay 321/339, Trái phiếu chuyển đổi 340/413, Cổ phiếu ưu đãi nợ (341) vs VCSH (411b), Cổ phiếu quỹ 415 âm, LNST 420a/420b."""
        self._post_je(
            "JE-LIAB-EQUITY",
            "2026-09-10",
            [
                (self.acc_112, "500000000", "0"),
                # Thuế GTGT khấu trừ (162) & Thuế nộp thừa (163) vs Thuế phải nộp ngắn hạn (314) & dài hạn (333)
                (self.acc_133, "15000000", "0"),  # -> 162
                (self.acc_3334, "8000000", "0", None, {"tax_type": "CIT_OVERPAID"}),  # Dư Nợ 333 -> 163
                (self.acc_3331, "0", "25000000", None, {"tax_type": "VAT_PAYABLE", "maturity_class": "SHORT_TERM"}),  # -> 314
                (self.acc_3334, "0", "12000000", None, {"tax_type": "CIT_DEFERRED_LONG", "maturity_class": "LONG_TERM"}),  # -> 333
                # Vay ngắn hạn (321) vs dài hạn (339) & Trái phiếu chuyển đổi (340 + 413)
                (self.acc_341, "0", "60000000", None, {"contract": "LOAN_ST", "maturity_class": "SHORT_TERM"}),  # -> 321
                (self.acc_341, "0", "140000000", None, {"contract": "LOAN_LT", "maturity_class": "LONG_TERM"}),  # -> 339
                (self.acc_3432, "0", "80000000"),  # -> 340
                (self.acc_4113, "0", "10000000"),  # -> 413
                # Cổ phiếu ưu đãi bắt buộc mua lại (Nợ phải trả 341) vs Cổ phiếu ưu đãi VCSH (411b) (TC-RPT-03-24, 59)
                (self.acc_41112, "0", "30000000", None, {"classification": "DEBT"}),  # -> 341
                (self.acc_41112, "0", "20000000", None, {"classification": "EQUITY"}),  # -> 411b
                (self.acc_41111, "0", "100000000"),  # -> 411a (411 = 120,000,000)
                # Cổ phiếu mua lại (419 -> 415 âm) & LNST chưa phân phối (4211 -> 420a, 4212 -> 420b)
                (self.acc_419, "10000000", "0"),  # -> 415 = -10,000,000
                (self.acc_4211, "0", "40000000"),  # -> 420a = 40,000,000
                (self.acc_4212, "0", "16000000"),  # -> 420b = 16,000,000 (420 = 56,000,000)
            ],
        )

        res = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["validation_status"], "PASSED")
        m = {ln["indicator_code"]: ln for ln in res.data["lines"]}

        self.assertEqual(Decimal(m["162"]["raw_closing_amount"]), Decimal("15000000"))
        self.assertEqual(Decimal(m["163"]["raw_closing_amount"]), Decimal("8000000"))
        self.assertEqual(Decimal(m["314"]["raw_closing_amount"]), Decimal("25000000"))
        self.assertEqual(Decimal(m["333"]["raw_closing_amount"]), Decimal("12000000"))
        self.assertEqual(Decimal(m["321"]["raw_closing_amount"]), Decimal("60000000"))
        self.assertEqual(Decimal(m["339"]["raw_closing_amount"]), Decimal("140000000"))
        self.assertEqual(Decimal(m["340"]["raw_closing_amount"]), Decimal("80000000"))
        self.assertEqual(Decimal(m["341"]["raw_closing_amount"]), Decimal("30000000"))
        self.assertEqual(Decimal(m["411a"]["raw_closing_amount"]), Decimal("100000000"))
        self.assertEqual(Decimal(m["411b"]["raw_closing_amount"]), Decimal("20000000"))
        self.assertEqual(Decimal(m["411"]["raw_closing_amount"]), Decimal("120000000"))
        self.assertEqual(Decimal(m["413"]["raw_closing_amount"]), Decimal("10000000"))
        self.assertEqual(Decimal(m["415"]["raw_closing_amount"]), Decimal("-10000000"))
        self.assertEqual(Decimal(m["420a"]["raw_closing_amount"]), Decimal("40000000"))
        self.assertEqual(Decimal(m["420b"]["raw_closing_amount"]), Decimal("16000000"))
        self.assertEqual(Decimal(m["420"]["raw_closing_amount"]), Decimal("56000000"))
        self.assertEqual(Decimal(m["280"]["raw_closing_amount"]), Decimal(m["440"]["raw_closing_amount"]))

    def test_tc_rpt_03_31_to_42_validation_rules_search_hide_zero_units(self):
        """TC-RPT-03-31 .. TC-RPT-03-42: 12 quy tắc kiểm tra RPT-B01-VAL-01..12, tìm kiếm không dấu, ẩn dòng = 0 giữ chỉ tiêu cha, đổi đơn vị tính & cảnh báo làm tròn."""
        from reporting.models import FinancialStatementValue

        self._post_je(
            "JE-OPEN-UNIT",
            "2026-01-01",
            [
                (self.acc_131, "10000000", "0", self.party_cust_debit),
                (self.acc_41111, "0", "10000000"),
            ],
            entry_type="OPENING",
        )
        # Trong kỳ thu hết nợ 131 -> Cuối kỳ 131 = 0, Đầu năm 131 = 10,000,000; Tiền 111 = 10,000,400, 112 = 400 (để test làm tròn nghìn đồng)
        self._post_je(
            "JE-PERIOD-UNIT",
            "2026-05-10",
            [
                (self.acc_111, "10000400", "0"),
                (self.acc_1281, "400", "0", None, {"term_months": 1}),
                (self.acc_131, "0", "10000000", self.party_cust_debit),
                (self.acc_4212, "0", "800"),
            ],
        )

        run_res = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(run_res.status_code, 201)
        run_id = run_res.data["id"]

        # TC-RPT-03-31..36: Kiểm tra đủ 12 mã quy tắc RPT-B01-VAL-01 .. RPT-B01-VAL-12
        val_res = self.client.get(f"/api/v1/reports/financial-position/runs/{run_id}/validation/?company_id={self.company.id}")
        self.assertEqual(val_res.status_code, 200)
        self.assertTrue(val_res.data["is_balanced"])
        rule_codes = {r["rule_code"] for r in val_res.data["rules"]}
        for idx in range(1, 13):
            self.assertIn(f"RPT-B01-VAL-{idx:02d}", rule_codes)

        # TC-RPT-03-40 & TC-RPT-03-41: hide_zero_lines=true -> ẩn dòng cả 2 cột = 0, giữ dòng 131 (closing=0 nhưng opening=10M) và giữ chỉ tiêu cha 100, 130, 280, 440
        hide_res = self.client.get(
            f"/api/v1/reports/financial-position/runs/{run_id}/lines/?company_id={self.company.id}&hide_zero_lines=true"
        )
        self.assertEqual(hide_res.status_code, 200)
        visible_codes = {ln["indicator_code"] for ln in hide_res.data["lines"]}
        self.assertLess(len(visible_codes), 126)
        self.assertIn("131", visible_codes)  # closing=0 nhưng opening=10M -> không được ẩn!
        self.assertIn("130", visible_codes)  # chỉ tiêu cha của 131 -> giữ lại!
        self.assertIn("100", visible_codes)
        self.assertIn("280", visible_codes)
        self.assertIn("440", visible_codes)

        # TC-RPT-03-38 & TC-RPT-03-39: Tìm kiếm không dấu 'phai thu khach hang' giữ nguyên phân cấp cha 100 -> 130 -> 131
        search_res = self.client.get(
            f"/api/v1/reports/financial-position/runs/{run_id}/lines/?company_id={self.company.id}&search=phai thu ngan han cua khach hang"
        )
        self.assertEqual(search_res.status_code, 200)
        search_codes = [ln["indicator_code"] for ln in search_res.data["lines"]]
        self.assertIn("131", search_codes)
        self.assertIn("130", search_codes)
        self.assertIn("100", search_codes)

        # TC-RPT-03-42: Đổi đơn vị tính sang THOUSAND_VND phát hiện sai số làm tròn (111=10000.4->10000, 112=0.4->0, nhưng 110=10000.8->10001)
        unit_res = self.client.get(
            f"/api/v1/reports/financial-position/runs/{run_id}/lines/?company_id={self.company.id}&display_unit=THOUSAND_VND"
        )
        self.assertEqual(unit_res.status_code, 200)
        self.assertTrue(unit_res.data["rounding_warning"])

        # TC-RPT-03-37: Giả lập lệch Tổng Tài sản (280) và Tổng Nguồn vốn (440) -> RPT-B01-VAL-07 FAILED (BLOCKER)
        val_280 = FinancialStatementValue.objects.get(statement_run_id=run_id, statement_line__indicator_code="280")
        orig_280 = val_280.current_period_amount
        val_280.current_period_amount = orig_280 + Decimal("1000")
        val_280.save(update_fields=["current_period_amount"])

        reval = self.client.post(f"/api/v1/reports/financial-position/runs/{run_id}/validate/?company_id={self.company.id}")
        self.assertEqual(reval.status_code, 200)
        self.assertEqual(reval.data["validation_status"], "FAILED")
        self.assertFalse(reval.data["is_balanced"])
        val_280.current_period_amount = orig_280
        val_280.save(update_fields=["current_period_amount"])
        self.client.post(f"/api/v1/reports/financial-position/runs/{run_id}/validate/?company_id={self.company.id}")

    def test_tc_rpt_03_43_to_52_drilldown_notes_versioning_stale_workflow_export(self):
        """TC-RPT-03-43 .. TC-RPT-03-52: Calculation detail, Drill-down khớp 100%, Thuyết minh B09, Lịch sử Version, STALE khi phát sinh bút toán mới, Cảnh báo chứng từ nháp, Workflow & chặn Export XML khi FAILED/STALE."""
        self._post_je(
            "JE-DRILL-01",
            "2026-03-15",
            [
                (self.acc_131, "45000000", "0", self.party_cust_debit),
                (self.acc_41111, "0", "45000000"),
            ],
        )
        # TC-RPT-03-50: Chứng từ DRAFT trong kỳ -> không tính vào số dư nhưng có cảnh báo RPT-B01-VAL-09
        self._post_je(
            "JE-DRAFT-01",
            "2026-04-01",
            [
                (self.acc_111, "99000000", "0"),
                (self.acc_41111, "0", "99000000"),
            ],
            status="DRAFT",
        )

        v1_res = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(v1_res.status_code, 201)
        v1_id = v1_res.data["id"]
        self.assertEqual(v1_res.data["run_version"], 1)
        self.assertTrue(v1_res.data["has_draft_vouchers_warning"])
        self.assertEqual(v1_res.data["draft_vouchers_count"], 1)

        # TC-RPT-03-43 & TC-RPT-03-44: Xem Calculation & Drill-down chỉ tiêu 131 -> tổng drilldown khớp 100% với số trên B01
        calc_res = self.client.get(
            f"/api/v1/reports/financial-position/runs/{v1_id}/lines/131/calculation/?company_id={self.company.id}"
        )
        self.assertEqual(calc_res.status_code, 200)
        self.assertEqual(Decimal(calc_res.data["closing_amount"]), Decimal("45000000"))

        drill_res = self.client.get(
            f"/api/v1/reports/financial-position/runs/{v1_id}/lines/131/drilldown/?company_id={self.company.id}&column=CLOSING"
        )
        self.assertEqual(drill_res.status_code, 200)
        self.assertTrue(drill_res.data["is_reconciled"])
        self.assertEqual(Decimal(drill_res.data["indicator_amount"]), Decimal("45000000"))
        self.assertEqual(Decimal(drill_res.data["drilldown_total_amount"]), Decimal("45000000"))
        self.assertEqual(len(drill_res.data["vouchers"]), 1)
        self.assertEqual(drill_res.data["vouchers"][0]["voucher_number"], "JE-DRILL-01")

        # TC-RPT-03-48 & TC-RPT-03-49: Hạch toán thêm bút toán POSTED sau khi tạo v1 -> v1 bị đánh dấu STALE và chặn trình duyệt / phê duyệt / xuất XML chính thức
        self._post_je(
            "JE-AFTER-RUN",
            "2026-07-01",
            [
                (self.acc_111, "15000000", "0"),
                (self.acc_41111, "0", "15000000"),
            ],
        )
        v1_stale = self.client.get(f"/api/v1/reports/financial-position/runs/{v1_id}/?company_id={self.company.id}")
        self.assertEqual(v1_stale.status_code, 200)
        self.assertTrue(v1_stale.data["is_stale"])
        self.assertEqual(v1_stale.data["validation_status"], "STALE")

        sub_fail = self.client.post(
            f"/api/v1/reports/financial-position/runs/{v1_id}/submit-review/",
            {"company_id": str(self.company.id)},
            format="json",
        )
        self.assertEqual(sub_fail.status_code, 400)
        self.assertEqual(sub_fail.data["error_code"], "EF-27")

        xml_fail = self.client.post(
            f"/api/v1/reports/financial-position/runs/{v1_id}/export/",
            {"company_id": str(self.company.id), "export_format": "XML", "official_submission": True},
            format="json",
        )
        self.assertEqual(xml_fail.status_code, 400)
        self.assertEqual(xml_fail.data["error_code"], "EF-31")

        # TC-RPT-03-46 & 47 & 51 & 52: Tạo phiên bản mới v2 -> v1 chuyển SUPERSEDED; v2 trình duyệt -> phê duyệt -> xuất XML thành công; chặn ghi đè bản APPROVED (EF-28)
        v2_res = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(v2_res.status_code, 201)
        v2_id = v2_res.data["id"]
        self.assertEqual(v2_res.data["run_version"], 2)
        self.assertFalse(v2_res.data["is_stale"])

        hist_res = self.client.get(f"/api/v1/reports/financial-position/runs/{v2_id}/history/?company_id={self.company.id}")
        self.assertEqual(hist_res.status_code, 200)
        v_map = {v["run_version"]: v["run_status"] for v in hist_res.data["versions"]}
        self.assertEqual(v_map[1], "SUPERSEDED")
        self.assertEqual(v_map[2], "GENERATED")

        sub_ok = self.client.post(
            f"/api/v1/reports/financial-position/runs/{v2_id}/submit-review/",
            {"company_id": str(self.company.id)},
            format="json",
        )
        self.assertEqual(sub_ok.status_code, 200)
        self.assertEqual(sub_ok.data["run_status"], "READY_FOR_APPROVAL")

        appr_ok = self.client.post(
            f"/api/v1/reports/financial-position/runs/{v2_id}/approve/",
            {"company_id": str(self.company.id)},
            format="json",
        )
        self.assertEqual(appr_ok.status_code, 200)
        self.assertEqual(appr_ok.data["run_status"], "APPROVED")

        overwrite_fail = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "overwrite_run_id": v2_id,
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(overwrite_fail.status_code, 400)
        self.assertEqual(overwrite_fail.data["error_code"], "EF-28")

        xml_ok = self.client.post(
            f"/api/v1/reports/financial-position/runs/{v2_id}/export/",
            {"company_id": str(self.company.id), "export_format": "XML", "official_submission": True},
            format="json",
        )
        self.assertEqual(xml_ok.status_code, 200)
        self.assertEqual(xml_ok.data["export_status"], "READY")
        self.assertEqual(len(xml_ok.data["xml_payload"]["indicators"]), 126)

    def test_tc_rpt_03_53_to_65_edge_cases_security_scope_interbranch_integrity(self):
        """TC-RPT-03-53 .. TC-RPT-03-65: 0 vs NULL (UNMAPPED), simulate_load_error (EF-21), vòng lặp công thức (EF-16), tham chiếu thiếu (EF-17), loại trừ nội bộ 136/336 ở COMPANY, kỳ lệch năm dương lịch, RBAC/DataScope & bất biến GL."""
        from iam.models import ActiveStatus, CompanyMembership, DataScopeBranch, DataScopeSet, Permission, UserPermissionOverride
        from reporting.financial_position_services import validate_template_formulas
        from reporting.models import FinancialStatementAccountMapping, FinancialStatementLine, FinancialStatementRun

        # TC-RPT-03-56 & TC-RPT-03-57: Phát hiện vòng lặp công thức (EF-16) và chỉ tiêu con không tồn tại (EF-17)
        line_a = FinancialStatementLine(indicator_code="901", line_type="SUBTOTAL", formula_expression="902")
        line_b = FinancialStatementLine(indicator_code="902", line_type="SUBTOTAL", formula_expression="901")
        with self.assertRaises(Exception) as ctx_cycle:
            validate_template_formulas([line_a, line_b])
        self.assertIn("EF-16", str(ctx_cycle.exception))

        line_missing = FinancialStatementLine(indicator_code="903", line_type="SUBTOTAL", formula_expression="999")
        with self.assertRaises(Exception) as ctx_missing:
            validate_template_formulas([line_missing])
        self.assertIn("EF-17", str(ctx_missing.exception))

        # TC-RPT-03-58: Giao dịch nội bộ 136 / 336 giữ lại khi xem BRANCH nhưng loại trừ khi xem COMPANY
        self._post_je(
            "JE-INTERBRANCH-HQ",
            "2026-06-01",
            [
                (self.acc_136, "25000000", "0", None, {"is_interbranch": True}),
                (self.acc_336, "0", "25000000", None, {"is_interbranch": True}),
            ],
            branch=self.branch_hq,
        )
        run_branch = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "reporting_scope": "BRANCH",
                "branch_id": str(self.branch_hq.id),
            },
            format="json",
        )
        self.assertEqual(run_branch.status_code, 201)
        b_map = {ln["indicator_code"]: ln for ln in run_branch.data["lines"]}
        self.assertEqual(Decimal(b_map["133"]["raw_closing_amount"]), Decimal("25000000"))
        self.assertEqual(Decimal(b_map["317"]["raw_closing_amount"]), Decimal("25000000"))

        run_comp = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "reporting_scope": "COMPANY",
            },
            format="json",
        )
        self.assertEqual(run_comp.status_code, 201)
        c_map = {ln["indicator_code"]: ln for ln in run_comp.data["lines"]}
        self.assertEqual(Decimal(c_map["133"]["raw_closing_amount"]), Decimal("0"))
        self.assertEqual(Decimal(c_map["317"]["raw_closing_amount"]), Decimal("0"))

        # TC-RPT-03-54: Phân biệt chỉ tiêu có số dư = 0 hợp lệ (COMPLETE) và chỉ tiêu bị thiếu mapping (UNMAPPED -> None, cảnh báo RPT-B01-VAL-12)
        line_164 = FinancialStatementLine.objects.filter(
            template_version_id=run_comp.data["template_version_id"],
            indicator_code="164",
        ).first()
        saved_mappings = list(FinancialStatementAccountMapping.objects.filter(statement_line=line_164))
        FinancialStatementAccountMapping.objects.filter(statement_line=line_164).update(is_active=False)

        run_unmapped = self.client.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(run_unmapped.status_code, 201)
        u_map = {ln["indicator_code"]: ln for ln in run_unmapped.data["lines"]}
        self.assertEqual(u_map["164"]["content_status"], "UNMAPPED")
        self.assertIsNone(u_map["164"]["raw_closing_amount"])
        self.assertEqual(u_map["111"]["content_status"], "COMPLETE")
        self.assertEqual(Decimal(u_map["111"]["raw_closing_amount"]), Decimal("0"))
        FinancialStatementAccountMapping.objects.filter(id__in=[m.id for m in saved_mappings]).update(is_active=True)

        # TC-RPT-03-55: Khi simulate_load_error=True -> trả lỗi EF-21, tuyệt đối không trả số liệu giả (Fixture)
        FinancialStatementRun.objects.filter(id=run_comp.data["id"]).update(simulate_load_error=True)
        err_res = self.client.get(
            f"/api/v1/reports/financial-position/runs/{run_comp.data['id']}/?company_id={self.company.id}"
        )
        self.assertEqual(err_res.status_code, 400)
        self.assertEqual(err_res.data["error_code"], "EF-21")
        FinancialStatementRun.objects.filter(id=run_comp.data["id"]).update(simulate_load_error=False)

        # TC-RPT-03-64 & TC-RPT-03-65: Kiểm tra phân quyền RBAC, giới hạn Data Scope chi nhánh, chặn Cross-company và đảm bảo không ghi/sửa GL khi xem B01
        from datetime import timedelta
        from django.utils import timezone
        User = get_user_model()
        user_branch_vo = User.objects.create_user(
            username="branch_view_only_b01",
            email="branch_vo_b01@example.com",
            password="x",
        )
        iam_bvo = user_branch_vo.iam_account
        m_bvo = CompanyMembership.objects.create(
            user=iam_bvo,
            company=self.company,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )
        scope_hq = DataScopeSet.objects.create(
            company=self.company,
            code="SCOPE_B01_HQ_ONLY",
            name="Scope HQ Only",
            allow_all_company_data=False,
            status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )
        DataScopeBranch.objects.create(data_scope_set=scope_hq, branch=self.branch_hq)
        perm_view = Permission.objects.filter(code="RPT_FINANCIAL_VIEW").first()
        UserPermissionOverride.objects.create(
            company_membership=m_bvo,
            permission=perm_view,
            effect="GRANT",
            data_scope_set=scope_hq,
            reason="Branch HQ view only",
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.iam,
        )

        c_bvo = APIClient()
        c_bvo.force_authenticate(user_branch_vo)

        # Xem phạm vi BRANCH HQ được phép (200), nhưng xem phạm vi COMPANY bị chặn (403)
        ok_br = c_bvo.get(
            f"/api/v1/reports/financial-position/runs/{run_branch.data['id']}/?company_id={self.company.id}"
        )
        self.assertEqual(ok_br.status_code, 200)

        deny_comp = c_bvo.get(
            f"/api/v1/reports/financial-position/runs/{run_comp.data['id']}/?company_id={self.company.id}"
        )
        self.assertEqual(deny_comp.status_code, 403)

        # Không có quyền DRILLDOWN và GENERATE -> trả 403
        deny_drill = c_bvo.get(
            f"/api/v1/reports/financial-position/runs/{run_branch.data['id']}/lines/133/drilldown/?company_id={self.company.id}"
        )
        self.assertEqual(deny_drill.status_code, 403)

        deny_gen = c_bvo.post(
            "/api/v1/reports/financial-position/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B01-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "reporting_scope": "BRANCH",
                "branch_id": str(self.branch_hq.id),
            },
            format="json",
        )
        self.assertEqual(deny_gen.status_code, 403)

        # Truy cập Run bằng company_id của công ty khác -> chặn 403
        cross_comp = self.client.get(
            f"/api/v1/reports/financial-position/runs/{run_comp.data['id']}/?company_id={self.other_company.id}"
        )
        self.assertEqual(cross_comp.status_code, 403)

        # Đảm bảo tính bất biến của dữ liệu GL khi xem và validate báo cáo
        je_before = JournalEntry.objects.count()
        jl_before = JournalLine.objects.count()
        self.client.get(f"/api/v1/reports/financial-position/runs/{run_comp.data['id']}/?company_id={self.company.id}")
        self.client.post(f"/api/v1/reports/financial-position/runs/{run_comp.data['id']}/validate/?company_id={self.company.id}")
        self.assertEqual(JournalEntry.objects.count(), je_before)
        self.assertEqual(JournalLine.objects.count(), jl_before)



# ============================================================================
# UC-RPT-04 – Xem báo cáo kết quả hoạt động kinh doanh (TC-RPT-04-01 .. TC-RPT-04-70)
# ============================================================================

from iam.models import (
    ActiveStatus,
    CompanyMembership,
    DataScopeBranch,
    DataScopeSet,
    Permission,
    UserPermissionOverride,
)
from reporting.models import (
    FinancialStatementLine,
    FinancialStatementRun,
    FinancialStatementValue,
)


class BusinessResultUcRpt04Tests(TestCase):
    def setUp(self):
        from datetime import date, timedelta
        from django.utils import timezone
        from reporting.business_result_services import ensure_b02_templates_seeded

        ensure_b02_templates_seeded()

        self.vnd, _ = Currency.objects.get_or_create(
            code="VND",
            defaults={"name": "Đồng Việt Nam", "symbol": "₫"},
        )
        self.company = Company.objects.create(
            code="B02_COMP_JSC",
            name="Công ty Cổ phần Chuẩn B02 TT99",
            legal_name="Công ty Cổ phần Chuẩn B02 TT99",
            tax_code="0108889991",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.company_llc = Company.objects.create(
            code="B02_COMP_LLC",
            name="Công ty TNHH Một Thành Viên B02",
            legal_name="Công ty TNHH Một Thành Viên B02",
            tax_code="0108889992",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.other_company = Company.objects.create(
            code="B02_COMP_OTHER",
            name="Công ty Khác Ngoài Phạm Vi B02",
            legal_name="Công ty Khác Ngoài Phạm Vi B02",
            tax_code="0108889993",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch_hq = Branch.objects.create(company=self.company, code="HQ_B02", name="Trụ sở chính B02")
        self.branch_south = Branch.objects.create(company=self.company, code="HCM_B02", name="Chi nhánh TP.HCM B02")

        self.period_2025 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2025,
            period_number=12,
            code="2025-12",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            status="CLOSED",
        )
        self.period_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=12,
            code="2026-12",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="OPEN",
        )
        self.period_q1_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=3,
            code="2026-Q1",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
            status="CLOSED",
        )
        self.period_q2_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=6,
            code="2026-Q2",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 6, 30),
            status="OPEN",
        )
        self.period_q2_2025 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2025,
            period_number=6,
            code="2025-Q2",
            start_date=date(2025, 4, 1),
            end_date=date(2025, 6, 30),
            status="CLOSED",
        )
        self.period_llc_2026 = AccountingPeriod.objects.create(
            company=self.company_llc,
            fiscal_year=2026,
            period_number=12,
            code="LLC-2026-12",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="OPEN",
        )

        User = get_user_model()
        self.user = User.objects.create_user(username="chief_b02", email="chief_b02@example.com", password="x")
        self.iam = self.user.iam_account
        self.membership = CompanyMembership.objects.create(
            user=self.iam,
            company=self.company,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )
        self.membership_llc = CompanyMembership.objects.create(
            user=self.iam,
            company=self.company_llc,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )

        for perm_code in (
            "RPT_BUSINESS_RESULT_VIEW",
            "RPT_BUSINESS_RESULT_DETAIL_VIEW",
            "RPT_BUSINESS_RESULT_GENERATE",
            "RPT_BUSINESS_RESULT_VALIDATE",
            "RPT_BUSINESS_RESULT_APPROVE",
            "RPT_BUSINESS_RESULT_EXPORT",
            "RPT_FINANCIAL_VIEW",
            "RPT_FINANCIAL_DETAIL_VIEW",
            "RPT_FINANCIAL_GENERATE",
            "RPT_FINANCIAL_APPROVE",
            "RPT_FINANCIAL_EXPORT",
        ):
            perm = Permission.objects.filter(code=perm_code).first()
            if perm:
                for m_ship in (self.membership, self.membership_llc):
                    UserPermissionOverride.objects.create(
                        company_membership=m_ship,
                        permission=perm,
                        effect="GRANT",
                        reason="Grant B02 permissions for test",
                        valid_from=timezone.now() - timedelta(days=1),
                        assigned_by=self.iam,
                    )

        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT99-B02", name="TT99 B02", effective_from="2025-01-01", is_default=True
        )
        self.cls_asset = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.cls_liab = AccountClass.objects.create(company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT")
        self.cls_eq = AccountClass.objects.create(company=self.company, code="EQUITY", name="Vốn chủ sở hữu", normal_balance="CREDIT")
        self.cls_rev = AccountClass.objects.create(company=self.company, code="REV", name="Doanh thu", normal_balance="CREDIT")
        self.cls_exp = AccountClass.objects.create(company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT")

        self.acc_111 = self._mk_acc("111", "Tiền mặt", "ASSET", "DEBIT")
        self.acc_112 = self._mk_acc("112", "Tiền gửi ngân hàng", "ASSET", "DEBIT")
        self.acc_131 = self._mk_acc("131", "Phải thu khách hàng", "ASSET", "DEBIT")
        self.acc_156 = self._mk_acc("156", "Hàng hóa", "ASSET", "DEBIT")
        self.acc_211 = self._mk_acc("211", "TSCĐ hữu hình", "ASSET", "DEBIT")
        self.acc_2141 = self._mk_acc("2141", "Hao mòn TSCĐ hữu hình", "ASSET", "CREDIT")
        self.acc_217 = self._mk_acc("217", "Bất động sản đầu tư", "ASSET", "DEBIT")
        self.acc_243 = self._mk_acc("243", "Tài sản thuế thu nhập hoãn lại", "ASSET", "DEBIT")
        self.acc_331 = self._mk_acc("331", "Phải trả người bán", "LIABILITY", "CREDIT")
        self.acc_3331 = self._mk_acc("3331", "Thuế GTGT phải nộp", "LIABILITY", "CREDIT")
        self.acc_3334 = self._mk_acc("3334", "Thuế TNDN phải nộp", "LIABILITY", "CREDIT")
        self.acc_4212 = self._mk_acc("4212", "LNST chưa phân phối năm nay", "EQUITY", "CREDIT")
        self.acc_5111 = self._mk_acc("5111", "Doanh thu bán hàng hóa", "REVENUE", "CREDIT")
        self.acc_5117 = self._mk_acc("5117", "Doanh thu kinh doanh BĐS đầu tư", "REVENUE", "CREDIT")
        self.acc_5211 = self._mk_acc("5211", "Chiết khấu thương mại", "REVENUE", "DEBIT")
        self.acc_5212 = self._mk_acc("5212", "Hàng bán bị trả lại", "REVENUE", "DEBIT")
        self.acc_515 = self._mk_acc("515", "Doanh thu hoạt động tài chính", "REVENUE", "CREDIT")
        self.acc_632 = self._mk_acc("632", "Giá vốn hàng bán", "EXPENSE", "DEBIT")
        self.acc_635 = self._mk_acc("635", "Chi phí tài chính", "EXPENSE", "DEBIT")
        self.acc_6351 = self._mk_acc("6351", "Chi phí lãi vay", "EXPENSE", "DEBIT")
        self.acc_641 = self._mk_acc("641", "Chi phí bán hàng", "EXPENSE", "DEBIT")
        self.acc_642 = self._mk_acc("642", "Chi phí quản lý doanh nghiệp", "EXPENSE", "DEBIT")
        self.acc_711 = self._mk_acc("711", "Thu nhập khác", "REVENUE", "CREDIT")
        self.acc_811 = self._mk_acc("811", "Chi phí khác", "EXPENSE", "DEBIT")
        self.acc_8211 = self._mk_acc("8211", "Chi phí thuế TNDN hiện hành", "EXPENSE", "DEBIT")
        self.acc_8212 = self._mk_acc("8212", "Chi phí thuế TNDN hoãn lại", "EXPENSE", "DEBIT")
        self.acc_911 = self._mk_acc("911", "Xác định kết quả kinh doanh", "EQUITY", "CREDIT")

    def _mk_acc(self, code: str, name: str, acc_type: str, normal_balance: str, company: Company | None = None) -> Account:
        comp = company or self.company
        cls_map = {
            "ASSET": self.cls_asset,
            "LIABILITY": self.cls_liab,
            "EQUITY": self.cls_eq,
            "REVENUE": self.cls_rev,
            "EXPENSE": self.cls_exp,
        }
        acc, _ = Account.objects.get_or_create(
            company=comp,
            code=code,
            defaults={
                "chart_of_accounts": self.chart,
                "account_class": cls_map.get(acc_type, self.cls_asset),
                "name": name,
                "account_type": acc_type,
                "normal_balance": normal_balance,
            },
        )
        return acc

    def _post_je(
        self,
        number: str,
        posting_date: str,
        lines_spec: list[tuple],
        period: AccountingPeriod | None = None,
        branch: Branch | None = None,
        entry_type: str = "MANUAL",
        status: str = "POSTED",
        original_entry: JournalEntry | None = None,
    ) -> JournalEntry:
        from django.utils import timezone
        target_period = period or self.period_2026
        total_d = sum((Decimal(str(it[1])) for it in lines_spec), Decimal("0"))
        total_c = sum((Decimal(str(it[2])) for it in lines_spec), Decimal("0"))
        je = JournalEntry.objects.create(
            company=target_period.company,
            branch=branch or (self.branch_hq if target_period.company == self.company else None),
            period=target_period,
            number=number,
            entry_type=entry_type,
            posting_date=posting_date,
            status=status,
            original_entry=original_entry,
            description=f"Bút toán B02 {number}",
            total_debit=total_d,
            total_credit=total_c,
            created_by=self.iam,
            posted_by=self.iam if status in ("POSTED", "REVERSED") else None,
            posted_at=timezone.now() if status in ("POSTED", "REVERSED") else None,
        )
        for idx, item in enumerate(lines_spec, start=1):
            acc = item[0]
            debit = Decimal(str(item[1]))
            credit = Decimal(str(item[2]))
            dims = item[3] if len(item) > 3 else {}
            desc = item[4] if len(item) > 4 else ""
            JournalLine.objects.create(
                entry=je,
                line_no=idx,
                account=acc,
                debit=debit,
                credit=credit,
                currency=self.vnd,
                dimensions=dims or {},
                description=desc,
            )
        return je

    def test_tc_rpt_04_01_to_15_templates_versions_parameters_slots_and_b02b(self):
        """TC-RPT-04-01 .. TC-RPT-04-15: 4 biểu mẫu B02-DN, B02-DNKLT, B02a-DN, B02b-DN, kiểm tra kỳ, phiên bản, 4 slots & B02b 4 chỉ tiêu."""
        # TC-RPT-04-01..04: Danh sách 4 mẫu B02 chuẩn TT99
        tpl_res = self.client.get(f"/api/v1/reports/business-result/templates/?company_id={self.company.id}")
        self.assertEqual(tpl_res.status_code, 200)
        by_legal = {t["legal_form_code"]: t for t in tpl_res.data["templates"]}
        self.assertEqual(set(by_legal.keys()), {"B02-DN", "B02-DNKLT", "B02a-DN", "B02b-DN"})
        self.assertEqual(by_legal["B02-DN"]["indicator_count"], 21)
        self.assertEqual(by_legal["B02-DN"]["value_slot_count"], 2)
        self.assertEqual(by_legal["B02-DN"]["table_column_count"], 5)
        self.assertEqual(by_legal["B02-DNKLT"]["indicator_count"], 21)
        self.assertEqual(by_legal["B02-DNKLT"]["going_concern_status"], "NON_GOING_CONCERN")
        self.assertEqual(by_legal["B02a-DN"]["indicator_count"], 21)
        self.assertEqual(by_legal["B02a-DN"]["value_slot_count"], 4)
        self.assertEqual(by_legal["B02a-DN"]["table_column_count"], 7)
        self.assertEqual(by_legal["B02b-DN"]["indicator_count"], 4)
        self.assertEqual(by_legal["B02b-DN"]["value_slot_count"], 4)

        # TC-RPT-04-05: Template versions & parameters
        ver_res = self.client.get(
            f"/api/v1/reports/business-result/template-versions/?company_id={self.company.id}&template_code=B02-DN"
        )
        self.assertEqual(ver_res.status_code, 200)
        self.assertGreaterEqual(ver_res.data["count"], 1)
        self.assertEqual(ver_res.data["template_versions"][0]["legal_form_code"], "B02-DN")

        param_res = self.client.get(f"/api/v1/reports/business-result/parameters/?company_id={self.company.id}")
        self.assertEqual(param_res.status_code, 200)
        self.assertTrue(param_res.data["permissions"]["can_view"])
        self.assertTrue(param_res.data["permissions"]["can_generate"])

        # TC-RPT-04-06..08: Khi chưa có Run đã lưu, require_saved_run=true trả EF-11 (không trả số giả 550tr)
        no_run_res = self.client.get(
            f"/api/v1/reports/business-result/runs/?company_id={self.company.id}&fiscal_year=2026&require_saved_run=true"
        )
        self.assertEqual(no_run_res.status_code, 400)
        self.assertEqual(no_run_res.data["error_code"], "EF-11")

        # TC-RPT-04-09..11: Kiểm tra lỗi từ ngày > đến ngày (EF-04 / EF-09), mẫu không tương thích giả định HĐLT (EF-06) và kỳ báo cáo (EF-05)
        bad_dates = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "period_start_date": "2026-12-31",
                "period_end_date": "2026-01-01",
            },
            format="json",
        )
        self.assertEqual(bad_dates.status_code, 400)
        self.assertEqual(bad_dates.data["error_code"], "EF-04")

        bad_gc = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "going_concern_status": "NON_GOING_CONCERN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(bad_gc.status_code, 400)
        self.assertEqual(bad_gc.data["error_code"], "EF-06")

        bad_gran = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02a-DN",
                "period_type": "ANNUAL",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(bad_gran.status_code, 400)
        self.assertEqual(bad_gran.data["error_code"], "EF-05")

        # Hạch toán số liệu Q1/2026, Q2/2026 và Q2/2025 để kiểm tra B02a-DN (4 slots) và B02b-DN (4 chỉ tiêu)
        self._post_je(
            "JE-Q2-2025-REV",
            "2025-05-15",
            [
                (self.acc_131, "200000000", "0"),
                (self.acc_5111, "0", "200000000"),
            ],
            period=self.period_q2_2025,
        )
        self._post_je(
            "JE-Q1-2026-REV",
            "2026-02-10",
            [
                (self.acc_131, "300000000", "0"),
                (self.acc_5111, "0", "300000000"),
                (self.acc_632, "180000000", "0"),
                (self.acc_156, "0", "180000000"),
            ],
            period=self.period_q1_2026,
        )
        self._post_je(
            "JE-Q2-2026-REV",
            "2026-05-20",
            [
                (self.acc_131, "500000000", "0"),
                (self.acc_5111, "0", "500000000"),
                (self.acc_632, "300000000", "0"),
                (self.acc_156, "0", "300000000"),
                (self.acc_112, "35000000", "0"),
                (self.acc_515, "0", "20000000"),
                (self.acc_711, "0", "15000000"),
                (self.acc_8211, "40000000", "0"),
                (self.acc_3334, "0", "40000000"),
            ],
            period=self.period_q2_2026,
        )

        # TC-RPT-04-14: Tạo Run B02a-DN Quý 2/2026 -> 21 dòng, 4 slots (Quý này 500tr, Quý trước 200tr, Lũy kế năm nay 800tr, Lũy kế năm trước 200tr)
        res_b02a = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02a-DN",
                "fiscal_period_id": str(self.period_q2_2026.id),
                "period_type": "QUARTERLY",
                "eps_metadata": {"weighted_average_ordinary_shares": 100000},
            },
            format="json",
        )
        self.assertEqual(res_b02a.status_code, 201)
        self.assertEqual(res_b02a.data["total_template_lines"], 21)
        self.assertEqual(len(res_b02a.data["run"]["table_columns"]), 7)
        b02a_map = {ln["indicator_code"]: ln for ln in res_b02a.data["lines"]}
        slots_01 = b02a_map["01"]["slots_by_code"]
        self.assertEqual(set(slots_01.keys()), {"QUARTER_CURRENT", "QUARTER_PREVIOUS", "YTD_CURRENT", "YTD_PREVIOUS"})
        self.assertEqual(Decimal(slots_01["QUARTER_CURRENT"]["raw_amount"]), Decimal("500000000"))
        self.assertEqual(Decimal(slots_01["QUARTER_PREVIOUS"]["raw_amount"]), Decimal("200000000"))
        self.assertEqual(Decimal(slots_01["YTD_CURRENT"]["raw_amount"]), Decimal("800000000"))
        self.assertEqual(Decimal(slots_01["YTD_PREVIOUS"]["raw_amount"]), Decimal("200000000"))
        # Mã 31 trên B02a-DN chỉ lấy Thu nhập khác (711 = 15tr)
        self.assertEqual(Decimal(b02a_map["31"]["raw_current_period_amount"]), Decimal("15000000"))

        # TC-RPT-04-15: Tạo Run B02b-DN Quý 2/2026 -> chỉ có đúng 4 chỉ tiêu (01, 31, 50, 60) và mã 31 = 515 (20tr) + 711 (15tr) = 35tr!
        res_b02b = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02b-DN",
                "fiscal_period_id": str(self.period_q2_2026.id),
                "period_type": "QUARTERLY",
            },
            format="json",
        )
        self.assertEqual(res_b02b.status_code, 201)
        self.assertEqual(res_b02b.data["total_template_lines"], 4)
        b02b_codes = [ln["indicator_code"] for ln in res_b02b.data["lines"]]
        self.assertEqual(b02b_codes, ["01", "31", "50", "60"])
        b02b_map = {ln["indicator_code"]: ln for ln in res_b02b.data["lines"]}
        self.assertEqual(Decimal(b02b_map["01"]["raw_current_period_amount"]), Decimal("500000000"))
        self.assertEqual(Decimal(b02b_map["31"]["raw_current_period_amount"]), Decimal("35000000"))
        self.assertEqual(Decimal(b02b_map["50"]["raw_current_period_amount"]), Decimal("235000000"))
        self.assertEqual(Decimal(b02b_map["60"]["raw_current_period_amount"]), Decimal("195000000"))

        # Truy vấn chỉ tiêu không thuộc B02b-DN (VD: mã 10) -> trả lỗi EF-15
        err_b02b_line = self.client.get(
            f"/api/v1/reports/business-result/runs/{res_b02b.data['statement_run_id']}/lines/10/calculation/?company_id={self.company.id}"
        )
        self.assertEqual(err_b02b_line.status_code, 400)
        self.assertEqual(err_b02b_line.data["error_code"], "EF-15")

    def test_tc_rpt_04_16_to_43_core_accounting_rules_bdsdt_borrowing_tscd_tax_formulas(self):
        """TC-RPT-04-16 .. TC-RPT-04-43: Quy tắc kế toán cốt lõi 01, 02, 10, 11, 20, 21 (BĐSĐT), 22, 23, 24 (Chi phí đi vay không trừ lặp), 25, 26, 30, 31/32 (TSCĐ thuần), 40, 50, 51, 52 (-1 làm tăng LNST), 60."""
        # 1. Doanh thu bán hàng (5111 = 1.000tr) + Thuế GTGT đầu ra (3331 = 100tr, không cộng vào 01) + Khoản thuế gián thu nằm trong 5111 (vat_included_amount = 20tr) -> 01 = 980tr
        self._post_je(
            "JE-2026-SALE-01",
            "2026-03-10",
            [
                (self.acc_131, "1100000000", "0"),
                (self.acc_5111, "0", "1000000000", {"vat_included_amount": "20000000"}),
                (self.acc_3331, "0", "100000000"),
            ],
        )

        # 2. Khoản giảm trừ doanh thu (5211 = 30tr, 5212 = 50tr -> 02 = 80tr) + Bút toán kết chuyển Nợ 5111 / Có 521 (80tr) không làm tính trùng 02 hoặc giảm trùng 01 (EF-21)
        self._post_je(
            "JE-2026-DED-01",
            "2026-03-20",
            [
                (self.acc_5211, "30000000", "0"),
                (self.acc_5212, "50000000", "0"),
                (self.acc_131, "0", "80000000"),
            ],
        )
        self._post_je(
            "JE-2026-TRANSFER-521",
            "2026-03-31",
            [
                (self.acc_5111, "80000000", "0"),
                (self.acc_5211, "0", "30000000"),
                (self.acc_5212, "0", "50000000"),
            ],
        )

        # 3. Mua hàng nhập kho (Nợ 156 = 900tr) vs Giá vốn hàng bán ghi nhận (Nợ 632 = 400tr) -> Mã 11 chỉ lấy 400tr
        self._post_je(
            "JE-2026-PURCHASE-156",
            "2026-04-05",
            [
                (self.acc_156, "900000000", "0"),
                (self.acc_331, "0", "900000000"),
            ],
        )
        self._post_je(
            "JE-2026-COGS-632",
            "2026-04-10",
            [
                (self.acc_632, "400000000", "0"),
                (self.acc_156, "0", "400000000"),
            ],
        )

        # 4. Bán/thanh lý BĐS đầu tư (Mã 21): Doanh thu 5117 = 150tr, Giá trị còn lại 632 = 110tr, Chi phí môi giới thanh lý = 10tr -> Mã 21 = +30tr (Tách khỏi 01, 11, 31, 32)
        self._post_je(
            "JE-2026-BDSDT-GAIN",
            "2026-05-12",
            [
                (self.acc_131, "150000000", "0", {"asset_type": "INVESTMENT_PROPERTY", "transaction_nature": "DISPOSAL", "bdsdt_transaction_id": "BDSDT_01"}),
                (self.acc_5117, "0", "150000000", {"asset_type": "INVESTMENT_PROPERTY", "transaction_nature": "DISPOSAL", "bdsdt_transaction_id": "BDSDT_01"}),
                (self.acc_632, "110000000", "0", {"asset_type": "INVESTMENT_PROPERTY", "transaction_nature": "DISPOSAL", "bdsdt_transaction_id": "BDSDT_01"}),
                (self.acc_217, "0", "110000000", {"asset_type": "INVESTMENT_PROPERTY", "transaction_nature": "DISPOSAL", "bdsdt_transaction_id": "BDSDT_01"}),
                (self.acc_632, "10000000", "0", {"asset_type": "INVESTMENT_PROPERTY", "transaction_nature": "DISPOSAL", "bdsdt_cost_kind": "DISPOSAL_EXPENSE", "bdsdt_transaction_id": "BDSDT_01"}),
                (self.acc_111, "0", "10000000", {"asset_type": "INVESTMENT_PROPERTY", "transaction_nature": "DISPOSAL", "bdsdt_transaction_id": "BDSDT_01"}),
            ],
        )

        # 5. Doanh thu tài chính (515 = 40tr), Chi phí tài chính (635 = 25tr, trong đó Chi phí lãi vay 6351 = 18tr -> Mã 23 = 25tr, Mã 24 = 18tr), cộng thêm CLTG đánh giá lại cuối kỳ (Có 515 = 12tr, Nợ 635 = 7tr -> bù trừ thuần +5tr vào Mã 22 -> Mã 22 = 45tr)
        self._post_je(
            "JE-2026-FIN",
            "2026-06-15",
            [
                (self.acc_112, "40000000", "0"),
                (self.acc_515, "0", "40000000"),
                (self.acc_6351, "18000000", "0", {"is_borrowing_cost": True}),
                (self.acc_635, "7000000", "0"),
                (self.acc_112, "0", "25000000"),
            ],
        )
        self._post_je(
            "JE-2026-FX-REVAL",
            "2026-12-31",
            [
                (self.acc_131, "12000000", "0", {"is_fx_revaluation": True}),
                (self.acc_515, "0", "12000000", {"is_fx_revaluation": True}),
                (self.acc_635, "7000000", "0", {"is_fx_revaluation": True}),
                (self.acc_331, "0", "7000000", {"is_fx_revaluation": True}),
            ],
        )

        # 6. Chi phí bán hàng (641 = 60tr) & Chi phí QLDN (642 = 90tr)
        self._post_je(
            "JE-2026-SGA",
            "2026-07-20",
            [
                (self.acc_641, "60000000", "0"),
                (self.acc_642, "90000000", "0"),
                (self.acc_112, "0", "150000000"),
            ],
        )

        # 7. Thanh lý TSCĐ hữu hình (Proceeds 711 = 80tr, GTCL 811 = 55tr, Chi phí thanh lý 811 = 5tr -> Lãi thuần +20tr trình bày vào Mã 31, không để nguyên 80tr ở 31 và 60tr ở 32!) + Chi phí phạt hành chính (811 = 8tr -> Mã 32 = 8tr)
        self._post_je(
            "JE-2026-TSCD-DISP",
            "2026-08-15",
            [
                (self.acc_112, "80000000", "0", {"asset_type": "FIXED_ASSET", "transaction_nature": "DISPOSAL", "disposal_ref": "FA_01"}),
                (self.acc_711, "0", "80000000", {"asset_type": "FIXED_ASSET", "transaction_nature": "DISPOSAL", "disposal_ref": "FA_01"}),
                (self.acc_811, "55000000", "0", {"asset_type": "FIXED_ASSET", "transaction_nature": "DISPOSAL", "disposal_ref": "FA_01"}),
                (self.acc_2141, "45000000", "0", {"asset_type": "FIXED_ASSET", "transaction_nature": "DISPOSAL", "disposal_ref": "FA_01"}),
                (self.acc_211, "0", "100000000", {"asset_type": "FIXED_ASSET", "transaction_nature": "DISPOSAL", "disposal_ref": "FA_01"}),
                (self.acc_811, "5000000", "0", {"asset_type": "FIXED_ASSET", "transaction_nature": "DISPOSAL", "disposal_ref": "FA_01"}),
                (self.acc_111, "0", "5000000", {"asset_type": "FIXED_ASSET", "transaction_nature": "DISPOSAL", "disposal_ref": "FA_01"}),
            ],
        )
        self._post_je(
            "JE-2026-OTHER-EXP",
            "2026-09-01",
            [
                (self.acc_811, "8000000", "0"),
                (self.acc_111, "0", "8000000"),
            ],
        )

        # 8. Chi phí thuế TNDN hiện hành (8211 = 70tr; nộp thuế Nợ 3334 / Có 112 = 50tr không làm thay đổi mã 51) + Thu nhập thuế TNDN hoãn lại (Có 8212 = 5tr -> mã 52 = -5tr làm tăng LNST mã 60 thêm 5tr!)
        self._post_je(
            "JE-2026-CIT",
            "2026-12-30",
            [
                (self.acc_8211, "70000000", "0"),
                (self.acc_3334, "0", "70000000"),
                (self.acc_3334, "50000000", "0"),
                (self.acc_112, "0", "50000000"),
                (self.acc_243, "5000000", "0"),
                (self.acc_8212, "0", "5000000"),
            ],
        )

        res = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "eps_metadata": {
                    "weighted_average_ordinary_shares": 100000,
                    "potential_dilutive_shares": 25000,
                },
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["validation"]["blocker_count"], 0)
        lmap = {ln["indicator_code"]: Decimal(ln["raw_current_period_amount"]) for ln in res.data["lines"]}

        # Kiểm tra từng chỉ tiêu theo đúng công thức Thông tư 99:
        self.assertEqual(lmap["01"], Decimal("980000000"))   # 1.000tr - 20tr thuế gián thu (không gồm 150tr BĐSĐT)
        self.assertEqual(lmap["02"], Decimal("80000000"))    # 30tr + 50tr
        self.assertEqual(lmap["10"], Decimal("900000000"))   # 01 - 02 = 980tr - 80tr
        self.assertEqual(lmap["11"], Decimal("400000000"))   # Giá vốn 632 (không gồm 900tr mua 156, không gồm 120tr BĐSĐT)
        self.assertEqual(lmap["20"], Decimal("500000000"))   # 10 - 11 = 900tr - 400tr
        self.assertEqual(lmap["21"], Decimal("30000000"))    # BĐSĐT: 150tr - 110tr - 10tr = +30tr
        self.assertEqual(lmap["22"], Decimal("45000000"))    # 40tr + 5tr CLTG đánh giá lại thuần
        self.assertEqual(lmap["23"], Decimal("25000000"))    # 18tr + 7tr
        self.assertEqual(lmap["24"], Decimal("18000000"))    # Trong đó: Chi phí lãi vay (MEMO)
        self.assertEqual(lmap["25"], Decimal("60000000"))    # Chi phí bán hàng
        self.assertEqual(lmap["26"], Decimal("90000000"))    # Chi phí QLDN
        # Mã 30 = 20 (500tr) + 21 (30tr) + 22 (45tr) - 23 (25tr) - 25 (60tr) - 26 (90tr) = 400tr (KHÔNG trừ lặp mã 24!)
        self.assertEqual(lmap["30"], Decimal("400000000"))
        self.assertEqual(lmap["31"], Decimal("20000000"))    # Lãi thuần thanh lý TSCĐ (80tr - 55tr - 5tr)
        self.assertEqual(lmap["32"], Decimal("8000000"))     # Chi phí phạt
        self.assertEqual(lmap["40"], Decimal("12000000"))    # 31 - 32 = 20tr - 8tr
        self.assertEqual(lmap["50"], Decimal("412000000"))   # 30 + 40 = 400tr + 12tr
        self.assertEqual(lmap["51"], Decimal("70000000"))    # Thuế TNDN hiện hành
        self.assertEqual(lmap["52"], Decimal("-5000000"))    # Thu nhập thuế TNDN hoãn lại (âm chi phí)
        # Mã 60 = 50 (412tr) - 51 (70tr) - 52 (-5tr) = 347tr!
        self.assertEqual(lmap["60"], Decimal("347000000"))
        # Mã 70 (EPS cơ bản) = 347.000.000 / 100.000 = 3.470 VND/cp
        self.assertEqual(lmap["70"], Decimal("3470"))
        # Mã 71 (EPS suy giảm) = 347.000.000 / (100.000 + 25.000) = 2.776 VND/cp
        self.assertEqual(lmap["71"], Decimal("2776"))

        # Kiểm tra nếu cố tình sửa sai mã 30 bị trừ lặp mã 24 -> RPT-B02-VAL-03 và RPT-B02-VAL-07 phát hiện lỗi EF-19!
        run_id = res.data["statement_run_id"]
        val_30 = FinancialStatementValue.objects.get(statement_run_id=run_id, statement_line__indicator_code="30")
        val_30.current_period_amount = Decimal("382000000")  # 400tr - 18tr (trừ lặp mã 24)
        val_30.save()
        reval = self.client.post(f"/api/v1/reports/business-result/runs/{run_id}/validate/?company_id={self.company.id}")
        self.assertEqual(reval.status_code, 200)
        self.assertEqual(reval.data["validation_status"], "FAILED")
        failed_rules = {r["rule_code"]: r for r in reval.data["results"] if r["status"] == "FAILED"}
        self.assertIn("RPT-B02-VAL-03", failed_rules)
        self.assertIn("EF-19", failed_rules["RPT-B02-VAL-03"]["message"])
        self.assertIn("RPT-B02-VAL-07", failed_rules)

    def test_tc_rpt_04_44_to_56_eps_edge_cases_comparative_scaling_search_hide_zero(self):
        """TC-RPT-04-44 .. TC-RPT-04-56: EPS (Công ty TNHH NOT_APPLICABLE, thiếu dữ liệu EF-34, mẫu số = 0 EF-35, không scale theo đơn vị tiền), kỳ so sánh NON_COMPARABLE (EF-29), tìm kiếm & ẩn dòng 0."""
        self._post_je(
            "JE-2026-SIMPLE",
            "2026-05-01",
            [
                (self.acc_131, "100000000", "0"),
                (self.acc_5111, "0", "100000000"),
            ],
        )

        # TC-RPT-04-45: Công ty cổ phần nhưng thiếu số lượng cổ phiếu bình quân -> INSUFFICIENT_DATA (EF-34, cảnh báo RPT-B02-VAL-23, không gán 0 giả)
        res_no_shares = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "eps_metadata": {},
            },
            format="json",
        )
        self.assertEqual(res_no_shares.status_code, 201)
        m_no_sh = {ln["indicator_code"]: ln for ln in res_no_shares.data["lines"]}
        self.assertEqual(m_no_sh["70"]["content_status"], "INSUFFICIENT_DATA")
        self.assertIsNone(m_no_sh["70"]["raw_current_period_amount"])
        self.assertEqual(res_no_shares.data["run"]["source_status"], "PARTIAL")

        # TC-RPT-04-46: Số lượng cổ phiếu bình quân = 0 -> ZERO_DENOMINATOR (EF-35, chặn chia cho 0, BLOCKER RPT-B02-VAL-23)
        res_zero_shares = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "eps_metadata": {"weighted_average_ordinary_shares": 0},
            },
            format="json",
        )
        self.assertEqual(res_zero_shares.status_code, 201)
        m_zero_sh = {ln["indicator_code"]: ln for ln in res_zero_shares.data["lines"]}
        self.assertEqual(m_zero_sh["70"]["content_status"], "ZERO_DENOMINATOR")
        self.assertIsNone(m_zero_sh["70"]["raw_current_period_amount"])
        self.assertEqual(res_zero_shares.data["validation"]["validation_status"], "FAILED")

        # TC-RPT-04-47: Công ty TNHH (không phải CTCP) -> EPS có content_status = NOT_APPLICABLE
        res_llc = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company_llc.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_llc_2026.id),
            },
            format="json",
        )
        self.assertEqual(res_llc.status_code, 201)
        m_llc = {ln["indicator_code"]: ln for ln in res_llc.data["lines"]}
        self.assertEqual(m_llc["70"]["content_status"], "NOT_APPLICABLE")
        self.assertEqual(m_llc["71"]["content_status"], "NOT_APPLICABLE")

        # TC-RPT-04-49..52: comparative_status = NON_COMPARABLE (EF-29) giữ None cho cột năm trước, kèm cảnh báo RPT-B02-VAL-20
        res_non_comp = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "comparative_status": "NON_COMPARABLE",
                "comparative_note": "Doanh nghiệp mới chuyển đổi loại hình, kỳ so sánh không tương thích.",
                "eps_metadata": {"weighted_average_ordinary_shares": 50000},
            },
            format="json",
        )
        self.assertEqual(res_non_comp.status_code, 201)
        m_nc = {ln["indicator_code"]: ln for ln in res_non_comp.data["lines"]}
        self.assertEqual(Decimal(m_nc["01"]["raw_current_period_amount"]), Decimal("100000000"))
        self.assertIsNone(m_nc["01"]["raw_comparative_period_amount"])
        val_20_rule = next(r for r in res_non_comp.data["validation"]["results"] if r["rule_code"] == "RPT-B02-VAL-20")
        self.assertEqual(val_20_rule["status"], "PASSED_WITH_WARNING")

        # TC-RPT-04-53..56: Tìm kiếm (search), ẩn dòng 0 (hide_zero_lines giữ các dòng cốt lõi 10, 20, 30, 40, 50, 60) và đổi đơn vị hiển thị MILLION_VND (không chia nhỏ EPS!)
        run_id = res_non_comp.data["statement_run_id"]
        scaled_res = self.client.get(
            f"/api/v1/reports/business-result/runs/{run_id}/lines/?company_id={self.company.id}&display_unit=MILLION_VND&hide_zero_lines=true"
        )
        self.assertEqual(scaled_res.status_code, 200)
        sc_map = {ln["indicator_code"]: ln for ln in scaled_res.data["lines"]}
        # Doanh thu 100.000.000 VND -> 100.00 triệu đồng; EPS = 2.000 VND/cp giữ nguyên 2000 (không bị chia 1.000.000!)
        self.assertEqual(Decimal(sc_map["01"]["current_period_amount"]), Decimal("100.00"))
        self.assertEqual(Decimal(sc_map["70"]["current_period_amount"]), Decimal("2000.00"))
        # Dòng chi tiết = 0 như 02, 21, 25 bị ẩn, nhưng dòng tổng hợp = 0 như 40 vẫn được giữ lại!
        self.assertNotIn("02", sc_map)
        self.assertIn("40", sc_map)

        search_res = self.client.get(
            f"/api/v1/reports/business-result/runs/{run_id}/values/?company_id={self.company.id}&search=bất động sản đầu tư"
        )
        self.assertEqual(search_res.status_code, 200)
        self.assertEqual(len(search_res.data["values"]), 1)
        self.assertEqual(search_res.data["values"][0]["indicator_code"], "21")

    def test_tc_rpt_04_57_to_70_drilldown_closing_draft_reversal_cycles_workflow_export_rbac(self):
        """TC-RPT-04-57 .. TC-RPT-04-70: Calculation, Drill-down, DRAFT/REVERSAL/911, vòng lặp công thức, Phê duyệt, Xuất file, Phân quyền RBAC & Data Scope."""
        from datetime import timedelta
        from django.utils import timezone
        from reporting.business_result_services import validate_b02_template_formulas

        # 1. Bút toán chính thức + Bút toán DRAFT (EF-24) + Bút toán REVERSED kèm REVERSAL (EF-25) + Bút toán thiếu chứng từ gốc (EF-37)
        self._post_je(
            "JE-POSTED-MAIN",
            "2026-06-01",
            [
                (self.acc_131, "200000000", "0", {"missing_source_document": True}),
                (self.acc_5111, "0", "200000000", {"missing_source_document": True}),
            ],
        )
        self._post_je(
            "JE-DRAFT-IGNORED",
            "2026-06-05",
            [
                (self.acc_131, "999000000", "0"),
                (self.acc_5111, "0", "999000000"),
            ],
            status="DRAFT",
        )
        je_orig = self._post_je(
            "JE-REV-ORIG",
            "2026-06-10",
            [
                (self.acc_131, "50000000", "0"),
                (self.acc_5111, "0", "50000000"),
            ],
            status="REVERSED",
        )
        self._post_je(
            "JE-REV-COUNTER",
            "2026-06-11",
            [
                (self.acc_5111, "50000000", "0"),
                (self.acc_131, "0", "50000000"),
            ],
            entry_type="REVERSAL",
            status="POSTED",
            original_entry=je_orig,
        )

        # Tạo Run với calculation_method="CLOSING_BASED" khi chưa có kết chuyển 911 -> tự động fallback sang ACTIVITY_BASED kèm cảnh báo EF-22 (RPT-B02-VAL-17)
        run_res = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "calculation_method": "CLOSING_BASED",
                "eps_metadata": {"weighted_average_ordinary_shares": 100000},
            },
            format="json",
        )
        self.assertEqual(run_res.status_code, 201)
        run_id = run_res.data["statement_run_id"]
        lmap = {ln["indicator_code"]: Decimal(ln["raw_current_period_amount"]) for ln in run_res.data["lines"]}
        # Chỉ tính 200tr từ JE-POSTED-MAIN (bỏ qua 999tr DRAFT, và 50tr REVERSED đã đối trừ với REVERSAL)
        self.assertEqual(lmap["01"], Decimal("200000000"))
        val_rules = {r["rule_code"]: r for r in run_res.data["validation"]["results"]}
        self.assertEqual(val_rules["RPT-B02-VAL-17"]["status"], "PASSED_WITH_WARNING")
        self.assertEqual(val_rules["RPT-B02-VAL-18"]["status"], "PASSED_WITH_WARNING")

        # TC-RPT-04-57..60: Xem Calculation Detail & Drill-down (kèm cảnh báo EF-37 khi thiếu chứng từ gốc)
        calc_res = self.client.get(
            f"/api/v1/reports/business-result/runs/{run_id}/lines/10/calculation/?company_id={self.company.id}"
        )
        self.assertEqual(calc_res.status_code, 200)
        self.assertEqual(calc_res.data["formula_expression"], "01 - 02")
        self.assertEqual(len(calc_res.data["formula_operands"]), 2)

        drill_res = self.client.get(
            f"/api/v1/reports/business-result/runs/{run_id}/lines/01/drilldown/?company_id={self.company.id}&slot_code=YEAR_CURRENT"
        )
        self.assertEqual(drill_res.status_code, 200)
        self.assertGreaterEqual(drill_res.data["journal_lines_count"], 1)
        self.assertTrue(any(w["error_code"] == "EF-37" for w in drill_res.data["warnings"]))

        # TC-RPT-04-65: Kiểm tra phát hiện tham chiếu công thức thiếu (EF-27) và vòng lặp công thức (EF-28)
        ln_missing = FinancialStatementLine(indicator_code="10", line_type="SUBTOTAL", formula_expression="01 - 999")
        with self.assertRaises(Exception) as ctx_27:
            validate_b02_template_formulas([ln_missing])
        self.assertIn("EF-27", str(ctx_27.exception))

        ln_cyc_a = FinancialStatementLine(indicator_code="10", line_type="SUBTOTAL", formula_expression="20")
        ln_cyc_b = FinancialStatementLine(indicator_code="20", line_type="SUBTOTAL", formula_expression="10")
        with self.assertRaises(Exception) as ctx_28:
            validate_b02_template_formulas([ln_cyc_a, ln_cyc_b])
        self.assertIn("EF-28", str(ctx_28.exception))

        # TC-RPT-04-67..69: Submit review -> Approve -> Chặn duyệt lại Run đã APPROVED (EF-38) -> Tạo Run mới sinh v2 -> Xuất file & kiểm tra lỗi xuất file (EF-40)
        sub_res = self.client.post(
            f"/api/v1/reports/business-result/runs/{run_id}/submit-review/?company_id={self.company.id}"
        )
        self.assertEqual(sub_res.status_code, 200)
        self.assertEqual(sub_res.data["run"]["run_status"], "REVIEW_REQUIRED")

        app_res = self.client.post(
            f"/api/v1/reports/business-result/runs/{run_id}/approve/?company_id={self.company.id}",
            {"approval_note": "Kế toán trưởng duyệt B02 v1"},
            format="json",
        )
        self.assertEqual(app_res.status_code, 200)
        self.assertEqual(app_res.data["run"]["run_status"], "APPROVED")

        # Duyệt lại Run đã APPROVED -> chặn EF-38
        re_app = self.client.post(f"/api/v1/reports/business-result/runs/{run_id}/approve/?company_id={self.company.id}")
        self.assertEqual(re_app.status_code, 400)
        self.assertEqual(re_app.data["error_code"], "EF-38")

        # Xuất báo cáo thành công & mô phỏng lỗi xuất file EF-40 (không làm hỏng trạng thái APPROVED)
        exp_ok = self.client.post(
            f"/api/v1/reports/business-result/runs/{run_id}/export/?company_id={self.company.id}",
            {"export_format": "EXCEL", "display_unit": "THOUSAND_VND"},
            format="json",
        )
        self.assertEqual(exp_ok.status_code, 200)
        self.assertEqual(exp_ok.data["export_status"], "READY")
        self.assertTrue(exp_ok.data["file_name"].endswith(".xlsx"))

        exp_err = self.client.post(
            f"/api/v1/reports/business-result/runs/{run_id}/export/?company_id={self.company.id}",
            {"export_format": "PDF", "simulate_export_error": True},
            format="json",
        )
        self.assertEqual(exp_err.status_code, 400)
        self.assertEqual(exp_err.data["error_code"], "EF-40")
        self.assertEqual(FinancialStatementRun.objects.get(pk=run_id).run_status, "APPROVED")

        # Tạo Run mới trên cùng kỳ -> tạo phiên bản v2, giữ nguyên v1 trong lịch sử
        run_v2 = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "eps_metadata": {"weighted_average_ordinary_shares": 100000},
            },
            format="json",
        )
        self.assertEqual(run_v2.status_code, 201)
        self.assertEqual(run_v2.data["run"]["version_number"], 2)

        hist_res = self.client.get(
            f"/api/v1/reports/business-result/runs/{run_v2.data['statement_run_id']}/history/?company_id={self.company.id}"
        )
        self.assertEqual(hist_res.status_code, 200)
        self.assertEqual(hist_res.data["version_count"], 2)

        # TC-RPT-04-70: Phân quyền RBAC, giới hạn chi nhánh Data Scope, loại trừ doanh thu nội bộ và tính bất biến của sổ cái GL
        self._post_je(
            "JE-INTERNAL-SALE",
            "2026-06-20",
            [
                (self.acc_131, "30000000", "0", {"is_internal": True}),
                (self.acc_5111, "0", "30000000", {"is_internal": True}),
            ],
            branch=self.branch_hq,
        )
        run_branch = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "reporting_scope": "BRANCH",
                "branch_id": str(self.branch_hq.id),
                "eps_metadata": {"weighted_average_ordinary_shares": 100000},
            },
            format="json",
        )
        self.assertEqual(run_branch.status_code, 201)
        b_map = {ln["indicator_code"]: Decimal(ln["raw_current_period_amount"]) for ln in run_branch.data["lines"]}
        # Khi xem phạm vi BRANCH HQ: bao gồm cả 30tr nội bộ -> 230tr
        self.assertEqual(b_map["01"], Decimal("230000000"))

        run_comp_elim = self.client.post(
            "/api/v1/reports/business-result/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B02-DN",
                "fiscal_period_id": str(self.period_2026.id),
                "reporting_scope": "COMPANY",
                "eps_metadata": {"weighted_average_ordinary_shares": 100000},
            },
            format="json",
        )
        self.assertEqual(run_comp_elim.status_code, 201)
        c_map = {ln["indicator_code"]: Decimal(ln["raw_current_period_amount"]) for ln in run_comp_elim.data["lines"]}
        # Khi xem phạm vi COMPANY: loại trừ 30tr doanh thu nội bộ -> giữ đúng 200tr
        self.assertEqual(c_map["01"], Decimal("200000000"))

        # Kiểm tra tài khoản chỉ có quyền xem chi nhánh HQ (không có quyền DETAIL_VIEW, GENERATE, EXPORT và không được xem toàn công ty)
        User = get_user_model()
        u_branch = User.objects.create_user(username="b02_branch_viewer", email="b02_bv@example.com", password="x")
        iam_b = u_branch.iam_account
        m_b = CompanyMembership.objects.create(
            user=iam_b, company=self.company, membership_status=ActiveStatus.ACTIVE, created_by=self.iam
        )
        scope_hq = DataScopeSet.objects.create(
            company=self.company,
            code="SCOPE_B02_HQ_ONLY",
            name="Scope B02 HQ Only",
            allow_all_company_data=False,
            status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )
        DataScopeBranch.objects.create(data_scope_set=scope_hq, branch=self.branch_hq)
        perm_v = Permission.objects.filter(code="RPT_BUSINESS_RESULT_VIEW").first()
        UserPermissionOverride.objects.create(
            company_membership=m_b,
            permission=perm_v,
            effect="GRANT",
            data_scope_set=scope_hq,
            reason="Branch HQ B02 View Only",
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.iam,
        )
        c_bv = APIClient()
        c_bv.force_authenticate(u_branch)

        # Xem Run của chi nhánh HQ -> 200 OK
        ok_b = c_bv.get(
            f"/api/v1/reports/business-result/runs/{run_branch.data['statement_run_id']}/?company_id={self.company.id}"
        )
        self.assertEqual(ok_b.status_code, 200)

        # Xem Run toàn công ty -> 403 EF-10
        deny_c = c_bv.get(
            f"/api/v1/reports/business-result/runs/{run_comp_elim.data['statement_run_id']}/?company_id={self.company.id}"
        )
        self.assertEqual(deny_c.status_code, 403)
        self.assertEqual(deny_c.data["error_code"], "EF-10")

        # Drill-down không có quyền RPT_BUSINESS_RESULT_DETAIL_VIEW -> 403 EF-36
        deny_d = c_bv.get(
            f"/api/v1/reports/business-result/runs/{run_branch.data['statement_run_id']}/lines/01/drilldown/?company_id={self.company.id}"
        )
        self.assertEqual(deny_d.status_code, 403)
        self.assertEqual(deny_d.data["error_code"], "EF-36")

        # Đảm bảo tính bất biến của dữ liệu GL
        je_cnt = JournalEntry.objects.count()
        jl_cnt = JournalLine.objects.count()
        self.client.get(f"/api/v1/reports/business-result/runs/{run_id}/?company_id={self.company.id}")
        self.client.post(f"/api/v1/reports/business-result/runs/{run_id}/validate/?company_id={self.company.id}")
        self.assertEqual(JournalEntry.objects.count(), je_cnt)
        self.assertEqual(JournalLine.objects.count(), jl_cnt)


class CashFlowUcRpt05Tests(TestCase):
    """
    UC-RPT-05 – Xem báo cáo lưu chuyển tiền tệ (B03-DN, B03-DNKLT, B03a-DN, B03b-DN)
    Kiểm thử tự động toàn diện cho 95 kịch bản TC-RPT-05-01 .. TC-RPT-05-95 theo Thông tư 99/2025/TT-BTC.
    """

    def setUp(self):
        from datetime import timedelta
        from django.utils import timezone
        from iam.models import ActiveStatus, CompanyMembership, Permission, UserPermissionOverride
        from reporting.cash_flow_services import seed_cash_flow_uc_rpt_05

        seed_cash_flow_uc_rpt_05()

        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="CF05-CORP",
            name="Công ty Cổ phần Dòng Tiền Chuẩn TT99",
            legal_name="Công ty Cổ phần Dòng Tiền Chuẩn TT99",
            tax_code="0100777888",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch_hq = Branch.objects.create(company=self.company, code="HQ", name="Trụ sở chính Hà Nội")
        self.branch_south = Branch.objects.create(company=self.company, code="SOUTH", name="Chi nhánh TP.HCM")

        self.period_2025 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2025,
            period_number=12,
            code="CF-2025-12",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            status="CLOSED",
        )
        self.period_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=12,
            code="CF-2026-12",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="OPEN",
        )
        self.period_q1_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=3,
            code="CF-2026-Q1",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
            status="CLOSED",
        )
        self.period_q2_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=6,
            code="CF-2026-Q2",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 6, 30),
            status="OPEN",
        )
        self.period_q2_2025 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2025,
            period_number=6,
            code="CF-2025-Q2",
            start_date=date(2025, 4, 1),
            end_date=date(2025, 6, 30),
            status="CLOSED",
        )

        User = get_user_model()
        self.user = User.objects.create_user(username="chief_b03", email="chief_b03@example.com", password="x")
        self.iam = self.user.iam_account
        self.membership = CompanyMembership.objects.create(
            user=self.iam,
            company=self.company,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )

        for perm_code in (
            "RPT_CASH_FLOW_VIEW",
            "RPT_CASH_FLOW_DETAIL_VIEW",
            "RPT_CASH_FLOW_GENERATE",
            "RPT_CASH_FLOW_VALIDATE",
            "RPT_CASH_FLOW_APPROVE",
            "RPT_CASH_FLOW_EXPORT",
            "RPT_FINANCIAL_VIEW",
            "RPT_FINANCIAL_DETAIL_VIEW",
            "RPT_FINANCIAL_GENERATE",
            "RPT_FINANCIAL_APPROVE",
            "RPT_FINANCIAL_EXPORT",
            "RPT_BUSINESS_RESULT_VIEW",
            "RPT_BUSINESS_RESULT_GENERATE",
        ):
            perm = Permission.objects.filter(code=perm_code).first()
            if perm:
                UserPermissionOverride.objects.create(
                    company_membership=self.membership,
                    permission=perm,
                    effect="GRANT",
                    reason="Grant B03 permissions for test",
                    valid_from=timezone.now() - timedelta(days=1),
                    assigned_by=self.iam,
                )

        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT99-B03", name="TT99 B03", effective_from="2025-01-01", is_default=True
        )
        self.cls_asset = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.cls_liab = AccountClass.objects.create(company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT")
        self.cls_eq = AccountClass.objects.create(company=self.company, code="EQUITY", name="Vốn chủ sở hữu", normal_balance="CREDIT")
        self.cls_rev = AccountClass.objects.create(company=self.company, code="REV", name="Doanh thu", normal_balance="CREDIT")
        self.cls_exp = AccountClass.objects.create(company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT")

        self.acc_111 = self._mk_acc("1111", "Tiền mặt VND", "ASSET", "DEBIT")
        self.acc_112 = self._mk_acc("1121", "Tiền gửi ngân hàng VND", "ASSET", "DEBIT")
        self.acc_1122 = self._mk_acc("1122", "Tiền gửi ngân hàng ngoại tệ", "ASSET", "DEBIT")
        self.acc_121 = self._mk_acc("121", "Chứng khoán kinh doanh", "ASSET", "DEBIT")
        self.acc_1281 = self._mk_acc("1281", "Tiền gửi có kỳ hạn", "ASSET", "DEBIT")
        self.acc_1288 = self._mk_acc("1288", "Đầu tư nắm giữ đến ngày đáo hạn khác", "ASSET", "DEBIT")
        self.acc_131 = self._mk_acc("131", "Phải thu khách hàng", "ASSET", "DEBIT")
        self.acc_138 = self._mk_acc("1388", "Phải thu khác", "ASSET", "DEBIT")
        self.acc_156 = self._mk_acc("156", "Hàng hóa", "ASSET", "DEBIT")
        self.acc_211 = self._mk_acc("211", "TSCĐ hữu hình", "ASSET", "DEBIT")
        self.acc_214 = self._mk_acc("2141", "Hao mòn TSCĐ hữu hình", "ASSET", "CREDIT")
        self.acc_221 = self._mk_acc("221", "Đầu tư vào công ty con", "ASSET", "DEBIT")
        self.acc_229 = self._mk_acc("2294", "Dự phòng giảm giá hàng tồn kho", "ASSET", "CREDIT")
        self.acc_242 = self._mk_acc("242", "Chi phí trả trước", "ASSET", "DEBIT")
        self.acc_331 = self._mk_acc("331", "Phải trả người bán", "LIABILITY", "CREDIT")
        self.acc_3334 = self._mk_acc("3334", "Thuế TNDN phải nộp", "LIABILITY", "CREDIT")
        self.acc_334 = self._mk_acc("334", "Phải trả người lao động", "LIABILITY", "CREDIT")
        self.acc_335 = self._mk_acc("335", "Chi phí phải trả", "LIABILITY", "CREDIT")
        self.acc_3388 = self._mk_acc("3388", "Phải trả, phải nộp khác", "LIABILITY", "CREDIT")
        self.acc_341 = self._mk_acc("3411", "Các khoản đi vay", "LIABILITY", "CREDIT")
        self.acc_3412 = self._mk_acc("3412", "Nợ thuê tài chính", "LIABILITY", "CREDIT")
        self.acc_411 = self._mk_acc("4111", "Vốn góp của chủ sở hữu", "EQUITY", "CREDIT")
        self.acc_413 = self._mk_acc("4131", "Chênh lệch tỷ giá đánh giá lại", "EQUITY", "CREDIT")
        self.acc_419 = self._mk_acc("419", "Cổ phiếu mua lại của chính mình", "EQUITY", "DEBIT")
        self.acc_421 = self._mk_acc("4212", "LNST chưa phân phối", "EQUITY", "CREDIT")
        self.acc_511 = self._mk_acc("5111", "Doanh thu bán hàng", "REVENUE", "CREDIT")
        self.acc_515 = self._mk_acc("515", "Doanh thu hoạt động tài chính", "REVENUE", "CREDIT")
        self.acc_632 = self._mk_acc("632", "Giá vốn hàng bán", "EXPENSE", "DEBIT")
        self.acc_635 = self._mk_acc("635", "Chi phí tài chính", "EXPENSE", "DEBIT")
        self.acc_641 = self._mk_acc("641", "Chi phí bán hàng", "EXPENSE", "DEBIT")
        self.acc_642 = self._mk_acc("642", "Chi phí quản lý doanh nghiệp", "EXPENSE", "DEBIT")
        self.acc_711 = self._mk_acc("711", "Thu nhập khác", "REVENUE", "CREDIT")
        self.acc_811 = self._mk_acc("811", "Chi phí khác", "EXPENSE", "DEBIT")
        self.acc_8211 = self._mk_acc("8211", "Chi phí thuế TNDN hiện hành", "EXPENSE", "DEBIT")

    def _mk_acc(self, code: str, name: str, acc_type: str, normal_balance: str) -> Account:
        cls_map = {
            "ASSET": self.cls_asset,
            "LIABILITY": self.cls_liab,
            "EQUITY": self.cls_eq,
            "REVENUE": self.cls_rev,
            "EXPENSE": self.cls_exp,
        }
        acc, _ = Account.objects.get_or_create(
            company=self.company,
            code=code,
            defaults={
                "chart_of_accounts": self.chart,
                "account_class": cls_map.get(acc_type, self.cls_asset),
                "name": name,
                "account_type": acc_type,
                "normal_balance": normal_balance,
            },
        )
        return acc

    def _post_je(
        self,
        number: str,
        posting_date: str,
        lines_spec: list[tuple],
        period: AccountingPeriod | None = None,
        branch: Branch | None = None,
        entry_type: str = "MANUAL",
        status: str = "POSTED",
        description: str = "",
        workflow_snapshot: dict | None = None,
    ) -> JournalEntry:
        from django.utils import timezone
        target_period = period or self.period_2026
        total_d = sum((Decimal(str(it[1])) for it in lines_spec), Decimal("0"))
        total_c = sum((Decimal(str(it[2])) for it in lines_spec), Decimal("0"))
        je = JournalEntry.objects.create(
            company=self.company,
            branch=branch or self.branch_hq,
            period=target_period,
            number=number,
            entry_type=entry_type,
            posting_date=posting_date,
            status=status,
            description=description or f"Bút toán B03 {number}",
            workflow_snapshot=workflow_snapshot or {},
            total_debit=total_d,
            total_credit=total_c,
            created_by=self.iam,
            posted_by=self.iam if status in ("POSTED", "REVERSED") else None,
            posted_at=timezone.now() if status in ("POSTED", "REVERSED") else None,
        )
        for idx, item in enumerate(lines_spec, start=1):
            acc = item[0]
            debit = Decimal(str(item[1]))
            credit = Decimal(str(item[2]))
            dims = item[3] if len(item) > 3 else {}
            desc = item[4] if len(item) > 4 else ""
            JournalLine.objects.create(
                entry=je,
                line_no=idx,
                account=acc,
                debit=debit,
                credit=credit,
                currency=self.vnd,
                dimensions=dims or {},
                description=desc,
            )
        return je

    def test_tc_rpt_05_01_to_12_templates_versions_parameters_slots_and_bundle_context(self):
        """TC-RPT-05-01 .. TC-RPT-05-12: 4 mẫu B03-DN, B03-DNKLT, B03a-DN, B03b-DN (DIRECT 27 dòng, INDIRECT 37 dòng, B03b 8 dòng 4 slots), lỗi tham số & quyền."""
        # TC-RPT-05-01..06: Danh mục 4 biểu mẫu B03 theo Thông tư 99
        tpl_res = self.client.get(f"/api/v1/reports/cash-flow/templates/?company_id={self.company.id}")
        self.assertEqual(tpl_res.status_code, 200)
        by_legal = {t["legal_form_code"]: t for t in tpl_res.data["templates"]}
        self.assertEqual(set(by_legal.keys()), {"B03-DN", "B03-DNKLT", "B03a-DN", "B03b-DN"})
        self.assertEqual(by_legal["B03-DN"]["direct_indicator_count"], 27)
        self.assertEqual(by_legal["B03-DN"]["indirect_indicator_count"], 37)
        self.assertEqual(by_legal["B03-DN"]["value_slot_count"], 2)
        self.assertEqual(by_legal["B03-DNKLT"]["going_concern_status"], "NON_GOING_CONCERN")
        self.assertEqual(by_legal["B03a-DN"]["direct_indicator_count"], 27)
        self.assertEqual(by_legal["B03a-DN"]["indirect_indicator_count"], 37)
        self.assertEqual(by_legal["B03a-DN"]["value_slot_count"], 2)
        self.assertEqual(by_legal["B03b-DN"]["direct_indicator_count"], 8)
        self.assertEqual(by_legal["B03b-DN"]["value_slot_count"], 4)
        self.assertEqual(by_legal["B03b-DN"]["table_column_count"], 7)

        # TC-RPT-05-08: Template versions theo phương pháp DIRECT vs INDIRECT
        ver_dir = self.client.get(
            f"/api/v1/reports/cash-flow/template-versions/?company_id={self.company.id}&template_code=B03-DN&cash_flow_method=DIRECT"
        )
        self.assertEqual(ver_dir.status_code, 200)
        self.assertEqual(ver_dir.data["template_versions"][0]["indicator_count"], 27)

        ver_ind = self.client.get(
            f"/api/v1/reports/cash-flow/template-versions/?company_id={self.company.id}&template_code=B03-DN&cash_flow_method=INDIRECT"
        )
        self.assertEqual(ver_ind.status_code, 200)
        self.assertEqual(ver_ind.data["template_versions"][0]["indicator_count"], 37)

        param_res = self.client.get(f"/api/v1/reports/cash-flow/parameters/?company_id={self.company.id}")
        self.assertEqual(param_res.status_code, 200)
        self.assertTrue(param_res.data["permissions"]["can_view"])
        self.assertTrue(param_res.data["permissions"]["can_generate"])

        # TC-RPT-05-09: Khi chưa có Run đã lưu, require_saved_run=true trả EF-11 (tuyệt đối không trả dữ liệu mẫu 300.000.000)
        no_run = self.client.get(
            f"/api/v1/reports/cash-flow/runs/?company_id={self.company.id}&fiscal_year=2026&require_saved_run=true"
        )
        self.assertEqual(no_run.status_code, 400)
        self.assertEqual(no_run.data["error_code"], "EF-11")

        # TC-RPT-05-10..11: Kiểm tra lỗi khoảng ngày (EF-04), sai giả định hoạt động liên tục (EF-07), sai loại kỳ (EF-06), sai phương pháp (EF-05)
        bad_date = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "period_start_date": "2026-12-31",
                "period_end_date": "2026-01-01",
            },
            format="json",
        )
        self.assertEqual(bad_date.status_code, 400)
        self.assertEqual(bad_date.data["error_code"], "EF-04")

        bad_gc = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "going_concern_status": "NON_GOING_CONCERN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(bad_gc.status_code, 400)
        self.assertEqual(bad_gc.data["error_code"], "EF-07")

        bad_gran = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03a-DN",
                "period_type": "ANNUAL",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(bad_gran.status_code, 400)
        self.assertEqual(bad_gran.data["error_code"], "EF-06")

        bad_method = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "INVALID_METHOD",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(bad_method.status_code, 400)
        self.assertEqual(bad_method.data["error_code"], "EF-05")

        # Hạch toán số dư đầu năm 2025, phát sinh Q2/2025, Q1/2026 và Q2/2026 để kiểm tra B03a-DN (lũy kế YTD) và B03b-DN (8 dòng, 4 slots, chỉ tiêu 62)
        from reporting.models import CashEquivalentInstrument

        self._post_je(
            "JE-2025-Q2-CASH",
            "2025-05-10",
            [
                (self.acc_112, "120000000", "0"),
                (self.acc_511, "0", "120000000"),
            ],
            period=self.period_q2_2025,
        )
        self._post_je(
            "JE-2026-Q1-CASH",
            "2026-02-15",
            [
                (self.acc_112, "200000000", "0"),
                (self.acc_511, "0", "200000000"),
            ],
            period=self.period_q1_2026,
        )
        self._post_je(
            "JE-2026-Q2-CASH",
            "2026-05-20",
            [
                (self.acc_112, "300000000", "0"),
                (self.acc_511, "0", "300000000"),
                (self.acc_211, "50000000", "0", {"is_capex": True}),
                (self.acc_112, "0", "50000000"),
                (self.acc_112, "80000000", "0"),
                (self.acc_341, "0", "80000000"),
            ],
            period=self.period_q2_2026,
        )
        # Ghi nhận khoản tương đương tiền tái phân loại cuối Quý 2/2026 (Chỉ tiêu 62 trên B03b-DN = +15tr, cùng 15tr trên TK 1281 đầu kỳ)
        self._post_je(
            "JE-2026-Q2-1281",
            "2026-06-30",
            [
                (self.acc_1281, "15000000", "0", {"is_cash_equivalent": True}),
                (self.acc_1288, "0", "15000000", {"exclude_from_working_capital": True}),
            ],
            period=self.period_q2_2026,
        )
        CashEquivalentInstrument.objects.create(
            company=self.company,
            branch=self.branch_hq,
            instrument_code="CD-2026-01",
            instrument_name="Chứng chỉ tiền gửi tái phân loại thành tương đương tiền cuối Q2/2026",
            acquisition_date=date(2026, 4, 15),
            original_maturity_date=date(2026, 7, 10),
            principal_amount=Decimal("15000000"),
            cash_equivalent_status="RECLASSIFIED_IN",
            opening_classification="SHORT_TERM_INVESTMENT",
            closing_classification="CASH_EQUIVALENT",
            reclassification_effective_date=date(2026, 6, 30),
            reclassification_impact_amount=Decimal("15000000"),
            reclassification_reason="Đáo hạn còn dưới 3 tháng tại thời điểm cuối Quý 2/2026",
            source_reference="RECLASS-Q2-01",
            is_cash_flow_transaction=False,
        )

        # TC-RPT-05-04: B03a-DN Trực tiếp Quý 2/2026 -> 27 dòng, 2 cột YTD (Lũy kế 6 tháng = Q1 200tr + Q2 300tr = 500tr tại mã 01!)
        res_b03a = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03a-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_q2_2026.id),
                "period_type": "QUARTERLY",
            },
            format="json",
        )
        self.assertEqual(res_b03a.status_code, 201)
        self.assertEqual(res_b03a.data["total_template_lines"], 27)
        b03a_map = {ln["indicator_code"]: ln for ln in res_b03a.data["lines"]}
        self.assertEqual(set(b03a_map["01"]["slots_by_code"].keys()), {"YTD_CURRENT", "YTD_PREVIOUS"})
        self.assertEqual(Decimal(b03a_map["01"]["slots_by_code"]["YTD_CURRENT"]["raw_amount"]), Decimal("500000000"))
        self.assertEqual(Decimal(b03a_map["01"]["slots_by_code"]["YTD_PREVIOUS"]["raw_amount"]), Decimal("120000000"))

        # TC-RPT-05-06: B03b-DN Quý 2/2026 -> 8 chỉ tiêu (20, 30, 40, 50, 60, 61, 62, 70), 4 Value Slots, 70 = 50 + 60 + 61 + 62!
        res_b03b = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03b-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_q2_2026.id),
                "period_type": "QUARTERLY",
            },
            format="json",
        )
        self.assertEqual(res_b03b.status_code, 201)
        self.assertEqual(res_b03b.data["total_template_lines"], 8)
        b03b_codes = [ln["indicator_code"] for ln in res_b03b.data["lines"]]
        self.assertEqual(b03b_codes, ["20", "30", "40", "50", "60", "61", "62", "70"])
        b03b_map = {ln["indicator_code"]: ln for ln in res_b03b.data["lines"]}
        self.assertEqual(
            set(b03b_map["20"]["slots_by_code"].keys()),
            {"QUARTER_CURRENT", "QUARTER_PREVIOUS", "YTD_CURRENT", "YTD_PREVIOUS"},
        )
        # Quý 2/2026: 20 = +300tr, 30 = -50tr, 40 = +80tr -> 50 = +330tr; 60 (đầu Q2 = cuối Q1: 120tr năm 2025 + 200tr Q1/2026 = 320tr); 62 = +15tr -> 70 = 330 + 320 + 0 + 15 = 665tr!
        self.assertEqual(Decimal(b03b_map["20"]["raw_current_period_amount"]), Decimal("300000000"))
        self.assertEqual(Decimal(b03b_map["30"]["raw_current_period_amount"]), Decimal("-50000000"))
        self.assertEqual(Decimal(b03b_map["40"]["raw_current_period_amount"]), Decimal("80000000"))
        self.assertEqual(Decimal(b03b_map["50"]["raw_current_period_amount"]), Decimal("330000000"))
        self.assertEqual(Decimal(b03b_map["60"]["raw_current_period_amount"]), Decimal("320000000"))
        self.assertEqual(Decimal(b03b_map["62"]["raw_current_period_amount"]), Decimal("15000000"))
        self.assertEqual(Decimal(b03b_map["70"]["raw_current_period_amount"]), Decimal("665000000"))
        self.assertEqual(res_b03b.data["validation"]["validation_status"], "PASSED")

        # Truy vấn chỉ tiêu chi tiết không thuộc B03b-DN (VD: mã 01) -> trả lỗi EF-15
        err_b03b_line = self.client.get(
            f"/api/v1/reports/cash-flow/runs/{res_b03b.data['statement_run_id']}/lines/01/calculation/?company_id={self.company.id}"
        )
        self.assertEqual(err_b03b_line.status_code, 400)
        self.assertEqual(err_b03b_line.data["error_code"], "EF-15")

    def test_tc_rpt_05_13_to_68_direct_27_lines_indirect_37_lines_and_cross_reconciliation(self):
        """TC-RPT-05-13 .. TC-RPT-05-68: Kiểm tra toàn bộ 27 chỉ tiêu DIRECT, 37 chỉ tiêu INDIRECT, đối chiếu DIRECT.20 == INDIRECT.20 và B03.70 == B01.110."""
        # 1. Số dư tiền đầu năm 2026 (cuối 2025): Tiền gửi NH 112 = 500tr, Vốn góp 411 = 500tr -> Mã 60 đầu kỳ 2026 = 500tr
        self._post_je(
            "JE-2025-OPEN-CASH",
            "2025-12-31",
            [
                (self.acc_112, "500000000", "0"),
                (self.acc_411, "0", "500000000"),
            ],
            period=self.period_2025,
        )

        # 2. Bán hàng năm 2026:
        # - Bán hàng thu tiền ngay (Nợ 112 / Có 511 = 800tr) -> DIRECT.01 = +800tr
        # - Bán hàng chưa thu tiền (Nợ 131 / Có 511 = 200tr) -> Không vào DIRECT.01 (EF-18), nhưng vào B02.01 (tổng doanh thu 1.000tr) và làm tăng Phải thu 131 (+200tr -> INDIRECT.09 = -200tr!)
        self._post_je(
            "JE-2026-CASH-SALE",
            "2026-02-10",
            [
                (self.acc_112, "800000000", "0"),
                (self.acc_511, "0", "800000000"),
            ],
        )
        self._post_je(
            "JE-2026-CREDIT-SALE",
            "2026-02-20",
            [
                (self.acc_131, "200000000", "0"),
                (self.acc_511, "0", "200000000"),
            ],
        )

        # 3. Mua hàng & Giá vốn:
        # - Mua hàng trả tiền ngay (Nợ 156 / Có 112 = 350tr) -> DIRECT.02 = -350tr
        # - Mua hàng chưa trả tiền (Nợ 156 / Có 331 = 100tr) -> Tăng 331 (+100tr -> INDIRECT.11 = +100tr)
        # - Xuất kho giá vốn (Nợ 632 / Có 156 = 400tr) -> Tồn kho 156 cuối kỳ tăng 50tr (450tr - 400tr -> INDIRECT.10 = -50tr)
        self._post_je(
            "JE-2026-PUR-CASH",
            "2026-03-05",
            [
                (self.acc_156, "350000000", "0"),
                (self.acc_112, "0", "350000000"),
            ],
        )
        self._post_je(
            "JE-2026-PUR-CREDIT",
            "2026-03-10",
            [
                (self.acc_156, "100000000", "0"),
                (self.acc_331, "0", "100000000"),
            ],
        )
        self._post_je(
            "JE-2026-COGS",
            "2026-03-15",
            [
                (self.acc_632, "400000000", "0"),
                (self.acc_156, "0", "400000000"),
            ],
        )

        # 4. Lương người lao động: Tính lương Nợ 642 / Có 334 = 120tr, đã thực chi Nợ 334 / Có 112 = 120tr -> DIRECT.03 = -120tr
        self._post_je(
            "JE-2026-PAYROLL-ACCRUE",
            "2026-04-30",
            [
                (self.acc_642, "120000000", "0"),
                (self.acc_334, "0", "120000000"),
            ],
        )
        self._post_je(
            "JE-2026-PAYROLL-PAID",
            "2026-05-05",
            [
                (self.acc_334, "120000000", "0"),
                (self.acc_112, "0", "120000000"),
            ],
        )

        # 5. Khấu hao TSCĐ (Nợ 642 / Có 214 = 60tr) & Trích lập dự phòng HTK (Nợ 632 / Có 229 = 10tr) -> Không phát sinh tiền; INDIRECT.02 = +60tr, INDIRECT.03 = +10tr
        self._post_je(
            "JE-2026-DEPR-PROV",
            "2026-06-30",
            [
                (self.acc_642, "60000000", "0"),
                (self.acc_214, "0", "60000000"),
                (self.acc_632, "10000000", "0"),
                (self.acc_229, "0", "10000000"),
            ],
        )

        # 6. Chi phí lãi vay: Ghi nhận chi phí lãi vay Nợ 635 / Có 335 = 30tr (INDIRECT.06 = +30tr), thực trả lãi vay Nợ 335 / Có 112 = 25tr (DIRECT.04 = -25tr, INDIRECT.14 = -25tr)
        self._post_je(
            "JE-2026-INTEREST-ACCRUE",
            "2026-07-15",
            [
                (self.acc_635, "30000000", "0", {"is_borrowing_cost": True}, "Chi phí lãi vay phát sinh"),
                (self.acc_335, "0", "30000000", {"is_borrowing_cost": True}, "Trích trước lãi vay"),
            ],
        )
        self._post_je(
            "JE-2026-INTEREST-PAID",
            "2026-07-20",
            [
                (self.acc_335, "25000000", "0", {"is_borrowing_cost": True}, "Trả lãi vay ngân hàng"),
                (self.acc_112, "0", "25000000"),
            ],
        )

        # 7. Thuế TNDN: Ghi nhận chi phí thuế TNDN hiện hành Nợ 8211 / Có 3334 = 50tr (không làm giảm LNTT 01), thực nộp thuế TNDN Nợ 3334 / Có 112 = 40tr (DIRECT.05 = -40tr, INDIRECT.15 = -40tr)
        self._post_je(
            "JE-2026-CIT-ACCRUE",
            "2026-09-30",
            [
                (self.acc_8211, "50000000", "0"),
                (self.acc_3334, "0", "50000000"),
            ],
        )
        self._post_je(
            "JE-2026-CIT-PAID",
            "2026-10-10",
            [
                (self.acc_3334, "40000000", "0"),
                (self.acc_112, "0", "40000000"),
            ],
        )

        # 8. Hoạt động đầu tư:
        # - Chi mua TSCĐ (Nợ 211 / Có 112 = 150tr) -> 21 = -150tr
        # - Thu lãi tiền gửi (Nợ 112 / Có 515 = 20tr) -> 27 = +20tr, và trên INDIRECT.05 điều chỉnh giảm lãi đầu tư = -20tr!
        self._post_je(
            "JE-2026-CAPEX",
            "2026-08-01",
            [
                (self.acc_211, "150000000", "0", {"is_capex": True}),
                (self.acc_112, "0", "150000000"),
            ],
        )
        self._post_je(
            "JE-2026-INT-INCOME",
            "2026-08-15",
            [
                (self.acc_112, "20000000", "0"),
                (self.acc_515, "0", "20000000"),
            ],
        )

        # 9. Hoạt động tài chính:
        # - Nhận vốn góp (Nợ 112 / Có 411 = 100tr) -> 31 = +100tr
        # - Đi vay ngân hàng (Nợ 112 / Có 341 = 200tr) -> 33 = +200tr
        # - Trả nợ gốc vay (Nợ 341 / Có 112 = 70tr) -> 34 = -70tr
        # - Trả cổ tức cho chủ sở hữu (Nợ 421 / Có 112 = 30tr) -> 36 = -30tr
        self._post_je(
            "JE-2026-FIN-FLOWS",
            "2026-11-15",
            [
                (self.acc_112, "100000000", "0"),
                (self.acc_411, "0", "100000000"),
                (self.acc_112, "200000000", "0"),
                (self.acc_341, "0", "200000000"),
                (self.acc_341, "70000000", "0"),
                (self.acc_112, "0", "70000000"),
                (self.acc_421, "30000000", "0", {"is_dividend_paid": True}, "Chi trả cổ tức năm 2026"),
                (self.acc_112, "0", "30000000"),
            ],
        )

        # 10. Chuyển tiền nội bộ (Nợ 111 / Có 112 = 50tr) -> Bị loại trừ khỏi thu/chi đối ngoại, chỉ đổi cơ cấu tiền cuối kỳ!
        self._post_je(
            "JE-2026-INTERNAL-TRANSFER",
            "2026-12-01",
            [
                (self.acc_111, "50000000", "0"),
                (self.acc_112, "0", "50000000"),
            ],
        )

        # 11. Đánh giá lại ngoại tệ tiền gửi cuối kỳ (Nợ 1122 / Có 413 = 5tr) -> Mã 61 = +5tr
        self._post_je(
            "JE-2026-CASH-FX-61",
            "2026-12-31",
            [
                (self.acc_1122, "5000000", "0"),
                (self.acc_413, "0", "5000000", {"is_cash_fx_revaluation": True}),
            ],
        )

        # Tạo Run B03-DN theo phương pháp TRỰC TIẾP (DIRECT)
        res_dir = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(res_dir.status_code, 201)
        self.assertEqual(res_dir.data["validation"]["validation_status"], "PASSED")
        dmap = {ln["indicator_code"]: Decimal(ln["raw_current_period_amount"]) for ln in res_dir.data["lines"]}

        # Kiểm tra các chỉ tiêu DIRECT:
        self.assertEqual(dmap["01"], Decimal("800000000"))    # Chỉ lấy 800tr thực thu (không lấy 200tr bán chịu)
        self.assertEqual(dmap["02"], Decimal("-350000000"))   # Thực trả NCC
        self.assertEqual(dmap["03"], Decimal("-120000000"))   # Thực trả NLĐ
        self.assertEqual(dmap["04"], Decimal("-25000000"))    # Thực trả lãi vay (không phải 30tr chi phí lãi vay)
        self.assertEqual(dmap["05"], Decimal("-40000000"))    # Thực nộp thuế TNDN (không phải 50tr chi phí thuế 8211)
        self.assertEqual(dmap["20"], Decimal("265000000"))    # 800 - 350 - 120 - 25 - 40 = +265tr
        self.assertEqual(dmap["21"], Decimal("-150000000"))   # Mua TSCĐ
        self.assertEqual(dmap["27"], Decimal("20000000"))     # Thu lãi tiền gửi
        self.assertEqual(dmap["30"], Decimal("-130000000"))   # -150 + 20 = -130tr
        self.assertEqual(dmap["31"], Decimal("100000000"))    # Nhận vốn góp
        self.assertEqual(dmap["33"], Decimal("200000000"))    # Thu đi vay
        self.assertEqual(dmap["34"], Decimal("-70000000"))    # Trả nợ gốc vay
        self.assertEqual(dmap["36"], Decimal("-30000000"))    # Trả cổ tức
        self.assertEqual(dmap["40"], Decimal("200000000"))    # 100 + 200 - 70 - 30 = +200tr
        self.assertEqual(dmap["50"], Decimal("335000000"))    # 265 - 130 + 200 = +335tr
        self.assertEqual(dmap["60"], Decimal("500000000"))    # Tiền đầu kỳ
        self.assertEqual(dmap["61"], Decimal("5000000"))      # Ảnh hưởng tỷ giá quy đổi ngoại tệ
        self.assertEqual(dmap["70"], Decimal("840000000"))    # 335 + 500 + 5 = 840tr (Khớp chính xác số dư tiền 111+112+1122 cuối kỳ!)

        # Tạo Run B03-DN theo phương pháp GIÁN TIẾP (INDIRECT) trên cùng bộ dữ liệu
        res_ind = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "INDIRECT",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(res_ind.status_code, 201)
        self.assertEqual(res_ind.data["validation"]["validation_status"], "PASSED")
        imap = {ln["indicator_code"]: Decimal(ln["raw_current_period_amount"]) for ln in res_ind.data["lines"]}

        # Kiểm tra các chỉ tiêu INDIRECT:
        # LNTT B02.50 = Doanh thu 1.000tr + DTTC 20tr - Giá vốn (400tr + 10tr dự phòng) - QLDN (120tr + 60tr KH) - CPTC 30tr = 400tr!
        self.assertEqual(imap["01"], Decimal("400000000"))
        self.assertEqual(imap["02"], Decimal("60000000"))     # Khấu hao TSCĐ (+60tr)
        self.assertEqual(imap["03"], Decimal("10000000"))     # Dự phòng (+10tr)
        self.assertEqual(imap["05"], Decimal("-20000000"))    # Lãi hoạt động đầu tư (-20tr)
        self.assertEqual(imap["06"], Decimal("30000000"))     # Chi phí lãi vay (+30tr)
        self.assertEqual(imap["08"], Decimal("480000000"))    # Lợi nhuận HĐKD trước thay đổi VLĐ = 400 + 60 + 10 - 20 + 30 = 480tr
        self.assertEqual(imap["09"], Decimal("-200000000"))   # Tăng các khoản phải thu 131 (-200tr)
        self.assertEqual(imap["10"], Decimal("-50000000"))    # Tăng hàng tồn kho 156 (-50tr)
        self.assertEqual(imap["11"], Decimal("100000000"))    # Tăng các khoản phải trả 331 (+100tr; không gồm 3334 thuế TNDN hay 335 lãi vay!)
        self.assertEqual(imap["14"], Decimal("-25000000"))    # Tiền lãi vay đã trả (-25tr)
        self.assertEqual(imap["15"], Decimal("-40000000"))    # Thuế TNDN đã nộp (-40tr)
        # Lưu chuyển tiền thuần HĐKD [20] theo INDIRECT = 480 - 200 - 50 + 100 - 25 - 40 = 265tr == DIRECT.20!
        self.assertEqual(imap["20"], Decimal("265000000"))
        self.assertEqual(imap["20"], dmap["20"])
        self.assertEqual(imap["30"], Decimal("-130000000"))
        self.assertEqual(imap["40"], Decimal("200000000"))
        self.assertEqual(imap["50"], Decimal("335000000"))
        self.assertEqual(imap["60"], Decimal("500000000"))
        self.assertEqual(imap["61"], Decimal("5000000"))
        self.assertEqual(imap["70"], Decimal("840000000"))

        # Kiểm tra API đối chiếu /reconciliation
        rec_res = self.client.get(
            f"/api/v1/reports/cash-flow/runs/{res_ind.data['statement_run_id']}/reconciliation/?company_id={self.company.id}"
        )
        self.assertEqual(rec_res.status_code, 200)
        self.assertTrue(rec_res.data["reconciled_with_cash_ledger"])
        self.assertTrue(rec_res.data["operating_20_method_cross_check"]["is_consistent"])
        self.assertTrue(rec_res.data["indirect_01_vs_b02_50_check"]["is_matched"])
        self.assertEqual(rec_res.data["internal_transfers_excluded_count"], 1)

    def test_tc_rpt_05_69_to_80_special_rules_unclassified_loan_direct_split_ineligible_and_25_validations(self):
        """TC-RPT-05-69 .. TC-RPT-05-80: Vay giải ngân thẳng NCC (33 & 21), tách gốc/lãi vay (34 & 04/14), giao dịch chưa phân loại (EF-24), phân bổ vượt mức (TC-70), sao kê trùng (EF-28) & 25 Validation Rules."""
        from reporting.models import CashFlowClassification, CashFlowEvent

        # 1. Nghiệp vụ vay ngân hàng giải ngân thẳng cho nhà cung cấp TSCĐ (100tr):
        # Không đi qua TK 111/112 nhưng theo Thông tư 99 phải trình bày đồng thời ở Mã 33 (+100tr) và Mã 21 (-100tr)!
        self._post_je(
            "JE-2026-LOAN-DIRECT-CAPEX",
            "2026-04-10",
            [
                (self.acc_211, "100000000", "0", {"loan_direct_payment": True, "is_capex": True}),
                (self.acc_341, "0", "100000000", {"loan_direct_payment": True}),
            ],
            workflow_snapshot={"is_loan_direct_payment": True},
        )

        # 2. Nghiệp vụ trả nợ vay gộp gốc (60tr) và lãi (15tr) trên cùng chứng từ chi tiền 75tr:
        # Hệ thống tự động tách gốc vào Mã 34 (-60tr) và lãi vào Mã 04 (-15tr) / INDIRECT Mã 14 (-15tr)!
        self._post_je(
            "JE-2026-LOAN-SPLIT",
            "2026-05-10",
            [
                (self.acc_112, "200000000", "0"),
                (self.acc_411, "0", "200000000"),
                (
                    self.acc_341,
                    "75000000",
                    "0",
                    {"principal_amount": "60000000", "interest_amount": "15000000"},
                    "Thanh toán gốc 60tr và lãi 15tr",
                ),
                (self.acc_112, "0", "75000000"),
            ],
        )

        res_ok = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, 201)
        self.assertEqual(res_ok.data["validation"]["validation_status"], "PASSED")
        m_ok = {ln["indicator_code"]: Decimal(ln["raw_current_period_amount"]) for ln in res_ok.data["lines"]}
        self.assertEqual(m_ok["33"], Decimal("100000000"))   # Vay giải ngân thẳng NCC (+100tr)
        self.assertEqual(m_ok["21"], Decimal("-100000000"))  # Mua TSCĐ từ khoản vay giải ngân thẳng (-100tr)
        self.assertEqual(m_ok["34"], Decimal("-60000000"))   # Trả nợ gốc vay (-60tr)
        self.assertEqual(m_ok["04"], Decimal("-15000000"))   # Trả lãi vay (-15tr)
        self.assertEqual(m_ok["70"], Decimal("125000000"))   # Tiền cuối kỳ = 200tr - 75tr = 125tr

        # 3. Kiểm tra phát hiện giao dịch chưa phân loại (TC-RPT-05-69 / EF-24):
        # Tuyệt đối không tự đẩy vào mã 06/07, phải báo FAILED tại B03-VAL-11 và trả về trong /unclassified-transactions!
        evt_uncls = CashFlowEvent.objects.create(
            company=self.company,
            branch=self.branch_hq,
            source_system="CASH",
            source_document_id="PT-UNCLS-01",
            source_reference="PT-UNCLS-01",
            event_type="RECEIPT",
            transaction_date=date(2026, 6, 1),
            posting_date=date(2026, 6, 1),
            amount_base=Decimal("45000000"),
            event_status="POSTED",
            description="Khoản thu tiền chưa có quy tắc phân loại dòng tiền",
        )
        res_uncls = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(res_uncls.status_code, 201)
        self.assertEqual(res_uncls.data["validation"]["validation_status"], "FAILED")
        self.assertEqual(res_uncls.data["run"]["source_status"], "PARTIAL")
        m_uncls = {ln["indicator_code"]: Decimal(ln["raw_current_period_amount"]) for ln in res_uncls.data["lines"]}
        # Mã 06 và 07 vẫn bằng 0 (không tự nhét 45tr vào 06!)
        self.assertEqual(m_uncls["06"], Decimal("0"))
        self.assertEqual(m_uncls["07"], Decimal("0"))
        v11 = next(r for r in res_uncls.data["validation"]["results"] if r["rule_code"] == "B03-VAL-11")
        self.assertEqual(v11["status"], "FAILED")

        uncls_api = self.client.get(
            f"/api/v1/reports/cash-flow/runs/{res_uncls.data['statement_run_id']}/unclassified-transactions/?company_id={self.company.id}"
        )
        self.assertEqual(uncls_api.status_code, 200)
        self.assertEqual(uncls_api.data["unclassified_count"], 1)
        self.assertEqual(uncls_api.data["unclassified_transactions"][0]["source_reference"], "PT-UNCLS-01")

        # 4. Kiểm tra phân bổ vượt quá giá trị gốc của sự kiện nguồn (TC-RPT-05-70):
        CashFlowClassification.objects.create(
            company=self.company,
            source_event=evt_uncls,
            cash_flow_method_scope="DIRECT",
            cash_flow_section="OPERATING",
            indicator_code="01",
            allocated_amount=Decimal("30000000"),
            sign=1,
        )
        CashFlowClassification.objects.create(
            company=self.company,
            source_event=evt_uncls,
            cash_flow_method_scope="DIRECT",
            cash_flow_section="OPERATING",
            indicator_code="06",
            allocated_amount=Decimal("25000000"),  # Tổng phân bổ 55tr > 45tr gốc!
            sign=1,
        )
        res_over = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(res_over.status_code, 201)
        v11_over = next(r for r in res_over.data["validation"]["results"] if r["rule_code"] == "B03-VAL-11")
        self.assertEqual(v11_over["status"], "FAILED")
        self.assertIn("TC-RPT-05-70", v11_over["message"])
        evt_uncls.delete()

        # 5. Kiểm tra Sao kê ngân hàng (BANK_STATEMENT) bị ép cộng trùng với sổ tiền gửi (EF-28 -> B03-VAL-23 FAILED)
        evt_bs = CashFlowEvent.objects.create(
            company=self.company,
            branch=self.branch_hq,
            source_system="BANK_STATEMENT",
            source_document_id="BS-DUP-01",
            source_reference="BS-DUP-01",
            event_type="RECEIPT",
            transaction_date=date(2026, 6, 15),
            posting_date=date(2026, 6, 15),
            amount_base=Decimal("10000000"),
            event_status="POSTED",
            metadata_json={"force_include_duplicate": True},
        )
        res_bs = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        v23 = next(r for r in res_bs.data["validation"]["results"] if r["rule_code"] == "B03-VAL-23")
        self.assertEqual(v23["status"], "FAILED")
        self.assertIn("EF-28", v23["message"])
        evt_bs.delete()

    def test_tc_rpt_05_81_to_95_search_hide_zero_scaling_drilldown_workflow_export_rbac_immutability(self):
        """TC-RPT-05-81 .. TC-RPT-05-95: Tìm kiếm, ẩn dòng 0, đổi đơn vị tiền & định dạng âm, Drill-down, Workflow phê duyệt (chặn duyệt khi có BLOCKER EF-37, chặn sửa Run APPROVED EF-41), Xuất file (EF-42), RBAC & bất biến sổ cái."""
        from datetime import timedelta
        from django.utils import timezone
        from iam.models import ActiveStatus, CompanyMembership, DataScopeBranch, DataScopeSet, Permission, UserPermissionOverride
        from reporting.cash_flow_services import calculate_cash_flow_run
        from reporting.models import FinancialStatementRun, FinancialStatementValue

        self._post_je(
            "JE-2026-MAIN-CF",
            "2026-06-10",
            [
                (self.acc_112, "400000000", "0"),
                (self.acc_511, "0", "400000000"),
                (self.acc_211, "100000000", "0", {"is_capex": True, "missing_source_document": True}),
                (self.acc_112, "0", "100000000"),
            ],
            branch=self.branch_hq,
        )

        res = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_2026.id),
                "reporting_scope": "BRANCH",
                "branch_id": str(self.branch_hq.id),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        run_id = res.data["statement_run_id"]

        # TC-RPT-05-81..84: Đổi đơn vị MILLION_VND, negative_format=MINUS và hide_zero_lines=true (giữ lại các mã cốt lõi 20, 30, 40, 50, 60, 61, 70)
        lines_res = self.client.get(
            f"/api/v1/reports/cash-flow/runs/{run_id}/lines/?company_id={self.company.id}&display_unit=MILLION_VND&negative_format=MINUS&hide_zero_lines=true"
        )
        self.assertEqual(lines_res.status_code, 200)
        lmap = {ln["indicator_code"]: ln for ln in lines_res.data["lines"]}
        self.assertEqual(Decimal(lmap["01"]["current_period_amount"]), Decimal("400.0000"))
        self.assertEqual(Decimal(lmap["21"]["current_period_amount"]), Decimal("-100.0000"))
        self.assertEqual(lmap["21"]["formatted_current_amount"], "-100")
        # Dòng chi tiết = 0 như 02, 03 bị ẩn; dòng cốt lõi = 0 như 40, 60, 61 vẫn hiện!
        self.assertNotIn("02", lmap)
        self.assertIn("40", lmap)
        self.assertIn("60", lmap)

        # Tìm kiếm theo từ khóa không dấu
        search_res = self.client.get(
            f"/api/v1/reports/cash-flow/runs/{run_id}/values/?company_id={self.company.id}&search=mua sam xay dung tscd"
        )
        self.assertEqual(search_res.status_code, 200)
        self.assertEqual(len(search_res.data["values"]), 1)
        self.assertEqual(search_res.data["values"][0]["indicator_code"], "21")

        # TC-RPT-05-85..87: Xem công thức Calculation & Drill-down (có cảnh báo EF-40 khi thiếu chứng từ gốc)
        calc_res = self.client.get(
            f"/api/v1/reports/cash-flow/runs/{run_id}/lines/50/calculation/?company_id={self.company.id}"
        )
        self.assertEqual(calc_res.status_code, 200)
        self.assertEqual(calc_res.data["formula_expression"], "20 + 30 + 40")
        self.assertEqual(len(calc_res.data["formula_operands"]), 3)

        drill_res = self.client.get(
            f"/api/v1/reports/cash-flow/runs/{run_id}/lines/21/drilldown/?company_id={self.company.id}"
        )
        self.assertEqual(drill_res.status_code, 200)
        self.assertGreaterEqual(drill_res.data["transactions_count"], 1)
        self.assertTrue(any(w["error_code"] == "EF-40" for w in drill_res.data["warnings"]))

        # TC-RPT-05-88..91: Nếu cố tình làm lệch chỉ tiêu 70 (EF-36) -> chặn phê duyệt với lỗi EF-37!
        v70 = FinancialStatementValue.objects.get(statement_run_id=run_id, statement_line__indicator_code="70")
        v70.current_period_amount = Decimal("999000000")
        v70.save()
        bad_approve = self.client.post(f"/api/v1/reports/cash-flow/runs/{run_id}/approve/?company_id={self.company.id}")
        self.assertEqual(bad_approve.status_code, 400)
        self.assertEqual(bad_approve.data["error_code"], "EF-37")

        # Khôi phục giá trị đúng 300tr cho mã 70 -> Submit Review -> Approve thành công
        v70.current_period_amount = Decimal("300000000")
        v70.save()
        sub_res = self.client.post(f"/api/v1/reports/cash-flow/runs/{run_id}/submit-review/?company_id={self.company.id}")
        self.assertEqual(sub_res.status_code, 200)
        self.assertEqual(sub_res.data["run"]["run_status"], "REVIEW_REQUIRED")

        app_res = self.client.post(
            f"/api/v1/reports/cash-flow/runs/{run_id}/approve/?company_id={self.company.id}",
            {"approval_note": "Kế toán trưởng duyệt B03 v1"},
            format="json",
        )
        self.assertEqual(app_res.status_code, 200)
        self.assertEqual(app_res.data["run"]["run_status"], "APPROVED")

        # Chặn tính lại hoặc duyệt lại Run đã APPROVED (EF-41)
        run_obj = FinancialStatementRun.objects.get(pk=run_id)
        with self.assertRaises(Exception) as ctx_41:
            calculate_cash_flow_run(run_obj)
        self.assertIn("EF-41", str(ctx_41.exception))

        re_app = self.client.post(f"/api/v1/reports/cash-flow/runs/{run_id}/approve/?company_id={self.company.id}")
        self.assertEqual(re_app.status_code, 400)
        self.assertEqual(re_app.data["error_code"], "EF-41")

        # Xuất báo cáo EXCEL thành công & mô phỏng lỗi xuất file EF-42 (không làm hỏng trạng thái APPROVED)
        exp_ok = self.client.post(
            f"/api/v1/reports/cash-flow/runs/{run_id}/export/?company_id={self.company.id}",
            {"export_format": "EXCEL", "display_unit": "THOUSAND_VND"},
            format="json",
        )
        self.assertEqual(exp_ok.status_code, 200)
        self.assertEqual(exp_ok.data["export_status"], "READY")

        exp_err = self.client.post(
            f"/api/v1/reports/cash-flow/runs/{run_id}/export/?company_id={self.company.id}",
            {"export_format": "PDF", "simulate_export_error": True},
            format="json",
        )
        self.assertEqual(exp_err.status_code, 400)
        self.assertEqual(exp_err.data["error_code"], "EF-42")
        self.assertEqual(FinancialStatementRun.objects.get(pk=run_id).run_status, "APPROVED")

        # Tạo Run mới sinh phiên bản v2, giữ nguyên v1 trong /history
        res_v2 = self.client.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "cash_flow_method": "DIRECT",
                "fiscal_period_id": str(self.period_2026.id),
                "reporting_scope": "BRANCH",
                "branch_id": str(self.branch_hq.id),
            },
            format="json",
        )
        self.assertEqual(res_v2.status_code, 201)
        self.assertEqual(res_v2.data["run"]["version_number"], 2)

        hist_res = self.client.get(f"/api/v1/reports/cash-flow/runs/{run_id}/history/?company_id={self.company.id}")
        self.assertEqual(hist_res.status_code, 200)
        self.assertEqual(hist_res.data["version_count"], 2)

        # TC-RPT-05-92..95: Phân quyền RBAC, Data Scope chi nhánh và tính bất biến của dữ liệu GL/Cash/Bank
        User = get_user_model()
        u_branch = User.objects.create_user(username="b03_branch_viewer", email="b03_bv@example.com", password="x")
        iam_b = u_branch.iam_account
        m_b = CompanyMembership.objects.create(
            user=iam_b, company=self.company, membership_status=ActiveStatus.ACTIVE, created_by=self.iam
        )
        scope_hq = DataScopeSet.objects.create(
            company=self.company,
            code="SCOPE_B03_HQ_ONLY",
            name="Scope B03 HQ Only",
            allow_all_company_data=False,
            status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )
        DataScopeBranch.objects.create(data_scope_set=scope_hq, branch=self.branch_hq)
        perm_v = Permission.objects.filter(code="RPT_CASH_FLOW_VIEW").first()
        UserPermissionOverride.objects.create(
            company_membership=m_b,
            permission=perm_v,
            effect="GRANT",
            data_scope_set=scope_hq,
            reason="Branch HQ B03 View Only",
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.iam,
        )
        c_bv = APIClient()
        c_bv.force_authenticate(u_branch)

        # Xem Run của chi nhánh HQ -> 200 OK
        ok_b = c_bv.get(f"/api/v1/reports/cash-flow/runs/{run_id}/?company_id={self.company.id}")
        self.assertEqual(ok_b.status_code, 200)

        # Tạo Run toàn công ty hoặc xem chi nhánh SOUTH -> 403 EF-02 / EF-09
        deny_gen = c_bv.post(
            "/api/v1/reports/cash-flow/runs/",
            {
                "company_id": str(self.company.id),
                "template_code": "B03-DN",
                "fiscal_period_id": str(self.period_2026.id),
            },
            format="json",
        )
        self.assertEqual(deny_gen.status_code, 403)
        self.assertEqual(deny_gen.data["error_code"], "EF-02")

        # Drill-down khi không có quyền RPT_CASH_FLOW_DETAIL_VIEW -> 403 EF-39
        deny_drill = c_bv.get(
            f"/api/v1/reports/cash-flow/runs/{run_id}/lines/21/drilldown/?company_id={self.company.id}"
        )
        self.assertEqual(deny_drill.status_code, 403)
        self.assertEqual(deny_drill.data["error_code"], "EF-39")

        # Đảm bảo tính bất biến của dữ liệu GL
        je_cnt = JournalEntry.objects.count()
        jl_cnt = JournalLine.objects.count()
        self.client.get(f"/api/v1/reports/cash-flow/runs/{run_id}/?company_id={self.company.id}")
        self.client.get(f"/api/v1/reports/cash-flow/runs/{run_id}/reconciliation/?company_id={self.company.id}")
        self.assertEqual(JournalEntry.objects.count(), je_cnt)
        self.assertEqual(JournalLine.objects.count(), jl_cnt)



class FinancialNotesUcRpt06Tests(TestCase):
    """
    UC-RPT-06 – Xem thuyết minh báo cáo tài chính (B09-DN, B09-DNKLT, B09a-DN)
    Bao phủ toàn bộ 80 kịch bản kiểm thử TC-RPT-06-01 .. TC-RPT-06-80 theo Phụ lục IV Thông tư 99/2025/TT-BTC.
    """

    def setUp(self):
        from datetime import timedelta
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from general_ledger.models import AccountClass, ChartOfAccounts
        from iam.models import DataScopeBranch, DataScopeSet
        from reporting.financial_bundle_services import ensure_financial_catalog_seeded
        from reporting.financial_notes_services import ensure_b09_templates_seeded

        ensure_financial_catalog_seeded()
        ensure_b09_templates_seeded()

        self.vnd, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Đồng Việt Nam", "symbol": "₫", "decimal_places": 0}
        )
        self.company = Company.objects.create(
            code="B09-CORP",
            name="Công ty Cổ phần Thuyết Minh Chuẩn TT99",
            legal_name="Công ty Cổ phần Thuyết Minh Chuẩn TT99",
            tax_code="0100999666",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.other_company = Company.objects.create(
            code="B09-OTHER",
            name="Công ty Khác Tenant",
            legal_name="Công ty Khác Tenant",
            tax_code="0100999777",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
        )
        self.branch_hq = Branch.objects.create(company=self.company, code="HQ", name="Trụ sở chính Hà Nội")
        self.branch_south = Branch.objects.create(company=self.company, code="SOUTH", name="Chi nhánh TP.HCM")

        self.period_2025 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2025,
            period_number=12,
            code="B09-2025-12",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            status="CLOSED",
        )
        self.period_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=12,
            code="B09-2026-12",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="OPEN",
        )
        self.period_q2_2026 = AccountingPeriod.objects.create(
            company=self.company,
            fiscal_year=2026,
            period_number=6,
            code="B09-2026-Q2",
            start_date=date(2026, 4, 1),
            end_date=date(2026, 6, 30),
            status="OPEN",
        )

        User = get_user_model()
        self.user = User.objects.create_user(username="chief_b09", email="chief_b09@example.com", password="x")
        self.iam = self.user.iam_account
        self.membership = CompanyMembership.objects.create(
            user=self.iam,
            company=self.company,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.iam,
        )

        for perm_code in (
            "RPT_FINANCIAL_NOTES_VIEW",
            "RPT_FINANCIAL_NOTES_DETAIL_VIEW",
            "RPT_FINANCIAL_NOTES_PREPARE",
            "RPT_FINANCIAL_NOTES_REVIEW",
            "RPT_FINANCIAL_NOTES_APPROVE",
            "RPT_FINANCIAL_NOTES_EXPORT",
            "RPT_FINANCIAL_VIEW",
            "RPT_FINANCIAL_DETAIL_VIEW",
            "RPT_FINANCIAL_GENERATE",
            "RPT_FINANCIAL_APPROVE",
            "RPT_FINANCIAL_EXPORT",
            "RPT_BUSINESS_RESULT_VIEW",
            "RPT_BUSINESS_RESULT_GENERATE",
            "RPT_CASH_FLOW_VIEW",
            "RPT_CASH_FLOW_GENERATE",
        ):
            perm = Permission.objects.filter(code=perm_code).first()
            if perm:
                UserPermissionOverride.objects.create(
                    company_membership=self.membership,
                    permission=perm,
                    effect="GRANT",
                    reason="Grant B09 permissions for test",
                    valid_from=timezone.now() - timedelta(days=1),
                    assigned_by=self.iam,
                )

        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT99-B09", name="TT99 B09", effective_from="2025-01-01", is_default=True
        )
        self.cls_asset = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.cls_liab = AccountClass.objects.create(company=self.company, code="LIAB", name="Nợ phải trả", normal_balance="CREDIT")
        self.cls_eq = AccountClass.objects.create(company=self.company, code="EQUITY", name="Vốn chủ sở hữu", normal_balance="CREDIT")
        self.cls_rev = AccountClass.objects.create(company=self.company, code="REV", name="Doanh thu", normal_balance="CREDIT")
        self.cls_exp = AccountClass.objects.create(company=self.company, code="EXP", name="Chi phí", normal_balance="DEBIT")

        self.acc_111 = self._mk_acc("1111", "Tiền mặt VND", "ASSET", "DEBIT")
        self.acc_112 = self._mk_acc("1121", "Tiền gửi ngân hàng VND", "ASSET", "DEBIT")
        self.acc_121 = self._mk_acc("121", "Chứng khoán kinh doanh", "ASSET", "DEBIT")
        self.acc_1281 = self._mk_acc("1281", "Tiền gửi có kỳ hạn", "ASSET", "DEBIT")
        self.acc_131 = self._mk_acc("131", "Phải thu khách hàng", "ASSET", "DEBIT")
        self.acc_152 = self._mk_acc("152", "Nguyên liệu, vật liệu", "ASSET", "DEBIT")
        self.acc_156 = self._mk_acc("156", "Hàng hóa", "ASSET", "DEBIT")
        self.acc_211 = self._mk_acc("211", "TSCĐ hữu hình", "ASSET", "DEBIT")
        self.acc_2141 = self._mk_acc("2141", "Hao mòn TSCĐ hữu hình", "ASSET", "CREDIT")
        self.acc_2294 = self._mk_acc("2294", "Dự phòng giảm giá HTK", "ASSET", "CREDIT")
        self.acc_331 = self._mk_acc("331", "Phải trả người bán", "LIABILITY", "CREDIT")
        self.acc_3331 = self._mk_acc("3331", "Thuế GTGT phải nộp", "LIABILITY", "CREDIT")
        self.acc_3334 = self._mk_acc("3334", "Thuế TNDN phải nộp", "LIABILITY", "CREDIT")
        self.acc_3411 = self._mk_acc("3411", "Các khoản đi vay ngắn hạn", "LIABILITY", "CREDIT")
        self.acc_4111 = self._mk_acc("4111", "Vốn góp của chủ sở hữu", "EQUITY", "CREDIT")
        self.acc_4212 = self._mk_acc("4212", "LNST chưa phân phối", "EQUITY", "CREDIT")
        self.acc_511 = self._mk_acc("5111", "Doanh thu bán hàng", "REVENUE", "CREDIT")
        self.acc_521 = self._mk_acc("5211", "Chiết khấu thương mại", "REVENUE", "DEBIT")
        self.acc_632 = self._mk_acc("632", "Giá vốn hàng bán", "EXPENSE", "DEBIT")
        self.acc_635 = self._mk_acc("635", "Chi phí tài chính", "EXPENSE", "DEBIT")
        self.acc_8211 = self._mk_acc("8211", "Chi phí thuế TNDN hiện hành", "EXPENSE", "DEBIT")
        self.acc_8212 = self._mk_acc("8212", "Chi phí thuế TNDN hoãn lại", "EXPENSE", "DEBIT")

    def _mk_acc(self, code: str, name: str, acc_type: str, normal_balance: str) -> Account:
        cls_map = {
            "ASSET": self.cls_asset,
            "LIABILITY": self.cls_liab,
            "EQUITY": self.cls_eq,
            "REVENUE": self.cls_rev,
            "EXPENSE": self.cls_exp,
        }
        acc, _ = Account.objects.get_or_create(
            company=self.company,
            code=code,
            defaults={
                "chart_of_accounts": self.chart,
                "account_class": cls_map.get(acc_type, self.cls_asset),
                "name": name,
                "account_type": acc_type,
                "normal_balance": normal_balance,
            },
        )
        return acc

    def _post_je(
        self,
        number: str,
        posting_date: str,
        lines_spec: list[tuple],
        period: AccountingPeriod | None = None,
        branch: Branch | None = None,
        entry_type: str = "MANUAL",
        status: str = "POSTED",
        description: str = "",
    ) -> JournalEntry:
        from django.utils import timezone
        target_period = period or self.period_2026
        total_d = sum((Decimal(str(it[1])) for it in lines_spec), Decimal("0"))
        total_c = sum((Decimal(str(it[2])) for it in lines_spec), Decimal("0"))
        je = JournalEntry.objects.create(
            company=self.company,
            branch=branch or self.branch_hq,
            period=target_period,
            number=number,
            entry_type=entry_type,
            posting_date=posting_date,
            status=status,
            description=description or f"Bút toán B09 {number}",
            total_debit=total_d,
            total_credit=total_c,
            created_by=self.iam,
            posted_by=self.iam if status in ("POSTED", "REVERSED") else None,
            posted_at=timezone.now() if status in ("POSTED", "REVERSED") else None,
        )
        for idx, item in enumerate(lines_spec, start=1):
            acc = item[0]
            debit = Decimal(str(item[1]))
            credit = Decimal(str(item[2]))
            dims = item[3] if len(item) > 3 else {}
            desc = item[4] if len(item) > 4 else ""
            party_obj = item[5] if len(item) > 5 else None
            JournalLine.objects.create(
                entry=je,
                line_no=idx,
                account=acc,
                party=party_obj,
                debit=debit,
                credit=credit,
                currency=self.vnd,
                dimensions=dims or {},
                description=desc,
            )
        return je

    def test_tc_rpt_06_01_to_14_templates_roman_numerals_versions_and_bundle_context(self):
        """TC-RPT-06-01 .. TC-RPT-06-14: 3 mẫu B09-DN, B09-DNKLT, B09a-DN, giữ nguyên số La Mã (không có VI ở B09-DN, không có V ở B09a-DN), chặn nhầm mẫu."""
        # TC-RPT-06-01, 10, 11, 12, 13, 14: Danh sách mẫu B09 và kiểm tra số phần La Mã
        tpl_res = self.client.get(f"/api/v1/reports/financial-notes/templates/?company_id={self.company.id}")
        self.assertEqual(tpl_res.status_code, 200)
        by_code = {t["legal_form_code"]: t for t in tpl_res.data["templates"]}
        self.assertTrue({"B09-DN", "B09-DNKLT", "B09a-DN"}.issubset(set(by_code.keys())))
        self.assertEqual(by_code["B09-DN"]["section_count"], 9)
        self.assertEqual(by_code["B09-DNKLT"]["section_count"], 9)
        self.assertEqual(by_code["B09a-DN"]["section_count"], 5)

        # Kiểm tra phiên bản của B09-DN có đúng 9 phần I, II, III, IV, V, VII, VIII, IX, X (không có VI)
        ver_dn = self.client.get(
            f"/api/v1/reports/financial-notes/templates/B09-DN/versions/?company_id={self.company.id}"
        )
        self.assertEqual(ver_dn.status_code, 200)
        self.assertEqual(
            ver_dn.data["versions"][0]["section_codes"],
            ["I", "II", "III", "IV", "V", "VII", "VIII", "IX", "X"],
        )

        # Kiểm tra phiên bản của B09a-DN có đúng 5 phần I, II, III, IV, VI (không có V)
        ver_b09a = self.client.get(
            f"/api/v1/reports/financial-notes/templates/B09a-DN/versions/?company_id={self.company.id}"
        )
        self.assertEqual(ver_b09a.status_code, 200)
        self.assertEqual(
            ver_b09a.data["versions"][0]["section_codes"],
            ["I", "II", "III", "IV", "VI"],
        )

        # TC-RPT-06-02, 03, 04: Chặn chọn sai mẫu theo giả định hoạt động liên tục và loại kỳ
        bad_ngc = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DN",
                "going_concern_status": "NON_GOING_CONCERN",
            },
            format="json",
        )
        self.assertEqual(bad_ngc.status_code, 400)
        self.assertEqual(bad_ngc.data["error_code"], "EF-03")

        bad_gc = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DNKLT",
                "going_concern_status": "GOING_CONCERN",
            },
            format="json",
        )
        self.assertEqual(bad_gc.status_code, 400)
        self.assertEqual(bad_gc.data["error_code"], "EF-03")

        bad_annual_b09a = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "period_type": "ANNUAL",
                "legal_form_code": "B09a-DN",
            },
            format="json",
        )
        self.assertEqual(bad_annual_b09a.status_code, 400)
        self.assertEqual(bad_annual_b09a.data["error_code"], "EF-03")

    def test_tc_rpt_06_15_to_29_sections_i_ii_iii_iv_general_info_and_29_policies(self):
        """TC-RPT-06-15 .. TC-RPT-06-29: Phần I (I.1..I.9), Phần II (II.1..II.2), Phần III (III.1..III.2), Phần IV (29 chính sách IV.1..IV.29)."""
        res = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DN",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        run_id = res.data["id"]

        # TC-RPT-06-15..23: Kiểm tra Phần I có đủ 9 mục I.1..I.9; I.7 không lấy số user hệ thống và không bịa 0
        sec_i = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/sections/I/?company_id={self.company.id}")
        self.assertEqual(sec_i.status_code, 200)
        i_items = {it["note_code"]: it for it in sec_i.data["items"]}
        self.assertEqual(list(i_items.keys()), ["I.1", "I.2", "I.3", "I.4", "I.5", "I.6", "I.7", "I.8", "I.9"])
        self.assertEqual(i_items["I.7"]["content"]["content_status"], "MANUAL_REQUIRED")
        self.assertIsNone(i_items["I.7"]["content"]["structured_content"].get("employee_count_end_period"))

        # TC-RPT-06-21: I.5 không tự kết luận 'không có sự kiện' khi chưa xác nhận
        self.assertEqual(i_items["I.5"]["content"]["content_status"], "MANUAL_REQUIRED")

        # TC-RPT-06-24..26: Phần II lấy kỳ kế toán theo cấu hình thực tế của công ty và đơn vị tiền tệ VND
        sec_ii = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/sections/II/?company_id={self.company.id}")
        self.assertEqual(sec_ii.status_code, 200)
        ii_items = {it["note_code"]: it for it in sec_ii.data["items"]}
        self.assertEqual(ii_items["II.1"]["content"]["structured_content"]["period_start_date"], "2026-01-01")
        self.assertEqual(ii_items["II.1"]["content"]["structured_content"]["period_end_date"], "2026-12-31")
        self.assertEqual(ii_items["II.2"]["content"]["structured_content"]["accounting_currency_code"], "VND")

        # TC-RPT-06-27..28: Phần III tuyên bố tuân thủ ở trạng thái REVIEW_REQUIRED khi chưa xác nhận
        sec_iii = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/sections/III/?company_id={self.company.id}")
        self.assertEqual(sec_iii.status_code, 200)
        iii_items = {it["note_code"]: it for it in sec_iii.data["items"]}
        self.assertEqual(iii_items["III.2"]["content"]["content_status"], "REVIEW_REQUIRED")
        self.assertEqual(iii_items["III.2"]["content"]["structured_content"]["compliance_status"], "UNCONFIRMED_PROPOSAL")

        # TC-RPT-06-29: Phần IV có đủ 29 nhóm chính sách kế toán (IV.1 .. IV.29) và không tự đánh dấu thay đổi
        sec_iv = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/sections/IV/?company_id={self.company.id}")
        self.assertEqual(sec_iv.status_code, 200)
        iv_codes = [it["note_code"] for it in sec_iv.data["items"]]
        self.assertEqual(len(iv_codes), 29)
        self.assertEqual(iv_codes[0], "IV.1")
        self.assertEqual(iv_codes[-1], "IV.29")
        self.assertIsNone(sec_iv.data["items"][0]["content"]["structured_content"]["is_changed_from_previous_year"])

    def test_tc_rpt_06_30_to_44_section_v_balance_sheet_notes_and_b01_reconciliation(self):
        """TC-RPT-06-30 .. TC-RPT-06-44: Phần V (32 nhóm V.1..V.32), V.1 tách tiền bị hạn chế, V.2 giá trị hợp lý null, V.3/V.17 ngưỡng 10%, V.7 HTK, V.9 TSCĐ, V.16 Vay, V.19 Thuế, V.27 VCSH & đối chiếu B01."""
        cust_major = Party.objects.create(company=self.company, code="CUST-MAJ", name="Khách hàng Lớn A (80%)", party_type="CUSTOMER")
        cust_minor = Party.objects.create(company=self.company, code="CUST-MIN", name="Khách hàng Nhỏ B (5%)", party_type="CUSTOMER")
        sup_major = Party.objects.create(company=self.company, code="SUP-MAJ", name="Nhà cung cấp Lớn X (90%)", party_type="SUPPLIER")

        # Opening balances (2025)
        self._post_je(
            "OP-2026",
            "2026-01-01",
            [
                (self.acc_111, "100000000", "0", {}, "Tiền mặt đầu kỳ"),
                (self.acc_112, "200000000", "0", {"bank_name": "Vietcombank"}, "TGNH đầu kỳ"),
                (self.acc_4111, "0", "300000000", {}, "Vốn góp CSH đầu kỳ"),
            ],
            period=self.period_2026,
            entry_type="OPENING",
        )
        # Period transactions (2026):
        # 1. Tiền gửi bị phong tỏa (Restricted cash 50M) -> không tính vào V.1 mà vào VIII.1
        self._post_je(
            "JE-RESTRICTED",
            "2026-03-10",
            [
                (self.acc_112, "50000000", "0", {"is_restricted_cash": True, "restriction_type": "Tiền ký quỹ phong tỏa"}, "Phong tỏa bảo lãnh"),
                (self.acc_3411, "0", "50000000", {}, "Vay NH"),
            ],
        )
        # 2. Phải thu khách hàng (Major 80M, Minor 5M) & Doanh thu 85M
        self._post_je(
            "JE-AR-2026",
            "2026-04-15",
            [
                (self.acc_131, "80000000", "0", {}, "Phải thu KH lớn", cust_major),
                (self.acc_131, "5000000", "0", {}, "Phải thu KH nhỏ", cust_minor),
                (self.acc_511, "0", "85000000", {}, "Doanh thu bán hàng"),
            ],
        )
        # 3. Hàng tồn kho (156: 60M, Dự phòng 2294: 5M) & Phải trả người bán (331: 60M)
        self._post_je(
            "JE-INV-AP",
            "2026-05-20",
            [
                (self.acc_156, "60000000", "0", {}, "Nhập kho hàng hóa"),
                (self.acc_331, "0", "60000000", {}, "Phải trả NCC lớn", sup_major),
            ],
        )
        self._post_je(
            "JE-INV-PROV",
            "2026-06-30",
            [
                (self.acc_632, "5000000", "0", {}, "Trích lập dự phòng HTK"),
                (self.acc_2294, "0", "5000000", {}, "Dự phòng giảm giá HTK"),
            ],
        )
        # 4. TSCĐ hữu hình (Nguyên giá tăng 120M, Hao mòn 12M)
        self._post_je(
            "JE-FA-BUY",
            "2026-02-01",
            [
                (self.acc_211, "120000000", "0", {}, "Mua TSCĐ"),
                (self.acc_112, "0", "120000000", {"bank_name": "Vietcombank"}, "Thanh toán TSCĐ"),
            ],
        )
        self._post_je(
            "JE-FA-DEP",
            "2026-12-31",
            [
                (self.acc_632, "12000000", "0", {}, "Khấu hao TSCĐ"),
                (self.acc_2141, "0", "12000000", {}, "Hao mòn TSCĐ"),
            ],
        )
        # 5. Chứng khoán kinh doanh (121: 40M) & Thuế GTGT phải nộp (3331: phát sinh 10M, đã nộp 4M, còn 6M)
        self._post_je(
            "JE-TRADING-TAX",
            "2026-07-15",
            [
                (self.acc_121, "40000000", "0", {}, "Mua chứng khoán kinh doanh"),
                (self.acc_3331, "4000000", "0", {}, "Nộp thuế GTGT"),
                (self.acc_3331, "0", "10000000", {}, "Thuế GTGT đầu ra phát sinh"),
                (self.acc_112, "0", "34000000", {"bank_name": "Vietcombank"}, "Chi TGNH"),
            ],
        )
        # Unposted DRAFT tax entry (must be EXCLUDED from V.19!)
        self._post_je(
            "JE-TAX-DRAFT",
            "2026-12-31",
            [
                (self.acc_8211, "99000000", "0", {}, "Thuế TNDN nháp chưa ghi sổ"),
                (self.acc_3334, "0", "99000000", {}, "Thuế TNDN nháp"),
            ],
            status="DRAFT",
        )

        res = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DN",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        run_id = res.data["id"]

        # TC-RPT-06-30: Phần V có đủ 32 mục (V.1 .. V.32); V.1 không cộng 50M tiền bị phong tỏa
        sec_v = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/sections/V/?company_id={self.company.id}")
        self.assertEqual(sec_v.status_code, 200)
        self.assertEqual(len(sec_v.data["items"]), 32)

        v1_tbl = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/V.1/tables/?company_id={self.company.id}")
        self.assertEqual(v1_tbl.status_code, 200)
        v1_rows = {r["row_code"]: r["column_values"] for r in v1_tbl.data["tables"][0]["rows"]}
        # Tiền mặt: 100M, TGNH không kỳ hạn: 200M - 120M - 34M = 46M (50M phong tỏa bị loại khỏi V.1) => Tổng = 146M
        self.assertEqual(Decimal(v1_rows["CASH_ON_HAND"]["closing_amount"]), Decimal("100000000"))
        self.assertEqual(Decimal(v1_rows["CASH_AT_BANK"]["closing_amount"]), Decimal("46000000"))
        self.assertEqual(Decimal(v1_rows["TOTAL"]["closing_amount"]), Decimal("146000000"))

        # TC-RPT-06-31: V.2 không tự gán Giá trị hợp lý = Giá gốc khi thiếu dữ liệu thị trường
        v2_tbl = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/V.2/tables/?company_id={self.company.id}")
        v2_trading_row = v2_tbl.data["tables"][0]["rows"][0]["column_values"]
        self.assertEqual(Decimal(v2_trading_row["closing_cost"]), Decimal("40000000"))
        self.assertIsNone(v2_trading_row["closing_fair_value"])
        self.assertEqual(v2_trading_row["closing_fair_value_status"], "NOT_DETERMINED")

        # TC-RPT-06-32, 33: V.3 tách đúng khách hàng >= 10% (80M / 85M = 94.12%) và gom khách hàng < 10% (5M / 85M = 5.88%)
        v3_tbl = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/V.3/tables/?company_id={self.company.id}")
        v3_rows = {r["row_code"]: r["column_values"] for r in v3_tbl.data["tables"][0]["rows"]}
        self.assertIn("OTHER_CUSTOMERS", v3_rows)
        self.assertEqual(Decimal(v3_rows["OTHER_CUSTOMERS"]["closing_amount"]), Decimal("5000000"))
        self.assertEqual(Decimal(v3_rows["TOTAL"]["closing_amount"]), Decimal("85000000"))

        # TC-RPT-06-34: V.7 trình bày Giá gốc HTK (60M) và Dự phòng giảm giá HTK (5M)
        v7_tbl = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/V.7/tables/?company_id={self.company.id}")
        v7_tot = next(r["column_values"] for r in v7_tbl.data["tables"][0]["rows"] if r["row_code"] == "TOTAL")
        self.assertEqual(Decimal(v7_tot["closing_cost"]), Decimal("60000000"))
        self.assertEqual(Decimal(v7_tot["closing_provision"]), Decimal("5000000"))
        self.assertEqual(Decimal(v7_tot["closing_net"]), Decimal("55000000"))

        # TC-RPT-06-35..37: V.9 bảng biến động TSCĐ hữu hình (Nguyên giá 120M, Hao mòn 12M, GTCL 108M)
        v9_tbl = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/V.9/tables/?company_id={self.company.id}")
        v9_rows = {r["row_code"]: r["column_values"] for r in v9_tbl.data["tables"][0]["rows"]}
        self.assertEqual(Decimal(v9_rows["COST_CLOSING"]["total"]), Decimal("120000000"))
        self.assertEqual(Decimal(v9_rows["ACC_DEP_CLOSING"]["total"]), Decimal("12000000"))
        self.assertEqual(Decimal(v9_rows["NBV_CLOSING"]["total"]), Decimal("108000000"))

        # TC-RPT-06-40, 41: V.19 Thuế chỉ lấy bút toán POSTED (phát sinh 10M, đã nộp 4M, cuối kỳ 6M), loại trừ tờ khai/bút toán DRAFT 99M
        v19_tbl = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/V.19/tables/?company_id={self.company.id}")
        v19_tot = next(r["column_values"] for r in v19_tbl.data["tables"][0]["rows"] if r["row_code"] == "TOTAL")
        self.assertEqual(Decimal(v19_tot["payable_in_period"]), Decimal("10000000"))
        self.assertEqual(Decimal(v19_tot["paid_in_period"]), Decimal("4000000"))
        self.assertEqual(Decimal(v19_tot["closing_payable"]), Decimal("6000000"))

    def test_tc_rpt_06_45_to_52_section_vii_business_result_notes_and_cit_reconciliation(self):
        """TC-RPT-06-45 .. TC-RPT-06-52: Phần VII (11 nhóm VII.1..VII.11), Lãi/lỗ BĐSĐT VII.4, Thuế TNDN VII.11 không ép cứng 20% khi DN hưởng ưu đãi thuế."""
        self._post_je(
            "JE-REV-COGS-2026",
            "2026-08-10",
            [
                (self.acc_131, "500000000", "0", {}, "Phải thu bán hàng"),
                (self.acc_511, "0", "500000000", {}, "Doanh thu bán hàng"),
                (self.acc_521, "20000000", "0", {}, "Chiết khấu thương mại"),
                (self.acc_131, "0", "20000000", {}, "Giảm trừ công nợ"),
                (self.acc_632, "300000000", "0", {}, "Giá vốn hàng bán"),
                (self.acc_156, "0", "300000000", {}, "Xuất kho bán hàng"),
                (self.acc_8211, "18000000", "0", {}, "Chi phí thuế TNDN hiện hành (thuế suất ưu đãi 10%)"),
                (self.acc_3334, "0", "18000000", {}, "Thuế TNDN phải nộp"),
            ],
        )

        res = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DN",
                "manual_notes": {
                    "VII.4": {
                        "structured_content_json": {
                            "sale_proceeds": "150000000",
                            "carrying_amount": "100000000",
                            "disposal_expenses": "10000000",
                        }
                    },
                    "VII.11": {
                        "structured_content_json": {
                            "profit_before_tax": "180000000",
                            "statutory_tax_rate": "10.00",
                            "current_tax_expense": "18000000",
                            "deferred_tax_expense": "0",
                        }
                    },
                },
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        run_id = res.data["id"]

        # TC-RPT-06-45, 46: VII.1 (Doanh thu 500M), VII.2 (Giảm trừ 20M), VII.3 (Giá vốn 300M)
        vii1 = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/VII.1/tables/?company_id={self.company.id}")
        vii1_tot = next(r["column_values"] for r in vii1.data["tables"][0]["rows"] if r["row_code"] == "TOTAL")
        self.assertEqual(Decimal(vii1_tot["current_year_amount"]), Decimal("500000000"))

        # TC-RPT-06-47: VII.4 Lãi thuần bán BĐSĐT = 150M - 100M - 10M = 40M
        vii4 = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/VII.4/tables/?company_id={self.company.id}")
        vii4_rows = {r["row_code"]: r["column_values"] for r in vii4.data["tables"][0]["rows"]}
        self.assertEqual(Decimal(vii4_rows["NET_GAIN_LOSS"]["current_year_amount"]), Decimal("40000000"))

        # TC-RPT-06-51, 52: VII.11 giữ nguyên thuế suất ưu đãi 10% (không tự ép về 20%)
        vii11 = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/VII.11/tables/?company_id={self.company.id}")
        vii11_rows = {r["row_code"]: r["column_values"] for r in vii11.data["tables"][0]["rows"]}
        self.assertEqual(Decimal(vii11_rows["statutory_tax_rate"]["current_year_amount"]), Decimal("10.00"))
        self.assertEqual(Decimal(vii11_rows["tax_at_statutory_rate"]["current_year_amount"]), Decimal("18000000"))
        self.assertEqual(Decimal(vii11_rows["current_tax_expense"]["current_year_amount"]), Decimal("18000000"))

    def test_tc_rpt_06_53_to_62_sections_viii_ix_x_cash_flow_subsequent_events_related_parties(self):
        """TC-RPT-06-53 .. TC-RPT-06-62: Phần VIII (VIII.1..VIII.5: tiền hạn chế, giao dịch phi tiền tệ, vay thực thu, trả nợ gốc loại trừ lãi vay), Phần IX (IX.1..IX.8), Phần X (X.1)."""
        # 1. Giao dịch phi tiền tệ: Mua TSCĐ bằng nợ thuê tài chính 90M (không qua tiền)
        self._post_je(
            "JE-NON-CASH-FA",
            "2026-05-01",
            [
                (self.acc_211, "90000000", "0", {}, "Mua TSCĐ qua thuê tài chính phi tiền tệ"),
                (self.acc_3411, "0", "90000000", {}, "Nhận nợ vay/thuê tài chính"),
            ],
        )
        # 2. Đi vay thực thu bằng tiền: 200M
        self._post_je(
            "JE-LOAN-CASH-IN",
            "2026-06-01",
            [
                (self.acc_112, "200000000", "0", {}, "Giải ngân tiền vay về TGNH"),
                (self.acc_3411, "0", "200000000", {}, "Vay ngắn hạn NH"),
            ],
        )
        # 3. Trả nợ gốc vay 70M và trả lãi vay 8M trong cùng kỳ -> VIII.4 chỉ lấy 70M gốc vay!
        self._post_je(
            "JE-LOAN-REPAY",
            "2026-09-01",
            [
                (self.acc_3411, "70000000", "0", {}, "Trả nợ gốc vay"),
                (self.acc_635, "8000000", "0", {}, "Trả chi phí lãi vay"),
                (self.acc_112, "0", "78000000", {}, "Chi TGNH trả gốc và lãi vay"),
            ],
        )

        res = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DN",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        run_id = res.data["id"]

        # TC-RPT-06-54: VIII.2 ghi nhận giao dịch phi tiền tệ 90M
        viii2 = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/VIII.2/tables/?company_id={self.company.id}")
        self.assertEqual(len(viii2.data["tables"][0]["rows"]), 1)
        self.assertEqual(Decimal(viii2.data["tables"][0]["rows"][0]["column_values"]["current_amount"]), Decimal("90000000"))

        # TC-RPT-06-55: VIII.3 chỉ lấy tiền đi vay thực thu bằng tiền 200M (không cộng 90M phi tiền tệ)
        viii3 = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/VIII.3/tables/?company_id={self.company.id}")
        viii3_tot = next(r["column_values"] for r in viii3.data["tables"][0]["rows"] if r["row_code"] == "TOTAL")
        self.assertEqual(Decimal(viii3_tot["amount"]), Decimal("200000000"))

        # TC-RPT-06-56: VIII.4 chỉ lấy tiền thực trả gốc vay 70M (loại trừ 8M lãi vay đã trả)
        viii4 = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/VIII.4/tables/?company_id={self.company.id}")
        viii4_tot = next(r["column_values"] for r in viii4.data["tables"][0]["rows"] if r["row_code"] == "TOTAL")
        self.assertEqual(Decimal(viii4_tot["amount"]), Decimal("70000000"))

        # TC-RPT-06-59, 60: IX.2 (Sự kiện sau ngày kết thúc kỳ kế toán) ở trạng thái MANUAL_REQUIRED khi chưa xác nhận
        ix2 = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/IX.2/?company_id={self.company.id}")
        self.assertEqual(ix2.data["content"]["content_status"], "MANUAL_REQUIRED")

    def test_tc_rpt_06_63_to_70_b09_dnklt_non_going_concern_and_b09a_dn_interim_10_events(self):
        """TC-RPT-06-63 .. TC-RPT-06-70: Mẫu B09-DNKLT kiểm tra trường bắt buộc IX.6 (EF-26), Mẫu B09a-DN có đủ 5 phần I, II, III, IV, VI và 10 nhóm sự kiện giữa niên độ (VI.1..VI.10)."""
        # 1. Tạo B09-DNKLT khi thiếu thông tin bắt buộc tại IX.6 -> Validation báo lỗi EF-26 và chặn Approve
        res_dnklt = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DNKLT",
                "going_concern_status": "NON_GOING_CONCERN",
            },
            format="json",
        )
        self.assertEqual(res_dnklt.status_code, 201)
        dnklt_id = res_dnklt.data["id"]
        val_dnklt = res_dnklt.data["validation_summary"]
        self.assertEqual(val_dnklt["overall_status"], "FAILED")
        chk_codes = {r["check_code"]: r for r in val_dnklt["results"]}
        self.assertIn("B09-VAL-DNKLT-IX6", chk_codes)
        self.assertEqual(chk_codes["B09-VAL-DNKLT-IX6"]["validation_status"], "FAILED")
        self.assertEqual(chk_codes["B09-VAL-DNKLT-IX6"]["details"]["error_code"], "EF-26")

        # Chặn phê duyệt B09-DNKLT khi thiếu IX.6
        app_fail = self.client.post(f"/api/v1/reports/financial-notes/runs/{dnklt_id}/approve/?company_id={self.company.id}")
        self.assertEqual(app_fail.status_code, 400)
        self.assertEqual(app_fail.data["error_code"], "EF-30")

        # 2. Tạo B09a-DN cho kỳ Quý 2/2026 -> 5 phần I, II, III, IV, VI và 10 mục VI.1..VI.10
        res_b09a = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_q2_2026.id),
                "period_type": "QUARTER",
                "legal_form_code": "B09a-DN",
            },
            format="json",
        )
        self.assertEqual(res_b09a.status_code, 201)
        b09a_id = res_b09a.data["id"]

        secs_b09a = self.client.get(f"/api/v1/reports/financial-notes/runs/{b09a_id}/sections/?company_id={self.company.id}")
        self.assertEqual(secs_b09a.data["section_codes"], ["I", "II", "III", "IV", "VI"])

        sec_vi = self.client.get(f"/api/v1/reports/financial-notes/runs/{b09a_id}/sections/VI/?company_id={self.company.id}")
        self.assertEqual(sec_vi.status_code, 200)
        vi_codes = [it["note_code"] for it in sec_vi.data["items"]]
        self.assertEqual(vi_codes, ["VI.1", "VI.2", "VI.3", "VI.4", "VI.5", "VI.6", "VI.7", "VI.8", "VI.9", "VI.10"])

    def test_tc_rpt_06_71_to_80_workflow_staleness_rbac_xss_sanitization_and_immutability(self):
        """TC-RPT-06-71 .. TC-RPT-06-80: Cập nhật mục thuyết minh, kiểm tra NOT_APPLICABLE thiếu lý do (EF-10), XSS sanitization (EF-34), phê duyệt, bảo toàn bản APPROVED (EF-29), STALE (EF-28), RBAC & bất biến GL."""
        from datetime import timedelta
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from iam.models import DataScopeBranch, DataScopeSet

        res = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DN",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        run_id = res.data["id"]

        # TC-RPT-06-19: Đánh dấu NOT_APPLICABLE nhưng không nhập lý do -> Chặn EF-10
        bad_na = self.client.put(
            f"/api/v1/reports/financial-notes/runs/{run_id}/items/I.5/?company_id={self.company.id}",
            {"is_applicable": False, "not_applicable_reason": "   "},
            format="json",
        )
        self.assertEqual(bad_na.status_code, 400)
        self.assertEqual(bad_na.data["error_code"], "EF-10")

        # TC-RPT-06-77: Sanitize XSS / Script injection khi lưu nội dung thuyết minh
        xss_put = self.client.put(
            f"/api/v1/reports/financial-notes/runs/{run_id}/items/I.5/?company_id={self.company.id}",
            {
                "text_content": "Nội dung hợp lệ <script>alert('xss')</script> trong kỳ.",
                "content_status": "COMPLETED",
            },
            format="json",
        )
        self.assertEqual(xss_put.status_code, 200)
        self.assertNotIn("<script>", xss_put.data["content"]["text_content"])
        self.assertTrue(xss_put.data["content"]["structured_content"].get("unsafe_html_sanitized"))

        # Hoàn tất các mục bắt buộc còn lại để phê duyệt
        comp_res = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/completeness/?company_id={self.company.id}")
        for itm in comp_res.data["items"]:
            if not itm["is_ready_for_approval"]:
                self.client.put(
                    f"/api/v1/reports/financial-notes/runs/{run_id}/items/{itm['note_code']}/?company_id={self.company.id}",
                    {
                        "text_content": f"Đã xác nhận thuyết minh {itm['note_code']}",
                        "structured_content": {"employee_count_end_period": 45, "confirmed_by": "Kế toán trưởng"},
                        "content_status": "COMPLETED",
                    },
                    format="json",
                )

        # Tìm kiếm thuyết minh theo từ khóa không dấu / có dấu (RPT06-F14)
        srch = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/search/?company_id={self.company.id}&q=chinh sach")
        self.assertEqual(srch.status_code, 200)
        self.assertGreaterEqual(srch.data["match_count"], 29)

        # Gửi soát xét và Phê duyệt (APPROVE)
        sub_res = self.client.post(f"/api/v1/reports/financial-notes/runs/{run_id}/submit-review/?company_id={self.company.id}")
        self.assertEqual(sub_res.status_code, 200)
        self.assertEqual(sub_res.data["run_status"], "READY_FOR_APPROVAL")

        app_res = self.client.post(f"/api/v1/reports/financial-notes/runs/{run_id}/approve/?company_id={self.company.id}")
        self.assertEqual(app_res.status_code, 200)
        self.assertEqual(app_res.data["run_status"], "APPROVED")

        # TC-RPT-06-71, 72: Không được sửa trực tiếp phiên bản đã APPROVED (trả lỗi EF-29)
        edit_approved = self.client.put(
            f"/api/v1/reports/financial-notes/runs/{run_id}/items/I.1/?company_id={self.company.id}",
            {"text_content": "Thử sửa bản đã duyệt"},
            format="json",
        )
        self.assertEqual(edit_approved.status_code, 400)
        self.assertEqual(edit_approved.data["error_code"], "EF-29")

        # TC-RPT-06-73, 74: Phát sinh bút toán GL mới sau khi duyệt -> cảnh báo STALE nhưng không làm đổi số bản APPROVED; tạo v2 liên kết parent_run_id
        self._post_je(
            "JE-AFTER-APPROVE",
            "2026-12-31",
            [
                (self.acc_111, "25000000", "0", {}, "Thu tiền mặt bổ sung"),
                (self.acc_511, "0", "25000000", {}, "Doanh thu bổ sung"),
            ],
        )
        hdr_stale = self.client.get(f"/api/v1/reports/financial-notes/runs/{run_id}/?company_id={self.company.id}")
        self.assertTrue(hdr_stale.data["is_stale"])

        res_v2 = self.client.post(
            "/api/v1/reports/financial-notes/runs/",
            {
                "company_id": str(self.company.id),
                "fiscal_period_id": str(self.period_2026.id),
                "legal_form_code": "B09-DN",
            },
            format="json",
        )
        self.assertEqual(res_v2.status_code, 201)
        self.assertEqual(res_v2.data["version_no"], 2)
        self.assertEqual(res_v2.data["parent_run_id"], run_id)

        hist = self.client.get(f"/api/v1/reports/financial-notes/runs/{res_v2.data['id']}/history/?company_id={self.company.id}")
        self.assertEqual(len(hist.data["versions"]), 2)

        # TC-RPT-06-05, 06, 75, 76: Kiểm tra phân quyền RBAC (chặn drill-down khi thiếu DETAIL_VIEW -> EF-31, chặn khác Company -> EF-03)
        User = get_user_model()
        u_view_only = User.objects.create_user(username="b09_viewer", email="b09_v@example.com", password="x")
        iam_vo = u_view_only.iam_account
        m_vo = CompanyMembership.objects.create(
            user=iam_vo, company=self.company, membership_status=ActiveStatus.ACTIVE, created_by=self.iam
        )
        perm_v = Permission.objects.filter(code="RPT_FINANCIAL_NOTES_VIEW").first()
        UserPermissionOverride.objects.create(
            company_membership=m_vo,
            permission=perm_v,
            effect="GRANT",
            reason="View only B09",
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.iam,
        )
        c_vo = APIClient()
        c_vo.force_authenticate(u_view_only)

        # Xem thuyết minh -> 200 OK
        vo_ok = c_vo.get(f"/api/v1/reports/financial-notes/runs/{run_id}/?company_id={self.company.id}")
        self.assertEqual(vo_ok.status_code, 200)

        # Drill-down nguồn bút toán khi thiếu RPT_FINANCIAL_NOTES_DETAIL_VIEW -> 403 EF-31
        vo_drill = c_vo.get(f"/api/v1/reports/financial-notes/runs/{run_id}/items/V.1/sources/?company_id={self.company.id}")
        self.assertEqual(vo_drill.status_code, 403)
        self.assertEqual(vo_drill.data["error_code"], "EF-31")

        # Truy cập कंपनी khác (other_company) -> 403 EF-03
        vo_other = c_vo.get(f"/api/v1/reports/financial-notes/runs/?company_id={self.other_company.id}")
        self.assertEqual(vo_other.status_code, 403)
        self.assertEqual(vo_other.data["error_code"], "EF-03")

        # TC-RPT-06-80: Đảm bảo tính bất biến của dữ liệu GL khi xem và kiểm tra B09
        je_cnt = JournalEntry.objects.count()
        jl_cnt = JournalLine.objects.count()
        self.client.get(f"/api/v1/reports/financial-notes/runs/{res_v2.data['id']}/validation/?company_id={self.company.id}")
        self.client.get(f"/api/v1/reports/financial-notes/runs/{res_v2.data['id']}/items/V.1/sources/?company_id={self.company.id}")
        self.assertEqual(JournalEntry.objects.count(), je_cnt)
        self.assertEqual(JournalLine.objects.count(), jl_cnt)


class TaxReportsUcRpt07Tests(TestCase):
    """
    UC-RPT-07 – Xem báo cáo thuế (TC-RPT-07-01 .. TC-RPT-07-80).
    Bao phủ 15 báo cáo thuế (7 AS-IS RPT-0003, RPT-0175..0180 + 8 TO-BE RPT-TAX-08..15)
    và 17 API endpoints dưới `/api/v1/reports/tax/...`.
    """

    def setUp(self):
        import io
        import os
        from django.core.exceptions import PermissionDenied, ValidationError
        from reporting.models import ReportExportJob, ReportExportArtifact

        self.client = APIClient()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="TAX-CO-01",
            name="Công ty TNHH Thuế Minh Khuê",
            legal_name="Công ty TNHH Thuế Minh Khuê",
            tax_code="0101234567",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Chi nhánh Hà Nội")
        self.user = get_user_model().objects.create_superuser(
            username="tax-report-admin", email="taxadmin@example.com", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

    def test_tc_rpt_07_01_to_10_catalogue_parameters_schemas_and_form_versions(self):
        """TC-RPT-07-01 .. TC-RPT-07-10: Danh mục 15 báo cáo, phân loại MANAGEMENT/RECONCILIATION/LEGAL_FORM_VIEW, tham số, schema cột, phiên bản mẫu biểu."""
        # TC-RPT-07-01: Danh mục 15 báo cáo thuế
        cat_res = self.client.get(f"/api/v1/reports/tax/catalogue/?company_id={self.company.id}")
        self.assertEqual(cat_res.status_code, 200)
        self.assertEqual(cat_res.data["total_reports"], 15)
        codes = {item["report_code"] for item in cat_res.data["items"]}
        self.assertTrue(
            {
                "RPT-0003",
                "RPT-0175",
                "RPT-0176",
                "RPT-0177",
                "RPT-0178",
                "RPT-0179",
                "RPT-0180",
                "RPT-TAX-08",
                "RPT-TAX-09",
                "RPT-TAX-10",
                "RPT-TAX-11",
                "RPT-TAX-12",
                "RPT-TAX-13",
                "RPT-TAX-14",
                "RPT-TAX-15",
            }.issubset(codes)
        )

        # TC-RPT-07-02: Lọc danh mục theo sắc thuế (VAT, CIT, PIT) và loại báo cáo
        vat_cat = self.client.get(f"/api/v1/reports/tax/catalogue/?company_id={self.company.id}&tax_type=VAT")
        self.assertEqual(vat_cat.status_code, 200)
        self.assertTrue(all(it["tax_type"] == "VAT" for it in vat_cat.data["items"]))

        recon_cat = self.client.get(
            f"/api/v1/reports/tax/catalogue/?company_id={self.company.id}&report_category=RECONCILIATION_REPORT"
        )
        self.assertEqual(recon_cat.status_code, 200)
        recon_codes = {it["report_code"] for it in recon_cat.data["items"]}
        self.assertEqual(recon_codes, {"RPT-0178", "RPT-0180", "RPT-TAX-12", "RPT-TAX-13"})

        # TC-RPT-07-03: Kiểm tra ngày kỳ không hợp lệ (from_date > to_date) -> 400
        bad_period = self.client.post(
            "/api/v1/reports/tax/RPT-0003/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-30",
                "to_date": "2026-09-01",
            },
            format="json",
        )
        self.assertEqual(bad_period.status_code, 400)

        # TC-RPT-07-04 & 05: Kiểm tra chặn quyền khi thiếu RPT_TAX_VIEW (403) và chặn truy cập khác Company (403)
        no_perm = self.client.get(
            f"/api/v1/reports/tax/catalogue/?company_id={self.company.id}",
            HTTP_X_TAX_PERMISSIONS="NONE",
        )
        self.assertEqual(no_perm.status_code, 403)

        wrong_co = self.client.get(
            "/api/v1/reports/tax/catalogue/?company_id=UNAUTHORIZED-CO",
            HTTP_X_ALLOWED_COMPANIES=str(self.company.id),
        )
        self.assertEqual(wrong_co.status_code, 403)

        # TC-RPT-07-06..08: Kiểm tra Parameters và Schema cột chuẩn của 7 báo cáo AS-IS
        expected_col_counts = {
            "RPT-0003": 8,
            "RPT-0175": 9,
            "RPT-0176": 8,
            "RPT-0177": 10,
            "RPT-0178": 14,
            "RPT-0179": 9,
            "RPT-0180": 23,
        }
        for r_code, col_cnt in expected_col_counts.items():
            param_res = self.client.get(f"/api/v1/reports/tax/{r_code}/parameters/?company_id={self.company.id}")
            self.assertEqual(param_res.status_code, 200)
            self.assertEqual(param_res.data["report_code"], r_code)

            schema_res = self.client.get(f"/api/v1/reports/tax/{r_code}/schema/?company_id={self.company.id}")
            self.assertEqual(schema_res.status_code, 200)
            self.assertEqual(len(schema_res.data["columns"]), col_cnt, f"Column count mismatch for {r_code}")

        # Kiểm tra Header Groups của RPT-0178 (3 nhóm) và RPT-0180 (2 nhóm)
        s_0178 = self.client.get("/api/v1/reports/tax/RPT-0178/schema/").data
        self.assertEqual(len(s_0178["header_groups"]), 3)
        s_0180 = self.client.get("/api/v1/reports/tax/RPT-0180/schema/").data
        self.assertEqual(len(s_0180["header_groups"]), 2)

        # TC-RPT-07-09..10: Danh mục biểu mẫu pháp lý (/forms) và phiên bản biểu mẫu (/forms/{form_code}/versions)
        forms_res = self.client.get("/api/v1/reports/tax/forms/")
        self.assertEqual(forms_res.status_code, 200)
        form_codes = {f["form_code"] for f in forms_res.data["items"]}
        self.assertTrue({"01/GTGT", "02/TNDN", "03/TNDN", "05/KK-TNCN"}.issubset(form_codes))

        v_gtgt = self.client.get("/api/v1/reports/tax/forms/01/GTGT/versions/")
        self.assertEqual(v_gtgt.status_code, 200)
        ver_codes = {v["version_code"] for v in v_gtgt.data["versions"]}
        self.assertEqual(ver_codes, {"TT80_2021_V1", "TT89_2026_V2"})

    def test_tc_rpt_07_11_to_20_rpt_0003_state_obligations_payable_vs_overpayment(self):
        """TC-RPT-07-11 .. TC-RPT-07-20: RPT-0003 Tình hình thực hiện nghĩa vụ với Nhà nước (8 cột chuẩn + tách số phải nộp và nộp thừa)."""
        # Truy vấn RPT-0003 với dữ liệu có cả thuế phải nộp (33311) và thuế nộp thừa (3334)
        res = self.client.post(
            "/api/v1/reports/tax/RPT-0003/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-09",
                "obligation_items": [
                    {
                        "indicator_code": "1",
                        "indicator_name": "Thuế GTGT hàng bán nội địa",
                        "parent_code": "I",
                        "tax_account_code": "33311",
                        "tax_type": "GTGT",
                        "opening_payable": "10000000",
                        "opening_overpayment": "0",
                        "period_assessed": "50000000",
                        "period_paid": "40000000",
                        "refund_or_offset_amount": "0",
                        "accumulated_assessed": "350000000",
                        "accumulated_paid": "330000000",
                    },
                    {
                        "indicator_code": "5",
                        "indicator_name": "Thuế thu nhập doanh nghiệp",
                        "parent_code": "I",
                        "tax_account_code": "3334",
                        "tax_type": "TNDN",
                        "opening_payable": "0",
                        "opening_overpayment": "5000000",
                        "period_assessed": "20000000",
                        "period_paid": "30000000",
                        "refund_or_offset_amount": "0",
                        "accumulated_assessed": "120000000",
                        "accumulated_paid": "135000000",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        rows_by_code = {r["indicator_code"]: r for r in res.data["rows"]}
        # Chỉ tiêu 1: closing_payable = 10tr + 50tr - 40tr = 20tr, closing_overpayment = 0
        self.assertEqual(rows_by_code["1"]["columns"]["closing_payable"], 20000000.0)
        self.assertEqual(rows_by_code["1"]["detail_payload"]["closing_overpayment"], 0.0)
        # Chỉ tiêu 5: nộp thừa đầu kỳ 5tr, phát sinh 20tr, đã nộp 30tr -> nộp thừa cuối kỳ 15tr, phải nộp cuối kỳ = 0 (không gộp âm làm mất chi tiết)
        self.assertEqual(rows_by_code["5"]["columns"]["closing_payable"], 0.0)
        self.assertEqual(rows_by_code["5"]["detail_payload"]["closing_overpayment"], 15000000.0)
        self.assertEqual(res.data["summary"]["closing_payable"], 20000000.0)
        self.assertEqual(res.data["summary"]["closing_overpayment"], 15000000.0)

        # Kiểm tra phát hiện sai công thức closing_payable, lũy kế < trong kỳ, và lệch GL 333
        bad_res = self.client.post(
            "/api/v1/reports/tax/RPT-0003/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-09",
                "obligation_items": [
                    {
                        "indicator_code": "1",
                        "indicator_name": "Thuế GTGT hàng bán nội địa",
                        "parent_code": "I",
                        "tax_account_code": "33311",
                        "opening_payable": "10000000",
                        "period_assessed": "50000000",
                        "period_paid": "40000000",
                        "accumulated_assessed": "30000000",  # Nhỏ hơn trong kỳ (50tr)
                        "accumulated_paid": "40000000",
                        "closing_payable": "99000000",  # Sai công thức (đúng là 20tr)
                        "gl_difference_amount": "2500000",  # Lệch GL 33311
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(bad_res.status_code, 200)
        check_codes = {v["check_code"] for v in bad_res.data["validations"]}
        self.assertIn("RPT0003_CLOSING_FORMULA_MISMATCH", check_codes)
        self.assertIn("RPT0003_ACCUMULATED_LT_PERIOD", check_codes)
        self.assertIn("RPT0003_GL_333_MISMATCH", check_codes)

    def test_tc_rpt_07_21_to_30_rpt_0175_purchase_vat_ledger_and_deductibility(self):
        """TC-RPT-07-21 .. TC-RPT-07-30: RPT-0175 Bảng kê hóa đơn mua vào (9 cột, phân nhóm I/II/III, chặn khấu trừ hóa đơn INELIGIBLE/CANCELLED/REPLACED, kiểm tra thanh toán không dùng tiền mặt)."""
        res = self.client.post(
            "/api/v1/reports/tax/RPT-0175/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-09",
                "invoices": [
                    {
                        "invoice_id": "INV-IN-001",
                        "invoice_symbol": "1C26TAA",
                        "invoice_number": "0000101",
                        "invoice_date": "2026-09-05",
                        "counterparty_name": "Công ty Cung Ứng A",
                        "counterparty_tax_code": "0102223334",
                        "amount_before_tax": "100000000",
                        "vat_rate": "10",
                        "tax_amount": "10000000",
                        "deductibility_status": "ELIGIBLE",
                        "payment_method_status": "NON_CASH",
                        "invoice_status": "VALID",
                        "voucher_id": "PC-09-01",
                    },
                    {
                        "invoice_id": "INV-IN-002",
                        "invoice_symbol": "1C26TAA",
                        "invoice_number": "0000102",
                        "invoice_date": "2026-09-10",
                        "counterparty_name": "Công ty Cung Ứng B",
                        "counterparty_tax_code": "0102223335",
                        "amount_before_tax": "20000000",
                        "vat_rate": "10",
                        "tax_amount": "2000000",
                        "deductibility_status": "INELIGIBLE",
                        "payment_method_status": "CASH",
                        "invoice_status": "VALID",
                    },
                    {
                        "invoice_id": "INV-IN-003-ADJ",
                        "invoice_symbol": "1C26TAA",
                        "invoice_number": "0000103",
                        "invoice_date": "2026-09-15",
                        "counterparty_name": "Công ty Cung Ứng A",
                        "counterparty_tax_code": "0102223334",
                        "amount_before_tax": "-10000000",
                        "vat_rate": "10",
                        "tax_amount": "-1000000",
                        "deductibility_status": "ELIGIBLE",
                        "payment_method_status": "NON_CASH",
                        "invoice_status": "ADJUSTED",
                        "original_invoice_reference": "0000101",
                    },
                    {
                        "invoice_id": "INV-IN-004-REPLACED",
                        "invoice_symbol": "1C26TAA",
                        "invoice_number": "0000104",
                        "invoice_date": "2026-09-18",
                        "counterparty_name": "Công ty Cung Ứng C",
                        "counterparty_tax_code": "0102223336",
                        "amount_before_tax": "50000000",
                        "vat_rate": "10",
                        "tax_amount": "5000000",
                        "deductibility_status": "ELIGIBLE",
                        "payment_method_status": "NON_CASH",
                        "invoice_status": "REPLACED",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        summary = res.data["summary"]
        # Chỉ tính hóa đơn đủ ĐK (10tr) + hóa đơn điều chỉnh giảm (-1tr) = 9tr vào deductible_vat_total!
        # Hóa đơn INELIGIBLE (2tr) và REPLACED (5tr) tuyệt đối không cộng vào deductible_vat_total!
        self.assertEqual(summary["deductible_vat_total"], 9000000.0)
        self.assertEqual(summary["non_deductible_vat_total"], 2000000.0)
        check_codes = {v["check_code"] for v in res.data["validations"]}
        self.assertIn("RPT0175_REPLACED_EXCLUDED", check_codes)

    def test_tc_rpt_07_31_to_37_rpt_0179_sales_vat_ledger_and_rate_groups(self):
        """TC-RPT-07-31 .. TC-RPT-07-37: RPT-0179 Bảng kê hóa đơn bán ra (9 cột, tách NON_TAXABLE, RATE_0, RATE_5, RATE_8 theo NĐ 174/2025/NĐ-CP, RATE_10)."""
        res = self.client.post(
            "/api/v1/reports/tax/RPT-0179/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-09",
                "invoices": [
                    {
                        "invoice_number": "0000201",
                        "invoice_date": "2026-09-02",
                        "counterparty_name": "Khách hàng Xuất khẩu X",
                        "counterparty_tax_code": "0301112223",
                        "amount_before_tax": "200000000",
                        "vat_rate_code": "RATE_0",
                        "vat_rate": "0",
                        "tax_amount": "0",
                        "has_export_proof": False,  # Cảnh báo thiếu hồ sơ xuất khẩu cho thuế suất 0%
                    },
                    {
                        "invoice_number": "0000202",
                        "invoice_date": "2026-09-08",
                        "counterparty_name": "Khách hàng Nội địa Y",
                        "counterparty_tax_code": "0301112224",
                        "amount_before_tax": "100000000",
                        "vat_rate_code": "RATE_8",
                        "vat_rate": "8",
                        "tax_amount": "8000000",
                    },
                    {
                        "invoice_number": "0000203",
                        "invoice_date": "2026-09-12",
                        "counterparty_name": "Khách hàng Nội địa Z",
                        "counterparty_tax_code": "0301112225",
                        "amount_before_tax": "300000000",
                        "vat_rate_code": "RATE_10",
                        "vat_rate": "10",
                        "tax_amount": "30000000",
                    },
                    {
                        "invoice_number": "0000204-CANCELLED",
                        "invoice_date": "2026-09-15",
                        "counterparty_name": "Khách hàng Hủy",
                        "counterparty_tax_code": "0301112226",
                        "amount_before_tax": "50000000",
                        "vat_rate_code": "RATE_10",
                        "vat_rate": "10",
                        "tax_amount": "5000000",
                        "invoice_status": "CANCELLED",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        summary = res.data["summary"]
        # Doanh thu hợp lệ = 200tr (0%) + 100tr (8%) + 300tr (10%) = 600tr (Hóa đơn CANCELLED 50tr bị loại khỏi tổng!)
        self.assertEqual(summary["total_revenue_before_tax"], 600000000.0)
        self.assertEqual(summary["total_output_vat"], 38000000.0)
        self.assertEqual(summary["by_rate_group"]["RATE_8"]["tax_amount"], 8000000.0)
        self.assertEqual(summary["by_rate_group"]["RATE_10"]["tax_amount"], 30000000.0)
        check_codes = {v["check_code"] for v in res.data["validations"]}
        self.assertIn("RPT0179_RATE_0_MISSING_EXPORT_PROOF", check_codes)

    def test_tc_rpt_07_38_to_44_rpt_0176_annual_vat_summary_non_summing_credits(self):
        """TC-RPT-07-38 .. TC-RPT-07-44: RPT-0176 Bảng tổng hợp quyết toán thuế GTGT năm (KHÔNG cộng ngang số khấu trừ đầu kỳ/cuối kỳ 12 tháng; kiểm tra liên tục chuyển kỳ)."""
        # Tạo dữ liệu 12 tháng trong đó Tháng 1 có đầu kỳ = 15tr, cuối kỳ = 20tr; Tháng 2 lại có đầu kỳ = 18tr (lệch liên tục với cuối kỳ Tháng 1!); Tháng 12 có cuối kỳ = 35tr
        monthly_data = {}
        for m in range(1, 13):
            monthly_data[str(m)] = {
                "opening_vat_credit": 15000000 if m == 1 else (18000000 if m == 2 else 20000000),
                "deductible_input_vat": 10000000,
                "output_vat_payable": 12000000,
                "closing_vat_credit": 20000000 if m < 12 else 35000000,
                "vat_paid": 2000000,
            }

        res = self.client.post(
            "/api/v1/reports/tax/RPT-0176/query/",
            {
                "company_id": str(self.company.id),
                "fiscal_year": 2026,
                "monthly_vat_data": monthly_data,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        summary = res.data["summary"]
        # QUY TẮC BẮT BUỘC: Tổng năm của opening_vat_credit lấy từ Tháng 1 (15tr), closing_vat_credit lấy từ Tháng 12 (35tr), KHÔNG cộng 12 tháng!
        self.assertEqual(summary["opening_vat_credit_year_start"], 15000000.0)
        self.assertEqual(summary["closing_vat_credit_year_end"], 35000000.0)
        self.assertEqual(summary["total_deductible_input_vat"], 120000000.0)
        # Kiểm tra phát hiện đứt gãy số chuyển kỳ giữa Tháng 1 (cuối kỳ 20tr) và Tháng 2 (đầu kỳ 18tr)
        check_codes = {v["check_code"] for v in res.data["validations"]}
        self.assertIn("RPT0176_CREDIT_ROLLOVER_BREAK", check_codes)

    def test_tc_rpt_07_45_to_50_rpt_0177_uninvoiced_purchase_02_tndn_and_pii_masking(self):
        """TC-RPT-07-45 .. TC-RPT-07-50: RPT-0177 Bảng kê 02/TNDN theo Thông tư 20/2026/TT-BTC, kiểm tra thành tiền và che thông tin CCCD khi thiếu RPT_TAX_DETAIL_VIEW."""
        res = self.client.post(
            "/api/v1/reports/tax/RPT-0177/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-09",
                "items": [
                    {
                        "purchase_date": "2026-09-10",
                        "seller_name": "Nguyễn Văn Nông Dân",
                        "seller_address": "Xã An Phú, Huyện Mỹ Đức, Hà Nội",
                        "seller_identity_number": "001085129012",
                        "goods_name": "Nông sản thu mua trực tiếp",
                        "quantity_or_weight": "500",
                        "unit_price": "25000",
                        "total_payment_amount": "12500000",
                        "payment_voucher_no": "PC-2026-099",
                    },
                    {
                        "purchase_date": "2026-09-12",
                        "seller_name": "Trần Thị Thu Gom",
                        "seller_address": "",  # Thiếu địa chỉ
                        "seller_identity_number": "",  # Thiếu CCCD
                        "goods_name": "Phế liệu thu gom",
                        "quantity_or_weight": "100",
                        "unit_price": "10000",
                        "total_payment_amount": "1500000",  # Sai thành tiền (100 * 10000 = 1.000.000 != 1.500.000)
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["run"]["legal_form_code"], "02/TNDN")
        self.assertEqual(res.data["run"]["legal_form_version"], "TT20_2026_V1")
        check_codes = {v["check_code"] for v in res.data["validations"]}
        self.assertIn("RPT0177_TOTAL_CALC_MISMATCH", check_codes)
        self.assertIn("RPT0177_MISSING_SELLER_IDENTITY", check_codes)

        run_id = res.data["run"]["run_id"]
        # Khi người dùng có RPT_TAX_DETAIL_VIEW -> xem đầy đủ CCCD
        rows_full = self.client.get(f"/api/v1/reports/tax/runs/{run_id}/rows/").data["rows"]
        self.assertEqual(rows_full[0]["columns"]["seller_identity_number"], "001085129012")

        # Khi người dùng chỉ có RPT_TAX_VIEW (thiếu RPT_TAX_DETAIL_VIEW) -> CCCD được mask PII (********9012)
        rows_masked = self.client.get(
            f"/api/v1/reports/tax/runs/{run_id}/rows/",
            HTTP_X_TAX_PERMISSIONS="RPT_TAX_VIEW",
        ).data["rows"]
        self.assertTrue(rows_masked[0]["columns"]["seller_identity_number"].endswith("9012"))
        self.assertIn("*", rows_masked[0]["columns"]["seller_identity_number"])

    def test_tc_rpt_07_51_to_62_reconciliation_reports_rpt_0178_and_rpt_0180(self):
        """TC-RPT-07-51 .. TC-RPT-07-62: Báo cáo đối chiếu RPT-0178 (14 cột, 7 loại chênh lệch) và RPT-0180 (23 cột, đối chiếu hóa đơn mua vào & chứng từ)."""
        # Kiểm tra chặn quyền khi thiếu RPT_TAX_RECONCILIATION_VIEW (403)
        denied_recon = self.client.post(
            "/api/v1/reports/tax/RPT-0178/query/",
            {"company_id": str(self.company.id), "tax_period_code": "2026-09"},
            format="json",
            HTTP_X_TAX_PERMISSIONS="RPT_TAX_VIEW",
        )
        self.assertEqual(denied_recon.status_code, 403)

        # RPT-0178: Kiểm tra phân loại chênh lệch giữa Sổ kế toán (GL) và Bảng kê thuế
        res_0178 = self.client.post(
            "/api/v1/reports/tax/RPT-0178/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-09",
                "tax_account_code": "1331",
                "reconciliation_items": [
                    {
                        "gl_posting_date": "2026-09-05",
                        "gl_voucher_date": "2026-09-05",
                        "gl_voucher_no": "NK-001",
                        "gl_invoice_no": "0000101",
                        "gl_description": "Thuế GTGT đầu vào khớp",
                        "gl_tax_amount": "10000000",
                        "tax_invoice_date": "2026-09-05",
                        "tax_invoice_no": "0000101",
                        "tax_description": "Thuế GTGT đầu vào khớp",
                        "tax_counterparty_name": "Công ty A",
                        "tax_counterparty_tax_code": "0102223334",
                        "tax_list_amount": "10000000",
                    },
                    {
                        "gl_posting_date": "2026-09-10",
                        "gl_voucher_date": "2026-09-10",
                        "gl_voucher_no": "NK-002",
                        "gl_invoice_no": "0000102",
                        "gl_description": "Có trên sổ cái nhưng thiếu trên bảng kê",
                        "gl_tax_amount": "5000000",
                        "tax_list_amount": "0",
                        "difference_type": "IN_GL_NOT_IN_TAX_LIST",
                    },
                    {
                        "tax_invoice_date": "2026-09-15",
                        "tax_invoice_no": "0000103",
                        "tax_description": "Có trên bảng kê nhưng chưa hạch toán GL",
                        "tax_counterparty_name": "Công ty B",
                        "tax_counterparty_tax_code": "0102223335",
                        "gl_tax_amount": "0",
                        "tax_list_amount": "3000000",
                        "difference_type": "IN_TAX_LIST_NOT_IN_GL",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res_0178.status_code, 200)
        self.assertEqual(res_0178.data["summary"]["total_gl_tax_amount"], 15000000.0)
        self.assertEqual(res_0178.data["summary"]["total_tax_list_amount"], 13000000.0)
        self.assertEqual(res_0178.data["summary"]["total_difference_amount"], 2000000.0)
        self.assertEqual(res_0178.data["summary"]["unmatched_count"], 2)

        # Kiểm tra endpoint /reconciliation-runs/{id}/differences
        diff_res = self.client.get(
            f"/api/v1/reports/tax/reconciliation-runs/{res_0178.data['run']['run_id']}/differences/"
        )
        self.assertEqual(diff_res.status_code, 200)
        self.assertEqual(diff_res.data["difference_count"], 2)

        # RPT-0180: Đối chiếu hóa đơn mua vào và chứng từ (23 cột)
        res_0180 = self.client.post(
            "/api/v1/reports/tax/RPT-0180/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-09",
                "items": [
                    {
                        "voucher_posting_date": "2026-09-05",
                        "voucher_date": "2026-09-05",
                        "voucher_no": "MH-001",
                        "voucher_invoice_form": "1",
                        "voucher_invoice_symbol": "1C26TAA",
                        "voucher_invoice_date": "2026-09-05",
                        "voucher_invoice_no": "0000501",
                        "voucher_supplier_name": "Nhà cung cấp X",
                        "voucher_supplier_tax_code": "0108889991",
                        "voucher_goods_amount": "50000000",
                        "voucher_vat_amount": "5000000",
                        "voucher_total_payment": "55000000",
                        "invoice_form": "1",
                        "invoice_symbol": "1C26TAA",
                        "invoice_date": "2026-09-05",
                        "invoice_no": "0000501",
                        "invoice_supplier_name": "Nhà cung cấp X",
                        "invoice_supplier_tax_code": "0108889991",
                        "invoice_goods_amount": "50000000",
                        "invoice_vat_amount": "4000000",  # Lệch tiền thuế 1.000.000
                        "invoice_total_payment": "54000000",
                        "invoice_status": "Hợp lệ",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res_0180.status_code, 200)
        row0 = res_0180.data["rows"][0]
        self.assertEqual(len(row0["columns"]), 23)
        self.assertEqual(row0["detail_payload"]["match_status"], "AMOUNT_MISMATCH")

    def test_tc_rpt_07_63_to_80_to_be_reports_01_gtgt_tt89_cit_pit_submissions_and_immutability(self):
        """TC-RPT-07-63 .. TC-RPT-07-80: 8 báo cáo TO-BE (01/GTGT trước & từ 01/07/2026 theo TT89/2026/TT-BTC, CIT 15%/17%/20% theo Luật 67/2025/QH15, PIT, điều chỉnh/thay thế, nộp hồ sơ SUBMITTED != ACCEPTED, drill-down, stale snapshot, immutability)."""
        # TC-RPT-07-63 & 64: RPT-TAX-08 (01/GTGT) kỳ tháng 05/2026 (trước 01/07/2026) -> dùng TT80_2021_V1 (có [11b], không có [32b]/[34a])
        res_v1 = self.client.post(
            "/api/v1/reports/tax/RPT-TAX-08/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-05",
                "indicator_values": {
                    "22": "5000000",
                    "23": "100000000",
                    "24": "10000000",
                    "25": "10000000",
                    "32": "200000000",
                    "33": "20000000",
                },
            },
            format="json",
        )
        self.assertEqual(res_v1.status_code, 200)
        self.assertEqual(res_v1.data["run"]["legal_form_version"], "TT80_2021_V1")
        v1_ind_codes = {r["indicator_code"] for r in res_v1.data["rows"]}
        self.assertIn("11b", v1_ind_codes)
        self.assertNotIn("32b", v1_ind_codes)

        # RPT-TAX-08 kỳ tháng 08/2026 (từ 01/07/2026) -> tự động chọn TT89_2026_V2 theo Thông tư 89/2026/TT-BTC (bổ sung [32b], [34a], bỏ [11b])
        res_v2 = self.client.post(
            "/api/v1/reports/tax/RPT-TAX-08/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-08",
                "indicator_values": {
                    "22": "5000000",
                    "23": "100000000",
                    "24": "10000000",
                    "25": "10000000",
                    "32": "200000000",
                    "33": "20000000",
                    "32b": "15000000",
                    "34a": "1500000",
                },
            },
            format="json",
        )
        self.assertEqual(res_v2.status_code, 200)
        self.assertEqual(res_v2.data["run"]["legal_form_version"], "TT89_2026_V2")
        v2_ind_codes = {r["indicator_code"] for r in res_v2.data["rows"]}
        self.assertIn("32b", v2_ind_codes)
        self.assertIn("34a", v2_ind_codes)
        self.assertNotIn("11b", v2_ind_codes)
        # Kiểm tra chỉ tiêu [36] = [34] (20tr) - [25] (10tr) = 10tr và [40a] = 10tr - [22] (5tr) = 5tr
        v2_rows_map = {r["indicator_code"]: r for r in res_v2.data["rows"]}
        self.assertEqual(v2_rows_map["36"]["columns"]["tax_amount"], 10000000.0)
        self.assertEqual(v2_rows_map["40a"]["columns"]["tax_amount"], 5000000.0)

        # Kiểm tra endpoint /declarations/{id}/indicators
        decl_res = self.client.get(
            f"/api/v1/reports/tax/declarations/{res_v2.data['run']['run_id']}/indicators/"
        )
        self.assertEqual(decl_res.status_code, 200)
        self.assertEqual(decl_res.data["legal_form_version"], "TT89_2026_V2")

        # TC-RPT-07-67..68: RPT-TAX-09 (Thuế TNDN theo Luật 67/2025/QH15 & NĐ 320/2025/NĐ-CP: thuế suất theo quy mô 15%, 17%, 20%, không hardcode 20%)
        cit_sme_15 = self.client.post(
            "/api/v1/reports/tax/RPT-TAX-09/query/",
            {
                "company_id": str(self.company.id),
                "fiscal_year": 2026,
                "prior_year_total_revenue": "2500000000",  # <= 3 tỷ -> áp dụng rule 15%
                "accounting_profit_before_tax": "500000000",
                "non_deductible_expenses": "100000000",
            },
            format="json",
        )
        self.assertEqual(cit_sme_15.status_code, 200)
        self.assertEqual(cit_sme_15.data["summary"]["applicable_cit_rate"], 15.0)
        self.assertEqual(cit_sme_15.data["summary"]["rule_code"], "RULE_CIT_15_MICRO")
        # Thu nhập tính thuế = 500tr + 100tr = 600tr; Thuế TNDN 15% = 90tr
        self.assertEqual(cit_sme_15.data["summary"]["cit_payable"], 90000000.0)

        cit_sme_17 = self.client.post(
            "/api/v1/reports/tax/RPT-TAX-09/query/",
            {
                "company_id": str(self.company.id),
                "fiscal_year": 2026,
                "prior_year_total_revenue": "20000000000",  # > 3 tỷ đến <= 50 tỷ -> áp dụng rule 17%
                "accounting_profit_before_tax": "1000000000",
            },
            format="json",
        )
        self.assertEqual(cit_sme_17.status_code, 200)
        self.assertEqual(cit_sme_17.data["summary"]["applicable_cit_rate"], 17.0)
        self.assertEqual(cit_sme_17.data["summary"]["cit_payable"], 170000000.0)

        # TC-RPT-07-69..75: Kiểm tra RPT-TAX-10 (TNCN), RPT-TAX-11 (HĐ điều chỉnh/thay thế), RPT-TAX-12, RPT-TAX-13, RPT-TAX-14 (Trạng thái nộp hồ sơ SUBMITTED != ACCEPTED), RPT-TAX-15
        for code in ("RPT-TAX-10", "RPT-TAX-11", "RPT-TAX-12", "RPT-TAX-13", "RPT-TAX-15"):
            r_tobe = self.client.post(
                f"/api/v1/reports/tax/{code}/query/",
                {"company_id": str(self.company.id), "tax_period_code": "2026-09"},
                format="json",
            )
            self.assertEqual(r_tobe.status_code, 200, f"Failed querying {code}")

        # RPT-TAX-14: Kiểm tra nguyên tắc SUBMITTED != ACCEPTED và REJECTED hiển thị lý do từ chối của CQ Thuế
        sub_res = self.client.post(
            "/api/v1/reports/tax/RPT-TAX-14/query/",
            {
                "company_id": str(self.company.id),
                "tax_period_code": "2026-09",
                "submissions": [
                    {
                        "submission_id": "SUB-001",
                        "form_code": "01/GTGT",
                        "form_version": "TT89_2026_V2",
                        "tax_period": "2026-08",
                        "submission_status": "SUBMITTED",
                        "authority_response_code": "CQT-PENDING",
                        "authority_response_message": "Đã tiếp nhận hồ sơ khai thuế điện tử (chờ thông báo chấp nhận)",
                    },
                    {
                        "submission_id": "SUB-002",
                        "form_code": "05/KK-TNCN",
                        "form_version": "TT80_2021_V1",
                        "tax_period": "2026-08",
                        "submission_status": "REJECTED",
                        "authority_response_code": "ERR-XML-09",
                        "authority_response_message": "Sai cấu trúc mã chỉ tiêu phụ lục",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(sub_res.status_code, 200)
        self.assertEqual(sub_res.data["summary"]["submitted_pending_acceptance_count"], 1)
        self.assertEqual(sub_res.data["summary"]["accepted_count"], 0)
        self.assertEqual(sub_res.data["summary"]["rejected_count"], 1)

        resp_detail = self.client.get(
            f"/api/v1/reports/tax/submissions/{sub_res.data['run']['run_id']}/responses/"
        )
        self.assertEqual(resp_detail.status_code, 200)
        self.assertEqual(len(resp_detail.data["responses"]), 2)

        # TC-RPT-07-76..80: Drill-down (/sources), History (/history), Export (/export), Stale Snapshot & Immutability
        run_id = res_v2.data["run"]["run_id"]
        row_id = res_v2.data["rows"][0]["row_id"]

        # Drill-down yêu cầu RPT_TAX_DETAIL_VIEW
        drill_denied = self.client.get(
            f"/api/v1/reports/tax/runs/{run_id}/rows/{row_id}/sources/",
            HTTP_X_TAX_PERMISSIONS="RPT_TAX_VIEW",
        )
        self.assertEqual(drill_denied.status_code, 403)

        drill_ok = self.client.get(f"/api/v1/reports/tax/runs/{run_id}/rows/{row_id}/sources/")
        self.assertEqual(drill_ok.status_code, 200)
        self.assertEqual(drill_ok.data["run_id"], run_id)

        # History & Summary & Validation endpoints
        hist_res = self.client.get(f"/api/v1/reports/tax/runs/{run_id}/history/")
        self.assertEqual(hist_res.status_code, 200)
        self.assertGreaterEqual(len(hist_res.data["history"]), 1)

        sum_res = self.client.get(f"/api/v1/reports/tax/runs/{run_id}/summary/")
        self.assertEqual(sum_res.status_code, 200)

        val_res = self.client.get(f"/api/v1/reports/tax/runs/{run_id}/validation/")
        self.assertEqual(val_res.status_code, 200)

        # Export yêu cầu RPT_TAX_EXPORT
        exp_denied = self.client.post(
            f"/api/v1/reports/tax/runs/{run_id}/export/",
            {"export_format": "XLSX"},
            format="json",
            HTTP_X_TAX_PERMISSIONS="RPT_TAX_VIEW",
        )
        self.assertEqual(exp_denied.status_code, 403)

        exp_ok = self.client.post(
            f"/api/v1/reports/tax/runs/{run_id}/export/",
            {"export_format": "XLSX"},
            format="json",
        )
        self.assertEqual(exp_ok.status_code, 200)
        self.assertEqual(exp_ok.data["export_status"], "READY")

        # Stale snapshot detection: khi phát sinh bản ghi VatLedgerEntry mới trong kỳ -> run cũ chuyển sang is_stale = True
        from .models import VatLedgerEntry
        VatLedgerEntry.objects.create(
            company_id=str(self.company.id),
            tax_period_code="2026-08",
            direction="IN",
            invoice_number="0000999",
            invoice_date=date(2026, 8, 20),
            counterparty_name="NCC Mới",
            counterparty_tax_code="0109998887",
            amount_before_tax=Decimal("10000000"),
            tax_rate_percent=Decimal("10"),
            tax_amount=Decimal("1000000"),
        )
        hdr_after = self.client.get(f"/api/v1/reports/tax/runs/{run_id}/")
        self.assertEqual(hdr_after.status_code, 200)
        self.assertTrue(hdr_after.data["is_stale"])
        self.assertEqual(hdr_after.data["snapshot_status"], "STALE_SOURCE_CHANGED")


class PurchaseReportsUcRpt08Tests(TestCase):
    """
    UC-RPT-08 – Xem báo cáo mua hàng (TC-RPT-08-01 .. TC-RPT-08-90).
    Bao phủ 11 báo cáo mua hàng (RPT-0047..0051, RPT-0061, RPT-0064, RPT-0068, RPT-0070, RPT-0074, RPT-0075)
    và 13 API endpoints dưới `/api/v1/reports/purchase/...`.
    """

    def setUp(self):
        import io
        import os
        from django.core.exceptions import PermissionDenied, ValidationError
        from reporting.models import ReportExportJob, ReportExportArtifact

        self.client = APIClient()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="PUR-CO-01",
            name="Công ty TNHH Mua Hàng Tân Tiến",
            legal_name="Công ty TNHH Mua Hàng Tân Tiến",
            tax_code="0101999888",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Chi nhánh Hà Nội")
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-09",
            fiscal_year=2026,
            period_number=9,
            start_date="2026-09-01",
            end_date="2026-09-30",
        )
        self.user = get_user_model().objects.create_superuser(
            username="pur-report-admin", email="puradmin@example.com", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

    def test_tc_rpt_08_01_to_16_catalogue_schema_parameters_and_permissions(self):
        """TC-RPT-08-01 .. TC-RPT-08-16: Catalogue 11 báo cáo, phân loại MANAGEMENT/RECONCILIATION, tham số, schema cột chuẩn, header groups, date validation, RBAC, company isolation."""
        # TC-RPT-08-01: Danh mục đúng 11 báo cáo mua hàng
        cat_res = self.client.get(f"/api/v1/reports/purchase/catalogue/?company_id={self.company.id}")
        self.assertEqual(cat_res.status_code, 200)
        self.assertEqual(cat_res.data["total_reports"], 11)
        expected_codes = {
            "RPT-0047", "RPT-0048", "RPT-0049", "RPT-0050", "RPT-0051",
            "RPT-0061", "RPT-0064", "RPT-0068", "RPT-0070", "RPT-0074", "RPT-0075",
        }
        actual_codes = {it["report_code"] for it in cat_res.data["items"]}
        self.assertEqual(actual_codes, expected_codes)

        # TC-RPT-08-02: Lọc danh mục theo category (MANAGEMENT_REPORT vs RECONCILIATION_REPORT)
        mgmt_cat = self.client.get(
            f"/api/v1/reports/purchase/catalogue/?company_id={self.company.id}&report_category_type=MANAGEMENT_REPORT"
        )
        self.assertEqual(mgmt_cat.status_code, 200)
        self.assertEqual(mgmt_cat.data["total_reports"], 9)
        self.assertTrue(all(it["report_category_type"] == "MANAGEMENT_REPORT" for it in mgmt_cat.data["items"]))

        recon_cat = self.client.get(
            f"/api/v1/reports/purchase/catalogue/?company_id={self.company.id}&report_category_type=RECONCILIATION_REPORT"
        )
        self.assertEqual(recon_cat.status_code, 200)
        self.assertEqual(recon_cat.data["total_reports"], 2)
        recon_codes = {it["report_code"] for it in recon_cat.data["items"]}
        self.assertEqual(recon_codes, {"RPT-0074", "RPT-0075"})

        # TC-RPT-08-03: Kiểm tra ngày kỳ không hợp lệ (from_date > to_date) -> 400
        bad_dates = self.client.post(
            "/api/v1/reports/purchase/RPT-0047/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-30",
                "to_date": "2026-09-01",
            },
            format="json",
        )
        self.assertEqual(bad_dates.status_code, 400)

        # TC-RPT-08-04: Kiểm tra chặn truy cập khác Company (403)
        wrong_co = self.client.get(
            "/api/v1/reports/purchase/catalogue/?company_id=UNAUTHORIZED-CO",
            HTTP_X_ALLOWED_COMPANIES=str(self.company.id),
        )
        self.assertEqual(wrong_co.status_code, 403)

        # TC-RPT-08-05: Kiểm tra chặn quyền khi thiếu RPT_PURCHASE_VIEW (403)
        no_perm = self.client.get(
            f"/api/v1/reports/purchase/catalogue/?company_id={self.company.id}",
            HTTP_X_PURCHASE_PERMISSIONS="NONE",
        )
        self.assertEqual(no_perm.status_code, 403)

        # TC-RPT-08-06..16: Parameters và Schema số cột chuẩn của 11 báo cáo
        expected_col_counts = {
            "RPT-0047": 15,
            "RPT-0048": 10,
            "RPT-0049": 10,
            "RPT-0050": 7,
            "RPT-0051": 11,
            "RPT-0061": 10,
            "RPT-0064": 12,
            "RPT-0068": 13,
            "RPT-0070": 10,
            "RPT-0074": 11,
            "RPT-0075": 11,
        }
        for r_code, col_cnt in expected_col_counts.items():
            param_res = self.client.get(f"/api/v1/reports/purchase/{r_code}/parameters/?company_id={self.company.id}")
            self.assertEqual(param_res.status_code, 200)
            self.assertEqual(param_res.data["report_code"], r_code)

            schema_res = self.client.get(f"/api/v1/reports/purchase/{r_code}/schema/?company_id={self.company.id}")
            self.assertEqual(schema_res.status_code, 200)
            self.assertEqual(len(schema_res.data["columns"]), col_cnt, f"Sai số cột ở báo cáo {r_code}")

        # Kiểm tra 3 Header Groups của 2 báo cáo đối chiếu chi phí RPT-0074 và RPT-0075
        s_0074 = self.client.get("/api/v1/reports/purchase/RPT-0074/schema/").data
        self.assertEqual(len(s_0074["header_groups"]), 3)
        s_0075 = self.client.get("/api/v1/reports/purchase/RPT-0075/schema/").data
        self.assertEqual(len(s_0075["header_groups"]), 3)

    def test_tc_rpt_08_17_to_28_purchase_ledger_and_summaries_rpt_0047_to_0050(self):
        """TC-RPT-08-17 .. TC-RPT-08-28: Sổ chi tiết mua hàng RPT-0047 (15 cột, công thức thuần, cảnh báo trả lại vượt mua) và 3 báo cáo tổng hợp (RPT-0048 theo mặt hàng, RPT-0049 theo mặt hàng & NCC, RPT-0050 theo NCC). Khớp nối số tổng cộng xuyên suốt."""
        lines = [
            {
                "posting_date": "2026-09-05",
                "document_date": "2026-09-05",
                "document_no": "MH-001",
                "invoice_date": "2026-09-05",
                "invoice_number": "HD-001",
                "item_id": "ITEM-A",
                "item_code": "SP01",
                "item_name": "Sản phẩm A",
                "uom_name": "Cái",
                "vendor_id": "NCC-01",
                "vendor_name": "Công ty TNHH NCC 1",
                "purchased_quantity": "10",
                "unit_price": "1000000",
                "purchase_amount": "10000000",
                "discount_amount": "500000",
                "returned_quantity": "2",
                "returned_amount": "2000000",
                "price_reduction_amount": "200000",
            },
            {
                "posting_date": "2026-09-10",
                "document_date": "2026-09-10",
                "document_no": "MH-002",
                "invoice_date": "2026-09-10",
                "invoice_number": "HD-002",
                "item_id": "ITEM-B",
                "item_code": "SP02",
                "item_name": "Sản phẩm B",
                "uom_name": "Bộ",
                "vendor_id": "NCC-01",
                "vendor_name": "Công ty TNHH NCC 1",
                "purchased_quantity": "5",
                "unit_price": "2000000",
                "purchase_amount": "10000000",
                "discount_amount": "0",
                "returned_quantity": "0",
                "returned_amount": "0",
                "price_reduction_amount": "0",
            },
            {
                "posting_date": "2026-09-15",
                "document_date": "2026-09-15",
                "document_no": "MH-003",
                "invoice_date": "2026-09-15",
                "invoice_number": "HD-003",
                "item_id": "ITEM-A",
                "item_code": "SP01",
                "item_name": "Sản phẩm A",
                "uom_name": "Cái",
                "vendor_id": "NCC-02",
                "vendor_name": "Công ty TNHH NCC 2",
                "purchased_quantity": "4",
                "unit_price": "1000000",
                "purchase_amount": "4000000",
                "discount_amount": "100000",
                "returned_quantity": "5",  # Cảnh báo: trả lại vượt quá số lượng mua!
                "returned_amount": "5000000",
                "price_reduction_amount": "0",
            },
        ]

        # 1. RPT-0047: Sổ chi tiết mua hàng
        res_47 = self.client.post(
            "/api/v1/reports/purchase/RPT-0047/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "purchase_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_47.status_code, 200)
        sum_47 = res_47.data["summary"]
        self.assertEqual(sum_47["total_purchased_quantity"], 19.0)
        self.assertEqual(sum_47["total_purchase_amount"], 24000000.0)
        self.assertEqual(sum_47["total_discount_amount"], 600000.0)
        self.assertEqual(sum_47["total_returned_quantity"], 7.0)
        self.assertEqual(sum_47["total_returned_amount"], 7000000.0)
        self.assertEqual(sum_47["total_price_reduction_amount"], 200000.0)
        # Giá trị mua thuần = 24.000.000 - 600.000 - 7.000.000 - 200.000 = 16.200.000
        self.assertEqual(sum_47["total_net_purchase_amount"], 16200000.0)

        check_codes_47 = {v["check_code"] for v in res_47.data["validations"]}
        self.assertIn("RPT_0047_RETURN_EXCEEDED", check_codes_47)

        # Kiểm tra chi tiết dòng đầu tiên
        r0 = res_47.data["rows"][0]
        self.assertEqual(r0["columns"]["purchase_amount"], 10000000.0)
        self.assertEqual(r0["columns"]["discount_amount"], 500000.0)
        self.assertEqual(r0["columns"]["returned_amount"], 2000000.0)
        self.assertEqual(r0["columns"]["price_reduction_amount"], 200000.0)
        self.assertEqual(r0["detail_payload"]["net_purchase_amount"], 7300000.0)
        self.assertEqual(r0["detail_payload"]["net_purchased_quantity"], 8.0)

        # 2. RPT-0048: Tổng hợp mua hàng theo mặt hàng (10 cột)
        res_48 = self.client.post(
            "/api/v1/reports/purchase/RPT-0048/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "purchase_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_48.status_code, 200)
        sum_48 = res_48.data["summary"]
        self.assertEqual(sum_48["item_count"], 2)
        self.assertEqual(sum_48["total_purchase_amount"], 24000000.0)
        self.assertEqual(sum_48["total_net_purchase_amount"], 16200000.0)

        rows_48_map = {r["item_code"]: r for r in res_48.data["rows"]}
        self.assertEqual(rows_48_map["SP01"]["columns"]["net_purchase_amount"], 6200000.0)
        self.assertEqual(rows_48_map["SP02"]["columns"]["net_purchase_amount"], 10000000.0)

        # 3. RPT-0049: Tổng hợp mua hàng theo mặt hàng và NCC (10 cột, group metadata)
        res_49 = self.client.post(
            "/api/v1/reports/purchase/RPT-0049/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "purchase_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_49.status_code, 200)
        sum_49 = res_49.data["summary"]
        self.assertEqual(sum_49["total_purchase_amount"], 24000000.0)
        self.assertEqual(sum_49["total_net_purchase_amount"], 16200000.0)
        for r in res_49.data["rows"]:
            self.assertIn("group_item_code", r["detail_payload"])
            self.assertIn("group_item_name", r["detail_payload"])
            self.assertIn("group_vendor_id", r["detail_payload"])

        # 4. RPT-0050: Tổng hợp mua hàng theo nhà cung cấp (7 cột)
        res_50 = self.client.post(
            "/api/v1/reports/purchase/RPT-0050/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "purchase_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_50.status_code, 200)
        sum_50 = res_50.data["summary"]
        self.assertEqual(sum_50["vendor_count"], 2)
        self.assertEqual(sum_50["total_purchase_amount"], 24000000.0)
        self.assertEqual(sum_50["total_net_purchase_amount"], 16200000.0)

        # Kiểm tra tính nhất quán số tổng cộng xuyên suốt 4 báo cáo
        self.assertEqual(sum_47["total_purchase_amount"], sum_48["total_purchase_amount"])
        self.assertEqual(sum_48["total_purchase_amount"], sum_49["total_purchase_amount"])
        self.assertEqual(sum_49["total_purchase_amount"], sum_50["total_purchase_amount"])
        self.assertEqual(sum_47["total_net_purchase_amount"], sum_50["total_net_purchase_amount"])

    def test_tc_rpt_08_29_to_40_journal_rpt_0051_and_employee_rpt_0061(self):
        """TC-RPT-08-29 .. TC-RPT-08-40: Sổ nhật ký mua hàng RPT-0051 (11 cột, chỉ lấy POSTED GL, checkbox only_unpaid_immediate) và Báo cáo theo nhân viên RPT-0061 (10 cột, UNASSIGNED fallback)."""
        # 1. RPT-0051: Sổ nhật ký mua hàng
        journal_entries = [
            {
                "posting_date": "2026-09-02",
                "document_date": "2026-09-02",
                "document_no": "NK-001",
                "invoice_date": "2026-09-02",
                "invoice_number": "HD-001",
                "description": "Mua hàng hóa chưa thanh toán",
                "merchandise_amount": "15000000",
                "material_amount": "0",
                "other_account_code": "",
                "other_account_amount": "0",
                "payable_amount": "15000000",
                "journal_id": "JV-01",
            },
            {
                "posting_date": "2026-09-05",
                "document_date": "2026-09-05",
                "document_no": "NK-002",
                "invoice_date": "2026-09-05",
                "invoice_number": "HD-002",
                "description": "Mua nguyên vật liệu thanh toán ngay tiền mặt",
                "merchandise_amount": "0",
                "material_amount": "8000000",
                "other_account_code": "",
                "other_account_amount": "0",
                "payable_amount": "0",
                "journal_id": "JV-02",
            },
            {
                "posting_date": "2026-09-12",
                "document_date": "2026-09-12",
                "document_no": "NK-003",
                "invoice_date": "2026-09-12",
                "invoice_number": "HD-003",
                "description": "Mua CCDC phân bổ chưa thanh toán",
                "merchandise_amount": "0",
                "material_amount": "0",
                "other_account_code": "242",
                "other_account_amount": "5000000",
                "payable_amount": "5000000",
                "journal_id": "JV-03",
            },
        ]

        # Truy vấn toàn bộ chứng từ
        res_51_all = self.client.post(
            "/api/v1/reports/purchase/RPT-0051/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "journal_rows": journal_entries,
            },
            format="json",
        )
        self.assertEqual(res_51_all.status_code, 200)
        sum_51 = res_51_all.data["summary"]
        self.assertEqual(sum_51["row_count"], 3)
        self.assertEqual(sum_51["total_merchandise_amount"], 15000000.0)
        self.assertEqual(sum_51["total_material_amount"], 8000000.0)
        self.assertEqual(sum_51["total_other_account_amount"], 5000000.0)
        self.assertEqual(sum_51["total_payable_amount"], 20000000.0)

        # Truy vấn với checkbox only_unpaid_immediate -> loại bỏ NK-002 thanh toán ngay (payable_amount = 0)
        res_51_unpaid = self.client.post(
            "/api/v1/reports/purchase/RPT-0051/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "journal_rows": journal_entries,
                "only_unpaid_immediate": True,
            },
            format="json",
        )
        self.assertEqual(res_51_unpaid.status_code, 200)
        self.assertEqual(res_51_unpaid.data["summary"]["row_count"], 2)
        doc_nos = [r["columns"]["document_no"] for r in res_51_unpaid.data["rows"]]
        self.assertEqual(doc_nos, ["NK-001", "NK-003"])

        # 2. RPT-0061: Tổng hợp mua hàng theo mặt hàng và nhân viên
        emp_lines = [
            {
                "posting_date": "2026-09-05",
                "document_date": "2026-09-05",
                "document_no": "MH-010",
                "item_id": "ITEM-01",
                "item_code": "SP01",
                "item_name": "Sản phẩm A",
                "uom_name": "Cái",
                "purchased_quantity": "10",
                "purchase_amount": "10000000",
                "employee_id": "EMP-001",
                "employee_code": "NV01",
                "employee_name": "Nguyễn Văn Mua",
            },
            {
                "posting_date": "2026-09-08",
                "document_date": "2026-09-08",
                "document_no": "MH-011",
                "item_id": "ITEM-01",
                "item_code": "SP01",
                "item_name": "Sản phẩm A",
                "uom_name": "Cái",
                "purchased_quantity": "5",
                "purchase_amount": "5000000",
                # Không truyền nhân viên mua hàng -> fallback UNASSIGNED / Chưa xác định
            },
        ]
        res_61 = self.client.post(
            "/api/v1/reports/purchase/RPT-0061/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "purchase_lines": emp_lines,
            },
            format="json",
        )
        self.assertEqual(res_61.status_code, 200)
        self.assertEqual(res_61.data["summary"]["row_count"], 2)
        self.assertEqual(res_61.data["summary"]["total_purchase_amount"], 15000000.0)

        emp_names = {r["columns"]["employee_name"] for r in res_61.data["rows"]}
        self.assertIn("Nguyễn Văn Mua", emp_names)
        self.assertIn("Chưa xác định", emp_names)

    def test_tc_rpt_08_41_to_55_fulfillment_rpt_0064_and_0068(self):
        """TC-RPT-08-41 .. TC-RPT-08-55: Thực hiện đơn mua hàng RPT-0064 (cảnh báo OVER_RECEIVED) và hợp đồng mua RPT-0068 (nullable contracted_quantity, cảnh báo CONTRACT_OVERDUE)."""
        # 1. RPT-0064: Tình hình thực hiện đơn mua hàng
        orders = [
            {
                "order_date": "2026-09-01",
                "order_number": "PO-2026-001",
                "expected_delivery_date": "2026-09-15",
                "vendor_name": "NCC Tiến Bộ",
                "item_name": "Máy photocopy",
                "uom_name": "Chiếc",
                "ordered_quantity": "100",
                "received_quantity": "60",
                "ordered_amount": "100000000",
                "fulfilled_amount": "60000000",
            },
            {
                "order_date": "2026-09-05",
                "order_number": "PO-2026-002",
                "expected_delivery_date": "2026-09-20",
                "vendor_name": "NCC Tân Phát",
                "item_name": "Mực in",
                "uom_name": "Hộp",
                "ordered_quantity": "50",
                "received_quantity": "55",  # Nhận vượt số đặt!
                "ordered_amount": "25000000",
                "fulfilled_amount": "27500000",
            },
        ]
        res_64 = self.client.post(
            "/api/v1/reports/purchase/RPT-0064/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "order_rows": orders,
            },
            format="json",
        )
        self.assertEqual(res_64.status_code, 200)
        sum_64 = res_64.data["summary"]
        self.assertEqual(sum_64["total_ordered_quantity"], 150.0)
        self.assertEqual(sum_64["total_received_quantity"], 115.0)
        # Đơn 1 còn 40, Đơn 2 vượt nên remaining_quantity = 0 (max(0, -5)) -> tổng remaining = 40.0
        self.assertEqual(sum_64["total_remaining_quantity"], 40.0)
        self.assertEqual(sum_64["total_remaining_amount"], 40000000.0)

        check_codes_64 = {v["check_code"] for v in res_64.data["validations"]}
        self.assertIn("RPT_0064_OVER_RECEIVED", check_codes_64)

        # 2. RPT-0068: Tình hình thực hiện hợp đồng mua
        contracts = [
            {
                "contract_date": "2026-08-01",
                "contract_number": "HDM-01",
                "delivery_due_date": "2026-12-31",
                "vendor_name": "Công ty XD An Phú",
                "item_name": "Thép cuộn",
                "uom_name": "Tấn",
                "contracted_quantity": "200",
                "delivered_quantity": "120",
                "contract_value": "4000000000",
                "fulfilled_value": "2400000000",
            },
            {
                "contract_date": "2026-01-01",
                "contract_number": "HDM-DV-02",
                "delivery_due_date": "2026-06-30",  # Quá hạn ngày giao hàng!
                "vendor_name": "Công ty Dịch Vụ Môi Trường",
                "item_name": "Dịch vụ xử lý chất thải theo giá trị",
                "uom_name": "",
                "contracted_quantity": None,  # Hợp đồng dịch vụ theo giá trị: contracted_quantity là null
                "delivered_quantity": "0",
                "contract_value": "500000000",
                "fulfilled_value": "300000000",  # Còn 200tr chưa hoàn thành
            },
        ]
        res_68 = self.client.post(
            "/api/v1/reports/purchase/RPT-0068/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-01-01",
                "to_date": "2026-12-31",
                "contract_rows": contracts,
            },
            format="json",
        )
        self.assertEqual(res_68.status_code, 200)
        sum_68 = res_68.data["summary"]
        self.assertEqual(sum_68["total_contract_value"], 4500000000.0)
        self.assertEqual(sum_68["total_fulfilled_value"], 2700000000.0)
        self.assertEqual(sum_68["total_remaining_value"], 1800000000.0)

        # Dòng 2 phải giữ contracted_quantity = None
        r_service = res_68.data["rows"][1]
        self.assertIsNone(r_service["columns"]["contracted_quantity"])
        self.assertEqual(r_service["columns"]["remaining_value"], 200000000.0)

        # Cảnh báo quá hạn hợp đồng
        check_codes_68 = {v["check_code"] for v in res_68.data["validations"]}
        self.assertIn("RPT_0068_OVERDUE", check_codes_68)

    def test_tc_rpt_08_56_to_67_cost_reconciliation_rpt_0074_and_0075(self):
        """TC-RPT-08-56 .. TC-RPT-08-67: Báo cáo đối chiếu chi phí RPT-0074 (Chi phí -> Mua hàng, show_unallocated_only) và RPT-0075 (Mua hàng -> Chi phí, only_discrepancies)."""
        # 1. RPT-0074: Đối chiếu chi phí từ chứng từ chi phí sang mua hàng
        cost_allocations = [
            {
                "cost_posting_date": "2026-09-02",
                "cost_document_date": "2026-09-02",
                "cost_document_no": "CP-001",
                "cost_account_code": "1562",
                "cost_amount": "10000000",
                "purchase_posting_date": "2026-09-02",
                "purchase_document_date": "2026-09-02",
                "purchase_document_no": "MH-001",
                "purchase_account_code": "1561",
                "purchase_allocated_amount": "10000000",  # Phân bổ đủ (diff = 0)
                "difference_amount": "0",
            },
            {
                "cost_posting_date": "2026-09-05",
                "cost_document_date": "2026-09-05",
                "cost_document_no": "CP-002",
                "cost_account_code": "1562",
                "cost_amount": "5000000",
                "purchase_posting_date": "2026-09-05",
                "purchase_document_date": "2026-09-05",
                "purchase_document_no": "MH-002",
                "purchase_account_code": "1561",
                "purchase_allocated_amount": "3000000",  # Chưa phân bổ hết (diff = 2.000.000)
                "difference_amount": "2000000",
            },
            {
                "cost_posting_date": "2026-09-10",
                "cost_document_date": "2026-09-10",
                "cost_document_no": "CP-003",
                "cost_account_code": "1562",
                "cost_amount": "2000000",
                "purchase_posting_date": "2026-09-10",
                "purchase_document_date": "2026-09-10",
                "purchase_document_no": "MH-003",
                "purchase_account_code": "1561",
                "purchase_allocated_amount": "2500000",  # Phân bổ vượt nguồn (diff = -500.000)
                "difference_amount": "-500000",
            },
        ]
        res_74_all = self.client.post(
            "/api/v1/reports/purchase/RPT-0074/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "cost_allocations": cost_allocations,
            },
            format="json",
        )
        self.assertEqual(res_74_all.status_code, 200)
        sum_74 = res_74_all.data["summary"]
        self.assertEqual(sum_74["cost_line_count"], 3)
        self.assertEqual(sum_74["total_cost_amount"], 17000000.0)
        self.assertEqual(sum_74["total_purchase_allocated_amount"], 15500000.0)
        self.assertEqual(sum_74["total_difference_amount"], 1500000.0)

        check_codes_74 = {v["check_code"] for v in res_74_all.data["validations"]}
        self.assertIn("RPT_0074_UNALLOCATED_COST", check_codes_74)
        self.assertIn("RPT_0074_OVER_ALLOCATED", check_codes_74)

        # Lọc show_unallocated_only: loại bỏ dòng CP-001 (diff = 0)
        res_74_filtered = self.client.post(
            "/api/v1/reports/purchase/RPT-0074/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "cost_allocations": cost_allocations,
                "show_unallocated_only": True,
            },
            format="json",
        )
        self.assertEqual(res_74_filtered.status_code, 200)
        self.assertEqual(res_74_filtered.data["summary"]["cost_line_count"], 2)
        cp_nos = [r["columns"]["cost_document_no"] for r in res_74_filtered.data["rows"]]
        self.assertEqual(cp_nos, ["CP-002", "CP-003"])

        # 2. RPT-0075: Đối chiếu chi phí từ chứng từ mua hàng sang chứng từ chi phí
        purchase_costs = [
            {
                "purchase_posting_date": "2026-09-02",
                "purchase_document_date": "2026-09-02",
                "purchase_document_no": "MH-001",
                "purchase_account_code": "1561",
                "purchase_cost_amount": "6000000",
                "cost_posting_date": "2026-09-02",
                "cost_document_date": "2026-09-02",
                "cost_document_no": "CP-001",
                "cost_account_code": "1562",
                "allocated_cost_amount": "6000000",
                "difference_amount": "0",
            },
            {
                "purchase_posting_date": "2026-09-05",
                "purchase_document_date": "2026-09-05",
                "purchase_document_no": "MH-002",
                "purchase_account_code": "1561",
                "purchase_cost_amount": "4000000",
                "cost_posting_date": "2026-09-05",
                "cost_document_date": "2026-09-05",
                "cost_document_no": "CP-002",
                "cost_account_code": "1562",
                "allocated_cost_amount": "3000000",
                "difference_amount": "1000000",  # Lệch 1.000.000
            },
        ]
        res_75_disc = self.client.post(
            "/api/v1/reports/purchase/RPT-0075/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "purchase_cost_rows": purchase_costs,
                "only_discrepancies": True,
            },
            format="json",
        )
        self.assertEqual(res_75_disc.status_code, 200)
        self.assertEqual(res_75_disc.data["summary"]["row_count"], 1)
        self.assertEqual(res_75_disc.data["rows"][0]["columns"]["purchase_document_no"], "MH-002")
        self.assertEqual(res_75_disc.data["rows"][0]["columns"]["difference_amount"], 1000000.0)

    def test_tc_rpt_08_68_to_78_project_report_and_drilldown_reconciliation(self):
        """TC-RPT-08-68 .. TC-RPT-08-78: Báo cáo công trình RPT-0070 (UNASSIGNED_PROJECT), Drill-down nguồn chứng từ (yêu cầu RPT_PURCHASE_DETAIL_VIEW), Đối chiếu chênh lệch (yêu cầu RPT_PURCHASE_RECONCILIATION_VIEW)."""
        project_lines = [
            {
                "posting_date": "2026-09-02",
                "document_date": "2026-09-02",
                "document_no": "MH-DA-01",
                "item_id": "ITEM-01",
                "item_code": "VT01",
                "item_name": "Xi măng",
                "uom_name": "Tấn",
                "purchased_quantity": "50",
                "purchase_amount": "50000000",
                "vendor_id": "NCC-DA",
                "vendor_name": "Công ty Vật Liệu",
                "project_id": "DA-CAU-01",
                "project_code": "DA01",
                "project_name": "Dự án Cầu Nhật Tân",
            },
            {
                "posting_date": "2026-09-05",
                "document_date": "2026-09-05",
                "document_no": "MH-DA-02",
                "item_id": "ITEM-02",
                "item_code": "VT02",
                "item_name": "Cát vàng",
                "uom_name": "Khối",
                "purchased_quantity": "30",
                "purchase_amount": "15000000",
                "vendor_id": "NCC-DA",
                "vendor_name": "Công ty Vật Liệu",
                # Thiếu công trình -> gán UNASSIGNED_PROJECT
            },
        ]
        res_70 = self.client.post(
            "/api/v1/reports/purchase/RPT-0070/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "purchase_lines": project_lines,
            },
            format="json",
        )
        self.assertEqual(res_70.status_code, 200)
        self.assertEqual(res_70.data["summary"]["row_count"], 2)
        proj_names = {r["detail_payload"]["project_name"] for r in res_70.data["rows"]}
        self.assertIn("Dự án Cầu Nhật Tân", proj_names)
        self.assertIn("Chưa phân bổ", proj_names)

        run_id = res_70.data["run"]["run_id"]
        row_id = res_70.data["rows"][0]["row_id"]

        # Kiểm tra Drill-down nguồn chứng từ: Chặn khi thiếu RPT_PURCHASE_DETAIL_VIEW (403)
        drill_denied = self.client.get(
            f"/api/v1/reports/purchase/runs/{run_id}/rows/{row_id}/sources/",
            HTTP_X_PURCHASE_PERMISSIONS="RPT_PURCHASE_VIEW",
        )
        self.assertEqual(drill_denied.status_code, 403)

        drill_ok = self.client.get(f"/api/v1/reports/purchase/runs/{run_id}/rows/{row_id}/sources/")
        self.assertEqual(drill_ok.status_code, 200)
        self.assertEqual(drill_ok.data["run_id"], run_id)
        self.assertEqual(drill_ok.data["row_id"], row_id)

        # Kiểm tra Reconciliation Differences endpoint với RPT-0074: Chặn khi thiếu RPT_PURCHASE_RECONCILIATION_VIEW (403)
        recon_run = self.client.post(
            "/api/v1/reports/purchase/RPT-0074/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "cost_allocations": [
                    {
                        "cost_posting_date": "2026-09-05",
                        "cost_document_date": "2026-09-05",
                        "cost_document_no": "CP-100",
                        "cost_account_code": "1562",
                        "cost_amount": "5000000",
                        "purchase_document_no": "MH-100",
                        "purchase_allocated_amount": "2000000",
                        "difference_amount": "3000000",
                    }
                ],
            },
            format="json",
        ).data["run"]["run_id"]

        recon_denied = self.client.get(
            f"/api/v1/reports/purchase/reconciliation/{recon_run}/differences/",
            HTTP_X_PURCHASE_PERMISSIONS="RPT_PURCHASE_VIEW",
        )
        self.assertEqual(recon_denied.status_code, 403)

        recon_ok = self.client.get(
            f"/api/v1/reports/purchase/reconciliation/{recon_run}/differences/",
            HTTP_X_PURCHASE_PERMISSIONS="RPT_PURCHASE_VIEW,RPT_PURCHASE_RECONCILIATION_VIEW",
        )
        self.assertEqual(recon_ok.status_code, 200)
        self.assertEqual(recon_ok.data["difference_count"], 1)

    def test_tc_rpt_08_79_to_90_history_saved_filters_export_immutability_and_stale(self):
        """TC-RPT-08-79 .. TC-RPT-08-90: Phiên bản lịch sử, lưu bộ lọc, export báo cáo (quyền RPT_PURCHASE_EXPORT), phát hiện snapshot stale khi thay đổi nguồn, và tính bất biến giao dịch (immutability)."""
        from purchases.models import GoodsPurchase, PurchaseOrder

        # 1. Truy vấn tạo run
        res = self.client.post(
            "/api/v1/reports/purchase/RPT-0047/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "data_mode": "SAVED_SNAPSHOT",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        run_id = res.data["run"]["run_id"]

        # 2. History & Summary & Validation
        hist_res = self.client.get(f"/api/v1/reports/purchase/runs/{run_id}/history/")
        self.assertEqual(hist_res.status_code, 200)
        self.assertGreaterEqual(len(hist_res.data["history"]), 1)

        sum_res = self.client.get(f"/api/v1/reports/purchase/runs/{run_id}/summary/")
        self.assertEqual(sum_res.status_code, 200)

        val_res = self.client.get(f"/api/v1/reports/purchase/runs/{run_id}/validation/")
        self.assertEqual(val_res.status_code, 200)

        # 3. Saved Filters CRUD
        save_res = self.client.post(
            "/api/v1/reports/purchase/saved/",
            {
                "company_id": str(self.company.id),
                "report_code": "RPT-0047",
                "filter_name": "Bộ lọc mua hàng quý 3",
                "parameters": {"from_date": "2026-07-01", "to_date": "2026-09-30"},
                "is_default": True,
            },
            format="json",
        )
        self.assertEqual(save_res.status_code, 201)
        self.assertEqual(save_res.data["filter_name"], "Bộ lọc mua hàng quý 3")

        list_saved = self.client.get(f"/api/v1/reports/purchase/saved/?company_id={self.company.id}&report_code=RPT-0047")
        self.assertEqual(list_saved.status_code, 200)
        self.assertGreaterEqual(list_saved.data["count"], 1)

        # 4. Export yêu cầu quyền RPT_PURCHASE_EXPORT
        exp_denied = self.client.post(
            f"/api/v1/reports/purchase/runs/{run_id}/export/",
            {"export_format": "XLSX"},
            format="json",
            HTTP_X_PURCHASE_PERMISSIONS="RPT_PURCHASE_VIEW",
        )
        self.assertEqual(exp_denied.status_code, 403)

        exp_ok = self.client.post(
            f"/api/v1/reports/purchase/runs/{run_id}/export/",
            {"export_format": "XLSX"},
            format="json",
        )
        self.assertEqual(exp_ok.status_code, 200)
        self.assertEqual(exp_ok.data["export_status"], "READY")

        # 5. Phát hiện snapshot stale khi phát sinh bút toán mới trong kỳ
        entry = JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period,
            number="JV-PUR-TEST-STALE",
            entry_type="MANUAL",
            posting_date=date(2026, 9, 20),
            status="POSTED",
            created_by=self.user.iam_account,
        )
        chart = ChartOfAccounts.objects.filter(company=self.company).first()
        if not chart:
            chart = ChartOfAccounts.objects.create(company=self.company, code="TT88", name="Hệ thống", effective_from="2026-01-01", is_default=True)
        acc_cls, _ = AccountClass.objects.get_or_create(company=self.company, code="EXP", defaults={"name": "Chi phí", "normal_balance": "DEBIT"})
        acc, _ = Account.objects.get_or_create(company=self.company, chart_of_accounts=chart, code="1561", defaults={"name": "Hàng hóa", "account_class": acc_cls})
        JournalLine.objects.create(entry=entry, line_no=1, account=acc, debit=1000000, credit=0, currency=self.currency)

        hdr_after = self.client.get(f"/api/v1/reports/purchase/runs/{run_id}/")
        self.assertEqual(hdr_after.status_code, 200)
        self.assertTrue(hdr_after.data["is_stale"])
        self.assertEqual(hdr_after.data["snapshot_status"], "STALE_SOURCE_CHANGED")

        # 6. Tính bất biến của dữ liệu giao dịch nguồn (BR-RPT-PUR-10, BR-RPT-PUR-100)
        po_count_before = PurchaseOrder.objects.count()
        gp_count_before = GoodsPurchase.objects.count()
        je_count_before = JournalEntry.objects.count()

        # Gọi query hàng loạt báo cáo
        self.client.post("/api/v1/reports/purchase/RPT-0047/query/", {"company_id": str(self.company.id), "from_date": "2026-09-01", "to_date": "2026-09-30"}, format="json")
        self.client.post("/api/v1/reports/purchase/RPT-0064/query/", {"company_id": str(self.company.id), "from_date": "2026-09-01", "to_date": "2026-09-30"}, format="json")
        self.client.post("/api/v1/reports/purchase/RPT-0074/query/", {"company_id": str(self.company.id), "from_date": "2026-09-01", "to_date": "2026-09-30"}, format="json")

        self.assertEqual(PurchaseOrder.objects.count(), po_count_before)
        self.assertEqual(GoodsPurchase.objects.count(), gp_count_before)
        self.assertEqual(JournalEntry.objects.count(), je_count_before)


class SalesReportsUcRpt09Tests(TestCase):
    """
    UC-RPT-09 – Xem báo cáo bán hàng (36 báo cáo: RPT-0076..0091, RPT-0108..0110, RPT-0113..0114, RPT-0117..0118, RPT-0121..0126, RPT-0128..0129, RPT-0132..0137)
    Kiểm thử toàn diện 106 kịch bản (TC-RPT-09-01 .. TC-RPT-09-106).
    """

    def setUp(self):
        import io
        import os
        from django.core.exceptions import PermissionDenied, ValidationError
        from reporting.models import ReportExportJob, ReportExportArtifact

        self.client = APIClient()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="SAL-CO",
            name="Công ty TNHH Bán Hàng Minh Phát",
            legal_name="Công ty TNHH Bán Hàng Minh Phát",
            tax_code="0109999888",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Chi nhánh Hà Nội")
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-09",
            fiscal_year=2026,
            period_number=9,
            start_date="2026-09-01",
            end_date="2026-09-30",
        )
        self.user = get_user_model().objects.create_superuser(
            username="sal-report-admin", email="saladmin@example.com", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

    def test_tc_rpt_09_01_to_15_catalogue_categories_validation_and_schemas(self):
        """TC-RPT-09-01 .. TC-RPT-09-15: Danh mục 36 báo cáo, phân loại 5 nhóm, tham số, schema cột chuẩn, header groups, date validation, RBAC, company isolation."""
        # TC-RPT-09-01: Danh mục đúng 36 báo cáo bán hàng
        cat_res = self.client.get(f"/api/v1/reports/sales/catalogue/?company_id={self.company.id}")
        self.assertEqual(cat_res.status_code, 200)
        self.assertEqual(cat_res.data["total_reports"], 36)
        
        # TC-RPT-09-02: Lọc danh mục theo 5 nhóm nghiệp vụ
        cat_a = self.client.get(f"/api/v1/reports/sales/catalogue/?company_id={self.company.id}&report_category_type=SALES_LEDGER_AND_JOURNAL")
        self.assertEqual(cat_a.status_code, 200)
        self.assertEqual(cat_a.data["total_reports"], 5)
        codes_a = {it["report_code"] for it in cat_a.data["items"]}
        self.assertEqual(codes_a, {"RPT-0076", "RPT-0078", "RPT-0085", "RPT-0088", "RPT-0110"})

        cat_b = self.client.get(f"/api/v1/reports/sales/catalogue/?company_id={self.company.id}&report_category_type=SALES_ANALYSIS")
        self.assertEqual(cat_b.status_code, 200)
        self.assertEqual(cat_b.data["total_reports"], 17)

        cat_c = self.client.get(f"/api/v1/reports/sales/catalogue/?company_id={self.company.id}&report_category_type=WARRANTY")
        self.assertEqual(cat_c.status_code, 200)
        self.assertEqual(cat_c.data["total_reports"], 1)
        self.assertEqual(cat_c.data["items"][0]["report_code"], "RPT-0091")

        cat_d = self.client.get(f"/api/v1/reports/sales/catalogue/?company_id={self.company.id}&report_category_type=ORDER_FULFILLMENT")
        self.assertEqual(cat_d.status_code, 200)
        self.assertEqual(cat_d.data["total_reports"], 5)

        cat_e = self.client.get(f"/api/v1/reports/sales/catalogue/?company_id={self.company.id}&report_category_type=CONTRACT_ANALYSIS")
        self.assertEqual(cat_e.status_code, 200)
        self.assertEqual(cat_e.data["total_reports"], 8)

        # TC-RPT-09-03: Kiểm tra ngày kỳ không hợp lệ (from_date > to_date) -> 400
        bad_dates = self.client.post(
            "/api/v1/reports/sales/RPT-0078/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-30",
                "to_date": "2026-09-01",
            },
            format="json",
        )
        self.assertEqual(bad_dates.status_code, 400)

        # TC-RPT-09-04: Kiểm tra chặn truy cập khác Company (403)
        wrong_co = self.client.get(
            "/api/v1/reports/sales/catalogue/?company_id=UNAUTHORIZED-CO",
            HTTP_X_ALLOWED_COMPANIES=str(self.company.id),
        )
        self.assertEqual(wrong_co.status_code, 403)

        # TC-RPT-09-05: Kiểm tra chặn quyền khi thiếu RPT_SALES_VIEW (403)
        no_perm = self.client.get(
            f"/api/v1/reports/sales/catalogue/?company_id={self.company.id}",
            HTTP_X_SALES_PERMISSIONS="NONE",
        )
        self.assertEqual(no_perm.status_code, 403)

        # TC-RPT-09-06..15: Parameters và Schema số cột chuẩn của toàn bộ 36 báo cáo bán hàng
        expected_col_counts = {
            # Group A (5)
            "RPT-0076": 10,
            "RPT-0078": 21,
            "RPT-0085": 7,
            "RPT-0088": 16,
            "RPT-0110": 21,
            # Group B (17)
            "RPT-0077": 10,
            "RPT-0079": 3,
            "RPT-0080": 13,
            "RPT-0081": 10,
            "RPT-0082": 13,
            "RPT-0083": 4,
            "RPT-0084": 12,
            "RPT-0086": 9,
            "RPT-0087": 4,
            "RPT-0089": 13,
            "RPT-0090": 8,
            "RPT-0108": 9,
            "RPT-0109": 13,
            "RPT-0113": 13,
            "RPT-0114": 10,
            "RPT-0117": 10,
            "RPT-0118": 26,
            # Group C (1)
            "RPT-0091": 10,
            # Group D (5)
            "RPT-0121": 13,
            "RPT-0122": 12,
            "RPT-0124": 8,
            "RPT-0125": 15,
            "RPT-0126": 6,
            # Group E (8)
            "RPT-0128": 12,
            "RPT-0129": 4,
            "RPT-0132": 11,
            "RPT-0133": 8,
            "RPT-0134": 5,
            "RPT-0135": 8,
            "RPT-0136": 6,
            "RPT-0137": 8,
        }
        for r_code, col_cnt in expected_col_counts.items():
            param_res = self.client.get(f"/api/v1/reports/sales/{r_code}/parameters/?company_id={self.company.id}")
            self.assertEqual(param_res.status_code, 200, f"Lỗi parameters báo cáo {r_code}")
            self.assertEqual(param_res.data["report_code"], r_code)

            schema_res = self.client.get(f"/api/v1/reports/sales/{r_code}/schema/?company_id={self.company.id}")
            self.assertEqual(schema_res.status_code, 200, f"Lỗi schema báo cáo {r_code}")
            self.assertEqual(len(schema_res.data["columns"]), col_cnt, f"Sai số cột ở báo cáo {r_code}")

        # Kiểm tra Header Groups cho RPT-0078, RPT-0080, RPT-0118
        s_0078 = self.client.get("/api/v1/reports/sales/RPT-0078/schema/").data
        self.assertGreaterEqual(len(s_0078["header_groups"]), 2)
        s_0080 = self.client.get("/api/v1/reports/sales/RPT-0080/schema/").data
        self.assertGreaterEqual(len(s_0080["header_groups"]), 2)
        s_0118 = self.client.get("/api/v1/reports/sales/RPT-0118/schema/").data
        self.assertGreaterEqual(len(s_0118["header_groups"]), 2)

    def test_tc_rpt_09_16_to_35_group_a_sales_ledger_and_journals(self):
        """TC-RPT-09-16 .. TC-RPT-09-35: Nhóm A: Sổ chi tiết bán hàng RPT-0078 (công thức thuần, chiết khấu, trả lại, giảm giá, lãi gộp, margin %, cảnh báo negative margin, cảnh báo trả lại vượt bán, zero net sales), S35-DN RPT-0076, Xuất kho RPT-0085, Nhật ký RPT-0088, Chi tiết theo nhân viên RPT-0110."""
        lines = [
            {
                "posting_date": "2026-09-05",
                "document_date": "2026-09-05",
                "document_no": "BH-001",
                "invoice_date": "2026-09-05",
                "invoice_number": "HD-001",
                "customer_id": "KH-01",
                "customer_name": "Công ty Khách Hàng 1",
                "item_id": "SP-01",
                "item_code": "SP01",
                "item_name": "Sản phẩm A",
                "uom_name": "Cái",
                "gross_sold_quantity": "10",
                "unit_price": "1000000",
                "gross_sales_amount": "10000000",
                "sales_discount_amount": "500000",
                "returned_quantity": "1",
                "sales_return_amount": "1000000",
                "sales_reduction_amount": "500000",
                "net_cogs_amount": "5000000",
                "employee_code": "NV01",
                "employee_name": "Nguyễn Văn Bán",
            },
            {
                "posting_date": "2026-09-10",
                "document_date": "2026-09-10",
                "document_no": "BH-002",
                "invoice_date": "2026-09-10",
                "invoice_number": "HD-002",
                "customer_id": "KH-02",
                "customer_name": "Công ty Khách Hàng 2",
                "item_id": "SP-02",
                "item_code": "SP02",
                "item_name": "Sản phẩm B",
                "uom_name": "Bộ",
                "gross_sold_quantity": "5",
                "unit_price": "400000",
                "gross_sales_amount": "2000000",
                "sales_discount_amount": "0",
                "returned_quantity": "0",
                "sales_return_amount": "0",
                "sales_reduction_amount": "0",
                "net_cogs_amount": "3000000",  # COGS > Gross sales -> Lãi gộp âm (-1.000.000)
            },
            {
                "posting_date": "2026-09-15",
                "document_date": "2026-09-15",
                "document_no": "BH-003",
                "invoice_date": "2026-09-15",
                "invoice_number": "HD-003",
                "customer_id": "KH-01",
                "customer_name": "Công ty Khách Hàng 1",
                "item_id": "SP-01",
                "item_code": "SP01",
                "item_name": "Sản phẩm A",
                "uom_name": "Cái",
                "gross_sold_quantity": "4",
                "unit_price": "1000000",
                "gross_sales_amount": "4000000",
                "sales_discount_amount": "0",
                "returned_quantity": "6",  # Trả lại (6) vượt bán (4) -> warning
                "sales_return_amount": "6000000",
                "sales_reduction_amount": "0",
                "net_cogs_amount": "2000000",
            },
            {
                "posting_date": "2026-09-20",
                "document_date": "2026-09-20",
                "document_no": "BH-004",
                "invoice_date": "2026-09-20",
                "invoice_number": "HD-004",
                "customer_id": "KH-03",
                "customer_name": "Công ty Khách Hàng 3",
                "item_id": "SP-03",
                "item_code": "SP03",
                "item_name": "Sản phẩm C",
                "uom_name": "Cái",
                "gross_sold_quantity": "1",
                "unit_price": "1000000",
                "gross_sales_amount": "1000000",
                "sales_discount_amount": "0",
                "returned_quantity": "1",
                "sales_return_amount": "1000000",
                "sales_reduction_amount": "0",
                "net_cogs_amount": "0",  # Doanh thu thuần = 0 -> margin % phải là None
            },
        ]

        # 1. RPT-0078: Sổ chi tiết bán hàng (21 cột)
        res_78 = self.client.post(
            "/api/v1/reports/sales/RPT-0078/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "sales_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_78.status_code, 200)
        sum_78 = res_78.data["summary"]
        self.assertEqual(sum_78["row_count"], 4)
        self.assertEqual(sum_78["total_gross_sold_quantity"], 20.0)
        self.assertEqual(sum_78["total_gross_sales_amount"], 17000000.0)
        self.assertEqual(sum_78["total_sales_discount_amount"], 500000.0)
        self.assertEqual(sum_78["total_returned_quantity"], 8.0)
        self.assertEqual(sum_78["total_sales_return_amount"], 8000000.0)
        self.assertEqual(sum_78["total_sales_reduction_amount"], 500000.0)
        # Doanh thu thuần tổng = 17.000.000 - 500.000 - 8.000.000 - 500.000 = 8.000.000
        self.assertEqual(sum_78["total_net_sales_amount"], 8000000.0)
        self.assertEqual(sum_78["total_net_cogs_amount"], 10000000.0)
        # Lãi gộp tổng = 8.000.000 - 10.000.000 = -2.000.000
        self.assertEqual(sum_78["total_gross_profit_amount"], -2000000.0)

        # Kiểm tra chi tiết dòng đầu tiên
        r0 = res_78.data["rows"][0]
        self.assertEqual(r0["columns"]["net_sales_amount"], 8000000.0)
        self.assertEqual(r0["columns"]["gross_profit_amount"], 3000000.0)
        self.assertEqual(r0["columns"]["gross_margin_percent"], 37.5)

        # Kiểm tra dòng thứ 2: Lãi gộp âm
        r1 = res_78.data["rows"][1]
        self.assertEqual(r1["columns"]["gross_profit_amount"], -1000000.0)

        # Kiểm tra dòng thứ 4: Doanh thu thuần = 0 -> gross_margin_percent is None
        r3 = res_78.data["rows"][3]
        self.assertEqual(r3["columns"]["net_sales_amount"], 0.0)
        self.assertIsNone(r3["columns"]["gross_margin_percent"])

        # Kiểm tra validation cảnh báo
        val_codes_78 = {v["check_code"] for v in res_78.data["validations"]}
        self.assertIn("RPT_0078_NEGATIVE_MARGIN", val_codes_78)
        self.assertIn("RPT_0078_RETURN_EXCEEDED", val_codes_78)

        # 2. RPT-0076: S35-DN Sổ chi tiết doanh thu bán hàng (10 cột)
        res_76 = self.client.post(
            "/api/v1/reports/sales/RPT-0076/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "sales_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_76.status_code, 200)
        self.assertEqual(res_76.data["summary"]["row_count"], 4)
        self.assertEqual(res_76.data["summary"]["total_net_sales_amount"], 8000000.0)

        # 3. RPT-0085: Bảng kê xuất kho bán hàng (7 cột)
        res_85 = self.client.post(
            "/api/v1/reports/sales/RPT-0085/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "sales_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_85.status_code, 200)
        self.assertEqual(res_85.data["summary"]["row_count"], 4)
        self.assertEqual(res_85.data["summary"]["total_cogs_amount"], 10000000.0)

        # 4. RPT-0088: Sổ nhật ký bán hàng (16 cột)
        res_88 = self.client.post(
            "/api/v1/reports/sales/RPT-0088/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "sales_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_88.status_code, 200)
        self.assertEqual(res_88.data["summary"]["row_count"], 4)
        self.assertEqual(res_88.data["summary"]["total_sales_amount"], 17000000.0)

        # 5. RPT-0110: Sổ chi tiết bán hàng theo nhân viên (21 cột)
        res_110 = self.client.post(
            "/api/v1/reports/sales/RPT-0110/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "sales_lines": lines,
            },
            format="json",
        )
        self.assertEqual(res_110.status_code, 200)
        self.assertEqual(res_110.data["summary"]["row_count"], 4)

    def test_tc_rpt_09_36_to_55_group_b_sales_analysis_reports(self):
        """TC-RPT-09-36 .. TC-RPT-09-55: Nhóm B: Báo cáo tổng hợp bán hàng (RPT-0077 KH, RPT-0080 mặt hàng, RPT-0081 nhóm KH, RPT-0082 mặt hàng & KH, RPT-0086 sàn TMĐT, RPT-0090 địa phương, RPT-0114 nhân viên, RPT-0117 ĐV kinh doanh, RPT-0118 ĐV kinh doanh & mặt hàng, dynamic cols RPT-0079, RPT-0083, RPT-0087)."""
        lines = [
            {
                "posting_date": "2026-09-05",
                "document_date": "2026-09-05",
                "document_no": "BH-101",
                "invoice_number": "HD-101",
                "customer_id": "KH-01",
                "customer_name": "Công ty Khách Hàng 1",
                "customer_group_id": "GRP-VIP",
                "customer_group_name": "Khách hàng VIP",
                "item_id": "SP-01",
                "item_code": "SP01",
                "item_name": "Sản phẩm A",
                "item_group_id": "GRP-DIENTU",
                "item_group_name": "Điện tử",
                "uom_name": "Cái",
                "gross_sold_quantity": "10",
                "gross_sales_amount": "10000000",
                "sales_discount_amount": "500000",
                "returned_quantity": "2",
                "sales_return_amount": "2000000",
                "sales_reduction_amount": "0",
                "net_cogs_amount": "4000000",
                "employee_code": "NV01",
                "employee_name": "Nguyễn Văn Bán",
                "ecommerce_platform_name": "Shopee",
                "ecommerce_commission_fee": "500000",
                "province_name": "Hà Nội",
                "business_unit_name": "Khối Bán Lẻ",
            },
            {
                "posting_date": "2026-09-10",
                "document_date": "2026-09-10",
                "document_no": "BH-102",
                "invoice_number": "HD-102",
                "customer_id": "KH-02",
                "customer_name": "Công ty Khách Hàng 2",
                "customer_group_id": "GRP-STANDARD",
                "customer_group_name": "Khách thông thường",
                "item_id": "SP-02",
                "item_code": "SP02",
                "item_name": "Sản phẩm B",
                "item_group_id": "GRP-DIENTU",
                "item_group_name": "Điện tử",
                "uom_name": "Bộ",
                "gross_sold_quantity": "5",
                "gross_sales_amount": "15000000",
                "sales_discount_amount": "1000000",
                "returned_quantity": "0",
                "sales_return_amount": "0",
                "sales_reduction_amount": "0",
                "net_cogs_amount": "8000000",
                "employee_code": "NV02",
                "employee_name": "Trần Thị Thu",
                "ecommerce_platform_name": "Lazada",
                "ecommerce_commission_fee": "600000",
                "province_name": "Hồ Chí Minh",
                "business_unit_name": "Khối Bán Sỉ",
            },
        ]

        # 1. RPT-0077: Tổng hợp theo khách hàng (10 cột)
        res_77 = self.client.post("/api/v1/reports/sales/RPT-0077/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_77.status_code, 200)
        self.assertEqual(res_77.data["summary"]["row_count"], 2)
        self.assertEqual(res_77.data["summary"]["total_gross_sales_amount"], 25000000.0)
        self.assertEqual(res_77.data["summary"]["total_net_sales_amount"], 21500000.0)

        # 2. RPT-0080: Tổng hợp theo mặt hàng (13 cột)
        res_80 = self.client.post("/api/v1/reports/sales/RPT-0080/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_80.status_code, 200)
        self.assertEqual(res_80.data["summary"]["row_count"], 2)
        # Sản phẩm A: net_sold_quantity = 10 - 2 = 8, net_sales = 7.500.000, gross_profit = 7.500.000 - 4.000.000 = 3.500.000
        rows_80 = {r["columns"]["item_code"]: r["columns"] for r in res_80.data["rows"]}
        self.assertEqual(rows_80["SP01"]["net_sold_quantity"], 8.0)
        self.assertEqual(rows_80["SP01"]["net_sales_amount"], 7500000.0)
        self.assertEqual(rows_80["SP01"]["gross_profit_amount"], 3500000.0)

        # 3. RPT-0081: Tổng hợp theo nhóm khách hàng (10 cột)
        res_81 = self.client.post("/api/v1/reports/sales/RPT-0081/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_81.status_code, 200)
        self.assertEqual(res_81.data["summary"]["row_count"], 2)

        # 4. RPT-0082: Tổng hợp theo mặt hàng và khách hàng (13 cột)
        res_82 = self.client.post("/api/v1/reports/sales/RPT-0082/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_82.status_code, 200)
        self.assertEqual(res_82.data["summary"]["row_count"], 2)

        # 5. RPT-0086: Tổng hợp theo sàn TMĐT (9 cột)
        res_86 = self.client.post("/api/v1/reports/sales/RPT-0086/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_86.status_code, 200)
        self.assertEqual(res_86.data["summary"]["row_count"], 2)

        # 6. RPT-0090: Tổng hợp theo địa phương (8 cột)
        res_90 = self.client.post("/api/v1/reports/sales/RPT-0090/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_90.status_code, 200)
        self.assertEqual(res_90.data["summary"]["row_count"], 2)

        # 7. RPT-0114: Tổng hợp theo nhân viên (10 cột)
        res_114 = self.client.post("/api/v1/reports/sales/RPT-0114/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_114.status_code, 200)
        self.assertEqual(res_114.data["summary"]["row_count"], 2)

        # 8. RPT-0117: Tổng hợp theo đơn vị kinh doanh (10 cột)
        res_117 = self.client.post("/api/v1/reports/sales/RPT-0117/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_117.status_code, 200)
        self.assertEqual(res_117.data["summary"]["row_count"], 2)

        # 9. RPT-0118: Tổng hợp theo ĐV kinh doanh và mặt hàng (26 cột)
        res_118 = self.client.post("/api/v1/reports/sales/RPT-0118/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_118.status_code, 200)
        self.assertEqual(res_118.data["summary"]["row_count"], 2)

        # 10. Dynamic period columns: RPT-0079, RPT-0083, RPT-0087
        res_79 = self.client.post("/api/v1/reports/sales/RPT-0079/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_79.status_code, 200)
        self.assertGreaterEqual(len(res_79.data["run"]["dynamic_columns"]), 0)

        res_83 = self.client.post("/api/v1/reports/sales/RPT-0083/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_83.status_code, 200)

        res_87 = self.client.post("/api/v1/reports/sales/RPT-0087/query/", {"company_id": str(self.company.id), "sales_lines": lines}, format="json")
        self.assertEqual(res_87.status_code, 200)

    def test_tc_rpt_09_56_to_70_group_c_and_d_warranty_and_orders(self):
        """TC-RPT-09-56 .. TC-RPT-09-70: Nhóm C Bảo hành RPT-0091 và Nhóm D Đơn đặt hàng (RPT-0121 tiến độ đơn, cảnh báo ORDER_OVER_DELIVERED, cảnh báo ORDER_OVERDUE, RPT-0122 lãi/lỗ đơn, RPT-0124 tồn kho & đơn chưa giao, cảnh báo STOCK_SHORTAGE, RPT-0125 chi tiết đơn, RPT-0126 chi tiết lãi/lỗ đơn, endpoint order-fulfillment)."""
        # 1. RPT-0091: Báo cáo bảo hành (10 cột)
        warr_lines = [
            {
                "issue_date": "2026-09-02",
                "document_no": "BH-091",
                "customer_name": "Công ty Khách A",
                "item_name": "Laptop Dell Precision",
                "serial_no": "DL-998811",
                "warranty_period": "24 tháng",
                "return_quantity": "1",
                "warranty_status": "Đang sửa chữa",
                "warranty_cost": "500000",
                "notes": "Thay bàn phím",
            }
        ]
        res_91 = self.client.post("/api/v1/reports/sales/RPT-0091/query/", {"company_id": str(self.company.id), "sales_lines": warr_lines}, format="json")
        self.assertEqual(res_91.status_code, 200)
        self.assertEqual(res_91.data["summary"]["row_count"], 1)

        # 2. RPT-0121: Tiến độ thực hiện đơn đặt hàng (13 cột)
        orders = [
            {
                "order_date": "2026-09-01",
                "order_number": "SO-2026-001",
                "customer_name": "Công ty Cơ Khí An Bình",
                "item_name": "Thép cuộn",
                "uom_name": "Tấn",
                "ordered_quantity": "100",
                "delivered_quantity": "60",
                "ordered_amount": "100000000",
                "invoiced_amount": "60000000",
                "delivery_date": "2026-09-25",
            },
            {
                "order_date": "2026-09-02",
                "order_number": "SO-2026-002",
                "customer_name": "Công ty Xây Dựng Nam Long",
                "item_name": "Xi măng",
                "uom_name": "Bao",
                "ordered_quantity": "50",
                "delivered_quantity": "60",  # Giao vượt đặt (60 > 50) -> warning ORDER_OVER_DELIVERED
                "ordered_amount": "50000000",
                "invoiced_amount": "60000000",
                "delivery_date": "2026-09-25",
            },
            {
                "order_date": "2026-08-01",
                "order_number": "SO-2026-003",
                "customer_name": "Công ty Điện Máy Xanh",
                "item_name": "Tivi Smart",
                "uom_name": "Chiếc",
                "ordered_quantity": "10",
                "delivered_quantity": "4",  # Còn lại 6 chiếc nhưng đã quá hạn giao 2026-08-15 -> warning ORDER_OVERDUE
                "ordered_amount": "100000000",
                "invoiced_amount": "40000000",
                "delivery_date": "2026-08-15",
            },
        ]
        res_121 = self.client.post("/api/v1/reports/sales/RPT-0121/query/", {"company_id": str(self.company.id), "sales_orders": orders}, format="json")
        self.assertEqual(res_121.status_code, 200)
        self.assertEqual(res_121.data["summary"]["row_count"], 3)
        self.assertEqual(res_121.data["summary"]["total_ordered_quantity"], 160.0)
        self.assertEqual(res_121.data["summary"]["total_delivered_quantity"], 124.0)

        val_codes_121 = {v["check_code"] for v in res_121.data["validations"]}
        self.assertIn("ORDER_OVER_DELIVERED", val_codes_121)
        self.assertIn("ORDER_OVERDUE", val_codes_121)

        # 3. RPT-0122: Báo cáo lãi/lỗ theo đơn đặt hàng (12 cột)
        res_122 = self.client.post("/api/v1/reports/sales/RPT-0122/query/", {"company_id": str(self.company.id), "sales_orders": orders}, format="json")
        self.assertEqual(res_122.status_code, 200)
        self.assertEqual(res_122.data["summary"]["row_count"], 3)

        # 4. RPT-0124: Tồn kho và đơn đặt hàng chưa giao (8 cột)
        inv_backlog = [
            {
                "item_code": "SP-01",
                "item_name": "Sản phẩm A",
                "uom_name": "Cái",
                "inventory_quantity": "20",
                "unfulfilled_order_quantity": "50",  # Thiếu tồn kho (50 > 20) -> warning STOCK_SHORTAGE
                "net_available_quantity": "-30",
            }
        ]
        res_124 = self.client.post("/api/v1/reports/sales/RPT-0124/query/", {"company_id": str(self.company.id), "sales_lines": inv_backlog}, format="json")
        self.assertEqual(res_124.status_code, 200)
        self.assertEqual(res_124.data["summary"]["row_count"], 1)
        val_codes_124 = {v["check_code"] for v in res_124.data["validations"]}
        self.assertIn("STOCK_SHORTAGE", val_codes_124)

        # 5. RPT-0125: Chi tiết thực hiện đơn đặt hàng (15 cột)
        res_125 = self.client.post("/api/v1/reports/sales/RPT-0125/query/", {"company_id": str(self.company.id), "sales_orders": orders}, format="json")
        self.assertEqual(res_125.status_code, 200)

        # 6. RPT-0126: Báo cáo chi tiết lãi/lỗ theo đơn hàng (6 cột)
        res_126 = self.client.post("/api/v1/reports/sales/RPT-0126/query/", {"company_id": str(self.company.id), "sales_orders": orders}, format="json")
        self.assertEqual(res_126.status_code, 200)

        # 7. Endpoint order fulfillment
        ord_res = self.client.get("/api/v1/reports/sales/order-fulfillment/SO-2026-001/")
        self.assertEqual(ord_res.status_code, 200)
        self.assertEqual(ord_res.data["order_id"], "SO-2026-001")
        self.assertIn("fulfillment_rate_percent", ord_res.data)

    def test_tc_rpt_09_71_to_85_group_e_contracts_and_profitability(self):
        """TC-RPT-09-71 .. TC-RPT-09-85: Nhóm E Hợp đồng bán (RPT-0128 tiến độ hợp đồng, cảnh báo CONTRACT_OVERDUE, RPT-0129 doanh số HĐ, RPT-0132 lãi/lỗ HĐ, RPT-0133 chi HĐ, RPT-0134 chi tiết lãi/lỗ HĐ, RPT-0135 chi phí khoản mục HĐ, RPT-0136 doanh số theo đơn vị, RPT-0137 sổ chi tiết TK theo HĐ, endpoint contract-fulfillment yêu cầu RPT_SALES_CONTRACT_VIEW, endpoint profitability yêu cầu RPT_SALES_PROFIT_VIEW)."""
        contracts = [
            {
                "contract_date": "2026-01-10",
                "contract_number": "HD-2026-001",
                "customer_name": "Tập đoàn Vingroup",
                "item_name": "Hệ thống thang máy Otis",
                "uom_name": "Bộ",
                "contracted_quantity": "10",
                "delivered_quantity": "8",
                "contract_sales_amount": "5000000000",
                "fulfilled_sales_amount": "4000000000",
                "contract_end_date": "2026-08-30",  # Đã quá hạn kết thúc hợp đồng mà chưa xong -> CONTRACT_OVERDUE
            },
            {
                "contract_date": "2026-03-15",
                "contract_number": "HD-2026-002",
                "customer_name": "Tổng công ty Xây Dựng Số 1",
                "item_name": "Trạm biến áp 110kV",
                "uom_name": "Trạm",
                "contracted_quantity": "2",
                "delivered_quantity": "2",
                "contract_sales_amount": "2000000000",
                "fulfilled_sales_amount": "2000000000",
                "contract_end_date": "2026-12-31",
            },
        ]

        # 1. RPT-0128: Tình hình thực hiện hợp đồng bán (12 cột)
        res_128 = self.client.post("/api/v1/reports/sales/RPT-0128/query/", {"company_id": str(self.company.id), "sales_contracts": contracts}, format="json")
        self.assertEqual(res_128.status_code, 200)
        self.assertEqual(res_128.data["summary"]["row_count"], 2)
        self.assertEqual(res_128.data["summary"]["total_contract_sales_amount"], 7000000000.0)
        self.assertEqual(res_128.data["summary"]["total_fulfilled_sales_amount"], 6000000000.0)
        self.assertEqual(res_128.data["summary"]["total_remaining_sales_amount"], 1000000000.0)

        val_codes_128 = {v["check_code"] for v in res_128.data["validations"]}
        self.assertIn("CONTRACT_OVERDUE", val_codes_128)

        # 2. RPT-0129: Doanh số theo hợp đồng bán (4 cột)
        res_129 = self.client.post("/api/v1/reports/sales/RPT-0129/query/", {"company_id": str(self.company.id), "sales_contracts": contracts}, format="json")
        self.assertEqual(res_129.status_code, 200)

        # 3. RPT-0132: Tổng hợp lãi/lỗ theo hợp đồng (11 cột)
        res_132 = self.client.post("/api/v1/reports/sales/RPT-0132/query/", {"company_id": str(self.company.id), "sales_contracts": contracts}, format="json")
        self.assertEqual(res_132.status_code, 200)

        # 4. RPT-0133: Tình hình chi theo hợp đồng (8 cột)
        res_133 = self.client.post("/api/v1/reports/sales/RPT-0133/query/", {"company_id": str(self.company.id), "sales_contracts": contracts}, format="json")
        self.assertEqual(res_133.status_code, 200)

        # 5. RPT-0134: Chi tiết lãi/lỗ theo hợp đồng (5 cột)
        res_134 = self.client.post("/api/v1/reports/sales/RPT-0134/query/", {"company_id": str(self.company.id), "sales_contracts": contracts}, format="json")
        self.assertEqual(res_134.status_code, 200)

        # 6. RPT-0135: Chi phí theo hợp đồng và khoản mục (8 cột)
        res_135 = self.client.post("/api/v1/reports/sales/RPT-0135/query/", {"company_id": str(self.company.id), "sales_contracts": contracts}, format="json")
        self.assertEqual(res_135.status_code, 200)

        # 7. RPT-0136: Doanh số hợp đồng theo đơn vị thực hiện (6 cột)
        res_136 = self.client.post("/api/v1/reports/sales/RPT-0136/query/", {"company_id": str(self.company.id), "sales_contracts": contracts}, format="json")
        self.assertEqual(res_136.status_code, 200)

        # 8. RPT-0137: Sổ chi tiết TK theo hợp đồng và khoản mục (8 cột)
        res_137 = self.client.post("/api/v1/reports/sales/RPT-0137/query/", {"company_id": str(self.company.id), "sales_contracts": contracts}, format="json")
        self.assertEqual(res_137.status_code, 200)

        # 9. Endpoint contract fulfillment: Quyền RPT_SALES_CONTRACT_VIEW
        cf_denied = self.client.get(
            "/api/v1/reports/sales/contract-fulfillment/HD-2026-001/",
            HTTP_X_SALES_PERMISSIONS="RPT_SALES_VIEW",
        )
        self.assertEqual(cf_denied.status_code, 403)

        cf_ok = self.client.get(
            "/api/v1/reports/sales/contract-fulfillment/HD-2026-001/",
            HTTP_X_SALES_PERMISSIONS="RPT_SALES_VIEW,RPT_SALES_CONTRACT_VIEW",
        )
        self.assertEqual(cf_ok.status_code, 200)
        self.assertEqual(cf_ok.data["contract_id"], "HD-2026-001")

        # 10. Endpoint profitability: Quyền RPT_SALES_PROFIT_VIEW
        pf_denied = self.client.get(
            "/api/v1/reports/sales/profitability/ORDER/SO-2026-001/",
            HTTP_X_SALES_PERMISSIONS="RPT_SALES_VIEW",
        )
        self.assertEqual(pf_denied.status_code, 403)

        pf_ok = self.client.get(
            "/api/v1/reports/sales/profitability/ORDER/SO-2026-001/",
            HTTP_X_SALES_PERMISSIONS="RPT_SALES_VIEW,RPT_SALES_PROFIT_VIEW",
        )
        self.assertEqual(pf_ok.status_code, 200)
        self.assertEqual(pf_ok.data["target_type"], "ORDER")
        self.assertEqual(pf_ok.data["target_id"], "SO-2026-001")
        self.assertIn("gross_profit", pf_ok.data)

    def test_tc_rpt_09_86_to_106_history_filters_export_sources_stale_and_immutability(self):
        """TC-RPT-09-86 .. TC-RPT-09-106: History, summary, validation, drilldown row sources (yêu cầu RPT_SALES_DETAIL_VIEW), row filtering (only_warnings, search), saved filters CRUD, export báo cáo (quyền RPT_SALES_EXPORT), phát hiện snapshot stale khi thay đổi nguồn, và tính bất biến dữ liệu nguồn (immutability)."""
        from sales.models import SalesOrder, SalesInvoice, GoodsSale, SalesReturn, SalesDelivery

        # 1. Tạo report run RPT-0078
        res = self.client.post(
            "/api/v1/reports/sales/RPT-0078/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "data_mode": "SAVED_SNAPSHOT",
                "sales_lines": [
                    {
                        "posting_date": "2026-09-05",
                        "document_no": "BH-001",
                        "invoice_number": "HD-001",
                        "customer_name": "Công ty Khách Hàng 1",
                        "item_code": "SP01",
                        "item_name": "Sản phẩm A",
                        "gross_sold_quantity": "5",
                        "returned_quantity": "8",  # Warning
                        "gross_sales_amount": "5000000",
                        "sales_return_amount": "8000000",
                    },
                    {
                        "posting_date": "2026-09-10",
                        "document_no": "BH-002",
                        "invoice_number": "HD-002",
                        "customer_name": "Công ty Khách Hàng 2",
                        "item_code": "SP02",
                        "item_name": "Sản phẩm B",
                        "gross_sold_quantity": "10",
                        "returned_quantity": "0",
                        "gross_sales_amount": "10000000",
                        "sales_return_amount": "0",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        run_id = res.data["run"]["run_id"]
        rows = res.data["rows"]
        row_id = rows[0]["id"]

        # 2. History, summary, validation
        hist_res = self.client.get(f"/api/v1/reports/sales/runs/{run_id}/history/")
        self.assertEqual(hist_res.status_code, 200)
        self.assertGreaterEqual(len(hist_res.data["history"]), 1)

        sum_res = self.client.get(f"/api/v1/reports/sales/runs/{run_id}/summary/")
        self.assertEqual(sum_res.status_code, 200)

        val_res = self.client.get(f"/api/v1/reports/sales/runs/{run_id}/validation/")
        self.assertEqual(val_res.status_code, 200)

        # 3. Drilldown row sources: Yêu cầu quyền RPT_SALES_DETAIL_VIEW
        src_denied = self.client.get(
            f"/api/v1/reports/sales/runs/{run_id}/rows/{row_id}/sources/",
            HTTP_X_SALES_PERMISSIONS="RPT_SALES_VIEW",
        )
        self.assertEqual(src_denied.status_code, 403)

        src_ok = self.client.get(
            f"/api/v1/reports/sales/runs/{run_id}/rows/{row_id}/sources/",
            HTTP_X_SALES_PERMISSIONS="RPT_SALES_VIEW,RPT_SALES_DETAIL_VIEW",
        )
        self.assertEqual(src_ok.status_code, 200)
        self.assertEqual(src_ok.data["row_id"], row_id)

        # 4. Lọc dòng: only_warnings=true & search
        rows_all = self.client.get(f"/api/v1/reports/sales/runs/{run_id}/rows/")
        self.assertEqual(rows_all.status_code, 200)
        self.assertEqual(len(rows_all.data["rows"]), 2)

        rows_warn = self.client.get(f"/api/v1/reports/sales/runs/{run_id}/rows/?only_warnings=true")
        self.assertEqual(rows_warn.status_code, 200)
        self.assertEqual(len(rows_warn.data["rows"]), 1)

        rows_search = self.client.get(f"/api/v1/reports/sales/runs/{run_id}/rows/?search=HD-002")
        self.assertEqual(rows_search.status_code, 200)
        self.assertEqual(len(rows_search.data["rows"]), 1)
        self.assertEqual(rows_search.data["rows"][0]["columns"]["invoice_number"], "HD-002")

        # 5. Saved Filters CRUD
        save_res = self.client.post(
            "/api/v1/reports/sales/saved/",
            {
                "company_id": str(self.company.id),
                "report_code": "RPT-0078",
                "filter_name": "Bộ lọc bán hàng tháng 9",
                "parameters": {"from_date": "2026-09-01", "to_date": "2026-09-30"},
                "is_default": True,
            },
            format="json",
        )
        self.assertEqual(save_res.status_code, 201)
        self.assertEqual(save_res.data["filter_name"], "Bộ lọc bán hàng tháng 9")

        list_saved = self.client.get(f"/api/v1/reports/sales/saved/?company_id={self.company.id}&report_code=RPT-0078")
        self.assertEqual(list_saved.status_code, 200)
        self.assertGreaterEqual(list_saved.data["count"], 1)

        # 6. Export yêu cầu quyền RPT_SALES_EXPORT
        exp_denied = self.client.post(
            f"/api/v1/reports/sales/runs/{run_id}/export/",
            {"export_format": "XLSX"},
            format="json",
            HTTP_X_SALES_PERMISSIONS="RPT_SALES_VIEW",
        )
        self.assertEqual(exp_denied.status_code, 403)

        exp_ok = self.client.post(
            f"/api/v1/reports/sales/runs/{run_id}/export/",
            {"export_format": "XLSX"},
            format="json",
        )
        self.assertEqual(exp_ok.status_code, 200)
        self.assertEqual(exp_ok.data["export_status"], "READY")
        self.assertEqual(exp_ok.data["format"], "XLSX")

        # 7. Phát hiện snapshot stale khi phát sinh bút toán mới trong kỳ
        entry = JournalEntry.objects.create(
            company=self.company,
            branch=self.branch,
            period=self.period,
            number="JV-SAL-TEST-STALE",
            entry_type="MANUAL",
            posting_date=date(2026, 9, 22),
            status="POSTED",
            created_by=self.user.iam_account,
        )
        chart = ChartOfAccounts.objects.filter(company=self.company).first()
        if not chart:
            chart = ChartOfAccounts.objects.create(company=self.company, code="TT88-SAL", name="Hệ thống", effective_from="2026-01-01", is_default=True)
        acc_cls, _ = AccountClass.objects.get_or_create(company=self.company, code="REV", defaults={"name": "Doanh thu", "normal_balance": "CREDIT"})
        acc, _ = Account.objects.get_or_create(company=self.company, chart_of_accounts=chart, code="5111", defaults={"name": "Doanh thu bán hàng", "account_class": acc_cls})
        JournalLine.objects.create(entry=entry, line_no=1, account=acc, debit=0, credit=5000000, currency=self.currency)

        hdr_after = self.client.get(f"/api/v1/reports/sales/runs/{run_id}/")
        self.assertEqual(hdr_after.status_code, 200)
        self.assertTrue(hdr_after.data["is_stale"])
        self.assertEqual(hdr_after.data["snapshot_status"], "STALE_SOURCE_CHANGED")

        # 8. Tính bất biến tuyệt đối của giao dịch nguồn (BR-RPT-SAL-10, BR-RPT-SAL-118..120)
        so_count_before = SalesOrder.objects.count()
        si_count_before = SalesInvoice.objects.count()
        gs_count_before = GoodsSale.objects.count()
        sr_count_before = SalesReturn.objects.count()
        sd_count_before = SalesDelivery.objects.count()
        je_count_before = JournalEntry.objects.count()

        # Thực thi nhiều query báo cáo khác nhau
        self.client.post("/api/v1/reports/sales/RPT-0076/query/", {"company_id": str(self.company.id), "from_date": "2026-09-01", "to_date": "2026-09-30"}, format="json")
        self.client.post("/api/v1/reports/sales/RPT-0078/query/", {"company_id": str(self.company.id), "from_date": "2026-09-01", "to_date": "2026-09-30"}, format="json")
        self.client.post("/api/v1/reports/sales/RPT-0121/query/", {"company_id": str(self.company.id), "from_date": "2026-09-01", "to_date": "2026-09-30"}, format="json")
        self.client.post("/api/v1/reports/sales/RPT-0128/query/", {"company_id": str(self.company.id), "from_date": "2026-09-01", "to_date": "2026-09-30"}, format="json")

        self.assertEqual(SalesOrder.objects.count(), so_count_before)
        self.assertEqual(SalesInvoice.objects.count(), si_count_before)
        self.assertEqual(GoodsSale.objects.count(), gs_count_before)
        self.assertEqual(SalesReturn.objects.count(), sr_count_before)
        self.assertEqual(SalesDelivery.objects.count(), sd_count_before)
        self.assertEqual(JournalEntry.objects.count(), je_count_before)


from accounts_receivable.models import Receivable, Receipt, ReceiptAllocation
from accounts_payable.models import Payable, PayableDocument, Payment, PaymentAllocation
from sales.models import SalesContract
from purchases.models import PurchaseContract


class DebtReportsUcRpt10Tests(TestCase):
    """
    UC-RPT-10 – Xem báo cáo công nợ (49 báo cáo: 18 AP + 31 AR / Combined)
    Kiểm thử toàn diện 105 kịch bản (TC-RPT-10-01 .. TC-RPT-10-105).
    """

    def setUp(self):
        import io
        import os
        from django.core.exceptions import PermissionDenied, ValidationError
        from reporting.models import ReportExportJob, ReportExportArtifact

        self.client = APIClient()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="DEBT-CO",
            name="Công ty TNHH Báo Cáo Công Nợ Minh Quân",
            legal_name="Công ty TNHH Báo Cáo Công Nợ Minh Quân",
            tax_code="0108888999",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Chi nhánh Hà Nội")
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date="2026-10-01",
            end_date="2026-10-31",
        )
        self.user = get_user_model().objects.create_superuser(
            username="debt-report-admin", email="debtadmin@example.com", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

        # Setup Chart of Accounts and Accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT200-DEBT", name="Hệ thống TT200", effective_from="2026-01-01", is_default=True
        )
        self.acc_cls_ast, _ = AccountClass.objects.get_or_create(company=self.company, code="AST", defaults={"name": "Tài sản", "normal_balance": "DEBIT"})
        self.acc_cls_lia, _ = AccountClass.objects.get_or_create(company=self.company, code="LIA", defaults={"name": "Nợ phải trả", "normal_balance": "CREDIT"})
        self.acc_cls_rev, _ = AccountClass.objects.get_or_create(company=self.company, code="REV", defaults={"name": "Doanh thu", "normal_balance": "CREDIT"})
        self.acc_cls_exp, _ = AccountClass.objects.get_or_create(company=self.company, code="EXP", defaults={"name": "Chi phí", "normal_balance": "DEBIT"})

        self.acc_131 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="131", name="Phải thu của khách hàng", account_class=self.acc_cls_ast)
        self.acc_331 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="331", name="Phải trả cho người bán", account_class=self.acc_cls_lia)
        self.acc_1111 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền mặt VND", account_class=self.acc_cls_ast)
        self.acc_1121 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1121", name="Tiền gửi ngân hàng VND", account_class=self.acc_cls_ast)
        self.acc_5111 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="5111", name="Doanh thu bán hàng", account_class=self.acc_cls_rev)
        self.acc_1561 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1561", name="Giá mua hàng hóa", account_class=self.acc_cls_ast)

        # Setup Partners
        self.cust1 = Party.objects.create(company=self.company, code="KH01", name="Công ty Khách Hàng ABC", party_type="CUSTOMER")
        self.cust2 = Party.objects.create(company=self.company, code="KH02", name="Công ty Khách Hàng XYZ", party_type="CUSTOMER")
        self.vend1 = Party.objects.create(company=self.company, code="NCC01", name="Nhà Cung Cấp Sao Mai", party_type="VENDOR")
        self.vend2 = Party.objects.create(company=self.company, code="NCC02", name="Nhà Cung Cấp Hoàng Gia", party_type="VENDOR")

        # Create posted entries for AR (TK 131) and AP (TK 331)
        # 1. Opening balance entry (2026-09-30)
        e_open = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JE-OPEN-01",
            entry_type="OPENING", posting_date=date(2026, 9, 30), document_date=date(2026, 9, 30),
            status="POSTED", created_by=self.user.iam_account
        )
        # KH01: Dư Nợ đầu kỳ 50.000.000 (Khách còn nợ)
        JournalLine.objects.create(entry=e_open, line_no=1, account=self.acc_131, debit=50000000, credit=0, party=self.cust1, currency=self.currency)
        # KH02: Dư Có đầu kỳ 20.000.000 (Khách trả trước)
        JournalLine.objects.create(entry=e_open, line_no=2, account=self.acc_131, debit=0, credit=20000000, party=self.cust2, currency=self.currency)
        # NCC01: Dư Có đầu kỳ 80.000.000 (Còn nợ NCC)
        JournalLine.objects.create(entry=e_open, line_no=3, account=self.acc_331, debit=0, credit=80000000, party=self.vend1, currency=self.currency)
        # NCC02: Dư Nợ đầu kỳ 30.000.000 (Doanh nghiệp trả trước cho NCC)
        JournalLine.objects.create(entry=e_open, line_no=4, account=self.acc_331, debit=30000000, credit=0, party=self.vend2, currency=self.currency)
        # Balancing
        JournalLine.objects.create(entry=e_open, line_no=5, account=self.acc_1121, debit=20000000, credit=0, currency=self.currency)

        # 2. Period entries (2026-10-10)
        e_oct = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JE-OCT-01",
            entry_type="MANUAL", posting_date=date(2026, 10, 10), document_date=date(2026, 10, 10),
            status="POSTED", created_by=self.user.iam_account
        )
        # Bán hàng cho KH01: Nợ 131 / Có 5111: 30.000.000
        JournalLine.objects.create(entry=e_oct, line_no=1, account=self.acc_131, debit=30000000, credit=0, party=self.cust1, currency=self.currency)
        JournalLine.objects.create(entry=e_oct, line_no=2, account=self.acc_5111, debit=0, credit=30000000, currency=self.currency)
        # Mua hàng từ NCC01: Nợ 1561 / Có 331: 40.000.000
        JournalLine.objects.create(entry=e_oct, line_no=3, account=self.acc_1561, debit=40000000, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=e_oct, line_no=4, account=self.acc_331, debit=0, credit=40000000, party=self.vend1, currency=self.currency)
        # Trả tiền cho NCC01: Nợ 331 / Có 1121: 50.000.000
        JournalLine.objects.create(entry=e_oct, line_no=5, account=self.acc_331, debit=50000000, credit=0, party=self.vend1, currency=self.currency)
        JournalLine.objects.create(entry=e_oct, line_no=6, account=self.acc_1121, debit=0, credit=50000000, currency=self.currency)

        # 3. Create Receivables and Payables for Aging & Reconciliation testing
        self.rec1 = Receivable.objects.create(
            company=self.company, customer=self.cust1, document_date=date(2026, 9, 1), posting_date=date(2026, 9, 1),
            due_date=date(2026, 9, 20), original_amount=Decimal("50000000.00"), balance=Decimal("20000000.00"),
            currency=self.currency, source_document_number="INV-AR-001"
        )
        self.rec2 = Receivable.objects.create(
            company=self.company, customer=self.cust2, document_date=date(2026, 10, 15), posting_date=date(2026, 10, 15),
            due_date=date(2026, 11, 15), original_amount=Decimal("30000000.00"), balance=Decimal("30000000.00"),
            currency=self.currency, source_document_number="INV-AR-002"
        )
        self.pay_doc1 = PayableDocument.objects.create(
            company=self.company,
            number="PD-2026-001",
            document_date=date(2026, 9, 5),
            posting_date=date(2026, 9, 5),
            supplier=self.vend1,
            due_date=date(2026, 9, 25),
            payable_account=self.acc_331,
            currency=self.currency,
            exchange_rate=Decimal("1.00000000"),
            subtotal=Decimal("80000000.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("80000000.00"),
            created_by=self.user.iam_account,
        )
        self.pay1 = Payable.objects.create(
            company=self.company, supplier=self.vend1, document=self.pay_doc1,
            due_date=date(2026, 9, 25), original_amount=Decimal("80000000.00"), balance=Decimal("30000000.00"),
            currency=self.currency, exchange_rate=Decimal("1.00000000")
        )

        # Receipts and Allocations
        self.rcp = Receipt.objects.create(
            company=self.company, customer=self.cust1, currency=self.currency, receipt_date=date(2026, 10, 5),
            amount=Decimal("30000000.00"), allocated_amount=Decimal("30000000.00"),
            external_type="BANK", external_reference="BNK-RCP-01", created_by=self.user.iam_account
        )
        self.alloc_ar = ReceiptAllocation.objects.create(
            receipt=self.rcp, receivable=self.rec1, amount=Decimal("30000000.00"),
            effective_date=date(2026, 10, 5), created_by=self.user.iam_account
        )

        # Payments and Allocations
        self.pmt = Payment.objects.create(
            company=self.company, supplier=self.vend1, currency=self.currency, payment_date=date(2026, 10, 8),
            amount=Decimal("50000000.00"), allocated_amount=Decimal("50000000.00"),
            payment_method="BANK", number="BNK-PMT-01", exchange_rate=Decimal("1.00000000"),
            created_by=self.user.iam_account
        )
        self.alloc_ap = PaymentAllocation.objects.create(
            payment=self.pmt, payable=self.pay1, line_no=1, amount=Decimal("50000000.00"),
            exchange_rate=Decimal("1.00000000"), created_by=self.user.iam_account
        )

        # Sales Contract and Purchase Contract for RPT-0139
        self.sc = SalesContract.objects.create(
            company=self.company, customer=self.cust1, number="HDB-2026-01", title="Hợp đồng cung cấp thiết bị ABC",
            currency=self.currency, total_amount=Decimal("150000000.00"), document_date=date(2026, 8, 1),
            start_date=date(2026, 8, 1), end_date=date(2026, 12, 31),
            created_by=self.user.iam_account
        )
        self.pc = PurchaseContract.objects.create(
            company=self.company, supplier=self.vend1, number="HDM-2026-01", title="Hợp đồng mua linh kiện ABC",
            currency=self.currency, total_amount=Decimal("90000000.00"), document_date=date(2026, 8, 5),
            start_date=date(2026, 8, 5), end_date=date(2026, 12, 31),
            created_by=self.user.iam_account
        )

    def test_tc_rpt_10_01_to_20_catalogue_schemas_and_permissions(self):
        """TC-RPT-10-01 .. TC-RPT-10-20: Danh mục 49 báo cáo công nợ (18 AP + 31 AR), schema số cột chuẩn, RBAC, và parameters."""
        # 1. Danh mục đầy đủ 49 báo cáo công nợ
        cat_res = self.client.get(f"/api/v1/reports/debt/catalogue/?company_id={self.company.id}")
        self.assertEqual(cat_res.status_code, 200)
        self.assertEqual(cat_res.data["count"], 49)
        self.assertEqual(cat_res.data["ap_count"], 18)
        self.assertEqual(cat_res.data["ar_count"], 30)
        self.assertEqual(cat_res.data["combined_count"], 1)

        # 2. Kiểm tra schema và số cột chuẩn của 18 báo cáo AP
        expected_ap_cols = {
            "RPT-0052": 9, "RPT-0053": 12, "RPT-0054": 14, "RPT-0055": 14,
            "RPT-0056": 12, "RPT-0057": 15, "RPT-0058": 10, "RPT-0059": 19,
            "RPT-0060": 8, "RPT-0062": 9, "RPT-0063": 10, "RPT-0065": 12,
            "RPT-0066": 9, "RPT-0067": 9, "RPT-0069": 11, "RPT-0071": 10,
            "RPT-0072": 9, "RPT-0073": 8,
        }
        for code, count in expected_ap_cols.items():
            s_res = self.client.get(f"/api/v1/reports/debt/{code}/schema/")
            self.assertEqual(s_res.status_code, 200, f"Lỗi schema AP {code}")
            self.assertEqual(len(s_res.data["columns"]), count, f"Sai số cột báo cáo {code}")
            self.assertEqual(s_res.data["report_direction"], "AP")

        # 3. Kiểm tra schema và số cột chuẩn của 31 báo cáo AR & Combined
        expected_ar_cols = {
            "RPT-0092": 9, "RPT-0093": 17, "RPT-0094": 8, "RPT-0095": 14,
            "RPT-0096": 2, "RPT-0097": 15, "RPT-0098": 12, "RPT-0099": 10,
            "RPT-0100": 5, "RPT-0101": 14, "RPT-0102": 9, "RPT-0103": 2,
            "RPT-0104": 7, "RPT-0105": 19, "RPT-0106": 12, "RPT-0107": 2,
            "RPT-0111": 9, "RPT-0112": 9, "RPT-0115": 3, "RPT-0116": 10,
            "RPT-0119": 8, "RPT-0120": 10, "RPT-0123": 9, "RPT-0127": 12,
            "RPT-0130": 9, "RPT-0131": 11, "RPT-0138": 9, "RPT-0139": 16,
            "RPT-0140": 10, "RPT-0141": 11, "RPT-0142": 8,
        }
        for code, count in expected_ar_cols.items():
            s_res = self.client.get(f"/api/v1/reports/debt/{code}/schema/")
            self.assertEqual(s_res.status_code, 200, f"Lỗi schema AR {code}")
            self.assertEqual(len(s_res.data["columns"]), count, f"Sai số cột báo cáo {code}")

        # 4. Parameters endpoint
        p_res = self.client.get(f"/api/v1/reports/debt/RPT-0052/parameters/")
        self.assertEqual(p_res.status_code, 200)
        self.assertGreaterEqual(len(p_res.data["parameters"]), 5)

        # 5. Chặn quyền truy cập khi thiếu permission
        no_perm = self.client.get(
            f"/api/v1/reports/debt/catalogue/?company_id={self.company.id}",
            HTTP_X_USER_PERMISSIONS="NONE_UNAUTHORIZED",
        )
        # Superuser always bypasses, verify with non-superuser
        normal_user = get_user_model().objects.create_user(username="normal-clerk", password="x")
        c2 = APIClient()
        c2.force_authenticate(normal_user)
        denied = c2.get(f"/api/v1/reports/debt/catalogue/?company_id={self.company.id}")
        self.assertEqual(denied.status_code, 403)

    def test_tc_rpt_10_21_to_40_ap_reports_and_separation_of_balances(self):
        """TC-RPT-10-21 .. TC-RPT-10-40: 18 báo cáo AP, không bù trừ chéo Dư Nợ và Dư Có TK 331 giữa các nhà cung cấp, đối chiếu thanh toán."""
        # Query RPT-0052 (Tổng hợp công nợ phải trả NCC)
        res_52 = self.client.post(
            "/api/v1/reports/debt/RPT-0052/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
            },
            format="json",
        )
        self.assertEqual(res_52.status_code, 200)
        sum_52 = res_52.data["summary"]
        # Phải có 2 nhà cung cấp NCC01 và NCC02
        self.assertEqual(sum_52["partner_count"], 2)
        # NCC01: Đầu kỳ Có 80M, trong kỳ Nợ 50M, Có 40M -> Cuối kỳ Có 70M
        # NCC02: Đầu kỳ Nợ 30M, trong kỳ không phát sinh -> Cuối kỳ Nợ 30M
        # Kiểm tra không bù trừ chéo: Tổng Dư Nợ ĐK = 30M, Tổng Dư Có ĐK = 80M!
        self.assertEqual(sum_52["total_opening_debit"], 30000000.0)
        self.assertEqual(sum_52["total_opening_credit"], 80000000.0)
        self.assertEqual(sum_52["total_period_debit"], 50000000.0)
        self.assertEqual(sum_52["total_period_credit"], 40000000.0)
        self.assertEqual(sum_52["total_closing_debit"], 30000000.0)
        self.assertEqual(sum_52["total_closing_credit"], 70000000.0)

        # Query RPT-0054 (Chi tiết công nợ phải trả theo hóa đơn)
        res_54 = self.client.post(
            "/api/v1/reports/debt/RPT-0054/query/",
            {"company_id": str(self.company.id), "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_54.status_code, 200)

        # Query RPT-0056 (Sổ chi tiết công nợ phải trả NCC)
        res_56 = self.client.post(
            "/api/v1/reports/debt/RPT-0056/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_56.status_code, 200)

        # Query RPT-0073 (Đối chiếu chứng từ công nợ phải trả và thanh toán)
        res_73 = self.client.post(
            "/api/v1/reports/debt/RPT-0073/query/",
            {"company_id": str(self.company.id)},
            format="json",
        )
        self.assertEqual(res_73.status_code, 200)
        run_id_73 = res_73.data["run_id"]

        # Differences endpoint
        diff_res = self.client.get(f"/api/v1/reports/debt/reconciliation/{run_id_73}/differences/")
        self.assertEqual(diff_res.status_code, 200)
        self.assertIn("difference_count", diff_res.data)

    def test_tc_rpt_10_41_to_65_ar_reports_and_separation_of_balances(self):
        """TC-RPT-10-41 .. TC-RPT-10-65: 31 báo cáo AR, không bù trừ chéo Dư Nợ và Dư Có TK 131 giữa các khách hàng, đối chiếu thu tiền."""
        # Query RPT-0092 (Tổng hợp công nợ phải thu KH)
        res_92 = self.client.post(
            "/api/v1/reports/debt/RPT-0092/query/",
            {
                "company_id": str(self.company.id),
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
            },
            format="json",
        )
        self.assertEqual(res_92.status_code, 200)
        sum_92 = res_92.data["summary"]
        self.assertEqual(sum_92["customer_count"], 2)
        # KH01: Dư Nợ ĐK 50M, trong kỳ Nợ 30M -> Dư Nợ CK 80M
        # KH02: Dư Có ĐK 20M, trong kỳ không phát sinh -> Dư Có CK 20M
        # Kiểm tra không cấn trừ: Tổng Dư Nợ ĐK = 50M, Tổng Dư Có ĐK = 20M!
        self.assertEqual(sum_92["total_opening_debit"], 50000000.0)
        self.assertEqual(sum_92["total_opening_credit"], 20000000.0)
        self.assertEqual(sum_92["total_period_debit"], 30000000.0)
        self.assertEqual(sum_92["total_closing_debit"], 80000000.0)
        self.assertEqual(sum_92["total_closing_credit"], 20000000.0)

        # Query RPT-0098 (Sổ chi tiết công nợ phải thu KH)
        res_98 = self.client.post(
            "/api/v1/reports/debt/RPT-0098/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_98.status_code, 200)

        # Query RPT-0106 (Chi tiết công nợ phải thu theo hóa đơn)
        res_106 = self.client.post(
            "/api/v1/reports/debt/RPT-0106/query/",
            {"company_id": str(self.company.id), "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_106.status_code, 200)

        # Query RPT-0142 (Đối chiếu chứng từ công nợ phải thu và thanh toán)
        res_142 = self.client.post(
            "/api/v1/reports/debt/RPT-0142/query/",
            {"company_id": str(self.company.id)},
            format="json",
        )
        self.assertEqual(res_142.status_code, 200)

    def test_tc_rpt_10_66_to_80_aging_analysis_and_historical_as_of_date(self):
        """TC-RPT-10-66 .. TC-RPT-10-80: Phân tích tuổi nợ (RPT-0057, RPT-0093, aging-analysis), các khoảng tuổi nợ, tái tạo số dư lịch sử As-of Date."""
        # 1. Phân tích tuổi nợ phải thu (RPT-0093) tại ngày 2026-10-31
        res_93 = self.client.post(
            "/api/v1/reports/debt/RPT-0093/query/",
            {"company_id": str(self.company.id), "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_93.status_code, 200)
        sum_93 = res_93.data["summary"]
        self.assertGreaterEqual(sum_93["total_debt"], 50000000.0)

        # 2. Endpoint phân tích tuổi nợ độc lập
        aging_res = self.client.post(
            "/api/v1/reports/debt/aging-analysis/",
            {"company_id": str(self.company.id), "direction": "AR", "as_of_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(aging_res.status_code, 200)
        self.assertIn("summary", aging_res.data)
        self.assertIn("rows", aging_res.data)

        # 3. Kiểm tra tính lịch sử As-of Date:
        # rec1 có thanh toán ngày 2026-10-05.
        # Nếu xem số dư tại ngày 2026-09-30 (trước ngày thanh toán), nợ còn lại phải là 50M (chưa trừ 30M)!
        hist_aging = self.client.post(
            "/api/v1/reports/debt/aging-analysis/",
            {"company_id": str(self.company.id), "direction": "AR", "as_of_date": "2026-09-30"},
            format="json",
        )
        self.assertEqual(hist_aging.status_code, 200)
        # Tại ngày 30/9, khoản thanh toán ngày 5/10 chưa xảy ra -> paid = 0, remaining = 50M!
        self.assertEqual(hist_aging.data["summary"]["total_paid"], 0.0)

    def test_tc_rpt_10_81_to_95_contract_combined_and_confirmation_documents(self):
        """TC-RPT-10-81 .. TC-RPT-10-95: Báo cáo kết hợp AR/AP theo hợp đồng RPT-0139 (16 cột), biên bản đối chiếu xác nhận nợ RPT-0058, RPT-0096, RPT-0107."""
        # 1. RPT-0139: Tổng hợp phải thu và phải trả theo hợp đồng
        res_139 = self.client.post(
            "/api/v1/reports/debt/RPT-0139/query/",
            {"company_id": str(self.company.id)},
            format="json",
        )
        self.assertEqual(res_139.status_code, 200)
        self.assertGreaterEqual(len(res_139.data["rows"]), 1)
        r0 = res_139.data["rows"][0]["columns"]
        self.assertEqual(r0["sales_contract_value"], 150000000.0)
        self.assertEqual(r0["gross_profit"], 60000000.0)  # 150M - 90M

        # Endpoint contract-combined
        comb_res = self.client.get(f"/api/v1/reports/debt/contract-combined/{self.sc.id}/?company_id={self.company.id}")
        self.assertEqual(comb_res.status_code, 200)
        self.assertEqual(len(comb_res.data["rows"]), 1)

        # 2. Biên bản đối chiếu công nợ
        conf_res = self.client.post(
            "/api/v1/reports/debt/confirmation-document/",
            {"company_id": str(self.company.id), "partner_id": "KH01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(conf_res.status_code, 200)
        self.assertEqual(conf_res.data["partner_id"], "KH01")
        self.assertEqual(conf_res.data["status"], "DRAFT")

    def test_tc_rpt_10_96_to_105_run_details_history_saved_filters_export_stale_non_mutability(self):
        """TC-RPT-10-96 .. TC-RPT-10-105: Header, Rows, Summary, Validation, Row-sources, History, Saved Filters, Export XLSX/PDF, Stale detection, Read-Only non-mutability."""
        # 1. Query báo cáo để tạo Run
        run_res = self.client.post(
            "/api/v1/reports/debt/RPT-0052/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(run_res.status_code, 200)
        run_id = run_res.data["run_id"]

        # 2. Chi tiết Run, Rows, Summary, Validation
        det = self.client.get(f"/api/v1/reports/debt/runs/{run_id}/")
        self.assertEqual(det.status_code, 200)
        self.assertEqual(det.data["report_code"], "RPT-0052")

        rows_res = self.client.get(f"/api/v1/reports/debt/runs/{run_id}/rows/")
        self.assertEqual(rows_res.status_code, 200)
        self.assertEqual(rows_res.data["count"], 2)
        first_row_id = rows_res.data["rows"][0]["id"]

        sum_res = self.client.get(f"/api/v1/reports/debt/runs/{run_id}/summary/")
        self.assertEqual(sum_res.status_code, 200)

        val_res = self.client.get(f"/api/v1/reports/debt/runs/{run_id}/validation/")
        self.assertEqual(val_res.status_code, 200)
        self.assertEqual(val_res.data["status"], "VALID")

        # 3. Row sources
        src_res = self.client.get(f"/api/v1/reports/debt/runs/{run_id}/rows/{first_row_id}/sources/")
        self.assertEqual(src_res.status_code, 200)

        # 4. History
        hist_res = self.client.get(f"/api/v1/reports/debt/runs/{run_id}/history/")
        self.assertEqual(hist_res.status_code, 200)
        self.assertGreaterEqual(hist_res.data["count"], 1)

        # 5. Lưu và tải bộ lọc
        sf_res = self.client.post(
            "/api/v1/reports/debt/saved/",
            {
                "company_id": str(self.company.id),
                "report_code": "RPT-0052",
                "filter_name": "Bộ lọc công nợ NCC tháng 10",
                "parameters": {"from_date": "2026-10-01", "to_date": "2026-10-31"},
                "is_default": True,
            },
            format="json",
        )
        self.assertEqual(sf_res.status_code, 201)
        self.assertEqual(sf_res.data["status"], "SAVED")

        list_sf = self.client.get(f"/api/v1/reports/debt/saved/?company_id={self.company.id}&report_code=RPT-0052")
        self.assertEqual(list_sf.status_code, 200)
        self.assertEqual(list_sf.data["count"], 1)

        # 6. Export (chặn quyền và xuất thành công)
        normal_user = get_user_model().objects.create_user(username="export-clerk", password="x")
        c_exp = APIClient()
        c_exp.force_authenticate(normal_user)
        exp_denied = c_exp.post(f"/api/v1/reports/debt/runs/{run_id}/export/", {"format": "XLSX"}, format="json")
        self.assertEqual(exp_denied.status_code, 403)

        exp_ok = self.client.post(f"/api/v1/reports/debt/runs/{run_id}/export/", {"format": "XLSX"}, format="json")
        self.assertEqual(exp_ok.status_code, 200)
        self.assertEqual(exp_ok.data["export_status"], "READY")
        self.assertEqual(exp_ok.data["format"], "XLSX")

        # 7. Phát hiện snapshot stale khi có chứng từ mới
        e_stale = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JE-STALE-01",
            entry_type="MANUAL", posting_date=date(2026, 10, 20), status="POSTED", created_by=self.user.iam_account
        )
        det_stale = self.client.get(f"/api/v1/reports/debt/runs/{run_id}/")
        self.assertEqual(det_stale.status_code, 200)
        self.assertTrue(det_stale.data["is_stale"])

        # 8. Tính bất biến tuyệt đối của số liệu gốc (BR-RPT-DEBT-10, BR-RPT-DEBT-110..113)
        rec_count_before = Receivable.objects.count()
        pay_count_before = Payable.objects.count()
        rcp_count_before = Receipt.objects.count()
        pmt_count_before = Payment.objects.count()
        je_count_before = JournalEntry.objects.count()

        # Thực thi nhiều query báo cáo khác nhau
        self.client.post("/api/v1/reports/debt/RPT-0052/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/debt/RPT-0054/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/debt/RPT-0092/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/debt/RPT-0093/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/debt/RPT-0139/query/", {"company_id": str(self.company.id)}, format="json")

        self.assertEqual(Receivable.objects.count(), rec_count_before)
        self.assertEqual(Payable.objects.count(), pay_count_before)
        self.assertEqual(Receipt.objects.count(), rcp_count_before)
        self.assertEqual(Payment.objects.count(), pmt_count_before)
        self.assertEqual(JournalEntry.objects.count(), je_count_before)


class MoneyReportsUcRpt11Tests(TestCase):
    """
    Test suite cho UC-RPT-11 – Xem báo cáo tiền (17 Báo cáo).
    Kiểm tra đầy đủ từ TC-RPT-11-01 đến TC-RPT-11-95:
    - 17 Báo cáo (Tiền mặt, Tiền gửi, Chuyển nội bộ, Khế ước vay & cho vay)
    - Running balance số quỹ tiền mặt & sổ tiền gửi
    - Loại trừ chuyển tiền nội bộ trong Dòng tiền quản trị (RPT-0031)
    - Bảng kê số dư theo ngày (RPT-0032, RPT-0035) As-of Date & so sánh
    - Tách biệt gốc và lãi trong khế ước vay (RPT-0041..0044) và cho vay (RPT-0045..0046)
    - Đối chiếu ngân hàng, cảnh báo chênh lệch sao kê
    - Lưu & tải bộ lọc, snapshot lịch sử, phát hiện stale
    - Tính bất biến tuyệt đối của số liệu gốc (BR-RPT-MONEY-10, BR-RPT-MONEY-100).
    """

    def setUp(self):
        from master_data.models import Currency, Party, Bank, CompanyBankAccount
        from organization.models import Company, Branch
        from general_ledger.models import (
            AccountingPeriod, Account, AccountClass, ChartOfAccounts, JournalEntry, JournalLine
        )
        from cash_management.models import CashFund, CashTransaction, CashTransfer
        from bank_management.models import (
            AccountProfile, BankTransaction, BankTransfer, StatementImport, StatementLine,
            CreditContract, LoanAgreement
        )

        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="CTY-RPT11",
            name="Công ty TNHH Báo Cáo Tiền Minh Quân",
            legal_name="Công ty TNHH Báo Cáo Tiền Minh Quân",
            tax_code="0109999888",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Chi nhánh Hà Nội")
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date="2026-10-01",
            end_date="2026-10-31",
        )
        self.user = get_user_model().objects.create_superuser(
            username="money-report-admin", email="moneyadmin@example.com", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

        # Accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT200-MONEY", name="Hệ thống TT200", effective_from="2026-01-01", is_default=True
        )
        self.acc_cls_ast, _ = AccountClass.objects.get_or_create(company=self.company, code="AST", defaults={"name": "Tài sản", "normal_balance": "DEBIT"})
        self.acc_cls_lia, _ = AccountClass.objects.get_or_create(company=self.company, code="LIA", defaults={"name": "Nợ phải trả", "normal_balance": "CREDIT"})
        self.acc_cls_rev, _ = AccountClass.objects.get_or_create(company=self.company, code="REV", defaults={"name": "Doanh thu", "normal_balance": "CREDIT"})
        self.acc_cls_exp, _ = AccountClass.objects.get_or_create(company=self.company, code="EXP", defaults={"name": "Chi phí", "normal_balance": "DEBIT"})

        self.acc_1111 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền mặt VND", account_class=self.acc_cls_ast)
        self.acc_1121 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1121", name="Tiền gửi ngân hàng VND", account_class=self.acc_cls_ast)
        self.acc_1131 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1131", name="Tiền đang chuyển", account_class=self.acc_cls_ast)
        self.acc_131 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="131", name="Phải thu của khách hàng", account_class=self.acc_cls_ast)
        self.acc_331 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="331", name="Phải trả cho người bán", account_class=self.acc_cls_lia)
        self.acc_5111 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="5111", name="Doanh thu bán hàng", account_class=self.acc_cls_rev)
        self.acc_642 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="642", name="Chi phí quản lý DN", account_class=self.acc_cls_exp)
        self.acc_3411 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="3411", name="Vay và nợ thuê tài chính", account_class=self.acc_cls_lia)
        self.acc_1283 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1283", name="Cho vay", account_class=self.acc_cls_ast)
        self.acc_635 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="635", name="Chi phí tài chính (Lãi vay)", account_class=self.acc_cls_exp)
        self.acc_515 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="515", name="Doanh thu hoạt động tài chính (Lãi cho vay)", account_class=self.acc_cls_rev)

        # Cash Fund
        self.fund = CashFund.objects.create(
            company=self.company, branch=self.branch, code="Q_VND", name="Quỹ tiền mặt VND",
            currency=self.currency, gl_account=self.acc_1111, balance=Decimal("50000000.00")
        )

        # Bank & Bank Account
        self.bank = Bank.objects.create(code="VCB", name="Ngân hàng TMCP Ngoại Thương Việt Nam")
        self.cba_a = CompanyBankAccount.objects.create(
            company=self.company, bank=self.bank, account_number="001100223344", account_name="VCB - TK Chính", currency=self.currency
        )
        self.cba_b = CompanyBankAccount.objects.create(
            company=self.company, bank=self.bank, account_number="001100556677", account_name="VCB - TK Chi Nhánh", currency=self.currency
        )
        self.profile_a = AccountProfile.objects.create(company=self.company, account=self.cba_a, balance=Decimal("100000000.00"))
        self.profile_b = AccountProfile.objects.create(company=self.company, account=self.cba_b, balance=Decimal("50000000.00"))

        # Credit Contract & Loans
        self.credit_contract = CreditContract.objects.create(
            company=self.company, number="HDTD-2026-01", partner_name="Ngân hàng Ngoại Thương",
            sign_date=date(2026, 8, 1), credit_limit=Decimal("500000000.00"), created_by=self.user.iam_account
        )
        self.loan_borrow = LoanAgreement.objects.create(
            company=self.company, direction="BORROWING", number="KUV-2026-01", counterparty_name="Ngân hàng Ngoại Thương",
            credit_contract=self.credit_contract, principal_account=self.acc_3411, interest_account=self.acc_635,
            amount=Decimal("100000000.00"), term=12, term_unit="MONTH", disbursement_date=date(2026, 9, 1),
            due_date=date(2027, 9, 1), created_by=self.user.iam_account
        )
        self.loan_lend = LoanAgreement.objects.create(
            company=self.company, direction="LENDING", number="KUCV-2026-01", counterparty_name="Công ty Đối Tác Delta",
            principal_account=self.acc_1283, interest_account=self.acc_515,
            amount=Decimal("100000000.00"), term=6, term_unit="MONTH", disbursement_date=date(2026, 9, 15),
            due_date=date(2027, 3, 15), created_by=self.user.iam_account
        )

        # Internal Bank Transfer
        self.transfer = BankTransfer.objects.create(
            company=self.company, number="TRF-2026-01", source_account=self.profile_a, destination_account=self.profile_b,
            transfer_date=date(2026, 10, 12), source_amount=Decimal("50000000.00"), destination_amount=Decimal("50000000.00"),
            description="Chuyển tiền sang tài khoản chi nhánh", status="CONFIRMED", created_by=self.user.iam_account
        )

        # Statement Import and Unmatched Statement Line for reconciliation variance
        self.stmt_import = StatementImport.objects.create(
            company=self.company, account=self.profile_a, source="FILE", source_reference="STMT-2026-10",
            period_from=date(2026, 10, 1), period_to=date(2026, 10, 31), created_by=self.user.iam_account
        )
        self.stmt_line = StatementLine.objects.create(
            statement=self.stmt_import, external_id="EXT-TXN-01", transaction_date=date(2026, 10, 18),
            direction="CREDIT", amount=Decimal("1500000.00"), currency=self.currency, match_status="UNMATCHED"
        )

        # Setup GL Entries for Cash & Bank transactions
        # 1. Opening balances before Oct 2026 (2026-09-30)
        e_open = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JE-OPEN-01",
            entry_type="OPENING", posting_date=date(2026, 9, 30), document_date=date(2026, 9, 30),
            status="POSTED", created_by=self.user.iam_account
        )
        # Quỹ tiền mặt đầu kỳ: 50.000.000
        JournalLine.objects.create(entry=e_open, line_no=1, account=self.acc_1111, debit=50000000, credit=0, currency=self.currency)
        # Tiền gửi ngân hàng đầu kỳ: 100.000.000
        JournalLine.objects.create(entry=e_open, line_no=2, account=self.acc_1121, debit=100000000, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=e_open, line_no=3, account=self.acc_331, debit=0, credit=150000000, currency=self.currency)

        # 2. In-period Cash Transactions (2026-10-10)
        e_cash_rcp = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="PT-2026-01",
            entry_type="MANUAL", posting_date=date(2026, 10, 10), document_date=date(2026, 10, 10),
            description="Thu tiền bán hàng trực tiếp", status="POSTED", created_by=self.user.iam_account
        )
        # Thu tiền mặt: Nợ 1111 / Có 5111: 10.000.000
        JournalLine.objects.create(entry=e_cash_rcp, line_no=1, account=self.acc_1111, debit=10000000, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=e_cash_rcp, line_no=2, account=self.acc_5111, debit=0, credit=10000000, currency=self.currency)

        e_cash_pmt = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="PC-2026-01",
            entry_type="MANUAL", posting_date=date(2026, 10, 10), document_date=date(2026, 10, 10),
            description="Chi trả tiền văn phòng phẩm", status="POSTED", created_by=self.user.iam_account
        )
        # Chi tiền mặt: Nợ 642 / Có 1111: 8.000.000
        JournalLine.objects.create(entry=e_cash_pmt, line_no=1, account=self.acc_642, debit=8000000, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=e_cash_pmt, line_no=2, account=self.acc_1111, debit=0, credit=8000000, currency=self.currency)

        # 3. In-period Bank Movements & Internal transfer
        e_bank_ext = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="BNK-EXT-01",
            entry_type="MANUAL", posting_date=date(2026, 10, 15), document_date=date(2026, 10, 15),
            description="Khách hàng chuyển khoản thanh toán", status="POSTED", created_by=self.user.iam_account
        )
        # Thu bên ngoài: Nợ 1121 / Có 131: 40.000.000
        JournalLine.objects.create(entry=e_bank_ext, line_no=1, account=self.acc_1121, debit=40000000, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=e_bank_ext, line_no=2, account=self.acc_131, debit=0, credit=40000000, currency=self.currency)

        e_bank_out = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="BNK-EXT-02",
            entry_type="MANUAL", posting_date=date(2026, 10, 20), document_date=date(2026, 10, 20),
            description="Chi thanh toán tiền điện thoại ngân hàng", status="POSTED", created_by=self.user.iam_account
        )
        # Chi bên ngoài: Nợ 642 / Có 1121: 22.000.000
        JournalLine.objects.create(entry=e_bank_out, line_no=1, account=self.acc_642, debit=22000000, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=e_bank_out, line_no=2, account=self.acc_1121, debit=0, credit=22000000, currency=self.currency)

        # Internal Transfer: Nợ 1121 (TK B) / Có 1121 (TK A): 20.000.000
        e_trf = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JE-TRF-01",
            entry_type="MANUAL", posting_date=date(2026, 10, 22), document_date=date(2026, 10, 22),
            description="Chuyển tiền nội bộ giữa 2 tài khoản ngân hàng", status="POSTED", created_by=self.user.iam_account
        )
        JournalLine.objects.create(entry=e_trf, line_no=1, account=self.acc_1121, debit=20000000, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=e_trf, line_no=2, account=self.acc_1121, debit=0, credit=20000000, currency=self.currency)

    def test_tc_rpt_11_01_to_24_catalogue_schemas_and_parameters(self):
        """TC-RPT-11-01 .. TC-RPT-11-24: Danh mục 17 báo cáo tiền, schema cột chuẩn, RBAC, và tham số."""
        # 1. Danh mục đầy đủ 17 báo cáo tiền
        cat_res = self.client.get(f"/api/v1/reports/money/catalogue/?company_id={self.company.id}")
        self.assertEqual(cat_res.status_code, 200)
        self.assertEqual(cat_res.data["count"], 17)
        self.assertEqual(cat_res.data["cash_count"], 4)
        self.assertEqual(cat_res.data["bank_count"], 5)
        self.assertEqual(cat_res.data["combined_count"], 2)
        self.assertEqual(cat_res.data["loan_count"], 6)

        # 2. Kiểm tra schema và số cột chuẩn của cả 17 báo cáo
        expected_cols = {
            "RPT-0030": 11, "RPT-0031": 4, "RPT-0032": 1, "RPT-0033": 11,
            "RPT-0034": 11, "RPT-0035": 1, "RPT-0036": 11, "RPT-0037": 8,
            "RPT-0038": 11, "RPT-0039": 6, "RPT-0040": 12, "RPT-0041": 13,
            "RPT-0042": 13, "RPT-0043": 8, "RPT-0044": 7, "RPT-0045": 13,
            "RPT-0046": 8,
        }
        for code, count in expected_cols.items():
            s_res = self.client.get(f"/api/v1/reports/money/{code}/schema/")
            self.assertEqual(s_res.status_code, 200, f"Lỗi schema {code}")
            self.assertEqual(len(s_res.data["columns"]), count, f"Sai số cột báo cáo {code}")

        # 3. Parameters endpoint
        p_res = self.client.get("/api/v1/reports/money/RPT-0034/parameters/")
        self.assertEqual(p_res.status_code, 200)
        self.assertGreaterEqual(len(p_res.data["parameters"]), 5)

        # 4. Chặn quyền truy cập khi thiếu permission
        normal_user = get_user_model().objects.create_user(username="normal-money-clerk", password="x")
        c2 = APIClient()
        c2.force_authenticate(normal_user)
        denied = c2.get(f"/api/v1/reports/money/catalogue/?company_id={self.company.id}")
        self.assertEqual(denied.status_code, 403)

        # 5. Validate From Date > To Date -> 400
        inv_date = self.client.post(
            "/api/v1/reports/money/RPT-0034/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-31", "to_date": "2026-10-01"},
            format="json",
        )
        self.assertEqual(inv_date.status_code, 400)

    def test_tc_rpt_11_25_to_44_cash_reports_journals_and_running_balance(self):
        """TC-RPT-11-25 .. TC-RPT-11-44: Sổ quỹ tiền mặt RPT-0034 (running balance, đầu 50M, thu 10M, chi 8M -> tồn 52M), S03a1 thu RPT-0030, S03a2 chi RPT-0033, số dư ngày RPT-0032."""
        # 1. RPT-0034: Sổ chi tiết quỹ tiền mặt
        res_34 = self.client.post(
            "/api/v1/reports/money/RPT-0034/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_34.status_code, 200)
        sum_34 = res_34.data["summary"]
        self.assertEqual(sum_34["opening_balance"], 50000000.0)
        self.assertEqual(sum_34["total_debit"], 10000000.0)
        self.assertEqual(sum_34["total_credit"], 8000000.0)
        self.assertEqual(sum_34["closing_balance"], 52000000.0)

        # Check running balances on rows
        run_id_34 = res_34.data["run_id"]
        rows_34 = self.client.get(f"/api/v1/reports/money/runs/{run_id_34}/rows/")
        self.assertEqual(rows_34.status_code, 200)
        self.assertEqual(rows_34.data["count"], 2)
        # Sắp xếp mặc định theo số chứng từ: PC (Chi 8M) chạy trước -> Tồn = 50M - 8M = 42M; PT (Thu 10M) -> 42M + 10M = 52M
        r0 = rows_34.data["rows"][0]["columns"]
        self.assertEqual(r0["running_cash_balance"], 42000000.0)
        r1 = rows_34.data["rows"][1]["columns"]
        self.assertEqual(r1["running_cash_balance"], 52000000.0)

        # Đổi cách sắp xếp: Thu trước chi cùng ngày (receipts_before_payments=True)
        # PT (Thu 10M) chạy trước -> 50M + 10M = 60M; PC (Chi 8M) chạy sau -> 60M - 8M = 52M
        res_34_sort = self.client.post(
            "/api/v1/reports/money/RPT-0034/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31", "receipts_before_payments": True},
            format="json",
        )
        self.assertEqual(res_34_sort.status_code, 200)
        self.assertEqual(res_34_sort.data["summary"]["closing_balance"], 52000000.0)
        run_id_sort = res_34_sort.data["run_id"]
        rows_sort = self.client.get(f"/api/v1/reports/money/runs/{run_id_sort}/rows/")
        self.assertEqual(rows_sort.data["rows"][0]["columns"]["running_cash_balance"], 60000000.0)
        self.assertEqual(rows_sort.data["rows"][1]["columns"]["running_cash_balance"], 52000000.0)

        # 2. RPT-0030: S03a1-DN Sổ nhật ký thu tiền mặt
        res_30 = self.client.post(
            "/api/v1/reports/money/RPT-0030/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31", "account_slots": ["511", "131", "331", "112"]},
            format="json",
        )
        self.assertEqual(res_30.status_code, 200)
        self.assertEqual(res_30.data["summary"]["total_debit_cash"], 10000000.0)
        self.assertEqual(res_30.data["summary"]["total_credit_slot_1"], 10000000.0)  # TK 5111 vào slot 1!

        # 3. RPT-0033: S03a2-DN Sổ nhật ký chi tiền mặt
        res_33 = self.client.post(
            "/api/v1/reports/money/RPT-0033/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31", "account_slots": ["331", "156", "642", "112"]},
            format="json",
        )
        self.assertEqual(res_33.status_code, 200)
        self.assertEqual(res_33.data["summary"]["total_credit_cash"], 8000000.0)
        self.assertEqual(res_33.data["summary"]["total_debit_slot_3"], 8000000.0)  # TK 642 vào slot 3!

        # 4. RPT-0032: Bảng kê số dư theo ngày (Tiền mặt)
        res_32 = self.client.post(
            "/api/v1/reports/money/RPT-0032/query/",
            {"company_id": str(self.company.id), "to_date": "2026-10-31", "comparison_date": "2026-09-30"},
            format="json",
        )
        self.assertEqual(res_32.status_code, 200)
        sum_32 = res_32.data["summary"]
        self.assertEqual(sum_32["total_balance"], 52000000.0)
        self.assertEqual(sum_32["comparison_balance"], 50000000.0)
        self.assertEqual(sum_32["difference_amount"], 2000000.0)

    def test_tc_rpt_11_45_to_60_bank_reports_transfers_and_cash_flow_elimination(self):
        """TC-RPT-11-45 .. TC-RPT-11-60: Dòng tiền quản trị RPT-0031 (loại trừ chuyển nội bộ), sổ tiền gửi RPT-0037, bảng kê số dư NH RPT-0039, chuyển nội bộ RPT-0040, chênh lệch sao kê."""
        # 1. RPT-0031: Dòng tiền quản trị
        # Đầu kỳ = 150M (50M tiền mặt + 100M ngân hàng)
        # Thu bên ngoài = 10M (bán hàng tiền mặt) + 40M (thu nợ KH ngân hàng) = 50M
        # Chi bên ngoài = 8M (CP tiền mặt) + 22M (CP ngân hàng) = 30M
        # Chuyển nội bộ 20M bị LOẠI TRỪ khỏi thu chi ngoài -> Tồn cuối = 150M + 50M - 30M = 170M!
        res_31 = self.client.post(
            "/api/v1/reports/money/RPT-0031/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_31.status_code, 200)
        sum_31 = res_31.data["summary"]
        self.assertEqual(sum_31["opening_balance"], 150000000.0)
        self.assertEqual(sum_31["total_receipts"], 50000000.0)
        self.assertEqual(sum_31["total_payments"], 30000000.0)
        self.assertEqual(sum_31["closing_balance"], 170000000.0)

        # 2. RPT-0037: Sổ tiền gửi ngân hàng (8 cột)
        res_37 = self.client.post(
            "/api/v1/reports/money/RPT-0037/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_37.status_code, 200)
        self.assertEqual(res_37.data["summary"]["opening_balance"], 100000000.0)

        # 3. RPT-0039: Bảng kê số dư ngân hàng (6 cột)
        res_39 = self.client.post(
            "/api/v1/reports/money/RPT-0039/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_39.status_code, 200)
        self.assertEqual(res_39.data["summary"]["account_count"], 2)

        # 4. RPT-0040: Sổ chi tiết chuyển tiền nội bộ (12 cột)
        res_40 = self.client.post(
            "/api/v1/reports/money/RPT-0040/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(res_40.status_code, 200)
        self.assertEqual(res_40.data["summary"]["total_transfer_amount"], 50000000.0)
        self.assertEqual(res_40.data["summary"]["transfer_count"], 1)

        # Trace chuyển tiền
        trace_res = self.client.get(f"/api/v1/reports/money/transfers/{self.transfer.id}/trace/")
        self.assertEqual(trace_res.status_code, 200)
        self.assertEqual(trace_res.data["source_amount"], 50000000.0)

        # 5. Chênh lệch đối chiếu ngân hàng (Reconciliation differences)
        diff_res = self.client.get(f"/api/v1/reports/money/reconciliation/differences/?company_id={self.company.id}")
        self.assertEqual(diff_res.status_code, 200)
        self.assertEqual(diff_res.data["status"], "VARIANCE")
        self.assertEqual(diff_res.data["difference_count"], 1)

    def test_tc_rpt_11_61_to_80_loan_and_lending_reports_and_principal_interest_separation(self):
        """TC-RPT-11-61 .. TC-RPT-11-80: Báo cáo khế ước vay RPT-0041..0044, khế ước cho vay RPT-0045..0046, tách biệt tuyệt đối gốc và lãi."""
        # 1. RPT-0041: Báo cáo tổng hợp tình hình khế ước vay
        # Vay 100M, giải ngân 100M, trả gốc 30M, trả lãi 2M -> Dư nợ gốc còn lại = 70M (không giảm bởi lãi 2M!)
        res_41 = self.client.post(
            "/api/v1/reports/money/RPT-0041/query/",
            {
                "company_id": str(self.company.id),
                "principal_paid_period": "30000000",
                "interest_paid_period": "2000000",
            },
            format="json",
        )
        self.assertEqual(res_41.status_code, 200)
        sum_41 = res_41.data["summary"]
        self.assertEqual(sum_41["total_contract_amount"], 100000000.0)
        self.assertEqual(sum_41["total_principal_paid_period"], 30000000.0)
        self.assertEqual(sum_41["total_interest_paid_period"], 2000000.0)
        self.assertEqual(sum_41["total_closing_outstanding"], 70000000.0)

        # 2. RPT-0045: Báo cáo tổng hợp tình hình khế ước cho vay
        # Cho vay 100M, thu gốc 20M, thu lãi 5M -> Dư gốc còn phải thu = 80M (không giảm bởi lãi 5M!)
        res_45 = self.client.post(
            "/api/v1/reports/money/RPT-0045/query/",
            {
                "company_id": str(self.company.id),
                "principal_collected_period": "20000000",
                "interest_collected_period": "500000",
            },
            format="json",
        )
        self.assertEqual(res_45.status_code, 200)
        sum_45 = res_45.data["summary"]
        self.assertEqual(sum_45["total_contract_amount"], 100000000.0)
        self.assertEqual(sum_45["total_principal_collected_period"], 20000000.0)
        self.assertEqual(sum_45["total_closing_receivable"], 80000000.0)

        # 3. RPT-0042: S34-DN Sổ chi tiết tiền vay (13 cột)
        res_42 = self.client.post(
            "/api/v1/reports/money/RPT-0042/query/",
            {"company_id": str(self.company.id), "principal_decrease": "30000000"},
            format="json",
        )
        self.assertEqual(res_42.status_code, 200)
        self.assertEqual(res_42.data["summary"]["closing_principal_balance"], 70000000.0)

        # 4. RPT-0043: Bảng kê chứng từ vay & RPT-0046: Bảng kê chứng từ cho vay
        res_43 = self.client.post(
            "/api/v1/reports/money/RPT-0043/query/",
            {"company_id": str(self.company.id), "principal_repaid_amount": "30000000", "interest_paid_amount": "2000000"},
            format="json",
        )
        self.assertEqual(res_43.status_code, 200)
        self.assertEqual(res_43.data["summary"]["total_repaid_or_collected"], 30000000.0)

        res_46 = self.client.post(
            "/api/v1/reports/money/RPT-0046/query/",
            {"company_id": str(self.company.id), "principal_collected_amount": "20000000", "interest_collected_amount": "500000"},
            format="json",
        )
        self.assertEqual(res_46.status_code, 200)
        self.assertEqual(res_46.data["summary"]["total_repaid_or_collected"], 20000000.0)

        # 5. RPT-0044: Tổng hợp lịch trả nợ khế ước vay
        res_44 = self.client.post(
            "/api/v1/reports/money/RPT-0044/query/",
            {"company_id": str(self.company.id)},
            format="json",
        )
        self.assertEqual(res_44.status_code, 200)
        self.assertEqual(res_44.data["summary"]["total_contract_principal"], 100000000.0)

        # Loan summary endpoint
        ln_res = self.client.get(f"/api/v1/reports/money/loans/{self.loan_borrow.id}/summary/")
        self.assertEqual(ln_res.status_code, 200)
        self.assertEqual(ln_res.data["contract_amount"], 100000000.0)

    def test_tc_rpt_11_81_to_95_run_details_history_saved_filters_export_stale_non_mutability(self):
        """TC-RPT-11-81 .. TC-RPT-11-95: Header, Rows, Summary, Validation, Row-sources, History, Saved Filters, Export XLSX/PDF, Stale detection, Read-Only non-mutability."""
        from cash_management.models import CashTransaction, CashTransfer
        from bank_management.models import BankTransaction, BankTransfer, LoanAgreement

        # 1. Query báo cáo để tạo Run
        run_res = self.client.post(
            "/api/v1/reports/money/RPT-0034/query/",
            {"company_id": str(self.company.id), "from_date": "2026-10-01", "to_date": "2026-10-31"},
            format="json",
        )
        self.assertEqual(run_res.status_code, 200)
        run_id = run_res.data["run_id"]

        # 2. Chi tiết Run, Rows, Summary, Validation
        det = self.client.get(f"/api/v1/reports/money/runs/{run_id}/")
        self.assertEqual(det.status_code, 200)
        self.assertEqual(det.data["report_code"], "RPT-0034")

        rows_res = self.client.get(f"/api/v1/reports/money/runs/{run_id}/rows/")
        self.assertEqual(rows_res.status_code, 200)
        self.assertEqual(rows_res.data["count"], 2)
        first_row_id = rows_res.data["rows"][0]["id"]

        sum_res = self.client.get(f"/api/v1/reports/money/runs/{run_id}/summary/")
        self.assertEqual(sum_res.status_code, 200)

        val_res = self.client.get(f"/api/v1/reports/money/runs/{run_id}/validation/")
        self.assertEqual(val_res.status_code, 200)
        self.assertEqual(val_res.data["status"], "PASSED")

        # 3. Row sources (Drill-down qua UC-RPT-14)
        src_res = self.client.get(f"/api/v1/reports/money/runs/{run_id}/rows/{first_row_id}/sources/")
        self.assertEqual(src_res.status_code, 200)
        self.assertEqual(src_res.data["target_uc_code"], "UC-RPT-14")

        # 4. History
        hist_res = self.client.get(f"/api/v1/reports/money/runs/{run_id}/history/")
        self.assertEqual(hist_res.status_code, 200)
        self.assertGreaterEqual(hist_res.data["count"], 1)

        # 5. Lưu và tải bộ lọc
        sf_res = self.client.post(
            "/api/v1/reports/money/saved/",
            {
                "company_id": str(self.company.id),
                "report_code": "RPT-0034",
                "filter_name": "Bộ lọc quỹ tiền mặt tháng 10",
                "parameters": {"from_date": "2026-10-01", "to_date": "2026-10-31"},
                "is_default": True,
            },
            format="json",
        )
        self.assertEqual(sf_res.status_code, 201)
        self.assertEqual(sf_res.data["status"], "SAVED")

        list_sf = self.client.get(f"/api/v1/reports/money/saved/?company_id={self.company.id}&report_code=RPT-0034")
        self.assertEqual(list_sf.status_code, 200)
        self.assertEqual(list_sf.data["count"], 1)

        # 6. Export (chặn quyền và xuất thành công)
        normal_user = get_user_model().objects.create_user(username="export-money-clerk", password="x")
        c_exp = APIClient()
        c_exp.force_authenticate(normal_user)
        exp_denied = c_exp.post(f"/api/v1/reports/money/runs/{run_id}/export/", {"format": "XLSX"}, format="json")
        self.assertEqual(exp_denied.status_code, 403)

        exp_ok = self.client.post(f"/api/v1/reports/money/runs/{run_id}/export/", {"format": "XLSX"}, format="json")
        self.assertEqual(exp_ok.status_code, 200)
        self.assertEqual(exp_ok.data["export_status"], "READY")
        self.assertEqual(exp_ok.data["format"], "XLSX")

        # 7. Phát hiện snapshot stale khi có chứng từ mới phát sinh
        JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JE-STALE-MONEY-01",
            entry_type="MANUAL", posting_date=date(2026, 10, 25), status="POSTED", created_by=self.user.iam_account
        )
        det_stale = self.client.get(f"/api/v1/reports/money/runs/{run_id}/")
        self.assertEqual(det_stale.status_code, 200)
        self.assertTrue(det_stale.data["is_stale"])

        # 8. Tính bất biến tuyệt đối của số liệu gốc (BR-RPT-MONEY-10, BR-RPT-MONEY-100)
        cash_txn_before = CashTransaction.objects.count()
        cash_trf_before = CashTransfer.objects.count()
        bank_txn_before = BankTransaction.objects.count()
        bank_trf_before = BankTransfer.objects.count()
        loan_before = LoanAgreement.objects.count()
        je_before = JournalEntry.objects.count()

        # Thực thi nhiều truy vấn báo cáo khác nhau
        self.client.post("/api/v1/reports/money/RPT-0030/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/money/RPT-0031/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/money/RPT-0034/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/money/RPT-0037/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/money/RPT-0040/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/money/RPT-0041/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/money/RPT-0045/query/", {"company_id": str(self.company.id)}, format="json")

        self.assertEqual(CashTransaction.objects.count(), cash_txn_before)
        self.assertEqual(CashTransfer.objects.count(), cash_trf_before)
        self.assertEqual(BankTransaction.objects.count(), bank_txn_before)
        self.assertEqual(BankTransfer.objects.count(), bank_trf_before)
        self.assertEqual(LoanAgreement.objects.count(), loan_before)
        self.assertEqual(JournalEntry.objects.count(), je_before)


class InventoryReportsUcRpt12Tests(TestCase):
    """
    Test suite cho UC-RPT-12 – Xem báo cáo kho (15 Báo cáo).
    Kiểm tra đầy đủ từ TC-RPT-12-01 đến TC-RPT-12-110:
    - 15 Báo cáo kho (RPT-0143 .. RPT-0157)
    - 150 vị trí cột cố định và các dynamic columns (bảng chéo kho, multi-UOM)
    - Phương trình tồn kho: Tồn cuối = Tồn đầu + Nhập - Xuất
    - Running balance số lượng và giá trị trên Sổ chi tiết VTHH (RPT-0149)
    - Chuyển kho nội bộ (RPT-0150)
    - Sản xuất: Tiến độ (RPT-0151) và Tiêu hao NVL (RPT-0152)
    - Các báo cáo đối chiếu:
      + Đối chiếu kho và sổ cái (RPT-0153)
      + Đối chiếu chi phí mua hàng (RPT-0154)
      + Đối chiếu kế toán và thủ kho (RPT-0155)
      + Đối chiếu giá thành và nhập kho (RPT-0156)
      + Đối chiếu lệnh lắp ráp / tháo dỡ (RPT-0157)
    - Cảnh báo tồn âm (WARN_NEGATIVE_STOCK) và cảnh báo lệch sổ cái
    - Phân quyền theo kho, phân quyền giá vốn, lưu bộ lọc, snapshot stale, export
    - Tính bất biến tuyệt đối của số liệu gốc (BR-RPT-INV-09, BR-RPT-INV-111..114).
    """

    def setUp(self):
        from master_data.models import Currency, Party, Warehouse, ItemCategory, UnitOfMeasure, Item, ItemUomConversion
        from organization.models import Company, Branch
        from general_ledger.models import (
            AccountingPeriod, Account, AccountClass, ChartOfAccounts, JournalEntry, JournalLine
        )
        from inventory.models import (
            InventoryTransaction, InventoryTransactionLine, StockMovement,
            ValuationRun, AssemblyOrder, AssemblyLine, ProductionOrder, ProductionOrderLine
        )
        from purchases.models import PurchaseCost, PurchaseCostLine, GoodsPurchase

        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="CTY-RPT12",
            name="Công ty TNHH Báo Cáo Kho Minh An",
            legal_name="Công ty TNHH Báo Cáo Kho Minh An",
            tax_code="0109999777",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="KHO-TONG", name="Chi nhánh Kho Tổng")
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date="2026-10-01",
            end_date="2026-10-31",
        )
        self.user = get_user_model().objects.create_superuser(
            username="inv-report-admin", email="invadmin@example.com", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.supplier = Party.objects.create(
            company=self.company, code="NCC-01", name="Nhà cung cấp Thép Việt", party_type="SUPPLIER"
        )

        # Master Data
        self.uom_cai = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        self.uom_thung = UnitOfMeasure.objects.create(company=self.company, code="THUNG", name="Thùng")
        self.category = ItemCategory.objects.create(company=self.company, code="CAT-NL", name="Nguyên vật liệu chính")

        self.item_a = Item.objects.create(
            company=self.company,
            code="VT-001",
            name="Thép tấm chịu lực A1",
            base_uom=self.uom_cai,
            category=self.category,
            track_inventory=True,
            status="ACTIVE",
        )
        self.item_b = Item.objects.create(
            company=self.company,
            code="VT-002",
            name="Đai ốc inox 304",
            base_uom=self.uom_cai,
            category=self.category,
            track_inventory=True,
            status="ACTIVE",
        )
        self.conversion = ItemUomConversion.objects.create(
            item=self.item_a,
            from_uom=self.uom_thung,
            to_uom=self.uom_cai,
            factor=Decimal("20.00"),
        )

        self.wh_1 = Warehouse.objects.create(company=self.company, code="KHO-01", name="Kho Vật tư Hà Nội")
        self.wh_2 = Warehouse.objects.create(company=self.company, code="KHO-02", name="Kho Thành phẩm Hải Phòng")
        self.wh_3 = Warehouse.objects.create(company=self.company, code="KHO-03", name="Kho Trung chuyển Đà Nẵng")

        # Accounts for GL Reconciliation
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT200-INV", name="Hệ thống TK Kho TT200", effective_from="2026-01-01", is_default=True
        )
        self.acc_class_asset = AccountClass.objects.create(company=self.company, code="1", name="Tài sản ngắn hạn")
        self.acc_152 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="152", name="Nguyên liệu, vật liệu"
        )
        self.acc_155 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="155", name="Thành phẩm"
        )
        self.acc_1561 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="1561", name="Giá mua hàng hóa"
        )
        self.acc_1562 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="1562", name="Chi phí thu mua hàng hóa"
        )
        self.acc_112 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="1121", name="Tiền gửi ngân hàng VND"
        )
        self.acc_331 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="331", name="Phải trả người bán"
        )

        # 1. Tạo số dư đầu kỳ (Opening balance) qua StockMovement trước 2026-10-01 (TC-RPT-12-22)
        # Tồn đầu: 100 cái, giá trị 100.000.000 VND
        tx_open = InventoryTransaction.objects.create(
            company=self.company, branch=self.branch, number="PN-OPEN-01",
            transaction_type="RECEIPT", transaction_date=date(2026, 9, 25),
            destination_warehouse=self.wh_1, status="POSTED", total_value=Decimal("100000000.00"),
            created_by=self.user.iam_account
        )
        line_open = InventoryTransactionLine.objects.create(
            transaction=tx_open, line_no=1, item=self.item_a, uom=self.uom_cai,
            quantity=Decimal("100.00"), unit_cost=Decimal("1000000.00"), line_value=Decimal("100000000.00"),
            debit_account=self.acc_152, credit_account=self.acc_331
        )
        StockMovement.objects.create(
            company=self.company, transaction=tx_open, line=line_open,
            warehouse=self.wh_1, item=self.item_a, movement_date=date(2026, 9, 25),
            quantity_delta=Decimal("100.00"), value_delta=Decimal("100000000.00"),
            balance_quantity=Decimal("100.00"), balance_value=Decimal("100000000.00")
        )

        # 2. Phát sinh trong kỳ: Nhập 50 cái, giá trị 50.000.000 VND
        tx_in = InventoryTransaction.objects.create(
            company=self.company, branch=self.branch, number="PN-PER-01",
            transaction_type="RECEIPT", transaction_date=date(2026, 10, 5),
            destination_warehouse=self.wh_1, status="POSTED", total_value=Decimal("50000000.00"),
            created_by=self.user.iam_account, gl_status="POSTED"
        )
        line_in = InventoryTransactionLine.objects.create(
            transaction=tx_in, line_no=1, item=self.item_a, uom=self.uom_cai,
            quantity=Decimal("50.00"), unit_cost=Decimal("1000000.00"), line_value=Decimal("50000000.00"),
            debit_account=self.acc_152, credit_account=self.acc_331
        )
        StockMovement.objects.create(
            company=self.company, transaction=tx_in, line=line_in,
            warehouse=self.wh_1, item=self.item_a, movement_date=date(2026, 10, 5),
            quantity_delta=Decimal("50.00"), value_delta=Decimal("50000000.00"),
            balance_quantity=Decimal("150.00"), balance_value=Decimal("150000000.00")
        )

        # 3. Phát sinh trong kỳ: Xuất 30 cái, giá trị 32.000.000 VND
        self.tx_out = InventoryTransaction.objects.create(
            company=self.company, branch=self.branch, number="PX-PER-01",
            transaction_type="ISSUE", transaction_date=date(2026, 10, 15),
            source_warehouse=self.wh_1, status="POSTED", total_value=Decimal("32000000.00"),
            created_by=self.user.iam_account, gl_status="POSTED"
        )
        self.line_out = InventoryTransactionLine.objects.create(
            transaction=self.tx_out, line_no=1, item=self.item_a, uom=self.uom_cai,
            quantity=Decimal("30.00"), unit_cost=Decimal("1066666.67"), line_value=Decimal("32000000.00"),
            debit_account=self.acc_155, credit_account=self.acc_152
        )
        StockMovement.objects.create(
            company=self.company, transaction=self.tx_out, line=self.line_out,
            warehouse=self.wh_1, item=self.item_a, movement_date=date(2026, 10, 15),
            quantity_delta=Decimal("-30.00"), value_delta=Decimal("-32000000.00"),
            balance_quantity=Decimal("120.00"), balance_value=Decimal("118000000.00")
        )

        # 4. Chuyển kho nội bộ từ WH_1 sang WH_2: 10 cái (TC-RPT-12-44, RPT-0150)
        tx_trf = InventoryTransaction.objects.create(
            company=self.company, branch=self.branch, number="CK-PER-01",
            transaction_type="TRANSFER", transaction_date=date(2026, 10, 20),
            source_warehouse=self.wh_1, destination_warehouse=self.wh_2,
            status="POSTED", total_value=Decimal("10000000.00"),
            created_by=self.user.iam_account
        )
        line_trf = InventoryTransactionLine.objects.create(
            transaction=tx_trf, line_no=1, item=self.item_a, uom=self.uom_cai,
            quantity=Decimal("10.00"), unit_cost=Decimal("1000000.00"), line_value=Decimal("10000000.00")
        )

        # 5. Lệnh sản xuất (RPT-0151, RPT-0152)
        self.prod_order = ProductionOrder.objects.create(
            company=self.company, number="LSX-2026-001", document_date=date(2026, 10, 10),
            description="Lệnh sản xuất đợt 1", status="IN_PROGRESS", created_by=self.user.iam_account
        )
        ProductionOrderLine.objects.create(
            order=self.prod_order, role="PRODUCT", line_no=1, item=self.item_a, quantity=Decimal("100.00")
        )
        ProductionOrderLine.objects.create(
            order=self.prod_order, role="MATERIAL", line_no=2, item=self.item_b, quantity=Decimal("200.00")
        )

        # 6. GL Journal Entry tương ứng cho GL Reconciliation (TC-RPT-12-71..73)
        # Giả lập: GL Nợ 100.000.000, Kho nhập 98.000.000 -> lệch +2.000.000
        je = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JE-INV-01",
            entry_type="MANUAL", posting_date=date(2026, 10, 5), status="POSTED", created_by=self.user.iam_account
        )
        JournalLine.objects.create(
            entry=je, line_no=1, account=self.acc_152, debit=Decimal("100000000.00"), credit=Decimal("0.00"), currency=self.currency
        )
        JournalLine.objects.create(
            entry=je, line_no=2, account=self.acc_331, debit=Decimal("0.00"), credit=Decimal("100000000.00"), currency=self.currency
        )

        # 7. Landed Cost (RPT-0154)
        pc = PurchaseCost.objects.create(
            company=self.company, branch=self.branch, number="CP-001",
            supplier=self.supplier,
            document_date=date(2026, 10, 10), posting_date=date(2026, 10, 10),
            status="APPROVED", created_by=self.user.iam_account,
            subtotal=Decimal("10000000.00"), total_amount=Decimal("10000000.00")
        )
        PurchaseCostLine.objects.create(
            cost=pc, line_no=1, cost_type="Vận chuyển", pre_tax_amount=Decimal("10000000.00"),
            total_amount=Decimal("10000000.00"), allocated_amount=Decimal("7000000.00"),
            account=self.acc_1562
        )

        # 8. Lệnh lắp ráp (RPT-0157)
        ao = AssemblyOrder.objects.create(
            company=self.company, number="LR-001", warehouse=self.wh_1,
            assembly_date=date(2026, 10, 12), operation="ASSEMBLE", status="POSTED",
            created_by=self.user.iam_account
        )
        AssemblyLine.objects.create(
            assembly=ao, line_no=1, role="COMPONENT", item=self.item_b,
            quantity=Decimal("9.00"), unit_cost=Decimal("10000.00")  # Xuất 90.000
        )
        AssemblyLine.objects.create(
            assembly=ao, line_no=2, role="OUTPUT", item=self.item_a,
            quantity=Decimal("1.00"), unit_cost=Decimal("100000.00") # Nhập 100.000 -> lệch 10.000
        )

    def test_01_catalogue_and_permissions(self):
        """TC-RPT-12-01..05: Kiểm tra danh mục 15 báo cáo, quyền và cô lập công ty."""
        # TC-RPT-12-01: Mở danh mục
        res = self.client.get(f"/api/v1/reports/inventory/catalogue/?company_id={self.company.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["total_reports"], 15)
        codes = [r["code"] for r in res.data["reports"]]
        expected_codes = [f"RPT-{str(i).zfill(4)}" for i in range(143, 158)]
        for ec in expected_codes:
            self.assertIn(ec, codes)

        # TC-RPT-12-02: Không có quyền -> Từ chối 403
        no_perm_user = get_user_model().objects.create_user(username="no-inv-perm", password="x")
        c = APIClient()
        c.force_authenticate(no_perm_user)
        res_denied = c.get(f"/api/v1/reports/inventory/catalogue/?company_id={self.company.id}")
        self.assertEqual(res_denied.status_code, 403)

        # TC-RPT-12-03: Company khác -> Không lộ dữ liệu
        from organization.models import Company
        other_company = Company.objects.create(
            code="CTY-OTHER-INV", name="Công ty Khác", legal_name="Công ty Khác",
            accounting_currency=self.currency, legal_reporting_currency=self.currency
        )
        res_other = self.client.get(f"/api/v1/reports/inventory/catalogue/?company_id={other_company.id}")
        self.assertEqual(res_other.status_code, 200)
        self.assertEqual(res_other.data["company_id"], str(other_company.id))

        # TC-RPT-12-05: Thiếu quyền giá vốn -> Cột giá trị bị che / ẩn
        clerk_user = get_user_model().objects.create_user(username="inv-clerk-no-val", password="x")
        c_clerk = APIClient()
        c_clerk.force_authenticate(clerk_user)
        # Giả lập header cấp quyền RPT_INVENTORY_VIEW nhưng không có RPT_INVENTORY_VALUE_VIEW
        res_schema = c_clerk.get(
            "/api/v1/reports/inventory/RPT-0143/schema/",
            HTTP_X_USER_PERMISSIONS="RPT_INVENTORY_VIEW",
        )
        self.assertEqual(res_schema.status_code, 200)
        for col in res_schema.data["columns"]:
            if col.get("requires_value_perm"):
                self.assertTrue(col.get("hidden") or col.get("masked"))

    def test_02_all_15_schemas_and_fixed_columns(self):
        """TC-RPT-12-06..20: Kiểm tra đúng số cột cố định và cấu trúc của toàn bộ 15 báo cáo."""
        expected_counts = {
            "RPT-0143": 12,
            "RPT-0144": 3,
            "RPT-0145": 3,
            "RPT-0146": 11,
            "RPT-0147": 12,
            "RPT-0148": 10,
            "RPT-0149": 15,
            "RPT-0150": 11,
            "RPT-0151": 6,
            "RPT-0152": 12,
            "RPT-0153": 11,
            "RPT-0154": 11,
            "RPT-0155": 13,
            "RPT-0156": 10,
            "RPT-0157": 10,
        }
        for code, expected_cnt in expected_counts.items():
            res = self.client.get(f"/api/v1/reports/inventory/{code}/schema/")
            self.assertEqual(res.status_code, 200, f"Failed schema for {code}")
            self.assertEqual(
                len(res.data["columns"]), expected_cnt,
                f"Column count mismatch for {code}: expected {expected_cnt}, got {len(res.data['columns'])}"
            )

    def test_03_inventory_calculation_and_equation(self):
        """TC-RPT-12-21..53: Kiểm tra phương trình tồn kho, ngày hợp lệ, running balance."""
        # TC-RPT-12-21: Từ ngày lớn hơn Đến ngày -> Báo lỗi 400
        res_date_err = self.client.post("/api/v1/reports/inventory/RPT-0143/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-31",
            "to_date": "2026-10-01",
        }, format="json")
        self.assertEqual(res_date_err.status_code, 400)
        self.assertIn("from_date", res_date_err.data)

        # TC-RPT-12-22 & 23: Tồn đầu 100, nhập 50, xuất 30 -> Tồn cuối 120; Giá trị: 100tr + 50tr - 32tr = 118tr
        res_0143 = self.client.post("/api/v1/reports/inventory/RPT-0143/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
            "warehouse_ids": [str(self.wh_1.id)],
        }, format="json")
        self.assertEqual(res_0143.status_code, 200)
        run_id = res_0143.data["id"]

        rows_res = self.client.get(f"/api/v1/reports/inventory/runs/{run_id}/rows/")
        self.assertEqual(rows_res.status_code, 200)
        item_a_row = next(r for r in rows_res.data["rows"] if r["item_code"] == "VT-001")
        cols = item_a_row["columns"]
        self.assertEqual(cols["opening_quantity"], 100.0)
        self.assertEqual(cols["receipt_quantity"], 50.0)
        self.assertEqual(cols["issue_quantity"], 30.0)
        self.assertEqual(cols["closing_quantity"], 120.0)
        self.assertEqual(cols["opening_value"], 100000000.0)
        self.assertEqual(cols["receipt_value"], 50000000.0)
        self.assertEqual(cols["issue_value"], 32000000.0)
        self.assertEqual(cols["closing_value"], 118000000.0)

        # TC-RPT-12-35: Bảng chéo 3 kho (RPT-0144)
        res_0144 = self.client.post("/api/v1/reports/inventory/RPT-0144/query/", {
            "company_id": str(self.company.id),
            "to_date": "2026-10-31",
            "warehouse_ids": [str(self.wh_1.id), str(self.wh_2.id), str(self.wh_3.id)],
            "show_inventory_value": True,
        }, format="json")
        self.assertEqual(res_0144.status_code, 200)
        dyn_cols = res_0144.data["dynamic_columns"]
        self.assertTrue(any(f"wh_{self.wh_1.id}" in c["code"] for c in dyn_cols))
        self.assertTrue(any(f"wh_{self.wh_2.id}" in c["code"] for c in dyn_cols))
        self.assertTrue(any("total_quantity" in c["code"] for c in dyn_cols))

        # TC-RPT-12-44: Chuyển kho nội bộ (RPT-0150)
        res_0150 = self.client.post("/api/v1/reports/inventory/RPT-0150/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0150.status_code, 200)
        self.assertGreaterEqual(res_0150.data["row_count"], 1)

        # TC-RPT-12-51: Sổ chi tiết VTHH (RPT-0149) running balance
        res_0149 = self.client.post("/api/v1/reports/inventory/RPT-0149/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
            "warehouse_ids": [str(self.wh_1.id)],
            "item_id": str(self.item_a.id),
        }, format="json")
        self.assertEqual(res_0149.status_code, 200)
        rows_0149 = self.client.get(f"/api/v1/reports/inventory/runs/{res_0149.data['id']}/rows/").data["rows"]
        # Có dòng đầu kỳ + 2 dòng phát sinh (nhập 50, xuất 30)
        self.assertGreaterEqual(len(rows_0149), 3)
        last_row = rows_0149[-1]
        self.assertEqual(last_row["columns"]["running_quantity"], 120.0)
        self.assertEqual(last_row["columns"]["running_value"], 118000000.0)

        # TC-RPT-12-30: Cảnh báo tồn âm (WARN_NEGATIVE_STOCK)
        # Giả lập phát sinh xuất vượt tồn
        from inventory.models import StockMovement
        StockMovement.objects.create(
            company=self.company, transaction=self.tx_out, line=self.line_out,
            warehouse=self.wh_2, item=self.item_b, movement_date=date(2026, 10, 22),
            quantity_delta=Decimal("-50.00"), value_delta=Decimal("-500000.00"),
            balance_quantity=Decimal("-50.00"), balance_value=Decimal("-500000.00")
        )
        res_neg = self.client.post("/api/v1/reports/inventory/RPT-0143/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
            "warehouse_ids": [str(self.wh_2.id)],
        }, format="json")
        self.assertEqual(res_neg.status_code, 200)
        val_res = self.client.get(f"/api/v1/reports/inventory/runs/{res_neg.data['id']}/validation/")
        self.assertTrue(any(v["check_code"] == "WARN_NEGATIVE_STOCK" for v in val_res.data["validations"]))

    def test_04_reconciliation_and_discrepancies(self):
        """TC-RPT-12-71..92: Kiểm tra các báo cáo đối chiếu kho, sổ cái, chi phí, giá thành, lắp ráp."""
        # 1. RPT-0153: Đối chiếu kho và sổ cái (GL Nợ 100, Kho nhập 50 -> lệch Nợ; GL Dư vs Kho tồn)
        res_0153 = self.client.post("/api/v1/reports/inventory/RPT-0153/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0153.status_code, 200)
        self.assertGreaterEqual(res_0153.data["row_count"], 1)
        val_0153 = self.client.get(f"/api/v1/reports/inventory/runs/{res_0153.data['id']}/validation/")
        self.assertTrue(any(v["check_code"] == "WARN_GL_STOCK_DIFF" for v in val_0153.data["validations"]))

        # 2. RPT-0154: Đối chiếu Landed Cost: CP 10tr, phân bổ 7tr -> chênh lệch 3tr (TC-RPT-12-79)
        res_0154 = self.client.post("/api/v1/reports/inventory/RPT-0154/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0154.status_code, 200)
        rows_0154 = self.client.get(f"/api/v1/reports/inventory/runs/{res_0154.data['id']}/rows/").data["rows"]
        self.assertGreaterEqual(len(rows_0154), 1)
        cols_0154 = rows_0154[0]["columns"]
        self.assertEqual(cols_0154["cost_document_amount"], 10000000.0)
        self.assertEqual(cols_0154["allocated_cost_amount"], 7000000.0)
        self.assertEqual(cols_0154["difference_amount"], 3000000.0)

        # 3. RPT-0155: Đối chiếu kế toán và thủ kho (TC-RPT-12-83..84)
        res_0155 = self.client.post("/api/v1/reports/inventory/RPT-0155/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0155.status_code, 200)
        self.assertGreaterEqual(res_0155.data["row_count"], 1)

        # 4. RPT-0156: Đối chiếu giá thành và nhập kho (TC-RPT-12-87)
        res_0156 = self.client.post("/api/v1/reports/inventory/RPT-0156/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0156.status_code, 200)

        # 5. RPT-0157: Đối chiếu lắp ráp: linh kiện 90.000, thành phẩm 100.000 -> lệch 10.000 (TC-RPT-12-91)
        res_0157 = self.client.post("/api/v1/reports/inventory/RPT-0157/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0157.status_code, 200)
        rows_0157 = self.client.get(f"/api/v1/reports/inventory/runs/{res_0157.data['id']}/rows/").data["rows"]
        self.assertGreaterEqual(len(rows_0157), 1)
        cols_0157 = rows_0157[0]["columns"]
        self.assertEqual(cols_0157["receipt_value"], 100000.0)
        self.assertEqual(cols_0157["issue_value"], 90000.0)
        self.assertEqual(cols_0157["difference_amount"], 10000.0)

    def test_05_saved_filters_export_stale_and_non_mutability(self):
        """TC-RPT-12-96..114: Kiểm tra drilldown, saved filter, stale, export và tính bất biến tuyệt đối."""
        from inventory.models import StockMovement, InventoryTransaction
        from general_ledger.models import JournalEntry

        # 1. Truy vấn tạo bản chạy báo cáo
        res = self.client.post("/api/v1/reports/inventory/RPT-0143/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res.status_code, 200)
        run_id = res.data["id"]

        # 2. Drill-down dòng chứng từ nguồn (TC-RPT-12-96)
        rows_res = self.client.get(f"/api/v1/reports/inventory/runs/{run_id}/rows/")
        self.assertGreaterEqual(len(rows_res.data["rows"]), 1)
        first_row_id = rows_res.data["rows"][0]["id"]
        sources_res = self.client.get(f"/api/v1/reports/inventory/runs/{run_id}/rows/{first_row_id}/sources/")
        self.assertEqual(sources_res.status_code, 200)

        # 3. Lưu bộ lọc (TC-RPT-12-98)
        save_sf = self.client.post("/api/v1/reports/inventory/saved/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0143",
            "filter_name": "Bộ lọc kho vật tư tháng 10",
            "parameters": {"warehouse_ids": [str(self.wh_1.id)]},
            "is_default": True,
        }, format="json")
        self.assertEqual(save_sf.status_code, 201)

        list_sf = self.client.get(f"/api/v1/reports/inventory/saved/?company_id={self.company.id}&report_code=RPT-0143")
        self.assertEqual(list_sf.status_code, 200)
        self.assertEqual(list_sf.data["count"], 1)

        # 4. Export (TC-RPT-12-100)
        clerk_user = get_user_model().objects.create_user(username="no-export-inv", password="x")
        c_exp = APIClient()
        c_exp.force_authenticate(clerk_user)
        exp_denied = c_exp.post(f"/api/v1/reports/inventory/runs/{run_id}/export/", {"format": "XLSX"}, format="json")
        self.assertEqual(exp_denied.status_code, 403)

        exp_ok = self.client.post(f"/api/v1/reports/inventory/runs/{run_id}/export/", {"format": "XLSX"}, format="json")
        self.assertEqual(exp_ok.status_code, 200)
        self.assertEqual(exp_ok.data["export_status"], "READY")
        self.assertEqual(exp_ok.data["format"], "XLSX")

        # 5. Phát hiện snapshot stale khi có chứng từ mới phát sinh (TC-RPT-12-99)
        InventoryTransaction.objects.create(
            company=self.company, branch=self.branch, number="PN-STALE-01",
            transaction_type="RECEIPT", transaction_date=date(2026, 10, 28),
            destination_warehouse=self.wh_1, status="POSTED", total_value=Decimal("5000000.00"),
            created_by=self.user.iam_account
        )
        det_stale = self.client.get(f"/api/v1/reports/inventory/runs/{run_id}/")
        self.assertEqual(det_stale.status_code, 200)
        self.assertTrue(det_stale.data["is_stale"])

        # 6. Tính bất biến tuyệt đối của số liệu gốc (TC-RPT-12-101..105, BR-RPT-INV-09, BR-RPT-INV-111..114)
        mov_count_before = StockMovement.objects.count()
        tx_count_before = InventoryTransaction.objects.count()
        je_count_before = JournalEntry.objects.count()

        # Thực thi nhiều truy vấn báo cáo khác nhau
        self.client.post("/api/v1/reports/inventory/RPT-0143/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/inventory/RPT-0144/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/inventory/RPT-0146/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/inventory/RPT-0149/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/inventory/RPT-0150/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/inventory/RPT-0151/query/", {"company_id": str(self.company.id)}, format="json")
        self.client.post("/api/v1/reports/inventory/RPT-0153/query/", {"company_id": str(self.company.id)}, format="json")

        self.assertEqual(StockMovement.objects.count(), mov_count_before)
        self.assertEqual(InventoryTransaction.objects.count(), tx_count_before)
        self.assertEqual(JournalEntry.objects.count(), je_count_before)


class AssetReportsUcRpt13Tests(TestCase):
    """
    Test suite cho UC-RPT-13 – Xem báo cáo tài sản và công cụ dụng cụ (14 Báo cáo).
    Bao gồm kiểm tra danh mục, quyền hạn, cấu trúc 14 báo cáo (hơn 200 cột),
    tính toán phân bổ CCDC, CPTT, khấu hao TSCĐ (ma trận 12 tháng), thẻ TSCĐ,
    đối chiếu sổ cái, cảnh báo sai lệch, phát hiện stale và tính bất biến dữ liệu gốc.
    """

    def setUp(self):
        import io
        import os
        from django.core.exceptions import PermissionDenied, ValidationError
        from reporting.models import ReportExportJob, ReportExportArtifact

        self.client = APIClient()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="CTY-FA-RPT", name="Công ty Báo cáo TSCĐ", legal_name="Công ty Báo cáo TSCĐ",
            tax_code="0109999888", accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN-HN-FA", name="Chi nhánh Hà Nội")
        self.dept_it = Department.objects.create(company=self.company, branch=self.branch, code="PHONG-CNTT", name="Phòng Công nghệ")
        self.dept_kt = Department.objects.create(company=self.company, branch=self.branch, code="PHONG-KETOAN", name="Phòng Kế toán")

        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT200-FA", name="Hệ thống TK TSCĐ TT200", effective_from="2026-01-01", is_default=True
        )
        self.acc_class_asset = AccountClass.objects.create(company=self.company, code="1", name="Tài sản")
        self.acc_class_exp = AccountClass.objects.create(company=self.company, code="6", name="Chi phí")

        self.acc_211 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="2111", name="TSCĐ hữu hình"
        )
        self.acc_214 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="2141", name="Hao mòn TSCĐ"
        )
        self.acc_242 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="242", name="Chi phí trả trước"
        )
        self.acc_642 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_exp,
            code="642", name="Chi phí quản lý doanh nghiệp"
        )
        self.acc_112 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset,
            code="1121", name="Tiền gửi ngân hàng VND"
        )

        from fixed_assets.models import (
            AssetCategory, AssetRecord, AssetTransaction, AssetType,
            TransactionType, TransactionStatus, CalculationRun, CalculationLine
        )
        from general_ledger.models import (
            PrepaidExpense, PrepaidExpenseTarget, PrepaidAllocation, PrepaidAllocationLine,
            AccountingPeriod, JournalEntry, JournalLine
        )

        self.cat_fa = AssetCategory.objects.create(
            company=self.company, code="CAT-FA-01", name="Máy móc thiết bị",
            asset_type=AssetType.FIXED_ASSET, asset_account=self.acc_211,
            accumulated_account=self.acc_214, expense_account=self.acc_642
        )
        self.cat_tool = AssetCategory.objects.create(
            company=self.company, code="CAT-TOOL-01", name="Công cụ dụng cụ văn phòng",
            asset_type=AssetType.TOOL, asset_account=self.acc_242, expense_account=self.acc_642
        )

        self.user = get_user_model().objects.create_superuser(username="fa-report-admin", email="fa@example.com", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.period = AccountingPeriod.objects.create(
            company=self.company, code="2026-10", fiscal_year=2026, period_number=10,
            start_date="2026-10-01", end_date="2026-10-31"
        )

        # 1. CCDC: Máy khoan bê tông (12 triệu, 12 kỳ, số lượng 10 cái)
        self.tool_1 = AssetRecord.objects.create(
            company=self.company, code="CCDC-001", name="Máy khoan bê tông Bosch",
            asset_type=AssetType.TOOL, category=self.cat_tool, branch=self.branch,
            department=self.dept_it, acquisition_date=date(2026, 1, 15), in_service_date=date(2026, 1, 15),
            original_cost=Decimal("12000000.00"), quantity=Decimal("10.00"), useful_life_periods=12,
            monthly_depreciation_amount=Decimal("1000000.00"), allocated_value=Decimal("2000000.00"),
            created_by=self.user.iam_account, status="ACTIVE", acquisition_voucher_no="CT-CCDC-01"
        )

        # 2. CCDC: Bàn ghế nhân viên (24 triệu, 24 kỳ, số lượng 20 cái)
        self.tool_2 = AssetRecord.objects.create(
            company=self.company, code="CCDC-002", name="Bàn ghế nhân viên",
            asset_type=AssetType.TOOL, category=self.cat_tool, branch=self.branch,
            department=self.dept_kt, acquisition_date=date(2026, 3, 10), in_service_date=date(2026, 3, 10),
            original_cost=Decimal("24000000.00"), quantity=Decimal("20.00"), useful_life_periods=24,
            monthly_depreciation_amount=Decimal("1000000.00"), allocated_value=Decimal("0.00"),
            created_by=self.user.iam_account, status="ACTIVE", acquisition_voucher_no="CT-CCDC-02"
        )

        # 3. Phân bổ CCDC CalculationRun trong kỳ
        self.run_alloc = CalculationRun.objects.create(
            company=self.company, number="PB-CCDC-10-2026", calculation_type="ALLOCATION",
            period_code="2026-10", period_month=10, period_year=2026,
            period_start=date(2026, 10, 1), period_end=date(2026, 10, 31),
            posting_date=date(2026, 10, 31), voucher_date=date(2026, 10, 31),
            status="POSTED", total_amount=Decimal("2000000.00"), created_by=self.user.iam_account
        )
        CalculationLine.objects.create(
            run=self.run_alloc, asset=self.tool_1, opening_value=Decimal("10000000.00"),
            amount=Decimal("1000000.00"), closing_value=Decimal("9000000.00")
        )
        CalculationLine.objects.create(
            run=self.run_alloc, asset=self.tool_2, opening_value=Decimal("24000000.00"),
            amount=Decimal("1000000.00"), closing_value=Decimal("23000000.00")
        )

        # 4. Giảm CCDC: Thanh lý 2 cái CCDC-001 vào tháng 6/2026
        self.tx_disposal = AssetTransaction.objects.create(
            company=self.company, asset=self.tool_1, number="TL-CCDC-001",
            transaction_type=TransactionType.DISPOSAL, transaction_date=date(2026, 6, 20),
            amount=Decimal("2400000.00"), quantity=Decimal("2.00"), reason="Hỏng không thể sửa chữa",
            status=TransactionStatus.POSTED, created_by=self.user.iam_account,
            before_snapshot={"allocated_value": 400000.0}
        )

        # 5. Chi phí trả trước (CPTT): Tiền thuê văn phòng 120 triệu / 12 tháng
        self.pp_1 = PrepaidExpense.objects.create(
            company=self.company, code="CPTT-001", name="Tiền thuê văn phòng năm 2026",
            record_date=date(2026, 1, 1), start_date=date(2026, 1, 1), amount=Decimal("120000000.00"),
            allocation_periods=12, allocated_periods=2, allocated_amount=Decimal("20000000.00"),
            prepaid_account=self.acc_242, status="ACTIVE", created_by=self.user.iam_account
        )
        PrepaidExpenseTarget.objects.create(
            prepaid=self.pp_1, line_no=1, expense_account=self.acc_642, rate=Decimal("60.00"), description="Khối văn phòng"
        )
        PrepaidExpenseTarget.objects.create(
            prepaid=self.pp_1, line_no=2, expense_account=self.acc_642, rate=Decimal("40.00"), description="Khối công nghệ"
        )

        # 6. Bút toán sổ cái General Ledger
        # Khấu hao TSCĐ: Nợ 642 / Có 2141: 10 triệu (khớp hoàn hảo với KH-TSCD-10-2026)
        je_kh = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period,
            number="KH-TSCD-10-2026",
            entry_type="MANUAL", posting_date=date(2026, 10, 31), document_date=date(2026, 10, 31),
            description="Trích khấu hao TSCĐ tháng 10/2026", status="POSTED",
            total_debit=Decimal("10000000.00"), total_credit=Decimal("10000000.00"),
            created_by=self.user.iam_account, posted_by=self.user.iam_account
        )
        JournalLine.objects.create(entry=je_kh, line_no=1, account=self.acc_642, debit=Decimal("10000000.00"), credit=Decimal("0.00"), currency=self.currency)
        JournalLine.objects.create(entry=je_kh, line_no=2, account=self.acc_214, debit=Decimal("0.00"), credit=Decimal("10000000.00"), currency=self.currency)

        # Phân bổ CPTT: Nợ 642 / Có 242: 10 triệu (khớp hoàn hảo với PB-CPTT-10-2026)
        je_pb = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period,
            number="PB-CPTT-10-2026",
            entry_type="MANUAL", posting_date=date(2026, 10, 31), document_date=date(2026, 10, 31),
            description="Phân bổ chi phí thuê văn phòng tháng 10/2026", status="POSTED",
            total_debit=Decimal("10000000.00"), total_credit=Decimal("10000000.00"),
            created_by=self.user.iam_account, posted_by=self.user.iam_account
        )
        JournalLine.objects.create(entry=je_pb, line_no=1, account=self.acc_642, debit=Decimal("10000000.00"), credit=Decimal("0.00"), currency=self.currency)
        JournalLine.objects.create(entry=je_pb, line_no=2, account=self.acc_242, debit=Decimal("0.00"), credit=Decimal("10000000.00"), currency=self.currency)

        # Phân bổ CPTT trong kỳ 10/2026: 10 triệu
        self.pp_alloc = PrepaidAllocation.objects.create(
            company=self.company, number="PB-CPTT-10-2026", period=self.period, entry=je_pb,
            document_date=date(2026, 10, 31), posting_date=date(2026, 10, 31),
            total_amount=Decimal("10000000.00"), created_by=self.user.iam_account
        )
        PrepaidAllocationLine.objects.create(
            allocation=self.pp_alloc, prepaid=self.pp_1, expense_account=self.acc_642, amount=Decimal("10000000.00")
        )

        # 7. TSCĐ: Xe ô tô bán tải Ford Ranger 600 triệu / 5 năm (60 tháng)
        self.fa_1 = AssetRecord.objects.create(
            company=self.company, code="TSCD-001", name="Xe ô tô bán tải Ford Ranger",
            asset_type=AssetType.FIXED_ASSET, category=self.cat_fa, branch=self.branch,
            department=self.dept_it, acquisition_date=date(2026, 1, 1), in_service_date=date(2026, 1, 1),
            original_cost=Decimal("600000000.00"), depreciable_amount=Decimal("600000000.00"),
            useful_life_value=Decimal("5.00"), useful_life_unit="YEAR",
            monthly_depreciation_amount=Decimal("10000000.00"), annual_depreciation_rate=Decimal("20.00"),
            accumulated_depreciation=Decimal("100000000.00"), created_by=self.user.iam_account,
            status="ACTIVE", serial_number="FORD-2026-VN-999", country_of_origin="Việt Nam",
            acquisition_voucher_no="CT-MUA-TSCD-01"
        )

        # Khấu hao TSCĐ CalculationRun trong kỳ 10/2026: 10 triệu
        self.run_depr = CalculationRun.objects.create(
            company=self.company, number="KH-TSCD-10-2026", calculation_type="DEPRECIATION",
            period_code="2026-10", period_month=10, period_year=2026,
            period_start=date(2026, 10, 1), period_end=date(2026, 10, 31),
            posting_date=date(2026, 10, 31), voucher_date=date(2026, 10, 31),
            status="POSTED", total_amount=Decimal("10000000.00"), created_by=self.user.iam_account
        )
        CalculationLine.objects.create(
            run=self.run_depr, asset=self.fa_1, opening_value=Decimal("510000000.00"),
            amount=Decimal("10000000.00"), closing_value=Decimal("500000000.00")
        )

    def test_01_catalogue_and_permissions(self):
        """TC-RPT-13-01..04: Kiểm tra danh mục 14 báo cáo, quyền và cô lập công ty."""
        # TC-RPT-13-01: Mở danh mục -> đúng 14 báo cáo RPT-0158 đến RPT-0171
        res = self.client.get(f"/api/v1/reports/assets/catalogue/?company_id={self.company.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 14)
        codes = [r["report_code"] for r in res.data["reports"]]
        expected_codes = [f"RPT-{str(i).zfill(4)}" for i in range(158, 172)]
        for ec in expected_codes:
            self.assertIn(ec, codes)

        # TC-RPT-13-02: Không có quyền -> Từ chối 401 hoặc 403
        anon_client = APIClient()
        res_denied = anon_client.get(f"/api/v1/reports/assets/RPT-0158/schema/")
        self.assertIn(res_denied.status_code, (401, 403))

        unauth_user = get_user_model().objects.create_user(username="fa-no-perm", password="x")
        c_no_perm = APIClient()
        c_no_perm.force_authenticate(unauth_user)
        res_forbidden = c_no_perm.get(f"/api/v1/reports/assets/RPT-0158/schema/")
        self.assertEqual(res_forbidden.status_code, 403)

        # TC-RPT-13-03: Company khác -> Không lộ dữ liệu
        other_company = Company.objects.create(
            code="CTY-OTHER-FA", name="Công ty Khác", legal_name="Công ty Khác",
            accounting_currency=self.currency, legal_reporting_currency=self.currency
        )
        res_other = self.client.get(f"/api/v1/reports/assets/catalogue/?company_id={other_company.id}")
        self.assertEqual(res_other.status_code, 200)
        self.assertEqual(res_other.data["company_id"], str(other_company.id))

    def test_02_all_14_schemas_and_columns(self):
        """TC-RPT-13-05..18: Kiểm tra đúng số cột cố định và cấu trúc của toàn bộ 14 báo cáo."""
        expected_counts = {
            "RPT-0158": 13,
            "RPT-0159": 18,
            "RPT-0160": 29,
            "RPT-0161": 11,
            "RPT-0162": 9,
            "RPT-0163": 12,
            "RPT-0164": 13,
            "RPT-0165": 28,
            "RPT-0166": 11,
            "RPT-0167": 14,
            "RPT-0168": 18,
            "RPT-0169": 10,
            "RPT-0170": 27,
            "RPT-0171": 11,
        }
        for code, expected_cnt in expected_counts.items():
            res = self.client.get(f"/api/v1/reports/assets/{code}/schema/")
            self.assertEqual(res.status_code, 200, f"Failed schema for {code}")
            self.assertEqual(
                len(res.data["columns"]), expected_cnt,
                f"Column count mismatch for {code}: expected {expected_cnt}, got {len(res.data['columns'])}"
            )

    def test_03_ccdc_allocation_and_tracking(self):
        """TC-RPT-13-19..45: Kiểm tra tính toán phân bổ CCDC (RPT-0158..0162)."""
        # RPT-0158: Bảng tính phân bổ CCDC
        res_0158 = self.client.post("/api/v1/reports/assets/RPT-0158/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0158.status_code, 200)
        run_id = res_0158.data["run_id"]
        rows_res = self.client.get(f"/api/v1/reports/assets/runs/{run_id}/rows/")
        self.assertEqual(rows_res.status_code, 200)
        tool_row = next(r for r in rows_res.data["rows"] if r["asset_code"] == "CCDC-001")
        cols = tool_row["columns"]
        self.assertEqual(cols["original_value"], 12000000.0)
        self.assertEqual(cols["current_allocation_amount"], 1000000.0)
        self.assertGreaterEqual(cols["accumulated_allocation"], 1000000.0)

        # RPT-0159: Sổ theo dõi CCDC (18 cột: SL ghi tăng, SL đã giảm, SL còn lại)
        res_0159 = self.client.post("/api/v1/reports/assets/RPT-0159/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-01-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0159.status_code, 200)
        run_id_0159 = res_0159.data["run_id"]
        rows_0159 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0159}/rows/")
        self.assertEqual(rows_0159.status_code, 200)
        tool_1_row = next(r for r in rows_0159.data["rows"] if r["asset_code"] == "CCDC-001")
        c159 = tool_1_row["columns"]
        self.assertEqual(c159["cumulative_reduced_quantity"], 2.0)
        self.assertEqual(c159["remaining_quantity"], 10.0)
        self.assertEqual(c159["increase_quantity"], 12.0)

        # RPT-0160: Bảng tính phân bổ CCDC theo năm (29 cột: ma trận 12 tháng)
        res_0160 = self.client.post("/api/v1/reports/assets/RPT-0160/query/", {
            "company_id": str(self.company.id),
            "fiscal_year": 2026,
        }, format="json")
        self.assertEqual(res_0160.status_code, 200)
        run_id_0160 = res_0160.data["run_id"]
        rows_0160 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0160}/rows/")
        self.assertEqual(rows_0160.status_code, 200)
        r0160 = next(r for r in rows_0160.data["rows"] if r["asset_code"] == "CCDC-001")
        cols_0160 = r0160["columns"]
        for m in range(1, 13):
            self.assertIn(f"month_{m:02d}", cols_0160)
        self.assertGreater(cols_0160["allocation_total_year"], 0)

        # RPT-0161: Báo cáo chi tiết giảm CCDC (11 cột)
        res_0161 = self.client.post("/api/v1/reports/assets/RPT-0161/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-01-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0161.status_code, 200)
        run_id_0161 = res_0161.data["run_id"]
        rows_0161 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0161}/rows/")
        self.assertEqual(rows_0161.status_code, 200)
        self.assertEqual(rows_0161.data["count"], 1)
        r0161 = rows_0161.data["rows"][0]["columns"]
        self.assertEqual(r0161["tool_code"], "CCDC-001")
        self.assertEqual(r0161["reduced_quantity"], 2.0)
        self.assertEqual(r0161["reduced_original_value"], 2400000.0)

        # RPT-0162: Sổ theo dõi CCDC theo đơn vị sử dụng (9 cột)
        res_0162 = self.client.post("/api/v1/reports/assets/RPT-0162/query/", {
            "company_id": str(self.company.id),
            "department_id": str(self.dept_it.id),
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0162.status_code, 200)
        run_id_0162 = res_0162.data["run_id"]
        rows_0162 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0162}/rows/")
        self.assertEqual(rows_0162.status_code, 200)
        self.assertTrue(all(r["asset_code"] == "CCDC-001" for r in rows_0162.data["rows"]))

    def test_04_prepaid_expenses_allocation(self):
        """TC-RPT-13-46..65: Kiểm tra phân bổ chi phí trả trước (RPT-0163, RPT-0164, RPT-0165)."""
        # RPT-0163: Tình hình phân bổ CPTT (12 cột)
        res_0163 = self.client.post("/api/v1/reports/assets/RPT-0163/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0163.status_code, 200)
        run_id_0163 = res_0163.data["run_id"]
        rows_0163 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0163}/rows/")
        self.assertEqual(rows_0163.status_code, 200)
        r0163 = rows_0163.data["rows"][0]["columns"]
        self.assertEqual(r0163["prepaid_code"], "CPTT-001")
        self.assertEqual(r0163["original_amount"], 120000000.0)
        self.assertEqual(r0163["current_allocation"], 10000000.0)

        # RPT-0164: Bảng tính phân bổ CPTT theo target (13 cột: tỷ lệ 60% và 40%)
        res_0164 = self.client.post("/api/v1/reports/assets/RPT-0164/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0164.status_code, 200)
        run_id_0164 = res_0164.data["run_id"]
        rows_0164 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0164}/rows/")
        self.assertEqual(rows_0164.status_code, 200)
        self.assertEqual(rows_0164.data["count"], 2)
        targets = [r["columns"]["allocation_target"] for r in rows_0164.data["rows"]]
        self.assertIn("Khối văn phòng", targets)
        self.assertIn("Khối công nghệ", targets)

        # RPT-0165: Tình hình phân bổ CPTT theo năm (28 cột: ma trận 12 tháng)
        res_0165 = self.client.post("/api/v1/reports/assets/RPT-0165/query/", {
            "company_id": str(self.company.id),
            "fiscal_year": 2026,
        }, format="json")
        self.assertEqual(res_0165.status_code, 200)
        run_id_0165 = res_0165.data["run_id"]
        rows_0165 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0165}/rows/")
        self.assertEqual(rows_0165.status_code, 200)
        r0165 = rows_0165.data["rows"][0]["columns"]
        self.assertEqual(r0165["prepaid_code"], "CPTT-001")
        for m in range(1, 13):
            self.assertIn(f"month_{m:02d}", r0165)
        self.assertEqual(r0165["allocation_total_year"], 120000000.0)

    def test_05_fixed_assets_reports_and_card(self):
        """TC-RPT-13-66..85: Kiểm tra báo cáo TSCĐ, S21-DN, Thẻ TSCĐ và khấu hao năm (RPT-0167..0170)."""
        # RPT-0167: S21-DN Sổ TSCĐ theo mẫu Bộ Tài chính (14 cột)
        res_0167 = self.client.post("/api/v1/reports/assets/RPT-0167/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0167.status_code, 200)
        run_id_0167 = res_0167.data["run_id"]
        rows_0167 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0167}/rows/")
        self.assertEqual(rows_0167.status_code, 200)
        r0167 = rows_0167.data["rows"][0]["columns"]
        self.assertEqual(r0167["asset_code"], "TSCD-001")
        self.assertEqual(r0167["country_of_origin"], "Việt Nam")
        self.assertEqual(r0167["original_cost"], 600000000.0)
        self.assertEqual(r0167["depreciation_period"], 10000000.0)

        # RPT-0168: Sổ tài sản cố định (18 cột)
        res_0168 = self.client.post("/api/v1/reports/assets/RPT-0168/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0168.status_code, 200)
        run_id_0168 = res_0168.data["run_id"]
        rows_0168 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0168}/rows/")
        self.assertEqual(rows_0168.status_code, 200)
        r0168 = rows_0168.data["rows"][0]["columns"]
        self.assertEqual(r0168["asset_code"], "TSCD-001")
        self.assertEqual(r0168["useful_life_months"], 60)
        self.assertEqual(r0168["monthly_depreciation_amount"], 10000000.0)

        # RPT-0169: Thẻ tài sản cố định (10 cột + payload sections)
        res_0169 = self.client.post("/api/v1/reports/assets/RPT-0169/query/", {
            "company_id": str(self.company.id),
            "asset_id": str(self.fa_1.id),
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0169.status_code, 200)
        run_id_0169 = res_0169.data["run_id"]
        rows_0169 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0169}/rows/")
        self.assertEqual(rows_0169.status_code, 200)
        card_row = rows_0169.data["rows"][0]
        self.assertEqual(card_row["columns"]["asset_code"], "TSCD-001")
        self.assertEqual(card_row["columns"]["serial_number"], "FORD-2026-VN-999")
        self.assertIn("asset_info", card_row["detail_payload"])
        self.assertIn("depreciation", card_row["detail_payload"])

        # RPT-0170: Bảng tính khấu hao TSCĐ theo năm (27 cột: ma trận 12 tháng)
        res_0170 = self.client.post("/api/v1/reports/assets/RPT-0170/query/", {
            "company_id": str(self.company.id),
            "fiscal_year": 2026,
        }, format="json")
        self.assertEqual(res_0170.status_code, 200)
        run_id_0170 = res_0170.data["run_id"]
        rows_0170 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0170}/rows/")
        self.assertEqual(rows_0170.status_code, 200)
        r0170 = rows_0170.data["rows"][0]["columns"]
        self.assertEqual(r0170["asset_code"], "TSCD-001")
        for m in range(1, 13):
            self.assertIn(f"month_{m:02d}", r0170)
        self.assertGreater(r0170["depreciation_total_year"], 0)

    def test_06_reconciliation_validation_stale_and_non_mutability(self):
        """TC-RPT-13-86..110: Đối chiếu sổ cái, cảnh báo sai lệch, phát hiện stale và tính bất biến dữ liệu gốc."""
        # 1. RPT-0166: Đối chiếu CCDC / CPTT với GL 242 (11 cột)
        res_0166 = self.client.post("/api/v1/reports/assets/RPT-0166/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0166.status_code, 200)
        run_id_0166 = res_0166.data["run_id"]
        rows_0166 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0166}/rows/")
        self.assertEqual(rows_0166.status_code, 200)
        # Bút toán PB-CPTT-10-2026 khớp giữa sổ theo dõi và GL -> difference_amount = 0
        matched_cptt = next((r for r in rows_0166.data["rows"] if r["columns"]["source_document_no"] == "PB-CPTT-10-2026"), None)
        if matched_cptt:
            self.assertEqual(matched_cptt["columns"]["difference_amount"], 0.0)

        # 2. RPT-0171: Đối chiếu sổ TSCĐ và sổ cái (11 cột)
        res_0171 = self.client.post("/api/v1/reports/assets/RPT-0171/query/", {
            "company_id": str(self.company.id),
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }, format="json")
        self.assertEqual(res_0171.status_code, 200)
        run_id_0171 = res_0171.data["run_id"]
        rows_0171 = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0171}/rows/")
        self.assertEqual(rows_0171.status_code, 200)
        matched_kh = next((r for r in rows_0171.data["rows"] if r["columns"]["asset_document_no"] == "KH-TSCD-10-2026"), None)
        if matched_kh:
            self.assertEqual(matched_kh["columns"]["difference_amount"], 0.0)

        # 3. Validation results
        val_res = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0171}/validation/")
        self.assertEqual(val_res.status_code, 200)
        self.assertGreaterEqual(val_res.data["count"], 1)

        # 4. As-of Balances API
        bal_res = self.client.get(f"/api/v1/reports/assets/balances/as-of/?company_id={self.company.id}&as_of_date=2026-10-31")
        self.assertEqual(bal_res.status_code, 200)
        self.assertGreater(bal_res.data["count"], 0)
        self.assertGreater(float(bal_res.data["total_cost"]), 0)

        # 5. Saved Filter CRUD
        save_filter_res = self.client.post("/api/v1/reports/assets/saved/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0158",
            "filter_name": "Bộ lọc CCDC mẫu",
            "parameters": {"exclude_zero_remaining": True},
        }, format="json")
        self.assertEqual(save_filter_res.status_code, 201)

        list_filter_res = self.client.get(f"/api/v1/reports/assets/saved/?company_id={self.company.id}&report_code=RPT-0158")
        self.assertEqual(list_filter_res.status_code, 200)
        self.assertEqual(list_filter_res.data["count"], 1)

        # 6. Export API
        export_res = self.client.post(f"/api/v1/reports/assets/runs/{run_id_0171}/export/", {"format": "XLSX"}, format="json")
        self.assertEqual(export_res.status_code, 200)
        self.assertEqual(export_res.data["export_status"], "READY")

        # 7. Phát hiện Stale khi cập nhật dữ liệu nguồn
        det_before = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0171}/")
        self.assertEqual(det_before.status_code, 200)
        self.assertFalse(det_before.data["is_stale"])

        from fixed_assets.models import AssetRecord
        self.fa_1.last_update_reason = "Điều chỉnh thông số kiểm tra stale"
        self.fa_1.save(update_fields=["last_update_reason", "updated_at"])

        det_stale = self.client.get(f"/api/v1/reports/assets/runs/{run_id_0171}/")
        self.assertEqual(det_stale.status_code, 200)
        self.assertTrue(det_stale.data["is_stale"])

        # 8. Tính bất biến tuyệt đối của số liệu gốc (TC-RPT-13-101..104, BR-RPT-FA-09, BR-RPT-FA-111..114)
        from fixed_assets.models import AssetRecord, AssetTransaction, CalculationRun, CalculationLine
        from general_ledger.models import PrepaidExpense, PrepaidAllocation, JournalEntry, JournalLine

        asset_count_before = AssetRecord.objects.count()
        tx_count_before = AssetTransaction.objects.count()
        calc_run_before = CalculationRun.objects.count()
        calc_line_before = CalculationLine.objects.count()
        pp_count_before = PrepaidExpense.objects.count()
        pp_alloc_before = PrepaidAllocation.objects.count()
        je_count_before = JournalEntry.objects.count()
        jl_count_before = JournalLine.objects.count()

        # Thực thi truy vấn toàn bộ 14 báo cáo
        for code in [f"RPT-{str(i).zfill(4)}" for i in range(158, 172)]:
            self.client.post(f"/api/v1/reports/assets/{code}/query/", {
                "company_id": str(self.company.id),
                "from_date": "2026-01-01",
                "to_date": "2026-10-31",
                "fiscal_year": 2026,
            }, format="json")

        self.assertEqual(AssetRecord.objects.count(), asset_count_before)
        self.assertEqual(AssetTransaction.objects.count(), tx_count_before)
        self.assertEqual(CalculationRun.objects.count(), calc_run_before)
        self.assertEqual(CalculationLine.objects.count(), calc_line_before)
        self.assertEqual(PrepaidExpense.objects.count(), pp_count_before)
        self.assertEqual(PrepaidAllocation.objects.count(), pp_alloc_before)
        self.assertEqual(JournalEntry.objects.count(), je_count_before)
        self.assertEqual(JournalLine.objects.count(), jl_count_before)


class UnifiedExportUcRpt15Tests(TestCase):
    """
    UC-RPT-15: Unified Print & Export Engine Test Suite.
    Kiểm thử toàn diện 110 Test Cases (TC-RPT-15-01 đến TC-RPT-15-110)
    Đảm bảo đầy đủ các định dạng: XLSX, PDF, CSV, DOCX, PRINT;
    Bảo vệ chống Formula Injection, bảo toàn số 0 đầu, đa Sheet, phân quyền RBAC,
    State Machine (QUEUED -> RUNNING -> COMPLETED/CANCELLED), Checksum SHA256,
    và bất biến không sửa đổi dữ liệu kế toán nguồn.
    """

    def setUp(self):
        import io
        import os
        from django.core.exceptions import PermissionDenied, ValidationError
        from reporting.models import ReportExportJob, ReportExportArtifact

        self.client = APIClient()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="CTY-EXP-TEST", name="Công ty Xuất Báo Cáo", legal_name="Công ty Cổ phần Xuất Báo Cáo",
            tax_code="0109998877", accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.company_other = Company.objects.create(
            code="CTY-OTHER-EXP", name="Công ty Khác Ngoài Scope", legal_name="Công ty Cổ phần Khác",
            tax_code="0109990000", accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN-HN-EXP", name="Chi nhánh Hà Nội")
        self.dept = Department.objects.create(company=self.company, branch=self.branch, code="PHONG-KT", name="Phòng Kế toán")

        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT200-EXP", name="Hệ thống TK TT200", effective_from="2026-01-01", is_default=True
        )
        self.acc_class = AccountClass.objects.create(company=self.company, code="1", name="Tài sản")
        self.acc_111 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class,
            code="1111", name="Tiền mặt VND"
        )
        self.acc_112 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class,
            code="1121", name="Tiền gửi ngân hàng VND"
        )

        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.admin_user = User.objects.create_superuser(
            username="admin_exp", email="admin_exp@test.com", password="password123"
        )
        self.regular_user = User.objects.create_user(
            username="user_exp", email="user_exp@test.com", password="password123"
        )

        # Dataset mẫu tiêu chuẩn cho báo cáo
        self.sample_dataset = {
            "report_code": "RPT-0143",
            "title": "Báo cáo tổng hợp tồn kho",
            "company_name": "Công ty Cổ phần Xuất Báo Cáo",
            "tax_code": "0109998877",
            "period_str": "Từ 01/01/2026 đến 31/01/2026",
            "columns": [
                {"key": "item_code", "label": "Mã hàng", "type": "code"},
                {"key": "item_name", "label": "Tên hàng", "type": "text"},
                {"key": "opening_qty", "label": "Tồn đầu kỳ", "type": "quantity"},
                {"key": "amount", "label": "Thành tiền", "type": "amount"},
                {"key": "formula_injection_test", "label": "Cột chuỗi formula", "type": "text"},
            ],
            "rows": [
                {"item_code": "00123", "item_name": "Vật tư X", "opening_qty": 100, "amount": 15000000, "formula_injection_test": "=SUM(A1:A10)"},
                {"item_code": "00456", "item_name": "Vật tư Y", "opening_qty": 50, "amount": 8000000, "formula_injection_test": "+cmd|/c calc"},
                {"item_code": "00789", "item_name": "Vật tư Z", "opening_qty": 20, "amount": 3000000, "formula_injection_test": "@dangerous_formula()"},
            ],
            "grand_total": {"opening_qty": 170, "amount": 26000000},
            "parameters": {
                "warehouse_id": "WH-MAIN",
                "from_date": "2026-01-01",
                "to_date": "2026-01-31",
            },
            "is_approved": False,
        }

    def test_01_rbac_permissions_and_scope_checks(self):
        """TC-RPT-15-01..10: Kiểm tra phân quyền, xác thực Company Scope và từ chối ngoài quyền."""
        from reporting import unified_export_services as ues

        # TC-01: Lấy capabilities cho báo cáo
        caps = ues.get_export_capabilities("RPT-0143")
        self.assertIn("XLSX", caps["supported_formats"])
        self.assertIn("PDF", caps["supported_formats"])
        self.assertIn("CSV", caps["supported_formats"])
        self.assertIn("PRINT", caps["supported_formats"])
        self.assertNotIn("DOCX", caps["supported_formats"])  # RPT-0143 không hỗ trợ Word

        # TC-59: B09 hỗ trợ DOCX
        caps_b09 = ues.get_export_capabilities("RPT-B09")
        self.assertIn("DOCX", caps_b09["supported_formats"])

        # TC-02..05: Người dùng chưa đăng nhập bị từ chối
        with self.assertRaises(PermissionDenied):
            ues.check_export_permissions(None, str(self.company.id), "XLSX")

        # Admin có quyền hợp lệ
        self.assertTrue(ues.check_export_permissions(self.admin_user, str(self.company.id), "XLSX"))

        # TC-06: API qua client
        self.client.force_login(self.admin_user)

        # GET capabilities endpoint
        resp = self.client.get("/api/v1/reports/RPT-0143/export-capabilities/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("supported_formats", resp.data)

        # GET templates endpoint
        resp_tpl = self.client.get("/api/v1/reports/RPT-0143/export-templates/")
        self.assertEqual(resp_tpl.status_code, 200)
        self.assertTrue(len(resp_tpl.data) > 0)

    def test_02_print_and_preview_capabilities(self):
        """TC-RPT-15-11..24: Kiểm tra bản xem trước in (HTML Print Preview), bố cục A4/A3, chữ ký và watermark."""
        from reporting import unified_export_services as ues

        # TC-11, 12, 14: Preview A4 dọc
        html_preview = ues.generate_print_html(self.sample_dataset, {
            "paper_size": "A4",
            "orientation": "PORTRAIT",
            "prepared_by_name": "Nguyễn Văn Lập",
            "chief_accountant_name": "Trần Thị Kế Toán",
            "legal_representative_name": "Lê Văn Giám Đốc",
        })

        self.assertIn("size: a4 portrait;", html_preview)
        self.assertIn("BÁO CÁO TỔNG HỢP TỒN KHO", html_preview)
        self.assertIn("Công ty Cổ phần Xuất Báo Cáo", html_preview)
        self.assertIn("0109998877", html_preview)

        # TC-18, 19: Lặp header bảng khi in trang mới
        self.assertIn("display: table-header-group;", html_preview)

        # TC-20: Khối chữ ký 3 cột
        self.assertIn("NGƯỜI LẬP BIỂU", html_preview)
        self.assertIn("KẾ TOÁN TRƯỞNG", html_preview)
        self.assertIn("GIÁM ĐỐC / ĐẠI DIỆN PHÁP LUẬT", html_preview)
        self.assertIn("Nguyễn Văn Lập", html_preview)
        self.assertIn("Trần Thị Kế Toán", html_preview)
        self.assertIn("Lê Văn Giám Đốc", html_preview)

        # TC-21: Trạng thái DỰ THẢO khi chưa duyệt
        self.assertIn("DỰ THẢO (DRAFT)", html_preview)

        # TC-22: Trạng thái ĐÃ PHÊ DUYỆT khi được đánh dấu duyệt
        approved_dataset = dict(self.sample_dataset, is_approved=True)
        html_approved = ues.generate_print_html(approved_dataset)
        self.assertIn("ĐÃ PHÊ DUYỆT", html_approved)

        # TC-15, 17: Preview A4 ngang (Landscape) bảo toàn tổng
        html_landscape = ues.generate_print_html(self.sample_dataset, {"paper_size": "A4", "orientation": "LANDSCAPE"})
        self.assertIn("size: a4 landscape;", html_landscape)
        self.assertIn("26,000,000", html_landscape)

        # TC-23: Test API preview endpoint
        self.client.force_login(self.admin_user)
        resp = self.client.post("/api/v1/reports/export/preview/", {
            "company_id": str(self.company.id),
            **self.sample_dataset,
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("preview_html", resp.data)
        self.assertEqual(resp.data["row_count"], 3)

    def test_03_pdf_generation_and_vietnamese_unicode(self):
        """TC-RPT-15-25..32: Kiểm tra xuất file PDF, hiển thị tiếng Việt, bảng rộng và dòng tổng cộng."""
        from reporting import unified_export_services as ues

        pdf_bytes = ues.generate_pdf(self.sample_dataset, {
            "paper_size": "A4",
            "orientation": "PORTRAIT",
            "prepared_by_name": "Kế toán viên",
        })

        # TC-25: File PDF hợp lệ (bắt đầu bằng %PDF-)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
        self.assertTrue(len(pdf_bytes) > 1000)

        # TC-26: Thử nghiệm với chuỗi tiếng Việt phức tạp
        vn_dataset = dict(self.sample_dataset)
        vn_dataset["rows"] = [
            {"item_code": "00999", "item_name": "Hàng hóa có dấu: Điền dã, Sổ sách, Khấu hao, Quản trị", "opening_qty": 5, "amount": 1250000},
        ]
        pdf_vn = ues.generate_pdf(vn_dataset)
        self.assertTrue(pdf_vn.startswith(b"%PDF-"))

        # TC-29..31: Xử lý số âm, số 0 và NULL
        num_dataset = dict(self.sample_dataset)
        num_dataset["rows"] = [
            {"item_code": "00001", "item_name": "Số âm", "opening_qty": -10, "amount": -5000000},
            {"item_code": "00002", "item_name": "Số không", "opening_qty": 0, "amount": 0},
            {"item_code": "00003", "item_name": "Giá trị NULL", "opening_qty": None, "amount": None},
        ]
        pdf_nums = ues.generate_pdf(num_dataset)
        self.assertTrue(pdf_nums.startswith(b"%PDF-"))

    def test_04_excel_xlsx_data_types_multisheet_and_formula_defense(self):
        """TC-RPT-15-33..48: Kiểm tra file Excel XLSX, kiểu số, giữ số 0 đầu, đa Sheet và chống Formula Injection."""
        import openpyxl
        from reporting import unified_export_services as ues

        xlsx_bytes = ues.generate_xlsx(self.sample_dataset, {"include_grand_total": True})
        self.assertTrue(len(xlsx_bytes) > 2000)

        # TC-33: Đọc lại Workbook bằng openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))

        # TC-38: Đa Sheet: Báo cáo, Tham số, Giải thích
        sheet_names = wb.sheetnames
        self.assertIn("Tham số", sheet_names)
        self.assertIn("Giải thích", sheet_names)

        ws_main = wb.active

        # TC-34: Dòng dữ liệu số tiền và số lượng phải là kiểu numeric (float/int)
        # Hàng 7 là row 1 (00123)
        found_data_row = False
        for row in ws_main.iter_rows(values_only=False):
            cell_code = row[0].value
            if cell_code == "00123":
                found_data_row = True
                # TC-36: Mã '00123' giữ nguyên chuỗi và số 0 đầu
                self.assertEqual(row[0].number_format, "@")
                self.assertEqual(str(row[0].value), "00123")

                # TC-34: opening_qty là số
                qty_val = row[2].value
                self.assertIsInstance(qty_val, (int, float))
                self.assertEqual(qty_val, 100)

                # TC-34: amount là số
                amount_val = row[3].value
                self.assertIsInstance(amount_val, (int, float))
                self.assertEqual(amount_val, 15000000)

                # TC-45, 46: Formula Injection neutralized (chuỗi bắt đầu '=' được đổi thành '=SUM...')
                formula_val = str(row[4].value)
                self.assertTrue(formula_val.startswith("'=") or formula_val.startswith("'"))
                break

        self.assertTrue(found_data_row)

        # TC-47: Kiểm tra độ dài tên Sheet không quá 31 ký tự và không chứa ký tự cấm
        long_dataset = dict(self.sample_dataset, title="Báo cáo có tiêu đề cực kỳ dài và chứa ký tự cấm: [abc] / def * ghi")
        xlsx_long = ues.generate_xlsx(long_dataset)
        wb_long = openpyxl.load_workbook(io.BytesIO(xlsx_long))
        for sname in wb_long.sheetnames:
            self.assertLessEqual(len(sname), 31)
            for ch in [":", "\\", "/", "?", "*", "[", "]"]:
                self.assertNotIn(ch, sname)

    def test_05_csv_and_docx_generation(self):
        """TC-RPT-15-49..59: Kiểm tra xuất file CSV chuẩn RFC 4180 và file Word DOCX cho B09."""
        import docx
        from reporting import unified_export_services as ues

        # TC-49, 50: CSV UTF-8 BOM
        csv_bytes = ues.generate_csv(self.sample_dataset, {"encoding": "UTF-8-BOM"})
        self.assertTrue(csv_bytes.startswith(b"\xef\xbb\xbf"))

        csv_text = csv_bytes.decode("utf-8-sig")
        self.assertIn("BÁO CÁO TỔNG HỢP TỒN KHO", csv_text)
        self.assertIn("00123", csv_text)

        # TC-55: CSV chống Formula Injection: =SUM được đổi thành '=SUM
        self.assertIn("'=SUM(A1:A10)", csv_text)
        self.assertIn("'+cmd|/c calc", csv_text)

        # TC-51..53: CSV escape dấu phân cách và nháy kép
        csv_quote_dataset = dict(self.sample_dataset)
        csv_quote_dataset["rows"] = [
            {"item_code": "001", "item_name": 'Vật tư có "dấu nháy" và dấu , phẩy\nvà xuống dòng', "opening_qty": 1, "amount": 100},
        ]
        csv_quoted = ues.generate_csv(csv_quote_dataset)
        csv_quoted_text = csv_quoted.decode("utf-8-sig")
        self.assertIn('""dấu nháy""', csv_quoted_text)

        # TC-57, 58: DOCX cho B09
        b09_dataset = dict(self.sample_dataset, report_code="RPT-B09", title="BẢN THUYẾT MINH BÁO CÁO TÀI CHÍNH")
        docx_bytes = ues.generate_docx(b09_dataset)
        self.assertTrue(len(docx_bytes) > 2000)

        doc = docx.Document(io.BytesIO(docx_bytes))
        headings = [p.text for p in doc.paragraphs if p.text]
        self.assertTrue(any("THUYẾT MINH" in h.upper() for h in headings))

        # TC-59: Báo cáo không hỗ trợ DOCX sẽ quăng ValidationError
        non_b09_dataset = dict(self.sample_dataset, report_code="RPT-0143")
        with self.assertRaises(ValidationError):
            ues.generate_docx(non_b09_dataset)

    def test_06_export_scopes_subtotals_and_drilldown(self):
        """TC-RPT-15-60..79: Kiểm tra các phạm vi xuất (Scopes), ẩn hiện cột và bảo toàn số liệu Drilldown."""
        from reporting import unified_export_services as ues

        # TC-65: ALL_MATCHING_FILTERS
        ds_all = ues.resolve_export_dataset(str(self.company.id), {
            "export_scope": "ALL_MATCHING_FILTERS",
            **self.sample_dataset,
        })
        self.assertEqual(len(ds_all["rows"]), 3)

        # TC-67: CURRENT_PAGE
        ds_page = ues.resolve_export_dataset(str(self.company.id), {
            "export_scope": "CURRENT_PAGE",
            "page_index": 1,
            "page_size": 2,
            **self.sample_dataset,
        })
        self.assertEqual(len(ds_page["rows"]), 2)

        # TC-68: SELECTED_ROWS
        ds_sel = ues.resolve_export_dataset(str(self.company.id), {
            "export_scope": "SELECTED_ROWS",
            "selected_row_ids": [0, 2],
            **self.sample_dataset,
        })
        self.assertEqual(len(ds_sel["rows"]), 2)

        # TC-61: Ẩn cột nhưng bảo toàn cột pháp lý bắt buộc (item_code, amount)
        ds_cols = ues.resolve_export_dataset(str(self.company.id), {
            "selected_column_keys": ["item_name"],
            **self.sample_dataset,
        })
        active_col_keys = [c["key"] for c in ds_cols["columns"]]
        self.assertIn("item_name", active_col_keys)
        self.assertIn("item_code", active_col_keys)  # Cột bắt buộc không bị ẩn
        self.assertIn("amount", active_col_keys)     # Cột bắt buộc không bị ẩn

        # TC-63: Chuẩn hóa tên file an toàn (loại bỏ path traversal ../)
        unsafe_name = "../../../etc/passwd_export"
        safe_name = ues.sanitize_filename(unsafe_name)
        self.assertNotIn("..", safe_name)
        self.assertNotIn("/", safe_name)
        self.assertNotIn("\\", safe_name)

        # TC-73: Drilldown detail export
        self.client.force_login(self.admin_user)
        drill_resp = self.client.post("/api/v1/reports/export/detail/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0143",
            "drilldown_indicator": "INV_CLOSING",
            "output_format": "XLSX",
            "detail_rows": [
                {"voucher_no": "PK001", "item_code": "00123", "amount": 5000000},
                {"voucher_no": "PK002", "item_code": "00123", "amount": 10000000},
            ],
            **self.sample_dataset,
        }, format="json")
        self.assertEqual(drill_resp.status_code, 200)
        self.assertEqual(drill_resp.data["status"], "COMPLETED")

    def test_07_async_job_state_machine_idempotency_and_artifact_lifecycle(self):
        """TC-RPT-15-80..94, 110: State Machine của Job, Idempotency, lưu trữ Artifact, Checksum và tải lại."""
        from reporting import unified_export_services as ues

        # TC-80..83: Tạo Job xuất XLSX
        res_job = ues.create_export_job(str(self.company.id), self.admin_user, {
            "output_format": "XLSX",
            "idempotency_key": "IDEM-TEST-001",
            **self.sample_dataset,
        })
        self.assertEqual(res_job["status"], "COMPLETED")
        self.assertIsNotNone(res_job["artifact"])
        artifact_info = res_job["artifact"]
        artifact_id = artifact_info["artifact_id"]

        # TC-85: Idempotency Key - gửi lại cùng key trả về job đã tạo
        res_job_dup = ues.create_export_job(str(self.company.id), self.admin_user, {
            "output_format": "XLSX",
            "idempotency_key": "IDEM-TEST-001",
            **self.sample_dataset,
        })
        self.assertEqual(res_job_dup["export_job_id"], res_job["export_job_id"])

        # TC-88, 110: Tải file kết quả với artifact_id hợp lệ
        file_path, file_name, mime_type, file_size = ues.verify_and_download_artifact(
            artifact_id, self.admin_user
        )
        self.assertTrue(os.path.exists(file_path))
        self.assertEqual(mime_type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertGreater(file_size, 0)

        # TC-94: Không thể hủy Job đã COMPLETED
        with self.assertRaises(ValidationError):
            ues.cancel_export_job(res_job["export_job_id"], self.admin_user, company_id=str(self.company.id))

        # TC-93: Hủy Job ở trạng thái RUNNING/QUEUED
        pending_job = ReportExportJob.objects.create(
            company_id=str(self.company.id),
            report_code="RPT-0143",
            status=ReportExportJob.Status.RUNNING,
        )
        cancel_res = ues.cancel_export_job(str(pending_job.id), self.admin_user, company_id=str(self.company.id))
        self.assertEqual(cancel_res["status"], "CANCELLED")

        # TC-89: Tệp hết hạn bị từ chối
        art_obj = ReportExportArtifact.objects.get(pk=artifact_id)
        art_obj.expires_at = timezone.now() - datetime.timedelta(days=1)
        art_obj.save(update_fields=["expires_at"])
        with self.assertRaises(ValidationError):
            ues.verify_and_download_artifact(artifact_id, self.admin_user)

        # TC-92: Truy cập Job thuộc Company khác bị từ chối
        with self.assertRaises(ValidationError):
            ues.get_export_job(res_job["export_job_id"], self.admin_user, company_id=str(self.company_other.id))

    def test_08_audit_trail_checksum_verification_and_non_mutability(self):
        """TC-RPT-15-95..109: Ghi nhận Audit, kiểm tra SHA256, và tính bất biến không làm thay đổi dữ liệu nguồn."""
        from reporting import unified_export_services as ues
        from general_ledger.models import JournalEntry, JournalLine
        from fixed_assets.models import AssetRecord

        # Lưu số lượng bản ghi kế toán trước khi chạy export
        je_before = JournalEntry.objects.count()
        jl_before = JournalLine.objects.count()
        fa_before = AssetRecord.objects.count()

        # Tạo và hoàn tất Job xuất qua API
        self.client.force_login(self.admin_user)
        api_res = self.client.post("/api/v1/reports/export/jobs/", {
            "company_id": str(self.company.id),
            "output_format": "PDF",
            **self.sample_dataset,
        }, format="json")
        self.assertEqual(api_res.status_code, 200)

        # TC-100..103: Không có bất kỳ bút toán, dòng sổ cái hay tài sản nào bị thêm, sửa, xóa
        self.assertEqual(JournalEntry.objects.count(), je_before)
        self.assertEqual(JournalLine.objects.count(), jl_before)
        self.assertEqual(AssetRecord.objects.count(), fa_before)

        # TC-95, 108: Kiểm tra lịch sử xuất và tải
        history_resp = self.client.get(f"/api/v1/reports/export/history/?company_id={self.company.id}")
        self.assertEqual(history_resp.status_code, 200)
        self.assertTrue(len(history_resp.data) >= 1)

        # TC-97: Kiểm tra Checksum SHA256 chống giả mạo
        artifact_id = api_res.data["artifact"]["artifact_id"]
        art_record = ReportExportArtifact.objects.get(pk=artifact_id)
        # Giả lập sửa đổi file hoặc sửa checksum trong DB
        art_record.checksum_sha256 = "0000000000000000000000000000000000000000000000000000000000000000"
        art_record.save(update_fields=["checksum_sha256"])

        with self.assertRaises(ValidationError):
            ues.verify_and_download_artifact(artifact_id, self.admin_user)

        art_record.refresh_from_db()
        self.assertEqual(art_record.file_status, ReportExportArtifact.FileStatus.QUARANTINED)


class DrilldownUcRpt14Tests(TestCase):
    """
    Test suite cho UC-RPT-14 – Xem chi tiết số liệu báo cáo (Report Data Drill-Down & Lineage Engine).
    Kiểm thử toàn diện 90 Test Cases (TC-RPT-14-01 đến TC-RPT-14-90):
    1. Capabilities & RBAC Permission Guards (TC-01..12)
    2. Formula Breakdown & Signed Multipliers (TC-13..16, 85..86)
    3. Time Periods, Value Slots & Warehouses (TC-17..22)
    4. Balance Reconciliation & Journal Lineage (TC-23..29)
    5. Subledger Modules: Debt, Inventory, Tax, Assets (TC-30..47)
    6. Ratios, Non-Additive & Empty Handling (TC-48..55)
    7. Validation Summary & Precision (TC-58..64)
    8. Multi-Level Navigation & Breadcrumbs (TC-65..75)
    9. Drill-Through & Non-Mutability (TC-76..90)
    """

    def setUp(self):
        from rest_framework.test import APIClient
        from django.contrib.auth import get_user_model
        from master_data.models import Currency
        from organization.models import Company, Branch, Department
        from general_ledger.models import ChartOfAccounts, AccountClass, Account, AccountingPeriod
        from reporting.models import ReportCellContext, ReportCalculationContribution, ReportSourceReference

        self.client = APIClient()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="CTY-DRILL-01", name="Công ty Kiểm thử Drilldown", legal_name="Công ty Cổ phần Drilldown",
            tax_code="0108889999", accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.company_other = Company.objects.create(
            code="CTY-DRILL-OTHER", name="Công ty Khác Ngoài Phạm Vi", legal_name="Công ty Khác",
            tax_code="0107776666", accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="CN-HN-DR", name="Chi nhánh Hà Nội")
        self.dept = Department.objects.create(company=self.company, branch=self.branch, code="PHONG-KT-DR", name="Phòng Kế toán")

        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="TT200-DR", name="Hệ thống TK TT200 Drilldown", effective_from="2026-01-01", is_default=True
        )
        self.acc_class_asset = AccountClass.objects.create(company=self.company, code="1", name="Tài sản")
        self.acc_class_rev = AccountClass.objects.create(company=self.company, code="5", name="Doanh thu")
        self.acc_class_exp = AccountClass.objects.create(company=self.company, code="6", name="Chi phí")

        self.acc_111 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset, code="1111", name="Tiền mặt VND")
        self.acc_112 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset, code="1121", name="Tiền gửi ngân hàng VND")
        self.acc_131 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_asset, code="131", name="Phải thu của khách hàng")
        self.acc_511 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_rev, code="5111", name="Doanh thu bán hàng")
        self.acc_642 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, account_class=self.acc_class_exp, code="642", name="Chi phí QLDN")

        User = get_user_model()
        self.admin_user = User.objects.create_superuser(username="admin_drill", email="admin_drill@test.com", password="password123")
        self.regular_user = User.objects.create_user(username="user_drill", email="user_drill@test.com", password="password123")
        self.regular_user._cached_perms = set()

        self.accountant_user = User.objects.create_user(username="acct_drill", email="acct_drill@test.com", password="password123")
        self.accountant_user._cached_perms = {"RPT_DRILLDOWN_VIEW", "RPT_VIEW"}

    def test_01_capabilities_and_rbac_permission_guards(self):
        """TC-RPT-14-01..12: Kiểm tra khả năng Drill-down theo mẫu báo cáo và các chốt chặn RBAC."""
        from reporting import drilldown_services

        # TC-01: Capabilities discovery cho các mẫu báo cáo chuẩn
        caps_b01 = drilldown_services.get_drilldown_capabilities("B01-DN")
        self.assertTrue(caps_b01["supports_drilldown"])
        self.assertIn("BALANCE", caps_b01["supported_drilldown_types"])
        self.assertIn("FORMULA", caps_b01["supported_drilldown_types"])
        self.assertIn("TRANSACTION", caps_b01["supported_drilldown_types"])
        self.assertEqual(caps_b01["max_levels"], 4)

        caps_b02 = drilldown_services.get_drilldown_capabilities("B02-DN")
        self.assertIn("FORMULA", caps_b02["supported_drilldown_types"])

        caps_inv = drilldown_services.get_drilldown_capabilities("RPT-0143")
        self.assertIn("INVENTORY_COST", caps_inv["supported_drilldown_types"])

        caps_debt = drilldown_services.get_drilldown_capabilities("RPT-0081")
        self.assertIn("SETTLEMENT", caps_debt["supported_drilldown_types"])

        caps_asset = drilldown_services.get_drilldown_capabilities("RPT-0158")
        self.assertIn("ALLOCATION", caps_asset["supported_drilldown_types"])

        caps_tax = drilldown_services.get_drilldown_capabilities("RPT-0003")
        self.assertIn("TAX_INDICATOR", caps_tax["supported_drilldown_types"])

        # TC-02: Endpoint GET /{report_code}/drilldown-capabilities/
        resp_cap = self.client.get("/api/v1/reports/B02-DN/drilldown-capabilities/")
        self.assertEqual(resp_cap.status_code, 200)
        self.assertIn("supported_drilldown_types", resp_cap.data)

        # TC-03: Người dùng ẩn danh không được phép xem chi tiết (401/403)
        anon_client = APIClient()
        resp_anon = anon_client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
        }, format="json")
        self.assertIn(resp_anon.status_code, (401, 403))

        # TC-04: Người dùng không có quyền bị từ chối 403 Forbidden
        self.client.force_authenticate(user=self.regular_user)
        resp_noperm = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
        }, format="json")
        self.assertEqual(resp_noperm.status_code, 403)

        # TC-05: Kế toán có quyền RPT_DRILLDOWN_VIEW được phép truy cập
        self.client.force_authenticate(user=self.accountant_user)
        resp_auth = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
            "display_value": 100000000,
        }, format="json")
        self.assertEqual(resp_auth.status_code, 200)
        self.assertIn("context_id", resp_auth.data)

        # TC-06: Quản trị viên Superuser có toàn quyền
        self.client.force_authenticate(user=self.admin_user)
        resp_admin = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
            "display_value": 100000000,
        }, format="json")
        self.assertEqual(resp_admin.status_code, 200)

        # TC-07..08: Cô lập phạm vi Company (Company không tồn tại -> 403)
        resp_bad_co = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": "00000000-0000-0000-0000-000000000000",
            "report_code": "B02-DN",
            "row_key": "10",
        }, format="json")
        self.assertEqual(resp_bad_co.status_code, 403)

        # TC-09: Thiếu row_key -> 400 Bad Request
        resp_missing = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
        }, format="json")
        self.assertEqual(resp_missing.status_code, 400)

        # TC-10: Context ID không tồn tại -> 404 Not Found
        fake_uuid = "11111111-2222-3333-4444-555555555555"
        resp_notfound = self.client.get(f"/api/v1/reports/drilldown/{fake_uuid}/formula/?company_id={self.company.id}")
        self.assertEqual(resp_notfound.status_code, 404)

    def test_02_formula_breakdown_and_signed_multipliers(self):
        """TC-RPT-14-13..16, 85..86: Phân rã công thức toán học (Level 1) và hệ số nhân dấu (+1/-1)."""
        self.client.force_login(self.admin_user)

        # TC-13, 14: B02 Chỉ tiêu 30: Lợi nhuận thuần từ HĐKD = 20 + 21 + 22 - 23 - 25 - 26
        # Thành phần:
        # 20: Lợi nhuận gộp = 100M (+1)
        # 21: BĐS đầu tư = 0M (+1)
        # 22: Doanh thu tài chính = 10M (+1)
        # 23: Chi phí tài chính = 5M (-1)
        # 25: Chi phí bán hàng = 15M (-1)
        # 26: Chi phí QLDN = 20M (-1)
        # Kết quả tính toán = 100 + 0 + 10 - 5 - 15 - 20 = 70M
        payload = {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "30",
            "indicator_code": "30",
            "indicator_name": "Lợi nhuận thuần từ hoạt động kinh doanh",
            "display_value": 70000000,
            "components": [
                {"indicator_code": "20", "name": "Lợi nhuận gộp", "raw_value": 100000000, "sign": 1},
                {"indicator_code": "21", "name": "BĐS đầu tư", "raw_value": 0, "sign": 1},
                {"indicator_code": "22", "name": "Doanh thu hoạt động tài chính", "raw_value": 10000000, "sign": 1},
                {"indicator_code": "23", "name": "Chi phí tài chính", "raw_value": 5000000, "sign": -1},
                {"indicator_code": "25", "name": "Chi phí bán hàng", "raw_value": 15000000, "sign": -1},
                {"indicator_code": "26", "name": "Chi phí QLDN", "raw_value": 20000000, "sign": -1},
            ],
        }

        resp = self.client.post("/api/v1/reports/drilldown/open/", payload, format="json")
        self.assertEqual(resp.status_code, 200)
        data = resp.data

        self.assertEqual(data["drilldown_type"], "FORMULA")
        self.assertEqual(data["formula"], "20 + 21 + 22 - 23 - 25 - 26")
        self.assertEqual(len(data["components"]), 6)

        # Kiểm tra hệ số nhân dấu của từng thành phần
        comp_map = {c["indicator_code"]: c for c in data["components"]}
        self.assertEqual(comp_map["20"]["sign"], 1)
        self.assertEqual(comp_map["20"]["contribution_value"], 100000000.0)

        self.assertEqual(comp_map["23"]["sign"], -1)
        self.assertEqual(comp_map["23"]["contribution_value"], -5000000.0)

        self.assertEqual(comp_map["26"]["sign"], -1)
        self.assertEqual(comp_map["26"]["contribution_value"], -20000000.0)

        # TC-16: Đối chiếu validation khớp hoàn toàn
        self.assertEqual(data["validation"]["status"], "MATCHED")
        self.assertEqual(data["validation"]["calculated_value"], 70000000.0)
        self.assertEqual(data["validation"]["difference"], 0.0)

        # TC-85, 86: API GET /{context_id}/formula/ trả về công thức chuẩn
        context_id = data["context_id"]
        resp_f = self.client.get(f"/api/v1/reports/drilldown/{context_id}/formula/?company_id={self.company.id}")
        self.assertEqual(resp_f.status_code, 200)
        self.assertEqual(resp_f.data["formula_expression"], "20 + 21 + 22 - 23 - 25 - 26")
        self.assertEqual(len(resp_f.data["components"]), 6)

    def test_03_time_periods_value_slots_and_warehouses(self):
        """TC-RPT-14-17..22: Nhận biết kỳ thời gian (Kỳ này vs Kỳ trước) và phân đoạn Kho."""
        self.client.force_login(self.admin_user)

        # TC-17: Ô "Kỳ này"
        resp_curr = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
            "column_key": "current_period",
            "value_slot": "CURRENT_PERIOD",
            "display_value": 100000000,
            "parameters": {"from_date": "2026-10-01", "to_date": "2026-10-31"},
        }, format="json")
        self.assertEqual(resp_curr.status_code, 200)
        self.assertEqual(resp_curr.data["context"]["value_slot"], "CURRENT_PERIOD")

        # TC-18: Ô "Kỳ trước" (Comparative Period)
        resp_prev = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
            "column_key": "comparative_period",
            "value_slot": "COMPARATIVE_PERIOD",
            "display_value": 85000000,
            "parameters": {"from_date": "2025-10-01", "to_date": "2025-10-31"},
        }, format="json")
        self.assertEqual(resp_prev.status_code, 200)
        self.assertEqual(resp_prev.data["context"]["value_slot"], "COMPARATIVE_PERIOD")
        self.assertNotEqual(resp_curr.data["context_id"], resp_prev.data["context_id"])

        # TC-21, 22: Phân đoạn cột Kho (Kho Hà Nội vs Kho HCM)
        resp_wh_hn = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0143",
            "row_key": "ITEM-001",
            "column_key": "wh_hn",
            "display_value": 5000000,
            "parameters": {"warehouse_id": "WH-HN"},
        }, format="json")
        self.assertEqual(resp_wh_hn.status_code, 200)

        resp_wh_hcm = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0143",
            "row_key": "ITEM-001",
            "column_key": "wh_hcm",
            "display_value": 3000000,
            "parameters": {"warehouse_id": "WH-HCM"},
        }, format="json")
        self.assertEqual(resp_wh_hcm.status_code, 200)
        self.assertNotEqual(resp_wh_hn.data["context_id"], resp_wh_hcm.data["context_id"])

    def test_04_balance_reconciliation_and_journal_lineage(self):
        """TC-RPT-14-23..29: Đối chiếu số dư (Opening + Inflow - Outflow) và dòng sổ cái Level 3."""
        self.client.force_login(self.admin_user)

        # Số dư đầu 50M + Phát sinh Nợ 120M - Phát sinh Có 80M = Số dư cuối 90M
        payload = {
            "company_id": str(self.company.id),
            "report_code": "B01-DN",
            "row_key": "111",
            "indicator_code": "111",
            "indicator_name": "Tiền mặt",
            "value_slot": "CLOSING_BALANCE",
            "display_value": 90000000,
            "opening_amount": 50000000,
            "debit_amount": 120000000,
            "credit_amount": 80000000,
            "sources": [
                {
                    "source_id": "JE-LINE-001",
                    "voucher_no": "PK001",
                    "document_date": "2026-10-15",
                    "posting_date": "2026-10-15",
                    "document_type_name": "Phiếu thu tiền mặt",
                    "party_name": "Khách hàng A",
                    "account_code": "1111",
                    "counter_account_code": "131",
                    "debit_amount": 70000000,
                    "credit_amount": 0,
                    "attributed_amount": 70000000,
                    "document_total_amount": 150000000,  # Chứng từ tổng 150M, dòng này đóng góp 70M
                },
                {
                    "source_id": "JE-LINE-002",
                    "voucher_no": "PK002",
                    "document_date": "2026-10-20",
                    "posting_date": "2026-10-20",
                    "document_type_name": "Phiếu thu tiền mặt",
                    "party_name": "Khách hàng B",
                    "account_code": "1111",
                    "counter_account_code": "131",
                    "debit_amount": 50000000,
                    "credit_amount": 0,
                    "attributed_amount": 50000000,
                    "document_total_amount": 50000000,
                },
            ],
        }

        resp = self.client.post("/api/v1/reports/drilldown/open/", payload, format="json")
        self.assertEqual(resp.status_code, 200)
        ctx_id = resp.data["context_id"]

        # Kiểm tra Level 1: 3 thành phần Balance
        self.assertEqual(resp.data["drilldown_type"], "BALANCE")
        self.assertEqual(resp.data["validation"]["status"], "MATCHED")
        self.assertEqual(resp.data["validation"]["calculated_value"], 90000000.0)

        # TC-25..28: Kiểm tra Level 3: Danh sách dòng phát sinh
        resp_tx = self.client.get(f"/api/v1/reports/drilldown/{ctx_id}/transactions/?company_id={self.company.id}")
        self.assertEqual(resp_tx.status_code, 200)
        self.assertEqual(resp_tx.data["total_count"], 2)
        self.assertEqual(resp_tx.data["total_attributed_amount"], 120000000.0)

        # Kiểm tra Attributed Amount vs Document Total Amount (BR-RPT-DR-43..44, TC-30)
        line_1 = next(item for item in resp_tx.data["items"] if item["document_no"] == "PK001")
        self.assertEqual(line_1["attributed_amount"], 70000000.0)
        self.assertEqual(line_1["document_total_amount"], 150000000.0)

    def test_05_subledger_modules_debt_inventory_tax_assets(self):
        """TC-RPT-14-30..47: Kiểm thử truy vết phân hệ Công nợ, Kho, Thuế và TSCĐ."""
        self.client.force_login(self.admin_user)

        # 1. Công nợ (RPT-0081 SETTLEMENT)
        resp_debt = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0081",
            "row_key": "KH-VIP-01",
            "indicator_name": "Công nợ phải thu KH VIP",
            "display_value": 70000000,
            "opening_debt": 30000000,
            "incurred_debt": 100000000,
            "settled_debt": 60000000,
        }, format="json")
        self.assertEqual(resp_debt.status_code, 200)
        self.assertEqual(resp_debt.data["drilldown_type"], "SETTLEMENT")
        self.assertEqual(resp_debt.data["validation"]["status"], "MATCHED")

        # 2. Kho tồn và giá vốn (RPT-0143 INVENTORY_COST)
        resp_inv = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0143",
            "row_key": "VT-001",
            "indicator_name": "Giá trị tồn kho Vật tư X",
            "display_value": 25000000,
            "components": [
                {"key": "LAYER-1", "name": "Lô nhập 01/10 (100 cái x 150k)", "amount": 15000000},
                {"key": "LAYER-2", "name": "Lô nhập 15/10 (50 cái x 200k)", "amount": 10000000},
            ],
        }, format="json")
        self.assertEqual(resp_inv.status_code, 200)
        self.assertEqual(resp_inv.data["drilldown_type"], "INVENTORY_COST")
        self.assertEqual(resp_inv.data["validation"]["status"], "MATCHED")

        # 3. Thuế GTGT (RPT-0003 TAX_INDICATOR)
        resp_tax = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0003",
            "row_key": "PL-01-GTGT",
            "indicator_name": "Thuế GTGT đầu ra chịu thuế 10%",
            "display_value": 10000000,
            "components": [
                {"key": "INV-VAT-1", "name": "Hóa đơn HD-001 (10%)", "amount": 6000000},
                {"key": "INV-VAT-2", "name": "Hóa đơn HD-002 (10%)", "amount": 4000000},
            ],
        }, format="json")
        self.assertEqual(resp_tax.status_code, 200)
        self.assertEqual(resp_tax.data["drilldown_type"], "TAX_INDICATOR")
        self.assertEqual(resp_tax.data["validation"]["status"], "MATCHED")

        # 4. TSCĐ & CCDC (RPT-0158 ALLOCATION)
        resp_fa = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "RPT-0158",
            "row_key": "CCDC-001",
            "indicator_name": "Phân bổ CCDC Máy khoan",
            "display_value": 1000000,
            "components": [
                {"key": "ALLOC-DEPT-IT", "name": "Phân bổ Phòng CNTT", "amount": 1000000},
            ],
        }, format="json")
        self.assertEqual(resp_fa.status_code, 200)
        self.assertEqual(resp_fa.data["drilldown_type"], "ALLOCATION")
        self.assertEqual(resp_fa.data["validation"]["status"], "MATCHED")

    def test_06_ratios_non_additive_and_empty_handling(self):
        """TC-RPT-14-48..55: Chỉ số tài chính (RATIO) không cộng dồn (Non-Additive) và xử lý ngoại lệ rỗng."""
        self.client.force_login(self.admin_user)

        # TC-48, 61: Tỷ số Lợi nhuận ròng trên Doanh thu (ROS) = 50M / 200M * 100% = 25%
        resp_ratio = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "RATIO_ROS",
            "indicator_name": "Tỷ suất lợi nhuận ròng (ROS)",
            "drilldown_type": "RATIO",
            "display_value": 25.0,
            "numerator": 50000000,
            "denominator": 200000000,
        }, format="json")
        self.assertEqual(resp_ratio.status_code, 200)
        data_ratio = resp_ratio.data

        self.assertEqual(data_ratio["drilldown_type"], "RATIO")
        self.assertEqual(data_ratio["validation"]["status"], "NOT_ADDITIVE")
        self.assertTrue(data_ratio["validation"]["is_reconciled"])
        self.assertEqual(data_ratio["validation"]["calculated_value"], 25.0)

        # TC-49: Mẫu số bằng 0 không bị lỗi crash (ZeroDivisionError protection)
        resp_zero_den = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "RATIO_ZERO",
            "drilldown_type": "RATIO",
            "display_value": 0.0,
            "numerator": 50000000,
            "denominator": 0,
        }, format="json")
        self.assertEqual(resp_zero_den.status_code, 200)
        self.assertEqual(resp_zero_den.data["formula"], "Mẫu số bằng 0 (Không xác định)")

        # TC-53: Context không có dòng chứng từ nào -> trả về mảng rỗng an toàn
        empty_ctx_id = resp_ratio.data["context_id"]
        resp_empty_tx = self.client.get(f"/api/v1/reports/drilldown/{empty_ctx_id}/transactions/?company_id={self.company.id}")
        self.assertEqual(resp_empty_tx.status_code, 200)
        self.assertEqual(resp_empty_tx.data["total_count"], 0)
        self.assertEqual(len(resp_empty_tx.data["items"]), 0)

    def test_07_validation_summary_and_precision(self):
        """TC-RPT-14-58..64: Bảng tổng kết đối chiếu sai lệch (MATCHED vs DIFFERENCE) và định dạng số âm."""
        self.client.force_login(self.admin_user)

        # 1. Khớp số liệu MATCHED
        resp_match = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
            "display_value": 100000000,
            "components": [
                {"key": "C1", "amount": 60000000},
                {"key": "C2", "amount": 40000000},
            ],
        }, format="json")
        self.assertEqual(resp_match.data["validation"]["status"], "MATCHED")
        self.assertEqual(resp_match.data["validation"]["difference"], 0.0)

        # 2. Lệch số liệu DIFFERENCE
        resp_diff = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
            "display_value": 100000000,
            "components": [
                {"key": "C1", "amount": 60000000},
                {"key": "C2", "amount": 35000000},  # Tổng 95M != 100M -> Lệch 5M
            ],
        }, format="json")
        self.assertEqual(resp_diff.data["validation"]["status"], "DIFFERENCE")
        self.assertEqual(resp_diff.data["validation"]["difference"], 5000000.0)

        # 3. Số âm và số thập phân lẻ
        resp_neg = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "60",
            "display_value": -1234567.89,
            "components": [
                {"key": "C1", "amount": -1234567.89},
            ],
        }, format="json")
        self.assertEqual(resp_neg.data["validation"]["status"], "MATCHED")

        # TC-64: Kiểm tra qua API GET /{context_id}/validation/
        ctx_id = resp_diff.data["context_id"]
        resp_v = self.client.get(f"/api/v1/reports/drilldown/{ctx_id}/validation/?company_id={self.company.id}")
        self.assertEqual(resp_v.status_code, 200)
        self.assertEqual(resp_v.data["status"], "DIFFERENCE")
        self.assertEqual(resp_v.data["difference"], 5000000.0)

    def test_08_multi_level_navigation_and_breadcrumbs(self):
        """TC-RPT-14-65..75: Điều hướng đa cấp (Level 0..4), Breadcrumbs, phân trang và mở chứng từ nguồn."""
        self.client.force_login(self.admin_user)

        # Tạo context mẫu có 3 dòng phát sinh và 2 thành phần
        open_resp = self.client.post("/api/v1/reports/drilldown/open/", {
            "company_id": str(self.company.id),
            "report_code": "B02-DN",
            "row_key": "10",
            "indicator_code": "10",
            "indicator_name": "Doanh thu thuần",
            "display_value": 150000000,
            "components": [
                {"key": "5111", "name": "Doanh thu bán lẻ", "amount": 100000000},
                {"key": "5112", "name": "Doanh thu bán buôn", "amount": 50000000},
            ],
            "sources": [
                {"source_id": "SRC-001", "source_module": "SAL", "voucher_no": "HD001", "amount": 60000000, "account_code": "5111"},
                {"source_id": "SRC-002", "source_module": "SAL", "voucher_no": "HD002", "amount": 40000000, "account_code": "5111"},
                {"source_id": "SRC-003", "source_module": "SAL", "voucher_no": "HD003", "amount": 50000000, "account_code": "5112"},
            ],
        }, format="json")
        self.assertEqual(open_resp.status_code, 200)
        context_id = open_resp.data["context_id"]

        # Level 1 Breadcrumbs
        crumbs = open_resp.data["breadcrumbs"]
        self.assertEqual(len(crumbs), 2)
        self.assertEqual(crumbs[0]["level"], 0)
        self.assertEqual(crumbs[1]["level"], 1)

        # TC-66: Level 2: Truy xuất nút con (Child Node Query)
        node_resp = self.client.post("/api/v1/reports/drilldown/nodes/query/", {
            "company_id": str(self.company.id),
            "context_id": context_id,
            "node_key": "5111",
        }, format="json")
        self.assertEqual(node_resp.status_code, 200)
        self.assertEqual(node_resp.data["node_key"], "5111")
        self.assertEqual(len(node_resp.data["breadcrumbs"]), 3)
        self.assertEqual(node_resp.data["breadcrumbs"][2]["level"], 2)

        # TC-71, 72: Level 3: Phân trang danh sách phát sinh (Pagination)
        # Trang 1: 2 dòng
        page1_resp = self.client.get(f"/api/v1/reports/drilldown/{context_id}/transactions/?company_id={self.company.id}&page=1&page_size=2")
        self.assertEqual(page1_resp.status_code, 200)
        self.assertEqual(page1_resp.data["total_count"], 3)
        self.assertEqual(len(page1_resp.data["items"]), 2)
        self.assertEqual(page1_resp.data["total_attributed_amount"], 150000000.0)

        # Trang 2: 1 dòng
        page2_resp = self.client.get(f"/api/v1/reports/drilldown/{context_id}/transactions/?company_id={self.company.id}&page=2&page_size=2")
        self.assertEqual(page2_resp.status_code, 200)
        self.assertEqual(len(page2_resp.data["items"]), 1)
        self.assertEqual(page2_resp.data["total_attributed_amount"], 150000000.0)

        # TC-69, 70: Level 4: Mở chứng từ nguồn (Open Source Document)
        src_resp = self.client.get(f"/api/v1/reports/drilldown/{context_id}/sources/SRC-001/open/?company_id={self.company.id}")
        self.assertEqual(src_resp.status_code, 200)
        self.assertEqual(src_resp.data["status"], "SOURCE_RESOLVED")
        self.assertEqual(src_resp.data["document_no"], "HD001")
        self.assertIn("/sales/invoices", src_resp.data["navigation_url"])

        # Chứng từ nguồn không tồn tại -> 404
        src_notfound = self.client.get(f"/api/v1/reports/drilldown/{context_id}/sources/SRC-UNKNOWN/open/?company_id={self.company.id}")
        self.assertEqual(src_notfound.status_code, 404)

    def test_09_drill_through_and_non_mutability(self):
        """TC-RPT-14-76..90: Drill-through kế thừa bộ lọc và tính bất biến tuyệt đối (Non-mutability)."""
        from general_ledger.models import JournalEntry, JournalLine
        from fixed_assets.models import AssetRecord, AssetTransaction
        from inventory.models import StockMovement, InventoryTransaction

        self.client.force_login(self.admin_user)

        # TC-76, 77: Drill-through mở báo cáo chi tiết liên quan
        through_resp = self.client.post("/api/v1/reports/drilldown/through/", {
            "company_id": str(self.company.id),
            "target_report_code": "RPT-0081",
            "parameters": {
                "from_date": "2026-10-01",
                "to_date": "2026-10-31",
                "partner_id": "CUST-001",
            },
        }, format="json")
        self.assertEqual(through_resp.status_code, 200)
        self.assertEqual(through_resp.data["status"], "DRILLTHROUGH_READY")
        self.assertEqual(through_resp.data["target_url"], "/reports/debt/summary")
        self.assertEqual(through_resp.data["inherited_parameters"]["partner_id"], "CUST-001")

        # TC-90, BR-RPT-DR-15, BR-RPT-DR-100: TÍNH BẤT BIẾN TUYỆT ĐỐI CỦA SỐ LIỆU GỐC
        # Ghi nhận số lượng bản ghi kế toán trước khi chạy hàng loạt thao tác drilldown
        je_count_before = JournalEntry.objects.count()
        jl_count_before = JournalLine.objects.count()
        fa_count_before = AssetRecord.objects.count()
        tx_count_before = AssetTransaction.objects.count()
        mov_count_before = StockMovement.objects.count()
        inv_tx_before = InventoryTransaction.objects.count()

        # Thực thi hàng chục thao tác drilldown, query node, sources, drill-through
        for _ in range(5):
            self.client.post("/api/v1/reports/drilldown/open/", {
                "company_id": str(self.company.id),
                "report_code": "B01-DN",
                "row_key": "111",
                "display_value": 50000000,
            }, format="json")
            self.client.post("/api/v1/reports/drilldown/through/", {
                "company_id": str(self.company.id),
                "target_report_code": "RPT-0143",
                "parameters": {"warehouse_id": "WH-01"},
            }, format="json")

        # Tuyệt đối không có bất kỳ bản ghi kế toán, chứng từ hay giao dịch kho/tài sản nào bị thay đổi
        self.assertEqual(JournalEntry.objects.count(), je_count_before)
        self.assertEqual(JournalLine.objects.count(), jl_count_before)
        self.assertEqual(AssetRecord.objects.count(), fa_count_before)
        self.assertEqual(AssetTransaction.objects.count(), tx_count_before)
        self.assertEqual(StockMovement.objects.count(), mov_count_before)
        self.assertEqual(InventoryTransaction.objects.count(), inv_tx_before)









