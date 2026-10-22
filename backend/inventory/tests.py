from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import Account, AccountBalance, AccountingPeriod, ChartOfAccounts, JournalEntry
from master_data.models import Currency, Item, ItemCategory, UnitOfMeasure, Warehouse, Party
from sales.models import GoodsSale, GoodsSaleLine
from organization.models import Branch, Company
from .models import InventoryTransaction, InventoryPolicy, StockBalance, StockMovement, ValuationRun


class InventoryApiTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="INVCO", name="Inventory Co", legal_name="Inventory Company", tax_code="0100998877",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        self.source = Warehouse.objects.create(company=self.company, branch=self.branch, code="K1", name="Kho 1")
        self.destination = Warehouse.objects.create(company=self.company, branch=self.branch, code="K2", name="Kho 2")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        category = ItemCategory.objects.create(company=self.company, code="HH", name="Hàng hóa")
        self.item = Item.objects.create(
            company=self.company, category=category, base_uom=self.uom, code="SP01", name="Sản phẩm 01",
            item_type="GOODS", track_inventory=True, valuation_method="MOVING_AVERAGE",
        )
        self.maker = get_user_model().objects.create_superuser(username="inv-maker", email="maker@inv.test", password="x")
        self.approver = get_user_model().objects.create_superuser(username="inv-approver", email="approver@inv.test", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.maker)
        self.query = f"?company_id={self.company.id}"
        response = self.client.post(
            f"/api/v1/inventory/policies/{self.query}",
            {
                "company": str(self.company.id), "warehouse": str(self.source.id), "item": str(self.item.id),
                "base_uom": str(self.uom.id), "minimum_quantity": "2", "maximum_quantity": "100",
                "valuation_method": "MOVING_AVERAGE",
            }, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def create_and_post(self, number, kind, quantity, source=None, destination=None, cost="10"):
        response = self.client.post(
            f"/api/v1/inventory/transactions/{self.query}",
            {
                "company": str(self.company.id), "number": number, "transaction_type": kind,
                "transaction_date": str(self.today),
                "source_warehouse": str(source.id) if source else None,
                "destination_warehouse": str(destination.id) if destination else None,
                "source_module": "TEST", "source_reference": number, "idempotency_key": f"key-{number}",
                "lines": [{"line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id), "quantity": str(quantity), "unit_cost": cost}],
            }, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        transaction_id = response.data["id"]
        submitted = self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/submit/{self.query}", {}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.client.force_authenticate(self.approver)
        approved = self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/approve/{self.query}", {"comment": "Đồng ý"}, format="json")
        self.assertEqual(approved.data["status"], "APPROVED", approved.data)
        posted = self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.client.force_authenticate(self.maker)
        return transaction_id

    def test_count_resolution_partial_approval_and_post(self):
        self.create_and_post("NK-COUNT-07", "RECEIPT", 10, destination=self.source, cost="20")
        chart = ChartOfAccounts.objects.create(company=self.company, code="INV07", name="Chart", effective_from=self.today)
        debit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Hàng hóa")
        credit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="338", name="Phải trả khác")
        AccountingPeriod.objects.create(company=self.company, code="INV07-P", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        count = self.client.post(f"/api/v1/inventory/counts/{self.query}", {
            "company": str(self.company.pk), "number": "KK-07", "warehouse": str(self.source.pk),
            "count_date": str(self.today), "snapshot_at": timezone.now().isoformat(),
            "lines": [{"item": str(self.item.pk), "actual_quantity": "12"}],
        }, format="json")
        self.assertEqual(count.status_code, 201, count.data)
        count_id = count.data["id"]
        line_id = count.data["lines"][0]["id"]
        self.assertEqual(self.client.post(f"/api/v1/inventory/counts/{count_id}/create-adjustment/{self.query}", {}, format="json").status_code, 400)
        confirmed = self.client.post(f"/api/v1/inventory/counts/{count_id}/confirm/{self.query}", {}, format="json")
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(confirmed.data["status"], "COUNTED")
        proposal = self.client.post(f"/api/v1/inventory/count-resolutions/{self.query}", {
            "company": str(self.company.pk), "count_line": line_id, "reason_code": "SURPLUS",
            "explanation": "Hàng thừa đã xác minh", "method": "INCREASE", "quantity": "1",
            "proposed_unit_cost": "25", "valuation_basis": "Biên bản xác minh giá",
        }, format="json")
        self.assertEqual(proposal.status_code, 201, proposal.data)
        proposal_id = proposal.data["id"]
        prefix = f"/api/v1/inventory/count-resolutions/{proposal_id}/"
        self.assertEqual(self.client.post(f"{prefix}submit/{self.query}", {}, format="json").status_code, 200)
        self.assertEqual(self.client.post(f"{prefix}approve/{self.query}", {}, format="json").status_code, 400)
        self.client.force_authenticate(self.approver)
        approved = self.client.post(f"{prefix}approve/{self.query}", {}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.client.force_authenticate(self.maker)
        overbook = self.client.post(f"/api/v1/inventory/count-resolutions/{self.query}", {
            "company": str(self.company.pk), "count_line": line_id, "reason_code": "SURPLUS",
            "explanation": "Phần còn lại", "method": "INCREASE", "quantity": "2",
            "proposed_unit_cost": "25", "valuation_basis": "Biên bản xác minh giá",
        }, format="json")
        self.assertEqual(overbook.status_code, 201, overbook.data)
        blocked = self.client.post(f"/api/v1/inventory/count-resolutions/{overbook.data['id']}/submit/{self.query}", {}, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.client.force_authenticate(self.maker)
        voucher = self.client.post(f"{prefix}create-voucher/{self.query}", {
            "number": "DC-07", "transaction_date": str(self.today),
            "debit_account": str(debit.pk), "credit_account": str(credit.pk),
        }, format="json")
        self.assertEqual(voucher.status_code, 201, voucher.data)
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("10"))
        self.assertEqual(self.client.post(f"{prefix}create-voucher/{self.query}", {
            "number": "DC-07-B", "transaction_date": str(self.today),
            "debit_account": str(debit.pk), "credit_account": str(credit.pk),
        }, format="json").status_code, 400)
        posted = self.client.post(f"{prefix}post-voucher/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(posted.data["gl_status"], "POSTED")
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("11"))
        self.assertEqual(self.client.post(f"{prefix}post-voucher/{self.query}", {}, format="json").status_code, 400)
        self.assertEqual(self.client.get(f"/api/v1/inventory/counts/{count_id}/{self.query}").data["status"], "COUNTED")
        second_id = overbook.data["id"]
        edited = self.client.patch(f"/api/v1/inventory/count-resolutions/{second_id}/{self.query}",
            {"quantity": "1"}, format="json")
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(self.client.post(f"/api/v1/inventory/count-resolutions/{second_id}/submit/{self.query}", {}, format="json").status_code, 200)
        self.client.force_authenticate(self.approver)
        self.assertEqual(self.client.post(f"/api/v1/inventory/count-resolutions/{second_id}/approve/{self.query}", {}, format="json").status_code, 200)
        self.client.force_authenticate(self.maker)
        second_prefix = f"/api/v1/inventory/count-resolutions/{second_id}/"
        self.assertEqual(self.client.post(f"{second_prefix}create-voucher/{self.query}", {
            "number": "DC-07-2", "transaction_date": str(self.today),
            "debit_account": str(debit.pk), "credit_account": str(credit.pk),
        }, format="json").status_code, 201)
        self.assertEqual(self.client.post(f"{second_prefix}post-voucher/{self.query}", {}, format="json").status_code, 200)
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("12"))
        self.assertEqual(self.client.get(f"/api/v1/inventory/counts/{count_id}/{self.query}").data["status"], "ADJUSTED")

    def test_stock_summary_uses_posted_movements_and_opening_balance(self):
        self.create_and_post("NK-RPT-1", "RECEIPT", 10, destination=self.source, cost="20")
        balance = StockBalance.objects.get(warehouse=self.source, item=self.item)
        # Imported opening balance: no StockMovement row for these five units.
        balance.quantity = Decimal("15")
        balance.inventory_value = Decimal("250")
        balance.average_cost = Decimal("250") / Decimal("15")
        balance.save(update_fields=("quantity", "inventory_value", "average_cost"))
        self.create_and_post("XK-RPT-1", "ISSUE", 3, source=self.source, cost="0")
        self.create_and_post("NK-RPT-2", "RECEIPT", 4, destination=self.destination, cost="30")
        draft = self.client.post(f"/api/v1/inventory/transactions/{self.query}", {
            "company": str(self.company.pk), "number": "XK-RPT-DRAFT", "transaction_type": "ISSUE",
            "transaction_date": str(self.today), "source_warehouse": str(self.source.pk),
            "lines": [{"line_no": 1, "item": str(self.item.pk), "uom": str(self.uom.pk), "quantity": "2"}],
        }, format="json")
        self.assertEqual(draft.status_code, 201, draft.data)
        path = f"/api/v1/inventory/balances/summary/?company_id={self.company.pk}&date_from={self.today}&date_to={self.today}"
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["rows"]), 2)
        rows = {row["warehouse_id"]: row for row in response.data["rows"]}
        source = rows[str(self.source.pk)]
        self.assertEqual(source["opening_quantity"], Decimal("5"))
        self.assertEqual(source["opening_value"], Decimal("50"))
        self.assertEqual(source["receipt_quantity"], Decimal("10"))
        self.assertEqual(source["issue_quantity"], Decimal("3"))
        self.assertEqual(source["closing_quantity"], Decimal("12"))
        self.assertEqual(source["closing_value"], Decimal("200"))
        self.assertEqual(rows[str(self.destination.pk)]["receipt_quantity"], Decimal("4"))
        combined = self.client.get(path.replace("/summary/", "/multi-warehouse-summary/"))
        self.assertEqual(combined.status_code, 200, combined.data)
        self.assertEqual(len(combined.data["rows"]), 1)
        self.assertEqual(combined.data["currency"], "VND")
        self.assertEqual(combined.data["rows"][0]["opening_quantity"], Decimal("5"))
        self.assertEqual(combined.data["rows"][0]["receipt_quantity"], Decimal("14"))
        self.assertEqual(combined.data["rows"][0]["issue_quantity"], Decimal("3"))
        self.assertEqual(combined.data["rows"][0]["closing_quantity"], Decimal("16"))
        self.assertEqual(combined.data["rows"][0]["closing_value"], Decimal("320"))
        ledger = self.client.get(path.replace("/summary/", "/movement-detail/") + f"&item_id={self.item.pk}")
        self.assertEqual(ledger.status_code, 200, ledger.data)
        self.assertEqual(len(ledger.data["movements"]), 3)
        self.assertEqual(sum((row["quantity_delta"] for row in ledger.data["movements"]), Decimal("0")), Decimal("11"))
        one = self.client.get(path + f"&warehouse_ids={self.source.pk}")
        self.assertEqual(len(one.data["rows"]), 1)
        self.assertEqual(one.data["rows"][0]["item_code"], "SP01")
        category = self.item.category
        filtered = self.client.get(path + f"&category_id={category.pk}")
        self.assertEqual(len(filtered.data["rows"]), 2)
        invalid = self.client.get(path + "&warehouse_ids=00000000-0000-4000-8000-000000000000")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.client.get(path.replace(f"date_from={self.today}", "date_from=2026-99-99")).status_code, 400)

    def test_stock_summary_respects_warehouse_scope(self):
        self.create_and_post("NK-RPT-SCOPE-1", "RECEIPT", 2, destination=self.source)
        self.create_and_post("NK-RPT-SCOPE-2", "RECEIPT", 3, destination=self.destination)
        period = AccountingPeriod.objects.create(company=self.company, code="SCOPE-COST", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        user = get_user_model().objects.create_user(username="inv-scoped", password="x")
        self.client.force_authenticate(user)
        allowed = lambda _account, _company, _code, **scope: str(scope.get("warehouse_id")) == str(self.source.pk)
        path = f"/api/v1/inventory/balances/summary/?company_id={self.company.pk}&date_from={self.today}&date_to={self.today}"
        with patch("inventory.permissions.has_effective_permission", side_effect=allowed), \
             patch("inventory.stock_summary.has_effective_permission", side_effect=allowed), \
             patch("inventory.costing.has_effective_permission", side_effect=allowed):
            options = self.client.get(f"/api/v1/inventory/balances/summary-options/{self.query}")
            self.assertEqual(options.status_code, 200, options.data)
            self.assertEqual([row["id"] for row in options.data["warehouses"]], [str(self.source.pk)])
            report = self.client.get(path)
            self.assertEqual(report.status_code, 200, report.data)
            self.assertEqual([row["warehouse_id"] for row in report.data["rows"]], [str(self.source.pk)])
            combined = self.client.get(path.replace("/summary/", "/multi-warehouse-summary/"))
            self.assertEqual([row["closing_quantity"] for row in combined.data["rows"]], [Decimal("2")])
            ledger = self.client.get(path.replace("/summary/", "/movement-detail/") + f"&item_id={self.item.pk}")
            self.assertEqual([row["warehouse_id"] for row in ledger.data["movements"]], [str(self.source.pk)])
            forbidden = self.client.get(path + f"&warehouse_ids={self.destination.pk}")
            self.assertEqual(forbidden.status_code, 403, forbidden.data)
            self.assertEqual(self.client.get(path.replace("/summary/", "/multi-warehouse-summary/") + f"&warehouse_ids={self.destination.pk}").status_code, 403)
            costing_options = self.client.get(f"/api/v1/inventory/valuations/options/{self.query}")
            self.assertEqual([row["id"] for row in costing_options.data["warehouses"]], [str(self.source.pk)])
            payload = {"company": str(self.company.pk), "period": str(period.pk), "method": "MOVING_AVERAGE"}
            self.assertEqual(self.client.post(f"/api/v1/inventory/valuations/{self.query}", payload, format="json").status_code, 403)
            self.assertEqual(self.client.post(f"/api/v1/inventory/valuations/{self.query}",
                {**payload, "warehouse": str(self.destination.pk)}, format="json").status_code, 403)

    def test_periodic_costing_updates_issue_stock_and_adjustment_journal(self):
        policy = InventoryPolicy.objects.get(warehouse=self.source, item=self.item)
        policy.valuation_method = "PERIODIC_AVERAGE"
        policy.save(update_fields=("valuation_method",))
        period = AccountingPeriod.objects.create(company=self.company, code="COST-10", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        chart = ChartOfAccounts.objects.create(company=self.company, code="COST-10", name="Costing", effective_from=self.today)
        cogs = Account.objects.create(company=self.company, chart_of_accounts=chart, code="632", name="Giá vốn")
        inventory = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Hàng tồn kho")
        self.create_and_post("NK-COST-1", "RECEIPT", 10, destination=self.source, cost="10")
        created = self.client.post(f"/api/v1/inventory/transactions/{self.query}", {
            "company": str(self.company.pk), "number": "XK-COST-1", "transaction_type": "ISSUE",
            "source_module": "INV_OTHER_ISSUE", "transaction_date": str(self.today), "document_date": str(self.today),
            "source_warehouse": str(self.source.pk), "reason": "Xuất dùng",
            "lines": [{"line_no": 1, "item": str(self.item.pk), "uom": str(self.uom.pk),
                "source_warehouse": str(self.source.pk), "quantity": "4", "unit_cost": "0",
                "debit_account": str(cogs.pk), "credit_account": str(inventory.pk)}],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        issue_id = created.data["id"]
        self.assertEqual(self.client.post(f"/api/v1/inventory/transactions/{issue_id}/submit/{self.query}", {}, format="json").status_code, 200)
        self.client.force_authenticate(self.approver)
        self.assertEqual(self.client.post(f"/api/v1/inventory/transactions/{issue_id}/approve/{self.query}", {}, format="json").status_code, 200)
        posted = self.client.post(f"/api/v1/inventory/transactions/{issue_id}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.client.force_authenticate(self.maker)
        self.create_and_post("NK-COST-2", "RECEIPT", 10, destination=self.source, cost="20")
        payload = {"company": str(self.company.pk), "period": str(period.pk), "warehouse": str(self.source.pk),
            "method": "PERIODIC_AVERAGE"}
        result = self.client.post(f"/api/v1/inventory/valuations/{self.query}", payload, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["details"]["updated_lines"], 1)
        self.assertEqual(InventoryTransaction.objects.get(pk=issue_id).lines.get().line_value, Decimal("60"))
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).inventory_value, Decimal("240"))
        self.assertEqual(JournalEntry.objects.get(source_event_id=f"INV.COST:{result.data['id']}").total_debit, Decimal("20"))
        self.assertEqual(self.client.post(f"/api/v1/inventory/valuations/{self.query}", payload, format="json").status_code, 400)
        rerun = self.client.post(f"/api/v1/inventory/valuations/{self.query}", {**payload, "recalculate": True}, format="json")
        self.assertEqual(rerun.status_code, 201, rerun.data)
        self.assertEqual(rerun.data["details"]["adjustments"], 0)
        period.status = "CLOSED"
        period.save(update_fields=("status",))
        self.assertEqual(self.client.post(f"/api/v1/inventory/valuations/{self.query}", {**payload, "recalculate": True}, format="json").status_code, 400)

    def test_fifo_costing_consumes_oldest_layer_and_rolls_back_on_missing_accounts(self):
        policy = InventoryPolicy.objects.get(warehouse=self.source, item=self.item)
        policy.valuation_method = "FIFO"
        policy.save(update_fields=("valuation_method",))
        period = AccountingPeriod.objects.create(company=self.company, code="FIFO-10", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        chart = ChartOfAccounts.objects.create(company=self.company, code="FIFO-10", name="FIFO", effective_from=self.today)
        cogs = Account.objects.create(company=self.company, chart_of_accounts=chart, code="632", name="Giá vốn")
        inventory = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Hàng tồn kho")
        self.create_and_post("NK-FIFO-1", "RECEIPT", 10, destination=self.source, cost="10")
        self.create_and_post("NK-FIFO-2", "RECEIPT", 10, destination=self.source, cost="20")
        issue_id = self.create_and_post("XK-FIFO-1", "ISSUE", 15, source=self.source, cost="0")
        line = InventoryTransaction.objects.get(pk=issue_id).lines.get()
        self.assertEqual(line.costing_status, "PENDING")
        report_path = f"/api/v1/inventory/balances/summary/?company_id={self.company.pk}&date_from={self.today}&date_to={self.today}"
        self.assertIsNone(self.client.get(report_path).data["rows"][0]["closing_value"])
        payload = {"company": str(self.company.pk), "period": str(period.pk), "warehouse": str(self.source.pk),
            "method": "FIFO"}
        before = StockBalance.objects.get(warehouse=self.source, item=self.item).inventory_value
        failed = self.client.post(f"/api/v1/inventory/valuations/{self.query}", payload, format="json")
        self.assertEqual(failed.status_code, 400, failed.data)
        self.assertEqual(ValuationRun.objects.filter(company=self.company, status="FAILED").count(), 1)
        self.assertFalse(ValuationRun.objects.filter(company=self.company, status="COMPLETED").exists())
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).inventory_value, before)
        self.assertEqual(line.line_value, InventoryTransaction.objects.get(pk=issue_id).lines.get().line_value)
        line.debit_account, line.credit_account = cogs, inventory
        line.save(update_fields=("debit_account", "credit_account"))
        result = self.client.post(f"/api/v1/inventory/valuations/{self.query}", payload, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        line.refresh_from_db()
        self.assertEqual(line.line_value, Decimal("200"))
        self.assertEqual(line.costing_status, "COMPLETED")
        self.assertEqual(self.client.get(report_path).data["rows"][0]["closing_value"], Decimal("100"))
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).inventory_value, Decimal("100"))
        self.assertEqual(JournalEntry.objects.get(source_event_id=f"INV.COST:{result.data['id']}").total_debit, Decimal("25"))

    def test_moving_average_costing_has_no_duplicate_journal(self):
        period = AccountingPeriod.objects.create(company=self.company, code="AVG-10", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        self.create_and_post("NK-AVG-1", "RECEIPT", 10, destination=self.source, cost="10")
        issue_id = self.create_and_post("XK-AVG-1", "ISSUE", 4, source=self.source, cost="0")
        result = self.client.post(f"/api/v1/inventory/valuations/{self.query}", {
            "company": str(self.company.pk), "period": str(period.pk), "warehouse": str(self.source.pk),
            "method": "MOVING_AVERAGE"}, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["details"]["adjustments"], 0)
        self.assertEqual(InventoryTransaction.objects.get(pk=issue_id).lines.get().line_value, Decimal("40"))
        self.assertFalse(JournalEntry.objects.filter(source_event_id=f"INV.COST:{result.data['id']}").exists())

    def test_other_receipt_draft_edit_atomic_post_and_duplicate(self):
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="Chart", effective_from=self.today)
        debit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Hàng hóa")
        credit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="338", name="Phải trả khác")
        period = AccountingPeriod.objects.create(company=self.company, code="P1", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        payload = {
            "company": str(self.company.id), "number": "NK-OTHER-1", "transaction_type": "RECEIPT",
            "source_module": "INV_OTHER", "document_date": str(self.today), "transaction_date": str(self.today),
            "destination_warehouse": str(self.destination.id), "reason": "Nhập vật tư trả lại",
            "lines": [{"line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id),
                       "quantity": "2", "unit_cost": "100", "debit_account": str(debit.id), "credit_account": str(credit.id)}],
        }
        created = self.client.post(f"/api/v1/inventory/transactions/{self.query}", payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(Decimal(created.data["total_value"]), Decimal("200"))
        pk = created.data["id"]
        self.assertFalse(StockBalance.objects.filter(warehouse=self.destination, item=self.item).exists())
        self.assertFalse(JournalEntry.objects.filter(source_event_id=f"INV.OTHER:{pk}").exists())
        duplicate = self.client.post(f"/api/v1/inventory/transactions/{self.query}", payload, format="json")
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        edited = self.client.patch(f"/api/v1/inventory/transactions/{pk}/{self.query}",
            {"lines": [{**payload["lines"][0], "quantity": "3"}]}, format="json")
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(Decimal(edited.data["total_value"]), Decimal("300"))
        submitted = self.client.post(f"/api/v1/inventory/transactions/{pk}/submit/{self.query}", {}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.client.force_authenticate(self.approver)
        approved = self.client.post(f"/api/v1/inventory/transactions/{pk}/approve/{self.query}", {"comment": "OK"}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        period.status = "CLOSED"
        period.save(update_fields=("status",))
        blocked = self.client.post(f"/api/v1/inventory/transactions/{pk}/post/{self.query}", {}, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertFalse(StockBalance.objects.filter(warehouse=self.destination, item=self.item).exists())
        period.status = "OPEN"
        period.save(update_fields=("status",))
        debit.requires_party = True
        debit.save(update_fields=("requires_party",))
        failed_gl = self.client.post(f"/api/v1/inventory/transactions/{pk}/post/{self.query}", {}, format="json")
        self.assertEqual(failed_gl.status_code, 400, failed_gl.data)
        self.assertFalse(StockBalance.objects.filter(warehouse=self.destination, item=self.item).exists())
        self.assertFalse(JournalEntry.objects.filter(source_event_id=f"INV.OTHER:{pk}").exists())
        debit.requires_party = False
        debit.save(update_fields=("requires_party",))
        posted = self.client.post(f"/api/v1/inventory/transactions/{pk}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(posted.data["gl_status"], "POSTED")
        self.assertEqual(StockBalance.objects.get(warehouse=self.destination, item=self.item).quantity, Decimal("3"))
        self.assertEqual(StockBalance.objects.get(warehouse=self.destination, item=self.item).inventory_value, Decimal("300"))
        journal = JournalEntry.objects.get(source_event_id=f"INV.OTHER:{pk}")
        self.assertEqual(journal.status, "POSTED")
        self.assertEqual(journal.total_debit, Decimal("300"))
        self.assertEqual(AccountBalance.objects.get(period=period, account=debit).period_debit, Decimal("300"))
        again = self.client.post(f"/api/v1/inventory/transactions/{pk}/post/{self.query}", {}, format="json")
        self.assertEqual(again.status_code, 400, again.data)

    def test_receipt_issue_transfer_history_and_gl(self):
        receipt_id = self.create_and_post("NK-001", "RECEIPT", 10, destination=self.source, cost="50")
        balance = StockBalance.objects.get(warehouse=self.source, item=self.item)
        self.assertEqual(balance.quantity, Decimal("10"))
        self.assertEqual(balance.inventory_value, Decimal("500"))
        issue_id = self.create_and_post("XK-001", "ISSUE", 3, source=self.source, cost="0")
        balance.refresh_from_db()
        self.assertEqual(balance.quantity, Decimal("7"))
        self.assertEqual(InventoryTransaction.objects.get(pk=issue_id).total_value, Decimal("150"))
        transfer_id = self.create_and_post("DC-001", "TRANSFER", 2, source=self.source, destination=self.destination, cost="0")
        balance.refresh_from_db()
        self.assertEqual(balance.quantity, Decimal("5"))
        self.assertEqual(StockBalance.objects.get(warehouse=self.destination, item=self.item).quantity, Decimal("2"))
        self.assertEqual(StockMovement.objects.filter(transaction_id=transfer_id).count(), 2)
        gl = self.client.post(
            f"/api/v1/inventory/transactions/{receipt_id}/post-gl/{self.query}",
            {"gl_reference": "GL-INV-001", "total_debit": "500", "total_credit": "500"}, format="json",
        )
        self.assertEqual(gl.status_code, 200, gl.data)
        self.assertEqual(gl.data["gl_status"], "POSTED")
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="INV").exists())

    def test_other_issue_draft_multi_warehouse_atomic_post(self):
        self.create_and_post("NK-OTHER-STOCK-1", "RECEIPT", 5, destination=self.source, cost="20")
        self.create_and_post("NK-OTHER-STOCK-2", "RECEIPT", 4, destination=self.destination, cost="30")
        chart = ChartOfAccounts.objects.create(company=self.company, code="XK04", name="Chart", effective_from=self.today)
        debit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="642", name="Chi phí quản lý")
        credit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Hàng hóa")
        period = AccountingPeriod.objects.create(company=self.company, code="XK04", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        payload = {"company": str(self.company.pk), "number": "XK-OTHER-04", "transaction_type": "ISSUE",
            "source_module": "INV_OTHER_ISSUE", "document_date": str(self.today), "transaction_date": str(self.today),
            "source_warehouse": str(self.source.pk), "reason": "Xuất sử dụng nội bộ",
            "document_metadata": {"partner_name": "Bộ phận quản lý", "partner_address": "Hà Nội", "attached_documents": "1"},
            "lines": [{"line_no": index, "item": str(self.item.pk), "uom": str(self.uom.pk), "quantity": "2",
                "unit_cost": "0", "source_warehouse": str(warehouse.pk), "debit_account": str(debit.pk),
                "credit_account": str(credit.pk)} for index, warehouse in enumerate((self.source, self.destination), start=1)]}
        created = self.client.post(f"/api/v1/inventory/transactions/{self.query}", payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        pk = created.data["id"]
        self.assertEqual(created.data["document_metadata"]["partner_address"], "Hà Nội")
        edited = self.client.patch(f"/api/v1/inventory/transactions/{pk}/{self.query}",
            {"document_metadata": {"partner_name": "Bộ phận quản lý", "partner_address": "Hà Nội", "attached_documents": "2"}}, format="json")
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("5"))
        submitted = self.client.post(f"/api/v1/inventory/transactions/{pk}/submit/{self.query}", {}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.client.force_authenticate(self.approver)
        approved = self.client.post(f"/api/v1/inventory/transactions/{pk}/approve/{self.query}", {}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        posted = self.client.post(f"/api/v1/inventory/transactions/{pk}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(posted.data["gl_status"], "POSTED")
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("3"))
        self.assertEqual(StockBalance.objects.get(warehouse=self.destination, item=self.item).quantity, Decimal("2"))
        self.assertEqual(JournalEntry.objects.get(source_event_id=f"INV.OTHER:{pk}").total_debit, Decimal("100"))
        self.assertEqual(self.client.post(f"/api/v1/inventory/transactions/{pk}/post/{self.query}", {}, format="json").status_code, 400)

    def test_sales_issue_partial_quantities_and_no_duplicate_cogs(self):
        self.create_and_post("NK-SALE-STOCK", "RECEIPT", 8, destination=self.source, cost="20")
        chart = ChartOfAccounts.objects.create(company=self.company, code="SAL-ISSUE", name="Chart", effective_from=self.today)
        debit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="632", name="Giá vốn")
        credit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Hàng hóa")
        AccountingPeriod.objects.create(company=self.company, code="SAL-ISSUE", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        customer = Party.objects.create(company=self.company, code="CUS-ISSUE", name="Khách hàng")
        sale = GoodsSale.objects.create(company=self.company, branch=self.branch, number="BH-SALE-ISSUE",
            document_date=self.today, posting_date=self.today, customer=customer, currency=self.company.accounting_currency,
            status="POSTED", inventory_handling="SEPARATE_ISSUE", created_by=self.maker.iam_account)
        sale_line = GoodsSaleLine.objects.create(sale=sale, line_no=1, item=self.item, uom=self.uom,
            quantity=Decimal("5"), unit_price=Decimal("30"), cogs_account=debit, inventory_account=credit)
        def issue(number, qty):
            payload = {"company": str(self.company.pk), "number": number, "transaction_type": "ISSUE",
                "source_module": "INV_SALE_ISSUE", "source_reference": str(sale.pk), "supplier": str(customer.pk),
                "document_date": str(self.today), "transaction_date": str(self.today), "source_warehouse": str(self.source.pk),
                "reason": "Xuất bán hàng", "lines": [{"line_no": 1, "item": str(self.item.pk), "uom": str(self.uom.pk),
                "sale_line": str(sale_line.pk), "source_warehouse": str(self.source.pk), "quantity": str(qty),
                "unit_cost": "0", "debit_account": str(debit.pk), "credit_account": str(credit.pk)}]}
            created = self.client.post(f"/api/v1/inventory/transactions/{self.query}", payload, format="json")
            self.assertEqual(created.status_code, 201, created.data)
            pk = created.data["id"]
            self.assertEqual(self.client.post(f"/api/v1/inventory/transactions/{pk}/submit/{self.query}", {}, format="json").status_code, 200)
            self.client.force_authenticate(self.approver)
            self.assertEqual(self.client.post(f"/api/v1/inventory/transactions/{pk}/approve/{self.query}", {}, format="json").status_code, 200)
            posted = self.client.post(f"/api/v1/inventory/transactions/{pk}/post/{self.query}", {}, format="json")
            self.assertEqual(posted.status_code, 200, posted.data)
            self.client.force_authenticate(self.maker)
            return pk
        first = issue("XK-SALE-1", 2)
        second = issue("XK-SALE-2", 3)
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("3"))
        self.assertEqual(JournalEntry.objects.get(source_event_id=f"INV.OTHER:{first}").total_debit, Decimal("40"))
        self.assertEqual(JournalEntry.objects.get(source_event_id=f"INV.OTHER:{second}").total_debit, Decimal("60"))
        report = self.client.get(f"/api/v1/inventory/balances/summary/?company_id={self.company.pk}&date_from={self.today}&date_to={self.today}")
        self.assertEqual(report.status_code, 200, report.data)
        self.assertEqual(report.data["rows"][0]["issue_quantity"], Decimal("5"))
        self.assertEqual(report.data["rows"][0]["issue_value"], Decimal("100"))
        self.assertFalse(report.data["rows"][0]["valuation_incomplete"])
        extra = self.client.post(f"/api/v1/inventory/transactions/{self.query}", {"company": str(self.company.pk),
            "number": "XK-SALE-3", "transaction_type": "ISSUE", "source_module": "INV_SALE_ISSUE",
            "source_reference": str(sale.pk), "document_date": str(self.today), "transaction_date": str(self.today),
            "source_warehouse": str(self.source.pk), "reason": "Xuất trùng", "lines": [{"line_no": 1, "item": str(self.item.pk),
            "uom": str(self.uom.pk), "sale_line": str(sale_line.pk), "source_warehouse": str(self.source.pk),
            "quantity": "1", "unit_cost": "0", "debit_account": str(debit.pk), "credit_account": str(credit.pk)}]}, format="json")
        self.assertEqual(extra.status_code, 400, extra.data)

    def test_sales_issue_uc_inv_03_sources_status_and_exceptions(self):
        self.create_and_post("NK-UC03-K1", "RECEIPT", 4, destination=self.source, cost="20")
        self.create_and_post("NK-UC03-K2", "RECEIPT", 3, destination=self.destination, cost="30")
        chart = ChartOfAccounts.objects.create(company=self.company, code="UC03", name="Chart", effective_from=self.today)
        debit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="632", name="Giá vốn")
        credit = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Hàng hóa")
        AccountingPeriod.objects.create(company=self.company, code="UC03", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        customer = Party.objects.create(company=self.company, code="CUS-UC03", name="Công ty ABC")
        sale = GoodsSale.objects.create(company=self.company, branch=self.branch, number="BH00015",
            document_date=self.today, posting_date=self.today, customer=customer, currency=self.company.accounting_currency,
            status="POSTED", inventory_handling="SEPARATE_ISSUE", created_by=self.maker.iam_account)
        sale_line = GoodsSaleLine.objects.create(sale=sale, line_no=1, item=self.item, uom=self.uom,
            quantity=Decimal("6"), unit_price=Decimal("50"), cogs_account=debit, inventory_account=credit)
        sources_url = f"/api/v1/inventory/transactions/sale-sources/{self.query}"

        found = self.client.get(f"{sources_url}&search=BH000&customer=ABC&date_from={self.today}&date_to={self.today}")
        self.assertEqual(found.status_code, 200, found.data)
        self.assertEqual([row["number"] for row in found.data], ["BH00015"])
        self.assertEqual(found.data[0]["issue_status"], "NOT_ISSUED")
        self.assertEqual(found.data[0]["lines"][0]["remaining_quantity"], Decimal("6"))
        self.assertEqual(self.client.get(f"{sources_url}&search=KHONGCO").data, [])

        def payload(number, rows, **extra):
            return {"company": str(self.company.pk), "number": number, "transaction_type": "ISSUE",
                "source_module": "INV_SALE_ISSUE", "source_reference": str(sale.pk), "supplier": str(customer.pk),
                "document_date": str(self.today), "transaction_date": str(self.today), "source_warehouse": str(self.source.pk),
                "reason": "Xuất kho hàng hóa bán cho Công ty ABC theo chứng từ BH00015",
                "lines": [{"line_no": index, "item": str(self.item.pk), "uom": str(self.uom.pk), "sale_line": str(sale_line.pk),
                    "source_warehouse": str(warehouse.pk) if warehouse else None, "quantity": str(qty), "unit_cost": "0",
                    "debit_account": str(debit.pk), "credit_account": str(credit.pk)} for index, (warehouse, qty) in enumerate(rows, start=1)], **extra}
        url = f"/api/v1/inventory/transactions/{self.query}"

        def post_voucher(pk):
            self.assertEqual(self.client.post(f"/api/v1/inventory/transactions/{pk}/submit/{self.query}", {}, format="json").status_code, 200)
            self.client.force_authenticate(self.approver)
            self.client.post(f"/api/v1/inventory/transactions/{pk}/approve/{self.query}", {}, format="json")
            posted = self.client.post(f"/api/v1/inventory/transactions/{pk}/post/{self.query}", {}, format="json")
            self.client.force_authenticate(self.maker)
            return posted

        # EF-11 / EF-12 / EF-08 / BR-06 are rejected on save.
        self.assertIn("lớn hơn 0", str(self.client.post(url, payload("XK-UC03-0", [(self.source, 0)]), format="json").data))
        self.assertIn("vượt số lượng còn lại", str(self.client.post(url, payload("XK-UC03-X", [(self.source, 7)]), format="json").data))
        other = Party.objects.create(company=self.company, code="CUS-OTHER", name="Khách khác")
        self.assertEqual(self.client.post(url, payload("XK-UC03-C", [(self.source, 1)], supplier=str(other.pk)), format="json").status_code, 400)

        # AF-02 + AF-04: issue part of the sale from two warehouses; the draft does not touch stock (BR-19).
        first = self.client.post(url, payload("XK-UC03-1", [(self.source, 1), (self.destination, 2)]), format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("4"))
        duplicate = self.client.post(url, payload("XK-UC03-1", [(self.source, 1)]), format="json")
        self.assertIn("Số phiếu xuất đã tồn tại", str(duplicate.data))
        posted = post_voucher(first.data["id"])
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("3"))
        self.assertEqual(StockBalance.objects.get(warehouse=self.destination, item=self.item).quantity, Decimal("1"))
        self.assertEqual(JournalEntry.objects.get(source_event_id=f"INV.OTHER:{first.data['id']}").total_debit, Decimal("80"))
        # EF-18: no second posting.
        again = self.client.post(f"/api/v1/inventory/transactions/{first.data['id']}/post/{self.query}", {}, format="json")
        self.assertIn("Phiếu xuất kho đã được ghi sổ", str(again.data))
        progress = self.client.get(f"{sources_url}")
        self.assertEqual(progress.data[0]["issue_status"], "PARTIAL")
        self.assertEqual(progress.data[0]["lines"][0]["issued_quantity"], Decimal("3"))
        sale_api = self.client.get(f"/api/v1/sales/goods-sales/{sale.pk}/{self.query}")
        self.assertEqual(sale_api.data["issue_status"], "PARTIAL")

        # EF-13 / EF-19: stock taken elsewhere after the draft was saved blocks posting atomically.
        short = self.client.post(url, payload("XK-UC03-2", [(self.destination, 3)]), format="json")
        self.assertEqual(short.status_code, 201, short.data)
        refused = post_voucher(short.data["id"])
        self.assertEqual(refused.status_code, 400)
        self.assertIn("số lượng tồn kho không đủ để xuất", str(refused.data))
        self.assertEqual(StockBalance.objects.get(warehouse=self.destination, item=self.item).quantity, Decimal("1"))
        self.assertEqual(InventoryTransaction.objects.get(pk=short.data["id"]).status, "APPROVED")

        last = self.client.post(url, payload("XK-UC03-3", [(self.source, 3)]), format="json")
        self.assertEqual(post_voucher(last.data["id"]).status_code, 200)
        self.assertEqual(self.client.get(sources_url).data, [])
        completed = self.client.get(f"{sources_url}&include_completed=true").data[0]
        self.assertEqual(completed["issue_status"], "ISSUED")
        # EF-04: nothing left to issue for that line.
        self.assertIn("đã được xuất kho đầy đủ", str(self.client.post(url, payload("XK-UC03-4", [(self.source, 1)]), format="json").data))
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="INV", action_code="POST").exists())

    def test_other_issue_uc_inv_04_validation_attachments_and_atomic_save_post(self):
        import tempfile
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings

        self.create_and_post("NK-UC04-K1", "RECEIPT", 5, destination=self.source, cost="20")
        chart = ChartOfAccounts.objects.create(company=self.company, code="UC04", name="Chart", effective_from=self.today)
        expense = Account.objects.create(company=self.company, chart_of_accounts=chart, code="642", name="Chi phí quản lý")
        goods = Account.objects.create(company=self.company, chart_of_accounts=chart, code="156", name="Hàng hóa")
        investment = Account.objects.create(company=self.company, chart_of_accounts=chart, code="2281", name="Đầu tư góp vốn")
        period = AccountingPeriod.objects.create(company=self.company, code="UC04", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        url = f"/api/v1/inventory/transactions/{self.query}"

        def payload(number, rows, **extra):
            return {"company": str(self.company.pk), "number": number, "transaction_type": "ISSUE",
                "source_module": "INV_OTHER_ISSUE", "document_date": str(self.today), "transaction_date": str(self.today),
                "source_warehouse": str(self.source.pk), "reason": "Xuất vật tư sử dụng nội bộ",
                "lines": [{"line_no": index, "item": str(self.item.pk), "uom": str(self.uom.pk),
                    "source_warehouse": str(row.get("warehouse", self.source).pk) if row.get("warehouse", self.source) else None,
                    "quantity": str(row.get("qty", 1)), "unit_cost": str(row.get("cost", 0)),
                    "debit_account": str(row.get("debit", expense).pk), "credit_account": str(row.get("credit", goods).pk)}
                    for index, row in enumerate(rows, start=1)], **extra}

        def error(response):
            self.assertEqual(response.status_code, 400, response.data)
            return str(response.data)

        # EF01, EF05, EF06, EF08, EF09, EF11, EF12, BR10, EF14.
        self.assertIn("Vui lòng nhập số chứng từ.", error(self.client.post(url, payload("", [{}]), format="json")))
        self.assertIn("Vui lòng nhập lý do xuất kho.", error(self.client.post(url, payload("XK-UC04-R", [{}], reason=""), format="json")))
        self.assertIn("Vui lòng chọn ít nhất một hàng hóa cần xuất kho.", error(self.client.post(url, payload("XK-UC04-E", []), format="json")))
        self.assertIn("vui lòng chọn kho xuất cho hàng hóa.", error(self.client.post(url, payload("XK-UC04-W", [{"warehouse": None}]), format="json")))
        self.assertIn("số lượng xuất kho phải lớn hơn 0.", error(self.client.post(url, payload("XK-UC04-Q", [{"qty": 0}]), format="json")))
        self.assertIn("vui lòng chọn tài khoản hạch toán hợp lệ.", error(self.client.post(url, payload("XK-UC04-A", [{"debit": goods}]), format="json")))
        self.assertIn("đơn giá xuất kho không hợp lệ.", error(self.client.post(url, payload("XK-UC04-P", [{"cost": -1}]), format="json")))
        self.assertIn("TK Có phải là tài khoản hàng tồn kho", error(self.client.post(url, payload("XK-UC04-C", [{"debit": goods, "credit": expense}]), format="json")))
        self.assertIn("đối tượng nhận góp vốn", error(self.client.post(url, payload("XK-UC04-G", [{"debit": investment}]), format="json")))
        # EF10 + BR16: two lines of the same item and warehouse are checked together, with the details.
        over = error(self.client.post(url, payload("XK-UC04-O", [{"qty": 3}, {"qty": 3}]), format="json"))
        self.assertIn("Số lượng xuất vượt quá tồn kho khả dụng. Mã hàng SP01, kho K1: tồn khả dụng 5, yêu cầu xuất 6", over)
        self.assertFalse(InventoryTransaction.objects.filter(number="XK-UC04-O").exists())

        created = self.client.post(url, payload("XK-UC04-1", [{"qty": 2}], document_metadata={"partner_name": "Bộ phận quản lý",
            "attachments": [{"id": "forged", "name": "x.pdf"}]}), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        pk = created.data["id"]
        self.assertEqual(created.data["document_metadata"]["attachments"], [])
        # EF02.
        self.assertIn("Số chứng từ đã tồn tại. Vui lòng nhập số chứng từ khác.", error(self.client.post(url, payload("XK-UC04-1", [{}]), format="json")))

        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            attach_url = f"/api/v1/inventory/transactions/{pk}/attachments/{self.query}"
            attached = self.client.post(attach_url, {"file": SimpleUploadedFile("bien-ban.pdf", b"%PDF-1.4 test", "application/pdf")}, format="multipart")
            self.assertEqual(attached.status_code, 201, attached.data)
            attachment = attached.data["document_metadata"]["attachments"][0]
            self.assertEqual(attachment["name"], "bien-ban.pdf")
            # EF19 and an unsupported format.
            big = SimpleUploadedFile("lon.pdf", b"0" * (5 * 1024 * 1024 + 1), "application/pdf")
            self.assertIn("Dung lượng tệp đính kèm vượt quá 5 MB.", error(self.client.post(attach_url, {"file": big}, format="multipart")))
            self.assertIn("không được hỗ trợ", error(self.client.post(attach_url, {"file": SimpleUploadedFile("a.exe", b"MZ")}, format="multipart")))
            download = self.client.get(f"/api/v1/inventory/transactions/{pk}/attachments/{attachment['id']}/{self.query}")
            self.assertEqual(download.status_code, 200)
            self.assertEqual(b"".join(download.streaming_content), b"%PDF-1.4 test")
            # Editing the voucher keeps the attachment list (clients cannot overwrite it).
            edited = self.client.patch(f"/api/v1/inventory/transactions/{pk}/{self.query}",
                {"document_metadata": {"partner_name": "Phòng hành chính", "attachments": []}}, format="json")
            self.assertEqual(edited.status_code, 200, edited.data)
            self.assertEqual(len(edited.data["document_metadata"]["attachments"]), 1)

            # EF04: locked period → nothing changes and the voucher is still an editable draft.
            period.status = "CLOSED"
            period.save(update_fields=("status",))
            locked = self.client.post(f"/api/v1/inventory/transactions/{pk}/submit-and-post/{self.query}", {}, format="json")
            self.assertIn("Không thể ghi sổ chứng từ trong kỳ kế toán đã khóa.", error(locked))
            self.assertEqual(InventoryTransaction.objects.get(pk=pk).status, "DRAFT")
            period.status = "OPEN"
            period.save(update_fields=("status",))

            # Main flow step 16-20: Cất saves and posts in one step.
            posted = self.client.post(f"/api/v1/inventory/transactions/{pk}/submit-and-post/{self.query}", {}, format="json")
            self.assertEqual(posted.status_code, 200, posted.data)
            self.assertEqual(posted.data["status"], "POSTED")
            self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("3"))
            journal = JournalEntry.objects.get(source_event_id=f"INV.OTHER:{pk}")
            self.assertEqual(journal.total_debit, Decimal("40"))
            self.assertEqual(sorted(journal.lines.values_list("account__code", flat=True)), ["156", "642"])
            # EF16 + BR19: no second posting, no edits, no new attachments.
            self.assertIn("Phiếu xuất kho đã được ghi sổ.", error(self.client.post(f"/api/v1/inventory/transactions/{pk}/submit-and-post/{self.query}", {}, format="json")))
            self.assertEqual(self.client.patch(f"/api/v1/inventory/transactions/{pk}/{self.query}", {"reason": "Sửa"}, format="json").status_code, 400)
            self.assertIn("chưa ghi sổ", error(self.client.post(attach_url, {"file": SimpleUploadedFile("b.pdf", b"x")}, format="multipart")))

        # EF17: stock was enough when saved but another posting used it first; the draft stays editable.
        late = self.client.post(url, payload("XK-UC04-2", [{"qty": 3}]), format="json")
        self.assertEqual(late.status_code, 201, late.data)
        first = self.client.post(url, payload("XK-UC04-3", [{"qty": 2}]), format="json")
        self.assertEqual(self.client.post(f"/api/v1/inventory/transactions/{first.data['id']}/submit-and-post/{self.query}", {}, format="json").status_code, 200)
        changed = self.client.post(f"/api/v1/inventory/transactions/{late.data['id']}/submit-and-post/{self.query}", {}, format="json")
        self.assertIn("Tồn kho đã thay đổi, không đủ số lượng để xuất. Vui lòng kiểm tra lại.", error(changed))
        self.assertEqual(InventoryTransaction.objects.get(pk=late.data["id"]).status, "DRAFT")
        self.assertEqual(StockBalance.objects.get(warehouse=self.source, item=self.item).quantity, Decimal("1"))
        # EF16: a cancelled voucher is not posted.
        self.client.post(f"/api/v1/inventory/transactions/{late.data['id']}/cancel/{self.query}", {"reason": "Bỏ"}, format="json")
        self.assertIn("đã bị hủy", error(self.client.post(f"/api/v1/inventory/transactions/{late.data['id']}/submit-and-post/{self.query}", {}, format="json")))
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="INV", action_code="ATTACH").exists())

    def test_transfer_uc_inv_05_direct_transit_consignment_and_exceptions(self):
        self.create_and_post("NK-UC05-K1", "RECEIPT", 6, destination=self.source, cost="20")
        chart = ChartOfAccounts.objects.create(company=self.company, code="UC05", name="Chart", effective_from=self.today)
        goods = Account.objects.create(company=self.company, chart_of_accounts=chart, code="1561", name="Hàng hóa")
        goods_branch = Account.objects.create(company=self.company, chart_of_accounts=chart, code="1562", name="Hàng hóa chi nhánh")
        consigned = Account.objects.create(company=self.company, chart_of_accounts=chart, code="157", name="Hàng gửi bán")
        expense = Account.objects.create(company=self.company, chart_of_accounts=chart, code="642", name="Chi phí")
        period = AccountingPeriod.objects.create(company=self.company, code="UC05", fiscal_year=self.today.year,
            period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        agent_store = Warehouse.objects.create(company=self.company, branch=self.branch, code="KG", name="Kho hàng gửi bán", warehouse_type="CONSIGNMENT")
        agent = Party.objects.create(company=self.company, code="DL01", name="Đại lý Minh Phát")
        url = f"/api/v1/inventory/transactions/{self.query}"

        def payload(number, rows, kind="INTERNAL", **extra):
            metadata = {"transfer_kind": kind, **extra.pop("metadata", {})}
            return {"company": str(self.company.pk), "number": number, "transaction_type": "TRANSFER", "source_module": "INV_TRANSFER",
                "document_date": str(self.today), "transaction_date": str(self.today), "reason": "Điều chuyển vật tư",
                "document_metadata": metadata,
                "lines": [{"line_no": index, "item": str(self.item.pk), "uom": str(self.uom.pk),
                    "source_warehouse": str(row["from"].pk) if row.get("from") else None,
                    "destination_warehouse": str(row["to"].pk) if row.get("to") else None,
                    "quantity": str(row.get("qty", 1)), "unit_cost": str(row.get("cost", 0)),
                    "debit_account": str(row["debit"].pk) if row.get("debit") else None,
                    "credit_account": str(row["credit"].pk) if row.get("credit") else None} for index, row in enumerate(rows, start=1)], **extra}

        def error(response):
            self.assertEqual(response.status_code, 400, response.data)
            return str(response.data)

        def cat(pk):
            return self.client.post(f"/api/v1/inventory/transactions/{pk}/submit-and-post/{self.query}", {}, format="json")

        k1, k2 = self.source, self.destination
        # EF01, EF05-EF14.
        self.assertIn("Vui lòng nhập số chứng từ.", error(self.client.post(url, payload("", [{"from": k1, "to": k2}]), format="json")))
        self.assertIn("Vui lòng chọn ít nhất một hàng hóa cần chuyển kho.", error(self.client.post(url, payload("CK-E", []), format="json")))
        self.assertIn("vui lòng chọn kho xuất cho hàng hóa.", error(self.client.post(url, payload("CK-S", [{"to": k2}]), format="json")))
        self.assertIn("vui lòng chọn kho nhập cho hàng hóa.", error(self.client.post(url, payload("CK-D", [{"from": k1}]), format="json")))
        self.assertIn("kho nhập phải khác kho xuất.", error(self.client.post(url, payload("CK-X", [{"from": k1, "to": k1}]), format="json")))
        k2.status = "INACTIVE"
        k2.save(update_fields=("status",))
        self.assertIn("kho xuất hoặc kho nhập không hợp lệ.", error(self.client.post(url, payload("CK-I", [{"from": k1, "to": k2}]), format="json")))
        k2.status = "ACTIVE"
        k2.save(update_fields=("status",))
        self.assertIn("số lượng chuyển kho phải lớn hơn 0.", error(self.client.post(url, payload("CK-Q", [{"from": k1, "to": k2, "qty": 0}]), format="json")))
        self.assertIn("đơn giá chuyển kho không hợp lệ.", error(self.client.post(url, payload("CK-P", [{"from": k1, "to": k2, "cost": -1}]), format="json")))
        self.assertIn("vui lòng chọn tài khoản hạch toán hợp lệ.", error(self.client.post(url, payload("CK-A", [{"from": k1, "to": k2, "debit": goods}]), format="json")))
        self.assertIn("vui lòng chọn tài khoản hạch toán hợp lệ.", error(self.client.post(url, payload("CK-B", [{"from": k1, "to": k2, "debit": expense, "credit": goods}]), format="json")))
        # EF12 + BR08: two lines from the same source are checked together.
        over = error(self.client.post(url, payload("CK-O", [{"from": k1, "to": k2, "qty": 4}, {"from": k1, "to": agent_store, "qty": 3}]), format="json"))
        self.assertIn("kho xuất hoặc kho nhập không hợp lệ.", over)  # a consignment store is not an internal destination
        over = error(self.client.post(url, payload("CK-O", [{"from": k1, "to": k2, "qty": 4}, {"from": k1, "to": k2, "qty": 3}]), format="json"))
        self.assertIn("Số lượng chuyển kho vượt quá tồn kho khả dụng. Mã hàng SP01, kho K1: tồn khả dụng 6, yêu cầu chuyển 7", over)
        # AF16 needs a transit warehouse.
        self.assertIn("Chưa khai báo kho trung chuyển", error(self.client.post(url, payload("CK-T", [{"from": k1, "to": k2}], metadata={"in_transit": True}), format="json")))

        # Main flow: direct internal transfer, same inventory account on both sides → no journal entry (BR17).
        direct = self.client.post(url, payload("CK-01", [{"from": k1, "to": k2, "qty": 2, "debit": goods, "credit": goods}],
            metadata={"transporter_name": "Nguyễn Văn B", "receipt_status": "RECEIVED"}), format="json")
        self.assertEqual(direct.status_code, 201, direct.data)
        self.assertNotIn("receipt_status", direct.data["document_metadata"])
        self.assertIn("Số chứng từ đã tồn tại. Vui lòng nhập số chứng từ khác.", error(self.client.post(url, payload("CK-01", [{"from": k1, "to": k2}]), format="json")))
        posted = cat(direct.data["id"])
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(posted.data["status"], "POSTED")
        self.assertEqual(posted.data["document_metadata"]["receipt_status"], "RECEIVED")
        self.assertEqual(posted.data["gl_status"], "NOT_REQUIRED")
        self.assertEqual(Decimal(posted.data["total_value"]), Decimal("40"))
        self.assertEqual(StockBalance.objects.get(warehouse=k1, item=self.item).quantity, Decimal("4"))
        destination_balance = StockBalance.objects.get(warehouse=k2, item=self.item)
        self.assertEqual((destination_balance.quantity, destination_balance.inventory_value), (Decimal("2"), Decimal("40")))
        # BR13/BR14: company totals are unchanged.
        totals = StockBalance.objects.filter(company=self.company, item=self.item).aggregate(q=Sum("quantity"), v=Sum("inventory_value"))
        self.assertEqual((totals["q"], totals["v"]), (Decimal("6"), Decimal("120")))
        self.assertIn("Chứng từ chuyển kho đã được ghi sổ.", error(cat(direct.data["id"])))  # BR18

        # Different inventory accounts → Nợ 1562 / Có 1561 entry.
        accounts = self.client.post(url, payload("CK-02", [{"from": k1, "to": k2, "qty": 1, "debit": goods_branch, "credit": goods}]), format="json")
        self.assertEqual(cat(accounts.data["id"]).status_code, 200)
        entry = JournalEntry.objects.get(source_event_id=f"INV.OTHER:{accounts.data['id']}")
        self.assertEqual(entry.total_debit, Decimal("20"))

        # AF16 / EF20: goods on the road sit in the transit warehouse until received.
        transit = Warehouse.objects.create(company=self.company, branch=self.branch, code="KT", name="Hàng đi đường", warehouse_type="TRANSIT")
        road = self.client.post(url, payload("CK-03", [{"from": k1, "to": k2, "qty": 2}], kind="TRANSPORT", metadata={"in_transit": True}), format="json")
        self.assertEqual(road.status_code, 201, road.data)
        shipped = cat(road.data["id"])
        self.assertEqual(shipped.data["document_metadata"]["receipt_status"], "IN_TRANSIT")
        self.assertEqual(StockBalance.objects.get(warehouse=transit, item=self.item).quantity, Decimal("2"))
        self.assertEqual(StockBalance.objects.get(warehouse=k2, item=self.item).quantity, Decimal("3"))
        line_id = shipped.data["lines"][0]["id"]
        receive_url = f"/api/v1/inventory/transactions/{road.data['id']}/receive/{self.query}"
        short = error(self.client.post(receive_url, {"lines": [{"line": line_id, "received_quantity": "1.5"}]}, format="json"))
        self.assertIn("đã xuất 2, thực nhận 1.5, chênh lệch 0.5", short)
        self.assertEqual(StockBalance.objects.get(warehouse=k2, item=self.item).quantity, Decimal("3"))
        self.assertIn("lý do", error(self.client.post(receive_url, {"lines": [{"line": line_id, "received_quantity": "1.5"}], "accept_discrepancy": True}, format="json")))
        received = self.client.post(receive_url, {"lines": [{"line": line_id, "received_quantity": "1.5"}], "accept_discrepancy": True,
            "reason": "Hao hụt khi vận chuyển"}, format="json")
        self.assertEqual(received.status_code, 200, received.data)
        self.assertEqual(received.data["document_metadata"]["receipt_status"], "RECEIVED")
        self.assertEqual(StockBalance.objects.get(warehouse=k2, item=self.item).quantity, Decimal("4.5"))
        self.assertEqual(StockBalance.objects.get(warehouse=transit, item=self.item).quantity, Decimal("0.5"))
        self.assertIn("Đang vận chuyển", error(self.client.post(receive_url, {"lines": [{"line": line_id, "received_quantity": "2"}]}, format="json")))

        # AF02 / BR21: goods sent to an agent go to the consignment store on TK 157 and need the agent.
        self.assertIn("đại lý", error(self.client.post(url, payload("CK-04", [{"from": k1, "to": agent_store, "debit": consigned, "credit": goods}], kind="CONSIGNMENT"), format="json")))
        self.assertIn("tài khoản hạch toán", error(self.client.post(url, payload("CK-04", [{"from": k1, "to": agent_store, "debit": goods_branch, "credit": goods}],
            kind="CONSIGNMENT", supplier=str(agent.pk)), format="json")))
        consignment = self.client.post(url, payload("CK-04", [{"from": k1, "to": agent_store, "qty": 1, "debit": consigned, "credit": goods}],
            kind="CONSIGNMENT", supplier=str(agent.pk)), format="json")
        self.assertEqual(consignment.status_code, 201, consignment.data)
        self.assertEqual(cat(consignment.data["id"]).status_code, 200)
        self.assertEqual(StockBalance.objects.get(warehouse=agent_store, item=self.item).quantity, Decimal("1"))
        entry = JournalEntry.objects.get(source_event_id=f"INV.OTHER:{consignment.data['id']}")
        self.assertEqual(sorted(entry.lines.values_list("account__code", flat=True)), ["1561", "157"])

        # EF04 and EF17: nothing is recorded and the voucher stays an editable draft.
        self.create_and_post("NK-UC05-K1B", "RECEIPT", 1, destination=k1, cost="20")
        late = self.client.post(url, payload("CK-05", [{"from": k1, "to": k2, "qty": 1}]), format="json")
        self.assertEqual(late.status_code, 201, late.data)
        period.status = "CLOSED"
        period.save(update_fields=("status",))
        self.assertIn("Không thể ghi sổ chứng từ trong kỳ kế toán đã khóa.", error(cat(late.data["id"])))
        period.status = "OPEN"
        period.save(update_fields=("status",))
        self.create_and_post("XK-UC05-DRAIN", "ISSUE", 1, source=k1)
        self.assertIn("Tồn kho đã thay đổi, không đủ số lượng để chuyển. Vui lòng kiểm tra lại.", error(cat(late.data["id"])))
        self.assertEqual(InventoryTransaction.objects.get(pk=late.data["id"]).status, "DRAFT")
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="INV", action_code="RECEIVE").exists())

    def test_negative_stock_idempotency_and_count_adjustment(self):
        response = self.client.post(
            f"/api/v1/inventory/transactions/{self.query}",
            {
                "company": str(self.company.id), "number": "XK-AM", "transaction_type": "ISSUE",
                "transaction_date": str(self.today), "source_warehouse": str(self.source.id),
                "idempotency_key": "duplicate-event",
                "lines": [{"line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id), "quantity": "1", "unit_cost": "0"}],
            }, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        duplicate = self.client.post(
            f"/api/v1/inventory/transactions/{self.query}",
            {
                "company": str(self.company.id), "number": "XK-AM-2", "transaction_type": "ISSUE",
                "transaction_date": str(self.today), "source_warehouse": str(self.source.id),
                "idempotency_key": "duplicate-event",
                "lines": [{"line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id), "quantity": "1", "unit_cost": "0"}],
            }, format="json",
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        transaction_id = response.data["id"]
        self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/submit/{self.query}", {}, format="json")
        self.client.force_authenticate(self.approver)
        self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/approve/{self.query}", {"comment": "Duyệt"}, format="json")
        blocked = self.client.post(f"/api/v1/inventory/transactions/{transaction_id}/post/{self.query}", {}, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.client.force_authenticate(self.maker)
        self.create_and_post("NK-COUNT", "RECEIPT", 10, destination=self.source, cost="20")
        count = self.client.post(
            f"/api/v1/inventory/counts/{self.query}",
            {
                "company": str(self.company.id), "number": "KK-001", "warehouse": str(self.source.id),
                "count_date": str(self.today), "snapshot_at": timezone.now().isoformat(),
                "lines": [{"item": str(self.item.id), "actual_quantity": "8"}],
            }, format="json",
        )
        self.assertEqual(count.status_code, 201, count.data)
        adjustment = self.client.post(f"/api/v1/inventory/counts/{count.data['id']}/create-adjustment/{self.query}", {}, format="json")
        self.assertEqual(adjustment.status_code, 400, adjustment.data)
