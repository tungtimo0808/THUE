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

        # 2. Users: ensure superadmin and default admin from .env
        import os
        superadmin_user = os.getenv("SUPERADMIN_USERNAME", "superadmin")
        superadmin_email = os.getenv("SUPERADMIN_EMAIL", "superadmin@soviet.vn")
        superadmin_pass = os.getenv("SUPERADMIN_PASSWORD", "SuperAdmin@2026")

        super_auth, _ = User.objects.get_or_create(
            username=superadmin_user,
            defaults={"email": superadmin_email, "is_staff": True, "is_superuser": True}
        )
        super_auth.email = superadmin_email
        super_auth.is_staff = True
        super_auth.is_superuser = True
        super_auth.is_active = True
        super_auth.set_password(superadmin_pass)
        super_auth.save()

        super_iam, _ = UserAccount.objects.get_or_create(
            auth_user=super_auth,
            defaults={"email": superadmin_email, "display_name": "Super Admin Hệ Thống"}
        )
        super_iam.display_name = "Super Admin Hệ Thống"
        super_iam.save(update_fields=("display_name",))

        admin_username = os.getenv("ADMIN_USERNAME", "timodapoettt")
        admin_email = os.getenv("ADMIN_EMAIL", "tungtimo0808@gmail.com")
        admin_pass = os.getenv("ADMIN_PASSWORD", "123456")
        admin_display = os.getenv("ADMIN_DISPLAY_NAME", "Đỗ Đức Tùng")

        admin_auth, _ = User.objects.get_or_create(
            username=admin_username,
            defaults={"email": admin_email, "is_staff": False, "is_superuser": False}
        )
        admin_auth.email = admin_email
        admin_auth.is_active = True
        admin_auth.set_password(admin_pass)
        admin_auth.save()

        admin_iam, _ = UserAccount.objects.get_or_create(
            auth_user=admin_auth,
            defaults={"email": admin_email, "display_name": admin_display}
        )
        admin_iam.display_name = admin_display
        admin_iam.save()

        auth_user = super_auth
        iam_user = admin_iam

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

        # Seed standard roles and full-permission COMPANY_ADMIN role for ABC
        from iam.role_services import seed_standard_roles_for_company
        seed_standard_roles_for_company(company, iam_user)

        # Memberships for superadmin & admin -> Ensure single COMPANY_ADMIN role
        from iam.models import ActiveStatus, Role, UserRoleAssignment
        admin_role = Role.objects.filter(company=company, code="COMPANY_ADMIN").first()
        for user_target in [super_iam, admin_iam]:
            m, _ = CompanyMembership.objects.get_or_create(
                company=company,
                user=user_target,
                defaults={"membership_status": ActiveStatus.ACTIVE, "joined_at": timezone.now(), "created_by": user_target}
            )
            if m.membership_status != ActiveStatus.ACTIVE:
                m.membership_status = ActiveStatus.ACTIVE
                m.save()
            if admin_role:
                UserRoleAssignment.objects.filter(company_membership=m).delete()
                UserRoleAssignment.objects.create(
                    company_membership=m,
                    role=admin_role,
                    status=ActiveStatus.ACTIVE,
                    assigned_by=user_target,
                    assign_reason="Quản trị viên Doanh nghiệp (Chủ sở hữu)",
                )

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

        # 5.1 Seed standard operational accounting staff members and assign roles (Image 2 verification)
        staff_map = [
            ("nongxuanmai098@gmail.com", "+84971389093", "Nông Xuân Mai", "KT_TRUONG", "Phòng Kế toán", "Kế toán trưởng"),
            ("timo2026@example.com", "+84987654321", "Trần Thủ Quỹ", "THU_QUY", "Phòng Tài chính - Quỹ", "Thủ quỹ"),
            ("admin@soviet.vn", "+84912345678", "Lê Kế Toán Bán Hàng", "KT_BANHANG", "Phòng Kinh doanh", "Kế toán bán hàng"),
            ("admin@example.com", "admin", "Nguyễn Kế Toán Mua", "KT_MUAHANG", "Phòng Mua hàng", "Kế toán mua hàng"),
        ]
        from organization.models import Department, Employee
        for staff_email, staff_uname, staff_dname, rcode, dname, pname in staff_map:
            u_obj = User.objects.filter(email=staff_email).first() or User.objects.filter(username=staff_uname).first()
            if not u_obj:
                u_obj = User.objects.create_user(username=staff_uname, email=staff_email, password="123456", first_name=staff_dname)
            u_obj.is_superuser = False
            u_obj.is_staff = False
            u_obj.save()

            u_acc, _ = UserAccount.objects.get_or_create(auth_user=u_obj, defaults={"display_name": staff_dname, "phone": staff_uname if staff_uname.startswith("+") else ""})
            u_acc.display_name = staff_dname
            u_acc.save()

            dept_obj = Department.objects.filter(company=company, name=dname).first()
            if not dept_obj:
                dept_obj = Department.objects.create(company=company, name=dname, code=f"PB_{u_obj.id}", branch=branch, status="ACTIVE")

            emp_obj = Employee.objects.filter(company=company, email=staff_email).first()
            if not emp_obj:
                emp_obj = Employee.objects.create(company=company, email=staff_email, employee_code=f"NV_{u_obj.id}", full_name=staff_dname, department=dept_obj, branch=branch, status="ACTIVE")
            staff_m, _ = CompanyMembership.objects.get_or_create(
                company=company, user=u_acc,
                defaults={"membership_status": ActiveStatus.ACTIVE, "created_by": iam_user, "employee": emp_obj}
            )
            staff_m.membership_status = ActiveStatus.ACTIVE
            staff_m.employee = emp_obj
            staff_m.save()

            r_target = Role.objects.filter(company=company, code=rcode).first()
            if r_target:
                UserRoleAssignment.objects.filter(company_membership=staff_m).delete()
                UserRoleAssignment.objects.create(
                    company_membership=staff_m,
                    role=r_target,
                    status=ActiveStatus.ACTIVE,
                    assigned_by=iam_user,
                    assign_reason=f"Phân công {r_target.name}",
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
            ("NGUYENMINHHAI", "Nguyễn Minh Hải", "PKTH", "Nhân viên kỹ thuật"),
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

        # 13. Items Catalog (Đầy đủ theo Mục VII & VIII tài liệu bài tập)
        items_data = [
            # code, name, uom, cat, inv_acc, purchase_price, sales_price
            ("DT_IP15", "Điện thoại iPhone 15 Pro Max 256GB", "CAI", cat_goods, gl_1561, 16200000, 21000000),
            ("DT_SS24", "Điện thoại Samsung Galaxy S24 Ultra 256GB", "CAI", cat_goods, gl_1561, 14700000, 19500000),
            ("LT_MBAIR", "Máy tính xách tay Macbook Air 13-inch M2", "CAI", cat_goods, gl_1561, 12900000, 20500000),
            ("LT_MBAIR_M3", "Macbook Air 13\" M3", "CAI", cat_goods, gl_1561, 20500000, 25800000),
            ("LT_HPPAV", "Máy tính xách tay HP Pavilion 14 i5", "CAI", cat_goods, gl_1561, 7800000, 11200000),
            ("LT_HP15S", "Laptop HP 15s", "CAI", cat_goods, gl_1561, 8000000, 11200000),
            ("LT_DELL", "Laptop Dell Ins 15", "CAI", cat_goods, gl_1561, 12000000, 16800000),
            ("MTB_IPAD10", "Máy tính bảng iPad Gen 10 64GB", "CAI", cat_goods, gl_1561, 5100000, 7500000),
            ("DH_AWSE", "Đồng hồ thông minh Apple Watch SE", "CAI", cat_goods, gl_1561, 3600000, 5200000),
            ("DH_SSGW6", "Đồng hồ thông minh Samsung Galaxy Watch 6", "CAI", cat_goods, gl_1561, 3120000, 4800000),
            ("TN_APSPRO2", "Tai nghe AirPods Pro 2", "BO", cat_goods, gl_1561, 2880000, 3900000),
            ("TN_SSGWEB", "Tai nghe Samsung Galaxy Buds FE", "BO", cat_goods, gl_1561, 1020000, 1800000),
            ("MCG_PS5", "Máy chơi game PlayStation 5 Slim", "CAI", cat_goods, gl_1561, 6300000, 11500000),
            ("LOA_JBL", "Loa Bluetooth JBL Flip 6", "CAI", cat_goods, gl_1561, 1380000, 2500000),
            ("SDP_ANKER", "Sạc dự phòng Anker PowerCore 20000mAh", "CAI", cat_goods, gl_1561, 210000, 450000),
            ("MH_LGMQ2", "Màn hình máy tính LG 27-inch 4K", "CAI", cat_goods, gl_1561, 5700000, 8200000),
            ("MH_LG27UL500", "Màn hình máy tính LG 27UL500", "CAI", cat_goods, gl_1561, 5600000, 7800000),
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
            item_obj, created_item = Item.objects.get_or_create(
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
            if not created_item:
                item_obj.name = i_name
                item_obj.purchase_price = Decimal(str(p_price))
                item_obj.sales_price = Decimal(str(s_price))
                item_obj.save(update_fields=["name", "purchase_price", "sales_price"])

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
            ("THAIBINH", "Công ty TNHH Thái Bình", "0108804440", "68 Nguyễn Chí Thanh, Đống Đa, Hà Nội"),
            ("HOANGLONG", "Công ty CP Hoàng Long computer", "0105509988", "Số 125 Chùa Bộc, Đống Đa, Hà Nội"),
            ("PHANMINH", "Công ty TNHH Phan Minh", "0109905550", "88 Láng Hạ, Đống Đa, Hà Nội"),
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
                    "tax_code": c_tax or None,
                    "branch": branch,
                    "status": "ACTIVE",
                }
            )
            PartyRole.objects.get_or_create(party=party, role_type="CUSTOMER", defaults={"active_from": date(2026, 1, 1)})

        # 15. Suppliers & State Agencies (Parties + PartyRole VENDOR)
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
            ("QUOCTE", "Công ty cổ phần đầu tư thương mại và dịch vụ quốc tế", "100110052", "Số 17. phạm hùng. P. Từ Liêm. TP. Hà Nội"),
            ("LIENKHUONG", "Công ty Liên Khương", "0107890123", "Hà Nội"),
            ("MANHTHANG", "Công ty Mạnh Thắng", "0108901234", "Hà Nội"),
            ("THANHDAT", "Công ty TNHH Thành Đạt", "0101234567", "Số 25 Lê Văn Lương, Thanh Xuân, Hà Nội"),
            ("ANTAM", "CÔNG TY CỔ PHẦN VĂN PHÒNG PHẨM AN TÂM", "2004687684", "Số 10, phố Hàng Bông, P. Hoàn Kiếm, Hà Nội"),
            ("BINHPHAT", "CTCP THƯƠNG MẠI BÌNH PHÁT", "200433686", "12 Điện Biên Phủ, Ba Đình, Hà Nội"),
            ("GIANGMY", "CÔNG TY CỔ PHẦN ĐẦU TƯ GIANG MỸ", "225946138", "Tầng 1-2, tòa nhà 17T1, phố Hoàng Đạo Thúy, Cầu Giấy, Hà Nội"),
            ("TECHWORLD", "Tech world global trading limited", "", "Room 1203, 12/F, Tower 2, Lippo Centre, 89 Queensway, Admiralty, Hong Kong"),
            ("XNKHAIPHONG", "Công ty Cổ phần Thương mại dịch vụ và Xuất nhập khẩu Hải Phòng", "0200348697", "Số 19 Кhu B1 Lô 7B Lê Hồng Phong, Hải Phòng"),
            ("TAYPHUONG", "Công ty cổ phần điện máy Tây Phương", "0106026495", "Số 15 đường Tây Hồ, Phường Quảng An, Quận Tây Hồ, Hà Nội"),
            ("HACOM", "Công ty TNHH TV Đầu tư công nghệ Hacom", "0107406972", "Số 131 Lê Thanh Nghị, Hai Bà Trưng, Hà Nội"),
            ("NH001", "Ngân hàng TMCP Kỹ thương Việt Nam - Chi nhánh Hà Nội", "100230800", "30B Phố Nguyễn Hữu Huân. Lý Thái Tổ. Hoàn Kiếm. TP. Hà Nội"),
            # IV. Nhóm danh mục cơ quan nhà nước
            ("CCTHK", "Chi cục Thuế Hoàn Kiếm", "100856478", "885 Đường Hồng Hà. Chương Dương Độ. Hoàn Kiếm. TP. Hà Nội"),
            ("BHXHK", "Bảo hiểm xã hội Hoàn Kiếm", "100985412", "54A Phố Hàng Cót. Hàng Mã. Hoàn Kiếm. TP. Hà Nội"),
            ("KBNHK", "Kho bạc nhà nước Hoàn Kiếm", "100756321", "90 Thợ Nhuộm. Trần Hưng Đạo. Hoàn Kiếm. TP. Hà Nội"),
            ("EVNHN", "Tổng công ty Điện lực TP. Hà Nội", "100101234", "69 Đinh Tiên Hoàng. Lý Thái Tổ. Hoàn Kiếm. TP. Hà Nội"),
            ("HNWSCO", "Công ty CP SXKD Nước sạch Số 3 Hà Nội", "100245678", "Số 8C Đinh Công Tráng. Phan Chu Trinh. Hoàn Kiếm. TP. Hà Nội"),
        ]
        for s_code, s_name, s_tax, s_addr in suppliers_data:
            party, _ = Party.objects.get_or_create(
                company=company,
                code=s_code,
                defaults={
                    "name": s_name,
                    "legal_name": s_name,
                    "party_type": "ORGANIZATION",
                    "tax_code": s_tax or None,
                    "branch": branch,
                    "status": "ACTIVE",
                }
            )
            PartyRole.objects.get_or_create(party=party, role_type="VENDOR", defaults={"active_from": date(2026, 1, 1)})

        # 16. Seed Opening Balances (01/01/2026 - Chuẩn Mục VII tài liệu bài tập: Tổng Nợ = Tổng Có = 10.759.330.000)
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
        Account.objects.get_or_create(
            company=company, code="2143",
            defaults={"name": "Hao mòn TSCĐ vô hình", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "chart_of_accounts": coa}
        )

        party_map = {p.code: p for p in Party.objects.filter(company=company)}

        if period_1:
            JournalEntry.objects.filter(company=company, number="OPEN-2026-001").delete()
            opening_lines = [
                ("1111", 500000000, 0, "Số dư đầu kỳ Tiền mặt Việt Nam"),
                ("1121", 3255000000, 0, "Số dư đầu kỳ Tiền gửi Techcombank VND (TK 123456789)"),
                ("1122", 3816750000, 0, "Số dư đầu kỳ Tiền gửi Techcombank USD (150.000 USD x 25.445 - TK 987654321)"),
                ("131", 142500000, 0, "Số dư đầu kỳ Phải thu khách hàng (THANHHA 50tr, MINHHANH 60tr, ANHTUAN 32.5tr)"),
                ("131", 0, 15000000, "Số dư đầu kỳ Phải thu khách hàng ứng trước (NHATMINH 15tr)"),
                ("1331", 12000000, 0, "Số dư đầu kỳ Thuế GTGT được khấu trừ của hàng hóa, dịch vụ"),
                ("141", 12000000, 0, "Số dư đầu kỳ Tạm ứng (Hoàng Bá Cung - Phòng HCNS)"),
                ("152", 36000000, 0, "Số dư đầu kỳ Nguyên liệu, vật liệu (VL_DCD 30tr, VL_KDN 1tr, VL_VCN 5tr)"),
                ("153", 14000000, 0, "Số dư đầu kỳ Công cụ, dụng cụ (GXV-001 4tr, MHTL-001 5tr, BLV-001 5tr)"),
                ("156", 1158000000, 0, "Số dư đầu kỳ Hàng hóa (12 mặt hàng tồn kho đầu kỳ)"),
                ("211", 513600000, 0, "Số dư đầu kỳ TSCĐ hữu hình - Máy móc, thiết bị (LT001, PD001, DH002, MPD001)"),
                ("2113", 816000000, 0, "Số dư đầu kỳ Phương tiện vận tải, truyền dẫn (OT002 - Xe ô tô Ford Transit 2023)"),
                ("213", 48000000, 0, "Số dư đầu kỳ TSCĐ vô hình (PM002 - Phần mềm kế toán Misa)"),
                ("2141", 0, 354400000, "Số dư đầu kỳ Hao mòn TSCĐ hữu hình"),
                ("2143", 0, 9000000, "Số dư đầu kỳ Hao mòn TSCĐ vô hình"),
                ("221", 150000000, 0, "Số dư đầu kỳ Đầu tư vào công ty con"),
                ("222", 120000000, 0, "Số dư đầu kỳ Đầu tư vào công ty liên doanh, liên kết"),
                ("241", 100000000, 0, "Số dư đầu kỳ Xây dựng cơ bản dở dang"),
                ("242", 38480000, 0, "Số dư đầu kỳ Chi phí trả trước (6 mã CCDC đang dùng: PD001, TS001, BG001, TD001, DT001, KD001)"),
                ("331", 27000000, 0, "Số dư đầu kỳ Phải trả cho người bán ứng trước (MINHQUAN 15tr, MAISON 12tr)"),
                ("331", 0, 105000000, "Số dư đầu kỳ Phải trả cho người bán (PHATMAI 80tr, THANHTRU 25tr)"),
                ("3331", 0, 5000000, "Số dư đầu kỳ Thuế GTGT phải nộp"),
                ("334", 0, 45000000, "Số dư đầu kỳ Phải trả người lao động"),
                ("338", 0, 5000000, "Số dư đầu kỳ Phải trả, phải nộp khác"),
                ("341", 0, 2500000000, "Số dư đầu kỳ Vay và nợ thuê tài chính"),
                ("4111", 0, 7685930000, "Số dư đầu kỳ Vốn góp của chủ sở hữu"),
                ("4212", 0, 25000000, "Số dư đầu kỳ Lợi nhuận sau thuế chưa phân phối năm trước"),
                ("441", 0, 10000000, "Số dư đầu kỳ Quỹ đầu tư phát triển"),
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
                description="Nhập số dư đầu kỳ năm tài chính 2026 theo Thông tư 99 (Tổng Nợ = Có = 10.759.330.000 VND)",
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

        # 17. Seed Month 12 Real Transactions (32 nghiệp vụ phát sinh chuẩn xác theo chứng từ gốc)
        self.stdout.write("Khoi tao 32 nghiep vu kinh te phat sinh thang 12/2026...")
        tx_data = [
            # 1. 01/12: Hàng gửi đại lý (PXK 79)
            ("PXKDL001", date(2026, 12, 1), "Xuất kho gửi bán đại lý Hoàng Long computer theo PXK 79: Laptop Dell Ins 15 (10c) & HP 15s (10c)",
             [("157", 200000000, 0), ("156", 0, 200000000)], "HOANGLONG"),
            # 2. 03/12: Mua hàng nhập kho từ Vạn Phát (PNK 60, HĐ 120)
            ("PNK00060", date(2026, 12, 3), "Mua hàng hóa nhập kho (Laptop Dell 25c, HP 15s 20c, Macbook Air M3 18c) từ CTCP Vận tải và Thương mại Vạn Phát theo PNK 60, HĐ 120",
             [("156", 812000000, 0), ("1331", 81200000, 0), ("331", 0, 893200000)], "VANPHO"),
            # 3. 05/12: Thanh toán lương T11 qua NH (FT25339791951533)
            ("UNC00015", date(2026, 12, 5), "Giấy báo nợ FT25339791951533 thanh toán tiền lương tháng 11/N cho nhân viên qua Techcombank",
             [("334", 250600000, 0), ("1121", 0, 250600000)], None),
            # 4. 05/12: Nộp bảo hiểm qua NH (FT25339791951534)
            ("UNC00016", date(2026, 12, 5), "Giấy báo nợ FT25339791951534 nộp bảo hiểm tháng 11/N cho Bảo hiểm xã hội Hoàn Kiếm",
             [("338", 30500000, 0), ("1121", 0, 30500000)], "BHXHK"),
            # 5. 05/12: Bán hàng cho Minh Hạnh thu ngay bằng TGNH (PXK 80, HĐ 152, FT25339791951543)
            ("HDBH00080", date(2026, 12, 5), "Bán hàng hóa cho Công ty TNHH Kinh doanh Minh Hạnh theo PXK 80, HĐ 152 và thu ngay qua TGNH (FT25339791951543)",
             [("1121", 474320000, 0), ("511", 0, 431200000), ("3331", 0, 43120000)], "MINHHANH"),
            # 6. 06/12: Xuất kho NVL phòng kỹ thuật (PXK 81)
            ("PXK00081", date(2026, 12, 6), "Xuất kho vật tư (2 cuộn dây cáp điện, 1 lọ keo dán đa năng) theo PXK 81 cho Đặng Thuận - Phòng kỹ thuật",
             [("641", 3020000, 0), ("152", 0, 3020000)], None),
            # 7. 08/12: Chi TM mua VPP phòng hành chính (PC 180, HĐ 320)
            ("PC00045", date(2026, 12, 8), "Chi tiền mặt PC 180 thanh toán tiền văn phòng phẩm theo HĐ 320 của CTCP Văn phòng phẩm An Tâm",
             [("642", 1675000, 0), ("1331", 167500, 0), ("1111", 0, 1842500)], "ANTAM"),
            # 8. 09/12: Chi TM tạm ứng công tác Phạm Quang Hòa (PC 181)
            ("PC00046", date(2026, 12, 9), "Phiếu chi PC 181 tạm ứng tiền công tác cho nhân viên Phạm Quang Hòa - Phòng kỹ thuật",
             [("141", 5000000, 0), ("1111", 0, 5000000)], None),
            # 9. 09/12: Công ty Thái Bình ứng trước tiền hàng qua NH (FT25339791951600)
            ("GBC00030", date(2026, 12, 9), "Giấy báo có FT25339791951600 Công ty TNHH Thái Bình ứng trước tiền mua hàng qua Techcombank",
             [("1121", 100000000, 0), ("131", 0, 100000000)], "THAIBINH"),
            # 10. 10/12: Mua máy chủ Dell PowerEdge R350 từ Thành Đạt (HĐ 145, FT25339791951625)
            ("GBN00028", date(2026, 12, 10), "Giấy báo nợ FT25339791951625 mua máy chủ Dell PowerEdge R350 theo HĐ 145 từ Công ty TNHH Thành Đạt",
             [("211", 53000000, 0), ("1331", 5300000, 0), ("1121", 0, 58300000)], "THANHDAT"),
            # 11. 12/12: Mua máy in Canon imageCLASS MF275dw từ Bình Phát dùng ngay cho phòng kế toán (HĐ 120, FT25339791951650)
            ("GBN00029", date(2026, 12, 12), "Giấy báo nợ FT25339791951650 mua máy in Canon MF275dw theo HĐ 120 từ CTCP Thương mại Bình Phát (phân bổ 18 tháng)",
             [("242", 6000000, 0), ("1331", 600000, 0), ("1121", 0, 6600000)], "BINHPHAT"),
            # 12. 12/12: Bán hàng cho Thái Bình (PXK 82, HĐ 153)
            ("HDBH00082", date(2026, 12, 12), "Bán hàng cho Công ty TNHH Thái Bình theo PXK 82, HĐ 153 (Laptop Dell 7c, HP 15s 7c, Chuột Dell 20c)",
             [("131", 229900000, 0), ("511", 0, 209000000), ("3331", 0, 20900000)], "THAIBINH"),
            # 13. 12/12: Quyết toán tạm ứng Phạm Quang Hòa (PT 185)
            ("PT00032", date(2026, 12, 12), "Quyết toán tạm ứng công tác phí của Phạm Quang Hòa (chi 2.300.000đ, thu hoàn quỹ PT 185 số tiền 2.700.000đ)",
             [("641", 2300000, 0), ("1111", 2700000, 0), ("141", 0, 5000000)], None),
            # 14. 13/12: Thanh toán nợ HĐ 140 ngày 30/11 cho Thành Đạt hưởng chiết khấu 5% (BB 30/BTCN, FT25339791951690)
            ("GBN00030", date(2026, 12, 13), "Thanh toán HĐ 140 (100.000.000đ) cho Công ty TNHH Thành Đạt, chiết khấu thanh toán 5% (5.000.000đ), thực chuyển 95.000.000đ",
             [("331", 100000000, 0), ("515", 0, 5000000), ("1121", 0, 95000000)], "THANHDAT"),
            # 15. 15/12: Thu lãi tiền gửi tiết kiệm T11 (FT25339791951720)
            ("GBC00031", date(2026, 12, 15), "Giấy báo có FT25339791951720 Ngân hàng Techcombank trả lãi tiền gửi tháng 11/N",
             [("1121", 1500000, 0), ("515", 0, 1500000)], "NH001"),
            # 16. 16/12: Bán hàng cho khách lẻ thu tiền ngay qua CK (PXK 83, HĐ 154, FT25339791951756)
            ("HDBH00083", date(2026, 12, 16), "Bán lẻ 1 Laptop HP 15s cho Trương Minh Tuấn theo PXK 83, HĐ 154 thu chuyển khoản (FT25339791951756)",
             [("1121", 12320000, 0), ("511", 0, 11200000), ("3331", 0, 1120000)], "KHACHLE"),
            # 17. 16/12: Chi TM tiếp khách tại CTCP Đầu tư Giang Mỹ (PC 182, HĐ 420)
            ("PC00047", date(2026, 12, 16), "Phiếu chi PC 182 thanh toán chi phí tiếp khách theo HĐ 420 của CTCP Đầu tư Giang Mỹ",
             [("642", 2200000, 0), ("1331", 220000, 0), ("1111", 0, 2420000)], "GIANGMY"),
            # 18. 17/12: Bán chứng khoán kinh doanh (FT25339791951795)
            ("GBC00032", date(2026, 12, 17), "Giấy báo có FT25339791951795 thu tiền bán chứng khoán kinh doanh (giá gốc 50.000.000đ, giá bán 60.000.000đ)",
             [("1121", 60000000, 0), ("121", 0, 50000000), ("515", 0, 10000000)], None),
            # 19. 17/12: Thanh lý TSCĐ Dell XPS 15 cho Công ty Anh Tuấn thu TM (HĐ 155, PT 186)
            ("PT00033", date(2026, 12, 17), "Thanh lý máy tính xách tay Dell XPS 15 cho Công ty TNHH Công nghệ số Anh Tuấn theo HĐ 155, PT 186",
             [("1111", 2200000, 0), ("711", 0, 2000000), ("3331", 0, 200000)], "ANHTUAN"),
            # 20. 18/12: Đại lý Hoàng Long thanh toán trừ hoa hồng 10% (HĐ 156, HĐ 89, FT25339791951822)
            ("GBC00033", date(2026, 12, 18), "Đại lý Hoàng Long computer thanh toán tiền hàng bán đại lý (HĐ 156) sau khi trừ hoa hồng 10% (HĐ 89)",
             [("1121", 277200000, 0), ("641", 28000000, 0), ("1331", 2800000, 0), ("511", 0, 280000000), ("3331", 0, 28000000)], "HOANGLONG"),
            # 21. 20/12: Thanh toán 50% HĐ 120 ngày 03/12 cho Vạn Phát qua NH (FT25339791951886)
            ("GBN00031", date(2026, 12, 20), "Giấy báo nợ FT25339791951886 thanh toán 50% HĐ 120 ngày 03/12 cho CTCP Vận tải và Thương mại Vạn Phát",
             [("331", 446600000, 0), ("1121", 0, 446600000)], "VANPHO"),
            # 22. 22/12: Chi TM bảo dưỡng máy lạnh Daikin (PC 183, HĐ 189)
            ("PC00048", date(2026, 12, 22), "Phiếu chi PC 183 thanh toán dịch vụ bảo dưỡng máy lạnh Daikin theo HĐ 189 của Công ty TNHH Thiết bị Thanh Trúc",
             [("642", 1200000, 0), ("1331", 120000, 0), ("1111", 0, 1320000)], "THANHTRU"),
            # 23. 22/12: Bán hàng chưa thu tiền cho Công ty TNHH Phan Minh (PXK 85, HĐ 157) + Chi phí vận chuyển Vạn Phát (HĐ 128, FT25339791951934)
            ("HDBH00085", date(2026, 12, 22), "Bán hàng chưa thu tiền cho Công ty TNHH Phan Minh theo PXK 85, HĐ 157 (Dell 15c, HP 15s 15c, Màn hình LG 27UL500 5c, Bàn phím 5c, Tai nghe 5c)",
             [("131", 526460000, 0), ("511", 0, 478600000), ("3331", 0, 47860000)], "PHANMINH"),
            # 24. 23/12: Mua hàng nhập kho từ Công ty TNHH Thành Đạt (PNK 61, HĐ 150)
            ("PNK00061", date(2026, 12, 23), "Mua hàng nhập kho theo PNK 61, HĐ 150 từ Công ty TNHH Thành Đạt (Dell 15c, HP 15s 15c, Màn hình LG 10c + Cước vận chuyển 1.000.000đ)",
             [("156", 353500000, 0), ("1331", 35350000, 0), ("331", 0, 388850000)], "THANHDAT"),
            # 25. 24/12: Khách hàng Phan Minh trả lại 1 màn hình LG 27UL500 bị cháy (BBTH 10/BBTH, HĐ 158,PNK 62)
            ("HDBTL001", date(2026, 12, 24), "Công ty TNHH Phan Minh trả lại 01 Màn hình LG 27UL500 bị lỗi theo HĐ 158, PNK 62 (giảm trừ công nợ)",
             [("521", 7800000, 0), ("3331", 780000, 0), ("131", 0, 8580000)], "PHANMINH"),
            # 26. 26/12: Giảm giá 2 chiếc Laptop HP 15s mua ngày 23/12 từ Thành Đạt (BB 05/ABC-HL, HĐ 160)
            ("BBGG001", date(2026, 12, 26), "Giảm giá hàng mua 02 chiếc Laptop HP 15s (500.000đ/chiếc) theo HĐ điều chỉnh giảm số 160 từ Công ty TNHH Thành Đạt",
             [("331", 1100000, 0), ("156", 0, 1000000), ("1331", 0, 100000)], "THANHDAT"),
            # 27. 29/12: Xuất kho CCDC cho phòng kế toán (PXK 86)
            ("PXK00086", date(2026, 12, 29), "Xuất kho 02 ghế xoay văn phòng và 01 bàn làm việc theo PXK 86 cho Lê Văn Hiếu - Phòng kế toán (phân bổ 1 lần)",
             [("642", 4100000, 0), ("153", 0, 4100000)], None),
            # 28. 31/12: Tính lương và các khoản trích theo lương T12 (Tổng lương 80.260.000đ, BH tính vào CP 14.512.500đ, BH trừ lương 7.087.500đ)
            ("PKT00001", date(2026, 12, 31), "Hạch toán chi phí tiền lương (80.260.000đ) và các khoản trích theo lương tính vào chi phí (14.512.500đ) tháng 12/N",
             [("641", 35750000, 0), ("642", 59022500, 0), ("334", 0, 80260000), ("338", 0, 14512500)], None),
            # 29. 31/12: Phân bổ CCDC xuất dùng tính vào chi phí T12 (7 mã CCDC đang dùng: 3.003.333đ)
            ("PKT00002", date(2026, 12, 31), "Phân bổ công cụ dụng cụ tháng 12/N (7 mã CCDC: BG001, DT001, KD001, MI001, PD001, TD001, TS001)",
             [("641", 400000, 0), ("642", 2603333, 0), ("242", 0, 3003333)], None),
            # 30. 31/12: Tính và phân bổ khấu hao TSCĐ T12 (8 TSCĐ: 15.905.600đ)
            ("PKT00003", date(2026, 12, 31), "Trích khấu hao TSCĐ tháng 12/N (TK 6414: 1.060.887đ, TK 6424: 14.844.713đ)",
             [("641", 1060887, 0), ("642", 14844713, 0), ("2141", 0, 14544489), ("2143", 0, 1361111)], None),
            # 31. 31/12: Xác định thuế GTGT khấu trừ và phải nộp T12
            ("PKT00004", date(2026, 12, 31), "Khấu trừ thuế GTGT đầu vào và xác định thuế GTGT phải nộp tháng 12/N",
             [("3331", 125657500, 0), ("1331", 0, 125657500)], None),
            # 32. 31/12: Kết chuyển xác định kết quả kinh doanh cuối năm
            ("PKT00005", date(2026, 12, 31), "Kết chuyển doanh thu thuần xác định kết quả kinh doanh tháng 12/N",
             [("511", 1402200000, 0), ("911", 0, 1402200000)], None),
        ]

        if period_12:
            doc_nums = [d[0] for d in tx_data]
            JournalEntry.objects.filter(company=company, number__in=doc_nums).delete()
            created_tx = 0
            for doc_num, doc_date, desc, lines, p_code in tx_data:
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

