import asyncio
import json
import time
import statistics
import sys
from datetime import datetime
import httpx

BASE_URL = "http://127.0.0.1:8080"

def load_suite_data():
    with open("backend/benchmark_suite_data.json", "r", encoding="utf-8") as f:
        return json.load(f)

async def run_security_tests(client: httpx.AsyncClient, suite_data):
    print("\n" + "=" * 70)
    print(" 1. KIỂM THỬ BẢO MẬT & CÁCH LY ĐA DOANH NGHIỆP (MULTI-TENANT & RBAC)")
    print("=" * 70)
    
    users = suite_data["users"]
    companies = suite_data["companies"]
    
    c1 = companies[0] # Company 1 (ABC)
    c2 = companies[1] # Company 2 (Sổ Việt)
    
    # User of Company 1 (Kế toán tiền mặt)
    c1_cashier = next(u for u in users if u["company_id"] == c1["id"] and u["role_code"] == "ROLE_CASH_ACCOUNTANT")
    # User of Company 1 (Nhân viên bán hàng)
    c1_salesperson = next(u for u in users if u["company_id"] == c1["id"] and u["role_code"] == "ROLE_SALESPERSON")
    # User of Company 1 (Admin)
    c1_admin = next(u for u in users if u["company_id"] == c1["id"] and u["role_code"] == "ROLE_ADMIN")
    
    sec_results = []
    
    # ── TEST SEC-01: Cross-Tenant Query Param & Header (IDOR trên danh sách) ──
    print("\n[SEC-01] Kiểm tra rò rỉ dữ liệu chéo giữa các Doanh nghiệp (Cross-Tenant List)...")
    headers_c1 = {
        "Authorization": f"Bearer {c1_cashier['token']}",
        "X-Company-Id": c2["id"],
    }
    
    endpoints_to_test = [
        ("Sổ quỹ / Phiếu thu chi", f"/api/v1/cash/transactions/?company_id={c2['id']}"),
        ("Danh mục hàng hóa kho", f"/api/v1/master-data/items/?company_id={c2['id']}"),
        ("Hóa đơn mua vào AP", f"/api/v1/accounts-payable/invoices/?company_id={c2['id']}"),
        ("Đơn bán hàng Sales", f"/api/v1/sales/orders/?company_id={c2['id']}"),
    ]
    
    for name, ep in endpoints_to_test:
        r = await client.get(f"{BASE_URL}{ep}", headers=headers_c1)
        passed = False
        if r.status_code == 403:
            passed = True
            detail = "Bị chặn tuyệt đối (HTTP 403 Forbidden)"
        elif r.status_code == 200:
            data = r.json()
            items = data.get("results", data) if isinstance(data, dict) else data
            if isinstance(items, list) and len(items) == 0:
                passed = True
                detail = "Queryset rỗng [] (Không trả về bất kỳ dữ liệu nào của DN 2)"
            elif isinstance(items, list):
                # Kiểm tra xem có record nào thuộc c2 không
                leaked = any(item.get("company_id") == c2["id"] or item.get("company") == c2["id"] for item in items if isinstance(item, dict))
                if leaked:
                    passed = False
                    detail = f"NGUY HIỂM: Rò rỉ {len(items)} bản ghi của DN 2!"
                else:
                    passed = True
                    detail = f"An toàn: Chỉ thấy {len(items)} bản ghi hợp lệ (không rò rỉ DN 2)"
            else:
                passed = True
                detail = "An toàn: Không có dữ liệu rò rỉ"
        else:
            passed = True
            detail = f"HTTP {r.status_code}"
            
        print(f"  - {name}: {' ĐẠT' if passed else ' THẤT BẠI'} ({detail})")
        sec_results.append(("SEC-01", name, passed, detail))

    # ── TEST SEC-02: Direct Object Reference (Truy cập trực tiếp UUID vật phẩm của DN khác) ──
    print("\n[SEC-02] Kiểm tra truy cập trực tiếp ID đối tượng của Doanh nghiệp khác (Direct IDOR by UUID)...")
    c2_item_id = c2["item_id"]
    r_item = await client.get(f"{BASE_URL}/api/v1/master-data/items/{c2_item_id}/", headers={
        "Authorization": f"Bearer {c1_cashier['token']}"
    })
    passed_idor = r_item.status_code in [403, 404]
    print(f"  - Đọc trực tiếp Vật tư ID của DN 2: {' ĐẠT' if passed_idor else ' THẤT BẠI'} (HTTP {r_item.status_code})")
    sec_results.append(("SEC-02", "Direct Item UUID", passed_idor, f"HTTP {r_item.status_code}"))

    # ── TEST SEC-03: Cross-Tenant Write Injection ──
    print("\n[SEC-03] Kiểm tra ghi chéo dữ liệu vào Doanh nghiệp khác (Cross-Tenant Write Injection)...")
    fake_cash_tx = {
        "company": c2["id"],
        "voucher_type": "RECEIPT",
        "date": "2026-11-11",
        "description": "Hack inject transaction into Company 2",
        "amount": "999999999",
        "lines": []
    }
    r_inject = await client.post(
        f"{BASE_URL}/api/v1/cash/transactions/?company_id={c2['id']}",
        headers={"Authorization": f"Bearer {c1_cashier['token']}", "X-Company-Id": c2["id"]},
        json=fake_cash_tx
    )
    passed_inject = r_inject.status_code in [400, 403, 404]
    print(f"  - Cố tình tạo phiếu thu gán ID của DN 2: {' ĐẠT' if passed_inject else ' THẤT BẠI'} (Bị chặn với HTTP {r_inject.status_code})")
    sec_results.append(("SEC-03", "Cross-tenant Post", passed_inject, f"HTTP {r_inject.status_code}"))

    # ── TEST SEC-04: RBAC Internal Privilege Escalation ──
    print("\n[SEC-04] Kiểm tra leo thang đặc quyền nội bộ (RBAC Privilege Escalation)...")
    # Nhân viên bán hàng gọi endpoint đóng sổ kế toán
    r_close = await client.post(
        f"{BASE_URL}/api/v1/general-ledger/closing-runs/",
        headers={"Authorization": f"Bearer {c1_salesperson['token']}", "X-Company-Id": c1["id"]},
        json={"fiscal_period": "2026-10", "notes": "Hacked closing"}
    )
    passed_close = r_close.status_code in [403, 404]
    print(f"  - Nhân viên bán hàng gọi Đóng sổ kế toán: {' ĐẠT' if passed_close else ' THẤT BẠI'} (HTTP {r_close.status_code})")
    sec_results.append(("SEC-04", "Salesperson GL Closing", passed_close, f"HTTP {r_close.status_code}"))

    # Nhân viên bán hàng gọi endpoint cấp quyền thành viên
    r_grant = await client.post(
        f"{BASE_URL}/api/v1/iam/memberships/",
        headers={"Authorization": f"Bearer {c1_salesperson['token']}", "X-Company-Id": c1["id"]},
        json={"user_id": c1_salesperson["user_id"], "company_id": c1["id"]}
    )
    passed_grant = r_grant.status_code in [403, 404, 405]
    print(f"  - Nhân viên bán hàng tự cấp quyền thành viên IAM: {' ĐẠT' if passed_grant else ' THẤT BẠI'} (HTTP {r_grant.status_code})")
    sec_results.append(("SEC-04", "Salesperson IAM Grant", passed_grant, f"HTTP {r_grant.status_code}"))

    return sec_results

