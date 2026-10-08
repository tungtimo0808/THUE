import React, { useState, useMemo } from "react";
import {
  Search,
  Star,
  LineChart,
  Eye,
  Layers,
  X,
  Printer,
  Download,
  Calendar,
  Clock,
  Sparkles,
  Bot,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";
import "./misa-reports.css";
import MisaTrialBalanceManagementReport from "./MisaTrialBalanceManagementReport";
import MisaStateObligationsReport from "./MisaStateObligationsReport";
import MisaFinancialPositionReport from "./MisaFinancialPositionReport";
import MisaBusinessResultReport from "./MisaBusinessResultReport";
import MisaCashFlowDirectReport from "./MisaCashFlowDirectReport";
import MisaCashFlowIndirectReport from "./MisaCashFlowIndirectReport";
import MisaFinancialNotesReport from "./MisaFinancialNotesReport";
import MisaInterimFinancialPositionReport from "./MisaInterimFinancialPositionReport";
import MisaInterimBusinessResultReport from "./MisaInterimBusinessResultReport";
import MisaInterimCashFlowDirectReport from "./MisaInterimCashFlowDirectReport";
import MisaInterimCashFlowIndirectReport from "./MisaInterimCashFlowIndirectReport";
import MisaMultiBranchTrialBalanceReport from "./MisaMultiBranchTrialBalanceReport";
import MisaMultiBranchRevenueExpenseReport from "./MisaMultiBranchRevenueExpenseReport";
import MisaMultiBranchDetailedRevenueReport from "./MisaMultiBranchDetailedRevenueReport";
import MisaMultiBranchBalanceSheetReport from "./MisaMultiBranchBalanceSheetReport";
import MisaMultiBranchBusinessResultReport from "./MisaMultiBranchBusinessResultReport";
import MisaMultiBranchDetailedExpenseReport from "./MisaMultiBranchDetailedExpenseReport";
import MisaTimePeriodicTrialBalanceReport from "./MisaTimePeriodicTrialBalanceReport";
import MisaIncomeRatioAnalysisReport from "./MisaIncomeRatioAnalysisReport";
import MisaMultiPeriodDetailedRevenueReport from "./MisaMultiPeriodDetailedRevenueReport";
import MisaBalanceSheetGrowthAnalysisReport from "./MisaBalanceSheetGrowthAnalysisReport";
import MisaMultiPeriodDetailedExpenseReport from "./MisaMultiPeriodDetailedExpenseReport";
import MisaAssetCapitalStructureAnalysisReport from "./MisaAssetCapitalStructureAnalysisReport";
import MisaMultiPeriodRevenueExpenseReport from "./MisaMultiPeriodRevenueExpenseReport";
import MisaCondensedBalanceSheetGrowthReport from "./MisaCondensedBalanceSheetGrowthReport";
import MisaMultiUnitRevenueExpenseReport from "./MisaMultiUnitRevenueExpenseReport";
import MisaCashGenerationAnalysisReport from "./MisaCashGenerationAnalysisReport";
import MisaBusinessResultGrowthAnalysisReport from "./MisaBusinessResultGrowthAnalysisReport";
import MisaDirectCashFlowTimePeriodicReport from "./MisaDirectCashFlowTimePeriodicReport";
import MisaCashReceiptJournalReport from "./MisaCashReceiptJournalReport";
import MisaCashMovementReport from "./MisaCashMovementReport";
import MisaDailyCashBalanceReport from "./MisaDailyCashBalanceReport";
import MisaCashDisbursementJournalReport from "./MisaCashDisbursementJournalReport";
import MisaDetailedCashLedgerReport from "./MisaDetailedCashLedgerReport";
import MisaBankDepositLedgerReport from "./MisaBankDepositLedgerReport";
import MisaBankBalanceStatementReport from "./MisaBankBalanceStatementReport";
import MisaInternalFundTransferDetailReport from "./MisaInternalFundTransferDetailReport";
import MisaBorrowContractSummaryReport from "./MisaBorrowContractSummaryReport";
import MisaDetailedBorrowLedgerReport from "./MisaDetailedBorrowLedgerReport";
import MisaBorrowVoucherStatementReport from "./MisaBorrowVoucherStatementReport";
import MisaBorrowRepaymentScheduleSummaryReport from "./MisaBorrowRepaymentScheduleSummaryReport";
import MisaLendContractSummaryReport from "./MisaLendContractSummaryReport";
import MisaLendVoucherStatementReport from "./MisaLendVoucherStatementReport";
import MisaDetailedPurchaseLedgerReport from "./MisaDetailedPurchaseLedgerReport";
import MisaPurchaseSummaryByItemReport from "./MisaPurchaseSummaryByItemReport";
import MisaPurchaseSummaryByItemAndSupplierReport from "./MisaPurchaseSummaryByItemAndSupplierReport";
import MisaPurchaseSummaryBySupplierReport from "./MisaPurchaseSummaryBySupplierReport";
import MisaPurchaseJournalReport from "./MisaPurchaseJournalReport";
import MisaSupplierPayablesSummaryReport from "./MisaSupplierPayablesSummaryReport";
import MisaItemPayablesDetailReport from "./MisaItemPayablesDetailReport";
import MisaInvoicePayablesDetailReport from "./MisaInvoicePayablesDetailReport";
import MisaItemPayablesDynamicReport from "./MisaItemPayablesDynamicReport";
import MisaSupplierPayablesLedgerReport from "./MisaSupplierPayablesLedgerReport";
import MisaPayablesAgingAnalysisReport from "./MisaPayablesAgingAnalysisReport";
import MisaDebtReconciliationReport from "./MisaDebtReconciliationReport";
import MisaStaffPurchasesReports from "./MisaStaffPurchasesReports";
import MisaPurchaseOrderReports from "./MisaPurchaseOrderReports";
import MisaProjectPurchasesReports from "./MisaProjectPurchasesReports";
import MisaPurchaseReconciliationReports from "./MisaPurchaseReconciliationReports";

export type MisaReportCenterWorkspaceProps = {
  notify?: (msg: string) => void;
};

// All 16 Categories matching Screenshot
export const REPORT_CATEGORIES = [
  { id: "favorites", label: "Yêu thích" },
  { id: "financial", label: "Báo cáo tài chính" },
  { id: "analysis", label: "Báo cáo phân tích" },
  { id: "cash", label: "Tiền mặt" },
  { id: "bank", label: "Tiền gửi" },
  { id: "purchases", label: "Mua hàng" },
  { id: "sales", label: "Bán hàng" },
  { id: "inventory", label: "Kho" },
  { id: "tools", label: "Công cụ dụng cụ" },
  { id: "assets", label: "Tài sản cố định" },
  { id: "payroll", label: "Tiền lương" },
  { id: "tax", label: "Thuế" },
  { id: "cost", label: "Giá thành" },
  { id: "ledger", label: "Tổng hợp" },
  { id: "budget", label: "Ngân sách" },
  { id: "reconciliation", label: "Báo cáo đối chiếu" },
];

// Initial Favorites matching Screenshot exactly (19 reports in 2 columns)
const DEFAULT_FAVORITES = [
  "Tổng hợp mua hàng theo mặt hàng",
  "Số chi tiết mua hàng",
  "Tổng hợp bán hàng theo mặt hàng",
  "Số chi tiết bán hàng",
  "Tổng hợp công nợ phải trả nhà cung cấp",
  "Bảng tính phân bổ công cụ dụng cụ",
  "Tổng hợp công nợ theo đối tượng",
  "Tổng hợp công nợ nhân viên",
  "S36-DN: Sổ chi phí sản xuất, kinh doanh",
  "Số nhật ký chung",
  "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí",
  "S21 - DN: Sổ tài sản cố định",
  "S21-DN: Sổ tài sản cố định",
  "Bảng tính phân bổ chi phí trả trước",
  "Số chi tiết các tài khoản",
  "Chi tiết công nợ phải trả nhà cung cấp",
  "Tổng hợp tồn kho",
  "Số chi tiết vật tư hàng hóa",
  "Chi tiết công nợ phải thu khách hàng",
  "Tổng hợp công nợ phải thu khách hàng",
];

// Complete catalogue of reports grouped by category and sections matching actual screenshots
export interface ReportGroupData {
  id: string;
  title?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  rows: [string, string | null][];
}

export interface CategoryStructure {
  banner?: {
    title: string;
    botHighlight: string;
    linkText: string;
  };
  groups: ReportGroupData[];
}

export const CATEGORY_STRUCTURES: Record<string, CategoryStructure> = {
  // Screenshot 1: Báo cáo tài chính
  financial: {
    banner: {
      title: "Phân tích báo cáo tài chính kỳ tháng 9 bởi",
      botHighlight: "AVA Kế Toán",
      linkText: "Xem chi tiết →",
    },
    groups: [
      {
        id: "financial_main",
        title: "",
        collapsible: false,
        rows: [
          ["Bảng cân đối tài khoản (Mẫu quản trị)", "B09 - DN: Thuyết minh báo cáo tài chính"],
          ["Tình hình thực hiện nghĩa vụ với nhà nước", "B01a - DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)"],
          ["B01 - DN: Báo cáo tình hình tài chính", "B02a - DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)"],
          ["B02 - DN: Báo cáo kết quả hoạt động kinh doanh", "B03a - DN: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)"],
          ["B03 - DN: Báo cáo lưu chuyển tiền tệ (PP trực tiếp)", "B03a - DN - GT: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)"],
          ["B03 - DN - GT: Báo cáo lưu chuyển tiền tệ (PP gián tiếp)", null],
        ],
      },
    ],
  },

  // Screenshot 2: Báo cáo phân tích
  analysis: {
    groups: [
      {
        id: "analysis_branches",
        title: "Phân tích doanh thu, chi phí, tài sản giữa các chi nhánh",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Bảng cân đối tài khoản theo nhiều chi nhánh", "Bảng cân đối kế toán theo nhiều chi nhánh"],
          [
            "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều chi nhánh",
            "Báo cáo kết quả hoạt động kinh doanh theo nhiều chi nhánh",
          ],
          ["Báo cáo phân tích chi tiết doanh thu theo nhiều chi nhánh", "Báo cáo phân tích chi tiết chi phí theo nhiều chi nhánh"],
        ],
      },
      {
        id: "analysis_financial",
        title: "Phân tích báo cáo tài chính",
        collapsible: true,
        defaultOpen: true,
        rows: [
          [
            "Bảng cân đối tài khoản phân tích theo thời gian",
            "Phân tích báo cáo kết quả hoạt động kinh doanh (so sánh tỷ lệ trên doanh thu)",
          ],
          [
            "Báo cáo phân tích chi tiết doanh thu theo nhiều kỳ",
            "Phân tích tăng trưởng các chỉ tiêu bảng cân đối kế toán",
          ],
          [
            "Báo cáo phân tích chi tiết chi phí theo nhiều kỳ",
            "Phân tích cơ cấu tài sản, nguồn vốn trên bảng cân đối kế toán",
          ],
          [
            "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều kỳ",
            "Phân tích tăng trưởng các chỉ tiêu bảng cân đối kế toán dạng tóm lược",
          ],
          [
            "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo đơn vị",
            "Phân tích khả năng tạo tiền của từng hoạt động theo thời gian (PP trực tiếp)",
          ],
          [
            "Phân tích tăng trưởng các chỉ tiêu kết quả hoạt động kinh doanh",
            "Phân tích báo cáo lưu chuyển tiền tệ theo thời gian (PP trực tiếp)",
          ],
        ],
      },
    ],
  },

  // Screenshot 3: Tiền mặt
  cash: {
    groups: [
      {
        id: "cash_main",
        title: "Tiền mặt",
        collapsible: false,
        rows: [
          ["S03a1 - DN: Sổ nhật ký thu tiền", "Dòng tiền"],
          ["Bảng kê số dư tiền theo ngày", "S03a2 - DN: Sổ nhật ký chi tiền"],
          ["Sổ kế toán chi tiết quỹ tiền mặt", null],
        ],
      },
    ],
  },

  // Screenshot 4: Tiền gửi
  bank: {
    groups: [
      {
        id: "bank_deposits",
        title: "Báo cáo tiền gửi",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Bảng kê số dư tiền theo ngày", "S03a1 - DN: Sổ nhật ký thu tiền"],
          ["Sổ tiền gửi ngân hàng", "S03a2 - DN: Sổ nhật ký chi tiền"],
          ["Bảng kê số dư ngân hàng", "Sổ chi tiết chuyển tiền nội bộ"],
        ],
      },
      {
        id: "bank_borrow",
        title: "Báo cáo khế ước đi vay",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Báo cáo tổng hợp tình hình khế ước vay", "S34 - DN: Sổ chi tiết tiền vay"],
          ["Bảng kê chứng từ theo khế ước vay", "Tổng hợp lịch trả nợ khế ước vay"],
        ],
      },
      {
        id: "bank_lend",
        title: "Báo cáo khế ước cho vay",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Báo cáo tổng hợp tình hình khế ước cho vay", "Bảng kê chứng từ theo khế ước cho vay"],
        ],
      },
    ],
  },

  // Screenshots Mua hàng: 7 nhóm báo cáo chi tiết
  purchases: {
    groups: [
      {
        id: "purchases_items_suppliers",
        title: "Báo cáo mua hàng theo nhà cung cấp, mặt hàng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Sổ chi tiết mua hàng", "Tổng hợp mua hàng theo mặt hàng"],
          ["Tổng hợp mua hàng theo mặt hàng và nhà cung cấp", "Tổng hợp mua hàng theo nhà cung cấp"],
          ["Sổ nhật ký mua hàng", null],
        ],
      },
      {
        id: "purchases_payables",
        title: "Báo cáo công nợ nhà cung cấp",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp công nợ phải trả nhà cung cấp", "Chi tiết công nợ phải trả theo mặt hàng (tĩnh)"],
          ["Chi tiết công nợ phải trả theo hóa đơn", "Chi tiết công nợ phải trả theo mặt hàng"],
          ["Chi tiết công nợ phải trả nhà cung cấp", "Phân tích công nợ phải trả theo tuổi nợ"],
          ["Biên bản đối chiếu và xác nhận công nợ phải trả", "Chi tiết công nợ phải trả theo tuổi nợ"],
          ["Thông báo công nợ với nhà cung cấp", null],
        ],
      },
      {
        id: "purchases_staff",
        title: "Báo cáo theo nhân viên mua hàng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp mua hàng theo mặt hàng và nhân viên", "Tổng hợp công nợ phải trả theo nhân viên"],
          ["Chi tiết công nợ phải trả theo nhân viên", null],
        ],
      },
      {
        id: "purchases_orders",
        title: "Báo cáo đơn mua hàng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tình hình thực hiện đơn mua hàng", "Chi tiết công nợ phải trả theo đơn mua hàng"],
          ["Tổng hợp công nợ phải trả theo đơn mua hàng", null],
        ],
      },
      {
        id: "purchases_contracts",
        title: "Báo cáo hợp đồng mua",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp công nợ phải trả theo hợp đồng mua", "Tình hình thực hiện hợp đồng mua"],
          ["Chi tiết công nợ phải trả theo hợp đồng mua", null],
        ],
      },
      {
        id: "purchases_projects",
        title: "Báo cáo theo công trình",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp mua hàng theo nhà cung cấp và công trình", "Chi tiết công nợ phải trả theo công trình"],
          ["Tổng hợp công nợ phải trả theo công trình", null],
        ],
      },
      {
        id: "purchases_reconcile",
        title: "Báo cáo đối chiếu",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Đối chiếu chứng từ công nợ phải trả và chứng từ thanh toán", "Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng"],
          ["Đối chiếu chi phí mua hàng trên chứng từ mua hàng và chứng từ chi phí", null],
        ],
      },
    ],
  },

  // Screenshots Bán hàng: 7 nhóm báo cáo chi tiết
  sales: {
    groups: [
      {
        id: "sales_items_customers",
        title: "Báo cáo bán hàng theo khách hàng, mặt hàng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["S35 - DN: Sổ chi tiết bán hàng", "Tổng hợp bán hàng theo khách hàng"],
          ["Số chi tiết bán hàng", "Báo cáo so sánh số lượng bán, doanh số bán theo thời gian (Khách hàng và mặt hàng)"],
          ["Tổng hợp bán hàng theo mặt hàng", "Tổng hợp bán hàng theo nhóm khách hàng"],
          ["Tổng hợp bán hàng theo mặt hàng và khách hàng", "Phân tích chi tiết doanh thu sản phẩm/nhóm sản phẩm theo thời gian"],
          ["Tổng hợp bán hàng theo mã thống kê và mặt hàng", "Tổng hợp xuất kho bán hàng"],
          ["Tổng hợp bán hàng theo sàn thương mại điện tử", "Báo cáo so sánh số lượng bán, doanh số bán theo thời gian (Nhân viên và mặt hàng)"],
          ["Số nhật ký bán hàng", "Tổng hợp bán hàng theo nhóm mặt hàng"],
          ["Tổng hợp bán hàng theo địa phương", "Sổ chi tiết theo dõi tình trạng bảo hành"],
        ],
      },
      {
        id: "sales_receivables",
        title: "Báo cáo công nợ khách hàng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp công nợ phải thu khách hàng", "Phân tích công nợ phải thu theo tuổi nợ"],
          ["Tổng hợp công nợ phải thu theo nhóm khách hàng", "Chi tiết công nợ phải thu theo mặt hàng (tỉnh)"],
          ["Biên bản đối chiếu và xác nhận công nợ", "Chi tiết công nợ phải thu theo mặt hàng"],
          ["Chi tiết công nợ phải thu khách hàng", "Tổng hợp công nợ phải thu (chi tiết theo các khoản giảm trừ)"],
          ["Thông báo công nợ", "Chi tiết công nợ phải thu (Chi tiết theo các khoản giảm trừ)"],
          ["Báo cáo ngày thanh toán theo khách hàng", "Tổng hợp thanh toán công nợ khách hàng"],
          ["Thông báo công nợ (Mẫu 2)", "Chi tiết công nợ phải thu theo tuổi nợ"],
          ["Chi tiết công nợ phải thu theo hóa đơn", "Giấy đề nghị thanh toán công nợ"],
        ],
      },
      {
        id: "sales_staff",
        title: "Báo cáo theo nhân viên bán hàng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp bán hàng theo nhân viên và khách hàng", "Tổng hợp bán hàng theo mặt hàng và nhân viên"],
          ["Số chi tiết bán hàng theo nhân viên", "Tổng hợp công nợ phải thu theo nhân viên và khách hàng"],
          ["Tổng hợp công nợ phải thu theo nhân viên", "Tổng hợp bán hàng theo nhân viên, khách hàng và mặt hàng"],
          ["Tổng hợp bán hàng theo nhân viên", "Tổng hợp thanh toán công nợ khách hàng theo nhân viên"],
          ["Chi tiết công nợ phải thu theo nhân viên", null],
        ],
      },
      {
        id: "sales_business_units",
        title: "Báo cáo theo đơn vị kinh doanh",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp bán hàng theo đơn vị kinh doanh", "Tổng hợp bán hàng theo đơn vị kinh doanh và mặt hàng"],
          ["Tổng hợp công nợ phải thu khách hàng theo đơn vị kinh doanh", "Chi tiết công nợ phải thu khách hàng theo đơn vị kinh doanh"],
        ],
      },
      {
        id: "sales_orders",
        title: "Báo cáo theo đơn hàng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tình hình thực hiện đơn đặt hàng", "Báo cáo tổng hợp lãi lỗ theo đơn hàng"],
          ["Tổng hợp công nợ phải thu theo đơn đặt hàng", "Thống kê số lượng tồn kho và số lượng đặt hàng chưa giao"],
          ["Báo cáo chi tiết tình hình thực hiện đơn đặt hàng", "Báo cáo chi tiết lãi lỗ theo đơn hàng"],
          ["Chi tiết công nợ phải thu theo đơn đặt hàng", null],
        ],
      },
      {
        id: "sales_contracts",
        title: "Báo cáo hợp đồng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tình hình thực hiện hợp đồng bán", "Tổng hợp doanh số mặt hàng theo hợp đồng bán"],
          ["Tình hình thanh toán của hợp đồng (theo đợt thanh toán)", "Chi tiết công nợ phải thu theo hợp đồng bán"],
          ["Báo cáo tổng hợp lãi lỗ theo hợp đồng", "Tổng hợp tình hình chi theo hợp đồng bán"],
          ["Báo cáo chi tiết lãi lỗ theo hợp đồng", "Tổng hợp chi phí hợp đồng bán theo khoản mục chi phí"],
          ["Tổng hợp doanh số hợp đồng theo đơn vị", "Số chi tiết tài khoản theo hợp đồng và khoản mục chi phí"],
          ["Tổng hợp công nợ phải thu theo hợp đồng bán", "Báo cáo tổng hợp công nợ phải thu - công nợ phải trả theo hợp đồng"],
        ],
      },
      {
        id: "sales_projects",
        title: "Báo cáo theo công trình",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Chi tiết công nợ phải thu theo công trình", "Tổng hợp công nợ phải thu theo công trình"],
        ],
      },
      {
        id: "sales_reconcile",
        title: "Báo cáo đối chiếu",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Đối chiếu chứng từ công nợ phải thu và chứng từ thanh toán", null],
        ],
      },
    ],
  },

  // Screenshots Kho: 4 nhóm báo cáo
  inventory: {
    groups: [
      {
        id: "inventory_summary",
        title: "Báo cáo tổng hợp tồn kho",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp tồn kho", "Tổng hợp tồn trên nhiều kho (Dạng bảng chéo)"],
          ["Tổng hợp tồn kho theo nhiều đơn vị tính", "Tổng hợp nhập xuất tồn trên nhiều kho"],
          ["Tổng hợp tồn kho theo nhóm VTHH", "Báo cáo tồn theo chứng từ nhập chưa chuyển kho"],
        ],
      },
      {
        id: "inventory_detail",
        title: "Báo cáo chi tiết kho",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Số chi tiết vật tư hàng hóa", "Sổ chuyển kho nội bộ"],
        ],
      },
      {
        id: "inventory_production",
        title: "Báo cáo sản xuất",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Báo cáo tiến độ sản xuất", "Tổng hợp xuất kho theo lệnh sản xuất"],
        ],
      },
      {
        id: "inventory_reconciliation",
        title: "Báo cáo đối chiếu",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Báo cáo đối chiếu kho và sổ cái", "Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng"],
          ["Đối chiếu nhập xuất giữa kế toán và thủ kho", "Báo cáo đối chiếu giá thành và giá trị nhập kho"],
          ["Đối chiếu giá trị nhập, xuất kho của lệnh lắp ráp, tháo dỡ", null],
        ],
      },
    ],
  },

  // Screenshots Công cụ dụng cụ: 3 nhóm báo cáo
  tools: {
    groups: [
      {
        id: "tools_summary",
        title: "Báo cáo công cụ dụng cụ",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Bảng tính phân bổ công cụ dụng cụ", "Sổ theo dõi công cụ dụng cụ"],
          ["Bảng tính phân bổ công cụ dụng cụ theo năm", "Báo cáo chi tiết giảm công cụ dụng cụ"],
          ["Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng", null],
        ],
      },
      {
        id: "tools_prepaid",
        title: "Báo cáo chi phí trả trước",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tình hình phân bổ chi phí trả trước", "Bảng tính phân bổ chi phí trả trước"],
          ["Tình hình phân bổ chi phí trả trước theo năm", null],
        ],
      },
      {
        id: "tools_reconciliation",
        title: "Báo cáo đối chiếu",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái", null],
        ],
      },
    ],
  },

  // Screenshots Tài sản cố định: 2 nhóm báo cáo
  assets: {
    groups: [
      {
        id: "assets_summary",
        title: "Báo cáo tài sản",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["S21 - DN: Sổ tài sản cố định", "Sổ tài sản cố định"],
          ["Thẻ tài sản cố định", "Bảng tính khấu hao tài sản cố định theo năm"],
        ],
      },
      {
        id: "assets_reconciliation",
        title: "Báo cáo đối chiếu",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Báo cáo đối chiếu sổ tài sản và sổ cái", null],
        ],
      },
    ],
  },

  // Screenshots Tiền lương: 1 nhóm không collapsible
  payroll: {
    groups: [
      {
        id: "payroll_main",
        title: "",
        collapsible: false,
        rows: [
          ["Bảng tổng hợp thanh toán tiền lương (Bảng lương cố định)", "Bảng tổng hợp thanh toán tiền lương (Bảng lương thời gian)"],
          ["Báo cáo tổng hợp lương nhân viên", null],
        ],
      },
    ],
  },

  // Screenshots Thuế: 1 nhóm không collapsible
  tax: {
    groups: [
      {
        id: "tax_main",
        title: "",
        collapsible: false,
        rows: [
          ["Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ mua vào (Mẫu quản trị)", "Bảng tổng hợp quyết toán thuế GTGT năm"],
          ["02/TNDN: Bảng kê thu mua hàng hóa, dịch vụ mua vào không có hóa đơn", "Báo cáo đối chiếu bảng kê thuế và sổ cái"],
          ["Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ bán ra (Mẫu quản trị)", "Đối chiếu thông tin hóa đơn trên bảng kê mua vào và chứng từ"],
        ],
      },
    ],
  },

  // Screenshots Giá thành: 5 nhóm báo cáo chi tiết
  cost: {
    groups: [
      {
        id: "cost_continuous",
        title: "Sản xuất liên tục",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["S36-DN: Sổ chi phí sản xuất, kinh doanh", "Tổng hợp chi phí sản xuất kinh doanh theo đối tượng tập hợp chi phí"],
          ["Bảng kê phiếu nhập, phiếu xuất theo đối tượng tập hợp chi phí", "Số chi tiết tài khoản theo đối tượng tập hợp chi phí và khoản mục chi phí"],
          ["S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí", "Số chi tiết tài khoản theo đối tượng tập hợp chi phí"],
          ["S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo khoản mục chi phí", "Bảng tính giá thành"],
          ["Bảng tổng hợp chi phí theo đối tượng tập hợp chi phí", "Tổng hợp nhập xuất kho theo đối tượng tập hợp chi phí"],
        ],
      },
      {
        id: "cost_projects",
        title: "Giá thành công trình",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["S36-DN: Sổ chi phí sản xuất, kinh doanh theo công trình", "Tổng hợp nhập xuất kho theo công trình"],
          ["Bảng tổng hợp chi phí theo công trình", "Báo cáo chi tiết lãi lỗ theo công trình (Mẫu ngang)"],
          ["S37-DN: Thẻ tính giá thành công trình - theo khoản mục chi phí", "Báo cáo chi tiết lãi lỗ theo công trình (Mẫu dọc)"],
          ["Tổng hợp chi phí công trình theo khoản mục chi phí", "Bảng kê phiếu nhập, phiếu xuất theo công trình"],
          ["Tổng hợp chi phí sản xuất kinh doanh theo công trình", "Bảng so sánh định mức dự toán vật tư"],
          ["Số chi tiết tài khoản theo công trình và khoản mục chi phí", "Tổng hợp công nợ nhân viên theo công trình"],
          ["Số chi tiết tài khoản theo công trình", "Chi tiết công nợ nhân viên theo công trình"],
          ["Báo cáo tổng hợp lãi lỗ theo công trình", "Báo cáo so sánh chi phí dự toán và thực tế theo công trình"],
        ],
      },
      {
        id: "cost_orders",
        title: "Giá thành đơn hàng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp nhập xuất kho theo đơn hàng", "Bảng tổng hợp chi phí theo đơn hàng"],
          ["Bảng kê phiếu nhập, phiếu xuất theo đơn hàng", "Số chi tiết tài khoản theo đơn hàng và khoản mục chi phí"],
          ["Tổng hợp chi phí sản xuất kinh doanh theo đơn hàng", "S36-DN: Sổ chi phí sản xuất, kinh doanh theo đơn hàng"],
        ],
      },
      {
        id: "cost_contracts",
        title: "Giá thành hợp đồng",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp nhập xuất kho theo hợp đồng", "Bảng tổng hợp chi phí theo hợp đồng"],
          ["Bảng kê phiếu nhập, phiếu xuất theo hợp đồng", "Số chi tiết tài khoản theo hợp đồng"],
          ["Tổng hợp chi phí sản xuất kinh doanh theo hợp đồng", "S36-DN: Sổ chi phí sản xuất, kinh doanh theo hợp đồng"],
        ],
      },
      {
        id: "cost_reconciliation",
        title: "Báo cáo đối chiếu",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Liệt kê danh sách chứng từ chi phí chung theo kỳ tính giá thành", "Báo cáo đối chiếu giá thành và giá trị nhập kho"],
        ],
      },
    ],
  },

  // Screenshots Tổng hợp: 4 nhóm báo cáo
  ledger: {
    groups: [
      {
        id: "ledger_books",
        title: "Sổ sách kế toán",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Số chi tiết các tài khoản", "S03b-DN: Sổ cái (Hình thức Nhật ký chung)"],
          ["Số chi tiết phát sinh tài khoản (Chỉ lấy phát sinh)", "Bảng tổng hợp chứng từ gốc cùng loại (Ghi Có TK)"],
          ["Số nhật ký chung", "Báo cáo phát sinh theo từng cặp định khoản"],
          ["Bảng tổng hợp chứng từ gốc cùng loại (Ghi Nợ TK)", null],
        ],
      },
      {
        id: "ledger_accounts_summary",
        title: "Báo cáo tổng hợp theo tài khoản",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Bảng tổng hợp phát sinh tài khoản", "Báo cáo tổng hợp theo mã thống kê"],
        ],
      },
      {
        id: "ledger_costs_profit",
        title: "Báo cáo chi phí, lãi lỗ",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Báo cáo tổng hợp lãi lỗ theo mã thống kê", "Tổng hợp chi phí không hợp lý"],
          ["Báo cáo chi tiết lãi lỗ theo mã thống kê", "Tổng hợp chi phí theo đơn vị"],
          ["Tổng hợp chi phí theo khoản mục chi phí", "Báo cáo tổng hợp lãi lỗ theo đơn vị"],
          ["Chi tiết phát sinh tài khoản theo đơn vị", "Tổng hợp chi phí theo đơn vị và khoản mục chi phí"],
          ["Chi tiết phát sinh tài khoản theo đơn vị và khoản mục chi phí", "Báo cáo chi tiết lãi lỗ theo đơn vị"],
          ["Chi tiết phát sinh tài khoản theo khoản mục chi phí", null],
        ],
      },
      {
        id: "ledger_payables",
        title: "Báo cáo công nợ",
        collapsible: true,
        defaultOpen: true,
        rows: [
          ["Tổng hợp công nợ nhân viên", "Số chi tiết tài khoản theo đối tượng"],
          ["Tổng hợp công nợ nhân viên theo hợp đồng", "Chi tiết công nợ nhân viên theo hợp đồng"],
          ["Tổng hợp công nợ theo đối tượng", "Tình hình quyết toán tạm ứng nhân viên chi tiết theo từng chứng từ"],
        ],
      },
    ],
  },

  // Screenshots Ngân sách: 1 nhóm không collapsible
  budget: {
    groups: [
      {
        id: "budget_main",
        title: "",
        collapsible: false,
        rows: [
          ["Kế hoạch ngân sách", "Tình hình thực hiện doanh thu so với kế hoạch"],
          ["Tình hình thực hiện ngân sách", "Tình hình chi phí thực tế so với kế hoạch"],
        ],
      },
    ],
  },

  // Screenshots Báo cáo đối chiếu: 1 nhóm không collapsible
  reconciliation: {
    groups: [
      {
        id: "reconciliation_main",
        title: "",
        collapsible: false,
        rows: [
          ["Đối chiếu chứng từ công nợ phải trả và chứng từ thanh toán", "Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái"],
          ["Đối chiếu chi phí mua hàng trên chứng từ mua hàng và chứng từ chi phí", "Báo cáo đối chiếu sổ tài sản và sổ cái"],
          ["Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng", "Báo cáo đối chiếu bảng kê thuế và sổ cái"],
          ["Đối chiếu chứng từ công nợ phải thu và chứng từ thanh toán", "Đối chiếu thông tin hóa đơn trên bảng kê mua vào và chứng từ"],
          ["Báo cáo đối chiếu kho và sổ cái", "Liệt kê danh sách chứng từ chi phí chung theo kỳ tính giá thành"],
          ["Đối chiếu nhập xuất giữa kế toán và thủ kho", "Báo cáo đối chiếu giá thành và giá trị nhập kho"],
          ["Đối chiếu giá trị nhập, xuất kho của lệnh lắp ráp, tháo dỡ", null],
        ],
      },
    ],
  },
};

