# UC-INV-09 · Theo dõi nhập – xuất – tồn (MVP)

## Đã nối

- Thay cửa sổ số liệu mẫu **Kho → Báo cáo → Tổng hợp nhập xuất tồn trên nhiều kho** bằng báo cáo từ API. Cùng báo cáo cũng mở được tại **Báo cáo → Kho**.
- Mặc định dùng kỳ đang làm việc trên thanh trên cùng. Có thể đổi khoảng ngày, chọn nhiều kho, lọc nhóm vật tư/hàng hóa và nạp lại. Mặt hàng được tổng hợp từ từng kho theo đơn vị tính chính; giá trị báo cáo dùng đồng tiền hạch toán của doanh nghiệp.
- Bảng thể hiện tồn đầu kỳ, nhập, xuất, tồn cuối kỳ và giá trị cuối kỳ. Chỉ phát sinh đã ghi sổ được tính. Tồn âm giữ nguyên và tô cảnh báo; mặt hàng xuất hết vẫn còn trên báo cáo. Không cộng tổng số lượng giữa các mặt hàng khác đơn vị tính. Giá trị chưa đủ căn cứ tính giá hiện **Chưa hoàn tất tính giá**.
- Bấm mã hàng để xem các chứng từ phát sinh theo kho và ngày hạch toán trong cùng phạm vi. **Xuất Excel** tạo tệp `.xlsx` có tên báo cáo, kỳ, kho, đồng tiền, từng dòng và tổng giá trị; cửa sổ vẫn mở sau khi tải.
- API chỉ đọc: `GET /api/v1/inventory/balances/multi-warehouse-summary/` và `GET /api/v1/inventory/balances/movement-detail/`. Cả hai nhận `company_id`, `date_from`, `date_to`, `warehouse_ids`, `category_id`; API chi tiết nhận thêm `item_id`. Backend kiểm tra quyền theo doanh nghiệp và từng kho.

## Test trên giao diện

1. Mở hai PowerShell tại thư mục dự án. Chạy backend: `cd backend; ..\venv\Scripts\python.exe manage.py runserver`. Chạy frontend: `cd frontend; npm run dev`. Mở URL Vite in ra, thường là `http://localhost:5173`.
2. Với SQLite cục bộ đã chuẩn bị trong phiên làm việc này, đăng nhập `creator@example.com` / `password-123`, chọn doanh nghiệp **ABC**. Với cơ sở dữ liệu khác, dùng người có quyền `INV.BALANCE.VIEW` tại ít nhất một kho.
3. Vào **Kho → Báo cáo → Báo cáo tổng hợp tồn kho → Tổng hợp nhập xuất tồn trên nhiều kho**. Báo cáo tự lấy kỳ đang làm việc. Nếu chứng từ của bạn ở tháng khác, bấm **Chọn tham số → Tùy chọn**, chọn khoảng ngày và kho rồi **Xem báo cáo**.
4. Nếu chưa có số liệu, tạo một phiếu tại **Kho → Nhập kho → Thêm**, gửi duyệt, duyệt và ghi sổ; sau đó **Nạp lại** báo cáo. Phiếu chỉ lưu nháp không được cộng. Nếu có hai kho, thử chọn cả hai rồi bỏ một kho để thấy số liệu thay đổi.
5. Bấm một **Mã hàng** để mở sổ phát sinh và kiểm tra số chứng từ, ngày hạch toán, kho, nhập hoặc xuất. Bấm **Xuất Excel**, mở tệp vừa tải và đối chiếu tên báo cáo, kỳ, kho, số liệu mặt hàng và dòng tổng cộng.
6. Đóng báo cáo; vào **Báo cáo → Kho → Tổng hợp nhập xuất tồn trên nhiều kho** để xem cùng dữ liệu. Có thể so sánh từng kho với **Tổng hợp tồn kho** của UC-INV-08 khi chọn cùng kỳ và cùng kho.

## Kiểm thử tự động

- Backend: `cd backend; ..\venv\Scripts\python.exe manage.py test inventory.tests.InventoryApiTests --keepdb --noinput`.
- Giao diện: `cd frontend; $env:PLAYWRIGHT_CHANNEL='chrome'; npx playwright test tests/inventory-multi-warehouse-mvp.spec.ts --reporter=line`.
- Bản dựng: `cd frontend; npx vite build`.

## Giới hạn MVP

Sổ chi tiết mở từ **mã hàng trong báo cáo này** đã dùng dữ liệu thật; mục **Sổ chi tiết vật tư hàng hóa** độc lập trong danh sách báo cáo Kho vẫn thuộc giao diện báo cáo cũ. Số dư mở sổ chưa có ngày riêng, nên báo cáo kỳ lịch sử trước thời điểm nhập số dư mở sổ cần đối chiếu dữ liệu gốc. Báo cáo là tồn kho kế toán và không tính hàng giữ chỗ.