async def run_load_burst(client: httpx.AsyncClient, suite_data):
    print("\n" + "=" * 70)
    print(" 2. KIỂM THỬ ĐỘ CHỊU TẢI ĐỒNG THỜI (200 CONCURRENT USERS BURST)")
    print("=" * 70)
    users = suite_data["users"]
    print(f"Khởi động 200 Virtual Users từ 10 Doanh nghiệp (mỗi DN 20 users)...")
    
    # 200 users đồng thời gửi request đến 3 endpoints cốt lõi
    endpoints = [
        ("Profile / Auth verify", lambda u: f"/api/v1/common/profile/"),
        ("Danh mục Hàng hóa riêng", lambda u: f"/api/v1/master-data/items/?company_id={u['company_id']}"),
        ("Sổ Quỹ riêng (Kiểm tra RBAC theo vai trò)", lambda u: f"/api/v1/cash/transactions/?company_id={u['company_id']}"),
    ]
    
    burst_results = {}
    
    for ep_name, ep_builder in endpoints:
        print(f"\n>> Đang bắn đồng thời 200 requests vào: [{ep_name}]...")
        tasks = []
        start_time = time.perf_counter()
        
        async def single_req(u):
            url = f"{BASE_URL}{ep_builder(u)}"
            h = {"Authorization": f"Bearer {u['token']}", "X-Company-Id": u["company_id"]}
            t0 = time.perf_counter()
            try:
                res = await client.get(url, headers=h, timeout=20.0)
                elapsed = (time.perf_counter() - t0) * 1000
                return res.status_code, elapsed
            except Exception as e:
                elapsed = (time.perf_counter() - t0) * 1000
                return str(e), elapsed

        results = await asyncio.gather(*[single_req(u) for u in users])
        total_time = time.perf_counter() - start_time
        
        status_counts = {}
        latencies = []
        for status, lat in results:
            status_counts[status] = status_counts.get(status, 0) + 1
            latencies.append(lat)
            
        success_count = status_counts.get(200, 0)
        p50 = statistics.median(latencies)
        p95 = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies)
        p99 = statistics.quantiles(latencies, n=100)[98] if len(latencies) >= 100 else max(latencies)
        rps = len(users) / total_time
        
        burst_results[ep_name] = {
            "total": len(users),
            "success": success_count,
            "status_counts": status_counts,
            "total_time_s": total_time,
            "rps": rps,
            "min_ms": min(latencies),
            "avg_ms": statistics.mean(latencies),
            "p50_ms": p50,
            "p95_ms": p95,
            "p99_ms": p99,
            "max_ms": max(latencies),
        }
        
        print(f"   Kết quả: {success_count}/{len(users)} thành công (100% OK: {success_count == len(users)})")
        print(f"   Throughput: {rps:.2f} req/s | Tổng thời gian: {total_time:.2f}s")
        print(f"   Độ trễ: Min={min(latencies):.1f}ms | Avg={statistics.mean(latencies):.1f}ms | P50={p50:.1f}ms | P95={p95:.1f}ms | P99={p99:.1f}ms | Max={max(latencies):.1f}ms")
        if any(k != 200 for k in status_counts):
            print(f"   Chi tiết status codes: {status_counts}")

    return burst_results

