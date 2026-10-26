# Báo cáo kiểm thử UC-COM-01 đến UC-COM-12

## 1. Thông tin lần chạy

| Thuộc tính | Giá trị |
|---|---|
| Ngày chạy | 30/09/2026 |
| Backend | Django/DRF hiện tại trong workspace (`common_services`) |
| Database chính | PostgreSQL 16 Docker, `127.0.0.1:26015` |
| Database đối chiếu | SQLite in-memory |
| Nguồn expected result | `COMMON_SERVICES_TEST_PLAN.md` và API contract hiện tại |
| Phạm vi | Toàn bộ 12 Use Case dùng chung (UC-COM-01 đến UC-COM-12) |

## 2. Kết quả tổng quan

| Nhóm kiểm thử | Kết quả | Trạng thái |
|---|---|---|
| Bộ kiểm thử toàn diện 12 UC (`scripts/test_all_uc_com_apis.py`) trên PostgreSQL | **63/63 Pass** | **PASS 100%** |
| Regression test Django `common_services` trên PostgreSQL | **18/18 Pass** | **PASS 100%** |
| Regression test Django `common_services` trên SQLite | **18/18 Pass** | **PASS 100%** |
| Ma trận kiểm thử dữ liệu đăng ký (`scripts/audit_uc_com_registration.py`) | **10/10 Pass** | **PASS 100%** |
| Defect xác nhận | **0 mở** (1 đã sửa & verified) | **ĐÃ GIẢI QUYẾT** |

Kết luận: **Tất cả các API của 12 Use Case dùng chung (UC-COM-01 đến UC-COM-12) đều đã được kiểm thử toàn diện, hoạt động chính xác theo đúng tài liệu đặc tả và passing 100%.**

## 3. Chi tiết kết quả kiểm thử theo Use Case

