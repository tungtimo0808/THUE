# Sổ Việt — giao diện kế toán và thuế

## Hướng thiết kế

Người dùng chính là kế toán doanh nghiệp, cần đọc số liệu, tìm chứng từ và biết việc cần xử lý. Giao diện xanh dương – trắng, bảng/lưới dữ liệu dùng tông xanh lá nhạt kiểu MISA; gọn, ít trang trí; không dùng hình trang trí trong màn hình nghiệp vụ.

Token màu khai báo tại `src/index.css` (`:root`). Dùng biến, không mã cứng màu mới trong TSX/CSS.

- Brand `--brand #2f78a8` (hover `--brand-hover`, nền nhạt `--brand-soft`, viền `--brand-border`, chữ đậm `--brand-ink`): nhận diện, điều hướng, nút chính, trạng thái hover/đang chọn/focus.
- Nền `--canvas #f8fafc`, bề mặt `--surface #ffffff`, chữ `--ink #1e293b`, chữ phụ `--muted #64748b`, viền `--border #e2e8f0`.
- Trạng thái: `--success`, `--warning`, `--danger` cùng bản `-soft`.
- Bảng/lưới: header xanh lá nhạt (`#eaf6ee`, báo cáo `#e2f0d9`), dòng đang chọn/hover `#f0fdf4`.
- Chữ phụ trên nền sáng tối thiểu `#64748b` (≈4.8:1); không dùng `#94a3b8`/`#cbd5e1` cho chữ trên nền trắng. Cỡ chữ tối thiểu 10px trên màn hình (11px cho nhãn trạng thái).
- Focus bàn phím: viền 2px `--brand`, không tắt `outline` khi không có chỉ báo thay thế.
- Phản hồi: dùng `showNotice()` / `showPendingFeature()` trong `src/global-popup.tsx` (toast không chặn), không dùng `alert()`. Chức năng chưa có backend phải nói rõ "chưa tích hợp", không giả lập kết quả.
- Font Roboto (tự phục vụ qua `@fontsource/roboto`), số tabular cho cột tiền.
- Sidebar 182px; header 46px ở desktop; nội dung căn trái; khoảng cách theo nhịp 4/8/12/16/24px.
- Dashboard: tổng quan → chỉ tiêu → dòng tiền + việc cần làm → chứng từ gần đây.
- Các phân hệ: tên phân hệ/quick menu → tab trong URL → KPI/bộ lọc → bảng → quick detail → hồ sơ đầy đủ.
- Cấu trúc V5: Sidebar module (cấp 1) → Module tab (cấp 2) → Inner tab (cấp 3) → Document tab (cấp 4). Flyout sidebar dùng chung cùng một cây config với thanh tab và deep link, tránh lệch cấp hoặc làm phẳng action thành tab.
- Màn hình trọng điểm: `Kho → Lệnh sản xuất`, `Mua hàng → Đơn mua hàng`, `Mua hàng → Xử lý hóa đơn đầu vào`, trung tâm báo cáo, danh mục và số dư ban đầu.

Đã đối chiếu với tài liệu: giữ ngữ cảnh doanh nghiệp/kỳ, navigation theo nhóm nghiệp vụ, quick action, bảng tìm kiếm/lọc, trạng thái rỗng và timeline. Không áp dụng gợi ý marketing hero/dark OLED của lần tìm skill đầu tiên vì không phù hợp với màn hình làm việc kế toán.

## Công nghệ

React + TypeScript + Vite, React Router, Recharts, Lucide, CSS tokens. Django tiếp tục chịu trách nhiệm xác thực, phân quyền và nghiệp vụ. Vite proxy `/api` về Django trong môi trường dev. Không cần SSR cho workspace nghiệp vụ nội bộ này.

## Phạm vi và dữ liệu

Frontend gọi API Django qua lớp chung (`live-api.ts`, `misa-api-writes.ts`); xác thực, phân quyền, tính thuế và ghi sổ do backend xử lý. Ẩn nút theo quyền chỉ là trải nghiệm người dùng. Một số màn hình cũ vẫn còn phần chưa nối API — các nút đó phải ghi rõ "chưa tích hợp". Không chứa thông tin xác thực thật.

## Nguồn

- Tài liệu thiết kế frontend do người dùng cung cấp.
- https://vite.dev/guide/
- https://react.dev/learn/creating-a-react-app
- https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- Các skill frontend-design, web-design-guidelines, ui-ux-pro-max đã cài trong thư mục Codex cá nhân.
