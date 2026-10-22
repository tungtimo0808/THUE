# UC-INV-03 – Xuất kho bán hàng (MVP)

## Đã thực hiện

- Dùng lại form **Phiếu xuất kho** có sẵn. Nút **Thêm** trong **Kho → Xuất kho** mở sẵn loại **1. Bán hàng**, ngày hiện tại và số phiếu `XK…` kế tiếp.
- Nút **Chọn chứng từ bán hàng** (hoặc Enter trong ô tham chiếu) mở hộp tìm kiếm theo Số chứng từ, Khách hàng, Từ ngày – Đến ngày. Chỉ hiện chứng từ bán hàng **đã ghi sổ**, lập ở chế độ xuất kho sau (bỏ chọn **Kiêm phiếu xuất kho** trên chứng từ bán hàng) và **chưa xuất đủ**. Mỗi dòng hàng hiển thị SL bán, SL đã xuất, SL còn được xuất; dòng đã xuất đủ không chọn được.
- **Đồng ý** điền khách hàng, địa chỉ, diễn giải, số tham chiếu và các dòng đã chọn. Mỗi dòng chọn **Kho xuất** riêng, hiển thị **Tồn khả dụng** và **Còn được xuất**. Tài khoản lấy theo chứng từ bán hàng (thường Nợ 632 / Có 156). Đơn giá vốn chỉ là tạm tính theo giá bình quân của kho, không sửa tay; giá chính thức được xác định khi ghi sổ.
- **Lưu** chỉ lưu phiếu ở trạng thái **Chưa ghi sổ**, chưa giảm tồn và chưa ghi giá vốn. **Lưu và In** lưu rồi in phiếu (chọn mẫu bằng mũi tên cạnh nút). Mở lại phiếu từ danh sách để sửa. Có thể đính kèm tệp (tối đa 5 MB/tệp).
- **Ghi sổ** lưu rồi gửi duyệt và ghi sổ trong **một giao dịch** (API `submit-and-post`). Khi chưa cấu hình quy trình duyệt, người có quyền duyệt được ghi sổ thẳng; nếu có quy trình duyệt, phiếu chuyển Chờ duyệt. Khi ghi sổ, hệ thống giảm tồn theo từng kho, tạo bút toán giá vốn và cập nhật số lượng đã xuất của chứng từ bán hàng. Tình trạng chuyển **Chưa xuất → Xuất một phần → Đã xuất đủ**, xem qua `issue_status` của chứng từ bán hàng và trong hộp chọn chứng từ. Nếu ghi sổ lỗi (thiếu tồn, kỳ khóa, …), phiếu vẫn mở, giữ trạng thái chưa ghi sổ và báo lỗi cụ thể.
- Chặn ở backend: không có quyền tạo/ghi sổ, chứng từ bán hàng không hợp lệ hoặc bị bỏ ghi sổ, hàng đã xuất đủ, thiếu/trùng số phiếu, thiếu ngày, thiếu hoặc sai kho xuất, phiếu không có dòng, số lượng ≤ 0 hoặc vượt số còn lại, khách hàng không khớp chứng từ bán hàng, thiếu tồn khi không cho xuất âm, kỳ kế toán khóa, tài khoản sai, ghi sổ lần hai. Ghi sổ kiểm tra lại số còn lại và tồn mới nhất (khóa chứng từ bán hàng), nên hai phiếu không thể cùng xuất vượt số lượng bán.
- Chứng từ bán hàng ở chế độ xuất kho sau không tự ghi giá vốn, nên không phát sinh giá vốn trùng. Không thể bỏ ghi sổ chứng từ bán hàng khi đã có phiếu xuất ghi sổ.
- Nhật ký (Audit Log) được ghi cho tạo, sửa, gửi duyệt, duyệt và ghi sổ.

API mới: `GET /api/v1/inventory/transactions/sale-sources/?company_id=…&search=&customer=&date_from=&date_to=&include_completed=true`.

## Thử trên giao diện

1. Đăng nhập `http://localhost:5173`, chọn doanh nghiệp **ABC**.
2. **Bán hàng → Chứng từ bán hàng → Thêm**: bỏ chọn **Kiêm phiếu xuất kho**, nhập khách hàng, hàng có theo dõi tồn (ví dụ `DT_IP15`, SL `3`), rồi lưu và ghi sổ. Kho của hàng đó phải còn tồn.
3. **Kho → Xuất kho → Thêm** → **Chọn chứng từ bán hàng** → tìm theo số chứng từ hoặc khách hàng → chọn dòng → **Đồng ý**.
4. Đổi SL thành `1` (xuất một phần), chọn kho, nhấn **Lưu**: phiếu ở trạng thái Chưa ghi sổ, tồn chưa giảm.
5. Mở lại phiếu, nhấn **Ghi sổ**: tồn giảm 1, có bút toán Nợ 632/Có 156. Mở lại hộp chọn chứng từ: chứng từ bán hàng ở trạng thái **Xuất một phần**, còn được xuất `2`.
6. Thử SL vượt số còn lại, SL `0`, bỏ trống kho, số phiếu trùng, hoặc xuất nhiều hơn tồn: form báo lỗi, không ghi sổ.

## Kiểm thử

- Backend: `docker compose exec -T backend python manage.py test sales inventory --keepdb` (195 test, gồm `test_sales_issue_uc_inv_03_sources_status_and_exceptions`).
- Giao diện (mock API): `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/inventory-sale-issue-mvp.spec.ts tests/inventory-other-issue-mvp.spec.ts`.

## Giới hạn

- Theo AF-09/BR-15: nếu lúc ghi sổ chưa xác định được giá vốn (giá trị tồn = 0), phiếu vẫn được ghi sổ để trừ số lượng, kèm cảnh báo "Chưa hoàn tất tính giá xuất kho". Hiện chưa có bước tính giá cuối kỳ để cập nhật lại giá vốn cho các dòng này.
- Số lượng xuất tính theo đơn vị tính trên chứng từ bán hàng; quy đổi về đơn vị tồn dùng hệ số đã khai báo của mặt hàng.
- **Địa điểm giao hàng** trên form cũ chưa lưu vào API.
