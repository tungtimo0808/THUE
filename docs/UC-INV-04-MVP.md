# UC-INV-04 – Xuất kho khác (MVP)

## Đã thực hiện

- Dùng lại form **Phiếu xuất kho**. Chọn loại **3. Khác (Xuất sử dụng, góp vốn, ...)**: Lý do xuất mặc định "Xuất kho khác", TK Nợ/TK Có để trống, số chứng từ `XK…` kế tiếp được đề xuất.
- **Mã đối tượng** gợi ý từ danh mục. Chọn mã sẽ điền Tên đối tượng và địa chỉ mặc định. Nút **+** mở form **Thêm đối tượng** (mã, tên, loại, địa chỉ), lưu vào danh mục rồi điền ngay vào phiếu (AF01).
- **Tham chiếu …** mở danh sách chứng từ kho và chứng từ bán hàng để chọn số tham chiếu (AF05).
- Mỗi dòng chọn **Kho xuất** riêng (AF06) và hiển thị **Tồn khả dụng**. Đơn giá xuất được đề xuất theo giá bình quân của mặt hàng tại kho đó; ô đơn giá chỉ sửa được khi mặt hàng tính giá theo phương pháp đích danh. Giá chính thức do hệ thống xác định khi ghi sổ (BR08). Thành tiền và **Tổng tiền** tự cập nhật; thêm/xóa dòng, xóa hết dòng, ẩn/hiện TK đều dùng được.
- **Đính kèm**: chọn hoặc kéo thả tệp (PDF, ảnh, Word, Excel, CSV, TXT, ZIP/RAR, tối đa 5 MB/tệp, 20 tệp). Tệp lớn hơn 5 MB bị từ chối ngay. Tệp được tải lên cùng lúc lưu phiếu; tải về hoặc xóa được khi phiếu chưa ghi sổ.
- **Cất** = lưu + ghi sổ trong **một giao dịch**: giảm số lượng và giá trị tồn theo từng kho, tạo bút toán Nợ/Có từng dòng, chuyển phiếu sang **Đã ghi sổ**, báo "Đã lưu và ghi sổ Phiếu xuất kho … thành công!". Nếu ghi sổ lỗi, phiếu vẫn được lưu ở trạng thái **Chưa ghi sổ**, form giữ nguyên để sửa và Cất lại.
- **Cất và In** in phiếu sau khi ghi sổ, dùng giá trị chính thức do backend trả về. Mũi tên cạnh nút cho chọn mẫu: **Mẫu số 02 - VT** hoặc **không đơn giá** (cho thủ kho).
- Khi chưa cấu hình quy trình duyệt, người có quyền duyệt và ghi sổ được Cất thẳng. Nếu doanh nghiệp cấu hình quy trình duyệt, phiếu chuyển **Chờ duyệt** và duyệt/ghi sổ ở danh sách như cũ.
- Kiểm tra theo EF: thiếu/trùng số chứng từ, ngày không hợp lệ, kỳ kế toán đã khóa, thiếu lý do xuất, không có dòng, mã hàng/kho/số lượng/đơn giá/tài khoản không hợp lệ. Khi lưu, tồn kho được kiểm tra theo **tổng các dòng cùng Mã hàng – Kho** (BR16) và báo mã hàng, kho, tồn khả dụng, số lượng yêu cầu. Nếu tồn bị giao dịch khác dùng mất trước khi ghi sổ, hệ thống báo "Tồn kho đã thay đổi…" và không ghi gì. TK Có phải là tài khoản hàng tồn kho (15x). TK Nợ là tài khoản góp vốn (221/222/228) thì bắt buộc có đối tượng nhận góp vốn.
- Phiếu đã ghi sổ hoặc đã hủy không ghi sổ lại và không sửa được. Audit Log ghi tạo, sửa, gửi duyệt, duyệt, ghi sổ, đính kèm và xóa tệp.

API mới: `POST /api/v1/inventory/transactions/{id}/submit-and-post/`, `POST …/{id}/attachments/` (multipart `file`), `GET …/{id}/attachments/{attachment_id}/`, `POST …/{id}/attachments/{attachment_id}/remove/`.

## Thử trên giao diện

1. Đăng nhập `http://localhost:5173`, chọn doanh nghiệp **ABC**, vào **Kho → Xuất kho → Thêm**, chọn loại **3. Khác**.
2. Chọn hoặc thêm đối tượng, nhập Người nhận, Lý do xuất (ví dụ "Xuất vật tư sử dụng nội bộ").
3. Nhập mã hàng có tồn, chọn kho, TK Nợ `6421`, TK Có `1561`, số lượng. Kiểm tra tồn khả dụng và đơn giá đề xuất.
4. Đính kèm một tệp nhỏ, nhấn **Cất**. Phiếu chuyển **Đã ghi sổ** trong danh sách; tồn giảm và có bút toán.
5. Thử số lượng vượt tồn, bỏ trống kho/lý do/tài khoản, tệp trên 5 MB: form báo lỗi, không ghi sổ.

## Kiểm thử

- Backend: `docker compose exec -T backend python manage.py test sales inventory --keepdb` (196 test, gồm `test_other_issue_uc_inv_04_validation_attachments_and_atomic_save_post`).
- Giao diện (mock API): `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/inventory-other-issue-mvp.spec.ts tests/inventory-sale-issue-mvp.spec.ts`.
- Đã chạy thử tạo và Cất một phiếu trên dữ liệu ABC thật bên trong giao dịch rồi hoàn tác (không để lại dữ liệu): ghi sổ thành công, tồn giảm, có bút toán.

## Giới hạn

- Thuế phát sinh khi biếu tặng và phần chênh lệch đánh giá lại khi góp vốn (AF02, AF03, BR12) chưa được tính tự động; kế toán lập bút toán bổ sung.
- Bỏ ghi sổ phiếu đã có bút toán (BR20) vẫn theo luồng hiện tại: phải xử lý bút toán sổ cái trước khi đảo phiếu kho.
- Kiểm tra bộ phận sử dụng (BR11) và giới hạn TK Nợ theo mục đích xuất chưa có cấu hình riêng; TK Nợ do kế toán chọn.
