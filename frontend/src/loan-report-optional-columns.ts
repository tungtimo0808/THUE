// Configuration fields documented at helpact.misa.vn/kb/html_35040000/.
const loanSummaryColumns = (direction: "vay" | "cho vay"): readonly string[] => {
  const action = direction === "vay" ? "trả" : "thu";
  return [
    `Khế ước ${direction}`, "Số HĐ tín dụng", "Mục đích vay", "Mã đối tượng", "Tên đối tượng",
    "Ngày giải ngân", "Ngày đáo hạn", "Lãi suất (%)", "Tài khoản", "Giá trị khoản vay",
    "Giá trị giải ngân", "Dư nợ gốc đầu kỳ", `Trong kỳ đã ${action} gốc`, `Lũy kế đã ${action} gốc`,
    "Dư nợ gốc cuối kỳ", `Trong kỳ đã ${action} lãi`, `Lũy kế đã ${action} lãi`, "Chi nhánh",
  ];
};
const loanVoucherColumns = (direction: "vay" | "cho vay"): readonly string[] => {
  const action = direction === "vay" ? "trả" : "thu";
  return [
    "Hợp đồng tín dụng", `Số khế ước ${direction}`, "Mã đối tượng", "Tên đối tượng",
    "Ngày giải ngân", "Ngày đáo hạn", "Lãi suất (%)", "Ngày hạch toán", "Ngày chứng từ",
    "Số chứng từ", "Diễn giải", "Đã giải ngân", `Nợ gốc đã ${action}`, `Lãi đã ${action}`,
    "Mã công trình", "Tên công trình", "Đơn đặt hàng", "Hợp đồng mua", "Hợp đồng bán", "Chi nhánh",
  ];
};
export const LOAN_REPORT_OPTIONAL_COLUMNS: Record<string, readonly string[]> = {
  "Báo cáo tổng hợp tình hình khế ước vay": loanSummaryColumns("vay"),
  "Báo cáo tổng hợp tình hình khế ước cho vay": loanSummaryColumns("cho vay"),
  "Bảng kê chứng từ theo khế ước vay": loanVoucherColumns("vay"),
  "Bảng kê chứng từ theo khế ước cho vay": loanVoucherColumns("cho vay"),
  "Tổng hợp lịch trả nợ khế ước vay": [
    "Số khế ước đi vay", "Hợp đồng tín dụng", "Đối tượng", "Tên đối tượng",
    "Giá trị khoản vay", "Lãi suất (%)", "Thời hạn vay",
  ],
};
