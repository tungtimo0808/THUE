import { useState, useEffect } from "react";
import {
  Car,
  Calendar,
  Plus,
  Search,
  Download,
  HelpCircle,
  X,
  Calculator,
  RotateCw,
  ArrowRightLeft,
  MinusCircle,
  ClipboardList,
  GitBranch,
  Lightbulb,
  FileSpreadsheet,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings,
  Trash2,
  Paperclip,
  Upload,
  Pin,
  RotateCcw,
  Eye,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";

export type MisaAssetsWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

// ============================================================================
// SAMPLE DATA TÀI SẢN CỐ ĐỊNH
// ============================================================================
export const SAMPLE_ASSETS_DATA = [
  {
    code: "TSCD001",
    name: "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
    category: "Phương tiện vận tải",
    dept: "Ban Giám đốc",
    startDate: "01/01/2023",
    years: 8,
    rateYear: 12.5,
    originalCost: 1450000000,
    depreciatedAmount: 648000000,
    remainingAmount: 802000000,
    costAccount: "2113",
    deprAccount: "2141",
    expenseAccount: "6422",
  },
  {
    code: "TSCD002",
    name: "Tòa nhà văn phòng Trụ sở chính (10 tầng)",
    category: "Nhà cửa, vật kiến trúc",
    dept: "Khối Văn phòng",
    startDate: "01/06/2020",
    years: 30,
    rateYear: 3.33,
    originalCost: 18500000000,
    depreciatedAmount: 3854166667,
    remainingAmount: 14645833333,
    costAccount: "2111",
    deprAccount: "2141",
    expenseAccount: "6421",
  },
  {
    code: "TSCD003",
    name: "Hệ thống Server trung tâm dữ liệu Dell PowerEdge R750",
    category: "Máy móc, thiết bị",
    dept: "Phòng Công nghệ & IT",
    startDate: "15/03/2024",
    years: 5,
    rateYear: 20.0,
    originalCost: 480000000,
    depreciatedAmount: 240000000,
    remainingAmount: 240000000,
    costAccount: "2112",
    deprAccount: "2141",
    expenseAccount: "6422",
  },
  {
    code: "TSCD004",
    name: "Dây chuyền máy đóng gói tự động công nghiệp",
    category: "Máy móc, thiết bị",
    dept: "Phân xưởng Sản xuất 1",
    startDate: "10/08/2023",
    years: 10,
    rateYear: 10.0,
    originalCost: 2600000000,
    depreciatedAmount: 801666667,
    remainingAmount: 1798333333,
    costAccount: "2112",
    deprAccount: "2141",
    expenseAccount: "6274",
  },
  {
    code: "TSCD005",
    name: "Xe tải vận chuyển hàng hóa Hyundai HD120",
    category: "Phương tiện vận tải",
    dept: "Đội Vận tải & Kho vận",
    startDate: "20/11/2024",
    years: 6,
    rateYear: 16.67,
    originalCost: 920000000,
    depreciatedAmount: 281111111,
    remainingAmount: 638888889,
    costAccount: "2113",
    deprAccount: "2141",
    expenseAccount: "6414",
  },
];

export const SAMPLE_INCREASE_VOUCHERS = [
  {
    voucherNo: "GTTS00001",
    date: "01/01/2023",
    assetCode: "TSCD001",
    assetName: "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
    originalCost: 1450000000,
    dept: "Ban Giám đốc",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00002",
    date: "01/06/2020",
    assetCode: "TSCD002",
    assetName: "Tòa nhà văn phòng Trụ sở chính (10 tầng)",
    originalCost: 18500000000,
    dept: "Khối Văn phòng",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00003",
    date: "15/03/2024",
    assetCode: "TSCD003",
    assetName: "Hệ thống Server trung tâm dữ liệu Dell PowerEdge R750",
    originalCost: 480000000,
    dept: "Phòng Công nghệ & IT",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00004",
    date: "10/08/2023",
    assetCode: "TSCD004",
    assetName: "Dây chuyền máy đóng gói tự động công nghiệp",
    originalCost: 2600000000,
    dept: "Phân xưởng Sản xuất 1",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00005",
    date: "20/11/2024",
    assetCode: "TSCD005",
    assetName: "Xe tải vận chuyển hàng hóa Hyundai HD120",
    originalCost: 920000000,
    dept: "Đội Vận tải & Kho vận",
    status: "Đã ghi sổ",
  },
];

export default function MisaAssetsWorkspace({
  company: _company = { id: "minh-an", name: "Công ty Cổ phần Minh An" },
  period: _period = "2026-09",
  tab = "process",
  href,
  notify,
}: MisaAssetsWorkspaceProps) {
  // Navigation helper
  const navigateTo = (targetTab: string) => {
    if (href) {
      window.location.href = href(`/assets/${targetTab}`);
    }
  };

  // State data
  const [assetsList, setAssetsList] = useState(SAMPLE_ASSETS_DATA);
  const [increaseVouchers, setIncreaseVouchers] = useState(SAMPLE_INCREASE_VOUCHERS);
  const [searchRegister, setSearchRegister] = useState("");
  const [filterDept, setFilterDept] = useState("all");

  // Tab views (Intro vs Table)
  const [registerView, setRegisterView] = useState<"intro" | "table">("intro");
  const [increaseView, setIncreaseView] = useState<"intro" | "table">("intro");
  const [deprView, setDeprView] = useState<"intro" | "table">("intro");
  const [revalView, setRevalView] = useState<"intro" | "table">("intro");
  const [transferView, setTransferView] = useState<"intro" | "table">("intro");
  const [decreaseView, setDecreaseView] = useState<"intro" | "table">("intro");
  const [stocktakeView, setStocktakeView] = useState<"intro" | "table">("intro");

  // Modals state
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showDeprModal, setShowDeprModal] = useState(false);
  const [showRevalModal, setShowRevalModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDecreaseModal, setShowDecreaseModal] = useState(false);
  const [showStocktakeModal, setShowStocktakeModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [previewReportName, setPreviewReportName] = useState<string | null>(null);

  // Revaluation state (Ảnh 2 mới: ĐGL00001)
  const [revalVoucherNo, setRevalVoucherNo] = useState("ĐGL00001");
  const [revalDate, setRevalDate] = useState("30/09/2026");
  const [revalReason, setRevalReason] = useState("Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản");
  const [revalReportNo, setRevalReportNo] = useState("");
  const [revalTab, setRevalTab] = useState<"adjust" | "accounting">("adjust");
  const [revalMembersOpen, setRevalMembersOpen] = useState(false);
  const [revalConclusion, setRevalConclusion] = useState("");
  const [revalRows, setRevalRows] = useState([
    {
      id: 1,
      assetCode: "",
      assetName: "",
      dept: "",
      valBefore: 0,
      valAfter: 0,
      valDiff: 0,
      monthsBefore: 0,
      monthsAfter: 0,
      monthsDiff: 0,
    }
  ]);
  const [revalVouchers, setRevalVouchers] = useState([
    {
      voucherNo: "ĐGL00001",
      date: "30/09/2026",
      assetCode: "TSCD001",
      assetName: "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
      reason: "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản",
      diffAmount: 78000000,
      status: "Đã ghi sổ",
    }
  ]);

  // Transfer state (Ảnh 4 mới: ĐCTS00001)
  const [transferVoucherNo, setTransferVoucherNo] = useState("ĐCTS00001");
  const [transferDate, setTransferDate] = useState("30/09/2026");
  const [transferSender, setTransferSender] = useState("");
  const [transferReceiver, setTransferReceiver] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferRows, setTransferRows] = useState([
    {
      id: 1,
      assetCode: "",
      assetName: "",
      fromDept: "",
      toDept: "",
      contract: "",
      order: "",
      project: "",
      costItem: "",
      costObj: "",
    }
  ]);
  const [transferVouchers, setTransferVouchers] = useState([
    {
      voucherNo: "ĐCTS00001",
      date: "30/09/2026",
      assetCode: "TSCD001",
      assetName: "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
      fromDept: "Ban Giám đốc",
      toDept: "Khối Văn phòng",
      reason: "Điều chuyển xe phục vụ công tác văn phòng",
      status: "Đã ghi sổ",
    }
  ]);

  // Decrease state (Ảnh 1 mới: GGTS00001)
  const [decVoucherNo, setDecVoucherNo] = useState("GGTS00001");
  const [decDate, setDecDate] = useState("30/09/2026");
  const [decPostingDate, setDecPostingDate] = useState("30/09/2026");
  const [decReason, setDecReason] = useState("Nhượng bán, thanh lý");
  const [decTab, setDecTab] = useState<"asset" | "accounting">("asset");
  const [decRows, setDecRows] = useState([
    {
      id: 1,
      assetCode: "",
      assetName: "",
      dept: "",
      originalCost: 0,
      deprCost: 0,
      accumulatedDepr: 0,
      remainingValue: 0,
      costAcc: "2113",
      accumulatedAcc: "2141",
      handlingAcc: "811",
    }
  ]);
  const [decVouchers, setDecVouchers] = useState([
    {
      voucherNo: "GGTS00001",
      date: "30/09/2026",
      assetCode: "TSCD005",
      assetName: "Xe tải vận chuyển hàng hóa Hyundai HD120",
      reason: "Nhượng bán, thanh lý",
      originalCost: 920000000,
      remainingValue: 638888889,
      status: "Đã ghi sổ",
    }
  ]);

  // Stocktake state (Ảnh 3, 4 mới: BBKK-2026/09)
  const [stocktakeVouchers, setStocktakeVouchers] = useState([
    {
      voucherNo: "BBKK-2026/09",
      date: "30/09/2026",
      purpose: "Kiểm kê TSCĐ định kỳ Quý 3/2026",
      totalAssets: 5,
      matchedAssets: 5,
      diffAssets: 0,
      conclusion: "Khớp sổ sách 100%, tình trạng tài sản hoạt động tốt",
      status: "Đã ghi sổ",
    }
  ]);

  // Report state (Ảnh 5 mới)
  const [reportSearch, setReportSearch] = useState("");
  const [reportLang, setReportLang] = useState("vi");
  const [assetReportsOpen, setAssetReportsOpen] = useState(true);
  const [reconcileReportsOpen, setReconcileReportsOpen] = useState(false);

  // =========================================================================
  // FORM GHI TĂNG TÀI SẢN CỐ ĐỊNH (ẢNH MỚI 2 - GTTS00001)
  // =========================================================================
  const [incVoucherNo, setIncVoucherNo] = useState("GTTS00001");
  const [incVoucherDate, setIncVoucherDate] = useState("30/09/2026");
  const [incCategory, setIncCategory] = useState("");
  const [incCode, setIncCode] = useState("");
  const [incDept, setIncDept] = useState("");
  const [incName, setIncName] = useState("");
  const [incNoDepr, setIncNoDepr] = useState(false);
  const [incSubTab, setIncSubTab] = useState<
    "depreciation" | "allocation" | "origin" | "components" | "accessories" | "others"
  >("depreciation");

  // Sub-tab 1: Thông tin khấu hao cho Ghi tăng
  const [incCostAcc, setIncCostAcc] = useState("");
  const [incOriginalCost, setIncOriginalCost] = useState<number>(0);
  const [incDeprRateMonth, setIncDeprRateMonth] = useState<number>(0);
  const [incDeprRateYear, setIncDeprRateYear] = useState<number>(0);
  const [incDeprAcc, setIncDeprAcc] = useState("");
  const [incDeprCostValue, setIncDeprCostValue] = useState<number>(0);
  const [incDeprMonthValue, setIncDeprMonthValue] = useState<number>(0);
  const [incDeprYearValue, setIncDeprYearValue] = useState<number>(0);
  const [incStartDate, setIncStartDate] = useState("30/09/2026");
  const [incAccumulatedDepr, setIncAccumulatedDepr] = useState<number>(0);
  const [incRemainingValue, setIncRemainingValue] = useState<number>(0);
  const [incUseDuration, setIncUseDuration] = useState<number>(0);
  const [incUseDurationUnit, setIncUseDurationUnit] = useState("Năm");
  const [incLimitTaxLaw, setIncLimitTaxLaw] = useState(false);
  const [incTaxLawValue, setIncTaxLawValue] = useState<number>(0);
  const [incTaxLawMonthValue, setIncTaxLawMonthValue] = useState<number>(0);

  const handleIncOriginalCostChange = (val: number) => {
    setIncOriginalCost(val);
    setIncDeprCostValue(val);
    const remain = Math.max(0, val - incAccumulatedDepr);
    setIncRemainingValue(remain);
    if (incUseDuration > 0) {
      const yearRate = Number((100 / incUseDuration).toFixed(2));
      const monthRate = Number((100 / incUseDuration / 12).toFixed(2));
      setIncDeprRateYear(yearRate);
      setIncDeprRateMonth(monthRate);
      setIncDeprYearValue(Math.round(val / incUseDuration));
      setIncDeprMonthValue(Math.round(val / incUseDuration / 12));
    }
  };

  const handleIncUseDurationChange = (dur: number) => {
    setIncUseDuration(dur);
    if (dur > 0) {
      const yearRate = Number((100 / dur).toFixed(2));
      const monthRate = Number((100 / dur / 12).toFixed(2));
      setIncDeprRateYear(yearRate);
      setIncDeprRateMonth(monthRate);
      if (incOriginalCost > 0) {
        setIncDeprYearValue(Math.round(incOriginalCost / dur));
        setIncDeprMonthValue(Math.round(incOriginalCost / dur / 12));
      }
    }
  };

  const handleIncAccumulatedDeprChange = (acc: number) => {
    setIncAccumulatedDepr(acc);
    setIncRemainingValue(Math.max(0, incOriginalCost - acc));
  };

  // =========================================================================
  // FORM KHAI BÁO TÀI SẢN CỐ ĐỊNH ĐẦU KỲ (ẢNH TRƯỚC - OPN)
  // =========================================================================
  const [openingVoucherNo, setOpeningVoucherNo] = useState("OPN");
  const [openingVoucherDate, setOpeningVoucherDate] = useState("01/01/2026");
  const [openingCategory, setOpeningCategory] = useState("Phương tiện vận tải");
  const [openingCode, setOpeningCode] = useState("TSCD006");
  const [openingDept, setOpeningDept] = useState("Ban Giám đốc");
  const [openingName, setOpeningName] = useState("");
  const [openingNoDepr, setOpeningNoDepr] = useState(false);
  const [openingSubTab, setOpeningSubTab] = useState<
    "depreciation" | "allocation" | "components" | "accessories" | "others"
  >("depreciation");

  // Sub-tab 1: Thông tin khấu hao cho Đầu kỳ
  const [openingCostAcc, setOpeningCostAcc] = useState("2113");
  const [openingOriginalCost, setOpeningOriginalCost] = useState<number>(0);
  const [openingDeprRateMonth, setOpeningDeprRateMonth] = useState<number>(0);
  const [openingDeprRateYear, setOpeningDeprRateYear] = useState<number>(0);
  const [openingDeprAcc, setOpeningDeprAcc] = useState("2141");
  const [openingDeprCostValue, setOpeningDeprCostValue] = useState<number>(0);
  const [openingDeprMonthValue, setOpeningDeprMonthValue] = useState<number>(0);
  const [openingDeprYearValue, setOpeningDeprYearValue] = useState<number>(0);
  const [openingStartDate, setOpeningStartDate] = useState("01/01/2026");
  const [openingAccumulatedDepr, setOpeningAccumulatedDepr] = useState<number>(0);
  const [openingRemainingValue, setOpeningRemainingValue] = useState<number>(0);
  const [openingUseDuration, setOpeningUseDuration] = useState<number>(5);
  const [openingUseDurationUnit, setOpeningUseDurationUnit] = useState("Năm");
  const [openingRemainDuration, setOpeningRemainDuration] = useState<number>(5);
  const [openingRemainDurationUnit, setOpeningRemainDurationUnit] = useState("Năm");
  const [openingLimitTaxLaw, setOpeningLimitTaxLaw] = useState(false);
  const [openingTaxLawValue, setOpeningTaxLawValue] = useState<number>(0);
  const [openingTaxLawMonthValue, setOpeningTaxLawMonthValue] = useState<number>(0);

  const handleOriginalCostChange = (val: number) => {
    setOpeningOriginalCost(val);
    setOpeningDeprCostValue(val);
    const remain = Math.max(0, val - openingAccumulatedDepr);
    setOpeningRemainingValue(remain);
    if (openingUseDuration > 0) {
      const yearRate = Number((100 / openingUseDuration).toFixed(2));
      const monthRate = Number((100 / openingUseDuration / 12).toFixed(2));
      setOpeningDeprRateYear(yearRate);
      setOpeningDeprRateMonth(monthRate);
      setOpeningDeprYearValue(Math.round(val / openingUseDuration));
      setOpeningDeprMonthValue(Math.round(val / openingUseDuration / 12));
    }
  };

  const handleUseDurationChange = (dur: number) => {
    setOpeningUseDuration(dur);
    if (dur > 0) {
      const yearRate = Number((100 / dur).toFixed(2));
      const monthRate = Number((100 / dur / 12).toFixed(2));
      setOpeningDeprRateYear(yearRate);
      setOpeningDeprRateMonth(monthRate);
      if (openingOriginalCost > 0) {
        setOpeningDeprYearValue(Math.round(openingOriginalCost / dur));
        setOpeningDeprMonthValue(Math.round(openingOriginalCost / dur / 12));
      }
      if (openingRemainDuration === 0 || openingRemainDuration > dur) {
        setOpeningRemainDuration(dur);
      }
    }
  };

  const handleAccumulatedDeprChange = (acc: number) => {
    setOpeningAccumulatedDepr(acc);
    const remain = Math.max(0, openingOriginalCost - acc);
    setOpeningRemainingValue(remain);
    if (openingOriginalCost > 0 && openingUseDuration > 0) {
      const remainYears = Number(((remain / openingOriginalCost) * openingUseDuration).toFixed(1));
      setOpeningRemainDuration(remainYears);
    }
  };

  // Tính khấu hao state
  const [deprMonth, setDeprMonth] = useState(9);
  const [deprYear, setDeprYear] = useState(2026);
  const [deprVouchers, setDeprVouchers] = useState([
    {
      voucherNo: "KHTS00008",
      date: "31/08/2026",
      period: "Tháng 08/2026",
      amount: 88560000,
      reason: "Trích khấu hao tài sản cố định Tháng 08/2026",
      status: "Đã ghi sổ",
    },
    {
      voucherNo: "KHTS00007",
      date: "31/07/2026",
      period: "Tháng 07/2026",
      amount: 88560000,
      reason: "Trích khấu hao tài sản cố định Tháng 07/2026",
      status: "Đã ghi sổ",
    },
  ]);

  // Kiểm kê state
  const [stocktakeDate, setStocktakeDate] = useState("30/09/2026");

  // Check URL params for action
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    if (action === "opening") {
      setShowOpeningModal(true);
    } else if (action === "new") {
      setShowAddAssetModal(true);
    } else if (action === "depreciation") {
      setShowDeprModal(true);
    } else if (action === "reval") {
      setShowRevalModal(true);
    } else if (action === "transfer") {
      setShowTransferModal(true);
    } else if (action === "decrease") {
      setShowDecreaseModal(true);
    } else if (action === "stocktake") {
      setShowStocktakeModal(true);
    }
    const viewParam = urlParams.get("view");
    if (viewParam === "table") {
      setRegisterView("table");
      setIncreaseView("table");
      setDeprView("table");
      setRevalView("table");
      setTransferView("table");
      setDecreaseView("table");
      setStocktakeView("table");
    }
  }, [tab]);

  // Calculations for Sổ tài sản
  const filteredAssets = assetsList.filter((a) => {
    const matchSearch =
      !searchRegister ||
      a.code.toLowerCase().includes(searchRegister.toLowerCase()) ||
      a.name.toLowerCase().includes(searchRegister.toLowerCase()) ||
      a.dept.toLowerCase().includes(searchRegister.toLowerCase());
    const matchDept = filterDept === "all" || a.dept === filterDept;
    return matchSearch && matchDept;
  });

  const totalOriginalCost = filteredAssets.reduce((s, a) => s + a.originalCost, 0);
  const totalDepreciated = filteredAssets.reduce((s, a) => s + a.depreciatedAmount, 0);
  const totalRemaining = filteredAssets.reduce((s, a) => s + a.remainingAmount, 0);

  // Common Central SVG Illustration for Sổ tài sản
  const renderMisaEmptyIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="24" width="46" height="34" rx="17" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M40 44V34H56V44H40Z" fill="#00a862"/>
        <path d="M38 34L48 27L58 34" stroke="#00a862" strokeWidth="2" strokeLinecap="round"/>
        <rect x="44" y="37" width="3" height="3" fill="#ffffff"/>
        <rect x="49" y="37" width="3" height="3" fill="#ffffff"/>
        <circle cx="34" cy="30" r="5" fill="#10b981"/>
        <path d="M32 30H36M34 28V32" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round"/>
        
        <path d="M78 40H94" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M91 36L96 40L91 44" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        
        <rect x="100" y="26" width="34" height="34" rx="4" fill="#00a862"/>
        <rect x="106" y="32" width="6" height="6" rx="1" fill="#d1fae5"/>
        <rect x="122" y="32" width="6" height="6" rx="1" fill="#d1fae5"/>
        <path d="M112 60V50C112 47.79 113.79 46 116 46H118C120.21 46 122 47.79 122 50V60H112Z" fill="#ffffff"/>
        
        <circle cx="140" cy="22" r="7" fill="#34d399"/>
        <text x="140" y="25.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffffff">$</text>
        
        <circle cx="156" cy="36" r="9" fill="#10b981"/>
        <text x="156" y="39.5" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffffff">$</text>
        
        <circle cx="145" cy="46" r="6" fill="#059669"/>
        <text x="145" y="49" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#ffffff">$</text>

        <circle cx="106" cy="58" r="6" fill="#00a862"/>
        <path d="M103.5 58H108.5M106 55.5V60.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>

        <circle cx="152" cy="53" r="6.5" fill="#f87171"/>
        <circle cx="152" cy="55" r="5.5" fill="#fed7aa"/>
        <path d="M145 74C145 66 148 64 152 64C156 64 159 66 159 74H145Z" fill="#00a862"/>
        <path d="M136 74L140 65H150L154 74H136Z" fill="#cbd5e1"/>
        <rect x="134" y="73" width="22" height="2.5" rx="1" fill="#94a3b8"/>
        
        <path d="M92 20V24M90 22H94" stroke="#00a862" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="94" cy="54" r="1.5" fill="#10b981"/>
        <circle cx="168" cy="52" r="1.5" fill="#34d399"/>
        <path d="M164 16V19M162.5 17.5H165.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Ghi tăng (Ảnh 1 mới của người dùng)
  const renderIncreaseIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Factory / Building Left with chimney */}
        <path d="M46 64V40H60V64H46Z" fill="#00a862"/>
        <path d="M42 40L53 30L64 40" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round"/>
        <rect x="58" y="24" width="4" height="10" fill="#00a862"/>
        <rect x="49" y="44" width="3" height="3" fill="#ffffff"/>
        <rect x="54" y="44" width="3" height="3" fill="#ffffff"/>
        <rect x="49" y="52" width="3" height="3" fill="#ffffff"/>
        <rect x="54" y="52" width="3" height="3" fill="#ffffff"/>
        <path d="M51 64V58H55V64" fill="#ffffff"/>
        
        {/* Arrow from building to clipboard */}
        <path d="M68 48H84" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M81 44L86 48L81 52" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        
        {/* Clipboard Center */}
        <rect x="94" y="32" width="28" height="38" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5"/>
        <path d="M102 30H114V34H102V30Z" fill="#00a862"/>
        <circle cx="108" cy="48" r="8" fill="#00a862"/>
        <text x="108" y="51.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffffff">$</text>
        <path d="M100 62H116" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>

        {/* Arrow from clipboard to calendar */}
        <path d="M126 48H142" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M139 44L144 48L139 52" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Calendar Right */}
        <rect x="150" y="34" width="34" height="32" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5"/>
        <path d="M150 40H184" stroke="#00a862" strokeWidth="2.5"/>
        <rect x="156" y="30" width="2" height="4" fill="#00a862"/>
        <rect x="166" y="30" width="2" height="4" fill="#00a862"/>
        <rect x="176" y="30" width="2" height="4" fill="#00a862"/>
        <circle cx="157" cy="48" r="1.5" fill="#94a3b8"/>
        <circle cx="163" cy="48" r="1.5" fill="#94a3b8"/>
        <circle cx="169" cy="48" r="1.5" fill="#94a3b8"/>
        <circle cx="157" cy="56" r="1.5" fill="#94a3b8"/>
        <circle cx="163" cy="56" r="1.5" fill="#94a3b8"/>
        <circle cx="178" cy="58" r="5" fill="#00a862"/>
        <text x="178" y="60.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#ffffff">$</text>

        {/* Sparkles */}
        <path d="M88 28V32M86 30H90" stroke="#10b981" strokeWidth="1" strokeLinecap="round"/>
        <circle cx="92" cy="62" r="1.5" fill="#34d399"/>
        <circle cx="144" cy="28" r="1.5" fill="#10b981"/>
        <path d="M182 24V27M180.5 25.5H183.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Tính khấu hao (Ảnh 1 mới của người dùng)
  const renderDepreciationIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <path d="M72 74C88 77 122 77 142 74C136 68 84 68 72 74Z" fill="#f1f5f9" />
        <ellipse cx="112" cy="74" rx="34" ry="7" fill="#f8fafc" />

        {/* Garage Building Left */}
        <path d="M44 65V46L60 38L76 46V65H44Z" fill="#00a862" />
        
        {/* Downward Arrow on roof */}
        <path d="M60 26V34" stroke="#007a46" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M57 32L60 35L63 32" stroke="#007a46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Garage Doorway Arch */}
        <path d="M50 65V51C50 49.5 51.5 48.5 53 48.5H67C68.5 48.5 70 49.5 70 51V65H50Z" fill="#007a46" />
        
        {/* White Car Front Silhouette */}
        <path d="M53.5 64C53.5 60.5 55.5 59 60 59C64.5 59 66.5 60.5 66.5 64H53.5Z" fill="#ffffff" />
        <rect x="55.5" y="55" width="9" height="4.5" rx="1.5" fill="#ffffff" />
        <circle cx="56" cy="62" r="1.2" fill="#007a46" />
        <circle cx="64" cy="62" r="1.2" fill="#007a46" />

        {/* Dashed arrow from Garage to Voucher */}
        <path d="M84 52H120" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M117 48L122 52L117 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Depreciation Document Right */}
        <rect x="132" y="34" width="30" height="38" rx="4" fill="#ffffff" stroke="#00a862" strokeWidth="1.5" />
        {/* Folded Top-Right Corner */}
        <path d="M152 34V42H162" fill="#10b981" />
        <path d="M152 34L162 44H152V34Z" fill="#007a46" />
        
        {/* Document horizontal lines */}
        <rect x="138" y="47" width="16" height="2.5" rx="1" fill="#00a862" />
        <rect x="138" y="53" width="12" height="2" rx="1" fill="#94a3b8" />
        <rect x="138" y="58" width="14" height="2" rx="1" fill="#cbd5e1" />

        {/* Floating Green Dots and Sparkles */}
        <circle cx="128" cy="38" r="2" fill="#10b981" />
        <circle cx="138" cy="28" r="2.5" fill="#00a862" />
        <circle cx="170" cy="32" r="3" fill="#34d399" />
        <circle cx="172" cy="45" r="2" fill="#10b981" />
        <circle cx="168" cy="62" r="1.5" fill="#007a46" />
        <path d="M162 24V27M160.5 25.5H163.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Đánh giá lại (Ảnh 1 mới của người dùng)
  const renderRevalIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="240" height="110" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <ellipse cx="120" cy="74" rx="95" ry="10" fill="#f8fafc" />

        {/* Left: Garage Building with white car */}
        <path d="M26 65V46L42 38L58 46V65H26Z" fill="#00a862" />
        <path d="M32 65V51C32 49.5 33.5 48.5 35 48.5H49C50.5 48.5 52 49.5 52 51V65H32Z" fill="#007a46" />
        <path d="M35.5 64C35.5 60.5 37.5 59 42 59C46.5 59 48.5 60.5 48.5 64H35.5Z" fill="#ffffff" />
        <rect x="37.5" y="55" width="9" height="4.5" rx="1.5" fill="#ffffff" />
        <circle cx="38" cy="62" r="1.2" fill="#007a46" />
        <circle cx="46" cy="62" r="1.2" fill="#007a46" />

        {/* Arrow 1: Garage to Document */}
        <path d="M66 52H96" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M93 48L98 52L93 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Middle: Document with Clock */}
        <rect x="106" y="32" width="28" height="38" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M112 30H128V34H112V30Z" fill="#00a862" />
        <rect x="112" y="42" width="16" height="2" rx="1" fill="#00a862" />
        <rect x="112" y="47" width="12" height="2" rx="1" fill="#94a3b8" />
        <rect x="112" y="52" width="14" height="2" rx="1" fill="#cbd5e1" />
        {/* Clock badge */}
        <circle cx="128" cy="62" r="6" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
        <path d="M128 59.5V62H130.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Arrow 2: Document to Person */}
        <path d="M142 52H172" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M169 48L174 52L169 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Right: Accountant Person with Laptop */}
        <circle cx="198" cy="40" r="6" fill="#fed7aa" />
        <path d="M192 38C192 34 204 34 204 38C204 42 201 44 198 44C195 44 192 42 192 38Z" fill="#059669" />
        <path d="M190 66C190 56 193 50 198 50C203 50 206 56 206 66H190Z" fill="#00a862" />
        <rect x="180" y="62" width="18" height="3" rx="1.5" fill="#cbd5e1" />
        <path d="M184 62L190 53H194L188 62H184Z" fill="#94a3b8" />

        {/* Floating Green Dots and Sparkles */}
        <circle cx="68" cy="36" r="1.5" fill="#10b981" />
        <circle cx="102" cy="26" r="2" fill="#00a862" />
        <circle cx="140" cy="30" r="2.5" fill="#34d399" />
        <circle cx="212" cy="34" r="1.5" fill="#10b981" />
        <path d="M152 24V27M150.5 25.5H153.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Điều chuyển (Ảnh 3 mới của người dùng)
  const renderTransferIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="240" height="110" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <ellipse cx="120" cy="74" rx="95" ry="10" fill="#f8fafc" />

        {/* Left: Garage Building with white car & Person */}
        <path d="M26 65V46L42 38L58 46V65H26Z" fill="#00a862" />
        <path d="M32 65V51C32 49.5 33.5 48.5 35 48.5H49C50.5 48.5 52 49.5 52 51V65H32Z" fill="#007a46" />
        <path d="M35.5 64C35.5 60.5 37.5 59 42 59C46.5 59 48.5 60.5 48.5 64H35.5Z" fill="#ffffff" />
        <rect x="37.5" y="55" width="9" height="4.5" rx="1.5" fill="#ffffff" />
        <circle cx="38" cy="62" r="1.2" fill="#007a46" />
        <circle cx="46" cy="62" r="1.2" fill="#007a46" />
        {/* Person left */}
        <circle cx="64" cy="50" r="3" fill="#007a46" />
        <path d="M60 65C60 58 68 58 68 65H60Z" fill="#007a46" />

        {/* Bi-directional dashed line with arrows */}
        <path d="M78 52H162" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M82 48L76 52L82 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M158 48L164 52L158 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Middle Document with Plus badge */}
        <rect x="106" y="32" width="28" height="38" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M112 30H128V34H112V30Z" fill="#00a862" />
        <rect x="112" y="42" width="16" height="2" rx="1" fill="#00a862" />
        <rect x="112" y="47" width="12" height="2" rx="1" fill="#94a3b8" />
        <circle cx="120" cy="58" r="6" fill="#00a862" />
        <path d="M117.5 58H122.5M120 55.5V60.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />

        {/* Right: Garage Building with white car & Person */}
        <path d="M182 65V46L198 38L214 46V65H182Z" fill="#00a862" />
        <path d="M188 65V51C188 49.5 189.5 48.5 191 48.5H205C206.5 48.5 208 49.5 208 51V65H188Z" fill="#007a46" />
        <path d="M191.5 64C191.5 60.5 193.5 59 198 59C202.5 59 204.5 60.5 204.5 64H191.5Z" fill="#ffffff" />
        <rect x="193.5" y="55" width="9" height="4.5" rx="1.5" fill="#ffffff" />
        <circle cx="194" cy="62" r="1.2" fill="#007a46" />
        <circle cx="202" cy="62" r="1.2" fill="#007a46" />
        {/* Person right */}
        <circle cx="176" cy="50" r="3" fill="#007a46" />
        <path d="M172 65C172 58 180 58 180 65H172Z" fill="#007a46" />

        {/* Floating Green Dots and Sparkles */}
        <circle cx="94" cy="34" r="2" fill="#10b981" />
        <circle cx="146" cy="30" r="2.5" fill="#00a862" />
        <circle cx="148" cy="64" r="1.5" fill="#34d399" />
        <circle cx="70" cy="62" r="1.5" fill="#007a46" />
        <path d="M102 24V27M100.5 25.5H103.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Ghi giảm (Ảnh 2 mới của người dùng)
  const renderDecreaseIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="240" height="110" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <ellipse cx="120" cy="74" rx="95" ry="10" fill="#f8fafc" />

        {/* Left: Green Office Building with 6 windows & Entrance door */}
        <rect x="36" y="36" width="30" height="40" rx="3" fill="#00a862" />
        <rect x="42" y="42" width="6" height="5" rx="1" fill="#ffffff" />
        <rect x="52" y="42" width="6" height="5" rx="1" fill="#ffffff" />
        <rect x="42" y="51" width="6" height="5" rx="1" fill="#ffffff" />
        <rect x="52" y="51" width="6" height="5" rx="1" fill="#ffffff" />
        <path d="M46 76V65C46 63 56 63 56 65V76H46Z" fill="#ffffff" />

        {/* Arrow 1: Building to Document */}
        <path d="M74 54H98" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M95 50L100 54L95 58" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Middle: Document with Circular arrows */}
        <rect x="108" y="32" width="30" height="42" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M114 30H132V34H114V30Z" fill="#00a862" />
        <rect x="115" y="40" width="16" height="2" rx="1" fill="#00a862" />
        <circle cx="123" cy="54" r="10" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.2" strokeDasharray="3 2" />
        <path d="M123 47C126.5 47 129 49.5 129 53M123 59C119.5 59 117 56.5 117 53" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M127 50L129 53L132 51M119 56L117 53L114 55" stroke="#00a862" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="123" cy="53" r="2.5" fill="#00a862" />

        {/* Arrow 2: Document to Calendar */}
        <path d="M146 54H170" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M167 50L172 54L167 58" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Right: Calendar with top rings and Dollar Badge */}
        <rect x="178" y="36" width="32" height="34" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M178 39C178 37.3 179.3 36 181 36H207C208.7 36 210 37.3 210 39V44H178V39Z" fill="#00a862" />
        {/* Spiral rings */}
        <rect x="183" y="33" width="2" height="6" rx="1" fill="#64748b" />
        <rect x="193" y="33" width="2" height="6" rx="1" fill="#64748b" />
        <rect x="203" y="33" width="2" height="6" rx="1" fill="#64748b" />
        {/* Date dots */}
        <circle cx="184" cy="50" r="1.5" fill="#cbd5e1" />
        <circle cx="190" cy="50" r="1.5" fill="#cbd5e1" />
        <circle cx="196" cy="50" r="1.5" fill="#cbd5e1" />
        <circle cx="202" cy="50" r="1.5" fill="#cbd5e1" />
        <circle cx="184" cy="56" r="1.5" fill="#cbd5e1" />
        <circle cx="190" cy="56" r="1.5" fill="#cbd5e1" />
        {/* Dollar coin lower right */}
        <circle cx="204" cy="64" r="7" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
        <text x="204" y="67" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffffff">$</text>

        {/* Floating Green Dots and Sparkles */}
        <circle cx="70" cy="38" r="1.5" fill="#10b981" />
        <circle cx="104" cy="26" r="2" fill="#00a862" />
        <circle cx="148" cy="28" r="2" fill="#34d399" />
        <circle cx="218" cy="40" r="1.5" fill="#10b981" />
        <path d="M156 22V25M154.5 23.5H157.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Kiểm kê (Ảnh 3 mới của người dùng)
  const renderStocktakeIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="250" height="110" viewBox="0 0 250 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <ellipse cx="125" cy="74" rx="100" ry="10" fill="#f8fafc" />

        {/* Left: Building with garage and car + office building */}
        <path d="M22 66V48L36 40L50 48V66H22Z" fill="#00a862" />
        <path d="M27 66V53C27 51.5 28.5 50.5 30 50.5H42C43.5 50.5 45 51.5 45 53V66H27Z" fill="#007a46" />
        <path d="M30 65C30 62 32 61 36 61C40 61 42 62 42 65H30Z" fill="#ffffff" />
        <rect x="32" y="57" width="8" height="4" rx="1.5" fill="#ffffff" />
        <circle cx="32" cy="63" r="1" fill="#007a46" />
        <circle cx="40" cy="63" r="1" fill="#007a46" />
        {/* Small office below */}
        <rect x="32" y="70" width="20" height="24" rx="2" fill="#059669" />
        <rect x="36" y="74" width="4" height="4" rx="1" fill="#ffffff" />
        <rect x="44" y="74" width="4" height="4" rx="1" fill="#ffffff" />

        {/* Arrow Left to Center */}
        <path d="M58 54H84" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M81 50L86 54L81 58" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Middle: Clipboard Document with 2 big checkmarks */}
        <rect x="94" y="30" width="34" height="46" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M102 28H120V32H102V28Z" fill="#00a862" />
        {/* Checkmark 1 */}
        <path d="M103 44L107 48L117 38" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="120" y1="44" x2="124" y2="44" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        {/* Checkmark 2 */}
        <path d="M103 58L107 62L117 52" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="120" y1="58" x2="124" y2="58" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />

        {/* Arrow Center to Right (branching top & bottom) */}
        <path d="M136 46H162" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M159 42L164 46L159 50" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M136 62H162" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M159 58L164 62L159 66" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Right Top Building Card */}
        <rect x="174" y="24" width="28" height="32" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M180 34C180 30 196 30 196 34V46H180V34Z" fill="#00a862" />
        <path d="M184 46V40C184 38 192 38 192 40V46H184Z" fill="#ffffff" />
        <rect x="180" y="49" width="16" height="2" rx="1" fill="#94a3b8" />

        {/* Right Bottom Building Card */}
        <rect x="174" y="62" width="28" height="32" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M180 72C180 68 196 68 196 72V84H180V72Z" fill="#00a862" />
        <path d="M184 84V78C184 76 192 76 192 78V84H184Z" fill="#ffffff" />
        <rect x="180" y="87" width="16" height="2" rx="1" fill="#94a3b8" />

        {/* Floating Green Dots and Sparkles */}
        <circle cx="88" cy="26" r="1.5" fill="#10b981" />
        <circle cx="140" cy="24" r="2" fill="#00a862" />
        <circle cx="212" cy="48" r="2" fill="#34d399" />
        <circle cx="144" cy="74" r="1.5" fill="#10b981" />
        <path d="M148 18V21M146.5 19.5H149.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // =========================================================================
  // RENDER MODALS
  // =========================================================================
  const renderModals = () => (
    <>
      {/* 1. MODAL GHI TĂNG TÀI SẢN CỐ ĐỊNH GTTS00001 (ẢNH 2 MỚI CỦA NGƯỜI DÙNG) */}
      {showAddAssetModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1100,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1100,
              maxHeight: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                height: 44,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RotateCw size={17} style={{ color: "#64748b" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  Ghi tăng tài sản cố định {incVoucherNo}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn: Ghi tăng tài sản cố định mua mới về sử dụng")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Header Fields Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Row 1: Số CT ghi tăng | Ngày ghi tăng | Loại tài sản */}
                <div style={{ display: "grid", gridTemplateColumns: "130px 140px 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Số CT ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={incVoucherNo}
                      onChange={(e) => setIncVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Ngày ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={incVoucherDate}
                        onChange={(e) => setIncVoucherDate(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Loại tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={incCategory}
                        onChange={(e) => setIncCategory(e.target.value)}
                        style={{ flex: 1, height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                      >
                        <option value=""></option>
                        <option value="Phương tiện vận tải">Phương tiện vận tải</option>
                        <option value="Nhà cửa, vật kiến trúc">Nhà cửa, vật kiến trúc</option>
                        <option value="Máy móc, thiết bị">Máy móc, thiết bị</option>
                        <option value="Thiết bị, dụng cụ quản lý">Thiết bị, dụng cụ quản lý</option>
                        <option value="Tài sản cố định vô hình">Tài sản cố định vô hình</option>
                        <option value="Tài sản cố định khác">Tài sản cố định khác</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => notify("Thêm nhanh Loại tài sản cố định mới")}
                        style={{ width: 28, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", color: "#00a862", fontWeight: "bold", fontSize: 15, cursor: "pointer", display: "grid", placeItems: "center" }}
                        title="Thêm loại tài sản"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Mã tài sản | Đơn vị sử dụng */}
                <div style={{ display: "grid", gridTemplateColumns: "286px 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Mã tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={incCode}
                      onChange={(e) => setIncCode(e.target.value)}
                      placeholder=""
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Đơn vị sử dụng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={incDept}
                      onChange={(e) => setIncDept(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                    >
                      <option value=""></option>
                      <option value="Ban Giám đốc">Ban Giám đốc</option>
                      <option value="Khối Văn phòng">Khối Văn phòng</option>
                      <option value="Phòng Công nghệ & IT">Phòng Công nghệ & IT</option>
                      <option value="Phòng Kế toán">Phòng Kế toán</option>
                      <option value="Phòng Kinh doanh & Marketing">Phòng Kinh doanh & Marketing</option>
                      <option value="Phân xưởng Sản xuất 1">Phân xưởng Sản xuất 1</option>
                      <option value="Đội Vận tải & Kho vận">Đội Vận tải & Kho vận</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Tên tài sản | Checkbox Không tính khấu hao */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16, alignItems: "center" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Tên tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={incName}
                      onChange={(e) => setIncName(e.target.value)}
                      placeholder="Nhập tên chi tiết của tài sản cố định ghi tăng..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ paddingTop: 18 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#334155", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={incNoDepr}
                        onChange={(e) => setIncNoDepr(e.target.checked)}
                        style={{ width: 14, height: 14, accentColor: "#00a862" }}
                      />
                      <span>Không tính khấu hao</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sub-Tabs Navigation (6 Sub-tabs chuẩn Ảnh 2 mới) */}
              <div style={{ borderBottom: "1px solid #cbd5e1", display: "flex", gap: 20, marginTop: 4 }}>
                {[
                  { id: "depreciation", label: "Thông tin khấu hao" },
                  { id: "allocation", label: "Thiết lập phân bổ" },
                  { id: "origin", label: "Nguồn gốc hình thành" },
                  { id: "components", label: "Bộ phận cấu thành" },
                  { id: "accessories", label: "Dụng cụ, phụ tùng kèm theo" },
                  { id: "others", label: "Thông tin khác" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setIncSubTab(st.id as any)}
                    style={{
                      padding: "8px 2px",
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: incSubTab === st.id ? 700 : 500,
                      color: incSubTab === st.id ? "#00a862" : "#475569",
                      borderBottom: incSubTab === st.id ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Sub-Tab 1: Thông tin khấu hao cho Ghi tăng */}
              {incSubTab === "depreciation" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, paddingTop: 6 }}>
                  {/* Left Column: Kế toán & Khấu hao */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Row 1: TK nguyên giá | Nguyên giá | Tỷ lệ tháng | Tỷ lệ năm */}
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          TK nguyên giá <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={incCostAcc}
                          onChange={(e) => setIncCostAcc(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value=""></option>
                          <option value="2111">2111</option>
                          <option value="2112">2112</option>
                          <option value="2113">2113</option>
                          <option value="2114">2114</option>
                          <option value="2118">2118</option>
                          <option value="213">213</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Nguyên giá
                        </label>
                        <input
                          type="text"
                          value={incOriginalCost === 0 ? "0" : incOriginalCost.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            handleIncOriginalCostChange(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Tỷ lệ tính KH thg (%)
                        </label>
                        <input
                          type="text"
                          value={incDeprRateMonth === 0 ? "0,00" : incDeprRateMonth.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(",", "."));
                            setIncDeprRateMonth(isNaN(val) ? 0 : val);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Tỷ lệ tính KH năm (%)
                        </label>
                        <input
                          type="text"
                          value={incDeprRateYear === 0 ? "0,00" : incDeprRateYear.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(",", "."));
                            setIncDeprRateYear(isNaN(val) ? 0 : val);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Row 2: TK khấu hao | Giá trị tính KH | Giá trị KH tháng | Giá trị KH năm */}
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          TK khấu hao <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={incDeprAcc}
                          onChange={(e) => setIncDeprAcc(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value=""></option>
                          <option value="2141">2141</option>
                          <option value="2142">2142</option>
                          <option value="2143">2143</option>
                          <option value="2147">2147</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị tính KH
                        </label>
                        <input
                          type="text"
                          value={incDeprCostValue === 0 ? "0" : incDeprCostValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            setIncDeprCostValue(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị KH tháng
                        </label>
                        <input
                          type="text"
                          value={incDeprMonthValue === 0 ? "0" : incDeprMonthValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            setIncDeprMonthValue(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị KH năm
                        </label>
                        <input
                          type="text"
                          value={incDeprYearValue === 0 ? "0" : incDeprYearValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            setIncDeprYearValue(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Row 3: Ngày bắt đầu tính KH | Hao mòn lũy kế | Giá trị còn lại */}
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Ngày BĐ tính KH
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={incStartDate}
                            onChange={(e) => setIncStartDate(e.target.value)}
                            placeholder="DD/MM/YYYY"
                            style={{ width: "100%", height: 28, padding: "0 22px 0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11.5, outline: "none", boxSizing: "border-box" }}
                          />
                          <Calendar size={13} style={{ position: "absolute", right: 6, top: 7, color: "#64748b" }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Hao mòn lũy kế
                        </label>
                        <input
                          type="text"
                          value={incAccumulatedDepr === 0 ? "0" : incAccumulatedDepr.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            handleIncAccumulatedDeprChange(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị còn lại
                        </label>
                        <input
                          type="text"
                          value={incRemainingValue === 0 ? "0" : incRemainingValue.toLocaleString("vi-VN")}
                          readOnly
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 700, color: "#1e293b", background: "#f8fafc", outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Row 4: Thời gian sử dụng (Không có dòng 5, chuẩn Ảnh 2 mới) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140 }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Thời gian sử dụng
                        </label>
                        <input
                          type="text"
                          value={incUseDuration === 0 ? "0,00" : incUseDuration.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(",", "."));
                            handleIncUseDurationChange(isNaN(val) ? 0 : val);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ width: 90, paddingTop: 18 }}>
                        <select
                          value={incUseDurationUnit}
                          onChange={(e) => setIncUseDurationUnit(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="Năm">Năm</option>
                          <option value="Tháng">Tháng</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Giới hạn luật thuế TNDN & Lưu ý */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#1e293b", cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={incLimitTaxLaw}
                          onChange={(e) => setIncLimitTaxLaw(e.target.checked)}
                          style={{ width: 14, height: 14, accentColor: "#00a862" }}
                        />
                        <span>Giới hạn giá trị tính KH theo luật thuế TNDN</span>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                          Giá trị tính KH theo luật
                        </label>
                        <input
                          type="text"
                          disabled={!incLimitTaxLaw}
                          value={incTaxLawValue === 0 ? "0" : incTaxLawValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            setIncTaxLawValue(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incLimitTaxLaw ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                          Giá trị KH tháng theo luật
                        </label>
                        <input
                          type="text"
                          disabled={!incLimitTaxLaw}
                          value={incTaxLawMonthValue === 0 ? "0" : incTaxLawMonthValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            setIncTaxLawMonthValue(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incLimitTaxLaw ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Notice Callout Box */}
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 6,
                        padding: "10px 14px",
                        marginTop: 8,
                      }}
                    >
                      <Info size={17} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#166534" }}>
                        Nếu nhập Giá trị KH theo luật thì khi tính KH, chương trình sẽ hạch toán phần chi phí KH tương ứng với Giá trị KH theo luật vào chi phí hợp lý, phần chi phí KH vượt quá giới hạn được hạch toán vào chi phí không hợp lý.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Thiết lập phân bổ */}
              {incSubTab === "allocation" && (
                <div style={{ paddingTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Đơn vị sử dụng</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 130 }}>Tỷ lệ phân bổ (%)</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 110 }}>TK chi phí</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 180 }}>Khoản mục chi phí</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 180 }}>Đối tượng THCP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "8px" }}>{incDept}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>100,00</td>
                        <td style={{ padding: "8px", textAlign: "center", color: "#00a862", fontWeight: 600 }}>6422</td>
                        <td style={{ padding: "8px", color: "#64748b" }}>Chi phí khấu hao TSCĐ</td>
                        <td style={{ padding: "8px", color: "#94a3b8" }}>—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 3: Nguồn gốc hình thành (Mới chuẩn Ảnh 2) */}
              {incSubTab === "origin" && (
                <div style={{ paddingTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Loại nguồn gốc hình thành</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 160 }}>Số chứng từ / Hóa đơn</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 120 }}>Ngày chứng từ</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 150 }}>Số tiền (VND)</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 220 }}>Nhà cung cấp / Đối tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "8px", fontWeight: 500, color: "#1e293b" }}>Mua sắm mới trong nước</td>
                        <td style={{ padding: "8px", color: "#00a862", fontWeight: 600 }}>HD0019284</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{incVoucherDate}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{formatVND(incOriginalCost || 0)}</td>
                        <td style={{ padding: "8px", color: "#64748b" }}>Công ty Cổ phần Ô tô Trường Hải</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 4: Bộ phận cấu thành */}
              {incSubTab === "components" && (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ padding: "20px", textAlign: "center", background: "#f8fafc", borderRadius: 4, border: "1px solid #cbd5e1", color: "#64748b", fontSize: 12.5 }}>
                    Chưa có bộ phận cấu thành riêng biệt. Nhấp nút bên dưới để thêm phụ kiện hoặc chi tiết máy móc cấu thành.
                  </div>
                </div>
              )}

              {/* Sub-Tab 5: Dụng cụ, phụ tùng kèm theo */}
              {incSubTab === "accessories" && (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ padding: "20px", textAlign: "center", background: "#f8fafc", borderRadius: 4, border: "1px solid #cbd5e1", color: "#64748b", fontSize: 12.5 }}>
                    Chưa có dụng cụ, phụ tùng đi kèm.
                  </div>
                </div>
              )}

              {/* Sub-Tab 6: Thông tin khác */}
              {incSubTab === "others" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Nước sản xuất</label>
                    <input type="text" placeholder="Ví dụ: Nhật Bản, Việt Nam..." style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Năm sản xuất</label>
                    <input type="number" placeholder="2026" style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }} />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (Ảnh 2 mới: Hủy | Ghi tăng | Ghi tăng và Thêm) */}
            <div
              style={{
                height: 48,
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0 20px",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setShowAddAssetModal(false)}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!incName) {
                    notify("Vui lòng nhập Tên tài sản cố định!");
                    return;
                  }
                  const newItem = {
                    code: incCode || `TSCD00${assetsList.length + 1}`,
                    name: incName,
                    category: incCategory,
                    dept: incDept,
                    startDate: incVoucherDate,
                    years: Number(incUseDuration) || 5,
                    rateYear: Number(incDeprRateYear) || 20,
                    originalCost: Number(incOriginalCost) || 0,
                    depreciatedAmount: Number(incAccumulatedDepr) || 0,
                    remainingAmount: Math.max(0, (Number(incOriginalCost) || 0) - (Number(incAccumulatedDepr) || 0)),
                    costAccount: incCostAcc,
                    deprAccount: incDeprAcc,
                    expenseAccount: "6422",
                  };
                  const newVoucher = {
                    voucherNo: incVoucherNo,
                    date: incVoucherDate,
                    assetCode: newItem.code,
                    assetName: newItem.name,
                    originalCost: newItem.originalCost,
                    dept: newItem.dept,
                    status: "Đã ghi sổ",
                  };
                  setAssetsList([newItem, ...assetsList]);
                  setIncreaseVouchers([newVoucher, ...increaseVouchers]);
                  setShowAddAssetModal(false);
                  setIncreaseView("table");
                  notify(`Đã ghi tăng tài sản cố định ${newItem.code} - ${newItem.name} (Chứng từ ${incVoucherNo}) thành công!`);
                }}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "#1e293b",
                  cursor: "pointer",
                }}
              >
                Ghi tăng
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!incName) {
                    notify("Vui lòng nhập Tên tài sản cố định!");
                    return;
                  }
                  const newItem = {
                    code: incCode || `TSCD00${assetsList.length + 1}`,
                    name: incName,
                    category: incCategory,
                    dept: incDept,
                    startDate: incVoucherDate,
                    years: Number(incUseDuration) || 5,
                    rateYear: Number(incDeprRateYear) || 20,
                    originalCost: Number(incOriginalCost) || 0,
                    depreciatedAmount: Number(incAccumulatedDepr) || 0,
                    remainingAmount: Math.max(0, (Number(incOriginalCost) || 0) - (Number(incAccumulatedDepr) || 0)),
                    costAccount: incCostAcc,
                    deprAccount: incDeprAcc,
                    expenseAccount: "6422",
                  };
                  const newVoucher = {
                    voucherNo: incVoucherNo,
                    date: incVoucherDate,
                    assetCode: newItem.code,
                    assetName: newItem.name,
                    originalCost: newItem.originalCost,
                    dept: newItem.dept,
                    status: "Đã ghi sổ",
                  };
                  setAssetsList([newItem, ...assetsList]);
                  setIncreaseVouchers([newVoucher, ...increaseVouchers]);
                  notify(`Đã ghi tăng chứng từ ${incVoucherNo}. Mời tiếp tục ghi tăng tài sản tiếp theo!`);
                  // Reset form for next entry
                  setIncVoucherNo(`GTTS0000${increaseVouchers.length + 2}`);
                  setIncCode(`TSCD00${assetsList.length + 2}`);
                  setIncName("");
                  setIncOriginalCost(0);
                  setIncAccumulatedDepr(0);
                  setIncRemainingValue(0);
                }}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Ghi tăng và Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL KHAI BÁO TÀI SẢN CỐ ĐỊNH ĐẦU KỲ (ẢNH 2 TRƯỚC ĐÓ) */}
      {showOpeningModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1100,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1100,
              maxHeight: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 44,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RotateCw size={17} style={{ color: "#64748b" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  Khai báo tài sản cố định đầu kỳ
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn: Khai báo số dư và hồ sơ tài sản cố định đầu kỳ")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowOpeningModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "130px 140px 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Số CT ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={openingVoucherNo}
                      onChange={(e) => setOpeningVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Ngày ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={openingVoucherDate}
                        onChange={(e) => setOpeningVoucherDate(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Loại tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={openingCategory}
                        onChange={(e) => setOpeningCategory(e.target.value)}
                        style={{ flex: 1, height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                      >
                        <option value="Phương tiện vận tải">Phương tiện vận tải</option>
                        <option value="Nhà cửa, vật kiến trúc">Nhà cửa, vật kiến trúc</option>
                        <option value="Máy móc, thiết bị">Máy móc, thiết bị</option>
                        <option value="Thiết bị, dụng cụ quản lý">Thiết bị, dụng cụ quản lý</option>
                        <option value="Tài sản cố định vô hình">Tài sản cố định vô hình</option>
                        <option value="Tài sản cố định khác">Tài sản cố định khác</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => notify("Thêm nhanh Loại tài sản cố định mới")}
                        style={{ width: 28, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", color: "#00a862", fontWeight: "bold", fontSize: 15, cursor: "pointer", display: "grid", placeItems: "center" }}
                        title="Thêm loại tài sản"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "286px 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Mã tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={openingCode}
                      onChange={(e) => setOpeningCode(e.target.value)}
                      placeholder="Nhập mã TSCĐ..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Đơn vị sử dụng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={openingDept}
                      onChange={(e) => setOpeningDept(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                    >
                      <option value="Ban Giám đốc">Ban Giám đốc</option>
                      <option value="Khối Văn phòng">Khối Văn phòng</option>
                      <option value="Phòng Công nghệ & IT">Phòng Công nghệ & IT</option>
                      <option value="Phòng Kế toán">Phòng Kế toán</option>
                      <option value="Phòng Kinh doanh & Marketing">Phòng Kinh doanh & Marketing</option>
                      <option value="Phân xưởng Sản xuất 1">Phân xưởng Sản xuất 1</option>
                      <option value="Đội Vận tải & Kho vận">Đội Vận tải & Kho vận</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16, alignItems: "center" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Tên tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={openingName}
                      onChange={(e) => setOpeningName(e.target.value)}
                      placeholder="Nhập tên chi tiết của tài sản cố định..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ paddingTop: 18 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#334155", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={openingNoDepr}
                        onChange={(e) => setOpeningNoDepr(e.target.checked)}
                        style={{ width: 14, height: 14, accentColor: "#00a862" }}
                      />
                      <span>Không tính khấu hao</span>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ borderBottom: "1px solid #cbd5e1", display: "flex", gap: 24, marginTop: 4 }}>
                {[
                  { id: "depreciation", label: "Thông tin khấu hao" },
                  { id: "allocation", label: "Thiết lập phân bổ" },
                  { id: "components", label: "Bộ phận cấu thành" },
                  { id: "accessories", label: "Dụng cụ, phụ tùng kèm theo" },
                  { id: "others", label: "Thông tin khác" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setOpeningSubTab(st.id as any)}
                    style={{
                      padding: "8px 2px",
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: openingSubTab === st.id ? 700 : 500,
                      color: openingSubTab === st.id ? "#00a862" : "#475569",
                      borderBottom: openingSubTab === st.id ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {openingSubTab === "depreciation" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, paddingTop: 6 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          TK nguyên giá <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={openingCostAcc}
                          onChange={(e) => setOpeningCostAcc(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="2111">2111</option>
                          <option value="2112">2112</option>
                          <option value="2113">2113</option>
                          <option value="2114">2114</option>
                          <option value="2118">2118</option>
                          <option value="213">213</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Nguyên giá
                        </label>
                        <input
                          type="number"
                          value={openingOriginalCost || ""}
                          onChange={(e) => handleOriginalCostChange(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Tỷ lệ KH thg (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={openingDeprRateMonth || ""}
                          onChange={(e) => setOpeningDeprRateMonth(Number(e.target.value))}
                          placeholder="0,00"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Tỷ lệ KH năm (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={openingDeprRateYear || ""}
                          onChange={(e) => setOpeningDeprRateYear(Number(e.target.value))}
                          placeholder="0,00"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          TK khấu hao <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={openingDeprAcc}
                          onChange={(e) => setOpeningDeprAcc(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="2141">2141</option>
                          <option value="2142">2142</option>
                          <option value="2143">2143</option>
                          <option value="2147">2147</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị tính KH
                        </label>
                        <input
                          type="number"
                          value={openingDeprCostValue || ""}
                          onChange={(e) => setOpeningDeprCostValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị KH tháng
                        </label>
                        <input
                          type="number"
                          value={openingDeprMonthValue || ""}
                          onChange={(e) => setOpeningDeprMonthValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị KH năm
                        </label>
                        <input
                          type="number"
                          value={openingDeprYearValue || ""}
                          onChange={(e) => setOpeningDeprYearValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Ngày BĐ tính KH <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={openingStartDate}
                          onChange={(e) => setOpeningStartDate(e.target.value)}
                          placeholder="DD/MM/YYYY"
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11.5, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Hao mòn lũy kế
                        </label>
                        <input
                          type="number"
                          value={openingAccumulatedDepr || ""}
                          onChange={(e) => handleAccumulatedDeprChange(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị còn lại
                        </label>
                        <input
                          type="number"
                          value={openingRemainingValue || ""}
                          readOnly
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 700, color: "#16a34a", background: "#f8fafc", outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140 }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Thời gian sử dụng
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={openingUseDuration || ""}
                          onChange={(e) => handleUseDurationChange(Number(e.target.value))}
                          placeholder="0,00"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ width: 90, paddingTop: 18 }}>
                        <select
                          value={openingUseDurationUnit}
                          onChange={(e) => setOpeningUseDurationUnit(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="Năm">Năm</option>
                          <option value="Tháng">Tháng</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140 }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Thời gian SD còn lại
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={openingRemainDuration || ""}
                          onChange={(e) => setOpeningRemainDuration(Number(e.target.value))}
                          placeholder="0,00"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ width: 90, paddingTop: 18 }}>
                        <select
                          value={openingRemainDurationUnit}
                          onChange={(e) => setOpeningRemainDurationUnit(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="Năm">Năm</option>
                          <option value="Tháng">Tháng</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#1e293b", cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={openingLimitTaxLaw}
                          onChange={(e) => setOpeningLimitTaxLaw(e.target.checked)}
                          style={{ width: 14, height: 14, accentColor: "#00a862" }}
                        />
                        <span>Giới hạn giá trị tính KH theo luật thuế TNDN</span>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                          Giá trị tính KH theo luật
                        </label>
                        <input
                          type="number"
                          disabled={!openingLimitTaxLaw}
                          value={openingTaxLawValue || ""}
                          onChange={(e) => setOpeningTaxLawValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: openingLimitTaxLaw ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                          Giá trị KH tháng theo luật
                        </label>
                        <input
                          type="number"
                          disabled={!openingLimitTaxLaw}
                          value={openingTaxLawMonthValue || ""}
                          onChange={(e) => setOpeningTaxLawMonthValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: openingLimitTaxLaw ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 6,
                        padding: "10px 14px",
                        marginTop: 8,
                      }}
                    >
                      <Info size={17} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#166534" }}>
                        Nếu nhập Giá trị KH theo luật thì khi tính KH, chương trình sẽ hạch toán phần chi phí KH tương ứng với Giá trị KH theo luật vào chi phí hợp lý, phần chi phí KH vượt quá giới hạn được hạch toán vào chi phí không hợp lý.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {openingSubTab === "allocation" && (
                <div style={{ paddingTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Đơn vị sử dụng</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 130 }}>Tỷ lệ phân bổ (%)</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 110 }}>TK chi phí</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 180 }}>Khoản mục chi phí</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 180 }}>Đối tượng THCP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "8px" }}>{openingDept}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>100,00</td>
                        <td style={{ padding: "8px", textAlign: "center", color: "#00a862", fontWeight: 600 }}>6422</td>
                        <td style={{ padding: "8px", color: "#64748b" }}>Chi phí khấu hao TSCĐ</td>
                        <td style={{ padding: "8px", color: "#94a3b8" }}>—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {openingSubTab === "components" && (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ padding: "20px", textAlign: "center", background: "#f8fafc", borderRadius: 4, border: "1px solid #cbd5e1", color: "#64748b", fontSize: 12.5 }}>
                    Chưa có bộ phận cấu thành riêng biệt. Nhấp nút bên dưới để thêm phụ kiện hoặc chi tiết máy móc cấu thành.
                  </div>
                </div>
              )}

              {openingSubTab === "accessories" && (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ padding: "20px", textAlign: "center", background: "#f8fafc", borderRadius: 4, border: "1px solid #cbd5e1", color: "#64748b", fontSize: 12.5 }}>
                    Chưa có dụng cụ, phụ tùng đi kèm.
                  </div>
                </div>
              )}

              {openingSubTab === "others" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Nước sản xuất</label>
                    <input type="text" placeholder="Ví dụ: Nhật Bản, Việt Nam..." style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Năm sản xuất</label>
                    <input type="number" placeholder="2025" style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }} />
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                height: 48,
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0 20px",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setShowOpeningModal(false)}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!openingName) {
                    notify("Vui lòng nhập Tên tài sản cố định!");
                    return;
                  }
                  const newItem = {
                    code: openingCode || `TSCD00${assetsList.length + 1}`,
                    name: openingName,
                    category: openingCategory,
                    dept: openingDept,
                    startDate: openingStartDate,
                    years: Number(openingUseDuration) || 5,
                    rateYear: Number(openingDeprRateYear) || 20,
                    originalCost: Number(openingOriginalCost) || 0,
                    depreciatedAmount: Number(openingAccumulatedDepr) || 0,
                    remainingAmount: Math.max(0, (Number(openingOriginalCost) || 0) - (Number(openingAccumulatedDepr) || 0)),
                    costAccount: openingCostAcc,
                    deprAccount: openingDeprAcc,
                    expenseAccount: "6422",
                  };
                  setAssetsList([newItem, ...assetsList]);
                  setShowOpeningModal(false);
                  setRegisterView("table");
                  notify(`Đã khai báo TSCĐ đầu kỳ ${newItem.code} - ${newItem.name} thành công!`);
                }}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "#1e293b",
                  cursor: "pointer",
                }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!openingName) {
                    notify("Vui lòng nhập Tên tài sản cố định!");
                    return;
                  }
                  const newItem = {
                    code: openingCode || `TSCD00${assetsList.length + 1}`,
                    name: openingName,
                    category: openingCategory,
                    dept: openingDept,
                    startDate: openingStartDate,
                    years: Number(openingUseDuration) || 5,
                    rateYear: Number(openingDeprRateYear) || 20,
                    originalCost: Number(openingOriginalCost) || 0,
                    depreciatedAmount: Number(openingAccumulatedDepr) || 0,
                    remainingAmount: Math.max(0, (Number(openingOriginalCost) || 0) - (Number(openingAccumulatedDepr) || 0)),
                    costAccount: openingCostAcc,
                    deprAccount: openingDeprAcc,
                    expenseAccount: "6422",
                  };
                  setAssetsList([newItem, ...assetsList]);
                  notify(`Đã lưu ${newItem.code}. Mời tiếp tục khai báo TSCĐ đầu kỳ tiếp theo!`);
                  setOpeningCode(`TSCD00${assetsList.length + 2}`);
                  setOpeningName("");
                  setOpeningOriginalCost(0);
                  setOpeningAccumulatedDepr(0);
                  setOpeningRemainingValue(0);
                }}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Cất và Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL THÊM BẰNG AI (AVA KẾ TOÁN) */}
      {showAiModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1100,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "90vw",
              maxWidth: 560,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            <div style={{ height: 46, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #f0fdf4 0%, #ede9fe 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} style={{ color: "#7c3aed" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>AVA Kế toán: Thêm tài sản bằng AI</span>
              </div>
              <button type="button" onClick={() => setShowAiModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ border: "2px solid #cbd5e1", borderRadius: 8, padding: "24px 20px", textAlign: "center", background: "#f8fafc" }}>
                <FileText size={32} style={{ color: "#7c3aed", margin: "0 auto 8px auto" }} />
                <p style={{ margin: "0 0 6px 0", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>Kéo thả hoặc tải lên Hóa đơn / Hợp đồng mua sắm TSCĐ</p>
                <p style={{ margin: 0, fontSize: 11.5, color: "#64748b" }}>Định dạng hỗ trợ: PDF, XML, Ảnh hóa đơn (JPG, PNG). AI sẽ tự bóc tách số liệu.</p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>Hoặc nhập mô tả bằng văn bản tự nhiên:</label>
                <textarea
                  placeholder="Ví dụ: Công ty mua xe ô tô Hyundai SantaFe giá 1 tỷ 250 triệu ngày 15/09/2026 bàn giao cho Ban Giám đốc, khấu hao 8 năm..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", resize: "none" }}
                />
              </div>
            </div>
            <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button type="button" onClick={() => setShowAiModal(false)} style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAiModal(false);
                  setShowAddAssetModal(true);
                  setIncName("Xe ô tô Hyundai SantaFe 2.5 HTRAC");
                  setIncOriginalCost(1250000000);
                  setIncUseDuration(8);
                  notify("AVA Kế toán đã phân tích hóa đơn và điền sẵn thông tin vào chứng từ ghi tăng!");
                }}
                style={{ height: 32, padding: "0 20px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
              >
                AI Phân tích & Điền mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL CHỌN KỲ TÍNH KHẤU HAO (ẢNH 2 MỚI CỦA NGƯỜI DÙNG) */}
      {showDeprModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 10 }}>
          <div style={{ width: "90vw", maxWidth: 430, background: "#ffffff", borderRadius: 8, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ height: 44, padding: "0 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Chọn kỳ tính khấu hao</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn: Chọn kỳ tháng và năm cần trích khấu hao tài sản cố định")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeprModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Đóng"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 22px 24px 22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Tháng</label>
                  <select
                    value={deprMonth}
                    onChange={(e) => setDeprMonth(Number(e.target.value))}
                    style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #00a862", borderRadius: 4, fontSize: 13, outline: "none", background: "#ffffff", boxSizing: "border-box" }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Năm</label>
                  <input
                    type="number"
                    value={deprYear}
                    onChange={(e) => setDeprYear(Number(e.target.value))}
                    style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowDeprModal(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const mStr = String(deprMonth).padStart(2, "0");
                  const newVoucher = {
                    voucherNo: `KHTS000${mStr}`,
                    date: `30/${mStr}/${deprYear}`,
                    period: `Tháng ${mStr}/${deprYear}`,
                    amount: 88560000,
                    reason: `Trích khấu hao tài sản cố định Tháng ${mStr}/${deprYear}`,
                    status: "Đã ghi sổ",
                  };
                  if (!deprVouchers.some(v => v.voucherNo === newVoucher.voucherNo)) {
                    setDeprVouchers([newVoucher, ...deprVouchers]);
                  }
                  setShowDeprModal(false);
                  setDeprView("table");
                  notify(`Đã lập chứng từ trích khấu hao ${newVoucher.voucherNo} kỳ Tháng ${mStr}/${deprYear} thành công!`);
                }}
                style={{ height: 32, padding: "0 22px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL ĐÁNH GIÁ LẠI TÀI SẢN CỐ ĐỊNH (ẢNH 2 MỚI CỦA NGƯỜI DÙNG: ĐGL00001) */}
      {showRevalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 10 }}>
          <div style={{ width: "98vw", maxWidth: 1120, maxHeight: "94vh", background: "#ffffff", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ height: 44, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCw size={17} style={{ color: "#475569" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Đánh giá lại tài sản cố định {revalVoucherNo}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => notify("Tùy chọn mẫu chứng từ đánh giá lại")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Tùy chỉnh">
                  <Settings size={17} />
                </button>
                <button type="button" onClick={() => notify("Hướng dẫn: Đánh giá lại tài sản cố định")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Trợ giúp">
                  <HelpCircle size={17} />
                </button>
                <button type="button" onClick={() => setShowRevalModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Đóng">
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Form Top Section */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 140px", gap: 20 }}>
                {/* Left Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Biên bản số</label>
                      <input
                        type="text"
                        value={revalReportNo}
                        onChange={(e) => setRevalReportNo(e.target.value)}
                        placeholder=""
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Ngày</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={revalDate}
                          onChange={(e) => setRevalDate(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                        />
                        <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Lý do</label>
                    <select
                      value={revalReason}
                      onChange={(e) => setRevalReason(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                    >
                      <option value="Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản">Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản</option>
                      <option value="Đánh giá lại theo quyết định của cơ quan nhà nước">Đánh giá lại theo quyết định của cơ quan nhà nước</option>
                      <option value="Đánh giá lại khi chia tách, hợp nhất, sáp nhập doanh nghiệp">Đánh giá lại khi chia tách, hợp nhất, sáp nhập doanh nghiệp</option>
                      <option value="Đánh giá lại khi chuyển đổi loại hình doanh nghiệp">Đánh giá lại khi chuyển đổi loại hình doanh nghiệp</option>
                      <option value="Lý do khác">Lý do khác</option>
                    </select>
                  </div>

                  <div>
                    <span onClick={() => notify("Chọn chứng từ tham chiếu")} style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", textDecoration: "underline" }}>
                      Tham chiếu ...
                    </span>
                  </div>
                </div>

                {/* Right Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        defaultValue="30/09/2026"
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        defaultValue="30/09/2026"
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Số chứng từ</label>
                    <input
                      type="text"
                      value={revalVoucherNo}
                      onChange={(e) => setRevalVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Big Total Box */}
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 4 }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Tổng tiền</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5 }}>0</span>
                </div>
              </div>

              {/* Accordion: Thành viên tham gia */}
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                <div
                  onClick={() => setRevalMembersOpen(!revalMembersOpen)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#1e293b", cursor: "pointer", userSelect: "none" }}
                >
                  {revalMembersOpen ? <ChevronDown size={15} /> : <span style={{ fontSize: 14 }}>›</span>}
                  <span>Thành viên tham gia</span>
                </div>
                {revalMembersOpen && (
                  <div style={{ marginTop: 8, padding: "10px 12px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0", fontSize: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <input type="text" placeholder="Ông/Bà: Đại diện Ban Giám đốc" style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
                      <input type="text" placeholder="Chức vụ: Giám đốc kỹ thuật" style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
                      <input type="text" placeholder="Đại diện: Chủ tịch hội đồng ĐGL" style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Section: Kết quả đánh giá */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Kết quả đánh giá</span>

                {/* Sub-Tabs */}
                <div style={{ display: "flex", gap: 20, borderBottom: "1px solid #cbd5e1" }}>
                  <button
                    type="button"
                    onClick={() => setRevalTab("adjust")}
                    style={{
                      padding: "6px 2px",
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: revalTab === "adjust" ? 700 : 500,
                      color: revalTab === "adjust" ? "#00a862" : "#475569",
                      borderBottom: revalTab === "adjust" ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Chi tiết điều chỉnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevalTab("accounting")}
                    style={{
                      padding: "6px 2px",
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: revalTab === "accounting" ? 700 : 500,
                      color: revalTab === "accounting" ? "#00a862" : "#475569",
                      borderBottom: revalTab === "accounting" ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Hạch toán
                  </button>
                </div>

                {/* Table: Chi tiết điều chỉnh */}
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th rowSpan={2} style={{ width: 36, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th rowSpan={2} style={{ width: 110, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                        <th rowSpan={2} style={{ width: 220, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                        <th rowSpan={2} style={{ width: 160, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                        <th colSpan={3} style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                        <th colSpan={3} style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Thời gian sử dụng còn lại (tháng)</th>
                        <th rowSpan={2} style={{ width: 120, padding: "6px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                        <th rowSpan={2} style={{ width: 36, padding: "6px 4px", textAlign: "center" }}></th>
                      </tr>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#475569", fontSize: 11.5 }}>
                        <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                        <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Sau điều chỉnh</th>
                        <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                        <th style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                        <th style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Sau điều chỉnh</th>
                        <th style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revalRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <select
                              value={row.assetCode}
                              onChange={(e) => {
                                const selected = assetsList.find(a => a.code === e.target.value);
                                const updated = [...revalRows];
                                updated[idx].assetCode = e.target.value;
                                if (selected) {
                                  updated[idx].assetName = selected.name;
                                  updated[idx].dept = selected.dept;
                                  updated[idx].valBefore = selected.remainingAmount;
                                  updated[idx].valAfter = selected.remainingAmount;
                                  updated[idx].valDiff = 0;
                                  updated[idx].monthsBefore = selected.years * 12;
                                  updated[idx].monthsAfter = selected.years * 12;
                                  updated[idx].monthsDiff = 0;
                                }
                                setRevalRows(updated);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff" }}
                            >
                              <option value=""></option>
                              {assetsList.map(a => (
                                <option key={a.code} value={a.code}>{a.code} - {a.name.slice(0, 20)}...</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{row.assetName}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.dept}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.valBefore ? row.valBefore.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="number"
                              value={row.valAfter || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updated = [...revalRows];
                                updated[idx].valAfter = val;
                                updated[idx].valDiff = val - updated[idx].valBefore;
                                setRevalRows(updated);
                              }}
                              placeholder="0"
                              style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: row.valDiff > 0 ? "#16a34a" : row.valDiff < 0 ? "#ef4444" : "#1e293b" }}>
                            {row.valDiff ? (row.valDiff > 0 ? `+${row.valDiff.toLocaleString("vi-VN")}` : row.valDiff.toLocaleString("vi-VN")) : "0"}
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{row.monthsBefore || "0"}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="number"
                              value={row.monthsAfter || ""}
                              onChange={(e) => {
                                const m = Number(e.target.value);
                                const updated = [...revalRows];
                                updated[idx].monthsAfter = m;
                                updated[idx].monthsDiff = m - updated[idx].monthsBefore;
                                setRevalRows(updated);
                              }}
                              placeholder="0"
                              style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{row.monthsDiff || "0"}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>0</td>
                          <td style={{ textAlign: "center", padding: "4px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (revalRows.length > 1) {
                                  setRevalRows(revalRows.filter((_, i) => i !== idx));
                                } else {
                                  setRevalRows([{ id: 1, assetCode: "", assetName: "", dept: "", valBefore: 0, valAfter: 0, valDiff: 0, monthsBefore: 0, monthsAfter: 0, monthsDiff: 0 }]);
                                }
                              }}
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Summary row */}
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td colSpan={4} style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{revalRows.reduce((s, r) => s + r.valBefore, 0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{revalRows.reduce((s, r) => s + r.valAfter, 0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{revalRows.reduce((s, r) => s + r.valDiff, 0).toLocaleString("vi-VN")}</td>
                        <td colSpan={4} style={{ borderRight: "1px solid #e2e8f0" }}></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Table Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setRevalRows([...revalRows, { id: Date.now(), assetCode: "", assetName: "", dept: "", valBefore: 0, valAfter: 0, valDiff: 0, monthsBefore: 0, monthsAfter: 0, monthsDiff: 0 }]);
                    }}
                    style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <span>+ Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevalRows([{ id: Date.now(), assetCode: "", assetName: "", dept: "", valBefore: 0, valAfter: 0, valDiff: 0, monthsBefore: 0, monthsAfter: 0, monthsDiff: 0 }])}
                    style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>
              </div>

              {/* Textarea: Kết luận */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Kết luận</label>
                <textarea
                  value={revalConclusion}
                  onChange={(e) => setRevalConclusion(e.target.value)}
                  placeholder=""
                  rows={2}
                  style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", resize: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Attachment File Box */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  <Paperclip size={14} style={{ color: "#64748b" }} />
                  <span>Đính kèm</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Dung lượng tối đa 5MB</span>
                </div>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: "14px 16px", textAlign: "center", background: "#f8fafc", cursor: "pointer" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0284c7" }}>
                    <Upload size={14} />
                    <span>Chọn tệp hoặc kéo và thả tệp vào đây</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowRevalModal(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const diffTot = revalRows.reduce((s, r) => s + r.valDiff, 0);
                  const firstAsset = revalRows[0];
                  const newV = {
                    voucherNo: revalVoucherNo || "ĐGL00001",
                    date: revalDate || "30/09/2026",
                    assetCode: firstAsset?.assetCode || "TSCD001",
                    assetName: firstAsset?.assetName || "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
                    reason: revalReason,
                    diffAmount: diffTot || 78000000,
                    status: "Đã ghi sổ",
                  };
                  setRevalVouchers((prev) => {
                    const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                    if (exists) return prev.map(x => x.voucherNo === newV.voucherNo ? newV : x);
                    return [newV, ...prev];
                  });
                  setShowRevalModal(false);
                  setRevalView("table");
                  notify(`Đã cất chứng từ đánh giá lại tài sản cố định ${revalVoucherNo} thành công!`);
                }}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 500, color: "#1e293b", cursor: "pointer" }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  const diffTot = revalRows.reduce((s, r) => s + r.valDiff, 0);
                  const firstAsset = revalRows[0];
                  const newV = {
                    voucherNo: revalVoucherNo || "ĐGL00001",
                    date: revalDate || "30/09/2026",
                    assetCode: firstAsset?.assetCode || "TSCD001",
                    assetName: firstAsset?.assetName || "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
                    reason: revalReason,
                    diffAmount: diffTot || 78000000,
                    status: "Đã ghi sổ",
                  };
                  setRevalVouchers((prev) => {
                    const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                    if (exists) return prev.map(x => x.voucherNo === newV.voucherNo ? newV : x);
                    return [newV, ...prev];
                  });
                  setShowRevalModal(false);
                  setRevalView("table");
                  notify(`Đã cất và chuẩn bị in biên bản đánh giá lại ${revalVoucherNo}!`);
                }}
                style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL ĐIỀU CHUYỂN TÀI SẢN CỐ ĐỊNH (ẢNH 4 MỚI CỦA NGƯỜI DÙNG: ĐCTS00001) */}
      {showTransferModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 10 }}>
          <div style={{ width: "98vw", maxWidth: 1120, maxHeight: "94vh", background: "#ffffff", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ height: 44, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCw size={17} style={{ color: "#475569" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Điều chuyển tài sản cố định {transferVoucherNo}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => notify("Hướng dẫn: Điều chuyển tài sản cố định")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Trợ giúp">
                  <HelpCircle size={17} />
                </button>
                <button type="button" onClick={() => setShowTransferModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Đóng">
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Form Top Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Row 1: Biên bản giao nhận số | Ngày */}
                <div style={{ display: "grid", gridTemplateColumns: "260px 160px", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Biên bản giao nhận số</label>
                    <input
                      type="text"
                      value={transferVoucherNo}
                      onChange={(e) => setTransferVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Ngày</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={transferDate}
                        onChange={(e) => setTransferDate(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                </div>

                {/* Row 2: Người bàn giao | Người tiếp nhận */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Người bàn giao</label>
                    <input
                      type="text"
                      value={transferSender}
                      onChange={(e) => setTransferSender(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Người tiếp nhận</label>
                    <input
                      type="text"
                      value={transferReceiver}
                      onChange={(e) => setTransferReceiver(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Row 3: Lý do điều chuyển */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Lý do điều chuyển</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      placeholder=""
                      style={{ width: "100%", height: 30, padding: "0 30px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                    <Sparkles size={15} style={{ position: "absolute", right: 8, top: 8, color: "#7c3aed" }} />
                  </div>
                </div>

                {/* Row 4: Tham chiếu */}
                <div>
                  <span onClick={() => notify("Chọn chứng từ tham chiếu")} style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", textDecoration: "underline" }}>
                    Tham chiếu ...
                  </span>
                </div>
              </div>

              {/* Sub-tab: Chi tiết */}
              <div style={{ borderBottom: "1px solid #cbd5e1", marginTop: 4 }}>
                <button
                  type="button"
                  style={{
                    padding: "6px 2px",
                    border: "none",
                    background: "transparent",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#00a862",
                    borderBottom: "2px solid #00a862",
                    cursor: "pointer",
                  }}
                >
                  Chi tiết
                </button>
              </div>

              {/* Table */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                      <th style={{ minWidth: 200, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                      <th style={{ width: 150, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Từ đơn vị</th>
                      <th style={{ width: 160, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đến đơn vị</th>
                      <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Hợp đồng bán</th>
                      <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn đặt hàng</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Công trình</th>
                      <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Khoản mục CP</th>
                      <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đối tượng THCP</th>
                      <th style={{ width: 36, padding: "8px 4px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.assetCode}
                            onChange={(e) => {
                              const sel = assetsList.find(a => a.code === e.target.value);
                              const updated = [...transferRows];
                              updated[idx].assetCode = e.target.value;
                              if (sel) {
                                updated[idx].assetName = sel.name;
                                updated[idx].fromDept = sel.dept;
                              }
                              setTransferRows(updated);
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff" }}
                          >
                            <option value=""></option>
                            {assetsList.map(a => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name.slice(0, 20)}...</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{row.assetName}</td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.fromDept}</td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.toDept}
                            onChange={(e) => {
                              const updated = [...transferRows];
                              updated[idx].toDept = e.target.value;
                              setTransferRows(updated);
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff" }}
                          >
                            <option value=""></option>
                            <option value="Ban Giám đốc">Ban Giám đốc</option>
                            <option value="Khối Văn phòng">Khối Văn phòng</option>
                            <option value="Phòng Công nghệ & IT">Phòng Công nghệ & IT</option>
                            <option value="Phòng Kế toán">Phòng Kế toán</option>
                            <option value="Phòng Kinh doanh & Marketing">Phòng Kinh doanh & Marketing</option>
                            <option value="Phân xưởng Sản xuất 1">Phân xưởng Sản xuất 1</option>
                            <option value="Đội Vận tải & Kho vận">Đội Vận tải & Kho vận</option>
                          </select>
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#94a3b8" }}>—</td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#94a3b8" }}>—</td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#94a3b8" }}>—</td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#94a3b8" }}>—</td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#94a3b8" }}>—</td>
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (transferRows.length > 1) {
                                setTransferRows(transferRows.filter((_, i) => i !== idx));
                              } else {
                                setTransferRows([{ id: 1, assetCode: "", assetName: "", fromDept: "", toDept: "", contract: "", order: "", project: "", costItem: "", costObj: "" }]);
                              }
                            }}
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setTransferRows([...transferRows, { id: Date.now(), assetCode: "", assetName: "", fromDept: "", toDept: "", contract: "", order: "", project: "", costItem: "", costObj: "" }]);
                  }}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <span>+ Thêm dòng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferRows([{ id: Date.now(), assetCode: "", assetName: "", fromDept: "", toDept: "", contract: "", order: "", project: "", costItem: "", costObj: "" }])}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Attachment File Box */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  <Paperclip size={14} style={{ color: "#64748b" }} />
                  <span>Đính kèm</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Dung lượng tối đa 5MB</span>
                </div>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: "14px 16px", textAlign: "center", background: "#f8fafc", cursor: "pointer" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0284c7" }}>
                    <Upload size={14} />
                    <span>Chọn tệp hoặc kéo và thả tệp vào đây</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstAsset = transferRows[0];
                  const newV = {
                    voucherNo: transferVoucherNo || "ĐCTS00001",
                    date: transferDate || "30/09/2026",
                    assetCode: firstAsset?.assetCode || "TSCD001",
                    assetName: firstAsset?.assetName || "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
                    fromDept: firstAsset?.fromDept || "Ban Giám đốc",
                    toDept: firstAsset?.toDept || "Khối Văn phòng",
                    reason: transferReason || "Điều chuyển tài sản cố định sang bộ phận mới",
                    status: "Đã ghi sổ",
                  };
                  setTransferVouchers((prev) => {
                    const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                    if (exists) return prev.map(x => x.voucherNo === newV.voucherNo ? newV : x);
                    return [newV, ...prev];
                  });
                  setShowTransferModal(false);
                  setTransferView("table");
                  notify(`Đã cất chứng từ điều chuyển tài sản cố định ${transferVoucherNo} thành công!`);
                }}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 500, color: "#1e293b", cursor: "pointer" }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstAsset = transferRows[0];
                  const newV = {
                    voucherNo: transferVoucherNo || "ĐCTS00001",
                    date: transferDate || "30/09/2026",
                    assetCode: firstAsset?.assetCode || "TSCD001",
                    assetName: firstAsset?.assetName || "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
                    fromDept: firstAsset?.fromDept || "Ban Giám đốc",
                    toDept: firstAsset?.toDept || "Khối Văn phòng",
                    reason: transferReason || "Điều chuyển tài sản cố định sang bộ phận mới",
                    status: "Đã ghi sổ",
                  };
                  setTransferVouchers((prev) => {
                    const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                    if (exists) return prev.map(x => x.voucherNo === newV.voucherNo ? newV : x);
                    return [newV, ...prev];
                  });
                  setShowTransferModal(false);
                  setTransferView("table");
                  notify(`Đã cất và chuẩn bị in biên bản điều chuyển ${transferVoucherNo}!`);
                }}
                style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL GHI GIẢM TÀI SẢN CỐ ĐỊNH (ẢNH 1 MỚI CỦA NGƯỜI DÙNG: GGTS00001) */}
      {showDecreaseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 10 }}>
          <div style={{ width: "98vw", maxWidth: 1120, maxHeight: "94vh", background: "#ffffff", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ height: 44, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCcw size={17} style={{ color: "#475569" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Ghi giảm tài sản cố định {decVoucherNo}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => notify("Tùy chọn mẫu chứng từ ghi giảm")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Tùy chỉnh">
                  <Settings size={17} />
                </button>
                <button type="button" onClick={() => notify("Hướng dẫn: Ghi giảm tài sản cố định")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Trợ giúp">
                  <HelpCircle size={17} />
                </button>
                <button type="button" onClick={() => setShowDecreaseModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Đóng">
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Form Top Section */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 140px", gap: 20 }}>
                {/* Left Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Lý do ghi giảm</label>
                    <select
                      value={decReason}
                      onChange={(e) => setDecReason(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                    >
                      <option value="Nhượng bán, thanh lý">Nhượng bán, thanh lý</option>
                      <option value="Chuyển thành CCDC">Chuyển thành CCDC</option>
                      <option value="Báo mất, hư hỏng không thể phục hồi">Báo mất, hư hỏng không thể phục hồi</option>
                      <option value="Lý do khác">Lý do khác</option>
                    </select>
                  </div>
                  <div>
                    <span onClick={() => notify("Chọn chứng từ tham chiếu")} style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", textDecoration: "underline" }}>
                      Tham chiếu ...
                    </span>
                  </div>
                </div>

                {/* Right Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={decPostingDate}
                        onChange={(e) => setDecPostingDate(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={decDate}
                        onChange={(e) => setDecDate(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Số chứng từ</label>
                    <input
                      type="text"
                      value={decVoucherNo}
                      onChange={(e) => setDecVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Big Total Box */}
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 4 }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Tổng tiền</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5 }}>
                    {decRows.reduce((s, r) => s + r.originalCost, 0).toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>

              {/* Sub-Tabs: Tài sản | Hạch toán */}
              <div style={{ display: "flex", gap: 20, borderBottom: "1px solid #cbd5e1", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setDecTab("asset")}
                  style={{
                    padding: "6px 2px",
                    border: "none",
                    background: "transparent",
                    fontSize: 12.5,
                    fontWeight: decTab === "asset" ? 700 : 500,
                    color: decTab === "asset" ? "#00a862" : "#475569",
                    borderBottom: decTab === "asset" ? "2px solid #00a862" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Tài sản
                </button>
                <button
                  type="button"
                  onClick={() => setDecTab("accounting")}
                  style={{
                    padding: "6px 2px",
                    border: "none",
                    background: "transparent",
                    fontSize: 12.5,
                    fontWeight: decTab === "accounting" ? 700 : 500,
                    color: decTab === "accounting" ? "#00a862" : "#475569",
                    borderBottom: decTab === "accounting" ? "2px solid #00a862" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Hạch toán
                </button>
              </div>

              {/* Table under Tab Tài sản */}
              {decTab === "asset" ? (
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Pin size={12} style={{ color: "#64748b" }} />
                            <span>Mã tài sản</span>
                          </div>
                        </th>
                        <th style={{ minWidth: 180, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                        <th style={{ width: 140, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                        <th style={{ width: 110, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                        <th style={{ width: 130, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị tính khấu hao</th>
                        <th style={{ width: 110, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Hao mòn lũy kế</th>
                        <th style={{ width: 110, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                        <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nguyên giá</th>
                        <th style={{ width: 80, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Hao mòn</th>
                        <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Xử lý giá trị</th>
                        <th style={{ width: 36, padding: "8px 4px", textAlign: "center" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {decRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <select
                              value={row.assetCode}
                              onChange={(e) => {
                                const selected = assetsList.find(a => a.code === e.target.value);
                                const updated = [...decRows];
                                updated[idx].assetCode = e.target.value;
                                if (selected) {
                                  updated[idx].assetName = selected.name;
                                  updated[idx].dept = selected.dept;
                                  updated[idx].originalCost = selected.originalCost;
                                  updated[idx].deprCost = selected.originalCost;
                                  updated[idx].accumulatedDepr = selected.depreciatedAmount;
                                  updated[idx].remainingValue = selected.remainingAmount;
                                  updated[idx].costAcc = selected.costAccount || "2113";
                                  updated[idx].accumulatedAcc = selected.deprAccount || "2141";
                                  updated[idx].handlingAcc = "811";
                                }
                                setDecRows(updated);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff" }}
                            >
                              <option value=""></option>
                              {assetsList.map(a => (
                                <option key={a.code} value={a.code}>{a.code} - {a.name.slice(0, 20)}...</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{row.assetName}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.dept}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.originalCost ? row.originalCost.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.deprCost ? row.deprCost.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.accumulatedDepr ? row.accumulatedDepr.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#ef4444" }}>{row.remainingValue ? row.remainingValue.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{row.costAcc}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{row.accumulatedAcc}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#00a862", fontWeight: 600 }}>{row.handlingAcc}</td>
                          <td style={{ textAlign: "center", padding: "4px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (decRows.length > 1) {
                                  setDecRows(decRows.filter((_, i) => i !== idx));
                                } else {
                                  setDecRows([{ id: 1, assetCode: "", assetName: "", dept: "", originalCost: 0, deprCost: 0, accumulatedDepr: 0, remainingValue: 0, costAcc: "2113", accumulatedAcc: "2141", handlingAcc: "811" }]);
                                }
                              }}
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Summary row */}
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td colSpan={3} style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{decRows.reduce((s, r) => s + r.originalCost, 0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{decRows.reduce((s, r) => s + r.deprCost, 0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{decRows.reduce((s, r) => s + r.accumulatedDepr, 0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#ef4444" }}>{decRows.reduce((s, r) => s + r.remainingValue, 0).toLocaleString("vi-VN")}</td>
                        <td colSpan={3} style={{ borderRight: "1px solid #e2e8f0" }}></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Hạch toán sub-tab */
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                        <th style={{ width: 100, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                        <th style={{ width: 100, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                        <th style={{ width: 160, padding: "8px", textAlign: "right" }}>Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "8px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>1</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0" }}>Ghi giảm hao mòn lũy kế TSCĐ do nhượng bán, thanh lý</td>
                        <td style={{ padding: "8px", textAlign: "center", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>2141</td>
                        <td style={{ padding: "8px", textAlign: "center", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>2113</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{formatVND(decRows.reduce((s, r) => s + r.accumulatedDepr, 0))}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "8px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>2</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0" }}>Ghi nhận giá trị còn lại của TSCĐ vào chi phí khác</td>
                        <td style={{ padding: "8px", textAlign: "center", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>811</td>
                        <td style={{ padding: "8px", textAlign: "center", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>2113</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, color: "#ef4444" }}>{formatVND(decRows.reduce((s, r) => s + r.remainingValue, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setDecRows([...decRows, { id: Date.now(), assetCode: "", assetName: "", dept: "", originalCost: 0, deprCost: 0, accumulatedDepr: 0, remainingValue: 0, costAcc: "2113", accumulatedAcc: "2141", handlingAcc: "811" }]);
                  }}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <span>+ Thêm dòng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDecRows([{ id: Date.now(), assetCode: "", assetName: "", dept: "", originalCost: 0, deprCost: 0, accumulatedDepr: 0, remainingValue: 0, costAcc: "2113", accumulatedAcc: "2141", handlingAcc: "811" }])}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Attachment File Box */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  <Paperclip size={14} style={{ color: "#64748b" }} />
                  <span>Đính kèm</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Dung lượng tối đa 5MB</span>
                </div>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: "14px 16px", textAlign: "center", background: "#f8fafc", cursor: "pointer" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0284c7" }}>
                    <Upload size={14} />
                    <span>Chọn tệp hoặc kéo và thả tệp vào đây</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowDecreaseModal(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstAsset = decRows[0];
                  const newV = {
                    voucherNo: decVoucherNo || "GGTS00001",
                    date: decDate || "30/09/2026",
                    assetCode: firstAsset?.assetCode || "TSCD005",
                    assetName: firstAsset?.assetName || "Xe tải vận chuyển hàng hóa Hyundai HD120",
                    reason: decReason,
                    originalCost: decRows.reduce((s, r) => s + r.originalCost, 0) || 920000000,
                    remainingValue: decRows.reduce((s, r) => s + r.remainingValue, 0) || 638888889,
                    status: "Đã ghi sổ",
                  };
                  setDecVouchers((prev) => {
                    const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                    if (exists) return prev.map(x => x.voucherNo === newV.voucherNo ? newV : x);
                    return [newV, ...prev];
                  });
                  setShowDecreaseModal(false);
                  setDecreaseView("table");
                  notify(`Đã cất chứng từ ghi giảm tài sản cố định ${decVoucherNo} thành công!`);
                }}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 500, color: "#1e293b", cursor: "pointer" }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstAsset = decRows[0];
                  const newV = {
                    voucherNo: decVoucherNo || "GGTS00001",
                    date: decDate || "30/09/2026",
                    assetCode: firstAsset?.assetCode || "TSCD005",
                    assetName: firstAsset?.assetName || "Xe tải vận chuyển hàng hóa Hyundai HD120",
                    reason: decReason,
                    originalCost: decRows.reduce((s, r) => s + r.originalCost, 0) || 920000000,
                    remainingValue: decRows.reduce((s, r) => s + r.remainingValue, 0) || 638888889,
                    status: "Đã ghi sổ",
                  };
                  setDecVouchers((prev) => {
                    const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                    if (exists) return prev.map(x => x.voucherNo === newV.voucherNo ? newV : x);
                    return [newV, ...prev];
                  });
                  setShowDecreaseModal(false);
                  setDecreaseView("table");
                  notify(`Đã cất và chuẩn bị in biên bản ghi giảm ${decVoucherNo}!`);
                }}
                style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL KIỂM KÊ TÀI SẢN CỐ ĐỊNH (ẢNH 4 MỚI CỦA NGƯỜI DÙNG) */}
      {showStocktakeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 10 }}>
          <div style={{ width: "90vw", maxWidth: 440, background: "#ffffff", borderRadius: 8, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden" }}>
            <div style={{ height: 44, padding: "0 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b" }}>Kiểm kê tài sản cố định</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={() => notify("Hướng dẫn: Kiểm kê tài sản cố định")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <HelpCircle size={16} />
                </button>
                <button type="button" onClick={() => setShowStocktakeModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <X size={17} />
                </button>
              </div>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Kiểm kê đến ngày</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={stocktakeDate}
                  onChange={(e) => setStocktakeDate(e.target.value)}
                  style={{ width: "100%", height: 32, padding: "0 30px 0 10px", border: "1px solid #00a862", borderRadius: 4, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
                <Calendar size={15} style={{ position: "absolute", right: 9, top: 8, color: "#64748b" }} />
              </div>
            </div>
            <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 18px", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowStocktakeModal(false)}
                style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const newV = {
                    voucherNo: `BBKK-${stocktakeDate.slice(3).replace("/", "")}`,
                    date: stocktakeDate,
                    purpose: "Kiểm kê TSCĐ định kỳ Quý 3/2026",
                    totalAssets: assetsList.length,
                    matchedAssets: assetsList.length,
                    diffAssets: 0,
                    conclusion: "Khớp sổ sách 100%, tình trạng tài sản hoạt động tốt",
                    status: "Đã ghi sổ",
                  };
                  setStocktakeVouchers((prev) => {
                    const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                    if (exists) return prev;
                    return [newV, ...prev];
                  });
                  setShowStocktakeModal(false);
                  setStocktakeView("table");
                  notify(`Đã lập biên bản kiểm kê tài sản cố định đến ngày ${stocktakeDate} thành công!`);
                }}
                style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL PREVIEW BÁO CÁO */}
      {previewReportName && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1050, padding: 10 }}>
          <div style={{ width: "94vw", maxWidth: 980, maxHeight: "90vh", background: "#ffffff", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ height: 46, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{previewReportName}</span>
              <button type="button" onClick={() => setPreviewReportName(null)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>{previewReportName.toUpperCase()}</h3>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: "4px 0 0 0" }}>Năm tài chính 2026 - Đơn vị tiền tệ: Việt Nam Đồng (VND)</p>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                    <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã TSCĐ</th>
                    <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản cố định</th>
                    <th style={{ padding: 8, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                    <th style={{ padding: 8, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Hao mòn lũy kế</th>
                    <th style={{ padding: 8, textAlign: "right" }}>Giá trị còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsList.map((a, i) => (
                    <tr key={a.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{i + 1}</td>
                      <td style={{ padding: 8, fontWeight: 600, color: "#00a862", borderRight: "1px solid #e2e8f0" }}>{a.code}</td>
                      <td style={{ padding: 8, borderRight: "1px solid #e2e8f0" }}>{a.name}</td>
                      <td style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.originalCost)}</td>
                      <td style={{ padding: 8, textAlign: "right", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.depreciatedAmount)}</td>
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{formatVND(a.remainingAmount)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                    <td colSpan={3} style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>Tổng cộng:</td>
                    <td style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>{formatVND(totalOriginalCost)}</td>
                    <td style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(totalDepreciated)}</td>
                    <td style={{ padding: 8, textAlign: "right", color: "#16a34a" }}>{formatVND(totalRemaining)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button
                type="button"
                onClick={() => notify(`Đang xuất file Excel: ${previewReportName}.xlsx`)}
                style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <FileSpreadsheet size={14} style={{ color: "#16a34a" }} />
                <span>Xuất Excel</span>
              </button>
              <button type="button" onClick={() => setPreviewReportName(null)} style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // =========================================================================
  // 1. TAB: QUY TRÌNH (ẢNH BAN ĐẦU CỦA NGƯỜI DÙNG)
  // =========================================================================
  if (tab === "process") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        <div style={{ flex: 1, padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, overflowY: "auto" }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "24px 28px",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b", letterSpacing: 0.3 }}>
                NGHIỆP VỤ TÀI SẢN CỐ ĐỊNH
              </h2>
            </div>

            <div style={{ position: "relative", width: "100%", minHeight: 330, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  position: "absolute",
                  left: 100,
                  right: 30,
                  top: "50%",
                  height: 2,
                  background: "#cbd5e1",
                  transform: "translateY(-50%)",
                  zIndex: 1,
                }}
              >
                <div style={{ position: "absolute", right: -4, top: -5, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "8px solid #94a3b8" }} />
              </div>

              {/* NODE 1: GHI TĂNG */}
              <div
                onClick={() => setShowAddAssetModal(true)}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 10,
                    background: "#00a862",
                    boxShadow: "0 4px 10px rgba(0, 168, 98, 0.3)",
                    display: "grid",
                    placeItems: "center",
                    position: "relative",
                    transition: "transform 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <Car size={26} style={{ color: "#ffffff" }} />
                  <div style={{ position: "absolute", right: 6, bottom: 6, width: 14, height: 14, borderRadius: "50%", background: "#ffffff", display: "grid", placeItems: "center" }}>
                    <Plus size={10} style={{ color: "#00a862", strokeWidth: 3 }} />
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginTop: 8 }}>Ghi tăng</span>
              </div>

              {/* HÀNG TRÊN: Điều chuyển | Tính khấu hao | Chuyển TS thuê TC */}
              <div
                onClick={() => navigateTo("transfer")}
                style={{ position: "absolute", left: "28%", top: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 10, background: "#00a862", boxShadow: "0 4px 10px rgba(0, 168, 98, 0.25)", display: "grid", placeItems: "center", position: "relative" }}>
                  <ArrowRightLeft size={24} style={{ color: "#ffffff" }} />
                  <Car size={13} style={{ position: "absolute", bottom: 5, right: 6, color: "#ffffff" }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", marginTop: 6 }}>Điều chuyển</span>
                <div style={{ position: "absolute", top: 52, bottom: -70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
              </div>

              <div
                onClick={() => setShowDeprModal(true)}
                style={{ position: "absolute", left: "52%", top: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 10, background: "#00a862", boxShadow: "0 4px 10px rgba(0, 168, 98, 0.25)", display: "grid", placeItems: "center", position: "relative" }}>
                  <Calculator size={24} style={{ color: "#ffffff" }} />
                  <Car size={13} style={{ position: "absolute", bottom: 5, right: 6, color: "#ffffff" }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", marginTop: 6 }}>Tính khấu hao</span>
                <div style={{ position: "absolute", top: 52, bottom: -70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
              </div>

              <div
                onClick={() => notify("Nghiệp vụ: Chuyển tài sản thuê tài chính thành tài sản sở hữu")}
                style={{ position: "absolute", left: "76%", top: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", maxWidth: 140, textAlign: "center" }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 10, background: "#00a862", boxShadow: "0 4px 10px rgba(0, 168, 98, 0.25)", display: "grid", placeItems: "center", position: "relative" }}>
                  <Car size={24} style={{ color: "#ffffff" }} />
                  <RotateCw size={13} style={{ position: "absolute", bottom: 5, right: 6, color: "#ffffff" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginTop: 6, lineHeight: 1.3 }}>Chuyển TS thuê tài chính thành TS sở hữu</span>
                <div style={{ position: "absolute", top: 52, bottom: -70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
              </div>

              {/* HÀNG DƯỚI: Đánh giá lại | Ghi giảm | Kiểm kê tài sản */}
              <div
                onClick={() => navigateTo("revaluation")}
                style={{ position: "absolute", left: "40%", bottom: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", textAlign: "center" }}
              >
                <div style={{ position: "absolute", top: -70, height: 70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
                <div style={{ width: 52, height: 52, borderRadius: 10, background: "#00a862", boxShadow: "0 4px 10px rgba(0, 168, 98, 0.25)", display: "grid", placeItems: "center", position: "relative" }}>
                  <Car size={24} style={{ color: "#ffffff" }} />
                  <div style={{ position: "absolute", bottom: 5, right: 6, width: 13, height: 13, borderRadius: "50%", background: "#ffffff", display: "grid", placeItems: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: "bold", color: "#00a862" }}>★</span>
                  </div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", marginTop: 6 }}>Đánh giá<br />lại tài sản</span>
              </div>

              <div
                onClick={() => navigateTo("decrease")}
                style={{ position: "absolute", left: "58%", bottom: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ position: "absolute", top: -70, height: 70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
                <div style={{ width: 52, height: 52, borderRadius: 10, background: "#00a862", boxShadow: "0 4px 10px rgba(0, 168, 98, 0.25)", display: "grid", placeItems: "center", position: "relative" }}>
                  <Car size={24} style={{ color: "#ffffff" }} />
                  <MinusCircle size={13} style={{ position: "absolute", bottom: 5, right: 6, color: "#ffffff" }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", marginTop: 6 }}>Ghi giảm</span>
              </div>

              <div
                onClick={() => navigateTo("stocktake")}
                style={{ position: "absolute", left: "82%", bottom: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ position: "absolute", top: -70, height: 70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
                <div style={{ width: 52, height: 52, borderRadius: 10, background: "#00a862", boxShadow: "0 4px 10px rgba(0, 168, 98, 0.25)", display: "grid", placeItems: "center", position: "relative" }}>
                  <ClipboardList size={24} style={{ color: "#ffffff" }} />
                  <Car size={13} style={{ position: "absolute", bottom: 5, right: 6, color: "#ffffff" }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", marginTop: 6 }}>Kiểm kê tài sản</span>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center" }}>
              <div onClick={() => notify("Danh mục: Cơ cấu tổ chức và phòng ban quản lý tài sản")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", padding: "6px 0", borderRight: "1px solid #e2e8f0" }}>
                <GitBranch size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Cơ cấu tổ chức</span>
              </div>
              <div onClick={() => notify("Danh mục: Loại tài sản cố định chuẩn quy định kế toán")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", padding: "6px 0", borderRight: "1px solid #e2e8f0" }}>
                <Car size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Loại tài sản</span>
              </div>
              <div onClick={() => setShowOpeningModal(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", padding: "6px 0" }}>
                <Lightbulb size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Tiện ích</span>
              </div>
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "24px 20px" }}>
            <div>
              <div style={{ textAlign: "center", paddingBottom: 14, borderBottom: "1px solid #f1f5f9", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#1e293b", letterSpacing: 0.3 }}>BÁO CÁO</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  "S21 - DN: Sổ tài sản cố định",
                  "Bảng tính khấu hao tài sản cố định theo năm",
                  "Báo cáo đối chiếu sổ tài sản và sổ cái",
                  "Sổ tài sản cố định",
                  "Thẻ tài sản cố định",
                ].map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setPreviewReportName(item)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer", lineHeight: 1.45, transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                  >
                    <span style={{ color: "#94a3b8", fontSize: 14, lineHeight: "16px" }}>•</span>
                    <span style={{ fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right", marginTop: 24, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
              <span onClick={() => navigateTo("reports")} style={{ fontSize: 13, color: "#0284c7", fontWeight: 600, cursor: "pointer" }}>
                Tất cả báo cáo
              </span>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 2. TAB: SỔ TÀI SẢN (register)
  // =========================================================================
  if (tab === "register") {
    if (registerView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderMisaEmptyIllustration()}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 660, lineHeight: 1.45 }}>
              Quản lý tất cả các tài sản cố định đang sử dụng và tình hình khấu hao của từng tài sản
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{
                  height: 34,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOpeningModal(true)}
                style={{
                  height: 34,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "#94a3b8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
              >
                Khai báo TSCĐ đầu kỳ
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setRegisterView("table")}
              style={{
                height: 32,
                padding: "0 22px",
                borderRadius: 4,
                background: "#ffffff",
                color: "#00a862",
                border: "1px solid #00a862",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowOpeningModal(true)}
              style={{ height: 30, padding: "0 14px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <RotateCw size={13} />
              <span>Khai báo TSCĐ đầu kỳ</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddAssetModal(true)}
              style={{ height: 30, padding: "0 14px", background: "#ffffff", color: "#00a862", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <Plus size={14} />
              <span>Ghi tăng TSCĐ</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
            <div style={{ position: "relative", width: 220 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 8, color: "#64748b" }} />
              <input
                type="text"
                value={searchRegister}
                onChange={(e) => setSearchRegister(e.target.value)}
                placeholder="Tìm mã, tên tài sản..."
                style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff" }}
            >
              <option value="all">Tất cả đơn vị sử dụng</option>
              <option value="Ban Giám đốc">Ban Giám đốc</option>
              <option value="Khối Văn phòng">Khối Văn phòng</option>
              <option value="Phòng Công nghệ & IT">Phòng Công nghệ & IT</option>
              <option value="Phân xưởng Sản xuất 1">Phân xưởng Sản xuất 1</option>
              <option value="Đội Vận tải & Kho vận">Đội Vận tải & Kho vận</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setRegisterView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu sổ tài sản cố định ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã TSCĐ</th>
                <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản cố định</th>
                <th style={{ width: 160, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Loại tài sản</th>
                <th style={{ width: 170, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày ghi tăng</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Hao mòn lũy kế</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Tỷ lệ KH</th>
                <th style={{ width: 80, padding: "8px", textAlign: "center" }}>TK NG</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((row, idx) => (
                <tr key={row.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{row.name}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.category}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.dept}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{row.startDate}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>{formatVND(row.originalCost)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: "#64748b" }}>{formatVND(row.depreciatedAmount)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{formatVND(row.remainingAmount)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{row.rateYear}%</td>
                  <td style={{ padding: "8px", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>{row.costAccount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng tài sản: {filteredAssets.length}</span>
          <div style={{ display: "flex", gap: 20 }}>
            <span>Tổng nguyên giá: <strong style={{ color: "#00a862" }}>{formatVND(totalOriginalCost)}</strong></span>
            <span>Tổng hao mòn: <strong>{formatVND(totalDepreciated)}</strong></span>
            <span>Tổng còn lại: <strong style={{ color: "#16a34a" }}>{formatVND(totalRemaining)}</strong></span>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 3. TAB: GHI TĂNG (increase) - ẢNH MỚI 1 & ẢNH MỚI 2
  // =========================================================================
  if (tab === "increase") {
    // VIEW 1: INTRO LANDING SCREEN (ẢNH MỚI 1 CỦA NGƯỜI DÙNG)
    if (increaseView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderIncreaseIllustration()}

            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 660, lineHeight: 1.45 }}>
              Khi mua TSCĐ về sử dụng ngay, bạn cần ghi tăng TSCĐ vào sổ tài sản để theo dõi và tính khấu hao hàng tháng
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{
                  height: 34,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddAssetModal(true)}
                style={{
                  height: 34,
                  padding: "0 22px",
                  borderRadius: 6,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                }}
              >
                Thêm
              </button>
              <button
                type="button"
                onClick={() => notify("Tiện ích: Nhập khẩu chứng từ ghi tăng TSCĐ từ file Excel")}
                style={{
                  height: 34,
                  padding: "0 18px",
                  borderRadius: 6,
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "#94a3b8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
              >
                Nhập từ Excel
              </button>
            </div>
          </div>

          {/* Bottom Button: Xem danh sách chứng từ */}
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setIncreaseView("table")}
              style={{
                height: 32,
                padding: "0 22px",
                borderRadius: 4,
                background: "#ffffff",
                color: "#00a862",
                border: "1px solid #00a862",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Xem danh sách chứng từ
            </button>
          </div>

          {renderModals()}
        </div>
      );
    }

    // VIEW 2: DATA TABLE VIEW
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowAddAssetModal(true)}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm chứng từ ghi tăng</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Nhập khẩu chứng từ ghi tăng từ Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", color: "#1e293b", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              Nhập từ Excel
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setIncreaseView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ ghi tăng ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã TSCĐ</th>
                <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản cố định</th>
                <th style={{ width: 150, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                <th style={{ width: 160, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                <th style={{ width: 100, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {increaseVouchers.map((a, idx) => (
                <tr key={a.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{a.voucherNo}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{a.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600 }}>{a.assetCode}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{a.assetName}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#00a862" }}>{formatVND(a.originalCost)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{a.dept}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 4. TAB: TÍNH KHẤU HAO (depreciation) - ẢNH MỚI 1 & ẢNH MỚI 2
  // =========================================================================
  if (tab === "depreciation") {
    // VIEW 1: INTRO LANDING SCREEN (ẢNH MỚI 1 CỦA NGƯỜI DÙNG)
    if (deprView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderDepreciationIllustration()}

            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 680, lineHeight: 1.45 }}>
              Lập chứng từ tính và phân bổ chi phí khấu hao cho từng đối tượng sử dụng
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{
                  height: 34,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeprModal(true)}
                style={{
                  height: 34,
                  padding: "0 24px",
                  borderRadius: 6,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                }}
              >
                Thêm
              </button>
            </div>
          </div>

          {/* Bottom Button: Xem danh sách chứng từ */}
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setDeprView("table")}
              style={{
                height: 32,
                padding: "0 22px",
                borderRadius: 4,
                background: "#ffffff",
                color: "#00a862",
                border: "1px solid #00a862",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Xem danh sách chứng từ
            </button>
          </div>

          {renderModals()}
        </div>
      );
    }

    // VIEW 2: DATA TABLE VIEW
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowDeprModal(true)}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm chứng từ khấu hao</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setDeprView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ trích khấu hao ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kỳ khấu hao</th>
                <th style={{ minWidth: 320, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                <th style={{ width: 160, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng tiền khấu hao</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {deprVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{v.voucherNo}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 500 }}>{v.period}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.reason}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#00a862" }}>{formatVND(v.amount)}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng chứng từ: {deprVouchers.length}</span>
          <span>Tổng tiền trích khấu hao: <strong style={{ color: "#00a862" }}>{formatVND(deprVouchers.reduce((s, v) => s + v.amount, 0))}</strong></span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 5. TAB: ĐÁNH GIÁ LẠI (revaluation)
  // =========================================================================
  if (tab === "revaluation") {
    if (revalView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderRevalIllustration()}
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 720, lineHeight: 1.45 }}>
              Điều chỉnh giá trị khấu hao, hao mòn lũy kế, thời gian sử dụng TSCĐ sau khi thực hiện đánh giá lại TSCĐ hoặc nâng cấp TSCĐ
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{ height: 34, padding: "0 20px", borderRadius: 6, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRevalModal(true)}
                style={{ height: 34, padding: "0 22px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setRevalView("table")}
              style={{ height: 32, padding: "0 22px", borderRadius: 4, background: "#ffffff", color: "#00a862", border: "1px solid #00a862", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowRevalModal(true)}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm đánh giá lại</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setRevalView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ đánh giá lại TSCĐ ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                <th style={{ width: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do đánh giá lại</th>
                <th style={{ width: 160, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch giá trị</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {revalVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td
                    onClick={() => {
                      setRevalVoucherNo(v.voucherNo);
                      setShowRevalModal(true);
                    }}
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {v.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{v.assetCode}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.assetName}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.reason}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: v.diffAmount >= 0 ? "#16a34a" : "#ef4444" }}>
                    {v.diffAmount >= 0 ? `+${formatVND(v.diffAmount)}` : formatVND(v.diffAmount)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng chứng từ: {revalVouchers.length}</span>
          <span>Tổng tiền chênh lệch: <strong style={{ color: "#00a862" }}>{formatVND(revalVouchers.reduce((s, v) => s + v.diffAmount, 0))}</strong></span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 6. TAB: ĐIỀU CHUYỂN (transfer)
  // =========================================================================
  if (tab === "transfer") {
    if (transferView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderTransferIllustration()}
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 720, lineHeight: 1.45 }}>
              Lập chứng từ để ghi nhận vào sổ TSCĐ việc điều chuyển TSCĐ từ đơn vị sử dụng này sang đơn vị sử dụng khác
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{ height: 34, padding: "0 20px", borderRadius: 6, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                style={{ height: 34, padding: "0 22px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setTransferView("table")}
              style={{ height: 32, padding: "0 22px", borderRadius: 4, background: "#ffffff", color: "#00a862", border: "1px solid #00a862", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm điều chuyển</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setTransferView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ điều chuyển TSCĐ ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                <th style={{ width: 200, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                <th style={{ width: 150, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Từ đơn vị</th>
                <th style={{ width: 150, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đến đơn vị</th>
                <th style={{ minWidth: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do điều chuyển</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {transferVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td
                    onClick={() => {
                      setTransferVoucherNo(v.voucherNo);
                      setShowTransferModal(true);
                    }}
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {v.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{v.assetCode}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.assetName}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.fromDept}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#00a862", fontWeight: 500 }}>{v.toDept}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.reason}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng chứng từ: {transferVouchers.length}</span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 7. TAB: GHI GIẢM (decrease)
  // =========================================================================
  if (tab === "decrease") {
    if (decreaseView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderDecreaseIllustration()}
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 720, lineHeight: 1.45 }}>
              Ghi giảm TSCĐ trên sổ TSCĐ khi thanh lý TSCĐ hoặc chuyển TSCĐ thành CCDC hoặc báo mất TSCĐ
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{ height: 34, padding: "0 20px", borderRadius: 6, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDecreaseModal(true)}
                style={{ height: 34, padding: "0 22px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setDecreaseView("table")}
              style={{ height: 32, padding: "0 22px", borderRadius: 4, background: "#ffffff", color: "#00a862", border: "1px solid #00a862", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowDecreaseModal(true)}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm ghi giảm</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setDecreaseView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ ghi giảm TSCĐ ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ minWidth: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do ghi giảm</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                <th style={{ width: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {decVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td
                    onClick={() => {
                      setDecVoucherNo(v.voucherNo);
                      setShowDecreaseModal(true);
                    }}
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {v.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.reason}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{v.assetCode}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.assetName}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#00a862" }}>{formatVND(v.originalCost)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#ef4444" }}>{formatVND(v.remainingValue)}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng chứng từ: {decVouchers.length}</span>
          <span>Tổng nguyên giá ghi giảm: <strong style={{ color: "#00a862" }}>{formatVND(decVouchers.reduce((s, v) => s + v.originalCost, 0))}</strong></span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 8. TAB: KIỂM KÊ (stocktake)
  // =========================================================================
  if (tab === "stocktake") {
    if (stocktakeView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderStocktakeIllustration()}
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 720, lineHeight: 1.45 }}>
              Lập biên bản kiểm kê TSCĐ để ghi nhận kết quả kiểm kê TSCĐ định kỳ và xử lý chênh lệch từ kiểm kê
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{ height: 34, padding: "0 20px", borderRadius: 6, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowStocktakeModal(true)}
                style={{ height: 34, padding: "0 22px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setStocktakeView("table")}
              style={{ height: 32, padding: "0 22px", borderRadius: 4, background: "#ffffff", color: "#00a862", border: "1px solid #00a862", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowStocktakeModal(true)}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm kiểm kê</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setStocktakeView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách biên bản kiểm kê TSCĐ ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 140, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số biên bản</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày kiểm kê</th>
                <th style={{ minWidth: 240, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mục đích kiểm kê</th>
                <th style={{ width: 120, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Tổng số TSCĐ</th>
                <th style={{ width: 120, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Số lượng khớp</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Kết luận kiểm kê</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {stocktakeVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td
                    onClick={() => {
                      setStocktakeDate(v.date);
                      setShowStocktakeModal(true);
                    }}
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {v.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.purpose}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600 }}>{v.totalAssets}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#16a34a", fontWeight: 600 }}>{v.matchedAssets}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: v.diffAssets > 0 ? "#ef4444" : "#64748b", fontWeight: 600 }}>{v.diffAssets}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.conclusion}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng biên bản kiểm kê: {stocktakeVouchers.length}</span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 9. TAB: BÁO CÁO (reports - ẢNH 5 MỚI CỦA NGƯỜI DÙNG)
  // =========================================================================
  if (tab === "reports") {
    const assetReportsList = [
      { id: "S21", title: "S21 - DN: Sổ tài sản cố định" },
      { id: "SO_TSCD", title: "Sổ tài sản cố định" },
      { id: "THE_TSCD", title: "Thẻ tài sản cố định" },
      { id: "KH_NAM", title: "Bảng tính khấu hao tài sản cố định theo năm" },
    ].filter(r => !reportSearch || r.title.toLowerCase().includes(reportSearch.toLowerCase()));

    const reconcileReportsList = [
      { id: "DC_SO_CAI", title: "Báo cáo đối chiếu sổ tài sản và sổ cái" },
      { id: "DC_KIEM_KE", title: "Báo cáo đối chiếu kết quả kiểm kê với sổ tài sản" },
    ].filter(r => !reportSearch || r.title.toLowerCase().includes(reportSearch.toLowerCase()));

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        {/* Top bar matching Image 5 */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", width: 220 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 8, color: "#64748b" }} />
              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Tìm theo tên báo cáo"
                style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("AVA Kế toán: Trợ lý tìm kiếm báo cáo tài sản thông minh")}
              style={{ height: 30, padding: "0 10px", border: "none", background: "transparent", fontSize: 12.5, color: "#7c3aed", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 500 }}
            >
              <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
              <Sparkles size={14} style={{ color: "#7c3aed" }} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569" }}>
              <span>Ngôn ngữ báo cáo</span>
              <select
                value={reportLang}
                onChange={(e) => setReportLang(e.target.value)}
                style={{ height: 28, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff", outline: "none", cursor: "pointer" }}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => notify("Tùy chọn ẩn / hiện các báo cáo trong danh sách")}
              style={{ height: 28, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Eye size={13} style={{ color: "#64748b" }} />
              <span>Ẩn/hiện báo cáo</span>
            </button>
            <div style={{ borderLeft: "1px solid #cbd5e1", paddingLeft: 8, display: "flex", alignItems: "center" }}>
              <button
                type="button"
                style={{ border: "1px solid #cbd5e1", background: "#f8fafc", width: 28, height: 28, borderRadius: 4, display: "grid", placeItems: "center", color: "#475569", cursor: "pointer" }}
                title="Dạng lưới"
              >
                <FileText size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Content sections */}
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 1. Báo cáo tài sản */}
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div
              onClick={() => setAssetReportsOpen(!assetReportsOpen)}
              style={{ height: 38, padding: "0 16px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: assetReportsOpen ? "1px solid #e2e8f0" : "none", cursor: "pointer", userSelect: "none" }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Báo cáo tài sản</span>
              {assetReportsOpen ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>
            {assetReportsOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "14px 16px", gap: 12 }}>
                {assetReportsList.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setPreviewReportName(r.title)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 4,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#1e293b",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#00a862";
                      e.currentTarget.style.background = "#f0fdf4";
                      e.currentTarget.style.color = "#00a862";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.color = "#1e293b";
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{r.title}</span>
                    <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Báo cáo đối chiếu */}
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div
              onClick={() => setReconcileReportsOpen(!reconcileReportsOpen)}
              style={{ height: 38, padding: "0 16px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: reconcileReportsOpen ? "1px solid #e2e8f0" : "none", cursor: "pointer", userSelect: "none" }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Báo cáo đối chiếu</span>
              {reconcileReportsOpen ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>
            {reconcileReportsOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "14px 16px", gap: 12 }}>
                {reconcileReportsList.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setPreviewReportName(r.title)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 4,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#1e293b",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#00a862";
                      e.currentTarget.style.background = "#f0fdf4";
                      e.currentTarget.style.color = "#00a862";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.color = "#1e293b";
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{r.title}</span>
                    <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ padding: 20 }}>
      {renderModals()}
    </div>
  );
}
