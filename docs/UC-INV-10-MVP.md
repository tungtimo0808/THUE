# UC-INV-10 · Tính giá xuất kho (MVP)

## Đã nối

- Dùng nút và cửa sổ **Kho → Quy trình → Tính giá xuất kho** có sẵn. Kỳ kế toán, kho và phương pháp lấy từ API; kỳ đang làm việc được chọn trước nếu có kỳ mở tương ứng.
- API `GET /api/v1/inventory/valuations/options/?company_id=<UUID>` trả kỳ, kho được phép tính giá và phương pháp. `POST /api/v1/inventory/valuations/?company_id=<UUID>` nhận `company`, `period`, `warehouse` (hoặc `null` cho mọi kho), `method` và `recalculate`.
- Ba phương pháp thực thi: `PERIODIC_AVERAGE` (bình quân cuối kỳ), `MOVING_AVERAGE` (bình quân tức thời), `FIFO` (nhập trước xuất trước). Phương pháp phải trùng chính sách mặt hàng/kho. Chỉ chứng từ đã ghi sổ được tính; kỳ khóa và kho ngoài quyền bị chặn.
- Cập nhật đơn giá, thành tiền dòng xuất, biến động giá trị, giá trị tồn và bút toán điều chỉnh chênh lệch trong một giao dịch. Không sửa số lượng hay định danh chứng từ. Tính lại cần xác nhận; nếu không còn chênh lệch thì không tạo bút toán mới. Lịch sử hoàn thành/thất bại và audit được ghi lại.
- Phiếu xuất theo FIFO hoặc bình quân cuối kỳ được đánh dấu **Chưa hoàn tất tính giá** trên báo cáo tồn kho cho tới khi chạy tính giá thành công. Báo cáo UC-INV-08/09 đọc giá trị mới sau khi nạp lại.

## Test trên giao diện

1. Chạy `cd backend; ..\venv\Scripts\python.exe manage.py migrate` lần đầu, sau đó `..\venv\Scripts\python.exe manage.py runserver`. Chạy frontend bằng `cd frontend; npm run dev` ở PowerShell khác.
2. Với SQLite cục bộ đã chuẩn bị trong phiên làm việc này, đăng nhập `creator@example.com` / `password-123`, chọn **ABC**. Tài khoản cần quyền `INV.VALUATION.VIEW` và `INV.VALUATION.RUN` tại kho muốn tính.
3. Chuẩn bị kỳ kế toán **mở**, mặt hàng có chính sách tính giá phù hợp, phiếu nhập và phiếu xuất **đã ghi sổ** trong kỳ. Nếu chưa có kỳ/chứng từ, cửa sổ sẽ báo không có dữ liệu phù hợp; không tạo kết quả mẫu.
4. Vào **Kho → Quy trình → Tính giá xuất kho**. Kiểm tra kỳ tự chọn, chọn phương pháp đúng chính sách, chọn một kho hoặc tất cả kho rồi bấm **Thực hiện tính giá**. Với dữ liệu hợp lệ, thông báo nêu đúng kỳ, phương pháp và số dòng đã tính.
5. Mở phiếu xuất để kiểm tra đơn giá và giá trị, mở **Báo cáo → Kho → Tổng hợp tồn kho** hoặc **Tổng hợp nhập xuất tồn trên nhiều kho**, rồi **Nạp lại** để đối chiếu giá trị cuối kỳ. Mở lại cửa sổ tính giá để xem lịch sử.
6. Bấm chạy lại cùng kỳ để thấy yêu cầu **Xác nhận tính lại**; chọn **Hủy** thì số liệu giữ nguyên. Thử kỳ đã khóa hoặc phương pháp khác chính sách để thấy thông báo lỗi và không có cập nhật một phần.

## Kiểm thử tự động

- Backend: `cd backend; ..\venv\Scripts\python.exe manage.py test inventory.tests.InventoryApiTests --keepdb --noinput`.
- Giao diện: `cd frontend; $env:PLAYWRIGHT_CHANNEL='chrome'; npx playwright test tests/inventory-costing-mvp.spec.ts --reporter=line`.
- Bản dựng: `cd frontend; npx vite build`.

## Giới hạn MVP

Để tránh công bố giá vốn sai, API từ chối kỳ có phát sinh tiếp theo của cùng mặt hàng/kho, chứng từ chuyển kho phụ thuộc, hoặc FIFO có tồn đầu kỳ nhưng chưa lưu các lớp giá đầu kỳ. Các nghiệp vụ này cần dữ liệu lớp FIFO và chuỗi tính giá liên kỳ trước khi cho chạy. Nhập kho giá trị 0 được coi là nghiệp vụ 0 hợp lệ khi chứng từ đã ghi sổ; hệ thống chưa có trạng thái riêng để phân biệt phiếu nhập thiếu chi phí mua hàng cần phân bổ. Nếu có trường hợp đó, cần hoàn thiện giá nhập trước khi chạy tính giá.
