# UC-BANK-05 – Quản lý giao dịch sao kê

## Phạm vi MVP

Màn hình **Tiền gửi → Đối chiếu ngân hàng → Đối chiếu offline → Giao dịch sao kê** dùng lại giao diện hiện có. Danh sách và chi tiết lấy từ `/api/v1/bank/statement-lines/`. Có bộ lọc tài khoản, chi nhánh, kỳ, ngày, chiều giao dịch, trạng thái ghép, nguồn, loại tiền, trạng thái theo dõi và từ khóa. Từ khóa tìm được cả số tài khoản đối tác. Chi tiết hiển thị dữ liệu nguồn, số dư, chứng từ đã ghép, số tiền đã ghép/còn lại và người tạo/cập nhật.

Chỉ ghi chú xử lý, trạng thái theo dõi và lý do được sửa. Kỳ đã xác nhận chỉ được xem. Xóa mềm chỉ áp dụng cho dòng nhập từ tệp, chưa ghép, thuộc kỳ chưa xác nhận và có lý do. Có Audit Log, kiểm tra phiên bản cập nhật, tính lại tổng lô nhập và xuất Excel theo bộ lọc.

## Test trên giao diện

1. Đăng nhập bằng tài khoản có quyền `BANK.STATEMENT.VIEW` và `BANK.STATEMENT.EDIT`, chọn doanh nghiệp có tài khoản ngân hàng.
2. Vào **Tiền gửi → Đối chiếu ngân hàng → Đối chiếu offline**; chọn tài khoản, khoảng ngày rồi bấm **Lấy dữ liệu**. Nếu chưa có dòng, dùng **Tải tệp sao kê** để nhập tệp theo [UC-BANK-04-MVP.md](UC-BANK-04-MVP.md).
3. Trong **Giao dịch sao kê**, lọc theo kỳ, nguồn, trạng thái ghép; tìm bằng mã giao dịch, nội dung hoặc số tài khoản đối tác. Kiểm tra tổng số dòng, tổng thu/chi và nút **Xuất Excel**.
4. Bấm **Chi tiết**. Kiểm tra ngày giao dịch/ngày giá trị, tệp/trang/dòng nguồn, số dư, chứng từ ghép và số tiền còn lại.
5. Chọn **Cần kiểm tra**, bấm **Lưu** khi chưa có lý do để kiểm tra thông báo; nhập lý do và ghi chú rồi lưu. Mở lại dòng để xác nhận dữ liệu được giữ.
6. Với dòng **nhập từ tệp**, **chưa ghép** và kỳ **chưa xác nhận**, nhập lý do xóa rồi bấm **Xóa giao dịch**. Dòng biến mất khỏi danh sách; tổng lô nhập được tính lại. Dùng dữ liệu thử vì thao tác xóa được ghi Audit Log.
7. Với dòng đã ghép hoặc kỳ đã xác nhận, kiểm tra các thao tác bị khóa theo trạng thái. Có thể dùng **Ghép chứng từ** hoặc **Lập chứng từ** để đi tiếp tới luồng liên quan.

## Kiểm chứng tự động

`python manage.py test bank_management.tests.BankApiTests.test_statement_preview_and_atomic_file_import bank_management.tests.BankApiTests.test_statement_line_management_preserves_source_and_audits_removal bank_management.tests.BankApiTests.test_statement_line_export_and_source_delete_rules --keepdb`

`npx playwright test tests/bank-statement-lines-mvp.spec.ts --reporter=line`

## Giới hạn dữ liệu nguồn

Tên ngân hàng đối tác và thời điểm đồng bộ chỉ xuất hiện khi kết nối ngân hàng gửi các trường này. Tệp Excel hiện ánh xạ mã giao dịch vào cột tham chiếu; mã đó được dùng làm mã giao dịch sao kê khi không trùng trong lô. Nếu tệp không có mã, hệ thống dùng mã dòng nội bộ để giữ tính duy nhất.
