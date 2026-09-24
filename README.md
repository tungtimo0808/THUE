# Django Backend Project

## Giao diện Sổ Việt

Frontend kế toán – thuế nằm trong [`frontend/`](./frontend/README.md), xây dựng bằng React + TypeScript + Vite.

```powershell
cd frontend
npm install
npm run dev
```

Mở http://127.0.0.1:5173 để xem bản trải nghiệm với dữ liệu mẫu. Chi tiết chức năng, giới hạn, kiểm thử và skill đã cài xem trong [frontend/README.md](./frontend/README.md).

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

---

## 💡 Tạo App mới trong dự án

Để tạo một app tính năng mới (ví dụ `users`, `products`):
```powershell
python manage.py startapp <ten_app>
```
Sau đó thêm `<ten_app>` vào danh sách `INSTALLED_APPS` trong [config/settings.py](file:///c:/Users/Admin/LapTrinh/Thue/config/settings.py).
