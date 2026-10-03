export type MisaFlyoutItem = {
  label: string;
  path?: string;
  action?: "exchange_rate" | "ai" | "custom";
  badge?: string;
};

export type MisaFlyoutModule = {
  operationsTitle?: string;
  utilitiesTitle?: string;
  operations: MisaFlyoutItem[];
  utilities: MisaFlyoutItem[];
};

export const MISA_MODULE_FLYOUTS: Record<string, MisaFlyoutModule> = {
  cash: {
    operations: [
      { label: "Thu, chi tiền", path: "/cash/transactions" },
      { label: "Kiểm kê", path: "/cash/inventory" },
      { label: "Dự báo dòng tiền", path: "/cash/cashflow" },
    ],
    utilities: [],
  },
  bank: {
    operations: [
      { label: "Thu, chi tiền", path: "/bank/transactions" },
      { label: "Đối chiếu ngân hàng", path: "/bank/reconciliation" },
      { label: "Dự báo dòng tiền", path: "/bank/cashflow" },
      { label: "Ngân hàng điện tử", path: "/bank/ebanking" },
      { label: "Khế ước đi vay", path: "/bank/borrowings" },
    ],
    utilities: [
      { label: "Tính tỷ giá xuất quỹ", action: "exchange_rate" },
      { label: "Quy tắc hạch toán tự động", path: "/bank/rules" },
    ],
  },
  invoices: {
    operations: [
      { label: "Hóa đơn đầu ra", path: "/invoices/outgoing" },
      { label: "Hóa đơn đầu vào", path: "/invoices/incoming" },
      { label: "Hóa đơn cần xử lý", path: "/invoices/pending" },
      { label: "Sai sót, điều chỉnh", path: "/invoices/errors" },
      { label: "Tra cứu hóa đơn", path: "/invoices/lookup" },
    ],
    utilities: [
      { label: "Tự động lấy hóa đơn từ TCT", path: "/invoices/sync" },
      { label: "Kiểm tra tính hợp lệ", path: "/invoices/validate" },
      { label: "Bảng kê hóa đơn chưa hạch toán", path: "/invoices/unposted" },
    ],
  },
  purchases: {
    operations: [
      { label: "Đơn mua hàng", path: "/purchases/orders" },
      { label: "Hợp đồng mua", path: "/purchases/contracts" },
      { label: "Mua hàng hóa, dịch vụ", path: "/purchases/transactions" },
      { label: "Nhận hóa đơn", path: "/purchases/invoices" },
      { label: "Trả lại hàng mua", path: "/purchases/returns" },
      { label: "Giảm giá hàng mua", path: "/purchases/discounts" },
      { label: "Xử lý hóa đơn đầu vào", path: "/purchases/invoice-processing" },
      { label: "Đối chiếu công nợ", path: "/purchases/reconciliation" },
      { label: "Biểu đồ", path: "/purchases/chart" },
    ],
    utilities: [
      { label: "Đối trừ chứng từ", path: "/purchases/offset" },
      { label: "Đối trừ chứng từ nhiều đối tượng", path: "/purchases/multi-offset" },
      { label: "Bỏ đối trừ", path: "/purchases/un-offset" },
      { label: "Bỏ đối trừ chứng từ nhiều đối tượng", path: "/purchases/multi-un-offset" },
      { label: "Bù trừ công nợ", path: "/purchases/debt-clearing" },
      { label: "Nhà cung cấp", path: "/purchases/suppliers" },
      { label: "Hàng hóa, dịch vụ", path: "/purchases/inventory-items" },
    ],
  },
  sales: {
    operations: [
      { label: "Báo giá", path: "/sales/quotes" },
      { label: "Đơn đặt hàng", path: "/sales/orders" },
      { label: "Hợp đồng bán", path: "/sales/contracts" },
      { label: "Bán hàng hóa, dịch vụ", path: "/sales/transactions" },
      { label: "Hóa đơn", path: "/sales/invoices" },
      { label: "Tự động hạch toán HĐ", path: "/sales/auto-posting" },
      { label: "Trả lại hàng bán", path: "/sales/returns" },
      { label: "Giảm giá hàng bán", path: "/sales/discounts" },
      { label: "Công nợ", path: "/sales/receivables" },
      { label: "Đối chiếu công nợ", path: "/sales/reconciliation" },
      { label: "Biểu đồ", path: "/sales/chart" },
    ],
    utilities: [
      { label: "Lấy hóa đơn từ meInvoice", path: "/sales/meinvoice" },
      { label: "Đối trừ chứng từ", path: "/sales/offset" },
      { label: "Đối trừ chứng từ nhiều đối tượng", path: "/sales/multi-offset" },
      { label: "Bỏ đối trừ", path: "/sales/un-offset" },
      { label: "Bỏ đối trừ chứng từ nhiều đối tượng", path: "/sales/multi-un-offset" },
      { label: "Bù trừ công nợ", path: "/sales/debt-clearing" },
      { label: "Chính sách giá", path: "/sales/pricing-policy" },
      { label: "Tính giá bán", path: "/sales/calc-price" },
      { label: "Nhắc nợ tự động", path: "/sales/auto-reminder" },
      { label: "Kết nối sàn thương mại điện tử", path: "/sales/ecommerce-sync" },
      { label: "Khách hàng", path: "/sales/customers" },
      { label: "Hàng hóa, dịch vụ", path: "/sales/inventory-items" },
    ],
  },
  inventory: {
    operations: [
      { label: "Nhập kho", path: "/inventory/receipts" },
      { label: "Xuất kho", path: "/inventory/issues" },
      { label: "Chuyển kho", path: "/inventory/transfers" },
      { label: "Lệnh sản xuất", path: "/inventory/production-orders" },
      { label: "Lắp ráp, tháo dỡ", path: "/inventory/assembly" },
      { label: "Kiểm kê kho", path: "/inventory/stocktake" },
      { label: "Vật tư hàng hóa", path: "/inventory/items" },
    ],
    utilities: [
      { label: "Tính giá xuất kho tự động", path: "/inventory/calc-cost" },
      { label: "Cảnh báo tồn kho tối thiểu", path: "/inventory/alert-stock" },
      { label: "Bù trừ xuất nhập kho", path: "/inventory/offset" },
    ],
  },
  tools: {
    operationsTitle: "Công cụ dụng cụ",
    utilitiesTitle: "Chi phí trả trước",
    operations: [
      { label: "Khai báo CCDC đầu kỳ", path: "/tools/register?action=opening" },
      { label: "Ghi tăng", path: "/tools/increase" },
      { label: "Phân bổ chi phí", path: "/tools/allocation" },
      { label: "Điều chỉnh", path: "/tools/adjustment" },
      { label: "Điều chuyển", path: "/tools/transfer" },
      { label: "Ghi giảm", path: "/tools/decrease" },
      { label: "Kiểm kê", path: "/tools/stocktake" },
      { label: "Sổ theo dõi công cụ dụng cụ", path: "/tools/register" },
    ],
    utilities: [
      { label: "Khai báo chi phí trả trước đầu kỳ", path: "/tools/prepaid?action=opening" },
      { label: "Ghi tăng chi phí trả trước", path: "/tools/prepaid?action=new" },
      { label: "Phân bổ chi phí trả trước", path: "/tools/prepaid?subtab=allocation" },
      { label: "Ghi giảm chi phí trả trước", path: "/tools/prepaid?subtab=decrease" },
    ],
  },
  assets: {
    operationsTitle: "Nghiệp vụ",
    utilitiesTitle: "Tiện ích",
    operations: [
      { label: "Ghi tăng", path: "/assets/increase" },
      { label: "Tính khấu hao", path: "/assets/depreciation" },
      { label: "Đánh giá lại", path: "/assets/revaluation" },
      { label: "Điều chuyển", path: "/assets/transfer" },
      { label: "Ghi giảm", path: "/assets/decrease" },
      { label: "Chuyển TS thuê tài chính thành TS sở hữu", path: "/assets/leased-conversion" },
      { label: "Kiểm kê", path: "/assets/stocktake" },
      { label: "Sổ tài sản", path: "/assets/register" },
    ],
    utilities: [
      { label: "Khai báo TSCĐ đầu kỳ", path: "/assets/register?action=opening" },
    ],
  },
  payroll: {
    operationsTitle: "Nghiệp vụ",
    operations: [
      { label: "Chấm công", path: "/payroll/attendance" },
      { label: "Tổng hợp chấm công", path: "/payroll/attendance-summary" },
      { label: "Tính lương", path: "/payroll/calculation" },
      { label: "Hạch toán chi phí", path: "/payroll/posting" },
      { label: "Trả lương", path: "/payroll/process?action=pay-salary" },
      { label: "Nộp bảo hiểm", path: "/payroll/process?action=pay-insurance" },
      { label: "Khấu trừ thuế TNCN", path: "/payroll/tax-deduction" },
    ],
    utilitiesTitle: "Tiện ích",
    utilities: [
      { label: "Biểu thuế TNCN", path: "/payroll/process?action=tax-bracket" },
      { label: "Quy định lương, bảo hiểm, thuế TNCN", path: "/payroll/process?action=regulations" },
    ],
  },
  tax: {
    operationsTitle: "Nghiệp vụ",
    operations: [
      { label: "Khai thuế", path: "/tax/declarations" },
      { label: "Giấy nộp tiền", path: "/tax/payment-orders" },
    ],
    utilitiesTitle: "Tiện ích",
    utilities: [
      { label: "Khấu trừ thuế GTGT", path: "/tax/declarations?action=vat-deduction" },
      { label: "Nộp thuế", path: "/tax/payment-orders?action=pay" },
      { label: "Thiết lập thông tin cơ quan thuế, tổ chức, cá nhân cung cấp dịch vụ thuế", path: "/tax/declarations?action=tax-authority-config" },
    ],
  },
  cost: {
    operationsTitle: "",
    operations: [
      { label: "Sản xuất liên tục - Giản đơn", path: "/cost/continuous-simple" },
      { label: "Sản xuất liên tục - Hệ số, tỷ lệ", path: "/cost/continuous-coefficient" },
      { label: "Sản xuất liên tục - Phân bước", path: "/cost/continuous-step" },
      { label: "Công trình", path: "/cost/projects" },
      { label: "Đơn hàng", path: "/cost/orders" },
      { label: "Hợp đồng", path: "/cost/contracts" },
    ],
    utilities: [],
  },
  insurance: {
    operations: [
      { label: "Kê khai hồ sơ BHXH điện tử", path: "/payroll/process?action=pay-insurance" },
      { label: "Nộp tiền bảo hiểm", path: "/payroll/process?action=pay-insurance" },
      { label: "Đối chiếu dữ liệu với cơ quan BHXH", path: "/insurance/reconciliation" },
    ],
    utilities: [
      { label: "Quy định mức đóng BHXH, BHYT, BHTN", path: "/payroll/process?action=regulations" },
      { label: "Cổng thông tin BHXH Việt Nam", path: "https://gddt.baohiemxahoi.gov.vn" },
    ],
  },
  ledger: {
    operationsTitle: "Nghiệp vụ",
    operations: [
      { label: "Chứng từ nghiệp vụ khác", path: "/ledger/transactions" },
      { label: "Quyết toán tạm ứng", path: "/ledger/advance-settlement-request" },
      { label: "Kết chuyển lãi lỗ", path: "/ledger/closing-entry" },
      { label: "Báo cáo tài chính", path: "/ledger/statements" },
    ],
    utilitiesTitle: "Tiện ích",
    utilities: [
      { label: "Đánh giá lại tài khoản ngoại tệ", path: "/ledger/currency" },
      { label: "Phân bổ chi phí bán hàng, quản lý doanh nghiệp, khác", path: "/ledger/allocation" },
      { label: "Khóa sổ kỳ kế toán", path: "/ledger/process?action=lock" },
      { label: "Bỏ khóa sổ kỳ kế toán", path: "/ledger/process?action=unlock" },
      { label: "Khóa sổ/Bỏ khóa sổ theo Loại chứng từ", path: "/ledger/process?action=lock-by-type", badge: "Mới" },
    ],
  },
  budget: {
    operations: [
      { label: "Biểu đồ", path: "/budget/charts" },
      { label: "Kế hoạch ngân sách", path: "/budget/planning" },
    ],
    utilities: [
      { label: "Thiết lập ngày bắt đầu năm ngân sách", path: "/budget/planning?action=settings" },
    ],
  },
  analysis: {
    operations: [
      { label: "Tổng quan tài chính", path: "/analysis/overview" },
      { label: "Doanh thu và lợi nhuận", path: "/analysis/profitability" },
      { label: "Dòng tiền thực tế & dự kiến", path: "/analysis/cashflow" },
      { label: "Vốn lưu động & thanh khoản", path: "/analysis/working-capital" },
      { label: "Chỉ số tài chính ngành", path: "/analysis/ratios" },
    ],
    utilities: [
      { label: "Phân tích tài chính thông minh (AI)", path: "/analysis/ai-insight" },
      { label: "Dự báo tài chính đa kịch bản", path: "/analysis/scenario" },
    ],
  },
  reports: {
    operations: [
      { label: "Thư viện báo cáo", path: "/reports/library" },
      { label: "Báo cáo đã ghim", path: "/reports/favorites" },
      { label: "Báo cáo xem gần đây", path: "/reports/recent" },
      { label: "Mẫu báo cáo của tôi", path: "/reports/templates" },
    ],
    utilities: [
      { label: "Thiết kế mẫu báo cáo", path: "/reports/designer" },
      { label: "Xuất Excel chuẩn kế toán", path: "/reports/export-excel" },
    ],
  },
  directory: {
    operations: [
      { label: "Khách hàng, Nhà cung cấp", path: "/directory/partners" },
      { label: "Vật tư, Hàng hóa, Dịch vụ", path: "/directory/items" },
      { label: "Cơ cấu tổ chức & Nhân viên", path: "/directory/organization" },
      { label: "Hệ thống tài khoản kế toán", path: "/directory/accounting" },
      { label: "Tài khoản ngân hàng", path: "/directory/bank-accounts" },
    ],
    utilities: [
      { label: "Nhập khẩu danh mục từ Excel", path: "/directory/import" },
      { label: "Tra cứu MST từ Tổng cục Thuế", path: "/directory/tax-lookup" },
    ],
  },
  opening: {
    operations: [
      { label: "Số dư tài khoản", path: "/opening/accounts" },
      { label: "Công nợ khách hàng ban đầu", path: "/opening/receivables" },
      { label: "Công nợ nhà cung cấp ban đầu", path: "/opening/payables" },
      { label: "Tồn kho ban đầu", path: "/opening/inventory" },
      { label: "Số dư TSCĐ và CCDC", path: "/opening/assets" },
    ],
    utilities: [
      { label: "Nhập số dư từ Excel", path: "/opening/import-excel" },
      { label: "Kiểm tra cân đối Nợ - Có đầu kỳ", path: "/opening/balance-check" },
    ],
  },
  connections: {
    operations: [
      { label: "Tổng quan vay vốn số", path: "/connections/overview" },
      { label: "Hồ sơ vay doanh nghiệp", path: "/connections/applications" },
      { label: "Đề nghị tài trợ online", path: "/connections/offers" },
      { label: "Hợp đồng tín dụng", path: "/connections/contracts" },
      { label: "Lịch trả gốc và lãi", path: "/connections/repayment" },
    ],
    utilities: [
      { label: "So sánh lãi suất ngân hàng", path: "/connections/rates" },
      { label: "Kết nối vay vốn MISA Lend", path: "/connections/misa-lend" },
    ],
  },
};
