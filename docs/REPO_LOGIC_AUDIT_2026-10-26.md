# Rà soát logic dự án — 26/10/2026

## Phạm vi và cách kiểm tra

Đối chiếu mã đang chạy trong `backend/` và `frontend/src/` với bảng use case MVP, các đặc tả chi tiết, kế hoạch kiểm thử Common Services và kịch bản ERP một năm trong `docs/`. Kiểm tra tĩnh không thay thế việc thực thi từng luồng trên cơ sở dữ liệu thử nghiệm. Các kết luận bên dưới chỉ khẳng định phần có bằng chứng cụ thể.

Repo công bố 16 phân hệ. Tổng trong 16 hàng của bảng tiến độ là **198 UC** (182 hoàn chỉnh, 12 giao diện cốt lõi, 4 chưa hoàn thiện), trong khi hàng tổng ghi **194 UC** (166, 23, 5). Cần sửa mốc phạm vi trước khi dùng tỷ lệ hoàn thành để nghiệm thu.

## Phát hiện cần sửa

### P0 — Kiểm tra quyền bán hàng và truy vấn dữ liệu có thể dùng hai doanh nghiệp khác nhau

- `backend/sales/permissions.py:34-41` ưu tiên `X-Company-ID` khi xác định doanh nghiệp để kiểm tra quyền, còn `backend/sales/views.py:19-23` lấy `company_id` trong query để lọc danh sách. Khi header là doanh nghiệp A và query là doanh nghiệp B, quyền được xét ở A nhưng queryset có thể trả dữ liệu B.
- Cần xác định đúng **một** doanh nghiệp cho cả kiểm tra quyền và truy vấn; từ chối request nếu header, query và body khai báo doanh nghiệp khác nhau. Thêm test người dùng chỉ thuộc A gọi danh sách báo giá/đơn bán của B. Đây là rủi ro truy cập chéo doanh nghiệp được suy ra trực tiếp từ hai nhánh mã, cần tái hiện bằng test HTTP trước khi triển khai bản sửa.

### P0 — Tạo danh mục tài khoản có thể kiểm tra quyền ở A rồi ghi vào B

- `backend/iam/permissions.py:225-230` lấy `company_id` trong query trước trường `company` ở body. `AccountMasterViewSet.perform_create()` (`backend/general_ledger/views.py:43-53`) lưu nguyên dữ liệu serializer, còn `AccountClassSerializer` và `ChartOfAccountsSerializer` cho ghi trường `company` (`backend/general_ledger/serializers.py:21-35`).
- Người có quyền tạo tài khoản ở doanh nghiệp A có thể gửi `?company_id=A` với body `company=B`; quyền được xét ở A, bản ghi được lưu ở B nếu body hợp lệ. Cần ràng buộc `company` khi lưu bằng doanh nghiệp đã xác thực, từ chối hai mã khác nhau và thêm test tạo chéo doanh nghiệp cho các danh mục GL.
- `PurchasePermission` cũng ưu tiên `company_id` trong query (`backend/purchases/permissions.py:18-22`), còn `PurchaseViewSet.perform_create()` lưu `company` từ serializer (`backend/purchases/views.py:49-51`). Rà và chặn cùng kiểu lệch ở yêu cầu/đơn mua hàng, thay vì chỉ sửa GL.

### P0 — Phạm vi chi nhánh chưa được áp dụng đồng nhất ở phải trả và bán hàng

- `backend/accounts_payable/permissions.py:32-36` và `backend/sales/permissions.py:64-80` có thể cấp quyền theo `branch_id` trong request. Nhưng `AccountsPayable.BaseViewSet.get_queryset()` (`backend/accounts_payable/views.py:22-28`) và `Sales.BaseViewSet.get_queryset()` (`backend/sales/views.py:19-27`) chỉ lọc theo doanh nghiệp; `InvoiceViewSet` (phải trả) và `QuotationViewSet` (bán hàng) không bổ sung bộ lọc chi nhánh.
- Với quyền chỉ ở chi nhánh A, request có `branch_id=A` có thể vượt qua kiểm tra quyền nhưng danh sách vẫn gồm chứng từ chi nhánh B. Cần lọc theo **phạm vi quyền thực tế**, không chỉ theo tham số người dùng gửi. Thêm bài kiểm tra hai chi nhánh cho list, detail và export.

### P0 — Danh sách công nợ phải thu có thể lộ dữ liệu ngoài chi nhánh được cấp

