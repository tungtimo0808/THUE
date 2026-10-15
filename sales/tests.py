from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from master_data.models import Currency, Item, Party, PartyRole, PaymentMethod, UnitOfMeasure, Warehouse
from organization.models import Branch, Company
from .models import DocumentStatus, InvoiceRequestStatus, SalesOrder


class SalesApiTests(TestCase):
    def setUp(self):
        self.today=timezone.localdate(); self.currency=Currency.objects.get(code="VND")
        self.company=Company.objects.create(code="SALCO",name="Sales Co",legal_name="Sales Co Ltd",tax_code="0100999988",accounting_currency=self.currency,legal_reporting_currency=self.currency)
        self.branch=Branch.objects.create(company=self.company,code="HN",name="Hà Nội")
        self.uom=UnitOfMeasure.objects.create(company=self.company,code="CAI",name="Cái")
        self.item=Item.objects.create(company=self.company,base_uom=self.uom,code="SP01",name="Sản phẩm 01",item_type="GOODS",track_inventory=True)
        self.warehouse=Warehouse.objects.create(company=self.company,branch=self.branch,code="KHO01",name="Kho 01")
        self.customer=Party.objects.create(company=self.company,code="KH01",name="Khách hàng 01",tax_code="0101234999",default_currency=self.currency)
        PartyRole.objects.create(party=self.customer,role_type="CUSTOMER",active_from=self.today)
        self.maker=get_user_model().objects.create_superuser(username="sal-maker",email="sal-maker@example.com",password="pass")
        self.approver=get_user_model().objects.create_superuser(username="sal-approver",email="sal-approver@example.com",password="pass")
        self.client=APIClient(); self.client.force_authenticate(self.maker)
        self.query=f"?company_id={self.company.id}"

    def test_order_planned_payment_method_and_snapshot(self):
        method=PaymentMethod.objects.create(company=self.company,code="SALE-BANK",name="Bank transfer",group="BANK",scope="RECEIPT",requires_reference=True,requires_bank_account=True)
        payload={"company":str(self.company.id),"number":"SO-PM-1","document_date":str(self.today),
                 "customer":str(self.customer.id),"currency":str(self.currency.id),"default_warehouse":str(self.warehouse.id),
                 "payment_method_config":str(method.pk),
                 "lines":[{"item":str(self.item.id),"uom":str(self.uom.id),"quantity":"1","unit_price":"100","warehouse":str(self.warehouse.id)}]}
        url=f"/api/v1/sales/orders/{self.query}"
        created=self.client.post(url,payload,format="json")
        self.assertEqual(created.status_code,201,created.data)
        self.assertEqual(created.data["payment_method_snapshot"]["name"],"Bank transfer")
        method.name="Renamed transfer"; method.save(update_fields=("name",))
        fetched=self.client.get(f"/api/v1/sales/orders/{created.data['id']}/{self.query}")
        self.assertEqual(fetched.data["payment_method_snapshot"]["name"],"Bank transfer")
        payload["number"]="SO-PM-2"
        method.scope="PAYMENT"; method.save(update_fields=("scope",))
        self.assertEqual(self.client.post(url,payload,format="json").status_code,400)

    def create_and_accept_quotation(self):
        response=self.client.post(f"/api/v1/sales/quotations/{self.query}",{
            "company":str(self.company.id),"branch":str(self.branch.id),"number":"BG-001","document_date":str(self.today),"customer":str(self.customer.id),"currency":str(self.currency.id),"exchange_rate":"1","valid_until":str(self.today+timedelta(days=30)),
            "lines":[{"line_no":1,"item":str(self.item.id),"uom":str(self.uom.id),"quantity":"10","unit_price":"100000","discount_rate":"10"}],
        },format="json")
        self.assertEqual(response.status_code,201,response.data); quote_id=response.data["id"]
        self.assertEqual(Decimal(response.data["total_amount"]),Decimal("900000"))
        submitted=self.client.post(f"/api/v1/sales/quotations/{quote_id}/submit/{self.query}",{},format="json"); self.assertEqual(submitted.status_code,200,submitted.data)
        self.client.force_authenticate(self.approver)
        approved=self.client.post(f"/api/v1/sales/quotations/{quote_id}/approve/{self.query}",{"comment":"Duyệt"},format="json"); self.assertEqual(approved.data["status"],DocumentStatus.APPROVED)
        sent=self.client.post(f"/api/v1/sales/quotations/{quote_id}/send/{self.query}",{"method":"EMAIL","recipient":"buyer@example.com"},format="json"); self.assertEqual(sent.data["status"],DocumentStatus.SENT)
        accepted=self.client.post(f"/api/v1/sales/quotations/{quote_id}/accept/{self.query}",{},format="json"); self.assertEqual(accepted.data["status"],DocumentStatus.ACCEPTED)
        return accepted

    def test_full_sales_flow_and_tracking(self):
        quote=self.create_and_accept_quotation(); quote_line=quote.data["lines"][0]["id"]
        self.client.force_authenticate(self.maker)
        order=self.client.post(f"/api/v1/sales/orders/{self.query}",{
            "company":str(self.company.id),"branch":str(self.branch.id),"number":"SO-001","document_date":str(self.today),"customer":str(self.customer.id),"currency":str(self.currency.id),"exchange_rate":"1","default_warehouse":str(self.warehouse.id),"delivery_address":"Hà Nội",
            "lines":[{"line_no":1,"item":str(self.item.id),"uom":str(self.uom.id),"quantity":"10","unit_price":"100000","discount_rate":"10","warehouse":str(self.warehouse.id),"quotation_line":quote_line}],
        },format="json")
        self.assertEqual(order.status_code,201,order.data); order_id=order.data["id"]; order_line=order.data["lines"][0]["id"]
        self.client.post(f"/api/v1/sales/orders/{order_id}/submit/{self.query}",{},format="json")
        self.client.force_authenticate(self.approver)
        approved=self.client.post(f"/api/v1/sales/orders/{order_id}/approve/{self.query}",{"comment":"Duyệt"},format="json"); self.assertEqual(approved.data["status"],DocumentStatus.APPROVED)
        self.client.force_authenticate(self.maker)
        delivery=self.client.post(f"/api/v1/sales/deliveries/{self.query}",{"company":str(self.company.id),"order":order_id,"number":"GH-001","delivery_date":str(self.today),"delivery_type":"GOODS","warehouse":str(self.warehouse.id),"lines":[{"order_line":order_line,"quantity":"4"}]},format="json")
        self.assertEqual(delivery.status_code,201,delivery.data)
        confirmed=self.client.post(f"/api/v1/sales/deliveries/{delivery.data['id']}/confirm/{self.query}",{},format="json"); self.assertEqual(confirmed.status_code,200,confirmed.data)
        invoice=self.client.post(f"/api/v1/sales/invoice-requests/{self.query}",{"company":str(self.company.id),"number":"DXHD-001","order":order_id,"customer":str(self.customer.id),"currency":str(self.currency.id),"request_date":str(self.today),"buyer_name":self.customer.name,"buyer_tax_code":self.customer.tax_code,"lines":[{"order_line":order_line,"delivery_line":confirmed.data["lines"][0]["id"],"quantity":"4","unit_price":"90000","tax_amount":"0"}]},format="json")
        self.assertEqual(invoice.status_code,201,invoice.data)
        submitted=self.client.post(f"/api/v1/sales/invoice-requests/{invoice.data['id']}/submit/{self.query}",{"external_reference":"TAX-QUEUE-001"},format="json"); self.assertEqual(submitted.data["status"],InvoiceRequestStatus.SUBMITTED)
        tracking=self.client.get(f"/api/v1/sales/orders/{order_id}/tracking/{self.query}"); self.assertEqual(tracking.status_code,200,tracking.data)
        self.assertEqual(Decimal(tracking.data["lines"][0]["delivered_quantity"]),Decimal("4")); self.assertEqual(Decimal(tracking.data["lines"][0]["invoiced_quantity"]),Decimal("4"))
        self.assertTrue(AuditLog.objects.filter(company=self.company,module_code="SAL").exists())

    def test_order_with_execution_cannot_be_fully_cancelled(self):
        self.client.force_authenticate(self.maker)
        order=self.client.post(f"/api/v1/sales/orders/{self.query}",{"company":str(self.company.id),"number":"SO-002","document_date":str(self.today),"customer":str(self.customer.id),"currency":str(self.currency.id),"default_warehouse":str(self.warehouse.id),"approval_required":False,"lines":[{"item":str(self.item.id),"uom":str(self.uom.id),"quantity":"2","unit_price":"1","warehouse":str(self.warehouse.id)}]},format="json")
        self.client.post(f"/api/v1/sales/orders/{order.data['id']}/submit/{self.query}",{},format="json")
        delivery=self.client.post(f"/api/v1/sales/deliveries/{self.query}",{"company":str(self.company.id),"order":order.data["id"],"number":"GH-002","delivery_date":str(self.today),"delivery_type":"GOODS","warehouse":str(self.warehouse.id),"lines":[{"order_line":order.data["lines"][0]["id"],"quantity":"1"}]},format="json")
        self.client.post(f"/api/v1/sales/deliveries/{delivery.data['id']}/confirm/{self.query}",{},format="json")
        cancelled=self.client.post(f"/api/v1/sales/orders/{order.data['id']}/cancel/{self.query}",{"reason":"Khách đổi ý"},format="json")
        self.assertEqual(cancelled.status_code,400)
        self.assertNotEqual(SalesOrder.objects.get(pk=order.data["id"]).status,DocumentStatus.CANCELLED)
