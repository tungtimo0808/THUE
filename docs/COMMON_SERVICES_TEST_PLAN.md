# TEST PLAN – Chức năng dùng chung (UC-COM-01 đến UC-COM-12)

## 1. Thông tin tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Hệ thống | ERP Kế toán – Thuế |
| Phạm vi | Chức năng dùng chung, UC-COM-01 đến UC-COM-12 |
| Loại kiểm thử | API, tích hợp, UI/E2E, bảo mật, phân quyền, hiệu năng cơ bản |
| Phiên bản | 1.0 |
| Ngày lập | 30/09/2026 |
| Trạng thái | Draft – cần đối chiếu lại acceptance criteria trên Notion |

## 2. Mục tiêu

- Xác nhận 12 use case dùng chung hoạt động đúng luồng chính, luồng thay thế và lỗi.
- Xác nhận dữ liệu không bị lộ chéo giữa người dùng, doanh nghiệp và chi nhánh.
- Xác nhận vòng đời OTP, mật khẩu và JWT đáp ứng các quy tắc bảo mật.
- Xác nhận Permission, Membership và Data Scope được kiểm tra lại khi người dùng mở dữ liệu.
- Xác nhận thông báo, tìm kiếm, việc cần xử lý và AI nhất quán với phạm vi làm việc hiện tại.
- Tạo cơ sở truy vết giữa use case, API, test case và bộ test tự động.

## 3. Cơ sở và giả định

Kế hoạch này được lập từ danh sách UC do BA cung cấp và implementation hiện tại trong `common_services`. Các trang Notion chưa truy cập được tại thời điểm lập kế hoạch, vì vậy các điểm sau cần được BA/PO xác nhận trước khi ký duyệt:

- OTP gồm 6 chữ số, hiệu lực 5 phút, dùng một lần, tối đa 5 lần nhập sai, gửi lại sau 60 giây.
- Mật khẩu dài 8–64 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt, đồng thời qua bộ kiểm tra mật khẩu của Django.
- Tài khoản bị khóa 15 phút sau 5 lần đăng nhập sai; giới hạn đăng nhập là 30 yêu cầu/5 phút theo định danh/IP.
- Đăng xuất chỉ thu hồi phiên hiện tại; đổi mật khẩu giữ phiên hiện tại và thu hồi phiên khác; đặt lại mật khẩu thu hồi toàn bộ phiên.
- Các endpoint nghiệp vụ kiểm tra đồng thời Membership ACTIVE, Permission và Data Scope.
- Tìm kiếm yêu cầu tối thiểu 2 ký tự và hỗ trợ tìm không dấu.
- AI chỉ đưa ra kết quả hỗ trợ; người dùng phải xác nhận trước khi dùng cho nghiệp vụ kế toán/thuế.
- `confirm_discard` đang có trong request chuyển phạm vi nhưng implementation chưa dùng để kiểm tra dữ liệu chưa lưu; cần xác nhận hành vi mong đợi.
- Email trong hồ sơ hiện là read-only; endpoint xác nhận đổi email tồn tại nhưng chưa có luồng tạo challenge đổi email từ hồ sơ. Cần xác nhận phạm vi UC-COM-07.

## 4. Phạm vi kiểm thử

### 4.1 Trong phạm vi

| UC | Chức năng | API chính |
|---|---|---|
| UC-COM-01 | Đăng ký và xác thực tài khoản | `POST /api/v1/common/auth/register/`, `verify-registration/`, `resend-verification/`, `change-registration-email/` |
| UC-COM-02 | Gửi yêu cầu tham gia doanh nghiệp | `GET /companies/search/`, `GET/POST /join-requests/`, `POST /join-requests/{id}/cancel/`, API duyệt `company-join-requests` |
| UC-COM-03 | Đăng nhập | `POST /api/v1/common/auth/login/`, `POST /api/token/refresh/` |
| UC-COM-04 | Đăng xuất | `POST /api/v1/common/auth/logout/` |
| UC-COM-05 | Quên và đặt lại mật khẩu | `POST /auth/forgot-password/`, `POST /auth/reset-password/` và alias cũ |
| UC-COM-06 | Đổi mật khẩu | `POST /auth/change-password/` |
| UC-COM-07 | Quản lý tài khoản cá nhân | `GET/PATCH /profile/`, `POST /profile/confirm-email/` |
| UC-COM-08 | Chuyển phạm vi làm việc | `GET /scopes/`, `GET /companies/mine/`, `POST /companies/switch/` |
| UC-COM-09 | Xem và xử lý thông báo | `GET /notifications/` và các action `read`, `unread`, `read-all`, `archive`, `unread-count`, `open` |
| UC-COM-10 | Tìm kiếm toàn hệ thống | `GET /search/`, `POST /search/open/` |
| UC-COM-11 | Xem việc cần xử lý | `GET /work-items/` và các action `count`, `open`, `history` |
| UC-COM-12 | Sử dụng AI Assistant | `GET/POST /ai-conversations/`, `POST /ai/query/`, `confirm`, `feedback`, `source` |

### 4.2 Ngoài phạm vi

