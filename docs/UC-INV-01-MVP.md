# UC-INV-01 – Nhập kho mua hàng (MVP)

## Đã nối với dữ liệu thật

- Dùng form **Chứng từ mua hàng** và bảng chứng từ có sẵn trong phân hệ Mua hàng. Danh mục nhà cung cấp, mặt hàng và kho lấy từ API của doanh nghiệp đang chọn.
- **Lưu** và **Lưu và Đóng** tạo chứng từ nháp. **Lưu và Thêm** tạo chứng từ mới sau khi lưu. Số phiếu có thể nhập hoặc để trống để hệ thống đánh số.
- Lưu người giao, địa chỉ, nhân viên mua, số chứng từ gốc, số ngày được nợ, hạn thanh toán và thông tin hóa đơn. Kiểm tra nhà cung cấp, ngày, mặt hàng, kho, số lượng, đơn giá, tài khoản và hóa đơn trước khi lưu.
- Ở bảng chứng từ, thao tác **Gửi duyệt** rồi **Ghi sổ**. Chỉ khi ghi sổ thành công mới tạo phiếu nhập kho, tăng số lượng/giá trị tồn, ghi bút toán và tạo công nợ có hạn thanh toán.
- Mở lại chứng từ nháp từ số chứng từ trong bảng để sửa rồi lưu tiếp.

## Cách kiểm tra trên giao diện

1. Mở `http://localhost:5173`, đăng nhập và chọn doanh nghiệp **ABC**. Kỳ kế toán tháng 10/2026 hiện đang mở; có thể dùng ngày `21/10/2026`.
2. Vào **Mua hàng → Mua hàng**. Nhấn **Thêm → Chứng từ mua hàng**. Giữ mẫu **Mua hàng trong nước nhập kho**, **Chưa thanh toán**.
3. Có thể thử nhà cung cấp `ANHTUAN`, mã hàng `DT_IP15`, kho `KHO`, số lượng `1`, đơn giá `16200000`, thuế suất `0`. Nếu bật **Nhận kèm hóa đơn**, nhập ký hiệu, số và ngày hóa đơn; có thể tắt tùy chọn này khi chưa nhận hóa đơn.
4. Để trống số phiếu để hệ thống đánh số; nhấn **Lưu và Đóng**. Tìm phiếu mới trong bảng. Chứng từ phải ở trạng thái nháp/chưa ghi sổ; tồn kho chưa tăng.
5. Trên dòng chứng từ, chọn **Gửi duyệt**, thực hiện **Duyệt** nếu quy trình yêu cầu, rồi **Ghi sổ**. Mở **Kho → Nhập kho** hoặc báo cáo tồn kho để đối chiếu đúng mã hàng, kho, số lượng và giá trị; kiểm tra công nợ nhà cung cấp và bút toán tương ứng.
6. Thử nhập trùng số phiếu, bỏ trống nhà cung cấp/kho, nhập số lượng hoặc đơn giá bằng 0, hoặc bỏ thông tin hóa đơn bắt buộc. Form phải giữ nguyên và báo lỗi.

## Phạm vi chưa nối trong MVP này

- **Thanh toán ngay** cần một chứng từ chi đã xác nhận và đủ số tiền; form hiện chặn lưu để tránh ghi công nợ/thanh toán sai.
- Cửa sổ **Tham chiếu** trên form, phân bổ **Chi phí mua hàng** và tệp **Đính kèm** chưa lưu vào API từ giao diện.
- Mẫu **Mua hàng nhập khẩu** có các loại thuế/chi phí riêng và được chặn lưu qua luồng này.

Kiểm thử backend: `docker compose exec -T backend python manage.py test purchases.test_goods_purchase --keepdb`.
