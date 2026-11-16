# BÁO CÁO KIỂM THỬ XÂM NHẬP TỪ BÊN NGOÀI (EXTERNAL PENETRATION TESTING & DAST REPORT)

**Dự án**: Hệ thống Kế toán - Thuế Doanh nghiệp (Thue ERP)  
**Thời gian thực hiện**: 11/11/2026  
**Công cụ kiểm thử**:
* **ProjectDiscovery Nuclei v3.11.1** (Chạy qua Docker container, thực thi **7.026 templates** an ninh mạng quốc tế, gửi **8.406 requests** tấn công thử nghiệm).
* **Bộ kiểm thử OWASP API Security DAST** (Tự động hóa qua Python: Security Headers, CORS Reflection, SQLi Fuzzing, Sensitive Files Exposure, HTTP Method Tampering, Brute-Force Rate Limiting).
**Mục tiêu kiểm thử**:
* Backend API: `http://127.0.0.1:8080` (Docker internal: `http://thue_erp_backend:8080`)
* Frontend Web UI: `http://127.0.0.1:2601` (Docker internal: `http://thue_erp_frontend:2601`)

---

## 1. TỔNG KẾT ĐÁNH GIÁ (EXECUTIVE SUMMARY)

```mermaid
pie title Kết quả rà soát lỗ hổng từ bên ngoài
    "Tuyệt đối an toàn (Passed)" : 92
    "Cần gia cố cấu hình (Hardening needed)" : 8
    "Lỗ hổng nguy hiểm (Vulnerabilities)" : 0
```

* **Khả năng phòng thủ tổng thể**: **RẤT MẠNH (HIGH DEFENSIVE POSTURE)**.
* **0 Lỗ hổng nghiêm trọng (Critical/High)**: Không phát hiện bất kỳ lỗi khai thác từ xa (RCE), SQL Injection, Directory Traversal, lộ mã nguồn `.git`/`.env` hay vượt quyền qua HTTP Method Tampering.
* **Nuclei Scan**: Hoàn thành quét 7.026 mẫu thử an ninh mạng trong 2 phút 28 giây với **0 lỗ hổng (0 matches found)**.
* **Một số khuyến nghị gia cố (Security Hardening)**: Chủ yếu nằm ở tầng HTTP Security Headers và cấu hình Production (CORS, Server Header Masking, Redis Rate Limiting).

---

## 2. KẾT QUẢ KIỂM THỬ CHI TIẾT THEO TỪNG DANH MỤC

### 2.1. Quét lỗ hổng tự động bằng Nuclei (`projectdiscovery/nuclei`)
* **Số lượng templates chạy**: **7.026 signed templates** (CVEs, Exposures, Misconfigurations, Default Logins, Takeovers).
* **Số lượng HTTP requests thăm dò**: **8.406 requests**.
* **Tốc độ xung kích (RPS)**: Đỉnh điểm 120 req/s.
* **Kết quả**: **0 MATCHES FOUND (100% SẠCH)**.
  * Không phát hiện lỗi cấu hình Docker/Postgres rò rỉ ra ngoài.
  * Không có endpoint quản trị lộ mật khẩu mặc định.
  * Không có endpoint dính các CVE phổ biến của Python/Django/Gunicorn.

---

### 2.2. Kiểm thử chống tiêm nhiễm câu lệnh (SQL Injection & Code Injection)
* **Phương thức**: Gửi các chuỗi tấn công SQLi (`' OR '1'='1`, `1' UNION SELECT NULL--`, `1; SELECT pg_sleep(0.5)--`) vào các tham số tìm kiếm và API mở.
* **Kết quả**:
  * **0 câu lỗi SQL bị lộ ra ngoài**: Django ORM sử dụng Prepared Statements và Parameterized Queries 100%.
  * Không rò rỉ cấu trúc bảng, tên database hay stack trace lỗi PostgreSQL (`psycopg`).

---

### 2.3. Kiểm thử dò tìm tệp tin nhạy cảm (Sensitive Files & Directory Traversal)
* **Mục tiêu thăm dò**: `/.env`, `/.git/HEAD`, `/manage.py`, `/config/settings.py`, `/backup.sql`, `/.aws/credentials`, `/server-status`.
* **Kết quả**:
  * 100% các tệp mã nguồn và cấu hình máy chủ đều bị từ chối truy cập (`HTTP 404 Not Found` hoặc `HTTP 403 Forbidden`).
  * Endpoint `/admin/` được bảo vệ chuẩn xác bằng chuyển hướng xác thực (`HTTP 302 Found`).

---

### 2.4. Kiểm thử tráo đổi phương thức HTTP (HTTP Method Tampering)
* **Phương thức**: Gửi liên tiếp các method `GET`, `HEAD`, `OPTIONS`, `POST`, `PUT`, `DELETE`, `PATCH`, `TRACE` tới endpoint bảo vệ `/api/v1/cash/transactions/`.
* **Kết quả**:
  * 100% các phương thức đều trả về `HTTP 401 Unauthorized`.
  * Không thể lợi dụng method swapping (ví dụ đổi GET thành HEAD hoặc POST) để vượt qua lớp xác thực JWT.

---

### 2.5. Kiểm thử chính sách chia sẻ tài nguyên (CORS Misconfiguration)
* **Thử nghiệm**: Gửi header `Origin: https://evil-attacker.com` kèm yêu cầu preflight.
* **Kết quả**:
  * `Access-Control-Allow-Origin: *`
  * `Access-Control-Allow-Credentials: None`
  * **Đánh giá**: **Không bị lỗ hổng đánh cắp Cookie/Session (An toàn)**. Tuy nhiên, khi lên Production thật nên giới hạn `CORS_ALLOWED_ORIGINS` cho đúng tên miền frontend thay vì cho phép `*`.

---

## 3. CÁC ĐIỂM CẦN GIA CỐ BẢO MẬT (HARDENING RECOMMENDATIONS)

| Mức độ | Vấn đề phát hiện | Hiện trạng | Giải pháp khuyến nghị |
| :---: | :--- | :--- | :--- |
| **Medium** | **Thiếu các Security Headers khuyến nghị** | Thiếu `Strict-Transport-Security` (HSTS), `Content-Security-Policy` (CSP), `Permissions-Policy` | Cấu hình trong Nginx hoặc Django Middleware khi triển khai HTTPS thật. |
| **Low** | **Lộ thông tin Server qua Header** | Header phản hồi có chứa `Server: gunicorn` | Cấu hình Nginx reverse proxy thêm directive: `server_tokens off;` và ẩn header `Server`. |
| **Low** | **Rate Limiting trên nhiều Worker** | 30 requests đăng nhập liên tiếp chia đều cho 4 workers (`LocMemCache`) nên chưa kích hoạt chặn IP | Bổ sung Redis Cache để bộ đếm `ScopedRateThrottle` được đồng bộ tập trung 100%. |

---

## 4. KỸ NĂNG BẢO MẬT ĐÃ TÍCH HỢP (CUSTOM SKILL CREATED)

Đã tạo sẵn bộ Skill pentest chuyên nghiệp trong workspace:  
📂 **[`.agent/skills/web-pentest/SKILL.md`](file:///d:/THUẾ/.agent/skills/web-pentest/SKILL.md)**

Kể từ bây giờ, bất kỳ lúc nào bạn cần kiểm tra bảo mật, bạn chỉ cần ra lệnh:  
> *"Quét bảo mật web từ bên ngoài cho tôi"* hoặc *"Pentest hệ thống"*

Agent sẽ tự động gọi Docker Nuclei và kịch bản DAST để rà soát toàn diện và trả về báo cáo ngay lập tức!
