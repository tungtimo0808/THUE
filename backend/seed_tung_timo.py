# -*- coding: utf-8 -*-
import json
import os
import sys
from datetime import date
from decimal import Decimal

import django
from django.utils import timezone

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import transaction
from organization.models import Company, CompanyStatus, BusinessType, Branch, Department, Employee, Position
from iam.models import ActiveStatus, CompanyMembership, Role, UserAccount, UserRoleAssignment
from common_services.models import CoreCompanySetting, UserPreference
from common_services.setup_services import complete_company_setup
from master_data.models import (
    Bank,
    CompanyBankAccount,
    Currency,
    CustomerProfile,
    VendorProfile,
    Party,
    PartyRole,
    PartyAddress,
    PartyContact,
    Warehouse,
    UnitOfMeasure,
    ItemCategory,
    Item,
    CostCenter,
    TaxRate,
)
from general_ledger.models import (
    Account,
    AccountingPeriod,
    JournalEntry,
    JournalLine,
    ClosingRule,
    ClosingRun,
    FinancialStatementBatch,
)
from general_ledger.services import (
    save_opening_balances_uc_gl_15,
    check_opening_balances_uc_gl_15,
    post as post_journal,
    seed_default_closing_rules,
    create_profit_loss_closing_voucher,
    generate_financial_statements,
)
from general_ledger.serializers import FinancialStatementBatchSerializer
from cash_management.models import CashFund, CashTransaction, TransactionStatus as CashTxStatus, GlStatus
from bank_management.models import AccountProfile as BankAccountProfile, BankTransaction, TransactionStatus as BankTxStatus
from inventory.models import InventoryTransaction, InventoryTransactionLine
from payroll.models import PayProfile, SalarySheet
from payroll.services import create_salary_sheet, post_salary_sheet
from costing.models import CostObjectSetting, CostPeriod
from costing.services import (
    create_period as create_cost_period,
    transfer as transfer_cost_period,
    accept as accept_cost_period,
)
from reporting.services import management_report


class DummyUser:
    def __init__(self, iam_user):
        self.iam_account = iam_user
        self.is_superuser = True
        self.is_authenticated = True
        self.pk = iam_user.pk
        self.id = iam_user.id
        self.email = getattr(getattr(iam_user, "auth_user", None), "email", "ketoan@tungtimo.vn")


class DummyRequest:
    def __init__(self, user, data=None, company=None):
        self.user = DummyUser(user) if not hasattr(user, "iam_account") else user
        self.data = data or {}
        self.query_params = {}
        self.headers = {}
        self.META = {"REMOTE_ADDR": "127.0.0.1"}
        self.company = company


def find_account(company, code_or_candidates):
    candidates = [code_or_candidates] if isinstance(code_or_candidates, str) else list(code_or_candidates)
    for c in candidates:
        acc = Account.objects.filter(company=company, code=c, is_postable=True, status="ACTIVE").first()
        if acc:
            return acc
        sub = (
            Account.objects.filter(company=company, code__startswith=c, is_postable=True, status="ACTIVE")
            .order_by("code")
            .first()
        )
        if sub:
            return sub
    raise ValueError(f"[{company.code}] Cannot find postable account for {candidates}")


def create_posted_je(
    company,
    period,
    user,
    number,
    posting_date,
    description,
    lines_spec,
    entry_type="MANUAL",
    source_module="GL",
    branch=None,
):
    existing = JournalEntry.objects.filter(company=company, number=number).first()
    if existing:
        existing.lines.all().delete()
        existing.delete()

    total_debit = sum((Decimal(str(l.get("debit", 0))) for l in lines_spec), Decimal("0"))
    total_credit = sum((Decimal(str(l.get("credit", 0))) for l in lines_spec), Decimal("0"))
    assert total_debit == total_credit, f"Unbalanced JE {number}: D={total_debit} != C={total_credit}"

    req = DummyRequest(user, company=company)
    entry = JournalEntry.objects.create(
        company=company,
        branch=branch,
        period=period,
        number=number,
        entry_type=entry_type,
        posting_date=posting_date,
        document_date=posting_date,
        description=description,
        source_module=source_module,
        source_event_id=f"E2E:{company.code}:{number}",
        status="APPROVED",
        total_debit=total_debit,
        total_credit=total_credit,
        created_by=user,
        approved_by=user,
        workflow_snapshot={"allow_creator_posting": True},
    )
    for idx, l in enumerate(lines_spec, start=1):
        acc = l["account"]
        dims = dict(l.get("dimensions") or {})
        if acc.code.startswith("112") and not (dims.get("bank_account") or dims.get("bank_account_id")):
            dims["bank_account"] = "VCB-0011009988776"
        JournalLine.objects.create(
            entry=entry,
            line_no=idx,
            account=acc,
            debit=Decimal(str(l.get("debit", 0))),
            credit=Decimal(str(l.get("credit", 0))),
            currency=company.accounting_currency,
            description=l.get("description") or description,
            party=l.get("party"),
            warehouse=l.get("warehouse"),
            cost_center=l.get("cost_center"),
            dimensions=dims,
        )
    post_journal(entry, req)
    return entry


def clean_company_transactions(company):
    FinancialStatementBatch.objects.filter(company=company).delete()
    ClosingRun.objects.filter(company=company).delete()
    CostPeriod.objects.filter(company=company).delete()
    SalarySheet.objects.filter(company=company).delete()
    CashTransaction.objects.filter(company=company).delete()
    BankTransaction.objects.filter(company=company).delete()
    InventoryTransactionLine.objects.filter(transaction__company=company).delete()
    InventoryTransaction.objects.filter(company=company).delete()
    JournalLine.objects.filter(entry__company=company).delete()
    JournalEntry.objects.filter(company=company).delete()
    seed_default_closing_rules(company)


