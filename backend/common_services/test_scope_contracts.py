"""Regression tests for company and branch boundaries shared by API modules."""

from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts_payable.models import SupplierInvoice
from iam.models import CompanyMembership
from master_data.models import Currency, Party
from organization.models import Branch, Company
from sales.models import SalesOrder


class ScopeBoundaryTests(TestCase):
    def setUp(self):
        currency = Currency.objects.get(code="VND")
        self.company_a = Company.objects.create(
            code="SCOPE_A", name="Scope A", legal_name="Scope A",
            tax_code="0100000101", accounting_currency=currency,
            legal_reporting_currency=currency,
        )
        self.company_b = Company.objects.create(
            code="SCOPE_B", name="Scope B", legal_name="Scope B",
            tax_code="0100000102", accounting_currency=currency,
            legal_reporting_currency=currency,
        )
        self.branch_a = Branch.objects.create(company=self.company_b, code="A", name="Branch A")
        self.branch_b = Branch.objects.create(company=self.company_b, code="B", name="Branch B")
        self.party_b = Party.objects.create(
            company=self.company_b, code="P-B", name="Party B",
            tax_code="0100000103", default_currency=currency,
        )
        self.user = get_user_model().objects.create_user(username="scope-user", password="pass")
        self.account = self.user.iam_account
        CompanyMembership.objects.create(company=self.company_b, user=self.account, created_by=self.account)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.currency = currency

    def test_sales_header_cannot_authorize_other_company_query(self):
        SalesOrder.objects.create(
            company=self.company_b, branch=self.branch_b, number="SO-B",
            document_date=date(2026, 10, 26), customer=self.party_b,
            currency=self.currency, created_by=self.account,
        )
        with patch(
            "sales.permissions.has_effective_permission",
            side_effect=lambda account, company, code, **scope: company.pk == self.company_a.pk,
        ):
            response = self.client.get(
                f"/api/v1/sales/orders/?company_id={self.company_b.pk}",
                HTTP_X_COMPANY_ID=str(self.company_a.pk),
            )
        self.assertEqual(response.status_code, 403, response.data)

    def test_account_class_create_cannot_target_other_company(self):
        with patch(
            "iam.permissions.has_effective_permission",
            side_effect=lambda account, company, code, **scope: company.pk == self.company_a.pk,
        ):
            response = self.client.post(
                f"/api/v1/general-ledger/account-classes/?company_id={self.company_a.pk}",
                {"company": str(self.company_b.pk), "code": "SCOPE", "name": "Scope", "normal_balance": "DEBIT"},
                format="json",
            )
        self.assertEqual(response.status_code, 403, response.data)

    def test_payable_invoice_list_respects_branch_scope(self):
        for branch, number in ((self.branch_a, "INV-A"), (self.branch_b, "INV-B")):
            SupplierInvoice.objects.create(
                company=self.company_b, branch=branch, supplier=self.party_b,
                supplier_tax_code=self.party_b.tax_code, invoice_series="SCOPE",
                invoice_number=number, invoice_date=date(2026, 10, 26),
                currency=self.currency, created_by=self.account,
            )
        with patch(
            "accounts_payable.permissions.has_effective_permission",
            side_effect=lambda account, company, code, **scope: (
                company.pk == self.company_b.pk and str(scope.get("branch_id")) == str(self.branch_a.pk)
            ),
        ):
            response = self.client.get(
                f"/api/v1/accounts-payable/invoices/?company_id={self.company_b.pk}&branch_id={self.branch_a.pk}"
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("INV-A", str(response.data))
        self.assertNotIn("INV-B", str(response.data))

    def test_payable_invoice_cannot_create_in_other_branch(self):
        with patch(
            "accounts_payable.permissions.has_effective_permission",
            side_effect=lambda account, company, code, **scope: (
                company.pk == self.company_b.pk and str(scope.get("branch_id")) == str(self.branch_a.pk)
            ),
        ):
            response = self.client.post(
                f"/api/v1/accounts-payable/invoices/?company_id={self.company_b.pk}&branch_id={self.branch_a.pk}",
                {"company": str(self.company_b.pk), "branch": str(self.branch_b.pk)},
                format="json",
            )
        self.assertEqual(response.status_code, 403, response.data)
