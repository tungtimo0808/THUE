import os
import sys
import json
import uuid
from datetime import timedelta
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from organization.models import Company, Branch
from iam.models import UserAccount, CompanyMembership, Role, UserRoleAssignment, MembershipStatus, AssignmentStatus
from common_services.models import UserPreference, UserLoginSession, UserSessionState
from master_data.models import Warehouse, Item, UnitOfMeasure, Party
from rest_framework_simplejwt.tokens import RefreshToken

ROLE_MAPPING = [
    ("ROLE_ADMIN", "Quản trị viên"),
    ("ROLE_DIRECTOR", "Giám đốc"),
    ("ROLE_CHIEF_ACCOUNTANT", "Kế toán trưởng"),
    ("ROLE_GENERAL_ACCOUNTANT", "Kế toán tổng hợp"),
    ("ROLE_CASH_ACCOUNTANT", "Kế toán tiền mặt"),
    ("ROLE_BANK_ACCOUNTANT", "Kế toán ngân hàng"),
    ("ROLE_INVENTORY_ACCOUNTANT", "Kế toán kho"),
    ("ROLE_SALES_ACCOUNTANT", "Kế toán bán hàng"),
    ("ROLE_PURCHASE_ACCOUNTANT", "Kế toán mua hàng"),
    ("ROLE_TAX_ACCOUNTANT", "Kế toán thuế"),
    ("ROLE_TREASURER", "Thủ quỹ"),
    ("ROLE_STOREKEEPER", "Thủ kho"),
    ("ROLE_SALESPERSON", "Nhân viên bán hàng"),
    ("ROLE_PURCHASER", "Nhân viên mua hàng"),
    ("ROLE_AUDITOR", "Kiểm toán"),
    ("ROLE_REPORT_VIEWER", "Người xem báo cáo"),
    ("ROLE_CASH_ACCOUNTANT", "Kế toán tiền mặt 2"),
    ("ROLE_INVENTORY_ACCOUNTANT", "Kế toán kho 2"),
    ("ROLE_SALES_ACCOUNTANT", "Kế toán bán hàng 2"),
    ("ROLE_GENERAL_ACCOUNTANT", "Kế toán tổng hợp 2"),
]

