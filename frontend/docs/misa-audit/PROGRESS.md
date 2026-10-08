# Tiến độ frontend MISA — 08/10/2026, tiếp tục 18:50

Chưa hoàn tất toàn bộ audit. 263 mục báo cáo: 82 màn hình riêng cũ được giữ, 173 mục đã nối cấu hình riêng, 8 mục còn dùng bảng chung. Có 223 cấu hình (213 dạng bảng, 10 mẫu in). Số lượng không chứng minh mọi tùy chọn/giao diện đã giống hoàn toàn.

Mẫu in bổ sung: tuổi nợ phải thu (17 cột), tổng hợp xuất kho bán hàng, tồn kho theo nhóm VTHH, 02/TNDN mua không hóa đơn, S03b-DN Sổ cái. Đã đối chiếu tiêu đề theo PDF MISA. Tham số thuế ngày/tháng và ngày chốt được xử lý riêng; tài khoản Sổ cái lấy lựa chọn tham số. Dữ liệu frontend là dữ liệu mẫu.

Ngoài báo cáo: Đối chiếu ngân hàng offline; quy trình Đề nghị chi; bộ lọc và bảng Thu chi; 29 danh mục/10 nhóm, 8 form đã đọc và tab Khách hàng; Quản lý hóa đơn có quy trình 8 nút, form kết nối mô phỏng và hướng dẫn xử lý sai sót. Đã kiểm tra nhánh hóa đơn có mã CQT/đã gửi; các nhánh khác cần đối chiếu. Không kết nối hay gửi hóa đơn thật.

Phiên 18:50: Edge đọc được MISA 1909807807 và frontend kiểm tra 1909807822. Form số dư ngân hàng mặc định 1121, chặn cất khi chưa chọn ngân hàng. Tiền mặt/Tiền gửi không hiện chi tiết chứng từ cũ khi lọc trống; đã kiểm tra thủ công Tiền mặt. 20 bài kiểm tra logic đạt; TypeScript mô-đun báo cáo/hóa đơn đạt; Vite build đạt. npm run build toàn dự án còn lỗi TypeScript có sẵn.

Cần tiếp tục: 8 báo cáo bên dưới; các nhánh hướng dẫn hóa đơn, tiện ích và form con; toàn bộ Số dư ban đầu, Phân tích tài chính; 21 form danh mục chưa đọc trực tiếp, tab Nhà cung cấp/Nhân viên, nhóm cột Biểu thuế thu nhập; tùy chọn báo cáo và in/xuất. Bộ dữ liệu MISA hiện không có tài sản/đối tượng chi phí/đơn đặt hàng, nên một số mẫu chưa mở được. Không tạo dữ liệu MISA để mở báo cáo.

Giữ nguyên và không stage ba file người dùng: MisaDebtReconciliationReport.tsx, MisaPayablesAgingAnalysisReport.tsx, MisaSupplierPayablesLedgerReport.tsx. Chỉ frontend; không cất dữ liệu MISA.

## Còn bảng chung

- Báo cáo chi tiết tình hình thực hiện đơn đặt hàng
- S21 - DN: Sổ tài sản cố định
- Thẻ tài sản cố định
- S36-DN: Sổ chi phí sản xuất, kinh doanh
- S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí
- S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo khoản mục chi phí
- S36-DN: Sổ chi phí sản xuất, kinh doanh theo công trình
- S37-DN: Thẻ tính giá thành công trình - theo khoản mục chi phí
