import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { request } from "./live-api";
import "./misa-opening.css";

export function formatOpeningMoney(amount: number | string | undefined): string {
  const num = typeof amount === "number" ? amount : Number(amount) || 0;
  return new Intl.NumberFormat("vi-VN").format(num);
}

export const OPENING_CUSTOMERS = [
  { code: "THANHHA", name: "Công ty TNHH Thanh Hà", taxCode: "110085253" },
  { code: "NHATMINH", name: "CTCP Nội thất Nhật Minh", taxCode: "801382946" },
  { code: "MINHHANH", name: "Công ty TNHH Kinh doanh Minh Hạnh", taxCode: "110086627" },
  { code: "ANHTUAN", name: "Công ty TNHH Công nghệ số Anh Tuấn", taxCode: "110094515" },
  { code: "CAUGIAY", name: "CTCP Thương mại Cầu Giấy", taxCode: "100408152" },
  { code: "HIEPPHAT", name: "Công ty TNHH Giải pháp Hiệp Phát", taxCode: "110101949" },
  { code: "BAOKIM", name: "Công ty TNHH Đầu tư Bảo Kim", taxCode: "110086049" },
  { code: "THUANPHAT", name: "Công ty TNHH Thương mại Thuận Phát", taxCode: "601238247" },
  { code: "DUYVINH", name: "Công ty TNHH Xây dựng Duy Vinh", taxCode: "700865055" },
  { code: "KIENQUAN", name: "CTCP Đầu tư Kiến Quân Việt Nam", taxCode: "107527141" },
  { code: "VIETHUNG", name: "Công ty TNHH Việt Hùng", taxCode: "102020196" },
  { code: "THAIBINH", name: "Công ty TNHH Thái Bình", taxCode: "0108804440" },
  { code: "HOANGLONG", name: "Công ty CP Hoàng Long computer", taxCode: "0105509988" },
  { code: "PHANMINH", name: "Công ty TNHH Phan Minh", taxCode: "0109905550" },
];

export const OPENING_SUPPLIERS = [
  { code: "PHATMAI", name: "Công ty TNHH Phát Mai Group", taxCode: "110084806" },
  { code: "MINHQUAN", name: "Công ty Cổ phần Minh Quân Logistics", taxCode: "110087035" },
  { code: "THANHTRU", name: "Công ty TNHH Thiết bị Thanh Trúc", taxCode: "110092821" },
  { code: "MAISON", name: "CTCP Tư vấn và Dịch vụ Bất động sản Maison", taxCode: "106639438" },
  { code: "VANPHO", name: "CTCP Vận tải và Thương mại Vạn Phát", taxCode: "200463686" },
  { code: "MEDIAZ", name: "Công ty TNHH Truyền thông AZ Việt Nam", taxCode: "402155162" },
  { code: "LOCATIO", name: "Công ty TNHH Dịch vụ Logistics Việt Hưng", taxCode: "101353160" },
  { code: "VIETGIA", name: "Công ty Cổ phần Công nghệ Việt Gia", taxCode: "101217009" },
  { code: "CONGNGHE", name: "Công ty TNHH Phát triển Công nghệ KTS", taxCode: "100366488" },
  { code: "ANLOC", name: "Công ty TNHH Thương mại Máy tính An Lộc", taxCode: "101468933" },
  { code: "TANCANG", name: "Công ty cổ phần đại lý giao nhận vận tải xếp dỡ tân cảng", taxCode: "304875444" },
  { code: "QUOCTE", name: "Công ty cổ phần đầu tư thương mại và dịch vụ quốc tế", taxCode: "100110052" },
  { code: "THANHDAT", name: "Công ty TNHH Thành Đạt", taxCode: "0101234567" },
  { code: "ANTAM", name: "CÔNG TY CỔ PHẦN VĂN PHÒNG PHẨM AN TÂM", taxCode: "2004687684" },
  { code: "BINHPHAT", name: "CTCP THƯƠNG MẠI BÌNH PHÁT", taxCode: "200433686" },
  { code: "GIANGMY", name: "CÔNG TY CỔ PHẦN ĐẦU TƯ GIANG MỸ", taxCode: "225946138" },
];

export const DEFAULT_CUSTOMER_DEBTS = [
  { id: "cust-1", code: "THANHHA", name: "Công ty TNHH Thanh Hà", accCode: "131", debit: 50000000, credit: 0, invoiceNo: "HD00125", invoiceDate: "15/12/2025", dueDate: "15/01/2026" },
  { id: "cust-2", code: "NHATMINH", name: "CTCP Nội thất Nhật Minh", accCode: "131", debit: 0, credit: 15000000, invoiceNo: "HD00118", invoiceDate: "10/12/2025", dueDate: "10/01/2026" },
  { id: "cust-3", code: "MINHHANH", name: "Công ty TNHH Kinh doanh Minh Hạnh", accCode: "131", debit: 60000000, credit: 0, invoiceNo: "HD00099", invoiceDate: "05/12/2025", dueDate: "05/01/2026" },
  { id: "cust-4", code: "ANHTUAN", name: "Công ty TNHH Công nghệ số Anh Tuấn", accCode: "131", debit: 32500000, credit: 0, invoiceNo: "HD00084", invoiceDate: "28/11/2025", dueDate: "28/12/2025" },
];

export const DEFAULT_SUPPLIER_DEBTS = [
  { id: "supp-1", code: "PHATMAI", name: "Công ty TNHH Phát Mai Group", accCode: "331", debit: 0, credit: 80000000, invoiceNo: "PM-0982", invoiceDate: "12/12/2025" },
  { id: "supp-2", code: "MINHQUAN", name: "Công ty Cổ phần Minh Quân Logistics", accCode: "331", debit: 15000000, credit: 0, invoiceNo: "MQ-1140", invoiceDate: "18/12/2025" },
  { id: "supp-3", code: "THANHTRU", name: "Công ty TNHH Thiết bị Thanh Trúc", accCode: "331", debit: 0, credit: 25000000, invoiceNo: "TT-2025", invoiceDate: "22/12/2025" },
  { id: "supp-4", code: "MAISON", name: "CTCP Tư vấn và Dịch vụ Bất động sản Maison", accCode: "331", debit: 12000000, credit: 0, invoiceNo: "MS-2025", invoiceDate: "25/12/2025" },
];

export const DEFAULT_ACCOUNT_BALANCES = [
  { account: "1111", name: "Tiền mặt Việt Nam", debit: 500000000, credit: 0 },
  { account: "1121", name: "Tiền gửi Ngân hàng Techcombank (VND)", debit: 3255000000, credit: 0 },
  { account: "1122", name: "Tiền gửi Ngân hàng Techcombank (USD)", debit: 3816750000, credit: 0 },
  { account: "131", name: "Phải thu của khách hàng", debit: 142500000, credit: 15000000 },
  { account: "1331", name: "Thuế GTGT được khấu trừ của hàng hóa, dịch vụ", debit: 12000000, credit: 0 },
  { account: "141", name: "Tạm ứng", debit: 12000000, credit: 0 },
  { account: "152", name: "Nguyên liệu, vật liệu", debit: 36000000, credit: 0 },
  { account: "1531", name: "Công cụ, dụng cụ", debit: 14000000, credit: 0 },
  { account: "1561", name: "Giá mua hàng hóa", debit: 1158000000, credit: 0 },
  { account: "2111", name: "Tài sản cố định hữu hình - Máy móc, thiết bị", debit: 513600000, credit: 0 },
  { account: "2113", name: "Phương tiện vận tải, truyền dẫn", debit: 816000000, credit: 0 },
  { account: "213", name: "Tài sản cố định vô hình", debit: 48000000, credit: 0 },
  { account: "2141", name: "Hao mòn tài sản cố định hữu hình", debit: 0, credit: 354400000 },
  { account: "2143", name: "Hao mòn tài sản cố định vô hình", debit: 0, credit: 9000000 },
  { account: "221", name: "Đầu tư vào công ty con", debit: 150000000, credit: 0 },
  { account: "222", name: "Đầu tư vào công ty liên doanh, liên kết", debit: 120000000, credit: 0 },
  { account: "241", name: "Xây dựng cơ bản dở dang", debit: 100000000, credit: 0 },
  { account: "242", name: "Chi phí trả trước", debit: 38480000, credit: 0 },
  { account: "331", name: "Phải trả cho người bán", debit: 27000000, credit: 105000000 },
  { account: "3331", name: "Thuế GTGT phải nộp", debit: 0, credit: 5000000 },
  { account: "334", name: "Phải trả người lao động", debit: 0, credit: 45000000 },
  { account: "338", name: "Phải trả, phải nộp khác", debit: 0, credit: 5000000 },
  { account: "341", name: "Vay và nợ thuê tài chính", debit: 0, credit: 2500000000 },
  { account: "4111", name: "Vốn góp của chủ sở hữu", debit: 0, credit: 7685930000 },
  { account: "4212", name: "Lợi nhuận sau thuế chưa phân phối năm trước", debit: 0, credit: 25000000 },
  { account: "441", name: "Quỹ đầu tư phát triển", debit: 0, credit: 10000000 },
];

export const DEFAULT_BANK_BALANCES = [
  { accountNumber: "123456789", bankName: "Techcombank", branch: "Chi nhánh Hà Nội", currency: "VND", originalAmount: 3255000000, amountVnd: 3255000000 },
  { accountNumber: "987654321", bankName: "Techcombank (USD)", branch: "Chi nhánh Hà Nội", currency: "USD", originalAmount: 150000, amountVnd: 3816750000 },
];

