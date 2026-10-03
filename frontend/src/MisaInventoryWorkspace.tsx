import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  Calendar,
  X,
  SlidersHorizontal,
  Package,
  ArrowRightLeft,
  Wrench,
  Calculator,
  ClipboardCheck,
  Building2,
  FileSpreadsheet,
  Boxes,
  Lightbulb,
  Star,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Filter,
  Settings,
  Maximize2,
  Copy,
  FileText,
  Clock,
  MoreHorizontal,
  LayoutGrid,
  RotateCcw,
  HelpCircle,
  Sparkles,
  Pin,
  Trash2,
  Paperclip,
  Upload,
  Minus,
  Keyboard,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";

export type MisaInventoryWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

// ============================================================================
// SAMPLE DATA
// ============================================================================
export const SAMPLE_WAREHOUSES = [
  { code: "KHO-01", name: "Kho tổng Minh An", address: "Khu CN Đài Tư, Long Biên, Hà Nội" },
  { code: "KHO-02", name: "Kho Nguyên vật liệu", address: "Phân xưởng sản xuất số 1" },
  { code: "KHO-03", name: "Kho Thành phẩm", address: "Tổng kho Logistics Đông Hà" },
  { code: "KHO-04", name: "Kho Hàng hóa thương mại", address: "18 Láng Hạ, Ba Đình, Hà Nội" },
];

export const SAMPLE_INVENTORY_ITEMS = [
  { code: "VT001", name: "Cáp ngầm trung thế 24kV Cu/XLPE/PVC/DSTA", unit: "Mét", group: "Vật tư điện", stock: 2450, minStock: 500, price: 285000 },
  { code: "VT002", name: "Tủ điện phân phối tổng MSB 630A Schneider", unit: "Bộ", group: "Tủ điện", stock: 12, minStock: 2, price: 45000000 },
  { code: "VT003", name: "Máy cắt không khí ACB 3P 1600A Fixed", unit: "Cái", group: "Thiết bị đóng cắt", stock: 6, minStock: 2, price: 38000000 },
  { code: "VT004", name: "Biến dòng đo lường trung thế 24kV 100/5A", unit: "Quả", group: "Khí cụ đo lường", stock: 35, minStock: 10, price: 1450000 },
  { code: "VT005", name: "Thanh đồng đỏ tiếp địa 30x3mm", unit: "Mét", group: "Vật tư tiếp địa", stock: 480, minStock: 100, price: 175000 },
  { code: "VT006", name: "Cầu chì trung thế 24kV 50A Efen", unit: "Cái", group: "Thiết bị bảo vệ", stock: 45, minStock: 15, price: 620000 },
];

