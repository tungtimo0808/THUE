# UC-MD-07: Quản lý kho (API)

Backend cung cấp danh mục kho tại `/api/v1/master-data/warehouses/` và vị trí kho tại `/api/v1/master-data/inventory-locations/`. Các thao tác cần xác thực, quyền `MD.WAREHOUSE.*`, Data Scope phù hợp và phân hệ `INV` được bật trong cấu hình doanh nghiệp. Gửi `company_id` trên query string khi đọc, sửa, xóa; gửi `company` trong body khi tạo kho.

## Kho

Tạo kho bằng `POST /warehouses/` với `company`, `code`, `name`, `warehouse_type`, `warehouse_scope`; thêm `branch` cho kho BRANCH, `project` cho PROJECT, `end_date` cho TEMPORARY. Loại kho gồm PHYSICAL, TRANSIT, CONSIGNMENT, RETURN, DAMAGED, VIRTUAL và OTHER. Kho vật lý cần `address` khi cấu hình `warehouse_physical_address_required=true`. Kho ACTIVE phải cho phép ít nhất một trong `allow_receipt`, `allow_issue`, `allow_transfer`. Người phụ trách có thể là `keeper_employee` hoặc `keeper_user`; User cần membership trong doanh nghiệp.

Danh sách hỗ trợ `search`, `branch_id`, `warehouse_type`, `warehouse_scope`, `status`, `ordering`. Thay đổi kho: `PATCH /warehouses/{id}/` kèm `version` từ lần đọc gần nhất. Xung đột phiên bản trả HTTP 409. Không đổi loại, chi nhánh, dự án hoặc phạm vi nếu kho đã phát sinh tồn hay giao dịch.

| Hành động | Endpoint | Quyền |
| --- | --- | --- |
| Danh sách, chi tiết, báo cáo ảnh hưởng, lịch sử | `GET /`, `GET /{id}/`, `GET /{id}/impact/`, `GET /{id}/history/` | `MD.WAREHOUSE.VIEW` |
| Tạo, sửa | `POST /`, `PATCH /{id}/` | `CREATE`, `EDIT` |
| Đặt mặc định | `POST /{id}/set-default/` | `EDIT` |
| Đổi trạng thái | `POST /{id}/change-status/` | `DEACTIVATE` |
| Xóa kho chưa sử dụng | `DELETE /{id}/` | `DELETE` |
| Nhập CSV | `POST /import-csv/` với multipart `company`, `file` | `IMPORT` |
| Xuất CSV | `GET /export-csv/?company_id=...` | `EXPORT` |

Đặt mặc định yêu cầu `version`; nếu cùng phạm vi đã có kho mặc định, gửi thêm `confirm_replace=true`. Phạm vi mặc định tính theo doanh nghiệp, `warehouse_scope`, chi nhánh và dự án. Đổi trạng thái gửi `status`, `version`, `reason` khi ngừng. Kho còn tồn dương, chứng từ đang mở hoặc đang là mặc định không thể ngừng. Kho đã có vị trí, số dư, chính sách kho hoặc giao dịch không thể xóa.

CSV cần các cột `code,name,warehouse_type,warehouse_scope`; hỗ trợ thêm `branch,project,address,keeper_employee,allow_receipt,allow_issue,allow_transfer,status`. Chi nhánh, dự án và nhân viên dùng mã. Import báo lỗi theo dòng và chỉ tạo các dòng hợp lệ. Export chỉ gồm các kho trong Data Scope của User.

## Vị trí kho

`POST /inventory-locations/?company_id=...` nhận `warehouse`, `code`, `name` và tùy chọn `parent`, `location_type`, `can_store`, `notes`. Các vị trí cha con phải thuộc cùng kho và không được tạo vòng. `POST /inventory-locations/{id}/change-status/?company_id=...` nhận `status=ACTIVE|INACTIVE`. Vị trí còn tồn hoặc có con đang hoạt động không thể ngừng. Có thể xóa vị trí chưa được tham chiếu bằng `DELETE /inventory-locations/{id}/?company_id=...`.

Giao dịch kho mới kiểm tra trạng thái kho, quyền nhập/xuất/chuyển và vị trí có cho phép chứa hàng. Kho trung chuyển chỉ nhận giao dịch chuyển kho. Danh mục kho không cung cấp API sửa số lượng hoặc giá trị tồn trực tiếp. Thay đổi danh mục được ghi Audit Log trong cùng transaction.
