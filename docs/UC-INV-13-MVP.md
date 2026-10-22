# UC-INV-13 — Sổ chi tiết vật tư hàng hóa (MVP)

## Đã hoàn thiện

- Mục **Kho → Báo cáo → Báo cáo chi tiết kho → Sổ chi tiết vật tư hàng hóa** và mục tương ứng tại **Trung tâm Báo cáo → Kho** cùng mở báo cáo đầy đủ thay cho dữ liệu mẫu.
- Bảng **Chọn tham số** dùng kỳ đang làm việc, quý, năm hoặc khoảng ngày tùy chọn; chọn một hoặc nhiều kho, mặt hàng và nhóm VTHH từ doanh nghiệp đang làm việc. API kiểm tra kho được cấp quyền và mặt hàng thuộc doanh nghiệp.
- API chỉ đọc `GET /api/v1/inventory/balances/detail-ledger/` nhận `company_id`, `date_from`, `date_to`, `warehouse_ids`, `item_ids`, tùy chọn `category_id`. Báo cáo lấy số dư và phát sinh đã ghi sổ từ cùng nguồn UC-INV-08/09. Mỗi cặp hàng–kho có tồn đầu kỳ, chứng từ theo ngày hạch toán, tồn sau từng phát sinh và tồn cuối kỳ riêng; giá trị chưa tính giá hiện **Chưa hoàn tất tính giá**. Điều chỉnh chỉ thay đổi giá trị không tạo số lượng nhập, xuất giả.
- Tìm kiếm giữ nguyên tồn lũy kế đã tính; ẩn/hiện cột, nạp lại từ API, in, xuất CSV và lưu bộ tham số trên trình duyệt. Nếu nạp lại lỗi, số liệu trước đó vẫn hiển thị kèm cảnh báo. API đánh dấu nhóm có số dư cuối kỳ chưa khớp nguồn tổng hợp.

## Tự test trên giao diện

1. Chạy `cd backend; ..\venv\Scripts\python.exe manage.py migrate; ..\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8080` và trong cửa sổ khác `cd frontend; npm run dev`.
2. Đăng nhập `creator@example.com` / `password-123`, chọn công ty **ABC**. Nếu dữ liệu này chưa có chứng từ ghi sổ, tạo và ghi sổ một phiếu nhập hoặc xuất kho trước khi xem sổ.
3. Vào **Kho → Báo cáo**, mở **Báo cáo chi tiết kho**, chọn **Sổ chi tiết vật tư hàng hóa**. Trong **Chọn tham số**, chọn ngày bao phủ chứng từ, kho, một mặt hàng rồi nhấn **Xem báo cáo**.
4. Đối chiếu dòng **Tồn đầu kỳ**, số chứng từ, Nhập/Xuất, tồn sau mỗi dòng và **Tồn cuối kỳ** với **Tổng hợp tồn kho** cùng kỳ/kho/mặt hàng. Thử tìm theo số chứng từ: dòng tồn sau chứng từ giữ nguyên. Thử **Nạp lại**, **Ẩn hiện cột**, **Xuất báo cáo** và mở CSV.
5. Vào **Báo cáo → Kho → Báo cáo chi tiết kho** để mở cùng sổ từ Trung tâm Báo cáo.

## Kiểm thử tự động

```powershell
cd backend
..\venv\Scripts\python.exe manage.py test inventory.test_detail_ledger --keepdb --noinput
cd ..\frontend
$env:PLAYWRIGHT_CHANNEL='chrome'; npx playwright test tests/inventory-detail-ledger-mvp.spec.ts --project=chromium
npx vite build
```

Để chạy kiểm tra Chrome với backend thật ở cổng `8080`, đặt `$env:LIVE_INVENTORY_EMAIL` và `$env:LIVE_INVENTORY_PASSWORD`, sau đó chạy `npx playwright test tests/inventory-detail-ledger-live-smoke.spec.ts --project=chromium`. Kiểm thử này chỉ đọc dữ liệu. Trên SQLite cục bộ hiện tại, công ty ABC chưa có số dư tồn nên kiểm thử xác nhận trạng thái **Không có dữ liệu**; luồng có chứng từ được kiểm tra bằng test backend và test giao diện có phản hồi API kiểm soát.

## Giới hạn MVP

Liên kết bấm số chứng từ để mở chứng từ gốc chưa có. Bộ tham số đã lưu nằm trên trình duyệt hiện tại. Số dư mở sổ chưa có ngày riêng trong mô hình dữ liệu hiện tại, nên báo cáo kỳ lịch sử trước mốc nhập số dư mở sổ cần đối chiếu dữ liệu nguồn.