export const DEFAULT_INVENTORY_BALANCES = [
  { itemCode: "DT_IP15", itemName: "Điện thoại iPhone 15 Pro Max 256GB", warehouse: "Kho 156", unit: "Cái", quantity: 10, unitPrice: 16200000, amount: 162000000 },
  { itemCode: "DT_SS24", itemName: "Điện thoại Samsung Galaxy S24 Ultra 256GB", warehouse: "Kho 156", unit: "Cái", quantity: 12, unitPrice: 14700000, amount: 176400000 },
  { itemCode: "LT_MBAIR", itemName: "Máy tính xách tay Macbook Air 13-inch M2", warehouse: "Kho 156", unit: "Cái", quantity: 8, unitPrice: 12900000, amount: 103200000 },
  { itemCode: "LT_HPPAV", itemName: "Máy tính xách tay HP Pavilion 14 i5", warehouse: "Kho 156", unit: "Cái", quantity: 15, unitPrice: 7800000, amount: 117000000 },
  { itemCode: "MTB_IPAD10", itemName: "Máy tính bảng iPad Gen 10 64GB", warehouse: "Kho 156", unit: "Cái", quantity: 20, unitPrice: 5100000, amount: 102000000 },
  { itemCode: "DH_AWSE", itemName: "Đồng hồ thông minh Apple Watch SE", warehouse: "Kho 156", unit: "Cái", quantity: 25, unitPrice: 3600000, amount: 90000000 },
  { itemCode: "DH_SSGW6", itemName: "Đồng hồ thông minh Samsung Galaxy Watch 6", warehouse: "Kho 156", unit: "Cái", quantity: 18, unitPrice: 3120000, amount: 56160000 },
  { itemCode: "TN_APSPRO2", itemName: "Tai nghe AirPods Pro 2", warehouse: "Kho 156", unit: "Bộ", quantity: 40, unitPrice: 2880000, amount: 115200000 },
  { itemCode: "TN_SSGWEB", itemName: "Tai nghe Samsung Galaxy Buds FE", warehouse: "Kho 156", unit: "Bộ", quantity: 22, unitPrice: 1020000, amount: 22440000 },
  { itemCode: "MCG_PS5", itemName: "Máy chơi game PlayStation 5 Slim", warehouse: "Kho 156", unit: "Cái", quantity: 10, unitPrice: 6300000, amount: 63000000 },
  { itemCode: "LOA_JBL", itemName: "Loa Bluetooth JBL Flip 6", warehouse: "Kho 156", unit: "Cái", quantity: 40, unitPrice: 1380000, amount: 55200000 },
  { itemCode: "SDP_ANKER", itemName: "Sạc dự phòng Anker PowerCore 20000mAh", warehouse: "Kho 156", unit: "Cái", quantity: 50, unitPrice: 210000, amount: 10500000 },
  { itemCode: "MH_LGMQ2", itemName: "Màn hình máy tính LG 27-inch 4K", warehouse: "Kho 156", unit: "Cái", quantity: 15, unitPrice: 5700000, amount: 85500000 },
  { itemCode: "VL_DCD", itemName: "Dây cáp điện", warehouse: "Kho 152", unit: "Cuộn", quantity: 20, unitPrice: 1500000, amount: 30000000 },
  { itemCode: "VL_KDN", itemName: "Keo dán đa năng", warehouse: "Kho 152", unit: "Lọ", quantity: 50, unitPrice: 20000, amount: 1000000 },
  { itemCode: "VL_VCN", itemName: "Vải lau công nghiệp", warehouse: "Kho 152", unit: "Kg", quantity: 100, unitPrice: 50000, amount: 5000000 },
  { itemCode: "GXV-001", itemName: "Ghế xoay văn phòng", warehouse: "Kho 153", unit: "Cái", quantity: 5, unitPrice: 800000, amount: 4000000 },
  { itemCode: "MHTL-001", itemName: "Máy hủy tài liệu", warehouse: "Kho 153", unit: "Cái", quantity: 2, unitPrice: 2500000, amount: 5000000 },
  { itemCode: "BLV-001", itemName: "Bàn làm việc", warehouse: "Kho 153", unit: "Cái", quantity: 2, unitPrice: 2500000, amount: 5000000 },
];

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
  const location = useLocation();
  const navigate = useNavigate();

  // Current view: null (hub) or category id
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split("/");
      if (parts[1] === "opening" && parts[2]) {
        return parts[2];
      }
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

  useEffect(() => {
    const parts = location.pathname.split("/");
    if (parts[1] === "opening") {
      if (parts[2]) {
        setActiveCategoryId(parts[2]);
      } else {
        const sp = new URLSearchParams(location.search);
        const cat = sp.get("category") || sp.get("tab") || sp.get("type");
        if (!cat) setActiveCategoryId(null);
      }
    }
  }, [location.pathname, location.search]);

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

  // Real Opening Balances State for Company ABC (TT99)
  const [customerDebts, setCustomerDebts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("abc_opening_customers_tt99_v2");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CUSTOMER_DEBTS;
  });

  const [supplierDebts, setSupplierDebts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("abc_opening_suppliers_tt99_v2");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SUPPLIER_DEBTS;
  });

  const [accountRows, setAccountRows] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("abc_opening_accounts_tt99_v2");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ACCOUNT_BALANCES;
  });

  const [bankBalances, setBankBalances] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("abc_opening_bank_tt99_v2");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BANK_BALANCES;
  });

  const [inventoryBalances, setInventoryBalances] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("abc_opening_inventory_tt99_v2");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_INVENTORY_BALANCES;
  });

  const [employeeDebts, setEmployeeDebts] = useState<any[]>([
    { id: "emp-1", code: "HOANGBACUNG", name: "Hoàng Bá Cung", accCode: "141", debit: 12000000, credit: 0, reason: "Tạm ứng đầu kỳ Phòng Hành chính - Nhân sự" },
    { id: "emp-2", code: "PHAMQUANGHOA", name: "Phạm Quang Hòa", accCode: "141", debit: 5000000, credit: 0, reason: "Tạm ứng công tác kỹ thuật (PC 181 ngày 09/12)" },
  ]);

  // UC-GL-15: States cho CCDC (G), TSCĐ (H), Chi phí trả trước (I), Chi phí dở dang (J)
  const [toolBalances, setToolBalances] = useState<any[]>([
    {
      id: "tool-1",
      voucherNo: "OPN-CCDC-01",
      voucherDate: "01/01/2026",
      code: "CCDC001",
      name: "Máy in laser Canon LBP2900",
      unit: "Chiếc",
      quantity: 2,
      totalAmount: 14000000,
      allocatedVal: 4000000,
      remainingVal: 10000000,
      allocPeriod: 12,
      remainingPeriod: 8,
      waitingAccount: "242",
    },
  ]);

  const [assetBalances, setAssetBalances] = useState<any[]>([
    {
      id: "asset-1",
      voucherNo: "OPN-TSCD-01",
      voucherDate: "01/01/2026",
      code: "TSCD001",
      name: "Xe ô tô Toyota Fortuner 2.7V",
      assetType: "03 - Phương tiện vận tải, truyền dẫn",
      department: "P.GD - Phòng Giám đốc",
      costAcc: "2113",
      deprAcc: "2141",
      deprStartDate: "01/01/2026",
      originalCost: 816000000,
      accumDepr: 204000000,
      remainingVal: 612000000,
      usageTime: 5,
      remainingTime: 3,
    },
  ]);

  const [prepaidBalances, setPrepaidBalances] = useState<any[]>([
    {
      id: "prepaid-1",
      code: "CPTT-01",
      name: "Tiền thuê văn phòng năm 2026",
      amount: 38480000,
      allocMonths: 12,
      opening_date: "2026-01-01",
    },
  ]);

  const [wipBalances, setWipBalances] = useState<any[]>([
    {
      id: "wip-1",
      trackingMode: "Đối tượng tập hợp chi phí",
      code: "THCP01",
      name: "Sản xuất Bàn làm việc Hòa Phát",
      rawMaterial: 45000000,
      labor: 30000000,
      machinery: 10000000,
      general: 15000000,
      total: 100000000,
      accepted: 85000000,
    },
  ]);

  // UC-GL-15: Metadata & Auxiliary Modal states (AF-03, AF-09, AF-10, AF-12, AF-13, EF-16, EF-19, EF-21)
  const [startDate, setStartDate] = useState("2026-01-01");
  const [openingPeriodLocked, setOpeningPeriodLocked] = useState(false);
  const [balanceVersion, setBalanceVersion] = useState<number>(1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Account Detail Sub-modal (A4–A5, EF-16, BR08)
  const [accountDetailModalIdx, setAccountDetailModalIdx] = useState<number | null>(null);
  const [accountDetailRows, setAccountDetailRows] = useState<any[]>([
    { object_code: "KH01", object_name: "Công ty TNHH Thanh Hà", dimension: "HD-01", debit: 0, credit: 0 },
  ]);

  // Foreign currency fields (AF-12, BR11)
  const [bankCurrency, setBankCurrency] = useState("VND");
  const [bankExchangeRate, setBankExchangeRate] = useState(1);

  // Prepaid controlled form fields (Luồng I)
  const [prepaidCode, setPrepaidCode] = useState("CPTT-02");
  const [prepaidName, setPrepaidName] = useState("Chi phí bảo hiểm tài sản năm 2026");
  const [prepaidAmount, setPrepaidAmount] = useState<number>(24000000);
  const [prepaidAllocMonths, setPrepaidAllocMonths] = useState<number>(12);

  // Auxiliary Modals: Excel Import (AF-03), Voucher List (AF-09), Print Preview (AF-13)
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelJsonText, setExcelJsonText] = useState("");
  const [excelImportErrors, setExcelImportErrors] = useState<any[]>([]);
  const [voucherListModalOpen, setVoucherListModalOpen] = useState(false);
  const [openingVouchers, setOpeningVouchers] = useState<any[]>([]);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any | null>(null);

  const applyBackendOpeningResponse = (res: any) => {
    if (!res) return;
    if (res.start_date) setStartDate(res.start_date);
    if (typeof res.opening_period_locked === "boolean") setOpeningPeriodLocked(res.opening_period_locked);
    if (typeof res.version === "number") setBalanceVersion(res.version);
    if (Array.isArray(res.accounts) && res.accounts.length > 0) {
      setAccountRows(res.accounts);
      try { localStorage.setItem("abc_opening_accounts_tt99_v2", JSON.stringify(res.accounts)); } catch {}
    }
    if (Array.isArray(res.bank) && res.bank.length > 0) setBankBalances(res.bank);
    if (Array.isArray(res.customers) && res.customers.length > 0) setCustomerDebts(res.customers);
    if (Array.isArray(res.suppliers) && res.suppliers.length > 0) setSupplierDebts(res.suppliers);
    if (Array.isArray(res.employees) && res.employees.length > 0) setEmployeeDebts(res.employees);
    if (Array.isArray(res.inventory) && res.inventory.length > 0) setInventoryBalances(res.inventory);
    if (Array.isArray(res.tools) && res.tools.length > 0) setToolBalances(res.tools);
    if (Array.isArray(res.assets) && res.assets.length > 0) setAssetBalances(res.assets);
    if (Array.isArray(res.prepaid) && res.prepaid.length > 0) setPrepaidBalances(res.prepaid);
    if (Array.isArray(res.wip) && res.wip.length > 0) setWipBalances(res.wip);
  };

  const syncOpeningBalancesToBackend = (payload: Record<string, any>) => {
    void request<any>("/api/v1/general-ledger/opening-balances/", undefined, {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res && typeof res.version === "number") setBalanceVersion(res.version);
      })
      .catch((err: any) => {
        if (err?.message) notify?.(err.message);
      });
  };

  useEffect(() => {
    let mounted = true;
    request<any>("/api/v1/general-ledger/opening-balances/")
      .then((res) => {
        if (!mounted || !res) return;
        applyBackendOpeningResponse(res);
        if (!res.customers || !res.suppliers || !res.bank || !res.inventory) {
          syncOpeningBalancesToBackend({
            bank: res.bank || DEFAULT_BANK_BALANCES,
            customers: res.customers || DEFAULT_CUSTOMER_DEBTS,
            suppliers: res.suppliers || DEFAULT_SUPPLIER_DEBTS,
            employees: res.employees || employeeDebts,
            inventory: res.inventory || DEFAULT_INVENTORY_BALANCES,
            tools: Array.isArray(res.tools) && res.tools.length > 0 ? res.tools : toolBalances,
            assets: Array.isArray(res.assets) && res.assets.length > 0 ? res.assets : assetBalances,
            prepaid: Array.isArray(res.prepaid) && res.prepaid.length > 0 ? res.prepaid : prepaidBalances,
            wip: Array.isArray(res.wip) && res.wip.length > 0 ? res.wip : wipBalances,
          });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  // Section collapse state in customer/supplier modals
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(true);
  const [projectDetailOpen, setProjectDetailOpen] = useState(true);

  // Form states for modals
  const [bankAccountCode, setBankAccountCode] = useState("1121");
  const [bankAccNumber, setBankAccNumber] = useState("123456789");
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

  const [inventoryItem, setInventoryItem] = useState("DT_IP15");
  const [inventoryWarehouse, setInventoryWarehouse] = useState("Kho 156");
  const [inventoryQty, setInventoryQty] = useState(0);
  const [inventoryVal, setInventoryVal] = useState(0);

  const activeCategory = OPENING_CATEGORIES.find((c) => c.id === activeCategoryId);

  const handleOpenCategory = (id: string) => {
    setActiveCategoryId(id);
    setEditingItemId(null);
    navigate(`/opening/${id}`);
  };

  const handleBackToHub = () => {
    setActiveCategoryId(null);
    setActiveModal(null);
    setEditingItemId(null);
    navigate(`/opening`);
  };

  // AF-11: Xóa bản ghi số dư đầu kỳ ở bất kỳ nhóm nào
  const handleDeleteOpeningItem = (category: string, idOrCode: string) => {
    if (openingPeriodLocked) {
      notify?.("EF-19: Kỳ kế toán đầu kỳ đã khóa sổ, không được phép xóa số dư ban đầu (BR37).");
      return;
    }
    if (category === "customers") {
      const updated = customerDebts.filter((c) => c.id !== idOrCode && c.code !== idOrCode);
      setCustomerDebts(updated);
      try { localStorage.setItem("abc_opening_customers_tt99_v2", JSON.stringify(updated)); } catch {}
    } else if (category === "suppliers") {
      const updated = supplierDebts.filter((s) => s.id !== idOrCode && s.code !== idOrCode);
      setSupplierDebts(updated);
      try { localStorage.setItem("abc_opening_suppliers_tt99_v2", JSON.stringify(updated)); } catch {}
    } else if (category === "bank") {
      const updated = bankBalances.filter((b) => b.accountNumber !== idOrCode && b.id !== idOrCode);
      setBankBalances(updated);
    } else if (category === "employees") {
      setEmployeeDebts(employeeDebts.filter((e) => e.id !== idOrCode && e.code !== idOrCode));
    } else if (category === "inventory") {
      setInventoryBalances(inventoryBalances.filter((it) => it.itemCode !== idOrCode && it.id !== idOrCode));
    } else if (category === "tools") {
      setToolBalances(toolBalances.filter((t) => t.code !== idOrCode && t.id !== idOrCode));
    } else if (category === "assets") {
      setAssetBalances(assetBalances.filter((a) => a.code !== idOrCode && a.id !== idOrCode));
    } else if (category === "prepaid") {
      setPrepaidBalances(prepaidBalances.filter((p) => p.code !== idOrCode && p.id !== idOrCode));
    } else if (category === "wip") {
      setWipBalances(wipBalances.filter((w) => w.code !== idOrCode && w.id !== idOrCode));
    }
    void request<any>("/api/v1/general-ledger/opening-balances/delete-item/", undefined, {
      method: "POST",
      body: JSON.stringify({ category, item_id: idOrCode }),
    })
      .then((res) => {
        applyBackendOpeningResponse(res);
        notify?.(`Đã xóa bản ghi '${idOrCode}' và cập nhật lên CSDL (AF-11).`);
      })
      .catch(() => {
        notify?.(`Đã xóa bản ghi '${idOrCode}'.`);
      });
  };

  const handleDeleteCustomer = (id: string) => handleDeleteOpeningItem("customers", id);
  const handleDeleteSupplier = (id: string) => handleDeleteOpeningItem("suppliers", id);

  // AF-10: Mở biểu mẫu sửa bản ghi số dư đầu kỳ đã lưu
  const handleEditOpeningItem = (category: string, item: any) => {
    if (openingPeriodLocked) {
      notify?.("EF-19: Kỳ kế toán đầu kỳ đã khóa sổ, không được phép sửa số dư ban đầu (BR37).");
      return;
    }
    const idVal = String(item.id || item.code || item.accountNumber || item.itemCode || "");
    setEditingItemId(idVal);
    if (category === "bank") {
      setBankAccountCode(item.accountCode || (item.currency === "USD" ? "1122" : "1121"));
      setBankAccNumber(item.accountNumber || "");
      setBankCurrency(item.currency || "VND");
      setBankExchangeRate(item.exchangeRate || (item.currency === "USD" ? 25445 : 1));
      setBankDebit(Number(item.originalAmount ?? item.amountVnd ?? 0));
      setBankCredit(Number(item.credit || 0));
    } else if (category === "customers") {
      setPartnerAccCode(item.accCode || "131");
      setPartnerName(item.code || "");
      setPartnerDebit(Number(item.debit || 0));
      setPartnerCredit(Number(item.credit || 0));
    } else if (category === "suppliers") {
      setSupplierAccCode(item.accCode || "331");
      setSupplierName(item.code || "");
      setSupplierDebit(Number(item.debit || 0));
      setSupplierCredit(Number(item.credit || 0));
    } else if (category === "employees") {
      setEmployeeAccCode(item.accCode || "141");
      setEmployeeName(item.code || "");
      setEmployeeDebit(Number(item.debit || 0));
      setEmployeeCredit(Number(item.credit || 0));
    } else if (category === "inventory") {
      setInventoryItem(item.itemCode || "DT_IP15");
      setInventoryWarehouse(item.warehouse || "Kho 156");
      setInventoryQty(Number(item.quantity || 0));
      setInventoryVal(Number(item.amount || 0));
    } else if (category === "tools") {
      setToolVoucherNo(item.voucherNo || "OPN");
      setToolVoucherDate(item.voucherDate || "01/01/2026");
      setToolCode(item.code || "");
      setToolName(item.name || "");
      setToolUnit(item.unit || "Chiếc");
      setToolQuantity(String(item.quantity || 1));
      setToolTotalAmount(String(item.totalAmount || 0));
      setToolAllocatedVal(String(item.allocatedVal || 0));
      setToolRemainingVal(String(item.remainingVal || 0));
      setToolAllocPeriod(String(item.allocPeriod || 12));
      setToolRemainingPeriod(String(item.remainingPeriod || 8));
    } else if (category === "assets") {
      setAssetVoucherNo(item.voucherNo || "OPN");
      setAssetVoucherDate(item.voucherDate || "01/01/2026");
      setAssetCode(item.code || "");
      setAssetName(item.name || "");
      setAssetType(item.assetType || "03 - Phương tiện vận tải, truyền dẫn");
      setAssetDepartment(item.department || "P.GD - Phòng Giám đốc");
      setAssetCostAcc(item.costAcc || "2113");
      setAssetDeprAcc(item.deprAcc || "2141");
      setAssetOriginalCost(String(item.originalCost || 0));
      setAssetAccumDepr(String(item.accumDepr || 0));
      setAssetRemainingVal(String(item.remainingVal || 0));
    } else if (category === "prepaid") {
      setPrepaidCode(item.code || "");
      setPrepaidName(item.name || "");
      setPrepaidAmount(Number(item.amount || 0));
      setPrepaidAllocMonths(Number(item.allocMonths || 12));
    }
    setActiveModal(category);
  };

  // AF-09: Xem danh sách chứng từ số dư đầu kỳ
  const handleOpenVoucherList = () => {
    setVoucherListModalOpen(true);
    const catQuery = activeCategoryId ? `?category=${encodeURIComponent(activeCategoryId)}` : "";
    void request<any>(`/api/v1/general-ledger/opening-balances/vouchers/${catQuery}`)
      .then((res) => {
        if (res && Array.isArray(res.vouchers)) {
          setOpeningVouchers(res.vouchers);
        }
      })
      .catch(() => {});
  };

  // AF-13, EF-17: In số dư đầu kỳ
  const handlePrintCategory = (catId?: string) => {
    const targetCat = catId || activeCategoryId || "accounts";
    void request<any>("/api/v1/general-ledger/opening-balances/print/", undefined, {
      method: "POST",
      body: JSON.stringify({ category: targetCat }),
    })
      .then((res) => {
        if (res?.print_status === "ERROR") {
          notify?.(res.message || "EF-17: Không thể khởi tạo bản in. Dữ liệu đã lưu vẫn được giữ nguyên.");
          return;
        }
        setPrintPreviewData(res);
        setPrintModalOpen(true);
      })
      .catch(() => {
        notify?.("Đang khởi tạo bản in số dư đầu kỳ...");
      });
  };

  // AF-03, EF-18: Nhập số dư từ Excel
  const handleOpenExcelImport = () => {
    const cat = activeCategoryId || "customers";
    setExcelImportErrors([]);
    let sampleRows: any[] = [];
    if (cat === "customers") {
      sampleRows = [{ accCode: "131", code: "THANHHA", name: "Công ty TNHH Thanh Hà", debit: 45000000, credit: 0, invoiceNo: "HD-XL-01" }];
    } else if (cat === "suppliers") {
      sampleRows = [{ accCode: "331", code: "PHATMAI", name: "Công ty TNHH Phát Mai Group", debit: 0, credit: 65000000, invoiceNo: "NCC-XL-01" }];
    } else if (cat === "bank") {
      sampleRows = [{ accountCode: "1121", accountNumber: "0011004234567", bankName: "Vietcombank", currency: "VND", originalAmount: 500000000, amountVnd: 500000000 }];
    } else if (cat === "inventory") {
      sampleRows = [{ itemCode: "HH01", itemName: "Máy tính Dell Vostro 3520", warehouse: "Kho 156", unit: "Chiếc", quantity: 10, amount: 150000000 }];
    } else if (cat === "prepaid") {
      sampleRows = [{ code: "CPTT-XL01", name: "Chi phí phần mềm kế toán", amount: 18000000, allocMonths: 12 }];
    } else {
      sampleRows = [{ account: "1111", name: "Tiền mặt Việt Nam", debit: 500000000, credit: 0 }];
    }
    setExcelJsonText(JSON.stringify(sampleRows, null, 2));
    setExcelModalOpen(true);
  };

  const handleConfirmExcelImport = () => {
    const cat = activeCategoryId || "customers";
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(excelJsonText);
      if (!Array.isArray(parsed)) throw new Error("Dữ liệu phải là mảng các dòng.");
    } catch {
      setExcelImportErrors([{ row_index: 1, error_code: "EF-18", message: "EF-18: Cấu trúc dữ liệu mẫu không hợp lệ." }]);
      return;
    }
    void request<any>("/api/v1/general-ledger/opening-balances/import-excel/", undefined, {
      method: "POST",
      body: JSON.stringify({ category: cat, rows: parsed, atomic: true }),
    })
      .then((res) => {
        applyBackendOpeningResponse(res);
        setExcelImportErrors([]);
        setExcelModalOpen(false);
        notify?.(`AF-03: Đã nhập thành công ${res?.import_summary?.imported_count || parsed.length} dòng từ Excel!`);
      })
      .catch((err: any) => {
        notify?.(err?.message || "EF-18: Phát hiện lỗi dữ liệu khi kiểm tra tệp Excel.");
      });
  };

  const handleSaveModal = (type: string, andAdd = false, andPrint = false) => {
    if (openingPeriodLocked) {
      notify?.("EF-19: Kỳ kế toán đầu kỳ đã khóa sổ, không được phép sửa hoặc ghi đè trực tiếp số dư ban đầu (BR37).");
      return;
    }
    const actionMode = andPrint ? "SAVE_AND_PRINT" : andAdd ? "SAVE_AND_ADD" : "SAVE_AND_CLOSE";

    if (type === "Số dư tài khoản") {
      for (const r of accountRows) {
        if ((Number(r.debit) || 0) < 0 || (Number(r.credit) || 0) < 0) {
          notify?.(`EF-12: Tài khoản ${r.account} không được có Dư Nợ hoặc Dư Có âm (BR05).`);
          return;
        }
      }
      try { localStorage.setItem("abc_opening_accounts_tt99_v2", JSON.stringify(accountRows)); } catch {}
      syncOpeningBalancesToBackend({ category: "accounts", items: accountRows, action_mode: actionMode });
      const totalD = accountRows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
      const totalC = accountRows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
      if (totalD !== totalC) {
        notify?.(`Lưu số dư tài khoản thành công. Cảnh báo BR09: Tổng Dư Nợ và Tổng Dư Có đang lệch ${formatOpeningMoney(Math.abs(totalD - totalC))} đ.`);
      } else {
        notify?.("Lưu số dư tài khoản thành công.");
      }
      if (andPrint) handlePrintCategory("accounts");
      if (!andAdd) setActiveModal(null);
      return;
    }

    if (type === "Số dư TK ngân hàng") {
      if (!bankAccountCode) {
        notify?.("EF-03: Vui lòng chọn Số tài khoản kế toán.");
        return;
      }
      if (!bankAccNumber) {
        notify?.("EF-04: Vui lòng chọn Tài khoản ngân hàng.");
        return;
      }
      if (bankDebit < 0 || bankCredit < 0) {
        notify?.("EF-12: Số dư tài khoản ngân hàng không được âm (BR05).");
        return;
      }
      const isUsd = bankCurrency === "USD" || bankAccNumber.includes("987") || bankAccNumber.includes("USD") || bankAccountCode === "1122";
      const currency = isUsd ? "USD" : bankCurrency || "VND";
      const fxRate = currency === "VND" ? 1 : (Number(bankExchangeRate) > 0 ? Number(bankExchangeRate) : 25445);
      const newBank = {
        id: editingItemId || `bank-${bankAccNumber}`,
        accountCode: bankAccountCode,
        accountNumber: bankAccNumber,
        bankName: isUsd ? "Techcombank (USD)" : "Techcombank",
        branch: "Chi nhánh Hà Nội",
        currency,
        exchangeRate: fxRate,
        originalAmount: bankDebit,
        credit: bankCredit,
        amountVnd: currency === "VND" ? bankDebit : Math.round(bankDebit * fxRate),
      };
      const updated = [newBank, ...bankBalances.filter(b => b.accountNumber !== bankAccNumber && b.id !== editingItemId)];
      setBankBalances(updated);
      try { localStorage.setItem("abc_opening_bank_tt99_v2", JSON.stringify(updated)); } catch {}
      void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
        method: "POST",
        body: JSON.stringify({ category: "bank", item: newBank, editing_id: editingItemId, action_mode: actionMode }),
      }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ bank: updated }));
      notify?.(`Đã lưu thành công số dư tài khoản ngân hàng ${bankAccNumber}!`);
      setEditingItemId(null);
      if (andPrint) handlePrintCategory("bank");
      if (!andAdd) setActiveModal(null);
      return;
    }

    if (type === "Công nợ khách hàng") {
      if (!partnerAccCode) {
        notify?.("EF-03: Vui lòng chọn Số tài khoản công nợ khách hàng.");
        return;
      }
      if (!partnerName) {
        notify?.("EF-05: Vui lòng chọn Khách hàng.");
        return;
      }
      if (partnerDebit < 0 || partnerCredit < 0) {
        notify?.("EF-12: Dư Nợ / Dư Có công nợ khách hàng không được âm.");
        return;
      }
      const custObj = OPENING_CUSTOMERS.find(c => c.code === partnerName || c.name === partnerName);
      const newCust = {
        id: editingItemId || ("cust-" + Date.now()),
        code: custObj ? custObj.code : (partnerName.split(" - ")[0] || partnerName),
        name: custObj ? custObj.name : (partnerName.split(" - ")[1] || partnerName),
        accCode: partnerAccCode || "131",
        debit: Number(partnerDebit) || 0,
        credit: Number(partnerCredit) || 0,
        invoiceNo: "HD" + Math.floor(10000 + Math.random() * 90000),
        invoiceDate: "15/12/2025",
        dueDate: "15/01/2026",
        isNew: true,
      };
      const updated = [newCust, ...customerDebts.filter(c => c.id !== editingItemId)];
      setCustomerDebts(updated);
      try { localStorage.setItem("abc_opening_customers_tt99_v2", JSON.stringify(updated)); } catch {}
      void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
        method: "POST",
        body: JSON.stringify({ category: "customers", item: newCust, editing_id: editingItemId, action_mode: actionMode }),
      }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ customers: updated }));
      notify?.(`Đã lưu thành công số dư công nợ khách hàng ${newCust.name}!`);
      setPartnerDebit(0);
      setPartnerCredit(0);
      setEditingItemId(null);
      if (andPrint) handlePrintCategory("customers");
      if (!andAdd) setActiveModal(null);
      return;
    }

    if (type === "Công nợ nhà cung cấp") {
      if (!supplierAccCode) {
        notify?.("EF-03: Vui lòng chọn Số tài khoản công nợ nhà cung cấp.");
        return;
      }
      if (!supplierName) {
        notify?.("EF-06: Vui lòng chọn Nhà cung cấp.");
        return;
      }
      if (supplierDebit < 0 || supplierCredit < 0) {
        notify?.("EF-12: Dư Nợ / Dư Có công nợ nhà cung cấp không được âm.");
        return;
      }
      const suppObj = OPENING_SUPPLIERS.find(s => s.code === supplierName || s.name === supplierName);
      const newSupp = {
        id: editingItemId || ("supp-" + Date.now()),
        code: suppObj ? suppObj.code : (supplierName.split(" - ")[0] || supplierName),
        name: suppObj ? suppObj.name : (supplierName.split(" - ")[1] || supplierName),
        accCode: supplierAccCode || "331",
        debit: Number(supplierDebit) || 0,
        credit: Number(supplierCredit) || 0,
        invoiceNo: "NCC-" + Math.floor(1000 + Math.random() * 9000),
        invoiceDate: "12/12/2025",
        isNew: true,
      };
      const updated = [newSupp, ...supplierDebts.filter(s => s.id !== editingItemId)];
      setSupplierDebts(updated);
      try { localStorage.setItem("abc_opening_suppliers_tt99_v2", JSON.stringify(updated)); } catch {}
      void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
        method: "POST",
        body: JSON.stringify({ category: "suppliers", item: newSupp, editing_id: editingItemId, action_mode: actionMode }),
      }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ suppliers: updated }));
      notify?.(`Đã lưu thành công số dư công nợ nhà cung cấp ${newSupp.name}!`);
      setSupplierDebit(0);
      setSupplierCredit(0);
      setEditingItemId(null);
      if (andPrint) handlePrintCategory("suppliers");
      if (!andAdd) setActiveModal(null);
      return;
    }

    if (type === "Công nợ nhân viên") {
      if (!employeeAccCode) {
        notify?.("EF-03: Vui lòng chọn Số tài khoản công nợ nhân viên.");
        return;
      }
      if (!employeeName) {
        notify?.("EF-07: Vui lòng chọn Nhân viên.");
        return;
      }
      if (employeeDebit < 0 || employeeCredit < 0) {
        notify?.("EF-12: Dư Nợ / Dư Có công nợ nhân viên không được âm.");
        return;
      }
      const newEmp = {
        id: editingItemId || ("emp-" + Date.now()),
        code: employeeName.split(" - ")[0] || employeeName,
        name: employeeName === "NV001" ? "Nguyễn Văn An" : employeeName === "NV002" ? "Lê Thị Bình" : employeeName,
        accCode: employeeAccCode || "141",
        debit: Number(employeeDebit) || 0,
        credit: Number(employeeCredit) || 0,
        reason: "Số dư công nợ nhân viên đầu kỳ",
      };
      const updated = [newEmp, ...employeeDebts.filter(e => e.id !== editingItemId && e.code !== newEmp.code)];
      setEmployeeDebts(updated);
      void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
        method: "POST",
        body: JSON.stringify({ category: "employees", item: newEmp, editing_id: editingItemId, action_mode: actionMode }),
      }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ employees: updated }));
      notify?.(`Đã lưu thành công công nợ nhân viên ${newEmp.name}!`);
      setEmployeeDebit(0);
      setEmployeeCredit(0);
      setEditingItemId(null);
      if (andPrint) handlePrintCategory("employees");
      if (!andAdd) setActiveModal(null);
      return;
    }

    if (type === "Tồn kho vật tư") {
      if (!inventoryItem || !inventoryWarehouse) {
        notify?.("EF-08: Vui lòng chọn đầy đủ Hàng hóa và Kho lưu trữ.");
        return;
      }
      if (inventoryQty < 0 || inventoryVal < 0) {
        notify?.("EF-13: Số lượng tồn và Giá trị tồn không được âm (BR19).");
        return;
      }
      const newInv = {
        id: editingItemId || `inv-${inventoryItem}-${inventoryWarehouse}`,
        itemCode: inventoryItem,
        itemName: inventoryItem === "DT_IP15" ? "Điện thoại iPhone 15 Pro Max 256GB" : inventoryItem === "DT_SS24" ? "Điện thoại Samsung Galaxy S24 Ultra 256GB" : inventoryItem === "HH01" ? "Máy tính Dell Vostro 3520" : inventoryItem === "HH02" ? "Ổ cứng SSD Samsung 1TB" : inventoryItem,
        warehouse: inventoryWarehouse,
        unit: "Chiếc",
        quantity: Number(inventoryQty) || 1,
        unitPrice: inventoryQty > 0 ? Math.round(inventoryVal / inventoryQty) : inventoryVal,
        amount: Number(inventoryVal) || 0,
      };
      const updated = [newInv, ...inventoryBalances.filter(it => it.itemCode !== inventoryItem || it.warehouse !== inventoryWarehouse)];
      setInventoryBalances(updated);
      try { localStorage.setItem("abc_opening_inventory_tt99_v2", JSON.stringify(updated)); } catch {}
      void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
        method: "POST",
        body: JSON.stringify({ category: "inventory", item: newInv, editing_id: editingItemId, action_mode: actionMode }),
      }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ inventory: updated }));
      notify?.(`Đã lưu thành công tồn kho vật tư hàng hóa ${newInv.itemCode}!`);
      setEditingItemId(null);
      if (andPrint) handlePrintCategory("inventory");
      if (!andAdd) setActiveModal(null);
      return;
    }

    if (type === "Chi phí trả trước") {
      if (!prepaidCode.trim() || !prepaidName.trim()) {
        notify?.("EF-11: Vui lòng nhập đầy đủ Mã chi phí trả trước và Tên chi phí trả trước.");
        return;
      }
      if (Number(prepaidAmount) <= 0 || Number(prepaidAllocMonths) <= 0) {
        notify?.("EF-14: Số tiền và Số kỳ phân bổ (Tháng) phải lớn hơn 0 (BR27).");
        return;
      }
      const newPrepaid = {
        id: editingItemId || prepaidCode.trim(),
        code: prepaidCode.trim(),
        name: prepaidName.trim(),
        amount: Number(prepaidAmount),
        allocMonths: Number(prepaidAllocMonths),
        opening_date: startDate,
      };
      const updated = [newPrepaid, ...prepaidBalances.filter(p => p.code !== newPrepaid.code && p.id !== editingItemId)];
      setPrepaidBalances(updated);
      void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
        method: "POST",
        body: JSON.stringify({ category: "prepaid", item: newPrepaid, editing_id: editingItemId, action_mode: actionMode }),
      }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ prepaid: updated }));
      notify?.(`Đã lưu chi phí trả trước đầu kỳ ${newPrepaid.code} thành công!`);
      setEditingItemId(null);
      if (andPrint) handlePrintCategory("prepaid");
      if (!andAdd) setActiveModal(null);
      return;
    }

    syncOpeningBalancesToBackend({ category: activeCategoryId || type, items: { savedAt: new Date().toISOString(), type } });
    notify?.(`Đã lưu thành công ${type} vào CSDL.`);
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

      {/* Dynamic Data Table & KPI Stats View for Opening Balances */}
      <div style={{ padding: "16px 24px", background: "#f8fafc", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Top Action Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#ffffff", padding: "12px 18px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="misa-opening-btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => {
                setEditingItemId(null);
                setActiveModal(activeCategoryId);
              }}
            >
              <Plus size={16} />
              <span>Nhập số dư</span>
            </button>
            <button
              type="button"
              className="misa-opening-btn-secondary"
              onClick={handleOpenExcelImport}
            >
              Nhập số dư từ Excel
            </button>
            <button
              type="button"
              className="misa-opening-btn-secondary"
              onClick={handleOpenVoucherList}
            >
              Xem danh sách chứng từ
            </button>
            <button
              type="button"
              className="misa-opening-btn-secondary"
              onClick={() => handlePrintCategory(activeCategoryId || "accounts")}
            >
              In số dư đầu kỳ
            </button>
            <button
              type="button"
              className="misa-opening-btn-secondary"
              onClick={() => notify?.("Đã xuất dữ liệu số dư ra Excel.")}
            >
              Xuất khẩu Excel
            </button>
            <button
              type="button"
              className="misa-opening-btn-secondary"
              onClick={handleBackToHub}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ArrowLeft size={15} />
              <span>Quay lại danh mục</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#475569", background: "#f1f5f9", padding: "4px 10px", borderRadius: 6, fontWeight: 500 }}>
              Ngày bắt đầu HT: <strong>{startDate}</strong> · v{balanceVersion}
            </span>
            <div style={{ position: "relative", width: 250 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Tìm theo mã, tên, số HĐ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="misa-opening-input"
                style={{ paddingLeft: 32, width: "100%", height: 34, fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        {/* Category: Công nợ khách hàng */}
        {activeCategoryId === "customers" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng Dư Nợ đầu kỳ (TK 131)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                  {formatOpeningMoney(customerDebts.reduce((s, r) => s + (r.debit || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng Dư Có đầu kỳ (TK 131)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626", marginTop: 4 }}>
                  {formatOpeningMoney(customerDebts.reduce((s, r) => s + (r.credit || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng số khách hàng có dư nợ</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
                  {customerDebts.length} đối tượng
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 140 }}>Mã khách hàng</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Tên khách hàng</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 100 }}>TK công nợ</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 160 }}>Dư Nợ đầu kỳ</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 150 }}>Dư Có đầu kỳ</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 140 }}>Hóa đơn / HĐ</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Hạn TT</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {customerDebts
                    .filter((c) =>
                      !searchTerm ||
                      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (c.invoiceNo && c.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map((c, i) => (
                      <tr key={c.id || i} style={{ borderBottom: "1px solid #f1f5f9", background: c.isNew ? "#ecfdf5" : "inherit" }}>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>
                          {c.code}
                          {c.isNew && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: "#10b981", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>
                              Mới
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{c.accCode || "131"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: c.debit > 0 ? "#16a34a" : "#64748b" }}>
                          {formatOpeningMoney(c.debit)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: c.credit > 0 ? "#dc2626" : "#64748b" }}>
                          {formatOpeningMoney(c.credit)}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>{c.invoiceNo || "-"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{c.dueDate || "-"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleEditOpeningItem("customers", c)}
                              style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(c.id || c.code)}
                              style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}
                              title="Xóa bản ghi này"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1", fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: "10px 14px", textAlign: "right" }}>Tổng cộng:</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#16a34a" }}>
                      {formatOpeningMoney(customerDebts.reduce((s, r) => s + (r.debit || 0), 0))} đ
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#dc2626" }}>
                      {formatOpeningMoney(customerDebts.reduce((s, r) => s + (r.credit || 0), 0))} đ
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Category: Công nợ nhà cung cấp */}
        {activeCategoryId === "suppliers" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng Dư Có đầu kỳ (TK 331)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", marginTop: 4 }}>
                  {formatOpeningMoney(supplierDebts.reduce((s, r) => s + (r.credit || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng Dư Nợ đầu kỳ (TK 331)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                  {formatOpeningMoney(supplierDebts.reduce((s, r) => s + (r.debit || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Số lượng nhà cung cấp</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
                  {supplierDebts.length} đơn vị
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 140 }}>Mã NCC</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Tên nhà cung cấp</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 100 }}>TK công nợ</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 160 }}>Dư Nợ</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 160 }}>Dư Có (Phải trả)</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 140 }}>Chứng từ NCC</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierDebts
                    .filter((s) =>
                      !searchTerm ||
                      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.name.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((s, i) => (
                      <tr key={s.id || i} style={{ borderBottom: "1px solid #f1f5f9", background: s.isNew ? "#fffbeb" : "inherit" }}>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#d97706" }}>
                          {s.code}
                          {s.isNew && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: "#f59e0b", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>
                              Mới
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 500 }}>{s.name}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{s.accCode || "331"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: s.debit > 0 ? "#16a34a" : "#64748b" }}>
                          {formatOpeningMoney(s.debit)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: s.credit > 0 ? "#d97706" : "#64748b" }}>
                          {formatOpeningMoney(s.credit)}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>{s.invoiceNo || "-"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleEditOpeningItem("suppliers", s)}
                              style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSupplier(s.id || s.code)}
                              style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}
                              title="Xóa bản ghi này"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1", fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: "10px 14px", textAlign: "right" }}>Tổng cộng:</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#16a34a" }}>
                      {formatOpeningMoney(supplierDebts.reduce((s, r) => s + (r.debit || 0), 0))} đ
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#d97706" }}>
                      {formatOpeningMoney(supplierDebts.reduce((s, r) => s + (r.credit || 0), 0))} đ
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Category: Số dư tài khoản */}
        {activeCategoryId === "accounts" && (() => {
          const totalD = accountRows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
          const totalC = accountRows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
          const isBalanced = totalD === totalC;
          return (
            <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng Dư Nợ đầu kỳ</span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                    {formatOpeningMoney(totalD)} đ
                  </div>
                </div>
                <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng Dư Có đầu kỳ</span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                    {formatOpeningMoney(totalC)} đ
                  </div>
                </div>
                <div style={{ padding: "12px 20px" }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Trạng thái cân đối (TT 99/2025/TT-BTC · BR09)</span>
                  {isBalanced ? (
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#00a862", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      <Check size={16} />
                      <span>Cân đối Nợ = Có ({formatOpeningMoney(totalD)} đ)</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#d97706", marginTop: 6 }}>
                      ⚠ Lệch Nợ/Có: {formatOpeningMoney(Math.abs(totalD - totalC))} đ (BR09)
                    </div>
                  )}
                </div>
              </div>

              <div style={{ overflowX: "auto", width: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", width: 140 }}>Số tài khoản</th>
                      <th style={{ padding: "10px 14px", textAlign: "left" }}>Tên tài khoản</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", width: 180 }}>Dư Nợ đầu kỳ (VNĐ)</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", width: 180 }}>Dư Có đầu kỳ (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountRows
                      .filter((a) => !searchTerm || a.account.includes(searchTerm) || a.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((a, i) => (
                        <tr key={a.account || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#00a862" }}>{a.account}</td>
                          <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 500 }}>{a.name}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: a.debit > 0 ? "#16a34a" : "#94a3b8" }}>
                            {formatOpeningMoney(a.debit)}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: a.credit > 0 ? "#dc2626" : "#94a3b8" }}>
                            {formatOpeningMoney(a.credit)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Category: Số dư TK ngân hàng */}
        {activeCategoryId === "bank" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng tiền gửi quy đổi VNĐ</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
                  {formatOpeningMoney(bankBalances.reduce((s, r) => s + (r.amountVnd || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Số tài khoản ngân hàng</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#334155", marginTop: 4 }}>
                  {bankBalances.length} tài khoản
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 140 }}>Số tài khoản</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Ngân hàng</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 180 }}>Chi nhánh</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 90 }}>Loại tiền</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 160 }}>Dư nguyên tệ</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 170 }}>Dư quy đổi (VNĐ)</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {bankBalances.map((b, i) => (
                    <tr key={b.accountNumber || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0284c7" }}>{b.accountNumber}</td>
                      <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 600 }}>{b.bankName}</td>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{b.branch}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{b.currency}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>
                        {formatOpeningMoney(b.originalAmount)} {b.currency}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>
                        {formatOpeningMoney(b.amountVnd)} đ
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button type="button" onClick={() => handleEditOpeningItem("bank", b)} style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sửa</button>
                          <button type="button" onClick={() => handleDeleteOpeningItem("bank", b.accountNumber || b.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category: Tồn kho vật tư hàng hóa */}
        {activeCategoryId === "inventory" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng giá trị tồn kho (TK 1561)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#059669", marginTop: 4 }}>
                  {formatOpeningMoney(inventoryBalances.reduce((s, r) => s + (r.amount || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng số lượng hàng hóa tồn</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#334155", marginTop: 4 }}>
                  {formatOpeningMoney(inventoryBalances.reduce((s, r) => s + (r.quantity || 0), 0))} chiếc
                </div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Kho lưu trữ</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
                  Kho 156 - Hàng hóa (BR20: Không sinh PNK trong kỳ)
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 130 }}>Mã hàng</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Tên vật tư, hàng hóa</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 100 }}>Kho</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 70 }}>ĐVT</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 100 }}>Số lượng</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }}>Đơn giá</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 160 }}>Thành tiền (VNĐ)</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryBalances.map((item, i) => (
                    <tr key={item.itemCode || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#059669" }}>{item.itemCode}</td>
                      <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 600 }}>{item.itemName}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{item.warehouse}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{item.unit}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{formatOpeningMoney(item.quantity)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#64748b" }}>{formatOpeningMoney(item.unitPrice)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                        {formatOpeningMoney(item.amount)} đ
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button type="button" onClick={() => handleEditOpeningItem("inventory", item)} style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sửa</button>
                          <button type="button" onClick={() => handleDeleteOpeningItem("inventory", item.itemCode || item.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1", fontWeight: 700 }}>
                    <td colSpan={7} style={{ padding: "10px 14px", textAlign: "right" }}>Tổng giá trị tồn kho:</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#059669" }}>
                      {formatOpeningMoney(inventoryBalances.reduce((s, r) => s + (r.amount || 0), 0))} đ
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Category: Công nợ nhân viên */}
        {activeCategoryId === "employees" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 120 }}>Mã NV</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Họ và tên</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 100 }}>TK công nợ</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 160 }}>Dư Nợ (Tạm ứng)</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }}>Dư Có</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Nội dung</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeDebts.map((emp, i) => (
                    <tr key={emp.id || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#6366f1" }}>{emp.code}</td>
                      <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 600 }}>{emp.name}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{emp.accCode || "141"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: emp.debit > 0 ? "#16a34a" : "#64748b" }}>
                        {formatOpeningMoney(emp.debit)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#64748b" }}>{formatOpeningMoney(emp.credit)}</td>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{emp.reason || "-"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button type="button" onClick={() => handleEditOpeningItem("employees", emp)} style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sửa</button>
                          <button type="button" onClick={() => handleDeleteOpeningItem("employees", emp.id || emp.code)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category: CCDC đang sử dụng đầu kỳ (Luồng G) */}
        {activeCategoryId === "tools" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng thành tiền CCDC đầu kỳ</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
                  {formatOpeningMoney(toolBalances.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Giá trị đã phân bổ lũy kế</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#d97706", marginTop: 4 }}>
                  {formatOpeningMoney(toolBalances.reduce((s, r) => s + (Number(r.allocatedVal) || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Giá trị còn lại chờ phân bổ (TK 242)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                  {formatOpeningMoney(toolBalances.reduce((s, r) => s + (Number(r.remainingVal) || 0), 0))} đ
                </div>
              </div>
            </div>
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 120 }}>Số CT ghi tăng</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 110 }}>Mã CCDC</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Tên CCDC</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }}>Thành tiền</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }}>Đã phân bổ</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }}>Giá trị còn lại</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 100 }}>Kỳ còn lại</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {toolBalances.map((t, i) => (
                    <tr key={t.id || t.code || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>{t.voucherNo || "OPN"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#00a862" }}>{t.code}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 500, color: "#1e293b" }}>{t.name}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{formatOpeningMoney(t.totalAmount)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#d97706" }}>{formatOpeningMoney(t.allocatedVal)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{formatOpeningMoney(t.remainingVal)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>{t.remainingPeriod || 0}/{t.allocPeriod || 12} tháng</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button type="button" onClick={() => handleEditOpeningItem("tools", t)} style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sửa</button>
                          <button type="button" onClick={() => handleDeleteOpeningItem("tools", t.code || t.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category: Tài sản cố định đầu kỳ (Luồng H) */}
        {activeCategoryId === "assets" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng nguyên giá TSCĐ (TK 211/213)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
                  {formatOpeningMoney(assetBalances.reduce((s, r) => s + (Number(r.originalCost) || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Hao mòn lũy kế (TK 214)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626", marginTop: 4 }}>
                  {formatOpeningMoney(assetBalances.reduce((s, r) => s + (Number(r.accumDepr) || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Giá trị còn lại đầu kỳ (BR23)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                  {formatOpeningMoney(assetBalances.reduce((s, r) => s + (Number(r.remainingVal) || 0), 0))} đ
                </div>
              </div>
            </div>
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 110 }}>Mã TSCĐ</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Tên tài sản cố định</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 150 }}>Đơn vị sử dụng</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 90 }}>TK NG/HM</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 150 }}>Nguyên giá</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 150 }}>Hao mòn lũy kế</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 150 }}>Giá trị còn lại</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {assetBalances.map((a, i) => (
                    <tr key={a.id || a.code || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#00a862" }}>{a.code}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 500, color: "#1e293b" }}>{a.name}</td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>{a.department}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: "#64748b" }}>{a.costAcc || "2111"}/{a.deprAcc || "2141"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{formatOpeningMoney(a.originalCost)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#dc2626" }}>{formatOpeningMoney(a.accumDepr)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{formatOpeningMoney(a.remainingVal)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button type="button" onClick={() => handleEditOpeningItem("assets", a)} style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sửa</button>
                          <button type="button" onClick={() => handleDeleteOpeningItem("assets", a.code || a.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category: Chi phí trả trước đầu kỳ (Luồng I) */}
        {activeCategoryId === "prepaid" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng chi phí trả trước đầu kỳ (TK 242)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
                  {formatOpeningMoney(prepaidBalances.reduce((s, r) => s + (Number(r.amount) || 0), 0))} đ
                </div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Số khoản chi phí trả trước</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
                  {prepaidBalances.length} khoản
                </div>
              </div>
            </div>
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 150 }}>Mã CP trả trước</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Tên chi phí trả trước</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 180 }}>Số tiền (VNĐ)</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 160 }}>Số kỳ phân bổ (Tháng)</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 110 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {prepaidBalances.map((p, i) => (
                    <tr key={p.id || p.code || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#00a862" }}>{p.code}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 500, color: "#1e293b" }}>{p.name}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{formatOpeningMoney(p.amount)} đ</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>{p.allocMonths} tháng</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button type="button" onClick={() => handleEditOpeningItem("prepaid", p)} style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sửa</button>
                          <button type="button" onClick={() => handleDeleteOpeningItem("prepaid", p.code || p.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category: Chi phí dở dang (Luồng J) */}
        {activeCategoryId === "wip" && (
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ padding: "12px 20px", borderRight: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Hình thức theo dõi đang chọn (AF-08, BR28)</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#00a862", marginTop: 4 }}>{wipSubtab}</div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tổng chi phí SXKD dở dang đầu kỳ (TK 154)</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
                  {formatOpeningMoney(wipBalances.reduce((s, r) => s + (Number(r.rawMaterial) || 0) + (Number(r.labor) || 0) + (Number(r.machinery) || 0) + (Number(r.general) || 0), 0))} đ
                </div>
              </div>
            </div>
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 170 }}>Hình thức theo dõi</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 120 }}>Mã đối tượng</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Tên đối tượng / Công trình / Đơn hàng / HĐ</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }}>CP NVL trực tiếp</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }}>CP nhân công</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 140 }}>CP sản xuất chung</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", width: 90 }}>Xóa</th>
                  </tr>
                </thead>
                <tbody>
                  {wipBalances.map((w, i) => (
                    <tr key={w.id || w.code || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", color: "#0284c7", fontWeight: 600 }}>{w.trackingMode || wipSubtab}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#00a862" }}>{w.code}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 500, color: "#1e293b" }}>{w.name || w.desc || "-"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{formatOpeningMoney(w.rawMaterial)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{formatOpeningMoney(w.labor)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{formatOpeningMoney(w.general)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <button type="button" onClick={() => handleDeleteOpeningItem("wip", w.code || w.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
                          <span
                            style={{ color: "#00a862", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}
                            onClick={() => {
                              setAccountDetailModalIdx(idx);
                              setAccountDetailRows(
                                Array.isArray(row.details) && row.details.length > 0
                                  ? row.details
                                  : [{ object_code: "DT01", object_name: row.name, dimension: "HD-01", debit: row.debit || 0, credit: row.credit || 0 }]
                              );
                            }}
                          >
                            {Array.isArray(row.details) && row.details.length > 0 ? `Chi tiết (${row.details.length})` : "Nhập chi tiết"}
                          </span>
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

              {accountDetailModalIdx !== null && accountRows[accountDetailModalIdx] && (
                <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 13, color: "#0f172a" }}>
                      A4–A5: Nhập chi tiết số dư TK {accountRows[accountDetailModalIdx].account} – {accountRows[accountDetailModalIdx].name} (Nợ: {formatOpeningMoney(accountRows[accountDetailModalIdx].debit)} / Có: {formatOpeningMoney(accountRows[accountDetailModalIdx].credit)})
                    </strong>
                    <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12 }} onClick={() => setAccountDetailModalIdx(null)}>Thu gọn</button>
                  </div>
                  <table className="misa-opening-table-mini" style={{ width: "100%", marginBottom: 8 }}>
                    <thead>
                      <tr>
                        <th>Mã đối tượng</th>
                        <th>Tên đối tượng</th>
                        <th>Chiều theo dõi (HĐ/CT/Khoản mục)</th>
                        <th style={{ textAlign: "right" }}>Dư Nợ</th>
                        <th style={{ textAlign: "right" }}>Dư Có</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountDetailRows.map((dr, dIdx) => (
                        <tr key={dIdx}>
                          <td><input type="text" className="misa-opening-input" value={dr.object_code || ""} onChange={(e) => { const n = [...accountDetailRows]; n[dIdx] = { ...n[dIdx], object_code: e.target.value }; setAccountDetailRows(n); }} style={{ height: 26, fontSize: 12 }} /></td>
                          <td><input type="text" className="misa-opening-input" value={dr.object_name || ""} onChange={(e) => { const n = [...accountDetailRows]; n[dIdx] = { ...n[dIdx], object_name: e.target.value }; setAccountDetailRows(n); }} style={{ height: 26, fontSize: 12 }} /></td>
                          <td><input type="text" className="misa-opening-input" value={dr.dimension || ""} onChange={(e) => { const n = [...accountDetailRows]; n[dIdx] = { ...n[dIdx], dimension: e.target.value }; setAccountDetailRows(n); }} style={{ height: 26, fontSize: 12 }} /></td>
                          <td><input type="number" className="misa-opening-input" value={dr.debit || 0} onChange={(e) => { const n = [...accountDetailRows]; n[dIdx] = { ...n[dIdx], debit: Number(e.target.value) || 0 }; setAccountDetailRows(n); }} style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                          <td><input type="number" className="misa-opening-input" value={dr.credit || 0} onChange={(e) => { const n = [...accountDetailRows]; n[dIdx] = { ...n[dIdx], credit: Number(e.target.value) || 0 }; setAccountDetailRows(n); }} style={{ height: 26, fontSize: 12, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "center" }}><Trash2 size={13} color="#ef4444" style={{ cursor: "pointer" }} onClick={() => setAccountDetailRows(accountDetailRows.filter((_, i) => i !== dIdx))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button type="button" className="misa-opening-btn-secondary" style={{ height: 26, fontSize: 12 }} onClick={() => setAccountDetailRows([...accountDetailRows, { object_code: "", object_name: "", dimension: "", debit: 0, credit: 0 }])}>+ Thêm dòng chi tiết</button>
                    <button
                      type="button"
                      className="misa-opening-btn-primary"
                      style={{ height: 28, fontSize: 12 }}
                      onClick={() => {
                        const rowTarget = accountRows[accountDetailModalIdx];
                        const sumD = accountDetailRows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
                        const sumC = accountDetailRows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
                        if (sumD !== (Number(rowTarget.debit) || 0) || sumC !== (Number(rowTarget.credit) || 0)) {
                          notify?.(`EF-16: Tổng chi tiết (Nợ: ${formatOpeningMoney(sumD)}, Có: ${formatOpeningMoney(sumC)}) không khớp với dòng TK ${rowTarget.account} (BR08).`);
                          return;
                        }
                        const next = [...accountRows];
                        next[accountDetailModalIdx] = { ...rowTarget, details: accountDetailRows };
                        setAccountRows(next);
                        setAccountDetailModalIdx(null);
                        notify?.(`Đã xác nhận chi tiết số dư cho TK ${rowTarget.account} (A5).`);
                      }}
                    >
                      Xác nhận chi tiết (A5)
                    </button>
                  </div>
                </div>
              )}

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
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Số dư tài khoản", true)}>Lưu</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Số dư tài khoản", false, true)}>Lưu và In</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Số dư tài khoản", false)}>
                Lưu và Đóng
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
                    <option value="123456789">123456789 - Techcombank Chi nhánh Hoàn Kiếm (VND)</option>
                    <option value="987654321">987654321 - Techcombank Chi nhánh Hoàn Kiếm (USD)</option>
                    <option value="0011004234567">0011004234567 - Vietcombank Sở giao dịch</option>
                  </select>
                  <button type="button" className="misa-opening-btn-secondary" style={{ width: 34, padding: 0, justifyContent: "center" }}>
                    +
                  </button>
                </div>
              </div>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Loại tiền (AF-12)</label>
                  <select className="misa-opening-select" value={bankCurrency} onChange={(e) => { setBankCurrency(e.target.value); setBankExchangeRate(e.target.value === "USD" ? 25445 : 1); }}>
                    <option value="VND">VND - Đồng Việt Nam</option>
                    <option value="USD">USD - Đô la Mỹ</option>
                  </select>
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Tỷ giá quy đổi (BR11)</label>
                  <input type="number" className="misa-opening-input" value={bankExchangeRate} onChange={(e) => setBankExchangeRate(Number(e.target.value) || 0)} disabled={bankCurrency === "VND"} />
                </div>
              </div>
              <div className="misa-opening-form-row">
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Dư Nợ ({bankCurrency})</label>
                  <input aria-label="Dư Nợ ngân hàng đầu kỳ" type="number" className="misa-opening-input" value={bankDebit} onChange={(e) => setBankDebit(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Dư Có ({bankCurrency})</label>
                  <input aria-label="Dư Có ngân hàng đầu kỳ" type="number" className="misa-opening-input" value={bankCredit} onChange={(e) => setBankCredit(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>
                Đóng
              </button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Số dư TK ngân hàng", false)}>Lưu</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Số dư TK ngân hàng", false, true)}>Lưu và In</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Số dư TK ngân hàng", true)}>
                Lưu và Thêm
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
                      {OPENING_CUSTOMERS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
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
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ khách hàng", false)}>Lưu</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ khách hàng", true)}>Lưu và Thêm</button>
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
                      {OPENING_SUPPLIERS.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} - {s.name}
                        </option>
                      ))}
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
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ nhà cung cấp", false)}>Lưu</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ nhà cung cấp", true)}>Lưu và Thêm</button>
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
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Công nợ nhân viên", false)}>Lưu</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Công nợ nhân viên", true)}>Lưu và Thêm</button>
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
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Tồn kho vật tư", false)}>Lưu</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Tồn kho vật tư", true)}>Lưu và Thêm</button>
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
                  if (!toolCode.trim() || !toolName.trim() || !toolVoucherNo.trim()) {
                    notify?.("EF-09: Vui lòng nhập đầy đủ Số CT ghi tăng, Mã CCDC và Tên CCDC!");
                    return;
                  }
                  const totalAmt = Number(String(toolTotalAmount).replace(/[^\d.-]/g, "")) || 0;
                  const allocVal = Number(String(toolAllocatedVal).replace(/[^\d.-]/g, "")) || 0;
                  const remVal = Number(String(toolRemainingVal).replace(/[^\d.-]/g, "")) || (totalAmt - allocVal);
                  if (totalAmt > 0 && remVal !== totalAmt - allocVal) {
                    notify?.(`EF-14: Giá trị CCDC còn lại (${formatOpeningMoney(remVal)}) phải bằng Thành tiền (${formatOpeningMoney(totalAmt)}) trừ Đã phân bổ (${formatOpeningMoney(allocVal)}) (BR22).`);
                    return;
                  }
                  const newTool = {
                    id: editingItemId || toolCode.trim(),
                    voucherNo: toolVoucherNo.trim(),
                    voucherDate: toolVoucherDate || startDate,
                    code: toolCode.trim(),
                    name: toolName.trim(),
                    unit: toolUnit || "Chiếc",
                    quantity: Number(String(toolQuantity).replace(",", ".")) || 1,
                    totalAmount: totalAmt,
                    allocatedVal: allocVal,
                    remainingVal: remVal,
                    allocPeriod: Number(toolAllocPeriod) || 12,
                    remainingPeriod: Number(toolRemainingPeriod) || 0,
                    waitingAccount: toolWaitingAccount || "242",
                    allocRows: toolAllocRows,
                  };
                  const updated = [newTool, ...toolBalances.filter((t) => t.code !== newTool.code && t.id !== editingItemId)];
                  setToolBalances(updated);
                  void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
                    method: "POST",
                    body: JSON.stringify({ category: "tools", item: newTool, editing_id: editingItemId, action_mode: "SAVE" }),
                  }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ tools: updated }));
                  notify?.(`Đã lưu CCDC ${toolCode} thành công!`);
                  setEditingItemId(null);
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
              >Lưu</button>
              <button
                type="button"
                onClick={() => {
                  if (!toolCode.trim() || !toolName.trim() || !toolVoucherNo.trim()) {
                    notify?.("EF-09: Vui lòng nhập đầy đủ Số CT ghi tăng, Mã CCDC và Tên CCDC!");
                    return;
                  }
                  const totalAmt = Number(String(toolTotalAmount).replace(/[^\d.-]/g, "")) || 0;
                  const allocVal = Number(String(toolAllocatedVal).replace(/[^\d.-]/g, "")) || 0;
                  const remVal = Number(String(toolRemainingVal).replace(/[^\d.-]/g, "")) || (totalAmt - allocVal);
                  const newTool = {
                    id: editingItemId || toolCode.trim(),
                    voucherNo: toolVoucherNo.trim(),
                    voucherDate: toolVoucherDate || startDate,
                    code: toolCode.trim(),
                    name: toolName.trim(),
                    unit: toolUnit || "Chiếc",
                    quantity: Number(String(toolQuantity).replace(",", ".")) || 1,
                    totalAmount: totalAmt,
                    allocatedVal: allocVal,
                    remainingVal: remVal,
                    allocPeriod: Number(toolAllocPeriod) || 12,
                    remainingPeriod: Number(toolRemainingPeriod) || 0,
                    waitingAccount: toolWaitingAccount || "242",
                    allocRows: toolAllocRows,
                  };
                  const updated = [newTool, ...toolBalances.filter((t) => t.code !== newTool.code && t.id !== editingItemId)];
                  setToolBalances(updated);
                  void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
                    method: "POST",
                    body: JSON.stringify({ category: "tools", item: newTool, editing_id: editingItemId, action_mode: "SAVE_AND_ADD" }),
                  }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ tools: updated }));
                  notify?.(`Đã lưu CCDC ${toolCode} thành công! Mời tiếp tục khai báo (AF-01).`);
                  setEditingItemId(null);
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
                Lưu và thêm
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
                  if (!assetCode.trim() || !assetName.trim() || !assetVoucherNo.trim()) {
                    notify?.("EF-10: Vui lòng nhập đầy đủ Số CT ghi tăng, Mã tài sản và Tên tài sản!");
                    return;
                  }
                  const origCost = Number(String(assetOriginalCost).replace(/[^\d.-]/g, "")) || 0;
                  const accumDepr = Number(String(assetAccumDepr).replace(/[^\d.-]/g, "")) || 0;
                  const remVal = Number(String(assetRemainingVal).replace(/[^\d.-]/g, "")) || (origCost - accumDepr);
                  if (origCost > 0 && remVal !== origCost - accumDepr) {
                    notify?.(`EF-14: Giá trị còn lại (${formatOpeningMoney(remVal)}) phải bằng Nguyên giá (${formatOpeningMoney(origCost)}) trừ Hao mòn lũy kế (${formatOpeningMoney(accumDepr)}) (BR23).`);
                    return;
                  }
                  const newAsset = {
                    id: editingItemId || assetCode.trim(),
                    voucherNo: assetVoucherNo.trim(),
                    voucherDate: assetVoucherDate || startDate,
                    code: assetCode.trim(),
                    name: assetName.trim(),
                    assetType,
                    department: assetDepartment,
                    costAcc: assetCostAcc || "2111",
                    deprAcc: assetDeprAcc || "2141",
                    deprStartDate: assetDeprStartDate || startDate,
                    originalCost: origCost,
                    accumDepr,
                    remainingVal: remVal,
                    usageTime: Number(String(assetUsageTime).replace(",", ".")) || 5,
                    remainingTime: Number(String(assetRemainingTime).replace(",", ".")) || 3,
                    noDepreciation: assetNoDepreciation,
                    taxLimitChecked: assetTaxLimitChecked,
                    taxLawDeprCost: Number(assetTaxLawDeprCost) || 0,
                    taxLawMonthDeprVal: Number(assetTaxLawMonthDeprVal) || 0,
                  };
                  const updated = [newAsset, ...assetBalances.filter((a) => a.code !== newAsset.code && a.id !== editingItemId)];
                  setAssetBalances(updated);
                  void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
                    method: "POST",
                    body: JSON.stringify({ category: "assets", item: newAsset, editing_id: editingItemId, action_mode: "SAVE" }),
                  }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ assets: updated }));
                  notify?.(`Đã lưu tài sản cố định ${assetCode} - ${assetName} thành công!`);
                  setEditingItemId(null);
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
              >Lưu</button>
              <button
                type="button"
                onClick={() => {
                  if (!assetCode.trim() || !assetName.trim() || !assetVoucherNo.trim()) {
                    notify?.("EF-10: Vui lòng nhập đầy đủ Số CT ghi tăng, Mã tài sản và Tên tài sản!");
                    return;
                  }
                  const origCost = Number(String(assetOriginalCost).replace(/[^\d.-]/g, "")) || 0;
                  const accumDepr = Number(String(assetAccumDepr).replace(/[^\d.-]/g, "")) || 0;
                  const remVal = Number(String(assetRemainingVal).replace(/[^\d.-]/g, "")) || (origCost - accumDepr);
                  const newAsset = {
                    id: editingItemId || assetCode.trim(),
                    voucherNo: assetVoucherNo.trim(),
                    voucherDate: assetVoucherDate || startDate,
                    code: assetCode.trim(),
                    name: assetName.trim(),
                    assetType,
                    department: assetDepartment,
                    costAcc: assetCostAcc || "2111",
                    deprAcc: assetDeprAcc || "2141",
                    deprStartDate: assetDeprStartDate || startDate,
                    originalCost: origCost,
                    accumDepr,
                    remainingVal: remVal,
                    usageTime: Number(String(assetUsageTime).replace(",", ".")) || 5,
                    remainingTime: Number(String(assetRemainingTime).replace(",", ".")) || 3,
                    noDepreciation: assetNoDepreciation,
                  };
                  const updated = [newAsset, ...assetBalances.filter((a) => a.code !== newAsset.code && a.id !== editingItemId)];
                  setAssetBalances(updated);
                  void request<any>("/api/v1/general-ledger/opening-balances/save-item/", undefined, {
                    method: "POST",
                    body: JSON.stringify({ category: "assets", item: newAsset, editing_id: editingItemId, action_mode: "SAVE_AND_ADD" }),
                  }).then(applyBackendOpeningResponse).catch(() => syncOpeningBalancesToBackend({ assets: updated }));
                  notify?.(`Đã lưu tài sản cố định ${assetCode} thành công! Mời tiếp tục khai báo (AF-01).`);
                  setEditingItemId(null);
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
                Lưu và Thêm
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
                  const activeWipRows =
                    wipSubtab === "Công trình"
                      ? wipProjectRows
                      : wipSubtab === "Đơn hàng"
                      ? wipOrderRows
                      : wipSubtab === "Hợp đồng"
                      ? wipContractRows
                      : wipThcpRows;
                  const validWip = activeWipRows
                    .filter((r: any) => String(r.code || "").trim())
                    .map((r: any) => ({
                      ...r,
                      id: r.id || r.code,
                      trackingMode: wipSubtab,
                    }));
                  if (validWip.length === 0) {
                    notify?.("EF-23: Vui lòng chọn ít nhất một đối tượng tập hợp chi phí / công trình / đơn hàng / hợp đồng (BR29)!");
                    return;
                  }
                  const updated = [
                    ...validWip,
                    ...wipBalances.filter((w) => w.trackingMode !== wipSubtab),
                  ];
                  setWipBalances(updated);
                  syncOpeningBalancesToBackend({ wip: updated });
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
              >Lưu</button>
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
                  <input type="text" className="misa-opening-input" value={prepaidCode} onChange={(e) => setPrepaidCode(e.target.value)} />
                </div>
                <div className="misa-opening-field" style={{ flex: 2 }}>
                  <label className="misa-opening-label">Tên chi phí trả trước *</label>
                  <input type="text" className="misa-opening-input" value={prepaidName} onChange={(e) => setPrepaidName(e.target.value)} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số tiền *</label>
                  <input type="number" className="misa-opening-input" value={prepaidAmount} onChange={(e) => setPrepaidAmount(Number(e.target.value) || 0)} />
                </div>
                <div className="misa-opening-field">
                  <label className="misa-opening-label">Số kỳ phân bổ (Tháng)</label>
                  <input type="number" className="misa-opening-input" value={prepaidAllocMonths} onChange={(e) => setPrepaidAllocMonths(Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setActiveModal(null)}>Đóng</button>
              <button type="button" className="misa-opening-btn-secondary" onClick={() => handleSaveModal("Chi phí trả trước", false, true)}>Lưu và In</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => handleSaveModal("Chi phí trả trước", false)}>Lưu và Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUXILIARY MODAL A: NHẬP SỐ DƯ TỪ EXCEL (AF-03, EF-18, BR41)               */}
      {/* ========================================================================= */}
      {excelModalOpen && (
        <div className="misa-opening-modal-overlay" onClick={() => setExcelModalOpen(false)}>
          <div className="misa-opening-modal large" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Nhập số dư ban đầu từ Excel – {activeCategory?.title} (AF-03)</h3>
              <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setExcelModalOpen(false)} />
            </div>
            <div className="misa-opening-modal-body">
              <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#475569" }}>
                Dán hoặc chỉnh sửa dữ liệu các dòng nhập khẩu từ tệp mẫu Excel (Hệ thống kiểm tra từng dòng theo quy tắc BR41 & EF-18 trước khi ghi nhận):
              </p>
              <textarea
                value={excelJsonText}
                onChange={(e) => setExcelJsonText(e.target.value)}
                rows={9}
                style={{ width: "100%", fontFamily: "monospace", fontSize: 12.5, padding: 10, borderRadius: 6, border: "1px solid #cbd5e1" }}
              />
              {excelImportErrors.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#b91c1c", fontSize: 12.5 }}>
                  {excelImportErrors.map((er, idx) => (
                    <div key={idx}>{er.message}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setExcelModalOpen(false)}>Hủy</button>
              <button type="button" className="misa-opening-btn-primary" onClick={handleConfirmExcelImport}>Thực hiện Import (AF-03)</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUXILIARY MODAL B: XEM DANH SÁCH CHỨNG TỪ SỐ DƯ ĐẦU KỲ (AF-09)             */}
      {/* ========================================================================= */}
      {voucherListModalOpen && (
        <div className="misa-opening-modal-overlay" onClick={() => setVoucherListModalOpen(false)}>
          <div className="misa-opening-modal large" style={{ maxWidth: 960 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">Danh sách chứng từ / bản ghi số dư đầu kỳ (AF-09)</h3>
              <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setVoucherListModalOpen(false)} />
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 480, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Số chứng từ</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Ngày ĐK</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Nhóm số dư</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Diễn giải</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Số tiền (VNĐ)</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {openingVouchers.map((v, idx) => (
                    <tr key={v.voucher_id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: "#00a862" }}>{v.voucher_no}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "#64748b" }}>{v.voucher_date}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 500 }}>{v.category_title}</td>
                      <td style={{ padding: "8px 12px" }}>{v.description}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{formatOpeningMoney(v.amount)} đ</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: v.status === "POSTED" ? "#dcfce7" : "#fef3c7", color: v.status === "POSTED" ? "#166534" : "#92400e" }}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-primary" onClick={() => setVoucherListModalOpen(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUXILIARY MODAL C: BẢN IN SỐ DƯ ĐẦU KỲ (AF-13, EF-17, BR34, BR35)         */}
      {/* ========================================================================= */}
      {printModalOpen && printPreviewData && (
        <div className="misa-opening-modal-overlay" onClick={() => setPrintModalOpen(false)}>
          <div className="misa-opening-modal large" style={{ maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-opening-modal-header">
              <h3 className="misa-opening-modal-title">
                Bản in Bảng kê Số dư ban đầu – Mẫu {printPreviewData.form_code || "01-SĐĐK/TT99"} ({printPreviewData.circular_ref || "TT 99/2025/TT-BTC"})
              </h3>
              <X size={18} color="#64748b" style={{ cursor: "pointer" }} onClick={() => setPrintModalOpen(false)} />
            </div>
            <div className="misa-opening-modal-body" style={{ maxHeight: 460, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13 }}>
                <div>
                  <div><strong>Đơn vị:</strong> {printPreviewData.company_name}</div>
                  <div><strong>Nhóm số dư:</strong> {printPreviewData.category_title}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div><strong>Ngày bắt đầu hạch toán:</strong> {printPreviewData.start_date}</div>
                  <div><strong>Số dòng:</strong> {printPreviewData.row_count} bản ghi</div>
                </div>
              </div>
              <pre style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, overflowX: "auto" }}>
                {JSON.stringify(printPreviewData.rows || [], null, 2)}
              </pre>
            </div>
            <div className="misa-opening-modal-footer">
              <button type="button" className="misa-opening-btn-secondary" onClick={() => setPrintModalOpen(false)}>Đóng</button>
              <button type="button" className="misa-opening-btn-primary" onClick={() => { window.print(); }}>In chứng từ (AF-13)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