- Logic chi tiết của các module nghiệp vụ được tìm kiếm hoặc tạo work-item.
- Chất lượng nghiệp vụ chuyên sâu của mô hình AI bên thứ ba.
- Kiểm thử hạ tầng gửi email thực tế; test tích hợp dùng email sandbox, test tự động dùng in-memory backend.
- Penetration test đầy đủ và kiểm thử tải quy mô production; chỉ thực hiện security/performance smoke trong kế hoạch này.

## 5. Chiến lược kiểm thử

| Lớp | Nội dung | Công cụ gợi ý |
|---|---|---|
| Unit/service | Validation, chuyển trạng thái, scope, OTP, session | Django TestCase/pytest |
| API integration | Status code, schema, DB side effect, audit/security log, email | DRF APIClient/Postman/Newman |
| UI/E2E | Luồng người dùng từ màn hình đến API, thông báo lỗi, điều hướng | Playwright/Cypress |
| Authorization | User khác, doanh nghiệp khác, chi nhánh ngoài scope, permission bị thu hồi | APIClient + dữ liệu role/scope |
| Security | Enumeration, brute force, token revocation, upload giả mạo, dữ liệu AI nhạy cảm | Automated negative tests + OWASP ZAP smoke |
| Performance | Login, notification list, search, work-items và AI timeout | k6/JMeter |

Quy ước ưu tiên:

- **P0:** chặn release nếu lỗi; xác thực, session, phân quyền, rò rỉ dữ liệu.
- **P1:** luồng nghiệp vụ chính hoặc tính toàn vẹn dữ liệu.
- **P2:** trải nghiệm, lọc/sắp xếp, biên ít gặp.

## 6. Môi trường và dữ liệu kiểm thử

### 6.1 Môi trường

- CI: SQLite, email in-memory, AI provider mock.
- Integration/Staging: PostgreSQL 16, Redis/cache tương đương production, email sandbox, AI provider stub có thể điều khiển timeout/lỗi/kích thước response.
- Đồng hồ hệ thống đồng bộ; timezone mặc định `Asia/Ho_Chi_Minh`.
- Bật HTTPS và cấu hình CORS/secret gần production ở staging.

### 6.2 Bộ dữ liệu chuẩn

| Mã | Dữ liệu |
|---|---|
| U0 | Người chưa đăng ký |
| U1 | Tài khoản chờ xác thực |
| U2 | Tài khoản ACTIVE, chưa thuộc doanh nghiệp |
| U3 | Thành viên ACTIVE của C1, quyền đầy đủ, toàn bộ chi nhánh |
| U4 | Thành viên ACTIVE của C1, chỉ được B1, quyền hạn chế |
| U5 | Thành viên của C1 và C2, các role khác nhau |
| U6 | Tài khoản INACTIVE/LOCKED |
| U7 | Quản trị C1 có `COM.JOIN_REQUEST.VIEW/APPROVE` |
| U8 | Người dùng C2, không có quan hệ với C1 |
| C1/C2 | Hai doanh nghiệp ACTIVE; mã số thuế, mã doanh nghiệp khác nhau |
| B1/B2 | Hai chi nhánh ACTIVE của C1; thêm một chi nhánh INACTIVE |
| S1/S2 | Hai phiên đăng nhập của cùng U3 trên hai thiết bị/IP/User-Agent |
| N1–N6 | Thông báo unread/read/expired/archived/global/không còn permission |
| W1–W6 | Work-item pending/in-progress/overdue/completed/cancelled, gán user/gán role |
| A1 | AI tắt; A2: AI bật không dữ liệu; A3: provider thành công; A4: timeout/lỗi |

Không dùng email/số điện thoại thật hoặc dữ liệu kế toán production. Mỗi test phải tự tạo hoặc reset dữ liệu và không phụ thuộc thứ tự chạy.

## 7. Ma trận test case chức năng

