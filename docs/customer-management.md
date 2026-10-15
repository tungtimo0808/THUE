# Quản lý khách hàng (UC-MD-01)

API: `/api/v1/master-data/customers/`. Tất cả yêu cầu cần xác thực và `company_id` trong query string. Khách hàng dùng chung bản ghi `Party` với nhà cung cấp; API tự tạo vai trò `CUSTOMER` và hồ sơ công nợ.

| Thao tác | Endpoint | Quyền |
| --- | --- | --- |
| Danh sách, chi tiết, tìm theo mã/tên/MST | `GET /customers/?company_id=...&search=...` | `MD.PARTY.VIEW` |
| Kiểm tra nghi trùng | `GET /customers/duplicates/?company_id=...&tax_code=...` | `MD.PARTY.VIEW` |
| Tạo | `POST /customers/?company_id=...` | `MD.PARTY.CREATE` |
| Cập nhật | `PATCH /customers/{id}/?company_id=...` | `MD.PARTY.EDIT` |
| Kích hoạt, ngừng, khóa | `POST /customers/{id}/set-status/?company_id=...` | `MD.PARTY.EDIT` |
| Xem trước hoặc nhập CSV | `POST /customers/import/?company_id=...` | `MD.PARTY.IMPORT` |
| Xuất CSV | `GET /customers/export/?company_id=...` | `MD.PARTY.EXPORT` |

Khi cập nhật hoặc đổi trạng thái, gửi `version` từ lần đọc gần nhất. Trạng thái `INACTIVE` và `BLOCKED` cần `reason`. Địa chỉ và liên hệ mới được gửi trong `addresses` và `contacts`; gửi `id` của bản ghi con để sửa. Mỗi loại chỉ có một bản ghi đang hoạt động được đánh dấu mặc định. Hạn mức công nợ để trống khác với `0`.

CSV nhập dùng UTF-8, tối đa 1.000 dòng/2 MB và phải có cột `code,name,party_type`. Có thể thêm `legal_name,tax_code,customer_group,status,branch`. Gửi `preview=true` để kiểm tra trước khi lưu. Mỗi dòng hợp lệ được lưu riêng cùng audit; kết quả trả về lỗi theo số dòng.

Chạy migration và test với cấu hình cơ sở dữ liệu phù hợp:

```powershell
python manage.py migrate
python manage.py test master_data.tests
```
