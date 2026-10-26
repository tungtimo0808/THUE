# Chất lượng mã và kiến trúc — 26/10/2026

Các nhận xét dưới đây ưu tiên chỗ làm tăng xác suất lỗi nghiệp vụ, chậm trang hoặc khó sửa đồng bộ. Kích thước file hay số cảnh báo **không tự nó chứng minh** chức năng sai.

| ID | Mức | Phát hiện | Bằng chứng |
|---|---|---|---|
| CC-01 | High | Ranh giới UI/API/service không thống nhất ở các thao tác chứng từ | `frontend/src/MisaAssetsWorkspace.tsx:914-925`, `frontend/src/live-api.ts:119-155`, `backend/purchases/goods_services.py:242-269` |
| CC-02 | High | Module và hàm quá lớn, nhiều trách nhiệm | `backend/general_ledger/services.py:9853`, `backend/fixed_assets/services.py:4267`, `frontend/src/MisaLedgerWorkspace.tsx` |
| CC-03 | Medium | Lặp resolver quyền/công ty và lọc queryset | `backend/general_ledger/views.py:389,651,729`, `backend/accounts_receivable/views.py:393,485,603,718` |
| CC-04 | Medium | Frontend tải quá nhiều danh sách và trang dữ liệu | `frontend/src/misa-api-lists.ts:68-112` |
| CC-05 | Medium | Cổng build/lint còn nợ lớn | `frontend/package.json:8-11`, log `tsc` và oxlint |
| CC-06 | Medium | Tài liệu kiến trúc và số UC không còn đồng bộ | `README.md`, `docs/danh_sach_use_case_mvp_da_lam.md` |

## CC-01 — Ranh giới tác vụ và hợp đồng API

- **Nguyên nhân:** `live-api.ts` có client thống nhất cho JWT, làm mới token, lỗi; một số màn hình vẫn dùng `fetch` trực tiếp và tự bỏ lỗi. Ở backend, service mua hàng truyền nguyên request nguồn vào GL nên `version` của hai loại chứng từ bị trộn (BL-01).
- **Ảnh hưởng:** một thay đổi ở auth/concurrency phải sửa nhiều nơi; lỗi 401, retry và phiên bản bị diễn giải khác nhau giữa phân hệ.
- **Hướng sửa:** một lớp HTTP client dùng chung; cổng gọi GL nhận dữ liệu nội bộ có kiểu và chỉ các trường GL cần; service nghiệp vụ quản lý transaction. Không thêm abstraction chung cho mọi use case khi hợp đồng thật sự khác nhau (YAGNI).

## CC-02 — Hàm và file quá lớn

- **Bằng chứng quét AST:** 189 hàm Python ngoài test/migration dài từ 150 dòng. `run_gl_subledger_reconciliation` dài 1.236 dòng (`backend/general_ledger/services.py:9853`), `_populate_note_item_tables` 1.097 dòng (`backend/reporting/financial_notes_services.py:1986`), `revaluate_fixed_assets_uc06` 1.053 dòng (`backend/fixed_assets/services.py:4267`). `backend/fixed_assets/services.py` có 23.526 dòng; `general_ledger/services.py` có 22.534 dòng. Frontend có `MisaLedgerWorkspace.tsx` 20.430 dòng, `MisaCostWorkspace.tsx` 16.916 dòng, `MisaAssetsWorkspace.tsx` 15.441 dòng, `misa-report-definitions.ts` 32.550 dòng.
- **Ảnh hưởng:** review transaction, trạng thái, quyền và rollback theo một UC khó; thay đổi nhỏ dễ tác động luồng khác và tăng thời gian biên dịch/tải trang.
- **Hướng sửa:** tách theo use case có ranh giới dữ liệu và test rõ; ưu tiên các hàm có test thất bại. Giữ API công khai ổn định và chuyển từng nhánh với test đối chiếu, tránh tái cấu trúc hàng loạt.

## CC-03 — Trùng logic có thể làm các phân hệ lệch nhau

