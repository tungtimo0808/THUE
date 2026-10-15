# UC-MD-04: Vật tư, hàng hóa và dịch vụ

API chính ở `/api/v1/master-data/items/`. Mọi thao tác cần JWT, `company_id` trong query string (hoặc `company` trong body khi tạo), Permission `MD.ITEM.*` và Data Scope phù hợp. Không có API xóa cứng Item.

| Thao tác | API |
| --- | --- |
| Danh sách, tìm kiếm, lọc | `GET /items/?company_id=...&search=...&status=...&item_type=...&branch_id=...` |
| Tạo, xem, sửa | `POST /items/`, `GET/PATCH /items/{id}/?company_id=...` |
| Ngừng dùng, lưu trữ, kích hoạt lại | `POST /items/{id}/change-status/?company_id=...` |
| Kiểm tra tồn và đơn chưa hoàn tất | `GET /items/{id}/impact/?company_id=...` |
| Mã vạch | `GET/POST /items/{id}/barcodes/?company_id=...` |
| Lịch sử | `GET /items/{id}/history/?company_id=...` |
| Đơn vị quy đổi | `GET/POST/PATCH /item-uom-conversions/?company_id=...` |
| CSV | `POST /items/import-csv/`, `GET /items/export-csv/?company_id=...` |

Trạng thái tạo mới chỉ là `DRAFT` hoặc `ACTIVE`. Khi sửa hoặc đổi trạng thái, gửi `version` từ `updated_at`; phiên bản cũ trả HTTP 409. Đơn vị quy đổi phải về đơn vị cơ sở với tỷ lệ dương. Mã vạch gắn với đúng Item và đơn vị tính, không được trùng giữa các Item ACTIVE trong cùng doanh nghiệp.

Khi tạo, có thể gửi thêm mảng `conversions` và `barcodes`. Item và các mảng này được lưu trong cùng transaction; một dòng lỗi sẽ hoàn tác toàn bộ lần tạo. Việc ngừng/lưu trữ bị chặn khi Item còn đơn mua hoặc đơn bán chưa hoàn tất.

Ví dụ tạo:

```json
{"company":"<company-uuid>","code":"HH001","name":"Hàng hóa A","item_type":"GOODS","base_uom":"<uom-uuid>","track_inventory":true,"allow_purchase":true,"allow_sale":true}
```

CSV import cần `code,name,item_type,base_uom_id`, có thể thêm `branch_id`. Kết quả trả `created` và `errors` theo từng dòng. Giá mua/bán và tài khoản trong danh mục là giá trị gợi ý; giá và bút toán thực tế vẫn do chứng từ quyết định.

Kiểm thử: `$env:DB_ENGINE='sqlite'; .\venv\Scripts\python.exe manage.py test master_data.test_item_management inventory purchases sales`.
