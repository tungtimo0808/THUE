# Tiến độ frontend MISA — 08/10/2026

Chưa hoàn tất toàn bộ audit. 263 mục báo cáo trong danh mục, 82 mục màn hình riêng được giữ lại, 168 mục từ bảng chung đã được nối vào cấu hình riêng và 13 mục vẫn dùng bảng chung. Có 218 cấu hình, gồm 213 dạng bảng và 5 mẫu in. Số lượng cấu hình không chứng minh giao diện và mọi thao tác đã giống hoàn toàn.

Ngoài Báo cáo: đã bổ sung Đối chiếu ngân hàng offline, trang quy trình Đề nghị chi tiền cho Tiền mặt/Tiền gửi, cột và chọn dòng/tổng/phân trang Thu chi tiền, bộ lọc kỳ hoạt động. Danh mục mới có 29 mục theo 10 nhóm, bảng theo các tiêu đề cột đã ghi nhận, 8 bộ trường form đã đọc, các tab Khách hàng và bảng tài khoản nhiều dòng. Màn hình Danh mục cũ vẫn có ở Danh sách hiện có. Các form còn lại dùng trường suy ra từ cột và cần audit tiếp; Biểu tính thuế thu nhập cần kiểm tra tiêu đề hai tầng.

Đã kiểm tra thủ công: chọn dòng Thu chi; đối chiếu ngân hàng về chênh lệch 0; quy trình đề nghị chi; thêm và cất Khách hàng có tài khoản ngân hàng; mẫu Thông báo công nợ đầu tiên. Các mẫu in mới hơn cần kiểm tra thêm trên frontend.

Kiểm tra gần nhất: 18 bài kiểm tra logic đạt, TypeScript mô-đun mới đạt, Vite build đạt. npm run build toàn dự án còn lỗi TypeScript có sẵn trước tác vụ.

Edge đọc được tab MISA 1909807807; tab frontend 1909807529 vẫn báo Debugger unattached. Không dùng phương thức điều khiển khác để vượt qua hạn chế này.

Công việc tiếp: hoàn thiện 13 báo cáo dưới đây; audit sâu các tùy chọn của báo cáo đã có; các form/tab con của toàn bộ phân hệ; Quản lý hóa đơn, Số dư ban đầu và Phân tích tài chính. Chỉ sửa frontend, không cất hoặc sửa dữ liệu thực trên MISA. Ba file người dùng sửa trước tác vụ phải giữ nguyên và không stage.

## Báo cáo còn dùng bảng chung

- Bán hàng: Tổng hợp xuất kho bán hàng
- Bán hàng: Phân tích công nợ phải thu theo tuổi nợ
- Bán hàng: Báo cáo chi tiết tình hình thực hiện đơn đặt hàng
- Kho: Tổng hợp tồn kho theo nhóm VTHH
- Tài sản cố định: S21 - DN: Sổ tài sản cố định
- Tài sản cố định: Thẻ tài sản cố định
- Thuế: 02/TNDN: Bảng kê thu mua hàng hóa, dịch vụ mua vào không có hóa đơn
- Giá thành: S36-DN: Sổ chi phí sản xuất, kinh doanh
- Giá thành: S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí
- Giá thành: S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo khoản mục chi phí
- Giá thành: S36-DN: Sổ chi phí sản xuất, kinh doanh theo công trình
- Giá thành: S37-DN: Thẻ tính giá thành công trình - theo khoản mục chi phí
- Tổng hợp: S03b-DN: Sổ cái (Hình thức Nhật ký chung)