### 7.1 UC-COM-01 – Đăng ký và xác thực tài khoản

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM01-01 | P0 | Đăng ký đủ dữ liệu hợp lệ và chấp nhận điều khoản | `201`; tạo user inactive, IAM account, preference, session state, challenge REGISTER; email OTP được gửi; không trả password/OTP |
| COM01-02 | P0 | Xác thực bằng challenge và OTP đúng | `200`; user ACTIVE, email được đánh dấu verified, OTP consumed, trả access/refresh và bước tiếp theo |
| COM01-03 | P0 | Nhập sai OTP lần 1–4 | `400`; không kích hoạt tài khoản; số lần thử tăng đúng |
| COM01-04 | P0 | Nhập sai OTP lần 5 rồi nhập mã đúng | Challenge bị vô hiệu; mã đúng sau đó vẫn bị từ chối |
| COM01-05 | P0 | OTP hết hạn hoặc đã dùng | `400`; không kích hoạt; không thể replay OTP |
| COM01-06 | P1 | Gửi lại OTP sau cooldown | `202`; challenge cũ consumed, challenge mới có hiệu lực, gửi đúng email |
| COM01-07 | P1 | Gửi lại OTP trong 60 giây | `400` và có `retry_after`; không gửi thêm email |
| COM01-08 | P0 | Email/số điện thoại trùng, kể cả khác hoa thường | `400`; không tạo bản ghi dở dang |
| COM01-09 | P1 | Mật khẩu yếu, xác nhận sai, chưa chấp nhận điều khoản | `400` theo đúng field; không tạo user |
| COM01-10 | P1 | Email/phone sai định dạng; tên chỉ có khoảng trắng; field vượt max length | `400` và thông báo validation phù hợp |
| COM01-11 | P1 | Đổi email khi đang chờ xác thực bằng challenge hợp lệ | Email/user preference cập nhật; OTP cũ mất hiệu lực; OTP mới gửi đến email mới |
| COM01-12 | P0 | Đổi sang email đã dùng hoặc dùng challenge của đăng ký đã active | `400`; không thay đổi email |
| COM01-13 | P1 | Gọi xác thực thành công lặp lại cùng challenge | Kết quả idempotent; không tạo session/dữ liệu sai ngoài dự kiến |
| COM01-14 | P0 | Vượt rate limit đăng ký/OTP theo email hoặc IP | `429`; khóa theo bucket đúng và không làm lộ OTP/dữ liệu tài khoản |

### 7.2 UC-COM-02 – Gửi yêu cầu tham gia doanh nghiệp

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM02-01 | P1 | Tìm doanh nghiệp theo mã/tên/mã số thuế với từ khóa >= 2 ký tự | Chỉ trả doanh nghiệp ACTIVE, tối đa 20; mã số thuế được che chỉ còn 4 số cuối |
| COM02-02 | P1 | Từ khóa tìm doanh nghiệp < 2 ký tự | `400`; không trả toàn bộ danh sách |
| COM02-03 | P0 | Gửi yêu cầu hợp lệ tới C1 | `201`; status PENDING, requester là user hiện tại, ngày hết hạn đúng; thông báo cho requester/admin |
| COM02-04 | P0 | Gửi yêu cầu PENDING trùng C1 | `400`; chỉ tồn tại một yêu cầu pending |
| COM02-05 | P1 | Gửi yêu cầu bằng invitation code hợp lệ | Chọn đúng doanh nghiệp; tăng use count; auto-approve nếu invitation cấu hình như vậy |
| COM02-06 | P0 | Invitation hết hạn/bị thu hồi/sai/vượt max use | `400`; không tạo membership hoặc tăng use count sai |
| COM02-07 | P0 | User đã là thành viên ACTIVE của C1 vẫn gửi yêu cầu | Bị từ chối; không tạo yêu cầu trùng |
| COM02-08 | P1 | Requester hủy yêu cầu PENDING của chính mình | Status CANCELLED, ghi thời điểm/lịch sử phù hợp; admin không thể duyệt sau đó |
| COM02-09 | P0 | User khác hủy hoặc xem chi tiết yêu cầu không thuộc mình | `404/403`; không lộ nội dung yêu cầu |
| COM02-10 | P0 | Admin đủ quyền duyệt APPROVED | Tạo/khôi phục membership ACTIVE đúng user/C1; ghi decided_by/at/reason; gửi thông báo; idempotency được kiểm soát |
| COM02-11 | P1 | Admin từ chối REJECTED | Không tạo membership; lưu reason và gửi thông báo requester |
| COM02-12 | P0 | Người không có `VIEW/APPROVE` hoặc admin C2 xử lý yêu cầu C1 | `403/404`; không thay đổi yêu cầu |
| COM02-13 | P1 | Yêu cầu hết hạn được truy vấn/xử lý | Chuyển EXPIRED; không cho cancel/approve/reject |
| COM02-14 | P1 | Hai admin duyệt đồng thời cùng yêu cầu | Chỉ một quyết định hiệu lực; không tạo membership trùng hoặc thông báo trùng |

### 7.3 UC-COM-03 – Đăng nhập

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM03-01 | P0 | Đăng nhập bằng email hợp lệ | `200`; trả access, refresh, session, user và danh sách doanh nghiệp |
| COM03-02 | P0 | Đăng nhập bằng username hợp lệ, không phân biệt hoa thường | Thành công như email; ghi LoginLog SUCCESS |
| COM03-03 | P0 | Sai password hoặc identifier không tồn tại | `401`; thông báo không cho phép suy ra tài khoản tồn tại; ghi log phù hợp |
| COM03-04 | P0 | Tài khoản chưa xác thực | `401` với trạng thái pending verification; không cấp token |
| COM03-05 | P0 | Sai 5 lần liên tiếp | Tài khoản khóa 15 phút; các session đang hoạt động bị revoke |
| COM03-06 | P0 | Đăng nhập đúng trong thời gian bị khóa | Bị từ chối bằng thông báo chung; không tiết lộ chi tiết khóa |
| COM03-07 | P1 | Đăng nhập sau khi hết thời gian khóa | Thành công; reset failed count và locked_until |
| COM03-08 | P0 | Vượt rate limit 30 lần/5 phút | `429`; áp dụng theo identifier và IP |
| COM03-09 | P1 | User chưa có doanh nghiệp | `requires_company_setup=true`; không tự chọn company |
| COM03-10 | P1 | User có đúng một doanh nghiệp | Tự chọn `current_company`; `requires_company_selection=false` |
| COM03-11 | P1 | User có nhiều doanh nghiệp | `requires_company_selection=true`; không tự chọn tùy tiện |
| COM03-12 | P0 | Refresh token hợp lệ/revoked/hết hạn/sai chữ ký | Chỉ token hợp lệ của session active được refresh; còn lại `401` |
| COM03-13 | P1 | Hai thiết bị đăng nhập cùng lúc | Tạo hai session ID độc lập, lưu IP/User-Agent và không ghi đè nhau |

