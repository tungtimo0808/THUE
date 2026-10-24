# UC-BANK-03 — Chuyển tiền giữa các tài khoản ngân hàng

## Phạm vi MVP

- Dùng form **Chuyển tiền nội bộ** hiện có trong **Tiền gửi → Thu, chi tiền**. Tài khoản đi và đến phải là hai tài khoản ngân hàng đang hoạt động, cùng doanh nghiệp, cùng chi nhánh và cùng VND.
- **Lưu** tạo chứng từ chưa ghi sổ. Có thể xem, sửa hoặc hủy chứng từ này từ danh sách. Sửa dùng `version` để chặn ghi đè dữ liệu đã đổi ở phiên khác.
- **Ghi sổ** tạo bút toán Nợ 112 tài khoản đến / Có 112 tài khoản đi và cập nhật hai số dư trong cùng một giao dịch dữ liệu. Sổ từng tài khoản hiển thị phát sinh chuyển tiền.
- **Bỏ ghi sổ** yêu cầu lý do và kỳ kế toán mở, tạo bút toán đảo và khôi phục hai số dư. Chứng từ chuyển sang trạng thái đã bỏ ghi sổ.
- Form và menu dùng phong cách giao diện hiện có; nút **Xem** mở dữ liệu chứng từ chuyển tiền thật ở chế độ chỉ đọc.

## Thử trên giao diện

1. Khởi động hệ thống từ thư mục gốc: `docker compose up -d`, sau đó `docker compose exec backend python manage.py migrate --noinput`. Nếu chạy backend cục bộ, dùng Python trong `venv` và cấu hình cơ sở dữ liệu tương ứng rồi chạy `manage.py migrate`.
2. Đăng nhập tài khoản có quyền **BANK.TRANSFER.CREATE/EDIT/TRANSFER/REVERSE** và chọn doanh nghiệp có ít nhất hai tài khoản ngân hàng VND cùng chi nhánh; mở **Tiền gửi → Thu, chi tiền**.
3. Bấm mũi tên cạnh **Chi tiền** → **Chuyển tiền nội bộ**. Chọn tài khoản đi/đến, nhập số tiền, ngày, lý do, diễn giải dòng hạch toán và bấm **Lưu**. Kiểm tra chứng từ xuất hiện trong danh sách, hai số dư chưa đổi.
4. Ở dòng chứng từ, bấm mũi tên thao tác → **Sửa**, đổi lý do và lưu. Bấm số chứng từ hoặc **Xem** để kiểm tra dữ liệu vừa sửa.
5. Chọn **Ghi sổ**. Kiểm tra số dư tài khoản đi giảm, tài khoản đến tăng cùng số tiền; trong sổ tiền gửi của mỗi tài khoản có phát sinh đối ứng cùng số chứng từ.
6. Chọn **Bỏ ghi sổ**, nhập lý do. Kiểm tra hai số dư trở về giá trị trước bước 5, chứng từ hiển thị **Đã bỏ ghi sổ** khi xem.
7. Tạo chứng từ khác và chọn **Hủy** khi chưa ghi sổ; kiểm tra chứng từ không còn thao tác ghi sổ và số dư không đổi.

## Kiểm thử đã chạy

- Django: 3 ca kiểm tra chuyển tiền, gồm ghi sổ, rollback khi không đủ số dư, sửa/hủy nháp và bỏ ghi sổ hai bên.
- Playwright trên Chrome: lưu nháp → sửa → ghi sổ → bỏ ghi sổ với API giả lập.
- `npx vite build`: thành công. `npm run build` còn lỗi TypeScript có sẵn ở nhiều phần khác của frontend.

## Giới hạn hiện tại

- MVP trực tiếp chỉ hỗ trợ VND cùng chi nhánh. Chuyển ngoại tệ, chuyển liên chi nhánh, tiền đang chuyển, phí ngân hàng và ghép sao kê hai phía thuộc luồng riêng.
- Chưa có tải tệp đính kèm hoặc liên kết chứng từ chuyển tiền với hai dòng sao kê ngay trên form.
- Docker không hoạt động trong lần kiểm thử này, nên chưa xác nhận luồng qua backend và frontend chạy trên dữ liệu thật của môi trường hiện tại.