- `backend/accounts_receivable/permissions.py:25-26` cho phép các API GET của biên bản đối chiếu và thông báo nhắc nợ nếu người dùng có quyền ở **bất kỳ** chi nhánh nào, kể cả khi request không có `branch_id`.
- Hai view `CustomerDebtReconciliationViewSet` và `CustomerPaymentReminderViewSet` kế thừa `BaseViewSet.get_queryset()` (`backend/accounts_receivable/views.py:28-37`), chỉ lọc theo `company_id`, không lọc chi nhánh theo phạm vi quyền, kể cả khi request có `branch_id`. Vì vậy tài khoản có quyền xem ở một chi nhánh có thể nhận danh sách chứng từ của các chi nhánh khác trong cùng doanh nghiệp. Điều này trái với yêu cầu phạm vi dữ liệu trong `docs/UC-AR-07-backend.md` và `docs/UC-AR-09-backend.md`.
- Cần lọc queryset theo các chi nhánh được cấp quyền cho từng action, đồng thời bổ sung test hai chi nhánh và một người dùng chỉ được cấp một chi nhánh. Kiểm tra cả xuất file và API chi tiết có cùng điều kiện.

### P0 — Chuyển doanh nghiệp luôn bị API từ chối và lỗi bị bỏ qua

- `frontend/src/LiveCompanySelect.tsx:56-80` cập nhật doanh nghiệp tại máy người dùng trước, gửi `{company_id: ...}` tới `/api/v1/common/companies/switch/` mà không chờ kết quả, rồi bỏ qua mọi lỗi. Đường vào quản trị doanh nghiệp còn không gửi yêu cầu chuyển phạm vi.
- `backend/common_services/serializers.py:591-595` bắt buộc trường `company`. Kiểm tra trực tiếp serializer với payload giao diện cho kết quả `is_valid=False`, thiếu `company`.
- Trái với UC-COM-08, nhất là COM08-02 và COM08-09 trong `docs/COMMON_SERVICES_TEST_PLAN.md`. Cần gửi đúng payload, chỉ cập nhật trạng thái giao diện và điều hướng sau khi API thành công; hiển thị lỗi 403/400.

### P0 — Một lần nhập sai OTP đăng ký có thể bị tính thành hai lần

- `frontend/src/LiveAccount.tsx:43-51` gọi `/verify-registration/`, rồi gọi `/verify-email/` trên **mọi lỗi**.
- Hai URL đều trỏ tới `VerifyRegistrationView` (`backend/common_services/urls.py:66-67`); `backend/common_services/services.py:127-168` tăng `attempts` khi mã sai và vô hiệu hóa sau 5 lần.
- Cần chỉ dùng một endpoint; không thử URL dự phòng khi API trả lỗi xác thực. `LivePasswordReset.tsx:60-71` có cùng kiểu gọi lại endpoint tương đương khi đặt lại mật khẩu lỗi.

### P0 — Hủy ghi sổ công nợ phải thu bị quy tắc sổ cái chặn

- Test `accounts_receivable.test_allocation_voucher.AllocationVoucherTests.test_fx_journal_and_unpost_reversal` thất bại: POST `unpost/` trả 400, mã `SUBLEDGER_SOURCE_LOCKED`, thay vì 200.
- `backend/accounts_receivable/allocation_voucher.py:403-414` gọi đảo bút toán GL nhưng không gửi `from_source_module=True`; `backend/general_ledger/services.py:1536-1552` yêu cầu cờ này cho bút toán từ AR. Cần rà các luồng đảo bút toán tương tự trong AR và các phân hệ nguồn, rồi kiểm tra hoàn tác số dư và trạng thái theo giao dịch.
- Bộ test đầy đủ có thêm một trường hợp tương tự ở chuyển tiền ngân hàng: GL từ chối đảo bút toán nguồn `BANK` với cùng mã `SUBLEDGER_SOURCE_LOCKED`.

### P0 — Phiên bản chứng từ nguồn bị chuyển nhầm sang bút toán sổ cái

- Trong bộ test đầy đủ, **24 bài** thất bại với `CONCURRENT_MODIFICATION`, đều thuộc bộ test mua hàng. Bút toán GL vừa tạo có `version=1`, nhưng yêu cầu ghi sổ mang `version=2` của chứng từ nguồn; GL từ chối ghi sổ vì so sánh hai phiên bản thuộc hai đối tượng khác nhau.
- Ví dụ `backend/purchases/goods_services.py:242-269` tạo `JournalEntry` rồi gọi `post_journal(journal, request)`; `backend/general_ledger/services.py:344-369` lấy `version` từ chính request đó để đối chiếu với `entry.version`. Cần tạo request nội bộ chỉ mang dữ liệu phù hợp với GL, hoặc truyền phiên bản của journal, không dùng nguyên body của chứng từ mua/bán.

