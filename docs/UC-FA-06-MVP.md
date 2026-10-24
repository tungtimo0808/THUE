# UC-FA-06 – Đánh giá lại tài sản cố định (MVP)

## Đã thực hiện

- Chứng từ đánh giá lại là **một chứng từ nhiều tài sản** (API `/api/v1/fixed-assets/revaluations/`). Chứng từ gồm: biên bản số/ngày, lý do, ngày chứng từ, ngày hạch toán, thành viên tham gia, kết luận, hồ sơ tham chiếu, đính kèm, các dòng điều chỉnh và các dòng hạch toán. Biên bản số quản lý riêng với số chứng từ (BR03). Số chứng từ `ĐGL…` kế tiếp được đề xuất, trùng số bị chặn kể cả khi hai người lưu cùng lúc (BR04, BR05).
- Form **Đánh giá lại tài sản cố định** có sẵn đã được nối API:
  - Danh sách **Mã tài sản** chỉ gồm TSCĐ đang sử dụng, đã ghi tăng tại ngày hiệu lực (ngày biên bản, nếu không có thì ngày hạch toán). Tài sản đã có khấu hao hoặc điều chỉnh ghi sổ sau ngày đó hiển thị nhưng không chọn được (EF25).
  - Chọn tài sản sẽ điền số liệu trước điều chỉnh: nguyên giá, **số tháng còn lại** (không phải thời gian ban đầu, BR12), hao mòn lũy kế, giá trị tính khấu hao.
  - Nhập số liệu sau điều chỉnh thì chênh lệch tự tính. Giá trị tính khấu hao đi theo nguyên giá mới, **GTKH tháng** được đề xuất lại theo công thức 4.7. **GTKH theo luật** quản lý riêng (AF18).
  - Không mặc định TK 412 (BR23).
  - **Tổng tiền** = chênh lệch nguyên giá − chênh lệch hao mòn (không cộng số tháng, BR27).
- Tab **Hạch toán** đề xuất định khoản theo lý do (có nút **Đề xuất định khoản**); người dùng sửa được:
  - Nâng cấp: Nợ TK tài sản / Có 241 (BR20).
  - Theo quyết định nhà nước / chuyển đổi: qua 412.
  - Lý do khác, chia tách/sáp nhập: người dùng chọn tài khoản (BR24).
  - Nếu tích **Chi phí nâng cấp đã hạch toán tại chứng từ nguồn** (kèm số chứng từ nguồn đã ghi sổ), hệ thống không lập lại bút toán tăng nguyên giá (AF29, EF24).
  - Chỉ đổi thời gian sử dụng thì không có bút toán (AF15, AF30).
- **Cất** = lưu + ghi sổ trong một giao dịch: cập nhật nguyên giá, hao mòn, số tháng còn lại và cơ sở khấu hao trên thẻ tài sản; lưu lịch sử trước/sau vào lịch sử tài sản; ghi bút toán vào Sổ cái. Không tạo chứng từ khấu hao và không sửa khấu hao đã ghi sổ (BR29, BR30). Thông báo "Đánh giá lại tài sản cố định thành công." Nếu lỗi, chứng từ vẫn lưu ở **Chưa ghi sổ**, form giữ nguyên để sửa (EF27, BR32). Bấm Cất lặp lại không tạo chứng từ trùng (EF28).
- **Cất và In**: chọn mẫu *Biên bản đánh giá lại TSCĐ (Mẫu số 04 - TSCĐ)* hoặc *Chứng từ kế toán*. Chứng từ đã ghi sổ có nút **In** (in lại) và **Bỏ ghi sổ** (AF28):
  - Bỏ ghi sổ khôi phục số liệu trước điều chỉnh và lập bút toán đảo.
  - Bị chặn nếu tài sản đã phát sinh nghiệp vụ sau đó.
  - Chứng từ đã ghi sổ không sửa trực tiếp được.
- Kiểm tra theo EF01–EF30 với đúng thông báo của tài liệu:
  - Quyền riêng `FA.REVALUATION.*` (migration `0007`); quyền theo chi nhánh của tài sản (EF30).
  - Lý do theo quyết định nhà nước, chia tách/sáp nhập, chuyển đổi: bắt buộc biên bản, hội đồng và kết luận. Lý do khác: bắt buộc kết luận.
  - Nâng cấp: không được giảm nguyên giá hoặc đổi hao mòn.
  - Định khoản phải khớp đúng chênh lệch nguyên giá (TK 211x) và hao mòn (TK 214x) (EF22).
  - Kỳ kế toán và kỳ tài sản phải đang mở (EF06).
  - Số liệu trước điều chỉnh được kiểm tra lại dưới khóa khi ghi sổ (EF15, EF26).
- Đính kèm tối đa 5 MB/tệp (EF29). Audit Log ghi tạo, sửa, ghi sổ, bỏ ghi sổ, đính kèm.

## Thử trên giao diện

1. Đăng nhập, vào **Tài sản cố định → Đánh giá lại → Thêm**.
2. Nhập biên bản số, chọn lý do và tài sản. Nhập nguyên giá hoặc số tháng sau điều chỉnh, kiểm tra GTKH tháng đề xuất.
3. Mở tab **Hạch toán**, kiểm tra bút toán đề xuất, nhập kết luận, nhấn **Cất**. Kiểm tra thẻ tài sản và Sổ cái.
4. Mở lại chứng từ trong danh sách để **In** hoặc **Bỏ ghi sổ**.

## Kiểm thử

- Backend: `docker compose exec -T backend python manage.py test fixed_assets general_ledger --keepdb` (42 test, gồm `fixed_assets.test_revaluation_uc_fa_06`).
- Giao diện (mock API): `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/asset-revaluation-mvp.spec.ts`.

## Giới hạn

- Chưa có luồng tháo dỡ bộ phận TSCĐ riêng (AF10, BR22): dùng Lý do khác và tự khai báo nguyên giá, hao mòn của phần tháo dỡ.
- Khấu hao theo luật chỉ được lưu để theo dõi; báo cáo chênh lệch thuế chưa sử dụng số liệu này.
- Mẫu in là bản HTML đơn giản; chưa có trình thiết kế mẫu in.
