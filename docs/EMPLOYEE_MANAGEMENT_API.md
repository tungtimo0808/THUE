# UC-MD-03: Quản lý nhân viên

API dùng JWT tại `/api/v1/organization/employees/`. Các thao tác đọc cần `company_id` trong query string. Tài khoản phải có Membership ACTIVE và Permission `MD.EMPLOYEE.*` trong Data Scope của chi nhánh/phòng ban tương ứng.

| Thao tác | Endpoint | Permission |
| --- | --- | --- |
| Danh sách, tìm kiếm, lọc | `GET /employees/?company_id=...&search=...&status=...&branch_id=...` | `VIEW` |
| Tạo hồ sơ | `POST /employees/` | `CREATE` |
| Xem, sửa hồ sơ | `GET/PATCH /employees/{id}/?company_id=...` | `VIEW`/`EDIT` |
| Xem tác động trước khi ngừng | `GET /employees/{id}/impact/?company_id=...` | `VIEW` |
| Đổi trạng thái | `POST /employees/{id}/change_status/?company_id=...` | `DEACTIVATE` |
| Liên kết/hủy liên kết User | `POST /employees/{id}/link-user/` hoặc `unlink-user/` với `company_id` | `LINK_USER` |
| Tài khoản ngân hàng | `GET/POST /employees/{id}/bank-accounts/` và `PATCH /employees/{id}/bank-accounts/{account_id}/`, với `company_id` | `VIEW_SENSITIVE`, thêm `EDIT` khi ghi |
| Lịch sử | `GET /employees/{id}/history/?company_id=...` | `VIEW` |
| Phân công đơn vị/chức vụ | `POST /api/v1/organization/employee-assignments/` | `EDIT` ở cả đơn vị cũ và mới |
| Nhập/xuất CSV | `POST /employees/import-csv/`, `GET /employees/export-csv/?company_id=...` | `IMPORT`/`EXPORT`, theo từng dòng và Data Scope |

Khi sửa hoặc đổi trạng thái, gửi `version` từ `updated_at` của hồ sơ đã đọc. Xung đột trả HTTP 409. Trạng thái `TERMINATED` yêu cầu `termination_date`. Nếu còn tài sản đang quản lý, thao tác ngừng yêu cầu `confirm_assets: true` sau khi kiểm tra bàn giao; thao tác này không tự chuyển tài sản hay quyết toán công nợ.

Ví dụ tạo:

```json
{"company":"<company-uuid>","branch":"<branch-uuid>","employee_code":"NV001","full_name":"Nguyễn Văn A","status":"ACTIVE"}
```

CSV import cần cột `employee_code,full_name,branch_id`; thêm `email,phone` nếu có. Mỗi dòng được kiểm tra riêng và kết quả trả danh sách `created` cùng `errors`. Export chỉ gồm các hồ sơ được phép xem; trường nhạy cảm chỉ có giá trị trên dòng được cấp quyền `VIEW_SENSITIVE`.

Chạy kiểm thử với SQLite: `$env:DB_ENGINE='sqlite'; .\venv\Scripts\python.exe manage.py test organization.tests organization.test_employee_management`.
