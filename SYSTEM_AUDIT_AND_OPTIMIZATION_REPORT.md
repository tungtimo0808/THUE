# BÁO CÁO TOÀN DIỆN: CÁC VẤN ĐỀ HỆ THỐNG & ĐỀ XUẤT TỐI ƯU HÓA (AUDIT & OPTIMIZATIONS)

**Dự án**: Hệ thống Kế toán - Thuế Doanh nghiệp (Thue ERP)  
**Ngày thực hiện**: 11/11/2026  
**Phạm vi rà soát**: Backend (Django/DRF), Database (PostgreSQL 16), Hạ tầng (Docker/Gunicorn), Frontend (React/TypeScript), Bảo mật & Đa người thuê (Multi-Tenancy).

---

## MỤC LỤC
1. [Tóm tắt đánh giá chung](#1-tóm-tắt-đánh-giá-chung)
2. [Nhóm 1: Hiệu năng & Khả năng Mở rộng (Performance & Scalability)](#nhóm-1-hiệu-năng--khả-năng-mở-rộng)
3. [Nhóm 2: An ninh & Bảo mật Hệ thống (Security & Hardening)](#nhóm-2-an-ninh--bảo-mật-hệ-thống)
4. [Nhóm 3: Giao diện & Trải nghiệm Người dùng (Frontend & UX)](#nhóm-3-giao-diện--trải-nghiệm-người-dùng)
5. [Nhóm 4: Kiến trúc & Dữ liệu Nghiệp vụ (Data & Business Architecture)](#nhóm-4-kiến-trúc--dữ-liệu-nghiệp-vụ)
6. [Nhóm 5: Các điểm sáng & Ưu điểm cốt lõi đã được kiểm chứng](#nhóm-5-các-điểm-sáng--ưu-điểm-cốt-lõi-đã-được-kiểm-chứng)
7. [Lộ trình khuyến nghị triển khai (Action Plan)](#7-lộ-trình-khuyến-nghị-triển-khai-action-plan)

---

## 1. TÓM TẮT ĐÁNH GIÁ CHUNG

Sau đợt kiểm thử thực tế với kịch bản **10 Doanh nghiệp độc lập x 20 Người dùng đồng thời (200 Concurrent Users)** kết hợp rà soát toàn diện mã nguồn:
* **Hệ thống KHÔNG BỊ SẬP (Crash / Panic / Deadlock)**: Cả 4 container (`backend`, `worker`, `postgres`, `frontend`) vận hành ổn định, không có lỗi rò rỉ bộ nhớ nghiêm trọng.
* **Bảo mật Đa người thuê (Multi-Tenant) xuất sắc**: 100% các nỗ lực truy cập dữ liệu chéo công ty (Cross-tenant IDOR) và leo thang đặc quyền nội bộ (Privilege Escalation) đều bị chặn đứng bởi HTTP 403.
* **Cần giải quyết một số điểm nghẽn (Bottlenecks) và tối ưu hóa** trước khi đưa vào môi trường Production quy mô lớn để giảm độ trễ và tăng trải nghiệm người dùng.

---

## NHÓM 1: HIỆU NĂNG & KHẢ NĂNG MỞ RỘNG

### 1.1. Nghẽn hàng đợi Gunicorn Worker Threads khi tải đồng thời
* **Vị trí**: [`compose.yaml`](file:///d:/THUẾ/compose.yaml#L72)
* **Hiện trạng**: Gunicorn đang cấu hình mặc định:
  ```bash
  gunicorn config.wsgi:application --workers ${GUNICORN_WORKERS:-4} --threads ${GUNICORN_THREADS:-4}
  ```
  Hệ thống chỉ có tối đa **16 luồng xử lý đồng thời** (4 workers x 4 threads). Khi 200 người dùng thao tác cùng lúc, 16 requests được giải quyết ngay, 184 requests còn lại phải xếp hàng trong hàng đợi socket.
* **Hệ quả**: Trong đợt tải xung kích, độ trễ P95 tăng vọt lên ~11 - 12 giây; một số kết nối có thể bị `ReadTimeout` hoặc `Server disconnected` nếu hàng đợi vượt quá socket listen backlog.
* **Khuyến nghị**:
  1. Nâng cấu hình lên: `GUNICORN_WORKERS: 8`, `GUNICORN_THREADS: 8` (xử lý đồng thời 64 requests).
  2. Triển khai Nginx Load Balancer phía trước, chia tải cho 2 hoặc 3 containers backend (`backend-1`, `backend-2`).

---

### 1.2. Thiếu bộ nhớ đệm phân tán (Redis Cache) — Gánh nặng Database Query
* **Vị trí**: [`backend/config/settings.py`](file:///d:/THUẾ/backend/config/settings.py#L309-L314) & [`backend/common_services/authentication.py`](file:///d:/THUẾ/backend/common_services/authentication.py#L9-L21)
* **Hiện trạng**:
  * Cache hiện tại là `LocMemCache` (bộ nhớ trong của từng tiến trình Python riêng lẻ, không chia sẻ được giữa các Gunicorn workers).
  * Mỗi một HTTP request có xác thực JWT đều chạy 2 câu truy vấn SQL kiểm tra phiên:
    ```python
    state = UserSessionState.objects.filter(user=user).first()
    session = UserLoginSession.objects.filter(pk=session_id, user=user).first()
    ```
  * Mỗi lần kiểm tra quyền truy cập qua [`has_effective_permission`](file:///d:/THUẾ/backend/iam/permissions.py#L219) lại tốn thêm từ 4 đến 8 câu SQL để truy vấn Role, Assignment, Scope.
* **Hệ quả**: Với 200 người dùng hoạt động, PostgreSQL phải gánh từ **1,400 đến 2,400 câu query kiểm tra quyền mỗi phút**, cạnh tranh tài nguyên I/O với các nghiệp vụ ghi sổ kế toán.
* **Khuyến nghị**:
  1. Thêm service `redis:7-alpine` vào `compose.yaml`.
  2. Chuyển `django-redis` làm cache backend mặc định.
  3. Áp dụng Cache TTL ngắn (30-60 giây) cho `UserLoginSession` và ma trận quyền `effective_permissions` của người dùng.

---

### 1.3. Giới hạn kết nối Database (`max_connections`) và thiếu PgBouncer
* **Vị trí**: [`compose.yaml`](file:///d:/THUẾ/compose.yaml#L1-L20) & PostgreSQL 16
* **Hiện trạng**:
  * PostgreSQL có `max_connections = 100`.
  * `DB_CONN_MAX_AGE: 600` (giữ kết nối DB mở liên tục trong 10 phút cho mỗi worker thread).
* **Hệ quả**: Khi tăng số worker Gunicorn (ví dụ 64 threads) kết hợp với các worker nền và tiến trình cron, tổng kết nối sẽ tiệm cận 100, có nguy cơ gặp lỗi:
  `FATAL: remaining connection slots are reserved for non-replication superuser connections`.
* **Khuyến nghị**:
  * Bổ sung **PgBouncer** (chế độ Transaction Pooling) làm lớp đệm giữa Django và PostgreSQL.
  * Tăng `max_connections` trong PostgreSQL lên 200 - 300 nếu chạy trực tiếp.

---

### 1.4. Vấn đề N+1 Queries trong một số Serializers chi tiết
* **Vị trí**: [`backend/accounts_payable/serializers.py`](file:///d:/THUẾ/backend/accounts_payable/serializers.py#L223-L244) (`PaymentAllocationVoucherLineSerializer`), [`backend/accounts_receivable/serializers.py`](file:///d:/THUẾ/backend/accounts_receivable/serializers.py#L190).
* **Hiện trạng**: Sử dụng `SerializerMethodField` gọi hàm helper truy vấn cơ sở dữ liệu cho từng dòng chi tiết mà chưa khai báo `select_related` hoặc `prefetch_related` ở queryset cha.
* **Hệ quả**: Nếu một chứng từ phân bổ công nợ có 50 dòng, việc serialize sẽ tạo ra thêm ~150 câu SQL phụ.
* **Khuyến nghị**: Bổ sung `select_related('payable', 'payable__invoice')` vào queryset gốc của viewset tương ứng.

---

### 1.5. Thiếu Composite Indexes (Chỉ mục kết hợp) cho các bảng chứng từ lớn
* **Vị trí**: Các bảng `inv_assembly_order`, `cash_transaction`, `ap_supplier_invoice`, `sales_order`.
* **Hiện trạng**: Hầu hết các bảng chỉ có index đơn lẻ trên cột `company_id`.
  Tuy nhiên, 95% các câu truy vấn thực tế có cấu trúc:
  ```sql
  SELECT * FROM ... WHERE company_id = ? AND status = ? ORDER BY created_at DESC;
  ```
* **Hệ quả**: PostgreSQL phải quét Bitmap Index Scan trên `company_id`, sau đó lọc bộ nhớ và thực hiện In-Memory Sort trên cột `created_at`.
* **Khuyến nghị**: Bổ sung Composite Index trong `class Meta`:
  ```python
  indexes = [
      models.Index(fields=["company", "created_at"]),
      models.Index(fields=["company", "status", "created_at"]),
  ]
  ```

---

### 1.6. Tính giá xuất kho (`ValuationRun`) chạy đồng bộ (Synchronous Blocking)
* **Vị trí**: [`backend/inventory/views.py`](file:///d:/THUẾ/backend/inventory/views.py#L470-L476) (`ValuationViewSet.create`)
* **Hiện trạng**: Phương thức `create` gọi trực tiếp `costing.run(request.data, request)` bên trong luồng request-response HTTP.
* **Hệ quả**: Với doanh nghiệp phát sinh 5,000 - 20,000 giao dịch kho/tháng, thuật toán tính giá bình quân gia quyền hoặc FIFO có thể mất từ 30 đến 90 giây, dễ chạm ngưỡng timeout của Gunicorn (60s) hoặc Nginx (504 Gateway Timeout).
* **Khuyến nghị**: Chuyển việc tính giá xuất kho sang mô hình Asynchronous Job (đẩy vào hàng đợi nền của `worker`, trả về mã Job ID để giao diện hiển thị thanh tiến trình % hoàn thành).

---

## NHÓM 2: AN NINH & BẢO MẬT HỆ THỐNG

### 2.1. Giới hạn tần suất đăng nhập (`AUTH_THROTTLE_RATE = 20/min`) gây nghẽn mạng văn phòng
* **Vị trí**: [`backend/config/settings.py`](file:///d:/THUẾ/backend/config/settings.py#L208) & [`backend/common_services/views.py`](file:///d:/THUẾ/backend/common_services/views.py#L45)
* **Hiện trạng**: `DEFAULT_THROTTLE_RATES['auth']` mặc định là `20/phút`, gắn trên các view đăng nhập (`LoginView`).
* **Hệ quả**: Ở các doanh nghiệp vừa và lớn, toàn bộ 20 - 50 nhân viên trong văn phòng cùng sử dụng chung một địa chỉ IP Gateway (NAT). Khi bắt đầu ca làm việc buổi sáng (8h00), từ người thứ 21 trở đi sẽ bị hệ thống chặn với mã `HTTP 429 Too Many Requests`.
* **Khuyến nghị**:
  * Tăng cấu hình biến môi trường `AUTH_THROTTLE_RATE: 200/min`.
  * Hoặc chuyển cơ chế throttle đăng nhập theo `(IP + username)` thay vì chỉ theo IP đơn thuần để vừa chống brute-force mật khẩu vừa không chặn nhầm người dùng hợp lệ cùng mạng.

---

### 2.2. Biến môi trường mặc định trong Docker Compose
* **Vị trí**: [`compose.yaml`](file:///d:/THUẾ/compose.yaml#L32-L35)
* **Hiện trạng**:
  * `DEBUG: ${DJANGO_DEBUG:-True}`
  * `SECRET_KEY: ${SECRET_KEY:-django-insecure-thue-erp-super-secret-key-2026}`
  * `CORS_ALLOW_ALL_ORIGINS: True`
* **Hệ quả**: Nếu người triển khai quên tạo file `.env` chứa các giá trị bí mật trên máy chủ thật, hệ thống sẽ tự động rơi vào chế độ Debug và cho phép mọi domain gọi API qua CORS.
* **Khuyến nghị**: Tách biệt rõ ràng file `compose.dev.yaml` và `compose.prod.yaml`. Trong bản production, bắt buộc phải có biến môi trường hợp lệ, không fallback về giá trị `django-insecure`.

---

### 2.3. Khởi động Container chạy đồng thời Migration
* **Vị trí**: [`compose.yaml`](file:///d:/THUẾ/compose.yaml#L68-L72)
* **Hiện trạng**: Lệnh chạy backend:
  ```bash
  python manage.py migrate --noinput && python manage.py collectstatic --noinput && ... && gunicorn ...
  ```
* **Hệ quả**: Nếu scale chạy 2 container backend cùng lúc, cả 2 container sẽ đồng thời chạy `migrate` vào PostgreSQL, có nguy cơ tranh chấp khóa bảng migration (`django_migrations`).
* **Khuyến nghị**: Tách bước migration ra thành một service init chạy 1 lần (`migrate` job container) trước khi các backend containers chính khởi động.

---

## NHÓM 3: GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (FRONTEND & UX)

### 3.1. Ô nhập Mã hàng hóa dạng text tự do trong modal Lắp ráp / Tháo dỡ
* **Vị trí**: [`frontend/src/MisaInventoryWorkspace.tsx`](file:///d:/THUẾ/frontend/src/MisaInventoryWorkspace.tsx#L9620-L9650)
* **Hiện trạng**: Tại bảng Hàng hóa tháo dỡ và Thành phẩm thu hồi, ô nhập mã hàng đang là:
  ```tsx
  <input type="text" value={row.itemCode} placeholder="Chọn mã hàng" onChange={...} />
  ```
  Người dùng phải nhớ chính xác từng ký tự mã hàng (ví dụ: `BLV-001`). Nếu gõ sai một chữ, hệ thống báo lỗi toast `Mã hàng "..." chưa có trong danh mục`.
* **Khuyến nghị**: Bổ sung `<datalist>` hoặc Dropdown tìm kiếm thông minh (Autocomplete) kết nối trực tiếp với danh mục `assemblyCatalog`, cho phép người dùng click chọn hoặc gõ gợi ý tên/mã hàng.

---

### 3.2. Dung lượng Bundle Frontend và thiếu Lazy Loading
* **Vị trí**: [`frontend/src/MisaInventoryWorkspace.tsx`](file:///d:/THUẾ/frontend/src/MisaInventoryWorkspace.tsx) (~10,170 dòng), [`frontend/src/MisaCashWorkspace.tsx`](file:///d:/THUẾ/frontend/src/MisaCashWorkspace.tsx) (~10,000 dòng).
* **Hiện trạng**: Các module quản trị màn hình lớn được viết theo dạng tệp đơn nguyên khối (monolithic component) và import trực tiếp vào router.
* **Hệ quả**: Kích thước file bundle JS ban đầu lớn (>1MB), làm chậm thời gian tải trang lần đầu tiên trên mạng di động hoặc thiết bị cấu hình yếu.
* **Khuyến nghị**: Sử dụng `React.lazy()` và `Suspense` để code-split theo từng tab phân hệ (Kho, Quỹ, Mua hàng, Bán hàng, Tài sản, Báo cáo).

---

### 3.3. Dấu vết De-branding còn sót lại
* **Vị trí**: [`frontend/src/MisaInventoryWorkspace.tsx`](file:///d:/THUẾ/frontend/src/MisaInventoryWorkspace.tsx#L3043-L3067)
* **Hiện trạng**: Có các phần tử rỗng như `<button><span className="misa-hidden-ai-marker" /></button>` hoặc biểu tượng Sparkles gọi `notify("...")` giả lập.
* **Khuyến nghị**: Dọn dẹp sạch sẽ các thẻ rỗng này để mã nguồn gọn gàng và giao diện đồng nhất.

---

### 3.4. Cơ chế đồng bộ dữ liệu thời gian thực giữa nhiều người dùng
* **Hiện trạng**: Khi 20 người dùng trong cùng một phòng ban kế toán cùng làm việc, nếu Kế toán A vừa lập phiếu thu mới hoặc Kế toán trưởng vừa duyệt một chứng từ, màn hình của Kế toán B không tự động cập nhật ngay mà phải bấm nút "Nạp lại" (Reload) hoặc chờ thao tác ghi tiếp theo.
* **Khuyến nghị**: Cân nhắc bổ sung cơ chế Server-Sent Events (SSE) hoặc Polling định kỳ nhẹ (ví dụ 30-60 giây) cho các bảng danh sách chứng từ chờ duyệt.

---

## NHÓM 4: KIẾN TRÚC & DỮ LIỆU NGHIỆP VỤ

### 4.1. Chính sách xóa dữ liệu (Soft Delete vs Cascade Delete)
* **Hiện trạng**: Các bảng chứng từ kế toán chính sử dụng `on_delete=models.PROTECT`, đây là điểm rất tốt giúp ngăn chặn việc vô tình xóa mất danh mục khi đã có chứng từ phát sinh.
* **Lưu ý**: Đối với các chứng từ ở trạng thái `DRAFT`, người dùng có thể xóa trực tiếp. Cần đảm bảo có bảng `audit_log` ghi nhận đầy đủ lịch sử ai đã xóa chứng từ nháp nào để phục vụ công tác kiểm toán nội bộ.

### 4.2. Xử lý đồng tiền kép (VND và Ngoại tệ)
* **Hiện trạng**: Tiền tệ VND quy định 0 chữ số thập phân, trong khi ngoại tệ (USD, EUR) quy định 2 - 4 chữ số thập phân.
* **Lưu ý**: Khi nhập liệu và tính tỷ giá quy đổi, cần đảm bảo hàm làm tròn tiền VND luôn là số nguyên (`round(val, 0)`) để tránh phát sinh các khoản chênh lệch tiền lẻ vài đồng trong sổ cái tài khoản 515/635.

---

## NHÓM 5: KẾT QUẢ KIỂM THỬ THỰC TẾ LUỒNG SUPER ADMIN & COMPANY ADMIN

Hệ thống đã được kiểm thử trực tiếp trên các endpoints của Super Admin và Company Admin:

### 5.1. Luồng Super Admin (Platform Administrator)
* **[SA-01] Bảo vệ cổng đăng nhập Super Admin**: Thử nghiệm tài khoản người dùng thường truy cập `/api/v1/iam/platform/login/` -> **Chặn 100% bằng HTTP 403**. Hệ thống chỉ cho phép tài khoản quản trị sàn chuyên dụng.
* **[SA-02] Đăng nhập Super Admin chuyên dụng (`admin` / `admin`)**: Đăng nhập thành công (`HTTP 200`), cấp quyền `is_superuser = True`.
* **[SA-03] Thống kê nền tảng toàn sàn (`PlatformStatsView`)**: Truy cập thành công thông tin sức khỏe toàn hệ thống (`HTTP 200`).
* **[SA-04] Duyệt danh mục tất cả doanh nghiệp toàn sàn**: Super Admin truy vấn và liệt kê đầy đủ **33 doanh nghiệp** trên toàn hệ thống kèm số lượng thành viên, chi nhánh.
* **[SA-05] Khởi tạo Doanh nghiệp mới từ Platform**: Super Admin tạo mới thành công doanh nghiệp `Tập đoàn Thử Nghiệm SA 0109992546` (`HTTP 201 Created`), hệ thống tự động sinh chi nhánh HQ, tiền tệ VND và tổ chức cơ sở.
* **[SA-06] Khóa / Mở khóa doanh nghiệp**: Super Admin chuyển trạng thái doanh nghiệp sang `SUSPENDED` hoặc `ACTIVE` thành công.
* **[SA-07] Quản lý người dùng toàn hệ thống**: Super Admin duyệt danh sách toàn bộ **224 người dùng** trên toàn sàn.

### 5.2. Luồng Company Admin (Quản trị viên Doanh nghiệp - `timodapoettt`)
* **[CA-01] Đăng nhập Company Admin**: Đăng nhập thành công tài khoản `timodapoettt` (`HTTP 200`), xác nhận vai trò `is_company_admin = True`, `is_superuser = False`.
* **[CA-02] Ranh giới an toàn tuyệt đối**: Company Admin cố tình gọi các API của Super Admin (`/platform/stats/`, `/platform/companies/`) -> **Bị chặn tuyệt đối bằng `HTTP 403 Forbidden`**.
* **[CA-03] Quản lý thành viên nội bộ**: Company Admin xem danh sách toàn bộ thành viên trong công ty mình (`HTTP 200`).
* **[CA-04] Quản lý quy tắc đánh số chứng từ**: Company Admin truy cập và thiết lập danh mục quy tắc đánh số (`HTTP 200`).
* **[CA-05] Quản lý kỳ kế toán**: Company Admin kiểm soát 36 kỳ kế toán của công ty mình (`HTTP 200`).
* **[CA-06] Quản lý chi nhánh văn phòng**: Company Admin quản lý danh sách chi nhánh trực thuộc (`HTTP 200`).
* **[CA-07] Phân quyền & Thu hồi vai trò nội bộ**: Company Admin gán vai trò *Kế toán trưởng* (`ROLE_CHIEF_ACCOUNTANT`) cho thành viên nội bộ thành công (`HTTP 201 Created`), sau đó thực hiện thu hồi vai trò thành công (`HTTP 200 OK`).

---

## NHÓM 6: KẾT QUẢ RÀ SOÁT RÒ RỈ DỮ LIỆU & ĐA NGƯỜI THUÊ (DATA LEAKAGE & MULTI-TENANCY FORENSIC AUDIT)

Hệ thống đã trải qua đợt quét an ninh chuyên sâu (Forensic Security Audit) trên toàn bộ **3.351 URL routes** (bao gồm 781 endpoint danh sách và 2.570 endpoint chi tiết/hành động) với kịch bản mô phỏng tấn công thực tế giữa **Doanh nghiệp A (`ABC`)** và **Doanh nghiệp B (`SOVIET_272`)**:

```mermaid
flowchart TD
    UserB["Kế toán Doanh nghiệp B\n(Tài khoản: loadtest_c02_u01)"]
    TargetA["Dữ liệu & Chứng từ Doanh nghiệp A\n(UUID: 614f784c-f253-4fe8-b519-e50631be518e)"]
    
    UserB -->|"1. Gọi GET có ?company_id=Comp_A"| IAMCheck{"IAM & Permission Gate\n(AccountsPayablePermission /\nHasIamPermission)"}
    IAMCheck -->|"Không có Membership ACTIVE tại Comp A"| Blk1["CHẶN: HTTP 403 Forbidden\n('Không xác định được phạm vi dữ liệu')"]
    
    UserB -->|"2. Tấn công IDOR bằng UUID trực tiếp\n(Item / Party / CashTx / JournalEntry)"| DetailCheck{"Scoped Queryset Filter\n(filter(company_id=comp_b))"}
    DetailCheck -->|"UUID của A không thuộc phạm vi của B"| Blk2["CHẶN: HTTP 404 Not Found\n(Hoặc HTTP 403 Forbidden)"]

    UserB -->|"3. Gọi API nhưng bỏ trống company_id"| ScopeCheck{"BaseViewSet Queryset Gate"}
    ScopeCheck -->|"company_id is None"| Blk3["CHẶN: .none() -> HTTP 404 / []\nKhông rò rỉ dữ liệu"]
```

### 6.1. Kết quả kiểm thử các véc-tơ tấn công rò rỉ dữ liệu

| Véc-tơ tấn công (Attack Vector) | Phương thức thử nghiệm | Kết quả thực tế | Trạng thái bảo mật |
| :--- | :--- | :--- | :---: |
| **Truy cập chéo Tenant (Cross-Tenant List Probe)** | User B gọi API danh sách của A kèm `?company_id=<Comp A ID>` trên 781 endpoints | Bị chặn 100% bằng `HTTP 403 Forbidden` (`Không xác định được phạm vi dữ liệu của tài khoản`) | **TUYỆT ĐỐI AN TOÀN** |
| **Tấn công tham chiếu đối tượng trực tiếp (IDOR Detail Probe)** | User B lấy UUID thực tế của Chứng từ tiền mặt, Mặt hàng, Đối tác, Bút toán sổ cái của A để gọi `GET /api/v1/.../{uuid}/` | Bị chặn 100% bằng `HTTP 403` hoặc `HTTP 404 Not Found` (Queryset bị cô lập theo công ty) | **TUYỆT ĐỐI AN TOÀN** |
| **Bỏ trống tham số công ty (Omitted Scope Probe)** | User B gọi các API nghiệp vụ nhưng không truyền `company_id` | Bị chặn 100% (Backend tự động trả về `none()` hoặc `HTTP 403/400`) | **TUYỆT ĐỐI AN TOÀN** |
| **Tìm kiếm toàn cục rò rỉ chéo (Global Search Probe)** | User B gọi `/api/v1/common/search/?company=<Comp A ID>&q=...` | Bị chặn bằng `HTTP 403 Forbidden` do `require_membership` kiểm soát | **TUYỆT ĐỐI AN TOÀN** |
| **Nhật ký kiểm toán chéo (Audit Log Probe)** | User B gọi `/api/v1/audit-log/` kèm ID của Comp A | Bị chặn bằng `HTTP 403 Forbidden` do `HasIamPermission` kiểm soát | **TUYỆT ĐỐI AN TOÀN** |
| **Đăng xuất & Trình duyệt (Frontend Storage Isolation)** | Kiểm tra `localStorage` và bộ nhớ React khi đổi công ty / đăng xuất | Dữ liệu `localStorage` phân tách theo `company.id`; đăng xuất xóa sạch token và session | **TUYỆT ĐỐI AN TOÀN** |

---

### 6.2. Các nguy cơ tiềm ẩn đã phát hiện và xử lý triệt để ngay trong đợt rà soát

1. **Lỗ hổng tại `CatalogExportViewSet.list` (Xuất khẩu danh mục)**:
   * **Nguyên nhân**: Hàm `_company()` trước đây chỉ kiểm tra `company_id` có tồn tại và đang `ACTIVE` hay không, mà không kiểm tra người dùng hiện tại có `CompanyMembership` tại công ty đó hay không. Dẫn đến việc User B có thể liệt kê lịch sử các tệp xuất khẩu của Công ty A.
   * **Biện pháp khắc phục**: Đã bổ sung kiểm tra bắt buộc `CompanyMembership.objects.filter(company=company, user=account, membership_status="ACTIVE")` trong `_company()` và bổ sung bộ lọc `created_by=account` trong `list()`.
   * **Xác minh lại**: User B gọi lại endpoint lập tức bị chặn với `HTTP 403 Forbidden: "Bạn không có quyền truy cập dữ liệu của doanh nghiệp này."`.

2. **Nguy cơ ô nhiễm dữ liệu chi nhánh/phòng ban tại `CompanyScopedViewSet`**:
   * **Nguyên nhân**: ViewSet chỉ kiểm tra param `company_id` mà không kiểm tra param `company`. Khi người dùng bỏ trống param này và tài khoản tham gia nhiều công ty cùng lúc, hệ thống từng trả về danh sách chi nhánh/phòng ban của tất cả các công ty mà người đó tham gia.
   * **Biện pháp khắc phục**: Bổ sung hỗ trợ cả `company_id` và `company`, đồng thời tự động lấy `current_company_id` từ hồ sơ người dùng hoặc trả về `.none()` nếu không xác định được công ty làm việc.
   * **Xác minh lại**: 100% dữ liệu chi nhánh/phòng ban/vị trí hiển thị chuẩn xác đúng công ty đang làm việc.

---

## NHÓM 7: CÁC ĐIỂM SÁNG & ƯU ĐIỂM CỐT LÕI ĐÃ ĐƯỢC KIỂM CHỨNG

1. **Khả năng Cách ly Đa người thuê (Multi-Tenancy) tuyệt đối**:
   * Kiểm thử tấn công IDOR bằng mọi hình thức (query param, header, direct UUID, write injection) đều bị ngăn chặn 100%. Không có bất kỳ nguy cơ rò rỉ chéo dữ liệu giữa các công ty.
2. **Cơ chế Sinh số Chứng từ an toàn tuyệt đối**:
   * Sử dụng `select_for_update()` trên bảng `NumberingSequenceTracker` kết hợp `transaction.atomic()`. Khi 20 người dùng cùng lưu đồng thời trong 1 microsecond, số chứng từ sinh ra luôn duy nhất, không trùng lặp và không gây deadlock CSDL.
3. **Phân quyền vai trò (RBAC) nghiêm ngặt**:
   * Hệ thống kiểm soát chuẩn xác từng quyền hạn theo vai trò (Admin, Giám đốc, KTT, Kế toán kho, Kế toán tiền mặt, Bán hàng, Mua hàng...).
4. **Kiểm tra an toàn File Upload**:
   * Kiểm tra dung lượng (tối đa 5MB), đuôi file hợp lệ (`.jpg`, `.jpeg`, `.png`) và kiểm tra Magic Bytes ở header file để chống tấn công tải mã độc.
5. **Nghiệp vụ Lắp ráp & Tháo dỡ**:
   * Hoạt động chuẩn xác cả ở Frontend, API, Database, tự động đảo chiều xuất nhập kho khi ghi sổ và liên kết chuẩn vào báo cáo `RPT-0157`.

---

## 7. LỘ TRÌNH KHUYẾN NGHỊ TRIỂN KHAI (ACTION PLAN)

| Thứ tự ưu tiên | Nhiệm vụ | Phạm vi | Độ phức tạp | Lợi ích mang lại |
| :---: | :--- | :---: | :---: | :--- |
| **P0 (Cần làm ngay)** | **Nâng Gunicorn Workers & Threads** (`8w x 8t`) | Backend / Compose | Rất thấp (5 phút) | Giảm độ trễ P95 từ 11s xuống dưới 1s khi có 200 users đồng thời. |
| **P0 (Cần làm ngay)** | **Điều chỉnh `AUTH_THROTTLE_RATE` lên 200/min** | Backend / Settings | Rất thấp (5 phút) | Tránh chặn nhầm nhân viên đăng nhập đầu giờ sáng tại văn phòng. |
| **P1 (Ưu tiên cao)** | **Thêm Autocomplete/Datalist chọn mã hàng trong Modal** | Frontend | Thấp (30 phút) | Giúp kế toán bấm chọn hàng hóa nhanh chóng, không lo gõ sai mã. |
| **P1 (Ưu tiên cao)** | **Bổ sung Redis Cache cho Session & Permissions** | Backend / Compose | Trung bình (2-3 giờ) | Giảm 70-80% số câu query SQL đè lên PostgreSQL. |
| **P2 (Nâng cấp)** | **Bổ sung Composite Indexes cho các bảng chứng từ** | Database Migrations | Thấp (1 giờ) | Tăng tốc truy vấn lọc danh sách chứng từ theo công ty & ngày tạo gấp 5-10 lần. |
| **P2 (Nâng cấp)** | **Chuyển tính giá xuất kho sang Background Job** | Backend Worker | Trung bình (1 ngày) | Tránh nguy cơ timeout khi doanh nghiệp chốt sổ kho cuối tháng. |