- Quét AST tìm thấy `_resolve_company` giống hệt **9 lần** trong `backend/general_ledger/views.py`; `get_queryset` giống hệt **4 lần** trong các view chứng từ AR; `_to_json_safe` giống hệt **4 lần** ở các service báo cáo tiền, kho, nợ và tài sản. Có bản sao `get_user_account_by_identifier` giữa `backend/accounts_payable/payment_request_services.py:27` và `payment_voucher_services.py:28`.
- **Ảnh hưởng:** khi sửa quyền/scope hoặc xử lý dữ liệu, dễ sửa một bản và sót bản khác. Lỗi SEC-03 cho thấy rủi ro này đã chạm vào kết quả truy vấn.
- **Hướng sửa:** gom resolver company và scope vào hàm có test nhiều doanh nghiệp/chi nhánh; gom helper thuần như JSON conversion. Không gom workflow khác nhau chỉ vì cú pháp gần giống (KISS).

## CC-04 — Tải dữ liệu quá rộng ở frontend

- `useMisaApiLists` chạy tất cả resource truyền vào cùng lúc, mỗi resource có thể đi tối đa 50 trang × 100 bản ghi, rồi giữ toàn bộ trong bộ nhớ. `timestamp` của cache được ghi nhưng chưa thấy dùng để giới hạn tuổi ở `getInitialRows`.
- **Ảnh hưởng:** mở một màn hình có nhiều nguồn dữ liệu có thể phát sinh nhiều request và giữ tập dữ liệu lớn; dữ liệu cũ còn tồn tại khi quyền thay đổi (SEC-05).
- **Hướng sửa:** tải theo tab đang mở, phân trang server cho bảng lớn, cache có TTL/phiên bản quyền, hủy request khi đổi màn hình. Đo số request và thời gian tải trước/sau trên cùng dữ liệu.

## CC-05 — Cổng kiểm tra chất lượng chưa sạch

- `npx tsc -b --pretty false`: **501 diagnostics**. `npm run lint` hoàn tất nhưng xuất **597 cảnh báo**, gồm biến không dùng, dependency hook thiếu và setState trong effect. `npm run build` chạy TypeScript trước Vite nên không hoàn tất dù Vite riêng có thể tạo bundle.
- **Ảnh hưởng:** khó phân biệt lỗi mới với nợ cũ; một số lỗi kiểu liên quan thuộc tính/tên không tồn tại có thể thành lỗi runtime ở nhánh chưa mở.
- **Hướng sửa:** sửa trước các lỗi TS2304/TS2339 tại luồng đang dùng, sau đó dọn unused và cảnh báo hook theo module. CI phải chặn lỗi mới; không hạ cấu hình TypeScript để làm xanh giả.

## CC-06 — Tài liệu và mã không cùng mốc

- README còn mô tả thư mục `FRONTEND/`, đường dẫn `D:\THUẾ\FRONTEND` và quyền `is_staff` trước khi IAM triển khai, trong khi repo hiện là `frontend/` và có IAM.
- Bảng 16 phân hệ ở `docs/danh_sach_use_case_mvp_da_lam.md` cộng thành **198 UC** (182/12/4) nhưng dòng tổng ghi **194 UC** (166/23/5). Báo cáo API–FE ngày 15/10 nói chưa có report API từ UI, trong khi `misa-api-writes.ts` đã gọi `/api/v1/reports/`.
- **Ảnh hưởng:** người triển khai, kiểm thử và nghiệm thu dùng sai danh mục phạm vi; khó quyết định một luồng đã hoàn tất theo yêu cầu nào.
- **Hướng sửa:** chốt một danh mục UC chuẩn có owner/ngày cập nhật; tự sinh bảng tiến độ và endpoint từ nguồn cấu trúc khi có thể.

## Dead code và nợ chưa xác nhận

TypeScript báo nhiều biến không dùng, nhưng tôi **không gắn nhãn “dead code” cho toàn bộ hàm/module** khi chưa kiểm tra import động, route và tích hợp bên ngoài. Việc xóa cần bắt đầu từ các symbol không tham chiếu có bằng chứng và chạy lại luồng tương ứng.
