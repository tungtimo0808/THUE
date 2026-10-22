# UC-INV-08 · Theo dõi tồn kho (MVP)

## Đã nối

- Màn **Báo cáo → Kho → Tổng hợp tồn kho** dùng API thật. Cửa sổ xem nhanh tại **Kho → Báo cáo → Tổng hợp tồn kho** dùng cùng màn này, giữ phong cách bảng và hộp chọn tham số hiện có.
- Chọn tháng này hoặc khoảng ngày tùy chỉnh, một hoặc nhiều kho, nhóm VTHH; xem theo đơn vị tính chính. API chỉ trả về kho được phân quyền và chặn yêu cầu xem kho khác.
- Báo cáo theo từng kho và mặt hàng, gồm số lượng và giá trị đầu kỳ, nhập, xuất, cuối kỳ. Chỉ chứng từ đã ghi sổ mới góp vào biến động. Số dư đầu kỳ được dựng từ tồn hiện tại và nhật ký biến động; số dư mở sổ nhập sẵn trong tồn vẫn được giữ.
- Tìm kiếm, ẩn/hiện cột, nạp lại, in, xuất CSV và lưu cấu hình tham số trên trình duyệt theo doanh nghiệp. Dòng tổng cộng phản ánh các dòng đang hiển thị; số lượng chỉ cộng khi cùng đơn vị tính. Giá trị chưa tính đủ hiện **Chưa hoàn tất tính giá**.
- API chỉ đọc: `GET /api/v1/inventory/balances/summary-options/?company_id=<UUID>` và `GET /api/v1/inventory/balances/summary/?company_id=<UUID>&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&warehouse_ids=<UUID,UUID>&category_id=<UUID>`. Bỏ `warehouse_ids` để lấy tất cả kho được phép; `category_id` không bắt buộc.

## Thử trên giao diện

1. Từ thư mục dự án, mở hai PowerShell. Chạy backend bằng `cd backend; ..\venv\Scripts\python.exe manage.py runserver` và frontend bằng `cd frontend; npm run dev`. Mở URL Vite hiện trên terminal, thường là `http://localhost:5173`.
2. Với SQLite cục bộ đã chuẩn bị ở phiên làm việc này, đăng nhập `creator@example.com` / `password-123`, chọn doanh nghiệp **ABC**. Với cơ sở dữ liệu khác, dùng tài khoản có quyền `INV.BALANCE.VIEW` tại kho muốn xem.
3. Vào **Báo cáo → Kho → Tổng hợp tồn kho**. Trong **Chọn tham số**, chọn tháng hoặc ngày chứa các phiếu đã ghi sổ; chọn kho và nhấn **Xem báo cáo**. Nếu chưa có dữ liệu, tạo một phiếu tại **Kho → Nhập kho → Thêm**, gửi duyệt, duyệt và ghi sổ, rồi nạp lại báo cáo. Phiếu nháp không làm thay đổi báo cáo.
4. Kiểm tra mỗi kho có một dòng riêng cho cùng mã hàng; nhập trong kỳ và tồn cuối kỳ khớp phiếu đã ghi sổ. Thử tìm mã hàng, ẩn một cột, **Nạp lại**, **Xuất báo cáo** (CSV), **In báo cáo**, và **Lưu báo cáo** rồi mở lại từ danh sách đã lưu.
5. Vào **Kho → Báo cáo**, mở xem nhanh **Tổng hợp tồn kho** và chọn cùng tham số; số liệu phải trùng với màn Báo cáo. Chọn ngày bắt đầu sau ngày kết thúc hoặc bỏ chọn mọi kho để thấy lỗi xác thực.

## Kiểm thử tự động

- Backend: `cd backend; ..\venv\Scripts\python.exe manage.py test inventory.tests.InventoryApiTests --keepdb --noinput`.
- Giao diện: `cd frontend; $env:PLAYWRIGHT_CHANNEL='chrome'; npx playwright test tests/inventory-stock-summary-mvp.spec.ts --reporter=line`.
- Bản dựng giao diện: `cd frontend; npx vite build`.

## Phạm vi MVP

Báo cáo phản ánh tồn kho kế toán theo sổ biến động hiện có, không tính tồn khả dụng sau giữ chỗ. Số dư mở sổ chưa có ngày riêng nên các kỳ lịch sử trước lần nhập số dư mở sổ cần kiểm tra với dữ liệu gốc. Cấu hình đã lưu nằm trên trình duyệt hiện tại. Giá trị đầu kỳ hoặc cuối kỳ có phiếu xuất bán chưa tính giá đầy đủ được đánh dấu chưa hoàn tất, không hiển thị như giá trị 0.
