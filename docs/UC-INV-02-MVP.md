# UC-INV-02 – Nhập kho khác (MVP)

## Đã thực hiện

- Dùng lại form **Phiếu nhập kho** có sẵn. Nút **Thêm** trong **Kho → Nhập kho** mở sẵn loại **Khác** với ngày hiện tại và số phiếu đề xuất.
- Danh mục hàng, kho, đối tượng và tài khoản lấy từ API của doanh nghiệp đang chọn. Chọn mã hàng sẽ điền tên và đơn vị tính. Đổi kho trên một dòng sẽ áp dụng cho cả phiếu.
- **Lưu** tạo hoặc cập nhật phiếu nháp; nháp có tổng tiền nhưng chưa cập nhật tồn và sổ cái. Nhấn số phiếu trong danh sách để mở lại và sửa. Phiếu đã gửi duyệt hoặc ghi sổ không thể lưu sửa.
- Trên dòng phiếu, thực hiện **Gửi duyệt → Duyệt → Ghi sổ** theo quyền được cấp. Khi ghi sổ, hệ thống kiểm tra kỳ mở và tài khoản rồi cập nhật tồn kho cùng bút toán Nợ/Có trong một giao dịch. Lỗi ở một phần sẽ hoàn tác toàn bộ; ghi sổ lần hai bị chặn.
- Kiểm tra số phiếu trùng, ngày, kho, hàng đang hoạt động, số lượng, đơn giá, đơn vị tính và tài khoản. Tài khoản Nợ/Có được lưu theo từng dòng. Phiếu đơn giá bằng 0 có thể ghi nhận số lượng; không tạo bút toán giá trị bằng 0.

## Thử trên giao diện

1. Mở `http://localhost:5173`, đăng nhập `anhtank47@gmail.com` / `password123`, chọn doanh nghiệp **ABC** rồi **Vào làm việc**. Tài khoản `admin@abc.com` trong dữ liệu hiện tại không có quyền truy cập doanh nghiệp ABC.
2. Vào **Kho → Nhập kho → Thêm**. Form mở loại **3. Khác**. Dùng số phiếu riêng chưa tồn tại; ngày chứng từ và hạch toán `21/10/2026`.
3. Chọn mã hàng `VL_DCD`, kho **Kho nguyên liệu**, số lượng `1`, đơn giá `2000`, TK Nợ `152`, TK Có `338`. Có thể để trống đối tượng và người giao. Nhấn **Lưu**.
4. Chọn **Xem danh sách chứng từ**. Phiếu ở trạng thái **Nháp** và hiển thị tổng `2.000 đ`. Mở lại dòng phiếu, sửa đơn giá và lưu để kiểm tra cập nhật nháp.
5. Nhấn **Gửi duyệt**, **Duyệt**, **Ghi sổ** trên cột trạng thái. Phiếu chuyển **Đã ghi sổ**. Kiểm tra tồn của `VL_DCD` tại **Kho nguyên liệu** và bút toán tương ứng ở sổ cái.
6. Có thể thử số phiếu trùng, để trống kho/mã hàng, số lượng `0`, đơn giá âm hoặc tài khoản không hợp lệ; form giữ dữ liệu và báo lỗi. Nếu kỳ hạch toán đã khóa, ghi sổ bị từ chối và phiếu vẫn chưa ghi sổ.

Đã chạy kiểm thử backend cho nháp, sửa, số trùng, kỳ khóa, hoàn tác khi sổ cái lỗi, ghi sổ và chặn ghi trùng. Đã thao tác trên giao diện tạo/sửa/duyệt/ghi sổ phiếu `NK00001` trong doanh nghiệp ABC; tồn và sổ cái đều ghi nhận `2.000 đ`.

## Giới hạn

- Nút **Lưu và In** chỉ lưu nháp; chưa tạo bản in thật. Khu **Đính kèm**, nút thêm đối tượng nhanh và tham chiếu trên form cũ chưa nối API.
- Chọn đơn vị tính khác đơn vị cơ sở cần cấu hình quy đổi của mặt hàng từ trước; API sẽ báo lỗi nếu chưa có quy đổi.
- Số phiếu chỉ là đề xuất; hai người tạo cùng lúc có thể cùng thấy một số và người lưu sau sẽ được yêu cầu đổi số.
