# 05. Kiểm tra bảo mật

## Cách kiểm thử

Chạy trên database test riêng với 5 vai trò: người ngoài công ty có/không kèm header, thành viên không vai trò có/không kèm header, và `COMPANY_ADMIN` thật.

## Ma trận kết quả

✅ = HTTP 200, có dữ liệu trả về. ⛔ = HTTP 403.

| Báo cáo | Người ngoài | Người ngoài + header | Thành viên không vai trò | Không vai trò + header | `COMPANY_ADMIN` |
|---|:--:|:--:|:--:|:--:|:--:|
| Bán hàng RPT-0079 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mua hàng RPT-0047 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Công nợ RPT-0053 | ⛔ | ✅ | ⛔ | ✅ | ⛔ |
| Tiền RPT-0036 | ⛔ | ✅ | ⛔ | ✅ | ⛔ |
| Kho RPT-0143 | ⛔ | ✅ | ⛔ | ✅ | ⛔ |
| Tài sản RPT-0160 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Tồn kho as-of | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tài sản as-of | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tiền as-of | ⛔ | ✅ | ⛔ | ✅ | ⛔ |
| BCTC TT99 | ⛔ | ⛔ | ✅ | ✅ | ✅ |

Cả ba hành vi đều sai: người ngoài đọc được dữ liệu, header tự cấp quyền có tác dụng, quản trị công ty thật bị chặn.

## Lỗ hổng

| ID | Lỗ hổng | Mức độ | Bằng chứng | Khắc phục |
|---|---|---|---|---|
| SEC-01 | Người ngoài đọc được báo cáo bán hàng, mua hàng của công ty khác | Nghiêm trọng | Đã chứng minh: 200, nội dung chứa dữ liệu công ty demo. `sales_report_services.py:888` mặc định cấp quyền xem. `resolve_sales_company_scope` chỉ kiểm tra khi client tự gửi `X-Allowed-Companies` | Kiểm tra membership từ database trong mọi hàm scope |
| SEC-02 | Người ngoài đọc tồn kho và tài sản tại ngày | Nghiêm trọng | Đã chứng minh trên `inventory/balances/as-of`, `assets/balances/as-of` | Dùng cùng một lớp kiểm tra |
| SEC-03 | Tự cấp quyền bằng header `X-User-Permissions` | Nghiêm trọng | Đã chứng minh với công nợ, tiền, kho. Vị trí: `debt_report_services.py:1129`, `inventory_report_services.py:509`, `money_report_services.py:491` | Xóa toàn bộ đọc quyền từ request |
| SEC-05 | Header `X-Sales-Permissions`, `X-Tax-Permissions` và tham số URL `mock_permissions` quyết định quyền | Cao | Đọc code: `sales_report_services.py:874`, `tax_report_services.py:989`. Chưa chạy khai thác với thuế | Xóa khỏi code chạy thật |
| SEC-04 | `COMPANY_ADMIN` bị chặn 95 báo cáo vì không đọc vai trò IAM | Cao | Đã chứng minh | Dùng `iam.permissions.has_effective_permission` như `dashboard_services.py` đã làm |
| SEC-06 | Fallback `Company.objects.first()` và `"DEFAULT-COMPANY"` | Cao | Đọc code: `resolve_*_company_scope`. `asset_report_services.py:2324` còn chuyển sang công ty đầu tiên khi id sai | Thiếu công ty thì trả 400 |
| SEC-07 | `tt99-financial-statements` chỉ cần là thành viên, không cần quyền báo cáo | Trung bình | Đã chứng minh với thành viên không vai trò | Thêm quyền báo cáo |
| SEC-08 | JWT sống quá lâu và lưu ở `localStorage` | Cao | Access 7 ngày, refresh 30 ngày | Access 15 phút, cân nhắc cookie HttpOnly |
| SEC-09 | Từ chối yêu cầu tham gia công ty chưa kiểm tra quyền riêng | Trung bình | Test `common_services` thất bại, 200 thay vì 403 | Tách quyền theo hành động |
| SEC-10 | Module đã tắt vẫn cho tạo dữ liệu | Trung bình | Test thất bại | Kiểm tra trạng thái module ở lớp quyền |
| SEC-11 | Mật khẩu dạng thật trong `.env.example` | Trung bình | Đọc file tracked | Thay bằng placeholder, đổi mật khẩu nếu từng dùng |
| SEC-12 | Không có throttle cho API | Trung bình | Không tìm thấy `THROTTLE` trong backend. Có khóa tài khoản 5 lần sai, 15 phút | Thêm throttle cho đăng nhập, đăng ký, quên mật khẩu |
| SEC-13 | Cấu hình mặc định lỏng | Trung bình | `check --deploy` 275 cảnh báo khi `DEBUG=True`, `CORS_ALLOW_ALL_ORIGINS=True` mặc định. `compose.prod.yaml` đã ghi đè | Mặc định an toàn. Chạy lại `check --deploy` với cấu hình production |
| SEC-14 | `organization/companies` trả dòng cho người ngoài | Chưa đủ bằng chứng | Trả 200 có dòng, chưa xem nội dung có phải chỉ công ty của họ hay không | Xác minh |
| SEC-15 | `debt/confirmation-document` trả dữ liệu cho người ngoài | Trung bình, chưa rõ phạm vi | Lượt thử 1 có dấu hiệu, phản hồi chỉ 180 byte | Xác minh và áp lớp kiểm tra chung |

## Điểm đạt

| Hạng mục | Kết quả |
|---|---|
| API ẩn danh | Chỉ mở schema, docs, redoc. Nên tắt ở production |
| Truy cập chi tiết | 46 model thử đọc và ghi xuyên công ty: không rò |
| SQL injection | Không thấy raw SQL ghép chuỗi trong code ứng dụng |
| Blacklist token | Có xoay và thu hồi refresh token |
| Password validator | Có cấu hình |
