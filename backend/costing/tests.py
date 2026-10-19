from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone

from common_services.test_company_setup import FounderCompanyMixin
from general_ledger.models import Account, JournalEntry
from iam.models import Permission, Role, RolePermission
from inventory.models import InventoryTransaction
from master_data.models import CostCenter, Item, UnitOfMeasure


@override_settings(COMMON_REQUIRE_VERIFICATION=False)
class CostPeriodTests(FounderCompanyMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        role = Role.objects.get(company=self.company, code="COMPANY_ADMIN")
        have = set(role.role_permissions.values_list("permission_id", flat=True))
        RolePermission.objects.bulk_create([RolePermission(role=role, permission=p) for p in Permission.objects.exclude(id__in=have)])
        self.q = f"?company_id={self.company.pk}"
        self.today = timezone.localdate()
        self.workshop_a = CostCenter.objects.create(company=self.company, code="PXA", name="Phân xưởng A")
        self.workshop_b = CostCenter.objects.create(company=self.company, code="PXB", name="Phân xưởng B")
        account = lambda code: str(Account.objects.filter(company=self.company, code__startswith=code, is_postable=True).order_by("code").first().pk)
        currency = str(self.company.accounting_currency_id)
        period = self.client.get(f"/api/v1/general-ledger/periods/{self.q}").data
        period = next(row for row in (period["results"] if isinstance(period, dict) else period) if row["start_date"] <= str(self.today) <= row["end_date"])
        # 600k materials directly in workshop A, 400k shared labor.
        journal = self.client.post(f"/api/v1/general-ledger/journals/{self.q}", {
            "company": str(self.company.pk), "number": "CPSX01", "posting_date": str(self.today), "document_date": str(self.today),
            "description": "Chi phí sản xuất", "period": period["id"], "lines": [
                {"line_no": 1, "account": account("621"), "debit": "600000", "credit": "0", "currency": currency, "cost_center": str(self.workshop_a.pk)},
                {"line_no": 2, "account": account("152"), "debit": "0", "credit": "600000", "currency": currency},
                {"line_no": 3, "account": account("622"), "debit": "400000", "credit": "0", "currency": currency},
                {"line_no": 4, "account": account("1111"), "debit": "0", "credit": "400000", "currency": currency},
            ],
        }, format="json")
        self.assertEqual(journal.status_code, 201, journal.data)
        entry = JournalEntry.objects.get(pk=journal.data["id"])
        entry.status = "POSTED"
        entry.save(update_fields=("status",))

    def test_costs_are_assigned_transferred_and_accepted(self):
        created = self.client.post(f"/api/v1/costing/periods/{self.q}", {
            "company": str(self.company.pk), "code": "GT01", "method": "COEFFICIENT", "start_date": str(self.today.replace(day=1)),
            "end_date": str(self.today), "objects": [
                {"object_type": "COST_CENTER", "object_id": str(self.workshop_a.pk), "output_quantity": "100", "coefficient": "1"},
                {"object_type": "COST_CENTER", "object_id": str(self.workshop_b.pk), "output_quantity": "100", "coefficient": "3"},
            ],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        totals = {row["object_code"]: Decimal(row["total_cost"]) for row in created.data["objects"]}
        # A: 600k direct + 1/4 of 400k; B: 3/4 of 400k.
        self.assertEqual(totals, {"PXA": Decimal("700000"), "PXB": Decimal("300000")})
        transferred = self.client.post(f"/api/v1/costing/periods/{created.data['id']}/transfer/{self.q}", {}, format="json")
        self.assertEqual(transferred.status_code, 200, transferred.data)
        self.assertEqual(JournalEntry.objects.get(pk=transferred.data["transfer_entry"]).total_debit, Decimal("1000000"))
        missing_item = self.client.post(f"/api/v1/costing/periods/{created.data['id']}/accept/{self.q}", {"target": "FINISHED_GOODS"}, format="json")
        self.assertEqual(missing_item.status_code, 400)
        unit = UnitOfMeasure.objects.filter(company=self.company).first()
        for code, workshop in (("TPA", self.workshop_a), ("TPB", self.workshop_b)):
            item = Item.objects.create(company=self.company, code=code, name=code, item_type="FINISHED_GOOD", base_uom=unit, status="ACTIVE")
            self.client.post(f"/api/v1/costing/object-settings/{self.q}", {"company": str(self.company.pk), "object_type": "COST_CENTER",
                                                                           "object_id": str(workshop.pk), "finished_item": str(item.pk)}, format="json")
        accepted = self.client.post(f"/api/v1/costing/periods/{created.data['id']}/accept/{self.q}", {"target": "FINISHED_GOODS"}, format="json")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(accepted.data["status"], "ACCEPTED")
        receipt = InventoryTransaction.objects.get(source_module="COST", source_reference="GT01")
        self.assertEqual({line.item.code: line.unit_cost for line in receipt.lines.all()}, {"TPA": Decimal("7000"), "TPB": Decimal("3000")})

    def test_object_settings_supply_opening_wip(self):
        saved = self.client.post(f"/api/v1/costing/object-settings/{self.q}", {
            "company": str(self.company.pk), "object_type": "COST_CENTER", "object_id": str(self.workshop_b.pk), "opening_wip": "50000",
        }, format="json")
        self.assertEqual(saved.status_code, 201, saved.data)
        created = self.client.post(f"/api/v1/costing/periods/{self.q}", {
            "company": str(self.company.pk), "code": "GT02", "method": "SIMPLE", "start_date": str(self.today.replace(day=1)),
            "end_date": str(self.today), "objects": [{"object_type": "COST_CENTER", "object_id": str(self.workshop_b.pk)}],
        }, format="json")
        self.assertEqual(Decimal(created.data["objects"][0]["opening_wip"]), Decimal("50000"))

    def test_saved_material_basis_allocates_shared_labor(self):
        url = f"/api/v1/costing/allocation-settings/{self.q}"
        saved = self.client.put(url, {"labor_basis": "MATERIAL", "overhead_basis": "PLAN"}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(self.client.get(url).data["labor_basis"], "MATERIAL")
        created = self.client.post(f"/api/v1/costing/periods/{self.q}", {
            "company": str(self.company.pk), "code": "GT03", "method": "SIMPLE",
            "start_date": str(self.today.replace(day=1)), "end_date": str(self.today),
            "objects": [
                {"object_type": "COST_CENTER", "object_id": str(self.workshop_a.pk), "output_quantity": "100"},
                {"object_type": "COST_CENTER", "object_id": str(self.workshop_b.pk), "output_quantity": "100"},
            ],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        totals = {row["object_code"]: Decimal(row["total_cost"]) for row in created.data["objects"]}
        self.assertEqual(totals, {"PXA": Decimal("1000000"), "PXB": Decimal("0")})
