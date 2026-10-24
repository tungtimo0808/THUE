# UC-INV-11 – Điều chỉnh giá trị tồn kho do giảm giá hàng mua

## Đã nối

- Dùng form **Mua hàng → Quy trình → Giảm giá hàng mua** đang có. Trường chứng từ mua hàng nguồn ở đầu form nay chọn được phiếu mua đã ghi sổ và tự điền nhà cung cấp, mặt hàng, kho, tài khoản cùng thuế suất từ nguồn.
- **Cất** tạo chứng từ `DRAFT`; **Cất và In** lưu cùng trạng thái rồi mở bản in chứng từ nháp. Danh sách **Giảm giá hàng mua** có thao tác **Gửi duyệt** rồi **Ghi sổ** theo trạng thái và quyền hiện có.
- Khi chọn **Giảm giá trị hàng nhập kho**, ghi sổ tạo phát sinh giá trị kho với `quantity_delta=0`, giảm giá trị tồn và đơn giá bình quân, giảm công nợ và ghi sổ cái trong cùng một giao dịch. Bỏ ghi sổ hoàn lại giá trị tồn, công nợ và sổ cái.
- Kiểm tra chứng từ nguồn, mặt hàng, thuế suất, tài khoản, giá trị giảm lũy kế, kỳ kế toán/kỳ kho và số lượng còn tồn. Báo cáo nhập xuất tồn thể hiện giá trị điều chỉnh mà số lượng không đổi.

## Tự kiểm tra trên giao diện

1. Chạy `cd backend; ..\venv\Scripts\python.exe manage.py migrate; ..\venv\Scripts\python.exe manage.py runserver` và ở cửa sổ khác chạy `cd frontend; npm run dev`.
2. Đăng nhập tài khoản demo `creator@example.com` / `password-123`, chọn công ty **ABC**.
3. Nếu chưa có nguồn, tại **Mua hàng** lập và ghi sổ một chứng từ **mua qua kho** cho mặt hàng theo dõi tồn, chẳng hạn 2 cái × 100, không có thuế để thử nhanh. Chọn kỳ kế toán đang mở, kho đang hoạt động; chưa xuất mặt hàng đó sau lần nhập này.
4. Mở **Mua hàng → Quy trình → Giảm giá hàng mua**. Chọn chứng từ mua nguồn; nhà cung cấp, mặt hàng, kho, tài khoản và thuế suất được điền từ nguồn. Chọn **Giảm trừ công nợ**, giữ chọn **Giảm giá trị hàng nhập kho**, nhập số lượng 2, đơn giá giảm 25, ngày hạch toán thuộc kỳ mở, số chứng từ chưa dùng; bấm **Cất**.
5. Trong danh sách **Giảm giá hàng mua**, chứng từ có trạng thái **Nháp**. Mở **Kho → Báo cáo nhập xuất tồn** và ghi lại số lượng cùng giá trị. Bấm **Gửi duyệt**, sau đó **Ghi sổ** ở dòng chứng từ. Mở lại báo cáo: số lượng không đổi, giá trị tồn giảm 50; công nợ nhà cung cấp giảm 50.
6. Kiểm tra phản ví dụ: lập giảm giá vượt giá trị chứng từ nguồn, hoặc đã có xuất kho sau phiếu nhập. API từ chối ghi sổ và không tạo phát sinh kho dở dang.

## Phạm vi MVP

Chỉ tự động điều chỉnh khi **toàn bộ hàng của phiếu nhập nguồn còn trong kho**, dùng **bình quân liên hoàn** và chọn **Giảm trừ công nợ**. Hàng đã xuất, FIFO/bình quân cuối kỳ, thu tiền mặt, phân bổ vào giá vốn và hóa đơn điều chỉnh tự động cần quy trình riêng. Bản in hiện là chứng từ nháp tại thời điểm Cất, chưa có mẫu chứng từ đã ghi sổ. Hệ thống trả lỗi khi không đủ căn cứ, không tự đưa toàn bộ giảm giá vào tồn kho.

Kiểm thử: `manage.py test purchases.test_purchase_discount --keepdb --noinput` (8 ca), PowerShell `$env:PLAYWRIGHT_CHANNEL='chrome'; npx playwright test tests/purchase-inventory-value-discount-mvp.spec.ts` (1 ca), `npx vite build`, `manage.py check` và `makemigrations --check --dry-run` đều qua. SQLite chỉ có hai cảnh báo cũ về `nulls_distinct`.
