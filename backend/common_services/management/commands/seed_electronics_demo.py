"""
Seed a fictional electronics retailer for manual report testing, January to October 2026.

Writes the sub-ledger documents and their journal entries together, so sales, purchase, debt,
money, inventory, asset, tax and financial reports all read the same figures.
"""
import calendar
import random
import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from accounts_payable.models import Payable, Payment, PaymentAllocation, SupplierInvoice, SupplierInvoiceLine
from accounts_receivable.models import Receipt, ReceiptAllocation, Receivable
from bank_management.models import AccountProfile, BankTransaction, BankTransfer, LoanAgreement
from cash_management.models import CashFund, CashTransaction
from common_services.setup_services import complete_company_setup
from fixed_assets.models import AssetCategory, AssetRecord, CalculationLine, CalculationRun
from general_ledger.models import Account, AccountBalance, AccountingPeriod, JournalEntry, JournalLine
from iam.models import ActiveStatus, CompanyMembership, Role, UserAccount, UserRoleAssignment
from iam.role_services import seed_standard_roles_for_company
from inventory.models import InventoryTransaction, InventoryTransactionLine, StockBalance, StockMovement
from master_data.models import (
    Bank, CompanyBankAccount, Currency, Item, ItemCategory, Party, PartyRole, TaxRate, UnitOfMeasure, Warehouse,
)
from organization.models import Branch, BusinessType, Company, CompanyStatus, Department, Employee
from payroll.models import SalaryLine, SalarySheet
from purchases.models import (
    GoodsPurchase, GoodsPurchaseLine, PurchaseContract, PurchaseContractLine, PurchaseOrder, PurchaseOrderLine,
)
from sales.models import (
    GoodsSale, GoodsSaleLine, SalesContract, SalesContractLine, SalesInvoice, SalesInvoiceLine, SalesOrder,
    SalesOrderLine, SalesReturn, SalesReturnLine,
)
from tax_management.models import TaxInvoice, TaxInvoiceLine, TaxPeriod

COMPANY_CODE = "DIENTU_DEMO"
COMPANY_NAME = "Công ty TNHH Điện Tử Minh Khang (Demo)"
TAX_CODE = "0319990001"
LAST_MONTH = 10
# Summary accounts in the seed's own vocabulary, posted to the leaf accounts the reports map.
POSTING_ACCOUNTS = {"214": "2141", "3331": "33311", "334": "3341", "338": "3383", "341": "3411", "821": "8211"}
# Only debt accounts carry a counterparty; tax, payroll and revenue lines do not.
PARTY_ACCOUNTS = ("131", "331")
ZERO = Decimal("0")
VAT = Decimal("0.10")
CIT = Decimal("0.20")
# Month-by-month demand, so reports show a real trend rather than a flat line.
SEASON = {1: 1.5, 2: 0.8, 3: 0.9, 4: 1.0, 5: 1.0, 6: 1.1, 7: 1.0, 8: 1.2, 9: 1.3, 10: 1.1}

ITEMS = (
    # code, name, category, purchase price, sale price, opening quantity
    ("TV-S55", "Tivi Samsung 55 inch 4K", "TV", 11_500_000, 14_900_000, 20),
    ("TV-L65", "Tivi LG 65 inch OLED", "TV", 24_000_000, 30_500_000, 10),
    ("TV-X43", "Tivi Xiaomi 43 inch", "TV", 5_800_000, 7_600_000, 30),
    ("LT-DE15", "Laptop Dell Inspiron 15", "LT", 14_500_000, 18_200_000, 15),
    ("LT-HP14", "Laptop HP Pavilion 14", "LT", 13_200_000, 16_800_000, 15),
    ("LT-AS16", "Laptop Asus Vivobook 16", "LT", 12_000_000, 15_400_000, 15),
    ("DT-IP15", "Điện thoại iPhone 15 128GB", "DT", 17_500_000, 20_900_000, 25),
    ("DT-SA24", "Điện thoại Samsung Galaxy S24", "DT", 15_000_000, 18_500_000, 25),
    ("DT-XM13", "Điện thoại Xiaomi Redmi Note 13", "DT", 4_200_000, 5_500_000, 40),
    ("TN-SO10", "Tai nghe Sony WH-1000XM5", "PK", 5_400_000, 7_200_000, 20),
    ("LO-JB06", "Loa Bluetooth JBL Flip 6", "PK", 1_900_000, 2_600_000, 40),
    ("SD-AN20", "Sạc dự phòng Anker 20000mAh", "PK", 620_000, 950_000, 80),
)
CATEGORIES = (("TV", "Tivi"), ("LT", "Máy tính xách tay"), ("DT", "Điện thoại"), ("PK", "Phụ kiện điện tử"))
CUSTOMERS = (
    # code, name, tax code, payment days
    ("KH-LE", "Khách lẻ tại cửa hàng", "", 0),
    ("KH-ANPHAT", "Công ty TNHH Thiết bị An Phát (Demo)", "0319990011", 30),
    ("KH-HOANGGIA", "Công ty CP Hoàng Gia Office (Demo)", "0319990012", 30),
    ("KH-TANTIEN", "Công ty TNHH Tân Tiến Solutions (Demo)", "0319990013", 45),
    ("KH-MINHDUC", "Siêu thị Điện máy Minh Đức (Demo)", "0319990014", 30),
    ("KH-THANHCONG", "Công ty TNHH Thành Công Việt (Demo)", "0319990015", 60),
    ("KH-BINHAN", "Công ty CP Giáo dục Bình An (Demo)", "0319990016", 30),
)
SUPPLIERS = (
    ("NCC-DAIHUNG", "Công ty TNHH Phân phối Đại Hưng (Demo)", "0319990021"),
    ("NCC-VIETTIN", "Công ty CP Viễn thông Việt Tín (Demo)", "0319990022"),
    ("NCC-QUANGMINH", "Công ty TNHH Công nghệ Quang Minh (Demo)", "0319990023"),
    ("NCC-PHUTHAI", "Công ty CP Điện máy Phú Thái (Demo)", "0319990024"),
)
EMPLOYEES = (
    # code, name, department, title, base salary, expense account
    ("NV001", "Nguyễn Văn Khang", "BGD", "Giám đốc", 35_000_000, "6421"),
    ("NV002", "Trần Thị Hoa", "KT", "Kế toán trưởng", 22_000_000, "6421"),
    ("NV003", "Lê Minh Tâm", "KT", "Kế toán viên", 13_000_000, "6421"),
    ("NV004", "Phạm Thu Hà", "KD", "Trưởng phòng kinh doanh", 20_000_000, "641"),
    ("NV005", "Vũ Đức Long", "KD", "Nhân viên bán hàng", 12_000_000, "641"),
    ("NV006", "Đỗ Thị Mai", "KD", "Nhân viên bán hàng", 12_000_000, "641"),
    ("NV007", "Hoàng Văn Nam", "KHO", "Thủ kho", 11_000_000, "641"),
)
ASSETS = (
    # code, name, account, cost, months of useful life, months already depreciated
    ("TS-XETAI", "Xe tải giao hàng 1.5 tấn", "2113", 600_000_000, 96, 24),
    ("TS-KE", "Hệ thống kệ và trưng bày cửa hàng", "2111", 240_000_000, 60, 12),
    ("TS-MAYCHU", "Máy chủ và thiết bị mạng", "2112", 180_000_000, 48, 12),
)
TOOLS = (("CC-QUAY", "Quầy thu ngân", 36_000_000, 24), ("CC-POS", "Máy POS bán hàng", 24_000_000, 24))
MONTHLY_EXPENSES = (
    # label, account, amount, deductible VAT
    ("Tiền thuê cửa hàng", "6422", 60_000_000, True),
    ("Tiền điện", "6422", 11_000_000, True),
    ("Phí quảng cáo", "641", 18_000_000, True),
    ("Chi phí vận chuyển", "641", 9_000_000, True),
)


