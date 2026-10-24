import tempfile
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import Account, AccountClass, AccountingPeriod, ChartOfAccounts, JournalEntry
from master_data.models import Currency
from organization.models import Branch, Company, Department
from .models import AssetCategory, AssetRecord, AssetRevaluation, AssetTransaction
from .revaluation import MESSAGES


class RevaluationUcFa06Tests(TestCase):
    """UC-FA-06 – Đánh giá lại tài sản cố định."""

    def setUp(self):
        self.today = timezone.localdate()
        currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(code="FAREV", name="FA Rev", legal_name="FA Rev Co", tax_code="0100776600",
            accounting_currency=currency, legal_reporting_currency=currency)
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        self.department = Department.objects.create(company=self.company, branch=self.branch, code="SX", name="Phân xưởng")
        account_class = AccountClass.objects.create(company=self.company, code="ALL", name="Tất cả", normal_balance="DEBIT")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="HT", effective_from=self.today, is_default=True)
        self.account = {code: Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=account_class,
            code=code, name=code, account_type="ASSET", normal_balance="DEBIT") for code in ("2111", "2141", "241", "412", "6424", "811")}
        self.period = AccountingPeriod.objects.create(company=self.company, code="P", fiscal_year=self.today.year, period_number=self.today.month,
            start_date=self.today.replace(day=1), end_date=self.today + timedelta(days=31))
        self.user = get_user_model().objects.create_superuser(username="fa-rev", email="rev@fa.test", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"
        category = AssetCategory.objects.create(company=self.company, code="MM", name="Máy móc", asset_type="FIXED_ASSET",
            default_periods=60, asset_account=self.account["2111"], accumulated_account=self.account["2141"], expense_account=self.account["6424"])
        # A machine in use for 12 of 60 months: cost 300 million, 60 million depreciated.
        self.asset = AssetRecord.objects.create(company=self.company, code="MAY01", name="Máy CNC", asset_type="FIXED_ASSET",
            category=category, acquisition_date=self.today - timedelta(days=400), in_service_date=self.today - timedelta(days=400),
            original_cost=Decimal("300000000"), accumulated_depreciation=Decimal("60000000"), useful_life_periods=60, periods_processed=12,
            branch=self.branch, department=self.department, status="ACTIVE", created_by=self.user.iam_account)
        self.draft_asset = AssetRecord.objects.create(company=self.company, code="MAY02", name="Máy chưa ghi tăng", asset_type="FIXED_ASSET",
            category=category, acquisition_date=self.today, in_service_date=self.today, original_cost=Decimal("10"), useful_life_periods=12,
            branch=self.branch, status="DRAFT", created_by=self.user.iam_account)
        self.url = f"/api/v1/fixed-assets/revaluations/{self.query}"

    def line(self, asset=None, **after):
        asset = asset or self.asset
        before = {"original_cost": asset.original_cost, "remaining": asset.useful_life_periods - asset.periods_processed,
            "accumulated": asset.accumulated_depreciation, "depreciable": asset.original_cost - asset.salvage_value}
        values = {"original_cost": before["original_cost"], "remaining": before["remaining"], "accumulated": before["accumulated"],
            "depreciable": before["depreciable"], **after}
        monthly = after.get("monthly")
        if monthly is None:
            monthly = ((values["depreciable"] - values["accumulated"]) / values["remaining"]).quantize(Decimal("1")) if values["remaining"] else 0
        return {"asset": str(asset.pk), "before_original_cost": str(before["original_cost"]), "after_original_cost": str(values["original_cost"]),
            "before_remaining_periods": before["remaining"], "after_remaining_periods": values["remaining"],
            "before_accumulated_depreciation": str(before["accumulated"]), "after_accumulated_depreciation": str(values["accumulated"]),
            "before_depreciable_value": str(before["depreciable"]), "after_depreciable_value": str(values["depreciable"]),
            "monthly_depreciation_after": str(monthly), "tax_monthly_depreciation_after": after.get("tax"),
            "revaluation_account": after.get("revaluation_account"), "expense_account": after.get("expense_account")}

    def entry(self, debit, credit, amount):
        return {"description": "Đánh giá lại", "debit_account": str(self.account[debit].pk), "credit_account": str(self.account[credit].pk), "amount": str(amount)}

    def payload(self, number="ĐGL00001", reason="UPGRADE", lines=None, entries=None, **extra):
        return {"company": str(self.company.pk), "number": number, "reason": reason, "record_number": "BB-01",
            "record_date": str(self.today), "document_date": str(self.today), "posting_date": str(self.today),
            "lines": lines if lines is not None else [], "entries": entries or [], **extra}

    def error(self, response, rule, **values):
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn(MESSAGES[rule].format(**values), str(response.data))

    def post_doc(self, pk):
        return self.client.post(f"/api/v1/fixed-assets/revaluations/{pk}/post/{self.query}", {}, format="json")

    def test_upgrade_posts_once_updates_basis_and_ledger(self):
        candidates = self.client.get(f"/api/v1/fixed-assets/revaluations/candidates/{self.query}&date={self.today}").data
        machine = next(row for row in candidates if row["code"] == "MAY01")
        self.assertEqual((machine["remaining_periods"], machine["accumulated_depreciation"]), ("48", "60000000.0000"))
        self.assertFalse(any(row["code"] == "MAY02" for row in candidates))
        self.assertEqual(self.client.get(f"/api/v1/fixed-assets/revaluations/next-number/{self.query}").data["number"], "ĐGL00001")

        upgrade = [self.line(original_cost=Decimal("400000000"), depreciable=Decimal("400000000"), remaining=48)]
        capitalise = [self.entry("2111", "241", "100000000")]
        # EF02 / EF07 / EF08 / EF11 / EF13 / EF14 / EF15.
        self.error(self.client.post(self.url, self.payload(number="", lines=upgrade, entries=capitalise), format="json"), "EF02")
        self.error(self.client.post(self.url, self.payload(reason="", lines=upgrade, entries=capitalise), format="json"), "EF07")
        self.error(self.client.post(self.url, self.payload(lines=upgrade, entries=capitalise, record_number="", record_date=None), format="json"), "EF08")
        self.error(self.client.post(self.url, self.payload(lines=[]), format="json"), "EF11")
        self.error(self.client.post(self.url, self.payload(lines=[self.line(self.draft_asset, original_cost=Decimal("20"), depreciable=Decimal("20"))]), format="json"), "EF13", code="MAY02")
        self.error(self.client.post(self.url, self.payload(lines=upgrade * 2, entries=capitalise), format="json"), "EF14", code="MAY01")
        stale = [{**upgrade[0], "before_accumulated_depreciation": "50000000"}]
        self.error(self.client.post(self.url, self.payload(lines=stale, entries=capitalise), format="json"), "EF15", code="MAY01")
        # EF16-EF23 on the adjustment itself.
        self.error(self.client.post(self.url, self.payload(lines=[self.line(original_cost=Decimal("0"), depreciable=Decimal("0"))]), format="json"), "EF16")
        self.error(self.client.post(self.url, self.payload(lines=[self.line(original_cost=Decimal("400000000"), accumulated=Decimal("70000000"))], entries=capitalise), format="json"), "EF17")
        self.error(self.client.post(self.url, self.payload(lines=[self.line(depreciable=Decimal("500000000"))]), format="json"), "EF19")
        self.error(self.client.post(self.url, self.payload(lines=[self.line(remaining=0, monthly=0)]), format="json"), "EF18")
        self.error(self.client.post(self.url, self.payload(lines=[self.line(remaining=60, monthly=1)]), format="json"), "EF20")
        self.error(self.client.post(self.url, self.payload(lines=[self.line(remaining=60, revaluation_account=str(self.account["412"].pk))]), format="json"), "EF21")
        self.error(self.client.post(self.url, self.payload(lines=upgrade, entries=[self.entry("2111", "241", "90000000")]), format="json"), "EF22")
        self.error(self.client.post(self.url, self.payload(lines=upgrade), format="json"), "EF22")
        self.error(self.client.post(self.url, self.payload(lines=[self.line()]), format="json"), "EF23")
        # AF29 / EF24: the cost was capitalised by the source voucher, so it is not booked again.
        self.error(self.client.post(self.url, self.payload(lines=upgrade, entries=capitalise, cost_booked_at_source=True, source_reference="NOPE"), format="json"), "EF08")

        created = self.client.post(self.url, self.payload(lines=upgrade, entries=capitalise, idempotency_key="key-1",
            members=[{"full_name": "Trần B", "title": "Trưởng phòng", "representing": "Phòng kỹ thuật"}], conclusion="Nghiệm thu đạt"), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        pk = created.data["id"]
        self.assertEqual(created.data["status"], "DRAFT")
        self.assertEqual(created.data["totals"]["original_cost"], "100000000.0000")
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.original_cost, Decimal("300000000"))  # nothing changes before posting
        self.error(self.client.post(self.url, self.payload(lines=upgrade, entries=capitalise), format="json"), "EF02")
        again = self.client.post(self.url, self.payload(lines=upgrade, entries=capitalise, idempotency_key="key-1"), format="json")
        self.assertEqual((again.status_code, again.data["id"]), (200, pk))  # EF28

        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            attach = f"/api/v1/fixed-assets/revaluations/{pk}/attachments/{self.query}"
            self.assertEqual(self.client.post(attach, {"file": SimpleUploadedFile("nghiem-thu.pdf", b"%PDF")}, format="multipart").status_code, 201)
            self.error(self.client.post(attach, {"file": SimpleUploadedFile("lon.pdf", b"0" * (5 * 1024 * 1024 + 1))}, format="multipart"), "EF29")
            posted = self.post_doc(pk)
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(posted.data["status"], "POSTED")
        self.asset.refresh_from_db()
        self.assertEqual((self.asset.original_cost, self.asset.accumulated_depreciation, self.asset.salvage_value, self.asset.useful_life_periods),
            (Decimal("400000000"), Decimal("60000000"), Decimal("0"), 60))
        journal = JournalEntry.objects.get(number="ĐGL00001-GL")
        self.assertEqual((journal.status, journal.total_debit), ("POSTED", Decimal("100000000")))
        history = AssetTransaction.objects.get(asset=self.asset, transaction_type="REVALUATION")
        self.assertEqual(history.before_snapshot["original_cost"], "300000000.0000")
        # BR29: no depreciation voucher is created by the revaluation.
        self.assertFalse(AssetTransaction.objects.filter(asset=self.asset, transaction_type="DEPRECIATION").exists())
        self.assertIn("đã được ghi sổ", str(self.post_doc(pk).data))
        self.assertEqual(self.client.patch(f"/api/v1/fixed-assets/revaluations/{pk}/{self.query}", {"conclusion": "Sửa"}, format="json").status_code, 400)
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="FA", action_code="POST").exists())

        # AF15 / AF30: only the remaining life changes; no entry is created and the basis follows.
        life = self.client.post(self.url, self.payload(number="ĐGL00002", reason="OTHER", conclusion="Gia hạn sử dụng",
            lines=[self.line(remaining=60, tax="6000000")]), format="json")
        self.assertEqual(life.status_code, 201, life.data)
        self.assertEqual(self.post_doc(life.data["id"]).data["journal_entry"], None)
        self.asset.refresh_from_db()
        self.assertEqual((self.asset.useful_life_periods, self.asset.tax_monthly_depreciation), (72, Decimal("6000000")))

        # AF06: state decision through TK 412 (cost +50, accumulated +10), then unposting it (AF28).
        state = self.payload(number="ĐGL00003", reason="STATE_DECISION", conclusion="Theo quyết định 12/QĐ",
            lines=[self.line(original_cost=Decimal("450000000"), accumulated=Decimal("70000000"), depreciable=Decimal("450000000"),
                revaluation_account=str(self.account["412"].pk))],
            entries=[self.entry("2111", "412", "50000000"), self.entry("412", "2141", "10000000")])
        self.error(self.client.post(self.url, state, format="json"), "EF09")
        state["members"] = [{"full_name": "Lê C", "title": "Chủ tịch hội đồng", "representing": "Ban giám đốc"}]
        self.error(self.client.post(self.url, {**state, "record_number": "", "record_date": None}, format="json"), "EF03")
        decided = self.client.post(self.url, state, format="json")
        self.assertEqual(decided.status_code, 201, decided.data)
        self.assertEqual(self.post_doc(decided.data["id"]).status_code, 200)
        self.asset.refresh_from_db()
        self.assertEqual((self.asset.original_cost, self.asset.accumulated_depreciation), (Decimal("450000000"), Decimal("70000000")))
        blocked = self.client.post(f"/api/v1/fixed-assets/revaluations/{pk}/reverse/{self.query}", {"reason": "Sai"}, format="json")
        self.assertIn("đã phát sinh nghiệp vụ sau đánh giá lại", str(blocked.data))
        undone = self.client.post(f"/api/v1/fixed-assets/revaluations/{decided.data['id']}/reverse/{self.query}", {"reason": "Sai số liệu"}, format="json")
        self.assertEqual(undone.status_code, 200, undone.data)
        self.assertEqual(undone.data["status"], "REVERSED")
        self.asset.refresh_from_db()
        self.assertEqual((self.asset.original_cost, self.asset.accumulated_depreciation), (Decimal("400000000"), Decimal("60000000")))
        self.assertEqual(JournalEntry.objects.get(number="ĐGL00003-GL").status, "REVERSED")
        self.assertTrue(JournalEntry.objects.filter(number="REV-ĐGL00003-GL", status="POSTED").exists())

    def test_locked_period_later_postings_and_permission(self):
        # EF25: a posted depreciation after the effective date blocks a back-dated revaluation.
        AssetTransaction.objects.create(company=self.company, asset=self.asset, number="KH-01", transaction_type="DEPRECIATION",
            transaction_date=self.today, amount=Decimal("1"), status="POSTED", created_by=self.user.iam_account)
        yesterday = self.today - timedelta(days=1)
        self.error(self.client.post(self.url, self.payload(record_date=str(yesterday), reason="OTHER", conclusion="X",
            lines=[self.line(remaining=60)]), format="json"), "EF25")
        # EF06: the accounting period is closed.
        self.period.status = "CLOSED"
        self.period.save(update_fields=("status",))
        self.error(self.client.post(self.url, self.payload(reason="OTHER", conclusion="X", lines=[self.line(remaining=60)]), format="json"), "EF06")
        # EF04: the record date is after the posting date.
        self.error(self.client.post(self.url, self.payload(record_date=str(self.today + timedelta(days=2)), lines=[self.line(remaining=60)]), format="json"), "EF04")
        # EF01: no right to revalue.
        outsider = get_user_model().objects.create_user(username="fa-outsider", email="out@fa.test", password="x")
        client = APIClient()
        client.force_authenticate(outsider)
        denied = client.post(self.url, self.payload(lines=[self.line(remaining=60)]), format="json")
        self.assertEqual(denied.status_code, 403)
        self.assertIn(MESSAGES["EF01"], str(denied.data))
        self.assertFalse(AssetRevaluation.objects.exists())
