# Postman – Common Services

## File cần import

1. `COMMON_SERVICES.postman_collection.json`
2. `COMMON_SERVICES.local.postman_environment.json`

Chọn environment **ERP Common Services – Local/Staging Template** trước khi chạy request.

## Chuẩn bị lần đầu

1. Đặt `base_url`, ví dụ `http://127.0.0.1:8000`.
2. Điền tài khoản test `login` và `password`.
3. Chạy request đăng nhập phù hợp. Collection tự lưu `access_token` và `refresh_token` khi đăng nhập thành công.
4. Điền UUID của dữ liệu seed/staging: `c1_id`, `c2_id`, `b1_id`, `b2_id` và các object ID liên quan.
5. Với OTP, lấy mã từ email sandbox rồi chỉ điền tạm vào `otp_code`. Không lưu OTP, password hoặc token trong defect/evidence.

Các request đăng ký, quên mật khẩu, đăng nhập, tạo join request và AI tự lưu những ID phổ biến từ response vào environment.

## Quy tắc lấy UUID

| Biến | Cách lấy |
|---|---|
| `c1_id`, `c2_id` | Response `GET /api/v1/common/companies/mine/` hoặc dữ liệu seed |
| `b1_id`, `b2_id` | Response `GET /api/v1/common/scopes/` |
| `join_request_id` | Response tạo join request; collection tự lưu khi thành công |
| `notification_id` | Response danh sách notifications |
| `work_item_id` | Response danh sách work-items |
| `c2_work_item_id` | Work-item có thật thuộc C2, do fixture/QA admin chuẩn bị |
| `search_entity_id/type` | Item trả về từ global search |
| `ai_conversation_id` | Response tạo conversation; collection tự lưu |
| `ai_interaction_id` | Response AI query; collection tự lưu |

Không dùng UUID ngẫu nhiên cho test authorization nếu mục tiêu là chứng minh object tồn tại nhưng user không được phép truy cập. UUID ngẫu nhiên chỉ chứng minh object không tồn tại.

## Ví dụ COM11-03

Điều kiện:

- `token_u4`: token của U4, membership C1 và chỉ có Data Scope B1.
- `b2_id`: chi nhánh tồn tại tại C1 nhưng U4 không được truy cập.
- `c2_work_item_id`: work-item tồn tại tại C2.

Chạy lần lượt bốn request trong folder UC-COM-11:

1. `COM11-03A`: list với `branch_id={{b2_id}}`, expected `403`.
2. `COM11-03B`: GET detail `{{c2_work_item_id}}` nhưng `company_id={{c1_id}}`, expected `404`.
3. `COM11-03C`: POST open cùng work-item, expected `404`.
4. `COM11-03D`: GET history cùng work-item, expected `404`.

Ngoài status code, phải xác nhận response không chứa title, reference, link, actor hoặc dữ liệu khác của C2.

## Ghi nhận kết quả

Trong sheet `POSTMAN_CASES` của workbook:

- Chỉ nhập các ô màu vàng: Status, Actual Result, Tester, Ngày chạy, Defect ID và Evidence.
- `Fail` bắt buộc có Actual Result, Tester, Ngày chạy, Defect ID và Evidence.
- `Blocked` bắt buộc có Actual Result, Tester, Ngày chạy và Evidence.
- Cột `Kiểm tra nhập liệu` phải là `Hợp lệ` trước khi hoàn tất test cycle.

Sheet được khóa không mật khẩu để tránh sửa nhầm đặc tả; QA lead có thể dùng **Review → Unprotect Sheet** khi thực sự cần chỉnh cấu trúc.
