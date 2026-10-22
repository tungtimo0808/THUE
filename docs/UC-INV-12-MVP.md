# UC-INV-12 — Cảnh báo tồn kho (MVP)

## Đã nối

- `GET /api/v1/inventory/balances/alerts/?company_id=...` dùng số dư tồn kho hiện hành, chỉ trả các kho được cấp quyền. Mỗi dòng là một mặt hàng tại một kho; thẻ đếm mặt hàng duy nhất. Cặp hàng–kho phải có số dư hoặc chính sách quản lý tồn kho đang hoạt động.
- Phân loại: tồn `<= 0` là hết hàng (đánh dấu tồn âm); tồn `> 0`, ngưỡng `> 0` và tồn `<=` ngưỡng là sắp hết. Ngưỡng lấy từ `Item.min_stock`, đơn vị cơ sở.
- Kho → Biểu đồ: hai thẻ và bảng **Hàng hóa sắp hết** dùng API; hai nút **Tải lại** của cảnh báo gọi lại API và cập nhật thời điểm. Nếu tải lại lỗi, giao diện giữ kết quả cũ và báo dữ liệu có thể đã cũ.
- Kho → Hàng hóa, dịch vụ: hai thẻ cảnh báo dùng API và lọc danh sách khi nhấn. Form **Sửa** hiện có lưu **Số lượng tồn tối thiểu** qua API, kiểm tra số âm, dữ liệu không hợp lệ và tối đa bốn chữ số thập phân. Audit Log ghi người sửa, thời điểm và giá trị cũ/mới.

## Tự kiểm tra trên giao diện

1. Trong hai cửa sổ PowerShell, chạy `cd backend; ..\venv\Scripts\python.exe manage.py migrate; ..\venv\Scripts\python.exe manage.py runserver` và `cd frontend; npm run dev`.
2. Mở URL frontend do Vite in ra, đăng nhập `creator@example.com` / `password-123`, chọn công ty **ABC**.
3. Vào **Kho → Hàng hóa, dịch vụ**. Chọn một hàng hóa có tồn dương tại kho, nhấn **Sửa**, đặt **Số lượng tồn tối thiểu** bằng hoặc cao hơn tồn hiện tại rồi **Lưu**.
4. Vào **Kho → Biểu đồ**. Thẻ **Hàng hóa sắp hết hàng** tăng và bảng có tên hàng, kho, tồn, ngưỡng. Nhấn **Tải lại** dưới bảng. Quay về **Hàng hóa, dịch vụ**, nhấn thẻ **Hàng hóa sắp hết hàng** để lọc.
5. Giảm ngưỡng của hàng hóa xuống dưới tồn hiện tại, lưu, quay lại **Biểu đồ** và tải lại; hàng hóa biến mất khỏi bảng. Giá trị âm hoặc chữ trong trường ngưỡng phải bị từ chối.
6. Với hàng hóa đã có số dư hoặc chính sách quản lý tại kho và tồn `<= 0`, thẻ **Hàng hóa hết hàng** tăng. Hai thẻ có thể cùng đếm một mặt hàng nếu trạng thái khác nhau ở hai kho.

Số liệu chỉ xuất hiện khi tài khoản có quyền xem tồn kho và đã có mặt hàng–kho được quản lý. Mặt hàng mới chưa từng có số dư hoặc chính sách không tự sinh cảnh báo hết hàng.

## Kiểm thử tự động

```powershell
cd backend
..\venv\Scripts\python.exe manage.py test inventory.test_stock_alerts --keepdb --noinput
cd ..\frontend
$env:PLAYWRIGHT_CHANNEL='chrome'; npx playwright test tests/inventory-stock-alerts-mvp.spec.ts --project=chromium
npx vite build
```

Playwright mở Chrome, kiểm tra dữ liệu hiển thị, tải lại, lỗi tải lại, lọc theo thẻ và sửa ngưỡng qua giao diện. Hai kiểm thử backend kiểm tra phân loại theo kho, đếm duy nhất, tồn âm, không tạo cặp chưa quản lý, lưu ngưỡng, từ chối số âm và Audit Log.

Để kiểm tra giao diện với backend thật đang chạy ở cổng `8080`, đặt `$env:LIVE_INVENTORY_EMAIL` và `$env:LIVE_INVENTORY_PASSWORD`, rồi chạy `npx playwright test tests/inventory-stock-alerts-live-smoke.spec.ts --project=chromium`. Kiểm thử này chỉ đọc dữ liệu và đối chiếu hai thẻ với API thật.

## Phạm vi MVP

Ngưỡng áp dụng chung cho mặt hàng ở mọi kho. Phần vòng quay hàng tồn kho và giá trị tồn kho khác trên tab Biểu đồ vẫn là giao diện mẫu của các chức năng riêng. Chưa có màn hình chuyên biệt từ tiện ích **Cảnh báo tồn kho tối thiểu**.