| UC | Tên Use Case | API đã kiểm thử | Kết quả | Ghi chú & Chi tiết kiểm thử |
|---|---|---|:---:|---|
| **UC-COM-01** | Đăng ký và xác thực tài khoản | `POST /api/v1/common/auth/register/`<br>`POST /api/v1/common/auth/verify-registration/`<br>`POST /api/v1/common/auth/resend-verification/`<br>`POST /api/v1/common/auth/change-registration-email/` | **PASS** (8/8) | - Bắt buộc mật khẩu mạnh, điều khoản sử dụng.<br>- Từ chối số điện thoại sai định dạng (đã fix D-COM-01-001).<br>- Cooldown gửi lại OTP 60s.<br>- Đổi email đăng ký khi đang chờ xác thực (đã fix lỗi `FOR UPDATE` PostgreSQL).<br>- OTP sai bị từ chối; OTP đúng kích hoạt user thành ACTIVE. |
| **UC-COM-02** | Gửi yêu cầu tham gia doanh nghiệp | `GET /api/v1/common/companies/search/`<br>`POST /api/v1/common/join-requests/`<br>`GET /api/v1/common/join-requests/`<br>`POST /api/v1/common/join-requests/{id}/cancel/`<br>`GET /api/v1/common/company-join-requests/`<br>`POST /api/v1/common/company-join-requests/{id}/decide/` | **PASS** (8/8) | - Tìm kiếm doanh nghiệp từ khóa < 2 ký tự trả 400.<br>- Tìm kiếm thành công và che 4 số cuối MST.<br>- Gửi yêu cầu PENDING, chặn gửi trùng lặp.<br>- Người xin xem và tự hủy yêu cầu PENDING.<br>- Admin xem danh sách cần duyệt và phê duyệt APPROVED -> tạo membership ACTIVE. |
| **UC-COM-03** | Đăng nhập | `POST /api/v1/common/auth/login/`<br>`POST /api/token/refresh/` | **PASS** (6/6) | - Đăng nhập bằng email/username thành công (trả JWT access, refresh, session, company context).<br>- Sai mật khẩu/tài khoản không tồn tại trả 401 chống account enumeration.<br>- Refresh token hợp lệ cấp access token mới; token giả/sai bị từ chối. |
| **UC-COM-04** | Đăng xuất | `POST /api/v1/common/auth/logout/` | **PASS** (3/3) | - Đăng xuất thiết bị hiện tại trả 204.<br>- Token thiết bị 1 bị thu hồi ngay (gọi profile trả 401).<br>- Phiên thiết bị 2 của cùng user không bị ảnh hưởng (trả 200). |
| **UC-COM-05** | Quên và đặt lại mật khẩu | `POST /api/v1/common/auth/forgot-password/`<br>`POST /api/v1/common/auth/reset-password/` | **PASS** (5/5) | - Quên mật khẩu trả 202; gửi OTP cho tài khoản tồn tại, không gửi cho tài khoản lạ.<br>- OTP sai/mật khẩu yếu bị từ chối.<br>- Đặt lại mật khẩu thành công: mật khẩu cũ bị vô hiệu, mật khẩu mới đăng nhập thành công. |
| **UC-COM-06** | Đổi mật khẩu | `POST /api/v1/common/auth/change-password/` | **PASS** (4/4) | - Sai mật khẩu hiện tại hoặc trùng mật khẩu cũ bị từ chối 400.<br>- Đổi mật khẩu thành công trả 200 `changed=true`.<br>- Phiên hiện tại giữ nguyên; các phiên trên thiết bị khác bị thu hồi ngay. |
| **UC-COM-07** | Quản lý tài khoản cá nhân | `GET /api/v1/common/profile/`<br>`PATCH /api/v1/common/profile/`<br>`POST /api/v1/common/profile/confirm-email/` | **PASS** (4/4) | - Lấy profile bảo mật không lộ mật khẩu hash.<br>- Cập nhật display_name và phone hợp lệ.<br>- Trường email là read-only, chặn sửa qua PATCH.<br>- Validate số điện thoại hợp lệ. |
| **UC-COM-08** | Chuyển phạm vi làm việc | `GET /api/v1/common/scopes/`<br>`GET /api/v1/common/companies/mine/`<br>`POST /api/v1/common/companies/switch/` | **PASS** (4/4) | - Lấy danh sách scope và doanh nghiệp thành viên.<br>- Chuyển context làm việc sang doanh nghiệp được cấp quyền.<br>- Chặn chuyển sang doanh nghiệp ngoài phạm vi thành viên (403/404). |
| **UC-COM-09** | Xem và xử lý thông báo | `GET /api/v1/common/notifications/`<br>`GET /api/v1/common/notifications/unread-count/`<br>`POST /api/v1/common/notifications/{id}/read/`<br>`POST /api/v1/common/notifications/{id}/unread/`<br>`POST /api/v1/common/notifications/{id}/open/`<br>`POST /api/v1/common/notifications/{id}/archive/` | **PASS** (7/7) | - Liệt kê thông báo, đếm unread count.<br>- Chuyển trạng thái READ và UNREAD chính xác.<br>- Mở thông báo: tự động mark read và trả link đích.<br>- Archive/ẩn thông báo (204).<br>- Chống IDOR: người dùng khác không thể truy cập thông báo của nhau (404). |
| **UC-COM-10** | Tìm kiếm toàn hệ thống | `GET /api/v1/common/search/`<br>`POST /api/v1/common/search/open/` | **PASS** (4/4) | - Từ khóa < 2 ký tự trả 400.<br>- Tìm kiếm tiếng Việt không dấu (`anh duong`) và có dấu (`Ánh Dương`) đều tìm thấy kết quả đối tác.<br>- Mở kết quả tìm kiếm trả link điều hướng.<br>- Phân quyền chặt chẽ với `COM.SEARCH.USE`. |
| **UC-COM-11** | Xem việc cần xử lý | `GET /api/v1/common/work-items/`<br>`GET /api/v1/common/work-items/count/`<br>`POST /api/v1/common/work-items/{id}/open/`<br>`GET /api/v1/common/work-items/{id}/history/` | **PASS** (5/5) | - Tự động cập nhật `OVERDUE` khi công việc quá hạn `due_at`.<br>- Đếm số lượng công việc mở chính xác.<br>- Mở công việc: chuyển trạng thái sang `IN_PROGRESS` và trả link điều hướng.<br>- Ghi nhận lịch sử `WorkItemHistory`.<br>- Chống tạo trùng lặp với `dedupe_key`. |
| **UC-COM-12** | Sử dụng AI Assistant | `POST /api/v1/common/ai/query/`<br>`POST /api/v1/common/ai-conversations/`<br>`POST /api/v1/common/ai/{id}/confirm/`<br>`POST /api/v1/common/ai/{id}/feedback/` | **PASS** (5/5) | - Doanh nghiệp tắt AI trả 503 `UNAVAILABLE`.<br>- Tạo hội thoại AI gắn với doanh nghiệp (201).<br>- Che dữ liệu nhạy cảm (`password` -> `[REDACTED]`).<br>- Idempotent qua `request_id` (trả cùng interaction id).<br>- Gửi phản hồi feedback (helpful, comment) thành công. |

