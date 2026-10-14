// Sources: helpact.misa.vn/kb/so_chi_tiet_quy_tien_mat/,
// helpact.misa.vn/kb/html-35010000/ and helpact.misa.vn/kb/html_35040000/.
// These are configuration labels, not accounting records.
const generalExtraFields = Array.from({ length: 10 }, (_, index) => `Trường mở rộng ${index + 1}`);
const detailExtraFields = Array.from({ length: 10 }, (_, index) => `Trường mở rộng chi tiết ${index + 1}`);

export const CASH_BANK_REPORT_OPTIONAL_COLUMNS: Record<string, readonly string[]> = {
  "Sổ kế toán chi tiết quỹ tiền mặt": [
    "Ngày hạch toán", "Ngày chứng từ", "Số phiếu thu", "Số phiếu chi", "Diễn giải",
    "Tài khoản", "Tên tài khoản", "TK đối ứng", "Phát sinh Nợ", "Phát sinh Có", "Số tồn",
    "Người nhận/Người nộp", "Mã đối tượng", "Tên đối tượng", "Mã nhân viên", "Tên nhân viên",
    "Mã đơn vị", "Tên đơn vị", "Mã công trình", "Tên công trình", "Số chứng từ kèm theo",
    "Loại chứng từ", "Tỷ giá", "Mục thu/chi", "Tên mục thu/chi", "Mã khoản mục CP",
    "Tên khoản mục CP", "Mã thống kê", "Tên mã thống kê",
    ...generalExtraFields, ...detailExtraFields, "Chi nhánh",
  ],
  "Sổ tiền gửi ngân hàng": [
    "Tài khoản ngân hàng", "Ngày hạch toán", "Ngày chứng từ", "Số chứng từ",
    "Mã đối tượng trên thông tin chung", "Tên đối tượng trên thông tin chung", "Diễn giải",
    "TK đối ứng", "Thu", "Chi", "Tồn", "Mã đối tượng", "Tên đối tượng",
    "Mã nhân viên", "Tên nhân viên", "Khế ước đi vay", "Khế ước cho vay",
    "Mã khoản mục CP", "Tên khoản mục CP", "Mục thu/chi", "Tên mục thu/chi",
    "Mã công trình", "Tên công trình", "Hợp đồng bán", "Mã thống kê", "Tên thống kê",
    ...detailExtraFields, "Chi nhánh",
  ],
  "Bảng kê số dư ngân hàng": [
    "Tài khoản ngân hàng", "Tên ngân hàng", "Chủ tài khoản", "Số dư đầu kỳ",
    "Phát sinh Nợ", "Phát sinh Có", "Số dư cuối kỳ", "Chi nhánh",
  ],
  "Bảng kê số dư tiền theo ngày": [
    "Chi nhánh hạch toán", "Chỉ tiêu", "Số tài khoản hạch toán",
    "Số tài khoản ngân hàng", "Tên tài khoản ngân hàng", "Chi nhánh ngân hàng",
  ],
  "Sổ chi tiết chuyển tiền nội bộ": [
    "Ngày hạch toán", "Ngày chứng từ", "Số chứng từ", "Tài khoản đi", "Tên tài khoản đi",
    "Tài khoản đến", "Tên tài khoản đến", "Lý do chuyển", "Diễn giải", "TK Nợ", "TK Có",
    "Số tiền", "Mã thống kê", "Hợp đồng mua", "Hợp đồng bán", "Đơn đặt hàng", "Đơn mua hàng",
    "Công trình", "Khoản mục chi phí", "Mục thu/chi", "Tên mục Thu/chi", "Đối tượng THCP",
    "Chi phí không hợp lý", "Đơn vị", ...generalExtraFields,
  ],
};
