# Lỗi logic nghiệp vụ — audit 26/10/2026

Mức độ: **Critical** có nguy cơ sai/lộ dữ liệu xuyên doanh nghiệp; **High** chặn luồng chính hoặc làm sai sổ; **Medium** sai một nhánh nghiệp vụ hoặc thiếu chặn lỗi; **Low** nợ kiểm thử/tài liệu. Trạng thái **xác nhận** là đã có kết quả thực thi; **suy ra từ mã** cần bài kiểm tra HTTP hoặc chạy đồng thời để khẳng định tác động trong môi trường thật.

| ID | Mức | Phân hệ | Trạng thái | Vấn đề |
|---|---|---|---|---|
| BL-01 | High | Mua hàng → sổ cái | Xác nhận bằng 24 test | Phiên bản chứng từ mua bị dùng làm phiên bản bút toán GL |
| BL-02 | High | Phải thu/ngân hàng → sổ cái | Xác nhận bằng 2 test | Hủy/đảo bút toán nguồn bị khóa |
| BL-03 | High | Giá thành → sổ cái | Xác nhận bằng 3 test | Bút toán điều chỉnh/đảo thiếu liên kết gốc |
| BL-04 | High | Chọn doanh nghiệp | Xác nhận payload bằng serializer | UI gửi sai tên trường rồi bỏ qua lỗi |
| BL-05 | Medium | Đăng ký | Xác nhận đường gọi và alias | Một mã OTP sai có thể bị tính hai lần |
| BL-06 | Medium | Danh mục tài khoản | Xác nhận trực tiếp hàm mẫu | Mẫu “Tối thiểu” tạo bộ tài khoản đầy đủ |
| BL-07 | Medium | Tài sản cố định | Xác nhận HTTP 401 | Ba yêu cầu cấp số không mang JWT |
| BL-08 | Medium | Bán hàng | Suy ra từ mã | Số đề nghị hóa đơn có thể trùng khi tạo đồng thời |
| BL-09 | Medium | Tiền lương | Xác nhận bằng 2 test | Ghi sổ bị chặn vì dùng tài khoản tổng hợp 334 |
| BL-10 | Medium | Báo cáo/OpenAPI | Xác nhận bằng 2 test và check --deploy | Action `schema` che thuộc tính schema của DRF |
| BL-11 | Medium | Schema dữ liệu | Xác nhận bằng lệnh migration | Thay đổi `AccountingPolicy.accounting_regime` chưa có migration |
| BL-12 | Low | Danh mục khách hàng | Xác nhận bằng 2 test lỗi | Fixture gộp/xóa khách hàng không tới bước nghiệp vụ |

## BL-01 — Phiên bản chứng từ nguồn đi nhầm vào GL

- **Vị trí:** `backend/purchases/goods_services.py:242-269`, `backend/general_ledger/services.py:344-369`; các nhánh mua dịch vụ, giảm giá, trả hàng cũng gọi `post_journal(journal, request)`.
- **Nguyên nhân:** `JournalEntry` mới có `version=1`, trong khi request gốc có `version=2` của chứng từ mua. GL so sánh hai phiên bản thuộc hai đối tượng khác nhau.
- **Ảnh hưởng:** 24/51 bài chưa đạt trả `CONCURRENT_MODIFICATION`; ghi sổ mua hàng và các tác động kho/công nợ sau đó bị chặn.
- **Hướng sửa:** tạo request nội bộ chỉ chứa cờ và phiên bản của journal; không chuyển nguyên body nguồn vào GL. Giữ transaction bao cả bước tạo journal, kho và công nợ. **Test:** mua hàng đã duyệt `version=2` ghi sổ thành công; request GL thực sự cũ vẫn bị từ chối; lỗi GL phải rollback toàn bộ.

## BL-02 — Phân hệ nguồn không đảo được bút toán