### P1 — Mẫu tài khoản “Tối thiểu” tạo bộ đầy đủ

- `frontend/src/LiveAccounts.tsx:25` gửi `scope=MINIMAL`; đặc tả UC-MD-09 và `backend/general_ledger/account_templates.py:630-642` dùng `ESSENTIAL`.
- Kiểm tra trực tiếp hàm mẫu TT99: `FULL=135`, `ESSENTIAL=87`, `MINIMAL=135`. Cần thống nhất giá trị gửi và từ chối giá trị phạm vi/chế độ kế toán không hợp lệ thay vì ngầm dùng bộ đầy đủ hoặc TT99.
- `backend/general_ledger/account_services.py:222-239` chỉ cập nhật `template_version` nếu đã có hệ thống mặc định; cần kiểm tra việc chọn mẫu chế độ khác có khiến `accounting_regime` và nội dung tài khoản không khớp.

### P1 — Một số luồng cấp số chứng từ tài sản không được xác thực

- `frontend/src/MisaAssetsWorkspace.tsx:914-925`, `:1330-1341`, `:1832-1843` gọi trực tiếp API bằng `fetch` với cookie nhưng không có Bearer token; cấu hình API mặc định yêu cầu xác thực (`backend/config/settings.py:177-185`). Gọi thử `next-transfer-number` không có token nhận HTTP 401.
- Lỗi bị bỏ qua và màn hình giữ số mặc định. Cần dùng hàm `request` thống nhất và hiện lỗi khi không lấy được số mới.

### P1 — Cổng kiểm tra thay đổi chưa đạt

- `npx tsc -b --pretty false` ghi nhận **501 lỗi**; 317 lỗi biến không dùng, 73 lỗi thuộc tính không tồn tại và 57 lỗi tên không tồn tại. `npx vite build` vẫn tạo bundle, nhưng `npm run build` (chạy TypeScript trước Vite) không hoàn tất.
- `python manage.py makemigrations --check --dry-run` thất bại vì model `AccountingPolicy.accounting_regime` cần migration mới trong `common_services`.
- `python manage.py check` qua với 2 cảnh báo SQLite về `UniqueConstraint.nulls_distinct`.

### P1 — Sinh tài liệu API bị lỗi vì tên action `schema`

- Hai test OpenAPI thất bại với `Incompatible AutoSchema used on View AssetReportViewSet`. `backend/reporting/views.py:1754` định nghĩa action tên `schema`, trùng thuộc tính `schema` mà DRF/drf-spectacular dùng để sinh OpenAPI; các view báo cáo khác cũng đặt tên tương tự. Cần đổi tên method nội bộ nhưng giữ nguyên đường URL `/schema/`, rồi chạy lại bài kiểm tra tài liệu API.

### P1 — Những luồng nghiệp vụ còn thất bại độc lập

- Bài kiểm tra gộp khách hàng dừng **ngay lúc tạo dữ liệu mẫu**: fixture tạo hai `Party` cùng `tax_code` trong một doanh nghiệp, vi phạm ràng buộc duy nhất của cơ sở dữ liệu. Chưa thể kết luận nghiệp vụ gộp sai; cần sửa dữ liệu thử hợp lệ hoặc nêu rõ yêu cầu cho phép gộp mã số thuế trùng.
- Một bài kiểm tra xóa khách hàng không chạy tới nghiệp vụ vì fixture tạo `SalesOrder` bằng các trường `order_number`, `order_date` không còn trong model. Cần sửa fixture theo model hiện hành rồi kiểm tra lại quy tắc không cho xóa khách hàng đã có giao dịch.
- Ba bài phân bổ giá thành bị GL từ chối với `MISSING_ORIGINAL_ENTRY`: bút toán điều chỉnh/đảo chưa liên kết bút toán gốc theo yêu cầu GL.
- Hai bài tính và ghi sổ lương bị từ chối vì hạch toán vào tài khoản tổng hợp `334` đang có tài khoản con hoạt động. Cần chọn tài khoản chi tiết hợp lệ theo bộ tài khoản hiện hành hoặc sửa quy tắc mẫu nếu đặc tả cho phép ghi vào `334`.
- Các bài còn lại gồm trạng thái công nợ phải trả thành `OVERDUE` thay vì `PARTIALLY_PAID`, quyền kho trả 403 cho trường hợp được cấp, hợp đồng trả `IN_PROGRESS` thay vì `APPROVED`, cùng một số sai khác trong công nợ và danh mục. Mỗi trường hợp cần đối chiếu lại test với đặc tả trước khi sửa nghiệp vụ.

