# UC-MD-16: Export danh mục (Backend API Specification)

Tài liệu thiết kế chi tiết và hướng dẫn sử dụng API cho tính năng **Export danh mục** (UC-MD-16) thuộc phân hệ Quản lý dữ liệu dùng chung (Master Data Management - MDM).

---

## 1. Tổng quan & Luồng hoạt động

API trung tâm cho thao tác Export danh mục là:
```
/api/v1/master-data/catalog-exports/
```

Mỗi request cần cung cấp `company_id` (qua query string hoặc request body). Hệ thống áp dụng nghiêm ngặt các quy tắc:
1. **Kiểm tra quyền truy cập (BR-MD-EXP-01, EF-01)**: User phải có đồng thời quyền Xem (`<RESOURCE>.VIEW`) và quyền Xuất (`<RESOURCE>.EXPORT`) đối với danh mục tương ứng.
2. **Kiểm soát phạm vi dữ liệu (Data Scope) (BR-MD-EXP-03..05, BR-MD-EXP-11)**: Dữ liệu được lọc theo Data Scope hiệu lực của User (chi nhánh, phòng ban, kho, tài khoản ngân hàng hoặc bản ghi phụ trách). Các bản ghi ngoài phạm vi sẽ tự động bị loại khỏi file Export.
3. **Phòng chống tấn công Formula Injection (BR-MD-EXP-19)**: Mọi giá trị chuỗi bắt đầu bằng `=`, `+`, `-`, `@` đều được escape an toàn bằng ký tự `'` để ngăn Excel thực thi mã độc.
4. **Bảo toàn số 0 ở đầu (BR-MD-EXP-18)**: Các trường mã số thuế, số điện thoại, số tài khoản ngân hàng, căn cước công dân được định dạng chuẩn Text (`@`) trong Excel.
5. **Định dạng chuẩn Excel `.xlsx` (BR-MD-EXP-12..17)**: Dòng đầu là tiêu đề cột tiếng Việt rõ ràng, các cột số lưu dưới dạng Number, ngày hiển thị `dd/MM/yyyy`, ngày giờ `dd/MM/yyyy HH:mm:ss`.
6. **Đặt tên file tự động (BR-MD-EXP-20)**: `[MaDanhMuc]_[yyyyMMdd_HHmmss].xlsx` theo múi giờ doanh nghiệp (`Asia/Ho_Chi_Minh`).

---

## 2. Phạm vi danh mục hỗ trợ

| Danh mục | Mã danh mục (`catalog_code`) | Target Key | Resource IAM |
|---|---|---|---|
| Khách hàng | `KHACH_HANG` | `customers` | `MD.PARTY` |
| Nhà cung cấp | `NHA_CUNG_CAP` | `suppliers` | `MD.PARTY` |
| Nhân viên | `NHAN_VIEN` | `employees` | `MD.EMPLOYEE` |
| Vật tư, hàng hóa và dịch vụ | `VAT_TU_HANG_HOA` | `items` | `MD.ITEM` |
| Nhóm hàng hóa, dịch vụ | `NHOM_HANG_HOA` | `item-categories` | `MD.ITEM_GROUP` |
| Đơn vị tính | `DON_VI_TINH` | `units-of-measure` | `MD.UOM` |
| Kho | `KHO` | `warehouses` | `MD.WAREHOUSE` |
| Tài khoản ngân hàng | `TAI_KHOAN_NGAN_HANG` | `company-bank-accounts` | `MD.BANK_ACCOUNT` |
| Hệ thống tài khoản kế toán | `HE_THONG_TAI_KHOAN` | `accounts` | `MD.ACCOUNT` |
| Khoản mục chi phí | `KHOAN_MUC_CHI_PHI` | `expense-items` | `MD.EXPENSE_ITEM` |
| Mã thống kê | `MA_THONG_KE` | `statistical-codes` | `MD.STATISTICAL_CODE` |
| Loại thuế | `LOAI_THUE` | `tax-types` | `MD.TAX_TYPE` |
| Thuế suất | `THUE_SUAT` | `tax-rates` | `MD.TAX_RATE` |
| Điều khoản thanh toán | `DIEU_KHOAN_THANH_TOAN` | `payment-terms` | `MD.PAYMENT_TERM` |
| Phương thức thanh toán | `PHUONG_THUC_THANH_TOAN` | `payment-methods` | `MD.PAYMENT_METHOD` |
| Trung tâm chi phí | `TRUNG_TAM_CHI_PHI` | `cost-centers` | `MD.ORGANIZATION` |

---

## 3. Danh sách Endpoints

### 3.1. Khám phá danh mục được phép Export
- **Endpoint**: `GET /api/v1/master-data/catalog-exports/targets/?company_id={company_id}`
- **Quyền**: Yêu cầu người dùng đăng nhập và có quyền đối với ít nhất một danh mục.
- **Phản hồi**: Danh sách các danh mục khả dụng kèm danh sách cột hiển thị tương ứng.

