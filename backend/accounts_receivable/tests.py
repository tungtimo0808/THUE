from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from audit_log.models import AuditLog
from master_data.models import Currency,Party,PartyRole,PaymentTerm
from organization.models import Branch,Company
from .models import DocumentStatus,Receivable,ReceivableStatus


class ArApiTests(TestCase):
    def setUp(self):
        self.today=timezone.localdate();self.currency=Currency.objects.get(code="VND")
        self.company=Company.objects.create(code="ARCO",name="AR Co",legal_name="AR Co Ltd",tax_code="0100777766",accounting_currency=self.currency,legal_reporting_currency=self.currency)
        self.branch=Branch.objects.create(company=self.company,code="HN",name="Hà Nội")
        self.customer=Party.objects.create(company=self.company,code="KH01",name="Khách hàng",tax_code="0101234777",default_currency=self.currency)
        PartyRole.objects.create(party=self.customer,role_type="CUSTOMER",active_from=self.today)
        self.maker=get_user_model().objects.create_superuser(username="ar-maker",email="ar-maker@example.com",password="pass")
        self.approver=get_user_model().objects.create_superuser(username="ar-approver",email="ar-approver@example.com",password="pass")
        self.client=APIClient();self.client.force_authenticate(self.maker);self.query=f"?company_id={self.company.id}"

    def create_and_post_document(self):
        created=self.client.post(f"/api/v1/accounts-receivable/documents/{self.query}",{"company":str(self.company.id),"branch":str(self.branch.id),"number":"PT-001","document_type":"OTHER","document_date":str(self.today),"posting_date":str(self.today),"due_date":str(self.today+timedelta(days=30)),"customer":str(self.customer.id),"currency":str(self.currency.id),"exchange_rate":"1","amount":"1000000","description":"Phải thu dịch vụ"},format="json")
        self.assertEqual(created.status_code,201,created.data);doc_id=created.data["id"]
        submitted=self.client.post(f"/api/v1/accounts-receivable/documents/{doc_id}/submit/{self.query}",{},format="json");self.assertEqual(submitted.status_code,200,submitted.data)
        self.client.force_authenticate(self.approver)
        approved=self.client.post(f"/api/v1/accounts-receivable/documents/{doc_id}/approve/{self.query}",{"comment":"Đồng ý"},format="json");self.assertEqual(approved.data["status"],DocumentStatus.APPROVED)
        posted=self.client.post(f"/api/v1/accounts-receivable/documents/{doc_id}/post/{self.query}",{"posting_reference":"GL-AR-001"},format="json");self.assertEqual(posted.status_code,200,posted.data)
        return Receivable.objects.get(document_id=doc_id)

    def test_document_post_receipt_allocation_and_credit_limit(self):
        debt=self.create_and_post_document();self.client.force_authenticate(self.maker)
        receipt=self.client.post(f"/api/v1/accounts-receivable/receipts/{self.query}",{"company":str(self.company.id),"customer":str(self.customer.id),"currency":str(self.currency.id),"receipt_date":str(self.today),"amount":"400000","external_type":"BANK","external_reference":"BANK-IN-001"},format="json")
        self.assertEqual(receipt.status_code,201,receipt.data)
        allocated=self.client.post(f"/api/v1/accounts-receivable/receipts/{receipt.data['id']}/allocate/{self.query}",{"allocations":[{"receivable":str(debt.id),"amount":"400000"}]},format="json");self.assertEqual(allocated.status_code,200,allocated.data)
        debt.refresh_from_db();self.assertEqual(debt.balance,Decimal("600000"));self.assertEqual(debt.status,ReceivableStatus.PARTIALLY_PAID)
        policy=self.client.post(f"/api/v1/accounts-receivable/credit-policies/{self.query}",{"company":str(self.company.id),"customer":str(self.customer.id),"currency":str(self.currency.id),"credit_limit":"2000000","credit_days":30,"control_mode":"BLOCK","overdue_mode":"WARN","effective_from":str(self.today),"reason":"Cấp mới"},format="json")
        self.assertEqual(policy.status_code,201,policy.data);self.assertEqual(Decimal(policy.data["used_limit"]),Decimal("600000"));self.assertEqual(Decimal(policy.data["available_limit"]),Decimal("1400000"))
        credit_check=self.client.post(f"/api/v1/accounts-receivable/credit-policies/check/{self.query}",{"company":str(self.company.id),"customer":str(self.customer.id),"currency":str(self.currency.id),"amount":"1500000"},format="json")
        self.assertEqual(credit_check.status_code,200,credit_check.data);self.assertFalse(credit_check.data["allowed"]);self.assertTrue(credit_check.data["exceeded"])
        summary=self.client.get(f"/api/v1/accounts-receivable/receivables/summary/{self.query}");self.assertEqual(Decimal(str(summary.data["balance"])),Decimal("600000"))
        self.assertTrue(AuditLog.objects.filter(company=self.company,module_code="AR").exists())

    def test_collection_reminder_confirmation_and_adjustment(self):
        debt=self.create_and_post_document();self.client.force_authenticate(self.maker)
        plan=self.client.post(f"/api/v1/accounts-receivable/collection-plans/{self.query}",{"company":str(self.company.id),"receivable":str(debt.id),"expected_date":str(self.today+timedelta(days=7)),"expected_amount":"500000","responsible":str(self.maker.iam_account.id),"note":"Nhắc đợt 1"},format="json")
        self.assertEqual(plan.status_code,201,plan.data)
        reminded=self.client.post(f"/api/v1/accounts-receivable/collection-plans/{plan.data['id']}/remind/{self.query}",{"channel":"EMAIL","recipient":"customer@example.com","content":"Vui lòng thanh toán","promise_date":str(self.today+timedelta(days=5))},format="json");self.assertEqual(reminded.status_code,200,reminded.data);self.assertEqual(reminded.data["status"],"PROMISED")
        confirmation=self.client.post(f"/api/v1/accounts-receivable/confirmations/{self.query}",{"company":str(self.company.id),"number":"XN-001","customer":str(self.customer.id),"period_from":str(self.today),"period_to":str(self.today)},format="json");self.assertEqual(confirmation.status_code,201,confirmation.data)
        sent=self.client.post(f"/api/v1/accounts-receivable/confirmations/{confirmation.data['id']}/send/{self.query}",{"recipient":"customer@example.com"},format="json");self.assertEqual(sent.data["status"],"PENDING_RESPONSE")
        response=self.client.post(f"/api/v1/accounts-receivable/confirmations/{confirmation.data['id']}/respond/{self.query}",{"status":"AGREED"},format="json");self.assertEqual(response.data["status"],"AGREED")
        adjustment=self.client.post(f"/api/v1/accounts-receivable/adjustments/{self.query}",{"company":str(self.company.id),"receivable":str(debt.id),"adjustment_date":str(self.today),"amount":"100000","reason":"Bổ sung phí"},format="json");self.assertEqual(adjustment.status_code,201,adjustment.data)
        posted=self.client.post(f"/api/v1/accounts-receivable/adjustments/{adjustment.data['id']}/post/{self.query}",{},format="json");self.assertEqual(posted.status_code,200,posted.data);debt.refresh_from_db();self.assertEqual(debt.balance,Decimal("1100000"))
        reversed_response=self.client.post(f"/api/v1/accounts-receivable/adjustments/{adjustment.data['id']}/reverse/{self.query}",{"reason":"Không áp dụng phí"},format="json");self.assertEqual(reversed_response.status_code,200,reversed_response.data);debt.refresh_from_db();self.assertEqual(debt.balance,Decimal("1000000"))

    def test_customer_payment_term_calculates_and_recalculates_draft_due_date(self):
        term=PaymentTerm.objects.create(company=self.company,code="NET12",name="Net 12",scope="SALE",due_base="DOCUMENT",due_days=12)
        self.customer.payment_term=term
        self.customer.save(update_fields=("payment_term",))
        created=self.client.post(f"/api/v1/accounts-receivable/documents/{self.query}",{
            "company":str(self.company.id),"branch":str(self.branch.id),"number":"PT-TERM","document_type":"OTHER",
            "document_date":str(self.today),"posting_date":str(self.today),"customer":str(self.customer.id),
            "currency":str(self.currency.id),"exchange_rate":"1","amount":"1000000","description":"Term test",
        },format="json")
        self.assertEqual(created.status_code,201,created.data)
        self.assertEqual(str(created.data["payment_term"]),str(term.pk))
        self.assertEqual(str(created.data["due_date"]),str(self.today+timedelta(days=12)))
        changed=self.client.patch(f"/api/v1/accounts-receivable/documents/{created.data['id']}/{self.query}",{"document_date":str(self.today+timedelta(days=1))},format="json")
        self.assertEqual(changed.status_code,200,changed.data)
        self.assertEqual(str(changed.data["due_date"]),str(self.today+timedelta(days=13)))
