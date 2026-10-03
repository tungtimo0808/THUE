import { useState, useId } from "react";
import {
  Search,
  RotateCw,
  Plus,
  SlidersHorizontal,
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  HelpCircle,
  ExternalLink,
  Sparkles,
  Play,
  Lightbulb,
  Tags,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  X,
  FileText,
  FilePlus,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FolderPlus,
  Target,
  ShieldCheck,
  PackageMinus,
  Receipt,
  PackagePlus,
  CalendarDays,
  Calculator,
  RefreshCw,
  Eye,
  Trash2,
  Boxes,
  Network,
  Wrench,
  Box,
  Image as ImageIcon,
  Pencil,
  Paperclip,
  Maximize2,
  Settings,
  Star,
  CheckSquare,
  Square,
} from "lucide-react";
import "./misa-cash.css";

export type MisaCostWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

// ============================================================================
// TYPES & MOCK DATA
// ============================================================================
type CostMethod =
  | "simple"
  | "coefficient"
  | "step"
  | "projects"
  | "orders"
  | "contracts";

interface CostPeriodRecord {
  id: string;
  code: string;
  name: string;
  method: string;
  fromDate: string;
  toDate: string;
  targetObject: string;
  openingWip: number;
  incurredCost: number;
  endingWip: number;
  totalFinishedCost: number;
  status: "completed" | "in_progress" | "draft";
}

const INITIAL_COST_PERIODS: Record<string, CostPeriodRecord[]> = {
  "continuous-simple": [
    {
      id: "GT-2026-01",
      code: "GT-01/2026",
      name: "Tính giá thành T01/2026 - Xưởng Cơ khí chế tạo",
      method: "Sản xuất liên tục - Giản đơn",
      fromDate: "01/01/2026",
      toDate: "31/01/2026",
      targetObject: "Xưởng cơ khí - Bàn ghế inox cao cấp",
      openingWip: 18500000,
      incurredCost: 142500000,
      endingWip: 12000000,
      totalFinishedCost: 149000000,
      status: "completed",
    },
    {
      id: "GT-2026-02",
      code: "GT-02/2026",
      name: "Tính giá thành T02/2026 - Xưởng May xuất khẩu",
      method: "Sản xuất liên tục - Giản đơn",
      fromDate: "01/02/2026",
      toDate: "28/02/2026",
      targetObject: "Dây chuyền May 01 - Áo Polo nam",
      openingWip: 25000000,
      incurredCost: 210800000,
      endingWip: 19500000,
      totalFinishedCost: 216300000,
      status: "completed",
    },
    {
      id: "GT-2026-03",
      code: "GT-03/2026",
      name: "Tính giá thành T03/2026 - Xưởng Nhựa công nghiệp",
      method: "Sản xuất liên tục - Giản đơn",
      fromDate: "01/03/2026",
      toDate: "31/03/2026",
      targetObject: "Tổ ép nhựa - Khay linh kiện điện tử",
      openingWip: 8200000,
      incurredCost: 89400000,
      endingWip: 6500000,
      totalFinishedCost: 91100000,
      status: "in_progress",
    },
  ],
  "continuous-coefficient": [
    {
      id: "HS-2026-01",
      code: "HS-01/2026",
      name: "Tính giá thành Hệ số T01/2026 - Phân xưởng Đúc",
      method: "Sản xuất liên tục - Hệ số, tỷ lệ",
      fromDate: "01/01/2026",
      toDate: "31/01/2026",
      targetObject: "Nhóm sản phẩm Ống gang đúc phi 60, 90, 110",
      openingWip: 34000000,
      incurredCost: 312000000,
      endingWip: 28000000,
      totalFinishedCost: 318000000,
      status: "completed",
    },
  ],
  "continuous-step": [
    {
      id: "PB-2026-01",
      code: "PB-01/2026",
      name: "Tính giá thành Phân bước T01/2026 - Sản xuất sợi - dệt - nhuộm",
      method: "Sản xuất liên tục - Phân bước",
      fromDate: "01/01/2026",
      toDate: "31/01/2026",
      targetObject: "Giai đoạn 1 (Kéo sợi) sang Giai đoạn 2 (Dệt)",
      openingWip: 45000000,
      incurredCost: 480000000,
      endingWip: 39000000,
      totalFinishedCost: 486000000,
      status: "completed",
    },
  ],
  projects: [
    {
      id: "CT-2026-01",
      code: "CT-01/2026",
      name: "Tính giá thành Công trình Tòa nhà Văn phòng TechPark",
      method: "Theo công trình",
      fromDate: "01/01/2026",
      toDate: "31/03/2026",
      targetObject: "Công trình TechPark Tower - Hạng mục Cơ điện M&E",
      openingWip: 120000000,
      incurredCost: 850000000,
      endingWip: 310000000,
      totalFinishedCost: 660000000,
      status: "completed",
    },
  ],
  orders: [
    {
      id: "DH-2026-01",
      code: "DH-01/2026",
      name: "Tính giá thành Đơn hàng DH-2026-0089 (Công ty Samy Electronics)",
      method: "Theo đơn hàng",
      fromDate: "10/01/2026",
      toDate: "25/01/2026",
      targetObject: "Đơn hàng gia công 5.000 vỏ bảo vệ nhôm CNC",
      openingWip: 0,
      incurredCost: 95000000,
      endingWip: 0,
      totalFinishedCost: 95000000,
      status: "completed",
    },
  ],
  contracts: [
    {
      id: "HD-2026-01",
      code: "HD-01/2026",
      name: "Tính giá thành Hợp đồng HĐ-KT-2026/012 (Tập đoàn Hòa An)",
      method: "Theo hợp đồng",
      fromDate: "01/01/2026",
      toDate: "28/02/2026",
      targetObject: "Hợp đồng cung cấp & lắp đặt hệ thống lọc khí công nghiệp",
      openingWip: 65000000,
      incurredCost: 410000000,
      endingWip: 85000000,
      totalFinishedCost: 390000000,
      status: "completed",
    },
  ],
};

type CostProcessStep = {
  step: number;
  title: string;
  icon: any;
  desc: string;
};

type CostProcessSubtabConfig = {
  label: string;
  headerTitle: string;
  videoTopLabel: string;
  videoMainTitle: string;
  videoSubtitle?: string;
  videoBg: string;
  hasUtilitiesBottom: boolean;
  row1: CostProcessStep[];
  row2: CostProcessStep[];
};

const COST_PROCESS_DATA: Record<CostMethod, CostProcessSubtabConfig> = {
  simple: {
    label: "Giản đơn",
    headerTitle: "Các bước tính giá thành sản xuất liên tục - Giản đơn",
    videoTopLabel: "[AMIS Kế toán] Hướng dẫn",
    videoMainTitle: "TÍNH GIÁ THÀNH GIẢN ĐƠN",
    videoSubtitle: "THÔNG TƯ 200",
    videoBg: "linear-gradient(135deg, #09203f 0%, #537895 100%)",
    hasUtilitiesBottom: true,
    row1: [
      { step: 1, title: "1. Khai báo NVL và thành phẩm", icon: FolderPlus, desc: "Khai báo định mức nguyên vật liệu và danh mục thành phẩm sản xuất" },
      { step: 2, title: "2. Khai báo đối tượng tập hợp chi phí", icon: Target, desc: "Thiết lập phân xưởng, tổ đội, dây chuyền hoặc sản phẩm tập hợp chi phí" },
      { step: 3, title: "3. Khai báo chi phí dở dang đầu kỳ", icon: ShieldCheck, desc: "Nhập số dư chi phí dở dang đầu kỳ theo từng khoản mục chi phí" },
      { step: 4, title: "4. Xuất kho NVL sản xuất", icon: PackageMinus, desc: "Lập chứng từ xuất kho nguyên vật liệu dùng cho sản xuất (Nợ 621 / Có 152)" },
      { step: 5, title: "5. Hạch toán chi phí phát sinh", icon: Receipt, desc: "Hạch toán chi phí nhân công trực tiếp (622) và chi phí SXC (627)" },
    ],
    row2: [
      { step: 6, title: "6. Nhập kho thành phẩm sản xuất", icon: PackagePlus, desc: "Lập phiếu nhập kho thành phẩm hoàn thành từ sản xuất (Nợ 155 / Có 154)" },
      { step: 7, title: "7. Xác định kỳ tính giá thành", icon: CalendarDays, desc: "Chọn khoảng thời gian và các đối tượng tập hợp chi phí cần tính giá thành" },
      { step: 8, title: "8. Tính giá thành thành phẩm", icon: Calculator, desc: "Phân bổ chi phí, đánh giá dở dang cuối kỳ và xác định tổng giá thành" },
      { step: 9, title: "9. Kết chuyển chi phí", icon: RefreshCw, desc: "Tự động lập chứng từ kết chuyển chi phí sản xuất sang TK 154 và 632" },
    ],
  },
  coefficient: {
    label: "Hệ số, Tỷ lệ",
    headerTitle: "Các bước tính giá thành sản xuất liên tục - Hệ số tỷ lệ",
    videoTopLabel: "[AMIS Kế toán] Hướng dẫn",
    videoMainTitle: "TÍNH GIÁ THÀNH HỆ SỐ - TỶ LỆ",
    videoSubtitle: "THÔNG TƯ 200",
    videoBg: "linear-gradient(135deg, #09203f 0%, #537895 100%)",
    hasUtilitiesBottom: true,
    row1: [
      { step: 1, title: "1. Khai báo NVL và thành phẩm", icon: FolderPlus, desc: "Khai báo định mức nguyên vật liệu và danh mục thành phẩm sản xuất" },
      { step: 2, title: "2. Khai báo đối tượng tập hợp chi phí", icon: Target, desc: "Thiết lập phân xưởng, tổ đội, dây chuyền hoặc nhóm sản phẩm tính giá" },
      { step: 3, title: "3. Khai báo chi phí dở dang đầu kỳ", icon: ShieldCheck, desc: "Nhập số dư chi phí dở dang đầu kỳ cho từng đối tượng THCP" },
      { step: 4, title: "4. Xuất kho NVL sản xuất", icon: PackageMinus, desc: "Lập phiếu xuất kho NVL sản xuất cho nhóm sản phẩm" },
      { step: 5, title: "5. Hạch toán chi phí phát sinh", icon: Receipt, desc: "Hạch toán chi phí nhân công trực tiếp (622) và chi phí SXC (627)" },
    ],
    row2: [
      { step: 6, title: "6. Nhập kho thành phẩm sản xuất", icon: PackagePlus, desc: "Lập phiếu nhập kho các quy cách thành phẩm sản xuất" },
      { step: 7, title: "7. Xác định kỳ tính giá thành", icon: CalendarDays, desc: "Chọn kỳ tính giá thành theo hệ số, tỷ lệ" },
      { step: 8, title: "8. Khai báo giá thành định mức/kế hoạch", icon: Boxes, desc: "Thiết lập hệ số quy đổi hoặc giá thành kế hoạch/định mức cho từng quy cách sản phẩm" },
      { step: 9, title: "9. Tính giá thành thành phẩm", icon: Calculator, desc: "Quy đổi sản lượng về sản phẩm chuẩn và tính giá thành cho từng quy cách" },
      { step: 10, title: "10. Kết chuyển chi phí", icon: RefreshCw, desc: "Tự động kết chuyển chi phí sản xuất sang TK 154 và 632" },
    ],
  },
  step: {
    label: "Phân bước",
    headerTitle: "Các bước tính giá thành sản xuất liên tục - Phân bước",
    videoTopLabel: "[AMIS Kế toán] Tính giá thành",
    videoMainTitle: "PHƯƠNG PHÁP PHÂN BƯỚC LIÊN TỤC",
    videoSubtitle: "PHẦN MỀM KẾ TOÁN ONLINE MISA AMIS",
    videoBg: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 50%, #dc2626 100%)",
    hasUtilitiesBottom: true,
    row1: [
      { step: 1, title: "1. Khai báo NVL và thành phẩm", icon: FolderPlus, desc: "Khai báo nguyên vật liệu, bán thành phẩm và thành phẩm cuối cùng" },
      { step: 2, title: "2. Khai báo đối tượng tập hợp chi phí", icon: Target, desc: "Khai báo các giai đoạn (bước/công đoạn) sản xuất trong quy trình liên tục" },
      { step: 3, title: "3. Khai báo chi phí dở dang đầu kỳ", icon: ShieldCheck, desc: "Nhập số dư dở dang đầu kỳ theo từng công đoạn sản xuất" },
      { step: 4, title: "4. Xuất kho NVL sản xuất", icon: PackageMinus, desc: "Xuất kho nguyên vật liệu trực tiếp cho từng công đoạn" },
      { step: 5, title: "5. Hạch toán chi phí phát sinh", icon: Receipt, desc: "Hạch toán chi phí nhân công và chi phí SXC phát sinh tại từng bước" },
    ],
    row2: [
      { step: 6, title: "6. Xác định kỳ tính giá thành", icon: CalendarDays, desc: "Chọn kỳ tính giá thành phân bước liên tục" },
      { step: 7, title: "7. Điều chuyển công đoạn", icon: Boxes, desc: "Lập chứng từ điều chuyển nửa thành phẩm từ bước trước sang bước sau" },
      { step: 8, title: "8. Phân bổ chi phí chung về công đoạn", icon: Network, desc: "Phân bổ chi phí sản xuất chung của toàn xưởng về từng công đoạn" },
      { step: 9, title: "9. Tính giá thành công đoạn", icon: Calculator, desc: "Tính giá thành nửa thành phẩm từng bước và giá thành thành phẩm bước cuối" },
      { step: 10, title: "10. Kết chuyển chi phí", icon: RefreshCw, desc: "Lập chứng từ kết chuyển chi phí từng công đoạn" },
    ],
  },
  projects: {
    label: "Công trình",
    headerTitle: "Các bước tính giá thành - Công trình",
    videoTopLabel: "[AMIS Kế toán] Hướng dẫn",
    videoMainTitle: "CÔNG TRÌNH VỤ VIỆC - DỊCH VỤ",
    videoSubtitle: "THÔNG TƯ 200",
    videoBg: "linear-gradient(135deg, #09203f 0%, #1e3a8a 50%, #0369a1 100%)",
    hasUtilitiesBottom: true,
    row1: [
      { step: 1, title: "1. Khai báo nguyên vật liệu", icon: FolderPlus, desc: "Khai báo danh mục vật tư, thiết bị dùng cho công trình" },
      { step: 2, title: "2. Khai báo công trình/hạng mục", icon: Wrench, desc: "Khai báo mã công trình, dự án, gói thầu và các hạng mục thi công" },
      { step: 3, title: "3. Khai báo chi phí dở dang đầu kỳ", icon: ShieldCheck, desc: "Nhập chi phí dở dang đầu kỳ theo từng công trình/hạng mục" },
      { step: 4, title: "4. Xuất kho NVL sản xuất", icon: PackageMinus, desc: "Xuất kho vật tư trực tiếp cho công trình thi công" },
      { step: 5, title: "5. Hạch toán chi phí phát sinh", icon: Receipt, desc: "Hạch toán chi phí nhân công, máy thi công và chi phí quản lý công trường" },
    ],
    row2: [
      { step: 6, title: "6. Xác định kỳ tính giá thành", icon: CalendarDays, desc: "Chọn kỳ tính giá thành công trình hoặc theo giai đoạn nghiệm thu" },
      { step: 7, title: "7. Phân bổ chi phí chung", icon: Network, desc: "Phân bổ chi phí máy thi công và chi phí chung cho các công trình" },
      { step: 8, title: "8. Kết chuyển chi phí", icon: RefreshCw, desc: "Kết chuyển chi phí công trình sang TK 154" },
      { step: 9, title: "9. Nghiệm thu công trình", icon: Target, desc: "Lập biên bản nghiệm thu công trình/hạng mục hoàn thành (Nợ 632 / Có 154)" },
    ],
  },
  orders: {
    label: "Đơn hàng",
    headerTitle: "Các bước tính giá thành - Đơn hàng",
    videoTopLabel: "[AMIS Kế toán] Hướng dẫn Tính giá thành",
    videoMainTitle: "ĐƠN ĐẶT HÀNG",
    videoSubtitle: "THÔNG TƯ 200",
    videoBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    hasUtilitiesBottom: false,
    row1: [
      { step: 1, title: "1. Khai báo nguyên vật liệu", icon: FolderPlus, desc: "Khai báo nguyên vật liệu phục vụ sản xuất theo đơn hàng" },
      { step: 2, title: "2. Khai báo đơn hàng", icon: Boxes, desc: "Khai báo đơn đặt hàng của khách hàng kèm các sản phẩm yêu cầu" },
      { step: 3, title: "3. Khai báo chi phí dở dang đầu kỳ", icon: ShieldCheck, desc: "Nhập chi phí dở dang đầu kỳ của các đơn hàng chưa hoàn thành" },
      { step: 4, title: "4. Xuất kho NVL sản xuất", icon: PackageMinus, desc: "Xuất kho NVL chỉ định trực tiếp cho từng đơn hàng" },
      { step: 5, title: "5. Hạch toán chi phí phát sinh", icon: Receipt, desc: "Hạch toán chi phí nhân công và chi phí SXC cho đơn hàng" },
    ],
    row2: [
      { step: 6, title: "6. Xác định kỳ tính giá thành", icon: CalendarDays, desc: "Chọn kỳ tính giá thành cho các đơn hàng hoàn thành" },
      { step: 7, title: "7. Phân bổ chi phí chung", icon: Network, desc: "Phân bổ chi phí dùng chung cho các đơn hàng trong kỳ" },
      { step: 8, title: "8. Kết chuyển chi phí", icon: RefreshCw, desc: "Kết chuyển chi phí sản xuất theo đơn hàng sang TK 154" },
      { step: 9, title: "9. Nghiệm thu đơn hàng", icon: Target, desc: "Nghiệm thu đơn hàng hoàn thành, giao hàng và ghi nhận giá vốn (Nợ 632 / Có 154)" },
    ],
  },
  contracts: {
    label: "Hợp đồng",
    headerTitle: "Các bước tính giá thành - Hợp đồng",
    videoTopLabel: "[AMIS Kế toán] Hướng dẫn Tính giá thành",
    videoMainTitle: "HỢP ĐỒNG",
    videoSubtitle: "THÔNG TƯ 200",
    videoBg: "linear-gradient(135deg, #09203f 0%, #1e3a8a 100%)",
    hasUtilitiesBottom: false,
    row1: [
      { step: 1, title: "1. Khai báo nguyên vật liệu", icon: FolderPlus, desc: "Khai báo nguyên vật liệu theo dự toán hợp đồng kinh tế" },
      { step: 2, title: "2. Khai báo hợp đồng", icon: FilePlus, desc: "Khai báo hợp đồng bán/dịch vụ ký với khách hàng" },
      { step: 3, title: "3. Khai báo chi phí dở dang đầu kỳ", icon: ShieldCheck, desc: "Nhập chi phí dở dang của hợp đồng dở dang kỳ trước" },
      { step: 4, title: "4. Xuất kho NVL sản xuất", icon: PackageMinus, desc: "Xuất kho NVL thi công/thực hiện theo hợp đồng" },
      { step: 5, title: "5. Hạch toán chi phí phát sinh", icon: Receipt, desc: "Hạch toán chi phí trực tiếp và gián tiếp của hợp đồng" },
    ],
    row2: [
      { step: 6, title: "6. Xác định kỳ tính giá thành", icon: CalendarDays, desc: "Chọn kỳ nghiệm thu và tính giá thành hợp đồng" },
      { step: 7, title: "7. Phân bổ chi phí chung", icon: Network, desc: "Phân bổ chi phí chung theo giá trị hợp đồng" },
      { step: 8, title: "8. Kết chuyển chi phí", icon: RefreshCw, desc: "Kết chuyển chi phí hợp đồng sang TK 154" },
      { step: 9, title: "9. Nghiệm thu hợp đồng", icon: Target, desc: "Nghiệm thu thanh lý hợp đồng và ghi nhận giá vốn (Nợ 632 / Có 154)" },
    ],
  },
};