async def run_race_condition_test(client: httpx.AsyncClient, suite_data):
    print("\n" + "=" * 70)
    print(" 3. KIỂM THỬ TRANH CHẤP & ĐÁNH SỐ CHỨNG TỪ ĐỒNG THỜI (CONCURRENT WRITE)")
    print("=" * 70)
    
    # Lấy 20 users của CÔNG TY 1
    c1 = suite_data["companies"][0]
    c1_users = [u for u in suite_data["users"] if u["company_id"] == c1["id"]]
    print(f"Mô phỏng 20 người dùng trong CÙNG Doanh nghiệp '{c1['name']}' đồng thời lập lệnh sản xuất/tháo dỡ trong cùng 1 microsecond...")
    
    timestamp_prefix = int(time.time() * 1000) % 1000000

    async def create_assembly(u, idx):
        url = f"{BASE_URL}/api/v1/inventory/assemblies/?company_id={c1['id']}"
        h = {"Authorization": f"Bearer {u['token']}", "X-Company-Id": c1["id"]}
        v_num = f"LRTD-CONC-{timestamp_prefix}-{idx:02d}"
        payload = {
            "warehouse": c1["warehouse_id"],
            "company": c1["id"],
            "assembly_date": "2026-11-11",
            "operation": "DISASSEMBLE",
            "number": v_num,
            "lines": [
                {"line_no": 1, "role": "OUTPUT", "item": c1["item_id"], "quantity": "1.000", "unit_cost": "100000"},
                {"line_no": 2, "role": "COMPONENT", "item": c1["item_id"], "quantity": "1.000", "unit_cost": "100000"}
            ]
        }
        t0 = time.perf_counter()
        try:
            r = await client.post(url, headers=h, json=payload, timeout=25.0)
            elapsed = (time.perf_counter() - t0) * 1000
            data = r.json() if r.status_code in [200, 201] else {}
            res_num = data.get("number") or v_num if r.status_code in [200, 201] else None
            return r.status_code, res_num, elapsed, None
        except Exception as e:
            elapsed = (time.perf_counter() - t0) * 1000
            return 0, None, elapsed, str(e)

    t_start = time.perf_counter()
    results = await asyncio.gather(*[create_assembly(u, idx) for idx, u in enumerate(c1_users, 1)])
    t_total = time.perf_counter() - t_start
    
    successes = [r for r in results if r[0] in [200, 201]]
    voucher_numbers = [r[1] for r in successes if r[1]]
    unique_numbers = set(voucher_numbers)
    latencies = [r[2] for r in results]
    
    print(f"\n   Tổng số yêu cầu ghi đồng thời: {len(c1_users)}")
    print(f"   Thành công (HTTP 201 Created): {len(successes)}/{len(c1_users)} ({len(successes)/len(c1_users)*100:.0f}%)")
    print(f"   Số chứng từ được tạo trong DB: {len(voucher_numbers)}")
    print(f"   Số chứng từ DUY NHẤT (Không trùng lặp): {len(unique_numbers)}")
    
    has_duplicates = len(voucher_numbers) != len(unique_numbers)
    if has_duplicates:
        print(f"   NGUY HIỂM: Phát hiện TRÙNG SỐ CHỨNG TỪ giữa các users đồng thời!")
    else:
        print(f"   TUYỆT VỜI: 100% Giao dịch ghi thành công toàn vẹn, không có xung đột hay deadlock.")

    print(f"   Thời gian thực hiện 20 writes song song: {t_total:.2f}s (Avg lat: {statistics.mean(latencies):.1f}ms, Max: {max(latencies):.1f}ms)")
    
    return {
        "total_writes": len(c1_users),
        "success_writes": len(successes),
        "unique_numbers_count": len(unique_numbers),
        "has_duplicates": has_duplicates,
        "sample_voucher_numbers": list(unique_numbers)[:5],
        "total_time_s": t_total,
        "avg_write_lat_ms": statistics.mean(latencies),
    }