- **Vị trí:** `backend/accounts_receivable/allocation_voucher.py:403-414`, `backend/general_ledger/services.py:1536-1552`; bộ test ngân hàng có cùng mã `SUBLEDGER_SOURCE_LOCKED`.
- **Nguyên nhân:** đường hủy/đảo gọi GL như người dùng thao tác trực tiếp, không truyền ngữ cảnh `from_source_module=True` mà GL yêu cầu.
- **Ảnh hưởng:** hủy ghi sổ phiếu phân bổ phải thu và chuyển tiền ngân hàng trả 400; số dư/trạng thái không được hoàn tác.
- **Hướng sửa:** chuẩn hóa cổng gọi đảo sổ từ từng phân hệ, chỉ chấp nhận cờ nội bộ khi quyền nguồn đã xác thực. **Test:** hủy và ghi lại, số dư trước/sau, thử đảo trực tiếp trái quyền.

## BL-03 — Giá thành thiếu bút toán gốc

- **Vị trí:** `backend/costing/services.py:182`, `backend/general_ledger/services.py` (kiểm tra `MISSING_ORIGINAL_ENTRY`).
- **Nguyên nhân:** ba test giá thành tạo bút toán có tính chất điều chỉnh/đảo nhưng không mang liên kết bút toán gốc theo hợp đồng GL.
- **Ảnh hưởng:** phân bổ và tính giá thành không ghi sổ được.
- **Hướng sửa:** xác định loại journal thực tế và gắn `original_entry` khi là điều chỉnh/đảo; không nới quy tắc GL chung. **Test:** FIFO/định kỳ và rollback khi thiếu tài khoản.

## BL-04 — Chuyển doanh nghiệp không hoàn tất ở backend

- **Vị trí:** `frontend/src/LiveCompanySelect.tsx:56-80`, `backend/common_services/serializers.py:591-595`, `backend/common_services/views.py:367-417`.
- **Nguyên nhân:** UI gửi `{company_id}` nhưng serializer yêu cầu `company`; request chạy nền và lỗi bị nuốt, đường vào quản trị còn không gọi API switch.
- **Ảnh hưởng:** UI cho thấy doanh nghiệp mới dù backend từ chối chuyển ngữ cảnh/quyền; trái UC-COM-08.
- **Hướng sửa:** gửi `company`, chờ kết quả thành công trước khi cập nhật local state/điều hướng, xử lý 400/403. **Test:** đổi hợp lệ, không có quyền, hết phiên, vào trang quản trị.

## BL-05 — Một lần nhập sai OTP có thể tiêu hai lượt

- **Vị trí:** `frontend/src/LiveAccount.tsx:43-51`, `frontend/src/LivePasswordReset.tsx:60-71`, `backend/common_services/urls.py:66-67`, `backend/common_services/services.py:127-168`.
- **Nguyên nhân:** UI gọi URL dự phòng trên mọi lỗi; hai URL xác nhận đăng ký trỏ cùng view và sai mã làm tăng `attempts`.
- **Ảnh hưởng:** tài khoản có thể bị khóa thử mã sớm hơn chính sách 5 lượt.
- **Hướng sửa:** một endpoint chuẩn; chỉ retry lỗi mạng có idempotency rõ ràng. **Test:** một lần nhập sai tăng đúng một attempt.

## BL-06 — Phạm vi mẫu tài khoản sai hợp đồng

- **Vị trí:** `frontend/src/LiveAccounts.tsx:25`, `backend/general_ledger/account_templates.py:630-642`, `backend/general_ledger/account_services.py:222-239`.
- **Nguyên nhân:** UI gửi `MINIMAL`, backend chỉ nhận `ESSENTIAL`; giá trị khác mặc định thành FULL. Thử hàm TT99: FULL 135 tài khoản, ESSENTIAL 87, MINIMAL cũng 135.
- **Ảnh hưởng:** người chọn bộ tối thiểu nhận bộ đầy đủ; chế độ kế toán không hợp lệ còn có thể ngầm thành TT99.
- **Hướng sửa:** thống nhất enum, backend từ chối giá trị lạ, đồng bộ `accounting_regime` với template đã áp dụng. **Test:** đủ ba chế độ và phạm vi; input sai trả 400.

