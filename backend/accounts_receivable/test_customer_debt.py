from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from master_data.models import Currency, Party
from organization.models import Branch, Company
from iam.models import (
    CompanyMembership, DataScopeBranch, DataScopeSet, Permission, Role,
    RolePermission, UserRoleAssignment,
)
from .models import (
    Netting, PostingStatus, Receipt, ReceiptAllocation, ReceiptStatus,
    Receivable, ReceivableAdjustment, ReceivableSchedule,
)


class CustomerDebtTests(TestCase):
    def setUp(self):
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="AR_REPORT", name="AR Report", legal_name="AR Report",
            tax_code="0309999777", accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="B1", name="Branch 1")
        self.other_branch = Branch.objects.create(company=self.company, code="B2", name="Branch 2")
        self.customer = Party.objects.create(
            company=self.company, code="C001", name="Customer 1", default_currency=self.currency,
        )
        self.user = get_user_model().objects.create_superuser(
            username="debt_admin", email="debt_admin@example.com", password="pass",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.start = date(2026, 1, 1)
        self.end = date(2026, 1, 31)
        self.url = f"/api/v1/accounts-receivable/receivables/customer-debts/?company_id={self.company.id}&from_date={self.start}&to_date={self.end}"

    def debt(self, code="AR-1", branch=None):
        debt = Receivable.objects.create(
            company=self.company, branch=branch or self.branch, code=code,
            customer=self.customer, source_document_type="JOURNAL_ENTRY",
            source_document_id=code, source_document_number=code,
            posting_date=date(2025, 12, 15), currency=self.currency,
            original_amount=Decimal("100"), balance=Decimal("100"),
            due_date=date(2026, 1, 10),
        )
        ReceivableSchedule.objects.create(
            company=self.company, receivable=debt, installment_no=1,
            amount=Decimal("60"), balance=Decimal("60"), due_date=date(2026, 1, 10),
        )
        ReceivableSchedule.objects.create(
            company=self.company, receivable=debt, installment_no=2,
            amount=Decimal("40"), balance=Decimal("40"), due_date=date(2026, 2, 10),
        )
        return debt

    def test_as_of_movements_installments_and_advance(self):
        debt = self.debt()
        receipt = Receipt.objects.create(
            company=self.company, customer=self.customer, currency=self.currency,
            receipt_date=date(2026, 1, 15), amount=Decimal("50"),
            external_type="BANK", external_reference="R1", created_by=self.user.iam_account,
        )
        ReceiptAllocation.objects.create(
            receipt=receipt, receivable=debt, amount=Decimal("30"),
            effective_date=date(2026, 1, 15), created_by=self.user.iam_account,
        )
        adjustment = ReceivableAdjustment.objects.create(
            company=self.company, receivable=debt, adjustment_date=date(2026, 1, 20),
            amount=Decimal("-10"), reason="Discount", status=PostingStatus.POSTED,
            created_by=self.user.iam_account,
        )
        ReceivableAdjustment.objects.filter(pk=adjustment.pk).update(
            posted_at=timezone.make_aware(datetime(2026, 1, 20, 12, 0))
        )
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.data)
        row = response.data["rows"][0]
        self.assertEqual(row["opening"], Decimal("100"))
        self.assertEqual(row["reduction"], Decimal("10"))
        self.assertEqual(row["payment"], Decimal("30"))
        self.assertEqual(row["closing"], Decimal("60"))
        self.assertEqual(row["overdue"], Decimal("20"))
        self.assertEqual(row["advance"], Decimal("20"))
        self.assertEqual(row["receivables"][0]["installments"][0]["age_bucket"], "OVER_1_30")
        past = self.client.get(self.url.replace("2026-01-31", "2026-01-14"))
        self.assertEqual(past.data["rows"][0]["closing"], Decimal("100"))

    def test_overdue_filter_and_zero_customer(self):
        debt = self.debt()
        response = self.client.get(self.url + "&overdue_only=true")
        self.assertEqual(len(response.data["rows"]), 1)
        debt.posting_date = date(2026, 2, 1)
        debt.save(update_fields=("posting_date",))
        response = self.client.get(self.url)
        self.assertEqual(response.data["rows"], [])

    def test_validation_and_export(self):
        response = self.client.get(self.url.replace("2026-01-01", "2026-02-01"))
        self.assertEqual(response.status_code, 400)
        response = self.client.get(self.url.replace("2026-01-31", "bad"))
        self.assertEqual(response.status_code, 400)
        self.debt()
        export = self.client.get(self.url.replace("customer-debts/", "customer-debts/export/"))
        self.assertEqual(export.status_code, 200)
        self.assertTrue(export.content.startswith(b"PK"))
        printed = self.client.get(self.url.replace("customer-debts/", "customer-debts/print/"))
        self.assertEqual(printed.status_code, 200)
        self.assertIn(b"Customer 1", printed.content)

    def test_anonymous_is_denied(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.url).status_code, (401, 403))

    def test_branch_scope_and_export_permission(self):
        self.debt("AR-B1", self.branch)
        self.debt("AR-B2", self.other_branch)
        staff = get_user_model().objects.create_user(
            username="debt_staff", email="debt_staff@example.com", password="pass",
        )
        membership = CompanyMembership.objects.create(
            company=self.company, user=staff.iam_account, created_by=self.user.iam_account,
        )
        role = Role.objects.create(company=self.company, name="AR Viewer", code="AR_VIEW", status="ACTIVE")
        RolePermission.objects.create(
            role=role, permission=Permission.objects.get(code="AR.RECEIVABLE.VIEW"),
        )
        scope = DataScopeSet.objects.create(
            company=self.company, code="B1_ONLY", name="B1 only",
            created_by=self.user.iam_account,
        )
        DataScopeBranch.objects.create(data_scope_set=scope, branch=self.branch)
        UserRoleAssignment.objects.create(
            company_membership=membership, role=role, data_scope_set=scope,
            assigned_by=self.user.iam_account,
            valid_from=timezone.now() - timedelta(minutes=1),
        )
        self.client.force_authenticate(staff)
        listed = self.client.get(self.url)
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data["rows"]), 1)
        denied_branch = self.client.get(self.url + f"&branch_id={self.other_branch.id}")
        self.assertEqual(denied_branch.status_code, 403)
        denied_export = self.client.get(self.url.replace("customer-debts/", "customer-debts/export/"))
        self.assertEqual(denied_export.status_code, 403)
