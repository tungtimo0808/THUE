import React, { useState } from "react";
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
  const currentTab = tab || "process";

  // --- Interactive Popovers on Workflow Nodes (Image 1 & 2) ---
  const [showLockMenu, setShowLockMenu] = useState(false);
  const [showStatementsMenu, setShowStatementsMenu] = useState(false);

  // --- Modals State ---
  const [lockPeriodModalOpen, setLockPeriodModalOpen] = useState(false);
  const [unlockPeriodModalOpen, setUnlockPeriodModalOpen] = useState(false);
  const [lockByTypeModalOpen, setLockByTypeModalOpen] = useState(false);
  const [autoLockModalOpen, setAutoLockModalOpen] = useState(false);

  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementModalType, setStatementModalType] = useState<string>("Báo cáo tài chính");

  const [addVoucherModalOpen, setAddVoucherModalOpen] = useState(false);
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

  // Report Preview Modal
  const [previewReportName, setPreviewReportName] = useState<string | null>(null);

  // Transactions tab landing / table & dropdown state
  const [showVoucherTable, setShowVoucherTable] = useState(false);
  const [showAddVoucherMenu, setShowAddVoucherMenu] = useState(false);
  const [aiVoucherModalOpen, setAiVoucherModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // 6 Types of General Voucher (Screenshots 1 - 5)
  const [selectedVoucherType, setSelectedVoucherType] = useState<GeneralVoucherType>(
    "1. Hạch toán thuế TNDN phải nộp"
  );
  const [showVoucherTypeDropdown, setShowVoucherTypeDropdown] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"hach_toan" | "ke_khai_thue">("hach_toan");
  const [isGroupInvoices, setIsGroupInvoices] = useState(false);
  const [excludeFromVatDeclaration, setExcludeFromVatDeclaration] = useState(false);

  // Voucher Master Form Fields
  const [voucherNo, setVoucherNo] = useState("NVK00001");
  const [voucherPostingDate, setVoucherPostingDate] = useState("01/10/2026");
  const [voucherDocDate, setVoucherDocDate] = useState("01/10/2026");
  const [voucherDueDate, setVoucherDueDate] = useState("DD/MM/YYYY");
  const [voucherDescription, setVoucherDescription] = useState("Hạch toán thuế TNDN phải nộp");

  // Voucher Detail Lines
  const [voucherRows, setVoucherRows] = useState<any[]>([
    {
      id: "1",
      desc: "Hạch toán thuế TNDN phải nộp",
      debitAcc: "8211",
      creditAcc: "3334",
      amount: 0,
    },
  ]);

  const switchVoucherType = (type: GeneralVoucherType) => {
    setSelectedVoucherType(type);
    setShowVoucherTypeDropdown(false);
    setActiveDetailTab("hach_toan");
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
            debitObject: "",
            debitObjectName: "",
            creditObject: "",
            creditObjectName: "",
            loanContract: "",
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
            expenseItem: "",
            department: "",
            costObject: "",
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
        setVoucherDescription("Kết chuyển lãi lỗ đầu năm");
        setVoucherPostingDate("01/01/2026");
        setVoucherDocDate("01/01/2026");
        setVoucherRows([
          {
            id: "1",
            desc: "Kết chuyển lợi nhuận sau thuế chưa phân phối năm nay sang năm trước",
            debitAcc: "4212",
            creditAcc: "4211",
            amount: 0,
          },
        ]);
        break;
      case "6. Khấu trừ thuế tiêu thụ đặc biệt":
        setVoucherDescription("");
        setVoucherDueDate("DD/MM/YYYY");
        setVoucherPostingDate("01/10/2026");
        setVoucherDocDate("01/10/2026");
        setVoucherRows([
          {
            id: "1",
            desc: "",
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
    switchVoucherType(type);
    setAddVoucherModalOpen(true);
    setShowAddVoucherMenu(false);
  };

  // Tax invoice rows for Type 4 Tab 2
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

  // Advance Settlement (Quyết toán tạm ứng QTTU00001) Form State
  const [settlePerAdvance, setSettlePerAdvance] = useState(false);
  const [advanceEmployee, setAdvanceEmployee] = useState("");
  const [advanceDescription, setAdvanceDescription] = useState("Quyết toán tạm ứng");
  const [advancePostingDate, setAdvancePostingDate] = useState("01/10/2026");
  const [advanceDocDate, setAdvanceDocDate] = useState("01/10/2026");
  const [advanceVoucherNo, setAdvanceVoucherNo] = useState("QTTU00001");
  const [advanceDetailTab, setAdvanceDetailTab] = useState<"hach_toan" | "ke_khai_thue">("hach_toan");
  const [advanceGroupInvoices, setAdvanceGroupInvoices] = useState(false);
  const [advanceRows, setAdvanceRows] = useState<any[]>([
    {
      id: "1",
      desc: "Quyết toán tạm ứng",
      debitAcc: "",
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
      invoiceDate: "01/10/2026",
      invoiceNo: "",
      invoiceForm: "1",
      invoiceSerial: "C26T",
      goodsGroup: "1",
      debitAcc: "1331",
      creditAcc: "141",
      preTaxAmount: 0,
      vatRate: "10%",
      vatAmount: 0,
      partnerName: "",
    },
  ]);

  const handleAddAdvanceRow = () => {
    setAdvanceRows([
      ...advanceRows,
      {
        id: String(advanceRows.length + 1),
        desc: advanceDescription,
        debitAcc: "",
        creditAcc: "141",
        amount: 0,
        debitObject: "",
        debitObjectName: "",
        creditObject: "",
        creditObjectName: "",
      },
    ]);
  };

  const handleDeleteAdvanceRow = (id: string) => {
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
          creditObject: "",
          creditObjectName: "",
        },
      ]);
    } else {
      setAdvanceRows(advanceRows.filter((r) => r.id !== id));
    }
  };

  const handleClearAllAdvanceRows = () => {
    setAdvanceRows([
      {
        id: "1",
        desc: advanceDescription,
        debitAcc: "",
        creditAcc: "141",
        amount: 0,
        debitObject: "",
        debitObjectName: "",
        creditObject: "",
        creditObjectName: "",
      },
    ]);
  };

  // Tab 4: Kết chuyển lãi lỗ state (Matching user screenshots 1 & 2)
  const [showClosingTable, setShowClosingTable] = useState(false);
  const [closingVoucherNo, setClosingVoucherNo] = useState("NVK00001");
  const [closingToDate, setClosingToDate] = useState("31/10/2026");
  const [closingPostingDate, setClosingPostingDate] = useState("31/10/2026");
  const [closingDocDate, setClosingDocDate] = useState("31/10/2026");
  const [closingDescription, setClosingDescription] = useState("Kết chuyển lãi lỗ đến ngày 31/10/2026");
  const [closingRows, setClosingRows] = useState<any[]>([]);

  const handleFetchClosingData = () => {
    setClosingRows([
      {
        id: "1",
        desc: "Kết chuyển Doanh thu bán hàng và cung cấp dịch vụ sang 911",
        debitAcc: "511",
        creditAcc: "911",
        amount: 485000000,
      },
      {
        id: "2",
        desc: "Kết chuyển Doanh thu hoạt động tài chính sang 911",
        debitAcc: "515",
        creditAcc: "911",
        amount: 18200000,
      },
      {
        id: "3",
        desc: "Kết chuyển Chi phí giá vốn hàng bán từ 911",
        debitAcc: "911",
        creditAcc: "632",
        amount: 295000000,
      },
      {
        id: "4",
        desc: "Kết chuyển Chi phí tài chính từ 911",
        debitAcc: "911",
        creditAcc: "635",
        amount: 12500000,
      },
      {
        id: "5",
        desc: "Kết chuyển Chi phí bán hàng từ 911",
        debitAcc: "911",
        creditAcc: "641",
        amount: 24300000,
      },
      {
        id: "6",
        desc: "Kết chuyển Chi phí quản lý doanh nghiệp từ 911",
        debitAcc: "911",
        creditAcc: "642",
        amount: 48600000,
      },
      {
        id: "7",
        desc: "Kết chuyển Lợi nhuận sau thuế chưa phân phối sang 4212",
        debitAcc: "911",
        creditAcc: "4212",
        amount: 122800000,
      },
    ]);
    notify("Đã tự động lấy dữ liệu số dư và kết chuyển doanh thu, chi phí sang 911 thành công!");
  };

  const handleAddClosingRow = () => {
    setClosingRows([
      ...closingRows,
      {
        id: String(closingRows.length + 1),
        desc: closingDescription,
        debitAcc: "",
        creditAcc: "",
        amount: 0,
      },
    ]);
  };

  const handleDeleteClosingRow = (id: string) => {
    setClosingRows(closingRows.filter((r) => r.id !== id));
  };

  const handleClearAllClosingRows = () => {
    setClosingRows([]);
  };

  const handleSaveClosingVoucher = () => {
    setClosingEntryModalOpen(false);
    notify(`Đã cất chứng từ kết chuyển lãi lỗ ${closingVoucherNo} thành công!`);
  };

  // Tab 5: Lập báo cáo tài chính state (Matching user screenshots 1 - 5)
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
  const [statementReuseLatest, setStatementReuseLatest] = useState(false);

  // Checkboxes for BCTC reports table (Screenshot 2)
  const [selectedBctcReports, setSelectedBctcReports] = useState<Record<string, boolean>>({
    "B01-DN": true,
    "B02-DN": false,
    "B03-DN": false,
    "B03-DN-GT": false,
  });

  // Checkboxes for Mid-Year BCTC reports table (Screenshot 4)
  const [selectedMidYearReports, setSelectedMidYearReports] = useState<Record<string, boolean>>({
    "B01a-DN": true,
    "B02a-DN": false,
    "B03a-DN": false,
    "B03a-DN-GT": false,
  });

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

  const handleApplyStatementParams = () => {
    setStatementModalOpen(false);
    let title = "Báo cáo tài chính";
    if (statementCategory === "thuyet_minh_bctc") title = "Thuyết minh báo cáo tài chính";
    else if (statementCategory === "bctc_giua_nien_do") title = "Báo cáo tài chính giữa niên độ";
    else if (statementCategory === "thuyet_minh_bctc_giua_nien_do") title = "Thuyết minh báo cáo tài chính giữa niên độ";

    notify(`Đã lập thành công ${title} kỳ ${statementPeriod} năm ${statementYear}!`);
    setPreviewReportName(title);
  };

  // Search in tabs
  const [searchTerm, setSearchTerm] = useState("");

  // Period Lock Form State
  const [lockDate, setLockDate] = useState("31/10/2026");
  const [unlockDate, setUnlockDate] = useState("30/09/2026");
  const [lockPassword, setLockPassword] = useState("");

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

  // Sample Data for Tables in Subtabs
  const [advanceRequests, setAdvanceRequests] = useState([
    { id: "DNQT001", date: "24/10/2026", employee: "Nguyễn Văn Hùng", dept: "Phòng Kinh doanh", amount: 15000000, reason: "Tạm ứng công tác thị trường miền Trung", status: "Đã duyệt" },
    { id: "DNQT002", date: "26/10/2026", employee: "Trần Thị Mai", dept: "Phòng Kế toán", amount: 8500000, reason: "Mua sắm văn phòng phẩm & đồ dùng Q4", status: "Chờ duyệt" },
    { id: "DNQT003", date: "28/10/2026", employee: "Lê Hoàng Long", dept: "Phòng Kỹ thuật", amount: 12000000, reason: "Công tác bảo trì thiết bị chi nhánh Đà Nẵng", status: "Đã duyệt" },
  ]);

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
                  padding: "24px 28px 32px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  minHeight: 380,
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#1e293b",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    marginBottom: 36,
                  }}
                >
                  NGHIỆP VỤ TỔNG HỢP
                </div>

                {/* Workflow Canvas */}
                <div
                  style={{
                    position: "relative",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-around",
                    padding: "0 20px",
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
                    {/* Top Row horizontal connector */}
                    <line
                      x1="180"
                      y1="60"
                      x2="330"
                      y2="60"
                      stroke="#86efac"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                    <polygon points="335,60 325,55 325,65" fill="#86efac" />

                    {/* From Quyết toán to Bottom line */}
                    <path
                      d="M 335,90 Q 335,190 420,190"
                      fill="none"
                      stroke="#bbf7d0"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />

                    {/* Bottom Row line connecting all bottom nodes */}
                    <line
                      x1="280"
                      y1="190"
                      x2="420"
                      y2="190"
                      stroke="#86efac"
                      strokeWidth="2"
                    />
                    <polygon points="425,190 415,185 415,195" fill="#86efac" />

                    <line
                      x1="480"
                      y1="190"
                      x2="600"
                      y2="190"
                      stroke="#86efac"
                      strokeWidth="2"
                    />
                    <polygon points="605,190 595,185 595,195" fill="#86efac" />

                    <line
                      x1="660"
                      y1="190"
                      x2="780"
                      y2="190"
                      stroke="#86efac"
                      strokeWidth="2"
                    />
                    <polygon points="785,190 775,185 775,195" fill="#86efac" />

                    {/* Continuing rightwards */}
                    <line
                      x1="840"
                      y1="190"
                      x2="940"
                      y2="190"
                      stroke="#86efac"
                      strokeWidth="2"
                    />
                    <polygon points="945,190 935,185 935,195" fill="#86efac" />
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
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 16,
                          background: "#e6fcf5",
                          border: "1.5px solid #a7f3d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)",
                        }}
                      >
                        {/* Custom Green Note with Send Airplane icon */}
                        <div
                          style={{
                            width: 32,
                            height: 38,
                            background: "#00a862",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          }}
                        >
                          <DollarSign size={16} color="#ffffff" strokeWidth={2.5} />
                          {/* Circle badge */}
                          <div
                            style={{
                              position: "absolute",
                              top: -4,
                              right: -4,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#f59e0b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "1.5px solid #ffffff",
                            }}
                          >
                            <ArrowUpRight size={10} color="#ffffff" strokeWidth={3} />
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "#1e293b",
                          lineHeight: 1.35,
                        }}
                      >
                        Đề nghị quyết<br />toán tạm ứng
                      </div>
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
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 16,
                          background: "#e6fcf5",
                          border: "1.5px solid #a7f3d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 38,
                            background: "#00a862",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                          }}
                        >
                          <DollarSign size={16} color="#ffffff" strokeWidth={2.5} />
                          <div
                            style={{
                              position: "absolute",
                              bottom: -4,
                              right: -4,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#eab308",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "1.5px solid #ffffff",
                            }}
                          >
                            <Check size={10} color="#ffffff" strokeWidth={3} />
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "#1e293b",
                          lineHeight: 1.35,
                        }}
                      >
                        Quyết toán<br />tạm ứng
                      </div>
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
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 16,
                          background: "#e6fcf5",
                          border: "1.5px solid #a7f3d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 38,
                            background: "#00a862",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                          }}
                        >
                          <FileText size={18} color="#ffffff" />
                          <div
                            style={{
                              position: "absolute",
                              bottom: -4,
                              right: -4,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#f59e0b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "1.5px solid #ffffff",
                              fontSize: 9,
                              fontWeight: 900,
                              color: "#fff",
                            }}
                          >
                            ...
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "#1e293b",
                          lineHeight: 1.35,
                        }}
                      >
                        Chứng từ<br />nghiệp vụ khác
                      </div>
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
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 16,
                          background: "#e6fcf5",
                          border: "1.5px solid #a7f3d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 38,
                            background: "#eab308",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                          }}
                        >
                          <TrendingUp size={20} color="#ffffff" strokeWidth={2.5} />
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "#1e293b",
                          lineHeight: 1.35,
                        }}
                      >
                        Kết chuyển<br />lãi lỗ
                      </div>
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
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 16,
                          background: "#e6fcf5",
                          border: "1.5px solid #a7f3d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 38,
                            background: "#00a862",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Lock size={18} color="#ffffff" />
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "#1e293b",
                          lineHeight: 1.35,
                        }}
                      >
                        Khóa sổ kỳ<br />kế toán
                      </div>

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
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 16,
                          background: "#e6fcf5",
                          border: "1.5px solid #a7f3d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 38,
                            background: "#00a862",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                          }}
                        >
                          <BarChart3 size={18} color="#ffffff" />
                          <div
                            style={{
                              position: "absolute",
                              bottom: -4,
                              right: -4,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#eab308",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "1.5px solid #ffffff",
                            }}
                          >
                            <Sparkles size={9} color="#ffffff" />
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "#1e293b",
                          lineHeight: 1.35,
                        }}
                      >
                        Lập báo cáo<br />tài chính
                      </div>

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

            {/* Middle Row: 5 Action Cards (Hệ thống tài khoản, Mã thống kê, Khoản mục CP, Tiện ích, Tùy chọn) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
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
                  label: "Tiện ích",
                  icon: Lightbulb,
                  action: () => notify("Mở tiện ích phân bổ & đánh giá ngoại tệ"),
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

            {/* Bottom Row: AMIS Quy trình Banner & 3 Story Cards (Exact Image 1 & 2) */}
            <div
              style={{
                background: "#ecfdf5",
                borderRadius: 8,
                border: "1px solid #a7f3d0",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Banner Header: Blue Q icon, title, description, and button */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Blue Q Icon */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: 24,
                      fontWeight: 800,
                      boxShadow: "0 4px 10px rgba(2, 132, 199, 0.3)",
                      fontFamily: "sans-serif",
                    }}
                  >
                    Q
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                      AMIS Quy trình
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                      Giảm tải công việc kế toán bằng cách số hóa phê duyệt đề nghị thanh toán, tạm ứng và tự động sinh chứng từ.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    notify("Mở cấu hình thiết lập tự động hóa quy trình AMIS");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "9px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                  }}
                >
                  <Settings size={16} />
                  <span>Thiết lập tự động</span>
                </button>
              </div>

              {/* Sub-section: CÂU CHUYỆN SỐ HÓA THÀNH CÔNG NỔI BẬT */}
              <div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#334155",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 14,
                  }}
                >
                  CÂU CHUYỆN SỐ HÓA THÀNH CÔNG NỔI BẬT
                </div>

                {/* 3 Story Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                  }}
                >
                  {/* Card 1 */}
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: 12,
                      display: "flex",
                      gap: 12,
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      transition: "transform 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    onClick={() => notify("Xem chi tiết: Câu chuyện Doanh nghiệp nhỏ tự động hóa")}
                  >
                    <img
                      src={amisStory1}
                      alt="Story 1"
                      style={{
                        width: 100,
                        height: 72,
                        borderRadius: 6,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.35 }}>
                          Doanh nghiệp nhỏ có thể tự động hóa nhờ...
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>
                          Giảm thời gian duyệt chi, tự động...
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#00a862", display: "flex", alignItems: "center", gap: 4 }}>
                        Chi tiết câu chuyện →
                      </div>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: 12,
                      display: "flex",
                      gap: 12,
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      transition: "transform 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    onClick={() => notify("Xem chi tiết: Lợi ích của việc tự động hóa quy trình")}
                  >
                    <img
                      src={amisStory2}
                      alt="Story 2"
                      style={{
                        width: 100,
                        height: 72,
                        borderRadius: 6,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.35 }}>
                          Lợi ích của việc tự động hóa quy trình đối v...
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>
                          Giảm thời gian duyệt chi, tự động...
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#00a862", display: "flex", alignItems: "center", gap: 4 }}>
                        Chi tiết câu chuyện →
                      </div>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: 12,
                      display: "flex",
                      gap: 12,
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      transition: "transform 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    onClick={() => notify("Xem chi tiết: Hành trình số hóa quy trình tại Đông Dương")}
                  >
                    <img
                      src={amisStory3}
                      alt="Story 3"
                      style={{
                        width: 100,
                        height: 72,
                        borderRadius: 6,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.35 }}>
                          Hành trình số hóa quy trình tại Đông Dươn...
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>
                          Giải pháp tháo gỡ điểm nghẽn cho kế toán
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#00a862", display: "flex", alignItems: "center", gap: 4 }}>
                        Chi tiết câu chuyện →
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                      Hệ thống liên thông thông suốt giữa AMIS Quy trình và AMIS Kế toán
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  {/* CARD 1: BƯỚC 1 - AMIS Quy trình */}
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
                    {/* Decorative Top-Right Watermark (AMIS Quy trình Logo) */}
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
                        AMIS Quy trình
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
                        Nhân viên lập đề nghị quyết toán tạm ứng trên AMIS Quy trình
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
                        AMIS Quy trình
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

                  {/* CARD 2: BƯỚC 2 - AMIS Quy trình */}
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
                    {/* Decorative Top-Right Watermark (AMIS Quy trình Logo) */}
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
                        AMIS Quy trình
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
                        Đề nghị được chuyển đến đúng người phụ trách để kiểm tra, trao đổi, bổ sung thông tin và phê duyệt trực tiếp trên AMIS Quy trình.
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
                        AMIS Quy trình
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

                  {/* CARD 3: BƯỚC 3 - AMIS Kế toán */}
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
                        AMIS Kế toán
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
                        Đồng bộ đề nghị về AMIS Kế toán
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
                        AMIS Kế toán
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Synced Data Table View */
              <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 20 }}>
                {/* Toolbar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                      <span>Bộ lọc</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setAddAdvanceRequestModalOpen(true)}
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
                        <th style={{ padding: "10px 14px" }}>Lý do / Mục đích</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>Số tiền tạm ứng</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>Trạng thái</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advanceRequests.map((item, idx) => (
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
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>{item.id}</td>
                          <td style={{ padding: "10px 14px" }}>{item.date}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 500 }}>{item.employee}</td>
                          <td style={{ padding: "10px 14px", color: "#64748b" }}>{item.dept}</td>
                          <td style={{ padding: "10px 14px" }}>{item.reason}</td>
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
                                background: item.status === "Đã duyệt" ? "#f0fdf4" : "#fef3c7",
                                color: item.status === "Đã duyệt" ? "#16a34a" : "#d97706",
                              }}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => notify(`Xem đề nghị quyết toán ${item.id}`)}
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
                          </td>
                        </tr>
                      ))}
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
                      onClick={() => notify("Nhập chứng từ từ tệp Excel")}
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
                          <input type="checkbox" />
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
                            <input type="checkbox" />
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
                                background: "#f0fdf4",
                                color: "#16a34a",
                              }}
                            >
                              Đã ghi sổ
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

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

                {/* Table of Prepared Financial Statements */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ width: 40, padding: "10px 14px", textAlign: "center" }}>
                          <input type="checkbox" defaultChecked style={{ accentColor: "#00a862" }} />
                        </th>
                        <th style={{ width: 110, padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>
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
                        <th style={{ width: 110, padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#475569" }}>
                          Trạng thái
                        </th>
                        <th style={{ width: 140, padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#475569" }}>
                          Chức năng
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          code: "B01-DN",
                          name: "Báo cáo tình hình tài chính (Bảng cân đối kế toán)",
                          period: "Năm 2026",
                          createdDate: "31/12/2026",
                          creator: "Kế toán tổng hợp",
                          status: "Đã lập",
                        },
                        {
                          code: "B02-DN",
                          name: "Báo cáo kết quả hoạt động kinh doanh",
                          period: "Năm 2026",
                          createdDate: "31/12/2026",
                          creator: "Kế toán tổng hợp",
                          status: "Đã lập",
                        },
                        {
                          code: "B03-DN",
                          name: "Báo cáo lưu chuyển tiền tệ (Phương pháp trực tiếp)",
                          period: "Năm 2026",
                          createdDate: "31/12/2026",
                          creator: "Kế toán tổng hợp",
                          status: "Đã lập",
                        },
                        {
                          code: "B09-DN",
                          name: "Bản thuyết minh Báo cáo tài chính",
                          period: "Năm 2026",
                          createdDate: "31/12/2026",
                          creator: "Kế toán tổng hợp",
                          status: "Đã lập",
                        },
                        {
                          code: "B01a-DN",
                          name: "Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)",
                          period: "Quý 3/2026",
                          createdDate: "30/09/2026",
                          creator: "Kế toán tổng hợp",
                          status: "Đã lập",
                        },
                      ]
                        .filter((item) =>
                          searchTerm
                            ? item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              item.period.toLowerCase().includes(searchTerm.toLowerCase())
                            : true
                        )
                        .map((row) => (
                          <tr
                            key={row.code + row.period}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
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
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>
                              {row.name}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#334155" }}>
                              {row.period}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#64748b" }}>
                              {row.createdDate}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#64748b" }}>
                              {row.creator}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "center" }}>
                              <span
                                style={{
                                  background: "#f0fdf4",
                                  color: "#16a34a",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                }}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "center" }}>
                              <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => setPreviewReportName(row.name)}
                                  title="Xem báo cáo"
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid #cbd5e1",
                                    background: "#ffffff",
                                    color: "#00a862",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Xem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => notify(`Đang gửi lệnh in ${row.code}`)}
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
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12.5, color: "#64748b" }}>
                  <span>Hiển thị 5 báo cáo tài chính</span>
                  <div style={{ fontWeight: 500, color: "#1e293b" }}>
                    Chế độ kế toán áp dụng: Thông tư 200/2014/TT-BTC & Thông tư 99/2025/TT-BTC
                  </div>
                </div>
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
                  <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
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
      {/* MODAL 1: KHÓA SỔ KỲ KẾ TOÁN (Image 1 popover item 1)                       */}
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
          }}
          onClick={() => setLockPeriodModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 480,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
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
                <Lock size={18} color="#00a862" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  Khóa sổ kỳ kế toán
                </span>
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
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
                  Khóa sổ đến ngày:
                </label>
                <input
                  type="text"
                  value={lockDate}
                  onChange={(e) => setLockDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13.5,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
                  Mật khẩu bảo vệ (nếu cần):
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu khóa sổ..."
                  value={lockPassword}
                  onChange={(e) => setLockPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13.5,
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
                <input type="checkbox" id="lock-holiday" defaultChecked />
                <label htmlFor="lock-holiday">Khóa toàn bộ các chứng từ phát sinh trước và vào ngày đã chọn</label>
              </div>

              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  borderRadius: 6,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  color: "#92400e",
                  lineHeight: 1.4,
                }}
              >
                Lưu ý: Sau khi khóa sổ, người dùng không có quyền sửa/xóa các chứng từ có ngày hạch toán trước hoặc vào ngày khóa sổ.
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
                onClick={() => {
                  setLockPeriodModalOpen(false);
                  notify(`Đã khóa sổ kỳ kế toán thành công đến ngày ${lockDate}`);
                }}
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
                Thực hiện
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BỎ KHÓA SỔ KỲ KẾ TOÁN (Image 1 popover item 2)                     */}
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
          }}
          onClick={() => setUnlockPeriodModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 480,
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
                <Unlock size={18} color="#0284c7" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  Bỏ khóa sổ kỳ kế toán
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUnlockPeriodModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
                  Chuyển ngày khóa sổ lùi về ngày:
                </label>
                <input
                  type="text"
                  value={unlockDate}
                  onChange={(e) => setUnlockDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13.5,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
                  Mật khẩu xác nhận:
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu quản trị..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13.5,
                  }}
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
                  setUnlockPeriodModalOpen(false);
                  notify(`Đã bỏ khóa sổ kỳ kế toán. Ngày khóa sổ mới là: ${unlockDate}`);
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
                Đồng ý
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
                onClick={() => {
                  setLockByTypeModalOpen(false);
                  notify("Đã lưu thiết lập khóa sổ theo loại chứng từ!");
                }}
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
                Cất
              </button>
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
                <input type="checkbox" id="auto-lock-enable" defaultChecked />
                <label htmlFor="auto-lock-enable" style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                  Bật tính năng tự động khóa sổ định kỳ
                </label>
              </div>

              <div style={{ paddingLeft: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#475569" }}>
                  Tự động khóa sổ vào ngày:
                  <select
                    defaultValue="20"
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
                onClick={() => {
                  setAutoLockModalOpen(false);
                  notify("Đã lưu cấu hình tự động khóa sổ!");
                }}
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

              {/* CATEGORY 1: BÁO CÁO TÀI CHÍNH (Screenshot 2) */}
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

                  {/* Table Chọn báo cáo tài chính */}
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
                                  });
                                }}
                                style={{ accentColor: "#00a862" }}
                              />
                            </th>
                            <th style={{ width: 140, padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b", borderRight: "1px solid #c2d6cb" }}>
                              Mã báo cáo
                            </th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b" }}>
                              Tên báo cáo
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { code: "B01 - DN", key: "B01-DN", name: "Báo cáo tình hình tài chính" },
                            { code: "B02 - DN", key: "B02-DN", name: "Báo cáo kết quả hoạt động kinh doanh" },
                            { code: "B03 - DN", key: "B03-DN", name: "Báo cáo lưu chuyển tiền tệ (Phương pháp trực tiếp)" },
                            { code: "B03 - DN - GT", key: "B03-DN-GT", name: "Báo cáo lưu chuyển tiền tệ (Phương pháp gián tiếp)" },
                          ].map((item) => (
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

              {/* CATEGORY 2: THUYẾT MINH BÁO CÁO TÀI CHÍNH (Screenshot 3) */}
              {statementCategory === "thuyet_minh_bctc" && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={statementReuseLatest}
                      onChange={(e) => setStatementReuseLatest(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    Lấy thông tin chung từ lần nhập gần nhất
                  </label>
                </div>
              )}

              {/* CATEGORY 3: BÁO CÁO TÀI CHÍNH GIỮA NIÊN ĐỘ (Screenshot 4) */}
              {statementCategory === "bctc_giua_nien_do" && (
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
                              checked={Object.values(selectedMidYearReports).every(Boolean)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedMidYearReports({
                                  "B01a-DN": checked,
                                  "B02a-DN": checked,
                                  "B03a-DN": checked,
                                  "B03a-DN-GT": checked,
                                });
                              }}
                              style={{ accentColor: "#00a862" }}
                            />
                          </th>
                          <th style={{ width: 140, padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b", borderRight: "1px solid #c2d6cb" }}>
                            Mã báo cáo
                          </th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e293b" }}>
                            Tên báo cáo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { code: "B01a - DN", key: "B01a-DN", name: "Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)" },
                          { code: "B02a - DN", key: "B02a-DN", name: "Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)" },
                          { code: "B03a - DN", key: "B03a-DN", name: "Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)" },
                          { code: "B03a - DN - GT", key: "B03a-DN-GT", name: "Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)" },
                        ].map((item) => (
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

              {/* CATEGORY 4: THUYẾT MINH BÁO CÁO TÀI CHÍNH GIỮA NIÊN ĐỘ (Screenshot 5) */}
              {statementCategory === "thuyet_minh_bctc_giua_nien_do" && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={statementReuseLatest}
                      onChange={(e) => setStatementReuseLatest(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    Lấy thông tin chung từ lần nhập gần nhất
                  </label>
                </div>
              )}
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
                    <Sparkles
                      size={15}
                      color="#8b5cf6"
                      style={{ position: "absolute", right: 10, cursor: "pointer" }}
                      title="AVA AI gợi ý diễn giải"
                    />
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
                  onClick={() => notify("Trợ lý kế toán AVA đang sẵn sàng hỗ trợ định khoản!")}
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
                  <span>AVA Kế toán</span>
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
                      <th style={{ padding: "6px 10px", minWidth: 220, borderRight: "1px solid #cbd5e1" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Pin size={12} color="#64748b" /> Diễn giải
                        </span>
                      </th>
                      <th style={{ padding: "6px 10px", width: 100, borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                      <th style={{ padding: "6px 10px", width: 100, borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                      <th style={{ padding: "6px 10px", width: 140, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền</th>

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
                    <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                      <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right" }}>
                        Tổng cộng:
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a" }}>
                        {voucherRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("vi-VN")}
                      </td>
                      <td colSpan={6}></td>
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

            {/* 6. BOTTOM ACTION BAR (Hủy, Cất, Cất và In) */}
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
                onClick={() => {
                  setAddVoucherModalOpen(false);
                  notify(`Đã lưu chứng từ nghiệp vụ khác ${voucherNo} thành công!`);
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
              >
                Cất
              </button>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => {
                    setAddVoucherModalOpen(false);
                    notify(`Đã lưu và chuẩn bị in chứng từ ${voucherNo}!`);
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
                  Cất và In
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
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 3 }}>
                    Nhân viên
                  </label>
                  <div style={{ display: "flex", alignItems: "center", maxWidth: 260 }}>
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
                        value={advanceEmployee}
                        onChange={(e) => setAdvanceEmployee(e.target.value)}
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
                      <Plus size={14} color="#00a862" strokeWidth={2.5} style={{ cursor: "pointer", marginRight: 4 }} />
                      <ChevronDown size={14} color="#64748b" style={{ cursor: "pointer" }} />
                    </div>
                  </div>
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
                    <Sparkles
                      size={15}
                      color="#8b5cf6"
                      style={{ position: "absolute", right: 10, cursor: "pointer" }}
                      title="AVA AI gợi ý diễn giải"
                    />
                  </div>
                </div>

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

                {/* Total Display */}
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Tổng tiền</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#000000", lineHeight: 1.2 }}>
                    {advanceRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("vi-VN")}
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
                  onClick={() => notify("Trợ lý kế toán AVA đang sẵn sàng hỗ trợ quyết toán tạm ứng!")}
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
                  <span>AVA Kế toán</span>
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
                        <td style={{ padding: "4px 8px", color: "#0369a1", fontWeight: 500 }}>{tRow.debitAcc}</td>
                        <td style={{ padding: "4px 8px", color: "#b45309", fontWeight: 500 }}>{tRow.creditAcc}</td>
                        <td style={{ padding: "4px 8px", textAlign: "right" }}>
                          <input
                            type="text"
                            value={tRow.preTaxAmount}
                            onChange={(e) => {
                              const newRows = [...advanceTaxRows];
                              newRows[tIdx].preTaxAmount = Number(e.target.value.replace(/\D/g, "")) || 0;
                              newRows[tIdx].vatAmount = Math.round(newRows[tIdx].preTaxAmount * 0.1);
                              setAdvanceTaxRows(newRows);
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

            {/* 6. BOTTOM ACTION BAR (F9, Hủy, Cất, Cất và Thêm) */}
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
                  onClick={() => {
                    setAddAdvanceSettlementModalOpen(false);
                    notify(`Đã lưu chứng từ quyết toán tạm ứng ${advanceVoucherNo} thành công!`);
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
                >
                  Cất
                </button>
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAddAdvanceSettlementModalOpen(false);
                      notify(`Đã lưu và chuẩn bị thêm mới chứng từ quyết toán tạm ứng!`);
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
                    Cất và Thêm
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

            {/* 6. BOTTOM ACTION BAR (Hủy, Cất, Cất và In ˅) Matching Screenshot 1 */}
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
                  onClick={handleSaveClosingVoucher}
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
                >
                  Cất
                </button>

                {/* Split Button: Cất và In ˅ (Exact Match to Screenshot 1) */}
                <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", boxShadow: "0 1px 3px rgba(0, 168, 98, 0.25)" }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveClosingVoucher();
                      notify(`Đã chuẩn bị in chứng từ kết chuyển lãi lỗ ${closingVoucherNo}!`);
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
                    Cất và In
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
      {/* MODAL 9: ĐỀ NGHỊ QUYẾT TOÁN TẠM ỨNG (Node 1 click)                         */}
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
          onClick={() => setAddAdvanceRequestModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 580,
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
                Thêm Đề nghị quyết toán tạm ứng
              </span>
              <button
                type="button"
                onClick={() => setAddAdvanceRequestModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                  Người đề nghị:
                </label>
                <input
                  type="text"
                  defaultValue="Nguyễn Văn Hùng"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                  Số tiền đề nghị quyết toán:
                </label>
                <input
                  type="text"
                  defaultValue="15,000,000"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: "#475569", display: "block", marginBottom: 4 }}>
                  Mục đích / Diễn giải:
                </label>
                <textarea
                  rows={3}
                  defaultValue="Công tác phí và chi phí tiếp khách tại thị trường miền Trung từ ngày 15/10 đến 22/10"
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
                onClick={() => setAddAdvanceRequestModalOpen(false)}
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
                  setAddAdvanceRequestModalOpen(false);
                  notify("Đã gửi đề nghị quyết toán tạm ứng lên cấp duyệt!");
                }}
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
                Gửi phê duyệt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REPORT PREVIEW MODAL                                                      */}
      {/* ========================================================================= */}
      {previewReportName && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
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
              width: 880,
              maxHeight: "88vh",
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
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
                padding: "16px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FileSpreadsheet size={18} color="#00a862" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  {previewReportName}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => notify(`Đang in báo cáo ${previewReportName}...`)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#475569",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 13,
                  }}
                >
                  <Printer size={16} />
                  <span>In</span>
                </button>
                <button
                  type="button"
                  onClick={() => notify(`Xuất Excel báo cáo ${previewReportName}`)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#00a862",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Download size={16} />
                  <span>Xuất khẩu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewReportName(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body / Report Sheet Preview */}
            <div style={{ padding: "28px 36px", overflowY: "auto", flex: 1 }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: "#64748b" }}>{company.name}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", marginTop: 4 }}>
                  {previewReportName}
                </div>
                <div style={{ fontSize: 12.5, color: "#475569", fontStyle: "italic", marginTop: 4 }}>
                  Kỳ báo cáo: Tháng 10 năm 2026 (Từ 01/10/2026 đến 31/10/2026)
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Đơn vị tính: Việt Nam Đồng (VND)
                </div>
              </div>

              {/* Sample Report Data Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", border: "1px solid #cbd5e1" }}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>Chỉ tiêu</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", width: 70, textAlign: "center" }}>Mã số</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", width: 70, textAlign: "center" }}>Thuyết minh</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", width: 140, textAlign: "right" }}>Số cuối kỳ</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", width: 140, textAlign: "right" }}>Số đầu năm</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", fontWeight: 700 }}>A. TÀI SẢN NGẮN HẠN</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>100</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>V.01</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right", fontWeight: 700 }}>2.450.800.000</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right" }}>1.980.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", paddingLeft: 24 }}>I. Tiền và tương đương tiền</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>110</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>V.02</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right" }}>850.500.000</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right" }}>620.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", paddingLeft: 24 }}>II. Các khoản phải thu ngắn hạn</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>130</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>V.03</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right" }}>680.300.000</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right" }}>540.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", paddingLeft: 24 }}>III. Hàng tồn kho</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>140</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>V.04</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right" }}>920.000.000</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right" }}>820.000.000</td>
                  </tr>
                  <tr style={{ background: "#f8fafc" }}>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", fontWeight: 700 }}>B. TÀI SẢN DÀI HẠN</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>200</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>V.05</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right", fontWeight: 700 }}>3.120.000.000</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "right" }}>2.890.000.000</td>
                  </tr>
                  <tr style={{ background: "#f0fdf4" }}>
                    <td style={{ border: "1px solid #cbd5e1", padding: "9px 10px", fontWeight: 800, color: "#166534" }}>
                      TỔNG CỘNG TÀI SẢN (270 = 100 + 200)
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "9px 10px", textAlign: "center", fontWeight: 800 }}>270</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "9px 10px", textAlign: "center" }}>-</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "9px 10px", textAlign: "right", fontWeight: 800, color: "#166534" }}>
                      5.570.800.000
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "9px 10px", textAlign: "right", fontWeight: 800 }}>
                      4.870.000.000
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36, textAlign: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Người lập biểu</div>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>(Ký, họ tên)</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Kế toán trưởng</div>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>(Ký, họ tên)</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Giám đốc / Người đại diện</div>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>(Ký, đóng dấu)</div>
                </div>
              </div>
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
              Danh mục hệ thống tài khoản đầy đủ theo Thông tư 200/2014/TT-BTC và chuẩn mực TT 99.
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
                  Tự động đồng bộ đề nghị quyết toán đã phê duyệt từ AMIS Quy trình
                </label>
              </div>

              <div style={{ paddingLeft: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#475569" }}>
                  Tần suất đồng bộ:
                  <select defaultValue="realtime" style={{ marginLeft: 8, padding: "5px 10px", borderRadius: 4, border: "1px solid #cbd5e1" }}>
                    <option value="realtime">Tức thời (Ngay khi người có thẩm quyền phê duyệt)</option>
                    <option value="15min">Định kỳ mỗi 15 phút</option>
                    <option value="hourly">Mỗi 1 giờ</option>
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
                  Tự động đính kèm file hóa đơn điện tử / chứng từ gốc từ AMIS Quy trình
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
                    Trợ lý AI AVA - Tự động lập chứng từ
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
                  const newVoucher = {
                    id: `PKT0000${generalVouchers.length + 1}`,
                    date: "31/10/2026",
                    voucherDate: "31/10/2026",
                    desc: aiPrompt || "Hạch toán nghiệp vụ tự động bằng AI AVA",
                    debitAcc: "6422",
                    creditAcc: "242",
                    amount: 18500000,
                    posted: true,
                  };
                  setGeneralVouchers([newVoucher, ...generalVouchers]);
                  setShowVoucherTable(true);
                  notify(`AI AVA đã phân tích và sinh chứng từ ${newVoucher.id} thành công!`);
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
    </div>
  );
}
