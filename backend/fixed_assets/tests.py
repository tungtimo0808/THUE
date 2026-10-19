from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import Account, AccountClass, ChartOfAccounts
from master_data.models import Currency
from organization.models import Branch, Company, Department, Employee
from .models import AssetRecord, AssetTransaction


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
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="Hệ thống", effective_from=self.today, is_default=True)
        self.accounts = [
            Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class, code=code, name=name, account_type="ASSET", normal_balance="DEBIT")
            for code, name in (("211", "TSCĐ"), ("214", "Hao mòn"), ("642", "Chi phí"))
        ]
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
