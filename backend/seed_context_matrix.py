# -*- coding: utf-8 -*-
import calendar
import os
from datetime import date
from decimal import Decimal

import django
from django.db import transaction
from django.utils import timezone

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from bank_management.models import (
    AccountProfile as BankAccountProfile,
    BankTransaction,
    TransactionStatus as BankTxStatus,
)
from cash_management.models import CashFund, CashTransaction, GlStatus, TransactionStatus as CashTxStatus
from common_services.models import CoreCompanySetting, FiscalPeriod, FiscalPeriodStatus, FiscalYear, FiscalYearStatus
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from iam.models import UserAccount
from master_data.models import Bank, CompanyBankAccount, Currency, Party, PartyRole
from organization.models import Branch, Company, CompanyStatus
from purchases.models import GoodsPurchase
from reporting.models import DashboardCacheEntry
from sales.models import GoodsSale


def find_postable_account(company, prefixes):
    if isinstance(prefixes, str):
        prefixes = [prefixes]
    for p in prefixes:
        acc = Account.objects.filter(company=company, code=p, is_postable=True).first()
        if acc:
            return acc
        acc = Account.objects.filter(company=company, code__startswith=p, is_postable=True).order_by("code").first()
        if acc:
            return acc
        acc = Account.objects.filter(company=company, code__startswith=p).order_by("code").first()
        if acc:
            return acc
    return Account.objects.filter(company=company).order_by("code").first()


def upsert_je(company, branch, period, actor, vnd, number, pdate, desc, source_module, lines_spec):
    tot_d = sum((Decimal(str(x[1])) for x in lines_spec), Decimal("0"))
    tot_c = sum((Decimal(str(x[2])) for x in lines_spec), Decimal("0"))
    je, created = JournalEntry.objects.update_or_create(
        company=company,
        number=number,
        defaults={
            "branch": branch,
            "period": period,
            "entry_type": "SUBLEDGER" if source_module != "GL" else "MANUAL",
            "posting_date": pdate,
            "document_date": pdate,
            "description": desc,
            "source_module": source_module,
            "status": "POSTED",
            "total_debit": tot_d,
            "total_credit": tot_c,
            "created_by": actor,
            "approved_by": actor,
            "posted_by": actor,
            "posted_at": timezone.now(),
        },
    )
    if not created:
        je.lines.all().delete()
    for idx, (acc, d_val, c_val, party) in enumerate(lines_spec, 1):
        if not acc:
            continue
        JournalLine.objects.create(
            entry=je,
            line_no=idx,
            account=acc,
            debit=Decimal(str(d_val)),
            credit=Decimal(str(c_val)),
            currency=vnd,
            party=party,
            description=desc,
        )
    return je


