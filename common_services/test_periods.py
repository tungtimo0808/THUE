from datetime import date, timedelta
import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import (
    ActiveStatus,
    CompanyMembership,
    Permission,
    Role,
    RolePermission,
    UserAccount,
    UserRoleAssignment,
)
from master_data.models import Currency
from organization.models import Branch, Company, CompanyStatus

from .models import (
    FiscalPeriod,
    FiscalPeriodStatus,
    FiscalPeriodType,
    FiscalYear,
    FiscalYearStatus,
    FiscalYearType,
    PeriodStructure,
)
from .period_services import (
    activate_fiscal_year,
    change_period_status,
    check_posting_allowed,
    close_fiscal_year,
    copy_fiscal_year_structure,
    create_default_fiscal_year_for_company,
    create_fiscal_year,
    determine_period_for_date,
    generate_suggested_periods,
    update_fiscal_year_draft,
    update_period_metadata,
    validate_fiscal_year_and_periods,
)


class FiscalPeriodTests(TestCase):
    def setUp(self):
        cache.clear()
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.client = APIClient()

        # 1. Create active test company
        self.company = Company.objects.create(
            code="COMP_PERIOD_TEST",
            name="Công ty Kỳ kế toán Thử nghiệm",
            legal_name="Công ty Kỳ kế toán Thử nghiệm",
            tax_code="0109998888",
            business_type="LLC_ONE_MEMBER",
            accounting_currency=currency,
            legal_reporting_currency=currency,
            status=CompanyStatus.ACTIVE,
        )

        # 2. Create Admin Auth User and IAM UserAccount
        User = get_user_model()
        self.auth_admin = User.objects.create_user(
            username="period_admin_user",
            email="period_admin@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.admin_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_admin,
            defaults={"display_name": "Admin Kỳ kế toán"},
        )
        self.admin_membership = CompanyMembership.objects.create(
            company=self.company,
            user=self.admin_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )

        # 3. Create Admin Role with SYS.PERIOD permissions
        self.admin_role = Role.objects.create(
            company=self.company,
            code="PERIOD_ADMIN",
            name="Quản trị Kỳ kế toán",
            status="ACTIVE",
            is_system_admin=True,
            created_by=self.admin_account,
        )
        for p_code in ["SYS.PERIOD.VIEW", "SYS.PERIOD.CONFIGURE", "SYS.PERIOD.CLOSE"]:
            perm = Permission.objects.filter(code=p_code).first()
            if perm:
                RolePermission.objects.get_or_create(role=self.admin_role, permission=perm, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(
            company_membership=self.admin_membership,
            role=self.admin_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

        # 4. Create Viewer User with only VIEW permission
        self.auth_viewer = User.objects.create_user(
            username="period_viewer_user",
            email="period_viewer@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.viewer_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_viewer,
            defaults={"display_name": "Viewer Kỳ kế toán"},
        )
        self.viewer_membership = CompanyMembership.objects.create(
            company=self.company,
            user=self.viewer_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )
        self.viewer_role = Role.objects.create(
            company=self.company,
            code="PERIOD_VIEWER",
            name="Xem Kỳ kế toán",
            status="ACTIVE",
            created_by=self.admin_account,
        )
        v_perm = Permission.objects.filter(code="SYS.PERIOD.VIEW").first()
        if v_perm:
            RolePermission.objects.get_or_create(role=self.viewer_role, permission=v_perm, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(
            company_membership=self.viewer_membership,
            role=self.viewer_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

    def test_01_create_calendar_fiscal_year_draft(self):
        """Create CALENDAR_YEAR in DRAFT with 12 auto-generated monthly periods (Main Flow 2.1, AF-01, AF-04)."""
        self.client.force_authenticate(self.auth_admin)
        payload = {
            "company": str(self.company.id),
            "code": "FY2026",
            "name": "Năm tài chính 2026",
            "year_type": FiscalYearType.CALENDAR_YEAR,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "period_structure": PeriodStructure.MONTHLY,
            "has_adjustment_period": False,
            "notes": "Thiết lập đầu kỳ",
        }
        response = self.client.post("/api/v1/common/fiscal-years/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        data = response.data
        self.assertEqual(data["code"], "FY2026")
        self.assertEqual(data["status"], FiscalYearStatus.DRAFT)
        self.assertEqual(len(data["periods"]), 12)

        # Verify periods dates and sequence
        periods = data["periods"]
        self.assertEqual(periods[0]["code"], "FY2026-M01")
        self.assertEqual(periods[0]["start_date"], "2026-01-01")
        self.assertEqual(periods[0]["end_date"], "2026-01-31")
        self.assertEqual(periods[0]["status"], FiscalPeriodStatus.FUTURE)

        self.assertEqual(periods[11]["code"], "FY2026-M12")
        self.assertEqual(periods[11]["start_date"], "2026-12-01")
        self.assertEqual(periods[11]["end_date"], "2026-12-31")

        # Verify Audit Log
        audit = AuditLog.objects.filter(company=self.company, module_code="SYS", action_code="FISCAL_YEAR_CREATE").first()
        self.assertIsNotNone(audit)

    def test_02_duplicate_fiscal_year_code_rejected(self):
        """Fiscal year code must be unique in company (BR-PERIOD-03, EF-02)."""
        self.client.force_authenticate(self.auth_admin)
        create_fiscal_year(self.company, {
            "code": "FY_DUP", "name": "Năm 1",
            "start_date": date(2026, 1, 1), "end_date": date(2026, 12, 31),
        }, self.admin_account)

        response = self.client.post("/api/v1/common/fiscal-years/", {
            "company": str(self.company.id),
            "code": "FY_DUP",
            "name": "Năm 2",
            "start_date": "2027-01-01",
            "end_date": "2027-12-31",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("đã tồn tại", str(response.data))

    def test_03_end_date_before_start_date_rejected(self):
        """End date cannot be earlier than start date (BR-PERIOD-04, EF-03)."""
        self.client.force_authenticate(self.auth_admin)
        response = self.client.post("/api/v1/common/fiscal-years/", {
            "company": str(self.company.id),
            "code": "FY_INVALID_DATES",
            "name": "Sai ngày",
            "start_date": "2026-12-31",
            "end_date": "2026-01-01",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("nhỏ hơn ngày bắt đầu", str(response.data))

    def test_04_calendar_year_date_range_validation(self):
        """CALENDAR_YEAR must span exactly from 01/01 to 31/12 of the same year (EF-05)."""
        self.client.force_authenticate(self.auth_admin)
        # Attempt non-full-year dates for CALENDAR_YEAR
        response = self.client.post("/api/v1/common/fiscal-years/", {
            "company": str(self.company.id),
            "code": "FY_BAD_CALENDAR",
            "name": "Sai lịch",
            "year_type": FiscalYearType.CALENDAR_YEAR,
            "start_date": "2026-02-01",
            "end_date": "2026-12-31",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("CALENDAR_YEAR bắt buộc", str(response.data))

    def test_05_overlapping_fiscal_years_rejected(self):
        """Two fiscal years in same company cannot overlap (BR-PERIOD-05, EF-04)."""
        self.client.force_authenticate(self.auth_admin)
        create_fiscal_year(self.company, {
            "code": "FY2026_A",
            "name": "Năm 2026 A",
            "year_type": FiscalYearType.CALENDAR_YEAR,
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 12, 31),
        }, self.admin_account)

        # Attempt to create non-calendar year overlapping with FY2026_A (e.g. 2026-07-01 -> 2027-06-30)
        response = self.client.post("/api/v1/common/fiscal-years/", {
            "company": str(self.company.id),
            "code": "FY2026_OVERLAP",
            "name": "Năm chồng chéo",
            "year_type": FiscalYearType.NON_CALENDAR_YEAR,
            "start_date": "2026-07-01",
            "end_date": "2027-06-30",
            "period_structure": PeriodStructure.MONTHLY,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("chồng chéo", str(response.data))

    def test_06_period_gap_detection(self):
        """Gap between normal periods must be detected and rejected (BR-PERIOD-08, EF-08)."""
        periods_with_gap = [
            {
                "code": "P01", "name": "Kỳ 1", "period_number": 1,
                "start_date": date(2026, 1, 1), "end_date": date(2026, 1, 15),
                "period_type": FiscalPeriodType.CUSTOM,
            },
            {
                # Gap: 2026-01-16 to 2026-01-19 is missing
                "code": "P02", "name": "Kỳ 2", "period_number": 2,
                "start_date": date(2026, 1, 20), "end_date": date(2026, 1, 31),
                "period_type": FiscalPeriodType.CUSTOM,
            },
        ]
        with self.assertRaises(ValidationError) as ctx:
            validate_fiscal_year_and_periods(
                company=self.company,
                year_type=FiscalYearType.SHORT_YEAR,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 31),
                period_structure=PeriodStructure.CUSTOM,
                has_adjustment_period=False,
                periods_data=periods_with_gap,
            )
        self.assertIn("khoảng trống", str(ctx.exception))

    def test_07_period_overlap_detection(self):
        """Overlapping normal periods must be detected and rejected (BR-PERIOD-07, EF-07, EF-11)."""
        periods_overlapping = [
            {
                "code": "P01", "name": "Kỳ 1", "period_number": 1,
                "start_date": date(2026, 1, 1), "end_date": date(2026, 1, 20),
                "period_type": FiscalPeriodType.CUSTOM,
            },
            {
                # Overlap: 2026-01-18 is in both P01 and P02
                "code": "P02", "name": "Kỳ 2", "period_number": 2,
                "start_date": date(2026, 1, 18), "end_date": date(2026, 1, 31),
                "period_type": FiscalPeriodType.CUSTOM,
            },
        ]
        with self.assertRaises(ValidationError) as ctx:
            validate_fiscal_year_and_periods(
                company=self.company,
                year_type=FiscalYearType.SHORT_YEAR,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 31),
                period_structure=PeriodStructure.CUSTOM,
                has_adjustment_period=False,
                periods_data=periods_overlapping,
            )
        self.assertIn("chồng chéo", str(ctx.exception))

    def test_08_period_outside_fiscal_year_rejected(self):
        """Periods extending beyond fiscal year boundary are rejected (BR-PERIOD-06, EF-09)."""
        periods_out = [
            {
                "code": "P01", "name": "Kỳ 1", "period_number": 1,
                "start_date": date(2025, 12, 25), "end_date": date(2026, 1, 31),
                "period_type": FiscalPeriodType.CUSTOM,
            },
        ]
        with self.assertRaises(ValidationError) as ctx:
            validate_fiscal_year_and_periods(
                company=self.company,
                year_type=FiscalYearType.SHORT_YEAR,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 31),
                period_structure=PeriodStructure.CUSTOM,
                has_adjustment_period=False,
                periods_data=periods_out,
            )
        self.assertIn("hoàn toàn trong năm tài chính", str(ctx.exception))

    def test_09_preview_periods_api(self):
        """Preview API generates monthly and quarterly periods correctly without saving (Step 8, AF-04, AF-05)."""
        self.client.force_authenticate(self.auth_admin)
        # 1. Preview Monthly
        resp_m = self.client.post("/api/v1/common/fiscal-years/preview-periods/", {
            "year_type": FiscalYearType.CALENDAR_YEAR,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "period_structure": PeriodStructure.MONTHLY,
            "code_prefix": "FY2026",
        }, format="json")
        self.assertEqual(resp_m.status_code, 200)
        self.assertEqual(resp_m.data["total_periods"], 12)

        # 2. Preview Quarterly
        resp_q = self.client.post("/api/v1/common/fiscal-years/preview-periods/", {
            "year_type": FiscalYearType.CALENDAR_YEAR,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "period_structure": PeriodStructure.QUARTERLY,
            "code_prefix": "FY2026",
        }, format="json")
        self.assertEqual(resp_q.status_code, 200)
        self.assertEqual(resp_q.data["total_periods"], 4)
        q1 = resp_q.data["periods"][0]
        self.assertEqual(q1["code"], "FY2026-Q1")
        self.assertEqual(str(q1["start_date"]), "2026-01-01")
        self.assertEqual(str(q1["end_date"]), "2026-03-31")

    def test_10_quarterly_and_adjustment_periods(self):
        """Create quarterly fiscal year with adjustment period (AF-05, AF-07, BR-PERIOD-13, 15, 16)."""
        self.client.force_authenticate(self.auth_admin)
        payload = {
            "company": str(self.company.id),
            "code": "FY_Q_2026",
            "name": "Năm 2026 theo Quý",
            "year_type": FiscalYearType.CALENDAR_YEAR,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "period_structure": PeriodStructure.QUARTERLY,
            "has_adjustment_period": True,
        }
        resp = self.client.post("/api/v1/common/fiscal-years/", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        periods = resp.data["periods"]
        self.assertEqual(len(periods), 5)  # 4 quarters + 1 adjustment period
        adj_p = periods[4]
        self.assertEqual(adj_p["code"], "FY_Q_2026-ADJ")
        self.assertEqual(adj_p["period_type"], FiscalPeriodType.ADJUSTMENT)
        self.assertTrue(adj_p["allow_adjustment"])
        self.assertEqual(adj_p["period_number"], 5)

    def test_11_activate_fiscal_year_and_period_states(self):
        """Activating fiscal year transitions FY to ACTIVE; periods default to FUTURE (BR-PERIOD-17, Steps 15-25)."""
        self.client.force_authenticate(self.auth_admin)
        fy = create_fiscal_year(self.company, {
            "code": "FY_ACTIVATE_TEST",
            "name": "Năm kích hoạt",
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 12, 31),
        }, self.admin_account)
        self.assertEqual(fy.status, FiscalYearStatus.DRAFT)

        # Activate with open_first_period=True
        resp = self.client.post(f"/api/v1/common/fiscal-years/{fy.id}/activate/", {
            "open_first_period": True,
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        fy.refresh_from_db()
        self.assertEqual(fy.status, FiscalYearStatus.ACTIVE)

        periods = list(fy.periods.all().order_by("period_number"))
        self.assertEqual(periods[0].status, FiscalPeriodStatus.OPEN)  # First period is OPEN
        self.assertEqual(periods[1].status, FiscalPeriodStatus.FUTURE)  # Second period is FUTURE (BR-PERIOD-17)

    def test_12_copy_fiscal_year_structure(self):
        """Copying fiscal year duplicates structure into new draft year without copying balances or locks (AF-09, BR-PERIOD-46, 47)."""
        self.client.force_authenticate(self.auth_admin)
        fy2026 = create_fiscal_year(self.company, {
            "code": "FY2026_SRC",
            "name": "Năm 2026 nguồn",
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 12, 31),
            "period_structure": PeriodStructure.MONTHLY,
            "has_adjustment_period": True,
        }, self.admin_account)
        activate_fiscal_year(fy2026, self.admin_account)

        # Lock period 1 in 2026
        p1 = fy2026.periods.first()
        change_period_status(p1, FiscalPeriodStatus.LOCKED, self.admin_account)

        # Copy to 2027
        resp = self.client.post(f"/api/v1/common/fiscal-years/{fy2026.id}/copy/", {
            "code": "FY2027",
            "name": "Năm tài chính 2027",
            "start_date": "2027-01-01",
            "end_date": "2027-12-31",
        }, format="json")
        self.assertEqual(resp.status_code, 201)

        fy2027 = FiscalYear.objects.get(code="FY2027", company=self.company)
        self.assertEqual(fy2027.status, FiscalYearStatus.DRAFT)
        self.assertEqual(fy2027.periods.count(), 13)  # 12 months + 1 adjustment period
        # All copied periods MUST be FUTURE, NOT locked (BR-PERIOD-47)
        for p in fy2027.periods.all():
            self.assertEqual(p.status, FiscalPeriodStatus.FUTURE)

    def test_13_update_draft_vs_active_fiscal_year(self):
        """Draft fiscal year can be modified; active fiscal year cannot be modified (AF-11, BR-PERIOD-27)."""
        self.client.force_authenticate(self.auth_admin)
        fy_draft = create_fiscal_year(self.company, {
            "code": "FY_DRAFT_MOD",
            "name": "Tên cũ",
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 12, 31),
        }, self.admin_account)

        # Updating DRAFT succeeds
        resp_patch = self.client.patch(f"/api/v1/common/fiscal-years/{fy_draft.id}/", {
            "name": "Tên mới cập nhật",
        }, format="json")
        self.assertEqual(resp_patch.status_code, 200)
        self.assertEqual(resp_patch.data["name"], "Tên mới cập nhật")

        # Activate
        activate_fiscal_year(fy_draft, self.admin_account)

        # Attempt to update ACTIVE fails (BR-PERIOD-27)
        resp_patch_act = self.client.patch(f"/api/v1/common/fiscal-years/{fy_draft.id}/", {
            "name": "Đổi khi active",
        }, format="json")
        self.assertEqual(resp_patch_act.status_code, 400)
        self.assertIn("DRAFT", str(resp_patch_act.data))

    def test_14_delete_draft_vs_active_fiscal_year(self):
        """Only DRAFT fiscal years can be deleted; ACTIVE fiscal years cannot be hard deleted (BR-PERIOD-29)."""
        self.client.force_authenticate(self.auth_admin)
        fy_draft = create_fiscal_year(self.company, {
            "code": "FY_DEL_DRAFT", "name": "Draft del",
            "start_date": date(2026, 1, 1), "end_date": date(2026, 12, 31),
        }, self.admin_account)

        resp_del = self.client.delete(f"/api/v1/common/fiscal-years/{fy_draft.id}/")
        self.assertEqual(resp_del.status_code, 204)
        self.assertFalse(FiscalYear.objects.filter(pk=fy_draft.id).exists())

        # Test deleting an ACTIVE fiscal year
        fy_act = create_fiscal_year(self.company, {
            "code": "FY_DEL_ACT", "name": "Active del",
            "start_date": date(2026, 1, 1), "end_date": date(2026, 12, 31),
        }, self.admin_account)
        activate_fiscal_year(fy_act, self.admin_account)

        resp_del_act = self.client.delete(f"/api/v1/common/fiscal-years/{fy_act.id}/")
        self.assertEqual(resp_del_act.status_code, 400)
        self.assertIn("không được xóa cứng", str(resp_del_act.data))

    def test_15_determine_period_for_voucher_date(self):
        """Determine period API accurately maps voucher date to active period (Section 2.2, BR-PERIOD-24, 25, 41)."""
        self.client.force_authenticate(self.auth_admin)
        fy = create_fiscal_year(self.company, {
            "code": "FY2026_DET",
            "name": "Năm 2026 Tra cứu",
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 12, 31),
        }, self.admin_account)
        activate_fiscal_year(fy, self.admin_account)

        # Open period 3 (March)
        p3 = fy.periods.get(period_number=3)
        change_period_status(p3, FiscalPeriodStatus.OPEN, self.admin_account)

        # 1. Query March date: returns period 3 with is_open=True, can_post=True
        resp_mar = self.client.get(f"/api/v1/common/fiscal-periods/determine/?company_id={self.company.id}&date=2026-03-15")
        self.assertEqual(resp_mar.status_code, 200)
        self.assertEqual(resp_mar.data["period"]["code"], "FY2026_DET-M03")
        self.assertTrue(resp_mar.data["is_open"])
        self.assertTrue(resp_mar.data["can_post"])

        # 2. Query August date (period 8 is FUTURE): returns is_open=False, can_post=False, can_draft=True (BR-PERIOD-20, 26, AF-14)
        resp_aug = self.client.get(f"/api/v1/common/fiscal-periods/determine/?company_id={self.company.id}&date=2026-08-20")
        self.assertEqual(resp_aug.status_code, 200)
        self.assertFalse(resp_aug.data["is_open"])
        self.assertFalse(resp_aug.data["can_post"])
        self.assertTrue(resp_aug.data["can_draft"])

        # 3. Query unconfigured year date (e.g. 2030): rejected (EF-15)
        resp_unconf = self.client.get(f"/api/v1/common/fiscal-periods/determine/?company_id={self.company.id}&date=2030-05-01")
        self.assertEqual(resp_unconf.status_code, 400)
        self.assertIn("Không tìm thấy", str(resp_unconf.data))

    def test_16_period_status_transitions_and_locking(self):
        """Testing period status transitions, locking, and reopening reason requirement (BR-PERIOD-18..23, EF-16)."""
        self.client.force_authenticate(self.auth_admin)
        fy = create_fiscal_year(self.company, {
            "code": "FY_LOCK_TEST",
            "name": "Năm thử khóa",
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 12, 31),
        }, self.admin_account)
        activate_fiscal_year(fy, self.admin_account)
        period = fy.periods.get(period_number=1)

        # 1. Open period
        change_period_status(period, FiscalPeriodStatus.OPEN, self.admin_account)
        self.assertTrue(check_posting_allowed(period, self.admin_account))

        # 2. Lock period
        resp_lock = self.client.post(f"/api/v1/common/fiscal-periods/{period.id}/change-status/", {
            "status": FiscalPeriodStatus.LOCKED,
        }, format="json")
        self.assertEqual(resp_lock.status_code, 200)
        period.refresh_from_db()
        self.assertEqual(period.status, FiscalPeriodStatus.LOCKED)
        self.assertEqual(period.locked_by, self.admin_account)

        # check_posting_allowed must raise ValidationError (BR-PERIOD-22, EF-16)
        with self.assertRaises(ValidationError) as ctx:
            check_posting_allowed(period, self.admin_account)
        self.assertIn("LOCKED", str(ctx.exception))

        # 3. Reopening locked period without reason fails (BR-PERIOD-23)
        resp_reopen_fail = self.client.post(f"/api/v1/common/fiscal-periods/{period.id}/change-status/", {
            "status": FiscalPeriodStatus.OPEN,
            "reason": "",
        }, format="json")
        self.assertEqual(resp_reopen_fail.status_code, 400)
        self.assertIn("lý do", str(resp_reopen_fail.data))

        # 4. Reopening with reason succeeds (BR-PERIOD-23, 53)
        resp_reopen_ok = self.client.post(f"/api/v1/common/fiscal-periods/{period.id}/change-status/", {
            "status": FiscalPeriodStatus.OPEN,
            "reason": "Điều chỉnh theo biên bản kiểm toán",
        }, format="json")
        self.assertEqual(resp_reopen_ok.status_code, 200)
        period.refresh_from_db()
        self.assertEqual(period.status, FiscalPeriodStatus.OPEN)
        self.assertEqual(period.reopened_by, self.admin_account)
        self.assertEqual(period.reopen_reason, "Điều chỉnh theo biên bản kiểm toán")

    def test_17_starter_template_for_single_owner_company(self):
        """Bootstrap default fiscal year for simple enterprise (BR-PERIOD-44, 45)."""
        fy = create_default_fiscal_year_for_company(self.company, self.admin_account, year=2026)
        self.assertIsNotNone(fy)
        self.assertEqual(fy.status, FiscalYearStatus.ACTIVE)
        self.assertEqual(fy.periods.count(), 12)
        # Verify current period is OPEN
        open_periods = fy.periods.filter(status=FiscalPeriodStatus.OPEN)
        self.assertTrue(open_periods.exists())

    def test_18_permissions_enforcement(self):
        """Viewer without SYS.PERIOD.CONFIGURE cannot mutate fiscal years (EF-01, BR-PERIOD-02)."""
        self.client.force_authenticate(self.auth_viewer)
        # Viewer can GET list
        resp_get = self.client.get(f"/api/v1/common/fiscal-years/?company_id={self.company.id}")
        self.assertEqual(resp_get.status_code, 200)

        # Viewer CANNOT create
        resp_post = self.client.post("/api/v1/common/fiscal-years/", {
            "company": str(self.company.id),
            "code": "HACK_FY",
            "name": "Hack",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        }, format="json")
        self.assertEqual(resp_post.status_code, 403)
