import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from organization.models import Company, Branch, Department, Employee
from iam.models import (
    UserAccount, CompanyMembership, Role, Permission, RolePermission,
    UserRoleAssignment, ActiveStatus, RoleStatus, RoleType
)
from iam.platform_views import STANDARD_ROLE_DEFINITIONS

User = get_user_model()

print("===> 1. Creating/Configuring Dedicated Super Admin Account...")
# Dedicated Super Admin
super_user, created = User.objects.get_or_create(
    username="superadmin",
    defaults={
        "email": "superadmin@soviet.vn",
        "first_name": "Super",
        "last_name": "Admin",
        "is_superuser": True,
        "is_staff": True,
        "is_active": True,
    }
)
super_user.is_superuser = True
super_user.is_staff = True
super_user.is_active = True
super_user.set_password("SuperAdmin@2026")
super_user.save()

# UserAccount for superadmin
super_acc, _ = UserAccount.objects.get_or_create(
    auth_user=super_user,
    defaults={"display_name": "Super Admin Hệ Thống", "phone": "0900000000"}
)
print(f"Super Admin ready: username='superadmin', password='SuperAdmin@2026', email='{super_user.email}'")

print("\n===> 2. Configuring Company Admin: tungtimo0808@gmail.com...")
# Company Admin: tungtimo0808@gmail.com
admin_user = User.objects.filter(email="tungtimo0808@gmail.com").first()
if not admin_user:
    admin_user = User.objects.filter(username="timodapoettt").first()
if not admin_user:
    admin_user = User.objects.create_user(
        username="timodapoettt",
        email="tungtimo0808@gmail.com",
        password="123456",
        first_name="Timo",
        last_name="Đỗ",
    )
admin_user.is_superuser = False
admin_user.is_staff = False
admin_user.is_active = True
admin_user.set_password("123456")
admin_user.save()

admin_acc, _ = UserAccount.objects.get_or_create(
    auth_user=admin_user,
    defaults={"display_name": "Đỗ Đức Tùng", "phone": "0988888888"}
)
admin_acc.display_name = "Đỗ Đức Tùng"
admin_acc.save()
print(f"Company Admin ready: email='tungtimo0808@gmail.com', username='{admin_user.username}', password='123456'")

print("\n===> 3. Demoting all other accounts from superuser...")
other_users = User.objects.exclude(username="superadmin")
for u in other_users:
    u.is_superuser = False
    u.is_staff = False
    u.set_password("123456")
    u.save()
    print(f"User {u.username} ({u.email}): is_superuser=False, password='123456'")

print("\n===> 4. Ensuring Company ABC exists and has Roles & Assignments...")
company = Company.objects.filter(code="ABC").first()
if not company:
    company = Company.objects.first()

print(f"Target company: {company.code} - {company.name}")

# Create COMPANY_ADMIN role in ABC
admin_role, _ = Role.objects.get_or_create(
    company=company,
    code="COMPANY_ADMIN",
    defaults={
        "name": "Quản trị viên Doanh nghiệp (Chủ sở hữu)",
        "description": "Toàn quyền quản trị nhân sự, vai trò, cấu hình hệ thống và phê duyệt tài chính doanh nghiệp.",
        "role_type": RoleType.STANDARD,
        "status": RoleStatus.ACTIVE,
        "is_system_admin": True,
        "created_by": admin_acc,
        "updated_by": admin_acc,
    }
)

# Grant all active permissions to COMPANY_ADMIN
all_perms = list(Permission.objects.filter(status=ActiveStatus.ACTIVE))
existing_admin_perm_ids = set(RolePermission.objects.filter(role=admin_role).values_list("permission_id", flat=True))
new_admin_grants = [
    RolePermission(role=admin_role, permission=p, effect="ALLOW")
    for p in all_perms if p.id not in existing_admin_perm_ids
]
if new_admin_grants:
    RolePermission.objects.bulk_create(new_admin_grants)
print(f"COMPANY_ADMIN role has {RolePermission.objects.filter(role=admin_role).count()} permissions.")

