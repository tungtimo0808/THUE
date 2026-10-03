import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  X,
  SlidersHorizontal,
  Wrench,
  Eye,
  Star,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Printer,
  Sparkles,
  ArrowRightLeft,
  Divide,
  Sliders,
  MinusCircle,
  ClipboardList,
  GitBranch,
  Download,
  Calendar,
  RotateCcw,
  HelpCircle,
  Trash2,
  Check,
  Paperclip,
  Upload,
  Maximize2,
  Settings,
  Filter,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";

export type MisaToolsWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

// ============================================================================
// SAMPLE DATA
// ============================================================================
export const SAMPLE_TOOLS_DATA = [
  {
    code: "CCDC001",
    name: "Bộ máy tính để bàn Dell Vostro 3910",
    category: "Thiết bị văn phòng",
    dept: "Phòng Kế toán",
    qty: 3,
    originalCost: 45000000,
    allocatedAmount: 15000000,
    remainingAmount: 30000000,
    allocationMonths: 36,
    remainingMonths: 24,
    costAccount: "6422",
    startDate: "01/01/2026",
  },
  {
    code: "CCDC002",
    name: "Máy in laser đa năng HP LaserJet Pro MFP M428fdn",
    category: "Thiết bị văn phòng",
    dept: "Phòng Hành chính - Nhân sự",
    qty: 2,
    originalCost: 24000000,
    allocatedAmount: 8000000,
    remainingAmount: 16000000,
    allocationMonths: 24,
    remainingMonths: 16,
    costAccount: "6422",
    startDate: "15/01/2026",
  },
  {
    code: "CCDC003",
    name: "Máy hàn cáp quang Comway C10 công nghiệp",
    category: "Dụng cụ chuyên dùng",
    dept: "Phân xưởng Kỹ thuật cơ điện",
    qty: 1,
    originalCost: 55000000,
    allocatedAmount: 18333333,
    remainingAmount: 36666667,
    allocationMonths: 36,
    remainingMonths: 24,
    costAccount: "6277",
    startDate: "05/02/2026",
  },
  {
    code: "CCDC004",
    name: "Bàn làm việc chữ L kèm tủ phụ Hòa Phát",
    category: "Nội thất văn phòng",
    dept: "Phòng Kinh doanh & Dự án",
    qty: 5,
    originalCost: 17500000,
    allocatedAmount: 7291666,
    remainingAmount: 10208334,
    allocationMonths: 24,
    remainingMonths: 14,
    costAccount: "6422",
    startDate: "10/02/2026",
  },
  {
    code: "CCDC005",
    name: "Máy nén khí không dầu Pegasus 3HP 100L",
    category: "Máy móc thiết bị",
    dept: "Xưởng Sản xuất Tủ bảng điện",
    qty: 2,
    originalCost: 16800000,
    allocatedAmount: 4200000,
    remainingAmount: 12600000,
    allocationMonths: 24,
    remainingMonths: 18,
    costAccount: "6277",
    startDate: "20/03/2026",
  },
  {
    code: "CCDC006",
    name: "Bộ đàm cầm tay Icom IC-V80 chống nước",
    category: "Dụng cụ quản lý",
    dept: "Bộ phận An ninh & Kho vận",
    qty: 6,
    originalCost: 12000000,
    allocatedAmount: 6000000,
    remainingAmount: 6000000,
    allocationMonths: 12,
    remainingMonths: 6,
    costAccount: "6427",
    startDate: "01/04/2026",
  },
];

export const SAMPLE_PREPAID_EXPENSES = [
  {
    code: "CPTT001",
    name: "Chi phí thuê văn phòng làm việc Trụ sở Quý 3/2026",
    totalAmount: 180000000,
    allocationMonths: 3,
    allocatedAmount: 120000000,
    remainingAmount: 60000000,
    costAccount: "6422",
    dept: "Khối Văn phòng",
    startDate: "01/07/2026",
  },
  {
    code: "CPTT002",
    name: "Bảo hiểm cháy nổ nhà kho & văn phòng năm 2026",
    totalAmount: 72000000,
    allocationMonths: 12,
    allocatedAmount: 54000000,
    remainingAmount: 18000000,
    costAccount: "6277",
    dept: "Kho tổng Minh An",
    startDate: "01/01/2026",
  },
  {
    code: "CPTT003",
    name: "Phí dịch vụ bản quyền phần mềm ERP & Hóa đơn điện tử",
    totalAmount: 48000000,
    allocationMonths: 12,
    allocatedAmount: 36000000,
    remainingAmount: 12000000,
    costAccount: "6427",
    dept: "Phòng Kế toán",
    startDate: "01/01/2026",
  },
  {
    code: "CPTT004",
    name: "Chi phí sửa chữa, nâng cấp hệ thống phòng máy chủ Server",
    totalAmount: 36000000,
    allocationMonths: 6,
    allocatedAmount: 18000000,
    remainingAmount: 18000000,
    costAccount: "6427",
    dept: "Phòng Kỹ thuật CNTT",
    startDate: "01/06/2026",
  },
];

export const SAMPLE_INCREASE_VOUCHERS = [
  {
    voucherNo: "GTCC00001",
    postingDate: "05/09/2026",
    voucherDate: "05/09/2026",
    reason: "Ghi tăng 03 bộ máy tính Dell Vostro phòng Kế toán",
    totalCost: 45000000,
    creator: "Nguyễn Thị Mai",
    source: "Lấy CCDC từ chứng từ xuất kho/mua hàng",
  },
  {
    voucherNo: "GTCC00002",
    postingDate: "12/09/2026",
    voucherDate: "12/09/2026",
    reason: "Ghi tăng 01 máy hàn cáp quang Comway xưởng Kỹ thuật",
    totalCost: 55000000,
    creator: "Trần Văn Bình",
    source: "Lấy CCDC từ chứng từ xuất kho/mua hàng",
  },
  {
    voucherNo: "GTCC00003",
    postingDate: "18/09/2026",
    voucherDate: "18/09/2026",
    reason: "Ghi tăng 05 bộ bàn làm việc chữ L phòng Kinh doanh",
    totalCost: 17500000,
    creator: "Lê Hoàng Long",
    source: "Lấy CCDC từ ghi giảm tài sản cố định",
  },
];

export const SAMPLE_ALLOCATION_VOUCHERS = [
  {
    voucherNo: "PBCC00001",
    postingDate: "30/09/2026",
    voucherDate: "30/09/2026",
    reason: "Phân bổ chi phí CCDC tháng 9 năm 2026",
    totalAmount: 15650000,
    creator: "Nguyễn Thị Mai",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "PBCC00002",
    postingDate: "31/08/2026",
    voucherDate: "31/08/2026",
    reason: "Phân bổ chi phí CCDC tháng 8 năm 2026",
    totalAmount: 15650000,
    creator: "Nguyễn Thị Mai",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "PBCC00003",
    postingDate: "31/07/2026",
    voucherDate: "31/07/2026",
    reason: "Phân bổ chi phí CCDC tháng 7 năm 2026",
    totalAmount: 14800000,
    creator: "Trần Văn Bình",
    status: "Đã ghi sổ",
  },
];

export const SAMPLE_ALLOCATION_ITEMS = [
  {
    toolCode: "CCDC001",
    toolName: "Bộ máy tính để bàn Dell Vostro 3910",
    dept: "Phòng Kế toán",
    originalCost: 45000000,
    allocatedAmount: 15000000,
    remainingAmount: 30000000,
    allocMonths: 36,
    remainingMonths: 24,
    thisMonthAlloc: 1250000,
    waitingAcc: "242",
    costAcc: "6422",
  },
  {
    toolCode: "CCDC002",
    toolName: "Máy in laser đa năng HP LaserJet Pro MFP M428fdn",
    dept: "Phòng Hành chính - Nhân sự",
    originalCost: 18500000,
    allocatedAmount: 6166667,
    remainingAmount: 12333333,
    allocMonths: 24,
    remainingMonths: 16,
    thisMonthAlloc: 770833,
    waitingAcc: "242",
    costAcc: "6422",
  },
  {
    toolCode: "CCDC003",
    toolName: "Máy hàn cáp quang Comway C6S",
    dept: "Phân xưởng Kỹ thuật cơ điện",
    originalCost: 68000000,
    allocatedAmount: 22666667,
    remainingAmount: 45333333,
    allocMonths: 36,
    remainingMonths: 24,
    thisMonthAlloc: 1888889,
    waitingAcc: "242",
    costAcc: "6277",
  },
  {
    toolCode: "CCDC004",
    toolName: "Đồng hồ vạn năng kỹ thuật số Fluke 87V",
    dept: "Phân xưởng Kỹ thuật cơ điện",
    originalCost: 15600000,
    allocatedAmount: 5200000,
    remainingAmount: 10400000,
    allocMonths: 24,
    remainingMonths: 16,
    thisMonthAlloc: 650000,
    waitingAcc: "242",
    costAcc: "6277",
  },
  {
    toolCode: "CCDC005",
    toolName: "Máy nén khí trục vít Pegasus TMPMB-20A",
    dept: "Xưởng Sản xuất Tủ bảng điện",
    originalCost: 85000000,
    allocatedAmount: 28333333,
    remainingAmount: 56666667,
    allocMonths: 36,
    remainingMonths: 24,
    thisMonthAlloc: 2361111,
    waitingAcc: "242",
    costAcc: "6277",
  },
  {
    toolCode: "CCDC006",
    toolName: "Bàn làm việc chữ L 1m6 kèm hộc di động Hoà Phát",
    dept: "Phòng Kinh doanh",
    originalCost: 28000000,
    allocatedAmount: 9333333,
    remainingAmount: 18666667,
    allocMonths: 24,
    remainingMonths: 16,
    thisMonthAlloc: 1166667,
    waitingAcc: "242",
    costAcc: "6422",
  },
  {
    toolCode: "CCDC007",
    toolName: "Ghế lưới xoay công thái học Ergonomic",
    dept: "Phòng Kinh doanh",
    originalCost: 18000000,
    allocatedAmount: 6000000,
    remainingAmount: 12000000,
    allocMonths: 24,
    remainingMonths: 16,
    thisMonthAlloc: 750000,
    waitingAcc: "242",
    costAcc: "6422",
  },
  {
    toolCode: "CCDC008",
    toolName: "Máy chiếu hội trường Epson EB-2250U",
    dept: "Phòng Họp điều hành",
    originalCost: 42000000,
    allocatedAmount: 14000000,
    remainingAmount: 28000000,
    allocMonths: 36,
    remainingMonths: 24,
    thisMonthAlloc: 1166667,
    waitingAcc: "242",
    costAcc: "6422",
  },
  {
    toolCode: "CCDC009",
    toolName: "Tủ sắt hồ sơ văn phòng 4 cánh kính TU09K3CK",
    dept: "Phòng Kế toán",
    originalCost: 14500000,
    allocatedAmount: 4833333,
    remainingAmount: 9666667,
    allocMonths: 24,
    remainingMonths: 16,
    thisMonthAlloc: 604167,
    waitingAcc: "242",
    costAcc: "6422",
  },
  {
    toolCode: "CCDC010",
    toolName: "Máy đo nội trở ắc quy Hioki BT3554",
    dept: "Phân xưởng Kỹ thuật cơ điện",
    originalCost: 58000000,
    allocatedAmount: 19333333,
    remainingAmount: 38666667,
    allocMonths: 36,
    remainingMonths: 24,
    thisMonthAlloc: 1611111,
    waitingAcc: "242",
    costAcc: "6277",
  },
  {
    toolCode: "CCDC011",
    toolName: "Bộ đàm cầm tay Motorola GP328 Plus chống nước",
    dept: "Đội Bảo vệ & An ninh",
    originalCost: 22000000,
    allocatedAmount: 7333333,
    remainingAmount: 14666667,
    allocMonths: 24,
    remainingMonths: 16,
    thisMonthAlloc: 916667,
    waitingAcc: "242",
    costAcc: "6422",
  },
  {
    toolCode: "CCDC012",
    toolName: "Máy cắt sắt bàn Makita LW1401",
    dept: "Xưởng Sản xuất Tủ bảng điện",
    originalCost: 37500000,
    allocatedAmount: 12500000,
    remainingAmount: 25000000,
    allocMonths: 24,
    remainingMonths: 16,
    thisMonthAlloc: 1562500,
    waitingAcc: "242",
    costAcc: "6277",
  },
  {
    toolCode: "CCDC013",
    toolName: "Máy uốn thanh cái đồng đồng bộ thủy lực",
    dept: "Xưởng Sản xuất Tủ bảng điện",
    originalCost: 35000000,
    allocatedAmount: 11666667,
    remainingAmount: 23333333,
    allocMonths: 24,
    remainingMonths: 16,
    thisMonthAlloc: 1458333,
    waitingAcc: "242",
    costAcc: "6277",
  },
];

export const SAMPLE_ADJUSTMENT_VOUCHERS = [
  {
    voucherNo: "ĐCH00001",
    voucherDate: "30/09/2026",
    reason: "Điều chỉnh nâng cấp RAM và SSD cho 03 bộ máy tính để bàn phòng Kế toán",
    adjustmentAmount: 4500000,
    creator: "Nguyễn Thị Mai",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "ĐCH00002",
    voucherDate: "15/08/2026",
    reason: "Điều chỉnh giảm giá trị do tháo dỡ linh kiện máy photocopy Ricoh MP 3054",
    adjustmentAmount: -3200000,
    creator: "Trần Văn Bình",
    status: "Đã ghi sổ",
  },
];

export const SAMPLE_TRANSFER_VOUCHERS = [
  {
    voucherNo: "ĐCCC00001",
    voucherDate: "30/09/2026",
    deliverer: "Trần Văn Bình",
    receiver: "Nguyễn Thị Mai",
    reason: "Điều chuyển 02 bộ máy tính từ phòng Kinh doanh sang phòng Kế toán",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "ĐCCC00002",
    voucherDate: "12/08/2026",
    deliverer: "Lê Hoàng Long",
    receiver: "Trần Văn Bình",
    reason: "Điều chuyển máy khoan đập Makita sang Xưởng sản xuất",
    status: "Đã ghi sổ",
  },
];

export const SAMPLE_DECREASE_VOUCHERS = [
  {
    voucherNo: "GGCC00001",
    voucherDate: "30/09/2026",
    reason: "Nhượng bán, Thanh lý",
    itemCount: 2,
    totalQty: 2,
    totalRemainingAmount: 18500000,
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GGCC00002",
    voucherDate: "15/08/2026",
    reason: "Hư hỏng không thể sửa chữa",
    itemCount: 1,
    totalQty: 1,
    totalRemainingAmount: 4200000,
    status: "Đã ghi sổ",
  },
];

export const SAMPLE_STOCKTAKE_VOUCHERS = [
  {
    voucherNo: "BBKK00001",
    voucherDate: "30/09/2026",
    toDate: "30/09/2026",
    purpose: "Kiểm kê định kỳ công cụ dụng cụ Quý 3/2026",
    bookQty: 42,
    actualQty: 42,
    diffQty: 0,
    status: "Đã hoàn thành",
  },
  {
    voucherNo: "BBKK00002",
    voucherDate: "30/06/2026",
    toDate: "30/06/2026",
    purpose: "Kiểm kê định kỳ công cụ dụng cụ Quý 2/2026",
    bookQty: 38,
    actualQty: 37,
    diffQty: -1,
    status: "Đã xử lý chênh lệch",
  },
];

// Sample vouchers for extracting CCDC
export const SAMPLE_SOURCE_VOUCHERS_INVENTORY_PURCHASE = [
  {
    id: "v-xk01",
    voucherNo: "XK00001",
    voucherDate: "15/09/2026",
    type: "Xuất kho",
    itemCode: "VT004",
    itemName: "Biến dòng đo lường trung thế 24kV 100/5A",
    unit: "Quả",
    qty: 3,
    price: 1450000,
    amount: 4350000,
    category: "Dụng cụ chuyên dùng",
    group: "Khí cụ đo lường",
    reason: "Xuất kho sử dụng tại Trạm biến áp 110kV",
  },
  {
    id: "v-xk02",
    voucherNo: "XK00002",
    voucherDate: "18/09/2026",
    type: "Xuất kho",
    itemCode: "CC002",
    itemName: "Máy hàn cáp quang Comway C10 công nghiệp",
    unit: "Bộ",
    qty: 1,
    price: 55000000,
    amount: 55000000,
    category: "Máy móc thiết bị",
    group: "Thiết bị viễn thông",
    reason: "Xuất kho cho Phân xưởng Kỹ thuật cơ điện",
  },
  {
    id: "v-mh01",
    voucherNo: "MH00001",
    voucherDate: "20/09/2026",
    type: "Mua hàng",
    itemCode: "CC003",
    itemName: "Bộ máy tính để bàn Dell Vostro 3910 Core i5",
    unit: "Bộ",
    qty: 2,
    price: 15000000,
    amount: 30000000,
    category: "Thiết bị văn phòng",
    group: "Máy vi tính",
    reason: "Mua sắm trang bị cho Phòng Kế toán",
  },
  {
    id: "v-mh02",
    voucherNo: "MH00002",
    voucherDate: "25/09/2026",
    type: "Mua hàng",
    itemCode: "CC004",
    itemName: "Bàn làm việc chữ L chân sắt kèm hộc di động",
    unit: "Chiếc",
    qty: 4,
    price: 3500000,
    amount: 14000000,
    category: "Nội thất văn phòng",
    group: "Bàn ghế",
    reason: "Mua sắm cho Phòng Kinh doanh dự án",
  },
];

export const SAMPLE_SOURCE_VOUCHERS_ASSET_DECREASE = [
  {
    id: "v-gg01",
    voucherNo: "GGTS00001",
    voucherDate: "10/09/2026",
    type: "Ghi giảm TSCĐ",
    itemCode: "TS001",
    itemName: "Dàn máy chủ Server Dell PowerEdge R740",
    unit: "Hệ thống",
    qty: 1,
    price: 28500000,
    amount: 28500000,
    category: "Thiết bị văn phòng",
    group: "Máy chủ & Mạng",
    reason: "Chuyển thành CCDC quản lý nội bộ",
  },
  {
    id: "v-gg02",
    voucherNo: "GGTS00002",
    voucherDate: "22/09/2026",
    type: "Ghi giảm TSCĐ",
    itemCode: "TS002",
    itemName: "Thiết bị phân tích sóng hài Fluke 435-II",
    unit: "Bộ",
    qty: 1,
    price: 22000000,
    amount: 22000000,
    category: "Dụng cụ chuyên dùng",
    group: "Thiết bị đo lường",
    reason: "Ghi giảm TSCĐ chuyển sang CCDC theo dõi",
  },
];

