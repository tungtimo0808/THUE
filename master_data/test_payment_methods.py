from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership
from organization.models import Company
from organization.models import Branch
from general_ledger.models import Account, ChartOfAccounts
from cash_management.models import CashFund
from bank_management.models import AccountProfile
from .models import Bank, CompanyBankAccount, Currency, Party, PartyRole, PaymentMethod


class PaymentMethodApiTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Vietnam dong"})
        self.currency = currency
        self.company = Company.objects.create(code="PMCO", name="Methods", legal_name="Methods Ltd", tax_code="9922001", accounting_currency=currency, legal_reporting_currency=currency)
        self.other = Company.objects.create(code="PMOTHER", name="Other", legal_name="Other Ltd", tax_code="9922002", accounting_currency=currency, legal_reporting_currency=currency)
        self.user = get_user_model().objects.create_superuser(username="pm-admin", email="pm@example.com", password="password")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f"/api/v1/master-data/payment-methods/?company_id={self.company.pk}"
        bank = Bank.objects.create(code="PMBANK", name="Test bank")
        self.account = CompanyBankAccount.objects.create(company=self.company, account_number="123456", account_name="Methods", bank=bank, currency=currency)
        self.supplier = Party.objects.create(company=self.company, code="V1", name="Vendor")
        self.customer = Party.objects.create(company=self.company, code="C1", name="Customer")
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=date(2026, 1, 1))

    def payload(self, **overrides):
        data = {"company": str(self.company.pk), "code": "CASH", "name": "Cash", "group": "CASH", "scope": "BOTH", "requires_reference": False, "requires_bank_account": False, "supports_auto_reconcile": False}
        data.update(overrides)
        return data

    def create(self, **overrides):
        response = self.client.post(self.url, self.payload(**overrides), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def detail(self, method):
        return f"/api/v1/master-data/payment-methods/{method['id']}/?company_id={self.company.pk}"

    def test_validation_company_scope_and_audit(self):
        method = self.create()
        self.assertEqual(self.client.post(self.url, self.payload(code="cash"), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(code="BAD", default_bank_account=str(self.account.pk)), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(code="CROSS", company=str(self.other.pk)), format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(code="DATE", effective_from="2027-01-01", effective_to="2026-01-01"), format="json").status_code, 400)
        missing = self.payload(code="MISSING")
        missing.pop("group")
        self.assertEqual(self.client.post(self.url, missing, format="json").status_code, 400)
        self.assertEqual(self.client.get(f"/api/v1/master-data/payment-methods/{method['id']}/?company_id={self.other.pk}").status_code, 404)
        self.assertTrue(AuditLog.objects.filter(entity_id=method["id"], action_code="CREATE").exists())

    def test_bank_connection_and_default(self):
        method = self.create(code="BANK", name="Transfer", group="BANK", scope="PAYMENT", requires_reference=True,
                             requires_bank_account=True, default_bank_account=str(self.account.pk))
        invalid = self.client.patch(self.detail(method), {"version": 1, "integration_channel": "TEST"}, format="json")
        self.assertEqual(invalid.status_code, 400)
        self.account.connection_status = "CONNECTED"
        self.account.connection_provider = "TEST"
        self.account.save(update_fields=("connection_status", "connection_provider"))
        connected = self.client.patch(self.detail(method), {"version": 1, "integration_channel": "TEST", "supports_auto_reconcile": True}, format="json")
        self.assertEqual(connected.status_code, 200, connected.data)
        default = self.client.post(self.detail(connected.data).replace("/?", "/set-default/?"), {"version": 2, "scope": "PAYMENT"}, format="json")
        self.assertEqual(default.status_code, 200, default.data)
        suggested = self.client.get(f"/api/v1/master-data/payment-methods/suggest/?company_id={self.company.pk}&scope=PAYMENT&on_date=2026-06-01")
        self.assertEqual(suggested.data["id"], method["id"])
        stopped = self.client.post(self.detail(default.data).replace("/?", "/deactivate/?"), {"version": 3}, format="json")
        self.assertEqual(stopped.status_code, 400)

    def test_copy_import_and_permission(self):
        method = self.create()
        copied = self.client.post(self.detail(method).replace("/?", "/copy/?"), {"code": "CASH2", "name": "Second cash"}, format="json")
        self.assertEqual(copied.status_code, 201, copied.data)
        rows = [self.payload(code="A"), self.payload(code="B", group="NETTING", requires_bank_account=True)]
        preview = f"/api/v1/master-data/payment-methods/import-preview/?company_id={self.company.pk}"
        self.assertEqual(len(self.client.post(preview, {"rows": rows}, format="json").data["errors"]), 1)
        self.assertEqual(self.client.post(preview.replace("preview", "apply"), {"rows": rows}, format="json").status_code, 400)
        self.assertEqual(PaymentMethod.objects.count(), 2)
        rows[1]["requires_bank_account"] = False
        self.assertEqual(self.client.post(preview.replace("preview", "apply"), {"rows": rows}, format="json").status_code, 201)
        exported = self.client.get(f"/api/v1/master-data/payment-methods/export/?company_id={self.company.pk}")
        self.assertEqual(exported.status_code, 200)
        from django.core.files.uploadedfile import SimpleUploadedFile
        upload = SimpleUploadedFile("methods.csv", exported.content, content_type="text/csv")
        checked = self.client.post(preview, {"file": upload})
        self.assertEqual(checked.status_code, 200, checked.data)
        self.assertEqual(checked.data["valid_count"], 4)
        self.assertEqual(checked.data["errors"], [])
        regular = get_user_model().objects.create_user(username="pm-user", password="password")
        CompanyMembership.objects.create(company=self.company, user=regular.iam_account, created_by=self.user.iam_account)
        self.client.force_authenticate(regular)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_payment_and_receipt_enforce_selected_method(self):
        method = self.create(code="BANK", name="Transfer", group="BANK", scope="BOTH", requires_reference=True, requires_bank_account=True)
        payment_url = f"/api/v1/accounts-payable/payments/?company_id={self.company.pk}"
        payment = {"company": str(self.company.pk), "supplier": str(self.supplier.pk), "currency": str(self.currency.pk),
                   "payment_date": "2026-06-01", "amount": "100", "payment_method_config": method["id"]}
        self.assertEqual(self.client.post(payment_url, payment, format="json").status_code, 400)
        payment["external_reference"] = "TRX-1"
        self.assertEqual(self.client.post(payment_url, payment, format="json").status_code, 400)
        payment["company_bank_account"] = str(self.account.pk)
        result = self.client.post(payment_url, payment, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["external_type"], "BANK")
        self.assertEqual(result.data["payment_method_snapshot"]["name"], "Transfer")
        receipt_url = f"/api/v1/accounts-receivable/receipts/?company_id={self.company.pk}"
        receipt = {"company": str(self.company.pk), "customer": str(self.customer.pk), "currency": str(self.currency.pk),
                   "receipt_date": "2026-06-01", "amount": "100", "payment_method_config": method["id"],
                   "external_reference": "TRX-2", "company_bank_account": str(self.account.pk)}
        result = self.client.post(receipt_url, receipt, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["external_type"], "BANK")
        self.assertEqual(result.data["payment_method_snapshot"]["code"], "BANK")
        locked = self.client.patch(self.detail(method), {"version": 1, "group": "CARD"}, format="json")
        self.assertEqual(locked.status_code, 400)
        renamed = self.client.patch(self.detail(method), {"version": 1, "name": "Renamed transfer"}, format="json")
        self.assertEqual(renamed.status_code, 200, renamed.data)
        from accounts_payable.models import Payment
        self.assertEqual(Payment.objects.get(payment_method_config_id=method["id"]).payment_method_snapshot["name"], "Transfer")

    def test_cash_and_bank_transactions_validate_method_group(self):
        branch = Branch.objects.create(company=self.company, code="MAIN", name="Main")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="Chart", effective_from=date(2026, 1, 1))
        gl = Account.objects.create(company=self.company, chart_of_accounts=chart, code="111", name="Cash")
        fund = CashFund.objects.create(company=self.company, branch=branch, code="Q1", name="Cash fund", currency=self.currency, gl_account=gl)
        profile = AccountProfile.objects.create(company=self.company, account=self.account)
        cash_method = self.create(code="CM", name="Cash method", group="CASH", requires_reference=True)
        bank_method = self.create(code="BM", name="Bank method", group="BANK", requires_reference=True,
                                  requires_bank_account=True, default_bank_account=str(self.account.pk))
        cash_url = f"/api/v1/cash/transactions/?company_id={self.company.pk}"
        cash = {"company": str(self.company.pk), "fund": str(fund.pk), "number": "C-1", "transaction_type": "RECEIPT",
                "business_type": "OTHER", "transaction_date": "2026-06-01", "payer_payee": "Customer", "currency": str(self.currency.pk),
                "amount": "100", "exchange_rate": "1", "description": "Test", "source_reference": "REF-C",
                "payment_method_config": cash_method["id"]}
        self.assertEqual(self.client.post(cash_url, dict(cash, payment_method_config=bank_method["id"]), format="json").status_code, 400)
        result = self.client.post(cash_url, cash, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["payment_method_snapshot"]["group"], "CASH")
        bank_url = f"/api/v1/bank/transactions/?company_id={self.company.pk}"
        bank = {"company": str(self.company.pk), "account": str(profile.pk), "number": "B-1", "transaction_type": "RECEIPT",
                "business_type": "CUSTOMER_RECEIPT", "transaction_date": "2026-06-01", "counterparty_name": "Customer",
                "currency": str(self.currency.pk), "amount": "100", "exchange_rate": "1", "description": "Test",
                "bank_reference": "REF-B", "payment_method_config": bank_method["id"]}
        self.assertEqual(self.client.post(bank_url, dict(bank, payment_method_config=cash_method["id"]), format="json").status_code, 400)
        result = self.client.post(bank_url, bank, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["payment_method_snapshot"]["group"], "BANK")

    def test_receivable_document_planned_method_keeps_snapshot(self):
        method = self.create(code="WIRE", name="Wire transfer", group="BANK", scope="RECEIPT",
                             requires_reference=True, requires_bank_account=True)
        url = f"/api/v1/accounts-receivable/documents/?company_id={self.company.pk}"
        document = {"company": str(self.company.pk), "number": "AR-PM-1", "document_type": "SALES_INVOICE",
                    "document_date": "2026-06-01", "posting_date": "2026-06-01", "due_date": "2026-06-10",
                    "customer": str(self.customer.pk), "currency": str(self.currency.pk), "amount": "100",
                    "description": "Planned receipt", "payment_method_config": method["id"]}
        created = self.client.post(url, document, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["payment_method_snapshot"]["name"], "Wire transfer")
        self.assertEqual(self.client.patch(self.detail(method), {"version": 1, "group": "CASH"}, format="json").status_code, 400)
        renamed = self.client.patch(self.detail(method), {"version": 1, "name": "New name"}, format="json")
        self.assertEqual(renamed.status_code, 200, renamed.data)
        refreshed = self.client.get(f"/api/v1/accounts-receivable/documents/{created.data['id']}/?company_id={self.company.pk}")
        self.assertEqual(refreshed.data["payment_method_snapshot"]["name"], "Wire transfer")
        wrong_scope = self.create(code="PAYONLY", name="Payment only", group="BANK", scope="PAYMENT",
                                  requires_reference=True, requires_bank_account=True)
        document["number"] = "AR-PM-2"
        document["payment_method_config"] = wrong_scope["id"]
        self.assertEqual(self.client.post(url, document, format="json").status_code, 400)