# Create the standard business roles
roles_dict = {"COMPANY_ADMIN": admin_role}
for rdef in STANDARD_ROLE_DEFINITIONS:
    r, _ = Role.objects.get_or_create(
        company=company,
        code=rdef["code"],
        defaults={
            "name": rdef["name"],
            "description": rdef["description"],
            "role_type": RoleType.STANDARD,
            "status": RoleStatus.ACTIVE,
            "created_by": admin_acc,
            "updated_by": admin_acc,
        }
    )
    prefixes = rdef["permission_prefixes"]
    matched_perms = [p for p in all_perms if any(p.code.startswith(pr) for pr in prefixes)]
    existing_pids = set(RolePermission.objects.filter(role=r).values_list("permission_id", flat=True))
    new_grants = [RolePermission(role=r, permission=p, effect="ALLOW") for p in matched_perms if p.id not in existing_pids]
    if new_grants:
        RolePermission.objects.bulk_create(new_grants)
    roles_dict[rdef["code"]] = r
    print(f"Role {r.code} ({r.name}): {RolePermission.objects.filter(role=r).count()} permissions.")

# Ensure memberships in ABC and assign roles
# 1. tungtimo0808@gmail.com -> COMPANY_ADMIN
m_admin, _ = CompanyMembership.objects.get_or_create(
    company=company, user=admin_acc,
    defaults={"membership_status": ActiveStatus.ACTIVE, "created_by": admin_acc}
)
m_admin.membership_status = ActiveStatus.ACTIVE
m_admin.save()
UserRoleAssignment.objects.filter(company_membership=m_admin).delete()
UserRoleAssignment.objects.create(
    company_membership=m_admin,
    role=admin_role,
    status=ActiveStatus.ACTIVE,
    assigned_by=admin_acc,
    assign_reason="Chủ sở hữu & Quản trị viên doanh nghiệp",
)
print("Assigned tungtimo0808@gmail.com -> COMPANY_ADMIN")

# Map other accounts to roles inside ABC
assignments_map = [
    ("nongxuanmai098@gmail.com", "+84971389093", "Nông Xuân Mai", "KT_TRUONG", "Phòng Kế toán", "Kế toán trưởng"),
    ("timo2026@example.com", "+84987654321", "Trần Thủ Quỹ", "THU_QUY", "Phòng Tài chính - Quỹ", "Thủ quỹ"),
    ("admin@soviet.vn", "+84912345678", "Lê Kế Toán Bán Hàng", "KT_BANHANG", "Phòng Kinh doanh", "Kế toán bán hàng"),
    ("admin@example.com", "admin", "Nguyễn Kế Toán Mua", "KT_MUAHANG", "Phòng Mua hàng", "Kế toán mua hàng"),
]

branch = Branch.objects.filter(company=company).first()

for email, username, display_name, role_code, dept_name, pos_name in assignments_map:
    usr = User.objects.filter(email=email).first() or User.objects.filter(username=username).first()
    if not usr:
        usr = User.objects.create_user(username=username, email=email, password="123456", first_name=display_name)
    usr.is_superuser = False
    usr.is_staff = False
    usr.set_password("123456")
    usr.save()

    acc, _ = UserAccount.objects.get_or_create(auth_user=usr, defaults={"display_name": display_name, "phone": username if username.startswith("+") else ""})
    acc.display_name = display_name
    acc.save()

    dept, _ = Department.objects.get_or_create(
        company=company, name=dept_name,
        defaults={"code": f"PB_{usr.id}", "branch": branch, "status": "ACTIVE"}
    )
    emp, _ = Employee.objects.get_or_create(
        company=company, employee_code=f"NV_{usr.id}",
        defaults={"full_name": display_name, "email": email, "department": dept, "branch": branch, "status": "ACTIVE"}
    )

    m, _ = CompanyMembership.objects.get_or_create(company=company, user=acc, defaults={"membership_status": ActiveStatus.ACTIVE, "created_by": admin_acc, "employee": emp})
    m.membership_status = ActiveStatus.ACTIVE
    m.employee = emp
    m.save()

    target_role = roles_dict.get(role_code)
    if target_role:
        UserRoleAssignment.objects.filter(company_membership=m).delete()
        UserRoleAssignment.objects.create(
            company_membership=m,
            role=target_role,
            status=ActiveStatus.ACTIVE,
            assigned_by=admin_acc,
            assign_reason=f"Phân công {target_role.name}",
        )
        print(f"Assigned {email} ({display_name}) -> Role: {target_role.code} ({target_role.name})")

print("\n===> ALL ACCOUNTS AND ROLES SETUP COMPLETED SUCCESSFULLY!")