## BL-07 — Cấp số chứng từ tài sản trả 401

- **Vị trí:** `frontend/src/MisaAssetsWorkspace.tsx:914-925`, `:1330-1341`, `:1832-1843`; `backend/config/settings.py:177-185`.
- **Nguyên nhân:** `fetch` trực tiếp chỉ gửi cookie, không có Bearer token trong khi API mặc định yêu cầu đăng nhập.
- **Ảnh hưởng:** số chuyển/giảm/kiểm kê không được lấy; UI âm thầm dùng giá trị dự phòng. Gọi không token đến `next-transfer-number` đã nhận HTTP 401.
- **Hướng sửa:** dùng client `request` thống nhất, hiện lỗi; kiểm tra số thực khi lưu để tránh trùng.

## BL-08 — Cấp số đề nghị hóa đơn có nguy cơ race

- **Vị trí:** `backend/sales/order_services.py:840-852`, `backend/sales/models.py:434`.
- **Nguyên nhân:** transaction chỉ khóa từng `SalesOrder`; số mới dùng `InvoiceRequest.objects.filter(company=...).count()+1`. Hai đơn khác nhau cùng doanh nghiệp có thể đọc cùng count trước khi insert.
- **Ảnh hưởng:** một request bị lỗi unique constraint, người dùng không tạo được đề nghị hóa đơn. Đây là suy luận concurrency, chưa chạy test PostgreSQL đồng thời.
- **Hướng sửa:** counter theo doanh nghiệp/năm có khóa hàng hoặc sequence nguyên tử; bắt lỗi va chạm và retry có giới hạn. **Test:** hai transaction tạo từ hai đơn khác nhau cùng lúc.

## BL-09 — Tài khoản lương không ghi sổ được

- **Vị trí:** `backend/payroll/services.py:171` và quy tắc tài khoản postable của GL; test `test_department_rule_groups_salary_posting`, `test_full_month_salary_is_calculated_and_posted`.
- **Nguyên nhân/ảnh hưởng:** hai test trả 400 vì tài khoản `334` là tài khoản tổng hợp đang có tài khoản con hoạt động; bảng lương không post được.
- **Hướng sửa:** xác định theo chế độ kế toán tài khoản chi tiết cần dùng, sửa cấu hình mapping của payroll; giữ chặn hạch toán vào tài khoản tổng hợp nếu đặc tả yêu cầu.

## BL-10 đến BL-12 — Cổng kiểm tra và fixture

- **BL-10:** `backend/reporting/views.py:1754` và sáu view báo cáo khác đặt action tên `schema`, che thuộc tính DRF `schema`. `SchemaGenerator` và `manage.py check --deploy` lỗi `Incompatible AutoSchema`. Đổi tên method, giữ URL `/schema/`, chạy lại hai test OpenAPI.
- **BL-11:** `backend/common_services/models.py:720` chưa có migration tương ứng; `manage.py makemigrations --check --dry-run` đề xuất `common_services/migrations/0016_alter_accountingpolicy_accounting_regime.py`. Tạo và kiểm tra migration trên DB test trước khi deploy.
- **BL-12:** `backend/master_data/test_customer_management.py:533` tạo Party trùng `tax_code` nên lỗi trước khi gộp; dòng 648 dùng `SalesOrder(order_number, order_date)` không còn trong model. Sửa fixture rồi mới kết luận logic gộp/xóa.

## Các thất bại chưa quy về một nguyên nhân

Bộ test còn các sai khác ở công nợ, quyền kho, trạng thái hợp đồng, lương và danh mục. [Danh sách 51 bài](/C:/Users/Admin/LapTrinh/Thue/docs/REPO_LOGIC_AUDIT_FAILED_TESTS_2026-10-26.md) ghi từng tên test. Chưa coi mọi assertion 400/200 là lỗi sản phẩm: cần đối chiếu fixture, chính sách trạng thái và yêu cầu UC tương ứng.
