# Sổ Việt — giao diện kế toán và thuế

## Hướng thiết kế

Người dùng chính là kế toán doanh nghiệp, cần đọc số liệu, tìm chứng từ và biết việc cần xử lý. Điểm nhấn là thanh điều hướng xanh rêu cùng vùng làm việc kem đào; không dùng hình trang trí trong màn hình nghiệp vụ.

- Moss `#606C38`: nhận diện, điều hướng và hành động chính.
- Peach cream `#FFE8D6`: nền workspace và vùng phân tách.
- Surface `#FFFAF6`: bảng, form và lớp nội dung chính.
- Ink `#2F3423`: chữ và số liệu; các sắc olive đậm/nhạt dùng cho trạng thái và hover.
- Be Vietnam Pro, tự phục vụ qua npm: tiếng Việt rõ ràng, số tabular.
- Sidebar 182px; header 46px ở desktop; nội dung căn trái; khoảng cách theo nhịp 4/8/12/16/24px.
- Dashboard: tổng quan → chỉ tiêu → dòng tiền + việc cần làm → chứng từ gần đây.
- Các phân hệ: tên phân hệ/quick menu → tab trong URL → KPI/bộ lọc → bảng → quick detail → hồ sơ đầy đủ.
- Màn hình trọng điểm: `Kho → Lệnh sản xuất`, `Mua hàng → Đơn mua hàng`, `Mua hàng → Xử lý hóa đơn đầu vào`, trung tâm báo cáo, danh mục và số dư ban đầu.

Đã đối chiếu với tài liệu: giữ ngữ cảnh doanh nghiệp/kỳ, navigation theo nhóm nghiệp vụ, quick action, bảng tìm kiếm/lọc, trạng thái rỗng và timeline. Không áp dụng gợi ý marketing hero/dark OLED của lần tìm skill đầu tiên vì không phù hợp với màn hình làm việc kế toán.

## Công nghệ

React + TypeScript + Vite, React Router, Recharts, Lucide, CSS tokens. Django tiếp tục chịu trách nhiệm xác thực, phân quyền và nghiệp vụ. Vite proxy `/api` về Django trong môi trường dev. Không cần SSR cho workspace nghiệp vụ nội bộ này.

## Phạm vi và dữ liệu

Đây là frontend tương tác chạy độc lập, dữ liệu mẫu và phiếu nháp được lưu localStorage theo doanh nghiệp. Chưa tích hợp API nghiệp vụ, không ghi sổ thật, không tính thuế/phân quyền ở client. Các module đều có workspace cấu hình để minh họa luồng danh sách; chỉ các màn hình trọng điểm có dữ liệu và hồ sơ chuyên biệt. Số tổng quan được tổng hợp từ các chứng từ mẫu trong kỳ; bộ lọc kỳ/doanh nghiệp áp dụng chung. Không chứa thông tin xác thực thật.

## Nguồn

- Tài liệu thiết kế frontend do người dùng cung cấp.
- https://vite.dev/guide/
- https://react.dev/learn/creating-a-react-app
- https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- Các skill frontend-design, web-design-guidelines, ui-ux-pro-max đã cài trong thư mục Codex cá nhân.