def prepare_benchmark():
    print("=== BẮT ĐẦU CHUẨN BỊ DỮ LIỆU: 10 DOANH NGHIỆP x 20 NGƯỜI DÙNG ===")
    
    # 1. Chọn 10 công ty sẵn có
    companies = list(Company.objects.filter(roles__isnull=False).distinct().order_by("created_at")[:10])
    if len(companies) < 10:
        print(f"Cảnh báo: Chỉ tìm thấy {len(companies)} công ty!")
    else:
        print(f"Đã chọn {len(companies)} doanh nghiệp độc lập:")
    
    for idx, c in enumerate(companies, 1):
        print(f"  {idx}. [{c.tax_code}] {c.name} (ID: {c.id})")

    # Superadmin / system actor
    creator = UserAccount.objects.first()

    suite_data = {
        "companies": [],
        "users": [],
    }

    total_users_created = 0

    for c_idx, company in enumerate(companies, 1):
        # Đảm bảo có Branch, Warehouse, UOM, Item
        branch = Branch.objects.filter(company=company).first()
        if not branch:
            branch = Branch.objects.create(company=company, code="HQ", name="Trụ sở chính", address=company.address)
        
        warehouse = Warehouse.objects.filter(company=company).first()
        if not warehouse:
            warehouse = Warehouse.objects.create(company=company, code=f"KHO-{c_idx}", name=f"Kho chính {company.code}")
        
        uom = UnitOfMeasure.objects.filter(company=company).first()
        if not uom:
            uom = UnitOfMeasure.objects.create(
                company=company, code="CAI", name="Cái", symbol="cái", status="ACTIVE", is_reference=True
            )
            
        item = Item.objects.filter(company=company).first()
        if not item:
            item = Item.objects.create(
                company=company, code=f"HH-{c_idx}-01", name=f"Hàng hóa mẫu {c_idx}",
                base_uom=uom, item_type="GOODS", purchase_price=100000, sales_price=150000,
                status="ACTIVE", track_inventory=True
            )

        company_info = {
            "index": c_idx,
            "id": str(company.id),
            "name": company.name,
            "code": company.code,
            "tax_code": company.tax_code,
            "warehouse_id": str(warehouse.id),
            "item_id": str(item.id),
            "item_code": item.code,
            "users": []
        }

        # 20 Users per company
        for u_idx in range(1, 21):
            username = f"loadtest_c{c_idx:02d}_u{u_idx:02d}"
            role_code, role_title = ROLE_MAPPING[u_idx - 1]
            
            auth_user, _ = User.objects.get_or_create(
                username=username,
                defaults={"email": f"{username}@benchmark.vn", "is_active": True}
            )
            auth_user.set_password("Benchmark@2026!")
            auth_user.save()

            iam_account, _ = UserAccount.objects.get_or_create(
                auth_user=auth_user,
                defaults={
                    "display_name": f"{role_title} DN{c_idx}",
                    "phone": f"0988{c_idx:02d}{u_idx:02d}00",
                    "can_create_company": False
                }
            )

            # Membership
            membership, _ = CompanyMembership.objects.get_or_create(
                company=company,
                user=iam_account,
                defaults={
                    "membership_status": MembershipStatus.ACTIVE,
                    "join_source": "BOOTSTRAP",
                    "created_by": creator or iam_account,
                }
            )
            membership.membership_status = MembershipStatus.ACTIVE
            membership.save()

            # Role assignment
            role_obj = Role.objects.filter(company=company, code=role_code).first()
            if not role_obj:
                role_obj = Role.objects.filter(company=company).first()
            
            if role_obj:
                UserRoleAssignment.objects.get_or_create(
                    company_membership=membership,
                    role=role_obj,
                    valid_from=timezone.now() - timedelta(days=1),
                    defaults={
                        "status": AssignmentStatus.ACTIVE,
                        "assigned_by": creator or iam_account
                    }
                )

            # User preference
            pref, _ = UserPreference.objects.get_or_create(
                user=iam_account,
                defaults={
                    "email_verified_at": timezone.now(),
                    "current_company": company,
                    "current_branch": branch,
                    "locale": "vi",
                    "timezone": "Asia/Ho_Chi_Minh",
                    "settings": {},
                    "avatar": "",
                    "privacy_version": "v1",
                    "terms_version": "v1",
                }
            )
            pref.current_company = company
            pref.current_branch = branch
            pref.email_verified_at = timezone.now()
            pref.save()

            # Issue valid session and JWT
            refresh = RefreshToken.for_user(auth_user)
            session = UserLoginSession.objects.create(
                user=auth_user,
                refresh_jti=str(refresh["jti"]),
                ip_address="127.0.0.1",
                user_agent="BenchmarkLoadAgent/1.0",
                expires_at=timezone.now() + timedelta(days=7),
            )
            access = refresh.access_token
            access["sid"] = str(session.id)
            token_str = str(access)

            user_data = {
                "user_idx": u_idx,
                "company_idx": c_idx,
                "username": username,
                "user_id": str(iam_account.id),
                "auth_user_id": auth_user.id,
                "display_name": iam_account.display_name,
                "role_code": role_code,
                "role_name": role_obj.name if role_obj else role_title,
                "company_id": str(company.id),
                "company_tax_code": company.tax_code,
                "token": token_str,
            }
            suite_data["users"].append(user_data)
            company_info["users"].append(user_data)
            total_users_created += 1

        suite_data["companies"].append(company_info)

    out_path = "/app/benchmark_suite_data.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(suite_data, f, ensure_ascii=False, indent=2)

    print(f"\n HOÀN TẤT: Đã tạo và cấp quyền cho {total_users_created} người dùng trên {len(companies)} doanh nghiệp.")
    print(f" Dữ liệu đã lưu tại: {out_path}")

if __name__ == "__main__":
    prepare_benchmark()