export default function MisaInventoryWorkspace({
  company: _company = { id: "minh-an", name: "Công ty Cổ phần Minh An" },
  period: _period = "2026-09",
  tab = "process",
  href,
  notify,
}: MisaInventoryWorkspaceProps) {
  // Navigation helper
  const navigateTo = (targetTab: string) => {
    if (href) {
      window.location.href = href(`/inventory/${targetTab}`);
    }
  };

  // View modes for landing/list tabs
  const [receiptViewMode, setReceiptViewMode] = useState<"landing" | "list">("landing");
  const [issueViewMode, setIssueViewMode] = useState<"landing" | "list">("landing");
  const [transferViewMode, setTransferViewMode] = useState<"landing" | "list">("landing");
  const [productionOrderViewMode, setProductionOrderViewMode] = useState<"landing" | "list">("landing");
  const [assemblyViewMode, setAssemblyViewMode] = useState<"landing" | "list">("landing");
  const [stocktakeViewMode, setStocktakeViewMode] = useState<"landing" | "list">("landing");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowReceiptModal(false);
        setShowIssueModal(false);
        setShowTransferModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [receiptType, setReceiptType] = useState<
    "1. Thành phẩm sản xuất" | "2. Hàng bán bị trả lại" | "3. Khác (NVL thừa, HH thuê gia công, ...)"
  >("1. Thành phẩm sản xuất");
  const [receiptShowAccounts, setReceiptShowAccounts] = useState(true);
  const [receiptDeliveryPersonCode, setReceiptDeliveryPersonCode] = useState("");
  const [receiptDeliveryPersonName, setReceiptDeliveryPersonName] = useState("");
  const [receiptCustomerCode, setReceiptCustomerCode] = useState("");
  const [receiptCustomerName, setReceiptCustomerName] = useState("");
  const [receiptAddress, setReceiptAddress] = useState("");
  const [receiptSalesPerson, setReceiptSalesPerson] = useState("");
  const [receiptReason, setReceiptReason] = useState("");
  const [receiptAttachedDocs, setReceiptAttachedDocs] = useState("");
  const [receiptPostingDate, setReceiptPostingDate] = useState("30/09/2026 12:00:33");
  const [receiptVoucherDate, setReceiptVoucherDate] = useState("30/09/2026");
  const [receiptVoucherCode, setReceiptVoucherCode] = useState("NK00001");
  const [receiptRefSearch, setReceiptRefSearch] = useState("");
  const [receiptPriceMethod, setReceiptPriceMethod] = useState("Lấy từ đơn giá BQCK");
  const [receiptUseBQCKCheck, setReceiptUseBQCKCheck] = useState(false);
  const [receiptRows, setReceiptRows] = useState([
    {
      id: "row-1",
      itemCode: "",
      itemName: "",
      warehouse: "",
      debitAcc: "155",
      creditAcc: "154",
      unit: "",
      qty: 1,
      price: 0,
      amount: 0,
      prodOrder: "",
      costObject: "",
    },
  ]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState<
    "1. Bán hàng" | "2. Sản xuất" | "3. Khác (Xuất sử dụng, góp vốn, ...)"
  >("1. Bán hàng");
  const [issueShowAccounts, setIssueShowAccounts] = useState(true);
  const [issueCustomerCode, setIssueCustomerCode] = useState("");
  const [issueCustomerName, setIssueCustomerName] = useState("");
  const [issueReceiverCode, setIssueReceiverCode] = useState("");
  const [issueReceiverName, setIssueReceiverName] = useState("");
  const [issueAddress, setIssueAddress] = useState("");
  const [issueSalesPerson, setIssueSalesPerson] = useState("");
  const [issueDept, setIssueDept] = useState("");
  const [issueReason, setIssueReason] = useState("");
  const [issueAttachedDocs, setIssueAttachedDocs] = useState("");
  const [issuePostingDate, setIssuePostingDate] = useState("30/09/2026 12:01:33");
  const [issueVoucherDate, setIssueVoucherDate] = useState("30/09/2026");
  const [issueVoucherCode, setIssueVoucherCode] = useState("XK00001");
  const [issueRefSearch, setIssueRefSearch] = useState("");
  const [issueDeliveryLocation, setIssueDeliveryLocation] = useState("");
  const [issueRows, setIssueRows] = useState([
    {
      id: "row-1",
      itemCode: "",
      itemName: "",
      warehouse: "",
      debitAcc: "632",
      creditAcc: "",
      unit: "",
      qty: 1,
      price: 0,
      amount: 0,
      prodOrder: "",
      product: "",
    },
  ]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState<
    "Xuất kho kiêm vận chuyển nội bộ" | "Xuất kho gửi bán đại lý" | "Xuất chuyển kho nội bộ"
  >("Xuất kho kiêm vận chuyển nội bộ");
  const [transferShowAccounts, setTransferShowAccounts] = useState(true);
  const [transferOrderNo, setTransferOrderNo] = useState("");
  const [transferOrderDate, setTransferOrderDate] = useState("");
  const [transferOrderOwner, setTransferOrderOwner] = useState("");
  const [transferPurpose, setTransferPurpose] = useState("");
  const [transferReceiverUnitCode, setTransferReceiverUnitCode] = useState("");
  const [transferReceiverUnitName, setTransferReceiverUnitName] = useState("");
  const [transferReceiverUnitTax, setTransferReceiverUnitTax] = useState("");
  const [transferTransporterCode, setTransferTransporterCode] = useState("");
  const [transferTransporterName, setTransferTransporterName] = useState("");
  const [transferTransportContract, setTransferTransportContract] = useState("");
  const [transferVehicle, setTransferVehicle] = useState("");
  const [transferSenderName, setTransferSenderName] = useState("");
  const [transferReceiverName, setTransferReceiverName] = useState("");
  const [transferRefSearch, setTransferRefSearch] = useState("");
  const [transferPostingDate, setTransferPostingDate] = useState("30/09/2026 13:51:27");
  const [transferInvoiceForm, setTransferInvoiceForm] = useState("");
  const [transferInvoiceSymbol, setTransferInvoiceSymbol] = useState("");
  const [transferVoucherCode, setTransferVoucherCode] = useState("CK00001");
  const [transferVoucherDate, setTransferVoucherDate] = useState("30/09/2026");
  const [transferIsReplacementInvoice, setTransferIsReplacementInvoice] = useState(false);
  // Form 2 states: Xuất kho gửi bán đại lý
  const [transferContractNo, setTransferContractNo] = useState("");
  const [transferContractDate, setTransferContractDate] = useState("");
  const [transferContractOwner, setTransferContractOwner] = useState("");
  const [transferAgentCode, setTransferAgentCode] = useState("");
  const [transferAgentName, setTransferAgentName] = useState("");
  const [transferAgentTax, setTransferAgentTax] = useState("");
  // Form 2 & Form 3: Diễn giải
  const [transferExplanation, setTransferExplanation] = useState("");
  const [transferRows, setTransferRows] = useState([
    {
      id: "row-1",
      itemCode: "",
      itemName: "",
      sourceWarehouse: "",
      sourceWarehouseAddress: "",
      destWarehouse: "",
      destWarehouseAddress: "",
      debitAcc: "157",
      creditAcc: "",
      unit: "",
      qty: 1,
      price: 0,
      amount: 0,
    },
  ]);
  const [showCalculateCostModal, setShowCalculateCostModal] = useState(false);
  const [showStocktakeModal, setShowStocktakeModal] = useState(false);
  const [showWarehouseListModal, setShowWarehouseListModal] = useState(false);
  const [showProductionOrderModal, setShowProductionOrderModal] = useState(false);
  const [prodOrderCode, setProdOrderCode] = useState("LSX00001");
  const [prodOrderDate, setProdOrderDate] = useState("30/09/2026");
  const [prodOrderStatus, setProdOrderStatus] = useState("Đang thực hiện");
  const [prodOrderDescription, setProdOrderDescription] = useState("");
  const [prodOrderRefSearch, setProdOrderRefSearch] = useState("");
  const [prodOrderProductRows, setProdOrderProductRows] = useState([
    {
      id: "tp-1",
      productCode: "",
      productName: "",
      unit: "",
      qty: 1,
      salesOrder: "",
      salesContract: "",
      costObject: "",
    },
  ]);
  const [prodOrderMaterialRows, setProdOrderMaterialRows] = useState([
    {
      id: "nvl-1",
      materialCode: "",
      materialName: "",
      unit: "",
    },
  ]);
  const [showAssemblyModal, setShowAssemblyModal] = useState(false);
  const [assemblyCode, setAssemblyCode] = useState("LRTD00001");
  const [assemblyDate, setAssemblyDate] = useState("30/09/2026");
  const [assemblyDescription, setAssemblyDescription] = useState("");
  const [assemblyProductRows, setAssemblyProductRows] = useState([
    { id: "tp-1", itemCode: "", itemName: "", unit: "", qty: 1, price: 0, amount: 0 },
  ]);
  const [assemblyComponentRows, setAssemblyComponentRows] = useState([
    { id: "lk-1", itemCode: "", description: "", warehouse: "" },
    { id: "lk-2", itemCode: "", description: "", warehouse: "" },
  ]);

  const [showDisassemblyModal, setShowDisassemblyModal] = useState(false);
  const [disassemblyCode, setDisassemblyCode] = useState("LRTD00001");
  const [disassemblyDate, setDisassemblyDate] = useState("30/09/2026");
  const [disassemblyDescription, setDisassemblyDescription] = useState("");
  const [disassemblyAutoCalcRate, setDisassemblyAutoCalcRate] = useState(false);
  const [disassemblyGoodRows, setDisassemblyGoodRows] = useState([
    { id: "hh-1", itemCode: "", itemName: "", unit: "", qty: 1, price: 0, amount: 0 },
  ]);
  const [disassemblyOutputRows, setDisassemblyOutputRows] = useState([
    { id: "tp-1", itemCode: "", itemName: "", unit: "" },
    { id: "tp-2", itemCode: "", itemName: "", unit: "" },
  ]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [previewReportTitle, setPreviewReportTitle] = useState<string | null>(null);

  // Tab: Reports state
  const [reportSearch, setReportSearch] = useState("");
  const [reportLang, setReportLang] = useState("Tiếng Việt");
  const [starredReports, setStarredReports] = useState<Record<string, boolean>>({
    "Tổng hợp tồn kho": true,
    "Số chi tiết vật tư hàng hóa": true,
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    detail: false,
    production: false,
    reconciliation: false,
  });

  // Tab: Items state
  const [itemsCardCollapsed, setItemsCardCollapsed] = useState(false);
  const [showFullDemoCatalog, setShowFullDemoCatalog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  // Production Orders data
  const [productionOrders, setProductionOrders] = useState([
    {
      id: "lsx-01",
      code: "LSX00001",
      date: "28/09/2026",
      productName: "Tủ điện phân phối tổng MSB 630A Schneider",
      qty: 10,
      unit: "Bộ",
      dept: "Phân xưởng Tủ điện số 1",
      status: "Đang thực hiện",
      dueDate: "05/10/2026",
    },
    {
      id: "lsx-02",
      code: "LSX00002",
      date: "29/09/2026",
      productName: "Bộ tủ tụ bù công suất 250kVAR",
      qty: 5,
      unit: "Bộ",
      dept: "Phân xưởng Cơ điện 2",
      status: "Hoàn thành",
      dueDate: "30/09/2026",
    },
  ]);

  // Assembly/Disassembly Orders data
  const [assemblyOrders, setAssemblyOrders] = useState([
    {
      id: "lr-01",
      code: "LR00001",
      date: "28/09/2026",
      type: "Lắp ráp",
      productName: "Tủ điện phân phối tổng MSB 630A Schneider",
      qty: 2,
      unit: "Bộ",
      amount: 90000000,
      status: "Đã ghi sổ",
    },
    {
      id: "td-01",
      code: "TD00001",
      date: "29/09/2026",
      type: "Tháo dỡ",
      productName: "Trạm biến áp treo 3x75kVA cũ",
      qty: 1,
      unit: "Trạm",
      amount: 35000000,
      status: "Đã ghi sổ",
    },
  ]);

  // Catalog items data (exact match to screenshot 5)
  const [catalogItems, setCatalogItems] = useState([
    {
      id: "cpmh",
      name: "Chi phí mua hàng",
      code: "CPMH",
      vatPolicy: "Chưa xác định",
      type: "Dịch vụ",
      stockQty: 0.0,
      stockValue: 0,
    },
  ]);

  // Receipts data
  const [receipts, setReceipts] = useState([
    {
      id: "nk-01",
      code: "NK00001",
      date: "28/09/2026",
      type: "Nhập mua hàng trong nước",
      warehouse: "Kho tổng Minh An",
      partner: "Công ty Cổ phần Dây và Cáp điện Cadisun",
      description: "Nhập cáp ngầm trung thế 24kV Cu/XLPE theo HĐ 01023",
      amount: 142500000,
      status: "Đã ghi sổ",
    },
    {
      id: "nk-02",
      code: "NK00002",
      date: "29/09/2026",
      type: "Nhập thành phẩm từ sản xuất",
      warehouse: "Kho Thành phẩm",
      partner: "Phân xưởng Lắp ráp Tủ điện số 1",
      description: "Nhập tủ điện phân phối MSB 630A hoàn thiện",
      amount: 90000000,
      status: "Đã ghi sổ",
    },
  ]);

  // Issues data
  const [issues, setIssues] = useState([
    {
      id: "xk-01",
      code: "XK00001",
      date: "29/09/2026",
      type: "Xuất bán hàng",
      warehouse: "Kho tổng Minh An",
      partner: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      description: "Xuất cáp điện và phụ kiện công trình dự án Nam Thăng Long",
      amount: 71250000,
      status: "Đã ghi sổ",
    },
    {
      id: "xk-02",
      code: "XK00002",
      date: "30/09/2026",
      type: "Xuất kho nguyên vật liệu sản xuất",
      warehouse: "Kho Nguyên vật liệu",
      partner: "Xưởng cơ điện Thiên An",
      description: "Xuất vật tư thiết bị đóng cắt lắp ráp dự án trạm 110kV",
      amount: 38000000,
      status: "Đã ghi sổ",
    },
  ]);

  // Transfers data
  const [transfers, setTransfers] = useState([
    {
      id: "ck-01",
      code: "CK00001",
      date: "27/09/2026",
      sourceWarehouse: "Kho tổng Minh An",
      destWarehouse: "Kho Nguyên vật liệu",
      description: "Chuyển vật tư dây cáp điện phục vụ tổ hợp trạm MSB",
      amount: 45000000,
      status: "Đã ghi sổ",
    },
  ]);

  // Stocktake data
  const [stocktakes] = useState([
    {
      id: "kk-01",
      code: "KK00001",
      date: "25/09/2026",
      warehouse: "Kho tổng Minh An",
      purpose: "Kiểm kê định kỳ cuối quý III/2026",
      difference: 0,
      status: "Đã hoàn thành",
    },
  ]);

  // Handle Save Receipt
  const handleSaveReceipt = (data: any) => {
    setReceipts([
      {
        id: `nk-${Date.now()}`,
        code: data.code || `NK0000${receipts.length + 1}`,
        date: data.date || "30/09/2026",
        type: data.type || "Nhập mua hàng trong nước",
        warehouse: data.warehouse || "Kho tổng Minh An",
        partner: data.partner || "Công ty TNHH Cung ứng Vật tư",
        description: data.description || "Nhập kho vật tư hàng hóa",
        amount: Number(data.amount) || 28500000,
        status: "Đã ghi sổ",
      },
      ...receipts,
    ]);
    setShowReceiptModal(false);
    notify(`Đã lưu và ghi sổ Phiếu nhập kho ${data.code || ""} thành công!`);
  };

  // Handle Save Issue
  const handleSaveIssue = (data: any) => {
    setIssues([
      {
        id: `xk-${Date.now()}`,
        code: data.code || `XK0000${issues.length + 1}`,
        date: data.date || "30/09/2026",
        type: data.type || "Xuất bán hàng",
        warehouse: data.warehouse || "Kho tổng Minh An",
        partner: data.partner || "Khách hàng mua vật tư",
        description: data.description || "Xuất kho hàng hóa",
        amount: Number(data.amount) || 15000000,
        status: "Đã ghi sổ",
      },
      ...issues,
    ]);
    setShowIssueModal(false);
    notify(`Đã lưu và ghi sổ Phiếu xuất kho ${data.code || ""} thành công!`);
  };

  // Handle Save Transfer
  const handleSaveTransfer = (data: any) => {
    setTransfers([
      {
        id: `ck-${Date.now()}`,
        code: data.code || `CK0000${transfers.length + 1}`,
        date: data.date || "30/09/2026",
        sourceWarehouse: data.sourceWarehouse || "Kho tổng Minh An",
        destWarehouse: data.destWarehouse || "Kho Nguyên vật liệu",
        description: data.description || "Điều chuyển kho nội bộ",
        amount: Number(data.amount) || 20000000,
        status: "Đã ghi sổ",
      },
      ...transfers,
    ]);
    setShowTransferModal(false);
    notify(`Đã lưu Phiếu chuyển kho ${data.code || ""} thành công!`);
  };

  // =========================================================================
  // 1. TAB: QUY TRÌNH (MATCHING SCREENSHOT 1)
  // =========================================================================
  if (tab === "process") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9", padding: "16px", boxSizing: "border-box", overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(320px, 1fr)", gap: 16 }}>
          {/* LEFT CARD: NGHIỆP VỤ KHO */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 460,
            }}
          >
            {/* Title */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5 }}>
                NGHIỆP VỤ KHO
              </h3>
            </div>

            {/* Interactive Flowchart Diagram */}
            <div style={{ position: "relative", margin: "20px 0 40px 0" }}>
              {/* Connecting Horizontal Line with Right Arrow */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "12%",
                  right: "6%",
                  height: 2,
                  background: "#cbd5e1",
                  transform: "translateY(-50%)",
                  zIndex: 1,
                }}
              >
                {/* Arrow head on the right */}
                <div
                  style={{
                    position: "absolute",
                    right: -2,
                    top: -4,
                    width: 0,
                    height: 0,
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderLeft: "8px solid #cbd5e1",
                  }}
                />
              </div>

              {/* TOP ROW: Lệnh sản xuất | Xuất kho | Chuyển kho */}
              <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 65, position: "relative", zIndex: 2 }}>
                {/* 1. Lệnh sản xuất */}
                <div
                  onClick={() => navigateTo("production-orders")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 110 }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#e6f4ea",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid #bbf7d0",
                      boxShadow: "0 4px 10px rgba(0, 168, 98, 0.15)",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <Package size={26} style={{ color: "#00a862" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>
                    Lệnh sản xuất
                  </span>
                  {/* Vertical connecting line down to main horizontal line */}
                  <div style={{ position: "absolute", top: 54, width: 1.5, height: 42, background: "#cbd5e1", zIndex: -1 }} />
                </div>

                {/* 2. Xuất kho */}
                <div
                  onClick={() => navigateTo("issues")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 110 }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#e6f4ea",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid #bbf7d0",
                      boxShadow: "0 4px 10px rgba(0, 168, 98, 0.15)",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <Building2 size={26} style={{ color: "#00a862" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>
                    Xuất kho
                  </span>
                  <div style={{ position: "absolute", top: 54, width: 1.5, height: 42, background: "#cbd5e1", zIndex: -1 }} />
                </div>

                {/* 3. Chuyển kho */}
                <div
                  onClick={() => navigateTo("transfers")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 110 }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#e6f4ea",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid #bbf7d0",
                      boxShadow: "0 4px 10px rgba(0, 168, 98, 0.15)",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <ArrowRightLeft size={26} style={{ color: "#00a862" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>
                    Chuyển kho
                  </span>
                  <div style={{ position: "absolute", top: 54, width: 1.5, height: 42, background: "#cbd5e1", zIndex: -1 }} />
                </div>
              </div>

              {/* BOTTOM ROW: Lắp ráp, tháo dỡ | Nhập kho | Tính giá xuất kho | Kiểm kê */}
              <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
                {/* 4. Lắp ráp, tháo dỡ */}
                <div
                  onClick={() => navigateTo("assembly")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 105 }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#e6f4ea",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid #bbf7d0",
                      boxShadow: "0 4px 10px rgba(0, 168, 98, 0.15)",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <Wrench size={26} style={{ color: "#00a862" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>
                    Lắp ráp, tháo dỡ
                  </span>
                </div>

                {/* 5. Nhập kho */}
                <div
                  onClick={() => navigateTo("receipts")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 105 }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#e6f4ea",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid #bbf7d0",
                      boxShadow: "0 4px 10px rgba(0, 168, 98, 0.15)",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <Boxes size={26} style={{ color: "#00a862" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>
                    Nhập kho
                  </span>
                </div>

                {/* 6. Tính giá xuất kho */}
                <div
                  onClick={() => setShowCalculateCostModal(true)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 105 }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#e6f4ea",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid #bbf7d0",
                      boxShadow: "0 4px 10px rgba(0, 168, 98, 0.15)",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <Calculator size={26} style={{ color: "#00a862" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>
                    Tính giá xuất kho
                  </span>
                </div>

                {/* 7. Kiểm kê */}
                <div
                  onClick={() => navigateTo("stocktake")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 105 }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#e6f4ea",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid #bbf7d0",
                      boxShadow: "0 4px 10px rgba(0, 168, 98, 0.15)",
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <ClipboardCheck size={26} style={{ color: "#00a862" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8, textAlign: "center" }}>
                    Kiểm kê
                  </span>
                </div>
              </div>
            </div>

            {/* BOTTOM QUICK BAR: Kho | Vật tư hàng hóa | Đơn vị tính | Tiện ích | Tùy chọn */}
            <div
              style={{
                borderTop: "1px solid #f1f5f9",
                paddingTop: 16,
                display: "flex",
                justifyContent: "space-around",
                alignItems: "center",
              }}
            >
              <div
                onClick={() => setShowWarehouseListModal(true)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <Building2 size={20} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 12.5, color: "#475569" }}>Kho</span>
              </div>
              <div
                onClick={() => navigateTo("items")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <Package size={20} style={{ color: "#eab308" }} />
                <span style={{ fontSize: 12.5, color: "#475569" }}>Vật tư hàng hóa</span>
              </div>
              <div
                onClick={() => notify("Đã mở danh mục Đơn vị tính: Mét, Cái, Bộ, Quả...")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <Boxes size={20} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 12.5, color: "#475569" }}>Đơn vị tính</span>
              </div>
              <div
                onClick={() => notify("Các tiện ích kho: Nhập số dư đầu kỳ, In mã vạch...")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <Lightbulb size={20} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 12.5, color: "#475569" }}>Tiện ích</span>
              </div>
              <div
                onClick={() => notify("Tùy chọn thiết lập phương pháp tính giá và kiểm kê kho")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <SlidersHorizontal size={20} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 12.5, color: "#475569" }}>Tùy chọn</span>
              </div>
            </div>
          </div>

          {/* RIGHT CARD: BÁO CÁO */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 460,
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 14.5, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5 }}>
                BÁO CÁO
              </h3>
              <div style={{ height: 1, background: "#f1f5f9", marginBottom: 16 }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  "Sổ chi tiết vật tư hàng hóa",
                  "Tổng hợp tồn kho",
                  "Báo cáo đối chiếu giá thành và giá trị nhập kho",
                  "Báo cáo đối chiếu kho và sổ cái",
                  "Báo cáo tiến độ sản xuất",
                ].map((rep, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      navigateTo("reports");
                      notify(`Đang xem báo cáo: ${rep}`);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 13,
                      color: "#334155",
                      cursor: "pointer",
                      lineHeight: 1.45,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#00a862"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#334155"; }}
                  >
                    <span style={{ color: "#64748b", fontWeight: 700 }}>•</span>
                    <span>{rep}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => navigateTo("reports")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#0284c7",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Tất cả báo cáo
              </button>
            </div>
          </div>
        </div>

        {/* Modal Dialogs */}
        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 2. TAB: BIỂU ĐỒ (MATCHING SCREENSHOT 2)
  // =========================================================================
  if (tab === "chart") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9", padding: "16px", boxSizing: "border-box", overflow: "auto", gap: 16 }}>
        {/* Top 4 KPI Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {/* Card 1: Hàng hóa sắp hết hàng */}
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#ffedd5", display: "grid", placeItems: "center" }}>
                <Package size={22} style={{ color: "#ea580c" }} />
              </div>
              <div>
                <span style={{ fontSize: 26, fontWeight: 700, color: "#0284c7", display: "block", lineHeight: 1.1 }}>0</span>
                <span style={{ fontSize: 13, color: "#475569", marginTop: 4, display: "block" }}>Hàng hóa sắp hết hàng</span>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
              <span>Số liệu tính đến: 11:57</span>
              <button type="button" onClick={() => notify("Đã cập nhật số liệu")} style={{ border: "none", background: "transparent", color: "#0284c7", cursor: "pointer", padding: 0 }}>Tải lại</button>
            </div>
          </div>

          {/* Card 2: Hàng hóa hết hàng */}
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "16px", display: "flex", alignItems: "center", gap: 16, minHeight: 110 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fee2e2", display: "grid", placeItems: "center" }}>
              <Package size={22} style={{ color: "#dc2626" }} />
            </div>
            <div>
              <span style={{ fontSize: 26, fontWeight: 700, color: "#0284c7", display: "block", lineHeight: 1.1 }}>0</span>
              <span style={{ fontSize: 13, color: "#475569", marginTop: 4, display: "block" }}>Hàng hóa hết hàng</span>
            </div>
          </div>

          {/* Card 3: Vòng quay hàng tồn kho */}
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#dcfce7", display: "grid", placeItems: "center" }}>
                  <RefreshCw size={22} style={{ color: "#16a34a" }} />
                </div>
                <div>
                  <span style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", display: "block", lineHeight: 1.1 }}>0,00</span>
                  <span style={{ fontSize: 13, color: "#475569", marginTop: 4, display: "block" }}>Vòng quay hàng tồn kho</span>
                </div>
              </div>
              <select style={{ border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, padding: "2px 6px", height: 26, background: "#ffffff" }}>
                <option>Tháng này</option>
                <option>Quý này</option>
                <option>Năm nay</option>
              </select>
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
              <span>Số liệu tính đến: 11:57</span>
              <button type="button" onClick={() => notify("Đã cập nhật số liệu")} style={{ border: "none", background: "transparent", color: "#0284c7", cursor: "pointer", padding: 0 }}>Tải lại</button>
            </div>
          </div>

          {/* Card 4: Số ngày lưu kho bình quân */}
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "16px", display: "flex", alignItems: "center", gap: 16, minHeight: 110 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e0f2fe", display: "grid", placeItems: "center" }}>
              <Calendar size={22} style={{ color: "#0284c7" }} />
            </div>
            <div>
              <span style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", display: "block", lineHeight: 1.1 }}>0</span>
              <span style={{ fontSize: 13, color: "#475569", marginTop: 4, display: "block" }}>Số ngày lưu kho bình quân</span>
            </div>
          </div>
        </div>

        {/* 2 Main Dashboard Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, flex: 1 }}>
          {/* Left Card: Hàng hóa tồn kho */}
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 14.5, fontWeight: 700, color: "#1e293b" }}>Hàng hóa tồn kho</h4>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: "#1e293b" }}>0 đ</span>
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Đvt: đồng</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.5, marginTop: 4, display: "block" }}>TỔNG CỘNG</span>
                </div>
              </div>

              {/* Table / Legend */}
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", fontSize: 12, fontWeight: 600, color: "#64748b", padding: "6px 0" }}>
                  <span>Tên</span>
                  <span style={{ textAlign: "right" }}>Số lượng</span>
                  <span style={{ textAlign: "right" }}>Giá trị</span>
                </div>
                {/* Visual empty rows / colored chips */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: "#8b5cf6" }} />
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, flex: 1 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: "#3b82f6" }} />
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, flex: 1 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: "#06b6d4" }} />
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, flex: 1 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: "#10b981" }} />
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, flex: 1 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: "#84cc16" }} />
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, flex: 1 }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: 20 }}>
              <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                Số liệu tính đến: 11:57 <button type="button" onClick={() => notify("Đã cập nhật số liệu tồn kho")} style={{ border: "none", background: "transparent", color: "#0284c7", cursor: "pointer", padding: 0 }}>Tải lại</button>
              </div>
              <button type="button" onClick={() => navigateTo("items")} style={{ border: "none", background: "transparent", color: "#0284c7", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Xem thêm</button>
            </div>
          </div>

          {/* Right Card: Hàng hóa sắp hết */}
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h4 style={{ margin: "0 0 14px 0", fontSize: 14.5, fontWeight: 700, color: "#1e293b" }}>Hàng hóa sắp hết</h4>
              {/* Header Table */}
              <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr", fontSize: 12, fontWeight: 600, color: "#64748b", borderBottom: "1px solid #cbd5e1", paddingBottom: 6 }}>
                <span>Tên hàng hóa</span>
                <span>Kho</span>
                <span style={{ textAlign: "right" }}>SL tồn</span>
                <span style={{ textAlign: "right" }}>SL tồn tối thiểu</span>
              </div>
              {/* Placeholder empty lines */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                <div style={{ height: 10, background: "#f8fafc", borderRadius: 4, width: "100%" }} />
                <div style={{ height: 10, background: "#f8fafc", borderRadius: 4, width: "95%" }} />
                <div style={{ height: 10, background: "#f8fafc", borderRadius: 4, width: "98%" }} />
                <div style={{ height: 10, background: "#f8fafc", borderRadius: 4, width: "92%" }} />
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: 20 }}>
              Số liệu tính đến: 11:57 <button type="button" onClick={() => notify("Đã kiểm tra lại mức tồn kho")} style={{ border: "none", background: "transparent", color: "#0284c7", cursor: "pointer", padding: 0 }}>Tải lại</button>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 3. TAB: NHẬP KHO (MATCHING SCREENSHOT 3)
  // =========================================================================
  if (tab === "receipts") {
    if (receiptViewMode === "landing") {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff", padding: "40px 20px", boxSizing: "border-box" }}>
          {/* Illustration: Racks, boxes, receipt doc, girl at laptop */}
          <div style={{ marginBottom: 16 }}>
            <svg width="260" height="170" viewBox="0 0 260 170" fill="none">
              <ellipse cx="130" cy="148" rx="100" ry="14" fill="#f1f5f9" />
              {/* Warehouse shelf / rack */}
              <rect x="65" y="42" width="75" height="88" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <line x1="65" y1="72" x2="140" y2="72" stroke="#cbd5e1" strokeWidth="2" />
              <line x1="65" y1="102" x2="140" y2="102" stroke="#cbd5e1" strokeWidth="2" />
              {/* Green boxes */}
              <rect x="75" y="48" width="22" height="18" rx="3" fill="#10b981" />
              <rect x="105" y="48" width="25" height="18" rx="3" fill="#00a862" />
              <rect x="75" y="78" width="26" height="18" rx="3" fill="#059669" />
              {/* Receipt Doc */}
              <rect x="125" y="32" width="48" height="64" rx="4" fill="#ffffff" stroke="#00a862" strokeWidth="1.5" />
              <circle cx="149" cy="50" r="10" fill="#e6f4ea" />
              <path d="M149 45 V55 M144 50 H154" stroke="#00a862" strokeWidth="1.8" strokeLinecap="round" />
              {/* Girl with laptop */}
              <circle cx="178" cy="84" r="14" fill="#64748b" />
              <path d="M164 122 C164 105 192 105 192 122 Z" fill="#00a862" />
              <rect x="156" y="108" width="36" height="20" rx="3" fill="#cbd5e1" />
              <path d="M152 130 H196" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h2 style={{ fontSize: 17.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center" }}>
            Ghi nhận và quản lý hoạt động nhập kho
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Button: Thêm bằng AI */}
            <button
              type="button"
              onClick={() => {
                setShowReceiptModal(true);
                notify("AVA Kế toán đã sẵn sàng hỗ trợ khởi tạo phiếu nhập kho!");
              }}
              style={{
                height: 36,
                padding: "0 18px",
                background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
              }}
            >
              <span>Thêm bằng AI</span>
            </button>

            {/* Button: Thêm */}
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              style={{
                height: 36,
                padding: "0 22px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
              }}
            >
              Thêm
            </button>

            {/* Button: Nhập từ Excel */}
            <button
              type="button"
              onClick={() => notify("Đang tải biểu mẫu Excel nhập kho...")}
              style={{
                height: 36,
                padding: "0 18px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReceiptViewMode("list")}
            style={{
              marginTop: 48,
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

          {renderModals()}
        </div>
      );
    }

    // List view mode
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Đang chuẩn bị nhập Excel phiếu nhập kho...")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
            >
              Nhập từ Excel
            </button>
            <button
              type="button"
              onClick={() => setReceiptViewMode("landing")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#64748b", cursor: "pointer" }}
            >
              Quay lại quy trình
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm phiếu nhập kho..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách phiếu nhập kho")}
              title="Làm mới"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ width: 170, padding: "8px 10px" }}>Loại nhập kho</th>
                <th style={{ width: 160, padding: "8px 10px" }}>Kho nhập</th>
                <th style={{ padding: "8px 10px" }}>Nhà cung cấp / Đối tượng</th>
                <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {receipts
                .filter((r) => !searchQuery || r.code.toLowerCase().includes(searchQuery.toLowerCase()) || r.partner.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => setShowReceiptModal(true)}>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{row.type}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.warehouse}</td>
                    <td style={{ padding: "8px 10px" }}>{row.partner}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.description}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(row.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{row.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>Tổng số: <strong>{receipts.length}</strong> chứng từ</div>
          <div>Tổng tiền nhập kho: <strong style={{ color: "#00a862" }}>{formatVND(receipts.reduce((s, r) => s + r.amount, 0))} đ</strong></div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 4. TAB: XUẤT KHO (MATCHING SCREENSHOT 4)
  // =========================================================================
  if (tab === "issues") {
    if (issueViewMode === "landing") {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff", padding: "40px 20px", boxSizing: "border-box" }}>
          <div style={{ marginBottom: 16 }}>
            <svg width="260" height="170" viewBox="0 0 260 170" fill="none">
              <ellipse cx="130" cy="148" rx="100" ry="14" fill="#f1f5f9" />
              {/* Warehouse shelf with outward arrow */}
              <rect x="65" y="42" width="75" height="88" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <line x1="65" y1="72" x2="140" y2="72" stroke="#cbd5e1" strokeWidth="2" />
              <line x1="65" y1="102" x2="140" y2="102" stroke="#cbd5e1" strokeWidth="2" />
              <rect x="75" y="78" width="26" height="18" rx="3" fill="#10b981" />
              {/* Outgoing box */}
              <rect x="100" y="52" width="28" height="20" rx="3" fill="#00a862" />
              <path d="M128 62 H148 M144 58 L148 62 L144 66" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Doc with outgoing badge */}
              <rect x="140" y="32" width="48" height="64" rx="4" fill="#ffffff" stroke="#00a862" strokeWidth="1.5" />
              <circle cx="164" cy="50" r="10" fill="#e6f4ea" />
              <path d="M160 50 H168 M165 47 L168 50 L165 53" stroke="#00a862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              {/* Person at laptop */}
              <circle cx="178" cy="84" r="14" fill="#64748b" />
              <path d="M164 122 C164 105 192 105 192 122 Z" fill="#00a862" />
              <rect x="156" y="108" width="36" height="20" rx="3" fill="#cbd5e1" />
              <path d="M152 130 H196" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h2 style={{ fontSize: 17.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center" }}>
            Ghi nhận và quản lý hoạt động xuất kho
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setShowIssueModal(true);
                notify("AVA Kế toán đã phân tích số lượng tồn kho khả dụng để xuất hàng!");
              }}
              style={{
                height: 36,
                padding: "0 18px",
                background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
              }}
            >
              <span>Thêm bằng AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowIssueModal(true)}
              style={{
                height: 36,
                padding: "0 22px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
              }}
            >
              Thêm
            </button>

            <button
              type="button"
              onClick={() => notify("Đang tải biểu mẫu Excel xuất kho...")}
              style={{
                height: 36,
                padding: "0 18px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>

            <button
              type="button"
              onClick={() => notify("Tiện ích xuất kho: Xuất theo định mức, In phiếu hàng loạt...")}
              style={{
                height: 36,
                padding: "0 18px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Tiện ích
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIssueViewMode("list")}
            style={{
              marginTop: 48,
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

          {renderModals()}
        </div>
      );
    }

    // List view mode
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowIssueModal(true)}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Đang tải Excel xuất kho...")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
            >
              Nhập từ Excel
            </button>
            <button
              type="button"
              onClick={() => notify("Các tiện ích xuất kho")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
            >
              Tiện ích
            </button>
            <button
              type="button"
              onClick={() => setIssueViewMode("landing")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#64748b", cursor: "pointer" }}
            >
              Quay lại quy trình
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm phiếu xuất kho..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách phiếu xuất kho")}
              title="Làm mới"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ width: 170, padding: "8px 10px" }}>Loại xuất kho</th>
                <th style={{ width: 160, padding: "8px 10px" }}>Kho xuất</th>
                <th style={{ padding: "8px 10px" }}>Khách hàng / Đối tượng</th>
                <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {issues
                .filter((r) => !searchQuery || r.code.toLowerCase().includes(searchQuery.toLowerCase()) || r.partner.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => setShowIssueModal(true)}>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{row.type}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.warehouse}</td>
                    <td style={{ padding: "8px 10px" }}>{row.partner}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.description}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(row.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{row.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>Tổng số: <strong>{issues.length}</strong> chứng từ</div>
          <div>Tổng tiền xuất kho: <strong style={{ color: "#00a862" }}>{formatVND(issues.reduce((s, r) => s + r.amount, 0))} đ</strong></div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 5. TAB: CHUYỂN KHO (MATCHING SCREENSHOT 5)
  // =========================================================================
  if (tab === "transfers") {
    if (transferViewMode === "landing") {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff", padding: "40px 20px", boxSizing: "border-box" }}>
          <div style={{ marginBottom: 16 }}>
            <svg width="260" height="170" viewBox="0 0 260 170" fill="none">
              <ellipse cx="130" cy="148" rx="100" ry="14" fill="#f1f5f9" />
              {/* Warehouse 1 (Source) */}
              <rect x="55" y="52" width="55" height="66" rx="4" fill="#ffffff" stroke="#00a862" strokeWidth="2" />
              <path d="M55 70 H110" stroke="#00a862" strokeWidth="1.5" />
              <path d="M72 118 V90 H93 V118" fill="#e6f4ea" stroke="#00a862" strokeWidth="1.5" />
              {/* Transfer arrow between warehouses */}
              <path d="M116 75 H136 M132 71 L136 75 L132 79" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M136 85 H116 M120 81 L116 85 L120 89" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Warehouse 2 (Dest) */}
              <rect x="142" y="52" width="55" height="66" rx="4" fill="#ffffff" stroke="#00a862" strokeWidth="2" />
              <path d="M142 70 H197" stroke="#00a862" strokeWidth="1.5" />
              <path d="M159 118 V90 H180 V118" fill="#e6f4ea" stroke="#00a862" strokeWidth="1.5" />
              {/* Transfer document */}
              <rect x="175" y="32" width="44" height="58" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
              <circle cx="197" cy="46" r="8" fill="#e6f4ea" />
              <path d="M194 46 H200 M197 43 L200 46 L197 49" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Girl with laptop */}
              <circle cx="215" cy="84" r="13" fill="#64748b" />
              <path d="M202 120 C202 105 228 105 228 120 Z" fill="#00a862" />
              <rect x="196" y="106" width="34" height="18" rx="3" fill="#cbd5e1" />
            </svg>
          </div>

          <h2 style={{ fontSize: 17.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center" }}>
            Ghi nhận và quản lý hoạt động chuyển kho
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setShowTransferModal(true);
                notify("AVA Kế toán đã phân tích tuyến điều chuyển kho tối ưu!");
              }}
              style={{
                height: 36,
                padding: "0 18px",
                background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
              }}
            >
              <span>Thêm bằng AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              style={{
                height: 36,
                padding: "0 22px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
              }}
            >
              Thêm
            </button>

            <button
              type="button"
              onClick={() => notify("Đang chuẩn bị mẫu Excel chuyển kho...")}
              style={{
                height: 36,
                padding: "0 18px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>

            <button
              type="button"
              onClick={() => notify("Các tiện ích điều chuyển kho")}
              style={{
                height: 36,
                padding: "0 18px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Tiện ích
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTransferViewMode("list")}
            style={{
              marginTop: 48,
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

          {renderModals()}
        </div>
      );
    }

    // List view mode
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Đang tải Excel chuyển kho...")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
            >
              Nhập từ Excel
            </button>
            <button
              type="button"
              onClick={() => notify("Tiện ích chuyển kho")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
            >
              Tiện ích
            </button>
            <button
              type="button"
              onClick={() => setTransferViewMode("landing")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#64748b", cursor: "pointer" }}
            >
              Quay lại quy trình
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm phiếu chuyển kho..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách phiếu chuyển kho")}
              title="Làm mới"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ width: 160, padding: "8px 10px" }}>Kho xuất</th>
                <th style={{ width: 160, padding: "8px 10px" }}>Kho nhập</th>
                <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng giá trị</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {transfers
                .filter((r) => !searchQuery || r.code.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => setShowTransferModal(true)}>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.sourceWarehouse}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.destWarehouse}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.description}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(row.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{row.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>Tổng số: <strong>{transfers.length}</strong> chứng từ</div>
          <div>Tổng giá trị điều chuyển: <strong style={{ color: "#00a862" }}>{formatVND(transfers.reduce((s, r) => s + r.amount, 0))} đ</strong></div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 6. TAB: LỆNH SẢN XUẤT (MATCHING SCREENSHOT 1)
  // =========================================================================
  if (tab === "production-orders") {
    if (productionOrderViewMode === "landing") {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff", padding: "40px 20px", boxSizing: "border-box" }}>
          {/* Illustration: Conveyor belt, components turning into boxed finished products */}
          <div style={{ marginBottom: 16 }}>
            <svg width="260" height="170" viewBox="0 0 260 170" fill="none">
              <ellipse cx="130" cy="148" rx="100" ry="14" fill="#f1f5f9" />
              {/* Raw material input */}
              <circle cx="50" cy="80" r="16" fill="#e6f4ea" stroke="#00a862" strokeWidth="1.5" />
              <path d="M44 80 L48 84 L57 75" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M68 80 H88" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />
              {/* Conveyor belt with rollers */}
              <rect x="90" y="70" width="70" height="24" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
              <circle cx="102" cy="82" r="5" fill="#94a3b8" />
              <circle cx="125" cy="82" r="5" fill="#94a3b8" />
              <circle cx="148" cy="82" r="5" fill="#94a3b8" />
              {/* Small raw cubes on conveyor */}
              <rect x="94" y="52" width="16" height="16" rx="2" fill="#00a862" />
              <rect x="114" y="52" width="16" height="16" rx="2" fill="#10b981" />
              <rect x="134" y="50" width="18" height="18" rx="3" fill="#059669" />
              {/* Arrow from conveyor to packaged finished product */}
              <path d="M162 82 H178 M174 78 L178 82 L174 86" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Packaged finished box */}
              <rect x="184" y="60" width="34" height="34" rx="4" fill="#00a862" />
              <path d="M184 72 H218 M201 60 V94" stroke="#ffffff" strokeWidth="1.5" />
              <circle cx="212" cy="66" r="6" fill="#ffffff" />
              <path d="M212 63 V69 M209 66 H215" stroke="#00a862" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>

          <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center", maxWidth: 680, lineHeight: 1.5 }}>
            Lệnh sản xuất dùng để xác định số lượng thành phẩm cần sản xuất, định mức nguyên vật liệu để sản xuất một thành phẩm
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setShowProductionOrderModal(true);
                notify("AVA Kế toán đã phân tích kế hoạch và định mức nguyên vật liệu sản xuất!");
              }}
              style={{
                height: 36,
                padding: "0 18px",
                background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
              }}
            >
              <span>Thêm bằng AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowProductionOrderModal(true)}
              style={{
                height: 36,
                padding: "0 22px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
              }}
            >
              Thêm
            </button>

            <button
              type="button"
              onClick={() => notify("Đang tải biểu mẫu Excel Lệnh sản xuất...")}
              style={{
                height: 36,
                padding: "0 18px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>
          </div>

          <button
            type="button"
            onClick={() => setProductionOrderViewMode("list")}
            style={{
              marginTop: 48,
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

          {renderModals()}
        </div>
      );
    }

    // List view
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowProductionOrderModal(true)}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm lệnh SX</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Đang chuẩn bị nhập Excel Lệnh sản xuất...")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
            >
              Nhập từ Excel
            </button>
            <button
              type="button"
              onClick={() => setProductionOrderViewMode("landing")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#64748b", cursor: "pointer" }}
            >
              Quay lại quy trình
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm lệnh sản xuất..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách lệnh sản xuất")}
              title="Làm mới"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số lệnh SX</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày lập</th>
                <th style={{ padding: "8px 10px" }}>Thành phẩm cần sản xuất</th>
                <th style={{ width: 90, padding: "8px 10px", textAlign: "right" }}>Số lượng</th>
                <th style={{ width: 70, padding: "8px 10px", textAlign: "center" }}>ĐVT</th>
                <th style={{ width: 180, padding: "8px 10px" }}>Phân xưởng / Đơn vị</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Hạn hoàn thành</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {productionOrders
                .filter((r) => !searchQuery || r.code.toLowerCase().includes(searchQuery.toLowerCase()) || r.productName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => setShowProductionOrderModal(true)}>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.productName}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{row.qty}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.unit}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.dept}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{row.dueDate}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{
                        background: row.status === "Hoàn thành" ? "#dcfce7" : "#fef9c3",
                        color: row.status === "Hoàn thành" ? "#15803d" : "#854d0e",
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>Tổng số: <strong>{productionOrders.length}</strong> lệnh sản xuất</div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 7. TAB: LẮP RÁP, THÁO DỠ (MATCHING SCREENSHOT 2)
  // =========================================================================
  if (tab === "assembly") {
    if (assemblyViewMode === "landing") {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff", padding: "40px 20px", boxSizing: "border-box" }}>
          {/* Illustration: Modular parts assembly and disassembly */}
          <div style={{ marginBottom: 16 }}>
            <svg width="260" height="170" viewBox="0 0 260 170" fill="none">
              <ellipse cx="130" cy="148" rx="100" ry="14" fill="#f1f5f9" />
              {/* Left components */}
              <rect x="52" y="48" width="22" height="22" rx="3" fill="#10b981" />
              <rect x="52" y="78" width="22" height="22" rx="3" fill="#00a862" />
              <rect x="52" y="108" width="22" height="22" rx="3" fill="#059669" />
              {/* Merging arrows */}
              <path d="M82 59 L108 78" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />
              <path d="M82 89 H108" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />
              <path d="M82 119 L108 100" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />
              {/* Central Assemble Icon */}
              <circle cx="128" cy="89" r="22" fill="#e6f4ea" stroke="#00a862" strokeWidth="2" />
              <path d="M120 89 H136 M128 81 V97" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
              {/* Arrow to assembled product */}
              <path d="M156 89 H176 M172 85 L176 89 L172 93" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Assembled Product Box */}
              <rect x="184" y="66" width="46" height="46" rx="6" fill="#00a862" />
              <path d="M184 82 H230 M207 66 V112" stroke="#ffffff" strokeWidth="1.5" />
            </svg>
          </div>

          <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center", maxWidth: 740, lineHeight: 1.5 }}>
            Lệnh lắp ráp/tháo dỡ ghi nhận nghiệp vụ lắp ráp các vật tư hàng hóa thành một thành phẩm hoặc tháo dỡ một mặt hàng thành các thành phẩm khác nhau
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setShowAssemblyModal(true);
                notify("AVA Kế toán đã phân tích cấu trúc linh kiện thành phẩm!");
              }}
              style={{
                height: 36,
                padding: "0 18px",
                background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
              }}
            >
              <span>Thêm bằng AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAssemblyModal(true)}
              style={{
                height: 36,
                padding: "0 20px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
              }}
            >
              Thêm lệnh lắp ráp
            </button>

            <button
              type="button"
              onClick={() => setShowDisassemblyModal(true)}
              style={{
                height: 36,
                padding: "0 20px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
              }}
            >
              Thêm lệnh tháo dỡ
            </button>

            <button
              type="button"
              onClick={() => notify("Đang tải mẫu Excel lắp ráp / tháo dỡ...")}
              style={{
                height: 36,
                padding: "0 18px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAssemblyViewMode("list")}
            style={{
              marginTop: 48,
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

          {renderModals()}
        </div>
      );
    }

    // List view
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowAssemblyModal(true)}
              style={{ height: 32, padding: "0 14px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} />
              <span>Thêm lệnh lắp ráp</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDisassemblyModal(true)}
              style={{ height: 32, padding: "0 14px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} />
              <span>Thêm lệnh tháo dỡ</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Đang tải Excel lắp ráp...")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
            >
              Nhập từ Excel
            </button>
            <button
              type="button"
              onClick={() => setAssemblyViewMode("landing")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#64748b", cursor: "pointer" }}
            >
              Quay lại quy trình
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm lệnh lắp ráp / tháo dỡ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách lệnh lắp ráp")}
              title="Làm mới"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Loại lệnh</th>
                <th style={{ padding: "8px 10px" }}>Mặt hàng</th>
                <th style={{ width: 90, padding: "8px 10px", textAlign: "right" }}>Số lượng</th>
                <th style={{ width: 70, padding: "8px 10px", textAlign: "center" }}>ĐVT</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Tổng giá trị</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {assemblyOrders
                .filter((r) => !searchQuery || r.code.toLowerCase().includes(searchQuery.toLowerCase()) || r.productName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => row.type === "Lắp ráp" ? setShowAssemblyModal(true) : setShowDisassemblyModal(true)}>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{
                        background: row.type === "Lắp ráp" ? "#dcfce7" : "#e0f2fe",
                        color: row.type === "Lắp ráp" ? "#15803d" : "#0369a1",
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600
                      }}>
                        {row.type}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.productName}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{row.qty}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.unit}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(row.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{row.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>Tổng số: <strong>{assemblyOrders.length}</strong> chứng từ</div>
          <div>Tổng giá trị: <strong style={{ color: "#00a862" }}>{formatVND(assemblyOrders.reduce((s, r) => s + r.amount, 0))} đ</strong></div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 8. TAB: KIỂM KÊ (MATCHING SCREENSHOT 3)
  // =========================================================================
  if (tab === "stocktake") {
    if (stocktakeViewMode === "landing") {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff", padding: "40px 20px", boxSizing: "border-box" }}>
          {/* Illustration: Stacks of boxes, clipboard with math operators (+ - x ÷), girl with laptop */}
          <div style={{ marginBottom: 16 }}>
            <svg width="260" height="170" viewBox="0 0 260 170" fill="none">
              <ellipse cx="130" cy="148" rx="100" ry="14" fill="#f1f5f9" />
              {/* Stack of boxes on the left */}
              <rect x="68" y="70" width="24" height="22" rx="3" fill="#10b981" />
              <rect x="94" y="70" width="24" height="22" rx="3" fill="#00a862" />
              <rect x="80" y="46" width="26" height="22" rx="3" fill="#059669" />
              {/* Dotted path to clipboard */}
              <path d="M122 68 H138" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />
              {/* Clipboard with math symbols */}
              <rect x="140" y="36" width="46" height="62" rx="4" fill="#ffffff" stroke="#00a862" strokeWidth="1.5" />
              <circle cx="163" cy="36" r="6" fill="#cbd5e1" />
              <rect x="156" y="32" width="14" height="6" rx="2" fill="#64748b" />
              {/* Math signs on clipboard */}
              <path d="M152 52 H160 M156 48 V56" stroke="#00a862" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M168 52 H176" stroke="#00a862" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M152 70 L160 78 M160 70 L152 78" stroke="#00a862" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M168 74 H176 M172 70 A1 1 0 0 1 172 72 M172 76 A1 1 0 0 1 172 78" stroke="#00a862" strokeWidth="1.8" strokeLinecap="round" />
              {/* Girl with laptop on the right */}
              <circle cx="198" cy="84" r="14" fill="#64748b" />
              <path d="M184 122 C184 105 212 105 212 122 Z" fill="#00a862" />
              <rect x="176" y="108" width="36" height="20" rx="3" fill="#cbd5e1" />
              <path d="M172 130 H216" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
              {/* Plus badge */}
              <circle cx="178" cy="116" r="7" fill="#00a862" />
              <path d="M178 113 V119 M175 116 H181" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "#1e293b", margin: "0 0 24px 0", textAlign: "center", maxWidth: 720, lineHeight: 1.5 }}>
            Thêm biên bản kiểm kê vật tư, hàng hóa để ghi nhận kết quả kiểm kê thực tế và hạch toán xử lý chênh lệch từ việc kiểm kê
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setShowStocktakeModal(true);
                notify("AVA Kế toán đã đồng bộ số liệu sổ sách sẵn sàng đối chiếu kiểm kê!");
              }}
              style={{
                height: 36,
                padding: "0 18px",
                background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
              }}
            >
              <span>Thêm bằng AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowStocktakeModal(true)}
              style={{
                height: 36,
                padding: "0 22px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
              }}
            >
              Thêm
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStocktakeViewMode("list")}
            style={{
              marginTop: 48,
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

          {renderModals()}
        </div>
      );
    }

    // List view
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowStocktakeModal(true)}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Kiểm kê kho</span>
            </button>
            <button
              type="button"
              onClick={() => setStocktakeViewMode("landing")}
              style={{ height: 32, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#64748b", cursor: "pointer" }}
            >
              Quay lại quy trình
            </button>
          </div>
          <button
            type="button"
            onClick={() => notify("Đã làm mới danh sách biên bản kiểm kê")}
            title="Làm mới"
            style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số biên bản</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày kiểm kê</th>
                <th style={{ width: 180, padding: "8px 10px" }}>Kho kiểm kê</th>
                <th style={{ padding: "8px 10px" }}>Mục đích kiểm kê</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Chênh lệch</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {stocktakes.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => setShowStocktakeModal(true)}>
                  <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.warehouse}</td>
                  <td style={{ padding: "8px 10px" }}>{row.purpose}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#16a34a" }}>0 đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{row.status}</span>
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
  // 9. TAB: BÁO CÁO (MATCHING SCREENSHOT 4)
  // =========================================================================
  if (tab === "reports") {
    const toggleStar = (title: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setStarredReports((prev) => ({ ...prev, [title]: !prev[title] }));
      notify(!starredReports[title] ? `Đã thêm '${title}' vào Yêu thích!` : `Đã bỏ '${title}' khỏi Yêu thích.`);
    };

    const toggleSection = (sec: string) => {
      setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc", overflow: "hidden" }}>
        {/* Top Control Bar */}
        <div style={{ padding: "10px 18px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {/* Left: Search input + AI Hint */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 32, width: 260, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 8 }} />
              <input
                type="text"
                placeholder="Tìm theo tên báo cáo"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>

            <div
              onClick={() => notify("AVA Kế toán: Bạn có thể gõ 'Tồn kho theo kho', 'Hàng sắp hết', 'Thẻ kho 152' để tìm tức thì!")}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#7c3aed", fontWeight: 600, cursor: "pointer" }}
            >
              <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
              <span>🤖</span>
            </div>
          </div>

          {/* Right: Language, Hide/Show, Grid icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569" }}>
              <span>Ngôn ngữ báo cáo</span>
              <select
                value={reportLang}
                onChange={(e) => setReportLang(e.target.value)}
                style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, outline: "none" }}
              >
                <option value="Tiếng Việt">Tiếng Việt</option>
                <option value="English">English</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => notify("Đang chuyển đổi hiển thị danh sách báo cáo")}
              style={{ height: 28, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <EyeOff size={14} style={{ color: "#64748b" }} />
              <span>Ẩn/hiện báo cáo</span>
            </button>

            <button
              type="button"
              title="Chế độ hiển thị dạng lưới"
              style={{ width: 28, height: 28, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Report Content Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* SECTION 1: YÊU THÍCH */}
          <div>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Yêu thích</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { title: "Tổng hợp tồn kho" },
                { title: "Số chi tiết vật tư hàng hóa" },
              ].map((rep) => (
                <div
                  key={rep.title}
                  onClick={() => setPreviewReportTitle(rep.title)}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                >
                  <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{rep.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileSpreadsheet size={15} style={{ color: "#64748b" }} />
                    <Star
                      size={16}
                      fill={starredReports[rep.title] ? "#16a34a" : "none"}
                      style={{ color: starredReports[rep.title] ? "#16a34a" : "#cbd5e1", cursor: "pointer" }}
                      onClick={(e) => toggleStar(rep.title, e)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: BÁO CÁO TỔNG HỢP TỒN KHO */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
            <div
              onClick={() => toggleSection("summary")}
              style={{
                padding: "10px 16px",
                background: "#f1f5f9",
                borderBottom: expandedSections.summary ? "1px solid #e2e8f0" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <strong style={{ fontSize: 13, color: "#1e293b" }}>Báo cáo tổng hợp tồn kho</strong>
              {expandedSections.summary ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>

            {expandedSections.summary && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Left Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "Tổng hợp tồn kho",
                    "Tổng hợp tồn kho theo nhiều đơn vị tính",
                    "Tổng hợp tồn kho theo nhóm VTHH",
                  ].map((title) => (
                    <div
                      key={title}
                      onClick={() => setPreviewReportTitle(title)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 4, cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ fontSize: 13, color: "#334155" }}>{title}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                        <Star
                          size={15}
                          fill={starredReports[title] ? "#16a34a" : "none"}
                          style={{ color: starredReports[title] ? "#16a34a" : "#cbd5e1" }}
                          onClick={(e) => toggleStar(title, e)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "Tổng hợp tồn trên nhiều kho (Dạng bảng chéo)",
                    "Tổng hợp nhập xuất tồn trên nhiều kho",
                    "Báo cáo tồn theo chứng từ nhập chưa chuyển kho",
                  ].map((title) => (
                    <div
                      key={title}
                      onClick={() => setPreviewReportTitle(title)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 4, cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ fontSize: 13, color: "#334155" }}>{title}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                        <Star
                          size={15}
                          fill={starredReports[title] ? "#16a34a" : "none"}
                          style={{ color: starredReports[title] ? "#16a34a" : "#cbd5e1" }}
                          onClick={(e) => toggleStar(title, e)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: BÁO CÁO CHI TIẾT KHO */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
            <div
              onClick={() => toggleSection("detail")}
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <strong style={{ fontSize: 13, color: "#1e293b" }}>Báo cáo chi tiết kho</strong>
              {expandedSections.detail ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>
            {expandedSections.detail && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Sổ chi tiết vật tư hàng hóa", "Thẻ kho (Sổ kho)"].map((t) => (
                    <div key={t} onClick={() => setPreviewReportTitle(t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer" }}>
                      <span style={{ fontSize: 13, color: "#334155" }}>{t}</span>
                      <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Bảng kê xuất kho vật tư", "Bảng kê nhập kho theo nhà cung cấp"].map((t) => (
                    <div key={t} onClick={() => setPreviewReportTitle(t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer" }}>
                      <span style={{ fontSize: 13, color: "#334155" }}>{t}</span>
                      <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: BÁO CÁO SẢN XUẤT */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
            <div
              onClick={() => toggleSection("production")}
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <strong style={{ fontSize: 13, color: "#1e293b" }}>Báo cáo sản xuất</strong>
              {expandedSections.production ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>
            {expandedSections.production && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Báo cáo tiến độ sản xuất", "Bảng định mức tiêu hao nguyên vật liệu"].map((t) => (
                    <div key={t} onClick={() => setPreviewReportTitle(t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer" }}>
                      <span style={{ fontSize: 13, color: "#334155" }}>{t}</span>
                      <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Báo cáo tổng hợp lệnh sản xuất", "Báo cáo giá thành phân xưởng"].map((t) => (
                    <div key={t} onClick={() => setPreviewReportTitle(t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer" }}>
                      <span style={{ fontSize: 13, color: "#334155" }}>{t}</span>
                      <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: BÁO CÁO ĐỐI CHIẾU */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
            <div
              onClick={() => toggleSection("reconciliation")}
              style={{
                padding: "10px 16px",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <strong style={{ fontSize: 13, color: "#1e293b" }}>Báo cáo đối chiếu</strong>
              {expandedSections.reconciliation ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
            </div>
            {expandedSections.reconciliation && (
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Báo cáo đối chiếu kho và sổ cái", "Báo cáo đối chiếu giá thành và giá trị nhập kho"].map((t) => (
                    <div key={t} onClick={() => setPreviewReportTitle(t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer" }}>
                      <span style={{ fontSize: 13, color: "#334155" }}>{t}</span>
                      <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Báo cáo đối chiếu xuất kho và giá vốn", "Bảng đối chiếu kiểm kê thực tế và sổ sách"].map((t) => (
                    <div key={t} onClick={() => setPreviewReportTitle(t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer" }}>
                      <span style={{ fontSize: 13, color: "#334155" }}>{t}</span>
                      <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 10. TAB: HÀNG HÓA, DỊCH VỤ (MATCHING SCREENSHOT 5)
  // =========================================================================
  if (tab === "items") {
    const displayedItems = showFullDemoCatalog
      ? [
          ...catalogItems,
          ...SAMPLE_INVENTORY_ITEMS.map((s) => ({
            id: s.code,
            name: s.name,
            code: s.code,
            vatPolicy: "10%",
            type: s.group === "Tủ điện" ? "Thành phẩm" : "Nguyên vật liệu",
            stockQty: s.stock,
            stockValue: s.stock * s.price,
          })),
        ]
      : catalogItems;

    const filteredItems = displayedItems.filter((it) => {
      if (searchQuery && !it.name.toLowerCase().includes(searchQuery.toLowerCase()) && !it.code.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });

    const totalQty = filteredItems.reduce((acc, it) => acc + it.stockQty, 0);
    const totalVal = filteredItems.reduce((acc, it) => acc + it.stockValue, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", overflow: "hidden" }}>
        {/* Top Link: < Lấy lại danh mục */}
        <div style={{ padding: "8px 16px 4px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            onClick={() => {
              setShowFullDemoCatalog(!showFullDemoCatalog);
              notify(showFullDemoCatalog ? "Đã hiển thị theo danh mục mặc định (như ảnh)" : "Đã nạp toàn bộ danh mục hàng hóa mẫu!");
            }}
            style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}
          >
            <ChevronLeft size={15} />
            <span>Lấy lại danh mục</span>
          </div>
        </div>

        {/* Top 2 KPI Filter Cards */}
        {!itemsCardCollapsed && (
          <div style={{ padding: "0 16px 8px 16px", position: "relative" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Card 1: Hàng hóa sắp hết hàng */}
              <div
                onClick={() => notify("Đang lọc: Hàng hóa sắp hết hàng (0 mặt hàng)")}
                style={{
                  background: "#ffffff",
                  border: "1px solid #fed7aa",
                  borderLeft: "4px solid #f97316",
                  borderRadius: 6,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ffedd5", display: "grid", placeItems: "center" }}>
                    <Package size={20} style={{ color: "#ea580c" }} />
                  </div>
                  <div>
                    <span style={{ fontSize: 12.5, color: "#475569", display: "block" }}>Hàng hóa sắp hết hàng</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#ea580c", lineHeight: 1.2 }}>0</span>
                  </div>
                </div>

                {/* Dark tooltip on top: Bấm vào để lọc */}
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    right: 48,
                    background: "#334155",
                    color: "#ffffff",
                    fontSize: 10.5,
                    padding: "2px 8px",
                    borderRadius: 4,
                    pointerEvents: "none",
                  }}
                >
                  Bấm vào để lọc
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#94a3b8" }}>
                  <Clock size={13} />
                  <span>11:57</span>
                </div>
              </div>

              {/* Card 2: Hàng hóa hết hàng */}
              <div
                onClick={() => notify("Đang lọc: Hàng hóa hết hàng (0 mặt hàng)")}
                style={{
                  background: "#ffffff",
                  border: "1px solid #fecaca",
                  borderLeft: "4px solid #ef4444",
                  borderRadius: 6,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fee2e2", display: "grid", placeItems: "center" }}>
                    <Package size={20} style={{ color: "#dc2626" }} />
                  </div>
                  <div>
                    <span style={{ fontSize: 12.5, color: "#475569", display: "block" }}>Hàng hóa hết hàng</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#dc2626", lineHeight: 1.2 }}>0</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#94a3b8" }}>
                  <Clock size={13} />
                  <span>11:57</span>
                </div>
              </div>
            </div>

            {/* Collapse toggle icon in center */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setItemsCardCollapsed(true)}
                title="Thu gọn"
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: 0 }}
              >
                <ChevronUp size={16} />
              </button>
            </div>
          </div>
        )}

        {itemsCardCollapsed && (
          <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
            <button
              type="button"
              onClick={() => setItemsCardCollapsed(false)}
              title="Mở rộng"
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: 0 }}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        )}

        {/* Toolbar below cards */}
        <div style={{ padding: "6px 16px 10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #e2e8f0" }}>
          {/* Left: Rounded search pill */}
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 20, padding: "0 12px", height: 32, width: 220, background: "#ffffff" }}>
            <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
            />
          </div>

          {/* Right Toolbar Icons & Add button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh mục hàng hóa")}
              title="Tải lại"
              style={{ width: 30, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Tùy biến cột hiển thị")}
              title="Tùy biến cột"
              style={{ width: 30, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Quét mã vạch sản phẩm")}
              title="Quét mã vạch"
              style={{ width: 30, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Nhân bản hàng hóa")}
              title="Nhân bản"
              style={{ width: 30, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Cấu hình danh mục")}
              title="Cài đặt"
              style={{ width: 30, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <Settings size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Bộ lọc nâng cao")}
              title="Bộ lọc"
              style={{ width: 30, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <Filter size={14} />
            </button>

            {/* Split Button: Thêm ▾ */}
            <div style={{ display: "inline-flex", borderRadius: 4, overflow: "hidden", boxShadow: "0 1px 3px rgba(0, 168, 98, 0.25)" }}>
              <button
                type="button"
                onClick={() => setShowAddItemModal(true)}
                style={{
                  height: 32,
                  padding: "0 14px",
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
                onClick={() => setShowAddItemModal(true)}
                style={{
                  height: 32,
                  padding: "0 8px",
                  background: "#009657",
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

            {/* More Options Button: ... */}
            <button
              type="button"
              onClick={() => notify("Tiện ích danh mục: Nhập từ Excel, Xuất ra Excel, Gộp mã...")}
              title="Chức năng khác"
              style={{ width: 30, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        {/* Data Table (Exact layout matching Screenshot 5) */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 38, textAlign: "center", padding: "8px 6px" }}>
                  <input
                    type="checkbox"
                    checked={Object.keys(selectedItems).length > 0 && Object.keys(selectedItems).length === filteredItems.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const all: Record<string, boolean> = {};
                        filteredItems.forEach((it) => { all[it.id] = true; });
                        setSelectedItems(all);
                      } else {
                        setSelectedItems({});
                      }
                    }}
                  />
                </th>
                <th style={{ minWidth: 260, padding: "8px 10px", textAlign: "left" }}>Tên</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "left" }}>Mã</th>
                <th style={{ width: 180, padding: "8px 10px", textAlign: "left" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>Giảm thuế theo quy định</span>
                  </div>
                </th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "left" }}>Tính chất</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "right" }}>Số lượng tồn</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Giá trị tồn</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Chức năng</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ textAlign: "center", padding: "8px 6px" }}>
                    <input
                      type="checkbox"
                      checked={!!selectedItems[item.id]}
                      onChange={(e) => {
                        setSelectedItems({ ...selectedItems, [item.id]: e.target.checked });
                      }}
                    />
                  </td>
                  <td style={{ padding: "8px 10px", color: "#1e293b", fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{item.code}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{item.vatPolicy}</span>
                      <FileText size={14} style={{ color: "#00a862" }} />
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{item.type}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#1e293b" }}>
                    {item.stockQty.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#1e293b" }}>
                    {item.stockValue.toLocaleString("vi-VN")}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => setShowAddItemModal(true)}
                      style={{ border: "none", background: "transparent", color: "#0284c7", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}
                    >
                      <span>Sửa</span>
                      <ChevronDown size={13} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Summary Row (Matching Screenshot 5) */}
              <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                <td style={{ padding: "8px 6px" }}></td>
                <td style={{ padding: "8px 10px", color: "#1e293b" }}>Tổng</td>
                <td style={{ padding: "8px 10px" }}></td>
                <td style={{ padding: "8px 10px" }}></td>
                <td style={{ padding: "8px 10px" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#1e293b" }}>
                  {totalQty.toFixed(2).replace(".", ",")}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#1e293b" }}>
                  {totalVal.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "8px 10px" }}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar (Exact match to Screenshot 5) */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>Tổng số: <strong>{filteredItems.length}</strong></div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Số dòng/trang</span>
              <select defaultValue="20" style={{ height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, outline: "none" }}>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button type="button" disabled style={{ border: "none", background: "transparent", color: "#cbd5e1", cursor: "default", padding: "2px 4px" }}>|&lt;</button>
              <button type="button" disabled style={{ border: "none", background: "transparent", color: "#cbd5e1", cursor: "default", padding: "2px 4px" }}>&lt;</button>
              <span style={{ padding: "0 8px", fontWeight: 700, color: "#1e293b" }}>1</span>
              <button type="button" disabled style={{ border: "none", background: "transparent", color: "#cbd5e1", cursor: "default", padding: "2px 4px" }}>&gt;</button>
              <button type="button" disabled style={{ border: "none", background: "transparent", color: "#cbd5e1", cursor: "default", padding: "2px 4px" }}>&gt;|</button>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // FALLBACK
  // =========================================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Quản lý nghiệp vụ Kho</h3>
        <button
          type="button"
          onClick={() => navigateTo("process")}
          style={{ height: 32, padding: "0 14px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Quay lại sơ đồ quy trình
        </button>
      </div>

      <div style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", color: "#64748b" }}>
        <Package size={40} style={{ color: "#94a3b8", marginBottom: 12 }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Phân hệ Kho đã sẵn sàng hoạt động.</span>
      </div>

      {renderModals()}
    </div>
  );

  // =========================================================================
  // HELPER: RENDER MODALS
  // =========================================================================
  function renderModals() {
    return (
      <>
        {/* MODAL 1: PHIẾU NHẬP KHO CHUẨN MISA */}
        {showReceiptModal && (
          <div className="misa-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(3px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
            <div className="misa-purchase-modal-window" style={{ background: "#ffffff", borderRadius: 6, width: "99vw", maxWidth: 1480, height: "96vh", maxHeight: "96vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)", overflow: "hidden", border: "1px solid #cbd5e1" }}>
              
              {/* TOP HEADER BAR */}
              <div style={{ height: 44, background: "#ffffff", borderBottom: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", flexShrink: 0 }}>
                {/* Left: History, Title, Type select, Reference search */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    title="Lịch sử chứng từ"
                    onClick={() => notify("Xem lịch sử chứng từ NK00001")}
                    style={{ width: 28, height: 28, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
                  >
                    <RotateCcw size={15} />
                  </button>

                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                    Phiếu nhập kho {receiptVoucherCode}
                  </h2>

                  {/* Dropdown: Loại nhập kho */}
                  <select
                    value={receiptType}
                    onChange={(e) => {
                      const newType = e.target.value as typeof receiptType;
                      setReceiptType(newType);
                      if (newType === "1. Thành phẩm sản xuất") {
                        setReceiptReason("Nhập kho thành phẩm sản xuất");
                        setReceiptRows((prev) => prev.map((r) => ({ ...r, debitAcc: "155", creditAcc: "154" })));
                      } else if (newType === "2. Hàng bán bị trả lại") {
                        setReceiptReason("Nhập kho từ hàng bán trả lại");
                        setReceiptRows((prev) => prev.map((r) => ({ ...r, debitAcc: "155", creditAcc: "632" })));
                      } else {
                        setReceiptReason("Nhập kho khác");
                        setReceiptRows((prev) => prev.map((r) => ({ ...r, debitAcc: "155", creditAcc: "" })));
                      }
                    }}
                    style={{
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #00a862",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="1. Thành phẩm sản xuất">1. Thành phẩm sản xuất</option>
                    <option value="2. Hàng bán bị trả lại">2. Hàng bán bị trả lại</option>
                    <option value="3. Khác (NVL thừa, HH thuê gia công, ...)">3. Khác (NVL thừa, HH thuê gia công, ...)</option>
                  </select>

                  {/* Search box for reference */}
                  <div style={{ position: "relative", width: 280, display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      value={receiptRefSearch}
                      onChange={(e) => setReceiptRefSearch(e.target.value)}
                      placeholder={
                        receiptType === "1. Thành phẩm sản xuất"
                          ? "Nhập lệnh sản xuất"
                          : receiptType === "2. Hàng bán bị trả lại"
                          ? "Nhập số CT hàng bán trả lại"
                          : "Nhập số phiếu xuất từ chi nhánh khác chuyển đến"
                      }
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 46px 0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#334155",
                        outline: "none",
                      }}
                    />
                    <div style={{ position: "absolute", right: 6, display: "flex", alignItems: "center", gap: 4, color: "#64748b" }}>
                      <Search size={13} style={{ cursor: "pointer" }} />
                      <ChevronDown size={13} style={{ cursor: "pointer" }} />
                    </div>
                  </div>
                </div>

                {/* Right: Help, minimize, settings, close */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => notify("Mở tài liệu hướng dẫn lập phiếu nhập kho")}
                    style={{ height: 28, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 4, background: "#ffffff", color: "#16a34a", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                  >
                    <HelpCircle size={15} style={{ color: "#16a34a" }} />
                    <span>Hướng dẫn sử dụng</span>
                    <ChevronDown size={12} style={{ color: "#64748b" }} />
                  </button>

                  <button type="button" title="Thu nhỏ" style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <Minus size={15} />
                  </button>
                  <button type="button" title="Thiết lập chứng từ" style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <Settings size={15} />
                  </button>
                  <button type="button" title="Đóng" onClick={() => setShowReceiptModal(false)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* FORM HEADER: THÔNG TIN CHỨNG TỪ */}
              <div style={{ background: "#ffffff", padding: "14px 20px 10px 20px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
                  
                  {/* LEFT COLUMN: DYNAMIC FIELDS PER RECEIPT TYPE */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    
                    {/* TYPE 1: THÀNH PHẨM SẢN XUẤT */}
                    {receiptType === "1. Thành phẩm sản xuất" && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Mã người giao hàng</label>
                            <div style={{ display: "flex", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={receiptDeliveryPersonCode}
                                onChange={(e) => setReceiptDeliveryPersonCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm nhanh người giao hàng")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={13} />
                              </button>
                              <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Tên người giao hàng</label>
                            <input
                              type="text"
                              value={receiptDeliveryPersonName}
                              onChange={(e) => setReceiptDeliveryPersonName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Diễn giải</label>
                          <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                            <input
                              type="text"
                              value={receiptReason}
                              onChange={(e) => setReceiptReason(e.target.value)}
                              placeholder="Nhập kho thành phẩm sản xuất"
                              style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                            />
                            <span title="AVA gợi ý diễn giải kế toán thông minh" style={{ display: "inline-flex" }}>
                              <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Kèm theo</span>
                            <input
                              type="text"
                              value={receiptAttachedDocs}
                              onChange={(e) => setReceiptAttachedDocs(e.target.value)}
                              placeholder="Số lượng"
                              style={{ width: 70, height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                            />
                            <span>chứng từ gốc</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Tham chiếu</span>
                            <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* TYPE 2: HÀNG BÁN BỊ TRẢ LẠI */}
                    {receiptType === "2. Hàng bán bị trả lại" && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Mã khách hàng</label>
                            <div style={{ display: "flex", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={receiptCustomerCode}
                                onChange={(e) => setReceiptCustomerCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm nhanh khách hàng")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={13} />
                              </button>
                              <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Tên khách hàng</label>
                            <input
                              type="text"
                              value={receiptCustomerName}
                              onChange={(e) => setReceiptCustomerName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Người giao hàng</label>
                            <input
                              type="text"
                              value={receiptDeliveryPersonName}
                              onChange={(e) => setReceiptDeliveryPersonName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Địa chỉ</label>
                            <input
                              type="text"
                              value={receiptAddress}
                              onChange={(e) => setReceiptAddress(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Nhân viên bán hàng</label>
                            <div style={{ display: "flex", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={receiptSalesPerson}
                                onChange={(e) => setReceiptSalesPerson(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm nhân viên bán hàng")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={13} />
                              </button>
                              <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Diễn giải</label>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                              <input
                                type="text"
                                value={receiptReason || "Nhập kho từ hàng bán trả lại"}
                                onChange={(e) => setReceiptReason(e.target.value)}
                                style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                              />
                              <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Kèm theo</span>
                            <input
                              type="text"
                              value={receiptAttachedDocs}
                              onChange={(e) => setReceiptAttachedDocs(e.target.value)}
                              placeholder="Số lượng"
                              style={{ width: 70, height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                            />
                            <span>chứng từ gốc</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Tham chiếu</span>
                            <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* TYPE 3: KHÁC (NVL THỪA, GIA CÔNG, ...) */}
                    {receiptType === "3. Khác (NVL thừa, HH thuê gia công, ...)" && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Mã đối tượng</label>
                            <div style={{ display: "flex", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={receiptCustomerCode}
                                onChange={(e) => setReceiptCustomerCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm đối tượng mới")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={13} />
                              </button>
                              <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Tên đối tượng</label>
                            <input
                              type="text"
                              value={receiptCustomerName}
                              onChange={(e) => setReceiptCustomerName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Địa chỉ</label>
                          <input
                            type="text"
                            value={receiptAddress}
                            onChange={(e) => setReceiptAddress(e.target.value)}
                            style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Người giao hàng</label>
                            <input
                              type="text"
                              value={receiptDeliveryPersonName}
                              onChange={(e) => setReceiptDeliveryPersonName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Diễn giải</label>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                              <input
                                type="text"
                                value={receiptReason || "Nhập kho khác"}
                                onChange={(e) => setReceiptReason(e.target.value)}
                                style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                              />
                              <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Kèm theo</span>
                            <input
                              type="text"
                              value={receiptAttachedDocs}
                              onChange={(e) => setReceiptAttachedDocs(e.target.value)}
                              placeholder="Số lượng"
                              style={{ width: 70, height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                            />
                            <span>chứng từ gốc</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Tham chiếu</span>
                            <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* RIGHT COLUMN: DATES, VOUCHER NUMBER, TOTAL AMOUNT */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ textAlign: "right", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Tổng tiền</span>
                      <strong style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>
                        {formatVND(receiptRows.reduce((sum, r) => sum + (r.amount || 0), 0))}
                      </strong>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Ngày hạch toán</label>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                        <input
                          type="text"
                          value={receiptPostingDate}
                          onChange={(e) => setReceiptPostingDate(e.target.value)}
                          style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                        />
                        <Calendar size={14} style={{ color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Ngày chứng từ</label>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                        <input
                          type="text"
                          value={receiptVoucherDate}
                          onChange={(e) => setReceiptVoucherDate(e.target.value)}
                          style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                        />
                        <Calendar size={14} style={{ color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Số chứng từ</label>
                      <input
                        type="text"
                        value={receiptVoucherCode}
                        onChange={(e) => setReceiptVoucherCode(e.target.value)}
                        style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* TABS & TABLE CONTROLS BAR */}
              <div style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
                {/* Active tab */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ padding: "8px 16px", borderBottom: "2px solid #00a862", fontWeight: 700, fontSize: 13, color: "#0f172a", cursor: "pointer" }}>
                    Hàng tiền
                  </div>
                </div>

                {/* Right controls per receipt type */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {receiptType === "2. Hàng bán bị trả lại" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                      <span>Đơn giá nhập kho</span>
                      <select
                        value={receiptPriceMethod}
                        onChange={(e) => setReceiptPriceMethod(e.target.value)}
                        style={{ height: 26, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, outline: "none" }}
                      >
                        <option value="Lấy từ đơn giá BQCK">Lấy từ đơn giá BQCK</option>
                        <option value="Lấy từ chứng từ bán hàng">Lấy từ chứng từ bán hàng</option>
                      </select>
                    </div>
                  )}

                  {receiptType === "3. Khác (NVL thừa, HH thuê gia công, ...)" && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={receiptUseBQCKCheck}
                        onChange={(e) => setReceiptUseBQCKCheck(e.target.checked)}
                      />
                      <span>Lấy đơn giá nhập theo đơn giá BQCK</span>
                    </label>
                  )}

                  {/* Button Gợi ý hồ sơ */}
                  <button
                    type="button"
                    onClick={() => notify("AVA Kế toán đang phân tích hồ sơ chứng từ để gợi ý...")}
                    style={{
                      height: 28,
                      padding: "0 12px",
                      borderRadius: 14,
                      background: "linear-gradient(135deg, #eff6ff 0%, #ede9fe 100%)",
                      border: "1px solid #c7d2fe",
                      color: "#4f46e5",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <span>🤖</span>
                    <span>Gợi ý hồ sơ</span>
                  </button>
                </div>
              </div>

              {/* TABLE AREA */}
              <div style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                      <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 140, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Pin size={12} style={{ color: "#64748b" }} />
                          <span>Mã hàng</span>
                        </div>
                      </th>
                      <th style={{ minWidth: 200, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên hàng</th>
                      <th style={{ width: 120, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Kho</th>
                      {receiptShowAccounts && (
                        <>
                          <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                          <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                        </>
                      )}
                      <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                      <th style={{ width: 90, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                      <th style={{ width: 110, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đơn giá</th>
                      <th style={{ width: 120, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Thành tiền</th>
                      {receiptType === "1. Thành phẩm sản xuất" && (
                        <>
                          <th style={{ width: 120, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lệnh sản xuất</th>
                          <th style={{ width: 120, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đối tượng THCP</th>
                        </>
                      )}
                      <th style={{ width: 36, padding: "8px 4px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.itemCode}
                            placeholder="Chọn hoặc nhập mã"
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                              setReceiptRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        itemCode: val,
                                        itemName: matched ? matched.name : r.itemName,
                                        unit: matched ? matched.unit : r.unit,
                                        warehouse: matched ? "Kho Thành phẩm" : r.warehouse,
                                        price: matched ? matched.price : r.price,
                                        amount: matched ? r.qty * matched.price : r.amount,
                                      }
                                    : r
                                )
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.itemName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, itemName: val } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.warehouse}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, warehouse: val } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, background: "transparent", outline: "none" }}
                          >
                            <option value="">-- Kho --</option>
                            {SAMPLE_WAREHOUSES.map((w) => (
                              <option key={w.code} value={w.name}>{w.name}</option>
                            ))}
                          </select>
                        </td>
                        {receiptShowAccounts && (
                          <>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.debitAcc}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, debitAcc: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.creditAcc}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, creditAcc: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                          </>
                        )}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            step="any"
                            value={row.qty}
                            onChange={(e) => {
                              const qty = Number(e.target.value) || 0;
                              setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty, amount: qty * r.price } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            step="any"
                            value={row.price}
                            onChange={(e) => {
                              const price = Number(e.target.value) || 0;
                              setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, price, amount: r.qty * price } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", fontWeight: 600 }}>
                          {formatVND(row.amount)}
                        </td>
                        {receiptType === "1. Thành phẩm sản xuất" && (
                          <>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.prodOrder || ""}
                                placeholder="LSX..."
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, prodOrder: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.costObject || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, costObject: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                          </>
                        )}
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (receiptRows.length > 1) {
                                setReceiptRows((prev) => prev.filter((_, i) => i !== idx));
                              } else {
                                notify("Cần giữ lại ít nhất 1 dòng chứng từ");
                              }
                            }}
                            title="Xóa dòng"
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* SUMMARY ROW */}
                    <tr style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", fontWeight: 700 }}>
                      <td colSpan={receiptShowAccounts ? 6 : 4} style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                        {receiptRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                      </td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                        {formatVND(receiptRows.reduce((sum, r) => sum + (r.amount || 0), 0))}
                      </td>
                      {receiptType === "1. Thành phẩm sản xuất" && <td colSpan={2} style={{ borderRight: "1px solid #e2e8f0" }}></td>}
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TABLE ACTION CONTROLS & PAGINATION */}
              <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                {/* Left table buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = `row-${Date.now()}`;
                      const defaultDebit = "155";
                      const defaultCredit = receiptType === "1. Thành phẩm sản xuất" ? "154" : receiptType === "2. Hàng bán bị trả lại" ? "632" : "";
                      setReceiptRows((prev) => [
                        ...prev,
                        { id: newId, itemCode: "", itemName: "", warehouse: "", debitAcc: defaultDebit, creditAcc: defaultCredit, unit: "", qty: 1, price: 0, amount: 0, prodOrder: "", costObject: "" },
                      ]);
                    }}
                    style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                  >
                    <Plus size={13} />
                    <span>Thêm dòng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReceiptRows([
                        {
                          id: `row-${Date.now()}`,
                          itemCode: "",
                          itemName: "",
                          warehouse: "",
                          debitAcc: "155",
                          creditAcc: receiptType === "1. Thành phẩm sản xuất" ? "154" : receiptType === "2. Hàng bán bị trả lại" ? "632" : "",
                          unit: "",
                          qty: 1,
                          price: 0,
                          amount: 0,
                          prodOrder: "",
                          costObject: "",
                        },
                      ]);
                    }}
                    style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa hết dòng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => notify("Đã thêm dòng ghi chú kế toán")}
                    style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                  >
                    <FileText size={13} />
                    <span>Thêm ghi chú</span>
                  </button>
                </div>

                {/* Right pagination */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#64748b" }}>
                  <span>Tổng số: <strong>{receiptRows.length}</strong></span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Số dòng/trang</span>
                    <select defaultValue="20" style={{ height: 24, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff" }}>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>|&lt;</button>
                    <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&lt;</button>
                    <span style={{ padding: "0 6px", fontWeight: 700, color: "#16a34a" }}>1</span>
                    <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&gt;</button>
                    <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&gt;|</button>
                  </div>
                </div>
              </div>

              {/* ATTACHMENT SECTION */}
              <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "10px 16px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                  <Paperclip size={14} />
                  <strong>Đính kèm</strong>
                  <span style={{ color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                </div>
                <div
                  onClick={() => notify("Đã mở hộp thoại chọn tệp đính kèm")}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#f8fafc",
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={18} style={{ color: "#64748b" }} />
                  <span style={{ fontSize: 12.5, color: "#0284c7" }}>
                    Chọn tệp <span style={{ color: "#64748b" }}>hoặc kéo và thả tệp vào đây</span>
                  </span>
                </div>
              </div>

              {/* BOTTOM FOOTER BAR */}
              <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
                {/* Left: Hiển thị tài khoản toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                  <div
                    onClick={() => setReceiptShowAccounts(!receiptShowAccounts)}
                    style={{
                      width: 32,
                      height: 18,
                      borderRadius: 10,
                      background: receiptShowAccounts ? "#00a862" : "#cbd5e1",
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
                        left: receiptShowAccounts ? 16 : 2,
                        transition: "left 0.2s",
                      }}
                    />
                  </div>
                  <span>Hiển thị tài khoản</span>
                </label>

                {/* Right: Actions Hủy, Cất, Cất và In */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowReceiptModal(false)}
                    style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const totalAmt = receiptRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                      const partnerName = receiptDeliveryPersonName || receiptCustomerName || "Đối tác giao hàng";
                      handleSaveReceipt({
                        code: receiptVoucherCode,
                        date: receiptVoucherDate,
                        warehouse: receiptRows[0]?.warehouse || "Kho Thành phẩm",
                        partner: partnerName,
                        description: receiptReason || `Nhập kho theo chứng từ ${receiptVoucherCode}`,
                        amount: totalAmt,
                      });
                    }}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >
                    Cất
                  </button>

                  <div style={{ display: "flex" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const totalAmt = receiptRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                        const partnerName = receiptDeliveryPersonName || receiptCustomerName || "Đối tác giao hàng";
                        handleSaveReceipt({
                          code: receiptVoucherCode,
                          date: receiptVoucherDate,
                          warehouse: receiptRows[0]?.warehouse || "Kho Thành phẩm",
                          partner: partnerName,
                          description: receiptReason || `Nhập kho theo chứng từ ${receiptVoucherCode}`,
                          amount: totalAmt,
                        });
                        notify(`Đã cất và chuyển sang chế độ in chứng từ ${receiptVoucherCode}`);
                      }}
                      style={{
                        height: 32,
                        padding: "0 18px",
                        border: "none",
                        borderRadius: "4px 0 0 4px",
                        background: "#00a862",
                        color: "#ffffff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Cất và In
                    </button>
                    <button
                      type="button"
                      onClick={() => notify("Mở tùy chọn mẫu in chứng từ")}
                      style={{
                        height: 32,
                        padding: "0 8px",
                        border: "none",
                        borderLeft: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "0 4px 4px 0",
                        background: "#00a862",
                        color: "#ffffff",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
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

        {/* MODAL 2: PHIẾU XUẤT KHO CHUẨN MISA */}
        {showIssueModal && (
          <div className="misa-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(3px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
            <div className="misa-purchase-modal-window" style={{ background: "#ffffff", borderRadius: 6, width: "99vw", maxWidth: 1480, height: "96vh", maxHeight: "96vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)", overflow: "hidden", border: "1px solid #cbd5e1" }}>
              
              {/* TOP HEADER BAR */}
              <div style={{ height: 44, background: "#ffffff", borderBottom: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", flexShrink: 0 }}>
                {/* Left: History, Title, Type select, Reference search */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    title="Lịch sử chứng từ"
                    onClick={() => notify("Xem lịch sử chứng từ XK00001")}
                    style={{ width: 28, height: 28, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
                  >
                    <RotateCcw size={15} />
                  </button>

                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                    Phiếu xuất kho {issueVoucherCode}
                  </h2>

                  {/* Dropdown: Loại xuất kho */}
                  <select
                    value={issueType}
                    onChange={(e) => {
                      const newType = e.target.value as typeof issueType;
                      setIssueType(newType);
                      if (newType === "1. Bán hàng") {
                        setIssueReason("Xuất kho bán hàng");
                        setIssueRows((prev) => prev.map((r) => ({ ...r, debitAcc: "632", creditAcc: "" })));
                      } else if (newType === "2. Sản xuất") {
                        setIssueReason("Xuất kho sản xuất");
                        setIssueRows((prev) => prev.map((r) => ({ ...r, debitAcc: "621", creditAcc: "" })));
                      } else {
                        setIssueReason("Xuất kho khác");
                        setIssueRows((prev) => prev.map((r) => ({ ...r, debitAcc: "", creditAcc: "" })));
                      }
                    }}
                    style={{
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #00a862",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="1. Bán hàng">1. Bán hàng</option>
                    <option value="2. Sản xuất">2. Sản xuất</option>
                    <option value="3. Khác (Xuất sử dụng, góp vốn, ...)">3. Khác (Xuất sử dụng, góp vốn, ...)</option>
                  </select>

                  {/* Search box for reference */}
                  <div style={{ position: "relative", width: 280, display: "flex", alignItems: "center" }}>
                    <div style={{ position: "absolute", left: 6, display: "flex", alignItems: "center", color: "#64748b" }}>
                      <Settings size={13} style={{ cursor: "pointer" }} />
                    </div>
                    <input
                      type="text"
                      value={issueRefSearch}
                      onChange={(e) => setIssueRefSearch(e.target.value)}
                      placeholder={
                        issueType === "1. Bán hàng"
                          ? "Nhập số chứng từ bán hàng"
                          : issueType === "2. Sản xuất"
                          ? "Nhập lệnh sản xuất"
                          : "Nhập số chứng từ mua hàng"
                      }
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 46px 0 26px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#334155",
                        outline: "none",
                      }}
                    />
                    <div style={{ position: "absolute", right: 6, display: "flex", alignItems: "center", gap: 4, color: "#64748b" }}>
                      <Search size={13} style={{ cursor: "pointer" }} />
                      <ChevronDown size={13} style={{ cursor: "pointer" }} />
                    </div>
                  </div>
                </div>

                {/* Right: Help, minimize, settings, close */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => notify("Mở tài liệu hướng dẫn lập phiếu xuất kho")}
                    style={{ height: 28, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 4, background: "#ffffff", color: "#16a34a", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                  >
                    <HelpCircle size={15} style={{ color: "#16a34a" }} />
                    <span>Hướng dẫn sử dụng</span>
                    <ChevronDown size={12} style={{ color: "#64748b" }} />
                  </button>

                  <button type="button" title="Thu nhỏ" style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <Minus size={15} />
                  </button>
                  <button type="button" title="Thiết lập chứng từ" style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <Settings size={15} />
                  </button>
                  <button type="button" title="Đóng" onClick={() => setShowIssueModal(false)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* FORM HEADER: THÔNG TIN CHỨNG TỪ XUẤT KHO */}
              <div style={{ background: "#ffffff", padding: "14px 20px 10px 20px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
                  
                  {/* LEFT COLUMN: DYNAMIC FIELDS PER ISSUE TYPE */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    
                    {/* TYPE 1: BÁN HÀNG */}
                    {issueType === "1. Bán hàng" && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Mã khách hàng</label>
                            <div style={{ display: "flex", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={issueCustomerCode}
                                onChange={(e) => setIssueCustomerCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm nhanh khách hàng")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={13} />
                              </button>
                              <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Tên khách hàng</label>
                            <input
                              type="text"
                              value={issueCustomerName}
                              onChange={(e) => setIssueCustomerName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Người nhận</label>
                            <input
                              type="text"
                              value={issueReceiverName}
                              onChange={(e) => setIssueReceiverName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Địa chỉ</label>
                            <input
                              type="text"
                              value={issueAddress}
                              onChange={(e) => setIssueAddress(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Nhân viên bán hàng</label>
                            <div style={{ display: "flex", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={issueSalesPerson}
                                onChange={(e) => setIssueSalesPerson(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm nhân viên bán hàng")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={13} />
                              </button>
                              <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Lý do xuất</label>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                              <input
                                type="text"
                                value={issueReason || "Xuất kho bán hàng"}
                                onChange={(e) => setIssueReason(e.target.value)}
                                style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                              />
                              <span title="AVA gợi ý lý do xuất kho" style={{ display: "inline-flex" }}>
                                <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Kèm theo</span>
                            <input
                              type="text"
                              value={issueAttachedDocs}
                              onChange={(e) => setIssueAttachedDocs(e.target.value)}
                              placeholder="Số lượng"
                              style={{ width: 70, height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                            />
                            <span>chứng từ gốc</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Tham chiếu</span>
                            <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* TYPE 2: SẢN XUẤT */}
                    {issueType === "2. Sản xuất" && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Mã người nhận</label>
                            <div style={{ display: "flex", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={issueReceiverCode}
                                onChange={(e) => setIssueReceiverCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm nhanh người nhận")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={13} />
                              </button>
                              <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Tên người nhận</label>
                            <input
                              type="text"
                              value={issueReceiverName}
                              onChange={(e) => setIssueReceiverName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Bộ phận</label>
                            <input
                              type="text"
                              value={issueDept}
                              onChange={(e) => setIssueDept(e.target.value)}
                              placeholder="Phân xưởng sản xuất..."
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Lý do xuất</label>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                              <input
                                type="text"
                                value={issueReason || "Xuất kho sản xuất"}
                                onChange={(e) => setIssueReason(e.target.value)}
                                style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                              />
                              <span title="AVA gợi ý lý do xuất kho" style={{ display: "inline-flex" }}>
                                <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Kèm theo</span>
                            <input
                              type="text"
                              value={issueAttachedDocs}
                              onChange={(e) => setIssueAttachedDocs(e.target.value)}
                              placeholder="Số lượng"
                              style={{ width: 70, height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                            />
                            <span>chứng từ gốc</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Tham chiếu</span>
                            <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* TYPE 3: KHÁC (XUẤT SỬ DỤNG, GÓP VỐN, ...) */}
                    {issueType === "3. Khác (Xuất sử dụng, góp vốn, ...)" && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Mã đối tượng</label>
                            <div style={{ display: "flex", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={issueCustomerCode}
                                onChange={(e) => setIssueCustomerCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm đối tượng")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={13} />
                              </button>
                              <button type="button" style={{ width: 20, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Tên đối tượng</label>
                            <input
                              type="text"
                              value={issueCustomerName}
                              onChange={(e) => setIssueCustomerName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Địa chỉ</label>
                          <input
                            type="text"
                            value={issueAddress}
                            onChange={(e) => setIssueAddress(e.target.value)}
                            style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Người nhận</label>
                            <input
                              type="text"
                              value={issueReceiverName}
                              onChange={(e) => setIssueReceiverName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Lý do xuất</label>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                              <input
                                type="text"
                                value={issueReason || "Xuất kho khác"}
                                onChange={(e) => setIssueReason(e.target.value)}
                                style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                              />
                              <span title="AVA gợi ý lý do xuất kho" style={{ display: "inline-flex" }}>
                                <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Kèm theo</span>
                            <input
                              type="text"
                              value={issueAttachedDocs}
                              onChange={(e) => setIssueAttachedDocs(e.target.value)}
                              placeholder="Số lượng"
                              style={{ width: 70, height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                            />
                            <span>chứng từ gốc</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Tham chiếu</span>
                            <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* RIGHT COLUMN: DATES, VOUCHER NUMBER, TOTAL AMOUNT */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ textAlign: "right", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Tổng tiền</span>
                      <strong style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>
                        {formatVND(issueRows.reduce((sum, r) => sum + (r.amount || 0), 0))}
                      </strong>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Ngày hạch toán</label>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                        <input
                          type="text"
                          value={issuePostingDate}
                          onChange={(e) => setIssuePostingDate(e.target.value)}
                          style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                        />
                        <Calendar size={14} style={{ color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Ngày chứng từ</label>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                        <input
                          type="text"
                          value={issueVoucherDate}
                          onChange={(e) => setIssueVoucherDate(e.target.value)}
                          style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                        />
                        <Calendar size={14} style={{ color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Số chứng từ</label>
                      <input
                        type="text"
                        value={issueVoucherCode}
                        onChange={(e) => setIssueVoucherCode(e.target.value)}
                        style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* TABS & TABLE CONTROLS BAR */}
              <div style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
                {/* Active tab */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ padding: "8px 16px", borderBottom: "2px solid #00a862", fontWeight: 700, fontSize: 13, color: "#0f172a", cursor: "pointer" }}>
                    Hàng tiền
                  </div>
                </div>

                {/* Right controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Button Gợi ý hồ sơ */}
                  <button
                    type="button"
                    onClick={() => notify("AVA Kế toán đang phân tích gợi ý hồ sơ xuất kho...")}
                    style={{
                      height: 28,
                      padding: "0 12px",
                      borderRadius: 14,
                      background: "linear-gradient(135deg, #eff6ff 0%, #ede9fe 100%)",
                      border: "1px solid #c7d2fe",
                      color: "#4f46e5",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <span>🤖</span>
                    <span>Gợi ý hồ sơ</span>
                  </button>
                </div>
              </div>

              {/* TABLE AREA */}
              <div style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                      <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 140, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Pin size={12} style={{ color: "#64748b" }} />
                          <span>Mã hàng</span>
                        </div>
                      </th>
                      <th style={{ minWidth: 200, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên hàng</th>
                      <th style={{ width: 120, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Kho</th>
                      {issueShowAccounts && (
                        <>
                          <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                          <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                        </>
                      )}
                      <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                      <th style={{ width: 90, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                      <th style={{ width: 110, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          <span>Đơn giá</span>
                          <HelpCircle size={12} style={{ color: "#16a34a" }} />
                        </div>
                      </th>
                      <th style={{ width: 120, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          <span>Thành tiền</span>
                          <HelpCircle size={12} style={{ color: "#16a34a" }} />
                        </div>
                      </th>
                      {issueType === "2. Sản xuất" && (
                        <>
                          <th style={{ width: 120, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lệnh sản xuất</th>
                          <th style={{ width: 120, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Thành phẩm</th>
                        </>
                      )}
                      <th style={{ width: 36, padding: "8px 4px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.itemCode}
                            placeholder="Chọn hoặc nhập mã"
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                              setIssueRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        itemCode: val,
                                        itemName: matched ? matched.name : r.itemName,
                                        unit: matched ? matched.unit : r.unit,
                                        warehouse: matched ? "Kho tổng Minh An" : r.warehouse,
                                        price: matched ? matched.price : r.price,
                                        amount: matched ? r.qty * matched.price : r.amount,
                                      }
                                    : r
                                )
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.itemName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, itemName: val } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.warehouse}
                            onChange={(e) => {
                              const val = e.target.value;
                              setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, warehouse: val } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, background: "transparent", outline: "none" }}
                          >
                            <option value="">-- Kho --</option>
                            {SAMPLE_WAREHOUSES.map((w) => (
                              <option key={w.code} value={w.name}>{w.name}</option>
                            ))}
                          </select>
                        </td>
                        {issueShowAccounts && (
                          <>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.debitAcc}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, debitAcc: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.creditAcc}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, creditAcc: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                          </>
                        )}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => {
                              const val = e.target.value;
                              setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            step="any"
                            value={row.qty}
                            onChange={(e) => {
                              const qty = Number(e.target.value) || 0;
                              setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty, amount: qty * r.price } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            step="any"
                            value={row.price}
                            onChange={(e) => {
                              const price = Number(e.target.value) || 0;
                              setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, price, amount: r.qty * price } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", fontWeight: 600 }}>
                          {formatVND(row.amount)}
                        </td>
                        {issueType === "2. Sản xuất" && (
                          <>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.prodOrder || ""}
                                placeholder="LSX..."
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, prodOrder: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.product || ""}
                                placeholder="Thành phẩm..."
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, product: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                          </>
                        )}
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (issueRows.length > 1) {
                                setIssueRows((prev) => prev.filter((_, i) => i !== idx));
                              } else {
                                notify("Cần giữ lại ít nhất 1 dòng chứng từ");
                              }
                            }}
                            title="Xóa dòng"
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* SUMMARY ROW */}
                    <tr style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", fontWeight: 700 }}>
                      <td colSpan={issueShowAccounts ? 6 : 4} style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                        {issueRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                      </td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                        {formatVND(issueRows.reduce((sum, r) => sum + (r.amount || 0), 0))}
                      </td>
                      {issueType === "2. Sản xuất" && <td colSpan={2} style={{ borderRight: "1px solid #e2e8f0" }}></td>}
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TABLE ACTION CONTROLS & PAGINATION */}
              <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "8px 16px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {/* Left table buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `row-${Date.now()}`;
                        const defaultDebit = issueType === "1. Bán hàng" ? "632" : issueType === "2. Sản xuất" ? "621" : "";
                        const defaultCredit = "";
                        setIssueRows((prev) => [
                          ...prev,
                          { id: newId, itemCode: "", itemName: "", warehouse: "", debitAcc: defaultDebit, creditAcc: defaultCredit, unit: "", qty: 1, price: 0, amount: 0, prodOrder: "", product: "" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIssueRows([
                          {
                            id: `row-${Date.now()}`,
                            itemCode: "",
                            itemName: "",
                            warehouse: "",
                            debitAcc: issueType === "1. Bán hàng" ? "632" : issueType === "2. Sản xuất" ? "621" : "",
                            creditAcc: "",
                            unit: "",
                            qty: 1,
                            price: 0,
                            amount: 0,
                            prodOrder: "",
                            product: "",
                          },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => notify("Đã thêm dòng ghi chú kế toán")}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <FileText size={13} />
                      <span>Thêm ghi chú</span>
                    </button>
                  </div>

                  {/* Right pagination */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#64748b" }}>
                    <span>Tổng số: <strong>{issueRows.length}</strong></span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Số dòng/trang</span>
                      <select defaultValue="20" style={{ height: 24, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff" }}>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>|&lt;</button>
                      <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&lt;</button>
                      <span style={{ padding: "0 6px", fontWeight: 700, color: "#16a34a" }}>1</span>
                      <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&gt;</button>
                      <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&gt;|</button>
                    </div>
                  </div>
                </div>

                {/* SPECIAL FIELD FOR 1. BÁN HÀNG: ĐỊA ĐIỂM GIAO HÀNG */}
                {issueType === "1. Bán hàng" && (
                  <div style={{ maxWidth: 320, marginTop: 4 }}>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Địa điểm giao hàng</label>
                    <select
                      value={issueDeliveryLocation}
                      onChange={(e) => setIssueDeliveryLocation(e.target.value)}
                      style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", background: "#ffffff" }}
                    >
                      <option value="">-- Chọn địa điểm giao hàng --</option>
                      <option value="Tại kho bên bán">Tại kho bên bán</option>
                      <option value="Giao tại kho khách hàng">Giao tại kho khách hàng</option>
                      <option value="Giao tại công trình">Giao tại chân công trình</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ATTACHMENT SECTION */}
              <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "10px 16px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                  <Paperclip size={14} />
                  <strong>Đính kèm</strong>
                  <span style={{ color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                </div>
                <div
                  onClick={() => notify("Đã mở hộp thoại chọn tệp đính kèm")}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#f8fafc",
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={18} style={{ color: "#64748b" }} />
                  <span style={{ fontSize: 12.5, color: "#0284c7" }}>
                    Chọn tệp <span style={{ color: "#64748b" }}>hoặc kéo và thả tệp vào đây</span>
                  </span>
                </div>
              </div>

              {/* BOTTOM FOOTER BAR */}
              <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
                {/* Left: Hiển thị tài khoản toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                  <div
                    onClick={() => setIssueShowAccounts(!issueShowAccounts)}
                    style={{
                      width: 32,
                      height: 18,
                      borderRadius: 10,
                      background: issueShowAccounts ? "#00a862" : "#cbd5e1",
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
                        left: issueShowAccounts ? 16 : 2,
                        transition: "left 0.2s",
                      }}
                    />
                  </div>
                  <span>Hiển thị tài khoản</span>
                </label>

                {/* Right: Actions Hủy, Cất, Cất và In */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const totalAmt = issueRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                      const partnerName = issueReceiverName || issueCustomerName || "Khách hàng mua hàng";
                      handleSaveIssue({
                        code: issueVoucherCode,
                        date: issueVoucherDate,
                        warehouse: issueRows[0]?.warehouse || "Kho tổng Minh An",
                        partner: partnerName,
                        description: issueReason || `Xuất kho theo chứng từ ${issueVoucherCode}`,
                        amount: totalAmt,
                      });
                    }}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >
                    Cất
                  </button>

                  <div style={{ display: "flex" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const totalAmt = issueRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                        const partnerName = issueReceiverName || issueCustomerName || "Khách hàng mua hàng";
                        handleSaveIssue({
                          code: issueVoucherCode,
                          date: issueVoucherDate,
                          warehouse: issueRows[0]?.warehouse || "Kho tổng Minh An",
                          partner: partnerName,
                          description: issueReason || `Xuất kho theo chứng từ ${issueVoucherCode}`,
                          amount: totalAmt,
                        });
                        notify(`Đã cất và chuyển sang chế độ in chứng từ ${issueVoucherCode}`);
                      }}
                      style={{
                        height: 32,
                        padding: "0 18px",
                        border: "none",
                        borderRadius: "4px 0 0 4px",
                        background: "#00a862",
                        color: "#ffffff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Cất và In
                    </button>
                    <button
                      type="button"
                      onClick={() => notify("Mở tùy chọn mẫu in chứng từ")}
                      style={{
                        height: 32,
                        padding: "0 8px",
                        border: "none",
                        borderLeft: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "0 4px 4px 0",
                        background: "#00a862",
                        color: "#ffffff",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
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

        {/* MODAL 3: PHIẾU CHUYỂN KHO CHUẨN MISA */}
        {showTransferModal && (
          <div className="misa-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(3px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
            <div className="misa-purchase-modal-window" style={{ background: "#ffffff", borderRadius: 6, width: "99vw", maxWidth: 1480, height: "96vh", maxHeight: "96vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)", overflow: "hidden", border: "1px solid #cbd5e1" }}>
              
              {/* TOP HEADER BAR */}
              <div style={{ height: 44, background: "#ffffff", borderBottom: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", flexShrink: 0 }}>
                {/* Left: History, Title, Reference search */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    title="Lịch sử chứng từ"
                    onClick={() => notify("Xem lịch sử chứng từ Chuyển kho")}
                    style={{ width: 28, height: 28, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}
                  >
                    <RotateCcw size={15} />
                  </button>

                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                    {transferType === "Xuất chuyển kho nội bộ" ? `Chuyển kho ${transferVoucherCode || "CK00001"}` : "Chuyển kho"}
                  </h2>

                  {/* Search box for order reference */}
                  <div style={{ position: "relative", width: 260, display: "flex", alignItems: "center", marginLeft: 8 }}>
                    <div style={{ position: "absolute", left: 6, display: "flex", alignItems: "center", color: "#64748b" }}>
                      <Settings size={13} style={{ cursor: "pointer" }} />
                    </div>
                    <input
                      type="text"
                      value={transferRefSearch}
                      onChange={(e) => setTransferRefSearch(e.target.value)}
                      placeholder="Nhập số đơn đặt hàng"
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 46px 0 26px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#334155",
                        outline: "none",
                      }}
                    />
                    <div style={{ position: "absolute", right: 6, display: "flex", alignItems: "center", gap: 4, color: "#64748b" }}>
                      <Search size={13} style={{ cursor: "pointer" }} />
                      <ChevronDown size={13} style={{ cursor: "pointer" }} />
                    </div>
                  </div>
                </div>

                {/* Right: Help, minimize, settings, close */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => notify("Mở tài liệu hướng dẫn lập phiếu chuyển kho")}
                    style={{ height: 28, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 4, background: "#ffffff", color: "#16a34a", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                  >
                    <HelpCircle size={15} style={{ color: "#16a34a" }} />
                    <span>Hướng dẫn sử dụng</span>
                    <ChevronDown size={12} style={{ color: "#64748b" }} />
                  </button>

                  <button type="button" title="Thu nhỏ" style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <Minus size={15} />
                  </button>
                  <button type="button" title="Thiết lập chứng từ" style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <Settings size={15} />
                  </button>
                  <button type="button" title="Đóng" onClick={() => setShowTransferModal(false)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* RADIO GROUP: 3 LOẠI CHUYỂN KHO CHUẨN MISA */}
              <div style={{ background: "#ffffff", padding: "10px 20px 6px 20px", display: "flex", alignItems: "center", gap: 24, fontSize: 12.5, color: "#1e293b", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
                {(["Xuất kho kiêm vận chuyển nội bộ", "Xuất kho gửi bán đại lý", "Xuất chuyển kho nội bộ"] as const).map((type) => (
                  <label key={type} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="transferType"
                      value={type}
                      checked={transferType === type}
                      onChange={() => {
                        setTransferType(type);
                        if (type === "Xuất chuyển kho nội bộ" && !transferVoucherCode) {
                          setTransferVoucherCode("CK00001");
                        }
                      }}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span style={{ fontWeight: transferType === type ? 600 : 400 }}>{type}</span>
                  </label>
                ))}
              </div>

              {/* FORM HEADER: 3 FORMS DYNAMICALLY MATCHING SCREENSHOTS */}
              <div style={{ background: "#ffffff", padding: "10px 20px 10px 20px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
                  
                  {/* LEFT COLUMN: DYNAMIC BASED ON TRANSFER TYPE */}
                  <div>
                    {/* FORM 1: XUẤT KHO KIÊM VẬN CHUYỂN NỘI BỘ (Image 1) */}
                    {transferType === "Xuất kho kiêm vận chuyển nội bộ" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {/* Row 1: Lệnh điều động số, Ngày, Của */}
                        <div style={{ display: "grid", gridTemplateColumns: "140px 140px 1fr", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Lệnh điều động số</label>
                            <input
                              type="text"
                              value={transferOrderNo}
                              onChange={(e) => setTransferOrderNo(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #00a862", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày</label>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                              <input
                                type="text"
                                value={transferOrderDate}
                                placeholder="DD/MM/YYYY"
                                onChange={(e) => setTransferOrderDate(e.target.value)}
                                style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                              />
                              <Calendar size={13} style={{ color: "#64748b" }} />
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Của</label>
                            <input
                              type="text"
                              value={transferOrderOwner}
                              onChange={(e) => setTransferOrderOwner(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 2: Về việc */}
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Về việc</label>
                          <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 26 }}>
                            <input
                              type="text"
                              value={transferPurpose}
                              onChange={(e) => setTransferPurpose(e.target.value)}
                              style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                            />
                            <span title="AVA gợi ý diễn giải" style={{ display: "inline-flex" }}>
                              <Sparkles size={13} style={{ color: "#a855f7", cursor: "pointer" }} />
                            </span>
                          </div>
                        </div>

                        {/* Row 3: Mã đơn vị nhận, Tên đơn vị nhận, MST đơn vị nhận */}
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Mã đơn vị nhận</label>
                            <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={transferReceiverUnitCode}
                                onChange={(e) => setTransferReceiverUnitCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm đơn vị nhận")} style={{ width: 22, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={12} />
                              </button>
                              <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên đơn vị nhận</label>
                            <input
                              type="text"
                              value={transferReceiverUnitName}
                              onChange={(e) => setTransferReceiverUnitName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>MST đơn vị nhận</label>
                            <input
                              type="text"
                              value={transferReceiverUnitTax}
                              onChange={(e) => setTransferReceiverUnitTax(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 4: Mã người vận chuyển, Tên người vận chuyển, Hợp đồng vận chuyển */}
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Mã người vận chuyển</label>
                            <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={transferTransporterCode}
                                onChange={(e) => setTransferTransporterCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                              />
                              <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên người vận chuyển</label>
                            <input
                              type="text"
                              value={transferTransporterName}
                              onChange={(e) => setTransferTransporterName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Hợp đồng vận chuyển</label>
                            <input
                              type="text"
                              value={transferTransportContract}
                              onChange={(e) => setTransferTransportContract(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 5: Phương tiện vận chuyển, Tên người xuất hàng, Tên người nhận hàng */}
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Phương tiện vận chuyển</label>
                            <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={transferVehicle}
                                placeholder="Ô tô tải..."
                                onChange={(e) => setTransferVehicle(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                              />
                              <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên người xuất hàng</label>
                            <input
                              type="text"
                              value={transferSenderName}
                              onChange={(e) => setTransferSenderName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên người nhận hàng</label>
                            <input
                              type="text"
                              value={transferReceiverName}
                              onChange={(e) => setTransferReceiverName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 6: Tham chiếu */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", marginTop: 2 }}>
                          <span>Tham chiếu</span>
                          <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                        </div>
                      </div>
                    )}

                    {/* FORM 2: XUẤT KHO GỬI BÁN ĐẠI LÝ (Image 2) */}
                    {transferType === "Xuất kho gửi bán đại lý" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {/* Row 1: Hợp đồng kinh tế số, Ngày, Của */}
                        <div style={{ display: "grid", gridTemplateColumns: "140px 140px 1fr", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Hợp đồng kinh tế số</label>
                            <input
                              type="text"
                              value={transferContractNo}
                              onChange={(e) => setTransferContractNo(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày</label>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                              <input
                                type="text"
                                value={transferContractDate}
                                placeholder="DD/MM/YYYY"
                                onChange={(e) => setTransferContractDate(e.target.value)}
                                style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                              />
                              <Calendar size={13} style={{ color: "#64748b" }} />
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Của</label>
                            <input
                              type="text"
                              value={transferContractOwner}
                              onChange={(e) => setTransferContractOwner(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 2: Với đại lý, Tên đại lý, Mã số thuế đại lý */}
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Với đại lý</label>
                            <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={transferAgentCode}
                                onChange={(e) => setTransferAgentCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                              />
                              <button type="button" onClick={() => notify("Thêm đại lý mới")} style={{ width: 22, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Plus size={12} />
                              </button>
                              <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên đại lý</label>
                            <input
                              type="text"
                              value={transferAgentName}
                              onChange={(e) => setTransferAgentName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Mã số thuế đại lý</label>
                            <input
                              type="text"
                              value={transferAgentTax}
                              onChange={(e) => setTransferAgentTax(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 3: Mã người vận chuyển, Tên người vận chuyển, Hợp đồng vận chuyển */}
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Mã người vận chuyển</label>
                            <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={transferTransporterCode}
                                onChange={(e) => setTransferTransporterCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                              />
                              <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên người vận chuyển</label>
                            <input
                              type="text"
                              value={transferTransporterName}
                              onChange={(e) => setTransferTransporterName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Hợp đồng vận chuyển</label>
                            <input
                              type="text"
                              value={transferTransportContract}
                              onChange={(e) => setTransferTransportContract(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 4: Phương tiện vận chuyển, Tên người xuất hàng, Tên người nhận hàng */}
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Phương tiện vận chuyển</label>
                            <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={transferVehicle}
                                placeholder="Ô tô tải..."
                                onChange={(e) => setTransferVehicle(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                              />
                              <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên người xuất hàng</label>
                            <input
                              type="text"
                              value={transferSenderName}
                              onChange={(e) => setTransferSenderName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên người nhận hàng</label>
                            <input
                              type="text"
                              value={transferReceiverName}
                              onChange={(e) => setTransferReceiverName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 5: Diễn giải */}
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Diễn giải</label>
                          <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 26 }}>
                            <input
                              type="text"
                              value={transferExplanation}
                              onChange={(e) => setTransferExplanation(e.target.value)}
                              style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                            />
                            <span title="AVA gợi ý diễn giải" style={{ display: "inline-flex" }}>
                              <Sparkles size={13} style={{ color: "#a855f7", cursor: "pointer" }} />
                            </span>
                          </div>
                        </div>

                        {/* Row 6: Tham chiếu */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", marginTop: 2 }}>
                          <span>Tham chiếu</span>
                          <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                        </div>
                      </div>
                    )}

                    {/* FORM 3: XUẤT CHUYỂN KHO NỘI BỘ (Image 3) */}
                    {transferType === "Xuất chuyển kho nội bộ" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {/* Row 1: Mã người vận chuyển, Tên người vận chuyển */}
                        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Mã người vận chuyển</label>
                            <div style={{ display: "flex", height: 26, border: "1px solid #00a862", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                              <input
                                type="text"
                                value={transferTransporterCode}
                                onChange={(e) => setTransferTransporterCode(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                              />
                              <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <ChevronDown size={11} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tên người vận chuyển</label>
                            <input
                              type="text"
                              value={transferTransporterName}
                              onChange={(e) => setTransferTransporterName(e.target.value)}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>

                        {/* Row 2: Diễn giải */}
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Diễn giải</label>
                          <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 26 }}>
                            <input
                              type="text"
                              value={transferExplanation}
                              onChange={(e) => setTransferExplanation(e.target.value)}
                              style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                            />
                            <span title="AVA gợi ý diễn giải" style={{ display: "inline-flex" }}>
                              <Sparkles size={13} style={{ color: "#a855f7", cursor: "pointer" }} />
                            </span>
                          </div>
                        </div>

                        {/* Row 3: Tham chiếu */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", marginTop: 2 }}>
                          <span>Tham chiếu</span>
                          <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: DATES, MẪU SỐ, KÝ HIỆU, SỐ CHỨNG TỪ */}
                  {transferType === "Xuất chuyển kho nội bộ" ? (
                    /* FORM 3 RIGHT COLUMN: TỔNG TIỀN VỐN, NGÀY HẠCH TOÁN, NGÀY CHỨNG TỪ, SỐ CHỨNG TỪ (Image 3) */
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ textAlign: "right", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Tổng tiền vốn</span>
                        <strong style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>0</strong>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày hạch toán</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                          <input
                            type="text"
                            value={transferPostingDate}
                            onChange={(e) => setTransferPostingDate(e.target.value)}
                            style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                          />
                          <Calendar size={13} style={{ color: "#64748b" }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày chứng từ</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                          <input
                            type="text"
                            value={transferVoucherDate}
                            onChange={(e) => setTransferVoucherDate(e.target.value)}
                            style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                          />
                          <Calendar size={13} style={{ color: "#64748b" }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Số chứng từ</label>
                        <input
                          type="text"
                          value={transferVoucherCode || "CK00001"}
                          onChange={(e) => setTransferVoucherCode(e.target.value)}
                          style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* FORM 1 & FORM 2 RIGHT COLUMN (Images 1 & 2) */
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ textAlign: "right", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Tổng tiền vốn</span>
                        <strong style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>0</strong>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày hạch toán</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                          <input
                            type="text"
                            value={transferPostingDate}
                            onChange={(e) => setTransferPostingDate(e.target.value)}
                            style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                          />
                          <Calendar size={13} style={{ color: "#64748b" }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Mẫu số</label>
                        <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                          <input
                            type="text"
                            value={transferInvoiceForm}
                            placeholder="Mẫu hóa đơn / PXK"
                            onChange={(e) => setTransferInvoiceForm(e.target.value)}
                            style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none" }}
                          />
                          <button type="button" style={{ width: 18, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
                            <ChevronDown size={11} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ký hiệu</label>
                        <input
                          type="text"
                          value={transferInvoiceSymbol}
                          placeholder="1C26TNB"
                          onChange={(e) => setTransferInvoiceSymbol(e.target.value)}
                          style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Số chứng từ</label>
                        <input
                          type="text"
                          value={transferVoucherCode}
                          placeholder="Số phiếu / hóa đơn"
                          onChange={(e) => setTransferVoucherCode(e.target.value)}
                          style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày chứng từ</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                          <input
                            type="text"
                            value={transferVoucherDate}
                            onChange={(e) => setTransferVoucherDate(e.target.value)}
                            style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                          />
                          <Calendar size={13} style={{ color: "#64748b" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* TABS & TABLE CONTROLS BAR */}
              <div style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
                {/* Active tab */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ padding: "8px 16px", borderBottom: "2px solid #00a862", fontWeight: 700, fontSize: 13, color: "#0f172a", cursor: "pointer" }}>
                    Hàng tiền
                  </div>
                </div>

                {/* Right controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button
                    type="button"
                    onClick={() => notify("AVA Kế toán đang kiểm tra hồ sơ chuyển kho...")}
                    style={{
                      height: 28,
                      padding: "0 12px",
                      borderRadius: 14,
                      background: "linear-gradient(135deg, #eff6ff 0%, #ede9fe 100%)",
                      border: "1px solid #c7d2fe",
                      color: "#4f46e5",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <span>🤖</span>
                    <span>Gợi ý hồ sơ</span>
                  </button>
                </div>
              </div>

              {/* TABLE AREA */}
              <div style={{ flex: 1, overflow: "auto", background: "#f8fafc" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                      <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 130, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Pin size={12} style={{ color: "#64748b" }} />
                          <span>Mã hàng</span>
                        </div>
                      </th>
                      <th style={{ minWidth: 180, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên hàng</th>
                      <th style={{ width: 140, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Xuất tại kho</th>
                      {transferType !== "Xuất chuyển kho nội bộ" && (
                        <th style={{ width: 150, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Địa chỉ kho xuất</th>
                      )}
                      <th style={{ width: 140, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Nhập tại kho</th>
                      {transferType !== "Xuất chuyển kho nội bộ" && (
                        <th style={{ width: 150, padding: "8px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Địa chỉ kho nhập</th>
                      )}
                      {transferShowAccounts && (
                        <>
                          <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                          <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                        </>
                      )}
                      <th style={{ width: 70, padding: "8px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                      <th style={{ width: 90, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                      <th style={{ width: 100, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                        {transferType === "Xuất chuyển kho nội bộ" ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                            <span>Đơn giá</span>
                            <HelpCircle size={12} style={{ color: "#00a862" }} />
                          </div>
                        ) : (
                          "Đơn giá bán"
                        )}
                      </th>
                      <th style={{ width: 110, padding: "8px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                        {transferType === "Xuất chuyển kho nội bộ" ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                            <span>Thành tiền</span>
                            <HelpCircle size={12} style={{ color: "#00a862" }} />
                          </div>
                        ) : (
                          "Thành tiền"
                        )}
                      </th>
                      <th style={{ width: 36, padding: "8px 4px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.itemCode}
                            placeholder="Chọn mã hàng"
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                              setTransferRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        itemCode: val,
                                        itemName: matched ? matched.name : r.itemName,
                                        unit: matched ? matched.unit : r.unit,
                                        sourceWarehouse: matched ? "Kho tổng Minh An" : r.sourceWarehouse,
                                        destWarehouse: matched ? "Kho Nguyên vật liệu" : r.destWarehouse,
                                        price: matched ? matched.price || 0 : r.price,
                                        amount: matched ? (matched.price || 0) * r.qty : r.amount,
                                      }
                                    : r
                                )
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.itemName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransferRows((prev) => prev.map((r, i) => (i === idx ? { ...r, itemName: val } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.sourceWarehouse}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matchedWh = SAMPLE_WAREHOUSES.find((w) => w.name === val);
                              setTransferRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, sourceWarehouse: val, sourceWarehouseAddress: matchedWh?.address || "" } : r))
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, background: "transparent", outline: "none" }}
                          >
                            <option value="">-- Kho xuất --</option>
                            {SAMPLE_WAREHOUSES.map((w) => (
                              <option key={w.code} value={w.name}>{w.name}</option>
                            ))}
                          </select>
                        </td>
                        {transferType !== "Xuất chuyển kho nội bộ" && (
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={row.sourceWarehouseAddress}
                              placeholder="Địa chỉ..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setTransferRows((prev) => prev.map((r, i) => (i === idx ? { ...r, sourceWarehouseAddress: val } : r)));
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            />
                          </td>
                        )}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.destWarehouse}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matchedWh = SAMPLE_WAREHOUSES.find((w) => w.name === val);
                              setTransferRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, destWarehouse: val, destWarehouseAddress: matchedWh?.address || "" } : r))
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, background: "transparent", outline: "none" }}
                          >
                            <option value="">-- Kho nhập --</option>
                            {SAMPLE_WAREHOUSES.map((w) => (
                              <option key={w.code} value={w.name}>{w.name}</option>
                            ))}
                          </select>
                        </td>
                        {transferType !== "Xuất chuyển kho nội bộ" && (
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={row.destWarehouseAddress}
                              placeholder="Địa chỉ..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setTransferRows((prev) => prev.map((r, i) => (i === idx ? { ...r, destWarehouseAddress: val } : r)));
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            />
                          </td>
                        )}
                        {transferShowAccounts && (
                          <>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.debitAcc}
                                placeholder="157"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTransferRows((prev) => prev.map((r, i) => (i === idx ? { ...r, debitAcc: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.creditAcc}
                                placeholder="156"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTransferRows((prev) => prev.map((r, i) => (i === idx ? { ...r, creditAcc: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                          </>
                        )}
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransferRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            step="any"
                            value={row.qty}
                            onChange={(e) => {
                              const qty = Number(e.target.value) || 0;
                              setTransferRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty, amount: qty * (r.price || 0) } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            step="any"
                            value={row.price}
                            onChange={(e) => {
                              const price = Number(e.target.value) || 0;
                              setTransferRows((prev) => prev.map((r, i) => (i === idx ? { ...r, price, amount: (r.qty || 0) * price } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: "#1e293b", fontWeight: 500 }}>
                          {row.amount?.toLocaleString("vi-VN") || 0}
                        </td>
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (transferRows.length > 1) {
                                setTransferRows((prev) => prev.filter((_, i) => i !== idx));
                              } else {
                                notify("Cần giữ lại ít nhất 1 dòng chứng từ");
                              }
                            }}
                            title="Xóa dòng"
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* SUMMARY ROW */}
                    <tr style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", fontWeight: 700 }}>
                      <td
                        colSpan={
                          transferType === "Xuất chuyển kho nội bộ"
                            ? (transferShowAccounts ? 7 : 5)
                            : (transferShowAccounts ? 9 : 7)
                        }
                        style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}
                      ></td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                        {transferRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                      </td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                        0,00
                      </td>
                      <td style={{ padding: "8px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                        {transferRows.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString("vi-VN")}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TABLE ACTION CONTROLS & PAGINATION */}
              <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "8px 16px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {/* Left table buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `row-${Date.now()}`;
                        setTransferRows((prev) => [
                          ...prev,
                          {
                            id: newId,
                            itemCode: "",
                            itemName: "",
                            sourceWarehouse: "",
                            sourceWarehouseAddress: "",
                            destWarehouse: "",
                            destWarehouseAddress: "",
                            debitAcc: "157",
                            creditAcc: "",
                            unit: "",
                            qty: 1,
                            price: 0,
                            amount: 0,
                          },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTransferRows([
                          {
                            id: `row-${Date.now()}`,
                            itemCode: "",
                            itemName: "",
                            sourceWarehouse: "",
                            sourceWarehouseAddress: "",
                            destWarehouse: "",
                            destWarehouseAddress: "",
                            debitAcc: "157",
                            creditAcc: "",
                            unit: "",
                            qty: 1,
                            price: 0,
                            amount: 0,
                          },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => notify("Đã thêm dòng ghi chú kế toán")}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <FileText size={13} />
                      <span>Thêm ghi chú</span>
                    </button>
                  </div>

                  {/* Right pagination */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#64748b" }}>
                    <span>Tổng số: <strong>{transferRows.length}</strong></span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Số dòng/trang</span>
                      <select defaultValue="20" style={{ height: 24, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff" }}>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>|&lt;</button>
                      <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&lt;</button>
                      <span style={{ padding: "0 6px", fontWeight: 700, color: "#16a34a" }}>1</span>
                      <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&gt;</button>
                      <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>&gt;|</button>
                    </div>
                  </div>
                </div>

                {/* SPECIAL CHECKBOX: LÀ HÓA ĐƠN THAY THẾ (Chỉ có ở Form 1 & 2) */}
                {transferType !== "Xuất chuyển kho nội bộ" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", cursor: "pointer", marginTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={transferIsReplacementInvoice}
                      onChange={(e) => setTransferIsReplacementInvoice(e.target.checked)}
                    />
                    <span>Là hóa đơn thay thế</span>
                  </label>
                )}
              </div>

              {/* ATTACHMENT SECTION */}
              <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "10px 16px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                  <Paperclip size={14} />
                  <strong>Đính kèm</strong>
                  <span style={{ color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                </div>
                <div
                  onClick={() => notify("Đã mở hộp thoại chọn tệp đính kèm")}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#f8fafc",
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={18} style={{ color: "#64748b" }} />
                  <span style={{ fontSize: 12.5, color: "#0284c7" }}>
                    Chọn tệp <span style={{ color: "#64748b" }}>hoặc kéo và thả tệp vào đây</span>
                  </span>
                </div>
              </div>

              {/* BOTTOM FOOTER BAR */}
              <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
                {/* Left: Hiển thị tài khoản toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                  <div
                    onClick={() => setTransferShowAccounts(!transferShowAccounts)}
                    style={{
                      width: 32,
                      height: 18,
                      borderRadius: 10,
                      background: transferShowAccounts ? "#00a862" : "#cbd5e1",
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
                        left: transferShowAccounts ? 16 : 2,
                        transition: "left 0.2s",
                      }}
                    />
                  </div>
                  <span>Hiển thị tài khoản</span>
                </label>

                {/* Right: Actions Hủy, Cất, Cất và In */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const srcWh = transferRows[0]?.sourceWarehouse || "Kho tổng Minh An";
                      const dstWh = transferRows[0]?.destWarehouse || "Kho Nguyên vật liệu";
                      handleSaveTransfer({
                        code: transferVoucherCode || `CK0000${transfers.length + 1}`,
                        date: transferVoucherDate,
                        sourceWarehouse: srcWh,
                        destWarehouse: dstWh,
                        description: transferPurpose || `Chuyển kho theo lệnh ${transferOrderNo || "ĐĐ01"}`,
                        amount: 0,
                      });
                    }}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >
                    Cất
                  </button>

                  <div style={{ display: "flex" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const srcWh = transferRows[0]?.sourceWarehouse || "Kho tổng Minh An";
                        const dstWh = transferRows[0]?.destWarehouse || "Kho Nguyên vật liệu";
                        const vCode = transferVoucherCode || `CK0000${transfers.length + 1}`;
                        handleSaveTransfer({
                          code: vCode,
                          date: transferVoucherDate,
                          sourceWarehouse: srcWh,
                          destWarehouse: dstWh,
                          description: transferPurpose || `Chuyển kho theo lệnh ${transferOrderNo || "ĐĐ01"}`,
                          amount: 0,
                        });
                        notify(`Đã cất và chuyển sang chế độ in chứng từ chuyển kho ${vCode}`);
                      }}
                      style={{
                        height: 32,
                        padding: "0 18px",
                        border: "none",
                        borderRadius: "4px 0 0 4px",
                        background: "#00a862",
                        color: "#ffffff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Cất và In
                    </button>
                    <button
                      type="button"
                      onClick={() => notify("Mở tùy chọn mẫu in chứng từ")}
                      style={{
                        height: 32,
                        padding: "0 8px",
                        border: "none",
                        borderLeft: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "0 4px 4px 0",
                        background: "#00a862",
                        color: "#ffffff",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
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

        {/* MODAL 4: TÍNH GIÁ XUẤT KHO */}
        {showCalculateCostModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", zIndex: 9999, display: "grid", placeItems: "center" }}>
            <div style={{ background: "#ffffff", borderRadius: 6, width: 560, maxWidth: "95vw", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calculator size={18} style={{ color: "#00a862" }} />
                  <strong style={{ fontSize: 15, color: "#1e293b" }}>Tính giá xuất kho</strong>
                </div>
                <button type="button" onClick={() => setShowCalculateCostModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
              </div>

              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Kỳ tính giá</label>
                  <select defaultValue="2026-09" style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box", background: "#ffffff" }}>
                    <option value="2026-09">Tháng 9/2026 (01/09/2026 - 30/09/2026)</option>
                    <option value="2026-08">Tháng 8/2026 (01/08/2026 - 31/08/2026)</option>
                    <option value="2026-Q3">Quý III/2026</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Phương pháp tính giá</label>
                  <select defaultValue="weighted" style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box", background: "#ffffff" }}>
                    <option value="weighted">Bình quân gia quyền cuối kỳ (Chuẩn mực VAS)</option>
                    <option value="moving">Bình quân gia quyền tức thời</option>
                    <option value="fifo">Nhập trước xuất trước (FIFO)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Phạm vi tính giá</label>
                  <select defaultValue="all" style={{ width: "100%", height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box", background: "#ffffff" }}>
                    <option value="all">Tất cả các kho hàng</option>
                    {SAMPLE_WAREHOUSES.map((w) => (
                      <option key={w.code} value={w.code}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                  <button type="button" onClick={() => setShowCalculateCostModal(false)} style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer" }}>Hủy</button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCalculateCostModal(false);
                      notify("Đã hoàn tất tính giá xuất kho Tháng 9/2026 theo phương pháp Bình quân cuối kỳ!");
                    }}
                    style={{ height: 32, padding: "0 20px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}
                  >
                    Thực hiện tính giá
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 5: BIÊN BẢN KIỂM KÊ KHO */}
        {showStocktakeModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", zIndex: 9999, display: "grid", placeItems: "center" }}>
            <div style={{ background: "#ffffff", borderRadius: 6, width: 860, maxWidth: "96vw", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ClipboardCheck size={18} style={{ color: "#00a862" }} />
                  <strong style={{ fontSize: 15, color: "#1e293b" }}>Biên bản kiểm kê kho KK00001</strong>
                </div>
                <button type="button" onClick={() => setShowStocktakeModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
              </div>

              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Kho kiểm kê</label>
                    <select defaultValue="Kho tổng Minh An" style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box", background: "#ffffff" }}>
                      {SAMPLE_WAREHOUSES.map((w) => (
                        <option key={w.code} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Ngày kiểm kê</label>
                    <input defaultValue="30/09/2026" style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Mục đích</label>
                    <input defaultValue="Kiểm kê định kỳ quý III" style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box" }} />
                  </div>
                </div>

                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>Mã hàng</th>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>Tên vật tư hàng hóa</th>
                        <th style={{ padding: "6px 8px", textAlign: "center" }}>ĐVT</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>SL Sổ sách</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>SL Thực tế</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SAMPLE_INVENTORY_ITEMS.slice(0, 4).map((it) => (
                        <tr key={it.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#0284c7" }}>{it.code}</td>
                          <td style={{ padding: "6px 8px" }}>{it.name}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>{it.unit}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{it.stock}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{it.stock}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "#16a34a" }}>0</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                  <button type="button" onClick={() => setShowStocktakeModal(false)} style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer" }}>Đóng</button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStocktakeModal(false);
                      notify("Đã lưu biên bản kiểm kê kho thành công!");
                    }}
                    style={{ height: 32, padding: "0 20px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}
                  >
                    Lưu biên bản
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 6: DANH SÁCH KHO */}
        {showWarehouseListModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", zIndex: 9999, display: "grid", placeItems: "center" }}>
            <div style={{ background: "#ffffff", borderRadius: 6, width: 680, maxWidth: "95vw", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={18} style={{ color: "#00a862" }} />
                  <strong style={{ fontSize: 15, color: "#1e293b" }}>Danh sách kho hàng</strong>
                </div>
                <button type="button" onClick={() => setShowWarehouseListModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
              </div>

              <div style={{ padding: 18, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ width: 100, padding: "8px 10px" }}>Mã kho</th>
                      <th style={{ width: 200, padding: "8px 10px" }}>Tên kho</th>
                      <th style={{ padding: "8px 10px" }}>Địa chỉ kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_WAREHOUSES.map((w) => (
                      <tr key={w.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{w.code}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 500 }}>{w.name}</td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>{w.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                  <button type="button" onClick={() => setShowWarehouseListModal(false)} style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer" }}>Đóng</button>
                  <button
                    type="button"
                    onClick={() => notify("Đã mở form thêm kho mới")}
                    style={{ height: 32, padding: "0 18px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}
                  >
                    Thêm kho mới
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Lệnh sản xuất LSX00001 (MATCHING USER SCREENSHOT) */}
        {showProductionOrderModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(3px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 6,
                width: "99vw",
                maxWidth: 1480,
                height: "96vh",
                maxHeight: "96vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
                overflow: "hidden",
                border: "1px solid #cbd5e1",
                position: "relative",
              }}
            >
              {/* Collapsible right sidebar trigger */}
              <div
                onClick={() => notify("AVA Kế toán: Trợ lý lệnh sản xuất")}
                title="Mở trợ lý sản xuất"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "45%",
                  width: 14,
                  height: 44,
                  background: "#0284c7",
                  borderRadius: "6px 0 0 6px",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                  cursor: "pointer",
                  zIndex: 10,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ‹
              </div>

              {/* TOP HEADER BAR */}
              <div
                style={{
                  height: 44,
                  background: "#ffffff",
                  borderBottom: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 14px",
                  flexShrink: 0,
                }}
              >
                {/* Left: History, Title, Reference search */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    title="Lịch sử chứng từ"
                    onClick={() => notify("Xem lịch sử chứng từ Lệnh sản xuất")}
                    style={{
                      width: 28,
                      height: 28,
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#f8fafc",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      color: "#64748b",
                    }}
                  >
                    <RotateCcw size={15} />
                  </button>

                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                    Lệnh sản xuất {prodOrderCode}
                  </h2>

                  {/* Search box for order reference */}
                  <div style={{ position: "relative", width: 260, display: "flex", alignItems: "center", marginLeft: 8 }}>
                    <div style={{ position: "absolute", left: 6, display: "flex", alignItems: "center", color: "#64748b" }}>
                      <Settings size={13} style={{ cursor: "pointer" }} />
                    </div>
                    <input
                      type="text"
                      value={prodOrderRefSearch}
                      onChange={(e) => setProdOrderRefSearch(e.target.value)}
                      placeholder="Nhập số đơn đặt hàng"
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 46px 0 26px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#334155",
                        outline: "none",
                      }}
                    />
                    <div style={{ position: "absolute", right: 6, display: "flex", alignItems: "center", gap: 4, color: "#64748b" }}>
                      <Search size={13} style={{ cursor: "pointer" }} />
                      <ChevronDown size={13} style={{ cursor: "pointer" }} />
                    </div>
                  </div>
                </div>

                {/* Right: Settings, Keyboard, Close */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    title="Thiết lập lệnh sản xuất"
                    style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    type="button"
                    title="Phím tắt (F3, Ctrl+S...)"
                    style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <Keyboard size={16} />
                  </button>
                  <button
                    type="button"
                    title="Đóng"
                    onClick={() => setShowProductionOrderModal(false)}
                    style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* FORM HEADER: DIỄN GIẢI & NGÀY/SỐ LỆNH/TÌNH TRẠNG */}
              <div
                style={{
                  background: "#ffffff",
                  padding: "12px 20px 10px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
                  {/* LEFT: Diễn giải & Tham chiếu */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Diễn giải</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <textarea
                          value={prodOrderDescription}
                          onChange={(e) => setProdOrderDescription(e.target.value)}
                          rows={2}
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "6px 30px 6px 8px",
                            fontSize: 12,
                            outline: "none",
                            resize: "none",
                            boxSizing: "border-box",
                            background: "#ffffff",
                            height: 54,
                          }}
                        />
                        <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", alignItems: "center" }}>
                          <span title="AVA gợi ý diễn giải" style={{ display: "inline-flex" }}>
                            <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                      <span>Tham chiếu</span>
                      <span
                        onClick={() => notify("Chọn chứng từ tham chiếu (Đơn đặt hàng, Báo giá...)")}
                        style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}
                      >
                        ...
                      </span>
                    </div>
                  </div>

                  {/* RIGHT: Ngày, Số lệnh, Tình trạng */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày</label>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                        <input
                          type="text"
                          value={prodOrderDate}
                          onChange={(e) => setProdOrderDate(e.target.value)}
                          style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                        />
                        <Calendar size={13} style={{ color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Số lệnh</label>
                      <input
                        type="text"
                        value={prodOrderCode}
                        onChange={(e) => setProdOrderCode(e.target.value)}
                        style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Tình trạng</label>
                      <div style={{ display: "flex", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden", background: "#ffffff" }}>
                        <select
                          value={prodOrderStatus}
                          onChange={(e) => setProdOrderStatus(e.target.value)}
                          style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12, outline: "none", background: "transparent" }}
                        >
                          <option value="Đang thực hiện">Đang thực hiện</option>
                          <option value="Chưa thực hiện">Chưa thực hiện</option>
                          <option value="Hoàn thành">Hoàn thành</option>
                          <option value="Đã hủy">Đã hủy</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DUAL PANELS CONTAINER (Thành phẩm on left, Định mức xuất NVL on right) */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                
                {/* LEFT PANEL: THÀNH PHẨM */}
                <div style={{ flex: 1.15, display: "flex", flexDirection: "column", borderRight: "1px solid #cbd5e1", minWidth: 0, background: "#ffffff" }}>
                  {/* Panel Title */}
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Thành phẩm</span>
                  </div>

                  {/* Table area */}
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                      <thead>
                        <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          <th style={{ width: 34, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 130, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Pin size={12} style={{ color: "#64748b" }} />
                              <span>Mã thành phẩm</span>
                            </div>
                          </th>
                          <th style={{ minWidth: 160, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên thành phẩm</th>
                          <th style={{ width: 55, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                          <th style={{ width: 80, padding: "8px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                          <th style={{ width: 110, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn đặt hàng</th>
                          <th style={{ width: 110, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Hợp đồng bán</th>
                          <th style={{ width: 120, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đối tượng THCP</th>
                          <th style={{ width: 34, padding: "8px 2px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {prodOrderProductRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "6px 2px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.productCode}
                                placeholder="Chọn mã TP"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                                  setProdOrderProductRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            productCode: val,
                                            productName: matched ? matched.name : r.productName,
                                            unit: matched ? matched.unit : r.unit,
                                          }
                                        : r
                                    )
                                  );
                                  // Auto populate standard materials if matched
                                  if (matched && prodOrderMaterialRows.length <= 1 && !prodOrderMaterialRows[0].materialCode) {
                                    setProdOrderMaterialRows([
                                      { id: "nvl-1", materialCode: "VO-ATS-01", materialName: "Vỏ tủ điện sơn tĩnh điện 1200x800x400", unit: "Cái" },
                                      { id: "nvl-2", materialCode: "ATS-400A", materialName: "Bộ chuyển nguồn tự động ATS 400A 3P Chint", unit: "Bộ" },
                                      { id: "nvl-3", materialCode: "DONG-THANH-40", materialName: "Đồng thanh cái mạ thiếc 40x5mm", unit: "Kg" },
                                    ]);
                                  }
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.productName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProdOrderProductRows((prev) => prev.map((r, i) => (i === idx ? { ...r, productName: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 2px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProdOrderProductRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="number"
                                step="any"
                                value={row.qty}
                                onChange={(e) => {
                                  const qty = Number(e.target.value) || 0;
                                  setProdOrderProductRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.salesOrder}
                                placeholder="Đơn hàng"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProdOrderProductRows((prev) => prev.map((r, i) => (i === idx ? { ...r, salesOrder: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.salesContract}
                                placeholder="Hợp đồng"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProdOrderProductRows((prev) => prev.map((r, i) => (i === idx ? { ...r, salesContract: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.costObject}
                                placeholder="Đối tượng THCP"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProdOrderProductRows((prev) => prev.map((r, i) => (i === idx ? { ...r, costObject: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "2px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (prodOrderProductRows.length > 1) {
                                    setProdOrderProductRows((prev) => prev.filter((_, i) => i !== idx));
                                  } else {
                                    notify("Cần giữ lại ít nhất 1 thành phẩm trong lệnh sản xuất");
                                  }
                                }}
                                title="Xóa dòng"
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* SUMMARY ROW */}
                        <tr style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", fontWeight: 700 }}>
                          <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "8px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            {prodOrderProductRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                          </td>
                          <td colSpan={4}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Buttons below left table */}
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setProdOrderProductRows((prev) => [
                          ...prev,
                          { id: `tp-${Date.now()}`, productCode: "", productName: "", unit: "", qty: 1, salesOrder: "", salesContract: "", costObject: "" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProdOrderProductRows([
                          { id: `tp-${Date.now()}`, productCode: "", productName: "", unit: "", qty: 1, salesOrder: "", salesContract: "", costObject: "" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>

                  {/* Attachment section */}
                  <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "10px 14px", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                      <Paperclip size={14} />
                      <strong>Đính kèm</strong>
                      <span style={{ color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                    </div>
                    <div
                      onClick={() => notify("Đã mở hộp thoại chọn tệp đính kèm lệnh sản xuất")}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#f8fafc",
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <Upload size={18} style={{ color: "#64748b" }} />
                      <span style={{ fontSize: 12.5, color: "#0284c7" }}>
                        Chọn tệp <span style={{ color: "#64748b" }}>hoặc kéo và thả tệp vào đây</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL: ĐỊNH MỨC XUẤT NVL */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ffffff", position: "relative" }}>
                  {/* Subtle collapse handle on left of right panel */}
                  <div
                    title="Thu nhỏ/Mở rộng định mức"
                    style={{
                      position: "absolute",
                      left: -8,
                      bottom: 40,
                      width: 8,
                      height: 24,
                      background: "#e2e8f0",
                      border: "1px solid #cbd5e1",
                      borderRadius: "2px 0 0 2px",
                      display: "grid",
                      placeItems: "center",
                      color: "#64748b",
                      fontSize: 10,
                      cursor: "pointer",
                      zIndex: 5,
                    }}
                  >
                    ‹
                  </div>

                  {/* Panel Title */}
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Định mức xuất NVL</span>
                  </div>

                  {/* Table area */}
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                      <thead>
                        <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          <th style={{ width: 34, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 140, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Pin size={12} style={{ color: "#64748b" }} />
                              <span>Mã nguyên vật liệu</span>
                            </div>
                          </th>
                          <th style={{ minWidth: 160, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên nguyên vật liệu</th>
                          <th style={{ width: 60, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                          <th style={{ width: 34, padding: "8px 2px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {prodOrderMaterialRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "6px 2px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.materialCode}
                                placeholder="Chọn mã NVL"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                                  setProdOrderMaterialRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            materialCode: val,
                                            materialName: matched ? matched.name : r.materialName,
                                            unit: matched ? matched.unit : r.unit,
                                          }
                                        : r
                                    )
                                  );
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.materialName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProdOrderMaterialRows((prev) => prev.map((r, i) => (i === idx ? { ...r, materialName: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 2px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProdOrderMaterialRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "2px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (prodOrderMaterialRows.length > 1) {
                                    setProdOrderMaterialRows((prev) => prev.filter((_, i) => i !== idx));
                                  } else {
                                    notify("Cần giữ lại ít nhất 1 nguyên vật liệu");
                                  }
                                }}
                                title="Xóa dòng"
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

                  {/* Buttons below right table */}
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setProdOrderMaterialRows((prev) => [
                          ...prev,
                          { id: `nvl-${Date.now()}`, materialCode: "", materialName: "", unit: "" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProdOrderMaterialRows([
                          { id: `nvl-${Date.now()}`, materialCode: "", materialName: "", unit: "" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BOTTOM FOOTER BAR */}
              <div
                style={{
                  height: 48,
                  background: "#f8fafc",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  flexShrink: 0,
                }}
              >
                {/* Left: F3 - Tìm nhanh */}
                <div style={{ fontSize: 12.5, color: "#475569", fontWeight: 600 }}>
                  F3 - Tìm nhanh
                </div>

                {/* Right: Actions Hủy, Cất, Cất và In */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowProductionOrderModal(false)}
                    style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const pName = prodOrderProductRows[0]?.productName || "Thành phẩm sản xuất theo lệnh";
                      const pQty = prodOrderProductRows.reduce((sum, r) => sum + (r.qty || 0), 0);
                      const pUnit = prodOrderProductRows[0]?.unit || "Bộ";
                      const vCode = prodOrderCode || "LSX00001";
                      setProductionOrders((prev) => [
                        {
                          id: `lsx-${Date.now()}`,
                          code: vCode,
                          date: prodOrderDate,
                          productName: pName,
                          qty: pQty,
                          unit: pUnit,
                          dept: "Phân xưởng Tủ điện số 1",
                          status: prodOrderStatus,
                          dueDate: "08/10/2026",
                        },
                        ...prev,
                      ]);
                      setShowProductionOrderModal(false);
                      notify(`Đã cất thành công Lệnh sản xuất ${vCode}`);
                    }}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >
                    Cất
                  </button>

                  <div style={{ display: "flex" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const pName = prodOrderProductRows[0]?.productName || "Thành phẩm sản xuất theo lệnh";
                        const pQty = prodOrderProductRows.reduce((sum, r) => sum + (r.qty || 0), 0);
                        const pUnit = prodOrderProductRows[0]?.unit || "Bộ";
                        const vCode = prodOrderCode || "LSX00001";
                        setProductionOrders((prev) => [
                          {
                            id: `lsx-${Date.now()}`,
                            code: vCode,
                            date: prodOrderDate,
                            productName: pName,
                            qty: pQty,
                            unit: pUnit,
                            dept: "Phân xưởng Tủ điện số 1",
                            status: prodOrderStatus,
                            dueDate: "08/10/2026",
                          },
                          ...prev,
                        ]);
                        setShowProductionOrderModal(false);
                        notify(`Đã cất và chuyển sang chế độ in Lệnh sản xuất ${vCode}`);
                      }}
                      style={{
                        height: 32,
                        padding: "0 18px",
                        border: "none",
                        borderRadius: "4px 0 0 4px",
                        background: "#00a862",
                        color: "#ffffff",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Cất và In
                    </button>
                    <button
                      type="button"
                      onClick={() => notify("Chọn mẫu in Lệnh sản xuất (Mẫu A4, Mẫu kèm định mức NVL...)")}
                      style={{
                        height: 32,
                        width: 24,
                        border: "none",
                        borderLeft: "1px solid rgba(255, 255, 255, 0.3)",
                        borderRadius: "0 4px 4px 0",
                        background: "#00a862",
                        color: "#ffffff",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
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

        {/* MODAL: Lệnh lắp ráp LRTD00001 (MATCHING USER SCREENSHOT) */}
        {showAssemblyModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(3px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 6,
                width: "99vw",
                maxWidth: 1480,
                height: "96vh",
                maxHeight: "96vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
                overflow: "hidden",
                border: "1px solid #cbd5e1",
                position: "relative",
              }}
            >
              {/* Collapsible right sidebar trigger */}
              <div
                onClick={() => notify("AVA Kế toán: Trợ lý lắp ráp")}
                title="Mở trợ lý lắp ráp"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "45%",
                  width: 14,
                  height: 44,
                  background: "#0284c7",
                  borderRadius: "6px 0 0 6px",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                  cursor: "pointer",
                  zIndex: 10,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ‹
              </div>

              {/* TOP HEADER BAR */}
              <div
                style={{
                  height: 44,
                  background: "#ffffff",
                  borderBottom: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 14px",
                  flexShrink: 0,
                }}
              >
                {/* Title */}
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                  Lệnh lắp ráp {assemblyCode}
                </h2>

                {/* Right: Help, Keyboard, Close */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => notify("Mở hướng dẫn sử dụng Lệnh lắp ráp")}
                    style={{
                      height: 28,
                      padding: "0 10px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#16a34a",
                      fontSize: 12,
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      cursor: "pointer",
                    }}
                  >
                    <HelpCircle size={15} style={{ color: "#16a34a" }} />
                    <span>Hướng dẫn sử dụng</span>
                    <ChevronDown size={12} style={{ color: "#64748b" }} />
                  </button>

                  <button
                    type="button"
                    title="Phím tắt (F3, Ctrl+S...)"
                    style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <Keyboard size={16} />
                  </button>
                  <button
                    type="button"
                    title="Đóng"
                    onClick={() => setShowAssemblyModal(false)}
                    style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* FORM HEADER: DIỄN GIẢI & NGÀY/SỐ/TỔNG TIỀN */}
              <div
                style={{
                  background: "#ffffff",
                  padding: "12px 20px 10px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 120px", gap: 20, alignItems: "start" }}>
                  {/* LEFT: Diễn giải & Tham chiếu */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Diễn giải</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <textarea
                          value={assemblyDescription}
                          onChange={(e) => setAssemblyDescription(e.target.value)}
                          rows={2}
                          style={{
                            width: "100%",
                            border: "1px solid #00a862",
                            borderRadius: 4,
                            padding: "6px 30px 6px 8px",
                            fontSize: 12,
                            outline: "none",
                            resize: "none",
                            boxSizing: "border-box",
                            background: "#ffffff",
                            height: 48,
                          }}
                        />
                        <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", alignItems: "center" }}>
                          <span title="AVA gợi ý diễn giải" style={{ display: "inline-flex" }}>
                            <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                      <span>Tham chiếu</span>
                      <span
                        onClick={() => notify("Chọn chứng từ tham chiếu")}
                        style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}
                      >
                        ...
                      </span>
                    </div>
                  </div>

                  {/* MIDDLE: Ngày & Số */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày</label>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                        <input
                          type="text"
                          value={assemblyDate}
                          onChange={(e) => setAssemblyDate(e.target.value)}
                          style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                        />
                        <Calendar size={13} style={{ color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Số</label>
                      <input
                        type="text"
                        value={assemblyCode}
                        onChange={(e) => setAssemblyCode(e.target.value)}
                        style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* RIGHT: Tổng tiền */}
                  <div style={{ textAlign: "right", paddingTop: 4 }}>
                    <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Tổng tiền</span>
                    <strong style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>
                      {assemblyProductRows.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                </div>
              </div>

              {/* DUAL PANELS CONTAINER (Thành phẩm on left, Linh kiện lắp ráp on right) */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                
                {/* LEFT PANEL: THÀNH PHẨM */}
                <div style={{ flex: 1.15, display: "flex", flexDirection: "column", borderRight: "1px solid #cbd5e1", minWidth: 0, background: "#ffffff" }}>
                  {/* Panel Title */}
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Thành phẩm</span>
                  </div>

                  {/* Table area */}
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                      <thead>
                        <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          <th style={{ width: 34, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 130, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Pin size={12} style={{ color: "#64748b" }} />
                              <span>Mã hàng hóa</span>
                            </div>
                          </th>
                          <th style={{ minWidth: 160, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên hàng hóa</th>
                          <th style={{ width: 60, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                          <th style={{ width: 80, padding: "8px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                          <th style={{ width: 90, padding: "8px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đơn giá</th>
                          <th style={{ width: 90, padding: "8px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Thành tiền</th>
                          <th style={{ width: 34, padding: "8px 2px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {assemblyProductRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "6px 2px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.itemCode}
                                placeholder="Chọn mã hàng"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                                  setAssemblyProductRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            itemCode: val,
                                            itemName: matched ? matched.name : r.itemName,
                                            unit: matched ? matched.unit : r.unit,
                                            price: matched ? matched.price : r.price,
                                            amount: (r.qty || 1) * (matched ? matched.price : r.price),
                                          }
                                        : r
                                    )
                                  );
                                  // Suggest components in right panel
                                  if (matched && (!assemblyComponentRows[0].itemCode || !assemblyComponentRows[1].itemCode)) {
                                    setAssemblyComponentRows([
                                      { id: "lk-1", itemCode: "VO-CS-NT", description: "Vỏ tủ composite ngoài trời 600x400x250", warehouse: "Kho Nguyên vật liệu" },
                                      { id: "lk-2", itemCode: "MCCB-100A", description: "Aptomat khối MCCB 3P 100A Mitsubishi", warehouse: "Kho Nguyên vật liệu" },
                                    ]);
                                  }
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.itemName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAssemblyProductRows((prev) => prev.map((r, i) => (i === idx ? { ...r, itemName: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 2px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAssemblyProductRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="number"
                                step="any"
                                value={row.qty}
                                onChange={(e) => {
                                  const qty = Number(e.target.value) || 0;
                                  setAssemblyProductRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, qty, amount: qty * (r.price || 0) } : r))
                                  );
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="number"
                                step="any"
                                value={row.price}
                                onChange={(e) => {
                                  const price = Number(e.target.value) || 0;
                                  setAssemblyProductRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, price, amount: (r.qty || 0) * price } : r))
                                  );
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                              {row.amount.toLocaleString("vi-VN")}
                            </td>
                            <td style={{ textAlign: "center", padding: "2px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (assemblyProductRows.length > 1) {
                                    setAssemblyProductRows((prev) => prev.filter((_, i) => i !== idx));
                                  } else {
                                    notify("Cần giữ lại ít nhất 1 dòng thành phẩm");
                                  }
                                }}
                                title="Xóa dòng"
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* SUMMARY ROW */}
                        <tr style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", fontWeight: 700 }}>
                          <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "8px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            {assemblyProductRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "8px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            {assemblyProductRows.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString("vi-VN")}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Buttons below left table */}
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAssemblyProductRows((prev) => [
                          ...prev,
                          { id: `tp-${Date.now()}`, itemCode: "", itemName: "", unit: "", qty: 1, price: 0, amount: 0 },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAssemblyProductRows([
                          { id: `tp-${Date.now()}`, itemCode: "", itemName: "", unit: "", qty: 1, price: 0, amount: 0 },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>

                  {/* Attachment section */}
                  <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "10px 14px", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                      <Paperclip size={14} />
                      <strong>Đính kèm</strong>
                      <span style={{ color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                    </div>
                    <div
                      onClick={() => notify("Đã mở hộp thoại chọn tệp đính kèm lệnh lắp ráp")}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#f8fafc",
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <Upload size={18} style={{ color: "#64748b" }} />
                      <span style={{ fontSize: 12.5, color: "#0284c7" }}>
                        Chọn tệp <span style={{ color: "#64748b" }}>hoặc kéo và thả tệp vào đây</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL: LINH KIỆN LẮP RÁP */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ffffff", position: "relative" }}>
                  {/* Subtle collapse handle on left of right panel */}
                  <div
                    title="Thu nhỏ/Mở rộng linh kiện"
                    style={{
                      position: "absolute",
                      left: -8,
                      bottom: 40,
                      width: 8,
                      height: 24,
                      background: "#e2e8f0",
                      border: "1px solid #cbd5e1",
                      borderRadius: "2px 0 0 2px",
                      display: "grid",
                      placeItems: "center",
                      color: "#64748b",
                      fontSize: 10,
                      cursor: "pointer",
                      zIndex: 5,
                    }}
                  >
                    ‹
                  </div>

                  {/* Panel Title */}
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Linh kiện lắp ráp</span>
                  </div>

                  {/* Table area */}
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                      <thead>
                        <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          <th style={{ width: 34, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 140, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Pin size={12} style={{ color: "#64748b" }} />
                              <span>Mã hàng</span>
                            </div>
                          </th>
                          <th style={{ minWidth: 160, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                          <th style={{ width: 120, padding: "8px 4px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Kho</th>
                          <th style={{ width: 34, padding: "8px 2px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {assemblyComponentRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "6px 2px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.itemCode}
                                placeholder="Chọn mã linh kiện"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                                  setAssemblyComponentRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            itemCode: val,
                                            description: matched ? matched.name : r.description,
                                            warehouse: r.warehouse || "Kho Nguyên vật liệu",
                                          }
                                        : r
                                    )
                                  );
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAssemblyComponentRows((prev) => prev.map((r, i) => (i === idx ? { ...r, description: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 2px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.warehouse}
                                placeholder="Kho..."
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAssemblyComponentRows((prev) => prev.map((r, i) => (i === idx ? { ...r, warehouse: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "2px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (assemblyComponentRows.length > 1) {
                                    setAssemblyComponentRows((prev) => prev.filter((_, i) => i !== idx));
                                  } else {
                                    notify("Cần giữ lại ít nhất 1 linh kiện");
                                  }
                                }}
                                title="Xóa dòng"
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

                  {/* Buttons below right table */}
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAssemblyComponentRows((prev) => [
                          ...prev,
                          { id: `lk-${Date.now()}`, itemCode: "", description: "", warehouse: "Kho Nguyên vật liệu" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAssemblyComponentRows([
                          { id: `lk-${Date.now()}`, itemCode: "", description: "", warehouse: "Kho Nguyên vật liệu" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BOTTOM FOOTER BAR */}
              <div
                style={{
                  height: 48,
                  background: "#f8fafc",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0 16px",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAssemblyModal(false)}
                  style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const pName = assemblyProductRows[0]?.itemName || "Thành phẩm lắp ráp";
                    const pQty = assemblyProductRows.reduce((sum, r) => sum + (r.qty || 0), 0);
                    const pUnit = assemblyProductRows[0]?.unit || "Bộ";
                    const pAmount = assemblyProductRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                    const vCode = assemblyCode || "LR00001";
                    setAssemblyOrders((prev) => [
                      {
                        id: `lr-${Date.now()}`,
                        code: vCode,
                        date: assemblyDate,
                        type: "Lắp ráp",
                        productName: pName,
                        qty: pQty,
                        unit: pUnit,
                        amount: pAmount,
                        status: "Đã ghi sổ",
                      },
                      ...prev,
                    ]);
                    setShowAssemblyModal(false);
                    notify(`Đã cất thành công Lệnh lắp ráp ${vCode}`);
                  }}
                  style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  Cất
                </button>

                <div style={{ display: "flex" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const pName = assemblyProductRows[0]?.itemName || "Thành phẩm lắp ráp";
                      const pQty = assemblyProductRows.reduce((sum, r) => sum + (r.qty || 0), 0);
                      const pUnit = assemblyProductRows[0]?.unit || "Bộ";
                      const pAmount = assemblyProductRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                      const vCode = assemblyCode || "LR00001";
                      setAssemblyOrders((prev) => [
                        {
                          id: `lr-${Date.now()}`,
                          code: vCode,
                          date: assemblyDate,
                          type: "Lắp ráp",
                          productName: pName,
                          qty: pQty,
                          unit: pUnit,
                          amount: pAmount,
                          status: "Đã ghi sổ",
                        },
                        ...prev,
                      ]);
                      setShowAssemblyModal(false);
                      notify(`Đã cất và chuyển sang chế độ in Lệnh lắp ráp ${vCode}`);
                    }}
                    style={{
                      height: 32,
                      padding: "0 18px",
                      border: "none",
                      borderRadius: "4px 0 0 4px",
                      background: "#00a862",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Cất và In
                  </button>
                  <button
                    type="button"
                    onClick={() => notify("Chọn mẫu in Lệnh lắp ráp (Mẫu A4, Bảng kê linh kiện...)")}
                    style={{
                      height: 32,
                      width: 24,
                      border: "none",
                      borderLeft: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "0 4px 4px 0",
                      background: "#00a862",
                      color: "#ffffff",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Lệnh tháo dỡ LRTD00001 (MATCHING USER SCREENSHOT) */}
        {showDisassemblyModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(3px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 6,
                width: "99vw",
                maxWidth: 1480,
                height: "96vh",
                maxHeight: "96vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
                overflow: "hidden",
                border: "1px solid #cbd5e1",
                position: "relative",
              }}
            >
              {/* Collapsible right sidebar trigger */}
              <div
                onClick={() => notify("AVA Kế toán: Trợ lý tháo dỡ")}
                title="Mở trợ lý tháo dỡ"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "45%",
                  width: 14,
                  height: 44,
                  background: "#0284c7",
                  borderRadius: "6px 0 0 6px",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                  cursor: "pointer",
                  zIndex: 10,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ‹
              </div>

              {/* TOP HEADER BAR */}
              <div
                style={{
                  height: 44,
                  background: "#ffffff",
                  borderBottom: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 14px",
                  flexShrink: 0,
                }}
              >
                {/* Title */}
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                  Lệnh tháo dỡ {disassemblyCode}
                </h2>

                {/* Right: Help, Keyboard, Close */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => notify("Mở hướng dẫn sử dụng Lệnh tháo dỡ")}
                    style={{
                      height: 28,
                      padding: "0 10px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#16a34a",
                      fontSize: 12,
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      cursor: "pointer",
                    }}
                  >
                    <HelpCircle size={15} style={{ color: "#16a34a" }} />
                    <span>Hướng dẫn sử dụng</span>
                    <ChevronDown size={12} style={{ color: "#64748b" }} />
                  </button>

                  <button
                    type="button"
                    title="Phím tắt (F3, Ctrl+S...)"
                    style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <Keyboard size={16} />
                  </button>
                  <button
                    type="button"
                    title="Đóng"
                    onClick={() => setShowDisassemblyModal(false)}
                    style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* FORM HEADER: DIỄN GIẢI & NGÀY/SỐ/TỶ LỆ/TỔNG TIỀN */}
              <div
                style={{
                  background: "#ffffff",
                  padding: "12px 20px 10px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 120px", gap: 20, alignItems: "start" }}>
                  {/* LEFT: Diễn giải & Tham chiếu */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Diễn giải</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <textarea
                          value={disassemblyDescription}
                          onChange={(e) => setDisassemblyDescription(e.target.value)}
                          rows={2}
                          style={{
                            width: "100%",
                            border: "1px solid #00a862",
                            borderRadius: 4,
                            padding: "6px 30px 6px 8px",
                            fontSize: 12,
                            outline: "none",
                            resize: "none",
                            boxSizing: "border-box",
                            background: "#ffffff",
                            height: 48,
                          }}
                        />
                        <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", alignItems: "center" }}>
                          <span title="AVA gợi ý diễn giải" style={{ display: "inline-flex" }}>
                            <Sparkles size={14} style={{ color: "#a855f7", cursor: "pointer" }} />
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                      <span>Tham chiếu</span>
                      <span
                        onClick={() => notify("Chọn chứng từ tham chiếu")}
                        style={{ color: "#0284c7", cursor: "pointer", fontWeight: 700 }}
                      >
                        ...
                      </span>
                    </div>
                  </div>

                  {/* MIDDLE: Ngày & Số & Checkbox Tự động tính giá */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Ngày</label>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", background: "#ffffff", height: 26 }}>
                        <input
                          type="text"
                          value={disassemblyDate}
                          onChange={(e) => setDisassemblyDate(e.target.value)}
                          style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                        />
                        <Calendar size={13} style={{ color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 2 }}>Số</label>
                      <input
                        type="text"
                        value={disassemblyCode}
                        onChange={(e) => setDisassemblyCode(e.target.value)}
                        style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>

                    {/* SPECIAL CHECKBOX FOR DISASSEMBLY */}
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#334155", cursor: "pointer", marginTop: 2 }}>
                      <input
                        type="checkbox"
                        checked={disassemblyAutoCalcRate}
                        onChange={(e) => setDisassemblyAutoCalcRate(e.target.checked)}
                      />
                      <span>Tự động tính giá nhập thành phẩm tháo dỡ theo tỷ lệ</span>
                      <span title="Hệ thống tự động phân bổ nguyên giá theo tỷ lệ giá thành quy định" style={{ display: "inline-flex", color: "#64748b" }}>
                        <HelpCircle size={12} />
                      </span>
                    </label>
                  </div>

                  {/* RIGHT: Tổng tiền */}
                  <div style={{ textAlign: "right", paddingTop: 4 }}>
                    <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Tổng tiền</span>
                    <strong style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>
                      {disassemblyGoodRows.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString("vi-VN")}
                    </strong>
                  </div>
                </div>
              </div>

              {/* DUAL PANELS CONTAINER (Hàng hóa on left, Thành phẩm tháo dỡ on right) */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                
                {/* LEFT PANEL: HÀNG HÓA */}
                <div style={{ flex: 1.15, display: "flex", flexDirection: "column", borderRight: "1px solid #cbd5e1", minWidth: 0, background: "#ffffff" }}>
                  {/* Panel Title */}
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Hàng hóa</span>
                  </div>

                  {/* Table area */}
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                      <thead>
                        <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          <th style={{ width: 34, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 130, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Pin size={12} style={{ color: "#64748b" }} />
                              <span>Mã hàng hóa</span>
                            </div>
                          </th>
                          <th style={{ minWidth: 160, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên hàng hóa</th>
                          <th style={{ width: 60, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                          <th style={{ width: 80, padding: "8px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
                          <th style={{ width: 90, padding: "8px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Đơn giá</th>
                          <th style={{ width: 90, padding: "8px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Thành tiền</th>
                          <th style={{ width: 34, padding: "8px 2px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {disassemblyGoodRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "6px 2px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.itemCode}
                                placeholder="Chọn mã hàng"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                                  setDisassemblyGoodRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            itemCode: val,
                                            itemName: matched ? matched.name : r.itemName,
                                            unit: matched ? matched.unit : r.unit,
                                            price: matched ? matched.price : r.price,
                                            amount: (r.qty || 1) * (matched ? matched.price : r.price),
                                          }
                                        : r
                                    )
                                  );
                                  // Auto suggest output components
                                  if (matched && (!disassemblyOutputRows[0].itemCode || !disassemblyOutputRows[1].itemCode)) {
                                    setDisassemblyOutputRows([
                                      { id: "tp-1", itemCode: "DYNAMO-150KVA", itemName: "Đầu phát điện Stamford 150kVA cũ còn tốt", unit: "Cái" },
                                      { id: "tp-2", itemCode: "PANNEL-DSE", itemName: "Bảng điều khiển DeepSea DSE7320", unit: "Bộ" },
                                    ]);
                                  }
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.itemName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDisassemblyGoodRows((prev) => prev.map((r, i) => (i === idx ? { ...r, itemName: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 2px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDisassemblyGoodRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="number"
                                step="any"
                                value={row.qty}
                                onChange={(e) => {
                                  const qty = Number(e.target.value) || 0;
                                  setDisassemblyGoodRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, qty, amount: qty * (r.price || 0) } : r))
                                  );
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="number"
                                step="any"
                                value={row.price}
                                onChange={(e) => {
                                  const price = Number(e.target.value) || 0;
                                  setDisassemblyGoodRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, price, amount: (r.qty || 0) * price } : r))
                                  );
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                              {row.amount.toLocaleString("vi-VN")}
                            </td>
                            <td style={{ textAlign: "center", padding: "2px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (disassemblyGoodRows.length > 1) {
                                    setDisassemblyGoodRows((prev) => prev.filter((_, i) => i !== idx));
                                  } else {
                                    notify("Cần giữ lại ít nhất 1 dòng hàng hóa tháo dỡ");
                                  }
                                }}
                                title="Xóa dòng"
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* SUMMARY ROW */}
                        <tr style={{ background: "#ffffff", borderBottom: "1px solid #cbd5e1", fontWeight: 700 }}>
                          <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "8px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            {disassemblyGoodRows.reduce((sum, r) => sum + (r.qty || 0), 0).toFixed(2).replace(".", ",")}
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "8px 6px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            {disassemblyGoodRows.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString("vi-VN")}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Buttons below left table */}
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDisassemblyGoodRows((prev) => [
                          ...prev,
                          { id: `hh-${Date.now()}`, itemCode: "", itemName: "", unit: "", qty: 1, price: 0, amount: 0 },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDisassemblyGoodRows([
                          { id: `hh-${Date.now()}`, itemCode: "", itemName: "", unit: "", qty: 1, price: 0, amount: 0 },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>

                  {/* Attachment section */}
                  <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "10px 14px", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#475569" }}>
                      <Paperclip size={14} />
                      <strong>Đính kèm</strong>
                      <span style={{ color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                    </div>
                    <div
                      onClick={() => notify("Đã mở hộp thoại chọn tệp đính kèm lệnh tháo dỡ")}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#f8fafc",
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <Upload size={18} style={{ color: "#64748b" }} />
                      <span style={{ fontSize: 12.5, color: "#0284c7" }}>
                        Chọn tệp <span style={{ color: "#64748b" }}>hoặc kéo và thả tệp vào đây</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL: THÀNH PHẨM THÁO DỠ */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ffffff", position: "relative" }}>
                  {/* Subtle collapse handle on left of right panel */}
                  <div
                    title="Thu nhỏ/Mở rộng thành phẩm tháo dỡ"
                    style={{
                      position: "absolute",
                      left: -8,
                      bottom: 40,
                      width: 8,
                      height: 24,
                      background: "#e2e8f0",
                      border: "1px solid #cbd5e1",
                      borderRadius: "2px 0 0 2px",
                      display: "grid",
                      placeItems: "center",
                      color: "#64748b",
                      fontSize: 10,
                      cursor: "pointer",
                      zIndex: 5,
                    }}
                  >
                    ‹
                  </div>

                  {/* Panel Title */}
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid #cbd5e1", background: "#ffffff", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Thành phẩm tháo dỡ</span>
                  </div>

                  {/* Table area */}
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                      <thead>
                        <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          <th style={{ width: 34, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 140, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Pin size={12} style={{ color: "#64748b" }} />
                              <span>Mã hàng</span>
                            </div>
                          </th>
                          <th style={{ minWidth: 160, padding: "8px 6px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên hàng</th>
                          <th style={{ width: 80, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ĐVT</th>
                          <th style={{ width: 34, padding: "8px 2px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {disassemblyOutputRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "6px 2px", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.itemCode}
                                placeholder="Chọn mã hàng"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                                  setDisassemblyOutputRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            itemCode: val,
                                            itemName: matched ? matched.name : r.itemName,
                                            unit: matched ? matched.unit : r.unit,
                                          }
                                        : r
                                    )
                                  );
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.itemName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDisassemblyOutputRows((prev) => prev.map((r, i) => (i === idx ? { ...r, itemName: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 2px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDisassemblyOutputRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "2px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (disassemblyOutputRows.length > 1) {
                                    setDisassemblyOutputRows((prev) => prev.filter((_, i) => i !== idx));
                                  } else {
                                    notify("Cần giữ lại ít nhất 1 thành phẩm tháo dỡ");
                                  }
                                }}
                                title="Xóa dòng"
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

                  {/* Buttons below right table */}
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDisassemblyOutputRows((prev) => [
                          ...prev,
                          { id: `tp-${Date.now()}`, itemCode: "", itemName: "", unit: "" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b" }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDisassemblyOutputRows([
                          { id: `tp-${Date.now()}`, itemCode: "", itemName: "", unit: "" },
                        ]);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BOTTOM FOOTER BAR */}
              <div
                style={{
                  height: 48,
                  background: "#f8fafc",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0 16px",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowDisassemblyModal(false)}
                  style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const pName = disassemblyGoodRows[0]?.itemName || "Hàng hóa tháo dỡ";
                    const pQty = disassemblyGoodRows.reduce((sum, r) => sum + (r.qty || 0), 0);
                    const pUnit = disassemblyGoodRows[0]?.unit || "Bộ";
                    const pAmount = disassemblyGoodRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                    const vCode = disassemblyCode || "TD00001";
                    setAssemblyOrders((prev) => [
                      {
                        id: `td-${Date.now()}`,
                        code: vCode,
                        date: disassemblyDate,
                        type: "Tháo dỡ",
                        productName: pName,
                        qty: pQty,
                        unit: pUnit,
                        amount: pAmount,
                        status: "Đã ghi sổ",
                      },
                      ...prev,
                    ]);
                    setShowDisassemblyModal(false);
                    notify(`Đã cất thành công Lệnh tháo dỡ ${vCode}`);
                  }}
                  style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  Cất
                </button>

                <div style={{ display: "flex" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const pName = disassemblyGoodRows[0]?.itemName || "Hàng hóa tháo dỡ";
                      const pQty = disassemblyGoodRows.reduce((sum, r) => sum + (r.qty || 0), 0);
                      const pUnit = disassemblyGoodRows[0]?.unit || "Bộ";
                      const pAmount = disassemblyGoodRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                      const vCode = disassemblyCode || "TD00001";
                      setAssemblyOrders((prev) => [
                        {
                          id: `td-${Date.now()}`,
                          code: vCode,
                          date: disassemblyDate,
                          type: "Tháo dỡ",
                          productName: pName,
                          qty: pQty,
                          unit: pUnit,
                          amount: pAmount,
                          status: "Đã ghi sổ",
                        },
                        ...prev,
                      ]);
                      setShowDisassemblyModal(false);
                      notify(`Đã cất và chuyển sang chế độ in Lệnh tháo dỡ ${vCode}`);
                    }}
                    style={{
                      height: 32,
                      padding: "0 18px",
                      border: "none",
                      borderRadius: "4px 0 0 4px",
                      background: "#00a862",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Cất và In
                  </button>
                  <button
                    type="button"
                    onClick={() => notify("Chọn mẫu in Lệnh tháo dỡ (Mẫu A4, Bảng kê linh kiện thu hồi...)")}
                    style={{
                      height: 32,
                      width: 24,
                      border: "none",
                      borderLeft: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "0 4px 4px 0",
                      background: "#00a862",
                      color: "#ffffff",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Thêm Hàng hóa, dịch vụ */}
        {showAddItemModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#ffffff", borderRadius: 8, width: 760, maxWidth: "95vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
              <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Package size={18} style={{ color: "#00a862" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Thêm Hàng hóa, dịch vụ</h3>
                </div>
                <button type="button" onClick={() => setShowAddItemModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
              </div>
              <div style={{ padding: 20, overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Mã hàng hóa, dịch vụ (*)</label>
                    <input type="text" defaultValue="VTHH001" id="new-item-code" style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Tính chất (*)</label>
                    <select id="new-item-type" defaultValue="Vật tư hàng hóa" style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, background: "#ffffff" }}>
                      <option value="Vật tư hàng hóa">Vật tư hàng hóa</option>
                      <option value="Dịch vụ">Dịch vụ</option>
                      <option value="Thành phẩm">Thành phẩm</option>
                      <option value="Nguyên vật liệu">Nguyên vật liệu</option>
                      <option value="Công cụ dụng cụ">Công cụ dụng cụ</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Tên hàng hóa, dịch vụ (*)</label>
                    <input type="text" defaultValue="Biến dòng đo lường hạ thế MCT 400/5A Emic" id="new-item-name" style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Đơn vị tính chính</label>
                    <input type="text" defaultValue="Quả" id="new-item-unit" style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Giảm thuế theo quy định</label>
                    <select id="new-item-vat" defaultValue="Chưa xác định" style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, background: "#ffffff" }}>
                      <option value="Chưa xác định">Chưa xác định</option>
                      <option value="Không giảm thuế">Không giảm thuế</option>
                      <option value="Giảm thuế theo NQ43">Giảm thuế theo NQ43</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Số lượng tồn ban đầu</label>
                    <input type="number" defaultValue={20} id="new-item-qty" style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Giá trị tồn ban đầu (VND)</label>
                    <input type="number" defaultValue={5600000} id="new-item-val" style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }} />
                  </div>
                </div>
              </div>
              <div style={{ padding: "12px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setShowAddItemModal(false)} style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer" }}>Hủy</button>
                <button
                  type="button"
                  onClick={() => {
                    const code = (document.getElementById("new-item-code") as HTMLInputElement)?.value || "VTHH001";
                    const name = (document.getElementById("new-item-name") as HTMLInputElement)?.value || "Biến dòng đo lường";
                    const type = (document.getElementById("new-item-type") as HTMLSelectElement)?.value || "Vật tư hàng hóa";
                    const vatPolicy = (document.getElementById("new-item-vat") as HTMLSelectElement)?.value || "Chưa xác định";
                    const stockQty = Number((document.getElementById("new-item-qty") as HTMLInputElement)?.value || 0);
                    const stockValue = Number((document.getElementById("new-item-val") as HTMLInputElement)?.value || 0);

                    setCatalogItems((prev) => [
                      { id: `item-${Date.now()}`, name, code, vatPolicy, type, stockQty, stockValue },
                      ...prev,
                    ]);
                    setShowAddItemModal(false);
                    notify(`Đã thêm thành công hàng hóa [${code}] ${name}`);
                  }}
                  style={{ height: 32, padding: "0 18px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}
                >
                  Lưu hàng hóa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Xem báo cáo */}
        {previewReportTitle && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#ffffff", borderRadius: 8, width: 920, maxWidth: "95vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
              <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileSpreadsheet size={18} style={{ color: "#00a862" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{previewReportTitle}</h3>
                </div>
                <button type="button" onClick={() => setPreviewReportTitle(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
              </div>
              <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: "#475569" }}>Kỳ báo cáo: <strong>Tháng 09/2026</strong></span>
                <span style={{ fontSize: 12.5, color: "#475569" }}>Kho áp dụng: <strong>Tất cả các kho</strong></span>
                <span style={{ fontSize: 12.5, color: "#475569" }}>Đơn vị tính: <strong>VND</strong></span>
              </div>
              <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Mã hàng</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Tên vật tư, hàng hóa</th>
                      <th style={{ padding: "8px 10px", textAlign: "center" }}>ĐVT</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Tồn đầu kỳ</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Nhập trong kỳ</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Xuất trong kỳ</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Tồn cuối kỳ</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Giá trị cuối kỳ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>VO-MSB-01</td>
                      <td style={{ padding: "8px 10px" }}>Vỏ tủ điện hạ thế MSB 2200x1200x800</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>Bộ</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>5</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>10</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>8</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>7</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>98.000.000</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>ACB-3200A</td>
                      <td style={{ padding: "8px 10px" }}>Máy cắt không khí ACB 3P 3200A Schneider</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>Cái</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>2</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>4</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>3</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>3</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>246.000.000</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>CAP-CXV-4X120</td>
                      <td style={{ padding: "8px 10px" }}>Cáp điện lực đồng CU/XLPE/PVC 0.6/1kV 4x120mm2 CADIVI</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>Mét</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>200</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>500</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>450</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>250</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>387.500.000</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                      <td colSpan={6} style={{ padding: "10px", textAlign: "right" }}>Tổng cộng:</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>260</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "#00a862" }}>731.500.000</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ padding: "12px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Trích xuất theo chuẩn kế toán VAS & TT 200/2014/TT-BTC</span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => notify("Đã xuất báo cáo ra file Excel")} style={{ height: 32, padding: "0 14px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <FileSpreadsheet size={14} style={{ color: "#16a34a" }} />
                    <span>Xuất Excel</span>
                  </button>
                  <button type="button" onClick={() => setPreviewReportTitle(null)} style={{ height: 32, padding: "0 18px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, cursor: "pointer", fontSize: 12.5 }}>
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}