### 7.4 UC-COM-04 – Đăng xuất

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM04-01 | P0 | Đăng xuất với access và refresh của cùng session S1 | `204`; S1 revoked/refresh blacklisted; access S1 không gọi API được nữa |
| COM04-02 | P0 | Sau khi logout S1, dùng S2 của cùng user | S2 vẫn hoạt động bình thường |
| COM04-03 | P0 | Logout không gửi refresh | Session theo `sid` của access vẫn bị revoke |
| COM04-04 | P0 | Gửi refresh của session khác cùng user | Không blacklist nhầm session khác; chỉ session hiện tại bị thu hồi |
| COM04-05 | P1 | Refresh sai định dạng/đã blacklist trong body | Logout vẫn an toàn và idempotent, không phát sinh lỗi 5xx |
| COM04-06 | P0 | Không có access token hoặc access đã hết hạn | `401`; không tác động session của user khác |
| COM04-07 | P1 | Gọi logout lặp lại | Không tạo side effect nguy hiểm; token tiếp tục không dùng được |

### 7.5 UC-COM-05 – Quên và đặt lại mật khẩu

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM05-01 | P0 | Yêu cầu reset bằng email/username của tài khoản active đã verify | Luôn `202`; tạo challenge PASSWORD_RESET và gửi OTP tới email đã verify |
| COM05-02 | P0 | Identifier không tồn tại, inactive hoặc chưa verify | Cùng status/response shape/thời gian gần tương đương; không gửi email; không lộ account existence |
| COM05-03 | P1 | Yêu cầu lại trong cooldown | Bị hạn chế theo quy tắc; không tạo nhiều OTP còn hiệu lực |
| COM05-04 | P0 | Reset với OTP đúng và mật khẩu mạnh | `200`; đổi password; challenge consumed; reset failed-login/lock state |
| COM05-05 | P0 | OTP sai/hết hạn/đã dùng/sai purpose | `400`; mật khẩu không đổi; tối đa 5 lần sai |
| COM05-06 | P1 | Mật khẩu mới yếu, trùng mật khẩu hiện tại hoặc confirm không khớp | `400`; challenge/password/session không bị thay đổi sai |
| COM05-07 | P0 | Sau reset, kiểm tra mọi access/refresh cũ trên S1/S2 | Tất cả session/token cũ bị revoke; mật khẩu cũ đăng nhập thất bại |
| COM05-08 | P0 | Đăng nhập bằng mật khẩu mới | Thành công và tạo session mới |
| COM05-09 | P1 | Email thông báo sau reset | Gửi tới email tài khoản; lỗi gửi mail không rollback đổi password nhưng có security event |
| COM05-10 | P0 | Vượt rate limit reset theo identifier/IP | `429`; không gửi email hàng loạt |
| COM05-11 | P1 | Alias endpoint cũ và mới | Hai cặp route có hành vi/schema tương thích |

### 7.6 UC-COM-06 – Đổi mật khẩu

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM06-01 | P0 | Current password đúng, new password mạnh, confirm khớp | `200 changed=true`; mật khẩu cập nhật; security/audit event phù hợp |
| COM06-02 | P0 | Current password sai lần 1–4 | `400`; không đổi password; tăng failure của đúng session |
| COM06-03 | P0 | Current password sai lần 5 | Session hiện tại bị revoke; session khác không bị tác động ngoài quy tắc đã duyệt |
| COM06-04 | P1 | New password trùng current | `400`; không gửi email success, không revoke session |
| COM06-05 | P1 | New password yếu hoặc confirm sai | `400` đúng field; không đổi dữ liệu |
| COM06-06 | P0 | Đổi thành công khi có S1 và S2 | Giữ S1 hiện tại; revoke S2 và mọi session khác với reason `PASSWORD_CHANGED` |
| COM06-07 | P0 | Dùng mật khẩu cũ/mới sau đổi | Mật khẩu cũ thất bại, mật khẩu mới thành công |
| COM06-08 | P1 | Email thông báo đổi mật khẩu lỗi | Đổi mật khẩu vẫn commit; tạo security event cảnh báo |
| COM06-09 | P0 | User inactive hoặc không có JWT hợp lệ | `401/403`; không thay đổi mật khẩu |