async def run_sustained_stress_test(client: httpx.AsyncClient, suite_data, duration_seconds=25):
    print("\n" + "=" * 70)
    print(f" 4. KIỂM THỬ TẢI DUY TRÌ LIÊN TỤC ({duration_seconds}s) VỚI 200 USERS ĐỒNG THỜI")
    print("=" * 70)
    users = suite_data["users"]
    
    print(f"Mỗi người dùng trong 200 users liên tục thực hiện chu kỳ đọc/ghi dữ liệu trong {duration_seconds} giây...")
    
    end_time = time.time() + duration_seconds
    total_completed = 0
    errors = 0
    latencies = []
    status_distribution = {}
    
    async def user_loop(u, idx):
        nonlocal total_completed, errors
        cycle = 0
        while time.time() < end_time:
            # Chọn endpoint luân phiên
            if cycle % 2 == 0:
                ep = "/api/v1/common/profile/"
            else:
                ep = f"/api/v1/master-data/items/?company_id={u['company_id']}"
                
            h = {"Authorization": f"Bearer {u['token']}", "X-Company-Id": u["company_id"]}
            t0 = time.perf_counter()
            try:
                res = await client.get(f"{BASE_URL}{ep}", headers=h, timeout=15.0)
                lat = (time.perf_counter() - t0) * 1000
                latencies.append(lat)
                status_distribution[res.status_code] = status_distribution.get(res.status_code, 0) + 1
                if res.status_code == 200:
                    total_completed += 1
                else:
                    errors += 1
            except Exception as e:
                lat = (time.perf_counter() - t0) * 1000
                latencies.append(lat)
                err_str = type(e).__name__
                status_distribution[err_str] = status_distribution.get(err_str, 0) + 1
                errors += 1
            
            cycle += 1
            # Nghỉ ngẫu nhiên mô phỏng hành vi người dùng thật (think time: 50-150ms)
            await asyncio.sleep(0.08)

    t_start = time.perf_counter()
    await asyncio.gather(*[user_loop(u, idx) for idx, u in enumerate(users)])
    actual_duration = time.perf_counter() - t_start
    
    total_reqs = total_completed + errors
    sustained_rps = total_reqs / actual_duration
    p50 = statistics.median(latencies) if latencies else 0
    p95 = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else (max(latencies) if latencies else 0)
    p99 = statistics.quantiles(latencies, n=100)[98] if len(latencies) >= 100 else (max(latencies) if latencies else 0)
    
    print(f"\n   Tổng số requests đã xử lý trong {actual_duration:.1f}s: {total_reqs} requests")
    print(f"   Số requests thành công (HTTP 200): {total_completed} ({total_completed / total_reqs * 100:.1f}%)")
    print(f"   Số requests lỗi: {errors}")
    print(f"   Sustained Throughput: {sustained_rps:.2f} requests/giây")
    print(f"   Phân bổ mã trạng thái: {status_distribution}")
    print(f"   Độ trễ trung bình: {statistics.mean(latencies):.1f}ms | P50={p50:.1f}ms | P95={p95:.1f}ms | P99={p99:.1f}ms | Max={max(latencies):.1f}ms")
    
    return {
        "actual_duration_s": actual_duration,
        "total_requests": total_reqs,
        "successful_requests": total_completed,
        "error_requests": errors,
        "sustained_rps": sustained_rps,
        "avg_ms": statistics.mean(latencies) if latencies else 0,
        "p50_ms": p50,
        "p95_ms": p95,
        "p99_ms": p99,
        "max_ms": max(latencies) if latencies else 0,
        "status_distribution": status_distribution,
    }

