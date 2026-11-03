// Report titles of the report centre, mapped to the backend report that serves them.
export type LiveReportTarget =
  | { area: string; code: string; bankCode?: string }
  | { kind: string; dimension: string; mode: string };

export const LIVE_REPORTS: Record<string, LiveReportTarget> = {
  "Biên bản đối chiếu và xác nhận công nợ": {
    "area": "debt",
    "code": "RPT-0096"
  },
  "Biên bản đối chiếu và xác nhận công nợ phải trả": {
    "area": "debt",
    "code": "RPT-0058"
  },
  "Báo cáo chi tiết giảm công cụ dụng cụ": {
    "area": "assets",
    "code": "RPT-0161"
  },
  "Báo cáo chi tiết lãi lỗ theo hợp đồng": {
    "area": "sales",
    "code": "RPT-0134"
  },
  "Báo cáo chi tiết lãi lỗ theo đơn hàng": {
    "area": "sales",
    "code": "RPT-0126"
  },
  "Báo cáo chi tiết tình hình thực hiện đơn đặt hàng": {
    "area": "sales",
    "code": "RPT-0125"
  },
  "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều chi nhánh": {
    "kind": "REVENUE_EXPENSE",
    "dimension": "BRANCH",
    "mode": "VALUE"
  },
  "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều kỳ": {
    "kind": "REVENUE_EXPENSE",
    "dimension": "MONTH",
    "mode": "VALUE"
  },
  "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo đơn vị": {
    "kind": "REVENUE_EXPENSE",
    "dimension": "BRANCH",
    "mode": "VALUE"
  },
  "Báo cáo ngày thanh toán theo khách hàng": {
    "area": "debt",
    "code": "RPT-0102"
  },
  "Báo cáo phân tích chi tiết chi phí theo nhiều chi nhánh": {
    "kind": "EXPENSE",
    "dimension": "BRANCH",
    "mode": "VALUE"
  },
  "Báo cáo phân tích chi tiết chi phí theo nhiều kỳ": {
    "kind": "EXPENSE",
    "dimension": "MONTH",
    "mode": "VALUE"
  },
  "Báo cáo phân tích chi tiết doanh thu theo nhiều chi nhánh": {
    "kind": "REVENUE",
    "dimension": "BRANCH",
    "mode": "VALUE"
  },
  "Báo cáo phân tích chi tiết doanh thu theo nhiều kỳ": {
    "kind": "REVENUE",
    "dimension": "MONTH",
    "mode": "VALUE"
  },
  "Báo cáo tiến độ sản xuất": {
    "area": "inventory",
    "code": "RPT-0151"
  },
  "Báo cáo tồn theo chứng từ nhập chưa chuyển kho": {
    "area": "inventory",
    "code": "RPT-0148"
  },
  "Báo cáo tổng hợp lãi lỗ theo hợp đồng": {
    "area": "sales",
    "code": "RPT-0132"
  },
  "Báo cáo tổng hợp lãi lỗ theo đơn hàng": {
    "area": "sales",
    "code": "RPT-0122"
  },
  "Báo cáo tổng hợp tình hình khế ước cho vay": {
    "area": "money",
    "code": "RPT-0045"
  },
  "Báo cáo tổng hợp tình hình khế ước vay": {
    "area": "money",
    "code": "RPT-0041"
  },
  "Báo cáo đối chiếu giá thành và giá trị nhập kho": {
    "area": "inventory",
    "code": "RPT-0156"
  },
  "Báo cáo đối chiếu kho và sổ cái": {
    "area": "inventory",
    "code": "RPT-0153"
  },
  "Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái": {
    "area": "assets",
    "code": "RPT-0166"
  },
  "Báo cáo đối chiếu sổ tài sản và sổ cái": {
    "area": "assets",
    "code": "RPT-0171"
  },
  "Bảng cân đối tài khoản phân tích theo thời gian": {
    "kind": "TRIAL_BALANCE",
    "dimension": "MONTH",
    "mode": "VALUE"
  },
  "Bảng cân đối tài khoản theo nhiều chi nhánh": {
    "kind": "TRIAL_BALANCE",
    "dimension": "BRANCH",
    "mode": "VALUE"
  },
  "Bảng kê chứng từ theo khế ước cho vay": {
    "area": "money",
    "code": "RPT-0046"
  },
  "Bảng kê chứng từ theo khế ước vay": {
    "area": "money",
    "code": "RPT-0043"
  },
  "Bảng kê số dư tiền theo ngày": {
    "area": "money",
    "code": "RPT-0032",
    "bankCode": "RPT-0035"
  },
  "Bảng tính khấu hao tài sản cố định theo năm": {
    "area": "assets",
    "code": "RPT-0170"
  },
  "Bảng tính phân bổ chi phí trả trước": {
    "area": "assets",
    "code": "RPT-0164"
  },
  "Bảng tính phân bổ công cụ dụng cụ": {
    "area": "assets",
    "code": "RPT-0158"
  },
  "Bảng tính phân bổ công cụ dụng cụ theo năm": {
    "area": "assets",
    "code": "RPT-0160"
  },
  "Chi tiết công nợ phải thu theo công trình": {
    "area": "debt",
    "code": "RPT-0140"
  },
  "Chi tiết công nợ phải thu theo hợp đồng bán": {
    "area": "debt",
    "code": "RPT-0131"
  },
  "Chi tiết công nợ phải thu theo mặt hàng": {
    "area": "debt",
    "code": "RPT-0097"
  },
  "Chi tiết công nợ phải thu theo mặt hàng (tỉnh)": {
    "area": "debt",
    "code": "RPT-0095"
  },
  "Chi tiết công nợ phải thu theo nhân viên": {
    "area": "debt",
    "code": "RPT-0116"
  },
  "Chi tiết công nợ phải thu theo đơn đặt hàng": {
    "area": "debt",
    "code": "RPT-0127"
  },
  "Chi tiết công nợ phải trả nhà cung cấp": {
    "area": "debt",
    "code": "RPT-0056"
  },
  "Chi tiết công nợ phải trả theo công trình": {
    "area": "debt",
    "code": "RPT-0071"
  },
  "Chi tiết công nợ phải trả theo hóa đơn": {
    "area": "debt",
    "code": "RPT-0054"
  },
  "Chi tiết công nợ phải trả theo hợp đồng mua": {
    "area": "debt",
    "code": "RPT-0069"
  },
  "Chi tiết công nợ phải trả theo mặt hàng": {
    "area": "debt",
    "code": "RPT-0055"
  },
  "Chi tiết công nợ phải trả theo mặt hàng (tĩnh)": {
    "area": "debt",
    "code": "RPT-0053"
  },
  "Chi tiết công nợ phải trả theo mặt hàng (tỉnh)": {
    "area": "debt",
    "code": "RPT-0053"
  },
  "Chi tiết công nợ phải trả theo nhân viên": {
    "area": "debt",
    "code": "RPT-0063"
  },
  "Chi tiết công nợ phải trả theo tuổi nợ": {
    "area": "debt",
    "code": "RPT-0057"
  },
  "Chi tiết công nợ phải trả theo đơn mua hàng": {
    "area": "debt",
    "code": "RPT-0065"
  },
  "Dòng tiền": {
    "area": "money",
    "code": "RPT-0031"
  },
  "Giấy đề nghị thanh toán công nợ": {
    "area": "debt",
    "code": "RPT-0107"
  },
  "Phân tích báo cáo kết quả hoạt động kinh doanh (so sánh tỷ lệ trên doanh thu)": {
    "kind": "REVENUE_EXPENSE",
    "dimension": "MONTH",
    "mode": "RATIO"
  },
  "Phân tích báo cáo lưu chuyển tiền tệ theo thời gian (PP trực tiếp)": {
    "kind": "CASH",
    "dimension": "MONTH",
    "mode": "VALUE"
  },
  "Phân tích công nợ phải trả theo tuổi nợ": {
    "area": "debt",
    "code": "RPT-0057"
  },
  "Phân tích cơ cấu tài sản, nguồn vốn trên Báo cáo tình hình tài chính": {
    "kind": "BALANCE_SHEET",
    "dimension": "MONTH",
    "mode": "RATIO"
  },
  "Phân tích cơ cấu tài sản, nguồn vốn trên bảng cân đối kế toán": {
    "kind": "BALANCE_SHEET",
    "dimension": "MONTH",
    "mode": "RATIO"
  },
  "Phân tích khả năng tạo tiền của từng hoạt động theo thời gian (PP trực tiếp)": {
    "kind": "CASH",
    "dimension": "MONTH",
    "mode": "VALUE"
  },
  "Phân tích tăng trưởng các chỉ tiêu Báo cáo tình hình tài chính": {
    "kind": "BALANCE_SHEET",
    "dimension": "MONTH",
    "mode": "GROWTH"
  },
  "Phân tích tăng trưởng các chỉ tiêu Báo cáo tình hình tài chính dạng tóm lược": {
    "kind": "BALANCE_SHEET",
    "dimension": "MONTH",
    "mode": "GROWTH"
  },
  "Phân tích tăng trưởng các chỉ tiêu bảng cân đối kế toán": {
    "kind": "BALANCE_SHEET",
    "dimension": "MONTH",
    "mode": "GROWTH"
  },
  "Phân tích tăng trưởng các chỉ tiêu bảng cân đối kế toán dạng tóm lược": {
    "kind": "BALANCE_SHEET",
    "dimension": "MONTH",
    "mode": "GROWTH"
  },
  "Phân tích tăng trưởng các chỉ tiêu kết quả hoạt động kinh doanh": {
    "kind": "REVENUE_EXPENSE",
    "dimension": "MONTH",
    "mode": "GROWTH"
  },
  "S03a1 - DN: Sổ nhật ký thu tiền": {
    "area": "money",
    "code": "RPT-0030",
    "bankCode": "RPT-0036"
  },
  "S03a1-DN: Sổ nhật ký thu tiền": {
    "area": "money",
    "code": "RPT-0030",
    "bankCode": "RPT-0036"
  },
  "S03a2 - DN: Sổ nhật ký chi tiền": {
    "area": "money",
    "code": "RPT-0033",
    "bankCode": "RPT-0038"
  },
  "S03a2-DN: Sổ nhật ký chi tiền": {
    "area": "money",
    "code": "RPT-0033",
    "bankCode": "RPT-0038"
  },
  "S21 - DN: Sổ tài sản cố định": {
    "area": "assets",
    "code": "RPT-0168"
  },
  "S21-DN: Sổ tài sản cố định": {
    "area": "assets",
    "code": "RPT-0168"
  },
  "S34 - DN: Sổ chi tiết tiền vay": {
    "area": "money",
    "code": "RPT-0042"
  },
  "S34-DN: Sổ chi tiết tiền vay": {
    "area": "money",
    "code": "RPT-0042"
  },
  "S35 - DN: Sổ chi tiết bán hàng": {
    "area": "sales",
    "code": "RPT-0078"
  },
  "Sổ chi tiết chuyển tiền nội bộ": {
    "area": "money",
    "code": "RPT-0040"
  },
  "Sổ chi tiết mua hàng": {
    "area": "purchase",
    "code": "RPT-0047"
  },
  "Sổ chi tiết theo dõi tình trạng bảo hành": {
    "area": "sales",
    "code": "RPT-0091"
  },
  "Sổ chuyển kho nội bộ": {
    "area": "inventory",
    "code": "RPT-0150"
  },
  "Sổ nhật ký mua hàng": {
    "area": "purchase",
    "code": "RPT-0051"
  },
  "Sổ theo dõi công cụ dụng cụ": {
    "area": "assets",
    "code": "RPT-0159"
  },
  "Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng": {
    "area": "assets",
    "code": "RPT-0162"
  },
  "Sổ tài sản cố định": {
    "area": "assets",
    "code": "RPT-0168"
  },
  "Thông báo công nợ": {
    "area": "debt",
    "code": "RPT-0100"
  },
  "Thông báo công nợ (Mẫu 2)": {
    "area": "debt",
    "code": "RPT-0104"
  },
  "Thẻ tài sản cố định": {
    "area": "assets",
    "code": "RPT-0169"
  },
  "Tình hình phân bổ chi phí trả trước": {
    "area": "assets",
    "code": "RPT-0163"
  },
  "Tình hình phân bổ chi phí trả trước theo năm": {
    "area": "assets",
    "code": "RPT-0165"
  },
  "Tình hình thực hiện hợp đồng bán": {
    "area": "sales",
    "code": "RPT-0128"
  },
  "Tình hình thực hiện hợp đồng mua": {
    "area": "purchase",
    "code": "RPT-0068"
  },
  "Tình hình thực hiện đơn mua hàng": {
    "area": "purchase",
    "code": "RPT-0064"
  },
  "Tình hình thực hiện đơn đặt hàng": {
    "area": "sales",
    "code": "RPT-0121"
  },
  "Tổng hợp bán hàng theo khách hàng": {
    "area": "sales",
    "code": "RPT-0077"
  },
  "Tổng hợp bán hàng theo mã thống kê và mặt hàng": {
    "area": "sales",
    "code": "RPT-0084"
  },
  "Tổng hợp bán hàng theo mặt hàng": {
    "area": "sales",
    "code": "RPT-0080"
  },
  "Tổng hợp bán hàng theo mặt hàng và khách hàng": {
    "area": "sales",
    "code": "RPT-0082"
  },
  "Tổng hợp bán hàng theo mặt hàng và nhân viên": {
    "area": "sales",
    "code": "RPT-0109"
  },
  "Tổng hợp bán hàng theo nhân viên": {
    "area": "sales",
    "code": "RPT-0114"
  },
  "Tổng hợp bán hàng theo nhân viên và khách hàng": {
    "area": "sales",
    "code": "RPT-0108"
  },
  "Tổng hợp bán hàng theo nhân viên, khách hàng và mặt hàng": {
    "area": "sales",
    "code": "RPT-0113"
  },
  "Tổng hợp bán hàng theo nhóm khách hàng": {
    "area": "sales",
    "code": "RPT-0081"
  },
  "Tổng hợp bán hàng theo nhóm mặt hàng": {
    "area": "sales",
    "code": "RPT-0089"
  },
  "Tổng hợp bán hàng theo sàn thương mại điện tử": {
    "area": "sales",
    "code": "RPT-0086"
  },
  "Tổng hợp bán hàng theo đơn vị kinh doanh": {
    "area": "sales",
    "code": "RPT-0117"
  },
  "Tổng hợp bán hàng theo đơn vị kinh doanh và mặt hàng": {
    "area": "sales",
    "code": "RPT-0118"
  },
  "Tổng hợp bán hàng theo địa phương": {
    "area": "sales",
    "code": "RPT-0090"
  },
  "Tổng hợp chi phí hợp đồng bán theo khoản mục chi phí": {
    "area": "sales",
    "code": "RPT-0135"
  },
  "Tổng hợp công nợ phải thu khách hàng": {
    "area": "debt",
    "code": "RPT-0092"
  },
  "Tổng hợp công nợ phải thu theo công trình": {
    "area": "debt",
    "code": "RPT-0141"
  },
  "Tổng hợp công nợ phải thu theo hợp đồng bán": {
    "area": "debt",
    "code": "RPT-0138"
  },
  "Tổng hợp công nợ phải thu theo nhân viên": {
    "area": "debt",
    "code": "RPT-0112"
  },
  "Tổng hợp công nợ phải thu theo nhân viên và khách hàng": {
    "area": "debt",
    "code": "RPT-0111"
  },
  "Tổng hợp công nợ phải thu theo nhóm khách hàng": {
    "area": "debt",
    "code": "RPT-0094"
  },
  "Tổng hợp công nợ phải thu theo đơn đặt hàng": {
    "area": "debt",
    "code": "RPT-0123"
  },
  "Tổng hợp công nợ phải trả nhà cung cấp": {
    "area": "debt",
    "code": "RPT-0052"
  },
  "Tổng hợp công nợ phải trả theo công trình": {
    "area": "debt",
    "code": "RPT-0072"
  },
  "Tổng hợp công nợ phải trả theo hợp đồng mua": {
    "area": "debt",
    "code": "RPT-0067"
  },
  "Tổng hợp công nợ phải trả theo nhân viên": {
    "area": "debt",
    "code": "RPT-0062"
  },
  "Tổng hợp công nợ phải trả theo đơn mua hàng": {
    "area": "debt",
    "code": "RPT-0066"
  },
  "Tổng hợp doanh số hợp đồng theo đơn vị": {
    "area": "sales",
    "code": "RPT-0136"
  },
  "Tổng hợp doanh số mặt hàng theo hợp đồng bán": {
    "area": "sales",
    "code": "RPT-0129"
  },
  "Tổng hợp lịch trả nợ khế ước vay": {
    "area": "money",
    "code": "RPT-0044"
  },
  "Tổng hợp mua hàng theo mặt hàng": {
    "area": "purchase",
    "code": "RPT-0048"
  },
  "Tổng hợp mua hàng theo mặt hàng và nhà cung cấp": {
    "area": "purchase",
    "code": "RPT-0049"
  },
  "Tổng hợp mua hàng theo mặt hàng và nhân viên": {
    "area": "purchase",
    "code": "RPT-0061"
  },
  "Tổng hợp mua hàng theo nhà cung cấp": {
    "area": "purchase",
    "code": "RPT-0050"
  },
  "Tổng hợp mua hàng theo nhà cung cấp và công trình": {
    "area": "purchase",
    "code": "RPT-0070"
  },
  "Tổng hợp thanh toán công nợ khách hàng": {
    "area": "debt",
    "code": "RPT-0103"
  },
  "Tổng hợp thanh toán công nợ khách hàng theo nhân viên": {
    "area": "debt",
    "code": "RPT-0115"
  },
  "Tổng hợp tình hình chi theo hợp đồng bán": {
    "area": "sales",
    "code": "RPT-0133"
  },
  "Tổng hợp tồn kho theo nhiều đơn vị tính": {
    "area": "inventory",
    "code": "RPT-0145"
  },
  "Tổng hợp tồn kho theo nhóm VTHH": {
    "area": "inventory",
    "code": "RPT-0147"
  },
  "Tổng hợp tồn trên nhiều kho (Dạng bảng chéo)": {
    "area": "inventory",
    "code": "RPT-0144"
  },
  "Tổng hợp xuất kho bán hàng": {
    "area": "sales",
    "code": "RPT-0085"
  },
  "Tổng hợp xuất kho theo lệnh sản xuất": {
    "area": "inventory",
    "code": "RPT-0152"
  },
  "Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng": {
    "area": "inventory",
    "code": "RPT-0154"
  },
  "Đối chiếu giá trị nhập, xuất kho của lệnh lắp ráp, tháo dỡ": {
    "area": "inventory",
    "code": "RPT-0157"
  },
  "Đối chiếu nhập xuất giữa kế toán và thủ kho": {
    "area": "inventory",
    "code": "RPT-0155"
  }
};
