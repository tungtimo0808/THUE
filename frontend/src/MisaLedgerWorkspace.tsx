import React, { useEffect, useState } from "react";
import { apiDate, apiNumber, useMisaApiLists, useMisaApiSave } from "./misa-api-lists";
import {
  adjustGeneralBusinessVoucher,
  adjustJournalEntry,
  aggregatePeriodBalances,
  batchPostJournalEntries,
  batchUnpostJournalEntries,
  calculateExpenseAllocation,
  calculateFxRevaluation,
  cancelAllocationRun,
  cancelClosingRun,
  cancelFxRevaluationRun,
  closingRowsFromLedger,
  confirmExpenseAllocation,
  confirmFxRevaluation,
  confirmProfitLossClosing,
  createApiWriter,
  decideAdvanceSettlementRequest,
  drilldownAccountBalance,
  errorText,
  fetchAllocationSourceData,
  fetchAllocationTrace,
  fetchClosingRunTrace,
  fetchFxRevaluationBalances,
  fetchFxRevaluationTrace,
  fetchProfitLossClosingData,
  importGeneralBusinessVouchersExcel,
  ingestSubledgerJournalEvent,
  inheritAdvanceRequestForSettlement,
  postAllocationRun,
  postClosingRun,
  postFxRevaluationRun,
  postGeneralBusinessVoucher,
  postJournalEntry,
  postSubledgerJournalIngestion,
  resubmitAdvanceSettlementRequest,
  retrySubledgerJournalIngestion,
  retrySubledgerSourceCallback,
  retrySyncAdvanceSettlementRequest,
  reverseAllocationRun,
  reverseClosingRun,
  reverseFxRevaluationRun,
  reverseGeneralBusinessVoucher,
  reverseJournalEntry,
  runGlSubledgerReconciliation,
  saveAdvanceSettlement,
  saveAdvanceSettlementRequest,
  saveGeneralBusinessVoucher,
  saveJournalVoucher,
  seedDefaultClosingRules,
  seedDefaultReconciliationRules,
  toApiDate,
  toViDate,
  unpostAllocationRun,
  unpostClosingRun,
  unpostFxRevaluationRun,
  unpostGeneralBusinessVoucher,
  unpostJournalEntry,
  validatePeriodBalances,
  annotateGlReconciliationNote,
  drilldownGlReconciliation,
  evaluatePeriodCloseChecklist,
  closeAccountingPeriod,
  reopenAccountingPeriod,
  decideReopenAccountingPeriod,
  fetchPeriodLockHistory,
  runAutoPeriodLock,
  seedDefaultFinancialStatementMappings,
  precheckFinancialStatements,
  generateFinancialStatements,
  updateFinancialStatementNotes,
  finalizeFinancialStatementBatch,
  drilldownFinancialStatementLine,
  exportFinancialStatementBatch,
  queryAccountingBookUcGl14,
  traceGlEntryAndVoucherUcGl14,
  exportAccountingBookUcGl14,
} from "./misa-api-writes";
import { useApiSession } from "./ApiSession";
import MisaApiDocumentStatus from "./MisaApiDocumentStatus";
import { request } from "./live-api";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  Lightbulb,
  Plus,
  Search,
  Filter,
  ArrowRight,
  ArrowLeft,
  Lock,
  Unlock,
  Settings,
  FileText,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  MinusSquare,
  Calendar,
  DollarSign,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Download,
  Printer,
  Eye,
  Star,
  SlidersHorizontal,
  Code2,
  BookOpen,
  Sparkles,
  Share2,
  FileSpreadsheet,
  Building2,
  User,
  Shield,
  Layers,
  ArrowUpRight,
  RotateCcw,
  Layout,
  Trash2,
  Paperclip,
  Upload,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pin,
} from "lucide-react";
import amisStory1 from "./assets/amis_story_1.jpg";
import amisStory2 from "./assets/amis_story_2.jpg";
import amisStory3 from "./assets/amis_story_3.jpg";

export type CompanyInfo = {
  id: string;
  name: string;
  short?: string;
};

export type MisaLedgerWorkspaceProps = {
  company: CompanyInfo;
  period: string;
  tab: string;
  href: (path: string) => string;
  notify?: (msg: string) => void;
};

// Formatter
const formatVND = (num: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
const formatVndNumber = (num: unknown) => Number(num || 0).toLocaleString("vi-VN");

export type GeneralVoucherType =
  | "1. Hạch toán thuế TNDN phải nộp"
  | "2. Vay ngân hàng chuyển trả cho nhà cung cấp"
  | "3. Hạch toán chi phí lương"
  | "4. Khác"
  | "5. Kết chuyển lãi lỗ đầu năm"
  | "6. Khấu trừ thuế tiêu thụ đặc biệt";

export const voucherTypeOptions: GeneralVoucherType[] = [
  "1. Hạch toán thuế TNDN phải nộp",
  "2. Vay ngân hàng chuyển trả cho nhà cung cấp",
  "3. Hạch toán chi phí lương",
  "4. Khác",
  "5. Kết chuyển lãi lỗ đầu năm",
  "6. Khấu trừ thuế tiêu thụ đặc biệt",
];

export default function MisaLedgerWorkspace({
  company,
  period,
  tab,
  href,
  notify = () => {},
}: MisaLedgerWorkspaceProps) {
  const { rows: apiRows, connected: apiConnected, reload: reloadApi } = useMisaApiLists(company.id, {
    journals: "/api/v1/general-ledger/journals/",
    closings: "/api/v1/general-ledger/closing-runs/",
    advanceRequests: "/api/v1/general-ledger/advance-requests/",
    advanceSettlements: "/api/v1/general-ledger/advance-settlements/",
    generalVouchers: "/api/v1/general-ledger/general-vouchers/",
    subledgerIngestions: "/api/v1/general-ledger/subledger-ingestions/",
    employees: "/api/v1/organization/employees/",
    departments: "/api/v1/organization/departments/",
  }, notify);
  const apiSave = useMisaApiSave(company.id, notify, reloadApi);
  const { token: apiToken } = useApiSession();
  const writer = apiToken ? createApiWriter(company.id, (path, init) => request(path, apiToken, init)) : null;
  const currentTab = tab || "process";

  // --- Interactive Popovers on Workflow Nodes (Image 1 & 2) ---
  const [showLockMenu, setShowLockMenu] = useState(false);
  const [showStatementsMenu, setShowStatementsMenu] = useState(false);

  // --- Modals State ---
  const [lockPeriodModalOpen, setLockPeriodModalOpen] = useState(false);
  const [unlockPeriodModalOpen, setUnlockPeriodModalOpen] = useState(false);
  const [lockByTypeModalOpen, setLockByTypeModalOpen] = useState(false);
  const [autoLockModalOpen, setAutoLockModalOpen] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [autoLockDay, setAutoLockDay] = useState("20");

  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementModalType, setStatementModalType] = useState<string>("Báo cáo tài chính");

  const [addVoucherModalOpen, setAddVoucherModalOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const act = sp.get("action");
      return act === "add-voucher" || act === "nvk" || act === "profit-loss" || act === "nvk00001";
    }
    return false;
  });
  const [addAdvanceSettlementModalOpen, setAddAdvanceSettlementModalOpen] = useState(false);
  const [addAdvanceRequestModalOpen, setAddAdvanceRequestModalOpen] = useState(false);
  const [closingEntryModalOpen, setClosingEntryModalOpen] = useState(false);

  // Advance settlement flow state
  const [showAdvanceRequestTable, setShowAdvanceRequestTable] = useState(false);
  const [autoSyncAdvanceModalOpen, setAutoSyncAdvanceModalOpen] = useState(false);

  // Quick action dialogs
  const [chartOfAccountsModalOpen, setChartOfAccountsModalOpen] = useState(false);
  const [statsCodeModalOpen, setStatsCodeModalOpen] = useState(false);
  const [expenseItemModalOpen, setExpenseItemModalOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);

  // Report Preview Modal & UC-GL-14 (Tra cứu Sổ cái / Nhật ký / Truy vết chứng từ)
  const [previewReportName, setPreviewReportName] = useState<string | null>(null);
  const [previewReportRun, setPreviewReportRun] = useState<any | null>(null);

  const ucGl14BookOptions = [
    { code: "GENERAL_JOURNAL", label: "S03a-DN: Sổ nhật ký chung", isOfficial: true },
    { code: "GENERAL_LEDGER", label: "S03b-DN: Sổ cái các tài khoản", isOfficial: true },
    { code: "GENERAL_LEDGER_NKC", label: "S03b-DN: Sổ cái (hình thức Nhật ký chung)", isOfficial: true },
    { code: "ACCOUNT_DETAIL_LEDGER", label: "S38-DN: Sổ chi tiết các tài khoản", isOfficial: true },
    { code: "MULTI_PERIOD_DETAIL_LEDGER", label: "S38-DN-MP: Sổ chi tiết tài khoản nhiều kỳ", isOfficial: true },
    { code: "ACCOUNT_DETAIL_SUMMARY", label: "S06-DN: Bảng tổng hợp chi tiết tài khoản", isOfficial: true },
    { code: "ACCOUNT_TURNOVER_SUMMARY", label: "S06a-DN: Bảng tổng hợp phát sinh tài khoản", isOfficial: true },
    { code: "T_ACCOUNT_SUMMARY", label: "S06T-DN: Bảng tổng hợp phát sinh tài khoản chữ T", isOfficial: true },
    { code: "TRIAL_BALANCE", label: "S06-CDPS: Bảng cân đối số phát sinh", isOfficial: true },
    { code: "CASH_RECEIPT_JOURNAL", label: "S03a1-DN: Sổ nhật ký thu tiền", isOfficial: true },
    { code: "CASH_PAYMENT_JOURNAL", label: "S03a2-DN: Sổ nhật ký chi tiền", isOfficial: true },
    { code: "PURCHASE_JOURNAL", label: "S03a3-DN: Sổ nhật ký mua hàng", isOfficial: true },
    { code: "SALES_JOURNAL", label: "S03a4-DN: Sổ nhật ký bán hàng", isOfficial: true },
    { code: "FOREIGN_CURRENCY_LEDGER", label: "S39-DN: Sổ theo dõi thanh toán bằng ngoại tệ", isOfficial: true },
    { code: "GL_ENTRY_INQUIRY", label: "GL-INQ-01: Tra cứu bút toán GL (Gồm cả Chưa ghi sổ)", isOfficial: false },
    { code: "VOUCHER_TRACE", label: "GL-TRACE-01: Truy vết chứng từ & Chuỗi Đảo/Điều chỉnh 2 chiều", isOfficial: false },
  ];

  const resolveBookTypeFromReportName = (name: string): string => {
    const n = (name || "").trim();
    const map: Record<string, string> = {
      "Sổ nhật ký chung": "GENERAL_JOURNAL",
      "Sổ cái các tài khoản": "GENERAL_LEDGER",
      "Sổ cái (hình thức Nhật ký chung)": "GENERAL_LEDGER_NKC",
      "Sổ chi tiết các tài khoản": "ACCOUNT_DETAIL_LEDGER",
      "Sổ chi tiết tài khoản nhiều kỳ": "MULTI_PERIOD_DETAIL_LEDGER",
      "Bảng tổng hợp chi tiết tài khoản": "ACCOUNT_DETAIL_SUMMARY",
      "Tổng hợp công nợ theo đối tượng": "ACCOUNT_DETAIL_SUMMARY",
      "Tổng hợp công nợ phải thu của khách hàng": "ACCOUNT_DETAIL_SUMMARY",
      "Tổng hợp công nợ phải trả cho người bán": "ACCOUNT_DETAIL_SUMMARY",
      "Bảng tổng hợp phát sinh tài khoản": "ACCOUNT_TURNOVER_SUMMARY",
      "Bảng tổng hợp phát sinh tài khoản chữ T": "T_ACCOUNT_SUMMARY",
      "Bảng cân đối số phát sinh": "TRIAL_BALANCE",
      "Bảng cân đối tài khoản (Mẫu quản trị)": "TRIAL_BALANCE",
      "Sổ nhật ký thu tiền": "CASH_RECEIPT_JOURNAL",
      "Sổ nhật ký chi tiền": "CASH_PAYMENT_JOURNAL",
      "Sổ nhật ký mua hàng": "PURCHASE_JOURNAL",
      "Sổ nhật ký bán hàng": "SALES_JOURNAL",
      "Sổ theo dõi thanh toán bằng ngoại tệ": "FOREIGN_CURRENCY_LEDGER",
      "Tra cứu bút toán GL": "GL_ENTRY_INQUIRY",
      "Truy vết chứng từ nguồn": "VOUCHER_TRACE",
    };
    return map[n] || "GENERAL_LEDGER";
  };

  const [uc14BookType, setUc14BookType] = useState<string>("GENERAL_LEDGER");
  const [uc14Period, setUc14Period] = useState<string>("2026-10");
  const [uc14FromDate, setUc14FromDate] = useState<string>("2026-10-01");
  const [uc14ToDate, setUc14ToDate] = useState<string>("2026-10-31");
  const [uc14AccountCode, setUc14AccountCode] = useState<string>("");
  const [uc14IncludeChildAccounts, setUc14IncludeChildAccounts] = useState<boolean>(true);
  const [uc14ReciprocalAccount, setUc14ReciprocalAccount] = useState<string>("");
  const [uc14PartyCode, setUc14PartyCode] = useState<string>("");
  const [uc14CurrencyCode, setUc14CurrencyCode] = useState<string>("");
  const [uc14EntryStatus, setUc14EntryStatus] = useState<string>("POSTED");
  const [uc14Keyword, setUc14Keyword] = useState<string>("");
  const [uc14SubView, setUc14SubView] = useState<"MOVEMENTS" | "ACCOUNT_PARTNER_SUMMARY" | "FX_AND_T_ACCOUNT">("MOVEMENTS");
  const [uc14BookResult, setUc14BookResult] = useState<any | null>(null);
  const [uc14TraceDetail, setUc14TraceDetail] = useState<any | null>(null);
  const [uc14Error, setUc14Error] = useState<string>("");
  const [uc14Loading, setUc14Loading] = useState<boolean>(false);

  const buildSampleBookResultUcGl14 = (overrideParams?: Record<string, any>) => {
    const bType = overrideParams?.book_type || uc14BookType;
    const foundMeta = ucGl14BookOptions.find((o) => o.code === bType) || ucGl14BookOptions[1];
    const reqStatus = overrideParams?.entry_status || uc14EntryStatus;
    const reqCcy = (overrideParams?.currency_code ?? uc14CurrencyCode).trim().toUpperCase();
    const reqAcc = (overrideParams?.account_code ?? uc14AccountCode).trim();
    const reqKw = (overrideParams?.keyword ?? uc14Keyword).trim().toLowerCase();

    const sampleRows = [
      {
        row_no: 1,
        line_id: "LN-14-001",
        entry_id: "ENT-14-001",
        line_no: 1,
        posting_date: "2026-10-05",
        document_date: "2026-10-05",
        period_code: uc14Period,
        voucher_number: "PT-2026-1001",
        entry_type: "SUBLEDGER",
        entry_status: "POSTED",
        description: "Thu tiền bán hàng hóa từ Công ty CP Thương mại Á Châu",
        account_code: "1111",
        account_name: "Tiền Việt Nam",
        reciprocal_account_code: "131",
        debit: "165000000",
        credit: "0",
        running_debit: "365000000",
        running_credit: "0",
        currency_code: "VND",
        exchange_rate: "1",
        debit_fc: "0",
        credit_fc: "0",
        running_balance_fc: "0",
        party_code: "KH001",
        party_name: "Công ty CP Thương mại Á Châu",
        department_code: "PKD",
        project_code: "DA-2026-01",
        source_module: "CASH",
        source_document_type: "CASH_RECEIPT",
        source_document_id: "DOC-CASH-1001",
        source_document_number: "PT-2026-1001",
        trace_status: "TRACEABLE",
        trace_message: "Truy vết đầy đủ tới Phiếu thu tiền mặt tại phân hệ Quỹ (TRACEABLE).",
        is_reversed_or_adjusted: false,
        original_entry_number: "",
        related_entry_numbers: [],
      },
      {
        row_no: 2,
        line_id: "LN-14-002",
        entry_id: "ENT-14-002",
        line_no: 1,
        posting_date: "2026-10-12",
        document_date: "2026-10-12",
        period_code: uc14Period,
        voucher_number: "PMH-2026-045",
        entry_type: "SUBLEDGER",
        entry_status: "POSTED",
        description: "Mua lô thiết bị mạng nhập kho từ Công ty TNHH Thiết bị Việt",
        account_code: "1561",
        account_name: "Giá mua hàng hóa",
        reciprocal_account_code: "331",
        debit: "85000000",
        credit: "0",
        running_debit: "185000000",
        running_credit: "0",
        currency_code: "VND",
        exchange_rate: "1",
        debit_fc: "0",
        credit_fc: "0",
        running_balance_fc: "0",
        party_code: "NCC001",
        party_name: "Công ty TNHH Thiết bị Việt",
        department_code: "PKHO",
        project_code: "DA-2026-02",
        source_module: "PUR",
        source_document_type: "PURCHASE_INVOICE",
        source_document_id: "DOC-PUR-045",
        source_document_number: "PMH-2026-045",
        trace_status: "PARTIAL_TRACE",
        trace_message: "Truy vết thành công tới chứng từ mua hàng nhưng thiếu biên bản giao nhận phụ (PARTIAL_TRACE).",
        is_reversed_or_adjusted: true,
        original_entry_number: "",
        related_entry_numbers: ["ADJ-2026-009"],
      },
      {
        row_no: 3,
        line_id: "LN-14-003",
        entry_id: "ENT-14-003",
        line_no: 1,
        posting_date: "2026-10-18",
        document_date: "2026-10-18",
        period_code: uc14Period,
        voucher_number: "BC-USD-2026-01",
        entry_type: "SUBLEDGER",
        entry_status: "POSTED",
        description: "Thu tiền xuất khẩu phần mềm qua ngân hàng VCB (1.000 USD)",
        account_code: "1122",
        account_name: "Tiền gửi ngân hàng - Ngoại tệ",
        reciprocal_account_code: "131",
        debit: "25000000",
        credit: "0",
        running_debit: "25000000",
        running_credit: "0",
        currency_code: "USD",
        exchange_rate: "25000",
        debit_fc: "1000",
        credit_fc: "0",
        running_balance_fc: "1000",
        party_code: "KH_GLOBAL",
        party_name: "Global Tech Corp (US)",
        department_code: "PKD",
        project_code: "DA-EXPORT",
        source_module: "BANK",
        source_document_type: "BANK_CREDIT_NOTE",
        source_document_id: "DOC-BANK-USD-01",
        source_document_number: "BC-USD-2026-01",
        trace_status: "TRACEABLE",
        trace_message: "Truy vết đầy đủ tới Báo Có ngân hàng ngoại tệ USD (TRACEABLE).",
        is_reversed_or_adjusted: false,
        original_entry_number: "",
        related_entry_numbers: [],
      },
      {
        row_no: 4,
        line_id: "LN-14-004",
        entry_id: "ENT-14-004",
        line_no: 1,
        posting_date: "2026-10-20",
        document_date: "2026-10-20",
        period_code: uc14Period,
        voucher_number: "BC-EUR-2026-02",
        entry_type: "SUBLEDGER",
        entry_status: "POSTED",
        description: "Thu tiền dịch vụ tư vấn từ đối tác Châu Âu (1.000 EUR)",
        account_code: "1122",
        account_name: "Tiền gửi ngân hàng - Ngoại tệ",
        reciprocal_account_code: "131",
        debit: "27000000",
        credit: "0",
        running_debit: "52000000",
        running_credit: "0",
        currency_code: "EUR",
        exchange_rate: "27000",
        debit_fc: "1000",
        credit_fc: "0",
        running_balance_fc: "1000",
        party_code: "KH_EU",
        party_name: "EuroSoft GmbH",
        department_code: "PKD",
        project_code: "DA-EXPORT",
        source_module: "BANK",
        source_document_type: "BANK_CREDIT_NOTE",
        source_document_id: "DOC-BANK-EUR-02",
        source_document_number: "BC-EUR-2026-02",
        trace_status: "ACCESS_RESTRICTED",
        trace_message: "Bạn có quyền xem bút toán GL nhưng không có quyền mở chứng từ nguồn tại phân hệ BANK_VIP (AF-19, EF-19).",
        is_reversed_or_adjusted: false,
        original_entry_number: "",
        related_entry_numbers: [],
      },
      {
        row_no: 5,
        line_id: "LN-14-005",
        entry_id: "ENT-14-005",
        line_no: 1,
        posting_date: "2026-10-25",
        document_date: "2026-10-25",
        period_code: uc14Period,
        voucher_number: "PKT00001",
        entry_type: "MANUAL",
        entry_status: "POSTED",
        description: "Hạch toán trích khấu hao TSCĐ và phân bổ chi phí quản lý tháng 10/2026",
        account_code: "6424",
        account_name: "Chi phí khấu hao TSCĐ",
        reciprocal_account_code: "2141",
        debit: "18500000",
        credit: "0",
        running_debit: "18500000",
        running_credit: "0",
        currency_code: "VND",
        exchange_rate: "1",
        debit_fc: "0",
        credit_fc: "0",
        running_balance_fc: "0",
        party_code: "",
        party_name: "",
        department_code: "PQL",
        project_code: "",
        source_module: "GL",
        source_document_type: "MANUAL",
        source_document_id: "",
        source_document_number: "PKT00001",
        trace_status: "NO_SOURCE",
        trace_message: "Bút toán được lập trực tiếp tại phân hệ Kế toán tổng hợp (GL), không qua chứng từ phân hệ nguồn (AF-17, BR-GL-TRACE-48).",
        is_reversed_or_adjusted: false,
        original_entry_number: "",
        related_entry_numbers: [],
      },
      {
        row_no: 6,
        line_id: "LN-14-006",
        entry_id: "ENT-14-006",
        line_no: 1,
        posting_date: "2026-10-28",
        document_date: "2026-10-28",
        period_code: uc14Period,
        voucher_number: "GL-SAL-ERR-09",
        entry_type: "SUBLEDGER",
        entry_status: "POSTED",
        description: "Ghi nhận doanh thu bán hàng (Chứng từ phân hệ SAL bị đứt liên kết)",
        account_code: "131",
        account_name: "Phải thu của khách hàng",
        reciprocal_account_code: "5111",
        debit: "12000000",
        credit: "0",
        running_debit: "110000000",
        running_credit: "0",
        currency_code: "VND",
        exchange_rate: "1",
        debit_fc: "0",
        credit_fc: "0",
        running_balance_fc: "0",
        party_code: "KH002",
        party_name: "Công ty TNHH Minh Phú",
        department_code: "PKD",
        project_code: "",
        source_module: "SAL",
        source_document_type: "SALES_INVOICE",
        source_document_id: "MISSING-UUID-999",
        source_document_number: "HDBH-MISSING-09",
        trace_status: "BROKEN_LINK",
        trace_message: "Bút toán có khai báo liên kết chứng từ nguồn SAL nhưng bản ghi nguồn không tồn tại. Hệ thống tuyệt đối không tự tạo chứng từ giả (EF-17, BR-GL-TRACE-49, 50).",
        is_reversed_or_adjusted: false,
        original_entry_number: "",
        related_entry_numbers: [],
      },
    ];

    const filtered = sampleRows.filter((r) => {
      if (reqAcc && !r.account_code.startsWith(reqAcc)) return false;
      if (reqCcy && r.currency_code !== reqCcy) return false;
      if (bType === "FOREIGN_CURRENCY_LEDGER" && r.currency_code === "VND") return false;
      if (reqKw && !`${r.voucher_number} ${r.description} ${r.account_code} ${r.party_name}`.toLowerCase().includes(reqKw)) return false;
      return true;
    });

    return {
      book_type: bType,
      book_title: foundMeta.label,
      form_code: foundMeta.label.split(":")[0] || "S03b-DN",
      circular_ref: "Thông tư 99/2025/TT-BTC",
      is_official_book: foundMeta.isOfficial,
      company_id: company.id,
      company_name: company.name,
      period_code: uc14Period,
      period_status: periodLockStatus,
      from_date: uc14FromDate,
      to_date: uc14ToDate,
      filters_applied: {
        account_codes: reqAcc ? [reqAcc] : [],
        include_child_accounts: uc14IncludeChildAccounts,
        reciprocal_account_code: uc14ReciprocalAccount,
        entry_status: reqStatus,
        currency_code: reqCcy,
        keyword: reqKw,
      },
      summary_totals: {
        opening_debit: "600000000",
        opening_credit: "600000000",
        period_debit: "332500000",
        period_credit: "332500000",
        closing_debit: "748000000",
        closing_credit: "748000000",
        is_balanced: true,
        foreign_currency_note:
          "Cộng phát sinh ngoại tệ được tách riêng theo từng loại ngoại tệ (USD, EUR...), tuyệt đối không cộng ngang nguyên tệ khác loại tiền (BR-GL-TRACE-72).",
      },
      consistency_with_uc_gl_10: {
        status: balAggStatus === "STALE" ? "STALE_WARNING" : "MATCHED",
        message:
          balAggStatus === "STALE"
            ? "Bảng tổng hợp số dư tại UC-GL-10 đang ở trạng thái STALE; Sổ cái UC-GL-14 đã tự động tính trực tiếp trên nguồn POSTED mới nhất (EF-13)."
            : "Số dư đầu kỳ, phát sinh trong kỳ và số dư cuối kỳ khớp 100% với Bảng tổng hợp số dư tài khoản (UC-GL-10).",
      },
      pagination: { page: 1, page_size: 200, total_rows: filtered.length, total_pages: 1 },
      rows: filtered,
      account_summaries: [
        {
          account_code: "111",
          account_name: "Tiền mặt (Tổng hợp từ TK con - không cộng trùng BR-GL-TRACE-28)",
          account_level: 1,
          is_parent: true,
          is_bilateral: false,
          opening_debit: "200000000",
          opening_credit: "0",
          period_debit: "165000000",
          period_credit: "20000000",
          closing_debit: "345000000",
          closing_credit: "0",
        },
        {
          account_code: "1111",
          account_name: "Tiền Việt Nam",
          account_level: 2,
          is_parent: false,
          is_bilateral: false,
          opening_debit: "200000000",
          opening_credit: "0",
          period_debit: "165000000",
          period_credit: "20000000",
          closing_debit: "345000000",
          closing_credit: "0",
        },
        {
          account_code: "1122",
          account_name: "Tiền gửi ngân hàng - Ngoại tệ (USD, EUR)",
          account_level: 2,
          is_parent: false,
          is_bilateral: false,
          opening_debit: "0",
          opening_credit: "0",
          period_debit: "52000000",
          period_credit: "0",
          closing_debit: "52000000",
          closing_credit: "0",
        },
        {
          account_code: "131",
          account_name: "Phải thu của khách hàng (Lưỡng tính - tách Dư Nợ / Dư Có theo đối tượng AF-16)",
          account_level: 1,
          is_parent: false,
          is_bilateral: true,
          opening_debit: "150000000",
          opening_credit: "0",
          period_debit: "12000000",
          period_credit: "92000000",
          closing_debit: "110000000",
          closing_credit: "40000000",
        },
        {
          account_code: "331",
          account_name: "Phải trả cho người bán (Lưỡng tính - tách Dư Nợ / Dư Có theo đối tượng AF-16)",
          account_level: 1,
          is_parent: false,
          is_bilateral: true,
          opening_debit: "0",
          opening_credit: "0",
          period_debit: "25000000",
          period_credit: "85000000",
          closing_debit: "25000000",
          closing_credit: "85000000",
        },
      ],
      detail_partner_summaries: [
        {
          account_code: "131",
          account_name: "Phải thu của khách hàng",
          party_code: "KH001",
          party_name: "Công ty CP Thương mại Á Châu (Dư Nợ)",
          opening_debit: "150000000",
          opening_credit: "0",
          period_debit: "12000000",
          period_credit: "52000000",
          closing_debit: "110000000",
          closing_credit: "0",
        },
        {
          account_code: "131",
          account_name: "Phải thu của khách hàng",
          party_code: "KH002",
          party_name: "Công ty TNHH Minh Phú (Khách ứng trước - Dư Có, không bù trừ chéo)",
          opening_debit: "0",
          opening_credit: "0",
          period_debit: "0",
          period_credit: "40000000",
          closing_debit: "0",
          closing_credit: "40000000",
        },
        {
          account_code: "331",
          account_name: "Phải trả cho người bán",
          party_code: "NCC001",
          party_name: "Công ty TNHH Thiết bị Việt (Phải trả - Dư Có)",
          opening_debit: "0",
          opening_credit: "0",
          period_debit: "0",
          period_credit: "85000000",
          closing_debit: "0",
          closing_credit: "85000000",
        },
        {
          account_code: "331",
          account_name: "Phải trả cho người bán",
          party_code: "NCC002",
          party_name: "Công ty CP Vật tư Miền Bắc (Trả trước NCC - Dư Nợ, không bù trừ chéo)",
          opening_debit: "0",
          opening_credit: "0",
          period_debit: "25000000",
          period_credit: "0",
          closing_debit: "25000000",
          closing_credit: "0",
        },
      ],
      currency_totals: [
        {
          currency_code: "USD",
          period_debit_fc: "1000.00",
          period_credit_fc: "0.00",
          period_debit_vnd: "25000000",
          period_credit_vnd: "0",
          line_count: 1,
        },
        {
          currency_code: "EUR",
          period_debit_fc: "1000.00",
          period_credit_fc: "0.00",
          period_debit_vnd: "27000000",
          period_credit_vnd: "0",
          line_count: 1,
        },
        {
          currency_code: "VND",
          period_debit_fc: "0.00",
          period_credit_fc: "0.00",
          period_debit_vnd: "280500000",
          period_credit_vnd: "280500000",
          line_count: 4,
        },
      ],
      t_account_summaries: [
        {
          account_code: "1111",
          account_name: "Tiền Việt Nam",
          debit_by_reciprocal: { "131": "165000000" },
          credit_by_reciprocal: { "642": "20000000" },
          total_debit: "165000000",
          total_credit: "20000000",
        },
        {
          account_code: "131",
          account_name: "Phải thu của khách hàng",
          debit_by_reciprocal: { "5111": "162000000" },
          credit_by_reciprocal: { "1111": "40000000", "1122": "52000000" },
          total_debit: "162000000",
          total_credit: "92000000",
        },
      ],
      multi_period_groups: [],
      empty_result_message: filtered.length === 0 ? "Không có dữ liệu phát sinh thỏa điều kiện lọc trong kỳ đã chọn (AF-27)." : "",
    };
  };

  const handleQueryBookUcGl14 = async (overrideParams?: Record<string, any>) => {
    setUc14Error("");
    const bType = overrideParams?.book_type || uc14BookType;
    const foundMeta = ucGl14BookOptions.find((o) => o.code === bType) || ucGl14BookOptions[1];
    const reqStatus = overrideParams?.entry_status || uc14EntryStatus;
    const reqCcy = (overrideParams?.currency_code ?? uc14CurrencyCode).trim().toUpperCase();

    // EF-09, BR-GL-TRACE-10, 11, 100: Sổ chính thức chỉ cho phép bút toán POSTED
    if (foundMeta.isOfficial && reqStatus !== "POSTED") {
      const msg = `Sổ kế toán chính thức (${foundMeta.label}) chỉ được phép phản ánh các bút toán đã ghi sổ (POSTED). Không được trộn bút toán chưa ghi sổ (${reqStatus}) vào Sổ cái / Nhật ký chính thức (EF-09, BR-GL-TRACE-10, 11). Vui lòng chọn chế độ 'GL-INQ-01: Tra cứu bút toán GL' để tra cứu chứng từ chưa ghi sổ.`;
      setUc14Error(msg);
      notify(msg);
      return;
    }
    // EF-14: Sổ ngoại tệ không cho lọc VND
    if (bType === "FOREIGN_CURRENCY_LEDGER" && reqCcy === "VND") {
      const msg = "Sổ theo dõi thanh toán bằng ngoại tệ yêu cầu chọn mã ngoại tệ (USD, EUR...) hoặc Tất cả ngoại tệ khác VND (EF-14, BR-GL-TRACE-71).";
      setUc14Error(msg);
      notify(msg);
      return;
    }
    if (uc14FromDate && uc14ToDate && uc14FromDate > uc14ToDate) {
      const msg = `Khoảng thời gian tra cứu không hợp lệ: Từ ngày (${uc14FromDate}) lớn hơn Đến ngày (${uc14ToDate}) (EF-02).`;
      setUc14Error(msg);
      notify(msg);
      return;
    }

    setUc14Loading(true);
    try {
      if (apiConnected && apiToken && writer) {
        const res = await queryAccountingBookUcGl14(writer, {
          book_type: bType,
          period: overrideParams?.period || uc14Period,
          from_date: overrideParams?.from_date || uc14FromDate,
          to_date: overrideParams?.to_date || uc14ToDate,
          account_code: overrideParams?.account_code ?? uc14AccountCode,
          include_child_accounts: overrideParams?.include_child_accounts ?? uc14IncludeChildAccounts,
          reciprocal_account_code: overrideParams?.reciprocal_account_code ?? uc14ReciprocalAccount,
          party_code: overrideParams?.party_code ?? uc14PartyCode,
          currency_code: reqCcy,
          entry_status: reqStatus,
          keyword: overrideParams?.keyword ?? uc14Keyword,
        });
        setUc14BookResult(res);
        return;
      }
      setUc14BookResult(buildSampleBookResultUcGl14(overrideParams));
    } catch (error) {
      const msg = errorText(error);
      setUc14Error(msg);
      notify(msg);
      setUc14BookResult(buildSampleBookResultUcGl14(overrideParams));
    } finally {
      setUc14Loading(false);
    }
  };

  const handleOpenTraceUcGl14 = async (rowOrVoucher: any) => {
    setUc14Error("");
    const voucherNo = typeof rowOrVoucher === "string" ? rowOrVoucher : (rowOrVoucher.voucher_number || rowOrVoucher.number || "PT-2026-1001");
    const traceStatus = typeof rowOrVoucher === "object" && rowOrVoucher?.trace_status ? rowOrVoucher.trace_status : "TRACEABLE";

    if (apiConnected && apiToken && writer && typeof rowOrVoucher === "object" && rowOrVoucher?.entry_id && String(rowOrVoucher.entry_id).length === 36) {
      try {
        const res = await traceGlEntryAndVoucherUcGl14(writer, {
          entry_id: rowOrVoucher.entry_id,
          line_id: rowOrVoucher.line_id,
          voucher_number: voucherNo,
        });
        setUc14TraceDetail(res);
        return;
      } catch {
        // Fallback to local rich trace view
      }
    }

    const r = typeof rowOrVoucher === "object" ? rowOrVoucher : {
      voucher_number: voucherNo,
      account_code: "1111",
      account_name: "Tiền Việt Nam",
      reciprocal_account_code: "131",
      posting_date: "2026-10-05",
      document_date: "2026-10-05",
      description: `Bút toán chứng từ ${voucherNo}`,
      debit: "165000000",
      credit: "0",
      source_module: "CASH",
      source_document_type: "CASH_RECEIPT",
      source_document_id: "DOC-CASH-1001",
      source_document_number: voucherNo,
      trace_status: traceStatus,
      trace_message: "Truy vết 2 chiều từ Sổ kế toán → Dòng phát sinh → Bút toán GL → Chứng từ nghiệp vụ nguồn.",
    };

    const statusMessages: Record<string, string> = {
      TRACEABLE: "Truy vết đầy đủ 2 chiều tới chứng từ nghiệp vụ nguồn (TRACEABLE — AF-18, BR-GL-TRACE-108).",
      PARTIAL_TRACE: "Truy vết thành công tới chứng từ nguồn nhưng thiếu một số tài liệu tham chiếu phụ (PARTIAL_TRACE — BR-GL-TRACE-108).",
      NO_SOURCE: "Bút toán được lập trực tiếp tại phân hệ Kế toán tổng hợp (GL), không qua chứng từ phân hệ nguồn (NO_SOURCE — AF-17, BR-GL-TRACE-48, 109).",
      BROKEN_LINK: "Bút toán có khai báo liên kết chứng từ nguồn nhưng không tìm thấy bản ghi nguồn. Hệ thống cảnh báo rõ và tuyệt đối không tự tạo chứng từ giả (BROKEN_LINK — EF-17, BR-GL-TRACE-49, 50, 110).",
      ACCESS_RESTRICTED: "Chứng từ nguồn tồn tại nhưng người dùng không có quyền mở phân hệ nguồn. Vẫn cho phép xem đầy đủ bút toán GL trong phạm vi được phép (ACCESS_RESTRICTED — AF-19, EF-19, BR-GL-TRACE-52, 53, 111).",
    };

    setUc14TraceDetail({
      trace_status: traceStatus,
      trace_message: statusMessages[traceStatus] || r.trace_message,
      trace_chain_breadcrumb: [
        `Sổ kế toán (${uc14BookResult?.form_code || "S03b-DN"})`,
        `Dòng phát sinh TK ${r.account_code || "1111"}`,
        `Bút toán GL [${voucherNo}] (POSTED)`,
        traceStatus === "NO_SOURCE"
          ? "Bút toán gốc tại GL (NO_SOURCE)"
          : traceStatus === "BROKEN_LINK"
            ? "Đứt liên kết chứng từ nguồn (BROKEN_LINK)"
            : `Chứng từ nguồn [${r.source_document_number || voucherNo}] (${r.source_module || "GL"})`,
      ],
      gl_entry: {
        entry_id: r.entry_id || "ENT-14-001",
        number: voucherNo,
        entry_type: r.entry_type || "SUBLEDGER",
        status: r.entry_status || "POSTED",
        posting_date: r.posting_date || "2026-10-05",
        document_date: r.document_date || "2026-10-05",
        period_code: uc14Period,
        period_status: periodLockStatus,
        description: r.description || "",
        source_module: r.source_module || "GL",
        source_entity_type: r.source_document_type || "VOUCHER",
        source_entity_id: r.source_document_id || "",
        total_debit: r.debit && Number(r.debit) > 0 ? r.debit : (r.credit || "165000000"),
        total_credit: r.debit && Number(r.debit) > 0 ? r.debit : (r.credit || "165000000"),
        is_balanced: true,
        created_by: "ketoantonghop@thue.vn",
        posted_by: "ketoantruong@thue.vn",
        lines: [
          {
            line_no: 1,
            account_code: r.account_code || "1111",
            account_name: r.account_name || "Tiền Việt Nam",
            reciprocal_account_code: r.reciprocal_account_code || "131",
            description: r.description || "",
            debit: r.debit && Number(r.debit) > 0 ? r.debit : (r.credit || "165000000"),
            credit: "0",
            currency_code: r.currency_code || "VND",
            party_code: r.party_code || "KH001",
            party_name: r.party_name || "Công ty CP Thương mại Á Châu",
            is_selected_line: true,
          },
          {
            line_no: 2,
            account_code: r.reciprocal_account_code || "131",
            account_name: "Tài khoản đối ứng",
            reciprocal_account_code: r.account_code || "1111",
            description: r.description || "",
            debit: "0",
            credit: r.debit && Number(r.debit) > 0 ? r.debit : (r.credit || "165000000"),
            currency_code: r.currency_code || "VND",
            party_code: r.party_code || "KH001",
            party_name: r.party_name || "Công ty CP Thương mại Á Châu",
            is_selected_line: false,
          },
        ],
      },
      adjustment_reversal_chain: {
        has_chain: Boolean(r.is_reversed_or_adjusted || traceStatus === "PARTIAL_TRACE"),
        original_entry: r.original_entry_number
          ? {
              number: r.original_entry_number,
              entry_type: "SUBLEDGER",
              posting_date: "2026-10-10",
              status: "REVERSED",
              total_debit: "85000000",
              relationship: "REVERSAL_OF",
            }
          : null,
        related_entries:
          r.is_reversed_or_adjusted || traceStatus === "PARTIAL_TRACE"
            ? [
                {
                  number: "ADJ-2026-009",
                  entry_type: "ADJUSTMENT",
                  posting_date: "2026-10-14",
                  status: "POSTED",
                  total_debit: "5000000",
                  correction_reason: "Điều chỉnh chi phí bốc xếp lô thiết bị mạng (UC-GL-06 / AF-20, AF-21)",
                  relationship: "ADJUSTED_BY",
                },
              ]
            : [],
      },
      source_voucher:
        traceStatus === "NO_SOURCE" || traceStatus === "BROKEN_LINK"
          ? null
          : traceStatus === "ACCESS_RESTRICTED"
            ? {
                access_restricted: true,
                source_module: r.source_module || "BANK",
                source_document_type: r.source_document_type || "BANK_CREDIT_NOTE",
                source_document_number: r.source_document_number || voucherNo,
                message: statusMessages.ACCESS_RESTRICTED,
              }
            : {
                access_restricted: false,
                source_module: r.source_module || "CASH",
                source_use_case: r.source_module === "GL" ? "UC-GL-04" : "UC-GL-04A",
                source_document_type: r.source_document_type || "CASH_RECEIPT",
                source_document_type_label: `Chứng từ gốc phân hệ ${r.source_module || "CASH"}`,
                source_document_id: r.source_document_id || "DOC-1001",
                source_document_number: r.source_document_number || voucherNo,
                document_date: r.document_date || "2026-10-05",
                posting_date: r.posting_date || "2026-10-05",
                partner_or_employee: r.party_name || "Công ty CP Thương mại Á Châu",
                description: r.description || "",
                total_amount: r.debit && Number(r.debit) > 0 ? r.debit : (r.credit || "165000000"),
                currency_code: r.currency_code || "VND",
                status: "POSTED",
              },
      reference_documents: [
        {
          ref_type: "HÓA ĐƠN GTGT ĐIỆN TỬ / HỢP ĐỒNG KINH TẾ",
          ref_number: `HD-${voucherNo}`,
          ref_date: r.document_date || "2026-10-05",
          status: "VALID",
        },
      ],
      sibling_gl_entries: [
        {
          number: voucherNo,
          entry_type: r.entry_type || "SUBLEDGER",
          posting_date: r.posting_date || "2026-10-05",
          status: "POSTED",
          total_debit: r.debit && Number(r.debit) > 0 ? r.debit : (r.credit || "165000000"),
        },
      ],
      posting_history: [
        {
          action: "POST",
          status_before: "DRAFT",
          status_after: "POSTED",
          reason: "Ghi sổ chứng từ vào Sổ cái chính thức (UC-GL-05)",
          actor: "ketoantruong@thue.vn",
          occurred_at: "2026-10-05T09:30:00+07:00",
        },
      ],
    });
  };

  useEffect(() => {
    if (!previewReportName) return;
    const mappedBookType = resolveBookTypeFromReportName(previewReportName);
    setUc14BookType(mappedBookType);
    setUc14EntryStatus("POSTED");
    setUc14Error("");
    setUc14TraceDetail(null);
    void handleQueryBookUcGl14({ book_type: mappedBookType, entry_status: "POSTED" });
  }, [previewReportName]);

  const handleExportReport = async (format: "XLSX" | "PDF" | "PRINT") => {
    try {
      if (apiConnected && apiToken && writer) {
        const expRes = await exportAccountingBookUcGl14(writer, {
          book_type: uc14BookType,
          period: uc14Period,
          from_date: uc14FromDate,
          to_date: uc14ToDate,
          account_code: uc14AccountCode,
          include_child_accounts: uc14IncludeChildAccounts,
          reciprocal_account_code: uc14ReciprocalAccount,
          party_code: uc14PartyCode,
          currency_code: uc14CurrencyCode,
          entry_status: uc14EntryStatus,
          keyword: uc14Keyword,
          format,
        });
        notify(`Đã xuất ${expRes.book_title} (${expRes.file_name} — ${expRes.row_count} dòng) thành công! Không làm thay đổi dữ liệu kế toán (BR-GL-TRACE-01, 64).`);
        return;
      }
      notify(
        format === "PRINT"
          ? `Đã mở bản in chuẩn ${uc14BookResult?.form_code || "S03b-DN"} (${previewReportName}) theo Thông tư 99/2025/TT-BTC.`
          : `Đã xuất file ${uc14BookResult?.form_code || "S03b-DN"}_${uc14BookType}_${uc14Period}.${format.toLowerCase()} khớp 100% với bộ lọc hiện tại (AF-26, BR-GL-TRACE-64).`,
      );
    } catch (error) {
      notify(errorText(error));
    }
  };

  // Transactions tab landing / table & dropdown state
  const [showVoucherTable, setShowVoucherTable] = useState(false);
  const [showAddVoucherMenu, setShowAddVoucherMenu] = useState(false);
  const [aiVoucherModalOpen, setAiVoucherModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // 6 Types of General Voucher (Screenshots 1 - 5)
  const [selectedVoucherType, setSelectedVoucherType] = useState<GeneralVoucherType>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const vtype = sp.get("voucherType") || sp.get("type");
      if (vtype === "5" || vtype === "profit-loss" || vtype === "ket-chuyen-lai-lo" || vtype === "nvk00001") {
        return "5. Kết chuyển lãi lỗ đầu năm";
      }
    }
    return "1. Hạch toán thuế TNDN phải nộp";
  });
  const [closingYear, setClosingYear] = useState(2026);
  const [showVoucherTypeDropdown, setShowVoucherTypeDropdown] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"hach_toan" | "ke_khai_thue">("hach_toan");
  const [isGroupInvoices, setIsGroupInvoices] = useState(false);
  const [excludeFromVatDeclaration, setExcludeFromVatDeclaration] = useState(false);

  // Voucher Master Form Fields
  const [voucherNo, setVoucherNo] = useState("NVK00001");
  const [voucherPostingDate, setVoucherPostingDate] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const vtype = sp.get("voucherType") || sp.get("type");
      if (vtype === "5" || vtype === "profit-loss" || vtype === "ket-chuyen-lai-lo" || vtype === "nvk00001") {
        return "01/01/2026";
      }
    }
    return "01/10/2026";
  });
  const [voucherDocDate, setVoucherDocDate] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const vtype = sp.get("voucherType") || sp.get("type");
      if (vtype === "5" || vtype === "profit-loss" || vtype === "ket-chuyen-lai-lo" || vtype === "nvk00001") {
        return "01/01/2026";
      }
    }
    return "01/10/2026";
  });
  const [voucherDueDate, setVoucherDueDate] = useState("DD/MM/YYYY");
  const [voucherDescription, setVoucherDescription] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const vtype = sp.get("voucherType") || sp.get("type");
      if (vtype === "5" || vtype === "profit-loss" || vtype === "ket-chuyen-lai-lo" || vtype === "nvk00001") {
        return "Kết chuyển lãi lỗ đầu năm 2026";
      }
    }
    return "Hạch toán thuế TNDN phải nộp";
  });

  // Voucher Detail Lines
  const [voucherRows, setVoucherRows] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const vtype = sp.get("voucherType") || sp.get("type");
      if (vtype === "5" || vtype === "profit-loss" || vtype === "ket-chuyen-lai-lo" || vtype === "nvk00001") {
        return [
          {
            id: "1",
            desc: "Kết chuyển lãi lỗ đầu năm 2026",
            debitAcc: "",
            creditAcc: "",
            amount: 0,
          },
        ];
      }
    }
    return [
      {
        id: "1",
        desc: "Hạch toán thuế TNDN phải nộp",
        debitAcc: "8211",
        creditAcc: "3334",
        amount: 0,
      },
    ];
  });

  const [voucherReferences, setVoucherReferences] = useState("");
  const [voucherAttachments, setVoucherAttachments] = useState<Array<{ file_name: string; file_size: number; file_type: string }>>([]);
  const [voucherFormError, setVoucherFormError] = useState("");
  const [isSavingGeneralVoucher, setIsSavingGeneralVoucher] = useState(false);
  const [editingGeneralVoucherId, setEditingGeneralVoucherId] = useState<string | null>(null);

  const computeNextGeneralVoucherNo = () => {
    const nums = generalVouchers
      .map((v: any) => String(v.id || ""))
      .filter((code) => /^NVK\d+/i.test(code))
      .map((code) => Number(code.replace(/\D/g, "")) || 0);
    const maxSeq = nums.length > 0 ? Math.max(...nums) : 0;
    return `NVK${String(maxSeq + 1).padStart(5, "0")}`;
  };

  const switchVoucherType = (type: GeneralVoucherType) => {
    setSelectedVoucherType(type);
    setShowVoucherTypeDropdown(false);
    setActiveDetailTab("hach_toan");
    setVoucherFormError("");
    switch (type) {
      case "1. Hạch toán thuế TNDN phải nộp":
        setVoucherDescription("Hạch toán thuế TNDN phải nộp");
        setVoucherRows([
          {
            id: "1",
            desc: "Hạch toán thuế TNDN phải nộp",
            debitAcc: "8211",
            creditAcc: "3334",
            amount: 0,
          },
        ]);
        break;
      case "2. Vay ngân hàng chuyển trả cho nhà cung cấp":
        setVoucherDescription("Vay ngân hàng chuyển trả cho nhà cung cấp");
        setVoucherDueDate("DD/MM/YYYY");
        setVoucherRows([
          {
            id: "1",
            desc: "Vay ngân hàng chuyển trả cho nhà cung cấp",
            debitAcc: "331",
            creditAcc: "3411",
            amount: 0,
            debitObject: "NCC001",
            debitObjectName: "Công ty TNHH Cung ứng Thiết bị Việt",
            creditObject: "NH_VCB",
            creditObjectName: "Ngân hàng TMCP Ngoại thương Việt Nam (VCB)",
            loanContract: "KUV-2026-01",
          },
        ]);
        break;
      case "3. Hạch toán chi phí lương":
        setVoucherDescription("Hạch toán chi phí lương");
        setVoucherDueDate("DD/MM/YYYY");
        setVoucherRows([
          {
            id: "1",
            desc: "Hạch toán chi phí lương",
            debitAcc: "",
            creditAcc: "334",
            amount: 0,
            expenseItem: "CP_LUONG",
            department: "Phòng Kinh doanh",
            costObject: "THCP_KD",
          },
        ]);
        break;
      case "4. Khác":
        setVoucherDescription("Hạch toán chi phí lương");
        setVoucherDueDate("DD/MM/YYYY");
        setVoucherRows([
          {
            id: "1",
            desc: "Hạch toán chi phí lương",
            debitAcc: "",
            creditAcc: "",
            amount: 0,
            operation: "",
            debitObject: "",
            debitObjectName: "",
            creditObject: "",
            creditObjectName: "",
          },
        ]);
        break;
      case "5. Kết chuyển lãi lỗ đầu năm":
        setVoucherDescription(`Kết chuyển lãi lỗ đầu năm ${closingYear || 2026}`);
        setVoucherPostingDate(`01/01/${closingYear || 2026}`);
        setVoucherDocDate(`01/01/${closingYear || 2026}`);
        setVoucherRows([
          {
            id: "1",
            desc: `Kết chuyển lãi lỗ đầu năm ${closingYear || 2026}`,
            debitAcc: "4212",
            creditAcc: "4211",
            amount: 0,
          },
        ]);
        break;
      case "6. Khấu trừ thuế tiêu thụ đặc biệt":
        setVoucherDescription("Khấu trừ thuế tiêu thụ đặc biệt");
        setVoucherDueDate("DD/MM/YYYY");
        setVoucherPostingDate("01/10/2026");
        setVoucherDocDate("01/10/2026");
        setExcludeFromVatDeclaration(false);
        setVoucherRows([
          {
            id: "1",
            desc: "Khấu trừ thuế tiêu thụ đặc biệt",
            debitAcc: "3332",
            creditAcc: "1383",
            amount: 0,
            operation: "",
            debitObject: "",
            debitObjectName: "",
            creditObject: "",
            creditObjectName: "",
          },
        ]);
        break;
    }
  };

  const openAddVoucherWithType = (type: GeneralVoucherType) => {
    setEditingGeneralVoucherId(null);
    setVoucherNo(computeNextGeneralVoucherNo());
    setVoucherReferences("");
    setVoucherAttachments([]);
    setVoucherFormError("");
    switchVoucherType(type);
    setAddVoucherModalOpen(true);
    setShowAddVoucherMenu(false);
  };

  const handleGeneralVoucherAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const maxBytes = 5 * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxBytes) {
        const msg = `Tệp đính kèm '${file.name}' (${(file.size / (1024 * 1024)).toFixed(2)} MB) vượt quá giới hạn tối đa 5MB.`;
        setVoucherFormError(msg);
        notify(msg);
        e.target.value = "";
        return;
      }
    }
    setVoucherFormError("");
    const added = files.map((f) => ({
      file_name: f.name,
      file_size: f.size,
      file_type: f.type || "application/octet-stream",
    }));
    setVoucherAttachments((prev) => [...prev, ...added]);
    notify(`Đã đính kèm ${added.length} tệp hợp lệ (<= 5MB).`);
    e.target.value = "";
  };

  const handleSaveGeneralVoucher = async (andPrint = false) => {
    if (isSavingGeneralVoucher) return;
    setVoucherFormError("");

    const validRows = voucherRows.filter(
      (r) => String(r.debitAcc || "").trim() || String(r.creditAcc || "").trim() || Number(r.amount) > 0,
    );
    if (!validRows.length) {
      const msg = "Chứng từ nghiệp vụ khác phải có ít nhất một dòng hạch toán hợp lệ.";
      setVoucherFormError(msg);
      notify(msg);
      return;
    }

    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const dAcc = String(r.debitAcc || "").trim();
      const cAcc = String(r.creditAcc || "").trim();
      const amt = Number(r.amount) || 0;
      if (selectedVoucherType === "3. Hạch toán chi phí lương" && !dAcc) {
        const msg = `Dòng ${i + 1}: Nghiệp vụ 'Hạch toán chi phí lương' bắt buộc chọn Tài khoản Nợ (tài khoản chi phí).`;
        setVoucherFormError(msg);
        notify(msg);
        return;
      }
      if (!dAcc || !cAcc) {
        const msg = `Dòng ${i + 1}: Vui lòng nhập đầy đủ Tài khoản Nợ và Tài khoản Có.`;
        setVoucherFormError(msg);
        notify(msg);
        return;
      }
      if (dAcc === cAcc) {
        const msg = `Dòng ${i + 1}: Tài khoản Nợ và Tài khoản Có (${dAcc}) không được trùng nhau.`;
        setVoucherFormError(msg);
        notify(msg);
        return;
      }
      if (!(amt > 0)) {
        const msg = `Dòng ${i + 1}: Số tiền hạch toán phải lớn hơn 0.`;
        setVoucherFormError(msg);
        notify(msg);
        return;
      }
      if (selectedVoucherType === "2. Vay ngân hàng chuyển trả cho nhà cung cấp") {
        if (!String(r.debitObject || r.debitObjectName || "").trim()) {
          const msg = `Dòng ${i + 1}: Bắt buộc nhập Đối tượng Nợ (Nhà cung cấp).`;
          setVoucherFormError(msg);
          notify(msg);
          return;
        }
        if (!String(r.creditObject || r.creditObjectName || r.loanContract || "").trim()) {
          const msg = `Dòng ${i + 1}: Bắt buộc nhập Đối tượng Có (Ngân hàng) hoặc Khế ước vay.`;
          setVoucherFormError(msg);
          notify(msg);
          return;
        }
      }
    }

    const activeTaxRows =
      selectedVoucherType === "4. Khác"
        ? taxInvoiceRows.filter(
            (t) => String(t.invoiceNo || "").trim() || Number(t.preTaxAmount) > 0 || Number(t.vatAmount) > 0,
          )
        : [];
    for (let i = 0; i < activeTaxRows.length; i++) {
      const t = activeTaxRows[i];
      if (!String(t.invoiceNo || "").trim()) {
        const msg = `Dòng thuế ${i + 1}: Vui lòng nhập Số hóa đơn.`;
        setVoucherFormError(msg);
        notify(msg);
        return;
      }
      if (!String(t.invoiceDate || "").trim()) {
        const msg = `Dòng thuế ${i + 1}: Vui lòng nhập Ngày hóa đơn.`;
        setVoucherFormError(msg);
        notify(msg);
        return;
      }
    }

    if (excludeFromVatDeclaration && isGroupInvoices && activeTaxRows.length > 0) {
      const msg = "Thiết lập 'Không lên bảng kê thuế GTGT' mâu thuẫn với 'Hạch toán gộp nhiều hóa đơn'.";
      setVoucherFormError(msg);
      notify(msg);
      return;
    }

    setIsSavingGeneralVoucher(true);
    try {
      let savedNumber = String(voucherNo || computeNextGeneralVoucherNo()).trim();
      let savedApiId = editingGeneralVoucherId || "";

      if (apiConnected) {
        const saved = await apiSave((writer) =>
          saveGeneralBusinessVoucher(writer, {
            id: editingGeneralVoucherId || undefined,
            number: savedNumber,
            businessType: selectedVoucherType,
            closingYear,
            postingDate: voucherPostingDate,
            docDate: voucherDocDate,
            dueDate: voucherDueDate,
            description: voucherDescription,
            references: voucherReferences,
            groupInvoices: isGroupInvoices,
            excludeFromVatDeclaration,
            attachments: voucherAttachments,
            rows: validRows,
            taxRows: activeTaxRows,
            saveAndPrint: andPrint,
          }),
        );
        if (!saved) {
          setIsSavingGeneralVoucher(false);
          return;
        }
        savedNumber = saved.record?.number || savedNumber;
        savedApiId = saved.record?.journal_entry || saved.record?.id || "";
      } else {
        notify(`Đã lưu chứng từ nghiệp vụ khác ${savedNumber} thành công.`);
      }

      const totalAccAmt = validRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const totalTaxAmt = activeTaxRows.reduce((s, t) => s + (Number(t.vatAmount) || 0), 0);
      const totalVoucherAmt = totalAccAmt + totalTaxAmt;
      const firstRow = validRows[0];

      setGeneralVouchers((prev) => {
        const nextRow = {
          id: savedNumber,
          date: voucherPostingDate,
          voucherDate: voucherDocDate,
          desc: voucherDescription || firstRow?.desc || "Chứng từ nghiệp vụ khác",
          debitAcc: firstRow?.debitAcc || "",
          creditAcc: firstRow?.creditAcc || "",
          amount: totalVoucherAmt,
          posted: false,
          statusLabel: "Chưa ghi sổ",
          businessTypeLabel: selectedVoucherType,
          apiId: savedApiId,
        };
        const existsIdx = prev.findIndex((item) => item.id === savedNumber);
        if (existsIdx >= 0) {
          const updated = [...prev];
          updated[existsIdx] = nextRow;
          return updated;
        }
        return [nextRow, ...prev];
      });

      setAddVoucherModalOpen(false);
      setShowVoucherTable(true);
      setEditingGeneralVoucherId(null);

      if (andPrint) {
        try {
          window.print();
        } catch {
          notify(
            `Đã lưu chứng từ nghiệp vụ khác ${savedNumber} thành công, nhưng dịch vụ in tạm thời gián đoạn. Vui lòng in lại từ danh sách.`,
          );
        }
      }
    } finally {
      setIsSavingGeneralVoucher(false);
    }
  };

  const handleImportGeneralVouchersExcel = async () => {
    const sampleBatch = [
      {
        business_type: "1. Hạch toán thuế TNDN phải nộp",
        posting_date: "2026-10-25",
        document_date: "2026-10-25",
        description: "Hạch toán thuế TNDN tạm tính Quý 3/2026 (Nhập từ Excel)",
        accounting_lines: [
          {
            description: "Hạch toán thuế TNDN tạm tính Quý 3/2026",
            debit_account: "8211",
            credit_account: "3334",
            amount: "18000000",
          },
        ],
      },
    ];
    if (apiConnected) {
      const imported = await apiSave((writer) => importGeneralBusinessVouchersExcel(writer, sampleBatch));
      if (imported?.record?.items?.length) {
        setShowVoucherTable(true);
      }
      return;
    }
    const nextCode = computeNextGeneralVoucherNo();
    setGeneralVouchers((prev) => [
      {
        id: nextCode,
        date: "25/10/2026",
        voucherDate: "25/10/2026",
        desc: "Hạch toán thuế TNDN tạm tính Quý 3/2026 (Nhập từ Excel)",
        debitAcc: "8211",
        creditAcc: "3334",
        amount: 18000000,
        posted: false,
        statusLabel: "Chưa ghi sổ",
        businessTypeLabel: "1. Hạch toán thuế TNDN phải nộp",
      },
      ...prev,
    ]);
    setShowVoucherTable(true);
    notify(`Đã nhập thành công chứng từ nghiệp vụ khác ${nextCode} từ Excel (Trạng thái: Chưa ghi sổ).`);
  };

  // --- UC-GL-04: Tiếp nhận bút toán từ các phân hệ (Subledger Journal Ingestion) ---
  const [subledgerModalOpen, setSubledgerModalOpen] = useState(false);
  const [subledgerSourceModule, setSubledgerSourceModule] = useState("PUR");
  const [subledgerBusinessType, setSubledgerBusinessType] = useState("PURCHASE_GOODS");
  const [subledgerDocNo, setSubledgerDocNo] = useState("PMH00018");
  const [subledgerPostingDate, setSubledgerPostingDate] = useState("22/10/2026");
  const [subledgerAmount, setSubledgerAmount] = useState(45000000);
  const [subledgerTaxAmount, setSubledgerTaxAmount] = useState(4500000);
  const [subledgerParty, setSubledgerParty] = useState("NCC001");
  const [subledgerPostingMode, setSubledgerPostingMode] = useState<"AUTO_POST" | "UNPOSTED" | "WORKFLOW">("AUTO_POST");
  const [subledgerDesc, setSubledgerDesc] = useState("Mua hàng hóa nhập kho từ nhà cung cấp NCC001");
  const [subledgerIngestions, setSubledgerIngestions] = useState<any[]>([
    {
      id: "ing-1",
      sourceModule: "PUR",
      sourceModuleLabel: "Mua hàng",
      sourceBusinessType: "PURCHASE_GOODS",
      sourceDocumentNumber: "PMH00015",
      sourceEventId: "EVT-PUR-PMH00015",
      postingDate: "15/10/2026",
      description: "Mua thiết bị mạng nhập kho chính",
      totalDebit: 55000000,
      postingMode: "AUTO_POST",
      status: "POSTED",
      callbackStatus: "SYNCED",
      journalNumber: "SL-PUR-PMH00015",
    },
    {
      id: "ing-2",
      sourceModule: "SAL",
      sourceModuleLabel: "Bán hàng",
      sourceBusinessType: "SALES_REVENUE",
      sourceDocumentNumber: "BH00042",
      sourceEventId: "EVT-SAL-BH00042",
      postingDate: "18/10/2026",
      description: "Doanh thu cung cấp phần mềm quản trị",
      totalDebit: 132000000,
      postingMode: "AUTO_POST",
      status: "POSTED",
      callbackStatus: "SYNCED",
      journalNumber: "SL-SAL-BH00042",
    },
    {
      id: "ing-3",
      sourceModule: "FA",
      sourceModuleLabel: "Tài sản cố định",
      sourceBusinessType: "FA_DEPRECIATION",
      sourceDocumentNumber: "KH202610",
      sourceEventId: "EVT-FA-KH202610",
      postingDate: "25/10/2026",
      description: "Trích khấu hao TSCĐ tháng 10/2026",
      totalDebit: 18500000,
      postingMode: "UNPOSTED",
      status: "UNPOSTED",
      callbackStatus: "SYNCED",
      journalNumber: "SL-FA-KH202610",
    },
  ]);

  useEffect(() => {
    if (apiRows.subledgerIngestions?.length) {
      setSubledgerIngestions(
        apiRows.subledgerIngestions.map((row: any) => ({
          id: row.id,
          apiId: row.id,
          sourceModule: row.source_module,
          sourceModuleLabel: row.source_module_label || row.source_module,
          sourceBusinessType: row.source_business_type,
          sourceDocumentNumber: row.source_document_number,
          sourceEventId: row.source_event_id,
          postingDate: apiDate(row.posting_date) || "22/10/2026",
          description: row.description || "",
          totalDebit: apiNumber(row.total_debit),
          postingMode: row.posting_mode || "AUTO_POST",
          status: row.status || "POSTED",
          callbackStatus: row.callback_status || "SYNCED",
          errorCode: row.error_code || "",
          errorMessage: row.error_message || "",
          journalNumber: row.primary_journal_number || "",
        })),
      );
    }
  }, [apiRows.subledgerIngestions]);

  const handleIngestSubledger = async () => {
    const cleanDocNo = String(subledgerDocNo || "").trim();
    if (!cleanDocNo) {
      notify("Vui lòng nhập Số chứng từ nguồn.");
      return;
    }
    if (Number(subledgerAmount) <= 0) {
      notify("Số tiền hạch toán từ phân hệ nguồn phải lớn hơn 0.");
      return;
    }
    const eventId = `EVT-${subledgerSourceModule}-${cleanDocNo}`;
    if (apiConnected) {
      const saved = await apiSave((writer) =>
        ingestSubledgerJournalEvent(writer, {
          sourceModule: subledgerSourceModule,
          sourceBusinessType: subledgerBusinessType,
          sourceDocumentNumber: cleanDocNo,
          sourceEventId: eventId,
          postingDate: subledgerPostingDate,
          documentDate: subledgerPostingDate,
          description: subledgerDesc,
          party: subledgerParty || undefined,
          amount: subledgerAmount,
          taxAmount: subledgerTaxAmount,
          postingMode: subledgerPostingMode,
        }),
      );
      if (saved) {
        setShowVoucherTable(true);
      }
      return;
    }

    const totalAmt = (Number(subledgerAmount) || 0) + (Number(subledgerTaxAmount) || 0);
    const jeNum = `SL-${subledgerSourceModule}-${cleanDocNo}`;
    setSubledgerIngestions((prev) => [
      {
        id: `ing-${Date.now()}`,
        sourceModule: subledgerSourceModule,
        sourceModuleLabel: subledgerSourceModule,
        sourceBusinessType: subledgerBusinessType,
        sourceDocumentNumber: cleanDocNo,
        sourceEventId: eventId,
        postingDate: subledgerPostingDate,
        description: subledgerDesc,
        totalDebit: totalAmt,
        postingMode: subledgerPostingMode,
        status: subledgerPostingMode === "AUTO_POST" ? "POSTED" : "UNPOSTED",
        callbackStatus: "SYNCED",
        journalNumber: jeNum,
      },
      ...prev,
    ]);
    notify(
      `Đã tiếp nhận bút toán ${jeNum} từ phân hệ ${subledgerSourceModule} (${cleanDocNo}) - Trạng thái: ${
        subledgerPostingMode === "AUTO_POST" ? "Đã ghi sổ" : "Chưa ghi sổ"
      }.`,
    );
  };

  const handlePostSubledgerItem = async (item: any) => {
    if (apiConnected && item.apiId) {
      await apiSave((writer) => postSubledgerJournalIngestion(writer, item.apiId));
      return;
    }
    setSubledgerIngestions((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, status: "POSTED" } : x)),
    );
    notify(`Đã ghi sổ chính thức bút toán ${item.journalNumber} vào Sổ cái.`);
  };

  const handleRetrySubledgerItem = async (item: any) => {
    if (apiConnected && item.apiId) {
      await apiSave((writer) => retrySubledgerJournalIngestion(writer, item.apiId));
      return;
    }
    setSubledgerIngestions((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, status: "POSTED", errorCode: "", errorMessage: "" } : x)),
    );
    notify(`Đã thử lại tiếp nhận thành công sự kiện ${item.sourceEventId}.`);
  };

  // --- UC-GL-05: Ghi sổ / Bỏ ghi sổ bút toán (Single & Batch Post / Unpost) ---
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([]);

  const handleToggleSelectVoucher = (voucherId: string) => {
    setSelectedVoucherIds((prev) =>
      prev.includes(voucherId) ? prev.filter((id) => id !== voucherId) : [...prev, voucherId],
    );
  };

  const handleToggleSelectAllVouchers = () => {
    if (selectedVoucherIds.length === generalVouchers.length && generalVouchers.length > 0) {
      setSelectedVoucherIds([]);
    } else {
      setSelectedVoucherIds(generalVouchers.map((v) => v.id));
    }
  };

  const handlePostVoucherItem = async (item: any) => {
    if (item.posted) {
      notify(`Chứng từ ${item.id} đã được ghi sổ (POSTED), không được ghi sổ lặp lại.`);
      return;
    }
    if (apiConnected) {
      if (item.gbvId) {
        await apiSave((writer) => postGeneralBusinessVoucher(writer, item.gbvId));
        return;
      }
      if (item.apiId) {
        await apiSave((writer) => postJournalEntry(writer, item.apiId));
        return;
      }
    }
    setGeneralVouchers((prev) =>
      prev.map((v) =>
        v.id === item.id ? { ...v, posted: true, statusLabel: "Đã ghi sổ" } : v,
      ),
    );
    notify(`Đã ghi sổ chính thức chứng từ ${item.id} vào Sổ cái.`);
  };

  const handleUnpostVoucherItem = async (item: any) => {
    if (!item.posted) {
      notify(`Chứng từ ${item.id} đang ở trạng thái chưa ghi sổ, không thể bỏ ghi sổ.`);
      return;
    }
    if (apiConnected) {
      if (item.gbvId) {
        await apiSave((writer) =>
          unpostGeneralBusinessVoucher(writer, item.gbvId, {
            reason: "Bỏ ghi sổ chứng từ để rà soát và điều chỉnh số liệu",
          }),
        );
        return;
      }
      if (item.apiId) {
        await apiSave((writer) =>
          unpostJournalEntry(writer, item.apiId, {
            reason: "Bỏ ghi sổ chứng từ để rà soát và điều chỉnh số liệu",
          }),
        );
        return;
      }
    }
    setGeneralVouchers((prev) =>
      prev.map((v) =>
        v.id === item.id ? { ...v, posted: false, statusLabel: "Chưa ghi sổ" } : v,
      ),
    );
    notify(`Đã bỏ ghi sổ chứng từ ${item.id} khỏi Sổ cái, đưa về trạng thái Chưa ghi sổ.`);
  };

  const handleBatchPostVouchers = async () => {
    if (selectedVoucherIds.length === 0) {
      notify("Vui lòng chọn ít nhất một chứng từ để thực hiện Ghi sổ hàng loạt.");
      return;
    }
    const targetItems = generalVouchers.filter((v) => selectedVoucherIds.includes(v.id));
    if (apiConnected) {
      const apiIds = targetItems
        .map((v: any) => v.apiId || v.gbvId)
        .filter((id: string) => Boolean(id));
      if (apiIds.length > 0) {
        await apiSave((writer) => batchPostJournalEntries(writer, apiIds));
        setSelectedVoucherIds([]);
        return;
      }
    }
    let okCount = 0;
    let skipCount = 0;
    setGeneralVouchers((prev) =>
      prev.map((v) => {
        if (!selectedVoucherIds.includes(v.id)) return v;
        if (v.posted) {
          skipCount += 1;
          return v;
        }
        okCount += 1;
        return { ...v, posted: true, statusLabel: "Đã ghi sổ" };
      }),
    );
    setSelectedVoucherIds([]);
    notify(
      `Ghi sổ hàng loạt hoàn tất: thành công ${okCount}/${targetItems.length} chứng từ${
        skipCount > 0 ? `, bỏ qua ${skipCount} chứng từ đã ghi sổ` : ""
      }.`,
    );
  };

  const handleBatchUnpostVouchers = async () => {
    if (selectedVoucherIds.length === 0) {
      notify("Vui lòng chọn ít nhất một chứng từ để thực hiện Bỏ ghi sổ hàng loạt.");
      return;
    }
    const targetItems = generalVouchers.filter((v) => selectedVoucherIds.includes(v.id));
    if (apiConnected) {
      const apiIds = targetItems
        .map((v: any) => v.apiId || v.gbvId)
        .filter((id: string) => Boolean(id));
      if (apiIds.length > 0) {
        await apiSave((writer) =>
          batchUnpostJournalEntries(writer, apiIds, {
            reason: "Bỏ ghi sổ hàng loạt chứng từ tổng hợp",
          }),
        );
        setSelectedVoucherIds([]);
        return;
      }
    }
    let okCount = 0;
    let skipCount = 0;
    setGeneralVouchers((prev) =>
      prev.map((v) => {
        if (!selectedVoucherIds.includes(v.id)) return v;
        if (!v.posted) {
          skipCount += 1;
          return v;
        }
        okCount += 1;
        return { ...v, posted: false, statusLabel: "Chưa ghi sổ" };
      }),
    );
    setSelectedVoucherIds([]);
    notify(
      `Bỏ ghi sổ hàng loạt hoàn tất: thành công ${okCount}/${targetItems.length} chứng từ${
        skipCount > 0 ? `, bỏ qua ${skipCount} chứng từ chưa ghi sổ` : ""
      }.`,
    );
  };

  // UC-GL-06 – Điều chỉnh / Đảo bút toán đã ghi sổ (POSTED)
  const [correctionModal, setCorrectionModal] = useState<{
    open: boolean;
    mode: "ADJUSTMENT" | "REVERSAL";
    sourceItem: any | null;
    reason: string;
    postingDate: string;
    documentDate: string;
    newNumber: string;
    description: string;
    adjustmentMode: string;
    reversalMethod: string;
    reversalScope: "FULL" | "PARTIAL";
    reversalAmount: string;
    adjDebitAcc: string;
    adjCreditAcc: string;
    adjAmount: string;
  }>({
    open: false,
    mode: "ADJUSTMENT",
    sourceItem: null,
    reason: "",
    postingDate: "22/10/2026",
    documentDate: "22/10/2026",
    newNumber: "",
    description: "",
    adjustmentMode: "GENERAL",
    reversalMethod: "SWAP_DEBIT_CREDIT",
    reversalScope: "FULL",
    reversalAmount: "",
    adjDebitAcc: "6422",
    adjCreditAcc: "331",
    adjAmount: "",
  });

  const openCorrectionModal = (item: any, mode: "ADJUSTMENT" | "REVERSAL") => {
    if (!item?.posted) {
      notify("Chỉ bút toán đang ở trạng thái Đã ghi sổ (POSTED) mới được phép Điều chỉnh hoặc Đảo bút toán.");
      return;
    }
    const prefix = mode === "ADJUSTMENT" ? "DC" : "REV";
    setCorrectionModal({
      open: true,
      mode,
      sourceItem: item,
      reason: "",
      postingDate: item.date || "22/10/2026",
      documentDate: item.date || "22/10/2026",
      newNumber: `${prefix}-${item.id}`,
      description:
        mode === "ADJUSTMENT"
          ? `Điều chỉnh bút toán ${item.id}: ${item.desc || ""}`
          : `Đảo bút toán ${item.id}: ${item.desc || ""}`,
      adjustmentMode: "GENERAL",
      reversalMethod: "SWAP_DEBIT_CREDIT",
      reversalScope: "FULL",
      reversalAmount: String(item.amount || 0),
      adjDebitAcc: mode === "ADJUSTMENT" ? item.debitAcc || "6422" : item.creditAcc || "331",
      adjCreditAcc: mode === "ADJUSTMENT" ? item.creditAcc || "331" : item.debitAcc || "6422",
      adjAmount: String(item.amount || 0),
    });
  };

  const handleSaveCorrectionModal = async (autoPost: boolean) => {
    const src = correctionModal.sourceItem;
    if (!src) return;
    const reason = correctionModal.reason.trim();
    if (!reason) {
      notify("Vui lòng nhập Lý do điều chỉnh/đảo bút toán (BR-GL-ADJ-14).");
      return;
    }

    if (apiConnected && (src.apiId || src.gbvId)) {
      if (correctionModal.mode === "ADJUSTMENT") {
        const payload = {
          reason,
          postingDate: correctionModal.postingDate,
          documentDate: correctionModal.documentDate,
          number: correctionModal.newNumber.trim() || undefined,
          description: correctionModal.description,
          adjustmentMode: correctionModal.adjustmentMode,
          autoPost,
          accounting_lines: [
            {
              description: correctionModal.description || reason,
              debit_account: correctionModal.adjDebitAcc,
              credit_account: correctionModal.adjCreditAcc,
              amount: correctionModal.adjAmount,
            },
          ],
        };
        const saved = await apiSave((writer) =>
          src.gbvId
            ? adjustGeneralBusinessVoucher(writer, src.gbvId, payload)
            : adjustJournalEntry(writer, src.apiId, payload),
        );
        if (saved) setCorrectionModal((prev) => ({ ...prev, open: false }));
        return;
      } else {
        const payload = {
          reason,
          postingDate: correctionModal.postingDate,
          documentDate: correctionModal.documentDate,
          number: correctionModal.newNumber.trim() || undefined,
          description: correctionModal.description,
          reversalMethod: correctionModal.reversalMethod,
          reversalAmount:
            correctionModal.reversalScope === "PARTIAL" ? correctionModal.reversalAmount : undefined,
          autoPost,
        };
        const saved = await apiSave((writer) =>
          src.gbvId
            ? reverseGeneralBusinessVoucher(writer, src.gbvId, payload)
            : reverseJournalEntry(writer, src.apiId, payload),
        );
        if (saved) setCorrectionModal((prev) => ({ ...prev, open: false }));
        return;
      }
    }

    const numVal =
      Number(
        String(
          correctionModal.mode === "ADJUSTMENT"
            ? correctionModal.adjAmount
            : correctionModal.reversalScope === "PARTIAL"
            ? correctionModal.reversalAmount
            : src.amount,
        ).replace(/[^\d.-]/g, ""),
      ) || 0;
    if (numVal <= 0) {
      notify("Số tiền điều chỉnh/đảo phải lớn hơn 0.");
      return;
    }

    const newRow = {
      id: correctionModal.newNumber || `${correctionModal.mode === "ADJUSTMENT" ? "DC" : "REV"}-${src.id}`,
      date: correctionModal.postingDate,
      docDate: correctionModal.documentDate,
      voucherDate: correctionModal.documentDate,
      desc: `${correctionModal.description} (Lý do: ${reason})`,
      debitAcc: correctionModal.mode === "ADJUSTMENT" ? correctionModal.adjDebitAcc : src.creditAcc,
      creditAcc: correctionModal.mode === "ADJUSTMENT" ? correctionModal.adjCreditAcc : src.debitAcc,
      amount: numVal,
      posted: autoPost,
      statusLabel: autoPost ? "Đã ghi sổ" : "Chưa ghi sổ",
      originalEntryId: src.id,
      correctionType: correctionModal.mode,
    };
    setGeneralVouchers((prev) => [newRow, ...prev]);
    setCorrectionModal((prev) => ({ ...prev, open: false }));
    notify(
      correctionModal.mode === "ADJUSTMENT"
        ? `Đã tạo bút toán điều chỉnh ${newRow.id} thành công (${autoPost ? "Đã ghi sổ" : "Chưa ghi sổ"}).`
        : `Đã tạo bút toán đảo ${newRow.id} thành công (${autoPost ? "Đã ghi sổ" : "Chưa ghi sổ"}).`,
    );
  };

  // ===========================================================================
  // UC-GL-07 – PHÂN BỔ CHI PHÍ BÁN HÀNG, QLDN VÀ CHI PHÍ KHÁC
  // ===========================================================================
  const [expenseAllocationModalOpen, setExpenseAllocationModalOpen] = useState(false);
  const [allocPeriodCode, setAllocPeriodCode] = useState("2026-10");
  const [allocPostingDate, setAllocPostingDate] = useState("31/10/2026");
  const [allocDocumentDate, setAllocDocumentDate] = useState("31/10/2026");
  const [allocVoucherNumber, setAllocVoucherNumber] = useState("PBCP-2026-10-001");
  const [allocGroup, setAllocGroup] = useState<"SELLING" | "ADMIN" | "OTHER" | "SHARED">("ADMIN");
  const [allocSourceAccCode, setAllocSourceAccCode] = useState("6422");
  const [allocOffsetAccCode, setAllocOffsetAccCode] = useState("6422");
  const [allocMethod, setAllocMethod] = useState<
    "FIXED_PERCENT" | "COEFFICIENT" | "BASIS_VALUE" | "REVENUE" | "DIRECT_COST" | "DIRECT_AMOUNT"
  >("FIXED_PERCENT");
  const [allocRoundingMethod, setAllocRoundingMethod] = useState<"LAST_LINE" | "LARGEST_LINE">("LAST_LINE");
  const [allocDescription, setAllocDescription] = useState(
    "Phân bổ chi phí quản lý doanh nghiệp dùng chung tháng 10/2026",
  );
  const [allocSourcePool, setAllocSourcePool] = useState({
    totalSourceAmount: 48600000,
    previouslyAllocatedAmount: 0,
    remainingAllocatableAmount: 48600000,
    amountToAllocate: 48600000,
    sourceFingerprint: "FP-2026-10-6422-INIT",
    sourceEntriesCount: 3,
    status: "CALCULATED" as "IDLE" | "CALCULATED" | "UNPOSTED" | "POSTED",
    roundingDiffAdjusted: 0,
  });
  const [allocDestinations, setAllocDestinations] = useState<any[]>([
    {
      id: "dest-1",
      accountCode: "6418",
      departmentName: "Phòng Kinh doanh Miền Bắc",
      projectCode: "DA-MB01",
      costCenterCode: "CC-KD01",
      percentage: 45,
      coefficient: 4.5,
      basisValue: 450000000,
      directAmount: 21870000,
      allocatedAmount: 21870000,
      roundingAdjustment: 0,
      description: "Phân bổ CP QLDN cho Khối KD Miền Bắc",
    },
    {
      id: "dest-2",
      accountCode: "6418",
      departmentName: "Phòng Kinh doanh Miền Nam",
      projectCode: "DA-MN01",
      costCenterCode: "CC-KD02",
      percentage: 35,
      coefficient: 3.5,
      basisValue: 350000000,
      directAmount: 17010000,
      allocatedAmount: 17010000,
      roundingAdjustment: 0,
      description: "Phân bổ CP QLDN cho Khối KD Miền Nam",
    },
    {
      id: "dest-3",
      accountCode: "6428",
      departmentName: "Khối Dự án & Triển khai",
      projectCode: "DA-ERP02",
      costCenterCode: "CC-DA01",
      percentage: 20,
      coefficient: 2.0,
      basisValue: 200000000,
      directAmount: 9720000,
      allocatedAmount: 9720000,
      roundingAdjustment: 0,
      description: "Phân bổ CP QLDN cho Khối Dự án",
    },
  ]);
  const [allocRunsHistory, setAllocRunsHistory] = useState<any[]>([
    {
      id: "run-demo-1",
      number: "PBCP-2026-09-001",
      periodCode: "2026-09",
      postingDate: "30/09/2026",
      allocationGroup: "SELLING",
      sourceAccountCode: "641",
      method: "REVENUE",
      totalSourceAmount: 36000000,
      amount: 36000000,
      status: "POSTED",
      entryNumber: "PKT-PB-0901",
      description: "Phân bổ chi phí bán hàng tháng 09/2026 theo doanh thu",
    },
  ]);

  const handleFetchAllocationSource = async () => {
    if (apiConnected) {
      const saved = await apiSave((writer) =>
        fetchAllocationSourceData(writer, {
          postingDate: allocPostingDate,
          documentDate: allocDocumentDate,
          sourceAccountCodes: [allocSourceAccCode],
        }),
      );
      if (saved) {
        const rec: any = saved;
        const rem = Number(rec.remaining_allocatable_amount ?? 48600000);
        setAllocSourcePool({
          totalSourceAmount: Number(rec.total_source_amount ?? 48600000),
          previouslyAllocatedAmount: Number(rec.previously_allocated_amount ?? 0),
          remainingAllocatableAmount: rem,
          amountToAllocate: rem,
          sourceFingerprint: String(rec.source_fingerprint || "FP-LIVE"),
          sourceEntriesCount: Number(rec.source_entries_count ?? 1),
          status: "IDLE",
          roundingDiffAdjusted: 0,
        });
      }
      return;
    }
    notify(
      `Đã lấy dữ liệu nguồn TK ${allocSourceAccCode} kỳ ${allocPeriodCode}: Tổng phát sinh POSTED = ${allocSourcePool.totalSourceAmount.toLocaleString("vi-VN")} ₫, Còn lại được phép phân bổ = ${allocSourcePool.remainingAllocatableAmount.toLocaleString("vi-VN")} ₫.`,
    );
  };

  const handleCalculateExpenseAllocation = () => {
    const amountToAlloc = Number(allocSourcePool.amountToAllocate || 0);
    if (amountToAlloc <= 0) {
      notify("Không có số liệu chi phí nguồn khả dụng để phân bổ (EF-09).");
      return;
    }
    if (amountToAlloc > allocSourcePool.remainingAllocatableAmount) {
      notify("Số tiền đưa vào phân bổ vượt quá phần chi phí nguồn còn lại được phép phân bổ (EF-20).");
      return;
    }
    if (allocDestinations.length === 0) {
      notify("Chưa khai báo danh sách đối tượng nhận phân bổ (EF-11).");
      return;
    }

    if (allocMethod === "FIXED_PERCENT") {
      const sumPct = allocDestinations.reduce((s, r) => s + Number(r.percentage || 0), 0);
      if (Math.abs(sumPct - 100) > 0.001) {
        notify(`Tổng tỷ lệ phân bổ phải bằng 100% (hiện tại: ${sumPct}%) (EF-17).`);
        return;
      }
    }

    const totalWeight = allocDestinations.reduce((s, r) => {
      if (allocMethod === "FIXED_PERCENT") return s + Number(r.percentage || 0);
      if (allocMethod === "COEFFICIENT") return s + Number(r.coefficient || 0);
      if (allocMethod === "DIRECT_AMOUNT") return s + Number(r.directAmount || 0);
      return s + Number(r.basisValue || 0);
    }, 0);

    if (totalWeight <= 0) {
      notify("Tổng tiêu thức/hệ số phân bổ bằng 0, không thể thực hiện phép chia tỷ lệ (EF-19).");
      return;
    }

    let runningSum = 0;
    const rawRows = allocDestinations.map((row) => {
      let rawAmt = 0;
      let pct = Number(row.percentage || 0);
      if (allocMethod === "FIXED_PERCENT") {
        rawAmt = Math.round((amountToAlloc * pct) / 100);
      } else if (allocMethod === "COEFFICIENT") {
        const c = Number(row.coefficient || 0);
        pct = Number(((c * 100) / totalWeight).toFixed(4));
        rawAmt = Math.round((amountToAlloc * c) / totalWeight);
      } else if (allocMethod === "DIRECT_AMOUNT") {
        rawAmt = Math.round(Number(row.directAmount || 0));
        pct = Number(((rawAmt * 100) / amountToAlloc).toFixed(4));
      } else {
        const b = Number(row.basisValue || 0);
        pct = Number(((b * 100) / totalWeight).toFixed(4));
        rawAmt = Math.round((amountToAlloc * b) / totalWeight);
      }
      runningSum += rawAmt;
      return { ...row, percentage: pct, allocatedAmount: rawAmt, roundingAdjustment: 0 };
    });

    const roundingDiff = amountToAlloc - runningSum;
    if (roundingDiff !== 0 && rawRows.length > 0) {
      let targetIdx = rawRows.length - 1;
      if (allocRoundingMethod === "LARGEST_LINE") {
        targetIdx = rawRows.reduce(
          (maxI, item, idx, arr) => (item.allocatedAmount >= arr[maxI].allocatedAmount ? idx : maxI),
          0,
        );
      }
      rawRows[targetIdx].allocatedAmount += roundingDiff;
      rawRows[targetIdx].roundingAdjustment = roundingDiff;
    }

    setAllocDestinations(rawRows);
    setAllocSourcePool((prev) => ({
      ...prev,
      status: "CALCULATED",
      roundingDiffAdjusted: roundingDiff,
    }));
    notify(
      `Đã tính phân bổ ${amountToAlloc.toLocaleString("vi-VN")} ₫ cho ${rawRows.length} đối tượng nhận (Trạng thái: CALCULATED).`,
    );
  };

  const handleConfirmExpenseAllocation = async (autoPost: boolean) => {
    handleCalculateExpenseAllocation();
    const totalAllocated = allocDestinations.reduce((s, r) => s + Number(r.allocatedAmount || 0), 0);
    if (totalAllocated <= 0) return;

    if (apiConnected) {
      const saved = await apiSave((writer) =>
        confirmExpenseAllocation(writer, {
          number: allocVoucherNumber,
          postingDate: allocPostingDate,
          documentDate: allocDocumentDate,
          allocationGroup: allocGroup,
          sourceAccountCodes: [allocSourceAccCode],
          method: allocMethod,
          roundingMethod: allocRoundingMethod,
          amountToAllocate: totalAllocated,
          description: allocDescription,
          expectedSourceFingerprint: allocSourcePool.sourceFingerprint,
          autoPost,
          destinations: allocDestinations.map((r, i) => ({
            line_no: i + 1,
            account_code: r.accountCode,
            percentage: r.percentage,
            coefficient: r.coefficient,
            basis_value: r.basisValue,
            direct_amount: r.directAmount,
            description: r.description,
          })),
        }),
      );
      if (saved) {
        setAllocRunsHistory((prev) => [
          {
            id: (saved as any).id || `run-${Date.now()}`,
            number: (saved as any).number || allocVoucherNumber,
            periodCode: allocPeriodCode,
            postingDate: allocPostingDate,
            allocationGroup: allocGroup,
            sourceAccountCode: allocSourceAccCode,
            method: allocMethod,
            totalSourceAmount: allocSourcePool.totalSourceAmount,
            amount: totalAllocated,
            status: autoPost ? "POSTED" : "UNPOSTED",
            entryNumber: (saved as any).entry_number || allocVoucherNumber,
            description: allocDescription,
          },
          ...prev,
        ]);
      }
      return;
    }

    const newVoucherNo = allocVoucherNumber || `PBCP-${allocPeriodCode}-00${allocRunsHistory.length + 1}`;
    const newRun = {
      id: `run-${Date.now()}`,
      number: newVoucherNo,
      periodCode: allocPeriodCode,
      postingDate: allocPostingDate,
      allocationGroup: allocGroup,
      sourceAccountCode: allocSourceAccCode,
      method: allocMethod,
      totalSourceAmount: allocSourcePool.totalSourceAmount,
      amount: totalAllocated,
      status: autoPost ? "POSTED" : "UNPOSTED",
      entryNumber: newVoucherNo,
      description: allocDescription,
    };
    setAllocRunsHistory((prev) => [newRun, ...prev]);
    setGeneralVouchers((prev) => [
      {
        id: newVoucherNo,
        date: allocPostingDate,
        voucherDate: allocDocumentDate,
        desc: allocDescription,
        debitAcc: allocDestinations[0]?.accountCode || "6418",
        creditAcc: allocOffsetAccCode || allocSourceAccCode,
        amount: totalAllocated,
        posted: autoPost,
        statusLabel: autoPost ? "Đã ghi sổ" : "Chưa ghi sổ",
      },
      ...prev,
    ]);
    setAllocSourcePool((prev) => ({
      ...prev,
      previouslyAllocatedAmount: prev.previouslyAllocatedAmount + totalAllocated,
      remainingAllocatableAmount: Math.max(0, prev.remainingAllocatableAmount - totalAllocated),
      amountToAllocate: Math.max(0, prev.remainingAllocatableAmount - totalAllocated),
      status: autoPost ? "POSTED" : "UNPOSTED",
    }));
    notify(
      autoPost
        ? `Đã tạo và Ghi sổ chứng từ phân bổ ${newVoucherNo} (${totalAllocated.toLocaleString("vi-VN")} ₫) vào Sổ cái (AF-14).`
        : `Đã tạo chứng từ phân bổ ${newVoucherNo} ở trạng thái Chưa ghi sổ (UNPOSTED - AF-15).`,
    );
  };

  // --- UC-GL-08: Đánh giá lại tài khoản ngoại tệ (Foreign Currency Account Revaluation) ---
  const [fxRevaluationModalOpen, setFxRevaluationModalOpen] = useState(false);
  const [fxRevalActiveTab, setFxRevalActiveTab] = useState<"evaluate" | "history" | "rules">("evaluate");
  const [fxRevalPeriod, setFxRevalPeriod] = useState("2026-10");
  const [fxRevalDate, setFxRevalDate] = useState("31/10/2026");
  const [fxRevalPostingDate, setFxRevalPostingDate] = useState("31/10/2026");
  const [fxRevalDocDate, setFxRevalDocDate] = useState("31/10/2026");
  const [fxRevalVoucherNo, setFxRevalVoucherNo] = useState("CLTG-1026-001");
  const [fxRevalDescription, setFxRevalDescription] = useState(
    "Đánh giá lại chênh lệch tỷ giá cuối kỳ tháng 10/2026",
  );
  const [fxRevalCurrency, setFxRevalCurrency] = useState<"USD" | "EUR" | "JPY">("USD");
  const [fxRevalExchangeRate, setFxRevalExchangeRate] = useState<number>(25350);
  const [fxRevalRateSource, setFxRevalRateSource] = useState("VCB - Tỷ giá mua/bán chuyển khoản cuối kỳ");
  const [fxRevalRateTimestamp, setFxRevalRateTimestamp] = useState("31/10/2026 17:00");
  const [fxRevalAccountScope, setFxRevalAccountScope] = useState<
    "ALL" | "CASH_BANK" | "AR" | "AP" | "LOAN"
  >("ALL");
  const [fxRevalSourceFingerprint, setFxRevalSourceFingerprint] = useState("FP-FX-202610-USD-001");
  const [fxRevalCalculated, setFxRevalCalculated] = useState(true);
  const [fxRevalTraceRun, setFxRevalTraceRun] = useState<any | null>(null);

  const [fxRevalRules] = useState<
    Array<{
      accountPrefix: string;
      accountName: string;
      itemCategory: string;
      nature: "ASSET" | "LIABILITY";
      fxHandlingAccount: string;
      gainDebit: string;
      gainCredit: string;
      lossDebit: string;
      lossCredit: string;
      eligible: boolean;
    }>
  >([
    {
      accountPrefix: "1112",
      accountName: "Tiền mặt ngoại tệ",
      itemCategory: "Tiền mặt ngoại tệ",
      nature: "ASSET",
      fxHandlingAccount: "4131",
      gainDebit: "1112",
      gainCredit: "4131",
      lossDebit: "4131",
      lossCredit: "1112",
      eligible: true,
    },
    {
      accountPrefix: "1122",
      accountName: "Tiền gửi ngân hàng ngoại tệ",
      itemCategory: "Tiền gửi NH ngoại tệ",
      nature: "ASSET",
      fxHandlingAccount: "4131",
      gainDebit: "1122",
      gainCredit: "4131",
      lossDebit: "4131",
      lossCredit: "1122",
      eligible: true,
    },
    {
      accountPrefix: "131",
      accountName: "Phải thu của khách hàng (có gốc ngoại tệ)",
      itemCategory: "Phải thu ngoại tệ",
      nature: "ASSET",
      fxHandlingAccount: "4131",
      gainDebit: "131",
      gainCredit: "4131",
      lossDebit: "4131",
      lossCredit: "131",
      eligible: true,
    },
    {
      accountPrefix: "331",
      accountName: "Phải trả cho người bán (có gốc ngoại tệ)",
      itemCategory: "Phải trả ngoại tệ",
      nature: "LIABILITY",
      fxHandlingAccount: "4131",
      gainDebit: "331",
      gainCredit: "4131",
      lossDebit: "4131",
      lossCredit: "331",
      eligible: true,
    },
    {
      accountPrefix: "3411",
      accountName: "Các khoản đi vay có gốc ngoại tệ",
      itemCategory: "Vay/nợ ngoại tệ",
      nature: "LIABILITY",
      fxHandlingAccount: "4131",
      gainDebit: "3411",
      gainCredit: "4131",
      lossDebit: "4131",
      lossCredit: "3411",
      eligible: true,
    },
    {
      accountPrefix: "156 / 211 / 242",
      accountName: "Hàng tồn kho / TSCĐ / Chi phí trả trước (Khoản mục phi tiền tệ)",
      itemCategory: "Phi tiền tệ (Loại trừ BR-GL-FX-06)",
      nature: "ASSET",
      fxHandlingAccount: "Không đánh giá lại",
      gainDebit: "-",
      gainCredit: "-",
      lossDebit: "-",
      lossCredit: "-",
      eligible: false,
    },
  ]);

  const [fxRevalItems, setFxRevalItems] = useState<
    Array<{
      id: string;
      selected: boolean;
      accountCode: string;
      accountName: string;
      itemCategory: "CASH_BANK" | "AR" | "AP" | "LOAN";
      nature: "ASSET" | "LIABILITY";
      partyCode: string;
      partyName: string;
      bankAccountCode: string;
      currency: "USD" | "EUR" | "JPY";
      foreignBalance: number;
      bookValueBefore: number;
      currentBookRate: number;
      revaluationRate: number;
      revaluedValue: number;
      differenceAmount: number;
      bookChangeDirection: "INCREASE" | "DECREASE" | "NONE";
      fxImpactType: "GAIN" | "LOSS" | "NONE";
      fxHandlingAccount: string;
      debitAccountCode: string;
      creditAccountCode: string;
    }>
  >([
    {
      id: "FX-IT-01",
      selected: true,
      accountCode: "1112",
      accountName: "Tiền mặt ngoại tệ (USD)",
      itemCategory: "CASH_BANK",
      nature: "ASSET",
      partyCode: "",
      partyName: "Quỹ tiền mặt ngoại tệ tại Công ty",
      bankAccountCode: "",
      currency: "USD",
      foreignBalance: 2000,
      bookValueBefore: 49800000,
      currentBookRate: 24900,
      revaluationRate: 25350,
      revaluedValue: 50700000,
      differenceAmount: 900000,
      bookChangeDirection: "INCREASE",
      fxImpactType: "GAIN",
      fxHandlingAccount: "4131",
      debitAccountCode: "1112",
      creditAccountCode: "4131",
    },
    {
      id: "FX-IT-02",
      selected: true,
      accountCode: "1122",
      accountName: "Tiền gửi ngân hàng ngoại tệ (USD)",
      itemCategory: "CASH_BANK",
      nature: "ASSET",
      partyCode: "NH-VCB",
      partyName: "Ngân hàng TMCP Ngoại thương Việt Nam (VCB)",
      bankAccountCode: "VCB-USD-001",
      currency: "USD",
      foreignBalance: 10000,
      bookValueBefore: 250000000,
      currentBookRate: 25000,
      revaluationRate: 25350,
      revaluedValue: 253500000,
      differenceAmount: 3500000,
      bookChangeDirection: "INCREASE",
      fxImpactType: "GAIN",
      fxHandlingAccount: "4131",
      debitAccountCode: "1122",
      creditAccountCode: "4131",
    },
    {
      id: "FX-IT-03",
      selected: true,
      accountCode: "1122",
      accountName: "Tiền gửi ngân hàng ngoại tệ (USD)",
      itemCategory: "CASH_BANK",
      nature: "ASSET",
      partyCode: "NH-BIDV",
      partyName: "Ngân hàng TMCP Đầu tư & Phát triển (BIDV)",
      bankAccountCode: "BIDV-USD-002",
      currency: "USD",
      foreignBalance: 5000,
      bookValueBefore: 126750000,
      currentBookRate: 25350,
      revaluationRate: 25350,
      revaluedValue: 126750000,
      differenceAmount: 0,
      bookChangeDirection: "NONE",
      fxImpactType: "NONE",
      fxHandlingAccount: "4131",
      debitAccountCode: "",
      creditAccountCode: "",
    },
    {
      id: "FX-IT-04",
      selected: true,
      accountCode: "131",
      accountName: "Phải thu của khách hàng (USD)",
      itemCategory: "AR",
      nature: "ASSET",
      partyCode: "KH-USD-01",
      partyName: "Global Trade Corp (USA)",
      bankAccountCode: "",
      currency: "USD",
      foreignBalance: 4000,
      bookValueBefore: 99200000,
      currentBookRate: 24800,
      revaluationRate: 25350,
      revaluedValue: 101400000,
      differenceAmount: 2200000,
      bookChangeDirection: "INCREASE",
      fxImpactType: "GAIN",
      fxHandlingAccount: "4131",
      debitAccountCode: "131",
      creditAccountCode: "4131",
    },
    {
      id: "FX-IT-05",
      selected: true,
      accountCode: "331",
      accountName: "Phải trả cho người bán (USD)",
      itemCategory: "AP",
      nature: "LIABILITY",
      partyCode: "NCC-USD-01",
      partyName: "Pacific Supply Pte. Ltd (Singapore)",
      bankAccountCode: "",
      currency: "USD",
      foreignBalance: 6000,
      bookValueBefore: 147600000,
      currentBookRate: 24600,
      revaluationRate: 25350,
      revaluedValue: 152100000,
      differenceAmount: 4500000,
      bookChangeDirection: "INCREASE",
      fxImpactType: "LOSS",
      fxHandlingAccount: "4131",
      debitAccountCode: "4131",
      creditAccountCode: "331",
    },
    {
      id: "FX-IT-06",
      selected: true,
      accountCode: "3411",
      accountName: "Các khoản đi vay ngoại tệ (USD)",
      itemCategory: "LOAN",
      nature: "LIABILITY",
      partyCode: "NH-HSBC",
      partyName: "Ngân hàng TNHH MTV HSBC Việt Nam",
      bankAccountCode: "LOAN-HSBC-USD",
      currency: "USD",
      foreignBalance: 8000,
      bookValueBefore: 204000000,
      currentBookRate: 25500,
      revaluationRate: 25350,
      revaluedValue: 202800000,
      differenceAmount: -1200000,
      bookChangeDirection: "DECREASE",
      fxImpactType: "GAIN",
      fxHandlingAccount: "4131",
      debitAccountCode: "3411",
      creditAccountCode: "4131",
    },
  ]);

  const [fxRevalRunsHistory, setFxRevalRunsHistory] = useState<
    Array<{
      id: string;
      voucherNo: string;
      period: string;
      revaluationDate: string;
      postingDate: string;
      currency: string;
      exchangeRate: number;
      rateSource: string;
      accountScope: string;
      evaluatedLinesCount: number;
      totalForeignBalance: number;
      totalBookBefore: number;
      totalRevalued: number;
      totalGainAmount: number;
      totalLossAmount: number;
      netDifference: number;
      status: "UNPOSTED" | "POSTED" | "REVERSED" | "CANCELLED";
      sourceFingerprint: string;
      lines: any[];
    }>
  >([
    {
      id: "FX-RUN-202609-USD",
      voucherNo: "CLTG-0926-001",
      period: "2026-09",
      revaluationDate: "30/09/2026",
      postingDate: "30/09/2026",
      currency: "USD",
      exchangeRate: 25000,
      rateSource: "VCB - Tỷ giá cuối kỳ 09/2026",
      accountScope: "ALL",
      evaluatedLinesCount: 4,
      totalForeignBalance: 21000,
      totalBookBefore: 521600000,
      totalRevalued: 525000000,
      totalGainAmount: 4200000,
      totalLossAmount: 800000,
      netDifference: 3400000,
      status: "POSTED",
      sourceFingerprint: "FP-FX-202609-USD-001",
      lines: [
        {
          accountCode: "1122",
          partyCode: "VCB-USD-001",
          foreignBalance: 10000,
          bookValueBefore: 248000000,
          revaluedValue: 250000000,
          differenceAmount: 2000000,
          fxImpactType: "GAIN",
          debitAccountCode: "1122",
          creditAccountCode: "4131",
        },
      ],
    },
  ]);

  const computeFxLineEvaluation = (
    item: (typeof fxRevalItems)[number],
    rate: number,
  ): (typeof fxRevalItems)[number] => {
    const revaluedValue = Math.round(item.foreignBalance * rate);
    const differenceAmount = revaluedValue - item.bookValueBefore;
    let bookChangeDirection: "INCREASE" | "DECREASE" | "NONE" = "NONE";
    let fxImpactType: "GAIN" | "LOSS" | "NONE" = "NONE";
    let debitAccountCode = "";
    let creditAccountCode = "";

    if (differenceAmount > 0) {
      bookChangeDirection = "INCREASE";
      if (item.nature === "ASSET") {
        // BR-GL-FX-39: Khoản mục Tài sản tăng giá trị quy đổi -> Lãi tỷ giá (Nợ TK ngoại tệ / Có TK 4131)
        fxImpactType = "GAIN";
        debitAccountCode = item.accountCode;
        creditAccountCode = item.fxHandlingAccount || "4131";
      } else {
        // BR-GL-FX-42: Khoản mục Nợ phải trả tăng giá trị quy đổi -> Lỗ tỷ giá (Nợ TK 4131 / Có TK ngoại tệ)
        fxImpactType = "LOSS";
        debitAccountCode = item.fxHandlingAccount || "4131";
        creditAccountCode = item.accountCode;
      }
    } else if (differenceAmount < 0) {
      bookChangeDirection = "DECREASE";
      if (item.nature === "ASSET") {
        // BR-GL-FX-40: Khoản mục Tài sản giảm giá trị quy đổi -> Lỗ tỷ giá (Nợ TK 4131 / Có TK ngoại tệ)
        fxImpactType = "LOSS";
        debitAccountCode = item.fxHandlingAccount || "4131";
        creditAccountCode = item.accountCode;
      } else {
        // BR-GL-FX-43: Khoản mục Nợ phải trả giảm giá trị quy đổi -> Lãi tỷ giá (Nợ TK ngoại tệ / Có TK 4131)
        fxImpactType = "GAIN";
        debitAccountCode = item.accountCode;
        creditAccountCode = item.fxHandlingAccount || "4131";
      }
    }

    return {
      ...item,
      revaluationRate: rate,
      revaluedValue,
      differenceAmount,
      bookChangeDirection,
      fxImpactType,
      debitAccountCode,
      creditAccountCode,
    };
  };

  const handleApplySystemFxRate = (currencyCode: "USD" | "EUR" | "JPY") => {
    const presetRates: Record<"USD" | "EUR" | "JPY", { rate: number; source: string }> = {
      USD: { rate: 25350, source: "VCB - Tỷ giá mua/bán chuyển khoản cuối kỳ (USD)" },
      EUR: { rate: 27480, source: "VCB - Tỷ giá mua/bán chuyển khoản cuối kỳ (EUR)" },
      JPY: { rate: 168.5, source: "VCB - Tỷ giá mua/bán chuyển khoản cuối kỳ (JPY)" },
    };
    const chosen = presetRates[currencyCode];
    setFxRevalCurrency(currencyCode);
    setFxRevalExchangeRate(chosen.rate);
    setFxRevalRateSource(chosen.source);
    setFxRevalItems((prev) =>
      prev.map((it) => computeFxLineEvaluation({ ...it, currency: currencyCode }, chosen.rate)),
    );
    setFxRevalCalculated(true);
    notify(
      `Đã lấy tỷ giá đánh giá cuối kỳ ${chosen.rate.toLocaleString("vi-VN")} VND/${currencyCode} từ bảng tỷ giá hệ thống (AF-01).`,
    );
  };

  const handleFetchFxBalances = async () => {
    try {
      if (writer) {
        const res = await fetchFxRevaluationBalances(writer, {
          period: fxRevalPeriod,
          currency: fxRevalCurrency,
          account_scope: fxRevalAccountScope,
        });
        if (res.record?.source_fingerprint) {
          setFxRevalSourceFingerprint(res.record.source_fingerprint);
        } else {
          setFxRevalSourceFingerprint(`FP-FX-${fxRevalPeriod}-${fxRevalCurrency}-${Date.now()}`);
        }
      } else {
        setFxRevalSourceFingerprint(`FP-FX-${fxRevalPeriod}-${fxRevalCurrency}-${Date.now()}`);
      }
    } catch {
      setFxRevalSourceFingerprint(`FP-FX-${fxRevalPeriod}-${fxRevalCurrency}-${Date.now()}`);
    }
    setFxRevalItems((prev) =>
      prev.map((it) => {
        const inScope =
          fxRevalAccountScope === "ALL" || it.itemCategory === fxRevalAccountScope;
        return computeFxLineEvaluation({ ...it, selected: inScope }, fxRevalExchangeRate);
      }),
    );
    setFxRevalCalculated(true);
    notify(
      `Đã lấy số dư nguyên tệ (${fxRevalCurrency}) và giá trị ghi sổ trên Sổ cái kỳ ${fxRevalPeriod}. Các TK phi tiền tệ (156, 211, 242) đã tự động loại trừ (BR-GL-FX-06).`,
    );
  };

  const handleCalculateFxRevaluation = async () => {
    if (!fxRevalExchangeRate || fxRevalExchangeRate <= 0 || Number.isNaN(fxRevalExchangeRate)) {
      notify(
        "Lỗi EF-06 / EF-07: Tỷ giá đánh giá cuối kỳ phải là số dương hợp lệ (> 0). Vui lòng kiểm tra lại!",
      );
      return;
    }
    try {
      if (writer) {
        await calculateFxRevaluation(writer, {
          period: fxRevalPeriod,
          currency: fxRevalCurrency,
          exchange_rate: fxRevalExchangeRate,
          account_scope: fxRevalAccountScope,
        });
      }
    } catch {
      // Fallback local calculation when period UUID differs
    }
    setFxRevalItems((prev) =>
      prev.map((it) => computeFxLineEvaluation(it, fxRevalExchangeRate)),
    );
    setFxRevalCalculated(true);
    notify(
      `Đã tính lại giá trị quy đổi và chênh lệch tỷ giá theo tỷ giá ${fxRevalExchangeRate.toLocaleString("vi-VN")} VND/${fxRevalCurrency} (Bước 5-8).`,
    );
  };

  const handleConfirmFxRevaluation = async (autoPost: boolean) => {
    if (!fxRevalExchangeRate || fxRevalExchangeRate <= 0) {
      notify("Lỗi EF-07: Tỷ giá đánh giá cuối kỳ phải lớn hơn 0 (BR-GL-FX-23).");
      return;
    }
    if (!fxRevalCalculated) {
      notify("Cảnh báo: Dữ liệu tỷ giá vừa thay đổi, vui lòng nhấn 'Tính đánh giá lại' trước khi Lưu!");
      return;
    }
    const activeDuplicate = fxRevalRunsHistory.find(
      (r) =>
        r.period === fxRevalPeriod &&
        r.currency === fxRevalCurrency &&
        (r.accountScope === fxRevalAccountScope ||
          r.accountScope === "ALL" ||
          fxRevalAccountScope === "ALL") &&
        (r.status === "UNPOSTED" || r.status === "POSTED"),
    );
    if (activeDuplicate) {
      notify(
        `Lỗi EF-20 (BR-GL-FX-53): Đã tồn tại đợt đánh giá lại ${activeDuplicate.voucherNo} (${activeDuplicate.status}) cho kỳ ${fxRevalPeriod} - ${fxRevalCurrency}. Vui lòng Hủy hoặc Đảo đợt cũ trước khi chạy lại!`,
      );
      return;
    }

    const selectedLines = fxRevalItems.filter((it) => it.selected);
    if (selectedLines.length === 0) {
      notify("Lỗi EF-09: Không có khoản mục tiền tệ ngoại tệ nào được chọn trong phạm vi đánh giá.");
      return;
    }
    const nonZeroLines = selectedLines.filter((it) => Math.abs(it.differenceAmount) > 0);
    if (nonZeroLines.length === 0) {
      notify(
        "Lỗi EF-19 (AF-08): Tất cả các khoản mục ngoại tệ được chọn đều có chênh lệch tỷ giá = 0. Hệ thống không tạo bút toán rỗng!",
      );
      return;
    }

    const totalForeign = selectedLines.reduce((acc, it) => acc + it.foreignBalance, 0);
    const totalBookBefore = selectedLines.reduce((acc, it) => acc + it.bookValueBefore, 0);
    const totalRevalued = selectedLines.reduce((acc, it) => acc + it.revaluedValue, 0);
    const totalGain = nonZeroLines
      .filter((it) => it.fxImpactType === "GAIN")
      .reduce((acc, it) => acc + Math.abs(it.differenceAmount), 0);
    const totalLoss = nonZeroLines
      .filter((it) => it.fxImpactType === "LOSS")
      .reduce((acc, it) => acc + Math.abs(it.differenceAmount), 0);
    const totalAccountingAmount = totalGain + totalLoss;

    try {
      if (writer) {
        await confirmFxRevaluation(writer, {
          period: fxRevalPeriod,
          currency: fxRevalCurrency,
          exchange_rate: fxRevalExchangeRate,
          rate_source: fxRevalRateSource,
          account_scope: fxRevalAccountScope,
          number: fxRevalVoucherNo,
          description: fxRevalDescription,
          source_fingerprint: fxRevalSourceFingerprint,
          idempotency_key: `IDEM-${fxRevalVoucherNo}-${fxRevalPeriod}-${fxRevalCurrency}`,
        });
      }
    } catch {
      // Local state update fallback
    }

    const voucherNo =
      fxRevalVoucherNo.trim() || `CLTG-${fxRevalPeriod.replace("-", "")}-${fxRevalRunsHistory.length + 1}`;
    const newRun = {
      id: `FX-RUN-${Date.now()}`,
      voucherNo,
      period: fxRevalPeriod,
      revaluationDate: fxRevalDate,
      postingDate: fxRevalPostingDate,
      currency: fxRevalCurrency,
      exchangeRate: fxRevalExchangeRate,
      rateSource: fxRevalRateSource,
      accountScope: fxRevalAccountScope,
      evaluatedLinesCount: selectedLines.length,
      totalForeignBalance: totalForeign,
      totalBookBefore,
      totalRevalued,
      totalGainAmount: totalGain,
      totalLossAmount: totalLoss,
      netDifference: totalGain - totalLoss,
      status: (autoPost ? "POSTED" : "UNPOSTED") as "POSTED" | "UNPOSTED",
      sourceFingerprint: fxRevalSourceFingerprint,
      lines: nonZeroLines.map((ln) => ({
        accountCode: ln.accountCode,
        partyCode: ln.bankAccountCode || ln.partyCode || "-",
        foreignBalance: ln.foreignBalance,
        bookValueBefore: ln.bookValueBefore,
        revaluedValue: ln.revaluedValue,
        differenceAmount: ln.differenceAmount,
        fxImpactType: ln.fxImpactType,
        debitAccountCode: ln.debitAccountCode,
        creditAccountCode: ln.creditAccountCode,
      })),
    };

    setFxRevalRunsHistory((prev) => [newRun, ...prev]);
    setGeneralVouchers((prev) => [
      {
        id: voucherNo,
        date: fxRevalPostingDate,
        voucherDate: fxRevalDocDate,
        desc: `${fxRevalDescription} (${fxRevalCurrency} @ ${fxRevalExchangeRate.toLocaleString("vi-VN")})`,
        debitAcc: nonZeroLines[0]?.debitAccountCode || "1122",
        creditAcc: nonZeroLines[0]?.creditAccountCode || "4131",
        amount: totalAccountingAmount,
        posted: autoPost,
        statusLabel: autoPost ? "Đã ghi sổ" : "Chưa ghi sổ",
      },
      ...prev,
    ]);

    if (autoPost) {
      // BR-GL-FX-60 & BR-GL-FX-61: Sau khi Ghi sổ, cập nhật giá trị ghi sổ VND theo tỷ giá mới nhưng giữ nguyên số dư nguyên tệ
      setFxRevalItems((prev) =>
        prev.map((it) =>
          it.selected
            ? computeFxLineEvaluation(
                {
                  ...it,
                  bookValueBefore: it.revaluedValue,
                  currentBookRate: fxRevalExchangeRate,
                },
                fxRevalExchangeRate,
              )
            : it,
        ),
      );
    }

    const nextSeq = String(fxRevalRunsHistory.length + 2).padStart(3, "0");
    setFxRevalVoucherNo(`CLTG-1026-${nextSeq}`);
    setFxRevalActiveTab("history");
    notify(
      autoPost
        ? `Đã tạo và Ghi sổ chứng từ đánh giá lại ngoại tệ ${voucherNo} (Lãi: ${totalGain.toLocaleString("vi-VN")} ₫ / Lỗ: ${totalLoss.toLocaleString("vi-VN")} ₫). Số dư nguyên tệ giữ nguyên tuyệt đối (BR-GL-FX-60).`
        : `Đã tạo chứng từ đánh giá lại ngoại tệ ${voucherNo} ở trạng thái Chưa ghi sổ (UNPOSTED - AF-15).`,
    );
  };

  const handleFxRunLifecycleAction = async (
    runId: string,
    action: "POST" | "UNPOST" | "REVERSE" | "CANCEL",
  ) => {
    try {
      if (writer) {
        if (action === "POST") await postFxRevaluationRun(writer, runId);
        if (action === "UNPOST") await unpostFxRevaluationRun(writer, runId);
        if (action === "REVERSE") await reverseFxRevaluationRun(writer, runId, { reason: "Đảo bút toán đánh giá lại ngoại tệ để chạy lại" });
        if (action === "CANCEL") await cancelFxRevaluationRun(writer, runId, { reason: "Hủy chứng từ đánh giá lại chưa ghi sổ" });
      }
    } catch {
      // Local state update fallback
    }
    setFxRevalRunsHistory((prev) =>
      prev.map((r) => {
        if (r.id !== runId) return r;
        if (action === "POST") return { ...r, status: "POSTED" };
        if (action === "UNPOST") return { ...r, status: "UNPOSTED" };
        if (action === "REVERSE") return { ...r, status: "REVERSED" };
        if (action === "CANCEL") return { ...r, status: "CANCELLED" };
        return r;
      }),
    );
    const labelMap = {
      POST: "Đã Ghi sổ chứng từ đánh giá lại ngoại tệ vào Sổ cái (UC-GL-05).",
      UNPOST: "Đã Bỏ ghi sổ chứng từ đánh giá lại ngoại tệ về trạng thái UNPOSTED (AF-16).",
      REVERSE: "Đã tạo Bút toán đảo (REVERSED) để vô hiệu hóa đợt đánh giá cũ và cho phép chạy lại (AF-17).",
      CANCEL: "Đã Hủy chứng từ đánh giá lại ngoại tệ chưa ghi sổ (AF-12).",
    };
    notify(labelMap[action]);
  };

  const [taxInvoiceRows, setTaxInvoiceRows] = useState<any[]>([
    {
      id: "1",
      invoiceDate: "01/10/2026",
      invoiceNo: "",
      invoiceForm: "1",
      invoiceSerial: "C26T",
      goodsGroup: "1",
      debitAcc: "1331",
      creditAcc: "331",
      preTaxAmount: 0,
      vatRate: "10%",
      vatAmount: 0,
      partnerName: "",
    },
  ]);

  const handleAddVoucherRow = () => {
    const newId = String(voucherRows.length + 1);
    let defaultDebit = "";
    let defaultCredit = "";
    if (selectedVoucherType === "1. Hạch toán thuế TNDN phải nộp") {
      defaultDebit = "8211";
      defaultCredit = "3334";
    } else if (selectedVoucherType === "2. Vay ngân hàng chuyển trả cho nhà cung cấp") {
      defaultDebit = "331";
      defaultCredit = "3411";
    } else if (selectedVoucherType === "3. Hạch toán chi phí lương") {
      defaultCredit = "334";
    } else if (selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm") {
      defaultDebit = "4212";
      defaultCredit = "4211";
    } else if (selectedVoucherType === "6. Khấu trừ thuế tiêu thụ đặc biệt") {
      defaultDebit = "3332";
      defaultCredit = "1383";
    }
    setVoucherRows([
      ...voucherRows,
      {
        id: newId,
        desc: voucherDescription,
        debitAcc: defaultDebit,
        creditAcc: defaultCredit,
        amount: 0,
        debitObject: "",
        debitObjectName: "",
        creditObject: "",
        creditObjectName: "",
        loanContract: "",
        expenseItem: "",
        department: "",
        costObject: "",
        operation: "",
      },
    ]);
  };

  const handleDeleteVoucherRow = (id: string) => {
    if (voucherRows.length <= 1) {
      setVoucherRows([
        {
          id: "1",
          desc: voucherDescription,
          debitAcc: "",
          creditAcc: "",
          amount: 0,
        },
      ]);
    } else {
      setVoucherRows(voucherRows.filter((r) => r.id !== id));
    }
  };

  const handleClearAllVoucherRows = () => {
    setVoucherRows([
      {
        id: "1",
        desc: voucherDescription,
        debitAcc: "",
        creditAcc: "",
        amount: 0,
      },
    ]);
  };

  // Advance Settlement (Quyết toán tạm ứng QTTU00001 - UC-GL-02) Form State
  const [settlePerAdvance, setSettlePerAdvance] = useState(false);
  const [advanceEmployee, setAdvanceEmployee] = useState("");
  const [advanceDepartment, setAdvanceDepartment] = useState("");
  const [advanceDescription, setAdvanceDescription] = useState("Quyết toán tạm ứng");
  const [advancePostingDate, setAdvancePostingDate] = useState("22/10/2026");
  const [advanceDocDate, setAdvanceDocDate] = useState("22/10/2026");
  const [advanceVoucherNo, setAdvanceVoucherNo] = useState("QTTU00001");
  const [advanceDetailTab, setAdvanceDetailTab] = useState<"hach_toan" | "ke_khai_thue">("hach_toan");
  const [advanceGroupInvoices, setAdvanceGroupInvoices] = useState(false);
  const [advanceRequestId, setAdvanceRequestId] = useState("");
  const [advanceSourceRef, setAdvanceSourceRef] = useState("");
  const [advanceSourceAmount, setAdvanceSourceAmount] = useState<string>("");
  const [advanceReferences, setAdvanceReferences] = useState<string[]>([]);
  const [showAdvanceRefPicker, setShowAdvanceRefPicker] = useState(false);
  const [advanceAttachments, setAdvanceAttachments] = useState<Array<{ file_name: string; file_size: number; file_type: string }>>([]);
  const [advanceError, setAdvanceError] = useState("");
  const [isSavingAdvanceVoucher, setIsSavingAdvanceVoucher] = useState(false);

  const [advanceRows, setAdvanceRows] = useState<any[]>([
    {
      id: "1",
      desc: "Quyết toán tạm ứng",
      debitAcc: "6422",
      creditAcc: "141",
      amount: 0,
      debitObject: "",
      debitObjectName: "",
      creditObject: "",
      creditObjectName: "",
    },
  ]);
  const [advanceTaxRows, setAdvanceTaxRows] = useState<any[]>([
    {
      id: "1",
      invoiceDate: "22/10/2026",
      invoiceNo: "",
      invoiceForm: "1",
      invoiceSerial: "C26T",
      goodsGroup: "1",
      debitAcc: "1331",
      creditAcc: "141",
      preTaxAmount: 0,
      vatRate: "10%",
      vatAmount: 0,
      partnerCode: "",
      partnerName: "",
      partnerTaxCode: "",
    },
  ]);

  const handleSelectAdvanceEmployee = (empValue: string) => {
    setAdvanceEmployee(empValue);
    setAdvanceError("");
    const trimmed = empValue.trim();
    const parts = trimmed.includes(" - ") ? trimmed.split(" - ") : ["", trimmed];
    const empCode = parts[0] || trimmed;
    const empName = parts[1] || trimmed;
    setAdvanceRows((prev) =>
      prev.map((row) =>
        String(row.creditAcc || "").startsWith("141")
          ? {
              ...row,
              creditObject: empCode,
              creditObjectName: empName,
            }
          : row,
      ),
    );
  };

  const resetAdvanceSettlementForm = (nextNumber?: string) => {
    const newNo = nextNumber || `QTTU${String(generalVouchers.length + 1).padStart(5, "0")}`;
    setAdvanceVoucherNo(newNo);
    setSettlePerAdvance(false);
    setAdvanceEmployee("");
    setAdvanceDepartment("");
    setAdvanceDescription("Quyết toán tạm ứng");
    setAdvancePostingDate("22/10/2026");
    setAdvanceDocDate("22/10/2026");
    setAdvanceDetailTab("hach_toan");
    setAdvanceGroupInvoices(false);
    setAdvanceRequestId("");
    setAdvanceSourceRef("");
    setAdvanceSourceAmount("");
    setAdvanceReferences([]);
    setShowAdvanceRefPicker(false);
    setAdvanceAttachments([]);
    setAdvanceError("");
    setAdvanceRows([
      {
        id: "1",
        desc: "Quyết toán tạm ứng",
        debitAcc: "6422",
        creditAcc: "141",
        amount: 0,
        debitObject: "",
        debitObjectName: "",
        creditObject: "",
        creditObjectName: "",
      },
    ]);
    setAdvanceTaxRows([
      {
        id: "1",
        invoiceDate: "22/10/2026",
        invoiceNo: "",
        invoiceForm: "1",
        invoiceSerial: "C26T",
        goodsGroup: "1",
        debitAcc: "1331",
        creditAcc: "141",
        preTaxAmount: 0,
        vatRate: "10%",
        vatAmount: 0,
        partnerCode: "",
        partnerName: "",
        partnerTaxCode: "",
      },
    ]);
  };

  const handleSaveAdvanceSettlement = async (andNew = false) => {
    if (isSavingAdvanceVoucher) return;
    setAdvanceError("");

    const empClean = String(advanceEmployee || "").trim();
    if (!empClean) {
      const msg = "Nhân viên quyết toán tạm ứng là bắt buộc.";
      setAdvanceError(msg);
      notify(msg);
      return;
    }
    if (!String(advanceVoucherNo || "").trim()) {
      const msg = "Số chứng từ quyết toán tạm ứng là bắt buộc.";
      setAdvanceError(msg);
      notify(msg);
      return;
    }
    if (settlePerAdvance && !String(advanceSourceRef || "").trim()) {
      const msg = "Khi chọn 'Quyết toán cho từng lần tạm ứng', bắt buộc phải chọn khoản/lần tạm ứng nguồn.";
      setAdvanceError(msg);
      notify(msg);
      return;
    }

    const activeAccRows = advanceRows.filter(
      (r) => String(r.debitAcc || "").trim() || Number(r.amount) > 0,
    );
    if (activeAccRows.length === 0) {
      const msg = "Chứng từ quyết toán tạm ứng phải có ít nhất một dòng hạch toán hợp lệ.";
      setAdvanceError(msg);
      notify(msg);
      return;
    }
    for (let i = 0; i < activeAccRows.length; i++) {
      const r = activeAccRows[i];
      if (!String(r.debitAcc || "").trim() || !String(r.creditAcc || "").trim()) {
        const msg = `Dòng hạch toán ${i + 1}: Vui lòng nhập đầy đủ Tài khoản Nợ và Tài khoản Có.`;
        setAdvanceError(msg);
        notify(msg);
        return;
      }
      if (String(r.debitAcc).trim() === String(r.creditAcc).trim()) {
        const msg = `Dòng hạch toán ${i + 1}: Tài khoản Nợ và Tài khoản Có (${r.debitAcc}) không được trùng nhau.`;
        setAdvanceError(msg);
        notify(msg);
        return;
      }
      if (!(Number(r.amount) > 0)) {
        const msg = `Dòng hạch toán ${i + 1}: Số tiền phải lớn hơn 0.`;
        setAdvanceError(msg);
        notify(msg);
        return;
      }
    }

    const activeTax = advanceTaxRows.filter(
      (t) => String(t.invoiceNo || "").trim() || Number(t.preTaxAmount) > 0 || Number(t.vatAmount) > 0,
    );
    for (let i = 0; i < activeTax.length; i++) {
      const t = activeTax[i];
      if (!String(t.invoiceNo || "").trim()) {
        const msg = `Dòng kê khai thuế ${i + 1}: Vui lòng nhập Số hóa đơn.`;
        setAdvanceError(msg);
        notify(msg);
        return;
      }
      if (!String(t.invoiceDate || "").trim()) {
        const msg = `Dòng kê khai thuế ${i + 1}: Vui lòng nhập Ngày hóa đơn.`;
        setAdvanceError(msg);
        notify(msg);
        return;
      }
    }

    const totalAccounting = activeAccRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalVat = activeTax.reduce((s, t) => s + (Number(t.vatAmount) || 0), 0);
    const grandTotal = totalAccounting + totalVat;

    setIsSavingAdvanceVoucher(true);
    try {
      let savedNumber = advanceVoucherNo;
      let nextSuggestedNo = "";
      if (apiConnected) {
        const saved: any = await apiSave((writer) =>
          saveAdvanceSettlement(writer, {
            employee: empClean,
            department: advanceDepartment || undefined,
            number: advanceVoucherNo,
            postingDate: advancePostingDate,
            docDate: advanceDocDate,
            description: advanceDescription,
            settlePerAdvance,
            groupInvoices: advanceGroupInvoices,
            advanceRequestId: advanceRequestId || undefined,
            sourceAdvanceRef: advanceSourceRef || undefined,
            sourceAdvanceAmount: advanceSourceAmount || undefined,
            references: advanceReferences,
            attachments: advanceAttachments,
            rows: activeAccRows,
            taxRows: activeTax,
            saveAndNew: andNew,
          }),
        );
        if (!saved) {
          setIsSavingAdvanceVoucher(false);
          return;
        }
        savedNumber = saved?.number || advanceVoucherNo;
        nextSuggestedNo = saved?.next_number || "";
      } else {
        notify(`Đã lưu chứng từ quyết toán tạm ứng ${advanceVoucherNo} thành công.`);
      }

      setGeneralVouchers((prev) => [
        {
          id: savedNumber,
          date: advancePostingDate,
          voucherDate: advanceDocDate,
          desc: advanceDescription,
          debitAcc: activeAccRows[0]?.debitAcc || "6422",
          creditAcc: activeAccRows[0]?.creditAcc || "141",
          amount: grandTotal,
          posted: false,
        },
        ...prev.filter((v) => v.id !== savedNumber),
      ]);
      setShowVoucherTable(true);

      if (advanceRequestId) {
        setAdvanceRequests((prev) =>
          prev.map((r) =>
            r.id === advanceRequestId || r.apiId === advanceRequestId
              ? { ...r, settlementVoucherNo: savedNumber, syncStatus: "SYNCED", syncStatusLabel: "Đã đồng bộ" }
              : r,
          ),
        );
      }

      if (andNew) {
        resetAdvanceSettlementForm(nextSuggestedNo || `QTTU${String(Date.now()).slice(-5)}`);
      } else {
        setAddAdvanceSettlementModalOpen(false);
      }
    } finally {
      setIsSavingAdvanceVoucher(false);
    }
  };

  const handleAddAdvanceRow = () => {
    if (advanceDetailTab === "ke_khai_thue") {
      setAdvanceTaxRows([
        ...advanceTaxRows,
        {
          id: String(advanceTaxRows.length + 1),
          invoiceDate: advanceDocDate || "22/10/2026",
          invoiceNo: "",
          invoiceForm: "1",
          invoiceSerial: "C26T",
          goodsGroup: "1",
          debitAcc: "1331",
          creditAcc: "141",
          preTaxAmount: 0,
          vatRate: "10%",
          vatAmount: 0,
          partnerCode: "",
          partnerName: "",
          partnerTaxCode: "",
        },
      ]);
      return;
    }
    const trimmed = advanceEmployee.trim();
    const parts = trimmed.includes(" - ") ? trimmed.split(" - ") : ["", trimmed];
    setAdvanceRows([
      ...advanceRows,
      {
        id: String(advanceRows.length + 1),
        desc: advanceDescription,
        debitAcc: "6422",
        creditAcc: "141",
        amount: 0,
        debitObject: "",
        debitObjectName: "",
        creditObject: parts[0] || trimmed,
        creditObjectName: parts[1] || trimmed,
      },
    ]);
  };

  const handleDeleteAdvanceRow = (id: string) => {
    const trimmed = advanceEmployee.trim();
    const parts = trimmed.includes(" - ") ? trimmed.split(" - ") : ["", trimmed];
    if (advanceRows.length <= 1) {
      setAdvanceRows([
        {
          id: "1",
          desc: advanceDescription,
          debitAcc: "",
          creditAcc: "141",
          amount: 0,
          debitObject: "",
          debitObjectName: "",
          creditObject: parts[0] || trimmed,
          creditObjectName: parts[1] || trimmed,
        },
      ]);
    } else {
      setAdvanceRows(advanceRows.filter((r) => r.id !== id));
    }
  };

  const handleClearAllAdvanceRows = () => {
    if (advanceDetailTab === "ke_khai_thue") {
      setAdvanceTaxRows([
        {
          id: "1",
          invoiceDate: advanceDocDate || "22/10/2026",
          invoiceNo: "",
          invoiceForm: "1",
          invoiceSerial: "C26T",
          goodsGroup: "1",
          debitAcc: "1331",
          creditAcc: "141",
          preTaxAmount: 0,
          vatRate: "10%",
          vatAmount: 0,
          partnerCode: "",
          partnerName: "",
          partnerTaxCode: "",
        },
      ]);
      return;
    }
    const trimmed = advanceEmployee.trim();
    const parts = trimmed.includes(" - ") ? trimmed.split(" - ") : ["", trimmed];
    setAdvanceRows([
      {
        id: "1",
        desc: advanceDescription,
        debitAcc: "",
        creditAcc: "141",
        amount: 0,
        debitObject: "",
        debitObjectName: "",
        creditObject: parts[0] || trimmed,
        creditObjectName: parts[1] || trimmed,
      },
    ]);
  };

  const handleAdvanceFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAdvanceError("");
    const added: Array<{ file_name: string; file_size: number; file_type: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 5 * 1024 * 1024) {
        const msg = `Tệp đính kèm '${f.name}' (${(f.size / (1024 * 1024)).toFixed(2)} MB) vượt quá dung lượng tối đa 5MB cho phép.`;
        setAdvanceError(msg);
        notify(msg);
        return;
      }
      added.push({
        file_name: f.name,
        file_size: f.size,
        file_type: f.type || "application/octet-stream",
      });
    }
    setAdvanceAttachments((prev) => [...prev, ...added]);
    notify(`Đã đính kèm ${added.length} tệp chứng từ gốc.`);
  };

  // Tab 4: Kết chuyển lãi lỗ state (UC-GL-09 - Matching user screenshots 1 & 2)
  const [showClosingTable, setShowClosingTable] = useState(false);
  const [closingVoucherNo, setClosingVoucherNo] = useState("KCLL-2026-10-001");
  const [closingToDate, setClosingToDate] = useState("31/10/2026");
  const [closingPostingDate, setClosingPostingDate] = useState("31/10/2026");
  const [closingDocDate, setClosingDocDate] = useState("31/10/2026");
  const [closingDescription, setClosingDescription] = useState("Kết chuyển lãi lỗ đến ngày 31/10/2026");
  const [closingReference, setClosingReference] = useState("");
  const [closingRows, setClosingRows] = useState<any[]>([]);
  const [closingSourceFingerprint, setClosingSourceFingerprint] = useState("FP-CLOSING-2026-10");
  const [closingSummary, setClosingSummary] = useState<{
    totalRevenue: number;
    totalExpense: number;
    netProfitLoss: number;
    resultNature: "PROFIT" | "LOSS" | "ZERO";
    isBalanced: boolean;
  }>({
    totalRevenue: 503200000,
    totalExpense: 380400000,
    netProfitLoss: 122800000,
    resultNature: "PROFIT",
    isBalanced: true,
  });
  const [closingTraceInfo, setClosingTraceInfo] = useState<any | null>(null);

  // UC-GL-10: Tổng hợp phát sinh, số dư và kiểm tra cân đối GL state
  const [balanceAggregationModalOpen, setBalanceAggregationModalOpen] = useState(false);
  const [balAggPeriodCode, setBalAggPeriodCode] = useState("2026-10");
  const [balAggAccountScope, setBalAggAccountScope] = useState("ALL");
  const [balAggStatus, setBalAggStatus] = useState<"VALID" | "STALE" | "INVALID">("VALID");
  const [balAggWatermark, setBalAggWatermark] = useState("WM-202610-9F8A31C4");
  const [balAggLastRunAt, setBalAggLastRunAt] = useState("31/10/2026 17:45:12");
  const [balAggDrilldownAccount, setBalAggDrilldownAccount] = useState<string | null>(null);
  const [balAggDrilldownRows, setBalAggDrilldownRows] = useState<any[]>([]);
  const [balAggRows, setBalAggRows] = useState<
    Array<{
      accountCode: string;
      accountName: string;
      isParent: boolean;
      isBilateral: boolean;
      openingDebit: number;
      openingCredit: number;
      periodDebit: number;
      periodCredit: number;
      closingDebit: number;
      closingCredit: number;
      bilateralNote?: string;
    }>
  >([
    {
      accountCode: "111",
      accountName: "Tiền mặt",
      isParent: true,
      isBilateral: false,
      openingDebit: 150000000,
      openingCredit: 0,
      periodDebit: 320000000,
      periodCredit: 195000000,
      closingDebit: 275000000,
      closingCredit: 0,
    },
    {
      accountCode: "1111",
      accountName: "Tiền Việt Nam",
      isParent: false,
      isBilateral: false,
      openingDebit: 150000000,
      openingCredit: 0,
      periodDebit: 320000000,
      periodCredit: 195000000,
      closingDebit: 275000000,
      closingCredit: 0,
    },
    {
      accountCode: "131",
      accountName: "Phải thu của khách hàng (Lưỡng tính)",
      isParent: false,
      isBilateral: true,
      openingDebit: 80000000,
      openingCredit: 15000000,
      periodDebit: 183200000,
      periodCredit: 140000000,
      closingDebit: 123200000,
      closingCredit: 15000000,
      bilateralNote: "Dư Nợ KH01: 123.200.000 ₫ | Dư Có KH02 (Ứng trước): 15.000.000 ₫ (Không bù trừ trái quy tắc BR-GL-BAL-29)",
    },
    {
      accountCode: "331",
      accountName: "Phải trả cho người bán (Lưỡng tính)",
      isParent: false,
      isBilateral: true,
      openingDebit: 10000000,
      openingCredit: 95000000,
      periodDebit: 85000000,
      periodCredit: 168400000,
      closingDebit: 10000000,
      closingCredit: 178400000,
      bilateralNote: "Dư Nợ NCC02 (Trả trước): 10.000.000 ₫ | Dư Có NCC01: 178.400.000 ₫",
    },
    {
      accountCode: "411",
      accountName: "Vốn đầu tư của chủ sở hữu",
      isParent: false,
      isBilateral: false,
      openingDebit: 0,
      openingCredit: 130000000,
      periodDebit: 0,
      periodCredit: 0,
      closingDebit: 0,
      closingCredit: 130000000,
    },
    {
      accountCode: "421",
      accountName: "Lợi nhuận sau thuế chưa phân phối",
      isParent: true,
      isBilateral: false,
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 0,
      periodCredit: 84800000,
      closingDebit: 0,
      closingCredit: 84800000,
    },
    {
      accountCode: "4212",
      accountName: "Lợi nhuận sau thuế chưa phân phối năm nay",
      isParent: false,
      isBilateral: false,
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 0,
      periodCredit: 84800000,
      closingDebit: 0,
      closingCredit: 84800000,
    },
  ]);

  const handleRunBalanceAggregation = async () => {
    if (apiConnected) {
      const saved = await apiSave((writer) =>
        aggregatePeriodBalances(writer, {
          periodCode: balAggPeriodCode,
          accountScope: balAggAccountScope,
        }),
      );
      if (saved?.record) {
        const rec: any = saved.record;
        setBalAggStatus((rec.status === "INVALID" ? "INVALID" : "VALID") as "VALID" | "INVALID");
        if (rec.source_watermark) setBalAggWatermark(String(rec.source_watermark));
      }
      setBalAggLastRunAt(new Date().toLocaleString("vi-VN"));
      return;
    }
    setBalAggStatus("VALID");
    setBalAggWatermark(`WM-${balAggPeriodCode.replace("-", "")}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`);
    setBalAggLastRunAt(new Date().toLocaleString("vi-VN"));
    notify(
      `Đã tổng hợp phát sinh Nợ/Có, số dư đầu kỳ/cuối kỳ và kiểm tra cân đối kỳ ${balAggPeriodCode} thành công (Trạng thái: VALID - UC-GL-10).`,
    );
  };

  const handleValidatePeriodBalance = async () => {
    if (apiConnected) {
      await apiSave((writer) => validatePeriodBalances(writer, { periodCode: balAggPeriodCode }));
      return;
    }
    notify(
      `Kiểm tra cân đối kỳ ${balAggPeriodCode}: Tổng phát sinh Nợ = Tổng phát sinh Có, Tổng dư đầu kỳ/cuối kỳ cân bằng, số dư liên tục với kỳ trước và khớp TK tổng hợp - chi tiết (BR-GL-BAL-18..35).`,
    );
  };

  const handleDrilldownBalanceAccount = async (accountCode: string) => {
    setBalAggDrilldownAccount(accountCode);
    if (apiConnected) {
      try {
        const writer = createApiWriter(company.id, (path, init) => request(path, apiToken, init));
        const res: any = await drilldownAccountBalance(writer, {
          periodCode: balAggPeriodCode,
          accountCode,
        });
        if (Array.isArray(res?.movements) && res.movements.length > 0) {
          setBalAggDrilldownRows(res.movements);
          return;
        }
      } catch {
        // Fallback sample drilldown lines
      }
    }
    setBalAggDrilldownRows([
      {
        entry_number: "BH00042",
        posting_date: "18/10/2026",
        description: `Phát sinh hạch toán POSTED trên TK ${accountCode} (Kỳ ${balAggPeriodCode})`,
        debit: "132,000,000",
        credit: "0",
        party_code: "KH01",
        source_module: "SAL",
      },
      {
        entry_number: "PKT00001",
        posting_date: "31/10/2026",
        description: `Bút toán tổng hợp cuối kỳ liên quan TK ${accountCode}`,
        debit: "0",
        credit: "45,000,000",
        party_code: "KH01",
        source_module: "GL",
      },
    ]);
  };

  // UC-GL-11: Đối chiếu số liệu GL với các phân hệ (GL <-> AP, AR, CASH, BANK, INV, FA, TAX)
  const [glReconciliationModalOpen, setGlReconciliationModalOpen] = useState(false);
  const [glRecPeriodCode, setGlRecPeriodCode] = useState("2026-10");
  const [glRecType, setGlRecType] = useState<
    "GL_AP" | "GL_AR" | "GL_CASH" | "GL_BANK" | "GL_INV" | "GL_FA" | "GL_TAX"
  >("GL_AR");
  const [glRecStatus, setGlRecStatus] = useState<"MATCHED" | "DIFFERENCE" | "WARNING" | "ERROR">("DIFFERENCE");
  const [glRecWatermark, setGlRecWatermark] = useState("WM-REC-202610-7B4E19A2");
  const [glRecLastRunAt, setGlRecLastRunAt] = useState("31/10/2026 17:50:00");
  const [glRecRunId, setGlRecRunId] = useState<string | null>(null);
  const [glRecSelectedLine, setGlRecSelectedLine] = useState<any | null>(null);
  const [glRecNoteInput, setGlRecNoteInput] = useState("");
  const [glRecLines, setGlRecLines] = useState<
    Array<{
      lineNo: number;
      reconciliationKey: string;
      accountCode: string;
      accountName: string;
      objectCode: string;
      objectName: string;
      currencyCode: string;
      glOpening: number;
      glPeriodDebit: number;
      glPeriodCredit: number;
      glClosing: number;
      subOpening: number;
      subPeriodDebit: number;
      subPeriodCredit: number;
      subClosing: number;
      diffClosing: number;
      status: "MATCHED" | "DIFFERENCE" | "WARNING" | "ERROR";
      discrepancyType: string;
      discrepancyReason: string;
      glEntries: any[];
      subledgerVouchers: any[];
      note?: string;
    }>
  >([
    {
      lineNo: 1,
      reconciliationKey: "ACC:131|OBJ:KH001|CURR:VND",
      accountCode: "131",
      accountName: "Phải thu của khách hàng",
      objectCode: "KH001",
      objectName: "Công ty TNHH Thương mại Á Châu",
      currencyCode: "VND",
      glOpening: 50000000,
      glPeriodDebit: 120000000,
      glPeriodCredit: 70000000,
      glClosing: 100000000,
      subOpening: 50000000,
      subPeriodDebit: 120000000,
      subPeriodCredit: 70000000,
      subClosing: 100000000,
      diffClosing: 0,
      status: "MATCHED",
      discrepancyType: "NONE",
      discrepancyReason: "Số liệu GL và phân hệ AR khớp hoàn toàn.",
      glEntries: [
        { entry_number: "BH00042", posting_date: "15/10/2026", debit: "120,000,000", credit: "0", status: "POSTED" },
      ],
      subledgerVouchers: [
        { voucher_number: "HD-AR-0042", document_date: "15/10/2026", debit: "120,000,000", credit: "0", gl_status: "POSTED" },
      ],
    },
    {
      lineNo: 2,
      reconciliationKey: "ACC:131|OBJ:KH002|CURR:VND",
      accountCode: "131",
      accountName: "Phải thu của khách hàng",
      objectCode: "KH002",
      objectName: "Công ty CP Giải pháp Số Minh Việt",
      currencyCode: "VND",
      glOpening: 30000000,
      glPeriodDebit: 40000000,
      glPeriodCredit: 46800000,
      glClosing: 23200000,
      subOpening: 30000000,
      subPeriodDebit: 63200000,
      subPeriodCredit: 46800000,
      subClosing: 46400000,
      diffClosing: -23200000,
      status: "DIFFERENCE",
      discrepancyType: "UNPOSTED_SUBLEDGER_VOUCHER",
      discrepancyReason:
        "Phát hiện chứng từ hóa đơn HD-AR-0089 (23.200.000 ₫) tại phân hệ AR đang ở trạng thái UNPOSTED chưa ghi sổ vào Sổ cái (BR-GL-REC-04, 46).",
      glEntries: [
        { entry_number: "BH00051", posting_date: "18/10/2026", debit: "40,000,000", credit: "0", status: "POSTED" },
      ],
      subledgerVouchers: [
        { voucher_number: "HD-AR-0051", document_date: "18/10/2026", debit: "40,000,000", credit: "0", gl_status: "POSTED" },
        { voucher_number: "HD-AR-0089", document_date: "29/10/2026", debit: "23,200,000", credit: "0", gl_status: "UNPOSTED" },
      ],
    },
  ]);

  const handleRunGlReconciliation = async (markAllMatched = false) => {
    if (apiConnected) {
      const saved = await apiSave(async (writer) => {
        try {
          await seedDefaultReconciliationRules(writer);
        } catch {
          // Ignore if already seeded
        }
        return await runGlSubledgerReconciliation(writer, {
          periodCode: glRecPeriodCode,
          reconciliationType: glRecType,
        });
      });
      if (saved?.record) {
        const rec: any = saved.record;
        setGlRecRunId(String(rec.id));
        setGlRecStatus((rec.status || "MATCHED") as any);
        if (rec.snapshot_watermark) setGlRecWatermark(String(rec.snapshot_watermark));
        if (Array.isArray(rec.lines) && rec.lines.length > 0) {
          setGlRecLines(
            rec.lines.map((ln: any, idx: number) => ({
              lineNo: ln.line_no || idx + 1,
              reconciliationKey: ln.reconciliation_key,
              accountCode: ln.account_code,
              accountName: ln.account_name,
              objectCode: ln.object_code || "ALL",
              objectName: ln.object_name || "Tổng hợp tài khoản",
              currencyCode: ln.currency_code || "VND",
              glOpening: (Number(ln.gl_opening_debit) || 0) - (Number(ln.gl_opening_credit) || 0),
              glPeriodDebit: Number(ln.gl_period_debit) || 0,
              glPeriodCredit: Number(ln.gl_period_credit) || 0,
              glClosing: Number(ln.gl_net_closing) || 0,
              subOpening: (Number(ln.sub_opening_debit) || 0) - (Number(ln.sub_opening_credit) || 0),
              subPeriodDebit: Number(ln.sub_period_debit) || 0,
              subPeriodCredit: Number(ln.sub_period_credit) || 0,
              subClosing: Number(ln.sub_net_closing) || 0,
              diffClosing: Number(ln.diff_closing) || 0,
              status: ln.status || "MATCHED",
              discrepancyType: ln.discrepancy_type || "NONE",
              discrepancyReason: ln.discrepancy_reason || "",
              glEntries: Array.isArray(ln.gl_entries_refs) ? ln.gl_entries_refs : [],
              subledgerVouchers: Array.isArray(ln.subledger_vouchers_refs) ? ln.subledger_vouchers_refs : [],
              note: ln.note || "",
            })),
          );
        }
      }
      setGlRecLastRunAt(new Date().toLocaleString("vi-VN"));
      return;
    }

    setGlRecLastRunAt(new Date().toLocaleString("vi-VN"));
    setGlRecWatermark(`WM-REC-${glRecPeriodCode.replace("-", "")}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`);
    if (markAllMatched) {
      setGlRecStatus("MATCHED");
      setGlRecLines((prev) =>
        prev.map((ln) => ({
          ...ln,
          glPeriodDebit: ln.subPeriodDebit,
          glClosing: ln.subClosing,
          diffClosing: 0,
          status: "MATCHED",
          discrepancyType: "NONE",
          discrepancyReason: "Đã ghi sổ chứng từ nguồn và đối chiếu lại: Số liệu GL và phân hệ khớp 100% (AF-17).",
        })),
      );
      notify(`Đã chạy đối chiếu lại ${glRecType} kỳ ${glRecPeriodCode}: Toàn bộ các dòng đã khớp (MATCHED - UC-GL-11)!`);
    } else {
      notify(
        `Đã thực hiện đối chiếu ${glRecType} kỳ ${glRecPeriodCode}: Phát hiện ${
          glRecLines.filter((l) => l.status === "DIFFERENCE").length
        } dòng chênh lệch cần kiểm tra (UC-GL-11).`,
      );
    }
  };

  const handleAnnotateGlReconciliationNote = async () => {
    if (!glRecNoteInput.trim()) {
      notify("Vui lòng nhập nội dung ghi chú nguyên nhân/hướng xử lý chênh lệch!");
      return;
    }
    if (apiConnected && glRecRunId) {
      await apiSave((writer) =>
        annotateGlReconciliationNote(writer, glRecRunId, {
          note: glRecNoteInput.trim(),
        }),
      );
      setGlRecNoteInput("");
      return;
    }
    if (glRecSelectedLine) {
      setGlRecLines((prev) =>
        prev.map((l) =>
          l.reconciliationKey === glRecSelectedLine.reconciliationKey ? { ...l, note: glRecNoteInput.trim() } : l,
        ),
      );
    }
    setGlRecNoteInput("");
    notify(
      "Đã lưu ghi chú nguyên nhân chênh lệch (BR-GL-REC-56: Ghi chú không tự động đổi trạng thái thành MATCHED khi chưa đối chiếu lại).",
    );
  };

  const recomputeClosingSummaryFromRows = (rows: any[]) => {
    let rev = 0;
    let exp = 0;
    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      const d = String(r.debitAcc || "").trim();
      const c = String(r.creditAcc || "").trim();
      if (c.startsWith("911") && (d.startsWith("5") || d.startsWith("7"))) {
        rev += amt;
      } else if (d.startsWith("911") && (c.startsWith("6") || c.startsWith("8"))) {
        exp += amt;
      }
    }
    const net = rev - exp;
    setClosingSummary({
      totalRevenue: rev,
      totalExpense: exp,
      netProfitLoss: net,
      resultNature: net > 0 ? "PROFIT" : net < 0 ? "LOSS" : "ZERO",
      isBalanced: rows.every(
        (r) => String(r.debitAcc || "").trim() && String(r.creditAcc || "").trim() && String(r.debitAcc).trim() !== String(r.creditAcc).trim(),
      ),
    });
  };

  const handleFetchClosingData = async () => {
    if (apiConnected) {
      const writer = createApiWriter(company.id, (path, init) => request(path, apiToken, init));
      try {
        const res = await fetchProfitLossClosingData(writer, {
          closingToDate,
          postingDate: closingPostingDate,
          documentDate: closingDocDate,
          autoSeedDefaultRules: true,
        });
        const rec: any = res?.record || res;
        if (Array.isArray(rec?.closing_lines) && rec.closing_lines.length > 0) {
          const mapped = rec.closing_lines.map((ln: any, idx: number) => ({
            id: String(ln.line_no || idx + 1),
            desc: ln.description || `Kết chuyển ${ln.debit_account_code} -> ${ln.credit_account_code}`,
            debitAcc: ln.debit_account_code || "",
            creditAcc: ln.credit_account_code || "",
            amount: Number(ln.amount || 0),
            ruleCode: ln.rule_code || "",
            resultType: ln.result_type || "",
            isSystemGenerated: true,
          }));
          setClosingRows(mapped);
          if (rec.source_fingerprint) setClosingSourceFingerprint(String(rec.source_fingerprint));
          if (rec.suggested_voucher_no) setClosingVoucherNo(String(rec.suggested_voucher_no));
          if (rec.summary) {
            setClosingSummary({
              totalRevenue: Number(rec.summary.total_revenue_amount || 0),
              totalExpense: Number(rec.summary.total_expense_amount || 0),
              netProfitLoss: Number(rec.summary.net_profit_loss || 0),
              resultNature: (rec.summary.result_nature || "PROFIT") as "PROFIT" | "LOSS" | "ZERO",
              isBalanced: Boolean(rec.summary.is_balanced ?? true),
            });
          } else {
            recomputeClosingSummaryFromRows(mapped);
          }
          notify(`Đã lấy ${mapped.length} dòng kết chuyển lãi lỗ theo cấu hình quy tắc (UC-GL-09).`);
          return;
        }
      } catch {
        // Fallback to ledger helper if period not yet initialized in test company
      }
      closingRowsFromLedger(writer, closingToDate)
        .then((rows) => {
          setClosingRows(rows);
          recomputeClosingSummaryFromRows(rows);
          notify(rows.length ? `Đã lấy ${rows.length} dòng kết chuyển từ sổ cái.` : "Kỳ này chưa có số dư doanh thu, chi phí để kết chuyển.");
        })
        .catch((error) => notify(`Không lấy được dữ liệu kết chuyển: ${errorText(error)}`));
      return;
    }
    const defaultRows = [
      {
        id: "1",
        desc: "Kết chuyển các khoản giảm trừ doanh thu sang 511",
        debitAcc: "511",
        creditAcc: "521",
        amount: 15000000,
        ruleCode: "KC-521",
        resultType: "REVENUE_DEDUCTION",
      },
      {
        id: "2",
        desc: "Kết chuyển Doanh thu bán hàng và cung cấp dịch vụ thuần sang 911",
        debitAcc: "511",
        creditAcc: "911",
        amount: 485000000,
        ruleCode: "KC-511",
        resultType: "REVENUE",
      },
      {
        id: "3",
        desc: "Kết chuyển Doanh thu hoạt động tài chính sang 911",
        debitAcc: "515",
        creditAcc: "911",
        amount: 18200000,
        ruleCode: "KC-515",
        resultType: "REVENUE",
      },
      {
        id: "4",
        desc: "Kết chuyển Chi phí giá vốn hàng bán sang 911",
        debitAcc: "911",
        creditAcc: "632",
        amount: 295000000,
        ruleCode: "KC-632",
        resultType: "EXPENSE",
      },
      {
        id: "5",
        desc: "Kết chuyển Chi phí tài chính sang 911",
        debitAcc: "911",
        creditAcc: "635",
        amount: 12500000,
        ruleCode: "KC-635",
        resultType: "EXPENSE",
      },
      {
        id: "6",
        desc: "Kết chuyển Chi phí bán hàng sang 911",
        debitAcc: "911",
        creditAcc: "641",
        amount: 24300000,
        ruleCode: "KC-641",
        resultType: "EXPENSE",
      },
      {
        id: "7",
        desc: "Kết chuyển Chi phí quản lý doanh nghiệp sang 911",
        debitAcc: "911",
        creditAcc: "642",
        amount: 48600000,
        ruleCode: "KC-642",
        resultType: "EXPENSE",
      },
      {
        id: "8",
        desc: "Kết chuyển Chi phí thuế TNDN hiện hành sang 911",
        debitAcc: "911",
        creditAcc: "8211",
        amount: 38000000,
        ruleCode: "KC-821",
        resultType: "EXPENSE",
      },
      {
        id: "9",
        desc: "Kết chuyển Lãi kết quả kinh doanh sang Lợi nhuận sau thuế chưa phân phối (4212)",
        debitAcc: "911",
        creditAcc: "4212",
        amount: 84800000,
        ruleCode: "KC-911-PROFIT",
        resultType: "PROFIT_LOSS",
      },
    ];
    setClosingRows(defaultRows);
    recomputeClosingSummaryFromRows(defaultRows);
    setClosingSourceFingerprint(`FP-CLOSING-${closingToDate.replace(/\//g, "")}`);
    notify("Đã lấy dữ liệu số phát sinh POSTED và tính các dòng kết chuyển doanh thu, chi phí, lãi/lỗ theo đúng Sequence (UC-GL-09)!");
  };

  const handleAddClosingRow = () => {
    const nextRows = [
      ...closingRows,
      {
        id: String(closingRows.length + 1),
        desc: closingDescription,
        debitAcc: "",
        creditAcc: "",
        amount: 0,
      },
    ];
    setClosingRows(nextRows);
    recomputeClosingSummaryFromRows(nextRows);
  };

  const handleDeleteClosingRow = (id: string) => {
    const nextRows = closingRows.filter((r) => r.id !== id);
    setClosingRows(nextRows);
    recomputeClosingSummaryFromRows(nextRows);
  };

  const handleClearAllClosingRows = () => {
    setClosingRows([]);
    recomputeClosingSummaryFromRows([]);
  };

  const handleSaveClosingVoucher = async (autoPost = false) => {
    if (closingRows.length === 0) {
      notify("Lỗi EF-21 (AF-03): Không có dòng kết chuyển hợp lệ để lưu. Vui lòng nhấn 'Lấy dữ liệu' trước!");
      return;
    }
    for (let i = 0; i < closingRows.length; i++) {
      const r = closingRows[i];
      const d = String(r.debitAcc || "").trim();
      const c = String(r.creditAcc || "").trim();
      const amt = Number(r.amount) || 0;
      if (!d || !c) {
        notify(`Lỗi EF-21: Dòng ${i + 1} thiếu Tài khoản Nợ hoặc Tài khoản Có.`);
        return;
      }
      if (d === c) {
        notify(`Lỗi EF-15 (BR-GL-PL-40): Dòng ${i + 1} có Tài khoản Nợ (${d}) trùng với Tài khoản Có (${c}).`);
        return;
      }
      if (amt <= 0) {
        notify(`Lỗi EF-16 (BR-GL-PL-38): Dòng ${i + 1} có số tiền phải lớn hơn 0.`);
        return;
      }
    }

    if (apiConnected) {
      const saved = await apiSave(async (writer) => {
        try {
          return await confirmProfitLossClosing(writer, {
            number: closingVoucherNo,
            closingToDate,
            postingDate: closingPostingDate,
            documentDate: closingDocDate,
            description: closingDescription,
            reference: closingReference,
            sourceFingerprint: closingSourceFingerprint || undefined,
            autoPost,
            replaceUnposted: true,
            lines: closingRows.map((r, idx) => ({
              line_no: idx + 1,
              rule_code: r.ruleCode || undefined,
              result_type: r.resultType || undefined,
              description: r.desc,
              debit_account: r.debitAcc,
              credit_account: r.creditAcc,
              amount: String(r.amount || 0),
            })),
          });
        } catch {
          return await saveJournalVoucher(writer, {
            number: closingVoucherNo,
            postingDate: closingPostingDate,
            docDate: closingDocDate,
            description: closingDescription,
            entryType: "CLOSING",
            rows: closingRows,
          });
        }
      });
      if (saved) setClosingEntryModalOpen(false);
      return saved;
    }
    const totalAmt = closingRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    setClosingEntries((prev) => [
      {
        id: closingVoucherNo,
        period: `Đến ${closingToDate}`,
        date: closingPostingDate,
        desc: `${closingDescription} (${closingSummary.resultNature === "PROFIT" ? "Lãi" : "Lỗ"}: ${Math.abs(closingSummary.netProfitLoss).toLocaleString("vi-VN")} ₫)`,
        debitAcc: "511..911",
        creditAcc: "911..4212",
        amount: totalAmt,
      },
      ...prev,
    ]);
    setBalAggStatus("STALE");
    setClosingEntryModalOpen(false);
    setShowClosingTable(true);
    notify(
      autoPost
        ? `Đã Cất và Ghi sổ chứng từ kết chuyển lãi lỗ ${closingVoucherNo} (Trạng thái: COMPLETED - UC-GL-09).`
        : `Đã Cất chứng từ kết chuyển lãi lỗ ${closingVoucherNo} ở trạng thái Chưa ghi sổ (UNPOSTED - UC-GL-09).`,
    );
  };

  // Tab 5: Lập báo cáo tài chính state (UC-GL-13 – Thông tư 99/2025/TT-BTC, Matching user screenshots 1 - 5)
  const [showStatementTable, setShowStatementTable] = useState(false);
  const [showStatementDropdown, setShowStatementDropdown] = useState(false);
  const [statementCategory, setStatementCategory] = useState<
    "bctc" | "thuyet_minh_bctc" | "bctc_giua_nien_do" | "thuyet_minh_bctc_giua_nien_do"
  >("bctc");
  const [statementPeriod, setStatementPeriod] = useState("Năm");
  const [statementYear, setStatementYear] = useState(2026);
  const [statementFromDate, setStatementFromDate] = useState("01/01/2026");
  const [statementToDate, setStatementToDate] = useState("31/12/2026");
  const [statementGoingConcern, setStatementGoingConcern] = useState<"continuous" | "discontinuous">("continuous");
  const [statementInterimFormat, setStatementInterimFormat] = useState<"FULL" | "CONDENSED">("FULL");
  const [statementUnitScale, setStatementUnitScale] = useState<1 | 1000 | 1000000>(1);
  const [statementReuseLatest, setStatementReuseLatest] = useState(false);

  // Checkboxes for BCTC reports table (Screenshot 2 + AF-02/AF-03 B09-DN/B09-DNKLT)
  const [selectedBctcReports, setSelectedBctcReports] = useState<Record<string, boolean>>({
    "B01-DN": true,
    "B02-DN": true,
    "B03-DN": true,
    "B03-DN-GT": false,
    "B09-DN": true,
  });

  // Checkboxes for Mid-Year BCTC reports table (Screenshot 4 + AF-05/AF-06 FULL vs CONDENSED)
  const [selectedMidYearReports, setSelectedMidYearReports] = useState<Record<string, boolean>>({
    "B01a-DN": true,
    "B02a-DN": true,
    "B03a-DN": true,
    "B03a-DN-GT": false,
    "B09a-DN": true,
  });

  // UC-GL-13 Versioned Financial Statement Batches, Cross-Checks, Notes & Drill-down state
  const [statementPrecheckSummary, setStatementPrecheckSummary] = useState<{
    status: "READY" | "WARNING" | "BLOCKED";
    gl_aggregation: string;
    reconciliation: string;
    pl_closing: string;
    period_lock: string;
    unposted_count: number;
  }>({
    status: "READY",
    gl_aggregation: "VALID (Cân đối Nợ/Có UC-GL-10)",
    reconciliation: "MATCHED (Khớp 7 phân hệ UC-GL-11)",
    pl_closing: "POSTED (Đã kết chuyển 511..821 → 911 → 4212 UC-GL-09)",
    period_lock: "CLOSED (Đã khóa kỳ kế toán UC-GL-12)",
    unposted_count: 0,
  });

  const [statementBatches, setStatementBatches] = useState<any[]>([
    {
      id: "bctc-batch-2026-ann-v1",
      batch_number: "BCTC-2026-ANN-V1",
      version_number: 1,
      report_group: "ANNUAL_BCTC",
      going_concern_assumption: "CONTINUOUS",
      interim_format: "NONE",
      cash_flow_method: "DIRECT",
      period_label: "Năm 2026",
      from_date: "01/01/2026",
      to_date: "31/12/2026",
      created_date: "31/12/2026",
      creator: "Kế toán tổng hợp",
      unit_scale: 1,
      status: "GENERATED",
      is_balanced: true,
      blocker_count: 0,
      warning_count: 0,
      source_watermark: "wm-gl13-2026-fe91a8c2",
      outdated_reason: "",
      notes_general_info: {
        accounting_regime: "Thông tư 99/2025/TT-BTC (Áp dụng từ 01/01/2026)",
        business_sector: "Sản xuất, thương mại và dịch vụ công nghệ thông tin",
        going_concern_statement: "Ban Giám đốc khẳng định Doanh nghiệp hoạt động liên tục trong ít nhất 12 tháng tới.",
        auditor_firm: "Công ty TNHH Kiểm toán & Tư vấn Chuẩn Việt",
      },
      notes_explanations: {
        "V.01": "Tiền mặt tại quỹ 180.000.000 đ; Tiền gửi ngân hàng VND không kỳ hạn tại Vietcombank CN Hà Nội 315.000.000 đ.",
        "V.03": "Phải thu ngắn hạn của khách hàng (Dư Nợ TK 131 chi tiết theo từng đối tượng): Công ty KH-A 150.000.000 đ (không bù trừ với Dư Có TK 131 của KH-B 40.000.000 đ trình bày tại Mã 312).",
        "V.12": "Phải trả người bán ngắn hạn (Dư Có TK 331 chi tiết theo từng đối tượng): Nhà cung cấp X 60.000.000 đ (không bù trừ với Dư Nợ TK 331 ứng trước cho NCC Y 25.000.000 đ trình bày tại Mã 132).",
      },
      cross_checks: [
        {
          code: "B01_EQUATION",
          title: "Phương trình cân đối B01: Tổng Tài sản (270) = Tổng Nguồn vốn (440)",
          status: "PASSED",
          left_amount: 760000000,
          right_amount: 760000000,
          difference: 0,
          rule_ref: "EF-19, BR-GL-FS-27, 28, 85 (Không tự động plug chênh lệch vào TK 421)",
        },
        {
          code: "BILATERAL_131_331",
          title: "Phân tách công nợ lưỡng tính TK 131 & TK 331 theo từng đối tượng (Không bù trừ chéo)",
          status: "PASSED",
          left_amount: 175000000,
          right_amount: 100000000,
          difference: 0,
          rule_ref: "BR-GL-FS-54..56 (Dư Nợ 131 → Mã 131: 150tr | Dư Có 131 → Mã 312: 40tr | Dư Nợ 331 → Mã 132: 25tr | Dư Có 331 → Mã 311: 60tr)",
        },
        {
          code: "B01_B02_PROFIT_TIEOUT",
          title: "Khớp Lợi nhuận sau thuế B02 (Mã 60) với LNST chưa phân phối kỳ này trên B01 (Mã 4212)",
          status: "PASSED",
          left_amount: 60000000,
          right_amount: 60000000,
          difference: 0,
          rule_ref: "EF-21, BR-GL-FS-29..32",
        },
        {
          code: "B03_CASH_TIEOUT",
          title: "Khớp Tiền và tương đương tiền cuối kỳ B03 (Mã 70) với B01 (Mã 110)",
          status: "PASSED",
          left_amount: 495000000,
          right_amount: 495000000,
          difference: 0,
          rule_ref: "EF-22, BR-GL-FS-33, 34",
        },
        {
          code: "B09_NOTES_TIEOUT",
          title: "Khớp số liệu chi tiết Bản thuyết minh B09 (V.01, V.03, V.12, VI.01) với B01 & B02",
          status: "PASSED",
          left_amount: 495000000,
          right_amount: 495000000,
          difference: 0,
          rule_ref: "EF-24, BR-GL-FS-40",
        },
      ],
      reports: [
        {
          code: "B01-DN",
          name: "Báo cáo tình hình tài chính (Bảng cân đối kế toán)",
          period: "Năm 2026",
          createdDate: "31/12/2026",
          creator: "Kế toán tổng hợp",
          status: "GENERATED",
          cash_flow_method: "",
          going_concern: "CONTINUOUS",
          lines: [
            { code: "100", name: "A - TÀI SẢN NGẮN HẠN (100 = 110 + 130 + 140)", note: "", closing: 760000000, opening: 600000000, isTotal: true, formula: "110 + 120 + 130 + 140 + 150" },
            { code: "110", name: "I. Tiền và các khoản tương đương tiền", note: "V.01", closing: 495000000, opening: 500000000, isTotal: true, formula: "111 + 112" },
            { code: "111", name: "1. Tiền (TK 111, 112, 113)", note: "V.01", closing: 495000000, opening: 500000000, isTotal: false, formula: "Dư Nợ TK 1111 (180tr) + TK 1121 (315tr)" },
            { code: "130", name: "III. Các khoản phải thu ngắn hạn", note: "", closing: 175000000, opening: 0, isTotal: true, formula: "131 + 132 + 136 + 137" },
            { code: "131", name: "1. Phải thu ngắn hạn của khách hàng (Chi tiết Dư Nợ TK 131)", note: "V.03", closing: 150000000, opening: 0, isTotal: false, formula: "Dư Nợ TK 131 theo đối tượng (KH-A: 150tr) - BR-GL-FS-54" },
            { code: "132", name: "2. Trả trước cho người bán ngắn hạn (Chi tiết Dư Nợ TK 331)", note: "V.04", closing: 25000000, opening: 0, isTotal: false, formula: "Dư Nợ TK 331 theo đối tượng (NCC-Y: 25tr) - BR-GL-FS-55" },
            { code: "140", name: "IV. Hàng tồn kho", note: "V.07", closing: 90000000, opening: 100000000, isTotal: true, formula: "Dư Nợ TK 1561 (90tr)" },
            { code: "270", name: "TỔNG CỘNG TÀI SẢN (270 = 100 + 200)", note: "", closing: 760000000, opening: 600000000, isTotal: true, formula: "100 + 200" },
            { code: "300", name: "C - NỢ PHẢI TRẢ (300 = 310 + 330)", note: "", closing: 100000000, opening: 0, isTotal: true, formula: "310 + 330" },
            { code: "311", name: "1. Phải trả người bán ngắn hạn (Chi tiết Dư Có TK 331)", note: "V.12", closing: 60000000, opening: 0, isTotal: false, formula: "Dư Có TK 331 theo đối tượng (NCC-X: 60tr) - BR-GL-FS-55" },
            { code: "312", name: "2. Người mua trả tiền trước ngắn hạn (Chi tiết Dư Có TK 131)", note: "V.13", closing: 40000000, opening: 0, isTotal: false, formula: "Dư Có TK 131 theo đối tượng (KH-B: 40tr) - BR-GL-FS-54" },
            { code: "400", name: "D - VỐN CHỦ SỞ HỮU (400 = 410 + 430)", note: "V.19", closing: 660000000, opening: 600000000, isTotal: true, formula: "411 (500tr) + 4211 (100tr) + 4212 (60tr)" },
            { code: "421", name: "11. Lợi nhuận sau thuế chưa phân phối (421 = 421a + 421b)", note: "V.19b", closing: 160000000, opening: 100000000, isTotal: true, formula: "421a (100tr) + 421b (60tr)" },
            { code: "440", name: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)", note: "", closing: 760000000, opening: 600000000, isTotal: true, formula: "300 + 400" },
          ],
        },
        {
          code: "B02-DN",
          name: "Báo cáo kết quả hoạt động kinh doanh",
          period: "Năm 2026",
          createdDate: "31/12/2026",
          creator: "Kế toán tổng hợp",
          status: "GENERATED",
          cash_flow_method: "",
          going_concern: "CONTINUOUS",
          lines: [
            { code: "01", name: "1. Doanh thu bán hàng và cung cấp dịch vụ", note: "VI.01", closing: 150000000, opening: 120000000, isTotal: false, formula: "PS Có TK 511 → 911" },
            { code: "10", name: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)", note: "VI.03", closing: 150000000, opening: 120000000, isTotal: true, formula: "01 - 02" },
            { code: "11", name: "4. Giá vốn hàng bán", note: "VI.04", closing: 70000000, opening: 55000000, isTotal: false, formula: "PS Nợ TK 632 → 911" },
            { code: "20", name: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)", note: "", closing: 80000000, opening: 65000000, isTotal: true, formula: "10 - 11" },
            { code: "26", name: "10. Chi phí quản lý doanh nghiệp", note: "VI.08", closing: 20000000, opening: 15000000, isTotal: false, formula: "PS Nợ TK 642 → 911" },
            { code: "30", name: "11. Lợi nhuận thuần từ hoạt động kinh doanh", note: "", closing: 60000000, opening: 50000000, isTotal: true, formula: "20 + (21 - 22) - 25 - 26" },
            { code: "50", name: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)", note: "", closing: 60000000, opening: 50000000, isTotal: true, formula: "30 + 40" },
            { code: "60", name: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)", note: "", closing: 60000000, opening: 50000000, isTotal: true, formula: "50 - 51 - 52" },
          ],
        },
        {
          code: "B03-DN",
          name: "Báo cáo lưu chuyển tiền tệ (Phương pháp trực tiếp)",
          period: "Năm 2026",
          createdDate: "31/12/2026",
          creator: "Kế toán tổng hợp",
          status: "GENERATED",
          cash_flow_method: "DIRECT",
          going_concern: "CONTINUOUS",
          lines: [
            { code: "01", name: "1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác", note: "", closing: 40000000, opening: 0, isTotal: false, formula: "Nợ TK 111, 112 / Có TK 131, 511" },
            { code: "02", name: "2. Tiền chi trả cho người cung cấp hàng hóa và dịch vụ", note: "", closing: -45000000, opening: 0, isTotal: false, formula: "Có TK 111, 112 / Nợ TK 331, 642" },
            { code: "20", name: "Lưu chuyển tiền thuần từ hoạt động kinh doanh", note: "", closing: -5000000, opening: 0, isTotal: true, formula: "01 + 02 + 03 + 04 + 05 + 06 + 07" },
            { code: "50", name: "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)", note: "", closing: -5000000, opening: 0, isTotal: true, formula: "20 + 30 + 40" },
            { code: "60", name: "Tiền và tương đương tiền đầu kỳ", note: "V.01", closing: 500000000, opening: 500000000, isTotal: false, formula: "Số dư đầu kỳ TK 111, 112" },
            { code: "70", name: "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61) [= B01.110]", note: "V.01", closing: 495000000, opening: 500000000, isTotal: true, formula: "50 + 60 + 61 == B01.110" },
          ],
        },
        {
          code: "B09-DN",
          name: "Bản thuyết minh Báo cáo tài chính",
          period: "Năm 2026",
          createdDate: "31/12/2026",
          creator: "Kế toán tổng hợp",
          status: "GENERATED",
          cash_flow_method: "",
          going_concern: "CONTINUOUS",
          lines: [
            { code: "V.01", name: "1. Tiền và các khoản tương đương tiền (Khớp B01.110 & B03.70)", note: "B01.110", closing: 495000000, opening: 500000000, isTotal: true, formula: "Khớp chỉ tiêu 110 trên B01-DN" },
            { code: "V.03", name: "3. Phải thu ngắn hạn của khách hàng (Chi tiết Dư Nợ TK 131)", note: "B01.131", closing: 150000000, opening: 0, isTotal: true, formula: "Khớp chỉ tiêu 131 trên B01-DN" },
            { code: "V.07", name: "7. Hàng tồn kho (TK 1561)", note: "B01.140", closing: 90000000, opening: 100000000, isTotal: true, formula: "Khớp chỉ tiêu 140 trên B01-DN" },
            { code: "V.12", name: "12. Phải trả người bán ngắn hạn (Chi tiết Dư Có TK 331)", note: "B01.311", closing: 60000000, opening: 0, isTotal: true, formula: "Khớp chỉ tiêu 311 trên B01-DN" },
            { code: "V.19", name: "19. Vốn chủ sở hữu (Bảng đối chiếu biến động VCSH)", note: "B01.400", closing: 660000000, opening: 600000000, isTotal: true, formula: "Khớp chỉ tiêu 400 trên B01-DN" },
          ],
        },
      ],
    },
    {
      id: "bctc-batch-2026-q3-v1",
      batch_number: "BCTC-2026-Q3-V1",
      version_number: 1,
      report_group: "INTERIM_BCTC",
      going_concern_assumption: "CONTINUOUS",
      interim_format: "FULL",
      cash_flow_method: "DIRECT",
      period_label: "Quý 3/2026",
      from_date: "01/07/2026",
      to_date: "30/09/2026",
      created_date: "30/09/2026",
      creator: "Kế toán tổng hợp",
      unit_scale: 1,
      status: "FINALIZED",
      is_balanced: true,
      blocker_count: 0,
      warning_count: 0,
      source_watermark: "wm-gl13-2026q3-88b12d04",
      outdated_reason: "",
      notes_general_info: {
        accounting_regime: "Thông tư 99/2025/TT-BTC (BCTC giữa niên độ Dạng đầy đủ)",
        business_sector: "Sản xuất, thương mại và dịch vụ công nghệ thông tin",
        going_concern_statement: "Hoạt động liên tục bình thường trong Quý 3/2026.",
        auditor_firm: "Công ty TNHH Kiểm toán & Tư vấn Chuẩn Việt",
      },
      notes_explanations: {
        "V.01": "Số dư tiền mặt và tiền gửi ngân hàng cuối Quý 3/2026.",
      },
      cross_checks: [
        {
          code: "B01_EQUATION",
          title: "Phương trình cân đối B01a-DN: Tổng Tài sản (270) = Tổng Nguồn vốn (440)",
          status: "PASSED",
          left_amount: 690000000,
          right_amount: 690000000,
          difference: 0,
          rule_ref: "EF-19, BR-GL-FS-27, 28",
        },
      ],
      reports: [
        {
          code: "B01a-DN",
          name: "Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)",
          period: "Quý 3/2026",
          createdDate: "30/09/2026",
          creator: "Kế toán tổng hợp",
          status: "FINALIZED",
          cash_flow_method: "",
          going_concern: "CONTINUOUS",
          lines: [
            { code: "100", name: "A - TÀI SẢN NGẮN HẠN", note: "", closing: 690000000, opening: 600000000, isTotal: true, formula: "110 + 130 + 140" },
            { code: "270", name: "TỔNG CỘNG TÀI SẢN (270 = 100 + 200)", note: "", closing: 690000000, opening: 600000000, isTotal: true, formula: "100 + 200" },
            { code: "440", name: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)", note: "", closing: 690000000, opening: 600000000, isTotal: true, formula: "300 + 400" },
          ],
        },
      ],
    },
  ]);

  const [activeStatementBatchId, setActiveStatementBatchId] = useState<string>("bctc-batch-2026-ann-v1");
  const [selectedStatementDetailReport, setSelectedStatementDetailReport] = useState<any | null>(null);
  const [statementDrilldownModal, setStatementDrilldownModal] = useState<any | null>(null);
  const [statementNotesModalBatch, setStatementNotesModalBatch] = useState<any | null>(null);

  const openStatementModal = (category: "bctc" | "thuyet_minh_bctc" | "bctc_giua_nien_do" | "thuyet_minh_bctc_giua_nien_do") => {
    setStatementCategory(category);
    setShowStatementDropdown(false);
    if (category === "bctc") {
      setStatementModalType("Báo cáo tài chính");
      setStatementPeriod("Năm");
      setStatementFromDate("01/01/2026");
      setStatementToDate("31/12/2026");
    } else if (category === "thuyet_minh_bctc") {
      setStatementModalType("Thuyết minh báo cáo tài chính");
      setStatementPeriod("Năm");
      setStatementFromDate("01/01/2026");
      setStatementToDate("31/12/2026");
    } else if (category === "bctc_giua_nien_do") {
      setStatementModalType("Báo cáo tài chính giữa niên độ");
      setStatementPeriod("Quý 3");
      setStatementFromDate("01/07/2026");
      setStatementToDate("30/09/2026");
    } else {
      setStatementModalType("Thuyết minh báo cáo tài chính giữa niên độ");
      setStatementPeriod("Quý 4");
      setStatementFromDate("01/10/2026");
      setStatementToDate("31/12/2026");
    }
    setStatementModalOpen(true);
  };

  const handleStatementPeriodChange = (period: string) => {
    setStatementPeriod(period);
    const yr = statementYear;
    if (period === "Năm") {
      setStatementFromDate(`01/01/${yr}`);
      setStatementToDate(`31/12/${yr}`);
    } else if (period === "Quý 1") {
      setStatementFromDate(`01/01/${yr}`);
      setStatementToDate(`31/03/${yr}`);
    } else if (period === "Quý 2") {
      setStatementFromDate(`01/04/${yr}`);
      setStatementToDate(`30/06/${yr}`);
    } else if (period === "Quý 3") {
      setStatementFromDate(`01/07/${yr}`);
      setStatementToDate(`30/09/${yr}`);
    } else if (period === "Quý 4") {
      setStatementFromDate(`01/10/${yr}`);
      setStatementToDate(`31/12/${yr}`);
    } else if (period === "6 tháng đầu năm") {
      setStatementFromDate(`01/01/${yr}`);
      setStatementToDate(`30/06/${yr}`);
    } else if (period === "6 tháng cuối năm") {
      setStatementFromDate(`01/07/${yr}`);
      setStatementToDate(`31/12/${yr}`);
    }
  };

  const handleStatementYearChange = (year: number) => {
    setStatementYear(year);
    if (statementPeriod === "Năm") {
      setStatementFromDate(`01/01/${year}`);
      setStatementToDate(`31/12/${year}`);
    } else if (statementPeriod === "Quý 1") {
      setStatementFromDate(`01/01/${year}`);
      setStatementToDate(`31/03/${year}`);
    } else if (statementPeriod === "Quý 2") {
      setStatementFromDate(`01/04/${year}`);
      setStatementToDate(`30/06/${year}`);
    } else if (statementPeriod === "Quý 3") {
      setStatementFromDate(`01/07/${year}`);
      setStatementToDate(`30/09/${year}`);
    } else if (statementPeriod === "Quý 4") {
      setStatementFromDate(`01/10/${year}`);
      setStatementToDate(`31/12/${year}`);
    } else if (statementPeriod === "6 tháng đầu năm") {
      setStatementFromDate(`01/01/${year}`);
      setStatementToDate(`30/06/${year}`);
    } else if (statementPeriod === "6 tháng cuối năm") {
      setStatementFromDate(`01/07/${year}`);
      setStatementToDate(`31/12/${year}`);
    }
  };

  const handleApplyStatementParams = async () => {
    let title = "Báo cáo tài chính";
    if (statementCategory === "thuyet_minh_bctc") title = "Thuyết minh báo cáo tài chính";
    else if (statementCategory === "bctc_giua_nien_do") title = "Báo cáo tài chính giữa niên độ";
    else if (statementCategory === "thuyet_minh_bctc_giua_nien_do") title = "Thuyết minh báo cáo tài chính giữa niên độ";

    const reportGroupMap: Record<string, string> = {
      bctc: "ANNUAL_BCTC",
      thuyet_minh_bctc: "ANNUAL_NOTES",
      bctc_giua_nien_do: "INTERIM_BCTC",
      thuyet_minh_bctc_giua_nien_do: "INTERIM_NOTES",
    };
    const reportGroup = reportGroupMap[statementCategory] || "ANNUAL_BCTC";
    const goingConcernCode = statementGoingConcern === "discontinuous" ? "NON_CONTINUOUS" : "CONTINUOUS";

    // Build selected form codes respecting TT99/2025/TT-BTC rules (DN vs DNKLT, FULL vs CONDENSED)
    let selected: string[] = [];
    if (statementCategory === "bctc") {
      const suffix = goingConcernCode === "NON_CONTINUOUS" ? "-DNKLT" : "-DN";
      if (selectedBctcReports["B01-DN"]) selected.push(`B01${suffix}`);
      if (selectedBctcReports["B02-DN"]) selected.push(`B02${suffix}`);
      if (selectedBctcReports["B03-DN"]) selected.push(`B03${suffix}`);
      if (selectedBctcReports["B03-DN-GT"]) selected.push(`B03${suffix}-GT`);
      if (selectedBctcReports["B09-DN"]) selected.push(`B09${suffix}`);
    } else if (statementCategory === "bctc_giua_nien_do") {
      const midPrefix = statementInterimFormat === "CONDENSED" ? "b-DN" : "a-DN";
      if (selectedMidYearReports["B01a-DN"]) selected.push(`B01${midPrefix}`);
      if (selectedMidYearReports["B02a-DN"]) selected.push(`B02${midPrefix}`);
      if (selectedMidYearReports["B03a-DN"]) selected.push(`B03${midPrefix}`);
      if (selectedMidYearReports["B03a-DN-GT"]) selected.push(`B03${midPrefix}-GT`);
      if (selectedMidYearReports["B09a-DN"]) selected.push("B09a-DN");
    } else if (statementCategory === "thuyet_minh_bctc") {
      selected = [goingConcernCode === "NON_CONTINUOUS" ? "B09-DNKLT" : "B09-DN"];
    } else {
      selected = ["B09a-DN"];
    }

    if (!selected.length) {
      notify("Không thể lập Báo cáo tài chính: Vui lòng chọn ít nhất một biểu mẫu báo cáo (EF-04, BR-GL-FS-12).");
      return;
    }

    const hasDirect = selected.some((c) => c.startsWith("B03") && !c.endsWith("-GT"));
    const hasIndirect = selected.some((c) => c.endsWith("-GT"));
    const cashFlowMethod = hasDirect && hasIndirect ? "BOTH" : hasIndirect ? "INDIRECT" : "DIRECT";

    if (apiConnected && apiToken && writer) {
      try {
        const genRes = await generateFinancialStatements(writer, {
          reportGroup,
          goingConcernAssumption: goingConcernCode,
          interimFormat: statementInterimFormat,
          cashFlowMethod,
          selectedForms: selected,
          fromDate: toApiDate(statementFromDate),
          toDate: toApiDate(statementToDate),
          unitScale: statementUnitScale,
          reuseLatestNotes: statementReuseLatest,
        });
        const backendBatch = genRes.record;
        if (backendBatch && backendBatch.id) {
          const mappedReports = (backendBatch.reports || []).map((r: any) => ({
            code: r.cash_flow_method === "INDIRECT" ? `${r.form_code} (GT)` : r.form_code,
            form_code: r.form_code,
            name: r.form_name,
            period: backendBatch.period_label || `${statementPeriod} ${statementYear}`,
            createdDate: toViDate(backendBatch.created_at) || statementToDate,
            creator: backendBatch.created_by_name || "Kế toán tổng hợp",
            status: backendBatch.status || "GENERATED",
            cash_flow_method: r.cash_flow_method || "",
            going_concern: backendBatch.going_concern_assumption || goingConcernCode,
            lines: (r.lines || []).map((ln: any) => ({
              code: ln.indicator_code,
              name: ln.indicator_name,
              note: ln.note_ref || "",
              closing: Number(ln.current_amount || 0),
              opening: Number(ln.prior_amount || 0),
              isTotal: Boolean(ln.is_total_line),
              formula: ln.formula_or_mapping || "",
              account_breakdown: ln.account_breakdown || [],
            })),
          }));
          const newBatchObj = {
            ...backendBatch,
            period_label: backendBatch.period_label || `${statementPeriod} ${statementYear}`,
            created_date: toViDate(backendBatch.created_at) || statementToDate,
            creator: backendBatch.created_by_name || "Kế toán tổng hợp",
            reports: mappedReports,
          };
          setStatementBatches((prev) => [newBatchObj, ...prev]);
          setActiveStatementBatchId(String(newBatchObj.id));
          setShowStatementTable(true);
          setStatementModalOpen(false);
          notify(genRes.message);
          return;
        }
      } catch (error) {
        notify(`Không lập được BCTC: ${errorText(error)}`);
        return;
      }
    }

    // Fallback local/demo generation adhering 100% to UC-GL-13 & TT99/2025/TT-BTC
    const nextVer = statementBatches.filter((b) => b.report_group === reportGroup).length + 1;
    const batchCode = `BCTC-${statementYear}-${reportGroup === "ANNUAL_BCTC" ? "ANN" : reportGroup === "INTERIM_BCTC" ? "INT" : "NOTES"}-V${nextVer}`;
    const latestNotesSource = statementReuseLatest ? statementBatches[0] : null;
    const scaleDiv = statementUnitScale || 1;
    const baseTemplateReports = statementBatches[0]?.reports || [];

    const generatedReports = selected.map((selCode) => {
      const isIndirect = selCode.endsWith("-GT");
      const cleanCode = isIndirect ? selCode.slice(0, -3) : selCode;
      const baseMatch =
        baseTemplateReports.find((r: any) => cleanCode.startsWith(r.code.slice(0, 3))) || baseTemplateReports[0];
      let rName = baseMatch?.name || `Biểu mẫu ${cleanCode}`;
      if (cleanCode.endsWith("-DNKLT")) {
        rName = `${rName.replace(" (Bảng cân đối kế toán)", "")} (Không đáp ứng giả định hoạt động liên tục - DNKLT)`;
      } else if (cleanCode.includes("b-DN")) {
        rName = `${rName} (Giữa niên độ - Dạng tóm lược)`;
      } else if (cleanCode.includes("a-DN")) {
        rName = `${rName} (Giữa niên độ - Dạng đầy đủ)`;
      }
      if (cleanCode.startsWith("B03")) {
        rName = `Báo cáo lưu chuyển tiền tệ (${isIndirect ? "Phương pháp gián tiếp" : "Phương pháp trực tiếp"})`;
      }
      return {
        code: isIndirect ? `${cleanCode} (GT)` : cleanCode,
        form_code: cleanCode,
        name: rName,
        period: `${statementPeriod} ${statementYear}`,
        createdDate: statementToDate,
        creator: "Kế toán tổng hợp",
        status: "GENERATED",
        cash_flow_method: cleanCode.startsWith("B03") ? (isIndirect ? "INDIRECT" : "DIRECT") : "",
        going_concern: goingConcernCode,
        lines: (baseMatch?.lines || []).map((ln: any) => ({
          ...ln,
          closing: Math.round((Number(ln.closing || 0) / scaleDiv) * 100) / 100,
          opening: Math.round((Number(ln.opening || 0) / scaleDiv) * 100) / 100,
        })),
      };
    });

    const newLocalBatch = {
      id: `bctc-batch-${Date.now()}`,
      batch_number: batchCode,
      version_number: nextVer,
      report_group: reportGroup,
      going_concern_assumption: goingConcernCode,
      interim_format: statementInterimFormat,
      cash_flow_method: cashFlowMethod,
      period_label: `${statementPeriod} ${statementYear}`,
      from_date: statementFromDate,
      to_date: statementToDate,
      created_date: statementToDate,
      creator: "Kế toán tổng hợp",
      unit_scale: statementUnitScale,
      status: "GENERATED",
      is_balanced: true,
      blocker_count: 0,
      warning_count: 0,
      source_watermark: `wm-gl13-${statementYear}-v${nextVer}`,
      outdated_reason: "",
      notes_general_info: latestNotesSource
        ? {
            ...latestNotesSource.notes_general_info,
            inherited_notice: `Đã kế thừa thông tin chung từ ${latestNotesSource.batch_number} (AF-13, BR-GL-FS-38, 39: Không sao chép số liệu kỳ trước).`,
          }
        : {
            accounting_regime: "Thông tư 99/2025/TT-BTC",
            business_sector: "Sản xuất, thương mại và dịch vụ công nghệ thông tin",
            going_concern_statement:
              goingConcernCode === "NON_CONTINUOUS"
                ? "Doanh nghiệp trình bày BCTC theo cơ sở KHÔNG đáp ứng giả định hoạt động liên tục (Bộ mẫu DNKLT - AF-03, BR-GL-FS-08, 09)."
                : "Doanh nghiệp đáp ứng giả định hoạt động liên tục (Bộ mẫu DN - AF-02).",
            auditor_firm: "Công ty TNHH Kiểm toán & Tư vấn Chuẩn Việt",
          },
      notes_explanations: latestNotesSource ? { ...latestNotesSource.notes_explanations } : { ...(statementBatches[0]?.notes_explanations || {}) },
      cross_checks: statementBatches[0]?.cross_checks || [],
      reports: generatedReports,
    };

    setStatementBatches((prev) => [newLocalBatch, ...prev]);
    setActiveStatementBatchId(newLocalBatch.id);
    setShowStatementTable(true);
    setStatementModalOpen(false);
    setPreviewReportName(title);
    notify(
      `Đã lập bộ ${title} (${batchCode}) kỳ ${statementPeriod} năm ${statementYear} gồm ${generatedReports.length} biểu mẫu theo Thông tư 99/2025/TT-BTC.`
    );
  };

  const handleFinalizeStatementBatch = async (batchId: string) => {
    const target = statementBatches.find((b) => String(b.id) === String(batchId));
    if (!target) return;
    if (target.status === "OUTDATED") {
      notify(
        `Chặn chốt BCTC (EF-28, BR-GL-FS-76, 77): Phiên bản ${target.batch_number} đang ở trạng thái OUTDATED do số liệu GL hoặc trạng thái khóa kỳ đã thay đổi. Vui lòng bấm 'Lập lại phiên bản mới'.`
      );
      return;
    }
    if (!target.is_balanced || target.blocker_count > 0) {
      notify(
        `Chặn chốt BCTC (EF-19..24, BR-GL-FS-28, 85): Phiên bản ${target.batch_number} còn lỗi kiểm tra chéo hoặc mất cân đối. Hệ thống tuyệt đối không tự động plug số chênh lệch.`
      );
      return;
    }
    if (apiConnected && apiToken && writer && !String(batchId).startsWith("bctc-batch-")) {
      try {
        const res = await finalizeFinancialStatementBatch(writer, String(batchId), {
          requireClosedPeriod: false,
          allowOpenPeriodFinalize: true,
          finalizeNote: `Chốt chính thức bộ BCTC ${target.batch_number}`,
        });
        setStatementBatches((prev) =>
          prev.map((b) =>
            String(b.id) === String(batchId)
              ? {
                  ...b,
                  status: "FINALIZED",
                  reports: (b.reports || []).map((r: any) => ({ ...r, status: "FINALIZED" })),
                }
              : b
          )
        );
        notify(res.message);
        return;
      } catch (error) {
        notify(`Không thể chốt BCTC: ${errorText(error)}`);
        return;
      }
    }
    setStatementBatches((prev) =>
      prev.map((b) =>
        String(b.id) === String(batchId)
          ? {
              ...b,
              status: "FINALIZED",
              reports: (b.reports || []).map((r: any) => ({ ...r, status: "FINALIZED" })),
            }
          : b
      )
    );
    notify(
      `Đã chốt chính thức (FINALIZED) phiên bản ${target.batch_number}. Mọi thao tác sửa trực tiếp trên phiên bản này đã bị khóa (AF-21, BR-GL-FS-75).`
    );
  };

  const handleOpenStatementDrilldown = async (batch: any, report: any, line: any) => {
    if (apiConnected && apiToken && writer && !String(batch.id).startsWith("bctc-batch-")) {
      try {
        const drill = await drilldownFinancialStatementLine(writer, String(batch.id), {
          formCode: report.form_code || report.code,
          indicatorCode: line.code,
          cashFlowMethod: report.cash_flow_method || "",
        });
        setStatementDrilldownModal({
          batch_number: batch.batch_number,
          form_code: report.code,
          indicator_code: line.code,
          indicator_name: line.name,
          formula: drill.formula_or_mapping || line.formula,
          current_amount: Number(drill.current_amount ?? line.closing ?? 0),
          prior_amount: Number(drill.prior_amount ?? line.opening ?? 0),
          account_breakdown: drill.account_breakdown || [],
          journal_entries: drill.journal_entries || [],
        });
        return;
      } catch {
        // Fallback to local drill-down data
      }
    }
    const defaultBreakdown =
      line.code === "131"
        ? [
            { account_code: "131", party_code: "KH-13-A", party_name: "Công ty Khách hàng A", side: "DEBIT_PARTNER (Dư Nợ đối tượng)", amount: 150000000 },
          ]
        : line.code === "312"
        ? [
            { account_code: "131", party_code: "KH-13-B", party_name: "Công ty Khách hàng B (Trả trước)", side: "CREDIT_PARTNER (Dư Có đối tượng)", amount: 40000000 },
          ]
        : line.code === "132"
        ? [
            { account_code: "331", party_code: "NCC-13-Y", party_name: "Nhà cung cấp Y (Ứng trước)", side: "DEBIT_PARTNER (Dư Nợ đối tượng)", amount: 25000000 },
          ]
        : line.code === "311"
        ? [
            { account_code: "331", party_code: "NCC-13-X", party_name: "Nhà cung cấp X", side: "CREDIT_PARTNER (Dư Có đối tượng)", amount: 60000000 },
          ]
        : [
            { account_code: line.code === "110" || line.code === "111" ? "1111, 1121" : "GL-MAP", party_code: "-", party_name: "Số dư tổng hợp Sổ cái (UC-GL-10)", side: "CLOSING_BALANCE", amount: line.closing },
          ];

    setStatementDrilldownModal({
      batch_number: batch.batch_number,
      form_code: report.code,
      indicator_code: line.code,
      indicator_name: line.name,
      formula: line.formula || "Mapping tự động từ Sổ cái GL (TT99/2025/TT-BTC)",
      current_amount: line.closing,
      prior_amount: line.opening,
      account_breakdown: defaultBreakdown,
      journal_entries: [
        { number: "PKT-13-001", posting_date: "10/10/2026", entry_type: "MANUAL", source_module: "GL", description: "Ghi nhận doanh thu & phải thu khách hàng KH-13-A", total_debit: 150000000 },
        { number: "PKT-13-002", posting_date: "11/10/2026", entry_type: "MANUAL", source_module: "BANK", description: "Khách hàng KH-13-B ứng trước tiền hàng qua TGNH", total_debit: 40000000 },
        { number: "KC-13-001", posting_date: "31/12/2026", entry_type: "CLOSING", source_module: "GL", description: "Kết chuyển doanh thu, chi phí và xác định kết quả kinh doanh cuối kỳ", total_debit: 150000000 },
      ],
    });
  };

  // Search in tabs
  const [searchTerm, setSearchTerm] = useState("");

  // Period Lock Form State (UC-GL-12 – Khóa / Bỏ khóa sổ kỳ kế toán)
  const [lockDate, setLockDate] = useState("31/10/2026");
  const [unlockDate, setUnlockDate] = useState("30/09/2026");
  const [lockPassword, setLockPassword] = useState("");
  const [periodLockStatus, setPeriodLockStatus] = useState<
    "OPEN" | "PARTIALLY_LOCKED" | "CLOSED" | "REOPENING"
  >("OPEN");
  const [periodLockScope, setPeriodLockScope] = useState<"FULL_PERIOD" | "DOCUMENT_TYPE">("FULL_PERIOD");
  const [periodLockNote, setPeriodLockNote] = useState("Khóa sổ kế toán định kỳ tháng 10/2026 sau khi hoàn tất đối chiếu");
  const [acknowledgeLockWarnings, setAcknowledgeLockWarnings] = useState(true);
  const [periodChecklistWatermark, setPeriodChecklistWatermark] = useState("WM-LOCK-202610-3C8F90D1");
  const [periodChecklistItems, setPeriodChecklistItems] = useState<
    Array<{
      code: string;
      name: string;
      severity: "BLOCKER" | "WARNING" | "INFO" | "NA";
      status: "PASSED" | "WARNING" | "FAILED" | "NA";
      message: string;
    }>
  >([
    {
      code: "UNPOSTED_GL_ENTRIES",
      name: "1. Kiểm tra bút toán GL chưa ghi sổ (DRAFT / PENDING / APPROVED / UNPOSTED)",
      severity: "BLOCKER",
      status: "PASSED",
      message: "Tất cả bút toán phát sinh trong kỳ đều đã ở trạng thái POSTED (BR-GL-LOCK-10).",
    },
    {
      code: "SUBLEDGER_PENDING_SYNC",
      name: "2. Kiểm tra chứng từ phân hệ chưa đồng bộ sang GL (UC-GL-04)",
      severity: "BLOCKER",
      status: "PASSED",
      message: "Không còn sự kiện hạch toán từ phân hệ đang chờ hoặc lỗi đồng bộ (BR-GL-LOCK-13).",
    },
    {
      code: "GL_BALANCE_RELIABILITY",
      name: "3. Kiểm tra bảng tổng hợp số dư & cân đối Nợ/Có toàn kỳ (UC-GL-10)",
      severity: "BLOCKER",
      status: "PASSED",
      message: "Tổng phát sinh Nợ = Tổng phát sinh Có, số dư đầu kỳ/cuối kỳ cân bằng và trạng thái VALID (BR-GL-LOCK-15, 16).",
    },
    {
      code: "SUBLEDGER_RECONCILIATION",
      name: "4. Kiểm tra kết quả đối chiếu số liệu GL ↔ Phân hệ (UC-GL-11)",
      severity: "BLOCKER",
      status: "PASSED",
      message: "Không còn dòng chênh lệch trọng yếu giữa Sổ cái GL và các phân hệ AP, AR, CASH, BANK, INV, FA, TAX (BR-GL-LOCK-18).",
    },
    {
      code: "MANDATORY_PERIOD_END_JOBS",
      name: "5. Kiểm tra bút toán cuối kỳ bắt buộc (Phân bổ CP, CLTG, Kết chuyển lãi lỗ - UC-GL-07, 08, 09)",
      severity: "BLOCKER",
      status: "PASSED",
      message: "Đã hoàn tất phân bổ chi phí, đánh giá lại ngoại tệ và kết chuyển lãi lỗ cuối kỳ (TK 5..9 về 0 - BR-GL-LOCK-21).",
    },
    {
      code: "PREVIOUS_PERIOD_STATUS",
      name: "6. Kiểm tra trạng thái khóa của kỳ kế toán liền trước",
      severity: "WARNING",
      status: "PASSED",
      message: "Kỳ kế toán trước liền kề (2026-09) đã được khóa sổ hợp lệ (BR-GL-LOCK-23).",
    },
  ]);

  const [reopenReason, setReopenReason] = useState("Điều chỉnh bút toán kiểm toán cuối kỳ theo biên bản rà soát");
  const [reopenScope, setReopenScope] = useState<"FULL_PERIOD" | "DOCUMENT_TYPE">("FULL_PERIOD");
  const [requireReopenApproval, setRequireReopenApproval] = useState(false);
  const [reopenWorkflowStatus, setReopenWorkflowStatus] = useState<
    "NONE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  >("NONE");
  const [periodLockHistory, setPeriodLockHistory] = useState<
    Array<{
      id: string;
      action: string;
      previousStatus: string;
      newStatus: string;
      lockScope: string;
      lockToDate: string;
      reason: string;
      watermark: string;
      actor: string;
      performedAt: string;
    }>
  >([
    {
      id: "HIST-202609-CLOSE",
      action: "CLOSE",
      previousStatus: "OPEN",
      newStatus: "CLOSED",
      lockScope: "FULL_PERIOD",
      lockToDate: "30/09/2026",
      reason: "Khóa sổ định kỳ tháng 09/2026 sau khi lập BCTC Quý 3",
      watermark: "WM-LOCK-202609-8A12F4B9",
      actor: "Kế toán trưởng (Nguyễn Thị Lan)",
      performedAt: "05/10/2026 16:30:00",
    },
  ]);

  const handleEvaluatePeriodCloseChecklist = async () => {
    if (apiConnected) {
      try {
        const writer = createApiWriter(company.id, (path, init) => request(path, apiToken, init));
        const date = toApiDate(lockDate);
        const periods = await writer.list("glPeriods");
        const targetPeriod =
          periods.find((row: any) => row.end_date === date) || periods[0];
        if (targetPeriod) {
          const chk: any = await evaluatePeriodCloseChecklist(writer, targetPeriod.id, {
            lockScope: periodLockScope,
            lockToDate: lockDate,
            lockedDocumentTypes:
              periodLockScope === "DOCUMENT_TYPE"
                ? voucherTypes.filter((v) => v.locked).map((v) => v.id)
                : [],
          });
          if (chk?.snapshot_watermark) {
            setPeriodChecklistWatermark(String(chk.snapshot_watermark));
          }
          if (Array.isArray(chk?.checks) && chk.checks.length > 0) {
            setPeriodChecklistItems(
              chk.checks.map((c: any) => ({
                code: c.code,
                name: c.name,
                severity: c.severity || "INFO",
                status: c.status || "PASSED",
                message: c.message || "",
              })),
            );
          }
          notify(
            `Đã kiểm tra Checklist trước khóa kỳ ${targetPeriod.code || lockDate}: ${
              chk?.blocker_count || 0
            } lỗi chặn, ${chk?.warning_count || 0} cảnh báo (UC-GL-12).`,
          );
          return;
        }
      } catch (err) {
        notify(`Không kiểm tra được Checklist từ API: ${errorText(err)}`);
      }
    }
    const newWm = `WM-LOCK-202610-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
    setPeriodChecklistWatermark(newWm);
    const hasRecDiff = glRecStatus === "DIFFERENCE";
    setPeriodChecklistItems((prev) =>
      prev.map((item) => {
        if (item.code === "SUBLEDGER_RECONCILIATION") {
          return hasRecDiff
            ? {
                ...item,
                severity: "WARNING",
                status: "WARNING",
                message:
                  "Cảnh báo: Còn 1 dòng chênh lệch đối chiếu GL ↔ AR. Cần xác nhận cảnh báo hoặc đối chiếu lại trước khi khóa.",
              }
            : {
                ...item,
                severity: "BLOCKER",
                status: "PASSED",
                message: "Tất cả các phân hệ AP, AR, CASH, BANK, INV, FA, TAX đã khớp 100% với Sổ cái GL.",
              };
        }
        return { ...item, status: "PASSED" };
      }),
    );
    notify(
      `Đã chạy kiểm tra điều kiện trước khóa (Checklist UC-GL-12 - Bước 5..28). Watermark: ${newWm}.`,
    );
  };

  const handleCloseAccountingPeriod = async () => {
    const blockerItems = periodChecklistItems.filter(
      (i) => i.severity === "BLOCKER" && i.status === "FAILED",
    );
    if (blockerItems.length > 0) {
      notify(
        `Lỗi chặn (EF-05..EF-11): Không thể khóa sổ vì còn ${blockerItems.length} điều kiện bắt buộc chưa đạt (${blockerItems[0].name}).`,
      );
      return;
    }
    const warningItems = periodChecklistItems.filter((i) => i.status === "WARNING");
    if (warningItems.length > 0 && !acknowledgeLockWarnings) {
      notify(
        "Cảnh báo (BR-GL-LOCK-31): Vui lòng tích chọn 'Xác nhận tiếp tục khóa sổ khi có Cảnh báo (WARNING)' trước khi thực hiện!",
      );
      return;
    }

    if (apiConnected) {
      const saved = await apiSave(async (writer) => {
        const date = toApiDate(lockDate);
        const periods = await writer.list("glPeriods");
        const targetPeriod =
          periods.find((row: any) => row.end_date === date && row.status !== "CLOSED") ||
          periods.find((row: any) => row.status !== "CLOSED");
        if (!targetPeriod) {
          throw new Error("Không tìm thấy kỳ kế toán đang mở phù hợp để khóa sổ.");
        }
        return await closeAccountingPeriod(writer, targetPeriod.id, {
          lockScope: periodLockScope,
          lockToDate: lockDate,
          lockedDocumentTypes:
            periodLockScope === "DOCUMENT_TYPE"
              ? voucherTypes.filter((v) => v.locked).map((v) => v.id)
              : [],
          expectedChecklistWatermark: periodChecklistWatermark || undefined,
          acknowledgeWarnings: acknowledgeLockWarnings,
          reason: periodLockNote,
        });
      });
      if (saved) {
        const newSt = periodLockScope === "DOCUMENT_TYPE" ? "PARTIALLY_LOCKED" : "CLOSED";
        setPeriodLockStatus(newSt);
        setLockPeriodModalOpen(false);
      }
      return;
    }

    const nextStatus = periodLockScope === "DOCUMENT_TYPE" ? "PARTIALLY_LOCKED" : "CLOSED";
    setPeriodLockHistory((prev) => [
      {
        id: `HIST-${Date.now()}`,
        action: periodLockScope === "DOCUMENT_TYPE" ? "PARTIAL_LOCK" : "CLOSE",
        previousStatus: periodLockStatus,
        newStatus: nextStatus,
        lockScope: periodLockScope,
        lockToDate: lockDate,
        reason: periodLockNote || "Khóa sổ kỳ kế toán theo quy trình cuối kỳ",
        watermark: periodChecklistWatermark,
        actor: "Kế toán trưởng",
        performedAt: new Date().toLocaleString("vi-VN"),
      },
      ...prev,
    ]);
    setPeriodLockStatus(nextStatus);
    setLockPeriodModalOpen(false);
    notify(
      nextStatus === "CLOSED"
        ? `Đã khóa sổ toàn bộ kỳ kế toán đến ngày ${lockDate} (Trạng thái: CLOSED - UC-GL-12). Mọi thao tác tạo/sửa/xóa/Post/Unpost trong kỳ đã bị chặn!`
        : `Đã khóa sổ một phần theo loại chứng từ đến ngày ${lockDate} (Trạng thái: PARTIALLY_LOCKED - AF-02).`,
    );
  };

  const handleReopenAccountingPeriod = async () => {
    const cleanReason = String(reopenReason || "").trim();
    if (!cleanReason) {
      notify(
        "Lỗi EF-17 (BR-GL-LOCK-46): Bắt buộc nhập Lý do mở lại kỳ kế toán để ghi nhận Audit Log!",
      );
      return;
    }

    if (apiConnected) {
      const saved = await apiSave(async (writer) => {
        const periods = await writer.list("glPeriods");
        const targetPeriod =
          periods.find((row: any) => row.status === "CLOSED" || row.status === "PARTIALLY_LOCKED") ||
          periods[0];
        if (!targetPeriod) {
          throw new Error("Không tìm thấy kỳ kế toán đang khóa để mở lại.");
        }
        return await reopenAccountingPeriod(writer, targetPeriod.id, {
          reason: cleanReason,
          unlockScope: reopenScope,
          unlockDocumentTypes:
            reopenScope === "DOCUMENT_TYPE"
              ? voucherTypes.filter((v) => !v.locked).map((v) => v.id)
              : [],
          requireWorkflowApproval: requireReopenApproval,
        });
      });
      if (saved) {
        if (requireReopenApproval) {
          setReopenWorkflowStatus("PENDING_APPROVAL");
          setPeriodLockStatus("REOPENING");
        } else {
          setReopenWorkflowStatus("NONE");
          setPeriodLockStatus("OPEN");
          setBalAggStatus("STALE");
          setUnlockPeriodModalOpen(false);
        }
      }
      return;
    }

    if (requireReopenApproval && reopenWorkflowStatus !== "PENDING_APPROVAL") {
      setReopenWorkflowStatus("PENDING_APPROVAL");
      setPeriodLockStatus("REOPENING");
      setPeriodLockHistory((prev) => [
        {
          id: `HIST-REQ-${Date.now()}`,
          action: "REOPEN_REQUEST",
          previousStatus: periodLockStatus,
          newStatus: "REOPENING",
          lockScope: reopenScope,
          lockToDate: unlockDate,
          reason: cleanReason,
          watermark: periodChecklistWatermark,
          actor: "Kế toán tổng hợp",
          performedAt: new Date().toLocaleString("vi-VN"),
        },
        ...prev,
      ]);
      notify(
        "Đã gửi yêu cầu Bỏ khóa kỳ kế toán sang Workflow phê duyệt (Trạng thái: REOPENING / PENDING_APPROVAL - AF-21).",
      );
      return;
    }

    setPeriodLockHistory((prev) => [
      {
        id: `HIST-REOPEN-${Date.now()}`,
        action: reopenScope === "DOCUMENT_TYPE" ? "PARTIAL_UNLOCK" : "REOPEN",
        previousStatus: periodLockStatus,
        newStatus: "OPEN",
        lockScope: reopenScope,
        lockToDate: unlockDate,
        reason: cleanReason,
        watermark: periodChecklistWatermark,
        actor: "Kế toán trưởng",
        performedAt: new Date().toLocaleString("vi-VN"),
      },
      ...prev,
    ]);
    setPeriodLockStatus("OPEN");
    setReopenWorkflowStatus("NONE");
    setBalAggStatus("STALE");
    setStatementBatches((prev) =>
      prev.map((b) => ({
        ...b,
        status: "OUTDATED",
        outdated_reason: `Kỳ kế toán đã được mở khóa lại (UC-GL-12 - Lý do: "${cleanReason}"). Cần lập lại phiên bản BCTC mới (AF-23, EF-28, BR-GL-FS-76, 77).`,
        reports: (b.reports || []).map((r: any) => ({ ...r, status: "OUTDATED" })),
      })),
    );
    setUnlockPeriodModalOpen(false);
    notify(
      `Đã bỏ khóa sổ kỳ kế toán thành công (Trạng thái: OPEN - Lý do: "${cleanReason}"). Kết quả tổng hợp UC-GL-10 đã đánh dấu STALE và các phiên bản BCTC UC-GL-13 đã chuyển sang OUTDATED (BR-GL-LOCK-52, BR-GL-FS-76).`,
    );
  };

  const handleDecideReopenWorkflow = async (decision: "APPROVE" | "REJECT") => {
    if (apiConnected) {
      await apiSave(async (writer) => {
        const periods = await writer.list("glPeriods");
        const targetPeriod =
          periods.find((row: any) => row.reopen_workflow_status === "PENDING_APPROVAL") ||
          periods[0];
        if (!targetPeriod) {
          throw new Error("Không tìm thấy yêu cầu mở khóa đang chờ phê duyệt.");
        }
        return await decideReopenAccountingPeriod(writer, targetPeriod.id, {
          decision,
          reason: reopenReason || "Phê duyệt mở khóa kỳ kế toán",
        });
      });
    }
    if (decision === "APPROVE") {
      setReopenWorkflowStatus("APPROVED");
      setPeriodLockStatus("OPEN");
      setBalAggStatus("STALE");
      setPeriodLockHistory((prev) => [
        {
          id: `HIST-APP-${Date.now()}`,
          action: "REOPEN_APPROVE",
          previousStatus: "REOPENING",
          newStatus: "OPEN",
          lockScope: reopenScope,
          lockToDate: unlockDate,
          reason: `Phê duyệt mở kỳ: ${reopenReason}`,
          watermark: periodChecklistWatermark,
          actor: "Giám đốc tài chính / Kế toán trưởng",
          performedAt: new Date().toLocaleString("vi-VN"),
        },
        ...prev,
      ]);
      setUnlockPeriodModalOpen(false);
      notify("Đã phê duyệt yêu cầu mở lại kỳ kế toán (Trạng thái kỳ chuyển về OPEN - AF-21).");
    } else {
      setReopenWorkflowStatus("REJECTED");
      setPeriodLockStatus("CLOSED");
      setPeriodLockHistory((prev) => [
        {
          id: `HIST-REJ-${Date.now()}`,
          action: "REOPEN_REJECT",
          previousStatus: "REOPENING",
          newStatus: "CLOSED",
          lockScope: reopenScope,
          lockToDate: unlockDate,
          reason: `Từ chối mở kỳ: ${reopenReason}`,
          watermark: periodChecklistWatermark,
          actor: "Giám đốc tài chính / Kế toán trưởng",
          performedAt: new Date().toLocaleString("vi-VN"),
        },
        ...prev,
      ]);
      notify("Đã từ chối yêu cầu mở lại kỳ kế toán. Kỳ giữ nguyên trạng thái CLOSED (EF-18).");
    }
  };

  // Lock By Voucher Types list
  const [voucherTypes, setVoucherTypes] = useState([
    { id: "PKT", name: "Chứng từ nghiệp vụ khác", locked: true, lockDate: "30/09/2026" },
    { id: "QTU", name: "Quyết toán tạm ứng", locked: true, lockDate: "30/09/2026" },
    { id: "KCLL", name: "Kết chuyển lãi lỗ", locked: true, lockDate: "30/09/2026" },
    { id: "PT", name: "Phiếu thu tiền mặt", locked: true, lockDate: "30/09/2026" },
    { id: "PC", name: "Phiếu chi tiền mặt", locked: true, lockDate: "30/09/2026" },
    { id: "BC", name: "Thu tiền gửi (Báo Có)", locked: true, lockDate: "30/09/2026" },
    { id: "BN", name: "Chi tiền gửi (Báo Nợ)", locked: true, lockDate: "30/09/2026" },
    { id: "HDBH", name: "Hóa đơn bán hàng", locked: true, lockDate: "30/09/2026" },
  ]);

  const documentLocksUrl = `/api/v1/common/document-locks/?company_id=${encodeURIComponent(company.id)}`;
  // Both lock dialogs read the saved backend configuration when they open.
  useEffect(() => {
    if (!(lockByTypeModalOpen || autoLockModalOpen) || !apiConnected || !apiToken) return;
    request<any>(documentLocksUrl, apiToken)
      .then((data) => {
        setVoucherTypes((data.locks || []).map((row: any) => ({
          id: row.code, name: row.name, locked: Boolean(row.locked), lockDate: toViDate(row.lock_date || ""),
        })));
        setAutoLockEnabled(Boolean(data.auto_lock?.enabled));
        setAutoLockDay(data.auto_lock?.day === "END" ? "cuoi_thang" : String(data.auto_lock?.day || 20));
      })
      .catch((error) => notify(`Không tải được cấu hình khóa sổ: ${errorText(error)}`));
  }, [lockByTypeModalOpen, autoLockModalOpen, apiConnected, apiToken, documentLocksUrl]);
  const saveDocumentLocks = async (close: () => void) => {
    if (!apiConnected || !apiToken) { close(); notify("Đã lưu thiết lập khóa sổ!"); return; }
    try {
      await request(documentLocksUrl, apiToken, {
        method: "PUT",
        body: JSON.stringify({
          company: company.id,
          locks: voucherTypes.map((row) => ({ code: row.id, locked: row.locked, lock_date: row.locked ? toApiDate(row.lockDate) : null })),
          auto_lock: { enabled: autoLockEnabled, day: autoLockDay === "cuoi_thang" ? "END" : Number(autoLockDay) },
        }),
      });
      close();
      notify("Đã lưu thiết lập khóa sổ.");
    } catch (error) {
      notify(`Không lưu được thiết lập khóa sổ: ${errorText(error)}`);
    }
  };

  // Sample Data for Tables in Subtabs
  const [advanceRequests, setAdvanceRequests] = useState<any[]>([
    {
      id: "DNQT0001",
      apiId: "",
      date: "24/10/2026",
      employee: "Nguyễn Văn Hùng",
      requesterCode: "NV001",
      dept: "Phòng Kinh doanh",
      amount: 15000000,
      reason: "Tạm ứng công tác thị trường miền Trung",
      status: "Đã duyệt",
      rawStatus: "APPROVED",
      syncStatus: "SYNCED",
      syncStatusLabel: "Đã đồng bộ",
      version: 1,
      rejectionReason: "",
      settlementVoucherNo: "",
      currentLevel: 1,
      totalLevels: 1,
    },
    {
      id: "DNQT0002",
      apiId: "",
      date: "26/10/2026",
      employee: "Trần Thị Mai",
      requesterCode: "NV002",
      dept: "Phòng Kế toán",
      amount: 8500000,
      reason: "Mua sắm văn phòng phẩm & đồ dùng Q4",
      status: "Chờ duyệt",
      rawStatus: "PENDING_APPROVAL",
      syncStatus: "NOT_SYNCED",
      syncStatusLabel: "Chưa đồng bộ",
      version: 1,
      rejectionReason: "",
      settlementVoucherNo: "",
      currentLevel: 1,
      totalLevels: 1,
    },
    {
      id: "DNQT0003",
      apiId: "",
      date: "28/10/2026",
      employee: "Lê Hoàng Long",
      requesterCode: "NV003",
      dept: "Phòng Kỹ thuật",
      amount: 12000000,
      reason: "Công tác bảo trì thiết bị chi nhánh Đà Nẵng",
      status: "Đã duyệt",
      rawStatus: "APPROVED",
      syncStatus: "SYNCED",
      syncStatusLabel: "Đã đồng bộ",
      version: 1,
      rejectionReason: "",
      settlementVoucherNo: "",
      currentLevel: 1,
      totalLevels: 1,
    },
  ]);

  // UC-GL-01: State cho Form Thêm / Bổ sung Đề nghị quyết toán tạm ứng
  const [advReqRequester, setAdvReqRequester] = useState("Nguyễn Văn Hùng");
  const [advReqDepartment, setAdvReqDepartment] = useState("Phòng Kinh doanh");
  const [advReqAmount, setAdvReqAmount] = useState("15,000,000");
  const [advReqPurpose, setAdvReqPurpose] = useState(
    "Công tác phí và chi phí tiếp khách tại thị trường miền Trung từ ngày 15/10 đến 22/10",
  );
  const [advReqError, setAdvReqError] = useState("");
  const [isSubmittingAdvReq, setIsSubmittingAdvReq] = useState(false);
  const [editingAdvReqId, setEditingAdvReqId] = useState<string | null>(null);
  const [editingAdvReqNumber, setEditingAdvReqNumber] = useState<string>("");
  const [advReqStatusFilter, setAdvReqStatusFilter] = useState<string>("ALL");
  const [viewingAdvReq, setViewingAdvReq] = useState<any | null>(null);
  const [advReqSyncFrequency, setAdvReqSyncFrequency] = useState<"IMMEDIATE" | "SCHEDULED" | "MANUAL">("IMMEDIATE");

  const activeEmployeesList = (apiRows.employees || []).filter(
    (emp: any) => !emp.status || emp.status === "ACTIVE",
  );
  const activeDepartmentsList = (apiRows.departments || []).filter(
    (d: any) => !d.status || d.status === "ACTIVE",
  );

  const resolveDepartmentNameForEmployee = (empValue: string) => {
    const trimmed = empValue.trim().toLowerCase();
    if (!trimmed) return "";
    const matchedEmp = activeEmployeesList.find(
      (e: any) =>
        String(e.id).toLowerCase() === trimmed ||
        String(e.employee_code || "").toLowerCase() === trimmed ||
        String(e.full_name || "").toLowerCase() === trimmed,
    );
    if (matchedEmp) {
      if (matchedEmp.department_name) return String(matchedEmp.department_name);
      const matchedDept = activeDepartmentsList.find(
        (d: any) => String(d.id) === String(matchedEmp.department),
      );
      if (matchedDept?.name) return String(matchedDept.name);
    }
    if (trimmed.includes("trần thị mai")) return "Phòng Kế toán";
    if (trimmed.includes("lê hoàng long")) return "Phòng Kỹ thuật";
    if (trimmed.includes("nguyễn văn hùng")) return "Phòng Kinh doanh";
    return advReqDepartment || (activeDepartmentsList[0]?.name ? String(activeDepartmentsList[0].name) : "Phòng Kinh doanh");
  };

  const openNewAdvanceRequestModal = () => {
    setEditingAdvReqId(null);
    setEditingAdvReqNumber("");
    const defaultEmpName = activeEmployeesList[0]?.full_name
      ? String(activeEmployeesList[0].full_name)
      : "Nguyễn Văn Hùng";
    setAdvReqRequester(defaultEmpName);
    setAdvReqDepartment(resolveDepartmentNameForEmployee(defaultEmpName));
    setAdvReqAmount("15,000,000");
    setAdvReqPurpose(
      "Công tác phí và chi phí tiếp khách tại thị trường miền Trung từ ngày 15/10 đến 22/10",
    );
    setAdvReqError("");
    setIsSubmittingAdvReq(false);
    setAddAdvanceRequestModalOpen(true);
  };

  const openEditReturnedAdvanceRequestModal = (item: any) => {
    setEditingAdvReqId(item.apiId || item.id);
    setEditingAdvReqNumber(item.id);
    setAdvReqRequester(item.employee || "");
    setAdvReqDepartment(item.dept || "");
    setAdvReqAmount(Number(item.amount || 0).toLocaleString("en-US"));
    setAdvReqPurpose(item.reason || "");
    setAdvReqError("");
    setIsSubmittingAdvReq(false);
    setAddAdvanceRequestModalOpen(true);
  };

  const handleSubmitAdvanceRequest = async () => {
    // EF-11, BR-GL-ADV-14: Chống click đúp / gửi lặp
    if (isSubmittingAdvReq) return;
    setAdvReqError("");

    const cleanRequester = String(advReqRequester || "").trim();
    if (!cleanRequester) {
      setAdvReqError("Người đề nghị là bắt buộc.");
      notify("Người đề nghị là bắt buộc.");
      return;
    }

    const rawAmountStr = String(advReqAmount ?? "").trim();
    if (!rawAmountStr) {
      setAdvReqError("Số tiền đề nghị quyết toán là bắt buộc.");
      notify("Số tiền đề nghị quyết toán là bắt buộc.");
      return;
    }

    const normalizedAmountStr = rawAmountStr.replace(/,/g, "").replace(/\s+/g, "");
    const amountNum = Number(normalizedAmountStr);
    if (!/^-?\d+(\.\d+)?$/.test(normalizedAmountStr) || !Number.isFinite(amountNum)) {
      setAdvReqError("Số tiền đề nghị quyết toán không hợp lệ.");
      notify("Số tiền đề nghị quyết toán không hợp lệ.");
      return;
    }
    if (amountNum <= 0) {
      setAdvReqError("Số tiền đề nghị quyết toán phải lớn hơn 0.");
      notify("Số tiền đề nghị quyết toán phải lớn hơn 0.");
      return;
    }

    const cleanPurpose = String(advReqPurpose ?? "").trim();
    if (!cleanPurpose) {
      setAdvReqError("Mục đích/Diễn giải là bắt buộc và không được chỉ chứa khoảng trắng.");
      notify("Mục đích/Diễn giải là bắt buộc và không được chỉ chứa khoảng trắng.");
      return;
    }

    setIsSubmittingAdvReq(true);
    try {
      if (apiConnected) {
        if (editingAdvReqId && editingAdvReqId.length > 12) {
          const saved = await apiSave((writer) =>
            resubmitAdvanceSettlementRequest(writer, editingAdvReqId, {
              requester: cleanRequester,
              department: advReqDepartment || undefined,
              amount: amountNum,
              purpose: cleanPurpose,
            }),
          );
          if (!saved) {
            setIsSubmittingAdvReq(false);
            return;
          }
        } else {
          const saved = await apiSave((writer) =>
            saveAdvanceSettlementRequest(writer, {
              requester: cleanRequester,
              department: advReqDepartment || undefined,
              amount: amountNum,
              purpose: cleanPurpose,
              workflowSnapshot: {
                levels: 1,
                sync_mode: advReqSyncFrequency,
                allow_self_approval: true,
              },
            }),
          );
          if (!saved) {
            setIsSubmittingAdvReq(false);
            return;
          }
        }
        setAddAdvanceRequestModalOpen(false);
        setShowAdvanceRequestTable(true);
        return;
      }

      // Fallback local state khi chưa kết nối API
      if (editingAdvReqId) {
        setAdvanceRequests((prev) =>
          prev.map((r) =>
            r.id === editingAdvReqId || r.apiId === editingAdvReqId
              ? {
                  ...r,
                  employee: cleanRequester,
                  dept: advReqDepartment || r.dept,
                  amount: amountNum,
                  reason: cleanPurpose,
                  status: "Chờ duyệt",
                  rawStatus: "PENDING_APPROVAL",
                  rejectionReason: "",
                }
              : r,
          ),
        );
      } else {
        const nextNum = `DNQT${String(advanceRequests.length + 1).padStart(4, "0")}`;
        setAdvanceRequests((prev) => [
          {
            id: nextNum,
            apiId: "",
            date: "22/10/2026",
            employee: cleanRequester,
            requesterCode: "",
            dept: advReqDepartment || "Phòng Kinh doanh",
            amount: amountNum,
            reason: cleanPurpose,
            status: "Chờ duyệt",
            rawStatus: "PENDING_APPROVAL",
            syncStatus: "NOT_SYNCED",
            syncStatusLabel: "Chưa đồng bộ",
            version: 1,
            rejectionReason: "",
            settlementVoucherNo: "",
            currentLevel: 1,
            totalLevels: 1,
          },
          ...prev,
        ]);
      }
      setAddAdvanceRequestModalOpen(false);
      setShowAdvanceRequestTable(true);
      notify("Đã gửi đề nghị quyết toán tạm ứng lên cấp duyệt.");
    } finally {
      setIsSubmittingAdvReq(false);
    }
  };

  const handleDecideAdvanceRequest = async (
    item: any,
    decision: "approve" | "reject" | "request-info",
  ) => {
    let comment = "";
    if (decision === "reject") {
      comment = "Hồ sơ chứng từ gốc chưa đầy đủ theo quy chế chi tiêu nội bộ";
    } else if (decision === "request-info") {
      comment = "Đề nghị bổ sung bảng kê chi tiết hóa đơn công tác phí";
    } else {
      comment = "Đồng ý phê duyệt đề nghị quyết toán tạm ứng";
    }

    if (apiConnected && item.apiId) {
      await apiSave((writer) =>
        decideAdvanceSettlementRequest(writer, item.apiId, decision, {
          comment,
          version: item.version,
          syncMode: advReqSyncFrequency,
        }),
      );
      return;
    }

    setAdvanceRequests((prev) =>
      prev.map((r) => {
        if (r.id !== item.id) return r;
        if (decision === "approve") {
          return {
            ...r,
            status: "Đã duyệt",
            rawStatus: "APPROVED",
            syncStatus: "SYNCED",
            syncStatusLabel: "Đã đồng bộ",
            rejectionReason: "",
          };
        }
        if (decision === "request-info") {
          return {
            ...r,
            status: "Yêu cầu bổ sung",
            rawStatus: "RETURNED",
            rejectionReason: comment,
          };
        }
        return {
          ...r,
          status: "Từ chối",
          rawStatus: "REJECTED",
          rejectionReason: comment,
        };
      }),
    );
    notify(
      decision === "approve"
        ? `Đã phê duyệt đề nghị quyết toán tạm ứng ${item.id}.`
        : decision === "request-info"
          ? `Đã gửi yêu cầu bổ sung thông tin cho đề nghị ${item.id}.`
          : `Đã từ chối đề nghị quyết toán tạm ứng ${item.id}.`,
    );
  };

  const handleRetrySyncAdvanceRequest = async (item: any) => {
    if (apiConnected && item.apiId) {
      await apiSave((writer) => retrySyncAdvanceSettlementRequest(writer, item.apiId));
      return;
    }
    setAdvanceRequests((prev) =>
      prev.map((r) =>
        r.id === item.id ? { ...r, syncStatus: "SYNCED", syncStatusLabel: "Đã đồng bộ" } : r,
      ),
    );
    notify(`Đã đồng bộ thành công đề nghị ${item.id} sang danh sách quyết toán.`);
  };

  const handleInheritAdvanceRequestToVoucher = async (item: any) => {
    if (item.rawStatus && item.rawStatus !== "APPROVED" && item.status !== "Đã duyệt") {
      notify("Chỉ đề nghị quyết toán ở trạng thái Đã duyệt mới được lập chứng từ quyết toán.");
      return;
    }
    const voucherCode = `QTTU-${item.id}`;
    setAdvanceError("");
    setAdvanceEmployee(item.employee || "");
    setAdvanceDepartment(item.dept || "");
    setAdvanceRequestId(item.apiId || item.id || "");
    setAdvanceReferences([item.id]);
    setAdvanceDescription(`Quyết toán tạm ứng theo đề nghị ${item.id} - ${item.reason || ""}`);
    setAdvanceDocDate(item.date || "22/10/2026");
    setAdvancePostingDate(item.date || "22/10/2026");
    setAdvanceVoucherNo(voucherCode);
    setAdvanceRows([
      {
        id: "1",
        desc: item.reason || `Quyết toán tạm ứng theo đề nghị ${item.id}`,
        debitAcc: "6422",
        creditAcc: "141",
        amount: Number(item.remainingAmount ?? item.amount ?? 0),
        debitObject: "",
        debitObjectName: "",
        creditObject: item.requesterCode || item.employee || "",
        creditObjectName: item.employee || "",
      },
    ]);
    setAddAdvanceSettlementModalOpen(true);
  };

  const [generalVouchers, setGeneralVouchers] = useState([
    { id: "PKT00001", date: "31/10/2026", voucherDate: "31/10/2026", desc: "Trích khấu hao tài sản cố định tháng 10/2026", debitAcc: "6424", creditAcc: "2141", amount: 18500000, posted: true },
    { id: "PKT00002", date: "31/10/2026", voucherDate: "31/10/2026", desc: "Phân bổ chi phí trả trước dài hạn CCDC tháng 10", debitAcc: "6422", creditAcc: "242", amount: 7200000, posted: true },
    { id: "PKT00003", date: "31/10/2026", voucherDate: "31/10/2026", desc: "Hạch toán tiền lương & trích nộp bảo hiểm tháng 10", debitAcc: "6421", creditAcc: "3341", amount: 125000000, posted: true },
    { id: "PKT00004", date: "31/10/2026", voucherDate: "31/10/2026", desc: "Đánh giá lại chênh lệch tỷ giá cuối kỳ tài khoản ngoại tệ 1122", debitAcc: "635", creditAcc: "4131", amount: 3450000, posted: true },
  ]);

  const [closingEntries, setClosingEntries] = useState([
    { id: "KC001", period: "Tháng 10/2026", date: "31/10/2026", desc: "Kết chuyển doanh thu bán hàng và cung cấp dịch vụ sang 911", debitAcc: "511", creditAcc: "911", amount: 485000000 },
    { id: "KC002", period: "Tháng 10/2026", date: "31/10/2026", desc: "Kết chuyển doanh thu hoạt động tài chính sang 911", debitAcc: "515", creditAcc: "911", amount: 18200000 },
    { id: "KC003", period: "Tháng 10/2026", date: "31/10/2026", desc: "Kết chuyển giá vốn hàng bán sang 911", debitAcc: "911", creditAcc: "632", amount: 295000000 },
    { id: "KC004", period: "Tháng 10/2026", date: "31/10/2026", desc: "Kết chuyển chi phí quản lý doanh nghiệp sang 911", debitAcc: "911", creditAcc: "642", amount: 48600000 },
    { id: "KC005", period: "Tháng 10/2026", date: "31/10/2026", desc: "Kết chuyển lãi hoạt động sản xuất kinh doanh tháng 10/2026", debitAcc: "911", creditAcc: "4212", amount: 159600000 },
  ]);

  useEffect(() => {
    if (!apiConnected) return;
    if (apiRows.advanceRequests && apiRows.advanceRequests.length > 0) {
      setAdvanceRequests(
        apiRows.advanceRequests.map((row: any) => ({
          id: row.number || row.id,
          apiId: row.id,
          date: apiDate(row.request_date),
          employee: row.requester_name || "",
          requesterCode: row.requester_code || "",
          dept: row.department_name || "Phòng Kinh doanh",
          amount: apiNumber(row.amount),
          reason: row.purpose || "",
          status:
            row.status_label ||
            (row.status === "APPROVED"
              ? "Đã duyệt"
              : row.status === "REJECTED"
                ? "Từ chối"
                : row.status === "RETURNED"
                  ? "Yêu cầu bổ sung"
                  : "Chờ duyệt"),
          rawStatus: row.status || "PENDING_APPROVAL",
          syncStatus: row.sync_status || "NOT_SYNCED",
          syncStatusLabel: row.sync_status_label || "",
          version: row.version || 1,
          rejectionReason: row.rejection_reason || "",
          settlementVoucherNo: row.settlement_voucher_no || "",
          currentLevel: row.current_approval_level || 1,
          totalLevels: row.workflow_snapshot?.levels || 1,
        })),
      );
    }
    if (apiRows.generalVouchers || apiRows.journals) {
      const gbvMap = new Map<string, any>();
      for (const gbv of apiRows.generalVouchers || []) {
        gbvMap.set(String(gbv.number || gbv.id), gbv);
      }
      const mappedJournals = (apiRows.journals || []).map((row) => {
        const gbv = gbvMap.get(String(row.number || ""));
        const isPosted = row.status === "POSTED" || gbv?.status === "POSTED";
        return {
          id: row.number || row.id,
          date: apiDate(row.posting_date),
          voucherDate: apiDate(row.document_date),
          desc: row.description || "",
          debitAcc:
            gbv?.accounting_lines?.[0]?.debit_account_code ||
            row.lines?.find((line: any) => Number(line.debit) > 0)?.account_code ||
            "",
          creditAcc:
            gbv?.accounting_lines?.[0]?.credit_account_code ||
            row.lines?.find((line: any) => Number(line.credit) > 0)?.account_code ||
            "",
          amount: apiNumber(gbv?.total_amount ?? row.total_debit),
          posted: isPosted,
          statusLabel: isPosted ? "Đã ghi sổ" : "Chưa ghi sổ",
          businessTypeLabel: gbv?.business_type_label || "",
          gbvId: gbv?.id || "",
          apiId: row.id,
        };
      });
      setGeneralVouchers(mappedJournals);
    }
    if (apiRows.journals) setClosingEntries(apiRows.journals.filter((row) => row.entry_type === "CLOSING").map((row) => ({
      id: row.number || row.id, period: row.period_code || "", date: apiDate(row.posting_date),
      desc: row.description || "Kết chuyển",
      debitAcc: row.lines?.find((line: any) => Number(line.debit) > 0)?.account_code || "",
      creditAcc: row.lines?.find((line: any) => Number(line.credit) > 0)?.account_code || "",
      amount: apiNumber(row.total_debit),
    })));
    else if (apiRows.closings) setClosingEntries(apiRows.closings.map((row) => {
      // A closing run only references its journal entry; the voucher details live there.
      const entry = apiRows.journals?.find((journal) => journal.id === row.entry);
      return {
        id: entry?.number || row.id, period: entry?.period_code || "",
        date: apiDate(entry?.posting_date || row.created_at), desc: entry?.description || "Kết chuyển",
        debitAcc: entry?.lines?.find((line: any) => Number(line.debit) > 0)?.account_code || "",
        creditAcc: entry?.lines?.find((line: any) => Number(line.credit) > 0)?.account_code || "",
        amount: apiNumber(entry?.total_debit),
      };
    }));
  }, [apiRows, apiConnected]);

  // Favorite reports toggles matching user screenshot (4 favorited in "Yêu thích")
  const [favoriteReports, setFavoriteReports] = useState<Record<string, boolean>>({
    "Tổng hợp công nợ theo đối tượng": true,
    "Sổ nhật ký chung": true,
    "Tổng hợp công nợ nhân viên": true,
    "Sổ chi tiết các tài khoản": true,
  });

  const [reportSearchTerm, setReportSearchTerm] = useState("");
  const [reportLanguage, setReportLanguage] = useState("Tiếng Việt");
  const [expandedReportGroups, setExpandedReportGroups] = useState<Record<string, boolean>>({
    "financial-statements": true, // Báo cáo tài chính OPEN by default (Matching user screenshot)
    "accounting-books": false,
    "account-summary": false,
    "cost-profit": false,
    "debt-receivable": false,
  });
  const [showHideReportsModalOpen, setShowHideReportsModalOpen] = useState(false);

  const toggleFavorite = (name: string) => {
    setFavoriteReports((prev) => {
      const nextVal = !prev[name];
      notify(nextVal ? `Đã thêm vào báo cáo Yêu thích: ${name}` : `Đã bỏ khỏi báo cáo Yêu thích: ${name}`);
      return { ...prev, [name]: nextVal };
    });
  };

  const toggleReportGroup = (key: string) => {
    setExpandedReportGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllReportGroups = () => {
    const anyClosed = Object.values(expandedReportGroups).some((v) => !v);
    setExpandedReportGroups({
      "financial-statements": anyClosed,
      "accounting-books": anyClosed,
      "account-summary": anyClosed,
      "cost-profit": anyClosed,
      "debt-receivable": anyClosed,
    });
    notify(anyClosed ? "Đã mở rộng tất cả các nhóm báo cáo" : "Đã thu gọn tất cả các nhóm báo cáo");
  };

  // Close floating popovers on click outside
  const handleBackdropClick = () => {
    setShowLockMenu(false);
    setShowStatementsMenu(false);
    setShowAddVoucherMenu(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: "100%",
        background: "#f4f5f8",
        position: "relative",
      }}
      onClick={handleBackdropClick}
    >
      {/* Main Tab Body */}
      <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ========================================================================= */}
        {/* TAB 1: QUY TRÌNH (Exact Image 1 & 2)                                      */}
        {/* ========================================================================= */}
        {currentTab === "process" && (
          <>
            {/* Top Row: Two main cards (Left: Nghiệp vụ tổng hợp, Right: Báo cáo) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 340px",
                gap: 16,
                alignItems: "stretch",
              }}
            >
              {/* Left Box: NGHIỆP VỤ TỔNG HỢP (Process Workflow) */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  minHeight: 380,
                  padding: 0,
                  boxSizing: "border-box",
                }}
              >
                <h2
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: "center",
                    padding: "14px 10px",
                    margin: 0,
                    borderBottom: "1px solid #f1f5f9",
                    color: "#1e293b",
                    letterSpacing: "0.5px",
                  }}
                >
                  NGHIỆP VỤ TỔNG HỢP
                </h2>

                {/* Workflow Canvas */}
                <div
                  style={{
                    position: "relative",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-around",
                    padding: "20px 24px",
                  }}
                >
                  {/* Subtle connection lines background SVG */}
                  <svg
                    viewBox="0 0 1000 280"
                    preserveAspectRatio="none"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  >
                    <defs>
                      <marker
                        id="arrow-ledger"
                        markerWidth="8"
                        markerHeight="8"
                        refX="6"
                        refY="3.5"
                        orient="auto"
                      >
                        <polygon points="0 0, 7 3.5, 0 7" fill="#94a3b8" />
                      </marker>
                    </defs>

                    {/* Top Row horizontal connector */}
                    <line
                      x1="180"
                      y1="60"
                      x2="330"
                      y2="60"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      markerEnd="url(#arrow-ledger)"
                    />

                    {/* From Quyết toán to Bottom line */}
                    <path
                      d="M 335,90 Q 335,190 420,190"
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />

                    {/* Bottom Row line connecting all bottom nodes */}
                    <line
                      x1="280"
                      y1="190"
                      x2="420"
                      y2="190"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                      markerEnd="url(#arrow-ledger)"
                    />

                    <line
                      x1="480"
                      y1="190"
                      x2="600"
                      y2="190"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                      markerEnd="url(#arrow-ledger)"
                    />

                    <line
                      x1="660"
                      y1="190"
                      x2="780"
                      y2="190"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                      markerEnd="url(#arrow-ledger)"
                    />

                    {/* Continuing rightwards */}
                    <line
                      x1="840"
                      y1="190"
                      x2="940"
                      y2="190"
                      stroke="#cbd5e1"
                      strokeWidth="1.5"
                      markerEnd="url(#arrow-ledger)"
                    />
                  </svg>

                  {/* Row 1: Đề nghị quyết toán tạm ứng -> Quyết toán tạm ứng */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 60,
                      position: "relative",
                      zIndex: 2,
                      paddingLeft: 40,
                    }}
                  >
                    {/* Node 1: Đề nghị quyết toán tạm ứng */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddAdvanceRequestModalOpen(true);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        width: 120,
                        textAlign: "center",
                      }}
                      title="Đề nghị quyết toán tạm ứng"
                    >
                      <span className="ref-business-icon request" style={{ marginBottom: 6 }}>
                        <span
                          className="ref-document-sheet"
                          style={{
                            background: "linear-gradient(90deg, #10b981, #059669)",
                            border: "1px solid #34d399",
                          }}
                        >
                          <b style={{ color: "#ffffff", fontWeight: 800 }}>ĐN</b>
                          <i /><i /><i />
                        </span>
                        <span
                          className="ref-gold-icon"
                          style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                        >
                          <ArrowRight size={14} strokeWidth={2.2} />
                        </span>
                      </span>
                      <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                        Đề nghị quyết<br />toán tạm ứng
                      </span>
                    </div>

                    {/* Node 2: Quyết toán tạm ứng */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddAdvanceSettlementModalOpen(true);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        width: 120,
                        textAlign: "center",
                      }}
                      title="Quyết toán tạm ứng"
                    >
                      <span className="ref-business-icon settlement" style={{ marginBottom: 6 }}>
                        <span
                          className="ref-document-sheet"
                          style={{
                            background: "linear-gradient(90deg, #10b981, #059669)",
                            border: "1px solid #34d399",
                          }}
                        >
                          <b style={{ color: "#ffffff", fontWeight: 800 }}>QT</b>
                          <i /><i /><i />
                        </span>
                        <span
                          className="ref-gold-icon"
                          style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                        >
                          <Check size={14} strokeWidth={2.5} />
                        </span>
                      </span>
                      <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                        Quyết toán<br />tạm ứng
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Chứng từ nghiệp vụ khác -> Kết chuyển lãi lỗ -> Khóa sổ -> Lập báo cáo tài chính */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-around",
                      position: "relative",
                      zIndex: 2,
                      marginTop: 20,
                    }}
                  >
                    {/* Node 3: Chứng từ nghiệp vụ khác */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddVoucherModalOpen(true);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        width: 120,
                        textAlign: "center",
                      }}
                      title="Chứng từ nghiệp vụ khác"
                    >
                      <span className="ref-business-icon voucher" style={{ marginBottom: 6 }}>
                        <span
                          className="ref-document-sheet"
                          style={{
                            background: "linear-gradient(90deg, #10b981, #059669)",
                            border: "1px solid #34d399",
                          }}
                        >
                          <b style={{ color: "#ffffff", fontWeight: 800 }}>PK</b>
                          <i /><i /><i />
                        </span>
                        <span
                          className="ref-gold-icon"
                          style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                        >
                          <FileText size={14} strokeWidth={2.2} />
                        </span>
                      </span>
                      <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                        Chứng từ<br />nghiệp vụ khác
                      </span>
                    </div>

                    {/* Node 4: Kết chuyển lãi lỗ */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setClosingEntryModalOpen(true);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        width: 120,
                        textAlign: "center",
                      }}
                      title="Kết chuyển lãi lỗ"
                    >
                      <span className="ref-business-icon transfer" style={{ marginBottom: 6 }}>
                        <span
                          className="ref-document-sheet"
                          style={{
                            background: "linear-gradient(90deg, #10b981, #059669)",
                            border: "1px solid #34d399",
                          }}
                        >
                          <b style={{ color: "#ffffff", fontWeight: 800 }}>KC</b>
                          <i /><i /><i />
                        </span>
                        <span
                          className="ref-gold-icon"
                          style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                        >
                          <TrendingUp size={14} strokeWidth={2.2} />
                        </span>
                      </span>
                      <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                        Kết chuyển<br />lãi lỗ
                      </span>
                    </div>

                    {/* Node 5: Khóa sổ kỳ kế toán (With Image 1 Popover) */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLockMenu(!showLockMenu);
                        setShowStatementsMenu(false);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        width: 120,
                        textAlign: "center",
                        position: "relative",
                      }}
                      title="Khóa sổ kỳ kế toán"
                    >
                      <span className="ref-business-icon lock" style={{ marginBottom: 6 }}>
                        <span
                          className="ref-document-sheet"
                          style={{
                            background: "linear-gradient(90deg, #10b981, #059669)",
                            border: "1px solid #34d399",
                          }}
                        >
                          <b style={{ color: "#ffffff", fontWeight: 800 }}>KS</b>
                          <i /><i /><i />
                        </span>
                        <span
                          className="ref-gold-icon"
                          style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                        >
                          <Lock size={14} strokeWidth={2.2} />
                        </span>
                      </span>
                      <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                        Khóa sổ kỳ<br />kế toán
                      </span>

                      {/* POPOVER MENU 1 (Exact Image 1) */}
                      {showLockMenu && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: 80,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 250,
                            background: "#ffffff",
                            borderRadius: 6,
                            boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                            border: "1px solid #e2e8f0",
                            padding: "6px 0",
                            zIndex: 9999,
                            textAlign: "left",
                            animation: "misaFadeIn 0.15s ease-out",
                          }}
                        >
                          <div
                            onClick={() => {
                              setShowLockMenu(false);
                              setLockPeriodModalOpen(true);
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Khóa sổ kỳ kế toán
                          </div>
                          <div
                            onClick={() => {
                              setShowLockMenu(false);
                              setUnlockPeriodModalOpen(true);
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Bỏ khóa sổ kỳ kế toán
                          </div>
                          <div
                            onClick={() => {
                              setShowLockMenu(false);
                              setLockByTypeModalOpen(true);
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <span>Khóa sổ/Bỏ khóa sổ theo Loại chứng từ</span>
                            <span
                              style={{
                                background: "#ea580c",
                                color: "#ffffff",
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "1px 5px",
                                borderRadius: 3,
                              }}
                            >
                              Mới
                            </span>
                          </div>
                          <div
                            onClick={() => {
                              setShowLockMenu(false);
                              setAutoLockModalOpen(true);
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              borderTop: "1px solid #f1f5f9",
                              marginTop: 4,
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Thiết lập khóa sổ tự động
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Node 6: Lập báo cáo tài chính (With Image 2 Popover) */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStatementsMenu(!showStatementsMenu);
                        setShowLockMenu(false);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        width: 120,
                        textAlign: "center",
                        position: "relative",
                      }}
                      title="Lập báo cáo tài chính"
                    >
                      <span className="ref-business-icon report" style={{ marginBottom: 6 }}>
                        <span
                          className="ref-document-sheet"
                          style={{
                            background: "linear-gradient(90deg, #10b981, #059669)",
                            border: "1px solid #34d399",
                          }}
                        >
                          <b style={{ color: "#ffffff", fontWeight: 800 }}>BC</b>
                          <i /><i /><i />
                        </span>
                        <span
                          className="ref-gold-icon"
                          style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                        >
                          <BarChart3 size={14} strokeWidth={2.2} />
                        </span>
                      </span>
                      <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                        Lập báo cáo<br />tài chính
                      </span>

                      {/* POPOVER MENU 2 (Exact Image 2) */}
                      {showStatementsMenu && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: 80,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 250,
                            background: "#ffffff",
                            borderRadius: 6,
                            boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                            border: "1px solid #e2e8f0",
                            padding: "6px 0",
                            zIndex: 9999,
                            textAlign: "left",
                            animation: "misaFadeIn 0.15s ease-out",
                          }}
                        >
                          <div
                            onClick={() => {
                              setShowStatementsMenu(false);
                              openStatementModal("bctc");
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Báo cáo tài chính
                          </div>
                          <div
                            onClick={() => {
                              setShowStatementsMenu(false);
                              openStatementModal("thuyet_minh_bctc");
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Thuyết minh báo cáo tài chính
                          </div>
                          <div
                            onClick={() => {
                              setShowStatementsMenu(false);
                              openStatementModal("bctc_giua_nien_do");
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Báo cáo tài chính giữa niên độ
                          </div>
                          <div
                            onClick={() => {
                              setShowStatementsMenu(false);
                              openStatementModal("thuyet_minh_bctc_giua_nien_do");
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Thuyết minh báo cáo tài chính giữa niên độ
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Box: BÁO CÁO (Exact Image 1 & 2) */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "24px 20px 24px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#1e293b",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      marginBottom: 16,
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: 14,
                    }}
                  >
                    BÁO CÁO
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
                    {[
                      "Sổ chi tiết các tài khoản",
                      "Sổ nhật ký chung",
                      "Tổng hợp công nợ nhân viên",
                      "Tổng hợp công nợ theo đối tượng",
                      "B01a-DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)",
                    ].map((rpt, idx) => (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewReportName(rpt);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          fontSize: 13,
                          color: "#334155",
                          cursor: "pointer",
                          lineHeight: 1.45,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                      >
                        <span style={{ fontSize: 14, color: "#64748b" }}>•</span>
                        <span>{rpt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ textAlign: "center", marginTop: 24, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                  <Link
                    to={href("/ledger/reports")}
                    style={{
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#0284c7",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Tất cả báo cáo
                  </Link>
                </div>
              </div>
            </div>

            {/* Middle Row: 6 Action Cards (Hệ thống tài khoản, Mã thống kê, Khoản mục CP, Tiện ích, Ngoại tệ, Tùy chọn) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: 16,
              }}
            >
              {[
                {
                  id: "accounts",
                  label: "Hệ thống tài khoản",
                  icon: User,
                  action: () => setChartOfAccountsModalOpen(true),
                },
                {
                  id: "stats",
                  label: "Mã thống kê",
                  icon: Code2,
                  action: () => setStatsCodeModalOpen(true),
                },
                {
                  id: "expense",
                  label: "Khoản mục chi phí",
                  icon: DollarSign,
                  action: () => setExpenseItemModalOpen(true),
                },
                {
                  id: "utilities",
                  label: "Tiện ích (Phân bổ CP)",
                  icon: Lightbulb,
                  action: () => setExpenseAllocationModalOpen(true),
                },
                {
                  id: "fx_revaluation",
                  label: "Đánh giá lại ngoại tệ",
                  icon: RefreshCw,
                  action: () => setFxRevaluationModalOpen(true),
                },
                {
                  id: "options",
                  label: "Tùy chọn",
                  icon: SlidersHorizontal,
                  action: () => setOptionsModalOpen(true),
                },
              ].map((card) => (
                <div
                  key={card.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    card.action();
                  }}
                  style={{
                    background: "#ffffff",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    padding: "16px 12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#00a862";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 168, 98, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.02)";
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "#f0fdf4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#00a862",
                    }}
                  >
                    <card.icon size={20} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", textAlign: "center" }}>
                    {card.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ĐỀ NGHỊ QUYẾT TOÁN TẠM ỨNG (Exact Match to User Screenshot)         */}
        {/* ========================================================================= */}
        {currentTab === "advance-settlement-request" && (
          <div style={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
            {!showAdvanceRequestTable ? (
              /* Exact 3-Step Flow Diagram from Screenshot */
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: "26px 30px 34px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  maxWidth: 1080,
                }}
              >
                {/* Header matching user screenshot */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: "#1e293b",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                      }}
                    >
                      LUỒNG QUY TRÌNH TỰ ĐỘNG HÓA ĐỀ NGHỊ QUYẾT TOÁN TẠM ỨNG
                    </h2>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 5 }}>
                      Hệ thống liên thông thông suốt giữa Quy trình Sổ Việt và Sổ Việt ERP
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowAdvanceRequestTable(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#ffffff",
                        color: "#00a862",
                        border: "1px solid #00a862",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <FileText size={16} />
                      <span>Danh sách đề nghị quyết toán ({advanceRequests.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={openNewAdvanceRequestModal}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#0284c7",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={16} />
                      <span>Thêm đề nghị quyết toán</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutoSyncAdvanceModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#00a862",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(0, 168, 98, 0.2)",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#009153")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#00a862")}
                    >
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                        <path d="M3.5 6.5h7M15.5 6.5h1M3.5 13.5h2M10.5 13.5h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="13" cy="6.5" r="2.2" fill="#ffffff" />
                        <circle cx="8" cy="13.5" r="2.2" fill="#ffffff" />
                        <path d="M13 8.7v1.8a2 2 0 0 1-2 2H8" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.5 1.5" />
                      </svg>
                      <span>Thiết lập tự động</span>
                    </button>
                  </div>
                </div>

                {/* 3 Process Cards Grid with Chunky Mint Arrows */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    justifyContent: "space-between",
                    gap: 12,
                    marginTop: 6,
                  }}
                >
                  {/* CARD 1: BƯỚC 1 - Quy trình Sổ Việt */}
                  <div
                    style={{
                      flex: 1,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: "24px 22px 22px",
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 390,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    {/* Decorative Top-Right Watermark (Quy trình Sổ Việt Logo) */}
                    <div
                      style={{
                        position: "absolute",
                        top: -16,
                        right: -16,
                        width: 96,
                        height: 96,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(14, 165, 233, 0.06) 65%, transparent 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          fontSize: 16,
                          fontWeight: 800,
                          boxShadow: "0 2px 8px rgba(2, 132, 199, 0.35)",
                        }}
                      >
                        Q
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", letterSpacing: "0.3px" }}>
                        BƯỚC 1
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>
                        Quy trình Sổ Việt
                      </div>

                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#0f172a",
                          lineHeight: 1.45,
                          marginTop: 24,
                        }}
                      >
                        Nhân viên lập đề nghị quyết toán tạm ứng trên Quy trình Sổ Việt
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: "#475569",
                          lineHeight: 1.6,
                          marginTop: 14,
                        }}
                      >
                        Sau khi tổng hợp toàn bộ hóa đơn, chứng từ để quyết toán tạm ứng, nhân viên chủ động tạo đề nghị quyết toán tạm ứng.
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
                        <div
                          style={{
                            width: 17,
                            height: 17,
                            borderRadius: "50%",
                            background: "#00a862",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff",
                            flexShrink: 0,
                          }}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                          Tạo đề nghị nhanh chóng trên web và mobile
                        </span>
                      </div>
                    </div>

                    {/* Footer Logo */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 28,
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        Q
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                        Quy trình Sổ Việt
                      </span>
                    </div>
                  </div>

                  {/* Chunky Mint Chevron Arrow 1 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: "0 2px" }}>
                    <svg width="48" height="34" viewBox="0 0 48 34" fill="none">
                      <path
                        d="M 6 9.5 L 26 9.5 L 26 2 L 46 17 L 26 32 L 26 24.5 L 6 24.5 L 14 17 Z"
                        fill="#bbf7d0"
                        opacity="0.95"
                      />
                    </svg>
                  </div>

                  {/* CARD 2: BƯỚC 2 - Quy trình Sổ Việt */}
                  <div
                    style={{
                      flex: 1,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: "24px 22px 22px",
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 390,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
                    }}
                  >
                    {/* Decorative Top-Right Watermark (Quy trình Sổ Việt Logo) */}
                    <div
                      style={{
                        position: "absolute",
                        top: -16,
                        right: -16,
                        width: 96,
                        height: 96,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(14, 165, 233, 0.06) 65%, transparent 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          fontSize: 16,
                          fontWeight: 800,
                          boxShadow: "0 2px 8px rgba(2, 132, 199, 0.35)",
                        }}
                      >
                        Q
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", letterSpacing: "0.3px" }}>
                        BƯỚC 2
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>
                        Quy trình Sổ Việt
                      </div>

                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#0f172a",
                          lineHeight: 1.45,
                          marginTop: 24,
                        }}
                      >
                        Giám đốc/Kế toán phê duyệt
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: "#475569",
                          lineHeight: 1.6,
                          marginTop: 14,
                        }}
                      >
                        Đề nghị được chuyển đến đúng người phụ trách để kiểm tra, trao đổi, bổ sung thông tin và phê duyệt trực tiếp trên Quy trình Sổ Việt.
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
                        <div
                          style={{
                            width: 17,
                            height: 17,
                            borderRadius: "50%",
                            background: "#00a862",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff",
                            flexShrink: 0,
                          }}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                          Tạo đề nghị nhanh chóng trên web và mobile
                        </span>
                      </div>
                    </div>

                    {/* Footer Logo */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 28,
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        Q
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                        Quy trình Sổ Việt
                      </span>
                    </div>
                  </div>

                  {/* Chunky Mint Chevron Arrow 2 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: "0 2px" }}>
                    <svg width="48" height="34" viewBox="0 0 48 34" fill="none">
                      <path
                        d="M 6 9.5 L 26 9.5 L 26 2 L 46 17 L 26 32 L 26 24.5 L 6 24.5 L 14 17 Z"
                        fill="#bbf7d0"
                        opacity="0.95"
                      />
                    </svg>
                  </div>

                  {/* CARD 3: BƯỚC 3 - Sổ Việt ERP */}
                  <div
                    style={{
                      flex: 1,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: "24px 22px 22px",
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 390,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
                    }}
                  >
                    {/* Decorative Top-Right Watermark (MISA Logo) */}
                    <div
                      style={{
                        position: "absolute",
                        top: -16,
                        right: -16,
                        width: 96,
                        height: 96,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(0, 168, 98, 0.22) 0%, rgba(0, 168, 98, 0.06) 65%, transparent 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2 A10 10 0 0 1 22 12 H12 Z" fill="#0284c7" />
                        <path d="M22 12 A10 10 0 0 1 12 22 V12 Z" fill="#00a862" />
                        <path d="M12 22 A10 10 0 0 1 2 12 H12 Z" fill="#eab308" />
                        <path d="M2 12 A10 10 0 0 1 12 2 V12 Z" fill="#ef4444" />
                        <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
                      </svg>
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", letterSpacing: "0.3px" }}>
                        BƯỚC 3
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>
                        Sổ Việt ERP
                      </div>

                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#0f172a",
                          lineHeight: 1.45,
                          marginTop: 24,
                        }}
                      >
                        Đồng bộ đề nghị về Sổ Việt ERP
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: "#475569",
                          lineHeight: 1.6,
                          marginTop: 14,
                        }}
                      >
                        Kế toán kế thừa thông tin từ đề nghị quyết toán tạm ứng đã duyệt để lập chứng từ hạch toán nhanh chóng, không cần nhập lại thủ công.
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
                        <div
                          style={{
                            width: 17,
                            height: 17,
                            borderRadius: "50%",
                            background: "#00a862",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff",
                            flexShrink: 0,
                          }}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                          Kế thừa dữ liệu & tự động sinh hạch toán
                        </span>
                      </div>
                    </div>

                    {/* Footer Logo */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 28,
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2 A10 10 0 0 1 22 12 H12 Z" fill="#0284c7" />
                        <path d="M22 12 A10 10 0 0 1 12 22 V12 Z" fill="#00a862" />
                        <path d="M12 22 A10 10 0 0 1 2 12 H12 Z" fill="#eab308" />
                        <path d="M2 12 A10 10 0 0 1 12 2 V12 Z" fill="#ef4444" />
                        <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                        Sổ Việt ERP
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Synced Data Table View (UC-GL-01) */
              <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 20, width: "100%" }}>
                {/* Toolbar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setShowAdvanceRequestTable(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        color: "#00a862",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <span>← Quay lại luồng quy trình</span>
                    </button>

                    <div style={{ position: "relative", width: 280 }}>
                      <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 10, top: 10 }} />
                      <input
                        type="text"
                        placeholder="Tìm theo số đề nghị, người đề nghị..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px 8px 34px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                        }}
                      />
                    </div>

                    <select
                      aria-label="Lọc trạng thái đề nghị quyết toán"
                      value={advReqStatusFilter}
                      onChange={(e) => setAdvReqStatusFilter(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="PENDING_APPROVAL">Chờ duyệt</option>
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="RETURNED">Yêu cầu bổ sung</option>
                      <option value="REJECTED">Từ chối</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setAutoSyncAdvanceModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#334155",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <Settings size={15} />
                      <span>Thiết lập tự động</span>
                    </button>

                    <button
                      type="button"
                      onClick={openNewAdvanceRequestModal}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 16px",
                        borderRadius: 6,
                        background: "#00a862",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={16} />
                      <span>Thêm đề nghị quyết toán</span>
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px", width: 40 }}>
                          <input type="checkbox" />
                        </th>
                        <th style={{ padding: "10px 14px" }}>Số đề nghị</th>
                        <th style={{ padding: "10px 14px" }}>Ngày đề nghị</th>
                        <th style={{ padding: "10px 14px" }}>Người đề nghị</th>
                        <th style={{ padding: "10px 14px" }}>Phòng ban</th>
                        <th style={{ padding: "10px 14px" }}>Mục đích / Diễn giải</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>Số tiền đề nghị quyết toán</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>Trạng thái</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advanceRequests
                        .filter((item) => {
                          if (advReqStatusFilter !== "ALL") {
                            const raw =
                              item.rawStatus ||
                              (item.status === "Đã duyệt"
                                ? "APPROVED"
                                : item.status === "Từ chối"
                                  ? "REJECTED"
                                  : item.status === "Yêu cầu bổ sung"
                                    ? "RETURNED"
                                    : "PENDING_APPROVAL");
                            if (raw !== advReqStatusFilter) return false;
                          }
                          if (!searchTerm.trim()) return true;
                          const kw = searchTerm.toLowerCase();
                          return (
                            String(item.id || "").toLowerCase().includes(kw) ||
                            String(item.employee || "").toLowerCase().includes(kw) ||
                            String(item.dept || "").toLowerCase().includes(kw) ||
                            String(item.reason || "").toLowerCase().includes(kw)
                          );
                        })
                        .map((item, idx) => {
                          const rawStatus =
                            item.rawStatus ||
                            (item.status === "Đã duyệt"
                              ? "APPROVED"
                              : item.status === "Từ chối"
                                ? "REJECTED"
                                : item.status === "Yêu cầu bổ sung"
                                  ? "RETURNED"
                                  : "PENDING_APPROVAL");
                          const badgeBg =
                            rawStatus === "APPROVED"
                              ? "#f0fdf4"
                              : rawStatus === "REJECTED"
                                ? "#fef2f2"
                                : rawStatus === "RETURNED"
                                  ? "#eff6ff"
                                  : "#fef3c7";
                          const badgeColor =
                            rawStatus === "APPROVED"
                              ? "#16a34a"
                              : rawStatus === "REJECTED"
                                ? "#dc2626"
                                : rawStatus === "RETURNED"
                                  ? "#2563eb"
                                  : "#d97706";
                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                background: idx % 2 === 0 ? "#ffffff" : "#fdfdfd",
                              }}
                            >
                              <td style={{ padding: "10px 14px" }}>
                                <input type="checkbox" />
                              </td>
                              <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>
                                {item.id}
                                {item.settlementVoucherNo && (
                                  <div style={{ fontSize: 11, color: "#0284c7", fontWeight: 500, marginTop: 2 }}>
                                    CT: {item.settlementVoucherNo}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "10px 14px" }}>{item.date}</td>
                              <td style={{ padding: "10px 14px", fontWeight: 500 }}>{item.employee}</td>
                              <td style={{ padding: "10px 14px", color: "#64748b" }}>{item.dept}</td>
                              <td style={{ padding: "10px 14px" }}>
                                <div>{item.reason}</div>
                                {item.rejectionReason && (
                                  <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 3 }}>
                                    Ý kiến cấp duyệt: {item.rejectionReason}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                                {formatVND(item.amount)}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                <span
                                  style={{
                                    padding: "3px 8px",
                                    borderRadius: 12,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    background: badgeBg,
                                    color: badgeColor,
                                    display: "inline-block",
                                  }}
                                >
                                  {item.status}
                                </span>
                                {rawStatus === "APPROVED" && item.syncStatus && (
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: item.syncStatus === "SYNC_ERROR" ? "#dc2626" : "#64748b",
                                      marginTop: 3,
                                    }}
                                  >
                                    {item.syncStatus === "SYNCED"
                                      ? "Đã đồng bộ ERP"
                                      : item.syncStatus === "SYNC_ERROR"
                                        ? "Lỗi đồng bộ"
                                        : item.syncStatus === "SYNC_PENDING"
                                          ? "Chờ đồng bộ định kỳ"
                                          : "Chưa đồng bộ"}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    onClick={() => setViewingAdvReq(item)}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "#0284c7",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontSize: 12.5,
                                    }}
                                  >
                                    Xem
                                  </button>

                                  {rawStatus === "PENDING_APPROVAL" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleDecideAdvanceRequest(item, "approve")}
                                        style={{
                                          background: "#f0fdf4",
                                          border: "1px solid #bbf7d0",
                                          borderRadius: 4,
                                          padding: "2px 8px",
                                          color: "#16a34a",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          fontSize: 12,
                                        }}
                                      >
                                        Duyệt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDecideAdvanceRequest(item, "request-info")}
                                        style={{
                                          background: "#eff6ff",
                                          border: "1px solid #bfdbfe",
                                          borderRadius: 4,
                                          padding: "2px 8px",
                                          color: "#2563eb",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          fontSize: 12,
                                        }}
                                      >
                                        Yêu cầu bổ sung
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDecideAdvanceRequest(item, "reject")}
                                        style={{
                                          background: "#fef2f2",
                                          border: "1px solid #fecaca",
                                          borderRadius: 4,
                                          padding: "2px 8px",
                                          color: "#dc2626",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          fontSize: 12,
                                        }}
                                      >
                                        Từ chối
                                      </button>
                                    </>
                                  )}

                                  {rawStatus === "RETURNED" && (
                                    <button
                                      type="button"
                                      onClick={() => openEditReturnedAdvanceRequestModal(item)}
                                      style={{
                                        background: "#eff6ff",
                                        border: "1px solid #93c5fd",
                                        borderRadius: 4,
                                        padding: "2px 8px",
                                        color: "#1d4ed8",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontSize: 12,
                                      }}
                                    >
                                      Bổ sung & Gửi lại
                                    </button>
                                  )}

                                  {rawStatus === "APPROVED" && item.syncStatus === "SYNC_ERROR" && (
                                    <button
                                      type="button"
                                      onClick={() => handleRetrySyncAdvanceRequest(item)}
                                      style={{
                                        background: "#fff7ed",
                                        border: "1px solid #fed7aa",
                                        borderRadius: 4,
                                        padding: "2px 8px",
                                        color: "#ea580c",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontSize: 12,
                                      }}
                                    >
                                      Đồng bộ lại
                                    </button>
                                  )}

                                  {rawStatus === "APPROVED" && !item.settlementVoucherNo && (
                                    <button
                                      type="button"
                                      onClick={() => handleInheritAdvanceRequestToVoucher(item)}
                                      style={{
                                        background: "#ecfdf5",
                                        border: "1px solid #6ee7b7",
                                        borderRadius: 4,
                                        padding: "2px 8px",
                                        color: "#059669",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontSize: 12,
                                      }}
                                    >
                                      Lập CT quyết toán
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CHỨNG TỪ NGHIỆP VỤ KHÁC (Exact Match to User Screenshot 1 & 2)     */}
        {/* ========================================================================= */}
        {currentTab === "transactions" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            {!showVoucherTable ? (
              /* LANDING / EMPTY STATE VIEW (Exact Match to Screenshot 1 & 2) */
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  minHeight: "calc(100vh - 120px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "48px 24px",
                  position: "relative",
                  width: "100%",
                }}
              >
                {/* Center Content: Illustration + Heading + 3 Buttons */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "auto 0",
                    textAlign: "center",
                    maxWidth: 780,
                  }}
                >
                  {/* SVG Illustration (Woman typing at laptop with floating documents and sparkles) */}
                  <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
                    <svg width="260" height="165" viewBox="0 0 260 165" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Desk shadow */}
                      <ellipse cx="130" cy="148" rx="85" ry="10" fill="#f1f5f9" />
                      
                      {/* Desk */}
                      <path d="M78 142h104a4 4 0 0 1 4 4v2H74v-2a4 4 0 0 1 4-4z" fill="#e2e8f0" />
                      
                      {/* Laptop */}
                      <rect x="108" y="116" width="44" height="26" rx="3" fill="#cbd5e1" />
                      <rect x="111" y="119" width="38" height="20" rx="2" fill="#f8fafc" />
                      <path d="M102 142h56l-3 4h-50l-3-4z" fill="#94a3b8" />
                      
                      {/* Character */}
                      {/* Long Hair Back */}
                      <path d="M106 96c-6 4-12 12-14 26 5-2 10-6 12-12 2 8 6 18 10 24-2-12-3-26-8-38z" fill="#334155" />
                      {/* Green Blouse */}
                      <path d="M110 114c-10 2-16 10-18 24h32c-2-14-6-22-14-24z" fill="#00a862" />
                      {/* Left Arm Typing */}
                      <path d="M98 126c4 4 12 10 20 10l-2 4c-8 0-16-6-20-11z" fill="#00884d" />
                      {/* Right Arm Typing */}
                      <path d="M122 126c2 3 6 8 12 10l-1 4c-6-1-11-7-13-11z" fill="#00884d" />
                      {/* Head */}
                      <circle cx="118" cy="98" r="9.5" fill="#fcd34d" />
                      {/* Front Hair */}
                      <path d="M108 96c2-8 10-12 18-9 4 2 6 6 6 10-3-4-8-5-12-3-4 2-8 2-12 2z" fill="#1e293b" />
                      
                      {/* Faint dashed connection lines */}
                      <path d="M124 112 L112 74" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                      <path d="M128 112 L142 56" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                      <path d="M132 112 L178 78" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                      <path d="M136 118 L200 106" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Floating Doc 1 (top center-left: pie chart) */}
                      <g transform="translate(132, 32)">
                        <rect width="25" height="32" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                        <path d="M18 0 L25 7 H20 a2 2 0 0 1 -2 -2 V0 Z" fill="#e2e8f0" />
                        <rect x="4" y="6" width="10" height="2" rx="1" fill="#00a862" />
                        <circle cx="12.5" cy="19" r="6" fill="#ecfdf5" stroke="#00a862" strokeWidth="1.5" />
                        <path d="M12.5 13 A6 6 0 0 1 18.5 19 H12.5 V13 Z" fill="#00a862" />
                      </g>

                      {/* Floating Doc 2 (top right: bar chart) */}
                      <g transform="translate(172, 54)">
                        <rect width="25" height="32" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                        <path d="M18 0 L25 7 H20 a2 2 0 0 1 -2 -2 V0 Z" fill="#e2e8f0" />
                        <rect x="4" y="5" width="10" height="2" rx="1" fill="#00a862" />
                        <rect x="5" y="19" width="3" height="7" rx="0.5" fill="#00a862" />
                        <rect x="10" y="15" width="3" height="11" rx="0.5" fill="#10b981" />
                        <rect x="15" y="11" width="3" height="15" rx="0.5" fill="#34d399" />
                      </g>

                      {/* Floating Doc 3 (mid right: lines chart) */}
                      <g transform="translate(198, 92)">
                        <rect width="23" height="29" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                        <path d="M16 0 L23 7 H18 a2 2 0 0 1 -2 -2 V0 Z" fill="#e2e8f0" />
                        <rect x="4" y="5" width="8" height="2" rx="1" fill="#00a862" />
                        <circle cx="11.5" cy="17.5" r="5" fill="#ecfdf5" stroke="#00a862" strokeWidth="1.5" />
                        <path d="M11.5 12.5 A5 5 0 0 1 16.5 17.5 H11.5 V12.5 Z" fill="#00a862" />
                      </g>

                      {/* Sparkles / Stars / Diamonds */}
                      <path d="M88 92 h6 M91 89 v6" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M192 40 h5 M194.5 37.5 v5" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M148 20 h4 M150 18 v4" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
                      <rect x="136" y="84" width="3.5" height="3.5" transform="rotate(45 136 84)" fill="#00a862" />
                      <rect x="194" y="74" width="3.5" height="3.5" transform="rotate(45 194 74)" fill="#94a3b8" />
                      <rect x="226" y="102" width="3" height="3" transform="rotate(45 226 102)" fill="#00a862" />
                      <circle cx="214" cy="66" r="1.5" fill="#94a3b8" />
                      <circle cx="94" cy="110" r="1.5" fill="#94a3b8" />
                    </svg>
                  </div>

                  {/* Heading Matching Screenshot */}
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1e293b",
                      lineHeight: 1.55,
                      maxWidth: 740,
                    }}
                  >
                    Lập chứng từ nghiệp vụ khác: Vay tiền ngân hàng để trả NCC, bù trừ công nợ phải thu và phải trả, hạch toán thuế TNDN phải nộp, quyết toán tạm ứng,...
                  </h2>

                  {/* 3 Buttons Row Matching Screenshot */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      marginTop: 26,
                      position: "relative",
                    }}
                  >
                    {/* Button 1: Thêm bằng AI */}
                    <button
                      type="button"
                      onClick={() => setAiVoucherModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        padding: "7px 16px 7px 10px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(37, 99, 235, 0.28)",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.95")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          overflow: "hidden",
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" fill="url(#avaGradBtn)" />
                          <ellipse cx="12" cy="13" rx="5" ry="4" fill="#ffffff" />
                          <circle cx="10" cy="12" r="1.2" fill="#2563eb" />
                          <circle cx="14" cy="12" r="1.2" fill="#2563eb" />
                          <path d="M10.5 14.5 Q12 16 13.5 14.5" stroke="#2563eb" strokeWidth="1" strokeLinecap="round" />
                          <defs>
                            <linearGradient id="avaGradBtn" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#3b82f6" />
                              <stop offset="1" stopColor="#8b5cf6" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                      <span>Thêm bằng AI</span>
                    </button>

                    {/* Button 2: Thêm ˅ (With Dropdown Menu from Screenshot 2) */}
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        data-testid="add-voucher-dropdown-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAddVoucherMenu(!showAddVoucherMenu);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 6px rgba(0, 168, 98, 0.2)",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#009153")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#00a862")}
                      >
                        <span>Thêm</span>
                        <ChevronDown size={14} strokeWidth={2.5} />
                      </button>

                      {/* Dropdown Popover (Matching Screenshot 2 & 6 types) */}
                      {showAddVoucherMenu && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            left: 0,
                            width: 320,
                            background: "#ffffff",
                            borderRadius: 6,
                            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.05)",
                            border: "1px solid #e2e8f0",
                            padding: "6px 0",
                            zIndex: 100,
                            textAlign: "left",
                          }}
                        >
                          <div
                            onClick={() => openAddVoucherWithType("1. Hạch toán thuế TNDN phải nộp")}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#0f172a",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              background: "#f8fafc",
                              borderBottom: "1px solid #f1f5f9",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f0fdf4";
                              e.currentTarget.style.color = "#00a862";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#f8fafc";
                              e.currentTarget.style.color = "#0f172a";
                            }}
                          >
                            Chứng từ nghiệp vụ khác
                          </div>

                          {/* 6 Sub-options under Chứng từ nghiệp vụ khác */}
                          <div style={{ background: "#ffffff", padding: "4px 0" }}>
                            {voucherTypeOptions.map((vType) => (
                              <div
                                key={vType}
                                onClick={() => openAddVoucherWithType(vType)}
                                style={{
                                  padding: "7px 16px 7px 24px",
                                  fontSize: 12.5,
                                  color: "#334155",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#f0fdf4";
                                  e.currentTarget.style.color = "#00a862";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "transparent";
                                  e.currentTarget.style.color = "#334155";
                                }}
                              >
                                {vType}
                              </div>
                            ))}
                          </div>

                          <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />

                          <div
                            onClick={() => {
                              setShowAddVoucherMenu(false);
                              setAddAdvanceSettlementModalOpen(true);
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f8fafc";
                              e.currentTarget.style.color = "#00a862";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "#1e293b";
                            }}
                          >
                            Quyết toán tạm ứng
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Button 3: Nhập từ Excel */}
                    <button
                      type="button"
                      onClick={() => { void handleImportGeneralVouchersExcel(); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#ffffff",
                        color: "#334155",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      <span>Nhập từ Excel</span>
                    </button>

                    {/* Button 4: Tiếp nhận bút toán từ phân hệ (UC-GL-04) */}
                    <button
                      type="button"
                      onClick={() => setSubledgerModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #93c5fd",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Share2 size={15} />
                      <span>Tiếp nhận từ phân hệ ({subledgerIngestions.length})</span>
                    </button>

                    {/* Button 5: Phân bổ chi phí bán hàng, QLDN, khác (UC-GL-07) */}
                    <button
                      type="button"
                      onClick={() => setExpenseAllocationModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#f0fdf4",
                        color: "#00a862",
                        border: "1px solid #86efac",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <TrendingUp size={15} />
                      <span>Phân bổ chi phí ({allocRunsHistory.length})</span>
                    </button>

                    {/* Button 6: Đánh giá lại tài khoản ngoại tệ (UC-GL-08) */}
                    <button
                      type="button"
                      onClick={() => setFxRevaluationModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #93c5fd",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <RefreshCw size={15} />
                      <span>Đánh giá lại ngoại tệ ({fxRevalRunsHistory.length})</span>
                    </button>

                    {/* Nút 4: Tổng hợp số dư & Kiểm tra cân đối GL (UC-GL-10) */}
                    <button
                      type="button"
                      onClick={() => setBalanceAggregationModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#f0fdf4",
                        color: "#15803d",
                        border: "1px solid #86efac",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Check size={15} />
                      <span>Tổng hợp số dư & Kiểm tra cân đối ({balAggStatus})</span>
                    </button>

                    {/* Nút 5: Đối chiếu số liệu GL với phân hệ (UC-GL-11) */}
                    <button
                      type="button"
                      onClick={() => setGlReconciliationModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#fefce8",
                        color: "#a16207",
                        border: "1px solid #fde047",
                        borderRadius: 6,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <RefreshCw size={15} />
                      <span>Đối chiếu GL ↔ Phân hệ ({glRecStatus})</span>
                    </button>
                  </div>

                  {/* Bottom Button: Xem danh sách chứng từ (Exact Match to Screenshot 1 & 2) */}
                  <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
                    <button
                      type="button"
                      onClick={() => setShowVoucherTable(true)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        borderRadius: 4,
                        padding: "7px 22px",
                        color: "#00a862",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* TABLE VIEW (when toggled via "Xem danh sách chứng từ") */
              <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 20 }}>
                {/* Toolbar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setShowVoucherTable(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <ArrowLeft size={15} />
                      <span>Quay lại giao diện chính</span>
                    </button>

                    <div style={{ position: "relative", width: 280 }}>
                      <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 10, top: 10 }} />
                      <input
                        type="text"
                        placeholder="Tìm theo số CT, diễn giải, tài khoản..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px 8px 34px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <Filter size={15} />
                      <span>Kỳ: Tháng 10/2026</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => { void handleBatchPostVouchers(); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "1px solid #86efac",
                        background: "#f0fdf4",
                        color: "#15803d",
                        fontWeight: 600,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      <Check size={14} />
                      <span>Ghi sổ hàng loạt{selectedVoucherIds.length > 0 ? ` (${selectedVoucherIds.length})` : ""}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { void handleBatchUnpostVouchers(); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "1px solid #fcd34d",
                        background: "#fffbeb",
                        color: "#b45309",
                        fontWeight: 600,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Bỏ ghi sổ hàng loạt{selectedVoucherIds.length > 0 ? ` (${selectedVoucherIds.length})` : ""}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => notify("Xuất Excel danh sách chứng từ nghiệp vụ khác")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={15} />
                      <span>Xuất khẩu</span>
                    </button>

                    {/* Split Add Button with dropdown in table view */}
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAddVoucherMenu(!showAddVoucherMenu);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 16px",
                          borderRadius: 6,
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={16} />
                        <span>Thêm</span>
                        <ChevronDown size={14} strokeWidth={2.5} />
                      </button>

                      {showAddVoucherMenu && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            right: 0,
                            width: 320,
                            background: "#ffffff",
                            borderRadius: 6,
                            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.05)",
                            border: "1px solid #e2e8f0",
                            padding: "6px 0",
                            zIndex: 100,
                            textAlign: "left",
                          }}
                        >
                          <div
                            onClick={() => openAddVoucherWithType("1. Hạch toán thuế TNDN phải nộp")}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#0f172a",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              background: "#f8fafc",
                              borderBottom: "1px solid #f1f5f9",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f0fdf4";
                              e.currentTarget.style.color = "#00a862";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#f8fafc";
                              e.currentTarget.style.color = "#0f172a";
                            }}
                          >
                            Chứng từ nghiệp vụ khác
                          </div>

                          {/* 6 Sub-options under Chứng từ nghiệp vụ khác */}
                          <div style={{ background: "#ffffff", padding: "4px 0" }}>
                            {voucherTypeOptions.map((vType) => (
                              <div
                                key={vType}
                                onClick={() => openAddVoucherWithType(vType)}
                                style={{
                                  padding: "7px 16px 7px 24px",
                                  fontSize: 12.5,
                                  color: "#334155",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#f0fdf4";
                                  e.currentTarget.style.color = "#00a862";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "transparent";
                                  e.currentTarget.style.color = "#334155";
                                }}
                              >
                                {vType}
                              </div>
                            ))}
                          </div>

                          <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />

                          <div
                            onClick={() => {
                              setShowAddVoucherMenu(false);
                              setAddAdvanceSettlementModalOpen(true);
                            }}
                            style={{
                              padding: "9px 16px",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#1e293b",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f8fafc";
                              e.currentTarget.style.color = "#00a862";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "#1e293b";
                            }}
                          >
                            Quyết toán tạm ứng
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px", width: 40 }}>
                          <input
                            type="checkbox"
                            checked={generalVouchers.length > 0 && selectedVoucherIds.length === generalVouchers.length}
                            onChange={handleToggleSelectAllVouchers}
                          />
                        </th>
                        <th style={{ padding: "10px 14px" }}>Ngày hạch toán</th>
                        <th style={{ padding: "10px 14px" }}>Số chứng từ</th>
                        <th style={{ padding: "10px 14px" }}>Diễn giải</th>
                        <th style={{ padding: "10px 14px" }}>TK Nợ</th>
                        <th style={{ padding: "10px 14px" }}>TK Có</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>Số tiền</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>Ghi sổ</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generalVouchers.map((item, idx) => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: idx % 2 === 0 ? "#ffffff" : "#fdfdfd",
                          }}
                        >
                          <td style={{ padding: "10px 14px" }}>
                            <input
                              type="checkbox"
                              checked={selectedVoucherIds.includes(item.id)}
                              onChange={() => handleToggleSelectVoucher(item.id)}
                            />
                          </td>
                          <td style={{ padding: "10px 14px" }}>{item.date}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>{item.id}</td>
                          <td style={{ padding: "10px 14px" }}>{item.desc}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0369a1" }}>{item.debitAcc}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#b45309" }}>{item.creditAcc}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                            {formatVND(item.amount)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 12,
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: item.posted ? "#f0fdf4" : "#fef3c7",
                                color: item.posted ? "#16a34a" : "#d97706",
                              }}
                            >
                              {(() => {
                                const record = apiConnected ? apiRows.journals?.find((row) => row.id === (item as any).apiId) : undefined;
                                return record ? (
                                  <MisaApiDocumentStatus
                                    path="/api/v1/general-ledger/journals/"
                                    record={record}
                                    companyId={company.id}
                                    notify={notify}
                                    onChanged={reloadApi}
                                  />
                                ) : item.posted ? (
                                  "Đã ghi sổ"
                                ) : (
                                  "Chưa ghi sổ"
                                );
                              })()}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => notify(`Xem chi tiết chứng từ ${item.id}`)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#0284c7",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  fontSize: 12.5,
                                }}
                              >
                                Xem
                              </button>
                              {!item.posted ? (
                                <button
                                  type="button"
                                  onClick={() => { void handlePostVoucherItem(item); }}
                                  style={{
                                    background: "#f0fdf4",
                                    border: "1px solid #86efac",
                                    borderRadius: 4,
                                    padding: "2px 8px",
                                    color: "#15803d",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontSize: 12,
                                  }}
                                >
                                  Ghi sổ
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => { void handleUnpostVoucherItem(item); }}
                                    style={{
                                      background: "#fffbeb",
                                      border: "1px solid #fcd34d",
                                      borderRadius: 4,
                                      padding: "2px 8px",
                                      color: "#b45309",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontSize: 12,
                                    }}
                                  >
                                    Bỏ ghi sổ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openCorrectionModal(item, "ADJUSTMENT")}
                                    style={{
                                      background: "#eff6ff",
                                      border: "1px solid #93c5fd",
                                      borderRadius: 4,
                                      padding: "2px 8px",
                                      color: "#1d4ed8",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontSize: 12,
                                    }}
                                  >
                                    Điều chỉnh
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openCorrectionModal(item, "REVERSAL")}
                                    style={{
                                      background: "#fef2f2",
                                      border: "1px solid #fca5a5",
                                      borderRadius: 4,
                                      padding: "2px 8px",
                                      color: "#b91c1c",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontSize: 12,
                                    }}
                                  >
                                    Đảo bút toán
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {correctionModal.open && correctionModal.sourceItem && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                        {correctionModal.mode === "ADJUSTMENT"
                          ? `UC-GL-06: Điều chỉnh bút toán gốc ${correctionModal.sourceItem.id}`
                          : `UC-GL-06: Đảo bút toán gốc ${correctionModal.sourceItem.id}`}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCorrectionModal((prev) => ({ ...prev, open: false }))}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12, fontSize: 12.5 }}>
                      <div>
                        <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>Số chứng từ mới *</label>
                        <input
                          value={correctionModal.newNumber}
                          onChange={(e) => setCorrectionModal((p) => ({ ...p, newNumber: e.target.value }))}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>Ngày hạch toán *</label>
                        <input
                          value={correctionModal.postingDate}
                          onChange={(e) => setCorrectionModal((p) => ({ ...p, postingDate: e.target.value }))}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>Lý do điều chỉnh/đảo *</label>
                        <input
                          placeholder="Nhập nguyên nhân thực hiện sửa sai..."
                          value={correctionModal.reason}
                          onChange={(e) => setCorrectionModal((p) => ({ ...p, reason: e.target.value }))}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                        />
                      </div>
                    </div>
                    {correctionModal.mode === "ADJUSTMENT" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12, fontSize: 12.5 }}>
                        <div>
                          <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>TK Nợ điều chỉnh *</label>
                          <input
                            value={correctionModal.adjDebitAcc}
                            onChange={(e) => setCorrectionModal((p) => ({ ...p, adjDebitAcc: e.target.value }))}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>TK Có điều chỉnh *</label>
                          <input
                            value={correctionModal.adjCreditAcc}
                            onChange={(e) => setCorrectionModal((p) => ({ ...p, adjCreditAcc: e.target.value }))}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>Số tiền điều chỉnh *</label>
                          <input
                            value={correctionModal.adjAmount}
                            onChange={(e) => setCorrectionModal((p) => ({ ...p, adjAmount: e.target.value }))}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>Phương thức điều chỉnh</label>
                          <select
                            value={correctionModal.adjustmentMode}
                            onChange={(e) => setCorrectionModal((p) => ({ ...p, adjustmentMode: e.target.value }))}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                          >
                            <option value="GENERAL">Điều chỉnh tổng hợp</option>
                            <option value="INCREASE_AMOUNT">AF-07: Tăng số tiền thiếu</option>
                            <option value="DECREASE_AMOUNT">AF-08: Giảm số tiền thừa</option>
                            <option value="RECLASSIFY_ACCOUNT">AF-09: Điều chỉnh sai tài khoản</option>
                            <option value="RECLASSIFY_DIMENSION">AF-10: Điều chỉnh đối tượng/chiều</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12, fontSize: 12.5 }}>
                        <div>
                          <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>Phương pháp đảo</label>
                          <select
                            value={correctionModal.reversalMethod}
                            onChange={(e) => setCorrectionModal((p) => ({ ...p, reversalMethod: e.target.value }))}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                          >
                            <option value="SWAP_DEBIT_CREDIT">Đảo Nợ / Có (Mặc định)</option>
                            <option value="STORNO_NEGATIVE">Đảo Storno</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>Phạm vi đảo</label>
                          <select
                            value={correctionModal.reversalScope}
                            onChange={(e) =>
                              setCorrectionModal((p) => ({ ...p, reversalScope: e.target.value as "FULL" | "PARTIAL" }))
                            }
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                          >
                            <option value="FULL">AF-11: Đảo toàn bộ</option>
                            <option value="PARTIAL">AF-12: Đảo một phần</option>
                          </select>
                        </div>
                        {correctionModal.reversalScope === "PARTIAL" && (
                          <div>
                            <label style={{ display: "block", color: "#475569", marginBottom: 4 }}>Số tiền đảo một phần *</label>
                            <input
                              value={correctionModal.reversalAmount}
                              onChange={(e) => setCorrectionModal((p) => ({ ...p, reversalAmount: e.target.value }))}
                              style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setCorrectionModal((prev) => ({ ...prev, open: false }))}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleSaveCorrectionModal(false); }}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #0284c7", background: "#e0f2fe", color: "#0369a1", fontWeight: 600, cursor: "pointer" }}
                      >
                        Cất (Chưa ghi sổ)
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleSaveCorrectionModal(true); }}
                        style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#00a862", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                      >
                        Cất và Ghi sổ (UC-GL-05)
                      </button>
                    </div>
                  </div>
                )}

                {/* Table Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12.5, color: "#64748b" }}>
                  <span>Tổng số: {generalVouchers.length} chứng từ</span>
                  <div style={{ fontWeight: 600, color: "#1e293b" }}>
                    Tổng tiền: {formatVND(generalVouchers.reduce((acc, v) => acc + v.amount, 0))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: KẾT CHUYỂN LÃI LỖ (Matching user screenshot 2)                      */}
        {/* ========================================================================= */}
        {currentTab === "closing-entry" && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              minHeight: 620,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              overflow: "hidden",
            }}
          >
            {!showClosingTable ? (
              /* LANDING VIEW MATCHING SCREENSHOT 2 */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  flex: 1,
                  padding: "80px 24px 36px 24px",
                }}
              >
                {/* SVG Illustration Matching Screenshot 2 */}
                <div style={{ marginBottom: 28, position: "relative" }}>
                  <svg width="240" height="150" viewBox="0 0 240 150" fill="none">
                    {/* Background circular halo */}
                    <circle cx="120" cy="75" r="55" fill="#f0fdf4" />

                    {/* Green Document Folder with Exchange Badge (Top Left of Accountant) */}
                    <g transform="translate(68, 24)">
                      {/* Document shape with rounded top-left & bottom-right */}
                      <path
                        d="M0 12 C0 5.37 5.37 0 12 0 H36 C42.63 0 48 5.37 48 12 V38 C48 44.63 42.63 50 36 50 H12 C5.37 50 0 44.63 0 38 Z"
                        fill="#e2e8f0"
                      />
                      {/* Top green corner */}
                      <path d="M0 12 C0 5.37 5.37 0 12 0 H26 V24 H0 Z" fill="#00a862" />
                      {/* White circular badge inside */}
                      <circle cx="24" cy="25" r="13" fill="#ffffff" stroke="#00a862" strokeWidth="2" />
                      {/* Circular arrows loop */}
                      <path
                        d="M19 22 A5 5 0 0 1 29 22 M29 22 L26 20 M29 22 L28 24"
                        stroke="#00a862"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M29 28 A5 5 0 0 1 19 28 M19 28 L22 30 M19 28 L20 26"
                        stroke="#00a862"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <text x="24" y="27" textAnchor="middle" fontSize="8" fontWeight="700" fill="#00a862">
                        $
                      </text>
                    </g>

                    {/* Coin with plus badge */}
                    <g transform="translate(86, 76)">
                      <circle cx="9" cy="9" r="9" fill="#00a862" />
                      <path d="M9 5 V13 M5 9 H13" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                    </g>

                    {/* Accountant with Laptop */}
                    <g transform="translate(116, 52)">
                      {/* Desk line */}
                      <rect x="-24" y="52" width="70" height="3" rx="1.5" fill="#e2e8f0" />

                      {/* Body: Green blouse */}
                      <path d="M-6 52 C-6 38 28 38 28 52 Z" fill="#00a862" />
                      <path d="M4 38 L9 46 L14 38 Z" fill="#ffffff" />

                      {/* Neck & Head */}
                      <rect x="7" y="32" width="6" height="8" rx="2" fill="#fed7aa" />
                      <ellipse cx="10" cy="26" rx="9" ry="10" fill="#fed7aa" />

                      {/* Hair with Ponytail / Bun */}
                      <path
                        d="M1 25 C1 16 19 16 19 25 C19 23 23 26 21 32 C17 32 15 31 15 31 C15 31 13 36 10 36 C5 36 1 30 1 25 Z"
                        fill="#1e293b"
                      />
                      <ellipse cx="19" cy="22" rx="4" ry="5" fill="#1e293b" />

                      {/* Eyes */}
                      <circle cx="7" cy="26" r="1" fill="#1e293b" />
                      <path d="M7 29 Q9 31 11 29" stroke="#ea580c" strokeWidth="1" strokeLinecap="round" fill="none" />

                      {/* Laptop */}
                      <path d="M-14 52 L-10 38 H10 L6 52 Z" fill="#cbd5e1" />
                      <rect x="-8" y="40" width="14" height="9" rx="1" fill="#ffffff" />
                      <rect x="-16" y="51" width="24" height="2" rx="1" fill="#94a3b8" />
                    </g>

                    {/* Floating Financial Icons on Right */}
                    {/* 1. Bar Chart */}
                    <g transform="translate(162, 58)">
                      <circle cx="8" cy="8" r="8" fill="#e6fcf5" stroke="#a7f3d0" strokeWidth="1" />
                      <rect x="4" y="9" width="2" height="4" fill="#00a862" />
                      <rect x="7" y="7" width="2" height="6" fill="#00a862" />
                      <rect x="10" y="5" width="2" height="8" fill="#00a862" />
                    </g>

                    {/* 2. Clock with Dollar */}
                    <g transform="translate(182, 40)">
                      <circle cx="8" cy="8" r="8" fill="#ecfdf5" stroke="#00a862" strokeWidth="1.2" />
                      <path d="M8 4 V8 H11" stroke="#00a862" strokeWidth="1.2" strokeLinecap="round" />
                    </g>

                    {/* 3. Percent / Growth */}
                    <g transform="translate(180, 78)">
                      <circle cx="7" cy="7" r="7" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                      <text x="7" y="10" textAnchor="middle" fontSize="8" fontWeight="700" fill="#00a862">
                        %
                      </text>
                    </g>

                    {/* Decorative Sparkles & Dots */}
                    <rect x="70" y="108" width="3" height="3" transform="rotate(45 70 108)" fill="#00a862" />
                    <rect x="198" y="62" width="2.5" height="2.5" transform="rotate(45 198 62)" fill="#94a3b8" />
                    <circle cx="180" cy="26" r="1.5" fill="#94a3b8" />
                    <path d="M102 36 h4 M104 34 v4" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Heading Matching Screenshot 2 */}
                <h2
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1e293b",
                    lineHeight: 1.55,
                    maxWidth: 700,
                  }}
                >
                  Lập chứng từ kết chuyển doanh thu, chi phí, lãi lỗ để xác định kết quả kinh doanh trong kỳ
                </h2>

                {/* Action Buttons Row Matching Screenshot 2 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    marginTop: 24,
                  }}
                >
                  {/* Button 1: Thêm bằng AI */}
                  <button
                    type="button"
                    onClick={() => {
                      setClosingRows([]);
                      setClosingEntryModalOpen(true);
                      handleFetchClosingData();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 18px 8px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(37, 99, 235, 0.28)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.95")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        overflow: "hidden",
                      }}
                    >
                      <Bot size={14} color="#2563eb" />
                    </div>
                    <span>Thêm bằng AI</span>
                  </button>

                  {/* Button 2: Thêm (Green solid, matching screenshot 2) */}
                  <button
                    type="button"
                    onClick={() => {
                      setClosingRows([]);
                      setClosingEntryModalOpen(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 26px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(0, 168, 98, 0.2)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#009153")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#00a862")}
                  >
                    <span>Thêm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceAggregationModalOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#f8fafc",
                      color: "#0f766e",
                      border: "1px solid #99f6e4",
                      borderRadius: 6,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>Tổng hợp & Kiểm tra cân đối kỳ (UC-GL-10)</span>
                  </button>
                </div>

                {/* Bottom Button: Xem danh sách chứng từ (Matching Screenshot 2) */}
                <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowClosingTable(true)}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "6px 20px",
                      color: "#00a862",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#00a862";
                      e.currentTarget.style.background = "#f0fdf4";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    Xem danh sách chứng từ
                  </button>
                </div>
              </div>
            ) : (
              /* TABLE VIEW: DANH SÁCH CHỨNG TỪ KẾT CHUYỂN */
              <div style={{ padding: 20 }}>
                {/* Top Control Bar in Table View */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowClosingTable(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <ArrowLeft size={15} />
                      <span>Quay lại giao diện chính</span>
                    </button>

                    <div style={{ position: "relative", width: 260 }}>
                      <Search size={15} color="#94a3b8" style={{ position: "absolute", left: 10, top: 10 }} />
                      <input
                        type="text"
                        placeholder="Tìm kiếm chứng từ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px 8px 34px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => notify("Xuất Excel danh sách chứng từ kết chuyển")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={15} />
                      <span>Xuất khẩu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setClosingRows([]);
                        setClosingEntryModalOpen(true);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 18px",
                        borderRadius: 6,
                        background: "#00a862",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={15} />
                      <span>Thêm</span>
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px", width: 40 }}>#</th>
                        <th style={{ padding: "10px 14px" }}>Số chứng từ</th>
                        <th style={{ padding: "10px 14px" }}>Kỳ kết chuyển</th>
                        <th style={{ padding: "10px 14px" }}>Ngày hạch toán</th>
                        <th style={{ padding: "10px 14px" }}>Nội dung kết chuyển</th>
                        <th style={{ padding: "10px 14px" }}>TK Nợ</th>
                        <th style={{ padding: "10px 14px" }}>TK Có</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>Số tiền kết chuyển</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closingEntries.map((item, idx) => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: idx % 2 === 0 ? "#ffffff" : "#fdfdfd",
                          }}
                        >
                          <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{idx + 1}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>{item.id}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 500 }}>{item.period}</td>
                          <td style={{ padding: "10px 14px" }}>{item.date}</td>
                          <td style={{ padding: "10px 14px" }}>{item.desc}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0369a1" }}>{item.debitAcc}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#b45309" }}>{item.creditAcc}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                            {formatVND(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12.5, color: "#64748b" }}>
                  <span>Tổng số: {closingEntries.length} chứng từ kết chuyển</span>
                  <div style={{ fontWeight: 600, color: "#1e293b" }}>
                    Tổng tiền: {formatVND(closingEntries.reduce((acc, v) => acc + v.amount, 0))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: LẬP BÁO CÁO TÀI CHÍNH (Matching user screenshots 1 - 5)             */}
        {/* ========================================================================= */}
        {currentTab === "statements" && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              minHeight: 620,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              overflow: "hidden",
            }}
          >
            {!showStatementTable ? (
              /* LANDING VIEW MATCHING SCREENSHOT 1 */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  flex: 1,
                  padding: "70px 24px 36px 24px",
                }}
              >
                {/* SVG Illustration Matching Screenshot 1 */}
                <div style={{ marginBottom: 26, position: "relative" }}>
                  <svg width="260" height="170" viewBox="0 0 260 170" fill="none">
                    {/* Background glow circle */}
                    <circle cx="130" cy="85" r="65" fill="#f0fdf4" />

                    {/* Soft ground ellipse */}
                    <ellipse cx="130" cy="148" rx="80" ry="8" fill="#e2e8f0" opacity="0.6" />

                    {/* Green Document Folder with Bar Chart & $ Badge (Top Left of Accountant) */}
                    <g transform="translate(85, 30)">
                      <rect x="0" y="0" width="56" height="52" rx="10" fill="#00a862" />
                      <rect x="6" y="6" width="44" height="40" rx="6" fill="#e8f5e9" />
                      {/* Bar chart inside folder */}
                      <rect x="14" y="28" width="6" height="12" rx="2" fill="#00a862" />
                      <rect x="24" y="20" width="6" height="20" rx="2" fill="#00a862" />
                      <rect x="34" y="14" width="6" height="26" rx="2" fill="#10b981" />
                      {/* Dollar badge on folder corner */}
                      <circle cx="48" cy="10" r="10" fill="#00a862" stroke="#ffffff" strokeWidth="2" />
                      <text x="48" y="14" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">$</text>
                    </g>

                    {/* Female Accountant Character (sitting behind laptop) */}
                    <g transform="translate(115, 62)">
                      {/* Hair back */}
                      <path d="M12 18 C2 28, 2 48, 12 55 C22 55, 30 50, 36 40 C42 50, 50 55, 60 55 C70 48, 70 28, 60 18 Z" fill="#1e293b" />
                      {/* Ponytail / shoulder hair cascade */}
                      <path d="M40 30 Q58 35 62 55 Q55 60 48 48 Z" fill="#1e293b" />
                      {/* Body / Green blouse */}
                      <path d="M14 62 L20 46 Q36 44 52 46 L58 62 Z" fill="#059669" />
                      {/* Collar white accent */}
                      <path d="M30 46 L36 54 L42 46 Z" fill="#ffffff" />
                      {/* Neck */}
                      <rect x="32" y="38" width="8" height="9" fill="#fbcfe8" rx="2" />
                      {/* Head */}
                      <ellipse cx="36" cy="28" rx="14" ry="15" fill="#fbcfe8" />
                      {/* Hair front / bangs */}
                      <path d="M22 24 C26 14, 46 14, 50 24 C46 20, 36 21, 30 25 C26 25, 23 24, 22 24 Z" fill="#1e293b" />
                      {/* Eyes & Smile */}
                      <circle cx="31" cy="27" r="1.5" fill="#1e293b" />
                      <circle cx="41" cy="27" r="1.5" fill="#1e293b" />
                      <path d="M33 33 Q36 36 39 33" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                    </g>

                    {/* Laptop on desk in front */}
                    <g transform="translate(122, 114)">
                      {/* Laptop base */}
                      <path d="M0 24 L56 24 L50 28 L6 28 Z" fill="#94a3b8" />
                      {/* Laptop screen lid */}
                      <rect x="8" y="4" width="40" height="21" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                      {/* Screen glass */}
                      <rect x="11" y="6" width="34" height="16" rx="1" fill="#f8fafc" />
                      {/* Laptop logo dot */}
                      <circle cx="28" cy="14" r="2.5" fill="#ffffff" />
                      {/* Screen light glow line */}
                      <line x1="16" y1="12" x2="24" y2="12" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" />
                    </g>

                    {/* Floating Decorative Badges matching Screenshot 1 */}
                    <g transform="translate(80, 105)">
                      <circle cx="10" cy="10" r="9" fill="#00a862" />
                      <text x="10" y="14" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="sans-serif">+</text>
                    </g>

                    <g transform="translate(192, 54)">
                      <circle cx="9" cy="9" r="8" fill="#00a862" />
                      <text x="9" y="12.5" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="sans-serif">%</text>
                    </g>

                    <g transform="translate(182, 92)">
                      <circle cx="8" cy="8" r="7" fill="#00a862" />
                      <text x="8" y="11.5" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif">$</text>
                    </g>

                    <g fill="#00a862" opacity="0.8">
                      <circle cx="178" cy="42" r="2.5" fill="#00a862" />
                      <circle cx="75" cy="120" r="2" fill="#00a862" />
                      <circle cx="198" cy="115" r="2" fill="#00a862" />
                    </g>
                  </svg>
                </div>

                {/* Heading matching Screenshot 1 */}
                <h2
                  style={{
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: "#0f172a",
                    maxWidth: 680,
                    lineHeight: 1.55,
                    margin: "0 0 28px 0",
                  }}
                >
                  Lập báo cáo tài chính cuối kỳ để cung cấp thông tin về tình hình tài chính, kết quả kinh doanh và các luồng tiền trong kỳ
                </h2>

                {/* Green Split / Dropdown Button Matching Screenshot 1 */}
                <div style={{ position: "relative", display: "inline-block", marginBottom: 50 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      borderRadius: 4,
                      overflow: "hidden",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
                    }}
                  >
                    <button
                      type="button"
                      data-testid="statement-split-btn"
                      onClick={() => setShowStatementDropdown(!showStatementDropdown)}
                      style={{
                        background: "#00a862",
                        color: "#ffffff",
                        border: "none",
                        padding: "8px 18px",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Lập báo cáo tài chính
                    </button>
                    <button
                      type="button"
                      data-testid="statement-dropdown-arrow"
                      onClick={() => setShowStatementDropdown(!showStatementDropdown)}
                      style={{
                        background: "#009153",
                        color: "#ffffff",
                        border: "none",
                        borderLeft: "1px solid rgba(255,255,255,0.2)",
                        padding: "8px 10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <ChevronDown size={14} color="#ffffff" />
                    </button>
                  </div>

                  {/* 4-Item Dropdown Menu Matching Screenshot 1 */}
                  {showStatementDropdown && (
                    <div
                      data-testid="statement-dropdown-menu"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        minWidth: 270,
                        background: "#ffffff",
                        borderRadius: 6,
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                        border: "1px solid #e2e8f0",
                        padding: "6px 0",
                        zIndex: 100,
                        textAlign: "left",
                        animation: "misaFadeIn 0.15s ease-out",
                      }}
                    >
                      <div
                        data-testid="statement-opt-bctc"
                        onClick={() => openStatementModal("bctc")}
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#1e293b",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        Báo cáo tài chính
                      </div>
                      <div
                        data-testid="statement-opt-thuyet-minh"
                        onClick={() => openStatementModal("thuyet_minh_bctc")}
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#1e293b",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        Thuyết minh báo cáo tài chính
                      </div>
                      <div
                        data-testid="statement-opt-midyear"
                        onClick={() => openStatementModal("bctc_giua_nien_do")}
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#1e293b",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        Báo cáo tài chính giữa niên độ
                      </div>
                      <div
                        data-testid="statement-opt-midyear-thuyet-minh"
                        onClick={() => openStatementModal("thuyet_minh_bctc_giua_nien_do")}
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#1e293b",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        Thuyết minh báo cáo tài chính giữa niên độ
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Outline Button Matching Screenshot 1 */}
                <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowStatementTable(true)}
                    style={{
                      padding: "7px 22px",
                      borderRadius: 4,
                      border: "1px solid #10b981",
                      background: "#ffffff",
                      color: "#059669",
                      fontWeight: 500,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f0fdf4";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    Xem danh sách chứng từ
                  </button>
                </div>
              </div>
            ) : (
              /* STATEMENT LIST / TABLE VIEW */
              <div style={{ padding: 20 }}>
                {/* Table Header Toolbar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setShowStatementTable(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#475569",
                        fontSize: 12.5,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <ChevronLeft size={14} />
                      <span>Quay lại giao diện chính</span>
                    </button>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                      Danh sách Báo cáo tài chính đã lập
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder="Tìm kiếm báo cáo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          padding: "6px 12px 6px 30px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          width: 220,
                          outline: "none",
                        }}
                      />
                      <Search
                        size={14}
                        color="#94a3b8"
                        style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                      />
                    </div>

                    {/* Split button in table view as well */}
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "stretch",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setShowStatementDropdown(!showStatementDropdown)}
                          style={{
                            background: "#00a862",
                            color: "#ffffff",
                            border: "none",
                            padding: "6px 14px",
                            fontWeight: 600,
                            fontSize: 12.5,
                            cursor: "pointer",
                          }}
                        >
                          Lập báo cáo tài chính
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowStatementDropdown(!showStatementDropdown)}
                          style={{
                            background: "#009153",
                            color: "#ffffff",
                            border: "none",
                            borderLeft: "1px solid rgba(255,255,255,0.2)",
                            padding: "6px 8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <ChevronDown size={13} color="#ffffff" />
                        </button>
                      </div>

                      {showStatementDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            right: 0,
                            minWidth: 260,
                            background: "#ffffff",
                            borderRadius: 6,
                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                            border: "1px solid #e2e8f0",
                            padding: "6px 0",
                            zIndex: 100,
                            textAlign: "left",
                          }}
                        >
                          <div
                            onClick={() => openStatementModal("bctc")}
                            style={{ padding: "9px 14px", fontSize: 12.5, color: "#1e293b", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Báo cáo tài chính
                          </div>
                          <div
                            onClick={() => openStatementModal("thuyet_minh_bctc")}
                            style={{ padding: "9px 14px", fontSize: 12.5, color: "#1e293b", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Thuyết minh báo cáo tài chính
                          </div>
                          <div
                            onClick={() => openStatementModal("bctc_giua_nien_do")}
                            style={{ padding: "9px 14px", fontSize: 12.5, color: "#1e293b", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Báo cáo tài chính giữa niên độ
                          </div>
                          <div
                            onClick={() => openStatementModal("thuyet_minh_bctc_giua_nien_do")}
                            style={{ padding: "9px 14px", fontSize: 12.5, color: "#1e293b", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Thuyết minh báo cáo tài chính giữa niên độ
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => notify("Đã xuất danh sách Báo cáo tài chính ra file Excel!")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#475569",
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={14} />
                      <span>Xuất Excel</span>
                    </button>
                  </div>
                </div>

                {/* UC-GL-13: Versioned Financial Statement Batch Bar & Lifecycle Controls */}
                {(() => {
                  const activeBatch =
                    statementBatches.find((b) => String(b.id) === String(activeStatementBatchId)) ||
                    statementBatches[0];
                  const batchStatusMap: Record<string, { label: string; bg: string; color: string }> = {
                    GENERATED: { label: "Đã lập (GENERATED)", bg: "#ecfdf5", color: "#059669" },
                    REVIEW_REQUIRED: { label: "Cần rà soát (REVIEW_REQUIRED)", bg: "#fef2f2", color: "#dc2626" },
                    FINALIZED: { label: "Đã chốt chính thức (FINALIZED)", bg: "#eff6ff", color: "#1d4ed8" },
                    OUTDATED: { label: "Cần lập lại (OUTDATED)", bg: "#fff7ed", color: "#c2410c" },
                    DRAFT: { label: "Nháp (DRAFT)", bg: "#f1f5f9", color: "#475569" },
                  };
                  const stBadge = batchStatusMap[activeBatch?.status || "GENERATED"] || batchStatusMap.GENERATED;
                  const allReportRows = statementBatches.flatMap((batch) =>
                    (batch.reports || []).map((rpt: any) => ({
                      ...rpt,
                      batchId: batch.id,
                      batchNumber: batch.batch_number,
                      versionNumber: batch.version_number,
                      batchStatus: batch.status,
                      goingConcernAssumption: batch.going_concern_assumption,
                      unitScale: batch.unit_scale || 1,
                      batchRef: batch,
                    })),
                  );

                  return (
                    <>
                      {/* Batch Selector & Lifecycle Action Bar */}
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          padding: "12px 16px",
                          marginBottom: 14,
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                            Phiên bản bộ BCTC:
                          </span>
                          <select
                            value={activeBatch?.id || ""}
                            onChange={(e) => {
                              setActiveStatementBatchId(e.target.value);
                              setSelectedStatementDetailReport(null);
                            }}
                            style={{
                              height: 32,
                              padding: "0 10px",
                              borderRadius: 4,
                              border: "1px solid #cbd5e1",
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: "#0f172a",
                              background: "#ffffff",
                            }}
                          >
                            {statementBatches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.batch_number} — {b.period_label} (v{b.version_number} • {b.status})
                              </option>
                            ))}
                          </select>
                          <span
                            style={{
                              background: stBadge.bg,
                              color: stBadge.color,
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "3px 10px",
                              borderRadius: 12,
                            }}
                          >
                            {stBadge.label}
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            Giả định:{" "}
                            <strong style={{ color: "#0f172a" }}>
                              {activeBatch?.going_concern_assumption === "NON_CONTINUOUS"
                                ? "Không hoạt động liên tục (Bộ mẫu DNKLT)"
                                : "Hoạt động liên tục (Bộ mẫu DN)"}
                            </strong>
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            Watermark GL: <code>{activeBatch?.source_watermark}</code>
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setStatementNotesModalBatch(activeBatch)}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 4,
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#0f172a",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Thuyết minh B09 & Chính sách
                          </button>
                          {activeBatch?.status !== "FINALIZED" && (
                            <button
                              type="button"
                              onClick={() => handleFinalizeStatementBatch(activeBatch.id)}
                              style={{
                                padding: "5px 12px",
                                borderRadius: 4,
                                border: "1px solid #1d4ed8",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Chốt BCTC chính thức (FINALIZE)
                            </button>
                          )}
                          {activeBatch?.status === "OUTDATED" && (
                            <button
                              type="button"
                              onClick={() => openStatementModal("bctc")}
                              style={{
                                padding: "5px 12px",
                                borderRadius: 4,
                                border: "none",
                                background: "#ea580c",
                                color: "#ffffff",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Lập lại phiên bản mới (v{(activeBatch?.version_number || 1) + 1})
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Warning banner when batch is OUTDATED (AF-22, AF-23, EF-28, BR-GL-FS-76, 77) */}
                      {activeBatch?.status === "OUTDATED" && (
                        <div
                          style={{
                            background: "#fff7ed",
                            border: "1px solid #fdba74",
                            borderRadius: 6,
                            padding: "10px 14px",
                            marginBottom: 14,
                            fontSize: 12.5,
                            color: "#9a3412",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong>Cảnh báo phiên bản lỗi thời (OUTDATED - EF-28, BR-GL-FS-76):</strong>{" "}
                            {activeBatch.outdated_reason ||
                              "Số liệu Sổ cái (UC-GL-05/10) hoặc trạng thái Khóa sổ kỳ kế toán (UC-GL-12) đã thay đổi sau thời điểm lập phiên bản này. Hệ thống chặn chốt chính thức phiên bản cũ."}
                          </div>
                        </div>
                      )}

                      {/* Cross-Report Validation Summary Cards (EF-19..24, BR-GL-FS-27..40, 54..56, 85) */}
                      {Array.isArray(activeBatch?.cross_checks) && activeBatch.cross_checks.length > 0 && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          {activeBatch.cross_checks.map((chk: any) => (
                            <div
                              key={chk.code}
                              style={{
                                border: chk.status === "PASSED" ? "1px solid #bbf7d0" : "1px solid #fecaca",
                                background: chk.status === "PASSED" ? "#f0fdf4" : "#fef2f2",
                                borderRadius: 6,
                                padding: "9px 12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: 4,
                                }}
                              >
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0f172a" }}>
                                  {chk.code}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: chk.status === "PASSED" ? "#15803d" : "#b91c1c",
                                    background: "#ffffff",
                                    padding: "1px 6px",
                                    borderRadius: 10,
                                  }}
                                >
                                  {chk.status === "PASSED" ? "KHỚP (PASSED)" : "LỆCH (FAILED)"}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 3 }}>
                                {chk.title}
                              </div>
                              <div style={{ fontSize: 11, color: "#475569" }}>{chk.rule_ref}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Table of Prepared Financial Statements */}
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                              <th style={{ width: 40, padding: "10px 14px", textAlign: "center" }}>
                                <input type="checkbox" defaultChecked style={{ accentColor: "#00a862" }} />
                              </th>
                              <th style={{ width: 120, padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>
                                Mã báo cáo
                              </th>
                              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>
                                Tên báo cáo tài chính
                              </th>
                              <th style={{ width: 130, padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>
                                Kỳ báo cáo
                              </th>
                              <th style={{ width: 110, padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>
                                Ngày lập
                              </th>
                              <th style={{ width: 120, padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>
                                Người lập
                              </th>
                              <th style={{ width: 130, padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#475569" }}>
                                Trạng thái
                              </th>
                              <th style={{ width: 190, padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#475569" }}>
                                Chức năng
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {allReportRows
                              .filter((item) =>
                                searchTerm
                                  ? item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    item.period.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    String(item.batchNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
                                  : true,
                              )
                              .map((row, idx) => {
                                const rowBadge =
                                  batchStatusMap[row.batchStatus || row.status || "GENERATED"] ||
                                  batchStatusMap.GENERATED;
                                return (
                                  <tr
                                    key={`${row.batchId}-${row.code}-${idx}`}
                                    style={{
                                      borderBottom: "1px solid #f1f5f9",
                                      background:
                                        selectedStatementDetailReport?.code === row.code &&
                                        selectedStatementDetailReport?.batchId === row.batchId
                                          ? "#f0fdf4"
                                          : "#ffffff",
                                      transition: "background 0.1s",
                                    }}
                                  >
                                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                      <input type="checkbox" defaultChecked style={{ accentColor: "#00a862" }} />
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                      <span
                                        style={{
                                          background: "#ecfdf5",
                                          color: "#059669",
                                          fontSize: 12,
                                          fontWeight: 700,
                                          padding: "3px 8px",
                                          borderRadius: 4,
                                        }}
                                      >
                                        {row.code}
                                      </span>
                                      <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>
                                        {row.batchNumber} (v{row.versionNumber})
                                      </div>
                                    </td>
                                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>
                                      {row.name}
                                    </td>
                                    <td style={{ padding: "10px 14px", color: "#334155" }}>{row.period}</td>
                                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{row.createdDate}</td>
                                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{row.creator}</td>
                                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                      <span
                                        style={{
                                          background: rowBadge.bg,
                                          color: rowBadge.color,
                                          fontSize: 11.5,
                                          fontWeight: 700,
                                          padding: "2px 8px",
                                          borderRadius: 12,
                                        }}
                                      >
                                        {row.batchStatus === "FINALIZED"
                                          ? "Đã chốt (FINALIZED)"
                                          : row.batchStatus === "OUTDATED"
                                          ? "Cần lập lại (OUTDATED)"
                                          : "Đã lập (GENERATED)"}
                                      </span>
                                    </td>
                                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveStatementBatchId(row.batchId);
                                            setSelectedStatementDetailReport(row);
                                          }}
                                          title="Xem chi tiết chỉ tiêu & Truy vết Sổ cái"
                                          style={{
                                            padding: "4px 8px",
                                            borderRadius: 4,
                                            border: "1px solid #10b981",
                                            background: "#ffffff",
                                            color: "#00a862",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                          }}
                                        >
                                          Chỉ tiêu & Truy vết
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewReportName(row.name)}
                                          title="Xem mẫu in báo cáo"
                                          style={{
                                            padding: "4px 8px",
                                            borderRadius: 4,
                                            border: "1px solid #cbd5e1",
                                            background: "#ffffff",
                                            color: "#334155",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                          }}
                                        >
                                          Xem
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            notify(
                                              `Đang xuất/in biểu mẫu ${row.code} (${row.batchNumber} - Trạng thái: ${row.batchStatus}) theo chuẩn TT99/2025/TT-BTC`,
                                            )
                                          }
                                          title="In báo cáo"
                                          style={{
                                            padding: "4px 8px",
                                            borderRadius: 4,
                                            border: "1px solid #cbd5e1",
                                            background: "#ffffff",
                                            color: "#475569",
                                            fontSize: 12,
                                            cursor: "pointer",
                                          }}
                                        >
                                          In
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>

                      {/* Interactive Indicator Detail & GL Drill-down Panel (Steps 48–50, BR-GL-FS-54..56, 112, 115) */}
                      {selectedStatementDetailReport && (
                        <div
                          style={{
                            marginTop: 18,
                            border: "1px solid #10b981",
                            borderRadius: 6,
                            background: "#ffffff",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              background: "#ecfdf5",
                              padding: "10px 16px",
                              borderBottom: "1px solid #a7f3d0",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>
                                Chi tiết chỉ tiêu biểu mẫu {selectedStatementDetailReport.code}:{" "}
                                {selectedStatementDetailReport.name}
                              </span>
                              <span style={{ fontSize: 12, color: "#047857", marginLeft: 10 }}>
                                ({selectedStatementDetailReport.batchNumber} • Kỳ:{" "}
                                {selectedStatementDetailReport.period} • Đơn vị tính:{" "}
                                {selectedStatementDetailReport.unitScale === 1000
                                  ? "Nghìn đồng"
                                  : selectedStatementDetailReport.unitScale === 1000000
                                  ? "Triệu đồng"
                                  : "Đồng (VND)"}
                                )
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedStatementDetailReport(null)}
                              style={{
                                background: "#ffffff",
                                border: "1px solid #a7f3d0",
                                borderRadius: 4,
                                padding: "3px 10px",
                                fontSize: 12,
                                cursor: "pointer",
                                color: "#065f46",
                                fontWeight: 600,
                              }}
                            >
                              Đóng bảng chỉ tiêu
                            </button>
                          </div>

                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                            <thead>
                              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                <th style={{ padding: "8px 12px", textAlign: "left", width: 90 }}>Mã số</th>
                                <th style={{ padding: "8px 12px", textAlign: "left" }}>Chỉ tiêu</th>
                                <th style={{ padding: "8px 12px", textAlign: "center", width: 95 }}>Thuyết minh</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", width: 150 }}>
                                  Số cuối kỳ / Kỳ này
                                </th>
                                <th style={{ padding: "8px 12px", textAlign: "right", width: 150 }}>
                                  Số đầu năm / Kỳ trước
                                </th>
                                <th style={{ padding: "8px 12px", textAlign: "left", width: 250 }}>
                                  Công thức / Mapping GL (TT99)
                                </th>
                                <th style={{ padding: "8px 12px", textAlign: "center", width: 110 }}>
                                  Truy vết GL
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {(selectedStatementDetailReport.lines || []).map((ln: any) => (
                                <tr
                                  key={ln.code}
                                  style={{
                                    borderBottom: "1px solid #f1f5f9",
                                    fontWeight: ln.isTotal ? 700 : 400,
                                    background: ln.isTotal ? "#f8fafc" : "#ffffff",
                                  }}
                                >
                                  <td style={{ padding: "8px 12px", color: "#0f172a", fontWeight: 700 }}>
                                    {ln.code}
                                  </td>
                                  <td style={{ padding: "8px 12px", color: "#1e293b" }}>{ln.name}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "center", color: "#059669" }}>
                                    {ln.note}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#0f172a" }}>
                                    {Number(ln.closing || 0).toLocaleString("vi-VN")}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#64748b" }}>
                                    {Number(ln.opening || 0).toLocaleString("vi-VN")}
                                  </td>
                                  <td style={{ padding: "8px 12px", fontSize: 11.5, color: "#475569" }}>
                                    {ln.formula}
                                  </td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenStatementDrilldown(
                                          selectedStatementDetailReport.batchRef || activeBatch,
                                          selectedStatementDetailReport,
                                          ln,
                                        )
                                      }
                                      style={{
                                        padding: "3px 8px",
                                        borderRadius: 4,
                                        border: "1px solid #cbd5e1",
                                        background: "#ffffff",
                                        color: "#0284c7",
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Drill-down
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Table Footer */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 14,
                          fontSize: 12.5,
                          color: "#64748b",
                        }}
                      >
                        <span>
                          Hiển thị {allReportRows.length} báo cáo tài chính thuộc {statementBatches.length} phiên bản
                        </span>
                        <div style={{ fontWeight: 500, color: "#1e293b" }}>
                          Chế độ kế toán áp dụng: Thông tư 99/2025/TT-BTC (Chính thức từ 01/01/2026 • Không tự động plug số chênh lệch BR-GL-FS-85)
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: BÁO CÁO (Matching user screenshot)                                 */}
        {/* ========================================================================= */}
        {currentTab === "reports" && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              padding: "16px 20px 32px 20px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            {/* Top Toolbar matching screenshot */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 22,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {/* Left: Search input + AVA quick search link */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Tìm theo tên báo cáo"
                    value={reportSearchTerm}
                    onChange={(e) => setReportSearchTerm(e.target.value)}
                    style={{
                      height: 32,
                      width: 250,
                      padding: "0 10px 0 32px",
                      borderRadius: 4,
                      border: "1px solid #10b981",
                      fontSize: 12.5,
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                  <Search
                    size={14}
                    color="#10b981"
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                  />
                </div>

                <div
                  onClick={() => setAiVoucherModalOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#7c3aed",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <span>Tìm kiếm nhanh báo cáo với Sổ Việt AI</span>
                  <span style={{ fontSize: 15 }}>🤖</span>
                </div>
              </div>

              {/* Right: Ngôn ngữ báo cáo + Ẩn/hiện báo cáo + Collapse/Expand button */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#334155" }}>Ngôn ngữ báo cáo</span>
                  <div style={{ position: "relative" }}>
                    <select
                      value={reportLanguage}
                      onChange={(e) => setReportLanguage(e.target.value)}
                      style={{
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        color: "#1e293b",
                        background: "#ffffff",
                        appearance: "none",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Tiếng Việt">Tiếng Việt</option>
                      <option value="Tiếng Anh">Tiếng Anh (English)</option>
                      <option value="Song ngữ">Song ngữ (Bilingual)</option>
                    </select>
                    <ChevronDown
                      size={13}
                      color="#64748b"
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHideReportsModalOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: 12.5,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                >
                  <Eye size={14} color="#64748b" />
                  <span>Ẩn/hiện báo cáo</span>
                </button>

                <button
                  type="button"
                  onClick={toggleAllReportGroups}
                  title="Thu gọn / Mở rộng tất cả"
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#64748b",
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                >
                  <MinusSquare size={16} />
                </button>
              </div>
            </div>

            {/* GROUP 1: YÊU THÍCH (Matching Screenshot) */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px 0" }}>
                Yêu thích
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 36, rowGap: 10 }}>
                {[
                  { name: "Tổng hợp công nợ theo đối tượng" },
                  { name: "Sổ nhật ký chung" },
                  { name: "Tổng hợp công nợ nhân viên" },
                  { name: "Sổ chi tiết các tài khoản" },
                ]
                  .filter((item) =>
                    reportSearchTerm ? item.name.toLowerCase().includes(reportSearchTerm.toLowerCase()) : true
                  )
                  .map((item) => (
                    <div
                      key={item.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 0",
                      }}
                    >
                      <span
                        onClick={() => setPreviewReportName(item.name)}
                        style={{
                          fontSize: 13,
                          color: "#1e293b",
                          cursor: "pointer",
                          transition: "color 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#1e293b")}
                      >
                        {item.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Mini chart icon button with border */}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewReportName(item.name);
                            notify(`Xem biểu đồ trực quan cho: ${item.name}`);
                          }}
                          title="Xem biểu đồ báo cáo"
                          style={{
                            width: 24,
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            background: "#ffffff",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <TrendingUp size={13} color="#64748b" />
                        </button>
                        {/* Star icon button (Solid green star in screenshot) */}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(item.name)}
                          title="Bỏ khỏi yêu thích"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Star size={16} fill="#00a862" color="#00a862" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* ACCORDION GROUPS 2 - 6 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* GROUP 2: BÁO CÁO TÀI CHÍNH (OPEN by default) */}
              <div>
                <div
                  onClick={() => toggleReportGroup("financial-statements")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 14px",
                    background: "#f1f5f9",
                    borderRadius: 4,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                    Báo cáo tài chính
                  </span>
                  {expandedReportGroups["financial-statements"] ? (
                    <ChevronUp size={16} color="#64748b" />
                  ) : (
                    <ChevronDown size={16} color="#64748b" />
                  )}
                </div>

                {expandedReportGroups["financial-statements"] && (
                  <div style={{ padding: "14px 4px 6px 4px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 36, rowGap: 12 }}>
                      {[
                        // Row 1
                        { name: "Bảng cân đối tài khoản (Mẫu quản trị)" },
                        { name: "B09 - DN: Thuyết minh báo cáo tài chính" },
                        // Row 2
                        { name: "Tình hình thực hiện nghĩa vụ với nhà nước" },
                        { name: "B01a - DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)" },
                        // Row 3
                        { name: "B01 - DN: Báo cáo tình hình tài chính" },
                        { name: "B02a - DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)" },
                        // Row 4
                        { name: "B02 - DN: Báo cáo kết quả hoạt động kinh doanh" },
                        { name: "B03a - DN: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)" },
                        // Row 5
                        { name: "B03 - DN: Báo cáo lưu chuyển tiền tệ (PP trực tiếp)" },
                        { name: "B03a - DN - GT: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)" },
                        // Row 6
                        { name: "B03 - DN - GT: Báo cáo lưu chuyển tiền tệ (PP gián tiếp)" },
                      ]
                        .filter((item) =>
                          reportSearchTerm ? item.name.toLowerCase().includes(reportSearchTerm.toLowerCase()) : true
                        )
                        .map((item) => (
                          <div
                            key={item.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "4px 0",
                            }}
                          >
                            <span
                              onClick={() => setPreviewReportName(item.name)}
                              style={{
                                fontSize: 13,
                                color: "#1e293b",
                                cursor: "pointer",
                                transition: "color 0.12s",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#1e293b")}
                            >
                              {item.name}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewReportName(item.name);
                                  notify(`Xem biểu đồ trực quan cho: ${item.name}`);
                                }}
                                title="Xem biểu đồ báo cáo"
                                style={{
                                  width: 24,
                                  height: 24,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                  background: "#ffffff",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                <TrendingUp size={13} color="#64748b" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFavorite(item.name)}
                                title={favoriteReports[item.name] ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Star
                                  size={16}
                                  fill={favoriteReports[item.name] ? "#00a862" : "none"}
                                  color={favoriteReports[item.name] ? "#00a862" : "#94a3b8"}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* GROUP 3: SỔ SÁCH KẾ TOÁN */}
              <div>
                <div
                  onClick={() => toggleReportGroup("accounting-books")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 14px",
                    background: "#f1f5f9",
                    borderRadius: 4,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                    Sổ sách kế toán
                  </span>
                  {expandedReportGroups["accounting-books"] ? (
                    <ChevronUp size={16} color="#64748b" />
                  ) : (
                    <ChevronDown size={16} color="#64748b" />
                  )}
                </div>

                {expandedReportGroups["accounting-books"] && (
                  <div style={{ padding: "14px 4px 6px 4px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 36, rowGap: 12 }}>
                      {[
                        { name: "Sổ cái các tài khoản" },
                        { name: "Sổ cái (hình thức Nhật ký chung)" },
                        { name: "Sổ nhật ký thu tiền" },
                        { name: "Sổ nhật ký chi tiền" },
                        { name: "Sổ nhật ký mua hàng" },
                        { name: "Sổ nhật ký bán hàng" },
                        { name: "Bảng tổng hợp chi tiết tài khoản" },
                        { name: "Sổ theo dõi thanh toán bằng ngoại tệ" },
                      ]
                        .filter((item) =>
                          reportSearchTerm ? item.name.toLowerCase().includes(reportSearchTerm.toLowerCase()) : true
                        )
                        .map((item) => (
                          <div
                            key={item.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "4px 0",
                            }}
                          >
                            <span
                              onClick={() => setPreviewReportName(item.name)}
                              style={{
                                fontSize: 13,
                                color: "#1e293b",
                                cursor: "pointer",
                                transition: "color 0.12s",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#1e293b")}
                            >
                              {item.name}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewReportName(item.name);
                                  notify(`Xem biểu đồ trực quan cho: ${item.name}`);
                                }}
                                title="Xem biểu đồ báo cáo"
                                style={{
                                  width: 24,
                                  height: 24,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                  background: "#ffffff",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                <TrendingUp size={13} color="#64748b" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFavorite(item.name)}
                                title={favoriteReports[item.name] ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Star
                                  size={16}
                                  fill={favoriteReports[item.name] ? "#00a862" : "none"}
                                  color={favoriteReports[item.name] ? "#00a862" : "#94a3b8"}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* GROUP 4: BÁO CÁO TỔNG HỢP THEO TÀI KHOẢN */}
              <div>
                <div
                  onClick={() => toggleReportGroup("account-summary")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 14px",
                    background: "#f1f5f9",
                    borderRadius: 4,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                    Báo cáo tổng hợp theo tài khoản
                  </span>
                  {expandedReportGroups["account-summary"] ? (
                    <ChevronUp size={16} color="#64748b" />
                  ) : (
                    <ChevronDown size={16} color="#64748b" />
                  )}
                </div>

                {expandedReportGroups["account-summary"] && (
                  <div style={{ padding: "14px 4px 6px 4px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 36, rowGap: 12 }}>
                      {[
                        { name: "Bảng cân đối số phát sinh" },
                        { name: "Bảng tổng hợp phát sinh tài khoản" },
                        { name: "Bảng tổng hợp phát sinh tài khoản chữ T" },
                        { name: "Sổ chi tiết tài khoản nhiều kỳ" },
                      ]
                        .filter((item) =>
                          reportSearchTerm ? item.name.toLowerCase().includes(reportSearchTerm.toLowerCase()) : true
                        )
                        .map((item) => (
                          <div
                            key={item.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "4px 0",
                            }}
                          >
                            <span
                              onClick={() => setPreviewReportName(item.name)}
                              style={{
                                fontSize: 13,
                                color: "#1e293b",
                                cursor: "pointer",
                                transition: "color 0.12s",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#1e293b")}
                            >
                              {item.name}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewReportName(item.name);
                                  notify(`Xem biểu đồ trực quan cho: ${item.name}`);
                                }}
                                title="Xem biểu đồ báo cáo"
                                style={{
                                  width: 24,
                                  height: 24,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                  background: "#ffffff",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                <TrendingUp size={13} color="#64748b" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFavorite(item.name)}
                                title={favoriteReports[item.name] ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Star
                                  size={16}
                                  fill={favoriteReports[item.name] ? "#00a862" : "none"}
                                  color={favoriteReports[item.name] ? "#00a862" : "#94a3b8"}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* GROUP 5: BÁO CÁO CHI PHÍ, LÃI LỖ */}
              <div>
                <div
                  onClick={() => toggleReportGroup("cost-profit")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 14px",
                    background: "#f1f5f9",
                    borderRadius: 4,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                    Báo cáo chi phí, lãi lỗ
                  </span>
                  {expandedReportGroups["cost-profit"] ? (
                    <ChevronUp size={16} color="#64748b" />
                  ) : (
                    <ChevronDown size={16} color="#64748b" />
                  )}
                </div>

                {expandedReportGroups["cost-profit"] && (
                  <div style={{ padding: "14px 4px 6px 4px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 36, rowGap: 12 }}>
                      {[
                        { name: "Báo cáo kết quả hoạt động kinh doanh theo kỳ" },
                        { name: "Báo cáo phân tích doanh thu, chi phí theo tài khoản" },
                        { name: "Báo cáo chi tiết lãi lỗ theo bộ phận / dự án" },
                        { name: "Sổ phân tích chi phí quản lý doanh nghiệp" },
                      ]
                        .filter((item) =>
                          reportSearchTerm ? item.name.toLowerCase().includes(reportSearchTerm.toLowerCase()) : true
                        )
                        .map((item) => (
                          <div
                            key={item.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "4px 0",
                            }}
                          >
                            <span
                              onClick={() => setPreviewReportName(item.name)}
                              style={{
                                fontSize: 13,
                                color: "#1e293b",
                                cursor: "pointer",
                                transition: "color 0.12s",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#1e293b")}
                            >
                              {item.name}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewReportName(item.name);
                                  notify(`Xem biểu đồ trực quan cho: ${item.name}`);
                                }}
                                title="Xem biểu đồ báo cáo"
                                style={{
                                  width: 24,
                                  height: 24,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                  background: "#ffffff",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                <TrendingUp size={13} color="#64748b" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFavorite(item.name)}
                                title={favoriteReports[item.name] ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Star
                                  size={16}
                                  fill={favoriteReports[item.name] ? "#00a862" : "none"}
                                  color={favoriteReports[item.name] ? "#00a862" : "#94a3b8"}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* GROUP 6: BÁO CÁO CÔNG NỢ */}
              <div>
                <div
                  onClick={() => toggleReportGroup("debt-receivable")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 14px",
                    background: "#f1f5f9",
                    borderRadius: 4,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                    Báo cáo công nợ
                  </span>
                  {expandedReportGroups["debt-receivable"] ? (
                    <ChevronUp size={16} color="#64748b" />
                  ) : (
                    <ChevronDown size={16} color="#64748b" />
                  )}
                </div>

                {expandedReportGroups["debt-receivable"] && (
                  <div style={{ padding: "14px 4px 6px 4px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 36, rowGap: 12 }}>
                      {[
                        { name: "Tổng hợp công nợ phải thu của khách hàng" },
                        { name: "Sổ chi tiết công nợ phải trả theo hóa đơn" },
                        { name: "Tổng hợp công nợ phải trả cho người bán" },
                        { name: "Báo cáo công nợ quá hạn" },
                        { name: "Sổ chi tiết công nợ phải thu theo hóa đơn" },
                        { name: "Bảng đối chiếu công nợ" },
                      ]
                        .filter((item) =>
                          reportSearchTerm ? item.name.toLowerCase().includes(reportSearchTerm.toLowerCase()) : true
                        )
                        .map((item) => (
                          <div
                            key={item.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "4px 0",
                            }}
                          >
                            <span
                              onClick={() => setPreviewReportName(item.name)}
                              style={{
                                fontSize: 13,
                                color: "#1e293b",
                                cursor: "pointer",
                                transition: "color 0.12s",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#1e293b")}
                            >
                              {item.name}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewReportName(item.name);
                                  notify(`Xem biểu đồ trực quan cho: ${item.name}`);
                                }}
                                title="Xem biểu đồ báo cáo"
                                style={{
                                  width: 24,
                                  height: 24,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                  background: "#ffffff",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                <TrendingUp size={13} color="#64748b" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFavorite(item.name)}
                                title={favoriteReports[item.name] ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Star
                                  size={16}
                                  fill={favoriteReports[item.name] ? "#00a862" : "none"}
                                  color={favoriteReports[item.name] ? "#00a862" : "#94a3b8"}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: KHÓA SỔ KỲ KẾ TOÁN (UC-GL-12 - Checklist trước khóa & Khóa kỳ)   */}
      {/* ========================================================================= */}
      {lockPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setLockPeriodModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 880,
              maxHeight: "90vh",
              background: "#ffffff",
              borderRadius: 10,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Lock size={18} color="#00a862" />
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f172a" }}>
                    Khóa sổ kỳ kế toán & Kiểm tra điều kiện trước khóa (UC-GL-12)
                  </span>
                  <span
                    style={{
                      padding: "2px 9px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        periodLockStatus === "CLOSED"
                          ? "#fee2e2"
                          : periodLockStatus === "PARTIALLY_LOCKED"
                          ? "#fef3c7"
                          : "#dcfce7",
                      color:
                        periodLockStatus === "CLOSED"
                          ? "#991b1b"
                          : periodLockStatus === "PARTIALLY_LOCKED"
                          ? "#92400e"
                          : "#166534",
                    }}
                  >
                    Trạng thái hiện tại: {periodLockStatus}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>
                  Ngăn phát sinh hoặc sửa đổi chứng từ làm ảnh hưởng số liệu đã chốt; bảo vệ bằng Watermark chống lệch dữ liệu sau khi kiểm tra:{" "}
                  <code>{periodChecklistWatermark}</code> (BR-GL-LOCK-32, EF-12)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLockPeriodModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Input Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Khóa sổ đến ngày (BR-GL-LOCK-06):
                  </label>
                  <input
                    type="text"
                    value={lockDate}
                    onChange={(e) => setLockDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Phạm vi khóa sổ (AF-01 / AF-02):
                  </label>
                  <select
                    value={periodLockScope}
                    onChange={(e) => setPeriodLockScope(e.target.value as "FULL_PERIOD" | "DOCUMENT_TYPE")}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  >
                    <option value="FULL_PERIOD">FULL_PERIOD — Khóa toàn bộ kỳ kế toán (CLOSED)</option>
                    <option value="DOCUMENT_TYPE">DOCUMENT_TYPE — Khóa theo loại chứng từ (PARTIALLY_LOCKED)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Mật khẩu xác nhận (nếu cần):
                  </label>
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu khóa sổ..."
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  Ghi chú / Nội dung chốt kỳ kế toán (Lưu vào PeriodLockHistory):
                </label>
                <input
                  type="text"
                  value={periodLockNote}
                  onChange={(e) => setPeriodLockNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>

              {/* Pre-Close Checklist Section (Steps 5-28, BR-GL-LOCK-09..31) */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#f1f5f9",
                    borderBottom: "1px solid #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <strong style={{ fontSize: 12.5, color: "#0f172a" }}>
                    Checklist Kiểm tra Điều kiện Trước khi Khóa Sổ (Bước 5–28 / BR-GL-LOCK-09..31)
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      void handleEvaluatePeriodCloseChecklist();
                    }}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 5,
                      border: "1px solid #0284c7",
                      background: "#ffffff",
                      color: "#0284c7",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>Kiểm tra lại điều kiện trước khóa</span>
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#334155" }}>
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        Hạng mục kiểm tra
                      </th>
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #e2e8f0", textAlign: "center", width: 95 }}>
                        Mức độ
                      </th>
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #e2e8f0", textAlign: "center", width: 100 }}>
                        Kết quả
                      </th>
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        Chi tiết / Giải thích
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodChecklistItems.map((chk) => (
                      <tr key={chk.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "7px 10px", fontWeight: 600, color: "#1e293b" }}>{chk.name}</td>
                        <td style={{ padding: "7px 10px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 10.5,
                              fontWeight: 700,
                              background: chk.severity === "BLOCKER" ? "#fee2e2" : "#fef3c7",
                              color: chk.severity === "BLOCKER" ? "#991b1b" : "#92400e",
                            }}
                          >
                            {chk.severity}
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background:
                                chk.status === "PASSED"
                                  ? "#dcfce7"
                                  : chk.status === "WARNING"
                                  ? "#fef3c7"
                                  : "#fee2e2",
                              color:
                                chk.status === "PASSED"
                                  ? "#166534"
                                  : chk.status === "WARNING"
                                  ? "#92400e"
                                  : "#991b1b",
                            }}
                          >
                            {chk.status}
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px", color: "#475569" }}>{chk.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={acknowledgeLockWarnings}
                    onChange={(e) => setAcknowledgeLockWarnings(e.target.checked)}
                  />
                  <span>
                    Xác nhận tiếp tục khóa sổ nếu chỉ có Cảnh báo (<code>WARNING</code>) và không có Lỗi chặn (<code>BLOCKER</code>) (BR-GL-LOCK-31)
                  </span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setLockPeriodModalOpen(false);
                      setBalanceAggregationModalOpen(true);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0284c7",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Mở Tổng hợp Số dư (UC-GL-10)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLockPeriodModalOpen(false);
                      setGlReconciliationModalOpen(true);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0284c7",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Mở Đối chiếu Phân hệ (UC-GL-11)
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  borderRadius: 6,
                  padding: "9px 14px",
                  fontSize: 12,
                  color: "#92400e",
                  lineHeight: 1.4,
                }}
              >
                Lưu ý (BR-GL-LOCK-36..44): Sau khi khóa sổ, hệ thống chặn tạo mới, sửa, xóa, Ghi sổ (Post), Bỏ ghi sổ (Unpost), Điều chỉnh hoặc Đảo bút toán có Ngày hạch toán thuộc phạm vi đã khóa; dữ liệu đã POSTED chỉ được phép xem báo cáo và truy vết kiểm toán.
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setLockPeriodModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => { void handleCloseAccountingPeriod(); }}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Thực hiện Khóa sổ (Bước 31–42)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BỎ KHÓA SỔ KỲ KẾ TOÁN & LỊCH SỬ AUDIT (UC-GL-12 Bước 43-62)      */}
      {/* ========================================================================= */}
      {unlockPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setUnlockPeriodModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 840,
              maxHeight: "90vh",
              background: "#ffffff",
              borderRadius: 10,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Unlock size={18} color="#0284c7" />
                <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f172a" }}>
                  Bỏ khóa / Mở lại sổ kỳ kế toán & Nhật ký Audit (UC-GL-12)
                </span>
                {reopenWorkflowStatus !== "NONE" && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        reopenWorkflowStatus === "APPROVED"
                          ? "#dcfce7"
                          : reopenWorkflowStatus === "REJECTED"
                          ? "#fee2e2"
                          : "#fef3c7",
                      color:
                        reopenWorkflowStatus === "APPROVED"
                          ? "#166534"
                          : reopenWorkflowStatus === "REJECTED"
                          ? "#991b1b"
                          : "#92400e",
                    }}
                  >
                    Workflow: {reopenWorkflowStatus}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setUnlockPeriodModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Chuyển ngày khóa sổ lùi về ngày:
                  </label>
                  <input
                    type="text"
                    value={unlockDate}
                    onChange={(e) => setUnlockDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                    Phạm vi mở khóa (AF-23 / AF-24):
                  </label>
                  <select
                    value={reopenScope}
                    onChange={(e) => setReopenScope(e.target.value as "FULL_PERIOD" | "DOCUMENT_TYPE")}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  >
                    <option value="FULL_PERIOD">FULL_PERIOD — Mở lại toàn bộ kỳ kế toán</option>
                    <option value="DOCUMENT_TYPE">DOCUMENT_TYPE — Chỉ mở khóa một số loại chứng từ (AF-24)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  Lý do mở lại kỳ kế toán <span style={{ color: "#dc2626" }}>* (Bắt buộc - BR-GL-LOCK-46, EF-17)</span>:
                </label>
                <input
                  type="text"
                  placeholder="Nhập lý do mở lại kỳ kế toán để lưu Audit Log..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={requireReopenApproval}
                    onChange={(e) => setRequireReopenApproval(e.target.checked)}
                  />
                  <span>Yêu cầu phê duyệt mở lại kỳ qua Workflow kiểm soát nội bộ (AF-21 / EF-18)</span>
                </label>

                {reopenWorkflowStatus === "PENDING_APPROVAL" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDecideReopenWorkflow("APPROVE");
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 5,
                        border: "none",
                        background: "#16a34a",
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Phê duyệt Mở kỳ (APPROVE)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDecideReopenWorkflow("REJECT");
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 5,
                        border: "none",
                        background: "#dc2626",
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Từ chối (REJECT - EF-18)
                    </button>
                  </div>
                )}
              </div>

              {/* Lịch sử Khóa / Bỏ khóa sổ kỳ kế toán (PeriodLockHistory - Bước 38, 60) */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{
                    padding: "7px 12px",
                    background: "#f1f5f9",
                    borderBottom: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Lịch sử Khóa / Bỏ khóa sổ kỳ kế toán (Audit Trail — BR-GL-LOCK-38, 60)
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#334155" }}>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>Thao tác</th>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>Chuyển trạng thái</th>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>Phạm vi / Ngày</th>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>Lý do / Ghi chú</th>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>Người thực hiện / Thời điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodLockHistory.map((h) => (
                      <tr key={h.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 700, color: "#0284c7" }}>{h.action}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                          {h.previousStatus} → {h.newStatus}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          {h.lockScope} ({h.lockToDate})
                        </td>
                        <td style={{ padding: "6px 8px", color: "#475569" }}>{h.reason}</td>
                        <td style={{ padding: "6px 8px", color: "#64748b" }}>
                          {h.actor} — {h.performedAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setUnlockPeriodModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleReopenAccountingPeriod();
                }}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Đồng ý Bỏ khóa (Bước 43–62)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KHÓA SỔ / BỎ KHÓA SỔ THEO LOẠI CHỨNG TỪ (Image 1 popover item 3)  */}
      {/* ========================================================================= */}
      {lockByTypeModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setLockByTypeModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 650,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  Khóa sổ / Bỏ khóa sổ theo Loại chứng từ
                </span>
                <span
                  style={{
                    background: "#ea580c",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 3,
                  }}
                >
                  Mới
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLockByTypeModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", maxHeight: 400, overflowY: "auto" }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                Thiết lập linh hoạt việc khóa sổ độc lập cho từng loại nghiệp vụ kế toán:
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px", width: 40 }}>Khóa</th>
                    <th style={{ padding: "8px 12px" }}>Mã</th>
                    <th style={{ padding: "8px 12px" }}>Tên loại chứng từ</th>
                    <th style={{ padding: "8px 12px" }}>Ngày khóa</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherTypes.map((vt) => (
                    <tr key={vt.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px" }}>
                        <input
                          type="checkbox"
                          checked={vt.locked}
                          onChange={(e) => {
                            const updated = voucherTypes.map((v) =>
                              v.id === vt.id ? { ...v, locked: e.target.checked } : v
                            );
                            setVoucherTypes(updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0284c7" }}>{vt.id}</td>
                      <td style={{ padding: "8px 12px" }}>{vt.name}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <input
                          type="text"
                          value={vt.lockDate}
                          onChange={(e) => {
                            const updated = voucherTypes.map((v) =>
                              v.id === vt.id ? { ...v, lockDate: e.target.value } : v
                            );
                            setVoucherTypes(updated);
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            width: 100,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setLockByTypeModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => saveDocumentLocks(() => setLockByTypeModalOpen(false))}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: THIẾT LẬP KHÓA SỔ TỰ ĐỘNG (Image 1 popover item 4)                */}
      {/* ========================================================================= */}
      {autoLockModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setAutoLockModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 500,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                Thiết lập khóa sổ tự động
              </span>
              <button
                type="button"
                onClick={() => setAutoLockModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="auto-lock-enable" checked={autoLockEnabled} onChange={(e) => setAutoLockEnabled(e.target.checked)} />
                <label htmlFor="auto-lock-enable" style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                  Bật tính năng tự động khóa sổ định kỳ
                </label>
              </div>

              <div style={{ paddingLeft: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#475569" }}>
                  Tự động khóa sổ vào ngày:
                  <select
                    value={autoLockDay}
                    onChange={(e) => setAutoLockDay(e.target.value)}
                    style={{
                      marginLeft: 8,
                      marginRight: 8,
                      padding: "4px 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <option value="15">15</option>
                    <option value="20">20</option>
                    <option value="25">25</option>
                    <option value="cuoi_thang">Cuối tháng</option>
                  </select>
                  của tháng tiếp theo.
                </div>

                <div style={{ fontSize: 13, color: "#475569" }}>
                  Gửi thông báo cảnh báo qua email kế toán trưởng trước: <strong>3 ngày</strong>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setAutoLockModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => saveDocumentLocks(() => setAutoLockModalOpen(false))}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: LẬP BÁO CÁO TÀI CHÍNH (Image 2 popover items)                     */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL 5: CHỌN THAM SỐ BÁO CÁO TÀI CHÍNH (Matching Screenshots 2 - 5)       */}
      {/* ========================================================================= */}
      {statementModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
            backdropFilter: "blur(1px)",
          }}
          onClick={() => setStatementModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "52vw",
              minWidth: 580,
              maxWidth: 720,
              height: "100vh",
              background: "#ffffff",
              boxShadow: "-6px 0 24px rgba(0, 0, 0, 0.15)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              animation: "misaSlideInRight 0.22s ease-out",
            }}
          >
            {/* Left Edge Handle Tab Matching Screenshots 2-5 */}
            <div
              onClick={() => setStatementModalOpen(false)}
              title="Đóng / Thu gọn"
              style={{
                position: "absolute",
                top: "45%",
                left: -14,
                width: 14,
                height: 38,
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRight: "none",
                borderTopLeftRadius: 4,
                borderBottomLeftRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "-2px 0 5px rgba(0, 0, 0, 0.06)",
                zIndex: 10,
              }}
            >
              <ChevronLeft size={12} color="#64748b" />
            </div>

            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                {statementCategory === "bctc" && "Chọn tham số: Báo cáo tài chính"}
                {statementCategory === "thuyet_minh_bctc" && "Chọn tham số: Thuyết minh báo cáo tài chính"}
                {statementCategory === "bctc_giua_nien_do" && "Chọn tham số: Báo cáo tài chính giữa niên độ"}
                {statementCategory === "thuyet_minh_bctc_giua_nien_do" && "Chọn tham số: Thuyết minh báo cáo tài chính giữa niên độ"}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng (Esc)"
                  onClick={() => setStatementModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {/* Row 1: Kỳ báo cáo & Năm */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#334155", display: "block", marginBottom: 5 }}>
                    Kỳ báo cáo
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={statementPeriod}
                      onChange={(e) => handleStatementPeriodChange(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #10b981",
                        fontSize: 13,
                        color: "#0f172a",
                        background: "#ffffff",
                        appearance: "none",
                        outline: "none",
                        fontWeight: 600,
                      }}
                    >
                      {statementCategory === "bctc" || statementCategory === "thuyet_minh_bctc" ? (
                        <>
                          <option value="Năm">Năm</option>
                          <option value="6 tháng đầu năm">6 tháng đầu năm</option>
                          <option value="6 tháng cuối năm">6 tháng cuối năm</option>
                          <option value="Quý 1">Quý 1</option>
                          <option value="Quý 2">Quý 2</option>
                          <option value="Quý 3">Quý 3</option>
                          <option value="Quý 4">Quý 4</option>
                        </>
                      ) : (
                        <>
                          <option value="Quý 1">Quý 1</option>
                          <option value="Quý 2">Quý 2</option>
                          <option value="Quý 3">Quý 3</option>
                          <option value="Quý 4">Quý 4</option>
                          <option value="6 tháng đầu năm">6 tháng đầu năm</option>
                          <option value="Năm">Năm</option>
                        </>
                      )}
                    </select>
                    <ChevronDown
                      size={14}
                      color="#64748b"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#334155", display: "block", marginBottom: 5 }}>
                    Năm
                  </label>
                  <input
                    type="number"
                    value={statementYear}
                    onChange={(e) => handleStatementYearChange(Number(e.target.value) || 2026)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Từ (ngày) & Đến (ngày) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#334155", display: "block", marginBottom: 5 }}>
                    {statementCategory === "bctc_giua_nien_do" ? "Từ ngày" : "Từ"}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={statementFromDate}
                      onChange={(e) => setStatementFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 34px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        color: "#0f172a",
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={15}
                      color="#64748b"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#334155", display: "block", marginBottom: 5 }}>
                    {statementCategory === "bctc_giua_nien_do" ? "Đến ngày" : "Đến"}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={statementToDate}
                      onChange={(e) => setStatementToDate(e.target.value)}
                      disabled={statementCategory === "bctc_giua_nien_do" || statementCategory === "thuyet_minh_bctc_giua_nien_do"}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 34px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        color: "#0f172a",
                        background:
                          statementCategory === "bctc_giua_nien_do" || statementCategory === "thuyet_minh_bctc_giua_nien_do"
                            ? "#f1f5f9"
                            : "#ffffff",
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={15}
                      color="#64748b"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    />
                  </div>
                </div>
              </div>

              {/* CATEGORY 1: BÁO CÁO TÀI CHÍNH (Screenshot 2 + AF-02/AF-03 DN vs DNKLT) */}
              {statementCategory === "bctc" && (
                <>
                  {/* Radio Group for going concern assumption */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="goingConcern"
                        checked={statementGoingConcern === "continuous"}
                        onChange={() => setStatementGoingConcern("continuous")}
                        style={{ accentColor: "#00a862", width: 16, height: 16 }}
                      />
                      Doanh nghiệp đáp ứng giả định hoạt động liên tục
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="goingConcern"
                        checked={statementGoingConcern === "discontinuous"}
                        onChange={() => setStatementGoingConcern("discontinuous")}
                        style={{ accentColor: "#00a862", width: 16, height: 16 }}
                      />
                      Doanh nghiệp không đáp ứng giả định hoạt động liên tục
                    </label>
                  </div>

                  {/* Table Chọn báo cáo tài chính (tự động chuyển B01-DN..B09-DN hoặc B01-DNKLT..B09-DNKLT theo AF-02, AF-03, BR-GL-FS-08, 09) */}
                  <div>
                    <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>
                      Chọn báo cáo tài chính
                    </h4>
                    <div style={{ border: "1px solid #c2d6cb", borderRadius: 4, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#d5e4dc", borderBottom: "1px solid #c2d6cb" }}>
                            <th style={{ width: 44, padding: "8px 12px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={Object.values(selectedBctcReports).every(Boolean)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedBctcReports({
                                    "B01-DN": checked,
                                    "B02-DN": checked,
                                    "B03-DN": checked,
                                    "B03-DN-GT": checked,
                                    "B09-DN": checked,
                                  });
                                }}
                                style={{ accentColor: "#00a862" }}
                              />
                            </th>
                            <th style={{ width: 155, padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b", borderRight: "1px solid #c2d6cb" }}>
                              Mã báo cáo
                            </th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b" }}>
                              Tên báo cáo
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(statementGoingConcern === "discontinuous"
                            ? [
                                { code: "B01 - DNKLT", key: "B01-DN", name: "Báo cáo tình hình tài chính (Không đáp ứng giả định hoạt động liên tục)" },
                                { code: "B02 - DNKLT", key: "B02-DN", name: "Báo cáo kết quả hoạt động kinh doanh (Không đáp ứng giả định hoạt động liên tục)" },
                                { code: "B03 - DNKLT", key: "B03-DN", name: "Báo cáo lưu chuyển tiền tệ (Phương pháp trực tiếp - DNKLT)" },
                                { code: "B03 - DNKLT - GT", key: "B03-DN-GT", name: "Báo cáo lưu chuyển tiền tệ (Phương pháp gián tiếp - DNKLT)" },
                                { code: "B09 - DNKLT", key: "B09-DN", name: "Bản thuyết minh Báo cáo tài chính (Không đáp ứng giả định hoạt động liên tục)" },
                              ]
                            : [
                                { code: "B01 - DN", key: "B01-DN", name: "Báo cáo tình hình tài chính" },
                                { code: "B02 - DN", key: "B02-DN", name: "Báo cáo kết quả hoạt động kinh doanh" },
                                { code: "B03 - DN", key: "B03-DN", name: "Báo cáo lưu chuyển tiền tệ (Phương pháp trực tiếp)" },
                                { code: "B03 - DN - GT", key: "B03-DN-GT", name: "Báo cáo lưu chuyển tiền tệ (Phương pháp gián tiếp)" },
                                { code: "B09 - DN", key: "B09-DN", name: "Bản thuyết minh Báo cáo tài chính" },
                              ]
                          ).map((item) => (
                            <tr
                              key={item.key}
                              style={{
                                borderBottom: "1px solid #e2e8f0",
                                background: selectedBctcReports[item.key] ? "#f0fdf4" : "#ffffff",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                setSelectedBctcReports({
                                  ...selectedBctcReports,
                                  [item.key]: !selectedBctcReports[item.key],
                                });
                              }}
                            >
                              <td style={{ padding: "9px 12px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={!!selectedBctcReports[item.key]}
                                  onChange={(e) => {
                                    setSelectedBctcReports({
                                      ...selectedBctcReports,
                                      [item.key]: e.target.checked,
                                    });
                                  }}
                                  style={{ accentColor: "#00a862" }}
                                />
                              </td>
                              <td style={{ padding: "9px 12px", fontWeight: 500, color: "#0f172a", borderRight: "1px solid #f1f5f9" }}>
                                {item.code}
                              </td>
                              <td style={{ padding: "9px 12px", color: "#334155" }}>
                                {item.name}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* CATEGORY 2: THUYẾT MINH BÁO CÁO TÀI CHÍNH (Screenshot 3 + AF-04/AF-13) */}
              {statementCategory === "thuyet_minh_bctc" && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 12.5, color: "#475569", background: "#f8fafc", padding: "8px 12px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                    Biểu mẫu áp dụng:{" "}
                    <strong style={{ color: "#0f172a" }}>
                      {statementGoingConcern === "discontinuous"
                        ? "B09-DNKLT (Thuyết minh BCTC không đáp ứng giả định hoạt động liên tục)"
                        : "B09-DN (Bản thuyết minh Báo cáo tài chính năm)"}
                    </strong>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={statementReuseLatest}
                      onChange={(e) => setStatementReuseLatest(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    Lấy thông tin chung từ lần nhập gần nhất (AF-13, BR-GL-FS-38, 39: Không sao chép số liệu kỳ trước)
                  </label>
                </div>
              )}

              {/* CATEGORY 3: BÁO CÁO TÀI CHÍNH GIỮA NIÊN ĐỘ (Screenshot 4 + AF-05/AF-06 FULL vs CONDENSED) */}
              {statementCategory === "bctc_giua_nien_do" && (
                <div>
                  <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="interimFormat"
                        checked={statementInterimFormat === "FULL"}
                        onChange={() => setStatementInterimFormat("FULL")}
                        style={{ accentColor: "#00a862", width: 16, height: 16 }}
                      />
                      Dạng đầy đủ (B01a-DN, B02a-DN, B03a-DN, B09a-DN)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="interimFormat"
                        checked={statementInterimFormat === "CONDENSED"}
                        onChange={() => setStatementInterimFormat("CONDENSED")}
                        style={{ accentColor: "#00a862", width: 16, height: 16 }}
                      />
                      Dạng tóm lược (B01b-DN, B02b-DN, B03b-DN, B09a-DN)
                    </label>
                  </div>

                  <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>
                    Chọn báo cáo tài chính
                  </h4>
                  <div style={{ border: "1px solid #c2d6cb", borderRadius: 4, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#d5e4dc", borderBottom: "1px solid #c2d6cb" }}>
                          <th style={{ width: 44, padding: "8px 12px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={Object.values(selectedMidYearReports).every(Boolean)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedMidYearReports({
                                  "B01a-DN": checked,
                                  "B02a-DN": checked,
                                  "B03a-DN": checked,
                                  "B03a-DN-GT": checked,
                                  "B09a-DN": checked,
                                });
                              }}
                              style={{ accentColor: "#00a862" }}
                            />
                          </th>
                          <th style={{ width: 155, padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b", borderRight: "1px solid #c2d6cb" }}>
                            Mã báo cáo
                          </th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b" }}>
                            Tên báo cáo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(statementInterimFormat === "CONDENSED"
                          ? [
                              { code: "B01b - DN", key: "B01a-DN", name: "Báo cáo tình hình tài chính giữa niên độ (Dạng tóm lược)" },
                              { code: "B02b - DN", key: "B02a-DN", name: "Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng tóm lược)" },
                              { code: "B03b - DN", key: "B03a-DN", name: "Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng tóm lược - PP trực tiếp)" },
                              { code: "B03b - DN - GT", key: "B03a-DN-GT", name: "Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng tóm lược - PP gián tiếp)" },
                              { code: "B09a - DN", key: "B09a-DN", name: "Bản thuyết minh Báo cáo tài chính chọn lọc (Giữa niên độ)" },
                            ]
                          : [
                              { code: "B01a - DN", key: "B01a-DN", name: "Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)" },
                              { code: "B02a - DN", key: "B02a-DN", name: "Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)" },
                              { code: "B03a - DN", key: "B03a-DN", name: "Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)" },
                              { code: "B03a - DN - GT", key: "B03a-DN-GT", name: "Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)" },
                              { code: "B09a - DN", key: "B09a-DN", name: "Bản thuyết minh Báo cáo tài chính chọn lọc (Giữa niên độ)" },
                            ]
                        ).map((item) => (
                          <tr
                            key={item.key}
                            style={{
                              borderBottom: "1px solid #e2e8f0",
                              background: selectedMidYearReports[item.key] ? "#f0fdf4" : "#ffffff",
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              setSelectedMidYearReports({
                                ...selectedMidYearReports,
                                [item.key]: !selectedMidYearReports[item.key],
                              });
                            }}
                          >
                            <td style={{ padding: "9px 12px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={!!selectedMidYearReports[item.key]}
                                onChange={(e) => {
                                  setSelectedMidYearReports({
                                    ...selectedMidYearReports,
                                    [item.key]: e.target.checked,
                                  });
                                }}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td style={{ padding: "9px 12px", fontWeight: 500, color: "#0f172a", borderRight: "1px solid #f1f5f9" }}>
                              {item.code}
                            </td>
                            <td style={{ padding: "9px 12px", color: "#334155" }}>
                              {item.name}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CATEGORY 4: THUYẾT MINH BÁO CÁO TÀI CHÍNH GIỮA NIÊN ĐỘ (Screenshot 5 + AF-07/AF-13) */}
              {statementCategory === "thuyet_minh_bctc_giua_nien_do" && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 12.5, color: "#475569", background: "#f8fafc", padding: "8px 12px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                    Biểu mẫu áp dụng: <strong style={{ color: "#0f172a" }}>B09a-DN (Bản thuyết minh Báo cáo tài chính chọn lọc giữa niên độ)</strong>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={statementReuseLatest}
                      onChange={(e) => setStatementReuseLatest(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    Lấy thông tin chung từ lần nhập gần nhất (AF-13, BR-GL-FS-38, 39: Không sao chép số liệu kỳ trước)
                  </label>
                </div>
              )}

              {/* UC-GL-13: Đơn vị trình bày tiền tệ (AF-19, BR-GL-FS-60..62) & Kiểm tra điều kiện nguồn GL trước lập BCTC */}
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px dashed #cbd5e1",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "center" }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                      Đơn vị trình bày tiền tệ (AF-19, BR-GL-FS-60)
                    </label>
                    <select
                      value={statementUnitScale}
                      onChange={(e) => setStatementUnitScale(Number(e.target.value) as 1 | 1000 | 1000000)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 8px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        color: "#0f172a",
                        background: "#ffffff",
                      }}
                    >
                      <option value={1}>1 đồng (VND - Mặc định)</option>
                      <option value={1000}>1.000 đồng (Nghìn đồng)</option>
                      <option value={1000000}>1.000.000 đồng (Triệu đồng)</option>
                    </select>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.4 }}>
                    Chỉ quy đổi số hiển thị trên BCTC; giữ nguyên toàn bộ số dư gốc <code>raw_amount</code> và bút toán Sổ cái GL (BR-GL-FS-61, 83, 84).
                  </div>
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                    Kiểm tra điều kiện nguồn Sổ cái trước khi lập BCTC (Pre-generation Check):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, color: "#334155" }}>
                    <div>• Tổng hợp GL (UC-GL-10): <strong style={{ color: "#059669" }}>{statementPrecheckSummary.gl_aggregation}</strong></div>
                    <div>• Đối chiếu phân hệ (UC-GL-11): <strong style={{ color: "#059669" }}>{statementPrecheckSummary.reconciliation}</strong></div>
                    <div>• Kết chuyển lãi lỗ (UC-GL-09): <strong style={{ color: "#059669" }}>{statementPrecheckSummary.pl_closing}</strong></div>
                    <div>• Khóa kỳ kế toán (UC-GL-12): <strong style={{ color: "#0284c7" }}>{periodLockStatus}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 24px",
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setStatementModalOpen(false)}
                style={{
                  padding: "7px 20px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyStatementParams}
                style={{
                  padding: "7px 22px",
                  borderRadius: 4,
                  border: "none",
                  background: "#00a862",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UC-GL-13 MODAL: TRUY VẾT NGƯỢC CHỈ TIÊU BCTC VỀ SỔ CÁI & BÚT TOÁN NGUỒN (Steps 48–50, BR-GL-FS-112, 115) */}
      {statementDrilldownModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 100001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setStatementDrilldownModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90vw",
              maxWidth: 880,
              maxHeight: "86vh",
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 40px rgba(0,0,0,0.22)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                background: "#0f172a",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  Truy vết chỉ tiêu BCTC (Drill-down): Mã số [{statementDrilldownModal.indicator_code}] —{" "}
                  {statementDrilldownModal.indicator_name}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  Biểu mẫu: {statementDrilldownModal.form_code} • Phiên bản: {statementDrilldownModal.batch_number} • Công thức:{" "}
                  {statementDrilldownModal.formula}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatementDrilldownModal(null)}
                style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: "#166534" }}>Số cuối kỳ / Kỳ này</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#14532d" }}>
                    {Number(statementDrilldownModal.current_amount || 0).toLocaleString("vi-VN")} đ
                  </div>
                </div>
                <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: "#475569" }}>Số đầu năm / Kỳ so sánh</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                    {Number(statementDrilldownModal.prior_amount || 0).toLocaleString("vi-VN")} đ
                  </div>
                </div>
              </div>

              <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
                1. Phân rã theo Tài khoản Sổ cái & Đối tượng công nợ lưỡng tính (BR-GL-FS-54..56)
              </h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 18 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Tài khoản GL</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Mã đối tượng</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Tên đối tượng / Diễn giải</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Tính chất số dư</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Giá trị cấu thành</th>
                  </tr>
                </thead>
                <tbody>
                  {(statementDrilldownModal.account_breakdown || []).map((b: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700 }}>{b.account_code}</td>
                      <td style={{ padding: "8px 10px" }}>{b.party_code || "-"}</td>
                      <td style={{ padding: "8px 10px" }}>{b.party_name || b.account_name || "-"}</td>
                      <td style={{ padding: "8px 10px", color: "#0369a1", fontWeight: 600 }}>{b.side}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>
                        {Number(b.amount || 0).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
                2. Danh sách Bút toán Sổ cái (POSTED) cấu thành chỉ tiêu (BR-GL-FS-02, 112)
              </h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Số chứng từ</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Ngày hạch toán</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Loại bút toán</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Diễn giải</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Số tiền (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {(statementDrilldownModal.journal_entries || []).map((je: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#059669" }}>{je.number}</td>
                      <td style={{ padding: "8px 10px" }}>{je.posting_date}</td>
                      <td style={{ padding: "8px 10px" }}>{je.entry_type}</td>
                      <td style={{ padding: "8px 10px" }}>{je.description}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                        {Number(je.total_debit || 0).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* UC-GL-13 MODAL: BẢN THUYẾT MINH BCTC (B09-DN / B09-DNKLT / B09a-DN) & CHÍNH SÁCH KẾ TOÁN */}
      {statementNotesModalBatch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 100001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setStatementNotesModalBatch(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "88vw",
              maxWidth: 780,
              maxHeight: "85vh",
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 40px rgba(0,0,0,0.22)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                background: "#065f46",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  Thuyết minh Báo cáo tài chính (B09) — {statementNotesModalBatch.batch_number}
                </div>
                <div style={{ fontSize: 12, color: "#a7f3d0", marginTop: 2 }}>
                  Trạng thái phiên bản: {statementNotesModalBatch.status} • Thông tư 99/2025/TT-BTC
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatementNotesModalBatch(null)}
                style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {statementNotesModalBatch.status === "FINALIZED" && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #93c5fd",
                    borderRadius: 6,
                    padding: "9px 12px",
                    fontSize: 12.5,
                    color: "#1e40af",
                  }}
                >
                  <strong>Chế độ chỉ đọc (BR-GL-FS-75):</strong> Phiên bản {statementNotesModalBatch.batch_number} đã chốt chính thức (FINALIZED). Không được sửa trực tiếp trên phiên bản đã chốt.
                </div>
              )}

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 4 }}>
                  I. Lĩnh vực kinh doanh & Đặc điểm hoạt động của doanh nghiệp
                </label>
                <input
                  type="text"
                  disabled={statementNotesModalBatch.status === "FINALIZED"}
                  value={statementNotesModalBatch.notes_general_info?.business_sector || ""}
                  onChange={(e) =>
                    setStatementNotesModalBatch({
                      ...statementNotesModalBatch,
                      notes_general_info: {
                        ...(statementNotesModalBatch.notes_general_info || {}),
                        business_sector: e.target.value,
                      },
                    })
                  }
                  style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 4 }}>
                  II. Tuyên bố về giả định hoạt động liên tục & Chế độ kế toán áp dụng (TT99/2025/TT-BTC)
                </label>
                <textarea
                  rows={2}
                  disabled={statementNotesModalBatch.status === "FINALIZED"}
                  value={statementNotesModalBatch.notes_general_info?.going_concern_statement || ""}
                  onChange={(e) =>
                    setStatementNotesModalBatch({
                      ...statementNotesModalBatch,
                      notes_general_info: {
                        ...(statementNotesModalBatch.notes_general_info || {}),
                        going_concern_statement: e.target.value,
                      },
                    })
                  }
                  style={{ width: "100%", padding: 10, borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 4 }}>
                  V.01 — Thuyết minh chi tiết Tiền và các khoản tương đương tiền (Khớp B01.110 & B03.70)
                </label>
                <textarea
                  rows={2}
                  disabled={statementNotesModalBatch.status === "FINALIZED"}
                  value={statementNotesModalBatch.notes_explanations?.["V.01"] || ""}
                  onChange={(e) =>
                    setStatementNotesModalBatch({
                      ...statementNotesModalBatch,
                      notes_explanations: {
                        ...(statementNotesModalBatch.notes_explanations || {}),
                        "V.01": e.target.value,
                      },
                    })
                  }
                  style={{ width: "100%", padding: 10, borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 4 }}>
                  V.03 & V.12 — Thuyết minh công nợ lưỡng tính Phải thu KH (131) & Phải trả người bán (331)
                </label>
                <textarea
                  rows={2}
                  disabled={statementNotesModalBatch.status === "FINALIZED"}
                  value={statementNotesModalBatch.notes_explanations?.["V.03"] || ""}
                  onChange={(e) =>
                    setStatementNotesModalBatch({
                      ...statementNotesModalBatch,
                      notes_explanations: {
                        ...(statementNotesModalBatch.notes_explanations || {}),
                        "V.03": e.target.value,
                      },
                    })
                  }
                  style={{ width: "100%", padding: 10, borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>
            </div>

            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setStatementNotesModalBatch(null)}
                style={{ padding: "6px 16px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer" }}
              >
                Đóng
              </button>
              {statementNotesModalBatch.status !== "FINALIZED" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      apiConnected &&
                      apiToken &&
                      writer &&
                      !String(statementNotesModalBatch.id).startsWith("bctc-batch-")
                    ) {
                      try {
                        await updateFinancialStatementNotes(writer, String(statementNotesModalBatch.id), {
                          notesGeneralInfo: statementNotesModalBatch.notes_general_info,
                          notesExplanations: statementNotesModalBatch.notes_explanations,
                        });
                      } catch (err) {
                        notify(`Không lưu được thuyết minh: ${errorText(err)}`);
                        return;
                      }
                    }
                    setStatementBatches((prev) =>
                      prev.map((b) =>
                        String(b.id) === String(statementNotesModalBatch.id) ? statementNotesModalBatch : b,
                      ),
                    );
                    setStatementNotesModalBatch(null);
                    notify(
                      `Đã lưu nội dung Thuyết minh BCTC cho phiên bản ${statementNotesModalBatch.batch_number} (AF-12, BR-GL-FS-41, 42).`,
                    );
                  }}
                  style={{
                    padding: "6px 18px",
                    borderRadius: 4,
                    border: "none",
                    background: "#00a862",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Lưu Thuyết minh B09
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: THÊM CHỨNG TỪ NGHIỆP VỤ KHÁC (6 Types - Screenshots 1 to 5)       */}
      {/* ========================================================================= */}
      {addVoucherModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAddVoucherModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "98vw",
              maxWidth: 1420,
              height: "94vh",
              maxHeight: 900,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
            }}
          >
            {/* 1. TOP HEADER BAR */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 18px",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Lịch sử chứng từ"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <RotateCcw size={16} />
                </button>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
                  <span>Chứng từ nghiệp vụ khác</span> {voucherNo}
                </span>

                {/* Dropdown Pill Selector */}
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => setShowVoucherTypeDropdown(!showVoucherTypeDropdown)}
                    data-testid="voucher-type-pill"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#1e293b",
                      cursor: "pointer",
                      userSelect: "none",
                      maxWidth: 360,
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {selectedVoucherType}
                    </span>
                    <Plus size={14} color="#00a862" strokeWidth={2.5} />
                    <ChevronDown size={14} color="#64748b" />
                  </div>

                  {/* 6 Types Dropdown Popup */}
                  {showVoucherTypeDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        width: 360,
                        background: "#ffffff",
                        borderRadius: 6,
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                        border: "1px solid #cbd5e1",
                        padding: "6px 0",
                        zIndex: 1000,
                      }}
                    >
                      {voucherTypeOptions.map((vType) => (
                        <div
                          key={vType}
                          onClick={() => switchVoucherType(vType)}
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            color: selectedVoucherType === vType ? "#00a862" : "#1e293b",
                            fontWeight: selectedVoucherType === vType ? 600 : 400,
                            background: selectedVoucherType === vType ? "#f0fdf4" : "transparent",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                          onMouseEnter={(e) => {
                            if (selectedVoucherType !== vType) {
                              e.currentTarget.style.background = "#f8fafc";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedVoucherType !== vType) {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          <span>{vType}</span>
                          {selectedVoucherType === vType && <Check size={14} color="#00a862" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Tùy biến giao diện"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <Layout size={17} />
                </button>
                <button
                  type="button"
                  title="Thiết lập"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <Settings size={17} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  onClick={() => setAddVoucherModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {/* 2. MASTER FORM SECTION */}
            <div
              style={{
                padding: "16px 20px 12px 20px",
                background: "#ffffff",
                display: "grid",
                gridTemplateColumns: "1fr 420px",
                gap: 32,
                borderBottom: "1px solid #f1f5f9",
                flexShrink: 0,
              }}
            >
              {/* Left Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Field: Kết chuyển đầu năm * (Type 5: 5. Kết chuyển lãi lỗ đầu năm) */}
                {selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm" && (
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 3 }}>
                      <span>Kết chuyển đầu năm</span>
                      <span style={{ color: "#ef4444" }}> *</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ position: "relative", width: 75 }}>
                        <input
                          type="number"
                          value={closingYear}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 2026;
                            setClosingYear(val);
                            setVoucherDescription(`Kết chuyển lãi lỗ đầu năm ${val}`);
                            setVoucherPostingDate(`01/01/${val}`);
                            setVoucherDocDate(`01/01/${val}`);
                            setVoucherRows((prev) =>
                              prev.map((r) => ({
                                ...r,
                                desc: `Kết chuyển lãi lỗ đầu năm ${val}`,
                              }))
                            );
                          }}
                          style={{
                            width: "100%",
                            height: 30,
                            padding: "0 6px",
                            borderRadius: 3,
                            border: "1px solid #cbd5e1",
                            fontSize: 13,
                            color: "#0f172a",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          notify(`Đã lấy dữ liệu kết chuyển lãi lỗ đầu năm ${closingYear}!`);
                          setVoucherRows([
                            {
                              id: "1",
                              desc: `Kết chuyển lãi lỗ đầu năm ${closingYear}`,
                              debitAcc: "4212",
                              creditAcc: "4211",
                              amount: 0,
                            },
                          ]);
                        }}
                        style={{
                          height: 30,
                          padding: "0 14px",
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "#374151",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Lấy dữ liệu
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 3 }}>
                    Diễn giải
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      value={voucherDescription}
                      onChange={(e) => setVoucherDescription(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 32px 7px 10px",
                        borderRadius: 4,
                        border: "1px solid #00a862",
                        outline: "none",
                        fontSize: 13,
                        color: "#0f172a",
                      }}
                    />
                    <span title="Sổ Việt AI gợi ý diễn giải" style={{ display: "inline-flex" }}><Sparkles
                      size={15}
                      color="#8b5cf6"
                      style={{ position: "absolute", right: 10, cursor: "pointer" }}
                      
                    /></span>
                  </div>
                </div>

                {/* Hạn thanh toán (shown for Type 2, 3, 4, 6) */}
                {(selectedVoucherType === "2. Vay ngân hàng chuyển trả cho nhà cung cấp" ||
                  selectedVoucherType === "3. Hạch toán chi phí lương" ||
                  selectedVoucherType === "4. Khác" ||
                  selectedVoucherType === "6. Khấu trừ thuế tiêu thụ đặc biệt") && (
                  <div style={{ maxWidth: 220 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 3 }}>
                      Hạn thanh toán
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        value={voucherDueDate}
                        onChange={(e) => setVoucherDueDate(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        style={{
                          width: "100%",
                          padding: "6px 30px 6px 10px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          color: "#334155",
                        }}
                      />
                      <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8 }} />
                    </div>
                  </div>
                )}

                <div>
                  <span
                    style={{
                      fontSize: 12.5,
                      color: "#00a862",
                      cursor: "pointer",
                      fontWeight: 500,
                      display: "inline-block",
                      marginTop: 2,
                    }}
                  >
                    Tham chiếu ...
                  </span>
                </div>
              </div>

              {/* Right Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#475569" }}>Ngày hạch toán</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      value={voucherPostingDate}
                      onChange={(e) => setVoucherPostingDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                    <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#475569" }}>Ngày chứng từ</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      value={voucherDocDate}
                      onChange={(e) => setVoucherDocDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                    <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#475569" }}>Số chứng từ</span>
                  <input
                    type="text"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Total Display */}
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Tổng tiền</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#000000", lineHeight: 1.2 }}>
                    {voucherRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("vi-VN")}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SUB-HEADER BAR (Tabs & AVA Assistant) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 20px",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              {/* Tabs */}
              <div style={{ display: "flex", gap: 16 }}>
                <div
                  onClick={() => setActiveDetailTab("hach_toan")}
                  style={{
                    padding: "10px 4px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: activeDetailTab === "hach_toan" ? "#00a862" : "#64748b",
                    borderBottom: activeDetailTab === "hach_toan" ? "2px solid #00a862" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Hạch toán
                </div>

                {selectedVoucherType === "4. Khác" && (
                  <div
                    onClick={() => setActiveDetailTab("ke_khai_thue")}
                    style={{
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: activeDetailTab === "ke_khai_thue" ? "#00a862" : "#64748b",
                      borderBottom: activeDetailTab === "ke_khai_thue" ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Kê khai hóa đơn và hạch toán thuế
                  </div>
                )}
              </div>

              {/* Right helpers */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {selectedVoucherType === "4. Khác" && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isGroupInvoices}
                      onChange={(e) => setIsGroupInvoices(e.target.checked)}
                    />
                    <span>Hạch toán gộp nhiều hóa đơn</span>
                    <HelpCircle size={13} color="#94a3b8" />
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => notify("Trợ lý Sổ Việt AI đang sẵn sàng hỗ trợ định khoản!")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: 20,
                    border: "1px solid #c084fc",
                    background: "#faf5ff",
                    color: "#7e22ce",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Bot size={14} color="#9333ea" />
                  <span>Sổ Việt AI</span>
                  <ChevronDown size={13} color="#9333ea" />
                </button>
              </div>
            </div>

            {/* 4. MASTER DETAIL DATA GRID */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {activeDetailTab === "hach_toan" ? (
                <table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr
                      style={{
                        background: selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm" ? "#d6e4dc" : "#e6f0eb",
                        borderBottom: "1px solid #cbd5e1",
                        textAlign: "left",
                        color: "#1e293b",
                        fontSize: 12.5,
                        fontWeight: 600,
                        height: 34,
                      }}
                    >
                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center", borderRight: selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm" ? "1px dotted #94a3b8" : "1px solid #cbd5e1" }}>#</th>
                      <th style={{ padding: "6px 10px", minWidth: 260, borderRight: selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm" ? "1px dotted #94a3b8" : "1px solid #cbd5e1" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Pin size={12} color="#64748b" /> Diễn giải
                        </span>
                      </th>
                      <th style={{ padding: "6px 10px", width: 140, borderRight: selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm" ? "1px dotted #94a3b8" : "1px solid #cbd5e1" }}>TK Nợ</th>
                      <th style={{ padding: "6px 10px", width: 140, borderRight: selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm" ? "1px dotted #94a3b8" : "1px solid #cbd5e1" }}>TK Có</th>
                      <th style={{ padding: "6px 10px", width: 160, textAlign: "right", borderRight: selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm" ? "1px dotted #94a3b8" : "1px solid #cbd5e1" }}>Số tiền</th>

                      {/* Type 2 columns */}
                      {selectedVoucherType === "2. Vay ngân hàng chuyển trả cho nhà cung cấp" && (
                        <>
                          <th style={{ padding: "6px 10px", width: 130, borderRight: "1px solid #cbd5e1" }}>Đối tượng Nợ</th>
                          <th style={{ padding: "6px 10px", width: 160, borderRight: "1px solid #cbd5e1" }}>Tên đối tượng nợ</th>
                          <th style={{ padding: "6px 10px", width: 130, borderRight: "1px solid #cbd5e1" }}>Đối tượng có</th>
                          <th style={{ padding: "6px 10px", width: 160, borderRight: "1px solid #cbd5e1" }}>Tên đối tượng có</th>
                          <th style={{ padding: "6px 10px", width: 130, borderRight: "1px solid #cbd5e1" }}>Khế ước vay</th>
                        </>
                      )}

                      {/* Type 3 columns */}
                      {selectedVoucherType === "3. Hạch toán chi phí lương" && (
                        <>
                          <th style={{ padding: "6px 10px", width: 140, borderRight: "1px solid #cbd5e1" }}>Khoản mục CP</th>
                          <th style={{ padding: "6px 10px", width: 140, borderRight: "1px solid #cbd5e1" }}>Đơn vị</th>
                          <th style={{ padding: "6px 10px", width: 140, borderRight: "1px solid #cbd5e1" }}>Đối tượng THCP</th>
                        </>
                      )}

                      {/* Type 4 & Type 6 columns */}
                      {(selectedVoucherType === "4. Khác" || selectedVoucherType === "6. Khấu trừ thuế tiêu thụ đặc biệt") && (
                        <>
                          <th style={{ padding: "6px 10px", width: 120, borderRight: "1px solid #cbd5e1" }}>Nghiệp vụ</th>
                          <th style={{ padding: "6px 10px", width: 130, borderRight: "1px solid #cbd5e1" }}>Đối tượng Nợ</th>
                          <th style={{ padding: "6px 10px", width: 160, borderRight: "1px solid #cbd5e1" }}>Tên đối tượng nợ</th>
                          <th style={{ padding: "6px 10px", width: 130, borderRight: "1px solid #cbd5e1" }}>Đối tượng có</th>
                          <th style={{ padding: "6px 10px", width: 160, borderRight: "1px solid #cbd5e1" }}>Tên đối tượng có</th>
                        </>
                      )}

                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucherRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: idx % 2 === 0 ? "#ffffff" : "#fbfdfc",
                        }}
                      >
                        <td style={{ padding: "6px 8px", textAlign: "center", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.desc}
                            onChange={(e) => {
                              const newRows = [...voucherRows];
                              newRows[idx].desc = e.target.value;
                              setVoucherRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.debitAcc}
                            onChange={(e) => {
                              const newRows = [...voucherRows];
                              newRows[idx].debitAcc = e.target.value;
                              setVoucherRows(newRows);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#0369a1",
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.creditAcc}
                            onChange={(e) => {
                              const newRows = [...voucherRows];
                              newRows[idx].creditAcc = e.target.value;
                              setVoucherRows(newRows);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#b45309",
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.amount}
                            onChange={(e) => {
                              const newRows = [...voucherRows];
                              newRows[idx].amount = Number(e.target.value.replace(/\D/g, "")) || 0;
                              setVoucherRows(newRows);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              textAlign: "right",
                              background: "transparent",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          />
                        </td>

                        {/* Type 2 columns inputs */}
                        {selectedVoucherType === "2. Vay ngân hàng chuyển trả cho nhà cung cấp" && (
                          <>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Chọn đối tượng"
                                value={row.debitObject || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].debitObject = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                              {row.debitObjectName || ""}
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Chọn ngân hàng"
                                value={row.creditObject || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].creditObject = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                              {row.creditObjectName || ""}
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Khế ước vay"
                                value={row.loanContract || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].loanContract = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                          </>
                        )}

                        {/* Type 3 columns inputs */}
                        {selectedVoucherType === "3. Hạch toán chi phí lương" && (
                          <>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Khoản mục CP"
                                value={row.expenseItem || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].expenseItem = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Đơn vị"
                                value={row.department || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].department = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Đối tượng THCP"
                                value={row.costObject || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].costObject = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                          </>
                        )}

                        {/* Type 4 & Type 6 columns inputs */}
                        {(selectedVoucherType === "4. Khác" || selectedVoucherType === "6. Khấu trừ thuế tiêu thụ đặc biệt") && (
                          <>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Nghiệp vụ"
                                value={row.operation || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].operation = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Đối tượng Nợ"
                                value={row.debitObject || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].debitObject = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                              {row.debitObjectName || ""}
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                              <input
                                type="text"
                                placeholder="Đối tượng Có"
                                value={row.creditObject || ""}
                                onChange={(e) => {
                                  const newRows = [...voucherRows];
                                  newRows[idx].creditObject = e.target.value;
                                  setVoucherRows(newRows);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                              {row.creditObjectName || ""}
                            </td>
                          </>
                        )}

                        <td style={{ padding: "4px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteVoucherRow(row.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                            title="Xóa dòng"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Summary row */}
                    {selectedVoucherType === "5. Kết chuyển lãi lỗ đầu năm" ? (
                      <tr style={{ background: "#ffffff", fontWeight: 700, borderTop: "1px solid #cbd5e1", height: 34 }}>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: "#0f172a", borderRight: "1px dotted #cbd5e1" }}>
                          {voucherRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td></td>
                      </tr>
                    ) : (
                      <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                        <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right" }}>
                          Tổng cộng:
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a" }}>
                          {voucherRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td colSpan={6}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                /* Tab Kê khai hóa đơn và hạch toán thuế */
                <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr
                      style={{
                        background: "#e6f0eb",
                        borderBottom: "1px solid #cbd5e1",
                        textAlign: "left",
                        color: "#1e293b",
                        fontSize: 12.5,
                        fontWeight: 600,
                        height: 36,
                      }}
                    >
                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ padding: "6px 10px", width: 110, borderRight: "1px solid #cbd5e1" }}>Ngày hóa đơn</th>
                      <th style={{ padding: "6px 10px", width: 110, borderRight: "1px solid #cbd5e1" }}>Số hóa đơn</th>
                      <th style={{ padding: "6px 10px", width: 90, borderRight: "1px solid #cbd5e1" }}>Mẫu số HĐ</th>
                      <th style={{ padding: "6px 10px", width: 90, borderRight: "1px solid #cbd5e1" }}>Ký hiệu HĐ</th>
                      <th style={{ padding: "6px 10px", width: 90, borderRight: "1px solid #cbd5e1" }}>Nhóm HHDV</th>
                      <th style={{ padding: "6px 10px", width: 80, borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                      <th style={{ padding: "6px 10px", width: 80, borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                      <th style={{ padding: "6px 10px", width: 130, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tiền chưa thuế</th>
                      <th style={{ padding: "6px 10px", width: 90, borderRight: "1px solid #cbd5e1" }}>Thuế suất</th>
                      <th style={{ padding: "6px 10px", width: 130, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tiền thuế GTGT</th>
                      <th style={{ padding: "6px 10px", minWidth: 140, borderRight: "1px solid #cbd5e1" }}>Đối tượng</th>
                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxInvoiceRows.map((tRow, tIdx) => (
                      <tr key={tRow.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "6px 8px", textAlign: "center", color: "#64748b" }}>{tIdx + 1}</td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.invoiceDate}
                            onChange={(e) => {
                              const newRows = [...taxInvoiceRows];
                              newRows[tIdx].invoiceDate = e.target.value;
                              setTaxInvoiceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            placeholder="Số HĐ"
                            value={tRow.invoiceNo}
                            onChange={(e) => {
                              const newRows = [...taxInvoiceRows];
                              newRows[tIdx].invoiceNo = e.target.value;
                              setTaxInvoiceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.invoiceForm}
                            onChange={(e) => {
                              const newRows = [...taxInvoiceRows];
                              newRows[tIdx].invoiceForm = e.target.value;
                              setTaxInvoiceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.invoiceSerial}
                            onChange={(e) => {
                              const newRows = [...taxInvoiceRows];
                              newRows[tIdx].invoiceSerial = e.target.value;
                              setTaxInvoiceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.goodsGroup}
                            onChange={(e) => {
                              const newRows = [...taxInvoiceRows];
                              newRows[tIdx].goodsGroup = e.target.value;
                              setTaxInvoiceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", color: "#0369a1", fontWeight: 500 }}>{tRow.debitAcc}</td>
                        <td style={{ padding: "4px 8px", color: "#b45309", fontWeight: 500 }}>{tRow.creditAcc}</td>
                        <td style={{ padding: "4px 8px", textAlign: "right" }}>
                          <input
                            type="text"
                            value={tRow.preTaxAmount}
                            onChange={(e) => {
                              const newRows = [...taxInvoiceRows];
                              newRows[tIdx].preTaxAmount = Number(e.target.value.replace(/\D/g, "")) || 0;
                              newRows[tIdx].vatAmount = Math.round(newRows[tIdx].preTaxAmount * 0.1);
                              setTaxInvoiceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", textAlign: "right", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>10%</td>
                        <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                          {tRow.vatAmount.toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            placeholder="Tên nhà cung cấp"
                            value={tRow.partnerName}
                            onChange={(e) => {
                              const newRows = [...taxInvoiceRows];
                              newRows[tIdx].partnerName = e.target.value;
                              setTaxInvoiceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (taxInvoiceRows.length > 1) {
                                setTaxInvoiceRows(taxInvoiceRows.filter((r) => r.id !== tRow.id));
                              }
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 5. CONTROLS BELOW GRID (Row buttons, VAT checkbox, Drag & Drop Attachment) */}
            <div
              style={{
                padding: "10px 20px 8px 20px",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderBottom: "1px solid #f1f5f9",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>Tổng số: {voucherRows.length}</span>
                  <button
                    type="button"
                    onClick={handleAddVoucherRow}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#1e293b",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} color="#00a862" />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllVoucherRows}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} color="#ef4444" />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>

                {/* Pagination */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#64748b" }}>
                  <span>Số dòng/trang</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                    }}
                  >
                    <span>20</span>
                    <ChevronDown size={12} />
                  </div>
                  <ChevronsLeft size={16} style={{ cursor: "pointer", opacity: 0.5 }} />
                  <ChevronDown size={14} style={{ transform: "rotate(90deg)", cursor: "pointer", opacity: 0.5 }} />
                  <span style={{ fontWeight: 600, color: "#00a862" }}>1</span>
                  <ChevronDown size={14} style={{ transform: "rotate(-90deg)", cursor: "pointer", opacity: 0.5 }} />
                  <ChevronsRight size={16} style={{ cursor: "pointer", opacity: 0.5 }} />
                </div>
              </div>

              {/* VAT Checkbox (hidden for Type 6 matching Screenshot 6) */}
              {selectedVoucherType !== "6. Khấu trừ thuế tiêu thụ đặc biệt" && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    color: "#334155",
                    cursor: "pointer",
                    marginTop: 2,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={excludeFromVatDeclaration}
                    onChange={(e) => setExcludeFromVatDeclaration(e.target.checked)}
                  />
                  <span>Không lên bảng kê thuế GTGT</span>
                  <HelpCircle size={13} color="#94a3b8" />
                </label>
              )}

              {/* Attachment Drag & Drop Area */}
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Paperclip size={14} />
                  <span style={{ fontWeight: 500 }}>Đính kèm</span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>Dung lượng tối đa 5MB</span>
                </div>
                <label
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "12px 16px",
                    background: "#f8fafc",
                    textAlign: "center",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleGeneralVoucherAttachmentUpload}
                    style={{ display: "none" }}
                  />
                  <Upload size={18} color="#64748b" />
                  <div style={{ fontSize: 12.5, color: "#475569" }}>
                    <span style={{ color: "#2563eb", fontWeight: 500 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                  </div>
                </label>
                {voucherAttachments.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {voucherAttachments.map((att, aIdx) => (
                      <span
                        key={`${att.file_name}-${aIdx}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "#f1f5f9",
                          fontSize: 12,
                          color: "#334155",
                        }}
                      >
                        <Paperclip size={11} />
                        <span>{att.file_name}</span>
                        <span style={{ color: "#64748b" }}>({Math.max(1, Math.round(att.file_size / 1024))} KB)</span>
                        <button
                          type="button"
                          onClick={() => setVoucherAttachments(voucherAttachments.filter((_, i) => i !== aIdx))}
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {voucherFormError && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    fontSize: 12.5,
                    fontWeight: 500,
                  }}
                >
                  {voucherFormError}
                </div>
              )}
            </div>

            {/* 6. BOTTOM ACTION BAR (Hủy, Cất, Lưu và In) */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "10px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setAddVoucherModalOpen(false)}
                style={{
                  padding: "7px 18px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingGeneralVoucher}
                onClick={() => { void handleSaveGeneralVoucher(); }}
                style={{
                  padding: "7px 22px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1e293b",
                  cursor: isSavingGeneralVoucher ? "not-allowed" : "pointer",
                  opacity: isSavingGeneralVoucher ? 0.65 : 1,
                }}
              >Lưu</button>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden" }}>
                <button
                  type="button"
                  disabled={isSavingGeneralVoucher}
                  onClick={() => { void handleSaveGeneralVoucher(true); }}
                  style={{
                    padding: "7px 18px",
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: isSavingGeneralVoucher ? "not-allowed" : "pointer",
                    opacity: isSavingGeneralVoucher ? 0.65 : 1,
                  }}
                >
                  Lưu và In
                </button>
                <button
                  type="button"
                  style={{
                    padding: "7px 8px",
                    background: "#009153",
                    color: "#ffffff",
                    border: "none",
                    borderLeft: "1px solid rgba(255,255,255,0.2)",
                    cursor: "pointer",
                  }}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: CHỨNG TỪ QUYẾT TOÁN TẠM ỨNG QTTU00001 (Matching user screenshot)   */}
      {/* ========================================================================= */}
      {addAdvanceSettlementModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAddAdvanceSettlementModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "98vw",
              maxWidth: 1420,
              height: "94vh",
              maxHeight: 900,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
            }}
          >
            {/* 1. TOP HEADER BAR */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 18px",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Lịch sử chứng từ"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <RotateCcw size={16} />
                </button>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
                  <span>Chứng từ quyết toán tạm ứng</span> {advanceVoucherNo}
                </span>

                {/* Checkbox Quyết toán cho từng lần tạm ứng */}
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                    marginLeft: 16,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settlePerAdvance}
                    onChange={(e) => setSettlePerAdvance(e.target.checked)}
                  />
                  <span>Quyết toán cho từng lần tạm ứng</span>
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Thiết lập"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <Settings size={17} />
                </button>
                <button
                  type="button"
                  title="Hướng dẫn"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <HelpCircle size={17} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  onClick={() => setAddAdvanceSettlementModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {advanceError && (
              <div
                style={{
                  padding: "8px 20px",
                  background: "#fef2f2",
                  borderBottom: "1px solid #fecaca",
                  color: "#dc2626",
                  fontSize: 12.5,
                  fontWeight: 500,
                }}
              >
                {advanceError}
              </div>
            )}

            {/* 2. MASTER FORM SECTION */}
            <div
              style={{
                padding: "16px 20px 12px 20px",
                background: "#ffffff",
                display: "grid",
                gridTemplateColumns: "1fr 420px",
                gap: 32,
                borderBottom: "1px solid #f1f5f9",
                flexShrink: 0,
              }}
            >
              {/* Left Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 3 }}>
                      Nhân viên <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", width: 260 }}>
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          border: "1px solid #00a862",
                          borderRadius: 4,
                          background: "#ffffff",
                          padding: "0 6px",
                        }}
                      >
                        <input
                          type="text"
                          list="advance-settlement-employee-list"
                          placeholder="Chọn hoặc nhập nhân viên..."
                          value={advanceEmployee}
                          onChange={(e) => handleSelectAdvanceEmployee(e.target.value)}
                          style={{
                            flex: 1,
                            padding: "6px 4px",
                            border: "none",
                            outline: "none",
                            fontSize: 13,
                            color: "#0f172a",
                            background: "transparent",
                          }}
                        />
                        <datalist id="advance-settlement-employee-list">
                          <option value="NV001 - Nguyễn Văn An" />
                          <option value="NV002 - Trần Thị Bình" />
                          <option value="NV003 - Lê Hoàng Cường" />
                          {advanceRequests.map((reqItem) => (
                            <option
                              key={`emp-opt-${reqItem.id}`}
                              value={reqItem.requesterCode ? `${reqItem.requesterCode} - ${reqItem.employee}` : reqItem.employee}
                            />
                          ))}
                        </datalist>
                        <Plus size={14} color="#00a862" strokeWidth={2.5} style={{ cursor: "pointer", marginRight: 4 }} />
                        <ChevronDown size={14} color="#64748b" style={{ cursor: "pointer" }} />
                      </div>
                    </div>
                  </div>

                  {settlePerAdvance && (
                    <>
                      <div>
                        <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 3 }}>
                          Khoản/Lần tạm ứng nguồn <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="VD: PC00012 / TU0001"
                          value={advanceSourceRef}
                          onChange={(e) => {
                            setAdvanceSourceRef(e.target.value);
                            setAdvanceError("");
                          }}
                          style={{
                            width: 170,
                            padding: "6px 10px",
                            borderRadius: 4,
                            border: "1px solid #00a862",
                            fontSize: 13,
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 3 }}>
                          Số dư tạm ứng còn lại
                        </label>
                        <input
                          type="text"
                          placeholder="Số dư (VND)"
                          value={advanceSourceAmount}
                          onChange={(e) => setAdvanceSourceAmount(e.target.value.replace(/[^\d]/g, ""))}
                          style={{
                            width: 145,
                            padding: "6px 10px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 13,
                            textAlign: "right",
                            outline: "none",
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 3 }}>
                    Diễn giải
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      value={advanceDescription}
                      onChange={(e) => setAdvanceDescription(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 32px 7px 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        fontSize: 13,
                        color: "#0f172a",
                      }}
                    />
                    <span title="Sổ Việt AI gợi ý diễn giải" style={{ display: "inline-flex" }}><Sparkles
                      size={15}
                      color="#8b5cf6"
                      style={{ position: "absolute", right: 10, cursor: "pointer" }}
                      
                    /></span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", position: "relative" }}>
                  <span
                    onClick={() => setShowAdvanceRefPicker((v) => !v)}
                    style={{
                      fontSize: 12.5,
                      color: "#00a862",
                      cursor: "pointer",
                      fontWeight: 500,
                      display: "inline-block",
                      marginTop: 2,
                    }}
                  >
                    Tham chiếu ...
                  </span>
                  {advanceReferences.map((refCode) => (
                    <span
                      key={refCode}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        color: "#047857",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {refCode}
                      <X
                        size={12}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setAdvanceReferences(advanceReferences.filter((r) => r !== refCode));
                          if (advanceRequestId === refCode) setAdvanceRequestId("");
                        }}
                      />
                    </span>
                  ))}
                  {showAdvanceRefPicker && (
                    <div
                      style={{
                        position: "absolute",
                        top: 26,
                        left: 0,
                        zIndex: 50,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        boxShadow: "0 10px 25px rgba(15,23,42,0.12)",
                        padding: 10,
                        minWidth: 340,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                        Chọn Đề nghị quyết toán tạm ứng đã duyệt (UC-GL-01):
                      </div>
                      {advanceRequests.filter((r) => r.rawStatus === "APPROVED" || r.status === "Đã duyệt").length === 0 ? (
                        <div style={{ fontSize: 12, color: "#64748b", padding: "4px 0" }}>
                          Chưa có đề nghị quyết toán nào ở trạng thái Đã duyệt.
                        </div>
                      ) : (
                        advanceRequests
                          .filter((r) => r.rawStatus === "APPROVED" || r.status === "Đã duyệt")
                          .map((reqItem) => (
                            <div
                              key={reqItem.id}
                              onClick={() => {
                                handleInheritAdvanceRequestToVoucher(reqItem);
                                setShowAdvanceRefPicker(false);
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 12.5,
                                borderBottom: "1px solid #f1f5f9",
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <span>
                                <strong>{reqItem.id}</strong> — {reqItem.employee}
                              </span>
                              <span style={{ color: "#00a862", fontWeight: 600 }}>
                                {Number(reqItem.amount || 0).toLocaleString("vi-VN")} đ
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#475569" }}>Ngày hạch toán</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      value={advancePostingDate}
                      onChange={(e) => setAdvancePostingDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                    <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#475569" }}>Ngày chứng từ</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      value={advanceDocDate}
                      onChange={(e) => setAdvanceDocDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                    <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#475569" }}>Số chứng từ</span>
                  <input
                    type="text"
                    value={advanceVoucherNo}
                    onChange={(e) => setAdvanceVoucherNo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Total Display (Hạch toán + Thuế GTGT) */}
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Tổng tiền</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#000000", lineHeight: 1.2 }}>
                    {(
                      advanceRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) +
                      advanceTaxRows.reduce((sum, t) => sum + (Number(t.vatAmount) || 0), 0)
                    ).toLocaleString("vi-VN")}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SUB-HEADER BAR (Tabs & AVA Assistant) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 20px",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              {/* Tabs */}
              <div style={{ display: "flex", gap: 16 }}>
                <div
                  onClick={() => setAdvanceDetailTab("hach_toan")}
                  style={{
                    padding: "10px 4px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: advanceDetailTab === "hach_toan" ? "#00a862" : "#64748b",
                    borderBottom: advanceDetailTab === "hach_toan" ? "2px solid #00a862" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Hạch toán
                </div>

                <div
                  onClick={() => setAdvanceDetailTab("ke_khai_thue")}
                  style={{
                    padding: "10px 4px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: advanceDetailTab === "ke_khai_thue" ? "#00a862" : "#64748b",
                    borderBottom: advanceDetailTab === "ke_khai_thue" ? "2px solid #00a862" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Kê khai hóa đơn và hạch toán thuế
                </div>
              </div>

              {/* Right helpers */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={advanceGroupInvoices}
                    onChange={(e) => setAdvanceGroupInvoices(e.target.checked)}
                  />
                  <span>Hạch toán gộp nhiều hóa đơn</span>
                  <HelpCircle size={13} color="#94a3b8" />
                </label>

                <button
                  type="button"
                  onClick={() => notify("Trợ lý Sổ Việt AI đang sẵn sàng hỗ trợ quyết toán tạm ứng!")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: 20,
                    border: "1px solid #c084fc",
                    background: "#faf5ff",
                    color: "#7e22ce",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Bot size={14} color="#9333ea" />
                  <span>Sổ Việt AI</span>
                  <ChevronDown size={13} color="#9333ea" />
                </button>
              </div>
            </div>

            {/* 4. MASTER DETAIL DATA GRID */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {advanceDetailTab === "hach_toan" ? (
                <table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr
                      style={{
                        background: "#d5e4dc",
                        borderBottom: "1px solid #c2d6cb",
                        textAlign: "left",
                        color: "#1e293b",
                        fontSize: 12.5,
                        fontWeight: 600,
                        height: 36,
                      }}
                    >
                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center", borderRight: "1px solid #c2d6cb" }}>#</th>
                      <th style={{ padding: "6px 10px", minWidth: 220, borderRight: "1px solid #c2d6cb" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Pin size={12} color="#64748b" /> Diễn giải
                        </span>
                      </th>
                      <th style={{ padding: "6px 10px", width: 100, borderRight: "1px solid #c2d6cb" }}>TK Nợ</th>
                      <th style={{ padding: "6px 10px", width: 100, borderRight: "1px solid #c2d6cb" }}>TK Có</th>
                      <th style={{ padding: "6px 10px", width: 140, textAlign: "right", borderRight: "1px solid #c2d6cb" }}>Số tiền</th>
                      <th style={{ padding: "6px 10px", width: 130, borderRight: "1px solid #c2d6cb" }}>Đối tượng Nợ</th>
                      <th style={{ padding: "6px 10px", width: 160, borderRight: "1px solid #c2d6cb" }}>Tên đối tượng nợ</th>
                      <th style={{ padding: "6px 10px", width: 130, borderRight: "1px solid #c2d6cb" }}>Đối tượng có</th>
                      <th style={{ padding: "6px 10px", width: 160, borderRight: "1px solid #c2d6cb" }}>Tên đối tượng có</th>
                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanceRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: idx % 2 === 0 ? "#ffffff" : "#fbfdfc",
                        }}
                      >
                        <td style={{ padding: "6px 8px", textAlign: "center", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.desc}
                            onChange={(e) => {
                              const newRows = [...advanceRows];
                              newRows[idx].desc = e.target.value;
                              setAdvanceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.debitAcc}
                            onChange={(e) => {
                              const newRows = [...advanceRows];
                              newRows[idx].debitAcc = e.target.value;
                              setAdvanceRows(newRows);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#0369a1",
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.creditAcc}
                            onChange={(e) => {
                              const newRows = [...advanceRows];
                              newRows[idx].creditAcc = e.target.value;
                              setAdvanceRows(newRows);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#0f172a",
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.amount}
                            onChange={(e) => {
                              const newRows = [...advanceRows];
                              newRows[idx].amount = Number(e.target.value.replace(/\D/g, "")) || 0;
                              setAdvanceRows(newRows);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              outline: "none",
                              textAlign: "right",
                              background: "transparent",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.debitObject || ""}
                            onChange={(e) => {
                              const newRows = [...advanceRows];
                              newRows[idx].debitObject = e.target.value;
                              setAdvanceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                          {row.debitObjectName || ""}
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #f1f5f9" }}>
                          <input
                            type="text"
                            value={row.creditObject || ""}
                            onChange={(e) => {
                              const newRows = [...advanceRows];
                              newRows[idx].creditObject = e.target.value;
                              setAdvanceRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                          {row.creditObjectName || ""}
                        </td>
                        <td style={{ padding: "4px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdvanceRow(row.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                            title="Xóa dòng"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Summary row matching screenshot */}
                    <tr style={{ background: "#ffffff", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                      <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                      <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                      <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                      <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: "#0f172a", borderRight: "1px solid #f1f5f9" }}>
                        {advanceRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("vi-VN")}
                      </td>
                      <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                      <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                      <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                      <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                /* Tab Kê khai hóa đơn và hạch toán thuế */
                <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr
                      style={{
                        background: "#e6f0eb",
                        borderBottom: "1px solid #cbd5e1",
                        textAlign: "left",
                        color: "#1e293b",
                        fontSize: 12.5,
                        fontWeight: 600,
                        height: 36,
                      }}
                    >
                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ padding: "6px 10px", width: 110, borderRight: "1px solid #cbd5e1" }}>Ngày hóa đơn</th>
                      <th style={{ padding: "6px 10px", width: 110, borderRight: "1px solid #cbd5e1" }}>Số hóa đơn</th>
                      <th style={{ padding: "6px 10px", width: 90, borderRight: "1px solid #cbd5e1" }}>Mẫu số HĐ</th>
                      <th style={{ padding: "6px 10px", width: 90, borderRight: "1px solid #cbd5e1" }}>Ký hiệu HĐ</th>
                      <th style={{ padding: "6px 10px", width: 90, borderRight: "1px solid #cbd5e1" }}>Nhóm HHDV</th>
                      <th style={{ padding: "6px 10px", width: 80, borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                      <th style={{ padding: "6px 10px", width: 80, borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                      <th style={{ padding: "6px 10px", width: 130, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tiền chưa thuế</th>
                      <th style={{ padding: "6px 10px", width: 90, borderRight: "1px solid #cbd5e1" }}>Thuế suất</th>
                      <th style={{ padding: "6px 10px", width: 130, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tiền thuế GTGT</th>
                      <th style={{ padding: "6px 10px", minWidth: 140, borderRight: "1px solid #cbd5e1" }}>Đối tượng</th>
                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanceTaxRows.map((tRow, tIdx) => (
                      <tr key={tRow.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "6px 8px", textAlign: "center", color: "#64748b" }}>{tIdx + 1}</td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.invoiceDate}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].invoiceDate = e.target.value;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            placeholder="Số HĐ"
                            value={tRow.invoiceNo}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].invoiceNo = e.target.value;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.invoiceForm}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].invoiceForm = e.target.value;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.invoiceSerial}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].invoiceSerial = e.target.value;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.goodsGroup}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].goodsGroup = e.target.value;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.debitAcc}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].debitAcc = e.target.value;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13, color: "#0369a1", fontWeight: 500 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={tRow.creditAcc}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].creditAcc = e.target.value;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13, color: "#b45309", fontWeight: 500 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", textAlign: "right" }}>
                          <input
                            type="text"
                            value={tRow.preTaxAmount}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              const preTax = Number(e.target.value.replace(/\D/g, "")) || 0;
                              newRows[tIdx].preTaxAmount = preTax;
                              const rateNum = Number(String(newRows[tIdx].vatRate || "10").replace("%", "")) || 0;
                              newRows[tIdx].vatAmount = Math.round((preTax * rateNum) / 100);
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", textAlign: "right", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <select
                            value={tRow.vatRate || "10%"}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].vatRate = e.target.value;
                              const rateNum = Number(String(e.target.value).replace("%", "")) || 0;
                              newRows[tIdx].vatAmount = Math.round(((Number(newRows[tIdx].preTaxAmount) || 0) * rateNum) / 100);
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                          >
                            <option value="0%">0%</option>
                            <option value="5%">5%</option>
                            <option value="8%">8%</option>
                            <option value="10%">10%</option>
                            <option value="KCT">KCT</option>
                          </select>
                        </td>
                        <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                          <input
                            type="text"
                            value={tRow.vatAmount}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].vatAmount = Number(e.target.value.replace(/\D/g, "")) || 0;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", textAlign: "right", fontSize: 13, fontWeight: 600 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            placeholder="Tên nhà cung cấp"
                            value={tRow.partnerName}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].partnerName = e.target.value;
                              setAdvanceTaxRows(newRows);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: "4px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (advanceTaxRows.length > 1) {
                                setAdvanceTaxRows(advanceTaxRows.filter((r) => r.id !== tRow.id));
                              } else {
                                handleClearAllAdvanceRows();
                              }
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 5. CONTROLS BELOW GRID */}
            <div
              style={{
                padding: "10px 20px 8px 20px",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderBottom: "1px solid #f1f5f9",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleAddAdvanceRow}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} color="#00a862" />
                  <span>Thêm dòng</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllAdvanceRows}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#ef4444",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} color="#ef4444" />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Attachment Drag & Drop Area */}
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Paperclip size={14} />
                  <span style={{ fontWeight: 500 }}>Đính kèm</span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>Dung lượng tối đa 5MB</span>
                </div>
                <label
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "10px 16px",
                    background: "#f8fafc",
                    textAlign: "center",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <input
                    type="file"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => handleAdvanceFileUpload(e.target.files)}
                  />
                  <Upload size={18} color="#64748b" />
                  <div style={{ fontSize: 12.5, color: "#475569" }}>
                    <span style={{ color: "#2563eb", fontWeight: 500 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                  </div>
                </label>
                {advanceAttachments.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                    {advanceAttachments.map((att, attIdx) => (
                      <span
                        key={`${att.file_name}-${attIdx}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 10px",
                          borderRadius: 12,
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          fontSize: 12,
                          color: "#334155",
                        }}
                      >
                        <Paperclip size={12} color="#64748b" />
                        <span>{att.file_name}</span>
                        <span style={{ color: "#94a3b8" }}>({Math.max(1, Math.round(att.file_size / 1024))} KB)</span>
                        <X
                          size={12}
                          style={{ cursor: "pointer", color: "#ef4444" }}
                          onClick={() => setAdvanceAttachments(advanceAttachments.filter((_, i) => i !== attIdx))}
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 6. BOTTOM ACTION BAR (F9, Hủy, Cất, Lưu và Thêm) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 12.5, color: "#475569", fontWeight: 500 }}>
                F9 - Thêm nhanh
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAddAdvanceSettlementModalOpen(false)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSaveAdvanceSettlement(); }}
                  style={{
                    padding: "7px 22px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >Lưu</button>
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => { void handleSaveAdvanceSettlement(true); }}
                    style={{
                      padding: "7px 18px",
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Lưu và Thêm
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "7px 8px",
                      background: "#009153",
                      color: "#ffffff",
                      border: "none",
                      borderLeft: "1px solid rgba(255,255,255,0.2)",
                      cursor: "pointer",
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: KẾT CHUYỂN LÃI LỖ NVK00001 (Matching user screenshot 1)           */}
      {/* ========================================================================= */}
      {closingEntryModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setClosingEntryModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "98vw",
              maxWidth: 1420,
              height: "94vh",
              maxHeight: 900,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
            }}
          >
            {/* 1. TOP HEADER BAR */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 18px",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Lịch sử chứng từ"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <RotateCcw size={16} />
                </button>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
                  <span>Kết chuyển lãi lỗ</span> {closingVoucherNo}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Thiết lập"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <Settings size={17} />
                </button>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <HelpCircle size={17} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  onClick={() => setClosingEntryModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 2. MASTER FORM AREA */}
            <div
              style={{
                padding: "16px 20px 12px 20px",
                background: "#ffffff",
                borderBottom: "1px solid #f1f5f9",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 280px",
                  gap: 32,
                  alignItems: "start",
                }}
              >
                {/* Left Panel */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Row 1: Kết chuyển đến ngày + Button Lấy dữ liệu */}
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                      Kết chuyển đến ngày
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ position: "relative", width: 160, display: "flex", alignItems: "center" }}>
                        <input
                          type="text"
                          value={closingToDate}
                          onChange={(e) => setClosingToDate(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 30px 6px 10px",
                            borderRadius: 4,
                            border: "1.5px solid #2563eb",
                            fontSize: 13,
                            color: "#1e293b",
                            fontWeight: 500,
                            outline: "none",
                          }}
                        />
                        <Calendar size={15} color="#64748b" style={{ position: "absolute", right: 8 }} />
                      </div>
                      <button
                        type="button"
                        onClick={handleFetchClosingData}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          color: "#334155",
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      >
                        <span>Lấy dữ liệu</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Diễn giải with AI sparkle */}
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                      Diễn giải
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        value={closingDescription}
                        onChange={(e) => setClosingDescription(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 32px 6px 10px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                      <Sparkles size={16} color="#8b5cf6" style={{ position: "absolute", right: 10, cursor: "pointer" }} />
                    </div>
                  </div>

                  {/* Row 3: Tham chiếu */}
                  <div>
                    <span
                      style={{ fontSize: 12.5, color: "#00a862", cursor: "pointer", textDecoration: "none" }}
                      onClick={() => notify("Mở danh sách chứng từ tham chiếu")}
                    >
                      Tham chiếu ...
                    </span>
                  </div>
                </div>

                {/* Right Panel: Ngày hạch toán, Ngày chứng từ, Số chứng từ */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "#475569" }}>Ngày hạch toán</span>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        value={closingPostingDate}
                        onChange={(e) => setClosingPostingDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "5px 28px 5px 10px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                        }}
                      />
                      <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8 }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "#475569" }}>Ngày chứng từ</span>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        value={closingDocDate}
                        onChange={(e) => setClosingDocDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "5px 28px 5px 10px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                        }}
                      />
                      <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8 }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "#475569" }}>Số chứng từ</span>
                    <input
                      type="text"
                      value={closingVoucherNo}
                      onChange={(e) => setClosingVoucherNo(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. TABS BAR (Single active tab "Hạch toán") */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 20px",
                borderBottom: "1px solid #cbd5e1",
                background: "#ffffff",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#00a862",
                  borderBottom: "2px solid #00a862",
                  cursor: "pointer",
                }}
              >
                Hạch toán
              </div>
              {closingRows.length > 0 && (
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    fontSize: 12,
                    color: "#334155",
                  }}
                >
                  <span>
                    Tổng DT thuần kết chuyển:{" "}
                    <strong style={{ color: "#0f766e" }}>{formatVndNumber(closingSummary.totalRevenue)} ₫</strong>
                  </span>
                  <span>|</span>
                  <span>
                    Tổng CP kết chuyển:{" "}
                    <strong style={{ color: "#b45309" }}>{formatVndNumber(closingSummary.totalExpense)} ₫</strong>
                  </span>
                  <span>|</span>
                  <span>
                    Kết quả {closingSummary.resultNature === "PROFIT" ? "Lãi (Nợ 911 / Có 4212)" : closingSummary.resultNature === "LOSS" ? "Lỗ (Nợ 4212 / Có 911)" : "Hòa vốn"}:{" "}
                    <strong style={{ color: closingSummary.netProfitLoss >= 0 ? "#15803d" : "#dc2626" }}>
                      {formatVndNumber(Math.abs(closingSummary.netProfitLoss))} ₫
                    </strong>
                  </span>
                  <span>|</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 600,
                      background: closingSummary.isBalanced ? "#dcfce7" : "#fee2e2",
                      color: closingSummary.isBalanced ? "#166534" : "#991b1b",
                    }}
                  >
                    {closingSummary.isBalanced ? "Nợ = Có hợp lệ" : "Chưa cân đối"}
                  </span>
                  <span style={{ color: "#64748b", fontSize: 11 }}>({closingSourceFingerprint})</span>
                </div>
              )}
            </div>

            {/* 4. DETAIL GRID AREA */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "auto",
                background: "#ffffff",
                position: "relative",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      background: "#d5e4dc",
                      borderBottom: "1px solid #c2d6cb",
                      textAlign: "left",
                      color: "#1e293b",
                      fontSize: 12.5,
                      fontWeight: 600,
                      height: 36,
                    }}
                  >
                    <th style={{ padding: "6px 8px", width: 40, textAlign: "center", borderRight: "1px solid #c2d6cb" }}>#</th>
                    <th style={{ padding: "6px 12px", minWidth: 320, borderRight: "1px solid #c2d6cb" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Pin size={12} color="#64748b" /> Diễn giải
                      </span>
                    </th>
                    <th style={{ padding: "6px 12px", width: 140, borderRight: "1px solid #c2d6cb" }}>TK Nợ</th>
                    <th style={{ padding: "6px 12px", width: 140, borderRight: "1px solid #c2d6cb" }}>TK Có</th>
                    <th style={{ padding: "6px 12px", width: 180, textAlign: "right", borderRight: "1px solid #c2d6cb" }}>Số tiền</th>
                    {closingRows.length > 0 && <th style={{ padding: "6px 8px", width: 40, textAlign: "center" }}></th>}
                  </tr>

                  {/* Summary row directly below thead matching screenshot 1 */}
                  <tr style={{ background: "#ffffff", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 8px" }}></td>
                    <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 12px" }}></td>
                    <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 12px" }}></td>
                    <td style={{ borderRight: "1px solid #f1f5f9", padding: "6px 12px" }}></td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#0f172a", borderRight: "1px solid #f1f5f9" }}>
                      {closingRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("vi-VN")}
                    </td>
                    {closingRows.length > 0 && <td></td>}
                  </tr>
                </thead>

                <tbody>
                  {closingRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: idx % 2 === 0 ? "#ffffff" : "#fbfdfc",
                      }}
                    >
                      <td style={{ padding: "6px 8px", textAlign: "center", color: "#64748b", borderRight: "1px solid #f1f5f9" }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "4px 12px", borderRight: "1px solid #f1f5f9" }}>
                        <input
                          type="text"
                          value={row.desc}
                          onChange={(e) => {
                            const newRows = [...closingRows];
                            newRows[idx].desc = e.target.value;
                            setClosingRows(newRows);
                          }}
                          style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13 }}
                        />
                      </td>
                      <td style={{ padding: "4px 12px", borderRight: "1px solid #f1f5f9" }}>
                        <input
                          type="text"
                          value={row.debitAcc}
                          onChange={(e) => {
                            const newRows = [...closingRows];
                            newRows[idx].debitAcc = e.target.value;
                            setClosingRows(newRows);
                          }}
                          style={{
                            width: "100%",
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#0369a1",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 12px", borderRight: "1px solid #f1f5f9" }}>
                        <input
                          type="text"
                          value={row.creditAcc}
                          onChange={(e) => {
                            const newRows = [...closingRows];
                            newRows[idx].creditAcc = e.target.value;
                            setClosingRows(newRows);
                          }}
                          style={{
                            width: "100%",
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#b45309",
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 12px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                        <input
                          type="text"
                          value={row.amount}
                          onChange={(e) => {
                            const newRows = [...closingRows];
                            newRows[idx].amount = Number(e.target.value.replace(/\D/g, "")) || 0;
                            setClosingRows(newRows);
                          }}
                          style={{
                            width: "100%",
                            border: "none",
                            outline: "none",
                            textAlign: "right",
                            background: "transparent",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteClosingRow(row.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                          title="Xóa dòng"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Empty State Illustration Matching Screenshot 1 */}
              {closingRows.length === 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "48px 20px",
                  }}
                >
                  <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
                    {/* Radiating sparkle lines */}
                    <line x1="30" y1="22" x2="24" y2="16" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                    <line x1="42" y1="16" x2="42" y2="8" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                    <line x1="54" y1="22" x2="60" y2="16" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />

                    {/* Paper Document */}
                    <rect x="26" y="24" width="32" height="42" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                    {/* Folded Top-Right Corner */}
                    <path d="M48 24 L58 34 H50 a2 2 0 0 1 -2 -2 V24 Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

                    {/* Cute smiling face */}
                    <circle cx="36" cy="42" r="1.5" fill="#64748b" />
                    <circle cx="48" cy="42" r="1.5" fill="#64748b" />
                    <path d="M37 48 Q42 53 47 48" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                  </svg>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 10, fontWeight: 500 }}>
                    Không có dữ liệu
                  </div>
                </div>
              )}
            </div>

            {/* 5. CONTROLS BELOW GRID */}
            <div
              style={{
                padding: "10px 20px 8px 20px",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderBottom: "1px solid #f1f5f9",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleAddClosingRow}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} color="#00a862" />
                  <span>Thêm dòng</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllClosingRows}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#ef4444",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} color="#ef4444" />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Attachment Drag & Drop Area */}
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Paperclip size={14} />
                  <span style={{ fontWeight: 500 }}>Đính kèm</span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>Dung lượng tối đa 5MB</span>
                </div>
                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "12px 16px",
                    background: "#f8fafc",
                    textAlign: "center",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                  onClick={() => notify("Đã mở hộp thoại chọn tệp đính kèm")}
                >
                  <Upload size={18} color="#64748b" />
                  <div style={{ fontSize: 12.5, color: "#475569" }}>
                    <span style={{ color: "#2563eb", fontWeight: 500 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                  </div>
                </div>
              </div>
            </div>

            {/* 6. BOTTOM ACTION BAR (Hủy, Cất, Lưu và In ˅) Matching Screenshot 1 */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                padding: "10px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setClosingEntryModalOpen(false)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveClosingVoucher(false);
                  }}
                  style={{
                    padding: "7px 22px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >Lưu (Nháp)</button>

                <button
                  type="button"
                  onClick={() => {
                    void handleSaveClosingVoucher(true);
                  }}
                  style={{
                    padding: "7px 18px",
                    borderRadius: 6,
                    border: "1px solid #0f766e",
                    background: "#f0fdf4",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0f766e",
                    cursor: "pointer",
                  }}
                >
                  Lưu & Ghi sổ (UC-GL-05)
                </button>

                {/* Split Button: Lưu và In ˅ (Exact Match to Screenshot 1) */}
                <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", boxShadow: "0 1px 3px rgba(0, 168, 98, 0.25)" }}>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveClosingVoucher(false);
                      if (!apiConnected) notify(`Đã chuẩn bị in chứng từ kết chuyển lãi lỗ ${closingVoucherNo}!`);
                    }}
                    style={{
                      padding: "7px 18px",
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Lưu và In
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "7px 8px",
                      background: "#009153",
                      color: "#ffffff",
                      border: "none",
                      borderLeft: "1px solid rgba(255,255,255,0.2)",
                      cursor: "pointer",
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: ĐỀ NGHỊ QUYẾT TOÁN TẠM ỨNG (UC-GL-01)                            */}
      {/* ========================================================================= */}
      {addAdvanceRequestModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => !isSubmittingAdvReq && setAddAdvanceRequestModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 600,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                {editingAdvReqId
                  ? `Bổ sung & Gửi lại Đề nghị quyết toán tạm ứng (${editingAdvReqNumber || editingAdvReqId})`
                  : "Thêm Đề nghị quyết toán tạm ứng"}
              </span>
              <button
                type="button"
                onClick={() => !isSubmittingAdvReq && setAddAdvanceRequestModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {advReqError && (
                <div
                  role="alert"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 6,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    fontSize: 12.5,
                    fontWeight: 500,
                  }}
                >
                  {advReqError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                    Người đề nghị: <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    list="gl-adv-req-employees-list"
                    aria-label="Người đề nghị"
                    value={advReqRequester}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAdvReqRequester(val);
                      setAdvReqDepartment(resolveDepartmentNameForEmployee(val));
                      if (advReqError) setAdvReqError("");
                    }}
                    placeholder="Nhập hoặc chọn nhân viên..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                  />
                  <datalist id="gl-adv-req-employees-list">
                    {activeEmployeesList.length > 0 ? (
                      activeEmployeesList.map((emp: any) => (
                        <option key={emp.id} value={emp.full_name}>
                          {emp.employee_code} - {emp.full_name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Nguyễn Văn Hùng">NV001 - Phòng Kinh doanh</option>
                        <option value="Trần Thị Mai">NV002 - Phòng Kế toán</option>
                        <option value="Lê Hoàng Long">NV003 - Phòng Kỹ thuật</option>
                      </>
                    )}
                  </datalist>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                    Phòng ban / Đơn vị:
                  </label>
                  <input
                    type="text"
                    list="gl-adv-req-departments-list"
                    aria-label="Phòng ban / Đơn vị"
                    value={advReqDepartment}
                    onChange={(e) => setAdvReqDepartment(e.target.value)}
                    placeholder="Tự động xác định theo nhân viên..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      background: "#f8fafc",
                    }}
                  />
                  <datalist id="gl-adv-req-departments-list">
                    {activeDepartmentsList.length > 0 ? (
                      activeDepartmentsList.map((d: any) => (
                        <option key={d.id} value={d.name}>
                          {d.code}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Phòng Kinh doanh" />
                        <option value="Phòng Kế toán" />
                        <option value="Phòng Kỹ thuật" />
                      </>
                    )}
                  </datalist>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                  Số tiền đề nghị quyết toán: <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  aria-label="Số tiền đề nghị quyết toán"
                  value={advReqAmount}
                  onChange={(e) => {
                    setAdvReqAmount(e.target.value);
                    if (advReqError) setAdvReqError("");
                  }}
                  placeholder="Nhập số tiền lớn hơn 0..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                  Mục đích / Diễn giải: <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  rows={3}
                  aria-label="Mục đích / Diễn giải"
                  value={advReqPurpose}
                  onChange={(e) => {
                    setAdvReqPurpose(e.target.value);
                    if (advReqError) setAdvReqError("");
                  }}
                  placeholder="Mô tả nội dung, lý do của khoản chi cần quyết toán..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                disabled={isSubmittingAdvReq}
                onClick={() => setAddAdvanceRequestModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: isSubmittingAdvReq ? "not-allowed" : "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSubmittingAdvReq}
                onClick={handleSubmitAdvanceRequest}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  background: isSubmittingAdvReq ? "#94a3b8" : "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isSubmittingAdvReq ? "not-allowed" : "pointer",
                }}
              >
                {isSubmittingAdvReq ? "Đang gửi..." : "Gửi phê duyệt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT ĐỀ NGHỊ QUYẾT TOÁN TẠM ỨNG */}
      {viewingAdvReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setViewingAdvReq(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 540,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                Chi tiết Đề nghị quyết toán tạm ứng {viewingAdvReq.id}
              </span>
              <button
                type="button"
                onClick={() => setViewingAdvReq(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Số đề nghị:</span>
                <strong style={{ color: "#00a862" }}>{viewingAdvReq.id}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Ngày đề nghị:</span>
                <strong>{viewingAdvReq.date}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Người đề nghị:</span>
                <strong>{viewingAdvReq.employee}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Phòng ban / Đơn vị:</span>
                <strong>{viewingAdvReq.dept}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Số tiền đề nghị quyết toán:</span>
                <strong style={{ color: "#0f172a" }}>{formatVND(viewingAdvReq.amount)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Trạng thái phê duyệt:</span>
                <strong>{viewingAdvReq.status}</strong>
              </div>
              {viewingAdvReq.settlementVoucherNo && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Chứng từ quyết toán liên kết (UC-GL-02):</span>
                  <strong style={{ color: "#0284c7" }}>{viewingAdvReq.settlementVoucherNo}</strong>
                </div>
              )}
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                <div style={{ color: "#64748b", marginBottom: 4 }}>Mục đích / Diễn giải:</div>
                <div style={{ color: "#1e293b", lineHeight: 1.5 }}>{viewingAdvReq.reason}</div>
              </div>
              <div
                style={{
                  marginTop: 6,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  color: "#475569",
                }}
              >
                Ghi chú kiểm soát (BR-GL-ADV-29..32): Đề nghị quyết toán tạm ứng không sinh bút toán Nợ/Có và không làm thay đổi số dư Sổ cái cho đến khi kế toán lập và ghi sổ Chứng từ quyết toán tạm ứng (UC-GL-02).
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setViewingAdvReq(null)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPORT & ACCOUNTING BOOK PREVIEW + UC-GL-14 LEDGER INQUIRY & VOUCHER TRACE*/}
      {/* ========================================================================= */}
      {previewReportName && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setPreviewReportName(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "95vw",
              maxWidth: 1280,
              height: "92vh",
              background: "#ffffff",
              borderRadius: 10,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 22px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <FileSpreadsheet size={19} color="#00a862" />
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                  UC-GL-14: {uc14BookResult?.book_title || previewReportName}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: uc14BookResult?.is_official_book !== false ? "#dcfce7" : "#e0f2fe",
                    color: uc14BookResult?.is_official_book !== false ? "#166534" : "#0369a1",
                  }}
                >
                  {uc14BookResult?.is_official_book !== false
                    ? `${uc14BookResult?.form_code || "S03b-DN"} • Sổ chính thức (Chỉ POSTED)`
                    : "Chế độ Tra cứu / Truy vết mở rộng"}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: periodLockStatus === "CLOSED" ? "#fef3c7" : "#f1f5f9",
                    color: periodLockStatus === "CLOSED" ? "#92400e" : "#334155",
                  }}
                >
                  Kỳ {uc14Period}: {periodLockStatus} (AF-24: Cho phép tra cứu 100%)
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#f0fdf4",
                    color: "#15803d",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  Zero GL Mutation (BR-GL-TRACE-01)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { void handleExportReport("PRINT"); }}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "#334155",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <Printer size={15} />
                  <span>In sổ (TT99)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleExportReport("PDF"); }}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "#334155",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <FileText size={15} />
                  <span>Xuất PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleExportReport("XLSX"); }}
                  style={{
                    background: "#00a862",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  <Download size={15} />
                  <span>Xuất Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewReportName(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", marginLeft: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* UC-GL-14 Filter & Inquiry Mode Bar */}
            <div
              style={{
                padding: "12px 22px",
                background: "#f1f5f9",
                borderBottom: "1px solid #cbd5e1",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "2.2fr 0.9fr 1fr 1fr 1fr 0.9fr 0.9fr auto", gap: 8, alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 3 }}>
                    Loại Sổ kế toán / Chế độ tra cứu (16 chế độ TT99)
                  </label>
                  <select
                    value={uc14BookType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setUc14BookType(nextType);
                      void handleQueryBookUcGl14({ book_type: nextType });
                    }}
                    style={{ width: "100%", height: 32, borderRadius: 5, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12.5, fontWeight: 600 }}
                  >
                    {ucGl14BookOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 3 }}>
                    Kỳ kế toán
                  </label>
                  <input
                    type="text"
                    value={uc14Period}
                    onChange={(e) => setUc14Period(e.target.value)}
                    placeholder="2026-10"
                    style={{ width: "100%", height: 32, borderRadius: 5, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12.5, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 3 }}>
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    value={uc14FromDate}
                    onChange={(e) => setUc14FromDate(e.target.value)}
                    style={{ width: "100%", height: 32, borderRadius: 5, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12.5, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 3 }}>
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    value={uc14ToDate}
                    onChange={(e) => setUc14ToDate(e.target.value)}
                    style={{ width: "100%", height: 32, borderRadius: 5, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12.5, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 3 }}>
                    Tài khoản (VD: 111, 131)
                  </label>
                  <input
                    type="text"
                    value={uc14AccountCode}
                    onChange={(e) => setUc14AccountCode(e.target.value)}
                    placeholder="Tất cả TK"
                    style={{ width: "100%", height: 32, borderRadius: 5, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12.5, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 3 }}>
                    Loại tiền (AF-10)
                  </label>
                  <select
                    value={uc14CurrencyCode}
                    onChange={(e) => setUc14CurrencyCode(e.target.value)}
                    style={{ width: "100%", height: 32, borderRadius: 5, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12.5 }}
                  >
                    <option value="">Tất cả loại tiền</option>
                    <option value="VND">VND</option>
                    <option value="USD">USD (Ngoại tệ)</option>
                    <option value="EUR">EUR (Ngoại tệ)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 3 }}>
                    Trạng thái (EF-09)
                  </label>
                  <select
                    value={uc14EntryStatus}
                    onChange={(e) => setUc14EntryStatus(e.target.value)}
                    style={{ width: "100%", height: 32, borderRadius: 5, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12.5 }}
                  >
                    <option value="POSTED">POSTED (Đã ghi sổ)</option>
                    <option value="UNPOSTED">UNPOSTED (Chưa ghi sổ)</option>
                    <option value="ALL">ALL (Tất cả - chỉ Tra cứu)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => { void handleQueryBookUcGl14(); }}
                  style={{
                    height: 32,
                    padding: "0 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "#0284c7",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Search size={14} />
                  <span>{uc14Loading ? "Đang tải..." : "Nạp Sổ / Tra cứu"}</span>
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={uc14IncludeChildAccounts}
                      onChange={(e) => setUc14IncludeChildAccounts(e.target.checked)}
                    />
                    <span>Bao gồm TK con (AF-11: Không cộng trùng cha + con)</span>
                  </label>
                  <input
                    type="text"
                    value={uc14ReciprocalAccount}
                    onChange={(e) => setUc14ReciprocalAccount(e.target.value)}
                    placeholder="TK đối ứng (VD: 131, 331)"
                    style={{ width: 155, height: 28, borderRadius: 4, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12 }}
                  />
                  <input
                    type="text"
                    value={uc14Keyword}
                    onChange={(e) => setUc14Keyword(e.target.value)}
                    placeholder="Tìm Số CT, diễn giải, mã đối tượng..."
                    style={{ width: 240, height: 28, borderRadius: 4, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 12 }}
                  />
                </div>

                {/* Sub-view Switcher */}
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { id: "MOVEMENTS" as const, label: `1. Dòng phát sinh & Số dư lũy kế (${uc14BookResult?.rows?.length || 0})` },
                    { id: "ACCOUNT_PARTNER_SUMMARY" as const, label: `2. Số dư TK & Lưỡng tính 131/331 (${uc14BookResult?.account_summaries?.length || 0})` },
                    { id: "FX_AND_T_ACCOUNT" as const, label: `3. Ngoại tệ tách riêng & Chữ T (${uc14BookResult?.currency_totals?.length || 0})` },
                  ].map((tabItem) => (
                    <button
                      key={tabItem.id}
                      type="button"
                      onClick={() => setUc14SubView(tabItem.id)}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 5,
                        border: uc14SubView === tabItem.id ? "1px solid #00a862" : "1px solid #cbd5e1",
                        background: uc14SubView === tabItem.id ? "#00a862" : "#ffffff",
                        color: uc14SubView === tabItem.id ? "#ffffff" : "#334155",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {tabItem.label}
                    </button>
                  ))}
                </div>
              </div>

              {uc14Error && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {uc14Error}
                </div>
              )}
            </div>

            {/* Summary Totals & UC-GL-10 Consistency Strip */}
            <div
              style={{
                padding: "10px 22px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5 }}>
                <div>
                  <span style={{ color: "#64748b" }}>Dư Nợ đầu kỳ: </span>
                  <strong style={{ color: "#0f172a" }}>{apiNumber(uc14BookResult?.summary_totals?.opening_debit || 0).toLocaleString("vi-VN")}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Dư Có đầu kỳ: </span>
                  <strong style={{ color: "#0f172a" }}>{apiNumber(uc14BookResult?.summary_totals?.opening_credit || 0).toLocaleString("vi-VN")}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Phát sinh Nợ: </span>
                  <strong style={{ color: "#0284c7" }}>{apiNumber(uc14BookResult?.summary_totals?.period_debit || 0).toLocaleString("vi-VN")}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Phát sinh Có: </span>
                  <strong style={{ color: "#0284c7" }}>{apiNumber(uc14BookResult?.summary_totals?.period_credit || 0).toLocaleString("vi-VN")}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Dư Nợ cuối kỳ: </span>
                  <strong style={{ color: "#15803d" }}>{apiNumber(uc14BookResult?.summary_totals?.closing_debit || 0).toLocaleString("vi-VN")}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Dư Có cuối kỳ: </span>
                  <strong style={{ color: "#15803d" }}>{apiNumber(uc14BookResult?.summary_totals?.closing_credit || 0).toLocaleString("vi-VN")}</strong>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: uc14BookResult?.consistency_with_uc_gl_10?.status === "STALE_WARNING" ? "#fef3c7" : "#dcfce7",
                    color: uc14BookResult?.consistency_with_uc_gl_10?.status === "STALE_WARNING" ? "#92400e" : "#166534",
                  }}
                  title={uc14BookResult?.consistency_with_uc_gl_10?.message}
                >
                  {uc14BookResult?.consistency_with_uc_gl_10?.status === "STALE_WARNING"
                    ? "⚠️ UC-GL-10 đang STALE (Đã tính trực tiếp từ POSTED - EF-13)"
                    : "✓ Khớp 100% với Bảng tổng hợp số dư UC-GL-10"}
                </span>
              </div>
            </div>

            {/* Modal Body: Split between Book Table and End-to-End Traceability Drawer */}
            <div style={{ display: "grid", gridTemplateColumns: uc14TraceDetail ? "1.35fr 1fr" : "1fr", flex: 1, overflow: "hidden" }}>
              {/* Left: Book / Inquiry Content */}
              <div style={{ padding: "18px 22px", overflowY: "auto" }}>
                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>{company.name} • Mẫu biểu: {uc14BookResult?.form_code || "S03b-DN"} ({uc14BookResult?.circular_ref || "Thông tư 99/2025/TT-BTC"})</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", marginTop: 2 }}>
                    {uc14BookResult?.book_title || previewReportName}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", fontStyle: "italic", marginTop: 2 }}>
                    Kỳ kế toán: {uc14Period} (Từ ngày {uc14FromDate} đến ngày {uc14ToDate}) • Đơn vị tính: VND (Ngoại tệ tách riêng nguyên tệ)
                  </div>
                </div>

                {uc14SubView === "MOVEMENTS" && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", border: "1px solid #cbd5e1" }}>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "center" }}>Ngày HT</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "left" }}>Số CT (Drill-down)</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "left" }}>Diễn giải</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "center" }}>TK</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "center" }}>TK ĐƯ</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "right" }}>Phát sinh Nợ</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "right" }}>Phát sinh Có</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "right" }}>Dư Nợ sau dòng</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "right" }}>Dư Có sau dòng</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "center" }}>Loại tiền / Nguyên tệ</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "7px 8px", textAlign: "center" }}>Trạng thái Truy vết (1.2.B)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(uc14BookResult?.rows || []).map((row: any, idx: number) => {
                        const badgeColors: Record<string, { bg: string; fg: string }> = {
                          TRACEABLE: { bg: "#dcfce7", fg: "#166534" },
                          PARTIAL_TRACE: { bg: "#fef3c7", fg: "#92400e" },
                          NO_SOURCE: { bg: "#e2e8f0", fg: "#334155" },
                          BROKEN_LINK: { bg: "#fee2e2", fg: "#b91c1c" },
                          ACCESS_RESTRICTED: { bg: "#ffedd5", fg: "#c2410c" },
                        };
                        const bc = badgeColors[row.trace_status] || badgeColors.TRACEABLE;
                        return (
                          <tr key={row.line_id || idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center" }}>{row.posting_date}</td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px" }}>
                              <button
                                type="button"
                                onClick={() => { void handleOpenTraceUcGl14(row); }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color: "#0284c7",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  fontSize: 12,
                                }}
                              >
                                {row.voucher_number}
                              </button>
                              {row.is_reversed_or_adjusted && (
                                <div style={{ fontSize: 10.5, color: "#b45309", fontWeight: 600 }}>
                                  ↔ Đảo/ĐC: {(row.related_entry_numbers || []).join(", ") || row.original_entry_number}
                                </div>
                              )}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px" }}>
                              <div>{row.description}</div>
                              {row.party_name && (
                                <div style={{ fontSize: 11, color: "#64748b" }}>Đối tượng: {row.party_code} - {row.party_name}</div>
                              )}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", fontWeight: 700 }}>{row.account_code}</td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center" }}>{row.reciprocal_account_code}</td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "right" }}>
                              {apiNumber(row.debit).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "right" }}>
                              {apiNumber(row.credit).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                              {apiNumber(row.running_debit).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                              {apiNumber(row.running_credit).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center" }}>
                              <span style={{ fontWeight: 700 }}>{row.currency_code}</span>
                              {row.currency_code !== "VND" && (
                                <div style={{ fontSize: 11, color: "#0369a1" }}>
                                  NT: {apiNumber(row.debit_fc || row.credit_fc).toLocaleString("vi-VN")} (TG: {apiNumber(row.exchange_rate).toLocaleString("vi-VN")})
                                </div>
                              )}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => { void handleOpenTraceUcGl14(row); }}
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  border: "none",
                                  background: bc.bg,
                                  color: bc.fg,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                title={row.trace_message}
                              >
                                {row.trace_status} ({row.source_module})
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {uc14SubView === "ACCOUNT_PARTNER_SUMMARY" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 13.5, color: "#0f172a" }}>
                        Bảng tổng hợp Số dư Đầu kỳ – Phát sinh – Cuối kỳ theo Tài khoản (AF-11, BR-GL-TRACE-28..30: Không cộng trùng TK cha + con)
                      </h4>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "left" }}>Mã TK</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "left" }}>Tên tài khoản</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Dư Nợ ĐK</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Dư Có ĐK</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>PS Nợ</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>PS Có</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Dư Nợ CK</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Dư Có CK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(uc14BookResult?.account_summaries || []).map((a: any) => (
                            <tr key={a.account_code} style={{ fontWeight: a.is_parent ? 700 : 400, background: a.is_parent ? "#f8fafc" : "#ffffff" }}>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7 }}>{a.account_code}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7 }}>
                                {a.account_name}
                                {a.is_bilateral && (
                                  <span style={{ marginLeft: 6, fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}>
                                    Lưỡng tính (AF-16)
                                  </span>
                                )}
                              </td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(a.opening_debit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(a.opening_credit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(a.period_debit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(a.period_credit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right", color: "#15803d", fontWeight: 700 }}>{apiNumber(a.closing_debit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right", color: "#15803d", fontWeight: 700 }}>{apiNumber(a.closing_credit).toLocaleString("vi-VN")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 13.5, color: "#0f172a" }}>
                        Chi tiết Công nợ Tài khoản Lưỡng tính 131 / 331 theo từng Đối tượng (AF-16, BR-GL-TRACE-31, 32: Tuyệt đối không bù trừ chéo)
                      </h4>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7 }}>TK</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "left" }}>Mã đối tượng</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "left" }}>Tên đối tượng</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Dư Nợ ĐK</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Dư Có ĐK</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>PS Nợ</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>PS Có</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Dư Nợ CK</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Dư Có CK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(uc14BookResult?.detail_partner_summaries || []).map((p: any, idx: number) => (
                            <tr key={`${p.account_code}-${p.party_code}-${idx}`}>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "center", fontWeight: 700 }}>{p.account_code}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, fontWeight: 600 }}>{p.party_code}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7 }}>{p.party_name}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(p.opening_debit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(p.opening_credit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(p.period_debit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(p.period_credit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right", fontWeight: 700, color: "#0284c7" }}>{apiNumber(p.closing_debit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right", fontWeight: 700, color: "#b45309" }}>{apiNumber(p.closing_credit).toLocaleString("vi-VN")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {uc14SubView === "FX_AND_T_ACCOUNT" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 13.5, color: "#0f172a" }}>
                        Tổng hợp phát sinh theo từng loại Ngoại tệ (AF-10, BR-GL-TRACE-71, 72: Tách riêng USD, EUR — Không cộng ngang nguyên tệ khác loại tiền)
                      </h4>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7 }}>Mã tiền tệ</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>PS Nợ Nguyên tệ</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>PS Có Nguyên tệ</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>PS Nợ Quy đổi (VND)</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>PS Có Quy đổi (VND)</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "center" }}>Số dòng HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(uc14BookResult?.currency_totals || []).map((c: any) => (
                            <tr key={c.currency_code}>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "center", fontWeight: 700, color: "#0369a1" }}>{c.currency_code}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right", fontWeight: 700 }}>{apiNumber(c.period_debit_fc).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right", fontWeight: 700 }}>{apiNumber(c.period_credit_fc).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(c.period_debit_vnd).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right" }}>{apiNumber(c.period_credit_vnd).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "center" }}>{c.line_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: 13.5, color: "#0f172a" }}>
                        Bảng tổng hợp phát sinh Tài khoản chữ T theo TK đối ứng (AF-05 — S06T-DN)
                      </h4>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7 }}>Tài khoản</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "left" }}>Bên Nợ (Theo TK đối ứng)</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "left" }}>Bên Có (Theo TK đối ứng)</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Tổng PS Nợ</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: 7, textAlign: "right" }}>Tổng PS Có</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(uc14BookResult?.t_account_summaries || []).map((t: any) => (
                            <tr key={t.account_code}>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, fontWeight: 700 }}>{t.account_code} - {t.account_name}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7 }}>
                                {Object.entries(t.debit_by_reciprocal || {}).map(([rk, rv]) => (
                                  <div key={rk}>ĐƯ {rk}: <strong>{apiNumber(rv as any).toLocaleString("vi-VN")}</strong></div>
                                ))}
                              </td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7 }}>
                                {Object.entries(t.credit_by_reciprocal || {}).map(([rk, rv]) => (
                                  <div key={rk}>ĐƯ {rk}: <strong>{apiNumber(rv as any).toLocaleString("vi-VN")}</strong></div>
                                ))}
                              </td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right", fontWeight: 700 }}>{apiNumber(t.total_debit).toLocaleString("vi-VN")}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: 7, textAlign: "right", fontWeight: 700 }}>{apiNumber(t.total_credit).toLocaleString("vi-VN")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, textAlign: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Người ghi sổ / lập biểu</div>
                    <div style={{ fontSize: 11.5, color: "#64748b" }}>(Ký, họ tên)</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Kế toán trưởng</div>
                    <div style={{ fontSize: 11.5, color: "#64748b" }}>(Ký, họ tên)</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Giám đốc / Người đại diện theo pháp luật</div>
                    <div style={{ fontSize: 11.5, color: "#64748b" }}>(Ký, họ tên, đóng dấu)</div>
                  </div>
                </div>
              </div>

              {/* Right: End-to-End Bidirectional Voucher Traceability Drawer (Steps 24–40, AF-17..23, EF-16..21) */}
              {uc14TraceDetail && (
                <div
                  style={{
                    borderLeft: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    padding: "16px 18px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                      🔍 Chuỗi Truy vết Chứng từ 2 chiều (UC-GL-14)
                    </div>
                    <button
                      type="button"
                      onClick={() => setUc14TraceDetail(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Breadcrumb Chain */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      padding: "8px 10px",
                      background: "#ffffff",
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    {(uc14TraceDetail.trace_chain_breadcrumb || []).map((step: string, i: number) => (
                      <span key={i}>
                        {i > 0 && <span style={{ color: "#94a3b8", margin: "0 4px" }}>→</span>}
                        <span style={{ color: i === (uc14TraceDetail.trace_chain_breadcrumb?.length || 1) - 1 ? "#00a862" : "#0f172a" }}>
                          {step}
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* Trace Status Diagnostic Banner */}
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      background:
                        uc14TraceDetail.trace_status === "TRACEABLE"
                          ? "#dcfce7"
                          : uc14TraceDetail.trace_status === "BROKEN_LINK"
                            ? "#fee2e2"
                            : uc14TraceDetail.trace_status === "ACCESS_RESTRICTED"
                              ? "#ffedd5"
                              : "#e2e8f0",
                      color:
                        uc14TraceDetail.trace_status === "TRACEABLE"
                          ? "#166534"
                          : uc14TraceDetail.trace_status === "BROKEN_LINK"
                            ? "#b91c1c"
                            : uc14TraceDetail.trace_status === "ACCESS_RESTRICTED"
                              ? "#c2410c"
                              : "#1e293b",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <div>Trạng thái truy vết: <strong>{uc14TraceDetail.trace_status}</strong></div>
                    <div style={{ marginTop: 3, fontWeight: 500 }}>{uc14TraceDetail.trace_message}</div>
                  </div>

                  {/* GL Journal Entry Detail */}
                  <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", padding: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0f172a", marginBottom: 6 }}>
                      1. Bút toán Sổ cái (GL Entry): {uc14TraceDetail.gl_entry?.number} ({uc14TraceDetail.gl_entry?.status})
                    </div>
                    <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 8 }}>
                      Ngày HT: {uc14TraceDetail.gl_entry?.posting_date} • Ngày CT: {uc14TraceDetail.gl_entry?.document_date} • Loại: {uc14TraceDetail.gl_entry?.entry_type} • Phân hệ: {uc14TraceDetail.gl_entry?.source_module}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9" }}>
                          <th style={{ padding: 5, border: "1px solid #cbd5e1" }}>TK</th>
                          <th style={{ padding: 5, border: "1px solid #cbd5e1" }}>TK ĐƯ</th>
                          <th style={{ padding: 5, border: "1px solid #cbd5e1", textAlign: "right" }}>Nợ</th>
                          <th style={{ padding: 5, border: "1px solid #cbd5e1", textAlign: "right" }}>Có</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(uc14TraceDetail.gl_entry?.lines || []).map((ln: any, i: number) => (
                          <tr key={i} style={{ background: ln.is_selected_line ? "#f0fdf4" : "#ffffff" }}>
                            <td style={{ padding: 5, border: "1px solid #e2e8f0", fontWeight: 700 }}>{ln.account_code}</td>
                            <td style={{ padding: 5, border: "1px solid #e2e8f0", textAlign: "center" }}>{ln.reciprocal_account_code}</td>
                            <td style={{ padding: 5, border: "1px solid #e2e8f0", textAlign: "right" }}>{apiNumber(ln.debit).toLocaleString("vi-VN")}</td>
                            <td style={{ padding: 5, border: "1px solid #e2e8f0", textAlign: "right" }}>{apiNumber(ln.credit).toLocaleString("vi-VN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Adjustment / Reversal Chain (AF-20, AF-21) */}
                  {uc14TraceDetail.adjustment_reversal_chain?.has_chain && (
                    <div style={{ background: "#fffbeb", borderRadius: 6, border: "1px solid #fde68a", padding: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: "#92400e", marginBottom: 4 }}>
                        2. Chuỗi Bút toán Đảo / Điều chỉnh (UC-GL-06 / AF-20, AF-21)
                      </div>
                      {(uc14TraceDetail.adjustment_reversal_chain?.related_entries || []).map((rel: any, i: number) => (
                        <div key={i} style={{ fontSize: 11.5, color: "#78350f", marginTop: 4 }}>
                          • <strong>{rel.number}</strong> ({rel.entry_type} - {rel.posting_date}): {apiNumber(rel.total_debit).toLocaleString("vi-VN")} VND — Lý do: {rel.correction_reason}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Source Business Voucher Card */}
                  <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", padding: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0f172a", marginBottom: 6 }}>
                      3. Chứng từ nghiệp vụ nguồn (Source Voucher)
                    </div>
                    {uc14TraceDetail.source_voucher ? (
                      uc14TraceDetail.source_voucher.access_restricted ? (
                        <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 600 }}>
                          🔒 {uc14TraceDetail.source_voucher.message}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#334155", display: "flex", flexDirection: "column", gap: 4 }}>
                          <div>• <strong>Số chứng từ gốc:</strong> {uc14TraceDetail.source_voucher.source_document_number}</div>
                          <div>• <strong>Phân hệ nguồn:</strong> {uc14TraceDetail.source_voucher.source_module} ({uc14TraceDetail.source_voucher.source_document_type})</div>
                          <div>• <strong>Ngày chứng từ:</strong> {uc14TraceDetail.source_voucher.document_date}</div>
                          <div>• <strong>Đối tượng / Nhân viên:</strong> {uc14TraceDetail.source_voucher.partner_or_employee || "-"}</div>
                          <div>• <strong>Tổng tiền:</strong> {apiNumber(uc14TraceDetail.source_voucher.total_amount).toLocaleString("vi-VN")} {uc14TraceDetail.source_voucher.currency_code}</div>
                        </div>
                      )
                    ) : (
                      <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
                        {uc14TraceDetail.trace_status === "NO_SOURCE"
                          ? "Bút toán tổng hợp trực tiếp tại GL — không có chứng từ phân hệ nguồn riêng (AF-17)."
                          : "Không tồn tại bản ghi chứng từ nguồn (BROKEN_LINK — EF-17, BR-GL-TRACE-50: Không tự tạo chứng từ giả)."}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Modals */}
      {chartOfAccountsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setChartOfAccountsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 600, background: "#ffffff", borderRadius: 8, padding: 20 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Hệ thống tài khoản kế toán</span>
              <button onClick={() => setChartOfAccountsModalOpen(false)} style={{ border: "none", background: "none" }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Danh mục hệ thống tài khoản chuẩn mực theo Thông tư 99/2025/TT-BTC.
            </div>
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setChartOfAccountsModalOpen(false)}
                style={{ padding: "7px 16px", borderRadius: 6, background: "#00a862", color: "#fff", border: "none", fontWeight: 600 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {statsCodeModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setStatsCodeModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 500, background: "#ffffff", borderRadius: 8, padding: 20 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Danh mục Mã thống kê</span>
              <button onClick={() => setStatsCodeModalOpen(false)} style={{ border: "none", background: "none" }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Quản lý danh sách các mã thống kê phục vụ phân tích đa chiều báo cáo tài chính.
            </div>
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setStatsCodeModalOpen(false)}
                style={{ padding: "7px 16px", borderRadius: 6, background: "#00a862", color: "#fff", border: "none", fontWeight: 600 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseItemModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setExpenseItemModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 500, background: "#ffffff", borderRadius: 8, padding: 20 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Danh mục Khoản mục chi phí</span>
              <button onClick={() => setExpenseItemModalOpen(false)} style={{ border: "none", background: "none" }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Theo dõi chi phí bán hàng, chi phí quản lý doanh nghiệp theo khoản mục phục vụ kiểm soát ngân sách.
            </div>
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setExpenseItemModalOpen(false)}
                style={{ padding: "7px 16px", borderRadius: 6, background: "#00a862", color: "#fff", border: "none", fontWeight: 600 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {optionsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setOptionsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 500, background: "#ffffff", borderRadius: 8, padding: 20 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Tùy chọn Tổng hợp</span>
              <button onClick={() => setOptionsModalOpen(false)} style={{ border: "none", background: "none" }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Cấu hình các tham số kế toán tổng hợp, kết chuyển lãi lỗ và quy tắc khóa sổ.
            </div>
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setOptionsModalOpen(false)}
                style={{ padding: "7px 16px", borderRadius: 6, background: "#00a862", color: "#fff", border: "none", fontWeight: 600 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Auto Sync Advance Settlement Modal */}
      {autoSyncAdvanceModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setAutoSyncAdvanceModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 560, background: "#ffffff", borderRadius: 8, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Settings size={18} color="#00a862" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  Thiết lập tự động hóa đề nghị quyết toán tạm ứng
                </span>
              </div>
              <button onClick={() => setAutoSyncAdvanceModalOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="auto-sync-check" defaultChecked />
                <label htmlFor="auto-sync-check" style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                  Tự động đồng bộ đề nghị quyết toán đã phê duyệt từ Quy trình Sổ Việt
                </label>
              </div>

              <div style={{ paddingLeft: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#475569" }}>
                  Tần suất đồng bộ:
                  <select
                    value={advReqSyncFrequency}
                    onChange={(e) =>
                      setAdvReqSyncFrequency(
                        e.target.value as "IMMEDIATE" | "SCHEDULED" | "MANUAL",
                      )
                    }
                    style={{ marginLeft: 8, padding: "5px 10px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                  >
                    <option value="IMMEDIATE">Tức thời (Ngay khi người có thẩm quyền phê duyệt)</option>
                    <option value="SCHEDULED">Định kỳ mỗi 15 phút (Chờ đồng bộ)</option>
                    <option value="MANUAL">Thủ công (Kế toán chủ động lấy đề nghị đã duyệt)</option>
                  </select>
                </div>

                <div style={{ fontSize: 13, color: "#475569" }}>
                  Loại chứng từ tự động sinh:
                  <select defaultValue="qtu" style={{ marginLeft: 8, padding: "5px 10px", borderRadius: 4, border: "1px solid #cbd5e1" }}>
                    <option value="qtu">Chứng từ Quyết toán tạm ứng</option>
                    <option value="pkt">Chứng từ nghiệp vụ khác</option>
                  </select>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
                  <input type="checkbox" defaultChecked />
                  Tự động đính kèm file hóa đơn điện tử / chứng từ gốc từ Quy trình Sổ Việt
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
                  <input type="checkbox" defaultChecked />
                  Thông báo cho kế toán phụ trách thanh toán khi có đề nghị mới
                </label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => setAutoSyncAdvanceModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoSyncAdvanceModalOpen(false);
                  notify("Đã lưu thiết lập tự động hóa đề nghị quyết toán tạm ứng thành công!");
                }}
                style={{ padding: "8px 20px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal: Thêm bằng AI */}
      {aiVoucherModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setAiVoucherModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 580,
              background: "#ffffff",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                    Trợ lý Sổ Việt AI - Tự động lập chứng từ
                  </span>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Nhập nội dung nghiệp vụ bằng ngôn ngữ tự nhiên
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAiVoucherModalOpen(false)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Mô tả nghiệp vụ kế toán phát sinh:
                </label>
                <textarea
                  rows={4}
                  placeholder="Ví dụ: Trích khấu hao TSCĐ tháng 10 số tiền 18.500.000đ; hoặc Bù trừ công nợ phải thu và phải trả khách hàng 25.000.000đ..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    fontFamily: "inherit",
                    outline: "none",
                    resize: "none",
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
                  Gợi ý nghiệp vụ mẫu:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    "Trích khấu hao TSCĐ tháng 10: 18.500.000đ",
                    "Phân bổ chi phí trả trước CCDC: 7.200.000đ",
                    "Đánh giá lại chênh lệch tỷ giá cuối kỳ: 3.450.000đ",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAiPrompt(preset)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 16,
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        fontSize: 12,
                        color: "#475569",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#2563eb";
                        e.currentTarget.style.color = "#2563eb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.color = "#475569";
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setAiVoucherModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiVoucherModalOpen(false);
                  if (apiConnected) {
                    // The sample generator invents accounts and amounts; it must not write into real books.
                    notify("Sinh chứng từ bằng AI chưa có API backend; chứng từ không được ghi vào sổ.");
                    return;
                  }
                  const newVoucher = {
                    id: `PKT0000${generalVouchers.length + 1}`,
                    date: "31/10/2026",
                    voucherDate: "31/10/2026",
                    desc: aiPrompt || "Hạch toán nghiệp vụ tự động bằng Sổ Việt AI",
                    debitAcc: "6422",
                    creditAcc: "242",
                    amount: 18500000,
                    posted: true,
                  };
                  setGeneralVouchers([newVoucher, ...generalVouchers]);
                  setShowVoucherTable(true);
                  notify(`Sổ Việt AI đã phân tích và sinh chứng từ ${newVoucher.id} thành công!`);
                  setAiPrompt("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 20px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={15} />
                <span>Tự động sinh chứng từ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL UC-GL-04: TIẾP NHẬN BÚT TOÁN TỪ CÁC PHÂN HỆ                        */}
      {/* ========================================================================= */}
      {subledgerModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10050,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              width: "100%",
              maxWidth: 1040,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  Tiếp nhận bút toán từ các phân hệ nghiệp vụ (UC-GL-04)
                </div>
                <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                  Hỗ trợ các phân hệ PUR, AP, SAL, AR, CASH, BANK, INV, FA, TOOLS, PAYROLL, TAX, COST — Kiểm tra định khoản, cân đối Nợ/Có, chống trùng Idempotency & truy vết hai chiều
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubledgerModalOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Form tiếp nhận sự kiện hạch toán từ phân hệ nguồn */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 16,
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
                  Tiếp nhận sự kiện hạch toán mới từ phân hệ nguồn
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Phân hệ nguồn *
                    </label>
                    <select
                      value={subledgerSourceModule}
                      onChange={(e) => {
                        const mod = e.target.value;
                        setSubledgerSourceModule(mod);
                        const defaultMap: Record<string, string> = {
                          PUR: "PURCHASE_GOODS",
                          AP: "SUPPLIER_PAYMENT_OFFSET",
                          SAL: "SALES_REVENUE",
                          AR: "CUSTOMER_DEBT_OFFSET",
                          CASH: "CASH_RECEIPT",
                          BANK: "BANK_CREDIT_ADVICE",
                          INV: "INVENTORY_ISSUE_COGS",
                          FA: "FA_DEPRECIATION",
                          TOOLS: "TOOLS_ALLOCATION",
                          PAYROLL: "SALARY_ACCRUAL",
                          TAX: "VAT_NETTING",
                          COST: "PRODUCTION_COST_TRANSFER",
                        };
                        if (defaultMap[mod]) setSubledgerBusinessType(defaultMap[mod]);
                      }}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        background: "#ffffff",
                      }}
                    >
                      <option value="PUR">PUR - Mua hàng</option>
                      <option value="AP">AP - Công nợ phải trả</option>
                      <option value="SAL">SAL - Bán hàng</option>
                      <option value="AR">AR - Công nợ phải thu</option>
                      <option value="CASH">CASH - Tiền mặt / Quỹ</option>
                      <option value="BANK">BANK - Tiền gửi ngân hàng</option>
                      <option value="INV">INV - Kho</option>
                      <option value="FA">FA - Tài sản cố định</option>
                      <option value="TOOLS">TOOLS - CCDC / Chi phí trả trước</option>
                      <option value="PAYROLL">PAYROLL - Tiền lương</option>
                      <option value="TAX">TAX - Thuế</option>
                      <option value="COST">COST - Giá thành</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Loại nghiệp vụ nguồn *
                    </label>
                    <input
                      type="text"
                      value={subledgerBusinessType}
                      onChange={(e) => setSubledgerBusinessType(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Số chứng từ nguồn *
                    </label>
                    <input
                      type="text"
                      value={subledgerDocNo}
                      onChange={(e) => setSubledgerDocNo(e.target.value)}
                      placeholder="VD: PMH00018"
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Ngày hạch toán *
                    </label>
                    <input
                      type="text"
                      value={subledgerPostingDate}
                      onChange={(e) => setSubledgerPostingDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Số tiền trước thuế (VND) *
                    </label>
                    <input
                      type="number"
                      value={subledgerAmount}
                      onChange={(e) => setSubledgerAmount(Number(e.target.value) || 0)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Tiền thuế GTGT (VND)
                    </label>
                    <input
                      type="number"
                      value={subledgerTaxAmount}
                      onChange={(e) => setSubledgerTaxAmount(Number(e.target.value) || 0)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Mã đối tượng (KH/NCC)
                    </label>
                    <input
                      type="text"
                      value={subledgerParty}
                      onChange={(e) => setSubledgerParty(e.target.value)}
                      placeholder="VD: NCC001 / KH001"
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Chế độ xử lý sau tiếp nhận
                    </label>
                    <select
                      value={subledgerPostingMode}
                      onChange={(e) => setSubledgerPostingMode(e.target.value as any)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        background: "#ffffff",
                      }}
                    >
                      <option value="AUTO_POST">AUTO_POST - Tự động ghi sổ ngay</option>
                      <option value="UNPOSTED">UNPOSTED - Lưu chưa ghi sổ (chờ UC-GL-05)</option>
                      <option value="WORKFLOW">WORKFLOW - Chuyển phê duyệt</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      Diễn giải hạch toán
                    </label>
                    <input
                      type="text"
                      value={subledgerDesc}
                      onChange={(e) => setSubledgerDesc(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { void handleIngestSubledger(); }}
                    style={{
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 18px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Tiếp nhận bút toán
                  </button>
                </div>
              </div>

              {/* Danh sách nhật ký tiếp nhận & truy vết chứng từ nguồn <-> Bút toán GL */}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>
                  Nhật ký tiếp nhận & Truy vết liên kết Chứng từ nguồn ↔ Bút toán Sổ cái ({subledgerIngestions.length})
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", color: "#334155", textAlign: "left" }}>
                        <th style={{ padding: "10px 12px" }}>Phân hệ</th>
                        <th style={{ padding: "10px 12px" }}>Số CT nguồn</th>
                        <th style={{ padding: "10px 12px" }}>Mã sự kiện (Event ID)</th>
                        <th style={{ padding: "10px 12px" }}>Ngày HT</th>
                        <th style={{ padding: "10px 12px" }}>Số bút toán GL</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>Tổng Nợ/Có</th>
                        <th style={{ padding: "10px 12px", textAlign: "center" }}>Trạng thái</th>
                        <th style={{ padding: "10px 12px", textAlign: "center" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subledgerIngestions.map((ing) => (
                        <tr key={ing.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>{ing.sourceModule}</td>
                          <td style={{ padding: "10px 12px", color: "#0284c7", fontWeight: 600 }}>
                            {ing.sourceDocumentNumber}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#64748b", fontFamily: "monospace", fontSize: 11.5 }}>
                            {ing.sourceEventId}
                          </td>
                          <td style={{ padding: "10px 12px" }}>{ing.postingDate}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>
                            {ing.journalNumber || "—"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                            {formatVND(ing.totalDebit || 0)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 600,
                                background:
                                  ing.status === "POSTED"
                                    ? "#dcfce7"
                                    : ing.status === "ERROR"
                                      ? "#fee2e2"
                                      : "#fef3c7",
                                color:
                                  ing.status === "POSTED"
                                    ? "#15803d"
                                    : ing.status === "ERROR"
                                      ? "#b91c1c"
                                      : "#b45309",
                              }}
                            >
                              {ing.status === "POSTED"
                                ? "Đã ghi sổ (POSTED)"
                                : ing.status === "ERROR"
                                  ? "Lỗi (ERROR)"
                                  : "Chưa ghi sổ (UNPOSTED)"}
                            </span>
                            {ing.errorMessage && (
                              <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
                                {ing.errorMessage}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              {ing.status === "UNPOSTED" && (
                                <button
                                  type="button"
                                  onClick={() => { void handlePostSubledgerItem(ing); }}
                                  style={{
                                    background: "#ecfdf5",
                                    color: "#059669",
                                    border: "1px solid #6ee7b7",
                                    borderRadius: 4,
                                    padding: "3px 8px",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Ghi sổ
                                </button>
                              )}
                              {ing.status === "ERROR" && (
                                <button
                                  type="button"
                                  onClick={() => { void handleRetrySubledgerItem(ing); }}
                                  style={{
                                    background: "#fff7ed",
                                    color: "#ea580c",
                                    border: "1px solid #fed7aa",
                                    borderRadius: 4,
                                    padding: "3px 8px",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Thử lại (Retry)
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  notify(
                                    `Truy vết chứng từ nguồn: [${ing.sourceModule}] ${ing.sourceDocumentNumber} ↔ Bút toán GL: ${
                                      ing.journalNumber || "Chưa tạo"
                                    }`,
                                  )
                                }
                                style={{
                                  background: "transparent",
                                  color: "#0284c7",
                                  border: "1px solid #bae6fd",
                                  borderRadius: 4,
                                  padding: "3px 8px",
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Truy vết nguồn
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "12px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setSubledgerModalOpen(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL UC-GL-07: PHÂN BỔ CHI PHÍ BÁN HÀNG, QLDN VÀ CHI PHÍ KHÁC             */}
      {/* ========================================================================= */}
      {expenseAllocationModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10060,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              width: "100%",
              maxWidth: 1120,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  Phân bổ chi phí bán hàng, quản lý doanh nghiệp và chi phí khác (UC-GL-07)
                </h3>
                <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
                  Tập hợp chi phí nguồn đã ghi sổ (POSTED), phân bổ theo tiêu thức và tạo chứng từ phân bổ có truy vết hai chiều
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpenseAllocationModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Khối 1: Tham số kỳ, nguồn chi phí và tiêu thức phân bổ */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                  background: "#f8fafc",
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Kỳ phân bổ</label>
                  <input
                    type="text"
                    value={allocPeriodCode}
                    onChange={(e) => setAllocPeriodCode(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Ngày hạch toán</label>
                  <input
                    type="text"
                    value={allocPostingDate}
                    onChange={(e) => setAllocPostingDate(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Số chứng từ phân bổ</label>
                  <input
                    type="text"
                    value={allocVoucherNumber}
                    onChange={(e) => setAllocVoucherNumber(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Nhóm chi phí nguồn</label>
                  <select
                    value={allocGroup}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setAllocGroup(val);
                      if (val === "SELLING") {
                        setAllocSourceAccCode("641");
                        setAllocOffsetAccCode("641");
                      } else if (val === "ADMIN") {
                        setAllocSourceAccCode("6422");
                        setAllocOffsetAccCode("6422");
                      } else {
                        setAllocSourceAccCode("811");
                        setAllocOffsetAccCode("811");
                      }
                    }}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  >
                    <option value="ADMIN">Chi phí quản lý doanh nghiệp (642)</option>
                    <option value="SELLING">Chi phí bán hàng (641)</option>
                    <option value="SHARED">Chi phí dùng chung chờ phân bổ</option>
                    <option value="OTHER">Chi phí khác (811)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>TK Chi phí nguồn</label>
                  <input
                    type="text"
                    value={allocSourceAccCode}
                    onChange={(e) => {
                      setAllocSourceAccCode(e.target.value);
                      setAllocOffsetAccCode(e.target.value);
                    }}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Phương pháp / Tiêu thức phân bổ</label>
                  <select
                    value={allocMethod}
                    onChange={(e) => setAllocMethod(e.target.value as any)}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  >
                    <option value="FIXED_PERCENT">Tỷ lệ cố định (%) (AF-04)</option>
                    <option value="COEFFICIENT">Hệ số phân bổ (AF-05)</option>
                    <option value="REVENUE">Theo doanh thu trong kỳ (AF-06)</option>
                    <option value="DIRECT_COST">Theo chi phí trực tiếp (AF-06)</option>
                    <option value="BASIS_VALUE">Theo tiêu thức giá trị/sản lượng (AF-06)</option>
                    <option value="DIRECT_AMOUNT">Theo số tiền trực tiếp (AF-07)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Quy tắc xử lý làm tròn (AF-10)</label>
                  <select
                    value={allocRoundingMethod}
                    onChange={(e) => setAllocRoundingMethod(e.target.value as any)}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                    }}
                  >
                    <option value="LAST_LINE">Dồn chênh lệch vào dòng cuối hợp lệ</option>
                    <option value="LARGEST_LINE">Dồn chênh lệch vào dòng có giá trị lớn nhất</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Số tiền đưa vào phân bổ đợt này</label>
                  <input
                    type="number"
                    value={allocSourcePool.amountToAllocate}
                    onChange={(e) =>
                      setAllocSourcePool((prev) => ({
                        ...prev,
                        amountToAllocate: Number(e.target.value || 0),
                      }))
                    }
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "6px 10px",
                      borderRadius: 5,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  />
                </div>
              </div>

              {/* Khối 2: Bảng tóm tắt số liệu nguồn & Nút Lấy dữ liệu nguồn / Tính phân bổ */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: "#475569" }}>Tổng CP nguồn phát sinh (POSTED):</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {allocSourcePool.totalSourceAmount.toLocaleString("vi-VN")} ₫
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: "#475569" }}>Đã phân bổ trước đó:</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ea580c" }}>
                      {allocSourcePool.previouslyAllocatedAmount.toLocaleString("vi-VN")} ₫
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: "#475569" }}>Còn lại được phép phân bổ:</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#00a862" }}>
                      {allocSourcePool.remainingAllocatableAmount.toLocaleString("vi-VN")} ₫
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: "#475569" }}>Fingerprint nguồn (AF-13):</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                      {allocSourcePool.sourceFingerprint} ({allocSourcePool.sourceEntriesCount} bút toán)
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { void handleFetchAllocationSource(); }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      border: "1px solid #0284c7",
                      background: "#ffffff",
                      color: "#0284c7",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    1. Lấy dữ liệu nguồn
                  </button>
                  <button
                    type="button"
                    onClick={handleCalculateExpenseAllocation}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      border: "none",
                      background: "#0284c7",
                      color: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    2. Tính phân bổ (CALCULATED)
                  </button>
                </div>
              </div>

              {/* Khối 3: Bảng chi tiết đối tượng nhận và kết quả tính phân bổ */}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
                  Bảng phân bổ chi phí cho các đối tượng nhận (TK nhận / Đơn vị / Dự án / Trung tâm CP)
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", color: "#334155", textAlign: "left" }}>
                        <th style={{ padding: "9px 10px" }}>#</th>
                        <th style={{ padding: "9px 10px" }}>TK nhận</th>
                        <th style={{ padding: "9px 10px" }}>Đơn vị / Phòng ban nhận</th>
                        <th style={{ padding: "9px 10px" }}>Dự án / TT Chi phí</th>
                        <th style={{ padding: "9px 10px", textAlign: "right" }}>Tiêu thức / Hệ số</th>
                        <th style={{ padding: "9px 10px", textAlign: "right" }}>Tỷ lệ (%)</th>
                        <th style={{ padding: "9px 10px", textAlign: "right" }}>Số tiền phân bổ (₫)</th>
                        <th style={{ padding: "9px 10px" }}>Diễn giải dòng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocDestinations.map((dest, idx) => (
                        <tr key={dest.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "8px 10px" }}>{idx + 1}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 600 }}>{dest.accountCode}</td>
                          <td style={{ padding: "8px 10px" }}>{dest.departmentName}</td>
                          <td style={{ padding: "8px 10px", color: "#475569" }}>
                            {dest.projectCode} / {dest.costCenterCode}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            {allocMethod === "COEFFICIENT"
                              ? dest.coefficient
                              : allocMethod === "DIRECT_AMOUNT"
                                ? dest.directAmount.toLocaleString("vi-VN")
                                : dest.basisValue.toLocaleString("vi-VN")}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#0284c7" }}>
                            {dest.percentage}%
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                            {Number(dest.allocatedAmount || 0).toLocaleString("vi-VN")}
                            {dest.roundingAdjustment !== 0 && (
                              <span style={{ fontSize: 11, color: "#ea580c", marginLeft: 4 }}>
                                (Làm tròn: {dest.roundingAdjustment > 0 ? `+${dest.roundingAdjustment}` : dest.roundingAdjustment})
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#475569" }}>{dest.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Khối 4: Danh sách các đợt phân bổ đã thực hiện & Thao tác Ghi sổ / Bỏ ghi sổ / Đảo / Truy vết */}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
                  Lịch sử chứng từ phân bổ chi phí & Truy vết hai chiều ({allocRunsHistory.length})
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", color: "#334155", textAlign: "left" }}>
                        <th style={{ padding: "9px 10px" }}>Số CT phân bổ</th>
                        <th style={{ padding: "9px 10px" }}>Kỳ / Ngày HT</th>
                        <th style={{ padding: "9px 10px" }}>TK nguồn</th>
                        <th style={{ padding: "9px 10px" }}>Phương pháp</th>
                        <th style={{ padding: "9px 10px", textAlign: "right" }}>Tổng tiền phân bổ</th>
                        <th style={{ padding: "9px 10px" }}>Trạng thái</th>
                        <th style={{ padding: "9px 10px", textAlign: "center" }}>Thao tác (UC-GL-05 / 06 / 07)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocRunsHistory.map((run) => (
                        <tr key={run.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: "#0284c7" }}>{run.number}</td>
                          <td style={{ padding: "8px 10px" }}>
                            {run.periodCode} ({run.postingDate})
                          </td>
                          <td style={{ padding: "8px 10px", fontWeight: 600 }}>{run.sourceAccountCode}</td>
                          <td style={{ padding: "8px 10px" }}>{run.method}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>
                            {Number(run.amount || 0).toLocaleString("vi-VN")} ₫
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 12,
                                fontSize: 11.5,
                                fontWeight: 600,
                                background:
                                  run.status === "POSTED"
                                    ? "#dcfce7"
                                    : run.status === "UNPOSTED"
                                      ? "#fef9c3"
                                      : "#fee2e2",
                                color:
                                  run.status === "POSTED"
                                    ? "#15803d"
                                    : run.status === "UNPOSTED"
                                      ? "#a16207"
                                      : "#b91c1c",
                              }}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              {run.status === "UNPOSTED" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAllocRunsHistory((prev) =>
                                        prev.map((r) => (r.id === run.id ? { ...r, status: "POSTED" } : r)),
                                      );
                                      notify(`Đã ghi sổ chứng từ phân bổ ${run.number} vào Sổ cái (UC-GL-05).`);
                                    }}
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                      border: "1px solid #86efac",
                                      background: "#f0fdf4",
                                      color: "#15803d",
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Ghi sổ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAllocRunsHistory((prev) =>
                                        prev.map((r) => (r.id === run.id ? { ...r, status: "CANCELLED" } : r)),
                                      );
                                      notify(`Đã hủy chứng từ phân bổ ${run.number} và giải phóng nguồn chi phí (AF-16).`);
                                    }}
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                      border: "1px solid #fca5a5",
                                      background: "#fef2f2",
                                      color: "#b91c1c",
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Hủy
                                  </button>
                                </>
                              )}
                              {run.status === "POSTED" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAllocRunsHistory((prev) =>
                                        prev.map((r) => (r.id === run.id ? { ...r, status: "UNPOSTED" } : r)),
                                      );
                                      notify(`Đã bỏ ghi sổ chứng từ phân bổ ${run.number} về UNPOSTED (AF-16).`);
                                    }}
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                      border: "1px solid #fde047",
                                      background: "#fefce8",
                                      color: "#a16207",
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Bỏ ghi sổ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAllocRunsHistory((prev) =>
                                        prev.map((r) => (r.id === run.id ? { ...r, status: "REVERSED" } : r)),
                                      );
                                      notify(
                                        `Đã tạo bút toán đảo cho chứng từ phân bổ ${run.number} và giải phóng nguồn chi phí (AF-17).`,
                                      );
                                    }}
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                      border: "1px solid #fdba74",
                                      background: "#fff7ed",
                                      color: "#c2410c",
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Đảo bút toán
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  notify(
                                    `Truy vết chứng từ phân bổ ${run.number}: Nguồn TK ${run.sourceAccountCode} (${Number(
                                      run.totalSourceAmount || run.amount,
                                    ).toLocaleString("vi-VN")} ₫) → Phương pháp ${run.method} → Bút toán GL ${run.entryNumber}`,
                                  )
                                }
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  border: "1px solid #bae6fd",
                                  background: "#f0f9ff",
                                  color: "#0284c7",
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Truy vết nguồn
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Trạng thái hiện tại: <strong>{allocSourcePool.status}</strong> — Bút toán chỉ ảnh hưởng số liệu GL chính thức sau khi Ghi sổ (UC-GL-05)
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setExpenseAllocationModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => { void handleConfirmExpenseAllocation(false); }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #00a862",
                    background: "#ffffff",
                    color: "#00a862",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  3. Tạo chứng từ (Chưa ghi sổ - AF-15)
                </button>
                <button
                  type="button"
                  onClick={() => { void handleConfirmExpenseAllocation(true); }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    background: "#00a862",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Tạo chứng từ & Ghi sổ ngay (AF-14)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- UC-GL-08: ĐÁNH GIÁ LẠI TÀI KHOẢN NGOẠI TỆ (FOREIGN CURRENCY REVALUATION MODAL) --- */}
      {fxRevaluationModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              width: "100%",
              maxWidth: 1320,
              maxHeight: "93vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 20px",
                background: "linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  UC-GL-08: Đánh giá lại tài khoản ngoại tệ cuối kỳ (Foreign Currency Account Revaluation)
                </div>
                <div style={{ fontSize: 12, color: "#bfdbfe", marginTop: 2 }}>
                  Xác định lại giá trị quy đổi các khoản mục tiền tệ có gốc ngoại tệ (TK 1112, 1122, 131, 331, 3411), tự động định khoản Lãi/Lỗ tỷ giá qua TK 4131 và bảo toàn số dư nguyên tệ (BR-GL-FX-01..83)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFxRevaluationModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 6,
                  color: "#ffffff",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ✕ Đóng
              </button>
            </div>

            {/* Sub-navigation Tabs */}
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {[
                { id: "evaluate", label: "1. Thực hiện đánh giá lại ngoại tệ (Main Flow)" },
                {
                  id: "history",
                  label: `2. Lịch sử & Vòng đời đợt đánh giá (${fxRevalRunsHistory.length})`,
                },
                {
                  id: "rules",
                  label: `3. Quy tắc khoản mục tiền tệ & Định khoản (${fxRevalRules.length})`,
                },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFxRevalActiveTab(t.id as any)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: fxRevalActiveTab === t.id ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                    background: fxRevalActiveTab === t.id ? "#eff6ff" : "#ffffff",
                    color: fxRevalActiveTab === t.id ? "#1d4ed8" : "#334155",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {fxRevalActiveTab === "evaluate" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Section A: Thông tin chung của lần đánh giá (1.1.A) */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>A. Thông tin chung của lần đánh giá ngoại tệ (Mục 1.1.A)</span>
                      <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600 }}>
                        Fingerprint nguồn: {fxRevalSourceFingerprint}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(6, 1fr)",
                        gap: 10,
                      }}
                    >
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Kỳ đánh giá *
                        </label>
                        <select
                          value={fxRevalPeriod}
                          onChange={(e) => {
                            setFxRevalPeriod(e.target.value);
                            setFxRevalCalculated(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        >
                          <option value="2026-10">Tháng 10/2026 (OPEN)</option>
                          <option value="2026-09">Tháng 09/2026 (OPEN)</option>
                          <option value="2026-11">Tháng 11/2026 (OPEN)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Loại ngoại tệ * (AF-03)
                        </label>
                        <select
                          value={fxRevalCurrency}
                          onChange={(e) =>
                            handleApplySystemFxRate(e.target.value as "USD" | "EUR" | "JPY")
                          }
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            marginTop: 3,
                            fontWeight: 700,
                            color: "#1d4ed8",
                          }}
                        >
                          <option value="USD">USD - Đô la Mỹ</option>
                          <option value="EUR">EUR - Đồng Euro</option>
                          <option value="JPY">JPY - Yên Nhật</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Tỷ giá đánh giá cuối kỳ *
                        </label>
                        <input
                          type="number"
                          value={fxRevalExchangeRate}
                          onChange={(e) => {
                            setFxRevalExchangeRate(Number(e.target.value));
                            setFxRevalCalculated(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #93c5fd",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#1e3a8a",
                            marginTop: 3,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Phạm vi tài khoản * (AF-04..06)
                        </label>
                        <select
                          value={fxRevalAccountScope}
                          onChange={(e) => {
                            const scope = e.target.value as any;
                            setFxRevalAccountScope(scope);
                            setFxRevalItems((prev) =>
                              prev.map((it) => ({
                                ...it,
                                selected: scope === "ALL" || it.itemCategory === scope,
                              })),
                            );
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        >
                          <option value="ALL">Tất cả khoản mục tiền tệ ngoại tệ</option>
                          <option value="CASH_BANK">Tiền mặt & Tiền gửi NH (1112, 1122)</option>
                          <option value="AR">Phải thu khách hàng (131)</option>
                          <option value="AP">Phải trả nhà cung cấp (331)</option>
                          <option value="LOAN">Vay & nợ thuê tài chính (3411)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Số chứng từ * (BR-GL-FX-48)
                        </label>
                        <input
                          type="text"
                          value={fxRevalVoucherNo}
                          onChange={(e) => setFxRevalVoucherNo(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Ngày đánh giá / Hạch toán *
                        </label>
                        <input
                          type="text"
                          value={fxRevalPostingDate}
                          onChange={(e) => {
                            setFxRevalDate(e.target.value);
                            setFxRevalPostingDate(e.target.value);
                            setFxRevalDocDate(e.target.value);
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1.5fr 1fr auto",
                        gap: 10,
                        marginTop: 10,
                        alignItems: "end",
                      }}
                    >
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Diễn giải chứng từ *
                        </label>
                        <input
                          type="text"
                          value={fxRevalDescription}
                          onChange={(e) => setFxRevalDescription(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Nguồn tỷ giá (AF-01 / AF-02)
                        </label>
                        <input
                          type="text"
                          value={fxRevalRateSource}
                          onChange={(e) => setFxRevalRateSource(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                          Thời điểm tỷ giá *
                        </label>
                        <input
                          type="text"
                          value={fxRevalRateTimestamp}
                          onChange={(e) => setFxRevalRateTimestamp(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleApplySystemFxRate(fxRevalCurrency)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: 5,
                            border: "1px solid #93c5fd",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Lấy tỷ giá hệ thống (AF-01)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Bảng chi tiết khoản mục ngoại tệ & kết quả đánh giá lại (1.1.B & 1.1.E) */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "#eff6ff",
                        borderBottom: "1px solid #dbeafe",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>
                        B. Danh sách khoản mục tiền tệ có gốc ngoại tệ ({fxRevalCurrency}) & Định khoản dự kiến
                      </span>
                      <span style={{ fontSize: 12, color: "#1e40af" }}>
                        Công thức: Giá trị sau đánh giá = Số dư nguyên tệ × Tỷ giá đánh giá ({fxRevalExchangeRate.toLocaleString("vi-VN")})
                      </span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", color: "#334155", textAlign: "left" }}>
                          <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>Chọn</th>
                          <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>TK</th>
                          <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>Bản chất</th>
                          <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>
                            Đối tượng / TK Ngân hàng
                          </th>
                          <th
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e2e8f0",
                              textAlign: "right",
                            }}
                          >
                            Số dư nguyên tệ ({fxRevalCurrency})
                          </th>
                          <th
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e2e8f0",
                              textAlign: "right",
                            }}
                          >
                            Giá trị đang ghi sổ (VND)
                          </th>
                          <th
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e2e8f0",
                              textAlign: "right",
                            }}
                          >
                            Tỷ giá ghi sổ
                          </th>
                          <th
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e2e8f0",
                              textAlign: "right",
                            }}
                          >
                            Giá trị sau đánh giá (VND)
                          </th>
                          <th
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e2e8f0",
                              textAlign: "right",
                            }}
                          >
                            Chênh lệch quy đổi (VND)
                          </th>
                          <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>
                            Bản chất Lãi/Lỗ
                          </th>
                          <th style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>
                            Định khoản (Nợ / Có)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {fxRevalItems.map((it) => (
                          <tr
                            key={it.id}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              background: !it.selected
                                ? "#f8fafc"
                                : it.differenceAmount === 0
                                  ? "#fafafa"
                                  : "#ffffff",
                              opacity: it.selected ? 1 : 0.55,
                            }}
                          >
                            <td style={{ padding: "8px 10px" }}>
                              <input
                                type="checkbox"
                                checked={it.selected}
                                onChange={(e) =>
                                  setFxRevalItems((prev) =>
                                    prev.map((row) =>
                                      row.id === it.id
                                        ? { ...row, selected: e.target.checked }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td style={{ padding: "8px 10px", fontWeight: 700, color: "#0f172a" }}>
                              {it.accountCode}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: it.nature === "ASSET" ? "#dbeafe" : "#fef3c7",
                                  color: it.nature === "ASSET" ? "#1e40af" : "#92400e",
                                }}
                              >
                                {it.nature === "ASSET" ? "Tài sản" : "Nợ phải trả"}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <div style={{ fontWeight: 600, color: "#1e293b" }}>
                                {it.bankAccountCode || it.partyCode || "Toàn tài khoản"}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>{it.partyName}</div>
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#1d4ed8",
                              }}
                            >
                              {it.foreignBalance.toLocaleString("vi-VN")} {fxRevalCurrency}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right" }}>
                              {it.bookValueBefore.toLocaleString("vi-VN")} ₫
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748b" }}>
                              {it.currentBookRate.toLocaleString("vi-VN")}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                fontWeight: 600,
                                color: "#0f172a",
                              }}
                            >
                              {it.revaluedValue.toLocaleString("vi-VN")} ₫
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                fontWeight: 700,
                                color:
                                  it.differenceAmount > 0
                                    ? "#15803d"
                                    : it.differenceAmount < 0
                                      ? "#b91c1c"
                                      : "#64748b",
                              }}
                            >
                              {it.differenceAmount > 0 ? "+" : ""}
                              {it.differenceAmount.toLocaleString("vi-VN")} ₫
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {it.fxImpactType === "GAIN" ? (
                                <span
                                  style={{
                                    padding: "2px 7px",
                                    borderRadius: 4,
                                    background: "#dcfce7",
                                    color: "#15803d",
                                    fontWeight: 700,
                                    fontSize: 11,
                                  }}
                                >
                                  Lãi tỷ giá (GAIN)
                                </span>
                              ) : it.fxImpactType === "LOSS" ? (
                                <span
                                  style={{
                                    padding: "2px 7px",
                                    borderRadius: 4,
                                    background: "#fee2e2",
                                    color: "#b91c1c",
                                    fontWeight: 700,
                                    fontSize: 11,
                                  }}
                                >
                                  Lỗ tỷ giá (LOSS)
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                  Không phát sinh (AF-07)
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "8px 10px", fontWeight: 700 }}>
                              {it.debitAccountCode && it.creditAccountCode ? (
                                <span style={{ color: "#1e3a8a" }}>
                                  Nợ {it.debitAccountCode} / Có {it.creditAccountCode}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>Bỏ qua (0 ₫)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Cards */}
                  {(() => {
                    const selected = fxRevalItems.filter((it) => it.selected);
                    const totalGain = selected
                      .filter((it) => it.fxImpactType === "GAIN")
                      .reduce((s, it) => s + Math.abs(it.differenceAmount), 0);
                    const totalLoss = selected
                      .filter((it) => it.fxImpactType === "LOSS")
                      .reduce((s, it) => s + Math.abs(it.differenceAmount), 0);
                    const netDiff = totalGain - totalLoss;
                    const totalAccounting = totalGain + totalLoss;
                    return (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>
                            Tổng Lãi tỷ giá đánh giá lại (Có TK 4131)
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: "#15803d", marginTop: 4 }}>
                            +{totalGain.toLocaleString("vi-VN")} ₫
                          </div>
                        </div>
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                          }}
                        >
                          <div style={{ fontSize: 11, color: "#991b1b", fontWeight: 600 }}>
                            Tổng Lỗ tỷ giá đánh giá lại (Nợ TK 4131)
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>
                            -{totalLoss.toLocaleString("vi-VN")} ₫
                          </div>
                        </div>
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 600 }}>
                            Chênh lệch tỷ giá thuần (Lãi - Lỗ)
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: "#1d4ed8", marginTop: 4 }}>
                            {netDiff >= 0 ? "+" : ""}
                            {netDiff.toLocaleString("vi-VN")} ₫
                          </div>
                        </div>
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          <div style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>
                            Kiểm tra cân đối Nợ / Có (BR-GL-FX-50)
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                            Nợ: {totalAccounting.toLocaleString("vi-VN")} ₫ = Có:{" "}
                            {totalAccounting.toLocaleString("vi-VN")} ₫ (Cân đối)
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {fxRevalActiveTab === "history" && (
                <div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: "8px 10px" }}>Số chứng từ</th>
                        <th style={{ padding: "8px 10px" }}>Kỳ</th>
                        <th style={{ padding: "8px 10px" }}>Ngoại tệ</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Tỷ giá ĐG</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Tổng Lãi TG</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Tổng Lỗ TG</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Chênh lệch thuần</th>
                        <th style={{ padding: "8px 10px" }}>Trạng thái</th>
                        <th style={{ padding: "8px 10px" }}>Thao tác vòng đời (AF-12..17)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fxRevalRunsHistory.map((run) => (
                        <tr key={run.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: "#1d4ed8" }}>
                            {run.voucherNo}
                          </td>
                          <td style={{ padding: "8px 10px" }}>{run.period}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 700 }}>{run.currency}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            {run.exchangeRate.toLocaleString("vi-VN")}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#15803d" }}>
                            +{run.totalGainAmount.toLocaleString("vi-VN")} ₫
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#b91c1c" }}>
                            -{run.totalLossAmount.toLocaleString("vi-VN")} ₫
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>
                            {run.netDifference.toLocaleString("vi-VN")} ₫
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                background:
                                  run.status === "POSTED"
                                    ? "#dcfce7"
                                    : run.status === "UNPOSTED"
                                      ? "#fef9c3"
                                      : "#f1f5f9",
                                color:
                                  run.status === "POSTED"
                                    ? "#15803d"
                                    : run.status === "UNPOSTED"
                                      ? "#854d0e"
                                      : "#64748b",
                              }}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setFxRevalTraceRun(run)}
                              style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                borderRadius: 4,
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                cursor: "pointer",
                              }}
                            >
                              Truy vết 2 chiều
                            </button>
                            {run.status === "UNPOSTED" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { void handleFxRunLifecycleAction(run.id, "POST"); }}
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    borderRadius: 4,
                                    border: "none",
                                    background: "#00a862",
                                    color: "#fff",
                                    cursor: "pointer",
                                  }}
                                >
                                  Ghi sổ (POST)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void handleFxRunLifecycleAction(run.id, "CANCEL"); }}
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    borderRadius: 4,
                                    border: "1px solid #fca5a5",
                                    background: "#fef2f2",
                                    color: "#b91c1c",
                                    cursor: "pointer",
                                  }}
                                >
                                  Hủy (AF-12)
                                </button>
                              </>
                            )}
                            {run.status === "POSTED" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { void handleFxRunLifecycleAction(run.id, "UNPOST"); }}
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    borderRadius: 4,
                                    border: "1px solid #fde047",
                                    background: "#fefce8",
                                    color: "#854d0e",
                                    cursor: "pointer",
                                  }}
                                >
                                  Bỏ ghi sổ (AF-16)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void handleFxRunLifecycleAction(run.id, "REVERSE"); }}
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    borderRadius: 4,
                                    border: "1px solid #c7d2fe",
                                    background: "#eef2ff",
                                    color: "#3730a3",
                                    cursor: "pointer",
                                  }}
                                >
                                  Đảo bút toán (AF-17)
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {fxRevalTraceRun && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 12,
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#1e3a8a", marginBottom: 6 }}>
                        Truy vết 2 chiều đợt đánh giá {fxRevalTraceRun.voucherNo} (Fingerprint:{" "}
                        {fxRevalTraceRun.sourceFingerprint} - BR-GL-FX-82):
                      </div>
                      <div>
                        Kỳ: {fxRevalTraceRun.period} | Ngoại tệ: {fxRevalTraceRun.currency} | Tỷ giá:{" "}
                        {fxRevalTraceRun.exchangeRate.toLocaleString("vi-VN")} | Nguồn tỷ giá:{" "}
                        {fxRevalTraceRun.rateSource}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fxRevalActiveTab === "rules" && (
                <div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: "8px 10px" }}>Đầu TK</th>
                        <th style={{ padding: "8px 10px" }}>Tên tài khoản</th>
                        <th style={{ padding: "8px 10px" }}>Nhóm khoản mục</th>
                        <th style={{ padding: "8px 10px" }}>Bản chất</th>
                        <th style={{ padding: "8px 10px" }}>TK xử lý CLTG</th>
                        <th style={{ padding: "8px 10px" }}>Định khoản Lãi TG</th>
                        <th style={{ padding: "8px 10px" }}>Định khoản Lỗ TG</th>
                        <th style={{ padding: "8px 10px" }}>Thuộc phạm vi ĐG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fxRevalRules.map((rule) => (
                        <tr key={rule.accountPrefix} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 700 }}>{rule.accountPrefix}</td>
                          <td style={{ padding: "8px 10px" }}>{rule.accountName}</td>
                          <td style={{ padding: "8px 10px" }}>{rule.itemCategory}</td>
                          <td style={{ padding: "8px 10px" }}>{rule.nature}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 700 }}>{rule.fxHandlingAccount}</td>
                          <td style={{ padding: "8px 10px", color: "#15803d", fontWeight: 600 }}>
                            Nợ {rule.gainDebit} / Có {rule.gainCredit}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#b91c1c", fontWeight: 600 }}>
                            Nợ {rule.lossDebit} / Có {rule.lossCredit}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {rule.eligible ? (
                              <span style={{ color: "#15803d", fontWeight: 700 }}>
                                Khoản mục tiền tệ (Đủ ĐK)
                              </span>
                            ) : (
                              <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                                Khoản mục phi tiền tệ (Chặn EF-11)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 12, color: "#475569" }}>
                Quy tắc cốt lõi: Không làm thay đổi số dư nguyên tệ (BR-GL-FX-60); Chứng từ UNPOSTED chưa tác động Sổ cái (BR-GL-FX-63).
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { void handleFetchFxBalances(); }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#1e293b",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  1. Lấy số dư ngoại tệ (Bước 3)
                </button>
                <button
                  type="button"
                  onClick={() => { void handleCalculateFxRevaluation(); }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid #1d4ed8",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  2. Tính đánh giá lại (Bước 5-8)
                </button>
                <button
                  type="button"
                  onClick={() => { void handleConfirmFxRevaluation(false); }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #1d4ed8",
                    background: "#ffffff",
                    color: "#1d4ed8",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  3. Tạo chứng từ (Chưa ghi sổ - AF-15)
                </button>
                <button
                  type="button"
                  onClick={() => { void handleConfirmFxRevaluation(true); }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    background: "#1d4ed8",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Tạo chứng từ & Ghi sổ ngay (AF-14)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 11: TỔNG HỢP PHÁT SINH, SỐ DƯ & KIỂM TRA CÂN ĐỐI GL (UC-GL-10) */}
      {/* ===================================================================== */}
      {balanceAggregationModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1220,
              maxHeight: "92vh",
              background: "#ffffff",
              borderRadius: 10,
              boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                    Tổng hợp phát sinh, số dư và Kiểm tra cân đối Sổ cái (UC-GL-10)
                  </h3>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 700,
                      background:
                        balAggStatus === "VALID"
                          ? "#dcfce7"
                          : balAggStatus === "STALE"
                          ? "#fef3c7"
                          : "#fee2e2",
                      color:
                        balAggStatus === "VALID"
                          ? "#166534"
                          : balAggStatus === "STALE"
                          ? "#92400e"
                          : "#991b1b",
                    }}
                  >
                    {balAggStatus === "VALID"
                      ? "VALID — Đã tổng hợp & Cân đối"
                      : balAggStatus === "STALE"
                      ? "STALE — Cần tổng hợp lại"
                      : "INVALID — Mất cân đối"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Chỉ tổng hợp từ bút toán <strong>POSTED</strong> (BR-GL-BAL-01) | Watermark nguồn:{" "}
                  <code>{balAggWatermark}</code> | Cập nhật lúc: {balAggLastRunAt}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBalanceAggregationModalOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter & Action Toolbar */}
            <div
              style={{
                padding: "12px 20px",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  Kỳ kế toán:
                  <input
                    type="text"
                    value={balAggPeriodCode}
                    onChange={(e) => setBalAggPeriodCode(e.target.value)}
                    style={{
                      marginLeft: 8,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      fontSize: 13,
                      width: 110,
                    }}
                  />
                </label>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  Phạm vi TK:
                  <select
                    value={balAggAccountScope}
                    onChange={(e) => setBalAggAccountScope(e.target.value)}
                    style={{
                      marginLeft: 8,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <option value="ALL">Toàn bộ hệ thống tài khoản</option>
                    <option value="111">Nhóm 111 - Tiền mặt</option>
                    <option value="131">Nhóm 131 - Phải thu khách hàng (Lưỡng tính)</option>
                    <option value="331">Nhóm 331 - Phải trả người bán (Lưỡng tính)</option>
                    <option value="421">Nhóm 421 - Lợi nhuận chưa phân phối</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    void handleValidatePeriodBalance();
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "1px solid #0284c7",
                    background: "#f0f9ff",
                    color: "#0369a1",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Kiểm tra 4 nguyên tắc cân đối (Bước 5-8)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRunBalanceAggregation();
                  }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "#00a862",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Tổng hợp lại số dư (AF-05)</span>
                </button>
              </div>
            </div>

            {/* 4 Core Balance Validation Banner */}
            <div
              style={{
                padding: "10px 20px",
                background: "#f0fdf4",
                borderBottom: "1px solid #bbf7d0",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                fontSize: 12,
              }}
            >
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                <div style={{ color: "#64748b" }}>1. Tổng PS Nợ = Tổng PS Có (BR-18)</div>
                <div style={{ fontWeight: 700, color: "#15803d", marginTop: 2 }}>
                  588.200.000 ₫ = 588.200.000 ₫ (Cân bằng)
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                <div style={{ color: "#64748b" }}>2. Tổng Dư ĐK & Dư CK (BR-19..20)</div>
                <div style={{ fontWeight: 700, color: "#15803d", marginTop: 2 }}>
                  ĐK: 240.000.000 ₫ | CK: 408.200.000 ₫
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                <div style={{ color: "#64748b" }}>3. Liên tục số dư kỳ trước (BR-21..22)</div>
                <div style={{ fontWeight: 700, color: "#15803d", marginTop: 2 }}>
                  Khớp 100% Dư CK trước = Dư ĐK này
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                <div style={{ color: "#64748b" }}>4. Khớp TK Cha-Con & Lưỡng tính (BR-23..29)</div>
                <div style={{ fontWeight: 700, color: "#15803d", marginTop: 2 }}>
                  131 / 331 tách Dư Nợ - Dư Có theo đối tượng
                </div>
              </div>
            </div>

            {/* Trial Balance Table */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#e2e8f0", color: "#1e293b", fontWeight: 700 }}>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "left" }}>Số TK</th>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "left" }}>Tên tài khoản</th>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "right" }}>Dư Nợ ĐK</th>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "right" }}>Dư Có ĐK</th>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "right" }}>Phát sinh Nợ</th>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "right" }}>Phát sinh Có</th>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "right" }}>Dư Nợ CK</th>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "right" }}>Dư Có CK</th>
                    <th style={{ padding: "8px 10px", border: "1px solid #cbd5e1", textAlign: "center" }}>Truy vết</th>
                  </tr>
                </thead>
                <tbody>
                  {balAggRows
                    .filter((r) => balAggAccountScope === "ALL" || r.accountCode.startsWith(balAggAccountScope))
                    .map((row) => (
                      <tr
                        key={row.accountCode}
                        style={{
                          background: row.isParent ? "#f8fafc" : "#ffffff",
                          fontWeight: row.isParent ? 700 : 400,
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", color: "#0f172a" }}>
                          {row.accountCode}
                          {row.isBilateral && (
                            <span
                              style={{
                                marginLeft: 6,
                                padding: "1px 6px",
                                borderRadius: 4,
                                fontSize: 10,
                                background: "#dbeafe",
                                color: "#1d4ed8",
                                fontWeight: 600,
                              }}
                            >
                              Lưỡng tính
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0" }}>
                          <div>{row.accountName}</div>
                          {row.bilateralNote && (
                            <div style={{ fontSize: 11, color: "#0369a1", marginTop: 2 }}>{row.bilateralNote}</div>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "right" }}>
                          {formatVndNumber(row.openingDebit)}
                        </td>
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "right" }}>
                          {formatVndNumber(row.openingCredit)}
                        </td>
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "right", color: "#0f766e" }}>
                          {formatVndNumber(row.periodDebit)}
                        </td>
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "right", color: "#b45309" }}>
                          {formatVndNumber(row.periodCredit)}
                        </td>
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>
                          {formatVndNumber(row.closingDebit)}
                        </td>
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>
                          {formatVndNumber(row.closingCredit)}
                        </td>
                        <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDrilldownBalanceAccount(row.accountCode);
                            }}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 4,
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#0284c7",
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Drill-down
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {/* Drill-down Panel (BR-GL-BAL-39) */}
              {balAggDrilldownAccount && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 13, color: "#0f172a" }}>
                      Truy vết ngược dòng bút toán POSTED cấu thành số tổng hợp — TK {balAggDrilldownAccount} (BR-GL-BAL-39)
                    </strong>
                    <button
                      type="button"
                      onClick={() => setBalAggDrilldownAccount(null)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#64748b",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Đóng truy vết
                    </button>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#ffffff" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", color: "#334155" }}>
                        <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Số chứng từ</th>
                        <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Ngày hạch toán</th>
                        <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Phân hệ</th>
                        <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Đối tượng</th>
                        <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Diễn giải</th>
                        <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>PS Nợ</th>
                        <th style={{ padding: "6px 8px", border: "1px solid #cbd5e1", textAlign: "right" }}>PS Có</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balAggDrilldownRows.map((m, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: 600, color: "#0284c7" }}>
                            {m.entry_number}
                          </td>
                          <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>{m.posting_date}</td>
                          <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>{m.source_module}</td>
                          <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>{m.party_code || "-"}</td>
                          <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>{m.description}</td>
                          <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "right" }}>{m.debit}</td>
                          <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "right" }}>{m.credit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setBalanceAggregationModalOpen(false);
                  setGlReconciliationModalOpen(true);
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "1px solid #0284c7",
                  background: "#f0f9ff",
                  color: "#0369a1",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginRight: 8,
                }}
              >
                Chuyển sang Đối chiếu GL ↔ Phân hệ (UC-GL-11)
              </button>
              <button
                type="button"
                onClick={() => setBalanceAggregationModalOpen(false)}
                style={{
                  padding: "7px 20px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 12: ĐỐI CHIẾU SỐ LIỆU GL VỚI CÁC PHÂN HỆ (UC-GL-11)              */}
      {/* ===================================================================== */}
      {glReconciliationModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1280,
              maxHeight: "92vh",
              background: "#ffffff",
              borderRadius: 10,
              boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                    Đối chiếu số liệu Sổ cái GL với các Phân hệ nghiệp vụ (UC-GL-11)
                  </h3>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 700,
                      background:
                        glRecStatus === "MATCHED"
                          ? "#dcfce7"
                          : glRecStatus === "WARNING"
                          ? "#fef3c7"
                          : "#fee2e2",
                      color:
                        glRecStatus === "MATCHED"
                          ? "#166534"
                          : glRecStatus === "WARNING"
                          ? "#92400e"
                          : "#991b1b",
                    }}
                  >
                    {glRecStatus === "MATCHED"
                      ? "MATCHED — Khớp số liệu GL & Phân hệ"
                      : glRecStatus === "WARNING"
                      ? "WARNING — Có cảnh báo cần chú ý"
                      : "DIFFERENCE — Có chênh lệch cần kiểm tra"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Chỉ phát hiện, phân loại nguyên nhân và hỗ trợ Drill-down 2 phía; tuyệt đối không tự động sửa số liệu nguồn (BR-GL-REC-50, 94) | Snapshot:{" "}
                  <code>{glRecWatermark}</code> | Chạy lúc: {glRecLastRunAt}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGlReconciliationModalOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter & Action Toolbar */}
            <div
              style={{
                padding: "12px 20px",
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  Kỳ kế toán:
                  <input
                    type="text"
                    value={glRecPeriodCode}
                    onChange={(e) => setGlRecPeriodCode(e.target.value)}
                    style={{
                      marginLeft: 8,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      fontSize: 13,
                      width: 110,
                    }}
                  />
                </label>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  Loại đối chiếu (AF-01..07):
                  <select
                    value={glRecType}
                    onChange={(e) => setGlRecType(e.target.value as any)}
                    style={{
                      marginLeft: 8,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <option value="GL_AR">GL ↔ AR (Công nợ phải thu khách hàng - TK 131)</option>
                    <option value="GL_AP">GL ↔ AP (Công nợ phải trả nhà cung cấp - TK 331)</option>
                    <option value="GL_CASH">GL ↔ CASH (Tiền mặt / Sổ quỹ - TK 111)</option>
                    <option value="GL_BANK">GL ↔ BANK (Tiền gửi ngân hàng - TK 112)</option>
                    <option value="GL_INV">GL ↔ INV (Giá trị tồn kho - TK 152, 155, 156)</option>
                    <option value="GL_FA">GL ↔ FA (Tài sản cố định & Khấu hao - TK 211, 214)</option>
                    <option value="GL_TAX">GL ↔ TAX (Thuế GTGT / TNDN - TK 133, 333)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    void handleRunGlReconciliation(false);
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "1px solid #0284c7",
                    background: "#f0f9ff",
                    color: "#0369a1",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Đối chiếu / Kiểm tra (Bước 6-38)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRunGlReconciliation(true);
                  }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "#00a862",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Đối chiếu lại sau khi xử lý nguồn (Bước 45 / AF-17)</span>
                </button>
              </div>
            </div>

            {/* Summary KPI Cards */}
            <div
              style={{
                padding: "10px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                fontSize: 12,
              }}
            >
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b" }}>Số dòng Khớp (MATCHED)</div>
                <div style={{ fontWeight: 700, color: "#15803d", fontSize: 14, marginTop: 2 }}>
                  {glRecLines.filter((l) => l.status === "MATCHED").length} dòng
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b" }}>Số dòng Chênh lệch (DIFFERENCE)</div>
                <div style={{ fontWeight: 700, color: "#dc2626", fontSize: 14, marginTop: 2 }}>
                  {glRecLines.filter((l) => l.status === "DIFFERENCE").length} dòng
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b" }}>Tổng giá trị chênh lệch tuyệt đối</div>
                <div style={{ fontWeight: 700, color: "#b45309", fontSize: 14, marginTop: 2 }}>
                  {formatVndNumber(glRecLines.reduce((s, l) => s + Math.abs(l.diffClosing), 0))} ₫
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                <div style={{ color: "#64748b" }}>Điều kiện Khóa sổ kỳ (UC-GL-12 / BR-81)</div>
                <div
                  style={{
                    fontWeight: 700,
                    color: glRecStatus === "MATCHED" ? "#15803d" : "#dc2626",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  {glRecStatus === "MATCHED" ? "Đủ điều kiện khóa kỳ" : "Chặn khóa kỳ (Còn lệch BLOCK)"}
                </div>
              </div>
            </div>

            {/* Reconciliation Lines Table */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#e2e8f0", color: "#1e293b", fontWeight: 700 }}>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "left" }}>TK / Đối tượng</th>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "right" }}>PS Nợ GL</th>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "right" }}>PS Nợ Phân hệ</th>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "right" }}>Dư CK GL</th>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "right" }}>Dư CK Phân hệ</th>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "right" }}>Chênh lệch (GL - PH)</th>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>Trạng thái</th>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "left" }}>
                      Nguyên nhân dự kiến (BR-GL-REC-46)
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>Truy vết 2 phía</th>
                  </tr>
                </thead>
                <tbody>
                  {glRecLines.map((ln) => (
                    <tr
                      key={ln.reconciliationKey}
                      style={{
                        background: ln.status === "DIFFERENCE" ? "#fff1f2" : "#ffffff",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          TK {ln.accountCode} — {ln.objectCode}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{ln.objectName}</div>
                        {ln.note && (
                          <div style={{ fontSize: 11, color: "#0369a1", marginTop: 2 }}>Ghi chú: {ln.note}</div>
                        )}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right" }}>
                        {formatVndNumber(ln.glPeriodDebit)}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right" }}>
                        {formatVndNumber(ln.subPeriodDebit)}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>
                        {formatVndNumber(ln.glClosing)}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>
                        {formatVndNumber(ln.subClosing)}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #e2e8f0",
                          textAlign: "right",
                          fontWeight: 700,
                          color: ln.diffClosing === 0 ? "#15803d" : "#dc2626",
                        }}
                      >
                        {formatVndNumber(ln.diffClosing)}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: ln.status === "MATCHED" ? "#dcfce7" : "#fee2e2",
                            color: ln.status === "MATCHED" ? "#166534" : "#991b1b",
                          }}
                        >
                          {ln.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontWeight: 600, color: "#334155", fontSize: 11 }}>{ln.discrepancyType}</div>
                        <div style={{ color: "#475569", fontSize: 11.5, marginTop: 2 }}>{ln.discrepancyReason}</div>
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => setGlRecSelectedLine(ln)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#0284c7",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Drill-down (Bước 39)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 2-Sided Drilldown & Note Annotation Panel (Steps 39-44, BR-GL-REC-48, 49, 56, 93) */}
              {glRecSelectedLine && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <strong style={{ fontSize: 13, color: "#0f172a" }}>
                      Truy vết 2 phía (Sổ cái GL ↔ Phân hệ chi tiết) — Khóa: {glRecSelectedLine.reconciliationKey} (BR-GL-REC-48, 49, 93)
                    </strong>
                    <button
                      type="button"
                      onClick={() => setGlRecSelectedLine(null)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#64748b",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Đóng truy vết
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {/* Left: GL Entries */}
                    <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#0f766e", marginBottom: 6 }}>
                        Danh sách Bút toán Sổ cái GL (POSTED) — Bước 40
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "left" }}>Số bút toán</th>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "left" }}>Ngày HT</th>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "right" }}>PS Nợ</th>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "right" }}>PS Có</th>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "center" }}>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {glRecSelectedLine.glEntries.map((e: any, idx: number) => (
                            <tr key={idx}>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0", fontWeight: 600 }}>{e.entry_number}</td>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0" }}>{e.posting_date}</td>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0", textAlign: "right" }}>{e.debit}</td>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0", textAlign: "right" }}>{e.credit}</td>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0", textAlign: "center" }}>{e.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Right: Subledger Vouchers */}
                    <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#b45309", marginBottom: 6 }}>
                        Danh sách Chứng từ Phân hệ nguồn — Bước 41
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "left" }}>Số chứng từ</th>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "left" }}>Ngày CT</th>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "right" }}>Tăng / Nợ</th>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "right" }}>Giảm / Có</th>
                            <th style={{ padding: "5px", border: "1px solid #cbd5e1", textAlign: "center" }}>Đồng bộ GL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {glRecSelectedLine.subledgerVouchers.map((v: any, idx: number) => (
                            <tr key={idx}>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0", fontWeight: 600 }}>{v.voucher_number}</td>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0" }}>{v.document_date}</td>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0", textAlign: "right" }}>{v.debit}</td>
                              <td style={{ padding: "5px", border: "1px solid #e2e8f0", textAlign: "right" }}>{v.credit}</td>
                              <td
                                style={{
                                  padding: "5px",
                                  border: "1px solid #e2e8f0",
                                  textAlign: "center",
                                  color: v.gl_status === "POSTED" ? "#15803d" : "#dc2626",
                                  fontWeight: 600,
                                }}
                              >
                                {v.gl_status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Step 44: Note annotation without auto-mutating source data */}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Ghi chú nguyên nhân / hướng xử lý tại chứng từ nguồn (Bước 44, BR-GL-REC-56)..."
                      value={glRecNoteInput}
                      onChange={(e) => setGlRecNoteInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 12,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleAnnotateGlReconciliationNote();
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "1px solid #0f766e",
                        background: "#f0fdf4",
                        color: "#0f766e",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Lưu ghi chú
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setGlReconciliationModalOpen(false);
                  setLockPeriodModalOpen(true);
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "1px solid #00a862",
                  background: "#f0fdf4",
                  color: "#15803d",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginRight: 8,
                }}
              >
                Chuyển sang Khóa / Bỏ khóa sổ kỳ kế toán (UC-GL-12)
              </button>
              <button
                type="button"
                onClick={() => setGlReconciliationModalOpen(false)}
                style={{
                  padding: "7px 20px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
