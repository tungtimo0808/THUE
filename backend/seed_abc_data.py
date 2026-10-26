import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from decimal import Decimal
from datetime import date
from organization.models import Company, CompanyStatus, BusinessType, Branch
from iam.models import UserAccount, CompanyMembership
from common_services.setup_services import complete_company_setup
from cash_management.models import CashFund, CashTransaction, TransactionStatus
from master_data.models import Currency, CompanyBankAccount, Party
from general_ledger.models import Account

print("--> Initializing ABC Company Data according to test1.docx and test2.docx...")

actor = UserAccount.objects.first()
vnd = Currency.objects.filter(code="VND").first()

company, created = Company.objects.get_or_create(
    code="ABC",
    defaults={
        "name": "Công ty TNHH Thương mại và Dịch vụ ABC",
        "legal_name": "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
        "tax_code": "109876543",
        "business_type": BusinessType.LLC_MULTI_MEMBER,
        "status": CompanyStatus.ACTIVE,
        "address": "198 Trần Quang Khải, P. Hoàn Kiếm, TP. Hà Nội",
        "legal_representative": "Trương Thanh Quân",
        "representative_title": "Giám đốc",
        "accounting_currency": vnd,
        "legal_reporting_currency": vnd,
        "accounting_regime": "TT99",
        "fiscal_year_start_month": 1,
    }
)
print(f"Company ABC ready: {company.id} (Created: {created})")

for user in UserAccount.objects.all():
    CompanyMembership.objects.get_or_create(
        company=company,
        user=user,
        defaults={"membership_status": "ACTIVE", "created_by": actor}
    )

complete_company_setup(company, actor)
print("Complete company setup finished for ABC.")

branch = Branch.objects.filter(company=company).first()
acc_111 = Account.objects.filter(company=company, code__startswith="111").first()

fund = CashFund.objects.filter(company=company).first()
if not fund:
    fund = CashFund.objects.create(
        company=company,
        branch=branch,
        code="QTM_VND",
        name="Quỹ tiền mặt (VND)",
        currency=vnd,
        gl_account=acc_111,
        balance=Decimal("500000000"),
        status="ACTIVE"
    )
else:
    fund.balance = Decimal("500000000")
    fund.save()
print(f"CashFund ready: {fund.code} (Balance: {fund.balance:,.0f} VND)")

from master_data.models import Bank
bank, _ = Bank.objects.get_or_create(code="TCB", defaults={"name": "Ngân hàng TMCP Kỹ thương Việt Nam", "swift_code": "VTCBVNVX", "status": "ACTIVE"})
bank_acc, _ = CompanyBankAccount.objects.get_or_create(
    company=company,
    account_number="123456789",
    defaults={
        "account_name": "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
        "bank": bank,
        "currency": vnd,
        "status": "ACTIVE",
    }
)
print("Techcombank account ready: 123456789")

customers_data = [
    ("KHACHLE", "Khách hàng cá nhân"),
    ("THANHHA", "Công ty TNHH Thanh Hà"),
    ("NHATMINH", "CTCP Nội thất Nhật Minh"),
    ("MINHHANH", "Công ty TNHH Kinh doanh Minh Hạnh"),
    ("ANHTUAN", "Công ty TNHH Công nghệ số Anh Tuấn"),
    ("CAUGIAY", "CTCP Thương mại Cầu Giấy"),
    ("HIEPPHAT", "Công ty TNHH Giải pháp Hiệp Phát"),
    ("BAOKIM", "Công ty TNHH Đầu tư Bảo Kim"),
    ("THUANPHAT", "Công ty TNHH Thương mại Thuận Phát"),
    ("DUYVINH", "Công ty TNHH Xây dựng Duy Vinh"),
    ("KIENQUAN", "CTCP Đầu tư Kiến Quân Việt Nam"),
    ("VIETHUNG", "Công ty TNHH Việt Hùng"),
    ("PHANMINH", "Công ty TNHH Phan Minh"),
    ("HOANGLONG", "Công ty CP Hoàng Long Computer"),
]

for code, name in customers_data:
    Party.objects.get_or_create(
        company=company,
        code=code,
        defaults={"name": name, "party_type": "CUSTOMER", "status": "ACTIVE"}
    )

suppliers_data = [
    ("PHATMAI", "Công ty TNHH Phát Mai Group"),
    ("MINHQUAN", "Công ty Cổ phần Minh Quân Logistics"),
    ("THANHTRU", "Công ty TNHH Thiết bị Thanh Trúc"),
    ("MAISON", "CTCP Tư vấn và Dịch vụ Bất động sản Maison"),
    ("VANPHO", "CTCP Vận tải và Thương mại Vạn Phát"),
    ("MEDIAZ", "Công ty TNHH Truyền thông AZ Việt Nam"),
    ("LOCATIO", "Công ty TNHH Dịch vụ Logistics Việt Hưng"),
    ("VIETGIA", "Công ty Cổ phần Công nghệ Việt Gia"),
    ("CONGNGHE", "Công ty TNHH Phát triển Công nghệ KTS"),
    ("ANLOC", "Công ty TNHH Thương mại Máy tính An Lộc"),
    ("TANCANG", "Công ty CP ĐL Giao nhận Vận tải Xếp dỡ Tân Cảng"),
    ("QUOCTE", "Công ty CP Đầu tư Thương mại & DV Quốc tế"),
]

for code, name in suppliers_data:
    Party.objects.get_or_create(
        company=company,
        code=code,
        defaults={"name": name, "party_type": "VENDOR", "status": "ACTIVE"}
    )
print("Parties created successfully.")

cash_txs = [
    ("PT00001", "RECEIPT", date(2026, 1, 6), "Lê Văn Hiếu", Decimal("50000000"), "Rút tiền gửi ngân hàng Techcombank về nhập quỹ tiền mặt"),
    ("PC00001", "PAYMENT", date(2026, 1, 7), "Hoàng Bá Cung", Decimal("3500000"), "Mua văn phòng phẩm phục vụ hoạt động quản lý bộ phận HC-NS"),
    ("PC00002", "PAYMENT", date(2026, 1, 23), "Phạm Đình Tài", Decimal("5000000"), "Chi tạm ứng cho nhân viên kỹ thuật Phạm Đình Tài đi công tác"),
    ("PT00002", "RECEIPT", date(2026, 1, 28), "Phạm Đình Tài", Decimal("1200000"), "Thu hoàn ứng thừa tiền mặt từ nhân viên Phạm Đình Tài sau khi quyết toán"),
    ("PT00003", "RECEIPT", date(2026, 9, 3), "Khách hàng cá nhân", Decimal("21500000"), "Thu tiền bán lẻ điện thoại iPhone 15 kèm sạc dự phòng Anker"),
    ("PC00183", "PAYMENT", date(2026, 10, 19), "Hoàng Bá Cung", Decimal("1320000"), "Chi tiền mặt bảo dưỡng hệ thống máy lạnh Daikin VRV A Series (Hóa đơn 128)"),
]

for num, tx_type, dt, payee, amt, desc in cash_txs:
    CashTransaction.objects.get_or_create(
        company=company,
        number=num,
        defaults={
            "fund": fund,
            "transaction_type": tx_type,
            "business_type": "GENERAL",
            "transaction_date": dt,
            "payer_payee": payee,
            "currency": vnd,
            "amount": amt,
            "base_amount": amt,
            "description": desc,
            "status": TransactionStatus.POSTED,
            "created_by": actor,
        }
    )
print(f"Created {len(cash_txs)} CashTransactions for ABC Company.")
print("--> ALL ABC DATA SEEDED SUCCESSFULLY!")
