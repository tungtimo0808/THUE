from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import Account, AccountClass, ChartOfAccounts
from master_data.models import Currency
from organization.models import Branch, Company, Department, Employee
from . import models, services
from .models import AssetCategory, AssetRecord, AssetStatus, AssetTransaction, AssetType


class FixedAssetApiTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="FACO", name="FA Co", legal_name="FA Company", tax_code="0100776655",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        self.branch2 = Branch.objects.create(company=self.company, code="HCM", name="Hồ Chí Minh")
        self.department = Department.objects.create(company=self.company, branch=self.branch, code="KT", name="Kế toán")
        self.department2 = Department.objects.create(company=self.company, branch=self.branch2, code="KD", name="Kinh doanh")
        self.employee = Employee.objects.create(company=self.company, branch=self.branch, department=self.department, employee_code="E01", full_name="Nguyễn Văn A")
        account_class = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.coa = chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="Hệ thống", effective_from=self.today, is_default=True)
        self.accounts = [
            Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code=code, name=name, account_type="ASSET", normal_balance="DEBIT")
            for code, name in (("211", "TSCĐ"), ("214", "Hao mòn"), ("642", "Chi phí"))
        ]
        self.expense_account = self.accounts[2]
        self.maker = get_user_model().objects.create_superuser(username="fa-maker", email="maker@fa.test", password="x")
        self.approver = get_user_model().objects.create_superuser(username="fa-approver", email="approver@fa.test", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.maker)
        self.query = f"?company_id={self.company.id}"
        self.fixed_category = self.create_category("TSCD", "TSCĐ", "FIXED_ASSET", 12)
        self.tool_category = self.create_category("CCDC", "CCDC", "TOOL", 6)

    def create_category(self, code, name, asset_type, periods):
        response = self.client.post(
            f"/api/v1/fixed-assets/categories/{self.query}",
            {
                "company": str(self.company.id), "code": code, "name": name, "asset_type": asset_type,
                "default_method": "STRAIGHT_LINE", "default_periods": periods,
                "asset_account": str(self.accounts[0].id), "accumulated_account": str(self.accounts[1].id),
                "expense_account": str(self.accounts[2].id),
            }, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def create_asset(self, code, asset_type, category, cost, periods):
        response = self.client.post(
            f"/api/v1/fixed-assets/assets/{self.query}",
            {
                "company": str(self.company.id), "code": code, "name": f"Tài sản {code}",
                "asset_type": asset_type, "category": category, "quantity": "1",
                "acquisition_date": str(self.today), "in_service_date": str(self.today),
                "original_cost": str(cost), "salvage_value": "0", "method": "STRAIGHT_LINE",
                "useful_life_periods": periods, "branch": str(self.branch.id),
                "department": str(self.department.id), "custodian": str(self.employee.id),
            }, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def create_and_post_transaction(self, asset, number, kind, amount, **extra):
        payload = {
            "company": str(self.company.id), "asset": asset, "number": number,
            "transaction_type": kind, "transaction_date": str(self.today), "amount": str(amount),
            "idempotency_key": f"KEY-{number}", **extra,
        }
        response = self.client.post(f"/api/v1/fixed-assets/transactions/{self.query}", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        transaction_id = response.data["id"]
        self.client.post(f"/api/v1/fixed-assets/transactions/{transaction_id}/submit/{self.query}", {}, format="json")
        self.client.force_authenticate(self.approver)
        approved = self.client.post(f"/api/v1/fixed-assets/transactions/{transaction_id}/approve/{self.query}", {"comment": "Duyệt"}, format="json")
        self.assertEqual(approved.data["status"], "APPROVED", approved.data)
        posted = self.client.post(f"/api/v1/fixed-assets/transactions/{transaction_id}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.client.force_authenticate(self.maker)
        return transaction_id

    def test_fixed_asset_acquisition_depreciation_and_gl(self):
        asset_id = self.create_asset("FA001", "FIXED_ASSET", self.fixed_category, 1200, 12)
        acquisition = self.create_and_post_transaction(asset_id, "GT-001", "ACQUISITION", 1200)
        asset = AssetRecord.objects.get(pk=asset_id)
        self.assertEqual(asset.status, "ACTIVE")
        run = self.client.post(
            f"/api/v1/fixed-assets/calculations/{self.query}",
            {
                "company": str(self.company.id), "number": "KH-2026-09", "calculation_type": "DEPRECIATION",
                "period_code": "2026-09", "period_start": str(self.today.replace(day=1)), "period_end": str(self.today),
            }, format="json",
        )
        self.assertEqual(run.status_code, 201, run.data)
        calculated = self.client.post(f"/api/v1/fixed-assets/calculations/{run.data['id']}/calculate/{self.query}", {}, format="json")
        self.assertEqual(calculated.data["total_amount"], "100.0000")
        posted = self.client.post(f"/api/v1/fixed-assets/calculations/{run.data['id']}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.data["status"], "POSTED")
        asset.refresh_from_db()
        self.assertEqual(asset.accumulated_depreciation, Decimal("100"))
        gl = self.client.post(
            f"/api/v1/fixed-assets/transactions/{acquisition}/post-gl/{self.query}",
            {"gl_reference": "GL-FA-001", "total_debit": "1200", "total_credit": "1200"}, format="json",
        )
        self.assertEqual(gl.status_code, 200, gl.data)
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="FA").exists())

    def test_tool_allocation_transfer_adjustment_and_disposal(self):
        asset_id = self.create_asset("CC001", "TOOL", self.tool_category, 600, 6)
        self.create_and_post_transaction(asset_id, "GT-CC-001", "ACQUISITION", 600)
        transfer = self.create_and_post_transaction(
            asset_id, "DC-CC-001", "TRANSFER", 0, reason="Chuyển đơn vị sử dụng",
            target_branch=str(self.branch2.id), target_department=str(self.department2.id),
        )
        self.assertEqual(AssetTransaction.objects.get(pk=transfer).gl_status, "NOT_REQUIRED")
        asset = AssetRecord.objects.get(pk=asset_id)
        self.assertEqual(asset.branch_id, self.branch2.id)
        run = self.client.post(
            f"/api/v1/fixed-assets/calculations/{self.query}",
            {
                "company": str(self.company.id), "number": "PB-2026-09", "calculation_type": "ALLOCATION",
                "period_code": "2026-09", "period_start": str(self.today.replace(day=1)), "period_end": str(self.today),
            }, format="json",
        )
        self.client.post(f"/api/v1/fixed-assets/calculations/{run.data['id']}/calculate/{self.query}", {}, format="json")
        self.client.post(f"/api/v1/fixed-assets/calculations/{run.data['id']}/post/{self.query}", {}, format="json")
        asset.refresh_from_db()
        self.assertEqual(asset.allocated_value, Decimal("100"))
        self.create_and_post_transaction(asset_id, "TL-CC-001", "DISPOSAL", 500, reason="Thanh lý")
        asset.refresh_from_db()
        self.assertEqual(asset.status, "DISPOSED")
        duplicate = self.client.post(
            f"/api/v1/fixed-assets/transactions/{self.query}",
            {"company": str(self.company.id), "asset": asset_id, "number": "PB-DUP", "transaction_type": "ALLOCATION", "transaction_date": str(self.today), "amount": "1"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)

    def test_tool_life_change_spreads_the_remainder_over_the_new_periods(self):
        asset_id = self.create_asset("CC001", "TOOL", self.tool_category, 1200, 6)
        self.create_and_post_transaction(asset_id, "GT-CC1", "ACQUISITION", 1200)
        self.create_and_post_transaction(asset_id, "DC-CC1", "LIFE_CHANGE", 0, target_useful_life_periods=12)
        run = self.client.post(f"/api/v1/fixed-assets/calculations/{self.query}", {
            "company": str(self.company.id), "number": "PB-2026", "calculation_type": "ALLOCATION",
            "period_code": "2026-LC", "period_start": str(self.today.replace(day=1)), "period_end": str(self.today),
        }, format="json")
        calculated = self.client.post(f"/api/v1/fixed-assets/calculations/{run.data['id']}/calculate/{self.query}", {}, format="json")
        self.assertEqual(calculated.status_code, 200, calculated.data)
        self.assertEqual(Decimal(calculated.data["total_amount"]), Decimal("100"))

    def test_partial_disposal_splits_and_reversal_merges_back(self):
        response = self.client.post(f"/api/v1/fixed-assets/assets/{self.query}", {
            "company": str(self.company.id), "code": "CC010", "name": "Bàn ghế", "asset_type": "TOOL",
            "category": self.tool_category, "quantity": "10", "acquisition_date": str(self.today),
            "in_service_date": str(self.today), "original_cost": "1000", "method": "STRAIGHT_LINE",
            "useful_life_periods": 5, "branch": str(self.branch.id),
        }, format="json")
        asset_id = response.data["id"]
        self.create_and_post_transaction(asset_id, "GT-CC10", "ACQUISITION", 1000)
        disposal = self.create_and_post_transaction(asset_id, "GG-CC10", "DISPOSAL", 0, quantity="3", reason="Hỏng 3 bộ")
        asset = AssetRecord.objects.get(pk=asset_id)
        part = AssetRecord.objects.get(code="CC010.1")
        self.assertEqual((asset.quantity, asset.original_cost, asset.status), (Decimal("7"), Decimal("700"), "ACTIVE"))
        self.assertEqual((part.quantity, part.original_cost, part.status), (Decimal("3"), Decimal("300"), "DISPOSED"))
        self.assertEqual(AssetTransaction.objects.get(pk=disposal).amount, Decimal("300"))
        reversed_ = self.client.post(f"/api/v1/fixed-assets/transactions/{disposal}/reverse/{self.query}", {"reason": "Nhầm"}, format="json")
        self.assertIn(reversed_.status_code, (200, 201), reversed_.data)
        asset.refresh_from_db()
        self.assertEqual((asset.quantity, asset.original_cost), (Decimal("10"), Decimal("1000")))
        self.assertFalse(AssetRecord.objects.filter(code="CC010.1").exists())

    def test_partial_quantity_cannot_exceed_tracked_quantity(self):
        asset_id = self.create_asset("CC020", "TOOL", self.tool_category, 500, 5)
        self.create_and_post_transaction(asset_id, "GT-CC20", "ACQUISITION", 500)
        created = self.client.post(f"/api/v1/fixed-assets/transactions/{self.query}", {
            "company": str(self.company.id), "asset": asset_id, "number": "DC-CC20", "transaction_type": "TRANSFER",
            "transaction_date": str(self.today), "quantity": "2", "target_department": str(self.department2.id),
            "idempotency_key": "KEY-DC-CC20",
        }, format="json")
        self.assertEqual(created.status_code, 400)
        self.assertIn("quantity", created.data)

    def test_asset_count_records_book_and_actual_quantities(self):
        asset_id = self.create_asset("CC030", "TOOL", self.tool_category, 600, 6)
        self.create_and_post_transaction(asset_id, "GT-CC30", "ACQUISITION", 600)
        url = f"/api/v1/fixed-assets/counts/{self.query}"
        created = self.client.post(url, {
            "company": str(self.company.id), "asset_type": "TOOL", "number": "BBKK-01", "count_date": str(self.today),
            "purpose": "Kiểm kê quý", "lines": [{"asset": asset_id, "actual_quantity": "0", "condition": "Mất"}],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        line = created.data["lines"][0]
        self.assertEqual((Decimal(line["book_quantity"]), Decimal(line["difference"])), (Decimal("1"), Decimal("-1")))
        wrong_type = self.client.post(url, {
            "company": str(self.company.id), "asset_type": "FIXED_ASSET", "number": "BBKK-02", "count_date": str(self.today),
            "lines": [{"asset": asset_id, "actual_quantity": "1"}],
        }, format="json")
        self.assertEqual(wrong_type.status_code, 400)

    def _base_uc_fa_01_payload(self, **overrides):
        payload = {
            "company": str(self.company.id),
            "voucher_no": "GTTS00010",
            "acquisition_date": self.today.strftime("%d/%m/%Y"),
            "category": self.fixed_category,
            "code": "TSCD-UC01",
            "department": str(self.department.id),
            "name": "Dây chuyền đóng gói tự động",
            "no_depreciation": False,
            "asset_account": "211",
            "accumulated_account": "214",
            "original_cost": "260000000",
            "depreciable_amount": "260000000",
            "accumulated_depreciation": "0",
            "useful_life_value": "5",
            "useful_life_unit": "YEAR",
            "in_service_date": self.today.strftime("%d/%m/%Y"),
            "allocations": [
                {"department_id": str(self.department.id), "rate": "60", "expense_account": "642", "expense_item": "CPQL"},
                {"department_id": str(self.department2.id), "rate": "40", "expense_account": "642", "expense_item": "CPBH"},
            ],
            "origins": [
                {"origin_type": "Mua sắm mới", "document_number": "HD-240", "document_date": self.today.strftime("%d/%m/%Y"), "amount": "240000000", "partner_name": "NCC Máy Móc"},
                {"origin_type": "Chi phí vận chuyển vốn hóa", "document_number": "VC-005", "document_date": self.today.strftime("%d/%m/%Y"), "amount": "5000000", "partner_name": "Vận tải A"},
                {"origin_type": "Chi phí lắp đặt vốn hóa", "document_number": "LD-015", "document_date": self.today.strftime("%d/%m/%Y"), "amount": "15000000", "partner_name": "Kỹ thuật B"},
            ],
            "components": [{"name": "Motor chính", "unit": "Cái", "quantity": "1", "value": "80000000"}],
            "accessories": [{"name": "Bộ cờ lê chuyên dụng", "unit": "Bộ", "quantity": "2", "value": "1500000"}],
            "country_of_origin": "Nhật Bản",
            "manufacture_year": 2026,
        }
        payload.update(overrides)
        return payload

    def test_uc_fa_01_main_flow_example_4_6_and_audit_log(self):
        url = f"/api/v1/fixed-assets/assets/acquire/{self.query}"
        res = self.client.post(url, self._base_uc_fa_01_payload(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["message"], "Ghi tăng tài sản cố định thành công.")
        asset_data = res.data["asset"]
        self.assertEqual(asset_data["status"], "ACTIVE")
        self.assertEqual(asset_data["status_display"], "Đang sử dụng")
        # EF25 / Section 5.2: Without matching GL entry yet, status is UNRECONCILED (not auto-marked reconciled)
        self.assertEqual(asset_data["accounting_reconciliation_status"], "UNRECONCILED")
        self.assertEqual(asset_data["accounting_reconciliation_status_display"], "Chưa đối chiếu hạch toán")
        # Section 4.6 example: 5 years = 60 months, 260,000,000 / 60 = 4,333,333.3333
        self.assertEqual(asset_data["useful_life_periods"], 60)
        self.assertEqual(Decimal(asset_data["monthly_depreciation_amount"]), Decimal("4333333.3333"))
        # BR18: No immediate depreciation deducted upon acquisition
        self.assertEqual(Decimal(asset_data["accumulated_depreciation"]), Decimal("0"))
        self.assertEqual(Decimal(asset_data["remaining_value"]), Decimal("260000000"))
        # BR26: Accessories and components are stored without double-counting into original_cost
        self.assertEqual(Decimal(asset_data["original_cost"]), Decimal("260000000"))
        self.assertEqual(len(asset_data["components"]), 1)
        self.assertEqual(len(asset_data["accessories"]), 1)
        self.assertEqual(asset_data["country_of_origin"], "Nhật Bản")
        self.assertEqual(asset_data["manufacture_year"], 2026)
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="FA", action_code="ACQUIRE").exists())

    def test_uc_fa_01_alternative_flows_month_unit_cit_cap_and_non_depreciable(self):
        url = f"/api/v1/fixed-assets/assets/acquire/{self.query}"
        # AF06 & AF08: Month unit (not multiplied by 12) + CIT tax cap
        res_month = self.client.post(
            url,
            self._base_uc_fa_01_payload(
                voucher_no="GTTS00011",
                code="TSCD-UC02",
                original_cost="2400000000",
                depreciable_amount="2400000000",
                useful_life_value="48",
                useful_life_unit="Tháng",
                cit_cap_enabled=True,
                cit_depreciable_cap="1600000000",
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(res_month.status_code, 201, res_month.data)
        a_month = res_month.data["asset"]
        self.assertEqual(a_month["useful_life_periods"], 48)
        self.assertEqual(Decimal(a_month["monthly_depreciation_amount"]), Decimal("50000000"))
        self.assertEqual(Decimal(a_month["cit_depreciable_cap"]), Decimal("1600000000"))
        self.assertEqual(Decimal(a_month["cit_monthly_cap"]), Decimal("33333333.3333"))
        # BR21: Accounting original_cost and depreciable_amount remain unchanged by tax cap
        self.assertEqual(Decimal(a_month["original_cost"]), Decimal("2400000000"))

        # AF03: Non-depreciable asset (e.g. QSDĐ lâu dài)
        res_nodepr = self.client.post(
            url,
            self._base_uc_fa_01_payload(
                voucher_no="GTTS00012",
                code="TSCD-NODEPR",
                no_depreciation=True,
                accumulated_account="",
                useful_life_value="0",
                allocations=[],
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(res_nodepr.status_code, 201, res_nodepr.data)
        self.assertFalse(res_nodepr.data["asset"]["is_depreciable"])
        self.assertEqual(res_nodepr.data["asset"]["useful_life_periods"], 0)

    def test_uc_fa_01_exception_flows_ef01_to_ef22(self):
        url = f"/api/v1/fixed-assets/assets/acquire/{self.query}"
        # Seed one asset first to test duplicate voucher_no (EF03), duplicate code (EF08), duplicate origin (EF21)
        first = self.client.post(url, self._base_uc_fa_01_payload(), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        cases = [
            ({"voucher_no": ""}, "voucher_no", "Vui lòng nhập số chứng từ ghi tăng."),  # EF02
            ({"voucher_no": "GTTS00010", "code": "NEW01"}, "voucher_no", "Số chứng từ ghi tăng đã tồn tại."),  # EF03
            ({"voucher_no": "GT-EF04", "code": "NEW04", "acquisition_date": "31-02-2026"}, "acquisition_date", "Vui lòng nhập Ngày ghi tăng hợp lệ theo định dạng DD/MM/YYYY."),  # EF04
            ({"voucher_no": "GT-EF06", "code": "NEW06", "category": ""}, "category", "Vui lòng chọn loại tài sản hợp lệ."),  # EF06
            ({"voucher_no": "GT-EF07", "code": ""}, "code", "Vui lòng nhập mã tài sản."),  # EF07
            ({"voucher_no": "GT-EF08", "code": "TSCD-UC01"}, "code", "Mã tài sản đã tồn tại. Vui lòng nhập mã khác."),  # EF08
            ({"voucher_no": "GT-EF09", "code": "NEW09", "department": ""}, "department", "Vui lòng chọn đơn vị sử dụng hợp lệ."),  # EF09
            ({"voucher_no": "GT-EF10", "code": "NEW10", "name": "   "}, "name", "Vui lòng nhập tên tài sản cố định."),  # EF10
            ({"voucher_no": "GT-EF11", "code": "NEW11", "original_cost": "0"}, "original_cost", "Nguyên giá tài sản phải lớn hơn 0 và có căn cứ hợp lệ."),  # EF11
            ({"voucher_no": "GT-EF12", "code": "NEW12", "meets_recognition_criteria": False}, "original_cost", "Tài sản chưa đủ điều kiện ghi nhận là tài sản cố định."),  # EF12
            ({"voucher_no": "GT-EF13", "code": "NEW13", "asset_account": "642"}, "asset_account", "Tài khoản nguyên giá không hợp lệ."),  # EF13
            ({"voucher_no": "GT-EF14", "code": "NEW14", "accumulated_account": "211"}, "accumulated_account", "Vui lòng chọn tài khoản khấu hao hợp lệ."),  # EF14
            ({"voucher_no": "GT-EF15", "code": "NEW15", "useful_life_value": "0"}, "useful_life_value", "Thời gian sử dụng tài sản không hợp lệ."),  # EF15
            ({"voucher_no": "GT-EF16", "code": "NEW16", "in_service_date": ""}, "in_service_date", "Ngày bắt đầu tính khấu hao không hợp lệ."),  # EF16
            ({"voucher_no": "GT-EF17", "code": "NEW17", "accumulated_depreciation": "1000"}, "accumulated_depreciation", "Hao mòn lũy kế không hợp lệ."),  # EF17
            ({"voucher_no": "GT-EF18", "code": "NEW18", "depreciable_amount": "300000000", "origins": []}, "depreciable_amount", "Thông tin khấu hao không nhất quán. Vui lòng kiểm tra lại."),  # EF18
            ({"voucher_no": "GT-EF19", "code": "NEW19", "origins": [], "allocations": [{"department_id": str(self.department.id), "rate": "80", "expense_account": "642"}]}, "allocations", "Tổng tỷ lệ phân bổ khấu hao phải bằng 100%."),  # EF19
            ({"voucher_no": "GT-EF20", "code": "NEW20", "origins": [], "allocations": [{"department_id": str(self.department.id), "rate": "100", "expense_account": "211"}]}, "allocations", "Thông tin phân bổ chi phí khấu hao không hợp lệ."),  # EF20
            ({"voucher_no": "GT-EF21", "code": "NEW21"}, "origins", "Tài sản đã được ghi tăng từ hồ sơ này. Vui lòng kiểm tra lại."),  # EF21
            ({"voucher_no": "GT-EF22", "code": "NEW22", "origins": [{"origin_type": "Mua mới", "document_number": "HD-999", "amount": "200000000"}]}, "origins", "Nguyên giá chưa phù hợp với hồ sơ nguồn. Vui lòng kiểm tra lại."),  # EF22
        ]
        for overrides, field, expected_msg in cases:
            resp = self.client.post(url, self._base_uc_fa_01_payload(**overrides), format="json")
            self.assertEqual(resp.status_code, 400, f"Failed for {field}: {resp.data}")
            self.assertIn(field, resp.data, f"Missing {field} in {resp.data}")
            val = resp.data[field]
            msg = val[0] if isinstance(val, list) else str(val)
            self.assertEqual(msg, expected_msg)

        # EF05: Closed period check
        self.client.post(
            f"/api/v1/fixed-assets/periods/{self.query}",
            {"company": str(self.company.id), "code": "CLOSED-P", "start_date": str(self.today), "end_date": str(self.today), "status": "CLOSED"},
            format="json",
        )
        ef05 = self.client.post(url, self._base_uc_fa_01_payload(voucher_no="GT-EF05", code="NEW05", origins=[]), format="json")
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["acquisition_date"][0] if isinstance(ef05.data["acquisition_date"], list) else ef05.data["acquisition_date"]), "Không thể ghi tăng tài sản trong kỳ kế toán đã khóa.")

        # EF01: Unauthorized user check
        unauth_user = get_user_model().objects.create_user(username="no-fa-perm", email="noperm@fa.test", password="x")
        self.client.force_authenticate(unauth_user)
        ef01 = self.client.post(url, self._base_uc_fa_01_payload(voucher_no="GT-EF01", code="NEW01"), format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền ghi tăng tài sản cố định.")

    def test_uc_fa_02_main_flow_example_4_5_and_audit_log(self):
        """
        UC-FA-02 Main Flow & Section 4.5 Example:
        - Asset TS001: Name 'Máy tính văn phòng' -> 'Máy tính văn phòng Dell',
          Country '' -> 'Việt Nam', Manufacture Year None -> 2024.
        - Original cost 30,000,000, accumulated depreciation 6,000,000, remaining value 24,000,000 stay unchanged.
        - No new asset or acquisition transaction created.
        - AuditLog records UPDATE_INFO with before/after values and update_reason.
        """
        acq = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-TS001",
                code="TS001",
                name="Máy tính văn phòng",
                original_cost="30000000",
                depreciable_amount="30000000",
                accumulated_depreciation="6000000",
                allow_prior_depreciation=True,
                useful_life_value="5",
                useful_life_unit="Năm",
                country_of_origin="",
                manufacture_year=None,
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(acq.status_code, 201, acq.data)
        asset_id = acq.data["asset"]["id"]
        self.assertEqual(acq.data["asset"]["version"], 1)

        # AF14: Saving without any changes returns "Không có thông tin thay đổi." and does not increment version
        no_chg = self.client.post(
            f"/api/v1/fixed-assets/assets/{asset_id}/update-info/{self.query}",
            {
                "name": "Máy tính văn phòng",
                "country_of_origin": "",
                "manufacture_year": None,
                "update_reason": "Rà soát hồ sơ",
            },
            format="json",
        )
        self.assertEqual(no_chg.status_code, 200, no_chg.data)
        self.assertTrue(no_chg.data["no_changes"])
        self.assertEqual(no_chg.data["message"], "Không có thông tin thay đổi.")
        self.assertEqual(no_chg.data["asset"]["version"], 1)

        # Main Flow: Update Name, Country of Origin, Manufacture Year + Reason
        upd = self.client.post(
            f"/api/v1/fixed-assets/assets/{asset_id}/update-info/{self.query}",
            {
                "name": "Máy tính văn phòng Dell",
                "country_of_origin": "Việt Nam",
                "manufacture_year": 2024,
                "components": [{"name": "Màn hình Dell 24 inch", "unit": "Cái", "quantity": "1", "value": "4500000"}],
                "accessories": [{"name": "Chuột + Bàn phím Dell", "unit": "Bộ", "quantity": "1", "value": "500000"}],
                "update_reason": "Bổ sung thông tin nhãn hiệu, xuất xứ và phụ tùng theo biên bản bàn giao",
                "version": 1,
            },
            format="json",
        )
        self.assertEqual(upd.status_code, 200, upd.data)
        self.assertEqual(upd.data["message"], "Cập nhật thông tin tài sản thành công.")
        self.assertFalse(upd.data["no_changes"])

        asset_data = upd.data["asset"]
        self.assertEqual(asset_data["code"], "TS001")
        self.assertEqual(asset_data["name"], "Máy tính văn phòng Dell")
        self.assertEqual(asset_data["country_of_origin"], "Việt Nam")
        self.assertEqual(asset_data["manufacture_year"], 2024)
        self.assertEqual(Decimal(asset_data["original_cost"]), Decimal("30000000"))
        self.assertEqual(Decimal(asset_data["accumulated_depreciation"]), Decimal("6000000"))
        self.assertEqual(Decimal(asset_data["remaining_value"]), Decimal("24000000"))
        self.assertEqual(asset_data["version"], 2)
        self.assertEqual(
            asset_data["last_update_reason"],
            "Bổ sung thông tin nhãn hiệu, xuất xứ và phụ tùng theo biên bản bàn giao",
        )

        # Verify history endpoint returns audit_logs with field-level changes
        hist = self.client.get(f"/api/v1/fixed-assets/assets/{asset_id}/history/{self.query}")
        self.assertEqual(hist.status_code, 200)
        self.assertEqual(len(hist.data["transactions"]), 1)  # Only original ACQUISITION transaction
        update_logs = [log for log in hist.data["audit_logs"] if log["action_code"] == "UPDATE_INFO"]
        self.assertEqual(len(update_logs), 1)
        self.assertEqual(
            update_logs[0]["reason"],
            "Bổ sung thông tin nhãn hiệu, xuất xứ và phụ tùng theo biên bản bàn giao",
        )
        changed_field_names = {ch["field_name"] for ch in update_logs[0]["changes"]}
        self.assertTrue({"name", "country_of_origin", "manufacture_year"}.issubset(changed_field_names))

    def test_uc_fa_02_exception_flows_ef01_to_ef18(self):
        """
        UC-FA-02 Exception Flows EF01–EF18 verification with exact Vietnamese messages.
        """
        acq = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-UC02-EF",
                code="TS-UC02",
                name="Máy in laser Canon",
                original_cost="240000000",
                depreciable_amount="240000000",
                monthly_depreciation_amount="4000000",
                annual_depreciation_amount="48000000",
                origins=[{"origin_type": "Mua sắm mới", "document_number": "HD-UC02-01", "amount": "240000000"}],
            ),
            format="json",
        )
        self.assertEqual(acq.status_code, 201, acq.data)
        asset_id = acq.data["asset"]["id"]
        url = f"/api/v1/fixed-assets/assets/{asset_id}/update-info/{self.query}"

        # EF01: Non-existent asset
        ef01 = self.client.get(f"/api/v1/fixed-assets/assets/00000000-0000-0000-0000-000000000999/{self.query}")
        self.assertEqual(ef01.status_code, 404)
        self.assertEqual(str(ef01.data["detail"]), "Không tìm thấy thông tin tài sản cố định.")

        # EF04: Empty name
        ef04 = self.client.post(url, {"name": "   ", "update_reason": "Sửa tên"}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["name"]), "Vui lòng nhập tên tài sản cố định.")

        # EF05: Invalid manufacture year (future year or non-integer)
        ef05 = self.client.post(url, {"manufacture_year": 2099, "update_reason": "Sửa năm SX"}, format="json")
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["manufacture_year"]), "Năm sản xuất không hợp lệ. Vui lòng kiểm tra lại.")

        # EF06: Attempt to change asset code
        ef06 = self.client.post(url, {"code": "TS-NEW-CODE", "update_reason": "Đổi mã"}, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["code"]), "Không được thay đổi mã tài sản trong chức năng này.")

        # EF07: Attempt to change acquisition voucher no or date
        ef07 = self.client.post(url, {"acquisition_voucher_no": "GT-OTHER", "update_reason": "Đổi số CT"}, format="json")
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(
            str(ef07.data["acquisition_voucher_no"]),
            "Thông tin chứng từ ghi tăng không được chỉnh sửa trực tiếp tại hồ sơ tài sản.",
        )

        # EF08: Attempt to change original_cost / depreciation fields
        ef08 = self.client.post(url, {"original_cost": "500000000", "update_reason": "Tăng nguyên giá"}, format="json")
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(
            str(ef08.data["original_cost"]),
            "Thông tin kế toán không được chỉnh sửa trực tiếp. Vui lòng thực hiện nghiệp vụ điều chỉnh phù hợp.",
        )

        # EF09: Attempt to change category directly
        other_cat = models.AssetCategory.objects.create(
            company=self.company, code="CAT-VH", name="TSCĐ vô hình", asset_type="FIXED_ASSET", default_periods=24
        )
        ef09 = self.client.post(url, {"category": str(other_cat.id), "update_reason": "Đổi loại TS"}, format="json")
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(
            str(ef09.data["category"]),
            "Không thể thay đổi loại tài sản trực tiếp vì ảnh hưởng dữ liệu kế toán.",
        )

        # EF10: Attempt to change using department directly
        ef10 = self.client.post(url, {"department": str(self.department2.id), "update_reason": "Chuyển phòng ban"}, format="json")
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(
            str(ef10.data["department"]),
            "Vui lòng thực hiện điều chuyển TSCĐ để thay đổi đơn vị sử dụng.",
        )

        # EF11: Invalid origin amount change
        ef11 = self.client.post(
            url,
            {
                "origins": [{"origin_type": "Mua sắm mới", "document_number": "HD-UC02-01", "amount": "100000000"}],
                "update_reason": "Sửa nguồn gốc",
            },
            format="json",
        )
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(
            str(ef11.data["origins"]),
            "Thông tin nguồn gốc hình thành chưa hợp lệ. Vui lòng kiểm tra chứng từ liên quan.",
        )

        # EF12: Missing update_reason when changing info
        ef12 = self.client.post(url, {"name": "Máy in laser Canon LBP2900", "update_reason": "   "}, format="json")
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["update_reason"]), "Vui lòng nhập lý do cập nhật thông tin tài sản.")

        # EF13: Version conflict (optimistic concurrency)
        ef13 = self.client.post(
            url,
            {"name": "Máy in laser Canon LBP2900", "update_reason": "Cập nhật", "version": 99},
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(
            str(ef13.data["version"]),
            "Thông tin tài sản đã được thay đổi. Vui lòng tải lại dữ liệu trước khi cập nhật.",
        )

        # EF17: Exceeding max length or invalid characters
        ef17 = self.client.post(
            url,
            {"name": "A" * 300, "update_reason": "Quá dài"},
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(
            str(ef17.data["name"]),
            "Thông tin nhập không hợp lệ hoặc vượt quá độ dài cho phép.",
        )

        # EF14 & EF03: Status changed / Disposed asset cannot be updated directly
        models.AssetRecord.objects.filter(pk=asset_id).update(status="DISPOSED")
        ef14 = self.client.post(
            url,
            {"name": "Máy in Canon", "update_reason": "Cập nhật", "expected_status": "ACTIVE"},
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(str(ef14.data["status"]), "Trạng thái tài sản đã thay đổi. Vui lòng kiểm tra lại.")

        ef03 = self.client.post(
            url,
            {"name": "Máy in Canon", "update_reason": "Cập nhật"},
            format="json",
        )
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["status"]), "Trạng thái tài sản không cho phép cập nhật trực tiếp.")
        models.AssetRecord.objects.filter(pk=asset_id).update(status="ACTIVE")

        # EF18: Cross-company access denied
        from organization.models import Company
        other_company = Company.objects.create(
            code="COMP2",
            name="Công ty Khác",
            tax_code="0109998887",
            accounting_currency=self.company.accounting_currency,
            legal_reporting_currency=self.company.legal_reporting_currency,
        )
        ef18 = self.client.post(
            f"/api/v1/fixed-assets/assets/{asset_id}/update-info/?company_id={other_company.id}",
            {"name": "Máy in Canon", "update_reason": "Cập nhật"},
            format="json",
        )
        self.assertEqual(ef18.status_code, 403)
        self.assertEqual(str(ef18.data["detail"]), "Bạn không có quyền cập nhật tài sản thuộc doanh nghiệp khác.")

        # EF02: User without FA.ASSET.EDIT permission
        unauth_user = get_user_model().objects.create_user(username="no-edit-perm", email="noedit@fa.test", password="x")
        self.client.force_authenticate(unauth_user)
        ef02 = self.client.post(url, {"name": "Máy in Canon", "update_reason": "Cập nhật"}, format="json")
        self.assertEqual(ef02.status_code, 403)
        self.assertEqual(str(ef02.data["detail"]), "Bạn không có quyền thực hiện thao tác này.")

    def test_uc_fa_03_main_flow_example_4_8_and_gl_posting(self):
        """
        UC-FA-03 Main Flow & Section 4.8 End-to-End Example:
        - Asset TS001: Máy tính văn phòng, original_cost = 60,000,000, depreciable_amount = 60,000,000,
          useful_life = 5 years (60 months), monthly_depreciation = 1,000,000,
          accumulated_depreciation prior to T03/2026 = 2,000,000.
        - Allocation: Phòng Kế toán 60% (TK 642), Phòng Kinh doanh 40% (TK 641).
        - Period 03/2026:
          * Tab 1 (Tính khấu hao): amount = 1,000,000; deductible = 1,000,000; non_deductible = 0.
          * Tab 2 (Phân bổ): Phòng Kế toán = 600,000; Phòng Kinh doanh = 400,000; sum = 1,000,000.
          * Tab 3 (Hạch toán): Nợ 642 / Có 214 = 600,000; Nợ 641 / Có 214 = 400,000; sum = 1,000,000.
        - Save & Post voucher KH032026:
          * Exact message: "Đã lưu chứng từ tính khấu hao KH032026 thành công!"
          * Sổ tài sản TS001: original_cost = 60,000,000, accumulated_depreciation = 3,000,000, remaining_value = 57,000,000.
        """
        acc_641 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.accounts[0].chart_of_accounts,
            account_class=self.accounts[0].account_class,
            code="641",
            name="Chi phí bán hàng",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        acq = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-UC03-01",
                code="TS001",
                name="Máy tính văn phòng",
                acquisition_date="2026-01-01",
                in_service_date="2026-01-01",
                depreciation_start_date="2026-01-01",
                original_cost="60000000",
                depreciable_amount="60000000",
                useful_life_value="5",
                useful_life_unit="Năm",
                monthly_depreciation_rate="1.6667",
                annual_depreciation_rate="20",
                monthly_depreciation_amount="1000000",
                annual_depreciation_amount="12000000",
                accumulated_depreciation="2000000",
                allow_prior_depreciation=True,
                allocations=[
                    {
                        "target_code": "PKT",
                        "target_name": "Phòng Kế toán",
                        "department_id": str(self.department.id),
                        "rate": "60",
                        "expense_account": str(self.accounts[2].id),
                        "expense_account_code": "642",
                        "cost_item": "CPQL",
                    },
                    {
                        "target_code": "PKD",
                        "target_name": "Phòng Kinh doanh",
                        "department_id": str(self.department2.id),
                        "rate": "40",
                        "expense_account": str(acc_641.id),
                        "expense_account_code": "641",
                        "cost_item": "CPBH",
                    },
                ],
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(acq.status_code, 201, acq.data)
        asset_id = acq.data["asset"]["id"]

        # Preview period 03/2026
        prev = self.client.post(
            f"/api/v1/fixed-assets/calculations/preview/{self.query}",
            {"month": 3, "year": 2026},
            format="json",
        )
        self.assertEqual(prev.status_code, 200, prev.data)
        self.assertEqual(prev.data["period_code"], "2026-03")
        self.assertEqual(Decimal(prev.data["total_amount"]), Decimal("1000000"))
        self.assertEqual(Decimal(prev.data["total_deductible_amount"]), Decimal("1000000"))
        self.assertEqual(Decimal(prev.data["total_non_deductible_amount"]), Decimal("0"))
        self.assertEqual(len(prev.data["lines"]), 1)
        self.assertEqual(len(prev.data["allocations"]), 2)
        self.assertEqual(Decimal(prev.data["allocations"][0]["allocated_amount"]), Decimal("600000"))
        self.assertEqual(Decimal(prev.data["allocations"][1]["allocated_amount"]), Decimal("400000"))
        self.assertEqual(len(prev.data["accounting_entries"]), 2)
        self.assertEqual(prev.data["accounting_entries"][0]["debit_account_code"], "642")
        self.assertEqual(prev.data["accounting_entries"][0]["credit_account_code"], "214")
        self.assertEqual(Decimal(prev.data["accounting_entries"][0]["amount"]), Decimal("600000"))
        self.assertEqual(prev.data["accounting_entries"][1]["debit_account_code"], "641")
        self.assertEqual(prev.data["accounting_entries"][1]["credit_account_code"], "214")
        self.assertEqual(Decimal(prev.data["accounting_entries"][1]["amount"]), Decimal("400000"))

        # Save and post voucher KH032026
        save_resp = self.client.post(
            f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}",
            {
                "month": 3,
                "year": 2026,
                "voucher_no": "KH032026",
                "voucher_date": "2026-03-31",
                "posting_date": "2026-03-31",
                "description": "Khấu hao TSCĐ tháng 03 năm 2026",
                "reference": "TC-KH03",
                "post_now": True,
                "idempotency_key": "IDEMP-KH032026",
            },
            format="json",
        )
        self.assertEqual(save_resp.status_code, 201, save_resp.data)
        self.assertEqual(save_resp.data["message"], "Đã lưu chứng từ tính khấu hao KH032026 thành công!")
        self.assertTrue(save_resp.data["posted"])
        run_id = save_resp.data["run"]["id"]
        self.assertEqual(save_resp.data["run"]["status"], "POSTED")

        # Verify Sổ tài sản (AssetRecord) balances updated accurately (BR16)
        asset_detail = self.client.get(f"/api/v1/fixed-assets/assets/{asset_id}/{self.query}")
        self.assertEqual(asset_detail.status_code, 200)
        self.assertEqual(Decimal(asset_detail.data["original_cost"]), Decimal("60000000"))
        self.assertEqual(Decimal(asset_detail.data["accumulated_depreciation"]), Decimal("3000000"))
        self.assertEqual(Decimal(asset_detail.data["remaining_value"]), Decimal("57000000"))

        # Verify AF16 Export Allocation endpoint
        exp_resp = self.client.get(f"/api/v1/fixed-assets/calculations/{run_id}/export-allocation/{self.query}")
        self.assertEqual(exp_resp.status_code, 200)
        self.assertEqual(exp_resp.data["voucher_no"], "KH032026")
        self.assertEqual(len(exp_resp.data["allocations"]), 2)

    def test_uc_fa_03_alternative_flows_proration_final_period_cit_cap_unpost_recalculate(self):
        """
        UC-FA-03 Alternative Flows & Section 4 Formulas:
        - AF05 / Section 4.1: Mid-month acquisition day proration (April 16 to April 30 = 15/30 days).
        - Section 4.2: Final period cap at remaining depreciable value (never negative remaining value).
        - AF12 / Section 4.6: CIT deductible vs non-deductible split when tax_deductible_cap < depreciable_amount.
        - AF20: Save unposted (CALCULATED) -> asset balances untouched until POST /post/.
        - AF14: Unpost (Bỏ ghi sổ) & Recalculate (recalculate=True).
        """
        # 1. Mid-month asset (starts 2026-04-16 -> 15 eligible days out of 30 in April 2026)
        self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-PRORATE",
                code="TS-PRORATE",
                name="Máy chiếu hội trường",
                acquisition_date="2026-04-16",
                in_service_date="2026-04-16",
                depreciation_start_date="2026-04-16",
                original_cost="36000000",
                depreciable_amount="36000000",
                useful_life_value="3",
                useful_life_unit="Năm",
                monthly_depreciation_amount="1000000",
                annual_depreciation_amount="12000000",
                origins=[],
            ),
            format="json",
        )

        # 2. Nearly fully depreciated asset (remaining depreciable = 350,000 < monthly 1,000,000)
        self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-FINAL",
                code="TS-FINAL",
                name="Máy scan tài liệu",
                acquisition_date="2023-05-01",
                in_service_date="2023-05-01",
                depreciation_start_date="2023-05-01",
                original_cost="36000000",
                depreciable_amount="36000000",
                accumulated_depreciation="35650000",
                allow_prior_depreciation=True,
                useful_life_value="3",
                useful_life_unit="Năm",
                monthly_depreciation_amount="1000000",
                annual_depreciation_amount="12000000",
                origins=[],
            ),
            format="json",
        )

        # 3. Passenger car < 9 seats exceeding CIT 1.6B cap (original_cost = 2.4B, tax_deductible_cap = 1.6B, 10 years = 120 months)
        car_acq = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-CAR",
                code="TS-CAR",
                name="Xe ô tô 5 chỗ Camry",
                acquisition_date="2026-01-01",
                in_service_date="2026-01-01",
                depreciation_start_date="2026-01-01",
                original_cost="2400000000",
                depreciable_amount="2400000000",
                useful_life_value="10",
                useful_life_unit="Năm",
                monthly_depreciation_amount="20000000",
                annual_depreciation_amount="240000000",
                origins=[],
            ),
            format="json",
        )
        car_id = car_acq.data["asset"]["id"]
        models.AssetRecord.objects.filter(pk=car_id).update(
            cit_cap_enabled=True,
            cit_depreciable_cap=Decimal("1600000000"),
        )

        # Preview April 2026
        prev = self.client.post(
            f"/api/v1/fixed-assets/calculations/preview/{self.query}",
            {"month": 4, "year": 2026},
            format="json",
        )
        self.assertEqual(prev.status_code, 200, prev.data)
        lines_by_code = {l["asset_code"]: l for l in prev.data["lines"]}

        # Verify TS-PRORATE: 15/30 * 1,000,000 = 500,000
        self.assertEqual(Decimal(lines_by_code["TS-PRORATE"]["amount"]), Decimal("500000"))
        self.assertEqual(lines_by_code["TS-PRORATE"]["eligible_days"], 15)
        self.assertEqual(lines_by_code["TS-PRORATE"]["total_days_in_period"], 30)

        # Verify TS-FINAL: capped at remaining 350,000
        self.assertEqual(Decimal(lines_by_code["TS-FINAL"]["amount"]), Decimal("350000"))
        self.assertEqual(Decimal(lines_by_code["TS-FINAL"]["closing_value"]), Decimal("0"))

        # Verify TS-CAR: monthly = 20,000,000; deductible = 13,333,333; non_deductible = 6,666,667
        self.assertEqual(Decimal(lines_by_code["TS-CAR"]["amount"]), Decimal("20000000"))
        self.assertEqual(Decimal(lines_by_code["TS-CAR"]["deductible_amount"]), Decimal("13333333"))
        self.assertEqual(Decimal(lines_by_code["TS-CAR"]["non_deductible_amount"]), Decimal("6666667"))

        # AF20: Save unposted (post_now=False)
        unposted_resp = self.client.post(
            f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}",
            {
                "month": 4,
                "year": 2026,
                "voucher_no": "KH042026",
                "post_now": False,
                "prorate_by_days": True,
            },
            format="json",
        )
        self.assertEqual(unposted_resp.status_code, 201, unposted_resp.data)
        self.assertFalse(unposted_resp.data["posted"])
        self.assertEqual(unposted_resp.data["run"]["status"], "CALCULATED")
        run_id = unposted_resp.data["run"]["id"]

        # While CALCULATED (unposted), TS-CAR accumulated_depreciation is still 0
        car_before = models.AssetRecord.objects.get(pk=car_id)
        self.assertEqual(car_before.accumulated_depreciation, Decimal("0"))

        # Now post the CALCULATED voucher
        post_resp = self.client.post(f"/api/v1/fixed-assets/calculations/{run_id}/post/{self.query}", {}, format="json")
        self.assertEqual(post_resp.status_code, 200, post_resp.data)
        self.assertEqual(post_resp.data["status"], "POSTED")
        car_after = models.AssetRecord.objects.get(pk=car_id)
        self.assertEqual(car_after.accumulated_depreciation, Decimal("20000000"))

        # AF14: Unpost (Bỏ ghi sổ) rolls back asset accumulated_depreciation
        unpost_resp = self.client.post(
            f"/api/v1/fixed-assets/calculations/{run_id}/unpost/{self.query}",
            {"reason": "Tính lại khấu hao tháng 04/2026"},
            format="json",
        )
        self.assertEqual(unpost_resp.status_code, 200, unpost_resp.data)
        self.assertEqual(unpost_resp.data["status"], "CALCULATED")
        car_reverted = models.AssetRecord.objects.get(pk=car_id)
        self.assertEqual(car_reverted.accumulated_depreciation, Decimal("0"))

        # AF14: Recalculate (recalculate=True) replaces voucher cleanly and posts
        recalc_resp = self.client.post(
            f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}",
            {
                "month": 4,
                "year": 2026,
                "voucher_no": "KH042026",
                "post_now": True,
                "recalculate": True,
                "prorate_by_days": False,
            },
            format="json",
        )
        self.assertEqual(recalc_resp.status_code, 201, recalc_resp.data)
        self.assertEqual(recalc_resp.data["run"]["status"], "POSTED")

    def test_uc_fa_03_exception_flows_ef01_to_ef25(self):
        """
        UC-FA-03 Exception Flows EF01–EF25 verification with exact Vietnamese messages.
        """
        preview_url = f"/api/v1/fixed-assets/calculations/preview/{self.query}"
        save_url = f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}"

        # EF02: Invalid month or year
        ef02 = self.client.post(preview_url, {"month": 13, "year": 2026}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["period"]), "Vui lòng chọn kỳ tính khấu hao hợp lệ.")

        # AF04: No eligible assets in period
        af04 = self.client.post(preview_url, {"month": 5, "year": 2026}, format="json")
        self.assertEqual(af04.status_code, 400)
        self.assertEqual(
            str(af04.data["detail"]),
            "Không có tài sản cố định cần tính khấu hao trong kỳ đã chọn.",
        )

        # Create an active asset for further exception checks
        acq = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-EF-01",
                code="TS-EF01",
                name="Máy chủ Dell PowerEdge",
                acquisition_date="2026-01-01",
                in_service_date="2026-01-01",
                depreciation_start_date="2026-01-01",
                original_cost="120000000",
                depreciable_amount="120000000",
                useful_life_value="5",
                useful_life_unit="Năm",
                monthly_depreciation_amount="2000000",
                annual_depreciation_amount="24000000",
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(acq.status_code, 201, acq.data)
        asset_id = acq.data["asset"]["id"]

        # EF09: Missing depreciation parameters (method = "")
        models.AssetRecord.objects.filter(pk=asset_id).update(method="")
        ef09 = self.client.post(preview_url, {"month": 5, "year": 2026}, format="json")
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(
            str(ef09.data["detail"]),
            "Chưa thiết lập đầy đủ thông tin khấu hao của tài sản.",
        )
        models.AssetRecord.objects.filter(pk=asset_id).update(method="STRAIGHT_LINE")

        # EF23: Invalid accumulated depreciation exceeding depreciable amount
        models.AssetRecord.objects.filter(pk=asset_id).update(accumulated_depreciation=Decimal("150000000"))
        ef23 = self.client.post(preview_url, {"month": 5, "year": 2026}, format="json")
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(
            str(ef23.data["detail"]),
            "Dữ liệu hao mòn lũy kế của tài sản không hợp lệ.",
        )
        models.AssetRecord.objects.filter(pk=asset_id).update(accumulated_depreciation=Decimal("0"))

        # EF13: Invalid allocation rate != 100%
        models.AssetRecord.objects.filter(pk=asset_id).update(
            allocations=[{"target_code": "PKT", "target_name": "Kế toán", "rate": "80", "expense_account_code": "642"}]
        )
        ef13 = self.client.post(preview_url, {"month": 5, "year": 2026}, format="json")
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(
            str(ef13.data["allocations"]),
            "Tổng tỷ lệ phân bổ khấu hao phải bằng 100%.",
        )
        models.AssetRecord.objects.filter(pk=asset_id).update(
            allocations=[
                {
                    "target_code": "PKT",
                    "target_name": "Kế toán",
                    "rate": "100",
                    "expense_account": str(self.accounts[2].id),
                    "expense_account_code": "642",
                }
            ]
        )

        # EF04: Empty voucher_no
        ef04 = self.client.post(save_url, {"month": 5, "year": 2026, "voucher_no": "   "}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["voucher_no"]), "Vui lòng nhập số chứng từ.")

        # EF06: Invalid voucher_date
        ef06 = self.client.post(
            save_url,
            {"month": 5, "year": 2026, "voucher_no": "KH052026", "voucher_date": "not-a-date"},
            format="json",
        )
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["voucher_date"]), "Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY.")

        # EF07: Posting date does not match period
        ef07 = self.client.post(
            save_url,
            {"month": 5, "year": 2026, "voucher_no": "KH052026", "posting_date": "2026-06-05"},
            format="json",
        )
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["posting_date"]), "Ngày hạch toán không phù hợp với kỳ tính khấu hao.")

        # EF24: Missing CIT cap data when cit_cap_enabled=True
        models.AssetRecord.objects.filter(pk=asset_id).update(cit_cap_enabled=True, cit_depreciable_cap=Decimal("0"))
        ef24 = self.client.post(preview_url, {"month": 5, "year": 2026}, format="json")
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(
            str(ef24.data["detail"]),
            "Chưa đủ dữ liệu xác định chi phí khấu hao theo thuế TNDN.",
        )
        models.AssetRecord.objects.filter(pk=asset_id).update(cit_cap_enabled=False)

        # EF15: Mismatched total_accounting_amount vs depreciation total
        ef15 = self.client.post(
            save_url,
            {
                "month": 5,
                "year": 2026,
                "voucher_no": "KH052026",
                "total_accounting_amount": "999999",
            },
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(
            str(ef15.data["detail"]),
            "Số tiền khấu hao, phân bổ và hạch toán không khớp.",
        )

        # Save valid voucher for 05/2026
        ok_save = self.client.post(
            save_url,
            {"month": 5, "year": 2026, "voucher_no": "KH052026", "post_now": True},
            format="json",
        )
        self.assertEqual(ok_save.status_code, 201, ok_save.data)

        # EF16: Duplicate depreciation calculation in same period without recalculate
        ef16 = self.client.post(
            save_url,
            {"month": 5, "year": 2026, "voucher_no": "KH052026-DUP"},
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(
            str(ef16.data["detail"]),
            "Tài sản đã được tính khấu hao trong kỳ đã chọn.",
        )

        # EF05: Duplicate voucher_no in another period (06/2026)
        ef05 = self.client.post(
            save_url,
            {"month": 6, "year": 2026, "voucher_no": "KH052026"},
            format="json",
        )
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(
            str(ef05.data["voucher_no"]),
            "Số chứng từ đã tồn tại. Vui lòng nhập số khác.",
        )

        # EF03: Closed accounting period
        self.client.post(
            f"/api/v1/fixed-assets/periods/{self.query}",
            {
                "company": str(self.company.id),
                "code": "2026-06",
                "start_date": "2026-06-01",
                "end_date": "2026-06-30",
                "status": "CLOSED",
            },
            format="json",
        )
        ef03 = self.client.post(preview_url, {"month": 6, "year": 2026}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(
            str(ef03.data["period"]),
            "Kỳ kế toán đã khóa, không thể tính khấu hao tài sản cố định.",
        )

        # EF17: Recalculate period 05/2026 when subsequent period 06/2026 is CLOSED
        ef17 = self.client.post(
            save_url,
            {"month": 5, "year": 2026, "voucher_no": "KH052026", "recalculate": True},
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(
            str(ef17.data["period"]),
            "Không thể tính lại khấu hao vì ảnh hưởng đến kỳ kế toán đã khóa.",
        )

        # EF01: Unauthorized user check
        unauth_user = get_user_model().objects.create_user(username="no-dep-perm", email="nodep@fa.test", password="x")
        self.client.force_authenticate(unauth_user)
        ef01 = self.client.post(preview_url, {"month": 5, "year": 2026}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền tính khấu hao tài sản cố định.")

    # ==========================================================================
    # UC-FA-04 — GHI NHẬN KHẤU HAO TÀI SẢN
    # ==========================================================================

    def test_uc_fa_04_main_flow_example_4_7_and_gl_posting(self):
        """
        UC-FA-04 Main Flow (Steps 1–22) & Section 4.7 Example:
        - Máy móc A: NG 120,000,000, HM lũy kế trước kỳ 20,000,000, KH kỳ 03/2026 = 2,000,000 (TK 6274 / 2141)
        - Thiết bị văn phòng B: NG 90,000,000, KH kỳ 03/2026 = 1,500,000 (TK 6424 / 2141)
        - Chứng từ lập từ UC-FA-03 ở trạng thái Chưa ghi sổ (CALCULATED) -> Ghi sổ (UC-FA-04) -> Đã ghi sổ (POSTED).
        """
        from general_ledger.models import JournalEntry, JournalLine

        # 1. Acquire Máy móc A
        acq_a = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-04-A",
                code="TS-04-A",
                name="Máy móc A",
                acquisition_date="2025-05-01",
                in_service_date="2025-05-01",
                depreciation_start_date="2025-05-01",
                original_cost="120000000",
                depreciable_amount="120000000",
                useful_life_value="5",
                useful_life_unit="Năm",
                monthly_depreciation_amount="2000000",
                annual_depreciation_amount="24000000",
                origins=[],
                allocations=[
                    {
                        "department_id": str(self.department.id),
                        "target_code": "PXSX",
                        "target_name": "Phân xưởng sản xuất",
                        "rate": "100",
                        "expense_account": str(self.accounts[2].id),
                        "expense_account_code": "642",
                        "cost_item": "CP SXC",
                    }
                ],
            ),
            format="json",
        )
        self.assertEqual(acq_a.status_code, 201, acq_a.data)
        asset_a_id = acq_a.data["asset"]["id"]
        models.AssetRecord.objects.filter(pk=asset_a_id).update(
            accumulated_depreciation=Decimal("20000000"),
            periods_processed=10,
        )

        # 2. Acquire Thiết bị văn phòng B
        acq_b = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-04-B",
                code="TS-04-B",
                name="Thiết bị văn phòng B",
                acquisition_date="2026-01-01",
                in_service_date="2026-01-01",
                depreciation_start_date="2026-01-01",
                original_cost="90000000",
                depreciable_amount="90000000",
                useful_life_value="5",
                useful_life_unit="Năm",
                monthly_depreciation_amount="1500000",
                annual_depreciation_amount="18000000",
                origins=[],
                allocations=[
                    {
                        "department_id": str(self.department2.id),
                        "target_code": "PQL",
                        "target_name": "Phòng Quản lý",
                        "rate": "100",
                        "expense_account": str(self.accounts[2].id),
                        "expense_account_code": "642",
                        "cost_item": "CP QLDN",
                    }
                ],
            ),
            format="json",
        )
        self.assertEqual(acq_b.status_code, 201, acq_b.data)
        asset_b_id = acq_b.data["asset"]["id"]

        # 3. UC-FA-03: Save voucher in CALCULATED ("Chưa ghi sổ") status (post_now=False)
        save_resp = self.client.post(
            f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}",
            {
                "month": 3,
                "year": 2026,
                "voucher_no": "KH032026",
                "voucher_date": "31/03/2026",
                "posting_date": "31/03/2026",
                "description": "Khấu hao TSCĐ tháng 03 năm 2026",
                "post_now": False,
            },
            format="json",
        )
        self.assertEqual(save_resp.status_code, 201, save_resp.data)
        self.assertEqual(save_resp.data["status"], "CALCULATED")
        self.assertFalse(save_resp.data["posted"])
        run_id = save_resp.data["id"]

        # Verify asset A still has opening accumulated_depreciation = 20,000,000 while unposted
        asset_a_before = models.AssetRecord.objects.get(pk=asset_a_id)
        self.assertEqual(asset_a_before.accumulated_depreciation, Decimal("20000000"))
        self.assertEqual(asset_a_before.remaining_value, Decimal("100000000"))

        # 4. UC-FA-04 Step 20–22: Post ("Ghi sổ") the unposted depreciation voucher
        post_resp = self.client.post(
            f"/api/v1/fixed-assets/calculations/{run_id}/post/{self.query}",
            {
                "voucher_no": "KH032026",
                "voucher_date": "31/03/2026",
                "posting_date": "31/03/2026",
                "month": 3,
                "year": 2026,
                "description": "Ghi nhận khấu hao TSCĐ tháng 03 năm 2026",
            },
            format="json",
        )
        self.assertEqual(post_resp.status_code, 200, post_resp.data)
        self.assertEqual(post_resp.data["status"], "POSTED")
        self.assertTrue(post_resp.data["posted"])
        self.assertEqual(post_resp.data["message"], "Ghi sổ chứng từ khấu hao thành công.")
        self.assertEqual(Decimal(post_resp.data["total_amount"]), Decimal("3500000"))

        # 5. Verify Section 4.7 asset balances after posting (BR19–BR22)
        asset_a_after = models.AssetRecord.objects.get(pk=asset_a_id)
        self.assertEqual(asset_a_after.original_cost, Decimal("120000000"))
        self.assertEqual(asset_a_after.accumulated_depreciation, Decimal("22000000"))
        self.assertEqual(asset_a_after.remaining_value, Decimal("98000000"))

        asset_b_after = models.AssetRecord.objects.get(pk=asset_b_id)
        self.assertEqual(asset_b_after.original_cost, Decimal("90000000"))
        self.assertEqual(asset_b_after.accumulated_depreciation, Decimal("1500000"))
        self.assertEqual(asset_b_after.remaining_value, Decimal("88500000"))

        # 6. Verify General Ledger JournalEntry and JournalLines created and balanced (BR13–BR17)
        gl_entry_id = post_resp.data["gl_entry_id"]
        self.assertTrue(gl_entry_id)
        gl_entry = JournalEntry.objects.get(pk=gl_entry_id)
        self.assertEqual(gl_entry.status, "POSTED")
        self.assertEqual(gl_entry.total_debit, Decimal("3500000"))
        self.assertEqual(gl_entry.total_credit, Decimal("3500000"))
        gl_lines = list(JournalLine.objects.filter(entry=gl_entry).select_related("account").order_by("line_no"))
        self.assertEqual(len(gl_lines), 4)
        self.assertEqual(sum(l.debit for l in gl_lines), Decimal("3500000"))
        self.assertEqual(sum(l.credit for l in gl_lines), Decimal("3500000"))

        # 7. Verify BR24: Direct edit on POSTED voucher is blocked
        patch_resp = self.client.patch(
            f"/api/v1/fixed-assets/calculations/{run_id}/{self.query}",
            {"description": "Sửa trái phép sau khi ghi sổ"},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 400)

        # 8. Verify BR30: AuditLog recorded for POST_DEPRECIATION
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company,
                entity_id=str(run_id),
                action_code="POST_DEPRECIATION",
            ).exists()
        )

    def test_uc_fa_04_alternative_flows_edit_allocations_consolidation_prior_period_idempotency(self):
        """
        UC-FA-04 Alternative Flows:
        - AF04: Edit allocations / expense accounts before posting -> updates accounting_entries
        - AF05 & BR16: Consolidate accounting entries sharing (debit, credit, department, cost_item) with source_asset_codes traceability
        - AF13: Block posting period 05/2026 while prior period 04/2026 voucher for the same assets is still unposted (CALCULATED)
        - AF16: Idempotent retry on POSTED voucher with matching idempotency_key
        """
        for idx, code in enumerate(("TS-AF-1", "TS-AF-2"), 1):
            self.client.post(
                f"/api/v1/fixed-assets/assets/acquire/{self.query}",
                self._base_uc_fa_01_payload(
                    voucher_no=f"GT-AF-{idx}",
                    code=code,
                    name=f"Tài sản gộp {idx}",
                    acquisition_date="2026-01-01",
                    in_service_date="2026-01-01",
                    depreciation_start_date="2026-01-01",
                    original_cost="60000000",
                    depreciable_amount="60000000",
                    useful_life_value="5",
                    useful_life_unit="Năm",
                    monthly_depreciation_amount="1000000",
                    annual_depreciation_amount="12000000",
                    origins=[],
                    allocations=[
                        {
                            "department_id": str(self.department2.id),
                            "target_code": "PKD",
                            "target_name": "Phòng Kinh doanh",
                            "rate": "100",
                            "expense_account": str(self.accounts[2].id),
                            "expense_account_code": "642",
                            "cost_item": "CPBH",
                        }
                    ],
                ),
                format="json",
            )

        # Save Period 04/2026 unposted (CALCULATED)
        r04 = self.client.post(
            f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}",
            {"month": 4, "year": 2026, "voucher_no": "KH042026-AF", "post_now": False},
            format="json",
        )
        self.assertEqual(r04.status_code, 201, r04.data)
        run04_id = r04.data["id"]

        # Save Period 05/2026 unposted (CALCULATED)
        r05 = self.client.post(
            f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}",
            {"month": 5, "year": 2026, "voucher_no": "KH052026-AF", "post_now": False},
            format="json",
        )
        self.assertEqual(r05.status_code, 201, r05.data)
        run05_id = r05.data["id"]

        # AF13: Attempt to post Period 05/2026 while Period 04/2026 is still CALCULATED
        af13 = self.client.post(
            f"/api/v1/fixed-assets/calculations/{run05_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(af13.status_code, 400)
        self.assertEqual(
            str(af13.data["period"]),
            "Khấu hao kỳ trước chưa được ghi sổ. Vui lòng ghi sổ kỳ trước trước khi thực hiện.",
        )

        # AF04 & AF05: Post Period 04/2026 with updated expense_account="6424" and consolidate_accounting_entries=True
        updated_allocs = []
        for alloc in r04.data["allocations_snapshot"]:
            updated_allocs.append({**alloc, "expense_account": "6424", "department_name": "Phòng Quản lý", "cost_item": "CPQL"})

        post04 = self.client.post(
            f"/api/v1/fixed-assets/calculations/{run04_id}/post/{self.query}",
            {
                "allocations": updated_allocs,
                "consolidate_accounting_entries": True,
                "idempotency_key": "IDEM-POST-04",
            },
            format="json",
        )
        self.assertEqual(post04.status_code, 200, post04.data)
        self.assertEqual(post04.data["status"], "POSTED")
        # Both assets (1,000,000 + 1,000,000 = 2,000,000) consolidated into 1 accounting line with source_asset_codes
        self.assertEqual(len(post04.data["accounting_entries"]), 1)
        consolidated_line = post04.data["accounting_entries"][0]
        self.assertEqual(consolidated_line["debit_account"], "6424")
        self.assertEqual(Decimal(consolidated_line["amount"]), Decimal("2000000"))
        self.assertEqual(sorted(consolidated_line["source_asset_codes"]), ["TS-AF-1", "TS-AF-2"])

        # AF16: Idempotent retry with same idempotency_key returns 200 without error
        retry04 = self.client.post(
            f"/api/v1/fixed-assets/calculations/{run04_id}/post/{self.query}",
            {"idempotency_key": "IDEM-POST-04"},
            format="json",
        )
        self.assertEqual(retry04.status_code, 200)
        self.assertEqual(retry04.data["status"], "POSTED")

        # Recalculate Period 05/2026 after Period 04/2026 was posted (so opening accumulated depreciation is updated), then post Period 05/2026
        r05_recalc = self.client.post(
            f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}",
            {"month": 5, "year": 2026, "voucher_no": "KH052026-AF", "post_now": False, "recalculate": True},
            format="json",
        )
        self.assertEqual(r05_recalc.status_code, 201, r05_recalc.data)
        run05_id = r05_recalc.data["id"]
        post05 = self.client.post(
            f"/api/v1/fixed-assets/calculations/{run05_id}/post/{self.query}",
            {},
            format="json",
        )
        self.assertEqual(post05.status_code, 200, post05.data)
        self.assertEqual(post05.data["status"], "POSTED")

    def test_uc_fa_04_exception_flows_ef01_to_ef21(self):
        """
        UC-FA-04 Exception Flows EF01–EF21 verification with exact Vietnamese messages.
        """
        import uuid

        # EF01: Non-existent depreciation voucher
        fake_id = uuid.uuid4()
        ef01 = self.client.post(f"/api/v1/fixed-assets/calculations/{fake_id}/post/{self.query}", {}, format="json")
        self.assertEqual(ef01.status_code, 404)
        self.assertEqual(str(ef01.data["detail"]), "Không tìm thấy chứng từ khấu hao.")

        # Create active asset and unposted voucher for period 07/2026
        acq = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-EF04",
                code="TS-EF04",
                name="Thiết bị kiểm thử EF04",
                acquisition_date="2026-01-01",
                in_service_date="2026-01-01",
                depreciation_start_date="2026-01-01",
                original_cost="120000000",
                depreciable_amount="120000000",
                useful_life_value="5",
                useful_life_unit="Năm",
                monthly_depreciation_amount="2000000",
                annual_depreciation_amount="24000000",
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(acq.status_code, 201, acq.data)
        asset_id = acq.data["asset"]["id"]

        saved = self.client.post(
            f"/api/v1/fixed-assets/calculations/save-voucher/{self.query}",
            {"month": 7, "year": 2026, "voucher_no": "KH072026", "post_now": False},
            format="json",
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        run_id = saved.data["id"]
        post_url = f"/api/v1/fixed-assets/calculations/{run_id}/post/{self.query}"

        # EF04: Invalid / empty voucher_no
        ef04 = self.client.post(post_url, {"voucher_no": "   "}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["voucher_no"]), "Số chứng từ khấu hao không hợp lệ.")

        # EF07: Missing / invalid depreciation period
        ef07 = self.client.post(post_url, {"month": "", "year": 2026}, format="json")
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["period"]), "Chưa xác định được kỳ khấu hao của chứng từ.")

        # EF05: Invalid posting_date or mismatch with period
        ef05 = self.client.post(post_url, {"posting_date": "15/08/2026"}, format="json")
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["posting_date"]), "Ngày hạch toán không hợp lệ. Vui lòng kiểm tra lại.")

        # EF10: Empty lines
        ef10 = self.client.post(post_url, {"lines": []}, format="json")
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["lines"]), "Chứng từ chưa có dữ liệu khấu hao để ghi nhận.")

        # EF13: Incomplete allocations (empty or rate != 100%)
        ef13 = self.client.post(post_url, {"allocations": []}, format="json")
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["allocations"]), "Chưa thiết lập đầy đủ thông tin phân bổ khấu hao.")

        # EF11: Total allocation amount mismatch
        ef11 = self.client.post(post_url, {"total_allocation_amount": "999999"}, format="json")
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["allocations"]), "Tổng tiền phân bổ không khớp với số khấu hao đã tính.")

        # EF08: Invalid debit account
        bad_debit_entries = [{**saved.data["accounting_entries"][0], "debit_account": "1111"}]
        ef08 = self.client.post(post_url, {"accounting_entries": bad_debit_entries}, format="json")
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["debit_account"]), "Tài khoản ghi Nợ không hợp lệ.")

        # EF09: Invalid credit account (not 214x or mismatched with asset accumulated account)
        bad_credit_entries = [{**saved.data["accounting_entries"][0], "credit_account": "331"}]
        ef09 = self.client.post(post_url, {"accounting_entries": bad_credit_entries}, format="json")
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["credit_account"]), "Tài khoản hao mòn TSCĐ không hợp lệ.")

        # EF12: Accounting entry amount mismatch with depreciation total
        bad_amt_entries = [{**saved.data["accounting_entries"][0], "amount": "1500000"}]
        ef12 = self.client.post(post_url, {"accounting_entries": bad_amt_entries}, format="json")
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(
            str(ef12.data["accounting_entries"]),
            "Số tiền hạch toán không khớp với số khấu hao của chứng từ.",
        )

        # EF15: Custom depreciation line amount exceeds remaining allowed depreciable value
        ef15 = self.client.post(
            post_url,
            {"custom_lines": [{"asset_id": asset_id, "amount": "500000000"}]},
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(str(ef15.data["amount"]), "Giá trị khấu hao vượt mức được phép của tài sản.")

        # EF16: Asset version / original_cost changed after calculation
        ef16 = self.client.post(
            post_url,
            {"expected_asset_versions": {asset_id: 999}},
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(
            str(ef16.data["detail"]),
            "Dữ liệu tài sản đã thay đổi. Vui lòng tính lại khấu hao trước khi ghi sổ.",
        )

        # EF17: Asset suspended or disposed before posting
        models.AssetRecord.objects.filter(pk=asset_id).update(status=models.AssetStatus.SUSPENDED)
        ef17 = self.client.post(post_url, {}, format="json")
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(
            str(ef17.data["detail"]),
            "Thông tin tài sản không còn phù hợp với kết quả khấu hao. Vui lòng kiểm tra lại.",
        )
        models.AssetRecord.objects.filter(pk=asset_id).update(status=models.AssetStatus.ACTIVE)

        # EF18: GL creation failure -> rolls back atomically so asset accumulated_depreciation stays 0 (BR23)
        ef18 = self.client.post(post_url, {"simulate_gl_error": True}, format="json")
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(
            str(ef18.data["detail"]),
            "Không thể hạch toán chứng từ khấu hao. Vui lòng thử lại.",
        )
        self.assertEqual(models.AssetRecord.objects.get(pk=asset_id).accumulated_depreciation, Decimal("0"))

        # EF20: Concurrent lock during posting
        ef20 = self.client.post(post_url, {"simulate_concurrent_lock": True}, format="json")
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(
            str(ef20.data["detail"]),
            "Chứng từ đang được xử lý. Vui lòng thử lại sau.",
        )

        # EF06: Locked accounting period
        period_resp = self.client.post(
            f"/api/v1/fixed-assets/periods/{self.query}",
            {
                "company": str(self.company.id),
                "code": "2026-07-LOCK",
                "start_date": "2026-07-01",
                "end_date": "2026-07-31",
                "status": "CLOSED",
            },
            format="json",
        )
        ef06 = self.client.post(post_url, {}, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(
            str(ef06.data["period"]),
            "Kỳ kế toán đã khóa, không thể ghi sổ chứng từ khấu hao.",
        )
        models.AssetPeriod.objects.filter(pk=period_resp.data["id"]).delete()

        # EF14: Asset already has a POSTED depreciation transaction in period 2026-07
        dup_tx = models.AssetTransaction.objects.create(
            company=self.company,
            asset_id=asset_id,
            number="KH-DUP-07",
            transaction_type="DEPRECIATION",
            transaction_date="2026-07-31",
            amount=Decimal("2000000"),
            period_code="2026-07",
            status="POSTED",
            created_by=services.actor(type("Req", (), {"user": self.maker})()),
        )
        ef14 = self.client.post(post_url, {}, format="json")
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(
            str(ef14.data["detail"]),
            "Tài sản đã được ghi nhận khấu hao trong kỳ này.",
        )
        dup_tx.delete()

        # Post successfully, then test EF03 (Already posted voucher)
        ok_post = self.client.post(post_url, {}, format="json")
        self.assertEqual(ok_post.status_code, 200, ok_post.data)
        ef03 = self.client.post(post_url, {}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["status"]), "Chứng từ khấu hao đã được ghi sổ.")

        # EF21: Cross-company access denied
        other_company = Company.objects.create(
            code="OTHERFA",
            name="Other FA Co",
            legal_name="Other FA Company",
            tax_code="0100998877",
            accounting_currency=self.company.accounting_currency,
            legal_reporting_currency=self.company.legal_reporting_currency,
        )
        ef21 = self.client.post(
            f"/api/v1/fixed-assets/calculations/{run_id}/post/?company_id={other_company.id}",
            {},
            format="json",
        )
        self.assertEqual(ef21.status_code, 403)
        self.assertEqual(
            str(ef21.data["detail"]),
            "Bạn không có quyền ghi sổ chứng từ khấu hao thuộc doanh nghiệp khác.",
        )

        # EF02: User without FA.CALCULATION.POST permission
        no_post_user = get_user_model().objects.create_user(username="no-post-perm", email="nopost@fa.test", password="x")
        self.client.force_authenticate(no_post_user)
        ef02 = self.client.post(post_url, {}, format="json")
        self.assertEqual(ef02.status_code, 403)
        self.assertEqual(str(ef02.data["detail"]), "Bạn không có quyền ghi sổ chứng từ khấu hao.")

    # ==========================================================================
    # UC-FA-05 – Điều chuyển tài sản cố định (Fixed Asset Transfer)
    # ==========================================================================

    def _acquire_asset_for_uc05(self, code, cost, periods, acq_date="01/01/2026", department=None, allocations=None):
        dept = department or self.department
        payload = self._base_uc_fa_01_payload(
            voucher_no=f"GT-{code}",
            code=code,
            name=f"Tài sản {code}",
            department=str(dept.id),
            acquisition_date=acq_date,
            in_service_date=acq_date,
            depreciation_start_date=acq_date,
            original_cost=str(cost),
            depreciable_amount=str(cost),
            useful_life_value=str(periods),
            useful_life_unit="Tháng",
            origins=[],
        )
        if allocations is not None:
            payload["allocations"] = allocations
        else:
            payload["allocations"] = [
                {
                    "department_id": str(dept.id),
                    "department_name": dept.name,
                    "rate": "100",
                    "expense_account": str(self.accounts[2].id),
                    "expense_account_code": self.accounts[2].code,
                    "expense_item": "Chi phí khấu hao TSCĐ",
                    "cost_center": dept.name,
                }
            ]
        resp = self.client.post(f"/api/v1/fixed-assets/assets/acquire/{self.query}", payload, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        return resp.data["asset"]

    def test_uc_fa_05_main_flow_example_5_7_and_audit_log(self):
        """
        Tests UC-FA-05 Main Flow (Steps 1-30) and Section 5.7 Worked Example:
        - Proposes next transfer voucher number (ĐCTS00001 -> ĐCTS00025 -> ĐCTS00026)
        - Transfers TS005 (Máy phát điện, Nguyên giá 200,000,000, Hao mòn lũy kế 60,000,000,
          Giá trị còn lại 140,000,000) from Phòng Kỹ thuật to Ban Quản lý Công trình on 15/10/2026
        - Preserves original_cost, accumulated_depreciation, remaining_value, sets gl_status='NOT_REQUIRED'
        - Updates department, cost tracking (Công trình A, Chi phí khấu hao TSCĐ), and AuditLog
        """
        self.client.force_authenticate(self.maker)

        dept_kt = Department.objects.create(
            company=self.company,
            branch=self.branch,
            code="PKT",
            name="Phòng Kỹ thuật",
        )
        dept_bql = Department.objects.create(
            company=self.company,
            branch=self.branch,
            code="BQLCT",
            name="Ban Quản lý Công trình",
        )

        # Create TS005 with Original Cost 200M, Accumulated Depr 60M, Remaining 140M
        ts005_data = self._acquire_asset_for_uc05(
            "TS005", "200000000", 60, acq_date="15/01/2024", department=dept_kt
        )
        ts005_id = ts005_data["id"]
        models.AssetRecord.objects.filter(pk=ts005_id).update(
            name="Máy phát điện",
            accumulated_depreciation=Decimal("60000000.00"),
        )

        # Step 4: Check next-transfer-number auto-proposal
        next_no_resp = self.client.get(
            f"/api/v1/fixed-assets/transactions/next-transfer-number/?company_id={self.company.id}"
        )
        self.assertEqual(next_no_resp.status_code, 200, next_no_resp.data)
        self.assertEqual(next_no_resp.data["voucher_no"], "ĐCTS00001")

        # Execute Section 5.7 transfer (ĐCTS00025 on 15/10/2026)
        transfer_resp = self.client.post(
            "/api/v1/fixed-assets/transactions/transfer/",
            {
                "company": str(self.company.id),
                "voucher_no": "ĐCTS00025",
                "transaction_date": "15/10/2026",
                "deliverer": "Nguyễn Văn A",
                "receiver": "Trần Văn B",
                "reason": "Điều chuyển máy phát điện phục vụ thi công Công trình A",
                "reference": "QĐ-ĐC-2026/25",
                "attachments": [
                    {"name": "bien_ban_ban_giao_TS005.pdf", "size": 512000}
                ],
                "lines": [
                    {
                        "asset_id": ts005_id,
                        "asset_code": "TS005",
                        "from_department": "Phòng Kỹ thuật",
                        "to_department": str(dept_bql.id),
                        "project": "Công trình A",
                        "expense_item": "Chi phí khấu hao TSCĐ",
                        "cost_object": "Công trình A",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(transfer_resp.status_code, 201, transfer_resp.data)
        self.assertEqual(
            transfer_resp.data["message"],
            "Điều chuyển tài sản cố định thành công.",
        )
        self.assertEqual(transfer_resp.data["voucher_no"], "ĐCTS00025")
        self.assertEqual(transfer_resp.data["status"], "POSTED")
        self.assertEqual(transfer_resp.data["status_display"], "Đã ghi sổ")
        self.assertEqual(transfer_resp.data["gl_status"], "NOT_REQUIRED")
        self.assertEqual(len(transfer_resp.data["lines"]), 1)

        line_data = transfer_resp.data["lines"][0]
        self.assertEqual(line_data["asset_code"], "TS005")
        self.assertEqual(line_data["from_department_name"], "Phòng Kỹ thuật")
        self.assertEqual(line_data["to_department_name"], "Ban Quản lý Công trình")
        self.assertEqual(line_data["project"], "Công trình A")
        self.assertEqual(line_data["expense_item"], "Chi phí khấu hao TSCĐ")
        self.assertEqual(line_data["cost_object"], "Công trình A")
        self.assertEqual(Decimal(line_data["original_cost"]), Decimal("200000000.00"))
        self.assertEqual(Decimal(line_data["accumulated_depreciation"]), Decimal("60000000.00"))
        self.assertEqual(Decimal(line_data["remaining_value"]), Decimal("140000000.00"))

        # Verify AssetRecord state in database (Section 5.3 - 5.5, BR28)
        ts005 = models.AssetRecord.objects.get(pk=ts005_id)
        self.assertEqual(ts005.department_id, dept_bql.id)
        self.assertEqual(ts005.original_cost, Decimal("200000000.00"))
        self.assertEqual(ts005.accumulated_depreciation, Decimal("60000000.00"))
        self.assertEqual(ts005.remaining_value, Decimal("140000000.00"))
        self.assertEqual(ts005.allocations[0]["department_name"], "Ban Quản lý Công trình")
        self.assertEqual(ts005.allocations[0]["project"], "Công trình A")
        self.assertEqual(ts005.allocations[0]["expense_item"], "Chi phí khấu hao TSCĐ")

        # Verify next sequential number increments from ĐCTS00025 -> ĐCTS00026
        next_after = self.client.get(
            f"/api/v1/fixed-assets/transactions/next-transfer-number/?company_id={self.company.id}"
        )
        self.assertEqual(next_after.status_code, 200)
        self.assertEqual(next_after.data["voucher_no"], "ĐCTS00026")

        # Verify AuditLog & Asset History (BR31, BR40)
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company,
                entity_id=ts005.id,
                action_code="TRANSFER_ASSET",
            ).exists()
        )
        hist_resp = self.client.get(
            f"/api/v1/fixed-assets/assets/{ts005_id}/history/?company_id={self.company.id}"
        )
        self.assertEqual(hist_resp.status_code, 200)
        transfer_txs = [t for t in hist_resp.data["transactions"] if t["transaction_type"] == "TRANSFER"]
        self.assertEqual(len(transfer_txs), 1)
        self.assertEqual(transfer_txs[0]["voucher_no"], "ĐCTS00025")
        self.assertEqual(transfer_txs[0]["from_department_name"], "Phòng Kỹ thuật")
        self.assertEqual(transfer_txs[0]["to_department_name"], "Ban Quản lý Công trình")
        self.assertEqual(transfer_txs[0]["deliverer"], "Nguyễn Văn A")
        self.assertEqual(transfer_txs[0]["receiver"], "Trần Văn B")

    def test_uc_fa_05_alternative_flows_multi_asset_sequential_transfers_and_depreciation_allocation(self):
        """
        Tests UC-FA-05 Alternative Flows:
        - AF04: Year-based voucher numbering (ĐCTS-2026-00001)
        - AF11: Multi-department allocation ratio preservation upon transfer
        - AF12: Multi-asset transfer in a single voucher
        - AF13: Clearing cost tracking dimensions when moving to an administrative department
        - AF20 & Section 5.6: Mid-period transfer with day-ratio depreciation split vs full-period allocation
        - AF24: Sequential transfers of the same asset across multiple dates
        """
        self.client.force_authenticate(self.maker)
        dept_a = self.department
        dept_b = Department.objects.create(company=self.company, branch=self.branch, code="PB-B", name="Phòng Kinh doanh")
        dept_c = Department.objects.create(company=self.company, branch=self.branch, code="PB-C", name="Phòng Hành chính")

        a1 = self._acquire_asset_for_uc05("TS-M01", "60000000", 60, "01/01/2026")
        a2 = self._acquire_asset_for_uc05(
            "TS-M02",
            "120000000",
            60,
            "01/01/2026",
            allocations=[
                {
                    "department_id": str(dept_a.id),
                    "department_name": dept_a.name,
                    "rate": "60",
                    "expense_account": str(self.accounts[2].id),
                    "expense_account_code": self.accounts[2].code,
                    "expense_item": "Chi phí khấu hao TSCĐ",
                    "cost_center": dept_a.name,
                },
                {
                    "department_id": str(dept_c.id),
                    "department_name": dept_c.name,
                    "rate": "40",
                    "expense_account": str(self.accounts[2].id),
                    "expense_account_code": self.accounts[2].code,
                    "expense_item": "Chi phí khấu hao TSCĐ",
                    "cost_center": dept_c.name,
                },
            ],
        )

        # AF04: Year-based numbering check
        yr_no_resp = self.client.get(
            f"/api/v1/fixed-assets/transactions/next-transfer-number/?company_id={self.company.id}&year_based=true&transaction_date=05/10/2026"
        )
        self.assertEqual(yr_no_resp.status_code, 200)
        self.assertEqual(yr_no_resp.data["voucher_no"], "ĐCTS-2026-00001")

        # AF12 & AF11: Multi-asset transfer in one voucher (a1 single-alloc, a2 multi-alloc 60/40)
        multi_resp = self.client.post(
            "/api/v1/fixed-assets/transactions/transfer/",
            {
                "company": str(self.company.id),
                "voucher_no": "ĐCTS-2026-00001",
                "transaction_date": "05/10/2026",
                "deliverer": "Lê Văn Giao",
                "receiver": "Phạm Thị Nhận",
                "reason": "Điều chuyển thiết bị sang Phòng Kinh doanh",
                "lines": [
                    {
                        "asset_id": a1["id"],
                        "to_department": str(dept_b.id),
                        "sales_contract": "HĐB-2026-01",
                        "sales_order": "ĐĐH-2026-01",
                        "project": "Dự án Mở rộng KD",
                        "expense_item": "CPKH Bán hàng",
                        "cost_object": "Trung tâm KD 01",
                    },
                    {
                        "asset_id": a2["id"],
                        "to_department": str(dept_b.id),
                        "expense_item": "CPKH Bán hàng",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(multi_resp.status_code, 201, multi_resp.data)
        self.assertEqual(len(multi_resp.data["lines"]), 2)

        # Verify AF11: a2 kept its 60% / 40% split, with the 60% slot updated from dept_a to dept_b
        a2_rec = models.AssetRecord.objects.get(pk=a2["id"])
        self.assertEqual(a2_rec.department_id, dept_b.id)
        self.assertEqual(len(a2_rec.allocations), 2)
        self.assertEqual(a2_rec.allocations[0]["department_name"], dept_b.name)
        self.assertEqual(Decimal(a2_rec.allocations[0]["rate"]), Decimal("60"))
        self.assertEqual(a2_rec.allocations[1]["department_name"], dept_c.name)
        self.assertEqual(Decimal(a2_rec.allocations[1]["rate"]), Decimal("40"))

        # AF24 & AF13: Sequential transfer of a1 on 16/10/2026 from dept_b -> dept_c with clear_cost_tracking
        # and prorate_in_period=True (AF20 / Section 5.6 Phương án 2)
        seq_resp = self.client.post(
            "/api/v1/fixed-assets/transactions/transfer/",
            {
                "company": str(self.company.id),
                "voucher_no": "ĐCTS-2026-00002",
                "transaction_date": "16/10/2026",
                "deliverer": "Phạm Thị Nhận",
                "receiver": "Hoàng Văn Hành Chính",
                "reason": "Điều chuyển tiếp về Phòng Hành chính và xóa thông tin công trình cũ",
                "prorate_in_period": True,
                "lines": [
                    {
                        "asset_id": a1["id"],
                        "from_department": dept_b.name,
                        "to_department": str(dept_c.id),
                        "clear_cost_tracking": True,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(seq_resp.status_code, 201, seq_resp.data)
        a1_rec = models.AssetRecord.objects.get(pk=a1["id"])
        self.assertEqual(a1_rec.department_id, dept_c.id)
        self.assertEqual(a1_rec.allocations[0]["project"], "")
        self.assertEqual(a1_rec.allocations[0]["sales_contract"], "")

        # Verify Section 5.6 / AF20: Calculate depreciation for October 2026 (31 days; 15 days before 16/10, 16 days from 16/10)
        preview_resp = self.client.get(
            f"/api/v1/fixed-assets/calculations/preview/?company_id={self.company.id}&month=10&year=2026"
        )
        self.assertEqual(preview_resp.status_code, 200, preview_resp.data)
        a1_allocs = [
            al for al in preview_resp.data["allocations"] if al["asset_code"] == "TS-M01"
        ]
        self.assertEqual(len(a1_allocs), 2)
        self.assertEqual(a1_allocs[0]["department_name"], dept_b.name)
        self.assertEqual(a1_allocs[1]["department_name"], dept_c.name)
        total_alloc = sum(Decimal(al["allocated_amount"]) for al in a1_allocs)
        self.assertEqual(total_alloc, Decimal("1000000.00"))

    def test_uc_fa_05_exception_flows_ef01_to_ef34(self):
        """
        Tests UC-FA-05 Exception Flows EF01 through EF34 with exact Vietnamese messages
        and verifies atomic batch rollback on failure (EF31, BR35) and idempotency (EF32, BR36).
        """
        self.client.force_authenticate(self.maker)
        dept_from = self.department
        dept_to = Department.objects.create(
            company=self.company, branch=self.branch, code="PB-NHAN", name="Phòng Tiếp nhận"
        )
        asset1 = self._acquire_asset_for_uc05("TS-EF05-1", "60000000", 60, "01/03/2026")
        asset2 = self._acquire_asset_for_uc05("TS-EF05-2", "90000000", 60, "01/03/2026")

        url = "/api/v1/fixed-assets/transactions/transfer/"
        base_payload = {
            "company": str(self.company.id),
            "voucher_no": "ĐCTS00100",
            "transaction_date": "15/06/2026",
            "deliverer": "Nguyễn Bàn Giao",
            "receiver": "Trần Tiếp Nhận",
            "reason": "Điều chuyển nội bộ phục vụ sản xuất",
            "lines": [
                {
                    "asset_id": asset1["id"],
                    "asset_code": "TS-EF05-1",
                    "from_department": dept_from.name,
                    "to_department": str(dept_to.id),
                }
            ],
        }

        # EF02: Numbering rule not configured
        ef02 = self.client.post(url, {**base_payload, "numbering_rule_configured": False}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(
            str(ef02.data["voucher_no"]),
            "Chưa thiết lập quy tắc đánh số biên bản điều chuyển. Vui lòng kiểm tra cấu hình chứng từ.",
        )

        # EF03: Empty voucher_no
        ef03 = self.client.post(url, {**base_payload, "voucher_no": "   "}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["voucher_no"]), "Vui lòng nhập số biên bản giao nhận.")

        # EF04: Invalid voucher_no format
        ef04 = self.client.post(url, {**base_payload, "voucher_no": "ĐCTS@#INVALID!"}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["voucher_no"]), "Số biên bản giao nhận không hợp lệ.")

        # EF07: Unauthorized manual voucher_no change when allow_manual_voucher_no=False
        ef07 = self.client.post(
            url,
            {
                **base_payload,
                "voucher_no": "ĐCTS99999",
                "allow_manual_voucher_no": False,
                "expected_voucher_no": "ĐCTS00001",
            },
            format="json",
        )
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["voucher_no"]), "Bạn không có quyền thay đổi số biên bản giao nhận.")

        # EF08: Invalid transfer date
        ef08 = self.client.post(url, {**base_payload, "transaction_date": "31-02-2026"}, format="json")
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(
            str(ef08.data["transaction_date"]),
            "Vui lòng nhập ngày điều chuyển hợp lệ theo định dạng DD/MM/YYYY.",
        )

        # EF09: Transfer in locked period
        locked_p = models.AssetPeriod.objects.create(
            company=self.company,
            code="2026-06",
            start_date="2026-06-01",
            end_date="2026-06-30",
            status="CLOSED",
        )
        ef09 = self.client.post(url, base_payload, format="json")
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["period"]), "Không thể điều chuyển tài sản trong kỳ đã khóa.")
        locked_p.delete()

        # EF10: Missing deliverer
        ef10 = self.client.post(url, {**base_payload, "deliverer": ""}, format="json")
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["deliverer"]), "Vui lòng nhập người bàn giao tài sản.")

        # EF11: Missing receiver
        ef11 = self.client.post(url, {**base_payload, "receiver": ""}, format="json")
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["receiver"]), "Vui lòng nhập người tiếp nhận tài sản.")

        # EF12: Missing reason
        ef12 = self.client.post(url, {**base_payload, "reason": ""}, format="json")
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["reason"]), "Vui lòng nhập lý do điều chuyển tài sản.")

        # EF13: Empty lines
        ef13 = self.client.post(url, {**base_payload, "lines": []}, format="json")
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["lines"]), "Vui lòng chọn ít nhất một tài sản cần điều chuyển.")

        # EF14: Non-existent asset
        ef14 = self.client.post(
            url,
            {**base_payload, "lines": [{"asset_code": "TS-KHONG-TON-TAI", "to_department": str(dept_to.id)}]},
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(str(ef14.data["asset"]), "Tài sản TS-KHONG-TON-TAI không hợp lệ.")

        # EF15: Asset not yet eligible (transfer_date < acquisition_date)
        ef15 = self.client.post(
            url,
            {**base_payload, "transaction_date": "15/01/2026"},
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(str(ef15.data["asset"]), "Tài sản TS-EF05-1 chưa đủ điều kiện điều chuyển.")

        # EF16: Disposed asset
        models.AssetRecord.objects.filter(pk=asset1["id"]).update(status="DISPOSED", disposed_at="2026-05-01")
        ef16 = self.client.post(url, base_payload, format="json")
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(str(ef16.data["asset"]), "Tài sản TS-EF05-1 đã ghi giảm, không thể điều chuyển.")
        models.AssetRecord.objects.filter(pk=asset1["id"]).update(status="ACTIVE", disposed_at=None)

        # EF17: Missing receiving department
        ef17 = self.client.post(
            url,
            {**base_payload, "lines": [{"asset_id": asset1["id"], "to_department": ""}]},
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(str(ef17.data["to_department"]), "Vui lòng chọn đơn vị tiếp nhận cho tài sản TS-EF05-1.")

        # EF18: Receiving department equals current department
        ef18 = self.client.post(
            url,
            {**base_payload, "lines": [{"asset_id": asset1["id"], "to_department": str(dept_from.id)}]},
            format="json",
        )
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(str(ef18.data["to_department"]), "Đơn vị tiếp nhận phải khác đơn vị hiện đang sử dụng tài sản.")

        # EF19: Invalid receiving department
        ef19 = self.client.post(
            url,
            {**base_payload, "lines": [{"asset_id": asset1["id"], "to_department": "PB-KHONG-TON-TAI"}]},
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(str(ef19.data["to_department"]), "Đơn vị tiếp nhận không hợp lệ.")

        # EF20: Stale from_department
        ef20 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [
                    {
                        "asset_id": asset1["id"],
                        "from_department": "Phòng Cũ Sai Lệch",
                        "to_department": str(dept_to.id),
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(str(ef20.data["from_department"]), "Đơn vị sử dụng của tài sản đã thay đổi. Vui lòng kiểm tra lại.")

        # EF21: Duplicate asset in same voucher
        ef21 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [
                    {"asset_id": asset1["id"], "to_department": str(dept_to.id)},
                    {"asset_id": asset1["id"], "to_department": str(dept_to.id)},
                ],
            },
            format="json",
        )
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(str(ef21.data["lines"]), "Tài sản TS-EF05-1 đã được chọn trong chứng từ.")

        # EF23 - EF28: Cost tracking validations
        ef23 = self.client.post(
            url,
            {**base_payload, "lines": [{**base_payload["lines"][0], "sales_contract": "INVALID-CONTRACT"}]},
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(str(ef23.data["sales_contract"]), "Hợp đồng bán không hợp lệ. Vui lòng chọn lại.")

        ef24 = self.client.post(
            url,
            {**base_payload, "lines": [{**base_payload["lines"][0], "sales_order": "INVALID-ORDER"}]},
            format="json",
        )
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(str(ef24.data["sales_order"]), "Đơn đặt hàng không phù hợp với hợp đồng bán đã chọn.")

        ef25 = self.client.post(
            url,
            {**base_payload, "lines": [{**base_payload["lines"][0], "project": "CLOSED-PROJECT"}]},
            format="json",
        )
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(str(ef25.data["project"]), "Công trình không hợp lệ hoặc không được phép tập hợp chi phí.")

        ef26 = self.client.post(
            url,
            {**base_payload, "lines": [{**base_payload["lines"][0], "expense_item": "INVALID-EXPENSE-ITEM"}]},
            format="json",
        )
        self.assertEqual(ef26.status_code, 400)
        self.assertEqual(str(ef26.data["expense_item"]), "Khoản mục chi phí không hợp lệ.")

        ef27 = self.client.post(
            url,
            {**base_payload, "lines": [{**base_payload["lines"][0], "cost_object": "INVALID-COST-OBJ"}]},
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(str(ef27.data["cost_object"]), "Đối tượng tập hợp chi phí không hợp lệ.")

        ef28 = self.client.post(
            url,
            {**base_payload, "require_cost_tracking": True},
            format="json",
        )
        self.assertEqual(ef28.status_code, 400)
        self.assertEqual(
            str(ef28.data["cost_tracking"]),
            "Vui lòng khai báo đầy đủ thông tin tập hợp chi phí cho tài sản TS-EF05-1.",
        )

        # EF30: Optimistic concurrency conflict (expected_version mismatch)
        ef30 = self.client.post(
            url,
            {**base_payload, "expected_version": 999},
            format="json",
        )
        self.assertEqual(ef30.status_code, 400)
        self.assertEqual(str(ef30.data["version"]), "Thông tin tài sản đã thay đổi. Vui lòng tải lại dữ liệu.")

        # EF31 & BR35: Atomic rollback when 2nd asset fails in a multi-asset batch
        ef31 = self.client.post(
            url,
            {
                **base_payload,
                "simulate_db_error": True,
                "lines": [
                    {"asset_id": asset1["id"], "to_department": str(dept_to.id)},
                    {"asset_id": asset2["id"], "to_department": str(dept_to.id)},
                ],
            },
            format="json",
        )
        self.assertEqual(ef31.status_code, 400)
        self.assertEqual(str(ef31.data["detail"]), "Điều chuyển tài sản cố định thất bại. Vui lòng thử lại.")
        # Verify asset1 was NOT updated because the batch rolled back atomically
        self.assertEqual(models.AssetRecord.objects.get(pk=asset1["id"]).department_id, dept_from.id)

        # EF33: Attachment exceeds 5MB
        ef33 = self.client.post(
            url,
            {
                **base_payload,
                "attachments": [{"name": "huge_scan.pdf", "size": 6 * 1024 * 1024}],
            },
            format="json",
        )
        self.assertEqual(ef33.status_code, 400)
        self.assertEqual(
            str(ef33.data["attachments"]),
            "Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.",
        )

        # EF34: Cross-company scope rejected
        ef34 = self.client.post(
            url,
            {**base_payload, "cross_company": True},
            format="json",
        )
        self.assertEqual(ef34.status_code, 400)
        self.assertEqual(str(ef34.data["company"]), "Nghiệp vụ không thuộc phạm vi điều chuyển TSCĐ nội bộ.")

        # Succeed with idempotency_key, then test EF32 (Idempotent replay) & EF05/EF06 (Duplicate voucher_no) & EF22 (Same-date conflict)
        ok_resp = self.client.post(
            url,
            {**base_payload, "idempotency_key": "IDEM-TRANSFER-100"},
            format="json",
        )
        self.assertEqual(ok_resp.status_code, 201, ok_resp.data)

        # EF32: Replay with same idempotency_key returns 200 without duplicating
        ef32 = self.client.post(
            url,
            {**base_payload, "idempotency_key": "IDEM-TRANSFER-100"},
            format="json",
        )
        self.assertEqual(ef32.status_code, 200)
        self.assertTrue(ef32.data.get("idempotent_replayed"))

        # EF05 / EF06: Duplicate voucher_no
        ef05 = self.client.post(
            url,
            {
                **base_payload,
                "voucher_no": "ĐCTS00100",
                "lines": [{"asset_id": asset2["id"], "to_department": str(dept_to.id)}],
            },
            format="json",
        )
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["voucher_no"]), "Số biên bản giao nhận đã tồn tại. Vui lòng sử dụng số khác.")

        # EF22: Transferring asset1 again on the same date (15/06/2026) or earlier date
        ef22 = self.client.post(
            url,
            {
                **base_payload,
                "voucher_no": "ĐCTS00101",
                "transaction_date": "15/06/2026",
                "lines": [{"asset_id": asset1["id"], "to_department": str(dept_from.id)}],
            },
            format="json",
        )
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(
            str(ef22.data["transaction_date"]),
            "Tài sản TS-EF05-1 đã có nghiệp vụ điều chuyển tại thời điểm này.",
        )

        # EF29: Transferring an asset in a period that already has POSTED depreciation
        depr_tx = models.AssetTransaction.objects.create(
            company=self.company,
            asset_id=asset2["id"],
            number="KH-2026-06",
            transaction_type="DEPRECIATION",
            transaction_date="2026-06-30",
            amount=Decimal("1500000"),
            period_code="2026-06",
            status="POSTED",
            created_by=services.actor(type("Req", (), {"user": self.maker})()),
        )
        ef29 = self.client.post(
            url,
            {
                **base_payload,
                "voucher_no": "ĐCTS00102",
                "transaction_date": "20/06/2026",
                "lines": [{"asset_id": asset2["id"], "to_department": str(dept_to.id)}],
            },
            format="json",
        )
        self.assertEqual(ef29.status_code, 400)
        self.assertEqual(
            str(ef29.data["transaction_date"]),
            "Điều chuyển ảnh hưởng đến dữ liệu khấu hao đã ghi sổ. Vui lòng thực hiện điều chỉnh phù hợp.",
        )
        depr_tx.delete()

        # EF01: User without FA.TRANSACTION.TRANSFER permission
        no_perm_user = get_user_model().objects.create_user(username="no-transfer-perm", email="notr@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(url, {**base_payload, "voucher_no": "ĐCTS00103"}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền điều chuyển tài sản cố định.")

    # ==========================================================================
    # UC-FA-06: ĐÁNH GIÁ LẠI TÀI SẢN CỐ ĐỊNH (FIXED ASSET REVALUATION / UPGRADE)
    # ==========================================================================

    def _acquire_asset_via_api(
        self,
        code,
        name,
        original_cost,
        useful_life_periods=60,
        acquisition_date="01/01/2024",
        in_service_date="01/01/2024",
    ):
        asset_data = self._acquire_asset_for_uc05(
            code, original_cost, useful_life_periods, acq_date=acquisition_date
        )
        models.AssetRecord.objects.filter(pk=asset_data["id"]).update(name=name)
        return asset_data

    def test_uc_fa_06_main_flow_example_4_9_upgrade_and_gl_posting(self):
        """
        UC-FA-06 Main Flow (Steps 1–47) & Worked Example 4.9:
        - TS001 (Dây chuyền đóng gói):
          Original cost before = 500,000,000; Accumulated depreciation before = 200,000,000;
          Remaining value before = 300,000,000; Useful life = 60 months, processed = 24 months ->
          Remaining months before = 36 months (Step 20, BR12).
        - Revaluation (Upgrade):
          Reason = "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản"
          Original cost after = 600,000,000 (+100,000,000)
          Accumulated depreciation after = 200,000,000 (diff = 0)
          Remaining value after = 400,000,000 (+100,000,000)
          Remaining months after = 48 (+12)
          Monthly depreciation after = 400,000,000 / 48 = 8,333,333 VND
          Accounting entry: Nợ 2111 / Có 2412: 100,000,000 VND
        - Verifies GL JournalEntry + JournalLines, AssetRecord updates, AuditLog, and subsequent UC-FA-03 preview.
        """
        from audit_log.models import AuditLog
        from general_ledger.models import JournalEntry

        self.client.force_authenticate(self.maker)

        # Create TS001 with 500M original cost, 60 months initial life
        asset_data = self._acquire_asset_via_api(
            code="TS001",
            name="Dây chuyền đóng gói",
            original_cost="500000000.00",
            useful_life_periods=60,
            acquisition_date="01/01/2024",
            in_service_date="01/01/2024",
        )
        asset_obj = models.AssetRecord.objects.get(pk=asset_data["id"])
        # Simulate 24 months already depreciated (200,000,000 VND accumulated depreciation, 36 months remaining)
        asset_obj.accumulated_depreciation = Decimal("200000000.00")
        asset_obj.periods_processed = 24
        asset_obj.save(update_fields=("accumulated_depreciation", "periods_processed", "updated_at"))

        # Step 4 & 9: Auto-suggest next revaluation voucher number (ĐGL00001) and report_no (01/BB-ĐGL)
        next_no_resp = self.client.get(
            f"/api/v1/fixed-assets/transactions/next-revaluation-number/?company_id={self.company.id}"
        )
        self.assertEqual(next_no_resp.status_code, 200)
        self.assertEqual(next_no_resp.data["voucher_no"], "ĐGL00001")
        self.assertEqual(next_no_resp.data["report_no"], "01/BB-ĐGL")

        reval_payload = {
            "company": str(self.company.id),
            "report_no": "01/BB-ĐGL",
            "report_date": "15/06/2026",
            "posting_date": "15/06/2026",
            "voucher_date": "15/06/2026",
            "voucher_no": "ĐGL00001",
            "reason": "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản",
            "conclusion": "Nghiệm thu hoàn thành nâng cấp dây chuyền đóng gói, tăng nguyên giá thêm 100 triệu đồng và kéo dài thời gian sử dụng còn lại lên 48 tháng.",
            "reference": "BB-NT-2026-01",
            "members": [
                {"name": "Nguyễn Văn An", "title": "Giám đốc sản xuất", "representation": "Chủ tịch Hội đồng"},
                {"name": "Trần Thị Bình", "title": "Kế toán trưởng", "representation": "Ủy viên"},
            ],
            "attachments": [{"name": "ho_so_nghiem_thu_nang_cap.pdf", "size": 512000}],
            "items": [
                {
                    "asset_id": str(asset_obj.id),
                    "orig_before": "500000000.00",
                    "orig_after": "600000000.00",
                    "depr_before": "200000000.00",
                    "depr_after": "200000000.00",
                    "months_before": 36,
                    "months_after": 48,
                    "val_before": "300000000.00",
                    "val_after": "400000000.00",
                    "cost_account": "6274",
                    "reval_account": "2412",
                }
            ],
            "accounting_entries": [
                {
                    "description": "Nâng cấp dây chuyền đóng gói TS001",
                    "debit_account": "2111",
                    "credit_account": "2412",
                    "amount": "100000000.00",
                    "object_code": "TS001",
                    "object_name": "Dây chuyền đóng gói",
                }
            ],
        }

        resp = self.client.post(
            "/api/v1/fixed-assets/transactions/revaluate/",
            reval_payload,
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["message"], "Đánh giá lại tài sản cố định thành công.")
        self.assertEqual(resp.data["voucher_no"], "ĐGL00001")
        self.assertEqual(resp.data["report_no"], "01/BB-ĐGL")
        self.assertEqual(resp.data["items_count"], 1)

        item = resp.data["items"][0]
        self.assertEqual(Decimal(item["orig_before"]), Decimal("500000000.00"))
        self.assertEqual(Decimal(item["orig_after"]), Decimal("600000000.00"))
        self.assertEqual(Decimal(item["orig_diff"]), Decimal("100000000.00"))
        self.assertEqual(Decimal(item["depr_before"]), Decimal("200000000.00"))
        self.assertEqual(Decimal(item["depr_after"]), Decimal("200000000.00"))
        self.assertEqual(Decimal(item["depr_diff"]), Decimal("0.00"))
        self.assertEqual(Decimal(item["rem_before"]), Decimal("300000000.00"))
        self.assertEqual(Decimal(item["rem_after"]), Decimal("400000000.00"))
        self.assertEqual(Decimal(item["rem_diff"]), Decimal("100000000.00"))
        self.assertEqual(item["months_before"], 36)
        self.assertEqual(item["months_after"], 48)
        self.assertEqual(item["months_diff"], 12)
        self.assertEqual(Decimal(item["remaining_depreciable_after"]), Decimal("400000000.00"))
        self.assertEqual(Decimal(item["monthly_depr_after"]), Decimal("8333333"))
        self.assertEqual(item["gl_status"], "POSTED")
        self.assertTrue(bool(item["journal_entry_id"]))

        # Verify GL JournalEntry and JournalLines created and balanced
        gl_entry = JournalEntry.objects.get(pk=item["journal_entry_id"])
        self.assertEqual(gl_entry.status, "POSTED")
        self.assertEqual(gl_entry.total_debit, Decimal("100000000.00"))
        self.assertEqual(gl_entry.total_credit, Decimal("100000000.00"))
        self.assertEqual(gl_entry.lines.count(), 2)

        # Verify AssetRecord updated accurately
        asset_obj.refresh_from_db()
        self.assertEqual(asset_obj.original_cost, Decimal("600000000.00"))
        self.assertEqual(asset_obj.accumulated_depreciation, Decimal("200000000.00"))
        self.assertEqual(asset_obj.remaining_value, Decimal("400000000.00"))
        self.assertEqual(asset_obj.useful_life_periods, 72)  # 24 processed + 48 remaining
        self.assertEqual(asset_obj.monthly_depreciation_amount, Decimal("8333333"))

        # Next suggested number increments to ĐGL00002 & 02/BB-ĐGL
        next_no_resp2 = self.client.get(
            f"/api/v1/fixed-assets/transactions/next-revaluation-number/?company_id={self.company.id}"
        )
        self.assertEqual(next_no_resp2.status_code, 200)
        self.assertEqual(next_no_resp2.data["voucher_no"], "ĐGL00002")
        self.assertEqual(next_no_resp2.data["report_no"], "02/BB-ĐGL")

        # Verify AuditLog (BR35)
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company,
                entity_id=asset_obj.id,
                action_code="REVALUATE_ASSET",
            ).exists()
        )

        # Verify subsequent UC-FA-03 monthly depreciation uses the new post-revaluation basis (8,333,333 VND)
        preview_resp = self.client.get(
            f"/api/v1/fixed-assets/calculations/preview/?company_id={self.company.id}&month=7&year=2026"
        )
        self.assertEqual(preview_resp.status_code, 200, preview_resp.data)
        ts001_line = next(l for l in preview_resp.data["lines"] if l["asset_code"] == "TS001")
        self.assertEqual(Decimal(ts001_line["amount"]), Decimal("8333333"))

    def test_uc_fa_06_alternative_flows_state_reval_life_only_source_voucher_multi_asset(self):
        """
        UC-FA-06 Alternative Flows:
        - AF06 & AF14: State decision revaluation adjusting both original_cost and accumulated_depreciation via TK 412.
        - AF10 & AF15: Life-only adjustment (orig_diff = 0, depr_diff = 0, months_diff != 0 -> LIFE_CHANGE, no GL entry).
        - AF18: Separate CIT tax monthly depreciation cap (monthly_depr_law_after < monthly_depr_after).
        - AF19: Multi-asset revaluation voucher in a single batch.
        - AF30: Adjustment linked to an already-posted source voucher (posted_at_source=True -> no duplicate GL entry).
        """
        from general_ledger.models import JournalEntry

        self.client.force_authenticate(self.maker)

        a1 = self._acquire_asset_via_api(
            code="TS-AF06-1",
            name="Nhà xưởng sản xuất khu A",
            original_cost="1000000000.00",
            useful_life_periods=120,
            acquisition_date="01/01/2025",
            in_service_date="01/01/2025",
        )
        a2 = self._acquire_asset_via_api(
            code="TS-AF06-2",
            name="Hệ thống điện mặt trời",
            original_cost="240000000.00",
            useful_life_periods=48,
            acquisition_date="01/01/2025",
            in_service_date="01/01/2025",
        )

        # 1. AF06 & AF14 & AF18: State decision revaluation with TK 412, adjusting both original_cost and accumulated_depreciation
        resp_state = self.client.post(
            "/api/v1/fixed-assets/transactions/revaluate/",
            {
                "company": str(self.company.id),
                "suggest_report_no": True,
                "report_date": "10/06/2026",
                "posting_date": "10/06/2026",
                "voucher_date": "10/06/2026",
                "reason": "Đánh giá lại theo quyết định của cơ quan nhà nước",
                "decision_no": "QĐ-UBND-2026/88",
                "items": [
                    {
                        "asset_id": a1["id"],
                        "orig_after": "1200000000.00",
                        "depr_after": "50000000.00",
                        "months_after": 100,
                        "monthly_depr_law_after": "10000000.00",
                        "reval_account": "412",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp_state.status_code, 201, resp_state.data)
        self.assertEqual(resp_state.data["items"][0]["transaction_type"], "VALUE_INCREASE")
        self.assertEqual(Decimal(resp_state.data["items"][0]["monthly_depr_after"]), Decimal("11500000"))
        self.assertEqual(Decimal(resp_state.data["items"][0]["monthly_depr_law_after"]), Decimal("10000000"))
        a1_obj = models.AssetRecord.objects.get(pk=a1["id"])
        self.assertEqual(a1_obj.cit_monthly_cap, Decimal("10000000"))

        # 2. AF10 & AF15: Life-only adjustment (no change in original_cost or accumulated_depreciation)
        resp_life = self.client.post(
            "/api/v1/fixed-assets/transactions/revaluate/",
            {
                "company": str(self.company.id),
                "posting_date": "12/06/2026",
                "voucher_date": "12/06/2026",
                "reason": "Thay đổi thời gian sử dụng còn lại theo biên bản kỹ thuật",
                "items": [
                    {
                        "asset_id": a2["id"],
                        "months_after": 60,  # increased from 48 to 60 months
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp_life.status_code, 201, resp_life.data)
        self.assertEqual(resp_life.data["items"][0]["transaction_type"], "LIFE_CHANGE")
        self.assertEqual(resp_life.data["items"][0]["gl_status"], "NOT_REQUIRED")
        self.assertEqual(Decimal(resp_life.data["items"][0]["monthly_depr_after"]), Decimal("4000000"))

        # 3. AF19 & AF30: Multi-asset adjustment linked to an already-posted source voucher (posted_at_source=True)
        gl_count_before = JournalEntry.objects.filter(company=self.company).count()
        resp_multi = self.client.post(
            "/api/v1/fixed-assets/transactions/revaluate/",
            {
                "company": str(self.company.id),
                "posting_date": "20/06/2026",
                "voucher_date": "20/06/2026",
                "reason": "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản",
                "posted_at_source": True,
                "source_voucher_no": "PC-NC-2026-99",
                "items": [
                    {
                        "asset_id": a1["id"],
                        "orig_after": "1250000000.00",
                        "months_after": 100,
                    },
                    {
                        "asset_id": a2["id"],
                        "orig_after": "300000000.00",
                        "months_after": 60,
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(resp_multi.status_code, 201, resp_multi.data)
        self.assertEqual(resp_multi.data["items_count"], 2)
        # Because posted_at_source=True, no duplicate GL JournalEntry was created
        self.assertEqual(JournalEntry.objects.filter(company=self.company).count(), gl_count_before)

    def test_uc_fa_06_exception_flows_ef01_to_ef30(self):
        """
        UC-FA-06 Exception Flows (EF01–EF30):
        Verifies all exact Vietnamese error messages, atomic rollback (EF27), and idempotency (EF28).
        """
        from organization.models import Company

        self.client.force_authenticate(self.maker)

        asset1 = self._acquire_asset_via_api(
            code="TS-EF06-1",
            name="Máy tiện CNC",
            original_cost="300000000.00",
            useful_life_periods=60,
            acquisition_date="01/05/2026",
            in_service_date="01/05/2026",
        )
        asset2 = self._acquire_asset_via_api(
            code="TS-EF06-2",
            name="Máy phay CNC",
            original_cost="200000000.00",
            useful_life_periods=40,
            acquisition_date="01/05/2026",
            in_service_date="01/05/2026",
        )

        url = "/api/v1/fixed-assets/transactions/revaluate/"
        base_payload = {
            "company": str(self.company.id),
            "report_no": "01/BB-EF06",
            "report_date": "15/06/2026",
            "posting_date": "15/06/2026",
            "voucher_date": "15/06/2026",
            "voucher_no": "ĐGL00900",
            "reason": "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản",
            "conclusion": "Đủ điều kiện nâng cấp.",
            "items": [
                {
                    "asset_id": asset1["id"],
                    "orig_after": "360000000.00",
                    "months_after": 60,
                    "reval_account": "2412",
                }
            ],
        }

        # EF02: Invalid voucher_no format
        ef02 = self.client.post(url, {**base_payload, "voucher_no": "   "}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["voucher_no"]), "Số chứng từ đánh giá lại không hợp lệ hoặc đã tồn tại.")

        # EF03: Empty report_no when required
        ef03 = self.client.post(url, {**base_payload, "report_no": ""}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["report_no"]), "Vui lòng nhập số biên bản đánh giá lại.")

        # EF04: Invalid report_date
        ef04 = self.client.post(url, {**base_payload, "report_date": "invalid-date"}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["report_date"]), "Ngày biên bản không hợp lệ. Vui lòng kiểm tra lại.")

        # EF05: Invalid or missing posting_date / voucher_date
        ef05 = self.client.post(url, {**base_payload, "posting_date": ""}, format="json")
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["posting_date"]), "Vui lòng nhập ngày chứng từ và ngày hạch toán hợp lệ.")

        # EF06: Locked accounting period
        locked_p = models.AssetPeriod.objects.create(
            company=self.company,
            code="2026-06",
            start_date="2026-06-01",
            end_date="2026-06-30",
            status="CLOSED",
        )
        ef06 = self.client.post(url, base_payload, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["period"]), "Kỳ kế toán đã khóa, không thể ghi nhận đánh giá lại tài sản.")
        locked_p.delete()

        # EF07: Missing reason
        ef07 = self.client.post(url, {**base_payload, "reason": ""}, format="json")
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["reason"]), "Vui lòng chọn lý do đánh giá lại tài sản.")

        # EF08: Missing mandatory legal basis when required
        ef08 = self.client.post(url, {**base_payload, "require_legal_basis": True}, format="json")
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["legal_basis"]), "Chưa có căn cứ hợp lệ để điều chỉnh tài sản cố định.")

        # EF09: Missing council members when required or incomplete member name
        ef09 = self.client.post(
            url,
            {**base_payload, "members": [{"name": "", "title": "Chủ tịch HĐ"}]},
            format="json",
        )
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["members"]), "Vui lòng khai báo đầy đủ thông tin thành viên tham gia đánh giá.")

        # EF10: Missing conclusion when required
        ef10 = self.client.post(
            url,
            {**base_payload, "conclusion": "", "require_conclusion": True},
            format="json",
        )
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["conclusion"]), "Vui lòng nhập kết luận đánh giá tài sản.")

        # EF11: Empty items list
        ef11 = self.client.post(url, {**base_payload, "items": []}, format="json")
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["items"]), "Vui lòng chọn ít nhất một tài sản cần đánh giá lại.")

        # EF12: Non-existent asset
        ef12 = self.client.post(
            url,
            {**base_payload, "items": [{"asset_code": "TS-NOT-EXIST", "orig_after": "100000000"}]},
            format="json",
        )
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["asset"]), "Tài sản TS-NOT-EXIST không hợp lệ.")

        # EF13: Effective date before asset acquisition_date (01/05/2026)
        ef13 = self.client.post(
            url,
            {
                **base_payload,
                "report_date": "10/04/2026",
                "voucher_date": "10/04/2026",
                "posting_date": "10/04/2026",
            },
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(
            str(ef13.data["asset"]),
            "Tài sản TS-EF06-1 không đủ điều kiện đánh giá lại tại ngày đã chọn.",
        )

        # EF14: Duplicate asset in the same voucher
        ef14 = self.client.post(
            url,
            {
                **base_payload,
                "items": [
                    {"asset_id": asset1["id"], "orig_after": "360000000.00"},
                    {"asset_id": asset1["id"], "orig_after": "360000000.00"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(str(ef14.data["asset"]), "Tài sản TS-EF06-1 đã được chọn trong chứng từ.")

        # EF15: Before snapshot mismatch
        ef15 = self.client.post(
            url,
            {
                **base_payload,
                "items": [
                    {
                        "asset_id": asset1["id"],
                        "orig_before": "999999999.00",
                        "orig_after": "360000000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(
            str(ef15.data["orig_before"]),
            "Dữ liệu tài sản TS-EF06-1 đã thay đổi. Vui lòng tải lại và kiểm tra.",
        )

        # EF16: Invalid orig_after (<= 0)
        ef16 = self.client.post(
            url,
            {**base_payload, "items": [{"asset_id": asset1["id"], "orig_after": "0"}]},
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(str(ef16.data["orig_after"]), "Nguyên giá sau điều chỉnh không hợp lệ.")

        # EF17: Invalid depr_after (< 0 or > orig_after)
        ef17 = self.client.post(
            url,
            {
                **base_payload,
                "items": [{"asset_id": asset1["id"], "orig_after": "360000000.00", "depr_after": "400000000.00"}],
            },
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(str(ef17.data["depr_after"]), "Hao mòn lũy kế sau điều chỉnh không hợp lệ.")

        # EF18: Invalid months_after (<= 0 while remaining value > 0)
        ef18 = self.client.post(
            url,
            {
                **base_payload,
                "items": [{"asset_id": asset1["id"], "orig_after": "360000000.00", "months_after": 0}],
            },
            format="json",
        )
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(str(ef18.data["months_after"]), "Thời gian sử dụng còn lại sau điều chỉnh không hợp lệ.")

        # EF19: Invalid val_after (> orig_after)
        ef19 = self.client.post(
            url,
            {
                **base_payload,
                "items": [
                    {
                        "asset_id": asset1["id"],
                        "orig_after": "360000000.00",
                        "val_after": "500000000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(str(ef19.data["val_after"]), "Giá trị tính khấu hao sau điều chỉnh không hợp lệ.")

        # EF20: Invalid monthly_depr_after (<= 0 or > remaining_depreciable_after)
        ef20 = self.client.post(
            url,
            {
                **base_payload,
                "items": [
                    {
                        "asset_id": asset1["id"],
                        "orig_after": "360000000.00",
                        "monthly_depr_after": "-1000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(str(ef20.data["monthly_depr_after"]), "Mức khấu hao tháng sau điều chỉnh không hợp lệ.")

        # EF21: Inappropriate accounting account (e.g. using TK 412 for upgrade)
        ef21 = self.client.post(
            url,
            {
                **base_payload,
                "accounting_entries": [
                    {"debit_account": "2111", "credit_account": "412", "amount": "60000000.00"}
                ],
            },
            format="json",
        )
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(
            str(ef21.data["accounting_entries"]),
            "Tài khoản hạch toán không phù hợp với nghiệp vụ đánh giá lại.",
        )

        # EF22: Accounting entries amount does not match adjustment diff
        ef22 = self.client.post(
            url,
            {
                **base_payload,
                "accounting_entries": [
                    {"debit_account": "2111", "credit_account": "2412", "amount": "50000000.00"}
                ],
            },
            format="json",
        )
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(
            str(ef22.data["accounting_entries"]),
            "Số tiền hạch toán không khớp với kết quả đánh giá lại.",
        )

        # EF23: All adjustment diffs are zero
        ef23 = self.client.post(
            url,
            {
                **base_payload,
                "items": [
                    {
                        "asset_id": asset1["id"],
                        "orig_after": "300000000.00",
                        "depr_after": "0.00",
                        "months_after": 60,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(str(ef23.data["items"]), "Chưa có thông tin tài sản cần điều chỉnh.")

        # EF24: Duplicate source adjustment
        ef24 = self.client.post(
            url,
            {**base_payload, "duplicate_source_adjustment": True},
            format="json",
        )
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(
            str(ef24.data["source_voucher_no"]),
            "Khoản điều chỉnh đã được ghi nhận tại chứng từ liên quan. Vui lòng kiểm tra lại.",
        )

        # EF25: Adjustment conflicts with already-posted depreciation run
        depr_tx = models.AssetTransaction.objects.create(
            company=self.company,
            asset_id=asset1["id"],
            number="KH-EF06-06",
            transaction_type="DEPRECIATION",
            transaction_date="2026-06-30",
            amount=Decimal("5000000"),
            period_code="2026-06",
            status="POSTED",
            created_by=services.actor(type("Req", (), {"user": self.maker})()),
        )
        ef25 = self.client.post(url, base_payload, format="json")
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(
            str(ef25.data["effective_date"]),
            "Điều chỉnh ảnh hưởng đến dữ liệu kế toán đã ghi sổ. Vui lòng xử lý kỳ liên quan.",
        )
        depr_tx.delete()

        # EF26: Concurrent update / version mismatch
        ef26 = self.client.post(url, {**base_payload, "expected_version": 999}, format="json")
        self.assertEqual(ef26.status_code, 400)
        self.assertEqual(str(ef26.data["version"]), "Thông tin tài sản đã thay đổi. Vui lòng tải lại dữ liệu.")

        # EF27: Atomic rollback on DB/GL error
        ef27 = self.client.post(url, {**base_payload, "simulate_db_error": True}, format="json")
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(str(ef27.data["detail"]), "Đánh giá lại tài sản cố định thất bại. Vui lòng thử lại.")
        self.assertEqual(models.AssetRecord.objects.get(pk=asset1["id"]).original_cost, Decimal("300000000.00"))

        # EF29: Attachment exceeds 5MB
        ef29 = self.client.post(
            url,
            {**base_payload, "attachments": [{"name": "oversize.pdf", "size": 6 * 1024 * 1024}]},
            format="json",
        )
        self.assertEqual(ef29.status_code, 400)
        self.assertEqual(
            str(ef29.data["attachments"]),
            "Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.",
        )

        # EF30: Asset belongs to another company or out-of-scope branch
        other_company = Company.objects.create(
            code="OTHER-CO-06",
            name="Công ty Khác 06",
            accounting_currency=self.company.accounting_currency,
            legal_reporting_currency=self.company.legal_reporting_currency,
        )
        other_branch = Branch.objects.create(company=other_company, code="CN-OTHER-06", name="Chi nhánh Khác 06")
        other_cat = models.AssetCategory.objects.create(
            company=other_company,
            code="CAT-OTHER-06",
            name="Nhóm khác",
            asset_type="FIXED_ASSET",
            default_periods=24,
        )
        other_asset = models.AssetRecord.objects.create(
            company=other_company,
            branch=other_branch,
            category=other_cat,
            code="TS-OTHER-06",
            name="Tài sản công ty khác",
            asset_type="FIXED_ASSET",
            acquisition_date="2026-01-01",
            in_service_date="2026-01-01",
            original_cost=Decimal("100000000"),
            depreciable_amount=Decimal("100000000"),
            useful_life_periods=24,
            status="ACTIVE",
            created_by=services.actor(type("Req", (), {"user": self.maker})()),
        )
        ef30 = self.client.post(
            url,
            {
                **base_payload,
                "items": [{"asset_id": str(other_asset.id), "orig_after": "150000000.00"}],
            },
            format="json",
        )
        self.assertEqual(ef30.status_code, 400)
        self.assertEqual(str(ef30.data["asset"]), "Bạn không có quyền thực hiện nghiệp vụ đối với tài sản này.")

        # Succeed with idempotency_key, then verify EF28 (idempotent replay) & EF02 (duplicate voucher_no)
        ok_resp = self.client.post(
            url,
            {**base_payload, "idempotency_key": "IDEM-REVAL-900"},
            format="json",
        )
        self.assertEqual(ok_resp.status_code, 201, ok_resp.data)

        ef28 = self.client.post(
            url,
            {**base_payload, "idempotency_key": "IDEM-REVAL-900"},
            format="json",
        )
        self.assertEqual(ef28.status_code, 200)
        self.assertTrue(ef28.data.get("idempotent_replayed"))

        # EF02: Duplicate voucher_no ĐGL00900
        ef02_dup = self.client.post(
            url,
            {
                **base_payload,
                "voucher_no": "ĐGL00900",
                "items": [{"asset_id": asset2["id"], "orig_after": "250000000.00", "reval_account": "2412"}],
            },
            format="json",
        )
        self.assertEqual(ef02_dup.status_code, 400)
        self.assertEqual(str(ef02_dup.data["voucher_no"]), "Số chứng từ đánh giá lại không hợp lệ hoặc đã tồn tại.")

        # EF01: User without permission to revaluate fixed assets
        no_perm_user = get_user_model().objects.create_user(username="no-reval-perm", email="norev@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(url, {**base_payload, "voucher_no": "ĐGL00901"}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền đánh giá lại tài sản cố định.")

    # ==========================================================================
    # UC-FA-07: GHI GIẢM TÀI SẢN (FIXED ASSET DISPOSAL / DERECOGNITION)
    # ==========================================================================

    def test_uc_fa_07_main_flow_example_4_7_sale_liquidation_and_gl_posting(self):
        """
        UC-FA-07 Main Flow (Steps 1–40) & Section 4.7 Example:
        - Tài sản: TSCD007 – Máy móc thiết bị X
        - Đơn vị sử dụng: Phân xưởng Sản xuất
        - Nguyên giá = 300,000,000; Giá trị tính khấu hao = 300,000,000; Hao mòn lũy kế = 220,000,000
        - Giá trị còn lại = 300,000,000 - 220,000,000 = 80,000,000
        - TK Nguyên giá = 2112, TK Hao mòn = 2141, TK Xử lý giá trị = 811
        - Bút toán:
          1) Nợ 2141 / Có 2112: 220,000,000
          2) Nợ 811 / Có 2112: 80,000,000
        - Sau khi lưu: trạng thái tài sản = DISPOSED, ngừng tính khấu hao ở kỳ tiếp theo (Step 36, BR33).
        """
        from general_ledger.models import JournalEntry, JournalLine

        acq = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-07-001",
                code="TSCD007",
                name="Máy móc thiết bị X",
                acquisition_date="2023-02-01",
                in_service_date="2023-02-01",
                depreciation_start_date="2023-02-01",
                original_cost="300000000.00",
                depreciable_amount="300000000.00",
                useful_life_value="60",
                useful_life_unit="Tháng",
                monthly_depreciation_amount="5000000.00",
                annual_depreciation_amount="60000000.00",
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(acq.status_code, 201, acq.data)
        asset_id = acq.data["asset"]["id"]
        models.AssetRecord.objects.filter(pk=asset_id).update(
            accumulated_depreciation=Decimal("220000000.00"),
            periods_processed=44,
        )

        # Step 7: Check auto-suggested disposal voucher number GGTS00001
        num_resp = self.client.get(f"/api/v1/fixed-assets/transactions/next-disposal-number/{self.query}")
        self.assertEqual(num_resp.status_code, 200, num_resp.data)
        self.assertEqual(num_resp.data["voucher_no"], "GGTS00001")

        # Execute Main Flow disposal
        disp_resp = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS00001",
                "reason": "Nhượng bán, thanh lý",
                "posting_date": "12/10/2026",
                "voucher_date": "12/10/2026",
                "reference": "QĐ-TL-2026/10",
                "rows": [
                    {
                        "asset_id": asset_id,
                        "asset_code": "TSCD007",
                        "asset_account": "2112",
                        "accumulated_account": "2141",
                        "disposal_account": "811",
                    }
                ],
                "attachments": [
                    {"name": "Quyet_dinh_thanh_ly_TSCD007.pdf", "size": 204800, "type": "application/pdf"}
                ],
            },
            format="json",
        )
        self.assertEqual(disp_resp.status_code, 201, disp_resp.data)
        self.assertEqual(disp_resp.data["message"], "Ghi giảm tài sản cố định thành công.")
        self.assertEqual(disp_resp.data["voucher_no"], "GGTS00001")
        self.assertEqual(disp_resp.data["status"], "POSTED")
        self.assertEqual(disp_resp.data["status_display"], "Đã ghi sổ")
        self.assertEqual(Decimal(disp_resp.data["total_amount"]), Decimal("300000000.00"))
        self.assertEqual(Decimal(disp_resp.data["total_remaining_value"]), Decimal("80000000.00"))

        row0 = disp_resp.data["rows"][0]
        self.assertEqual(row0["asset_code"], "TSCD007")
        self.assertEqual(Decimal(row0["original_cost"]), Decimal("300000000.00"))
        self.assertEqual(Decimal(row0["depreciable_amount"]), Decimal("300000000.00"))
        self.assertEqual(Decimal(row0["accumulated_depreciation"]), Decimal("220000000.00"))
        self.assertEqual(Decimal(row0["remaining_value"]), Decimal("80000000.00"))
        self.assertEqual(row0["asset_account"], "2112")
        self.assertEqual(row0["accumulated_account"], "2141")
        self.assertEqual(row0["disposal_account"], "811")
        self.assertEqual(row0["status_after"], "DISPOSED")

        # Verify Tab Hạch toán entries match Section 4.7
        entries = disp_resp.data["accounting_entries"]
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0]["debit_account"], "2141")
        self.assertEqual(entries[0]["credit_account"], "2112")
        self.assertEqual(Decimal(entries[0]["amount"]), Decimal("220000000.00"))
        self.assertEqual(entries[1]["debit_account"], "811")
        self.assertEqual(entries[1]["credit_account"], "2112")
        self.assertEqual(Decimal(entries[1]["amount"]), Decimal("80000000.00"))

        # Verify GL JournalEntry and JournalLines
        je_id = disp_resp.data["journal_entry_id"]
        self.assertTrue(bool(je_id))
        je = JournalEntry.objects.get(pk=je_id)
        self.assertEqual(je.status, "POSTED")
        gl_lines = JournalLine.objects.filter(entry=je).order_by("line_no")
        self.assertEqual(gl_lines.count(), 4)
        total_dr = sum(l.debit for l in gl_lines)
        total_cr = sum(l.credit for l in gl_lines)
        self.assertEqual(total_dr, Decimal("300000000.0000"))
        self.assertEqual(total_cr, Decimal("300000000.0000"))

        # Verify AssetRecord updated to DISPOSED and AuditLog recorded
        asset_obj = models.AssetRecord.objects.get(pk=asset_id)
        self.assertEqual(asset_obj.status, models.AssetStatus.DISPOSED)
        self.assertEqual(asset_obj.disposed_at.isoformat(), "2026-10-12")
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company,
                entity_id=asset_obj.id,
                action_code="DISPOSE_ASSET",
            ).exists()
        )

        # Next disposal number should now be GGTS00002
        num_resp2 = self.client.get(f"/api/v1/fixed-assets/transactions/next-disposal-number/{self.query}")
        self.assertEqual(num_resp2.data["voucher_no"], "GGTS00002")

        # Step 36 & BR33: Verify depreciation stops in subsequent period (11/2026)
        prev_nov = self.client.post(
            f"/api/v1/fixed-assets/calculations/preview/{self.query}",
            {"month": 11, "year": 2026},
            format="json",
        )
        # Since TSCD007 is the only asset and was disposed in 10/2026, 11/2026 has no eligible assets (AF04 of UC-FA-03)
        self.assertEqual(prev_nov.status_code, 400)
        self.assertEqual(
            str(prev_nov.data["detail"]),
            "Không có tài sản cố định cần tính khấu hao trong kỳ đã chọn.",
        )

    def test_uc_fa_07_alternative_flows_shortage_4_8_convert_ccdc_4_9_capital_contribution_finance_lease_fully_depreciated_multi_asset(self):
        """
        UC-FA-07 Alternative Flows & Section 4.5, 4.8, 4.9 Examples:
        - Section 4.8 (AF06): Phát hiện thiếu khi kiểm kê chờ xử lý (TSCD008: NG 90M, HM 35M, GTCL 55M -> TK 1381)
        - AF07: Phát hiện thiếu khi kiểm kê đã có quyết định xử lý (bồi thường 1388 + tổn thất 811)
        - Section 4.9 (AF13): Chuyển TSCĐ thành CCDC phân bổ nhiều kỳ (TSCD009: NG 40M, HM 28M, GTCL 12M -> TK 242)
        - AF08–AF11 & Section 4.5: Góp vốn vào công ty con (TK 221) có chênh lệch đánh giá tăng (TK 711) & Góp vốn công ty liên kết (TK 222) có chênh lệch giảm (TK 811)
        - AF12: Trả lại TSCĐ thuê tài chính (TK 212 / 2142)
        - AF18: Tài sản đã khấu hao hết (GTCL = 0) chỉ sinh 1 dòng bút toán Nợ 2141 / Có 2112 = Nguyên giá
        - AF15: Ghi giảm nhiều tài sản trên cùng một chứng từ
        """
        def _create_asset(code, name, orig, accum, asset_acc="2112", accum_acc="2141"):
            resp = self.client.post(
                f"/api/v1/fixed-assets/assets/acquire/{self.query}",
                self._base_uc_fa_01_payload(
                    voucher_no=f"GT-{code}",
                    code=code,
                    name=name,
                    acquisition_date="2024-01-01",
                    in_service_date="2024-01-01",
                    depreciation_start_date="2024-01-01",
                    original_cost=str(orig),
                    depreciable_amount=str(orig),
                    useful_life_value="60",
                    useful_life_unit="Tháng",
                    monthly_depreciation_amount=str((Decimal(str(orig)) / Decimal("60")).quantize(Decimal("0.01"))),
                    annual_depreciation_amount=str((Decimal(str(orig)) / Decimal("5")).quantize(Decimal("0.01"))),
                    origins=[],
                ),
                format="json",
            )
            self.assertEqual(resp.status_code, 201, resp.data)
            aid = resp.data["asset"]["id"]
            models.AssetRecord.objects.filter(pk=aid).update(
                accumulated_depreciation=Decimal(str(accum)),
            )
            return aid

        # 1. Section 4.8 (AF06): Phát hiện thiếu khi kiểm kê chờ xử lý (TSCD008)
        id_008 = _create_asset("TSCD008", "Thiết bị văn phòng Y", "90000000.00", "35000000.00")
        resp_48 = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS00010",
                "reason": "Phát hiện thiếu khi kiểm kê",
                "posting_date": "12/10/2026",
                "voucher_date": "12/10/2026",
                "rows": [{"asset_id": id_008, "asset_account": "2112", "accumulated_account": "2141"}],
            },
            format="json",
        )
        self.assertEqual(resp_48.status_code, 201, resp_48.data)
        self.assertEqual(resp_48.data["rows"][0]["disposal_account"], "1381")
        entries_48 = resp_48.data["accounting_entries"]
        self.assertEqual(len(entries_48), 2)
        self.assertEqual(entries_48[0]["debit_account"], "2141")
        self.assertEqual(entries_48[0]["credit_account"], "2112")
        self.assertEqual(Decimal(entries_48[0]["amount"]), Decimal("35000000.00"))
        self.assertEqual(entries_48[1]["debit_account"], "1381")
        self.assertEqual(entries_48[1]["credit_account"], "2112")
        self.assertEqual(Decimal(entries_48[1]["amount"]), Decimal("55000000.00"))

        # 2. AF07: Phát hiện thiếu khi kiểm kê đã có quyết định xử lý (bồi thường 20M -> 1388, tổn thất 35M -> 811)
        id_008b = _create_asset("TSCD008B", "Laptop kiểm kê thiếu có QĐ", "90000000.00", "35000000.00")
        resp_af07 = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS00011",
                "reason": "Phát hiện thiếu khi kiểm kê",
                "posting_date": "12/10/2026",
                "voucher_date": "12/10/2026",
                "has_processing_decision": True,
                "rows": [
                    {
                        "asset_id": id_008b,
                        "asset_account": "2112",
                        "accumulated_account": "2141",
                        "compensation_amount": "20000000.00",
                        "compensation_account": "1388",
                        "loss_account": "811",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp_af07.status_code, 201, resp_af07.data)
        self.assertEqual(len(resp_af07.data["accounting_entries"]), 3)
        self.assertEqual(resp_af07.data["accounting_entries"][1]["debit_account"], "1388")
        self.assertEqual(Decimal(resp_af07.data["accounting_entries"][1]["amount"]), Decimal("20000000.00"))
        self.assertEqual(resp_af07.data["accounting_entries"][2]["debit_account"], "811")
        self.assertEqual(Decimal(resp_af07.data["accounting_entries"][2]["amount"]), Decimal("35000000.00"))

        # 3. Section 4.9 (AF13): Chuyển TSCĐ thành CCDC phân bổ nhiều kỳ (TSCD009: NG 40M, HM 28M, GTCL 12M -> TK 242)
        id_009 = _create_asset("TSCD009", "Máy in công nghiệp Z", "40000000.00", "28000000.00")
        resp_49 = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS00012",
                "reason": "Chuyển TSCĐ thành CCDC",
                "posting_date": "12/10/2026",
                "voucher_date": "12/10/2026",
                "rows": [{"asset_id": id_009, "asset_account": "2112", "accumulated_account": "2141"}],
            },
            format="json",
        )
        self.assertEqual(resp_49.status_code, 201, resp_49.data)
        self.assertEqual(resp_49.data["rows"][0]["disposal_account"], "242")
        entries_49 = resp_49.data["accounting_entries"]
        self.assertEqual(len(entries_49), 2)
        self.assertEqual(entries_49[0]["debit_account"], "2141")
        self.assertEqual(Decimal(entries_49[0]["amount"]), Decimal("28000000.00"))
        self.assertEqual(entries_49[1]["debit_account"], "242")
        self.assertEqual(Decimal(entries_49[1]["amount"]), Decimal("12000000.00"))

        # 4. AF08 & Section 4.5: Góp vốn vào công ty con (TK 221) với giá trị thỏa thuận 100M > GTCL 80M -> chênh lệch +20M vào TK 711
        id_cap1 = _create_asset("TSCD010", "Dây chuyền góp vốn công ty con", "200000000.00", "120000000.00")
        resp_cap1 = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS00013",
                "reason": "Góp vốn vào công ty con",
                "posting_date": "12/10/2026",
                "voucher_date": "12/10/2026",
                "recipient_entity": "Công ty TNHH Con ABC",
                "agreed_investment_value": "100000000.00",
                "rows": [{"asset_id": id_cap1, "asset_account": "2112", "accumulated_account": "2141"}],
            },
            format="json",
        )
        self.assertEqual(resp_cap1.status_code, 201, resp_cap1.data)
        self.assertEqual(resp_cap1.data["rows"][0]["disposal_account"], "221")
        self.assertEqual(len(resp_cap1.data["accounting_entries"]), 3)
        self.assertEqual(resp_cap1.data["accounting_entries"][1]["debit_account"], "221")
        self.assertEqual(resp_cap1.data["accounting_entries"][1]["credit_account"], "2112")
        self.assertEqual(Decimal(resp_cap1.data["accounting_entries"][1]["amount"]), Decimal("80000000.00"))
        self.assertEqual(resp_cap1.data["accounting_entries"][2]["debit_account"], "221")
        self.assertEqual(resp_cap1.data["accounting_entries"][2]["credit_account"], "711")
        self.assertEqual(Decimal(resp_cap1.data["accounting_entries"][2]["amount"]), Decimal("20000000.00"))

        # 5. AF12: Trả lại TSCĐ thuê tài chính (TK 212 / 2142)
        id_lease = _create_asset("TSCD011", "Máy xúc thuê tài chính", "500000000.00", "300000000.00")
        resp_lease = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS00014",
                "reason": "Trả lại TSCĐ thuê tài chính",
                "posting_date": "12/10/2026",
                "voucher_date": "12/10/2026",
                "rows": [
                    {
                        "asset_id": id_lease,
                        "asset_account": "2121",
                        "accumulated_account": "2142",
                        "disposal_account": "3412",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp_lease.status_code, 201, resp_lease.data)
        self.assertEqual(resp_lease.data["rows"][0]["asset_account"], "2121")
        self.assertEqual(resp_lease.data["rows"][0]["accumulated_account"], "2142")

        # 6. AF18: Tài sản đã khấu hao hết (Nguyên giá = Hao mòn lũy kế = 60,000,000, GTCL = 0)
        # Chỉ sinh 1 dòng bút toán Nợ 2141 / Có 2112 = 60,000,000, KHÔNG sinh dòng 0 đồng cho TK 811
        id_full = _create_asset("TSCD012", "Máy phát điện đã hết khấu hao", "60000000.00", "60000000.00")
        resp_full = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS00015",
                "reason": "Nhượng bán, thanh lý",
                "posting_date": "12/10/2026",
                "voucher_date": "12/10/2026",
                "rows": [{"asset_id": id_full, "asset_account": "2112", "accumulated_account": "2141"}],
            },
            format="json",
        )
        self.assertEqual(resp_full.status_code, 201, resp_full.data)
        self.assertEqual(Decimal(resp_full.data["rows"][0]["remaining_value"]), Decimal("0.00"))
        self.assertEqual(len(resp_full.data["accounting_entries"]), 1)
        self.assertEqual(resp_full.data["accounting_entries"][0]["debit_account"], "2141")
        self.assertEqual(resp_full.data["accounting_entries"][0]["credit_account"], "2112")
        self.assertEqual(Decimal(resp_full.data["accounting_entries"][0]["amount"]), Decimal("60000000.00"))

        # 7. AF15: Ghi giảm nhiều tài sản trên cùng một chứng từ
        id_m1 = _create_asset("TSCD013", "Máy lạnh 1", "30000000.00", "20000000.00")
        id_m2 = _create_asset("TSCD014", "Máy lạnh 2", "45000000.00", "25000000.00")
        resp_multi = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS00016",
                "reason": "Nhượng bán, thanh lý",
                "posting_date": "12/10/2026",
                "voucher_date": "12/10/2026",
                "rows": [
                    {"asset_id": id_m1, "asset_account": "2112", "accumulated_account": "2141"},
                    {"asset_id": id_m2, "asset_account": "2112", "accumulated_account": "2141"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp_multi.status_code, 201, resp_multi.data)
        self.assertEqual(len(resp_multi.data["rows"]), 2)
        self.assertEqual(Decimal(resp_multi.data["total_amount"]), Decimal("75000000.00"))
        self.assertEqual(Decimal(resp_multi.data["total_remaining_value"]), Decimal("30000000.00"))

    def test_uc_fa_07_exception_flows_ef01_to_ef30(self):
        """
        UC-FA-07 Exception Flows (EF01–EF30):
        Verifies exact Vietnamese error messages, HTTP status codes, atomic rollback (EF27), and idempotency (EF28).
        """
        acq1 = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-EF07-01",
                code="TS-EF07-01",
                name="Máy tiện CNC EF07-01",
                acquisition_date="2025-01-01",
                in_service_date="2025-01-01",
                depreciation_start_date="2025-01-01",
                original_cost="150000000.00",
                depreciable_amount="150000000.00",
                useful_life_value="60",
                useful_life_unit="Tháng",
                monthly_depreciation_amount="2500000.00",
                annual_depreciation_amount="30000000.00",
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(acq1.status_code, 201, acq1.data)
        asset1 = acq1.data["asset"]
        models.AssetRecord.objects.filter(pk=asset1["id"]).update(
            accumulated_depreciation=Decimal("50000000.00"),
            periods_processed=20,
        )

        acq2 = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-EF07-02",
                code="TS-EF07-02",
                name="Máy tiện CNC EF07-02",
                acquisition_date="2025-01-01",
                in_service_date="2025-01-01",
                depreciation_start_date="2025-01-01",
                original_cost="100000000.00",
                depreciable_amount="100000000.00",
                useful_life_value="50",
                useful_life_unit="Tháng",
                monthly_depreciation_amount="2000000.00",
                annual_depreciation_amount="24000000.00",
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(acq2.status_code, 201, acq2.data)
        asset2 = acq2.data["asset"]

        url = f"/api/v1/fixed-assets/transactions/dispose/{self.query}"
        base_payload = {
            "voucher_no": "GGTS00900",
            "reason": "Nhượng bán, thanh lý",
            "posting_date": "12/10/2026",
            "voucher_date": "12/10/2026",
            "rows": [
                {
                    "asset_id": asset1["id"],
                    "asset_code": "TS-EF07-01",
                    "asset_account": "2112",
                    "accumulated_account": "2141",
                    "disposal_account": "811",
                }
            ],
        }

        # EF02: Missing or invalid reason
        ef02 = self.client.post(url, {**base_payload, "reason": ""}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["reason"]), "Vui lòng chọn lý do ghi giảm tài sản cố định.")

        # EF03: Invalid posting_date
        ef03 = self.client.post(url, {**base_payload, "posting_date": "invalid-date"}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["posting_date"]), "Vui lòng nhập ngày hạch toán hợp lệ.")

        # EF04: Invalid voucher_date (or voucher_date > posting_date)
        ef04 = self.client.post(url, {**base_payload, "voucher_date": "15/10/2026"}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["voucher_date"]), "Vui lòng nhập ngày chứng từ hợp lệ.")

        # EF05: Closed accounting period
        locked_p07 = models.AssetPeriod.objects.create(
            company=self.company,
            code="2025-06",
            start_date="2025-06-01",
            end_date="2025-06-30",
            status="CLOSED",
        )
        ef05 = self.client.post(
            url,
            {**base_payload, "posting_date": "15/06/2025", "voucher_date": "15/06/2025"},
            format="json",
        )
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["posting_date"]), "Kỳ kế toán đã khóa, không thể ghi giảm tài sản.")
        locked_p07.delete()

        # EF06: Invalid voucher_no
        ef06 = self.client.post(url, {**base_payload, "voucher_no": "   "}, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["voucher_no"]), "Số chứng từ ghi giảm không hợp lệ.")

        # EF08: Empty asset rows
        ef08 = self.client.post(url, {**base_payload, "rows": []}, format="json")
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["rows"]), "Vui lòng chọn ít nhất một tài sản cần ghi giảm.")

        # EF09: Asset does not exist
        ef09 = self.client.post(
            url,
            {**base_payload, "rows": [{"asset_code": "TS-KHONG-TON-TAI"}]},
            format="json",
        )
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["asset"]), "Tài sản TS-KHONG-TON-TAI không hợp lệ.")

        # EF10: Asset not yet eligible (e.g. acquired after effective_date)
        ef10 = self.client.post(
            url,
            {**base_payload, "posting_date": "01/01/2024", "voucher_date": "01/01/2024"},
            format="json",
        )
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["asset"]), "Tài sản TS-EF07-01 chưa đủ điều kiện ghi giảm.")

        # EF11: Asset already disposed
        models.AssetRecord.objects.filter(pk=asset2["id"]).update(status=models.AssetStatus.DISPOSED)
        ef11 = self.client.post(
            url,
            {**base_payload, "rows": [{"asset_id": asset2["id"]}]},
            format="json",
        )
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["asset"]), "Tài sản TS-EF07-02 đã được ghi giảm.")
        models.AssetRecord.objects.filter(pk=asset2["id"]).update(status=models.AssetStatus.ACTIVE)

        # EF12: Duplicate asset in the same voucher
        ef12 = self.client.post(
            url,
            {
                **base_payload,
                "rows": [
                    {"asset_id": asset1["id"]},
                    {"asset_id": asset1["id"]},
                ],
            },
            format="json",
        )
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["rows"]), "Tài sản TS-EF07-01 đã được chọn trong chứng từ.")

        # EF13: Asset snapshot changed (stale original_cost / expected_version)
        ef13 = self.client.post(
            url,
            {
                **base_payload,
                "rows": [{"asset_id": asset1["id"], "expected_version": 99}],
            },
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(
            str(ef13.data["asset"]),
            "Số liệu tài sản TS-EF07-01 đã thay đổi. Vui lòng tải lại dữ liệu.",
        )

        # EF14: Invalid accumulated depreciation (< 0 or > original_cost)
        ef14 = self.client.post(
            url,
            {
                **base_payload,
                "rows": [{"asset_id": asset1["id"], "accumulated_depreciation": "200000000.00"}],
            },
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(
            str(ef14.data["accumulated_depreciation"]),
            "Hao mòn lũy kế của tài sản không hợp lệ.",
        )

        # EF15: Invalid remaining value (!= original_cost - accumulated_depreciation)
        ef15 = self.client.post(
            url,
            {
                **base_payload,
                "rows": [{"asset_id": asset1["id"], "remaining_value": "99999999.00"}],
            },
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(
            str(ef15.data["remaining_value"]),
            "Giá trị còn lại của tài sản không hợp lệ.",
        )

        # EF16: Pending related transactions
        ef16 = self.client.post(
            url,
            {**base_payload, "has_pending_related_tx": True},
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(
            str(ef16.data["asset"]),
            "Tài sản có nghiệp vụ liên quan chưa hoàn tất. Vui lòng kiểm tra lại.",
        )

        # EF17: Missing supporting documents for "Nhượng bán, thanh lý" when required
        ef17 = self.client.post(
            url,
            {**base_payload, "require_supporting_docs": True, "reference": "", "attachments": []},
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(str(ef17.data["reason"]), "Chưa đủ hồ sơ nhượng bán, thanh lý tài sản.")

        # EF18: Missing supporting documents for "Phát hiện thiếu khi kiểm kê" when required
        ef18 = self.client.post(
            url,
            {
                **base_payload,
                "reason": "Phát hiện thiếu khi kiểm kê",
                "require_supporting_docs": True,
                "reference": "",
                "attachments": [],
            },
            format="json",
        )
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(str(ef18.data["reason"]), "Chưa đủ hồ sơ xác nhận tài sản thiếu khi kiểm kê.")

        # EF19: Missing info/docs for capital contribution when required
        ef19 = self.client.post(
            url,
            {
                **base_payload,
                "reason": "Góp vốn vào công ty con",
                "require_supporting_docs": True,
                "recipient_entity": "",
            },
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(str(ef19.data["reason"]), "Chưa đủ thông tin hoặc hồ sơ góp vốn bằng tài sản cố định.")

        # EF20: Asset is not finance lease when reason is "Trả lại TSCĐ thuê tài chính"
        ef20 = self.client.post(
            url,
            {
                **base_payload,
                "reason": "Trả lại TSCĐ thuê tài chính",
            },
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(str(ef20.data["reason"]), "Tài sản không thuộc loại TSCĐ thuê tài chính.")

        # EF21: Missing basis/info for converting TSCĐ to CCDC when required
        ef21 = self.client.post(
            url,
            {
                **base_payload,
                "reason": "Chuyển TSCĐ thành CCDC",
                "require_supporting_docs": True,
                "conversion_basis": "",
            },
            format="json",
        )
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(str(ef21.data["reason"]), "Chưa đủ căn cứ hoặc thông tin chuyển TSCĐ thành CCDC.")

        # EF22: Invalid asset_account or accumulated_account
        ef22 = self.client.post(
            url,
            {
                **base_payload,
                "rows": [{"asset_id": asset1["id"], "asset_account": "9999", "accumulated_account": "2141"}],
            },
            format="json",
        )
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(str(ef22.data["asset_account"]), "Tài khoản nguyên giá hoặc hao mòn TSCĐ không hợp lệ.")

        # EF23: Disposal account incompatible with disposal reason
        ef23 = self.client.post(
            url,
            {
                **base_payload,
                "reason": "Góp vốn vào công ty con",
                "rows": [{"asset_id": asset1["id"], "disposal_account": "811"}],
            },
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(
            str(ef23.data["disposal_account"]),
            "Tài khoản xử lý giá trị không phù hợp với lý do ghi giảm.",
        )

        # EF24: Unbalanced accounting entries
        ef24 = self.client.post(
            url,
            {
                **base_payload,
                "accounting_entries": [
                    {
                        "debit_account": "2141",
                        "credit_account": "2112",
                        "debit_amount": "50000000.00",
                        "credit_amount": "40000000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(
            str(ef24.data["accounting_entries"]),
            "Bút toán ghi giảm không cân đối. Vui lòng kiểm tra lại.",
        )

        # EF25: Total derecognized original cost on TK Nguyên giá does not match sum(original_cost)
        ef25 = self.client.post(
            url,
            {
                **base_payload,
                "accounting_entries": [
                    {
                        "debit_account": "2141",
                        "credit_account": "2112",
                        "amount": "50000000.00",
                    },
                    {
                        "debit_account": "811",
                        "credit_account": "2112",
                        "amount": "90000000.00",  # 50M + 90M = 140M != 150M
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(
            str(ef25.data["accounting_entries"]),
            "Số tiền ghi giảm nguyên giá không khớp với danh sách tài sản.",
        )

        # EF26: Concurrent disposal transaction
        ef26 = self.client.post(
            url,
            {**base_payload, "has_concurrent_disposal": True},
            format="json",
        )
        self.assertEqual(ef26.status_code, 400)
        self.assertEqual(
            str(ef26.data["asset"]),
            "Tài sản đang có nghiệp vụ ghi giảm khác. Vui lòng kiểm tra lại.",
        )

        # EF27: Database/GL failure atomic rollback
        ef27 = self.client.post(
            url,
            {**base_payload, "simulate_gl_failure": True},
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(
            str(ef27.data["detail"]),
            "Ghi giảm tài sản cố định thất bại. Vui lòng thử lại.",
        )
        # Ensure asset1 is still ACTIVE after rollback
        self.assertEqual(models.AssetRecord.objects.get(pk=asset1["id"]).status, models.AssetStatus.ACTIVE)

        # EF29: Attachment > 5MB
        ef29 = self.client.post(
            url,
            {
                **base_payload,
                "attachments": [{"name": "oversized.pdf", "size": 6 * 1024 * 1024}],
            },
            format="json",
        )
        self.assertEqual(ef29.status_code, 400)
        self.assertEqual(
            str(ef29.data["attachments"]),
            "Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.",
        )

        # EF30: Asset belongs to another company
        from organization.models import Branch, Company
        other_company = Company.objects.create(
            code="OTHER_CO_07",
            name="Công ty Khác 07",
            tax_code="0109999907",
            accounting_currency=self.company.accounting_currency,
            legal_reporting_currency=self.company.legal_reporting_currency,
        )
        other_branch = Branch.objects.create(company=other_company, code="HQ07", name="Trụ sở 07")
        other_cat = models.AssetCategory.objects.create(
            company=other_company,
            code="CAT07",
            name="Nhóm khác 07",
            asset_type="FIXED_ASSET",
            default_periods=60,
        )
        other_asset = models.AssetRecord.objects.create(
            company=other_company,
            branch=other_branch,
            category=other_cat,
            code="TS-OTHER-07",
            name="Tài sản công ty khác 07",
            asset_type="FIXED_ASSET",
            acquisition_date="2025-01-01",
            in_service_date="2025-01-01",
            original_cost=Decimal("100000000.00"),
            depreciable_amount=Decimal("100000000.00"),
            useful_life_periods=60,
            status=models.AssetStatus.ACTIVE,
            created_by=services.actor(type("Req", (), {"user": self.maker})()),
        )
        ef30 = self.client.post(
            url,
            {**base_payload, "rows": [{"asset_id": str(other_asset.id)}]},
            format="json",
        )
        self.assertEqual(ef30.status_code, 403)
        self.assertEqual(str(ef30.data["detail"]), "Bạn không có quyền ghi giảm tài sản này.")

        # Succeed with idempotency_key, then verify EF28 (idempotent replay) & EF07 (duplicate voucher_no)
        ok_resp = self.client.post(
            url,
            {**base_payload, "idempotency_key": "IDEM-DISP-900"},
            format="json",
        )
        self.assertEqual(ok_resp.status_code, 201, ok_resp.data)

        ef28 = self.client.post(
            url,
            {**base_payload, "idempotency_key": "IDEM-DISP-900"},
            format="json",
        )
        self.assertEqual(ef28.status_code, 200)
        self.assertTrue(ef28.data.get("idempotent_replayed"))

        # EF07: Duplicate voucher_no GGTS00900
        ef07 = self.client.post(
            url,
            {
                **base_payload,
                "voucher_no": "GGTS00900",
                "rows": [{"asset_id": asset2["id"]}],
            },
            format="json",
        )
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["voucher_no"]), "Số chứng từ ghi giảm đã tồn tại.")

        # EF01: User without permission to dispose fixed assets
        no_perm_user = get_user_model().objects.create_user(username="no-disp-perm", email="nodisp@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(url, {**base_payload, "voucher_no": "GGTS00901"}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền ghi giảm tài sản cố định.")

    # =========================================================================
    # UC-FA-08 – KIỂM KÊ TÀI SẢN CỐ ĐỊNH
    # =========================================================================

    def _create_uc08_book_asset(
        self,
        code: str,
        name: str,
        original_cost: Decimal,
        accumulated_depreciation: Decimal,
        department_obj=None,
        acquisition_date: str = "2024-01-10",
        status_val: str = models.AssetStatus.ACTIVE,
        disposed_at=None,
    ) -> models.AssetRecord:
        dept = department_obj or self.department
        cat_obj = models.AssetCategory.objects.get(pk=self.fixed_category)
        rem_val = (original_cost - accumulated_depreciation).quantize(Decimal("0.01"))
        return models.AssetRecord.objects.create(
            company=self.company,
            branch=self.branch,
            category=cat_obj,
            department=dept,
            code=code,
            name=name,
            asset_type="FIXED_ASSET",
            quantity=Decimal("1"),
            acquisition_date=acquisition_date,
            in_service_date=acquisition_date,
            original_cost=original_cost,
            depreciable_amount=original_cost,
            accumulated_depreciation=accumulated_depreciation,
            useful_life_periods=60,
            periods_processed=12 if rem_val > 0 else 60,
            status=status_val,
            disposed_at=disposed_at,
            created_by=services.actor(type("Req", (), {"user": self.maker})()),
        )

    def test_uc_fa_08_main_flow_and_section_4_8_example_reconciliation(self):
        """
        Tests UC-FA-08 Main Flow (Steps 1–46), Section 4.1–4.8 calculation formulas
        (including the exact worked example in Section 4.8), and BR37 (stocktake does not
        mutate AssetRecord book values, department, or status).
        """
        from organization.models import Department
        from audit_log.models import AuditLog

        dept_kt = Department.objects.create(company=self.company, branch=self.branch, code="PKT08", name="Phòng Kế toán")
        dept_kd = Department.objects.create(company=self.company, branch=self.branch, code="PKD08", name="Phòng Kinh doanh")
        dept_hc = Department.objects.create(company=self.company, branch=self.branch, code="PHC08", name="Phòng Hành chính")
        dept_ns = Department.objects.create(company=self.company, branch=self.branch, code="PNS08", name="Phòng Nhân sự")
        dept_kv = Department.objects.create(company=self.company, branch=self.branch, code="PKV08", name="Kho vận")

        a1 = self._create_uc08_book_asset("TSCD0001", "Hệ thống máy chủ ERP", Decimal("120000000.00"), Decimal("30000000.00"), dept_kt)
        a2 = self._create_uc08_book_asset("TSCD0002", "Máy photocopy Ricoh", Decimal("80000000.00"), Decimal("20000000.00"), dept_kd)
        a3 = self._create_uc08_book_asset("TSCD0003", "Điều hòa trung tâm Daikin (Hết KH)", Decimal("50000000.00"), Decimal("50000000.00"), dept_hc)
        a4 = self._create_uc08_book_asset("TSCD0004", "Máy chiếu hội trường Sony", Decimal("90000000.00"), Decimal("30000000.00"), dept_kt)
        a5 = self._create_uc08_book_asset("TSCD0005", "Xe nâng hàng điện Toyota", Decimal("60000000.00"), Decimal("15000000.00"), dept_kv)

        url = f"/api/v1/fixed-assets/counts/{self.query}"
        payload = {
            "company": str(self.company.id),
            "voucher_no": "KKTS00001",
            "count_date": "31/12/2025",
            "report_datetime": "31/12/2025 14:30:00",
            "purpose": "Kiểm kê TSCĐ định kỳ cuối năm 2025",
            "conclusion": "Đã kiểm kê 05 TSCĐ theo sổ kế toán: 03 khớp, 01 thiếu, 01 sai đơn vị sử dụng, 01 phát hiện thừa ngoài sổ, 01 có vấn đề chất lượng.",
            "recommendations_processed": False,
            "members": [
                {"name": "Nguyễn Văn An", "position": "Trưởng ban kiểm kê", "represent": "Ban Giám đốc", "role": "Trưởng ban"},
                {"name": "Trần Thị Bình", "position": "Kế toán TSCĐ", "represent": "Phòng Kế toán", "role": "Ủy viên"},
            ],
            "lines": [
                {
                    "asset": str(a1.id),
                    "existence_status": "EXISTS",
                    "actual_department_name": "Phòng Kế toán",
                    "current_quality": "Bình thường",
                    "recommendation": "Tiếp tục sử dụng",
                },
                {
                    "asset": str(a2.id),
                    "existence_status": "EXISTS",
                    "actual_department_name": "Phòng Kinh doanh",
                    "current_quality": "Hư hỏng nhẹ cụm sấy",
                    "recommendation": "Đề nghị sửa chữa bảo dưỡng",
                },
                {
                    "asset": str(a3.id),
                    "existence_status": "EXISTS",
                    "actual_department_name": "Phòng Hành chính",
                    "current_quality": "Bình thường",
                    "recommendation": "Tiếp tục sử dụng",
                },
                {
                    "asset": str(a4.id),
                    "existence_status": "EXISTS",
                    "actual_department_name": dept_ns.name,
                    "current_quality": "Bình thường",
                    "recommendation": "Lập chứng từ điều chuyển sang Phòng Nhân sự",
                },
                {
                    "asset": str(a5.id),
                    "existence_status": "MISSING",
                    "current_quality": "Không tìm thấy tại Kho vận khi kiểm kê",
                    "recommendation": "Truy tìm nguyên nhân và lập hồ sơ xử lý thiếu",
                    "note": "Đã kiểm tra toàn bộ khu vực kho B",
                },
                {
                    "is_surplus": True,
                    "temp_code": "THUA-001",
                    "asset_name": "Máy in mã vạch Zebra ngoài sổ",
                    "actual_department_name": "Phòng Hành chính",
                    "identification_info": "Serial ZBR-99881 tại bàn tiếp nhận",
                    "current_quality": "Bình thường",
                    "recommendation": "Xác minh nguồn gốc để ghi tăng TSCĐ",
                },
            ],
            "attachments": [
                {"name": "bien_ban_kiem_ke_2025.pdf", "size": 512000},
            ],
        }

        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        data = resp.data
        self.assertEqual(data["voucher_no"], "KKTS00001")
        self.assertEqual(data["status"], "CONFIRMED")
        self.assertEqual(data["message"], "Lưu biên bản kiểm kê tài sản cố định thành công.")

        # Verify Section 4.1–4.8 formulas & worked example numbers
        summary = data["summary"]
        self.assertEqual(summary["book_assets_count"], 5)
        self.assertEqual(summary["verified_existing_count"], 4)
        self.assertEqual(summary["matched_count"], 3)
        self.assertEqual(summary["missing_count"], 1)
        self.assertEqual(summary["department_mismatch_count"], 1)
        self.assertEqual(summary["surplus_count"], 1)
        self.assertEqual(summary["diff_count"], 3)
        self.assertEqual(summary["quality_issue_count"], 1)
        self.assertEqual(summary["uncounted_count"], 0)
        self.assertEqual(Decimal(summary["total_original_cost"]), Decimal("400000000.00"))
        self.assertEqual(Decimal(summary["total_accumulated_depreciation"]), Decimal("145000000.00"))
        self.assertEqual(Decimal(summary["total_remaining_value"]), Decimal("255000000.00"))

        # Verify BR37 & Step 41: Saving stocktake MUST NOT mutate AssetRecord book values, department, or status
        a4.refresh_from_db()
        a5.refresh_from_db()
        self.assertEqual(a4.department_id, dept_kt.id)
        self.assertEqual(a5.status, models.AssetStatus.ACTIVE)
        self.assertEqual(a5.remaining_value, Decimal("45000000.00"))

        # Verify AuditLog was written
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company,
                entity_id=data["id"],
                action_code="STOCKTAKE_ASSET",
            ).exists()
        )

    def test_uc_fa_08_alternative_flows_load_book_assets_scope_filter_draft_and_recommendations(self):
        """
        Tests UC-FA-08 Alternative Flows:
        - AF03: Auto-numbering (KKTS00001 -> KKTS00002, and year-based KKTS-YYYY-00001)
        - AF06–AF08 & BR11–BR14: Load book assets at count_date filtered by department/category,
          including fully depreciated assets (BR13), excluding disposed/future assets (BR12),
          and initializing every row in UNCOUNTED state (BR14).
        - AF26: Save DRAFT with UNCOUNTED rows, then confirm and mark recommendations processed (AF19–AF22).
        """
        from organization.models import Department

        dept_a = Department.objects.create(company=self.company, branch=self.branch, code="DA08", name="Bộ phận A")
        dept_b = Department.objects.create(company=self.company, branch=self.branch, code="DB08", name="Bộ phận B")

        a_active = self._create_uc08_book_asset("TS-A01", "Máy CNC A1", Decimal("100000000.00"), Decimal("25000000.00"), dept_a, acquisition_date="2025-01-15")
        a_zero_rem = self._create_uc08_book_asset("TS-A02", "Máy tiện hết KH còn dùng", Decimal("40000000.00"), Decimal("40000000.00"), dept_a, acquisition_date="2020-01-15")
        self._create_uc08_book_asset("TS-B01", "Xe tải Bộ phận B", Decimal("200000000.00"), Decimal("50000000.00"), dept_b, acquisition_date="2025-02-01")
        # Disposed before count_date -> must be excluded (BR12)
        self._create_uc08_book_asset(
            "TS-DISP",
            "Tài sản đã thanh lý",
            Decimal("70000000.00"),
            Decimal("70000000.00"),
            dept_a,
            acquisition_date="2023-01-01",
            status_val=models.AssetStatus.DISPOSED,
            disposed_at="2025-06-01",
        )
        # Acquired after count_date -> must be excluded (BR12)
        self._create_uc08_book_asset("TS-FUT", "Tài sản mua sau ngày kiểm kê", Decimal("90000000.00"), Decimal("0.00"), dept_a, acquisition_date="2025-12-20")

        # 1. Check next-number endpoint
        next_no_resp = self.client.get(f"/api/v1/fixed-assets/counts/next-number/{self.query}")
        self.assertEqual(next_no_resp.status_code, 200)
        self.assertEqual(next_no_resp.data["voucher_no"], "KKTS00001")

        year_no_resp = self.client.get(f"/api/v1/fixed-assets/counts/next-number/{self.query}&year_based=true&count_date=2025-10-31")
        self.assertEqual(year_no_resp.status_code, 200)
        self.assertEqual(year_no_resp.data["voucher_no"], "KKTS-2025-00001")

        # 2. Load book assets filtered by Department A as of 31/10/2025 (AF06, BR11–BR14)
        load_resp = self.client.post(
            f"/api/v1/fixed-assets/counts/load-book-assets/{self.query}",
            {
                "company": str(self.company.id),
                "count_date": "31/10/2025",
                "department_id": str(dept_a.id),
            },
            format="json",
        )
        self.assertEqual(load_resp.status_code, 200, load_resp.data)
        loaded_lines = load_resp.data["lines"]
        loaded_codes = [r["asset_code"] for r in loaded_lines]
        self.assertEqual(loaded_codes, ["TS-A01", "TS-A02"])
        # Verify BR14: all loaded rows start in UNCOUNTED state (exists is None)
        for row in loaded_lines:
            self.assertEqual(row["existence_status"], "UNCOUNTED")
            self.assertIsNone(row["exists"])
        self.assertEqual(load_resp.data["summary"]["uncounted_count"], 2)

        # 3. Save as DRAFT while rows are still UNCOUNTED (AF26)
        draft_resp = self.client.post(
            f"/api/v1/fixed-assets/counts/{self.query}",
            {
                "company": str(self.company.id),
                "auto_number": True,
                "count_date": "31/10/2025",
                "purpose": "Kiểm kê Bộ phận A tháng 10/2025",
                "status": "DRAFT",
                "lines": loaded_lines,
            },
            format="json",
        )
        self.assertEqual(draft_resp.status_code, 201, draft_resp.data)
        self.assertEqual(draft_resp.data["status"], "DRAFT")
        self.assertEqual(draft_resp.data["voucher_no"], "KKTS00001")
        count_id = draft_resp.data["id"]

        # 4. Update DRAFT -> CONFIRMED and then mark recommendations processed with resolution basis (AF19–AF22)
        confirm_resp = self.client.put(
            f"/api/v1/fixed-assets/counts/{count_id}/{self.query}",
            {
                "company": str(self.company.id),
                "voucher_no": "KKTS00001",
                "count_date": "31/10/2025",
                "purpose": "Kiểm kê Bộ phận A tháng 10/2025",
                "conclusion": "Đã kiểm kê Bộ phận A: phát hiện 01 tài sản thiếu đã lập chứng từ xử lý.",
                "recommendations_processed": True,
                "reference": "GGTS00088",
                "lines": [
                    {
                        "asset": str(a_active.id),
                        "existence_status": "EXISTS",
                        "current_quality": "Bình thường",
                        "recommendation": "Tiếp tục sử dụng",
                    },
                    {
                        "asset": str(a_zero_rem.id),
                        "existence_status": "MISSING",
                        "current_quality": "Không tìm thấy khi kiểm kê",
                        "recommendation": "Ghi giảm TSCĐ thiếu theo QĐ xử lý",
                        "resolution_voucher_no": "GGTS00088",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(confirm_resp.status_code, 200, confirm_resp.data)
        self.assertEqual(confirm_resp.data["status"], "PROCESSED")
        self.assertTrue(confirm_resp.data["recommendations_processed"])

    def test_uc_fa_08_exception_flows_ef01_to_ef28(self):
        """
        Verifies exact Vietnamese error messages for UC-FA-08 Exception Flows EF01 through EF28,
        atomic rollback on DB failure (EF24), and idempotency (EF25).
        """
        from organization.models import Branch, Company

        asset1 = self._create_uc08_book_asset("TS-EF08-1", "Máy kiểm kê EF 1", Decimal("100000000.00"), Decimal("20000000.00"))
        asset2 = self._create_uc08_book_asset("TS-EF08-2", "Máy kiểm kê EF 2", Decimal("80000000.00"), Decimal("10000000.00"))
        disposed_asset = self._create_uc08_book_asset(
            "TS-EF08-DISP",
            "Máy đã ghi giảm trước ngày kiểm kê",
            Decimal("50000000.00"),
            Decimal("50000000.00"),
            status_val=models.AssetStatus.DISPOSED,
            disposed_at="2025-05-01",
        )

        url = f"/api/v1/fixed-assets/counts/{self.query}"
        base_payload = {
            "company": str(self.company.id),
            "voucher_no": "KKTS00800",
            "count_date": "15/10/2025",
            "report_datetime": "15/10/2025 10:00:00",
            "purpose": "Kiểm kê định kỳ quý 4",
            "conclusion": "Hoàn tất kiểm kê.",
            "lines": [
                {
                    "asset": str(asset1.id),
                    "existence_status": "EXISTS",
                    "current_quality": "Bình thường",
                    "recommendation": "Tiếp tục sử dụng",
                }
            ],
        }

        # EF02: Missing purpose
        ef02 = self.client.post(url, {**base_payload, "purpose": "   "}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["purpose"]), "Vui lòng nhập mục đích kiểm kê.")

        # EF03: Invalid count_date
        ef03 = self.client.post(url, {**base_payload, "count_date": "31/02/2025"}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["count_date"]), "Vui lòng nhập ngày kiểm kê hợp lệ theo định dạng DD/MM/YYYY.")

        # EF04: Future count_date without planned flag
        ef04 = self.client.post(url, {**base_payload, "count_date": "31/12/2099"}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["count_date"]), "Ngày kiểm kê không được lớn hơn ngày hiện tại.")

        # EF05: Report date earlier than count_date
        ef05 = self.client.post(url, {**base_payload, "report_datetime": "10/10/2025 08:00:00"}, format="json")
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["report_date"]), "Ngày lập biên bản không phù hợp với ngày kiểm kê.")

        # EF06: Invalid voucher_no
        ef06 = self.client.post(url, {**base_payload, "voucher_no": "KKTS@@@"}, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["voucher_no"]), "Vui lòng nhập số chứng từ kiểm kê hợp lệ.")

        # EF08: Invalid/incomplete committee member
        ef08 = self.client.post(
            url,
            {**base_payload, "members": [{"name": "", "position": "Trưởng ban"}]},
            format="json",
        )
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["committee"]), "Vui lòng khai báo đầy đủ thành viên tham gia kiểm kê.")

        # EF09: Empty asset lines
        ef09 = self.client.post(url, {**base_payload, "lines": []}, format="json")
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["lines"]), "Chưa có tài sản trong bảng kiểm kê.")

        # EF10: Failure loading book assets at count_date
        ef10 = self.client.post(
            f"/api/v1/fixed-assets/counts/load-book-assets/{self.query}",
            {"company": str(self.company.id), "count_date": "15/10/2025", "simulate_load_error": True},
            format="json",
        )
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["detail"]), "Không thể lấy danh sách tài sản tại ngày kiểm kê. Vui lòng thử lại.")

        # EF11: Non-existent asset code
        ef11 = self.client.post(
            url,
            {**base_payload, "lines": [{"asset_code": "TS-KHONG-TON-TAI", "existence_status": "EXISTS"}]},
            format="json",
        )
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["lines"]), "Tài sản TS-KHONG-TON-TAI không hợp lệ.")

        # EF12: Asset already disposed before count_date
        ef12 = self.client.post(
            url,
            {**base_payload, "lines": [{"asset": str(disposed_asset.id), "existence_status": "EXISTS"}]},
            format="json",
        )
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(
            str(ef12.data["lines"]),
            f"Tài sản {disposed_asset.code} không thuộc danh sách tài sản đang theo dõi tại ngày kiểm kê.",
        )

        # EF13: Duplicate asset in the same stocktake sheet
        ef13 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [
                    {"asset": str(asset1.id), "existence_status": "EXISTS"},
                    {"asset": str(asset1.id), "existence_status": "EXISTS"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["lines"]), f"Tài sản {asset1.code} đã có trong bảng kiểm kê.")

        # EF14: Unconfirmed (UNCOUNTED) row when saving completed stocktake
        ef14 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [{"asset": str(asset1.id), "existence_status": "UNCOUNTED"}],
            },
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(
            str(ef14.data["lines"]),
            "Còn tài sản chưa được xác nhận kết quả kiểm kê. Vui lòng kiểm tra lại.",
        )

        # EF15: Missing asset without condition/note or recommendation
        ef15 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [{"asset": str(asset1.id), "existence_status": "MISSING", "current_quality": "", "recommendation": ""}],
            },
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(
            str(ef15.data["lines"]),
            f"Vui lòng ghi rõ tình trạng và kiến nghị xử lý đối với tài sản {asset1.code}.",
        )

        # EF16: Existing asset with abnormal quality without recommendation
        ef16 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [{"asset": str(asset1.id), "existence_status": "EXISTS", "current_quality": "Hư hỏng nặng", "recommendation": ""}],
            },
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(
            str(ef16.data["lines"]),
            f"Vui lòng bổ sung tình trạng và kiến nghị xử lý cho tài sản {asset1.code}.",
        )

        # EF17: Surplus asset missing identification info / name / department
        ef17 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [{"is_surplus": True, "asset_name": "", "actual_department_name": ""}],
            },
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(str(ef17.data["lines"]), "Vui lòng bổ sung thông tin nhận dạng tài sản thừa.")

        # EF18: Stale book value / version mismatch
        ef18 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [
                    {
                        "asset": str(asset1.id),
                        "existence_status": "EXISTS",
                        "expected_remaining_value": "999999999.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(
            str(ef18.data["lines"]),
            "Số liệu tài sản đã thay đổi. Vui lòng cập nhật lại dữ liệu theo ngày kiểm kê.",
        )

        # EF19: Contradictory line result (MISSING but recommendation says 'Tiếp tục sử dụng')
        ef19 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [
                    {
                        "asset": str(asset1.id),
                        "existence_status": "MISSING",
                        "current_quality": "Không tìm thấy",
                        "recommendation": "Tiếp tục sử dụng",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(str(ef19.data["lines"]), f"Kết quả kiểm kê của tài sản {asset1.code} không nhất quán.")

        # EF20: Conclusion contradicts detailed reconciliation results (claims 100% matched when 1 asset is missing)
        ef20 = self.client.post(
            url,
            {
                **base_payload,
                "conclusion": "Toàn bộ tài sản khớp 100%, không phát sinh chênh lệch.",
                "lines": [
                    {
                        "asset": str(asset1.id),
                        "existence_status": "MISSING",
                        "current_quality": "Mất",
                        "recommendation": "Lập biên bản xử lý thiếu",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(
            str(ef20.data["conclusion"]),
            "Kết luận kiểm kê không khớp với kết quả đối chiếu. Vui lòng kiểm tra lại.",
        )

        # EF21: Checking 'Đã xử lý kiến nghị' while a row is still in 'Tiếp tục xác minh' / PENDING
        ef21 = self.client.post(
            url,
            {
                **base_payload,
                "recommendations_processed": True,
                "lines": [
                    {
                        "asset": str(asset1.id),
                        "existence_status": "MISSING",
                        "current_quality": "Chưa tìm thấy",
                        "recommendation": "Tiếp tục xác minh nguyên nhân",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(
            str(ef21.data["recommendations_processed"]),
            "Còn kiến nghị kiểm kê chưa được xử lý. Không thể xác nhận đã xử lý kiến nghị.",
        )

        # EF22: Checking 'Đã xử lý kiến nghị' on actionable discrepancy without resolution voucher/result
        ef22 = self.client.post(
            url,
            {
                **base_payload,
                "recommendations_processed": True,
                "lines": [
                    {
                        "asset": str(asset1.id),
                        "existence_status": "MISSING",
                        "current_quality": "Không tìm thấy",
                        "recommendation": "Đề nghị xử lý ghi giảm",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(
            str(ef22.data["recommendations_processed"]),
            "Vui lòng bổ sung chứng từ hoặc kết quả xử lý kiến nghị.",
        )

        # EF23: Cross-company asset / out-of-scope permission
        other_co = Company.objects.create(
            code="OTHER_CO_08",
            name="Công ty Khác 08",
            tax_code="0109999908",
            accounting_currency=self.company.accounting_currency,
            legal_reporting_currency=self.company.legal_reporting_currency,
        )
        other_br = Branch.objects.create(company=other_co, code="HQ08", name="Trụ sở 08")
        other_cat = models.AssetCategory.objects.create(
            company=other_co,
            code="CAT08",
            name="Nhóm khác 08",
            asset_type="FIXED_ASSET",
            default_periods=60,
        )
        other_asset = models.AssetRecord.objects.create(
            company=other_co,
            branch=other_br,
            category=other_cat,
            code="TS-OTHER-08",
            name="Tài sản công ty khác 08",
            asset_type="FIXED_ASSET",
            acquisition_date="2025-01-01",
            in_service_date="2025-01-01",
            original_cost=Decimal("100000000.00"),
            depreciable_amount=Decimal("100000000.00"),
            useful_life_periods=60,
            status=models.AssetStatus.ACTIVE,
            created_by=services.actor(type("Req", (), {"user": self.maker})()),
        )
        ef23 = self.client.post(
            url,
            {**base_payload, "lines": [{"asset": str(other_asset.id), "existence_status": "EXISTS"}]},
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(str(ef23.data["detail"]), "Bạn không có quyền kiểm kê tài sản thuộc phạm vi này.")

        # EF24: Simulated database error rolls back transaction cleanly
        ef24 = self.client.post(url, {**base_payload, "simulate_db_error": True}, format="json")
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(str(ef24.data["detail"]), "Lưu biên bản kiểm kê thất bại. Vui lòng thử lại.")
        self.assertFalse(models.AssetCount.objects.filter(company=self.company, number="KKTS00800").exists())

        # EF26: Invalid attachment size (> 5MB)
        ef26 = self.client.post(
            url,
            {**base_payload, "attachments": [{"name": "video_kiem_ke.mp4", "size": 7 * 1024 * 1024}]},
            format="json",
        )
        self.assertEqual(ef26.status_code, 400)
        self.assertEqual(
            str(ef26.data["attachments"]),
            "Tệp đính kèm không hợp lệ hoặc vượt quá dung lượng cho phép (tối đa 5MB).",
        )

        # EF28: Attempt to auto-dispose missing asset directly from stocktake without approved resolution basis
        ef28 = self.client.post(url, {**base_payload, "auto_dispose_missing": True}, format="json")
        self.assertEqual(ef28.status_code, 400)
        self.assertEqual(
            str(ef28.data["detail"]),
            "Chưa đủ căn cứ ghi giảm tài sản. Vui lòng hoàn tất hồ sơ xử lý sau kiểm kê.",
        )

        # Save valid voucher with idempotency_key -> verify EF25 (idempotent replay), EF07 (duplicate number), and EF27 (unauthorized edit of confirmed voucher)
        ok_resp = self.client.post(
            url,
            {**base_payload, "idempotency_key": "IDEM-KKTS-800"},
            format="json",
        )
        self.assertEqual(ok_resp.status_code, 201, ok_resp.data)
        saved_id = ok_resp.data["id"]

        ef25 = self.client.post(
            url,
            {**base_payload, "idempotency_key": "IDEM-KKTS-800"},
            format="json",
        )
        self.assertEqual(ef25.status_code, 200)
        self.assertTrue(ef25.data.get("idempotent_replayed"))

        # EF07: Duplicate voucher_no KKTS00800
        ef07 = self.client.post(
            url,
            {
                **base_payload,
                "voucher_no": "KKTS00800",
                "lines": [{"asset": str(asset2.id), "existence_status": "EXISTS"}],
            },
            format="json",
        )
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["voucher_no"]), "Số chứng từ kiểm kê đã tồn tại.")

        # EF27: Unauthorized modification of confirmed stocktake voucher
        ef27 = self.client.put(
            f"/api/v1/fixed-assets/counts/{saved_id}/{self.query}",
            {**base_payload, "purpose": "Sửa trái phép biên bản đã xác nhận"},
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(str(ef27.data["detail"]), "Bạn không có quyền điều chỉnh biên bản kiểm kê đã xác nhận.")

        # EF01: User without permission to perform fixed asset stocktake
        no_perm_user = get_user_model().objects.create_user(username="no-kk-perm", email="nokk@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(url, {**base_payload, "voucher_no": "KKTS00801"}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền thực hiện kiểm kê tài sản cố định.")

    # ==========================================================================
    # UC-FA-09 – XEM SỔ VÀ BÁO CÁO TÀI SẢN
    # ==========================================================================

    def _setup_uc09_assets_and_movements(self):
        from datetime import date

        user_actor = services.actor(type("Req", (), {"user": self.maker})())
        default_cat = models.AssetCategory.objects.get(pk=self.fixed_category)
        acc_211 = self.accounts[0]
        acc_214 = self.accounts[1]
        acc_642 = self.accounts[2]

        dept_tech = self.department
        dept_admin = Department.objects.create(
            company=self.company,
            branch=self.branch,
            code="HCNS-09",
            name="Phòng Hành chính - Nhân sự",
        )
        dept_sales = Department.objects.create(
            company=self.company,
            branch=self.branch,
            code="KD-09",
            name="Phòng Kinh doanh",
        )
        cat_vehicle = models.AssetCategory.objects.create(
            company=self.company,
            code="PTVT-09",
            name="Phương tiện vận tải",
            asset_type=models.AssetType.FIXED_ASSET,
            default_periods=96,
            asset_account=acc_211,
            accumulated_account=acc_214,
            expense_account=acc_642,
        )

        # Asset 1: Acquired 2026-01-10 at dept_tech (original_cost=120M),
        # depreciated 10M on 2026-03-31, transferred to dept_admin on 2026-06-15,
        # revalued +30M on 2026-09-01 (so after 2026-09-01 original_cost=150M, accum=10M, rem=140M).
        a1 = models.AssetRecord.objects.create(
            company=self.company,
            branch=self.branch,
            category=default_cat,
            department=dept_admin,
            code="TS09-001",
            name="Máy chủ Dell PowerEdge R750",
            serial_number="SN-R750-001",
            country_of_origin="Mỹ",
            manufacture_year=2025,
            asset_type=models.AssetType.FIXED_ASSET,
            status=models.AssetStatus.ACTIVE,
            acquisition_date=date(2026, 1, 10),
            in_service_date=date(2026, 1, 10),
            acquisition_voucher_no="GTTS09001",
            original_cost=Decimal("150000000.00"),
            depreciable_amount=Decimal("150000000.00"),
            accumulated_depreciation=Decimal("10000000.00"),
            useful_life_periods=60,
            annual_depreciation_rate=Decimal("20.00"),
            monthly_depreciation_rate=Decimal("1.67"),
            method=models.DepreciationMethod.STRAIGHT_LINE,
            asset_account=acc_211,
            accumulated_account=acc_214,
            components=[{"name": "RAM ECC 64GB", "unit": "Thanh", "quantity": 2, "value": 15000000}],
            accessories=[{"name": "Cáp nguồn chuẩn C13", "unit": "Sợi", "quantity": 2, "value": 500000}],
            created_by=user_actor,
        )
        models.AssetTransaction.objects.create(
            company=self.company,
            asset=a1,
            transaction_type="ACQUISITION",
            number="GTTS09001",
            transaction_date=date(2026, 1, 10),
            amount=Decimal("120000000.00"),
            status="POSTED",
            reason="Ghi tăng máy chủ Dell PowerEdge R750",
            created_by=user_actor,
        )
        models.AssetTransaction.objects.create(
            company=self.company,
            asset=a1,
            transaction_type="DEPRECIATION",
            number="KH09-202603",
            transaction_date=date(2026, 3, 31),
            amount=Decimal("10000000.00"),
            status="POSTED",
            reason="Khấu hao quý 1/2026",
            created_by=user_actor,
        )
        models.AssetTransaction.objects.create(
            company=self.company,
            asset=a1,
            transaction_type="TRANSFER",
            number="ĐCTS09001",
            transaction_date=date(2026, 6, 15),
            amount=Decimal("0.00"),
            status="POSTED",
            target_department=dept_admin,
            before_snapshot={
                "from_department_id": str(dept_tech.id),
                "from_department_name": dept_tech.name,
            },
            reason="Điều chuyển máy chủ sang Phòng HCNS",
            created_by=user_actor,
        )
        models.AssetTransaction.objects.create(
            company=self.company,
            asset=a1,
            transaction_type="VALUE_INCREASE",
            number="ĐGL09001",
            transaction_date=date(2026, 9, 1),
            amount=Decimal("30000000.00"),
            status="POSTED",
            before_snapshot={
                "orig_before": "120000000.00",
                "orig_after": "150000000.00",
                "depr_before": "10000000.00",
                "depr_after": "10000000.00",
            },
            reason="Nâng cấp ổ cứng NVMe cho máy chủ",
            created_by=user_actor,
        )

        # Asset 2: Non-fixed-rate method (Step 14: must NOT fabricate a fixed percentage)
        a2 = models.AssetRecord.objects.create(
            company=self.company,
            branch=self.branch,
            category=cat_vehicle,
            department=dept_sales,
            code="TS09-002",
            name="Xe tải vận chuyển Isuzu 5 tấn",
            country_of_origin="Nhật Bản",
            manufacture_year=2025,
            asset_type=models.AssetType.FIXED_ASSET,
            status=models.AssetStatus.ACTIVE,
            acquisition_date=date(2026, 2, 1),
            in_service_date=date(2026, 2, 1),
            acquisition_voucher_no="GTTS09002",
            original_cost=Decimal("600000000.00"),
            depreciable_amount=Decimal("600000000.00"),
            accumulated_depreciation=Decimal("50000000.00"),
            useful_life_periods=96,
            method=models.DepreciationMethod.OTHER,
            asset_account=acc_211,
            accumulated_account=acc_214,
            created_by=user_actor,
        )

        # Asset 3: Disposed on 2026-08-20 (AF06)
        a3 = models.AssetRecord.objects.create(
            company=self.company,
            branch=self.branch,
            category=default_cat,
            department=dept_tech,
            code="TS09-003",
            name="Máy in laser HP LaserJet Pro",
            asset_type=models.AssetType.FIXED_ASSET,
            status=models.AssetStatus.DISPOSED,
            acquisition_date=date(2026, 1, 15),
            in_service_date=date(2026, 1, 15),
            disposed_at=date(2026, 8, 20),
            acquisition_voucher_no="GTTS09003",
            original_cost=Decimal("30000000.00"),
            depreciable_amount=Decimal("30000000.00"),
            accumulated_depreciation=Decimal("10000000.00"),
            useful_life_periods=36,
            method=models.DepreciationMethod.STRAIGHT_LINE,
            asset_account=acc_211,
            accumulated_account=acc_214,
            created_by=user_actor,
        )
        models.AssetTransaction.objects.create(
            company=self.company,
            asset=a3,
            transaction_type="DISPOSAL",
            number="GGTS09001",
            transaction_date=date(2026, 8, 20),
            amount=Decimal("20000000.00"),
            status="POSTED",
            before_snapshot={
                "original_cost": "30000000.00",
                "accumulated_depreciation": "10000000.00",
                "remaining_value": "20000000.00",
            },
            reason="Nhượng bán, thanh lý",
            created_by=user_actor,
        )

        return {
            "dept_tech": dept_tech,
            "dept_admin": dept_admin,
            "dept_sales": dept_sales,
            "cat_vehicle": cat_vehicle,
            "a1": a1,
            "a2": a2,
            "a3": a3,
        }

    def test_uc_fa_09_main_flow_a_asset_register_as_of_date_filters_pagination_and_export(self):
        ctx = self._setup_uc09_assets_and_movements()
        url = f"/api/v1/fixed-assets/assets/register/{self.query}"

        # 1. View register as of 2026-10-15 (default include_disposed=False):
        # Should include a1 (150M / 10M / 140M at dept_admin) and a2 (600M / 50M / 550M at dept_sales).
        # a3 was disposed on 2026-08-20 so excluded when include_disposed=False.
        resp_oct = self.client.get(f"{url}&as_of_date=15/10/2026&export_excel=true")
        self.assertEqual(resp_oct.status_code, 200, resp_oct.data)
        data_oct = resp_oct.data
        self.assertEqual(data_oct["summary"]["asset_count"], 2)
        self.assertEqual(data_oct["summary"]["total_original_cost"], "750000000.00")
        self.assertEqual(data_oct["summary"]["total_accumulated_depreciation"], "60000000.00")
        self.assertEqual(data_oct["summary"]["total_remaining_value"], "690000000.00")
        self.assertFalse(data_oct["is_empty"])
        self.assertIn("export_data", data_oct)
        self.assertEqual(len(data_oct["export_data"]["rows"]), 2)

        row_a1 = next(r for r in data_oct["items"] if r["code"] == "TS09-001")
        row_a2 = next(r for r in data_oct["items"] if r["code"] == "TS09-002")
        self.assertEqual(row_a1["department_name"], "Phòng Hành chính - Nhân sự")
        self.assertEqual(row_a1["depreciation_rate_display"], "20.00%")
        self.assertEqual(row_a1["asset_account_code"], "211")
        # Step 14: Non-fixed-rate method displays rule ("Theo sản lượng") without fabricating a fixed rate
        self.assertEqual(row_a2["depreciation_rate_display"], "Theo sản lượng")
        self.assertIsNone(row_a2["annual_depreciation_rate"])

        # 2. AF05: View register at past date 2026-05-01 (BEFORE transfer on 2026-06-15, BEFORE revaluation on 2026-09-01, BEFORE disposal of a3 on 2026-08-20):
        # At 2026-05-01:
        # - a1 was at dept_tech ("Phòng Kỹ thuật"), original_cost=120M, accum=10M, rem=110M!
        # - a2 was active (original_cost=600M, accum=50M, rem=550M)
        # - a3 was STILL ACTIVE on 2026-05-01 (disposed on 2026-08-20), original_cost=30M, accum=10M, rem=20M!
        resp_may = self.client.get(f"{url}&as_of_date=01/05/2026")
        self.assertEqual(resp_may.status_code, 200)
        self.assertEqual(resp_may.data["summary"]["asset_count"], 3)
        self.assertEqual(resp_may.data["summary"]["total_original_cost"], "750000000.00")
        self.assertEqual(resp_may.data["summary"]["total_accumulated_depreciation"], "70000000.00")
        self.assertEqual(resp_may.data["summary"]["total_remaining_value"], "680000000.00")

        a1_may = next(r for r in resp_may.data["items"] if r["code"] == "TS09-001")
        self.assertEqual(a1_may["department_name"], ctx["dept_tech"].name)
        self.assertEqual(a1_may["original_cost"], "120000000.00")
        self.assertEqual(a1_may["accumulated_depreciation"], "10000000.00")
        self.assertEqual(a1_may["remaining_value"], "110000000.00")

        # 3. AF06: View register at 2026-10-15 WITH include_disposed=true -> a3 included with disposal info
        resp_inc_disp = self.client.get(f"{url}&as_of_date=15/10/2026&include_disposed=true")
        self.assertEqual(resp_inc_disp.status_code, 200)
        self.assertEqual(resp_inc_disp.data["summary"]["asset_count"], 3)
        a3_disp = next(r for r in resp_inc_disp.data["items"] if r["code"] == "TS09-003")
        self.assertTrue(a3_disp["is_disposed_at_date"])
        self.assertEqual(a3_disp["status_display"], "Đã ghi giảm")
        self.assertEqual(a3_disp["disposal_voucher_no"], "GGTS09001")

        # 4. AF07: Pagination with page_size=1 -> items has 1 row, but summary STILL reflects all 2 filtered assets
        resp_page = self.client.get(f"{url}&as_of_date=15/10/2026&page=1&page_size=1")
        self.assertEqual(resp_page.status_code, 200)
        self.assertEqual(len(resp_page.data["items"]), 1)
        self.assertEqual(resp_page.data["pagination"]["total_items"], 2)
        self.assertEqual(resp_page.data["pagination"]["total_pages"], 2)
        self.assertEqual(resp_page.data["summary"]["asset_count"], 2)
        self.assertEqual(resp_page.data["summary"]["total_original_cost"], "750000000.00")

        # 5. AF03 & AF04: Filter by department and case-insensitive search
        resp_filter = self.client.get(
            f"{url}&as_of_date=15/10/2026&department_name=Phòng Kinh doanh&search=isuzu"
        )
        self.assertEqual(resp_filter.status_code, 200)
        self.assertEqual(resp_filter.data["summary"]["asset_count"], 1)
        self.assertEqual(resp_filter.data["items"][0]["code"], "TS09-002")

        # 6. AF08: No matching assets -> exact message and zero totals
        resp_empty = self.client.get(f"{url}&search=KHONG-TON-TAI-99999")
        self.assertEqual(resp_empty.status_code, 200)
        self.assertTrue(resp_empty.data["is_empty"])
        self.assertEqual(
            resp_empty.data["empty_message"],
            "Không có tài sản cố định phù hợp với điều kiện tìm kiếm.",
        )
        self.assertEqual(resp_empty.data["summary"]["asset_count"], 0)
        self.assertEqual(resp_empty.data["summary"]["total_original_cost"], "0.00")
        self.assertEqual(resp_empty.data["summary"]["total_accumulated_depreciation"], "0.00")
        self.assertEqual(resp_empty.data["summary"]["total_remaining_value"], "0.00")

    def test_uc_fa_09_main_flow_b_all_six_reports_and_alternative_flows(self):
        ctx = self._setup_uc09_assets_and_movements()
        catalog_url = f"/api/v1/fixed-assets/assets/report-catalog/{self.query}"
        reports_url = f"/api/v1/fixed-assets/assets/reports/{self.query}"

        # 1. Steps 2–4, AF10, AF12, AF13, AF14: Report catalog, AVA search, language switch, and hide/show reports
        cat_resp = self.client.get(f"{catalog_url}&ava_query=đối chiếu sổ cái")
        self.assertEqual(cat_resp.status_code, 200)
        self.assertEqual(len(cat_resp.data["groups"]), 2)
        self.assertEqual(len(cat_resp.data["groups"][0]["reports"]), 4)
        self.assertEqual(len(cat_resp.data["groups"][1]["reports"]), 2)
        self.assertTrue(any(s["code"] == "RECONCILE_FA_GL" for s in cat_resp.data["ava_suggestions"]))

        # AF14: Hide S21_DN report for current user -> hidden from default list, preserved when include_hidden=true
        hide_resp = self.client.post(
            catalog_url,
            {"company": str(self.company.id), "hidden_report_codes": ["S21_DN"]},
            format="json",
        )
        self.assertEqual(hide_resp.status_code, 200)
        self.assertEqual(len(hide_resp.data["groups"][0]["reports"]), 3)
        # Restore visibility
        self.client.post(
            catalog_url,
            {"company": str(self.company.id), "hidden_report_codes": []},
            format="json",
        )

        # 2. Report 1: S21_DN (`S21 - DN: Sổ tài sản cố định` – AF15)
        r_s21 = self.client.post(
            reports_url,
            {
                "company": str(self.company.id),
                "report_code": "S21_DN",
                "from_date": "01/01/2026",
                "to_date": "31/12/2026",
            },
            format="json",
        )
        self.assertEqual(r_s21.status_code, 200, r_s21.data)
        self.assertEqual(r_s21.data["report_code"], "S21_DN")
        self.assertEqual(len(r_s21.data["rows"]), 3)
        self.assertEqual(r_s21.data["totals"]["original_cost"], "780000000.00")
        self.assertEqual(r_s21.data["totals"]["depreciation_in_period"], "10000000.00")
        self.assertNotIn("depreciation_rate_display", r_s21.data["totals"])

        # 3. Report 2: ASSET_REGISTER (`Sổ tài sản cố định`) with exclude_disposed_in_period=True (Step 10)
        r_reg = self.client.post(
            reports_url,
            {
                "company": str(self.company.id),
                "report_code": "ASSET_REGISTER",
                "from_date": "01/01/2026",
                "to_date": "31/12/2026",
                "exclude_disposed_in_period": True,
                "lang": "en",
            },
            format="json",
        )
        self.assertEqual(r_reg.status_code, 200)
        self.assertEqual(r_reg.data["lang"], "en")
        self.assertEqual(r_reg.data["title"], "Fixed Asset Register")
        self.assertEqual(len(r_reg.data["rows"]), 2)
        self.assertEqual(r_reg.data["totals"]["closing_original_cost"], "750000000.00")

        # 4. Report 3: ASSET_CARD (`Thẻ tài sản cố định` – AF16) for TS09-001
        r_card = self.client.post(
            reports_url,
            {
                "company": str(self.company.id),
                "report_code": "ASSET_CARD",
                "asset_code": "TS09-001",
                "from_date": "01/01/2026",
                "to_date": "31/12/2026",
            },
            format="json",
        )
        self.assertEqual(r_card.status_code, 200)
        cards = r_card.data["extra_sections"]["cards"]
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["code"], "TS09-001")
        self.assertEqual(len(cards[0]["components"]), 1)
        self.assertEqual(len(cards[0]["accessories"]), 1)
        self.assertGreaterEqual(len(cards[0]["history_rows"]), 4)

        # 5. Report 4: ANNUAL_DEPRECIATION_SCHEDULE (`Bảng tính khấu hao tài sản cố định theo năm`)
        r_sched = self.client.post(
            reports_url,
            {
                "company": str(self.company.id),
                "report_code": "ANNUAL_DEPRECIATION_SCHEDULE",
                "year": 2026,
            },
            format="json",
        )
        self.assertEqual(r_sched.status_code, 200)
        a1_sched = next(r for r in r_sched.data["rows"] if r["code"] == "TS09-001")
        self.assertEqual(a1_sched["month_3"], "10000000.00")
        self.assertEqual(a1_sched["total_year_depreciation"], "10000000.00")

        # 6. Report 5: RECONCILE_FA_GL (`Báo cáo đối chiếu sổ tài sản và sổ cái` – Step 14)
        r_gl = self.client.post(
            reports_url,
            {
                "company": str(self.company.id),
                "report_code": "RECONCILE_FA_GL",
                "from_date": "01/01/2026",
                "to_date": "31/12/2026",
                "only_differences": True,
            },
            format="json",
        )
        self.assertEqual(r_gl.status_code, 200)
        self.assertTrue(len(r_gl.data["rows"]) >= 1)
        acc_211 = next(r for r in r_gl.data["rows"] if r["account_code"] == "211")
        self.assertEqual(acc_211["fa_closing_balance"], "750000000.00")
        self.assertTrue(acc_211["has_difference"])

        # 7. Report 6: RECONCILE_STOCKTAKE_FA (`Báo cáo đối chiếu kết quả kiểm kê với sổ tài sản` – Step 15)
        # Create a stocktake voucher first
        st_create = self.client.post(
            f"/api/v1/fixed-assets/counts/{self.query}",
            {
                "company": str(self.company.id),
                "voucher_no": "KKTS09001",
                "count_date": "15/10/2026",
                "allow_planned_future_count": True,
                "purpose": "Kiểm kê định kỳ quý 4/2026",
                "conclusion": "Phát hiện 1 tài sản sai đơn vị sử dụng.",
                "lines": [
                    {
                        "asset": str(ctx["a1"].id),
                        "existence_status": "EXISTS",
                        "actual_department_name": "Phòng Hành chính - Nhân sự",
                        "condition": "Bình thường",
                    },
                    {
                        "asset": str(ctx["a2"].id),
                        "existence_status": "EXISTS",
                        "actual_department_name": "Phòng Kỹ thuật",
                        "condition": "Bình thường",
                        "recommendation": "Lập chứng từ điều chuyển",
                    },
                ],
            },
            format="json",
        )
        self.assertIn(st_create.status_code, (200, 201), st_create.data)
        r_st = self.client.post(
            reports_url,
            {
                "company": str(self.company.id),
                "report_code": "RECONCILE_STOCKTAKE_FA",
                "from_date": "01/10/2026",
                "to_date": "31/10/2026",
                "only_differences": True,
            },
            format="json",
        )
        self.assertEqual(r_st.status_code, 200)
        self.assertEqual(len(r_st.data["rows"]), 1)
        self.assertEqual(r_st.data["rows"][0]["asset_code"], "TS09-002")
        self.assertEqual(r_st.data["rows"][0]["discrepancy_type"], "DEPT_MISMATCH")

    def test_uc_fa_09_exception_flows_and_validations(self):
        self._setup_uc09_assets_and_movements()
        reg_url = f"/api/v1/fixed-assets/assets/register/{self.query}"
        rep_url = f"/api/v1/fixed-assets/assets/reports/{self.query}"

        # 1. Invalid as_of_date on register
        bad_date = self.client.get(f"{reg_url}&as_of_date=31/02/2026")
        self.assertEqual(bad_date.status_code, 400)
        self.assertEqual(
            str(bad_date.data["as_of_date"]),
            "Ngày xem số liệu không hợp lệ. Vui lòng nhập theo định dạng DD/MM/YYYY.",
        )

        # 2. Step 7: from_date > to_date on report
        bad_range = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "ASSET_REGISTER",
                "from_date": "31/12/2026",
                "to_date": "01/01/2026",
            },
            format="json",
        )
        self.assertEqual(bad_range.status_code, 400)
        self.assertEqual(str(bad_range.data["from_date"]), "Từ ngày không được lớn hơn Đến ngày.")

        # 3. Invalid report_code
        bad_code = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "INVALID_REPORT_999",
            },
            format="json",
        )
        self.assertEqual(bad_code.status_code, 400)
        self.assertEqual(str(bad_code.data["report_code"]), "Loại báo cáo không hợp lệ.")

        # 4. Non-existent asset_code on ASSET_CARD
        bad_asset = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "ASSET_CARD",
                "asset_code": "KHONG-TON-TAI",
            },
            format="json",
        )
        self.assertEqual(bad_asset.status_code, 400)
        self.assertEqual(str(bad_asset.data["asset_code"]), "Không tìm thấy tài sản cố định được chọn.")

        # 5. Unauthorized user without FA.ASSET.VIEW permission
        no_perm_user = get_user_model().objects.create_user(username="no-view-09", email="noview09@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        unauth_reg = self.client.get(reg_url)
        self.assertEqual(unauth_reg.status_code, 403)
        self.assertEqual(str(unauth_reg.data["detail"]), "Bạn không có quyền xem sổ hoặc báo cáo tài sản cố định.")


    # ==========================================================================
    # UC-FA-10: GHI TĂNG CCDC / CHI PHÍ TRẢ TRƯỚC
    # ==========================================================================

    def _setup_uc10_accounts_and_departments(self):
        from general_ledger.models import Account
        from organization.models import Department

        for acc_code, acc_name, acc_type in [
            ("153", "Công cụ, dụng cụ", "ASSET"),
            ("242", "Chi phí trả trước", "ASSET"),
            ("6273", "Chi phí dụng cụ sản xuất", "EXPENSE"),
            ("6422", "Chi phí vật liệu quản lý", "EXPENSE"),
        ]:
            Account.objects.get_or_create(
                company=self.company,
                code=acc_code,
                defaults={
                    "chart_of_accounts": self.coa,
                    "name": acc_name,
                    "account_type": acc_type,
                    "normal_balance": "DEBIT",
                    "is_postable": True,
                    "status": "ACTIVE",
                },
            )

        dept_tech, _ = Department.objects.get_or_create(
            company=self.company,
            code="PKT-UC10",
            defaults={"branch": self.branch, "name": "Phòng Kỹ thuật", "status": "ACTIVE"},
        )
        dept_prod, _ = Department.objects.get_or_create(
            company=self.company,
            code="BPSX-UC10",
            defaults={"branch": self.branch, "name": "Bộ phận Sản xuất", "status": "ACTIVE"},
        )
        dept_admin, _ = Department.objects.get_or_create(
            company=self.company,
            code="PQL-UC10",
            defaults={"branch": self.branch, "name": "Bộ phận Quản lý", "status": "ACTIVE"},
        )
        return {
            "dept_tech": dept_tech,
            "dept_prod": dept_prod,
            "dept_admin": dept_admin,
        }

    def test_uc_fa_10_main_flow_a_example_4_9_tool_acquisition_and_gl_posting(self):
        """
        UC-FA-10 Main Flow A (Steps 1–41) & Section 4.9 Example 1:
        - Mã CCDC: CCDC010 – Bộ dụng cụ sửa chữa
        - Số lượng: 10 bộ, Đơn giá: 1,200,000 VND -> Thành tiền: 12,000,000 VND
        - Số kỳ phân bổ: 12 tháng, TK chờ phân bổ: 242
        - Đơn vị sử dụng: Phòng Kỹ thuật (4) + Bộ phận Sản xuất (6) = 10
        - Thiết lập phân bổ: Phòng Kỹ thuật (40% -> 400,000 VND/tháng) + Bộ phận Sản xuất (60% -> 600,000 VND/tháng) = 1,000,000 VND/tháng
        - Chứng từ xuất kho chưa hạch toán chuyển giá trị (source_gl_posted=False): Nợ 242 / Có 153: 12,000,000 VND
        - Không tự hạch toán chi phí phân bổ của 12 tháng tương lai khi ghi tăng (BR39).
        """
        from general_ledger.models import JournalEntry
        ctx = self._setup_uc10_accounts_and_departments()

        url = f"/api/v1/fixed-assets/assets/acquire-tool/{self.query}"
        resp = self.client.post(
            url,
            {
                "company": str(self.company.id),
                "voucher_no": "GTCC00001",
                "acquisition_date": "15/09/2026",
                "start_allocation_date": "15/09/2026",
                "code": "CCDC010",
                "name": "Bộ dụng cụ sửa chữa",
                "category": "Dụng cụ chuyên dùng",
                "group": "Thiết bị sửa chữa",
                "reason": "Xuất kho CCDC cho Phòng Kỹ thuật và Bộ phận Sản xuất",
                "unit": "Bộ",
                "quantity": "10",
                "unit_price": "1200000",
                "original_cost": "12000000",
                "useful_life_periods": 12,
                "waiting_account": "242",
                "source_type": "STOCK_ISSUE",
                "source_voucher_no": "XK-UC10-001",
                "source_total_quantity": "10",
                "source_gl_posted": False,
                "credit_account": "153",
                "department_allocations": [
                    {"code": ctx["dept_tech"].code, "name": ctx["dept_tech"].name, "quantity": "4"},
                    {"code": ctx["dept_prod"].code, "name": ctx["dept_prod"].name, "quantity": "6"},
                ],
                "allocations": [
                    {
                        "target_code": ctx["dept_tech"].code,
                        "target_name": ctx["dept_tech"].name,
                        "rate": "40",
                        "expense_account": "6273",
                        "cost_item": "CP-SC",
                        "stats_code": "TK-01",
                    },
                    {
                        "target_code": ctx["dept_prod"].code,
                        "target_name": ctx["dept_prod"].name,
                        "rate": "60",
                        "expense_account": "6273",
                        "cost_item": "CP-SX",
                        "stats_code": "TK-02",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        data = resp.data
        self.assertEqual(data["message"], "Ghi tăng công cụ dụng cụ thành công.")
        self.assertEqual(data["code"], "CCDC010")
        self.assertEqual(Decimal(data["original_cost"]), Decimal("12000000.00"))
        self.assertEqual(Decimal(data["periodic_allocation_amount"]), Decimal("1000000.00"))
        self.assertEqual(Decimal(data["allocations"][0]["periodic_amount"]), Decimal("400000.00"))
        self.assertEqual(Decimal(data["allocations"][1]["periodic_amount"]), Decimal("600000.00"))
        self.assertEqual(data["physical_status_display"], "Đang sử dụng")
        self.assertEqual(data["allocation_status_display"], "Đang phân bổ")

        # Verify GL Entry Nợ 242 / Có 153: 12,000,000 VND
        self.assertEqual(data["gl_posting_mode"], "POSTED_ON_ACQUISITION")
        self.assertEqual(len(data["gl_entries"]), 1)
        self.assertEqual(data["gl_entries"][0]["debit_account"], "242")
        self.assertEqual(data["gl_entries"][0]["credit_account"], "153")
        self.assertEqual(Decimal(data["gl_entries"][0]["amount"]), Decimal("12000000.00"))
        gl_entry = JournalEntry.objects.get(company=self.company, number=data["gl_journal_number"])
        self.assertEqual(gl_entry.status, "POSTED")

        # Verify 12-month schedule is PLANNED and not prematurely posted (BR39)
        self.assertEqual(len(data["allocation_schedule"]), 12)
        self.assertTrue(all(s["status"] == "PLANNED" and s["gl_posted"] is False for s in data["allocation_schedule"]))

        # Audit Log check (Step 40, BR44)
        self.assertTrue(
            AuditLog.objects.filter(company=self.company, entity_id=data["asset_id"], action_code="ACQUIRE_TOOL").exists()
        )

    def test_uc_fa_10_af01_batch_tools_and_af03_af11_fa_disposal_to_tool_conversion(self):
        """
        UC-FA-10 AF03 (Chuyển TSCĐ thành CCDC), AF11 (Ghi tăng CCDC đã khấu hao hết từ TSCĐ với GTCL = 0),
        AF23 (Chứng từ nguồn đã hạch toán), and AF01 (Ghi tăng CCDC hàng loạt với thiết lập riêng từng dòng BR42).
        """
        ctx = self._setup_uc10_accounts_and_departments()

        # Create & dispose a Fixed Asset with reason "Chuyển TSCĐ thành CCDC" (remaining value = 0 per AF11)
        acq_fa = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire/{self.query}",
            self._base_uc_fa_01_payload(
                voucher_no="GT-FA10-01",
                code="TSCD-TO-CCDC",
                name="Máy in văn phòng chuyển sang CCDC",
                acquisition_date="01/01/2024",
                in_service_date="01/01/2024",
                start_depreciation_date="01/01/2024",
                original_cost="36000000.00",
                depreciable_amount="36000000.00",
                useful_life_value="36",
                useful_life_unit="Tháng",
                monthly_depreciation_amount="1000000.00",
                annual_depreciation_amount="12000000.00",
                origins=[],
            ),
            format="json",
        )
        self.assertEqual(acq_fa.status_code, 201, acq_fa.data)
        fa_id = acq_fa.data["asset"]["id"]
        models.AssetRecord.objects.filter(pk=fa_id).update(
            accumulated_depreciation=Decimal("36000000.00"),
            periods_processed=36,
        )

        disp_fa = self.client.post(
            f"/api/v1/fixed-assets/transactions/dispose/{self.query}",
            {
                "voucher_no": "GGTS-UC10-01",
                "reason": "Chuyển TSCĐ thành CCDC",
                "posting_date": "10/09/2026",
                "voucher_date": "10/09/2026",
                "rows": [
                    {
                        "asset_id": fa_id,
                        "asset_code": "TSCD-TO-CCDC",
                        "asset_account": "2112",
                        "accumulated_account": "2141",
                        "disposal_account": "242",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(disp_fa.status_code, 201, disp_fa.data)

        # Check tool-source-vouchers returns the disposed FA
        src_resp = self.client.get(f"/api/v1/fixed-assets/assets/tool-source-vouchers/{self.query}")
        self.assertEqual(src_resp.status_code, 200, src_resp.data)
        self.assertTrue(
            any(v["voucher_no"] == "GGTS-UC10-01" and v["is_fully_depreciated_fa"] for v in src_resp.data["fa_disposal_vouchers"])
        )

        # Convert fully depreciated FA to CCDC (AF03 & AF11)
        conv_resp = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire-tool/{self.query}",
            {
                "company": str(self.company.id),
                "voucher_no": "GTCC00002",
                "acquisition_date": "12/09/2026",
                "code": "CCDC-FROM-FA",
                "name": "Máy in văn phòng chuyển sang CCDC",
                "source_type": "FA_DISPOSAL",
                "source_voucher_no": "GGTS-UC10-01",
                "quantity": "1",
                "unit_price": "0",
                "original_cost": "0",
                "useful_life_periods": 0,
                "waiting_account": "242",
                "department_allocations": [{"code": ctx["dept_admin"].code, "quantity": "1"}],
                "allocations": [],
            },
            format="json",
        )
        self.assertEqual(conv_resp.status_code, 201, conv_resp.data)
        self.assertEqual(conv_resp.data["physical_status_display"], "Đang sử dụng")
        self.assertEqual(conv_resp.data["allocation_status_display"], "Đã phân bổ hết")
        self.assertEqual(conv_resp.data["allocation_schedule"], [])

        # AF01: Batch tool acquisition with independent per-item department and allocation settings (BR42)
        batch_resp = self.client.post(
            f"/api/v1/fixed-assets/assets/acquire-tools-batch/{self.query}",
            {
                "company": str(self.company.id),
                "items": [
                    {
                        "voucher_no": "GTCC00003",
                        "acquisition_date": "20/09/2026",
                        "code": "CCDC-B01",
                        "name": "Bàn làm việc nhân viên",
                        "quantity": "2",
                        "unit_price": "2500000",
                        "original_cost": "5000000",
                        "useful_life_periods": 10,
                        "waiting_account": "242",
                        "department_allocations": [{"code": ctx["dept_tech"].code, "quantity": "2"}],
                        "allocations": [{"target_code": ctx["dept_tech"].code, "rate": "100", "expense_account": "6422"}],
                    },
                    {
                        "voucher_no": "GTCC00004",
                        "acquisition_date": "20/09/2026",
                        "code": "CCDC-B02",
                        "name": "Tủ hồ sơ sắt Hòa Phát",
                        "quantity": "3",
                        "unit_price": "3000000",
                        "original_cost": "9000000",
                        "useful_life_periods": 9,
                        "waiting_account": "242",
                        "department_allocations": [{"code": ctx["dept_prod"].code, "quantity": "3"}],
                        "allocations": [{"target_code": ctx["dept_prod"].code, "rate": "100", "expense_account": "6273"}],
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(batch_resp.status_code, 201, batch_resp.data)
        self.assertEqual(batch_resp.data["count"], 2)
        self.assertEqual(Decimal(batch_resp.data["items"][0]["periodic_allocation_amount"]), Decimal("500000.00"))
        self.assertEqual(Decimal(batch_resp.data["items"][1]["periodic_allocation_amount"]), Decimal("1000000.00"))

    def test_uc_fa_10_main_flow_b_example_4_10_and_af02_example_4_11_prepaid_expenses(self):
        """
        UC-FA-10 Main Flow B (Steps 1–34) & Section 4.10 Example 2:
        - Mã CPTT: CPTT010 – Chi phí thuê văn phòng 12 tháng
        - Số tiền: 120,000,000 VND, Số kỳ: 12 tháng, TK chờ phân bổ: 242
        - Số tiền đã phân bổ = 0, Số tiền còn lại = 120,000,000 VND, PB hàng tháng = 10,000,000 VND
        And AF02 (Steps 1–13) & Section 4.11 Example 3:
        - Chi phí trả trước đầu kỳ: Tổng số tiền = 60,000,000 VND, Tổng số kỳ = 12 tháng,
          Số kỳ đã phân bổ = 4 tháng, Số tiền đã phân bổ = 20,000,000 VND,
          Số kỳ còn lại = 8 tháng, Số tiền còn lại = 40,000,000 VND -> PB mỗi tháng còn lại = 5,000,000 VND.
        """
        ctx = self._setup_uc10_accounts_and_departments()
        url = f"/api/v1/fixed-assets/assets/prepaid-expenses/{self.query}"

        # 1. Main Flow B – Example 4.10 + AF20 (Multiple source documents)
        resp_new = self.client.post(
            url,
            {
                "company": str(self.company.id),
                "code": "CPTT010",
                "name": "Chi phí thuê văn phòng 12 tháng",
                "record_date": "01/09/2026",
                "start_date": "01/09/2026",
                "amount": "120000000",
                "allocation_periods": 12,
                "waiting_account": "242",
                "targets": [
                    {
                        "target_code": ctx["dept_admin"].code,
                        "target_name": ctx["dept_admin"].name,
                        "rate": "100",
                        "expense_account": "6422",
                        "cost_item": "CP-THUE-VP",
                        "stats_code": "VP-2026",
                    }
                ],
                "source_documents": [
                    {"voucher_no": "HD-THUE-01", "voucher_date": "01/09/2026", "amount": "60000000"},
                    {"voucher_no": "HD-THUE-02", "voucher_date": "01/09/2026", "amount": "60000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp_new.status_code, 201, resp_new.data)
        d_new = resp_new.data
        self.assertEqual(d_new["message"], "Đã lưu chi phí trả trước thành công.")
        self.assertEqual(Decimal(d_new["allocated_amount"]), Decimal("0.00"))
        self.assertEqual(Decimal(d_new["remaining_amount"]), Decimal("120000000.00"))
        self.assertEqual(Decimal(d_new["periodic_allocation_amount"]), Decimal("10000000.00"))
        self.assertEqual(len(d_new["allocation_schedule"]), 12)
        self.assertEqual(len(d_new["source_documents"]), 2)

        # 2. AF02 – Example 4.11: Opening Prepaid Expense
        resp_open = self.client.post(
            url,
            {
                "company": str(self.company.id),
                "is_opening": True,
                "code": "CPTT011",
                "name": "Bảo hiểm tài sản nhà máy đầu kỳ",
                "record_date": "01/01/2026",
                "start_date": "01/01/2026",
                "amount": "60000000",
                "allocation_periods": 12,
                "remaining_periods": 8,
                "opening_allocated_amount": "20000000",
                "remaining_amount": "40000000",
                "gl_opening_balance": "40000000",
                "waiting_account": "242",
                "targets": [
                    {
                        "target_code": ctx["dept_prod"].code,
                        "target_name": ctx["dept_prod"].name,
                        "rate": "100",
                        "expense_account": "6273",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp_open.status_code, 201, resp_open.data)
        d_open = resp_open.data
        self.assertEqual(d_open["message"], "Đã lưu chi phí trả trước đầu kỳ thành công.")
        self.assertEqual(d_open["opening_allocated_periods"], 4)
        self.assertEqual(d_open["remaining_periods"], 8)
        self.assertEqual(Decimal(d_open["allocated_amount"]), Decimal("20000000.00"))
        self.assertEqual(Decimal(d_open["remaining_amount"]), Decimal("40000000.00"))
        self.assertEqual(Decimal(d_open["periodic_allocation_amount"]), Decimal("5000000.00"))
        self.assertEqual(len(d_open["allocation_schedule"]), 8)
        self.assertEqual(d_open["allocation_schedule"][0]["period_no"], 5)

        # 3. AF22: Opening Prepaid Expense with remaining_periods = 0 (already fully allocated)
        resp_af22 = self.client.post(
            url,
            {
                "company": str(self.company.id),
                "is_opening": True,
                "code": "CPTT012",
                "name": "Chi phí trả trước lịch sử đã phân bổ hết",
                "record_date": "01/01/2026",
                "amount": "24000000",
                "allocation_periods": 12,
                "remaining_periods": 0,
                "opening_allocated_amount": "24000000",
                "remaining_amount": "0",
                "waiting_account": "242",
                "targets": [{"target_code": ctx["dept_admin"].code, "rate": "100", "expense_account": "6422"}],
            },
            format="json",
        )
        self.assertEqual(resp_af22.status_code, 201, resp_af22.data)
        self.assertEqual(resp_af22.data["status_display"], "Đã phân bổ hết")
        self.assertEqual(resp_af22.data["allocation_schedule"], [])

        # 4. AF25: View Tool & Prepaid Register
        reg_resp = self.client.get(f"/api/v1/fixed-assets/assets/tool-register/{self.query}")
        self.assertEqual(reg_resp.status_code, 200, reg_resp.data)
        self.assertTrue(any(p["code"] == "CPTT010" for p in reg_resp.data["prepaid_expenses"]))
        self.assertTrue(any(p["code"] == "CPTT011" for p in reg_resp.data["prepaid_expenses"]))

    def test_uc_fa_10_af18_import_prepaid_excel_and_ef38(self):
        """
        UC-FA-10 AF18 (Nhập từ Excel) & EF38 (Lỗi định dạng tệp, thiếu cột bắt buộc, lỗi dữ liệu theo dòng và cột).
        """
        ctx = self._setup_uc10_accounts_and_departments()
        import_url = f"/api/v1/fixed-assets/assets/prepaid-expenses/import-excel/{self.query}"

        # EF38a: Wrong file extension
        bad_ext = self.client.post(
            import_url,
            {"company": str(self.company.id), "filename": "invalid.pdf", "rows": []},
            format="json",
        )
        self.assertEqual(bad_ext.status_code, 400)
        self.assertIn("Excel", str(bad_ext.data["filename"]))

        # EF38b: Missing required columns
        bad_cols = self.client.post(
            import_url,
            {
                "company": str(self.company.id),
                "filename": "Mau_CPTT.xlsx",
                "columns": ["code", "name"],
                "rows": [],
            },
            format="json",
        )
        self.assertEqual(bad_cols.status_code, 400)
        self.assertIn("missing_columns", bad_cols.data)

        # AF18 & EF38c: Mixed valid and invalid rows -> creates valid rows and reports row/column errors for invalid rows
        mixed = self.client.post(
            import_url,
            {
                "company": str(self.company.id),
                "filename": "Mau_Chi_Phi_Tra_Truoc.xlsx",
                "sheet": "Sheet1",
                "header_row": 1,
                "rows": [
                    {
                        "code": "CPTT-EX01",
                        "name": "Chi phí bảo trì phần mềm",
                        "amount": "18000000",
                        "allocation_periods": 6,
                        "record_date": "01/09/2026",
                        "start_date": "01/09/2026",
                        "waiting_account": "242",
                        "target_code": ctx["dept_admin"].code,
                        "rate": "100",
                        "expense_account": "6422",
                    },
                    {
                        "code": "CPTT-EX02",
                        "name": "",  # Invalid: empty name (EF22)
                        "amount": "12000000",
                        "allocation_periods": 6,
                        "record_date": "01/09/2026",
                        "start_date": "01/09/2026",
                        "waiting_account": "242",
                        "target_code": ctx["dept_admin"].code,
                        "rate": "100",
                        "expense_account": "6422",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(mixed.status_code, 201, mixed.data)
        self.assertEqual(mixed.data["success_count"], 1)
        self.assertEqual(mixed.data["error_count"], 1)
        self.assertEqual(mixed.data["row_errors"][0]["row"], 2)
        self.assertEqual(mixed.data["row_errors"][0]["column"], "name")
        self.assertEqual(mixed.data["row_errors"][0]["message"], "Vui lòng nhập tên chi phí trả trước.")

    def test_uc_fa_10_all_exception_flows_ef01_to_ef37(self):
        """
        UC-FA-10 Exception Flows EF01 through EF37 with exact Vietnamese error messages.
        """
        from organization.models import Company, Department
        ctx = self._setup_uc10_accounts_and_departments()
        tool_url = f"/api/v1/fixed-assets/assets/acquire-tool/{self.query}"
        batch_url = f"/api/v1/fixed-assets/assets/acquire-tools-batch/{self.query}"
        prepaid_url = f"/api/v1/fixed-assets/assets/prepaid-expenses/{self.query}"

        base_tool = {
            "company": str(self.company.id),
            "voucher_no": "GTCC-BASE",
            "acquisition_date": "15/09/2026",
            "code": "CCDC-BASE",
            "name": "Máy khoan cầm tay",
            "quantity": "5",
            "unit_price": "1000000",
            "original_cost": "5000000",
            "useful_life_periods": 5,
            "waiting_account": "242",
            "department_allocations": [{"code": ctx["dept_tech"].code, "quantity": "5"}],
            "allocations": [{"target_code": ctx["dept_tech"].code, "rate": "100", "expense_account": "6273"}],
        }

        base_prepaid = {
            "company": str(self.company.id),
            "code": "CPTT-BASE",
            "name": "Chi phí thuê máy chủ",
            "record_date": "15/09/2026",
            "start_date": "15/09/2026",
            "amount": "24000000",
            "allocation_periods": 12,
            "waiting_account": "242",
            "targets": [{"target_code": ctx["dept_admin"].code, "rate": "100", "expense_account": "6422"}],
        }

        # EF02: Invalid / empty voucher_no
        ef02 = self.client.post(tool_url, {**base_tool, "voucher_no": ""}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["voucher_no"]), "Số chứng từ ghi tăng không hợp lệ hoặc đã tồn tại.")

        # EF03: Invalid acquisition_date
        ef03 = self.client.post(tool_url, {**base_tool, "acquisition_date": "31/02/2026"}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["acquisition_date"]), "Vui lòng nhập ngày ghi tăng hợp lệ theo định dạng DD/MM/YYYY.")

        # EF04: Closed period
        ef04 = self.client.post(tool_url, {**base_tool, "period_closed": True}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["acquisition_date"]), "Không thể ghi tăng CCDC trong kỳ kế toán đã khóa.")

        # EF05: Empty / duplicate tool code
        ef05 = self.client.post(tool_url, {**base_tool, "code": ""}, format="json")
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["code"]), "Mã CCDC không hợp lệ hoặc đã tồn tại.")

        # EF06: Empty tool name
        ef06 = self.client.post(tool_url, {**base_tool, "name": "   "}, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["name"]), "Vui lòng nhập tên công cụ dụng cụ.")

        # EF07: Quantity <= 0
        ef07 = self.client.post(tool_url, {**base_tool, "quantity": "0"}, format="json")
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["quantity"]), "Số lượng CCDC phải lớn hơn 0.")

        # EF08: Quantity exceeds remaining source quantity
        ef08 = self.client.post(
            tool_url,
            {**base_tool, "quantity": "6", "source_remaining_quantity": "4"},
            format="json",
        )
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["quantity"]), "Số lượng ghi tăng vượt số lượng còn lại của chứng từ nguồn.")

        # EF09: Negative / mismatched value
        ef09 = self.client.post(
            tool_url,
            {**base_tool, "unit_price": "1000000", "original_cost": "9000000"},
            format="json",
        )
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["original_cost"]), "Giá trị công cụ dụng cụ không hợp lệ.")

        # EF10: Non-positive integer useful_life_periods
        ef10 = self.client.post(tool_url, {**base_tool, "useful_life_periods": 0}, format="json")
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["useful_life_periods"]), "Số kỳ phân bổ phải là số nguyên lớn hơn 0.")

        # EF11: Invalid waiting_account
        ef11 = self.client.post(tool_url, {**base_tool, "waiting_account": "111"}, format="json")
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["waiting_account"]), "Tài khoản chờ phân bổ không hợp lệ.")

        # EF12: Missing department_allocations
        ef12 = self.client.post(tool_url, {**base_tool, "department_allocations": []}, format="json")
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["department_allocations"]), "Vui lòng khai báo đơn vị sử dụng CCDC.")

        # EF13: Sum of department quantities != acquired quantity
        ef13 = self.client.post(
            tool_url,
            {**base_tool, "department_allocations": [{"code": ctx["dept_tech"].code, "quantity": "3"}]},
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["department_allocations"]), "Tổng số lượng tại các đơn vị sử dụng phải bằng số lượng ghi tăng.")

        # EF14: Duplicate department in department_allocations
        ef14 = self.client.post(
            tool_url,
            {
                **base_tool,
                "department_allocations": [
                    {"code": ctx["dept_tech"].code, "quantity": "2"},
                    {"code": ctx["dept_tech"].code, "quantity": "3"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(
            str(ef14.data["department_allocations"]),
            "Đơn vị sử dụng đã tồn tại trong danh sách. Vui lòng kiểm tra lại.",
        )

        # EF15: Invalid / cancelled source voucher
        ef15 = self.client.post(
            tool_url,
            {**base_tool, "source_voucher_no": "XK-CANCELLED", "source_status": "CANCELLED"},
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(
            str(ef15.data["source_voucher_no"]),
            "Chứng từ nguồn không hợp lệ hoặc không còn được phép sử dụng.",
        )

        # EF16: Source voucher already fully acquired
        ef16 = self.client.post(
            tool_url,
            {**base_tool, "source_voucher_no": "XK-USED", "source_remaining_quantity": "0"},
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(
            str(ef16.data["source_voucher_no"]),
            "CCDC từ chứng từ nguồn đã được ghi tăng. Vui lòng kiểm tra lại.",
        )

        # EF17: FA disposal voucher not eligible for conversion to CCDC
        ef17 = self.client.post(
            tool_url,
            {
                **base_tool,
                "source_type": "FA_DISPOSAL",
                "source_voucher_no": "GGTS-SALE",
                "disposal_reason": "Nhượng bán, thanh lý",
            },
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(
            str(ef17.data["source_voucher_no"]),
            "Chứng từ ghi giảm TSCĐ không đủ điều kiện chuyển thành CCDC.",
        )

        # EF18: Missing cost allocation targets
        ef18 = self.client.post(tool_url, {**base_tool, "allocations": []}, format="json")
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(str(ef18.data["allocations"]), "Vui lòng khai báo đối tượng nhận chi phí phân bổ.")

        # EF19: Total allocation rate != 100%
        ef19 = self.client.post(
            tool_url,
            {
                **base_tool,
                "allocations": [{"target_code": ctx["dept_tech"].code, "rate": "80", "expense_account": "6273"}],
            },
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(str(ef19.data["allocations"]), "Tổng tỷ lệ phân bổ phải bằng 100%.")

        # EF20: Invalid expense account
        ef20 = self.client.post(
            tool_url,
            {
                **base_tool,
                "allocations": [{"target_code": ctx["dept_tech"].code, "rate": "100", "expense_account": "111"}],
            },
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(str(ef20.data["expense_account"]), "Tài khoản chi phí phân bổ không hợp lệ.")

        # EF21: Prepaid expense empty / duplicate code
        ef21 = self.client.post(prepaid_url, {**base_prepaid, "code": ""}, format="json")
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(str(ef21.data["code"]), "Mã chi phí trả trước không hợp lệ hoặc đã tồn tại.")

        # EF22: Prepaid expense empty name
        ef22 = self.client.post(prepaid_url, {**base_prepaid, "name": ""}, format="json")
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(str(ef22.data["name"]), "Vui lòng nhập tên chi phí trả trước.")

        # EF23: Prepaid expense invalid allocation_periods
        ef23 = self.client.post(prepaid_url, {**base_prepaid, "allocation_periods": -2}, format="json")
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(str(ef23.data["useful_life_periods"]), "Số kỳ phân bổ phải là số nguyên lớn hơn 0.")

        # EF24: Invalid record_date / start_date
        ef24 = self.client.post(prepaid_url, {**base_prepaid, "record_date": "99/99/2026"}, format="json")
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(str(ef24.data["record_date"]), "Vui lòng kiểm tra ngày ghi nhận và ngày bắt đầu phân bổ.")

        # EF25: Prepaid expense amount <= 0
        ef25 = self.client.post(prepaid_url, {**base_prepaid, "amount": "0"}, format="json")
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(str(ef25.data["amount"]), "Số tiền chi phí trả trước phải lớn hơn 0.")

        # EF26: Not eligible for multi-period allocation / source not posted to 242
        ef26 = self.client.post(prepaid_url, {**base_prepaid, "eligible_multi_period": False}, format="json")
        self.assertEqual(ef26.status_code, 400)
        self.assertEqual(
            str(ef26.data["source_documents"]),
            "Khoản chi phí chưa đủ điều kiện theo dõi phân bổ. Vui lòng kiểm tra chứng từ nguồn.",
        )

        # EF27: Source document total does not match prepaid expense amount
        ef27 = self.client.post(
            prepaid_url,
            {
                **base_prepaid,
                "source_documents": [{"voucher_no": "HD-99", "amount": "15000000"}],
            },
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(
            str(ef27.data["source_documents"]),
            "Số tiền chi phí trả trước không khớp với chứng từ nguồn.",
        )

        # EF28: Source document already tracked in another prepaid expense
        ef28 = self.client.post(
            prepaid_url,
            {
                **base_prepaid,
                "source_documents": [{"voucher_no": "HD-DUP", "amount": "24000000", "already_tracked": True}],
            },
            format="json",
        )
        self.assertEqual(ef28.status_code, 400)
        self.assertEqual(
            str(ef28.data["source_documents"]),
            "Khoản chi phí đã được theo dõi phân bổ. Vui lòng kiểm tra lại.",
        )

        # EF29: Opening prepaid expense remaining_periods > allocation_periods
        ef29 = self.client.post(
            prepaid_url,
            {**base_prepaid, "is_opening": True, "allocation_periods": 12, "remaining_periods": 15},
            format="json",
        )
        self.assertEqual(ef29.status_code, 400)
        self.assertEqual(str(ef29.data["remaining_periods"]), "Số kỳ phân bổ còn lại không hợp lệ.")

        # EF30: Opening prepaid expense opening_allocated_amount > amount
        ef30 = self.client.post(
            prepaid_url,
            {
                **base_prepaid,
                "is_opening": True,
                "allocation_periods": 12,
                "remaining_periods": 6,
                "opening_allocated_amount": "30000000",
            },
            format="json",
        )
        self.assertEqual(ef30.status_code, 400)
        self.assertEqual(str(ef30.data["opening_allocated_amount"]), "Số tiền đã phân bổ không hợp lệ.")

        # EF31: Opening prepaid expense remaining_amount != amount - opening_allocated_amount
        ef31 = self.client.post(
            prepaid_url,
            {
                **base_prepaid,
                "is_opening": True,
                "allocation_periods": 12,
                "remaining_periods": 6,
                "opening_allocated_amount": "12000000",
                "remaining_amount": "15000000",
            },
            format="json",
        )
        self.assertEqual(ef31.status_code, 400)
        self.assertEqual(str(ef31.data["remaining_amount"]), "Số tiền phân bổ còn lại không khớp với số liệu đầu kỳ.")

        # EF32: Opening prepaid expense GL balance not reconciled
        ef32 = self.client.post(
            prepaid_url,
            {
                **base_prepaid,
                "is_opening": True,
                "allocation_periods": 12,
                "remaining_periods": 6,
                "opening_allocated_amount": "12000000",
                "remaining_amount": "12000000",
                "gl_opening_balance_reconciled": False,
            },
            format="json",
        )
        self.assertEqual(ef32.status_code, 400)
        self.assertEqual(str(ef32.data["gl_opening_balance"]), "Số dư chi phí trả trước đầu kỳ chưa được đối chiếu hợp lệ.")

        # EF33: Batch CCDC missing required fields
        ef33 = self.client.post(
            batch_url,
            {"company": str(self.company.id), "items": [{"code": "", "name": "Thiếu mã"}]},
            format="json",
        )
        self.assertEqual(ef33.status_code, 400)
        self.assertEqual(str(ef33.data["items"]), "Vui lòng hoàn thiện thông tin tại các dòng CCDC được đánh dấu.")

        # EF34: Batch CCDC duplicate code or voucher_no within batch
        ef34 = self.client.post(
            batch_url,
            {
                "company": str(self.company.id),
                "items": [
                    {**base_tool, "code": "CCDC-DUP", "voucher_no": "GTCC-D1"},
                    {**base_tool, "code": "CCDC-DUP", "voucher_no": "GTCC-D2"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef34.status_code, 400)
        self.assertEqual(str(ef34.data["items"]), "Phát hiện mã CCDC hoặc số chứng từ bị trùng trong danh sách.")

        # EF35: Simulated system / DB failure
        ef35 = self.client.post(tool_url, {**base_tool, "simulate_save_error": True}, format="json")
        self.assertEqual(ef35.status_code, 400)
        self.assertEqual(str(ef35.data["detail"]), "Ghi tăng thất bại. Vui lòng thử lại.")

        # EF36: Idempotency / duplicate submission control
        ok_idem = self.client.post(tool_url, {**base_tool, "idempotency_key": "UC10-IDEM-1"}, format="json")
        self.assertEqual(ok_idem.status_code, 201, ok_idem.data)
        replay_idem = self.client.post(tool_url, {**base_tool, "idempotency_key": "UC10-IDEM-1"}, format="json")
        self.assertEqual(replay_idem.status_code, 200)
        self.assertTrue(replay_idem.data.get("idempotent_replayed"))

        # EF37: Cross-company / out-of-scope department
        other_co = Company.objects.create(
            code="OTHER-UC10",
            name="Công ty Khác UC10",
            legal_name="Công ty Khác UC10",
            tax_code="0109998877",
            accounting_currency=self.company.accounting_currency,
            legal_reporting_currency=self.company.legal_reporting_currency,
        )
        other_branch = Branch.objects.create(company=other_co, code="HQ-OTHER", name="Chi nhánh Khác")
        other_dept = Department.objects.create(company=other_co, branch=other_branch, code="DEPT-OTHER", name="Phòng Khác", status="ACTIVE")
        ef37 = self.client.post(
            tool_url,
            {
                **base_tool,
                "voucher_no": "GTCC-EF37",
                "code": "CCDC-EF37",
                "department_allocations": [{"department_id": str(other_dept.id), "quantity": "5"}],
            },
            format="json",
        )
        self.assertEqual(ef37.status_code, 403)
        self.assertEqual(str(ef37.data["detail"]), "Bạn không có quyền sử dụng dữ liệu này.")

        # EF01: User without permission
        no_perm_user = get_user_model().objects.create_user(username="no-uc10-perm", email="nouc10@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(tool_url, {**base_tool, "voucher_no": "GTCC-EF01", "code": "CCDC-EF01"}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền thực hiện nghiệp vụ này.")

    # ==========================================================================
    # UC-FA-11: THIẾT LẬP KỲ PHÂN BỔ (CCDC & CHI PHÍ TRẢ TRƯỚC)
    # ==========================================================================

    def test_uc11_main_flows_a_and_b_leap_year_and_zero_mutation(self):
        """
        UC-FA-11 Main Flow A (CCDC) & Main Flow B (Chi phí trả trước), Section 4.1–4.6, BR06–BR33:
        - Default working period suggestion (BR06, BR07)
        - Section 4.6 worked example: Month 9, Year 2026 -> 01/09/2026..30/09/2026,
          Posting date = Voucher date = 30/09/2026,
          Voucher no = PBCC00001 (CCDC) / PBCP00001 (CPTT),
          Description = "Phân bổ chi phí CCDC tháng 9 năm 2026" / "Phân bổ chi phí trả trước tháng 9 năm 2026"
        - Leap year dates (Section 4.2–4.3): Feb 2028 -> 29/02/2028, Feb 2026 -> 28/02/2026, Feb 2100 -> 28/02/2100
        - 3 tabs prepared (identify_rows, allocation_rows, accounting_rows), default_tab = "identify"
        - Zero DB mutation on period setup confirmation (BR29–BR31, AF18)
        """
        # 1. Acquire a CCDC and a Prepaid Expense starting in 09/2026
        self._setup_uc10_accounts_and_departments()
        acq_tool = self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "source_type": "MANUAL",
                "voucher_no": "GTCC00001",
                "acquisition_date": "2026-09-01",
                "group": "Thiết bị văn phòng",
                "code": "CCDC-UC11-01",
                "name": "Máy in laser Canon LBP2900",
                "unit": "Cái",
                "quantity": "2",
                "unit_price": "6000000",
                "original_cost": "12000000",
                "useful_life_periods": 12,
                "waiting_account": "242",
                "department_allocations": [
                    {"department_code": "PKT-UC10", "department_name": "Phòng Kỹ thuật", "quantity": "2"},
                ],
                "allocations": [
                    {
                        "target_code": "PKT-UC10",
                        "target_name": "Phòng Kỹ thuật",
                        "rate": "60",
                        "expense_account": "6422",
                        "expense_item": "Chi phí CCDC văn phòng",
                    },
                    {
                        "target_code": "PQL-UC10",
                        "target_name": "Bộ phận Quản lý",
                        "rate": "40",
                        "expense_account": "6422",
                        "expense_item": "Chi phí CCDC quản lý",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(acq_tool.status_code, 201, acq_tool.data)

        acq_prepaid = self.client.post(
            "/api/v1/fixed-assets/assets/prepaid-expenses/",
            {
                "company": str(self.company.id),
                "mode": "NEW",
                "code": "CPTT-UC11-01",
                "name": "Chi phí thuê văn phòng Quý 3-4/2026",
                "record_date": "2026-09-01",
                "start_date": "2026-09-01",
                "amount": "24000000",
                "allocation_periods": 6,
                "waiting_account": "242",
                "allocations": [
                    {
                        "target_code": "PKT-UC10",
                        "target_name": "Phòng Kỹ thuật",
                        "rate": "100",
                        "expense_account": "6422",
                        "expense_item": "Chi phí thuê văn phòng",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(acq_prepaid.status_code, 201, acq_prepaid.data)

        # 2. Check Default Period Suggestion (Step 4, BR06, BR07)
        def_resp = self.client.get(
            f"/api/v1/fixed-assets/calculations/default-allocation-period/?company_id={self.company.id}&allocation_type=TOOL"
        )
        self.assertEqual(def_resp.status_code, 200, def_resp.data)
        self.assertEqual(def_resp.data["dialog_title"], "Chọn kỳ phân bổ chi phí CCDC")
        self.assertEqual(def_resp.data["months"], list(range(1, 13)))

        # 3. Main Flow A: Setup CCDC Allocation Period for Month 9, Year 2026 (Section 4.6)
        setup_tool = self.client.post(
            "/api/v1/fixed-assets/calculations/setup-allocation-period/",
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 9,
                "year": 2026,
            },
            format="json",
        )
        self.assertEqual(setup_tool.status_code, 200, setup_tool.data)
        d_tool = setup_tool.data
        self.assertEqual(d_tool["allocation_type"], "TOOL")
        self.assertEqual(d_tool["voucher_no"], "PBCC00001")
        self.assertEqual(d_tool["form_title"], "Phân bổ chi phí CCDC PBCC00001")
        self.assertEqual(d_tool["period_start"], "01/09/2026")
        self.assertEqual(d_tool["period_end"], "30/09/2026")
        self.assertEqual(d_tool["posting_date"], "30/09/2026")
        self.assertEqual(d_tool["voucher_date"], "30/09/2026")
        self.assertEqual(d_tool["description"], "Phân bổ chi phí CCDC tháng 9 năm 2026")
        self.assertEqual(d_tool["default_tab"], "identify")
        self.assertEqual(d_tool["tabs"], ["identify", "allocation", "accounting"])
        self.assertTrue(d_tool["can_save"])
        self.assertFalse(d_tool["gl_posted"])
        self.assertFalse(d_tool["state_mutated"])
        self.assertEqual(Decimal(d_tool["total_amount"]), Decimal("1000000.00"))
        self.assertEqual(len(d_tool["identify_rows"]), 1)
        self.assertEqual(len(d_tool["allocation_rows"]), 2)
        self.assertEqual(len(d_tool["accounting_rows"]), 2)
        self.assertEqual(Decimal(d_tool["allocation_rows"][0]["period_allocation_amount"]), Decimal("600000.00"))
        self.assertEqual(Decimal(d_tool["allocation_rows"][1]["period_allocation_amount"]), Decimal("400000.00"))

        # Verify zero DB mutation after setup_allocation_period (BR29–BR31)
        tool_rec = AssetRecord.objects.get(company=self.company, code="CCDC-UC11-01")
        self.assertEqual(tool_rec.allocated_value, Decimal("0"))
        self.assertEqual(tool_rec.periods_processed, 0)

        # 4. Main Flow B: Setup Prepaid Expense Allocation Period for Month 9, Year 2026 (Section 4.6)
        setup_prepaid = self.client.post(
            "/api/v1/fixed-assets/calculations/setup-allocation-period/",
            {
                "company": str(self.company.id),
                "allocation_type": "PREPAID",
                "month": 9,
                "year": 2026,
            },
            format="json",
        )
        self.assertEqual(setup_prepaid.status_code, 200, setup_prepaid.data)
        d_prep = setup_prepaid.data
        self.assertEqual(d_prep["allocation_type"], "PREPAID")
        self.assertEqual(d_prep["voucher_no"], "PBCP00001")
        self.assertEqual(d_prep["form_title"], "Phân bổ chi phí trả trước PBCP00001")
        self.assertEqual(d_prep["period_start"], "01/09/2026")
        self.assertEqual(d_prep["period_end"], "30/09/2026")
        self.assertEqual(d_prep["posting_date"], "30/09/2026")
        self.assertEqual(d_prep["voucher_date"], "30/09/2026")
        self.assertEqual(d_prep["description"], "Phân bổ chi phí trả trước tháng 9 năm 2026")
        self.assertEqual(d_prep["default_tab"], "identify")
        self.assertEqual(Decimal(d_prep["total_amount"]), Decimal("4000000.00"))
        self.assertEqual(Decimal(d_prep["identify_rows"][0]["opening_remaining_amount"]), Decimal("24000000.00"))
        self.assertEqual(Decimal(d_prep["identify_rows"][0]["period_allocation_amount"]), Decimal("4000000.00"))

        # 5. Leap year calculation (Section 4.2 & 4.3): Feb 2028 (leap), Feb 2026 (non-leap), Feb 2100 (century non-leap)
        feb_2028 = self.client.post(
            "/api/v1/fixed-assets/calculations/setup-allocation-period/",
            {"company": str(self.company.id), "allocation_type": "TOOL", "month": 2, "year": 2028},
            format="json",
        )
        self.assertEqual(feb_2028.status_code, 200)
        self.assertTrue(feb_2028.data["is_leap_year"])
        self.assertEqual(feb_2028.data["days_in_month"], 29)
        self.assertEqual(feb_2028.data["period_end"], "29/02/2028")
        self.assertEqual(feb_2028.data["posting_date"], "29/02/2028")

        feb_2026 = self.client.post(
            "/api/v1/fixed-assets/calculations/setup-allocation-period/",
            {"company": str(self.company.id), "allocation_type": "TOOL", "month": 2, "year": 2026},
            format="json",
        )
        self.assertEqual(feb_2026.status_code, 200)
        self.assertFalse(feb_2026.data["is_leap_year"])
        self.assertEqual(feb_2026.data["days_in_month"], 28)
        self.assertEqual(feb_2026.data["period_end"], "28/02/2026")

        feb_2100 = self.client.post(
            "/api/v1/fixed-assets/calculations/setup-allocation-period/",
            {"company": str(self.company.id), "allocation_type": "TOOL", "month": 2, "year": 2100},
            format="json",
        )
        self.assertEqual(feb_2100.status_code, 200)
        self.assertFalse(feb_2100.data["is_leap_year"])
        self.assertEqual(feb_2100.data["days_in_month"], 28)
        self.assertEqual(feb_2100.data["period_end"], "28/02/2100")

    def test_uc11_alternative_flows_af04_to_af17(self):
        """
        UC-FA-11 Alternative Flows:
        - AF04: AI-assisted preparation (`ai_assisted=True`)
        - AF08 & AF09: Past open period (`PAST`) & Future period (`FUTURE`, `DRAFT_ONLY`)
        - AF10: Partial allocation in period (`DA_PHAN_BO_MOT_PHAN`) excludes already-allocated amount (BR22)
        - AF11: Empty eligible items in period -> returns `can_save=False` and `"Không có khoản chi phí cần phân bổ trong kỳ đã chọn."` (BR34)
        - AF12: Excludes fully allocated items (`opening_remaining_amount == 0`, BR18)
        - AF13: Excludes suspended (`stop_allocation=True`, BR19) and disposed before period (`DISPOSED`, BR20)
        - AF14: Uses post-adjustment values (`adjusted_total_amount`, BR21)
        - AF17: Re-validates header fields (`posting_date`, `voucher_date`, `voucher_no`, `description`) via `validate-allocation-voucher`
        """
        url = "/api/v1/fixed-assets/calculations/setup-allocation-period/"
        self._setup_uc10_accounts_and_departments()

        # AF11: Before any item exists in 05/2026 -> returns 200 with empty rows, can_save=False, and exact message
        af11_resp = self.client.post(
            url,
            {"company": str(self.company.id), "allocation_type": "TOOL", "month": 5, "year": 2026},
            format="json",
        )
        self.assertEqual(af11_resp.status_code, 200, af11_resp.data)
        self.assertEqual(af11_resp.data["identify_rows"], [])
        self.assertFalse(af11_resp.data["can_save"])
        self.assertEqual(af11_resp.data["empty_period_warning"], "Không có khoản chi phí cần phân bổ trong kỳ đã chọn.")
        self.assertEqual(af11_resp.data["message"], "Không có khoản chi phí cần phân bổ trong kỳ đã chọn.")

        # Create a CCDC in 09/2026 with partial allocation, adjusted value, suspended item, and fully allocated item
        self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "source_type": "MANUAL",
                "voucher_no": "GTCC-AF10",
                "acquisition_date": "2026-09-01",
                "group": "Thiết bị văn phòng",
                "code": "CCDC-AF10",
                "name": "CCDC phân bổ một phần & điều chỉnh",
                "unit": "Cái",
                "quantity": "1",
                "unit_price": "12000000",
                "original_cost": "12000000",
                "useful_life_periods": 10,
                "waiting_account": "242",
                "department_allocations": [{"department_code": "PKT-UC10", "department_name": "Phòng Kỹ thuật", "quantity": "1"}],
                "allocations": [{"target_code": "PKT-UC10", "target_name": "Phòng Kỹ thuật", "rate": "100", "expense_account": "6422"}],
            },
            format="json",
        )
        tool_af10 = AssetRecord.objects.get(company=self.company, code="CCDC-AF10")
        meta = tool_af10.accessories[0]
        # AF14: Adjusted total amount = 15,000,000 (10 periods -> 1,500,000/month)
        # AF10: Already allocated 500,000 in 2026-09 -> remaining in period = 1,000,000
        meta["adjusted_total_amount"] = "15000000"
        meta["period_allocations"] = {"2026-09": "500000"}
        tool_af10.accessories = [meta]
        tool_af10.save(update_fields=["accessories"])

        # AF12: Fully allocated item
        self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "source_type": "MANUAL",
                "voucher_no": "GTCC-AF12",
                "acquisition_date": "2026-01-01",
                "group": "Thiết bị văn phòng",
                "code": "CCDC-AF12",
                "name": "CCDC đã phân bổ hết",
                "unit": "Cái",
                "quantity": "1",
                "unit_price": "6000000",
                "original_cost": "6000000",
                "useful_life_periods": 6,
                "waiting_account": "242",
                "department_allocations": [{"department_code": "PKT-UC10", "department_name": "Phòng Kỹ thuật", "quantity": "1"}],
                "allocations": [{"target_code": "PKT-UC10", "target_name": "Phòng Kỹ thuật", "rate": "100", "expense_account": "6422"}],
            },
            format="json",
        )
        AssetRecord.objects.filter(company=self.company, code="CCDC-AF12").update(
            allocated_value=Decimal("6000000"), periods_processed=6
        )

        # AF13: Suspended item (stop_allocation=True)
        self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "source_type": "MANUAL",
                "voucher_no": "GTCC-AF13",
                "acquisition_date": "2026-09-01",
                "group": "Thiết bị văn phòng",
                "code": "CCDC-AF13",
                "name": "CCDC ngừng phân bổ",
                "unit": "Cái",
                "quantity": "1",
                "unit_price": "6000000",
                "original_cost": "6000000",
                "useful_life_periods": 6,
                "waiting_account": "242",
                "stop_allocation": True,
                "department_allocations": [{"department_code": "PKT-UC10", "department_name": "Phòng Kỹ thuật", "quantity": "1"}],
                "allocations": [{"target_code": "PKT-UC10", "target_name": "Phòng Kỹ thuật", "rate": "100", "expense_account": "6422"}],
            },
            format="json",
        )

        # Call setup-allocation-period with AI-assisted=True (AF04) and future_period_policy=DRAFT_ONLY (AF09)
        resp = self.client.post(
            url,
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 9,
                "year": 2026,
                "working_month": 8,
                "working_year": 2026,
                "future_period_policy": "DRAFT_ONLY",
                "ai_assisted": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["ai_assisted"])
        self.assertIn("Sổ Việt AI", resp.data["ai_summary"])
        self.assertEqual(resp.data["period_nature"], "FUTURE")
        self.assertFalse(resp.data["can_post_immediately"])
        # Only CCDC-AF10 is included (AF12 & AF13 excluded)
        self.assertEqual(len(resp.data["identify_rows"]), 1)
        row = resp.data["identify_rows"][0]
        self.assertEqual(row["code"], "CCDC-AF10")
        self.assertEqual(row["period_allocation_status"], "DA_PHAN_BO_MOT_PHAN")
        # Post-adjustment 15,000,000 / 10 = 1,500,000 minus 500,000 already allocated = 1,000,000
        self.assertEqual(Decimal(row["total_allocation_amount"]), Decimal("1000000.00"))

        # AF17: Re-validate edited header fields before save
        val_resp = self.client.post(
            "/api/v1/fixed-assets/calculations/validate-allocation-voucher/",
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 9,
                "year": 2026,
                "posting_date": "25/09/2026",
                "voucher_date": "25/09/2026",
                "voucher_no": "PBCC00099",
                "description": "Phân bổ CCDC đợt 2 tháng 9/2026",
            },
            format="json",
        )
        self.assertEqual(val_resp.status_code, 200, val_resp.data)
        self.assertTrue(val_resp.data["valid"])
        self.assertEqual(val_resp.data["posting_date"], "25/09/2026")
        self.assertEqual(val_resp.data["voucher_no"], "PBCC00099")

    def test_uc11_exceptions_ef01_to_ef19(self):
        """
        UC-FA-11 Exception Flows EF01 through EF19 with exact Vietnamese error messages.
        """
        url = "/api/v1/fixed-assets/calculations/setup-allocation-period/"
        val_url = "/api/v1/fixed-assets/calculations/validate-allocation-voucher/"
        self._setup_uc10_accounts_and_departments()

        # Seed 1 valid CCDC in 09/2026
        self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "source_type": "MANUAL",
                "voucher_no": "GTCC-EF",
                "acquisition_date": "2026-09-01",
                "group": "Thiết bị văn phòng",
                "code": "CCDC-EF01",
                "name": "Máy tính xách tay Dell",
                "unit": "Cái",
                "quantity": "1",
                "unit_price": "12000000",
                "original_cost": "12000000",
                "useful_life_periods": 12,
                "waiting_account": "242",
                "department_allocations": [{"department_code": "PKT-UC10", "department_name": "Phòng Kỹ thuật", "quantity": "1"}],
                "allocations": [{"target_code": "PKT-UC10", "target_name": "Phòng Kỹ thuật", "rate": "100", "expense_account": "6422"}],
            },
            format="json",
        )

        # EF02: Tháng phân bổ bị bỏ trống
        ef02 = self.client.post(url, {"company": str(self.company.id), "month": "", "year": 2026}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["detail"]), "Vui lòng chọn tháng phân bổ.")

        # EF03: Tháng phân bổ ngoài khoảng 1–12 hoặc không phải số nguyên
        for bad_month in (0, 13, -2, "abc", "2.5"):
            ef03 = self.client.post(url, {"company": str(self.company.id), "month": bad_month, "year": 2026}, format="json")
            self.assertEqual(ef03.status_code, 400)
            self.assertEqual(str(ef03.data["detail"]), "Tháng phân bổ phải có giá trị từ 1 đến 12.")

        # EF04: Năm phân bổ bị bỏ trống
        ef04 = self.client.post(url, {"company": str(self.company.id), "month": 9, "year": ""}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["detail"]), "Vui lòng nhập năm phân bổ.")

        # EF05: Năm phân bổ sai định dạng hoặc không hợp lệ
        for bad_year in (0, -2026, 1800, 2200, "202a", "2026.5"):
            ef05 = self.client.post(url, {"company": str(self.company.id), "month": 9, "year": bad_year}, format="json")
            self.assertEqual(ef05.status_code, 400)
            self.assertEqual(str(ef05.data["detail"]), "Năm phân bổ không hợp lệ.")

        # EF06: Năm hoặc kỳ nằm ngoài phạm vi dữ liệu của doanh nghiệp
        ef06 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2024, "company_start_year": 2025},
            format="json",
        )
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["detail"]), "Kỳ phân bổ không thuộc phạm vi dữ liệu kế toán của doanh nghiệp.")

        # EF07: Kỳ kế toán đã khóa sổ
        from datetime import date
        from fixed_assets.models import AssetPeriod
        AssetPeriod.objects.create(
            company=self.company,
            code="2026-08",
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 31),
            status="CLOSED",
        )
        ef07 = self.client.post(url, {"company": str(self.company.id), "month": 8, "year": 2026}, format="json")
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["detail"]), "Kỳ kế toán đã khóa, không thể lập chứng từ phân bổ trong kỳ này.")

        # EF08: Chưa thiết lập niên độ kế toán hoặc kỳ kế toán tương ứng
        ef08 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2029, "require_fiscal_year_setup": True},
            format="json",
        )
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["detail"]), "Chưa có thiết lập niên độ kế toán cho kỳ phân bổ đã chọn.")

        # EF09: Lỗi truy xuất dữ liệu nguồn khi xác nhận kỳ
        ef09 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "simulate_source_load_error": True},
            format="json",
        )
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["detail"]), "Không thể tải dữ liệu phân bổ. Vui lòng thử lại.")

        # EF10: Dữ liệu phân bổ của đối tượng không đầy đủ
        ef10 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "simulate_incomplete_setup": True},
            format="json",
        )
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["detail"]), "Thiết lập phân bổ của đối tượng chưa đầy đủ. Vui lòng kiểm tra hồ sơ.")

        # EF11: Giá trị còn lại hoặc số tiền phân bổ kỳ không hợp lệ
        ef11 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "simulate_invalid_numbers": True},
            format="json",
        )
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["detail"]), "Số liệu phân bổ không hợp lệ. Vui lòng kiểm tra lịch sử phân bổ.")

        # EF13: Mâu thuẫn với chứng từ điều chỉnh hoặc ghi giảm trong kỳ
        ef13 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "simulate_schedule_mismatch": True},
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["detail"]), "Lịch phân bổ chưa khớp với chứng từ điều chỉnh hoặc ghi giảm.")

        # EF14: Lỗi sinh số chứng từ đề xuất
        ef14 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "simulate_numbering_error": True},
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(str(ef14.data["detail"]), "Không thể đề xuất số chứng từ phân bổ. Vui lòng thử lại.")

        # EF15: Không mở được form chứng từ sau khi chọn kỳ
        ef15 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "simulate_form_open_error": True},
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(str(ef15.data["detail"]), "Không thể mở chứng từ phân bổ. Vui lòng thử lại.")

        # EF16: Người dùng nhấn Đồng ý nhiều lần liên tiếp (Idempotency)
        first_click = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "idempotency_key": "UC11-CLICK-1"},
            format="json",
        )
        self.assertEqual(first_click.status_code, 200)
        self.assertFalse(first_click.data["idempotent_replayed"])
        second_click = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "idempotency_key": "UC11-CLICK-1"},
            format="json",
        )
        self.assertEqual(second_click.status_code, 200)
        self.assertTrue(second_click.data["idempotent_replayed"])
        self.assertEqual(first_click.data["voucher_no"], second_click.data["voucher_no"])

        # EF12: Khoản chi phí đã được phân bổ đủ trong kỳ đã chọn
        tool_ef = AssetRecord.objects.get(company=self.company, code="CCDC-EF01")
        meta = tool_ef.accessories[0]
        meta["period_allocations"] = {"2026-09": "1000000"}
        tool_ef.accessories = [meta]
        tool_ef.save(update_fields=["accessories"])
        ef12 = self.client.post(url, {"company": str(self.company.id), "month": 9, "year": 2026}, format="json")
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["detail"]), "Khoản chi phí đã được phân bổ trong kỳ đã chọn.")
        # Restore period_allocations for subsequent checks
        meta["period_allocations"] = {}
        tool_ef.accessories = [meta]
        tool_ef.save(update_fields=["accessories"])

        # EF18: Dữ liệu nguồn thay đổi sau khi mở form
        ef18 = self.client.post(
            val_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "source_data_stale": True},
            format="json",
        )
        self.assertEqual(ef18.status_code, 400)
        self.assertIn("Dữ liệu phân bổ đã thay đổi", str(ef18.data["detail"]))

        # EF19: Trùng số chứng từ khi lưu
        ef19 = self.client.post(
            val_url,
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 9,
                "year": 2026,
                "voucher_no": "GTCC-EF",  # Already exists in AssetTransaction
            },
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(
            str(ef19.data["detail"]),
            "Số chứng từ đã tồn tại. Vui lòng chọn số khác hoặc sử dụng số được đề xuất mới.",
        )
        self.assertTrue(ef19.data.get("suggested_voucher_no"))

        # EF17: Lỗi phân quyền theo đơn vị / chi nhánh / sổ dữ liệu
        ef17 = self.client.post(
            url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "has_scope_permission": False},
            format="json",
        )
        self.assertEqual(ef17.status_code, 403)
        self.assertEqual(str(ef17.data["detail"]), "Bạn không có quyền thực hiện phân bổ cho dữ liệu này.")

        # EF01: Người dùng không có quyền lập chứng từ phân bổ
        no_perm_user = get_user_model().objects.create_user(username="no-uc11-perm", email="nouc11@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(url, {"company": str(self.company.id), "month": 9, "year": 2026}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền lập chứng từ phân bổ chi phí.")

    # ==========================================================================
    # UC-FA-12 – TÍNH VÀ GHI NHẬN PHÂN BỔ (CCDC & CHI PHÍ TRẢ TRƯỚC)
    # ==========================================================================

    def test_uc_fa_12_main_flow_a_tool_allocation_and_example_4_5(self):
        """
        UC-FA-12 Main Flow A (Steps 1–29) & Example 4.5:
        - CCDC00001 – Máy tính xách tay, Giá trị phân bổ = 24.000.000, Số kỳ = 12,
          Đã phân bổ trước kỳ = 4.000.000 (2 kỳ), Giá trị còn lại đầu kỳ = 20.000.000, Số kỳ còn lại = 10.
        - Phân bổ kỳ này = 2.000.000: Phòng Kế toán 60% (TK 6422 -> 1.200.000), Phòng Kinh doanh 40% (TK 6412 -> 800.000).
        - Kiểm tra 3 tab, bút toán GL Nợ 6422/6412 - Có 242, cập nhật allocated_value = 6.000.000, remaining_value = 18.000.000.
        """
        from general_ledger.models import Account, JournalEntry
        self._setup_uc10_accounts_and_departments()

        acc_6422, _ = Account.objects.get_or_create(
            company=self.company,
            code="6422",
            defaults={
                "chart_of_accounts": self.coa,
                "account_class": self.accounts[0].account_class,
                "name": "Chi phí quản lý doanh nghiệp - CCDC",
                "account_type": "EXPENSE",
                "normal_balance": "DEBIT",
                "is_postable": True,
            },
        )
        acc_6412, _ = Account.objects.get_or_create(
            company=self.company,
            code="6412",
            defaults={
                "chart_of_accounts": self.coa,
                "account_class": self.accounts[0].account_class,
                "name": "Chi phí bán hàng - CCDC",
                "account_type": "EXPENSE",
                "normal_balance": "DEBIT",
                "is_postable": True,
            },
        )

        acq_res = self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "code": "CCDC00001",
                "name": "Máy tính xách tay",
                "voucher_no": "GTCC-UC12-01",
                "acquisition_date": "01/07/2026",
                "start_allocation_date": "01/07/2026",
                "quantity": 2,
                "unit_price": "12000000",
                "original_cost": "24000000",
                "useful_life_periods": 12,
                "waiting_account": "242",
                "department_allocations": [{"department_code": self.department.code, "quantity": 2}],
                "allocations": [
                    {"target_code": "PKT", "target_name": "Phòng Kế toán", "rate": "60", "expense_account": acc_6422.code},
                    {"target_code": "PKD", "target_name": "Phòng Kinh doanh", "rate": "40", "expense_account": acc_6412.code},
                ],
            },
            format="json",
        )
        self.assertEqual(acq_res.status_code, 201, acq_res.data)
        tool = AssetRecord.objects.get(company=self.company, code="CCDC00001")
        tool.allocated_value = Decimal("4000000.00")
        tool.periods_processed = 2
        tool.save(update_fields=["allocated_value", "periods_processed"])

        # Step 1–13: Calculate allocation for 09/2026
        calc_res = self.client.post(
            "/api/v1/fixed-assets/assets/calculate-allocation/",
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 9,
                "year": 2026,
                "item_ids": [str(tool.id)],
            },
            format="json",
        )
        self.assertEqual(calc_res.status_code, 200, calc_res.data)
        self.assertEqual(calc_res.data["total_amount"], "2000000.00")
        self.assertEqual(len(calc_res.data["identify_rows"]), 1)
        self.assertEqual(calc_res.data["identify_rows"][0]["opening_remaining_amount"], "20000000.00")
        self.assertEqual(calc_res.data["identify_rows"][0]["total_allocation_amount"], "2000000.00")
        self.assertEqual(calc_res.data["identify_rows"][0]["closing_remaining_amount"], "18000000.00")
        self.assertEqual(len(calc_res.data["allocation_rows"]), 2)
        self.assertEqual(calc_res.data["allocation_rows"][0]["period_allocation_amount"], "1200000.00")
        self.assertEqual(calc_res.data["allocation_rows"][1]["period_allocation_amount"], "800000.00")
        self.assertEqual(len(calc_res.data["accounting_rows"]), 2)
        self.assertFalse(calc_res.data["gl_posted"])

        # Step 14–29: Save and post allocation voucher
        save_res = self.client.post(
            "/api/v1/fixed-assets/assets/save-allocation-voucher/",
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 9,
                "year": 2026,
                "voucher_no": "PBCC00001",
                "posting_date": "30/09/2026",
                "voucher_date": "30/09/2026",
                "description": "Phân bổ chi phí CCDC tháng 9 năm 2026",
                "item_ids": [str(tool.id)],
                "attachments": [{"file_name": "bang_phan_bo_t9.pdf", "file_size": 102400}],
                "print_on_save": True,
                "idempotency_key": "UC12-TOOL-SAVE-1",
            },
            format="json",
        )
        self.assertEqual(save_res.status_code, 201, save_res.data)
        self.assertEqual(save_res.data["message"], "Đã cất chứng từ phân bổ CCDC thành công.")
        self.assertTrue(save_res.data["gl_posted"])
        self.assertEqual(save_res.data["print_status"], "READY")
        self.assertIsNotNone(save_res.data["print_data"])

        # Verify DB updates on CCDC00001
        tool.refresh_from_db()
        self.assertEqual(tool.allocated_value, Decimal("6000000.00"))
        self.assertEqual(tool.remaining_value, Decimal("18000000.00"))
        self.assertEqual(tool.periods_processed, 3)

        # Verify GL JournalEntry
        je = JournalEntry.objects.filter(company=self.company, number="PBCC00001").first()
        self.assertIsNotNone(je)
        self.assertEqual(je.status, "POSTED")
        self.assertEqual(je.total_debit, Decimal("2000000.00"))
        self.assertEqual(je.total_credit, Decimal("2000000.00"))

        # Idempotent replay on duplicate click
        dup_res = self.client.post(
            "/api/v1/fixed-assets/assets/save-allocation-voucher/",
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 9,
                "year": 2026,
                "voucher_no": "PBCC00001",
                "item_ids": [str(tool.id)],
                "idempotency_key": "UC12-TOOL-SAVE-1",
            },
            format="json",
        )
        self.assertEqual(dup_res.status_code, 200)
        self.assertTrue(dup_res.data["idempotent_replayed"])
        tool.refresh_from_db()
        self.assertEqual(tool.allocated_value, Decimal("6000000.00"))

    def test_uc_fa_12_main_flow_b_prepaid_allocation_examples_4_9_and_4_10(self):
        """
        UC-FA-12 Main Flow B (Steps 1–25), Example 4.9, Example 4.10 (last period rounding AF06 & BR34),
        AF18 (Export Excel without auto-posting), AF22 (Unpost allocation voucher).
        """
        from general_ledger.models import PrepaidExpense
        self._setup_uc10_accounts_and_departments()

        # Example 4.9: CPTT00005 – Phần mềm bản quyền 1 năm, 12.000.000, 12 kỳ, đã phân bổ 3 kỳ (3.000.000)
        pe_res = self.client.post(
            "/api/v1/fixed-assets/assets/prepaid-expenses/",
            {
                "company": str(self.company.id),
                "is_opening": True,
                "code": "CPTT00005",
                "name": "Phần mềm bản quyền 1 năm",
                "record_date": "01/06/2026",
                "start_date": "01/06/2026",
                "amount": "12000000",
                "allocation_periods": 12,
                "remaining_periods": 9,
                "opening_allocated_amount": "3000000",
                "remaining_amount": "9000000",
                "waiting_account": "242",
                "allocations": [
                    {"target_code": "BPQL", "target_name": "Bộ phận Quản lý", "rate": "50", "expense_account": self.expense_account.code},
                    {"target_code": "BPBH", "target_name": "Bộ phận Bán hàng", "rate": "50", "expense_account": self.expense_account.code},
                ],
            },
            format="json",
        )
        self.assertEqual(pe_res.status_code, 201, pe_res.data)
        pe_id = pe_res.data["prepaid_id"]

        # AF18 & BR38: Export Excel without auto-posting
        excel_res = self.client.post(
            "/api/v1/fixed-assets/assets/export-allocation-excel/",
            {
                "company": str(self.company.id),
                "allocation_type": "PREPAID",
                "month": 9,
                "year": 2026,
                "item_ids": [pe_id],
            },
            format="json",
        )
        self.assertEqual(excel_res.status_code, 200, excel_res.data)
        self.assertFalse(excel_res.data["gl_posted"])
        self.assertEqual(excel_res.data["total_amount"], "1000000.00")

        # Main Flow B Save & Post
        save_res = self.client.post(
            "/api/v1/fixed-assets/assets/save-allocation-voucher/",
            {
                "company": str(self.company.id),
                "allocation_type": "PREPAID",
                "month": 9,
                "year": 2026,
                "voucher_no": "PBCP00001",
                "posting_date": "30/09/2026",
                "voucher_date": "30/09/2026",
                "description": "Phân bổ chi phí trả trước tháng 9 năm 2026",
                "item_ids": [pe_id],
            },
            format="json",
        )
        self.assertEqual(save_res.status_code, 201, save_res.data)
        self.assertEqual(save_res.data["message"], "Đã lưu chứng từ phân bổ chi phí trả trước thành công.")
        self.assertEqual(save_res.data["total_amount"], "1000000.00")
        self.assertEqual(save_res.data["allocation_rows"][0]["period_allocation_amount"], "500000.00")
        self.assertEqual(save_res.data["allocation_rows"][1]["period_allocation_amount"], "500000.00")

        pe_obj = PrepaidExpense.objects.get(pk=pe_id)
        self.assertEqual(pe_obj.allocated_amount, Decimal("1000000.00"))
        self.assertEqual(pe_obj.remaining_amount, Decimal("8000000.00"))

        # AF22: Unpost voucher PBCP00001 and verify reversal
        unpost_res = self.client.post(
            "/api/v1/fixed-assets/assets/unpost-allocation-voucher/",
            {"company": str(self.company.id), "voucher_no": "PBCP00001"},
            format="json",
        )
        self.assertEqual(unpost_res.status_code, 200, unpost_res.data)
        pe_obj.refresh_from_db()
        self.assertEqual(pe_obj.allocated_amount, Decimal("0.00"))
        self.assertEqual(pe_obj.remaining_amount, Decimal("9000000.00"))

        # Example 4.10: Last period rounding (10.000.000 / 3 periods -> 2 periods already allocated = 6.666.666,66 -> last period = 3.333.333,34)
        pe_last_res = self.client.post(
            "/api/v1/fixed-assets/assets/prepaid-expenses/",
            {
                "company": str(self.company.id),
                "is_opening": True,
                "code": "CPTT-LAST",
                "name": "Khoản trả trước 10 triệu 3 kỳ",
                "record_date": "01/07/2026",
                "start_date": "01/07/2026",
                "amount": "10000000.00",
                "allocation_periods": 3,
                "remaining_periods": 1,
                "opening_allocated_amount": "6666666.66",
                "remaining_amount": "3333333.34",
                "waiting_account": "242",
                "allocations": [
                    {"target_code": "BPQL", "target_name": "Bộ phận Quản lý", "rate": "100", "expense_account": self.expense_account.code},
                ],
            },
            format="json",
        )
        self.assertEqual(pe_last_res.status_code, 201, pe_last_res.data)
        pe_last_id = pe_last_res.data["prepaid_id"]

        save_last = self.client.post(
            "/api/v1/fixed-assets/assets/save-allocation-voucher/",
            {
                "company": str(self.company.id),
                "allocation_type": "PREPAID",
                "month": 9,
                "year": 2026,
                "voucher_no": "PBCP00002",
                "item_ids": [pe_last_id],
            },
            format="json",
        )
        self.assertEqual(save_last.status_code, 201, save_last.data)
        self.assertEqual(save_last.data["total_amount"], "3333333.34")
        pe_last_obj = PrepaidExpense.objects.get(pk=pe_last_id)
        self.assertEqual(pe_last_obj.remaining_amount, Decimal("0.00"))
        self.assertEqual(pe_last_obj.status, PrepaidExpense.Status.COMPLETED)

    def test_uc_fa_12_exceptions_ef01_to_ef33(self):
        """
        Verifies all UC-FA-12 exception flows EF01 through EF33 with exact Vietnamese messages.
        """
        self._setup_uc10_accounts_and_departments()
        save_url = "/api/v1/fixed-assets/assets/save-allocation-voucher/"
        calc_url = "/api/v1/fixed-assets/assets/calculate-allocation/"
        ref_url = "/api/v1/fixed-assets/assets/allocation-reference-vouchers/"
        excel_url = "/api/v1/fixed-assets/assets/export-allocation-excel/"

        # Seed a tool for testing EF11–EF28
        acq = self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "code": "CCDC-EF12",
                "name": "Máy in kiểm thử EF",
                "voucher_no": "GTCC-EF12",
                "acquisition_date": "01/08/2026",
                "start_allocation_date": "01/08/2026",
                "quantity": 1,
                "unit_price": "6000000",
                "original_cost": "6000000",
                "useful_life_periods": 6,
                "waiting_account": "242",
                "department_allocations": [{"department_code": self.department.code, "quantity": 1}],
                "allocations": [
                    {"target_code": self.department.code, "target_name": self.department.name, "rate": "100", "expense_account": self.expense_account.code},
                ],
            },
            format="json",
        )
        self.assertEqual(acq.status_code, 201)
        tool = AssetRecord.objects.get(company=self.company, code="CCDC-EF12")

        # EF02: Tháng hoặc năm phân bổ không hợp lệ
        ef02 = self.client.post(calc_url, {"company": str(self.company.id), "month": 13, "year": 2026}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["detail"]), "Tháng hoặc năm phân bổ không hợp lệ.")

        # EF03: Thiếu diễn giải chứng từ
        ef03 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "description": "   "},
            format="json",
        )
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["detail"]), "Vui lòng nhập diễn giải chứng từ.")

        # EF04: Ngày hạch toán không hợp lệ (ngoài kỳ)
        ef04 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "posting_date": "15/10/2026"},
            format="json",
        )
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["detail"]), "Vui lòng nhập ngày hạch toán hợp lệ.")

        # EF05: Ngày chứng từ không hợp lệ (> ngày hạch toán)
        ef05 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "posting_date": "20/09/2026", "voucher_date": "25/09/2026"},
            format="json",
        )
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["detail"]), "Vui lòng nhập ngày chứng từ hợp lệ.")

        # EF06: Kỳ kế toán đã khóa
        ef06 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "period_locked": True},
            format="json",
        )
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["detail"]), "Kỳ kế toán đã khóa, không thể ghi nhận chứng từ phân bổ.")

        # EF07: Thiếu số chứng từ
        ef07 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "voucher_no": ""},
            format="json",
        )
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["detail"]), "Vui lòng nhập số chứng từ.")

        # EF08: Trùng số chứng từ
        ef08 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "voucher_no": "GTCC-EF12"},
            format="json",
        )
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["detail"]), "Số chứng từ đã tồn tại. Vui lòng nhập số khác.")

        # EF09: Lỗi truy xuất dữ liệu nguồn
        ef09 = self.client.post(
            calc_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "simulate_source_load_error": True},
            format="json",
        )
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["detail"]), "Không thể tải dữ liệu phân bổ. Vui lòng thử lại.")

        # EF10: Không có khoản chi phí cần phân bổ trong kỳ đã chọn (năm 2025 trước khi ghi tăng)
        ef10 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 5, "year": 2025, "voucher_no": "PBCC-EMPTY"},
            format="json",
        )
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["detail"]), "Không có khoản chi phí cần phân bổ trong kỳ đã chọn.")

        # EF11: Thiết lập phân bổ của [Mã] chưa đầy đủ
        ef11 = self.client.post(
            calc_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)], "simulate_incomplete_setup": True},
            format="json",
        )
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["detail"]), "Thiết lập phân bổ của CCDC-EF12 chưa đầy đủ.")

        # EF12: Số tiền đã phân bổ của [Mã] vượt giá trị được phép phân bổ
        meta = tool.accessories[0]
        meta["exceed_allocatable"] = True
        tool.accessories = [meta]
        tool.save(update_fields=["accessories"])
        ef12 = self.client.post(calc_url, {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)]}, format="json")
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["detail"]), "Số tiền đã phân bổ của CCDC-EF12 vượt giá trị được phép phân bổ.")
        meta.pop("exceed_allocatable", None)

        # EF13: Giá trị còn lại của [Mã] không hợp lệ
        meta["invalid_remaining_value"] = True
        tool.accessories = [meta]
        tool.save(update_fields=["accessories"])
        ef13 = self.client.post(calc_url, {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)]}, format="json")
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["detail"]), "Giá trị còn lại của CCDC-EF12 không hợp lệ.")
        meta.pop("invalid_remaining_value", None)
        tool.accessories = [meta]
        tool.save(update_fields=["accessories"])

        # EF14: Số tiền phân bổ kỳ này vượt giá trị còn lại của [Mã]
        ef14 = self.client.post(
            calc_url,
            {
                "company": str(self.company.id),
                "month": 9,
                "year": 2026,
                "item_ids": [str(tool.id)],
                "identify_rows_override": [{"code": "CCDC-EF12", "total_allocation_amount": "9000000"}],
            },
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(str(ef14.data["detail"]), "Số tiền phân bổ kỳ này vượt giá trị còn lại của CCDC-EF12.")

        # EF15: Khoản chi phí của [Mã] đã được phân bổ trong kỳ
        meta["already_allocated_in_period_error"] = True
        tool.accessories = [meta]
        tool.save(update_fields=["accessories"])
        ef15 = self.client.post(calc_url, {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)]}, format="json")
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(str(ef15.data["detail"]), "Khoản chi phí của CCDC-EF12 đã được phân bổ trong kỳ.")
        meta.pop("already_allocated_in_period_error", None)
        tool.accessories = [meta]
        tool.save(update_fields=["accessories"])

        # EF16: Có kỳ phân bổ trước chưa hoàn tất
        ef16 = self.client.post(
            calc_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)], "simulate_unallocated_prior_period": True},
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(str(ef16.data["detail"]), "Có kỳ phân bổ trước chưa hoàn tất. Vui lòng kiểm tra lịch phân bổ của CCDC-EF12.")

        # EF17: Lịch phân bổ của [Mã] chưa khớp với chứng từ điều chỉnh hoặc ghi giảm
        ef17 = self.client.post(
            calc_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)], "simulate_schedule_mismatch": True},
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(str(ef17.data["detail"]), "Lịch phân bổ của CCDC-EF12 chưa khớp với chứng từ điều chỉnh hoặc ghi giảm.")

        # EF18: Tổng tỷ lệ phân bổ của [Mã] phải bằng 100%
        orig_allocs = list(tool.allocations)
        tool.allocations = [{**orig_allocs[0], "rate": "80"}]
        tool.save(update_fields=["allocations"])
        ef18 = self.client.post(calc_url, {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)]}, format="json")
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(str(ef18.data["detail"]), "Tổng tỷ lệ phân bổ của CCDC-EF12 phải bằng 100%.")

        # EF19: Đối tượng hoặc đơn vị chịu chi phí của [Mã] không hợp lệ
        tool.allocations = [{**orig_allocs[0], "invalid_target": True}]
        tool.save(update_fields=["allocations"])
        ef19 = self.client.post(calc_url, {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)]}, format="json")
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(str(ef19.data["detail"]), "Đối tượng hoặc đơn vị chịu chi phí của CCDC-EF12 không hợp lệ.")

        # EF21: Tài khoản phân bổ không hợp lệ
        tool.allocations = [{**orig_allocs[0], "invalid_expense_account": True}]
        tool.save(update_fields=["allocations"])
        ef21 = self.client.post(calc_url, {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)]}, format="json")
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(str(ef21.data["detail"]), "Tài khoản phân bổ không hợp lệ. Vui lòng kiểm tra TK chờ và TK chi phí.")
        tool.allocations = orig_allocs
        tool.save(update_fields=["allocations"])

        # EF20: Số tiền phân bổ theo đối tượng không khớp với số tiền phân bổ kỳ này
        ef20 = self.client.post(
            calc_url,
            {
                "company": str(self.company.id),
                "month": 9,
                "year": 2026,
                "item_ids": [str(tool.id)],
                "allocation_rows_override": [{"code": "CCDC-EF12", "period_allocation_amount": "500000"}],
            },
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(str(ef20.data["detail"]), "Số tiền phân bổ theo đối tượng không khớp với số tiền phân bổ kỳ này.")

        # EF22: Tổng tiền hạch toán không khớp với tổng tiền phân bổ
        ef22 = self.client.post(
            calc_url,
            {
                "company": str(self.company.id),
                "month": 9,
                "year": 2026,
                "item_ids": [str(tool.id)],
                "accounting_rows_override": [
                    {"debit_account": self.expense_account.code, "credit_account": "242", "amount": "500000"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(str(ef22.data["detail"]), "Tổng tiền hạch toán không khớp với tổng tiền phân bổ.")

        # EF23: Bút toán phân bổ không hợp lệ
        ef23 = self.client.post(
            calc_url,
            {
                "company": str(self.company.id),
                "month": 9,
                "year": 2026,
                "item_ids": [str(tool.id)],
                "accounting_rows_override": [
                    {"debit_account": "242", "credit_account": "242", "amount": "1000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(str(ef23.data["detail"]), "Bút toán phân bổ không hợp lệ. Vui lòng kiểm tra tài khoản và số tiền.")

        # EF24: Không có quyền tham chiếu chứng từ
        ef24 = self.client.post(
            ref_url,
            {"company": str(self.company.id), "simulate_reference_permission_error": True},
            format="json",
        )
        self.assertEqual(ef24.status_code, 403)
        self.assertEqual(str(ef24.data["detail"]), "Bạn không có quyền tham chiếu chứng từ này.")

        # EF25: Chứng từ tham chiếu không hợp lệ
        ef25 = self.client.post(
            ref_url,
            {"company": str(self.company.id), "selected_vouchers": [{"voucher_no": "REF-DEL", "is_deleted": True}]},
            format="json",
        )
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(str(ef25.data["detail"]), "Chứng từ tham chiếu không hợp lệ. Vui lòng chọn chứng từ khác.")

        # EF26: Lỗi tải danh sách chứng từ tham chiếu
        ef26 = self.client.post(
            ref_url,
            {"company": str(self.company.id), "simulate_reference_load_error": True},
            format="json",
        )
        self.assertEqual(ef26.status_code, 400)
        self.assertEqual(str(ef26.data["detail"]), "Không thể tải danh sách chứng từ tham chiếu. Vui lòng thử lại.")

        # EF27: Tệp đính kèm vượt dung lượng 5MB
        ef27 = self.client.post(
            save_url,
            {
                "company": str(self.company.id),
                "month": 9,
                "year": 2026,
                "voucher_no": "PBCC-ATT",
                "attachments": [{"file_name": "big.pdf", "file_size": 6 * 1024 * 1024}],
            },
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(str(ef27.data["detail"]), "Tệp đính kèm không hợp lệ hoặc vượt dung lượng cho phép.")

        # EF28: Giá trị còn lại của CCDC đã được xử lý ở chứng từ ghi giảm
        meta["disposed_in_period"] = True
        meta["disposal_handled_on_disposal_voucher"] = True
        tool.accessories = [meta]
        tool.save(update_fields=["accessories"])
        ef28 = self.client.post(
            calc_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "item_ids": [str(tool.id)], "force_disposed_remaining_allocation": True},
            format="json",
        )
        self.assertEqual(ef28.status_code, 400)
        self.assertEqual(str(ef28.data["detail"]), "Giá trị còn lại của CCDC đã được xử lý ở chứng từ ghi giảm.")
        meta.pop("disposed_in_period", None)
        meta.pop("disposal_handled_on_disposal_voucher", None)
        tool.accessories = [meta]
        tool.save(update_fields=["accessories"])

        # EF29: Dữ liệu phân bổ đã thay đổi
        ef29 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "voucher_no": "PBCC-STALE", "source_data_changed": True},
            format="json",
        )
        self.assertEqual(ef29.status_code, 400)
        self.assertEqual(str(ef29.data["detail"]), "Dữ liệu phân bổ đã thay đổi. Vui lòng tính lại trước khi ghi nhận.")

        # EF30: Khoản phân bổ đã được xử lý bởi chứng từ khác
        ef30 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "voucher_no": "PBCC-CONC", "concurrent_processed": True},
            format="json",
        )
        self.assertEqual(ef30.status_code, 400)
        self.assertEqual(str(ef30.data["detail"]), "Khoản phân bổ đã được xử lý bởi chứng từ khác. Vui lòng tải lại dữ liệu.")

        # EF31: Ghi nhận phân bổ thất bại
        ef31 = self.client.post(
            save_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "voucher_no": "PBCC-FAIL", "item_ids": [str(tool.id)], "simulate_save_error": True},
            format="json",
        )
        self.assertEqual(ef31.status_code, 400)
        self.assertEqual(str(ef31.data["detail"]), "Ghi nhận phân bổ thất bại. Vui lòng thử lại.")

        # EF32: Lỗi in sau khi lưu tại Cất và In (chứng từ vẫn được lưu)
        ef32 = self.client.post(
            save_url,
            {
                "company": str(self.company.id),
                "month": 9,
                "year": 2026,
                "voucher_no": "PBCC-PRINTERR",
                "item_ids": [str(tool.id)],
                "print_on_save": True,
                "simulate_print_error": True,
            },
            format="json",
        )
        self.assertEqual(ef32.status_code, 201)
        self.assertEqual(ef32.data["print_status"], "ERROR")
        self.assertEqual(ef32.data["message"], "Chứng từ đã được lưu nhưng chưa thể tạo bản in.")

        # EF33: Xuất bảng phân bổ ra Excel thất bại
        ef33 = self.client.post(
            excel_url,
            {"company": str(self.company.id), "month": 9, "year": 2026, "simulate_export_error": True},
            format="json",
        )
        self.assertEqual(ef33.status_code, 400)
        self.assertEqual(str(ef33.data["detail"]), "Xuất bảng phân bổ ra Excel thất bại. Vui lòng thử lại.")

        # EF01: Không có quyền ghi nhận chứng từ phân bổ chi phí
        no_perm_user = get_user_model().objects.create_user(username="no-uc12-perm", email="nouc12@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(save_url, {"company": str(self.company.id), "month": 9, "year": 2026}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền ghi nhận chứng từ phân bổ chi phí.")

    # ==========================================================================
    # UC-FA-13 – ĐIỀU CHUYỂN CÔNG CỤ DỤNG CỤ (CCDC)
    # ==========================================================================

    def test_uc_fa_13_main_flow_tool_transfer_and_example_4_7(self):
        """
        UC-FA-13 Main Flow (Steps 1–31) & Example 4.7:
        - CCDC00015 – Bàn làm việc nhân viên, Số lượng = 10 cái tại Phòng Hành chính,
          Giá trị = 15.000.000, Số kỳ = 30, Phân bổ mỗi kỳ = 500.000.
        - Ngày 15/09/2026 lập biên bản ĐCCC00001 điều chuyển 4 cái từ Phòng Hành chính sang Phòng Kế toán.
        - Kiểm tra:
          + Số lượng tại Phòng Hành chính = 6, tại Phòng Kế toán = 4; tổng số lượng = 10; nguyên giá = 15.000.000.
          + Không sinh bút toán Nợ/Có tài khoản kế toán (gl_posted=False, gl_status="NOT_REQUIRED").
          + Tỷ lệ phân bổ cập nhật thành 60% Phòng Hành chính / 40% Phòng Kế toán.
          + Khi chạy phân bổ kỳ 09/2026 (UC-FA-12): Phòng Hành chính = 300.000, Phòng Kế toán = 200.000.
          + Kiểm tra điều chuyển nhiều dòng cùng CCDC (AF10, BR33): Tổng Số lượng đang dùng không cộng trùng.
        """
        from organization.models import Department
        self._setup_uc10_accounts_and_departments()

        dept_hc, _ = Department.objects.get_or_create(
            company=self.company, code="PHC", defaults={"branch": self.branch, "name": "Phòng Hành chính"}
        )
        dept_kt, _ = Department.objects.get_or_create(
            company=self.company, code="PKT", defaults={"branch": self.branch, "name": "Phòng Kế toán"}
        )
        dept_kd, _ = Department.objects.get_or_create(
            company=self.company, code="PKD", defaults={"branch": self.branch, "name": "Phòng Kinh doanh"}
        )

        acq_res = self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "code": "CCDC00015",
                "name": "Bàn làm việc nhân viên",
                "voucher_no": "GTCC-UC13-15",
                "acquisition_date": "01/08/2026",
                "start_allocation_date": "01/08/2026",
                "unit": "Cái",
                "quantity": 10,
                "unit_price": "1500000",
                "original_cost": "15000000",
                "useful_life_periods": 30,
                "waiting_account": "242",
                "department_allocations": [{"department_code": dept_hc.code, "quantity": 10}],
                "allocations": [
                    {"target_code": dept_hc.code, "target_name": dept_hc.name, "rate": "100", "expense_account": self.expense_account.code},
                ],
            },
            format="json",
        )
        self.assertEqual(acq_res.status_code, 201, acq_res.data)
        tool = AssetRecord.objects.get(company=self.company, code="CCDC00015")

        # Step 5, 10–11: Query transferable tools
        list_res = self.client.get(
            f"/api/v1/fixed-assets/assets/transferable-tools/?company_id={self.company.id}&transfer_date=15/09/2026"
        )
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(list_res.data["voucher_no"], "ĐCCC00001")
        matched = [i for i in list_res.data["items"] if i["code"] == "CCDC00015"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]["in_use_quantity"], "10")
        self.assertEqual(matched[0]["from_department_name"], "Phòng Hành chính")

        # Step 19–31: Execute transfer ĐCCC00001 (4 units from Phòng Hành chính to Phòng Kế toán)
        trans_res = self.client.post(
            "/api/v1/fixed-assets/assets/transfer-tools/",
            {
                "company": str(self.company.id),
                "voucher_no": "ĐCCC00001",
                "transfer_date": "15/09/2026",
                "deliverer": "Nguyễn Văn A",
                "receiver": "Trần Thị B",
                "reason": "Điều chuyển bàn làm việc sang Phòng Kế toán",
                "lines": [
                    {
                        "code": "CCDC00015",
                        "from_department": "Phòng Hành chính",
                        "to_department": "Phòng Kế toán",
                        "transfer_quantity": 4,
                        "statistical_code": "TK01",
                        "sales_contract": "HD01",
                        "purchase_order": "DH01",
                    }
                ],
                "attachments": [{"file_name": "bien_ban_ban_giao.pdf", "file_size": 204800}],
                "print_on_save": True,
                "idempotency_key": "UC13-TRANS-1",
            },
            format="json",
        )
        self.assertEqual(trans_res.status_code, 201, trans_res.data)
        self.assertEqual(trans_res.data["message"], "Đã lưu chứng từ điều chuyển CCDC ĐCCC00001 thành công.")
        self.assertEqual(trans_res.data["total_in_use_quantity"], "10")
        self.assertEqual(trans_res.data["total_transfer_quantity"], "4")
        self.assertFalse(trans_res.data["gl_posted"])
        self.assertEqual(trans_res.data["gl_status"], "NOT_REQUIRED")
        self.assertEqual(trans_res.data["print_status"], "READY")

        # Verify updated department quantities and allocations on CCDC00015
        tool.refresh_from_db()
        self.assertEqual(tool.quantity, Decimal("10.00"))
        self.assertEqual(tool.original_cost, Decimal("15000000.00"))
        comp_map = {c["department_name"]: c["quantity"] for c in tool.components}
        self.assertEqual(comp_map["Phòng Hành chính"], "6")
        self.assertEqual(comp_map["Phòng Kế toán"], "4")
        rate_map = {a["target_name"]: a["rate"] for a in tool.allocations}
        self.assertEqual(rate_map["Phòng Hành chính"], "60.00")
        self.assertEqual(rate_map["Phòng Kế toán"], "40.00")

        # Example 4.7: Calculate allocation for 09/2026 -> 500.000 split 60% (300.000) & 40% (200.000)
        calc_res = self.client.post(
            "/api/v1/fixed-assets/assets/calculate-allocation/",
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 9,
                "year": 2026,
                "item_ids": [str(tool.id)],
            },
            format="json",
        )
        self.assertEqual(calc_res.status_code, 200, calc_res.data)
        self.assertEqual(calc_res.data["total_amount"], "500000.00")
        alloc_by_dept = {r["target_name"]: r["period_allocation_amount"] for r in calc_res.data["allocation_rows"]}
        self.assertEqual(alloc_by_dept["Phòng Hành chính"], "300000.00")
        self.assertEqual(alloc_by_dept["Phòng Kế toán"], "200000.00")

        # AF10 & BR33: Multi-line transfer of the same CCDC from Phòng Hành chính (currently 6 in use)
        # Line 1: 2 to Phòng Kế toán, Line 2: 1 to Phòng Kinh doanh -> total_in_use_quantity = 6 (NOT 12!), total_transfer_quantity = 3
        trans_multi = self.client.post(
            "/api/v1/fixed-assets/assets/transfer-tools/",
            {
                "company": str(self.company.id),
                "voucher_no": "ĐCCC00002",
                "transfer_date": "20/09/2026",
                "deliverer": "Nguyễn Văn A",
                "receiver": "Lê Văn C",
                "reason": "Điều chuyển tiếp sang 2 phòng ban",
                "lines": [
                    {"code": "CCDC00015", "from_department": "Phòng Hành chính", "to_department": "Phòng Kế toán", "transfer_quantity": 2},
                    {"code": "CCDC00015", "from_department": "Phòng Hành chính", "to_department": "Phòng Kinh doanh", "transfer_quantity": 1},
                ],
            },
            format="json",
        )
        self.assertEqual(trans_multi.status_code, 201, trans_multi.data)
        self.assertEqual(trans_multi.data["total_in_use_quantity"], "6")
        self.assertEqual(trans_multi.data["total_transfer_quantity"], "3")

        # AF24: Cancel ĐCCC00002 and verify restoration back to 6 at Phòng Hành chính and 4 at Phòng Kế toán
        cancel_res = self.client.post(
            "/api/v1/fixed-assets/assets/cancel-tool-transfer/",
            {"company": str(self.company.id), "voucher_no": "ĐCCC00002"},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, 200, cancel_res.data)
        tool.refresh_from_db()
        comp_map_after = {c["department_name"]: c["quantity"] for c in tool.components}
        self.assertEqual(comp_map_after["Phòng Hành chính"], "6")
        self.assertEqual(comp_map_after["Phòng Kế toán"], "4")

    def test_uc_fa_13_exceptions_ef01_to_ef29(self):
        """
        Verifies all UC-FA-13 exception flows EF01 through EF29 with exact Vietnamese messages.
        """
        from organization.models import Company, Department
        self._setup_uc10_accounts_and_departments()

        url = "/api/v1/fixed-assets/assets/transfer-tools/"
        list_url = "/api/v1/fixed-assets/assets/transferable-tools/"
        cancel_url = "/api/v1/fixed-assets/assets/cancel-tool-transfer/"

        dept_hc, _ = Department.objects.get_or_create(
            company=self.company, code="HC-EF", defaults={"branch": self.branch, "name": "Phòng HC EF"}
        )
        dept_kt, _ = Department.objects.get_or_create(
            company=self.company, code="KT-EF", defaults={"branch": self.branch, "name": "Phòng KT EF"}
        )
        dept_inactive, _ = Department.objects.get_or_create(
            company=self.company, code="INACT-EF", defaults={"branch": self.branch, "name": "Phòng Ngừng HĐ", "status": "INACTIVE"}
        )

        acq = self.client.post(
            "/api/v1/fixed-assets/assets/acquire-tool/",
            {
                "company": str(self.company.id),
                "code": "CCDC-EF13",
                "name": "Ghế xoay văn phòng",
                "voucher_no": "GTCC-EF13",
                "acquisition_date": "10/08/2026",
                "start_allocation_date": "10/08/2026",
                "unit": "Cái",
                "quantity": 5,
                "unit_price": "1000000",
                "original_cost": "5000000",
                "useful_life_periods": 10,
                "waiting_account": "242",
                "department_allocations": [{"department_code": dept_hc.code, "quantity": 5}],
                "allocations": [
                    {"target_code": dept_hc.code, "target_name": dept_hc.name, "rate": "100", "expense_account": self.expense_account.code},
                ],
            },
            format="json",
        )
        self.assertEqual(acq.status_code, 201)

        base_payload = {
            "company": str(self.company.id),
            "voucher_no": "ĐCCC-EF01",
            "transfer_date": "15/09/2026",
            "deliverer": "Nguyễn Văn A",
            "receiver": "Trần Thị B",
            "reason": "Điều chuyển CCDC",
            "lines": [
                {"code": "CCDC-EF13", "from_department": dept_hc.code, "to_department": dept_kt.code, "transfer_quantity": 2}
            ],
        }

        # EF02: Thiếu Biên bản giao nhận số
        ef02 = self.client.post(url, {**base_payload, "voucher_no": "  "}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["detail"]), "Vui lòng nhập số biên bản giao nhận.")

        # EF04: Ngày điều chuyển không hợp lệ
        ef04 = self.client.post(url, {**base_payload, "transfer_date": "invalid-date"}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["detail"]), "Vui lòng nhập ngày điều chuyển hợp lệ.")

        # EF05: Kỳ kế toán đã khóa
        ef05 = self.client.post(url, {**base_payload, "period_locked": True}, format="json")
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["detail"]), "Kỳ kế toán đã khóa, không thể ghi nhận điều chuyển CCDC trong kỳ này.")

        # EF06: Thiếu Người bàn giao
        ef06 = self.client.post(url, {**base_payload, "deliverer": ""}, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["detail"]), "Vui lòng nhập người bàn giao.")

        # EF07: Thiếu Người tiếp nhận
        ef07 = self.client.post(url, {**base_payload, "receiver": ""}, format="json")
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["detail"]), "Vui lòng nhập người tiếp nhận.")

        # EF08: Thiếu Lý do điều chuyển
        ef08 = self.client.post(url, {**base_payload, "reason": ""}, format="json")
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["detail"]), "Vui lòng nhập lý do điều chuyển.")

        # EF09: Không có dòng chi tiết CCDC
        ef09 = self.client.post(url, {**base_payload, "lines": []}, format="json")
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["detail"]), "Vui lòng chọn ít nhất một CCDC cần điều chuyển.")

        # EF10: Dòng chi tiết chưa chọn Mã CCDC
        ef10 = self.client.post(
            url,
            {**base_payload, "lines": [{"code": "", "to_department": dept_kt.code, "transfer_quantity": 1}]},
            format="json",
        )
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["detail"]), "Vui lòng chọn Mã CCDC tại dòng 1.")

        # EF11: CCDC không thuộc đối tượng được điều chuyển
        ef11 = self.client.post(
            url,
            {**base_payload, "lines": [{"code": "CCDC-EF13", "to_department": dept_kt.code, "transfer_quantity": 1, "ineligible_for_transfer": True}]},
            format="json",
        )
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["detail"]), "CCDC CCDC-EF13 không đủ điều kiện điều chuyển.")

        # EF12: Chưa chọn đơn vị nhận (Đến đơn vị)
        ef12 = self.client.post(
            url,
            {**base_payload, "lines": [{"code": "CCDC-EF13", "to_department": "", "transfer_quantity": 1}]},
            format="json",
        )
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["detail"]), "Vui lòng chọn đơn vị nhận tại dòng 1.")

        # EF13: Đến đơn vị trùng với Từ đơn vị
        ef13 = self.client.post(
            url,
            {**base_payload, "lines": [{"code": "CCDC-EF13", "from_department": dept_hc.code, "to_department": dept_hc.code, "transfer_quantity": 1}]},
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["detail"]), "Đơn vị nhận phải khác đơn vị bàn giao.")

        # EF14: Đơn vị nhận không hợp lệ hoặc đã ngừng hoạt động
        ef14 = self.client.post(
            url,
            {**base_payload, "lines": [{"code": "CCDC-EF13", "from_department": dept_hc.code, "to_department": dept_inactive.code, "transfer_quantity": 1}]},
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(str(ef14.data["detail"]), "Đơn vị nhận không hợp lệ hoặc không còn hoạt động.")

        # EF15: Số lượng điều chuyển <= 0
        ef15 = self.client.post(
            url,
            {**base_payload, "lines": [{"code": "CCDC-EF13", "from_department": dept_hc.code, "to_department": dept_kt.code, "transfer_quantity": 0}]},
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(str(ef15.data["detail"]), "Số lượng điều chuyển phải lớn hơn 0.")

        # EF16: Số lượng điều chuyển là số lẻ khi đơn vị tính là Cái
        ef16 = self.client.post(
            url,
            {**base_payload, "lines": [{"code": "CCDC-EF13", "from_department": dept_hc.code, "to_department": dept_kt.code, "transfer_quantity": "1.5"}]},
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(str(ef16.data["detail"]), "Số lượng điều chuyển không phù hợp với đơn vị tính của CCDC.")

        # EF17: Số lượng điều chuyển vượt Số lượng đang dùng tại đơn vị bàn giao (6 > 5)
        ef17 = self.client.post(
            url,
            {**base_payload, "lines": [{"code": "CCDC-EF13", "from_department": dept_hc.code, "to_department": dept_kt.code, "transfer_quantity": 6}]},
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(str(ef17.data["detail"]), "Số lượng điều chuyển vượt số lượng đang dùng tại đơn vị bàn giao.")

        # EF18: Tổng số lượng điều chuyển của cùng CCDC trên nhiều dòng vượt số lượng khả dụng (3 + 3 = 6 > 5)
        ef18 = self.client.post(
            url,
            {
                **base_payload,
                "lines": [
                    {"code": "CCDC-EF13", "from_department": dept_hc.code, "to_department": dept_kt.code, "transfer_quantity": 3},
                    {"code": "CCDC-EF13", "from_department": dept_hc.code, "to_department": self.department.code, "transfer_quantity": 3},
                ],
            },
            format="json",
        )
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(
            str(ef18.data["detail"]),
            f"Tổng số lượng điều chuyển của CCDC-EF13 vượt số lượng khả dụng tại {dept_hc.name}.",
        )

        # EF19: CCDC chưa được ghi tăng hoặc không còn đủ số lượng tại đơn vị bàn giao vào ngày đã chọn (01/08/2026 < 10/08/2026)
        ef19 = self.client.post(
            url,
            {**base_payload, "transfer_date": "01/08/2026"},
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(
            str(ef19.data["detail"]),
            "CCDC CCDC-EF13 không còn đủ số lượng tại đơn vị bàn giao vào ngày đã chọn.",
        )

        # EF20: Ngày điều chuyển làm ảnh hưởng đến các chứng từ đã ghi nhận sau ngày này
        ef20 = self.client.post(
            url,
            {**base_payload, "simulate_backdated_conflict": True},
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(
            str(ef20.data["detail"]),
            "Ngày điều chuyển làm ảnh hưởng đến các chứng từ đã ghi nhận sau ngày này. Vui lòng kiểm tra lịch sử CCDC.",
        )

        # EF21: CCDC thuộc doanh nghiệp khác
        ef21 = self.client.post(
            url,
            {**base_payload, "lines": [{**base_payload["lines"][0], "cross_company": True}]},
            format="json",
        )
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(
            str(ef21.data["detail"]),
            "Không thể điều chuyển CCDC của doanh nghiệp khác bằng chứng từ điều chuyển nội bộ.",
        )

        # EF22: Chứng từ tham chiếu không hợp lệ hoặc không có quyền truy cập
        ef22 = self.client.post(
            url,
            {**base_payload, "references": [{"voucher_no": "REF-INVALID", "invalid": True}]},
            format="json",
        )
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(
            str(ef22.data["detail"]),
            "Chứng từ tham chiếu không hợp lệ hoặc bạn không có quyền truy cập.",
        )

        # EF23: Lỗi tải danh sách chứng từ tham chiếu
        ef23 = self.client.post(
            list_url,
            {"company": str(self.company.id), "simulate_reference_load_error": True},
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(
            str(ef23.data["detail"]),
            "Không thể tải danh sách chứng từ tham chiếu. Vui lòng thử lại.",
        )

        # EF24: Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB
        ef24 = self.client.post(
            url,
            {**base_payload, "attachments": [{"file_name": "oversize.pdf", "file_size": 6 * 1024 * 1024}]},
            format="json",
        )
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(
            str(ef24.data["detail"]),
            "Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.",
        )

        # EF25: Số lượng CCDC đã thay đổi trước khi cất
        ef25 = self.client.post(
            url,
            {**base_payload, "source_data_stale": True},
            format="json",
        )
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(
            str(ef25.data["detail"]),
            "Số lượng CCDC đã thay đổi. Vui lòng tải lại dữ liệu trước khi cất.",
        )

        # EF27: Lỗi hệ thống khi lưu biên bản điều chuyển
        ef27 = self.client.post(
            url,
            {**base_payload, "simulate_save_error": True},
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(
            str(ef27.data["detail"]),
            "Ghi nhận điều chuyển CCDC thất bại. Vui lòng thử lại.",
        )

        # EF28: Lỗi tạo bản in sau khi lưu biên bản tại Cất và In (biên bản vẫn được lưu)
        ef28 = self.client.post(
            url,
            {**base_payload, "voucher_no": "ĐCCC-PRINTERR", "print_on_save": True, "simulate_print_error": True},
            format="json",
        )
        self.assertEqual(ef28.status_code, 201)
        self.assertEqual(ef28.data["print_status"], "ERROR")
        self.assertEqual(ef28.data["message"], "Biên bản đã được lưu nhưng chưa thể tạo bản in.")

        # EF03: Trùng Biên bản giao nhận số (ĐCCC-PRINTERR đã tồn tại)
        ef03 = self.client.post(
            url,
            {**base_payload, "voucher_no": "ĐCCC-PRINTERR"},
            format="json",
        )
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["detail"]), "Số biên bản giao nhận đã tồn tại. Vui lòng sử dụng số khác.")

        # EF29: Không thể hủy hoặc sửa biên bản vì đã phát sinh chứng từ phụ thuộc
        ef29 = self.client.post(
            cancel_url,
            {"company": str(self.company.id), "voucher_no": "ĐCCC-PRINTERR", "has_dependent_vouchers": True},
            format="json",
        )
        self.assertEqual(ef29.status_code, 400)
        self.assertEqual(
            str(ef29.data["detail"]),
            "Không thể hủy hoặc sửa biên bản vì đã phát sinh chứng từ phụ thuộc. Vui lòng xử lý các chứng từ liên quan.",
        )

        # EF01: Người dùng không có quyền lập chứng từ điều chuyển CCDC
        no_perm_user = get_user_model().objects.create_user(username="no-uc13-perm", email="nouc13@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(url, base_payload, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền lập hoặc ghi nhận chứng từ điều chuyển CCDC.")

    # ==========================================================================
    # UC-FA-14: GHI GIẢM CCDC / CHI PHÍ TRẢ TRƯỚC
    # ==========================================================================

    def test_uc_fa_14_main_flow_a_tool_decrease_examples_4_7_and_4_8(self):
        """
        UC-FA-14 Main Flow A (Steps 1–31), Example 4.7 (partial CCDC decrease),
        Example 4.8 (already 100% allocated CCDC decrease with 0 value),
        AF03–AF14, AF21 (Cất và In), AF25 (Cancel/Restore), and UC-FA-12 integration.
        """
        from datetime import date
        from organization.models import Department
        from .models import AssetStatus, AssetType

        actor = services._resolve_user_account(self.maker)
        acc_242, _ = Account.objects.get_or_create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="242",
            defaults={
                "account_class": self.accounts[0].account_class,
                "name": "Chi phí trả trước",
                "account_type": "ASSET",
                "normal_balance": "DEBIT",
            },
        )
        dept_sx, _ = Department.objects.get_or_create(
            company=self.company,
            code="PX_SX",
            defaults={"branch": self.branch, "name": "Phân xưởng Sản xuất", "status": "ACTIVE"},
        )

        # Example 4.7: 10 bộ, Nguyên giá 20.000.000, Đã phân bổ 12.000.000, Còn lại 8.000.000, Ghi giảm 3 bộ
        tool_ex1 = AssetRecord.objects.create(
            company=self.company,
            branch=self.branch,
            department=dept_sx,
            code="CCDC-UC14-EX1",
            name="Bộ dụng cụ cơ khí đồng nhất",
            asset_type=AssetType.TOOL,
            category_id=self.tool_category,
            quantity=Decimal("10"),
            acquisition_date=date(2026, 1, 1),
            in_service_date=date(2026, 1, 1),
            original_cost=Decimal("20000000.00"),
            allocated_value=Decimal("12000000.00"),
            useful_life_periods=10,
            periods_processed=6,
            asset_account=acc_242,
            status=AssetStatus.ACTIVE,
            components=[
                {
                    "line_no": 1,
                    "department_id": str(dept_sx.id),
                    "department_code": dept_sx.code,
                    "department_name": dept_sx.name,
                    "quantity": "10",
                }
            ],
            allocations=[
                {
                    "line_no": 1,
                    "target_code": dept_sx.code,
                    "target_name": dept_sx.name,
                    "rate": "100.00",
                    "expense_account_code": self.expense_account.code,
                }
            ],
            accessories=[{"unit": "Bộ"}],
            created_by=actor,
        )

        # Example 4.8: CCDC đã phân bổ hết (Nguyên giá 5.000.000, Đã phân bổ 5.000.000, Còn lại 0, Số lượng 1 chiếc)
        tool_ex2 = AssetRecord.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.department,
            code="CCDC-UC14-EX2",
            name="Máy khoan cầm tay đã phân bổ hết",
            asset_type=AssetType.TOOL,
            category_id=self.tool_category,
            quantity=Decimal("1"),
            acquisition_date=date(2025, 1, 1),
            in_service_date=date(2025, 1, 1),
            original_cost=Decimal("5000000.00"),
            allocated_value=Decimal("5000000.00"),
            useful_life_periods=12,
            periods_processed=12,
            asset_account=acc_242,
            status=AssetStatus.ACTIVE,
            components=[
                {
                    "line_no": 1,
                    "department_id": str(self.department.id),
                    "department_code": self.department.code,
                    "department_name": self.department.name,
                    "quantity": "1",
                }
            ],
            allocations=[
                {
                    "line_no": 1,
                    "target_code": self.department.code,
                    "target_name": self.department.name,
                    "rate": "100.00",
                    "expense_account_code": self.expense_account.code,
                }
            ],
            accessories=[{"unit": "Chiếc"}],
            created_by=actor,
        )

        # Step 5 & 8: Check next voucher number & disposable tools list
        next_res = self.client.get(f"/api/v1/fixed-assets/assets/next-tool-decrease-number/?company_id={self.company.id}")
        self.assertEqual(next_res.status_code, 200)
        self.assertEqual(next_res.data["voucher_no"], "GGCC00001")

        disp_list = self.client.get(
            f"/api/v1/fixed-assets/assets/disposable-tools/?company_id={self.company.id}&voucher_date=2026-07-15"
        )
        self.assertEqual(disp_list.status_code, 200)
        ex1_row = next(r for r in disp_list.data["items"] if r["code"] == "CCDC-UC14-EX1")
        self.assertEqual(ex1_row["in_use_quantity"], "10")
        self.assertEqual(ex1_row["remaining_value"], "8000000.00")

        # Execute Example 4.7: Decrease 3 bộ out of 10 bộ -> system calculates 8.000.000 * 3 / 10 = 2.400.000 VND
        save_res = self.client.post(
            "/api/v1/fixed-assets/assets/decrease-tools/",
            {
                "company": str(self.company.id),
                "voucher_no": "GGCC00001",
                "voucher_date": "2026-07-15",
                "reason": "Nhượng bán, Thanh lý",
                "idempotency_key": "UC14-EX47-KEY",
                "lines": [
                    {
                        "code": "CCDC-UC14-EX1",
                        "department_code": "PX_SX",
                        "decrease_quantity": 3,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(save_res.status_code, 201, save_res.data)
        self.assertEqual(save_res.data["voucher_no"], "GGCC00001")
        self.assertEqual(save_res.data["total_in_use_quantity"], "10")
        self.assertEqual(save_res.data["total_decrease_quantity"], "3")
        self.assertEqual(save_res.data["total_decrease_remaining_value"], "2400000.00")
        self.assertEqual(save_res.data["lines"][0]["remaining_quantity"], "7")
        self.assertEqual(save_res.data["lines"][0]["remaining_value_after"], "5600000.00")
        self.assertEqual(save_res.data["message"], "Đã lưu chứng từ ghi giảm CCDC GGCC00001 thành công.")

        # EF33: Duplicate submit with same idempotency_key replays without decreasing again
        replay_res = self.client.post(
            "/api/v1/fixed-assets/assets/decrease-tools/",
            {
                "company": str(self.company.id),
                "voucher_no": "GGCC00001",
                "voucher_date": "2026-07-15",
                "reason": "Nhượng bán, Thanh lý",
                "idempotency_key": "UC14-EX47-KEY",
                "lines": [{"code": "CCDC-UC14-EX1", "department_code": "PX_SX", "decrease_quantity": 3}],
            },
            format="json",
        )
        self.assertEqual(replay_res.status_code, 200)
        self.assertTrue(replay_res.data["idempotent_replayed"])

        tool_ex1.refresh_from_db()
        self.assertEqual(tool_ex1.quantity, Decimal("7"))
        self.assertEqual(tool_ex1.allocated_value, Decimal("12000000.00"))  # BR32: prior allocated value preserved
        self.assertEqual(tool_ex1.remaining_value, Decimal("5600000.00"))  # Formula 4.4: 8.000.000 - 2.400.000 = 5.600.000

        # Verify UC-FA-12 next period allocation uses 5.600.000 VND as opening_remaining_amount (BR18)
        calc_uc12 = self.client.post(
            "/api/v1/fixed-assets/assets/calculate-allocation/",
            {
                "company": str(self.company.id),
                "allocation_type": "TOOL",
                "month": 8,
                "year": 2026,
                "item_ids": [str(tool_ex1.id)],
            },
            format="json",
        )
        self.assertEqual(calc_uc12.status_code, 200, calc_uc12.data)
        self.assertEqual(calc_uc12.data["identify_rows"][0]["opening_remaining_amount"], "5600000.00")
        self.assertEqual(calc_uc12.data["identify_rows"][0]["total_allocation_amount"], "1400000.00")  # 5.600.000 / 4 remaining periods

        # Execute Example 4.8 (AF13 & BR17 & AF21 Cất và In): CCDC already fully allocated (remaining = 0)
        save_ex2 = self.client.post(
            "/api/v1/fixed-assets/assets/decrease-tools/",
            {
                "company": str(self.company.id),
                "voucher_no": "GGCC00002",
                "voucher_date": "2026-07-20",
                "reason": "Hư hỏng không thể sửa chữa",
                "print_on_save": True,
                "lines": [
                    {
                        "code": "CCDC-UC14-EX2",
                        "decrease_quantity": 1,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(save_ex2.status_code, 201, save_ex2.data)
        self.assertEqual(save_ex2.data["total_decrease_remaining_value"], "0.00")
        self.assertEqual(save_ex2.data["print_status"], "READY")
        self.assertFalse(save_ex2.data["gl_posted"])

        tool_ex2.refresh_from_db()
        self.assertEqual(tool_ex2.status, AssetStatus.DISPOSED)
        self.assertEqual(tool_ex2.accessories[0]["in_use_quantity"], "0")
        self.assertEqual(tool_ex2.remaining_value, Decimal("0.00"))

        # AF25 & BR40: Cancel GGCC00001 and verify quantity & remaining value are restored
        cancel_res = self.client.post(
            "/api/v1/fixed-assets/assets/cancel-tool-decrease/",
            {"company": str(self.company.id), "voucher_no": "GGCC00001"},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, 200, cancel_res.data)
        tool_ex1.refresh_from_db()
        self.assertEqual(tool_ex1.quantity, Decimal("10"))
        self.assertEqual(tool_ex1.remaining_value, Decimal("8000000.00"))

    def test_uc_fa_14_main_flow_b_prepaid_decrease_example_4_9_and_treatments(self):
        """
        UC-FA-14 Main Flow B (Steps 1–26), Example 4.9 (partial CPTT decrease: 120M -> allocated 50M -> remaining 70M -> decrease 20M -> remaining 50M),
        AF15–AF19, AF22 (Cất keeps form open and prevents duplicate deduction), AF25 (Cancel/Restore), and UC-FA-12 integration.
        """
        from datetime import date
        from general_ledger.models import PrepaidExpense, PrepaidExpenseTarget

        actor = services._resolve_user_account(self.maker)
        acc_242, _ = Account.objects.get_or_create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="242",
            defaults={
                "account_class": self.accounts[0].account_class,
                "name": "Chi phí trả trước",
                "account_type": "ASSET",
                "normal_balance": "DEBIT",
            },
        )

        prepaid = PrepaidExpense.objects.create(
            company=self.company,
            code="CPTT-UC14-EX3",
            name="Chi phí thuê văn phòng 12 tháng",
            record_date=date(2026, 1, 1),
            start_date=date(2026, 1, 1),
            amount=Decimal("120000000.00"),
            allocation_periods=12,
            prepaid_account=acc_242,
            allocated_amount=Decimal("50000000.00"),
            allocated_periods=5,
            status=PrepaidExpense.Status.ACTIVE,
            created_by=actor,
        )
        PrepaidExpenseTarget.objects.create(
            prepaid=prepaid,
            line_no=1,
            expense_account=self.expense_account,
            rate=Decimal("100.0000"),
            description="Phòng Hành chính",
        )

        # Check next voucher number & disposable prepaid list
        next_res = self.client.get(f"/api/v1/fixed-assets/assets/next-prepaid-decrease-number/?company_id={self.company.id}")
        self.assertEqual(next_res.status_code, 200)
        self.assertEqual(next_res.data["voucher_no"], "GGCP00001")

        disp_list = self.client.get(
            f"/api/v1/fixed-assets/assets/disposable-prepaid-expenses/?company_id={self.company.id}&voucher_date=2026-06-15"
        )
        self.assertEqual(disp_list.status_code, 200)
        p_row = next(r for r in disp_list.data["items"] if r["code"] == "CPTT-UC14-EX3")
        self.assertEqual(p_row["remaining_amount"], "70000000.00")
        self.assertEqual(p_row["proposed_decrease_amount"], "70000000.00")

        # Example 4.9 & AF16 & AF22: Partial decrease of 20.000.000 VND using Cất (keep_open=True)
        save_res = self.client.post(
            "/api/v1/fixed-assets/assets/decrease-prepaid-expenses/",
            {
                "company": str(self.company.id),
                "voucher_no": "GGCP00001",
                "voucher_date": "2026-06-15",
                "reason": "Điều chỉnh giảm diện tích thuê văn phòng từ tháng 06/2026",
                "keep_open": True,
                "lines": [
                    {
                        "code": "CPTT-UC14-EX3",
                        "decrease_amount": "20000000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(save_res.status_code, 201, save_res.data)
        self.assertEqual(save_res.data["voucher_no"], "GGCP00001")
        self.assertEqual(save_res.data["total_decrease_amount"], "20000000.00")
        self.assertEqual(save_res.data["lines"][0]["remaining_before"], "70000000.00")
        self.assertEqual(save_res.data["lines"][0]["remaining_after"], "50000000.00")
        self.assertTrue(save_res.data["keep_open"])
        self.assertFalse(save_res.data["close_on_save"])
        self.assertEqual(save_res.data["message"], "Đã lưu chứng từ ghi giảm chi phí trả trước GGCP00001 thành công.")

        # AF22: Clicking Cất again while form stays open does NOT decrease another 20.000.000 VND
        resave_res = self.client.post(
            "/api/v1/fixed-assets/assets/decrease-prepaid-expenses/",
            {
                "company": str(self.company.id),
                "voucher_no": "GGCP00001",
                "voucher_date": "2026-06-15",
                "reason": "Điều chỉnh giảm diện tích thuê văn phòng từ tháng 06/2026",
                "allow_idempotent_voucher_resave": True,
                "keep_open": False,
                "lines": [
                    {
                        "code": "CPTT-UC14-EX3",
                        "decrease_amount": "20000000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resave_res.status_code, 200)
        self.assertTrue(resave_res.data["idempotent_replayed"])

        prepaid.refresh_from_db()
        self.assertEqual(prepaid.amount, Decimal("120000000.00"))
        self.assertEqual(prepaid.allocated_amount, Decimal("50000000.00"))  # BR32: prior allocated_amount preserved
        self.assertEqual(prepaid.remaining_amount, Decimal("50000000.00"))  # Formula 4.5: 70M - 20M = 50M
        self.assertEqual(prepaid.status, PrepaidExpense.Status.ACTIVE)

        # Verify UC-FA-12 next period allocation uses 50.000.000 VND as opening_remaining_amount (BR28)
        calc_uc12 = self.client.post(
            "/api/v1/fixed-assets/assets/calculate-allocation/",
            {
                "company": str(self.company.id),
                "allocation_type": "PREPAID",
                "month": 7,
                "year": 2026,
                "prepaid_ids": [str(prepaid.id)],
            },
            format="json",
        )
        self.assertEqual(calc_uc12.status_code, 200, calc_uc12.data)
        self.assertEqual(calc_uc12.data["identify_rows"][0]["opening_remaining_amount"], "50000000.00")

        # AF15 & AF17 & BR27 & BR29: Full decrease of remaining 50.000.000 VND with REFUND_OR_RECEIVABLE treatment
        full_dec_res = self.client.post(
            "/api/v1/fixed-assets/assets/decrease-prepaid-expenses/",
            {
                "company": str(self.company.id),
                "voucher_no": "GGCP00002",
                "voucher_date": "2026-06-25",
                "reason": "Chấm dứt hợp đồng sớm, nhà cung cấp hoàn tiền",
                "accounting_treatment": "REFUND_OR_RECEIVABLE",
                "refund_account": "1388",
                "lines": [
                    {
                        "code": "CPTT-UC14-EX3",
                        "decrease_amount": "50000000.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(full_dec_res.status_code, 201, full_dec_res.data)
        prepaid.refresh_from_db()
        self.assertEqual(prepaid.remaining_amount, Decimal("0.00"))
        self.assertEqual(prepaid.status, PrepaidExpense.Status.DECREASED)

        # AF25 & BR40: Cancel GGCP00002 and verify remaining_amount returns to 50.000.000 VND and status returns to ACTIVE
        cancel_res = self.client.post(
            "/api/v1/fixed-assets/assets/cancel-prepaid-decrease/",
            {"company": str(self.company.id), "voucher_no": "GGCP00002"},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, 200, cancel_res.data)
        prepaid.refresh_from_db()
        self.assertEqual(prepaid.remaining_amount, Decimal("50000000.00"))
        self.assertEqual(prepaid.status, PrepaidExpense.Status.ACTIVE)

    def test_uc_fa_14_exceptions_ef01_to_ef36(self):
        """
        Verifies all UC-FA-14 exception flows EF01 through EF36 with exact Vietnamese messages.
        """
        from datetime import date
        from general_ledger.models import PrepaidExpense, PrepaidExpenseTarget
        from .models import AssetStatus, AssetType

        actor = services._resolve_user_account(self.maker)
        acc_242, _ = Account.objects.get_or_create(
            company=self.company,
            chart_of_accounts=self.coa,
            code="242",
            defaults={
                "account_class": self.accounts[0].account_class,
                "name": "Chi phí trả trước",
                "account_type": "ASSET",
                "normal_balance": "DEBIT",
            },
        )

        tool = AssetRecord.objects.create(
            company=self.company,
            branch=self.branch,
            department=self.department,
            code="CCDC-UC14-ERR",
            name="Bàn làm việc nhân viên",
            asset_type=AssetType.TOOL,
            category_id=self.tool_category,
            quantity=Decimal("5"),
            acquisition_date=date(2026, 2, 1),
            in_service_date=date(2026, 2, 1),
            original_cost=Decimal("10000000.00"),
            allocated_value=Decimal("2000000.00"),
            useful_life_periods=10,
            periods_processed=2,
            asset_account=acc_242,
            status=AssetStatus.ACTIVE,
            components=[
                {
                    "line_no": 1,
                    "department_id": str(self.department.id),
                    "department_code": self.department.code,
                    "department_name": self.department.name,
                    "quantity": "5",
                }
            ],
            accessories=[{"unit": "Cái"}],
            created_by=actor,
        )

        prepaid = PrepaidExpense.objects.create(
            company=self.company,
            code="CPTT-UC14-ERR",
            name="Bảo hiểm tài sản",
            record_date=date(2026, 2, 1),
            start_date=date(2026, 2, 1),
            amount=Decimal("24000000.00"),
            allocation_periods=12,
            prepaid_account=acc_242,
            allocated_amount=Decimal("4000000.00"),
            allocated_periods=2,
            status=PrepaidExpense.Status.ACTIVE,
            created_by=actor,
        )
        PrepaidExpenseTarget.objects.create(
            prepaid=prepaid,
            line_no=1,
            expense_account=self.expense_account,
            rate=Decimal("100.0000"),
            description="Quản lý",
        )

        tool_url = "/api/v1/fixed-assets/assets/decrease-tools/"
        prepaid_url = "/api/v1/fixed-assets/assets/decrease-prepaid-expenses/"
        cancel_url = "/api/v1/fixed-assets/assets/cancel-tool-decrease/"

        base_tool_payload = {
            "company": str(self.company.id),
            "voucher_no": "GGCC-ERR01",
            "voucher_date": "2026-06-15",
            "reason": "Nhượng bán, Thanh lý",
            "lines": [
                {
                    "code": "CCDC-UC14-ERR",
                    "decrease_quantity": 1,
                }
            ],
        }
        base_prepaid_payload = {
            "company": str(self.company.id),
            "voucher_no": "GGCP-ERR01",
            "voucher_date": "2026-06-15",
            "reason": "Thanh lý hợp đồng bảo hiểm",
            "lines": [
                {
                    "code": "CPTT-UC14-ERR",
                    "decrease_amount": "5000000.00",
                }
            ],
        }

        # EF02: Số chứng từ để trống
        ef02 = self.client.post(tool_url, {**base_tool_payload, "voucher_no": ""}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["detail"]), "Vui lòng nhập số chứng từ.")

        # EF03: Số chứng từ bị trùng
        ef03 = self.client.post(tool_url, {**base_tool_payload, "force_duplicate_voucher_no": True}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["detail"]), "Số chứng từ đã tồn tại. Vui lòng sử dụng số khác.")

        # EF04: Ngày chứng từ để trống hoặc sai định dạng
        ef04 = self.client.post(tool_url, {**base_tool_payload, "voucher_date": "31/02/2026"}, format="json")
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["detail"]), "Vui lòng nhập ngày chứng từ hợp lệ.")

        # EF05: Ngày ghi giảm thuộc kỳ kế toán đã khóa
        ef05 = self.client.post(tool_url, {**base_tool_payload, "period_locked": True}, format="json")
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["detail"]), "Kỳ kế toán đã khóa, không thể ghi giảm trong kỳ này.")

        # EF06: Chưa chọn Lý do ghi giảm CCDC
        ef06 = self.client.post(tool_url, {**base_tool_payload, "reason": ""}, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["detail"]), "Vui lòng chọn lý do ghi giảm CCDC.")

        # EF07: Lý do ghi giảm chi phí trả trước để trống
        ef07 = self.client.post(prepaid_url, {**base_prepaid_payload, "reason": ""}, format="json")
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["detail"]), "Vui lòng nhập lý do ghi giảm chi phí trả trước.")

        # EF08: Không có dòng đối tượng hợp lệ
        ef08 = self.client.post(tool_url, {**base_tool_payload, "lines": []}, format="json")
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(
            str(ef08.data["detail"]),
            "Vui lòng chọn ít nhất một CCDC hoặc khoản chi phí trả trước cần ghi giảm.",
        )

        # EF09: CCDC chưa ghi tăng hợp lệ hoặc không tồn tại
        ef09 = self.client.post(
            tool_url,
            {**base_tool_payload, "lines": [{"code": "CCDC-KHONG-TON-TAI", "decrease_quantity": 1}]},
            format="json",
        )
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(
            str(ef09.data["detail"]),
            "CCDC CCDC-KHONG-TON-TAI không tồn tại hoặc chưa được ghi nhận hợp lệ.",
        )

        # EF10: CCDC không còn tại đơn vị sử dụng được xác định
        ef10 = self.client.post(
            tool_url,
            {**base_tool_payload, "lines": [{"code": "CCDC-UC14-ERR", "department_code": "PHONG_KHAC", "decrease_quantity": 1}]},
            format="json",
        )
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["detail"]), "CCDC CCDC-UC14-ERR không còn số lượng tại đơn vị sử dụng.")

        # EF11: Số lượng ghi giảm bằng 0 hoặc âm
        ef11 = self.client.post(
            tool_url,
            {**base_tool_payload, "lines": [{"code": "CCDC-UC14-ERR", "decrease_quantity": 0}]},
            format="json",
        )
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["detail"]), "Số lượng ghi giảm phải lớn hơn 0.")

        # EF12: Số lượng ghi giảm vượt số lượng khả dụng
        ef12 = self.client.post(
            tool_url,
            {**base_tool_payload, "lines": [{"code": "CCDC-UC14-ERR", "decrease_quantity": 6}]},
            format="json",
        )
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["detail"]), "Số lượng ghi giảm vượt số lượng CCDC đang dùng.")

        # EF13: Số lượng không phù hợp đơn vị tính (1.5 cái)
        ef13 = self.client.post(
            tool_url,
            {**base_tool_payload, "lines": [{"code": "CCDC-UC14-ERR", "decrease_quantity": "1.5"}]},
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["detail"]), "Số lượng ghi giảm không phù hợp với đơn vị tính CCDC.")

        # EF14: Tổng số lượng ghi giảm của cùng CCDC tại cùng đơn vị vượt số lượng khả dụng
        ef14 = self.client.post(
            tool_url,
            {
                **base_tool_payload,
                "lines": [
                    {"code": "CCDC-UC14-ERR", "decrease_quantity": 3},
                    {"code": "CCDC-UC14-ERR", "decrease_quantity": 3},
                ],
            },
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(str(ef14.data["detail"]), "Tổng số lượng ghi giảm của CCDC-UC14-ERR vượt số lượng khả dụng.")

        # EF15: Giá trị còn lại của CCDC ghi giảm âm
        ef15 = self.client.post(
            tool_url,
            {
                **base_tool_payload,
                "lines": [{"code": "CCDC-UC14-ERR", "decrease_quantity": 1, "decrease_remaining_value": "-1000"}],
            },
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(str(ef15.data["detail"]), "Giá trị còn lại của CCDC ghi giảm không được âm.")

        # EF16: Giá trị ghi giảm lớn hơn giá trị chưa phân bổ hợp lệ của phần CCDC giảm
        ef16 = self.client.post(
            tool_url,
            {
                **base_tool_payload,
                "lines": [{"code": "CCDC-UC14-ERR", "decrease_quantity": 1, "decrease_remaining_value": "5000000"}],
            },
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(str(ef16.data["detail"]), "Giá trị ghi giảm vượt giá trị còn lại hợp lệ của CCDC.")

        # EF17: User nhập giá trị khác hệ thống tính nhưng không có quyền hoặc căn cứ điều chỉnh
        ef17 = self.client.post(
            tool_url,
            {
                **base_tool_payload,
                "lines": [{"code": "CCDC-UC14-ERR", "decrease_quantity": 1, "decrease_remaining_value": "1200000"}],
            },
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(
            str(ef17.data["detail"]),
            "Giá trị ghi giảm khác giá trị được xác định từ sổ theo dõi. Vui lòng kiểm tra hoặc cung cấp căn cứ điều chỉnh.",
        )

        # EF18: Chọn Nhập lại kho nhưng chưa có phương án hoặc chứng từ nhập kho cần thiết
        ef18 = self.client.post(
            tool_url,
            {
                **base_tool_payload,
                "reason": "Nhập lại kho CCDC không sử dụng",
                "missing_warehouse_receipt": True,
            },
            format="json",
        )
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(
            str(ef18.data["detail"]),
            "Vui lòng hoàn thiện chứng từ nhập lại kho CCDC trước khi hoàn tất ghi giảm.",
        )

        # EF19: Chọn Phát hiện thiếu khi kiểm kê nhưng thiếu biên bản hoặc căn cứ xử lý bắt buộc
        ef19 = self.client.post(
            tool_url,
            {
                **base_tool_payload,
                "reason": "Phát hiện thiếu khi kiểm kê",
                "missing_stocktake_basis": True,
            },
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(
            str(ef19.data["detail"]),
            "Vui lòng bổ sung căn cứ kiểm kê và phương án xử lý CCDC thiếu.",
        )

        # EF20: CPTT không tồn tại hoặc chưa được ghi nhận hợp lệ
        ef20 = self.client.post(
            prepaid_url,
            {**base_prepaid_payload, "lines": [{"code": "CPTT-KHONG-TON-TAI", "decrease_amount": "1000000"}]},
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(str(ef20.data["detail"]), "Khoản chi phí trả trước không hợp lệ.")

        # EF21: CPTT đã giảm hết hoặc không còn giá trị chưa phân bổ
        prepaid_zero = PrepaidExpense.objects.create(
            company=self.company,
            code="CPTT-ZERO",
            name="CPTT đã phân bổ hết",
            record_date=date(2025, 1, 1),
            start_date=date(2025, 1, 1),
            amount=Decimal("6000000.00"),
            allocation_periods=6,
            prepaid_account=acc_242,
            allocated_amount=Decimal("6000000.00"),
            allocated_periods=6,
            status=PrepaidExpense.Status.COMPLETED,
            created_by=actor,
        )
        ef21 = self.client.post(
            prepaid_url,
            {**base_prepaid_payload, "lines": [{"code": prepaid_zero.code, "decrease_amount": "1000000"}]},
            format="json",
        )
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(str(ef21.data["detail"]), "Khoản chi phí trả trước không còn giá trị để ghi giảm.")

        # EF22: Số tiền ghi giảm CPTT bằng 0 hoặc âm
        ef22 = self.client.post(
            prepaid_url,
            {**base_prepaid_payload, "lines": [{"code": "CPTT-UC14-ERR", "decrease_amount": "0"}]},
            format="json",
        )
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(str(ef22.data["detail"]), "Số tiền ghi giảm phải lớn hơn 0.")

        # EF23: Số tiền ghi giảm CPTT vượt giá trị còn lại hợp lệ (20.000.000)
        ef23 = self.client.post(
            prepaid_url,
            {**base_prepaid_payload, "lines": [{"code": "CPTT-UC14-ERR", "decrease_amount": "25000000"}]},
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(str(ef23.data["detail"]), "Số tiền ghi giảm vượt số tiền chưa phân bổ của khoản chi phí.")

        # EF24: Cùng một CPTT xuất hiện nhiều dòng, tổng tiền ghi giảm vượt giá trị còn lại
        ef24 = self.client.post(
            prepaid_url,
            {
                **base_prepaid_payload,
                "lines": [
                    {"code": "CPTT-UC14-ERR", "decrease_amount": "12000000"},
                    {"code": "CPTT-UC14-ERR", "decrease_amount": "12000000"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(str(ef24.data["detail"]), "Tổng số tiền ghi giảm của CPTT-UC14-ERR vượt giá trị còn lại.")

        # EF25: Phần số lượng hoặc giá trị đã bị ghi giảm ở chứng từ khác
        ef25 = self.client.post(
            tool_url,
            {**base_tool_payload, "already_disposed_elsewhere": True},
            format="json",
        )
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(str(ef25.data["detail"]), "Đối tượng đã được ghi giảm tại chứng từ khác. Vui lòng tải lại dữ liệu.")

        # EF26: Giá trị đã phân bổ hoặc giá trị còn lại không nhất quán với sổ theo dõi
        ef26 = self.client.post(
            tool_url,
            {**base_tool_payload, "simulate_history_inconsistent": True},
            format="json",
        )
        self.assertEqual(ef26.status_code, 400)
        self.assertEqual(str(ef26.data["detail"]), "Giá trị còn lại của CCDC-UC14-ERR chưa khớp với lịch sử phân bổ.")

        # EF27: Ghi giảm lùi ngày làm sai kết quả phân bổ hoặc số lượng của các chứng từ đã ghi sổ sau đó
        ef27 = self.client.post(
            tool_url,
            {**base_tool_payload, "simulate_backdated_conflict": True},
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(
            str(ef27.data["detail"]),
            "Ngày ghi giảm ảnh hưởng đến các chứng từ phát sinh sau ngày này. Vui lòng kiểm tra lịch sử liên quan.",
        )

        # EF28: Chưa xác định được phương án xử lý giá trị còn lại
        ef28 = self.client.post(
            tool_url,
            {**base_tool_payload, "missing_accounting_treatment": True},
            format="json",
        )
        self.assertEqual(ef28.status_code, 400)
        self.assertEqual(
            str(ef28.data["detail"]),
            "Chưa có phương án xử lý giá trị còn lại. Vui lòng bổ sung chứng từ hoặc quyết định xử lý.",
        )

        # EF29: Giá trị đã được hạch toán tại chứng từ khác
        ef29 = self.client.post(
            tool_url,
            {**base_tool_payload, "already_accounted_elsewhere": True},
            format="json",
        )
        self.assertEqual(ef29.status_code, 400)
        self.assertEqual(
            str(ef29.data["detail"]),
            "Giá trị ghi giảm đã được xử lý kế toán ở chứng từ liên quan.",
        )

        # EF30: Chứng từ tham chiếu không hợp lệ, đã hủy hoặc ngoài quyền truy cập
        ef30 = self.client.post(
            tool_url,
            {**base_tool_payload, "references": [{"voucher_no": "REF-CANCELLED", "status": "CANCELLED"}]},
            format="json",
        )
        self.assertEqual(ef30.status_code, 400)
        self.assertEqual(
            str(ef30.data["detail"]),
            "Chứng từ tham chiếu không hợp lệ hoặc bạn không có quyền truy cập.",
        )

        # EF31: Tệp đính kèm không hợp lệ hoặc vượt giới hạn 5MB
        ef31 = self.client.post(
            tool_url,
            {**base_tool_payload, "attachments": [{"file_name": "bien_ban.pdf", "file_size": 6 * 1024 * 1024}]},
            format="json",
        )
        self.assertEqual(ef31.status_code, 400)
        self.assertEqual(
            str(ef31.data["detail"]),
            "Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.",
        )

        # EF32: Dữ liệu số lượng hoặc giá trị thay đổi do User khác ghi nhận trước
        ef32 = self.client.post(
            tool_url,
            {
                **base_tool_payload,
                "lines": [{"code": "CCDC-UC14-ERR", "decrease_quantity": 1, "expected_in_use_quantity": 99}],
            },
            format="json",
        )
        self.assertEqual(ef32.status_code, 400)
        self.assertEqual(
            str(ef32.data["detail"]),
            "Dữ liệu ghi giảm đã thay đổi. Vui lòng tải lại và kiểm tra trước khi cất.",
        )

        # EF34: Không thể hoàn tất cập nhật chứng từ, sổ theo dõi và bút toán liên quan một cách nhất quán
        ef34 = self.client.post(
            tool_url,
            {**base_tool_payload, "simulate_save_error": True},
            format="json",
        )
        self.assertEqual(ef34.status_code, 400)
        self.assertEqual(str(ef34.data["detail"]), "Ghi nhận chứng từ ghi giảm thất bại. Vui lòng thử lại.")

        # EF35: Chứng từ đã lưu nhưng in thất bại tại Cất và In
        ef35 = self.client.post(
            tool_url,
            {**base_tool_payload, "voucher_no": "GGCC-PRINTERR", "print_on_save": True, "simulate_print_error": True},
            format="json",
        )
        self.assertEqual(ef35.status_code, 201)
        self.assertEqual(ef35.data["print_status"], "ERROR")
        self.assertEqual(ef35.data["message"], "Chứng từ đã được lưu nhưng chưa thể tạo bản in.")

        # EF36: Sửa/Hủy sau ghi sổ khi đã có chứng từ phụ thuộc
        ef36 = self.client.post(
            cancel_url,
            {"company": str(self.company.id), "voucher_no": "GGCC-PRINTERR", "has_dependent_vouchers": True},
            format="json",
        )
        self.assertEqual(ef36.status_code, 400)
        self.assertEqual(
            str(ef36.data["detail"]),
            "Không thể hủy hoặc sửa chứng từ vì đã phát sinh nghiệp vụ liên quan. Vui lòng xử lý chứng từ phụ thuộc trước.",
        )

        # EF01: User không có quyền ghi giảm CCDC hoặc chi phí trả trước
        no_perm_user = get_user_model().objects.create_user(username="no-uc14-perm", email="nouc14@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(tool_url, base_tool_payload, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền ghi giảm CCDC hoặc chi phí trả trước.")

    # =========================================================================
    # UC-FA-15: KIỂM KÊ CCDC (TOOLS & EQUIPMENT STOCKTAKE)
    # =========================================================================

    def _create_tool_for_uc14(
        self,
        code: str,
        name: str,
        qty: int | Decimal,
        orig_cost: str | Decimal,
        alloc_val: str | Decimal,
        dept,
        acq_date: date,
        status=AssetStatus.ACTIVE,
        unit: str = "Chiếc",
    ) -> AssetRecord:
        actor = services._resolve_user_account(self.maker)
        return AssetRecord.objects.create(
            company=self.company,
            branch=self.branch,
            department=dept,
            code=code,
            name=name,
            asset_type=AssetType.TOOL,
            category_id=self.tool_category,
            quantity=Decimal(str(qty)),
            acquisition_date=acq_date,
            in_service_date=acq_date,
            original_cost=Decimal(str(orig_cost)),
            allocated_value=Decimal(str(alloc_val)),
            useful_life_periods=10,
            periods_processed=0,
            status=status,
            components=[
                {
                    "line_no": 1,
                    "department_id": str(dept.id),
                    "department_code": dept.code,
                    "department_name": dept.name,
                    "quantity": str(qty),
                }
            ],
            allocations=[
                {
                    "line_no": 1,
                    "target_code": dept.code,
                    "target_name": dept.name,
                    "rate": "100.00",
                    "expense_account_code": self.expense_account.code,
                }
            ],
            accessories=[{"unit": unit}],
            created_by=actor,
        )

    def _default_uc15_committee(self):
        return [
            {
                "name": "Nguyễn Thị Mai",
                "title": "Kế toán trưởng",
                "department": "Phòng Kế toán",
                "role": "Trưởng ban",
            },
            {
                "name": "Trần Văn Bình",
                "title": "Trưởng phòng HC-NS",
                "department": "Phòng Hành chính",
                "role": "Ủy viên",
            },
            {
                "name": "Lê Hoàng Long",
                "title": "Chuyên viên kế toán",
                "department": "Phòng Kế toán",
                "role": "Thư ký",
            },
        ]

    def test_uc_fa_15_main_flow_example_4_6_and_zero_mutation(self):
        """
        UC-FA-15 Main Flow (Steps 1–33), Example 4.6 (CC001, CC002, CC003, CC004),
        AF04 (historical count_to_date ignores future transactions), AF10 (actual_quantity = 0),
        BR11 (actual_quantity is None until user confirms), BR18 (non-offsetting excess/shortage),
        BR33 & BR34 (saving stocktake never mutates book quantities, values, or GL), and BR35 (100% allocated CCDC).
        """
        from audit_log.models import AuditLog
        from general_ledger.models import JournalEntry
        from organization.models import Department

        dept_kt = self.department  # Phòng Kế toán
        dept_kd = self.department2  # Phòng Kinh doanh
        dept_hc = Department.objects.create(company=self.company, branch=self.branch, code="PHC", name="Phòng Hành chính")
        dept_sx = Department.objects.create(company=self.company, branch=self.branch, code="PXSX", name="Phân xưởng Sản xuất")

        # Create the 4 CCDC from Example 4.6:
        # CC001: Phòng Kế toán, SL sổ sách = 5
        cc001 = self._create_tool_for_uc14(
            code="CC001-UC15",
            name="Máy in Laser HP",
            qty=5,
            orig_cost="15000000.00",
            alloc_val="3000000.00",
            dept=dept_kt,
            acq_date=date(2026, 1, 10),
        )
        # CC002: Phòng Kinh doanh, SL sổ sách = 8
        cc002 = self._create_tool_for_uc14(
            code="CC002-UC15",
            name="Bộ bàn ghế làm việc",
            qty=8,
            orig_cost="24000000.00",
            alloc_val="6000000.00",
            dept=dept_kd,
            acq_date=date(2026, 2, 15),
        )
        # CC003: Phòng Hành chính, SL sổ sách = 3
        cc003 = self._create_tool_for_uc14(
            code="CC003-UC15",
            name="Máy chiếu hội trường Epson",
            qty=3,
            orig_cost="30000000.00",
            alloc_val="10000000.00",
            dept=dept_hc,
            acq_date=date(2026, 3, 1),
        )
        # CC004: Phân xưởng Sản xuất, SL sổ sách = 10, 100% allocated (remaining_value = 0) per BR35
        cc004 = self._create_tool_for_uc14(
            code="CC004-UC15",
            name="Máy khoan cầm tay Bosch",
            qty=10,
            orig_cost="20000000.00",
            alloc_val="20000000.00",
            dept=dept_sx,
            acq_date=date(2025, 6, 1),
        )
        self.assertEqual(cc004.remaining_value, Decimal("0.00"))

        # Steps 4–8: Validate Kiểm kê đến ngày (30/09/2026) and get proposed BBKK00001
        val_date_res = self.client.post(
            "/api/v1/fixed-assets/assets/validate-tool-stocktake-date/",
            {
                "company": str(self.company.id),
                "count_to_date": "30/09/2026",
                "current_date": "2026-10-21",
            },
            format="json",
        )
        self.assertEqual(val_date_res.status_code, 200, val_date_res.data)
        self.assertEqual(val_date_res.data["voucher_no"], "BBKK00001")
        self.assertEqual(val_date_res.data["count_to_date"], "30/09/2026")

        # Steps 11–13: Lấy toàn bộ CCDC đang dùng tại ngày 30/09/2026
        items_res = self.client.get(
            f"/api/v1/fixed-assets/assets/tool-stocktake-items/?company_id={self.company.id}&count_to_date=2026-09-30&current_date=2026-10-21"
        )
        self.assertEqual(items_res.status_code, 200, items_res.data)
        items_by_code = {it["code"]: it for it in items_res.data["items"]}
        self.assertIn("CC001-UC15", items_by_code)
        self.assertIn("CC002-UC15", items_by_code)
        self.assertIn("CC003-UC15", items_by_code)
        self.assertIn("CC004-UC15", items_by_code)  # BR35: 100% allocated tool still in use is included!
        # BR11: actual_quantity is None until user enters/confirms it
        self.assertIsNone(items_by_code["CC001-UC15"]["actual_quantity"])
        self.assertFalse(items_by_code["CC001-UC15"]["counted_confirmed"])

        gl_count_before = JournalEntry.objects.filter(company=self.company).count()

        # Steps 14–33 & Example 4.6: Save stocktake voucher BBKK00001
        save_res = self.client.post(
            "/api/v1/fixed-assets/assets/save-tool-stocktake/",
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK00001",
                "count_to_date": "30/09/2026",
                "current_date": "2026-10-21",
                "purpose": "Kiểm kê CCDC định kỳ Quý III/2026",
                "lines": [
                    {
                        "code": "CC001-UC15",
                        "department_code": dept_kt.code,
                        "expected_book_quantity": "5",
                        "actual_quantity": "5",
                    },
                    {
                        "code": "CC002-UC15",
                        "department_code": dept_kd.code,
                        "expected_book_quantity": "8",
                        "actual_quantity": "6",
                    },
                    {
                        "code": "CC003-UC15",
                        "department_code": dept_hc.code,
                        "expected_book_quantity": "3",
                        "actual_quantity": "4",
                    },
                    {
                        "code": "CC004-UC15",
                        "department_code": dept_sx.code,
                        "expected_book_quantity": "10",
                        "actual_quantity": "10",
                    },
                ],
                "committee": self._default_uc15_committee(),
                "attachments": [
                    {"name": "bien_ban_kiem_dem_q3.pdf", "size": 512000},
                ],
            },
            format="json",
        )
        self.assertEqual(save_res.status_code, 201, save_res.data)
        self.assertEqual(save_res.data["status"], "COMPLETED")
        self.assertEqual(save_res.data["status_display"], "Đã hoàn thành")
        self.assertEqual(save_res.data["message"], "Đã lưu biên bản kiểm kê CCDC BBKK00001 thành công.")

        # Verify Example 4.6 Totals (Formula 4.5, BR18, BR19):
        # Book = 26, Actual = 25, Excess = 1, Shortage = 2, Net Diff = -1
        self.assertEqual(save_res.data["total_book_quantity"], "26")
        self.assertEqual(save_res.data["total_actual_quantity"], "25")
        self.assertEqual(save_res.data["total_excess_quantity"], "1")
        self.assertEqual(save_res.data["total_shortage_quantity"], "2")
        self.assertEqual(save_res.data["net_difference"], "-1")

        # Verify proposed solutions on each line (Step 17, AF07–AF09):
        saved_lines_by_code = {ln["code"]: ln for ln in save_res.data["lines"]}
        self.assertEqual(saved_lines_by_code["CC001-UC15"]["solution"], "Khớp sổ sách")
        self.assertEqual(saved_lines_by_code["CC001-UC15"]["excess_quantity"], "0")
        self.assertEqual(saved_lines_by_code["CC001-UC15"]["shortage_quantity"], "0")

        self.assertEqual(saved_lines_by_code["CC002-UC15"]["solution"], "Lập chứng từ ghi giảm")
        self.assertEqual(saved_lines_by_code["CC002-UC15"]["excess_quantity"], "0")
        self.assertEqual(saved_lines_by_code["CC002-UC15"]["shortage_quantity"], "2")

        self.assertEqual(saved_lines_by_code["CC003-UC15"]["solution"], "Ghi tăng CCDC thừa")
        self.assertEqual(saved_lines_by_code["CC003-UC15"]["excess_quantity"], "1")
        self.assertEqual(saved_lines_by_code["CC003-UC15"]["shortage_quantity"], "0")

        self.assertEqual(saved_lines_by_code["CC004-UC15"]["solution"], "Khớp sổ sách")

        # Step 31, BR02, BR33, BR34: Verify zero mutation on AssetRecord quantities, values, and GL!
        for tool_obj, exp_qty, exp_orig, exp_alloc in (
            (cc001, Decimal("5"), Decimal("15000000.00"), Decimal("3000000.00")),
            (cc002, Decimal("8"), Decimal("24000000.00"), Decimal("6000000.00")),
            (cc003, Decimal("3"), Decimal("30000000.00"), Decimal("10000000.00")),
            (cc004, Decimal("10"), Decimal("20000000.00"), Decimal("20000000.00")),
        ):
            tool_obj.refresh_from_db()
            self.assertEqual(tool_obj.quantity, exp_qty)
            self.assertEqual(tool_obj.original_cost, exp_orig)
            self.assertEqual(tool_obj.allocated_value, exp_alloc)
        self.assertEqual(JournalEntry.objects.filter(company=self.company).count(), gl_count_before)

        # Step 32 & BR42: Verify Audit Log
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company,
                action_code="SAVE_TOOL_STOCKTAKE_UC15",
            ).exists()
        )

        # AF04 & BR05: Suppose CC001 has a decrease of 2 units on 15/10/2026 (after 30/09/2026),
        # querying stocktake items as of 30/09/2026 MUST still report SL sổ sách = 5 (not 3)!
        self.client.post(
            "/api/v1/fixed-assets/assets/decrease-tools/",
            {
                "company": str(self.company.id),
                "voucher_no": "GGCC-OCT15",
                "voucher_date": "2026-10-15",
                "reason": "Nhượng bán, Thanh lý",
                "lines": [{"code": "CC001-UC15", "department_code": dept_kt.code, "decrease_quantity": "2"}],
            },
            format="json",
        )
        past_items_res = self.client.get(
            f"/api/v1/fixed-assets/assets/tool-stocktake-items/?company_id={self.company.id}&count_to_date=2026-09-30&current_date=2026-10-21"
        )
        self.assertEqual(past_items_res.status_code, 200)
        past_cc001 = next(it for it in past_items_res.data["items"] if it["code"] == "CC001-UC15")
        self.assertEqual(past_cc001["book_quantity"], "5")  # Historical book quantity at 30/09/2026 preserved!

        # AF10 & BR12: SL thực tế = 0 is accepted as a valid counted quantity (shortage = full book_quantity)
        zero_res = self.client.post(
            "/api/v1/fixed-assets/assets/save-tool-stocktake/",
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK00002",
                "count_to_date": "20/10/2026",
                "current_date": "2026-10-21",
                "purpose": "Kiểm kê đột xuất tháng 10/2026",
                "lines": [
                    {
                        "code": "CC003-UC15",
                        "department_code": dept_hc.code,
                        "actual_quantity": 0,  # Explicitly 0
                    },
                ],
                "committee": self._default_uc15_committee(),
            },
            format="json",
        )
        self.assertEqual(zero_res.status_code, 201, zero_res.data)
        self.assertEqual(zero_res.data["lines"][0]["actual_quantity"], "0")
        self.assertEqual(zero_res.data["lines"][0]["shortage_quantity"], "3")
        self.assertEqual(zero_res.data["lines"][0]["solution"], "Lập chứng từ ghi giảm")

    def test_uc_fa_15_post_save_verification_approval_and_resolution_af18_to_af27(self):
        """
        Verifies UC-FA-15 AF11 & Example 4.7 (transfer discrepancy custom solution),
        AF17 (Cất và In), AF18 (all matched -> Không có chênh lệch),
        AF19–AF23 (verification -> approval -> resolution -> Đã xử lý chênh lệch),
        and AF24–AF27 (search/filter/export Excel without mutating book or count data).
        """
        dept_kt = self.department
        tool_printer = self._create_tool_for_uc14(
            code="CC-PRINTER-47",
            name="Máy in Canon LBP2900",
            qty=3,
            orig_cost="9000000.00",
            alloc_val="3000000.00",
            dept=dept_kt,
            acq_date=date(2026, 1, 15),
        )

        # AF18: All items match -> discrepancy_status = NO_DISCREPANCY ("Không có chênh lệch") + AF17 Cất và In
        matched_res = self.client.post(
            "/api/v1/fixed-assets/assets/save-tool-stocktake/",
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK-MATCHED",
                "count_to_date": "2026-09-30",
                "current_date": "2026-10-21",
                "purpose": "Kiểm kê khớp toàn bộ",
                "print_on_save": True,
                "lines": [
                    {
                        "code": "CC-PRINTER-47",
                        "department_code": dept_kt.code,
                        "actual_quantity": "3",
                    },
                ],
                "committee": self._default_uc15_committee(),
            },
            format="json",
        )
        self.assertEqual(matched_res.status_code, 201, matched_res.data)
        self.assertEqual(matched_res.data["status_display"], "Đã hoàn thành")
        self.assertEqual(matched_res.data["discrepancy_status"], "NO_DISCREPANCY")
        self.assertEqual(matched_res.data["discrepancy_status_display"], "Không có chênh lệch")
        self.assertTrue(matched_res.data["print_ready"])
        self.assertIsNotNone(matched_res.data["print_data"])

        # AF11, AF19 & Example 4.7: Book = 3, Actual = 2 (Shortage = 1), custom solution
        disc_res = self.client.post(
            "/api/v1/fixed-assets/assets/save-tool-stocktake/",
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK-EX47",
                "count_to_date": "2026-09-30",
                "current_date": "2026-10-21",
                "purpose": "Kiểm kê máy in Phòng Kế toán",
                "lines": [
                    {
                        "code": "CC-PRINTER-47",
                        "department_code": dept_kt.code,
                        "actual_quantity": "2",
                        "solution": "Kiểm tra và bổ sung chứng từ điều chuyển sang Phòng Hành chính",
                    },
                ],
                "committee": self._default_uc15_committee(),
            },
            format="json",
        )
        self.assertEqual(disc_res.status_code, 201, disc_res.data)
        self.assertEqual(disc_res.data["status_display"], "Đã hoàn thành")
        self.assertEqual(disc_res.data["discrepancy_status"], "PENDING_VERIFICATION")
        self.assertEqual(disc_res.data["discrepancy_status_display"], "Chờ xác minh")

        # AF20: Step 1 - Verify cause (Chờ xác minh -> Chờ phê duyệt xử lý)
        ver_res = self.client.post(
            "/api/v1/fixed-assets/assets/resolve-tool-stocktake/",
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK-EX47",
                "action": "VERIFY",
                "code": "CC-PRINTER-47",
                "verification_note": "Xác minh 1 máy in bị hỏng không thể sửa chữa, cần ghi giảm",
                "solution": "Lập chứng từ ghi giảm 1 máy in",
            },
            format="json",
        )
        self.assertEqual(ver_res.status_code, 200, ver_res.data)
        self.assertEqual(ver_res.data["discrepancy_status"], "PENDING_APPROVAL")
        self.assertEqual(ver_res.data["discrepancy_status_display"], "Chờ phê duyệt xử lý")

        # Step 2 - Approve resolution plan (Chờ phê duyệt xử lý -> Đang xử lý)
        app_res = self.client.post(
            "/api/v1/fixed-assets/assets/resolve-tool-stocktake/",
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK-EX47",
                "action": "APPROVE",
                "code": "CC-PRINTER-47",
            },
            format="json",
        )
        self.assertEqual(app_res.status_code, 200, app_res.data)
        self.assertEqual(app_res.data["discrepancy_status"], "IN_PROGRESS")
        self.assertEqual(app_res.data["discrepancy_status_display"], "Đang xử lý")

        # AF22 & AF23 & BR28 & BR37: Resolve shortage by generating UC-FA-14 decrease voucher -> Đã xử lý chênh lệch
        res_final = self.client.post(
            "/api/v1/fixed-assets/assets/resolve-tool-stocktake/",
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK-EX47",
                "action": "RESOLVE",
                "code": "CC-PRINTER-47",
                "auto_create_voucher": True,
                "resolution_date": "2026-10-05",
            },
            format="json",
        )
        self.assertEqual(res_final.status_code, 200, res_final.data)
        self.assertEqual(res_final.data["status"], "DISCREPANCY_RESOLVED")
        self.assertEqual(res_final.data["status_display"], "Đã xử lý chênh lệch")
        self.assertEqual(res_final.data["discrepancy_status"], "RESOLVED")
        self.assertEqual(len(res_final.data["linked_vouchers"]), 1)

        tool_printer.refresh_from_db()
        self.assertEqual(tool_printer.quantity, Decimal("2"))  # Decreased via UC-FA-14 voucher!

        # AF24, AF25, AF27, BR39: Export Excel & search without mutating data
        exp_res = self.client.get(
            f"/api/v1/fixed-assets/assets/export-tool-stocktake-excel/?company_id={self.company.id}&search=BBKK-EX47"
        )
        self.assertEqual(exp_res.status_code, 200, exp_res.data)
        self.assertEqual(exp_res.data["count"], 1)
        self.assertEqual(exp_res.data["items"][0]["voucher_no"], "BBKK-EX47")
        self.assertEqual(exp_res.data["items"][0]["status_display"], "Đã xử lý chênh lệch")

    def test_uc_fa_15_exceptions_ef01_to_ef35(self):
        """
        Verifies all UC-FA-15 exception flows EF01 through EF35 with exact Vietnamese messages.
        """
        from django.contrib.auth import get_user_model
        from organization.models import Company

        dept_kt = self.department
        tool_a = self._create_tool_for_uc14(
            code="CC-EF-A",
            name="Máy tính xách tay Dell",
            qty=5,
            orig_cost="50000000.00",
            alloc_val="10000000.00",
            dept=dept_kt,
            acq_date=date(2026, 1, 10),
        )
        tool_disposed = self._create_tool_for_uc14(
            code="CC-EF-DISP",
            name="CCDC đã ghi giảm hết",
            qty=2,
            orig_cost="4000000.00",
            alloc_val="4000000.00",
            dept=dept_kt,
            acq_date=date(2025, 1, 10),
            status=AssetStatus.DISPOSED,
        )
        tool_disposed.disposed_at = date(2026, 5, 1)
        tool_disposed.save(update_fields=("disposed_at",))

        other_company = Company.objects.create(
            code="OTHER_UC15",
            name="Doanh nghiệp khác UC15",
            tax_code="0109998815",
            accounting_currency=self.company.accounting_currency,
            legal_reporting_currency=self.company.legal_reporting_currency,
        )
        other_branch = other_company.branches.create(code="HQ", name="Trụ sở")
        other_cat = AssetCategory.objects.create(company=other_company, code="CC_OTH", name="CCDC khác", asset_type=AssetType.TOOL)
        other_tool = AssetRecord.objects.create(
            company=other_company,
            branch=other_branch,
            code="CC-OTHER-CO",
            name="CCDC công ty khác",
            asset_type=AssetType.TOOL,
            category=other_cat,
            quantity=Decimal("3"),
            acquisition_date=date(2026, 1, 1),
            in_service_date=date(2026, 1, 1),
            original_cost=Decimal("6000000.00"),
            useful_life_periods=12,
            status=AssetStatus.ACTIVE,
            created_by=services._resolve_user_account(self.maker),
        )

        val_date_url = "/api/v1/fixed-assets/assets/validate-tool-stocktake-date/"
        items_url = "/api/v1/fixed-assets/assets/tool-stocktake-items/"
        save_url = "/api/v1/fixed-assets/assets/save-tool-stocktake/"
        resolve_url = "/api/v1/fixed-assets/assets/resolve-tool-stocktake/"
        cancel_url = "/api/v1/fixed-assets/assets/cancel-tool-stocktake/"

        base_payload = {
            "company": str(self.company.id),
            "voucher_no": "BBKK-EF-01",
            "count_to_date": "2026-09-30",
            "current_date": "2026-10-21",
            "purpose": "Kiểm kê CCDC Quý 3/2026",
            "lines": [
                {
                    "code": "CC-EF-A",
                    "department_code": dept_kt.code,
                    "actual_quantity": "5",
                }
            ],
            "committee": self._default_uc15_committee(),
        }

        # EF02: Trường Kiểm kê đến ngày để trống
        ef02 = self.client.post(val_date_url, {"company": str(self.company.id), "count_to_date": ""}, format="json")
        self.assertEqual(ef02.status_code, 400)
        self.assertEqual(str(ef02.data["detail"]), "Vui lòng nhập ngày kiểm kê.")

        # EF03: Ngày nhập không tồn tại hoặc sai định dạng
        ef03 = self.client.post(val_date_url, {"company": str(self.company.id), "count_to_date": "31/02/2026"}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertEqual(str(ef03.data["detail"]), "Ngày kiểm kê không hợp lệ.")

        # EF04: Kiểm kê đến ngày lớn hơn ngày hiện tại
        ef04 = self.client.post(
            val_date_url,
            {"company": str(self.company.id), "count_to_date": "2026-10-25", "current_date": "2026-10-21"},
            format="json",
        )
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["detail"]), "Ngày kiểm kê không được lớn hơn ngày hiện tại.")

        # EF05: Ngày kiểm kê không thuộc phạm vi dữ liệu được quản lý
        ef05 = self.client.post(
            val_date_url,
            {"company": str(self.company.id), "count_to_date": "2026-09-30", "out_of_scope_date": True},
            format="json",
        )
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["detail"]), "Ngày kiểm kê không thuộc phạm vi dữ liệu được quản lý.")

        # EF06: Mục đích kiểm kê để trống
        ef06 = self.client.post(save_url, {**base_payload, "purpose": ""}, format="json")
        self.assertEqual(ef06.status_code, 400)
        self.assertEqual(str(ef06.data["detail"]), "Vui lòng nhập mục đích kiểm kê.")

        # EF07: Số biên bản để trống
        ef07 = self.client.post(save_url, {**base_payload, "voucher_no": "   "}, format="json")
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["detail"]), "Vui lòng nhập số biên bản kiểm kê.")

        # Save one valid voucher to test EF08 duplicate number
        ok_save = self.client.post(save_url, {**base_payload, "voucher_no": "BBKK-DUP-01"}, format="json")
        self.assertEqual(ok_save.status_code, 201, ok_save.data)

        # EF08: Số biên bản đã tồn tại
        ef08 = self.client.post(save_url, {**base_payload, "voucher_no": "BBKK-DUP-01"}, format="json")
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["detail"]), "Số biên bản kiểm kê đã tồn tại. Vui lòng sử dụng số khác.")

        # EF09: Không có dòng CCDC hợp lệ trong phạm vi kiểm kê
        ef09 = self.client.post(save_url, {**base_payload, "lines": []}, format="json")
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["detail"]), "Vui lòng chọn ít nhất một CCDC cần kiểm kê.")

        # EF10: CCDC không tồn tại hoặc không thuộc doanh nghiệp hiện tại
        ef10 = self.client.post(
            save_url,
            {**base_payload, "lines": [{"code": other_tool.code, "actual_quantity": "1"}]},
            format="json",
        )
        self.assertEqual(ef10.status_code, 400)
        self.assertEqual(str(ef10.data["detail"]), "CCDC không tồn tại hoặc không thuộc doanh nghiệp đang làm việc.")

        # EF11: CCDC đã ghi giảm toàn bộ trước ngày kiểm kê
        ef11 = self.client.post(
            save_url,
            {**base_payload, "lines": [{"code": tool_disposed.code, "actual_quantity": "1"}]},
            format="json",
        )
        self.assertEqual(ef11.status_code, 400)
        self.assertEqual(str(ef11.data["detail"]), "CCDC không còn được theo dõi sử dụng tại ngày kiểm kê đã chọn.")

        # EF12: Cùng CCDC, cùng đơn vị bị thêm trùng dòng
        ef12 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [
                    {"code": "CC-EF-A", "department_code": dept_kt.code, "actual_quantity": "5"},
                    {"code": "CC-EF-A", "department_code": dept_kt.code, "actual_quantity": "5"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef12.status_code, 400)
        self.assertEqual(str(ef12.data["detail"]), "CCDC này đã có trong danh sách kiểm kê tại đơn vị sử dụng tương ứng.")

        # EF13: SL thực tế chưa được nhập hoặc chưa xác nhận
        ef13 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [{"code": "CC-EF-A", "department_code": dept_kt.code, "actual_quantity": None}],
            },
            format="json",
        )
        self.assertEqual(ef13.status_code, 400)
        self.assertEqual(str(ef13.data["detail"]), "Vui lòng nhập số lượng thực tế của CC-EF-A.")

        # EF14: SL thực tế nhỏ hơn 0
        ef14 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [{"code": "CC-EF-A", "department_code": dept_kt.code, "actual_quantity": "-1"}],
            },
            format="json",
        )
        self.assertEqual(ef14.status_code, 400)
        self.assertEqual(str(ef14.data["detail"]), "Số lượng thực tế không được âm.")

        # EF15: Giá trị không phải số hợp lệ
        ef15 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [{"code": "CC-EF-A", "department_code": dept_kt.code, "actual_quantity": "abc"}],
            },
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(str(ef15.data["detail"]), "Số lượng thực tế của CC-EF-A không hợp lệ.")

        # EF16: Số lượng không phù hợp đơn vị tính CCDC (1.5 chiếc)
        ef16 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [{"code": "CC-EF-A", "department_code": dept_kt.code, "actual_quantity": "1.5"}],
            },
            format="json",
        )
        self.assertEqual(ef16.status_code, 400)
        self.assertEqual(str(ef16.data["detail"]), "Số lượng kiểm kê không phù hợp với đơn vị tính CCDC.")

        # EF17: Không thể xác định số lượng sổ sách của [Mã CCDC] tại ngày kiểm kê
        ef17 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [
                    {
                        "code": "CC-EF-A",
                        "department_code": dept_kt.code,
                        "actual_quantity": "5",
                        "cannot_determine_book_qty": True,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef17.status_code, 400)
        self.assertEqual(str(ef17.data["detail"]), "Không thể xác định số lượng sổ sách của CC-EF-A tại ngày kiểm kê.")

        # EF18: Dữ liệu ghi tăng, điều chuyển hoặc ghi giảm chưa nhất quán khiến số lượng sổ sách âm hoặc sai lệch bất thường
        ef18 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [
                    {
                        "code": "CC-EF-A",
                        "department_code": dept_kt.code,
                        "actual_quantity": "5",
                        "inconsistent_book_history": True,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef18.status_code, 400)
        self.assertEqual(str(ef18.data["detail"]), "Số lượng sổ sách của CC-EF-A không hợp lệ. Vui lòng kiểm tra lịch sử CCDC.")

        # EF19: Không thể tải danh sách CCDC đang dùng
        ef19 = self.client.post(
            items_url,
            {"company": str(self.company.id), "count_to_date": "2026-09-30", "simulate_load_error": True},
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(str(ef19.data["detail"]), "Không thể tải danh sách CCDC đang dùng. Vui lòng thử lại.")

        # EF20: Có dòng SL thực tế đã nhập và thao tác tải lại có thể làm mất kết quả
        ef20 = self.client.post(
            items_url,
            {
                "company": str(self.company.id),
                "count_to_date": "2026-09-30",
                "existing_rows": [{"code": "CC-EF-A", "actual_quantity": "4"}],
            },
            format="json",
        )
        self.assertEqual(ef20.status_code, 400)
        self.assertEqual(str(ef20.data["detail"]), "Danh sách đã có dữ liệu kiểm kê. Bạn có muốn tải lại dữ liệu không?")

        # EF21: Thay đổi Kiểm kê đến ngày làm thay đổi số lượng sổ sách đã tải
        ef21 = self.client.post(
            items_url,
            {
                "company": str(self.company.id),
                "count_to_date": "2026-09-30",
                "previous_count_to_date": "2026-08-31",
            },
            format="json",
        )
        self.assertEqual(ef21.status_code, 400)
        self.assertIn("tải lại dữ liệu", str(ef21.data["detail"]))

        # EF22: Chưa có thành viên Ban kiểm kê hợp lệ
        ef22 = self.client.post(save_url, {**base_payload, "committee": []}, format="json")
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(str(ef22.data["detail"]), "Vui lòng nhập thông tin Ban kiểm kê.")

        # EF23: Dòng thành viên thiếu Họ và tên
        ef23 = self.client.post(
            save_url,
            {
                **base_payload,
                "committee": [
                    {"name": "", "title": "Kế toán trưởng", "department": "Phòng Kế toán", "role": "Trưởng ban"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(str(ef23.data["detail"]), "Vui lòng nhập họ và tên thành viên tại dòng 1.")

        # EF24: Vai trò trong Ban kiểm kê chưa được xác định hoặc không hợp lệ
        ef24 = self.client.post(
            save_url,
            {
                **base_payload,
                "committee": [
                    {"name": "Nguyễn Thị Mai", "title": "Kế toán trưởng", "department": "Phòng Kế toán", "role": ""},
                ],
            },
            format="json",
        )
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(str(ef24.data["detail"]), "Vui lòng chọn vai trò trong Ban kiểm kê tại dòng 1.")

        # EF25: Không có Trưởng ban hoặc có nhiều Trưởng ban
        ef25 = self.client.post(
            save_url,
            {
                **base_payload,
                "committee": [
                    {"name": "Nguyễn Thị Mai", "title": "Kế toán", "department": "Phòng Kế toán", "role": "Ủy viên"},
                ],
            },
            format="json",
        )
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(str(ef25.data["detail"]), "Ban kiểm kê phải có một Trưởng ban hợp lệ.")

        # EF26: Có dòng Thừa/Thiếu nhưng chưa có nội dung đề xuất xử lý
        ef26 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [
                    {
                        "code": "CC-EF-A",
                        "department_code": dept_kt.code,
                        "actual_quantity": "4",
                        "solution": "",
                        "require_explicit_solution": True,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef26.status_code, 400)
        self.assertEqual(str(ef26.data["detail"]), "Vui lòng nhập đề xuất xử lý chênh lệch của CC-EF-A.")

        # EF27: User ghi nội dung "Đã xử lý" nhưng chưa có chứng từ hoặc kết quả xử lý hợp lệ
        ef27 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [
                    {
                        "code": "CC-EF-A",
                        "department_code": dept_kt.code,
                        "actual_quantity": "4",
                        "solution": "Đã xử lý",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(str(ef27.data["detail"]), "Chênh lệch chưa có căn cứ xác nhận đã xử lý.")

        # EF28: Tệp đính kèm không hợp lệ hoặc vượt giới hạn 5MB
        ef28 = self.client.post(
            save_url,
            {
                **base_payload,
                "attachments": [{"name": "oversize.pdf", "size": 6 * 1024 * 1024}],
            },
            format="json",
        )
        self.assertEqual(ef28.status_code, 400)
        self.assertEqual(str(ef28.data["detail"]), "Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.")

        # EF29: Dữ liệu số lượng CCDC đã thay đổi so với thời điểm tải
        ef29 = self.client.post(
            save_url,
            {
                **base_payload,
                "lines": [
                    {
                        "code": "CC-EF-A",
                        "department_code": dept_kt.code,
                        "expected_book_quantity": "99",
                        "actual_quantity": "5",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef29.status_code, 400)
        self.assertEqual(str(ef29.data["detail"]), "Dữ liệu sổ sách đã thay đổi. Vui lòng tải lại và kiểm tra kết quả kiểm kê.")

        # EF30: Gửi yêu cầu lưu biên bản nhiều lần (Idempotency)
        ef30_first = self.client.post(
            save_url,
            {
                **base_payload,
                "voucher_no": "BBKK-IDEM-30",
                "idempotency_key": "UC15-IDEM-KEY-30",
                "lines": [
                    {
                        "code": "CC-EF-A",
                        "department_code": dept_kt.code,
                        "actual_quantity": "4",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef30_first.status_code, 201)
        ef30_second = self.client.post(
            save_url,
            {
                **base_payload,
                "voucher_no": "BBKK-IDEM-30",
                "idempotency_key": "UC15-IDEM-KEY-30",
                "lines": [
                    {
                        "code": "CC-EF-A",
                        "department_code": dept_kt.code,
                        "actual_quantity": "4",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(ef30_second.status_code, 200)
        self.assertTrue(ef30_second.data["idempotent_replayed"])

        # EF31: Lưu biên bản kiểm kê thất bại
        ef31 = self.client.post(
            save_url,
            {**base_payload, "voucher_no": "BBKK-FAIL-31", "simulate_save_error": True},
            format="json",
        )
        self.assertEqual(ef31.status_code, 400)
        self.assertEqual(str(ef31.data["detail"]), "Lưu biên bản kiểm kê thất bại. Vui lòng thử lại.")

        # EF32: Biên bản được lưu thành công nhưng không thể tạo bản in
        ef32 = self.client.post(
            save_url,
            {**base_payload, "voucher_no": "BBKK-PRINTERR-32", "print_on_save": True, "simulate_print_error": True},
            format="json",
        )
        self.assertEqual(ef32.status_code, 201)
        self.assertEqual(ef32.data["message"], "Biên bản đã được lưu nhưng chưa thể tạo bản in.")

        # EF34: Chưa có phương án xử lý được phê duyệt nhưng User yêu cầu ghi tăng hoặc ghi giảm chính thức
        ef34 = self.client.post(
            resolve_url,
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK-IDEM-30",
                "action": "RESOLVE",
                "code": "CC-EF-A",
                "approved": False,
            },
            format="json",
        )
        self.assertEqual(ef34.status_code, 400)
        self.assertEqual(str(ef34.data["detail"]), "Chênh lệch kiểm kê chưa có phương án xử lý được phê duyệt.")

        # Approve and resolve BBKK-IDEM-30 to test EF33 & EF35
        self.client.post(
            resolve_url,
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK-IDEM-30",
                "action": "RESOLVE",
                "code": "CC-EF-A",
                "approved": True,
                "resolution_voucher_no": "GGCC-FROM-BBKK30",
            },
            format="json",
        )

        # EF33: Số lượng chênh lệch đã được xử lý tại chứng từ khác
        ef33 = self.client.post(
            resolve_url,
            {
                "company": str(self.company.id),
                "voucher_no": "BBKK-IDEM-30",
                "action": "RESOLVE",
                "code": "CC-EF-A",
                "approved": True,
                "resolution_voucher_no": "GGCC-DUP-33",
            },
            format="json",
        )
        self.assertEqual(ef33.status_code, 400)
        self.assertEqual(str(ef33.data["detail"]), "Chênh lệch đã được xử lý tại chứng từ liên quan. Vui lòng kiểm tra lại.")

        # EF35: Sửa/Hủy biên bản khi đã có chứng từ xử lý chênh lệch liên quan
        ef35 = self.client.post(
            cancel_url,
            {"company": str(self.company.id), "voucher_no": "BBKK-IDEM-30"},
            format="json",
        )
        self.assertEqual(ef35.status_code, 400)
        self.assertEqual(
            str(ef35.data["detail"]),
            "Không thể sửa hoặc hủy biên bản khi đã có chứng từ xử lý chênh lệch liên quan.",
        )

        # EF01: User không có quyền lập biên bản kiểm kê CCDC
        no_perm_user = get_user_model().objects.create_user(username="no-uc15-perm", email="nouc15@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(save_url, base_payload, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền lập biên bản kiểm kê CCDC.")

    # =========================================================================
    # UC-FA-16 – Xem sổ và báo cáo CCDC
    # =========================================================================

    def test_uc_fa_16_main_flow_a_tool_register_multi_dept_and_export(self):
        """
        UC-FA-16 Main Flow A (Steps 1-12), AF01-AF07, Formula 4.1 & 4.2, BR01-BR14, BR34-BR40:
        - Sổ theo dõi CCDC với 12 cột chuẩn (#, Mã CCDC, Tên CCDC, Loại CCDC, Đơn vị sử dụng, SL, Nguyên giá, Đã phân bổ, Còn lại, Số kỳ PB, Kỳ còn lại, TK chi phí)
        - CCDC phân bổ tại nhiều đơn vị sử dụng (điều chuyển một phần) không nhân đôi nguyên giá toàn doanh nghiệp (BR05, BR13, BR14)
        - Chỉ tính Đã phân bổ từ chứng từ phân bổ đã ghi nhận hợp lệ, không tự tính theo số tháng trôi qua (Step 9, BR10)
        - CCDC đã phân bổ hết nhưng còn sử dụng vẫn hiển thị với Còn lại = 0, Kỳ còn lại = 0 (BR07)
        - CCDC đã ghi giảm hết SL = 0 mặc định ẩn trên danh sách đang sử dụng, có thể lọc khi tra cứu lịch sử (BR08)
        - Tìm kiếm, lọc, phân trang, xem chi tiết & lịch sử biến động (AF02-AF05), xuất khẩu Excel (AF06, AF07)
        - Tuyệt đối không tạo/sửa chứng từ hoặc thay đổi số liệu khi xem/xuất sổ (BR02, BR39)
        """
        from general_ledger.models import JournalEntry
        from organization.models import Department

        dept_kt = Department.objects.create(company=self.company, branch=self.branch, code="PKT-UC16A", name="Phòng Kế toán")
        dept_kd = Department.objects.create(company=self.company, branch=self.branch, code="PKD-UC16A", name="Phòng Kinh doanh")

        # 1. CCDC-MULTI-16: Ghi tăng 10 cái, Nguyên giá 10,000,000, 10 kỳ PB.
        # Điều chuyển 4 cái sang Phòng Kinh doanh. Đã phân bổ 1 kỳ = 1,000,000.
        tool_multi = self._create_tool_for_uc14(
            code="CCDC-MULTI-16",
            name="Màn hình Dell 27 inch",
            qty=10,
            orig_cost="10000000.00",
            alloc_val="1000000.00",
            dept=dept_kt,
            acq_date=date(2026, 7, 1),
        )
        tool_multi.useful_life_periods = 10
        tool_multi.periods_processed = 1
        tool_multi.accessories = [{"unit": "Cái", "initial_quantity": "10", "initial_original_cost": "10000000.00"}]
        tool_multi.save(update_fields=["useful_life_periods", "periods_processed", "accessories"])

        # Điều chuyển 4 cái từ Phòng Kế toán sang Phòng Kinh doanh ngày 2026-08-10
        res_tf = self.client.post(
            "/api/v1/fixed-assets/assets/transfer-tools/",
            {
                "company": str(self.company.id),
                "voucher_no": "ĐCCC-UC16-01",
                "transfer_date": "10/08/2026",
                "deliverer": "Nguyễn Văn Giao",
                "receiver": "Trần Thị Nhận",
                "reason": "Điều chuyển màn hình sang Phòng Kinh doanh",
                "lines": [
                    {
                        "code": "CCDC-MULTI-16",
                        "from_department": dept_kt.code,
                        "to_department": dept_kd.code,
                        "transfer_quantity": 4,
                        "expense_account": self.expense_account.code,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res_tf.status_code, 201, res_tf.data)

        # 2. CCDC-FULL-16: Đã phân bổ hết (Còn lại = 0, Kỳ còn lại = 0) nhưng vẫn đang sử dụng (SL = 2) -> BR07
        tool_full = self._create_tool_for_uc14(
            code="CCDC-FULL-16",
            name="Máy in nhiệt hóa đơn",
            qty=2,
            orig_cost="6000000.00",
            alloc_val="6000000.00",
            dept=dept_kt,
            acq_date=date(2025, 9, 1),
        )
        tool_full.useful_life_periods = 6
        tool_full.periods_processed = 6
        tool_full.save(update_fields=["useful_life_periods", "periods_processed"])

        # 3. CCDC-DISP-16: Ghi tăng 3 cái, sau đó ghi giảm toàn bộ 3 cái -> BR08
        tool_disp = self._create_tool_for_uc14(
            code="CCDC-DISP-16",
            name="Ghế xoay văn phòng cũ",
            qty=3,
            orig_cost="3000000.00",
            alloc_val="0.00",
            dept=dept_kt,
            acq_date=date(2026, 6, 1),
        )
        tool_disp.accessories = [{"unit": "Cái", "initial_quantity": "3", "initial_original_cost": "3000000.00"}]
        tool_disp.save(update_fields=["accessories"])
        res_dec = self.client.post(
            "/api/v1/fixed-assets/assets/decrease-tools/",
            {
                "company": str(self.company.id),
                "voucher_no": "GGCC-UC16-01",
                "voucher_date": "20/08/2026",
                "reason": "Nhượng bán, Thanh lý",
                "lines": [
                    {
                        "code": "CCDC-DISP-16",
                        "department": dept_kt.code,
                        "decrease_quantity": 3,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res_dec.status_code, 201, res_dec.data)

        tx_count_before = models.AssetTransaction.objects.filter(company=self.company).count()
        je_count_before = JournalEntry.objects.filter(company=self.company).count()

        # Xem Sổ theo dõi CCDC (Main Flow A Steps 3-9) với split_by_department=True
        reg_url = "/api/v1/fixed-assets/assets/tool-register-uc16/"
        res_reg = self.client.post(
            reg_url,
            {
                "company": str(self.company.id),
                "as_of_date": "2026-09-30",
                "split_by_department": True,
            },
            format="json",
        )
        self.assertEqual(res_reg.status_code, 200, res_reg.data)
        data = res_reg.data

        # Kiểm tra 12 cột chuẩn của bảng theo dõi CCDC (Step 7)
        col_labels = [c["label"] for c in data["columns"]]
        self.assertEqual(
            col_labels,
            [
                "#",
                "Mã CCDC",
                "Tên CCDC",
                "Loại CCDC",
                "Đơn vị sử dụng",
                "SL",
                "Nguyên giá",
                "Đã phân bổ",
                "Còn lại",
                "Số kỳ PB",
                "Kỳ còn lại",
                "TK chi phí",
            ],
        )

        # CCDC-DISP-16 đã ghi giảm hết (SL = 0) mặc định không hiển thị trong danh sách đang sử dụng (BR08)
        codes_in_reg = [r["code"] for r in data["rows"]]
        self.assertIn("CCDC-MULTI-16", codes_in_reg)
        self.assertIn("CCDC-FULL-16", codes_in_reg)
        self.assertNotIn("CCDC-DISP-16", codes_in_reg)

        # Kiểm tra CCDC-MULTI-16 tách theo 2 đơn vị sử dụng (6 cái tại Phòng Kế toán, 4 cái tại Phòng Kinh doanh)
        multi_rows = [r for r in data["rows"] if r["code"] == "CCDC-MULTI-16"]
        self.assertEqual(len(multi_rows), 2)
        row_kt = next(r for r in multi_rows if r["department_name"] == "Phòng Kế toán")
        row_kd = next(r for r in multi_rows if r["department_name"] == "Phòng Kinh doanh")
        self.assertEqual(Decimal(row_kt["quantity"]), Decimal("6"))
        self.assertEqual(Decimal(row_kt["original_cost"]), Decimal("6000000.00"))
        self.assertEqual(Decimal(row_kt["allocated_value"]), Decimal("600000.00"))
        self.assertEqual(Decimal(row_kt["remaining_value"]), Decimal("5400000.00"))

        self.assertEqual(Decimal(row_kd["quantity"]), Decimal("4"))
        self.assertEqual(Decimal(row_kd["original_cost"]), Decimal("4000000.00"))
        self.assertEqual(Decimal(row_kd["allocated_value"]), Decimal("400000.00"))
        self.assertEqual(Decimal(row_kd["remaining_value"]), Decimal("3600000.00"))

        # BR14: Tổng nguyên giá toàn doanh nghiệp của CCDC-MULTI-16 + CCDC-FULL-16 = 10,000,000 + 6,000,000 = 16,000,000 (không nhân đôi)
        self.assertEqual(Decimal(data["summary"]["total_original_cost"]), Decimal("16000000.00"))
        self.assertEqual(Decimal(data["summary"]["total_allocated_value"]), Decimal("7000000.00"))
        self.assertEqual(Decimal(data["summary"]["total_remaining_value"]), Decimal("9000000.00"))

        # BR07: CCDC-FULL-16 đã phân bổ hết nhưng còn sử dụng vẫn hiển thị với Còn lại = 0, Kỳ còn lại = 0
        row_full = next(r for r in data["rows"] if r["code"] == "CCDC-FULL-16")
        self.assertEqual(Decimal(row_full["remaining_value"]), Decimal("0.00"))
        self.assertEqual(row_full["remaining_periods"], 0)
        self.assertEqual(row_full["allocation_status"], "FULLY_ALLOCATED")

        # BR08: Khi lọc trạng thái DISPOSED, hiển thị CCDC-DISP-16
        res_disp_filter = self.client.post(
            reg_url,
            {
                "company": str(self.company.id),
                "as_of_date": "2026-09-30",
                "status": "DISPOSED",
            },
            format="json",
        )
        self.assertEqual(res_disp_filter.status_code, 200)
        self.assertEqual([r["code"] for r in res_disp_filter.data["rows"]], ["CCDC-DISP-16"])

        # AF04: Xem chi tiết CCDC từ dòng trên Sổ theo dõi CCDC
        trace_url = "/api/v1/fixed-assets/assets/tool-detail-trace/"
        res_detail = self.client.post(
            trace_url,
            {
                "company": str(self.company.id),
                "tool_id": str(tool_multi.id),
                "as_of_date": "2026-09-30",
            },
            format="json",
        )
        self.assertEqual(res_detail.status_code, 200)
        self.assertEqual(res_detail.data["tool"]["code"], "CCDC-MULTI-16")
        self.assertEqual(len(res_detail.data["tool"]["department_holdings"]), 2)
        self.assertGreaterEqual(len(res_detail.data["transactions_history"]), 1)

        # AF06 & AF07: Xuất khẩu Sổ theo dõi CCDC ra Excel
        export_url = "/api/v1/fixed-assets/assets/export-tool-register/"
        res_exp = self.client.post(
            export_url,
            {
                "company": str(self.company.id),
                "as_of_date": "2026-09-30",
                "department": dept_kd.code,
                "split_by_department": True,
            },
            format="json",
        )
        self.assertEqual(res_exp.status_code, 200)
        self.assertIn("export_excel", res_exp.data)
        self.assertTrue(res_exp.data["export_excel"]["file_name"].endswith(".xlsx"))
        self.assertEqual(res_exp.data["export_excel"]["row_count"], 1)
        self.assertEqual(Decimal(res_exp.data["summary"]["total_original_cost"]), Decimal("4000000.00"))

        # BR02 & BR39: Không tạo mới hoặc làm thay đổi bất kỳ chứng từ hay bút toán nào
        self.assertEqual(models.AssetTransaction.objects.filter(company=self.company).count(), tx_count_before)
        self.assertEqual(JournalEntry.objects.filter(company=self.company).count(), je_count_before)

    def test_uc_fa_16_main_flow_b_all_reports_example_4_7_and_reconciliation(self):
        """
        UC-FA-16 Main Flow B (Steps 1-14), Section 4.7 Example, AF08-AF28, BR15-BR40:
        - Danh mục báo cáo CCDC, Tìm kiếm nhanh với AVA (AF21), Đánh dấu Yêu thích (AF17, AF18), Ẩn/hiện báo cáo (AF20), Ngôn ngữ báo cáo (AF19)
        - Ví dụ minh họa 4.7: CCDC001 (Nguyên giá 12,000,000, 12 kỳ, Đã PB đến 08/2026 = 4,000,000, PB tháng 09/2026 = 1,000,000, Lũy kế = 5,000,000, Còn lại = 7,000,000)
        - Đối chiếu TK 242 khớp (7,000,000 -> Chênh lệch = 0) và lệch (6,000,000 -> Chênh lệch = 1,000,000, cảnh báo EF15)
        - Báo cáo Tổng hợp phân bổ CCDC theo năm 12 tháng (AF12, Formula 4.4)
        - Báo cáo Chi tiết giảm CCDC (AF13, BR20) & Báo cáo CCDC theo đơn vị sử dụng (AF14, BR21)
        - Báo cáo Đối chiếu CCDC, CPTT và Sổ cái TK 242 tách riêng CCDC vs CPTT (AF16, BR23)
        - Xem báo cáo kỳ đã khóa sổ (AF23, BR28), Kỳ không có dữ liệu (AF24, BR36), Xuất Excel (AF25), In (AF26), Truy vết chứng từ gốc (AF28)
        """
        from general_ledger.models import PrepaidExpense
        from organization.models import Department

        dept_kt = Department.objects.create(company=self.company, branch=self.branch, code="PKT-UC16B", name="Phòng Kế toán")

        # 1. Danh mục báo cáo CCDC (Main Flow B Steps 2-3, AF17-AF21)
        cat_url = "/api/v1/fixed-assets/assets/tool-report-catalog/"
        res_cat = self.client.post(
            cat_url,
            {
                "company": str(self.company.id),
                "favorite_report_codes": ["TOOL_ALLOCATION_SHEET", "RECONCILE_TOOL_GL_242"],
                "ava_query": "bảng tính phân bổ ccdc tháng 9/2026",
                "lang": "en",
            },
            format="json",
        )
        self.assertEqual(res_cat.status_code, 200, res_cat.data)
        self.assertIn("TOOL_ALLOCATION_SHEET", res_cat.data["favorites"])
        self.assertEqual(res_cat.data["language"], "en")
        self.assertTrue(len(res_cat.data["ava_suggestions"]) >= 1)
        self.assertEqual(res_cat.data["ava_suggestions"][0]["code"], "TOOL_ALLOCATION_SHEET")

        # Chuyển lại ngôn ngữ Tiếng Việt
        self.client.post(cat_url, {"company": str(self.company.id), "lang": "vi"}, format="json")

        # 2. Tạo dữ liệu theo đúng Ví dụ minh họa 4.7:
        # CCDC001: Nguyên giá = 12,000,000, Số kỳ PB = 12, Đã PB đến hết 08/2026 = 4,000,000 (4 kỳ)
        ccdc001 = self._create_tool_for_uc14(
            code="CCDC001",
            name="Máy tính xách tay phục vụ Ví dụ 4.7",
            qty=1,
            orig_cost="12000000.00",
            alloc_val="5000000.00",
            dept=dept_kt,
            acq_date=date(2026, 5, 1),
        )
        ccdc001.useful_life_periods = 12
        ccdc001.periods_processed = 5
        ccdc001.accessories = [
            {
                "unit": "Chiếc",
                "opening_allocated_amount": "4000000.00",
                "opening_allocated_periods": 4,
            }
        ]
        ccdc001.save(update_fields=["useful_life_periods", "periods_processed", "accessories"])

        # Chứng từ phân bổ tháng 09/2026 = 1,000,000 (1 kỳ) đã POSTED
        run_09 = models.CalculationRun.objects.create(
            company=self.company,
            number="PBCC-202609-01",
            calculation_type="ALLOCATION",
            period_code="2026-09",
            period_start=date(2026, 9, 1),
            period_end=date(2026, 9, 30),
            status="POSTED",
            total_amount=Decimal("1000000.00"),
            description="Phân bổ CCDC tháng 09/2026",
            created_by=services._resolve_user_account(self.maker),
        )
        models.CalculationLine.objects.create(
            run=run_09,
            asset=ccdc001,
            opening_value=Decimal("8000000.00"),
            amount=Decimal("1000000.00"),
            closing_value=Decimal("7000000.00"),
        )

        # Kiểm tra 4.7.1: Trên Sổ theo dõi CCDC đến hết 30/09/2026:
        # Đã phân bổ = 4,000,000 + 1,000,000 = 5,000,000; Còn lại = 7,000,000; Kỳ còn lại = 7
        res_reg = self.client.post(
            "/api/v1/fixed-assets/assets/tool-register-uc16/",
            {"company": str(self.company.id), "as_of_date": "2026-09-30", "search": "CCDC001"},
            format="json",
        )
        self.assertEqual(res_reg.status_code, 200)
        row_471 = res_reg.data["rows"][0]
        self.assertEqual(Decimal(row_471["original_cost"]), Decimal("12000000.00"))
        self.assertEqual(Decimal(row_471["allocated_value"]), Decimal("5000000.00"))
        self.assertEqual(Decimal(row_471["remaining_value"]), Decimal("7000000.00"))
        self.assertEqual(row_471["useful_life_periods"], 12)
        self.assertEqual(row_471["remaining_periods"], 7)

        # Kiểm tra 4.7.2: Trên Bảng tính phân bổ CCDC tháng 09/2026
        rep_url = "/api/v1/fixed-assets/assets/tool-reports/"
        res_sheet = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_ALLOCATION_SHEET",
                "period_type": "MONTH",
                "year": 2026,
                "month": 9,
                "export_format": "EXCEL",
                "print_report": True,
            },
            format="json",
        )
        self.assertEqual(res_sheet.status_code, 200, res_sheet.data)
        row_472 = next(r for r in res_sheet.data["rows"] if r["code"] == "CCDC001")
        self.assertEqual(Decimal(row_472["allocated_before_period"]), Decimal("4000000.00"))
        self.assertEqual(Decimal(row_472["allocated_in_period"]), Decimal("1000000.00"))
        self.assertEqual(Decimal(row_472["accumulated_allocated"]), Decimal("5000000.00"))
        self.assertEqual(Decimal(row_472["remaining_value"]), Decimal("7000000.00"))
        self.assertIn("export_excel", res_sheet.data)
        self.assertIn("print_payload", res_sheet.data)

        # Kiểm tra 4.7.3 Trường hợp 1: Đối chiếu Sổ CCDC và Sổ cái TK 242 khi số dư Nợ TK 242 = 7,000,000 -> Chênh lệch = 0
        res_rec_match = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "RECONCILE_TOOL_GL_242",
                "period_type": "MONTH",
                "year": 2026,
                "month": 9,
                "gl_242_balances": {"CCDC001": "7000000.00"},
            },
            format="json",
        )
        self.assertEqual(res_rec_match.status_code, 200)
        self.assertEqual(Decimal(res_rec_match.data["totals"]["tool_remaining_value"]), Decimal("7000000.00"))
        self.assertEqual(Decimal(res_rec_match.data["totals"]["gl_242_balance"]), Decimal("7000000.00"))
        self.assertEqual(Decimal(res_rec_match.data["totals"]["discrepancy"]), Decimal("0.00"))
        self.assertEqual(res_rec_match.data["rows"][0]["status_display"], "Khớp số liệu")

        # Kiểm tra 4.7.3 Trường hợp 2: Số dư Nợ TK 242 = 6,000,000 -> Chênh lệch = 1,000,000
        res_rec_diff = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "RECONCILE_TOOL_GL_242",
                "period_type": "MONTH",
                "year": 2026,
                "month": 9,
                "gl_242_balances": {"CCDC001": "6000000.00"},
            },
            format="json",
        )
        self.assertEqual(res_rec_diff.status_code, 200)
        self.assertEqual(Decimal(res_rec_diff.data["totals"]["discrepancy"]), Decimal("1000000.00"))
        self.assertEqual(res_rec_diff.data["rows"][0]["status_display"], "Có chênh lệch")
        self.assertTrue(len(res_rec_diff.data["warnings"]) >= 1)

        # Kiểm tra AF12 & Formula 4.4: Tổng hợp phân bổ CCDC theo năm (12 tháng)
        res_annual = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_ANNUAL_ALLOCATION",
                "period_type": "YEAR",
                "year": 2026,
            },
            format="json",
        )
        self.assertEqual(res_annual.status_code, 200)
        annual_row = next(r for r in res_annual.data["rows"] if r["code"] == "CCDC001")
        self.assertEqual(Decimal(annual_row["month_9"]), Decimal("1000000.00"))
        self.assertEqual(Decimal(annual_row["total_year_allocation"]), Decimal("1000000.00"))

        # Kiểm tra AF14 & BR21: Báo cáo CCDC theo đơn vị sử dụng
        res_by_dept = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_BY_DEPARTMENT",
                "period_type": "MONTH",
                "year": 2026,
                "month": 9,
            },
            format="json",
        )
        self.assertEqual(res_by_dept.status_code, 200)
        self.assertEqual(len(res_by_dept.data["rows"]), 1)
        self.assertEqual(res_by_dept.data["rows"][0]["department_name"], "Phòng Kế toán")

        # Kiểm tra AF16 & BR23: Đối chiếu CCDC, CPTT và Sổ cái TK 242 (tách riêng CCDC và CPTT)
        acc_242 = Account.objects.create(
            company=self.company,
            chart_of_accounts=self.coa,
            account_class=self.accounts[0].account_class,
            code="242",
            name="Chi phí trả trước",
            account_type="ASSET",
            normal_balance="DEBIT",
        )
        PrepaidExpense.objects.create(
            company=self.company,
            code="CPTT-UC16-01",
            name="Thuê văn phòng Quý 3",
            record_date=date(2026, 7, 1),
            start_date=date(2026, 7, 1),
            amount=Decimal("9000000.00"),
            allocation_periods=3,
            allocated_periods=1,
            allocated_amount=Decimal("3000000.00"),
            prepaid_account=acc_242,
            created_by=services._resolve_user_account(self.maker),
        )
        res_rec_both = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "RECONCILE_TOOL_PREPAID_GL",
                "period_type": "MONTH",
                "year": 2026,
                "month": 9,
                "gl_242_balances": {
                    "CCDC001": "7000000.00",
                    "CPTT-UC16-01": "5000000.00",
                },
            },
            format="json",
        )
        self.assertEqual(res_rec_both.status_code, 200)
        self.assertEqual(len(res_rec_both.data["rows"]), 2)
        self.assertEqual(
            Decimal(res_rec_both.data["extra_sections"]["group_summary"]["ccdc_remaining_total"]),
            Decimal("7000000.00"),
        )
        self.assertEqual(
            Decimal(res_rec_both.data["extra_sections"]["group_summary"]["prepaid_remaining_total"]),
            Decimal("6000000.00"),
        )

        # Kiểm tra AF23 & BR28: Xem báo cáo của kỳ đã khóa sổ vẫn thành công (chỉ đọc)
        models.AssetPeriod.objects.create(
            company=self.company,
            code="2026-09",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
            status="CLOSED",
        )
        res_locked = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_ALLOCATION_SHEET",
                "period_type": "MONTH",
                "year": 2026,
                "month": 9,
            },
            format="json",
        )
        self.assertEqual(res_locked.status_code, 200)
        self.assertTrue(res_locked.data["period"]["is_locked_period"])

        # Kiểm tra AF24 & BR36: Kỳ báo cáo không có dữ liệu phát sinh
        res_empty = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_DECREASE_DETAIL",
                "period_type": "MONTH",
                "year": 2026,
                "month": 9,
            },
            format="json",
        )
        self.assertEqual(res_empty.status_code, 200)
        self.assertTrue(res_empty.data["is_empty"])
        self.assertEqual(res_empty.data["message"], "Không có dữ liệu trong kỳ báo cáo đã chọn.")

        # Kiểm tra AF28: Truy vết chứng từ gốc từ dòng báo cáo
        res_trace_vc = self.client.post(
            "/api/v1/fixed-assets/assets/tool-detail-trace/",
            {
                "company": str(self.company.id),
                "voucher_no": "PBCC-202609-01",
            },
            format="json",
        )
        self.assertEqual(res_trace_vc.status_code, 200)
        self.assertEqual(res_trace_vc.data["voucher_no"], "PBCC-202609-01")

    def test_uc_fa_16_exceptions_ef01_to_ef27(self):
        """
        UC-FA-16 Exception Flows EF01 -> EF27:
        Kiểm tra đầy đủ các mã ngoại lệ EF01 -> EF27 với thông báo tiếng Việt chính xác.
        """
        from organization.models import Department

        reg_url = "/api/v1/fixed-assets/assets/tool-register-uc16/"
        exp_url = "/api/v1/fixed-assets/assets/export-tool-register/"
        trace_url = "/api/v1/fixed-assets/assets/tool-detail-trace/"
        cat_url = "/api/v1/fixed-assets/assets/tool-report-catalog/"
        rep_url = "/api/v1/fixed-assets/assets/tool-reports/"

        dept = Department.objects.create(company=self.company, branch=self.branch, code="PKT-EF16", name="Phòng Kế toán EF")
        tool_ef = self._create_tool_for_uc14(
            code="CCDC-EF16",
            name="CCDC kiểm tra ngoại lệ",
            qty=2,
            orig_cost="2000000.00",
            alloc_val="0.00",
            dept=dept,
            acq_date=date(2026, 8, 1),
        )

        # EF03: Chưa chọn doanh nghiệp làm việc
        ef03 = self.client.post(reg_url, {}, format="json")
        self.assertEqual(ef03.status_code, 400)
        self.assertIn("company", ef03.data)

        # EF10 / EF04: Báo cáo không tồn tại hoặc không còn được sử dụng
        ef04 = self.client.post(
            rep_url,
            {"company": str(self.company.id), "report_code": "NON_EXISTENT_REPORT"},
            format="json",
        )
        self.assertEqual(ef04.status_code, 400)
        self.assertEqual(str(ef04.data["detail"]), "Báo cáo không tồn tại hoặc không còn được sử dụng.")

        # EF05 & EF06: Tùy chọn kỳ báo cáo nhưng để trống Từ ngày hoặc Đến ngày
        ef05 = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_ALLOCATION_SHEET",
                "period_type": "CUSTOM",
                "from_date": "",
                "to_date": "2026-09-30",
            },
            format="json",
        )
        self.assertEqual(ef05.status_code, 400)
        self.assertEqual(str(ef05.data["detail"]), "Vui lòng nhập Từ ngày.")

        ef06_empty_to = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_ALLOCATION_SHEET",
                "period_type": "CUSTOM",
                "from_date": "2026-09-01",
                "to_date": "",
            },
            format="json",
        )
        self.assertEqual(ef06_empty_to.status_code, 400)
        self.assertEqual(str(ef06_empty_to.data["detail"]), "Vui lòng nhập Đến ngày.")

        # EF07: Ngày bắt đầu hoặc ngày kết thúc sai định dạng / Năm hoặc Tháng hoặc Quý không hợp lệ
        ef07 = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_ALLOCATION_SHEET",
                "period_type": "CUSTOM",
                "from_date": "2026-13-99",
                "to_date": "2026-09-30",
            },
            format="json",
        )
        self.assertEqual(ef07.status_code, 400)
        self.assertEqual(str(ef07.data["detail"]), "Khoảng thời gian báo cáo không hợp lệ.")

        # EF08: Từ ngày lớn hơn Đến ngày
        ef08 = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_ALLOCATION_SHEET",
                "period_type": "CUSTOM",
                "from_date": "2026-10-15",
                "to_date": "2026-10-01",
            },
            format="json",
        )
        self.assertEqual(ef08.status_code, 400)
        self.assertEqual(str(ef08.data["detail"]), "Từ ngày không được lớn hơn Đến ngày.")

        # EF09: Khoảng thời gian báo cáo vượt phạm vi dữ liệu được quản lý
        ef09 = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_ANNUAL_ALLOCATION",
                "period_type": "YEAR",
                "year": 1985,
            },
            format="json",
        )
        self.assertEqual(ef09.status_code, 400)
        self.assertEqual(str(ef09.data["detail"]), "Khoảng thời gian báo cáo vượt phạm vi dữ liệu được quản lý.")

        # EF11, EF12, EF13: Cảnh báo dữ liệu lịch sử (SL âm, Đã phân bổ lệch lịch sử, Hồ sơ thiếu thông tin)
        tool_ef.accessories = [
            {
                "unit": "Cái",
                "corrupted_negative_qty": True,
                "corrupted_allocation_mismatch": True,
                "incomplete_profile": True,
            }
        ]
        tool_ef.save(update_fields=["accessories"])

        res_warn = self.client.post(
            reg_url,
            {"company": str(self.company.id), "as_of_date": "2026-09-30", "include_disposed": True},
            format="json",
        )
        self.assertEqual(res_warn.status_code, 200)
        warn_msgs = [w["message"] for w in res_warn.data["warnings"]]
        self.assertIn("Số lượng theo dõi của CCDC CCDC-EF16 không hợp lệ.", warn_msgs)
        self.assertIn("Giá trị phân bổ của CCDC CCDC-EF16 chưa khớp với lịch sử chứng từ.", warn_msgs)
        self.assertIn("Hồ sơ CCDC CCDC-EF16 chưa đầy đủ.", warn_msgs)

        # Khôi phục dữ liệu CCDC-EF16 hợp lệ
        tool_ef.accessories = [{"unit": "Cái"}]
        tool_ef.save(update_fields=["accessories"])

        # EF15: Chưa đủ dữ liệu đối chiếu TK 242 theo đối tượng nguồn
        ef15 = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "RECONCILE_TOOL_GL_242",
                "period_type": "MONTH",
                "year": 2026,
                "month": 8,
                "unlinked_242_data": True,
            },
            format="json",
        )
        self.assertEqual(ef15.status_code, 400)
        self.assertEqual(str(ef15.data["detail"]), "Chưa đủ dữ liệu đối chiếu TK 242 theo đối tượng nguồn.")

        # EF17: Từ khóa tìm kiếm không khớp báo cáo nào
        ef17 = self.client.post(
            cat_url,
            {"company": str(self.company.id), "search": "BAO_CAO_KHONG_TON_TAI_XYZ"},
            format="json",
        )
        self.assertEqual(ef17.status_code, 200)
        self.assertEqual(ef17.data["message"], "Không tìm thấy báo cáo phù hợp.")

        # EF18: User không có quyền xem chi tiết CCDC này
        ef18 = self.client.post(
            trace_url,
            {"company": str(self.company.id), "tool_id": str(tool_ef.id), "has_detail_permission": False},
            format="json",
        )
        self.assertEqual(ef18.status_code, 403)
        self.assertEqual(str(ef18.data["detail"]), "Bạn không có quyền xem chi tiết CCDC này.")

        # EF19: Chứng từ gốc đã bị hủy hoặc không tồn tại
        ef19 = self.client.post(
            trace_url,
            {"company": str(self.company.id), "voucher_no": "CHUNG-TU-KHONG-TON-TAI"},
            format="json",
        )
        self.assertEqual(ef19.status_code, 400)
        self.assertEqual(str(ef19.data["detail"]), "Không tìm thấy chứng từ liên quan hoặc chứng từ không còn hiệu lực.")

        # EF20: User nhấn Xuất khẩu nhưng không có quyền xuất dữ liệu
        ef20 = self.client.post(
            exp_url,
            {"company": str(self.company.id), "has_export_permission": False},
            format="json",
        )
        self.assertEqual(ef20.status_code, 403)
        self.assertEqual(str(ef20.data["detail"]), "Bạn không có quyền xuất dữ liệu này.")

        # EF21: Lỗi khi tạo tệp Excel
        ef21 = self.client.post(
            exp_url,
            {"company": str(self.company.id), "simulate_export_error": True},
            format="json",
        )
        self.assertEqual(ef21.status_code, 400)
        self.assertEqual(str(ef21.data["detail"]), "Xuất Excel thất bại. Vui lòng thử lại.")

        # EF22: Lỗi khi tạo bản in báo cáo
        ef22 = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_REGISTER_REPORT",
                "period_type": "MONTH",
                "year": 2026,
                "month": 8,
                "print_report": True,
                "simulate_print_error": True,
            },
            format="json",
        )
        self.assertEqual(ef22.status_code, 400)
        self.assertEqual(str(ef22.data["detail"]), "Không thể tạo bản in báo cáo. Vui lòng thử lại.")

        # EF23: Dữ liệu đã thay đổi trong lúc chuẩn bị tệp
        ef23 = self.client.post(
            exp_url,
            {"company": str(self.company.id), "force_version_conflict": True},
            format="json",
        )
        self.assertEqual(ef23.status_code, 400)
        self.assertEqual(str(ef23.data["detail"]), "Dữ liệu đã thay đổi trong lúc chuẩn bị tệp. Vui lòng tải lại dữ liệu.")

        # EF24: Ngôn ngữ báo cáo được chọn chưa có mẫu tương ứng
        ef24 = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_REGISTER_REPORT",
                "period_type": "MONTH",
                "year": 2026,
                "month": 8,
                "lang": "fr",
            },
            format="json",
        )
        self.assertEqual(ef24.status_code, 400)
        self.assertEqual(str(ef24.data["detail"]), "Mẫu báo cáo chưa hỗ trợ ngôn ngữ này.")

        # EF25: Tìm kiếm thông minh AVA không xác định được báo cáo phù hợp
        ef25 = self.client.post(
            cat_url,
            {"company": str(self.company.id), "ava_query": "xyz_khong_xac_dinh_duoc_bao_cao_nao"},
            format="json",
        )
        self.assertEqual(ef25.status_code, 400)
        self.assertEqual(str(ef25.data["detail"]), "Chưa xác định được báo cáo phù hợp. Vui lòng nhập rõ tên hoặc nội dung cần xem.")

        # EF26: Không thể tải dữ liệu báo cáo / sổ theo dõi
        ef26_reg = self.client.post(
            reg_url,
            {"company": str(self.company.id), "simulate_load_error": True},
            format="json",
        )
        self.assertEqual(ef26_reg.status_code, 400)
        self.assertEqual(str(ef26_reg.data["detail"]), "Không thể tải Sổ theo dõi CCDC. Vui lòng thử lại.")

        ef26_rep = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_REGISTER_REPORT",
                "period_type": "MONTH",
                "year": 2026,
                "month": 8,
                "simulate_load_error": True,
            },
            format="json",
        )
        self.assertEqual(ef26_rep.status_code, 400)
        self.assertEqual(str(ef26_rep.data["detail"]), "Không thể tải dữ liệu báo cáo. Vui lòng thử lại.")

        # EF27: Lỗi tràn số hoặc dữ liệu không hợp lệ khi tổng hợp báo cáo
        ef27 = self.client.post(
            rep_url,
            {
                "company": str(self.company.id),
                "report_code": "TOOL_REGISTER_REPORT",
                "period_type": "MONTH",
                "year": 2026,
                "month": 8,
                "simulate_overflow_error": True,
            },
            format="json",
        )
        self.assertEqual(ef27.status_code, 400)
        self.assertEqual(str(ef27.data["detail"]), "Không thể tổng hợp báo cáo do dữ liệu không hợp lệ.")

        # EF01 & EF02: User không có quyền xem Sổ theo dõi CCDC hoặc Báo cáo CCDC
        no_perm_user = get_user_model().objects.create_user(username="no-uc16-perm", email="nouc16@fa.test", password="x")
        self.client.force_authenticate(no_perm_user)
        ef01 = self.client.post(reg_url, {"company": str(self.company.id)}, format="json")
        self.assertEqual(ef01.status_code, 403)
        self.assertEqual(str(ef01.data["detail"]), "Bạn không có quyền xem Sổ theo dõi công cụ dụng cụ.")

        ef02 = self.client.post(rep_url, {"company": str(self.company.id), "report_code": "TOOL_REGISTER_REPORT"}, format="json")
        self.assertEqual(ef02.status_code, 403)
        self.assertEqual(str(ef02.data["detail"]), "Bạn không có quyền xem báo cáo này.")