@transaction.atomic
def seed_matrix():
    actor = (
        UserAccount.objects.filter(auth_user__email="tungtimo0808@gmail.com").first()
        or UserAccount.objects.order_by("created_at").first()
    )
    vnd = Currency.objects.filter(code="VND").first()
    bank_vcb, _ = Bank.objects.get_or_create(
        code="VCB",
        defaults={
            "name": "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
            "swift_code": "BFTVVNVX",
            "status": "ACTIVE",
        },
    )

    companies = list(
        Company.objects.filter(status=CompanyStatus.ACTIVE)
        .exclude(code__startswith="DN_AUD")
        .exclude(code__startswith="SOVIET")
        .exclude(code__startswith="DNMOI")
        .order_by("code", "name")
    )
    year_multipliers = {
        2024: Decimal("0.58"),
        2025: Decimal("0.83"),
        2026: Decimal("1.15"),
    }

    for c_idx, company in enumerate(companies):
        c_mult = Decimal("0.82") + (Decimal(str(c_idx)) * Decimal("0.11"))
        short_tag = (company.code or f"C{c_idx+1}")[:6].upper()
        print(f"[*] Seeding full context matrix for {company.name} ({short_tag}, mult={c_mult})...")

        # Ensure start_date allows 2024, 2025, 2026
        if hasattr(company, "start_date") and (not company.start_date or company.start_date > date(2024, 1, 1)):
            company.start_date = date(2024, 1, 1)
            company.save(update_fields=["start_date"])
        setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
        cfg = dict(setting.configuration or {})
        cfg["accounting_start_date"] = "2024-01-01"
        setting.configuration = cfg
        setting.save(update_fields=["configuration", "updated_at"])

        # Remove old identical 2024/2025 placeholder JEs if present
        old_jes = JournalEntry.objects.filter(
            company=company,
            number__regex=r"^(GL-202[45]-|OPEN-202[45]-)",
        )
        for oje in old_jes:
            oje.lines.all().delete()
        old_jes.delete()

        # Branches: Head Office + Chi nhánh TP. Hồ Chí Minh
        ho_branch = (
            Branch.objects.filter(company=company, is_head_office=True).first()
            or Branch.objects.filter(company=company).order_by("created_at").first()
        )
        if not ho_branch:
            ho_branch = Branch.objects.create(
                company=company,
                code="CN-HO",
                name=f"Trụ sở chính - {company.name}",
                tax_code=company.tax_code,
                address=company.address or "Hà Nội",
                is_head_office=True,
                status="ACTIVE",
            )
        else:
            ho_branch.is_head_office = True
            ho_branch.status = "ACTIVE"
            ho_branch.save(update_fields=["is_head_office", "status"])

        hcm_branch = (
            Branch.objects.filter(company=company, is_head_office=False).first()
            or Branch.objects.filter(company=company, code="CN-HCM").first()
        )
        if not hcm_branch:
            hcm_branch = Branch.objects.create(
                company=company,
                code="CN-HCM",
                name=f"Chi nhánh TP. Hồ Chí Minh - {company.name}",
                tax_code=f"{company.tax_code}-001"[:20],
                address="Tầng 12, Bitexco Financial Tower, Quận 1, TP. Hồ Chí Minh",
                is_head_office=False,
                status="ACTIVE",
            )
        else:
            hcm_branch.status = "ACTIVE"
            hcm_branch.save(update_fields=["status"])

        # Accounts
        acc_1111 = find_postable_account(company, ["1111", "111"])
        acc_1121 = find_postable_account(company, ["1121", "112"])
        acc_131 = find_postable_account(company, ["131"])
        acc_1331 = find_postable_account(company, ["1331", "133"])
        acc_156 = find_postable_account(company, ["1561", "156", "152"])
        acc_331 = find_postable_account(company, ["331"])
        acc_3331 = find_postable_account(company, ["33311", "3331", "333"])
        acc_4111 = find_postable_account(company, ["4111", "411"])
        acc_5111 = find_postable_account(company, ["5111", "511"])
        acc_632 = find_postable_account(company, ["632"])
        acc_641 = find_postable_account(company, ["6417", "6418", "641", "642"])
        acc_642 = find_postable_account(company, ["6422", "6427", "642"])

        # Funds for HO and HCM
        ho_fund = CashFund.objects.filter(company=company, branch=ho_branch).first()
        if not ho_fund:
            ho_fund = CashFund.objects.filter(company=company, branch__isnull=True).first()
            if ho_fund:
                ho_fund.branch = ho_branch
                ho_fund.save(update_fields=["branch"])
            else:
                ho_fund = CashFund.objects.create(
                    company=company,
                    branch=ho_branch,
                    code=f"QTM-HO-{short_tag}",
                    name="Quỹ tiền mặt Trụ sở chính (VND)",
                    currency=vnd,
                    gl_account=acc_1111,
                    balance=Decimal("680000000") * c_mult,
                    status="ACTIVE",
                )

        hcm_fund = CashFund.objects.filter(company=company, branch=hcm_branch).first()
        if not hcm_fund:
            hcm_fund = CashFund.objects.create(
                company=company,
                branch=hcm_branch,
                code=f"QTM-HCM-{short_tag}",
                name="Quỹ tiền mặt Chi nhánh TP.HCM (VND)",
                currency=vnd,
                gl_account=acc_1111,
                balance=Decimal("240000000") * c_mult,
                status="ACTIVE",
            )

        # Bank Accounts & Profiles for HO and HCM
        ho_bank_cba = CompanyBankAccount.objects.filter(company=company, branch=ho_branch).first()
        if not ho_bank_cba:
            ho_bank_cba = CompanyBankAccount.objects.filter(company=company).first()
            if ho_bank_cba:
                ho_bank_cba.branch = ho_branch
                ho_bank_cba.save(update_fields=["branch"])
            else:
                ho_bank_cba = CompanyBankAccount.objects.create(
                    company=company,
                    branch=ho_branch,
                    code=f"VCB-HO-{short_tag}",
                    account_number=f"001100{c_idx+1}889900",
                    account_name=company.name,
                    bank=bank_vcb,
                    bank_branch="Sở Giao Dịch Hà Nội",
                    currency=vnd,
                    gl_account=acc_1121,
                    status="ACTIVE",
                )
        ho_bank_prof, _ = BankAccountProfile.objects.get_or_create(
            company=company,
            account=ho_bank_cba,
            defaults={"balance": Decimal("1850000000") * c_mult},
        )

        hcm_bank_cba = CompanyBankAccount.objects.filter(company=company, branch=hcm_branch).first()
        if not hcm_bank_cba:
            hcm_bank_cba = CompanyBankAccount.objects.create(
                company=company,
                branch=hcm_branch,
                code=f"VCB-HCM-{short_tag}",
                account_number=f"007100{c_idx+1}667788",
                account_name=f"{company.name} - CN TP.HCM",
                bank=bank_vcb,
                bank_branch="Chi nhánh TP.HCM",
                currency=vnd,
                gl_account=acc_1121,
                status="ACTIVE",
            )
        hcm_bank_prof, _ = BankAccountProfile.objects.get_or_create(
            company=company,
            account=hcm_bank_cba,
            defaults={"balance": Decimal("720000000") * c_mult},
        )

        # Parties (Customer + Supplier)
        cust_ho, _ = Party.objects.get_or_create(
            company=company,
            code="KH-HO-01",
            defaults={
                "name": "Công ty Cổ phần Tập đoàn Công nghệ Á Châu (Miền Bắc)",
                "party_type": "CUSTOMER",
                "branch": ho_branch,
                "status": "ACTIVE",
            },
        )
        PartyRole.objects.get_or_create(party=cust_ho, role_type="CUSTOMER", defaults={"active_from": date(2024, 1, 1)})

        cust_hcm, _ = Party.objects.get_or_create(
            company=company,
            code="KH-HCM-01",
            defaults={
                "name": "Công ty TNHH Giải pháp Số Sài Gòn (Miền Nam)",
                "party_type": "CUSTOMER",
                "branch": hcm_branch,
                "status": "ACTIVE",
            },
        )
        PartyRole.objects.get_or_create(party=cust_hcm, role_type="CUSTOMER", defaults={"active_from": date(2024, 1, 1)})

        supp_ho, _ = Party.objects.get_or_create(
            company=company,
            code="NCC-HO-01",
            defaults={
                "name": "Tổng Công ty Thiết bị Công nghiệp Miền Bắc",
                "party_type": "VENDOR",
                "branch": ho_branch,
                "status": "ACTIVE",
            },
        )
        PartyRole.objects.get_or_create(party=supp_ho, role_type="VENDOR", defaults={"active_from": date(2024, 1, 1)})

        supp_hcm, _ = Party.objects.get_or_create(
            company=company,
            code="NCC-HCM-01",
            defaults={
                "name": "Công ty CP Cung ứng Vật tư Kỹ thuật Phương Nam",
                "party_type": "VENDOR",
                "branch": hcm_branch,
                "status": "ACTIVE",
            },
        )
        PartyRole.objects.get_or_create(party=supp_hcm, role_type="VENDOR", defaults={"active_from": date(2024, 1, 1)})

        # Seed Fiscal Years & Accounting Periods for 2024, 2025, 2026
        for yr in (2024, 2025, 2026):
            y_mult = year_multipliers[yr]
            fy, _ = FiscalYear.objects.get_or_create(
                company=company,
                code=f"FY{yr}",
                defaults={
                    "name": f"Năm tài chính {yr}",
                    "start_date": date(yr, 1, 1),
                    "end_date": date(yr, 12, 31),
                    "status": FiscalYearStatus.ACTIVE if yr == 2026 else FiscalYearStatus.CLOSED,
                    "created_by": actor,
                },
            )
            periods_by_month = {}
            for m in range(1, 13):
                last_day = calendar.monthrange(yr, m)[1]
                FiscalPeriod.objects.get_or_create(
                    company=company,
                    fiscal_year=fy,
                    period_number=m,
                    defaults={
                        "code": f"{yr}-{m:02d}",
                        "name": f"Tháng {m:02d}/{yr}",
                        "start_date": date(yr, m, 1),
                        "end_date": date(yr, m, last_day),
                        "status": FiscalPeriodStatus.OPEN,
                    },
                )
                ap, _ = AccountingPeriod.objects.get_or_create(
                    company=company,
                    fiscal_year=yr,
                    period_number=m,
                    defaults={
                        "code": f"{yr}-{m:02d}",
                        "start_date": date(yr, m, 1),
                        "end_date": date(yr, m, last_day),
                        "status": "OPEN",
                    },
                )
                periods_by_month[m] = ap

            # Opening Balance on Jan 1 for 2024 and 2025 (and 2026 if none exists)
            open_num = f"OPEN-{yr}-CTX"
            if yr in (2024, 2025) or not JournalEntry.objects.filter(company=company, entry_type="OPENING", posting_date__year=yr).exists():
                open_cash = (Decimal("420000000") * c_mult * y_mult).quantize(Decimal("1"))
                open_bank = (Decimal("1350000000") * c_mult * y_mult).quantize(Decimal("1"))
                open_cap = open_cash + open_bank
                upsert_je(
                    company=company,
                    branch=ho_branch,
                    period=periods_by_month[1],
                    actor=actor,
                    vnd=vnd,
                    number=open_num,
                    pdate=date(yr, 1, 1),
                    desc=f"Số dư đầu kỳ năm tài chính {yr} - {company.name}",
                    source_module="GL",
                    lines_spec=[
                        (acc_1111, open_cash, 0, None),
                        (acc_1121, open_bank, 0, None),
                        (acc_4111, 0, open_cap, None),
                    ],
                )

            # Seed monthly transactions for all 12 months (1..12) so every K1..K12 has distinct data!
            for m in range(1, 13):
                ap = periods_by_month[m]
                m_mult = Decimal("0.72") + (Decimal(str(m)) * Decimal("0.045"))
                factor = c_mult * y_mult * m_mult

                pdate_ho = date(yr, m, min(12 + (m % 5), 27))
                pdate_hcm = date(yr, m, min(15 + (m % 6), 28))
                pdate_qt = date(yr, m, min(20 + (m % 4), 28))
                ym_tag = f"{yr}{m:02d}"

                # --- 1. HEAD OFFICE FINANCIAL BOOK (Sổ Tài chính & Thuế - Trụ sở chính) ---
                rev_ho = (Decimal("260000000") * factor).quantize(Decimal("1000"))
                vat_rev_ho = (rev_ho * Decimal("0.10")).quantize(Decimal("1000"))
                tot_rev_ho = rev_ho + vat_rev_ho
                cogs_ho = (rev_ho * Decimal("0.62")).quantize(Decimal("1000"))

                pur_ho = (Decimal("155000000") * factor).quantize(Decimal("1000"))
                vat_pur_ho = (pur_ho * Decimal("0.10")).quantize(Decimal("1000"))
                tot_pur_ho = pur_ho + vat_pur_ho

                cash_in_ho = (Decimal("95000000") * factor).quantize(Decimal("1000"))
                cash_out_ho = (Decimal("24000000") * factor).quantize(Decimal("1000"))
                bank_in_ho = (Decimal("185000000") * factor).quantize(Decimal("1000"))
                bank_out_ho = (Decimal("112000000") * factor).quantize(Decimal("1000"))

                je_bh_ho = upsert_je(
                    company, ho_branch, ap, actor, vnd,
                    f"BH-HO-{ym_tag}", pdate_ho,
                    f"Doanh thu bán hàng & giải pháp kỳ T{m:02d}/{yr} (Trụ sở chính)",
                    "SAL",
                    [
                        (acc_131, tot_rev_ho, 0, cust_ho),
                        (acc_5111, 0, rev_ho, cust_ho),
                        (acc_3331, 0, vat_rev_ho, cust_ho),
                        (acc_632, cogs_ho, 0, None),
                        (acc_156, 0, cogs_ho, None),
                    ],
                )
                GoodsSale.objects.update_or_create(
                    company=company,
                    number=f"BH-HO-{ym_tag}",
                    defaults={
                        "branch": ho_branch,
                        "document_date": pdate_ho,
                        "posting_date": pdate_ho,
                        "customer": cust_ho,
                        "currency": vnd,
                        "exchange_rate": Decimal("1"),
                        "subtotal": rev_ho,
                        "discount_amount": Decimal("0"),
                        "tax_amount": vat_rev_ho,
                        "total_amount": tot_rev_ho,
                        "status": "POSTED",
                        "payment_type": "UNPAID",
                        "inventory_handling": "NO_INVENTORY",
                        "journal_entry": je_bh_ho,
                        "description": f"Bán hàng hóa & thiết bị theo hợp đồng kỳ T{m:02d}/{yr} (Trụ sở chính)",
                        "created_by": actor,
                        "posted_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

                je_mh_ho = upsert_je(
                    company, ho_branch, ap, actor, vnd,
                    f"MH-HO-{ym_tag}", pdate_ho,
                    f"Mua hàng hóa & vật tư nhập kho kỳ T{m:02d}/{yr} (Trụ sở chính)",
                    "PUR",
                    [
                        (acc_156, pur_ho, 0, supp_ho),
                        (acc_1331, vat_pur_ho, 0, supp_ho),
                        (acc_331, 0, tot_pur_ho, supp_ho),
                    ],
                )
                GoodsPurchase.objects.update_or_create(
                    company=company,
                    number=f"MH-HO-{ym_tag}",
                    defaults={
                        "branch": ho_branch,
                        "document_date": pdate_ho,
                        "posting_date": pdate_ho,
                        "purchase_type": "WAREHOUSE",
                        "supplier": supp_ho,
                        "payment_type": "UNPAID",
                        "subtotal": pur_ho,
                        "discount_amount": Decimal("0"),
                        "tax_amount": vat_pur_ho,
                        "total_amount": tot_pur_ho,
                        "status": "POSTED",
                        "journal_entry": je_mh_ho,
                        "notes": f"Mua hàng hóa bổ sung tồn kho kỳ T{m:02d}/{yr} (Trụ sở chính)",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

                CashTransaction.objects.update_or_create(
                    company=company,
                    number=f"PT-HO-{ym_tag}",
                    defaults={
                        "fund": ho_fund,
                        "transaction_type": "RECEIPT",
                        "business_type": "CUSTOMER_RECEIPT",
                        "transaction_date": pdate_ho,
                        "party": cust_ho,
                        "payer_payee": cust_ho.name,
                        "currency": vnd,
                        "amount": cash_in_ho,
                        "exchange_rate": Decimal("1"),
                        "base_amount": cash_in_ho,
                        "description": f"Thu tiền mặt thanh toán công nợ khách hàng kỳ T{m:02d}/{yr} (Trụ sở chính)",
                        "status": CashTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": GlStatus.POSTED,
                        "created_by": actor,
                        "cashier": actor,
                        "posted_at": timezone.now(),
                    },
                )
                CashTransaction.objects.update_or_create(
                    company=company,
                    number=f"PC-HO-{ym_tag}",
                    defaults={
                        "fund": ho_fund,
                        "transaction_type": "PAYMENT",
                        "business_type": "OTHER_PAYMENT",
                        "transaction_date": pdate_ho,
                        "party": supp_ho,
                        "payer_payee": supp_ho.name,
                        "currency": vnd,
                        "amount": cash_out_ho,
                        "exchange_rate": Decimal("1"),
                        "base_amount": cash_out_ho,
                        "description": f"Chi tiền mặt vận hành & hành chính kỳ T{m:02d}/{yr} (Trụ sở chính)",
                        "status": CashTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": GlStatus.POSTED,
                        "created_by": actor,
                        "cashier": actor,
                        "posted_at": timezone.now(),
                    },
                )

                BankTransaction.objects.update_or_create(
                    company=company,
                    number=f"BC-HO-{ym_tag}",
                    defaults={
                        "account": ho_bank_prof,
                        "transaction_type": "RECEIPT",
                        "business_type": "CUSTOMER_RECEIPT",
                        "transaction_date": pdate_ho,
                        "value_date": pdate_ho,
                        "party": cust_ho,
                        "counterparty_name": cust_ho.name,
                        "counterparty_account": "0011009988776",
                        "currency": vnd,
                        "amount": bank_in_ho,
                        "exchange_rate": Decimal("1"),
                        "base_amount": bank_in_ho,
                        "description": f"Báo Có ngân hàng thu tiền hàng kỳ T{m:02d}/{yr} (Trụ sở chính)",
                        "status": BankTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": "POSTED",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )
                BankTransaction.objects.update_or_create(
                    company=company,
                    number=f"UNC-HO-{ym_tag}",
                    defaults={
                        "account": ho_bank_prof,
                        "transaction_type": "PAYMENT",
                        "business_type": "SUPPLIER_PAYMENT",
                        "transaction_date": pdate_ho,
                        "value_date": pdate_ho,
                        "party": supp_ho,
                        "counterparty_name": supp_ho.name,
                        "counterparty_account": "1903668899112",
                        "currency": vnd,
                        "amount": bank_out_ho,
                        "exchange_rate": Decimal("1"),
                        "base_amount": bank_out_ho,
                        "description": f"Ủy nhiệm chi thanh toán nhà cung cấp kỳ T{m:02d}/{yr} (Trụ sở chính)",
                        "status": BankTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": "POSTED",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

                # --- 2. HCM BRANCH FINANCIAL BOOK (Chi nhánh TP. Hồ Chí Minh) ---
                rev_hcm = (Decimal("115000000") * factor).quantize(Decimal("1000"))
                vat_rev_hcm = (rev_hcm * Decimal("0.10")).quantize(Decimal("1000"))
                tot_rev_hcm = rev_hcm + vat_rev_hcm
                cogs_hcm = (rev_hcm * Decimal("0.60")).quantize(Decimal("1000"))

                pur_hcm = (Decimal("68000000") * factor).quantize(Decimal("1000"))
                vat_pur_hcm = (pur_hcm * Decimal("0.10")).quantize(Decimal("1000"))
                tot_pur_hcm = pur_hcm + vat_pur_hcm

                cash_in_hcm = (Decimal("42000000") * factor).quantize(Decimal("1000"))
                cash_out_hcm = (Decimal("14000000") * factor).quantize(Decimal("1000"))
                bank_in_hcm = (Decimal("86000000") * factor).quantize(Decimal("1000"))
                bank_out_hcm = (Decimal("49000000") * factor).quantize(Decimal("1000"))

                je_bh_hcm = upsert_je(
                    company, hcm_branch, ap, actor, vnd,
                    f"BH-HCM-{ym_tag}", pdate_hcm,
                    f"Doanh thu bán hàng khu vực miền Nam kỳ T{m:02d}/{yr} (CN TP.HCM)",
                    "SAL",
                    [
                        (acc_131, tot_rev_hcm, 0, cust_hcm),
                        (acc_5111, 0, rev_hcm, cust_hcm),
                        (acc_3331, 0, vat_rev_hcm, cust_hcm),
                        (acc_632, cogs_hcm, 0, None),
                        (acc_156, 0, cogs_hcm, None),
                    ],
                )
                GoodsSale.objects.update_or_create(
                    company=company,
                    number=f"BH-HCM-{ym_tag}",
                    defaults={
                        "branch": hcm_branch,
                        "document_date": pdate_hcm,
                        "posting_date": pdate_hcm,
                        "customer": cust_hcm,
                        "currency": vnd,
                        "exchange_rate": Decimal("1"),
                        "subtotal": rev_hcm,
                        "discount_amount": Decimal("0"),
                        "tax_amount": vat_rev_hcm,
                        "total_amount": tot_rev_hcm,
                        "status": "POSTED",
                        "payment_type": "UNPAID",
                        "inventory_handling": "NO_INVENTORY",
                        "journal_entry": je_bh_hcm,
                        "description": f"Bán hàng hóa & dịch vụ khách hàng miền Nam kỳ T{m:02d}/{yr} (CN TP.HCM)",
                        "created_by": actor,
                        "posted_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

                je_mh_hcm = upsert_je(
                    company, hcm_branch, ap, actor, vnd,
                    f"MH-HCM-{ym_tag}", pdate_hcm,
                    f"Mua hàng hóa nhập kho miền Nam kỳ T{m:02d}/{yr} (CN TP.HCM)",
                    "PUR",
                    [
                        (acc_156, pur_hcm, 0, supp_hcm),
                        (acc_1331, vat_pur_hcm, 0, supp_hcm),
                        (acc_331, 0, tot_pur_hcm, supp_hcm),
                    ],
                )
                GoodsPurchase.objects.update_or_create(
                    company=company,
                    number=f"MH-HCM-{ym_tag}",
                    defaults={
                        "branch": hcm_branch,
                        "document_date": pdate_hcm,
                        "posting_date": pdate_hcm,
                        "purchase_type": "WAREHOUSE",
                        "supplier": supp_hcm,
                        "payment_type": "UNPAID",
                        "subtotal": pur_hcm,
                        "discount_amount": Decimal("0"),
                        "tax_amount": vat_pur_hcm,
                        "total_amount": tot_pur_hcm,
                        "status": "POSTED",
                        "journal_entry": je_mh_hcm,
                        "notes": f"Mua hàng hóa cung ứng chi nhánh TP.HCM kỳ T{m:02d}/{yr}",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

                CashTransaction.objects.update_or_create(
                    company=company,
                    number=f"PT-HCM-{ym_tag}",
                    defaults={
                        "fund": hcm_fund,
                        "transaction_type": "RECEIPT",
                        "business_type": "CUSTOMER_RECEIPT",
                        "transaction_date": pdate_hcm,
                        "party": cust_hcm,
                        "payer_payee": cust_hcm.name,
                        "currency": vnd,
                        "amount": cash_in_hcm,
                        "exchange_rate": Decimal("1"),
                        "base_amount": cash_in_hcm,
                        "description": f"Thu tiền mặt khách hàng miền Nam kỳ T{m:02d}/{yr} (CN TP.HCM)",
                        "status": CashTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": GlStatus.POSTED,
                        "created_by": actor,
                        "cashier": actor,
                        "posted_at": timezone.now(),
                    },
                )
                CashTransaction.objects.update_or_create(
                    company=company,
                    number=f"PC-HCM-{ym_tag}",
                    defaults={
                        "fund": hcm_fund,
                        "transaction_type": "PAYMENT",
                        "business_type": "OTHER_PAYMENT",
                        "transaction_date": pdate_hcm,
                        "party": supp_hcm,
                        "payer_payee": supp_hcm.name,
                        "currency": vnd,
                        "amount": cash_out_hcm,
                        "exchange_rate": Decimal("1"),
                        "base_amount": cash_out_hcm,
                        "description": f"Chi tiền mặt chi phí tiếp vận CN TP.HCM kỳ T{m:02d}/{yr}",
                        "status": CashTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": GlStatus.POSTED,
                        "created_by": actor,
                        "cashier": actor,
                        "posted_at": timezone.now(),
                    },
                )

                BankTransaction.objects.update_or_create(
                    company=company,
                    number=f"BC-HCM-{ym_tag}",
                    defaults={
                        "account": hcm_bank_prof,
                        "transaction_type": "RECEIPT",
                        "business_type": "CUSTOMER_RECEIPT",
                        "transaction_date": pdate_hcm,
                        "value_date": pdate_hcm,
                        "party": cust_hcm,
                        "counterparty_name": cust_hcm.name,
                        "counterparty_account": "0071005544332",
                        "currency": vnd,
                        "amount": bank_in_hcm,
                        "exchange_rate": Decimal("1"),
                        "base_amount": bank_in_hcm,
                        "description": f"Báo Có ngân hàng thu tiền khách hàng CN TP.HCM kỳ T{m:02d}/{yr}",
                        "status": BankTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": "POSTED",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )
                BankTransaction.objects.update_or_create(
                    company=company,
                    number=f"UNC-HCM-{ym_tag}",
                    defaults={
                        "account": hcm_bank_prof,
                        "transaction_type": "PAYMENT",
                        "business_type": "SUPPLIER_PAYMENT",
                        "transaction_date": pdate_hcm,
                        "value_date": pdate_hcm,
                        "party": supp_hcm,
                        "counterparty_name": supp_hcm.name,
                        "counterparty_account": "0071008877665",
                        "currency": vnd,
                        "amount": bank_out_hcm,
                        "exchange_rate": Decimal("1"),
                        "base_amount": bank_out_hcm,
                        "description": f"Ủy nhiệm chi thanh toán nhà cung cấp CN TP.HCM kỳ T{m:02d}/{yr}",
                        "status": BankTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": "POSTED",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

                # --- 3. INTERNAL MANAGEMENT BOOK VOUCHERS (QT- Sổ Quản trị nội bộ) ---
                qt_rev = (Decimal("64000000") * factor).quantize(Decimal("1000"))
                qt_pur = (Decimal("38000000") * factor).quantize(Decimal("1000"))
                qt_cash_in = (Decimal("29000000") * factor).quantize(Decimal("1000"))
                qt_cash_out = (Decimal("11000000") * factor).quantize(Decimal("1000"))
                qt_bank_in = (Decimal("52000000") * factor).quantize(Decimal("1000"))
                qt_bank_out = (Decimal("21000000") * factor).quantize(Decimal("1000"))

                je_qt_bh = upsert_je(
                    company, ho_branch, ap, actor, vnd,
                    f"QT-BH-{ym_tag}", pdate_qt,
                    f"[Sổ Quản trị] Ghi nhận doanh thu điều hành nội bộ kỳ T{m:02d}/{yr}",
                    "SAL",
                    [
                        (acc_131, qt_rev, 0, cust_ho),
                        (acc_5111, 0, qt_rev, cust_ho),
                    ],
                )
                GoodsSale.objects.update_or_create(
                    company=company,
                    number=f"QT-BH-{ym_tag}",
                    defaults={
                        "branch": ho_branch,
                        "document_date": pdate_qt,
                        "posting_date": pdate_qt,
                        "customer": cust_ho,
                        "currency": vnd,
                        "exchange_rate": Decimal("1"),
                        "subtotal": qt_rev,
                        "discount_amount": Decimal("0"),
                        "tax_amount": Decimal("0"),
                        "total_amount": qt_rev,
                        "status": "POSTED",
                        "payment_type": "UNPAID",
                        "inventory_handling": "NO_INVENTORY",
                        "journal_entry": je_qt_bh,
                        "description": f"[Sổ Quản trị] Doanh thu hợp đồng tư vấn nội bộ kỳ T{m:02d}/{yr}",
                        "created_by": actor,
                        "posted_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

                je_qt_mh = upsert_je(
                    company, ho_branch, ap, actor, vnd,
                    f"QT-MH-{ym_tag}", pdate_qt,
                    f"[Sổ Quản trị] Chi phí mua ngoài & thưởng hiệu suất nội bộ kỳ T{m:02d}/{yr}",
                    "PUR",
                    [
                        (acc_642, qt_pur, 0, supp_ho),
                        (acc_331, 0, qt_pur, supp_ho),
                    ],
                )
                GoodsPurchase.objects.update_or_create(
                    company=company,
                    number=f"QT-MH-{ym_tag}",
                    defaults={
                        "branch": ho_branch,
                        "document_date": pdate_qt,
                        "posting_date": pdate_qt,
                        "purchase_type": "SERVICE",
                        "supplier": supp_ho,
                        "payment_type": "UNPAID",
                        "subtotal": qt_pur,
                        "discount_amount": Decimal("0"),
                        "tax_amount": Decimal("0"),
                        "total_amount": qt_pur,
                        "status": "POSTED",
                        "journal_entry": je_qt_mh,
                        "notes": f"[Sổ Quản trị] Mua dịch vụ phát triển thị trường nội bộ kỳ T{m:02d}/{yr}",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

                CashTransaction.objects.update_or_create(
                    company=company,
                    number=f"QT-PT-{ym_tag}",
                    defaults={
                        "fund": ho_fund,
                        "transaction_type": "RECEIPT",
                        "business_type": "CUSTOMER_RECEIPT",
                        "transaction_date": pdate_qt,
                        "party": cust_ho,
                        "payer_payee": cust_ho.name,
                        "currency": vnd,
                        "amount": qt_cash_in,
                        "exchange_rate": Decimal("1"),
                        "base_amount": qt_cash_in,
                        "description": f"[Sổ Quản trị] Thu tiền mặt hợp đồng dịch vụ nội bộ kỳ T{m:02d}/{yr}",
                        "status": CashTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": GlStatus.POSTED,
                        "created_by": actor,
                        "cashier": actor,
                        "posted_at": timezone.now(),
                    },
                )
                CashTransaction.objects.update_or_create(
                    company=company,
                    number=f"QT-PC-{ym_tag}",
                    defaults={
                        "fund": ho_fund,
                        "transaction_type": "PAYMENT",
                        "business_type": "OTHER_PAYMENT",
                        "transaction_date": pdate_qt,
                        "party": supp_ho,
                        "payer_payee": supp_ho.name,
                        "currency": vnd,
                        "amount": qt_cash_out,
                        "exchange_rate": Decimal("1"),
                        "base_amount": qt_cash_out,
                        "description": f"[Sổ Quản trị] Chi thưởng nóng & hoa hồng kinh doanh nội bộ kỳ T{m:02d}/{yr}",
                        "status": CashTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": GlStatus.POSTED,
                        "created_by": actor,
                        "cashier": actor,
                        "posted_at": timezone.now(),
                    },
                )

                BankTransaction.objects.update_or_create(
                    company=company,
                    number=f"QT-BC-{ym_tag}",
                    defaults={
                        "account": ho_bank_prof,
                        "transaction_type": "RECEIPT",
                        "business_type": "CUSTOMER_RECEIPT",
                        "transaction_date": pdate_qt,
                        "value_date": pdate_qt,
                        "party": cust_ho,
                        "counterparty_name": cust_ho.name,
                        "counterparty_account": "0011009988776",
                        "currency": vnd,
                        "amount": qt_bank_in,
                        "exchange_rate": Decimal("1"),
                        "base_amount": qt_bank_in,
                        "description": f"[Sổ Quản trị] Thu tiền gửi điều hành dự án nội bộ kỳ T{m:02d}/{yr}",
                        "status": BankTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": "POSTED",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )
                BankTransaction.objects.update_or_create(
                    company=company,
                    number=f"QT-UNC-{ym_tag}",
                    defaults={
                        "account": ho_bank_prof,
                        "transaction_type": "PAYMENT",
                        "business_type": "SUPPLIER_PAYMENT",
                        "transaction_date": pdate_qt,
                        "value_date": pdate_qt,
                        "party": supp_ho,
                        "counterparty_name": supp_ho.name,
                        "counterparty_account": "1903668899112",
                        "currency": vnd,
                        "amount": qt_bank_out,
                        "exchange_rate": Decimal("1"),
                        "base_amount": qt_bank_out,
                        "description": f"[Sổ Quản trị] Chi chuyển khoản quỹ phát triển kinh doanh nội bộ kỳ T{m:02d}/{yr}",
                        "status": BankTxStatus.POSTED,
                        "balance_applied": True,
                        "gl_status": "POSTED",
                        "created_by": actor,
                        "posted_at": timezone.now(),
                    },
                )

    DashboardCacheEntry.objects.all().delete()
    print("--> FULL CONTEXT MATRIX SEEDED & DASHBOARD CACHE CLEARED SUCCESSFULLY!")


if __name__ == "__main__":
    seed_matrix()
