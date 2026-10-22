# UC-INV-05 – Chuyển kho (MVP)

## Đã thực hiện

- Dùng lại form **Chuyển kho** (Kho → Chuyển kho → Thêm), mặc định loại **Xuất kho kiêm vận chuyển nội bộ**, có đủ 3 loại. Danh sách và form đọc/ghi dữ liệu thật thay cho dữ liệu mẫu. Số chứng từ `CK…` kế tiếp được đề xuất.
- Mã người vận chuyển, mã đơn vị nhận, mã đại lý gợi ý từ danh mục và tự điền tên, MST. **Tham chiếu …** chọn chứng từ liên quan (AF04).
- Mỗi dòng có **Xuất tại kho** và **Nhập tại kho** riêng (AF06), hiện **Tồn khả dụng** của kho xuất. Đơn giá điều chuyển được đề xuất theo giá trị ghi sổ (giá bình quân của kho xuất); chỉ sửa được khi mặt hàng tính giá đích danh, giá chính thức xác định khi ghi sổ (BR09). Thành tiền, tổng số lượng và **Tổng tiền vốn** tự cập nhật.
- TK Nợ/TK Có không bắt buộc với chuyển kho nội bộ và không mặc định 157 (BR16). Nếu nhập thì phải đủ cả hai và là tài khoản hàng tồn kho (15x). Hai tài khoản khác nhau mới tạo bút toán; cùng tài khoản thì chỉ cập nhật chi tiết theo kho (BR17). Không phát sinh doanh thu hay công nợ (BR15).
- **Cất** = lưu + ghi sổ trong một giao dịch: giảm tồn kho xuất, tăng tồn kho nhập cùng giá trị nên tổng tồn doanh nghiệp không đổi (BR12–BR14), báo "Đã lưu Phiếu chuyển kho … thành công!". Lỗi ghi sổ thì chứng từ vẫn **Chưa ghi sổ**, form giữ nguyên để sửa.
- **Có thời gian vận chuyển** (AF16): hàng xuất sang **kho trung chuyển**, chứng từ **Đã ghi sổ · Đang vận chuyển**, kho nhận chưa tăng tồn. Mở chứng từ, nhấn **Xác nhận nhận hàng**, nhập số lượng thực nhận:
  - Nhận đủ: hàng vào kho nhận, chứng từ chuyển sang **Đã nhận**.
  - Có chênh lệch: hệ thống hiển thị số đã xuất, số thực nhận, phần chênh lệch và không tự xác nhận. Người dùng phải tích **Ghi nhận chênh lệch** và nhập lý do. Phần chênh lệch nằm lại ở kho trung chuyển để xử lý tiếp (EF20, BR19–BR20).
  - Trạng thái giao nhận hiển thị riêng với trạng thái ghi sổ trong form và danh sách. Xác nhận nhận hàng cần quyền riêng `INV.TRANSACTION.RECEIVE` (migration mới).
- **Xuất kho gửi bán đại lý** (AF02, BR21): bắt buộc chọn đại lý. Kho nhập phải là kho loại **Ký gửi**; kho nội bộ không nhận loại này và ngược lại. TK Nợ 157 được điền sẵn, bắt buộc.
- **Thêm ghi chú** (AF10), **Đính kèm** (tối đa 5 MB/tệp), ẩn/hiện TK, hủy có hỏi xác nhận (AF15).
- **Cất và In** in theo mẫu của loại chứng từ: Phiếu chuyển kho, Phiếu xuất kho kiêm vận chuyển nội bộ (03XKNB), Phiếu xuất kho hàng gửi bán đại lý (04HGDL). Mũi tên cạnh nút chọn mẫu có hoặc không đơn giá. Chứng từ đã ghi sổ có nút **In lại**, in lại không tạo phát sinh (AF18).
- Kiểm tra theo EF01–EF20:
  - Tồn kho được kiểm tra theo tổng các dòng cùng mã hàng và kho xuất (BR08).
  - Nếu tồn bị giao dịch khác dùng mất trước khi ghi sổ, hệ thống báo "Tồn kho đã thay đổi, không đủ số lượng để chuyển…" và không ghi gì.
  - Kỳ kế toán khóa thì không ghi sổ.
  - Chứng từ đã ghi sổ không ghi lại và không sửa được.
- Audit Log ghi tạo, sửa, ghi sổ, đính kèm và xác nhận nhận hàng.

API mới: `POST /api/v1/inventory/transactions/{id}/receive/` (`lines: [{line, received_quantity}]`, `accept_discrepancy`, `reason`). Chuyển kho dùng `source_module = INV_TRANSFER`, kho nhập theo dòng `destination_warehouse` (migration `0012`), quyền nhận hàng (migration `0013`).

## Thử trên giao diện

1. Đăng nhập `http://localhost:5173`, doanh nghiệp **ABC**, vào **Kho → Chuyển kho → Thêm**, chọn **Xuất chuyển kho nội bộ**.
2. Nhập người vận chuyển, diễn giải. Dòng hàng: mã có tồn (ví dụ `DT_IP15` ở `KHO`), kho nhập khác kho xuất, số lượng. Nhấn **Cất**: tồn kho xuất giảm, kho nhập tăng cùng giá trị.
3. Muốn thử **Có thời gian vận chuyển**: khai báo một kho loại **Trung chuyển** trong Danh mục kho trước, Cất, rồi mở lại chứng từ và **Xác nhận nhận hàng**.
4. Muốn thử **gửi bán đại lý**: đổi loại của kho hàng gửi bán (ví dụ kho `157`) sang **Ký gửi**, chọn đại lý, TK Có `1561`.

Đã chạy thử Cất một phiếu chuyển `KHO → 155` trên dữ liệu ABC thật bên trong giao dịch rồi hoàn tác (không để lại dữ liệu): ghi sổ thành công, tồn chuyển đúng 1 đơn vị.

## Kiểm thử

- Backend: `docker compose exec -T backend python manage.py test sales inventory --keepdb` (197 test, gồm `test_transfer_uc_inv_05_direct_transit_consignment_and_exceptions`).
- Giao diện (mock API): `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/inventory-transfer-mvp.spec.ts tests/inventory-other-issue-mvp.spec.ts tests/inventory-sale-issue-mvp.spec.ts`.

## Giới hạn

- Doanh nghiệp ABC hiện chưa có kho loại **Trung chuyển** và **Ký gửi**, nên hai luồng này cần khai báo kho trước khi dùng.
- Bỏ ghi sổ/hủy chứng từ chuyển kho đã ghi sổ (BR24) vẫn theo luồng đảo giao dịch kho hiện có; chứng từ đã có bút toán phải xử lý sổ cái trước.
- Phần chênh lệch khi nhận hàng được giữ ở kho trung chuyển; việc hạch toán hao hụt (xuất kho khác hoặc kiểm kê) do kế toán lập tiếp.
- Mẫu số, ký hiệu, "Là hóa đơn thay thế" trên form 1 và 2 được lưu kèm chứng từ nhưng chưa phát hành hóa đơn điện tử.
- Theo dõi riêng hàng gửi bán theo đại lý dựa trên kho Ký gửi và TK 157; quyết toán bán hàng đại lý thuộc phân hệ Bán hàng.