### 7.7 UC-COM-07 – Quản lý tài khoản cá nhân

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM07-01 | P1 | GET hồ sơ với JWT hợp lệ | Trả đúng dữ liệu của user hiện tại; không trả hash/password/token |
| COM07-02 | P1 | PATCH display_name, phone, first_name, last_name hợp lệ | `200`; chuẩn hóa display name; DB và response đồng nhất; ghi audit cho các membership |
| COM07-03 | P0 | Cố sửa email/username/status/id qua PATCH | `400` hoặc bỏ qua an toàn theo hợp đồng; không thay đổi field read-only |
| COM07-04 | P1 | Phone sai định dạng hoặc trùng user khác | `400`; không cập nhật một phần |
| COM07-05 | P1 | PATCH body không có field cho phép | `400 Không có thông tin hồ sơ nào được thay đổi` |
| COM07-06 | P1 | Upload JPEG/PNG thật <= 5 MB | Lưu avatar; trả URL hợp lệ và truy cập đúng quyền/cấu hình media |
| COM07-07 | P0 | File giả mạo extension, sai magic bytes hoặc > 5 MB | `400`; không lưu file; không thực thi nội dung |
| COM07-08 | P1 | remove_avatar=true | Gỡ liên kết avatar; response `avatar_url=null`; xử lý file vật lý theo chính sách |
| COM07-09 | P1 | Optimistic locking với `version` cũ | `400`; không ghi đè thay đổi từ phiên khác |
| COM07-10 | P1 | Hai PATCH đồng thời với cùng version | Chỉ một cập nhật thắng; request còn lại nhận conflict/validation |
| COM07-11 | P0 | Confirm email challenge của user khác/sai/hết hạn | `400/403`; email không đổi |
| COM07-12 | P1 | Confirm đổi email hợp lệ | Email và normalized_email cập nhật nguyên tử; email trùng bị từ chối |

### 7.8 UC-COM-08 – Chuyển phạm vi làm việc

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM08-01 | P1 | GET scopes của user có nhiều membership | Chỉ trả company/membership ACTIVE và branch ACTIVE trong Data Scope |
| COM08-02 | P0 | User có scope toàn doanh nghiệp chọn `all_branches=true` | Cập nhật preference company, branch null, all_branches true; ghi audit |
| COM08-03 | P0 | User không có scope toàn doanh nghiệp chọn all branches | `403`; preference cũ giữ nguyên |
| COM08-04 | P0 | Chọn branch thuộc company nhưng ngoài Data Scope | `403`; không chuyển phạm vi |
| COM08-05 | P0 | Chọn branch của C2 khi company=C1 | `403/404`; không lộ dữ liệu C2 |
| COM08-06 | P1 | Không truyền branch khi chỉ có một branch được phép | Tự chọn branch duy nhất |
| COM08-07 | P1 | Không truyền branch/all_branches khi có nhiều branch | `400`, yêu cầu lựa chọn rõ ràng |
| COM08-08 | P0 | Membership/company/branch INACTIVE | `403/404/400`; không cập nhật preference |
| COM08-09 | P1 | Chuyển qua lại C1/B1 → C2/Bx | Context sau cùng chính xác; API sau đó mặc định dùng current company/scope mới |
| COM08-10 | P1 | Có dữ liệu UI chưa lưu và `confirm_discard=false/true` | UI cảnh báo; chỉ chuyển khi xác nhận theo acceptance criteria đã duyệt |
| COM08-11 | P0 | Permission/Data Scope bị thu hồi sau khi đã chọn scope | Các request tiếp theo bị chặn hoặc yêu cầu chọn lại; không dựa vào preference cũ để cấp quyền |

### 7.9 UC-COM-09 – Xem và xử lý thông báo

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM09-01 | P1 | Liệt kê thông báo của user | Phân trang mặc định 20, mới nhất trước; chỉ recipient hiện tại; loại archived/expired |
| COM09-02 | P1 | Lọc company, unread/status, level, module, date range | Kết quả thỏa tất cả bộ lọc; page_size tối đa 100 |
| COM09-03 | P0 | User U8 truy cập notification ID của U3 | `404`; không lộ title/message/link |
| COM09-04 | P1 | Mark read rồi mark unread | `read_at` được set/clear; status READ/UNREAD đúng; thao tác idempotent |
| COM09-05 | P1 | Read all trong phạm vi/bộ lọc hiện tại | Chỉ cập nhật tập đang thấy; trả số lượng chính xác |
| COM09-06 | P1 | Unread count theo company/filter | Khớp danh sách và thay đổi ngay sau read/unread/archive |
| COM09-07 | P1 | Archive/hide notification | `204`; không còn trong list/count; không xóa vật lý ngoài chính sách |
| COM09-08 | P0 | Open notification khi vẫn có membership và permission | Tự mark read; trả link hoặc null đúng dữ liệu |
| COM09-09 | P0 | Permission/membership bị thu hồi trước khi open | `403`; không điều hướng hoặc lộ nội dung đích |
| COM09-10 | P1 | Notification toàn hệ thống không có company | Vẫn hiển thị đúng recipient và mở an toàn |
| COM09-11 | P1 | Tạo lại cùng `recipient + event_key` | Không tạo thông báo trùng |
| COM09-12 | P2 | Mốc ngày/giờ quanh 00:00 timezone Việt Nam | Lọc date_from/date_to đúng ngày địa phương đã thống nhất |

