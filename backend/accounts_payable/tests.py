from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from master_data.models import Currency, Item, Party, PartyRole, PaymentTerm, UnitOfMeasure
from organization.models import Branch, Company
from audit_log.models import AuditLog
from .models import DocumentStatus, Payable, PayableStatus, SupplierInvoice


class ApApiTests(TestCase):
    def setUp(self):
        self.today=timezone.localdate(); self.currency=Currency.objects.get(code="VND")
        self.company=Company.objects.create(code="APCO",name="AP Co",legal_name="AP Co Ltd",tax_code="0100555566",accounting_currency=self.currency,legal_reporting_currency=self.currency)
        self.branch=Branch.objects.create(company=self.company,code="HN",name="Hà Nội")
        self.uom=UnitOfMeasure.objects.create(company=self.company,code="CAI",name="Cái")
        self.item=Item.objects.create(company=self.company,base_uom=self.uom,code="HH01",name="Hàng 01",item_type="GOODS",track_inventory=True)
        self.supplier=Party.objects.create(company=self.company,code="NCC01",name="Nhà cung cấp",tax_code="0101234567",default_currency=self.currency)
        PartyRole.objects.create(party=self.supplier,role_type="VENDOR",active_from=self.today)
        self.creator=get_user_model().objects.create_superuser(username="ap-maker",email="maker@example.com",password="pass")
        self.approver=get_user_model().objects.create_superuser(username="ap-approver",email="approver@example.com",password="pass")
        self.client=APIClient(); self.client.force_authenticate(self.creator)

    def create_invoice(self):
        response=self.client.post(f"/api/v1/accounts-payable/invoices/?company_id={self.company.id}",{
            "company":str(self.company.id),"branch":str(self.branch.id),"supplier":str(self.supplier.id),"source":"MANUAL",
            "supplier_tax_code":self.supplier.tax_code,"invoice_series":"1C26TAA","invoice_number":"000001",
            "invoice_date":str(self.today),"posting_date":str(self.today),"due_date":str(self.today+timedelta(days=30)),
            "currency":str(self.currency.id),"exchange_rate":"1","lines":[{"line_no":1,"item":str(self.item.id),"description":"Hàng 01","uom":str(self.uom.id),"quantity":"10","unit_price":"100000","tax_amount":"100000"}]
        },format="json")
        self.assertEqual(response.status_code,201,response.data); return response

    def test_invoice_approval_posting_and_payment_allocation(self):
        invoice=self.create_invoice(); iid=invoice.data["id"]
        self.assertEqual(Decimal(invoice.data["total_amount"]),Decimal("1100000"))
        submitted=self.client.post(f"/api/v1/accounts-payable/invoices/{iid}/submit/?company_id={self.company.id}",{},format="json")
        self.assertEqual(submitted.status_code,200,submitted.data)
        self.client.force_authenticate(self.approver)
        approved=self.client.post(f"/api/v1/accounts-payable/invoices/{iid}/approve/?company_id={self.company.id}",{"comment":"Đồng ý"},format="json")
        self.assertEqual(approved.data["status"],DocumentStatus.APPROVED)
        posted=self.client.post(f"/api/v1/accounts-payable/invoices/{iid}/post/?company_id={self.company.id}",{"posting_reference":"GL-001"},format="json")
        self.assertEqual(posted.status_code,200,posted.data); payable=Payable.objects.get(invoice_id=iid)
        self.client.force_authenticate(self.creator)
        payment=self.client.post(f"/api/v1/accounts-payable/payments/?company_id={self.company.id}",{"company":str(self.company.id),"supplier":str(self.supplier.id),"currency":str(self.currency.id),"payment_date":str(self.today),"amount":"400000","external_type":"BANK","external_reference":"BANK-001"},format="json")
        self.assertEqual(payment.status_code,201,payment.data)
        allocated=self.client.post(f"/api/v1/accounts-payable/payments/{payment.data['id']}/allocate/?company_id={self.company.id}",{"allocations":[{"payable":str(payable.id),"amount":"400000"}]},format="json")
        self.assertEqual(allocated.status_code,200,allocated.data); payable.refresh_from_db()
        self.assertEqual(payable.balance,Decimal("700000")); self.assertEqual(payable.status,PayableStatus.PARTIALLY_PAID)
        self.assertTrue(AuditLog.objects.filter(company=self.company,module_code="AP").exists())

    def test_duplicate_invoice_is_rejected(self):
        self.create_invoice(); duplicate=self.client.post(f"/api/v1/accounts-payable/invoices/?company_id={self.company.id}",{
            "company":str(self.company.id),"supplier":str(self.supplier.id),"supplier_tax_code":self.supplier.tax_code,"invoice_series":"1C26TAA","invoice_number":"000001","invoice_date":str(self.today),"currency":str(self.currency.id),"lines":[{"description":"Trùng","quantity":"1","unit_price":"1"}]
        },format="json")
        self.assertEqual(duplicate.status_code,400)

    def test_posted_invoice_can_be_reversed_when_unsettled(self):
        invoice = self.create_invoice(); invoice_id = invoice.data["id"]
        self.client.post(f"/api/v1/accounts-payable/invoices/{invoice_id}/submit/?company_id={self.company.id}", {}, format="json")
        self.client.force_authenticate(self.approver)
        self.client.post(f"/api/v1/accounts-payable/invoices/{invoice_id}/approve/?company_id={self.company.id}", {"comment": "Đồng ý"}, format="json")
        self.client.post(f"/api/v1/accounts-payable/invoices/{invoice_id}/post/?company_id={self.company.id}", {"posting_reference": "GL-REVERSE-01"}, format="json")
        reversed_response = self.client.post(
            f"/api/v1/accounts-payable/invoices/{invoice_id}/reverse/?company_id={self.company.id}",
            {"reason": "Hóa đơn sai thông tin", "posting_reference": "GL-REVERSAL-01"}, format="json",
        )
        self.assertEqual(reversed_response.status_code, 200, reversed_response.data)
        self.assertEqual(reversed_response.data["status"], DocumentStatus.REVERSED)
        payable = Payable.objects.get(invoice_id=invoice_id)
        self.assertEqual(payable.status, PayableStatus.REVERSED)
        self.assertEqual(payable.balance, Decimal("0"))

    def test_party_payment_term_sets_due_date_snapshot(self):
        term = PaymentTerm.objects.create(company=self.company, code="NET10", name="Net 10", due_days=10, scope="PURCHASE", due_base="INVOICE")
        self.supplier.payment_term = term
        self.supplier.save(update_fields=("payment_term",))
        invoice = self.create_invoice()
        self.assertEqual(str(invoice.data["payment_term"]), str(term.pk))
        self.assertEqual(str(invoice.data["due_date"]), str(self.today + timedelta(days=10)))
        term.due_days = 20
        term.save(update_fields=("due_days",))
        stored = SupplierInvoice.objects.get(pk=invoice.data["id"])
        self.assertEqual(stored.due_date, self.today + timedelta(days=10))