@transaction.atomic
def run_seed():
    all_accounts = list(UserAccount.objects.select_related("auth_user").all())
    primary_user = (
        UserAccount.objects.filter(
            auth_user__email__in=["tungtimo0808@gmail.com", "ketoan.mua@soviet.vn"]
        ).first()
        or UserAccount.objects.filter(auth_user__username__in=["timodapoet", "timodapoettt", "admin"]).first()
        or all_accounts[0]
    )
    print(f"[*] Primary IAM User: {primary_user.display_name} ({primary_user.auth_user.username})")

    vnd = Currency.objects.filter(code="VND").first()
    if not vnd:
        vnd = Currency.objects.create(code="VND", name="Đồng Việt Nam", numeric_code="704", decimal_places=0)

    # Create or update Công ty TNHH Tùng Timo
    company = (
        Company.objects.filter(code="TUNG_TIMO").first()
        or Company.objects.filter(tax_code="0110998877").first()
        or Company.objects.filter(name__icontains="Tùng Timo").first()
    )
    if company:
        company.code = "TUNG_TIMO"
        company.name = "Công ty TNHH Tùng Timo"
        company.short_name = "Tùng Timo Co., Ltd"
        company.legal_name = "CÔNG TY TNHH TÙNG TIMO"
        company.tax_code = "0110998877"
        company.business_type = BusinessType.LLC_ONE_MEMBER
        company.legal_representative = "Đỗ Đức Tùng"
        company.representative_title = "Giám đốc"
        company.accounting_regime = "TT99"
        company.province = "Thành phố Hà Nội"
        company.district = "Quận Cầu Giấy"
        company.ward = "Phường Dịch Vọng Hậu"
        company.address = "Tầng 18, Tòa nhà Tùng Timo Tower, Số 88 Phố Duy Tân, Quận Cầu Giấy, TP. Hà Nội"
        company.phone = "0988998877"
        company.email = "ketoan@tungtimo.vn"
        company.website = "https://tungtimo.vn"
        company.status = CompanyStatus.ACTIVE
        company.created_by_user_id = primary_user.id
        company.save()
    else:
        company = Company.objects.create(
            code="TUNG_TIMO",
            name="Công ty TNHH Tùng Timo",
            short_name="Tùng Timo Co., Ltd",
            legal_name="CÔNG TY TNHH TÙNG TIMO",
            tax_code="0110998877",
            business_type=BusinessType.LLC_ONE_MEMBER,
            legal_representative="Đỗ Đức Tùng",
            representative_title="Giám đốc",
            accounting_currency=vnd,
            legal_reporting_currency=vnd,
            accounting_regime="TT99",
            province="Thành phố Hà Nội",
            district="Quận Cầu Giấy",
            ward="Phường Dịch Vọng Hậu",
            address="Tầng 18, Tòa nhà Tùng Timo Tower, Số 88 Phố Duy Tân, Quận Cầu Giấy, TP. Hà Nội",
            phone="0988998877",
            email="ketoan@tungtimo.vn",
            website="https://tungtimo.vn",
            status=CompanyStatus.ACTIVE,
            created_by_user_id=primary_user.id,
        )

    # Complete company setup (COA TT99, Fiscal Year, Periods, Tax Rates, UOM, CashFund, Roles)
    complete_company_setup(company, primary_user)

    # Ensure start_date in CoreCompanySetting for all companies so Opening Balance never 400s
    for comp in Company.objects.all():
        setting, _ = CoreCompanySetting.objects.get_or_create(company=comp)
        cfg = dict(setting.configuration or {})
        if not cfg.get("accounting_start_date"):
            cfg["accounting_start_date"] = "2026-01-01"
        if not cfg.get("accounting_regime"):
            cfg["accounting_regime"] = comp.accounting_regime or "TT99"
        setting.configuration = cfg
        setting.save(update_fields=["configuration", "updated_at"])

    branch = Branch.objects.filter(company=company, is_head_office=True).first()
    if not branch:
        branch = Branch.objects.create(
            company=company,
            code="CN-HO",
            name="Trụ sở chính - Công ty TNHH Tùng Timo",
            tax_code=company.tax_code,
            address=company.address,
            is_head_office=True,
            status="ACTIVE",
        )

    # Grant all users ACTIVE membership and COMPANY_ADMIN + CHIEF_ACCOUNTANT roles on Công ty TNHH Tùng Timo
    admin_roles = list(Role.objects.filter(company=company, is_system_admin=True))
    if not admin_roles:
        admin_roles = list(Role.objects.filter(company=company))
    for u in all_accounts:
        mem, _ = CompanyMembership.objects.update_or_create(
            company=company,
            user=u,
            defaults={
                "membership_status": ActiveStatus.ACTIVE,
                "internal_display_name": u.display_name or u.auth_user.username,
                "created_by": primary_user,
            },
        )
        for r in admin_roles:
            UserRoleAssignment.objects.get_or_create(
                company_membership=mem,
                role=r,
                defaults={
                    "status": ActiveStatus.ACTIVE,
                    "assigned_by": primary_user,
                    "assign_reason": "Quản trị viên / Kế toán trưởng Công ty TNHH Tùng Timo",
                },
            )
        pref, _ = UserPreference.objects.get_or_create(user=u)
        pref.current_company = company
        pref.current_branch = branch
        pref.all_branches = True
        pref.save(update_fields=["current_company", "current_branch", "all_branches", "updated_at"])

    # Clean previous transactions for idempotency
    clean_company_transactions(company)

    # Ensure 2026 period covers full year 2026-01-01 .. 2026-12-31 for smooth posting in any month
    period = AccountingPeriod.objects.filter(company=company, fiscal_year=2026).order_by("period_number").first()
    if not period:
        period = AccountingPeriod.objects.create(
            company=company,
            code="2026-01",
            fiscal_year=2026,
            period_number=1,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="OPEN",
        )
    else:
        period.start_date = date(2026, 1, 1)
        period.end_date = date(2026, 12, 31)
        period.status = "OPEN"
        period.save(update_fields=["start_date", "end_date", "status"])

    # =========================================================================
    # DANH MỤC DOANH NGHIỆP THẬT (MASTER DATA)
    # =========================================================================
    acc_131 = find_account(company, "131")
    acc_331 = find_account(company, "331")
    acc_5111 = find_account(company, ["5111", "511"])
    acc_152 = find_account(company, "152")
    acc_155 = find_account(company, ["1551", "155"])
    acc_632 = find_account(company, "632")
    acc_1111 = find_account(company, "1111")
    acc_1121 = find_account(company, "1121")

    customers_spec = [
        ("KH001", "Công ty Cổ phần Tập đoàn FPT", "0101248141", "Số 10 Phố Phạm Văn Bạch, Quận Cầu Giấy, TP. Hà Nội", "02473007300", "Ông Nguyễn Văn Khoa"),
        ("KH002", "Công ty Cổ phần VNG", "0303490096", "Z06 Đường số 13, Phường Tân Thuận Đông, Quận 7, TP. HCM", "02839623888", "Ông Lê Hồng Minh"),
        ("KH003", "Tập đoàn Công nghiệp – Viễn thông Quân đội (Viettel)", "0100109106", "Lô D26 Khu đô thị mới Cầu Giấy, Quận Cầu Giấy, TP. Hà Nội", "02462556789", "Ban Dự án Viettel Solutions"),
        ("KH004", "Công ty TNHH Thương mại Đối tác Tùng Timo", "0108889991", "Số 68 Đường Nguyễn Chí Thanh, Quận Đống Đa, TP. Hà Nội", "0912345678", "Bà Phạm Thanh Thảo"),
    ]
    cust_parties = {}
    for code, name, tax, addr, phone, contact in customers_spec:
        p, _ = Party.objects.update_or_create(
            company=company,
            code=code,
            defaults={
                "name": name,
                "legal_name": name,
                "party_type": "ORGANIZATION",
                "tax_code": tax,
                "representative": contact,
                "branch": branch,
                "default_currency": vnd,
                "status": "ACTIVE",
            },
        )
        PartyRole.objects.update_or_create(
            party=p,
            role_type="CUSTOMER",
            defaults={"active_from": date(2025, 1, 1)},
        )
        CustomerProfile.objects.update_or_create(
            party=p,
            defaults={
                "receivable_account": acc_131,
                "revenue_account": acc_5111,
                "credit_limit": Decimal("2000000000"),
                "credit_days": 30,
                "status": "ACTIVE",
            },
        )
        PartyAddress.objects.update_or_create(
            party=p,
            address_type="HEAD_OFFICE",
            defaults={"address_line": addr, "is_default": True, "status": "ACTIVE"},
        )
        PartyContact.objects.update_or_create(
            party=p,
            contact_type="PRIMARY",
            defaults={"contact_name": contact, "phone": phone, "email": f"info@{code.lower()}.vn", "is_default": True, "status": "ACTIVE"},
        )
        cust_parties[code] = p

    suppliers_spec = [
        ("NCC001", "Công ty Cổ phần Tập đoàn Hòa Phát", "0900189284", "KCN Phố Nối A, Huyện Yên Mỹ, Tỉnh Hưng Yên", "02462848666", "Phòng Kinh doanh Thép Hòa Phát"),
        ("NCC002", "Công ty TNHH Thiết bị Công nghiệp Việt Nhật", "0106688992", "Lô CN03 KCN Bắc Thăng Long, Đông Anh, Hà Nội", "02438812345", "Ông Trần Quốc Tuấn"),
        ("NCC003", "Tổng Công ty Điện lực TP Hà Nội (EVN HANOI)", "0100101393", "Số 69 Đinh Tiên Hoàng, Quận Hoàn Kiếm, TP. Hà Nội", "19001288", "Trung tâm CSKH EVN HANOI"),
    ]
    supp_parties = {}
    for code, name, tax, addr, phone, contact in suppliers_spec:
        p, _ = Party.objects.update_or_create(
            company=company,
            code=code,
            defaults={
                "name": name,
                "legal_name": name,
                "party_type": "ORGANIZATION",
                "tax_code": tax,
                "representative": contact,
                "branch": branch,
                "default_currency": vnd,
                "status": "ACTIVE",
            },
        )
        PartyRole.objects.update_or_create(
            party=p,
            role_type="VENDOR",
            defaults={"active_from": date(2025, 1, 1)},
        )
        VendorProfile.objects.update_or_create(
            party=p,
            defaults={
                "payable_account": acc_331,
                "purchase_account": acc_152,
                "status": "ACTIVE",
            },
        )
        PartyAddress.objects.update_or_create(
            party=p,
            address_type="HEAD_OFFICE",
            defaults={"address_line": addr, "is_default": True, "status": "ACTIVE"},
        )
        PartyContact.objects.update_or_create(
            party=p,
            contact_type="PRIMARY",
            defaults={"contact_name": contact, "phone": phone, "email": f"sales@{code.lower()}.vn", "is_default": True, "status": "ACTIVE"},
        )
        supp_parties[code] = p

    # Phòng ban & Nhân viên
    dept_bgd, _ = Department.objects.update_or_create(
        company=company, code="PB-BGD", defaults={"name": "Ban Giám đốc & Tài chính Kế toán", "branch": branch, "status": "ACTIVE"}
    )
    dept_kd, _ = Department.objects.update_or_create(
        company=company, code="PB-KD", defaults={"name": "Phòng Kinh doanh & Dự án", "branch": branch, "status": "ACTIVE"}
    )
    dept_sx, _ = Department.objects.update_or_create(
        company=company, code="PB-SX", defaults={"name": "Phân xưởng Sản xuất Tự động hóa", "branch": branch, "status": "ACTIVE"}
    )

    acc_6421 = find_account(company, ["6421", "642"])
    acc_6411 = find_account(company, ["6411", "641"])
    acc_622 = find_account(company, ["622", "154"])

    employees_spec = [
        ("NV001", "Đỗ Đức Tùng", dept_bgd, "Giám đốc điều hành", Decimal("35000000"), Decimal("5000000"), Decimal("25000000"), 2, acc_6421),
        ("NV002", "Nguyễn Hoàng Nam", dept_bgd, "Kế toán trưởng", Decimal("22000000"), Decimal("3000000"), Decimal("18000000"), 1, acc_6421),
        ("NV003", "Trần Thị Mai", dept_kd, "Trưởng phòng Kinh doanh", Decimal("18000000"), Decimal("2000000"), Decimal("15000000"), 1, acc_6411),
        ("NV004", "Lê Văn Hùng", dept_sx, "Kỹ sư trưởng Sản xuất", Decimal("16000000"), Decimal("2000000"), Decimal("14000000"), 0, acc_622),
    ]
    emp_objs = {}
    for e_code, full_name, dept, title, base_sal, allow_sal, ins_sal, deps, exp_acc in employees_spec:
        emp, _ = Employee.objects.update_or_create(
            company=company,
            employee_code=e_code,
            defaults={
                "full_name": full_name,
                "branch": branch,
                "department": dept,
                "job_title": title,
                "hire_date": date(2025, 1, 1),
                "email": f"{e_code.lower()}@tungtimo.vn",
                "phone": "0988998877",
                "status": "ACTIVE",
            },
        )
        PayProfile.objects.update_or_create(
            company=company,
            employee=emp,
            defaults={
                "base_salary": base_sal,
                "allowance": allow_sal,
                "insurance_salary": ins_sal,
                "dependents": deps,
                "expense_account": exp_acc,
                "is_active": True,
            },
        )
        emp_objs[e_code] = emp

    # Kho, ĐVT, Nhóm VTHH & Vật tư hàng hóa
    wh_nvl, _ = Warehouse.objects.update_or_create(
        company=company,
        code="KHO-NVL",
        defaults={"name": "Kho Nguyên vật liệu & Linh kiện", "branch": branch, "warehouse_scope": "COMPANY_SHARED", "status": "ACTIVE"},
    )
    wh_tp, _ = Warehouse.objects.update_or_create(
        company=company,
        code="KHO-TP",
        defaults={"name": "Kho Thành phẩm Tùng Timo", "branch": branch, "warehouse_scope": "COMPANY_SHARED", "status": "ACTIVE"},
    )
    uom_kg, _ = UnitOfMeasure.objects.update_or_create(
        company=company, code="KG", defaults={"name": "Kilogram", "symbol": "Kg", "measurement_type": "WEIGHT", "status": "ACTIVE"}
    )
    uom_bo, _ = UnitOfMeasure.objects.update_or_create(
        company=company, code="BO", defaults={"name": "Bộ", "symbol": "Bộ", "measurement_type": "COUNT", "decimal_places": 0, "integer_only": True, "status": "ACTIVE"}
    )
    uom_goi, _ = UnitOfMeasure.objects.update_or_create(
        company=company, code="GOI", defaults={"name": "Gói", "symbol": "Gói", "measurement_type": "SERVICE", "status": "ACTIVE"}
    )
    cat_nvl, _ = ItemCategory.objects.update_or_create(
        company=company, code="NHOM-NVL", defaults={"name": "Nhóm Nguyên vật liệu & Linh kiện", "status": "ACTIVE"}
    )
    cat_tp, _ = ItemCategory.objects.update_or_create(
        company=company, code="NHOM-TP", defaults={"name": "Nhóm Thành phẩm & Giải pháp", "status": "ACTIVE"}
    )
    vat10 = TaxRate.objects.filter(company=company, code="VAT10").first()

    item_nvl1, _ = Item.objects.update_or_create(
        company=company,
        code="NVL-THEP-S45C",
        defaults={
            "name": "Thép tấm hợp kim Hòa Phát S45C",
            "category": cat_nvl,
            "item_type": "MATERIAL",
            "base_uom": uom_kg,
            "purchase_uom": uom_kg,
            "sales_uom": uom_kg,
            "purchase_price": Decimal("25000"),
            "inventory_account": acc_152,
            "purchase_tax_rate": vat10,
            "status": "ACTIVE",
        },
    )
    item_nvl2, _ = Item.objects.update_or_create(
        company=company,
        code="NVL-PLC-FX5U",
        defaults={
            "name": "Bo mạch điều khiển công nghiệp PLC Mitsubishi FX5U",
            "category": cat_nvl,
            "item_type": "MATERIAL",
            "base_uom": uom_bo,
            "purchase_uom": uom_bo,
            "sales_uom": uom_bo,
            "purchase_price": Decimal("5000000"),
            "inventory_account": acc_152,
            "purchase_tax_rate": vat10,
            "status": "ACTIVE",
        },
    )
    item_tp, _ = Item.objects.update_or_create(
        company=company,
        code="TP-SMARTBOX-PRO",
        defaults={
            "name": "Tủ điều khiển tự động hóa Tùng Timo SmartBox Pro",
            "category": cat_tp,
            "item_type": "FINISHED_GOOD",
            "base_uom": uom_bo,
            "purchase_uom": uom_bo,
            "sales_uom": uom_bo,
            "purchase_price": Decimal("12000000"),
            "sales_price": Decimal("50000000"),
            "inventory_account": acc_155,
            "cogs_account": acc_632,
            "revenue_account": acc_5111,
            "sales_tax_rate": vat10,
            "status": "ACTIVE",
        },
    )
    item_dv, _ = Item.objects.update_or_create(
        company=company,
        code="DV-IOT-CLOUD",
        defaults={
            "name": "Gói giải pháp phần mềm điều khiển & IoT Tùng Timo Cloud",
            "category": cat_tp,
            "item_type": "SERVICE",
            "track_inventory": False,
            "base_uom": uom_goi,
            "purchase_uom": uom_goi,
            "sales_uom": uom_goi,
            "sales_price": Decimal("150000000"),
            "revenue_account": acc_5111,
            "sales_tax_rate": vat10,
            "status": "ACTIVE",
        },
    )

    # Ngân hàng & Quỹ tiền mặt
    bank_vcb_master, _ = Bank.objects.get_or_create(
        code="VCB", defaults={"name": "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)", "swift_code": "BFTVVNVX", "status": "ACTIVE"}
    )
    comp_bank_vcb, _ = CompanyBankAccount.objects.update_or_create(
        company=company,
        code="TK-VCB-VND",
        defaults={
            "account_number": "0011009988776",
            "account_name": "CONG TY TNHH TUNG TIMO",
            "bank": bank_vcb_master,
            "bank_branch": "Chi nhánh Cầu Giấy - Hà Nội",
            "currency": vnd,
            "gl_account": acc_1121,
            "is_default": True,
            "status": "ACTIVE",
        },
    )
    bank_profile_vcb, _ = BankAccountProfile.objects.update_or_create(
        company=company,
        account=comp_bank_vcb,
        defaults={"balance": Decimal("2315000000"), "allow_overdraft": True},
    )
    cash_fund = CashFund.objects.filter(company=company).first()
    if cash_fund:
        cash_fund.balance = Decimal("611000000")
        cash_fund.allow_negative = True
        cash_fund.save(update_fields=["balance", "allow_negative", "updated_at"])

    cost_center, _ = CostCenter.objects.update_or_create(
        company=company,
        code="PX-TUDONGHOA",
        defaults={"name": "Phân xưởng Sản xuất Tự động hóa Tùng Timo", "status": "ACTIVE"},
    )
    CostObjectSetting.objects.update_or_create(
        company=company,
        object_type="COST_CENTER",
        object_id=cost_center.pk,
        defaults={
            "finished_item": item_tp,
            "coefficient": Decimal("1"),
            "planned_cost": Decimal("100000000"),
            "opening_wip": Decimal("0"),
        },
    )

    # =========================================================================
    # CHẠY XUYÊN SUỐT 12 PHÂN HỆ KẾ TOÁN CHUẨN DOANH NGHIỆP THẬT
    # =========================================================================
    report = {
        "company_id": str(company.id),
        "company_code": company.code,
        "company_name": company.name,
        "tax_code": company.tax_code,
        "legal_representative": company.legal_representative,
        "regime": company.accounting_regime,
        "accounts_total": Account.objects.filter(company=company, status="ACTIVE").count(),
        "modules": {},
    }

    # MODULE 1: SỐ DƯ BAN ĐẦU (500tr Tiền mặt + 1.5 tỷ Tiền gửi VCB = 2 tỷ Vốn góp CSH)
    acc_4111 = find_account(company, "4111")
    req_ob = DummyRequest(primary_user, company=company)
    ob_save = save_opening_balances_uc_gl_15(
        company=company,
        payload={
            "category": "accounts",
            "items": [
                {"account": acc_1111.code, "debit": "500000000", "credit": "0"},
                {"account": acc_1121.code, "debit": "1500000000", "credit": "0"},
                {"account": acc_4111.code, "debit": "0", "credit": "2000000000"},
            ],
        },
        request=req_ob,
    )
    ob_check = check_opening_balances_uc_gl_15(company=company, request=req_ob)
    report["modules"]["01_opening_balance"] = {
        "status": "PASS" if ob_save.get("balanced") else "FAIL",
        "total_debit": str(ob_save.get("total_debit")),
        "total_credit": str(ob_save.get("total_credit")),
        "gl_entry_number": ob_save.get("gl_entry_number"),
    }

    # MODULE 2: MUA HÀNG (Mua NVL từ Thép Hòa Phát 200tr + VAT 20tr; Mua dịch vụ EVN Hà Nội 30tr + VAT 3tr)
    acc_1331 = find_account(company, "1331")
    acc_6427 = find_account(company, ["6427", "6428", "642"])
    je_pur_nvl = create_posted_je(
        company, period, primary_user, "MH-NVL-001", date(2026, 6, 2),
        "Mua thép tấm S45C & Bo mạch PLC Mitsubishi nhập kho từ Tập đoàn Hòa Phát (HĐ 0001258)",
        [
            {"account": acc_152, "debit": Decimal("200000000"), "warehouse": wh_nvl},
            {"account": acc_1331, "debit": Decimal("20000000")},
            {"account": acc_331, "credit": Decimal("220000000"), "party": supp_parties["NCC001"]},
        ],
        source_module="PURCHASING", branch=branch,
    )
    je_pur_srv = create_posted_je(
        company, period, primary_user, "MH-DV-002", date(2026, 6, 3),
        "Mua dịch vụ điện năng & hạ tầng vận hành văn phòng từ EVN HANOI (HĐ 0098412)",
        [
            {"account": acc_6427, "debit": Decimal("30000000")},
            {"account": acc_1331, "debit": Decimal("3000000")},
            {"account": acc_331, "credit": Decimal("33000000"), "party": supp_parties["NCC003"]},
        ],
        source_module="PURCHASING", branch=branch,
    )
    report["modules"]["02_purchasing"] = {
        "status": "PASS",
        "vouchers": [je_pur_nvl.number, je_pur_srv.number],
    }

    # MODULE 3: KHO (Xuất kho NVL đưa vào sản xuất lô 10 Tủ điều khiển SmartBox Pro: 80tr)
    acc_621 = find_account(company, ["621", "154"])
    je_inv_issue = create_posted_je(
        company, period, primary_user, "PXK-SX-001", date(2026, 6, 5),
        "Xuất kho Thép tấm S45C & Bo mạch PLC sản xuất lô 10 Tủ điều khiển Tùng Timo SmartBox Pro",
        [
            {"account": acc_621, "debit": Decimal("80000000"), "cost_center": cost_center, "description": "Chi phí nguyên vật liệu trực tiếp sản xuất SmartBox Pro"},
            {"account": acc_152, "credit": Decimal("80000000"), "warehouse": wh_nvl},
        ],
        source_module="INVENTORY", branch=branch,
    )
    report["modules"]["03_inventory"] = {
        "status": "PASS",
        "voucher": je_inv_issue.number,
    }

    # MODULE 4: CÔNG CỤ DỤNG CỤ (Ghi tăng dàn máy trạm kỹ thuật Dell Precision 24tr & Phân bổ kỳ 1: 2tr)
    acc_242 = find_account(company, ["2421", "242"])
    acc_6423 = find_account(company, ["6423", "642"])
    je_ccdc_buy = create_posted_je(
        company, period, primary_user, "CCDC-TANG-001", date(2026, 6, 6),
        "Mua và ghi tăng CCDC: Dàn máy trạm kỹ thuật Dell Precision & Thiết bị đo kiểm",
        [
            {"account": acc_242, "debit": Decimal("24000000")},
            {"account": acc_1111, "credit": Decimal("24000000")},
        ],
        branch=branch,
    )
    je_ccdc_alloc = create_posted_je(
        company, period, primary_user, "CCDC-PB-001", date(2026, 6, 25),
        "Phân bổ chi phí công cụ dụng cụ kỳ tháng 06/2026",
        [
            {"account": acc_6423, "debit": Decimal("2000000")},
            {"account": acc_242, "credit": Decimal("2000000")},
        ],
        branch=branch,
    )
    report["modules"]["04_tools_ccdc"] = {
        "status": "PASS",
        "vouchers": [je_ccdc_buy.number, je_ccdc_alloc.number],
    }

    # MODULE 5: TÀI SẢN CỐ ĐỊNH (Ghi tăng Máy cắt Laser CNC Fiber 120tr + VAT 12tr; Khấu hao 2tr; Tài sản sinh học TT99 15tr)
    acc_211 = find_account(company, ["2111", "211"])
    acc_1332 = find_account(company, ["1332", "1331"])
    acc_2141 = find_account(company, ["2141", "214"])
    acc_6274 = find_account(company, ["6274", "627"])
    acc_215 = find_account(company, ["2151", "215"])
    je_fa_acq = create_posted_je(
        company, period, primary_user, "TSCD-TANG-001", date(2026, 6, 7),
        "Đầu tư TSCĐ hữu hình: Hệ thống Máy cắt Laser CNC Fiber Tùng Timo 3015",
        [
            {"account": acc_211, "debit": Decimal("120000000")},
            {"account": acc_1332, "debit": Decimal("12000000")},
            {"account": acc_331, "credit": Decimal("132000000"), "party": supp_parties["NCC002"]},
        ],
        source_module="FA", branch=branch,
    )
    je_fa_dep = create_posted_je(
        company, period, primary_user, "TSCD-KH-001", date(2026, 6, 28),
        "Trích khấu hao TSCĐ Máy cắt Laser CNC Fiber tại Phân xưởng Sản xuất",
        [
            {"account": acc_6274, "debit": Decimal("2000000"), "cost_center": cost_center, "description": "Chi phí khấu hao máy móc sản xuất chung"},
            {"account": acc_2141, "credit": Decimal("2000000")},
        ],
        source_module="FA", branch=branch,
    )
    je_tt99_215 = create_posted_je(
        company, period, primary_user, "TT99-215-001", date(2026, 6, 8),
        "Đầu tư tài sản sinh học cây xanh cảnh quan khuôn viên theo Thông tư 99/2025/TT-BTC",
        [
            {"account": acc_215, "debit": Decimal("15000000")},
            {"account": acc_1121, "credit": Decimal("15000000")},
        ],
        source_module="FA", branch=branch,
    )
    report["modules"]["05_fixed_assets"] = {
        "status": "PASS",
        "vouchers": [je_fa_acq.number, je_fa_dep.number, je_tt99_215.number],
    }

    # MODULE 6: TIỀN LƯƠNG (Bảng lương tháng 06/2026 cho 4 nhân viên Công ty TNHH Tùng Timo)
    req_payroll = DummyRequest(
        primary_user,
        data={"period": "2026-06", "name": "Bảng lương tháng 06/2026 - Công ty TNHH Tùng Timo"},
        company=company,
    )
    sheet = create_salary_sheet(company, req_payroll.data, req_payroll)
    sheet = post_salary_sheet(sheet, req_payroll)
    report["modules"]["06_payroll"] = {
        "status": "PASS" if sheet.status == "POSTED" else "FAIL",
        "sheet_name": sheet.name,
        "journal_entry": sheet.journal_entry.number,
        "employees_count": sheet.lines.count(),
        "total_gross": str(sum(l.gross for l in sheet.lines.all())),
        "total_net": str(sum(l.net for l in sheet.lines.all())),
    }

    # MODULE 7: GIÁ THÀNH (Tập hợp chi phí SX 621/622/627 -> Kết chuyển 154 -> Nghiệm thu nhập kho 10 bộ Tủ điều khiển SmartBox Pro)
    req_cost = DummyRequest(
        primary_user,
        data={
            "code": "GT-202606-TT",
            "name": "Kỳ tính giá thành tháng 06/2026 - Tủ điều khiển SmartBox Pro",
            "method": "SIMPLE",
            "start_date": date(2026, 6, 1),
            "end_date": date(2026, 6, 30),
            "objects": [
                {
                    "object_type": "COST_CENTER",
                    "object_id": str(cost_center.pk),
                    "output_quantity": "10",
                    "coefficient": "1",
                    "planned_cost": "100000000",
                    "opening_wip": "0",
                    "closing_wip": "0",
                }
            ],
        },
        company=company,
    )
    cost_period = create_cost_period(company, req_cost.data, req_cost)
    cost_period = transfer_cost_period(cost_period, req_cost)
    req_accept = DummyRequest(
        primary_user,
        data={"target": "FINISHED_GOODS", "warehouse": str(wh_tp.pk)},
        company=company,
    )
    cost_period = accept_cost_period(cost_period, req_accept)
    c_obj = cost_period.cost_objects.first()
    report["modules"]["07_costing"] = {
        "status": "PASS" if cost_period.status == "ACCEPTED" else "FAIL",
        "total_cost": str(c_obj.total_cost),
        "unit_cost": str(c_obj.unit_cost),
        "transfer_entry": cost_period.transfer_entry.number,
        "acceptance_entry": cost_period.acceptance_entry.number,
    }

    # MODULE 8: BÁN HÀNG (Bán 10 bộ Tủ điều khiển SmartBox Pro & Giải pháp IoT cho Tập đoàn FPT: 800tr + VAT 80tr; Chiết khấu 15tr; Giá vốn)
    acc_33311 = find_account(company, ["33311", "3331"])
    acc_5211 = find_account(company, ["5211", "521"])
    cogs_amount = c_obj.total_cost
    je_sales_rev = create_posted_je(
        company, period, primary_user, "BH-DT-001", date(2026, 6, 18),
        "Bán 10 bộ Tủ điều khiển SmartBox Pro & Gói giải pháp IoT cho Công ty CP Tập đoàn FPT (HĐ 0000101)",
        [
            {"account": acc_131, "debit": Decimal("880000000"), "party": cust_parties["KH001"]},
            {"account": acc_5111, "credit": Decimal("800000000")},
            {"account": acc_33311, "credit": Decimal("80000000")},
        ],
        source_module="SALES", branch=branch,
    )
    je_sales_ded = create_posted_je(
        company, period, primary_user, "BH-CK-002", date(2026, 6, 19),
        "Chiết khấu thương mại hợp đồng chiến lược cho Công ty CP Tập đoàn FPT",
        [
            {"account": acc_5211, "debit": Decimal("15000000")},
            {"account": acc_131, "credit": Decimal("15000000"), "party": cust_parties["KH001"]},
        ],
        source_module="SALES", branch=branch,
    )
    je_sales_cogs = create_posted_je(
        company, period, primary_user, "BH-GV-003", date(2026, 6, 18),
        "Kết chuyển giá vốn 10 bộ Tủ điều khiển SmartBox Pro xuất bán cho Tập đoàn FPT",
        [
            {"account": acc_632, "debit": cogs_amount},
            {"account": acc_155, "credit": cogs_amount, "warehouse": wh_tp},
        ],
        source_module="SALES", branch=branch,
    )
    report["modules"]["08_sales"] = {
        "status": "PASS",
        "vouchers": [je_sales_rev.number, je_sales_ded.number, je_sales_cogs.number],
        "cogs_amount": str(cogs_amount),
    }

    # MODULE 9: TIỀN MẶT (Phiếu thu tiền mặt FPT 250tr + Phiếu chi vận chuyển bán hàng 15tr)
    acc_6417 = find_account(company, ["6417", "6418", "641"])
    je_cash_in = create_posted_je(
        company, period, primary_user, "PT-001", date(2026, 6, 20),
        "Thu tiền mặt khách hàng thanh toán đợt 1 từ Công ty CP Tập đoàn FPT",
        [
            {"account": acc_1111, "debit": Decimal("250000000")},
            {"account": acc_131, "credit": Decimal("250000000"), "party": cust_parties["KH001"]},
        ],
        source_module="CASH_BANK", branch=branch,
    )
    je_cash_out = create_posted_je(
        company, period, primary_user, "PC-001", date(2026, 6, 21),
        "Chi tiền mặt vận chuyển, lắp đặt & nghiệm thu Tủ điều khiển SmartBox Pro tại FPT",
        [
            {"account": acc_6417, "debit": Decimal("15000000")},
            {"account": acc_1111, "credit": Decimal("15000000")},
        ],
        source_module="CASH_BANK", branch=branch,
    )
    if cash_fund:
        CashTransaction.objects.update_or_create(
            company=company,
            number="PT-001",
            defaults={
                "fund": cash_fund,
                "transaction_type": "RECEIPT",
                "business_type": "CUSTOMER_RECEIPT",
                "transaction_date": date(2026, 6, 20),
                "party": cust_parties["KH001"],
                "payer_payee": "Công ty Cổ phần Tập đoàn FPT",
                "currency": vnd,
                "amount": Decimal("250000000"),
                "exchange_rate": Decimal("1"),
                "base_amount": Decimal("250000000"),
                "description": "Thu tiền mặt khách hàng thanh toán đợt 1 từ Công ty CP Tập đoàn FPT",
                "status": CashTxStatus.POSTED,
                "balance_applied": True,
                "gl_status": GlStatus.POSTED,
                "gl_reference": je_cash_in.number,
                "created_by": primary_user,
                "cashier": primary_user,
                "posted_at": timezone.now(),
                "receipt_details": {
                    "partner_code": "KH001",
                    "partner_name": "Công ty Cổ phần Tập đoàn FPT",
                    "address": "Số 10 Phố Phạm Văn Bạch, Quận Cầu Giấy, TP. Hà Nội",
                    "lines": [{"description": "Thu tiền mặt thanh toán đợt 1 từ Tập đoàn FPT", "debit": "1111", "credit": "131", "amount": 250000000, "partnerCode": "KH001", "partnerName": "Công ty Cổ phần Tập đoàn FPT"}],
                },
            },
        )
        CashTransaction.objects.update_or_create(
            company=company,
            number="PC-001",
            defaults={
                "fund": cash_fund,
                "transaction_type": "PAYMENT",
                "business_type": "OTHER_PAYMENT",
                "transaction_date": date(2026, 6, 21),
                "party": supp_parties["NCC002"],
                "payer_payee": "Công ty TNHH Thiết bị Công nghiệp Việt Nhật",
                "currency": vnd,
                "amount": Decimal("15000000"),
                "exchange_rate": Decimal("1"),
                "base_amount": Decimal("15000000"),
                "description": "Chi tiền mặt vận chuyển, lắp đặt & nghiệm thu Tủ điều khiển SmartBox Pro tại FPT",
                "status": CashTxStatus.POSTED,
                "balance_applied": True,
                "gl_status": GlStatus.POSTED,
                "gl_reference": je_cash_out.number,
                "created_by": primary_user,
                "cashier": primary_user,
                "posted_at": timezone.now(),
                "receipt_details": {
                    "partner_code": "NCC002",
                    "partner_name": "Công ty TNHH Thiết bị Công nghiệp Việt Nhật",
                    "lines": [{"description": "Chi phí vận chuyển lắp đặt SmartBox Pro", "debit": "6417", "credit": "1111", "amount": 15000000, "partnerCode": "NCC002"}],
                },
            },
        )
    report["modules"]["09_cash"] = {
        "status": "PASS",
        "vouchers": [je_cash_in.number, je_cash_out.number],
    }

    # MODULE 10: TIỀN GỬI NGÂN HÀNG (Báo có thu tiền FPT 450tr qua VCB + Ủy nhiệm chi trả nợ Hòa Phát 200tr)
    je_bank_in = create_posted_je(
        company, period, primary_user, "BC-001", date(2026, 6, 22),
        "Báo Có Vietcombank: Công ty CP Tập đoàn FPT chuyển khoản thanh toán đợt 2",
        [
            {"account": acc_1121, "debit": Decimal("450000000")},
            {"account": acc_131, "credit": Decimal("450000000"), "party": cust_parties["KH001"]},
        ],
        source_module="CASH_BANK", branch=branch,
    )
    je_bank_out = create_posted_je(
        company, period, primary_user, "UNC-001", date(2026, 6, 23),
        "Ủy nhiệm chi Vietcombank: Thanh toán tiền mua thép tấm & PLC cho Tập đoàn Hòa Phát",
        [
            {"account": acc_331, "debit": Decimal("200000000"), "party": supp_parties["NCC001"]},
            {"account": acc_1121, "credit": Decimal("200000000")},
        ],
        source_module="CASH_BANK", branch=branch,
    )
    BankTransaction.objects.update_or_create(
        company=company,
        number="BC-001",
        defaults={
            "account": bank_profile_vcb,
            "transaction_type": "RECEIPT",
            "business_type": "CUSTOMER_RECEIPT",
            "transaction_date": date(2026, 6, 22),
            "value_date": date(2026, 6, 22),
            "party": cust_parties["KH001"],
            "counterparty_name": "Công ty Cổ phần Tập đoàn FPT",
            "counterparty_account": "0011008889999",
            "currency": vnd,
            "amount": Decimal("450000000"),
            "exchange_rate": Decimal("1"),
            "base_amount": Decimal("450000000"),
            "description": "Báo Có Vietcombank: Công ty CP Tập đoàn FPT chuyển khoản thanh toán đợt 2",
            "status": BankTxStatus.POSTED,
            "balance_applied": True,
            "gl_status": "POSTED",
            "gl_reference": je_bank_in.number,
            "created_by": primary_user,
            "posted_at": timezone.now(),
        },
    )
    BankTransaction.objects.update_or_create(
        company=company,
        number="UNC-001",
        defaults={
            "account": bank_profile_vcb,
            "transaction_type": "PAYMENT",
            "business_type": "SUPPLIER_PAYMENT",
            "transaction_date": date(2026, 6, 23),
            "value_date": date(2026, 6, 23),
            "party": supp_parties["NCC001"],
            "counterparty_name": "Công ty Cổ phần Tập đoàn Hòa Phát",
            "counterparty_account": "1903668899001",
            "currency": vnd,
            "amount": Decimal("200000000"),
            "exchange_rate": Decimal("1"),
            "base_amount": Decimal("200000000"),
            "description": "Ủy nhiệm chi Vietcombank: Thanh toán tiền mua thép tấm & PLC cho Tập đoàn Hòa Phát",
            "status": BankTxStatus.POSTED,
            "balance_applied": True,
            "gl_status": "POSTED",
            "gl_reference": je_bank_out.number,
            "created_by": primary_user,
            "posted_at": timezone.now(),
        },
    )
    report["modules"]["10_bank"] = {
        "status": "PASS",
        "vouchers": [je_bank_in.number, je_bank_out.number],
    }

    # MODULE 11: THUẾ (Khấu trừ thuế GTGT đầu vào 35tr với thuế GTGT đầu ra 80tr)
    je_vat_offset = create_posted_je(
        company, period, primary_user, "THUE-KT-001", date(2026, 6, 30),
        "Khấu trừ thuế GTGT đầu vào (TK 1331, 1332) với thuế GTGT đầu ra phải nộp (TK 33311) kỳ 06/2026",
        [
            {"account": acc_33311, "debit": Decimal("35000000")},
            {"account": acc_1331, "credit": Decimal("23000000")},
            {"account": acc_1332, "credit": Decimal("12000000")},
        ],
        source_module="TAX", branch=branch,
    )
    report["modules"]["11_tax"] = {
        "status": "PASS",
        "voucher": je_vat_offset.number,
        "vat_input_deducted": "35,000,000",
        "vat_output_total": "80,000,000",
        "vat_payable_remaining": "45,000,000",
    }

    # MODULE 12: TỔNG HỢP, KẾT CHUYỂN LÃI LỖ, BCTC (B01, B02, B03, B09) & BÁO CÁO QUẢN TRỊ
    close_payload = {"period": str(period.pk), "posting_date": "2026-06-30", "auto_post": True}
    req_close = DummyRequest(primary_user, data=close_payload, company=company)
    close_run = create_profit_loss_closing_voucher(company, close_payload, request=req_close)
    if close_run.entry_id and close_run.entry.status != "POSTED":
        post_journal(close_run.entry, req_close)
        close_run.refresh_from_db()

    fs_payload = {
        "report_group": "ANNUAL_BCTC",
        "going_concern_assumption": "CONTINUOUS",
        "fiscal_year": 2026,
        "from_date": "2026-01-01",
        "to_date": "2026-12-31",
    }
    req_fs = DummyRequest(primary_user, data=fs_payload, company=company)
    batch = generate_financial_statements(company, fs_payload, request=req_fs)
    fs_res = FinancialStatementBatchSerializer(batch).data
    reports_map = {r["form_code"][:3]: r for r in fs_res["reports"]}
    b01_rows = {r["indicator_code"]: r["current_amount"] for r in reports_map["B01"]["lines"]}
    b02_rows = {r["indicator_code"]: r["current_amount"] for r in reports_map["B02"]["lines"]}
    b03_rows = {r["indicator_code"]: r["current_amount"] for r in reports_map["B03"]["lines"]}

    _, mgmt_totals, _ = management_report(
        company=company,
        date_from=date(2026, 1, 1),
        date_to=date(2026, 12, 31),
        parameters={},
    )

    total_assets = Decimal(str(b01_rows.get("270", "0")))
    total_resources = Decimal(str(b01_rows.get("440", "0")))
    is_b01_balanced = (total_assets == total_resources) and total_assets > 0

    report["modules"]["12_general_ledger_bctc_dashboard"] = {
        "status": "PASS" if is_b01_balanced else "FAIL",
        "closing_run_status": close_run.status,
        "closing_entry_number": close_run.entry.number if close_run.entry_id else None,
        "b01_total_assets_270": str(total_assets),
        "b01_total_resources_440": str(total_resources),
        "b01_is_balanced": is_b01_balanced,
        "b01_cash_110": str(b01_rows.get("110")),
        "b01_receivables_130": str(b01_rows.get("130")),
        "b01_inventories_140": str(b01_rows.get("140")),
        "b01_Biological_Assets_210": str(b01_rows.get("210")),
        "b01_fixed_assets_220": str(b01_rows.get("220")),
        "b02_gross_revenue_01": str(b02_rows.get("01")),
        "b02_revenue_deduction_02": str(b02_rows.get("02")),
        "b02_net_revenue_10": str(b02_rows.get("10")),
        "b02_cogs_11": str(b02_rows.get("11")),
        "b02_gross_profit_20": str(b02_rows.get("20")),
        "b02_selling_expense_25": str(b02_rows.get("25")),
        "b02_admin_expense_26": str(b02_rows.get("26")),
        "b02_net_profit_after_tax_60": str(b02_rows.get("60")),
        "b03_closing_cash_70": str(b03_rows.get("70")),
        "accounting_regime_in_notes": fs_res.get("notes_general_info", {}).get("accounting_regime"),
        "management_report_totals": {k: str(v) for k, v in mgmt_totals.items()},
    }

    print("=== TUNG_TIMO_E2E_RESULT_START ===")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print("=== TUNG_TIMO_E2E_RESULT_END ===")


if __name__ == "__main__":
    run_seed()