### 7.10 UC-COM-10 – Tìm kiếm toàn hệ thống

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM10-01 | P1 | Tìm theo tên có dấu và truy vấn không dấu | Trả cùng đối tượng phù hợp; highlight/preview không làm sai dữ liệu |
| COM10-02 | P1 | Query có khoảng trắng thừa, đúng 2 ký tự, 1 ký tự, >255 ký tự | Chuẩn hóa hợp lệ; biên sai trả `400` |
| COM10-03 | P0 | User không có `COM.SEARCH.USE` | `403`; không trả tổng số hay preview |
| COM10-04 | P0 | Kết quả thuộc company khác/branch ngoài scope | Không xuất hiện trong bất kỳ group/count nào |
| COM10-05 | P1 | Lọc group/status/date/branch | Kết quả và total theo đúng điều kiện |
| COM10-06 | P1 | Pagination theo group với page/page_size/preview_size biên | Không trùng/mất bản ghi; max lần lượt 100/20 được thực thi |
| COM10-07 | P1 | Không truyền company nhưng có current_company | Dùng đúng current company; thiếu cả hai trả lỗi an toàn |
| COM10-08 | P0 | Mở kết quả hợp lệ | Re-check membership, permission, scope và trạng thái entity; trả link đích đúng |
| COM10-09 | P0 | Permission bị thu hồi hoặc entity bị xóa/inactive sau search | Open bị từ chối/cảnh báo phù hợp; không dùng quyền cache cũ |
| COM10-10 | P0 | Thử SQL wildcard/injection/XSS payload trong q | Không lỗi 5xx, không injection, output được encode tại UI |
| COM10-11 | P1 | Đo latency với dữ liệu lớn và truy vấn không có kết quả | Đạt SLA; response ổn định, không full-table payload |

### 7.11 UC-COM-11 – Xem việc cần xử lý

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM11-01 | P1 | Liệt kê work-item gán trực tiếp cho user | Trả đúng company/scope/permission, phân trang chính xác |
| COM11-02 | P1 | Work-item gán theo role của user | Hiển thị khi assignment hiệu lực; ẩn khi role hết hiệu lực/bị revoke |
| COM11-03 | P0 | Item C2 hoặc branch ngoài scope | Không xuất hiện và không truy cập được bằng ID |
| COM11-04 | P1 | Item PENDING/IN_PROGRESS quá due_at | Tự chuyển OVERDUE; tạo history đúng, không tạo lặp mỗi lần GET |
| COM11-05 | P1 | Lọc task_type/status/priority/q/due_from/due_to | Kết quả đúng giao của bộ lọc |
| COM11-06 | P1 | Sắp xếp mặc định và theo due_at/created_at | OVERDUE trước; URGENT > HIGH > NORMAL; thứ tự ổn định |
| COM11-07 | P1 | Count việc đang mở | Chỉ đếm PENDING/IN_PROGRESS/OVERDUE trong phạm vi nhìn thấy |
| COM11-08 | P0 | Open item hợp lệ | Re-check entity/permission/scope; chuyển sang IN_PROGRESS nếu phù hợp; trả link; ghi history |
| COM11-09 | P0 | Entity không còn khả dụng hoặc permission bị thu hồi | Không mở; item được cancel/ẩn theo rule; không lộ link đích |
| COM11-10 | P1 | Xem history | Đúng thứ tự thời gian, trạng thái trước/sau, actor, reason; chỉ user được thấy item mới thấy history |
| COM11-11 | P1 | Tạo cùng dedupe_key nhiều lần/đồng thời | Chỉ một active work-item; không vi phạm unique/không lỗi 5xx |
| COM11-12 | P1 | Chuyển trạng thái không hợp lệ, ví dụ OVERDUE → COMPLETED nếu rule cấm | Bị từ chối; trạng thái/history không thay đổi |

### 7.12 UC-COM-12 – Sử dụng AI Assistant

