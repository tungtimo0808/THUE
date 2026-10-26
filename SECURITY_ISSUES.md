# Rà soát bảo mật — 26/10/2026

Các mục SEC-01 đến SEC-03 là **đường đi có thể vượt phạm vi quyền suy ra từ mã**, chưa có test HTTP nhiều doanh nghiệp/chi nhánh tái hiện trong bộ test hiện tại. Cần ưu tiên kiểm chứng và khóa trước khi đưa dữ liệu thật vào hệ thống. Không dùng kết quả test chạy bằng superuser để chứng minh phân quyền người dùng thường.

| ID | Mức | Vấn đề | Bằng chứng |
|---|---|---|---|
| SEC-01 | Critical | Kiểm quyền ở doanh nghiệp A, truy vấn bán hàng ở B | `backend/sales/permissions.py:34-41`, `backend/sales/views.py:19-27` |
| SEC-02 | Critical | Kiểm quyền tạo ở A, lưu bản ghi vào B | `backend/iam/permissions.py:225-230`, `backend/general_ledger/views.py:43-53`, `backend/purchases/permissions.py:18-22` |
| SEC-03 | High | Danh sách không lọc theo chi nhánh được cấp | `backend/accounts_payable/views.py:22-28`, `backend/accounts_receivable/views.py:28-37`, `backend/sales/views.py:19-27` |
| SEC-04 | High nếu dùng compose ngoài máy phát triển | Cấu hình phát triển mở ra mạng | `compose.yaml:30-37`, `backend/config/settings.py:17-21,267` |
| SEC-05 | Medium | Cache UI có thể giữ dữ liệu sau khi quyền bị thu hồi | `frontend/src/misa-api-lists.ts:18-40,68-112` |
| SEC-06 | Medium | Access/refresh token lưu ở localStorage | `frontend/src/live-api.ts:92-94` |

## SEC-01 — Không thống nhất doanh nghiệp được xác thực

- **Nguyên nhân:** `SalesPermission` ưu tiên header `X-Company-ID`; `Sales.BaseViewSet.get_queryset()` chỉ dùng `company_id` ở query. Không thấy bước bắt hai giá trị khớp nhau ở hai lớp này.
- **Ảnh hưởng:** request có header A và query B có thể được cho qua theo quyền ở A rồi lấy chứng từ B. Mức Critical theo tác động tiềm năng; cần test HTTP người dùng chỉ thuộc A để xác nhận endpoint cụ thể.
- **Hướng sửa:** resolver doanh nghiệp duy nhất cho request, so khớp mọi nguồn header/query/body, áp cùng ID vào queryset và ghi dữ liệu. Test list/detail/export với A/B khác nhau.

## SEC-02 — Tạo bản ghi chéo doanh nghiệp

- **Nguyên nhân:** `HasIamPermission` và `PurchasePermission` lấy `company_id` query trước `company` body. `AccountMasterViewSet.perform_create()` và `PurchaseViewSet.perform_create()` lưu serializer theo body; `AccountClassSerializer`/`ChartOfAccountsSerializer` để ghi trường `company` (`backend/general_ledger/serializers.py:21-35`).
- **Ảnh hưởng:** người có quyền tạo ở A có thể thử gửi query A/body B để ghi danh mục hoặc chứng từ vào B. Chưa có test HTTP xác nhận toàn bộ validation và audit liên quan.
- **Hướng sửa:** sau khi xác thực, ràng buộc `company` của serializer với công ty đã xác thực; từ chối request nhiều ID không khớp. Test POST, PUT/PATCH, bulk/import và nested object chéo doanh nghiệp.

## SEC-03 — Kiểm quyền và lọc bản ghi dùng khác phạm vi

- **Nguyên nhân:** quyền nhận `branch_id=A` nhưng queryset cơ sở của AP, AR và Sales chỉ `.filter(company_id=...)`. Ví dụ `InvoiceViewSet` của AP và `QuotationViewSet` của Sales không lọc branch; AR đối chiếu và nhắc nợ dùng nhánh GET “có quyền ở bất kỳ chi nhánh nào” (`backend/accounts_receivable/permissions.py:25-26`).
- **Ảnh hưởng:** người được xem A có thể nhận bản ghi B cùng doanh nghiệp, kể cả khi tự gửi `branch_id=A`.
- **Hướng sửa:** tạo bộ lọc scope theo grant IAM áp tại queryset cho list, retrieve, export và action; kiểm tra cả ID đối tượng trước update. Test hai chi nhánh, hai người dùng, có và không có `branch_id`.

## SEC-04 — Mặc định triển khai không an toàn

- **Nguyên nhân:** compose xuất backend cổng 8080, dùng `DEBUG=True`, host `*`, CORS mọi origin, secret mặc định và mật khẩu PostgreSQL mặc định nếu không cung cấp biến môi trường. `settings.py` cũng có các fallback phục vụ phát triển. `manage.py check --deploy` cảnh báo secret ngắn và thiếu các cấu hình HTTPS/cookie an toàn; lệnh còn bị chặn vì lỗi OpenAPI.
- **Ảnh hưởng:** nếu dùng nguyên cấu hình này trên mạng không tin cậy, thông tin debug và khóa ký token có thể bị lộ/dự đoán; CORS và host mở rộng bề mặt truy cập. Đây là **rủi ro cấu hình triển khai**, không phải khẳng định môi trường production hiện dùng các giá trị này.
- **Hướng sửa:** tạo profile production riêng, bắt buộc secret/DB password đủ mạnh qua môi trường, tắt DEBUG, giới hạn host/origin, cấu hình HTTPS và cookie theo proxy thực tế. Chạy `check --deploy` trong cấu hình production sau khi sửa lỗi schema.

## SEC-05/06 — Dữ liệu và phiên đăng nhập phía trình duyệt

- **SEC-05:** `getInitialRows()` lấy cache theo công ty/người dùng; nếu lần revalidate bị 403 và cache đã có dữ liệu, catch không xóa cache. Người dùng có thể tiếp tục thấy bản ghi cũ sau khi quyền bị thu hồi. Xóa cache trên 401/403 và khi đổi vai trò/phạm vi; test quyền bị thu hồi khi tab vẫn mở. Đây là hiển thị dữ liệu đã tải, không phải backend trả dữ liệu mới ngoài quyền.
- **SEC-06:** access và refresh token được lưu trong `localStorage` để phục hồi phiên. Mã JavaScript chạy cùng origin có thể đọc chúng nếu xảy ra XSS. Đánh giá lựa chọn cookie HttpOnly/SameSite hoặc token ngắn hạn trong bộ nhớ, cùng CSP và rà XSS; thay đổi này cần thiết kế lại luồng refresh/logout, không sửa lẻ một dòng.

## Điều chưa xác nhận

Chưa chạy kiểm thử tấn công HTTP với hai doanh nghiệp/chi nhánh trên PostgreSQL và người dùng IAM thường. Chưa kiểm chứng tất cả endpoint của 19 ứng dụng; danh sách phạm vi đã/ chưa đọc nằm trong `AUDIT_REPORT.md`. Không suy rộng các lỗi trên cho mọi API nếu view riêng có kiểm tra scope bổ sung.