def money(value):
    return Decimal(value).quantize(Decimal("1"))


def month_end(month):
    return date(2026, month, calendar.monthrange(2026, month)[1])


class Command(BaseCommand):
    help = "Seed the fictional electronics retailer used to test every report group (01-10/2026)."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="tanh", help="Existing user who becomes the company admin.")
        parser.add_argument("--reset", action="store_true", help="Replace the demo company if it already exists.")

    def handle(self, *args, **options):
        existing = Company.objects.filter(code=COMPANY_CODE).first()
        if existing and not options["reset"]:
            raise CommandError(f"Công ty {COMPANY_CODE} đã tồn tại. Dùng --reset để tạo lại.")
        self.user = UserAccount.objects.filter(auth_user__username=options["username"]).first()
        if not self.user:
            raise CommandError(f"Không tìm thấy người dùng {options['username']}.")
        self.random = random.Random(2026)
        self.ledger = defaultdict(lambda: [ZERO, ZERO])
        self.opening = defaultdict(lambda: [ZERO, ZERO])
        self.counters = defaultdict(int)
        self.stock = {}
        self.open_receivables = []
        self.open_payables = []
        with transaction.atomic():
            if existing:
                self.purge(existing)
            self.seed_foundation()
            self.seed_master_data()
            self.seed_opening()
            for month in range(1, LAST_MONTH + 1):
                self.seed_month(month)
            self.write_balances()
            self.write_closing_state()
            self.check_trial_balance()
        self.report()

    def purge(self, company):
        """Removes the demo company and every row that cannot exist without it; other companies stay untouched."""
        doomed = {Company: {company.pk}}
        frontier = [Company]
        while frontier:
            parent = frontier.pop()
            for model in apps.get_models():
                for field in model._meta.concrete_fields:
                    if field.related_model is not parent or field.null:
                        continue
                    found = set(model._base_manager.filter(
                        **{f"{field.attname}__in": doomed[parent]},
                    ).values_list("pk", flat=True)) - doomed.get(model, set())
                    if found:
                        doomed.setdefault(model, set()).update(found)
                        frontier.append(model)
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL session_replication_role = replica")
            for model, pks in doomed.items():
                for other in apps.get_models():
                    for field in other._meta.concrete_fields:
                        if field.related_model is model and field.null:
                            other._base_manager.filter(**{f"{field.attname}__in": pks}).exclude(
                                pk__in=doomed.get(other, ()),
                            ).update(**{field.attname: None})
            for model, pks in doomed.items():
                model._base_manager.filter(pk__in=pks)._raw_delete(model._base_manager.db)
            cursor.execute("SET LOCAL session_replication_role = DEFAULT")

    # Foundation ---------------------------------------------------------------------------------

    def seed_foundation(self):
        self.vnd = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code=COMPANY_CODE, name=COMPANY_NAME, legal_name=COMPANY_NAME, short_name="Minh Khang Demo",
            tax_code=TAX_CODE, address="Số 1 Đường Demo, Phường Bến Nghé, TP. Hồ Chí Minh",
            business_type=BusinessType.LLC_MULTI_MEMBER, accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd, accounting_regime="TT99", fiscal_year_start_month=1,
            status=CompanyStatus.ACTIVE, created_by_user_id=self.user.id,
        )
        seed_standard_roles_for_company(self.company, self.user)
        membership = CompanyMembership.objects.create(
            company=self.company, user=self.user, membership_status=ActiveStatus.ACTIVE,
            joined_at=timezone.now(), created_by=self.user,
        )
        role = Role.objects.filter(company=self.company, code="COMPANY_ADMIN").first()
        UserRoleAssignment.objects.create(
            company_membership=membership, role=role, status=ActiveStatus.ACTIVE, assigned_by=self.user,
            assign_reason="Quản trị công ty demo",
        )
        complete_company_setup(self.company, self.user)
        self.periods = {
            period.period_number: period
            for period in AccountingPeriod.objects.filter(company=self.company, fiscal_year=2026)
        }
        missing = [month for month in range(1, 13) if month not in self.periods]
        if missing:
            raise CommandError(f"Thiếu kỳ kế toán 2026: {missing}")
        self.branch = Branch.objects.filter(company=self.company, is_head_office=True).first()
        if not self.branch:
            self.branch = Branch.objects.create(
                company=self.company, code="TRUSO", name="Trụ sở chính", tax_code=TAX_CODE,
                address=self.company.address, is_head_office=True, status="ACTIVE",
            )
        self.accounts = {a.code: a for a in Account.objects.filter(company=self.company, is_postable=True)}
        self.vat10 = TaxRate.objects.filter(company=self.company, code="VAT10").first()

    def account(self, code):
        code = POSTING_ACCOUNTS.get(code, code)
        if code not in self.accounts:
            raise CommandError(f"Công ty demo thiếu tài khoản {code}.")
        return self.accounts[code]

    def seed_master_data(self):
        company = self.company
        uom = UnitOfMeasure.objects.filter(company=company, code="CAI").first() or UnitOfMeasure.objects.create(
            company=company, code="CAI", name="Cái", symbol="Cái", measurement_type="COUNT", decimal_places=0,
            status="ACTIVE",
        )
        self.uom = uom
        self.warehouses = [
            Warehouse.objects.create(
                company=company, code=code, name=name, branch=self.branch, warehouse_type="PHYSICAL",
                warehouse_scope="COMPANY_SHARED", is_default=is_default, status="ACTIVE",
            )
            for code, name, is_default in (("KHO-HCM", "Kho trung tâm TP.HCM", True), ("KHO-CH1", "Kho cửa hàng 1", False))
        ]
        categories = {
            code: ItemCategory.objects.create(company=company, code=code, name=name, status="ACTIVE")
            for code, name in CATEGORIES
        }
        self.items = []
        for code, name, category, purchase, sale, opening in ITEMS:
            item = Item.objects.create(
                company=company, code=code, name=name, category=categories[category], base_uom=uom,
                item_type="GOODS", track_inventory=True, track_by_warehouse=True,
                inventory_account=self.account("1561"), revenue_account=self.account("5111"),
                cogs_account=self.account("632"), purchase_price=Decimal(purchase), sales_price=Decimal(sale),
                allow_purchase=True, allow_sale=True, status="ACTIVE",
            )
            item.opening_quantity = opening
            self.items.append(item)
        self.customers = [self.party(c[0], c[1], c[2], "CUSTOMER") for c in CUSTOMERS]
        self.payment_days = {c[0]: c[3] for c in CUSTOMERS}
        self.suppliers = [self.party(s[0], s[1], s[2], "VENDOR") for s in SUPPLIERS]
        self.departments = {
            code: Department.objects.create(company=company, code=code, name=name, branch=self.branch, status="ACTIVE")
            for code, name in (("BGD", "Ban Giám đốc"), ("KT", "Phòng Kế toán"), ("KD", "Phòng Kinh doanh"), ("KHO", "Bộ phận Kho"))
        }
        self.employees = [
            (Employee.objects.create(
                company=company, employee_code=code, full_name=name, department=self.departments[dept],
                branch=self.branch, job_title=title, status="ACTIVE",
            ), Decimal(salary), account)
            for code, name, dept, title, salary, account in EMPLOYEES
        ]
        bank, _ = Bank.objects.get_or_create(code="DEMOBANK", defaults={"name": "Ngân hàng Demo", "status": "ACTIVE"})
        self.bank_account = CompanyBankAccount.objects.create(
            company=company, account_number="9990001234", code="NH-VND", account_name=COMPANY_NAME, bank=bank,
            bank_branch="Chi nhánh TP.HCM", currency=self.vnd, gl_account=self.account("1121"), branch=self.branch,
            is_default=True, allow_receipt=True, allow_payment=True, status="ACTIVE",
        )
        self.bank_profile = AccountProfile.objects.create(account=self.bank_account, company=company)
        self.second_bank_account = CompanyBankAccount.objects.create(
            company=company, account_number="9990005678", code="NH-VND2", account_name=COMPANY_NAME, bank=bank,
            bank_branch="Chi nhánh Hà Nội", currency=self.vnd, gl_account=self.account("1121"), branch=self.branch,
            allow_receipt=True, allow_payment=True, status="ACTIVE",
        )
        self.second_bank_profile = AccountProfile.objects.create(account=self.second_bank_account, company=company)
        LoanAgreement.objects.create(
            company=company, direction="BORROWING", number="KUOC-2025-01", counterparty_name="Ngân hàng Demo",
            purpose="Bổ sung vốn lưu động", principal_account=self.account("341"), interest_account=self.account("635"),
            amount=1_500_000_000, term=24, term_unit="MONTH", disbursement_date=date(2025, 7, 1),
            due_date=date(2027, 7, 1), status="ACTIVE", created_by=self.user,
        )
        self.seed_contracts()
        self.cash_fund = CashFund.objects.create(
            company=company, branch=self.branch, code="QUY-VND", name="Quỹ tiền mặt VND", currency=self.vnd,
            gl_account=self.account("1111"),
        )
        for month in range(1, LAST_MONTH + 1):
            TaxPeriod.objects.get_or_create(
                company=company, code=f"2026-{month:02d}",
                defaults={"start_date": date(2026, month, 1), "end_date": month_end(month)},
            )

    def seed_contracts(self):
        start, end = date(2026, 1, 1), date(2026, 12, 31)
        self.sale_contracts = {}
        for customer in self.customers[1:3]:
            contract = SalesContract.objects.create(
                company=self.company, branch=self.branch, number=f"HDB-{customer.code}", document_date=start,
                customer=customer, currency=self.vnd, exchange_rate=1, status="APPROVED", created_by=self.user,
                title=f"Hợp đồng nguyên tắc {customer.name}", signed_date=start, start_date=start, end_date=end,
                subtotal=2_000_000_000, total_amount=2_200_000_000,
            )
            for line_no, item in enumerate(self.items[:3], 1):
                SalesContractLine.objects.create(
                    contract=contract, line_no=line_no, item=item, uom=self.uom, quantity=50,
                    unit_price=item.sales_price, tax_rate=self.vat10, line_total=50 * item.sales_price,
                )
            self.sale_contracts[customer.code] = contract
        supplier = self.suppliers[0]
        contract = PurchaseContract.objects.create(
            company=self.company, branch=self.branch, number=f"HDM-{supplier.code}", document_date=start,
            supplier=supplier, currency=self.vnd, exchange_rate=1, status="APPROVED", created_by=self.user,
            title=f"Hợp đồng mua hàng {supplier.name}", signed_date=start, start_date=start, end_date=end,
            subtotal=3_000_000_000, total_amount=3_300_000_000,
        )
        for line_no, item in enumerate(self.items[:3], 1):
            PurchaseContractLine.objects.create(
                contract=contract, line_no=line_no, item=item, uom=self.uom, quantity=80,
                unit_price=item.purchase_price, tax_rate=self.vat10,
            )
        self.purchase_contracts = {supplier.code: contract}

    def party(self, code, name, tax_code, role):
        party = Party.objects.create(
            company=self.company, code=code, name=name, legal_name=name,
            party_type="ORGANIZATION" if tax_code else "INDIVIDUAL", tax_code=tax_code or None,
            branch=self.branch, status="ACTIVE",
        )
        PartyRole.objects.create(party=party, role_type=role, active_from=date(2026, 1, 1))
        return party

    # Shared writers -----------------------------------------------------------------------------

    def number(self, prefix):
        self.counters[prefix] += 1
        return f"{prefix}{self.counters[prefix]:05d}"

    def journal(self, prefix, on, description, lines, entry_type="SUBLEDGER", party=None):
        """Lines are (account code, debit, credit); posts into the period of `on`."""
        lines = [(code, money(debit), money(credit)) for code, debit, credit in lines if debit or credit]
        total_debit = sum(line[1] for line in lines)
        total_credit = sum(line[2] for line in lines)
        if total_debit != total_credit:
            raise CommandError(f"Bút toán lệch: {description} {total_debit} != {total_credit}")
        entry = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.periods[on.month], number=self.number(prefix),
            entry_type=entry_type, posting_date=on, document_date=on, description=description, status="POSTED",
            total_debit=total_debit, total_credit=total_credit, created_by=self.user, posted_by=self.user,
            posted_at=timezone.now(),
        )
        JournalLine.objects.bulk_create([
            JournalLine(
                entry=entry, line_no=index, account=self.account(code), debit=debit, credit=credit,
                currency=self.vnd, party=party if code in PARTY_ACCOUNTS else None, description=description,
            )
            for index, (code, debit, credit) in enumerate(lines, 1)
        ])
        store = self.opening if entry_type == "OPENING" else self.ledger
        for code, debit, credit in lines:
            key = code if entry_type == "OPENING" else (on.month, code)
            store[key][0] += debit
            store[key][1] += credit
        return entry

    def stock_in(self, transaction_type, on, warehouse, rows, supplier=None, prefix="NK"):
        """Rows are (item, quantity, unit cost); keeps a moving average per warehouse and item."""
        document = InventoryTransaction.objects.create(
            company=self.company, branch=self.branch, number=self.number(prefix), transaction_type=transaction_type,
            transaction_date=on, supplier=supplier, destination_warehouse=warehouse, status="POSTED",
            gl_status="POSTED", created_by=self.user,
        )
        for index, (item, quantity, unit_cost) in enumerate(rows, 1):
            value = money(quantity * unit_cost)
            self.move(document, index, on, warehouse, item, quantity, value, unit_cost, "IN")
        return document

    def stock_out(self, on, warehouse, rows):
        """Rows are (item, quantity); returns the cost of each row at moving average."""
        document = InventoryTransaction.objects.create(
            company=self.company, branch=self.branch, number=self.number("XK"), transaction_type="ISSUE",
            transaction_date=on, source_warehouse=warehouse, status="POSTED", gl_status="POSTED",
            created_by=self.user,
        )
        costs = []
        for index, (item, quantity) in enumerate(rows, 1):
            on_hand, on_hand_value = self.stock[(warehouse.pk, item.pk)]
            value = money(on_hand_value * quantity / on_hand)
            self.move(document, index, on, warehouse, item, -quantity, -value, value / quantity, "OUT")
            costs.append(value)
        return document, costs

    def move(self, document, index, on, warehouse, item, quantity, value, unit_cost, direction):
        on_hand, on_hand_value = self.stock.get((warehouse.pk, item.pk), (0, ZERO))
        on_hand += quantity
        on_hand_value += value
        self.stock[(warehouse.pk, item.pk)] = (on_hand, on_hand_value)
        line = InventoryTransactionLine.objects.create(
            transaction=document, line_no=index, item=item, uom=self.uom, quantity=abs(quantity),
            base_quantity=abs(quantity), unit_cost=abs(unit_cost), line_value=abs(value),
            movement_direction=direction, costing_status="COMPLETED",
            source_warehouse=warehouse if direction == "OUT" else None,
            destination_warehouse=warehouse if direction == "IN" else None,
        )
        StockMovement.objects.create(
            company=self.company, transaction=document, line=line, warehouse=warehouse, item=item, movement_date=on,
            quantity_delta=quantity, value_delta=value, balance_quantity=on_hand, balance_value=on_hand_value,
        )

    def bank(self, kind, business, on, party_name, amount, description, entry, party=None):
        BankTransaction.objects.create(
            company=self.company, account=self.bank_profile, number=self.number("NH"), transaction_type=kind,
            business_type=business, transaction_date=on, counterparty_name=party_name, party=party,
            currency=self.vnd, amount=amount, base_amount=amount, description=description, status="POSTED",
            gl_status="POSTED", created_by=self.user, gl_reference=entry.number,
        )

    def cash(self, kind, business, on, party_name, amount, description, entry, party=None):
        CashTransaction.objects.create(
            company=self.company, fund=self.cash_fund, number=self.number("Q"), transaction_type=kind,
            business_type=business, transaction_date=on, payer_payee=party_name, party=party, currency=self.vnd,
            amount=amount, base_amount=amount, description=description, status="POSTED", gl_status="POSTED",
            created_by=self.user, gl_reference=entry.number,
        )

    # Opening balances ---------------------------------------------------------------------------

    def seed_opening(self):
        on = date(2026, 1, 1)
        lines = [("1111", 400_000_000, 0), ("1121", 4_500_000_000, 0)]
        stock_value = ZERO
        for item in self.items:
            central = item.opening_quantity * 3 // 4
            for warehouse, quantity in zip(self.warehouses, (central, item.opening_quantity - central)):
                if quantity:
                    self.stock_in("ADJUSTMENT_IN", on, warehouse, [(item, quantity, item.purchase_price)], prefix="DK")
                    stock_value += quantity * item.purchase_price
        lines.append(("1561", stock_value, 0))
        fixed_cost, accumulated = ZERO, ZERO
        category = AssetCategory.objects.create(
            company=self.company, code="TSHH", name="Tài sản cố định hữu hình", asset_type="FIXED_ASSET",
            accumulated_account=self.account("214"), expense_account=self.account("6422"),
        )
        tools = AssetCategory.objects.create(
            company=self.company, code="CCDC", name="Công cụ dụng cụ", asset_type="TOOL",
            accumulated_account=self.account("242"), expense_account=self.account("6422"),
        )
        self.assets = []
        for code, name, account, cost, life, used in ASSETS:
            monthly = money(Decimal(cost) / life)
            self.assets.append(AssetRecord.objects.create(
                company=self.company, code=code, name=name, asset_type="FIXED_ASSET", category=category, quantity=1,
                acquisition_date=date(2024, 1, 1), in_service_date=date(2024, 1, 1), original_cost=cost,
                accumulated_depreciation=monthly * used, method="STRAIGHT_LINE", useful_life_periods=life,
                periods_processed=used, branch=self.branch, department=self.departments["KD"],
                asset_account=self.account(account), accumulated_account=self.account("214"), is_depreciable=True,
                depreciable_amount=cost, useful_life_value=life, useful_life_unit="MONTH",
                monthly_depreciation_amount=monthly, annual_depreciation_amount=monthly * 12, status="ACTIVE",
                created_by=self.user,
            ))
            lines.append((account, cost, 0))
            fixed_cost += cost
            accumulated += monthly * used
        lines.append(("214", 0, accumulated))
        tool_value = ZERO
        self.tools = []
        for code, name, cost, life in TOOLS:
            self.tools.append(AssetRecord.objects.create(
                company=self.company, code=code, name=name, asset_type="TOOL", category=tools, quantity=1,
                acquisition_date=date(2026, 1, 1), in_service_date=date(2026, 1, 1), original_cost=cost,
                method="STRAIGHT_LINE", useful_life_periods=life, branch=self.branch,
                department=self.departments["KD"], asset_account=self.account("242"),
                accumulated_account=self.account("242"), is_depreciable=True, depreciable_amount=cost,
                useful_life_value=life, useful_life_unit="MONTH", monthly_depreciation_amount=money(Decimal(cost) / life),
                status="ACTIVE", created_by=self.user,
            ))
            tool_value += cost
        lines.append(("242", tool_value, 0))
        receivable_total = ZERO
        for index, (customer, amount) in enumerate(((self.customers[1], 250_000_000), (self.customers[3], 180_000_000))):
            receivable_total += amount
            self.receivable(customer, on - timedelta(days=20), date(2026, 1, 25), Decimal(amount), f"SDDK-KH-{index + 1}", opening=True)
        lines.append(("131", receivable_total, 0))
        payable_total = ZERO
        for supplier, amount in ((self.suppliers[0], 420_000_000), (self.suppliers[1], 310_000_000)):
            payable_total += amount
            self.open_payables.append(Payable.objects.create(
                company=self.company, branch=self.branch, supplier=supplier, currency=self.vnd, exchange_rate=1,
                original_amount=amount, balance=amount, due_date=date(2026, 1, 20), status="OPEN",
                document=self.opening_payable_document(supplier, amount),
            ))
        lines += [("331", 0, payable_total), ("341", 0, 1_500_000_000)]
        debit = sum(Decimal(line[1]) for line in lines)
        credit = sum(Decimal(line[2]) for line in lines)
        capital = 5_000_000_000
        lines += [("411", 0, capital), ("4211", 0, debit - credit - capital)]
        self.journal("SDDK", on, "Số dư đầu kỳ năm tài chính 2026", lines, entry_type="OPENING")

    def opening_payable_document(self, supplier, amount):
        from accounts_payable.models import PayableDocument

        on = date(2025, 12, 20)
        return PayableDocument.objects.create(
            company=self.company, branch=self.branch, number=self.number("CNDK"), document_date=on, posting_date=on,
            supplier=supplier, due_date=date(2026, 1, 20), payable_account=self.account("331"), currency=self.vnd,
            created_by=self.user, status="POSTED", total_amount=amount,
        )

    def receivable(self, customer, on, due, amount, source, entry=None, order=None, opening=False):
        record = Receivable.objects.create(
            company=self.company, branch=self.branch, code=f"CNPT-{source}", customer=customer,
            source_document_type="OPENING" if opening else "GOODS_SALE", source_document_id=uuid.uuid4(),
            source_document_number=source, source_line_id=uuid.uuid4(), journal_entry=entry,
            account=self.account("131"), document_date=on, posting_date=on, currency=self.vnd, exchange_rate=1,
            original_amount=amount, balance=amount, due_date=due, sales_order=order,
            sales_contract=None if opening else self.sale_contracts.get(customer.code),
            description=f"Công nợ {source}", status="OPEN", created_by=self.user,
        )
        self.open_receivables.append(record)
        return record

    # One month of business ----------------------------------------------------------------------

    def seed_month(self, month):
        season = SEASON[month]
        self.stock_transfer(date(2026, month, 1))
        self.settle_receivables(month)
        self.settle_payables(month)
        for index, supplier in enumerate(self.suppliers[:3]):
            self.purchase(date(2026, month, 3 + index * 7), supplier, season, index)
        for day in (2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 27):
            customer = self.random.choice(self.customers)
            self.sale(date(2026, month, day), customer, season)
        if month == 3:
            self.bank_transfer(date(2026, 3, 18))
        if month == 6:
            self.sale_return(date(2026, 6, 26))
        self.expenses(month)
        self.payroll(month)
        self.depreciation(month)
        self.interest(month)
        self.settle_vat(month)
        if month % 3 == 0:
            self.corporate_tax(month)
        self.close_month(month)

    def stock_transfer(self, on):
        central, store = self.warehouses
        document = InventoryTransaction.objects.create(
            company=self.company, branch=self.branch, number=self.number("CK"), transaction_type="TRANSFER",
            transaction_date=on, source_warehouse=central, destination_warehouse=store, status="POSTED",
            gl_status="NOT_REQUIRED", created_by=self.user,
        )
        line_no = 0
        for item in self.random.sample(self.items, 4):
            on_hand, on_hand_value = self.stock.get((central.pk, item.pk), (0, ZERO))
            quantity = min(on_hand, 4)
            if quantity:
                value = money(on_hand_value * quantity / on_hand)
                self.move(document, line_no + 1, on, central, item, -quantity, -value, value / quantity, "OUT")
                self.move(document, line_no + 2, on, store, item, quantity, value, value / quantity, "IN")
                line_no += 2

    def bank_transfer(self, on):
        amount = Decimal("300000000")
        description = "Chuyển tiền giữa hai tài khoản ngân hàng"
        entry = self.journal("BT", on, description, [("1121", amount, 0), ("1121", 0, amount)])
        BankTransfer.objects.create(
            company=self.company, number=self.number("CT"), source_account=self.bank_profile,
            destination_account=self.second_bank_profile, transfer_date=on, posting_date=on, source_amount=amount,
            destination_amount=amount, exchange_rate=1, description=description, status="CONFIRMED",
            created_by=self.user, confirmed_by=self.user, posted_at=timezone.now(), gl_reference=entry.number,
        )
        self.moved_to_second_bank = amount

    def purchase(self, on, supplier, season, index):
        warehouse = self.warehouses[0]
        chosen = self.random.sample(self.items, 4)
        rows = [(item, max(2, round(self.random.randint(5, 9) * season))) for item in chosen]
        number = self.number("MH")
        order = PurchaseOrder.objects.create(
            company=self.company, branch=self.branch, number=f"PO-{number}", document_date=on, created_by=self.user,
            supplier=supplier, currency=self.vnd, exchange_rate=1, status="COMPLETED", receiving_warehouse=warehouse,
            contract=self.purchase_contracts.get(supplier.code),
            receiving_status="FULLY_RECEIVED", invoicing_status="FULLY_INVOICED",
        )
        purchase = GoodsPurchase.objects.create(
            company=self.company, branch=self.branch, number=number, document_date=on, posting_date=on,
            created_by=self.user, purchase_type="WAREHOUSE", supplier=supplier, purchase_order=order,
            receiving_warehouse=warehouse, payment_type="UNPAID", status="POSTED",
            payment_due_date=on + timedelta(days=30), posted_at=timezone.now(),
        )
        invoice = SupplierInvoice.objects.create(
            company=self.company, branch=self.branch, supplier=supplier, supplier_tax_code=supplier.tax_code,
            invoice_series="1C26TDM", invoice_number=f"{self.number('HDV')}", invoice_date=on, currency=self.vnd,
            exchange_rate=1, created_by=self.user, purchase_order=order, status="POSTED", validation_status="VALID",
            match_status="MATCHED",
        )
        tax_invoice = TaxInvoice.objects.create(
            company=self.company, branch=self.branch, direction="INPUT", invoice_series=invoice.invoice_series,
            invoice_number=invoice.invoice_number, invoice_date=on, seller_name=supplier.name,
            seller_tax_code=supplier.tax_code, buyer_name=COMPANY_NAME, buyer_tax_code=TAX_CODE, party=supplier,
            currency=self.vnd, exchange_rate=1, source="MANUAL", status="VALIDATED", tax_eligible=True,
            created_by=self.user,
        )
        subtotal = ZERO
        for line_no, (item, quantity) in enumerate(rows, 1):
            unit_price = item.purchase_price
            amount = quantity * unit_price
            tax = money(amount * VAT)
            subtotal += amount
            order_line = PurchaseOrderLine.objects.create(
                order=order, line_no=line_no, item=item, uom=self.uom, quantity=quantity, unit_price=unit_price,
            )
            GoodsPurchaseLine.objects.create(
                purchase=purchase, line_no=line_no, item=item, uom=self.uom, warehouse=warehouse,
                order_line=order_line, quantity=quantity, unit_price=unit_price, tax_rate=self.vat10,
                debit_account=self.account("1561"), credit_account=self.account("331"), pre_tax_amount=amount,
                tax_amount=tax, total_amount=amount + tax, description=item.name,
            )
            SupplierInvoiceLine.objects.create(
                invoice=invoice, line_no=line_no, description=item.name, item=item, uom=self.uom, quantity=quantity,
                unit_price=unit_price, tax_rate=self.vat10, purchase_order_line=order_line,
            )
            TaxInvoiceLine.objects.create(
                invoice=tax_invoice, line_no=line_no, item=item, description=item.name, quantity=quantity,
                unit_price=unit_price, taxable_amount=amount, tax_rate=VAT * 100, tax_amount=tax,
                total_amount=amount + tax,
            )
        tax = money(subtotal * VAT)
        total = subtotal + tax
        inventory = self.stock_in(
            "RECEIPT", on, warehouse, [(item, quantity, item.purchase_price) for item, quantity in rows], supplier,
        )
        entry = self.journal(
            "BT", on, f"Mua hàng {number} của {supplier.name}",
            [("1561", subtotal, 0), ("1331", tax, 0), ("331", 0, total)], party=supplier,
        )
        GoodsPurchase.objects.filter(pk=purchase.pk).update(
            subtotal=subtotal, tax_amount=tax, total_amount=total, supplier_invoice=invoice,
            inventory_transaction=inventory, inventory_created=True, journal_entry=entry,
        )
        TaxInvoice.objects.filter(pk=tax_invoice.pk).update(subtotal=subtotal, tax_amount=tax, total_amount=total)
        self.open_payables.append(Payable.objects.create(
            company=self.company, branch=self.branch, supplier=supplier, goods_purchase=purchase, currency=self.vnd,
            exchange_rate=1, original_amount=total, balance=total, due_date=on + timedelta(days=30), status="OPEN",
        ))

    def sale(self, on, customer, season):
        retail = customer.code == "KH-LE"
        warehouse = self.warehouses[1] if retail else self.warehouses[0]
        rows = []
        for item in self.random.sample(self.items, 3):
            on_hand = self.stock.get((warehouse.pk, item.pk), (0, ZERO))[0]
            quantity = min(on_hand, max(1, round(self.random.randint(1, 3 if retail else 6) * season)))
            if quantity:
                rows.append((item, quantity))
        if not rows:
            return
        number = self.number("BH")
        payment = "UNPAID" if not retail else self.random.choice(("CASH", "BANK"))
        due = on + timedelta(days=self.payment_days[customer.code])
        order = SalesOrder.objects.create(
            company=self.company, branch=self.branch, number=f"SO-{number}", document_date=on, customer=customer,
            currency=self.vnd, exchange_rate=1, status="COMPLETED", created_by=self.user, default_warehouse=warehouse,
            contract=self.sale_contracts.get(customer.code),
        )
        sale = GoodsSale.objects.create(
            company=self.company, branch=self.branch, number=number, document_date=on, posting_date=on,
            customer=customer, currency=self.vnd, exchange_rate=1, status="POSTED", created_by=self.user,
            sales_order=order, payment_type=payment, due_date=due, posted_at=timezone.now(), posted_by=self.user,
            customer_tax_code=customer.tax_code or "", inventory_handling="ATTACH_ISSUE", inventory_created=True,
            company_bank_account=self.bank_account if payment == "BANK" else None,
        )
        invoice_number = self.number("HDR")
        invoice = SalesInvoice.objects.create(
            company=self.company, branch=self.branch, number=invoice_number, document_date=on, customer=customer,
            currency=self.vnd, exchange_rate=1, status="ISSUED", created_by=self.user, invoice_series="1C26TMK",
            invoice_date=on, seller_name=COMPANY_NAME, seller_tax_code=TAX_CODE, buyer_name=customer.name,
            goods_sale=sale, sales_order=order, invoice_category="VAT",
        )
        tax_invoice = TaxInvoice.objects.create(
            company=self.company, branch=self.branch, direction="OUTPUT", invoice_series="1C26TMK",
            invoice_number=invoice_number, invoice_date=on, seller_name=COMPANY_NAME, seller_tax_code=TAX_CODE,
            buyer_name=customer.name, buyer_tax_code=customer.tax_code or "", party=customer, currency=self.vnd,
            exchange_rate=1, source="SALES", status="ISSUED", tax_eligible=True, created_by=self.user,
        )
        inventory, costs = self.stock_out(on, warehouse, rows)
        subtotal, cost_total = ZERO, ZERO
        for line_no, ((item, quantity), cost) in enumerate(zip(rows, costs), 1):
            amount = quantity * item.sales_price
            tax = money(amount * VAT)
            subtotal += amount
            cost_total += cost
            order_line = SalesOrderLine.objects.create(
                order=order, line_no=line_no, item=item, uom=self.uom, quantity=quantity, unit_price=item.sales_price,
            )
            sale_line = GoodsSaleLine.objects.create(
                sale=sale, line_no=line_no, item=item, description=item.name, uom=self.uom, warehouse=warehouse,
                quantity=quantity, unit_price=item.sales_price, tax_rate=self.vat10, tax_amount=tax,
                line_total=amount + tax, revenue_account=self.account("5111"), tax_account=self.account("3331"),
                cogs_account=self.account("632"), inventory_account=self.account("1561"),
                unit_cost=cost / quantity, cogs_amount=cost, order_line=order_line,
            )
            SalesInvoiceLine.objects.create(
                invoice=invoice, line_no=line_no, item=item, item_name=item.name, uom=self.uom, quantity=quantity,
                unit_price=item.sales_price, amount=amount, tax_rate=self.vat10, goods_sale_line=sale_line,
                order_line=order_line,
            )
            TaxInvoiceLine.objects.create(
                invoice=tax_invoice, line_no=line_no, item=item, description=item.name, quantity=quantity,
                unit_price=item.sales_price, taxable_amount=amount, tax_rate=VAT * 100, tax_amount=tax,
                total_amount=amount + tax,
            )
        tax = money(subtotal * VAT)
        total = subtotal + tax
        debit_account = {"UNPAID": "131", "CASH": "1111", "BANK": "1121"}[payment]
        description = f"Bán hàng {number} cho {customer.name}"
        entry = self.journal(
            "BT", on, description, [(debit_account, total, 0), ("5111", 0, subtotal), ("3331", 0, tax)], party=customer,
        )
        self.journal(
            "BT", on, f"Giá vốn {number}", [("632", cost_total, 0), ("1561", 0, cost_total)], party=customer,
        )
        if payment == "CASH":
            self.cash("RECEIPT", "SALE", on, customer.name, total, description, entry, customer)
        elif payment == "BANK":
            self.bank("RECEIPT", "SALE", on, customer.name, total, description, entry, customer)
        receivable = None
        if payment == "UNPAID":
            receivable = self.receivable(customer, on, due, total, number, entry, order)
        GoodsSale.objects.filter(pk=sale.pk).update(
            subtotal=subtotal, tax_amount=tax, total_amount=total, inventory_transaction=inventory,
            journal_entry=entry, receivable=receivable, tax_invoice=tax_invoice,
        )
        SalesInvoice.objects.filter(pk=invoice.pk).update(tax_invoice=tax_invoice)
        TaxInvoice.objects.filter(pk=tax_invoice.pk).update(subtotal=subtotal, tax_amount=tax, total_amount=total)
        SalesOrder.objects.filter(pk=order.pk).update(subtotal=subtotal, tax_amount=tax, total_amount=total)

    def sale_return(self, on):
        sale = GoodsSale.objects.filter(
            company=self.company, posting_date__month=5, payment_type="UNPAID", receivable__status="OPEN",
        ).order_by("number").first()
        if not sale:
            return
        line = sale.lines.order_by("line_no").first()
        amount = line.unit_price
        tax = money(amount * VAT)
        document = SalesReturn.objects.create(
            company=self.company, branch=self.branch, number=self.number("TL"), document_date=on, posting_date=on,
            customer=sale.customer, currency=self.vnd, exchange_rate=1, status="POSTED", created_by=self.user,
            goods_sale=sale, return_reason="Khách trả lại 01 sản phẩm lỗi kỹ thuật", subtotal=amount, tax_amount=tax,
            total_amount=amount + tax,
        )
        SalesReturnLine.objects.create(
            sale_return=document, line_no=1, goods_sale_line=line, item=line.item, uom=line.uom,
            sold_quantity=line.quantity, return_quantity=1, unit_price=line.unit_price, tax_amount=tax,
            line_total=amount + tax,
        )
        self.stock_in("RETURN", on, line.warehouse, [(line.item, 1, line.unit_cost)], prefix="NTL")
        self.journal(
            "BT", on, f"Hàng bán trả lại {document.number}",
            [("521", amount, 0), ("3331", tax, 0), ("131", 0, amount + tax)], party=sale.customer,
        )
        self.journal(
            "BT", on, f"Nhập lại giá vốn {document.number}",
            [("1561", money(line.unit_cost), 0), ("632", 0, money(line.unit_cost))], party=sale.customer,
        )
        receivable = next(r for r in self.open_receivables if r.pk == sale.receivable_id)
        receivable.adjustment_amount = amount + tax
        receivable.balance -= amount + tax
        receivable.save(update_fields=("adjustment_amount", "balance"))

    def settle_receivables(self, month):
        """Collects what fell due last month; Thành Công pays late, so the aging reports have overdue debt."""
        cutoff = date(2026, month, 1)
        pay_on = date(2026, month, 10)
        for record in list(self.open_receivables):
            if record.due_date >= cutoff or record.balance <= 0:
                continue
            if record.customer.code == "KH-THANHCONG" and month >= 7:
                continue
            amount = record.balance
            reference = self.number("PT")
            receipt = Receipt.objects.create(
                company=self.company, branch=self.branch, customer=record.customer, currency=self.vnd,
                receipt_date=pay_on, amount=amount, allocated_amount=amount, external_type="BANK",
                external_reference=reference, company_bank_account=self.bank_account, status="CONFIRMED",
                created_by=self.user, base_amount=amount, exchange_rate=1, credit_account=self.account("131"),
            )
            ReceiptAllocation.objects.create(
                receipt=receipt, receivable=record, amount=amount, exchange_rate=1, created_by=self.user,
                effective_date=pay_on, receipt_book_amount=amount, debt_book_amount=amount,
            )
            description = f"Thu tiền {record.customer.name} theo {record.source_document_number}"
            entry = self.journal(
                "BT", pay_on, description, [("1121", amount, 0), ("131", 0, amount)], party=record.customer,
            )
            self.bank("RECEIPT", "CUSTOMER_RECEIPT", pay_on, record.customer.name, amount, description, entry, record.customer)
            record.collected_amount = amount
            record.balance = ZERO
            record.status = "PAID"
            record.save(update_fields=("collected_amount", "balance", "status"))
            self.open_receivables.remove(record)

    def settle_payables(self, month):
        cutoff = date(2026, month, 1)
        pay_on = date(2026, month, 15)
        for record in list(self.open_payables):
            if record.due_date >= cutoff:
                continue
            amount = record.balance
            number = self.number("UNC")
            description = f"Thanh toán {record.supplier.name} {number}"
            entry = self.journal(
                "BT", pay_on, description, [("331", amount, 0), ("1121", 0, amount)], party=record.supplier,
            )
            payment = Payment.objects.create(
                company=self.company, branch=self.branch, number=number, payment_source="DIRECT",
                supplier=record.supplier, currency=self.vnd, exchange_rate=1, payment_date=pay_on, amount=amount,
                allocated_amount=amount, payment_method="BANK_TRANSFER", payment_content=description,
                company_bank_account=self.bank_account, external_type="BANK", external_reference=number,
                journal_entry=entry, status="POSTED", posted_at=timezone.now(), posted_by=self.user,
                created_by=self.user,
            )
            PaymentAllocation.objects.create(
                payment=payment, payable=record, line_no=1, amount=amount, exchange_rate=1, created_by=self.user,
            )
            self.bank("PAYMENT", "SUPPLIER_PAYMENT", pay_on, record.supplier.name, amount, description, entry, record.supplier)
            record.paid_amount = amount
            record.balance = ZERO
            record.status = "PAID"
            record.save(update_fields=("paid_amount", "balance", "status"))
            self.open_payables.remove(record)

    def expenses(self, month):
        on = date(2026, month, 25)
        for label, account, amount, _ in MONTHLY_EXPENSES:
            amount = Decimal(amount)
            tax = money(amount * VAT)
            description = f"{label} tháng {month}/2026"
            entry = self.journal("BT", on, description, [(account, amount, 0), ("1331", tax, 0), ("1111", 0, amount + tax)])
            self.cash("PAYMENT", "EXPENSE", on, label, amount + tax, description, entry)
        withdrawal = Decimal("150000000")
        description = f"Rút tiền gửi về quỹ tháng {month}/2026"
        entry = self.journal("BT", date(2026, month, 2), description, [("1111", withdrawal, 0), ("1121", 0, withdrawal)])
        self.cash("RECEIPT", "BANK_WITHDRAWAL", date(2026, month, 2), "Ngân hàng", withdrawal, description, entry)
        self.bank("PAYMENT", "CASH_WITHDRAWAL", date(2026, month, 2), COMPANY_NAME, withdrawal, description, entry)
        fee = Decimal("450000")
        description = f"Phí dịch vụ ngân hàng tháng {month}/2026"
        entry = self.journal("BT", month_end(month), description, [("6422", fee, 0), ("1121", 0, fee)])
        self.bank("FEE", "BANK_FEE", month_end(month), "Ngân hàng Demo", fee, description, entry)

    def payroll(self, month):
        on = month_end(month)
        sheet = SalarySheet.objects.create(
            company=self.company, name=f"Bảng lương tháng {month}/2026", period=f"2026-{month:02d}", standard_days=26,
            status="POSTED", created_by=self.user,
        )
        expense = defaultdict(lambda: ZERO)
        employee_insurance_total, employer_total, net_total = ZERO, ZERO, ZERO
        for employee, salary, account in self.employees:
            employee_insurance = money(salary * Decimal("0.105"))
            employer_insurance = money(salary * Decimal("0.215"))
            net = salary - employee_insurance
            SalaryLine.objects.create(
                sheet=sheet, employee=employee, expense_account=self.account(account), base_salary=salary,
                working_days=26, gross=salary, employee_insurance=employee_insurance,
                employer_insurance=employer_insurance, net=net,
            )
            expense[account] += salary + employer_insurance
            employee_insurance_total += employee_insurance
            employer_total += employer_insurance
            net_total += net
        lines = [(code, amount, 0) for code, amount in expense.items()]
        lines += [("334", 0, net_total), ("338", 0, employee_insurance_total + employer_total)]
        sheet.journal_entry = self.journal("BT", on, f"Lương và bảo hiểm tháng {month}/2026", lines)
        sheet.save(update_fields=("journal_entry",))
        description = f"Trả lương và nộp bảo hiểm tháng {month}/2026"
        amount = net_total + employee_insurance_total + employer_total
        entry = self.journal(
            "BT", on, description, [("334", net_total, 0), ("338", employee_insurance_total + employer_total, 0), ("1121", 0, amount)],
        )
        self.bank("PAYMENT", "PAYROLL", on, "Nhân viên và BHXH", amount, description, entry)

    def depreciation(self, month):
        on = month_end(month)
        for code, kind, records, account, credit in (
            ("KH", "DEPRECIATION", self.assets, "6422", "214"), ("PB", "ALLOCATION", self.tools, "6422", "242"),
        ):
            total = sum(record.monthly_depreciation_amount for record in records)
            entry = self.journal(
                "BT", on, f"{'Khấu hao TSCĐ' if code == 'KH' else 'Phân bổ CCDC'} tháng {month}/2026",
                [(account, total, 0), (credit, 0, total)],
            )
            run = CalculationRun.objects.create(
                company=self.company, number=self.number(code), calculation_type=kind,
                period_code=f"2026-{month:02d}", period_start=date(2026, month, 1), period_end=on, period_month=month,
                period_year=2026, voucher_date=on, posting_date=on, status="POSTED", total_amount=total, gl_entry_id=entry.id,
                total_deductible_amount=total, created_by=self.user, posted_by=self.user, posted_at=timezone.now(),
            )
            for record in records:
                opening = record.accumulated_depreciation
                amount = record.monthly_depreciation_amount
                CalculationLine.objects.create(
                    run=run, asset=record, opening_value=record.original_cost - opening, amount=amount,
                    closing_value=record.original_cost - opening - amount, original_cost=record.original_cost,
                    depreciable_amount=record.depreciable_amount, opening_accumulated_depreciation=opening,
                    closing_accumulated_depreciation=opening + amount, deductible_amount=amount,
                    category_name=record.category.name,
                )
                record.accumulated_depreciation = opening + amount
                record.periods_processed += 1
                record.save(update_fields=("accumulated_depreciation", "periods_processed"))

    def interest(self, month):
        on = month_end(month)
        description = f"Lãi vay ngân hàng tháng {month}/2026"
        amount = Decimal("11250000")
        entry = self.journal("BT", on, description, [("635", amount, 0), ("1121", 0, amount)])
        self.bank("PAYMENT", "LOAN_INTEREST", on, "Ngân hàng Demo", amount, description, entry)
        description = f"Lãi tiền gửi tháng {month}/2026"
        amount = Decimal("1800000")
        entry = self.journal("BT", on, description, [("1121", amount, 0), ("515", 0, amount)])
        self.bank("INTEREST", "DEPOSIT_INTEREST", on, "Ngân hàng Demo", amount, description, entry)

    def settle_vat(self, month):
        on = month_end(month)
        output = sum(self.ledger[(m, "3331")][1] - self.ledger[(m, "3331")][0] for m in range(1, month + 1))
        input_tax = sum(self.ledger[(m, "1331")][0] - self.ledger[(m, "1331")][1] for m in range(1, month + 1))
        offset = min(output, input_tax)
        if offset > 0:
            self.journal("BT", on, f"Khấu trừ thuế GTGT tháng {month}/2026", [("3331", offset, 0), ("1331", 0, offset)])

    def profit_lines(self, months):
        revenue = ("5111", "515", "711")
        costs = ("521", "632", "635", "641", "6421", "6422", "811", "821")
        lines = []
        for code in revenue + costs:
            debit = sum(self.ledger[(m, code)][0] for m in months)
            credit = sum(self.ledger[(m, code)][1] for m in months)
            lines.append((code, credit - debit))
        return lines

    def corporate_tax(self, month):
        months = range(month - 2, month + 1)
        # Earlier months of the quarter are closed, so their result sits on 911 rather than on P&L accounts.
        profit = sum(self.ledger[(m, "911")][1] - self.ledger[(m, "911")][0] for m in months)
        profit += sum(amount for _, amount in self.profit_lines([month]))
        if profit > 0:
            self.journal(
                "BT", month_end(month), f"Tạm tính thuế TNDN quý {month // 3}/2026",
                [("821", money(profit * CIT), 0), ("3334", 0, money(profit * CIT))],
            )

    def close_month(self, month):
        on = month_end(month)
        lines, net = [], ZERO
        for code, amount in self.profit_lines([month]):
            if amount > 0:
                lines += [(code, amount, 0)]
            elif amount < 0:
                lines += [(code, 0, -amount)]
            net += amount
        lines.append(("911", 0, net) if net >= 0 else ("911", -net, 0))
        self.journal("KC", on, f"Kết chuyển xác định kết quả tháng {month}/2026", lines, entry_type="CLOSING")
        self.journal(
            "KC", on, f"Kết chuyển lãi lỗ tháng {month}/2026",
            [("911", net, 0), ("4212", 0, net)] if net >= 0 else [("4212", -net, 0), ("911", 0, -net)],
            entry_type="CLOSING",
        )

    # Totals -------------------------------------------------------------------------------------

    def write_balances(self):
        codes = {code for code in self.opening} | {code for _, code in self.ledger}
        rows = []
        for code in sorted(codes):
            opening_debit, opening_credit = self.opening[code]
            net = opening_debit - opening_credit
            for month in range(1, LAST_MONTH + 1):
                debit, credit = self.ledger[(month, code)]
                closing = net + debit - credit
                rows.append(AccountBalance(
                    company=self.company, period=self.periods[month], account=self.account(code), branch=self.branch,
                    opening_debit=max(net, ZERO), opening_credit=max(-net, ZERO), period_debit=debit,
                    period_credit=credit, closing_debit=max(closing, ZERO), closing_credit=max(-closing, ZERO),
                ))
                net = closing
        AccountBalance.objects.bulk_create(rows)
        self.closing = {
            code: self.opening[code][0] - self.opening[code][1]
            + sum(self.ledger[(m, code)][0] - self.ledger[(m, code)][1] for m in range(1, LAST_MONTH + 1))
            for code in codes
        }

    def write_closing_state(self):
        for (warehouse_id, item_id), (quantity, value) in self.stock.items():
            StockBalance.objects.create(
                company=self.company, warehouse_id=warehouse_id, item_id=item_id, quantity=quantity,
                inventory_value=value, average_cost=value / quantity if quantity else ZERO,
            )
        AccountProfile.objects.filter(pk=self.bank_profile.pk).update(
            balance=self.closing["1121"] - self.moved_to_second_bank,
        )
        AccountProfile.objects.filter(pk=self.second_bank_profile.pk).update(balance=self.moved_to_second_bank)
        # AP reports date debt by created_at, so backdate it to the documents it came from.
        for payable in Payable.objects.filter(company=self.company).select_related("goods_purchase", "document"):
            on = payable.goods_purchase.posting_date if payable.goods_purchase_id else payable.document.posting_date
            Payable.objects.filter(pk=payable.pk).update(created_at=on)
        for allocation in PaymentAllocation.objects.filter(payable__company=self.company).select_related("payment"):
            PaymentAllocation.objects.filter(pk=allocation.pk).update(created_at=allocation.payment.payment_date)
        CashFund.objects.filter(pk=self.cash_fund.pk).update(balance=self.closing["1111"])

    def check_trial_balance(self):
        total = sum(self.closing.values())
        if total:
            raise CommandError(f"Bảng cân đối phát sinh lệch {total}.")
        stock = sum(value for _, value in self.stock.values())
        if stock != self.closing["1561"]:
            raise CommandError(f"Kho {stock} lệch TK 1561 {self.closing['1561']}.")
        receivable = sum(r.balance for r in Receivable.objects.filter(company=self.company))
        if receivable != self.closing["131"]:
            raise CommandError(f"Sổ phải thu {receivable} lệch TK 131 {self.closing['131']}.")
        payable = sum(p.balance for p in Payable.objects.filter(company=self.company))
        if payable != -self.closing["331"]:
            raise CommandError(f"Sổ phải trả {payable} lệch TK 331 {self.closing['331']}.")
        for code in ("1111", "1121"):
            if self.closing[code] < 0:
                raise CommandError(f"TK {code} âm: {self.closing[code]}")

    def report(self):
        revenue = sum(self.ledger[(m, "5111")][1] for m in range(1, LAST_MONTH + 1))
        profit = -self.closing["4212"]
        self.stdout.write(self.style.SUCCESS(f"Đã tạo {COMPANY_NAME} (mã {COMPANY_CODE}), kỳ 01-10/2026."))
        for label, value in (
            ("Doanh thu", revenue), ("Lợi nhuận sau thuế", profit), ("Tiền mặt", self.closing["1111"]),
            ("Tiền gửi", self.closing["1121"]), ("Phải thu", self.closing["131"]), ("Phải trả", -self.closing["331"]),
            ("Tồn kho", self.closing["1561"]),
        ):
            self.stdout.write(f"- {label}: {value:,.0f}")
        self.stdout.write(
            f"- Bán hàng {GoodsSale.objects.filter(company=self.company).count()}, "
            f"mua hàng {GoodsPurchase.objects.filter(company=self.company).count()}, "
            f"bút toán {JournalEntry.objects.filter(company=self.company).count()}"
        )
