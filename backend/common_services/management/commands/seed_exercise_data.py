"""
Seed real accounting exercise data according to Thông tư 99/2025/TT-BTC
From:
- "Bài tập KTM doanh nghiệp TMDV.docx"
- "Bài tập doanh nghiệp TMDV.docx"
For: CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC (MST: 109876543)
"""
import calendar
from datetime import date
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone

from organization.models import Company, CompanyStatus, BusinessType, Branch, Department, Employee
from master_data.models import (
    Currency, Bank, CompanyBankAccount, Party, PartyRole,
    Item, ItemCategory, UnitOfMeasure, Warehouse, TaxRate, PaymentTerm,
)
from iam.models import UserAccount, CompanyMembership, Role
from common_services.models import FiscalYear, FiscalPeriod, FiscalPeriodStatus, FiscalYearStatus
from common_services.setup_services import complete_company_setup
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine


class Command(BaseCommand):
    help = "Seed real accounting exercise data for Công ty TNHH Thương mại và Dịch vụ ABC theo Thông tư 99."

    def handle(self, *args, **options):
        import sys
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
        self.stdout.write("--- Bat dau khoi tao du lieu bai tap TMDV theo Thong tu 99/2025/TT-BTC ---")

        # 1. Currencies
        vnd, _ = Currency.objects.get_or_create(
            code="VND",
            defaults={"name": "Đồng Việt Nam", "numeric_code": "704", "decimal_places": 0, "is_active": True}
        )
        usd, _ = Currency.objects.get_or_create(
            code="USD",
            defaults={"name": "Đô la Mỹ", "numeric_code": "840", "decimal_places": 2, "is_active": True}
        )

        # 2. Users: ensure tanh and admin
        auth_user = User.objects.filter(is_superuser=True).first()
        if not auth_user:
            auth_user, _ = User.objects.get_or_create(
                username="tanh",
                defaults={"email": "anhtank47@gmail.com", "is_staff": True, "is_superuser": True}
            )
            auth_user.set_password("Admin@123")
            auth_user.save()

        iam_user, _ = UserAccount.objects.get_or_create(
            auth_user=auth_user,
            defaults={"email": auth_user.email or "tanh@example.com", "display_name": "Trần Anh"}
        )

        # 3. Company ABC
        company, created = Company.objects.get_or_create(
            tax_code="109876543",
            defaults={
                "code": "ABC",
                "name": "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
                "legal_name": "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
                "short_name": "ABC",
                "address": "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội",
                "province": "Hà Nội",
                "business_type": BusinessType.LLC_MULTI_MEMBER,
                "accounting_currency": vnd,
                "legal_reporting_currency": vnd,
                "accounting_regime": "TT99",
                "fiscal_year_start_month": 1,
                "status": CompanyStatus.ACTIVE,
                "created_by_user_id": iam_user.id,
            }
        )
        if not created:
            company.name = "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC"
            company.legal_name = "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC"
            company.short_name = "ABC"
            company.address = "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội"
            company.accounting_regime = "TT99"
            company.status = CompanyStatus.ACTIVE
            company.save()

        # Membership for tanh
        membership, _ = CompanyMembership.objects.get_or_create(
            company=company,
            user=iam_user,
            defaults={"membership_status": "ACTIVE", "joined_at": timezone.now(), "created_by": iam_user}
        )
        if membership.membership_status != "ACTIVE":
            membership.membership_status = "ACTIVE"
            membership.save()

        # Assign all available roles to admin user
        from iam.models import Role, UserRoleAssignment
        auth_user.is_superuser = True
        auth_user.is_staff = True
        auth_user.save()
        for r in Role.objects.all():
            UserRoleAssignment.objects.get_or_create(company_membership=membership, role=r, defaults={"assigned_by": iam_user, "status": "ACTIVE"})

        # Ensure ModuleCatalog has all WORKSPACE_MODULES
        from common_services.models import ModuleCatalog, ModuleCategory
        ModuleCatalog.objects.get_or_create(code="PAYROLL", defaults={"name": "Tiền lương", "category": ModuleCategory.OPTIONAL})
        ModuleCatalog.objects.get_or_create(code="COST", defaults={"name": "Giá thành", "category": ModuleCategory.OPTIONAL})

        # 4. Run standard setup services
        self.stdout.write("Khoi tao nen tang ke toan va he thong tai khoan TT99...")
        complete_company_setup(company, iam_user)

        # Ensure all 2026 fiscal periods are OPEN
        fy2026 = FiscalYear.objects.filter(company=company, code="FY2026").first()
        if not fy2026:
            fy2026 = FiscalYear.objects.create(
                company=company,
                code="FY2026",
                name="Năm tài chính 2026",
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
                status=FiscalYearStatus.ACTIVE,
            )
        for m in range(1, 13):
            last_day = calendar.monthrange(2026, m)[1]
            FiscalPeriod.objects.get_or_create(
                company=company,
                fiscal_year=fy2026,
                period_number=m,
                defaults={
                    "name": f"Tháng {m}/2026",
                    "start_date": date(2026, m, 1),
                    "end_date": date(2026, m, last_day),
                    "status": FiscalPeriodStatus.OPEN,
                }
            )

        # 5. Branch
        branch, _ = Branch.objects.get_or_create(
            company=company,
            code="TRUSO",
            defaults={
                "name": "Trụ sở chính - CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
                "tax_code": "109876543",
                "address": "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội",
                "is_head_office": True,
                "status": "ACTIVE",
            }
        )

        # 6. Bank & Bank Accounts
        bank_tcb, _ = Bank.objects.get_or_create(
            code="TCB",
            defaults={
                "name": "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)",
                "swift_code": "VTCBVNVX",
                "status": "ACTIVE",
            }
        )

        gl_1121 = Account.objects.filter(company=company, code="1121").first()
        gl_1122 = Account.objects.filter(company=company, code="1122").first()

        CompanyBankAccount.objects.get_or_create(
            company=company,
            account_number="123456789",
            defaults={
                "code": "TCB-VND",
                "account_name": "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC (VND)",
                "bank": bank_tcb,
                "bank_branch": "Chi nhánh Hà Nội",
                "currency": vnd,
                "gl_account": gl_1121,
                "branch": branch,
                "is_default": True,
                "allow_receipt": True,
                "allow_payment": True,
                "status": "ACTIVE",
            }
        )

        CompanyBankAccount.objects.get_or_create(
            company=company,
            account_number="987654321",
            defaults={
                "code": "TCB-USD",
                "account_name": "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC (USD)",
                "bank": bank_tcb,
                "bank_branch": "Chi nhánh Hà Nội",
                "currency": usd,
                "gl_account": gl_1122,
                "branch": branch,
                "is_default": False,
                "allow_receipt": True,
                "allow_payment": True,
                "status": "ACTIVE",
            }
        )
        CompanyBankAccount.objects.get_or_create(
            company=company,
            account_number="123456790",
            defaults={
                "code": "TCB-VND-02",
                "account_name": "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC (VND 2)",
                "bank": bank_tcb,
                "bank_branch": "Chi nhánh Hà Nội",
                "currency": vnd,
                "gl_account": gl_1121,
                "branch": branch,
                "allow_receipt": True,
                "allow_payment": True,
                "status": "ACTIVE",
            },
        )
        from bank_management.models import AccountProfile
        opening_bank_balances = {
            "123456789": Decimal("3255000000"),
            "987654321": Decimal("150000"),
        }
        for bank_account in CompanyBankAccount.objects.filter(company=company, status="ACTIVE", allow_payment=True):
            if bank_account.gl_account_id:
                profile, created = AccountProfile.objects.get_or_create(
                    account=bank_account, defaults={
                        "company": company,
                        "balance": opening_bank_balances.get(bank_account.account_number, Decimal("0")),
                    }
                )
                if (not created and profile.balance == 0 and
                        bank_account.account_number in opening_bank_balances and
                        not profile.transactions.exists()):
                    profile.balance = opening_bank_balances[bank_account.account_number]
                    profile.save(update_fields=("balance",))

        # 7. Departments
        dept_data = [
            ("BGĐ", "Ban Giám đốc"),
            ("PKT", "Phòng Kế toán"),
            ("PHCNS", "Phòng Hành chính - Nhân sự"),
            ("PKTH", "Phòng Kỹ thuật"),
        ]
        dept_map = {}
        for d_code, d_name in dept_data:
            dept, _ = Department.objects.get_or_create(
                company=company,
                code=d_code,
                defaults={"name": d_name, "branch": branch, "status": "ACTIVE"}
            )
            dept_map[d_code] = dept

        # 8. Employees
        employees_data = [
            ("TRUONGTHANHQUAN", "Trương Thanh Quân", "BGĐ", "Giám đốc"),
            ("NGUYENTHIYEN", "Nguyễn Thị Yến", "PKT", "Kế toán trưởng"),
            ("LEVANHIEU", "Lê Văn Hiếu", "PKT", "Kế toán viên"),
            ("TRANVANHUNG", "Trần Văn Hùng", "PKT", "Thủ quỹ"),
            ("HOANGBACUNG", "Hoàng Bá Cung", "PHCNS", "Nhân viên"),
            ("PHAMQUANGHOA", "Phạm Quang Hòa", "PKTH", "Nhân viên kỹ thuật"),
            ("LUONGMINHTHANH", "Lương Minh Thành", "PKTH", "Trưởng phòng"),
            ("DANGTHUAN", "Đặng Thuận", "PKTH", "Nhân viên"),
            ("BUIDUCDUNG", "Bùi Đức Dũng", "PKTH", "Nhân viên"),
            ("PHAMDINHTAI", "Phạm Đình Tài", "PKTH", "Nhân viên"),
        ]
        from organization.models import Position
        pos_map = {}
        for _, _, _, title in employees_data:
            if title not in pos_map:
                p_code = "".join([w[0].upper() for w in title.split()])[:10]
                pos, _ = Position.objects.get_or_create(company=company, code=p_code, defaults={"name": title, "status": "ACTIVE"})
                pos_map[title] = pos

        for e_code, e_name, d_code, title in employees_data:
            Employee.objects.get_or_create(
                company=company,
                employee_code=e_code,
                defaults={
                    "full_name": e_name,
                    "department": dept_map.get(d_code),
                    "position": pos_map[title],
                    "branch": branch,
                    "status": "ACTIVE",
                }
            )

        # 9. Warehouses
        warehouses_data = [
            ("156", "Kho hàng hóa", True),
            ("152", "Kho nguyên liệu", False),
            ("153", "Kho dụng cụ", False),
            ("155", "Kho thành phẩm", False),
            ("157", "Kho hàng gửi đại lý", False),
        ]
        wh_map = {}
        for w_code, w_name, is_def in warehouses_data:
            wh, _ = Warehouse.objects.get_or_create(
                company=company,
                code=w_code,
                defaults={
                    "name": w_name,
                    "branch": branch,
                    "warehouse_type": "PHYSICAL",
                    "warehouse_scope": "COMPANY_SHARED",
                    "is_default": is_def,
                    "status": "ACTIVE",
                }
            )
            wh_map[w_code] = wh

        # 10. Units of Measure
        uom_data = [
            ("CAI", "Cái", "Cái"),
            ("CUON", "Cuộn", "Cuộn"),
            ("LO", "Lọ", "Lọ"),
            ("KG", "Kilogram", "Kg"),
            ("BO", "Bộ", "Bộ"),
            ("CHIEU", "Chiếc", "Chiếc"),
        ]
        uom_map = {}
        for u_code, u_name, u_sym in uom_data:
            uom, _ = UnitOfMeasure.objects.get_or_create(
                company=company,
                code=u_code,
                defaults={"name": u_name, "symbol": u_sym, "measurement_type": "COUNT", "decimal_places": 0, "status": "ACTIVE"}
            )
            uom_map[u_code] = uom

        # 11. Item Categories
        cat_goods, _ = ItemCategory.objects.get_or_create(
            company=company, code="HH", defaults={"name": "Hàng hóa", "status": "ACTIVE"}
        )
        cat_mat, _ = ItemCategory.objects.get_or_create(
            company=company, code="NVL", defaults={"name": "Nguyên vật liệu", "status": "ACTIVE"}
        )
        cat_tool, _ = ItemCategory.objects.get_or_create(
            company=company, code="CCDC", defaults={"name": "Công cụ dụng cụ", "status": "ACTIVE"}
        )

        # 12. GL Accounts for items
        gl_1561 = Account.objects.filter(company=company, code="1561").first() or Account.objects.filter(company=company, code="156").first()
        gl_1521 = Account.objects.filter(company=company, code="1521").first() or Account.objects.filter(company=company, code="152").first()
        gl_1531 = Account.objects.filter(company=company, code="1531").first() or Account.objects.filter(company=company, code="153").first()
        gl_5111 = Account.objects.filter(company=company, code="5111").first() or Account.objects.filter(company=company, code="511").first()
        gl_632 = Account.objects.filter(company=company, code="632").first()

        # 13. Items Catalog
        items_data = [
            # code, name, uom, cat, inv_acc, purchase_price, sales_price
            ("DT_IP15", "Điện thoại iPhone 15 Pro Max 256GB", "CAI", cat_goods, gl_1561, 16200000, 21000000),
            ("DT_SS24", "Điện thoại Samsung Galaxy S24 Ultra 256GB", "CAI", cat_goods, gl_1561, 14700000, 19500000),
            ("LT_MBAIR", "Máy tính xách tay Macbook Air 13-inch M2", "CAI", cat_goods, gl_1561, 12900000, 20500000),
            ("LT_HPPAV", "Máy tính xách tay HP Pavilion 14 i5", "CAI", cat_goods, gl_1561, 7800000, 11200000),
            ("LT_DELL", "Laptop Dell Ins 15", "CAI", cat_goods, gl_1561, 12000000, 16800000),
            ("MTB_IPAD10", "Máy tính bảng iPad Gen 10 64GB", "CAI", cat_goods, gl_1561, 5100000, 7500000),
            ("DH_AWSE", "Đồng hồ thông minh Apple Watch SE", "CAI", cat_goods, gl_1561, 3600000, 5200000),
            ("DH_SSGW6", "Đồng hồ thông minh Samsung Galaxy Watch 6", "CAI", cat_goods, gl_1561, 3120000, 4800000),
            ("TN_APSPRO2", "Tai nghe AirPods Pro 2", "CAI", cat_goods, gl_1561, 2500000, 3900000),
            ("MH_LG27", "Màn hình máy tính LG 27 inch", "CAI", cat_goods, gl_1561, 5800000, 7800000),
            ("CHUOT_DELL", "Chuột không dây Dell MS5120", "CAI", cat_goods, gl_1561, 450000, 650000),
            ("BANPHIM", "Bàn phím máy tính Logitech", "CAI", cat_goods, gl_1561, 3800000, 5100000),
            ("VL_DCD", "Dây cáp điện", "CUON", cat_mat, gl_1521, 1500000, 0),
            ("VL_KDN", "Keo dán đa năng", "LO", cat_mat, gl_1521, 20000, 0),
            ("VL_VCN", "Vải lau công nghiệp", "KG", cat_mat, gl_1521, 50000, 0),
            ("GXV-001", "Ghế xoay văn phòng", "CAI", cat_tool, gl_1531, 800000, 0),
            ("MHTL-001", "Máy hủy tài liệu", "CAI", cat_tool, gl_1531, 2500000, 0),
            ("BLV-001", "Bàn làm việc", "CAI", cat_tool, gl_1531, 2500000, 0),
        ]
        for i_code, i_name, u_code, i_cat, gl_inv, p_price, s_price in items_data:
            Item.objects.get_or_create(
                company=company,
                code=i_code,
                defaults={
                    "name": i_name,
                    "category": i_cat,
                    "base_uom": uom_map.get(u_code, uom_map["CAI"]),
                    "item_type": "GOODS" if i_cat == cat_goods else "MATERIAL" if i_cat == cat_mat else "TOOL",
                    "track_inventory": True,
                    "track_by_warehouse": True,
                    "inventory_account": gl_inv,
                    "revenue_account": gl_5111,
                    "cogs_account": gl_632,
                    "purchase_price": Decimal(str(p_price)),
                    "sales_price": Decimal(str(s_price)),
                    "allow_purchase": True,
                    "allow_sale": (s_price > 0),
                    "status": "ACTIVE",
                }
            )

        # 14. Customers (Parties + PartyRole CUSTOMER)
        customers_data = [
            ("KHACHLE", "Khách hàng cá nhân", "", "Hà Nội"),
            ("THANHHA", "Công ty TNHH Thanh Hà", "110085253", "Số 1 ngõ 70 phố Văn Trì. P. Minh Khai. Hà Nội"),
            ("NHATMINH", "CTCP Nội thất Nhật Minh", "801382946", "Thôn An Liệt 2. Xã Thanh Hải. Thanh Hà. Hải Dương"),
            ("MINHHANH", "Công ty TNHH Kinh doanh Minh Hạnh", "110086627", "Số 20 ngách 141/17 ngõ 1194 đường Láng. P. Láng Thượng. Hà Nội"),
            ("ANHTUAN", "Công ty TNHH Công nghệ số Anh Tuấn", "110094515", "Số 86/185 Phố Chùa Láng. P. Láng Thượng. Hà Nội"),
            ("CAUGIAY", "CTCP Thương mại Cầu Giấy", "100408152", "Số 139 Cầu Giấy. P. Quan Hoa. Hà Nội"),
            ("HIEPPHAT", "Công ty TNHH Giải pháp Hiệp Phát", "110101949", "Số nhà BT21 làng Việt kiều Châu Âu. P. Mộ Lao. Hà Nội"),
            ("BAOKIM", "Công ty TNHH Đầu tư Bảo Kim", "110086049", "Số 25. ngõ 321 Bát Khối. P. Long Biên. Hà Nội"),
            ("THUANPHAT", "Công ty TNHH Thương mại Thuận Phát", "601238247", "Xóm 6 xã Xuân Hồng. Xuân Trường. Nam Định"),
            ("DUYVINH", "Công ty TNHH Xây dựng Duy Vinh", "700865055", "Xóm 6. thôn Mã Não. X. Ngọc Sơn. Kim Bảng. Hà Nam"),
            ("KIENQUAN", "CTCP Đầu tư Kiến Quân Việt Nam", "107527141", "Số 168 đường Chiến Thắng. P. Văn Quán. Hà Nội"),
            ("VIETHUNG", "Công ty TNHH Việt Hùng", "102020196", "Số 5. ngõ 165/2 Thái Hà. P. Láng Hạ. Hà Nội"),
            ("THAIBINH", "Công ty TNHH Thái Bình", "0102345678", "Số 88 Trần Thái Tông, Cầu Giấy, Hà Nội"),
            ("HOANGLONG", "Công ty CP Hoàng Long computer", "0103456789", "Số 50 Thái Hà, Trung Liệt, Đống Đa, Hà Nội"),
            ("PHANMINH", "Công ty Phan Minh", "0104567890", "Hà Nội"),
            ("THANHKTS", "Công ty Thanh KTS", "0105678901", "Hà Nội"),
            ("HUNGCUONG", "Công ty Hùng Cường", "0106789012", "Hà Nội"),
        ]
        for c_code, c_name, c_tax, c_addr in customers_data:
            party, _ = Party.objects.get_or_create(
                company=company,
                code=c_code,
                defaults={
                    "name": c_name,
                    "legal_name": c_name,
                    "party_type": "ORGANIZATION" if c_tax else "INDIVIDUAL",
                    "tax_code": c_tax,
                    "branch": branch,
                    "status": "ACTIVE",
                }
            )
            PartyRole.objects.get_or_create(party=party, role_type="CUSTOMER", defaults={"active_from": date(2026, 1, 1)})

        # 15. Suppliers (Parties + PartyRole VENDOR)
        suppliers_data = [
            ("PHATMAI", "Công ty TNHH Phát Mai Group", "110084806", "Số 140 Đường Vạn Hạnh. P. Đức Giang. Hà Nội"),
            ("MINHQUAN", "Công ty Cổ phần Minh Quân Logistics", "110087035", "Số 16. KĐT Văn Khê. Đường Tố Hữu. Hà Nội"),
            ("THANHTRU", "Công ty TNHH Thiết bị Thanh Trúc", "110092821", "Số 13 ngõ 10 Văn Nội. P. Phú Lương. Hà Nội"),
            ("MAISON", "CTCP Tư vấn và Dịch vụ Bất động sản Maison", "106639438", "Số 9. Ngõ 68 Trung Kính. P. Yên Hoà. Hà Nội"),
            ("VANPHO", "CTCP Vận tải và Thương mại Vạn Phát", "200463686", "Số 7 lô 2A Lê Hồng Phong. P. Đông Khê. Hải Phòng"),
            ("MEDIAZ", "Công ty TNHH Truyền thông AZ Việt Nam", "402155162", "72 Nguyễn Chí Thanh. P. Hải Châu I. Đà Nẵng"),
            ("LOCATIO", "Công ty TNHH Dịch vụ Logistics Việt Hưng", "101353160", "Số 135. phố Phúc Tân. P. Phúc Tân. Hà Nội"),
            ("VIETGIA", "Công ty Cổ phần Công nghệ Việt Gia", "101217009", "Số 1174 đường Láng. P. Láng Thượng. Hà Nội"),
            ("CONGNGHE", "Công ty TNHH Phát triển Công nghệ KTS", "100366488", "Số 177. phố Giảng Võ. P. Cát Linh. Hà Nội"),
            ("ANLOC", "Công ty TNHH Thương mại Máy tính An Lộc", "101468933", "Số 49 Phố Thái Hà. P. Trung Liệt. Hà Nội"),
            ("TANCANG", "Công ty cổ phần đại lý giao nhận vận tải xếp dỡ tân cảng", "304875444", "470 Đường Đồng Văn Cống. TP. Thủ Đức. TP. HCM"),
            ("LIENKHUONG", "Công ty Liên Khương", "0107890123", "Hà Nội"),
            ("MANHTHANG", "Công ty Mạnh Thắng", "0108901234", "Hà Nội"),
            ("THANHDAT", "Công ty Thành Đạt", "0109012345", "Hà Nội"),
        ]
        for s_code, s_name, s_tax, s_addr in suppliers_data:
            party, _ = Party.objects.get_or_create(
                company=company,
                code=s_code,
                defaults={
                    "name": s_name,
                    "legal_name": s_name,
                    "party_type": "ORGANIZATION",
                    "tax_code": s_tax,
                    "branch": branch,
                    "status": "ACTIVE",
                }
            )
            PartyRole.objects.get_or_create(party=party, role_type="VENDOR", defaults={"active_from": date(2026, 1, 1)})

        # 16. Seed Opening Balances (01/01/2026)
        self.stdout.write("Khoi tao so du dau ky (Opening Balances)...")
        period_1 = AccountingPeriod.objects.filter(company=company, fiscal_year=2026, period_number=1).first()
        period_12 = AccountingPeriod.objects.filter(company=company, fiscal_year=2026, period_number=12).first()

        def get_acc(code):
            return (
                Account.objects.filter(company=company, code=code, is_postable=True).first()
                or Account.objects.filter(company=company, code__startswith=code, is_postable=True).order_by("code").first()
                or Account.objects.filter(company=company, code=code).first()
            )

        from general_ledger.models import ChartOfAccounts
        coa = ChartOfAccounts.objects.filter(company=company).first()
        Account.objects.get_or_create(
            company=company, code="213",
            defaults={"name": "Tài sản cố định vô hình", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "chart_of_accounts": coa}
        )

        party_map = {p.code: p for p in Party.objects.filter(company=company)}

        if period_1 and not JournalEntry.objects.filter(company=company, number="OPEN-2026-001").exists():
            opening_lines = [
                ("1111", 500000000, 0, "Số dư đầu kỳ Tiền mặt"),
                ("1121", 3255000000, 0, "Số dư đầu kỳ Tiền gửi Techcombank VND"),
                ("1122", 3816750000, 0, "Số dư đầu kỳ Tiền gửi Techcombank USD (150.000 USD x 25.445)"),
                ("131", 142500000, 0, "Số dư đầu kỳ Phải thu khách hàng (Dư Nợ)"),
                ("131", 0, 15000000, "Số dư đầu kỳ Phải thu khách hàng (Dư Có ứng trước)"),
                ("133", 12000000, 0, "Số dư đầu kỳ Thuế GTGT được khấu trừ"),
                ("141", 12000000, 0, "Số dư đầu kỳ Tạm ứng (Hoàng Bá Cung)"),
                ("152", 36000000, 0, "Số dư đầu kỳ Nguyên vật liệu"),
                ("153", 14000000, 0, "Số dư đầu kỳ Công cụ dụng cụ"),
                ("156", 1158000000, 0, "Số dư đầu kỳ Hàng hóa"),
                ("2113", 816000000, 0, "Số dư đầu kỳ Phương tiện vận tải (Ford Transit)"),
                ("211", 513600000, 0, "Số dư đầu kỳ TSCĐ máy móc thiết bị"),
                ("213", 48000000, 0, "Số dư đầu kỳ Phần mềm kế toán Misa"),
                ("242", 38680000, 0, "Số dư đầu kỳ Chi phí trả trước CCDC"),
                ("331", 27000000, 0, "Số dư đầu kỳ Phải trả nhà cung cấp (Dư Nợ ứng trước)"),
                ("331", 0, 105000000, "Số dư đầu kỳ Phải trả nhà cung cấp (Dư Có)"),
                ("214", 0, 363400000, "Số dư đầu kỳ Hao mòn lũy kế TSCĐ"),
                ("411", 0, 5000000000, "Số dư đầu kỳ Vốn đầu tư của chủ sở hữu"),
                ("421", 0, 4906530000, "Số dư đầu kỳ Lợi nhuận sau thuế chưa phân phối"),
            ]
            tot_d = sum(d for _, d, c, _ in opening_lines)
            tot_c = sum(c for _, d, c, _ in opening_lines)
            entry_open = JournalEntry.objects.create(
                company=company,
                branch=branch,
                period=period_1,
                number="OPEN-2026-001",
                entry_type="OPENING",
                posting_date=date(2026, 1, 1),
                document_date=date(2026, 1, 1),
                description="Nhập số dư đầu kỳ năm tài chính 2026 theo Thông tư 99",
                status="POSTED",
                total_debit=tot_d,
                total_credit=tot_c,
                created_by=iam_user,
                posted_by=iam_user,
                posted_at=timezone.now(),
            )
            for idx, (acc_code, d_amt, c_amt, desc) in enumerate(opening_lines, 1):
                acc = get_acc(acc_code)
                if acc:
                    JournalLine.objects.create(
                        entry=entry_open,
                        line_no=idx,
                        account=acc,
                        debit=Decimal(str(d_amt)),
                        credit=Decimal(str(c_amt)),
                        currency=vnd,
                        description=desc,
                    )

        # 17. Seed Month 12 Real Transactions (32 nghiệp vụ phát sinh)
        self.stdout.write("Khoi tao 32 nghiep vu kinh te phat sinh thang 12/2026...")
        tx_data = [
            # 1. 01/12: Hàng gửi đại lý
            ("PXKDL001", date(2026, 12, 1), "Xuất kho gửi bán đại lý Hoàng Long computer: Laptop Dell & HP",
             [("157", 280000000, 0), ("156", 0, 280000000)], "HOANGLONG"),
            # 2. 03/12: Mua hàng nhập kho
            ("PNK00060", date(2026, 12, 3), "Mua hàng hóa nhập kho (Laptop Dell, HP, Macbook Air) từ Phát Mai Group",
             [("156", 812000000, 0), ("133", 81200000, 0), ("331", 0, 893200000)], "PHATMAI"),
            # 3. 05/12: Thanh toán lương T11 qua NH
            ("UNC00015", date(2026, 12, 5), "Ủy nhiệm chi thanh toán lương tháng 11/N qua Techcombank",
             [("334", 154200000, 0), ("1121", 0, 154200000)], None),
            # 4. 05/12: Nộp bảo hiểm qua NH
            ("UNC00016", date(2026, 12, 5), "Ủy nhiệm chi nộp bảo hiểm xã hội, y tế, thất nghiệp cho cơ quan BHXH",
             [("338", 48600000, 0), ("1121", 0, 48600000)], None),
            # 5. 05/12: Bán hàng cho Minh Hạnh
            ("HDBH00080", date(2026, 12, 5), "Xuất bán hàng hóa theo PXK 80 cho Công ty TNHH Kinh doanh Minh Hạnh",
             [("131", 474320000, 0), ("511", 0, 431200000), ("3331", 0, 43120000)], "MINHHANH"),
            # 6. 06/12: Xuất kho NVL phòng kỹ thuật
            ("PXK00081", date(2026, 12, 6), "Xuất sử dụng vật tư (dây cáp, keo dán, vải lau) cho phòng kỹ thuật",
             [("642", 11000000, 0), ("152", 0, 11000000)], None),
            # 7. 08/12: Chi TM mua VPP phòng hành chính
            ("PC00045", date(2026, 12, 8), "Chi tiền mặt mua văn phòng phẩm từ Công ty Thanh Trúc",
             [("642", 1675000, 0), ("133", 167500, 0), ("1111", 0, 1842500)], "THANHTRU"),
            # 8. 09/12: Chi TM tạm ứng công tác Phạm Quang Hòa
            ("PC00046", date(2026, 12, 9), "Chi tạm ứng cho nhân viên Phạm Quang Hòa kỹ thuật đi công tác",
             [("141", 5000000, 0), ("1111", 0, 5000000)], None),
            # 9. 09/12: Công ty Thái Bình ứng trước tiền hàng qua NH
            ("GBC00030", date(2026, 12, 9), "Báo có Công ty TNHH Thái Bình ứng trước tiền hàng qua Techcombank",
             [("1121", 50000000, 0), ("131", 0, 50000000)], "THAIBINH"),
            # 10. 10/12: Mua máy chủ phục vụ bán hàng qua NH
            ("GBN00028", date(2026, 12, 10), "Ủy nhiệm chi mua máy chủ phục vụ quản lý bán hàng từ Việt Gia",
             [("211", 53000000, 0), ("133", 5300000, 0), ("1121", 0, 58300000)], "VIETGIA"),
            # 11. 12/12: Mua máy in dùng cho phòng kế toán (phân bổ 18T)
            ("GBN00029", date(2026, 12, 12), "Ủy nhiệm chi mua máy in từ An Lộc dùng cho phòng kế toán",
             [("242", 6000000, 0), ("133", 600000, 0), ("1121", 0, 6600000)], "ANLOC"),
            # 12. 12/12: Bán hàng cho Thái Bình
            ("HDBH00082", date(2026, 12, 12), "Bán hàng cho Công ty TNHH Thái Bình theo PXK số 82",
             [("131", 229900000, 0), ("511", 0, 209000000), ("3331", 0, 20900000)], "THAIBINH"),
            # 13. 12/12: Quyết toán tạm ứng Phạm Quang Hòa
            ("PT00032", date(2026, 12, 12), "Nhân viên Phạm Quang Hòa thanh toán tạm ứng và hoàn tiền quỹ",
             [("642", 2300000, 0), ("1111", 2700000, 0), ("141", 0, 5000000)], None),
            # 14. 13/12: Thanh toán nợ Thành Đạt hưởng chiết khấu 5%
            ("GBN00030", date(2026, 12, 13), "Thanh toán cho Công ty Thành Đạt được hưởng chiết khấu thanh toán 5%",
             [("331", 150000000, 0), ("515", 0, 7500000), ("1121", 0, 142500000)], "THANHDAT"),
            # 15. 15/12: Thu lãi tiền gửi tiết kiệm T11
            ("GBC00031", date(2026, 12, 15), "Ngân hàng Techcombank báo có thu lãi tiền gửi tháng 11/N",
             [("1121", 2150000, 0), ("515", 0, 2150000)], None),
            # 16. 16/12: Bán hàng cho khách lẻ thu tiền ngay qua CK
            ("HDBH00083", date(2026, 12, 16), "Bán hàng cho khách lẻ theo PXK số 83 (Laptop HP) thu chuyển khoản",
             [("1121", 12320000, 0), ("511", 0, 11200000), ("3331", 0, 1120000)], "KHACHLE"),
            # 17. 16/12: Chi TM tiếp khách
            ("PC00047", date(2026, 12, 16), "Chi tiền mặt tiếp khách phục vụ bộ phận bán hàng",
             [("641", 2200000, 0), ("133", 220000, 0), ("1111", 0, 2420000)], None),
            # 18. 17/12: Bán chứng khoán kinh doanh
            ("GBC00032", date(2026, 12, 17), "Thu tiền bán chứng khoán kinh doanh (giá gốc 50tr, giá bán 55tr)",
             [("1121", 55000000, 0), ("121", 0, 50000000), ("515", 0, 5000000)], None),
            # 19. 17/12: Thanh lý TSCĐ Dell XPS 15 thu TM
            ("PT00033", date(2026, 12, 17), "Thanh lý máy tính xách tay Dell XPS 15 thu bằng tiền mặt",
             [("1111", 2200000, 0), ("711", 0, 2000000), ("3331", 0, 200000)], None),
            # 20. 18/12: Đại lý Hoàng Long thanh toán trừ hoa hồng 10%
            ("GBC00033", date(2026, 12, 18), "Đại lý Hoàng Long chuyển khoản trả tiền bán hàng trừ hoa hồng đại lý",
             [("1121", 277200000, 0), ("641", 30800000, 0), ("511", 0, 280000000), ("3331", 0, 28000000)], "HOANGLONG"),
            # 21. 20/12: Thanh toán tiền cho Vạn Phát qua NH
            ("GBN00031", date(2026, 12, 20), "Ủy nhiệm chi thanh toán tiền cho Công ty Vạn Phát qua Techcombank",
             [("331", 12000000, 0), ("1121", 0, 12000000)], "VANPHO"),
            # 22. 22/12: Chi TM bảo dưỡng máy lạnh Daikin
            ("PC00048", date(2026, 12, 22), "Chi tiền mặt bảo dưỡng định kỳ máy lạnh Daikin văn phòng",
             [("642", 1200000, 0), ("133", 120000, 0), ("1111", 0, 1320000)], None),
            # 23. 22/12: Bán hàng chưa thu tiền cho Cầu Giấy
            ("HDBH00085", date(2026, 12, 22), "Bán hàng chưa thu tiền cho CTCP Thương mại Cầu Giấy theo PXK 85",
             [("131", 526460000, 0), ("511", 0, 478600000), ("3331", 0, 47860000)], "CAUGIAY"),
            # 24. 23/12: Mua hàng nhập kho từ Thanh Trúc
            ("PNK00061", date(2026, 12, 23), "Mua hàng nhập kho theo PNK 61 từ Công ty Thiết bị Thanh Trúc",
             [("156", 353500000, 0), ("133", 35350000, 0), ("331", 0, 388850000)], "THANHTRU"),
            # 25. 24/12: Hàng bán bị trả lại do cháy màn hình
            ("HDBTL001", date(2026, 12, 24), "Khách hàng Cầu Giấy trả lại sản phẩm màn hình bị cháy theo biên bản",
             [("521", 7800000, 0), ("3331", 780000, 0), ("131", 0, 8580000)], "CAUGIAY"),
            # 26. 26/12: Giảm giá hàng mua do bị lỗi
            ("BBGG001", date(2026, 12, 26), "Thỏa thuận giảm giá 10% hàng mua ngày 23/12 bị lỗi với NCC Thanh Trúc",
             [("331", 858000, 0), ("156", 0, 780000), ("133", 0, 78000)], "THANHTRU"),
            # 27. 29/12: Xuất kho CCDC cho phòng kế toán
            ("PXK00086", date(2026, 12, 29), "Xuất kho ghế xoay và bàn làm việc cho phòng kế toán (phân bổ 1 lần)",
             [("642", 4100000, 0), ("153", 0, 4100000)], None),
            # 28. 31/12: Tính lương và các khoản trích theo lương T12
            ("PKT00001", date(2026, 12, 31), "Trích lập bảng tính lương và các khoản trích theo lương tháng 12/N",
             [("641", 68500000, 0), ("642", 100000000, 0), ("334", 0, 168500000)], None),
            # 29. 31/12: Phân bổ CCDC xuất dùng tính vào chi phí T12
            ("PKT00002", date(2026, 12, 31), "Phân bổ CCDC xuất dùng tính vào chi phí quản lý và bán hàng tháng 12",
             [("641", 5450000, 0), ("642", 13000000, 0), ("242", 0, 18450000)], None),
            # 30. 31/12: Tính và phân bổ khấu hao TSCĐ T12
            ("PKT00003", date(2026, 12, 31), "Tính và trích khấu hao tài sản cố định tháng 12",
             [("641", 4600000, 0), ("642", 9000000, 0), ("214", 0, 13600000)], None),
            # 31. 31/12: Xác định thuế GTGT khấu trừ và phải nộp T12
            ("PKT00004", date(2026, 12, 31), "Khấu trừ và xác định thuế GTGT được khấu trừ và phải nộp tháng 12",
             [("3331", 128537500, 0), ("133", 0, 128537500)], None),
            # 32. 31/12: Kết chuyển xác định kết quả kinh doanh cuối năm
            ("PKT00005", date(2026, 12, 31), "Kết chuyển doanh thu, chi phí xác định kết quả kinh doanh năm N",
             [("511", 1400000000, 0), ("911", 0, 1400000000)], None),
        ]

        if period_12:
            created_tx = 0
            for doc_num, doc_date, desc, lines, p_code in tx_data:
                if JournalEntry.objects.filter(company=company, number=doc_num).exists():
                    continue
                tot_d = sum(d for _, d, c in lines)
                tot_c = sum(c for _, d, c in lines)
                party = party_map.get(p_code) if p_code else None
                entry = JournalEntry.objects.create(
                    company=company,
                    branch=branch,
                    period=period_12,
                    number=doc_num,
                    entry_type="SUBLEDGER",
                    posting_date=doc_date,
                    document_date=doc_date,
                    description=desc,
                    status="POSTED",
                    total_debit=tot_d,
                    total_credit=tot_c,
                    created_by=iam_user,
                    posted_by=iam_user,
                    posted_at=timezone.now(),
                )
                for l_idx, (acc_code, d_val, c_val) in enumerate(lines, 1):
                    acc = get_acc(acc_code)
                    if acc:
                        JournalLine.objects.create(
                            entry=entry,
                            line_no=l_idx,
                            account=acc,
                            debit=Decimal(str(d_val)),
                            credit=Decimal(str(c_val)),
                            currency=vnd,
                            party=party,
                            description=desc,
                        )
                created_tx += 1
            self.stdout.write(f"- Da ghi nhan {created_tx} nghiep vu kinh te thang 12 vao So Cai GL.")

        self.stdout.write(self.style.SUCCESS(
            f"Da khoi tao thanh cong du lieu Master Data & 32 nghiep vu bai tap TMDV cho {company.name}!"
        ))
        self.stdout.write(self.style.SUCCESS(
            f"- Ma so thue: {company.tax_code}\n- Che do: {company.accounting_regime}\n- Khach hang: {len(customers_data)}\n- Nha cung cap: {len(suppliers_data)}\n- Hang hoa/Vat tu: {len(items_data)}"
        ))

