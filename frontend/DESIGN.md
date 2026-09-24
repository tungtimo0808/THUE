# Sổ Việt — giao diện kế toán và thuế

## Hướng thiết kế

Người dùng chính là kế toán doanh nghiệp, cần đọc số liệu, tìm chứng từ và biết việc cần xử lý. Điểm nhấn là thanh điều hướng navy cùng vùng làm việc sáng; không dùng hình trang trí trong màn hình nghiệp vụ.

- Navy `#142b49`: nhận diện và điều hướng.
- Blue `#2563eb`: hành động chính, dữ liệu doanh thu.
- Canvas `#f4f6fa`, surface `#ffffff`: vùng làm việc và bảng.
- Ink `#192b43`: chữ và số liệu.
- Teal `#087f6b`: trạng thái thành công, dòng tiền vào.
- Be Vietnam Pro, tự phục vụ qua npm: tiếng Việt rõ ràng, số tabular.
- Sidebar 232px; header 72px; nội dung căn trái; khoảng cách 8/12/16/24/32px.
- Dashboard: tổng quan → chỉ tiêu → dòng tiền + việc cần làm → chứng từ gần đây.
- Các phân hệ: tiêu đề → tab trong URL → bộ lọc → bảng → drawer chi tiết.

Đã đối chiếu với tài liệu: giữ ngữ cảnh doanh nghiệp/kỳ, navigation theo nhóm nghiệp vụ, quick action, bảng tìm kiếm/lọc, trạng thái rỗng và timeline. Không áp dụng gợi ý marketing hero/dark OLED của lần tìm skill đầu tiên vì không phù hợp với màn hình làm việc kế toán.

## Công nghệ

React + TypeScript + Vite, React Router, Recharts, Lucide, CSS tokens. Django tiếp tục chịu trách nhiệm xác thực, phân quyền và nghiệp vụ. Vite proxy `/api` về Django trong môi trường dev. Không cần SSR cho workspace nghiệp vụ nội bộ này.

## Phạm vi và dữ liệu

Đây là frontend tương tác chạy độc lập, dữ liệu mẫu và phiếu nháp được lưu localStorage theo doanh nghiệp. Chưa tích hợp API nghiệp vụ, không ghi sổ thật, không tính thuế/phân quyền ở client. Các module chưa có nghiệp vụ được ghi rõ là khung giao diện. Số tổng quan được tổng hợp từ các chứng từ mẫu trong kỳ; bộ lọc kỳ/doanh nghiệp áp dụng chung. Không chứa thông tin xác thực thật.

## Nguồn

- Tài liệu thiết kế frontend do người dùng cung cấp.
- https://vite.dev/guide/
- https://react.dev/learn/creating-a-react-app
- https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- Các skill frontend-design, web-design-guidelines, ui-ux-pro-max đã cài trong thư mục Codex cá nhân.
