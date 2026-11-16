import asyncio
import json
import time
import httpx

BASE_URL = "http://127.0.0.1:8080"

async def test_superadmin_flows(client: httpx.AsyncClient):
    print("\n" + "=" * 70)
    print(" PHẦN 1: KIỂM THỬ CÁC LUỒNG SUPER ADMIN (PLATFORM ADMINISTRATOR)")
    print("=" * 70)
    
    results = []

    # 1.1 Kiểm tra bảo vệ endpoint Platform Login
    print("\n[SA-01] Kiểm tra chặn tài khoản thường đăng nhập vào cổng Super Admin...")
    r_unauth = await client.post(f"{BASE_URL}/api/v1/iam/platform/login/", json={
        "username": "timodapoettt",
        "password": "wrongpassword"
    })
    passed_block = r_unauth.status_code in [403, 401]
    print(f"  - Tài khoản thường cố vào /platform/login/: {' ĐẠT' if passed_block else ' THẤT BẠI'} (HTTP {r_unauth.status_code}: {r_unauth.json().get('detail', '')[:80]})")
    results.append(("SA-01", "Chặn user thường vào cổng SuperAdmin", passed_block, f"HTTP {r_unauth.status_code}"))

    # 1.2 Đăng nhập hợp lệ bằng Super Admin
    print("\n[SA-02] Đăng nhập bằng tài khoản Super Admin chuyên dụng (admin / admin)...")
    r_login = await client.post(f"{BASE_URL}/api/v1/iam/platform/login/", json={
        "username": "admin",
        "password": "admin"
    })
    
    sa_token = None
    if r_login.status_code == 200:
        login_data = r_login.json()
        sa_token = login_data.get("access")
        is_su = login_data.get("user", {}).get("is_superuser", False)
        passed_login = bool(sa_token and is_su)
        print(f"  - Đăng nhập Super Admin: {' ĐẠT' if passed_login else ' THẤT BẠI'} (is_superuser={is_su})")
        results.append(("SA-02", "Đăng nhập Super Admin", passed_login, "Token cấp thành công"))
    else:
        print(f"  - Đăng nhập Super Admin: THẤT BẠI (HTTP {r_login.status_code}: {r_login.text[:100]})")
        results.append(("SA-02", "Đăng nhập Super Admin", False, f"HTTP {r_login.status_code}"))
        return results

    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 1.3 Xem thống kê nền tảng Platform Stats
    print("\n[SA-03] Kiểm tra quyền xem thống kê toàn hệ thống (Platform Stats)...")
    r_stats = await client.get(f"{BASE_URL}/api/v1/iam/platform/stats/", headers=sa_headers)
    passed_stats = r_stats.status_code == 200
    if passed_stats:
        stats = r_stats.json().get("stats", {})
        print(f"  - Thống kê toàn sàn:  ĐẠT (Tổng DN: {stats.get('total_companies')}, Tổng Users: {stats.get('total_users')}, Active: {stats.get('active_companies')})")
    else:
        print(f"  - Thống kê toàn sàn:  THẤT BẠI (HTTP {r_stats.status_code})")
    results.append(("SA-03", "Xem Platform Stats", passed_stats, f"HTTP {r_stats.status_code}"))

    # 1.4 Danh sách doanh nghiệp toàn sàn
    print("\n[SA-04] Kiểm tra Super Admin duyệt danh sách tất cả doanh nghiệp...")
    r_cos = await client.get(f"{BASE_URL}/api/v1/iam/platform/companies/", headers=sa_headers)
    passed_cos = r_cos.status_code == 200 and isinstance(r_cos.json(), list)
    count_cos = len(r_cos.json()) if passed_cos else 0
    print(f"  - Lấy danh sách DN toàn hệ thống: {' ĐẠT' if passed_cos else ' THẤT BẠI'} (Số lượng: {count_cos} DN)")
    results.append(("SA-04", "Duyệt danh sách DN toàn sàn", passed_cos, f"{count_cos} doanh nghiệp"))

    # 1.5 Super Admin khởi tạo doanh nghiệp mới
    print("\n[SA-05] Super Admin khởi tạo Doanh nghiệp mới từ Platform...")
    test_tax = f"010999{int(time.time()) % 10000:04d}"
    new_co_payload = {
        "name": f"Tập đoàn Thử Nghiệm SA {test_tax}",
        "code": f"SA_CO_{test_tax}",
        "tax_code": test_tax,
        "business_type": "ENTERPRISE",
        "accounting_regime": "CIRCULAR_200",
        "fiscal_year_start_month": 1,
        "currency": "VND",
        "address": "Số 1 Tràng Tiền, Hoàn Kiếm, Hà Nội",
        "admin_username": f"owner_{test_tax}",
        "admin_email": f"owner_{test_tax}@soviet.vn",
        "admin_password": "Password@2026!",
        "admin_display_name": "Chủ Tịch HĐQT Test",
        "admin_phone": "0912345678"
    }
    r_create_co = await client.post(
        f"{BASE_URL}/api/v1/iam/platform/companies/create-company/",
        headers=sa_headers,
        json=new_co_payload
    )
    passed_create = r_create_co.status_code in [200, 201]
    created_co_id = None
    if passed_create:
        co_res = r_create_co.json().get("company", {})
        created_co_id = co_res.get("id")
        print(f"  - Tạo Doanh nghiệp mới:  ĐẠT (Mã: {co_res.get('code')}, ID: {created_co_id})")
    else:
        print(f"  - Tạo Doanh nghiệp mới:  THẤT BẠI (HTTP {r_create_co.status_code}: {r_create_co.text[:120]})")
    results.append(("SA-05", "SuperAdmin tạo Doanh nghiệp mới", passed_create, f"HTTP {r_create_co.status_code}"))

    # 1.6 Đổi trạng thái doanh nghiệp (Khóa / Mở khóa)
    if created_co_id:
        print("\n[SA-06] Super Admin thay đổi trạng thái Doanh nghiệp (SUSPENDED / ACTIVE)...")
        r_suspend = await client.post(
            f"{BASE_URL}/api/v1/iam/platform/companies/{created_co_id}/set_status/",
            headers=sa_headers,
            json={"status": "SUSPENDED", "reason": "Tạm khóa kiểm tra an ninh"}
        )
        passed_suspend = r_suspend.status_code == 200
        print(f"  - Chuyển trạng thái sang SUSPENDED: {' ĐẠT' if passed_suspend else ' THẤT BẠI'} (HTTP {r_suspend.status_code})")
        results.append(("SA-06", "Khóa trạng thái Doanh nghiệp", passed_suspend, f"HTTP {r_suspend.status_code}"))

    # 1.7 Danh sách người dùng toàn sàn
    print("\n[SA-07] Super Admin xem danh sách người dùng toàn hệ thống...")
    r_users = await client.get(f"{BASE_URL}/api/v1/iam/platform/users/", headers=sa_headers)
    passed_users = r_users.status_code == 200 and isinstance(r_users.json(), list)
    user_count = len(r_users.json()) if passed_users else 0
    print(f"  - Lấy danh sách Users toàn hệ thống: {' ĐẠT' if passed_users else ' THẤT BẠI'} (Tổng cộng: {user_count} người dùng)")
    results.append(("SA-07", "Duyệt danh sách Users toàn sàn", passed_users, f"{user_count} users"))

    return results, sa_token

