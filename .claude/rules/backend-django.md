---
paths:
  - "backend/**/*.py"
---

# Quy tắc Django/DRF

1. Phân quyền kiểm tra ở backend theo công ty (`company_id`) và quyền nghiệp vụ; không tin dữ liệu công ty hay quyền gửi từ client.
2. Mọi truy vấn dữ liệu nghiệp vụ phải lọc theo công ty của người dùng; không để lộ dữ liệu giữa các doanh nghiệp.
3. Số chứng từ / số hiệu duy nhất không cấp bằng `count() + 1` mà không xử lý trùng khi chạy đồng thời (xem `reporting/run_numbering.py`).
4. Thay đổi model phải đi kèm migration; chạy `manage.py makemigrations --check` trước khi kết thúc.
5. Code phải chạy được trên cả SQLite (dev) và PostgreSQL (production): không dùng tính năng chỉ có ở một bên mà không có nhánh xử lý.
6. Lỗi nghiệp vụ trả `ValidationError` có thông điệp tiếng Việt; không để exception thô thành HTTP 500.
