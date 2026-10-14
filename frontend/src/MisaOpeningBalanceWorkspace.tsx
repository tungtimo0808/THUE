import React, { useState } from "react";
import {
  HelpCircle,
  X,
  Plus,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Upload,
  Download,
  Check,
  Building2,
  CreditCard,
  Users,
  Package,
  Wrench,
  CarFront,
  FileSpreadsheet,
  Tag,
  Briefcase,
  Layers,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Info,
  Paperclip,
} from "lucide-react";
import "./misa-opening.css";

export type MisaOpeningBalanceWorkspaceProps = {
  notify?: (msg: string) => void;
};

type OpeningCategory = {
  id: string;
  title: string;
  heading: string;
  catalogLink: string;
  catalogName: string;
  tooltipText: string;
  color: string;
};

const OPENING_CATEGORIES: OpeningCategory[] = [
  {
    id: "accounts",
    title: "Số dư tài khoản",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư đầu kỳ cho các tài khoản",
    catalogLink: "/directory/accounting",
    catalogName: "Danh mục Hệ thống tài khoản",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của tài khoản",
    color: "#00a862",
  },
  {
    id: "bank",
    title: "Số dư TK ngân hàng",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư đầu kỳ cho các tài khoản ngân hàng",
    catalogLink: "/directory/bank-accounts",
    catalogName: "Danh mục Tài khoản ngân hàng",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của tài khoản ngân hàng",
    color: "#0284c7",
  },
  {
    id: "customers",
    title: "Công nợ khách hàng",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư công nợ khách hàng",
    catalogLink: "/directory/partners?type=customer",
    catalogName: "Danh mục Khách hàng",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của công nợ khách hàng",
    color: "#10b981",
  },
  {
    id: "suppliers",
    title: "Công nợ nhà cung cấp",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư công nợ đầu kỳ của các nhà cung cấp",
    catalogLink: "/directory/partners?type=supplier",
    catalogName: "Danh mục Nhà cung cấp",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của công nợ nhà cung cấp",
    color: "#f59e0b",
  },
  {
    id: "employees",
    title: "Công nợ nhân viên",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư công nợ đầu kỳ của các nhân viên",
    catalogLink: "/directory/organization",
    catalogName: "Danh mục Nhân viên",
    tooltipText: "Nhấn vào đây để nhập số dư đầu kì của công nợ nhân viên",
    color: "#6366f1",
  },
  {
    id: "inventory",
    title: "Tồn kho vật tư, hàng hóa và CCDC",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần nhập số dư tồn kho đầu kỳ của các vật tư, hàng hóa trên từng kho",
    catalogLink: "/directory/items",
    catalogName: "Danh mục vật tư hàng hóa",
    tooltipText: "Nhấn vào đây để nhập tồn kho đầu kì của vật tư hàng hóa",
    color: "#059669",
  },
  {
    id: "tools",
    title: "CCDC đang sử dụng đầu kỳ",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần khai báo các CCDC đã ghi tăng các năm trước để tiếp tục phân bổ chi phí trong năm nay",
    catalogLink: "/tools",
    catalogName: "Danh mục Công cụ dụng cụ",
    tooltipText: "Nhấn vào đây để khai báo CCDC đầu kỳ",
    color: "#d97706",
  },
  {
    id: "assets",
    title: "Tài sản cố định đầu kỳ",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần khai báo các TSCĐ đã ghi tăng của các năm trước để tiếp tục tính khấu hao trong năm nay",
    catalogLink: "/assets",
    catalogName: "Danh mục Tài sản cố định",
    tooltipText: "Nhấn vào đây để khai báo tài sản cố định đầu kỳ",
    color: "#2563eb",
  },
  {
    id: "prepaid",
    title: "Chi phí trả trước đầu kỳ",
    heading: "Để bắt đầu một năm tài chính mới, bạn cần khai báo các chi phí trả trước đã phát sinh các năm trước để tiếp tục phân bổ chi phí trong năm nay",
    catalogLink: "/ledger",
    catalogName: "Chi phí trả trước",
    tooltipText: "Nhấn vào đây để khai báo chi phí trả trước đầu kỳ",
    color: "#8b5cf6",
  },
  {
    id: "wip",
    title: "Chi phí dở dang",
    heading: "Nhập ngay chi phí dở dang để bắt đầu một năm tài chính mới",
    catalogLink: "/cost",
    catalogName: "Danh mục Đối tượng tập hợp chi phí",
    tooltipText: "Nhấn vào đây để nhập chi phí dở dang đầu kỳ",
    color: "#0d9488",
  },
];