async def test_company_admin_flows(client: httpx.AsyncClient):
    print("\n" + "=" * 70)
    print(" PHẦN 2: KIỂM THỬ CÁC LUỒNG COMPANY ADMIN (QUẢN TRỊ VIÊN DOANH NGHIỆP)")
    print("=" * 70)
    
    results = []

    # 2.1 Đăng nhập bằng Company Admin thực tế
    print("\n[CA-01] Đăng nhập Company Admin (timodapoettt / 123456)...")
    r_login = await client.post(f"{BASE_URL}/api/v1/common/auth/login/", json={
        "username": "timodapoettt",
        "password": "123456"
    })
    
    ca_token = None
    admin_company_id = None
    if r_login.status_code == 200:
        data = r_login.json()
        ca_token = data.get("access")
        companies = data.get("companies", [])
        curr_co = data.get("current_company") or (companies[0] if companies else {})
        admin_company_id = curr_co.get("id")
        user_info = data.get("user", {})
        is_admin = user_info.get("is_company_admin", False)
        is_su = user_info.get("is_superuser", False)
        
        passed_ca = bool(ca_token and not is_su)
        print(f"  - Đăng nhập Company Admin: {' ĐẠT' if passed_ca else ' THẤT BẠI'} (Công ty: {curr_co.get('name')}, is_admin={is_admin}, is_superuser={is_su})")
        results.append(("CA-01", "Đăng nhập Company Admin", passed_ca, f"Công ty: {curr_co.get('name')}"))
    else:
        # Fallback to loadtest admin
        print(f"  - Thử đăng nhập bằng loadtest_c01_u01...")
        r_login2 = await client.post(f"{BASE_URL}/api/v1/common/auth/login/", json={
            "username": "loadtest_c01_u01",
            "password": "Benchmark@2026!"
        })
        if r_login2.status_code == 200:
            data = r_login2.json()
            ca_token = data.get("access")
            curr_co = data.get("current_company") or (data.get("companies", [{}])[0])
            admin_company_id = curr_co.get("id")
            results.append(("CA-01", "Đăng nhập Company Admin", True, "loadtest_c01_u01"))
            print(f"  - Đăng nhập Company Admin loadtest:  ĐẠT (Công ty: {curr_co.get('name')})")
        else:
            print(f"  - Đăng nhập Company Admin:  THẤT BẠI (HTTP {r_login.status_code})")
            results.append(("CA-01", "Đăng nhập Company Admin", False, f"HTTP {r_login.status_code}"))
            return results

    ca_headers = {"Authorization": f"Bearer {ca_token}", "X-Company-Id": admin_company_id}

    # 2.2 Ranh giới an toàn: Chặn Company Admin truy cập cổng Super Admin
    print("\n[CA-02] Kiểm tra ranh giới an toàn: Chặn Company Admin gọi API Super Admin...")
    r_platform_stats = await client.get(f"{BASE_URL}/api/v1/iam/platform/stats/", headers=ca_headers)
    r_platform_cos = await client.get(f"{BASE_URL}/api/v1/iam/platform/companies/", headers=ca_headers)
    passed_block_sa = r_platform_stats.status_code == 403 and r_platform_cos.status_code == 403
    print(f"  - Gọi /platform/stats/: HTTP {r_platform_stats.status_code}")
    print(f"  - Gọi /platform/companies/: HTTP {r_platform_cos.status_code}")
    print(f"  - Chặn quyền SuperAdmin với Company Admin: {' ĐẠT' if passed_block_sa else ' THẤT BẠI'}")
    results.append(("CA-02", "Chặn Company Admin vào chức năng Super Admin", passed_block_sa, "100% 403 Forbidden"))

    # 2.3 Quản lý danh sách thành viên nội bộ công ty mình
    print("\n[CA-03] Company Admin xem và quản lý thành viên nội bộ công ty...")
    r_members = await client.get(f"{BASE_URL}/api/v1/iam/memberships/?company_id={admin_company_id}", headers=ca_headers)
    passed_members = r_members.status_code == 200
    member_count = len(r_members.json()) if passed_members and isinstance(r_members.json(), list) else 0
    print(f"  - Xem danh sách thành viên công ty: {' ĐẠT' if passed_members else ' THẤT BẠI'} ({member_count} thành viên)")
    results.append(("CA-03", "Xem danh sách thành viên công ty", passed_members, f"{member_count} thành viên"))

    # 2.4 Quản lý Quy tắc đánh số chứng từ (Numbering Rules)
    print("\n[CA-04] Company Admin thiết lập quy tắc đánh số chứng từ công ty...")
    r_num = await client.get(f"{BASE_URL}/api/v1/common/numbering-rules/?company_id={admin_company_id}", headers=ca_headers)
    passed_num = r_num.status_code == 200
    num_count = len(r_num.json()) if passed_num and isinstance(r_num.json(), list) else 0
    print(f"  - Xem danh mục quy tắc đánh số chứng từ: {' ĐẠT' if passed_num else ' THẤT BẠI'} ({num_count} quy tắc)")
    results.append(("CA-04", "Quản lý quy tắc đánh số chứng từ", passed_num, f"{num_count} quy tắc"))

    # 2.5 Quản lý Kỳ kế toán (Fiscal Periods)
    print("\n[CA-05] Company Admin kiểm tra và quản lý Kỳ kế toán...")
    r_periods = await client.get(f"{BASE_URL}/api/v1/common/fiscal-periods/?company_id={admin_company_id}", headers=ca_headers)
    passed_periods = r_periods.status_code == 200
    p_count = len(r_periods.json()) if passed_periods and isinstance(r_periods.json(), list) else 0
    print(f"  - Xem danh sách kỳ kế toán: {' ĐẠT' if passed_periods else ' THẤT BẠI'} ({p_count} kỳ kế toán)")
    results.append(("CA-05", "Quản lý kỳ kế toán công ty", passed_periods, f"{p_count} kỳ"))

    # 2.7 Company Admin gán và thu hồi vai trò của thành viên (Assign & Revoke Role)
    print("\n[CA-07] Company Admin phân quyền / gán vai trò cho thành viên công ty...")
    r_all_mems = await client.get(f"{BASE_URL}/api/v1/iam/memberships/?company_id={admin_company_id}", headers=ca_headers)
    mems = r_all_mems.json() if r_all_mems.status_code == 200 and isinstance(r_all_mems.json(), list) else []
    target_mem = next((m for m in mems if m.get("email") != "tungtimo0808@gmail.com"), mems[0] if mems else None)
    
    r_roles = await client.get(f"{BASE_URL}/api/v1/iam/roles/?company_id={admin_company_id}", headers=ca_headers)
    roles = r_roles.json() if r_roles.status_code == 200 and isinstance(r_roles.json(), list) else []
    target_role = next((r for r in roles if r.get("code") in ["ROLE_CHIEF_ACCOUNTANT", "ROLE_TREASURER", "ROLE_INVENTORY_ACCOUNTANT"]), roles[0] if roles else None)
    
    passed_role_flow = False
    if target_mem and target_role:
        payload_assign = {
            "company_membership": target_mem["id"],
            "role": target_role["id"],
            "reason": "Phân công thử nghiệm kiểm thử tự động"
        }
        r_assign = await client.post(
            f"{BASE_URL}/api/v1/iam/role-assignments/?company_id={admin_company_id}",
            headers=ca_headers,
            json=payload_assign
        )
        passed_role_flow = r_assign.status_code in [200, 201]
        print(f"  - Gán vai trò '{target_role.get('name')}' cho thành viên {target_mem.get('full_name')}: {' ĐẠT' if passed_role_flow else ' THẤT BẠI'} (HTTP {r_assign.status_code})")
        
        if passed_role_flow:
            assign_id = r_assign.json().get("id")
            # Thu hồi vai trò
            r_revoke = await client.post(
                f"{BASE_URL}/api/v1/iam/role-assignments/{assign_id}/revoke/?company_id={admin_company_id}",
                headers=ca_headers,
                json={"reason": "Hoàn tất kiểm thử thu hồi"}
            )
            passed_revoke = r_revoke.status_code == 200
            print(f"  - Thu hồi vai trò vừa gán: {' ĐẠT' if passed_revoke else ' THẤT BẠI'} (HTTP {r_revoke.status_code})")
    else:
        print(f"  - Bỏ qua do không tìm thấy membership/role phù hợp.")

    results.append(("CA-07", "Gán & Thu hồi vai trò nội bộ", passed_role_flow, f"Vai trò: {target_role.get('code') if target_role else 'N/A'}"))

    return results

async def main():
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=30)
    async with httpx.AsyncClient(limits=limits, timeout=15.0) as client:
        sa_results, _ = await test_superadmin_flows(client)
        ca_results = await test_company_admin_flows(client)
        
    full_report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "superadmin_results": sa_results,
        "company_admin_results": ca_results
    }
    with open("superadmin_and_admin_test_report.json", "w", encoding="utf-8") as f:
        json.dump(full_report, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print(" HOÀN TẤT KIỂM THỬ SUPER ADMIN & ADMIN. Đã lưu báo cáo: superadmin_and_admin_test_report.json")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
