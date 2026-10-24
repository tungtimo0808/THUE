# UC-BANK-04 — Import sao kê ngân hàng

## Đã có trong MVP

- Dùng màn hình **Tiền gửi → Đối chiếu ngân hàng → Đối chiếu với Sổ Việt AI/AVA → Tải tệp sao kê** và form import đang có. Form nhận `.xlsx` hoặc `.xls` tối đa 20 MB, chọn tài khoản, kỳ, trang tính, dòng dữ liệu, định dạng ngày/số và ghép cột.
- **Kiểm tra dữ liệu** hiển thị dòng hợp lệ, lỗi, trùng xác định và nghi trùng; cho tải CSV lỗi. Dòng nghi trùng phải được chọn và xác nhận riêng là giao dịch khác. Nếu số dư đầu/cuối kỳ có chênh lệch theo các dòng được chọn, phải xác nhận cảnh báo.
- **Xác nhận import** đọc lại chính tệp Excel ở backend và đối chiếu ngày, nội dung, tham chiếu, tài khoản/loại tiền, chiều và số tiền của từng dòng được chọn. Chặn nhập lại cùng dòng của cùng tệp, kể cả khi lần sau chọn tập dòng khác. Lưu các dòng, tệp nguồn, cấu hình ghép cột và thông tin lần import trong một giao dịch cơ sở dữ liệu; không tạo chứng từ, bút toán hoặc thay đổi số dư kế toán.
- Sau khi import, màn hình Đối chiếu hiển thị lần import, các dòng đã nhập và cho tải tệp nguồn.

## Cách thử trên giao diện

1. Khởi động các dịch vụ bằng `docker compose up -d`. Kiểm tra `docker compose ps` có `postgres`, `backend`, `frontend` hoạt động. Sau khi thay đổi dependency backend, chạy `docker compose up -d --build backend` để cài `xlrd` cho tệp `.xls`.
2. Đăng nhập tài khoản có quyền nhập sao kê, chọn doanh nghiệp **ABC**. Mở **Tiền gửi → Đối chiếu ngân hàng → Đối chiếu với Sổ Việt AI/AVA → Tải tệp sao kê**.
3. Chọn tài khoản VND `123456789`, khoảng ngày **21/10/2026–21/10/2026** và tải [tệp thử `.xlsx`](/C:/Users/Admin/LapTrinh/Thue/backend/bank_management/fixtures/uc_bank_04_demo.xlsx). Chọn trang **Sao ke**, dòng tiêu đề **1**, dòng dữ liệu **2**, ngày **dd/MM/yyyy**, số **1.234,56**. Kiểm tra ghép các cột Ngày giao dịch, Nội dung, Thu, Chi, Mã giao dịch, Số tài khoản, Loại tiền và Tên đối tác.
4. Bấm **Kiểm tra dữ liệu**. Kỳ vọng 2 dòng hợp lệ, 1 dòng lỗi thiếu ngày; dòng lỗi không chọn được. Chọn hai dòng hợp lệ, bấm **Import 2 dòng** rồi **Xác nhận import**.
5. Trong **Các lần nhập sao kê**, bấm **Xem giao dịch đã nhập**. Kiểm tra một dòng Thu 100.000, một dòng Chi 20.000, trạng thái **Chưa ghép**. Tải lại cùng tệp để kiểm tra chặn trùng.

Tệp [mẫu `.xls`](/C:/Users/Admin/LapTrinh/Thue/backend/bank_management/fixtures/uc_bank_04_sample.xls) dùng để thử định dạng Excel cũ; chọn trang **Statement** và ghép bốn cột Ngay, Noi dung, Thu, Chi.

## Kiểm thử

- 4 ca API: import `.xlsx` và `.xls`, xác nhận nghi trùng, chặn dữ liệu JSON khác tệp, chặn import lặp và tính cảnh báo số dư theo dòng được chọn.
- Playwright trên Chrome: mở form từ Đối chiếu ngân hàng, chọn tệp, xem trước, chặn dòng lỗi, xác nhận riêng dòng nghi trùng và gửi yêu cầu import.
- Playwright trên ứng dụng đang chạy và backend thật: đăng nhập, chọn ABC, tải tệp mẫu vào form và kiểm tra kết quả **2 hợp lệ, 1 lỗi**; chưa xác nhận import để tránh tạo giao dịch thử trong dữ liệu doanh nghiệp.
- `npx vite build` thành công. Kiểm thử Playwright dùng API giả lập; chưa tạo bản ghi import thử trên dữ liệu thật của doanh nghiệp.
