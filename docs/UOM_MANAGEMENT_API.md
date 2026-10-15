# UC-MD-06: Quản lý đơn vị tính (API)

Backend cung cấp `/api/v1/master-data/units-of-measure/`. Mọi thao tác cần xác thực và quyền `MD.UOM.*` tương ứng trong doanh nghiệp. Gửi `company_id` trên query string khi đọc, sửa, xóa hoặc xuất; gửi `company` trong body khi tạo hoặc nhập CSV. Không có giao diện mới.

## Dữ liệu và quy đổi

- Tạo đơn vị: `POST` với `company`, `code`, `name`, `symbol`, `measurement_type`, `decimal_places`; tùy chọn `integer_only`, `description`, `sort_order`.
- Nhóm đo lường: `COUNT`, `WEIGHT`, `LENGTH`, `AREA`, `VOLUME`, `TIME`, `SERVICE`, `CUSTOM`. Giới hạn thập phân mặc định là 4; có thể đặt `uom_max_decimal_places` trong `CoreCompanySetting.configuration`, tối đa 8.
- Đơn vị tham chiếu: đặt `is_reference=true` và `factor_to_reference=1`. Mỗi doanh nghiệp chỉ có một tham chiếu ACTIVE cho mỗi nhóm.
- Đơn vị quy đổi: đặt `reference_uom` bằng ID của đơn vị tham chiếu ACTIVE cùng doanh nghiệp, cùng nhóm và `factor_to_reference` lớn hơn 0. Ví dụ g là tham chiếu, kg có hệ số 1000.
- Quy đổi cố định trong kho áp dụng cho WEIGHT, LENGTH, AREA, VOLUME và TIME khi chưa có quy đổi riêng theo Item. COUNT, SERVICE và CUSTOM không tự suy ra quy đổi bao bì. Số lượng trên chứng từ được kiểm tra theo độ chính xác và tùy chọn chỉ nhận số nguyên.

## Thao tác

| Hành động | Endpoint | Quyền |
| --- | --- | --- |
| Danh sách, chi tiết, tác động, lịch sử | `GET /`, `GET /{id}/`, `GET /{id}/impact/`, `GET /{id}/history/` | `MD.UOM.VIEW` |
| Tạo | `POST /` | `MD.UOM.CREATE` |
| Sửa | `PATCH /{id}/` hoặc `PUT /{id}/` | `MD.UOM.EDIT` |
| Đổi trạng thái | `POST /{id}/change-status/` | `MD.UOM.DEACTIVATE` |
| Xóa đơn vị chưa sử dụng | `DELETE /{id}/` | `MD.UOM.DELETE` |
| Nhập CSV | `POST /import-csv/` với multipart `company`, `file` | `MD.UOM.IMPORT` |
| Xuất CSV | `GET /export-csv/?company_id=...` | `MD.UOM.EXPORT` |

Danh sách hỗ trợ `search`, `measurement_type`, `status`, `ordering`. Khi sửa hoặc đổi trạng thái, gửi `version` lấy từ phản hồi đọc gần nhất. Phiên bản cũ trả HTTP 409. Đơn vị đang được Item hoặc quy đổi phụ thuộc sử dụng không thể ngừng; đơn vị đã được tham chiếu không thể xóa. Không cho sửa quy đổi đã xuất hiện trên chứng từ.

CSV gồm `code,name,symbol,measurement_type,decimal_places,integer_only,is_reference,reference_code,factor_to_reference,status`. Khi nhập, đặt dòng tham chiếu trước các dòng quy đổi. API báo lỗi theo dòng và giữ các dòng hợp lệ. Export bao gồm mã đơn vị tham chiếu và hệ số.

Lịch sử thay đổi được lưu trong Audit Log cùng dữ liệu trước và sau, gồm tham chiếu và hệ số. Các thao tác ghi dữ liệu và audit chạy trong transaction.