## Khoảng trống trong bằng chứng nghiệm thu

- Số hàm kiểm thử theo mã nguồn chênh lệch mạnh giữa các phân hệ: bán hàng 187, mua hàng 157, phải thu 147, phải trả 113; kho 20, ngân hàng 21, tiền mặt 5, giá thành 3, tiền lương 5. Đây chỉ là số bài kiểm tra, **không phải tỷ lệ bao phủ**. Cần đối chiếu từng quy tắc nghiệp vụ và trường hợp lỗi của các phân hệ ít bài kiểm tra trước khi xác nhận hoàn tất.
- `docs/ERP_ONE_YEAR_SIMULATION.md:660-678` đặt chỉ tiêu nghiệm thu xuyên phân hệ (Nợ = Có, tiền ngân hàng 4.100, lợi nhuận 720, tổng tài sản = tổng nguồn vốn 6.160...), nhưng chính tài liệu ghi kịch bản 12 tháng chưa được thực thi thành một integration test. `backend/reporting/tests_tt99_flow.py` có 11 phép kiểm tra TT99 từ tài liệu ABC, chưa đối chiếu toàn bộ các chỉ tiêu của kịch bản một năm.
- Báo cáo kết nối API–giao diện ngày 15/10/2026 (`docs/API_FE_CONNECTION_AUDIT.md`) đã cũ: tài liệu nói không có lời gọi `/api/v1/reports/` từ frontend, trong khi `frontend/src/misa-api-writes.ts` hiện có nhiều lời gọi dưới tiền tố này. Không dùng con số thiếu kết nối trong báo cáo cũ để kết luận trạng thái hôm nay.
- Bảng use case ghi đăng ký nằm ở `/login` chế độ register, nhưng route hiện hành ở `/account` (`frontend/src/ReferenceWorkspace.tsx`). Tài liệu UC-MD-09 chỉ mô tả TT200/TT133, trong khi cả giao diện và backend đã hỗ trợ TT99. Cần xác định tài liệu chuẩn cho từng UC rồi cập nhật bản tổng hợp.

## Tình trạng kiểm thử

- Django chạy **1.332 test trong 1.452 giây: 49 thất bại, 2 lỗi**. Trong 51 trường hợp này, 24 có cùng mã `CONCURRENT_MODIFICATION` ở GL; 2 bị `SUBLEDGER_SOURCE_LOCKED`; 3 bị `MISSING_ORIGINAL_ENTRY`; 2 lỗi sinh OpenAPI. Các lỗi còn lại trải ở công nợ, ngân hàng, kho, danh mục, tiền lương và quy trình duyệt. [Danh sách đầy đủ 51 bài chưa đạt](REPO_LOGIC_AUDIT_FAILED_TESTS_2026-10-26.md) lưu tên từng bài và nhóm thông báo lỗi. Không được cộng những bài test này thành 51 nguyên nhân độc lập.
- Bản Vite build thành công; smoke test bản build với `/login` và `/account` không có lỗi JavaScript. Kết quả này chỉ xác nhận hai trang đó, không xác nhận nghiệp vụ của toàn bộ 16 phân hệ.

## Thứ tự xử lý đề xuất

1. Sửa các lỗi P0; ưu tiên chặn truy cập chéo doanh nghiệp/chi nhánh và khôi phục việc ghi sổ liên phân hệ, rồi kiểm tra tích hợp cho đăng ký OTP, đổi doanh nghiệp và hủy ghi sổ AR–GL.
2. Sửa hợp đồng giá trị UC-MD-09 và xác thực các request cấp số chứng từ tài sản.
3. Chốt một danh mục UC chuẩn, sửa số liệu và tài liệu cũ, thêm test nghiệm thu 12 tháng.
4. Đưa migration và TypeScript build về trạng thái sạch, rồi chạy lại bộ test backend và các luồng giao diện trên cơ sở dữ liệu thử nghiệm.