---

## 4. Các lỗi và cải tiến đã khắc phục trong phiên làm việc

### 4.1. Sửa lỗi D-COM-01-001 (Số điện thoại chỉ có dấu chấm vẫn đăng ký được)
- **Vấn đề**: `PHONE_PATTERN` cho phép các ký tự `[0-9 .()-]` nhưng không giới hạn số lượng chữ số thực tế, khiến giá trị `1.......` (chỉ có 1 chữ số) được chấp nhận.
- **Khắc phục**: Thêm hàm `validate_phone_format` kiểm tra số lượng chữ số thực tế từ 8 đến 15 chữ số và áp dụng cho `RegistrationSerializer`, `ProfileSerializer`, `CompanyBootstrapSerializer`.
- **Kết quả**: Ma trận `scripts/audit_uc_com_registration.py` đạt **10/10 PASS**.

### 4.2. Sửa lỗi tương thích PostgreSQL trong `change_registration_email`
- **Vấn đề**: Khi chạy trên PostgreSQL 16, câu truy vấn `select_for_update()` kết hợp `select_related("user")` trên quan hệ nullable gây lỗi `psycopg.errors.FeatureNotSupported: FOR UPDATE cannot be applied to the nullable side of an outer join`.
- **Khắc phục**: Thêm `of=("self",)` vào `select_for_update(of=("self",))` tại `common_services/services.py:192` để chỉ khóa bảng chính `com_verification_challenge`.
- **Kết quả**: Endpoint đổi email đăng ký hoạt động mượt mà trên cả SQLite và PostgreSQL.

### 4.3. Cải tiến trạng thái công việc khi mở (`open_work_item`)
- **Vấn đề**: Khi công việc đã quá hạn (`OVERDUE`), người dùng mở công việc để xử lý thì trạng thái không được chuyển sang `IN_PROGRESS`.
- **Khắc phục**: Cập nhật điều kiện chuyển trạng thái trong `services.open_work_item` cho phép cả `PENDING` và `OVERDUE` chuyển sang `IN_PROGRESS` khi người dùng mở việc.
- **Kết quả**: Flow mở việc cần làm hoạt động trực quan và đúng nghiệp vụ.

---

## 5. Lệnh thực thi kiểm thử

Chạy toàn bộ 63 test case của 12 Use Case trên PostgreSQL:
```powershell
venv\Scripts\python.exe scripts\test_all_uc_com_apis.py
```

Chạy regression suite gốc:
```powershell
venv\Scripts\python.exe manage.py test common_services
```

Chạy ma trận đăng ký:
```powershell
venv\Scripts\python.exe scripts\audit_uc_com_registration.py
```
