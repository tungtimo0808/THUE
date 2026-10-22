# UC-INV-07 · Xử lý chênh lệch kiểm kê (MVP)

## Đã nối

- Dùng màn **Kho → Kiểm kê** hiện có. Danh sách mở lại biên bản thật từ API; biên bản nháp được xác nhận trước khi lập phương án.
- Từng dòng chênh lệch thừa/thiếu có thể lập phương án xử lý một phần, lưu nháp, gửi duyệt, phê duyệt, từ chối hoặc yêu cầu bổ sung.
- Người duyệt phải khác người lập. Backend khóa dòng kiểm kê và kiểm tra số lượng đã phân bổ để chặn hai phương án cùng dùng vượt chênh lệch.
- Phương án đã duyệt lập một chứng từ điều chỉnh nháp có tham chiếu biên bản và dòng kiểm kê. Ghi sổ tạo biến động tồn kho và bút toán sổ cái trong một giao dịch; biên bản hoàn thành khi toàn bộ số lượng lệch đã ghi sổ.
- Đường `create-adjustment` cũ bị chặn để không tạo điều chỉnh trước phê duyệt.

## Thử trên giao diện

1. Chạy migration: `cd backend; ..\venv\Scripts\python.exe manage.py migrate`. Mở backend và frontend như README. Với **SQLite cục bộ hiện tại**, dùng `creator@example.com` / `password-123` để lập phương án, và `approver@example.com` / `password-123` để phê duyệt; cả hai đã được gắn doanh nghiệp ABC để thử giao diện. Với cơ sở dữ liệu khác, dùng hai tài khoản có quyền tương ứng tại cùng doanh nghiệp.
2. Vào **Kho → Kiểm kê → Thêm**. Chọn kho, nhập số lượng thực tế khác số sổ sách, **Lưu biên bản**.
3. Chọn **Xem danh sách chứng từ**, mở biên bản mới, bấm **Xác nhận biên bản**, rồi **Xử lý chênh lệch**.
4. Chọn dòng lệch, nhập nguyên nhân, diễn giải, số lượng xử lý và giá trị có căn cứ; bấm **Lưu phương án → Gửi phê duyệt**.
5. Đăng nhập bằng tài khoản phê duyệt khác, mở lại biên bản và bấm **Phê duyệt**. Người lập không tự duyệt được.
6. Đăng nhập tài khoản kế toán, bấm **Lập chứng từ điều chỉnh**. Chọn ngày hạch toán trong kỳ kế toán mở, TK Nợ/TK Có hợp lệ (bên hàng tồn kho là TK 15x), bấm **Cất chứng từ** rồi **Ghi sổ**.
7. Kiểm tra số lượng tồn thay đổi đúng số đã xử lý, trạng thái dòng/phương án cập nhật. Nếu chỉ xử lý một phần, phần còn lại tiếp tục lập phương án khác.

## Giới hạn MVP

MVP này bao phủ điều chỉnh tăng/giảm sau phê duyệt cho hàng thừa đã xác minh hoặc nguyên nhân khác được giải trình. Sai sót chứng từ gốc, nhầm kho, kiểm đếm lại, tệp bằng chứng và đảo chứng từ đã hạch toán sổ cái cần luồng riêng. Hai người dùng và kỳ kế toán mở là điều kiện để test trọn luồng trên dữ liệu thật.