### 3.2. Ước tính số bản ghi & Cấu hình trước khi Export (Bước 4 Activity Flow)
- **Endpoint**: `POST /api/v1/master-data/catalog-exports/estimate/?company_id={company_id}`
- **Body**:
  ```json
  {
    "target": "customers",
    "export_scope": "ALL",
    "selected_ids": [],
    "filters": { "search": "Hòa Bình" }
  }
  ```
- **Phản hồi**:
  ```json
  {
    "target": "customers",
    "catalog_code": "KHACH_HANG",
    "name": "Khách hàng",
    "export_scope": "ALL",
    "file_format": "xlsx",
    "estimated_count": 125,
    "mode": "DIRECT",
    "max_limit": 100000,
    "background_threshold": 10000
  }
  ```

### 3.3. Xác nhận & Thực hiện Export (Bước 6 Activity Flow)
- **Endpoint**: `POST /api/v1/master-data/catalog-exports/export/?company_id={company_id}`
- **Body**:
  ```json
  {
    "target": "customers",
    "export_scope": "SELECTED",
    "selected_ids": ["uuid-1", "uuid-2"]
  }
  ```
- **Xử lý theo số lượng bản ghi**:
  - **<= 10.000 bản ghi (BR-MD-EXP-21)**: Trực tiếp trả về file Excel binary với header `Content-Disposition: attachment; filename="KHACH_HANG_20261006_113000.xlsx"`.
  - **10.001 - 100.000 bản ghi (BR-MD-EXP-22, AF-04)**: Đưa vào hàng đợi xử lý nền, phản hồi `202 Accepted`:
    ```json
    {
      "batch_id": "9b72505a-1c32-4ec1-84e9-551f808692c8",
      "target": "customers",
      "status": "QUEUED",
      "total_records": 15420,
      "message": "Yêu cầu Export đang được xử lý. Hệ thống sẽ thông báo khi file sẵn sàng."
    }
    ```
  - **> 100.000 bản ghi (BR-MD-EXP-23, EF-04)**: Phản hồi lỗi `400 Bad Request`:
    `{"detail": "Dữ liệu vượt quá 100.000 bản ghi. Vui lòng sử dụng bộ lọc để thu hẹp dữ liệu."}`
  - **0 bản ghi phù hợp (EF-03)**: Phản hồi lỗi `400 Bad Request`:
    `{"detail": "Không có dữ liệu phù hợp để Export."}`
  - **Phạm vi "Các bản ghi đã chọn" nhưng không truyền ID (EF-02, BR-MD-EXP-07)**: Phản hồi lỗi `400 Bad Request`:
    `{"detail": "Vui lòng chọn ít nhất một bản ghi để Export."}`

### 3.4. Kiểm tra trạng thái yêu cầu Export nền
- **Endpoint**: `GET /api/v1/master-data/catalog-exports/{id}/?company_id={company_id}`
- **Phản hồi**: Thông tin batch, trạng thái (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `EXPIRED`), số bản ghi, thời gian bắt đầu, kết thúc và hạn tải file.

### 3.5. Tải file Export nền
- **Endpoint**: `GET /api/v1/master-data/catalog-exports/{id}/download/?company_id={company_id}`
- **Ràng buộc an toàn**:
  - Chỉ chính User tạo yêu cầu mới được phép tải file (BR-MD-EXP-27).
  - Kiểm tra lại quyền Export và View tại thời điểm tải (EF-05).
  - Hạn tải file là **24 giờ** kể từ khi tạo thành công (BR-MD-EXP-24). Sau 24 giờ, hệ thống xóa dữ liệu file và trả về lỗi `410 Gone`:
    `{"detail": "File Export đã hết hạn. Vui lòng tạo yêu cầu Export mới."}` (EF-09, BR-MD-EXP-25, BR-MD-EXP-32).

---

## 4. Xử lý nền (Background Worker)

Các batch lớn (> 10.000 dòng) được xử lý bởi command:
```bash
python manage.py process_catalog_exports --limit=10
```
Khi hoàn thành, hệ thống tự động:
1. Lưu trữ file Excel vào batch.
2. Tạo **Notification** trong `common_services` cho người dùng kèm link tải file.
3. Ghi **Audit Log** hoàn thành (SUCCESS) hoặc thất bại (FAILURE).

---

## 5. Audit Log (Kiểm toán bảo mật)

Mọi thao tác Export (trực tiếp hoặc nền, thành công hoặc thất bại) đều được ghi nhận vào hệ thống Audit Log (`audit_audit_log`):
- `module_code`: `MDM`
- `action_code`: `EXPORT` (hoặc `EXPORT_QUEUE`)
- Ghi nhận: User thực hiện, Doanh nghiệp, Tên danh mục, Phạm vi Export, Số bản ghi thực tế, Thời gian bắt đầu, Thời gian hoàn thành, Kết quả xử lý (`SUCCESS` / `FAILURE`).
- **Tuân thủ BR-MD-EXP-31**: Tuyệt đối không lưu dữ liệu chi tiết của danh mục hay nội dung file trong Audit Log.