export default function MisaOpeningBalanceWorkspace({ notify }: MisaOpeningBalanceWorkspaceProps) {
  // Current view: null (hub) or category id
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const cat = sp.get("category") || sp.get("tab") || sp.get("type");
      if (cat === "tools" || cat === "ccdc" || cat === "cong-cu-dung-cu") {
        return "tools";
      }
      if (cat === "wip" || cat === "chi-phi-do-dang" || cat === "do-dang") {
        return "wip";
      }
      if (cat === "assets" || cat === "tscd" || cat === "tai-san-co-dinh") {
        return "assets";
      }
      if (cat === "prepaid" || cat === "cptt" || cat === "chi-phi-tra-truoc") {
        return "prepaid";
      }
      return cat;
    }
    return null;
  });

  // Modal State
  const [activeModal, setActiveModal] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const m = sp.get("modal") || sp.get("action");
      if (m === "tools" || m === "add-tools" || m === "ccdc" || m === "open-ccdc" || m === "opening-tools") {
        return "tools";
      }
      if (m === "wip" || m === "add-wip" || m === "opening-wip") {
        return "wip";
      }
      if (m === "assets" || m === "tscd" || m === "tai-san-co-dinh" || m === "open-assets" || m === "opening-assets") {
        return "assets";
      }
      if (m === "prepaid" || m === "cptt" || m === "chi-phi-tra-truoc" || m === "open-prepaid" || m === "opening-prepaid") {
        return "prepaid";
      }
      return m;
    }
    return null;
  });

  // Modal 7: CCDC đang sử dụng đầu kỳ states
  const [toolVoucherNo, setToolVoucherNo] = useState("OPN");
  const [toolVoucherDate, setToolVoucherDate] = useState("");
  const [toolGroup, setToolGroup] = useState("");
  const [toolAllocatedVal, setToolAllocatedVal] = useState("0");
  const [toolRemainingVal, setToolRemainingVal] = useState("0");

  const [toolCode, setToolCode] = useState("");
  const [toolReason, setToolReason] = useState("");
  const [toolAllocPeriod, setToolAllocPeriod] = useState("1");
  const [toolRemainingPeriod, setToolRemainingPeriod] = useState("0");

  const [toolName, setToolName] = useState("");
  const [toolUnit, setToolUnit] = useState("");
  const [toolQuantity, setToolQuantity] = useState("1,00");
  const [toolPeriodAllocAmount, setToolPeriodAllocAmount] = useState("0");
  const [toolWaitingAccount, setToolWaitingAccount] = useState("242");

  const [toolType, setToolType] = useState("");
  const [toolUnitPrice, setToolUnitPrice] = useState("0,00");
  const [toolTotalAmount, setToolTotalAmount] = useState("0");
  const [toolStopAlloc, setToolStopAlloc] = useState(false);

  const [toolActiveTab, setToolActiveTab] = useState<"department" | "allocation">("department");
  const [toolDeptRows, setToolDeptRows] = useState([
    { id: "1", deptCode: "", deptName: "", quantity: "" }
  ]);
  const [toolAllocRows, setToolAllocRows] = useState([
    { id: "1", target: "", rate: 100, expenseAcc: "6422", expenseItem: "" }
  ]);

  // Chi phí dở dang subtab (4 formats)
  const [wipSubtab, setWipSubtab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const sub = sp.get("subtab");
      if (sub === "project" || sub === "cong-trinh") return "Công trình";
      if (sub === "order" || sub === "don-hang") return "Đơn hàng";
      if (sub === "contract" || sub === "hop-dong") return "Hợp đồng";
      if (sub === "thcp" || sub === "doi-tuong-thcp") return "Đối tượng tập hợp chi phí";
    }
    return "Đối tượng tập hợp chi phí";
  });

  // WIP detail toggle
  const [wipDetailByCostElement, setWipDetailByCostElement] = useState(false);

  // WIP format 1: THCP rows
  const [wipThcpRows, setWipThcpRows] = useState([
    {
      id: "1",
      code: "",
      name: "",
      type: "",
      process: "",
      rawMaterial: 0,
      labor: 0,
      general: 0,
    },
  ]);

  // WIP format 2: Công trình rows
  const [wipProjectRows, setWipProjectRows] = useState([
    {
      id: "1",
      code: "",
      name: "",
      type: "",
      rawMaterial: 0,
      labor: 0,
      machinery: 0,
      general: 0,
      total: 0,
      accepted: 0,
    },
  ]);

  // WIP format 3: Đơn hàng rows
  const [wipOrderRows, setWipOrderRows] = useState([
    {
      id: "1",
      code: "",
      date: "",
      desc: "",
      customer: "",
      rawMaterial: 0,
      labor: 0,
      general: 0,
    },
  ]);

  // WIP format 4: Hợp đồng rows
  const [wipContractRows, setWipContractRows] = useState([
    {
      id: "1",
      code: "",
      date: "",
      name: "",
      customer: "",
      rawMaterial: 0,
      labor: 0,
      general: 0,
    },
  ]);

  // Sample data options for WIP dropdowns
  const sampleThcpOptions = [
    { code: "THCP01", name: "Sản xuất Bàn làm việc Hòa Phát", type: "Sản phẩm", process: "Giản đơn" },
    { code: "THCP02", name: "Sản xuất Ghế xoay văn phòng GX01", type: "Sản phẩm", process: "Giản đơn" },
    { code: "THCP03", name: "Sản xuất Tủ hồ sơ 3 ngăn", type: "Sản phẩm", process: "Giản đơn" },
  ];

  const sampleProjectOptions = [
    { code: "CT01", name: "Tòa nhà Văn phòng TechCom Tower", type: "Công trình dân dụng" },
    { code: "CT02", name: "Thi công Đường cao tốc Bắc Nam gói XL02", type: "Công trình giao thông" },
    { code: "CT03", name: "Xây dựng Trụ sở chi nhánh BIDV Cầu Giấy", type: "Công trình dân dụng" },
  ];

  const sampleOrderOptions = [
    { code: "DH001", date: "15/01/2026", desc: "Cung cấp bàn ghế văn phòng đợt 1", customer: "Công ty TNHH Minh An" },
    { code: "DH002", date: "20/01/2026", desc: "Gia công kết cấu thép nhà xưởng", customer: "Tập đoàn Xây dựng Hòa Bình" },
    { code: "DH003", date: "25/01/2026", desc: "Thi công hệ thống điện mạng tầng 3", customer: "Công ty CP Công nghệ FPT" },
  ];

  const sampleContractOptions = [
    { code: "HD001", date: "10/01/2026", name: "Hợp đồng thi công hoàn thiện nội thất", customer: "Tổng Công ty Sông Đà" },
    { code: "HD002", date: "18/01/2026", name: "Hợp đồng bảo trì hệ thống điều hòa", customer: "Công ty CP Dịch vụ Vinhomes" },
    { code: "HD003", date: "22/01/2026", name: "Hợp đồng cung cấp vật tư phụ tùng cơ khí", customer: "Công ty TNHH Canon Việt Nam" },
  ];

  // =========================================================================
  // MODAL 8: TÀI SẢN CỐ ĐỊNH ĐẦU KỲ STATES & DATA (Screenshots 1 - 5)
  // =========================================================================
  const sampleAssetDepartments = [
    { code: "P.GD", name: "Phòng Giám đốc" },
    { code: "P.KT", name: "Phòng Kế toán" },
    { code: "P.KD", name: "Phòng Kinh doanh" },
    { code: "P.SX", name: "Phân xưởng sản xuất" },
    { code: "P.HC", name: "Phòng Hành chính nhân sự" },
    { code: "P.IT", name: "Phòng Công nghệ thông tin" },
  ];

  const sampleAssetTypes = [
    { code: "01", name: "Nhà cửa, vật kiến trúc" },
    { code: "02", name: "Máy móc, thiết bị" },
    { code: "03", name: "Phương tiện vận tải, truyền dẫn" },
    { code: "04", name: "Thiết bị, dụng cụ quản lý" },
    { code: "05", name: "Vườn cây lâu năm, súc vật làm việc" },
    { code: "06", name: "TSCĐ vô hình - Quyền sử dụng đất" },
    { code: "07", name: "TSCĐ vô hình - Bản quyền, bằng sáng chế" },
    { code: "08", name: "Tài sản cố định khác" },
  ];

  const sampleAssetSuppliers = [
    { code: "NCC01", name: "Công ty Cổ phần Toyota Việt Nam" },
    { code: "NCC02", name: "Công ty TNHH Thiết bị Công nghiệp Việt Nam" },
    { code: "NCC03", name: "Công ty Cổ phần FPT" },
    { code: "NCC04", name: "Tổng công ty Xây dựng số 1" },
  ];

  // Common Top Fields
  const [assetVoucherNo, setAssetVoucherNo] = useState("OPN");
  const [assetVoucherDate, setAssetVoucherDate] = useState("01/01/2026");
  const [assetType, setAssetType] = useState("03 - Phương tiện vận tải, truyền dẫn");
  const [assetCode, setAssetCode] = useState("TSCD001");
  const [assetDepartment, setAssetDepartment] = useState("P.GD - Phòng Giám đốc");
  const [assetName, setAssetName] = useState("Xe ô tô Toyota Fortuner 2.7V");
  const [assetNoDepreciation, setAssetNoDepreciation] = useState(false);

  // Active Tab: 5 tabs
  const [assetActiveTab, setAssetActiveTab] = useState<"depreciation" | "allocation" | "components" | "accessories" | "others">(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const sub = sp.get("subtab") || sp.get("tab");
      if (sub === "allocation" || sub === "phan-bo") return "allocation";
      if (sub === "components" || sub === "cau-thanh") return "components";
      if (sub === "accessories" || sub === "phu-tung") return "accessories";
      if (sub === "others" || sub === "khac") return "others";
    }
    return "depreciation";
  });

  // Tab 1: Thông tin khấu hao
  const [assetCostAcc, setAssetCostAcc] = useState("2113");
  const [assetDeprAcc, setAssetDeprAcc] = useState("2141");
  const [assetDeprStartDate, setAssetDeprStartDate] = useState("01/01/2026");
  const [assetUsageTime, setAssetUsageTime] = useState("5,00");
  const [assetUsageUnit, setAssetUsageUnit] = useState("Năm");
  const [assetRemainingTime, setAssetRemainingTime] = useState("3,00");
  const [assetRemainingUnit, setAssetRemainingUnit] = useState("Năm");
  const [assetOriginalCost, setAssetOriginalCost] = useState("1150000000");
  const [assetDeprCost, setAssetDeprCost] = useState("1150000000");
  const [assetAccumDepr, setAssetAccumDepr] = useState("460000000");
  const [assetMonthDeprRate, setAssetMonthDeprRate] = useState("1,67");
  const [assetMonthDeprVal, setAssetMonthDeprVal] = useState("19166667");
  const [assetRemainingVal, setAssetRemainingVal] = useState("690000000");
  const [assetYearDeprRate, setAssetYearDeprRate] = useState("20,00");
  const [assetYearDeprVal, setAssetYearDeprVal] = useState("230000000");
  const [assetTaxLimitChecked, setAssetTaxLimitChecked] = useState(false);
  const [assetTaxLawDeprCost, setAssetTaxLawDeprCost] = useState("0");
  const [assetTaxLawMonthDeprVal, setAssetTaxLawMonthDeprVal] = useState("0");

  // Tab 2: Thiết lập phân bổ
  const [assetAllocRows, setAssetAllocRows] = useState([
    { id: "1", targetCode: "P.GD", targetName: "Phòng Giám đốc", rate: "100,00", expenseAcc: "6422", expenseItem: "CPKH_TSCD", statCode: "" },
  ]);

  // Tab 3: Bộ phận cấu thành
  const [assetComponentRows, setAssetComponentRows] = useState([
    { id: "1", partName: "Động cơ Dual VVT-i 2.7L", unit: "Chiếc", quantity: "1,00", warrantyPeriod: "36 tháng" },
  ]);

  // Tab 4: Dụng cụ, phụ tùng kèm theo
  const [assetAccessoryRows, setAssetAccessoryRows] = useState([
    { id: "1", name: "Lốp dự phòng Bridgestone 265/60R18", unit: "Quả", quantity: "1,00", value: "4500000" },
  ]);

  // Tab 5: Thông tin khác
  const [assetManufacturer, setAssetManufacturer] = useState("Toyota Motor Corporation");
  const [assetManufactureYear, setAssetManufactureYear] = useState("2023");
  const [assetModelNo, setAssetModelNo] = useState("VIN-TY8492048201");
  const [assetOriginCountry, setAssetOriginCountry] = useState("Nhật Bản");
  const [assetCapacity, setAssetCapacity] = useState("164 HP / 5200 rpm");
  const [assetWarrantyPeriod, setAssetWarrantyPeriod] = useState("36 tháng hoặc 100.000 km");
  const [assetWarrantyCondition, setAssetWarrantyCondition] = useState("Bảo hành chính hãng tại tất cả các đại lý ủy quyền của Toyota trên toàn quốc");
  const [assetSupplier, setAssetSupplier] = useState("NCC01");
  const [assetHandoverVoucherNo, setAssetHandoverVoucherNo] = useState("BBGN-089/2023");
  const [assetHandoverDate, setAssetHandoverDate] = useState("15/12/2023");
  const [assetConditionStatus, setAssetConditionStatus] = useState("Mới");
  const [assetCurrentQuality, setAssetCurrentQuality] = useState("Hoạt động tốt");

  // Accounts grid rows
  const [accountRows, setAccountRows] = useState([
    { account: "1111", name: "Tiền Việt Nam", debit: 0, credit: 0 },
    { account: "1121", name: "Tiền gửi Ngân hàng TMCP Ngoại thương VN (VCB)", debit: 0, credit: 0 },
    { account: "131", name: "Phải thu của khách hàng", debit: 0, credit: 0 },
    { account: "152", name: "Nguyên liệu, vật liệu", debit: 0, credit: 0 },
    { account: "1561", name: "Giá mua hàng hóa", debit: 0, credit: 0 },
    { account: "2111", name: "Nhà cửa, vật kiến trúc", debit: 0, credit: 0 },
    { account: "331", name: "Phải trả cho người bán", debit: 0, credit: 0 },
    { account: "4111", name: "Vốn góp của chủ sở hữu", debit: 0, credit: 0 },
  ]);

  // Section collapse state in customer/supplier modals
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(true);
  const [projectDetailOpen, setProjectDetailOpen] = useState(true);

  // Form states for modals
  const [bankAccountCode, setBankAccountCode] = useState("1121");
  const [bankAccNumber, setBankAccNumber] = useState("");
  const [bankDebit, setBankDebit] = useState(0);
  const [bankCredit, setBankCredit] = useState(0);

  const [partnerAccCode, setPartnerAccCode] = useState("131");
  const [partnerName, setPartnerName] = useState("");
  const [partnerDebit, setPartnerDebit] = useState(0);
  const [partnerCredit, setPartnerCredit] = useState(0);

  const [supplierAccCode, setSupplierAccCode] = useState("331");
  const [supplierName, setSupplierName] = useState("");
  const [supplierDebit, setSupplierDebit] = useState(0);
  const [supplierCredit, setSupplierCredit] = useState(0);

  const [employeeAccCode, setEmployeeAccCode] = useState("141");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeDebit, setEmployeeDebit] = useState(0);
  const [employeeCredit, setEmployeeCredit] = useState(0);

  const [inventoryItem, setInventoryItem] = useState("");
  const [inventoryWarehouse, setInventoryWarehouse] = useState("");
  const [inventoryQty, setInventoryQty] = useState(0);
  const [inventoryVal, setInventoryVal] = useState(0);

  const activeCategory = OPENING_CATEGORIES.find((c) => c.id === activeCategoryId);

  const handleOpenCategory = (id: string) => {
    setActiveCategoryId(id);
  };

  const handleBackToHub = () => {
    setActiveCategoryId(null);
    setActiveModal(null);
  };

  const handleSaveModal = (type: string, andAdd = false) => {
    if(type==='Số dư TK ngân hàng'&&!bankAccNumber){notify?.('Vui lòng chọn tài khoản ngân hàng.');return;}
    const requiredPartner = type === "Công nợ khách hàng" ? partnerName
      : type === "Công nợ nhà cung cấp" ? supplierName
      : type === "Công nợ nhân viên" ? employeeName : undefined;
    if (requiredPartner === "") {
      notify?.(`Vui lòng chọn ${type === "Công nợ khách hàng" ? "khách hàng" : type === "Công nợ nhà cung cấp" ? "nhà cung cấp" : "nhân viên"}.`);
      return;
    }
    notify?.(`Đã lưu thành công ${type}.`);
    if (!andAdd) {
      setActiveModal(null);
    }
  };

  // =========================================================================
  // VIEW 1: MAIN HUB SCREEN (10 TILES) - Matches Screenshot 3
  // =========================================================================
  if (!activeCategoryId) {
    return (
      <div className="misa-opening-container">
        <div className="misa-opening-hub">
          <h2 className="misa-opening-hub-title">Nhập số dư ban đầu</h2>

          <div className="misa-opening-tiles-grid">
            {OPENING_CATEGORIES.map((cat, idx) => (
              <div
                key={cat.id}
                className="misa-opening-tile"
                onClick={() => handleOpenCategory(cat.id)}
              >
                <div className="misa-opening-tile-icon">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    {/* Folder base */}
                    <rect x="6" y="8" width="36" height="34" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                    <rect x="6" y="8" width="36" height="8" rx="2" fill="#e2e8f0" />
                    {/* Badge */}
                    <circle cx="24" cy="26" r="12" fill={cat.color} opacity="0.15" />
                    <circle cx="24" cy="26" r="9" fill={cat.color} />
                    <text x="24" y="30" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
                      {idx === 0
                        ? "$"
                        : idx === 1
                        ? "NH"
                        : idx === 2
                        ? "KH"
                        : idx === 3
                        ? "NC"
                        : idx === 4
                        ? "NV"
                        : idx === 5
                        ? "KHO"
                        : idx === 6
                        ? "CC"
                        : idx === 7
                        ? "TS"
                        : idx === 8
                        ? "CP"
                        : "DD"}
                    </text>
                  </svg>
                </div>
                <span className="misa-opening-tile-label">{cat.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: CATEGORY DETAIL PAGE (LANDING + MODALS)
  // =========================================================================
  return (
    <div className="misa-opening-container">
      {/* Top Header */}
      <div className="misa-opening-detail-header">
        <div className="misa-opening-detail-left" style={{ display: "flex", alignItems: "center" }}>
          <h3 className="misa-opening-detail-title" style={{ margin: 0 }}>{activeCategory?.title}</h3>
          {activeCategoryId === "wip" && (
            <a
              href="#catalog"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#0284c7",
                fontSize: 13,
                textDecoration: "none",
                fontWeight: 500,
                marginLeft: 12,
              }}
              onClick={(e) => {
                e.preventDefault();
                notify?.(
                  `Mở ${
                    wipSubtab === "Công trình"
                      ? "Danh mục Công trình"
                      : wipSubtab === "Đơn hàng"
                      ? "Đơn hàng"
                      : wipSubtab === "Hợp đồng"
                      ? "Hợp đồng"
                      : "Danh mục Đối tượng tập chi phí"
                  }...`
                );
              }}
            >
              <RotateCcw size={13} color="#0284c7" />
              <span>
                {wipSubtab === "Công trình"
                  ? "Danh mục Công trình"
                  : wipSubtab === "Đơn hàng"
                  ? "Đơn hàng"
                  : wipSubtab === "Hợp đồng"
                  ? "Hợp đồng"
                  : "Danh mục Đối tượng tập chi phí"}
              </span>
            </a>
          )}
          {activeCategoryId !== "tools" && activeCategoryId !== "wip" && (
            <a
              href={activeCategory?.catalogLink}
              className="misa-opening-catalog-link"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#0284c7",
                fontSize: 13,
                textDecoration: "none",
                fontWeight: 500,
                marginLeft: 12,
              }}
              onClick={(e) => {
                e.preventDefault();
                notify?.(`Đang mở ${activeCategory?.catalogName}...`);
              }}
            >
              <RotateCcw size={13} color="#0284c7" />
              <span>{activeCategory?.catalogName}</span>
            </a>
          )}
        </div>

        <div className="misa-opening-detail-right">
          {activeCategoryId !== "tools" && activeCategoryId !== "wip" && activeCategoryId !== "assets" && (
            <div className="misa-opening-info-note">
              <span style={{ color: "#00a862", fontWeight: 700 }}>ⓘ</span>
              <span>
                Để nhập &lt;{activeCategory?.title}&gt; theo ngoại tệ bạn cần thay đổi tùy chọn tiền tệ trong{" "}
                <a
                  href="#settings"
                  className="misa-opening-info-link"
                  onClick={(e) => {
                    e.preventDefault();
                    notify?.("Mở thiết lập tiền tệ...");
                  }}
                >
                  Tùy chọn chung
                </a>
                . Xem hướng dẫn{" "}
                <a
                  href="#guide"
                  className="misa-opening-info-link"
                  onClick={(e) => {
                    e.preventDefault();
                    notify?.("Mở hướng dẫn nhập số dư...");
                  }}
                >
                  tại đây
                </a>
              </span>
            </div>
          )}

          <button
            type="button"
            className="misa-opening-help-btn"
            style={
              activeCategoryId === "tools" || activeCategoryId === "wip" || activeCategoryId === "assets"
                ? {
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontSize: 12.5,
                    color: "#374151",
                    cursor: "pointer",
                  }
                : undefined
            }
            onClick={() => notify?.("Hướng dẫn sử dụng nhập số dư ban đầu.")}
          >
            <HelpCircle size={15} color="#00a862" />
            <span>Hướng dẫn sử dụng</span>
            <ChevronDown size={13} color="#64748b" />
          </button>

          <button
            type="button"
            className="misa-opening-close-btn"
            onClick={handleBackToHub}
            title="Đóng về màn hình tổng"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Chi phí dở dang Subtabs */}
      {activeCategoryId === "wip" && (
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "10px 24px 0",
            background: "#f1f5f9",
            borderBottom: "1px solid #cbd5e1",
          }}
        >
          {["Đối tượng tập hợp chi phí", "Công trình", "Đơn hàng", "Hợp đồng"].map((sub) => {
            const isActive = wipSubtab === sub;
            return (
              <button
                key={sub}
                type="button"
                style={{
                  background: isActive ? "#ffffff" : "transparent",
                  border: isActive ? "1px solid #cbd5e1" : "1px solid transparent",
                  borderBottom: isActive ? "1px solid #ffffff" : "none",
                  marginBottom: isActive ? -1 : 0,
                  borderRadius: "6px 6px 0 0",
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#00a862" : "#334155",
                  borderTop: isActive ? "3px solid #00a862" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onClick={() => setWipSubtab(sub)}
              >
                {sub}
              </button>
            );
          })}
        </div>
      )}

      {/* Landing View with Centered Illustration */}
      <div className="misa-opening-landing">
        <div className="misa-opening-illustration" style={{ marginBottom: 20 }}>
          <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
            {/* Dotted arc guidelines */}
            <path d="M 40 50 Q 80 110 120 115" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
            <path d="M 120 115 Q 160 100 195 55" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
            <path d="M 120 115 Q 140 70 145 35" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />

            {/* Left Calculator Icon */}
            <rect x="24" y="32" width="28" height="38" rx="4" fill="#00a862" />
            <rect x="28" y="36" width="20" height="8" rx="1.5" fill="#ffffff" />
            <circle cx="32" cy="50" r="1.8" fill="#ffffff" />
            <circle cx="38" cy="50" r="1.8" fill="#ffffff" />
            <circle cx="44" cy="50" r="1.8" fill="#ffffff" />
            <circle cx="32" cy="56" r="1.8" fill="#ffffff" />
            <circle cx="38" cy="56" r="1.8" fill="#ffffff" />
            <circle cx="44" cy="56" r="1.8" fill="#ffffff" />
            <circle cx="32" cy="62" r="1.8" fill="#ffffff" />
            <circle cx="38" cy="62" r="1.8" fill="#ffffff" />
            <circle cx="44" cy="62" r="1.8" fill="#ffffff" />

            {/* Small Dollar Badge next to calculator */}
            <circle cx="58" cy="40" r="7" fill="#00a862" />
            <text x="58" y="44" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">$</text>

            {/* Top Icons */}
            <circle cx="140" cy="28" r="5" fill="#94a3b8" opacity="0.4" />
            
            {/* House/Building Badge */}
            <circle cx="142" cy="46" r="8" fill="#00a862" />
            <path d="M 138 48 L 142 43 L 146 48 Z" fill="#ffffff" />
            <rect x="139.5" y="48" width="5" height="4" fill="#ffffff" />

            {/* Clock / Pie Chart Badge */}
            <circle cx="168" cy="38" r="9" fill="#00a862" />
            <path d="M 168 32 A 6 6 0 0 1 174 38 L 168 38 Z" fill="#ffffff" />
            <circle cx="168" cy="38" r="6" stroke="#ffffff" strokeWidth="1.2" fill="none" />

            {/* Dollar Badge Right */}
            <circle cx="152" cy="68" r="7" fill="#00a862" />
            <text x="152" y="72" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">$</text>

            {/* Percent Badge */}
            <circle cx="178" cy="64" r="8" fill="#00a862" />
            <text x="178" y="68" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold">%</text>

            {/* Woman sitting at laptop */}
            <path d="M 106 60 C 106 50 134 50 134 60 C 134 76 138 88 140 98 C 134 98 128 88 128 80 C 120 86 112 86 106 80 Z" fill="#334155" />
            <ellipse cx="120" cy="68" rx="8" ry="10" fill="#fed7aa" />
            <path d="M 113 62 C 117 68 124 64 127 60" stroke="#334155" strokeWidth="2.5" fill="none" />
            <path d="M 108 86 C 112 80 128 80 132 86 L 136 118 L 104 118 Z" fill="#00a862" />
            <polygon points="117,84 123,84 120,93" fill="#ffffff" />
            <ellipse cx="120" cy="148" rx="55" ry="5" fill="#e2e8f0" />
            <rect x="100" y="112" width="40" height="26" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
            <polygon points="94,138 146,138 142,135 98,135" fill="#94a3b8" />
          </svg>
        </div>

        <h3 className="misa-opening-heading" style={{ fontSize: 14.5, fontWeight: 600, maxWidth: 660, lineHeight: 1.5, color: "#1e293b", marginBottom: 20 }}>
          {activeCategory?.heading}
        </h3>

        <div className="misa-opening-landing-btns">
          <button
            type="button"
            className="misa-opening-btn-primary"
            onClick={() => setActiveModal(activeCategoryId)}
          >
            Nhập số dư
          </button>
          <button
            type="button"
            className="misa-opening-btn-secondary"
            onClick={() => notify?.("Chuẩn bị nhập số dư từ tệp Excel mẫu...")}
          >
            Nhập số dư từ Excel
          </button>

          {/* Floating Tooltip Bubble */}
          {activeCategoryId !== "tools" && (
            <div className="misa-opening-tooltip-bubble">{activeCategory?.tooltipText}</div>
          )}
        </div>

        <button
          type="button"
          style={{
            marginTop: 44,
            padding: "5px 16px",
            borderRadius: 4,
            border: "1px solid #00a862",
            background: "#ffffff",
            color: "#00a862",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
          onClick={() => notify?.("Xem danh sách chứng từ đã nhập...")}
        >
          Xem danh sách chứng từ
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: SỐ DƯ TÀI KHOẢN (FULL-SCREEN TABLE ENTRY)                         */}
      {/* ========================================================================= */}
      {activeModal === "accounts" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" style={{ maxWidth: 1040 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập số dư tài khoản</h3>
              <button type="button" className="misa-opening-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ position: "relative", width: 260 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Nhập từ khóa tìm kiếm"
                    className="misa-opening-input"
                    style={{ paddingLeft: 32, width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ overflowX: "auto", width: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#dcfce7", color: "#166534", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", width: 140 }}>Số tài khoản</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên tài khoản</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", width: 150 }}>Dư Nợ</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", width: 150 }}>Dư Có</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", width: 120 }}>Chi tiết số dư</th>
                      <th style={{ padding: "8px 12px", width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountRows.map((row, idx) => (
                      <tr key={row.account} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 12px", fontWeight: 600 }}>{row.account}</td>
                        <td style={{ padding: "6px 12px" }}>{row.name}</td>
                        <td style={{ padding: "6px 12px" }}>
                          <input
                            type="number"
                            value={row.debit}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const next = [...accountRows];
                              next[idx].debit = val;
                              setAccountRows(next);
                            }}
                            className="misa-opening-input"
                            style={{ textAlign: "right", width: "100%" }}
                          />
                        </td>
                        <td style={{ padding: "6px 12px" }}>
                          <input
                            type="number"
                            value={row.credit}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const next = [...accountRows];
                              next[idx].credit = val;
                              setAccountRows(next);
                            }}
                            className="misa-opening-input"
                            style={{ textAlign: "right", width: "100%" }}
                          />
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                          <span style={{ color: "#00a862", cursor: "pointer", fontSize: 12.5 }}>Nhập chi tiết</span>
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setAccountRows(accountRows.filter((_, i) => i !== idx))}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: "8px 12px" }}>Tổng</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {accountRows.reduce((a, b) => a + b.debit, 0).toLocaleString("vi-VN")}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {accountRows.reduce((a, b) => a + b.credit, 0).toLocaleString("vi-VN")}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="misa-opening-btn-secondary"
                  style={{ height: 30, fontSize: 12.5, padding: "0 12px" }}
                  onClick={() => setAccountRows([...accountRows, { account: "1388", name: "Phải thu khác", debit: 0, credit: 0 }])}
                >
                  + Thêm dòng
                </button>
                <button
                  type="button"
                  className="misa-opening-btn-secondary"
                  style={{ height: 30, fontSize: 12.5, padding: "0 12px" }}
                  onClick={() => setAccountRows([])}
                >
                  Xóa hết dòng
                </button>
              </div>
            </div>

            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>
                Đóng
              </button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Số dư tài khoản", true)}>
                Cất
              </button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Số dư tài khoản", false)}>
                Cất và Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SỐ DƯ TÀI KHOẢN NGÂN HÀNG                                        */}
      {/* ========================================================================= */}
      {activeModal === "bank" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Số dư tài khoản ngân hàng</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body">
              <div className="misa-opening-field">
                <label className="misa-opening-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                <select aria-label="Số tài khoản đầu kỳ" className="misa-opening-select" value={bankAccountCode} onChange={(e) => setBankAccountCode(e.target.value)}>
                  <option value="112">112 - Tiền gửi ngân hàng</option>
                  <option value="1121">1121 - Tiền Việt Nam</option>
                  <option value="1122">1122 - Ngoại tệ</option>
                </select>
              </div>
              <div className="misa-opening-field">
                <label className="misa-opening-label">Tài khoản ngân hàng <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select aria-label="Tài khoản ngân hàng đầu kỳ" className="misa-opening-select" style={{ flex: 1 }} value={bankAccNumber} onChange={(e) => setBankAccNumber(e.target.value)}>
                    <option value="">-- Chọn số tài khoản ngân hàng --</option>
                    <option value="VCB-001">0011004234567 - Vietcombank Sở giao dịch</option>
                    <option value="TCB-002">1903456789001 - Techcombank Ba Đình</option>
                    <option value="MB-003">0580123456789 - MBBank Chi nhánh Đống Đa</option>
                  </select>
                  <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>
                    +
                  </button>
                </div>
              </div>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Dư Nợ</label>
                  <input aria-label="Dư Nợ ngân hàng đầu kỳ" type="number" className="misa-opening-input" value={bankDebit} onChange={(e) => setBankDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Dư Có</label>
                  <input aria-label="Dư Có ngân hàng đầu kỳ" type="number" className="misa-opening-input" value={bankCredit} onChange={(e) => setBankCredit(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>
                Đóng
              </button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Số dư TK ngân hàng", false)}>
                Cất
              </button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Số dư TK ngân hàng", true)}>
                Cất và Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CÔNG NỢ KHÁCH HÀNG (EXPANDABLE SECTIONS)                        */}
      {/* ========================================================================= */}
      {activeModal === "customers" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập chi tiết công nợ khách hàng</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                  <select aria-label="Số tài khoản công nợ khách hàng" className="misa-opening-select" value={partnerAccCode} onChange={(e) => setPartnerAccCode(e.target.value)}>
                    <option value="131">131 - Phải thu của khách hàng</option>
                    <option value="1361">1361 - Vốn kinh doanh ở các đơn vị trực thuộc</option>
                    <option value="1362">1362 - Phải thu nội bộ về chênh lệch tỷ giá</option>
                    <option value="1363">1363 - Phải thu nội bộ về chi phí đi vay đủ điều kiện</option>
                    <option value="1368">1368 - Phải thu nội bộ khác</option>
                  </select>
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Khách hàng <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select aria-label="Khách hàng đầu kỳ" className="misa-opening-select" style={{ flex: 1 }} value={partnerName} onChange={(e) => setPartnerName(e.target.value)}>
                      <option value="">-- Chọn khách hàng --</option>
                      <option value="KH001">KH001 - Công ty Cổ phần Công nghệ Sao Việt</option>
                      <option value="KH002">KH002 - Công ty TNHH Đầu tư & Thương mại Thăng Long</option>
                      <option value="KH003">KH003 - Doanh nghiệp Tư nhân Minh Phát</option>
                    </select>
                    <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>
                      +
                    </button>
                  </div>
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Nợ</label>
                  <input type="number" className="misa-opening-input" value={partnerDebit} onChange={(e) => setPartnerDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Có</label>
                  <input type="number" className="misa-opening-input" value={partnerCredit} onChange={(e) => setPartnerCredit(Number(e.target.value) || 0)} />
                </div>
              </div>

              {/* Collapsible 1: Chi tiết theo Hóa đơn */}
              <div className="misa-opening-collapsible-section">
                <div className="misa-opening-collapsible-title" onClick={() => setInvoiceDetailOpen(!invoiceDetailOpen)}>
                  {invoiceDetailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Chi tiết theo Hóa đơn</span>
                </div>
                {invoiceDetailOpen && (
                  <div style={{ padding: 10 }}>
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table className="misa-opening-table-mini">
                        <thead>
                          <tr>
                            <th>Ngày hóa đơn/chứng từ</th>
                            <th>Số hóa đơn/chứng từ</th>
                            <th>Hạn thanh toán</th>
                            <th style={{ textAlign: "right" }}>Giá trị hóa đơn</th>
                            <th style={{ textAlign: "right" }}>Số còn phải thu</th>
                            <th style={{ textAlign: "right" }}>Số thu trước</th>
                            <th>Nhân viên</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><input type="text" className="misa-opening-input" defaultValue="15/12/2025" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="HD00125" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="15/01/2026" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="50000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="50000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="0" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="Nguyễn Văn A" style={{ height: 26, fontSize: 12 }} /></td>
                            <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible 2: Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng */}
              <div className="misa-opening-collapsible-section">
                <div className="misa-opening-collapsible-title" onClick={() => setProjectDetailOpen(!projectDetailOpen)}>
                  {projectDetailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng</span>
                </div>
                {projectDetailOpen && (
                  <div style={{ padding: 10 }}>
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table className="misa-opening-table-mini">
                        <thead>
                          <tr>
                            <th>Nhân viên</th>
                            <th>Đơn vị</th>
                            <th>Công trình</th>
                            <th>Đơn đặt hàng</th>
                            <th>Hợp đồng bán</th>
                            <th style={{ textAlign: "right" }}>Dư Nợ</th>
                            <th style={{ textAlign: "right" }}>Dư Có</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><input type="text" className="misa-opening-input" placeholder="Nhân viên" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="Phòng Kinh doanh" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" placeholder="Công trình" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" placeholder="Đơn hàng" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="HĐ-2025/08" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="50000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="0" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ khách hàng", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ khách hàng", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CÔNG NỢ NHÀ CUNG CẤP                                              */}
      {/* ========================================================================= */}
      {activeModal === "suppliers" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập chi tiết công nợ nhà cung cấp</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 520 }}>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field" style={{ flex: 1.2 }}>
                  <label className="misa-opening-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                  <select className="misa-opening-select" value={supplierAccCode} onChange={(e) => setSupplierAccCode(e.target.value)}>
                    <option value="331">331 - Phải trả cho người bán</option>
                    <option value="3361">3361 - Phải trả nội bộ về vốn kinh doanh</option>
                    <option value="3362">3362 - Phải trả nội bộ về chênh lệch tỷ giá</option>
                    <option value="3363">3363 - Phải trả nội bộ về chi phí đi vay đủ điều kiện</option>
                    <option value="3368">3368 - Phải trả nội bộ khác</option>
                    <option value="3411">3411 - Các khoản đi vay</option>
                    <option value="3412">3412 - Nợ thuê tài chính</option>
                  </select>
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Nhà cung cấp <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select className="misa-opening-select" style={{ flex: 1 }} value={supplierName} onChange={(e) => setSupplierName(e.target.value)}>
                      <option value="">-- Chọn nhà cung cấp --</option>
                      <option value="NCC001">NCC001 - Công ty TNHH Phân phối Thiết bị FPT</option>
                      <option value="NCC002">NCC002 - Công ty Cổ phần Dịch vụ Viễn thông Viettel</option>
                    </select>
                    <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>+</button>
                  </div>
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Nợ</label>
                  <input type="number" className="misa-opening-input" value={supplierDebit} onChange={(e) => setSupplierDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Có</label>
                  <input type="number" className="misa-opening-input" value={supplierCredit} onChange={(e) => setSupplierCredit(Number(e.target.value) || 0)} />
                </div>
              </div>

              {/* Collapsible 1: Chi tiết theo Hóa đơn */}
              <div className="misa-opening-collapsible-section">
                <div className="misa-opening-collapsible-title" onClick={() => setInvoiceDetailOpen(!invoiceDetailOpen)}>
                  {invoiceDetailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Chi tiết theo Hóa đơn</span>
                </div>
                {invoiceDetailOpen && (
                  <div style={{ padding: 10 }}>
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table className="misa-opening-table-mini">
                        <thead>
                          <tr>
                            <th>Ngày hóa đơn/chứng từ</th>
                            <th>Số hóa đơn/chứng từ</th>
                            <th>Hạn thanh toán</th>
                            <th style={{ textAlign: "right" }}>Giá trị hóa đơn</th>
                            <th style={{ textAlign: "right" }}>Số còn phải trả</th>
                            <th style={{ textAlign: "right" }}>Số trả trước</th>
                            <th>Nhân viên</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><input type="text" className="misa-opening-input" defaultValue="20/12/2025" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="HD-INVOICE-88" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="20/01/2026" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="80000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="80000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="0" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="Trần Thị B" style={{ height: 26, fontSize: 12 }} /></td>
                            <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible 2: Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng */}
              <div className="misa-opening-collapsible-section">
                <div className="misa-opening-collapsible-title" onClick={() => setProjectDetailOpen(!projectDetailOpen)}>
                  {projectDetailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng</span>
                </div>
                {projectDetailOpen && (
                  <div style={{ padding: 10 }}>
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table className="misa-opening-table-mini">
                        <thead>
                          <tr>
                            <th>Nhân viên</th>
                            <th>Đơn vị</th>
                            <th>Công trình</th>
                            <th>Đơn đặt hàng</th>
                            <th>Hợp đồng mua</th>
                            <th style={{ textAlign: "right" }}>Dư Nợ</th>
                            <th style={{ textAlign: "right" }}>Dư Có</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><input type="text" className="misa-opening-input" placeholder="Nhân viên" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="Phòng Vật tư" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" placeholder="Công trình" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" placeholder="Đơn hàng" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="text" className="misa-opening-input" defaultValue="HĐM-2025/11" style={{ height: 26, fontSize: 12 }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="0" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td><input type="number" className="misa-opening-input" defaultValue="80000000" style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                            <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>+ Thêm dòng</button>
                      <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12, padding: "0 10px" }}>Xóa hết dòng</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ nhà cung cấp", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ nhà cung cấp", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CÔNG NỢ NHÂN VIÊN                                                */}
      {/* ========================================================================= */}
      {activeModal === "employees" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập chi tiết công nợ nhân viên</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body">
              <div className="misa-opening-form-row">
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                  <select className="misa-opening-select" value={employeeAccCode} onChange={(e) => setEmployeeAccCode(e.target.value)}>
                    <option value="141">141 - Tạm ứng</option>
                    <option value="1388">1388 - Phải thu khác (Nhân viên)</option>
                    <option value="3341">3341 - Phải trả người lao động</option>
                  </select>
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Nhân viên <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select className="misa-opening-select" style={{ flex: 1 }} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)}>
                      <option value="">-- Chọn nhân viên --</option>
                      <option value="NV001">NV001 - Nguyễn Văn An (Phòng Kế toán)</option>
                      <option value="NV002">NV002 - Lê Thị Bình (Phòng Kinh doanh)</option>
                    </select>
                    <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>+</button>
                  </div>
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Nợ</label>
                  <input type="number" className="misa-opening-input" value={employeeDebit} onChange={(e) => setEmployeeDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field" style={{ flex: 1 }}>
                  <label className="misa-opening-label">Dư Có</label>
                  <input type="number" className="misa-opening-input" value={employeeCredit} onChange={(e) => setEmployeeCredit(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ nhân viên", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ nhân viên", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: TỒN KHO VẬT TƯ, HÀNG HÓA VÀ CCDC                                  */}
      {/* ========================================================================= */}
      {activeModal === "inventory" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập chi tiết tồn kho vật tư hàng hóa</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body">
              <div className="misa-opening-field">
                <label className="misa-opening-label">Hàng hóa <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select className="misa-opening-select" style={{ flex: 1 }} value={inventoryItem} onChange={(e) => setInventoryItem(e.target.value)}>
                    <option value="">-- Chọn hàng hóa, vật tư --</option>
                    <option value="HH01">HH01 - Máy tính Dell Vostro 3520</option>
                    <option value="HH02">HH02 - Ổ cứng SSD Samsung 1TB</option>
                    <option value="VL01">VL01 - Dây cáp mạng Cat6 UTP</option>
                  </select>
                  <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>+</button>
                </div>
              </div>
              <div className="misa-opening-field">
                <label className="misa-opening-label">Kho <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select className="misa-opening-select" style={{ flex: 1 }} value={inventoryWarehouse} onChange={(e) => setInventoryWarehouse(e.target.value)}>
                    <option value="">-- Chọn kho lưu trữ --</option>
                    <option value="KHO_TONG">KHO_TONG - Kho Tổng Hà Nội</option>
                    <option value="KHO_HCM">KHO_HCM - Kho Chi nhánh TP.HCM</option>
                  </select>
                  <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>+</button>
                </div>
              </div>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Đơn vị tính</label>
                  <select className="misa-opening-select">
                    <option>Chiếc</option>
                    <option>Bộ</option>
                    <option>Hộp</option>
                  </select>
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số lượng tồn</label>
                  <input type="number" className="misa-opening-input" value={inventoryQty} onChange={(e) => setInventoryQty(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Giá trị tồn</label>
                  <input type="number" className="misa-opening-input" value={inventoryVal} onChange={(e) => setInventoryVal(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Tồn kho vật tư", false)}>Cất</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Tồn kho vật tư", true)}>Cất và Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: CCDC ĐANG SỬ DỤNG ĐẦU KỲ (Screenshot 1 Exact Match)               */}
      {/* ========================================================================= */}
      {activeModal === "tools" && (
        <div
          className="misa-modal-overlay"
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
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "96vw",
              maxWidth: 1280,
              maxHeight: "92vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
            }}
          >
            {/* Header */}
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
                <RotateCcw size={16} color="#64748b" style={{ cursor: "pointer" }} />
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: "#1e293b" }}>
                  Khai báo công cụ dụng cụ đầu kỳ
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {/* Form Section with Gray Background #eceff1 */}
              <div
                style={{
                  background: "#eceff1",
                  padding: "12px 18px 16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  borderBottom: "1px solid #cbd5e1",
                }}
              >
                {/* Row 1 */}
                <div style={{ display: "grid", gridTemplateColumns: "110px 130px 1.4fr 110px 130px", gap: 12, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      Số CT ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={toolVoucherNo}
                      onChange={(e) => setToolVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      Ngày ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="__/__/____"
                        value={toolVoucherDate}
                        onChange={(e) => setToolVoucherDate(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8 }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      Nhóm CCDC
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <select
                        value={toolGroup}
                        onChange={(e) => setToolGroup(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 24px 0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, outline: "none", appearance: "none", boxSizing: "border-box", cursor: "pointer" }}
                      >
                        <option value="">Chọn nhóm CCDC</option>
                        <option value="CCDC-VP">CCDC văn phòng</option>
                        <option value="CCDC-SX">CCDC sản xuất</option>
                        <option value="CCDC-BH">CCDC bán hàng</option>
                      </select>
                      <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 8, pointerEvents: "none" }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3, textAlign: "right" }}>
                      Giá trị đã phân bổ
                    </label>
                    <input
                      type="text"
                      value={toolAllocatedVal}
                      onChange={(e) => setToolAllocatedVal(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3, textAlign: "right" }}>
                      Giá trị CCDC còn lại
                    </label>
                    <input
                      type="text"
                      value={toolRemainingVal}
                      onChange={(e) => setToolRemainingVal(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Row 2 */}
                <div style={{ display: "grid", gridTemplateColumns: "252px 1.4fr 110px 130px", gap: 12, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      Mã CCDC <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={toolCode}
                      onChange={(e) => setToolCode(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      Lý do ghi tăng
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        value={toolReason}
                        onChange={(e) => setToolReason(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 30px 0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                      <span title="Gợi ý lý do ghi tăng" style={{ display: "inline-flex" }}><Sparkles size={14} color="#8b5cf6" style={{ position: "absolute", right: 8, cursor: "pointer" }}  /></span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3, textAlign: "right" }}>
                      Số kỳ phân bổ
                    </label>
                    <input
                      type="text"
                      value={toolAllocPeriod}
                      onChange={(e) => setToolAllocPeriod(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3, textAlign: "right" }}>
                      Số kỳ phân bổ còn lại
                    </label>
                    <input
                      type="text"
                      value={toolRemainingPeriod}
                      onChange={(e) => setToolRemainingPeriod(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Row 3 */}
                <div style={{ display: "grid", gridTemplateColumns: "252px 115px 125px 1fr 110px 130px", gap: 12, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      Tên CCDC <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      Đơn vị tính
                    </label>
                    <input
                      type="text"
                      value={toolUnit}
                      onChange={(e) => setToolUnit(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3, textAlign: "right" }}>
                      Số lượng
                    </label>
                    <input
                      type="text"
                      value={toolQuantity}
                      onChange={(e) => setToolQuantity(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>{/* spacer */}</div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3, textAlign: "right" }}>
                      Số tiền PB hàng kỳ
                    </label>
                    <input
                      type="text"
                      value={toolPeriodAllocAmount}
                      onChange={(e) => setToolPeriodAllocAmount(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      TK chờ phân bổ
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <select
                        value={toolWaitingAccount}
                        onChange={(e) => setToolWaitingAccount(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 24px 0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, outline: "none", appearance: "none", boxSizing: "border-box", cursor: "pointer" }}
                      >
                        <option value="242">242</option>
                        <option value="2421">2421</option>
                        <option value="2422">2422</option>
                      </select>
                      <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 8, pointerEvents: "none" }} />
                    </div>
                  </div>
                </div>

                {/* Row 4 */}
                <div style={{ display: "grid", gridTemplateColumns: "252px 115px 125px 1fr auto", gap: 12, alignItems: "center" }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3 }}>
                      Loại CCDC
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 30, border: "1px solid #cbd5e1", borderRadius: 3, background: "#ffffff", padding: "0 8px", boxSizing: "border-box" }}>
                      <select
                        value={toolType}
                        onChange={(e) => setToolType(e.target.value)}
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, cursor: "pointer", appearance: "none" }}
                      >
                        <option value="">Chọn loại CCDC</option>
                        <option value="1">CCDC dùng 1 lần</option>
                        <option value="2">CCDC phân bổ nhiều kỳ</option>
                      </select>
                      <Plus size={14} color="#00a862" style={{ cursor: "pointer", flexShrink: 0 }} />
                      <ChevronDown size={14} color="#64748b" style={{ flexShrink: 0 }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3, textAlign: "right" }}>
                      Đơn giá
                    </label>
                    <input
                      type="text"
                      value={toolUnitPrice}
                      onChange={(e) => setToolUnitPrice(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 3, textAlign: "right" }}>
                      Thành tiền
                    </label>
                    <input
                      type="text"
                      value={toolTotalAmount}
                      onChange={(e) => setToolTotalAmount(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 13, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>{/* spacer */}</div>

                  <div style={{ paddingTop: 16 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={toolStopAlloc}
                        onChange={(e) => setToolStopAlloc(e.target.checked)}
                      />
                      <span>Ngừng phân bổ</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Tabs & Table Section (White background) */}
              <div style={{ background: "#ffffff", flex: 1, display: "flex", flexDirection: "column", padding: "0 0 10px 0" }}>
                {/* Tabs */}
                <div style={{ display: "flex", gap: 20, padding: "0 18px", borderBottom: "1px solid #e2e8f0" }}>
                  <button
                    type="button"
                    onClick={() => setToolActiveTab("department")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: toolActiveTab === "department" ? 600 : 500,
                      color: toolActiveTab === "department" ? "#00a862" : "#64748b",
                      borderBottom: toolActiveTab === "department" ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Đơn vị sử dụng
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolActiveTab("allocation")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "10px 4px",
                      fontSize: 13,
                      fontWeight: toolActiveTab === "allocation" ? 600 : 500,
                      color: toolActiveTab === "allocation" ? "#00a862" : "#64748b",
                      borderBottom: toolActiveTab === "allocation" ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Thiết lập phân bổ
                  </button>
                </div>

                {/* Table inside Tab */}
                <div style={{ padding: "10px 18px", flex: 1 }}>
                  {toolActiveTab === "department" ? (
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                            <th style={{ width: 40, textAlign: "center", padding: "4px 8px", borderRight: "1px dotted #94a3b8" }}>#</th>
                            <th style={{ width: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Mã đơn vị</th>
                            <th style={{ minWidth: 320, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tên đơn vị</th>
                            <th style={{ width: 200, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Số lượng</th>
                            <th style={{ width: 40, textAlign: "center", padding: "4px 8px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {toolDeptRows.map((row, idx) => (
                            <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                              <td style={{ textAlign: "center", color: "#64748b", padding: "4px 8px", borderRight: "1px dotted #cbd5e1" }}>{idx + 1}</td>
                              <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.deptCode}
                                  placeholder="Chọn đơn vị"
                                  onChange={(e) => {
                                    const next = [...toolDeptRows];
                                    next[idx].deptCode = e.target.value;
                                    setToolDeptRows(next);
                                  }}
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.deptName}
                                  placeholder="Tên đơn vị"
                                  onChange={(e) => {
                                    const next = [...toolDeptRows];
                                    next[idx].deptName = e.target.value;
                                    setToolDeptRows(next);
                                  }}
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.quantity}
                                  placeholder="1"
                                  onChange={(e) => {
                                    const next = [...toolDeptRows];
                                    next[idx].quantity = e.target.value;
                                    setToolDeptRows(next);
                                  }}
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                                />
                              </td>
                              <td style={{ textAlign: "center", padding: "2px 6px" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (toolDeptRows.length > 1) {
                                      setToolDeptRows(toolDeptRows.filter((r) => r.id !== row.id));
                                    }
                                  }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                                  title="Xóa dòng"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* Tab Thiết lập phân bổ */
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                            <th style={{ width: 40, textAlign: "center", padding: "4px 8px", borderRight: "1px dotted #94a3b8" }}>#</th>
                            <th style={{ minWidth: 260, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Đối tượng phân bổ</th>
                            <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tỷ lệ phân bổ (%)</th>
                            <th style={{ width: 140, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tài khoản chi phí</th>
                            <th style={{ width: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Khoản mục chi phí</th>
                            <th style={{ width: 40, textAlign: "center", padding: "4px 8px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {toolAllocRows.map((row, idx) => (
                            <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                              <td style={{ textAlign: "center", color: "#64748b", padding: "4px 8px", borderRight: "1px dotted #cbd5e1" }}>{idx + 1}</td>
                              <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.target}
                                  placeholder="Bộ phận / Đối tượng"
                                  onChange={(e) => {
                                    const next = [...toolAllocRows];
                                    next[idx].target = e.target.value;
                                    setToolAllocRows(next);
                                  }}
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "right" }}>
                                <input
                                  type="number"
                                  value={row.rate}
                                  onChange={(e) => {
                                    const next = [...toolAllocRows];
                                    next[idx].rate = Number(e.target.value) || 0;
                                    setToolAllocRows(next);
                                  }}
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, textAlign: "right", background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.expenseAcc}
                                  onChange={(e) => {
                                    const next = [...toolAllocRows];
                                    next[idx].expenseAcc = e.target.value;
                                    setToolAllocRows(next);
                                  }}
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.expenseItem}
                                  placeholder="Chọn khoản mục"
                                  onChange={(e) => {
                                    const next = [...toolAllocRows];
                                    next[idx].expenseItem = e.target.value;
                                    setToolAllocRows(next);
                                  }}
                                  style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent" }}
                                />
                              </td>
                              <td style={{ textAlign: "center", padding: "2px 6px" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (toolAllocRows.length > 1) {
                                      setToolAllocRows(toolAllocRows.filter((r) => r.id !== row.id));
                                    }
                                  }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                                  title="Xóa dòng"
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

                  {/* Table Buttons */}
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (toolActiveTab === "department") {
                          setToolDeptRows([...toolDeptRows, { id: String(Date.now()), deptCode: "", deptName: "", quantity: "" }]);
                        } else {
                          setToolAllocRows([...toolAllocRows, { id: String(Date.now()), target: "", rate: 0, expenseAcc: "6422", expenseItem: "" }]);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 10px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#374151",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} color="#00a862" />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (toolActiveTab === "department") {
                          setToolDeptRows([{ id: "1", deptCode: "", deptName: "", quantity: "" }]);
                        } else {
                          setToolAllocRows([{ id: "1", target: "", rate: 100, expenseAcc: "6422", expenseItem: "" }]);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 10px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} color="#ef4444" />
                      <span>Xóa hết dòng</span>
                    </button>
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
                padding: "10px 18px",
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!toolCode) {
                    notify?.("Vui lòng nhập Mã CCDC!");
                    return;
                  }
                  notify?.(`Đã lưu CCDC ${toolCode} thành công!`);
                  setActiveModal(null);
                }}
                style={{
                  padding: "6px 22px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!toolCode) {
                    notify?.("Vui lòng nhập Mã CCDC!");
                    return;
                  }
                  notify?.(`Đã lưu CCDC ${toolCode} thành công! Mời tiếp tục khai báo.`);
                  setToolCode("");
                  setToolName("");
                }}
                style={{
                  padding: "6px 20px",
                  borderRadius: 4,
                  border: "none",
                  background: "#00a862",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Cất và thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: TÀI SẢN CỐ ĐỊNH ĐẦU KỲ (5 TABS: KHẤU HAO, PHÂN BỔ, CẤU THÀNH, PHỤ TÙNG, KHÁC) */}
      {/* ========================================================================= */}
      {activeModal === "assets" && (
        <div
          className="misa-modal-overlay"
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
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "96vw",
              maxWidth: 1260,
              maxHeight: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
            }}
          >
            {/* Modal Header */}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <RotateCcw size={12} color="#475569" />
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Khai báo tài sản cố định đầu kỳ
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: "14px 18px" }}>
              {/* Common Top Form (Row 1, 2, 3) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {/* Row 1: Số CT ghi tăng, Ngày ghi tăng, Loại tài sản */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                  <div style={{ width: 120 }}>
                    <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                      Số CT ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={assetVoucherNo}
                      onChange={(e) => setAssetVoucherNo(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        padding: "0 8px",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ width: 140 }}>
                    <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                      Ngày ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="__/__/____"
                        value={assetVoucherDate}
                        onChange={(e) => setAssetVoucherDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 28px 0 8px",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                      <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8, pointerEvents: "none" }} />
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                      Loại tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        background: "#ffffff",
                        height: 28,
                        paddingRight: 6,
                      }}
                    >
                      <select
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                        style={{
                          flex: 1,
                          border: "none",
                          background: "transparent",
                          fontSize: 13,
                          padding: "0 8px",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">Chọn loại tài sản</option>
                        {sampleAssetTypes.map((t) => (
                          <option key={t.code} value={`${t.code} - ${t.name}`}>
                            {t.code} - {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => notify?.("Thêm nhanh loại tài sản...")}
                        title="Thêm nhanh loại tài sản"
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 2,
                          color: "#00a862",
                        }}
                      >
                        <Plus size={15} />
                      </button>
                      <ChevronDown size={14} color="#64748b" style={{ pointerEvents: "none", marginLeft: 2 }} />
                    </div>
                  </div>
                </div>

                {/* Row 2: Mã tài sản, Đơn vị sử dụng */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                  <div style={{ width: 274 }}>
                    <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                      Mã tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={assetCode}
                      onChange={(e) => setAssetCode(e.target.value)}
                      placeholder="Nhập mã tài sản"
                      style={{
                        width: "100%",
                        height: 28,
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        padding: "0 8px",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                      Đơn vị sử dụng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <select
                        value={assetDepartment}
                        onChange={(e) => setAssetDepartment(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 28px 0 8px",
                          fontSize: 13,
                          background: "#ffffff",
                          outline: "none",
                          appearance: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">Chọn đơn vị sử dụng</option>
                        {sampleAssetDepartments.map((d) => (
                          <option key={d.code} value={`${d.code} - ${d.name}`}>
                            {d.code} - {d.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 8, pointerEvents: "none" }} />
                    </div>
                  </div>
                </div>

                {/* Row 3: Tên tài sản, Checkbox Không tính khấu hao */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                  <div style={{ width: 274 }}>
                    <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                      Tên tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      placeholder="Nhập tên tài sản"
                      style={{
                        width: "100%",
                        height: 28,
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        padding: "0 8px",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ flex: 1, paddingBottom: 5 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={assetNoDepreciation}
                        onChange={(e) => setAssetNoDepreciation(e.target.checked)}
                        style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#00a862" }}
                      />
                      <span>Không tính khấu hao</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Tab Navigation (5 Tabs) */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid #cbd5e1",
                  marginBottom: 14,
                  gap: 4,
                }}
              >
                {[
                  { key: "depreciation", label: "Thông tin khấu hao" },
                  { key: "allocation", label: "Thiết lập phân bổ" },
                  { key: "components", label: "Bộ phận cấu thành" },
                  { key: "accessories", label: "Dụng cụ, phụ tùng kèm theo" },
                  { key: "others", label: "Thông tin khác" },
                ].map((t) => {
                  const isActive = assetActiveTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setAssetActiveTab(t.key as any)}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? "#00a862" : "#334155",
                        borderBottom: isActive ? "2px solid #00a862" : "2px solid transparent",
                        marginBottom: -1,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: THÔNG TIN KHẤU HAO (Screenshot 1) */}
              {assetActiveTab === "depreciation" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 1fr 1.05fr 1fr 1.6fr",
                    gap: 16,
                    padding: "4px 0 10px",
                  }}
                >
                  {/* Column 1: TK & Thời gian */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        TK nguyên giá <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <select
                          value={assetCostAcc}
                          onChange={(e) => setAssetCostAcc(e.target.value)}
                          style={{
                            width: "100%",
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 24px 0 8px",
                            fontSize: 13,
                            background: "#ffffff",
                            outline: "none",
                            appearance: "none",
                          }}
                        >
                          <option value="2111">2111 - Nhà cửa, vật kiến trúc</option>
                          <option value="2112">2112 - Máy móc thiết bị</option>
                          <option value="2113">2113 - Phương tiện vận tải</option>
                          <option value="2114">2114 - Thiết bị, dụng cụ quản lý</option>
                          <option value="2118">2118 - TSCĐ khác</option>
                        </select>
                        <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        TK khấu hao <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <select
                          value={assetDeprAcc}
                          onChange={(e) => setAssetDeprAcc(e.target.value)}
                          style={{
                            width: "100%",
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 24px 0 8px",
                            fontSize: 13,
                            background: "#ffffff",
                            outline: "none",
                            appearance: "none",
                          }}
                        >
                          <option value="2141">2141 - Hao mòn TSCĐ hữu hình</option>
                          <option value="2142">2142 - Hao mòn TSCĐ thuê tài chính</option>
                          <option value="2143">2143 - Hao mòn TSCĐ vô hình</option>
                          <option value="2147">2147 - Hao mòn BĐS đầu tư</option>
                        </select>
                        <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Ngày bắt đầu tính KH <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="DD/MM/YYYY"
                          value={assetDeprStartDate}
                          onChange={(e) => setAssetDeprStartDate(e.target.value)}
                          style={{
                            width: "100%",
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 28px 0 8px",
                            fontSize: 13,
                            outline: "none",
                          }}
                        />
                        <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8, pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Thời gian sử dụng
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          value={assetUsageTime}
                          onChange={(e) => {
                            setAssetUsageTime(e.target.value);
                            const yrs = Number(e.target.value.replace(",", ".")) || 0;
                            if (yrs > 0 && !assetNoDepreciation) {
                              setAssetYearDeprRate((100 / yrs).toFixed(2).replace(".", ","));
                              setAssetMonthDeprRate((100 / (yrs * 12)).toFixed(2).replace(".", ","));
                              const c = Number(assetDeprCost) || 0;
                              const yrVal = Math.round(c / yrs);
                              setAssetYearDeprVal(yrVal.toString());
                              setAssetMonthDeprVal(Math.round(yrVal / 12).toString());
                            }
                          }}
                          style={{
                            flex: 1,
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 8px",
                            fontSize: 13,
                            textAlign: "right",
                            outline: "none",
                          }}
                        />
                        <select
                          value={assetUsageUnit}
                          onChange={(e) => setAssetUsageUnit(e.target.value)}
                          style={{
                            width: 70,
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 4px",
                            fontSize: 13,
                            background: "#ffffff",
                            outline: "none",
                          }}
                        >
                          <option value="Năm">Năm</option>
                          <option value="Tháng">Tháng</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Thời gian SD còn lại
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          value={assetRemainingTime}
                          onChange={(e) => setAssetRemainingTime(e.target.value)}
                          style={{
                            flex: 1,
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 8px",
                            fontSize: 13,
                            textAlign: "right",
                            outline: "none",
                          }}
                        />
                        <select
                          value={assetRemainingUnit}
                          onChange={(e) => setAssetRemainingUnit(e.target.value)}
                          style={{
                            width: 70,
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 4px",
                            fontSize: 13,
                            background: "#ffffff",
                            outline: "none",
                          }}
                        >
                          <option value="Năm">Năm</option>
                          <option value="Tháng">Tháng</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Nguyên giá, Giá trị tính KH, Hao mòn lũy kế */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Nguyên giá
                      </label>
                      <input
                        type="text"
                        value={assetOriginalCost}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAssetOriginalCost(val);
                          setAssetDeprCost(val);
                          const orig = Number(val) || 0;
                          const accum = Number(assetAccumDepr) || 0;
                          setAssetRemainingVal(Math.max(0, orig - accum).toString());
                        }}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 8px",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Giá trị tính khấu hao
                      </label>
                      <input
                        type="text"
                        disabled={assetNoDepreciation}
                        value={assetNoDepreciation ? "0" : assetDeprCost}
                        onChange={(e) => setAssetDeprCost(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 8px",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                          background: assetNoDepreciation ? "#f1f5f9" : "#ffffff",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Hao mòn lũy kế
                      </label>
                      <input
                        type="text"
                        value={assetAccumDepr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAssetAccumDepr(val);
                          const orig = Number(assetOriginalCost) || 0;
                          const accum = Number(val) || 0;
                          setAssetRemainingVal(Math.max(0, orig - accum).toString());
                        }}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 8px",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* Column 3: Tỷ lệ KH tháng, Giá trị KH tháng, Giá trị còn lại */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Tỷ lệ tính KH tháng (%)
                      </label>
                      <input
                        type="text"
                        disabled={assetNoDepreciation}
                        value={assetNoDepreciation ? "0,00" : assetMonthDeprRate}
                        onChange={(e) => setAssetMonthDeprRate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 8px",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                          background: assetNoDepreciation ? "#f1f5f9" : "#ffffff",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Giá trị khấu hao tháng
                      </label>
                      <input
                        type="text"
                        disabled={assetNoDepreciation}
                        value={assetNoDepreciation ? "0" : assetMonthDeprVal}
                        onChange={(e) => setAssetMonthDeprVal(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 8px",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                          background: assetNoDepreciation ? "#f1f5f9" : "#ffffff",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Giá trị còn lại
                      </label>
                      <input
                        type="text"
                        value={assetRemainingVal}
                        onChange={(e) => setAssetRemainingVal(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 8px",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* Column 4: Tỷ lệ KH năm, Giá trị KH năm */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Tỷ lệ tính KH năm (%)
                      </label>
                      <input
                        type="text"
                        disabled={assetNoDepreciation}
                        value={assetNoDepreciation ? "0,00" : assetYearDeprRate}
                        onChange={(e) => setAssetYearDeprRate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 8px",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                          background: assetNoDepreciation ? "#f1f5f9" : "#ffffff",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Giá trị khấu hao năm
                      </label>
                      <input
                        type="text"
                        disabled={assetNoDepreciation}
                        value={assetNoDepreciation ? "0" : assetYearDeprVal}
                        onChange={(e) => setAssetYearDeprVal(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          padding: "0 8px",
                          fontSize: 13,
                          textAlign: "right",
                          outline: "none",
                          background: assetNoDepreciation ? "#f1f5f9" : "#ffffff",
                        }}
                      />
                    </div>
                  </div>

                  {/* Column 5: Giới hạn luật thuế TNDN & Ghi chú */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#1e293b", cursor: "pointer", userSelect: "none", height: 20 }}>
                        <input
                          type="checkbox"
                          checked={assetTaxLimitChecked}
                          onChange={(e) => setAssetTaxLimitChecked(e.target.checked)}
                          style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#00a862" }}
                        />
                        <span>Giới hạn giá trị tính KH theo luật thuế TNDN</span>
                      </label>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>
                          Giá trị tính KH theo luật
                        </label>
                        <input
                          type="text"
                          disabled={!assetTaxLimitChecked}
                          value={assetTaxLawDeprCost}
                          onChange={(e) => setAssetTaxLawDeprCost(e.target.value)}
                          style={{
                            width: "100%",
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 8px",
                            fontSize: 13,
                            textAlign: "right",
                            outline: "none",
                            background: !assetTaxLimitChecked ? "#f8fafc" : "#ffffff",
                          }}
                        />
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>
                          Giá trị KH tháng theo luật
                        </label>
                        <input
                          type="text"
                          disabled={!assetTaxLimitChecked}
                          value={assetTaxLawMonthDeprVal}
                          onChange={(e) => setAssetTaxLawMonthDeprVal(e.target.value)}
                          style={{
                            width: "100%",
                            height: 28,
                            border: "1px solid #cbd5e1",
                            borderRadius: 3,
                            padding: "0 8px",
                            fontSize: 13,
                            textAlign: "right",
                            outline: "none",
                            background: !assetTaxLimitChecked ? "#f8fafc" : "#ffffff",
                          }}
                        />
                      </div>
                    </div>

                    {/* Info Note Callout */}
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 4 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#00a862",
                          color: "#ffffff",
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        i
                      </span>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "#475569", fontStyle: "italic" }}>
                        Nếu nhập Giá trị KH theo luật thì khi tính KH, chương trình sẽ hạch toán phần chi phí KH tương ứng với Giá trị KH theo luật vào chi phí hợp lý, phần chi phí KH vượt quá giới hạn được hạch toán vào chi phí không hợp lý.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: THIẾT LẬP PHÂN BỔ (Screenshot 2) */}
              {assetActiveTab === "allocation" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                          <th style={{ width: 40, textAlign: "center", padding: "4px 6px", borderRight: "1px dotted #94a3b8" }}>#</th>
                          <th style={{ minWidth: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Mã đối tượng</th>
                          <th style={{ minWidth: 200, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tên đối tượng</th>
                          <th style={{ width: 130, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tỷ lệ phân bổ (%)</th>
                          <th style={{ width: 120, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>TK Chi phí</th>
                          <th style={{ minWidth: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Khoản mục chi phí</th>
                          <th style={{ width: 130, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Mã thống kê</th>
                          <th style={{ width: 40, textAlign: "center", padding: "4px 6px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetAllocRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                            <td style={{ textAlign: "center", padding: "2px 6px", borderRight: "1px dotted #cbd5e1", color: "#64748b" }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                <select
                                  value={row.targetCode}
                                  onChange={(e) => {
                                    const next = [...assetAllocRows];
                                    next[idx].targetCode = e.target.value;
                                    const dept = sampleAssetDepartments.find((d) => d.code === e.target.value);
                                    if (dept) next[idx].targetName = dept.name;
                                    setAssetAllocRows(next);
                                  }}
                                  style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 20px 0 6px", fontSize: 13, background: "#ffffff", outline: "none", appearance: "none" }}
                                >
                                  <option value="">Chọn đối tượng</option>
                                  {sampleAssetDepartments.map((d) => (
                                    <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                                  ))}
                                </select>
                                <ChevronDown size={13} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                              </div>
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                              {row.targetName || ""}
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.rate}
                                onChange={(e) => {
                                  const next = [...assetAllocRows];
                                  next[idx].rate = e.target.value;
                                  setAssetAllocRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.expenseAcc}
                                onChange={(e) => {
                                  const next = [...assetAllocRows];
                                  next[idx].expenseAcc = e.target.value;
                                  setAssetAllocRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.expenseItem}
                                onChange={(e) => {
                                  const next = [...assetAllocRows];
                                  next[idx].expenseItem = e.target.value;
                                  setAssetAllocRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.statCode}
                                onChange={(e) => {
                                  const next = [...assetAllocRows];
                                  next[idx].statCode = e.target.value;
                                  setAssetAllocRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "2px 4px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (assetAllocRows.length > 1) {
                                    setAssetAllocRows(assetAllocRows.filter((_, i) => i !== idx));
                                  } else {
                                    setAssetAllocRows([{ id: "1", targetCode: "", targetName: "", rate: "0,00", expenseAcc: "", expenseItem: "", statCode: "" }]);
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
                    </table>
                  </div>

                  {/* Table Toolbar */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAssetAllocRows([
                          ...assetAllocRows,
                          { id: Date.now().toString(), targetCode: "", targetName: "", rate: "0,00", expenseAcc: "6422", expenseItem: "", statCode: "" }
                        ]);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> Thêm dòng
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssetAllocRows([{ id: "1", targetCode: "", targetName: "", rate: "0,00", expenseAcc: "", expenseItem: "", statCode: "" }])}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} /> Xóa hết dòng
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: BỘ PHẬN CẤU THÀNH (Screenshot 3) */}
              {assetActiveTab === "components" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                          <th style={{ width: 40, textAlign: "center", padding: "4px 6px", borderRight: "1px dotted #94a3b8" }}>#</th>
                          <th style={{ minWidth: 320, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Bộ phận</th>
                          <th style={{ width: 140, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Đơn vị tính</th>
                          <th style={{ width: 120, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Số lượng</th>
                          <th style={{ width: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Thời hạn bảo hành</th>
                          <th style={{ width: 40, textAlign: "center", padding: "4px 6px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetComponentRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                            <td style={{ textAlign: "center", padding: "2px 6px", borderRight: "1px dotted #cbd5e1", color: "#64748b" }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.partName}
                                onChange={(e) => {
                                  const next = [...assetComponentRows];
                                  next[idx].partName = e.target.value;
                                  setAssetComponentRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const next = [...assetComponentRows];
                                  next[idx].unit = e.target.value;
                                  setAssetComponentRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.quantity}
                                onChange={(e) => {
                                  const next = [...assetComponentRows];
                                  next[idx].quantity = e.target.value;
                                  setAssetComponentRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.warrantyPeriod}
                                onChange={(e) => {
                                  const next = [...assetComponentRows];
                                  next[idx].warrantyPeriod = e.target.value;
                                  setAssetComponentRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "2px 4px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (assetComponentRows.length > 1) {
                                    setAssetComponentRows(assetComponentRows.filter((_, i) => i !== idx));
                                  } else {
                                    setAssetComponentRows([{ id: "1", partName: "", unit: "", quantity: "1,00", warrantyPeriod: "" }]);
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
                    </table>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAssetComponentRows([
                          ...assetComponentRows,
                          { id: Date.now().toString(), partName: "", unit: "", quantity: "1,00", warrantyPeriod: "" }
                        ]);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> Thêm dòng
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssetComponentRows([{ id: "1", partName: "", unit: "", quantity: "1,00", warrantyPeriod: "" }])}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} /> Xóa hết dòng
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: DỤNG CỤ, PHỤ TÙNG KÈM THEO (Screenshot 4) */}
              {assetActiveTab === "accessories" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                          <th style={{ width: 40, textAlign: "center", padding: "4px 6px", borderRight: "1px dotted #94a3b8" }}>#</th>
                          <th style={{ minWidth: 320, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tên, quy cách dụng cụ, phụ tùng</th>
                          <th style={{ width: 140, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Đơn vị tính</th>
                          <th style={{ width: 120, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Số lượng</th>
                          <th style={{ width: 160, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Giá trị</th>
                          <th style={{ width: 40, textAlign: "center", padding: "4px 6px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetAccessoryRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                            <td style={{ textAlign: "center", padding: "2px 6px", borderRight: "1px dotted #cbd5e1", color: "#64748b" }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => {
                                  const next = [...assetAccessoryRows];
                                  next[idx].name = e.target.value;
                                  setAssetAccessoryRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const next = [...assetAccessoryRows];
                                  next[idx].unit = e.target.value;
                                  setAssetAccessoryRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.quantity}
                                onChange={(e) => {
                                  const next = [...assetAccessoryRows];
                                  next[idx].quantity = e.target.value;
                                  setAssetAccessoryRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.value}
                                onChange={(e) => {
                                  const next = [...assetAccessoryRows];
                                  next[idx].value = e.target.value;
                                  setAssetAccessoryRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "2px 4px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (assetAccessoryRows.length > 1) {
                                    setAssetAccessoryRows(assetAccessoryRows.filter((_, i) => i !== idx));
                                  } else {
                                    setAssetAccessoryRows([{ id: "1", name: "", unit: "", quantity: "1,00", value: "0" }]);
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
                    </table>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAssetAccessoryRows([
                          ...assetAccessoryRows,
                          { id: Date.now().toString(), name: "", unit: "", quantity: "1,00", value: "0" }
                        ]);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> Thêm dòng
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssetAccessoryRows([{ id: "1", name: "", unit: "", quantity: "1,00", value: "0" }])}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} /> Xóa hết dòng
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: THÔNG TIN KHÁC (Screenshot 5) */}
              {assetActiveTab === "others" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 1.2fr 1.4fr",
                    gap: 20,
                    padding: "4px 0 10px",
                  }}
                >
                  {/* Left Column: Nhà sản xuất, Năm sản xuất, Số hiệu, Nước sản xuất, Công suất */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Nhà sản xuất
                      </label>
                      <input
                        type="text"
                        value={assetManufacturer}
                        onChange={(e) => setAssetManufacturer(e.target.value)}
                        style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Năm sản xuất
                      </label>
                      <input
                        type="text"
                        value={assetManufactureYear}
                        onChange={(e) => setAssetManufactureYear(e.target.value)}
                        style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Số hiệu
                      </label>
                      <input
                        type="text"
                        value={assetModelNo}
                        onChange={(e) => setAssetModelNo(e.target.value)}
                        style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Nước sản xuất
                      </label>
                      <input
                        type="text"
                        value={assetOriginCountry}
                        onChange={(e) => setAssetOriginCountry(e.target.value)}
                        style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Công suất
                      </label>
                      <input
                        type="text"
                        value={assetCapacity}
                        onChange={(e) => setAssetCapacity(e.target.value)}
                        style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none" }}
                      />
                    </div>
                  </div>

                  {/* Middle Column: Thời hạn bảo hành, Điều kiện bảo hành, Nhà cung cấp */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Thời hạn bảo hành
                      </label>
                      <input
                        type="text"
                        value={assetWarrantyPeriod}
                        onChange={(e) => setAssetWarrantyPeriod(e.target.value)}
                        style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Điều kiện bảo hành
                      </label>
                      <textarea
                        rows={3}
                        value={assetWarrantyCondition}
                        onChange={(e) => setAssetWarrantyCondition(e.target.value)}
                        style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 3, padding: "6px 8px", fontSize: 13, outline: "none", resize: "vertical" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                        Nhà cung cấp
                      </label>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          background: "#ffffff",
                          height: 28,
                          paddingRight: 6,
                        }}
                      >
                        <select
                          value={assetSupplier}
                          onChange={(e) => setAssetSupplier(e.target.value)}
                          style={{
                            flex: 1,
                            border: "none",
                            background: "transparent",
                            fontSize: 13,
                            padding: "0 8px",
                            outline: "none",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">Chọn nhà cung cấp</option>
                          {sampleAssetSuppliers.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.code} - {s.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => notify?.("Thêm nhanh nhà cung cấp...")}
                          title="Thêm nhanh nhà cung cấp"
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 2,
                            color: "#00a862",
                          }}
                        >
                          <Plus size={15} />
                        </button>
                        <ChevronDown size={14} color="#64748b" style={{ pointerEvents: "none", marginLeft: 2 }} />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: BB giao nhận, Tình trạng, Chất lượng, Đính kèm */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                          BB giao nhận số
                        </label>
                        <input
                          type="text"
                          value={assetHandoverVoucherNo}
                          onChange={(e) => setAssetHandoverVoucherNo(e.target.value)}
                          style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none" }}
                        />
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                          Ngày
                        </label>
                        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                          <input
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={assetHandoverDate}
                            onChange={(e) => setAssetHandoverDate(e.target.value)}
                            style={{
                              width: "100%",
                              height: 28,
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              padding: "0 28px 0 8px",
                              fontSize: 13,
                              outline: "none",
                            }}
                          />
                          <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8, pointerEvents: "none" }} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                          Tình trạng ghi tăng
                        </label>
                        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                          <select
                            value={assetConditionStatus}
                            onChange={(e) => setAssetConditionStatus(e.target.value)}
                            style={{
                              width: "100%",
                              height: 28,
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              padding: "0 24px 0 8px",
                              fontSize: 13,
                              background: "#ffffff",
                              outline: "none",
                              appearance: "none",
                            }}
                          >
                            <option value="Mới">Mới</option>
                            <option value="Đã qua sử dụng">Đã qua sử dụng</option>
                            <option value="Điều chuyển">Điều chuyển</option>
                          </select>
                          <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 12.5, color: "#1e293b", marginBottom: 3 }}>
                          Chất lượng hiện thời
                        </label>
                        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                          <select
                            value={assetCurrentQuality}
                            onChange={(e) => setAssetCurrentQuality(e.target.value)}
                            style={{
                              width: "100%",
                              height: 28,
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              padding: "0 24px 0 8px",
                              fontSize: 13,
                              background: "#ffffff",
                              outline: "none",
                              appearance: "none",
                            }}
                          >
                            <option value="Hoạt động tốt">Hoạt động tốt</option>
                            <option value="Bình thường">Bình thường</option>
                            <option value="Cần sửa chữa">Cần sửa chữa</option>
                          </select>
                          <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                        </div>
                      </div>
                    </div>

                    {/* File Attachment Dropzone */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "#1e293b", fontWeight: 500 }}>
                          <Paperclip size={13} color="#64748b" /> Đính kèm
                        </span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                      </div>
                      <div
                        onClick={() => notify?.("Mở hộp thoại chọn tệp đính kèm...")}
                        style={{
                          border: "1px dashed #cbd5e1",
                          borderRadius: 4,
                          background: "#f8fafc",
                          padding: "16px 12px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          cursor: "pointer",
                          transition: "border-color 0.2s",
                        }}
                      >
                        <Upload size={20} color="#64748b" />
                        <div style={{ fontSize: 12.5, color: "#64748b", textAlign: "center" }}>
                          <span style={{ color: "#00a862", fontWeight: 600 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "10px 18px",
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  padding: "6px 20px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!assetCode) {
                    notify?.("Vui lòng nhập Mã tài sản!");
                    return;
                  }
                  notify?.(`Đã lưu tài sản cố định ${assetCode} - ${assetName} thành công!`);
                  setActiveModal(null);
                }}
                style={{
                  padding: "6px 20px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!assetCode) {
                    notify?.("Vui lòng nhập Mã tài sản!");
                    return;
                  }
                  notify?.(`Đã lưu tài sản cố định ${assetCode} thành công! Mời tiếp tục khai báo.`);
                  setAssetCode("");
                  setAssetName("");
                }}
                style={{
                  padding: "6px 22px",
                  borderRadius: 4,
                  border: "none",
                  background: "#00a862",
                  fontSize: 13,
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

      {/* ========================================================================= */}
      {/* MODAL 9: CHI PHÍ DỞ DANG (4 FORMATS: THCP, CÔNG TRÌNH, ĐƠN HÀNG, HỢP ĐỒNG) */}
      {/* ========================================================================= */}
      {activeModal === "wip" && (
        <div
          className="misa-modal-overlay"
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
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "96vw",
              maxWidth: 1280,
              maxHeight: "92vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
            }}
          >
            {/* Modal Header */}
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                {wipSubtab === "Công trình"
                  ? "Khai báo chi phí lũy kế phát sinh cho công trình kỳ trước"
                  : wipSubtab === "Đơn hàng"
                  ? "Khai báo chi phí lũy kế phát sinh cho đơn hàng kỳ trước"
                  : wipSubtab === "Hợp đồng"
                  ? "Khai báo chi phí lũy kế phát sinh cho hợp đồng kỳ trước"
                  : "Khai báo chi phí dở dang đầu kỳ cho đối tượng tập hợp kỳ trước"}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: "14px 18px" }}>
              {/* Top Toggle Switch */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div
                  onClick={() => setWipDetailByCostElement(!wipDetailByCostElement)}
                  style={{
                    width: 32,
                    height: 18,
                    borderRadius: 10,
                    background: wipDetailByCostElement ? "#00a862" : "#cbd5e1",
                    position: "relative",
                    transition: "background 0.2s",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "#ffffff",
                      position: "absolute",
                      top: 2,
                      left: wipDetailByCostElement ? 16 : 2,
                      transition: "left 0.2s",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    }}
                  />
                </div>
                <span
                  onClick={() => setWipDetailByCostElement(!wipDetailByCostElement)}
                  style={{ fontSize: 13, color: "#374151", cursor: "pointer", userSelect: "none" }}
                >
                  Nhập chi tiết theo các yếu tố chi phí
                </span>
              </div>

              {/* Data Table per Subtab Format */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflowX: "auto", width: "100%" }}>
                {/* ========================================================================= */}
                {/* FORMAT 1: ĐỐI TƯỢNG TẬP HỢP CHI PHÍ (Screenshot 1)                       */}
                {/* ========================================================================= */}
                {wipSubtab === "Đối tượng tập hợp chi phí" && (
                  <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 150, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Mã đối tượng THCP</th>
                        <th style={{ minWidth: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tên đối tượng THCP</th>
                        <th style={{ width: 160, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Loại đối tượng THCP</th>
                        <th style={{ width: 160, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Quy trình sản xuất</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>NVL trực tiếp</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Nhân công trực tiếp</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Chi phí chung</th>
                        <th style={{ width: 40, textAlign: "center", padding: "4px 8px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wipThcpRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                              <select
                                value={row.code}
                                onChange={(e) => {
                                  const selected = sampleThcpOptions.find((o) => o.code === e.target.value);
                                  const next = [...wipThcpRows];
                                  next[idx].code = e.target.value;
                                  if (selected) {
                                    next[idx].name = selected.name;
                                    next[idx].type = selected.type;
                                    next[idx].process = selected.process;
                                  }
                                  setWipThcpRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 20px 0 6px", fontSize: 13, background: "#ffffff", outline: "none", appearance: "none", cursor: "pointer" }}
                              >
                                <option value="">Chọn đối tượng THCP</option>
                                {sampleThcpOptions.map((opt) => (
                                  <option key={opt.code} value={opt.code}>{opt.code} - {opt.name}</option>
                                ))}
                              </select>
                              <ChevronDown size={13} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                            </div>
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.name || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.type || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.process || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.rawMaterial}
                              onChange={(e) => {
                                const next = [...wipThcpRows];
                                next[idx].rawMaterial = Number(e.target.value) || 0;
                                setWipThcpRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.labor}
                              onChange={(e) => {
                                const next = [...wipThcpRows];
                                next[idx].labor = Number(e.target.value) || 0;
                                setWipThcpRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.general}
                              onChange={(e) => {
                                const next = [...wipThcpRows];
                                next[idx].general = Number(e.target.value) || 0;
                                setWipThcpRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ textAlign: "center", padding: "2px 6px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (wipThcpRows.length > 1) {
                                  setWipThcpRows(wipThcpRows.filter((r) => r.id !== row.id));
                                }
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                              title="Xóa dòng"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Summary row */}
                      <tr style={{ background: "#ffffff", fontWeight: 700, borderTop: "1px solid #cbd5e1", height: 32 }}>
                        <td style={{ padding: "6px 10px", borderRight: "1px dotted #cbd5e1" }}>Tổng</td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipThcpRows.reduce((sum, r) => sum + (Number(r.rawMaterial) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipThcpRows.reduce((sum, r) => sum + (Number(r.labor) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipThcpRows.reduce((sum, r) => sum + (Number(r.general) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* ========================================================================= */}
                {/* FORMAT 2: CÔNG TRÌNH (Screenshot 2)                                      */}
                {/* ========================================================================= */}
                {wipSubtab === "Công trình" && (
                  <table style={{ width: "100%", minWidth: 1200, borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 140, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Mã công trình</th>
                        <th style={{ minWidth: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tên công trình</th>
                        <th style={{ width: 140, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Loại công trình</th>
                        <th style={{ width: 110, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>NVL trực tiếp</th>
                        <th style={{ width: 110, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Nhân công trực tiếp</th>
                        <th style={{ width: 110, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Máy thi công</th>
                        <th style={{ width: 110, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Chi phí chung</th>
                        <th style={{ width: 110, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tổng chi phí</th>
                        <th style={{ width: 110, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Số đã nghiệm thu</th>
                        <th style={{ width: 40, textAlign: "center", padding: "4px 8px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wipProjectRows.map((row, idx) => {
                        const rowTotal = (Number(row.rawMaterial) || 0) + (Number(row.labor) || 0) + (Number(row.machinery) || 0) + (Number(row.general) || 0);
                        return (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                <select
                                  value={row.code}
                                  onChange={(e) => {
                                    const selected = sampleProjectOptions.find((o) => o.code === e.target.value);
                                    const next = [...wipProjectRows];
                                    next[idx].code = e.target.value;
                                    if (selected) {
                                      next[idx].name = selected.name;
                                      next[idx].type = selected.type;
                                    }
                                    setWipProjectRows(next);
                                  }}
                                  style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 20px 0 6px", fontSize: 13, background: "#ffffff", outline: "none", appearance: "none", cursor: "pointer" }}
                                >
                                  <option value="">Chọn công trình</option>
                                  {sampleProjectOptions.map((opt) => (
                                    <option key={opt.code} value={opt.code}>{opt.code} - {opt.name}</option>
                                  ))}
                                </select>
                                <ChevronDown size={13} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                              </div>
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                              {row.name || ""}
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                              {row.type || ""}
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="number"
                                value={row.rawMaterial}
                                onChange={(e) => {
                                  const next = [...wipProjectRows];
                                  next[idx].rawMaterial = Number(e.target.value) || 0;
                                  setWipProjectRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="number"
                                value={row.labor}
                                onChange={(e) => {
                                  const next = [...wipProjectRows];
                                  next[idx].labor = Number(e.target.value) || 0;
                                  setWipProjectRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="number"
                                value={row.machinery}
                                onChange={(e) => {
                                  const next = [...wipProjectRows];
                                  next[idx].machinery = Number(e.target.value) || 0;
                                  setWipProjectRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="number"
                                value={row.general}
                                onChange={(e) => {
                                  const next = [...wipProjectRows];
                                  next[idx].general = Number(e.target.value) || 0;
                                  setWipProjectRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="number"
                                value={rowTotal}
                                readOnly
                                style={{ width: "100%", height: 26, border: "1px solid #e2e8f0", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, background: "#f8fafc", outline: "none", fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                              <input
                                type="number"
                                value={row.accepted}
                                onChange={(e) => {
                                  const next = [...wipProjectRows];
                                  next[idx].accepted = Number(e.target.value) || 0;
                                  setWipProjectRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "2px 6px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (wipProjectRows.length > 1) {
                                    setWipProjectRows(wipProjectRows.filter((r) => r.id !== row.id));
                                  }
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                                title="Xóa dòng"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Summary row */}
                      <tr style={{ background: "#ffffff", fontWeight: 700, borderTop: "1px solid #cbd5e1", height: 32 }}>
                        <td style={{ padding: "6px 10px", borderRight: "1px dotted #cbd5e1" }}>Tổng</td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipProjectRows.reduce((sum, r) => sum + (Number(r.rawMaterial) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipProjectRows.reduce((sum, r) => sum + (Number(r.labor) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipProjectRows.reduce((sum, r) => sum + (Number(r.machinery) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipProjectRows.reduce((sum, r) => sum + (Number(r.general) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipProjectRows.reduce((sum, r) => sum + (Number(r.rawMaterial) || 0) + (Number(r.labor) || 0) + (Number(r.machinery) || 0) + (Number(r.general) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipProjectRows.reduce((sum, r) => sum + (Number(r.accepted) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* ========================================================================= */}
                {/* FORMAT 3: ĐƠN HÀNG (Screenshot 3)                                        */}
                {/* ========================================================================= */}
                {wipSubtab === "Đơn hàng" && (
                  <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 140, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Số đơn hàng</th>
                        <th style={{ width: 130, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Ngày đơn hàng</th>
                        <th style={{ minWidth: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Diễn giải</th>
                        <th style={{ minWidth: 200, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Khách hàng</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>NVL trực tiếp</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Nhân công trực tiếp</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Chi phí chung</th>
                        <th style={{ width: 40, textAlign: "center", padding: "4px 8px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wipOrderRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                              <select
                                value={row.code}
                                onChange={(e) => {
                                  const selected = sampleOrderOptions.find((o) => o.code === e.target.value);
                                  const next = [...wipOrderRows];
                                  next[idx].code = e.target.value;
                                  if (selected) {
                                    next[idx].date = selected.date;
                                    next[idx].desc = selected.desc;
                                    next[idx].customer = selected.customer;
                                  }
                                  setWipOrderRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 20px 0 6px", fontSize: 13, background: "#ffffff", outline: "none", appearance: "none", cursor: "pointer" }}
                              >
                                <option value="">Chọn đơn hàng</option>
                                {sampleOrderOptions.map((opt) => (
                                  <option key={opt.code} value={opt.code}>{opt.code}</option>
                                ))}
                              </select>
                              <ChevronDown size={13} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                            </div>
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.date || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.desc || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.customer || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.rawMaterial}
                              onChange={(e) => {
                                const next = [...wipOrderRows];
                                next[idx].rawMaterial = Number(e.target.value) || 0;
                                setWipOrderRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.labor}
                              onChange={(e) => {
                                const next = [...wipOrderRows];
                                next[idx].labor = Number(e.target.value) || 0;
                                setWipOrderRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.general}
                              onChange={(e) => {
                                const next = [...wipOrderRows];
                                next[idx].general = Number(e.target.value) || 0;
                                setWipOrderRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ textAlign: "center", padding: "2px 6px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (wipOrderRows.length > 1) {
                                  setWipOrderRows(wipOrderRows.filter((r) => r.id !== row.id));
                                }
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                              title="Xóa dòng"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Summary row */}
                      <tr style={{ background: "#ffffff", fontWeight: 700, borderTop: "1px solid #cbd5e1", height: 32 }}>
                        <td style={{ padding: "6px 10px", borderRight: "1px dotted #cbd5e1" }}>Tổng</td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipOrderRows.reduce((sum, r) => sum + (Number(r.rawMaterial) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipOrderRows.reduce((sum, r) => sum + (Number(r.labor) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipOrderRows.reduce((sum, r) => sum + (Number(r.general) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* ========================================================================= */}
                {/* FORMAT 4: HỢP ĐỒNG (Screenshot 4)                                        */}
                {/* ========================================================================= */}
                {wipSubtab === "Hợp đồng" && (
                  <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#d6e4dc", height: 32, textAlign: "left", color: "#1e293b", fontWeight: 600, fontSize: 12.5, borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 140, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Số hợp đồng</th>
                        <th style={{ width: 130, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Ngày hợp đồng</th>
                        <th style={{ minWidth: 180, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Tên hợp đồng</th>
                        <th style={{ minWidth: 200, padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Khách hàng</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>NVL trực tiếp</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Nhân công trực tiếp</th>
                        <th style={{ width: 140, textAlign: "right", padding: "4px 10px", borderRight: "1px dotted #94a3b8" }}>Chi phí chung</th>
                        <th style={{ width: 40, textAlign: "center", padding: "4px 8px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wipContractRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32, background: "#ffffff" }}>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                              <select
                                value={row.code}
                                onChange={(e) => {
                                  const selected = sampleContractOptions.find((o) => o.code === e.target.value);
                                  const next = [...wipContractRows];
                                  next[idx].code = e.target.value;
                                  if (selected) {
                                    next[idx].date = selected.date;
                                    next[idx].name = selected.name;
                                    next[idx].customer = selected.customer;
                                  }
                                  setWipContractRows(next);
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 20px 0 6px", fontSize: 13, background: "#ffffff", outline: "none", appearance: "none", cursor: "pointer" }}
                              >
                                <option value="">Chọn hợp đồng</option>
                                {sampleContractOptions.map((opt) => (
                                  <option key={opt.code} value={opt.code}>{opt.code}</option>
                                ))}
                              </select>
                              <ChevronDown size={13} color="#64748b" style={{ position: "absolute", right: 6, pointerEvents: "none" }} />
                            </div>
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.date || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.name || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1", color: "#334155" }}>
                            {row.customer || ""}
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.rawMaterial}
                              onChange={(e) => {
                                const next = [...wipContractRows];
                                next[idx].rawMaterial = Number(e.target.value) || 0;
                                setWipContractRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.labor}
                              onChange={(e) => {
                                const next = [...wipContractRows];
                                next[idx].labor = Number(e.target.value) || 0;
                                setWipContractRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ padding: "2px 8px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="number"
                              value={row.general}
                              onChange={(e) => {
                                const next = [...wipContractRows];
                                next[idx].general = Number(e.target.value) || 0;
                                setWipContractRows(next);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", textAlign: "right", fontSize: 13, outline: "none" }}
                            />
                          </td>
                          <td style={{ textAlign: "center", padding: "2px 6px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (wipContractRows.length > 1) {
                                  setWipContractRows(wipContractRows.filter((r) => r.id !== row.id));
                                }
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}
                              title="Xóa dòng"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Summary row */}
                      <tr style={{ background: "#ffffff", fontWeight: 700, borderTop: "1px solid #cbd5e1", height: 32 }}>
                        <td style={{ padding: "6px 10px", borderRight: "1px dotted #cbd5e1" }}>Tổng</td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px dotted #cbd5e1" }}></td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipContractRows.reduce((sum, r) => sum + (Number(r.rawMaterial) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipContractRows.reduce((sum, r) => sum + (Number(r.labor) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px dotted #cbd5e1" }}>
                          {wipContractRows.reduce((sum, r) => sum + (Number(r.general) || 0), 0).toLocaleString("vi-VN")}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Table Action Buttons & Pagination */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    Tổng số:{" "}
                    <strong style={{ color: "#0f172a" }}>
                      {wipSubtab === "Công trình"
                        ? wipProjectRows.length
                        : wipSubtab === "Đơn hàng"
                        ? wipOrderRows.length
                        : wipSubtab === "Hợp đồng"
                        ? wipContractRows.length
                        : wipThcpRows.length}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (wipSubtab === "Công trình") {
                        setWipProjectRows([...wipProjectRows, { id: String(Date.now()), code: "", name: "", type: "", rawMaterial: 0, labor: 0, machinery: 0, general: 0, total: 0, accepted: 0 }]);
                      } else if (wipSubtab === "Đơn hàng") {
                        setWipOrderRows([...wipOrderRows, { id: String(Date.now()), code: "", date: "", desc: "", customer: "", rawMaterial: 0, labor: 0, general: 0 }]);
                      } else if (wipSubtab === "Hợp đồng") {
                        setWipContractRows([...wipContractRows, { id: String(Date.now()), code: "", date: "", name: "", customer: "", rawMaterial: 0, labor: 0, general: 0 }]);
                      } else {
                        setWipThcpRows([...wipThcpRows, { id: String(Date.now()), code: "", name: "", type: "", process: "", rawMaterial: 0, labor: 0, general: 0 }]);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12.5,
                      color: "#374151",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} color="#00a862" />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (wipSubtab === "Công trình") {
                        setWipProjectRows([{ id: "1", code: "", name: "", type: "", rawMaterial: 0, labor: 0, machinery: 0, general: 0, total: 0, accepted: 0 }]);
                      } else if (wipSubtab === "Đơn hàng") {
                        setWipOrderRows([{ id: "1", code: "", date: "", desc: "", customer: "", rawMaterial: 0, labor: 0, general: 0 }]);
                      } else if (wipSubtab === "Hợp đồng") {
                        setWipContractRows([{ id: "1", code: "", date: "", name: "", customer: "", rawMaterial: 0, labor: 0, general: 0 }]);
                      } else {
                        setWipThcpRows([{ id: "1", code: "", name: "", type: "", process: "", rawMaterial: 0, labor: 0, general: 0 }]);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12.5,
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
                  <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                    <select
                      defaultValue="20"
                      style={{
                        padding: "2px 20px 2px 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        background: "#ffffff",
                        fontSize: 12.5,
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                      }}
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                    <ChevronDown size={13} color="#64748b" style={{ position: "absolute", right: 4, pointerEvents: "none" }} />
                  </div>
                  <span style={{ cursor: "pointer", padding: "0 4px", color: "#94a3b8" }}>|&lt;</span>
                  <span style={{ cursor: "pointer", padding: "0 4px", color: "#94a3b8" }}>&lt;</span>
                  <span style={{ fontWeight: 700, color: "#00a862", padding: "0 6px" }}>1</span>
                  <span style={{ cursor: "pointer", padding: "0 4px", color: "#94a3b8" }}>&gt;</span>
                  <span style={{ cursor: "pointer", padding: "0 4px", color: "#94a3b8" }}>&gt;|</span>
                </div>
              </div>

              {/* Scrollbar placeholder line */}
              <div style={{ height: 6, background: "#cbd5e1", borderRadius: 3, marginTop: 14, opacity: 0.6 }} />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "10px 18px",
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  padding: "6px 20px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify?.(`Đã lưu chi phí dở dang đầu kỳ (${wipSubtab}) thành công!`);
                  setActiveModal(null);
                }}
                style={{
                  padding: "6px 24px",
                  borderRadius: 4,
                  border: "none",
                  background: "#00a862",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ffffff",
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
      {/* MODAL 10: CHI PHÍ TRẢ TRƯỚC ĐẦU KỲ                                        */}
      {/* ========================================================================= */}
      {activeModal === "prepaid" && (
        <div className="misa-opening-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="misa-opening-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Khai báo chi phí trả trước đầu kỳ</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setActiveModal(null)} />
              </div>
            </div>
            <div className="misa-opening-modal-body">
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Mã chi phí trả trước *</label>
                  <input type="text" className="misa-opening-input" defaultValue="CPTT-01" />
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Tên chi phí trả trước *</label>
                  <input type="text" className="misa-opening-input" defaultValue="Tiền thuê văn phòng năm 2026" />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số tiền *</label>
                  <input type="number" className="misa-opening-input" defaultValue={120000000} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số kỳ phân bổ (Tháng)</label>
                  <input type="number" className="misa-opening-input" defaultValue={12} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Chi phí trả trước", false)}>Cất và Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