export default function MisaCostWorkspace({
  period = "2026",
  tab = "process",
  notify,
}: MisaCostWorkspaceProps) {
  const arrowMarkerId = useId();
  // State for process tab
  const [subtab, setSubtab] = useState<CostMethod>("simple");
  const [guideTab, setGuideTab] = useState<"guide" | "report">("guide");

  // Filter state for calculation tabs
  const [periodFilter, setPeriodFilter] = useState("Năm nay");
  const [fromDate, setFromDate] = useState("01/01/2026");
  const [toDate, setToDate] = useState("31/12/2026");
  const [searchText, setSearchText] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Modals state
  const [activeStepModal, setActiveStepModal] = useState<number | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [costItemsModalOpen, setCostItemsModalOpen] = useState(false);
  const [utilitiesModalOpen, setUtilitiesModalOpen] = useState(false);
  const [avaModalOpen, setAvaModalOpen] = useState(false);
  const [methodsModalOpen, setMethodsModalOpen] = useState(false);
  const [addPeriodModalOpen, setAddPeriodModalOpen] = useState(false);
  const [costCardModalRecord, setCostCardModalRecord] =
    useState<CostPeriodRecord | null>(null);

  // Step 1 Dropdown & Item Drawer (Nguyên vật liệu & Thành phẩm)
  const [step1MenuOpen, setStep1MenuOpen] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [itemDrawerType, setItemDrawerType] = useState<"material" | "product">("material");

  // Drawer Form State
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("VT00001");
  const [itemGroup, setItemGroup] = useState("NVL");
  const [unit, setUnit] = useState("");
  const [taxReduction, setTaxReduction] = useState("Chưa xác định");
  const [warrantyPeriod, setWarrantyPeriod] = useState(0);
  const [warrantyUnit, setWarrantyUnit] = useState("Tháng");
  const [minStock, setMinStock] = useState("0,00");
  const [origin, setOrigin] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [buyDesc, setBuyDesc] = useState("");
  const [saleDesc, setSaleDesc] = useState("");
  const [specialProductType, setSpecialProductType] = useState("");

  // Drawer Accordions
  const [accDefaultInfo, setAccDefaultInfo] = useState(true);
  const [accDiscount, setAccDiscount] = useState(false);
  const [accConversion, setAccConversion] = useState(false);
  const [accFormula, setAccFormula] = useState(false);

  // Step 5 Popover & Modals state (Hạch toán chi phí phát sinh)
  const [step5MenuOpen, setStep5MenuOpen] = useState(false);
  const [depreciationModalOpen, setDepreciationModalOpen] = useState(false);
  const [toolAllocModalOpen, setToolAllocModalOpen] = useState(false);
  const [prepaidAllocModalOpen, setPrepaidAllocModalOpen] = useState(false);
  const [payrollAllocModalOpen, setPayrollAllocModalOpen] = useState(false);
  const [otherExpenseModalOpen, setOtherExpenseModalOpen] = useState(false);

  // Common allocation month/year
  const [allocMonth, setAllocMonth] = useState(10);
  const [allocYear, setAllocYear] = useState(2026);
  const [selectedPayrollSheet, setSelectedPayrollSheet] = useState(
    "Bảng lương Tháng 10/2026 - Phân xưởng sản xuất"
  );

  // Other expense voucher state (Chứng từ nghiệp vụ khác NVK00001)
  const [voucherNumber, setVoucherNumber] = useState("NVK00001");
  const [voucherDesc, setVoucherDesc] = useState("Chi phí dịch vụ mua ngoài phục vụ phân xưởng sản xuất");
  const [voucherPostingDate, setVoucherPostingDate] = useState("01/10/2026");
  const [voucherDocDate, setVoucherDocDate] = useState("01/10/2026");
  const [voucherDueDate, setVoucherDueDate] = useState("");
  const [voucherTab, setVoucherTab] = useState<"posting" | "tax">("posting");
  const [voucherLines, setVoucherLines] = useState([
    {
      id: 1,
      desc: "Chi phí điện năng phân xưởng sản xuất Tháng 10/2026",
      debitAccount: "6277",
      creditAccount: "331",
      amount: 18500000,
      bizType: "Chi phí SXC",
      debitObj: "PX-CK",
      debitObjName: "Phân xưởng Cơ khí",
      creditObj: "EVN-HN",
      creditObjName: "Công ty Điện lực Hà Nội",
    },
    {
      id: 2,
      desc: "Chi phí bảo trì, sửa chữa máy dập CNC",
      debitAccount: "6273",
      creditAccount: "1121",
      amount: 6200000,
      bizType: "Chi phí SXC",
      debitObj: "PX-CK",
      debitObjName: "Phân xưởng Cơ khí",
      creditObj: "TECH-SERV",
      creditObjName: "Công ty Kỹ thuật Thiết bị",
    },
  ]);

  // Wizard state inside "Thêm kỳ tính giá thành"
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    code: `GT-${new Date().getMonth() + 1}/2026`,
    name: `Kỳ tính giá thành Tháng ${new Date().getMonth() + 1}/2026`,
    method: "Giản đơn",
    fromDate: "01/03/2026",
    toDate: "31/03/2026",
    costObject: "Xưởng Cơ khí - Bàn ghế inox cao cấp",
    directMaterial: 110000000,
    directLabor: 32000000,
    generalCost: 18500000,
    allocationMethod: "Theo chi phí NVL trực tiếp",
    endingWipMethod: "Theo chi phí NVL trực tiếp",
    finishedQty: 500,
  });

  // ============================================================================
  // SẢN XUẤT LIÊN TỤC - GIẢN ĐƠN STATE (MATCHES USER SCREENSHOTS 1, 2, 3)
  // ============================================================================
  const [simpleSubtab, setSimpleSubtab] = useState<"period" | "transfer">("period");
  const [guideBannerDismissed, setGuideBannerDismissed] = useState(false);
  const [showPeriodList, setShowPeriodList] = useState(false);
  const [showTransferList, setShowTransferList] = useState(false);
  const [addSimplePeriodModalOpen, setAddSimplePeriodModalOpen] = useState(false);
  const [selectPeriodModalOpen, setSelectPeriodModalOpen] = useState(false);
  const [utilitiesMenuOpen, setUtilitiesMenuOpen] = useState(false);
  const [pickCostObjModalOpen, setPickCostObjModalOpen] = useState(false);

  // Modals for the 4 items in Tiện ích of "Sản xuất liên tục - Hệ số, tỷ lệ"
  const [wipOpeningModalOpen, setWipOpeningModalOpen] = useState(false);
  const [normCostModalOpen, setNormCostModalOpen] = useState(false);
  const [normAllocModalOpen, setNormAllocModalOpen] = useState(false);
  const [plannedCostModalOpen, setPlannedCostModalOpen] = useState(false);

  // Cost periods for continuous-simple / continuous-coefficient (starts empty to match screenshot 1)
  const [simplePeriods, setSimplePeriods] = useState<CostPeriodRecord[]>([]);

  // Form state for Modal "Thêm kỳ tính giá thành" (Screenshot 2)
  const [simplePeriodType, setSimplePeriodType] = useState("Tháng này");
  const [simpleFromDate, setSimpleFromDate] = useState("01/10/2026");
  const [simpleToDate, setSimpleToDate] = useState("31/10/2026");
  const [simplePeriodName, setSimplePeriodName] = useState(
    "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"
  );
  const [costObjSearch, setCostObjSearch] = useState("");
  const [selectedCostObjects, setSelectedCostObjects] = useState<
    Array<{ code: string; name: string; type: string }>
  >([]);

  // Transfer state for Modal "Chọn kỳ tính giá thành" (Screenshot 3)
  const [transferPeriodDropdownOpen, setTransferPeriodDropdownOpen] = useState(true);
  const [selectedTransferPeriod, setSelectedTransferPeriod] = useState<string>("");
  const [transferVouchers, setTransferVouchers] = useState<
    Array<{
      id: string;
      docDate: string;
      postDate: string;
      docNo: string;
      desc: string;
      debitAcc: string;
      creditAcc: string;
      amount: number;
      targetObj: string;
    }>
  >([]);

  // Handler for changing period preset in "Thêm kỳ tính giá thành"
  const handleSimplePeriodPresetChange = (preset: string) => {
    setSimplePeriodType(preset);
    let from = "01/10/2026";
    let to = "31/10/2026";
    if (preset === "Hôm nay") {
      from = "01/10/2026";
      to = "01/10/2026";
    } else if (preset === "Tuần này") {
      from = "28/09/2026";
      to = "04/10/2026";
    } else if (preset === "Tháng này") {
      from = "01/10/2026";
      to = "31/10/2026";
    } else if (preset === "Tháng trước") {
      from = "01/09/2026";
      to = "30/09/2026";
    } else if (preset === "Quý này" || preset === "Quý 4") {
      from = "01/10/2026";
      to = "31/12/2026";
    } else if (preset === "Quý 3") {
      from = "01/07/2026";
      to = "30/09/2026";
    } else if (preset === "Năm nay") {
      from = "01/01/2026";
      to = "31/12/2026";
    }
    setSimpleFromDate(from);
    setSimpleToDate(to);
    setSimplePeriodName(`Kỳ tính giá thành từ ngày ${from} đến ngày ${to}`);
  };

  // Helper to fetch cost objects into table
  const handleFetchCostObjects = () => {
    setSelectedCostObjects([
      { code: "PX-CK", name: "Phân xưởng Cơ khí", type: "Phân xưởng" },
      { code: "PX-MAY", name: "Phân xưởng May", type: "Phân xưởng" },
      { code: "PX-DONGGOI", name: "Phân xưởng Đóng gói", type: "Phân xưởng" },
    ]);
    notify("Đã lấy dữ liệu đối tượng tập hợp chi phí phát sinh trong kỳ!");
  };

  // Helper to save period
  const handleSaveSimplePeriod = () => {
    if (!simplePeriodName.trim()) {
      notify("Vui lòng nhập tên kỳ tính giá thành!");
      return;
    }
    const newPeriod: CostPeriodRecord = {
      id: `GT-${Date.now()}`,
      code: `GT-10/2026`,
      name: simplePeriodName,
      method: "Sản xuất liên tục - Giản đơn",
      fromDate: simpleFromDate,
      toDate: simpleToDate,
      targetObject:
        selectedCostObjects.length > 0
          ? selectedCostObjects.map((o) => o.name).join(", ")
          : "Phân xưởng Cơ khí",
      openingWip: 18500000,
      incurredCost: 142500000,
      endingWip: 12000000,
      totalFinishedCost: 149000000,
      status: "in_progress",
    };
    setSimplePeriods((prev) => [newPeriod, ...prev]);
    setSelectedTransferPeriod(simplePeriodName);
    notify(`Đã cất kỳ tính giá thành "${simplePeriodName}" thành công!`);
    setAddSimplePeriodModalOpen(false);
  };

  // Helper to confirm transfer
  const handleConfirmTransfer = () => {
    if (!selectedTransferPeriod) {
      notify("Vui lòng chọn kỳ tính giá thành!");
      return;
    }
    const newVoucher = {
      id: `KC-${Date.now()}`,
      docDate: simpleToDate,
      postDate: simpleToDate,
      docNo: `PKC${String(transferVouchers.length + 1).padStart(5, "0")}`,
      desc: `Kết chuyển chi phí sản xuất ${selectedTransferPeriod}`,
      debitAcc: "154",
      creditAcc: "621, 622, 627",
      amount: 142500000,
      targetObj:
        selectedCostObjects.length > 0
          ? selectedCostObjects.map((o) => o.name).join(", ")
          : "Phân xưởng Cơ khí, Phân xưởng May",
    };
    setTransferVouchers((prev) => [newVoucher, ...prev]);
    notify(`Đã tạo chứng từ kết chuyển chi phí cho "${selectedTransferPeriod}" thành công!`);
    setSelectPeriodModalOpen(false);
    setShowTransferList(true);
  };

  // ============================================================================
  // CONTINUOUS-STEP (SẢN XUẤT LIÊN TỤC - PHÂN BƯỚC) STATE & HANDLERS
  // ============================================================================
  const [stepSubtab, setStepSubtab] = useState<
    "period" | "quantity" | "transfer_stage" | "alloc_general" | "transfer_cost"
  >("period");
  const [showStepPeriodList, setShowStepPeriodList] = useState(false);
  const [showStepTransferList, setShowStepTransferList] = useState(false);
  const [addStepPeriodModalOpen, setAddStepPeriodModalOpen] = useState(false);
  const [stepUtilitiesMenuOpen, setStepUtilitiesMenuOpen] = useState(false);
  const [pickStepProcessModalOpen, setPickStepProcessModalOpen] = useState(false);
  const [stepProcessModalOpen, setStepProcessModalOpen] = useState(false);
  const [selectStepPeriodModalOpen, setSelectStepPeriodModalOpen] = useState(false);

  // State for Subtab "Thống kê số lượng TP/BTP" (Screenshots 1, 2)
  const [showStepQtyList, setShowStepQtyList] = useState(false);
  const [selectQtyPeriodModalOpen, setSelectQtyPeriodModalOpen] = useState(false);
  const [selectedQtyPeriod, setSelectedQtyPeriod] = useState<string>("");
  const [selectedQtyProcess, setSelectedQtyProcess] = useState<string>("");
  const [qtyPeriodDropdownOpen, setQtyPeriodDropdownOpen] = useState(false);
  const [qtyProcessDropdownOpen, setQtyProcessDropdownOpen] = useState(false);

  // State for Subtab "Chuyển công đoạn" (Screenshots 1, 2)
  const [showStepStageTransferList, setShowStepStageTransferList] = useState(false);
  const [selectStageTransferPeriodModalOpen, setSelectStageTransferPeriodModalOpen] = useState(false);
  const [selectedStageTransferPeriod, setSelectedStageTransferPeriod] = useState<string>("");
  const [selectedStageTransferProcess, setSelectedStageTransferProcess] = useState<string>("");
  const [stageTransferPeriodDropdownOpen, setStageTransferPeriodDropdownOpen] = useState(false);
  const [stageTransferProcessDropdownOpen, setStageTransferProcessDropdownOpen] = useState(false);

  // State for Subtab "Phân bổ chi phí chung về công đoạn" (Screenshots 3, 4)
  const [showStepAllocGeneralList, setShowStepAllocGeneralList] = useState(false);
  const [selectAllocGeneralPeriodModalOpen, setSelectAllocGeneralPeriodModalOpen] = useState(false);
  const [selectedAllocGeneralPeriod, setSelectedAllocGeneralPeriod] = useState<string>("");
  const [selectedAllocGeneralProcess, setSelectedAllocGeneralProcess] = useState<string>("");
  const [allocGeneralPeriodDropdownOpen, setAllocGeneralPeriodDropdownOpen] = useState(false);
  const [allocGeneralProcessDropdownOpen, setAllocGeneralProcessDropdownOpen] = useState(false);

  // ============================================================================
  // CÔNG TRÌNH (PROJECTS) STATE & HANDLERS
  // ============================================================================
  const [projectSubtab, setProjectSubtab] = useState<
    "period" | "transfer" | "acceptance" | "norm" | "estimate"
  >("period");
  const [showProjectPeriodList, setShowProjectPeriodList] = useState(false);
  const [showProjectTransferList, setShowProjectTransferList] = useState(false);
  const [showProjectAcceptanceList, setShowProjectAcceptanceList] = useState(false);
  const [showProjectNormList, setShowProjectNormList] = useState(false);
  const [showProjectEstimateList, setShowProjectEstimateList] = useState(false);

  const [addProjectPeriodModalOpen, setAddProjectPeriodModalOpen] = useState(false);
  const [selectProjectTransferPeriodModalOpen, setSelectProjectTransferPeriodModalOpen] = useState(false);
  const [projectAcceptanceModalOpen, setProjectAcceptanceModalOpen] = useState(false);
  const [addProjectNormModalOpen, setAddProjectNormModalOpen] = useState(false);

  const [projectPeriodType, setProjectPeriodType] = useState("Tháng này");
  const [projectFromDate, setProjectFromDate] = useState("01/10/2026");
  const [projectToDate, setProjectToDate] = useState("31/10/2026");
  const [projectPeriodName, setProjectPeriodName] = useState(
    "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"
  );
  const [selectedProjectTransferPeriod, setSelectedProjectTransferPeriod] = useState("");
  const [projectTransferPeriodDropdownOpen, setProjectTransferPeriodDropdownOpen] = useState(false);
  const [selectedProjectAcceptancePeriod, setSelectedProjectAcceptancePeriod] = useState("");
  const [projectAcceptancePeriodDropdownOpen, setProjectAcceptancePeriodDropdownOpen] = useState(false);

  // ============================================================================
  // ĐƠN HÀNG (ORDERS) STATE & HANDLERS
  // ============================================================================
  const [orderSubtab, setOrderSubtab] = useState<
    "period" | "transfer" | "acceptance"
  >("period");
  const [showOrderPeriodList, setShowOrderPeriodList] = useState(false);
  const [showOrderTransferList, setShowOrderTransferList] = useState(false);
  const [showOrderAcceptanceList, setShowOrderAcceptanceList] = useState(false);

  const [addOrderPeriodModalOpen, setAddOrderPeriodModalOpen] = useState(false);
  const [selectOrderTransferPeriodModalOpen, setSelectOrderTransferPeriodModalOpen] = useState(false);
  const [orderAcceptanceModalOpen, setOrderAcceptanceModalOpen] = useState(false);

  const [orderPeriodType, setOrderPeriodType] = useState("Tháng này");
  const [orderFromDate, setOrderFromDate] = useState("01/10/2026");
  const [orderToDate, setOrderToDate] = useState("31/10/2026");
  const [orderPeriodName, setOrderPeriodName] = useState(
    "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"
  );
  const [selectedOrderTransferPeriod, setSelectedOrderTransferPeriod] = useState("");
  const [orderTransferPeriodDropdownOpen, setOrderTransferPeriodDropdownOpen] = useState(false);
  const [selectedOrderAcceptancePeriod, setSelectedOrderAcceptancePeriod] = useState("");
  const [orderAcceptancePeriodDropdownOpen, setOrderAcceptancePeriodDropdownOpen] = useState(false);

  // ============================================================================
  // HỢP ĐỒNG (CONTRACTS) STATE & HANDLERS
  // ============================================================================
  const [contractSubtab, setContractSubtab] = useState<
    "period" | "transfer" | "acceptance"
  >("period");
  const [showContractPeriodList, setShowContractPeriodList] = useState(false);
  const [showContractTransferList, setShowContractTransferList] = useState(false);
  const [showContractAcceptanceList, setShowContractAcceptanceList] = useState(false);

  const [addContractPeriodModalOpen, setAddContractPeriodModalOpen] = useState(false);
  const [selectContractTransferPeriodModalOpen, setSelectContractTransferPeriodModalOpen] = useState(false);
  const [contractAcceptanceModalOpen, setContractAcceptanceModalOpen] = useState(false);

  const [contractPeriodType, setContractPeriodType] = useState("Tháng này");
  const [contractFromDate, setContractFromDate] = useState("01/10/2026");
  const [contractToDate, setContractToDate] = useState("31/10/2026");
  const [contractPeriodName, setContractPeriodName] = useState(
    "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"
  );
  const [selectedContractTransferPeriod, setSelectedContractTransferPeriod] = useState("");
  const [contractTransferPeriodDropdownOpen, setContractTransferPeriodDropdownOpen] = useState(false);
  const [selectedContractAcceptancePeriod, setSelectedContractAcceptancePeriod] = useState("");
  const [contractAcceptancePeriodDropdownOpen, setContractAcceptancePeriodDropdownOpen] = useState(false);

  // ============================================================================
  // BÁO CÁO (REPORTS) STATE
  // ============================================================================
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportLanguage, setReportLanguage] = useState("Tiếng Việt");
  const [reportSectionsOpen, setReportSectionsOpen] = useState<Record<string, boolean>>({
    continuous: true,
    projects: false,
    orders: false,
    contracts: false,
    reconciliation: false,
  });
  const [favoriteReportList, setFavoriteReportList] = useState<string[]>([
    "S36-DN: Sổ chi phí sản xuất, kinh doanh",
    "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí",
  ]);

  const [showProjectBanner, setShowProjectBanner] = useState(true);
  const [projectUtilityDropdownOpen, setProjectUtilityDropdownOpen] = useState(false);
  const [orderUtilityDropdownOpen, setOrderUtilityDropdownOpen] = useState(false);
  const [contractUtilityDropdownOpen, setContractUtilityDropdownOpen] = useState(false);

  const [projectModalItems, setProjectModalItems] = useState<Array<{ code: string; name: string; type: string }>>([
    { code: "CT-SKYTOWER", name: "Tòa nhà Sky Tower Discovery Complex", type: "Dân dụng cao tầng" },
    { code: "CT-VIN-OCEAN", name: "Khu đô thị Vinhomes Ocean Park phân khu 2", type: "Hạ tầng đô thị" },
    { code: "CT-CAU-NHATHAN", name: "Cầu vượt cạn Nhật Tân kéo dài", type: "Cầu đường bộ" },
  ]);
  const [projectModalSearch, setProjectModalSearch] = useState("");

  const [orderModalItems, setOrderModalItems] = useState<Array<{ code: string; date: string; customer: string }>>([
    { code: "DH2026-0089", date: "05/10/2026", customer: "Công ty TNHH Á Châu" },
    { code: "DH2026-0092", date: "12/10/2026", customer: "Tập đoàn Hòa Bình" },
    { code: "DH2026-0105", date: "18/10/2026", customer: "Công ty CP Đầu tư Nam Long" },
  ]);
  const [orderModalSearch, setOrderModalSearch] = useState("");

  const [contractModalItems, setContractModalItems] = useState<Array<{ code: string; date: string; note: string; customer: string }>>([
    { code: "HD-2026/042", date: "02/10/2026", note: "Thi công nội thất trụ sở Techcom", customer: "Ngân hàng TMCP Kỹ Thương" },
    { code: "HD-2026/045", date: "10/10/2026", note: "Cung cấp thiết bị cơ điện nhà máy Vina", customer: "Công ty CP Quốc tế Vina" },
  ]);
  const [contractModalSearch, setContractModalSearch] = useState("");

  const [projectNormLines, setProjectNormLines] = useState<
    Array<{ id: number; code: string; name: string; unit: string; qty: number; price: number; amount: number }>
  >([
    { id: 1, code: "XI-MANG-HA-TIEN", name: "Xi măng Hà Tiên PCB40", unit: "Bao", qty: 100, price: 95000, amount: 9500000 },
    { id: 2, code: "CAT-VANG-SAY", name: "Cát vàng sàng lọc", unit: "m3", qty: 25, price: 320000, amount: 8000000 },
    { id: 3, code: "THEP-HOA-PHAT-D10", name: "Thép cuộn Hòa Phát D10", unit: "Kg", qty: 500, price: 16500, amount: 8250000 },
  ]);
  const [selectedProjectForNorm, setSelectedProjectForNorm] = useState("CT-SKYTOWER - Tòa nhà Sky Tower Discovery Complex");
  const [projectNormFromDate, setProjectNormFromDate] = useState("01/10/2026");
  const [projectNormToDate, setProjectNormToDate] = useState("31/12/2026");
  const [projectNormDesc, setProjectNormDesc] = useState("Định mức nguyên vật liệu xây tô mác 100 công trình Sky Tower");

  const [selectedAcceptanceProjects, setSelectedAcceptanceProjects] = useState<string[]>([
    "CT-SKYTOWER",
    "CT-CAU-NHATHAN",
  ]);
  const [acceptanceProjectSearch, setAcceptanceProjectSearch] = useState("");

  const [selectedAcceptanceOrders, setSelectedAcceptanceOrders] = useState<string[]>([
    "DH2026-0089",
  ]);
  const [acceptanceOrderSearch, setAcceptanceOrderSearch] = useState("");

  const [selectedAcceptanceContracts, setSelectedAcceptanceContracts] = useState<string[]>([
    "HD-2026/042",
  ]);
  const [acceptanceContractSearch, setAcceptanceContractSearch] = useState("");

  // Form state for Modal "Thêm kỳ tính giá thành" (Screenshot 2)
  const [stepPeriodType, setStepPeriodType] = useState("Tháng này");
  const [stepFromDate, setStepFromDate] = useState("01/10/2026");
  const [stepToDate, setStepToDate] = useState("31/10/2026");
  const [stepPeriodName, setStepPeriodName] = useState(
    "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"
  );
  const [stepProcessSearch, setStepProcessSearch] = useState("");
  const [selectedProcesses, setSelectedProcesses] = useState<
    Array<{ code: string; name: string }>
  >([]);

  // Period list for continuous-step (starts empty to match screenshot 1)
  const [stepPeriods, setStepPeriods] = useState<CostPeriodRecord[]>([]);

  // Transfer vouchers for continuous-step
  const [stepTransferPeriodDropdownOpen, setStepTransferPeriodDropdownOpen] = useState(true);
  const [selectedStepTransferPeriod, setSelectedStepTransferPeriod] = useState<string>("");
  const [stepTransferVouchers, setStepTransferVouchers] = useState<
    Array<{
      id: string;
      docDate: string;
      postDate: string;
      docNo: string;
      desc: string;
      debitAcc: string;
      creditAcc: string;
      amount: number;
      processName: string;
    }>
  >([]);

  // Handler for changing period preset in "Thêm kỳ tính giá thành" (Phân bước)
  const handleStepPeriodPresetChange = (preset: string) => {
    setStepPeriodType(preset);
    let from = "01/10/2026";
    let to = "31/10/2026";
    if (preset === "Hôm nay") {
      from = "01/10/2026";
      to = "01/10/2026";
    } else if (preset === "Tuần này") {
      from = "28/09/2026";
      to = "04/10/2026";
    } else if (preset === "Tháng này") {
      from = "01/10/2026";
      to = "31/10/2026";
    } else if (preset === "Tháng trước") {
      from = "01/09/2026";
      to = "30/09/2026";
    } else if (preset === "Quý này" || preset === "Quý 4") {
      from = "01/10/2026";
      to = "31/12/2026";
    } else if (preset === "Quý 3") {
      from = "01/07/2026";
      to = "30/09/2026";
    } else if (preset === "Năm nay") {
      from = "01/01/2026";
      to = "31/12/2026";
    }
    setStepFromDate(from);
    setStepToDate(to);
    setStepPeriodName(`Kỳ tính giá thành từ ngày ${from} đến ngày ${to}`);
  };

  // Helper to fetch sample production processes
  const handleFetchStepProcesses = () => {
    setSelectedProcesses([
      { code: "QT-SOI-DET", name: "Quy trình sản xuất Sợi - Dệt - Nhuộm (3 công đoạn)" },
      { code: "QT-CO-KHI", name: "Quy trình gia công Cơ khí chính xác (Cắt phôi -> Phay CNC -> Hoàn thiện)" },
    ]);
    notify("Đã lấy dữ liệu quy trình sản xuất phát sinh trong kỳ!");
  };

  // Helper to save step period
  const handleSaveStepPeriod = () => {
    if (!stepPeriodName.trim()) {
      notify("Vui lòng nhập tên kỳ tính giá thành!");
      return;
    }
    const newPeriod: CostPeriodRecord = {
      id: `PB-${Date.now()}`,
      code: `PB-10/2026`,
      name: stepPeriodName,
      method: "Sản xuất liên tục - Phân bước",
      fromDate: stepFromDate,
      toDate: stepToDate,
      targetObject:
        selectedProcesses.length > 0
          ? selectedProcesses.map((p) => p.name).join(", ")
          : "Quy trình sản xuất Sợi - Dệt - Nhuộm",
      openingWip: 45000000,
      incurredCost: 480000000,
      endingWip: 39000000,
      totalFinishedCost: 486000000,
      status: "in_progress",
    };
    setStepPeriods((prev) => [newPeriod, ...prev]);
    setSelectedStepTransferPeriod(stepPeriodName);
    notify(`Đã cất kỳ tính giá thành "${stepPeriodName}" thành công!`);
    setAddStepPeriodModalOpen(false);
  };

  // Helper to confirm step transfer
  const handleConfirmStepTransfer = () => {
    if (!selectedStepTransferPeriod) {
      notify("Vui lòng chọn kỳ tính giá thành!");
      return;
    }
    const newVoucher = {
      id: `KC-PB-${Date.now()}`,
      docDate: stepToDate,
      postDate: stepToDate,
      docNo: `PKCPB${String(stepTransferVouchers.length + 1).padStart(4, "0")}`,
      desc: `Kết chuyển chi phí sản xuất phân bước ${selectedStepTransferPeriod}`,
      debitAcc: "154",
      creditAcc: "621, 622, 627",
      amount: 480000000,
      processName:
        selectedProcesses.length > 0
          ? selectedProcesses.map((p) => p.name).join(", ")
          : "Quy trình sản xuất Sợi - Dệt - Nhuộm",
    };
    setStepTransferVouchers((prev) => [newVoucher, ...prev]);
    notify(`Đã tạo chứng từ kết chuyển chi phí phân bước cho "${selectedStepTransferPeriod}" thành công!`);
    setSelectStepPeriodModalOpen(false);
    setShowStepTransferList(true);
  };

  // Helper to confirm selection of period & process for quantity subtab
  const handleConfirmSelectQtyPeriod = () => {
    const period = selectedQtyPeriod || "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026";
    const process = selectedQtyProcess || "QT-SOI-DET - Quy trình sản xuất Sợi - Dệt - Nhuộm";
    setSelectedQtyPeriod(period);
    setSelectedQtyProcess(process);
    notify(`Đã chọn "${period}" - "${process}" thành công!`);
    setSelectQtyPeriodModalOpen(false);
    setShowStepQtyList(true);
  };

  // Helper to confirm selection of period & process for stage transfer subtab (Screenshot 2)
  const handleConfirmSelectStageTransferPeriod = () => {
    const period = selectedStageTransferPeriod || "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026";
    const process = selectedStageTransferProcess || "QT-SOI-DET - Quy trình sản xuất Sợi - Dệt - Nhuộm";
    setSelectedStageTransferPeriod(period);
    setSelectedStageTransferProcess(process);
    notify(`Đã chọn "${period}" - "${process}" để điều chuyển công đoạn!`);
    setSelectStageTransferPeriodModalOpen(false);
    setShowStepStageTransferList(true);
  };

  // Helper to confirm selection of period & process for alloc general subtab (Screenshot 4)
  const handleConfirmSelectAllocGeneralPeriod = () => {
    const period = selectedAllocGeneralPeriod || "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026";
    const process = selectedAllocGeneralProcess || "QT-SOI-DET - Quy trình sản xuất Sợi - Dệt - Nhuộm";
    setSelectedAllocGeneralPeriod(period);
    setSelectedAllocGeneralProcess(process);
    notify(`Đã chọn "${period}" - "${process}" để phân bổ chi phí chung!`);
    setSelectAllocGeneralPeriodModalOpen(false);
    setShowStepAllocGeneralList(true);
  };

  const handleGenericPresetChange = (
    preset: string,
    setPreset: (v: string) => void,
    setFrom: (v: string) => void,
    setTo: (v: string) => void,
    setName: (v: string) => void
  ) => {
    setPreset(preset);
    let from = "01/10/2026";
    let to = "31/10/2026";
    if (preset === "Hôm nay") {
      from = "01/10/2026";
      to = "01/10/2026";
    } else if (preset === "Tuần này") {
      from = "28/09/2026";
      to = "04/10/2026";
    } else if (preset === "Tháng này") {
      from = "01/10/2026";
      to = "31/10/2026";
    } else if (preset === "Tháng trước") {
      from = "01/09/2026";
      to = "30/09/2026";
    } else if (preset === "Quý này" || preset === "Quý 4") {
      from = "01/10/2026";
      to = "31/12/2026";
    } else if (preset === "Quý 3") {
      from = "01/07/2026";
      to = "30/09/2026";
    } else if (preset === "Năm nay") {
      from = "01/01/2026";
      to = "31/12/2026";
    }
    setFrom(from);
    setTo(to);
    setName(`Kỳ tính giá thành từ ngày ${from} đến ngày ${to}`);
  };

  const currentTab = tab || "process";
  const currentSubtabData = COST_PROCESS_DATA[subtab] || COST_PROCESS_DATA.simple;
  const records = INITIAL_COST_PERIODS[currentTab] || [];
  const filteredRecords = records.filter(
    (r) =>
      r.code.toLowerCase().includes(searchText.toLowerCase()) ||
      r.name.toLowerCase().includes(searchText.toLowerCase()) ||
      r.targetObject.toLowerCase().includes(searchText.toLowerCase())
  );

  // Format currency
  const formatMoney = (val: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val);

  return (
    <div className="misa-cost-workspace" style={{ background: "#f8fafc", minHeight: "100%", padding: 16 }}>
      {/* ==================================================================== */}
      {/* 1. PROCESS TAB (QUY TRÌNH) - MATCHES SCREENSHOT 2 */}
      {/* ==================================================================== */}
      {currentTab === "process" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1400, margin: "0 auto" }}>
          {/* Subtabs Bar (Giản đơn | Hệ số, Tỷ lệ | Phân bước | Công trình | Đơn hàng | Hợp đồng) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 4px",
            }}
          >
            {(
              [
                ["simple", "Giản đơn"],
                ["coefficient", "Hệ số, Tỷ lệ"],
                ["step", "Phân bước"],
                ["projects", "Công trình"],
                ["orders", "Đơn hàng"],
                ["contracts", "Hợp đồng"],
              ] as [CostMethod, string][]
            ).map(([key, label]) => {
              const active = subtab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSubtab(key)}
                  style={{
                    padding: "6px 16px",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#00a862" : "#334155",
                    background: active ? "#ffffff" : "transparent",
                    border: active ? "1px solid #cbd5e1" : "1px solid transparent",
                    borderBottom: active ? "2.5px solid #00a862" : "1px solid transparent",
                    borderRadius: 4,
                    cursor: "pointer",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Main 2-column Grid: Left = S-curve Flowchart, Right = Video Guide & Reports */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            {/* Left Card: S-Curve Process Diagram */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                padding: "24px 28px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header Title */}
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1e293b",
                  textAlign: "center",
                  margin: "0 0 32px 0",
                  letterSpacing: 0.2,
                }}
              >
                {currentSubtabData.headerTitle}
              </h2>

              {/* S-curve Interactive Flow Diagram */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: 250,
                  padding: "10px 0",
                }}
              >
                {/* SVG Connecting Flow Lines */}
                <svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                  preserveAspectRatio="none"
                  viewBox="0 0 1000 240"
                >
                  <defs>
                    <marker
                      id={arrowMarkerId}
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                    </marker>
                  </defs>

                  {/* Row 1 Connecting Line: 1 -> 2 -> 3 -> 4 -> 5 */}
                  <line
                    x1="130"
                    y1="34"
                    x2="280"
                    y2="34"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd={`url(#${arrowMarkerId})`}
                  />
                  <line
                    x1="330"
                    y1="34"
                    x2="480"
                    y2="34"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd={`url(#${arrowMarkerId})`}
                  />
                  <line
                    x1="530"
                    y1="34"
                    x2="680"
                    y2="34"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd={`url(#${arrowMarkerId})`}
                  />
                  <line
                    x1="730"
                    y1="34"
                    x2="880"
                    y2="34"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd={`url(#${arrowMarkerId})`}
                  />

                  {/* S-Loop Turnaround: Curves down from 5, loops left across under Row 1, and curves down into Step 6 */}
                  <path
                    d="M 910 42 C 945 42, 945 106, 910 106 L 90 106 C 55 106, 55 168, 90 168"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  />

                  {/* Row 2 Connecting Lines */}
                  <line
                    x1="130"
                    y1="168"
                    x2="280"
                    y2="168"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd={`url(#${arrowMarkerId})`}
                  />
                  <line
                    x1="330"
                    y1="168"
                    x2="480"
                    y2="168"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd={`url(#${arrowMarkerId})`}
                  />
                  <line
                    x1="530"
                    y1="168"
                    x2="680"
                    y2="168"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd={`url(#${arrowMarkerId})`}
                  />
                  {currentSubtabData.row2.length === 5 ? (
                    <>
                      <line
                        x1="730"
                        y1="168"
                        x2="880"
                        y2="168"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        markerEnd={`url(#${arrowMarkerId})`}
                      />
                      <line
                        x1="930"
                        y1="168"
                        x2="980"
                        y2="168"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        markerEnd={`url(#${arrowMarkerId})`}
                      />
                    </>
                  ) : (
                    <line
                      x1="730"
                      y1="168"
                      x2="840"
                      y2="168"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      markerEnd={`url(#${arrowMarkerId})`}
                    />
                  )}
                </svg>

                {/* Row 1 Nodes: Steps 1, 2, 3, 4, 5 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 16,
                    position: "relative",
                    zIndex: step1MenuOpen || step5MenuOpen ? 50 : 2,
                    marginBottom: 50,
                  }}
                >
                  {currentSubtabData.row1.map((stepItem) => {
                    const Icon = stepItem.icon;
                    const isStep1 = stepItem.step === 1;
                    const hasStep1Dropdown =
                      isStep1 &&
                      (subtab === "simple" ||
                        subtab === "coefficient" ||
                        subtab === "step");
                    const isStep5 = stepItem.step === 5;
                    return (
                      <div
                        key={stepItem.step}
                        onClick={() => {
                          if (hasStep1Dropdown) {
                            setStep1MenuOpen(!step1MenuOpen);
                            setStep5MenuOpen(false);
                          } else if (isStep1) {
                            setItemDrawerType("material");
                            setItemGroup("NVL");
                            setItemName("");
                            setItemDrawerOpen(true);
                          } else if (isStep5) {
                            setStep5MenuOpen(!step5MenuOpen);
                            setStep1MenuOpen(false);
                          } else {
                            setActiveStepModal(stepItem.step);
                          }
                        }}
                        style={{
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                        title={`Bấm để mở: ${stepItem.title}`}
                      >
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 10,
                            background: "#ffffff",
                            border: "2px solid #10b981",
                            boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)",
                            display: "grid",
                            placeItems: "center",
                            color: "#059669",
                            marginBottom: 10,
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-3px)";
                            e.currentTarget.style.boxShadow =
                              "0 6px 12px rgba(16, 185, 129, 0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow =
                              "0 2px 6px rgba(16, 185, 129, 0.2)";
                          }}
                        >
                          <Icon size={24} />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#1e293b",
                            lineHeight: 1.35,
                            maxWidth: 130,
                          }}
                        >
                          {stepItem.title}
                        </span>

                        {/* Floating Popup Menu for Step 1 */}
                        {hasStep1Dropdown && step1MenuOpen && (
                          <>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setStep1MenuOpen(false);
                              }}
                              style={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 90,
                                cursor: "default",
                              }}
                            />
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                marginTop: 10,
                                background: "#ffffff",
                                borderRadius: 4,
                                border: "1px solid #cbd5e1",
                                boxShadow:
                                  "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                                zIndex: 100,
                                minWidth: 175,
                                textAlign: "left",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                onClick={() => {
                                  setStep1MenuOpen(false);
                                  setItemDrawerType("material");
                                  setItemGroup("NVL");
                                  setItemName("");
                                  setItemDrawerOpen(true);
                                }}
                                style={{
                                  padding: "10px 16px",
                                  fontSize: 13,
                                  color: "#1e293b",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  transition: "background 0.1s ease",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background = "#f1f5f9")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background = "#ffffff")
                                }
                              >
                                Thêm nguyên vật liệu
                              </div>
                              <div
                                onClick={() => {
                                  setStep1MenuOpen(false);
                                  setItemDrawerType("product");
                                  setItemGroup("TP");
                                  setItemName("");
                                  setItemDrawerOpen(true);
                                }}
                                style={{
                                  padding: "10px 16px",
                                  fontSize: 13,
                                  color: "#1e293b",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  borderTop: "1px solid #f1f5f9",
                                  transition: "background 0.1s ease",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background = "#f1f5f9")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background = "#ffffff")
                                }
                              >
                                Thêm thành phẩm
                              </div>
                            </div>
                          </>
                        )}

                        {/* Floating Popup Menu for Step 5 */}
                        {isStep5 && step5MenuOpen && (
                          <>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setStep5MenuOpen(false);
                              }}
                              style={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 90,
                                cursor: "default",
                              }}
                            />
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: "absolute",
                                top: "100%",
                                right: 0,
                                marginTop: 10,
                                background: "#ffffff",
                                borderRadius: 4,
                                border: "1px solid #cbd5e1",
                                boxShadow:
                                  "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                                zIndex: 100,
                                minWidth: 205,
                                textAlign: "left",
                                overflow: "hidden",
                              }}
                            >
                              {[
                                {
                                  label: "Tính khấu hao TSCĐ",
                                  action: () => setDepreciationModalOpen(true),
                                },
                                {
                                  label: "Phân bổ CCDC",
                                  action: () => setToolAllocModalOpen(true),
                                },
                                {
                                  label: "Phân bổ chi phí trả trước",
                                  action: () => setPrepaidAllocModalOpen(true),
                                },
                                {
                                  label: "Hạch toán lương",
                                  action: () => setPayrollAllocModalOpen(true),
                                },
                                {
                                  label: "Hạch toán chi phí khác",
                                  action: () => setOtherExpenseModalOpen(true),
                                },
                              ].map((item, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    setStep5MenuOpen(false);
                                    item.action();
                                  }}
                                  style={{
                                    padding: "10px 16px",
                                    fontSize: 13,
                                    color: "#1e293b",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    borderTop:
                                      idx > 0 ? "1px solid #f1f5f9" : "none",
                                    transition: "background 0.1s ease",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = "#f1f5f9")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = "#ffffff")
                                  }
                                >
                                  {item.label}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Row 2 Nodes */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 16,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {currentSubtabData.row2.map((stepItem) => {
                    const Icon = stepItem.icon;
                    return (
                      <div
                        key={stepItem.step}
                        onClick={() => setActiveStepModal(stepItem.step)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                        title={`Bấm để mở: ${stepItem.title}`}
                      >
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 10,
                            background: "#ffffff",
                            border: "2px solid #10b981",
                            boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)",
                            display: "grid",
                            placeItems: "center",
                            color: "#059669",
                            marginBottom: 10,
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-3px)";
                            e.currentTarget.style.boxShadow =
                              "0 6px 12px rgba(16, 185, 129, 0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow =
                              "0 2px 6px rgba(16, 185, 129, 0.2)";
                          }}
                        >
                          <Icon size={24} />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#1e293b",
                            lineHeight: 1.35,
                            maxWidth: 130,
                          }}
                        >
                          {stepItem.title}
                        </span>
                      </div>
                    );
                  })}
                  {currentSubtabData.row2.length === 4 && <div />}
                </div>
              </div>
            </div>

            {/* Right Card: Guide & Report */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                padding: "16px 18px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Header Tabs: HƯỚNG DẪN | BÁO CÁO */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid #e2e8f0",
                  gap: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setGuideTab("guide")}
                  style={{
                    padding: "6px 4px 10px 4px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: guideTab === "guide" ? "#00a862" : "#64748b",
                    background: "none",
                    border: "none",
                    borderBottom:
                      guideTab === "guide" ? "2.5px solid #00a862" : "2.5px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  HƯỚNG DẪN
                </button>
                <button
                  type="button"
                  onClick={() => setGuideTab("report")}
                  style={{
                    padding: "6px 4px 10px 4px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: guideTab === "report" ? "#00a862" : "#64748b",
                    background: "none",
                    border: "none",
                    borderBottom:
                      guideTab === "report" ? "2.5px solid #00a862" : "2.5px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  BÁO CÁO
                </button>
              </div>

              {guideTab === "guide" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Video Thumbnail Box */}
                  <div
                    onClick={() => setVideoModalOpen(true)}
                    style={{
                      position: "relative",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: currentSubtabData.videoBg,
                      height: 125,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: 10,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                    title="Bấm để xem video hướng dẫn"
                  >
                    {/* Video Header Text */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: "#00a862",
                          display: "grid",
                          placeItems: "center",
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        M
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#ffffff",
                          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                          lineHeight: 1.2,
                        }}
                      >
                        {currentSubtabData.videoTopLabel}
                      </span>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#fef08a",
                          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                          letterSpacing: 0.3,
                          lineHeight: 1.2,
                        }}
                      >
                        {currentSubtabData.videoMainTitle}
                      </div>
                      {currentSubtabData.videoSubtitle && (
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: "#e2e8f0",
                            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                            marginTop: 2,
                          }}
                        >
                          {currentSubtabData.videoSubtitle}
                        </div>
                      )}
                    </div>

                    {/* Red YouTube style play button */}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 44,
                        height: 30,
                        borderRadius: 8,
                        background: "#ef4444",
                        display: "grid",
                        placeItems: "center",
                        boxShadow: "0 4px 10px rgba(239, 68, 68, 0.4)",
                      }}
                    >
                      <Play size={16} color="#ffffff" fill="#ffffff" />
                    </div>
                  </div>

                  {/* Video Actions Links */}
                  <div
                    style={{
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setVideoModalOpen(true)}
                      style={{
                        color: "#2563eb",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      Xem phim hướng dẫn
                    </button>
                    <span style={{ color: "#94a3b8", fontSize: 11 }}>Hoặc</span>
                    <button
                      type="button"
                      onClick={() => setArticleModalOpen(true)}
                      style={{
                        color: "#00a862",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                        letterSpacing: 0.2,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      XEM BÀI VIẾT HƯỚNG DẪN
                    </button>
                  </div>

                  {/* FAQ / Troubleshooting Link with blue circled (?) icon */}
                  <div
                    onClick={() => setFaqModalOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "10px 12px",
                      background: "#f0f9ff",
                      borderRadius: 6,
                      border: "1px solid #bae6fd",
                      cursor: "pointer",
                      marginTop: 4,
                    }}
                  >
                    <HelpCircle size={16} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span
                      style={{
                        fontSize: 12,
                        color: "#0369a1",
                        lineHeight: 1.35,
                        fontWeight: 500,
                      }}
                    >
                      Một số nguyên nhân tính giá thành sai số liệu và câu hỏi thường gặp
                    </span>
                  </div>
                </div>
              ) : (
                /* Report Quick Links Tab */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "Sổ chi phí sản xuất kinh doanh (TK 154)",
                    "Thẻ tính giá thành sản phẩm",
                    "Bảng tổng hợp chi phí sản xuất theo yếu tố",
                    "Bảng phân bổ chi phí sản xuất chung",
                    "Báo cáo đánh giá sản phẩm dở dang cuối kỳ",
                    "Báo cáo đối chiếu chi phí sản xuất và giá thành",
                  ].map((rpt, idx) => (
                    <div
                      key={idx}
                      onClick={() => notify(`Mở báo cáo: ${rpt}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #f1f5f9",
                        background: "#f8fafc",
                        fontSize: 12,
                        color: "#1e293b",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    >
                      <FileSpreadsheet size={15} color="#00a862" />
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {rpt}
                      </span>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Quick Action Cards */}
          {currentSubtabData.hasUtilitiesBottom ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div
                onClick={() => setCostItemsModalOpen(true)}
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
                }}
              >
                <Tags size={18} color="#00a862" />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                  Khoản mục chi phí
                </span>
              </div>

              <div
                onClick={() => setUtilitiesModalOpen(true)}
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
                }}
              >
                <Lightbulb size={18} color="#00a862" />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                  Tiện ích
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setCostItemsModalOpen(true)}
              style={{
                background: "#ffffff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
                width: "100%",
                boxSizing: "border-box",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
              }}
            >
              <Tags size={18} color="#00a862" />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                Khoản mục chi phí
              </span>
            </div>
          )}

          {/* AVA AI Suggestion Banner (Matching Screenshot 2) */}
          <div
            style={{
              background: "linear-gradient(90deg, #f0fdf4 0%, #eff6ff 50%, #faf5ff 100%)",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 500 }}>
              Bạn chưa chọn được phương pháp tính giá phù hợp? Hãy để AVA Kế toán gợi ý cho bạn nhé!
            </div>

            <button
              type="button"
              onClick={() => setAvaModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 6,
                background: "#ffffff",
                border: "1px solid #c084fc",
                color: "#7e22ce",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(192, 132, 252, 0.15)",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#faf5ff";
                e.currentTarget.style.borderColor = "#a855f7";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#c084fc";
              }}
            >
              <Sparkles size={16} color="#9333ea" />
              <span>Gợi ý phương pháp tính giá thành</span>
            </button>
          </div>

          {/* External link: Xem giới thiệu các phương pháp tính giá */}
          <div style={{ textAlign: "center", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setMethodsModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "#2563eb",
                fontSize: 13,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              <ExternalLink size={14} />
              <span>Xem giới thiệu các phương pháp tính giá</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2A. SẢN XUẤT LIÊN TỤC - GIẢN ĐƠN & HỆ SỐ, TỶ LỆ (SCREENSHOTS 1, 2, 3) */}
      {/* ==================================================================== */}
      {(currentTab === "continuous-simple" || currentTab === "continuous-coefficient") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 1400, margin: "0 auto" }}>
          {/* Top Guide Banner (Screenshot 1 & 3) */}
          {!guideBannerDismissed && (
            <div
              style={{
                background: "#ebf3ff",
                border: "1px solid #d0e2ff",
                borderRadius: 4,
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>
                  Bạn chưa biết tính giá thành trên phần mềm? Hãy cùng xem hướng dẫn sau đây nhé!
                </span>
                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  style={{
                    background: "#1877f2",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    padding: "5px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#166fe5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1877f2")}
                >
                  Xem hướng dẫn
                </button>
              </div>
              <button
                type="button"
                onClick={() => setGuideBannerDismissed(true)}
                title="Đóng thông báo"
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Subtabs Bar (Kỳ tính giá | Kết chuyển chi phí) */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderBottom: "1px solid #cbd5e1",
              borderRadius: "4px 4px 0 0",
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "0 16px",
            }}
          >
            <button
              type="button"
              onClick={() => setSimpleSubtab("period")}
              style={{
                padding: "10px 4px",
                fontSize: 13,
                fontWeight: simpleSubtab === "period" ? 700 : 500,
                color: simpleSubtab === "period" ? "#00a862" : "#334155",
                background: "none",
                border: "none",
                borderBottom: simpleSubtab === "period" ? "2.5px solid #00a862" : "2.5px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Kỳ tính giá
            </button>
            <button
              type="button"
              onClick={() => setSimpleSubtab("transfer")}
              style={{
                padding: "10px 4px",
                fontSize: 13,
                fontWeight: simpleSubtab === "transfer" ? 700 : 500,
                color: simpleSubtab === "transfer" ? "#00a862" : "#334155",
                background: "none",
                border: "none",
                borderBottom: simpleSubtab === "transfer" ? "2.5px solid #00a862" : "2.5px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Kết chuyển chi phí
            </button>
          </div>

          {/* Main Card Content */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderTop: "none",
              borderRadius: "0 0 4px 4px",
              minHeight: 460,
              padding: "48px 24px 28px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
              position: "relative",
            }}
          >
            {/* 1. KỲ TÍNH GIÁ */}
            {simpleSubtab === "period" && (
              <>
                {!showPeriodList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      width: "100%",
                      maxWidth: 700,
                      margin: "auto 0",
                    }}
                  >
                    {/* Centered Graphic Illustration matching Screenshot 1 & 3 */}
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M45 40L47 45L52 47L47 49L45 54L43 49L38 47L43 45L45 40Z" fill="#94a3b8" opacity="0.6"/>
                      <path d="M185 30L186.5 34L190.5 35.5L186.5 37L185 41L183.5 37L179.5 35.5L183.5 34L185 30Z" fill="#00a862"/>
                      <path d="M190 95L191 98L194 99L191 100L190 103L189 100L186 99L189 98L190 95Z" fill="#94a3b8" opacity="0.5"/>
                      <path d="M70 120L71 123L74 124L71 125L70 128L69 125L66 124L69 123L70 120Z" fill="#00a862"/>
                      <path d="M52 70 C46 70 42 66 42 60 C42 55 45 51 50 50 C52 44 58 40 65 40 C73 40 79 45 80 52 C83 52 86 55 86 59 C86 65 82 70 76 70 Z" fill="#e8f5e9" stroke="#a7f3d0" strokeWidth="1.5"/>
                      <circle cx="64" cy="57" r="10" fill="#00a862" />
                      <text x="64" y="61" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="sans-serif">$</text>
                      <path d="M84 60 C105 60 115 72 130 82" stroke="#00a862" strokeWidth="1.5" strokeDasharray="3 3"/>
                      <path d="M127 77 L132 83 L124 85" fill="none" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="106" cy="69" r="7.5" fill="#00a862" />
                      <text x="106" y="72.5" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="700" fontFamily="sans-serif">$</text>
                      <ellipse cx="145" cy="120" rx="38" ry="10" fill="#e2e8f0" opacity="0.7"/>
                      <path d="M120 78 L145 92 L145 116 L120 102 Z" fill="#008f53"/>
                      <path d="M145 92 L170 78 L170 102 L145 116 Z" fill="#00a862"/>
                      <path d="M145 68 L170 78 L145 92 L120 78 Z" fill="#10b981"/>
                      <path d="M138 88 L152 96 L152 102 L138 94 Z" fill="#ffffff" opacity="0.9"/>
                    </svg>

                    {/* Headline (Different for continuous-coefficient vs continuous-simple) */}
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginTop: 24,
                        marginBottom: 18,
                      }}
                    >
                      {currentTab === "continuous-coefficient"
                        ? "Thêm kỳ tính giá thành để tập hợp chi phí và tính giá thành cho Phân xưởng"
                        : "Thêm kỳ tính giá thành để tập hợp chi phí và tính giá thành cho sản phẩm"}
                    </div>

                    {/* Buttons row: Thêm & Tiện ích */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setAddSimplePeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "7px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        Thêm
                      </button>

                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setUtilitiesMenuOpen(!utilitiesMenuOpen)}
                          style={{
                            background: "#ffffff",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "7px 18px",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Tiện ích
                        </button>

                        {/* Tiện ích popover menu */}
                        {utilitiesMenuOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 6px)",
                              left: 0,
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              borderRadius: 6,
                              boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
                              zIndex: 50,
                              minWidth: 260,
                              padding: "6px 0",
                            }}
                          >
                            {currentTab === "continuous-coefficient" ? (
                              /* 4 ITEMS FOR CONTINUOUS-COEFFICIENT (MATCHES SCREENSHOT 3 EXACTLY) */
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUtilitiesMenuOpen(false);
                                    setWipOpeningModalOpen(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 16px",
                                    fontSize: 13,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#334155",
                                    transition: "all 0.12s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#f8fafc";
                                    e.currentTarget.style.color = "#00a862";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "none";
                                    e.currentTarget.style.color = "#334155";
                                  }}
                                >
                                  Chi phí dở dang đầu kỳ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUtilitiesMenuOpen(false);
                                    setNormCostModalOpen(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 16px",
                                    fontSize: 13,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#334155",
                                    transition: "all 0.12s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#f8fafc";
                                    e.currentTarget.style.color = "#00a862";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "none";
                                    e.currentTarget.style.color = "#334155";
                                  }}
                                >
                                  Khai báo định mức giá thành
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUtilitiesMenuOpen(false);
                                    setNormAllocModalOpen(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 16px",
                                    fontSize: 13,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#334155",
                                    transition: "all 0.12s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#f8fafc";
                                    e.currentTarget.style.color = "#00a862";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "none";
                                    e.currentTarget.style.color = "#334155";
                                  }}
                                >
                                  Khai báo định mức phân bổ chi phí
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUtilitiesMenuOpen(false);
                                    setPlannedCostModalOpen(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 16px",
                                    fontSize: 13,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#334155",
                                    transition: "all 0.12s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#f8fafc";
                                    e.currentTarget.style.color = "#00a862";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "none";
                                    e.currentTarget.style.color = "#334155";
                                  }}
                                >
                                  Khai báo giá thành kế hoạch
                                </button>
                              </>
                            ) : (
                              /* 4 ITEMS FOR CONTINUOUS-SIMPLE */
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUtilitiesMenuOpen(false);
                                    setToolAllocModalOpen(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 14px",
                                    fontSize: 13,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#334155",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <Calculator size={14} color="#00a862" />
                                  <span>Phân bổ chi phí chung (TK 627)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUtilitiesMenuOpen(false);
                                    notify("Mở Đánh giá sản phẩm dở dang cuối kỳ");
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 14px",
                                    fontSize: 13,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#334155",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <SlidersHorizontal size={14} color="#00a862" />
                                  <span>Đánh giá sản phẩm dở dang</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUtilitiesMenuOpen(false);
                                    notify("Mở Thiết lập định mức NVL");
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 14px",
                                    fontSize: 13,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#334155",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <FolderPlus size={14} color="#00a862" />
                                  <span>Thiết lập định mức NVL</span>
                                </button>
                                <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUtilitiesMenuOpen(false);
                                    setSimplePeriods(INITIAL_COST_PERIODS["continuous-simple"]);
                                    notify("Đã nạp 2 kỳ tính giá thành mẫu vào hệ thống!");
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "8px 14px",
                                    fontSize: 13,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#2563eb",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <Sparkles size={14} color="#2563eb" />
                                  <span>Nạp dữ liệu mẫu tháng 01 & 02</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Centered Pill Button */}
                    <button
                      type="button"
                      onClick={() => setShowPeriodList(true)}
                      style={{
                        marginTop: 48,
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        color: "#00a862",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 13,
                        fontWeight: 500,
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
                ) : (
                  /* PERIOD LIST VIEW */
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setShowPeriodList(false)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách kỳ tính giá thành ({currentTab === "continuous-coefficient" ? "Sản xuất liên tục - Hệ số, tỷ lệ" : "Sản xuất liên tục - Giản đơn"})
                        </h3>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setAddSimplePeriodModalOpen(true)}
                          style={{
                            background: "#00a862",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 4,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Plus size={14} />
                          <span>Thêm kỳ tính giá</span>
                        </button>
                      </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Mã kỳ</th>
                            <th>Tên kỳ tính giá thành</th>
                            <th>Đối tượng tập hợp chi phí</th>
                            <th style={{ width: 100 }}>Từ ngày</th>
                            <th style={{ width: 100 }}>Đến ngày</th>
                            <th style={{ width: 130, textAlign: "right" }}>Dở dang ĐK</th>
                            <th style={{ width: 130, textAlign: "right" }}>CP phát sinh</th>
                            <th style={{ width: 130, textAlign: "right" }}>Dở dang CK</th>
                            <th style={{ width: 140, textAlign: "right" }}>Tổng giá thành</th>
                            <th style={{ width: 110, textAlign: "center" }}>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simplePeriods.length === 0 ? (
                            <tr>
                              <td colSpan={11} style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                                Chưa có kỳ tính giá thành nào. Hãy bấm <b>Thêm kỳ tính giá</b> hoặc nạp dữ liệu.
                              </td>
                            </tr>
                          ) : (
                            simplePeriods.map((item, idx) => (
                              <tr key={item.id}>
                                <td style={{ textAlign: "center" }}>{idx + 1}</td>
                                <td style={{ fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                                <td style={{ fontWeight: 500 }}>{item.name}</td>
                                <td>{item.targetObject}</td>
                                <td>{item.fromDate}</td>
                                <td>{item.toDate}</td>
                                <td style={{ textAlign: "right" }}>{formatMoney(item.openingWip)}</td>
                                <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(item.incurredCost)}</td>
                                <td style={{ textAlign: "right", color: "#d97706" }}>{formatMoney(item.endingWip)}</td>
                                <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(item.totalFinishedCost)}</td>
                                <td style={{ textAlign: "center" }}>
                                  <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#dcfce7", color: "#166534" }}>
                                    {item.status === "completed" ? "Đã hoàn thành" : "Đang tính"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 2. KẾT CHUYỂN CHI PHÍ */}
            {simpleSubtab === "transfer" && (
              <>
                {!showTransferList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      width: "100%",
                      maxWidth: 700,
                      margin: "auto 0",
                    }}
                  >
                    {/* Centered Graphic Illustration (Different for continuous-coefficient vs continuous-simple) */}
                    {currentTab === "continuous-coefficient" ? (
                      /* Bar chart illustration matching Screenshot 2 */
                      <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M48 35L49.5 39L53.5 40.5L49.5 42L48 46L46.5 42L42.5 40.5L46.5 39L48 35Z" fill="#94a3b8" opacity="0.6"/>
                        <path d="M185 32L186.5 36L190.5 37.5L186.5 39L185 43L183.5 39L179.5 37.5L183.5 36L185 32Z" fill="#10b981"/>
                        <path d="M192 90L193 93L196 94L193 95L192 98L191 95L188 94L191 93L192 90Z" fill="#94a3b8" opacity="0.5"/>
                        <path d="M42 95L43.5 98L46.5 99.5L43.5 101L42 104L40.5 101L37.5 99.5L40.5 98L42 95Z" fill="#10b981"/>

                        {/* Soft cloud background */}
                        <path d="M70 70 C60 70 54 64 54 56 C54 48 60 42 68 42 C72 34 82 30 92 32 C102 34 110 42 112 50 C118 50 124 54 124 60 C124 68 118 70 110 70 Z" fill="#f1f5f9" opacity="0.8"/>
                        <ellipse cx="110" cy="124" rx="55" ry="10" fill="#e2e8f0" opacity="0.7"/>

                        {/* Rounded Emerald Base / Tray */}
                        <path d="M72 100 L148 100 C154 100 158 104 156 110 L152 118 C150 122 144 124 138 124 L82 124 C76 124 70 122 68 118 L64 110 C62 104 66 100 72 100 Z" fill="#00a862"/>
                        <path d="M72 100 L148 100 C154 100 156 103 154 107 L66 107 C64 103 66 100 72 100 Z" fill="#10b981"/>

                        {/* Left Card: 621, 622, 627 */}
                        <rect x="74" y="62" width="34" height="42" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1"/>
                        <text x="79" y="74" fill="#64748b" fontSize="8" fontWeight="600" fontFamily="sans-serif">621</text>
                        <text x="79" y="85" fill="#64748b" fontSize="8" fontWeight="600" fontFamily="sans-serif">622</text>
                        <text x="79" y="96" fill="#64748b" fontSize="8" fontWeight="600" fontFamily="sans-serif">627</text>

                        {/* Upward curved arrow to 154 */}
                        <path d="M96 66 C105 60 114 62 118 68" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3"/>
                        <path d="M115 62 L121 68 L113 71" fill="none" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        
                        {/* Target Badge 154 */}
                        <rect x="122" y="60" width="22" height="12" rx="2" fill="#e8f5e9"/>
                        <text x="133" y="69" textAnchor="middle" fill="#00a862" fontSize="7.5" fontWeight="700" fontFamily="sans-serif">154</text>

                        {/* Right Bar Chart (3 bars with increasing heights) */}
                        <rect x="114" y="86" width="7" height="15" rx="1.5" fill="#a7f3d0"/>
                        <rect x="124" y="78" width="7" height="23" rx="1.5" fill="#34d399"/>
                        <rect x="134" y="70" width="7" height="31" rx="1.5" fill="#00a862"/>
                        
                        {/* Trending Arrow over bars */}
                        <path d="M114 84 L126 74 L142 66" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M136 66 L143 66 L143 73" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      /* Package Illustration for continuous-simple */
                      <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M45 40L47 45L52 47L47 49L45 54L43 49L38 47L43 45L45 40Z" fill="#94a3b8" opacity="0.6"/>
                        <path d="M185 30L186.5 34L190.5 35.5L186.5 37L185 41L183.5 37L179.5 35.5L183.5 34L185 30Z" fill="#00a862"/>
                        <path d="M190 95L191 98L194 99L191 100L190 103L189 100L186 99L189 98L190 95Z" fill="#94a3b8" opacity="0.5"/>
                        <path d="M70 120L71 123L74 124L71 125L70 128L69 125L66 124L69 123L70 120Z" fill="#00a862"/>
                        <path d="M52 70 C46 70 42 66 42 60 C42 55 45 51 50 50 C52 44 58 40 65 40 C73 40 79 45 80 52 C83 52 86 55 86 59 C86 65 82 70 76 70 Z" fill="#e8f5e9" stroke="#a7f3d0" strokeWidth="1.5"/>
                        <circle cx="64" cy="57" r="10" fill="#00a862" />
                        <text x="64" y="61" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="sans-serif">$</text>
                        <path d="M84 60 C105 60 115 72 130 82" stroke="#00a862" strokeWidth="1.5" strokeDasharray="3 3"/>
                        <path d="M127 77 L132 83 L124 85" fill="none" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="106" cy="69" r="7.5" fill="#00a862" />
                        <text x="106" y="72.5" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="700" fontFamily="sans-serif">$</text>
                        <ellipse cx="145" cy="120" rx="38" ry="10" fill="#e2e8f0" opacity="0.7"/>
                        <path d="M120 78 L145 92 L145 116 L120 102 Z" fill="#008f53"/>
                        <path d="M145 92 L170 78 L170 102 L145 116 Z" fill="#00a862"/>
                        <path d="M145 68 L170 78 L145 92 L120 78 Z" fill="#10b981"/>
                        <path d="M138 88 L152 96 L152 102 L138 94 Z" fill="#ffffff" opacity="0.9"/>
                      </svg>
                    )}

                    {/* Headline (Different for continuous-coefficient vs continuous-simple) */}
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginTop: 24,
                        marginBottom: 18,
                        maxWidth: 680,
                        lineHeight: 1.55,
                      }}
                    >
                      {currentTab === "continuous-coefficient"
                        ? "Kết chuyển toàn bộ chi phí sản xuất đã phát sinh trong kỳ từ TK 621, 622, 627 sang TK 154 theo từng đối tượng tập hợp chi phí"
                        : "Kết chuyển toàn bộ chi phí sản xuất đã phát sinh trong kỳ từ TK 621, 622, 627 sang TK 154 theo từng đối tượng THCP"}
                    </div>

                    {/* Button Thêm */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "7px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    {/* Bottom Centered Pill Button */}
                    <button
                      type="button"
                      onClick={() => setShowTransferList(true)}
                      style={{
                        marginTop: 48,
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        color: "#00a862",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 13,
                        fontWeight: 500,
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
                ) : (
                  /* TRANSFER LIST VIEW */
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setShowTransferList(false)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách chứng từ kết chuyển chi phí ({currentTab === "continuous-coefficient" ? "Sản xuất liên tục - Hệ số, tỷ lệ" : "Sản xuất liên tục - Giản đơn"})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={14} />
                        <span>Thêm chứng từ kết chuyển</span>
                      </button>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Ngày HT</th>
                            <th style={{ width: 110 }}>Số chứng từ</th>
                            <th>Diễn giải</th>
                            <th style={{ width: 90, textAlign: "center" }}>TK Nợ</th>
                            <th style={{ width: 110, textAlign: "center" }}>TK Có</th>
                            <th style={{ width: 140, textAlign: "right" }}>Số tiền</th>
                            <th>Đối tượng THCP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transferVouchers.length === 0 ? (
                            <tr>
                              <td colSpan={8} style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                                Chưa có chứng từ kết chuyển chi phí nào. Bấm <b>Thêm chứng từ kết chuyển</b> để thực hiện.
                              </td>
                            </tr>
                          ) : (
                            transferVouchers.map((v, idx) => (
                              <tr key={v.id}>
                                <td style={{ textAlign: "center" }}>{idx + 1}</td>
                                <td>{v.postDate}</td>
                                <td style={{ fontWeight: 600, color: "#00a862" }}>{v.docNo}</td>
                                <td>{v.desc}</td>
                                <td style={{ textAlign: "center", fontWeight: 600 }}>{v.debitAcc}</td>
                                <td style={{ textAlign: "center", color: "#64748b" }}>{v.creditAcc}</td>
                                <td style={{ textAlign: "right", fontWeight: 700, color: "#00a862" }}>
                                  {formatMoney(v.amount)}
                                </td>
                                <td>{v.targetObj}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2B. SẢN XUẤT LIÊN TỤC - PHÂN BƯỚC (SCREENSHOTS 1, 2) */}
      {/* ==================================================================== */}
      {currentTab === "continuous-step" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 1400, margin: "0 auto" }}>
          {/* Top Guide Banner */}
          {!guideBannerDismissed && (
            <div
              style={{
                background: "#ebf3ff",
                border: "1px solid #d0e2ff",
                borderRadius: 4,
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>
                  Bạn chưa biết tính giá thành trên phần mềm? Hãy cùng xem hướng dẫn sau đây nhé!
                </span>
                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  style={{
                    background: "#1877f2",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    padding: "5px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#166fe5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1877f2")}
                >
                  Xem hướng dẫn
                </button>
              </div>
              <button
                type="button"
                onClick={() => setGuideBannerDismissed(true)}
                title="Đóng thông báo"
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Subtabs Bar (5 subtabs matching Screenshot 1) */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderBottom: "1px solid #cbd5e1",
              borderRadius: "4px 4px 0 0",
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "0 16px",
              overflowX: "auto",
            }}
          >
            {[
              { id: "period", label: "Kỳ tính giá" },
              { id: "quantity", label: "Thống kê số lượng TP/BTP" },
              { id: "transfer_stage", label: "Chuyển công đoạn" },
              { id: "alloc_general", label: "Phân bổ chi phí chung về công đoạn" },
              { id: "transfer_cost", label: "Kết chuyển chi phí" },
            ].map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setStepSubtab(tabItem.id as any)}
                style={{
                  padding: "10px 4px",
                  fontSize: 13,
                  fontWeight: stepSubtab === tabItem.id ? 700 : 500,
                  color: stepSubtab === tabItem.id ? "#00a862" : "#334155",
                  background: "none",
                  border: "none",
                  borderBottom: stepSubtab === tabItem.id ? "2.5px solid #00a862" : "2.5px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          {/* Main Card Container */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderTop: "none",
              borderRadius: "0 0 4px 4px",
              minHeight: 460,
              padding: "48px 24px 28px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
              position: "relative",
            }}
          >
            {/* 1. KỲ TÍNH GIÁ */}
            {stepSubtab === "period" && (
              <>
                {!showStepPeriodList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      width: "100%",
                      maxWidth: 750,
                      margin: "auto 0",
                    }}
                  >
                    {/* Centered Graphic Illustration matching Screenshot 1 */}
                    <svg width="240" height="150" viewBox="0 0 240 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Sparks & Stars */}
                      <path d="M42 42 L48 42 M45 39 L45 45" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M192 34 L198 34 M195 31 L195 37" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M202 96 L203 98.5 L205.5 99.5 L203 100.5 L202 103 L201 100.5 L198.5 99.5 L201 98.5 Z" fill="#94a3b8" opacity="0.5" />
                      <path d="M72 122 L73 124.5 L75.5 125.5 L73 126.5 L72 129 L71 126.5 L68.5 125.5 L71 124.5 Z" fill="#00a862" />
                      <circle cx="178" cy="44" r="1.5" fill="#00a862" />
                      <circle cx="44" cy="98" r="1.5" fill="#00a862" />

                      {/* Soft cloud background */}
                      <path d="M85 70 C75 70 70 64 70 56 C70 48 76 42 84 42 C88 34 98 30 108 32 C118 34 126 42 128 50 C134 50 140 54 140 60 C140 68 134 70 126 70 Z" fill="#f8fafc" opacity="0.9" />
                      <ellipse cx="140" cy="126" rx="55" ry="9" fill="#f1f5f9" opacity="0.7" />

                      {/* Card 1 (Left) */}
                      <rect x="52" y="44" width="34" height="42" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.03))" />
                      <path d="M60 55 C58 55 56.5 53.5 56.5 51.5 C56.5 49.5 58 48 60 48 C61 46 64 45 66 46 C69 47 70 49 70 51.5 C72 51.5 73.5 53 73.5 55 Z" fill="#00a862" />
                      <circle cx="65" cy="68" r="7" fill="#00a862" />
                      <text x="65" y="71.5" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Dotted curve from Card 1 upwards to Card 2 */}
                      <path d="M74 50 C80 43 85 43 90 45" stroke="#00a862" strokeWidth="1.5" strokeDasharray="2 3" />
                      <circle cx="80" cy="46" r="1.8" fill="#00a862" />
                      <circle cx="86" cy="44" r="1.8" fill="#00a862" />

                      {/* Card 2 (Center-Left) */}
                      <rect x="94" y="44" width="34" height="42" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.03))" />
                      <path d="M102 55 C100 55 98.5 53.5 98.5 51.5 C98.5 49.5 100 48 102 48 C103 46 106 45 108 46 C111 47 112 49 112 51.5 C114 51.5 115.5 53 115.5 55 Z" fill="#00a862" />
                      <path d="M103 51 L108 51 M108 51 L106 49 M108 51 L106 53" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M110 54 L105 54 M105 54 L107 52 M105 54 L107 56" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="107" cy="68" r="7" fill="#00a862" />
                      <text x="107" y="71.5" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Connecting dashed line from Card 2 to Coin 3 */}
                      <path d="M128 62 L137 62" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />
                      <circle cx="144" cy="62" r="6" fill="#00a862" />
                      <text x="144" y="65" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Connecting dashed line from Coin 3 to Coin 4 */}
                      <path d="M150 62 L160 62" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />
                      <circle cx="167" cy="62" r="6" fill="#00a862" />
                      <text x="167" y="65" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Dropping dashed lines from upper flow to bottom stages */}
                      <path d="M107 86 L107 101" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="2 2" />
                      <path d="M144 68 L144 101" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="2 2" />
                      <path d="M167 68 L167 101" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="2 2" />

                      {/* Bottom 3 Stage Blocks (Công đoạn 1, Công đoạn 2, Công đoạn 3) */}
                      {/* Stage 1 */}
                      <g transform="translate(97, 102)">
                        <path d="M0 6 C0 4 2 2 4 2 L8 2 L8 8 L16 8 L16 2 L20 2 C22 2 24 4 24 6 L24 18 C24 20 22 22 20 22 L4 22 C2 22 0 20 0 18 Z" fill="#008f53" />
                        <path d="M2 6 L2 18 C2 19 3 20 4 20 L20 20 C21 20 22 19 22 18 L22 6 L16 6 L16 10 L8 10 L8 6 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="12" cy="14" r="5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="12" y="16.5" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">1</text>
                      </g>

                      {/* Stage 2 */}
                      <g transform="translate(132, 102)">
                        <path d="M0 6 C0 4 2 2 4 2 L8 2 L8 8 L16 8 L16 2 L20 2 C22 2 24 4 24 6 L24 18 C24 20 22 22 20 22 L4 22 C2 22 0 20 0 18 Z" fill="#008f53" />
                        <path d="M2 6 L2 18 C2 19 3 20 4 20 L20 20 C21 20 22 19 22 18 L22 6 L16 6 L16 10 L8 10 L8 6 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="12" cy="14" r="5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="12" y="16.5" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">2</text>
                      </g>

                      {/* Stage 3 */}
                      <g transform="translate(162, 102)">
                        <path d="M0 6 C0 4 2 2 4 2 L6 2 L6 8 L12 8 L12 2 L16 2 L16 8 L22 8 L22 2 L24 2 C26 2 28 4 28 6 L28 18 C28 20 26 22 24 22 L4 22 C2 22 0 20 0 18 Z" fill="#008f53" />
                        <path d="M2 6 L2 18 C2 19 3 20 4 20 L24 20 C25 20 26 19 26 18 L26 6 L22 6 L22 10 L16 10 L16 6 L12 6 L12 10 L6 10 L6 6 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="14" cy="14" r="5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="14" y="16.5" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">3</text>
                      </g>
                    </svg>

                    {/* Headline matching Screenshot 1 */}
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginTop: 24,
                        marginBottom: 18,
                      }}
                    >
                      Thêm kỳ tính giá thành để tập hợp chi phí và tính giá thành cho từng công đoạn trong quy trình sản xuất
                    </div>

                    {/* Action buttons: Thêm & Tiện ích */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setAddStepPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "7px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        Thêm
                      </button>

                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setStepUtilitiesMenuOpen(!stepUtilitiesMenuOpen)}
                          style={{
                            background: "#ffffff",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "7px 18px",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Tiện ích
                        </button>

                        {/* Tiện ích popover menu */}
                        {stepUtilitiesMenuOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 6px)",
                              left: 0,
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              borderRadius: 6,
                              boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
                              zIndex: 50,
                              minWidth: 260,
                              padding: "6px 0",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setStepUtilitiesMenuOpen(false);
                                setWipOpeningModalOpen(true);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 16px",
                                fontSize: 13,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#334155",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f8fafc";
                                e.currentTarget.style.color = "#00a862";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color = "#334155";
                              }}
                            >
                              Chi phí dở dang đầu kỳ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStepUtilitiesMenuOpen(false);
                                setStepProcessModalOpen(true);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 16px",
                                fontSize: 13,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#334155",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f8fafc";
                                e.currentTarget.style.color = "#00a862";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color = "#334155";
                              }}
                            >
                              Khai báo quy trình sản xuất
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStepUtilitiesMenuOpen(false);
                                setNormAllocModalOpen(true);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 16px",
                                fontSize: 13,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#334155",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f8fafc";
                                e.currentTarget.style.color = "#00a862";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color = "#334155";
                              }}
                            >
                              Khai báo định mức phân bổ chi phí
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStepUtilitiesMenuOpen(false);
                                setPlannedCostModalOpen(true);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 16px",
                                fontSize: 13,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#334155",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f8fafc";
                                e.currentTarget.style.color = "#00a862";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color = "#334155";
                              }}
                            >
                              Khai báo giá thành kế hoạch
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Centered Pill Button */}
                    <button
                      type="button"
                      onClick={() => setShowStepPeriodList(true)}
                      style={{
                        marginTop: 48,
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        color: "#00a862",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 13,
                        fontWeight: 500,
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
                ) : (
                  /* PERIOD LIST VIEW */
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setShowStepPeriodList(false)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách kỳ tính giá thành (Sản xuất liên tục - Phân bước)
                        </h3>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setAddStepPeriodModalOpen(true)}
                          style={{
                            background: "#00a862",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 4,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Plus size={14} />
                          <span>Thêm kỳ tính giá</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Mã kỳ</th>
                            <th>Tên kỳ tính giá thành</th>
                            <th>Quy trình sản xuất</th>
                            <th style={{ width: 100 }}>Từ ngày</th>
                            <th style={{ width: 100 }}>Đến ngày</th>
                            <th style={{ width: 130, textAlign: "right" }}>Dở dang ĐK</th>
                            <th style={{ width: 130, textAlign: "right" }}>CP phát sinh</th>
                            <th style={{ width: 130, textAlign: "right" }}>Dở dang CK</th>
                            <th style={{ width: 140, textAlign: "right" }}>Tổng giá thành</th>
                            <th style={{ width: 110, textAlign: "center" }}>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stepPeriods.length === 0 ? (
                            <tr>
                              <td colSpan={11} style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                                Chưa có kỳ tính giá thành nào. Hãy bấm <b>Thêm kỳ tính giá</b> để bắt đầu.
                              </td>
                            </tr>
                          ) : (
                            stepPeriods.map((item, idx) => (
                              <tr key={item.id}>
                                <td style={{ textAlign: "center" }}>{idx + 1}</td>
                                <td style={{ fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                                <td style={{ fontWeight: 500 }}>{item.name}</td>
                                <td>{item.targetObject}</td>
                                <td>{item.fromDate}</td>
                                <td>{item.toDate}</td>
                                <td style={{ textAlign: "right" }}>{formatMoney(item.openingWip)}</td>
                                <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(item.incurredCost)}</td>
                                <td style={{ textAlign: "right", color: "#d97706" }}>{formatMoney(item.endingWip)}</td>
                                <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(item.totalFinishedCost)}</td>
                                <td style={{ textAlign: "center" }}>
                                  <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#dcfce7", color: "#166534" }}>
                                    {item.status === "completed" ? "Đã hoàn thành" : "Đang tính"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 2. THỐNG KÊ SỐ LƯỢNG TP/BTP (SCREENSHOT 1) */}
            {stepSubtab === "quantity" && (
              <>
                {!showStepQtyList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      width: "100%",
                      maxWidth: 750,
                      margin: "auto 0",
                    }}
                  >
                    {/* Centered Graphic Illustration matching Screenshot 1 */}
                    <svg width="250" height="140" viewBox="0 0 250 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Sparks & Stars */}
                      <path d="M198 34 L204 34 M201 31 L201 37" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="115" cy="42" r="1.5" fill="#94a3b8" />
                      <circle cx="216" cy="52" r="1.5" fill="#94a3b8" />
                      <path d="M68 116 L69 118.5 L71.5 119.5 L69 120.5 L68 123 L67 120.5 L64.5 119.5 L67 118.5 Z" fill="#00a862" />

                      {/* Soft cloud background */}
                      <path d="M120 65 C110 65 105 60 105 53 C105 46 110 40 118 40 C122 33 131 30 140 32 C150 34 157 41 159 48 C165 48 170 52 170 57 C170 64 165 65 158 65 Z" fill="#f8fafc" opacity="0.9" />
                      <ellipse cx="120" cy="115" rx="55" ry="8" fill="#f1f5f9" opacity="0.7" />

                      {/* Left: 3 Process Stage Blocks */}
                      {/* Stage 1 */}
                      <g transform="translate(32, 68)">
                        <path d="M0 5 C0 3 2 1 4 1 L7 1 L7 6 L13 6 L13 1 L16 1 C18 1 20 3 20 5 L20 16 C20 18 18 20 16 20 L4 20 C2 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 3 18 4 18 L16 18 C17 18 18 17 18 16 L18 5 L13 5 L13 8 L7 8 L7 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="10" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="10" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">1</text>
                      </g>

                      {/* Stage 2 */}
                      <g transform="translate(60, 68)">
                        <path d="M0 5 C0 3 2 1 4 1 L7 1 L7 6 L13 6 L13 1 L16 1 C18 1 20 3 20 5 L20 16 C20 18 18 20 16 20 L4 20 C2 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 3 18 4 18 L16 18 C17 18 18 17 18 16 L18 5 L13 5 L13 8 L7 8 L7 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="10" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="10" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">2</text>
                      </g>

                      {/* Stage 3 */}
                      <g transform="translate(88, 68)">
                        <path d="M0 5 C0 3 1.5 1 3 1 L5 1 L5 6 L10 6 L10 1 L13 1 L13 6 L18 6 L18 1 L20 1 C21.5 1 23 3 23 5 L23 16 C23 18 21.5 20 20 20 L3 20 C1.5 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 2.5 18 3.5 18 L19.5 18 C20.5 18 21 17 21 16 L21 5 L18 5 L18 8 L13 8 L13 5 L10 5 L10 8 L5 8 L5 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="11.5" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="11.5" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">3</text>
                      </g>

                      {/* Connecting dashed line from Stages to Card */}
                      <path d="M115 78 L126 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Middle Card: BTP Voucher */}
                      <rect x="130" y="60" width="28" height="36" rx="3.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.03))" />
                      <path d="M137 69 C135 69 133.5 67.5 133.5 66 C133.5 64.5 135 63 137 63 C138 61.5 140 61 142 62 C144 63 145 64.5 145 66 C146.5 66 148 67 148 69 Z" fill="#00a862" />
                      {/* Sync arrows */}
                      <path d="M139 74 L144 74 M144 74 L142 72 M144 74 L142 76" stroke="#00a862" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M145 77 L140 77 M140 77 L142 75 M140 77 L142 79" stroke="#00a862" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="144" cy="85" r="4" fill="#00a862" />
                      <text x="144" y="87.2" textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Connecting dashed line from Card to SL */}
                      <path d="M162 78 L171 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Green circle badge with "SL" */}
                      <circle cx="180" cy="78" r="9.5" fill="#00a862" />
                      <text x="180" y="81.5" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="800" fontFamily="sans-serif">SL</text>

                      {/* Connecting dashed line from SL to Calculator */}
                      <path d="M193 78 L202 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Right Calculator & Coin */}
                      <rect x="206" y="67" width="16" height="22" rx="2.5" fill="#00a862" />
                      <rect x="209" y="70" width="10" height="4.5" rx="0.8" fill="#ffffff" />
                      <circle cx="211" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="214" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="217" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="211" cy="82" r="0.9" fill="#ffffff" />
                      <circle cx="214" cy="82" r="0.9" fill="#ffffff" />
                      <circle cx="217" cy="82" r="0.9" fill="#ffffff" />

                      {/* Coin next to calculator */}
                      <circle cx="227" cy="81" r="5.5" fill="#00a862" />
                      <text x="227" y="83.8" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Rising dots above coin */}
                      <path d="M218 64 L224 59 L230 54" stroke="#00a862" strokeWidth="1.2" strokeDasharray="2 2" />
                      <circle cx="218" cy="64" r="1.8" fill="#00a862" />
                      <circle cx="224" cy="59" r="2.2" fill="#00a862" />
                      <circle cx="230" cy="54" r="2.6" fill="#00a862" />
                    </svg>

                    {/* Headline matching Screenshot 1 */}
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginTop: 24,
                        marginBottom: 18,
                        maxWidth: 680,
                        lineHeight: 1.4,
                      }}
                    >
                      Thống kê số lượng thành phần, bán thành phẩm của tất cả các công đoạn trong quy trình sản xuất
                    </div>

                    {/* Single action button: Thêm */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectQtyPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "7px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    {/* Bottom Centered Pill Button */}
                    <button
                      type="button"
                      onClick={() => setShowStepQtyList(true)}
                      style={{
                        marginTop: 48,
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        color: "#00a862",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 13,
                        fontWeight: 500,
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
                ) : (
                  /* Detail / List View when user has selected period or clicks Xem danh sách chứng từ */
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setShowStepQtyList(false)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                            Bảng thống kê số lượng thành phẩm, bán thành phẩm ({selectedQtyProcess.split(" - ")[0] || "QT-SOI-DET"})
                          </h3>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {selectedQtyPeriod}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setSelectQtyPeriodModalOpen(true)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Đổi kỳ / Quy trình
                        </button>
                        <button
                          type="button"
                          onClick={() => notify("Lấy số lượng thành phẩm hoàn thành từ Kho")}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Lấy từ Kho
                        </button>
                        <button
                          type="button"
                          onClick={() => notify("Thêm dòng thống kê")}
                          style={{
                            background: "#00a862",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 4,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Plus size={14} />
                          <span>Thêm dòng</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: "center" }}>STT</th>
                            <th style={{ width: 140 }}>Mã quy trình</th>
                            <th style={{ width: 180 }}>Công đoạn sản xuất</th>
                            <th style={{ width: 110 }}>Mã TP/BTP</th>
                            <th>Tên thành phẩm / Bán thành phẩm</th>
                            <th style={{ width: 70, textAlign: "center" }}>ĐVT</th>
                            <th style={{ width: 120, textAlign: "right" }}>SL hoàn thành</th>
                            <th style={{ width: 110, textAlign: "right" }}>SL dở dang</th>
                            <th style={{ width: 110, textAlign: "right" }}>% Hoàn thành</th>
                            <th style={{ width: 130, textAlign: "right" }}>Đơn giá BTP</th>
                            <th style={{ width: 140, textAlign: "right" }}>Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {
                              stt: 1,
                              processCode: "QT-SOI-DET",
                              stage: "Công đoạn 1: Kéo sợi",
                              itemCode: "BTP-SOI-40",
                              itemName: "Sợi cotton PE chải kỹ chi số 40s",
                              unit: "Kg",
                              completedQty: "15.000",
                              wipQty: "1.200",
                              wipPct: "60%",
                              unitPrice: 32000,
                              amount: 480000000,
                            },
                            {
                              stt: 2,
                              processCode: "QT-SOI-DET",
                              stage: "Công đoạn 2: Dệt vải",
                              itemCode: "BTP-VAI-MOC",
                              itemName: "Vải dệt mộc trơn khổ 1.6m",
                              unit: "Mét",
                              completedQty: "28.500",
                              wipQty: "2.500",
                              wipPct: "50%",
                              unitPrice: 24500,
                              amount: 698250000,
                            },
                            {
                              stt: 3,
                              processCode: "QT-SOI-DET",
                              stage: "Công đoạn 3: Nhuộm & Hoàn tất",
                              itemCode: "TP-VAI-NHUOM",
                              itemName: "Vải may mặc cao cấp nhuộm màu Navy",
                              unit: "Mét",
                              completedQty: "27.200",
                              wipQty: "1.300",
                              wipPct: "70%",
                              unitPrice: 38000,
                              amount: 1033600000,
                            },
                          ].map((row) => (
                            <tr key={row.stt}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td style={{ fontWeight: 600, color: "#2563eb" }}>{row.processCode}</td>
                              <td style={{ fontWeight: 600 }}>{row.stage}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.itemCode}</td>
                              <td>{row.itemName}</td>
                              <td style={{ textAlign: "center", color: "#64748b" }}>{row.unit}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#00a862" }}>{row.completedQty}</td>
                              <td style={{ textAlign: "right", color: "#d97706" }}>{row.wipQty}</td>
                              <td style={{ textAlign: "right" }}>{row.wipPct}</td>
                              <td style={{ textAlign: "right" }}>{formatMoney(row.unitPrice)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#1e293b" }}>{formatMoney(row.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 3. CHUYỂN CÔNG ĐOẠN (SCREENSHOT 1, 2) */}
            {stepSubtab === "transfer_stage" && (
              <>
                {!showStepStageTransferList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      width: "100%",
                      maxWidth: 750,
                      margin: "auto 0",
                    }}
                  >
                    {/* Centered Graphic Illustration matching Screenshot 1 */}
                    <svg width="250" height="140" viewBox="0 0 250 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Sparks & Stars */}
                      <path d="M198 34 L204 34 M201 31 L201 37" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="115" cy="42" r="1.5" fill="#94a3b8" />
                      <circle cx="216" cy="52" r="1.5" fill="#94a3b8" />
                      <path d="M68 116 L69 118.5 L71.5 119.5 L69 120.5 L68 123 L67 120.5 L64.5 119.5 L67 118.5 Z" fill="#00a862" />

                      {/* Soft cloud background */}
                      <path d="M110 65 C100 65 95 60 95 53 C95 46 100 40 108 40 C112 33 121 30 130 32 C140 34 147 41 149 48 C155 48 160 52 160 57 C160 64 155 65 148 65 Z" fill="#f8fafc" opacity="0.9" />
                      <ellipse cx="120" cy="115" rx="55" ry="8" fill="#f1f5f9" opacity="0.7" />

                      {/* 3 Process Stage Blocks */}
                      {/* Stage 1 */}
                      <g transform="translate(48, 68)">
                        <path d="M0 5 C0 3 2 1 4 1 L7 1 L7 6 L13 6 L13 1 L16 1 C18 1 20 3 20 5 L20 16 C20 18 18 20 16 20 L4 20 C2 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 3 18 4 18 L16 18 C17 18 18 17 18 16 L18 5 L13 5 L13 8 L7 8 L7 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="10" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="10" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">1</text>
                      </g>

                      {/* Stage 2 */}
                      <g transform="translate(76, 68)">
                        <path d="M0 5 C0 3 2 1 4 1 L7 1 L7 6 L13 6 L13 1 L16 1 C18 1 20 3 20 5 L20 16 C20 18 18 20 16 20 L4 20 C2 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 3 18 4 18 L16 18 C17 18 18 17 18 16 L18 5 L13 5 L13 8 L7 8 L7 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="10" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="10" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">2</text>
                      </g>

                      {/* Stage 3 */}
                      <g transform="translate(104, 68)">
                        <path d="M0 5 C0 3 1.5 1 3 1 L5 1 L5 6 L10 6 L10 1 L13 1 L13 6 L18 6 L18 1 L20 1 C21.5 1 23 3 23 5 L23 16 C23 18 21.5 20 20 20 L3 20 C1.5 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 2.5 18 3.5 18 L19.5 18 C20.5 18 21 17 21 16 L21 5 L18 5 L18 8 L13 8 L13 5 L10 5 L10 8 L5 8 L5 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="11.5" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="11.5" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">3</text>
                      </g>

                      {/* Connecting dashed line from Stages to Plus badge */}
                      <path d="M130 78 L146 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Green circle badge with "+" */}
                      <circle cx="156" cy="78" r="9.5" fill="#00a862" />
                      <path d="M152 78 L160 78 M156 74 L156 82" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

                      {/* Connecting dashed line from Plus to Calculator */}
                      <path d="M168 78 L180 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Right Calculator & Coin */}
                      <rect x="184" y="67" width="16" height="22" rx="2.5" fill="#00a862" />
                      <rect x="187" y="70" width="10" height="4.5" rx="0.8" fill="#ffffff" />
                      <circle cx="189" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="192" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="195" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="189" cy="82" r="0.9" fill="#ffffff" />
                      <circle cx="192" cy="82" r="0.9" fill="#ffffff" />
                      <circle cx="195" cy="82" r="0.9" fill="#ffffff" />

                      {/* Coin next to calculator */}
                      <circle cx="205" cy="81" r="5.5" fill="#00a862" />
                      <text x="205" y="83.8" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Rising dots above coin */}
                      <path d="M196 64 L202 59 L208 54" stroke="#00a862" strokeWidth="1.2" strokeDasharray="2 2" />
                      <circle cx="196" cy="64" r="1.8" fill="#00a862" />
                      <circle cx="202" cy="59" r="2.2" fill="#00a862" />
                      <circle cx="208" cy="54" r="2.6" fill="#00a862" />
                    </svg>

                    {/* Headline matching Screenshot 1 */}
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginTop: 24,
                        marginBottom: 18,
                        maxWidth: 680,
                        lineHeight: 1.4,
                      }}
                    >
                      Điều chuyển thành phẩm, bán thành phẩm từ công đoạn trước sang công đoạn sau để tiến hành tính giá thành
                    </div>

                    {/* Action button: Thêm */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectStageTransferPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "7px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    {/* Bottom Centered Pill Button */}
                    <button
                      type="button"
                      onClick={() => setShowStepStageTransferList(true)}
                      style={{
                        marginTop: 48,
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        color: "#00a862",
                        borderRadius: 20,
                        padding: "6px 20px",
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
                ) : (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setShowStepStageTransferList(false)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                            Chứng từ chuyển bán thành phẩm giữa các công đoạn sản xuất
                          </h3>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {selectedStageTransferPeriod || "Kỳ tính giá thành Tháng 10/2026"} {selectedStageTransferProcess ? `• ${selectedStageTransferProcess}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setSelectStageTransferPeriodModalOpen(true)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Đổi kỳ / Quy trình
                        </button>
                        <button
                          type="button"
                          onClick={() => notify("Lập chứng từ chuyển công đoạn mới")}
                          style={{
                            background: "#00a862",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 4,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Plus size={14} />
                          <span>Lập phiếu chuyển công đoạn</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: "center" }}>STT</th>
                            <th style={{ width: 100 }}>Ngày HT</th>
                            <th style={{ width: 110 }}>Số chứng từ</th>
                            <th>Từ công đoạn</th>
                            <th>Đến công đoạn</th>
                            <th style={{ width: 110 }}>Mã BTP</th>
                            <th>Tên bán thành phẩm</th>
                            <th style={{ width: 100, textAlign: "right" }}>Số lượng</th>
                            <th style={{ width: 120, textAlign: "right" }}>Đơn giá</th>
                            <th style={{ width: 140, textAlign: "right" }}>Thành tiền</th>
                            <th>Diễn giải</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {
                              stt: 1,
                              date: "15/10/2026",
                              docNo: "PCD0001",
                              fromStage: "Công đoạn 1: Kéo sợi",
                              toStage: "Công đoạn 2: Dệt vải",
                              itemCode: "BTP-SOI-40",
                              itemName: "Sợi cotton PE chải kỹ 40s",
                              qty: "15.000",
                              price: 32000,
                              amount: 480000000,
                              desc: "Chuyển sợi cọc sang tổ dệt máy kiếm mẻ T10",
                            },
                            {
                              stt: 2,
                              date: "22/10/2026",
                              docNo: "PCD0002",
                              fromStage: "Công đoạn 2: Dệt vải",
                              toStage: "Công đoạn 3: Nhuộm & Hoàn tất",
                              itemCode: "BTP-VAI-MOC",
                              itemName: "Vải dệt mộc trơn khổ 1.6m",
                              qty: "28.500",
                              price: 24500,
                              amount: 698250000,
                              desc: "Chuyển mộc dệt xong sang phân xưởng nhuộm cao áp",
                            },
                          ].map((row) => (
                            <tr key={row.stt}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td>{row.date}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.docNo}</td>
                              <td style={{ fontWeight: 500, color: "#1e293b" }}>{row.fromStage}</td>
                              <td style={{ fontWeight: 500, color: "#2563eb" }}>{row.toStage}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.itemCode}</td>
                              <td>{row.itemName}</td>
                              <td style={{ textAlign: "right", fontWeight: 600 }}>{row.qty}</td>
                              <td style={{ textAlign: "right" }}>{formatMoney(row.price)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatMoney(row.amount)}</td>
                              <td style={{ color: "#64748b", fontSize: 12 }}>{row.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 4. PHÂN BỔ CHI PHÍ CHUNG VỀ CÔNG ĐOẠN (SCREENSHOT 3, 4) */}
            {stepSubtab === "alloc_general" && (
              <>
                {!showStepAllocGeneralList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      width: "100%",
                      maxWidth: 750,
                      margin: "auto 0",
                    }}
                  >
                    {/* Centered Graphic Illustration matching Screenshot 3 */}
                    <svg width="270" height="140" viewBox="0 0 270 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Sparks & Stars */}
                      <path d="M208 34 L214 34 M211 31 L211 37" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="125" cy="42" r="1.5" fill="#94a3b8" />
                      <circle cx="226" cy="52" r="1.5" fill="#94a3b8" />
                      <path d="M58 116 L59 118.5 L61.5 119.5 L59 120.5 L58 123 L57 120.5 L54.5 119.5 L57 118.5 Z" fill="#00a862" />

                      {/* Soft cloud background */}
                      <path d="M130 65 C120 65 115 60 115 53 C115 46 120 40 128 40 C132 33 141 30 150 32 C160 34 167 41 169 48 C175 48 180 52 180 57 C180 64 175 65 168 65 Z" fill="#f8fafc" opacity="0.9" />
                      <ellipse cx="140" cy="115" rx="60" ry="8" fill="#f1f5f9" opacity="0.7" />

                      {/* Left: General Cost Card */}
                      <rect x="36" y="60" width="28" height="36" rx="3.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.03))" />
                      <path d="M43 69 C41 69 39.5 67.5 39.5 66 C39.5 64.5 41 63 43 63 C44 61.5 46 61 48 62 C50 63 51 64.5 51 66 C52.5 66 54 67 54 69 Z" fill="#00a862" />
                      <path d="M45 74 L50 74 M50 74 L48 72 M50 74 L48 76" stroke="#00a862" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="50" cy="85" r="4" fill="#00a862" />
                      <text x="50" y="87.2" textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Connecting dashed line from Card to Dollar Badge */}
                      <path d="M66 78 L78 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Green circle badge with "$" */}
                      <circle cx="86" cy="78" r="8" fill="#00a862" />
                      <text x="86" y="81" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Connecting dashed line from Dollar to Stages */}
                      <path d="M96 78 L108 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* 3 Process Stage Blocks */}
                      {/* Stage 1 */}
                      <g transform="translate(110, 68)">
                        <path d="M0 5 C0 3 2 1 4 1 L7 1 L7 6 L13 6 L13 1 L16 1 C18 1 20 3 20 5 L20 16 C20 18 18 20 16 20 L4 20 C2 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 3 18 4 18 L16 18 C17 18 18 17 18 16 L18 5 L13 5 L13 8 L7 8 L7 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="10" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="10" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">1</text>
                      </g>

                      {/* Stage 2 */}
                      <g transform="translate(138, 68)">
                        <path d="M0 5 C0 3 2 1 4 1 L7 1 L7 6 L13 6 L13 1 L16 1 C18 1 20 3 20 5 L20 16 C20 18 18 20 16 20 L4 20 C2 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 3 18 4 18 L16 18 C17 18 18 17 18 16 L18 5 L13 5 L13 8 L7 8 L7 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="10" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="10" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">2</text>
                      </g>

                      {/* Stage 3 */}
                      <g transform="translate(166, 68)">
                        <path d="M0 5 C0 3 1.5 1 3 1 L5 1 L5 6 L10 6 L10 1 L13 1 L13 6 L18 6 L18 1 L20 1 C21.5 1 23 3 23 5 L23 16 C23 18 21.5 20 20 20 L3 20 C1.5 20 0 18 0 16 Z" fill="#008f53" />
                        <path d="M2 5 L2 16 C2 17 2.5 18 3.5 18 L19.5 18 C20.5 18 21 17 21 16 L21 5 L18 5 L18 8 L13 8 L13 5 L10 5 L10 8 L5 8 L5 5 Z" fill="#00a862" opacity="0.4" />
                        <circle cx="11.5" cy="12" r="4.5" fill="#00a862" stroke="#ffffff" strokeWidth="1" />
                        <text x="11.5" y="14.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="700" fontFamily="sans-serif">3</text>
                      </g>

                      {/* Connecting dashed line from Stages to Plus badge */}
                      <path d="M192 78 L204 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Green circle badge with "+" */}
                      <circle cx="212" cy="78" r="8.5" fill="#00a862" />
                      <path d="M209 78 L215 78 M212 75 L212 81" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

                      {/* Connecting dashed line from Plus to Calculator */}
                      <path d="M222 78 L230 78" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Right Calculator & Coin */}
                      <rect x="232" y="67" width="16" height="22" rx="2.5" fill="#00a862" />
                      <rect x="235" y="70" width="10" height="4.5" rx="0.8" fill="#ffffff" />
                      <circle cx="237" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="240" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="243" cy="78" r="0.9" fill="#ffffff" />
                      <circle cx="237" cy="82" r="0.9" fill="#ffffff" />
                      <circle cx="240" cy="82" r="0.9" fill="#ffffff" />
                      <circle cx="243" cy="82" r="0.9" fill="#ffffff" />

                      {/* Coin next to calculator */}
                      <circle cx="253" cy="81" r="5.5" fill="#00a862" />
                      <text x="253" y="83.8" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">$</text>

                      {/* Rising dots above coin */}
                      <path d="M244 64 L250 59 L256 54" stroke="#00a862" strokeWidth="1.2" strokeDasharray="2 2" />
                      <circle cx="244" cy="64" r="1.8" fill="#00a862" />
                      <circle cx="250" cy="59" r="2.2" fill="#00a862" />
                      <circle cx="256" cy="54" r="2.6" fill="#00a862" />
                    </svg>

                    {/* Headline matching Screenshot 3 */}
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginTop: 24,
                        marginBottom: 18,
                        maxWidth: 680,
                        lineHeight: 1.4,
                      }}
                    >
                      Phân bổ chi phí chung phát sinh trong kỳ cho các công đoạn của quy trình sản xuất để tiến hành tính giá thành
                    </div>

                    {/* Action button: Thêm */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectAllocGeneralPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "7px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    {/* Bottom Centered Pill Button */}
                    <button
                      type="button"
                      onClick={() => setShowStepAllocGeneralList(true)}
                      style={{
                        marginTop: 48,
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        color: "#00a862",
                        borderRadius: 20,
                        padding: "6px 20px",
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
                ) : (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setShowStepAllocGeneralList(false)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                            Phân bổ chi phí sản xuất chung (TK 627) về từng công đoạn
                          </h3>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {selectedAllocGeneralPeriod || "Kỳ tính giá thành Tháng 10/2026"} {selectedAllocGeneralProcess ? `• ${selectedAllocGeneralProcess}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setSelectAllocGeneralPeriodModalOpen(true)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Đổi kỳ / Quy trình
                        </button>
                        <button
                          type="button"
                          onClick={() => notify("Thực hiện phân bổ chi phí chung")}
                          style={{
                            background: "#00a862",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 4,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Calculator size={14} />
                          <span>Phân bổ chi phí</span>
                        </button>
                      </div>
                    </div>

                    {/* Summary stat cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "12px 16px", background: "#f8fafc" }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>Tổng CP 627 cần phân bổ</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#00a862", marginTop: 4 }}>96.500.000 đ</div>
                      </div>
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "12px 16px", background: "#f8fafc" }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>Tiêu thức phân bổ</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginTop: 4 }}>Chi phí nhân công trực tiếp (622)</div>
                      </div>
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "12px 16px", background: "#f8fafc" }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>Số công đoạn nhận phân bổ</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#2563eb", marginTop: 4 }}>3 công đoạn</div>
                      </div>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: "center" }}>STT</th>
                            <th style={{ width: 140 }}>Mã công đoạn</th>
                            <th>Tên công đoạn nhận phân bổ</th>
                            <th style={{ width: 160, textAlign: "right" }}>Chi phí NCTT căn cứ (đ)</th>
                            <th style={{ width: 110, textAlign: "right" }}>Tỷ lệ (%)</th>
                            <th style={{ width: 160, textAlign: "right" }}>Số tiền phân bổ (đ)</th>
                            <th style={{ width: 130, textAlign: "center" }}>Tài khoản nhận</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, code: "CD-01", name: "Công đoạn 1: Kéo sợi", baseCost: 78000000, pct: "40.00%", allocAmount: 38600000, acc: "TK 1541" },
                            { stt: 2, code: "CD-02", name: "Công đoạn 2: Dệt vải", baseCost: 68250000, pct: "35.00%", allocAmount: 33775000, acc: "TK 1542" },
                            { stt: 3, code: "CD-03", name: "Công đoạn 3: Nhuộm & Hoàn tất", baseCost: 48750000, pct: "25.00%", allocAmount: 24125000, acc: "TK 1543" },
                          ].map((row) => (
                            <tr key={row.stt}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                              <td style={{ fontWeight: 500 }}>{row.name}</td>
                              <td style={{ textAlign: "right" }}>{formatMoney(row.baseCost)}</td>
                              <td style={{ textAlign: "right", fontWeight: 600, color: "#2563eb" }}>{row.pct}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatMoney(row.allocAmount)}</td>
                              <td style={{ textAlign: "center", fontWeight: 600, color: "#1e293b" }}>{row.acc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 5. KẾT CHUYỂN CHI PHÍ (SCREENSHOT 5) */}
            {stepSubtab === "transfer_cost" && (
              <>
                {!showStepTransferList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      width: "100%",
                      maxWidth: 750,
                      margin: "auto 0",
                    }}
                  >
                    {/* Bar chart illustration for Transfer */}
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M48 35L49.5 39L53.5 40.5L49.5 42L48 46L46.5 42L42.5 40.5L46.5 39L48 35Z" fill="#94a3b8" opacity="0.6"/>
                      <path d="M185 32L186.5 36L190.5 37.5L186.5 39L185 43L183.5 39L179.5 37.5L183.5 36L185 32Z" fill="#10b981"/>
                      <path d="M192 90L193 93L196 94L193 95L192 98L191 95L188 94L191 93L192 90Z" fill="#94a3b8" opacity="0.5"/>
                      <path d="M42 95L43.5 98L46.5 99.5L43.5 101L42 104L40.5 101L37.5 99.5L40.5 98L42 95Z" fill="#10b981"/>

                      <path d="M70 70 C60 70 54 64 54 56 C54 48 60 42 68 42 C72 34 82 30 92 32 C102 34 110 42 112 50 C118 50 124 54 124 60 C124 68 118 70 110 70 Z" fill="#f1f5f9" opacity="0.8"/>
                      <ellipse cx="110" cy="124" rx="55" ry="10" fill="#e2e8f0" opacity="0.7"/>

                      <path d="M72 100 L148 100 C154 100 158 104 156 110 L152 118 C150 122 144 124 138 124 L82 124 C76 124 70 122 68 118 L64 110 C62 104 66 100 72 100 Z" fill="#00a862"/>
                      <path d="M72 100 L148 100 C154 100 156 103 154 107 L66 107 C64 103 66 100 72 100 Z" fill="#10b981"/>

                      <rect x="74" y="62" width="34" height="42" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1"/>
                      <text x="79" y="74" fill="#64748b" fontSize="8" fontWeight="600" fontFamily="sans-serif">621</text>
                      <text x="79" y="85" fill="#64748b" fontSize="8" fontWeight="600" fontFamily="sans-serif">622</text>
                      <text x="79" y="96" fill="#64748b" fontSize="8" fontWeight="600" fontFamily="sans-serif">627</text>

                      <path d="M96 66 L118 66 L118 72 L124 64 L118 56 L118 62 L96 62 Z" fill="#00a862"/>
                      <text x="127" y="67" fill="#00a862" fontSize="9" fontWeight="700" fontFamily="sans-serif">154</text>

                      <rect x="115" y="86" width="7" height="14" rx="1.5" fill="#10b981"/>
                      <rect x="125" y="78" width="7" height="22" rx="1.5" fill="#059669"/>
                      <rect x="135" y="70" width="7" height="30" rx="1.5" fill="#047857"/>
                    </svg>

                    {/* Headline matching Screenshot 5 */}
                    <div
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginTop: 24,
                        marginBottom: 18,
                        maxWidth: 720,
                        lineHeight: 1.45,
                      }}
                    >
                      Kết chuyển toàn bộ chi phí sản xuất đã phát sinh trong kỳ từ TK 621, 622, 627 sang TK 154 theo từng công đoạn và chi phí bán thành phẩm điều chuyển giữa các công đoạn
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectStepPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "7px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowStepTransferList(true)}
                      style={{
                        marginTop: 48,
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        color: "#00a862",
                        borderRadius: 20,
                        padding: "6px 20px",
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
                ) : (
                  /* Transfer vouchers table */
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setShowStepTransferList(false)}
                          style={{
                            padding: "6px 14px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách chứng từ kết chuyển chi phí (Sản xuất liên tục - Phân bước)
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectStepPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={14} />
                        <span>Thêm chứng từ kết chuyển</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Ngày HT</th>
                            <th style={{ width: 110 }}>Số chứng từ</th>
                            <th>Diễn giải</th>
                            <th style={{ width: 90, textAlign: "center" }}>TK Nợ</th>
                            <th style={{ width: 110, textAlign: "center" }}>TK Có</th>
                            <th style={{ width: 140, textAlign: "right" }}>Số tiền</th>
                            <th>Quy trình sản xuất</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stepTransferVouchers.length === 0 ? (
                            <tr>
                              <td colSpan={8} style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                                Chưa có chứng từ kết chuyển chi phí nào. Bấm <b>Thêm chứng từ kết chuyển</b> để thực hiện.
                              </td>
                            </tr>
                          ) : (
                            stepTransferVouchers.map((v, idx) => (
                              <tr key={v.id}>
                                <td style={{ textAlign: "center" }}>{idx + 1}</td>
                                <td>{v.postDate}</td>
                                <td style={{ fontWeight: 600, color: "#00a862" }}>{v.docNo}</td>
                                <td>{v.desc}</td>
                                <td style={{ textAlign: "center", fontWeight: 600 }}>{v.debitAcc}</td>
                                <td style={{ textAlign: "center", color: "#64748b" }}>{v.creditAcc}</td>
                                <td style={{ textAlign: "right", fontWeight: 700, color: "#00a862" }}>
                                  {formatMoney(v.amount)}
                                </td>
                                <td>{v.processName}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ==================================================================== */}
      {/* 2C. CÔNG TRÌNH (PROJECTS) */}
      {/* ==================================================================== */}
      {currentTab === "projects" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1400, margin: "0 auto" }}>
          {/* Guide Banner */}
          {showProjectBanner && (
            <div
              style={{
                background: "#e6f4ff",
                border: "1px solid #91caff",
                borderRadius: 4,
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#0958d9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span>Bạn chưa biết tính giá thành trên phần mềm? Hãy cùng xem hướng dẫn sau đây nhé!</span>
                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  style={{
                    background: "#1677ff",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Xem hướng dẫn
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectBanner(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8c8c8c" }}
                title="Đóng"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Subtabs Bar & Body Container */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              minHeight: 520,
            }}
          >
            {/* Subtabs Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid #e2e8f0",
                padding: "0 16px",
                gap: 24,
                background: "#ffffff",
              }}
            >
              {[
                { id: "period", label: "Kỳ tính giá" },
                { id: "transfer", label: "Kết chuyển chi phí" },
                { id: "acceptance", label: "Nghiệm thu công trình" },
                { id: "norm", label: "Định mức nguyên vật liệu" },
                { id: "estimate", label: "Dự toán công trình" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProjectSubtab(tab.id as any)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom: projectSubtab === tab.id ? "2px solid #00a862" : "2px solid transparent",
                    color: projectSubtab === tab.id ? "#00a862" : "#475569",
                    fontWeight: projectSubtab === tab.id ? 600 : 500,
                    fontSize: 13,
                    padding: "12px 4px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Subtab 1: Kỳ tính giá */}
            {projectSubtab === "period" && (
              <>
                {!showProjectPeriodList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    {/* Isometric Cube Illustration */}
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M48 35L49.5 39L53.5 40.5L49.5 42L48 46L46.5 42L42.5 40.5L46.5 39L48 35Z" fill="#94a3b8" opacity="0.6"/>
                      <path d="M185 32L186.5 36L190.5 37.5L186.5 39L185 43L183.5 39L179.5 37.5L183.5 36L185 32Z" fill="#10b981"/>
                      <path d="M192 90L193 93L196 94L193 95L192 98L191 95L188 94L191 93L192 90Z" fill="#94a3b8" opacity="0.5"/>
                      <path d="M42 95L43.5 98L46.5 99.5L43.5 101L42 104L40.5 101L37.5 99.5L40.5 98L42 95Z" fill="#10b981"/>
                      <ellipse cx="110" cy="120" rx="42" ry="12" fill="#e2e8f0" opacity="0.8"/>
                      <polygon points="110,65 145,82 110,98 75,82" fill="#10b981" />
                      <polygon points="75,82 110,98 110,122 75,106" fill="#059669" />
                      <polygon points="110,98 145,82 145,106 110,122" fill="#047857" />
                      <line x1="110" y1="65" x2="110" y2="82" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.7"/>
                      <g transform="translate(68, 52)">
                        <path d="M12 20C9.8 20 8 18.2 8 16C8 14.3 9.1 12.9 10.6 12.3C10.4 11.6 10.3 10.8 10.3 10C10.3 6.1 13.4 3 17.3 3C20.4 3 23 5 23.9 7.8C24.6 7.3 25.5 7 26.5 7C29 7 31 9 31 11.5C31 11.9 30.9 12.3 30.8 12.6C32.7 13.5 34 15.5 34 17.8C34 20.7 31.7 23 28.8 23L12 23" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.2"/>
                        <circle cx="21" cy="13" r="8" fill="#10b981"/>
                        <text x="21" y="16.5" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">$</text>
                      </g>
                      <path d="M96 68 Q 104 74 108 78" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2"/>
                      <circle cx="108" cy="78" r="2" fill="#10b981"/>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Thêm kỳ tính giá thành để tập hợp chi phí và tính giá thành cho từng công trình
                    </h4>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setAddProjectPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>

                      {/* Tiện ích Dropdown Button */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setProjectUtilityDropdownOpen(!projectUtilityDropdownOpen)}
                          style={{
                            background: "#ffffff",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>Tiện ích</span>
                          <ChevronDown size={14} color="#64748b" />
                        </button>

                        {projectUtilityDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              marginTop: 4,
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                              minWidth: 240,
                              zIndex: 50,
                              padding: "4px 0",
                              textAlign: "left",
                            }}
                          >
                            {[
                              { label: "Chi phí dở dang đầu kỳ", action: () => { setOpeningWipModalOpen(true); setProjectUtilityDropdownOpen(false); } },
                              { label: "Khai báo định mức giá thành", action: () => { setNormCostModalOpen(true); setProjectUtilityDropdownOpen(false); } },
                              { label: "Khai báo định mức phân bổ chi phí", action: () => { setNormAllocModalOpen(true); setProjectUtilityDropdownOpen(false); } },
                              { label: "Khai báo giá thành kế hoạch", action: () => { setPlannedCostModalOpen(true); setProjectUtilityDropdownOpen(false); } },
                            ].map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={item.action}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "8px 16px",
                                  border: "none",
                                  background: "none",
                                  fontSize: 13,
                                  color: "#334155",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Secondary Link Button */}
                    <button
                      type="button"
                      onClick={() => setShowProjectPeriodList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  /* Data Table View for Project Periods */
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowProjectPeriodList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách kỳ tính giá thành công trình
                        </h4>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setAddProjectPeriodModalOpen(true)}
                          style={{
                            background: "#00a862",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 4,
                            padding: "6px 14px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Plus size={15} />
                          <span>Thêm kỳ tính giá</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 120 }}>Mã kỳ</th>
                            <th>Tên kỳ tính giá thành</th>
                            <th style={{ width: 100 }}>Từ ngày</th>
                            <th style={{ width: 100 }}>Đến ngày</th>
                            <th style={{ width: 130, textAlign: "center" }}>Số công trình</th>
                            <th style={{ width: 130, textAlign: "right" }}>Dở dang ĐK</th>
                            <th style={{ width: 130, textAlign: "right" }}>CP phát sinh</th>
                            <th style={{ width: 130, textAlign: "right" }}>Dở dang CK</th>
                            <th style={{ width: 140, textAlign: "right" }}>Tổng giá thành</th>
                            <th style={{ width: 110, textAlign: "center" }}>Trạng thái</th>
                            <th style={{ width: 110, textAlign: "center" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {
                              id: "1",
                              code: "KGT-CT-2026-10",
                              name: "Kỳ tính giá thành công trình Tháng 10/2026",
                              from: "01/10/2026",
                              to: "31/10/2026",
                              count: 3,
                              opening: 120000000,
                              incurred: 850000000,
                              ending: 950000000,
                              total: 875000000,
                              status: "Đang tính",
                            },
                            {
                              id: "2",
                              code: "KGT-CT-2026-09",
                              name: "Kỳ tính giá thành công trình Tháng 09/2026",
                              from: "01/09/2026",
                              to: "30/09/2026",
                              count: 4,
                              opening: 90000000,
                              incurred: 1150000000,
                              ending: 120000000,
                              total: 1120000000,
                              status: "Đã hoàn thành",
                            },
                          ].map((item, idx) => (
                            <tr key={item.id}>
                              <td style={{ textAlign: "center" }}>{idx + 1}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                              <td style={{ fontWeight: 500 }}>{item.name}</td>
                              <td>{item.from}</td>
                              <td>{item.to}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{item.count} công trình</td>
                              <td style={{ textAlign: "right" }}>{formatMoney(item.opening)}</td>
                              <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(item.incurred)}</td>
                              <td style={{ textAlign: "right", color: "#d97706" }}>{formatMoney(item.ending)}</td>
                              <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(item.total)}</td>
                              <td style={{ textAlign: "center" }}>
                                <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: item.status === "Đã hoàn thành" ? "#dcfce7" : "#fef3c7", color: item.status === "Đã hoàn thành" ? "#166534" : "#b45309" }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => notify(`Mở thẻ giá thành ${item.code}`)}
                                  style={{ background: "none", border: "none", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Thẻ giá thành
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subtab 2: Kết chuyển chi phí */}
            {projectSubtab === "transfer" && (
              <>
                {!showProjectTransferList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M48 35L49.5 39L53.5 40.5L49.5 42L48 46L46.5 42L42.5 40.5L46.5 39L48 35Z" fill="#94a3b8" opacity="0.6"/>
                      <path d="M185 32L186.5 36L190.5 37.5L186.5 39L185 43L183.5 39L179.5 37.5L183.5 36L185 32Z" fill="#10b981"/>
                      <ellipse cx="110" cy="120" rx="42" ry="12" fill="#e2e8f0" opacity="0.8"/>
                      <polygon points="110,65 145,82 110,98 75,82" fill="#10b981" />
                      <polygon points="75,82 110,98 110,122 75,106" fill="#059669" />
                      <polygon points="110,98 145,82 145,106 110,122" fill="#047857" />
                      <line x1="110" y1="65" x2="110" y2="82" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.7"/>
                      <g transform="translate(68, 52)">
                        <path d="M12 20C9.8 20 8 18.2 8 16C8 14.3 9.1 12.9 10.6 12.3C10.4 11.6 10.3 10.8 10.3 10C10.3 6.1 13.4 3 17.3 3C20.4 3 23 5 23.9 7.8C24.6 7.3 25.5 7 26.5 7C29 7 31 9 31 11.5C31 11.9 30.9 12.3 30.8 12.6C32.7 13.5 34 15.5 34 17.8C34 20.7 31.7 23 28.8 23L12 23" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.2"/>
                        <circle cx="21" cy="13" r="8" fill="#10b981"/>
                        <text x="21" y="16.5" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">$</text>
                      </g>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Kết chuyển toàn bộ chi phí sản xuất đã phát sinh trong kỳ từ TK 621, 622, 627 sang TK 154 theo từng công trình
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectProjectTransferPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowProjectTransferList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowProjectTransferList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách chứng từ kết chuyển chi phí (TK 621, 622, 627 sang TK 154)
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectProjectTransferPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm chứng từ kết chuyển</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Ngày HT</th>
                            <th style={{ width: 120 }}>Số chứng từ</th>
                            <th>Diễn giải</th>
                            <th style={{ width: 90, textAlign: "center" }}>TK Nợ</th>
                            <th style={{ width: 110, textAlign: "center" }}>TK Có</th>
                            <th style={{ width: 140, textAlign: "right" }}>Số tiền</th>
                            <th>Công trình</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, date: "31/10/2026", code: "PKC-CT-001", desc: "Kết chuyển chi phí SX công trình Sky Tower", dr: "154", cr: "621, 622, 627", amount: 450000000, project: "CT-SKYTOWER - Sky Tower" },
                            { stt: 2, date: "31/10/2026", code: "PKC-CT-002", desc: "Kết chuyển chi phí SX công trình Vinhomes Ocean", dr: "154", cr: "621, 622, 627", amount: 280000000, project: "CT-VIN-OCEAN - Vinhomes Ocean Park" },
                            { stt: 3, date: "31/10/2026", code: "PKC-CT-003", desc: "Kết chuyển chi phí SX công trình Cầu Nhật Tân", dr: "154", cr: "621, 622, 627", amount: 120000000, project: "CT-CAU-NHATHAN - Cầu Nhật Tân" },
                          ].map((row) => (
                            <tr key={row.code}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td>{row.date}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                              <td>{row.desc}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{row.dr}</td>
                              <td style={{ textAlign: "center", color: "#64748b" }}>{row.cr}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatMoney(row.amount)}</td>
                              <td>{row.project}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subtab 3: Nghiệm thu công trình */}
            {projectSubtab === "acceptance" && (
              <>
                {!showProjectAcceptanceList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="50" y="35" width="120" height="85" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
                      <rect x="65" y="50" width="90" height="10" rx="3" fill="#00a862" opacity="0.8"/>
                      <rect x="65" y="68" width="60" height="8" rx="2" fill="#94a3b8" opacity="0.5"/>
                      <rect x="65" y="82" width="75" height="8" rx="2" fill="#94a3b8" opacity="0.5"/>
                      <circle cx="155" cy="95" r="16" fill="#00a862"/>
                      <path d="M149 95 L153 99 L162 90" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Kết chuyển giá thành sản xuất công trình đã hoàn thành sang giá vốn (TK 632) theo biên bản nghiệm thu công trình
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setProjectAcceptanceModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowProjectAcceptanceList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowProjectAcceptanceList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách nghiệm thu công trình (TK 154 sang TK 632)
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setProjectAcceptanceModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm nghiệm thu công trình</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Ngày nghiệm thu</th>
                            <th style={{ width: 120 }}>Số chứng từ</th>
                            <th style={{ width: 130 }}>Mã công trình</th>
                            <th>Tên công trình</th>
                            <th style={{ width: 150, textAlign: "right" }}>Doanh thu</th>
                            <th style={{ width: 150, textAlign: "right" }}>Giá vốn kết chuyển</th>
                            <th style={{ width: 100, textAlign: "center" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, date: "28/10/2026", code: "NT-CT-001", pcode: "CT-SKYTOWER", pname: "Tòa nhà Sky Tower Discovery Complex", rev: 1250000000, cogs: 850000000 },
                            { stt: 2, date: "15/10/2026", code: "NT-CT-002", pcode: "CT-VIN-OCEAN", pname: "Khu đô thị Vinhomes Ocean Park phân khu 2", rev: 600000000, cogs: 420000000 },
                          ].map((row) => (
                            <tr key={row.code}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td>{row.date}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                              <td style={{ fontWeight: 600 }}>{row.pcode}</td>
                              <td>{row.pname}</td>
                              <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(row.rev)}</td>
                              <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(row.cogs)}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => notify(`Xem biên bản nghiệm thu ${row.code}`)}
                                  style={{ background: "none", border: "none", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Chi tiết
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subtab 4: Định mức nguyên vật liệu */}
            {projectSubtab === "norm" && (
              <>
                {!showProjectNormList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="50" y="30" width="120" height="95" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
                      <line x1="65" y1="48" x2="155" y2="48" stroke="#cbd5e1" strokeWidth="1.5"/>
                      <rect x="65" y="58" width="50" height="6" rx="2" fill="#00a862"/>
                      <rect x="125" y="58" width="30" height="6" rx="2" fill="#94a3b8"/>
                      <rect x="65" y="72" width="40" height="6" rx="2" fill="#00a862"/>
                      <rect x="125" y="72" width="30" height="6" rx="2" fill="#94a3b8"/>
                      <rect x="65" y="86" width="60" height="6" rx="2" fill="#00a862"/>
                      <rect x="125" y="86" width="30" height="6" rx="2" fill="#94a3b8"/>
                      <circle cx="150" cy="108" r="14" fill="#0284c7"/>
                      <text x="150" y="112" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">%</text>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Khai báo định mức nguyên vật liệu cho từng công trình để quản lý xuất dùng vật tư thực tế so với định mức
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setAddProjectNormModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowProjectNormList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowProjectNormList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách định mức nguyên vật liệu công trình
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAddProjectNormModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm định mức NVL</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 120 }}>Mã định mức</th>
                            <th style={{ width: 130 }}>Mã công trình</th>
                            <th>Tên công trình</th>
                            <th style={{ width: 120, textAlign: "center" }}>Số lượng NVL</th>
                            <th style={{ width: 160, textAlign: "right" }}>Tổng tiền định mức</th>
                            <th style={{ width: 110, textAlign: "center" }}>Từ ngày</th>
                            <th style={{ width: 110, textAlign: "center" }}>Đến ngày</th>
                            <th style={{ width: 100, textAlign: "center" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, code: "ĐM-CT-01", pcode: "CT-SKYTOWER", pname: "Tòa nhà Sky Tower Discovery Complex", count: 8, total: 1850000000, from: "01/10/2026", to: "31/12/2026" },
                            { stt: 2, code: "ĐM-CT-02", pcode: "CT-VIN-OCEAN", pname: "Khu đô thị Vinhomes Ocean Park phân khu 2", count: 5, total: 920000000, from: "01/10/2026", to: "31/12/2026" },
                          ].map((row) => (
                            <tr key={row.code}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                              <td style={{ fontWeight: 600 }}>{row.pcode}</td>
                              <td>{row.pname}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{row.count} vật tư</td>
                              <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(row.total)}</td>
                              <td style={{ textAlign: "center" }}>{row.from}</td>
                              <td style={{ textAlign: "center" }}>{row.to}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => notify(`Xem chi tiết định mức ${row.code}`)}
                                  style={{ background: "none", border: "none", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
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
              </>
            )}

            {/* Subtab 5: Dự toán công trình */}
            {projectSubtab === "estimate" && (
              <>
                {!showProjectEstimateList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    {/* Graphic: House card $ -> curve -> VS -> curve -> building card $ */}
                    <svg width="340" height="130" viewBox="0 0 340 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="20" y="25" width="80" height="75" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
                      <path d="M40 70 L40 55 L60 40 L80 55 L80 70 Z" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5"/>
                      <rect x="52" y="58" width="16" height="12" fill="#ffffff" stroke="#0284c7" strokeWidth="1"/>
                      <circle cx="82" cy="35" r="10" fill="#10b981"/>
                      <text x="82" y="39" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">$</text>
                      <text x="60" y="88" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="500">Dự toán</text>

                      <path d="M105 60 C 120 45, 130 50, 145 60" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>

                      <rect x="150" y="47" width="40" height="26" rx="13" fill="#e2e8f0"/>
                      <text x="170" y="64" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="700">VS</text>

                      <path d="M195 60 C 210 70, 220 75, 235 60" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>

                      <rect x="240" y="25" width="80" height="75" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
                      <rect x="260" y="42" width="40" height="28" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5"/>
                      <line x1="268" y1="48" x2="274" y2="48" stroke="#16a34a" strokeWidth="1.5"/>
                      <line x1="286" y1="48" x2="292" y2="48" stroke="#16a34a" strokeWidth="1.5"/>
                      <line x1="268" y1="58" x2="274" y2="58" stroke="#16a34a" strokeWidth="1.5"/>
                      <line x1="286" y1="58" x2="292" y2="58" stroke="#16a34a" strokeWidth="1.5"/>
                      <circle cx="302" cy="35" r="10" fill="#00a862"/>
                      <text x="302" y="39" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">$</text>
                      <text x="280" y="88" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="500">Thực tế</text>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Khai báo dự toán chi phí cho từng công trình để theo dõi chi phí thực tế so với dự toán
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => notify("Mở giao diện lập dự toán chi phí công trình")}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>
                      <button
                        type="button"
                        onClick={() => notify("Nhập dự toán công trình từ Excel")}
                        style={{
                          background: "#ffffff",
                          color: "#334155",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          padding: "8px 16px",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <FileSpreadsheet size={15} color="#16a34a" />
                        <span>Nhập từ Excel</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowProjectEstimateList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowProjectEstimateList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách dự toán chi phí công trình
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => notify("Thêm dự toán công trình")}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm dự toán</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 130 }}>Mã công trình</th>
                            <th>Tên công trình</th>
                            <th>Hạng mục dự toán</th>
                            <th style={{ width: 160, textAlign: "right" }}>Dự toán chi phí</th>
                            <th style={{ width: 160, textAlign: "right" }}>Chi phí thực tế</th>
                            <th style={{ width: 150, textAlign: "right" }}>Chênh lệch</th>
                            <th style={{ width: 120, textAlign: "center" }}>Tỷ lệ TH</th>
                            <th style={{ width: 100, textAlign: "center" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, pcode: "CT-SKYTOWER", pname: "Tòa nhà Sky Tower Discovery Complex", desc: "Dự toán gói thầu xây thô và hoàn thiện cơ điện", est: 4500000000, act: 3850000000, diff: -650000000, pct: "85.6%" },
                            { stt: 2, pcode: "CT-VIN-OCEAN", pname: "Khu đô thị Vinhomes Ocean Park phân khu 2", desc: "Dự toán san nền và đường giao thông nội khu", est: 2100000000, act: 1980000000, diff: -120000000, pct: "94.3%" },
                          ].map((row) => (
                            <tr key={row.pcode}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.pcode}</td>
                              <td style={{ fontWeight: 500 }}>{row.pname}</td>
                              <td>{row.desc}</td>
                              <td style={{ textAlign: "right", fontWeight: 600 }}>{formatMoney(row.est)}</td>
                              <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(row.act)}</td>
                              <td style={{ textAlign: "right", color: row.diff < 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{formatMoney(row.diff)}</td>
                              <td style={{ textAlign: "center", fontWeight: 600, color: "#00a862" }}>{row.pct}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => notify(`Xem bảng đối chiếu dự toán ${row.pcode}`)}
                                  style={{ background: "none", border: "none", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Đối chiếu
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2D. ĐƠN HÀNG (ORDERS) */}
      {/* ==================================================================== */}
      {currentTab === "orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1400, margin: "0 auto" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              minHeight: 520,
            }}
          >
            {/* Header with Subtabs on left & Link on right */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                padding: "0 16px",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {[
                  { id: "period", label: "Kỳ tính giá" },
                  { id: "transfer", label: "Kết chuyển chi phí" },
                  { id: "acceptance", label: "Nghiệm thu đơn hàng" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOrderSubtab(tab.id as any)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom: orderSubtab === tab.id ? "2px solid #00a862" : "2px solid transparent",
                      color: orderSubtab === tab.id ? "#00a862" : "#475569",
                      fontWeight: orderSubtab === tab.id ? 600 : 500,
                      fontSize: 13,
                      padding: "12px 4px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Link on Right */}
              <button
                type="button"
                onClick={() => notify("Mở bảng theo dõi lũy kế phát sinh cho đơn hàng các kỳ trước")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#00a862",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "underline",
                }}
              >
                <span>Lũy kế phát sinh cho đơn hàng kỳ trước</span>
              </button>
            </div>

            {/* Subtab 1: Kỳ tính giá */}
            {orderSubtab === "period" && (
              <>
                {!showOrderPeriodList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M48 35L49.5 39L53.5 40.5L49.5 42L48 46L46.5 42L42.5 40.5L46.5 39L48 35Z" fill="#94a3b8" opacity="0.6"/>
                      <path d="M185 32L186.5 36L190.5 37.5L186.5 39L185 43L183.5 39L179.5 37.5L183.5 36L185 32Z" fill="#10b981"/>
                      <ellipse cx="110" cy="120" rx="42" ry="12" fill="#e2e8f0" opacity="0.8"/>
                      <polygon points="110,65 145,82 110,98 75,82" fill="#10b981" />
                      <polygon points="75,82 110,98 110,122 75,106" fill="#059669" />
                      <polygon points="110,98 145,82 145,106 110,122" fill="#047857" />
                      <line x1="110" y1="65" x2="110" y2="82" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.7"/>
                      <g transform="translate(68, 52)">
                        <path d="M12 20C9.8 20 8 18.2 8 16C8 14.3 9.1 12.9 10.6 12.3C10.4 11.6 10.3 10.8 10.3 10C10.3 6.1 13.4 3 17.3 3C20.4 3 23 5 23.9 7.8C24.6 7.3 25.5 7 26.5 7C29 7 31 9 31 11.5C31 11.9 30.9 12.3 30.8 12.6C32.7 13.5 34 15.5 34 17.8C34 20.7 31.7 23 28.8 23L12 23" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.2"/>
                        <circle cx="21" cy="13" r="8" fill="#10b981"/>
                        <text x="21" y="16.5" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">$</text>
                      </g>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Thêm kỳ tính giá thành để tập hợp chi phí và tính giá thành cho từng đơn hàng
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setAddOrderPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>

                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setOrderUtilityDropdownOpen(!orderUtilityDropdownOpen)}
                          style={{
                            background: "#ffffff",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>Tiện ích</span>
                          <ChevronDown size={14} color="#64748b" />
                        </button>

                        {orderUtilityDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              marginTop: 4,
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                              minWidth: 240,
                              zIndex: 50,
                              padding: "4px 0",
                              textAlign: "left",
                            }}
                          >
                            {[
                              { label: "Chi phí dở dang đầu kỳ", action: () => { setOpeningWipModalOpen(true); setOrderUtilityDropdownOpen(false); } },
                              { label: "Khai báo định mức giá thành", action: () => { setNormCostModalOpen(true); setOrderUtilityDropdownOpen(false); } },
                              { label: "Khai báo định mức phân bổ chi phí", action: () => { setNormAllocModalOpen(true); setOrderUtilityDropdownOpen(false); } },
                              { label: "Khai báo giá thành kế hoạch", action: () => { setPlannedCostModalOpen(true); setOrderUtilityDropdownOpen(false); } },
                            ].map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={item.action}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "8px 16px",
                                  border: "none",
                                  background: "none",
                                  fontSize: 13,
                                  color: "#334155",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowOrderPeriodList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowOrderPeriodList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách kỳ tính giá thành đơn hàng
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAddOrderPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm kỳ tính giá</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 120 }}>Mã kỳ</th>
                            <th>Tên kỳ tính giá thành</th>
                            <th style={{ width: 100 }}>Từ ngày</th>
                            <th style={{ width: 100 }}>Đến ngày</th>
                            <th style={{ width: 130, textAlign: "center" }}>Số đơn hàng</th>
                            <th style={{ width: 150, textAlign: "right" }}>CP phát sinh</th>
                            <th style={{ width: 150, textAlign: "right" }}>Tổng giá thành</th>
                            <th style={{ width: 110, textAlign: "center" }}>Trạng thái</th>
                            <th style={{ width: 110, textAlign: "center" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { id: "1", code: "KGT-DH-2026-10", name: "Kỳ tính giá thành đơn hàng Tháng 10/2026", from: "01/10/2026", to: "31/10/2026", count: 3, incurred: 415000000, total: 398000000, status: "Đang tính" },
                            { id: "2", code: "KGT-DH-2026-09", name: "Kỳ tính giá thành đơn hàng Tháng 09/2026", from: "01/09/2026", to: "30/09/2026", count: 5, incurred: 680000000, total: 680000000, status: "Đã hoàn thành" },
                          ].map((item, idx) => (
                            <tr key={item.id}>
                              <td style={{ textAlign: "center" }}>{idx + 1}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                              <td style={{ fontWeight: 500 }}>{item.name}</td>
                              <td>{item.from}</td>
                              <td>{item.to}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{item.count} đơn hàng</td>
                              <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(item.incurred)}</td>
                              <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(item.total)}</td>
                              <td style={{ textAlign: "center" }}>
                                <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: item.status === "Đã hoàn thành" ? "#dcfce7" : "#fef3c7", color: item.status === "Đã hoàn thành" ? "#166534" : "#b45309" }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => notify(`Mở thẻ giá thành ${item.code}`)}
                                  style={{ background: "none", border: "none", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Thẻ giá thành
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subtab 2: Kết chuyển chi phí */}
            {orderSubtab === "transfer" && (
              <>
                {!showOrderTransferList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="110,65 145,82 110,98 75,82" fill="#10b981" />
                      <polygon points="75,82 110,98 110,122 75,106" fill="#059669" />
                      <polygon points="110,98 145,82 145,106 110,122" fill="#047857" />
                      <circle cx="110" cy="50" r="14" fill="#00a862"/>
                      <text x="110" y="55" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">154</text>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Kết chuyển toàn bộ chi phí sản xuất đã phát sinh trong kỳ từ TK 621, 622, 627 sang TK 154 theo từng đơn hàng
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectOrderTransferPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowOrderTransferList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowOrderTransferList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách chứng từ kết chuyển chi phí theo đơn hàng
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectOrderTransferPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm chứng từ kết chuyển</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Ngày HT</th>
                            <th style={{ width: 120 }}>Số chứng từ</th>
                            <th>Diễn giải</th>
                            <th style={{ width: 90, textAlign: "center" }}>TK Nợ</th>
                            <th style={{ width: 110, textAlign: "center" }}>TK Có</th>
                            <th style={{ width: 140, textAlign: "right" }}>Số tiền</th>
                            <th>Đơn hàng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, date: "31/10/2026", code: "PKC-DH-001", desc: "Kết chuyển chi phí SX theo đơn hàng DH2026-0089", dr: "154", cr: "621, 622, 627", amount: 165000000, order: "DH2026-0089 - Công ty TNHH Á Châu" },
                            { stt: 2, date: "31/10/2026", code: "PKC-DH-002", desc: "Kết chuyển chi phí SX theo đơn hàng DH2026-0092", dr: "154", cr: "621, 622, 627", amount: 233000000, order: "DH2026-0092 - Tập đoàn Hòa Bình" },
                          ].map((row) => (
                            <tr key={row.code}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td>{row.date}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                              <td>{row.desc}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{row.dr}</td>
                              <td style={{ textAlign: "center", color: "#64748b" }}>{row.cr}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatMoney(row.amount)}</td>
                              <td>{row.order}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subtab 3: Nghiệm thu đơn hàng */}
            {orderSubtab === "acceptance" && (
              <>
                {!showOrderAcceptanceList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="50" y="35" width="120" height="85" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
                      <circle cx="110" cy="70" r="22" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5"/>
                      <path d="M100 70 L107 77 L122 62" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="70" y="100" width="80" height="8" rx="2" fill="#94a3b8" opacity="0.6"/>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Kết chuyển giá thành sản xuất đơn hàng hoàn thành sang giá vốn (TK 632) theo đơn hàng
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setOrderAcceptanceModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowOrderAcceptanceList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowOrderAcceptanceList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách nghiệm thu đơn hàng (TK 154 sang TK 632)
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setOrderAcceptanceModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm nghiệm thu đơn hàng</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Ngày nghiệm thu</th>
                            <th style={{ width: 120 }}>Số chứng từ</th>
                            <th style={{ width: 130 }}>Số đơn hàng</th>
                            <th>Khách hàng</th>
                            <th style={{ width: 150, textAlign: "right" }}>Doanh thu</th>
                            <th style={{ width: 150, textAlign: "right" }}>Giá vốn kết chuyển</th>
                            <th style={{ width: 100, textAlign: "center" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, date: "25/10/2026", code: "NT-DH-001", order: "DH2026-0089", customer: "Công ty TNHH Á Châu", rev: 245000000, cogs: 165000000 },
                          ].map((row) => (
                            <tr key={row.code}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td>{row.date}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                              <td style={{ fontWeight: 600 }}>{row.order}</td>
                              <td>{row.customer}</td>
                              <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(row.rev)}</td>
                              <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(row.cogs)}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => notify(`Xem biên bản nghiệm thu ${row.code}`)}
                                  style={{ background: "none", border: "none", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Chi tiết
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2E. HỢP ĐỒNG (CONTRACTS) */}
      {/* ==================================================================== */}
      {currentTab === "contracts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1400, margin: "0 auto" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              minHeight: 520,
            }}
          >
            {/* Header with Subtabs on left & Link on right */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                padding: "0 16px",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {[
                  { id: "period", label: "Kỳ tính giá" },
                  { id: "transfer", label: "Kết chuyển chi phí" },
                  { id: "acceptance", label: "Nghiệm thu hợp đồng" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setContractSubtab(tab.id as any)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom: contractSubtab === tab.id ? "2px solid #00a862" : "2px solid transparent",
                      color: contractSubtab === tab.id ? "#00a862" : "#475569",
                      fontWeight: contractSubtab === tab.id ? 600 : 500,
                      fontSize: 13,
                      padding: "12px 4px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Link on Right */}
              <button
                type="button"
                onClick={() => notify("Mở bảng theo dõi lũy kế phát sinh cho hợp đồng các kỳ trước")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#00a862",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "underline",
                }}
              >
                <span>Lũy kế phát sinh cho hợp đồng kỳ trước</span>
              </button>
            </div>

            {/* Subtab 1: Kỳ tính giá */}
            {contractSubtab === "period" && (
              <>
                {!showContractPeriodList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="110,65 145,82 110,98 75,82" fill="#10b981" />
                      <polygon points="75,82 110,98 110,122 75,106" fill="#059669" />
                      <polygon points="110,98 145,82 145,106 110,122" fill="#047857" />
                      <circle cx="110" cy="50" r="14" fill="#00a862"/>
                      <text x="110" y="55" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">HĐ</text>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Thêm kỳ tính giá thành để tập hợp chi phí và tính giá thành cho từng hợp đồng
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setAddContractPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>

                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => setContractUtilityDropdownOpen(!contractUtilityDropdownOpen)}
                          style={{
                            background: "#ffffff",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>Tiện ích</span>
                          <ChevronDown size={14} color="#64748b" />
                        </button>

                        {contractUtilityDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              marginTop: 4,
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                              minWidth: 240,
                              zIndex: 50,
                              padding: "4px 0",
                              textAlign: "left",
                            }}
                          >
                            {[
                              { label: "Chi phí dở dang đầu kỳ", action: () => { setOpeningWipModalOpen(true); setContractUtilityDropdownOpen(false); } },
                              { label: "Khai báo định mức giá thành", action: () => { setNormCostModalOpen(true); setContractUtilityDropdownOpen(false); } },
                              { label: "Khai báo định mức phân bổ chi phí", action: () => { setNormAllocModalOpen(true); setContractUtilityDropdownOpen(false); } },
                              { label: "Khai báo giá thành kế hoạch", action: () => { setPlannedCostModalOpen(true); setContractUtilityDropdownOpen(false); } },
                            ].map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={item.action}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "8px 16px",
                                  border: "none",
                                  background: "none",
                                  fontSize: 13,
                                  color: "#334155",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowContractPeriodList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowContractPeriodList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách kỳ tính giá thành hợp đồng
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAddContractPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm kỳ tính giá</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 120 }}>Mã kỳ</th>
                            <th>Tên kỳ tính giá thành</th>
                            <th style={{ width: 100 }}>Từ ngày</th>
                            <th style={{ width: 100 }}>Đến ngày</th>
                            <th style={{ width: 130, textAlign: "center" }}>Số hợp đồng</th>
                            <th style={{ width: 150, textAlign: "right" }}>CP phát sinh</th>
                            <th style={{ width: 150, textAlign: "right" }}>Tổng giá thành</th>
                            <th style={{ width: 110, textAlign: "center" }}>Trạng thái</th>
                            <th style={{ width: 110, textAlign: "center" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { id: "1", code: "KGT-HD-2026-10", name: "Kỳ tính giá thành hợp đồng Tháng 10/2026", from: "01/10/2026", to: "31/10/2026", count: 2, incurred: 620000000, total: 580000000, status: "Đang tính" },
                            { id: "2", code: "KGT-HD-2026-09", name: "Kỳ tính giá thành hợp đồng Tháng 09/2026", from: "01/09/2026", to: "30/09/2026", count: 3, incurred: 890000000, total: 890000000, status: "Đã hoàn thành" },
                          ].map((item, idx) => (
                            <tr key={item.id}>
                              <td style={{ textAlign: "center" }}>{idx + 1}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                              <td style={{ fontWeight: 500 }}>{item.name}</td>
                              <td>{item.from}</td>
                              <td>{item.to}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{item.count} hợp đồng</td>
                              <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(item.incurred)}</td>
                              <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(item.total)}</td>
                              <td style={{ textAlign: "center" }}>
                                <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: item.status === "Đã hoàn thành" ? "#dcfce7" : "#fef3c7", color: item.status === "Đã hoàn thành" ? "#166534" : "#b45309" }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => notify(`Mở thẻ giá thành ${item.code}`)}
                                  style={{ background: "none", border: "none", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Thẻ giá thành
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subtab 2: Kết chuyển chi phí */}
            {contractSubtab === "transfer" && (
              <>
                {!showContractTransferList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    {/* Graphic: voucher cards 621, 622, 627 -> curved green arrow -> 154 chart */}
                    <svg width="320" height="130" viewBox="0 0 320 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="20" y="25" width="90" height="80" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5"/>
                      <rect x="30" y="35" width="70" height="18" rx="4" fill="#fee2e2"/>
                      <text x="65" y="48" textAnchor="middle" fill="#dc2626" fontSize="11" fontWeight="600">TK 621, 622</text>
                      <rect x="30" y="58" width="70" height="18" rx="4" fill="#fef3c7"/>
                      <text x="65" y="71" textAnchor="middle" fill="#d97706" fontSize="11" fontWeight="600">TK 627 (SXC)</text>
                      <text x="65" y="93" textAnchor="middle" fill="#64748b" fontSize="10">Chi phí SXKD</text>

                      <path d="M120 65 Q 160 30 200 65" stroke="#00a862" strokeWidth="2.5" fill="none"/>
                      <polygon points="196,58 206,67 197,73" fill="#00a862"/>

                      <rect x="210" y="25" width="90" height="80" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5"/>
                      <circle cx="255" cy="55" r="20" fill="#00a862"/>
                      <text x="255" y="60" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">154</text>
                      <text x="255" y="93" textAnchor="middle" fill="#15803d" fontSize="10" fontWeight="600">Dở dang HĐ</text>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Kết chuyển toàn bộ chi phí sản xuất đã phát sinh trong kỳ từ TK 621, 622, 627 sang TK 154 theo từng hợp đồng bán
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectContractTransferPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowContractTransferList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowContractTransferList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách chứng từ kết chuyển chi phí theo hợp đồng
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectContractTransferPeriodModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm chứng từ kết chuyển</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Ngày HT</th>
                            <th style={{ width: 120 }}>Số chứng từ</th>
                            <th>Diễn giải</th>
                            <th style={{ width: 90, textAlign: "center" }}>TK Nợ</th>
                            <th style={{ width: 110, textAlign: "center" }}>TK Có</th>
                            <th style={{ width: 140, textAlign: "right" }}>Số tiền</th>
                            <th>Hợp đồng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, date: "31/10/2026", code: "PKC-HD-001", desc: "Kết chuyển chi phí thực hiện hợp đồng HD-2026/042", dr: "154", cr: "621, 622, 627", amount: 340000000, contract: "HD-2026/042 - Techcombank" },
                            { stt: 2, date: "31/10/2026", code: "PKC-HD-002", desc: "Kết chuyển chi phí thực hiện hợp đồng HD-2026/045", dr: "154", cr: "621, 622, 627", amount: 240000000, contract: "HD-2026/045 - Vina Industry" },
                          ].map((row) => (
                            <tr key={row.code}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td>{row.date}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                              <td>{row.desc}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{row.dr}</td>
                              <td style={{ textAlign: "center", color: "#64748b" }}>{row.cr}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatMoney(row.amount)}</td>
                              <td>{row.contract}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subtab 3: Nghiệm thu hợp đồng */}
            {contractSubtab === "acceptance" && (
              <>
                {!showContractAcceptanceList ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "48px 20px",
                      margin: "auto",
                      maxWidth: 680,
                    }}
                  >
                    {/* Graphic: voucher card 154 -> curved green arrow -> 632 chart */}
                    <svg width="320" height="130" viewBox="0 0 320 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="20" y="25" width="90" height="80" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5"/>
                      <circle cx="65" cy="55" r="20" fill="#00a862"/>
                      <text x="65" y="60" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">154</text>
                      <text x="65" y="93" textAnchor="middle" fill="#15803d" fontSize="10" fontWeight="600">Chi phí SXKD</text>

                      <path d="M120 65 Q 160 30 200 65" stroke="#00a862" strokeWidth="2.5" fill="none"/>
                      <polygon points="196,58 206,67 197,73" fill="#00a862"/>

                      <rect x="210" y="25" width="90" height="80" rx="8" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1.5"/>
                      <circle cx="255" cy="55" r="20" fill="#2563eb"/>
                      <text x="255" y="60" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">632</text>
                      <text x="255" y="93" textAnchor="middle" fill="#1d4ed8" fontSize="10" fontWeight="600">Giá vốn HĐ</text>
                    </svg>

                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "16px 0 20px 0" }}>
                      Kết chuyển giá vốn hợp đồng từ TK 154 sang TK 632 khi thực hiện nghiệm thu hợp đồng
                    </h4>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setContractAcceptanceModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "8px 24px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                        }}
                      >
                        Thêm
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowContractAcceptanceList(true)}
                      style={{
                        marginTop: 20,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 20,
                        padding: "6px 20px",
                        fontSize: 12.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Xem danh sách chứng từ
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setShowContractAcceptanceList(false)}
                          style={{
                            background: "none",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 13,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ← Quay lại giao diện chính
                        </button>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                          Danh sách nghiệm thu hợp đồng (TK 154 sang TK 632)
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setContractAcceptanceModalOpen(true)}
                        style={{
                          background: "#00a862",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={15} />
                        <span>Thêm nghiệm thu hợp đồng</span>
                      </button>
                    </div>

                    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                      <table className="misa-purchase-table" style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ width: 45, textAlign: "center" }}>STT</th>
                            <th style={{ width: 110 }}>Ngày nghiệm thu</th>
                            <th style={{ width: 120 }}>Số chứng từ</th>
                            <th style={{ width: 130 }}>Số hợp đồng</th>
                            <th>Khách hàng</th>
                            <th style={{ width: 150, textAlign: "right" }}>Doanh thu</th>
                            <th style={{ width: 150, textAlign: "right" }}>Giá vốn kết chuyển</th>
                            <th style={{ width: 100, textAlign: "center" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { stt: 1, date: "30/10/2026", code: "NT-HD-001", contract: "HD-2026/042", customer: "Ngân hàng Techcombank", rev: 520000000, cogs: 340000000 },
                          ].map((row) => (
                            <tr key={row.code}>
                              <td style={{ textAlign: "center" }}>{row.stt}</td>
                              <td>{row.date}</td>
                              <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                              <td style={{ fontWeight: 600 }}>{row.contract}</td>
                              <td>{row.customer}</td>
                              <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(row.rev)}</td>
                              <td style={{ textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(row.cogs)}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => notify(`Xem biên bản nghiệm thu ${row.code}`)}
                                  style={{ background: "none", border: "none", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Chi tiết
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. REPORTS TAB (BÁO CÁO GIÁ THÀNH) */}
      {/* ==================================================================== */}
      {currentTab === "reports" && (
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Top Filter & Search Toolbar */}
          <div
            style={{
              background: "#ffffff",
              padding: "10px 16px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {/* Left: Search input */}
            <div style={{ position: "relative", minWidth: 320 }}>
              <Search size={15} color="#94a3b8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Tìm theo tên báo cáo..."
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            {/* Right: AVA AI, Language, Visibility */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* AVA Kế toán button */}
              <button
                type="button"
                onClick={() => notify("AVA Kế toán: Đang tìm kiếm các báo cáo giá thành tối ưu cho bạn...")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 20,
                  background: "linear-gradient(135deg, #eff6ff 0%, #ede9fe 100%)",
                  border: "1px solid #c7d2fe",
                  color: "#4f46e5",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={14} color="#6366f1" />
                <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
              </button>

              {/* Language Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
                <span>Ngôn ngữ báo cáo:</span>
                <select
                  value={reportLanguage}
                  onChange={(e) => {
                    setReportLanguage(e.target.value);
                    notify(`Đã chuyển ngôn ngữ báo cáo sang: ${e.target.value}`);
                  }}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <option value="Tiếng Việt">Tiếng Việt</option>
                  <option value="English">English</option>
                </select>
              </div>

              {/* Show/Hide reports button */}
              <button
                type="button"
                onClick={() => notify("Mở tùy chỉnh Ẩn/hiện danh mục báo cáo")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 4,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                <SlidersHorizontal size={14} color="#64748b" />
                <span>Ẩn/hiện báo cáo</span>
              </button>
            </div>
          </div>

          {/* Section 1: Yêu thích (Favorite Reports) */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Star size={16} color="#eab308" fill="#eab308" />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Yêu thích</span>
            </div>

            <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {favoriteReportList.map((title, idx) => (
                <div
                  key={idx}
                  onClick={() => notify(`Mở báo cáo: ${title}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 4,
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#00a862";
                    e.currentTarget.style.background = "#f0fdf4";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.background = "#ffffff";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileText size={16} color="#00a862" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFavoriteReportList(favoriteReportList.filter((t) => t !== title));
                      notify(`Đã bỏ ${title} khỏi danh sách yêu thích`);
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                    title="Bỏ yêu thích"
                  >
                    <Star size={15} color="#eab308" fill="#eab308" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Sản xuất liên tục (Continuous Production - 10 reports matching screenshot) */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setReportSectionsOpen({ ...reportSectionsOpen, continuous: !reportSectionsOpen.continuous })}
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                borderBottom: reportSectionsOpen.continuous ? "1px solid #e2e8f0" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Sản xuất liên tục</span>
              <ChevronDown
                size={16}
                color="#64748b"
                style={{
                  transform: reportSectionsOpen.continuous ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>

            {reportSectionsOpen.continuous && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  "S36-DN: Sổ chi phí sản xuất, kinh doanh",
                  "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí",
                  "Bảng tổng hợp chi phí sản xuất kinh doanh",
                  "Sổ chi tiết tài khoản theo đối tượng THCP",
                  "Bảng kê phiếu nhập kho, xuất kho theo đối tượng THCP",
                  "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo khoản mục chi phí",
                  "Sổ chi tiết tài khoản theo đối tượng THCP và khoản mục chi phí",
                  "Bảng tính giá thành sản phẩm",
                  "Bảng tổng hợp chi phí sản xuất theo yếu tố",
                  "Báo cáo tổng hợp nhập xuất kho thành phẩm theo đối tượng THCP",
                ]
                  .filter((title) => !reportSearchQuery || title.toLowerCase().includes(reportSearchQuery.toLowerCase()))
                  .map((title, idx) => {
                    const isFav = favoriteReportList.includes(title);
                    return (
                      <div
                        key={idx}
                        onClick={() => notify(`Mở báo cáo: ${title}`)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: 4,
                          border: "1px solid #e2e8f0",
                          background: "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#00a862";
                          e.currentTarget.style.background = "#f0fdf4";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#e2e8f0";
                          e.currentTarget.style.background = "#ffffff";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <FileText size={16} color="#00a862" />
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isFav) {
                              setFavoriteReportList(favoriteReportList.filter((t) => t !== title));
                            } else {
                              setFavoriteReportList([...favoriteReportList, title]);
                            }
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                          title={isFav ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                        >
                          <Star size={15} color={isFav ? "#eab308" : "#cbd5e1"} fill={isFav ? "#eab308" : "none"} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Section 3: Giá thành công trình */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setReportSectionsOpen({ ...reportSectionsOpen, projects: !reportSectionsOpen.projects })}
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                borderBottom: reportSectionsOpen.projects ? "1px solid #e2e8f0" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Giá thành công trình</span>
              <ChevronDown
                size={16}
                color="#64748b"
                style={{
                  transform: reportSectionsOpen.projects ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>

            {reportSectionsOpen.projects && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  "S38-DN: Sổ chi phí đầu tư xây dựng",
                  "Báo cáo tổng hợp chi phí theo công trình",
                  "Báo cáo lãi lỗ theo công trình hoàn thành",
                  "Bảng đối chiếu dự toán và chi phí thực tế công trình",
                  "Bảng kê chi phí công trình theo yếu tố",
                ]
                  .filter((title) => !reportSearchQuery || title.toLowerCase().includes(reportSearchQuery.toLowerCase()))
                  .map((title, idx) => (
                    <div
                      key={idx}
                      onClick={() => notify(`Mở báo cáo: ${title}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 4,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00a862")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FileText size={16} color="#00a862" />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{title}</span>
                      </div>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Section 4: Giá thành đơn hàng */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setReportSectionsOpen({ ...reportSectionsOpen, orders: !reportSectionsOpen.orders })}
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                borderBottom: reportSectionsOpen.orders ? "1px solid #e2e8f0" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Giá thành đơn hàng</span>
              <ChevronDown
                size={16}
                color="#64748b"
                style={{
                  transform: reportSectionsOpen.orders ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>

            {reportSectionsOpen.orders && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  "Báo cáo giá thành theo từng đơn đặt hàng",
                  "Báo cáo tổng hợp chi phí sản xuất theo đơn hàng",
                  "Báo cáo phân tích lãi lỗ theo đơn đặt hàng",
                ]
                  .filter((title) => !reportSearchQuery || title.toLowerCase().includes(reportSearchQuery.toLowerCase()))
                  .map((title, idx) => (
                    <div
                      key={idx}
                      onClick={() => notify(`Mở báo cáo: ${title}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 4,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00a862")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FileText size={16} color="#00a862" />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{title}</span>
                      </div>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Section 5: Giá thành hợp đồng */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setReportSectionsOpen({ ...reportSectionsOpen, contracts: !reportSectionsOpen.contracts })}
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                borderBottom: reportSectionsOpen.contracts ? "1px solid #e2e8f0" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Giá thành hợp đồng</span>
              <ChevronDown
                size={16}
                color="#64748b"
                style={{
                  transform: reportSectionsOpen.contracts ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>

            {reportSectionsOpen.contracts && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  "Báo cáo lãi lỗ gộp theo từng hợp đồng kinh tế",
                  "Báo cáo tổng hợp chi phí thực hiện hợp đồng",
                  "Sổ chi tiết chi phí theo hợp đồng",
                ]
                  .filter((title) => !reportSearchQuery || title.toLowerCase().includes(reportSearchQuery.toLowerCase()))
                  .map((title, idx) => (
                    <div
                      key={idx}
                      onClick={() => notify(`Mở báo cáo: ${title}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 4,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00a862")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FileText size={16} color="#00a862" />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{title}</span>
                      </div>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Section 6: Báo cáo đối chiếu */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setReportSectionsOpen({ ...reportSectionsOpen, reconciliation: !reportSectionsOpen.reconciliation })}
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                borderBottom: reportSectionsOpen.reconciliation ? "1px solid #e2e8f0" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Báo cáo đối chiếu</span>
              <ChevronDown
                size={16}
                color="#64748b"
                style={{
                  transform: reportSectionsOpen.reconciliation ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>

            {reportSectionsOpen.reconciliation && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  "Đối chiếu chi phí sản xuất giữa sổ cái và sổ chi tiết",
                  "Đối chiếu phát sinh tài khoản 154 với giá thành nhập kho",
                ]
                  .filter((title) => !reportSearchQuery || title.toLowerCase().includes(reportSearchQuery.toLowerCase()))
                  .map((title, idx) => (
                    <div
                      key={idx}
                      onClick={() => notify(`Mở báo cáo: ${title}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 4,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00a862")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FileText size={16} color="#00a862" />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{title}</span>
                      </div>
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* 4. MODALS & POPUPS */}
      {/* ==================================================================== */}

      {/* Modal Video Hướng Dẫn */}
      {videoModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 700,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                Video hướng dẫn: {currentSubtabData.headerTitle}
              </h3>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: 24, textAlign: "center", background: "#0f172a", color: "#ffffff" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#ef4444",
                  display: "grid",
                  placeItems: "center",
                  margin: "20px auto 14px auto",
                  cursor: "pointer",
                }}
              >
                <Play size={28} color="#ffffff" fill="#ffffff" />
              </div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 16, color: "#f8fafc" }}>
                {currentSubtabData.videoTopLabel} {currentSubtabData.videoMainTitle}
              </h4>
              <p style={{ fontSize: 13, color: "#94a3b8", maxWidth: 500, margin: "0 auto 20px auto" }}>
                Xem video chi tiết từ chuyên gia MISA để nắm vững toàn bộ các bước tập hợp chi phí, phân bổ và tính giá thành chuẩn quy định.
              </p>
            </div>
            <div style={{ padding: "12px 18px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
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

      {/* Modal Bài Viết Hướng Dẫn */}
      {articleModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 750,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Tài liệu hướng dẫn: {currentSubtabData.headerTitle}
              </h3>
              <button
                type="button"
                onClick={() => setArticleModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: "20px 24px", fontSize: 13.5, lineHeight: 1.6, color: "#334155" }}>
              <h4 style={{ color: "#00a862", marginTop: 0 }}>I. Nguyên tắc tính giá thành</h4>
              <p>
                Phương pháp tính giá thành {currentSubtabData.label} áp dụng cho các doanh nghiệp có quy trình sản xuất liên tục, sản phẩm được hoàn thành tuần tự và khối lượng sản phẩm sản xuất ra lớn.
              </p>
              <h4 style={{ color: "#00a862" }}>II. Trình tự hạch toán</h4>
              <ol style={{ paddingLeft: 20 }}>
                <li><b>Tập hợp chi phí trực tiếp:</b> NVL trực tiếp (TK 621), Nhân công trực tiếp (TK 622).</li>
                <li><b>Tập hợp & phân bổ chi phí SXC:</b> Chi phí máy thi công, khấu hao, dịch vụ mua ngoài (TK 627).</li>
                <li><b>Đánh giá dở dang cuối kỳ:</b> Xác định giá trị SP dở dang theo NVL trực tiếp hoặc sản lượng tương đương.</li>
                <li><b>Tính tổng giá thành và giá thành đơn vị:</b> Giá thành = Dở dang ĐK + Phát sinh trong kỳ - Dở dang CK.</li>
                <li><b>Kết chuyển sang TK 154 và nhập kho TK 155.</b></li>
              </ol>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setArticleModalOpen(false)}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal FAQ / Troubleshooting */}
      {faqModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 700,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0284c7" }}>
                Một số nguyên nhân tính giá thành sai số liệu & Cách xử lý
              </h3>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                {
                  q: "1. Tại sao giá thành đơn vị bị âm hoặc bằng 0?",
                  a: "Nguyên nhân do chưa xuất kho nguyên vật liệu (chưa hạch toán Nợ 621), hoặc chưa nhập số lượng thành phẩm nhập kho ở bước Nhập kho thành phẩm.",
                },
                {
                  q: "2. Tại sao chi phí sản xuất chung (TK 627) không được phân bổ?",
                  a: "Do chưa chọn tiêu thức phân bổ chi phí chung (ví dụ: theo Chi phí NVL trực tiếp, theo Chi phí nhân công trực tiếp) hoặc các đối tượng THCP không có tiêu thức phát sinh tương ứng.",
                },
                {
                  q: "3. Chi phí dở dang cuối kỳ bị chênh lệch so với thực tế kiểm kê?",
                  a: "Kiểm tra lại phương pháp đánh giá dở dang cuối kỳ. Nếu doanh nghiệp có dở dang lớn về nhân công, nên chọn đánh giá theo sản lượng hoàn thành tương đương thay vì chỉ theo NVL trực tiếp.",
                },
                {
                  q: "4. Chưa kết chuyển chi phí từ 621, 622, 627 sang TK 154?",
                  a: "Sau khi tính xong bước 8, kế toán bắt buộc phải thực hiện bước 9 'Kết chuyển chi phí' để phần mềm tự động sinh chứng từ kết chuyển sang 154 và 632.",
                },
              ].map((item, i) => (
                <div key={i} style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1e293b", marginBottom: 4 }}>
                    {item.q}
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                    {item.a}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
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

      {/* Modal Khoản Mục Chi Phí */}
      {costItemsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 700,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Danh mục Khoản mục chi phí
              </h3>
              <button
                type="button"
                onClick={() => setCostItemsModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <table className="misa-purchase-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Mã KMCP</th>
                    <th>Tên khoản mục chi phí</th>
                    <th style={{ width: 140 }}>Thuộc loại</th>
                    <th style={{ width: 110 }}>Tài khoản ngầm định</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { code: "NVL_TT", name: "Chi phí nguyên vật liệu trực tiếp", type: "NVL trực tiếp", acc: "621" },
                    { code: "NCONG_TT", name: "Chi phí nhân công trực tiếp", type: "Nhân công", acc: "622" },
                    { code: "SXC_NVL", name: "Chi phí vật liệu sản xuất chung", type: "Sản xuất chung", acc: "6272" },
                    { code: "SXC_KHAO", name: "Chi phí khấu hao máy móc thiết bị", type: "Sản xuất chung", acc: "6274" },
                    { code: "SXC_DVMN", name: "Chi phí dịch vụ mua ngoài phục vụ SX", type: "Sản xuất chung", acc: "6277" },
                    { code: "SXC_TIEN", name: "Chi phí khác bằng tiền tại phân xưởng", type: "Sản xuất chung", acc: "6278" },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.type}</td>
                      <td style={{ fontWeight: 600 }}>{row.acc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setCostItemsModalOpen(false)}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
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

      {/* Modal Tiện ích Giá Thành */}
      {utilitiesModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 600,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Các tiện ích Giá thành
              </h3>
              <button
                type="button"
                onClick={() => setUtilitiesModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { title: "Phân bổ chi phí chung (TK 627) tự động", desc: "Tự động phân bổ theo tỷ lệ NVL trực tiếp, nhân công hoặc doanh thu định mức" },
                { title: "Đánh giá SP dở dang cuối kỳ tự động", desc: "Tính nhanh dở dang theo tỷ lệ phần trăm hoàn thành tương đương" },
                { title: "Kiểm tra hạch toán chi phí chưa gắn đối tượng THCP", desc: "Phát hiện chứng từ chi phí 621, 622, 627 chưa chỉ định đối tượng tập hợp chi phí" },
                { title: "Kiểm tra định mức tiêu hao nguyên vật liệu", desc: "Cảnh báo nguyên vật liệu xuất vượt định mức sản xuất theo tiêu chuẩn" },
              ].map((item, i) => (
                <div
                  key={i}
                  onClick={() => {
                    notify(`Đã kích hoạt: ${item.title}`);
                    setUtilitiesModalOpen(false);
                  }}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafc")}
                >
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "#00a862", marginBottom: 3 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>{item.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setUtilitiesModalOpen(false)}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
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

      {/* Modal AVA AI Gợi ý phương pháp tính giá */}
      {avaModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              width: "100%",
              maxWidth: 650,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              border: "1px solid #ddd6fe",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "linear-gradient(90deg, #f5f3ff 0%, #faf5ff 100%)",
                borderBottom: "1px solid #ede9fe",
                borderRadius: "10px 10px 0 0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={20} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#5b21b6" }}>
                  Trợ lý AVA: Gợi ý Phương pháp Tính giá thành Tối ưu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAvaModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: "#374151" }}>
                Dựa trên loại hình sản xuất kinh doanh của bạn, AVA khuyến nghị các phương pháp phù hợp nhất:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ border: "1px solid #a7f3d0", background: "#f0fdf4", padding: "12px 14px", borderRadius: 6 }}>
                  <div style={{ fontWeight: 700, color: "#065f46", fontSize: 14, marginBottom: 2 }}>
                    ✓ Sản xuất liên tục - Giản đơn (Được khuyến nghị cao nhất)
                  </div>
                  <div style={{ fontSize: 12.5, color: "#047857" }}>
                    Phù hợp nếu doanh nghiệp sản xuất một hoặc ít loại sản phẩm với số lượng lớn, quy trình công nghệ giản đơn (như chế biến thực phẩm, may mặc đơn chiếc, cơ khí gia công lặp lại).
                  </div>
                </div>

                <div style={{ border: "1px solid #e0e7ff", background: "#f5f7ff", padding: "12px 14px", borderRadius: 6 }}>
                  <div style={{ fontWeight: 700, color: "#3730a3", fontSize: 14, marginBottom: 2 }}>
                    ✓ Sản xuất liên tục - Hệ số, tỷ lệ
                  </div>
                  <div style={{ fontSize: 12.5, color: "#4338ca" }}>
                    Phù hợp khi cùng một quy trình công nghệ và cùng nguyên vật liệu nhưng tạo ra đồng thời nhiều quy cách sản phẩm khác nhau (như ống nhựa các phi, may mặc nhiều size, giày dép).
                  </div>
                </div>

                <div style={{ border: "1px solid #fef3c7", background: "#fffbeb", padding: "12px 14px", borderRadius: 6 }}>
                  <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14, marginBottom: 2 }}>
                    ✓ Theo Đơn hàng hoặc Hợp đồng
                  </div>
                  <div style={{ fontSize: 12.5, color: "#b45309" }}>
                    Phù hợp cho doanh nghiệp gia công theo đơn đặt hàng riêng biệt của từng khách hàng hoặc theo từng dự án / gói thầu công trình.
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #ede9fe", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setAvaModalOpen(false)}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  background: "#7c3aed",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Áp dụng gợi ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Giới thiệu các phương pháp tính giá */}
      {methodsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 760,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Giới thiệu 6 Phương pháp Tính giá thành trong AMIS Kế toán
              </h3>
              <button
                type="button"
                onClick={() => setMethodsModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { name: "1. Sản xuất liên tục - Giản đơn", desc: "Áp dụng cho quy trình sản xuất khép kín, số lượng mặt hàng ít, chu kỳ sản xuất ngắn. Tổng giá thành = Dở dang ĐK + Chi phí phát sinh - Dở dang CK." },
                { name: "2. Sản xuất liên tục - Hệ số, tỷ lệ", desc: "Áp dụng khi cùng một quy trình công nghệ tạo ra nhiều quy cách sản phẩm khác nhau. Quy đổi sản phẩm về sản phẩm tiêu chuẩn theo hệ số hoặc tỷ lệ giá thành." },
                { name: "3. Sản xuất liên tục - Phân bước", desc: "Áp dụng cho quy trình công nghệ phức tạp gồm nhiều giai đoạn (bước) kế tiếp nhau. Nửa thành phẩm bước trước là nguyên liệu bước sau." },
                { name: "4. Tính giá thành theo Công trình", desc: "Tập hợp toàn bộ chi phí nguyên vật liệu, nhân công, máy thi công và chi phí chung cho từng hạng mục công trình đến khi nghiệm thu bàn giao." },
                { name: "5. Tính giá thành theo Đơn hàng", desc: "Tập hợp chi phí theo từng đơn đặt hàng cụ thể của khách hàng, giá thành được tính khi đơn hàng hoàn thành." },
                { name: "6. Tính giá thành theo Hợp đồng", desc: "Tập hợp chi phí và xác định giá thành theo từng hợp đồng kinh tế ký kết với đối tác." },
              ].map((m, i) => (
                <div key={i} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#00a862", marginBottom: 3 }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{m.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setMethodsModalOpen(false)}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
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

      {/* Modal Step Detail (Interactive Step Popups) */}
      {activeStepModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 620,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {(() => {
                const currentStepItem = [...currentSubtabData.row1, ...currentSubtabData.row2].find(
                  (s) => s.step === activeStepModal
                );
                return (
                  <>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#00a862" }}>
                      {currentStepItem?.title}
                    </h3>
                  </>
                );
              })()}
              <button
                type="button"
                onClick={() => setActiveStepModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: "20px 24px", fontSize: 13.5, lineHeight: 1.5, color: "#334155" }}>
              <p style={{ margin: "0 0 16px 0", color: "#64748b" }}>
                {[...currentSubtabData.row1, ...currentSubtabData.row2].find(
                  (s) => s.step === activeStepModal
                )?.desc}
              </p>

              {activeStepModal === 1 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Thao tác nghiệp vụ:</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    <li>Vào phân hệ <b>Kho</b> &gt; <b>Hàng hóa, dịch vụ</b> để khai báo nguyên vật liệu.</li>
                    <li>Thiết lập định mức nguyên vật liệu cấu thành cho 1 đơn vị thành phẩm.</li>
                  </ul>
                </div>
              )}

              {activeStepModal === 2 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Đối tượng tập hợp chi phí hiện tại:</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    <li>PX-CK: Phân xưởng Cơ khí chế tạo</li>
                    <li>PX-MAY: Phân xưởng May xuất khẩu</li>
                    <li>PX-NHUA: Phân xưởng Đúc ép nhựa</li>
                  </ul>
                </div>
              )}

              {activeStepModal === 3 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Chi phí dở dang đầu kỳ (TK 154):</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    <li>Chi phí NVL trực tiếp dở dang: <b>18.500.000 đ</b></li>
                    <li>Chi phí Nhân công trực tiếp dở dang: <b>4.200.000 đ</b></li>
                    <li>Chi phí Sản xuất chung dở dang: <b>2.300.000 đ</b></li>
                  </ul>
                </div>
              )}

              {activeStepModal === 4 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Chứng từ xuất kho NVL sản xuất:</div>
                  <p style={{ margin: 0 }}>
                    Hạch toán Nợ TK 621 (chi tiết đối tượng THCP) / Có TK 152. Nguyên vật liệu xuất kho được tính theo phương pháp Bình quân gia quyền hoặc Đích danh.
                  </p>
                </div>
              )}

              {activeStepModal === 5 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Hạch toán chi phí nhân công & SXC:</div>
                  <p style={{ margin: 0 }}>
                    - Lương công nhân trực tiếp: Nợ TK 622 / Có TK 334, 338.<br />
                    - Khấu hao máy móc phân xưởng: Nợ TK 6274 / Có TK 214.<br />
                    - Tiền điện, nước, dịch vụ mua ngoài: Nợ TK 6277, 6278 / Có TK 111, 112, 331.
                  </p>
                </div>
              )}

              {activeStepModal === 6 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Phiếu nhập kho thành phẩm:</div>
                  <p style={{ margin: 0 }}>
                    Lập phiếu nhập kho thành phẩm hoàn thành (Nợ TK 155 / Có TK 154). Giá nhập kho tạm tính sẽ được tự động cập nhật lại chính xác khi chạy bước tính giá thành.
                  </p>
                </div>
              )}

              {activeStepModal === 7 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Xác định kỳ tính giá thành:</div>
                  <p style={{ margin: 0 }}>
                    Kỳ tính giá thành: Tháng 03/2026. Chọn các phân xưởng và đối tượng THCP cần chốt sổ tính giá.
                  </p>
                </div>
              )}

              {activeStepModal === 8 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Tính giá thành thành phẩm:</div>
                  <p style={{ margin: 0 }}>
                    Hệ thống tự động tập hợp chi phí, phân bổ chi phí chung theo tiêu thức đã chọn, trừ giá trị dở dang cuối kỳ và ra tổng giá thành hoàn thành.
                  </p>
                </div>
              )}

              {activeStepModal === 9 && (
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Kết chuyển chi phí:</div>
                  <p style={{ margin: 0 }}>
                    Sinh bút toán kết chuyển Nợ TK 154 / Có TK 621, 622, 627. Đối với chi phí vượt định mức (nếu có), phần mềm tự động kết chuyển Nợ TK 632 / Có TK 621, 622, 627.
                  </p>
                </div>
              )}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const stepItem = [...currentSubtabData.row1, ...currentSubtabData.row2].find(
                    (s) => s.step === activeStepModal
                  );
                  notify(`Đã kích hoạt bước: ${stepItem?.title || ""}`);
                  setActiveStepModal(null);
                }}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Thực hiện ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Wizard: Thêm Kỳ Tính Giá Thành */}
      {addPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 720,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Tính giá thành - Bước {wizardStep}/3: {wizardStep === 1 ? "Chọn kỳ & Đối tượng THCP" : wizardStep === 2 ? "Tập hợp & Phân bổ chi phí" : "Đánh giá dở dang & Hoàn tất"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAddPeriodModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            {/* Wizard Body */}
            <div style={{ padding: "20px 24px", fontSize: 13.5 }}>
              {wizardStep === 1 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                      Mã kỳ tính giá thành *
                    </label>
                    <input
                      type="text"
                      value={wizardData.code}
                      onChange={(e) => setWizardData({ ...wizardData, code: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                      Phương pháp tính giá
                    </label>
                    <select
                      value={wizardData.method}
                      onChange={(e) => setWizardData({ ...wizardData, method: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff" }}
                    >
                      <option>Giản đơn</option>
                      <option>Hệ số, tỷ lệ</option>
                      <option>Phân bước</option>
                      <option>Công trình</option>
                      <option>Đơn hàng</option>
                      <option>Hợp đồng</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                      Tên kỳ tính giá thành *
                    </label>
                    <input
                      type="text"
                      value={wizardData.name}
                      onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                      Từ ngày
                    </label>
                    <input
                      type="text"
                      value={wizardData.fromDate}
                      onChange={(e) => setWizardData({ ...wizardData, fromDate: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                      Đến ngày
                    </label>
                    <input
                      type="text"
                      value={wizardData.toDate}
                      onChange={(e) => setWizardData({ ...wizardData, toDate: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                      Đối tượng tập hợp chi phí *
                    </label>
                    <input
                      type="text"
                      value={wizardData.costObject}
                      onChange={(e) => setWizardData({ ...wizardData, costObject: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 600, color: "#00a862", marginBottom: 6 }}>
                      Tập hợp chi phí phát sinh trong kỳ:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <div>
                        <span style={{ fontSize: 12, color: "#64748b" }}>CP NVL trực tiếp (621):</span>
                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>
                          {formatMoney(wizardData.directMaterial)}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, color: "#64748b" }}>CP Nhân công (622):</span>
                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>
                          {formatMoney(wizardData.directLabor)}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, color: "#64748b" }}>CP SX chung (627):</span>
                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>
                          {formatMoney(wizardData.generalCost)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                      Tiêu thức phân bổ chi phí chung (627)
                    </label>
                    <select
                      value={wizardData.allocationMethod}
                      onChange={(e) => setWizardData({ ...wizardData, allocationMethod: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff" }}
                    >
                      <option>Theo chi phí NVL trực tiếp</option>
                      <option>Theo chi phí nhân công trực tiếp</option>
                      <option>Theo định mức nguyên vật liệu</option>
                      <option>Theo số lượng sản phẩm nhập kho</option>
                    </select>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                        Phương pháp đánh giá dở dang cuối kỳ
                      </label>
                      <select
                        value={wizardData.endingWipMethod}
                        onChange={(e) => setWizardData({ ...wizardData, endingWipMethod: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff" }}
                      >
                        <option>Theo chi phí NVL trực tiếp</option>
                        <option>Theo sản lượng hoàn thành tương đương</option>
                        <option>Theo định mức kinh tế kỹ thuật</option>
                        <option>Không có dở dang cuối kỳ</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontWeight: 600, marginBottom: 4, color: "#334155" }}>
                        Số lượng thành phẩm nhập kho
                      </label>
                      <input
                        type="number"
                        value={wizardData.finishedQty}
                        onChange={(e) => setWizardData({ ...wizardData, finishedQty: Number(e.target.value) })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>

                  <div style={{ background: "#ecfdf5", padding: 14, borderRadius: 6, border: "1px solid #a7f3d0" }}>
                    <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 6 }}>
                      Tổng kết quả tính giá thành:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>Tổng giá trị thành phẩm hoàn thành: <b>{formatMoney(wizardData.directMaterial + wizardData.directLabor + wizardData.generalCost - 8000000)}</b></div>
                      <div>Giá thành đơn vị: <b>{formatMoney((wizardData.directMaterial + wizardData.directLabor + wizardData.generalCost - 8000000) / wizardData.finishedQty)} / chiếc</b></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer Buttons */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <button
                type="button"
                onClick={() => (wizardStep > 1 ? setWizardStep(wizardStep - 1) : setAddPeriodModalOpen(false))}
                style={{
                  padding: "6px 14px",
                  borderRadius: 4,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {wizardStep > 1 ? "Quay lại" : "Hủy"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (wizardStep < 3) {
                    setWizardStep(wizardStep + 1);
                  } else {
                    notify(`Đã hoàn tất tính giá thành cho kỳ: ${wizardData.name}`);
                    setAddPeriodModalOpen(false);
                  }
                }}
                style={{
                  padding: "6px 18px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {wizardStep < 3 ? "Tiếp tục" : "Lưu & Hoàn tất"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thẻ Tính Giá Thành Chi Tiết */}
      {costCardModalRecord && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 780,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Thẻ tính giá thành sản phẩm: {costCardModalRecord.name}
              </h3>
              <button
                type="button"
                onClick={() => setCostCardModalRecord(null)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              <div style={{ marginBottom: 12, fontSize: 13, color: "#475569" }}>
                Đối tượng THCP: <b>{costCardModalRecord.targetObject}</b> | Kỳ: <b>{costCardModalRecord.fromDate} - {costCardModalRecord.toDate}</b>
              </div>

              <table className="misa-purchase-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Khoản mục chi phí</th>
                    <th style={{ textAlign: "right" }}>Dở dang đầu kỳ</th>
                    <th style={{ textAlign: "right" }}>Chi phí phát sinh</th>
                    <th style={{ textAlign: "right" }}>Dở dang cuối kỳ</th>
                    <th style={{ textAlign: "right" }}>Tổng giá thành</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1. Chi phí NVL trực tiếp (TK 621)</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.openingWip * 0.7)}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.incurredCost * 0.65)}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.endingWip * 0.7)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatMoney(costCardModalRecord.totalFinishedCost * 0.65)}</td>
                  </tr>
                  <tr>
                    <td>2. Chi phí Nhân công trực tiếp (TK 622)</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.openingWip * 0.2)}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.incurredCost * 0.22)}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.endingWip * 0.2)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatMoney(costCardModalRecord.totalFinishedCost * 0.22)}</td>
                  </tr>
                  <tr>
                    <td>3. Chi phí Sản xuất chung (TK 627)</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.openingWip * 0.1)}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.incurredCost * 0.13)}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.endingWip * 0.1)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatMoney(costCardModalRecord.totalFinishedCost * 0.13)}</td>
                  </tr>
                  <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                    <td>CỘNG TỔNG CỘNG</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(costCardModalRecord.openingWip)}</td>
                    <td style={{ textAlign: "right", color: "#2563eb" }}>{formatMoney(costCardModalRecord.incurredCost)}</td>
                    <td style={{ textAlign: "right", color: "#d97706" }}>{formatMoney(costCardModalRecord.endingWip)}</td>
                    <td style={{ textAlign: "right", color: "#00a862" }}>{formatMoney(costCardModalRecord.totalFinishedCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  notify("Đã in thẻ tính giá thành");
                  setCostCardModalRecord(null);
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 4,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                In thẻ giá thành
              </button>
              <button
                type="button"
                onClick={() => setCostCardModalRecord(null)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
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

      {/* ==================================================================== */}
      {/* DRAWER: THÔNG TIN VẬT TƯ, HÀNG HÓA, DỊCH VỤ (NVL & THÀNH PHẨM) */}
      {/* ==================================================================== */}
      {itemDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setItemDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              height: "100%",
              background: "#ffffff",
              boxShadow: "-8px 0 30px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              cursor: "default",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                Thông tin vật tư, hàng hóa, dịch vụ
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn khai báo thông tin vật tư, hàng hóa, dịch vụ")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                    padding: 4,
                  }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setItemDrawerOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                    padding: 4,
                  }}
                  title="Đóng (ESC)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Subheader / Tính chất (Nguyên vật liệu / Thành phẩm) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 24px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#00a862",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                }}
              >
                {itemDrawerType === "material" ? (
                  <Layers size={16} />
                ) : (
                  <Box size={16} />
                )}
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                {itemDrawerType === "material" ? "Nguyên vật liệu" : "Thành phẩm"}
              </span>
              <span
                onClick={() => {
                  const nextType =
                    itemDrawerType === "material" ? "product" : "material";
                  setItemDrawerType(nextType);
                  setItemGroup(nextType === "material" ? "NVL" : "TP");
                  notify(
                    `Đã đổi tính chất sang: ${
                      nextType === "material"
                        ? "Nguyên vật liệu"
                        : "Thành phẩm"
                    }`
                  );
                }}
                style={{
                  fontSize: 13,
                  color: "#0284c7",
                  cursor: "pointer",
                  marginLeft: 6,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.textDecoration = "underline")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.textDecoration = "none")
                }
              >
                Thay đổi tính chất
              </span>
            </div>

            {/* Form Scrollable Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Tên * */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    marginBottom: 6,
                  }}
                >
                  Tên <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={
                    itemDrawerType === "material"
                      ? "Ví dụ: Vải cotton 100%, Thép tấm CT3, Hạt nhựa ABS..."
                      : "Ví dụ: Áo polo nam, Bàn ghế inox cao cấp, Ống gang đúc..."
                  }
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "6px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13.5,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#00a862")}
                  onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                />
              </div>

              {/* Row: Mã * + Nhóm VTHH + Picture Frame */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                {/* Left: Mã & Nhóm */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1.6fr",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#1e293b",
                          marginBottom: 6,
                        }}
                      >
                        Mã <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={itemCode}
                        onChange={(e) => setItemCode(e.target.value)}
                        style={{
                          width: "100%",
                          height: 34,
                          padding: "6px 12px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13.5,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#1e293b",
                          marginBottom: 6,
                        }}
                      >
                        Nhóm VTHH
                      </label>
                      <div
                        style={{
                          height: 34,
                          padding: "3px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span
                            style={{
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              borderRadius: 3,
                              padding: "2px 8px",
                              fontSize: 12,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {itemGroup}
                            <X
                              size={12}
                              style={{ cursor: "pointer" }}
                              onClick={() =>
                                setItemGroup(itemGroup === "NVL" ? "TP" : "NVL")
                              }
                            />
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            color: "#64748b",
                          }}
                        >
                          <Plus
                            size={16}
                            style={{ cursor: "pointer", color: "#00a862" }}
                            onClick={() => notify("Thêm nhóm VTHH mới")}
                          />
                          <ChevronDown size={14} style={{ cursor: "pointer" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Đơn vị tính chính */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#1e293b",
                        marginBottom: 6,
                      }}
                    >
                      Đơn vị tính chính
                    </label>
                    <div
                      style={{
                        height: 34,
                        padding: "3px 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxSizing: "border-box",
                        background: "#ffffff",
                        maxWidth: 260,
                      }}
                    >
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="Chọn hoặc nhập ĐVT..."
                        style={{
                          border: "none",
                          outline: "none",
                          fontSize: 13,
                          width: "100%",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: "#64748b",
                        }}
                      >
                        <Plus
                          size={16}
                          color="#00a862"
                          style={{ cursor: "pointer" }}
                          onClick={() => notify("Thêm đơn vị tính mới")}
                        />
                        <ChevronDown size={14} style={{ cursor: "pointer" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Picture Box */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      background: "#fafafa",
                      display: "grid",
                      placeItems: "center",
                      color: "#cbd5e1",
                    }}
                  >
                    <ImageIcon size={36} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Pencil
                      size={15}
                      color="#64748b"
                      style={{ cursor: "pointer" }}
                      title="Tải ảnh lên"
                      onClick={() => notify("Tải ảnh sản phẩm/vật tư")}
                    />
                    <Trash2
                      size={15}
                      color="#ef4444"
                      style={{ cursor: "pointer" }}
                      title="Xóa ảnh"
                      onClick={() => notify("Đã xóa ảnh")}
                    />
                  </div>
                </div>
              </div>

              {/* Giảm thuế theo quy định */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    marginBottom: 6,
                  }}
                >
                  Giảm thuế theo quy định
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      height: 34,
                      padding: "3px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxSizing: "border-box",
                      background: "#ffffff",
                      width: 260,
                    }}
                  >
                    <select
                      value={taxReduction}
                      onChange={(e) => setTaxReduction(e.target.value)}
                      style={{
                        border: "none",
                        outline: "none",
                        fontSize: 13,
                        width: "100%",
                        background: "transparent",
                      }}
                    >
                      <option value="Chưa xác định">Chưa xác định</option>
                      <option value="Không được giảm">Không được giảm thuế</option>
                      <option value="Được giảm">Được giảm thuế GTGT (Nghị quyết 2024)</option>
                    </select>
                  </div>
                  <div
                    onClick={() => notify("Mở tiện ích tra cứu giảm thuế GTGT theo Nghị quyết")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#00a862",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    <FileText size={15} />
                    <span>Tra cứu giảm thuế</span>
                  </div>
                </div>
              </div>

              {/* Thời hạn bảo hành */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    marginBottom: 6,
                  }}
                >
                  Thời hạn bảo hành
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    value={warrantyPeriod}
                    onChange={(e) => setWarrantyPeriod(Number(e.target.value))}
                    style={{
                      width: 80,
                      height: 34,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      boxSizing: "border-box",
                      outline: "none",
                      textAlign: "right",
                    }}
                  />
                  <select
                    value={warrantyUnit}
                    onChange={(e) => setWarrantyUnit(e.target.value)}
                    style={{
                      height: 34,
                      padding: "4px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  >
                    <option value="Ngày">Ngày</option>
                    <option value="Tháng">Tháng</option>
                    <option value="Năm">Năm</option>
                  </select>
                  <input
                    type="text"
                    placeholder=""
                    style={{
                      flex: 1,
                      height: 34,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Số lượng tồn tối thiểu & Nguồn gốc */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#1e293b",
                      marginBottom: 6,
                    }}
                  >
                    Số lượng tồn tối thiểu
                  </label>
                  <input
                    type="text"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      boxSizing: "border-box",
                      textAlign: "right",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#1e293b",
                      marginBottom: 6,
                    }}
                  >
                    Nguồn gốc
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Ví dụ: Việt Nam, Nhập khẩu Nhật Bản..."
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Mô tả */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    marginBottom: 6,
                  }}
                >
                  Mô tả
                </label>
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Diễn giải khi mua */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    marginBottom: 6,
                  }}
                >
                  Diễn giải khi mua
                </label>
                <input
                  type="text"
                  value={buyDesc}
                  onChange={(e) => setBuyDesc(e.target.value)}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "6px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Diễn giải khi bán */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    marginBottom: 6,
                  }}
                >
                  Diễn giải khi bán
                </label>
                <input
                  type="text"
                  value={saleDesc}
                  onChange={(e) => setSaleDesc(e.target.value)}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "6px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Loại hàng hóa đặc trưng (Chỉ có ở Thành phẩm - Screenshot 3) */}
              {itemDrawerType === "product" && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 6,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#1e293b",
                      }}
                    >
                      Loại hàng hóa đặc trưng
                    </label>
                    <HelpCircle
                      size={14}
                      color="#64748b"
                      title="Chọn loại hàng hóa đặc thù theo quy định kế toán"
                    />
                  </div>
                  <select
                    value={specialProductType}
                    onChange={(e) => setSpecialProductType(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "4px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  >
                    <option value="">-- Chọn loại hàng hóa đặc trưng --</option>
                    <option value="1">Hàng may mặc, dệt may theo lô</option>
                    <option value="2">Cơ khí chế tạo, kim loại định hình</option>
                    <option value="3">Nông lâm thủy hải sản chế biến</option>
                    <option value="4">Sản phẩm linh kiện phụ tùng điện tử</option>
                  </select>
                </div>
              )}

              {/* Accordion 1: Thông tin ngầm định */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setAccDefaultInfo(!accDefaultInfo)}
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ChevronRight
                      size={16}
                      color="#64748b"
                      style={{
                        transform: accDefaultInfo ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      Thông tin ngầm định
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#7c3aed",
                      fontWeight: 500,
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Trợ lý số AVA Kế toán đã có thể gợi ý Thuế suất GTGT</span>
                  </div>
                </div>

                {accDefaultInfo && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#ffffff",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "#64748b",
                          marginBottom: 4,
                        }}
                      >
                        Kho ngầm định
                      </label>
                      <input
                        type="text"
                        defaultValue={
                          itemDrawerType === "material"
                            ? "KHO-NVL (Kho nguyên vật liệu)"
                            : "KHO-TP (Kho thành phẩm)"
                        }
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "4px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "#64748b",
                          marginBottom: 4,
                        }}
                      >
                        Tài khoản kho
                      </label>
                      <input
                        type="text"
                        defaultValue={itemDrawerType === "material" ? "152" : "155"}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "4px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "#64748b",
                          marginBottom: 4,
                        }}
                      >
                        Tài khoản chi phí
                      </label>
                      <input
                        type="text"
                        defaultValue={itemDrawerType === "material" ? "621" : "632"}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "4px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "#64748b",
                          marginBottom: 4,
                        }}
                      >
                        Thuế suất GTGT (%)
                      </label>
                      <select
                        defaultValue="10"
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "4px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          background: "#ffffff",
                        }}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="8">8% (Nghị quyết giảm thuế)</option>
                        <option value="10">10%</option>
                        <option value="kct">Không chịu thuế</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: Chiết khấu bán hàng */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setAccDiscount(!accDiscount)}
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ChevronRight
                    size={16}
                    color="#64748b"
                    style={{
                      transform: accDiscount ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Chiết khấu bán hàng
                  </span>
                </div>
                {accDiscount && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#ffffff",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: 13,
                      color: "#64748b",
                    }}
                  >
                    Thiết lập tỷ lệ chiết khấu thương mại cố định hoặc theo số lượng bậc thang.
                  </div>
                )}
              </div>

              {/* Accordion 3: Đơn vị chuyển đổi */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setAccConversion(!accConversion)}
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ChevronRight
                    size={16}
                    color="#64748b"
                    style={{
                      transform: accConversion ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Đơn vị chuyển đổi
                  </span>
                </div>
                {accConversion && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#ffffff",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: 13,
                      color: "#64748b",
                    }}
                  >
                    Khai báo đơn vị tính phụ và tỷ lệ quy đổi về đơn vị tính chính (Ví dụ: Thùng quy đổi ra Hộp, Mét ra Cuộn).
                  </div>
                )}
              </div>

              {/* Accordion 4: Công thức tính số lượng */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setAccFormula(!accFormula)}
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ChevronRight
                    size={16}
                    color="#64748b"
                    style={{
                      transform: accFormula ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    Công thức tính số lượng
                  </span>
                </div>
                {accFormula && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#ffffff",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: 13,
                      color: "#64748b",
                    }}
                  >
                    Tính số lượng tự động theo: Dài x Rộng x Cao x Hệ số quy đổi hoặc công thức tùy biến.
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => setItemDrawerOpen(false)}
                style={{
                  padding: "7px 22px",
                  borderRadius: 4,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!itemName.trim()) {
                    notify("Vui lòng nhập Tên vật tư / hàng hóa!");
                    return;
                  }
                  notify(
                    `Đã cất thành công ${
                      itemDrawerType === "material" ? "nguyên vật liệu" : "thành phẩm"
                    }: ${itemName} (${itemCode})`
                  );
                  setItemDrawerOpen(false);
                }}
                style={{
                  padding: "7px 22px",
                  borderRadius: 4,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cất
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!itemName.trim()) {
                    notify("Vui lòng nhập Tên vật tư / hàng hóa!");
                    return;
                  }
                  notify(
                    `Đã cất ${
                      itemDrawerType === "material" ? "nguyên vật liệu" : "thành phẩm"
                    }: ${itemName} (${itemCode}). Tiếp tục thêm mới...`
                  );
                  setItemName("");
                  const nextNum = parseInt(itemCode.replace(/\D/g, "") || "1", 10) + 1;
                  setItemCode(`VT${String(nextNum).padStart(5, "0")}`);
                }}
                style={{
                  padding: "7px 22px",
                  borderRadius: 4,
                  background: "#00a862",
                  border: "none",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0, 168, 98, 0.3)",
                }}
              >
                Cất và Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5 MODALS FOR STEP 5: HẠCH TOÁN CHI PHÍ PHÁT SINH */}
      {/* ==================================================================== */}

      {/* Modal 1: Chọn kỳ tính khấu hao (Screenshot 1) */}
      {depreciationModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Chọn kỳ tính khấu hao
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn tính khấu hao TSCĐ")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setDepreciationModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                  Tháng
                </label>
                <select
                  value={allocMonth}
                  onChange={(e) => setAllocMonth(Number(e.target.value))}
                  style={{
                    height: 34,
                    padding: "4px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13.5,
                    background: "#ffffff",
                    minWidth: 90,
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                  Năm
                </label>
                <input
                  type="number"
                  value={allocYear}
                  onChange={(e) => setAllocYear(Number(e.target.value))}
                  style={{
                    height: 34,
                    width: 90,
                    padding: "4px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13.5,
                    boxSizing: "border-box",
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
                borderTop: "1px solid #f1f5f9",
                background: "#fafafa",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <button
                type="button"
                onClick={() => setDepreciationModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã tính khấu hao TSCĐ Tháng ${allocMonth}/${allocYear} thành công!`);
                  setDepreciationModalOpen(false);
                }}
                style={{
                  padding: "6px 22px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Chọn kỳ phân bổ chi phí CCDC (Screenshot 2) */}
      {toolAllocModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 460,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Chọn kỳ phân bổ chi phí CCDC
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn phân bổ công cụ dụng cụ")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setToolAllocModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                  Tháng <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={allocMonth}
                  onChange={(e) => setAllocMonth(Number(e.target.value))}
                  style={{
                    height: 34,
                    padding: "4px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13.5,
                    background: "#ffffff",
                    minWidth: 90,
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                  Năm
                </label>
                <input
                  type="number"
                  value={allocYear}
                  onChange={(e) => setAllocYear(Number(e.target.value))}
                  style={{
                    height: 34,
                    width: 90,
                    padding: "4px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13.5,
                    boxSizing: "border-box",
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
                borderTop: "1px solid #f1f5f9",
                background: "#fafafa",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <button
                type="button"
                onClick={() => setToolAllocModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã phân bổ chi phí CCDC Tháng ${allocMonth}/${allocYear} thành công!`);
                  setToolAllocModalOpen(false);
                }}
                style={{
                  padding: "6px 22px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Chọn kỳ phân bổ chi phí trả trước (Screenshot 3) */}
      {prepaidAllocModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Chọn kỳ phân bổ chi phí
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn phân bổ chi phí trả trước (TK 242)")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setPrepaidAllocModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                  Tháng <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={allocMonth}
                  onChange={(e) => setAllocMonth(Number(e.target.value))}
                  style={{
                    height: 34,
                    padding: "4px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13.5,
                    background: "#ffffff",
                    minWidth: 90,
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                  Năm
                </label>
                <input
                  type="number"
                  value={allocYear}
                  onChange={(e) => setAllocYear(Number(e.target.value))}
                  style={{
                    height: 34,
                    width: 90,
                    padding: "4px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13.5,
                    boxSizing: "border-box",
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
                borderTop: "1px solid #f1f5f9",
                background: "#fafafa",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <button
                type="button"
                onClick={() => setPrepaidAllocModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã phân bổ chi phí trả trước Tháng ${allocMonth}/${allocYear} thành công!`);
                  setPrepaidAllocModalOpen(false);
                }}
                style={{
                  padding: "6px 22px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Chọn bảng lương (Screenshot 4) */}
      {payrollAllocModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                Chọn bảng lương
              </h3>
              <button
                type="button"
                onClick={() => setPayrollAllocModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#1e293b", marginBottom: 6 }}>
                Bảng lương
              </label>
              <select
                value={selectedPayrollSheet}
                onChange={(e) => setSelectedPayrollSheet(e.target.value)}
                style={{
                  width: "100%",
                  height: 36,
                  padding: "6px 12px",
                  border: "1px solid #00a862",
                  borderRadius: 4,
                  fontSize: 13.5,
                  background: "#ffffff",
                  outline: "none",
                }}
              >
                <option value="Bảng lương Tháng 10/2026 - Phân xưởng sản xuất">
                  Bảng lương Tháng 10/2026 - Phân xưởng sản xuất
                </option>
                <option value="Bảng lương Tháng 09/2026 - Phân xưởng sản xuất">
                  Bảng lương Tháng 09/2026 - Phân xưởng sản xuất
                </option>
                <option value="Bảng lương Tháng 10/2026 - Khối sản xuất & may mặc">
                  Bảng lương Tháng 10/2026 - Khối sản xuất & may mặc
                </option>
              </select>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #f1f5f9",
                background: "#fafafa",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <button
                type="button"
                onClick={() => setPayrollAllocModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã hạch toán chi phí lương cho ${selectedPayrollSheet} thành công! (Nợ 622, 627 / Có 334)`);
                  setPayrollAllocModalOpen(false);
                }}
                style={{
                  padding: "6px 22px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Chứng từ nghiệp vụ khác NVK00001 (Screenshot 5) */}
      {otherExpenseModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "95vw",
              maxWidth: 1250,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
              overflow: "hidden",
            }}
          >
            {/* Top Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <RotateCw size={18} color="#00a862" />
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
                  Chứng từ nghiệp vụ khác {voucherNumber}
                </h2>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 12.5,
                    background: "#ffffff",
                  }}
                >
                  <span>4. Khác</span>
                  <Plus size={14} color="#00a862" style={{ cursor: "pointer" }} />
                  <ChevronDown size={14} color="#64748b" style={{ cursor: "pointer" }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#64748b" }}>
                <Maximize2 size={17} style={{ cursor: "pointer" }} title="Phóng to" />
                <Settings size={17} style={{ cursor: "pointer" }} title="Tùy chỉnh giao diện" />
                <X size={20} style={{ cursor: "pointer" }} title="Đóng" onClick={() => setOtherExpenseModalOpen(false)} />
              </div>
            </div>

            {/* Main Voucher Form Header */}
            <div
              style={{
                padding: "16px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "1fr 340px",
                gap: 24,
              }}
            >
              {/* Left Inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#475569", marginBottom: 4 }}>
                    Diễn giải
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={voucherDesc}
                      onChange={(e) => setVoucherDesc(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "4px 34px 4px 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                    <Sparkles
                      size={16}
                      color="#7c3aed"
                      style={{ position: "absolute", right: 10, top: 9, cursor: "pointer" }}
                      title="AVA AI Gợi ý diễn giải chứng từ"
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 180 }}>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#475569", marginBottom: 4 }}>
                      Hạn thanh toán
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={voucherDueDate}
                        onChange={(e) => setVoucherDueDate(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "4px 28px 4px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          boxSizing: "border-box",
                        }}
                      />
                      <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8, top: 9 }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#475569", marginBottom: 4 }}>
                      Tham chiếu
                    </label>
                    <span style={{ color: "#00a862", cursor: "pointer", fontSize: 14 }}>...</span>
                  </div>
                </div>
              </div>

              {/* Right Info & Big Total Amount */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 200 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#64748b" }}>Ngày hạch toán</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={voucherPostingDate}
                          onChange={(e) => setVoucherPostingDate(e.target.value)}
                          style={{
                            width: "100%",
                            height: 30,
                            padding: "4px 26px 4px 8px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12,
                            boxSizing: "border-box",
                          }}
                        />
                        <Calendar size={13} color="#64748b" style={{ position: "absolute", right: 8, top: 8 }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#64748b" }}>Ngày chứng từ</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={voucherDocDate}
                          onChange={(e) => setVoucherDocDate(e.target.value)}
                          style={{
                            width: "100%",
                            height: 30,
                            padding: "4px 26px 4px 8px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12,
                            boxSizing: "border-box",
                          }}
                        />
                        <Calendar size={13} color="#64748b" style={{ position: "absolute", right: 8, top: 8 }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#64748b" }}>Số chứng từ</label>
                      <input
                        type="text"
                        value={voucherNumber}
                        onChange={(e) => setVoucherNumber(e.target.value)}
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "4px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: "right", alignSelf: "flex-start" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Tổng tiền</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", letterSpacing: 0.5 }}>
                      {voucherLines.reduce((s, l) => s + (l.amount || 0), 0).toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", gap: 16 }}>
                <button
                  type="button"
                  onClick={() => setVoucherTab("posting")}
                  style={{
                    padding: "10px 4px",
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    color: voucherTab === "posting" ? "#00a862" : "#64748b",
                    borderBottom: voucherTab === "posting" ? "2.5px solid #00a862" : "2.5px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Hạch toán
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherTab("tax")}
                  style={{
                    padding: "10px 4px",
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 500,
                    color: voucherTab === "tax" ? "#00a862" : "#64748b",
                    borderBottom: voucherTab === "tax" ? "2.5px solid #00a862" : "2.5px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Kê khai hóa đơn và hạch toán thuế
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569", cursor: "pointer" }}>
                  <input type="checkbox" />
                  <span>Hạch toán gộp nhiều hóa đơn</span>
                  <HelpCircle size={13} color="#94a3b8" />
                </label>
                <button
                  type="button"
                  onClick={() => notify("Trợ lý AVA: Kiểm tra chứng từ hợp lệ")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid #ddd6fe",
                    background: "#faf5ff",
                    color: "#7c3aed",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Sparkles size={13} />
                  <span>AVA Kế toán</span>
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>

            {/* Grid Table */}
            <div style={{ flex: 1, overflow: "auto", minHeight: 180 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", width: 35, textAlign: "center" }}>#</th>
                    <th style={{ padding: "8px 10px", minWidth: 260 }}>📌 Diễn giải</th>
                    <th style={{ padding: "8px 10px", width: 75 }}>TK Nợ</th>
                    <th style={{ padding: "8px 10px", width: 75 }}>TK Có</th>
                    <th style={{ padding: "8px 10px", width: 130, textAlign: "right" }}>Số tiền</th>
                    <th style={{ padding: "8px 10px", width: 120 }}>Nghiệp vụ</th>
                    <th style={{ padding: "8px 10px", width: 110 }}>Đối tượng Nợ</th>
                    <th style={{ padding: "8px 10px", minWidth: 160 }}>Tên đối tượng nợ</th>
                    <th style={{ padding: "8px 10px", width: 110 }}>Đối tượng Có</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherLines.map((line, idx) => (
                    <tr key={line.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="text"
                          value={line.desc}
                          onChange={(e) => {
                            const newLines = [...voucherLines];
                            newLines[idx].desc = e.target.value;
                            setVoucherLines(newLines);
                          }}
                          style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 3, padding: "4px 8px", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="text"
                          value={line.debitAccount}
                          onChange={(e) => {
                            const newLines = [...voucherLines];
                            newLines[idx].debitAccount = e.target.value;
                            setVoucherLines(newLines);
                          }}
                          style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 3, padding: "4px 6px", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="text"
                          value={line.creditAccount}
                          onChange={(e) => {
                            const newLines = [...voucherLines];
                            newLines[idx].creditAccount = e.target.value;
                            setVoucherLines(newLines);
                          }}
                          style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 3, padding: "4px 6px", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="number"
                          value={line.amount}
                          onChange={(e) => {
                            const newLines = [...voucherLines];
                            newLines[idx].amount = Number(e.target.value);
                            setVoucherLines(newLines);
                          }}
                          style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 3, padding: "4px 6px", fontSize: 12, textAlign: "right" }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px", color: "#64748b" }}>{line.bizType}</td>
                      <td style={{ padding: "6px 10px", color: "#00a862", fontWeight: 600 }}>{line.debitObj}</td>
                      <td style={{ padding: "6px 10px", color: "#64748b" }}>{line.debitObjName}</td>
                      <td style={{ padding: "6px 10px", color: "#2563eb", fontWeight: 600 }}>{line.creditObj}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grid Bottom Bar */}
            <div style={{ padding: "10px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = voucherLines.length + 1;
                      setVoucherLines([
                        ...voucherLines,
                        {
                          id: newId,
                          desc: voucherDesc,
                          debitAccount: "6277",
                          creditAccount: "1111",
                          amount: 0,
                          bizType: "Chi phí SXC",
                          debitObj: "PX-CK",
                          debitObjName: "Phân xưởng Cơ khí",
                          creditObj: "",
                          creditObjName: "",
                        },
                      ]);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 12,
                      cursor: "pointer",
                      color: "#1e293b",
                    }}
                  >
                    <Plus size={14} color="#00a862" />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoucherLines([])}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      border: "1px solid #fecaca",
                      borderRadius: 4,
                      background: "#fef2f2",
                      fontSize: 12,
                      cursor: "pointer",
                      color: "#ef4444",
                    }}
                  >
                    <Trash2 size={13} color="#ef4444" />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>

                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Tổng số: <b>{voucherLines.length}</b> dòng | Số dòng/trang <b>20</b>
                </div>
              </div>

              {/* Attachment box */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                  <input type="checkbox" />
                  <span>Không lên bảng kê thuế GTGT</span>
                  <HelpCircle size={13} color="#94a3b8" />
                </label>

                <div
                  onClick={() => notify("Đã mở hộp thoại tải tệp đính kèm chứng từ")}
                  style={{
                    flex: 1,
                    maxWidth: 400,
                    padding: "8px 14px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  <Paperclip size={14} color="#00a862" />
                  <span>Chọn tệp hoặc kéo và thả tệp vào đây</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => setOtherExpenseModalOpen(false)}
                style={{
                  padding: "6px 22px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã cất chứng từ ${voucherNumber} thành công!`);
                  setOtherExpenseModalOpen(false);
                }}
                style={{
                  padding: "6px 22px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã cất và in Chứng từ nghiệp vụ khác ${voucherNumber}!`);
                  setOtherExpenseModalOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 22px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: THÊM KỲ TÍNH GIÁ THÀNH (MATCHES SCREENSHOT 2) */}
      {/* ==================================================================== */}
      {addSimplePeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAddSimplePeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Thêm kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => notify("Hướng dẫn thêm kỳ tính giá thành sản xuất giản đơn")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => setAddSimplePeriodModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Row 1: Kỳ | Từ ngày | Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 140px 140px", gap: 14, alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1e293b", marginBottom: 4 }}>
                    Kỳ
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={simplePeriodType}
                      onChange={(e) => handleSimplePeriodPresetChange(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 24px 5px 8px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #00a862",
                        outline: "none",
                        background: "#ffffff",
                        appearance: "none",
                        color: "#0f172a",
                        fontWeight: 500,
                      }}
                    >
                      <option>Tháng này</option>
                      <option>Tháng trước</option>
                      <option>Hôm nay</option>
                      <option>Tuần này</option>
                      <option>Quý này</option>
                      <option>Quý 1</option>
                      <option>Quý 2</option>
                      <option>Quý 3</option>
                      <option>Quý 4</option>
                      <option>Năm nay</option>
                    </select>
                    <ChevronDown
                      size={14}
                      color="#64748b"
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1e293b", marginBottom: 4 }}>
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={simpleFromDate}
                      onChange={(e) => setSimpleFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 8px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      color="#64748b"
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1e293b", marginBottom: 4 }}>
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={simpleToDate}
                      onChange={(e) => setSimpleToDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 8px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      color="#64748b"
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Tên * & Lấy dữ liệu */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1e293b", marginBottom: 4 }}>
                  Tên <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text"
                    value={simplePeriodName}
                    onChange={(e) => setSimplePeriodName(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleFetchCostObjects}
                    style={{
                      padding: "6px 16px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#1e293b",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Lấy dữ liệu
                  </button>
                </div>
              </div>

              {/* Section: Đối tượng cần tập hợp chi phí */}
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                    Đối tượng cần tập hợp chi phí
                  </span>
                  <div style={{ position: "relative", width: 220 }}>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={costObjSearch}
                      onChange={(e) => setCostObjSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 8px",
                        fontSize: 12.5,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                    <Search
                      size={14}
                      color="#94a3b8"
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}
                    />
                  </div>
                </div>

                {/* Table with light mint green header */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden", minHeight: 140 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#dff0e4", color: "#1e293b" }}>
                        <th style={{ width: 160, padding: "8px 12px", textAlign: "left", fontWeight: 600, borderRight: "1px solid #c8e6c9" }}>
                          Mã
                        </th>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, borderRight: "1px solid #c8e6c9" }}>
                          Tên
                        </th>
                        <th style={{ width: 160, padding: "8px 12px", textAlign: "left", fontWeight: 600, borderRight: "1px solid #c8e6c9" }}>
                          Loại
                        </th>
                        <th style={{ width: 44, padding: "8px", textAlign: "center", fontWeight: 600 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCostObjects
                        .filter(
                          (o) =>
                            o.code.toLowerCase().includes(costObjSearch.toLowerCase()) ||
                            o.name.toLowerCase().includes(costObjSearch.toLowerCase())
                        )
                        .map((obj) => (
                          <tr key={obj.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: "#00a862" }}>
                              {obj.code}
                            </td>
                            <td style={{ padding: "8px 12px" }}>{obj.name}</td>
                            <td style={{ padding: "8px 12px", color: "#64748b" }}>{obj.type}</td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCostObjects((prev) => prev.filter((x) => x.code !== obj.code))
                                }
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {selectedCostObjects.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ padding: "30px 16px", textAlign: "center", color: "#94a3b8" }}>
                            Chưa có đối tượng tập hợp chi phí. Bấm '+ Chọn đối tượng THCP' hoặc 'Lấy dữ liệu'.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom actions row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setPickCostObjModalOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={13} />
                    <span>Chọn đối tượng THCP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCostObjects([]);
                      notify("Đã xóa hết đối tượng tập hợp chi phí");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#dc2626",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>

                {/* Helper info text */}
                <div style={{ fontSize: 12.5, color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <span>ⓘ Nếu không thấy đối tượng tập hợp chi phí, bạn vui lòng xem hướng dẫn</span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      notify("Xem hướng dẫn khai báo đối tượng tập hợp chi phí");
                    }}
                    style={{ color: "#00a862", fontWeight: 700, textDecoration: "underline" }}
                  >
                    TẠI ĐÂY
                  </a>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setAddSimplePeriodModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
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
                onClick={handleSaveSimplePeriod}
                style={{
                  padding: "6px 24px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHỌN KỲ TÍNH GIÁ THÀNH (MATCHES SCREENSHOT 3) */}
      {/* ==================================================================== */}
      {selectPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => notify("Hướng dẫn chọn kỳ tính giá thành để kết chuyển chi phí")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => setSelectPeriodModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "18px 20px 24px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                Kỳ tính giá thành
              </label>

              {/* Input with active green border */}
              <div style={{ position: "relative" }}>
                <div
                  onClick={() => setTransferPeriodDropdownOpen(!transferPeriodDropdownOpen)}
                  style={{
                    width: "100%",
                    minHeight: 34,
                    padding: "6px 30px 6px 10px",
                    fontSize: 13,
                    borderRadius: 4,
                    border: "1.5px solid #00a862",
                    background: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ color: selectedTransferPeriod ? "#0f172a" : "#94a3b8" }}>
                    {selectedTransferPeriod || "|"}
                  </span>
                </div>
                <div
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "#64748b",
                  }}
                >
                  <ChevronDown
                    size={15}
                    style={{
                      transform: transferPeriodDropdownOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </div>

                {/* Dropdown panel matching Screenshot 3 */}
                {transferPeriodDropdownOpen && (
                  <div
                    style={{
                      marginTop: 4,
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Header in dropdown */}
                    <div
                      style={{
                        background: "#f1f5f9",
                        padding: "6px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "#475569",
                      }}
                    >
                      Kỳ tính giá thành
                    </div>

                    {/* Body */}
                    {simplePeriods.length === 0 ? (
                      <div
                        style={{
                          padding: "16px 12px",
                          textAlign: "center",
                          color: "#64748b",
                          fontSize: 13,
                        }}
                      >
                        Không có dữ liệu hiển thị.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 180, overflowY: "auto" }}>
                        {simplePeriods.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedTransferPeriod(p.name);
                              setTransferPeriodDropdownOpen(false);
                            }}
                            style={{
                              padding: "8px 12px",
                              fontSize: 13,
                              cursor: "pointer",
                              borderBottom: "1px solid #f8fafc",
                              background: selectedTransferPeriod === p.name ? "#f0fdf4" : "transparent",
                              color: selectedTransferPeriod === p.name ? "#00a862" : "#1e293b",
                              fontWeight: selectedTransferPeriod === p.name ? 600 : 400,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background =
                                selectedTransferPeriod === p.name ? "#f0fdf4" : "transparent")
                            }
                          >
                            {p.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectPeriodModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
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
                onClick={handleConfirmTransfer}
                style={{
                  padding: "6px 24px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: THÊM KỲ TÍNH GIÁ THÀNH (PHÂN BƯỚC) (SCREENSHOT 2) */}
      {/* ==================================================================== */}
      {addStepPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAddStepPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Thêm kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => notify("Hướng dẫn thêm kỳ tính giá thành phân bước")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => setAddStepPeriodModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Row 1: Kỳ | Từ ngày | Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1e293b", marginBottom: 4 }}>
                    Kỳ
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={stepPeriodType}
                      onChange={(e) => handleStepPeriodPresetChange(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 26px 6px 10px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1.5px solid #00a862",
                        background: "#ffffff",
                        outline: "none",
                        color: "#0f172a",
                        cursor: "pointer",
                        appearance: "none",
                      }}
                    >
                      <option>Hôm nay</option>
                      <option>Tuần này</option>
                      <option>Tháng này</option>
                      <option>Tháng trước</option>
                      <option>Quý này</option>
                      <option>Quý trước</option>
                      <option>Năm nay</option>
                      <option>Tùy chọn</option>
                    </select>
                    <ChevronDown
                      size={15}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1e293b", marginBottom: 4 }}>
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={stepFromDate}
                      onChange={(e) => setStepFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 30px 6px 10px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <Calendar
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
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1e293b", marginBottom: 4 }}>
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={stepToDate}
                      onChange={(e) => setStepToDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 30px 6px 10px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <Calendar
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
              </div>

              {/* Row 2: Tên * & Lấy dữ liệu */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1e293b", marginBottom: 4 }}>
                  Tên <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text"
                    value={stepPeriodName}
                    onChange={(e) => setStepPeriodName(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleFetchStepProcesses}
                    style={{
                      padding: "6px 16px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#1e293b",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Lấy dữ liệu
                  </button>
                </div>
              </div>

              {/* Section: Quy trình sản xuất cần tập hợp chi phí */}
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                    Quy trình sản xuất cần tập hợp chi phí
                  </span>
                  <div style={{ position: "relative", width: 220 }}>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={stepProcessSearch}
                      onChange={(e) => setStepProcessSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 8px",
                        fontSize: 12.5,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                    <Search
                      size={14}
                      color="#94a3b8"
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}
                    />
                  </div>
                </div>

                {/* Table with pale mint green header */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden", minHeight: 140 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#dff0e4", color: "#1e293b" }}>
                        <th style={{ width: 200, padding: "8px 12px", textAlign: "left", fontWeight: 600, borderRight: "1px solid #c8e6c9" }}>
                          Mã quy trình sản xuất
                        </th>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>
                          Tên quy trình sản xuất
                        </th>
                        <th style={{ width: 44, padding: "8px", textAlign: "center", fontWeight: 600 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProcesses
                        .filter(
                          (p) =>
                            p.code.toLowerCase().includes(stepProcessSearch.toLowerCase()) ||
                            p.name.toLowerCase().includes(stepProcessSearch.toLowerCase())
                        )
                        .map((proc) => (
                          <tr key={proc.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: "#00a862" }}>
                              {proc.code}
                            </td>
                            <td style={{ padding: "8px 12px" }}>{proc.name}</td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedProcesses((prev) => prev.filter((x) => x.code !== proc.code))
                                }
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {selectedProcesses.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ padding: "30px 16px", textAlign: "center", color: "#94a3b8" }}>
                            Chưa có quy trình sản xuất nào. Bấm '+ Chọn quy trình sản xuất' hoặc 'Lấy dữ liệu'.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom actions row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setPickStepProcessModalOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={13} />
                    <span>Chọn quy trình sản xuất</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProcesses([]);
                      notify("Đã xóa hết quy trình sản xuất");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#dc2626",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>

                {/* Helper info text */}
                <div style={{ fontSize: 12.5, color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <span>ⓘ Nếu không thấy đối tượng tập hợp chi phí, bạn vui lòng xem hướng dẫn</span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      notify("Xem hướng dẫn khai báo quy trình sản xuất và đối tượng THCP");
                    }}
                    style={{ color: "#00a862", fontWeight: 700, textDecoration: "underline" }}
                  >
                    TẠI ĐÂY
                  </a>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setAddStepPeriodModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
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
                onClick={handleSaveStepPeriod}
                style={{
                  padding: "6px 24px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHỌN QUY TRÌNH SẢN XUẤT */}
      {/* ==================================================================== */}
      {pickStepProcessModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPickStepProcessModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 620,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn quy trình sản xuất
              </h3>
              <button
                type="button"
                onClick={() => setPickStepProcessModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto" }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#dff0e4" }}>
                      <th style={{ width: 40, padding: "8px", textAlign: "center" }}></th>
                      <th style={{ width: 140, padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Mã quy trình</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Tên quy trình sản xuất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "QT-SOI-DET", name: "Quy trình sản xuất Sợi - Dệt - Nhuộm (3 công đoạn)" },
                      { code: "QT-CO-KHI", name: "Quy trình gia công Cơ khí chính xác (Cắt phôi -> Phay CNC -> Hoàn thiện)" },
                      { code: "QT-MAY-MAC", name: "Quy trình may mặc công nghiệp (Cắt vải -> May ráp -> Đóng gói)" },
                      { code: "QT-DONG-HO", name: "Quy trình chế biến thực phẩm đóng hộp (Sơ chế -> Nấu -> Đóng lon)" },
                    ].map((item) => {
                      const isSelected = selectedProcesses.some((x) => x.code === item.code);
                      return (
                        <tr
                          key={item.code}
                          style={{
                            borderTop: "1px solid #f1f5f9",
                            cursor: "pointer",
                            background: isSelected ? "#f0fdf4" : "transparent",
                          }}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedProcesses((prev) => prev.filter((x) => x.code !== item.code));
                            } else {
                              setSelectedProcesses((prev) => [...prev, item]);
                            }
                          }}
                        >
                          <td style={{ textAlign: "center", padding: "8px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ accentColor: "#00a862" }}
                            />
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                          <td style={{ padding: "8px 12px" }}>{item.name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setPickStepProcessModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => setPickStepProcessModalOpen(false)}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: KHAI BÁO QUY TRÌNH SẢN XUẤT */}
      {/* ==================================================================== */}
      {stepProcessModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setStepProcessModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Khai báo quy trình sản xuất
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => notify("Hướng dẫn khai báo quy trình sản xuất phân bước")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => setStepProcessModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Quy trình sản xuất gồm các công đoạn kế tiếp nhau, trong đó nửa thành phẩm công đoạn trước là đối tượng chế biến của công đoạn sau.
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#dff0e4", color: "#1e293b" }}>
                      <th style={{ width: 130, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Mã quy trình</th>
                      <th style={{ width: 220, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Tên quy trình sản xuất</th>
                      <th style={{ width: 90, padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>Số CĐ</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Chi tiết các công đoạn</th>
                      <th style={{ width: 110, padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "QT-SOI-DET", name: "Quy trình sản xuất Sợi - Dệt - Nhuộm", stagesCount: 3, stages: "1. Kéo sợi ➔ 2. Dệt vải ➔ 3. Nhuộm hoàn tất", status: "Đang sử dụng" },
                      { code: "QT-CO-KHI", name: "Quy trình gia công Cơ khí chính xác", stagesCount: 3, stages: "1. Cắt phôi ➔ 2. Phay tiện CNC ➔ 3. Hoàn thiện", status: "Đang sử dụng" },
                      { code: "QT-MAY-MAC", name: "Quy trình may mặc công nghiệp", stagesCount: 3, stages: "1. Cắt vải ➔ 2. May ráp ➔ 3. KCS & Đóng thùng", status: "Đang sử dụng" },
                      { code: "QT-DONG-HO", name: "Quy trình chế biến đóng hộp", stagesCount: 3, stages: "1. Sơ chế ➔ 2. Nấu thanh trùng ➔ 3. Đóng hộp", status: "Đang sử dụng" },
                    ].map((row) => (
                      <tr key={row.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#2563eb" }}>{row.stagesCount}</td>
                        <td style={{ padding: "8px 10px", color: "#334155" }}>{row.stages}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#dcfce7", color: "#166534" }}>
                            {row.status}
                          </span>
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
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setStepProcessModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã lưu khai báo quy trình sản xuất!");
                  setStepProcessModalOpen(false);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHỌN KỲ TÍNH GIÁ THÀNH (KẾT CHUYỂN PHÂN BƯỚC) */}
      {/* ==================================================================== */}
      {selectStepPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectStepPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => notify("Hướng dẫn chọn kỳ tính giá thành phân bước để kết chuyển chi phí")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => setSelectStepPeriodModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "18px 20px 24px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                Kỳ tính giá thành
              </label>

              <div style={{ position: "relative" }}>
                <div
                  onClick={() => setStepTransferPeriodDropdownOpen(!stepTransferPeriodDropdownOpen)}
                  style={{
                    width: "100%",
                    minHeight: 34,
                    padding: "6px 30px 6px 10px",
                    fontSize: 13,
                    borderRadius: 4,
                    border: "1.5px solid #00a862",
                    background: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ color: selectedStepTransferPeriod ? "#0f172a" : "#94a3b8" }}>
                    {selectedStepTransferPeriod || "|"}
                  </span>
                </div>
                <div
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "#64748b",
                  }}
                >
                  <ChevronDown
                    size={15}
                    style={{
                      transform: stepTransferPeriodDropdownOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </div>

                {stepTransferPeriodDropdownOpen && (
                  <div
                    style={{
                      marginTop: 4,
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "#f1f5f9",
                        padding: "6px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "#475569",
                      }}
                    >
                      Kỳ tính giá thành phân bước
                    </div>

                    {stepPeriods.length === 0 ? (
                      <div
                        style={{
                          padding: "16px 12px",
                          textAlign: "center",
                          color: "#64748b",
                          fontSize: 13,
                        }}
                      >
                        Không có dữ liệu hiển thị. Hãy thêm kỳ tính giá trước.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 180, overflowY: "auto" }}>
                        {stepPeriods.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedStepTransferPeriod(p.name);
                              setStepTransferPeriodDropdownOpen(false);
                            }}
                            style={{
                              padding: "8px 12px",
                              fontSize: 13,
                              cursor: "pointer",
                              borderBottom: "1px solid #f8fafc",
                              background: selectedStepTransferPeriod === p.name ? "#f0fdf4" : "transparent",
                              color: selectedStepTransferPeriod === p.name ? "#00a862" : "#1e293b",
                              fontWeight: selectedStepTransferPeriod === p.name ? 600 : 400,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background =
                                selectedStepTransferPeriod === p.name ? "#f0fdf4" : "transparent")
                            }
                          >
                            {p.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectStepPeriodModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
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
                onClick={handleConfirmStepTransfer}
                style={{
                  padding: "6px 24px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHỌN KỲ TÍNH GIÁ THÀNH (THỐNG KÊ SỐ LƯỢNG TP/BTP - SCREENSHOT 2) */}
      {/* ==================================================================== */}
      {selectQtyPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            setSelectQtyPeriodModalOpen(false);
            setQtyPeriodDropdownOpen(false);
            setQtyProcessDropdownOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              overflow: "visible",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header matching Screenshot 2 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px 10px 20px",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => notify("Hướng dẫn chọn kỳ tính giá thành để thống kê số lượng TP/BTP")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => {
                    setSelectQtyPeriodModalOpen(false);
                    setQtyPeriodDropdownOpen(false);
                    setQtyProcessDropdownOpen(false);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form Fields matching Screenshot 2 */}
            <div style={{ padding: "12px 20px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Field 1: Kỳ tính giá thành (Active green border) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                  Kỳ tính giá thành
                </label>
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => {
                      setQtyPeriodDropdownOpen(!qtyPeriodDropdownOpen);
                      setQtyProcessDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 34,
                      padding: "6px 30px 6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1.5px solid #00a862",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: selectedQtyPeriod ? "#0f172a" : "#94a3b8", display: "flex", alignItems: "center" }}>
                      {selectedQtyPeriod || (
                        <span style={{ display: "inline-block", width: "1px", height: "14px", background: "#0f172a" }}>|</span>
                      )}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#64748b",
                    }}
                  >
                    <ChevronDown
                      size={15}
                      style={{
                        transform: qtyPeriodDropdownOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>

                  {qtyPeriodDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      <div
                        style={{
                          background: "#f1f5f9",
                          padding: "6px 12px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#475569",
                        }}
                      >
                        Danh sách kỳ tính giá thành
                      </div>
                      {[
                        ...(stepPeriods.map((p) => p.name)),
                        "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026",
                        "Kỳ tính giá thành từ ngày 01/09/2026 đến ngày 30/09/2026",
                        "Kỳ tính giá thành Quý 3/2026",
                      ].filter((v, idx, arr) => arr.indexOf(v) === idx).map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setSelectedQtyPeriod(name);
                            setQtyPeriodDropdownOpen(false);
                          }}
                          style={{
                            padding: "8px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            borderBottom: "1px solid #f8fafc",
                            background: selectedQtyPeriod === name ? "#f0fdf4" : "transparent",
                            color: selectedQtyPeriod === name ? "#00a862" : "#1e293b",
                            fontWeight: selectedQtyPeriod === name ? 600 : 400,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              selectedQtyPeriod === name ? "#f0fdf4" : "transparent")
                          }
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Field 2: Quy trình sản xuất (Gray border) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                  Quy trình sản xuất
                </label>
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => {
                      setQtyProcessDropdownOpen(!qtyProcessDropdownOpen);
                      setQtyPeriodDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 34,
                      padding: "6px 30px 6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: selectedQtyProcess ? "#0f172a" : "#94a3b8" }}>
                      {selectedQtyProcess || ""}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#64748b",
                    }}
                  >
                    <ChevronDown
                      size={15}
                      style={{
                        transform: qtyProcessDropdownOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>

                  {qtyProcessDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      <div
                        style={{
                          background: "#f1f5f9",
                          padding: "6px 12px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#475569",
                        }}
                      >
                        Danh sách quy trình sản xuất
                      </div>
                      {[
                        "QT-SOI-DET - Quy trình sản xuất Sợi - Dệt - Nhuộm",
                        "QT-CO-KHI - Quy trình gia công Cơ khí chính xác (Cắt -> Phay CNC -> Hoàn thiện)",
                        "QT-MAY-MAC - Quy trình may mặc thời trang công nghiệp",
                        "QT-CHE-BIEN - Quy trình chế biến thực phẩm đóng hộp",
                      ].map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setSelectedQtyProcess(name);
                            setQtyProcessDropdownOpen(false);
                          }}
                          style={{
                            padding: "8px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            borderBottom: "1px solid #f8fafc",
                            background: selectedQtyProcess === name ? "#f0fdf4" : "transparent",
                            color: selectedQtyProcess === name ? "#00a862" : "#1e293b",
                            fontWeight: selectedQtyProcess === name ? 600 : 400,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              selectedQtyProcess === name ? "#f0fdf4" : "transparent")
                          }
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons matching Screenshot 2 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "10px 20px 16px 20px",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectQtyPeriodModalOpen(false);
                  setQtyPeriodDropdownOpen(false);
                  setQtyProcessDropdownOpen(false);
                }}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
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
                onClick={handleConfirmSelectQtyPeriod}
                style={{
                  padding: "6px 22px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHỌN KỲ TÍNH GIÁ THÀNH (CHUYỂN CÔNG ĐOẠN - SCREENSHOT 2) */}
      {/* ==================================================================== */}
      {selectStageTransferPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            setSelectStageTransferPeriodModalOpen(false);
            setStageTransferPeriodDropdownOpen(false);
            setStageTransferProcessDropdownOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              overflow: "visible",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header matching Screenshot 2 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px 10px 20px",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => notify("Hướng dẫn chọn kỳ tính giá thành để chuyển công đoạn")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => {
                    setSelectStageTransferPeriodModalOpen(false);
                    setStageTransferPeriodDropdownOpen(false);
                    setStageTransferProcessDropdownOpen(false);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form Fields matching Screenshot 2 */}
            <div style={{ padding: "12px 20px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Field 1: Kỳ tính giá thành (Gray border) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                  Kỳ tính giá thành
                </label>
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => {
                      setStageTransferPeriodDropdownOpen(!stageTransferPeriodDropdownOpen);
                      setStageTransferProcessDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 34,
                      padding: "6px 30px 6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: selectedStageTransferPeriod ? "#0f172a" : "#94a3b8" }}>
                      {selectedStageTransferPeriod || ""}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#64748b",
                    }}
                  >
                    <ChevronDown
                      size={15}
                      style={{
                        transform: stageTransferPeriodDropdownOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>

                  {stageTransferPeriodDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      <div
                        style={{
                          background: "#f1f5f9",
                          padding: "6px 12px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#475569",
                        }}
                      >
                        Danh sách kỳ tính giá thành
                      </div>
                      {[
                        ...(stepPeriods.map((p) => p.name)),
                        "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026",
                        "Kỳ tính giá thành từ ngày 01/09/2026 đến ngày 30/09/2026",
                        "Kỳ tính giá thành Quý 3/2026",
                      ].filter((v, idx, arr) => arr.indexOf(v) === idx).map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setSelectedStageTransferPeriod(name);
                            setStageTransferPeriodDropdownOpen(false);
                          }}
                          style={{
                            padding: "8px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            borderBottom: "1px solid #f8fafc",
                            background: selectedStageTransferPeriod === name ? "#f0fdf4" : "transparent",
                            color: selectedStageTransferPeriod === name ? "#00a862" : "#1e293b",
                            fontWeight: selectedStageTransferPeriod === name ? 600 : 400,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              selectedStageTransferPeriod === name ? "#f0fdf4" : "transparent")
                          }
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Field 2: Quy trình sản xuất (Gray border) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                  Quy trình sản xuất
                </label>
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => {
                      setStageTransferProcessDropdownOpen(!stageTransferProcessDropdownOpen);
                      setStageTransferPeriodDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 34,
                      padding: "6px 30px 6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: selectedStageTransferProcess ? "#0f172a" : "#94a3b8" }}>
                      {selectedStageTransferProcess || ""}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#64748b",
                    }}
                  >
                    <ChevronDown
                      size={15}
                      style={{
                        transform: stageTransferProcessDropdownOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>

                  {stageTransferProcessDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      <div
                        style={{
                          background: "#f1f5f9",
                          padding: "6px 12px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#475569",
                        }}
                      >
                        Danh sách quy trình sản xuất
                      </div>
                      {[
                        "QT-SOI-DET - Quy trình sản xuất Sợi - Dệt - Nhuộm",
                        "QT-CO-KHI - Quy trình gia công Cơ khí chính xác (Cắt -> Phay CNC -> Hoàn thiện)",
                        "QT-MAY-MAC - Quy trình may mặc thời trang công nghiệp",
                        "QT-CHE-BIEN - Quy trình chế biến thực phẩm đóng hộp",
                      ].map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setSelectedStageTransferProcess(name);
                            setStageTransferProcessDropdownOpen(false);
                          }}
                          style={{
                            padding: "8px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            borderBottom: "1px solid #f8fafc",
                            background: selectedStageTransferProcess === name ? "#f0fdf4" : "transparent",
                            color: selectedStageTransferProcess === name ? "#00a862" : "#1e293b",
                            fontWeight: selectedStageTransferProcess === name ? 600 : 400,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              selectedStageTransferProcess === name ? "#f0fdf4" : "transparent")
                          }
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons matching Screenshot 2 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "10px 20px 16px 20px",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectStageTransferPeriodModalOpen(false);
                  setStageTransferPeriodDropdownOpen(false);
                  setStageTransferProcessDropdownOpen(false);
                }}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
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
                onClick={handleConfirmSelectStageTransferPeriod}
                style={{
                  padding: "6px 22px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHỌN KỲ TÍNH GIÁ THÀNH (PHÂN BỔ CHI PHÍ CHUNG - SCREENSHOT 4) */}
      {/* ==================================================================== */}
      {selectAllocGeneralPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            setSelectAllocGeneralPeriodModalOpen(false);
            setAllocGeneralPeriodDropdownOpen(false);
            setAllocGeneralProcessDropdownOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              overflow: "visible",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header matching Screenshot 4 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px 10px 20px",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => notify("Hướng dẫn chọn kỳ tính giá thành để phân bổ chi phí chung")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
                  onClick={() => {
                    setSelectAllocGeneralPeriodModalOpen(false);
                    setAllocGeneralPeriodDropdownOpen(false);
                    setAllocGeneralProcessDropdownOpen(false);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form Fields matching Screenshot 4 */}
            <div style={{ padding: "12px 20px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Field 1: Kỳ tính giá thành (Active green border) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                  Kỳ tính giá thành
                </label>
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => {
                      setAllocGeneralPeriodDropdownOpen(!allocGeneralPeriodDropdownOpen);
                      setAllocGeneralProcessDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 34,
                      padding: "6px 30px 6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1.5px solid #00a862",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: selectedAllocGeneralPeriod ? "#0f172a" : "#94a3b8", display: "flex", alignItems: "center" }}>
                      {selectedAllocGeneralPeriod || (
                        <span style={{ display: "inline-block", width: "1px", height: "14px", background: "#0f172a" }}>|</span>
                      )}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#64748b",
                    }}
                  >
                    <ChevronDown
                      size={15}
                      style={{
                        transform: allocGeneralPeriodDropdownOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>

                  {allocGeneralPeriodDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      <div
                        style={{
                          background: "#f1f5f9",
                          padding: "6px 12px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#475569",
                        }}
                      >
                        Danh sách kỳ tính giá thành
                      </div>
                      {[
                        ...(stepPeriods.map((p) => p.name)),
                        "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026",
                        "Kỳ tính giá thành từ ngày 01/09/2026 đến ngày 30/09/2026",
                        "Kỳ tính giá thành Quý 3/2026",
                      ].filter((v, idx, arr) => arr.indexOf(v) === idx).map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setSelectedAllocGeneralPeriod(name);
                            setAllocGeneralPeriodDropdownOpen(false);
                          }}
                          style={{
                            padding: "8px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            borderBottom: "1px solid #f8fafc",
                            background: selectedAllocGeneralPeriod === name ? "#f0fdf4" : "transparent",
                            color: selectedAllocGeneralPeriod === name ? "#00a862" : "#1e293b",
                            fontWeight: selectedAllocGeneralPeriod === name ? 600 : 400,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              selectedAllocGeneralPeriod === name ? "#f0fdf4" : "transparent")
                          }
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Field 2: Quy trình sản xuất (Gray border) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                  Quy trình sản xuất
                </label>
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => {
                      setAllocGeneralProcessDropdownOpen(!allocGeneralProcessDropdownOpen);
                      setAllocGeneralPeriodDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 34,
                      padding: "6px 30px 6px 10px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: selectedAllocGeneralProcess ? "#0f172a" : "#94a3b8" }}>
                      {selectedAllocGeneralProcess || ""}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#64748b",
                    }}
                  >
                    <ChevronDown
                      size={15}
                      style={{
                        transform: allocGeneralProcessDropdownOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>

                  {allocGeneralProcessDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      <div
                        style={{
                          background: "#f1f5f9",
                          padding: "6px 12px",
                          borderBottom: "1px solid #e2e8f0",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#475569",
                        }}
                      >
                        Danh sách quy trình sản xuất
                      </div>
                      {[
                        "QT-SOI-DET - Quy trình sản xuất Sợi - Dệt - Nhuộm",
                        "QT-CO-KHI - Quy trình gia công Cơ khí chính xác (Cắt -> Phay CNC -> Hoàn thiện)",
                        "QT-MAY-MAC - Quy trình may mặc thời trang công nghiệp",
                        "QT-CHE-BIEN - Quy trình chế biến thực phẩm đóng hộp",
                      ].map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setSelectedAllocGeneralProcess(name);
                            setAllocGeneralProcessDropdownOpen(false);
                          }}
                          style={{
                            padding: "8px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            borderBottom: "1px solid #f8fafc",
                            background: selectedAllocGeneralProcess === name ? "#f0fdf4" : "transparent",
                            color: selectedAllocGeneralProcess === name ? "#00a862" : "#1e293b",
                            fontWeight: selectedAllocGeneralProcess === name ? 600 : 400,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              selectedAllocGeneralProcess === name ? "#f0fdf4" : "transparent")
                          }
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons matching Screenshot 4 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "10px 20px 16px 20px",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectAllocGeneralPeriodModalOpen(false);
                  setAllocGeneralPeriodDropdownOpen(false);
                  setAllocGeneralProcessDropdownOpen(false);
                }}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
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
                onClick={handleConfirmSelectAllocGeneralPeriod}
                style={{
                  padding: "6px 22px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHỌN ĐỐI TƯỢNG TẬP HỢP CHI PHÍ */}
      {/* ==================================================================== */}
      {pickCostObjModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPickCostObjModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 600,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn đối tượng tập hợp chi phí
              </h3>
              <button
                type="button"
                onClick={() => setPickCostObjModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto" }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#dff0e4" }}>
                      <th style={{ width: 40, padding: "8px", textAlign: "center" }}></th>
                      <th style={{ width: 120, padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Mã</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Tên</th>
                      <th style={{ width: 130, padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Loại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "PX-CK", name: "Phân xưởng Cơ khí chế tạo", type: "Phân xưởng" },
                      { code: "PX-MAY", name: "Phân xưởng May xuất khẩu", type: "Phân xưởng" },
                      { code: "PX-DONGGOI", name: "Phân xưởng Đóng gói & Hoàn thiện", type: "Phân xưởng" },
                      { code: "PX-SOIE", name: "Phân xưởng Kéo sợi tổng hợp", type: "Phân xưởng" },
                      { code: "SP-BAN01", name: "Bàn inox cao cấp 1.2m", type: "Sản phẩm" },
                      { code: "SP-GHE01", name: "Ghế tựa inox 304", type: "Sản phẩm" },
                      { code: "SP-TUDONG", name: "Tủ đông bảo quản công nghiệp", type: "Sản phẩm" },
                    ].map((item) => {
                      const isSelected = selectedCostObjects.some((o) => o.code === item.code);
                      return (
                        <tr
                          key={item.code}
                          style={{
                            borderTop: "1px solid #f1f5f9",
                            background: isSelected ? "#f0fdf4" : "transparent",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCostObjects((prev) => prev.filter((x) => x.code !== item.code));
                            } else {
                              setSelectedCostObjects((prev) => [...prev, item]);
                            }
                          }}
                        >
                          <td style={{ textAlign: "center", padding: "8px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: "pointer", accentColor: "#00a862" }}
                            />
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                          <td style={{ padding: "8px 12px" }}>{item.name}</td>
                          <td style={{ padding: "8px 12px", color: "#64748b" }}>{item.type}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setPickCostObjModalOpen(false)}
                style={{
                  padding: "6px 20px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setPickCostObjModalOpen(false);
                  notify(`Đã cập nhật danh sách đối tượng tập hợp chi phí!`);
                }}
                style={{
                  padding: "6px 24px",
                  border: "none",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. MODAL: CHI PHÍ DỞ DANG ĐẦU KỲ (HỆ SỐ, TỶ LỆ) */}
      {/* ==================================================================== */}
      {wipOpeningModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setWipOpeningModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 900,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chi phí dở dang đầu kỳ (Sản xuất liên tục - Hệ số, tỷ lệ)
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => notify("Hướng dẫn khai báo chi phí dở dang đầu kỳ")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => setWipOpeningModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  Khai báo chi phí dở dang đầu kỳ theo từng khoản mục chi phí cho các đối tượng tập hợp chi phí.
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => notify("Đã xuất khẩu dữ liệu chi phí dở dang ra file Excel")}
                    style={{ padding: "5px 12px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, fontSize: 12.5, cursor: "pointer" }}
                  >
                    Xuất khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => notify("Mở giao diện nhập khẩu số dư từ Excel")}
                    style={{ padding: "5px 12px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, fontSize: 12.5, cursor: "pointer" }}
                  >
                    Nhập khẩu
                  </button>
                </div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#dff0e4", color: "#1e293b" }}>
                      <th style={{ width: 120, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Mã ĐT THCP</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Tên đối tượng THCP</th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Chi phí NVLTT (621)</th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Chi phí NCTT (622)</th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Chi phí SXC (627)</th>
                      <th style={{ width: 150, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Tổng dở dang ĐK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "PX-DUC", name: "Phân xưởng Đúc gang thép", c621: 18500000, c622: 8200000, c627: 7300000 },
                      { code: "PX-CK", name: "Phân xưởng Cơ khí chế tạo", c621: 12000000, c622: 4500000, c627: 2000000 },
                      { code: "PX-MAY", name: "Phân xưởng May xuất khẩu", c621: 16000000, c622: 6200000, c627: 2800000 },
                    ].map((row) => {
                      const total = row.c621 + row.c622 + row.c627;
                      return (
                        <tr key={row.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                          <td style={{ padding: "8px 10px" }}>{row.name}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatMoney(row.c621)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatMoney(row.c622)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatMoney(row.c627)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#d97706" }}>
                            {formatMoney(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #e2e8f0" }}>
                      <td colSpan={2} style={{ padding: "8px 10px", textAlign: "center" }}>Tổng cộng</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatMoney(46500000)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatMoney(18900000)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatMoney(12100000)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#d97706" }}>{formatMoney(77500000)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setWipOpeningModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã cất số liệu chi phí dở dang đầu kỳ thành công!");
                  setWipOpeningModalOpen(false);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. MODAL: KHAI BÁO ĐỊNH MỨC GIÁ THÀNH (HỆ SỐ, TỶ LỆ) */}
      {/* ==================================================================== */}
      {normCostModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setNormCostModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 880,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Khai báo định mức giá thành (Hệ số, tỷ lệ)
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => notify("Hướng dẫn thiết lập hệ số, tỷ lệ định mức giá thành")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => setNormCostModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Thiết lập hệ số hoặc tỷ lệ giữa các thành phẩm sản xuất trong cùng một phân xưởng quy về sản phẩm chuẩn.
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#dff0e4", color: "#1e293b" }}>
                      <th style={{ width: 110, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Mã TP</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Tên thành phẩm</th>
                      <th style={{ width: 80, padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>ĐVT</th>
                      <th style={{ width: 120, padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>Sản phẩm chuẩn</th>
                      <th style={{ width: 110, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Hệ số</th>
                      <th style={{ width: 100, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Tỷ lệ (%)</th>
                      <th style={{ width: 160, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Phân xưởng áp dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "OG-60", name: "Ống gang đúc phi 60mm", unit: "Mét", standard: true, factor: "1,00", pct: "100%", ws: "Phân xưởng Đúc" },
                      { code: "OG-90", name: "Ống gang đúc phi 90mm", unit: "Mét", standard: false, factor: "1,50", pct: "150%", ws: "Phân xưởng Đúc" },
                      { code: "OG-110", name: "Ống gang đúc phi 110mm", unit: "Mét", standard: false, factor: "1,85", pct: "185%", ws: "Phân xưởng Đúc" },
                      { code: "CG-90", name: "Cút nối gang đúc 90 độ", unit: "Cái", standard: false, factor: "0,65", pct: "65%", ws: "Phân xưởng Đúc" },
                    ].map((row) => (
                      <tr key={row.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                        <td style={{ padding: "8px 10px" }}>{row.name}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{row.unit}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            background: row.standard ? "#dcfce7" : "#f1f5f9",
                            color: row.standard ? "#166534" : "#64748b",
                          }}>
                            {row.standard ? "Chuẩn (= 1.0)" : "Theo chuẩn"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{row.factor}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#00a862", fontWeight: 700 }}>{row.pct}</td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.ws}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setNormCostModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã cất định mức giá thành hệ số, tỷ lệ thành công!");
                  setNormCostModalOpen(false);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. MODAL: KHAI BÁO ĐỊNH MỨC PHÂN BỔ CHI PHÍ */}
      {/* ==================================================================== */}
      {normAllocModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setNormAllocModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 850,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Khai báo định mức phân bổ chi phí
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => notify("Hướng dẫn khai báo định mức phân bổ chi phí")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => setNormAllocModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Thiết lập tiêu thức phân bổ chi phí chung và chi phí nhân công cho các đối tượng tập hợp chi phí.
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#dff0e4", color: "#1e293b" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Khoản mục chi phí</th>
                      <th style={{ width: 90, padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>Tài khoản</th>
                      <th style={{ width: 220, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Tiêu thức phân bổ mặc định</th>
                      <th style={{ width: 100, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Tỷ lệ (%)</th>
                      <th style={{ width: 180, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { item: "Chi phí nhân công trực tiếp", acc: "622", method: "Theo chi phí NVL trực tiếp", pct: "100%", note: "Phân xưởng Đúc" },
                      { item: "Chi phí nhân công gián tiếp SX", acc: "6271", method: "Theo chi phí nhân công trực tiếp", pct: "100%", note: "Quản lý phân xưởng" },
                      { item: "Chi phí vật liệu SXC", acc: "6272", method: "Theo định mức giá thành", pct: "100%", note: "Nhiên liệu, dầu mỡ" },
                      { item: "Chi phí khấu hao máy đúc CNC", acc: "6274", method: "Theo giờ máy chạy thực tế", pct: "100%", note: "Máy đúc lò điện" },
                      { item: "Chi phí dịch vụ điện nước ngoài", acc: "6277", method: "Theo sản lượng sản phẩm quy đổi", pct: "100%", note: "Điện 3 pha sản xuất" },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.item}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#2563eb" }}>{row.acc}</td>
                        <td style={{ padding: "8px 10px" }}>{row.method}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#00a862" }}>{row.pct}</td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setNormAllocModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã cất định mức phân bổ chi phí thành công!");
                  setNormAllocModalOpen(false);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MODAL: KHAI BÁO GIÁ THÀNH KẾ HOẠCH */}
      {/* ==================================================================== */}
      {plannedCostModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPlannedCostModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 820,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Khai báo giá thành kế hoạch
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => notify("Hướng dẫn khai báo giá thành kế hoạch sản phẩm")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => setPlannedCostModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Giá thành kế hoạch được sử dụng làm căn cứ tính tỷ lệ giá thành và phân bổ chi phí sản xuất thực tế.
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#dff0e4", color: "#1e293b" }}>
                      <th style={{ width: 120, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Mã TP</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Tên thành phẩm</th>
                      <th style={{ width: 80, padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>ĐVT</th>
                      <th style={{ width: 160, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Giá thành kế hoạch</th>
                      <th style={{ width: 110, padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>Ngày áp dụng</th>
                      <th style={{ width: 150, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "OG-60", name: "Ống gang đúc phi 60mm", unit: "Mét", cost: 185000, date: "01/01/2026", note: "Kế hoạch năm 2026" },
                      { code: "OG-90", name: "Ống gang đúc phi 90mm", unit: "Mét", cost: 277500, date: "01/01/2026", note: "Kế hoạch năm 2026" },
                      { code: "OG-110", name: "Ống gang đúc phi 110mm", unit: "Mét", cost: 342250, date: "01/01/2026", note: "Kế hoạch năm 2026" },
                      { code: "CG-90", name: "Cút nối gang đúc 90 độ", unit: "Cái", cost: 120000, date: "01/01/2026", note: "Kế hoạch năm 2026" },
                    ].map((row) => (
                      <tr key={row.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                        <td style={{ padding: "8px 10px" }}>{row.name}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{row.unit}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>
                          {formatMoney(row.cost)}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{row.date}</td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setPlannedCostModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã cất giá thành kế hoạch thành công!");
                  setPlannedCostModalOpen(false);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}
          {/* ==================================================================== */}
      {/* 5. MODALS CÔNG TRÌNH (PROJECTS) */}
      {/* ==================================================================== */}

      {/* 5A. MODAL: THÊM KỲ TÍNH GIÁ THÀNH CÔNG TRÌNH */}
      {addProjectPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAddProjectPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Thêm kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => notify("Hướng dẫn thêm kỳ tính giá thành công trình")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => setAddProjectPeriodModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Row 1: Kỳ, Từ ngày, Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 140px 140px", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Kỳ</label>
                  <select
                    value={projectPeriodType}
                    onChange={(e) =>
                      handleGenericPresetChange(
                        e.target.value,
                        setProjectPeriodType,
                        setProjectFromDate,
                        setProjectToDate,
                        setProjectPeriodName
                      )
                    }
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  >
                    <option>Hôm nay</option>
                    <option>Tuần này</option>
                    <option>Tháng này</option>
                    <option>Tháng trước</option>
                    <option>Quý này</option>
                    <option>Quý 3</option>
                    <option>Năm nay</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Từ ngày</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={projectFromDate}
                      onChange={(e) => setProjectFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 28px 6px 8px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                    <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Đến ngày</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={projectToDate}
                      onChange={(e) => setProjectToDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 28px 6px 8px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                    <Calendar size={14} color="#64748b" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }} />
                  </div>
                </div>
              </div>

              {/* Row 2: Tên * & Lấy dữ liệu */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                    Tên <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={projectPeriodName}
                    onChange={(e) => setProjectPeriodName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProjectModalItems([
                      { code: "CT-SKYTOWER", name: "Tòa nhà Sky Tower Discovery Complex", type: "Dân dụng cao tầng" },
                      { code: "CT-VIN-OCEAN", name: "Khu đô thị Vinhomes Ocean Park phân khu 2", type: "Hạ tầng đô thị" },
                      { code: "CT-CAU-NHATHAN", name: "Cầu vượt cạn Nhật Tân kéo dài", type: "Cầu đường bộ" },
                    ]);
                    notify("Đã lấy danh sách công trình phát sinh chi phí trong kỳ!");
                  }}
                  style={{
                    padding: "6px 16px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Lấy dữ liệu
                </button>
              </div>

              {/* Subheader & Search */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>Công trình cần tập hợp chi phí</span>
                <div style={{ position: "relative", width: 220 }}>
                  <input
                    type="text"
                    placeholder="Nhập từ khóa tìm kiếm"
                    value={projectModalSearch}
                    onChange={(e) => setProjectModalSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 28px 5px 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                  <Search size={14} color="#94a3b8" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }} />
                </div>
              </div>

              {/* Table */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden", minHeight: 140 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#1e293b" }}>
                      <th style={{ width: 150, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Mã công trình</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Tên công trình</th>
                      <th style={{ width: 160, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Loại công trình</th>
                      <th style={{ width: 45, padding: "8px 10px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectModalItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                          Chưa có công trình. Bấm '+ Chọn công trình' hoặc 'Lấy dữ liệu'.
                        </td>
                      </tr>
                    ) : (
                      projectModalItems
                        .filter(
                          (item) =>
                            !projectModalSearch ||
                            item.code.toLowerCase().includes(projectModalSearch.toLowerCase()) ||
                            item.name.toLowerCase().includes(projectModalSearch.toLowerCase())
                        )
                        .map((item) => (
                          <tr key={item.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                            <td style={{ padding: "8px 10px" }}>{item.name}</td>
                            <td style={{ padding: "8px 10px", color: "#64748b" }}>{item.type}</td>
                            <td style={{ padding: "8px 10px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => setProjectModalItems(projectModalItems.filter((i) => i.code !== item.code))}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons under Table */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const newCode = `CT-00${projectModalItems.length + 1}`;
                      setProjectModalItems([
                        ...projectModalItems,
                        { code: newCode, name: `Công trình thi công xây dựng mới ${projectModalItems.length + 1}`, type: "Xây dựng công nghiệp" },
                      ]);
                    }}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "5px 12px",
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Plus size={14} />
                    <span>Chọn công trình</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProjectModalItems([])}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "5px 12px",
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#dc2626",
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>

                <div style={{ fontSize: 12, color: "#64748b" }}>
                  ⓘ Nếu không thấy công trình, bạn vui lòng xem hướng dẫn{" "}
                  <span
                    onClick={() => notify("Xem hướng dẫn khai báo đối tượng công trình")}
                    style={{ color: "#00a862", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                  >
                    TẠI ĐÂY
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setAddProjectPeriodModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã cất "${projectPeriodName}" thành công!`);
                  setAddProjectPeriodModalOpen(false);
                  setShowProjectPeriodList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5B. MODAL: CHỌN KỲ TÍNH GIÁ THÀNH KẾT CHUYỂN CÔNG TRÌNH */}
      {selectProjectTransferPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectProjectTransferPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn kỳ tính giá thành
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => notify("Hướng dẫn chọn kỳ tính giá thành để kết chuyển")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => setSelectProjectTransferPeriodModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                Kỳ tính giá thành <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={selectedProjectTransferPeriod || "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"}
                onChange={(e) => setSelectedProjectTransferPeriod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 4,
                  border: "1.5px solid #00a862",
                  fontSize: 13,
                  background: "#ffffff",
                  outline: "none",
                }}
              >
                <option value="Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026">
                  Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026
                </option>
                <option value="Kỳ tính giá thành từ ngày 01/09/2026 đến ngày 30/09/2026">
                  Kỳ tính giá thành từ ngày 01/09/2026 đến ngày 30/09/2026
                </option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectProjectTransferPeriodModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã thực hiện kết chuyển chi phí từ TK 621, 622, 627 sang TK 154 theo công trình!");
                  setSelectProjectTransferPeriodModalOpen(false);
                  setShowProjectTransferList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5C. MODAL/DRAWER: CHỌN CÔNG TRÌNH NGHIỆM THU */}
      {projectAcceptanceModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setProjectAcceptanceModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chọn công trình nghiệm thu
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Trợ giúp"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => notify("Hướng dẫn nghiệm thu công trình")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  onClick={() => setProjectAcceptanceModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                    Kỳ tính giá thành <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={selectedProjectAcceptancePeriod || "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"}
                    onChange={(e) => setSelectedProjectAcceptancePeriod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  >
                    <option value="Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026">
                      Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026
                    </option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => notify("Đã lấy dữ liệu công trình sẵn sàng nghiệm thu!")}
                  style={{
                    padding: "6px 16px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Lấy dữ liệu
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selectedAcceptanceProjects.length === 2}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedAcceptanceProjects(["CT-SKYTOWER", "CT-CAU-NHATHAN"]);
                      else setSelectedAcceptanceProjects([]);
                    }}
                    style={{ accentColor: "#00a862" }}
                  />
                  <span>Chọn tất cả</span>
                </div>
                <div style={{ position: "relative", width: 220 }}>
                  <input
                    type="text"
                    placeholder="Tìm mã, tên công trình"
                    value={acceptanceProjectSearch}
                    onChange={(e) => setAcceptanceProjectSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 28px 5px 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                  <Search size={14} color="#94a3b8" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }} />
                </div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#1e293b" }}>
                      <th style={{ width: 40, padding: "8px 10px", textAlign: "center" }}></th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Mã công trình 📌</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Tên công trình</th>
                      <th style={{ width: 150, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Doanh thu</th>
                      <th style={{ width: 150, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Số chưa nghiệm thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "CT-SKYTOWER", name: "Tòa nhà Sky Tower Discovery Complex", rev: 1250000000, unacc: 850000000 },
                      { code: "CT-CAU-NHATHAN", name: "Cầu vượt cạn Nhật Tân kéo dài", rev: 2400000000, unacc: 1620000000 },
                    ]
                      .filter((row) => !acceptanceProjectSearch || row.code.toLowerCase().includes(acceptanceProjectSearch.toLowerCase()) || row.name.toLowerCase().includes(acceptanceProjectSearch.toLowerCase()))
                      .map((row) => {
                        const checked = selectedAcceptanceProjects.includes(row.code);
                        return (
                          <tr key={row.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedAcceptanceProjects([...selectedAcceptanceProjects, row.code]);
                                  else setSelectedAcceptanceProjects(selectedAcceptanceProjects.filter((c) => c !== row.code));
                                }}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                            <td style={{ padding: "8px 10px" }}>{row.name}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(row.rev)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(row.unacc)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setProjectAcceptanceModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã nghiệm thu ${selectedAcceptanceProjects.length} công trình sang TK 632!`);
                  setProjectAcceptanceModalOpen(false);
                  setShowProjectAcceptanceList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5D. MODAL: THÊM ĐỊNH MỨC NGUYÊN VẬT LIỆU CÔNG TRÌNH */}
      {addProjectNormModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAddProjectNormModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 860,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Thêm định mức nguyên vật liệu công trình
              </h3>
              <button
                type="button"
                onClick={() => setAddProjectNormModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                    Công trình <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={selectedProjectForNorm}
                    onChange={(e) => setSelectedProjectForNorm(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}
                  >
                    <option value="CT-SKYTOWER - Tòa nhà Sky Tower Discovery Complex">CT-SKYTOWER - Tòa nhà Sky Tower Discovery Complex</option>
                    <option value="CT-VIN-OCEAN - Khu đô thị Vinhomes Ocean Park phân khu 2">CT-VIN-OCEAN - Khu đô thị Vinhomes Ocean Park phân khu 2</option>
                    <option value="CT-CAU-NHATHAN - Cầu vượt cạn Nhật Tân kéo dài">CT-CAU-NHATHAN - Cầu vượt cạn Nhật Tân kéo dài</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Áp dụng từ ngày</label>
                  <input
                    type="text"
                    value={projectNormFromDate}
                    onChange={(e) => setProjectNormFromDate(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Đến ngày</label>
                  <input
                    type="text"
                    value={projectNormToDate}
                    onChange={(e) => setProjectNormToDate(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Diễn giải</label>
                <input
                  type="text"
                  value={projectNormDesc}
                  onChange={(e) => setProjectNormDesc(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#1e293b" }}>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Mã NVL</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Tên NVL</th>
                      <th style={{ width: 70, padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>ĐVT</th>
                      <th style={{ width: 110, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Số lượng ĐM</th>
                      <th style={{ width: 120, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Đơn giá ĐM</th>
                      <th style={{ width: 130, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Thành tiền</th>
                      <th style={{ width: 45, padding: "8px 10px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectNormLines.map((row) => (
                      <tr key={row.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                        <td style={{ padding: "8px 10px" }}>{row.name}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{row.unit}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{row.qty.toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatMoney(row.price)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatMoney(row.amount)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setProjectNormLines(projectNormLines.filter((l) => l.id !== row.id))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const newId = projectNormLines.length + 1;
                    setProjectNormLines([
                      ...projectNormLines,
                      { id: newId, code: `NVL-NEW-${newId}`, name: `Vật liệu mới ${newId}`, unit: "Kg", qty: 10, price: 50000, amount: 500000 },
                    ]);
                  }}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "5px 12px",
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Plus size={14} />
                  <span>Thêm dòng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProjectNormLines([])}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "5px 12px",
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#dc2626",
                  }}
                >
                  <Trash2 size={14} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setAddProjectNormModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã cất định mức NVL công trình thành công!");
                  setAddProjectNormModalOpen(false);
                  setShowProjectNormList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã cất và sẵn sàng thêm định mức mới!");
                }}
                style={{ padding: "6px 18px", border: "1px solid #00a862", borderRadius: 4, background: "#ffffff", color: "#00a862", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất & Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODALS ĐƠN HÀNG (ORDERS) */}
      {/* ==================================================================== */}

      {/* 6A. MODAL: THÊM KỲ TÍNH GIÁ THÀNH ĐƠN HÀNG */}
      {addOrderPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAddOrderPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Thêm kỳ tính giá thành đơn hàng
              </h3>
              <button
                type="button"
                onClick={() => setAddOrderPeriodModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 140px 140px", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Kỳ</label>
                  <select
                    value={orderPeriodType}
                    onChange={(e) =>
                      handleGenericPresetChange(
                        e.target.value,
                        setOrderPeriodType,
                        setOrderFromDate,
                        setOrderToDate,
                        setOrderPeriodName
                      )
                    }
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}
                  >
                    <option>Tháng này</option>
                    <option>Tháng trước</option>
                    <option>Quý này</option>
                    <option>Năm nay</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Từ ngày</label>
                  <input
                    type="text"
                    value={orderFromDate}
                    onChange={(e) => setOrderFromDate(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Đến ngày</label>
                  <input
                    type="text"
                    value={orderToDate}
                    onChange={(e) => setOrderToDate(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                    Tên kỳ <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={orderPeriodName}
                    onChange={(e) => setOrderPeriodName(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => notify("Đã lấy danh sách đơn hàng trong kỳ!")}
                  style={{ padding: "6px 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
                >
                  Lấy dữ liệu
                </button>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden", minHeight: 120 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#1e293b" }}>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Số đơn hàng</th>
                      <th style={{ width: 120, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Ngày đơn hàng</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Khách hàng</th>
                      <th style={{ width: 45, padding: "8px 10px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderModalItems.map((item) => (
                      <tr key={item.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                        <td style={{ padding: "8px 10px" }}>{item.date}</td>
                        <td style={{ padding: "8px 10px" }}>{item.customer}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setOrderModalItems(orderModalItems.filter((i) => i.code !== item.code))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const newCode = `DH2026-0${110 + orderModalItems.length}`;
                    setOrderModalItems([...orderModalItems, { code: newCode, date: "20/10/2026", customer: "Khách hàng doanh nghiệp mới" }]);
                  }}
                  style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Plus size={14} />
                  <span>Chọn đơn hàng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderModalItems([])}
                  style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#dc2626" }}
                >
                  <Trash2 size={14} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setAddOrderPeriodModalOpen(false)}
                style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã cất "${orderPeriodName}" thành công!`);
                  setAddOrderPeriodModalOpen(false);
                  setShowOrderPeriodList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6B. MODAL: CHỌN KỲ TÍNH GIÁ THÀNH KẾT CHUYỂN ĐƠN HÀNG */}
      {selectOrderTransferPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectOrderTransferPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>Chọn kỳ tính giá thành</h3>
              <button type="button" onClick={() => setSelectOrderTransferPeriodModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                Kỳ tính giá thành <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={selectedOrderTransferPeriod || "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"}
                onChange={(e) => setSelectedOrderTransferPeriod(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1.5px solid #00a862", fontSize: 13, background: "#ffffff" }}
              >
                <option value="Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026">
                  Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026
                </option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button type="button" onClick={() => setSelectOrderTransferPeriodModalOpen(false)} style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}>Hủy</button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã thực hiện kết chuyển chi phí từ TK 621, 622, 627 sang TK 154 theo đơn hàng!");
                  setSelectOrderTransferPeriodModalOpen(false);
                  setShowOrderTransferList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6C. MODAL/DRAWER: CHỌN ĐƠN HÀNG NGHIỆM THU */}
      {orderAcceptanceModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setOrderAcceptanceModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>Chọn đơn hàng nghiệm thu</h3>
              <button type="button" onClick={() => setOrderAcceptanceModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#1e293b" }}>
                      <th style={{ width: 40, padding: "8px 10px", textAlign: "center" }}></th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Số đơn hàng 📌</th>
                      <th style={{ width: 120, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Ngày đơn hàng</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Khách hàng</th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Doanh thu</th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Số chưa nghiệm thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "DH2026-0089", date: "05/10/2026", customer: "Công ty TNHH Á Châu", rev: 245000000, unacc: 165000000 },
                      { code: "DH2026-0092", date: "12/10/2026", customer: "Tập đoàn Hòa Bình", rev: 350000000, unacc: 233000000 },
                    ].map((row) => (
                      <tr key={row.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedAcceptanceOrders.includes(row.code)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAcceptanceOrders([...selectedAcceptanceOrders, row.code]);
                              else setSelectedAcceptanceOrders(selectedAcceptanceOrders.filter((c) => c !== row.code));
                            }}
                            style={{ accentColor: "#00a862" }}
                          />
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                        <td style={{ padding: "8px 10px" }}>{row.date}</td>
                        <td style={{ padding: "8px 10px" }}>{row.customer}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(row.rev)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(row.unacc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button type="button" onClick={() => setOrderAcceptanceModalOpen(false)} style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}>Hủy</button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã nghiệm thu ${selectedAcceptanceOrders.length} đơn hàng sang TK 632!`);
                  setOrderAcceptanceModalOpen(false);
                  setShowOrderAcceptanceList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. MODALS HỢP ĐỒNG (CONTRACTS) */}
      {/* ==================================================================== */}

      {/* 7A. MODAL: THÊM KỲ TÍNH GIÁ THÀNH HỢP ĐỒNG */}
      {addContractPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setAddContractPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>Thêm kỳ tính giá thành hợp đồng</h3>
              <button type="button" onClick={() => setAddContractPeriodModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 140px 140px", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Kỳ</label>
                  <select
                    value={contractPeriodType}
                    onChange={(e) =>
                      handleGenericPresetChange(
                        e.target.value,
                        setContractPeriodType,
                        setContractFromDate,
                        setContractToDate,
                        setContractPeriodName
                      )
                    }
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}
                  >
                    <option>Tháng này</option>
                    <option>Tháng trước</option>
                    <option>Quý này</option>
                    <option>Năm nay</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Từ ngày</label>
                  <input
                    type="text"
                    value={contractFromDate}
                    onChange={(e) => setContractFromDate(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Đến ngày</label>
                  <input
                    type="text"
                    value={contractToDate}
                    onChange={(e) => setContractToDate(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                    Tên kỳ <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={contractPeriodName}
                    onChange={(e) => setContractPeriodName(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => notify("Đã lấy danh sách hợp đồng trong kỳ!")}
                  style={{ padding: "6px 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}
                >
                  Lấy dữ liệu
                </button>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden", minHeight: 120 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#1e293b" }}>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Số hợp đồng</th>
                      <th style={{ width: 110, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Ngày ký</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Trích yếu</th>
                      <th style={{ width: 180, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Khách hàng</th>
                      <th style={{ width: 45, padding: "8px 10px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractModalItems.map((item) => (
                      <tr key={item.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{item.code}</td>
                        <td style={{ padding: "8px 10px" }}>{item.date}</td>
                        <td style={{ padding: "8px 10px" }}>{item.note}</td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>{item.customer}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setContractModalItems(contractModalItems.filter((i) => i.code !== item.code))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const newCode = `HD-2026/0${50 + contractModalItems.length}`;
                    setContractModalItems([...contractModalItems, { code: newCode, date: "15/10/2026", note: "Cung cấp thiết bị văn phòng", customer: "Công ty Cổ phần Thương mại" }]);
                  }}
                  style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Plus size={14} />
                  <span>Chọn hợp đồng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContractModalItems([])}
                  style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#dc2626" }}
                >
                  <Trash2 size={14} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button type="button" onClick={() => setAddContractPeriodModalOpen(false)} style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}>Hủy</button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã cất "${contractPeriodName}" thành công!`);
                  setAddContractPeriodModalOpen(false);
                  setShowContractPeriodList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7B. MODAL: CHỌN KỲ TÍNH GIÁ THÀNH KẾT CHUYỂN HỢP ĐỒNG */}
      {selectContractTransferPeriodModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectContractTransferPeriodModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>Chọn kỳ tính giá thành</h3>
              <button type="button" onClick={() => setSelectContractTransferPeriodModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                Kỳ tính giá thành <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={selectedContractTransferPeriod || "Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026"}
                onChange={(e) => setSelectedContractTransferPeriod(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1.5px solid #00a862", fontSize: 13, background: "#ffffff" }}
              >
                <option value="Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026">
                  Kỳ tính giá thành từ ngày 01/10/2026 đến ngày 31/10/2026
                </option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button type="button" onClick={() => setSelectContractTransferPeriodModalOpen(false)} style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}>Hủy</button>
              <button
                type="button"
                onClick={() => {
                  notify("Đã thực hiện kết chuyển chi phí từ TK 621, 622, 627 sang TK 154 theo hợp đồng!");
                  setSelectContractTransferPeriodModalOpen(false);
                  setShowContractTransferList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7C. MODAL/DRAWER: CHỌN HỢP ĐỒNG NGHIỆM THU */}
      {contractAcceptanceModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setContractAcceptanceModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>Chọn hợp đồng nghiệm thu</h3>
              <button type="button" onClick={() => setContractAcceptanceModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#1e293b" }}>
                      <th style={{ width: 40, padding: "8px 10px", textAlign: "center" }}></th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Số hợp đồng 📌</th>
                      <th style={{ width: 110, padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Ngày ký</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>Khách hàng</th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Doanh thu</th>
                      <th style={{ width: 140, padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>Số chưa nghiệm thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "HD-2026/042", date: "02/10/2026", customer: "Ngân hàng Techcombank", rev: 520000000, unacc: 340000000 },
                      { code: "HD-2026/045", date: "10/10/2026", customer: "Công ty CP Quốc tế Vina", rev: 380000000, unacc: 240000000 },
                    ].map((row) => (
                      <tr key={row.code} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={selectedAcceptanceContracts.includes(row.code)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAcceptanceContracts([...selectedAcceptanceContracts, row.code]);
                              else setSelectedAcceptanceContracts(selectedAcceptanceContracts.filter((c) => c !== row.code));
                            }}
                            style={{ accentColor: "#00a862" }}
                          />
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{row.code}</td>
                        <td style={{ padding: "8px 10px" }}>{row.date}</td>
                        <td style={{ padding: "8px 10px" }}>{row.customer}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#2563eb", fontWeight: 600 }}>{formatMoney(row.rev)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#00a862", fontWeight: 700 }}>{formatMoney(row.unacc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button type="button" onClick={() => setContractAcceptanceModalOpen(false)} style={{ padding: "6px 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 13, cursor: "pointer" }}>Hủy</button>
              <button
                type="button"
                onClick={() => {
                  notify(`Đã nghiệm thu ${selectedAcceptanceContracts.length} hợp đồng sang TK 632!`);
                  setContractAcceptanceModalOpen(false);
                  setShowContractAcceptanceList(true);
                }}
                style={{ padding: "6px 24px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
