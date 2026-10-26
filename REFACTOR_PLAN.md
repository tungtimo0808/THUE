# Kế hoạch xử lý sau audit — 26/10/2026

Kế hoạch này là đề xuất, **chưa sửa mã ứng dụng**. Ưu tiên lỗi nghiệp vụ và phân quyền trước khi tách file hoặc dọn formatting. Mỗi nhóm sửa cần một PR nhỏ, test thất bại trước khi sửa và kiểm tra lại luồng liên phân hệ sau khi sửa.

## Thứ tự ưu tiên

| Thứ tự | Mức | Việc làm | Điều kiện hoàn tất |
|---:|---|---|---|
| 1 | Critical | Khóa truy cập chéo doanh nghiệp SEC-01/02 | Test HTTP người chỉ thuộc A không list/create/update dữ liệu B qua mọi tổ hợp header/query/body; quyền hợp lệ A vẫn chạy |
| 2 | High | Lọc scope chi nhánh SEC-03 | AP, AR, Sales list/detail/export/action chỉ trả bản ghi thuộc grant; test hai chi nhánh và không truyền filter |
| 3 | High | Sửa hợp đồng ghi sổ BL-01/02/03 | 24 test `CONCURRENT_MODIFICATION`, 2 `SUBLEDGER_SOURCE_LOCKED`, 3 `MISSING_ORIGINAL_ENTRY` qua; tổng Nợ=Có và rollback đúng |
| 4 | High | Sửa đổi doanh nghiệp BL-04, OTP BL-05 | UI chờ API switch, sai quyền không điều hướng; một OTP sai tăng đúng một lần |
| 5 | High khi triển khai | Tách cấu hình production SEC-04 | `check --deploy` không còn cảnh báo bảo mật phù hợp môi trường; secret, host, CORS, HTTPS được cấu hình ngoài repo |
| 6 | Medium | Sửa BL-06/07/08/09/10/11 và cache SEC-05 | Mẫu tài khoản đúng phạm vi, cấp số có JWT, số hóa đơn không trùng khi đồng thời, lương post, schema/migration sạch |
| 7 | Medium | Nâng cổng chất lượng và cấu trúc CC-01..06 | `npm run build`, lint có baseline rõ; dịch vụ và UI tách theo UC không đổi hành vi |
| 8 | Medium | Nghiệm thu toàn bộ danh mục UC | Chốt tổng UC chuẩn, test 12 tháng đạt chỉ tiêu, ma trận UC ↔ test có bằng chứng |

## Bước triển khai cụ thể

### 1. Dựng bộ test bảo mật làm cổng

- Tạo hai công ty A/B, mỗi công ty hai chi nhánh, người dùng thường chỉ được cấp một phạm vi. Dùng request thật qua DRF test client, không dùng superuser/`force_authenticate` để bỏ qua IAM ngoài phần xác thực.
- Với mỗi endpoint liên quan: thử header A/query B, query A/body B, chi nhánh A nhưng object B, không gửi branch, và export. Ghi rõ response mong đợi 403/404/400 và xác nhận DB không thay đổi.
- Chỉ sau khi test tái hiện mới chuẩn hóa resolver công ty và bộ lọc queryset. Nếu validation khác chặn sẵn một endpoint, cập nhật báo cáo thay vì sửa dư.

### 2. Ổn định hợp đồng GL với phân hệ nguồn

- Định nghĩa input nội bộ của `post`, `unpost`, `reverse` gồm actor, source module, journal version, idempotency key; không dùng nguyên `request.data` của chứng từ nguồn.
- Sửa lần lượt mua hàng, phải thu/ngân hàng, giá thành; chạy test ở module nguồn và GL. Bắt buộc transaction bao ghi sổ, kho, công nợ và audit liên quan.
- Test sai phiên bản GL thật vẫn phải trả conflict; rollback không để journal dở, tồn kho/công nợ lệch.

### 3. Sửa các hợp đồng frontend–backend

- `LiveCompanySelect`: gửi `company`, chờ switch thành công rồi đổi state/route; hiển thị lỗi.
- OTP đăng ký/đặt lại mật khẩu: bỏ retry trên mọi lỗi; backend trả lỗi phân biệt rõ sai mã, mã hết hạn và lỗi mạng.
- Tài sản: dùng client JWT thống nhất cho mọi `next-number`; từ chối lưu khi chưa có số hợp lệ.
- Tài khoản: enum FULL/ESSENTIAL thống nhất, backend từ chối scope/regime lạ; kiểm tra dữ liệu hiện có trước khi đổi chế độ.

### 4. Đồng bộ dữ liệu và kiểm tra triển khai

- Tạo migration còn thiếu cho `AccountingPolicy`, chạy thử trên SQLite test và PostgreSQL staging với dữ liệu sẵn.
- Đổi method action `schema` ở reporting, giữ URL tương thích; chạy lại sinh OpenAPI, sau đó `manage.py check --deploy` ở cấu hình production.
- Tách compose phát triển khỏi cấu hình triển khai; không dùng DEBUG/secret/password mặc định trên mạng thật.

### 5. Dọn kiến trúc theo lát cắt nhỏ

- Bắt đầu ở `general_ledger/services.py`, `fixed_assets/services.py` và `misa-api-writes.ts`: tách một use case tại một thời điểm sau khi có test hành vi. Tách pure calculation, validation, transaction orchestration và adapter I/O.
- Gom resolver company/scope, helper JSON lặp lại, nhưng giữ service đặc thù từng nghiệp vụ. Đo độ dài hàm và thời gian review/test sau mỗi PR; không coi việc chia file là mục tiêu tự thân.
- Frontend: tải dữ liệu theo tab, server pagination, cache có TTL và invalidation khi đổi quyền/công ty; đo request và thời gian tải trên bộ dữ liệu cố định.

### 6. Nghiệm thu theo yêu cầu repo

- Chốt một danh mục UC chuẩn, giải quyết lệch tổng 194/198 và trạng thái hoàn thành. Với mỗi UC ghi route UI, API, service, bảng dữ liệu, test luồng chính, test lỗi, quyền và rollback.
- Thêm integration test 12 tháng theo `docs/ERP_ONE_YEAR_SIMULATION.md`: Nợ=Có, đối chiếu ngân hàng/công nợ/kho/tài sản, VAT/CIT, lợi nhuận 720 và tổng tài sản/nguồn vốn 6.160. Chạy trên PostgreSQL vì SQLite không kiểm chứng đầy đủ lock/ràng buộc production.
- Chỉ công bố module hoàn thành khi các gate này qua. Bài test hiện có nhiều nhưng vẫn để trống các ca nhiều công ty/chi nhánh và race.

## Kiểm tra sau mỗi nhóm sửa

`python manage.py test` phải về 0 FAIL/ERROR; `python manage.py makemigrations --check --dry-run` sạch; `python manage.py check --deploy` chạy trong cấu hình production; `npm run build` và lint đạt ngưỡng đã chốt. Chạy lại các test HTTP nhiều scope và luồng UI tương ứng, rồi kiểm tra số dư và audit trail trên DB test.