| ID | P | Kịch bản / Dữ liệu chính | Kết quả mong đợi |
|---|---:|---|---|
| COM12-01 | P0 | User không có `COM.AI.USE` | `403`; không gọi provider và không lưu dữ liệu nhạy cảm |
| COM12-02 | P1 | AI bị tắt ở company | `503`, status UNAVAILABLE, có hướng dẫn dùng chức năng thủ công |
| COM12-03 | P1 | AI bật nhưng dữ liệu trong scope không đủ | `201`, status INSUFFICIENT_DATA, không bịa nguồn/kết luận |
| COM12-04 | P1 | Tạo conversation hợp lệ theo company/branch | `201`; owner là user hiện tại; branch phải ACTIVE và thuộc company/scope |
| COM12-05 | P0 | Xem conversation/interaction của user khác hoặc C2 | `404/403`; không lộ question/context/answer/source |
| COM12-06 | P1 | Query hợp lệ theo LOOKUP/EXPLAIN/ANALYSIS/GUIDANCE | Provider nhận context đã lọc; lưu type, scope snapshot, processing time, disclaimer |
| COM12-07 | P0 | Context chứa password/token/secret hoặc dữ liệu ngoài scope | Giá trị nhạy cảm được `[REDACTED]`; dữ liệu ngoài scope không gửi provider |
| COM12-08 | P0 | Prompt injection yêu cầu bỏ qua quyền hoặc truy xuất C2 | Không vượt Permission/Data Scope; câu trả lời không lộ dữ liệu |
| COM12-09 | P1 | Gửi lại cùng `request_id` | Idempotent, trả interaction cũ; provider không bị gọi hai lần |
| COM12-10 | P1 | conversation/parent không thuộc user hoặc không tương thích | `400/403`; không nối sai chuỗi hội thoại |
| COM12-11 | P1 | Provider timeout, HTTP lỗi, JSON sai hoặc response quá lớn | `503`, status UNAVAILABLE, thông báo fallback; không lỗi 5xx không kiểm soát |
| COM12-12 | P1 | Confirm interaction COMPLETED | Set confirmed_at; interaction không completed bị từ chối |
| COM12-13 | P1 | Gửi/cập nhật feedback helpful và comment | Upsert đúng một feedback/interaction/user; comment tối đa 1000 |
| COM12-14 | P0 | Mở source index hợp lệ/không hợp lệ hoặc source ngoài quyền | Chỉ mở nguồn còn được phép; index sai trả `400/404` |
| COM12-15 | P1 | Question 2/3/4000/4001 ký tự và context rất lớn | Thực thi đúng giới hạn đã duyệt; không treo hoặc vượt payload limit |
| COM12-16 | P1 | Nội dung output có HTML/script/công thức nguy hiểm | UI encode/sanitize; không XSS; disclaimer luôn hiển thị |

## 8. Kiểm thử xuyên suốt và phi chức năng

| ID | P | Hạng mục | Tiêu chí |
|---|---:|---|---|
| X-01 | P0 | Authentication bắt buộc | Mọi API private trả `401` nếu thiếu/sai/hết hạn token |
| X-02 | P0 | Tenant isolation | Không đọc/ghi chéo C1/C2 bằng cách sửa UUID/query parameter |
| X-03 | P0 | Object ownership | Notification, join request, conversation, interaction và work-item không bị IDOR |
| X-04 | P0 | Transaction | Luồng nhiều bước rollback nguyên tử khi lỗi giữa chừng |
| X-05 | P1 | Audit/security log | Ghi đủ actor, company, action, IP, request ID; không ghi password/OTP/token |
| X-06 | P0 | Sensitive response/log | Không xuất hiện password, password hash, OTP, API key, refresh/access token ngoài endpoint cấp token |
| X-07 | P1 | Concurrency | Duyệt join request, OTP, read-all, đổi hồ sơ và idempotency AI không race-condition |
| X-08 | P1 | Pagination abuse | page/page_size âm, cực lớn hoặc sai kiểu trả `400`, không gây tải bất thường |
| X-09 | P1 | Content type/payload | JSON sai, field thừa, UUID/date sai, body quá lớn được xử lý nhất quán |
| X-10 | P1 | Accessibility UI | Điều hướng bàn phím, focus, label, thông báo lỗi, contrast đạt WCAG 2.1 AA cho các luồng chính |
| X-11 | P1 | Responsive/browser | Chrome/Edge/Firefox bản hỗ trợ; mobile/tablet với màn hình auth và thông báo |
| X-12 | P1 | Hiệu năng | p95 login/list/search/work-items < 2 giây ở tải mục tiêu; AI phản hồi/fallback trong timeout cấu hình 20 giây |
| X-13 | P1 | Rate limiting | Rate limit hoạt động trên nhiều worker và không phụ thuộc cache local ở production |
| X-14 | P1 | Recovery | Email/AI/cache tạm lỗi không làm mất dữ liệu đã commit hoặc trả lỗi sai hợp đồng |

## 9. Truy vết UC – test tự động hiện có

| UC | Coverage tự động hiện có trong `common_services/tests.py` | Khoảng trống ưu tiên |
|---|---|---|
| COM-01 | Đăng ký, xác thực, consent, resend cooldown | OTP sai 5 lần, expiry, duplicate, rate limit, đổi email đăng ký |
| COM-02 | Tạo trùng, admin duyệt, membership, notification | Invitation, reject/cancel/expire, permission, concurrency |
| COM-03 | Login thành công trong happy path | Lockout, rate limit, nhiều company, refresh revoked |
| COM-04 | Thu hồi đúng session hiện tại | Refresh session khác, logout không refresh, idempotency |
| COM-05 | Reset thành công, chống account enumeration, chống reuse OTP | Expiry/5 lần sai/cooldown, revoke đa thiết bị, email failure |
| COM-06 | Giữ session hiện tại và revoke session khác | 5 lần current password sai, password policy, email failure |
| COM-07 | Cập nhật display name, email read-only | Avatar, phone, optimistic lock, confirm email, concurrency |
| COM-08 | Scope toàn branch và switch company | Restricted scope, inactive objects, cross-company, unsaved changes |
| COM-09 | Count/read/unread/archive và ownership cơ bản | Bộ lọc, read-all scope, expired, open re-authorization, event dedupe |
| COM-10 | Không dấu và re-check khi open | Permission denied, filter/paging, injection, performance |
| COM-11 | Dedupe, overdue, history, invalid transition | Role assignment, filtering/ordering/count, entity stale, concurrency |
| COM-12 | Fallback, insufficient data, conversation, idempotency, redaction, feedback | Provider success/error, prompt injection, confirm/source, cross-user isolation |

