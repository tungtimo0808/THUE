# Audit frontend MISA — cập nhật 08/10/2026

Đã ghi nhận 245 tên báo cáo duy nhất từ các nhóm trong danh mục MISA (263 mục khi tính cả tên xuất hiện ở nhiều nhóm).

Frontend giữ 82 mục có màn hình riêng trước đó. 163 mục trước đây dùng bảng chung đã được nối vào cấu hình riêng theo tham số và tiêu đề cột ghi nhận trên MISA. 18 mục vẫn dùng bảng chung. Đây là số liệu phạm vi triển khai, không phải chứng nhận giao diện giống hoàn toàn.

213 cấu hình dạng bảng được tạo trong mã nguồn; một phần trùng các màn hình riêng nên không thay thế các màn hình đó. Có bộ chọn kỳ, ngày DD/MM/YYYY, bảng chọn đối tượng, tiêu đề nhiều tầng, tìm kiếm, ẩn cột và lưu tham số cục bộ. Dữ liệu minh họa chỉ ở frontend.

Kiểm tra: 13 bài kiểm tra logic đạt; TypeScript cho các mô-đun mới đạt; Vite build đạt. Lệnh npm run build toàn dự án vẫn có các lỗi TypeScript có sẵn từ trước.

Còn phải hoàn thiện: mẫu in riêng dưới đây; toàn bộ lựa chọn trong các combobox; cột biến đổi sau khi chọn kỳ/chi nhánh; mẫu in/xuất; audit sâu các màn hình đã có và các phân hệ ngoài Báo cáo. Mẫu in công nợ đã thử mở nhưng trình xem MISA hiện chưa hiển thị nội dung để đối chiếu.

## 18 mục còn dùng bảng chung

- Bán hàng: Tổng hợp xuất kho bán hàng
- Bán hàng: Phân tích công nợ phải thu theo tuổi nợ
- Bán hàng: Chi tiết công nợ phải thu theo mặt hàng (tỉnh)
- Bán hàng: Biên bản đối chiếu và xác nhận công nợ
- Bán hàng: Thông báo công nợ
- Bán hàng: Thông báo công nợ (Mẫu 2)
- Bán hàng: Giấy đề nghị thanh toán công nợ
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
