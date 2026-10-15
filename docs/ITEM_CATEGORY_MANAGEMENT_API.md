# UC-MD-05: Nhóm hàng hóa, dịch vụ

API tại `/api/v1/master-data/item-categories/`. Gửi JWT và `company_id` khi đọc hoặc thao tác trên nhóm. Permission `MD.ITEM_GROUP.*` và Data Scope quyết định nhóm có thể xem, tạo hoặc thay đổi. Nhóm có thể áp dụng cho `MATERIAL`, `GOODS`, `FINISHED_GOOD`, `SERVICE`.

| Thao tác | API |
| --- | --- |
| Danh sách/cây | `GET /item-categories/?company_id=...`, `GET /item-categories/tree/?company_id=...` |
| Tạo/cập nhật | `POST /item-categories/`, `PATCH /item-categories/{id}/?company_id=...` |
| Di chuyển | `POST /item-categories/{id}/move/?company_id=...` |
| Ngừng/kích hoạt/lưu trữ | `POST /item-categories/{id}/change-status/?company_id=...` |
| Kiểm tra tác động, lịch sử | `GET /item-categories/{id}/impact/`, `GET /item-categories/{id}/history/` với `company_id` |
| Chuyển nhóm hàng loạt | `POST /item-categories/{id}/bulk-assign/?company_id=...` |
| Xóa nhóm trống | `DELETE /item-categories/{id}/?company_id=...` |
| CSV | `POST /item-categories/import-csv/`, `GET /item-categories/export-csv/?company_id=...` |

Ví dụ tạo nhóm:

```json
{"company":"<company-uuid>","code":"GOODS","name":"Hàng hóa","applicable_types":["GOODS"],"sort_order":1}
```

Khi sửa, di chuyển hoặc đổi trạng thái, gửi `version` từ `updated_at`; phiên bản cũ trả HTTP 409. Di chuyển nhận `parent` là UUID nhóm cha mới hoặc `null` để thành nhóm gốc. Đường dẫn `path` và cấp `depth` của các nhóm con được cập nhật trong cùng transaction. Độ sâu tối đa mặc định là 8 cấp, có thể đặt qua `CoreCompanySetting.configuration.item_category_max_depth`.

Chuyển nhóm hàng loạt nhận `item_ids`. Mặc định API trả bản xem trước trong `proposed`; gửi `dry_run: false` để thực hiện. Item lỗi được trả riêng trong `errors`. Giá trị mặc định của nhóm được kế thừa từ nhóm cha gần nhất khi tạo Item, và trường nhập trực tiếp trên Item được ưu tiên.

CSV import cần `code,name,applicable_types`, có thể thêm `parent_code,branch_id`; nhiều loại được phân tách bằng `|`. Đặt nhóm cha trước nhóm con. CSV export gồm mã, tên, nhóm cha, loại áp dụng, trạng thái, thứ tự, cấp và đường dẫn.

Kiểm thử: `$env:DB_ENGINE='sqlite'; .\venv\Scripts\python.exe manage.py test master_data.test_item_category_management master_data.test_item_management`.
