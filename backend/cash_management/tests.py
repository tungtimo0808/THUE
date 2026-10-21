from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from audit_log.models import AuditLog
from accounts_receivable.models import Receivable
from general_ledger.models import Account,AccountClass,AccountingPeriod,ChartOfAccounts
from master_data.models import Currency,Party
from organization.models import Branch,Company,Employee
from .models import CashFund,TransactionStatus

class CashApiTests(TestCase):
    def setUp(self):
        self.today=timezone.localdate();self.currency=Currency.objects.get(code="VND");self.company=Company.objects.create(code="CASHCO",name="Cash Co",legal_name="Cash Co Ltd",tax_code="0100666655",accounting_currency=self.currency,legal_reporting_currency=self.currency);self.branch=Branch.objects.create(company=self.company,code="HN",name="Hà Nội");self.employee=Employee.objects.create(company=self.company,branch=self.branch,employee_code="NV01",full_name="Nguyễn Văn A",hire_date=self.today)
        account_class=AccountClass.objects.create(company=self.company,code="ASSET",name="Tài sản",normal_balance="DEBIT");chart=ChartOfAccounts.objects.create(company=self.company,code="TT99",name="Hệ thống",effective_from=self.today,is_default=True);self.account=Account.objects.create(company=self.company,chart_of_accounts=chart,account_class=account_class,code="1111",name="Tiền mặt",account_type="ASSET",normal_balance="DEBIT")
        self.maker=get_user_model().objects.create_superuser(username="cash-maker",email="maker@cash.test",password="pass");self.approver=get_user_model().objects.create_superuser(username="cash-approver",email="approver@cash.test",password="pass");self.cashier=get_user_model().objects.create_superuser(username="cash-cashier",email="cashier@cash.test",password="pass");self.client=APIClient();self.client.force_authenticate(self.maker);self.q=f"?company_id={self.company.id}"
        response=self.client.post(f"/api/v1/cash/funds/{self.q}",{"company":str(self.company.id),"branch":str(self.branch.id),"code":"Q01","name":"Quỹ chính","currency":str(self.currency.id),"keeper":str(self.employee.id),"gl_account":str(self.account.id)},format="json");self.assertEqual(response.status_code,201,response.data);self.fund=response.data["id"];self.receipt_q=f"{self.q}&branch_id={self.branch.id}"
    def post_cash(self,number,kind,amount):
        response=self.client.post(f"/api/v1/cash/transactions/{self.q}",{"company":str(self.company.id),"fund":self.fund,"number":number,"transaction_type":kind,"business_type":"OTHER","transaction_date":str(self.today),"payer_payee":"Đối tượng","currency":str(self.currency.id),"amount":str(amount),"exchange_rate":"1","description":"Kiểm thử"},format="json");self.assertEqual(response.status_code,201,response.data);tid=response.data["id"]
        self.client.post(f"/api/v1/cash/transactions/{tid}/submit/{self.q}",{},format="json");self.client.force_authenticate(self.approver);approved=self.client.post(f"/api/v1/cash/transactions/{tid}/approve/{self.q}",{"comment":"Duyệt"},format="json");self.assertEqual(approved.data["status"],TransactionStatus.APPROVED);self.client.force_authenticate(self.cashier);confirmed=self.client.post(f"/api/v1/cash/transactions/{tid}/confirm/{self.q}",{},format="json");self.assertEqual(confirmed.status_code,200,confirmed.data);self.client.force_authenticate(self.maker);return tid

    def test_receipt_draft_validates_lines_and_does_not_change_fund_balance(self):
        counter=Account.objects.create(company=self.company,chart_of_accounts=self.account.chart_of_accounts,code="1311",name="Phải thu khách hàng",account_type="ASSET",normal_balance="DEBIT",dimension_requirements={"CUSTOMER":"REQUIRED"})
        customer=Party.objects.create(company=self.company,code="KH-CASH",name="Khách hàng thử",status="ACTIVE")
        payload={"company":str(self.company.id),"fund":self.fund,"number":"PT-DRAFT-01","transaction_type":"RECEIPT","business_type":"CUSTOMER_ADVANCE","transaction_date":str(self.today),"party":str(customer.id),"payer_payee":"Người nộp","currency":str(self.currency.id),"amount":"125000","exchange_rate":"1","description":"Thu ứng trước","receipt_details":{"posting_date":str(self.today),"lines":[{"description":"Thu ứng trước","debit_account":str(self.account.id),"credit_account":str(counter.id),"amount":"125000"}],"allocations":[]}}
        missing_branch=self.client.post(f"/api/v1/cash/transactions/{self.q}",payload,format="json")
        self.assertEqual(missing_branch.status_code,400)
        response=self.client.post(f"/api/v1/cash/transactions/{self.receipt_q}",payload,format="json")
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(response.data["status"],"DRAFT")
        self.assertEqual(CashFund.objects.get(pk=self.fund).balance,Decimal("0"))
        self.assertEqual(response.data["receipt_details"]["lines"][0]["credit_account"],str(counter.id))
        duplicate=self.client.post(f"/api/v1/cash/transactions/{self.receipt_q}",payload,format="json")
        self.assertEqual(duplicate.status_code,400)
        payload["number"]="PT-DRAFT-02"
        payload["receipt_details"]["lines"][0]["debit_account"]=str(counter.id)
        invalid=self.client.post(f"/api/v1/cash/transactions/{self.receipt_q}",payload,format="json")
        self.assertEqual(invalid.status_code,400)

    def test_receipt_draft_rejects_closed_posting_period(self):
        AccountingPeriod.objects.create(company=self.company,code="LOCKED",fiscal_year=self.today.year,period_number=self.today.month,start_date=self.today.replace(day=1),end_date=self.today,status="CLOSED")
        payload={"company":str(self.company.id),"fund":self.fund,"number":"PT-LOCKED","transaction_type":"RECEIPT","business_type":"OTHER_RECEIPT","transaction_date":str(self.today),"payer_payee":"Người nộp","currency":str(self.currency.id),"amount":"100","exchange_rate":"1","description":"Thu khác","receipt_details":{"posting_date":str(self.today),"lines":[{"description":"Thu khác","debit_account":str(self.account.id),"credit_account":str(self.account.id),"amount":"100"}]}}
        response=self.client.post(f"/api/v1/cash/transactions/{self.receipt_q}",payload,format="json")
        self.assertEqual(response.status_code,400)
        self.assertIn("đã khóa",str(response.data))

    def test_invoice_receipt_checks_outstanding_balance_without_allocating(self):
        counter=Account.objects.create(company=self.company,chart_of_accounts=self.account.chart_of_accounts,code="1311",name="Phải thu khách hàng",account_type="ASSET",normal_balance="DEBIT")
        customer=Party.objects.create(company=self.company,code="KH-INVOICE",name="Khách hàng hóa đơn",status="ACTIVE")
        debt=Receivable.objects.create(company=self.company,customer=customer,currency=self.currency,account=counter,original_amount=Decimal("500"),balance=Decimal("500"),code="CN-01")
        payload={"company":str(self.company.id),"fund":self.fund,"number":"PT-INV-01","transaction_type":"RECEIPT","business_type":"CUSTOMER_INVOICE","transaction_date":str(self.today),"party":str(customer.id),"payer_payee":"Người nộp","currency":str(self.currency.id),"amount":"400","exchange_rate":"1","description":"Thu theo hóa đơn","receipt_details":{"posting_date":str(self.today),"lines":[{"description":"Thu theo hóa đơn","debit_account":str(self.account.id),"credit_account":str(counter.id),"amount":"400"}],"allocations":[{"receivable":str(debt.id),"amount":"400"}]}}
        response=self.client.post(f"/api/v1/cash/transactions/{self.receipt_q}",payload,format="json")
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(Receivable.objects.get(pk=debt.pk).balance,Decimal("500"))
        payload["number"]="PT-INV-02"
        payload["amount"]="600"
        payload["receipt_details"]["lines"][0]["amount"]="600"
        payload["receipt_details"]["allocations"][0]["amount"]="600"
        excessive=self.client.post(f"/api/v1/cash/transactions/{self.receipt_q}",payload,format="json")
        self.assertEqual(excessive.status_code,400)
    def test_receipt_payment_ledger_and_gl_reference(self):
        receipt=self.post_cash("PT-001","RECEIPT",1000000);payment=self.post_cash("PC-001","PAYMENT",400000);fund=CashFund.objects.get(pk=self.fund);self.assertEqual(fund.balance,Decimal("600000"))
        posted=self.client.post(f"/api/v1/cash/transactions/{payment}/post-gl/{self.q}",{"gl_reference":"GL-CASH-001"},format="json");self.assertEqual(posted.status_code,200,posted.data);self.assertEqual(posted.data["gl_status"],"POSTED")
        ledger=self.client.get(f"/api/v1/cash/funds/{self.fund}/ledger/{self.q}");self.assertEqual(ledger.status_code,200,ledger.data);self.assertEqual(Decimal(str(ledger.data["current_balance"])),Decimal("600000"));self.assertTrue(AuditLog.objects.filter(company=self.company,module_code="CASH").exists())
    def test_transfer_advance_settlement_and_cash_count(self):
        self.post_cash("PT-OPEN","RECEIPT",2000000)
        second=self.client.post(f"/api/v1/cash/funds/{self.q}",{"company":str(self.company.id),"branch":str(self.branch.id),"code":"Q02","name":"Quỹ phụ","currency":str(self.currency.id),"gl_account":str(self.account.id)},format="json");self.assertEqual(second.status_code,201,second.data)
        transfer=self.client.post(f"/api/v1/cash/transfers/{self.q}",{"company":str(self.company.id),"number":"DC-001","transfer_type":"FUND_TO_FUND","source_fund":self.fund,"destination_fund":second.data["id"],"transfer_date":str(self.today),"amount":"300000","description":"Điều quỹ"},format="json");self.assertEqual(transfer.status_code,201,transfer.data);self.client.post(f"/api/v1/cash/transfers/{transfer.data['id']}/dispatch/{self.q}",{},format="json");received=self.client.post(f"/api/v1/cash/transfers/{transfer.data['id']}/receive/{self.q}",{},format="json");self.assertEqual(received.data["status"],"CONFIRMED")
        advance=self.client.post(f"/api/v1/cash/advances/{self.q}",{"company":str(self.company.id),"number":"TU-001","fund":self.fund,"recipient":str(self.employee.id),"purpose":"Công tác","request_date":str(self.today),"due_date":str(self.today+timedelta(days=10)),"amount":"500000"},format="json");self.assertEqual(advance.status_code,201,advance.data);self.client.post(f"/api/v1/cash/advances/{advance.data['id']}/submit/{self.q}",{},format="json");self.client.post(f"/api/v1/cash/advances/{advance.data['id']}/approve/{self.q}",{},format="json");disbursed=self.client.post(f"/api/v1/cash/advances/{advance.data['id']}/disburse/{self.q}",{},format="json");self.assertEqual(disbursed.data["status"],"ACTIVE");settled=self.client.post(f"/api/v1/cash/advances/{advance.data['id']}/settle/{self.q}",{"accepted_expense":"450000","returned_cash":"50000","settlement_date":str(self.today)},format="json");self.assertEqual(settled.data["status"],"CLOSED")
        fund=CashFund.objects.get(pk=self.fund);count=self.client.post(f"/api/v1/cash/counts/{self.q}",{"company":str(self.company.id),"number":"KK-001","fund":self.fund,"counted_at":timezone.now().isoformat(),"actual_balance":str(fund.balance+10000),"reason":"Thừa kiểm kê","conclusion":"Điều chỉnh tăng"},format="json");self.assertEqual(count.status_code,201,count.data);confirmed=self.client.post(f"/api/v1/cash/counts/{count.data['id']}/confirm/{self.q}",{},format="json");self.assertEqual(Decimal(confirmed.data["difference"]),Decimal("10000"));adjusted=self.client.post(f"/api/v1/cash/counts/{count.data['id']}/adjust/{self.q}",{},format="json");self.assertEqual(adjusted.data["status"],"ADJUSTED")