export default function MisaToolsWorkspace({
  company: _company = { id: "minh-an", name: "Công ty Cổ phần Minh An" },
  period: _period = "2026-09",
  tab = "process",
  href,
  notify,
}: MisaToolsWorkspaceProps) {
  // Navigation helper
  const navigateTo = (targetTab: string) => {
    if (href) {
      window.location.href = href(`/tools/${targetTab}`);
    }
  };

  // View modes for landing/list
  const [registerViewMode, setRegisterViewMode] = useState<"landing" | "list">("landing");
  const [managementViewMode, setManagementViewMode] = useState<"landing" | "list">("landing");
  const [prepaidViewMode, setPrepaidViewMode] = useState<"landing" | "list">("landing");

  // Subtabs for Management (Quản lý công cụ dụng cụ)
  const initialManagementSubtab = [
    "increase",
    "allocation",
    "adjustment",
    "transfer",
    "decrease",
    "stocktake",
  ].includes(tab)
    ? (tab as any)
    : "increase";

  const [managementSubtab, setManagementSubtab] = useState<
    "increase" | "allocation" | "adjustment" | "transfer" | "decrease" | "stocktake"
  >(initialManagementSubtab);

  // Subtabs for Prepaid expenses (Chi phí trả trước)
  const [prepaidSubtab, setPrepaidSubtab] = useState<
    "list" | "allocation" | "decrease"
  >("list");

  // Sync subtab & actions from URL params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    const sub = urlParams.get("subtab");

    if (sub && ["increase", "allocation", "adjustment", "transfer", "decrease", "stocktake"].includes(sub)) {
      setManagementSubtab(sub as any);
    } else if (["increase", "allocation", "adjustment", "transfer", "decrease", "stocktake"].includes(tab)) {
      setManagementSubtab(tab as any);
    }

    if (tab === "register" && action === "opening") {
      setShowSingleAddModal(true);
    }

    if (tab === "prepaid") {
      if (action === "opening") {
        setPrepaidModalMode("opening");
        setShowPrepaidItemModal(true);
      } else if (action === "new") {
        setPrepaidModalMode("new");
        setShowPrepaidItemModal(true);
      }
      if (sub === "allocation" || sub === "decrease" || sub === "list") {
        setPrepaidSubtab(sub as any);
      }
    }
  }, [tab]);

  // Dropdown menu state on Thêm button (Quản lý CCDC > Ghi tăng)
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Modals state
  const [showSingleAddModal, setShowSingleAddModal] = useState(false);
  const [showBatchAddModal, setShowBatchAddModal] = useState(false);
  const [showSelectVoucherModal, setShowSelectVoucherModal] = useState(false);
  const [selectVoucherTarget, setSelectVoucherTarget] = useState<"single" | "batch">("single");

  // Miscellaneous Modals
  const [showOrgTreeModal, setShowOrgTreeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  // Reports tab state
  const [reportSearch, setReportSearch] = useState("");
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    favorite: true,
    tools: true,
    prepaid: false,
    reconciliation: false,
  });
  const [favoriteReports, setFavoriteReports] = useState<string[]>([
    "Bảng tính phân bổ công cụ dụng cụ",
    "Bảng tính phân bổ chi phí trả trước",
  ]);
  const [selectedReportForPreview, setSelectedReportForPreview] = useState<string | null>(null);

  // =========================================================================
  // STATE CHO PHÂN BỔ CHI PHÍ CCDC (Ảnh user cung cấp)
  // =========================================================================
  const [allocationViewMode, setAllocationViewMode] = useState<"landing" | "list">("landing");
  const [showSelectPeriodModal, setShowSelectPeriodModal] = useState(false);
  const [allocationMonth, setAllocationMonth] = useState<number>(9);
  const [allocationYear, setAllocationYear] = useState<number>(2026);
  const [showAllocationVoucherModal, setShowAllocationVoucherModal] = useState(false);
  const [allocationVouchers, setAllocationVouchers] = useState(SAMPLE_ALLOCATION_VOUCHERS);
  const [allocationVoucherNo, setAllocationVoucherNo] = useState("PBCC00001");
  const [allocationPostingDate, setAllocationPostingDate] = useState("30/09/2026");
  const [allocationVoucherDate, setAllocationVoucherDate] = useState("30/09/2026");
  const [allocationReason, setAllocationReason] = useState("Phân bổ chi phí CCDC tháng 9 năm 2026");
  const [allocationVoucherTab, setAllocationVoucherTab] = useState<"allocation" | "accounting">("allocation");
  const [allocationFilterPeriod, setAllocationFilterPeriod] = useState("Năm 2026");
  const [allocationSearch, setAllocationSearch] = useState("");

  // =========================================================================
  // STATE CHO ĐIỀU CHỈNH CÔNG CỤ DỤNG CỤ (Ảnh 1 & 2 của user)
  // =========================================================================
  const [adjustmentViewMode, setAdjustmentViewMode] = useState<"landing" | "list">("landing");
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentVouchers, setAdjustmentVouchers] = useState(SAMPLE_ADJUSTMENT_VOUCHERS);
  const [adjustmentVoucherNo, setAdjustmentVoucherNo] = useState("ĐCH00001");
  const [adjustmentVoucherDate, setAdjustmentVoucherDate] = useState("30/09/2026");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentActiveTab, setAdjustmentActiveTab] = useState<"detail" | "vouchers">("detail");
  const [adjustmentFilterPeriod, setAdjustmentFilterPeriod] = useState("Năm 2026");
  const [adjustmentSearch, setAdjustmentSearch] = useState("");
  const [adjustmentRows, setAdjustmentRows] = useState([
    {
      id: "adj-1",
      code: "",
      name: "",
      qty: 0,
      waitingAcc: "242",
      remainingBefore: 0,
      remainingAfter: 0,
      remainingDiff: 0,
      periodBefore: 0,
      periodAfter: 0,
      periodDiff: 0,
      monthlyAlloc: 0,
    },
  ]);

  const totalAdjQty = adjustmentRows.reduce((s, r) => s + (r.qty || 0), 0);
  const totalAdjRemainingBefore = adjustmentRows.reduce((s, r) => s + (r.remainingBefore || 0), 0);
  const totalAdjRemainingAfter = adjustmentRows.reduce((s, r) => s + (r.remainingAfter || 0), 0);
  const totalAdjRemainingDiff = adjustmentRows.reduce((s, r) => s + (r.remainingDiff || 0), 0);
  const totalAdjPeriodBefore = adjustmentRows.reduce((s, r) => s + (r.periodBefore || 0), 0);
  const totalAdjPeriodAfter = adjustmentRows.reduce((s, r) => s + (r.periodAfter || 0), 0);
  const totalAdjPeriodDiff = adjustmentRows.reduce((s, r) => s + (r.periodDiff || 0), 0);
  const totalAdjMonthlyAlloc = adjustmentRows.reduce((s, r) => s + (r.monthlyAlloc || 0), 0);

  // =========================================================================
  // STATE CHO ĐIỀU CHUYỂN CÔNG CỤ DỤNG CỤ (Ảnh 1 & 2 của user)
  // =========================================================================
  const [transferViewMode, setTransferViewMode] = useState<"landing" | "list">("landing");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVouchers, setTransferVouchers] = useState(SAMPLE_TRANSFER_VOUCHERS);
  const [transferVoucherNo, setTransferVoucherNo] = useState("ĐCCC00001");
  const [transferVoucherDate, setTransferVoucherDate] = useState("30/09/2026");
  const [transferDeliverer, setTransferDeliverer] = useState("");
  const [transferReceiver, setTransferReceiver] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferFilterPeriod, setTransferFilterPeriod] = useState("Năm 2026");
  const [transferSearch, setTransferSearch] = useState("");
  const [transferRows, setTransferRows] = useState([
    {
      id: "trf-1",
      code: "",
      name: "",
      fromDept: "",
      toDept: "",
      currentQty: 0,
      transferQty: 0,
      statCode: "",
      contract: "",
      order: "",
    },
  ]);

  const totalTransferCurrentQty = transferRows.reduce((s, r) => s + (r.currentQty || 0), 0);
  const totalTransferQty = transferRows.reduce((s, r) => s + (r.transferQty || 0), 0);

  // =========================================================================
  // STATE CHO GHI GIẢM CÔNG CỤ DỤNG CỤ (Ảnh 1 & 2 của user)
  // =========================================================================
  const [decreaseViewMode, setDecreaseViewMode] = useState<"landing" | "list">("landing");
  const [showDecreaseModal, setShowDecreaseModal] = useState(false);
  const [decreaseVouchers, setDecreaseVouchers] = useState(SAMPLE_DECREASE_VOUCHERS);
  const [decreaseVoucherNo, setDecreaseVoucherNo] = useState("GGCC00001");
  const [decreaseVoucherDate, setDecreaseVoucherDate] = useState("30/09/2026");
  const [decreaseReason, setDecreaseReason] = useState("Nhượng bán, Thanh lý");
  const [decreaseFilterPeriod, setDecreaseFilterPeriod] = useState("Năm 2026");
  const [decreaseSearch, setDecreaseSearch] = useState("");
  const [decreaseRows, setDecreaseRows] = useState([
    {
      id: "dec-1",
      code: "",
      name: "",
      dept: "",
      currentQty: 0,
      decreaseQty: 0,
      remainingValue: 0,
    },
  ]);

  const totalDecreaseCurrentQty = decreaseRows.reduce((s, r) => s + (r.currentQty || 0), 0);
  const totalDecreaseQty = decreaseRows.reduce((s, r) => s + (r.decreaseQty || 0), 0);
  const totalDecreaseRemainingValue = decreaseRows.reduce((s, r) => s + (r.remainingValue || 0), 0);

  // =========================================================================
  // STATE CHO KIỂM KÊ CÔNG CỤ DỤNG CỤ (Ảnh của user)
  // =========================================================================
  const [stocktakeViewMode, setStocktakeViewMode] = useState<"landing" | "list">("landing");
  const [showStocktakeDateModal, setShowStocktakeDateModal] = useState(false);
  const [showStocktakeVoucherModal, setShowStocktakeVoucherModal] = useState(false);
  const [stocktakeToDate, setStocktakeToDate] = useState("30/09/2026");
  const [stocktakeVouchers, setStocktakeVouchers] = useState(SAMPLE_STOCKTAKE_VOUCHERS);
  const [stocktakeVoucherNo, setStocktakeVoucherNo] = useState("BBKK00001");
  const [stocktakeVoucherDate, setStocktakeVoucherDate] = useState("30/09/2026");
  const [stocktakePurpose, setStocktakePurpose] = useState("Kiểm kê định kỳ CCDC Quý 3/2026");
  const [stocktakeFilterPeriod, setStocktakeFilterPeriod] = useState("Năm 2026");
  const [stocktakeSearch, setStocktakeSearch] = useState("");
  const [stocktakeTab, setStocktakeTab] = useState<"detail" | "committee">("detail");
  const [stocktakeRows, setStocktakeRows] = useState([
    {
      id: "stk-1",
      code: "CC001",
      name: "Máy in Laser đa năng HP LaserJet Pro MFP M428fdw",
      dept: "Phòng Kế toán",
      bookQty: 2,
      actualQty: 2,
      diffExcess: 0,
      diffShortage: 0,
      solution: "Khớp sổ sách",
    },
    {
      id: "stk-2",
      code: "CC003",
      name: "Máy chiếu hội trường Epson EB-2250U độ sáng cao",
      dept: "Phòng Họp điều hành",
      bookQty: 1,
      actualQty: 1,
      diffExcess: 0,
      diffShortage: 0,
      solution: "Khớp sổ sách",
    },
    {
      id: "stk-3",
      code: "CC004",
      name: "Bàn làm việc chữ L chân sắt kèm hộc di động",
      dept: "Phòng Kinh doanh",
      bookQty: 4,
      actualQty: 4,
      diffExcess: 0,
      diffShortage: 0,
      solution: "Khớp sổ sách",
    },
  ]);
  const [stocktakeCommittee, setStocktakeCommittee] = useState([
    { id: "c-1", name: "Nguyễn Thị Mai", title: "Kế toán trưởng", dept: "Phòng Kế toán", role: "Trưởng ban" },
    { id: "c-2", name: "Trần Văn Bình", title: "Trưởng phòng HC-NS", dept: "Phòng HC-NS", role: "Ủy viên" },
    { id: "c-3", name: "Lê Hoàng Long", title: "Quản đốc xưởng", dept: "Phân xưởng sản xuất", role: "Ủy viên" },
  ]);

  const totalStocktakeBookQty = stocktakeRows.reduce((s, r) => s + (r.bookQty || 0), 0);
  const totalStocktakeActualQty = stocktakeRows.reduce((s, r) => s + (r.actualQty || 0), 0);
  const totalStocktakeDiffExcess = stocktakeRows.reduce((s, r) => s + (r.diffExcess || 0), 0);
  const totalStocktakeDiffShortage = stocktakeRows.reduce((s, r) => s + (r.diffShortage || 0), 0);

  // =========================================================================
  // STATE CHO FORM 1: GHI TĂNG CÔNG CỤ DỤNG CỤ (SINGLE - Ảnh 2 & 3)
  // =========================================================================
  const [singleSourceType, setSingleSourceType] = useState<
    "Lấy CCDC từ chứng từ xuất kho/mua hàng..." | "Lấy CCDC từ ghi giảm tài sản cố định"
  >("Lấy CCDC từ chứng từ xuất kho/mua hàng...");
  const [singleVoucherNo, setSingleVoucherNo] = useState("GTCC00001");
  const [singleVoucherDate, setSingleVoucherDate] = useState("30/09/2026");
  const [singleGroup, setSingleGroup] = useState("");
  const [singleToolCode, setSingleToolCode] = useState("");
  const [singleReason, setSingleReason] = useState("");
  const [singleToolName, setSingleToolName] = useState("");
  const [singleUnit, setSingleUnit] = useState("");
  const [singleQty, setSingleQty] = useState(1);
  const [singleAllocMonths, setSingleAllocMonths] = useState(1);
  const [singleMonthlyAlloc, setSingleMonthlyAlloc] = useState(0);
  const [singleCategory, setSingleCategory] = useState("");
  const [singlePrice, setSinglePrice] = useState(0);
  const [singleAmount, setSingleAmount] = useState(0);
  const [singleWaitingAcc, setSingleWaitingAcc] = useState("242");
  const [singleStopAlloc, setSingleStopAlloc] = useState(false);
  const [singleActiveTab, setSingleActiveTab] = useState<"dept" | "alloc" | "desc" | "origin">("dept");
  const [singleDeptRows, setSingleDeptRows] = useState([
    { id: "dept-1", code: "", name: "", qty: 0 },
  ]);

  // =========================================================================
  // STATE CHO FORM 2: GHI TĂNG CCDC HÀNG LOẠT (BATCH - Ảnh 4 & 5)
  // =========================================================================
  const [batchSourceType, setBatchSourceType] = useState<
    "Lấy CCDC từ chứng từ xuất kho/mua hàng..." | "Lấy CCDC từ ghi giảm tài sản cố định"
  >("Lấy CCDC từ chứng từ xuất kho/mua hàng...");
  const [batchRows, setBatchRows] = useState([
    {
      id: "b-1",
      code: "",
      name: "",
      category: "",
      group: "",
      reason: "",
      unit: "",
      qty: 1,
      price: 0,
      amount: 0,
      date: "30/09/2026",
      voucherNo: "GTCC00001",
    },
    {
      id: "b-2",
      code: "",
      name: "",
      category: "",
      group: "",
      reason: "",
      unit: "",
      qty: 0,
      price: 0,
      amount: 0,
      date: "30/09/2026",
      voucherNo: "GTCC00002",
    },
  ]);
  const [batchActiveTab, setBatchActiveTab] = useState<"dept" | "alloc">("dept");
  const [batchDeptRows, setBatchDeptRows] = useState([
    { id: "bdept-1", code: "", name: "", qty: 0 },
  ]);

  // =========================================================================
  // STATE CHO CHI PHÍ TRẢ TRƯỚC (3 Trang theo ảnh người dùng)
  // =========================================================================
  // =========================================================================
  // Subtab 1: Danh sách chi phí trả trước
  const [prepaidExpensesList, setPrepaidExpensesList] = useState(SAMPLE_PREPAID_EXPENSES);
  const [showPrepaidAddDropdown, setShowPrepaidAddDropdown] = useState(false);
  const [showPrepaidItemModal, setShowPrepaidItemModal] = useState(false);
  const [prepaidModalMode, setPrepaidModalMode] = useState<"new" | "opening">("new");
  const [showPrepaidExcelModal, setShowPrepaidExcelModal] = useState(false);
  const [prepaidFilterPeriod, setPrepaidFilterPeriod] = useState("Năm 2026");
  const [prepaidSearch, setPrepaidSearch] = useState("");

  // Form 1: Thêm chi phí trả trước (Ảnh 1)
  const [form1Code, setForm1Code] = useState("CPTT005");
  const [form1Name, setForm1Name] = useState("");
  const [form1AllocMonths, setForm1AllocMonths] = useState(2);
  const [form1StartDate, setForm1StartDate] = useState("30/09/2026");
  const [form1RecordDate, setForm1RecordDate] = useState("30/09/2026");
  const [form1Amount, setForm1Amount] = useState(0);
  const [form1WaitingAcc, setForm1WaitingAcc] = useState("242");
  const [form1StopAlloc, setForm1StopAlloc] = useState(false);
  const [form1Tab, setForm1Tab] = useState<"setup" | "docs">("setup");
  const [form1Rows, setForm1Rows] = useState([
    { id: "f1-1", targetCode: "", targetName: "", rate: 0, costAccount: "", costItem: "", statCode: "" },
  ]);

  // Form 2: Thêm chi phí trả trước đầu kỳ (Ảnh 2)
  const [form2Code, setForm2Code] = useState("CPTT006");
  const [form2Name, setForm2Name] = useState("");
  const [form2AllocMonths, setForm2AllocMonths] = useState(2);
  const [form2RemainingMonths, setForm2RemainingMonths] = useState(0);
  const [form2RecordDate, setForm2RecordDate] = useState("31/12/2025");
  const [form2Amount, setForm2Amount] = useState(0);
  const [form2AllocatedAmount, setForm2AllocatedAmount] = useState(0);
  const [form2RemainingAmount, setForm2RemainingAmount] = useState(0);
  const [form2MonthlyAlloc, setForm2MonthlyAlloc] = useState(0);
  const [form2WaitingAcc, setForm2WaitingAcc] = useState("242");
  const [form2StopAlloc, setForm2StopAlloc] = useState(false);
  const [form2Rows, setForm2Rows] = useState([
    { id: "f2-1", targetCode: "", targetName: "", rate: 0, costAccount: "", costItem: "", statCode: "" },
  ]);

  // Form 3: Nhập từ Excel (Ảnh 3)
  const [excelStep, setExcelStep] = useState(1);
  const [excelFileName, setExcelFileName] = useState("");
  const [excelSheet, setExcelSheet] = useState("Sheet1");
  const [excelHeaderRow, setExcelHeaderRow] = useState(1);
  const [excelAutoMap, setExcelAutoMap] = useState(true);

  // Subtab 2: Phân bổ chi phí trả trước
  const [prepaidAllocViewMode, setPrepaidAllocViewMode] = useState<"landing" | "list">("landing");
  const [showPrepaidDateModal, setShowPrepaidDateModal] = useState(false);
  const [prepaidAllocMonth, setPrepaidAllocMonth] = useState(3);
  const [prepaidAllocYear, setPrepaidAllocYear] = useState(2026);
  const [showPrepaidAllocVoucherModal, setShowPrepaidAllocVoucherModal] = useState(false);
  const [prepaidAllocVoucherNo, setPrepaidAllocVoucherNo] = useState("PBCP00003");
  const [prepaidAllocVoucherDate, setPrepaidAllocVoucherDate] = useState("31/03/2026");
  const [prepaidAllocReason, setPrepaidAllocReason] = useState("Phân bổ chi phí trả trước Tháng 03/2026");
  const [prepaidAllocTab, setPrepaidAllocTab] = useState<"allocTable" | "accounting">("allocTable");
  const [prepaidAllocFilterPeriod, setPrepaidAllocFilterPeriod] = useState("Năm 2026");
  const [prepaidAllocSearch, setPrepaidAllocSearch] = useState("");
  const [prepaidAllocVouchers, setPrepaidAllocVouchers] = useState([
    {
      voucherNo: "PBCP00001",
      voucherDate: "31/01/2026",
      period: "Tháng 01/2026",
      reason: "Phân bổ chi phí trả trước Tháng 01/2026",
      totalAmount: 43000000,
      status: "Đã ghi sổ",
    },
    {
      voucherNo: "PBCP00002",
      voucherDate: "28/02/2026",
      period: "Tháng 02/2026",
      reason: "Phân bổ chi phí trả trước Tháng 02/2026",
      totalAmount: 43000000,
      status: "Đã ghi sổ",
    },
  ]);

  // Subtab 3: Ghi giảm chi phí trả trước (Ảnh 4)
  const [prepaidDecreaseViewMode, setPrepaidDecreaseViewMode] = useState<"landing" | "list">("landing");
  const [showPrepaidDecreaseModal, setShowPrepaidDecreaseModal] = useState(false);
  const [prepaidDecreaseVoucherNo, setPrepaidDecreaseVoucherNo] = useState("GGCP00001");
  const [prepaidDecreaseVoucherDate, setPrepaidDecreaseVoucherDate] = useState("30/09/2026");
  const [prepaidDecreaseReason, setPrepaidDecreaseReason] = useState("");
  const [prepaidDecreaseDetailRows, setPrepaidDecreaseDetailRows] = useState([
    { id: "dec-1", code: "CPTT001", name: "Chi phí thuê văn phòng làm việc Trụ sở Quý 3/2026", remainingAmount: 60000000 },
  ]);
  const [prepaidDecreaseFilterPeriod, setPrepaidDecreaseFilterPeriod] = useState("Năm 2026");
  const [prepaidDecreaseSearch, setPrepaidDecreaseSearch] = useState("");
  const [prepaidDecreaseVouchers, setPrepaidDecreaseVouchers] = useState([
    {
      voucherNo: "GGCP00001",
      voucherDate: "30/09/2026",
      reason: "Ngừng phân bổ ngắn hạn do chấm dứt hợp đồng thuê sớm",
      totalAmount: 60000000,
      itemCount: 1,
      status: "Đã ghi sổ",
    },
  ]);

  const toggleFavorite = (reportName: string) => {
    if (favoriteReports.includes(reportName)) {
      setFavoriteReports(favoriteReports.filter((r) => r !== reportName));
      notify(`Đã bỏ báo cáo "${reportName}" khỏi mục yêu thích`);
    } else {
      setFavoriteReports([...favoriteReports, reportName]);
      notify(`Đã thêm báo cáo "${reportName}" vào mục yêu thích`);
    }
  };

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Helper sinh mã CCDC
  const handleGenerateBatchCodes = () => {
    setBatchRows((prev) =>
      prev.map((r, i) => ({
        ...r,
        code: r.code || `CCDC${String(i + 1).padStart(4, "0")}`,
      }))
    );
    notify("Đã tự động sinh mã CCDC cho tất cả các dòng");
  };

  // Helper sinh số CT ghi tăng
  const handleGenerateBatchVouchers = () => {
    setBatchRows((prev) =>
      prev.map((r, i) => ({
        ...r,
        voucherNo: `GTCC${String(i + 1).padStart(5, "0")}`,
      }))
    );
    notify("Đã tự động sinh số chứng từ ghi tăng liên tiếp");
  };

  // =========================================================================
  // RENDER MODALS
  // =========================================================================
  const renderModals = () => (
    <>
      {/* 1. MODAL GHI TĂNG CÔNG CỤ DỤNG CỤ (SINGLE - Ảnh 2 & 3) */}
      {showSingleAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1300,
              height: "92vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header: Title, Source Dropdown, Button Chọn chứng từ, Help, Close */}
            <div
              style={{
                height: 44,
                background: "#ffffff",
                borderBottom: "1px solid #cbd5e1",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Lịch sử chứng từ"
                  onClick={() => notify("Lịch sử chứng từ Ghi tăng CCDC")}
                  style={{ width: 26, height: 26, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
                >
                  <RotateCcw size={14} />
                </button>

                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                  Ghi tăng công cụ dụng cụ {singleVoucherNo || "GTCC00001"}
                </h2>

                {/* Source Selection Dropdown (2 options) */}
                <select
                  value={singleSourceType}
                  onChange={(e) => setSingleSourceType(e.target.value as any)}
                  style={{
                    height: 28,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    color: "#334155",
                    background: "#ffffff",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="Lấy CCDC từ chứng từ xuất kho/mua hàng...">
                    Lấy CCDC từ chứng từ xuất kho/mua hàng...
                  </option>
                  <option value="Lấy CCDC từ ghi giảm tài sản cố định">
                    Lấy CCDC từ ghi giảm tài sản cố định
                  </option>
                </select>

                {/* Button: Chọn chứng từ */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectVoucherTarget("single");
                    setShowSelectVoucherModal(true);
                  }}
                  style={{
                    height: 28,
                    padding: "0 14px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#1e293b",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  Chọn chứng từ
                </button>
              </div>

              {/* Right: Help & Close */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" title="Hướng dẫn" style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <HelpCircle size={17} />
                </button>
                <button type="button" title="Đóng" onClick={() => setShowSingleAddModal(false)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form Fields Section (Matches Image 2 & 3) */}
            <div style={{ padding: "12px 20px 14px 20px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", flexShrink: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                
                {/* Row 1: Số CT ghi tăng *, Ngày ghi tăng *, Nhóm CCDC */}
                <div style={{ display: "grid", gridTemplateColumns: "180px 180px 320px 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>
                      Số CT ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={singleVoucherNo}
                      onChange={(e) => setSingleVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 26, border: "1px solid #00a862", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>
                      Ngày ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                      <input
                        type="text"
                        value={singleVoucherDate}
                        onChange={(e) => setSingleVoucherDate(e.target.value)}
                        style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                      />
                      <Calendar size={13} style={{ color: "#64748b" }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Nhóm CCDC</label>
                    <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                      <input
                        type="text"
                        value={singleGroup}
                        onChange={(e) => setSingleGroup(e.target.value)}
                        style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                      />
                      <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Mã CCDC *, Lý do ghi tăng */}
                <div style={{ display: "grid", gridTemplateColumns: "374px 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>
                      Mã CCDC <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={singleToolCode}
                      onChange={(e) => setSingleToolCode(e.target.value)}
                      style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Lý do ghi tăng</label>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 26 }}>
                      <input
                        type="text"
                        value={singleReason}
                        onChange={(e) => setSingleReason(e.target.value)}
                        style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                      />
                      <span title="AVA gợi ý diễn giải" style={{ display: "inline-flex" }}>
                        <Sparkles size={13} style={{ color: "#a855f7", cursor: "pointer" }} />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Tên CCDC *, Đơn vị tính, Số lượng, Số kỳ phân bổ *, Số tiền PB hàng kỳ */}
                <div style={{ display: "grid", gridTemplateColumns: "374px 140px 140px 140px 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>
                      Tên CCDC <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={singleToolName}
                      onChange={(e) => setSingleToolName(e.target.value)}
                      style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Đơn vị tính</label>
                    <input
                      type="text"
                      value={singleUnit}
                      onChange={(e) => setSingleUnit(e.target.value)}
                      style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Số lượng</label>
                    <input
                      type="number"
                      value={singleQty}
                      onChange={(e) => {
                        const q = Number(e.target.value) || 0;
                        setSingleQty(q);
                        const tot = q * singlePrice;
                        setSingleAmount(tot);
                        if (singleAllocMonths > 0) setSingleMonthlyAlloc(Math.round(tot / singleAllocMonths));
                      }}
                      style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>
                      Số kỳ phân bổ <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="number"
                      value={singleAllocMonths}
                      onChange={(e) => {
                        const m = Number(e.target.value) || 1;
                        setSingleAllocMonths(m);
                        if (m > 0) setSingleMonthlyAlloc(Math.round(singleAmount / m));
                      }}
                      style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Số tiền PB hàng kỳ</label>
                    <input
                      type="text"
                      readOnly
                      value={singleMonthlyAlloc.toLocaleString("vi-VN")}
                      style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, textAlign: "right", background: "#f8fafc", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Row 4: Loại CCDC (+), Đơn giá, Thành tiền, TK chờ phân bổ, Checkbox Ngừng phân bổ */}
                <div style={{ display: "grid", gridTemplateColumns: "374px 140px 140px 140px 1fr", gap: 14, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Loại CCDC</label>
                    <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                      <input
                        type="text"
                        value={singleCategory}
                        onChange={(e) => setSingleCategory(e.target.value)}
                        style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                      />
                      <button type="button" onClick={() => notify("Thêm loại CCDC mới")} style={{ width: 22, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <Plus size={12} />
                      </button>
                      <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Đơn giá</label>
                    <input
                      type="number"
                      value={singlePrice}
                      onChange={(e) => {
                        const p = Number(e.target.value) || 0;
                        setSinglePrice(p);
                        const tot = p * singleQty;
                        setSingleAmount(tot);
                        if (singleAllocMonths > 0) setSingleMonthlyAlloc(Math.round(tot / singleAllocMonths));
                      }}
                      style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Thành tiền</label>
                    <input
                      type="number"
                      value={singleAmount}
                      onChange={(e) => {
                        const a = Number(e.target.value) || 0;
                        setSingleAmount(a);
                        if (singleAllocMonths > 0) setSingleMonthlyAlloc(Math.round(a / singleAllocMonths));
                      }}
                      style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>TK chờ phân bổ</label>
                    <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                      <input
                        type="text"
                        value={singleWaitingAcc}
                        onChange={(e) => setSingleWaitingAcc(e.target.value)}
                        style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, textAlign: "center", outline: "none" }}
                      />
                      <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </div>

                  <div style={{ paddingBottom: 4 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={singleStopAlloc}
                        onChange={(e) => setSingleStopAlloc(e.target.checked)}
                      />
                      <span>Ngừng phân bổ</span>
                    </label>
                  </div>
                </div>

              </div>
            </div>

            {/* Sub-tabs: Đơn vị sử dụng | Thiết lập phân bổ | Mô tả chi tiết | Nguồn gốc hình thành */}
            <div style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", display: "flex", alignItems: "center", padding: "0 16px", gap: 24, flexShrink: 0 }}>
              {[
                { id: "dept", label: "Đơn vị sử dụng" },
                { id: "alloc", label: "Thiết lập phân bổ" },
                { id: "desc", label: "Mô tả chi tiết" },
                { id: "origin", label: "Nguồn gốc hình thành" },
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSingleActiveTab(t.id as any)}
                  style={{
                    padding: "8px 2px",
                    fontSize: 12.5,
                    fontWeight: singleActiveTab === t.id ? 700 : 500,
                    color: singleActiveTab === t.id ? "#00a862" : "#475569",
                    borderBottom: singleActiveTab === t.id ? "2.5px solid #00a862" : "2.5px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>

            {/* Sub-tab Content Table */}
            <div style={{ flex: 1, overflow: "auto", background: "#ffffff", padding: "10px 16px" }}>
              {singleActiveTab === "dept" && (
                <div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #cbd5e1" }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th style={{ width: 180, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã đơn vị</th>
                        <th style={{ minWidth: 260, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên đơn vị</th>
                        <th style={{ width: 140, padding: "6px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                        <th style={{ width: 36, padding: "6px 4px", textAlign: "center" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {singleDeptRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "6px 4px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={row.code}
                              placeholder="Chọn đơn vị..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setSingleDeptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, code: val } : r)));
                              }}
                              style={{ width: "100%", height: 24, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                            />
                          </td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={row.name}
                              placeholder="Tên đơn vị sử dụng..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setSingleDeptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: val } : r)));
                              }}
                              style={{ width: "100%", height: 24, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                            />
                          </td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="number"
                              value={row.qty}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setSingleDeptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: val } : r)));
                              }}
                              style={{ width: "100%", height: 24, border: "1px solid transparent", textAlign: "right", outline: "none", fontSize: 12 }}
                            />
                          </td>
                          <td style={{ textAlign: "center", padding: "4px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (singleDeptRows.length > 1) {
                                  setSingleDeptRows((prev) => prev.filter((_, i) => i !== idx));
                                } else {
                                  setSingleDeptRows([{ id: `dept-${Date.now()}`, code: "", name: "", qty: 0 }]);
                                }
                              }}
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Summary Row */}
                      <tr style={{ background: "#ffffff", borderTop: "1px solid #cbd5e1", fontWeight: 700 }}>
                        <td colSpan={3} style={{ borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                          {singleDeptRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Table Buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setSingleDeptRows((prev) => [...prev, { id: `dept-${Date.now()}`, code: "", name: "", qty: 1 }])}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                    >
                      <Plus size={12} />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleDeptRows([{ id: `dept-${Date.now()}`, code: "", name: "", qty: 0 }])}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                    >
                      <Trash2 size={12} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              )}

              {singleActiveTab !== "dept" && (
                <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  <span>Tính năng {singleActiveTab} đang được kích hoạt và đồng bộ theo chứng từ CCDC.</span>
                </div>
              )}
            </div>

            {/* Modal Footer: Hủy & Ghi tăng */}
            <div style={{ height: 46, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 16px", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowSingleAddModal(false)}
                style={{ height: 28, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 12.5, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!singleToolCode.trim() && !singleToolName.trim()) {
                    notify("Vui lòng nhập Mã và Tên công cụ dụng cụ!");
                    return;
                  }
                  notify(`Đã ghi tăng thành công CCDC: ${singleToolCode || "CCDC007"} - ${singleToolName || "Công cụ dụng cụ mới"}`);
                  setShowSingleAddModal(false);
                }}
                style={{ height: 28, padding: "0 18px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                Ghi tăng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL GHI TĂNG CCDC HÀNG LOẠT (BATCH - Ảnh 4 & 5) */}
      {showBatchAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1340,
              height: "92vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header: Title, Source Dropdown, Button Chọn chứng từ, Help, Close */}
            <div
              style={{
                height: 44,
                background: "#ffffff",
                borderBottom: "1px solid #cbd5e1",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Lịch sử chứng từ"
                  onClick={() => notify("Lịch sử chứng từ Ghi tăng CCDC hàng loạt")}
                  style={{ width: 26, height: 26, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
                >
                  <RotateCcw size={14} />
                </button>

                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                  Ghi tăng CCDC hàng loạt
                </h2>

                {/* Source Selection Dropdown (2 options) */}
                <select
                  value={batchSourceType}
                  onChange={(e) => setBatchSourceType(e.target.value as any)}
                  style={{
                    height: 28,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    color: "#334155",
                    background: "#ffffff",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="Lấy CCDC từ chứng từ xuất kho/mua hàng...">
                    Lấy CCDC từ chứng từ xuất kho/mua hàng...
                  </option>
                  <option value="Lấy CCDC từ ghi giảm tài sản cố định">
                    Lấy CCDC từ ghi giảm tài sản cố định
                  </option>
                </select>

                {/* Button: Chọn chứng từ */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectVoucherTarget("batch");
                    setShowSelectVoucherModal(true);
                  }}
                  style={{
                    height: 28,
                    padding: "0 14px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#1e293b",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  Chọn chứng từ
                </button>
              </div>

              {/* Right: Help & Close */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" title="Hướng dẫn" style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <HelpCircle size={17} />
                </button>
                <button type="button" title="Đóng" onClick={() => setShowBatchAddModal(false)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* TOP TABLE AREA: Grid of multiple CCDC to create in batch (Matches Image 4 & 5) */}
            <div style={{ flex: 1, minHeight: 220, overflow: "auto", background: "#ffffff", padding: "10px 16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: "1px solid #cbd5e1" }}>
                <thead>
                  <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                    <th style={{ width: 32, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                    <th style={{ width: 110, padding: "6px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã CCDC</th>
                    <th style={{ minWidth: 160, padding: "6px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên CCDC</th>
                    <th style={{ width: 130, padding: "6px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Loại CCDC</th>
                    <th style={{ width: 110, padding: "6px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Nhóm CCDC</th>
                    <th style={{ minWidth: 160, padding: "6px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do ghi tăng</th>
                    <th style={{ width: 60, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                    <th style={{ width: 70, padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                    <th style={{ width: 90, padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đơn giá</th>
                    <th style={{ width: 100, padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Thành tiền</th>
                    <th style={{ width: 90, padding: "6px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày ghi tăng</th>
                    <th style={{ width: 100, padding: "6px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số CT ghi tăng</th>
                    <th style={{ width: 32, padding: "6px 2px", textAlign: "center" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ textAlign: "center", padding: "4px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <input
                          type="text"
                          value={row.code}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, code: val } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: val } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <select
                          value={row.category}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, category: val } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "none", outline: "none", fontSize: 12, background: "transparent" }}
                        >
                          <option value="">-- Chọn --</option>
                          <option value="Thiết bị văn phòng">Thiết bị văn phòng</option>
                          <option value="Máy móc thiết bị">Máy móc thiết bị</option>
                          <option value="Dụng cụ chuyên dùng">Dụng cụ chuyên dùng</option>
                          <option value="Nội thất văn phòng">Nội thất văn phòng</option>
                        </select>
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <input
                          type="text"
                          value={row.group}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, group: val } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <input
                          type="text"
                          value={row.reason}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, reason: val } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", textAlign: "center", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => {
                            const q = Number(e.target.value) || 0;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: q, amount: q * r.price } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", textAlign: "right", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <input
                          type="number"
                          value={row.price}
                          onChange={(e) => {
                            const p = Number(e.target.value) || 0;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, price: p, amount: p * r.qty } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", textAlign: "right", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 500 }}>
                        {row.amount?.toLocaleString("vi-VN") || 0}
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                        <input
                          type="text"
                          value={row.date}
                          onChange={(e) => {
                            const d = e.target.value;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, date: d } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", textAlign: "center", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", borderRight: "1px solid #e2e8f0" }}>
                        <input
                          type="text"
                          value={row.voucherNo}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBatchRows((prev) => prev.map((r, i) => (i === idx ? { ...r, voucherNo: v } : r)));
                          }}
                          style={{ width: "100%", height: 24, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ textAlign: "center", padding: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (batchRows.length > 1) {
                              setBatchRows((prev) => prev.filter((_, i) => i !== idx));
                            }
                          }}
                          style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Summary Row */}
                  <tr style={{ background: "#ffffff", borderTop: "1px solid #cbd5e1", fontWeight: 700 }}>
                    <td colSpan={7} style={{ padding: "6px 8px", textAlign: "left", borderRight: "1px solid #e2e8f0" }}>
                      Tổng
                    </td>
                    <td style={{ padding: "6px 4px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                      {batchRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                    </td>
                    <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                    <td style={{ padding: "6px 4px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                      {batchRows.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString("vi-VN")}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>

              {/* Action Buttons under Top Table */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    const newIdx = batchRows.length + 1;
                    setBatchRows((prev) => [
                      ...prev,
                      {
                        id: `b-${Date.now()}`,
                        code: "",
                        name: "",
                        category: "",
                        group: "",
                        reason: "",
                        unit: "",
                        qty: 1,
                        price: 0,
                        amount: 0,
                        date: "30/09/2026",
                        voucherNo: `GTCC${String(newIdx).padStart(5, "0")}`,
                      },
                    ]);
                  }}
                  style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                >
                  <Plus size={12} />
                  <span>Thêm dòng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBatchRows([
                      {
                        id: `b-${Date.now()}`,
                        code: "",
                        name: "",
                        category: "",
                        group: "",
                        reason: "",
                        unit: "",
                        qty: 1,
                        price: 0,
                        amount: 0,
                        date: "30/09/2026",
                        voucherNo: "GTCC00001",
                      },
                    ]);
                  }}
                  style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                >
                  <Trash2 size={12} />
                  <span>Xóa hết dòng</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateBatchCodes}
                  style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#00a862", fontWeight: 500 }}
                >
                  <Plus size={12} />
                  <span>Sinh mã CCDC</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateBatchVouchers}
                  style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#00a862", fontWeight: 500 }}
                >
                  <Plus size={12} />
                  <span>Sinh số CT ghi tăng</span>
                </button>
              </div>
            </div>

            {/* BOTTOM SECTION: TABS & DETAIL TABLE (Matches Image 4 & 5) */}
            <div style={{ height: 200, borderTop: "2px solid #cbd5e1", display: "flex", flexDirection: "column", background: "#ffffff", flexShrink: 0 }}>
              <div style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", display: "flex", alignItems: "center", padding: "0 16px", gap: 24 }}>
                {[
                  { id: "dept", label: "Đơn vị sử dụng" },
                  { id: "alloc", label: "Thiết lập phân bổ" },
                ].map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setBatchActiveTab(t.id as any)}
                    style={{
                      padding: "8px 2px",
                      fontSize: 12.5,
                      fontWeight: batchActiveTab === t.id ? 700 : 500,
                      color: batchActiveTab === t.id ? "#00a862" : "#475569",
                      borderBottom: batchActiveTab === t.id ? "2.5px solid #00a862" : "2.5px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, overflow: "auto", padding: "10px 16px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 180, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã đơn vị</th>
                      <th style={{ minWidth: 260, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên đơn vị</th>
                      <th style={{ width: 140, padding: "6px 8px", textAlign: "right" }}>Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchDeptRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.code}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchDeptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, code: val } : r)));
                            }}
                            style={{ width: "100%", height: 22, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchDeptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: val } : r)));
                            }}
                            style={{ width: "100%", height: 22, border: "1px solid transparent", outline: "none", fontSize: 12 }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px" }}>
                          <input
                            type="number"
                            value={row.qty}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setBatchDeptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: val } : r)));
                            }}
                            style={{ width: "100%", height: 22, border: "1px solid transparent", textAlign: "right", outline: "none", fontSize: 12 }}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: "#ffffff", borderTop: "1px solid #cbd5e1", fontWeight: 700 }}>
                      <td colSpan={3} style={{ borderRight: "1px solid #e2e8f0" }}></td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {batchDeptRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Table Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setBatchDeptRows((prev) => [...prev, { id: `bdept-${Date.now()}`, code: "", name: "", qty: 1 }])}
                    style={{ height: 24, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                  >
                    <Plus size={12} />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchDeptRows([{ id: `bdept-${Date.now()}`, code: "", name: "", qty: 0 }])}
                    style={{ height: 24, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                  >
                    <Trash2 size={12} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer: Hủy & Ghi tăng */}
            <div style={{ height: 46, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 16px", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowBatchAddModal(false)}
                style={{ height: 28, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 12.5, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã ghi tăng hàng loạt thành công ${batchRows.filter((r) => r.name || r.code).length || batchRows.length} CCDC vào sổ`);
                  setShowBatchAddModal(false);
                }}
                style={{ height: 28, padding: "0 18px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                Ghi tăng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUB-MODAL CHỌN CHỨNG TỪ (TỪ XUẤT KHO / MUA HÀNG HOẶC TỪ GHI GIẢM TSCĐ) */}
      {showSelectVoucherModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1100,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 880,
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 42,
                background: "#00a862",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px",
              }}
            >
              <strong style={{ fontSize: 14 }}>
                {selectVoucherTarget === "single"
                  ? singleSourceType === "Lấy CCDC từ chứng từ xuất kho/mua hàng..."
                    ? "Chọn chứng từ xuất kho / mua hàng để ghi tăng CCDC"
                    : "Chọn chứng từ ghi giảm tài sản cố định để chuyển CCDC"
                  : batchSourceType === "Lấy CCDC từ chứng từ xuất kho/mua hàng..."
                  ? "Chọn các chứng từ xuất kho / mua hàng để ghi tăng hàng loạt"
                  : "Chọn các chứng từ ghi giảm TSCĐ để ghi tăng hàng loạt"}
              </strong>
              <button
                type="button"
                onClick={() => setShowSelectVoucherModal(false)}
                style={{ border: "none", background: "transparent", color: "#ffffff", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter toolbar */}
            <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 16, fontSize: 12.5, color: "#475569" }}>
              <span>Từ ngày: <strong>01/09/2026</strong></span>
              <span>Đến ngày: <strong>30/09/2026</strong></span>
              <span>Kỳ tính: <strong>Tháng 9/2026</strong></span>
            </div>

            {/* List Table */}
            <div style={{ padding: "14px 16px", maxHeight: "55vh", overflowY: "auto" }}>
              {((selectVoucherTarget === "single" && singleSourceType === "Lấy CCDC từ chứng từ xuất kho/mua hàng...") ||
                (selectVoucherTarget === "batch" && batchSourceType === "Lấy CCDC từ chứng từ xuất kho/mua hàng...")) ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Chọn</th>
                      <th style={{ width: 90, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                      <th style={{ width: 80, padding: "6px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày CT</th>
                      <th style={{ width: 90, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Loại CT</th>
                      <th style={{ minWidth: 180, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên mặt hàng/CCDC</th>
                      <th style={{ width: 50, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                      <th style={{ width: 60, padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>SL</th>
                      <th style={{ width: 90, padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đơn giá</th>
                      <th style={{ width: 100, padding: "6px 6px", textAlign: "right" }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_SOURCE_VOUCHERS_INVENTORY_PURCHASE.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => {
                          if (selectVoucherTarget === "single") {
                            setSingleToolCode(v.itemCode);
                            setSingleToolName(v.itemName);
                            setSingleUnit(v.unit);
                            setSingleQty(v.qty);
                            setSinglePrice(v.price);
                            setSingleAmount(v.amount);
                            setSingleCategory(v.category);
                            setSingleGroup(v.group);
                            setSingleReason(v.reason);
                            setSingleAllocMonths(12);
                            setSingleMonthlyAlloc(Math.round(v.amount / 12));
                            notify(`Đã nạp dữ liệu từ chứng từ ${v.voucherNo} vào form ghi tăng CCDC`);
                          } else {
                            setBatchRows((prev) => [
                              ...prev,
                              {
                                id: `b-${Date.now()}`,
                                code: v.itemCode,
                                name: v.itemName,
                                category: v.category,
                                group: v.group,
                                reason: v.reason,
                                unit: v.unit,
                                qty: v.qty,
                                price: v.price,
                                amount: v.amount,
                                date: "30/09/2026",
                                voucherNo: `GTCC0000${prev.length + 1}`,
                              },
                            ]);
                            notify(`Đã thêm dòng chứng từ ${v.voucherNo} vào bảng ghi tăng hàng loạt`);
                          }
                          setShowSelectVoucherModal(false);
                        }}
                        style={{ borderBottom: "1px solid #e2e8f0", cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                      >
                        <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0" }}>
                          <Check size={14} style={{ color: "#00a862" }} />
                        </td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{v.voucherNo}</td>
                        <td style={{ padding: "6px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.voucherDate}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.type}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 500 }}>{v.itemName}</td>
                        <td style={{ padding: "6px 4px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.unit}</td>
                        <td style={{ padding: "6px 6px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{v.qty}</td>
                        <td style={{ padding: "6px 6px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{formatVND(v.price)}</td>
                        <td style={{ padding: "6px 6px", textAlign: "right", fontWeight: 600 }}>{formatVND(v.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Chọn</th>
                      <th style={{ width: 100, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số CT ghi giảm</th>
                      <th style={{ width: 80, padding: "6px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày CT</th>
                      <th style={{ minWidth: 200, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên TSCĐ ghi giảm sang CCDC</th>
                      <th style={{ width: 60, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                      <th style={{ width: 60, padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>SL</th>
                      <th style={{ width: 120, padding: "6px 6px", textAlign: "right" }}>Giá trị còn lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_SOURCE_VOUCHERS_ASSET_DECREASE.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => {
                          if (selectVoucherTarget === "single") {
                            setSingleToolCode(v.itemCode);
                            setSingleToolName(v.itemName);
                            setSingleUnit(v.unit);
                            setSingleQty(v.qty);
                            setSinglePrice(v.price);
                            setSingleAmount(v.amount);
                            setSingleCategory(v.category);
                            setSingleGroup(v.group);
                            setSingleReason(v.reason);
                            setSingleAllocMonths(24);
                            setSingleMonthlyAlloc(Math.round(v.amount / 24));
                            notify(`Đã nạp dữ liệu từ chứng từ ghi giảm TSCĐ ${v.voucherNo} vào form ghi tăng CCDC`);
                          } else {
                            setBatchRows((prev) => [
                              ...prev,
                              {
                                id: `b-${Date.now()}`,
                                code: v.itemCode,
                                name: v.itemName,
                                category: v.category,
                                group: v.group,
                                reason: v.reason,
                                unit: v.unit,
                                qty: v.qty,
                                price: v.price,
                                amount: v.amount,
                                date: "30/09/2026",
                                voucherNo: `GTCC0000${prev.length + 1}`,
                              },
                            ]);
                            notify(`Đã thêm dòng chứng từ ghi giảm TSCĐ ${v.voucherNo} vào bảng ghi tăng hàng loạt`);
                          }
                          setShowSelectVoucherModal(false);
                        }}
                        style={{ borderBottom: "1px solid #e2e8f0", cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                      >
                        <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0" }}>
                          <Check size={14} style={{ color: "#00a862" }} />
                        </td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{v.voucherNo}</td>
                        <td style={{ padding: "6px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.voucherDate}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 500 }}>{v.itemName}</td>
                        <td style={{ padding: "6px 4px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.unit}</td>
                        <td style={{ padding: "6px 6px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{v.qty}</td>
                        <td style={{ padding: "6px 6px", textAlign: "right", fontWeight: 600 }}>{formatVND(v.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div style={{ height: 44, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 16px" }}>
              <button
                type="button"
                onClick={() => setShowSelectVoucherModal(false)}
                style={{ height: 28, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, cursor: "pointer", color: "#475569" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL XEM TRƯỚC BÁO CÁO CÔNG CỤ DỤNG CỤ */}
      {selectedReportForPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 960,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              maxHeight: "90vh",
            }}
          >
            <div
              style={{
                height: 48,
                background: "#00a862",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15 }}>
                <FileSpreadsheet size={18} />
                <span>{selectedReportForPreview}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportForPreview(null)}
                style={{ border: "none", background: "transparent", color: "#ffffff", cursor: "pointer", display: "grid", placeItems: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "10px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "#475569" }}>
                <span>Kỳ báo cáo: <strong>Tháng 09/2026</strong></span>
                <span>|</span>
                <span>Từ ngày <strong>01/09/2026</strong> đến <strong>30/09/2026</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => notify("Đang xuất báo cáo ra file Excel...")}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#16a34a", fontWeight: 600 }}
                >
                  <Download size={13} />
                  <span>Xuất Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => notify("Đang nạp dữ liệu in báo cáo...")}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#475569" }}
                >
                  <Printer size={13} />
                  <span>In</span>
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>
                  {selectedReportForPreview}
                </h3>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>Kỳ tính: Tháng 09/2026 - Đơn vị tính: VNĐ</span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: "1px solid #cbd5e1" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                    <th style={{ padding: "8px 6px", borderRight: "1px solid #cbd5e1", width: 36, textAlign: "center" }}>STT</th>
                    <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "left" }}>Mã CCDC</th>
                    <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "left" }}>Tên CCDC</th>
                    <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "left" }}>Đơn vị sử dụng</th>
                    <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>Nguyên giá</th>
                    <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>Đã phân bổ</th>
                    <th style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>Phân bổ kỳ này</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>Giá trị còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_TOOLS_DATA.map((item, idx) => {
                    const monthlyAllocation = Math.round(item.originalCost / item.allocationMonths);
                    return (
                      <tr key={item.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0" }}>{item.name}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{item.dept}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{formatVND(item.originalCost)}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{formatVND(item.allocatedAmount)}</td>
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{formatVND(monthlyAllocation)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{formatVND(item.remainingAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ height: 44, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 18px" }}>
              <button
                type="button"
                onClick={() => setSelectedReportForPreview(null)}
                style={{ height: 28, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, cursor: "pointer", color: "#475569" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODALS CƠ CẤU TỔ CHỨC / LOẠI CCDC / TÙY CHỌN */}
      {showOrgTreeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", display: "grid", placeItems: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ width: 560, background: "#ffffff", borderRadius: 8, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <div style={{ height: 44, background: "#00a862", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
              <strong style={{ fontSize: 14 }}>Cơ cấu tổ chức sử dụng CCDC</strong>
              <button type="button" onClick={() => setShowOrgTreeModal(false)} style={{ border: "none", background: "transparent", color: "#ffffff", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 18, fontSize: 13, color: "#334155" }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 12, background: "#f8fafc", display: "flex", flexDirection: "column", gap: 8 }}>
                <div>🏢 <strong>Công ty Cổ phần Minh An</strong></div>
                <div style={{ paddingLeft: 20 }}>📁 Khối Văn phòng (Phòng Kế toán, Phòng Hành chính - Nhân sự, Phòng Kinh doanh)</div>
                <div style={{ paddingLeft: 20 }}>🏭 Khối Sản xuất (Phân xưởng Kỹ thuật cơ điện, Xưởng Sản xuất Tủ bảng điện)</div>
                <div style={{ paddingLeft: 20 }}>🚚 Khối Kho vận (Tổng kho Logistics, Đội Bảo vệ & An ninh)</div>
              </div>
            </div>
            <div style={{ height: 42, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "0 16px" }}>
              <button type="button" onClick={() => setShowOrgTreeModal(false)} style={{ height: 28, padding: "0 14px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer", fontSize: 12 }}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", display: "grid", placeItems: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ width: 560, background: "#ffffff", borderRadius: 8, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <div style={{ height: 44, background: "#00a862", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
              <strong style={{ fontSize: 14 }}>Danh mục loại công cụ dụng cụ</strong>
              <button type="button" onClick={() => setShowCategoryModal(false)} style={{ border: "none", background: "transparent", color: "#ffffff", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 18, fontSize: 13, color: "#334155" }}>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <li><strong>Thiết bị văn phòng:</strong> Máy tính, máy in, máy chiếu, máy scan...</li>
                <li><strong>Máy móc thiết bị:</strong> Máy nén khí, máy khoan bàn, máy hàn điện...</li>
                <li><strong>Nội thất văn phòng:</strong> Bàn làm việc, ghế lưới, tủ tài liệu...</li>
                <li><strong>Dụng cụ chuyên dùng:</strong> Máy hàn quang, đồng hồ vạn năng, máy dò cáp...</li>
                <li><strong>Dụng cụ quản lý:</strong> Bộ đàm, camera giám sát, bảng biểu điều hành...</li>
              </ul>
            </div>
            <div style={{ height: 42, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "0 16px" }}>
              <button type="button" onClick={() => setShowCategoryModal(false)} style={{ height: 28, padding: "0 14px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer", fontSize: 12 }}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {showOptionsModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", display: "grid", placeItems: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ width: 520, background: "#ffffff", borderRadius: 8, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <div style={{ height: 44, background: "#00a862", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
              <strong style={{ fontSize: 14 }}>Tùy chọn thiết lập phân hệ CCDC</strong>
              <button type="button" onClick={() => setShowOptionsModal(false)} style={{ border: "none", background: "transparent", color: "#ffffff", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 18, fontSize: 12.5, color: "#334155", display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" defaultChecked />
                <span>Tự động tạo bút toán phân bổ CCDC vào ngày cuối tháng (Nợ 642, 627 / Có 242)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" defaultChecked />
                <span>Cho phép phân bổ nhiều kỳ (tối đa 36 tháng theo Thông tư 200/TT-BTC)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" defaultChecked />
                <span>Cảnh báo khi giá trị CCDC vượt mức 30.000.000đ (đủ điều kiện ghi nhận TSCĐ)</span>
              </label>
            </div>
            <div style={{ height: 42, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "0 16px" }}>
              <button type="button" onClick={() => setShowOptionsModal(false)} style={{ height: 28, padding: "0 14px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer", fontSize: 12 }}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL CHỌN KỲ PHÂN BỔ CHI PHÍ CCDC (Ảnh 2 của user) */}
      {showSelectPeriodModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 430,
              background: "#ffffff",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            {/* Header: Chọn kỳ phân bổ chi phí CCDC, ?, X */}
            <div
              style={{
                padding: "16px 20px 12px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Chọn kỳ phân bổ chi phí CCDC
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Hướng dẫn"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: 2,
                  }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSelectPeriodModal(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: 2,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body: Tháng * & Năm */}
            <div style={{ padding: "10px 20px 24px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#1e293b", marginBottom: 6 }}>
                  Tháng <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={allocationMonth}
                    onChange={(e) => setAllocationMonth(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 28px 0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      outline: "none",
                      appearance: "none",
                      color: "#1e293b",
                      cursor: "pointer",
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748b",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#1e293b", marginBottom: 6 }}>
                  Năm
                </label>
                <input
                  type="number"
                  value={allocationYear}
                  onChange={(e) => setAllocationYear(Number(e.target.value))}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    background: "#ffffff",
                    outline: "none",
                    color: "#1e293b",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Footer: Hủy & Đồng ý */}
            <div
              style={{
                padding: "12px 20px 16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                type="button"
                onClick={() => setShowSelectPeriodModal(false)}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
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
                  setShowSelectPeriodModal(false);
                  const nextIndex = allocationVouchers.length + 1;
                  const newNo = `PBCC${String(nextIndex).padStart(5, "0")}`;
                  const monthStr = String(allocationMonth).padStart(2, "0");
                  const dateStr = `30/${monthStr}/${allocationYear}`;
                  setAllocationVoucherNo(newNo);
                  setAllocationPostingDate(dateStr);
                  setAllocationVoucherDate(dateStr);
                  setAllocationReason(`Phân bổ chi phí CCDC tháng ${allocationMonth} năm ${allocationYear}`);
                  setShowAllocationVoucherModal(true);
                }}
                style={{
                  height: 32,
                  padding: "0 22px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL CHỨNG TỪ PHÂN BỔ CHI PHÍ CCDC (Chi tiết & Hạch toán) */}
      {showAllocationVoucherModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 12,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1250,
              height: "92vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 48,
                background: "#00a862",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 18px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  Chứng từ phân bổ chi phí CCDC: {allocationVoucherNo} - Tháng {allocationMonth}/{allocationYear}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    background: "rgba(255,255,255,0.2)",
                    padding: "2px 8px",
                    borderRadius: 10,
                  }}
                >
                  Kỳ tính: {allocationMonth}/{allocationYear}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  title="Hướng dẫn"
                  style={{ border: "none", background: "transparent", color: "#ffffff", cursor: "pointer" }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllocationVoucherModal(false)}
                  style={{ border: "none", background: "transparent", color: "#ffffff", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* General Info Card */}
            <div
              style={{
                padding: "14px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "140px 140px 140px 1fr 220px",
                gap: 16,
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>
                  Ngày hạch toán
                </label>
                <input
                  type="text"
                  value={allocationPostingDate}
                  onChange={(e) => setAllocationPostingDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>
                  Ngày chứng từ
                </label>
                <input
                  type="text"
                  value={allocationVoucherDate}
                  onChange={(e) => setAllocationVoucherDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>
                  Số chứng từ
                </label>
                <input
                  type="text"
                  value={allocationVoucherNo}
                  onChange={(e) => setAllocationVoucherNo(e.target.value)}
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    background: "#ffffff",
                    fontWeight: 600,
                    color: "#00a862",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>
                  Diễn giải
                </label>
                <input
                  type="text"
                  value={allocationReason}
                  onChange={(e) => setAllocationReason(e.target.value)}
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div
                style={{
                  background: "#e6f4ea",
                  border: "1px solid #a7f3d0",
                  borderRadius: 6,
                  padding: "6px 12px",
                  textAlign: "right",
                }}
              >
                <div style={{ fontSize: 11, color: "#047857", fontWeight: 500 }}>Tổng tiền phân bổ kỳ này</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#00a862" }}>
                  {formatVND(15650000)}
                </div>
              </div>
            </div>

            {/* Voucher Tabs (Phân bổ / Hạch toán) */}
            <div
              style={{
                display: "flex",
                gap: 24,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
                flexShrink: 0,
              }}
            >
              {[
                { id: "allocation", label: "1. Bảng phân bổ CCDC kỳ này (13 mục)" },
                { id: "accounting", label: "2. Định khoản hạch toán chi phí (TK 6422, 6277 / TK 242)" },
              ].map((t) => {
                const isActive = allocationVoucherTab === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setAllocationVoucherTab(t.id as any)}
                    style={{
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#00a862" : "#64748b",
                      borderBottom: isActive ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </div>
                );
              })}
            </div>

            {/* Content Table */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px 18px", background: "#f8fafc" }}>
              {allocationVoucherTab === "allocation" ? (
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                        <th style={{ width: 85, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã CCDC</th>
                        <th style={{ minWidth: 200, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên CCDC</th>
                        <th style={{ width: 170, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                        <th style={{ width: 100, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                        <th style={{ width: 95, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đã phân bổ</th>
                        <th style={{ width: 95, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                        <th style={{ width: 60, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Số kỳ PB</th>
                        <th style={{ width: 65, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kỳ còn lại</th>
                        <th style={{ width: 110, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#00a862" }}>PB kỳ này</th>
                        <th style={{ width: 65, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK chờ</th>
                        <th style={{ width: 70, padding: "7px 4px", textAlign: "center" }}>TK CP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SAMPLE_ALLOCATION_ITEMS.map((item, idx) => (
                        <tr key={item.toolCode} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{item.toolCode}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 500 }}>{item.toolName}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{item.dept}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{formatVND(item.originalCost)}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: "#64748b" }}>{formatVND(item.allocatedAmount)}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{formatVND(item.remainingAmount)}</td>
                          <td style={{ padding: "6px 4px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{item.allocMonths}</td>
                          <td style={{ padding: "6px 4px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{item.remainingMonths}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(item.thisMonthAlloc)}</td>
                          <td style={{ padding: "6px 4px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 500 }}>{item.waitingAcc}</td>
                          <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, color: "#1e293b" }}>{item.costAcc}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f1f5f9", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                        <td colSpan={4} style={{ padding: "8px 12px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          Cộng tổng cộng:
                        </td>
                        <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>{formatVND(486600000)}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>{formatVND(162000000)}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>{formatVND(324600000)}</td>
                        <td colSpan={2} style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ padding: "8px", borderRight: "1px solid #cbd5e1", textAlign: "right", color: "#00a862", fontSize: 13 }}>{formatVND(15650000)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 40, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                        <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải định khoản</th>
                        <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                        <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                        <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                        <th style={{ width: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Khoản mục chi phí / Bộ phận</th>
                        <th style={{ width: 140, padding: "8px", textAlign: "left" }}>Đối tượng phân bổ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "10px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>1</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 500 }}>
                          Phân bổ chi phí CCDC văn phòng, kinh doanh tháng {allocationMonth}/{allocationYear}
                        </td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>6422</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>242</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(6488888)}</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Chi phí dụng cụ đồ dùng văn phòng</td>
                        <td style={{ padding: "10px 8px", color: "#475569" }}>Khối Văn phòng & Kinh doanh</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "10px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>2</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 500 }}>
                          Phân bổ chi phí CCDC sản xuất, kỹ thuật tháng {allocationMonth}/{allocationYear}
                        </td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>6277</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 700, color: "#1e293b" }}>242</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(9161112)}</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Chi phí dụng cụ sản xuất phân xưởng</td>
                        <td style={{ padding: "10px 8px", color: "#475569" }}>Khối Sản xuất & Cơ điện</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f1f5f9", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                        <td colSpan={4} style={{ padding: "10px 12px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          Tổng cộng hạch toán:
                        </td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right", color: "#00a862", fontSize: 13 }}>
                          {formatVND(15650000)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                height: 50,
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                style={{
                  height: 32,
                  padding: "0 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  cursor: "pointer",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <HelpCircle size={15} />
                <span>Trợ giúp</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAllocationVoucherModal(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 12.5,
                    cursor: "pointer",
                    color: "#334155",
                    fontWeight: 500,
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newVoucher = {
                      voucherNo: allocationVoucherNo,
                      postingDate: allocationPostingDate,
                      voucherDate: allocationVoucherDate,
                      reason: allocationReason,
                      totalAmount: 15650000,
                      creator: "Nguyễn Thị Mai",
                      status: "Đã ghi sổ",
                    };
                    setAllocationVouchers([newVoucher, ...allocationVouchers.filter((v) => v.voucherNo !== allocationVoucherNo)]);
                    setShowAllocationVoucherModal(false);
                    setAllocationViewMode("list");
                    notify(`Đã cất chứng từ phân bổ CCDC số ${allocationVoucherNo} thành công`);
                  }}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    color: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cất
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newVoucher = {
                      voucherNo: allocationVoucherNo,
                      postingDate: allocationPostingDate,
                      voucherDate: allocationVoucherDate,
                      reason: allocationReason,
                      totalAmount: 15650000,
                      creator: "Nguyễn Thị Mai",
                      status: "Đã ghi sổ",
                    };
                    setAllocationVouchers([newVoucher, ...allocationVouchers.filter((v) => v.voucherNo !== allocationVoucherNo)]);
                    setShowAllocationVoucherModal(false);
                    setAllocationViewMode("list");
                    notify(`Đã cất và chuẩn bị in chứng từ phân bổ CCDC số ${allocationVoucherNo}`);
                  }}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    color: "#00a862",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Printer size={14} />
                  <span>Cất và In</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL ĐIỀU CHỈNH CÔNG CỤ DỤNG CỤ (Ảnh 2 của user) */}
      {showAdjustmentModal && (
        <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(2px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1000,
              padding: 10,
            }}
          >
            <div
              style={{
                width: "98vw",
                maxWidth: 1320,
                height: "94vh",
                background: "#ffffff",
                borderRadius: 6,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header: Icon RotateCcw, Title, Help, Maximize, X */}
              <div
                style={{
                  height: 46,
                  background: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 18px",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <RotateCcw size={18} style={{ color: "#475569" }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Điều chỉnh công cụ dụng cụ {adjustmentVoucherNo}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    title="Hướng dẫn"
                    style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <HelpCircle size={18} />
                  </button>
                  <button
                    type="button"
                    title="Phóng to"
                    style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdjustmentModal(false)}
                    style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Info Section */}
              <div
                style={{
                  padding: "14px 20px 10px 20px",
                  background: "#ffffff",
                  display: "grid",
                  gridTemplateColumns: "1fr 220px 180px",
                  gap: 20,
                  alignItems: "flex-start",
                  flexShrink: 0,
                }}
              >
                {/* Left: Lý do điều chỉnh & Tham chiếu */}
                <div>
                  <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 5, fontWeight: 500 }}>
                    Lý do điều chỉnh
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="Nhập lý do điều chỉnh CCDC..."
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 34px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <Sparkles
                      size={15}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#a855f7",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span
                      onClick={() => notify("Mở danh sách chứng từ tham chiếu")}
                      style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", textDecoration: "none" }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>
                </div>

                {/* Center: Ngày CT & Số CT */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                      Ngày chứng từ
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={adjustmentVoucherDate}
                        onChange={(e) => setAdjustmentVoucherDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 28px 0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                        }}
                      />
                      <Calendar
                        size={14}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#64748b",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                      Số chứng từ
                    </label>
                    <input
                      type="text"
                      value={adjustmentVoucherNo}
                      onChange={(e) => setAdjustmentVoucherNo(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        fontWeight: 600,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Right: Số tiền điều chỉnh */}
                <div style={{ textAlign: "right", paddingTop: 4 }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                    Số tiền điều chỉnh
                  </div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: totalAdjRemainingDiff !== 0 ? (totalAdjRemainingDiff > 0 ? "#00a862" : "#ef4444") : "#1e293b",
                    }}
                  >
                    {totalAdjRemainingDiff !== 0 ? formatVND(totalAdjRemainingDiff) : "0"}
                  </div>
                </div>
              </div>

              {/* Tabs Bar: Chi tiết điều chỉnh / Tập hợp chứng từ */}
              <div
                style={{
                  display: "flex",
                  gap: 28,
                  padding: "0 20px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#ffffff",
                  flexShrink: 0,
                }}
              >
                {[
                  { id: "detail", label: "Chi tiết điều chỉnh" },
                  { id: "vouchers", label: "Tập hợp chứng từ" },
                ].map((t) => {
                  const isActive = adjustmentActiveTab === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setAdjustmentActiveTab(t.id as any)}
                      style={{
                        padding: "10px 2px",
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? "#00a862" : "#64748b",
                        borderBottom: isActive ? "2.5px solid #00a862" : "2.5px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </div>
                  );
                })}
              </div>

              {/* Table Container */}
              <div style={{ flex: 1, overflow: "auto", padding: "10px 18px", background: "#f8fafc" }}>
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      {/* Row 1 Header */}
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th rowSpan={2} style={{ width: 36, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th rowSpan={2} style={{ width: 140, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã CCDC</th>
                        <th rowSpan={2} style={{ minWidth: 200, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên CCDC</th>
                        <th rowSpan={2} style={{ width: 75, padding: "6px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                        <th rowSpan={2} style={{ width: 100, padding: "6px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK chờ phân bổ</th>
                        <th colSpan={3} style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                        <th colSpan={3} style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Số kỳ phân bổ còn lại (Tháng)</th>
                        <th rowSpan={2} style={{ width: 130, padding: "6px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền PB hàng kỳ</th>
                        <th rowSpan={2} style={{ width: 40, padding: "6px 4px", textAlign: "center" }}></th>
                      </tr>
                      {/* Row 2 Sub-Header */}
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: 11.5 }}>
                        <th style={{ width: 105, padding: "5px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                        <th style={{ width: 105, padding: "5px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Sau điều chỉnh</th>
                        <th style={{ width: 100, padding: "5px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                        <th style={{ width: 95, padding: "5px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                        <th style={{ width: 95, padding: "5px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Sau điều chỉnh</th>
                        <th style={{ width: 90, padding: "5px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustmentRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          {/* # */}
                          <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                            {idx + 1}
                          </td>

                          {/* Mã CCDC */}
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <select
                              value={row.code}
                              onChange={(e) => {
                                const selectedCode = e.target.value;
                                const tool = SAMPLE_TOOLS_DATA.find((t) => t.code === selectedCode);
                                setAdjustmentRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          code: selectedCode,
                                          name: tool ? tool.name : "",
                                          qty: tool ? tool.qty : 1,
                                          waitingAcc: "242",
                                          remainingBefore: tool ? tool.remainingAmount : 0,
                                          remainingAfter: tool ? tool.remainingAmount : 0,
                                          remainingDiff: 0,
                                          periodBefore: tool ? tool.remainingMonths : 0,
                                          periodAfter: tool ? tool.remainingMonths : 0,
                                          periodDiff: 0,
                                          monthlyAlloc: tool ? Math.round(tool.remainingAmount / tool.remainingMonths) : 0,
                                        }
                                      : r
                                  )
                                );
                              }}
                              style={{
                                width: "100%",
                                height: 28,
                                border: "1px solid #cbd5e1",
                                borderRadius: 3,
                                fontSize: 12,
                                background: "#ffffff",
                                outline: "none",
                              }}
                            >
                              <option value="">-- Chọn CCDC --</option>
                              {SAMPLE_TOOLS_DATA.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.code} - {t.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Tên CCDC */}
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#1e293b", fontWeight: 500 }}>
                            {row.name || ""}
                          </td>

                          {/* Số lượng */}
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                            {row.qty || ""}
                          </td>

                          {/* TK chờ phân bổ */}
                          <td style={{ padding: "6px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            {row.waitingAcc || ""}
                          </td>

                          {/* Giá trị còn lại - Trước điều chỉnh */}
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                            {row.remainingBefore ? formatVND(row.remainingBefore) : "0"}
                          </td>

                          {/* Giá trị còn lại - Sau điều chỉnh */}
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="number"
                              value={row.remainingAfter || ""}
                              onChange={(e) => {
                                const newAfter = Number(e.target.value) || 0;
                                setAdjustmentRows((prev) =>
                                  prev.map((r) => {
                                    if (r.id === row.id) {
                                      const diff = newAfter - r.remainingBefore;
                                      const monthly = r.periodAfter > 0 ? Math.round(newAfter / r.periodAfter) : 0;
                                      return { ...r, remainingAfter: newAfter, remainingDiff: diff, monthlyAlloc: monthly };
                                    }
                                    return r;
                                  })
                                );
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 3,
                                textAlign: "right",
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>

                          {/* Giá trị còn lại - Chênh lệch */}
                          <td
                            style={{
                              padding: "6px 8px",
                              borderRight: "1px solid #e2e8f0",
                              textAlign: "right",
                              fontWeight: 600,
                              color: row.remainingDiff > 0 ? "#00a862" : row.remainingDiff < 0 ? "#ef4444" : "#64748b",
                            }}
                          >
                            {row.remainingDiff ? formatVND(row.remainingDiff) : "0"}
                          </td>

                          {/* Số kỳ phân bổ - Trước điều chỉnh */}
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                            {row.periodBefore ? `${row.periodBefore},00` : "0,00"}
                          </td>

                          {/* Số kỳ phân bổ - Sau điều chỉnh */}
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="number"
                              value={row.periodAfter || ""}
                              onChange={(e) => {
                                const newPeriodAfter = Number(e.target.value) || 0;
                                setAdjustmentRows((prev) =>
                                  prev.map((r) => {
                                    if (r.id === row.id) {
                                      const pDiff = newPeriodAfter - r.periodBefore;
                                      const monthly = newPeriodAfter > 0 ? Math.round(r.remainingAfter / newPeriodAfter) : 0;
                                      return { ...r, periodAfter: newPeriodAfter, periodDiff: pDiff, monthlyAlloc: monthly };
                                    }
                                    return r;
                                  })
                                );
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 3,
                                textAlign: "right",
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>

                          {/* Số kỳ phân bổ - Chênh lệch */}
                          <td
                            style={{
                              padding: "6px 8px",
                              borderRight: "1px solid #e2e8f0",
                              textAlign: "right",
                              fontWeight: 600,
                              color: row.periodDiff > 0 ? "#00a862" : row.periodDiff < 0 ? "#ef4444" : "#64748b",
                            }}
                          >
                            {row.periodDiff ? `${row.periodDiff},00` : "0,00"}
                          </td>

                          {/* Số tiền PB hàng kỳ */}
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 500 }}>
                            {row.monthlyAlloc ? formatVND(row.monthlyAlloc) : ""}
                          </td>

                          {/* Action Delete */}
                          <td style={{ textAlign: "center", padding: "4px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (adjustmentRows.length > 1) {
                                  setAdjustmentRows((prev) => prev.filter((r) => r.id !== row.id));
                                } else {
                                  setAdjustmentRows([
                                    {
                                      id: `adj-${Date.now()}`,
                                      code: "",
                                      name: "",
                                      qty: 0,
                                      waitingAcc: "242",
                                      remainingBefore: 0,
                                      remainingAfter: 0,
                                      remainingDiff: 0,
                                      periodBefore: 0,
                                      periodAfter: 0,
                                      periodDiff: 0,
                                      monthlyAlloc: 0,
                                    },
                                  ]);
                                }
                              }}
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 2 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Summary Row */}
                    <tfoot>
                      <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1", fontSize: 12 }}>
                        <td colSpan={3} style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          {totalAdjQty ? `${totalAdjQty},00` : "0,00"}
                        </td>
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          {totalAdjRemainingBefore ? formatVND(totalAdjRemainingBefore) : "0"}
                        </td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          {totalAdjRemainingAfter ? formatVND(totalAdjRemainingAfter) : "0"}
                        </td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right", color: totalAdjRemainingDiff !== 0 ? (totalAdjRemainingDiff > 0 ? "#00a862" : "#ef4444") : "#1e293b" }}>
                          {totalAdjRemainingDiff ? formatVND(totalAdjRemainingDiff) : "0"}
                        </td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          {totalAdjPeriodBefore ? `${totalAdjPeriodBefore},00` : "0,00"}
                        </td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          {totalAdjPeriodAfter ? `${totalAdjPeriodAfter},00` : "0,00"}
                        </td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          {totalAdjPeriodDiff ? `${totalAdjPeriodDiff},00` : "0,00"}
                        </td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                          {totalAdjMonthlyAlloc ? formatVND(totalAdjMonthlyAlloc) : ""}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Table Actions: Thêm dòng & Xóa hết dòng (Ảnh 2) */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustmentRows((prev) => [
                        ...prev,
                        {
                          id: `adj-${Date.now()}`,
                          code: "",
                          name: "",
                          qty: 0,
                          waitingAcc: "242",
                          remainingBefore: 0,
                          remainingAfter: 0,
                          remainingDiff: 0,
                          periodBefore: 0,
                          periodAfter: 0,
                          periodDiff: 0,
                          monthlyAlloc: 0,
                        },
                      ]);
                    }}
                    style={{
                      height: 28,
                      padding: "0 12px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#1e293b",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus size={13} />
                    <span>Thêm dòng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustmentRows([
                        {
                          id: `adj-${Date.now()}`,
                          code: "",
                          name: "",
                          qty: 0,
                          waitingAcc: "242",
                          remainingBefore: 0,
                          remainingAfter: 0,
                          remainingDiff: 0,
                          periodBefore: 0,
                          periodAfter: 0,
                          periodDiff: 0,
                          monthlyAlloc: 0,
                        },
                      ]);
                      notify("Đã làm mới các dòng điều chỉnh");
                    }}
                    style={{
                      height: 28,
                      padding: "0 12px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#ef4444",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>

                {/* Attachment Section (Đính kèm - Ảnh 2) */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12.5 }}>
                    <Paperclip size={14} style={{ color: "#64748b" }} />
                    <strong style={{ color: "#1e293b" }}>Đính kèm</strong>
                    <span style={{ color: "#94a3b8", fontSize: 11.5 }}>Dung lượng tối đa 5MB</span>
                  </div>

                  <div
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      background: "#ffffff",
                      padding: "20px 16px",
                      textAlign: "center",
                      cursor: "pointer",
                      maxWidth: 420,
                    }}
                    onClick={() => notify("Tính năng tải đính kèm tài liệu chứng từ điều chỉnh")}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <Upload size={20} style={{ color: "#64748b" }} />
                      <div style={{ fontSize: 12.5, color: "#64748b" }}>
                        <span style={{ color: "#0284c7", fontWeight: 500 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
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
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 12.5,
                    cursor: "pointer",
                    color: "#334155",
                    fontWeight: 500,
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newVoucher = {
                      voucherNo: adjustmentVoucherNo,
                      voucherDate: adjustmentVoucherDate,
                      reason: adjustmentReason || "Điều chỉnh công cụ dụng cụ",
                      adjustmentAmount: totalAdjRemainingDiff,
                      creator: "Nguyễn Thị Mai",
                      status: "Đã ghi sổ",
                    };
                    setAdjustmentVouchers([newVoucher, ...adjustmentVouchers.filter((v) => v.voucherNo !== adjustmentVoucherNo)]);
                    setShowAdjustmentModal(false);
                    setAdjustmentViewMode("list");
                    notify(`Đã lưu chứng từ điều chỉnh CCDC ${adjustmentVoucherNo} thành công`);
                  }}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    color: "#1e293b",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cất
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newVoucher = {
                      voucherNo: adjustmentVoucherNo,
                      voucherDate: adjustmentVoucherDate,
                      reason: adjustmentReason || "Điều chỉnh công cụ dụng cụ",
                      adjustmentAmount: totalAdjRemainingDiff,
                      creator: "Nguyễn Thị Mai",
                      status: "Đã ghi sổ",
                    };
                    setAdjustmentVouchers([newVoucher, ...adjustmentVouchers.filter((v) => v.voucherNo !== adjustmentVoucherNo)]);
                    setShowAdjustmentModal(false);
                    setAdjustmentViewMode("list");
                    notify(`Đã lưu và chuẩn bị in chứng từ điều chỉnh CCDC ${adjustmentVoucherNo}`);
                  }}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    color: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>Cất và In</span>
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>
      )}

      {/* 9. MODAL ĐIỀU CHUYỂN CÔNG CỤ DỤNG CỤ (Ảnh 2 của user) */}
      {showTransferModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1320,
              height: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header: RotateCcw, Title, Settings, Help, X */}
            <div
              style={{
                height: 46,
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 18px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCcw size={18} style={{ color: "#475569" }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Điều chuyển công cụ dụng cụ {transferVoucherNo}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Thiết lập"
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <Settings size={17} />
                </button>
                <button
                  type="button"
                  title="Hướng dẫn"
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form Fields: Row 1 (Biên bản & Ngày), Row 2 (Người bàn giao & Người tiếp nhận), Row 3 (Lý do), Row 4 (Tham chiếu) */}
            <div
              style={{
                padding: "14px 20px 10px 20px",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                flexShrink: 0,
              }}
            >
              {/* Row 1: Biên bản giao nhận số & Ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "240px 240px", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                    Biên bản giao nhận số
                  </label>
                  <input
                    type="text"
                    value={transferVoucherNo}
                    onChange={(e) => setTransferVoucherNo(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1.5px solid #00a862",
                      borderRadius: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#00a862",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                    Ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={transferVoucherDate}
                      onChange={(e) => setTransferVoucherDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Người bàn giao & Người tiếp nhận */}
              <div style={{ display: "grid", gridTemplateColumns: "240px 240px", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                    Người bàn giao
                  </label>
                  <input
                    type="text"
                    value={transferDeliverer}
                    onChange={(e) => setTransferDeliverer(e.target.value)}
                    placeholder="Nhập người bàn giao..."
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                    Người tiếp nhận
                  </label>
                  <input
                    type="text"
                    value={transferReceiver}
                    onChange={(e) => setTransferReceiver(e.target.value)}
                    placeholder="Nhập người tiếp nhận..."
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Lý do điều chuyển & Tham chiếu */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                  Lý do điều chuyển
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="Nhập lý do điều chuyển CCDC..."
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 34px 0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <Sparkles
                    size={15}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#a855f7",
                      pointerEvents: "none",
                    }}
                  />
                </div>
                <div style={{ marginTop: 6 }}>
                  <span
                    onClick={() => notify("Mở danh sách chứng từ tham chiếu")}
                    style={{ fontSize: 12, color: "#0284c7", cursor: "pointer" }}
                  >
                    Tham chiếu ...
                  </span>
                </div>
              </div>
            </div>

            {/* Tab: Chi tiết */}
            <div
              style={{
                display: "flex",
                gap: 28,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  padding: "10px 4px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#00a862",
                  borderBottom: "2.5px solid #00a862",
                  cursor: "pointer",
                }}
              >
                Chi tiết
              </div>
            </div>

            {/* Table Container */}
            <div style={{ flex: 1, overflow: "auto", padding: "10px 18px", background: "#f8fafc" }}>
              <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 140, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã CCDC</th>
                      <th style={{ minWidth: 200, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên CCDC</th>
                      <th style={{ width: 170, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Từ đơn vị</th>
                      <th style={{ width: 170, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đến đơn vị</th>
                      <th style={{ width: 130, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng đang dùng</th>
                      <th style={{ width: 140, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng điều chuyển</th>
                      <th style={{ width: 110, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã thống kê</th>
                      <th style={{ width: 110, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Hợp đồng bán</th>
                      <th style={{ width: 110, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn đặt hàng</th>
                      <th style={{ width: 40, padding: "7px 4px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                          {idx + 1}
                        </td>

                        {/* Mã CCDC */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.code}
                            onChange={(e) => {
                              const selectedCode = e.target.value;
                              const tool = SAMPLE_TOOLS_DATA.find((t) => t.code === selectedCode);
                              setTransferRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        code: selectedCode,
                                        name: tool ? tool.name : "",
                                        fromDept: tool ? tool.dept : "",
                                        currentQty: tool ? tool.qty : 0,
                                        transferQty: tool ? tool.qty : 0,
                                      }
                                    : r
                                )
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 28,
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              fontSize: 12,
                              background: "#ffffff",
                              outline: "none",
                            }}
                          >
                            <option value="">-- Chọn CCDC --</option>
                            {SAMPLE_TOOLS_DATA.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.code} - {t.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Tên CCDC */}
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>
                          {row.name || ""}
                        </td>

                        {/* Từ đơn vị */}
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>
                          {row.fromDept || ""}
                        </td>

                        {/* Đến đơn vị */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.toDept}
                            onChange={(e) => {
                              const dest = e.target.value;
                              setTransferRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, toDept: dest } : r))
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 28,
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              fontSize: 12,
                              background: "#ffffff",
                              outline: "none",
                            }}
                          >
                            <option value="">-- Chọn đơn vị đến --</option>
                            {[
                              "Phòng Kế toán",
                              "Phòng Hành chính - Nhân sự",
                              "Phòng Kinh doanh",
                              "Phòng Họp điều hành",
                              "Phân xưởng Kỹ thuật cơ điện",
                              "Xưởng Sản xuất Tủ bảng điện",
                              "Đội Bảo vệ & An ninh",
                            ].map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Số lượng đang dùng */}
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                          {row.currentQty ? `${row.currentQty},00` : "0,00"}
                        </td>

                        {/* Số lượng điều chuyển */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            value={row.transferQty || ""}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setTransferRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, transferQty: val } : r))
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 26,
                              padding: "0 6px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              textAlign: "right",
                              fontSize: 12,
                              boxSizing: "border-box",
                            }}
                          />
                        </td>

                        {/* Mã thống kê */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.statCode}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransferRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, statCode: val } : r))
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 26,
                              padding: "0 6px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              fontSize: 12,
                              boxSizing: "border-box",
                            }}
                          />
                        </td>

                        {/* Hợp đồng bán */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.contract}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransferRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, contract: val } : r))
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 26,
                              padding: "0 6px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              fontSize: 12,
                              boxSizing: "border-box",
                            }}
                          />
                        </td>

                        {/* Đơn đặt hàng */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.order}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransferRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, order: val } : r))
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 26,
                              padding: "0 6px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              fontSize: 12,
                              boxSizing: "border-box",
                            }}
                          />
                        </td>

                        {/* Delete row */}
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (transferRows.length > 1) {
                                setTransferRows((prev) => prev.filter((r) => r.id !== row.id));
                              } else {
                                setTransferRows([
                                  {
                                    id: `trf-${Date.now()}`,
                                    code: "",
                                    name: "",
                                    fromDept: "",
                                    toDept: "",
                                    currentQty: 0,
                                    transferQty: 0,
                                    statCode: "",
                                    contract: "",
                                    order: "",
                                  },
                                ]);
                              }
                            }}
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 2 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary Footer */}
                  <tfoot>
                    <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1", fontSize: 12 }}>
                      <td colSpan={5} style={{ padding: "7px 12px", borderRight: "1px solid #cbd5e1" }}>
                        Tổng cộng
                      </td>
                      <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                        {totalTransferCurrentQty ? `${totalTransferCurrentQty},00` : "0,00"}
                      </td>
                      <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right", color: "#00a862" }}>
                        {totalTransferQty ? `${totalTransferQty},00` : "0,00"}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Table Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setTransferRows((prev) => [
                      ...prev,
                      {
                        id: `trf-${Date.now()}`,
                        code: "",
                        name: "",
                        fromDept: "",
                        toDept: "",
                        currentQty: 0,
                        transferQty: 0,
                        statCode: "",
                        contract: "",
                        order: "",
                      },
                    ]);
                  }}
                  style={{
                    height: 28,
                    padding: "0 12px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#1e293b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={13} />
                  <span>Thêm dòng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTransferRows([
                      {
                        id: `trf-${Date.now()}`,
                        code: "",
                        name: "",
                        fromDept: "",
                        toDept: "",
                        currentQty: 0,
                        transferQty: 0,
                        statCode: "",
                        contract: "",
                        order: "",
                      },
                    ]);
                    notify("Đã làm mới các dòng điều chuyển");
                  }}
                  style={{
                    height: 28,
                    padding: "0 12px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#ef4444",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Attachment Section */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12.5 }}>
                  <Paperclip size={14} style={{ color: "#64748b" }} />
                  <strong style={{ color: "#1e293b" }}>Đính kèm</strong>
                  <span style={{ color: "#94a3b8", fontSize: 11.5 }}>Dung lượng tối đa 5MB</span>
                </div>

                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#ffffff",
                    padding: "20px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    maxWidth: 420,
                  }}
                  onClick={() => notify("Tính năng tải đính kèm tài liệu chứng từ điều chuyển")}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <Upload size={20} style={{ color: "#64748b" }} />
                    <div style={{ fontSize: 12.5, color: "#64748b" }}>
                      <span style={{ color: "#0284c7", fontWeight: 500 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  cursor: "pointer",
                  color: "#334155",
                  fontWeight: 500,
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const newVoucher = {
                    voucherNo: transferVoucherNo,
                    voucherDate: transferVoucherDate,
                    deliverer: transferDeliverer || "Người bàn giao",
                    receiver: transferReceiver || "Người tiếp nhận",
                    reason: transferReason || "Điều chuyển công cụ dụng cụ",
                    status: "Đã ghi sổ",
                  };
                  setTransferVouchers([newVoucher, ...transferVouchers.filter((v) => v.voucherNo !== transferVoucherNo)]);
                  setShowTransferModal(false);
                  setTransferViewMode("list");
                  notify(`Đã lưu chứng từ điều chuyển CCDC ${transferVoucherNo} thành công`);
                }}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  color: "#1e293b",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  const newVoucher = {
                    voucherNo: transferVoucherNo,
                    voucherDate: transferVoucherDate,
                    deliverer: transferDeliverer || "Người bàn giao",
                    receiver: transferReceiver || "Người tiếp nhận",
                    reason: transferReason || "Điều chuyển công cụ dụng cụ",
                    status: "Đã ghi sổ",
                  };
                  setTransferVouchers([newVoucher, ...transferVouchers.filter((v) => v.voucherNo !== transferVoucherNo)]);
                  setShowTransferModal(false);
                  setTransferViewMode("list");
                  notify(`Đã lưu và chuẩn bị in chứng từ điều chuyển CCDC ${transferVoucherNo}`);
                }}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  color: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 10. MODAL GHI GIẢM CÔNG CỤ DỤNG CỤ (Ảnh 1 của user) */}
      {showDecreaseModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1320,
              height: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header: RotateCcw, Title, Settings, Help, X */}
            <div
              style={{
                height: 46,
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 18px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCcw size={18} style={{ color: "#475569" }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Ghi giảm công cụ dụng cụ {decreaseVoucherNo}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Thiết lập"
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <Settings size={17} />
                </button>
                <button
                  type="button"
                  title="Hướng dẫn"
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDecreaseModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form Fields: Left (Lý do ghi giảm & Tham chiếu), Right (Ngày chứng từ & Số chứng từ) */}
            <div
              style={{
                padding: "14px 20px 10px 20px",
                background: "#ffffff",
                display: "grid",
                gridTemplateColumns: "1fr 240px",
                gap: 24,
                alignItems: "start",
                flexShrink: 0,
              }}
            >
              {/* Left Column: Lý do ghi giảm & Tham chiếu */}
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                  Lý do ghi giảm
                </label>
                <div style={{ position: "relative", maxWidth: 620 }}>
                  <select
                    value={decreaseReason}
                    onChange={(e) => setDecreaseReason(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 30px 0 10px",
                      border: "1.5px solid #00a862",
                      borderRadius: 4,
                      fontSize: 12.5,
                      color: "#1e293b",
                      background: "#ffffff",
                      outline: "none",
                      boxSizing: "border-box",
                      cursor: "pointer",
                      appearance: "none",
                    }}
                  >
                    <option value="Nhượng bán, Thanh lý">Nhượng bán, Thanh lý</option>
                    <option value="Phát hiện thiếu khi kiểm kê">Phát hiện thiếu khi kiểm kê</option>
                    <option value="Nhập lại kho CCDC không sử dụng">Nhập lại kho CCDC không sử dụng</option>
                    <option value="Hư hỏng không thể sửa chữa">Hư hỏng không thể sửa chữa</option>
                  </select>
                  <ChevronDown
                    size={14}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748b",
                      pointerEvents: "none",
                    }}
                  />
                </div>

                <div style={{ marginTop: 8 }}>
                  <span
                    onClick={() => notify("Mở danh sách chứng từ tham chiếu")}
                    style={{ fontSize: 12, color: "#0284c7", cursor: "pointer" }}
                  >
                    Tham chiếu ...
                  </span>
                </div>
              </div>

              {/* Right Column: Ngày chứng từ & Số chứng từ */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                    Ngày chứng từ
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={decreaseVoucherDate}
                      onChange={(e) => setDecreaseVoucherDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                    Số chứng từ
                  </label>
                  <input
                    type="text"
                    value={decreaseVoucherNo}
                    onChange={(e) => setDecreaseVoucherNo(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Tab: Chi tiết */}
            <div
              style={{
                display: "flex",
                gap: 28,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  padding: "10px 4px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#00a862",
                  borderBottom: "2.5px solid #00a862",
                  cursor: "pointer",
                }}
              >
                Chi tiết
              </div>
            </div>

            {/* Table Container */}
            <div style={{ flex: 1, overflow: "auto", padding: "10px 18px", background: "#f8fafc" }}>
              <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 150, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Filter size={11} style={{ color: "#64748b" }} />
                          <span>Mã CCDC</span>
                        </div>
                      </th>
                      <th style={{ minWidth: 220, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Filter size={11} style={{ color: "#64748b" }} />
                          <span>Tên CCDC</span>
                        </div>
                      </th>
                      <th style={{ width: 180, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                      <th style={{ width: 140, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng đang dùng</th>
                      <th style={{ width: 140, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng ghi giảm</th>
                      <th style={{ width: 190, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại của CCDC ghi giảm</th>
                      <th style={{ width: 40, padding: "7px 4px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {decreaseRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                          {idx + 1}
                        </td>

                        {/* Mã CCDC */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.code}
                            onChange={(e) => {
                              const selectedCode = e.target.value;
                              const tool = SAMPLE_TOOLS_DATA.find((t) => t.code === selectedCode);
                              setDecreaseRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        code: selectedCode,
                                        name: tool ? tool.name : "",
                                        dept: tool ? tool.dept : "",
                                        currentQty: tool ? tool.qty : 0,
                                        decreaseQty: tool ? tool.qty : 0,
                                        remainingValue: tool ? tool.remainingAmount : 0,
                                      }
                                    : r
                                )
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 28,
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              fontSize: 12,
                              background: "#ffffff",
                              outline: "none",
                            }}
                          >
                            <option value="">-- Chọn CCDC --</option>
                            {SAMPLE_TOOLS_DATA.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.code} - {t.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Tên CCDC */}
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>
                          {row.name || ""}
                        </td>

                        {/* Đơn vị sử dụng */}
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>
                          {row.dept || ""}
                        </td>

                        {/* Số lượng đang dùng */}
                        <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                          {row.currentQty ? `${row.currentQty},00` : "0,00"}
                        </td>

                        {/* Số lượng ghi giảm */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            value={row.decreaseQty || ""}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const tool = SAMPLE_TOOLS_DATA.find((t) => t.code === row.code);
                              const remVal = tool && tool.qty > 0 ? Math.round((tool.remainingAmount / tool.qty) * val) : 0;
                              setDecreaseRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        decreaseQty: val,
                                        remainingValue: remVal,
                                      }
                                    : r
                                )
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 26,
                              padding: "0 6px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              textAlign: "right",
                              fontSize: 12,
                              boxSizing: "border-box",
                            }}
                          />
                        </td>

                        {/* Giá trị còn lại của CCDC ghi giảm */}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            value={row.remainingValue || ""}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setDecreaseRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, remainingValue: val } : r))
                              );
                            }}
                            style={{
                              width: "100%",
                              height: 26,
                              padding: "0 6px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              textAlign: "right",
                              fontSize: 12,
                              boxSizing: "border-box",
                              fontWeight: 500,
                            }}
                          />
                        </td>

                        {/* Delete row */}
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (decreaseRows.length > 1) {
                                setDecreaseRows((prev) => prev.filter((r) => r.id !== row.id));
                              } else {
                                setDecreaseRows([
                                  {
                                    id: `dec-${Date.now()}`,
                                    code: "",
                                    name: "",
                                    dept: "",
                                    currentQty: 0,
                                    decreaseQty: 0,
                                    remainingValue: 0,
                                  },
                                ]);
                              }
                            }}
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 2 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary Footer */}
                  <tfoot>
                    <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1", fontSize: 12 }}>
                      <td colSpan={4} style={{ padding: "7px 12px", borderRight: "1px solid #cbd5e1" }}>
                        Tổng cộng
                      </td>
                      <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                        {totalDecreaseCurrentQty ? `${totalDecreaseCurrentQty},00` : "0,00"}
                      </td>
                      <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>
                        {totalDecreaseQty ? `${totalDecreaseQty},00` : "0,00"}
                      </td>
                      <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right", color: "#1e293b" }}>
                        {totalDecreaseRemainingValue ? formatVND(totalDecreaseRemainingValue) : "0"}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Table Actions: Thêm dòng & Xóa hết dòng (Ảnh 1) */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setDecreaseRows((prev) => [
                      ...prev,
                      {
                        id: `dec-${Date.now()}`,
                        code: "",
                        name: "",
                        dept: "",
                        currentQty: 0,
                        decreaseQty: 0,
                        remainingValue: 0,
                      },
                    ]);
                  }}
                  style={{
                    height: 28,
                    padding: "0 12px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#1e293b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={13} />
                  <span>Thêm dòng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDecreaseRows([
                      {
                        id: `dec-${Date.now()}`,
                        code: "",
                        name: "",
                        dept: "",
                        currentQty: 0,
                        decreaseQty: 0,
                        remainingValue: 0,
                      },
                    ]);
                    notify("Đã làm mới các dòng ghi giảm");
                  }}
                  style={{
                    height: 28,
                    padding: "0 12px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#ef4444",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Attachment Section (Ảnh 1) */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12.5 }}>
                  <Paperclip size={14} style={{ color: "#64748b" }} />
                  <strong style={{ color: "#1e293b" }}>Đính kèm</strong>
                  <span style={{ color: "#94a3b8", fontSize: 11.5 }}>Dung lượng tối đa 5MB</span>
                </div>

                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#ffffff",
                    padding: "20px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    maxWidth: 420,
                  }}
                  onClick={() => notify("Tính năng tải đính kèm tài liệu chứng từ ghi giảm")}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <Upload size={20} style={{ color: "#64748b" }} />
                    <div style={{ fontSize: 12.5, color: "#64748b" }}>
                      <span style={{ color: "#0284c7", fontWeight: 500 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setShowDecreaseModal(false)}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  cursor: "pointer",
                  color: "#334155",
                  fontWeight: 500,
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const newVoucher = {
                    voucherNo: decreaseVoucherNo,
                    voucherDate: decreaseVoucherDate,
                    reason: decreaseReason || "Ghi giảm công cụ dụng cụ",
                    itemCount: decreaseRows.filter((r) => r.code).length || 1,
                    totalQty: totalDecreaseQty,
                    totalRemainingAmount: totalDecreaseRemainingValue,
                    status: "Đã ghi sổ",
                  };
                  setDecreaseVouchers([newVoucher, ...decreaseVouchers.filter((v) => v.voucherNo !== decreaseVoucherNo)]);
                  setShowDecreaseModal(false);
                  setDecreaseViewMode("list");
                  notify(`Đã lưu chứng từ ghi giảm CCDC ${decreaseVoucherNo} thành công`);
                }}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  color: "#1e293b",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  const newVoucher = {
                    voucherNo: decreaseVoucherNo,
                    voucherDate: decreaseVoucherDate,
                    reason: decreaseReason || "Ghi giảm công cụ dụng cụ",
                    itemCount: decreaseRows.filter((r) => r.code).length || 1,
                    totalQty: totalDecreaseQty,
                    totalRemainingAmount: totalDecreaseRemainingValue,
                    status: "Đã ghi sổ",
                  };
                  setDecreaseVouchers([newVoucher, ...decreaseVouchers.filter((v) => v.voucherNo !== decreaseVoucherNo)]);
                  setShowDecreaseModal(false);
                  setDecreaseViewMode("list");
                  notify(`Đã lưu và chuẩn bị in chứng từ ghi giảm CCDC ${decreaseVoucherNo}`);
                }}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  color: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. MODAL CHỌN NGÀY KIỂM KÊ CCDC (Ảnh của user) */}
      {showStocktakeDateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1050,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header: Title, Help, X */}
            <div
              style={{
                height: 44,
                padding: "0 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#ffffff",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                Kiểm kê CCDC
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Hướng dẫn"
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <HelpCircle size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowStocktakeDateModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "18px 20px 14px 20px" }}>
              <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 6, fontWeight: 500 }}>
                Kiểm kê đến ngày
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={stocktakeToDate}
                  onChange={(e) => setStocktakeToDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 28px 0 10px",
                    border: "1.5px solid #00a862",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#1e293b",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                <Calendar
                  size={14}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                padding: "8px 20px 16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setShowStocktakeDateModal(false)}
                style={{
                  height: 30,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  color: "#334155",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStocktakeDateModal(false);
                  setStocktakeVoucherDate(stocktakeToDate);
                  setShowStocktakeVoucherModal(true);
                }}
                style={{
                  height: 30,
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
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. MODAL BIÊN BẢN KIỂM KÊ CÔNG CỤ DỤNG CỤ */}
      {showStocktakeVoucherModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1320,
              height: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header: RotateCcw, Title, Settings, Help, X */}
            <div
              style={{
                height: 46,
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 18px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCcw size={18} style={{ color: "#475569" }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Biên bản kiểm kê công cụ dụng cụ {stocktakeVoucherNo}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  title="Thiết lập"
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <Settings size={17} />
                </button>
                <button
                  type="button"
                  title="Hướng dẫn"
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowStocktakeVoucherModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* General Information Card */}
            <div
              style={{
                padding: "14px 20px 10px 20px",
                background: "#ffffff",
                display: "grid",
                gridTemplateColumns: "1fr 220px 220px",
                gap: 20,
                alignItems: "start",
                flexShrink: 0,
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                  Mục đích kiểm kê
                </label>
                <input
                  type="text"
                  value={stocktakePurpose}
                  onChange={(e) => setStocktakePurpose(e.target.value)}
                  placeholder="Nhập mục đích kiểm kê..."
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                  Kiểm kê đến ngày
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={stocktakeToDate}
                    onChange={(e) => setStocktakeToDate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 28px 0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#1e293b", marginBottom: 4, fontWeight: 500 }}>
                  Số biên bản
                </label>
                <input
                  type="text"
                  value={stocktakeVoucherNo}
                  onChange={(e) => setStocktakeVoucherNo(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: 600,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Tabs Bar: 1. Kết quả kiểm kê | 2. Ban kiểm kê */}
            <div
              style={{
                display: "flex",
                gap: 28,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
                flexShrink: 0,
              }}
            >
              {[
                { id: "detail", label: "1. Kết quả kiểm kê" },
                { id: "committee", label: "2. Ban kiểm kê" },
              ].map((t) => {
                const isActive = stocktakeTab === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setStocktakeTab(t.id as any)}
                    style={{
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#00a862" : "#64748b",
                      borderBottom: isActive ? "2.5px solid #00a862" : "2.5px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </div>
                );
              })}
            </div>

            {/* Table Container */}
            <div style={{ flex: 1, overflow: "auto", padding: "10px 18px", background: "#f8fafc" }}>
              {stocktakeTab === "detail" ? (
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th style={{ width: 140, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã CCDC</th>
                        <th style={{ minWidth: 220, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên CCDC</th>
                        <th style={{ width: 170, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                        <th style={{ width: 120, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>SL sổ sách</th>
                        <th style={{ width: 120, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>SL thực tế</th>
                        <th style={{ width: 110, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Thừa</th>
                        <th style={{ width: 110, padding: "7px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Thiếu</th>
                        <th style={{ minWidth: 160, padding: "7px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Xử lý chênh lệch</th>
                        <th style={{ width: 40, padding: "7px 4px", textAlign: "center" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocktakeRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <select
                              value={row.code}
                              onChange={(e) => {
                                const selectedCode = e.target.value;
                                const tool = SAMPLE_TOOLS_DATA.find((t) => t.code === selectedCode);
                                setStocktakeRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          code: selectedCode,
                                          name: tool ? tool.name : "",
                                          dept: tool ? tool.dept : "",
                                          bookQty: tool ? tool.qty : 0,
                                          actualQty: tool ? tool.qty : 0,
                                          diffExcess: 0,
                                          diffShortage: 0,
                                          solution: "Khớp sổ sách",
                                        }
                                      : r
                                  )
                                );
                              }}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff", outline: "none" }}
                            >
                              <option value="">-- Chọn CCDC --</option>
                              {SAMPLE_TOOLS_DATA.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.code} - {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{row.name}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.dept}</td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.bookQty ? `${row.bookQty},00` : "0,00"}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="number"
                              value={row.actualQty || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const diff = val - (row.bookQty || 0);
                                setStocktakeRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          actualQty: val,
                                          diffExcess: diff > 0 ? diff : 0,
                                          diffShortage: diff < 0 ? Math.abs(diff) : 0,
                                          solution: diff === 0 ? "Khớp sổ sách" : diff > 0 ? "Ghi tăng CCDC thừa" : "Lập chứng từ ghi giảm",
                                        }
                                      : r
                                  )
                                );
                              }}
                              style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, textAlign: "right", fontSize: 12, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: row.diffExcess > 0 ? "#00a862" : "#64748b", fontWeight: row.diffExcess > 0 ? 600 : 400 }}>
                            {row.diffExcess ? `${row.diffExcess},00` : "0,00"}
                          </td>
                          <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: row.diffShortage > 0 ? "#ef4444" : "#64748b", fontWeight: row.diffShortage > 0 ? 600 : 400 }}>
                            {row.diffShortage ? `${row.diffShortage},00` : "0,00"}
                          </td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={row.solution}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStocktakeRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, solution: val } : r)));
                              }}
                              style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ textAlign: "center", padding: "4px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (stocktakeRows.length > 1) {
                                  setStocktakeRows((prev) => prev.filter((r) => r.id !== row.id));
                                } else {
                                  setStocktakeRows([{ id: `stk-${Date.now()}`, code: "", name: "", dept: "", bookQty: 0, actualQty: 0, diffExcess: 0, diffShortage: 0, solution: "" }]);
                                }
                              }}
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 2 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1", fontSize: 12 }}>
                        <td colSpan={4} style={{ padding: "7px 12px", borderRight: "1px solid #cbd5e1" }}>Tổng cộng</td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>{totalStocktakeBookQty ? `${totalStocktakeBookQty},00` : "0,00"}</td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right" }}>{totalStocktakeActualQty ? `${totalStocktakeActualQty},00` : "0,00"}</td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right", color: "#00a862" }}>{totalStocktakeDiffExcess ? `${totalStocktakeDiffExcess},00` : "0,00"}</td>
                        <td style={{ padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "right", color: "#ef4444" }}>{totalStocktakeDiffShortage ? `${totalStocktakeDiffShortage},00` : "0,00"}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                /* Tab 2: Ban kiểm kê */
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 40, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                        <th style={{ width: 220, padding: "7px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Họ và tên</th>
                        <th style={{ width: 200, padding: "7px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Chức vụ</th>
                        <th style={{ width: 220, padding: "7px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đại diện bộ phận</th>
                        <th style={{ minWidth: 160, padding: "7px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Vai trò trong ban kiểm kê</th>
                        <th style={{ width: 40, padding: "7px 4px", textAlign: "center" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocktakeCommittee.map((m, idx) => (
                        <tr key={m.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={m.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStocktakeCommittee((prev) => prev.map((item) => (item.id === m.id ? { ...item, name: val } : item)));
                              }}
                              style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={m.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStocktakeCommittee((prev) => prev.map((item) => (item.id === m.id ? { ...item, title: val } : item)));
                              }}
                              style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={m.dept}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStocktakeCommittee((prev) => prev.map((item) => (item.id === m.id ? { ...item, dept: val } : item)));
                              }}
                              style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                            <select
                              value={m.role}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStocktakeCommittee((prev) => prev.map((item) => (item.id === m.id ? { ...item, role: val } : item)));
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff" }}
                            >
                              <option value="Trưởng ban">Trưởng ban</option>
                              <option value="Phó ban">Phó ban</option>
                              <option value="Ủy viên">Ủy viên</option>
                              <option value="Thư ký">Thư ký</option>
                            </select>
                          </td>
                          <td style={{ textAlign: "center", padding: "4px" }}>
                            <button
                              type="button"
                              onClick={() => setStocktakeCommittee((prev) => prev.filter((item) => item.id !== m.id))}
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                {stocktakeTab === "detail" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setStocktakeRows((prev) => [
                          ...prev,
                          { id: `stk-${Date.now()}`, code: "", name: "", dept: "", bookQty: 0, actualQty: 0, diffExcess: 0, diffShortage: 0, solution: "" },
                        ]);
                      }}
                      style={{ height: 28, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 500, color: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStocktakeRows(SAMPLE_TOOLS_DATA.map((t, i) => ({
                          id: `stk-all-${i}`,
                          code: t.code,
                          name: t.name,
                          dept: t.dept,
                          bookQty: t.qty,
                          actualQty: t.qty,
                          diffExcess: 0,
                          diffShortage: 0,
                          solution: "Khớp sổ sách",
                        })));
                        notify("Đã lấy toàn bộ danh mục CCDC đang dùng vào bảng kiểm kê");
                      }}
                      style={{ height: 28, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 500, color: "#00a862", cursor: "pointer" }}
                    >
                      Lấy toàn bộ CCDC đang dùng
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setStocktakeCommittee((prev) => [
                        ...prev,
                        { id: `c-${Date.now()}`, name: "", title: "", dept: "", role: "Ủy viên" },
                      ]);
                    }}
                    style={{ height: 28, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 500, color: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Plus size={13} />
                    <span>Thêm thành viên</span>
                  </button>
                )}
              </div>

              {/* Attachment Section */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12.5 }}>
                  <Paperclip size={14} style={{ color: "#64748b" }} />
                  <strong style={{ color: "#1e293b" }}>Đính kèm</strong>
                  <span style={{ color: "#94a3b8", fontSize: 11.5 }}>Dung lượng tối đa 5MB</span>
                </div>
                <div
                  style={{ border: "1px solid #cbd5e1", borderRadius: 6, background: "#ffffff", padding: "18px 16px", textAlign: "center", cursor: "pointer", maxWidth: 420 }}
                  onClick={() => notify("Tính năng tải đính kèm tài liệu biên bản kiểm kê")}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <Upload size={20} style={{ color: "#64748b" }} />
                    <div style={{ fontSize: 12.5, color: "#64748b" }}>
                      <span style={{ color: "#0284c7", fontWeight: 500 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setShowStocktakeVoucherModal(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, cursor: "pointer", color: "#334155", fontWeight: 500 }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const newVoucher = {
                    voucherNo: stocktakeVoucherNo,
                    voucherDate: stocktakeVoucherDate,
                    toDate: stocktakeToDate,
                    purpose: stocktakePurpose,
                    bookQty: totalStocktakeBookQty,
                    actualQty: totalStocktakeActualQty,
                    diffQty: totalStocktakeDiffExcess - totalStocktakeDiffShortage,
                    status: "Đã hoàn thành",
                  };
                  setStocktakeVouchers([newVoucher, ...stocktakeVouchers.filter((v) => v.voucherNo !== stocktakeVoucherNo)]);
                  setShowStocktakeVoucherModal(false);
                  setStocktakeViewMode("list");
                  notify(`Đã lưu biên bản kiểm kê CCDC ${stocktakeVoucherNo} thành công`);
                }}
                style={{ height: 32, padding: "0 20px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, color: "#1e293b", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  const newVoucher = {
                    voucherNo: stocktakeVoucherNo,
                    voucherDate: stocktakeVoucherDate,
                    toDate: stocktakeToDate,
                    purpose: stocktakePurpose,
                    bookQty: totalStocktakeBookQty,
                    actualQty: totalStocktakeActualQty,
                    diffQty: totalStocktakeDiffExcess - totalStocktakeDiffShortage,
                    status: "Đã hoàn thành",
                  };
                  setStocktakeVouchers([newVoucher, ...stocktakeVouchers.filter((v) => v.voucherNo !== stocktakeVoucherNo)]);
                  setShowStocktakeVoucherModal(false);
                  setStocktakeViewMode("list");
                  notify(`Đã lưu và chuẩn bị in biên bản kiểm kê CCDC ${stocktakeVoucherNo}`);
                }}
                style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, color: "#ffffff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // =========================================================================
  // 1. TAB: QUY TRÌNH (Ảnh 1)
  // =========================================================================
  if (tab === "process") {
    return (
      <div style={{ background: "#f1f5f9", minHeight: "100%", padding: "30px 24px", boxSizing: "border-box" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
          
          <div style={{ background: "#ffffff", borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 10px 24px", textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5, textTransform: "uppercase" }}>
                NGHIỆP VỤ CÔNG CỤ DỤNG CỤ, CHI PHÍ TRẢ TRƯỚC
              </h3>
            </div>

            <div style={{ padding: "40px 30px 50px 30px", position: "relative" }}>
              <div style={{ position: "absolute", left: 95, right: 40, top: 145, height: 2, background: "#cbd5e1", zIndex: 1 }}>
                <div style={{ position: "absolute", right: -2, top: -4, width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "8px solid #cbd5e1" }} />
              </div>

              <div style={{ position: "relative", zIndex: 2, minHeight: 210 }}>
                {/* Ghi tăng */}
                <div
                  onClick={() => {
                    navigateTo("management");
                    setManagementSubtab("increase");
                  }}
                  style={{ position: "absolute", left: 20, top: 110, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 80 }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e6f4ea", display: "grid", placeItems: "center", border: "1px solid #bbf7d0", boxShadow: "0 3px 8px rgba(0, 168, 98, 0.15)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#00a862", display: "grid", placeItems: "center", color: "#ffffff" }}>
                      <Plus size={18} strokeWidth={2.5} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>Ghi tăng</span>
                </div>

                {/* Điều chuyển */}
                <div
                  onClick={() => {
                    navigateTo("management");
                    setManagementSubtab("transfer");
                  }}
                  style={{ position: "absolute", left: 170, top: 25, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 80 }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e6f4ea", display: "grid", placeItems: "center", border: "1px solid #bbf7d0", boxShadow: "0 3px 8px rgba(0, 168, 98, 0.15)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#00a862", display: "grid", placeItems: "center", color: "#ffffff" }}>
                      <ArrowRightLeft size={16} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>Điều chuyển</span>
                  <div style={{ position: "absolute", top: 52, width: 2, height: 42, background: "#cbd5e1", zIndex: -1 }} />
                </div>

                {/* Phân bổ */}
                <div
                  onClick={() => {
                    navigateTo("management");
                    setManagementSubtab("allocation");
                  }}
                  style={{ position: "absolute", left: 310, top: 25, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 80 }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e6f4ea", display: "grid", placeItems: "center", border: "1px solid #bbf7d0", boxShadow: "0 3px 8px rgba(0, 168, 98, 0.15)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#00a862", display: "grid", placeItems: "center", color: "#ffffff" }}>
                      <Divide size={18} strokeWidth={2.5} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>Phân bổ</span>
                  <div style={{ position: "absolute", top: 52, width: 2, height: 42, background: "#cbd5e1", zIndex: -1 }} />
                </div>

                {/* Điều chỉnh */}
                <div
                  onClick={() => {
                    navigateTo("management");
                    setManagementSubtab("adjustment");
                  }}
                  style={{ position: "absolute", left: 240, top: 175, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 80 }}
                >
                  <div style={{ position: "absolute", top: -30, width: 2, height: 30, background: "#cbd5e1", zIndex: -1 }} />
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e6f4ea", display: "grid", placeItems: "center", border: "1px solid #bbf7d0", boxShadow: "0 3px 8px rgba(0, 168, 98, 0.15)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#00a862", display: "grid", placeItems: "center", color: "#ffffff" }}>
                      <Sliders size={16} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>Điều chỉnh</span>
                </div>

                {/* Ghi giảm */}
                <div
                  onClick={() => {
                    navigateTo("management");
                    setManagementSubtab("decrease");
                  }}
                  style={{ position: "absolute", left: 380, top: 175, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 80 }}
                >
                  <div style={{ position: "absolute", top: -30, width: 2, height: 30, background: "#cbd5e1", zIndex: -1 }} />
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e6f4ea", display: "grid", placeItems: "center", border: "1px solid #bbf7d0", boxShadow: "0 3px 8px rgba(0, 168, 98, 0.15)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#00a862", display: "grid", placeItems: "center", color: "#ffffff" }}>
                      <MinusCircle size={18} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>Ghi giảm</span>
                </div>

                {/* Kiểm kê */}
                <div
                  onClick={() => {
                    navigateTo("management");
                    setManagementSubtab("stocktake");
                  }}
                  style={{ position: "absolute", left: 460, top: 175, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 80 }}
                >
                  <div style={{ position: "absolute", top: -30, width: 2, height: 30, background: "#cbd5e1", zIndex: -1 }} />
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e6f4ea", display: "grid", placeItems: "center", border: "1px solid #bbf7d0", boxShadow: "0 3px 8px rgba(0, 168, 98, 0.15)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#00a862", display: "grid", placeItems: "center", color: "#ffffff" }}>
                      <ClipboardList size={17} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>Kiểm kê</span>
                </div>
              </div>
            </div>

            {/* Bottom Bar: 3 buttons */}
            <div style={{ borderTop: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#fafafa" }}>
              <div onClick={() => setShowOrgTreeModal(true)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", borderRight: "1px solid #e2e8f0" }}>
                <GitBranch size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Cơ cấu tổ chức</span>
              </div>
              <div onClick={() => setShowCategoryModal(true)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", borderRight: "1px solid #e2e8f0" }}>
                <Wrench size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Loại công cụ dụng cụ</span>
              </div>
              <div onClick={() => setShowOptionsModal(true)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
                <SlidersHorizontal size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Tùy chọn</span>
              </div>
            </div>
          </div>

          {/* Right Card: Báo cáo */}
          <div style={{ background: "#ffffff", borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)", padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 380 }}>
            <div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 13.5, fontWeight: 700, color: "#1e293b", textAlign: "center", letterSpacing: 0.5, textTransform: "uppercase" }}>
                BÁO CÁO
              </h3>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {[
                  "Bảng tính phân bổ chi phí trả trước",
                  "Bảng tính phân bổ công cụ dụng cụ",
                  "Bảng tính phân bổ công cụ dụng cụ theo năm",
                  "Báo cáo chi tiết giảm công cụ dụng cụ",
                  "Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái",
                ].map((rpt, i) => (
                  <div key={rpt} onClick={() => setSelectedReportForPreview(rpt)} style={{ padding: "12px 0", borderBottom: i < 4 ? "1px solid #e2e8f0" : "none", display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                    <span style={{ color: "#64748b", lineHeight: "18px", fontSize: 14 }}>•</span>
                    <span style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.45 }}>{rpt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 20, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
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
  // 2. TAB: SỔ THEO DÕI CÔNG CỤ DỤNG CỤ (Ảnh 2)
  // =========================================================================
  if (tab === "register") {
    if (registerViewMode === "landing") {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 130px)", background: "#ffffff", padding: "40px 20px", boxSizing: "border-box" }}>
          <div style={{ marginBottom: 20 }}>
            <svg width="260" height="150" viewBox="0 0 260 150" fill="none">
              <ellipse cx="130" cy="138" rx="100" ry="10" fill="#f1f5f9" />
              <rect x="55" y="35" width="42" height="58" rx="6" fill="#00a862" />
              <rect x="62" y="42" width="28" height="14" rx="2" fill="#e6f4ea" />
              <circle cx="67" cy="65" r="2.5" fill="#ffffff" /><circle cx="76" cy="65" r="2.5" fill="#ffffff" /><circle cx="85" cy="65" r="2.5" fill="#ffffff" />
              <circle cx="67" cy="74" r="2.5" fill="#ffffff" /><circle cx="76" cy="74" r="2.5" fill="#ffffff" /><circle cx="85" cy="74" r="2.5" fill="#ffffff" />
              <circle cx="67" cy="83" r="2.5" fill="#ffffff" /><circle cx="76" cy="83" r="2.5" fill="#ffffff" /><circle cx="85" cy="83" r="2.5" fill="#ffffff" />
              <rect x="108" y="28" width="56" height="38" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <rect x="114" y="34" width="44" height="24" rx="2" fill="#00a862" opacity="0.85" />
              <line x1="118" y1="46" x2="134" y2="40" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <line x1="134" y1="40" x2="148" y2="50" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <path d="M136 66 V78 M126 78 H146" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
              <path d="M50 115 C45 105 50 95 60 95 C63 95 66 97 68 100 L78 92 C80 94 82 96 80 98 L70 106 C72 108 72 112 70 115 C66 122 55 122 50 115 Z" fill="#00a862" />
              <rect x="72" y="102" width="28" height="8" rx="3" transform="rotate(35 72 102)" fill="#00a862" />
              <rect x="180" y="52" width="42" height="52" rx="4" fill="#00a862" />
              <rect x="175" y="58" width="42" height="48" rx="4" fill="#10b981" />
              <line x1="184" y1="70" x2="208" y2="70" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <line x1="184" y1="78" x2="202" y2="78" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <circle cx="100" cy="20" r="2" fill="#00a862" />
              <circle cx="178" cy="25" r="1.5" fill="#00a862" />
              <circle cx="215" cy="40" r="2.5" fill="#00a862" />
            </svg>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center", maxWidth: 600, lineHeight: 1.5 }}>
            Quản lý tất cả các công cụ dụng cụ đang sử dụng và tình hình phân bổ của từng công cụ dụng cụ
          </h2>

          <div>
            <button
              type="button"
              onClick={() => setShowSingleAddModal(true)}
              style={{ height: 34, padding: "0 22px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, fontWeight: 500, color: "#1e293b", cursor: "pointer" }}
            >
              Khai báo CCDC đầu kỳ
            </button>
          </div>

          <div style={{ marginTop: 60 }}>
            <button
              type="button"
              onClick={() => setRegisterViewMode("list")}
              style={{ height: 32, padding: "0 20px", background: "#ffffff", border: "1px solid #00a862", borderRadius: 16, fontSize: 12.5, fontWeight: 600, color: "#00a862", cursor: "pointer" }}
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
              onClick={() => setShowSingleAddModal(true)}
              style={{ height: 30, padding: "0 14px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <Plus size={14} />
              <span>Khai báo CCDC</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu sổ theo dõi CCDC ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRegisterViewMode("landing")}
            style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#64748b", fontSize: 12, cursor: "pointer" }}
          >
            Xem hình minh họa
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 110, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã CCDC</th>
                <th style={{ minWidth: 200, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên CCDC</th>
                <th style={{ width: 150, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Loại CCDC</th>
                <th style={{ width: 180, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                <th style={{ width: 70, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>SL</th>
                <th style={{ width: 120, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                <th style={{ width: 120, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đã phân bổ</th>
                <th style={{ width: 120, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Còn lại</th>
                <th style={{ width: 80, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Số kỳ PB</th>
                <th style={{ width: 80, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kỳ còn lại</th>
                <th style={{ width: 80, padding: "8px 8px", textAlign: "center" }}>TK chi phí</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_TOOLS_DATA.map((row, idx) => (
                <tr key={row.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{row.name}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.category}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.dept}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.qty}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>{formatVND(row.originalCost)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: "#64748b" }}>{formatVND(row.allocatedAmount)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{formatVND(row.remainingAmount)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{row.allocationMonths}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{row.remainingMonths}</td>
                  <td style={{ padding: "8px", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>{row.costAccount}</td>
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
  // 3. TAB: QUẢN LÝ CÔNG CỤ DỤNG CỤ (Ảnh 1, 2, 3, 4, 5)
  // =========================================================================
  if (
    tab === "management" ||
    tab === "increase" ||
    tab === "allocation" ||
    tab === "adjustment" ||
    tab === "transfer" ||
    tab === "decrease" ||
    tab === "stocktake"
  ) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        
        {/* SUB-TABS BAR (Ghi tăng | Phân bổ chi phí | Điều chỉnh | Điều chuyển | Ghi giảm | Kiểm kê) */}
        <div
          style={{
            background: "#ffffff",
            padding: "0 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 28,
            flexShrink: 0,
          }}
        >
          {[
            { id: "increase", label: "Ghi tăng" },
            { id: "allocation", label: "Phân bổ chi phí" },
            { id: "adjustment", label: "Điều chỉnh" },
            { id: "transfer", label: "Điều chuyển" },
            { id: "decrease", label: "Ghi giảm" },
            { id: "stocktake", label: "Kiểm kê" },
          ].map((sub) => {
            const isActive = managementSubtab === sub.id;
            return (
              <div
                key={sub.id}
                onClick={() => setManagementSubtab(sub.id as any)}
                style={{
                  padding: "12px 2px",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#00a862" : "#475569",
                  borderBottom: isActive ? "2.5px solid #00a862" : "2.5px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {sub.label}
              </div>
            );
          })}
        </div>

        {/* SUBTAB CONTENT: GHI TĂNG (Ảnh 1) */}
        {managementSubtab === "increase" && (
          managementViewMode === "landing" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 20px", boxSizing: "border-box" }}>
              
              <div style={{ marginBottom: 20 }}>
                <svg width="260" height="150" viewBox="0 0 260 150" fill="none">
                  <ellipse cx="130" cy="138" rx="100" ry="10" fill="#f1f5f9" />
                  <rect x="58" y="70" width="46" height="42" rx="4" fill="#00a862" />
                  <rect x="54" y="65" width="54" height="8" rx="2" fill="#10b981" />
                  <line x1="68" y1="85" x2="68" y2="105" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                  <line x1="94" y1="85" x2="94" y2="105" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                  <g transform="translate(108, 40)">
                    <circle cx="14" cy="14" r="12" fill="#00a862" />
                    <rect x="11" y="24" width="6" height="36" rx="3" fill="#00a862" />
                    <circle cx="14" cy="14" r="6" fill="#ffffff" />
                  </g>
                  <rect x="160" y="45" width="48" height="50" rx="5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                  <rect x="160" y="45" width="48" height="14" rx="3" fill="#00a862" />
                  <circle cx="172" cy="70" r="2.5" fill="#00a862" /><circle cx="184" cy="70" r="2.5" fill="#00a862" /><circle cx="196" cy="70" r="2.5" fill="#00a862" />
                  <circle cx="172" cy="82" r="2.5" fill="#00a862" /><circle cx="184" cy="82" r="2.5" fill="#00a862" />
                  <circle cx="195" cy="100" r="14" fill="#00a862" />
                  <path d="M195 92 V100 H201" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>

              <h2 style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center", maxWidth: 660, lineHeight: 1.5 }}>
                Khi xuất kho CCDC hoặc mua CCDC về sử dụng ngay, bạn cần ghi tăng CCDC vào sổ để theo dõi và phân bổ chi phí hàng tháng
              </h2>

              {/* ACTION BUTTON: Thêm ▾ (ĐÚNG THEO ẢNH 1: Gồm 'Ghi tăng CCDC' & 'Ghi tăng CCDC hàng loạt') */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)" }}>
                    <button
                      type="button"
                      onClick={() => setShowAddMenu(!showAddMenu)}
                      style={{
                        height: 34,
                        padding: "0 18px",
                        background: "#00a862",
                        color: "#ffffff",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Thêm
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddMenu(!showAddMenu)}
                      style={{
                        width: 26,
                        height: 34,
                        background: "#009959",
                        color: "#ffffff",
                        border: "none",
                        borderLeft: "1px solid rgba(255,255,255,0.25)",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Dropdown Menu (Chính xác theo Ảnh 1) */}
                  {showAddMenu && (
                    <div
                      style={{
                        position: "absolute",
                        top: 38,
                        left: 0,
                        width: 190,
                        background: "#ffffff",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        boxShadow: "0 8px 16px rgba(0,0,0,0.12)",
                        zIndex: 30,
                        overflow: "hidden",
                        padding: "4px 0",
                      }}
                    >
                      <div
                        onClick={() => {
                          setShowAddMenu(false);
                          setShowSingleAddModal(true);
                        }}
                        style={{ padding: "8px 14px", fontSize: 13, color: "#1e293b", cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                      >
                        Ghi tăng CCDC
                      </div>

                      <div
                        onClick={() => {
                          setShowAddMenu(false);
                          setShowBatchAddModal(true);
                        }}
                        style={{ padding: "8px 14px", fontSize: 13, color: "#1e293b", cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                      >
                        Ghi tăng CCDC hàng loạt
                      </div>
                    </div>
                  )}
                </div>

                {/* Secondary Button: Nhập từ Excel */}
                <button
                  type="button"
                  onClick={() => notify("Đang chuẩn bị biểu mẫu nhập CCDC từ Excel...")}
                  style={{
                    height: 34,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#334155",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  Nhập từ Excel
                </button>
              </div>

              {/* Bottom Button: Xem danh sách chứng từ */}
              <div style={{ marginTop: 60 }}>
                <button
                  type="button"
                  onClick={() => setManagementViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 16,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e6f4ea"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>

            </div>
          ) : (
            /* List Mode for Ghi tăng */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowSingleAddModal(true)}
                    style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Plus size={14} />
                    <span>Ghi tăng CCDC</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBatchAddModal(true)}
                    style={{ height: 30, padding: "0 16px", background: "#ffffff", border: "1px solid #00a862", color: "#00a862", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Plus size={14} />
                    <span>Ghi tăng CCDC hàng loạt</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setManagementViewMode("landing")}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#64748b", fontSize: 12, cursor: "pointer" }}
                >
                  Xem hình minh họa
                </button>
              </div>

              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày HT</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày CT</th>
                      <th style={{ minWidth: 240, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                      <th style={{ width: 130, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng giá trị</th>
                      <th style={{ width: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Nguồn gốc</th>
                      <th style={{ width: 140, padding: "8px", textAlign: "left" }}>Người lập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_INCREASE_VOUCHERS.map((v, i) => (
                      <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{v.voucherNo}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.postingDate}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.voucherDate}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0" }}>{v.reason}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>{formatVND(v.totalCost)}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.source}</td>
                        <td style={{ padding: "8px", color: "#475569" }}>{v.creator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* SUBTAB CONTENT: PHÂN BỔ CHI PHÍ (Ảnh 1 & 2 của user) */}
        {managementSubtab === "allocation" && (
          allocationViewMode === "landing" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                padding: "50px 20px 30px 20px",
                boxSizing: "border-box",
                background: "#ffffff",
                minHeight: "calc(100vh - 180px)",
                position: "relative",
              }}
            >
              {/* Illustration: Clipboard with Tools -> Track with Crossed Tools & $ -> Calendar with Clock (Ảnh 1) */}
              <div style={{ marginBottom: 16 }}>
                <svg width="360" height="170" viewBox="0 0 360 170" fill="none">
                  {/* Ambient 4-point green sparkles */}
                  <path d="M72 40 L75 45 L80 48 L75 51 L72 56 L69 51 L64 48 L69 45 Z" fill="#00a862" opacity="0.65" />
                  <path d="M216 28 L218 32 L222 34 L218 36 L216 40 L214 36 L210 34 L214 32 Z" fill="#00a862" opacity="0.6" />
                  <path d="M305 110 L307 114 L311 116 L307 118 L305 122 L303 118 L299 116 L303 114 Z" fill="#00a862" opacity="0.65" />
                  <circle cx="160" cy="50" r="2" fill="#00a862" opacity="0.4" />
                  <circle cx="200" cy="115" r="2.5" fill="#00a862" opacity="0.5" />

                  {/* Soft document backdrop */}
                  <rect x="186" y="46" width="62" height="66" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                  <line x1="196" y1="62" x2="236" y2="62" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                  <line x1="196" y1="74" x2="226" y2="74" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                  <line x1="196" y1="86" x2="232" y2="86" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />

                  {/* Curved Dashed Connecting Line */}
                  <path d="M102 96 C 120 135, 170 135, 192 90" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 5" fill="none" />
                  <path d="M106 72 C 140 45, 175 55, 195 72" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />

                  {/* Left: Green Folder / Clipboard with Tools */}
                  <g transform="translate(70, 52)">
                    {/* Folder Body */}
                    <rect x="0" y="16" width="48" height="52" rx="6" fill="#00a862" />
                    {/* Top tab / clamp */}
                    <path d="M12 9 C 14 5, 34 5, 36 9 L 36 16 L 12 16 Z" fill="#008f52" />
                    <rect x="15" y="7" width="18" height="5" rx="2" fill="#ffffff" opacity="0.9" />

                    {/* Tool 1 left: Wrench handle sticking up */}
                    <rect x="9" y="-6" width="7" height="23" rx="2" fill="#ffffff" />
                    <circle cx="12.5" cy="-6" r="6" fill="#ffffff" />
                    <circle cx="12.5" cy="-6" r="3" fill="#00a862" />

                    {/* Tool 2 right: Spanner handle sticking up */}
                    <rect x="32" y="-4" width="7" height="21" rx="2" fill="#ffffff" />
                    <circle cx="35.5" cy="-4" r="6" fill="#ffffff" />
                    <circle cx="35.5" cy="-4" r="3" fill="#00a862" />

                    {/* Folder front lines */}
                    <rect x="10" y="28" width="28" height="4" rx="2" fill="#ffffff" opacity="0.3" />
                    <rect x="10" y="38" width="18" height="4" rx="2" fill="#ffffff" opacity="0.3" />
                  </g>

                  {/* Center: Crossed Tools (Green Spanners) */}
                  <g transform="translate(150, 52)">
                    <rect x="-1" y="2" width="6" height="26" rx="2" transform="rotate(-40 2 15)" fill="#00a862" />
                    <circle cx="-5" cy="5" r="5" fill="#00a862" />
                    <circle cx="-5" cy="5" r="2.5" fill="#ffffff" />

                    <rect x="1" y="2" width="6" height="26" rx="2" transform="rotate(40 4 15)" fill="#00a862" />
                    <circle cx="13" cy="5" r="5" fill="#00a862" />
                    <circle cx="13" cy="5" r="2.5" fill="#ffffff" />
                  </g>

                  {/* Center Lower: Green Dollar Badge */}
                  <g transform="translate(152, 94)">
                    <circle cx="13" cy="13" r="13" fill="#00a862" />
                    <circle cx="13" cy="13" r="10.5" stroke="#ffffff" strokeWidth="1" strokeDasharray="2 2" fill="none" opacity="0.5" />
                    <text x="13" y="18" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="sans-serif">$</text>
                  </g>

                  {/* Right: Green Calendar with Clock Badge */}
                  <g transform="translate(220, 58)">
                    {/* Calendar body */}
                    <rect x="0" y="6" width="58" height="52" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Calendar header */}
                    <rect x="0" y="6" width="58" height="16" rx="5" fill="#00a862" />
                    {/* Binder rings */}
                    <rect x="10" y="1" width="4" height="9" rx="2" fill="#334155" />
                    <rect x="27" y="1" width="4" height="9" rx="2" fill="#334155" />
                    <rect x="44" y="1" width="4" height="9" rx="2" fill="#334155" />

                    {/* Dates grid */}
                    <rect x="8" y="28" width="8" height="6" rx="1.5" fill="#e2e8f0" />
                    <rect x="20" y="28" width="8" height="6" rx="1.5" fill="#e2e8f0" />
                    <rect x="32" y="28" width="8" height="6" rx="1.5" fill="#00a862" opacity="0.3" />
                    <rect x="8" y="38" width="8" height="6" rx="1.5" fill="#e2e8f0" />
                    <rect x="20" y="38" width="8" height="6" rx="1.5" fill="#e2e8f0" />

                    {/* Clock Badge on bottom right corner */}
                    <g transform="translate(32, 28)">
                      <circle cx="16" cy="16" r="15" fill="#00a862" stroke="#ffffff" strokeWidth="2.5" />
                      <path d="M16 8 V16 H22" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                    </g>
                  </g>
                </svg>
              </div>

              {/* Title Text (Chính xác theo Ảnh 1) */}
              <h2
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "#1e293b",
                  margin: "12px 0 24px 0",
                  textAlign: "center",
                  maxWidth: 680,
                  lineHeight: 1.5,
                }}
              >
                Lập chứng từ phân bổ CCDC để phân bổ và hạch toán chi phí CCDC vào từng tháng
              </h2>

              {/* ACTION BUTTON: Thêm (Nút xanh đơn lẻ, chính xác theo Ảnh 1) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSelectPeriodModal(true)}
                  style={{
                    height: 34,
                    padding: "0 28px",
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#009959"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#00a862"; }}
                >
                  Thêm
                </button>
              </div>

              {/* BOTTOM BUTTON: Xem danh sách chứng từ (Chính xác theo Ảnh 1) */}
              <div style={{ marginTop: 28, paddingBottom: 10, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setAllocationViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e6f4ea"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>
            </div>
          ) : (
            /* List Mode for Phân bổ chi phí */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              {/* List Toolbar */}
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowSelectPeriodModal(true)}
                    style={{
                      height: 32,
                      padding: "0 18px",
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus size={15} />
                    <span>Thêm chứng từ</span>
                  </button>

                  <div style={{ position: "relative" }}>
                    <select
                      value={allocationFilterPeriod}
                      onChange={(e) => setAllocationFilterPeriod(e.target.value)}
                      style={{
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#ffffff",
                        color: "#1e293b",
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                      }}
                    >
                      <option value="Năm 2026">Năm 2026</option>
                      <option value="Tháng 9/2026">Tháng 9/2026</option>
                      <option value="Tháng 8/2026">Tháng 8/2026</option>
                      <option value="Tháng 7/2026">Tháng 7/2026</option>
                      <option value="Tất cả">Tất cả thời gian</option>
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                  </div>

                  <div style={{ position: "relative", width: 260 }}>
                    <input
                      type="text"
                      placeholder="Tìm kiếm số CT, diễn giải..."
                      value={allocationSearch}
                      onChange={(e) => setAllocationSearch(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 10px 0 32px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Đã xuất danh sách chứng từ phân bổ ra file Excel")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Xuất Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllocationViewMode("landing")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Eye size={14} />
                    <span>Xem hình minh họa</span>
                  </button>
                </div>
              </div>

              {/* Table of Allocation Vouchers */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 40, padding: "9px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                      <th style={{ width: 120, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày hạch toán</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày CT</th>
                      <th style={{ minWidth: 260, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                      <th style={{ width: 140, padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng số tiền</th>
                      <th style={{ width: 140, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Người lập</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái</th>
                      <th style={{ width: 120, padding: "9px", textAlign: "center" }}>Chức năng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationVouchers
                      .filter(
                        (v) =>
                          v.voucherNo.toLowerCase().includes(allocationSearch.toLowerCase()) ||
                          v.reason.toLowerCase().includes(allocationSearch.toLowerCase())
                      )
                      .map((v, i) => (
                        <tr
                          key={v.voucherNo}
                          style={{ borderBottom: "1px solid #e2e8f0" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                        >
                          <td style={{ textAlign: "center", padding: "9px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                          <td
                            onClick={() => {
                              setAllocationVoucherNo(v.voucherNo);
                              setAllocationPostingDate(v.postingDate);
                              setAllocationVoucherDate(v.voucherDate);
                              setAllocationReason(v.reason);
                              setShowAllocationVoucherModal(true);
                            }}
                            style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer" }}
                          >
                            {v.voucherNo}
                          </td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.postingDate}</td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.voucherDate}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0" }}>{v.reason}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#00a862" }}>
                            {formatVND(v.totalAmount)}
                          </td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.creator}</td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <span style={{ fontSize: 11.5, background: "#e6f4ea", color: "#00a862", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: "9px", textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setAllocationVoucherNo(v.voucherNo);
                                  setAllocationPostingDate(v.postingDate);
                                  setAllocationVoucherDate(v.voucherDate);
                                  setAllocationReason(v.reason);
                                  setShowAllocationVoucherModal(true);
                                }}
                                style={{ border: "none", background: "transparent", color: "#00a862", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                              >
                                Xem
                              </button>
                              <span style={{ color: "#cbd5e1" }}>|</span>
                              <button
                                type="button"
                                onClick={() => notify(`In chứng từ phân bổ ${v.voucherNo}`)}
                                style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer" }}
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

              {/* Bottom List Summary */}
              <div
                style={{
                  height: 38,
                  background: "#f1f5f9",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                <span>Số lượng chứng từ: {allocationVouchers.length}</span>
                <span>
                  Tổng tiền phân bổ:{" "}
                  <span style={{ color: "#00a862", fontWeight: 700 }}>
                    {formatVND(allocationVouchers.reduce((s, c) => s + c.totalAmount, 0))}
                  </span>
                </span>
              </div>
            </div>
          )
        )}

        {/* SUBTAB CONTENT: ĐIỀU CHỈNH CÔNG CỤ DỤNG CỤ (Ảnh 1 & 2 của user) */}
        {managementSubtab === "adjustment" && (
          adjustmentViewMode === "landing" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                padding: "50px 20px 30px 20px",
                boxSizing: "border-box",
                background: "#ffffff",
                minHeight: "calc(100vh - 180px)",
                position: "relative",
              }}
            >
              {/* Illustration: 2 Green Tools -> Dotted line through Page with chart -> Calculator & $ & Trend dots (Ảnh 1) */}
              <div style={{ marginBottom: 16 }}>
                <svg width="360" height="170" viewBox="0 0 360 170" fill="none">
                  {/* Ambient 4-point sparkles */}
                  <path d="M192 32 L194 36 L198 38 L194 40 L192 44 L190 40 L186 38 L190 36 Z" fill="#00a862" opacity="0.6" />
                  <path d="M218 24 L220 28 L224 30 L220 32 L218 36 L216 32 L212 30 L216 28 Z" fill="#00a862" opacity="0.7" />
                  <path d="M188 126 L190 130 L194 132 L190 134 L188 138 L186 134 L182 132 L186 130 Z" fill="#00a862" opacity="0.6" />
                  <circle cx="178" cy="40" r="2" fill="#00a862" opacity="0.5" />
                  <circle cx="182" cy="115" r="2" fill="#00a862" opacity="0.5" />

                  {/* Dotted connecting line from left through page to right */}
                  <path d="M110 92 L 216 92" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" />

                  {/* Soft Document Drop Shadow */}
                  <rect x="194" y="60" width="58" height="66" rx="8" fill="#f1f5f9" />

                  {/* Document Sheet (Center) */}
                  <g transform="translate(190, 52)">
                    {/* Page base */}
                    <path d="M0 6 C 0 2.7, 2.7 0, 6 0 L 36 0 L 52 16 L 52 64 C 52 67.3, 49.3 70, 46 70 L 6 70 C 2.7 70, 0 67.3, 0 64 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Folded corner */}
                    <path d="M36 0 L 36 16 L 52 16 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
                    
                    {/* Green pie / circle icon on document */}
                    <circle cx="20" cy="30" r="11" fill="#e2e8f0" />
                    <path d="M20 30 L 20 19 A 11 11 0 0 1 31 30 Z" fill="#00a862" />
                    <path d="M20 30 L 31 30 A 11 11 0 0 1 20 41 Z" fill="#00a862" opacity="0.8" />
                    <circle cx="20" cy="30" r="4" fill="#ffffff" />

                    {/* Green horizontal content lines on document */}
                    <rect x="10" y="47" width="32" height="4" rx="2" fill="#00a862" />
                    <rect x="10" y="55" width="20" height="4" rx="2" fill="#cbd5e1" />
                  </g>

                  {/* Left: 2 Green Tools standing */}
                  <g transform="translate(125, 62)">
                    {/* Tool 1 (Wrench / Spanner left) */}
                    <g transform="translate(0, 0)">
                      <rect x="5" y="8" width="6" height="24" rx="2" fill="#00a862" />
                      <circle cx="8" cy="8" r="7" fill="#00a862" />
                      <circle cx="8" cy="8" r="3.5" fill="#ffffff" />
                      <rect x="6" y="1" width="4" height="6" fill="#ffffff" />
                    </g>

                    {/* Tool 2 (Screwdriver / Pliers right) */}
                    <g transform="translate(18, 0)">
                      <rect x="4" y="6" width="5" height="26" rx="2" fill="#00a862" />
                      <circle cx="6.5" cy="5" r="5" fill="#00a862" />
                      <rect x="5" y="-1" width="3" height="6" rx="1" fill="#00a862" />
                    </g>
                  </g>

                  {/* Right: Green Calculator + Dollar Badge + Trend dots */}
                  <g transform="translate(262, 70)">
                    {/* Calculator Body */}
                    <rect x="0" y="6" width="26" height="34" rx="4" fill="#00a862" />
                    {/* Screen */}
                    <rect x="3" y="10" width="20" height="7" rx="1.5" fill="#ffffff" />
                    {/* Buttons */}
                    <circle cx="7" cy="22" r="1.5" fill="#ffffff" />
                    <circle cx="13" cy="22" r="1.5" fill="#ffffff" />
                    <circle cx="19" cy="22" r="1.5" fill="#ffffff" />
                    <circle cx="7" cy="28" r="1.5" fill="#ffffff" />
                    <circle cx="13" cy="28" r="1.5" fill="#ffffff" />
                    <circle cx="19" cy="28" r="1.5" fill="#ffffff" />
                    <circle cx="7" cy="34" r="1.5" fill="#ffffff" />
                    <rect x="11.5" y="32.5" width="9" height="3" rx="1" fill="#ffffff" />

                    {/* Dollar Badge next to calculator */}
                    <g transform="translate(24, 18)">
                      <circle cx="8" cy="8" r="9" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
                      <text x="8" y="12" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">$</text>
                    </g>

                    {/* Trend dots above */}
                    <circle cx="20" cy="1" r="2" fill="#00a862" />
                    <circle cx="28" cy="-5" r="2.5" fill="#00a862" />
                    <circle cx="36" cy="-10" r="3" fill="#00a862" />
                    <path d="M16 6 L 20 1 L 28 -5 L 36 -10" stroke="#00a862" strokeWidth="1" strokeDasharray="2 2" fill="none" />
                  </g>
                </svg>
              </div>

              {/* Title Text (Chính xác theo Ảnh 1) */}
              <h2
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "#1e293b",
                  margin: "12px 0 24px 0",
                  textAlign: "center",
                  maxWidth: 720,
                  lineHeight: 1.5,
                }}
              >
                Lập chứng từ điều chỉnh CCDC để điều chỉnh giá trị hoặc số kỳ phân bổ của CCDC khi CCDC được nâng cấp hoặc tháo dỡ bớt bộ phận
              </h2>

              {/* ACTION BUTTON: Thêm (Nút xanh đơn lẻ, chính xác theo Ảnh 1) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(true)}
                  style={{
                    height: 34,
                    padding: "0 28px",
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#009959"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#00a862"; }}
                >
                  Thêm
                </button>
              </div>

              {/* BOTTOM BUTTON: Xem danh sách chứng từ (Chính xác theo Ảnh 1) */}
              <div style={{ marginTop: 28, paddingBottom: 10, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setAdjustmentViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e6f4ea"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>
            </div>
          ) : (
            /* List Mode for Điều chỉnh CCDC */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              {/* List Toolbar */}
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowAdjustmentModal(true)}
                    style={{
                      height: 32,
                      padding: "0 18px",
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus size={15} />
                    <span>Thêm chứng từ</span>
                  </button>

                  <div style={{ position: "relative" }}>
                    <select
                      value={adjustmentFilterPeriod}
                      onChange={(e) => setAdjustmentFilterPeriod(e.target.value)}
                      style={{
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#ffffff",
                        color: "#1e293b",
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                      }}
                    >
                      <option value="Năm 2026">Năm 2026</option>
                      <option value="Tháng 9/2026">Tháng 9/2026</option>
                      <option value="Tháng 8/2026">Tháng 8/2026</option>
                      <option value="Tất cả">Tất cả thời gian</option>
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                  </div>

                  <div style={{ position: "relative", width: 260 }}>
                    <input
                      type="text"
                      placeholder="Tìm kiếm số CT, lý do..."
                      value={adjustmentSearch}
                      onChange={(e) => setAdjustmentSearch(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 10px 0 32px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Đã xuất danh sách chứng từ điều chỉnh CCDC ra file Excel")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Xuất Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentViewMode("landing")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Eye size={14} />
                    <span>Xem hình minh họa</span>
                  </button>
                </div>
              </div>

              {/* Table of Adjustment Vouchers */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 40, padding: "9px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                      <th style={{ width: 120, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                      <th style={{ minWidth: 260, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do điều chỉnh</th>
                      <th style={{ width: 140, padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền điều chỉnh</th>
                      <th style={{ width: 140, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Người lập</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái</th>
                      <th style={{ width: 120, padding: "9px", textAlign: "center" }}>Chức năng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentVouchers
                      .filter(
                        (v) =>
                          v.voucherNo.toLowerCase().includes(adjustmentSearch.toLowerCase()) ||
                          v.reason.toLowerCase().includes(adjustmentSearch.toLowerCase())
                      )
                      .map((v, i) => (
                        <tr
                          key={v.voucherNo}
                          style={{ borderBottom: "1px solid #e2e8f0" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                        >
                          <td style={{ textAlign: "center", padding: "9px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                          <td
                            onClick={() => {
                              setAdjustmentVoucherNo(v.voucherNo);
                              setAdjustmentVoucherDate(v.voucherDate);
                              setAdjustmentReason(v.reason);
                              setShowAdjustmentModal(true);
                            }}
                            style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer" }}
                          >
                            {v.voucherNo}
                          </td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.voucherDate}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0" }}>{v.reason}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: v.adjustmentAmount >= 0 ? "#00a862" : "#ef4444" }}>
                            {formatVND(v.adjustmentAmount)}
                          </td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.creator}</td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <span style={{ fontSize: 11.5, background: "#e6f4ea", color: "#00a862", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: "9px", textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustmentVoucherNo(v.voucherNo);
                                  setAdjustmentVoucherDate(v.voucherDate);
                                  setAdjustmentReason(v.reason);
                                  setShowAdjustmentModal(true);
                                }}
                                style={{ border: "none", background: "transparent", color: "#00a862", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                              >
                                Xem
                              </button>
                              <span style={{ color: "#cbd5e1" }}>|</span>
                              <button
                                type="button"
                                onClick={() => notify(`In chứng từ điều chỉnh ${v.voucherNo}`)}
                                style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer" }}
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

              {/* Bottom List Summary */}
              <div
                style={{
                  height: 38,
                  background: "#f1f5f9",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                <span>Số lượng chứng từ: {adjustmentVouchers.length}</span>
                <span>
                  Tổng tiền điều chỉnh:{" "}
                  <span style={{ color: "#00a862", fontWeight: 700 }}>
                    {formatVND(adjustmentVouchers.reduce((s, c) => s + c.adjustmentAmount, 0))}
                  </span>
                </span>
              </div>
            </div>
          )
        )}

        {/* SUBTAB CONTENT: ĐIỀU CHUYỂN CÔNG CỤ DỤNG CỤ (Ảnh 1 & 2 của user) */}
        {managementSubtab === "transfer" && (
          transferViewMode === "landing" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                padding: "50px 20px 30px 20px",
                boxSizing: "border-box",
                background: "#ffffff",
                minHeight: "calc(100vh - 180px)",
                position: "relative",
              }}
            >
              {/* Illustration: Left 2 Green Tools -> Dotted arrow through Center Document -> Right 2 Gray Tools + Avatars */}
              <div style={{ marginBottom: 18 }}>
                <svg width="380" height="175" viewBox="0 0 380 175" fill="none">
                  {/* Ambient 4-point sparkles & pluses */}
                  <path d="M204 32 L206 36 L210 38 L206 40 L204 44 L202 40 L198 38 L202 36 Z" fill="#00a862" opacity="0.6" />
                  <path d="M192 136 L194 140 L198 142 L194 144 L192 148 L190 144 L186 142 L190 140 Z" fill="#00a862" opacity="0.5" />
                  <path d="M280 28 L284 28 M282 26 L282 30" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M110 34 L114 34 M112 32 L112 36" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="106" cy="120" r="2" fill="#00a862" opacity="0.5" />
                  <circle cx="272" cy="138" r="2.5" fill="#94a3b8" opacity="0.5" />

                  {/* Dotted connecting line with arrow from left through document to right */}
                  <path d="M130 92 L 255 92" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                  <path d="M252 88 L 258 92 L 252 96" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

                  {/* Soft Document Drop Shadow */}
                  <rect x="194" y="60" width="58" height="68" rx="8" fill="#f1f5f9" />

                  {/* Document Sheet (Center) */}
                  <g transform="translate(190, 52)">
                    {/* Base document */}
                    <path d="M0 6 C 0 2.7, 2.7 0, 6 0 L 36 0 L 52 16 L 52 64 C 52 67.3, 49.3 70, 46 70 L 6 70 C 2.7 70, 0 67.3, 0 64 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Folded corner */}
                    <path d="M36 0 L 36 16 L 52 16 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
                    
                    {/* Green folder fold / badge on center document */}
                    <path d="M8 20 C 8 13.4, 13.4 8, 20 8 L 26 8 C 29.3 8, 32 10.7, 32 14 L 32 30 C 32 33.3, 29.3 36, 26 36 L 14 36 C 10.7 36, 8 33.3, 8 30 Z" fill="#00a862" />
                    <circle cx="20" cy="22" r="5" fill="#ffffff" opacity="0.9" />

                    {/* Green horizontal content lines */}
                    <rect x="10" y="44" width="32" height="4" rx="2" fill="#00a862" />
                    <rect x="10" y="52" width="22" height="4" rx="2" fill="#cbd5e1" />
                  </g>

                  {/* Left: 2 Green Tools (Wrench + Pliers/Screwdriver) */}
                  <g transform="translate(118, 62)">
                    {/* Tool 1: Wrench (Green) */}
                    <g transform="translate(0, 0)">
                      <rect x="5" y="8" width="6" height="24" rx="2" fill="#00a862" />
                      <circle cx="8" cy="8" r="7.5" fill="#00a862" />
                      <circle cx="8" cy="8" r="3.5" fill="#ffffff" />
                      <rect x="6" y="0.5" width="4" height="6" fill="#ffffff" />
                    </g>

                    {/* Tool 2: Screwdriver/Pliers (Green) */}
                    <g transform="translate(18, 0)">
                      <rect x="4" y="6" width="5.5" height="26" rx="2" fill="#00a862" />
                      <circle cx="6.7" cy="5" r="5" fill="#00a862" />
                      <rect x="5.2" y="-1" width="3" height="6" rx="1" fill="#00a862" />
                    </g>
                  </g>

                  {/* Right: 2 Gray Tools (Wrench + Screwdriver) */}
                  <g transform="translate(262, 54)">
                    {/* Tool 1: Wrench (Gray) */}
                    <g transform="translate(0, 0)">
                      <rect x="5" y="8" width="6" height="24" rx="2" fill="#cbd5e1" />
                      <circle cx="8" cy="8" r="7.5" fill="#cbd5e1" />
                      <circle cx="8" cy="8" r="3.5" fill="#ffffff" />
                      <rect x="6" y="0.5" width="4" height="6" fill="#ffffff" />
                    </g>

                    {/* Tool 2: Screwdriver/Pliers (Gray) */}
                    <g transform="translate(18, 0)">
                      <rect x="4" y="6" width="5.5" height="26" rx="2" fill="#cbd5e1" />
                      <circle cx="6.7" cy="5" r="5" fill="#cbd5e1" />
                      <rect x="5.2" y="-1" width="3" height="6" rx="1" fill="#cbd5e1" />
                    </g>
                  </g>

                  {/* Avatars: People figures representing transfer of responsibility */}
                  {/* Green person near bottom right of document */}
                  <g transform="translate(225, 128)">
                    <circle cx="8" cy="6" r="4.5" fill="#00a862" />
                    <path d="M2 18 C 2 13.5, 4.5 12, 8 12 C 11.5 12, 14 13.5, 14 18 Z" fill="#00a862" />
                  </g>

                  {/* Gray person 1 standing near right tools */}
                  <g transform="translate(275, 102)">
                    <circle cx="8" cy="6" r="4.5" fill="#94a3b8" />
                    <path d="M2 18 C 2 13.5, 4.5 12, 8 12 C 11.5 12, 14 13.5, 14 18 Z" fill="#94a3b8" />
                  </g>

                  {/* Gray person 2 standing higher right */}
                  <g transform="translate(290, 78)">
                    <circle cx="7" cy="5" r="4" fill="#cbd5e1" />
                    <path d="M1.5 16 C 1.5 12, 4 10.5, 7 10.5 C 10 10.5, 12.5 12, 12.5 16 Z" fill="#cbd5e1" />
                  </g>
                </svg>
              </div>

              {/* Title Text (Chính xác theo Ảnh 1) */}
              <h2
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "#1e293b",
                  margin: "12px 0 24px 0",
                  textAlign: "center",
                  maxWidth: 720,
                  lineHeight: 1.5,
                }}
              >
                Lập chứng từ điều chuyển để ghi nhận vào sổ theo dõi CCDC việc điều chuyển CCDC từ đơn vị sử dụng này sang đơn vị sử dụng khác
              </h2>

              {/* ACTION BUTTON: Thêm (Nút xanh đặc theo Ảnh 1) */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setTransferVoucherNo("ĐCCC00001");
                    setTransferVoucherDate("30/09/2026");
                    setTransferDeliverer("");
                    setTransferReceiver("");
                    setTransferReason("");
                    setShowTransferModal(true);
                  }}
                  style={{
                    height: 34,
                    padding: "0 28px",
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#009959"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#00a862"; }}
                >
                  Thêm
                </button>
              </div>

              {/* BOTTOM BUTTON: Xem danh sách chứng từ (Chính xác theo Ảnh 1) */}
              <div style={{ marginTop: 28, paddingBottom: 10, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setTransferViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e6f4ea"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>
            </div>
          ) : (
            /* List Mode for Điều chuyển CCDC */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              {/* List Toolbar */}
              <div
                style={{
                  height: 48,
                  padding: "0 16px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#ffffff",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferVoucherNo(`ĐCCC${String(transferVouchers.length + 1).padStart(5, "0")}`);
                      setTransferVoucherDate("30/09/2026");
                      setTransferDeliverer("");
                      setTransferReceiver("");
                      setTransferReason("");
                      setShowTransferModal(true);
                    }}
                    style={{
                      height: 32,
                      padding: "0 18px",
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus size={15} />
                    <span>Thêm chứng từ</span>
                  </button>

                  <div style={{ position: "relative" }}>
                    <select
                      value={transferFilterPeriod}
                      onChange={(e) => setTransferFilterPeriod(e.target.value)}
                      style={{
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#ffffff",
                        color: "#1e293b",
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                      }}
                    >
                      <option value="Năm 2026">Năm 2026</option>
                      <option value="Tháng 9/2026">Tháng 9/2026</option>
                      <option value="Tháng 8/2026">Tháng 8/2026</option>
                      <option value="Tất cả">Tất cả thời gian</option>
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                  </div>

                  <div style={{ position: "relative", width: 280 }}>
                    <input
                      type="text"
                      placeholder="Tìm kiếm số CT, lý do, người giao/nhận..."
                      value={transferSearch}
                      onChange={(e) => setTransferSearch(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 10px 0 32px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Đã xuất danh sách chứng từ điều chuyển CCDC ra file Excel")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Xuất Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferViewMode("landing")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Eye size={14} />
                    <span>Xem hình minh họa</span>
                  </button>
                </div>
              </div>

              {/* Table of Transfer Vouchers */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 40, padding: "9px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                      <th style={{ width: 130, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                      <th style={{ width: 160, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Người bàn giao</th>
                      <th style={{ width: 160, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Người tiếp nhận</th>
                      <th style={{ minWidth: 260, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do điều chuyển</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center" }}>Chức năng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferVouchers
                      .filter((v) => {
                        if (!transferSearch) return true;
                        const q = transferSearch.toLowerCase();
                        return (
                          v.voucherNo.toLowerCase().includes(q) ||
                          v.reason.toLowerCase().includes(q) ||
                          (v.deliverer && v.deliverer.toLowerCase().includes(q)) ||
                          (v.receiver && v.receiver.toLowerCase().includes(q))
                        );
                      })
                      .map((v, i) => (
                        <tr
                          key={v.voucherNo}
                          style={{
                            borderBottom: "1px solid #e2e8f0",
                            background: i % 2 === 1 ? "#fafafa" : "#ffffff",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 1 ? "#fafafa" : "#ffffff"; }}
                        >
                          <td style={{ padding: "9px 4px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                            {i + 1}
                          </td>
                          <td
                            onClick={() => {
                              setTransferVoucherNo(v.voucherNo);
                              setTransferVoucherDate(v.voucherDate);
                              setTransferDeliverer(v.deliverer);
                              setTransferReceiver(v.receiver);
                              setTransferReason(v.reason);
                              setShowTransferModal(true);
                            }}
                            style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer" }}
                          >
                            {v.voucherNo}
                          </td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.voucherDate}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", color: "#334155" }}>{v.deliverer}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", color: "#334155" }}>{v.receiver}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0" }}>{v.reason}</td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <span style={{ fontSize: 11.5, background: "#e6f4ea", color: "#00a862", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: "9px", textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferVoucherNo(v.voucherNo);
                                  setTransferVoucherDate(v.voucherDate);
                                  setTransferDeliverer(v.deliverer);
                                  setTransferReceiver(v.receiver);
                                  setTransferReason(v.reason);
                                  setShowTransferModal(true);
                                }}
                                style={{ border: "none", background: "transparent", color: "#00a862", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                              >
                                Xem
                              </button>
                              <span style={{ color: "#cbd5e1" }}>|</span>
                              <button
                                type="button"
                                onClick={() => notify(`In chứng từ điều chuyển ${v.voucherNo}`)}
                                style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer" }}
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

              {/* Bottom List Summary */}
              <div
                style={{
                  height: 38,
                  background: "#f1f5f9",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                <span>Số lượng chứng từ: {transferVouchers.length}</span>
              </div>
            </div>
          )
        )}

        {/* SUBTAB CONTENT: GHI GIẢM CÔNG CỤ DỤNG CỤ (Ảnh 1 & 2 của user) */}
        {managementSubtab === "decrease" && (
          decreaseViewMode === "landing" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                padding: "50px 20px 30px 20px",
                boxSizing: "border-box",
                background: "#ffffff",
                minHeight: "calc(100vh - 180px)",
                position: "relative",
              }}
            >
              {/* Illustration: Left 2 Tools -> Dotted arrow through Center Document with Chart -> Right 2 Wrenches with curved arrows & Toolbox */}
              <div style={{ marginBottom: 18 }}>
                <svg width="380" height="175" viewBox="0 0 380 175" fill="none">
                  {/* Ambient 4-point sparkles & pluses */}
                  <path d="M204 32 L206 36 L210 38 L206 40 L204 44 L202 40 L198 38 L202 36 Z" fill="#00a862" opacity="0.6" />
                  <path d="M280 26 L284 26 M282 24 L282 28" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M110 36 L114 36 M112 34 L112 38" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="106" cy="120" r="2" fill="#00a862" opacity="0.5" />
                  <circle cx="272" cy="138" r="2.5" fill="#94a3b8" opacity="0.5" />
                  <circle cx="192" cy="136" r="2" fill="#00a862" opacity="0.6" />

                  {/* Dotted connecting line from left across document to right */}
                  <path d="M130 92 L 245 92" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                  <path d="M242 88 L 248 92 L 242 96" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

                  {/* Soft Document Drop Shadow */}
                  <rect x="194" y="60" width="58" height="68" rx="8" fill="#f1f5f9" />

                  {/* Document Sheet (Center) */}
                  <g transform="translate(190, 52)">
                    <path d="M0 6 C 0 2.7, 2.7 0, 6 0 L 36 0 L 52 16 L 52 64 C 52 67.3, 49.3 70, 46 70 L 6 70 C 2.7 70, 0 67.3, 0 64 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                    <path d="M36 0 L 36 16 L 52 16 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
                    
                    {/* Green circular pie chart on document */}
                    <circle cx="24" cy="28" r="11" fill="#e2e8f0" />
                    <path d="M24 28 L 24 17 A 11 11 0 0 1 35 28 Z" fill="#00a862" />
                    <circle cx="24" cy="28" r="4" fill="#ffffff" />

                    {/* Content lines */}
                    <rect x="10" y="45" width="32" height="4" rx="2" fill="#00a862" />
                    <rect x="10" y="53" width="20" height="4" rx="2" fill="#cbd5e1" />
                  </g>

                  {/* Left: 2 Tools (1 Green Wrench + 1 Gray Tool) */}
                  <g transform="translate(116, 62)">
                    {/* Tool 1: Green Wrench */}
                    <g transform="translate(0, 0)">
                      <rect x="5" y="8" width="6" height="24" rx="2" fill="#00a862" />
                      <circle cx="8" cy="8" r="7.5" fill="#00a862" />
                      <circle cx="8" cy="8" r="3.5" fill="#ffffff" />
                      <rect x="6" y="0.5" width="4" height="6" fill="#ffffff" />
                    </g>

                    {/* Tool 2: Gray Tool */}
                    <g transform="translate(18, 0)">
                      <rect x="4" y="6" width="5.5" height="26" rx="2" fill="#cbd5e1" />
                      <circle cx="6.7" cy="5" r="5" fill="#cbd5e1" />
                      <rect x="5.2" y="-1" width="3" height="6" rx="1" fill="#cbd5e1" />
                    </g>
                  </g>

                  {/* Right: Green Wrench 1 (Top, pointing up with curved arrow) */}
                  <g transform="translate(262, 44)">
                    <g transform="rotate(45, 12, 12)">
                      <rect x="9" y="8" width="5" height="18" rx="1.5" fill="#00a862" />
                      <circle cx="11.5" cy="7" r="6" fill="#00a862" />
                      <circle cx="11.5" cy="7" r="2.5" fill="#ffffff" />
                      <rect x="10" y="1" width="3" height="5" fill="#ffffff" />
                    </g>
                    {/* Curved arrow pointing up-right */}
                    <path d="M24 16 C 30 14, 35 11, 38 7" stroke="#00a862" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M34 6 L 39 6 L 38 11" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </g>

                  {/* Right: Green Wrench 2 (Middle, pointing down with curved arrow) */}
                  <g transform="translate(262, 88)">
                    <g transform="rotate(-45, 12, 12)">
                      <rect x="9" y="8" width="5" height="18" rx="1.5" fill="#00a862" />
                      <circle cx="11.5" cy="7" r="6" fill="#00a862" />
                      <circle cx="11.5" cy="7" r="2.5" fill="#ffffff" />
                      <rect x="10" y="1" width="3" height="5" fill="#ffffff" />
                    </g>
                    {/* Curved arrow pointing down-right */}
                    <path d="M24 8 C 30 10, 35 13, 38 17" stroke="#00a862" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M38 12 L 39 17 L 34 17" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </g>

                  {/* Right: Toolbox / Container (Bottom right) */}
                  <g transform="translate(268, 134)">
                    <rect x="0" y="4" width="28" height="16" rx="2" fill="#cbd5e1" />
                    <rect x="0" y="10" width="28" height="4" fill="#94a3b8" />
                    <rect x="8" y="0" width="12" height="4" rx="1" fill="#00a862" />
                    <line x1="2" y1="20" x2="6" y2="23" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                    <line x1="26" y1="20" x2="22" y2="23" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                  </g>
                </svg>
              </div>

              {/* Title Text (Chính xác theo Ảnh 2) */}
              <h2
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "#1e293b",
                  margin: "12px 0 24px 0",
                  textAlign: "center",
                  maxWidth: 720,
                  lineHeight: 1.5,
                }}
              >
                Lập chứng từ ghi giảm trên sổ theo dõi CCDC khi thanh lý nhượng bán, phát hiện thiếu khi kiểm kê hoặc nhập lại kho CCDC không sử dụng
              </h2>

              {/* ACTION BUTTON: Thêm (Nút xanh đặc theo Ảnh 2) */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setDecreaseVoucherNo("GGCC00001");
                    setDecreaseVoucherDate("30/09/2026");
                    setDecreaseReason("Nhượng bán, Thanh lý");
                    setShowDecreaseModal(true);
                  }}
                  style={{
                    height: 34,
                    padding: "0 28px",
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#009959"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#00a862"; }}
                >
                  Thêm
                </button>
              </div>

              {/* BOTTOM BUTTON: Xem danh sách chứng từ (Chính xác theo Ảnh 2) */}
              <div style={{ marginTop: 28, paddingBottom: 10, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setDecreaseViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e6f4ea"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>
            </div>
          ) : (
            /* List Mode for Ghi giảm CCDC */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              {/* List Toolbar */}
              <div
                style={{
                  height: 48,
                  padding: "0 16px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#ffffff",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDecreaseVoucherNo(`GGCC${String(decreaseVouchers.length + 1).padStart(5, "0")}`);
                      setDecreaseVoucherDate("30/09/2026");
                      setDecreaseReason("Nhượng bán, Thanh lý");
                      setShowDecreaseModal(true);
                    }}
                    style={{
                      height: 32,
                      padding: "0 18px",
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus size={15} />
                    <span>Thêm chứng từ</span>
                  </button>

                  <div style={{ position: "relative" }}>
                    <select
                      value={decreaseFilterPeriod}
                      onChange={(e) => setDecreaseFilterPeriod(e.target.value)}
                      style={{
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#ffffff",
                        color: "#1e293b",
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                      }}
                    >
                      <option value="Năm 2026">Năm 2026</option>
                      <option value="Tháng 9/2026">Tháng 9/2026</option>
                      <option value="Tháng 8/2026">Tháng 8/2026</option>
                      <option value="Tất cả">Tất cả thời gian</option>
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                  </div>

                  <div style={{ position: "relative", width: 280 }}>
                    <input
                      type="text"
                      placeholder="Tìm kiếm số CT, lý do ghi giảm..."
                      value={decreaseSearch}
                      onChange={(e) => setDecreaseSearch(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 10px 0 32px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Đã xuất danh sách chứng từ ghi giảm CCDC ra file Excel")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Xuất Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecreaseViewMode("landing")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Eye size={14} />
                    <span>Xem hình minh họa</span>
                  </button>
                </div>
              </div>

              {/* Table of Decrease Vouchers */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 40, padding: "9px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                      <th style={{ width: 130, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                      <th style={{ minWidth: 260, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do ghi giảm</th>
                      <th style={{ width: 130, padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng ghi giảm</th>
                      <th style={{ width: 180, padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị ghi giảm</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center" }}>Chức năng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decreaseVouchers
                      .filter((v) => {
                        if (!decreaseSearch) return true;
                        const q = decreaseSearch.toLowerCase();
                        return (
                          v.voucherNo.toLowerCase().includes(q) ||
                          v.reason.toLowerCase().includes(q)
                        );
                      })
                      .map((v, i) => (
                        <tr
                          key={v.voucherNo}
                          style={{
                            borderBottom: "1px solid #e2e8f0",
                            background: i % 2 === 1 ? "#fafafa" : "#ffffff",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 1 ? "#fafafa" : "#ffffff"; }}
                        >
                          <td style={{ padding: "9px 4px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                            {i + 1}
                          </td>
                          <td
                            onClick={() => {
                              setDecreaseVoucherNo(v.voucherNo);
                              setDecreaseVoucherDate(v.voucherDate);
                              setDecreaseReason(v.reason);
                              setShowDecreaseModal(true);
                            }}
                            style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer" }}
                          >
                            {v.voucherNo}
                          </td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.voucherDate}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0" }}>{v.reason}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 500 }}>
                            {v.totalQty ? `${v.totalQty},00` : "0,00"}
                          </td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#ef4444" }}>
                            {v.totalRemainingAmount ? formatVND(v.totalRemainingAmount) : "0"}
                          </td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <span style={{ fontSize: 11.5, background: "#e6f4ea", color: "#00a862", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: "9px", textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setDecreaseVoucherNo(v.voucherNo);
                                  setDecreaseVoucherDate(v.voucherDate);
                                  setDecreaseReason(v.reason);
                                  setShowDecreaseModal(true);
                                }}
                                style={{ border: "none", background: "transparent", color: "#00a862", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                              >
                                Xem
                              </button>
                              <span style={{ color: "#cbd5e1" }}>|</span>
                              <button
                                type="button"
                                onClick={() => notify(`In chứng từ ghi giảm ${v.voucherNo}`)}
                                style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer" }}
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

              {/* Bottom List Summary */}
              <div
                style={{
                  height: 38,
                  background: "#f1f5f9",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                <span>Số lượng chứng từ: {decreaseVouchers.length}</span>
                <span>
                  Tổng giá trị ghi giảm:{" "}
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>
                    {formatVND(decreaseVouchers.reduce((s, c) => s + c.totalRemainingAmount, 0))}
                  </span>
                </span>
              </div>
            </div>
          )
        )}

        {/* SUBTAB CONTENT: KIỂM KÊ CÔNG CỤ DỤNG CỤ (Ảnh của user) */}
        {managementSubtab === "stocktake" && (
          stocktakeViewMode === "landing" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                padding: "50px 20px 30px 20px",
                boxSizing: "border-box",
                background: "#ffffff",
                minHeight: "calc(100vh - 180px)",
                position: "relative",
              }}
            >
              {/* Illustration: Left 2 Tools -> Center Inventory Checklist Clipboard -> Right Magnifying Glass with Checkmark */}
              <div style={{ marginBottom: 18 }}>
                <svg width="380" height="175" viewBox="0 0 380 175" fill="none">
                  {/* Ambient sparkles & pluses */}
                  <path d="M204 32 L206 36 L210 38 L206 40 L204 44 L202 40 L198 38 L202 36 Z" fill="#00a862" opacity="0.6" />
                  <path d="M280 26 L284 26 M282 24 L282 28" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M110 36 L114 36 M112 34 L112 38" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="106" cy="120" r="2" fill="#00a862" opacity="0.5" />
                  <circle cx="272" cy="138" r="2.5" fill="#94a3b8" opacity="0.5" />
                  <circle cx="255" cy="52" r="2.5" fill="#00a862" opacity="0.6" />

                  {/* Soft Document Drop Shadow */}
                  <rect x="194" y="60" width="62" height="74" rx="8" fill="#f1f5f9" />

                  {/* Clipboard / Inventory Checklist Sheet (Center) */}
                  <g transform="translate(186, 44)">
                    {/* Clipboard base */}
                    <rect x="-4" y="-4" width="70" height="88" rx="8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
                    {/* Metal clip at top */}
                    <rect x="18" y="-10" width="26" height="12" rx="3" fill="#94a3b8" />
                    <rect x="23" y="-7" width="16" height="5" rx="1.5" fill="#ffffff" />
                    
                    {/* White Paper Sheet */}
                    <rect x="0" y="2" width="62" height="78" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                    
                    {/* Checkbox item 1 (Checked green) */}
                    <rect x="8" y="16" width="9" height="9" rx="2" fill="#e6f4ea" stroke="#00a862" strokeWidth="1.2" />
                    <path d="M10 20.5 L 12.5 23 L 15.5 18" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <rect x="22" y="18" width="32" height="4" rx="2" fill="#00a862" />

                    {/* Checkbox item 2 (Checked green) */}
                    <rect x="8" y="32" width="9" height="9" rx="2" fill="#e6f4ea" stroke="#00a862" strokeWidth="1.2" />
                    <path d="M10 36.5 L 12.5 39 L 15.5 34" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <rect x="22" y="34" width="28" height="4" rx="2" fill="#cbd5e1" />

                    {/* Checkbox item 3 (Checked green) */}
                    <rect x="8" y="48" width="9" height="9" rx="2" fill="#e6f4ea" stroke="#00a862" strokeWidth="1.2" />
                    <path d="M10 52.5 L 12.5 55 L 15.5 50" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <rect x="22" y="50" width="24" height="4" rx="2" fill="#cbd5e1" />

                    {/* Checkbox item 4 */}
                    <rect x="8" y="64" width="9" height="9" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
                    <rect x="22" y="66" width="30" height="4" rx="2" fill="#e2e8f0" />
                  </g>

                  {/* Left: 2 Tools standing (Green Wrench + Gray Tool) */}
                  <g transform="translate(116, 68)">
                    <g transform="translate(0, 0)">
                      <rect x="5" y="8" width="6" height="24" rx="2" fill="#00a862" />
                      <circle cx="8" cy="8" r="7.5" fill="#00a862" />
                      <circle cx="8" cy="8" r="3.5" fill="#ffffff" />
                      <rect x="6" y="0.5" width="4" height="6" fill="#ffffff" />
                    </g>
                    <g transform="translate(18, 0)">
                      <rect x="4" y="6" width="5.5" height="26" rx="2" fill="#cbd5e1" />
                      <circle cx="6.7" cy="5" r="5" fill="#cbd5e1" />
                      <rect x="5.2" y="-1" width="3" height="6" rx="1" fill="#cbd5e1" />
                    </g>
                  </g>

                  {/* Right: Magnifying Glass + Pen Checking Items */}
                  <g transform="translate(268, 62)">
                    <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#00a862" strokeWidth="3" />
                    <circle cx="16" cy="16" r="11" fill="#e6f4ea" opacity="0.6" />
                    <line x1="26" y1="26" x2="38" y2="38" stroke="#00a862" strokeWidth="4" strokeLinecap="round" />
                    
                    <circle cx="16" cy="16" r="6" fill="#00a862" />
                    <path d="M13.5 16 L 15.5 18 L 19 14" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </g>
                </svg>
              </div>

              {/* Title Text (Chính xác theo Ảnh của user) */}
              <h2
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "#1e293b",
                  margin: "12px 0 24px 0",
                  textAlign: "center",
                  maxWidth: 720,
                  lineHeight: 1.5,
                }}
              >
                Lập biên bản kiểm kê CCDC để ghi nhận kết quả kiểm kê CCDC định kỳ và xử lý chênh lệch từ kiểm kê
              </h2>

              {/* ACTION BUTTON: Thêm (Nút xanh đặc theo Ảnh của user) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowStocktakeDateModal(true)}
                  style={{
                    height: 34,
                    padding: "0 28px",
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#009959"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#00a862"; }}
                >
                  Thêm
                </button>
              </div>

              {/* BOTTOM BUTTON: Xem danh sách chứng từ (Chính xác theo Ảnh của user) */}
              <div style={{ marginTop: 28, paddingBottom: 10, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setStocktakeViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e6f4ea"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>
            </div>
          ) : (
            /* List Mode for Kiểm kê CCDC */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              {/* List Toolbar */}
              <div
                style={{
                  height: 48,
                  padding: "0 16px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#ffffff",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowStocktakeDateModal(true)}
                    style={{
                      height: 32,
                      padding: "0 18px",
                      background: "#00a862",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus size={15} />
                    <span>Thêm biên bản</span>
                  </button>

                  <div style={{ position: "relative" }}>
                    <select
                      value={stocktakeFilterPeriod}
                      onChange={(e) => setStocktakeFilterPeriod(e.target.value)}
                      style={{
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#ffffff",
                        color: "#1e293b",
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                      }}
                    >
                      <option value="Năm 2026">Năm 2026</option>
                      <option value="Quý 3/2026">Quý 3/2026</option>
                      <option value="Quý 2/2026">Quý 2/2026</option>
                      <option value="Tất cả">Tất cả thời gian</option>
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                  </div>

                  <div style={{ position: "relative", width: 280 }}>
                    <input
                      type="text"
                      placeholder="Tìm kiếm số biên bản, mục đích..."
                      value={stocktakeSearch}
                      onChange={(e) => setStocktakeSearch(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 10px 0 32px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        outline: "none",
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Đã xuất danh sách biên bản kiểm kê CCDC ra file Excel")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Xuất Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStocktakeViewMode("landing")}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Eye size={14} />
                    <span>Xem hình minh họa</span>
                  </button>
                </div>
              </div>

              {/* Table of Stocktake Vouchers */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 40, padding: "9px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                      <th style={{ width: 130, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số biên bản</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày kiểm kê</th>
                      <th style={{ width: 120, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kiểm kê đến ngày</th>
                      <th style={{ minWidth: 260, padding: "9px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mục đích kiểm kê</th>
                      <th style={{ width: 110, padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>SL sổ sách</th>
                      <th style={{ width: 110, padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>SL thực tế</th>
                      <th style={{ width: 110, padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                      <th style={{ width: 130, padding: "9px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái</th>
                      <th style={{ width: 110, padding: "9px", textAlign: "center" }}>Chức năng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stocktakeVouchers
                      .filter((v) => {
                        if (!stocktakeSearch) return true;
                        const q = stocktakeSearch.toLowerCase();
                        return (
                          v.voucherNo.toLowerCase().includes(q) ||
                          v.purpose.toLowerCase().includes(q)
                        );
                      })
                      .map((v, i) => (
                        <tr
                          key={v.voucherNo}
                          style={{
                            borderBottom: "1px solid #e2e8f0",
                            background: i % 2 === 1 ? "#fafafa" : "#ffffff",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 1 ? "#fafafa" : "#ffffff"; }}
                        >
                          <td style={{ padding: "9px 4px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                            {i + 1}
                          </td>
                          <td
                            onClick={() => {
                              setStocktakeVoucherNo(v.voucherNo);
                              setStocktakeVoucherDate(v.voucherDate);
                              setStocktakeToDate(v.toDate);
                              setStocktakePurpose(v.purpose);
                              setShowStocktakeVoucherModal(true);
                            }}
                            style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer" }}
                          >
                            {v.voucherNo}
                          </td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.voucherDate}</td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.toDate}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0" }}>{v.purpose}</td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                            {v.bookQty ? `${v.bookQty},00` : "0,00"}
                          </td>
                          <td style={{ padding: "9px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>
                            {v.actualQty ? `${v.actualQty},00` : "0,00"}
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              borderRight: "1px solid #e2e8f0",
                              textAlign: "right",
                              fontWeight: 700,
                              color: v.diffQty === 0 ? "#00a862" : v.diffQty > 0 ? "#00a862" : "#ef4444",
                            }}
                          >
                            {v.diffQty ? `${v.diffQty},00` : "0,00"}
                          </td>
                          <td style={{ padding: "9px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <span style={{ fontSize: 11.5, background: "#e6f4ea", color: "#00a862", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: "9px", textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setStocktakeVoucherNo(v.voucherNo);
                                  setStocktakeVoucherDate(v.voucherDate);
                                  setStocktakeToDate(v.toDate);
                                  setStocktakePurpose(v.purpose);
                                  setShowStocktakeVoucherModal(true);
                                }}
                                style={{ border: "none", background: "transparent", color: "#00a862", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                              >
                                Xem
                              </button>
                              <span style={{ color: "#cbd5e1" }}>|</span>
                              <button
                                type="button"
                                onClick={() => notify(`In biên bản kiểm kê ${v.voucherNo}`)}
                                style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer" }}
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

              {/* Bottom List Summary */}
              <div
                style={{
                  height: 38,
                  background: "#f1f5f9",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                <span>Số lượng biên bản kiểm kê: {stocktakeVouchers.length}</span>
              </div>
            </div>
          )
        )}

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 4. TAB: CHI PHÍ TRẢ TRƯỚC (3 Trang theo ảnh người dùng)
  // =========================================================================
  if (tab === "prepaid") {
    // Helper lọc danh sách CPTT
    const filteredPrepaidList = prepaidExpensesList.filter((item) => {
      if (!prepaidSearch) return true;
      const q = prepaidSearch.toLowerCase();
      return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.dept.toLowerCase().includes(q);
    });

    const totalPrepaidOriginal = filteredPrepaidList.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const totalPrepaidAllocated = filteredPrepaidList.reduce((s, r) => s + (r.allocatedAmount || 0), 0);
    const totalPrepaidRemaining = filteredPrepaidList.reduce((s, r) => s + (r.remainingAmount || 0), 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        
        {/* Header Subtabs */}
        <div style={{ background: "#ffffff", padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 28, flexShrink: 0 }}>
          {[
            { id: "list", label: "Danh sách chi phí trả trước" },
            { id: "allocation", label: "Phân bổ chi phí trả trước" },
            { id: "decrease", label: "Ghi giảm" },
          ].map((sub) => {
            const isActive = prepaidSubtab === sub.id;
            return (
              <div
                key={sub.id}
                onClick={() => setPrepaidSubtab(sub.id as any)}
                style={{
                  padding: "12px 2px",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#00a862" : "#475569",
                  borderBottom: isActive ? "2.5px solid #00a862" : "2.5px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {sub.label}
              </div>
            );
          })}
        </div>

        {/* =================================================================== */}
        {/* SUBTAB 1: DANH SÁCH CHI PHÍ TRẢ TRƯỚC (ẢNH 1)                       */}
        {/* =================================================================== */}
        {prepaidSubtab === "list" && (
          prepaidViewMode === "landing" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 20px", boxSizing: "border-box" }}>
              {/* SVG Minh họa Ảnh 1: Tài liệu $ -> 3 nhánh $ -> 3 tờ lịch */}
              <div style={{ marginBottom: 20 }}>
                <svg width="280" height="150" viewBox="0 0 280 150" fill="none">
                  {/* Bóng mờ đáy */}
                  <ellipse cx="140" cy="140" rx="110" ry="8" fill="#f1f5f9" />

                  {/* Tài liệu bên trái */}
                  <rect x="42" y="32" width="54" height="74" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                  <path d="M42 36 C42 34 44 32 46 32 H82 L96 46 V50 H42 Z" fill="#00a862" />
                  <path d="M82 32 V46 H96 Z" fill="#00804c" />
                  {/* Biểu đồ cột */}
                  <rect x="52" y="74" width="7" height="22" rx="1.5" fill="#00a862" />
                  <rect x="65" y="62" width="7" height="34" rx="1.5" fill="#007848" />
                  <rect x="78" y="80" width="7" height="16" rx="1.5" fill="#10b981" />
                  {/* Badge $ trên tài liệu */}
                  <circle cx="86" cy="52" r="9" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="86" y="55.5" fill="#ffffff" fontSize="10.5" fontWeight="bold" textAnchor="middle">$</text>

                  {/* 3 nhánh nét đứt nối sang 3 tờ lịch */}
                  <path d="M96 74 C 120 74, 130 36, 172 36" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M96 74 C 120 74, 135 74, 172 74" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M96 74 C 120 74, 130 112, 172 112" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />

                  {/* Đồng xu $ trên mỗi nhánh */}
                  <circle cx="136" cy="46" r="8.5" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="136" y="49.5" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">$</text>

                  <circle cx="136" cy="74" r="8.5" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="136" y="77.5" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">$</text>

                  <circle cx="136" cy="102" r="8.5" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="136" y="105.5" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">$</text>

                  {/* 3 tờ lịch bên phải */}
                  {/* Tờ lịch 1 */}
                  <rect x="174" y="20" width="38" height="32" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                  <rect x="174" y="20" width="38" height="10" rx="3" fill="#00a862" />
                  <circle cx="182" cy="20" r="1.5" fill="#ffffff" />
                  <circle cx="204" cy="20" r="1.5" fill="#ffffff" />
                  <rect x="180" y="34" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="191" y="34" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="202" y="34" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="180" y="42" width="4" height="4" rx="0.5" fill="#cbd5e1" />
                  <rect x="191" y="42" width="4" height="4" rx="0.5" fill="#cbd5e1" />
                  <rect x="202" y="42" width="4" height="4" rx="0.5" fill="#cbd5e1" />

                  {/* Tờ lịch 2 */}
                  <rect x="174" y="58" width="38" height="32" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                  <rect x="174" y="58" width="38" height="10" rx="3" fill="#00a862" />
                  <circle cx="182" cy="58" r="1.5" fill="#ffffff" />
                  <circle cx="204" cy="58" r="1.5" fill="#ffffff" />
                  <rect x="180" y="72" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="191" y="72" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="202" y="72" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="180" y="80" width="4" height="4" rx="0.5" fill="#cbd5e1" />
                  <rect x="191" y="80" width="4" height="4" rx="0.5" fill="#cbd5e1" />
                  <rect x="202" y="80" width="4" height="4" rx="0.5" fill="#cbd5e1" />

                  {/* Tờ lịch 3 */}
                  <rect x="174" y="96" width="38" height="32" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                  <rect x="174" y="96" width="38" height="10" rx="3" fill="#00a862" />
                  <circle cx="182" cy="96" r="1.5" fill="#ffffff" />
                  <circle cx="204" cy="96" r="1.5" fill="#ffffff" />
                  <rect x="180" y="110" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="191" y="110" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="202" y="110" width="4" height="4" rx="0.5" fill="#94a3b8" />
                  <rect x="180" y="118" width="4" height="4" rx="0.5" fill="#cbd5e1" />
                  <rect x="191" y="118" width="4" height="4" rx="0.5" fill="#cbd5e1" />
                  <rect x="202" y="118" width="4" height="4" rx="0.5" fill="#cbd5e1" />

                  {/* Họa tiết trang trí */}
                  <path d="M30 36 H36 M33 33 V39" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M228 32 H234 M231 29 V35" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="225" cy="80" r="1.5" fill="#94a3b8" />
                  <circle cx="26" cy="78" r="1.5" fill="#cbd5e1" />
                </svg>
              </div>

              {/* Tiêu đề nghiệp vụ */}
              <h2 style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center", maxWidth: 680, lineHeight: 1.5 }}>
                Thêm các khoản chi phí trả trước cho nhiều kỳ kế toán như chi phí thuê văn phòng, chi phí quảng cáo... để phân bổ dần vào chi phí của từng kỳ
              </h2>

              {/* Nút Thêm ▾ với Dropdown menu */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowPrepaidAddDropdown(!showPrepaidAddDropdown)}
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
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                  }}
                >
                  <span>Thêm</span>
                  <ChevronDown size={14} />
                </button>

                {showPrepaidAddDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      width: 215,
                      background: "#ffffff",
                      borderRadius: 4,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                      border: "1px solid #e2e8f0",
                      zIndex: 50,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() => {
                        setShowPrepaidAddDropdown(false);
                        setPrepaidModalMode("new");
                        setForm1Code(`CPTT00${prepaidExpensesList.length + 1}`);
                        setForm1Name("");
                        setForm1AllocMonths(2);
                        setForm1StartDate("30/09/2026");
                        setForm1RecordDate("30/09/2026");
                        setForm1Amount(0);
                        setForm1WaitingAcc("242");
                        setForm1StopAlloc(false);
                        setForm1Rows([{ id: "f1-1", targetCode: "", targetName: "", rate: 0, costAccount: "", costItem: "", statCode: "" }]);
                        setShowPrepaidItemModal(true);
                      }}
                      style={{
                        padding: "9px 14px",
                        fontSize: 12.5,
                        color: "#1e293b",
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      Thêm chi phí trả trước
                    </div>
                    <div
                      onClick={() => {
                        setShowPrepaidAddDropdown(false);
                        setPrepaidModalMode("opening");
                        setForm2Code(`CPTT00${prepaidExpensesList.length + 1}`);
                        setForm2Name("");
                        setForm2AllocMonths(2);
                        setForm2RemainingMonths(0);
                        setForm2RecordDate("31/12/2025");
                        setForm2Amount(0);
                        setForm2AllocatedAmount(0);
                        setForm2RemainingAmount(0);
                        setForm2WaitingAcc("242");
                        setForm2StopAlloc(false);
                        setForm2Rows([{ id: "f2-1", targetCode: "", targetName: "", rate: 0, costAccount: "", costItem: "", statCode: "" }]);
                        setShowPrepaidItemModal(true);
                      }}
                      style={{
                        padding: "9px 14px",
                        fontSize: 12.5,
                        color: "#1e293b",
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      Thêm chi phí trả trước đầu kỳ
                    </div>
                    <div
                      onClick={() => {
                        setShowPrepaidAddDropdown(false);
                        setExcelStep(1);
                        setExcelFileName("");
                        setShowPrepaidExcelModal(true);
                      }}
                      style={{
                        padding: "9px 14px",
                        fontSize: 12.5,
                        color: "#1e293b",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      Nhập từ Excel
                    </div>
                  </div>
                )}
              </div>

              {/* Nút Xem danh sách chứng từ */}
              <div style={{ marginTop: 60 }}>
                <button
                  type="button"
                  onClick={() => setPrepaidViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 16,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                  }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              {/* Toolbar danh sách */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setShowPrepaidAddDropdown(!showPrepaidAddDropdown)}
                      style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Plus size={14} />
                      <span>Thêm chi phí trả trước</span>
                      <ChevronDown size={13} />
                    </button>

                    {showPrepaidAddDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          marginTop: 4,
                          width: 215,
                          background: "#ffffff",
                          borderRadius: 4,
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
                          border: "1px solid #e2e8f0",
                          zIndex: 50,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          onClick={() => {
                            setShowPrepaidAddDropdown(false);
                            setPrepaidModalMode("new");
                            setForm1Code(`CPTT00${prepaidExpensesList.length + 1}`);
                            setForm1Name("");
                            setForm1AllocMonths(2);
                            setForm1StartDate("30/09/2026");
                            setForm1RecordDate("30/09/2026");
                            setForm1Amount(0);
                            setForm1WaitingAcc("242");
                            setForm1StopAlloc(false);
                            setForm1Rows([{ id: "f1-1", targetCode: "", targetName: "", rate: 0, costAccount: "", costItem: "", statCode: "" }]);
                            setShowPrepaidItemModal(true);
                          }}
                          style={{ padding: "8px 14px", fontSize: 12.5, cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                        >
                          Thêm chi phí trả trước
                        </div>
                        <div
                          onClick={() => {
                            setShowPrepaidAddDropdown(false);
                            setPrepaidModalMode("opening");
                            setForm2Code(`CPTT00${prepaidExpensesList.length + 1}`);
                            setForm2Name("");
                            setForm2AllocMonths(2);
                            setForm2RemainingMonths(0);
                            setForm2RecordDate("31/12/2025");
                            setForm2Amount(0);
                            setForm2AllocatedAmount(0);
                            setForm2RemainingAmount(0);
                            setForm2WaitingAcc("242");
                            setForm2StopAlloc(false);
                            setForm2Rows([{ id: "f2-1", targetCode: "", targetName: "", rate: 0, costAccount: "", costItem: "", statCode: "" }]);
                            setShowPrepaidItemModal(true);
                          }}
                          style={{ padding: "8px 14px", fontSize: 12.5, cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                        >
                          Thêm chi phí trả trước đầu kỳ
                        </div>
                        <div
                          onClick={() => {
                            setShowPrepaidAddDropdown(false);
                            setExcelStep(1);
                            setExcelFileName("");
                            setShowPrepaidExcelModal(true);
                          }}
                          style={{ padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}
                        >
                          Nhập từ Excel
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ position: "relative", width: 220 }}>
                    <Search size={14} style={{ position: "absolute", left: 9, top: 8, color: "#64748b" }} />
                    <input
                      type="text"
                      value={prepaidSearch}
                      onChange={(e) => setPrepaidSearch(e.target.value)}
                      placeholder="Tìm theo mã, tên khoản chi phí..."
                      style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <select
                    value={prepaidFilterPeriod}
                    onChange={(e) => setPrepaidFilterPeriod(e.target.value)}
                    style={{ height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", fontSize: 12.5, background: "#ffffff" }}
                  >
                    <option value="Năm 2026">Năm 2026</option>
                    <option value="Quý 3/2026">Quý 3/2026</option>
                    <option value="Tháng 09/2026">Tháng 09/2026</option>
                    <option value="Tất cả">Tất cả các năm</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Xuất danh sách chi phí trả trước ra file Excel thành công")}
                    style={{ height: 28, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <FileSpreadsheet size={13} style={{ color: "#00a862" }} />
                    <span>Xuất khẩu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrepaidViewMode("landing")}
                    style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#64748b", fontSize: 12, cursor: "pointer" }}
                  >
                    Xem hình minh họa
                  </button>
                </div>
              </div>

              {/* Bảng danh sách CPTT */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã chi phí</th>
                      <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên khoản chi phí</th>
                      <th style={{ width: 100, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày bắt đầu</th>
                      <th style={{ width: 130, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng số tiền</th>
                      <th style={{ width: 80, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Số kỳ PB</th>
                      <th style={{ width: 130, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đã phân bổ</th>
                      <th style={{ width: 130, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Còn lại</th>
                      <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK chi phí</th>
                      <th style={{ width: 160, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị chịu CP</th>
                      <th style={{ width: 80, padding: "8px", textAlign: "center" }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrepaidList.map((cp, idx) => (
                      <tr key={cp.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{cp.code}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{cp.name}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{cp.startDate || "01/01/2026"}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>{formatVND(cp.totalAmount)}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{cp.allocationMonths} tháng</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: "#64748b" }}>{formatVND(cp.allocatedAmount)}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{formatVND(cp.remainingAmount)}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>{cp.costAccount}</td>
                        <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{cp.dept}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setPrepaidExpensesList(prepaidExpensesList.filter((x) => x.code !== cp.code));
                              notify(`Đã xóa khoản chi phí ${cp.code}`);
                            }}
                            title="Xóa khoản chi phí"
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Status bar */}
              <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                <span>Tổng số khoản chi phí: {filteredPrepaidList.length}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <span>Tổng nguyên giá: <strong style={{ color: "#00a862" }}>{formatVND(totalPrepaidOriginal)}</strong></span>
                  <span>Đã phân bổ: <strong style={{ color: "#64748b" }}>{formatVND(totalPrepaidAllocated)}</strong></span>
                  <span>Còn lại chưa phân bổ: <strong style={{ color: "#16a34a" }}>{formatVND(totalPrepaidRemaining)}</strong></span>
                </div>
              </div>
            </div>
          )
        )}

        {/* =================================================================== */}
        {/* SUBTAB 2: PHÂN BỔ CHI PHÍ TRẢ TRƯỚC (ẢNH 2)                         */}
        {/* =================================================================== */}
        {prepaidSubtab === "allocation" && (
          prepaidAllocViewMode === "landing" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 20px", boxSizing: "border-box" }}>
              {/* Tiêu đề nghiệp vụ Ảnh 2 */}
              <h2 style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center", maxWidth: 720, lineHeight: 1.5 }}>
                Lập chứng từ phân bổ chi phí trả trước để phân bổ và hạch toán các khoản chi phí trả trước vào chi phí từng tháng
              </h2>

              {/* 2 Nút hành động: Thêm bằng AI và Thêm */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrepaidDateModal(true);
                    notify("AVA Kế toán: Sẵn sàng tự động tổng hợp & phân bổ chi phí trả trước theo kỳ được chọn");
                  }}
                  style={{
                    height: 34,
                    padding: "0 18px",
                    background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                  }}
                >
                  <Sparkles size={15} style={{ color: "#facc15" }} />
                  <span>Thêm bằng AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrepaidDateModal(true)}
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
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                  }}
                >
                  Thêm
                </button>
              </div>

              {/* Nút Xem danh sách chứng từ */}
              <div style={{ marginTop: 60 }}>
                <button
                  type="button"
                  onClick={() => setPrepaidAllocViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 16,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                  }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              {/* Toolbar danh sách chứng từ phân bổ */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrepaidDateModal(true);
                      notify("AVA Kế toán: Sẵn sàng tự động tổng hợp & phân bổ chi phí trả trước theo kỳ được chọn");
                    }}
                    style={{ height: 30, padding: "0 14px", background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Sparkles size={13} style={{ color: "#facc15" }} />
                    <span>Thêm bằng AI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPrepaidDateModal(true)}
                    style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Plus size={14} />
                    <span>Thêm</span>
                  </button>

                  <div style={{ position: "relative", width: 220 }}>
                    <Search size={14} style={{ position: "absolute", left: 9, top: 8, color: "#64748b" }} />
                    <input
                      type="text"
                      value={prepaidAllocSearch}
                      onChange={(e) => setPrepaidAllocSearch(e.target.value)}
                      placeholder="Tìm theo số chứng từ, diễn giải..."
                      style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <select
                    value={prepaidAllocFilterPeriod}
                    onChange={(e) => setPrepaidAllocFilterPeriod(e.target.value)}
                    style={{ height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", fontSize: 12.5, background: "#ffffff" }}
                  >
                    <option value="Năm 2026">Năm 2026</option>
                    <option value="Quý 1/2026">Quý 1/2026</option>
                    <option value="Tất cả">Tất cả</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setPrepaidAllocViewMode("landing")}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#64748b", fontSize: 12, cursor: "pointer" }}
                >
                  Xem hình minh họa
                </button>
              </div>

              {/* Bảng danh sách chứng từ phân bổ */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kỳ phân bổ</th>
                      <th style={{ minWidth: 320, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                      <th style={{ width: 150, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng số tiền</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái</th>
                      <th style={{ width: 80, padding: "8px", textAlign: "center" }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepaidAllocVouchers
                      .filter((v) => !prepaidAllocSearch || v.voucherNo.toLowerCase().includes(prepaidAllocSearch.toLowerCase()) || v.reason.toLowerCase().includes(prepaidAllocSearch.toLowerCase()))
                      .map((v, idx) => (
                        <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{v.voucherNo}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.voucherDate}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 500 }}>{v.period}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.reason}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#00a862" }}>{formatVND(v.totalAmount)}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setPrepaidAllocVouchers(prepaidAllocVouchers.filter((x) => x.voucherNo !== v.voucherNo));
                                notify(`Đã xóa chứng từ ${v.voucherNo}`);
                              }}
                              title="Xóa chứng từ"
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Status bar */}
              <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                <span>Số lượng chứng từ: {prepaidAllocVouchers.length}</span>
                <span>Tổng tiền phân bổ: <strong style={{ color: "#00a862" }}>{formatVND(prepaidAllocVouchers.reduce((s, v) => s + v.totalAmount, 0))}</strong></span>
              </div>
            </div>
          )
        )}

        {/* =================================================================== */}
        {/* SUBTAB 3: GHI GIẢM CHI PHÍ TRẢ TRƯỚC (ẢNH 3)                        */}
        {/* =================================================================== */}
        {prepaidSubtab === "decrease" && (
          prepaidDecreaseViewMode === "landing" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 20px", boxSizing: "border-box" }}>
              {/* SVG Minh họa Ảnh 3: Tài liệu $ -> Kiện hàng $ -> Lịch và Đồng hồ */}
              <div style={{ marginBottom: 20 }}>
                <svg width="280" height="150" viewBox="0 0 280 150" fill="none">
                  {/* Bóng mờ đáy */}
                  <ellipse cx="140" cy="136" rx="100" ry="8" fill="#f1f5f9" />

                  {/* Tài liệu bên trái kèm badge $ */}
                  <rect x="42" y="44" width="48" height="64" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                  <path d="M42 48 C42 45 44 44 47 44 H76 L90 58 V62 H42 Z" fill="#00a862" />
                  <path d="M76 44 V58 H90 Z" fill="#00804c" />
                  <circle cx="86" cy="62" r="9" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="86" y="65.5" fill="#ffffff" fontSize="10.5" fontWeight="bold" textAnchor="middle">$</text>

                  {/* Mũi tên cong nét đứt trỏ sang kiện hàng */}
                  <path d="M92 76 C 108 64, 116 66, 126 74" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />
                  <circle cx="110" cy="66" r="8" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="110" y="69.5" fill="#ffffff" fontSize="9.5" fontWeight="bold" textAnchor="middle">$</text>

                  {/* Kiện hàng xanh lá ở giữa */}
                  <rect x="130" y="70" width="36" height="32" rx="3" fill="#00a862" stroke="#00804c" strokeWidth="1" />
                  <path d="M130 78 H166" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 2" />
                  <path d="M148 70 V102" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 2" />

                  {/* Đường nét đứt trỏ sang lịch */}
                  <path d="M166 78 C 176 68, 184 68, 192 72" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />

                  {/* Tờ lịch bên phải */}
                  <rect x="194" y="52" width="42" height="40" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                  <rect x="194" y="52" width="42" height="12" rx="3" fill="#00a862" />
                  <circle cx="203" cy="52" r="1.5" fill="#ffffff" />
                  <circle cx="227" cy="52" r="1.5" fill="#ffffff" />

                  {/* Biểu tượng đồng hồ tròn xanh trên lịch */}
                  <circle cx="224" cy="78" r="13" fill="#00a862" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="224" cy="78" r="1.5" fill="#ffffff" />
                  <path d="M224 78 V71 M224 78 H229" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

                  {/* Họa tiết trang trí */}
                  <path d="M32 40 H38 M35 37 V43" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M236 44 H242 M239 41 V47" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="24" cy="90" r="1.5" fill="#cbd5e1" />
                  <circle cx="248" cy="85" r="1.5" fill="#cbd5e1" />
                </svg>
              </div>

              {/* Tiêu đề nghiệp vụ Ảnh 3 */}
              <h2 style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center", maxWidth: 680, lineHeight: 1.5 }}>
                Lập chứng từ ghi giảm chi phí trả trước khi ngừng phân bổ ngắn hạn để chuyển sang phân bổ dài hạn hoặc điều chỉnh giảm chi phí.
              </h2>

              {/* Nút Thêm */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setPrepaidDecreaseVoucherNo(`GGCP0000${prepaidDecreaseVouchers.length + 1}`);
                    setPrepaidDecreaseVoucherDate("30/09/2026");
                    setPrepaidDecreaseReason("");
                    setPrepaidDecreaseDetailRows([
                      { id: `dec-${Date.now()}`, code: "", name: "", remainingAmount: 0 },
                    ]);
                    setShowPrepaidDecreaseModal(true);
                  }}
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
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                  }}
                >
                  Thêm
                </button>
              </div>

              {/* Nút Xem danh sách chứng từ */}
              <div style={{ marginTop: 60 }}>
                <button
                  type="button"
                  onClick={() => setPrepaidDecreaseViewMode("list")}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #00a862",
                    borderRadius: 16,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#00a862",
                    cursor: "pointer",
                  }}
                >
                  Xem danh sách chứng từ
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
              {/* Toolbar danh sách ghi giảm */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                    setPrepaidDecreaseVoucherNo(`GGCP0000${prepaidDecreaseVouchers.length + 1}`);
                    setPrepaidDecreaseVoucherDate("30/09/2026");
                    setPrepaidDecreaseReason("");
                    setPrepaidDecreaseDetailRows([
                      { id: `dec-${Date.now()}`, code: "", name: "", remainingAmount: 0 },
                    ]);
                    setShowPrepaidDecreaseModal(true);
                  }}
                    style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Plus size={14} />
                    <span>Thêm</span>
                  </button>

                  <div style={{ position: "relative", width: 220 }}>
                    <Search size={14} style={{ position: "absolute", left: 9, top: 8, color: "#64748b" }} />
                    <input
                      type="text"
                      value={prepaidDecreaseSearch}
                      onChange={(e) => setPrepaidDecreaseSearch(e.target.value)}
                      placeholder="Tìm theo số chứng từ, lý do..."
                      style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <select
                    value={prepaidDecreaseFilterPeriod}
                    onChange={(e) => setPrepaidDecreaseFilterPeriod(e.target.value)}
                    style={{ height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", fontSize: 12.5, background: "#ffffff" }}
                  >
                    <option value="Năm 2026">Năm 2026</option>
                    <option value="Quý 3/2026">Quý 3/2026</option>
                    <option value="Tất cả">Tất cả</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setPrepaidDecreaseViewMode("landing")}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#64748b", fontSize: 12, cursor: "pointer" }}
                >
                  Xem hình minh họa
                </button>
              </div>

              {/* Bảng danh sách chứng từ ghi giảm */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                      <th style={{ minWidth: 320, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do ghi giảm</th>
                      <th style={{ width: 150, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng số tiền giảm</th>
                      <th style={{ width: 100, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Số khoản CP</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái</th>
                      <th style={{ width: 80, padding: "8px", textAlign: "center" }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepaidDecreaseVouchers
                      .filter((v) => !prepaidDecreaseSearch || v.voucherNo.toLowerCase().includes(prepaidDecreaseSearch.toLowerCase()) || v.reason.toLowerCase().includes(prepaidDecreaseSearch.toLowerCase()))
                      .map((v, idx) => (
                        <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{v.voucherNo}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.voucherDate}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.reason}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#ef4444" }}>{formatVND(v.totalAmount)}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{v.itemCount}</td>
                          <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setPrepaidDecreaseVouchers(prepaidDecreaseVouchers.filter((x) => x.voucherNo !== v.voucherNo));
                                notify(`Đã xóa chứng từ ${v.voucherNo}`);
                              }}
                              title="Xóa chứng từ"
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Status bar */}
              <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                <span>Số lượng chứng từ: {prepaidDecreaseVouchers.length}</span>
                <span>Tổng tiền giảm: <strong style={{ color: "#ef4444" }}>{formatVND(prepaidDecreaseVouchers.reduce((s, v) => s + v.totalAmount, 0))}</strong></span>
              </div>
            </div>
          )
        )}

        {/* =================================================================== */}
        {/* POPUP: CHỌN KỲ PHÂN BỔ CHI PHÍ (ẢNH 2)                              */}
        {/* =================================================================== */}
        {showPrepaidDateModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(2px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1100,
              padding: 16,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPrepaidDateModal(false);
            }}
          >
            <div
              style={{
                width: 410,
                background: "#ffffff",
                borderRadius: 8,
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  height: 44,
                  padding: "0 18px",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  Chọn kỳ phân bổ chi phí
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Trợ giúp: Chọn tháng và năm để hệ thống tổng hợp các khoản chi phí trả trước cần phân bổ.")}
                    style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center", padding: 2 }}
                  >
                    <HelpCircle size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrepaidDateModal(false)}
                    style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center", padding: 2 }}
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Form Body */}
              <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Tháng <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={prepaidAllocMonth}
                    onChange={(e) => setPrepaidAllocMonth(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 32,
                      border: "1.5px solid #00a862",
                      borderRadius: 4,
                      padding: "0 10px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Năm
                  </label>
                  <input
                    type="number"
                    value={prepaidAllocYear}
                    onChange={(e) => setPrepaidAllocYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 32,
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "0 10px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "12px 20px 16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowPrepaidDateModal(false)}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
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
                    setShowPrepaidDateModal(false);
                    const mStr = String(prepaidAllocMonth).padStart(2, "0");
                    const daysInMonth = new Date(prepaidAllocYear, prepaidAllocMonth, 0).getDate();
                    setPrepaidAllocVoucherNo(`PBCP${prepaidAllocYear}${mStr}`);
                    setPrepaidAllocVoucherDate(`${daysInMonth}/${mStr}/${prepaidAllocYear}`);
                    setPrepaidAllocReason(`Phân bổ chi phí trả trước Tháng ${mStr}/${prepaidAllocYear}`);
                    setShowPrepaidAllocVoucherModal(true);
                  }}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 1: CHI PHÍ TRẢ TRƯỚC (ẢNH 1)                                  */}
        {/* =================================================================== */}
        {showPrepaidItemModal && prepaidModalMode === "new" && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(2px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1050,
              padding: 10,
            }}
          >
            <div
              style={{
                width: "98vw",
                maxWidth: 1260,
                height: "92vh",
                background: "#f1f5f9",
                borderRadius: 4,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  height: 42,
                  padding: "0 16px",
                  background: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <RotateCcw size={16} style={{ color: "#475569" }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                    Chi phí trả trước
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Hướng dẫn sử dụng: Thêm và phân bổ chi phí trả trước nhiều kỳ")}
                    style={{
                      height: 26,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 13,
                      background: "#ffffff",
                      fontSize: 12,
                      color: "#00a862",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <HelpCircle size={13} />
                    <span>Hướng dẫn sử dụng</span>
                    <ChevronDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrepaidItemModal(false)}
                    style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Main Body */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {/* Form Fields Card (Header Inputs) */}
                <div style={{ background: "#ffffff", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                  {/* Row 1 */}
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 140px 220px", gap: 16, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Mã chi phí trả trước
                      </label>
                      <input
                        type="text"
                        value={form1Code}
                        onChange={(e) => setForm1Code(e.target.value)}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 10px",
                          border: "1.5px solid #00a862",
                          borderRadius: 4,
                          fontSize: 12.5,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Tên chi phí trả trước
                      </label>
                      <input
                        type="text"
                        value={form1Name}
                        onChange={(e) => setForm1Name(e.target.value)}
                        placeholder=""
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số kỳ phân bổ
                      </label>
                      <input
                        type="number"
                        value={form1AllocMonths}
                        onChange={(e) => setForm1AllocMonths(Number(e.target.value))}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          outline: "none",
                          boxSizing: "border-box",
                          textAlign: "right",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số tiền phân bổ hàng kỳ
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formatVND(Math.round(form1AllocMonths > 0 ? form1Amount / form1AllocMonths : 0))}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          background: "#f8fafc",
                          outline: "none",
                          boxSizing: "border-box",
                          textAlign: "right",
                          color: "#475569",
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                    <div style={{ width: 150 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Ngày bắt đầu phân bổ
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={form1StartDate}
                          onChange={(e) => setForm1StartDate(e.target.value)}
                          style={{ width: "100%", height: 32, padding: "0 28px 0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                        />
                        <Calendar size={14} style={{ position: "absolute", right: 8, top: 9, color: "#64748b" }} />
                      </div>
                    </div>

                    <div style={{ width: 150 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Ngày ghi nhận
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={form1RecordDate}
                          onChange={(e) => setForm1RecordDate(e.target.value)}
                          style={{ width: "100%", height: 32, padding: "0 28px 0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                        />
                        <Calendar size={14} style={{ position: "absolute", right: 8, top: 9, color: "#64748b" }} />
                      </div>
                    </div>

                    <div style={{ width: 170 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số tiền
                      </label>
                      <input
                        type="number"
                        value={form1Amount}
                        onChange={(e) => setForm1Amount(Number(e.target.value))}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "right" }}
                      />
                    </div>

                    <div style={{ width: 130 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        TK chờ phân bổ
                      </label>
                      <select
                        value={form1WaitingAcc}
                        onChange={(e) => setForm1WaitingAcc(e.target.value)}
                        style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff", outline: "none" }}
                      >
                        <option value="242">242</option>
                        <option value="2421">2421</option>
                        <option value="2422">2422</option>
                      </select>
                    </div>

                    <div style={{ paddingTop: 20 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={form1StopAlloc}
                          onChange={(e) => setForm1StopAlloc(e.target.checked)}
                          style={{ accentColor: "#00a862" }}
                        />
                        <span>Ngừng phân bổ</span>
                      </label>
                    </div>
                  </div>

                  {/* Row 3: Tham chiếu */}
                  <div>
                    <span
                      onClick={() => notify("Chọn chứng từ tham chiếu")}
                      style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>
                </div>

                {/* Tab Headers */}
                <div style={{ background: "#ffffff", padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 24, flexShrink: 0 }}>
                  <div
                    onClick={() => setForm1Tab("setup")}
                    style={{
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: form1Tab === "setup" ? 700 : 500,
                      color: form1Tab === "setup" ? "#00a862" : "#475569",
                      borderBottom: form1Tab === "setup" ? "2.5px solid #00a862" : "2.5px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Thiết lập phân bổ
                  </div>
                  <div
                    onClick={() => setForm1Tab("docs")}
                    style={{
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: form1Tab === "docs" ? 700 : 500,
                      color: form1Tab === "docs" ? "#00a862" : "#475569",
                      borderBottom: form1Tab === "docs" ? "2.5px solid #00a862" : "2.5px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Tập hợp chứng từ
                  </div>
                </div>

                {/* Tab Content: Bảng thiết lập phân bổ */}
                <div style={{ flex: 1, background: "#ffffff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {form1Tab === "setup" ? (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      <div style={{ flex: 1, overflow: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                              <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                              <th style={{ width: 180, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đối tượng phân bổ</th>
                              <th style={{ minWidth: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên đối tượng phân bổ</th>
                              <th style={{ width: 110, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tỷ lệ PB (%)</th>
                              <th style={{ width: 120, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK chi phí</th>
                              <th style={{ width: 180, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Khoản mục CP</th>
                              <th style={{ width: 150, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã thống kê</th>
                              <th style={{ width: 50, padding: "8px", textAlign: "center" }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {form1Rows.map((row, idx) => (
                              <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                                  <input
                                    type="text"
                                    value={row.targetCode}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setForm1Rows(form1Rows.map((r) => r.id === row.id ? { ...r, targetCode: val } : r));
                                    }}
                                    placeholder=""
                                    style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                                  />
                                </td>
                                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                                  <input
                                    type="text"
                                    value={row.targetName}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setForm1Rows(form1Rows.map((r) => r.id === row.id ? { ...r, targetName: val } : r));
                                    }}
                                    placeholder=""
                                    style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                                  />
                                </td>
                                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                                  <input
                                    type="number"
                                    value={row.rate}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setForm1Rows(form1Rows.map((r) => r.id === row.id ? { ...r, rate: val } : r));
                                    }}
                                    style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5, textAlign: "right" }}
                                  />
                                </td>
                                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                                  <input
                                    type="text"
                                    value={row.costAccount}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setForm1Rows(form1Rows.map((r) => r.id === row.id ? { ...r, costAccount: val } : r));
                                    }}
                                    placeholder="6422"
                                    style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5, textAlign: "center" }}
                                  />
                                </td>
                                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                                  <input
                                    type="text"
                                    value={row.costItem}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setForm1Rows(form1Rows.map((r) => r.id === row.id ? { ...r, costItem: val } : r));
                                    }}
                                    placeholder=""
                                    style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                                  />
                                </td>
                                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                                  <input
                                    type="text"
                                    value={row.statCode}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setForm1Rows(form1Rows.map((r) => r.id === row.id ? { ...r, statCode: val } : r));
                                    }}
                                    placeholder=""
                                    style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                                  />
                                </td>
                                <td style={{ textAlign: "center", padding: "4px" }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (form1Rows.length > 1) {
                                        setForm1Rows(form1Rows.filter((r) => r.id !== row.id));
                                      }
                                    }}
                                    style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {/* Dòng tổng cộng */}
                            <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                              <td colSpan={3} style={{ padding: "8px 12px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>Tổng:</td>
                              <td style={{ padding: "8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>
                                {form1Rows.reduce((s, r) => s + (r.rate || 0), 0).toFixed(2).replace(".", ",")}
                              </td>
                              <td colSpan={4}></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Action Buttons below table */}
                      <div style={{ padding: "10px 16px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 12, background: "#ffffff" }}>
                        <button
                          type="button"
                          onClick={() => setForm1Rows([...form1Rows, { id: `f1-${Date.now()}`, targetCode: "", targetName: "", rate: 0, costAccount: "6422", costItem: "", statCode: "" }])}
                          style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                        >
                          <Plus size={13} />
                          <span>Thêm dòng</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm1Rows([{ id: `f1-${Date.now()}`, targetCode: "", targetName: "", rate: 0, costAccount: "6422", costItem: "", statCode: "" }])}
                          style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 600, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                        >
                          <Trash2 size={13} />
                          <span>Xóa hết dòng</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                      Chưa có chứng từ tập hợp nào liên kết với khoản chi phí trả trước này.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Buttons */}
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
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowPrepaidItemModal(false)}
                  style={{ height: 32, padding: "0 20px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, fontWeight: 500, color: "#334155", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newItem = {
                      code: form1Code,
                      name: form1Name || "Chi phí trả trước mới",
                      totalAmount: form1Amount,
                      allocationMonths: form1AllocMonths,
                      allocatedAmount: 0,
                      remainingAmount: form1Amount,
                      costAccount: form1Rows[0]?.costAccount || "6422",
                      dept: form1Rows[0]?.targetName || "Khối Văn phòng",
                      startDate: form1StartDate,
                    };
                    setPrepaidExpensesList([newItem, ...prepaidExpensesList.filter((x) => x.code !== form1Code)]);
                    setShowPrepaidItemModal(false);
                    setPrepaidViewMode("list");
                    notify(`Đã lưu chi phí trả trước ${form1Code} thành công`);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}
                >
                  Cất
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newItem = {
                      code: form1Code,
                      name: form1Name || "Chi phí trả trước mới",
                      totalAmount: form1Amount,
                      allocationMonths: form1AllocMonths,
                      allocatedAmount: 0,
                      remainingAmount: form1Amount,
                      costAccount: form1Rows[0]?.costAccount || "6422",
                      dept: form1Rows[0]?.targetName || "Khối Văn phòng",
                      startDate: form1StartDate,
                    };
                    setPrepaidExpensesList([newItem, ...prepaidExpensesList.filter((x) => x.code !== form1Code)]);
                    setForm1Code(`CPTT00${prepaidExpensesList.length + 2}`);
                    setForm1Name("");
                    setForm1Amount(0);
                    notify(`Đã lưu chi phí trả trước ${form1Code} và mở biểu mẫu thêm mới`);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
                >
                  Cất và Thêm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 2: CHI PHÍ TRẢ TRƯỚC ĐẦU KỲ (ẢNH 2)                           */}
        {/* =================================================================== */}
        {showPrepaidItemModal && prepaidModalMode === "opening" && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(2px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1050,
              padding: 10,
            }}
          >
            <div
              style={{
                width: "98vw",
                maxWidth: 1260,
                height: "92vh",
                background: "#f1f5f9",
                borderRadius: 4,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  height: 42,
                  padding: "0 16px",
                  background: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <RotateCcw size={16} style={{ color: "#475569" }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                    Chi phí trả trước đầu kỳ
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Hướng dẫn sử dụng: Khai báo số dư chi phí trả trước đầu kỳ")}
                    style={{
                      height: 26,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 13,
                      background: "#ffffff",
                      fontSize: 12,
                      color: "#00a862",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <HelpCircle size={13} />
                    <span>Hướng dẫn sử dụng</span>
                    <ChevronDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrepaidItemModal(false)}
                    style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Main Body */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {/* Form Fields Card */}
                <div style={{ background: "#ffffff", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                  {/* Row 1 */}
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 140px 150px", gap: 16, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Mã chi phí trả trước
                      </label>
                      <input
                        type="text"
                        value={form2Code}
                        onChange={(e) => setForm2Code(e.target.value)}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1.5px solid #00a862", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Tên chi phí trả trước
                      </label>
                      <input
                        type="text"
                        value={form2Name}
                        onChange={(e) => setForm2Name(e.target.value)}
                        placeholder=""
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số kỳ phân bổ
                      </label>
                      <input
                        type="number"
                        value={form2AllocMonths}
                        onChange={(e) => setForm2AllocMonths(Number(e.target.value))}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "right" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số kỳ phân bổ còn lại
                      </label>
                      <input
                        type="number"
                        value={form2RemainingMonths}
                        onChange={(e) => setForm2RemainingMonths(Number(e.target.value))}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "right" }}
                      />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div style={{ display: "grid", gridTemplateColumns: "180px 180px 180px", gap: 16, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Ngày ghi nhận
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={form2RecordDate}
                          onChange={(e) => setForm2RecordDate(e.target.value)}
                          style={{ width: "100%", height: 32, padding: "0 28px 0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                        />
                        <Calendar size={14} style={{ position: "absolute", right: 8, top: 9, color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số tiền
                      </label>
                      <input
                        type="number"
                        value={form2Amount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setForm2Amount(val);
                          setForm2MonthlyAlloc(Math.round(form2AllocMonths > 0 ? val / form2AllocMonths : 0));
                          setForm2RemainingAmount(Math.max(0, val - form2AllocatedAmount));
                        }}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "right" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số tiền phân bổ hàng kỳ
                      </label>
                      <input
                        type="number"
                        value={form2MonthlyAlloc}
                        onChange={(e) => setForm2MonthlyAlloc(Number(e.target.value))}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "right" }}
                      />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                    <div style={{ width: 180 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số tiền đã phân bổ
                      </label>
                      <input
                        type="number"
                        value={form2AllocatedAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setForm2AllocatedAmount(val);
                          setForm2RemainingAmount(Math.max(0, form2Amount - val));
                        }}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "right" }}
                      />
                    </div>

                    <div style={{ width: 180 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số tiền phân bổ còn lại
                      </label>
                      <input
                        type="number"
                        value={form2RemainingAmount}
                        onChange={(e) => setForm2RemainingAmount(Number(e.target.value))}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "right" }}
                      />
                    </div>

                    <div style={{ width: 130 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        TK chờ phân bổ
                      </label>
                      <select
                        value={form2WaitingAcc}
                        onChange={(e) => setForm2WaitingAcc(e.target.value)}
                        style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff", outline: "none" }}
                      >
                        <option value="242">242</option>
                        <option value="2421">2421</option>
                        <option value="2422">2422</option>
                      </select>
                    </div>

                    <div style={{ paddingTop: 20 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={form2StopAlloc}
                          onChange={(e) => setForm2StopAlloc(e.target.checked)}
                          style={{ accentColor: "#00a862" }}
                        />
                        <span>Ngừng phân bổ</span>
                      </label>
                    </div>
                  </div>

                  {/* Row 4: Tham chiếu */}
                  <div>
                    <span
                      onClick={() => notify("Chọn chứng từ tham chiếu")}
                      style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>
                </div>

                {/* Tab Header */}
                <div style={{ background: "#ffffff", padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 24, flexShrink: 0 }}>
                  <div
                    style={{
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#00a862",
                      borderBottom: "2.5px solid #00a862",
                      cursor: "pointer",
                    }}
                  >
                    Thiết lập phân bổ
                  </div>
                </div>

                {/* Tab Content: Bảng thiết lập phân bổ */}
                <div style={{ flex: 1, background: "#ffffff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                          <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 180, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đối tượng phân bổ</th>
                          <th style={{ minWidth: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên đối tượng phân bổ</th>
                          <th style={{ width: 110, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tỷ lệ PB (%)</th>
                          <th style={{ width: 120, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK chi phí</th>
                          <th style={{ width: 180, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Khoản mục chi phí</th>
                          <th style={{ width: 150, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã thống kê</th>
                          <th style={{ width: 50, padding: "8px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form2Rows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.targetCode}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm2Rows(form2Rows.map((r) => r.id === row.id ? { ...r, targetCode: val } : r));
                                }}
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.targetName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm2Rows(form2Rows.map((r) => r.id === row.id ? { ...r, targetName: val } : r));
                                }}
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                              <input
                                type="number"
                                value={row.rate}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setForm2Rows(form2Rows.map((r) => r.id === row.id ? { ...r, rate: val } : r));
                                }}
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5, textAlign: "right" }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.costAccount}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm2Rows(form2Rows.map((r) => r.id === row.id ? { ...r, costAccount: val } : r));
                                }}
                                placeholder="6422"
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5, textAlign: "center" }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.costItem}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm2Rows(form2Rows.map((r) => r.id === row.id ? { ...r, costItem: val } : r));
                                }}
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.statCode}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm2Rows(form2Rows.map((r) => r.id === row.id ? { ...r, statCode: val } : r));
                                }}
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "4px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (form2Rows.length > 1) {
                                    setForm2Rows(form2Rows.filter((r) => r.id !== row.id));
                                  }
                                }}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {/* Dòng tổng */}
                        <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                          <td colSpan={3} style={{ padding: "8px 12px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>Tổng:</td>
                          <td style={{ padding: "8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>
                            {form2Rows.reduce((s, r) => s + (r.rate || 0), 0).toFixed(2).replace(".", ",")}
                          </td>
                          <td colSpan={4}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Action buttons */}
                  <div style={{ padding: "10px 16px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 12, background: "#ffffff" }}>
                    <button
                      type="button"
                      onClick={() => setForm2Rows([...form2Rows, { id: `f2-${Date.now()}`, targetCode: "", targetName: "", rate: 0, costAccount: "6422", costItem: "", statCode: "" }])}
                      style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm2Rows([{ id: `f2-${Date.now()}`, targetCode: "", targetName: "", rate: 0, costAccount: "6422", costItem: "", statCode: "" }])}
                      style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 600, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
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
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowPrepaidItemModal(false)}
                  style={{ height: 32, padding: "0 20px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, fontWeight: 500, color: "#334155", cursor: "pointer" }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newItem = {
                      code: form2Code,
                      name: form2Name || "Chi phí trả trước đầu kỳ",
                      totalAmount: form2Amount,
                      allocationMonths: form2AllocMonths,
                      allocatedAmount: form2AllocatedAmount,
                      remainingAmount: form2RemainingAmount,
                      costAccount: form2Rows[0]?.costAccount || "6422",
                      dept: form2Rows[0]?.targetName || "Khối Văn phòng",
                      startDate: form2RecordDate,
                    };
                    setPrepaidExpensesList([newItem, ...prepaidExpensesList.filter((x) => x.code !== form2Code)]);
                    setShowPrepaidItemModal(false);
                    setPrepaidViewMode("list");
                    notify(`Đã lưu chi phí trả trước đầu kỳ ${form2Code} thành công`);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}
                >
                  Cất
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newItem = {
                      code: form2Code,
                      name: form2Name || "Chi phí trả trước đầu kỳ",
                      totalAmount: form2Amount,
                      allocationMonths: form2AllocMonths,
                      allocatedAmount: form2AllocatedAmount,
                      remainingAmount: form2RemainingAmount,
                      costAccount: form2Rows[0]?.costAccount || "6422",
                      dept: form2Rows[0]?.targetName || "Khối Văn phòng",
                      startDate: form2RecordDate,
                    };
                    setPrepaidExpensesList([newItem, ...prepaidExpensesList.filter((x) => x.code !== form2Code)]);
                    setForm2Code(`CPTT00${prepaidExpensesList.length + 2}`);
                    setForm2Name("");
                    setForm2Amount(0);
                    notify(`Đã lưu chi phí trả trước đầu kỳ ${form2Code} và mở biểu mẫu thêm mới`);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
                >
                  Cất và Thêm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: NHẬP CHI PHÍ TRẢ TRƯỚC TỪ EXCEL (ẢNH 3)                      */}
        {/* =================================================================== */}
        {showPrepaidExcelModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(2px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1050,
              padding: 10,
            }}
          >
            <div
              style={{
                width: "98vw",
                maxWidth: 1200,
                height: "88vh",
                background: "#ffffff",
                borderRadius: 6,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header with Title & Stepper Wizard */}
              <div
                style={{
                  height: 48,
                  padding: "0 24px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#ffffff",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Nhập chi phí trả trước từ Excel
                </span>

                {/* Stepper */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: excelStep >= 1 ? "#00a862" : "#94a3b8", fontWeight: excelStep === 1 ? 700 : 500 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: excelStep >= 1 ? "#00a862" : "#cbd5e1", color: "#ffffff", fontSize: 11, display: "grid", placeItems: "center", fontWeight: 700 }}>
                      1
                    </span>
                    <span>Chọn tệp</span>
                  </div>
                  <div style={{ width: 40, height: 1, background: excelStep >= 2 ? "#00a862" : "#cbd5e1" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: excelStep >= 2 ? "#00a862" : "#94a3b8", fontWeight: excelStep === 2 ? 700 : 500 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: excelStep >= 2 ? "#00a862" : "#cbd5e1", color: "#ffffff", fontSize: 11, display: "grid", placeItems: "center", fontWeight: 700 }}>
                      2
                    </span>
                    <span>Ghép dữ liệu</span>
                  </div>
                  <div style={{ width: 40, height: 1, background: excelStep >= 3 ? "#00a862" : "#cbd5e1" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: excelStep >= 3 ? "#00a862" : "#94a3b8", fontWeight: excelStep === 3 ? 700 : 500 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: excelStep >= 3 ? "#00a862" : "#cbd5e1", color: "#ffffff", fontSize: 11, display: "grid", placeItems: "center", fontWeight: 700 }}>
                      3
                    </span>
                    <span>Kiểm tra dữ liệu</span>
                  </div>
                  <div style={{ width: 40, height: 1, background: excelStep >= 4 ? "#00a862" : "#cbd5e1" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: excelStep >= 4 ? "#00a862" : "#94a3b8", fontWeight: excelStep === 4 ? 700 : 500 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: excelStep >= 4 ? "#00a862" : "#cbd5e1", color: "#ffffff", fontSize: 11, display: "grid", placeItems: "center", fontWeight: 700 }}>
                      4
                    </span>
                    <span>Kết quả</span>
                  </div>
                </div>

                {/* Right close & help */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button type="button" onClick={() => notify("Trợ giúp: Hướng dẫn nhập khẩu danh mục chi phí trả trước từ Excel")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                    <HelpCircle size={18} />
                  </button>
                  <button type="button" onClick={() => setShowPrepaidExcelModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Body: Step 1 / Step 2 */}
              <div style={{ flex: 1, overflowY: "auto", padding: "32px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
                {excelStep === 1 && (
                  <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Dotted Upload Dropzone */}
                    <div
                      onClick={() => {
                        const el = document.getElementById("prepaid-excel-input");
                        if (el) el.click();
                      }}
                      style={{
                        border: "1.5px solid #cbd5e1",
                        borderRadius: 8,
                        padding: "36px 20px",
                        background: "#fafafa",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "border 0.2s, background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#00a862";
                        e.currentTarget.style.background = "#f0fdf4";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#cbd5e1";
                        e.currentTarget.style.background = "#fafafa";
                      }}
                    >
                      <input
                        id="prepaid-excel-input"
                        type="file"
                        accept=".xlsx,.xls"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setExcelFileName(e.target.files[0].name);
                            notify(`Đã chọn tệp: ${e.target.files[0].name}`);
                          }
                        }}
                      />
                      <Upload size={32} style={{ color: "#00a862", marginBottom: 10 }} />
                      <div style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 500, marginBottom: 4 }}>
                        <span style={{ color: "#0284c7", fontWeight: 600 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        {excelFileName ? `Đã tải: ${excelFileName}` : "Định dạng XLSX, XLS (tối đa 20MB)"}
                      </div>
                    </div>

                    {/* Note text */}
                    <div style={{ fontSize: 12.5, color: "#475569" }}>
                      Để có kết quả nhập khẩu chính xác, hãy sử dụng tệp mẫu.
                    </div>

                    {/* Download Template Box */}
                    <div
                      onClick={() => notify("Đang tải xuống tệp Excel mẫu: Mau_Chi_Phi_Tra_Truoc.xlsx")}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        padding: "12px 18px",
                        background: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0284c7", marginBottom: 2 }}>
                          Tải tệp mẫu
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          Bao gồm đầy đủ các trường thông tin
                        </div>
                      </div>
                      <Download size={18} style={{ color: "#64748b" }} />
                    </div>

                    {/* Config: Sheet & Header Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 16, alignItems: "center" }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                          Sheet nhập khẩu
                        </label>
                        <select
                          value={excelSheet}
                          onChange={(e) => setExcelSheet(e.target.value)}
                          style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                        >
                          <option value="Sheet1">Sheet1</option>
                          <option value="ChiPhiTraTruoc">ChiPhiTraTruoc</option>
                          <option value="Data">Data</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                          <span>Dòng tiêu đề</span>
                          <HelpCircle size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                        </label>
                        <input
                          type="number"
                          value={excelHeaderRow}
                          onChange={(e) => setExcelHeaderRow(Number(e.target.value))}
                          style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "center" }}
                        />
                      </div>
                    </div>

                    {/* AVA Auto Map Checkbox */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={excelAutoMap}
                        onChange={(e) => setExcelAutoMap(e.target.checked)}
                        id="prepaid-excel-ava"
                        style={{ accentColor: "#00a862" }}
                      />
                      <label htmlFor="prepaid-excel-ava" style={{ fontSize: 12.5, color: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Tự động ghép cột với AVA Kế toán</span>
                        <Sparkles size={14} style={{ color: "#7c3aed" }} />
                      </label>
                    </div>
                  </div>
                )}

                {excelStep > 1 && (
                  <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", textAlign: "center", padding: "40px 0" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "grid", placeItems: "center", margin: "0 auto 16px auto" }}>
                      <Check size={28} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 8px 0" }}>
                      Ghép cột dữ liệu tự động với AVA Kế toán hoàn tất
                    </h3>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                      Hệ thống đã nhận diện chính xác 10/10 trường thông tin cần thiết từ tệp Excel.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  height: 48,
                  background: "#ffffff",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0 24px",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowPrepaidExcelModal(false)}
                  style={{ height: 32, padding: "0 20px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, fontWeight: 500, color: "#334155", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (excelStep === 1) {
                      setExcelStep(2);
                      notify("AVA Kế toán: Đã tự động phân tích & ánh xạ các cột dữ liệu");
                    } else {
                      setShowPrepaidExcelModal(false);
                      setPrepaidViewMode("list");
                      notify("Nhập khẩu danh sách chi phí trả trước từ Excel thành công!");
                    }
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
                >
                  {excelStep === 1 ? "Tiếp tục" : "Hoàn tất"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 2: CHỨNG TỪ PHÂN BỔ CHI PHÍ TRẢ TRƯỚC                         */}
        {/* =================================================================== */}
        {showPrepaidAllocVoucherModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(2px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1050,
              padding: 14,
            }}
          >
            <div
              style={{
                width: "95vw",
                maxWidth: 1200,
                height: "90vh",
                background: "#ffffff",
                borderRadius: 6,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{ height: 46, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Chứng từ phân bổ chi phí trả trước - Tháng {String(prepaidAllocMonth).padStart(2, "0")}/{prepaidAllocYear}
                  </span>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>
                    TK 242
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrepaidAllocVoucherModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Thông tin chung */}
              <div style={{ padding: "14px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "160px 140px 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Số chứng từ
                  </label>
                  <input
                    type="text"
                    value={prepaidAllocVoucherNo}
                    onChange={(e) => setPrepaidAllocVoucherNo(e.target.value)}
                    style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#00a862", outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Ngày chứng từ
                  </label>
                  <input
                    type="text"
                    value={prepaidAllocVoucherDate}
                    onChange={(e) => setPrepaidAllocVoucherDate(e.target.value)}
                    style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "center" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Lý do / Diễn giải
                  </label>
                  <input
                    type="text"
                    value={prepaidAllocReason}
                    onChange={(e) => setPrepaidAllocReason(e.target.value)}
                    style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Tabs */}
              <div style={{ background: "#f8fafc", padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 24 }}>
                {[
                  { id: "allocTable", label: "1. Bảng phân bổ chi phí" },
                  { id: "accounting", label: "2. Hạch toán" },
                ].map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setPrepaidAllocTab(t.id as any)}
                    style={{
                      padding: "10px 4px",
                      fontSize: 12.5,
                      fontWeight: prepaidAllocTab === t.id ? 700 : 500,
                      color: prepaidAllocTab === t.id ? "#00a862" : "#64748b",
                      borderBottom: prepaidAllocTab === t.id ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>

              {/* Nội dung Tab */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {prepaidAllocTab === "allocTable" ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th style={{ width: 100, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã chi phí</th>
                        <th style={{ minWidth: 240, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên khoản chi phí</th>
                        <th style={{ width: 120, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng nguyên giá</th>
                        <th style={{ width: 120, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đã PB các kỳ trước</th>
                        <th style={{ width: 120, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền còn lại</th>
                        <th style={{ width: 80, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Số kỳ PB</th>
                        <th style={{ width: 130, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tiền phân bổ kỳ này</th>
                        <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK chi phí</th>
                        <th style={{ width: 150, padding: "8px", textAlign: "left" }}>Đơn vị chịu CP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prepaidExpensesList.map((cp, idx) => {
                        const allocThisPeriod = Math.round(cp.allocationMonths > 0 ? cp.totalAmount / cp.allocationMonths : 0);
                        return (
                          <tr key={cp.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{cp.code}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{cp.name}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{formatVND(cp.totalAmount)}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: "#64748b" }}>{formatVND(cp.allocatedAmount)}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>{formatVND(cp.remainingAmount)}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{cp.allocationMonths}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(allocThisPeriod)}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>{cp.costAccount}</td>
                            <td style={{ padding: "8px", color: "#475569" }}>{cp.dept}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th style={{ minWidth: 300, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải hạch toán</th>
                        <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                        <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                        <th style={{ width: 150, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                        <th style={{ width: 180, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Khoản mục chi phí</th>
                        <th style={{ width: 160, padding: "8px", textAlign: "left" }}>Đơn vị chịu chi phí</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prepaidExpensesList.map((cp, idx) => {
                        const allocThisPeriod = Math.round(cp.allocationMonths > 0 ? cp.totalAmount / cp.allocationMonths : 0);
                        return (
                          <tr key={cp.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>Phân bổ {cp.name} - T{String(prepaidAllocMonth).padStart(2, "0")}/{prepaidAllocYear}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, color: "#0284c7" }}>{cp.costAccount}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600, color: "#16a34a" }}>242</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(allocThisPeriod)}</td>
                            <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>Chi phí mua ngoài / Phân bổ</td>
                            <td style={{ padding: "8px", color: "#475569" }}>{cp.dept}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                  Tổng tiền phân bổ kỳ này: <span style={{ color: "#00a862" }}>{formatVND(prepaidExpensesList.reduce((s, cp) => s + Math.round(cp.allocationMonths > 0 ? cp.totalAmount / cp.allocationMonths : 0), 0))}</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPrepaidAllocVoucherModal(false)}
                    style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const totalAlloc = prepaidExpensesList.reduce((s, cp) => s + Math.round(cp.allocationMonths > 0 ? cp.totalAmount / cp.allocationMonths : 0), 0);
                      const mStr = String(prepaidAllocMonth).padStart(2, "0");
                      const newV = {
                        voucherNo: prepaidAllocVoucherNo,
                        voucherDate: prepaidAllocVoucherDate,
                        period: `Tháng ${mStr}/${prepaidAllocYear}`,
                        reason: prepaidAllocReason,
                        totalAmount: totalAlloc,
                        status: "Đã ghi sổ",
                      };
                      setPrepaidAllocVouchers([newV, ...prepaidAllocVouchers.filter((x) => x.voucherNo !== prepaidAllocVoucherNo)]);
                      setShowPrepaidAllocVoucherModal(false);
                      setPrepaidAllocViewMode("list");
                      notify(`Đã lưu chứng từ phân bổ chi phí trả trước ${prepaidAllocVoucherNo} thành công`);
                    }}
                    style={{ height: 32, padding: "0 22px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
                  >
                    Cất
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 3: GHI GIẢM CHI PHÍ TRẢ TRƯỚC (ẢNH 4)                         */}
        {/* =================================================================== */}
        {showPrepaidDecreaseModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(2px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1050,
              padding: 10,
            }}
          >
            <div
              style={{
                width: "98vw",
                maxWidth: 1260,
                height: "92vh",
                background: "#f1f5f9",
                borderRadius: 4,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  height: 42,
                  padding: "0 16px",
                  background: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <RotateCcw size={16} style={{ color: "#475569" }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                    Ghi giảm chi phí trả trước {prepaidDecreaseVoucherNo}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => notify("Hướng dẫn sử dụng: Lập chứng từ ghi giảm chi phí trả trước")}
                    style={{
                      height: 26,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 13,
                      background: "#ffffff",
                      fontSize: 12,
                      color: "#00a862",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <HelpCircle size={13} />
                    <span>Hướng dẫn sử dụng</span>
                    <ChevronDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrepaidDecreaseModal(false)}
                    style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Main Body */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {/* Form Fields Card */}
                <div style={{ background: "#ffffff", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px", gap: 24, alignItems: "flex-start" }}>
                    {/* Left: Lý do ghi giảm */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Lý do ghi giảm
                      </label>
                      <input
                        type="text"
                        value={prepaidDecreaseReason}
                        onChange={(e) => setPrepaidDecreaseReason(e.target.value)}
                        placeholder=""
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 10px",
                          border: "1.5px solid #00a862",
                          borderRadius: 4,
                          fontSize: 12.5,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ marginTop: 6 }}>
                        <span
                          onClick={() => notify("AVA Kế toán: Chọn chứng từ gốc hoặc hợp đồng để tham chiếu...")}
                          style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                        >
                          Tham chiếu ...
                        </span>
                      </div>
                    </div>

                    {/* Right: Ngày chứng từ */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Ngày chứng từ
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={prepaidDecreaseVoucherDate}
                          onChange={(e) => setPrepaidDecreaseVoucherDate(e.target.value)}
                          style={{ width: "100%", height: 32, padding: "0 28px 0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", textAlign: "left" }}
                        />
                        <Calendar size={14} style={{ position: "absolute", right: 8, top: 9, color: "#64748b" }} />
                      </div>
                    </div>

                    {/* Right: Số chứng từ */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                        Số chứng từ
                      </label>
                      <input
                        type="text"
                        value={prepaidDecreaseVoucherNo}
                        onChange={(e) => setPrepaidDecreaseVoucherNo(e.target.value)}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tab: Chi tiết */}
                <div style={{ background: "#ffffff", padding: "0 20px", borderBottom: "1px solid #e2e8f0" }}>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#00a862",
                      borderBottom: "2.5px solid #00a862",
                      cursor: "pointer",
                    }}
                  >
                    Chi tiết
                  </div>
                </div>

                {/* Table: Chi tiết ghi giảm */}
                <div style={{ background: "#ffffff", padding: "16px 20px 8px 20px" }}>
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                          <th style={{ width: 36, padding: "7px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 180, padding: "7px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã CPTT</th>
                          <th style={{ minWidth: 260, padding: "7px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên CPTT</th>
                          <th style={{ width: 240, padding: "7px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền còn lại của CPTT ghi giảm</th>
                          <th style={{ width: 36, padding: "7px 4px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {prepaidDecreaseDetailRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                              <select
                                value={row.code}
                                onChange={(e) => {
                                  const selectedCode = e.target.value;
                                  const found = prepaidExpensesList.find((x) => x.code === selectedCode);
                                  setPrepaidDecreaseDetailRows(
                                    prepaidDecreaseDetailRows.map((r) =>
                                      r.id === row.id
                                        ? {
                                            ...r,
                                            code: selectedCode,
                                            name: found ? found.name : r.name,
                                            remainingAmount: found ? found.remainingAmount : 0,
                                          }
                                        : r
                                    )
                                  );
                                }}
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5, background: "transparent" }}
                              >
                                <option value="">-- Chọn CPTT --</option>
                                {prepaidExpensesList.map((cp) => (
                                  <option key={cp.code} value={cp.code}>
                                    {cp.code} - {cp.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPrepaidDecreaseDetailRows(prepaidDecreaseDetailRows.map((r) => r.id === row.id ? { ...r, name: val } : r));
                                }}
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="number"
                                value={row.remainingAmount}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setPrepaidDecreaseDetailRows(prepaidDecreaseDetailRows.map((r) => r.id === row.id ? { ...r, remainingAmount: val } : r));
                                }}
                                style={{ width: "100%", height: 28, border: "1px solid transparent", outline: "none", fontSize: 12.5, textAlign: "right" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "4px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (prepaidDecreaseDetailRows.length > 1) {
                                    setPrepaidDecreaseDetailRows(prepaidDecreaseDetailRows.filter((r) => r.id !== row.id));
                                  }
                                }}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {/* Dòng tổng */}
                        <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                          <td colSpan={3} style={{ padding: "8px 12px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>Tổng:</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>
                            {formatVND(prepaidDecreaseDetailRows.reduce((s, r) => s + (r.remainingAmount || 0), 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Buttons Thêm dòng / Xóa hết dòng */}
                  <div style={{ padding: "10px 0", display: "flex", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setPrepaidDecreaseDetailRows([...prepaidDecreaseDetailRows, { id: `dec-${Date.now()}`, code: "", name: "", remainingAmount: 0 }])}
                      style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrepaidDecreaseDetailRows([{ id: `dec-${Date.now()}`, code: "", name: "", remainingAmount: 0 }])}
                      style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 600, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>

                {/* Khu vực Đính kèm */}
                <div style={{ background: "#ffffff", padding: "4px 20px 20px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 600, color: "#1e293b" }}>
                      <Paperclip size={13} style={{ color: "#64748b" }} />
                      <span>Đính kèm</span>
                    </span>
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                      Dung lượng tối đa 5MB
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      const el = document.getElementById("decrease-file-upload");
                      if (el) el.click();
                    }}
                    style={{
                      border: "1.5px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "20px 16px",
                      background: "#fafafa",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "border 0.2s, background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#00a862";
                      e.currentTarget.style.background = "#f0fdf4";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.background = "#fafafa";
                    }}
                  >
                    <input
                      id="decrease-file-upload"
                      type="file"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          notify(`Đã đính kèm tệp: ${e.target.files[0].name}`);
                        }
                      }}
                    />
                    <Upload size={18} style={{ color: "#64748b", marginBottom: 6 }} />
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      <span style={{ color: "#0284c7", fontWeight: 600 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
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
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowPrepaidDecreaseModal(false)}
                  style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const totalAmt = prepaidDecreaseDetailRows.reduce((s, r) => s + (r.remainingAmount || 0), 0);
                    const newV = {
                      voucherNo: prepaidDecreaseVoucherNo,
                      voucherDate: prepaidDecreaseVoucherDate,
                      reason: prepaidDecreaseReason || "Ghi giảm chi phí trả trước",
                      totalAmount: totalAmt,
                      itemCount: prepaidDecreaseDetailRows.filter((r) => r.code).length || 1,
                      status: "Đã ghi sổ",
                    };
                    setPrepaidDecreaseVouchers([newV, ...prepaidDecreaseVouchers.filter((x) => x.voucherNo !== prepaidDecreaseVoucherNo)]);
                    prepaidDecreaseDetailRows.forEach((r) => {
                      if (r.code) {
                        setPrepaidExpensesList((prev) =>
                          prev.map((it) =>
                            it.code === r.code
                              ? { ...it, remainingAmount: Math.max(0, it.remainingAmount - r.remainingAmount) }
                              : it
                          )
                        );
                      }
                    });
                    notify(`Đã lưu chứng từ ghi giảm ${prepaidDecreaseVoucherNo} thành công`);
                  }}
                  style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}
                >
                  Cất
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const totalAmt = prepaidDecreaseDetailRows.reduce((s, r) => s + (r.remainingAmount || 0), 0);
                    const newV = {
                      voucherNo: prepaidDecreaseVoucherNo,
                      voucherDate: prepaidDecreaseVoucherDate,
                      reason: prepaidDecreaseReason || "Ghi giảm chi phí trả trước",
                      totalAmount: totalAmt,
                      itemCount: prepaidDecreaseDetailRows.filter((r) => r.code).length || 1,
                      status: "Đã ghi sổ",
                    };
                    setPrepaidDecreaseVouchers([newV, ...prepaidDecreaseVouchers.filter((x) => x.voucherNo !== prepaidDecreaseVoucherNo)]);
                    prepaidDecreaseDetailRows.forEach((r) => {
                      if (r.code) {
                        setPrepaidExpensesList((prev) =>
                          prev.map((it) =>
                            it.code === r.code
                              ? { ...it, remainingAmount: Math.max(0, it.remainingAmount - r.remainingAmount) }
                              : it
                          )
                        );
                      }
                    });
                    setShowPrepaidDecreaseModal(false);
                    setPrepaidDecreaseViewMode("list");
                    notify(`Đã lưu chứng từ ghi giảm ${prepaidDecreaseVoucherNo} thành công`);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span>Cất và Đóng</span>
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 5. TAB: BÁO CÁO (Ảnh 5)
  // =========================================================================
  if (tab === "reports") {
    const filterText = reportSearch.toLowerCase().trim();

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", width: 220 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 8, color: "#64748b" }} />
              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Tìm theo tên báo cáo"
                style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div
              onClick={() => notify("AVA Kế toán: Bạn có thể nhập yêu cầu 'Xem bảng phân bổ CCDC tháng này' để mở báo cáo tức thì.")}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#6366f1", cursor: "pointer", fontWeight: 500 }}
            >
              <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
              <Sparkles size={14} style={{ color: "#a855f7" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569" }}>
              <span>Ngôn ngữ báo cáo</span>
              <select defaultValue="vi" style={{ height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", fontSize: 12, background: "#ffffff" }}>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => notify("Đã mở bảng thiết lập hiển thị báo cáo")}
              style={{ height: 28, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <SlidersHorizontal size={13} />
              <span>Ẩn/hiện báo cáo</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Yêu thích */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, background: "#ffffff", overflow: "hidden" }}>
            <div style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 13, color: "#1e293b" }}>
              Yêu thích
            </div>
            <div style={{ padding: "8px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                "Bảng tính phân bổ công cụ dụng cụ",
                "Bảng tính phân bổ chi phí trả trước",
              ]
                .filter((r) => !filterText || r.toLowerCase().includes(filterText))
                .map((rpt) => (
                  <div key={rpt} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                    <span onClick={() => setSelectedReportForPreview(rpt)} style={{ fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                      {rpt}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button type="button" title="Xem trước báo cáo" onClick={() => setSelectedReportForPreview(rpt)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <Eye size={15} />
                      </button>
                      <button type="button" title="Bỏ yêu thích" onClick={() => toggleFavorite(rpt)} style={{ border: "none", background: "transparent", color: "#00a862", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <Star size={15} fill="#00a862" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Báo cáo CCDC */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, background: "#ffffff", overflow: "hidden" }}>
            <div onClick={() => toggleSection("tools")} style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: openSections.tools ? "1px solid #e2e8f0" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>Báo cáo công cụ dụng cụ</span>
              {openSections.tools ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>

            {openSections.tools && (
              <div style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {[
                  { name: "Bảng tính phân bổ công cụ dụng cụ", favorite: true },
                  { name: "Sổ theo dõi công cụ dụng cụ", favorite: false },
                  { name: "Bảng tính phân bổ công cụ dụng cụ theo năm", favorite: false },
                  { name: "Báo cáo chi tiết giảm công cụ dụng cụ", favorite: false },
                  { name: "Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng", favorite: false },
                ]
                  .filter((r) => !filterText || r.name.toLowerCase().includes(filterText))
                  .map((item) => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                      <span onClick={() => setSelectedReportForPreview(item.name)} style={{ fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                        {item.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button type="button" title="Xem trước báo cáo" onClick={() => setSelectedReportForPreview(item.name)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                          <Eye size={15} />
                        </button>
                        <button type="button" title={favoriteReports.includes(item.name) ? "Bỏ yêu thích" : "Thêm vào yêu thích"} onClick={() => toggleFavorite(item.name)} style={{ border: "none", background: "transparent", color: favoriteReports.includes(item.name) ? "#00a862" : "#94a3b8", cursor: "pointer", display: "grid", placeItems: "center" }}>
                          <Star size={15} fill={favoriteReports.includes(item.name) ? "#00a862" : "none"} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Báo cáo Chi phí trả trước */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, background: "#ffffff", overflow: "hidden" }}>
            <div onClick={() => toggleSection("prepaid")} style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: openSections.prepaid ? "1px solid #e2e8f0" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>Báo cáo chi phí trả trước</span>
              {openSections.prepaid ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>

            {openSections.prepaid && (
              <div style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {[
                  { name: "Bảng tính phân bổ chi phí trả trước", favorite: true },
                  { name: "Sổ chi tiết chi phí trả trước", favorite: false },
                  { name: "Bảng tổng hợp chi phí trả trước", favorite: false },
                ]
                  .filter((r) => !filterText || r.name.toLowerCase().includes(filterText))
                  .map((item) => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                      <span onClick={() => setSelectedReportForPreview(item.name)} style={{ fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                        {item.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button type="button" onClick={() => setSelectedReportForPreview(item.name)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                          <Eye size={15} />
                        </button>
                        <button type="button" onClick={() => toggleFavorite(item.name)} style={{ border: "none", background: "transparent", color: favoriteReports.includes(item.name) ? "#00a862" : "#94a3b8", cursor: "pointer" }}>
                          <Star size={15} fill={favoriteReports.includes(item.name) ? "#00a862" : "none"} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Báo cáo Đối chiếu */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, background: "#ffffff", overflow: "hidden" }}>
            <div onClick={() => toggleSection("reconciliation")} style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: openSections.reconciliation ? "1px solid #e2e8f0" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>Báo cáo đối chiếu</span>
              {openSections.reconciliation ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>

            {openSections.reconciliation && (
              <div style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {[
                  { name: "Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái", favorite: false },
                  { name: "Bảng đối chiếu tình hình phân bổ CCDC với sổ cái TK 242", favorite: false },
                ]
                  .filter((r) => !filterText || r.name.toLowerCase().includes(filterText))
                  .map((item) => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                      <span onClick={() => setSelectedReportForPreview(item.name)} style={{ fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                        {item.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button type="button" onClick={() => setSelectedReportForPreview(item.name)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                          <Eye size={15} />
                        </button>
                        <button type="button" onClick={() => toggleFavorite(item.name)} style={{ border: "none", background: "transparent", color: favoriteReports.includes(item.name) ? "#00a862" : "#94a3b8", cursor: "pointer" }}>
                          <Star size={15} fill={favoriteReports.includes(item.name) ? "#00a862" : "none"} />
                        </button>
                      </div>
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

  return null;
}