// Fallback catalog of reports for other categories
const REPORTS_BY_CATEGORY: Record<string, string[]> = {
  purchases: [
    "Tổng hợp mua hàng theo mặt hàng",
    "Số chi tiết mua hàng",
    "Tổng hợp công nợ phải trả nhà cung cấp",
    "Chi tiết công nợ phải trả nhà cung cấp",
    "Biên bản đối chiếu công nợ nhà cung cấp",
    "Bảng kê hóa đơn mua hàng vào",
  ],
  sales: [
    "Tổng hợp bán hàng theo mặt hàng",
    "Số chi tiết bán hàng",
    "Tổng hợp công nợ phải thu khách hàng",
    "Chi tiết công nợ phải thu khách hàng",
    "Báo cáo lãi lỗ theo từng đơn hàng",
    "Biên bản đối chiếu công nợ khách hàng",
  ],
  inventory: [
    "Tổng hợp tồn kho",
    "Số chi tiết vật tư hàng hóa",
    "Bảng kê xuất kho theo mặt hàng",
    "Bảng kê nhập kho theo mặt hàng",
    "Báo cáo kiểm kê hàng tồn kho",
  ],
  tools: [
    "Bảng tính phân bổ công cụ dụng cụ",
    "Sổ theo dõi CCDC tại nơi sử dụng",
    "Báo cáo tình hình tăng giảm CCDC",
    "Bảng kê phân bổ chi phí CCDC theo phòng ban",
  ],
  assets: [
    "S21-DN: Sổ tài sản cố định",
    "Bảng trích khấu hao tài sản cố định",
    "Báo cáo tăng giảm tài sản cố định",
    "Sổ tài sản cố định theo phòng ban/bộ phận",
  ],
  payroll: [
    "Bảng thanh toán tiền lương",
    "Bảng tính bảo hiểm xã hội, BHYT, BHTN",
    "Bảng tổng hợp trích nộp kinh phí công đoàn",
    "Tổng hợp chi phí lương theo bộ phận",
  ],
  tax: [
    "Bảng kê hóa đơn mua vào (Mẫu 01-2/GTGT)",
    "Bảng kê hóa đơn bán ra (Mẫu 01-1/GTGT)",
    "Tờ khai thuế GTGT khấu trừ (Mẫu 01/GTGT)",
    "Báo cáo tình hình sử dụng hóa đơn",
    "Bảng kê quyết toán thuế TNCN",
  ],
  cost: [
    "S36-DN: Sổ chi phí sản xuất, kinh doanh",
    "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí",
    "Bảng tổng hợp chi phí sản xuất theo yếu tố",
    "Bảng phân bổ chi phí chung",
    "Báo cáo giá thành sản phẩm hoàn thành",
  ],
  ledger: [
    "Số nhật ký chung",
    "Số chi tiết các tài khoản",
    "Sổ cái tài khoản",
    "Tổng hợp công nợ theo đối tượng",
    "Tổng hợp công nợ nhân viên",
  ],
  budget: [
    "Kế hoạch ngân sách",
    "Tình hình thực hiện ngân sách",
    "Tình hình thực hiện doanh thu so với kế hoạch",
    "Tình hình chi phí thực tế so với kế hoạch",
  ],
  reconciliation: [
    "Báo cáo đối chiếu số dư kho và sổ cái",
    "Báo cáo đối chiếu công nợ và sổ cái",
    "Báo cáo đối chiếu tiền mặt, tiền gửi với sổ cái",
    "Báo cáo kiểm tra và đối chiếu chứng từ kế toán",
  ],
};

