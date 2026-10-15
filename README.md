# Django Backend Project

## Giao diện Sổ Việt

Frontend kế toán – thuế nằm trong [`FRONTEND/`](./FRONTEND/README.md), xây dựng bằng React + TypeScript + Vite.

```powershell
cd D:\THUẾ\FRONTEND
npm install
npm run dev
```

Mở URL Vite in ra trong terminal (thường là http://127.0.0.1:5173) để xem bản trải nghiệm với dữ liệu mẫu. Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd install` và `npm.cmd run dev`. Chi tiết chức năng, giới hạn và kiểm thử xem trong [FRONTEND/README.md](./FRONTEND/README.md).

Dự án Backend xây dựng trên nền tảng **Django** và **Django REST Framework (DRF)**.

---

## 🚀 Thư viện đã cài đặt

- **`django`**: Framework web chính.
- **`djangorestframework` (DRF)**: Xây dựng RESTful API chuẩn mực, linh hoạt.
- **`django-cors-headers`**: Hỗ trợ CORS cho phép kết nối an toàn với frontend (React, Vue, Flutter, Next.js,...).
- **`djangorestframework-simplejwt`**: Xác thực API qua JSON Web Token (JWT).
- **`drf-spectacular`**: Tự động sinh tài liệu OpenAPI 3.0, Swagger UI và Redoc.
- **`python-dotenv`**: Quản lý biến môi trường qua file `.env`.
- **`pillow`**: Hỗ trợ xử lý hình ảnh cho ImageField.

---

## 📂 Cấu trúc thư mục

```text
Thue/
│
├── config/                  # Thiết lập dự án chính
│   ├── __init__.py
│   ├── settings.py          # Cấu hình Django, DRF, CORS, JWT, Swagger
│   ├── urls.py              # Định tuyến URLs và Swagger docs
│   ├── asgi.py
│   └── wsgi.py
│
├── venv/                    # Môi trường ảo Python
├── .env                     # File biến môi trường (SECRET_KEY, DEBUG,...)
├── .env.example             # File mẫu biến môi trường
├── .gitignore               # Cấu hình bỏ qua git
├── manage.py                # Lệnh quản lý Django
└── requirements.txt         # Danh sách thư viện
```

---

## 🛠 Hướng dẫn sử dụng

### Database khi phát triển

Mặc định dự án dùng SQLite để chạy test nhanh. Môi trường phát triển tích hợp nên dùng PostgreSQL 16:

```powershell
docker compose up -d postgres
$env:DB_ENGINE = "postgresql"
python manage.py migrate
```

Các biến `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` được mô tả trong `.env.example`.

### 1. Kích hoạt môi trường ảo (Virtual Environment)
Trong PowerShell:
```powershell
.\venv\Scripts\Activate.ps1
```
*(Nếu dùng Command Prompt `cmd`: `venv\Scripts\activate.bat`)*

### 2. Chạy Migration (Khởi tạo cơ sở dữ liệu)
```powershell
python manage.py migrate
```

### 3. Tạo tài khoản Quản trị viên (Superuser)
```powershell
python manage.py createsuperuser
```

### 4. Khởi chạy Server phát triển
```powershell
python manage.py runserver
```
Server sẽ chạy tại địa chỉ: `http://127.0.0.1:8000/`

---

## 📑 Các Endpoint mặc định sẵn có

- **Trang quản trị Django Admin**: [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)
- **Tài liệu Swagger UI**: [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/)
- **Tài liệu Redoc**: [http://127.0.0.1:8000/api/redoc/](http://127.0.0.1:8000/api/redoc/)
- **Lấy JWT Token**: `POST /api/token/`
- **Làm mới JWT Token**: `POST /api/token/refresh/`

### API nền tảng đã triển khai

Các API này yêu cầu JWT và hiện chỉ cho tài khoản `is_staff` truy cập, cho đến khi module IAM được triển khai:

- `GET/POST /api/v1/master-data/currencies/`
- `GET/POST /api/v1/organization/companies/`
- `GET/POST /api/v1/organization/branches/`
- `GET/POST /api/v1/organization/departments/`
- `GET/POST /api/v1/organization/positions/`
- `GET/POST /api/v1/organization/employees/`
- `GET/POST /api/v1/organization/employee-assignments/`

### API IAM và Audit — UC-SYS-01 đến UC-SYS-04

- `GET/POST /api/v1/iam/users/`
- `GET/POST /api/v1/iam/memberships/`
- `GET/POST /api/v1/iam/roles/`
- `POST /api/v1/iam/roles/{id}/clone/`
- `GET /api/v1/iam/permission-resources/`
- `GET /api/v1/iam/permission-actions/`
- `GET /api/v1/iam/permissions/`
- `GET/POST /api/v1/iam/permission-bundles/`
- `GET/POST /api/v1/iam/role-permissions/`
- `GET/POST /api/v1/iam/role-permission-bundles/`
- `GET/POST /api/v1/iam/data-scopes/`
- `GET/POST /api/v1/iam/data-scope-branches/`
- `GET/POST /api/v1/iam/data-scope-departments/`
- `GET/POST /api/v1/iam/role-assignments/`
- `POST /api/v1/iam/role-assignments/{id}/revoke/`
- `GET /api/v1/audit/logs/?company_id=<uuid>`

Tài khoản Django superuser dùng để bootstrap IAM. User thông thường chỉ truy cập khi có Role Assignment đang hiệu lực, Permission phù hợp và Data Scope đúng doanh nghiệp. Với endpoint theo doanh nghiệp, truyền `company_id` trong query string. Lịch sử phân quyền và Audit Log không hỗ trợ xóa qua API.

### API tài khoản và phiên đăng nhập — UC-COM-01 đến UC-COM-09

- `POST /api/v1/common/auth/register/`, `/verify-registration/`, `/resend-verification/`, `/change-registration-email/`
- `POST /api/v1/common/auth/login/`, `/logout/`, `/change-password/`
- `GET/PATCH /api/v1/common/profile/`
- `GET /api/v1/common/scopes/` và `POST /api/v1/common/companies/switch/`
- `GET/POST /api/v1/common/join-requests/` và API duyệt tại `company-join-requests/`
- `GET /api/v1/common/notifications/` cùng các action `read`, `unread`, `read-all`, `archive`, `unread-count`, `open`
- `GET /api/v1/common/search/` và `POST /api/v1/common/search/open/` cho tìm kiếm có Permission/Data Scope, lọc và phân trang theo nhóm
- `GET /api/v1/common/work-items/` cùng các action `count`, `open`, `history` cho việc cần xử lý được đồng bộ từ Workflow
- `GET/POST /api/v1/common/ai-conversations/`, `POST /api/v1/common/ai/query/`, `feedback`, `source` cho hội thoại AI theo đúng phạm vi làm việc

Phiên JWT được quản lý riêng theo thiết bị. Đăng xuất chỉ thu hồi phiên hiện tại; đặt lại mật khẩu thu hồi tất cả phiên; đổi mật khẩu giữ phiên hiện tại và thu hồi các phiên còn lại.

### API quên mật khẩu

1. Gửi `POST /api/v1/common/auth/forgot-password/` với body `{"identifier": "email-hoac-username"}`. API luôn trả `202` và một `challenge`; mã OTP 6 số được gửi đến email nếu tài khoản tồn tại.
2. Gửi `POST /api/v1/common/auth/reset-password/` với body `{"challenge": "<uuid>", "code": "<otp>", "new_password": "<mat-khau-moi>", "new_password_confirm": "<mat-khau-moi>"}`.

Các route cũ `/auth/password-reset/request/` và `/auth/password-reset/confirm/` vẫn được giữ để tương thích. OTP mặc định hết hạn sau 5 phút, chỉ dùng một lần, chỉ được gửi lại sau 60 giây và bị vô hiệu hóa sau 5 lần nhập sai.

### API Master Data — UC-MD

Prefix chung: `/api/v1/master-data/`.

- Đối tượng: `parties`, `party-roles`, `party-addresses`, `party-contacts`, `party-bank-accounts`, `customer-profiles`, `vendor-profiles`.
- Hàng hóa: `item-categories`, `units-of-measure`, `items`, `item-uom-conversions`.
- Kho: `warehouses`, `inventory-locations`.
- Tiền và thuế: `currencies`, `exchange-rate-types`, `exchange-rates`, `payment-terms`, `tax-rates`.
- Đối tượng tập hợp: `projects`, `cost-centers`.
- Ngân hàng: `banks`, `company-bank-accounts`.
- Chứng từ: `document-types`, `document-numbering-rules`.

Hệ thống tài khoản kế toán nằm tại:

- `/api/v1/general-ledger/account-classes/`
- `/api/v1/general-ledger/charts-of-accounts/`
- `/api/v1/general-ledger/accounts/`

Các endpoint theo doanh nghiệp yêu cầu `?company_id=<uuid>`. Khi kiểm tra phạm vi chi tiết có thể truyền thêm `branch_id`, `warehouse_id`, `bank_account_id`, `project_id` hoặc `cost_center_id`. Master Data không hỗ trợ xóa vật lý qua API; chuyển `status` sang `INACTIVE` để ngừng sử dụng.

Danh sách chi nhánh, phòng ban, chức vụ và nhân viên hỗ trợ lọc bằng `?company_id=<uuid>`. Lịch sử phân công chỉ được tạo và đọc; không cho sửa hoặc xóa qua API.

---

## 💡 Tạo App mới trong dự án

Để tạo một app tính năng mới (ví dụ `users`, `products`):
```powershell
python manage.py startapp <ten_app>
```
Sau đó thêm `<ten_app>` vào danh sách `INSTALLED_APPS` trong [config/settings.py](file:///c:/Users/Admin/LapTrinh/Thue/config/settings.py).



docker compose up -d
venv\Scripts\python.exe manage.py migrate
venv\Scripts\python.exe manage.py runserver
