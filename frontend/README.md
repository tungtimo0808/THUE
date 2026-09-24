# Sổ Việt — Frontend kế toán & thuế

React + TypeScript + Vite, React Router, Recharts, Lucide và font Be Vietnam Pro tự phục vụ. Backend Django hiện có được giữ nguyên. Lựa chọn SPA phù hợp với workspace nội bộ và backend REST đã có; chưa cần thêm máy chủ SSR.

## Chạy giao diện

Yêu cầu Node.js 22.12+ hoặc 24 LTS.

```powershell
cd D:\THUẾ\FRONTEND
npm install
npm run dev
```

Mở URL Vite in ra trong terminal, thường là http://127.0.0.1:5173. Giao diện mẫu chạy độc lập, không cần chạy Django. Nếu PowerShell chặn `npm.ps1`, thay `npm` bằng `npm.cmd`. Khi phát triển API, Vite proxy `/api` tới `http://127.0.0.1:8000`.

## Đã triển khai

- Tổng quan: chỉ tiêu, biểu đồ dòng tiền, việc chờ duyệt, chứng từ gần đây.
- Khung điều hướng responsive, sidebar thu gọn, doanh nghiệp và kỳ kế toán trong URL.
- App Shell và Module Shell theo đặc tả ERP: ngữ cảnh doanh nghiệp/dữ liệu/chi nhánh/kỳ, ba chế độ Kế toán–Thủ kho–Thủ quỹ, sidebar phân hệ, quick-create và tab có thể cấu hình.
- Cây điều hướng V5 phân biệt Module tab → Inner tab → Document tab; rê chuột hoặc focus bàn phím vào phân hệ sẽ mở flyout các mục con.
- CCDC, TSCĐ, Tiền lương, Thuế, Giá thành và Tổng hợp đã được audit lại cấp tab; action trong Quy trình không còn bị làm phẳng thành tab ngang.
- Tìm kiếm thông minh theo nhóm chứng từ, hàng hóa/dịch vụ và danh mục; hỗ trợ Ctrl+K.
- Kho → Lệnh sản xuất: tìm kiếm, lọc trạng thái, chọn hàng loạt, phân trang, trạng thái lệnh và quick detail nguyên vật liệu.
- Mua hàng → Đơn mua hàng: KPI, bộ lọc, bulk action, quick detail và hồ sơ đầy đủ gồm dòng hàng, tổng tiền, chứng từ liên quan, tệp đính kèm và lịch sử.
- Xử lý hóa đơn đầu vào: inbox, xem trước XML/PDF, kiểm tra hợp lệ, liên kết hoặc lập chứng từ mua hàng dạng nháp.
- Tất cả tab của tiền, mua/bán, hóa đơn, kho, CCDC, tài sản, lương, thuế, giá thành, tổng hợp, ngân sách, phân tích và vay vốn đều có workspace dữ liệu mẫu thay cho placeholder.
- Trung tâm báo cáo, danh mục phân nhóm và khai báo số dư ban đầu có màn hình chuyên biệt.
- Form tạo nháp: đối tượng, ngày, diễn giải, thêm/sao chép/xóa dòng và tính tổng số tiền; lưu trên trình duyệt.
- Chi tiết chứng từ, lịch sử nghiệp vụ minh họa, chuyển nháp sang chờ duyệt thử.
- Thuế: tổng quan GTGT/TNCN/TNDN, danh mục hồ sơ, liên kết đến dữ liệu nguồn; không tính hoặc gửi thuế.
- Báo cáo tổng hợp chứng từ theo loại/trạng thái, xuất CSV có BOM cho tiếng Việt và chống công thức từ nội dung nhập.
- Bàn phím, focus, native dialog, bảng thay thế biểu đồ, reduced motion, trạng thái rỗng và lỗi lưu trữ.

## Giới hạn cần biết

**Đây là frontend tương tác với dữ liệu mẫu, chưa phải hệ thống kế toán production.**

- Dữ liệu minh họa tháng 4–9/2026 cho hai doanh nghiệp; chọn tháng 9, tháng 8 hoặc cả năm.
- Các workspace ngoài màn hình trọng điểm dùng mẫu danh sách cấu hình chung; dữ liệu, quy tắc phê duyệt và phân quyền vẫn chỉ là minh họa.
- Không xác thực hoặc phân quyền thật, không gọi API nghiệp vụ, không hạch toán, không phê duyệt thật, không ký/nộp thuế.
- Các nút ghi sổ, phê duyệt, liên kết, lập chứng từ, in và xuất dữ liệu chỉ mô phỏng phản hồi frontend; không tạo giao dịch kế toán thật.
- Dữ liệu nháp dùng localStorage với khóa `soviet-demo-documents-v1`; không dùng cho dữ liệu thật/nhạy cảm. Xóa khóa này để về dữ liệu mẫu ban đầu. Các doanh nghiệp chỉ được phân tách để minh họa, không phải ranh giới bảo mật.
- Trạng thái và timeline của dữ liệu mẫu chỉ để trình bày, không phải audit log.

## Kiểm tra

```powershell
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

Nếu đã cài Chrome và không tải được Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Kiểm thử bao gồm app shell, màu thương hiệu, tab/công ty/kỳ, deep link, flyout khi hover/focus, phân cấp tab V5, quick-create, tìm kiếm thông minh, chế độ làm việc, đơn mua hàng, hóa đơn đầu vào, báo cáo, danh mục, số dư, lệnh sản xuất, lưu nháp nhiều dòng, lỗi lưu trữ, mobile và accessibility bằng axe.

`npm run format` để định dạng mã. `npm run build` tạo thư mục `dist/`; khi triển khai SPA cần cấu hình máy chủ trả `index.html` cho route frontend và giữ `/api` riêng.

Thiết kế và nguồn tham khảo: [DESIGN.md](./DESIGN.md).