export default function MisaReportCenterWorkspace({ notify }: MisaReportCenterWorkspaceProps) {
  // Subtabs: "all" (Tất cả) | "saved" (Báo cáo đã lưu) | "schedule" (Lịch gửi báo cáo định kỳ)
  const [activeSubtab, setActiveSubtab] = useState<"all" | "saved" | "schedule">("all");
  
  // Left category active ID
  const [activeCategory, setActiveCategory] = useState<string>("favorites");

  // Search keyword
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Report Language
  const [reportLang, setReportLang] = useState<string>("Tiếng Việt");

  // Favorite reports set
  const [favorites, setFavorites] = useState<Set<string>>(new Set(DEFAULT_FAVORITES));

  // Preview / Filter Drawer Modal State
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Print Announcement Modal
  const [isPrintBannerModalOpen, setIsPrintBannerModalOpen] = useState<boolean>(false);

  // Set of collapsed groups:
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const toggleFavorite = (name: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Collect all report names across structures for search
  const allStructuredReports = useMemo(() => {
    const list: string[] = [];
    Object.values(CATEGORY_STRUCTURES).forEach((cat) => {
      cat.groups.forEach((g) => {
        g.rows.forEach(([left, right]) => {
          if (left) list.push(left);
          if (right) list.push(right);
        });
      });
    });
    return list;
  }, []);

  // Derive reports for the current category or search query
  const displayedReports = useMemo(() => {
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const allUnique = Array.from(
        new Set([
          ...DEFAULT_FAVORITES,
          ...allStructuredReports,
          ...Object.values(REPORTS_BY_CATEGORY).flat(),
        ])
      );
      return allUnique.filter((r) => r.toLowerCase().includes(kw));
    }

    if (activeCategory === "favorites") {
      return Array.from(favorites);
    }

    if (CATEGORY_STRUCTURES[activeCategory]) {
      return [];
    }

    return REPORTS_BY_CATEGORY[activeCategory] || [];
  }, [searchKeyword, activeCategory, favorites, allStructuredReports]);

  // Split flat reports into 2 columns for search / favorites / fallback
  const column1 = displayedReports.filter((_, idx) => idx % 2 === 0);
  const column2 = displayedReports.filter((_, idx) => idx % 2 === 1);

  const activeCategoryObj = REPORT_CATEGORIES.find((c) => c.id === activeCategory);
  const currentStructure = !searchKeyword ? CATEGORY_STRUCTURES[activeCategory] : null;

  const renderReportCell = (reportName: string | null) => {
    if (!reportName) {
      return <div className="misa-reports-cell empty" />;
    }
    const isFav = favorites.has(reportName);
    return (
      <div className="misa-reports-cell">
        <a
          href={`#${reportName}`}
          className="misa-reports-item-link"
          onClick={(e) => {
            e.preventDefault();
            setSelectedReport(reportName);
          }}
          title={reportName}
        >
          {reportName}
        </a>
        <div className="misa-reports-item-actions">
          <button
            type="button"
            className="misa-reports-action-icon"
            title="Xem biểu đồ / xem trước báo cáo"
            onClick={() => setSelectedReport(reportName)}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
              <path d="M4 11L7 7L10 10L12 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className={`misa-reports-star-btn ${isFav ? "starred" : ""}`}
            title={isFav ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
            onClick={() => toggleFavorite(reportName)}
          >
            <Star
              size={15}
              strokeWidth={1.2}
              fill={isFav ? "#00a862" : "none"}
              color={isFav ? "#00a862" : "#94a3b8"}
            />
          </button>
        </div>
      </div>
    );
  };

  if (selectedReport === "Bảng cân đối tài khoản (Mẫu quản trị)") {
    return (
      <MisaTrialBalanceManagementReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Tình hình thực hiện nghĩa vụ với nhà nước") {
    return (
      <MisaStateObligationsReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "B01 - DN: Báo cáo tình hình tài chính") {
    return (
      <MisaFinancialPositionReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "B02 - DN: Báo cáo kết quả hoạt động kinh doanh" ||
    selectedReport === "B02-DN: Báo cáo kết quả hoạt động kinh doanh"
  ) {
    return (
      <MisaBusinessResultReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "B03 - DN: Báo cáo lưu chuyển tiền tệ (PP trực tiếp)" ||
    selectedReport === "B03-DN: Báo cáo lưu chuyển tiền tệ (PP trực tiếp)"
  ) {
    return (
      <MisaCashFlowDirectReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "B03 - DN - GT: Báo cáo lưu chuyển tiền tệ (PP gián tiếp)" ||
    selectedReport === "B03-DN-GT: Báo cáo lưu chuyển tiền tệ (PP gián tiếp)"
  ) {
    return (
      <MisaCashFlowIndirectReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "B09 - DN: Thuyết minh báo cáo tài chính" ||
    selectedReport === "B09-DN: Thuyết minh báo cáo tài chính"
  ) {
    return (
      <MisaFinancialNotesReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "B01a - DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)" ||
    selectedReport === "B01a-DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)"
  ) {
    return (
      <MisaInterimFinancialPositionReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
        initialTab="B01a-DN"
      />
    );
  }

  if (
    selectedReport === "B02a - DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)" ||
    selectedReport === "B02a-DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)"
  ) {
    return (
      <MisaInterimBusinessResultReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "B03a - DN: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)" ||
    selectedReport === "B03a-DN: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)"
  ) {
    return (
      <MisaInterimCashFlowDirectReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "B03a - DN - GT: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)" ||
    selectedReport === "B03a-DN-GT: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)"
  ) {
    return (
      <MisaInterimCashFlowIndirectReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Bảng cân đối tài khoản theo nhiều chi nhánh"
  ) {
    return (
      <MisaMultiBranchTrialBalanceReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều chi nhánh"
  ) {
    return (
      <MisaMultiBranchRevenueExpenseReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Báo cáo phân tích chi tiết doanh thu theo nhiều chi nhánh"
  ) {
    return (
      <MisaMultiBranchDetailedRevenueReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Bảng cân đối kế toán theo nhiều chi nhánh"
  ) {
    return (
      <MisaMultiBranchBalanceSheetReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Báo cáo kết quả hoạt động kinh doanh theo nhiều chi nhánh"
  ) {
    return (
      <MisaMultiBranchBusinessResultReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Báo cáo phân tích chi tiết chi phí theo nhiều chi nhánh"
  ) {
    return (
      <MisaMultiBranchDetailedExpenseReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Bảng cân đối tài khoản phân tích theo thời gian"
  ) {
    return (
      <MisaTimePeriodicTrialBalanceReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Phân tích báo cáo kết quả hoạt động kinh doanh (so sánh tỷ lệ trên doanh thu)"
  ) {
    return (
      <MisaIncomeRatioAnalysisReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Báo cáo phân tích chi tiết doanh thu theo nhiều kỳ"
  ) {
    return (
      <MisaMultiPeriodDetailedRevenueReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Phân tích tăng trưởng các chỉ tiêu bảng cân đối kế toán" ||
    selectedReport === "Phân tích tăng trưởng các chỉ tiêu Báo cáo tình hình tài chính"
  ) {
    return (
      <MisaBalanceSheetGrowthAnalysisReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Báo cáo phân tích chi tiết chi phí theo nhiều kỳ"
  ) {
    return (
      <MisaMultiPeriodDetailedExpenseReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Phân tích cơ cấu tài sản, nguồn vốn trên bảng cân đối kế toán" ||
    selectedReport === "Phân tích cơ cấu tài sản, nguồn vốn trên Báo cáo tình hình tài chính"
  ) {
    return (
      <MisaAssetCapitalStructureAnalysisReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều kỳ"
  ) {
    return (
      <MisaMultiPeriodRevenueExpenseReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Phân tích tăng trưởng các chỉ tiêu bảng cân đối kế toán dạng tóm lược" ||
    selectedReport ===
      "Phân tích tăng trưởng các chỉ tiêu Báo cáo tình hình tài chính dạng tóm lược"
  ) {
    return (
      <MisaCondensedBalanceSheetGrowthReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo đơn vị"
  ) {
    return (
      <MisaMultiUnitRevenueExpenseReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Phân tích khả năng tạo tiền của từng hoạt động theo thời gian (PP trực tiếp)"
  ) {
    return (
      <MisaCashGenerationAnalysisReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Phân tích tăng trưởng các chỉ tiêu kết quả hoạt động kinh doanh"
  ) {
    return (
      <MisaBusinessResultGrowthAnalysisReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport ===
      "Phân tích báo cáo lưu chuyển tiền tệ theo thời gian (PP trực tiếp)"
  ) {
    return (
      <MisaDirectCashFlowTimePeriodicReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "S03a1 - DN: Sổ nhật ký thu tiền" ||
    selectedReport === "S03a1-DN: Sổ nhật ký thu tiền"
  ) {
    return (
      <MisaCashReceiptJournalReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Dòng tiền") {
    return (
      <MisaCashMovementReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Bảng kê số dư tiền theo ngày") {
    return (
      <MisaDailyCashBalanceReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "S03a2 - DN: Sổ nhật ký chi tiền" ||
    selectedReport === "S03a2-DN: Sổ nhật ký chi tiền"
  ) {
    return (
      <MisaCashDisbursementJournalReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Sổ kế toán chi tiết quỹ tiền mặt") {
    return (
      <MisaDetailedCashLedgerReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Sổ tiền gửi ngân hàng" ||
    selectedReport === "Số tiền gửi ngân hàng"
  ) {
    return (
      <MisaBankDepositLedgerReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Bảng kê số dư ngân hàng") {
    return (
      <MisaBankBalanceStatementReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Sổ chi tiết chuyển tiền nội bộ" ||
    selectedReport === "Số chi tiết chuyển tiền nội bộ"
  ) {
    return (
      <MisaInternalFundTransferDetailReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Báo cáo tổng hợp tình hình khế ước vay") {
    return (
      <MisaBorrowContractSummaryReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "S34 - DN: Sổ chi tiết tiền vay" ||
    selectedReport === "S34-DN: Sổ chi tiết tiền vay" ||
    selectedReport === "S34 - DN: Số chi tiết tiền vay" ||
    selectedReport === "S34-DN: Số chi tiết tiền vay"
  ) {
    return (
      <MisaDetailedBorrowLedgerReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Bảng kê chứng từ theo khế ước vay") {
    return (
      <MisaBorrowVoucherStatementReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Tổng hợp lịch trả nợ khế ước vay") {
    return (
      <MisaBorrowRepaymentScheduleSummaryReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Báo cáo tổng hợp tình hình khế ước cho vay") {
    return (
      <MisaLendContractSummaryReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Bảng kê chứng từ theo khế ước cho vay") {
    return (
      <MisaLendVoucherStatementReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Sổ chi tiết mua hàng" ||
    selectedReport === "Số chi tiết mua hàng"
  ) {
    return (
      <MisaDetailedPurchaseLedgerReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Tổng hợp mua hàng theo mặt hàng") {
    return (
      <MisaPurchaseSummaryByItemReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Tổng hợp mua hàng theo mặt hàng và nhà cung cấp") {
    return (
      <MisaPurchaseSummaryByItemAndSupplierReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Tổng hợp mua hàng theo nhà cung cấp") {
    return (
      <MisaPurchaseSummaryBySupplierReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Sổ nhật ký mua hàng" ||
    selectedReport === "Số nhật ký mua hàng"
  ) {
    return (
      <MisaPurchaseJournalReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Tổng hợp công nợ phải trả nhà cung cấp") {
    return (
      <MisaSupplierPayablesSummaryReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (
    selectedReport === "Chi tiết công nợ phải trả theo mặt hàng (tĩnh)" ||
    selectedReport === "Chi tiết công nợ phải trả theo mặt hàng (tỉnh)"
  ) {
    return (
      <MisaItemPayablesDetailReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Chi tiết công nợ phải trả theo hóa đơn") {
    return (
      <MisaInvoicePayablesDetailReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Chi tiết công nợ phải trả theo mặt hàng") {
    return (
      <MisaItemPayablesDynamicReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Chi tiết công nợ phải trả nhà cung cấp") {
    return (
      <MisaSupplierPayablesLedgerReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
      />
    );
  }

  if (selectedReport === "Phân tích công nợ phải trả theo tuổi nợ") {
    return (
      <MisaPayablesAgingAnalysisReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
        mode="summary"
      />
    );
  }

  if (selectedReport === "Chi tiết công nợ phải trả theo tuổi nợ") {
    return (
      <MisaPayablesAgingAnalysisReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
        mode="detail"
      />
    );
  }

  if (selectedReport === "Biên bản đối chiếu và xác nhận công nợ phải trả") {
    return (
      <MisaDebtReconciliationReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
        type="confirmation"
      />
    );
  }

  if (selectedReport === "Thông báo công nợ với nhà cung cấp") {
    return (
      <MisaDebtReconciliationReport
        onBack={() => setSelectedReport(null)}
        notify={notify}
        type="notice"
      />
    );
  }

  if (selectedReport === "Tổng hợp mua hàng theo mặt hàng và nhân viên") {
    return (
      <MisaStaffPurchasesReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="item_staff_summary"
      />
    );
  }

  if (selectedReport === "Tổng hợp công nợ phải trả theo nhân viên") {
    return (
      <MisaStaffPurchasesReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="payables_staff_summary"
      />
    );
  }

  if (selectedReport === "Chi tiết công nợ phải trả theo nhân viên") {
    return (
      <MisaStaffPurchasesReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="payables_staff_detail"
      />
    );
  }

  if (selectedReport === "Tình hình thực hiện đơn mua hàng") {
    return (
      <MisaPurchaseOrderReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="execution_status"
      />
    );
  }

  if (selectedReport === "Chi tiết công nợ phải trả theo đơn mua hàng") {
    return (
      <MisaPurchaseOrderReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="payables_order_detail"
      />
    );
  }

  if (selectedReport === "Tổng hợp công nợ phải trả theo đơn mua hàng") {
    return (
      <MisaPurchaseOrderReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="payables_order_summary"
      />
    );
  }

  if (selectedReport === "Tổng hợp mua hàng theo nhà cung cấp và công trình") {
    return (
      <MisaProjectPurchasesReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="purchase_summary_project"
      />
    );
  }

  if (selectedReport === "Chi tiết công nợ phải trả theo công trình") {
    return (
      <MisaProjectPurchasesReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="payables_project_detail"
      />
    );
  }

  if (selectedReport === "Tổng hợp công nợ phải trả theo công trình") {
    return (
      <MisaProjectPurchasesReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="payables_project_summary"
      />
    );
  }

  if (selectedReport === "Đối chiếu chứng từ công nợ phải trả và chứng từ thanh toán") {
    return (
      <MisaPurchaseReconciliationReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="debt_payment_match"
      />
    );
  }

  if (selectedReport === "Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng") {
    return (
      <MisaPurchaseReconciliationReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="cost_purchase_match"
      />
    );
  }

  if (selectedReport === "Đối chiếu chi phí mua hàng trên chứng từ mua hàng và chứng từ chi phí") {
    return (
      <MisaPurchaseReconciliationReports
        onBack={() => setSelectedReport(null)}
        notify={notify}
        reportType="purchase_cost_match"
      />
    );
  }

  return (
    <div className="misa-reports-workspace">
      {/* 1. Header Bar: Subtabs + Right Announcement Banner */}
      <div className="misa-reports-header-row">
        <div className="misa-reports-subtabs">
          <button
            type="button"
            className={`misa-reports-subtab-btn ${activeSubtab === "all" ? "active" : ""}`}
            onClick={() => setActiveSubtab("all")}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`misa-reports-subtab-btn ${activeSubtab === "saved" ? "active" : ""}`}
            onClick={() => setActiveSubtab("saved")}
          >
            Báo cáo đã lưu
          </button>
          <button
            type="button"
            className={`misa-reports-subtab-btn ${activeSubtab === "schedule" ? "active" : ""}`}
            onClick={() => setActiveSubtab("schedule")}
          >
            <span>Lịch gửi báo cáo định kỳ</span>
            <span className="misa-reports-badge-orange">Mới</span>
          </button>
        </div>

        {/* Right Announcement Banner matching screenshot */}
        <div
          className="misa-reports-banner"
          onClick={() => setIsPrintBannerModalOpen(true)}
          title="Trình in mới của AMIS Kế toán"
        >
          <span className="misa-reports-banner-tag">Mới</span>
          <span>In nhanh hơn - Ổn định hơn - In dữ liệu lớn với trình in mới của AMIS Kế toán.</span>
          <span className="misa-reports-banner-link">Xem ngay &gt;</span>
        </div>
      </div>

      {/* 2. Toolbar */}
      <div className="misa-reports-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="misa-reports-search-wrap">
            <Search size={15} className="misa-reports-search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên báo cáo"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="misa-reports-ai-link"
            onClick={() => notify?.("Trợ lý AVA Kế toán đã sẵn sàng tìm kiếm thông minh báo cáo cho bạn.")}
          >
            <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
            <span style={{ fontSize: 14 }}>🤖</span>
          </button>
        </div>

        <div className="misa-reports-toolbar-right">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
            <span>Ngôn ngữ báo cáo</span>
            <select
              style={{
                height: 32,
                padding: "0 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                background: "#ffffff",
                fontSize: 13,
                outline: "none",
                cursor: "pointer",
              }}
              value={reportLang}
              onChange={(e) => setReportLang(e.target.value)}
            >
              <option value="Tiếng Việt">Tiếng Việt</option>
              <option value="English">English</option>
            </select>
          </div>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              color: "#334155",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
            onClick={() => notify?.("Tùy chọn ẩn/hiện danh mục báo cáo hệ thống.")}
          >
            <Eye size={14} />
            <span>Ẩn/hiện báo cáo</span>
          </button>

          <button
            type="button"
            style={{
              width: 32,
              height: 32,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
            title="Đổi dạng hiển thị"
          >
            <Layers size={14} />
          </button>
        </div>
      </div>

      {/* 3. Main Body: Subtab Views */}
      {activeSubtab === "all" && (
        <div className="misa-reports-body">
          {/* Left Category Menu */}
          <aside className="misa-reports-categories">
            {REPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`misa-reports-cat-btn ${activeCategory === cat.id && !searchKeyword ? "active" : ""}`}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchKeyword("");
                }}
              >
                <span>{cat.label}</span>
                {cat.id === "favorites" && (
                  <span style={{ fontSize: 11, color: "#00a862", fontWeight: 700 }}>
                    {favorites.size}
                  </span>
                )}
              </button>
            ))}
          </aside>

          {/* Right Report Grid */}
          <main className="misa-reports-content">
            <h3 className="misa-reports-content-title">
              {searchKeyword
                ? `Kết quả tìm kiếm cho "${searchKeyword}" (${displayedReports.length})`
                : activeCategoryObj?.label || "Báo cáo"}
            </h3>

            {/* If user is viewing structured category (Báo cáo tài chính, Báo cáo phân tích, Tiền mặt, Tiền gửi) */}
            {currentStructure ? (
              <div className="misa-reports-structured-container">
                {/* 1. AVA Banner if present */}
                {currentStructure.banner && (
                  <div className="misa-reports-ava-banner">
                    <div className="misa-reports-ava-banner-left">
                      <div className="misa-reports-ava-banner-title">
                        {currentStructure.banner.title}{" "}
                        <span className="misa-reports-ava-highlight">
                          {currentStructure.banner.botHighlight}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="misa-reports-ava-banner-link"
                        onClick={() => notify?.("Trợ lý AVA Kế toán phân tích thông minh các chỉ số tài chính...")}
                      >
                        <span>{currentStructure.banner.linkText}</span>
                      </button>
                    </div>

                    {/* Cute Futuristic AVA Robot Mascot */}
                    <div className="misa-reports-ava-banner-mascot" title="AVA Kế toán">
                      <svg width="115" height="90" viewBox="0 0 120 95" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <ellipse cx="60" cy="50" rx="38" ry="32" fill="#eff6ff" />
                        <circle cx="36" cy="22" r="11" fill="#1e293b" />
                        <circle cx="36" cy="22" r="6" fill="#38bdf8" />
                        <circle cx="84" cy="22" r="11" fill="#1e293b" />
                        <circle cx="84" cy="22" r="6" fill="#38bdf8" />
                        <rect x="30" y="20" width="60" height="46" rx="23" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                        <ellipse cx="46" cy="40" rx="10" ry="9" fill="#0f172a" />
                        <ellipse cx="74" cy="40" rx="10" ry="9" fill="#0f172a" />
                        <ellipse cx="47" cy="40" rx="5" ry="4.5" fill="#38bdf8" />
                        <circle cx="49" cy="38" r="1.5" fill="#ffffff" />
                        <ellipse cx="73" cy="40" rx="5" ry="4.5" fill="#38bdf8" />
                        <circle cx="75" cy="38" r="1.5" fill="#ffffff" />
                        <path d="M55 52 Q60 56 65 52" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                        <rect x="40" y="66" width="40" height="26" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                        <circle cx="60" cy="76" r="5" fill="#6366f1" />
                        <circle cx="60" cy="76" r="2.5" fill="#38bdf8" />
                        <rect x="24" y="66" width="13" height="7" rx="3.5" transform="rotate(-25 24 66)" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                        <rect x="83" y="60" width="13" height="7" rx="3.5" transform="rotate(35 83 60)" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* 2. Groups */}
                {currentStructure.groups.map((group) => {
                  const isCollapsed = group.collapsible && collapsedGroups[group.id];
                  return (
                    <div key={group.id} className="misa-reports-group-block">
                      {group.title && group.collapsible && (
                        <div
                          className={`misa-reports-group-header collapsible ${isCollapsed ? "collapsed" : ""}`}
                          onClick={() => toggleGroup(group.id)}
                        >
                          <span className="misa-reports-group-title">{group.title}</span>
                          <span className="misa-reports-group-chevron">
                            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                          </span>
                        </div>
                      )}

                      {!isCollapsed && (
                        <div className={`misa-reports-table ${group.collapsible ? "attached" : ""}`}>
                          {group.rows.map((row, rIdx) => (
                            <div key={rIdx} className="misa-reports-row">
                              {renderReportCell(row[0])}
                              {renderReportCell(row[1])}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : displayedReports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                Không tìm thấy báo cáo nào phù hợp.
              </div>
            ) : (
              <div className="misa-reports-grid-table">
                {/* Column 1 */}
                <div className="misa-reports-grid-col">
                  {column1.map((report) => (
                    <div key={report} className="misa-reports-item-row">
                      <a
                        href={`#${report}`}
                        className="misa-reports-item-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedReport(report);
                        }}
                      >
                        {report}
                      </a>
                      <div className="misa-reports-item-actions">
                        <button
                          type="button"
                          className="misa-reports-action-icon"
                          title="Xem dạng biểu đồ trực quan"
                          onClick={() => setSelectedReport(report)}
                        >
                          <LineChart size={16} />
                        </button>
                        <button
                          type="button"
                          className={`misa-reports-star-btn ${favorites.has(report) ? "starred" : ""}`}
                          title={favorites.has(report) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                          onClick={() => toggleFavorite(report)}
                        >
                          <Star
                            size={16}
                            fill={favorites.has(report) ? "#00a862" : "none"}
                            color={favorites.has(report) ? "#00a862" : "#94a3b8"}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Column 2 */}
                <div className="misa-reports-grid-col">
                  {column2.map((report) => (
                    <div key={report} className="misa-reports-item-row">
                      <a
                        href={`#${report}`}
                        className="misa-reports-item-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedReport(report);
                        }}
                      >
                        {report}
                      </a>
                      <div className="misa-reports-item-actions">
                        <button
                          type="button"
                          className="misa-reports-action-icon"
                          title="Xem dạng biểu đồ trực quan"
                          onClick={() => setSelectedReport(report)}
                        >
                          <LineChart size={16} />
                        </button>
                        <button
                          type="button"
                          className={`misa-reports-star-btn ${favorites.has(report) ? "starred" : ""}`}
                          title={favorites.has(report) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                          onClick={() => toggleFavorite(report)}
                        >
                          <Star
                            size={16}
                            fill={favorites.has(report) ? "#00a862" : "none"}
                            color={favorites.has(report) ? "#00a862" : "#94a3b8"}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Subtab 2: Báo cáo đã lưu */}
      {activeSubtab === "saved" && (
        <div style={{ padding: 24, background: "#ffffff", minHeight: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Danh sách mẫu báo cáo đã lưu</h3>
            <button
              type="button"
              style={{
                height: 34,
                padding: "0 18px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => notify?.("Tạo mẫu báo cáo tùy chỉnh mới...")}
            >
              + Tạo mẫu báo cáo mới
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", textAlign: "left", color: "#334155" }}>
                <th style={{ padding: "10px 14px" }}>Tên mẫu báo cáo</th>
                <th style={{ padding: "10px 14px" }}>Báo cáo gốc</th>
                <th style={{ padding: "10px 14px" }}>Người tạo</th>
                <th style={{ padding: "10px 14px" }}>Ngày tạo</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>Báo cáo bán hàng theo nhóm Khách VIP</td>
                <td style={{ padding: "10px 14px" }}>Tổng hợp bán hàng theo mặt hàng</td>
                <td style={{ padding: "10px 14px" }}>Nguyễn Văn Kế Toán</td>
                <td style={{ padding: "10px 14px" }}>15/09/2026</td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    onClick={() => setSelectedReport("Tổng hợp bán hàng theo mặt hàng")}
                  >
                    Mở báo cáo
                  </button>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>Theo dõi công nợ NCC quá hạn 30 ngày</td>
                <td style={{ padding: "10px 14px" }}>Tổng hợp công nợ phải trả nhà cung cấp</td>
                <td style={{ padding: "10px 14px" }}>Nguyễn Văn Kế Toán</td>
                <td style={{ padding: "10px 14px" }}>22/09/2026</td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    onClick={() => setSelectedReport("Tổng hợp công nợ phải trả nhà cung cấp")}
                  >
                    Mở báo cáo
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Subtab 3: Lịch gửi báo cáo định kỳ */}
      {activeSubtab === "schedule" && (
        <div style={{ padding: 24, background: "#ffffff", minHeight: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Lịch tự động gửi báo cáo qua Email</h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                Tự động kết xuất và gửi báo cáo định kỳ cho Ban Giám đốc và các Trưởng bộ phận.
              </p>
            </div>
            <button
              type="button"
              style={{
                height: 34,
                padding: "0 18px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => notify?.("Thiết lập lịch gửi báo cáo mới...")}
            >
              + Thêm lịch gửi mới
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", textAlign: "left", color: "#334155" }}>
                <th style={{ padding: "10px 14px" }}>Tên lịch</th>
                <th style={{ padding: "10px 14px" }}>Báo cáo</th>
                <th style={{ padding: "10px 14px" }}>Tần suất</th>
                <th style={{ padding: "10px 14px" }}>Người nhận</th>
                <th style={{ padding: "10px 14px" }}>Định dạng</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>Báo cáo Doanh thu tuần cho Giám đốc</td>
                <td style={{ padding: "10px 14px" }}>Tổng hợp bán hàng theo mặt hàng</td>
                <td style={{ padding: "10px 14px" }}>Thứ Hai hàng tuần (08:00)</td>
                <td style={{ padding: "10px 14px" }}>ceo@misa.vn</td>
                <td style={{ padding: "10px 14px" }}>Excel, PDF</td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <span style={{ padding: "2px 8px", background: "#f0fdf4", color: "#166534", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    Đang hoạt động
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Modal: Report Preview / Parameter Drawer */}
      {selectedReport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectedReport(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 860,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                {selectedReport}
              </h3>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                }}
                onClick={() => setSelectedReport(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Parameters */}
            <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#475569" }}>Kỳ báo cáo:</span>
                <select style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff" }}>
                  <option>Năm nay (2026)</option>
                  <option>Quý này (Quý 3/2026)</option>
                  <option>Tháng này (Tháng 09/2026)</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#475569" }}>Đơn vị:</span>
                <select style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff" }}>
                  <option>Tung</option>
                  <option>Công ty Cổ phần MISA</option>
                  <option>Văn phòng Tổng công ty</option>
                </select>
              </div>

              <span style={{ marginLeft: "auto", color: "#64748b" }}>Đơn vị tính: <strong>Đồng</strong></span>
            </div>

            {/* Report Table Preview */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Mã hàng / Đối tượng</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên mặt hàng / Đối tượng</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>ĐVT</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Số lượng</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Đơn giá</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>HH001</td>
                    <td style={{ padding: "8px 12px" }}>Máy tính để bàn Dell Vostro</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>Bộ</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>15</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>14.500.000</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>217.500.000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>HH002</td>
                    <td style={{ padding: "8px 12px" }}>Màn hình LG 27 inch 4K</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>Chiếc</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>20</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>6.200.000</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>124.000.000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>DV001</td>
                    <td style={{ padding: "8px 12px" }}>Phần mềm bản quyền Microsoft Office 365</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>Gói</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>50</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>1.800.000</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>90.000.000</td>
                  </tr>
                  <tr style={{ background: "#f0fdf4", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                    <td colSpan={3} style={{ padding: "9px 12px", color: "#166534" }}>TỔNG CỘNG</td>
                    <td style={{ padding: "9px 12px", textAlign: "right" }}>85</td>
                    <td style={{ padding: "9px 12px" }}></td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#00a862", fontWeight: 700 }}>
                      431.500.000
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 16px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#334155",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
                onClick={() => notify?.("Đã xuất khẩu báo cáo ra Excel thành công.")}
              >
                <Download size={14} />
                <span>Xuất Excel</span>
              </button>
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 16px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#334155",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
                onClick={() => notify?.("Đang chuẩn bị dữ liệu in báo cáo...")}
              >
                <Printer size={14} />
                <span>In báo cáo</span>
              </button>
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 22px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setSelectedReport(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: AMIS Print Engine Announcement */}
      {isPrintBannerModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsPrintBannerModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 540,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="misa-reports-badge-orange">Mới</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Trình in thông minh mới của AMIS Kế toán</h3>
              </div>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsPrintBannerModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.6 }}>
              Phiên bản trình in mới được tối ưu hóa cho các báo cáo khối lượng lớn hàng chục ngàn dòng:
            </p>
            <ul style={{ fontSize: 13, color: "#475569", lineHeight: 1.8, paddingLeft: 20 }}>
              <li>Tốc độ render nhanh hơn gấp <strong>3 lần</strong>.</li>
              <li>Hỗ trợ xuất PDF và in hàng loạt mà không gây treo trình duyệt.</li>
              <li>Tự động căn lề và định dạng trang in chuẩn khổ giấy A4, A3.</li>
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 22px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setIsPrintBannerModalOpen(false)}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