## 10. Bộ smoke test trước mỗi bản build

1. COM01-01, COM01-02 – đăng ký và xác thực.
2. COM03-01 – đăng nhập và nhận JWT.
3. COM08-01, COM08-02 – lấy/chuyển phạm vi.
4. COM09-01, COM09-04 – danh sách và đọc thông báo.
5. COM10-01, COM10-08 – tìm và mở kết quả.
6. COM11-01, COM11-08 – xem và mở việc cần xử lý.
7. COM12-02 hoặc COM12-06 – AI fallback hoặc provider thành công theo cấu hình môi trường.
8. COM06-06 – đổi mật khẩu và kiểm tra session.
9. COM04-01 – đăng xuất.
10. X-01, X-02, X-03 – kiểm tra auth, tenant isolation và IDOR.

## 11. Điều kiện vào/ra

### Điều kiện vào

- Acceptance criteria của 12 UC đã được BA/PO xác nhận và version hóa.
- API schema/migration ổn định; seed Permission đầy đủ.
- Staging có PostgreSQL, email sandbox, cache dùng chung và AI stub/provider.
- Có bộ dữ liệu role, membership, branch scope và user đa thiết bị như mục 6.
- Có SLA hiệu năng và ma trận browser chính thức.

### Điều kiện ra

- 100% test P0 và P1 đã chạy; 100% P0 pass.
- P1 pass >= 95%; lỗi còn lại có owner, workaround và chấp thuận release.
- Không còn defect Severity 1/2 mở liên quan authentication, authorization, tenant isolation hoặc mất dữ liệu.
- Coverage API/use case đạt 100% theo traceability; regression tự động chạy xanh.
- Báo cáo security smoke và performance smoke đạt tiêu chí đã duyệt.

## 12. Phân loại lỗi và quy trình báo cáo

| Severity | Định nghĩa | Ví dụ |
|---|---|---|
| S1 Critical | Rò rỉ chéo tenant, chiếm tài khoản, mất dữ liệu diện rộng, hệ thống không dùng được | U8 đọc dữ liệu C1; token revoked vẫn hợp lệ |
| S2 High | Luồng chính không hoàn thành, sai quyền hoặc sai dữ liệu quan trọng | Không reset password; duyệt join request tạo sai membership |
| S3 Medium | Có workaround, ảnh hưởng bộ lọc/trạng thái/UX đáng kể | Unread count sai, filter work-item sai |
| S4 Low | Hiển thị, wording hoặc trường hợp biên nhỏ | Căn lề, thông báo lỗi chưa rõ |

Mỗi defect cần có: môi trường/build, UC/test ID, precondition, dữ liệu đã che nhạy cảm, bước tái hiện, actual/expected, response/status code, log correlation ID, ảnh/video nếu là UI và đánh giá tenant/security impact.

## 13. Rủi ro và điểm cần quyết định

| Rủi ro/điểm mở | Ảnh hưởng | Hành động đề xuất |
|---|---|---|
| Chưa đối chiếu nội dung Notion | Có thể lệch acceptance criteria hoặc wording | BA/PO review mục 3 và toàn bộ expected result |
| `confirm_discard` chưa được dùng ở backend | Có thể mất dữ liệu UI chưa lưu khi đổi scope | Chốt UI-owned hay backend-owned; bổ sung E2E tương ứng |
| Luồng khởi tạo đổi email hồ sơ chưa rõ | UC-COM-07 có endpoint confirm nhưng không có endpoint request | Chốt scope và bổ sung API/test nếu cần |
| Rate limit dựa trên cache | Cache local đa worker có thể bị bypass | Staging dùng Redis/shared cache và test phân tán |
| AI provider bên ngoài | Timeout, dữ liệu nhạy cảm, kết quả không xác định | Dùng stub cho regression; contract/security test riêng với provider |
| Search/work-item đồng bộ nhiều module | Dễ sai permission hoặc chậm khi dữ liệu lớn | Contract test từng adapter và đo query count/latency |

## 14. Lệnh kiểm tra đề xuất

```powershell
venv\Scripts\python.exe manage.py test common_services -v 2
venv\Scripts\python.exe manage.py spectacular --file schema.yml --validate
```

Khi bổ sung automation, nên đặt tên test theo mã test case, ví dụ `test_com01_04_otp_is_invalidated_after_five_failed_attempts`, để truy vết trực tiếp từ báo cáo CI về tài liệu này.
