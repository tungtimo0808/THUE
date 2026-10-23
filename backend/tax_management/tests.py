import hashlib
import hmac
import json
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from openpyxl import load_workbook

from audit_log.models import AuditLog
from master_data.models import Currency, Item, ItemCategory, Party, UnitOfMeasure
from organization.models import Branch, Company
from .models import TaxInvoice, TaxInvoiceLink, TaxSummary, VatCalculation, VatDeductionDocument, VatLedgerEntry, TaxDeclaration, TaxSubmission, TaxPeriod, TaxObligation, TaxPaymentOrder, CompanyTaxFormRegistration


class TaxApiTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="TAXCO", name="Tax Co", legal_name="Tax Company", tax_code="0100554433",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        self.party = Party.objects.create(company=self.company, code="DT01", name="Đối tác", tax_code="0101234567", default_currency=self.currency)
        uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái")
        category = ItemCategory.objects.create(company=self.company, code="HH", name="Hàng hóa")
        self.item = Item.objects.create(company=self.company, category=category, base_uom=uom, code="SP01", name="Sản phẩm", item_type="GOODS")
        self.user = get_user_model().objects.create_superuser(username="tax-admin", email="tax@test.local", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"
        connector = self.client.post(
            f"/api/v1/tax/connectors/{self.query}",
            {"company": str(self.company.id), "code": "MOCK", "provider": "Mock E-Invoice", "channel": "EINVOICE",
             "config": {"callback_secret": "test-provider-secret"}}, format="json",
        )
        self.assertEqual(connector.status_code, 201, connector.data)
        self.connector = connector.data["id"]
        self.assertNotIn("callback_secret", connector.data["config"])
        period = self.client.post(
            f"/api/v1/tax/periods/{self.query}",
            {"company": str(self.company.id), "code": "2026-09", "tax_type": "VAT", "start_date": str(self.today.replace(day=1)), "end_date": str(self.today)}, format="json",
        )
        self.assertEqual(period.status_code, 201, period.data)
        self.period = period.data["id"]

    def test_reconciliation_mvp_missing_sources_and_snapshot(self):
        endpoint = f"/api/v1/tax/reconciliations/run/{self.query}"
        vat = self.client.post(endpoint, {"company": str(self.company.id), "period": self.period,
            "reconciliation_type": "VAT_GL"}, format="json")
        self.assertEqual(vat.status_code, 201, vat.data)
        self.assertEqual(vat.data["result_status"], "REVIEW_REQUIRED")
        self.assertGreater(vat.data["summary"]["missing_count"], 0)
        self.assertTrue(vat.data["source_is_current"])
        payments = self.client.post(endpoint, {"company": str(self.company.id), "period": self.period,
            "reconciliation_type": "OBLIGATION_PAYMENT"}, format="json")
        self.assertEqual(payments.status_code, 201, payments.data)
        self.assertEqual(payments.data["result_status"], "REVIEW_REQUIRED")
        self.assertIn("Chưa có nghĩa vụ", payments.data["details"]["warnings"][0])
        history = self.client.get(f"/api/v1/tax/reconciliations/{self.query}&reconciliation_type=VAT_GL")
        self.assertEqual(history.status_code, 200, history.data)
        self.assertEqual(len(history.data), 1)
        self.assertEqual(history.data[0]["id"], vat.data["id"])
        TaxObligation.objects.create(company=self.company, period_id=self.period, tax_type="VAT",
            due_date=self.today, assessed_amount=Decimal("100000"), created_by=self.user.iam_account)
        old = self.client.get(f"/api/v1/tax/reconciliations/{payments.data['id']}/{self.query}")
        self.assertEqual(old.status_code, 200, old.data)
        self.assertFalse(old.data["source_is_current"])
        current = self.client.post(endpoint, {"company": str(self.company.id), "period": self.period,
            "reconciliation_type": "OBLIGATION_PAYMENT"}, format="json")
        self.assertEqual(current.status_code, 201, current.data)
        self.assertEqual(current.data["result_status"], "REVIEW_REQUIRED")
        self.assertEqual(current.data["details"]["rows"][0]["difference_type"], "SETTLEMENT_UNVERIFIED")

    def test_connector_draft_configuration_does_not_claim_verified_connection(self):
        endpoint = f"/api/v1/tax/connectors/{self.query}"
        active_edit = self.client.patch(f"/api/v1/tax/connectors/{self.connector}/{self.query}",
            {"provider": "Changed"}, format="json")
        self.assertEqual(active_edit.status_code, 400)
        stopped = self.client.patch(f"/api/v1/tax/connectors/{self.connector}/{self.query}",
            {"is_active": False}, format="json")
        self.assertEqual(stopped.status_code, 200, stopped.data)
        draft = self.client.post(endpoint, {"company": str(self.company.id), "code": "TEST_TVAN",
            "provider": "Test T-VAN", "channel": "TVAN", "is_active": True,
            "config": {"credential_reference": "vault:test-tvan", "connector_version": "v1",
                       "capabilities": ["DECLARATION_STATUS_QUERY"]}}, format="json")
        self.assertEqual(draft.status_code, 201, draft.data)
        self.assertFalse(draft.data["is_active"])
        self.assertEqual(draft.data["connection_status"], "INACTIVE")
        activate = self.client.patch(f"/api/v1/tax/connectors/{draft.data['id']}/{self.query}",
            {"is_active": True}, format="json")
        self.assertEqual(activate.status_code, 400)
        secret = self.client.post(endpoint, {"company": str(self.company.id), "code": "UNSAFE",
            "provider": "Test", "channel": "EINVOICE", "config": {"auth": {"password": "plaintext"}}}, format="json")
        self.assertEqual(secret.status_code, 400)
        other = Company.objects.create(code="OTHER-TAX11", name="Other", legal_name="Other",
            accounting_currency=self.currency, legal_reporting_currency=self.currency)
        foreign = self.client.post(endpoint, {"company": str(other.id), "code": "WRONG",
            "provider": "Test", "channel": "EINVOICE"}, format="json")
        self.assertEqual(foreign.status_code, 400)

    def test_internal_obligation_xlsx_export_keeps_snapshot(self):
        obligation = TaxObligation.objects.create(company=self.company, period_id=self.period, tax_type="VAT",
            due_date=self.today, assessed_amount=Decimal("123000"), created_by=self.user.iam_account)
        endpoint = f"/api/v1/tax/exports/generate/{self.query}"
        exported = self.client.post(endpoint, {"company": str(self.company.id), "period": self.period,
            "export_type": "TAX_OBLIGATION", "purpose": "REPORT"}, format="json")
        self.assertEqual(exported.status_code, 201, exported.data)
        self.assertEqual(exported.data["submission_status"], "NOT_SUBMITTED")
        self.assertEqual(exported.data["data_snapshot"]["row_count"], 1)
        obligation.assessed_amount = Decimal("999000")
        obligation.save(update_fields=("assessed_amount",))
        downloaded = self.client.get(f"/api/v1/tax/exports/{exported.data['id']}/download/{self.query}")
        self.assertEqual(downloaded.status_code, 200)
        book = load_workbook(BytesIO(downloaded.content), read_only=True)
        self.assertIn("Báo cáo nội bộ", book.active[2][0].value)
        self.assertEqual(book.active[6][2].value, 123000)
        invalid = self.client.post(endpoint, {"company": str(self.company.id), "period": self.period,
            "export_type": "TAX_OBLIGATION", "purpose": "EXTERNAL_SUBMISSION"}, format="json")
        self.assertEqual(invalid.status_code, 400)
        submitted = self.client.post(f"/api/v1/tax/exports/{exported.data['id']}/submission-result/{self.query}",
            {"status": "ACCEPTED"}, format="json")
        self.assertEqual(submitted.status_code, 400)

    def test_manual_submission_tracks_version_and_evidence_without_changing_declaration(self):
        from .vat import source_hash
        period = TaxPeriod.objects.get(pk=self.period)
        calculation = VatCalculation.objects.create(company=self.company, period=period, version=1,
            source_snapshot_hash=source_hash(period), status="CALCULATED", payable_amount=Decimal("100"),
            calculated_by=self.user.iam_account)
        declaration = TaxDeclaration.objects.create(company=self.company, period=period, form_code="01/GTGT",
            source_calculation=calculation, source_snapshot_hash=calculation.source_snapshot_hash,
            indicators={"payable": "100"}, preparation_status="READY_TO_SUBMIT",
            confirmed_at=timezone.now(), confirmed_by=self.user.iam_account, created_by=self.user.iam_account)
        endpoint = f"/api/v1/tax/declarations/{declaration.id}/manual-submissions/{self.query}"
        body = {"declaration_version": 1, "submitted_at": timezone.now().isoformat(),
            "external_reference": "CQT-RECEIPT-001", "evidence_reference": "receipt-001.pdf"}
        wrong_version = self.client.post(endpoint, {**body, "declaration_version": 2}, format="json")
        self.assertEqual(wrong_version.status_code, 400)
        created = self.client.post(endpoint, body, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["status"], "SUBMITTED_EXTERNALLY")
        self.assertEqual(created.data["verification_source"], "MANUAL")
        self.assertEqual(created.data["declaration_snapshot"]["indicators"]["payable"], "100")
        self.assertEqual(self.client.post(endpoint, body, format="json").status_code, 200)
        self.assertEqual(self.client.post(endpoint, {**body, "evidence_reference": "another.pdf"}, format="json").status_code, 400)
        self.assertEqual(TaxSubmission.objects.filter(declaration=declaration).count(), 1)
        update_url = f"/api/v1/tax/submissions/{created.data['id']}/manual-status/{self.query}"
        self.assertEqual(self.client.post(update_url, {"status": "ACCEPTED"}, format="json").status_code, 400)
        accepted = self.client.post(update_url, {"status": "ACCEPTED", "evidence_reference": "receipt-accepted.pdf",
            "note": "Thông báo chấp nhận được đối chiếu thủ công"}, format="json")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(len(accepted.data["events"]), 2)
        self.assertEqual(accepted.data["verification_source"], "MANUAL")
        self.assertEqual(self.client.post(update_url, {"status": "REJECTED", "evidence_reference": "receipt-x.pdf",
            "note": "Không được sửa kết quả đã chốt"}, format="json").status_code, 400)
        declaration.refresh_from_db()
        self.assertEqual(declaration.preparation_status, "READY_TO_SUBMIT")

    def create_invoice(self, number, direction="OUTPUT", invoice_type="ORIGINAL", original=None, effect=""):
        seller_tax = self.company.tax_code if direction == "OUTPUT" else self.party.tax_code
        payload = {
            "company": str(self.company.id), "branch": str(self.branch.id), "direction": direction,
            "invoice_type": invoice_type, "adjustment_effect": effect, "original_invoice": original,
            "invoice_series": "C26TAA", "invoice_number": number, "invoice_date": str(self.today),
            "seller_name": self.company.name if direction == "OUTPUT" else self.party.name,
            "seller_tax_code": seller_tax, "buyer_name": self.party.name if direction == "OUTPUT" else self.company.name,
            "buyer_tax_code": self.party.tax_code if direction == "OUTPUT" else self.company.tax_code,
            "party": str(self.party.id), "currency": str(self.currency.id), "exchange_rate": "1",
            "source": "MANUAL", "lines": [{
                "line_no": 1, "item": str(self.item.id), "description": "Hàng hóa",
                "quantity": "1", "unit_price": "1000", "discount_amount": "0", "tax_rate": "10",
            }],
            "raw_data": {"correction_reason": "Sai thông tin hóa đơn"} if original and direction == "OUTPUT" else {},
        }
        response = self.client.post(f"/api/v1/tax/invoices/{self.query}", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def validate_and_issue(self, invoice_id, key):
        checked = self.client.post(f"/api/v1/tax/invoices/{invoice_id}/validate/{self.query}", {}, format="json")
        self.assertEqual(checked.status_code, 200, checked.data)
        self.assertEqual(checked.data["status"], "VALIDATED")
        issued = self.client.post(
            f"/api/v1/tax/invoices/{invoice_id}/issue/{self.query}",
            {"connector": self.connector, "idempotency_key": key, "payload": {"invoice": invoice_id}}, format="json",
        )
        self.assertEqual(issued.status_code, 201, issued.data)
        result = self.issue_result(issued.data["id"], {"status": "SUCCESS",
            "response": {"confirmed": True, "provider_invoice_id": f"EXT-{key}",
                "invoice_number": TaxInvoice.objects.get(pk=invoice_id).invoice_number,
                "lookup_code": f"LOOKUP-{key}"}})
        self.assertEqual(result.status_code, 200, result.data)

    def issue_result(self, request_id, payload, signed=True):
        canonical = json.dumps({"request_id": request_id, "status": payload["status"],
            "response": payload.get("response") or {}}, sort_keys=True,
            separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        signature = hmac.new(b"test-provider-secret", canonical, hashlib.sha256).hexdigest()
        return self.client.post(f"/api/v1/tax/integrations/{request_id}/result/{self.query}",
            payload, format="json", HTTP_X_TAX_PROVIDER_SIGNATURE=signature if signed else "")

    def test_output_draft_can_wait_for_provider_number_without_false_issue(self):
        first = self.create_invoice("")
        second = self.create_invoice("")
        self.assertNotEqual(first, second)
        checked = self.client.post(f"/api/v1/tax/invoices/{first}/validate/{self.query}", {}, format="json")
        self.assertEqual(checked.data["status"], "VALIDATED")
        issued = self.client.post(f"/api/v1/tax/invoices/{first}/issue/{self.query}",
            {"connector": self.connector, "idempotency_key": "DRAFT-ISSUE-1", "payload": {"forged": True}}, format="json")
        self.assertEqual(issued.status_code, 201, issued.data)
        self.assertEqual(TaxInvoice.objects.get(pk=first).status, "ISSUING")
        self.assertNotIn("forged", issued.data["request_payload"])
        self.assertIn("snapshot_sha256", issued.data["request_payload"])
        duplicate = self.client.post(f"/api/v1/tax/invoices/{first}/issue/{self.query}",
            {"connector": self.connector, "idempotency_key": "DRAFT-ISSUE-2"}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        unsigned = self.issue_result(issued.data["id"], {"status": "SUCCESS",
            "response": {"confirmed": True, "provider_invoice_id": "EXT", "invoice_number": "000100",
                         "lookup_code": "LOOKUP"}}, signed=False)
        self.assertEqual(unsigned.status_code, 400)
        incomplete = self.issue_result(issued.data["id"],
            {"status": "SUCCESS", "response": {"accepted": True}})
        self.assertEqual(incomplete.status_code, 400)
        self.assertEqual(TaxInvoice.objects.get(pk=first).status, "ISSUING")
        confirmed = self.issue_result(issued.data["id"],
            {"status": "SUCCESS", "response": {"confirmed": True, "provider_invoice_id": "EXT-DRAFT-1",
                "invoice_number": "000100", "lookup_code": "LOOKUP-DRAFT-1"}})
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(TaxInvoice.objects.get(pk=first).invoice_number, "000100")
        self.assertEqual(TaxInvoice.objects.get(pk=first).status, "ISSUED")
        edit = self.client.patch(f"/api/v1/tax/invoices/{first}/{self.query}",
            {"buyer_name": "Changed"}, format="json")
        self.assertEqual(edit.status_code, 400)
        self.client.post(f"/api/v1/tax/invoices/{second}/validate/{self.query}", {}, format="json")
        changed = self.client.patch(f"/api/v1/tax/invoices/{second}/{self.query}",
            {"buyer_name": "Updated buyer"}, format="json")
        self.assertEqual(changed.data["status"], "DRAFT")
        self.client.post(f"/api/v1/tax/invoices/{second}/validate/{self.query}", {}, format="json")
        retryable = self.client.post(f"/api/v1/tax/invoices/{second}/issue/{self.query}",
            {"connector": self.connector, "idempotency_key": "DRAFT-ISSUE-2"}, format="json")
        self.assertEqual(retryable.status_code, 201, retryable.data)
        failed = self.issue_result(retryable.data["id"],
            {"status": "FAILED", "response": {"error_code": "REJECTED"}})
        self.assertEqual(failed.status_code, 200, failed.data)
        self.assertEqual(TaxInvoice.objects.get(pk=second).status, "ISSUE_FAILED")

    def test_output_issue_adjustment_chain_and_idempotency(self):
        original = self.create_invoice("000001")
        self.validate_and_issue(original, "ISSUE-001")
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ISSUED")
        adjustment = self.create_invoice("000002", invoice_type="ADJUSTMENT", original=original, effect="DECREASE")
        self.validate_and_issue(adjustment, "ISSUE-002")
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ADJUSTED")
        duplicate_request = self.client.post(
            f"/api/v1/tax/invoices/{adjustment}/issue/{self.query}",
            {"connector": self.connector, "idempotency_key": "ISSUE-002"}, format="json",
        )
        self.assertEqual(duplicate_request.status_code, 400, duplicate_request.data)
        summary = self.client.post(
            f"/api/v1/tax/summaries/build/{self.query}", {"company": str(self.company.id), "period": self.period}, format="json",
        )
        self.assertEqual(Decimal(summary.data["output_tax_amount"]), Decimal("0"))
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="TAX").exists())

    def test_correction_draft_replacement_and_history(self):
        original = self.create_invoice("000301")
        self.validate_and_issue(original, "ORIGINAL-301")
        adjustment = self.create_invoice("000302", invoice_type="ADJUSTMENT", original=original, effect="DECREASE")
        link = TaxInvoiceLink.objects.get(target_id=adjustment)
        self.assertEqual(str(link.original_id), original)
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ISSUED")
        replacement = self.create_invoice("000303", invoice_type="REPLACEMENT", original=original)
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ISSUED")
        response = self.client.get(f"/api/v1/tax/invoices/{original}/history/{self.query}")
        self.assertEqual({row["id"] for row in response.data["corrections"]}, {adjustment, replacement})
        self.validate_and_issue(replacement, "REPLACE-301")
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "REPLACED")
        summary = self.client.post(f"/api/v1/tax/summaries/build/{self.query}",
            {"company": str(self.company.id), "period": self.period}, format="json")
        self.assertEqual(Decimal(summary.data["output_tax_amount"]), Decimal("100"))
        blocked = self.client.post(f"/api/v1/tax/invoices/{adjustment}/validate/{self.query}", {}, format="json")
        self.assertEqual(blocked.status_code, 200)
        cannot_issue = self.client.post(f"/api/v1/tax/invoices/{adjustment}/issue/{self.query}",
            {"connector": self.connector, "idempotency_key": "LATE-ADJUSTMENT"}, format="json")
        self.assertEqual(cannot_issue.status_code, 400)

    def test_cancel_waits_for_signed_provider_result(self):
        original = self.create_invoice("000401")
        self.validate_and_issue(original, "ORIGINAL-401")
        url = f"/api/v1/tax/invoices/{original}/cancel/{self.query}"
        missing_case = self.client.post(url, {"connector": self.connector, "reason": "Sai hóa đơn",
            "idempotency_key": "CANCEL-NO-CASE"}, format="json")
        self.assertEqual(missing_case.status_code, 400)
        first = self.client.post(url, {"connector": self.connector, "reason": "Lập nhầm trước khi gửi",
            "case_type": "NOT_SENT_TO_BUYER", "idempotency_key": "CANCEL-401"}, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ISSUED")
        processing = self.issue_result(first.data["id"], {"status": "PROCESSING",
            "response": {"provider_request_id": "P-401"}})
        self.assertEqual(processing.status_code, 200)
        self.assertEqual(processing.data["status"], "PENDING")
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ISSUED")
        duplicate = self.client.post(url, {"connector": self.connector, "reason": "Thử lại",
            "case_type": "NOT_SENT_TO_BUYER", "idempotency_key": "CANCEL-402"}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        unsigned = self.issue_result(first.data["id"], {"status": "SUCCESS",
            "response": {"confirmed": True, "provider_reference": "C-401"}}, signed=False)
        self.assertEqual(unsigned.status_code, 400)
        incomplete = self.issue_result(first.data["id"], {"status": "SUCCESS", "response": {"confirmed": True}})
        self.assertEqual(incomplete.status_code, 400)
        failed = self.issue_result(first.data["id"], {"status": "FAILED", "response": {"code": "REJECTED"}})
        self.assertEqual(failed.status_code, 200)
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "ISSUED")
        self.assertEqual(TaxInvoice.objects.get(pk=original).external_status, "SUCCESS")
        retry = self.client.post(url, {"connector": self.connector, "reason": "Lập nhầm trước khi gửi",
            "case_type": "NOT_SENT_TO_BUYER", "idempotency_key": "CANCEL-403"}, format="json")
        self.assertEqual(retry.status_code, 201, retry.data)
        confirmed = self.issue_result(retry.data["id"], {"status": "SUCCESS",
            "response": {"confirmed": True, "provider_reference": "C-403"}})
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(TaxInvoice.objects.get(pk=original).status, "CANCELLED")

    def test_invoice_query_filters_pages_and_keeps_business_state(self):
        output = self.create_invoice("MG-101")
        input_id = self.create_invoice("MG-101", direction="INPUT")
        other_company = Company.objects.create(code="OTHERTAX", name="Other Tax", legal_name="Other Tax",
            tax_code="0100999888", accounting_currency=self.currency, legal_reporting_currency=self.currency)
        other_branch = Branch.objects.create(company=other_company, code="HN", name="Hà Nội")
        TaxInvoice.objects.create(company=other_company, branch=other_branch, direction="OUTPUT",
            invoice_series="C26TAA", invoice_number="MG-101", invoice_date=self.today,
            seller_name=other_company.name, seller_tax_code=other_company.tax_code,
            buyer_name="Khách khác", currency=self.currency,
            created_by=TaxInvoice.objects.get(pk=output).created_by)
        before = list(TaxInvoice.objects.filter(company=self.company).values_list("id", "status"))
        base = f"/api/v1/tax/invoices/query/{self.query}"
        both = self.client.get(base + "&number=MG-101&page_size=1")
        self.assertEqual(both.status_code, 200, both.data)
        self.assertEqual(both.data["count"], 2)
        self.assertEqual(len(both.data["results"]), 1)
        second = self.client.get(base + "&number=MG-101&page_size=1&page=2")
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual({both.data["results"][0]["id"], second.data["results"][0]["id"]},
                         {output, input_id})
        incoming = self.client.get(base + "&direction=INPUT&tax_code=0101234567")
        self.assertEqual(incoming.data["count"], 1)
        self.assertEqual(incoming.data["results"][0]["validation_status"], "NOT_CHECKED")
        self.assertEqual(incoming.data["results"][0]["accounting_status"], "UNKNOWN")
        bad_dates = self.client.get(base + "&date_from=2026-12-31&date_to=2026-01-01")
        self.assertEqual(bad_dates.status_code, 400)
        malformed_date = self.client.get(base + "&date_from=not-a-date")
        self.assertEqual(malformed_date.status_code, 400)
        self.assertEqual(before, list(TaxInvoice.objects.filter(company=self.company).values_list("id", "status")))

    def test_vat_calculation_review_version_and_draft_document(self):
        from common_services.models import AccountingPolicy, FiscalPeriod, FiscalYear
        from general_ledger.models import Account, ChartOfAccounts, JournalEntry

        original = self.create_invoice("VAT-001")
        self.validate_and_issue(original, "VAT-ISSUE-001")
        input_one = self.create_invoice("VAT-IN-001", direction="INPUT")
        input_two = self.create_invoice("VAT-IN-002", direction="INPUT")
        for invoice_id in (input_one, input_two):
            checked = self.client.post(f"/api/v1/tax/invoices/{invoice_id}/validate/{self.query}",
                {"tax_eligible": True}, format="json")
            self.assertEqual(checked.status_code, 200, checked.data)
            # A separate UC-TAX-02 conclusion supplies eligibility; its current automated
            # checker deliberately leaves signature verification for manual review.
            TaxInvoice.objects.filter(pk=invoice_id).update(status="VALIDATED", tax_eligible=True,
                validation_summary={"processing_status": "PASSED", "errors": 0})
        calculate_url = f"/api/v1/tax/vat-calculations/calculate/{self.query}"
        body = {"company": str(self.company.id), "period": self.period}
        cross_company = self.client.post(calculate_url, {"company": "00000000-0000-0000-0000-000000000001",
            "period": self.period}, format="json")
        self.assertEqual(cross_company.status_code, 400)
        review = self.client.post(calculate_url, body, format="json")
        self.assertEqual(review.status_code, 201, review.data)
        self.assertEqual(review.data["status"], "REVIEW_REQUIRED")
        self.assertEqual(Decimal(review.data["output_tax_amount"]), Decimal("100"))
        self.assertEqual(Decimal(review.data["input_deductible_amount"]), Decimal("200"))
        self.assertEqual(Decimal(review.data["carry_forward_out"]), Decimal("100"))
        self.assertEqual(VatLedgerEntry.objects.filter(period_id=self.period).count(), 3)
        blocked = self.client.post(f"/api/v1/tax/vat-calculations/{review.data['id']}/deduction-document/{self.query}", {}, format="json")
        self.assertEqual(blocked.status_code, 400)

        actor = TaxInvoice.objects.get(pk=original).created_by
        year = FiscalYear.objects.create(company=self.company, code="FY-VAT", name="VAT Year",
            start_date=self.today.replace(month=1, day=1), end_date=self.today.replace(month=12, day=31), created_by=actor)
        fiscal_period = FiscalPeriod.objects.create(company=self.company, fiscal_year=year, code="FP-VAT",
            name="VAT Period", period_number=self.today.month, start_date=self.today.replace(day=1), end_date=self.today)
        AccountingPolicy.objects.create(company=self.company, code="VAT-POLICY", name="VAT Policy",
            effective_from_period=fiscal_period, tax_method="DEDUCTION", status="ACTIVE", created_by=actor)
        chart = ChartOfAccounts.objects.create(company=self.company, code="VAT-CHART", name="VAT chart",
            effective_from=self.today.replace(day=1))
        input_account = Account.objects.create(company=self.company, chart_of_accounts=chart, code="1331", name="VAT input")
        output_account = Account.objects.create(company=self.company, chart_of_accounts=chart, code="3331", name="VAT output")
        calculated = self.client.post(calculate_url, body, format="json")
        self.assertEqual(calculated.status_code, 201, calculated.data)
        self.assertEqual(calculated.data["status"], "CALCULATED")
        self.assertTrue(calculated.data["source_is_current"])
        self.assertEqual(calculated.data["version"], 2)
        before_journals = JournalEntry.objects.filter(company=self.company).count()
        document_url = f"/api/v1/tax/vat-calculations/{calculated.data['id']}/deduction-document/{self.query}"
        document = self.client.post(document_url, {"input_account": str(input_account.id),
            "output_account": str(output_account.id), "document_date": str(self.today),
            "posting_date": str(self.today)}, format="json")
        self.assertEqual(document.status_code, 201, document.data)
        self.assertEqual(document.data["status"], "DRAFT")
        self.assertEqual(Decimal(document.data["amount"]), Decimal("100"))
        self.assertEqual(JournalEntry.objects.filter(company=self.company).count(), before_journals)
        duplicate = self.client.post(document_url, {"input_account": str(input_account.id),
            "output_account": str(output_account.id), "document_date": str(self.today),
            "posting_date": str(self.today)}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(VatDeductionDocument.objects.filter(period_id=self.period).count(), 1)
        TaxInvoice.objects.filter(pk=input_one).update(tax_eligible=False)
        stale = self.client.get(f"/api/v1/tax/vat-calculations/{calculated.data['id']}/{self.query}")
        self.assertFalse(stale.data["source_is_current"])
        self.assertEqual(VatCalculation.objects.filter(period_id=self.period).count(), 2)

    def test_vat_calculation_does_not_double_count_adjusted_replaced_invoice(self):
        original = self.create_invoice("VAT-ORIGINAL")
        self.validate_and_issue(original, "VAT-ORIGINAL-ISSUE")
        adjustment = self.create_invoice("VAT-DECREASE", invoice_type="ADJUSTMENT",
            original=original, effect="DECREASE")
        self.validate_and_issue(adjustment, "VAT-DECREASE-ISSUE")
        url = f"/api/v1/tax/vat-calculations/calculate/{self.query}"
        body = {"company": str(self.company.id), "period": self.period}
        adjusted = self.client.post(url, body, format="json")
        self.assertEqual(adjusted.status_code, 201, adjusted.data)
        self.assertEqual(Decimal(adjusted.data["output_tax_amount"]), Decimal("0"))
        replacement = self.create_invoice("VAT-REPLACEMENT", invoice_type="REPLACEMENT", original=original)
        self.validate_and_issue(replacement, "VAT-REPLACEMENT-ISSUE")
        replaced = self.client.post(url, body, format="json")
        self.assertEqual(replaced.status_code, 201, replaced.data)
        self.assertEqual(Decimal(replaced.data["output_tax_amount"]), Decimal("100"))
        excluded = [row for row in replaced.data["sources"] if row["decision"] == "EXCLUDED"]
        self.assertEqual(len(excluded), 2)

    def test_input_link_summary_filing_export_and_reconciliation(self):
        invoice_id = self.create_invoice("000010", direction="INPUT")
        checked = self.client.post(f"/api/v1/tax/invoices/{invoice_id}/validate/{self.query}", {"tax_eligible": True}, format="json")
        self.assertEqual(checked.data["status"], "RECEIVED")
        self.assertEqual(checked.data["validation_summary"]["processing_status"], "MANUAL_REVIEW")
        self.assertFalse(checked.data["tax_eligible"])
        link = self.client.post(
            f"/api/v1/tax/document-links/{self.query}",
            {
                "company": str(self.company.id), "invoice": invoice_id, "module_code": "AP",
                "entity_type": "SupplierInvoice", "entity_id": "11111111-1111-1111-1111-111111111111",
                "document_number": "AP-001", "linked_amount": "1100",
            }, format="json",
        )
        self.assertEqual(link.status_code, 400, link.data)
        summary = self.client.post(
            f"/api/v1/tax/summaries/build/{self.query}", {"company": str(self.company.id), "period": self.period}, format="json",
        )
        self.assertEqual(summary.status_code, 201, summary.data)
        self.assertEqual(Decimal(summary.data["input_tax_amount"]), Decimal("0"))
        filing = self.client.post(
            f"/api/v1/tax/filings/{self.query}",
            {"company": str(self.company.id), "period": self.period, "summary": summary.data["id"], "filing_type": "VAT_RETURN", "version": 1, "indicators": {}}, format="json",
        )
        self.assertEqual(filing.status_code, 201, filing.data)
        exported = self.client.post(
            f"/api/v1/tax/exports/{self.query}",
            {"company": str(self.company.id), "period": self.period, "filing": filing.data["id"], "format_code": "XML", "format_version": "2.1"}, format="json",
        )
        self.assertEqual(exported.status_code, 201, exported.data)
        self.assertEqual(exported.data["submission_status"], "NOT_SUBMITTED")
        reconciled = self.client.post(
            f"/api/v1/tax/reconciliations/run/{self.query}", {"company": str(self.company.id), "period": self.period}, format="json",
        )
        self.assertEqual(reconciled.status_code, 201, reconciled.data)
        self.assertEqual(reconciled.data["discrepancy_count"], 1)
        self.assertEqual(TaxSummary.objects.filter(period_id=self.period).count(), 1)

    def test_declaration_registration_draft_review_and_confirm(self):
        from .vat import source_hash

        registration_url = f"/api/v1/tax/form-registrations/{self.query}"
        form = {"company": str(self.company.id), "period": self.period, "form_code": "01/GTGT"}
        create_url = f"/api/v1/tax/declarations/{self.query}"
        self.assertEqual(self.client.post(create_url, form, format="json").status_code, 400)
        saved = self.client.put(registration_url, {"company": str(self.company.id),
            "forms": ["01/GTGT", "03/TNDN"]}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(len(saved.data["forms"]), 2)
        self.assertEqual(self.client.post(create_url, form, format="json").status_code, 400)

        calculation = VatCalculation.objects.create(company=self.company, period_id=self.period,
            version=1, source_snapshot_hash=source_hash(TaxPeriod.objects.get(pk=self.period)),
            status="REVIEW_REQUIRED", warnings=["Cần rà soát nguồn"], calculated_by=self.user.iam_account)
        created = self.client.post(create_url, form, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["preparation_status"], "REVIEW_REQUIRED")
        self.assertEqual(str(created.data["source_calculation"]), str(calculation.id))
        self.assertEqual(created.data["indicators"], {})
        self.assertEqual(self.client.post(create_url, form, format="json").status_code, 200)
        self.assertEqual(TaxDeclaration.objects.filter(period_id=self.period).count(), 1)

        detail = f"/api/v1/tax/declarations/{created.data['id']}/"
        self.assertEqual(self.client.post(f"{detail}confirm/{self.query}", {}, format="json").status_code, 400)
        note = self.client.post(f"{detail}save-draft/{self.query}",
            {"row_version": 1, "notes": "Đã kiểm tra hồ sơ"}, format="json")
        self.assertEqual(note.status_code, 200, note.data)
        self.assertEqual(note.data["row_version"], 2)
        self.assertEqual(self.client.post(f"{detail}save-draft/{self.query}",
            {"row_version": 1, "notes": "Ghi đè"}, format="json").status_code, 400)
        calculation.status = "CALCULATED"
        calculation.warnings = []
        calculation.save(update_fields=("status", "warnings"))
        refreshed = self.client.post(f"{detail}refresh-source/{self.query}", {}, format="json")
        self.assertEqual(refreshed.status_code, 200, refreshed.data)
        self.assertEqual(refreshed.data["preparation_status"], "DRAFT")
        self.assertEqual(Decimal(refreshed.data["indicators"]["payable"]), Decimal("0"))
        confirmed = self.client.post(f"{detail}confirm/{self.query}", {}, format="json")
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.assertEqual(confirmed.data["preparation_status"], "READY_TO_SUBMIT")
        self.assertIsNone(confirmed.data.get("submitted_at"))
        self.assertEqual(self.client.post(f"{detail}save-draft/{self.query}",
            {"row_version": 3, "notes": "Sửa sau xác nhận"}, format="json").status_code, 400)
        self.assertEqual(CompanyTaxFormRegistration.objects.filter(company=self.company, is_active=True).count(), 2)
        self.assertEqual(self.client.put(registration_url, {"company": str(self.company.id),
            "forms": []}, format="json").status_code, 200)
        self.assertEqual(TaxDeclaration.objects.filter(period_id=self.period).count(), 1)

    def test_obligation_from_confirmed_declaration_and_draft_payment_order(self):
        from .vat import source_hash

        period = TaxPeriod.objects.get(pk=self.period)
        calc = VatCalculation.objects.create(company=self.company, period=period, version=1,
            source_snapshot_hash=source_hash(period), status="CALCULATED", payable_amount=Decimal("100"),
            calculated_by=self.user.iam_account)
        declaration = TaxDeclaration.objects.create(company=self.company, period=period, form_code="01/GTGT",
            source_calculation=calc, source_snapshot_hash=calc.source_snapshot_hash,
            indicators={"payable": "100"}, created_by=self.user.iam_account)
        recognize_url = f"/api/v1/tax/obligations/recognize/{self.query}"
        body = {"company": str(self.company.id), "declaration": str(declaration.id), "due_date": "2026-11-20"}
        self.assertEqual(self.client.post(recognize_url, body, format="json").status_code, 400)
        declaration.preparation_status = "READY_TO_SUBMIT"
        declaration.save(update_fields=("preparation_status",))
        recognized = self.client.post(recognize_url, body, format="json")
        self.assertEqual(recognized.status_code, 201, recognized.data)
        self.assertEqual(self.client.post(recognize_url, body, format="json").status_code, 200)
        obligation = TaxObligation.objects.get(pk=recognized.data["id"])
        self.assertEqual(obligation.assessed_amount, Decimal("100"))
        self.assertEqual(obligation.basis_status, "INTERNAL_CONFIRMED")
        self.assertEqual(obligation.paid_amount, Decimal("0"))
        other_period = TaxPeriod.objects.create(company=self.company, code="2026-09", tax_type="CIT",
            start_date=period.start_date, end_date=period.end_date)
        other = TaxObligation.objects.create(company=self.company, period=other_period, tax_type="CIT",
            due_date=period.end_date, assessed_amount=Decimal("80"), created_by=self.user.iam_account)
        order_url = f"/api/v1/tax/payment-orders/{self.query}"
        order_body = {"company": str(self.company.id), "idempotency_key": "order-1", "payment_method": "BANK",
            "payment_date": "2026-10-23", "treasury": "KBNN được xác minh", "treasury_account": "TK-được-xác-minh",
            "lines": [{"obligation": str(obligation.id), "content": "Nộp thuế GTGT", "subitem_code": "MÃ-XÁC-MINH", "amount": "40"},
                      {"obligation": str(other.id), "content": "Nộp thuế TNDN", "subitem_code": "MÃ-XÁC-MINH-2", "amount": "30"}]}
        draft = self.client.post(order_url, order_body, format="json")
        self.assertEqual(draft.status_code, 201, draft.data)
        self.assertEqual(Decimal(draft.data["total_amount"]), Decimal("70"))
        self.assertEqual(len(draft.data["lines"]), 2)
        self.assertEqual(draft.data["status"], "DRAFT")
        obligation.refresh_from_db()
        self.assertEqual(obligation.paid_amount, Decimal("0"))
        self.assertEqual(self.client.post(order_url, order_body, format="json").status_code, 200)
        changed_retry = {**order_body, "treasury": "Kho bạc khác"}
        self.assertEqual(self.client.post(order_url, changed_retry, format="json").status_code, 400)
        self.assertEqual(TaxPaymentOrder.objects.filter(company=self.company).count(), 1)
        too_much = {**order_body, "idempotency_key": "order-2",
            "lines": [{**order_body["lines"][0], "amount": "70"}]}
        self.assertEqual(self.client.post(order_url, too_much, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"/api/v1/tax/payment-orders/{draft.data['id']}/cancel/{self.query}",
            {}, format="json").status_code, 200)
        second = self.client.post(order_url, too_much, format="json")
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(self.client.post(f"/api/v1/tax/obligations/{obligation.id}/link-payment/{self.query}",
            {}, format="json").status_code, 400)
        obligation.refresh_from_db()
        self.assertEqual(obligation.paid_amount, Decimal("0"))