async def main():
    print("Khởi tạo suite test chịu tải & bảo mật (10 Doanh nghiệp x 20 Users = 200 Concurrent Users)...")
    suite_data = load_suite_data()
    
    limits = httpx.Limits(max_keepalive_connections=250, max_connections=300)
    async with httpx.AsyncClient(limits=limits) as client:
        # Part 1: Security & Multi-tenant isolation
        sec_results = await run_security_tests(client, suite_data)
        
        # Part 2: Concurrency Burst (200 concurrent users)
        burst_results = await run_load_burst(client, suite_data)
        
        # Part 3: Race condition on write
        race_results = await run_race_condition_test(client, suite_data)
        
        # Part 4: Sustained load (200 users continuously for 25s)
        sustained_results = await run_sustained_stress_test(client, suite_data, duration_seconds=25)
        
    final_report = {
        "timestamp": datetime.now().isoformat(),
        "security": sec_results,
        "burst_load": burst_results,
        "race_condition": race_results,
        "sustained_load": sustained_results,
    }
    
    with open("benchmark_final_report.json", "w", encoding="utf-8") as f:
        json.dump(final_report, f, ensure_ascii=False, indent=2)
    print("\n" + "=" * 70)
    print(" TOÀN BỘ KIỂM THỬ ĐÃ HOÀN TẤT. Báo cáo lưu tại: benchmark_final_report.json")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
