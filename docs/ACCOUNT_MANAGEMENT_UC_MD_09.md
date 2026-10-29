# UC-MD-09 – Hệ thống tài khoản kế toán

Màn hình **Danh mục → Hệ thống tài khoản** và `/accounts` dùng API `/api/v1/general-ledger/accounts/`. Chọn bộ tài khoản đang làm việc; màn hình hiển thị phân cấp, tìm theo số/tên, thêm, sửa, nhân bản, ngừng/sử dụng lại, chuyển, xóa và xuất Excel. Bộ TT58 hiển thị thông báo thay vì danh mục ghi sổ kép.

| Thao tác | API | Permission |
| --- | --- | --- |
| Danh sách, chi tiết, cây | `GET /accounts/?company_id=...&chart_of_accounts_id=...`, `GET /accounts/tree/` | `MD.ACCOUNT.VIEW` |
| Thêm/nhân bản | `POST /accounts/` | `MD.ACCOUNT.CREATE` |
| Sửa | `PATCH /accounts/{id}/` với `version` | `MD.ACCOUNT.EDIT` |
| Ngừng/sử dụng lại | `POST /accounts/{id}/change-status/` | `MD.ACCOUNT.EDIT` |
| Xóa | `DELETE /accounts/{id}/hard-delete/` | `MD.ACCOUNT.DELETE` |
| Chuyển | `POST /accounts/{id}/transfer/` | `MD.ACCOUNT.TRANSFER` |
| Xuất Excel | `GET /accounts/export-xlsx/?company_id=...&chart_of_accounts_id=...` | `MD.ACCOUNT.EXPORT` |

Chuyển tài khoản nhận `target_id`, `version` và `delete_source` (tùy chọn). Backend chỉ chuyển các dòng bút toán **nháp trong kỳ mở** khi hai tài khoản cùng bộ dữ liệu, cùng bản chất/tính chất, cấu hình đối tượng và ngoại tệ tương thích. Tài khoản có số dư, bút toán đã ghi sổ hoặc tham chiếu nghiệp vụ khác được từ chối; các trường hợp đó cần quy trình chuyển riêng để bảo toàn lịch sử. Không tự sửa chứng từ đã ghi sổ.

Áp dụng migration IAM `0031_account_transfer_permission.py` để tạo quyền chuyển; quyền này không tự cấp cho Role. Chạy kiểm thử từ `backend`: `$env:DB_ENGINE='sqlite'; $env:DEBUG='True'; ..\venv\Scripts\python.exe manage.py test general_ledger.test_account_management`.
